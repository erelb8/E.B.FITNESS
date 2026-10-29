/* מבנה הסטים בדף המתאמן: ההסבר בראש כל יום אימון, שורה מתחת לכל
   תרגיל, ותווית לכל סט ביומן. לא נשמר בנתונים — מגיע לכל מתאמן.
   ביום מוביליטי ובתרגיל של 2 סטים אין תוויות. */
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'); const { chromium } = require(ROOT + '/node_modules/playwright');
const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.json': 'application/json', '.css': 'text/css' };
const srv = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0].split('#')[0]));
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });

let pass = 0, fail = 0;
const t = (n, ok, i) => { ok ? pass++ : fail++; console.log((ok ? '✓ ' : '✗ ') + n + (ok ? '' : '  → ' + i)); };

const D = { name: 'דני בדיקה', goal: 'כוח', health: { signedAt: '2026-08-01', answers: {} },
  program: { days: [
    { name: 'יום 1 · רגליים', exercises: [
      { name: 'סקוואט', sets: '5', reps: '6' },
      { name: 'לחיצת רגליים', sets: '4', reps: '10' },
      { name: 'פשיטת ברך', sets: '3', reps: '12' },
      { name: 'כפיפות בטן', sets: '2', reps: '15' }] },
    { name: 'יום 4 · מוביליטי', exercises: [{ name: 'פתיחת ירך', sets: '3', reps: '10' }] }] },
  meals: [], meals_self: [], exercises_self: [], files: [] };

(async () => {
  await new Promise(r => srv.listen(0, r));
  let b; try { b = await chromium.launch(); } catch (e) { b = await chromium.launch({ channel: 'chrome' }); }
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, serviceWorkers: 'block' });
  const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.clock.install({ time: new Date('2026-10-29T10:00:00') });
  await p.route(/supabase\.co/, rt => {
    const fn = (rt.request().url().split('/rpc/')[1] || '').split('?')[0]; let body = 'null';
    if (fn === 'trainee_program') body = JSON.stringify([D]);
    if (fn === 'trainee_extras') body = JSON.stringify([{ logs: [], weighins: [], session_state: { terms: { at: '2026-10-01T10:00:00.000Z', version: '3' } } }]);
    if (fn === 'trainee_save_state') body = 'true';
    rt.fulfill({ status: 200, contentType: 'application/json', body });
  });
  await p.goto('http://localhost:' + srv.address().port + '/t.html#tok-sets');
  await p.waitForSelector('.category-tile'); await p.waitForTimeout(1200);

  console.log('=== תוכנית האימון ===');
  await p.click('[data-category="workout"]'); await p.waitForTimeout(600);
  const w = await p.evaluate(() => {
    const days = [...document.querySelectorAll('.dayc')];
    return {
      guide1: !!(days[0] && days[0].querySelector('.sets-guide')),
      guideTxt: days[0] && days[0].querySelector('.sets-guide') ? days[0].querySelector('.sets-guide').textContent : '',
      guide2: !!(days[1] && days[1].querySelector('.sets-guide')),
      roles: [...(days[0] ? days[0].querySelectorAll('.ex') : [])].map(x => (x.querySelector('.roles') || {}).textContent || '')
    };
  });
  t('ההסבר בראש יום הרגליים', w.guide1);
  t('ההסבר כולל 5, 4 ו-3 סטים', /5 סטים/.test(w.guideTxt) && /4 סטים/.test(w.guideTxt) && /3 סטים/.test(w.guideTxt) && /בלי משקל/.test(w.guideTxt), w.guideTxt);
  t('אין הסבר ביום מוביליטי', !w.guide2);
  t('סקוואט 5 סטים — חימום תנועה', /חימום תנועה/.test(w.roles[0]) && /3 סטי עבודה/.test(w.roles[0]), w.roles[0]);
  t('לחיצת רגליים 4 סטים — חימום קל ו-3 עבודה', /^סט 1 חימום קל/.test(w.roles[1]) && !/תנועה/.test(w.roles[1]), w.roles[1]);
  t('פשיטת ברך 3 סטים — עבודה', w.roles[2] === '3 סטי עבודה במשקל גבוה', w.roles[2]);
  t('בטן 2 סטים — בלי שורה', w.roles[3] === '', w.roles[3]);
  await p.screenshot({ path: path.join(require('os').tmpdir(), 'sets-workout.png'), fullPage: false });

  console.log('=== יומן האימון ===');
  await p.evaluate(() => { const m = document.getElementById('categoryModal'); if (m) m.remove(); document.body.style.overflow = ''; });
  await p.click('[data-category="log"]'); await p.waitForTimeout(600);
  const l = await p.evaluate(() => {
    const ex = [...document.querySelectorAll('.wl-ex')];
    return ex.map(x => [...x.querySelectorAll('.wl-role')].map(r => r.textContent));
  });
  t('סקוואט: תנועה, חימום, עבודה 3–5', JSON.stringify(l[0]) === JSON.stringify(['סט 1 · חימום תנועה · בלי משקל', 'סט 2 · חימום · משקל נמוך', 'סטים 3–5 · עבודה · משקל גבוה']), JSON.stringify(l[0]));
  t('לחיצת רגליים: חימום, עבודה 2–4', JSON.stringify(l[1]) === JSON.stringify(['סט 1 · חימום · משקל נמוך', 'סטים 2–4 · עבודה · משקל גבוה']), JSON.stringify(l[1]));
  t('בטן: בלי תוויות', l[3] && l[3].length === 0, JSON.stringify(l[3]));
  const ph = await p.$eval('[data-ws="0:0"][data-wf="w"]', x => x.placeholder);
  t('סט תנועה — "בלי משקל" במקום משקל', ph === 'בלי משקל', ph);
  t('ההסבר גם ביומן', !!(await p.$('.wl-ex ~ .sets-guide, .sets-guide')));
  await p.screenshot({ path: path.join(require('os').tmpdir(), 'sets-log.png'), fullPage: false });
  t('אין שגיאות', !errs.length, errs.join(' | '));

  await c.close(); await b.close(); srv.close();
  console.log('\n' + (fail ? 'נכשלו: ' + fail : 'הכל עבר') + '  |  עברו: ' + pass);
  process.exit(fail ? 1 : 0);
})();

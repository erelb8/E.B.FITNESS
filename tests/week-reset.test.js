/* איפוס שבועי בדף המתאמן (נובמבר 2026, אראל: "שיתאפס כל שבוע").
   בראשון הסימונים של השבוע שעבר מתאפסים; מה שסומן ולא נשלח עובר להודעה
   עם כפתור לשלוח למאמן, ולא נעלם. מכשיר שלא הכיר את האיפוס לא נמחק,
   וטיוטה משבוע שעבר לא חוזרת מהשרת. */
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
    { name: 'יום A', exercises: [{ name: 'סקוואט', sets: '4', reps: '6' }, { name: 'לחיצת רגליים', sets: '3', reps: '10' }] },
    { name: 'יום B', exercises: [{ name: 'מתח', sets: '4', reps: '8' }] }] },
  meals: [], meals_self: [], exercises_self: [], files: [] };
const KEY = 'ebfit_t_state_tok-week';

/* מתאמן אחד: מצב שמור במכשיר, טיוטה בשרת, ושעון */
async function run(b, { local, server, when, then, oldServer }) {
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, serviceWorkers: 'block' });
  const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.clock.install({ time: new Date(when) });
  if (local) await c.addInitScript(([k, v]) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem(k, v); sessionStorage.setItem('seeded', '1'); } }, [KEY, JSON.stringify(local)]);
  const saves = [], logs = [];
  await p.route(/supabase\.co/, rt => {
    const fn = (rt.request().url().split('/rpc/')[1] || '').split('?')[0]; let body = 'null';
    let a = {}; try { a = JSON.parse(rt.request().postData() || '{}'); } catch (e) {}
    if (fn === 'trainee_program') body = JSON.stringify([D]);
    if (fn === 'trainee_extras') body = JSON.stringify([{ logs: [], weighins: [], session_state: Object.assign({ terms: { at: '2026-10-01T10:00:00.000Z', version: '3' } }, server || {}) }]);
    if (fn === 'trainee_save_state') { saves.push(a.p_state); body = 'true'; }
    if (fn === 'trainee_log' && oldServer && 'p_date' in a) { logs.push(Object.assign({ rejected: true }, a));
      return rt.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST202', message: 'Could not find the function public.trainee_log(p_date, ...) in the schema cache' }) }); }
    if (fn === 'trainee_log') { logs.push(a); body = '"00000000-0000-0000-0000-000000000001"'; }
    rt.fulfill({ status: 200, contentType: 'application/json', body });
  });
  const base = 'http://localhost:' + srv.address().port + '/t.html#tok-week';
  await p.goto(base); await p.waitForSelector('.category-tile'); await p.waitForTimeout(1500);
  const r = await then(p, { saves, logs });
  r.errs = errs;
  await c.close();
  return r;
}
const look = p => p.evaluate(k => {
  const s = JSON.parse(localStorage.getItem(k) || '{}');
  const bar = document.querySelector('.bar .bar-copy b');
  return { s, marks: Object.keys(s).filter(x => /^\d+:\d+$/.test(x)), bar: bar ? bar.textContent : '-',
           banner: !!document.querySelector('[data-left-send]') };
}, KEY);

(async () => {
  await new Promise(r => srv.listen(0, r));
  let b; try { b = await chromium.launch(); } catch (e) { b = await chromium.launch({ channel: 'chrome' }); }
  const MARKS = { '0:0': { done: true, weight: '80', reps: '6' }, '0:1': { weight: '', reps: '' }, '1:0': { done: true } };

  console.log('=== אמצע השבוע: לא נוגעים ===');
  let r = await run(b, { local: Object.assign({ wk: '2026-11-15' }, MARKS), when: '2026-11-19T10:00:00', then: look });
  t('הסימונים נשארים באותו שבוע', r.marks.length === 3 && r.s.wk === '2026-11-15', JSON.stringify(r.s));
  t('הסרגל סופר אותם', r.bar === '2', r.bar);
  t('אין הודעה', !r.banner);

  console.log('=== ראשון: שבוע חדש ===');
  r = await run(b, { local: Object.assign({ wk: '2026-11-15' }, MARKS), when: '2026-11-22T09:00:00', then: async (p, io) => {
    const a = await look(p);
    a.saved = io.saves[io.saves.length - 1] || null;
    a.text = await p.evaluate(() => (document.querySelector('[data-left-send]') || {}).closest ? document.querySelector('[data-left-send]').closest('.card').innerText : '');
    await p.click('[data-left-send]'); await p.waitForTimeout(900);
    a.after = await look(p); a.logs = io.logs;
    return a;
  } });
  t('הסימונים התאפסו', r.marks.length === 0, JSON.stringify(r.s));
  t('השבוע עודכן לראשון', r.s.wk === '2026-11-22', r.s.wk);
  t('הסרגל מתחיל מאפס', r.bar === '0', r.bar);
  t('מה שלא נשלח נשמר בצד', r.s.leftover && r.s.leftover.wk === '2026-11-15' && Object.keys(r.s.leftover.s).length === 2, JSON.stringify(r.s.leftover));
  t('האיפוס נשלח לשרת', r.saved && r.saved.wk === '2026-11-22' && !Object.keys(r.saved).some(k => /^\d+:\d+$/.test(k)), JSON.stringify(r.saved));
  t('הודעה למתאמן עם שני הימים', r.banner && /יום A/.test(r.text) && /יום B/.test(r.text) && /2 תרגילים/.test(r.text), r.text);
  const lA = r.logs.find(l => l.p_day_index === 0), lB = r.logs.find(l => l.p_day_index === 1);
  t('"לשלוח למאמן" שולח את שני הימים', r.logs.length === 2 && lA && lB, JSON.stringify(r.logs));
  t('עם המשקל שסומן ועם הערה שזה נשלח באיחור', lA && lA.p_entries[0].done === true && lA.p_entries[0].weight === '80' && /באיחור/.test(lA.p_note), JSON.stringify(lA));
  t('בלי יום סימון — נרשם בשבת של אותו שבוע', lA && lA.p_date === '2026-11-21' && lB.p_date === '2026-11-21', lA && lA.p_date);
  t('אחרי השליחה ההודעה נעלמת', !r.after.banner && !r.after.s.leftover, JSON.stringify(r.after.s));
  t('אין שגיאות', !r.errs.length, r.errs.join(' | '));

  console.log('=== התאריך האמיתי ===');
  r = await run(b, { local: { wk: '2026-11-15', '0:0': { done: true, weight: '80', at: '2026-11-17' }, '0:1': { done: true, at: '2026-11-19' }, '1:0': { done: true, at: '2026-11-20' } },
    when: '2026-11-22T09:00:00', then: async (p, io) => { await p.click('[data-left-send]'); await p.waitForTimeout(900); return { logs: io.logs }; } });
  const dA = (r.logs.find(l => l.p_day_index === 0) || {}).p_date, dB = (r.logs.find(l => l.p_day_index === 1) || {}).p_date;
  t('נרשם ביום האחרון שבו סומן', dA === '2026-11-19' && dB === '2026-11-20', dA + ' ' + dB);
  r = await run(b, { local: { wk: '2026-11-22' }, when: '2026-11-24T20:00:00', then: async (p, io) => {
    await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('ebfit_t_state_tok-week')); s['0:0'] = { done: true, weight: '70', at: '2026-11-23' }; localStorage.setItem('ebfit_t_state_tok-week', JSON.stringify(s)); });
    await p.reload(); await p.waitForSelector('.category-tile'); await p.waitForTimeout(1000);
    await p.click('[data-category="workout"]'); await p.waitForTimeout(400);
    await p.click('.dayc.on [data-fin="0"]'); await p.waitForTimeout(900);
    const a = { logs: io.logs.slice() };
    await p.evaluate(() => { const x = document.querySelector('[data-fin-close]'); if (x) x.click(); }); await p.waitForTimeout(300);   // מסך הסיכום שנפתח אחרי "סיימתי"
    await p.click('[data-category="workout"]').catch(() => {}); await p.waitForTimeout(300);
    await p.click('#categoryModal .dayc.on [data-chk="0"]').catch(() => {}); await p.waitForTimeout(200);
    await p.click('#categoryModal .dayc.on [data-fin="0"]').catch(() => {}); await p.waitForTimeout(900);
    a.logs2 = io.logs.slice(a.logs.length); return a; } });
  t('"סיימתי" על אימון של אתמול — נרשם באתמול', r.logs.length === 1 && r.logs[0].p_date === '2026-11-23', JSON.stringify(r.logs.map(l => l.p_date)));
  t('אימון של היום — בלי תאריך (השרת רושם היום)', r.logs2.length === 1 && !('p_date' in r.logs2[0]), JSON.stringify(r.logs2.map(l => l.p_date)));

  r = await run(b, { oldServer: true, local: { wk: '2026-11-15', '0:0': { done: true, at: '2026-11-17' } },
    when: '2026-11-22T09:00:00', then: async (p, io) => { await p.click('[data-left-send]'); await p.waitForTimeout(1200); return { logs: io.logs, banner: !!(await p.$('[data-left-send]')) }; } });
  t('שרת שעוד לא עודכן — נשלח שוב בלי תאריך, פעם אחת', r.logs.length === 2 && r.logs[0].rejected && !('p_date' in r.logs[1]) && !r.banner, JSON.stringify(r.logs.map(l => [l.rejected, l.p_date])));

  console.log('=== "לא צריך" ===');
  r = await run(b, { local: Object.assign({ wk: '2026-11-15' }, MARKS), when: '2026-11-22T09:00:00', then: async (p, io) => {
    await p.click('[data-left-hide]'); await p.waitForTimeout(400); const a = await look(p); a.logs = io.logs.length; return a; } });
  t('"לא צריך" מסתיר בלי לשלוח', !r.banner && !r.s.leftover && r.logs === 0, JSON.stringify(r));

  console.log('=== מכשיר שלא הכיר את האיפוס ===');
  r = await run(b, { local: Object.assign({}, MARKS), when: '2026-11-22T09:00:00', then: look });
  t('לא מוחקים — אין דרך לדעת מאיזה שבוע', r.marks.length === 3 && r.s.wk === '2026-11-22' && !r.banner, JSON.stringify(r.s));

  console.log('=== שבועיים בלי לפתוח ===');
  r = await run(b, { local: Object.assign({ wk: '2026-11-01' }, MARKS), when: '2026-11-22T09:00:00', then: look });
  t('מתאפס, בלי הודעה על משהו ישן', r.marks.length === 0 && !r.banner && !r.s.leftover, JSON.stringify(r.s));

  console.log('=== הדף פתוח במוצאי שבת ===');
  r = await run(b, { local: Object.assign({ wk: '2026-11-15' }, MARKS), when: '2026-11-21T23:59:00', then: async p => {
    const a0 = await look(p);
    await p.clock.fastForward('02:00'); await p.click('[data-category="workout"]'); await p.waitForTimeout(400);
    await p.click('[data-category-close]'); await p.waitForTimeout(300);
    const a = await look(p); a.before = a0.marks.length; return a; } });
  t('בשבת הסימונים שם, אחרי חצות הם מתאפסים', r.before === 3 && r.marks.length === 0 && r.banner, JSON.stringify(r));

  console.log('=== סימון וי נשמר ===');
  r = await run(b, { local: { wk: '2026-11-22' }, when: '2026-11-22T09:00:00', then: async (p, io) => {
    await p.click('[data-category="workout"]'); await p.waitForTimeout(400);
    await p.click('.dayc.on [data-chk="0"]'); await p.waitForTimeout(1300);
    const a = await look(p); a.sent = io.saves.some(x => x && x['0:0'] && x['0:0'].done);
    await p.reload(); await p.waitForSelector('.category-tile'); await p.waitForTimeout(1200);
    a.after = await look(p); return a; } });
  t('וי בלי משקל נשמר במכשיר ובשרת', r.s['0:0'] && r.s['0:0'].done === true && r.sent, JSON.stringify(r.s));
  t('ונשאר אחרי סגירה ופתיחה', r.after.s['0:0'] && r.after.s['0:0'].done === true && r.after.bar === '1', JSON.stringify(r.after));

  console.log('=== טיוטה בשרת ===');
  r = await run(b, { local: { wk: '2026-11-22' }, server: Object.assign({ wk: '2026-11-15' }, MARKS), when: '2026-11-22T09:00:00', then: look });
  t('טיוטה משבוע שעבר לא חוזרת מהשרת', r.marks.length === 0, JSON.stringify(r.s));
  r = await run(b, { local: { wk: '2026-11-22' }, server: Object.assign({ wk: '2026-11-22' }, MARKS), when: '2026-11-22T09:00:00', then: look });
  t('טיוטה של השבוע הזה חוזרת (טלפון אחר)', r.marks.length === 3, JSON.stringify(r.s));

  await b.close(); srv.close();
  console.log('\n' + (fail ? '### נכשלו: ' + fail : 'הכל עבר') + '  |  עברו: ' + pass);
  process.exit(fail ? 1 : 0);
})();

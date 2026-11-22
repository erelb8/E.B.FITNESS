/* נוחות בדף המתאמן (נובמבר 2026, "שיהיה יותר נוח להשתמש"):
   פעם קודמת בכל תרגיל, טיימר מנוחה, מעבר לתרגיל הבא אחרי וי, "חזור" של
   הטלפון סוגר את החלון, הסרגל התחתון פותח את האימון, האריחים מיד אחרי
   כרטיס הפתיחה, והצ׳ק-אין החודשי מקופל לשורה אחת. */
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
    { name: 'יום A', exercises: [{ name: 'סקוואט', sets: '4', reps: '6', rest: '120' }, { name: 'לחיצת רגליים', sets: '3', reps: '10', rest: '2 דק׳' }, { name: 'פשיטת ברך', sets: '3', reps: '12' }] },
    { name: 'יום B', exercises: [{ name: 'מתח', sets: '4', reps: '8' }] }] },
  meals: [], meals_self: [], exercises_self: [], files: [] };

(async () => {
  await new Promise(r => srv.listen(0, r));
  let b; try { b = await chromium.launch(); } catch (e) { b = await chromium.launch({ channel: 'chrome' }); }
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.clock.install({ time: new Date('2026-11-24T10:00:00') });
  await p.route(/supabase\.co/, rt => {
    const fn = (rt.request().url().split('/rpc/')[1] || '').split('?')[0]; let body = 'null';
    if (fn === 'trainee_program') body = JSON.stringify([D]);
    if (fn === 'trainee_extras') body = JSON.stringify([{ logs: [{ date: '2026-11-20', day_name: 'יום A', entries: [{ ex: 'סקוואט', done: true, weight: 70, reps: 6 }] }],
      weighins: [], session_state: { terms: { at: '2026-10-01T10:00:00.000Z', version: '3' } } }]);
    if (fn === 'trainee_save_state') body = 'true';
    rt.fulfill({ status: 200, contentType: 'application/json', body });
  });
  await p.goto('http://localhost:' + srv.address().port + '/t.html#tok-ux');
  await p.waitForSelector('.category-tile'); await p.waitForTimeout(1500);

  console.log('=== המסך הראשי ===');
  const order = await p.evaluate(() => { const w = document.getElementById('wrap'), h = w.querySelector('.th-hero'), g = w.querySelector('.category-grid'), ck = w.querySelector('[data-ck-open]');
    const y = e => e ? e.getBoundingClientRect().top + scrollY : -1; return { hero: y(h), grid: y(g), ck: y(ck), ckQs: w.querySelectorAll('[data-ck]').length }; });
  t('האריחים מיד אחרי כרטיס הפתיחה, לפני השאלונים', order.hero < order.grid && order.grid < order.ck, JSON.stringify(order));
  t('הצ׳ק-אין החודשי מקופל לשורה אחת', order.ck > 0 && order.ckQs === 0, JSON.stringify(order));
  await p.tap('[data-ck-open]'); await p.waitForTimeout(300);
  t('"למלא" פותח את השאלות', await p.evaluate(() => document.querySelectorAll('[data-ck]').length) === 20);

  console.log('=== כפתור "חזור" ===');
  await p.tap('[data-category="food"]'); await p.waitForTimeout(400);
  const open1 = await p.evaluate(() => !!document.getElementById('categoryModal'));
  await p.goBack(); await p.waitForTimeout(400);
  t('"חזור" סוגר את החלון ונשאר בדף', open1 && await p.evaluate(() => !document.getElementById('categoryModal') && /t\.html$/.test(location.pathname)));
  await p.tap('[data-category="food"]'); await p.waitForTimeout(400);
  await p.tap('[data-category="workout"].category-tile').catch(() => {});
  await p.evaluate(() => document.querySelector('[data-category-close]').click()); await p.waitForTimeout(400);
  t('סגירה ב-X לא משאירה רשומה בהיסטוריה', await p.evaluate(() => !(history.state && history.state.ebWin)));

  console.log('=== באימון ===');
  await p.tap('.bar'); await p.waitForTimeout(500);
  t('הסרגל התחתון פותח את האימון', await p.evaluate(() => !!document.querySelector('#categoryModal .dayc')));
  const ex = await p.evaluate(() => [...document.querySelectorAll('#categoryModal .dayc.on .ex')].map(e => ({ last: (e.querySelector('.ex-last') || {}).innerText || '', rest: (e.querySelector('.rest-btn') || {}).innerText || '' })));
  t('בפעם הקודמת — מהדיווח האחרון', /70 ק״ג × 6/.test(ex[0].last) && !ex[1].last, JSON.stringify(ex));
  t('מנוחה לפי התוכנית: 120 שנ׳, 2 דק׳, ובלי — דקה וחצי', /2:00/.test(ex[0].rest) && /2:00/.test(ex[1].rest) && /1:30/.test(ex[2].rest), JSON.stringify(ex));
  await p.tap('#categoryModal .dayc.on .ex >> nth=0 >> .rest-btn'); await p.clock.fastForward(5000); await p.waitForTimeout(100);
  const pill = await p.evaluate(() => { const e = document.getElementById('restPill'); return e ? e.querySelector('b').textContent : ''; });
  t('טיימר המנוחה רץ', pill === '1:55', pill);
  await p.tap('#restPill [data-rest="add"]'); await p.waitForTimeout(100);
  t('+30 מוסיף חצי דקה', await p.evaluate(() => document.querySelector('#restPill b').textContent) === '2:25');
  await p.evaluate(() => document.querySelector('[data-category-close]').click()); await p.waitForTimeout(200);
  t('הטיימר ממשיך גם כשהחלון נסגר', await p.evaluate(() => !!document.getElementById('restPill')));
  let vib = 0; await p.exposeFunction('__vib', () => { vib++; });
  await p.evaluate(() => { navigator.vibrate = () => { window.__vib(); return true; }; });
  await p.clock.fastForward(150000); await p.waitForTimeout(300);
  t('בסוף: נעלם, ורטט', await p.evaluate(() => !document.getElementById('restPill')) && vib === 1, 'vib ' + vib);

  await p.tap('.bar'); await p.waitForTimeout(500);
  const y0 = await p.evaluate(() => document.querySelector('.category-dialog').scrollTop);
  await p.tap('#categoryModal .dayc.on [data-chk="0"]'); await p.clock.fastForward(1500); await p.waitForTimeout(700);
  const y1 = await p.evaluate(() => document.querySelector('.category-dialog').scrollTop);
  t('אחרי וי המסך עובר לתרגיל הבא', y1 > y0, y0 + ' → ' + y1);

  t('אין שגיאות', !errs.length, errs.join(' | '));
  await b.close(); srv.close();
  console.log('\n' + (fail ? '### נכשלו: ' + fail : 'הכל עבר') + '  |  עברו: ' + pass);
  process.exit(fail ? 1 : 0);
})();

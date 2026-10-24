/* "איך היה היום?" מקצה לקצה: המתאמן עונה בערב → הבוט מכניס לטבלת
   ההרגלים → trainee_save_state שולח → המאמן רואה בפיד "מה המתאמנים עשו".
   השרת מדומה ושומר את session_state כמו האמיתי: מחליף את כל הבלוב. */
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'); const { chromium } = require(ROOT + '/node_modules/playwright');
const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.json': 'application/json', '.css': 'text/css' };
const srv = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0].split('#')[0]));
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });

let pass = 0, fail = 0;
const t = (n, ok, i) => { ok ? pass++ : fail++; console.log((ok ? '✓ ' : '✗ ') + n + (ok ? '' : '  → ' + i)); };

const WHEN = new Date('2026-11-02T19:30:00');
const D = { name: 'דני בדיקה', goal: 'כוח', health: { signedAt: '2026-08-01', answers: {} },
  program: { days: [{ name: 'A', exercises: [{ name: 'לחיצת חזה במוט' }] }], mobility: [{ name: 'חתול-פרה' }, { name: 'מתיחת יונה' }] }, meals: [], meals_self: [], exercises_self: [], files: [] };
let STATE_SRV = { terms: { at: '2026-10-01T10:00:00.000Z', version: '3' }, checkins: [{ month: '2026-11', at: 'x' }] };

async function visit(b, when) {
  when = when || WHEN;
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, serviceWorkers: 'block' });
  const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.clock.install({ time: when });
  await p.route(/supabase\.co/, rt => {
    const fn = (rt.request().url().split('/rpc/')[1] || '').split('?')[0]; let body = 'null', a = {};
    try { a = JSON.parse(rt.request().postData() || '{}'); } catch (e) {}
    if (fn === 'trainee_program') body = JSON.stringify([D]);
    if (fn === 'trainee_extras') body = JSON.stringify([{ logs: [{ date: '2026-11-01', entries: [] }], weighins: [], session_state: STATE_SRV }]);
    if (fn === 'trainee_save_state') { STATE_SRV = a.p_state; body = 'true'; }
    rt.fulfill({ status: 200, contentType: 'application/json', body });
  });
  await p.goto('http://localhost:' + srv.address().port + '/t.html#tok-ck');
  await p.waitForSelector('.category-tile'); await p.waitForTimeout(1500);
  return { c, p, errs };
}

(async () => {
  await new Promise(r => srv.listen(0, r));
  let b; try { b = await chromium.launch(); } catch (e) { b = await chromium.launch({ channel: 'chrome' }); }

  console.log('=== בבוקר אין שאלה ===');
  { const { c, p } = await visit(b, new Date('2026-11-02T10:00:00')); t('ב-10:00 הכרטיס לא מופיע', !(await p.$('[data-dy-save]'))); await c.close(); }

  console.log('=== בערב המתאמן עונה ===');
  {
    const { c, p, errs } = await visit(b);
    t('ב-19:30 הכרטיס מופיע', !!(await p.$('[data-dy-save]')));
    t('"שמירה" נעול לפני שעונים', await p.$eval('[data-dy-save]', x => x.disabled));
    await p.click('[data-dy="tr:no"]'); await p.click('[data-dy="ate:yes"]'); await p.click('[data-dy="all:no"]');
    t('תשובה שלילית פותחת "מה עשית ומה לא"', !!(await p.$('[data-dy-note]')));
    await p.fill('[data-dy-note]', 'לא הספקתי להתאמן, עשיתי חתול-פרה אבל לא עשיתי מתיחת יונה');
    await p.click('[data-dy-save]'); await p.waitForTimeout(1500);
    t('הכרטיס נעלם אחרי שמירה', !(await p.$('[data-dy-save]')));
    const day = ((STATE_SRV.habits || {}).marks || {})['2026-11-02'] || {};
    t('הסיכום הגיע לשרת', day.daily && day.daily.tr === 'no' && day.daily.ate === 'yes' && /חתול-פרה/.test(day.daily.note), JSON.stringify(day));
    t('הבוט סימן תזונה', day.food === true, JSON.stringify(day));
    t('הבוט סימן את חתול-פרה', !!(day.mob && day.mob['חתול-פרה']), JSON.stringify(day.mob));
    t('ולא את מתיחת יונה (נכתב "לא עשיתי")', !(day.mob && day.mob['מתיחת יונה']), JSON.stringify(day.mob));
    t('אישור התקנון והצ׳ק-אין לא נמחקו', !!(STATE_SRV.terms && STATE_SRV.checkins), Object.keys(STATE_SRV).join(','));
    await p.click('[data-category="habits"]'); await p.waitForTimeout(500);
    t('בטבלת ההרגלים: "איך היה היום" עם הסיכום', await p.evaluate(() => /איך היה היום/.test(document.body.innerText) && /חתול-פרה/.test(document.body.innerText)));
    t('אין שגיאות', !errs.length, errs.join(' | '));
    await c.close();
  }
  { const { c, p } = await visit(b); t('במכשיר אחר לא נשאל שוב באותו ערב', !(await p.$('[data-dy-save]'))); await c.close(); }

  console.log('=== המאמן רואה ===');
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const p = await c.newPage(); const cErr = []; p.on('pageerror', e => cErr.push(e.message));
  await p.clock.install({ time: new Date('2026-11-02T20:00:00') });
  await p.route(/supabase\.co/, rt => rt.fulfill({ status: 200, contentType: 'application/json', body: 'null' }));
  await p.goto('http://localhost:' + srv.address().port + '/index.html');
  await p.waitForFunction(() => typeof vDash === 'function', null, { timeout: 30000 });
  const feed = await p.evaluate((habits) => {
    if (window.EBSync) { EBSync.enabled = () => false; EBSync.schedule = () => {}; } window.save = () => {};
    /* כמו sync.js: habitsLog: (r.session_state || {}).habits */
    S.trainees = [{ id: 'e', name: 'דני בדיקה', status: 'active', program: { days: [] }, meals: [], habitsLog: habits }];
    S.payments = []; DASH.logs = []; DASH.at = Date.now() + 1e9;
    const V = document.getElementById('view'); VIEW = 'dash'; V.innerHTML = vDash();
    const f = V.querySelector('.dash-feed'); return f ? f.innerText : '';
  }, STATE_SRV.habits);
  t('בפיד: "סיכום יום" עם התשובות', /סיכום יום/.test(feed) && /אימון ✗/.test(feed) && /תזונה ✓/.test(feed), feed);
  t('עם מה שכתב', /לא הספקתי להתאמן/.test(feed), feed);
  t('מסומן "משהו לא הלך"', /משהו לא הלך/.test(feed), feed);
  t('אין שגיאות אצל המאמן', !cErr.length, cErr.join(' | '));
  await b.close(); srv.close();
  console.log('\n' + (fail ? 'נכשלו: ' + fail : 'הכל עבר') + '  |  עברו: ' + pass);
  process.exit(fail ? 1 : 0);
})();

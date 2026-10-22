/* צ׳ק-אין חודשי מקצה לקצה: המתאמן עונה בדף שלו → trainee_save_state
   שולח את התשובות → המאמן רואה אותן בלוח הבקרה ובכרטיס.
   השרת מדומה ושומר את session_state כמו האמיתי: מחליף את כל הבלוב. */
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'); const { chromium } = require(ROOT + '/node_modules/playwright');
const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.json': 'application/json', '.css': 'text/css' };
const srv = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0].split('#')[0]));
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });

let pass = 0, fail = 0;
const t = (n, ok, i) => { ok ? pass++ : fail++; console.log((ok ? '✓ ' : '✗ ') + n + (ok ? '' : '  → ' + i)); };

const WHEN = new Date('2026-11-02T10:00:00');
const D = { name: 'דני בדיקה', goal: 'כוח', health: { signedAt: '2026-08-01', answers: {} },
  program: { days: [{ name: 'A', exercises: [{ name: 'לחיצת חזה במוט' }] }] }, meals: [], meals_self: [], exercises_self: [], files: [] };
let STATE_SRV = { terms: { at: '2026-10-01T10:00:00.000Z', version: '3' } };

async function visit(b) {
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, serviceWorkers: 'block' });
  const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.clock.install({ time: WHEN });
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

  console.log('=== המתאמן עונה ===');
  {
    const { c, p, errs } = await visit(b);
    t('השאלון מופיע ב-2 לחודש', !!(await p.$('[data-ck-send]')));
    t('"שליחה" נעול לפני שעונים', await p.$eval('[data-ck-send]', x => x.disabled));
    for (const [k, v] of [['sleep', 2], ['energy', 4], ['food', 3], ['mot', 5]]) { await p.click('[data-ck="' + k + ':' + v + '"]'); await p.waitForTimeout(80); }
    await p.click('[data-ck-pain="true"]'); await p.waitForTimeout(150);
    await p.fill('[data-ck-text="painNote"]', 'כאב בכתף ימין בלחיצת חזה');
    await p.fill('[data-ck-text="note"]', 'אפשר פחות ימים בשבוע?');
    t('"שליחה" נפתח אחרי שעונים', !(await p.$eval('[data-ck-send]', x => x.disabled)));
    await p.click('[data-ck-send]'); await p.waitForTimeout(1500);
    t('השאלון נעלם אחרי שליחה', !(await p.$('[data-ck-send]')));
    const ck = (STATE_SRV.checkins || [])[0];
    t('התשובות הגיעו לשרת', ck && ck.month === '2026-11' && ck.sleep === 2 && ck.mot === 5 && ck.pain === true, JSON.stringify(STATE_SRV.checkins));
    t('הטקסטים הגיעו לשרת', ck && /כתף ימין/.test(ck.painNote) && /פחות ימים/.test(ck.note), JSON.stringify(ck));
    t('אישור התקנון לא נמחק מהבלוב', !!(STATE_SRV.terms && STATE_SRV.terms.version), JSON.stringify(STATE_SRV.terms));
    t('אין שגיאות', !errs.length, errs.join(' | '));
    await c.close();
  }
  {
    const { c, p } = await visit(b);   // מכשיר אחר — מגיע מהשרת
    t('במכשיר אחר לא נשאל שוב באותו חודש', !(await p.$('[data-ck-send]')));
    await c.close();
  }

  console.log('=== המאמן רואה ===');
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const p = await c.newPage(); const cErr = []; p.on('pageerror', e => cErr.push(e.message));
  await p.clock.install({ time: WHEN });
  await p.route(/supabase\.co/, rt => rt.fulfill({ status: 200, contentType: 'application/json', body: 'null' }));
  await p.goto('http://localhost:' + srv.address().port + '/index.html');
  await p.waitForFunction(() => typeof vDash === 'function', null, { timeout: 30000 });
  const r = await p.evaluate((ckList) => {
    if (window.EBSync) { EBSync.enabled = () => false; EBSync.schedule = () => {}; } window.save = () => {};
    /* כמו sync.js: checkins: (r.session_state || {}).checkins */
    S.trainees = [{ id: 'e', name: 'דני בדיקה', status: 'active', program: { days: [] }, meals: [], checkins: ckList },
                  { id: 'f', name: 'רון אחר', status: 'active', program: { days: [] }, meals: [] }];
    S.payments = []; DASH.logs = []; DASH.at = Date.now() + 1e9;
    const V = document.getElementById('view'); VIEW = 'dash'; V.innerHTML = vDash();
    const card = [].find.call(V.querySelectorAll('.card'), x => /צ׳ק-אין חודשי/.test(x.textContent));
    VIEW = 'trainee'; ARG = 'e'; SUBTAB = 'program';
    return { card: card ? card.innerText : '', prog: vTrainee('e') };
  }, STATE_SRV.checkins);
  t('כרטיס בלוח הבקרה: 1 מתוך 2 ענו', /1 מתוך 2 ענו/.test(r.card), r.card);
  t('מסומן "צריך תשומת לב" עם הכאב', /צריך תשומת לב/.test(r.card) && /כתף ימין/.test(r.card), r.card);
  t('ההערה מופיעה', /פחות ימים/.test(r.card), r.card);
  t('היסטוריה בכרטיס המתאמן', /צ׳ק-אין חודשי/.test(r.prog) && /נובמבר/.test(r.prog), '');
  t('אין שגיאות אצל המאמן', !cErr.length, cErr.join(' | '));

  await b.close(); srv.close();
  console.log('\n' + (fail ? 'נכשלו: ' + fail : 'הכל עבר') + '  |  עברו: ' + pass);
  process.exit(fail ? 1 : 0);
})();

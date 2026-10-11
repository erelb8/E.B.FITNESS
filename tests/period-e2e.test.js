/* בדיקה מקצה לקצה: מתאמן מדווח ונשקל בדף שלו → השרת שומר → המאמן
   בונה סיכום תקופה מאותם נתונים. השרת מדומה, אבל שומר בדיוק כמו
   הפונקציות האמיתיות: trainee_log מוסיף שורה ל-workout_logs עם תאריך
   היום, trainee_weigh מחליף את השקילה של אותו יום. */
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'); const { chromium } = require(ROOT + '/node_modules/playwright');
const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.json': 'application/json', '.css': 'text/css' };
const srv = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0].split('#')[0]));
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });

let pass = 0, fail = 0;
const t = (n, ok, i) => { ok ? pass++ : fail++; console.log((ok ? '✓ ' : '✗ ') + n + (ok ? '' : '  → ' + i)); };

const DB = { logs: [], weighins: [], calls: [] };
const iso = d => d.toISOString().slice(0, 10);
const START = new Date('2026-08-20T09:00:00');
const plusDays = n => new Date(START.getTime() + n * 86400000);
const PROGRAM = { planStart: iso(START), planMonths: 2, days: [{ name: 'A', exercises: [
  { name: 'לחיצת חזה במוט', sets: '2', reps: '8' }, { name: 'סקוואט גבי', sets: '2', reps: '6' }] }] };
const D = { name: 'דני בדיקה', goal: 'חיטוב', health: { signedAt: '2026-08-01', answers: {} }, program: PROGRAM,
  meals: [], meals_self: [], exercises_self: [], files: [] };

async function traineeVisit(b, when, act) {
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, serviceWorkers: 'block' });
  const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.clock.install({ time: when });
  await p.route(/supabase\.co/, async rt => {
    const url = rt.request().url(), fn = (url.split('/rpc/')[1] || '').split('?')[0];
    let body = 'null', args = {};
    try { args = JSON.parse(rt.request().postData() || '{}'); } catch (e) {}
    if (fn) DB.calls.push(fn);
    if (fn === 'trainee_program') body = JSON.stringify([D]);
    if (fn === 'trainee_extras') body = JSON.stringify([{ logs: DB.logs, weighins: DB.weighins,
      session_state: { terms: { at: when.toISOString(), version: '3' } } }]);
    if (fn === 'trainee_log') {
      DB.logs.push({ id: 'l' + DB.logs.length, trainee_id: 'e', date: iso(when), day_index: args.p_day_index, day_name: args.p_day_name,
        entries: args.p_entries, feel: args.p_feel, note: args.p_note, created_at: when.toISOString() });
      body = JSON.stringify('l' + DB.logs.length);
    }
    if (fn === 'trainee_weigh') {
      const day = args.p_date || iso(when);
      DB.weighins = DB.weighins.filter(w => w.date !== day).concat([{ date: day, weight: args.p_weight, fat: args.p_fat }]);
      body = JSON.stringify(DB.weighins);
    }
    rt.fulfill({ status: 200, contentType: 'application/json', body });
  });
  await p.goto('http://localhost:' + srv.address().port + '/t.html#tok-e2e');
  await p.waitForSelector('.category-tile'); await p.waitForTimeout(1200);
  await act(p);
  await p.waitForTimeout(800);
  await c.close();
  return errs;
}
async function logWorkout(p, bench, squat) {
  await p.click('[data-category="log"]'); await p.waitForTimeout(500);
  const fill = async (sel, v) => { const el = await p.$(sel); await el.fill(String(v)); await el.dispatchEvent('input'); await el.dispatchEvent('change'); };
  await fill('[data-ws="0:0"][data-wf="w"]', bench); await fill('[data-ws="0:0"][data-wf="r"]', 8);
  await fill('[data-ws="1:0"][data-wf="w"]', squat); await fill('[data-ws="1:0"][data-wf="r"]', 6);
  await p.waitForTimeout(300);
  await p.click('[data-wlsave]'); await p.waitForTimeout(800);
}
async function weigh(p, w) {
  await p.click('[data-category="follow"]'); await p.waitForTimeout(500);
  await p.fill('#pg_w', String(w)); await p.click('[data-pg="save"]'); await p.waitForTimeout(800);
  await p.click('[data-category-close]'); await p.waitForTimeout(400);
}

(async () => {
  await new Promise(r => srv.listen(0, r));
  let b; try { b = await chromium.launch(); } catch (e) { b = await chromium.launch({ channel: 'chrome' }); }
  console.log('=== צד המתאמן: 3 ביקורים לאורך התקופה ===');
  let errs = [];
  errs = errs.concat(await traineeVisit(b, plusDays(0), async p => { await weigh(p, 84); await logWorkout(p, 60, 80); }));
  errs = errs.concat(await traineeVisit(b, plusDays(25), async p => { await logWorkout(p, 67.5, 90); }));
  errs = errs.concat(await traineeVisit(b, plusDays(52), async p => { await weigh(p, 80.5); await logWorkout(p, 75, 100); }));
  t('3 אימונים נשמרו בשרת', DB.logs.length === 3, JSON.stringify(DB.calls));
  t('2 שקילות נשמרו בשרת', DB.weighins.length === 2, JSON.stringify(DB.weighins));
  t('האימונים נשמרו עם תאריך היום', DB.logs.map(l => l.date).join(',') === [0, 25, 52].map(n => iso(plusDays(n))).join(','), DB.logs.map(l => l.date).join(','));
  t('אין שגיאות בדף המתאמן', !errs.length, errs.join(' | '));

  console.log('=== צד המאמן: הסיכום נבנה מאותם נתונים ===');
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block' });
  const p = await c.newPage(); const cErr = []; p.on('pageerror', e => cErr.push(e.message));
  await p.clock.install({ time: plusDays(58) });
  await p.route(/supabase\.co/, rt => {
    const url = rt.request().url();
    if (/\/rest\/v1\/workout_logs/.test(url)) return rt.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(DB.logs) });
    rt.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
  });
  await p.goto('http://localhost:' + srv.address().port + '/index.html');
  await p.waitForFunction(() => typeof vDash === 'function' && window.EBPeriod, null, { timeout: 30000 });
  const port = srv.address().port;
  const res = await p.evaluate(async ({ prog, weighins }) => {
    if (window.EBSync) { EBSync.enabled = () => true; EBSync.schedule = () => {}; }
    window.save = () => {};
    /* אותה שאילתה כמו EBSync.logsFor — בדיקה זו לא מתחברת עם משתמש אמיתי */
    EBSync.logsFor = async (id) => (await fetch('https://x.supabase.co/rest/v1/workout_logs?trainee_id=eq.' + id)).json();
    S.settings.trainer = 'אראל באואר';
    /* השקילות מגיעות למאמן בשורת המתאמן מהשרת (sync.js: weighins: r.weighins) */
    S.trainees = [{ id: 'e', name: 'דני בדיקה', gender: 'זכר', status: 'active', goal: 'חיטוב', program: prog, meals: [], weighins }];
    S.measures = []; S.sessions = [];
    VIEW = 'trainee'; ARG = 'e'; SUBTAB = 'program';
    const btn = /סיכום תקופה · תמונה למתאמן/.test(vTrainee('e'));
    EBPeriod.open('e');
    for (let i = 0; i < 50 && !document.querySelector('#pc_body img'); i++) await new Promise(r => setTimeout(r, 100));
    const img = document.querySelector('#pc_body img');
    const d = EBPeriod.compute(tById('e'), 'plan', await EBSync.logsFor('e'));
    return { btn, img: img && img.src, w: d.weight, workouts: d.workouts, vol: d.vol, gains: d.gains, range: d.R };
  }, { prog: PROGRAM, weighins: DB.weighins });
  t('כפתור "סיכום תקופה" בכרטיס', res.btn);
  t('התמונה נוצרה', !!res.img && res.img.length > 50000, res.img && res.img.length);
  t('הטווח הוא תקופת המעקב', res.range && res.range.from === iso(START), JSON.stringify(res.range));
  t('משקל 84 → 80.5 (‎-3.5)', res.w && res.w.a === 84 && res.w.b === 80.5 && res.w.d === -3.5, JSON.stringify(res.w));
  t('3 אימונים', res.workouts === 3, res.workouts);
  t('נפח 60×8+80×6 + 67.5×8+90×6 + 75×8+100×6', res.vol === 480 + 480 + 540 + 540 + 600 + 600, res.vol);
  const bench = (res.gains || []).find(g => g.n === 'לחיצת חזה במוט');
  t('לחיצת חזה 60 → 75 (+25%)', bench && bench.a === 60 && bench.b === 75 && bench.pct === 25, JSON.stringify(res.gains));
  t('אין שגיאות באפליקציית המאמן', !cErr.length, cErr.join(' | '));
  await b.close(); srv.close();
  console.log('\n' + (fail ? 'נכשלו: ' + fail : 'הכל עבר') + '  |  עברו: ' + pass);
  process.exit(fail ? 1 : 0);
})();

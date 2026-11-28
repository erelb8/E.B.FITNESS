/* מה שהאפליקציה של המאמן מחשבת בעצמה מגיע לשרת ולמתאמן — בלי לדרוס אף אחד (נובמבר 2026,
   אראל: "תבדוק שזה עובד כמו שצריך, נשמר ומתעדכן אצל כולם").
   28.11.2026: יעד המשקל השבועי חושב במכשיר אצל 20 מתאמנים ובשרת היה אצל אף אחד. המשיכה נגמרת
   בשמירה שמחשבת יעדים מחדש, והתצלום של הסנכרון צולם אחרי החישוב — ולכן המספרים החדשים נרשמו
   כ"כבר בשרת". אותו דבר קרה ליעד קלורי שהשתנה אחרי שקילה של מתאמן.
   התיקון שולח ערכים מחושבים בכתיבה צרה (רק targets / wplan / fig, על גבי מה שבשרת באותו רגע,
   ורק אם אף אחד לא כתב מאז), כי שורה שלמה הייתה דורסת עריכה שהמתאמן עשה בדף שלו באותן שניות.
   כאן: index.html ו-sync.js האמיתיים מול שרת מדומה (PostgREST בזיכרון, עם trg_guard_stale_trainee
   ו-touch_trainees), ודף המתאמן האמיתי מול אותו שרת. כל הנתונים מומצאים. */
const http = require('http'), fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');

let pass = 0, fail = 0;
const t = (n, ok, i) => { ok ? pass++ : fail++; console.log((ok ? '✓ ' : '✗ ') + n + (ok ? '' : '  → ' + (i === undefined ? '' : i))); };

let chromium;
try { ({ chromium } = require(ROOT + '/node_modules/playwright')); } catch (e) { chromium = null; }
const TY = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.json': 'application/json', '.css': 'text/css' };
const srv = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0].split('#')[0]));
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': TY[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });

/* jsonb: מפתחות לפי אורך ואז לפי בתים */
const cmp = (a, b) => a.length - b.length || Buffer.compare(Buffer.from(a), Buffer.from(b));
const jb = v => Array.isArray(v) ? v.map(jb) : (v && typeof v === 'object') ? Object.keys(v).sort(cmp).reduce((o, k) => { o[k] = jb(v[k]); return o; }, {}) : v;
const canon = v => Array.isArray(v) ? '[' + v.map(canon).join(',') + ']' : (v && typeof v === 'object') ? '{' + Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}' : JSON.stringify(v === undefined ? null : v);
/* כל מה שבשורה חוץ ממה שהאפליקציה רשאית לחשב בעצמה */
const core = r => { const c = JSON.parse(JSON.stringify(r)); delete c.updated_at; if (c.program) { delete c.program.targets; delete c.program.wplan; delete c.program.fig; }
  if (c.private) { delete c.private.rev; delete c.private.appVer; } return canon(c); };

/* weight-plan.js האמיתי, כדי לחשב כאן את המספר שהמתאמן אמור לראות */
const WIN = {}; WIN.window = WIN;
vm.runInContext(fs.readFileSync(path.join(ROOT, 'weight-plan.js'), 'utf8'), vm.createContext({ window: WIN, Date, Math, JSON, String, Number, Array, Object, isFinite }));
const WP = WIN.EBWPlan;

let SEQ = 0;
const stamp = () => '2026-12-03T05:00:00.' + String(++SEQ).padStart(6, '0') + '+00:00';

function makeDb() {
  const ex = [{ name: 'סקוואט', sets: '3', reps: '5' }];
  const row = (id, name, goal, priv, weighins) => jb({ id, trainer_id: 'u-1', name, goal, status: 'active', deleted: false, files: [], meals: [], meals_self: [], exercises_self: [],
    health: { signedAt: '2026-08-01', answers: {} }, session_state: { terms: { at: '2026-10-01T10:00:00.000Z', version: '3' } }, access_token: 'tok-' + id, access_active: true,
    username: null, updated_at: stamp(), program: { days: [{ name: 'יום A', exercises: ex }] }, weighins: weighins || [],
    private: Object.assign({ rev: 5, appVer: 'v280' }, priv) });
  return {
    trainees: [
      row('w1', 'דני בדיקה', 'חיטוב', { gender: 'זכר', birth: '1992-03-10', height: 178 }, [{ date: '2026-11-19', weight: 86.2 }, { date: '2026-11-26', weight: 85.4 }]),
      row('w2', 'מיכל בדיקה', 'עלייה במסת שריר', { gender: 'נקבה', birth: '1995-06-01', height: 165 }, []),
      row('w3', 'רון כוח', 'כוח', { gender: 'זכר', birth: '1990-01-01', height: 180 }, [{ date: '2026-11-20', weight: 90 }])],
    measures: [jb({ id: 'm2', trainer_id: 'u-1', trainee_id: 'w2', date: '2026-11-17', deleted: false, data: { weight: 58.4, rev: 1 }, updated_at: stamp() })],
    sessions: [], payments: [], prefs: null, writes: [], rejected: 0, patchMiss: 0, hooks: {}, lastGet: '', pulls: 0, rejectPatch: null, patchBodies: [], failPull: 0 };
}
/* מה שהמתאמן עושה דרך הפונקציות שלו בשרת: בלי להעלות את המונה, ו-touch מזיז את updated_at */
const traineeWrite = (db, id, fn) => { const r = db.trainees.find(x => x.id === id); fn(r); r.program = jb(r.program); r.updated_at = stamp(); };
const runHook = async (db, name) => { const h = db.hooks[name]; if (h) { db.hooks[name] = null; await h(); } };

async function serve(p, db) {
  await p.route(/supabase\.co/, async rt => {
    const rq = rt.request(), u = new URL(rq.url()), m = rq.method();
    const pathn = u.pathname.replace(/^\/rest\/v1\//, ''), qs = u.searchParams;
    const ok = (body, st) => rt.fulfill({ status: st || 200, contentType: 'application/json', body: JSON.stringify(body) });
    let args = {}; try { args = JSON.parse(rq.postData() || '{}'); } catch (e) {}
    const byTok = () => db.trainees.find(r => r.access_token === args.p_token && !r.deleted);
    if (pathn === 'rpc/admin_session') return ok([{ admin_id: 'u-1', email: 'coach@example.test' }]);
    if (pathn === 'rpc/trainee_program') { const r = byTok(); return ok(r ? [{ name: r.name, goal: r.goal, program: r.program, files: r.files, trainer_name: 'מאמן בדיקה',
      meals: r.meals, meals_self: r.meals_self, exercises_self: r.exercises_self, health: r.health, weighins: r.weighins, height: r.private.height || null, weight: null }] : []); }
    if (pathn === 'rpc/trainee_extras') { const r = byTok(); return ok(r ? [{ logs: [], session_state: r.session_state, weighins: r.weighins }] : []); }
    if (pathn === 'rpc/trainee_coach') return ok({ name: 'מאמן בדיקה', phone: '0500000000', business: 'BAUER POWER', birthday: false });
    if (pathn.indexOf('rpc/') === 0) return ok(null);
    if (pathn === 'trainer_prefs') {
      if (m === 'GET') { if (db.lastGet === 'payments') await runHook(db, 'duringPrefs'); db.lastGet = 'trainer_prefs'; return ok(db.prefs ? [{ data: db.prefs }] : []); }
      try { db.prefs = JSON.parse(rq.postData())[0].data; } catch (e) {} return ok([], 201);
    }
    if (pathn === 'workout_logs') return ok([]);
    const table = db[pathn]; if (!table) return ok([]);
    const eqs = {}; for (const [k, v] of qs.entries()) if (/^eq\./.test(v) && k !== 'deleted') eqs[k] = v.slice(3);
    if (m === 'GET') {
      const sel = qs.get('select') || '*';
      if (pathn === 'trainees' && sel === '*') { db.pulls++; await runHook(db, 'duringPull');
        if (db.failPull > 0) { db.failPull--; return ok({ message: 'canceling statement due to statement timeout', code: '57014' }, 500); } }
      if (pathn === 'trainees' && sel === 'program,private,updated_at') await runHook(db, 'beforeRead');
      db.lastGet = pathn;
      let rows = table.filter(r => !r.deleted && Object.keys(eqs).every(k => String(r[k]) === eqs[k]));
      const idin = qs.get('id'); if (idin && /^in\./.test(idin)) { const ids = idin.slice(4, -1).split(',').map(s => s.replace(/^"|"$/g, '')); rows = rows.filter(r => ids.indexOf(r.id) > -1); }
      if (sel !== '*') { const cols = sel.split(','); rows = rows.map(r => cols.reduce((o, c) => { o[c] = r[c]; return o; }, {})); }
      return ok(JSON.parse(JSON.stringify(rows)));
    }
    const col = pathn === 'trainees' ? 'private' : 'data';
    if (m === 'PATCH') {
      await runHook(db, 'beforePatch');
      let body = {}; try { body = JSON.parse(rq.postData()); } catch (e) {}
      db.patchBodies.push(body);
      if (db.rejectPatch) return ok({ message: db.rejectPatch, code: 'P0001' }, 400);
      const hits = table.filter(r => !r.deleted && Object.keys(eqs).every(k => String(r[k]) === eqs[k])), out = [];
      for (const r of hits) {
        const nr = Number((body[col] || r[col] || {}).rev) || 0, or = Number((r[col] || {}).rev) || 0;
        if (nr <= or) { db.rejected++; return ok({ message: 'stale write rejected', code: 'P0001' }, 400); }
        Object.assign(r, body); ['program', 'private', 'data'].forEach(k => { if (r[k] != null) r[k] = jb(r[k]); });
        r.updated_at = stamp(); out.push({ id: r.id }); db.writes.push({ tbl: pathn, id: r.id, how: 'narrow' });
      }
      if (!hits.length) db.patchMiss++;
      return ok(out);
    }
    if (m === 'POST') {
      let rows = []; try { rows = JSON.parse(rq.postData()); } catch (e) {}
      for (const r of rows) {
        const i = table.findIndex(x => x.id === r.id);
        const nr = Number((r[col] || {}).rev) || 0, or = i > -1 ? (Number((table[i][col] || {}).rev) || 0) : -1;
        if (i > -1 && nr <= or) { db.rejected++; return ok({ message: 'stale write rejected', code: 'P0001' }, 400); }
        const merged = Object.assign({}, i > -1 ? table[i] : { deleted: false }, r);
        ['program', 'private', 'data', 'files', 'meals'].forEach(k => { if (merged[k] != null) merged[k] = jb(merged[k]); });
        merged.updated_at = stamp();
        if (i > -1) table[i] = merged; else table.push(merged);
        db.writes.push({ tbl: pathn, id: r.id, how: 'row' });
      }
      return ok([], 201);
    }
    return ok([]);
  });
}

(async () => {
  if (!chromium) { console.log('דילוג על בדיקות הדפדפן: playwright לא מותקן'); console.log('✓ סנכרון של מה שמחושב: 0 עברו'); process.exit(0); }
  await new Promise(r => srv.listen(0, r));
  let b; try { b = await chromium.launch(); } catch (e) { try { b = await chromium.launch({ channel: 'chrome' }); } catch (e2) { b = null; } }
  if (!b) { console.log('דילוג: אין דפדפן ל-playwright'); srv.close(); process.exit(0); }
  const base = 'http://localhost:' + srv.address().port;
  const db = makeDb(), ORIG = {}; db.trainees.forEach(r => { ORIG[r.id] = JSON.parse(JSON.stringify(r)); });
  const WHEN = new Date('2026-12-03T07:30:00');      // יום חמישי
  const c = await b.newContext({ viewport: { width: 1320, height: 900 }, serviceWorkers: 'block' });
  await c.addInitScript(() => { try { if (!localStorage.getItem('ebfit_admin_token')) localStorage.setItem('ebfit_admin_token', 'tok-admin');
    if (localStorage.getItem('__strip') === '1') {          // מכשיר שהגרסה הקודמת השאירה בלי יעד שבועי
      localStorage.removeItem('__strip');
      const s = JSON.parse(localStorage.getItem('ebfit_v1')); (s.trainees || []).forEach(x => { if (x.program) delete x.program.wplan; }); localStorage.setItem('ebfit_v1', JSON.stringify(s));
      const sn = JSON.parse(localStorage.getItem('ebfit_sync_v1') || '{}'); Object.keys(sn.trainees || {}).forEach(id => { const o = JSON.parse(sn.trainees[id]); if (o.program) delete o.program.wplan; sn.trainees[id] = JSON.stringify(o); });
      localStorage.setItem('ebfit_sync_v1', JSON.stringify(sn));
    }
    if (localStorage.getItem('__nobase') === '1') {          // חלון בגרסה הקודמת שמר את המכשיר בלי _base
      localStorage.removeItem('__nobase');
      const s = JSON.parse(localStorage.getItem('ebfit_v1')); (s.trainees || []).forEach(q => { delete q._base; }); localStorage.setItem('ebfit_v1', JSON.stringify(s));
    }
    if (localStorage.getItem('__stalekcal') === '1') {      // ערכים מחושבים שנשארו במכשיר מהפעלה קודמת
      localStorage.removeItem('__stalekcal');
      const s = JSON.parse(localStorage.getItem('ebfit_v1')); const x = (s.trainees || []).find(q => q.id === 'w1');
      if (x && x.program && x.program.targets) x.program.targets.kcal = 1234; localStorage.setItem('ebfit_v1', JSON.stringify(s));
    }
    /* כל הודעה שהמאמן רואה נרשמת, כדי לוודא שאין "עודכן במכשיר אחר" שקרי */
    window.__toasts = [];
    document.addEventListener('DOMContentLoaded', () => { const t0 = window.toast; window.toast = m => { window.__toasts.push(String(m)); if (t0) t0(m); }; });
  } catch (e) {} });
  const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.clock.install({ time: WHEN });
  await serve(p, db);
  const settle = async () => { for (let i = 0; i < 60; i++) { await p.waitForTimeout(400); const st = await p.evaluate(() => (window.EBSync && EBSync.status().state) || '?'); if (st !== 'sync' && i > 3) break; } await p.waitForTimeout(1200); };
  const open = async () => { await p.goto(base + '/index.html'); await p.waitForFunction(() => window.EBSync && window.EBWPlan && typeof vDash === 'function', null, { timeout: 30000 }); await settle(); await settle(); };
  const runs = async n => { for (let i = 0; i < n; i++) { await p.evaluate(() => EBSync.run()); await settle(); } };
  const row = id => db.trainees.find(r => r.id === id);
  const writes = (id, how) => db.writes.filter(w => w.tbl === 'trainees' && (!id || w.id === id) && (!how || w.how === how)).length;
  const deviceMatches = () => p.evaluate(() => S.trainees.map(x => [x.id, JSON.stringify(x.program || null)])).then(list => list.every(([id, pj]) => canon(JSON.parse(pj)) === canon(row(id).program)));
  const badToasts = () => p.evaluate(() => (window.__toasts || []).filter(m => /במכשיר אחר/.test(m)));
  const weighIn = (id, date, w) => traineeWrite(db, id, r => { r.weighins = r.weighins.concat([{ date, weight: w, at: date + 'T05:20:00+00' }]); });

  console.log('=== מכשיר חדש של המאמן ===');
  await open();
  t('הסנכרון רץ בלי שגיאה', await p.evaluate(() => EBSync.status().state === 'ok' && !EBSync.lastError()), await p.evaluate(() => JSON.stringify(EBSync.status()) + ' ' + EBSync.lastError()));
  t('יעד המשקל השבועי הגיע לשרת: חיטוב ↓, מסה ↑, כוח — בלי', (row('w1').program.wplan || {}).dir === 'down' && (row('w2').program.wplan || {}).dir === 'up' && !row('w3').program.wplan, canon(db.trainees.map(r => r.program.wplan || null)));
  t('עם המדידה של המאמן', canon(row('w2').program.wplan.pts) === '[["2026-11-17",58.4]]');
  t('גם היעדים היומיים והדמות הגיעו', row('w1').program.targets && row('w1').program.targets.kcal > 0 && row('w2').program.fig === 'f' && row('w3').program.fig === 'm');
  t('בכתיבה צרה, לא כשורה שלמה', writes(null, 'narrow') === 3 && writes(null, 'row') === 0, writes(null, 'narrow') + '/' + writes(null, 'row'));
  t('מה שבמכשיר זהה למה שבשרת', await deviceMatches());
  t('שום דבר אחר בשורות לא השתנה', db.trainees.every(r => core(r) === core(ORIG[r.id])) && db.rejected === 0, db.rejected);
  t('מונה הגרסה עלה בדיוק באחד, וגרסת האפליקציה נרשמה', db.trainees.every(r => r.private.rev === 6 && r.private.appVer === 'v291'), canon(db.trainees.map(r => [r.private.rev, r.private.appVer])));
  let n0 = writes();
  await runs(3);
  t('שלושה סנכרונים נוספים לא כותבים כלום (אין לולאה)', writes() === n0, writes() - n0);

  console.log('=== דף המתאמן מקבל את זה ===');
  const tp = await c.newPage(); tp.on('pageerror', e => errs.push('t: ' + e.message));
  await tp.clock.install({ time: WHEN }); await serve(tp, db);
  const expected = WP.fmt(WP.now(row('w1').program.wplan, row('w1').weighins.map(x => ({ date: x.date, w: x.weight })), '2026-12-03').expected);
  await tp.goto(base + '/t.html#tok-w1'); await tp.waitForSelector('.category-tile'); await tp.waitForTimeout(1500);
  const card = await tp.evaluate(() => ((document.querySelector('[data-weigh-card]') || {}).innerText || '').replace(/\s+/g, ' '));
  t('המתאמן רואה ביום חמישי את המשקל שאמור להיות — אותו מספר שחושב מהשרת', /היום יום שקילה/.test(card) && card.indexOf(expected + ' ק״ג') > -1, expected + ' | ' + card);

  console.log('=== המתאמן נשקל, המאמן פותח את האפליקציה ===');
  const kcal0 = row('w1').program.targets.kcal, rev0 = row('w1').private.rev;
  weighIn('w1', '2026-12-03', 81.0);
  n0 = writes();
  await runs(1);
  t('היעד הקלורי חושב מחדש מהמשקל החדש ונשלח לשרת', row('w1').program.targets.kcal !== kcal0 && row('w1').private.rev === rev0 + 1, kcal0 + ' → ' + row('w1').program.targets.kcal);
  t('ורק המתאמן שנשקל נכתב', writes() - n0 === 1, writes() - n0);
  t('מה שבמכשיר זהה למה שבשרת', await deviceMatches());
  n0 = writes(); await runs(2);
  t('ואחר כך שקט', writes() === n0);
  await tp.goto('about:blank'); await tp.goto(base + '/t.html#tok-w1'); await tp.waitForSelector('.category-tile'); await tp.waitForTimeout(1500);
  t('אצל המתאמן: נשקל השבוע, ולכן אין כרטיס במסך הבית', !(await tp.$('[data-weigh-card]')));
  await tp.click('[data-category="follow"]'); await tp.waitForTimeout(500);
  const box = await tp.evaluate(() => { const e = document.querySelector('#categoryModal [data-wp]'); return e ? e.dataset.wp + ' ' + e.innerText.replace(/\s+/g, ' ') : ''; });
  t('ובמעקב: אמור להיות מול בפועל 81.0', /^done /.test(box) && /בפועל 81\.0/.test(box), box);

  console.log('=== המתאמן עורך את התוכנית שלו באותן שניות ===');
  /* נשקל → המכשיר של המאמן מחשב יעד חדש. המתאמן כותב הערה ומוסיף תרגיל רגע לפני שהמאמן כותב */
  weighIn('w1', '2026-12-04', 80.6);
  db.hooks.beforeRead = async () => traineeWrite(db, 'w1', r => { r.program.traineeNote = 'הערה של המתאמן'; r.program.days[0].exercises.push({ name: 'מתח', sets: '3', reps: '6' }); });
  const kcal1 = row('w1').program.targets.kcal;
  await runs(1);
  t('העריכה של המתאמן נשמרה, והיעד החדש נכתב לידה', row('w1').program.traineeNote === 'הערה של המתאמן' && row('w1').program.days[0].exercises.length === 2 && row('w1').program.targets.kcal !== kcal1,
    canon([row('w1').program.traineeNote, row('w1').program.days[0].exercises.length, kcal1, row('w1').program.targets.kcal]));
  weighIn('w1', '2026-12-05', 80.2);
  const miss0 = db.patchMiss, kcal2 = row('w1').program.targets.kcal;
  db.hooks.beforePatch = async () => traineeWrite(db, 'w1', r => { r.program.traineeNote = 'עוד הערה'; });
  await runs(1);
  t('עריכה שנכנסה בין הקריאה לכתיבה: המאמן לא כותב עליה', db.patchMiss === miss0 + 1 && row('w1').program.traineeNote === 'עוד הערה', db.patchMiss - miss0);
  await runs(1);
  t('ובסנכרון הבא היעד נכתב, וההערה עדיין שם', row('w1').program.traineeNote === 'עוד הערה' && row('w1').program.days[0].exercises.length === 2 && row('w1').program.targets.kcal !== kcal2);
  t('מה שבמכשיר זהה למה שבשרת', await deviceMatches());

  console.log('=== המאמן עורך תוכנית בדיוק באמצע סנכרון ===');
  /* חלון התוכנית פתוח (PROGRAM_BASE), ושינוי בתא נוחת אחרי שהדחיפה כבר עברה על המתאמנים */
  await p.evaluate(() => { window.PROGRAM_BASE_ID = 'w2'; window.PROGRAM_BASE = JSON.parse(JSON.stringify(tById('w2').program)); });
  db.hooks.duringPull = async () => p.evaluate(() => { tById('w2').program.days[0].exercises[0].reps = '7'; });
  await runs(1);
  await p.evaluate(() => save());          // השמירה האוטומטית של התא (500ms אחרי השינוי)
  await settle(); await runs(1);
  t('העריכה הגיעה לשרת ונשארה במכשיר', row('w2').program.days[0].exercises[0].reps === '7' && await p.evaluate(() => tById('w2').program.days[0].exercises[0].reps === '7'),
    row('w2').program.days[0].exercises[0].reps);
  weighIn('w2', '2026-12-03', 59.1);
  await p.evaluate(() => { window.__rfs = window.renderFromSync; window.renderFromSync = () => {}; });   // מקליד — הציור נדחה
  await runs(2);
  await p.evaluate(() => { window.renderFromSync = window.__rfs; });
  t('בלי "עודכנה במכשיר אחר" שקרי', !(await badToasts()).length, (await badToasts()).join(' | '));

  console.log('=== עריכה בזמן שמחכים להגדרות מהשרת ===');
  db.hooks.duringPrefs = async () => p.evaluate(() => { tById('w3').phone = '0501112233'; });
  await runs(2);
  t('נשלחה ולא אבדה', row('w3').private.phone === '0501112233' && await p.evaluate(() => tById('w3').phone === '0501112233'), row('w3').private.phone);

  console.log('=== המאמן מוסיף מדידה ===');
  await p.evaluate(() => { S.measures.push({ id: 'mx', traineeId: 'w3', date: '2026-12-02', weight: 89 }); save(); });
  await settle(); await settle();
  t('המדידה והחישוב שנבע ממנה הגיעו לשרת', db.measures.some(m => m.id === 'mx') && await deviceMatches());

  console.log('=== קבצים ישנים או חסרים ===');
  await p.evaluate(() => { window.__mv = EB_MOD.metrics; EB_MOD.metrics = 'v1'; });
  weighIn('w3', '2026-12-03', 88.2);
  n0 = writes(); await runs(2);
  t('מודול חישוב מגרסה אחרת: לא שולחים ערכים מחושבים', writes() === n0, writes() - n0);
  await p.evaluate(() => { EB_MOD.metrics = window.__mv; });
  await runs(2);
  t('וכשהוא בגרסה הנכונה — נשלחים', writes('w3') > 0 && writes() > n0 && await deviceMatches());
  await p.evaluate(() => { window.__cmp = EBMetrics.compute; EBMetrics.compute = () => { throw new Error('boom'); }; save(); });
  await settle(); await settle();
  t('חישוב שנכשל לא מוחק למתאמן את היעדים היומיים', !!(row('w1').program.targets && row('w1').program.targets.kcal > 0));
  await p.evaluate(() => { EBMetrics.compute = window.__cmp; save(); });
  await settle();

  console.log('=== מכשיר שעבר מהגרסה הקודמת ===');
  db.trainees.forEach(r => { delete r.program.wplan; r.updated_at = stamp(); });
  await p.evaluate(() => localStorage.setItem('__strip', '1'));
  n0 = writes();
  await p.goto('about:blank'); await open();
  t('בפתיחה הראשונה היעד השבועי נשלח לכל מי שצריך', (row('w1').program.wplan || {}).dir === 'down' && (row('w2').program.wplan || {}).dir === 'up' && writes() - n0 === 2, writes() - n0);
  n0 = writes(); await runs(2);
  t('ופעם אחת בלבד', writes() === n0);

  console.log('=== מפסק: שני מכשירים שמחשבים אחרת ===');
  /* מכשיר אחר (גרסה אחרת) כותב שוב ושוב קצב משלו לאותו מתאמן, והמכשיר הזה מחשב קצב אחר */
  const other = () => { const r = row('w1'); if (r.program.wplan && r.program.wplan.rate !== 0.9) { r.program = jb(Object.assign({}, r.program, { wplan: Object.assign({}, r.program.wplan, { rate: 0.9 }) })); r.private = jb(Object.assign({}, r.private, { rev: r.private.rev + 1 })); r.updated_at = stamp(); } };
  const per = [];
  for (let i = 0; i < 8; i++) { other(); const k = writes('w1'); await runs(1); per.push(writes('w1') - k); }
  const tot = per.reduce((a, x) => a + x, 0);
  t('המכשיר הזה כותב מעל השני לכל היותר 3 פעמים, ואז מפסיק', tot >= 1 && tot <= 3 && per.slice(-3).every(x => x === 0), per.join(','));
  t('ומה שהמכשיר הזה חישב נשאר אצלו, לא נמחק', await p.evaluate(() => !!(tById('w1').program.wplan && tById('w1').program.wplan.rate !== 0.9)));
  await p.evaluate(() => { tById('w1').name = 'דני בדיקה ש'; save(); });
  await settle(); await settle();
  t('עריכה אמיתית של אותו מתאמן עדיין נשלחת', row('w1').name === 'דני בדיקה ש');
  n0 = writes('w2');
  weighIn('w2', '2026-12-04', 60.5);
  await runs(1);
  t('ושקילה של מתאמנת אחרת עדיין מעדכנת את היעד שלה', writes('w2') === n0 + 1, writes('w2') - n0);
  t('הסנכרון תקין, ואין כתיבה שנדחתה', await p.evaluate(() => EBSync.status().state === 'ok') && db.rejected === 0, db.rejected);
  t('בלי "עודכן במכשיר אחר" שקרי לאורך כל הבדיקה', !(await badToasts()).length, (await badToasts()).join(' | '));

  console.log('=== אין לולאה: חישוב שנכשל למתאמן אחד, ולאורך זמן ===');
  await p.evaluate(() => { window.__cmp2 = EBMetrics.compute; EBMetrics.compute = t => { if (t && t.id === 'w3') throw new Error('boom'); return window.__cmp2(t); }; });
  weighIn('w3', '2026-12-05', 88.0);
  let pulls0 = db.pulls;
  await p.evaluate(() => EBSync.run()); await p.waitForTimeout(8000);
  t('8 שניות: לכל היותר 3 משיכות (לא סנכרון בלי הפסקה)', db.pulls - pulls0 <= 3, db.pulls - pulls0);
  t('והיעדים היומיים שלו בשרת לא נמחקו', !!(row('w3').program.targets && row('w3').program.targets.kcal > 0));
  await p.evaluate(() => { EBMetrics.compute = window.__cmp2; save(); }); await settle(); await settle();

  console.log('=== אין לולאה: השרת דוחה כתיבה שוב ושוב ===');
  db.rejectPatch = 'boom';
  weighIn('w2', '2026-12-05', 60.9);
  const k2 = row('w2').program.targets.kcal;
  pulls0 = db.pulls;
  await p.evaluate(() => EBSync.run()); await p.waitForTimeout(8000);
  t('8 שניות: לכל היותר 3 משיכות', db.pulls - pulls0 <= 3, db.pulls - pulls0);
  t('והסנכרון ממשיך לעבוד', await p.evaluate(() => EBSync.status().state === 'ok'));
  db.rejectPatch = null;
  await p.clock.fastForward('03:00'); await runs(1);
  t('כשהשרת מקבל שוב — הערך נכתב בסנכרון הבא', row('w2').program.targets.kcal !== k2, k2);
  db.rejectPatch = 'גרסה ישנה של האפליקציה במכשיר הזה. השמירה נדחתה';
  weighIn('w2', '2026-12-06', 61.2);
  let pb0 = db.patchBodies.length;
  await runs(1); await p.clock.fastForward('10:00'); await runs(2);
  t('השרת דוחה את הגרסה: מפסיקים לנסות עד הטעינה הבאה', db.patchBodies.length - pb0 === 1, db.patchBodies.length - pb0);
  db.rejectPatch = null;

  console.log('=== מכשיר אחר כתב יעדים, ויש כאן עריכה שעוד לא נשלחה ===');
  await p.goto('about:blank'); await open();                               // טעינה מחדש: הכתיבה חוזרת לפעול
  const otherDerived = id => traineeWrite(db, id, r => { r.program.targets = Object.assign({}, r.program.targets, { kcal: (r.program.targets.kcal || 2000) + 7 }); r.private.rev++; });
  await p.evaluate(() => { tById('w2').phone = '0509998877'; });           // עריכה שעוד לא נשלחה
  otherDerived('w2');
  await runs(2);
  t('העריכה נשלחה ולא נזרקה', row('w2').private.phone === '0509998877' && await p.evaluate(() => tById('w2').phone === '0509998877'), row('w2').private.phone);
  db.hooks.duringPull = async () => { otherDerived('w2'); await p.evaluate(() => { tById('w2').phone = '0507776655'; }); };
  await runs(2);
  t('וגם עריכה שנעשתה באמצע הסנכרון', row('w2').private.phone === '0507776655' && await p.evaluate(() => tById('w2').phone === '0507776655'), row('w2').private.phone);
  t('בלי "עודכנו במכשיר אחר"', !(await badToasts()).length, (await badToasts()).join(' | '));
  t('ומה שבמכשיר זהה למה שבשרת', await deviceMatches());

  console.log('=== ערכים ישנים שנשארו במכשיר מהפעלה קודמת ===');
  await p.evaluate(() => localStorage.setItem('__stalekcal', '1'));
  pb0 = db.patchBodies.length;
  await p.goto('about:blank'); await open();
  t('לא נשלחים לשרת', db.patchBodies.slice(pb0).every(x => !(x.program && x.program.targets && x.program.targets.kcal === 1234)) && row('w1').program.targets.kcal !== 1234);
  t('והמכשיר מתיישר לפי השרת', await p.evaluate(() => tById('w1').program.targets.kcal !== 1234) && await deviceMatches());

  console.log('=== שליחה של שורה שלמה לא מפעילה את המפסק בטעות ===');
  await p.evaluate(() => { tById('w1').height = 179; save(); }); await settle(); await settle();
  const w1n = writes('w1', 'narrow');
  for (const [d, w] of [['2026-12-06', 80.0], ['2026-12-07', 79.8], ['2026-12-08', 79.5], ['2026-12-09', 79.3]]) { weighIn('w1', d, w); await runs(1); }
  t('ארבע שקילות אחרי שינוי גובה — ארבעה עדכוני יעד', writes('w1', 'narrow') - w1n === 4, writes('w1', 'narrow') - w1n);
  t('מה שבמכשיר זהה למה שבשרת', await deviceMatches());

  console.log('=== שני חלונות של האפליקציה באותו מחשב ===');
  /* התצלום משותף לשני החלונות; כל אחד צריך לדעת על מה השורה שלו מבוססת */
  const p2 = await c.newPage(); p2.on('pageerror', e => errs.push('p2: ' + e.message));
  await p2.clock.install({ time: new Date(await p.evaluate(() => Date.now())) });
  await serve(p2, db);
  const settle2 = async () => { for (let i = 0; i < 60; i++) { await p2.waitForTimeout(400); const st = await p2.evaluate(() => (window.EBSync && EBSync.status().state) || '?'); if (st !== 'sync' && i > 3) break; } await p2.waitForTimeout(1200); };
  await p2.goto(base + '/index.html'); await p2.waitForFunction(() => window.EBSync && window.EBWPlan && typeof vDash === 'function', null, { timeout: 30000 }); await settle2(); await settle2();
  await runs(1);
  weighIn('w1', '2026-12-10', 79.0);
  await runs(1);                                                            // חלון א׳ כותב יעד חדש
  const kA = row('w1').program.targets.kcal;
  await p2.evaluate(() => { tById('w1').phone = '0501231234'; });          // חלון ב׳, שלא ראה אותו, עורך
  await p2.evaluate(() => EBSync.run()); await settle2(); await settle2();
  t('עריכה בחלון שלא ראה את היעד החדש נשמרת', row('w1').private.phone === '0501231234' && await p2.evaluate(() => tById('w1').phone === '0501231234'), row('w1').private.phone);
  t('והיעד שחלון א׳ כתב לא נדרס', row('w1').program.targets.kcal === kA, kA + ' → ' + row('w1').program.targets.kcal);
  t('בלי "עודכנו במכשיר אחר" בחלון ב׳', !(await p2.evaluate(() => (window.__toasts || []).filter(m => /במכשיר אחר/.test(m)))).length);
  traineeWrite(db, 'w3', r => { r.program.days[0].exercises.push({ name: 'דדליפט', sets: '3', reps: '5' }); });   // המתאמן מוסיף תרגיל
  await runs(1);                                                            // חלון א׳ רואה אותו
  otherDerived('w3');                                                       // מכשיר אחר כותב יעדים
  await p2.evaluate(() => { tById('w3').phone = '0504445566'; });          // חלון ב׳, שלא ראה את התרגיל, עורך
  await p2.evaluate(() => EBSync.run()); await settle2(); await settle2();
  t('עריכה בחלון שלא ראה תרגיל שהמתאמן הוסיף — לא מוחקת את התרגיל', row('w3').program.days[0].exercises.length === 2, row('w3').program.days[0].exercises.length);

  console.log('=== עריכה שנשמרה במכשיר, והאפליקציה נסגרה לפני הסנכרון ===');
  await p2.close();
  await p.evaluate(() => { tById('w2').phone = '0502223344'; window.rawSave(); });   // נשמר במכשיר, לא נשלח
  otherDerived('w2');                                                               // בינתיים מכשיר אחר כתב יעדים
  await p.goto('about:blank'); await open();
  t('בפתיחה הבאה העריכה נשלחת ולא נזרקת', row('w2').private.phone === '0502223344' && await p.evaluate(() => tById('w2').phone === '0502223344'), row('w2').private.phone);
  t('בלי "עודכנו במכשיר אחר"', !(await badToasts()).length, (await badToasts()).join(' | '));

  console.log('=== הדחיפה הצליחה והמשיכה נכשלה ===');
  db.failPull = 1;
  await p.evaluate(() => { tById('w2').phone = '0503334455'; save(); });
  await settle(); await settle();
  t('העריכה הראשונה בשרת', row('w2').private.phone === '0503334455');
  otherDerived('w2');                                                               // ומכשיר אחר כתב יעדים
  await p.clock.fastForward('01:30');
  await p.evaluate(() => { tById('w2').phone = '0504445566'; save(); });
  await settle(); await settle(); await runs(1);
  t('והעריכה הבאה לא נזרקת כ"ישנה"', row('w2').private.phone === '0504445566' && await p.evaluate(() => tById('w2').phone === '0504445566'), row('w2').private.phone);
  t('בלי "עודכנו במכשיר אחר"', !(await badToasts()).length, (await badToasts()).join(' | '));
  t('ובסוף הכול מסונכרן', await p.evaluate(() => EBSync.status().state === 'ok') && await deviceMatches());

  console.log('=== חלון מהגרסה הקודמת שמר את המכשיר בלי החתימה ===');
  await p.evaluate(() => localStorage.setItem('__nobase', '1'));
  const rows0 = writes(null, 'row');
  await p.goto('about:blank'); await open();
  t('אף מתאמן לא נשלח כשורה שלמה בגלל זה', writes(null, 'row') === rows0, writes(null, 'row') - rows0);
  t('והחתימה חזרה לכל השורות', await p.evaluate(() => S.trainees.every(x => !!x._base)));

  t('בלי שגיאות בדפים', !errs.length, errs.join(' | '));
  await b.close(); srv.close();
  console.log((fail ? '✗' : '✓') + ' סנכרון של מה שמחושב: ' + pass + ' עברו' + (fail ? ', ' + fail + ' נכשלו' : ''));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  שגיאה בלתי צפויה: ' + (e && e.stack || e)); process.exit(1); });

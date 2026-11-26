/* משוב מהמאמן על אימון (נובמבר 2026).
   עד עכשיו מתאמן שלח אימון ולא קיבל שום דבר בחזרה בתוך האפליקציה.
   א. שכבת הסנכרון של המאמן (sync.js, הקוד האמיתי ב-node):
      שרת שעוד לא עודכן — הלוח ממשיך לעבוד בלי כפתור התגובה;
      שרת מעודכן — העמודות נשלפות, והתגובה נשלחת ב-coach_log_reply.
   ב. המאמן (index.html): כפתור "תגובה" בפיד ובתיק, חלון, שליחה, "נקרא".
   ג. המתאמן (t.html): כרטיס בראש מסך הבית, "קראתי" (גם בלי רשת),
      התגובה ביומן, "לכתוב למאמן" בווטסאפ, ונגיעה בהתראה (?go=coach). */
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');

let pass = 0, fail = 0;
const t = (n, ok, i) => { ok ? pass++ : fail++; console.log((ok ? '✓ ' : '✗ ') + n + (ok ? '' : '  → ' + i)); };

/* ================= א. sync.js ================= */
async function syncUnit() {
  console.log('=== שכבת הסנכרון של המאמן ===');
  const store = { ebfit_admin_token: 'admintok' };
  const quiet = { log() {}, error() {}, warn() {} };
  const state = { mode: 'old', selects: [], rpcs: [] };
  const ROWS = [{ id: 'l1', trainee_id: 'a', date: '2026-11-24', day_name: 'יום A', entries: [], feel: null, note: null, created_at: '2026-11-24T10:00:00Z' }];
  const fakeSb = {
    rpc(fn, args) {
      state.rpcs.push([fn, args]);
      if (fn === 'admin_session') return Promise.resolve({ data: [{ admin_id: 'u1', email: 'coach@example.com' }], error: null });
      if (fn === 'coach_log_reply') {
        if (state.mode === 'old') return Promise.resolve({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.coach_log_reply' } });
        if (state.mode === 'deny') return Promise.resolve({ data: null, error: { code: 'P0001', message: 'not your trainee' } });
        return Promise.resolve({ data: { ok: true, at: '2026-11-26T10:00:00Z' }, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    },
    from(table) {
      let cols = '*';
      const res = () => {
        if (table !== 'workout_logs') return { data: [], error: null };
        state.selects.push(cols);
        if (state.mode === 'down') return { data: null, error: { code: '', message: 'TypeError: Failed to fetch' } };
        const wantsFb = /coach_note/.test(cols);
        if (state.mode === 'old') return wantsFb ? { data: null, error: { code: '42703', message: 'column workout_logs.coach_note does not exist' } } : { data: ROWS, error: null };
        return { data: ROWS.map(r => Object.assign({ coach_note: 'יפה', coach_note_at: '2026-11-25T08:00:00Z', coach_seen_at: null }, r)), error: null };
      };
      const o = { select(c) { cols = c || '*'; return o; }, eq() { return o; }, gte() { return o; }, order() { return o; },
                  limit() { return Promise.resolve(res()); }, then(f, g) { return Promise.resolve(res()).then(f, g); } };
      return o;
    }
  };
  const win = { console: quiet, addEventListener() {}, EBFIT_CONFIG: { URL: 'https://x.supabase.co', ANON: 'k' }, S: { trainees: [] } };
  const doc = { addEventListener() {}, hidden: true, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] };
  const ls = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  const timers = { setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {} };
  let now = 1e12;
  const FakeDate = class extends Date { static now() { return now; } };
  new Function('window', 'document', 'localStorage', 'navigator', 'supabase', 'console', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date',
    fs.readFileSync(path.join(ROOT, 'sync.js'), 'utf8'))(win, doc, ls, { onLine: true }, { createClient: () => fakeSb }, quiet,
    timers.setTimeout, timers.clearTimeout, timers.setInterval, timers.clearInterval, FakeDate);
  const S = win.EBSync;
  S.init(); await new Promise(r => setImmediate(r)); await new Promise(r => setImmediate(r));
  t('המאמן מזוהה (הבדיקה רצה על הקוד האמיתי)', !!(S.user() && S.user().id === 'u1'));

  /* שרת ישן */
  state.selects = [];
  let rows = await S.recentLogs(14);
  t('שרת שעוד לא עודכן: הלוח עדיין מקבל את הדיווחים', Array.isArray(rows) && rows.length === 1 && rows[0].id === 'l1', JSON.stringify(rows));
  t('ניסיון אחד עם העמודות החדשות, ואז חזרה לישנות', state.selects.length === 2 && /coach_note/.test(state.selects[0]) && !/coach_note/.test(state.selects[1]), JSON.stringify(state.selects));
  t('כפתור התגובה כבוי', S.feedbackOn() === false);
  state.selects = []; rows = await S.recentLogs(14);
  t('בחמש הדקות הבאות לא מנסים שוב את העמודות החסרות', state.selects.length === 1 && !/coach_note/.test(state.selects[0]) && rows.length === 1, JSON.stringify(state.selects));
  let err = ''; try { await S.replyLog('l1', 'שלום'); } catch (e) { err = e.message; }
  t('תגובה מול שרת ישן: הודעה ברורה, לא שגיאה גולמית', /עוד לא הופעלו/.test(err), err);

  /* השרת עודכן בינתיים */
  state.mode = 'new'; now += 6 * 60 * 1000; state.selects = [];
  rows = await S.recentLogs(14);
  t('אחרי חמש דקות בודקים שוב — והשרת כבר מעודכן', rows.length === 1 && rows[0].coach_note === 'יפה' && S.feedbackOn() === true && state.selects.length === 1, JSON.stringify(state.selects));
  state.rpcs = [];
  const r = await S.replyLog('l1', 'כל הכבוד');
  const call = state.rpcs.find(x => x[0] === 'coach_log_reply');
  t('התגובה נשלחת עם מזהה הדיווח והטקסט', r && r.ok === true && call && call[1].p_log_id === 'l1' && call[1].p_note === 'כל הכבוד', JSON.stringify(call));
  state.mode = 'deny'; err = ''; try { await S.replyLog('zz', 'x'); } catch (e) { err = e.message; }
  t('דיווח של מתאמן אחר: נדחה עם הסבר', /אין הרשאה/.test(err), err);

  /* תקלת רשת לא מכבה את התגובות */
  state.mode = 'down'; state.selects = [];
  rows = await S.recentLogs(14);
  t('תקלת רשת: אין דיווחים, אבל התגובות לא נחשבות חסרות', rows === null && S.feedbackOn() === true && state.selects.length === 1);
  state.mode = 'new';
  rows = await S.logsFor('a', 20);
  t('גם בתיק המתאמן העמודות מגיעות', rows.length === 1 && rows[0].coach_note === 'יפה' && S.feedbackOn() === true);
}

/* ================= דפדפן ================= */
let chromium;
try { ({ chromium } = require(ROOT + '/node_modules/playwright')); } catch (e) { chromium = null; }
const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.json': 'application/json', '.css': 'text/css' };
const srv = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0].split('#')[0]));
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });

const TOK = 'tok-coach-x';
const D = { name: 'דני בדיקה', goal: 'כוח', health: { signedAt: '2026-08-01', answers: {} }, trainer_name: 'אראל באואר',
  program: { days: [{ name: 'רגליים וגב', exercises: [{ name: 'סקוואט', sets: '3', reps: '6-8', weight: '80' }] },
                    { name: 'חזה וכתפיים', exercises: [{ name: 'לחיצת חזה', sets: '3', reps: '8' }] }] },
  meals: [], meals_self: [], exercises_self: [], files: [] };
const REPLY = 'ראיתי. באימון הבא יורדים 5 ק״ג בלחיצה.';

async function coachUI(b) {
  console.log('=== המאמן: תגובה מלוח הבקרה ומהתיק ===');
  const c = await b.newContext({ viewport: { width: 1320, height: 900 }, serviceWorkers: 'block' });
  const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await p.goto('http://localhost:' + srv.address().port + '/index.html');
  await p.waitForFunction(() => typeof vDash === 'function' && window.EBSync && typeof openModal === 'function', null, { timeout: 30000 });
  const setup = on => p.evaluate(on => {
    const iso = b => { const d = new Date(); d.setDate(d.getDate() - b); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
    window.__logs = [
      { id: 'l1', trainee_id: 'a', date: iso(1), day_name: 'חזה וכתפיים', feel: 'קשה', note: 'הכתף הימנית קצת הציקה', created_at: iso(1) + 'T18:00:00+00:00',
        entries: [{ ex: 'לחיצת חזה', done: true, weight: 60, reps: 8 }], coach_note: null, coach_note_at: null, coach_seen_at: null },
      { id: 'l2', trainee_id: 'a', date: iso(3), day_name: 'רגליים וגב', feel: null, note: '', created_at: iso(3) + 'T18:00:00+00:00',
        entries: [{ ex: 'סקוואט', done: true, weight: 80, reps: 6 }], coach_note: null, coach_note_at: null, coach_seen_at: null }];
    window.__sent = [];
    EBSync.enabled = () => true; EBSync.schedule = () => {}; EBSync.user = () => ({ email: 'test@example.com' });
    EBSync.adminState = () => 'allowed'; window.EB_AUTH_READY = true; window.save = () => {};
    EBSync.feedbackOn = () => on;
    EBSync.recentLogs = async () => window.__logs; EBSync.logsFor = async () => window.__logs;
    EBSync.replyLog = async (id, note) => { window.__sent.push([id, note]); return { ok: true }; };
    S.trainees = [{ id: 'a', name: 'דנה בדיקה', status: 'active', gender: 'נקבה', program: { days: [] }, meals: [], weighins: [] }];
    DASH.at = 0; DASH.logs = null; Object.keys(TLOGS).forEach(k => delete TLOGS[k]);
    go('dash');
  }, on);
  const feed = () => p.evaluate(() => (document.querySelector('.dash-feed') || {}).innerText || '');

  await setup(false); await p.waitForTimeout(500);
  t('שרת בלי תגובות: הפיד מוצג, בלי כפתור', /דנה בדיקה/.test(await feed()) && (await p.$$('.dash-feed .ev-rep')).length === 0, await feed());

  await setup(true); await p.waitForTimeout(500);
  t('כפתור "תגובה" על כל אימון בפיד', (await p.$$('.dash-feed .ev-rep')).length === 2, String((await p.$$('.dash-feed .ev-rep')).length));
  await p.click('.dash-feed .ev-rep >> nth=0'); await p.waitForTimeout(300);
  const modal = () => p.evaluate(() => { const h = document.querySelector('.mh h3'); return h ? h.closest('div').parentElement.innerText : ''; });
  t('נפתח חלון עם שם המתאמנת, האימון וההערה שלה (ולא התיק)', /תגובה על האימון/.test(await modal()) && /דנה בדיקה/.test(await modal()) && /חזה וכתפיים/.test(await modal()) && /הכתף הימנית/.test(await modal())
    && await p.evaluate(() => VIEW === 'dash'), await modal());
  await p.click('#lr_go'); await p.waitForTimeout(200);
  t('בלי טקסט — לא נשלח', await p.evaluate(() => window.__sent.length === 0));
  await p.click('.lr-quick button >> nth=0'); await p.waitForTimeout(100);
  await p.type('#lr_t', ' המשך כך'); await p.waitForTimeout(100);
  const txt = await p.$eval('#lr_t', x => x.value);
  t('תשובה מוכנה נכנסת לשדה ואפשר להמשיך לכתוב', /^אימון מצוין, כל הכבוד המשך כך$/.test(txt), txt);
  await p.click('#lr_go'); await p.waitForTimeout(400);
  const sent = await p.evaluate(() => window.__sent);
  t('נשלח לשרת עם מזהה הדיווח', sent.length === 1 && sent[0][0] === 'l1' && sent[0][1] === txt, JSON.stringify(sent));
  t('הפיד מציג את התגובה ו"עוד לא נקרא"', /ענית/.test(await feed()) && /אימון מצוין/.test(await feed()) && /עוד לא נקרא/.test(await feed()) && (await p.$$('.dash-feed .ev-rep')).length === 1, await feed());
  await p.evaluate(() => { window.__logs[0].coach_seen_at = new Date().toISOString(); render(); }); await p.waitForTimeout(200);
  t('אחרי שהמתאמנת קראה — "נקרא"', await p.evaluate(() => { const i = document.querySelector('.dash-feed .ev-reply i'); return !!i && i.textContent === 'נקרא' && i.classList.contains('seen'); }));
  await p.click('.dash-feed .ev-reply'); await p.waitForTimeout(300);
  t('נגיעה בתגובה פותחת אותה לעריכה, עם מחיקה', await p.$eval('#lr_t', x => x.value) === txt && /מחיקת התגובה/.test(await modal()));
  await p.click('text=מחיקת התגובה'); await p.waitForTimeout(400);
  const sent2 = await p.evaluate(() => window.__sent);
  t('מחיקה שולחת טקסט ריק, והכפתור חוזר', sent2.length === 2 && sent2[1][0] === 'l1' && sent2[1][1] === '' && (await p.$$('.dash-feed .ev-rep')).length === 2, JSON.stringify(sent2));

  await p.evaluate(() => { VIEW = 'trainee'; ARG = 'a'; SUBTAB = 'history'; render(); }); await p.waitForTimeout(600);
  await p.evaluate(() => render()); await p.waitForTimeout(200);
  t('גם בתיק המתאמנת: תגובה על כל דיווח', (await p.$$('details .ev-rep')).length === 2, String((await p.$$('details .ev-rep')).length));
  await p.evaluate(() => { const d = document.querySelector('details'); d.open = true; d.querySelector('.ev-rep').click(); }); await p.waitForTimeout(300);
  t('והחלון נפתח גם משם', /תגובה על האימון/.test(await modal()));
  t('בלי שגיאות בדף המאמן', !errs.length, errs.join(' | '));
  await c.close();
}

async function traineeUI(b) {
  console.log('=== המתאמן: התגובה במסך הבית וביומן ===');
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await c.addInitScript(() => { window.__shared = null; navigator.share = async d => { window.__shared = d; }; navigator.canShare = () => true; });
  const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.clock.install({ time: new Date('2026-11-26T10:00:00') });
  /* השרת המדומה */
  const S = { mode: 'old', seenCalls: 0, seenFails: false, coach: { name: 'אראל באואר', phone: '054-123-4567', business: 'BAUER POWER' },
    logs: [
      { id: 'a1', date: '2026-11-20', dayName: 'רגליים וגב', feel: 'טוב', note: null, coach: null, coachAt: null, coachSeen: false, entries: [{ ex: 'סקוואט', done: true, weight: 80, reps: 6 }] },
      { id: 'a2', date: '2026-11-24', dayName: 'חזה וכתפיים', feel: 'קשה', note: 'הכתף הימנית קצת הציקה', coach: REPLY, coachAt: '2026-11-25T08:10:00+00:00', coachSeen: false, entries: [{ ex: 'לחיצת חזה', done: true, weight: 60, reps: 8 }] }] };
  await p.route(/supabase\.co/, rt => {
    const fn = (rt.request().url().split('/rpc/')[1] || '').split('?')[0]; let body = 'null';
    if (fn === 'trainee_program') body = JSON.stringify([D]);
    if (fn === 'trainee_extras') {
      const logs = S.mode === 'old' ? S.logs.map(l => ({ date: l.date, dayName: l.dayName, entries: l.entries, feel: l.feel })) : S.logs;
      body = JSON.stringify([{ logs, weighins: [], session_state: { terms: { at: '2026-10-01T10:00:00.000Z', version: '3' } } }]);
    }
    if (fn === 'trainee_coach') {
      if (S.mode === 'old') return rt.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST202', message: 'Could not find the function public.trainee_coach(p_token) in the schema cache' }) });
      body = JSON.stringify(S.coach);
    }
    if (fn === 'trainee_feedback_seen') {
      if (S.seenFails) return rt.abort('internetdisconnected');
      S.seenCalls++; S.logs.forEach(l => { if (l.coach) l.coachSeen = true; }); body = '1';
    }
    if (fn === 'trainee_save_state') body = 'true';
    rt.fulfill({ status: 200, contentType: 'application/json', body });
  });
  const url = 'http://localhost:' + srv.address().port + '/t.html';
  const load = async (q) => { await p.goto('about:blank'); await p.goto(url + (q || '') + '#' + TOK); await p.waitForSelector('.category-tile'); await p.waitForTimeout(1500); };
  const txt = sel => p.evaluate(sel => (document.querySelector(sel) || {}).innerText || '', sel);
  const closeCat = async () => { await p.evaluate(() => { const x = document.querySelector('[data-category-close]'); if (x) x.click(); }); await p.waitForTimeout(300); };

  await load();
  t('שרת שעוד לא עודכן: אין כרטיס תגובה ואין ווטסאפ למאמן', !(await p.$('[data-fb]')) && !(await p.$('[data-coach-wa]')));
  t('"להמליץ לחבר" קיים גם אז', !!(await p.$('[data-friend]')));
  await p.tap('[data-friend]'); await p.waitForTimeout(200);
  let sh = await p.evaluate(() => window.__shared && window.__shared.text);
  t('בלי טלפון של המאמן — ההמלצה מפנה לדף הפרטים', !!sh && /BAUER POWER/.test(sh) && /promo-trainees\.html/.test(sh) && !/wa\.me/.test(sh), sh);

  S.mode = 'new'; await load();
  const card = await txt('[data-fb]');
  t('כרטיס בראש מסך הבית: ממי, על איזה אימון, והטקסט', /תגובה מאראל/.test(card) && /חזה וכתפיים/.test(card) && /24 בנובמבר/.test(card) && card.includes(REPLY), card);
  t('הכרטיס מעל האריחים', await p.evaluate(() => document.querySelector('[data-fb]').getBoundingClientRect().top < document.querySelector('.category-tile').getBoundingClientRect().top));
  const wa = await p.$eval('[data-fb-wa]', a => a.href);
  t('"להשיב בווטסאפ" פותח שיחה עם המאמן, בקידומת בינלאומית', /^https:\/\/wa\.me\/972541234567\?text=/.test(wa) && /היי אראל/.test(decodeURIComponent(wa)) && /חזה וכתפיים/.test(decodeURIComponent(wa)), wa);
  const cw = await p.$eval('[data-coach-wa]', a => a.href + ' | ' + a.innerText);
  t('בתחתית: "לכתוב לאראל" בווטסאפ', /wa\.me\/972541234567/.test(cw) && /לכתוב לאראל/.test(cw), cw);
  await p.tap('[data-friend]'); await p.waitForTimeout(200);
  sh = await p.evaluate(() => window.__shared && window.__shared.text);
  t('ההמלצה לחבר: קישור ווטסאפ למאמן, עם שם הממליץ בהודעה', !!sh && /אראל מ-BAUER POWER/.test(sh) && /https:\/\/wa\.me\/972541234567\?text=/.test(sh) && /מדני/.test(decodeURIComponent(sh)), sh);

  await p.tap('[data-fb-open]'); await p.waitForTimeout(600);
  t('"לאימון ביומן" פותח את היום של האימון', await p.evaluate(() => (document.querySelector('.cal-g button.sel') || {}).dataset.cal) === '2026-11-24');
  const day = await txt('.wl-done');
  t('ביומן: מה שכתבתי, והתגובה עם שם המאמן', /כתבת למאמן/.test(day) && /הכתף הימנית/.test(day) && /אראל/.test(await txt('.wl-done-c')) && (await txt('.wl-done-c')).includes(REPLY), day);
  await closeCat();
  t('פתיחת האימון נחשבת קריאה: הכרטיס ירד והשרת יודע', !(await p.$('[data-fb]')) && S.seenCalls === 1, String(S.seenCalls));
  await load();
  t('אחרי פתיחה מחדש הכרטיס לא חוזר', !(await p.$('[data-fb]')) && S.seenCalls === 1);

  console.log('=== "קראתי" בלי רשת ===');
  S.logs[0].coach = 'אימון חזק. בשבוע הבא 82.5.'; S.logs[0].coachAt = '2026-11-26T07:00:00+00:00'; S.logs[0].coachSeen = false; S.logs[0].id = 'a1';
  await load();
  t('תגובה חדשה על אימון אחר מופיעה', /82\.5/.test(await txt('[data-fb]')) && /רגליים וגב/.test(await txt('[data-fb]')));
  S.seenFails = true;
  await p.tap('[data-fb-seen]'); await p.waitForTimeout(500);
  const kept = await p.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('ebfit_fbseen_tok-coach-x') || '{}')));
  t('הכרטיס יורד מיד, והסימון נשמר במכשיר', !(await p.$('[data-fb]')) && kept.length === 1 && /^a1\|/.test(kept[0]), JSON.stringify(kept));
  S.seenFails = false; const before = S.seenCalls;
  await load();
  t('בפתיחה הבאה: לא מוצג שוב, והשרת מקבל את "נקרא"', !(await p.$('[data-fb]')) && S.seenCalls === before + 1 && S.logs[0].coachSeen === true, S.seenCalls + '/' + before);
  t('והסימון המקומי נוקה', await p.evaluate(() => !localStorage.getItem('ebfit_fbseen_tok-coach-x')));

  console.log('=== המאמן ערך את התגובה ===');
  S.logs[0].coach = 'תיקון: 85 ולא 82.5.'; S.logs[0].coachAt = '2026-11-26T09:00:00+00:00'; S.logs[0].coachSeen = false;
  await load();
  t('תגובה שנערכה מוצגת שוב', /תיקון: 85/.test(await txt('[data-fb]')));

  console.log('=== נגיעה בהתראה ===');
  await load('?go=coach');
  t('הדף נפתח על כרטיס התגובה, והכתובת נוקתה', await p.evaluate(() => { const r = document.querySelector('[data-fb]').getBoundingClientRect(); return r.top >= 0 && r.top < innerHeight && !location.search; }));
  await p.tap('[data-fb-seen]'); await p.waitForTimeout(400);
  await load('?go=coach');
  t('כשהכול כבר נקרא — נפתח היומן על האימון שהמאמן הגיב עליו', await p.evaluate(() => (document.querySelector('.cal-g button.sel') || {}).dataset.cal) === '2026-11-20' && /תיקון: 85/.test(await txt('.wl-done-c')));

  t('בלי שגיאות בדף המתאמן', !errs.length, errs.join(' | '));
  await c.close();
}

(async () => {
  await syncUnit();
  if (!chromium) { console.log('דילוג על בדיקות הדפדפן: playwright לא מותקן'); }
  else {
    await new Promise(r => srv.listen(0, r));
    let b; try { b = await chromium.launch(); } catch (e) { try { b = await chromium.launch({ channel: 'chrome' }); } catch (e2) { b = null; console.log('דילוג: אין דפדפן ל-playwright'); } }
    if (b) { await coachUI(b); await traineeUI(b); await b.close(); }
    srv.close();
  }
  console.log((fail ? '✗' : '✓') + ' משוב מהמאמן: ' + pass + ' עברו' + (fail ? ', ' + fail + ' נכשלו' : ''));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  שגיאה בלתי צפויה: ' + (e && e.stack || e)); process.exit(1); });

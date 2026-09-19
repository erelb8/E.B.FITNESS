/* =====================================================================
   E.B FIT — שכבת סנכרון
   ---------------------------------------------------------------------
   עקרון: המכשיר קודם. האפליקציה ממשיכה לעבוד מלא בלי רשת —
   כל הכתיבות נשמרות ב-localStorage כרגיל, והסנכרון רץ ברקע כשיש חיבור.

   איך מזוהה מה השתנה:
   שומרים תצלום (snapshot) של המצב אחרי כל סנכרון מוצלח. בסנכרון הבא
   משווים את המצב הנוכחי לתצלום — ההפרש הוא בדיוק מה שהשתנה במכשיר.
   דוחפים אותו, ואז מושכים את האמת מהשרת.

   התנגשות בין שני מכשירים: הכתיבה האחרונה מנצחת.
   ===================================================================== */
(function () {
  'use strict';

  // חותמת גרסה — index.html משווה אליה כדי לזהות קובץ ישן במטמון
  (window.EB_MOD = window.EB_MOD || {})['sync'] = 'v177';

  const CFG      = window.EBFIT_CONFIG || { URL: '', ANON: '' };
  const SNAP_KEY = 'ebfit_sync_v1';
  const ARRAYS   = ['trainees', 'sessions', 'measures', 'payments', 'daily'];
  /* daily יושב באותה טבלה כמו measures ומסומן ב-kind, כדי לא לחייב
     טבלה חדשה בשרת. במשיכה מפרידים בחזרה לפי הסימון. */
  const TABLE    = { trainees:'trainees', sessions:'sessions', measures:'measures',
                     payments:'payments', daily:'measures' };

  let sb = null;                 // לקוח Supabase
  let user = null;               // המאמן המחובר
  let adminState = 'unknown';    // unknown / allowed / denied
  let adminToken = '';
  let timer = null;              // דיבאונס
  let pending = false;           // יש שינוי שעוד לא נשלח
  let running = false;
  let lastError = null;
  let failCount = 0;             // נכשלות ברצף — ממתינים לפני ניסיון נוסף
  let resolveAuthReady;
  const authReady = new Promise(resolve => { resolveAuthReady = resolve; });

  const DEBUG = true;
  function log() {
    if (DEBUG && window.console) console.log.apply(console, ['[EBSync]'].concat([].slice.call(arguments)));
  }
  function logError() {
    if (!DEBUG || !window.console) return;
    const args = [].slice.call(arguments).map(value => {
      if (!value || typeof value !== 'object') return value;
      return { code: value.code, message: value.message, details: value.details, hint: value.hint };
    });
    console.error.apply(console, ['[EBSync]'].concat(args));
  }

  const enabled = () => !!(CFG.URL && CFG.ANON);

  async function checkAdmin() {
    if (!sb || !adminToken) { adminState = 'denied'; return false; }
    const { data, error } = await sb.rpc('admin_session');
    if (error) {
      adminState = 'unknown';
      logError('admin check failed', error);
      throw error;
    }
    user = data && data[0] ? { id: data[0].admin_id, email: data[0].email } : null;
    adminState = user ? 'allowed' : 'denied';
    if (!user) adminToken = '';
    log('database admin check', { allowed: adminState === 'allowed', userId: user && user.id });
    return adminState === 'allowed';
  }

  /* ---------- המרה בין מבנה האפליקציה למבנה השרת ---------- */
  // מתאמן: name/goal/program משותפים עם המתאמן, כל השאר ב-private.
  /* mealsSelf, health ו-weighins נקראים מהשרת ולעולם לא נדחפים אליו —
     המתאמן כותב אותם דרך RPC משלו, ודחיפה מכאן הייתה מוחקת
     את ההצהרה ואת השקילות שהוא הזין. */
  /* termsAccepted נקרא מ-session_state ושייך לאותה משפחה: נקרא מהשרת
     ולעולם לא נדחף אליו. בלי שהוא ברשימה הזאת הוא נפל ל-private,
     כלומר נכתב חזרה כעותק שני של אישור שהמתאמן נתן — מקור אמת כפול
     לרשומה משפטית. */
  const SHARED = ['id', 'name', 'goal', 'program', 'status', 'files', 'meals', 'mealsSelf',
                  'mealsCustom', 'habitsLog', 'foodLog', 'exercisesSelf', 'health', 'weighins', 'termsAccepted'];

  function traineeToRow(t) {
    const priv = {};
    for (const k in t) {
      if (SHARED.includes(k)) continue;
      if (k.charAt(0) === '_') continue;   // שדות שרת (_token, _username...) — לא נשמרים ב-private
      priv[k] = t[k];
    }
    return {
      id: t.id,
      trainer_id: user.id,
      name: t.name || '',
      goal: t.goal || null,
      program: t.program || { days: [] },
      files: t.files || [],
      meals: t.meals || [],
      status: t.status || 'active',
      private: priv
      /* deleted לא נשלח, ובכוונה. הוא היה נשלח כ-false בכל דחיפה,
         ולכן מכשיר עם עותק ישן החזיר לחיים כל מה שנמחק במכשיר אחר:
         המחיקות לא התפשטו — הן בוטלו. זה מה שהחזיר את הכפילויות
         שוב ושוב אחרי שנמחקו.

         בעמודה יש default false, ולכן רשומה חדשה נוצרת פעילה כרגיל,
         ורשומה שנמחקה נשארת מחוקה עד שמישהו יחזיר אותה במפורש. */
    };
  }
  function traineeFromRow(r) {
    return Object.assign({}, r.private || {}, {
      id: r.id,
      name: r.name,
      goal: r.goal,
      program: r.program || { days: [] },
      files: r.files || [],
      meals: r.meals || [],
      mealsSelf: r.meals_self || [],
      exercisesSelf: r.exercises_self || [],
      health: r.health || null,
      /* אישור התקנון יושב ב-session_state, אותו בלוב שהמתאמן כותב
         דרך trainee_save_state. הוא נקרא לכאן ולעולם לא נדחף חזרה:
         traineeToRow אינו כולל את העמודה, ולכן שמירה של המאמן
         משאירה אותה — כמו health ו-weighins. */
      termsAccepted: (r.session_state || {}).terms || null,
      // ארוחות שהמתאמן בנה בעצמו בדף שלו — לקריאה בלבד, כמו termsAccepted
      mealsCustom: (r.session_state || {}).myMeals || [],
      // סימוני "אכלתי" וההרגלים שהמתאמן סימן בדף שלו — לקריאה בלבד
      habitsLog: (r.session_state || {}).habits || null,
      foodLog: (r.session_state || {}).foodLog || null,   // "אכלתי משהו שלא בתפריט"
      weighins: r.weighins || [],
      status: r.status,
      _token: r.access_token,
      _tokenActive: r.access_active,
      _username: r.username || ''
    });
  }

  function childToRow(o) {
    const data = {};
    for (const k in o) {
      if (k === 'id' || k === 'traineeId' || k === 'date') continue;
      data[k] = o[k];
    }
    return {
      id: o.id,
      trainer_id: user.id,
      trainee_id: o.traineeId,
      // תאריך מקומי, לא UTC — ראה ההערה ב-index.html ליד isoOf
      date: o.date || (function(){ const d=new Date();
        return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); })(),
      data: data
      // ראה ההערה ב-traineeToRow: deleted אינו נשלח מאותה סיבה
    };
  }
  function childFromRow(r) {
    return Object.assign({}, r.data || {}, {
      id: r.id, traineeId: r.trainee_id, date: r.date
    });
  }

  function dailyToRow(o) {
    const r = childToRow(o);
    r.data.kind = 'daily';
    return r;
  }
  const MAP = {
    trainees: { to: traineeToRow, from: traineeFromRow },
    sessions: { to: childToRow,   from: childFromRow },
    measures: { to: childToRow,   from: childFromRow },
    payments: { to: childToRow,   from: childFromRow },
    daily:    { to: dailyToRow,   from: childFromRow }
  };

  /* ---------- תצלום המצב האחרון שסונכרן ---------- */
  function readSnap() {
    try { return JSON.parse(localStorage.getItem(SNAP_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function writeSnap(snap) {
    try { localStorage.setItem(SNAP_KEY, JSON.stringify(snap)); } catch (e) {}
  }

  /* ---------- מונה גרסה לכל שורה ----------
     "הכתיבה האחרונה מנצחת" מומש לפי סדר הדחיפה ולא לפי גרסה, ולכן
     מכשיר שמחזיק עותק ישן ניצח נתונים טריים יותר. ב-15.9.2026 זה
     קרה שלוש פעמים באותו יום: המין של אחד-עשר מתאמנים נמחק והוחזר
     שוב ושוב, ובכל פעם חזר בדיוק אותו מצב ישן. באותו יום כך גם
     התאפסה תוכנית שלמה, שעות אחרי שהוחזרה.

     מונה ולא שעון, ובכוונה: שעוני שני מכשירים אינם מסונכרנים, והפרש
     של דקות היה הופך את ההגנה להימור. מונה עולה רק כשמישהו כותב,
     והשוואה בין שני מונים אינה תלויה בשום שעון.

     הכלל: דוחפים רק אם השרת לא התקדם מאז המשיכה שלנו. אם התקדם —
     המכשיר הזה מפגר לגבי השורה הזאת, והמשיכה שמיד אחרי תביא את
     הגרסה החדשה.

     ההבדל מהניסיון שנכשל ב-v133: שם הושווה updated_at של השרת, והוא
     משתנה בכל כתיבה — כולל כתיבה שלנו וכולל תיקון ידני במסד. לכן
     גם שמירה חיה של המאמן נראתה כמו התנגשות ודולגה, והתוכנית שהרגע
     נשמרה נמחקה. כאן הבסיס להשוואה הוא המונה שראינו במשיכה האחרונה,
     ולכן שמירה על מכשיר מעודכן תמיד עוברת.

     rev יושב בתוך private/data שכבר מסונכרנים — בלי מיגרציה בשרת.
     שורה בלי מונה נחשבת 0, ולכן ההגנה תופסת מיד גם על הנתונים
     הקיימים, בלי צעד המרה. */
  const REVCOL = { trainees:'private', sessions:'data', measures:'data',
                   payments:'data', daily:'data' };

  function revOf(o) {
    const n = Number(o && o.rev);
    return (isFinite(n) && n > 0) ? n : 0;
  }
  // המונה שראינו במשיכה האחרונה, מתוך התצלום
  function baseRev(prevJson) {
    if (!prevJson) return 0;
    try { return revOf(JSON.parse(prevJson)); } catch (e) { return 0; }
  }
  /* טהורה בכוונה, כמו partitionGone: זו ההחלטה שקובעת אם עריכה
     נכתבת או נזרקת, והיא חייבת להיבדק בלי שרת. */
  function splitByRev(rows, prev, srv) {
    const send = [], stale = [];
    (rows || []).forEach(o => {
      const s = srv ? srv[o.id] : undefined;
      if (s === undefined || s === null) { send.push(o); return; }  // חדשה, או אין מידע
      if (s > baseRev(prev && prev[o.id])) stale.push(o.id);
      else send.push(o);
    });
    return { send: send, stale: stale };
  }

  /* ---------- מצבות מחיקה ----------
     רשימת מזהים שהמאמן מחק במפורש, לפי טבלה. נכתבת ברגע המחיקה
     ונקראת בדחיפה, והיא ההבדל היחיד בין מחיקה לבין רשימה שהתכווצה.

     יושבת ב-localStorage ולא ב-S: היא מצב סנכרון ולא נתון של
     המאמן, ואין שום סיבה שתסתנכרן למכשיר אחר. מכשיר שמחק — הוא
     זה שידחוף את המחיקה.

     נשמרת עד שהמחיקה הצליחה בשרת, כדי שמחיקה שנעשתה אופליין לא
     תלך לאיבוד ותהפוך בסנכרון הבא ל"רשימה שהתכווצה". */
  const TOMB_KEY = 'ebfit_sync_tombs';
  function readTombs() {
    try { return JSON.parse(localStorage.getItem(TOMB_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function writeTombs(t) {
    try { localStorage.setItem(TOMB_KEY, JSON.stringify(t)); } catch (e) {}
  }
  /* נקראת מ-index.html ברגע שהמאמן מאשר מחיקה */
  function tomb(table, ids) {
    if (!table || !ids) return;
    const list = Array.isArray(ids) ? ids : [ids];
    if (!list.length) return;
    const t = readTombs();
    t[table] = t[table] || {};
    list.forEach(id => { if (id) t[table][id] = Date.now(); });
    writeTombs(t);
    log('tomb', { table: table, ids: list });
  }
  /* מי מהנעדרים נמחק בכוונה ומי סתם נעדר. טהורה בכוונה — זו
     ההחלטה שמוחקת נתונים, והיא חייבת להיות ניתנת לבדיקה בלי שרת. */
  function partitionGone(gone, tombs, table) {
    const mark = (tombs && tombs[table]) || {};
    const wanted = [], unknown = [];
    (gone || []).forEach(id => { (mark[id] ? wanted : unknown).push(id); });
    return { wanted: wanted, unknown: unknown };
  }
  function clearTombs(table, ids) {
    const t = readTombs();
    if (!t[table]) return;
    ids.forEach(id => { delete t[table][id]; });
    if (!Object.keys(t[table]).length) delete t[table];
    writeTombs(t);
  }
  function snapshotOf(state) {
    const out = {};
    ARRAYS.forEach(k => {
      out[k] = {};
      (state[k] || []).forEach(o => { out[k][o.id] = JSON.stringify(o); });
    });
    out._prefs = JSON.stringify({ settings: state.settings, features: state.features });
    return out;
  }

  /* ---------- אתחול ---------- */
  function init() {
    log('init', { enabled: enabled(), hasUrl: !!CFG.URL, hasKey: !!CFG.ANON, hasClient: !!sb });
    if (!enabled()) { log('disabled: URL or ANON is missing'); return false; }
    if (sb) return true;
    if (typeof supabase === 'undefined') {
      lastError = 'ספריית Supabase לא נטענה';
      logError(lastError);
      return false;
    }
    try { adminToken = localStorage.getItem('ebfit_admin_token') || ''; } catch (e) {}
    const headers = adminToken ? { 'x-admin-token': adminToken } : {};
    sb = supabase.createClient(CFG.URL, CFG.ANON, { global: { headers: headers } });
    checkAdmin().then(() => {
      resolveAuthReady(user);
      paint();
      if (typeof window.render === 'function') window.render();
      if (user) schedule(800);
    }).catch(e => {
      lastError = (e && e.message) || String(e);
      logError('database session check failed', e);
      resolveAuthReady(null);
      paint();
      if (typeof window.render === 'function') window.render();
    });
    window.addEventListener('online', () => schedule(500));
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) schedule(1500);
    });
    /* חלון זה פוחז מוקד בלי שינוי נראות — למשל שני חלונות זה לצד זה.
       בלי זה לוח הניהול היה נשאר ישן כל עוד לא מקליקים עליו. */
    window.addEventListener('focus', () => schedule(800));

    /* משיכה יזומה בזמן שהמאמן מסתכל, לא כל הזמן: מתאמנים כותבים
       לשרת דרך RPC משלהם — שקילות, ארוחות, הצהרות, דיווחי ביצוע
       וגם עריכת תוכנית. כשהחלון מוסתר אין טעם למשוך, ואחרי כישלון
       schedule() ממילא ממתין. */
    setInterval(() => {
      if (document.hidden || !user || running) return;
      schedule(0);
    }, 120000);
    return true;
  }

  /* ---------- אימות ---------- */
  async function signIn(email, pass) {
    log('signIn started', { email: email ? String(email).trim().toLowerCase() : '', passwordLength: String(pass || '').length });
    if (!init()) throw new Error(lastError || 'הסנכרון לא מוגדר');
    const { data, error } = await sb.rpc('admin_login', { p_email: email, p_password: pass });
    if (error) { logError('database admin login failed', error); throw error; }
    if (!data || !data[0] || !data[0].token) throw new Error('פרטי מנהל שגויים');
    adminToken = data[0].token;
    try { localStorage.setItem('ebfit_admin_token', adminToken); } catch (e) {}
    sb = supabase.createClient(CFG.URL, CFG.ANON, { global: { headers: { 'x-admin-token': adminToken } } });
    user = { id: data[0].admin_id, email: data[0].email };
    adminState = 'allowed';
    log('database admin login accepted');
    await checkAdmin();
  }
  async function traineeLogin(identifier, pass) {
    log('trainee login started', { identifier: identifier ? String(identifier).trim().toLowerCase() : '' });
    if (!init()) throw new Error(lastError || 'הסנכרון לא מוגדר');
    const { data, error } = await sb.rpc('trainee_login', {
      p_username: identifier,
      p_password: pass
    });
    if (error) { logError('trainee login failed', error); throw error; }
    if (!data || !data.length || !data[0].token) throw new Error('פרטי הכניסה אינם נכונים');
    log('trainee login accepted');
    return data[0];
  }
  async function signUp(email, pass) {
    log('signUp started', { email: email ? String(email).trim().toLowerCase() : '' });
    if (!init()) throw new Error(lastError || 'הסנכרון לא מוגדר');
    const { data, error } = await sb.auth.signUp({ email, password: pass });
    if (error) { logError('signUp failed', error); throw error; }
    if (data && data.session && data.user) user = data.user;
    log('signUp accepted by Supabase');
    if (data && data.session) await checkAdmin();
    return data;
  }
  async function signOut() {
    log('signOut started');
    if (!sb) return;
    try { await sb.rpc('admin_logout'); } catch (e) {}
    try { localStorage.removeItem('ebfit_admin_token'); } catch (e) {}
    adminToken = ''; user = null; adminState = 'denied';
    try { localStorage.removeItem(SNAP_KEY); } catch (e) {}
    log('signOut completed');
  }

  /* ---------- הסנכרון עצמו ---------- */
  function schedule(ms) {
    if (!enabled() || !user) return;
    /* אחרי כישלון לא מנסים שוב מיד — ממתינים לפי מספר הכישלונות,
       אחרת טיימר ה-45s יורה לחלל האוויר כל פעם מחדש. */
    if (failCount > 0) {
      const backoff = Math.min(failCount, 5) * 30000;   // ‎30s,60s,...2.5m
      if (ms == null || ms < backoff) ms = backoff;
    }
    clearTimeout(timer);
    timer = setTimeout(() => { run().catch(() => {}); }, ms == null ? 2000 : ms);
    pending = true;
  }
  /* יציאה מהאפליקציה: שולחים עכשיו ולא בעוד שנייה. בטלפון דף ברקע
     נעצר, והשינוי האחרון היה נשאר במכשיר עד הפתיחה הבאה. */
  function flush() {
    if (!pending || !enabled() || !user) return;
    // סנכרון כבר רץ — הטיימר שמחכה אחריו ישלח; לא מבטלים אותו
    if (running) return;
    clearTimeout(timer);
    run().catch(() => {});
  }

  async function run() {
    if (!sb || !user || running || !navigator.onLine) {
      log('run skipped', { hasClient: !!sb, signedIn: !!user, running: running, online: navigator.onLine });
      return;
    }
    log('sync started', { userId: user.id });
    running = true; pending = false; lastError = null; paint();
    try {
      if (!(await checkAdmin())) {
        lastError = 'אין הרשאת מנהל לחשבון הזה';
        if (typeof window.render === 'function') window.render();
        return;
      }
      const snap = readSnap();
      const skipped = await push(snap);
      await pull();
      writeSnap(snapshotOf(window.S));
      localStorage.setItem('ebfit_sync_at', new Date().toISOString());
      failCount = 0;
      log('sync completed');
      /* מחיקה חשודה שדולגה: הסנכרון הצליח, ולכן זו הודעה ולא שגיאה.
         היא מוצגת פעם אחת, אחרי שהמשיכה כבר סגרה את הפער. */
      if (skipped && typeof window.toast === 'function') {
        if (skipped.deletes && skipped.deletes.length) {
          window.toast('הסנכרון הושלם. דילגתי על מחיקה של ' + skipped.deletes.join(', ')
            + ' — היא נראתה כמו רשימה שהתכווצה ולא כמו מחיקה שלך. שום דבר לא נמחק.');
        }
        /* מכשיר אחר כתב אחרי שהמכשיר הזה משך. מדווחים במפורש, כי
           המאמן עלול לראות עכשיו ערך אחר ממה שהקליד לפני רגע —
           ועדיף שיבין למה, מאשר שיחשוב שהשמירה נעלמה. */
        if (skipped.stale && skipped.stale.length) {
          window.toast('הסנכרון הושלם. ' + skipped.stale.join(', ')
            + ' עודכנו במכשיר אחר אחרי שהמכשיר הזה משך אותם, ולכן לא דחפתי עליהם. '
            + 'מה שמוצג עכשיו הוא הגרסה העדכנית.');
        }
      }
    } catch (e) {
      lastError = (e && e.message) || String(e);
      failCount++;
      logError('sync failed', e);
    } finally {
      running = false; paint();
    }
  }

  // דוחף רק את מה שהשתנה מאז התצלום האחרון
  /* עמודות שהשרת לא מכיר. מיגרציה שלא הורצה הפילה עד עכשיו את כל
     הדחיפה — עמודה אחת חסרה ביטלה גם שמירת תוכניות, קבצים והגדרות.
     עכשיו העמודה נושרת מהבקשה והשאר ממשיך, והחוסר מדווח למעלה. */
  const MISSING = {};
  const NEVER_STRIP = ['id', 'trainer_id'];

  function missingColumn(err) {
    const m = String((err && (err.message || err.details)) || '');
    let a = m.match(/[Cc]ould not find the '([^']+)' column/);
    if (a) return a[1];
    a = m.match(/column "([^"]+)" of relation/i);        // column "meals" of relation "trainees"
    if (a) return a[1];
    a = m.match(/column\s+[\w.]*?(\w+)\s+does not exist/i);
    if (a) return a[1];
    return null;
  }

  async function upsertRows(table, rows) {
    log('upsert', { table: table, rows: rows.length });
    const strip = MISSING[table] || [];
    const payload = strip.length
      ? rows.map(r => { const c = Object.assign({}, r); strip.forEach(k => delete c[k]); return c; })
      : rows;
    /* שורת מתאמן יכולה לשאת תוכנית, קבצים ותפריט שלמים. שפיכה של 14
       כאלה בבת אחת חצתה את מגבלת הזמן של השרת (57014). שולחים שורה
       שורה כשמדובר בטבלת trainees — השאר קטנות וממשיכות בנתחים. */
    if (table === 'trainees') {
      for (const r of payload) {
        const { error } = await sb.from(table).upsert([r], { onConflict: 'id' });
        if (error) { await handleUpsertError(table, [r], error); }
      }
      return;
    }
    const { error } = await sb.from(table).upsert(payload, { onConflict: 'id' });
    if (!error) return;
    await handleUpsertError(table, payload, error);
  }

  async function handleUpsertError(table, rows, error) {
    logError('upsert failed', { table: table, error: error });
    /* 403 אינו באג באפליקציה אלא דחייה של מדיניות RLS. ההודעה
       הגנרית שלחה לחפש בקונסול; זו אומרת מה קרה ומה עושים. */
    if (String(error && (error.code || error.status)) === '403'
        || /permission denied|row-level security|violates row-level/i.test(String(error && error.message))) {
      throw new Error('השרת דחה את השמירה (403) — בעיית הרשאות במסד הנתונים, '
        + 'לא באפליקציה. הנתונים נשארו במכשיר. יש להריץ את '
        + 'supabase/fix-rls-403.sql ב-SQL Editor של סופאבייס.');
    }
    const col = missingColumn(error);
    if (col && NEVER_STRIP.indexOf(col) === -1 && (MISSING[table] || []).indexOf(col) === -1) {
      (MISSING[table] = MISSING[table] || []).push(col);
      const stripped = rows.map(r => { const c = Object.assign({}, r); delete c[col]; return c; });
      const retry = await sb.from(table).upsert(stripped, { onConflict: 'id' });
      if (retry.error) throw retry.error;
      return;
    }
    throw error;
  }

  async function push(snap) {
    /* מה שדולג, כדי לדווח אחרי שהסנכרון הצליח ולא במקומו */
    const skippedDeletes = [];
    const skippedStale   = [];

    for (const key of ARRAYS) {
      const list = window.S[key] || [];
      const prev = snap[key] || {};
      const seen = new Set();
      const changed = [];

      list.forEach(o => {
        if (!o || !o.id) return;
        seen.add(o.id);
        if (prev[o.id] !== JSON.stringify(o)) changed.push(o);
      });

      if (changed.length) {
        /* מונה הגרסה של השורות האלה בשרת ברגע זה. נשלף רק לשורות
           שעומדות להידחף, ולכן זו שאילתה של שורה או שתיים. */
        const col = REVCOL[key];
        let srv = null;
        try {
          const { data } = await sb.from(TABLE[key])
            .select('id,' + col).eq('trainer_id', user.id)
            .in('id', changed.map(o => o.id));
          srv = {};
          (data || []).forEach(r => { srv[r.id] = revOf(r[col]); });
        } catch (e) { srv = null; }   // בלי מידע ממשיכים כרגיל

        const part = splitByRev(changed, prev, srv);
        if (part.stale.length) {
          logError('push skipped — device is behind', { table: key, ids: part.stale });
          skippedStale.push(part.stale.length + ' ב"' + key + '"');
        }

        /* המונה מועלה רק על מה שבאמת נשלח, ורק אחרי שהוכח שאיננו
           מפגרים. הוא נכתב על האובייקט החי כדי שגם התצלום הבא
           יישא אותו — אחרת הדחיפה הבאה הייתה חוזרת לבסיס ישן. */
        part.send.forEach(o => {
          const base = (srv && srv[o.id] != null) ? srv[o.id] : baseRev(prev[o.id]);
          o.rev = base + 1;
        });
        const rows = part.send.map(MAP[key].to);

        // נתחים קטנים — המגבלה הקודמת של 200 שורות יצרה פקודת upsert
        // אחת ענקית שהשרת הרג (57014). trainees מטופלת שורה-שורה ב-upsertRows.
        const CHUNK = 25;
        for (let i = 0; i < rows.length; i += CHUNK) {
          await upsertRows(TABLE[key], rows.slice(i, i + CHUNK));
        }
      }

      /* ---------- מחיקה מוסקת, ולכן מוגבלת ----------
         מה שהיה בתצלום ואיננו עכשיו נחשב כנמחק במכשיר. זו הסקה ולא
         כוונה מפורשת: איש לא לחץ "מחק", והמסקנה נשענת על כך שהרשימה
         המקומית מהימנה.

         והיא לא תמיד. pull דורס את S בתשובת השרת, ולכן משיכה אחת
         חסרה — הרשאות שנשברו, רשת שנקטעה, טעינה חלקית — מכווצת את
         הרשימה, והדחיפה הבאה הופכת את החוסר הזמני למחיקה קבועה.

         ב-15.9.2026 זה מחק ארבעה מתאמנים בפקודה אחת, באותה מיליונית
         שנייה, ובהם אחד שהוחזר ידנית שעה קודם.

         מחיקה אמיתית היא פעולה נקודתית — אחד, לפעמים שניים. מחיקה
         של שלושה ומעלה בבת אחת היא כמעט תמיד התכווצות של הרשימה.

         הגרסה הראשונה של ההגנה זרקה שגיאה ועצרה את כל הסנכרון. זה
         מנע את האובדן אבל השאיר את המאמן תקוע בלי דרך קדימה: שום
         שינוי לא נדחף, ושום דבר לא נמשך, והמצב לא היה יכול להיפתר
         מעצמו כי הפער נשאר בדיוק כפי שהיה.

         עכשיו מדלגים על המחיקות בלבד וממשיכים. זה גם מה שסוגר את
         הפער: pull יחזיר למכשיר את מה שחסר בו, התצלום הבא יתאים
         לרשימה, ובסנכרון שאחריו כבר לא יהיה gone. ההודעה נשמרת
         כדי שהמאמן ידע — אבל היא מדווחת, לא חוסמת. */
      /* ---------- מצבה: מחיקה מפורשת גוברת על הסקה ----------
         ב-15.9.2026 נמחקה מתאמנת שלמה יום אחרי שנוספה, בלי שאיש
         לחץ עליה "מחק". היא הייתה היחידה שנעדרה מהרשימה, ולכן
         gone.length היה 1 — מתחת לתקרה, ולכן המחיקה בוצעה בשקט.

         התקרה לבדה לא יכולה להציל: מחיקה אמיתית של מתאמן אחד
         ורשימה שאיבדה מתאמן אחד הן אותו מספר בדיוק, ואין במידע
         שלפנינו שום דבר שמבדיל ביניהן.

         מה שמבדיל ביניהן הוא כוונה, ואותה צריך לרשום בזמן אמת.
         delTrainee ושאר המוחקים כותבים את המזהה ל-EBSync.tomb,
         וכאן מוחקים רק מה שנרשם שם. מה שנעלם בלי מצבה הוא רשימה
         שהתכווצה — ועליו מדלגים ומדווחים, ו-pull יחזיר אותו. */
      const gone = Object.keys(prev).filter(id => !seen.has(id));
      if (gone.length) {
        const part = partitionGone(gone, readTombs(), key);
        const wanted = part.wanted, unknown = part.unknown;

        if (wanted.length) {
          const { error } = await sb.from(TABLE[key])
            .update({ deleted: true }).in('id', wanted).eq('trainer_id', user.id);
          if (error) throw error;
          clearTombs(key, wanted);           // הושלם — אין צורך לשמור
        }
        if (unknown.length) {
          logError('inferred delete skipped — no tombstone',
                   { table: key, count: unknown.length, ids: unknown });
          skippedDeletes.push(unknown.length + ' ב"' + key + '"');
        }
      }
    }

    // הגדרות ופיצ'רים.
    // מפתח ה-API של Anthropic נשאר במכשיר בלבד ולא נשלח לשרת — הוא סוד
    // שמאפשר לחייב את חשבון המאמן, ואין שום סיבה שיישב בבסיס הנתונים.
    const safeSettings = Object.assign({}, window.S.settings);
    delete safeSettings.apiKey;
    const prefs = JSON.stringify({ settings: safeSettings, features: window.S.features });
    if (snap._prefs !== prefs) {
      const { error } = await sb.from('trainer_prefs')
        .upsert({ trainer_id: user.id, data: JSON.parse(prefs) }, { onConflict: 'trainer_id' });
      if (error) throw error;
    }
    return { deletes: skippedDeletes, stale: skippedStale };
  }

  // מושך את האמת מהשרת ומחליף את המערכים המקומיים
  async function pull() {
    log('pull started');
    // כל טבלה נשלפת פעם אחת, ואז מפוצלת למערכים המקומיים
    const fetched = {};
    for (const tbl of ['trainees','sessions','measures','payments']) {
      log('select', { table: tbl, userId: user.id });
      const { data, error } = await sb.from(tbl)
        .select('*').eq('trainer_id', user.id).eq('deleted', false);
      if (error) { logError('select failed', { table: tbl, error: error }); throw error; }
      log('select completed', { table: tbl, rows: (data || []).length });
      fetched[tbl] = data || [];
    }

    /* המאמן באמצע עריכת תוכנית שלא נשמרה? המשיכה דורסת את
       S.trainees, ובלעדיה העריכה תיעלם. שומרים את ה-program הערוך
       ומשחזרים אותו אחרי ההחלפה, ואז ה-dock נשאר נכון. */
    let unsavedProg = null;
    if (window.PROGRAM_BASE_ID && window.S && window.S.trainees) {
      const open = window.S.trainees.find(x => x.id === window.PROGRAM_BASE_ID);
      const local = open && open.program;
      const base  = window.PROGRAM_BASE;
      if (local && base && JSON.stringify(local) !== JSON.stringify(base)) {
        unsavedProg = { id: window.PROGRAM_BASE_ID, program: local };
      }
    }

    /* ---------- הגנה מפני מחיקה בשקט ----------
       המשיכה מחליפה את המערך המקומי. כשהשרת מחזיר אפס שורות בגלל
       מדיניות הרשאה — לא בגלל שנמחקו מתאמנים — השורה הזאת מוחקת
       את כל העבודה מהאפליקציה בלי שאלה ובלי הודעה.

       מאמן שהיו לו מתאמנים ופתאום אין לו אף אחד הוא תקלה, לא מצב
       תקין. במקרה כזה משאירים את המקומי כמו שהוא ומדווחים.

       ומדלגים ולא זורקים, מאותה סיבה שבמחיקה המוסקת: שגיאה עוצרת
       את כל הסנכרון ומשאירה את המאמן תקוע בלי דרך לצאת מהמצב.
       דילוג משאיר את הנתונים במקום, ומאפשר לכל השאר להמשיך. */
    if (!fetched.trainees.length && (window.S.trainees || []).length) {
      logError('empty pull skipped', { local: window.S.trainees.length });
      if (typeof window.toast === 'function') {
        window.toast('השרת החזיר רשימת מתאמנים ריקה ובמכשיר יש '
          + window.S.trainees.length + '. לא נגעתי בהם. '
          + 'הרץ "בדיקת חיבור" בהגדרות כדי לראות למה.');
      }
      return;
    }

    /* טביעה לפני ההחלפה — כדי לדעת אם משהו באמת הגיע מהשרת */
    const fpOf = () => { try { return JSON.stringify([window.S.trainees, window.S.sessions, window.S.payments,
                                                      window.S.measures, window.S.daily, window.S.settings]); } catch (e) { return ''; } };
    const before = fpOf();
    window.S.trainees = fetched.trainees.map(traineeFromRow);

    if (unsavedProg) {
      const t = window.S.trainees.find(x => x.id === unsavedProg.id);
      if (t) t.program = unsavedProg.program;   // מחזירים את העריכה הלא-שמורה
    }

    window.S.sessions = fetched.sessions.map(childFromRow);
    window.S.payments = fetched.payments.map(childFromRow);
    const isDaily = r => ((r.data || {}).kind === 'daily');
    window.S.measures = fetched.measures.filter(r => !isDaily(r)).map(childFromRow);
    window.S.daily    = fetched.measures.filter(isDaily).map(r => {
      const o = childFromRow(r); delete o.kind; return o;
    });
    const { data: p } = await sb.from('trainer_prefs')
      .select('data').eq('trainer_id', user.id).maybeSingle();
    if (p && p.data) {
      if (p.data.settings) {
        // המפתח המקומי מנצח תמיד — הוא לא מסונכרן, ולכן אסור שמשיכה
        // מהשרת תדרוס אותו בערך ריק.
        const localKey = window.S.settings.apiKey;
        window.S.settings = Object.assign({}, window.S.settings, p.data.settings);
        window.S.settings.apiKey = localKey || '';
      }
      if (p.data.features) window.S.features = Object.assign({}, window.S.features, p.data.features);
    }
    /* המתאמן שינה את התוכנית שלו בשרת, והמשיכה החליפה את
       S.trainees[].program. בלי לעדכן גם את תצלום ה-PROGRAM_BASE
       ה-dock היה מראה "יש שינויים שטרם נשמרו" על שינוי שבכלל הגיע
       מהמתאמן ולא מהמאמן. מסנכרנים את התצלום — אבל רק אם אין למאמן
       עריכה מקומית שלא נשמרה (אז ה-dock ממשיך לשקף אותה). */
    if (window.PROGRAM_BASE_ID && !unsavedProg) {
      const cur = (window.S.trainees || []).find(x => x.id === window.PROGRAM_BASE_ID);
      if (cur) window.PROGRAM_BASE = JSON.parse(JSON.stringify(cur.program || { days: [] }));
    }
    if (typeof window.rawSave === 'function') window.rawSave();
    /* מציירים מחדש רק אם משהו השתנה, ולא באמצע הקלדה. עד ספטמבר 2026 כל
       סנכרון צייר את כל המסך מחדש — גם בלי שום שינוי — והחליף את השדה
       שהמאמן הקליד בו. בבניית תוכנית תא נשמר רק ביציאה ממנו, ולכן מה
       שהוקלד נעלם. */
    if (fpOf() !== before) {
      if (typeof window.renderFromSync === 'function') window.renderFromSync();
      else if (typeof window.render === 'function') window.render();
    }
    log('pull completed', {
      trainees: fetched.trainees.length,
      sessions: fetched.sessions.length,
      measures: fetched.measures.length,
      payments: fetched.payments.length
    });
  }

  /* ---------- קישור אישי למתאמן ---------- */
  function traineeLink(t) {
    if (!t || !t._token) return null;
    const base = location.href.replace(/[^/]*$/, '');
    return base + 't.html#' + t._token;
  }

  // מבטל או מחזיר גישה של מתאמן לקישור שלו
  async function setAccess(traineeId, active) {
    if (!sb || !user) throw new Error('לא מחובר');
    const { error } = await sb.from('trainees')
      .update({ access_active: !!active }).eq('id', traineeId).eq('trainer_id', user.id);
    if (error) throw error;
    const t = (window.S.trainees || []).find(x => x.id === traineeId);
    if (t) t._tokenActive = !!active;
  }

  // קביעת שם משתמש וסיסמה למתאמן. הסיסמה נשלחת פעם אחת בלבד
  // ומוצפנת בשרת; היא לא נשמרת אצלנו בשום מקום.
  async function setLogin(traineeId, username, password) {
    if (!sb || !user) throw new Error('לא מחובר');

    /* שתי טרנספורמציות שהיו כאן הוסרו, ושתיהן היו הרסניות:

       הסרת ספרות משם המשתמש. הכוונה הייתה שהשמות שנוצרים יהיו בלי
       ספרות, אבל זה הוחל גם על *שמירה של שם קיים* — ולכן מאמן שפתח
       את הטופס של מתאמן בשם dan2 ורק שינה לו סיסמה, שינה בלי לדעת
       גם את שם המשתמש ל-dan. המתאמן נחסם מיד. הסרת הספרות שייכת
       ליצירת שם חדש בלבד, וזה מקומה ב-slugName.

       הורדת הסיסמה לאותיות קטנות. היא נשמרה מגובבת בצורה שונה ממה
       שהמאמן הקליד ומסר למתאמן. הכניסה מנסה ממילא את שתי הצורות,
       ולכן אין שום סיבה לשנות כאן את מה שהוקלד.

       מה שנשאר: לואר וטרים על שם המשתמש בלבד — בדיוק מה שהשרת
       עושה ממילא, ולכן זה לא משנה דבר. */
    const u = username == null ? null : String(username).trim().toLowerCase();

    const { error } = await sb.rpc('set_trainee_login', {
      p_trainee_id: traineeId,
      p_username: u || null,
      p_password: password ? String(password) : null
    });
    if (error) throw error;
    const t = (window.S.trainees || []).find(x => x.id === traineeId);
    if (t) t._username = u || '';
  }

  // מה המתאמן דיווח שביצע
  async function logsFor(traineeId, limit) {
    if (!sb || !user) return [];
    const { data, error } = await sb.from('workout_logs')
      .select('*').eq('trainee_id', traineeId)
      .order('created_at', { ascending: false }).limit(limit || 20);
    if (error) return [];
    return data || [];
  }

  /* מה כל המתאמנים דיווחו בימים האחרונים — שאילתה אחת ללוח הבקרה,
     במקום שאילתה לכל מתאמן. ה-RLS מחזיר רק את המתאמנים של המאמן. */
  async function recentLogs(days) {
    if (!sb || !user) return null;
    const d = new Date(); d.setDate(d.getDate() - (days || 14));
    const since = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
                + '-' + String(d.getDate()).padStart(2, '0');
    const { data, error } = await sb.from('workout_logs')
      .select('id,trainee_id,date,day_name,entries,feel,note,created_at')
      .gte('date', since).order('created_at', { ascending: false }).limit(2000);
    if (error) return null;
    return data || [];
  }

  /* ---------- חיווי מצב ---------- */

  /* =====================================================================
     בדיקת חיבור
     ---------------------------------------------------------------------
     "שגיאת סנכרון" לא אומרת כלום, ולכן כל תקלה הפכה לסבב שאלות מול
     הקונסולה. כאן כל שכבה נבדקת בנפרד ומדווחת בעברית, בסדר שבו
     הן תלויות זו בזו: הגדרות, זהות, קריאה, כתיבה.

     ההבחנה שחוזרת ומבלבלת, ולכן היא מפורשת כאן: דחיית RLS על שורה
     מחזירה 401, והיעדר GRANT מחזיר 403. שתיהן נראות "אין הרשאה"
     אבל הפתרון שלהן שונה לגמרי.

     בדיקת הכתיבה נעשית על trainer_prefs ולא על trainees: זו אותה
     הרשאה בדיוק, אבל כתיבה חוזרת של מה שכבר שם — ולכן אינה יכולה
     לפגוע בנתוני מתאמן גם אם משהו משתבש באמצע.
     ===================================================================== */
  async function diagnose() {
    const out = [];
    const add = (ok, title, text, fix) => out.push({ ok: ok, title: title, text: text, fix: fix || '' });

    // 1. הגדרות
    if (!enabled()) {
      add(false, 'הגדרות חיבור', 'אין כתובת שרת או מפתח ב-config.js.',
          'האפליקציה עובדת מקומית בלבד. אין מה לסנכרן.');
      return out;
    }
    add(true, 'הגדרות חיבור', 'כתובת השרת והמפתח קיימים.');

    // 2. רשת
    if (!navigator.onLine) {
      add(false, 'רשת', 'הדפדפן מדווח שאין חיבור לאינטרנט.', 'להתחבר לרשת ולנסות שוב.');
      return out;
    }
    add(true, 'רשת', 'יש חיבור.');

    // 3. זהות
    let token = '';
    try { token = localStorage.getItem('ebfit_admin_token') || ''; } catch (e) {}
    if (!token) {
      add(false, 'זהות', 'אין טוקן מנהל במכשיר — לא התחברת, או שההתחברות נמחקה.',
          'להתחבר מחדש באפליקציה.');
      return out;
    }
    try {
      const r = await sb.rpc('admin_session');
      if (r.error) throw r.error;
      const row = r.data && r.data[0];
      if (!row) {
        add(false, 'זהות', 'הטוקן במכשיר אינו מוכר לשרת — כנראה פג תוקף.',
            'יציאה והתחברות מחדש באפליקציה. זה מייצר טוקן חדש.');
        return out;
      }
      add(true, 'זהות', 'השרת מזהה אותך' + (row.email ? ' כ-' + row.email : '') + '.');
    } catch (e) {
      add(false, 'זהות', 'בדיקת הזהות נכשלה: ' + ((e && e.message) || e),
          'יציאה והתחברות מחדש. אם חוזר — בעיה בשרת.');
      return out;
    }

    // 4. קריאה
    let serverCount = null;
    try {
      const r = await sb.from('trainees').select('id', { count: 'exact', head: true })
                        .eq('trainer_id', user.id).eq('deleted', false);
      if (r.error) throw r.error;
      serverCount = r.count == null ? 0 : r.count;
      const local = ((window.S && window.S.trainees) || []).length;
      if (!serverCount && local) {
        add(false, 'קריאה מהשרת', 'השרת מחזיר אפס מתאמנים, ובמכשיר יש ' + local + '.',
            'ההרשאות או המדיניות בשרת. להריץ את supabase/fix-rls-403.sql. '
            + 'הנתונים במכשיר בטוחים — המשיכה נעצרת ואינה מוחקת אותם.');
      } else {
        add(true, 'קריאה מהשרת', serverCount + ' מתאמנים בשרת, ' + local + ' במכשיר.');
      }
    } catch (e) {
      add(false, 'קריאה מהשרת', 'נכשלה: ' + ((e && e.message) || e),
          'להריץ את supabase/fix-rls-403.sql.');
    }

    // 5. כתיבה
    try {
      const probe = { trainer_id: user.id, data: (window.S && window.S.settings) ? { settings: window.S.settings } : {} };
      const r = await sb.from('trainer_prefs').upsert(probe, { onConflict: 'trainer_id' });
      if (r.error) throw r.error;
      add(true, 'כתיבה לשרת', 'הצליחה. הסנכרון אמור לעבוד.');
    } catch (e) {
      const msg  = String((e && e.message) || e);
      const code = String((e && (e.code || e.status)) || '');
      const rls  = /row-level security|violates row-level/i.test(msg);
      add(false, 'כתיבה לשרת',
          'נדחתה' + (code ? ' (' + code + ')' : '') + ': ' + msg,
          rls
            ? 'המדיניות דוחה את השורה — trainer_id אינו תואם למי שהשרת מזהה. '
              + 'להריץ את supabase/fix-rls-403.sql.'
            : 'חסרה הרשאת טבלה, לרוב לתפקיד authenticated. '
              + 'להריץ את supabase/fix-rls-403.sql — הוא מעניק לשני התפקידים.');
    }
    return out;
  }

  function status() {
    if (!enabled())      return { state: 'off',     text: 'מקומי בלבד' };
    if (!user)           return { state: 'out',     text: 'לא מחובר' };
    if (adminState === 'denied') return { state: 'error', text: 'אין הרשאת מנהל' };
    if (adminState !== 'allowed') return { state: 'sync', text: 'בודק הרשאות' };
    if (!navigator.onLine) return { state: 'offline', text: 'אין רשת — נסנכרן אח״כ' };
    if (running)         return { state: 'sync',    text: 'מסנכרן…' };
    if (lastError)       return { state: 'error',   text: 'שגיאת סנכרון' };
    const at = localStorage.getItem('ebfit_sync_at');
    return { state: 'ok', text: at ? 'מסונכרן ' + new Date(at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : 'מסונכרן' };
  }

  function paint() {
    const el = document.getElementById('syncPill');
    const logout = document.getElementById('adminLogout');
    if (logout) logout.style.display = adminState === 'allowed' ? '' : 'none';
    if (!el) return;
    const s = status();
    el.className = 'syncpill s-' + s.state;
    el.textContent = s.text;
    el.title = lastError || '';
  }

  window.EBSync = {
    init, enabled, schedule, run, status, paint, diagnose, authReady: () => authReady,
    /* שחזור מגיבוי שרת: ההמרה משורות המסד למבנה האפליקציה יושבת
       כאן ממילא, ובלעדיה הייבוא היה צריך לשכפל אותה ולהתיישן. */
    fromRows: (table, rows) => (rows || []).map(
      table === 'trainees' ? traineeFromRow : childFromRow),
    checkAdmin,
    /* מצבת מחיקה. חייבת להיקרא לפני שהשורה מוסרת מ-S, אחרת
       הדחיפה תראה היעלמות בלי כוונה ותדלג עליה. */
    tomb, partitionGone, splitByRev,
    adminState: () => adminState, lastError: () => lastError,
    signIn, signUp, signOut,
    traineeLogin,
    user: () => user,
    client: () => sb,
    missing: () => MISSING,
    traineeLink, setAccess, logsFor, recentLogs, setLogin, flush
  };
})();

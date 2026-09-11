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
  (window.EB_MOD = window.EB_MOD || {})['sync'] = 'v97';

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
  const SHARED = ['id', 'name', 'goal', 'program', 'status', 'files', 'meals', 'mealsSelf',
                  'exercisesSelf', 'health', 'weighins'];

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
      private: priv,
      deleted: false
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
      data: data,
      deleted: false
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
  }

  async function run() {
    if (!sb || !user || running || !navigator.onLine) {
      log('run skipped', { hasClient: !!sb, signedIn: !!user, running: running, online: navigator.onLine });
      return;
    }
    log('sync started', { userId: user.id });
    running = true; lastError = null; paint();
    try {
      if (!(await checkAdmin())) {
        lastError = 'אין הרשאת מנהל לחשבון הזה';
        if (typeof window.render === 'function') window.render();
        return;
      }
      const snap = readSnap();
      await push(snap);
      await pull();
      writeSnap(snapshotOf(window.S));
      localStorage.setItem('ebfit_sync_at', new Date().toISOString());
      failCount = 0;
      log('sync completed');
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
    for (const key of ARRAYS) {
      const list = window.S[key] || [];
      const prev = snap[key] || {};
      const rows = [];
      const seen = new Set();

      list.forEach(o => {
        if (!o || !o.id) return;
        seen.add(o.id);
        if (prev[o.id] !== JSON.stringify(o)) rows.push(MAP[key].to(o));
      });

      if (rows.length) {
        // נתחים קטנים — המגבלה הקודמת של 200 שורות יצרה פקודת upsert
        // אחת ענקית שהשרת הרג (57014). trainees מטופלת שורה-שורה ב-upsertRows.
        const CHUNK = 25;
        for (let i = 0; i < rows.length; i += CHUNK) {
          await upsertRows(TABLE[key], rows.slice(i, i + CHUNK));
        }
      }

      // מה שהיה בתצלום ואיננו עכשיו — נמחק במכשיר
      const gone = Object.keys(prev).filter(id => !seen.has(id));
      if (gone.length) {
        const { error } = await sb.from(TABLE[key])
          .update({ deleted: true }).in('id', gone).eq('trainer_id', user.id);
        if (error) throw error;
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
    if (typeof window.render === 'function') window.render();
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

  /* ---------- חיווי מצב ---------- */
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
    init, enabled, schedule, run, status, paint, authReady: () => authReady,
    checkAdmin,
    adminState: () => adminState, lastError: () => lastError,
    signIn, signUp, signOut,
    traineeLogin,
    user: () => user,
    client: () => sb,
    missing: () => MISSING,
    traineeLink, setAccess, logsFor, setLogin
  };
})();

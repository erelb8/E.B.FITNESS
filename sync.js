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

  const CFG      = window.EBFIT_CONFIG || { URL: '', ANON: '' };
  const SNAP_KEY = 'ebfit_sync_v1';
  const ARRAYS   = ['trainees', 'sessions', 'measures', 'payments'];

  let sb = null;                 // לקוח Supabase
  let user = null;               // המאמן המחובר
  let timer = null;              // דיבאונס
  let running = false;
  let lastError = null;

  const enabled = () => !!(CFG.URL && CFG.ANON);

  /* ---------- המרה בין מבנה האפליקציה למבנה השרת ---------- */
  // מתאמן: name/goal/program משותפים עם המתאמן, כל השאר ב-private.
  const SHARED = ['id', 'name', 'goal', 'program', 'status'];

  function traineeToRow(t) {
    const priv = {};
    for (const k in t) {
      if (SHARED.includes(k)) continue;
      if (k === '_token' || k === '_tokenActive') continue; // שדות שרת, לא נשמרים בחזרה
      priv[k] = t[k];
    }
    return {
      id: t.id,
      trainer_id: user.id,
      name: t.name || '',
      goal: t.goal || null,
      program: t.program || { days: [] },
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
      status: r.status,
      _token: r.access_token,
      _tokenActive: r.access_active
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
      date: o.date || new Date().toISOString().slice(0, 10),
      data: data,
      deleted: false
    };
  }
  function childFromRow(r) {
    return Object.assign({}, r.data || {}, {
      id: r.id, traineeId: r.trainee_id, date: r.date
    });
  }

  const MAP = {
    trainees: { to: traineeToRow, from: traineeFromRow },
    sessions: { to: childToRow,   from: childFromRow },
    measures: { to: childToRow,   from: childFromRow },
    payments: { to: childToRow,   from: childFromRow }
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
    if (!enabled()) return false;
    if (sb) return true;
    if (typeof supabase === 'undefined') { lastError = 'ספריית Supabase לא נטענה'; return false; }
    sb = supabase.createClient(CFG.URL, CFG.ANON, {
      auth: { persistSession: true, autoRefreshToken: true }
    });
    sb.auth.onAuthStateChange((_e, session) => {
      user = session ? session.user : null;
      paint();
      if (user) schedule(400);
    });
    sb.auth.getSession().then(({ data }) => {
      user = data.session ? data.session.user : null;
      paint();
      if (user) schedule(800);
    });
    window.addEventListener('online', () => schedule(500));
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) schedule(1500);
    });
    return true;
  }

  /* ---------- אימות ---------- */
  async function signIn(email, pass) {
    if (!init()) throw new Error(lastError || 'הסנכרון לא מוגדר');
    const { error } = await sb.auth.signInWithPassword({ email, password: pass });
    if (error) throw error;
  }
  async function signUp(email, pass) {
    if (!init()) throw new Error(lastError || 'הסנכרון לא מוגדר');
    const { error } = await sb.auth.signUp({ email, password: pass });
    if (error) throw error;
  }
  async function signOut() {
    if (!sb) return;
    await sb.auth.signOut();
    try { localStorage.removeItem(SNAP_KEY); } catch (e) {}
  }

  /* ---------- הסנכרון עצמו ---------- */
  function schedule(ms) {
    if (!enabled() || !user) return;
    clearTimeout(timer);
    timer = setTimeout(() => { run().catch(() => {}); }, ms == null ? 2000 : ms);
  }

  async function run() {
    if (!sb || !user || running || !navigator.onLine) return;
    running = true; lastError = null; paint();
    try {
      const snap = readSnap();
      await push(snap);
      await pull();
      writeSnap(snapshotOf(window.S));
      localStorage.setItem('ebfit_sync_at', new Date().toISOString());
    } catch (e) {
      lastError = (e && e.message) || String(e);
    } finally {
      running = false; paint();
    }
  }

  // דוחף רק את מה שהשתנה מאז התצלום האחרון
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
        // בנתחים, כדי לא לחרוג ממגבלת גודל בקשה
        for (let i = 0; i < rows.length; i += 200) {
          const { error } = await sb.from(key).upsert(rows.slice(i, i + 200), { onConflict: 'id' });
          if (error) throw error;
        }
      }

      // מה שהיה בתצלום ואיננו עכשיו — נמחק במכשיר
      const gone = Object.keys(prev).filter(id => !seen.has(id));
      if (gone.length) {
        const { error } = await sb.from(key)
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
    for (const key of ARRAYS) {
      const { data, error } = await sb.from(key)
        .select('*').eq('trainer_id', user.id).eq('deleted', false);
      if (error) throw error;
      window.S[key] = (data || []).map(MAP[key].from);
    }
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
    if (typeof window.rawSave === 'function') window.rawSave();
    if (typeof window.render === 'function') window.render();
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
    if (!navigator.onLine) return { state: 'offline', text: 'אין רשת — נסנכרן אח״כ' };
    if (running)         return { state: 'sync',    text: 'מסנכרן…' };
    if (lastError)       return { state: 'error',   text: 'שגיאת סנכרון' };
    const at = localStorage.getItem('ebfit_sync_at');
    return { state: 'ok', text: at ? 'מסונכרן ' + new Date(at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : 'מסונכרן' };
  }

  function paint() {
    const el = document.getElementById('syncPill');
    if (!el) return;
    const s = status();
    el.className = 'syncpill s-' + s.state;
    el.textContent = s.text;
    el.title = lastError || '';
  }

  window.EBSync = {
    init, enabled, schedule, run, status, paint, lastError: () => lastError,
    signIn, signUp, signOut,
    user: () => user,
    traineeLink, setAccess, logsFor
  };
})();

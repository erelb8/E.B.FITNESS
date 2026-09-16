/* =====================================================================
   E.B FIT — גיבוי מלא מהשרת
   ---------------------------------------------------------------------
   הכפתור הקיים "ייצוא גיבוי" מייצא את מצב הדפדפן בלבד. שלושה דברים
   נשארו מחוצה לו והם בדיוק אלה שאי אפשר לשחזר:

     workout_logs   — מה המתאמן דיווח שביצע. נשלף בקריאה נפרדת ולא
                      יושב ב-S בכלל.
     health         — הצהרות הבריאות החתומות. ההגנה המשפטית היחידה
                      אם מתאמן ייפצע ויטען שלא הוזהר.
     weighins       — השקילות שהמתאמן הזין בעצמו.

   הגיבוי כאן נמשך מהשרת ולא מהמכשיר, ולכן הוא כולל גם מה שנכתב
   ממכשירים אחרים ומה שהמתאמנים כתבו בעצמם.

   הוא רץ בתוך האפליקציה, בהרשאות של המאמן המחובר. אין כאן סיסמה,
   אין מפתח נוסף, ואין קובץ הגדרות שצריך לשמור במקום בטוח.

   התוכנית החינמית של Supabase אינה כוללת גיבויים כלל. עד שיש
   כאן קובץ על הדיסק — אין שום עותק של הנתונים.
   ===================================================================== */
(function () {
  'use strict';

  (window.EB_MOD = window.EB_MOD || {})['backup'] = 'v143';

  var LAST_KEY = 'ebfit_backup_at';
  var TABLES = ['trainees', 'sessions', 'measures', 'payments'];

  function lastAt() {
    try { return localStorage.getItem(LAST_KEY) || null; } catch (e) { return null; }
  }
  function daysSince() {
    var a = lastAt();
    if (!a) return null;
    return Math.floor((Date.now() - new Date(a).getTime()) / 86400000);
  }

  function stamp() {
    var d = new Date(), p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
         + '_' + p(d.getHours()) + p(d.getMinutes());
  }

  function save(obj, name) {
    var blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }

  /* ---------- הגיבוי ----------
     האיסוף הופרד מההורדה כדי שהגיבוי האוטומטי יוכל להשתמש באותו
     קוד בדיוק. שני מסלולים שאוספים כל אחד את שלו היו נפרדים ביום
     הראשון ומתפצלים בשקט אחרי החודש הראשון — והגיבוי האוטומטי הוא
     בדיוק זה שאיש לא פותח כדי לבדוק. */
  async function collect(onStep) {
    var sb = EBSync.client && EBSync.client();
    var user = EBSync.user && EBSync.user();

    var out = {
      נוצר: new Date().toISOString(),
      גרסה: (typeof EB_VERSION !== 'undefined' ? EB_VERSION : ''),
      מאמן: user.email || '',
      הערה: 'גיבוי מלא של E.B FIT מהשרת. כולל הצהרות בריאות, שקילות '
           + 'ודיווחי מתאמנים שאינם נמצאים בייצוא המקומי.',
      טבלאות: {}
    };
    var counts = [];

      /* כל טבלה נמשכת בעמודים. בלי זה Supabase מחזיר 1000 שורות
         ראשונות בלבד ושותק — גיבוי חלקי שנראה שלם.

         שגיאה כאן עולה למעלה בכוונה: מי שקרא הוא זה שיודע אם להציג
         אותה למאמן (גיבוי ידני) או לבלוע אותה (אוטומטי). */
      for (var i = 0; i < TABLES.length; i++) {
        var t = TABLES[i], rows = [], from = 0, page = 1000;
        for (;;) {
          var r = await sb.from(t).select('*').range(from, from + page - 1);
          if (r.error) throw new Error(t + ': ' + r.error.message);
          rows = rows.concat(r.data || []);
          if (!r.data || r.data.length < page) break;
          from += page;
        }
        out.טבלאות[t] = rows;
        counts.push(t + ' ' + rows.length);
        if (onStep) onStep(t);
      }

      /* דיווחי המתאמנים — הטבלה שלא נמצאת ב-S ולכן חסרה בייצוא המקומי */
      try {
        var lg = await sb.from('workout_logs').select('*').limit(20000);
        if (!lg.error) {
          out.טבלאות.workout_logs = lg.data || [];
          counts.push('דיווחים ' + (lg.data || []).length);
        }
      } catch (e) {}

      /* העדפות המאמן */
      try {
        var pf = await sb.from('trainer_prefs').select('*');
        if (!pf.error) out.טבלאות.trainer_prefs = pf.data || [];
      } catch (e) {}

      /* רשימת הקבצים — לא התוכן. הקבצים עצמם נשמרים בנפרד, כי
         הטמעתם בבסיס 64 הייתה מנפחת את הקובץ פי עשרה. */
      var files = [];
      (out.טבלאות.trainees || []).forEach(function (tr) {
        (tr.files || []).forEach(function (f) {
          files.push({ מתאמן: tr.name, שם: f.name || '', כתובת: f.url || '' });
        });
      });
      out.קבצים = files;

      /* המצב המקומי, כרשת ביטחון שנייה */
      out.מצב_מקומי = (typeof S !== 'undefined') ? S : null;

      out._counts = counts;
      return out;
  }

  /* ---------- גיבוי ידני: אוסף ומוריד ---------- */
  async function run() {
    if (!window.EBSync || !EBSync.enabled()) {
      toast('הסנכרון לא מוגדר — אין מה לגבות מהשרת'); return;
    }
    if (!(EBSync.client && EBSync.client()) || !(EBSync.user && EBSync.user())) {
      toast('צריך להתחבר לסנכרון קודם'); return;
    }
    var btn = document.getElementById('bk_run');
    if (btn) { btn.disabled = true; btn.textContent = 'מגבה…'; }
    try {
      var out = await collect(function (t) { if (btn) btn.textContent = 'מגבה… ' + t; });
      var counts = out._counts || []; delete out._counts;
      save(out, 'ebfit-גיבוי-' + stamp() + '.json');
      try { localStorage.setItem(LAST_KEY, new Date().toISOString()); } catch (e) {}
      toast('הגיבוי ירד — ' + counts.join(' · '));
      if (typeof render === 'function') render();
    } catch (e) {
      toast('הגיבוי נכשל: ' + ((e && e.message) || 'שגיאה'));
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'גיבוי מלא עכשיו'; }
    }
  }

  /* =====================================================================
     גיבוי אוטומטי יומי
     ---------------------------------------------------------------------
     הגיבוי הידני עבד, אבל הוא תלוי בזיכרון של המאמן — ודווקא בימים
     העמוסים, שבהם משתנה הכי הרבה, איש לא לוחץ עליו. ב-15.9.2026
     גיבוי מלפני שעות הציל מתאמנת שנמחקה, ובאותו יום תוכנית שלמה
     אבדה כי לא היה שום עותק שלה בשום מקום.

     האוטומטי לא מוריד קובץ: הורדה יומית הייתה מציפה את תיקיית
     ההורדות, והדפדפן חוסם הורדה שלא יזם אותה אדם. במקום זה הוא
     נשמר במכשיר, ושומר את שבעת האחרונים.

     ב-IndexedDB ולא ב-localStorage: גיבוי אחד שוקל כ-370KB, ושבעה
     כאלה חורגים מהמכסה של localStorage וגם היו מסכנים את S עצמו —
     כלומר גיבוי שמסכן את מה שהוא בא להגן עליו.

     הוא אינו תחליף לגיבוי הידני. עותק שיושב באותו דפדפן נעלם יחד
     עם הדפדפן — ניקוי נתוני אתר, מחשב שנגנב, דיסק שמת. הוא מכסה
     את המקרה השכיח, שהוא טעות אנוש, ולא את המקרה שבו המכשיר עצמו
     איננו. לכן הכרטיס ממשיך לדרוש גיבוי ידני לדיסק ולענן. */
  var DB_NAME = 'ebfit_backups', STORE = 'snaps', KEEP = 7;
  var AUTO_KEY = 'ebfit_autobackup_on';     // תאריך היום שבו כבר רץ

  function openDB() {
    return new Promise(function (res, rej) {
      if (!window.indexedDB) return rej(new Error('אין IndexedDB'));
      var rq = indexedDB.open(DB_NAME, 1);
      rq.onupgradeneeded = function () {
        var db = rq.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'at' });
      };
      rq.onsuccess = function () { res(rq.result); };
      rq.onerror = function () { rej(rq.error || new Error('IndexedDB נכשל')); };
    });
  }
  function tx(db, mode) { return db.transaction(STORE, mode).objectStore(STORE); }
  function asPromise(rq) {
    return new Promise(function (res, rej) {
      rq.onsuccess = function () { res(rq.result); };
      rq.onerror = function () { rej(rq.error); };
    });
  }

  async function listSnaps() {
    try {
      var db = await openDB();
      var all = await asPromise(tx(db, 'readonly').getAll());
      db.close();
      return (all || []).sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); });
    } catch (e) { return []; }
  }
  async function getSnap(at) {
    try {
      var db = await openDB();
      var one = await asPromise(tx(db, 'readonly').get(at));
      db.close();
      return one || null;
    } catch (e) { return null; }
  }
  async function putSnap(rec) {
    var db = await openDB();
    await asPromise(tx(db, 'readwrite').put(rec));
    /* גיזום מיד אחרי הכתיבה, ולא בהזדמנות אחרת: מכסת האחסון נבדקת
       בכתיבה הבאה, ואם לא גוזמים כאן הכתיבה הבאה היא שתיכשל. */
    var all = await asPromise(tx(db, 'readonly').getAll());
    var keys = (all || []).map(function (r) { return r.at; })
                          .sort(function (a, b) { return String(b).localeCompare(String(a)); });
    var st = tx(db, 'readwrite');
    keys.slice(KEEP).forEach(function (k) { st.delete(k); });
    db.close();
  }
  async function dropSnap(at) {
    try {
      var db = await openDB();
      await asPromise(tx(db, 'readwrite').delete(at));
      db.close();
    } catch (e) {}
  }

  function ranToday() {
    try { return localStorage.getItem(AUTO_KEY) === new Date().toDateString(); }
    catch (e) { return false; }
  }

  /* רץ פעם ביום, בשקט. כישלון אינו מוצג למאמן — הוא לא ביקש את
     הריצה הזאת, והכרטיס בהגדרות כבר אומר מתי הגיבוי האחרון ירד. */
  async function auto() {
    try {
      if (ranToday()) return;
      if (!window.EBSync || !EBSync.enabled()) return;
      if (!(EBSync.client && EBSync.client()) || !(EBSync.user && EBSync.user())) return;
      if (!navigator.onLine) return;

      var out = await collect();
      var counts = out._counts || []; delete out._counts;

      /* גיבוי ריק אינו גיבוי. שמירתו הייתה דוחקת עותק תקין מהתור
         של שבעת האחרונים — כלומר הורסת בדיוק את מה שבאנו לשמור. */
      if (!((out.טבלאות || {}).trainees || []).length) return;

      await putSnap({
        at: new Date().toISOString(),
        מתאמנים: (out.טבלאות.trainees || []).length,
        פירוט: counts.join(' · '),
        גודל: JSON.stringify(out).length,
        data: out
      });
      try { localStorage.setItem(AUTO_KEY, new Date().toDateString()); } catch (e) {}
      if (typeof render === 'function') render();
    } catch (e) {
      if (window.console) console.warn('[EBBackup] גיבוי אוטומטי נכשל', e);
    }
  }

  // הורדת עותק אוטומטי כקובץ, כדי שיישמר מחוץ לדפדפן
  async function download(at) {
    var rec = await getSnap(at);
    if (!rec || !rec.data) { toast('העותק לא נמצא'); return; }
    save(rec.data, 'ebfit-גיבוי-' + String(at).slice(0, 16).replace(/[:T]/g, '-') + '.json');
    try { localStorage.setItem(LAST_KEY, new Date().toISOString()); } catch (e) {}
    toast('העותק ירד');
    if (typeof render === 'function') render();
  }

  /* שחזור מעותק אוטומטי — עובר דרך אותו מייבא של הגיבוי הידני,
     כולל אזהרותיו. אין כאן מסלול שחזור שני. */
  async function restore(at) {
    var rec = await getSnap(at);
    if (!rec || !rec.data) { toast('העותק לא נמצא'); return; }
    if (typeof window.applyBackup !== 'function') { toast('המייבא לא זמין'); return; }
    window.applyBackup(rec.data);
  }

  // נקרא מ-index.html אחרי שהמסך עלה
  var AUTO_HTML = '';
  async function refreshAuto() {
    var list = await listSnaps();
    AUTO_HTML = autoHTML(list);
    if (typeof render === 'function') render();
  }
  function autoHTML(list) {
    if (!list.length) {
      return '<div class="muted" style="font-size:12px;margin-top:10px;line-height:1.6">'
        + 'גיבוי אוטומטי יומי פעיל. העותק הראשון ייווצר בפעם הבאה שהאפליקציה '
        + 'תיפתח עם חיבור לשרת.</div>';
    }
    var kb = function (n) { return Math.round(n / 1024) + ' KB'; };
    return '<div class="sep" style="margin:12px 0"></div>'
      + '<div style="font-family:Heebo;font-weight:700;font-size:13.5px;margin-bottom:6px">'
      + 'עותקים אוטומטיים במכשיר (' + list.length + ' מתוך ' + KEEP + ')</div>'
      + list.map(function (r) {
          var d = new Date(r.at);
          var p = function (n) { return String(n).padStart(2, '0'); };
          var when = p(d.getDate()) + '.' + p(d.getMonth() + 1) + ' · ' + p(d.getHours()) + ':' + p(d.getMinutes());
          return '<div class="line-item" style="align-items:center;gap:8px;padding:6px 0">'
            + '<span style="flex:1;font-size:13px">' + esc(when)
            + '<span class="muted" style="font-size:11.5px"> · ' + r.מתאמנים + ' מתאמנים · '
            + kb(r.גודל || 0) + '</span></span>'
            + '<button class="btn sm ghost" onclick="EBBackup.download(\'' + esc(r.at) + '\')">הורדה</button>'
            + '<button class="btn sm ghost" onclick="EBBackup.restore(\'' + esc(r.at) + '\')">שחזור</button>'
            + '</div>';
        }).join('')
      + '<div class="muted" style="font-size:11.5px;margin-top:8px;line-height:1.6">'
      + 'העותקים האלה יושבים בדפדפן הזה בלבד. ניקוי נתוני אתר או מחשב שאבד '
      + 'מוחק אותם יחד איתו — ולכן הם אינם מחליפים גיבוי לדיסק ולענן.</div>';
  }

  /* ---------- הכרטיס בהגדרות ---------- */
  function card() {
    var d = daysSince(), a = lastAt();
    var warn = (d === null || d > 7);
    var c = warn ? '#C0392B' : '#1E8449';

    return '<div class="card" style="border-color:' + c + '44;background:' + c + '0D">'
      + '<div class="row" style="margin-bottom:6px">'
      + '<h3 style="flex:1;font-size:15px">גיבוי</h3>'
      + '<span style="font-weight:800;font-size:12.5px;color:' + c + '">'
      + (a ? (d === 0 ? 'היום' : 'לפני ' + d + ' ימים') : 'מעולם לא') + '</span></div>'
      + '<div class="muted" style="font-size:13px;line-height:1.6;margin-bottom:12px">'
      + (warn
          ? '<b style="color:' + c + '">התוכנית החינמית של Supabase אינה מגבה כלום.</b> '
            + 'עד שיורד קובץ למחשב — אין שום עותק של הנתונים.'
          : 'הגיבוי האחרון ירד ' + esc(fmtFull(String(a).slice(0, 10))) + '.')
      + '</div>'
      + '<button class="btn" id="bk_run" onclick="EBBackup.run()">גיבוי מלא עכשיו</button>'
      + '<div class="muted" style="font-size:11.5px;margin-top:10px;line-height:1.6">'
      + 'נמשך מהשרת ולא מהמכשיר, ולכן כולל גם הצהרות בריאות, שקילות שהמתאמנים '
      + 'הזינו ודיווחי ביצוע — שלושתם אינם נמצאים בייצוא המקומי. '
      + 'לשמור בשני מקומות: כונן חיצוני וענן.</div>'
      + AUTO_HTML
      + '</div>';
  }

  window.EBBackup = { run: run, card: card, lastAt: lastAt, daysSince: daysSince,
                      auto: auto, refreshAuto: refreshAuto, list: listSnaps,
                      download: download, restore: restore };
})();

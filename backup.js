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

  (window.EB_MOD = window.EB_MOD || {})['backup'] = 'v70';

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

  /* ---------- הגיבוי ---------- */
  async function run() {
    if (!window.EBSync || !EBSync.enabled()) {
      toast('הסנכרון לא מוגדר — אין מה לגבות מהשרת'); return;
    }
    var sb = EBSync.client && EBSync.client();
    var user = EBSync.user && EBSync.user();
    if (!sb || !user) { toast('צריך להתחבר לסנכרון קודם'); return; }

    var btn = document.getElementById('bk_run');
    if (btn) { btn.disabled = true; btn.textContent = 'מגבה…'; }

    var out = {
      נוצר: new Date().toISOString(),
      גרסה: (typeof EB_VERSION !== 'undefined' ? EB_VERSION : ''),
      מאמן: user.email || '',
      הערה: 'גיבוי מלא של E.B FIT מהשרת. כולל הצהרות בריאות, שקילות '
           + 'ודיווחי מתאמנים שאינם נמצאים בייצוא המקומי.',
      טבלאות: {}
    };
    var counts = [];

    try {
      /* כל טבלה נמשכת בעמודים. בלי זה Supabase מחזיר 1000 שורות
         ראשונות בלבד ושותק — גיבוי חלקי שנראה שלם. */
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
        if (btn) btn.textContent = 'מגבה… ' + t;
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
      + '</div>';
  }

  window.EBBackup = { run: run, card: card, lastAt: lastAt, daysSince: daysSince };
})();

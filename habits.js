/* =====================================================================
   E.B FIT — הרגלים יומיים: מוביליטי ותזונה
   ---------------------------------------------------------------------
   אימון נרשם פעמיים-שלוש בשבוע ויש לו דיווח מלא. מתיחות ותזונה הם
   דבר אחר לגמרי: הם קורים כל יום, לוקחים חמש שניות לסמן, ואין להם
   מה להיכנס ל-workout_logs — דיווח אימון על מתיחת ארבע ראשי היה
   מנפח את הגרף ואת חישובי הנפח של המאמן החכם.

   לכן הסימונים יושבים ב-session_state, אותו בלוב jsonb חופשי
   שכבר נשמר היום לטיוטת האימון. אין טבלה חדשה ואין RPC חדש —
   ולכן גם אין סקריפט SQL שצריך להריץ על השרת לפני שזה עובד.

   שני מקורות למתיחות, וזו דרישה מפורשת:
     program.mobility  — מה שהמאמן בנה למתאמן הזה
     habits.own        — מה שהמתאמן הוסיף לעצמו
   שניהם מופיעים באותה רשימה ומסומנים אותו דבר. המקור נשמר בשדה
   mine, כדי שהמתאמן יוכל למחוק רק את שלו ולא את של המאמן.

   ---------------------------------------------------------------------
   תקרת הגודל: trainee_save_state חוסם מעל 60,000 תווים, ואת הבלוב
   הזה חולקים עם טיוטת האימון. סימון יומי שנשמר לנצח מגיע לשם — לכן
   prune() מוחק מה שישן מ-KEEP_DAYS. היסטוריה ארוכה יותר אינה נחוצה:
   מה שהמאמן החכם שואל הוא "מה קרה בשבועות האחרונים".
   ===================================================================== */
(function () {
  'use strict';

  (window.EB_MOD = window.EB_MOD || {})['habits'] = 'v104';

  var KEEP_DAYS = 120;
  var KINDS = ['mob', 'food'];

  function dayMs() { return 86400000; }

  /* תאריך מקומי ולא ISO של UTC. מתאמן שמסמן בעשר בלילה בקיץ נמצא
     כבר במחר לפי UTC, והסימון היה נופל על היום הלא נכון. */
  function localISO(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
         + '-' + String(d.getDate()).padStart(2, '0');
  }
  function todayISO() { return localISO(new Date()); }

  function shiftISO(iso, back) {
    var t = new Date(String(iso).slice(0, 10) + 'T00:00').getTime();
    if (!isFinite(t)) return null;
    return localISO(new Date(t - back * dayMs()));
  }

  /* מזהה יציב לפריט מוביליטי. שם התרגיל הוא המזהה: הוא מה שהמתאמן
     רואה, והוא שורד שינוי סדר ברשימה. אינדקס לא היה שורד — המאמן
     מוסיף מתיחה באמצע והסימונים של אתמול היו זזים לפריט אחר. */
  function idOf(name) {
    return String(name == null ? '' : name).trim().toLowerCase().replace(/\s+/g, ' ');
  }

  /* ---------- קריאה ונרמול ----------
     כל מה שנכנס כאן מגיע מהשרת או מ-localStorage, כלומר יכול להיות
     כל דבר. מבנה שבור לא אמור להפיל את הדף, ולכן כל שדה נבדק. */
  function normalize(raw) {
    var h = (raw && typeof raw === 'object') ? raw : {};
    var own = [];
    if (Array.isArray(h.own)) {
      h.own.forEach(function (x) {
        var name = x && typeof x === 'object' ? x.name : x;
        name = String(name == null ? '' : name).trim();
        if (!name) return;
        if (own.some(function (o) { return o.id === idOf(name); })) return;
        own.push({ id: idOf(name), name: name });
      });
    }
    var marks = {};
    if (h.marks && typeof h.marks === 'object') {
      Object.keys(h.marks).forEach(function (iso) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return;
        var src = h.marks[iso];
        if (!src || typeof src !== 'object') return;
        var day = {};
        /* קבוצה שכל ערכיה נפסלו חייבת להיעלם ולא להישאר כשלד ריק:
           יום עם mob:{} היה נספר כיום קיים ונשמר לנצח. */
        var mob   = (src.mob   && typeof src.mob   === 'object') ? objOfTrue(src.mob)   : {};
        var meals = (src.meals && typeof src.meals === 'object') ? objOfTrue(src.meals) : {};
        if (Object.keys(mob).length)   day.mob   = mob;
        if (Object.keys(meals).length) day.meals = meals;
        if (src.food === true) day.food = true;
        if (Object.keys(day).length) marks[iso] = day;
      });
    }
    return { own: own, marks: marks };
  }
  function objOfTrue(o) {
    var out = {};
    Object.keys(o).forEach(function (k) { if (o[k] === true) out[k] = true; });
    return out;
  }

  /* ---------- הרשימה שהמתאמן רואה ----------
     של המאמן קודם, ואחריה של המתאמן. פריט שהמתאמן הוסיף ואחר כך
     המאמן הוסיף באותו שם מופיע פעם אחת, כשל המאמן — אחרת היו שתי
     שורות זהות עם שני סימונים נפרדים. */
  function items(program, own) {
    var out = [], seen = {};
    var mob = (program && Array.isArray(program.mobility)) ? program.mobility : [];
    mob.forEach(function (m) {
      var name = String((m && typeof m === 'object' ? m.name : m) || '').trim();
      if (!name || seen[idOf(name)]) return;
      seen[idOf(name)] = true;
      out.push({ id: idOf(name), name: name,
                 note: String((m && m.note) || '').trim(), mine: false });
    });
    (own || []).forEach(function (o) {
      if (!o || !o.name || seen[o.id]) return;
      seen[o.id] = true;
      out.push({ id: o.id, name: o.name, note: '', mine: true });
    });
    return out;
  }

  /* ---------- סימון ----------
     מחזיר את האובייקט עצמו אחרי שינוי. המתאמן מסמן ומיד נשמר,
     ולכן אין כאן מצב ביניים שצריך לאשר. */
  function mark(habits, iso, kind, id, on) {
    var h = habits || { own: [], marks: {} };
    h.marks = h.marks || {};
    var day = h.marks[iso] = h.marks[iso] || {};
    if (kind === 'food' && id == null) {
      if (on) day.food = true; else delete day.food;
    } else {
      var bag = kind === 'meals' ? 'meals' : 'mob';
      day[bag] = day[bag] || {};
      if (on) day[bag][id] = true; else delete day[bag][id];
      if (!Object.keys(day[bag]).length) delete day[bag];
    }
    if (!Object.keys(day).length) delete h.marks[iso];
    return h;
  }
  function isMarked(habits, iso, kind, id) {
    var day = ((habits || {}).marks || {})[iso];
    if (!day) return false;
    if (kind === 'food' && id == null) return day.food === true;
    var bag = kind === 'meals' ? day.meals : day.mob;
    return !!(bag && bag[id] === true);
  }

  /* ---------- האם היום "נסגר" ----------
     מוביליטי: מספיקה מתיחה אחת. הרעיון הוא שהמתאמן יתמתח, לא שיסמן
     את כל הרשימה — ומי שדורש רשימה מלאה מקבל מתאמן שמפסיק לסמן.

     תזונה: או הסימון היומי הכללי, או ארוחה אחת מהתפריט. שתי הדרכים
     נחשבות, כי למתאמן בלי תפריט מוגדר אין ארוחות לסמן בכלל. */
  function dayDone(habits, iso, kind) {
    var day = ((habits || {}).marks || {})[iso];
    if (!day) return false;
    if (kind === 'mob') return !!(day.mob && Object.keys(day.mob).length);
    return day.food === true || !!(day.meals && Object.keys(day.meals).length);
  }

  /* שורת הימים האחרונים, ישן משמאל וחדש מימין — כמו dailyTrack
     של המאמן החכם, כדי ששתי השורות ייראו אותו דבר בדף. */
  function week(habits, kind, days) {
    days = days || 7;
    var out = [], now = new Date();
    for (var i = days - 1; i >= 0; i--) {
      var d = new Date(now.getTime() - i * dayMs());
      var iso = localISO(d);
      out.push({ date: iso, wd: d.getDay(), done: dayDone(habits, iso, kind) });
    }
    return out;
  }

  function adherence(habits, kind, days) {
    days = days || 7;
    var w = week(habits, kind, days);
    var done = w.filter(function (x) { return x.done; }).length;
    return { done: done, of: days, pct: Math.round(done / days * 100) };
  }

  /* רצף ימים. היום שטרם סומן אינו שובר — בשבע בבוקר עוד לא התמתחת,
     וזה לא אומר שהרצף נגמר. לכן הספירה מתחילה מאתמול אם היום ריק. */
  function streak(habits, kind) {
    var start = dayDone(habits, todayISO(), kind) ? 0 : 1;
    var n = 0;
    for (var i = start; i < KEEP_DAYS; i++) {
      if (!dayDone(habits, shiftISO(todayISO(), i), kind)) break;
      n++;
    }
    return n;
  }

  /* ---------- ניקוי ----------
     גם הסימונים הישנים וגם ימים ריקים. בלי זה הבלוב גדל בלי גבול
     ובשלב מסוים trainee_save_state מסרב לשמור — והמתאמן לא היה
     מקבל שום הודעת שגיאה, רק מפסיק להישמר בשקט. */
  function prune(habits, keepDays) {
    var keep = keepDays || KEEP_DAYS;
    var h = habits || { own: [], marks: {} };
    var cut = shiftISO(todayISO(), keep);
    Object.keys(h.marks || {}).forEach(function (iso) {
      if (iso < cut) delete h.marks[iso];
    });
    return h;
  }

  /* ---------- מיזוג בין מכשירים ----------
     המתאמן מסמן מהטלפון בבוקר ומהטאבלט בערב. "מי שכתב אחרון מנצח"
     היה מוחק לו את חצי השבוע, ולכן הסימונים מתאחדים: סימון הוא
     עובדה שקרתה, ואיחוד שני מקורות אינו יכול להמציא יום שלא סומן.

     ביטול סימון הוא המחיר — הוא לא עובר בין מכשירים. זו הטעות
     הפחות גרועה מהשתיים: וי מיותר עדיף על שבוע שנמחק. */
  function merge(local, remote) {
    var a = normalize(local), b = normalize(remote);
    b.own.forEach(function (o) {
      if (!a.own.some(function (x) { return x.id === o.id; })) a.own.push(o);
    });
    Object.keys(b.marks).forEach(function (iso) {
      var src = b.marks[iso], dst = a.marks[iso] = a.marks[iso] || {};
      if (src.food === true) dst.food = true;
      ['mob', 'meals'].forEach(function (bag) {
        if (!src[bag]) return;
        dst[bag] = dst[bag] || {};
        Object.keys(src[bag]).forEach(function (k) { dst[bag][k] = true; });
      });
    });
    return a;
  }

  /* האם יש כאן משהו בכלל. מבדיל בין "מתאמן חדש" לבין "כבר סימן" */
  function isEmpty(habits) {
    var h = habits || {};
    return !((h.own || []).length) && !Object.keys(h.marks || {}).length;
  }

  window.EBHabits = {
    merge: merge, isEmpty: isEmpty,
    KINDS: KINDS, KEEP_DAYS: KEEP_DAYS,
    todayISO: todayISO, localISO: localISO, shiftISO: shiftISO, idOf: idOf,
    normalize: normalize, items: items,
    mark: mark, isMarked: isMarked, dayDone: dayDone,
    week: week, adherence: adherence, streak: streak, prune: prune
  };
})();

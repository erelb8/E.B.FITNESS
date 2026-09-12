/* =====================================================================
   E.B FIT — יעדים יומיים, כולל יעד שונה לכל יום בשבוע
   ---------------------------------------------------------------------
   שלוש שכבות, מהחלשה לחזקה:
     1. החישוב האוטומטי לפי משקל, גובה, גיל ומטרה   (program.targets)
     2. דריסה ידנית קבועה לכל השבוע                  (targetsOverride)
     3. דריסה ידנית ליום מסוים בשבוע                 (targetsByDay)

   למה יום בשבוע ולא יום בתוכנית: היעד התזונתי נשאל בכל בוקר מחדש
   ("כמה אני אוכל היום"), והמתאמן חי בימי השבוע. יום אימון רגליים
   ויום מנוחה דורשים מספרים שונים, וזו בדיוק הסיבה שהמאמן מבקש את זה.

   הקובץ נטען בשני הצדדים — גם באפליקציית הניהול וגם בדף המתאמן —
   כדי שהמיזוג ייעשה במקום אחד. שתי גרסאות של אותו חישוב בשני קבצים
   הן הדרך הבטוחה לכך שהמאמן יראה מספר אחד והמתאמן אחר.
   ===================================================================== */
(function () {
  'use strict';

  (window.EB_MOD = window.EB_MOD || {})['targets'] = 'v104';

  var KEYS = ['kcal', 'protein', 'carbs', 'fat', 'water', 'steps'];
  var DAY_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

  function num(v) {
    if (v === '' || v === null || v === undefined) return null;
    var n = Number(v);
    return isFinite(n) && n > 0 ? n : null;
  }

  /* יום בשבוע מתאריך. מחרוזת ISO נקראת כחצות מקומית ולא כ-UTC:
     new Date('2026-09-12') הוא חצות UTC, שבישראל הוא עדיין ה-11
     בלילה — והיעד של שבת היה מוצג ביום שישי. */
  function weekdayOf(date) {
    var d;
    if (date instanceof Date) d = date;
    else if (typeof date === 'string' && date) d = new Date(String(date).slice(0, 10) + 'T00:00');
    else d = new Date();
    var wd = d.getDay();
    return isFinite(wd) ? wd : new Date().getDay();
  }

  function dayName(wd) { return DAY_HE[wd] || ''; }

  /* הדריסות של יום מסוים, אחרי ניקוי ערכים לא תקינים */
  function dayOverrides(program, wd) {
    var map = (program || {}).targetsByDay || {};
    var raw = map[String(wd)] || map[wd] || null;
    if (!raw) return null;
    var out = null;
    KEYS.forEach(function (k) {
      var v = num(raw[k]);
      if (v !== null) { out = out || {}; out[k] = v; }
    });
    return out;
  }

  /* היעד בפועל ליום נתון.
     מחזיר null כשאין שום יעד — לא אובייקט ריק, כדי שהקורא יוכל
     להחליט אם להסתיר את הכרטיס לגמרי. */
  function forDay(program, date) {
    var base = (program || {}).targets || null;
    var wd = weekdayOf(date);
    var ov = dayOverrides(program, wd);
    if (!base && !ov) return null;

    var values = {};
    if (base) Object.keys(base).forEach(function (k) {
      var v = base[k];
      if (v !== null && v !== undefined && v !== '') values[k] = v;
    });

    var overridden = [];
    if (ov) Object.keys(ov).forEach(function (k) {
      values[k] = ov[k];
      overridden.push(k);
    });

    if (!Object.keys(values).length) return null;
    return { values: values, wd: wd, dayName: dayName(wd), overridden: overridden };
  }

  /* אילו ימים בשבוע נושאים יעד משלהם — לסימון בממשק המאמן */
  function daysWithOverride(program) {
    var out = [];
    for (var wd = 0; wd < 7; wd++) if (dayOverrides(program, wd)) out.push(wd);
    return out;
  }

  /* כתיבה. ערך ריק מוחק את הדריסה ומחזיר את היום לבסיס, ויום ריק
     נמחק מהמפה כולה — אחרת נשארות רשומות ריקות שמסתנכרנות לשרת
     ומופיעות בממשק כ"יום עם יעד משלו" בלי שום מספר בתוכו. */
  function setDayValue(program, wd, key, value) {
    if (!program || KEYS.indexOf(key) === -1) return program;
    var map = program.targetsByDay = program.targetsByDay || {};
    var k = String(wd);
    var row = map[k] = map[k] || {};
    var v = num(value);
    if (v === null) delete row[key]; else row[key] = v;
    if (!Object.keys(row).length) delete map[k];
    if (!Object.keys(map).length) delete program.targetsByDay;
    return program;
  }

  function clearDay(program, wd) {
    if (!program || !program.targetsByDay) return program;
    delete program.targetsByDay[String(wd)];
    if (!Object.keys(program.targetsByDay).length) delete program.targetsByDay;
    return program;
  }

  window.EBTargets = {
    KEYS: KEYS, DAY_HE: DAY_HE,
    weekdayOf: weekdayOf, dayName: dayName,
    dayOverrides: dayOverrides, forDay: forDay,
    daysWithOverride: daysWithOverride,
    setDayValue: setDayValue, clearDay: clearDay
  };
})();

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

  (window.EB_MOD = window.EB_MOD || {})['targets'] = 'v171';

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

  /* ---------- ערך: מספר או טווח ----------
     מאמן שכותב "2100-2300" מתכוון לטווח, ולא לפספס אם חרג ב-50
     קלוריות. עד היום num() דחה כל דבר שאינו מספר, והטווח נמחק
     בשקט בשמירה הבאה.

     הערך נשמר כמחרוזת כשהוא טווח וכמספר כשהוא יחיד, כדי שתוכניות
     קיימות לא ישתנו כלל. כל מי שצריך מספר בודד להשוואה מקבל את
     האמצע — זה גם מה שמאמן מתכוון אליו כשהוא נותן טווח.

     המקף מתקבל בשלוש צורותיו: רגיל, קו מפריד, ומקף עברי. */
  var DASH = /[-–—]/;
  function parseVal(v) {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'number') return isFinite(v) && v > 0 ? { lo:v, hi:v, mid:v, range:false } : null;
    var s = String(v).trim().replace(/,/g, '');
    if (!s) return null;
    if (DASH.test(s)) {
      var parts = s.split(DASH).map(function (x) { return Number(String(x).trim()); });
      if (parts.length === 2 && parts.every(function (n) { return isFinite(n) && n > 0; })) {
        var lo = Math.min(parts[0], parts[1]), hi = Math.max(parts[0], parts[1]);
        /* טווח שבו שני הקצוות זהים אינו טווח */
        if (lo === hi) return { lo:lo, hi:hi, mid:lo, range:false };
        return { lo:lo, hi:hi, mid:Math.round((lo+hi)/2), range:true };
      }
      return null;
    }
    var n = Number(s);
    return isFinite(n) && n > 0 ? { lo:n, hi:n, mid:n, range:false } : null;
  }

  /* הצורה שנשמרת: מספר ליחיד, מחרוזת מנורמלת לטווח */
  function normVal(v) {
    var p = parseVal(v);
    if (!p) return null;
    return p.range ? (p.lo + '-' + p.hi) : p.mid;
  }

  /* הצורה שמוצגת. המקף הוא קו מפריד ולא מינוס. */
  function fmtVal(v) {
    var p = parseVal(v);
    if (!p) return '';
    return p.range ? (p.lo + '–' + p.hi) : String(p.mid);
  }

  /* מספר בודד להשוואות ולחישובים */
  function midVal(v) { var p = parseVal(v); return p ? p.mid : null; }

  /* האם ערך שנמדד נמצא בתוך היעד. בטווח — בין הקצוות ועד כולל.
     ביחיד — סטייה של עד 5% נחשבת עמידה, אחרת כל מספר הוא פספוס. */
  function inTarget(measured, target) {
    var p = parseVal(target), m = Number(measured);
    if (!p || !isFinite(m)) return null;
    if (p.range) return m >= p.lo && m <= p.hi;
    return Math.abs(m - p.mid) <= p.mid * 0.05;
  }


  /* הדריסות של יום מסוים, אחרי ניקוי ערכים לא תקינים */
  function dayOverrides(program, wd) {
    var map = (program || {}).targetsByDay || {};
    var raw = map[String(wd)] || map[wd] || null;
    if (!raw) return null;
    var out = null;
    KEYS.forEach(function (k) {
      var v = normVal(raw[k]);
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
    var v = normVal(value);
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
    setDayValue: setDayValue, clearDay: clearDay,
    parseVal: parseVal, normVal: normVal, fmtVal: fmtVal,
    midVal: midVal, inTarget: inTarget
  };
})();

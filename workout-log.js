/* =====================================================================
   E.B FIT — יומן האימונים של המתאמן
   ---------------------------------------------------------------------
   עד כאן הדיווח ישב בתוך תוכנית האימון: המתאמן פתח יום, סימן תרגילים
   ולחץ "סיימתי". זה עבד, אבל ערבב שני דברים שונים — מה הוא *אמור*
   לעשות, ומה הוא *עשה בפועל*. התוכנית היא מסמך שהמאמן כותב; היומן
   הוא מה שקרה בחדר הכושר. לכן היומן עומד כאן בפני עצמו.

   מה שנשמר לכל סט, ולא רק לכל תרגיל:
     entries[i].setLog = [{w, r}, ...]
   השדות הישנים weight ו-reps נשארים ומחזיקים את הסט הכבד ביותר, כי
   coach-bot.js קורא אותם ישירות. בלי זה כל ההיסטוריה של המאמן החכם
   הייתה נקטעת ביום שהיומן עולה לאוויר.

   אין כאן SQL חדש: trainee_log כבר מקבל entries כ-jsonb חופשי,
   ו-setLog נכנס פנימה בלי לגעת בשרת.
   ===================================================================== */
(function () {
  'use strict';

  (window.EB_MOD = window.EB_MOD || {})['wlog'] = 'v255';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function num(v) { var n = Number(v); return isFinite(n) && n > 0 ? n : null; }
  function r1(x) { return Math.round(x * 10) / 10; }

  /* תאריך מקומי ולא toISOString: ב-UTC חצות בישראל היא עדיין אתמול,
     והיומן היה מציג אימון של הערב כאילו נעשה יום קודם. */
  function localISO(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
         + '-' + String(d.getDate()).padStart(2, '0');
  }
  function dayGap(iso) {
    var a = new Date(String(iso).slice(0, 10) + 'T00:00').getTime();
    var b = new Date(localISO() + 'T00:00').getTime();
    if (!isFinite(a)) return null;
    return Math.round((b - a) / 86400000);
  }

  /* ---------- איזה יום להציע היום ----------
     לא "היום הבא ברשימה" אלא היום שהכי מזמן לא אומן. מי שמדלג על
     יום רגליים שבועיים ברציפות יקבל אותו כהצעה, במקום להמשיך
     להתגלגל בין החזה והגב. */
  /* ---------- מה נחשב תרגיל ----------
     בתוכניות האמיתיות נמצאו שורות שאינן תרגיל: הנחיות שייבוא או
     "התאמה למטרה" הפכו לתרגיל ("שינה", "היד", "·" עם הערה), שורות
     ריקות שנוספו ולא מולאו, וימים ריקים ("יום D" עד "יום N").
     אצל המתאמן הן הופיעו ככרטיס עם תיבת סימון, נספרו בהתקדמות,
     וחסמו את "סיימתי" — כי אי אפשר לסמן את "שינה" כבוצע.

     הערה: שורה עם שם ובלי סטים, חזרות ומשקל, אבל עם הערה — או שורה
     ששמה רק נקודה או קו. שורה עם שם בלבד היא תרגיל שהמאמן שכח
     למלא, ולכן נשארת תרגיל. */
  var DOT = /^[\s·•\-–—.]*$/;
  function isInfo(e) {
    e = e || {};
    var n = String(e.name || '').trim();
    var note = String(e.note || '').trim();
    if (DOT.test(n)) return !!note;
    return !String(e.sets || '').trim() && !String(e.reps || '').trim()
        && !String(e.weight || '').trim() && !!note;
  }
  function isReal(e) {
    e = e || {};
    return !DOT.test(String(e.name || '').trim()) && !isInfo(e);
  }
  function realCount(day) {
    return ((day || {}).exercises || []).filter(isReal).length;
  }

  function suggestDay(program, logs) {
    var days = ((program || {}).days || []);
    if (!days.length) return 0;
    var firstReal = -1;
    days.forEach(function (d, i) { if (firstReal < 0 && realCount(d)) firstReal = i; });
    var lastByName = {};
    (logs || []).forEach(function (l) {
      var k = String(l.day_name || l.dayName || '').trim();
      var d = String(l.date || '').slice(0, 10);
      if (!k || !d) return;
      if (!lastByName[k] || d > lastByName[k]) lastByName[k] = d;
    });
    var bestIdx = Math.max(0, firstReal), bestAge = -1;
    days.forEach(function (d, i) {
      if (firstReal > -1 && !realCount(d)) return;   // יום ריק לא מוצע
      var name = String(d.name || ('יום ' + (i + 1))).trim();
      var last = lastByName[name];
      var age = last ? (dayGap(last) || 0) : 9999;   // מעולם לא אומן — ראשון בתור
      if (age > bestAge) { bestAge = age; bestIdx = i; }
    });
    return bestIdx;
  }

  /* ---------- הסטים של תרגיל ----------
     מספר הסטים מגיע מהתוכנית ("3" או "3-4"), ומי שכתב טקסט חופשי
     מקבל שלושה. יותר משמונה סטים לתרגיל אינו מצב אמיתי אלא שגיאת
     הקלדה, ומסך עם 40 שדות אינו שמיש. */
  function setCount(ex) {
    var raw = String((ex || {}).sets || '').match(/\d+/);
    var n = raw ? Number(raw[0]) : 3;
    if (!isFinite(n) || n < 1) n = 3;
    return Math.min(8, n);
  }

  /* ---------- הטיוטה ----------
     מפתח לכל יום בנפרד: מי שהתחיל לרשום אימון רגליים ועבר לחזה
     לא אמור למצוא את המשקלים של הרגליים בשדות. */
  function draftOf(all, dayIdx) {
    var k = 'd' + dayIdx;
    all[k] = all[k] || { sets: {}, feel: null, note: '' };
    return all[k];
  }
  function setKey(exIdx, setIdx) { return exIdx + ':' + setIdx; }

  /* ---------- מה נשלח לשרת ----------
     שורה אחת לכל תרגיל, כמו קודם. weight ו-reps מחזיקים את הסט
     הכבד, setLog את הפירוט המלא. */
  function buildEntries(day, draft) {
    var ex = (day || {}).exercises || [];
    return ex.map(function (e, i) {
      if (!isReal(e)) return { done: false };
      var n = setCount(e), log = [], heaviest = null;
      for (var s = 0; s < n; s++) {
        var cell = (draft.sets || {})[setKey(i, s)];
        if (!cell) continue;
        var w = num(cell.w), r = num(cell.r);
        if (w === null && r === null) continue;
        log.push({ w: w, r: r });
        if (w !== null && (heaviest === null || w > heaviest.w)) heaviest = { w: w, r: r };
      }
      return {
        ex: e.name || '',
        done: log.length > 0,
        weight: heaviest ? heaviest.w : '',
        reps: heaviest && heaviest.r ? heaviest.r : '',
        sets: log.length || '',
        setLog: log
      };
    }).filter(function (row) { return row.done; });
  }

  /* נפח: משקל כפול חזרות, מסוכם על כל הסטים. זה המספר שמראה
     התקדמות גם כשהמשקל לא זז — עוד סט באותו משקל הוא עוד עבודה. */
  function volumeOf(entries) {
    var v = 0;
    (entries || []).forEach(function (e) {
      var log = e.setLog || [];
      if (log.length) {
        log.forEach(function (s) { if (s.w && s.r) v += s.w * s.r; });
      } else if (e.weight && e.reps) {
        v += Number(e.weight) * Number(e.reps) * (Number(e.sets) || 1);
      }
    });
    return Math.round(v);
  }

  /* ---------- מה עשה בפעם הקודמת ----------
     השורה הכי שימושית במסך. בלעדיה המתאמן עומד מול השדה ומנחש
     מה הרים בשבוע שעבר, ובדרך כלל מנחש נמוך מדי. */
  function lastTimeOf(logs, exName) {
    var name = String(exName || '').trim();
    if (!name) return null;
    var best = null;
    (logs || []).forEach(function (l) {
      (l.entries || []).forEach(function (e) {
        if (String(e.ex || '').trim() !== name || !e.done) return;
        var d = String(l.date || '').slice(0, 10);
        if (!best || d > best.date) {
          best = { date: d, weight: num(e.weight), reps: num(e.reps),
                   sets: (e.setLog || []).length || num(e.sets) };
        }
      });
    });
    return best;
  }

  /* ---------- מבנה הסטים ----------
     הכלל של המאמן, זהה לכל המתאמנים: 5 סטים = חימום תנועה בלי משקל,
     חימום במשקל נמוך ושלושה סטי עבודה; 4 סטים = חימום במשקל נמוך
     ושלושה סטי עבודה; 3 סטים = שלושתם עבודה. מוביליטי, מתיחות ותרגיל
     שנמדד בזמן אינם "משקל גבוה" — שם אין תוויות. */
  var FLEX_RE = /מוביליטי|מתיח|גמישות|mobility|stretch/i;
  function isFlexDay(day) { return FLEX_RE.test(String((day || {}).name || '')); }
  function setRoles(ex, day) {
    ex = ex || {};
    if (day && isFlexDay(day)) return null;
    if (FLEX_RE.test(String(ex.name || ''))) return null;
    if (/שנ|דק|sec|min/i.test(String(ex.reps || ''))) return null;
    var raw = String(ex.sets || '').match(/\d+/);
    if (!raw) return null;
    var n = Math.min(8, Number(raw[0]));
    if (n < 3) return null;
    var out = [];
    for (var i = 0; i < n; i++) out.push('work');
    if (n >= 5) { out[0] = 'move'; out[1] = 'warm'; }
    else if (n === 4) out[0] = 'warm';
    return out;
  }
  var ROLE_LABEL = { move: 'חימום תנועה · בלי משקל', warm: 'חימום · משקל נמוך', work: 'עבודה · משקל גבוה' };
  function rolesLine(roles) {
    if (!roles) return '';
    var work = roles.filter(function (r) { return r === 'work'; }).length;
    var parts = [];
    if (roles[0] === 'move') parts.push('סט 1 חימום תנועה', 'סט 2 חימום קל');
    else if (roles[0] === 'warm') parts.push('סט 1 חימום קל');
    parts.push(work + ' סטי עבודה במשקל גבוה');
    return parts.join(' · ');
  }
  /* ההסבר המלא — מוצג למעלה בכל יום אימון, כדי שלא יפספסו */
  var SETS_GUIDE = [
    ['5 סטים', 'סט 1 חימום תנועה בלי משקל · סט 2 חימום במשקל נמוך · 3 סטי עבודה במשקל גבוה'],
    ['4 סטים', 'סט 1 חימום במשקל נמוך · 3 סטי עבודה במשקל גבוה'],
    ['3 סטים', '3 סטי עבודה במשקל גבוה']
  ];

  window.EBWLog = {
    localISO: localISO, dayGap: dayGap,
    suggestDay: suggestDay, setCount: setCount,
    setRoles: setRoles, rolesLine: rolesLine, isFlexDay: isFlexDay,
    ROLE_LABEL: ROLE_LABEL, SETS_GUIDE: SETS_GUIDE,
    isInfo: isInfo, isReal: isReal, realCount: realCount,
    draftOf: draftOf, setKey: setKey,
    buildEntries: buildEntries, volumeOf: volumeOf, lastTimeOf: lastTimeOf,
    esc: esc, num: num, r1: r1
  };
})();

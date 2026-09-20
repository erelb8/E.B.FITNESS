/* =====================================================================
   E.B FIT — המאמן החכם של המתאמן
   ---------------------------------------------------------------------
   רץ על המכשיר, בלי שרת מודל ובלי מפתח. האפליקציה סטטית והריפו
   ציבורי, ולכן מפתח API שהיה יושב כאן היה גלוי לכל אחד. מה שהמתאמן
   צריך ממילא אינו שיחה אלא תשומת לב: מישהו שמסתכל על המספרים שלו
   כל שבוע ואומר לו מה זז ומה נתקע.

   שלושה מקורות, כולם כבר קיימים במערכת:
     workout_logs  — מה שדיווח שביצע, כולל משקל וחזרות לכל תרגיל
     weighins      — מה ששקל
     program.days  — מה שהוא אמור לעשות

   הכוח מושווה לפי 1RM משוער ולא לפי המשקל על המוט: 60 קילו לשמונה
   חזרות חזקים מ-65 לשלוש, ומי שמשווה משקל בלבד יקרא התקדמות אמיתית
   כנסיגה. הנוסחה היא אפלי, w*(1+r/30) — קירוב טוב עד כ-10 חזרות.
   ===================================================================== */
(function () {
  'use strict';

  (window.EB_MOD = window.EB_MOD || {})['bot'] = 'v182';

  var LOGS = [], WEIGH = [], PROGRAM = null, GOAL = '', HABITS = null, FOOD = null;

  /* ריבוי בעברית. שלוש טעויות מהסוג הזה ("1 תרגילים") נתפסו בבדיקת
     דפדפן אחת, כולן דווקא במצב הנפוץ — ולכן זה יושב כאן ולא בשורה. */
  function heDays(n) { return n === 1 ? 'יום אחד' : n + ' ימים'; }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function num(v) { var n = Number(v); return isFinite(n) && n > 0 ? n : null; }
  function r1(x) { return Math.round(x * 10) / 10; }
  function dayMs() { return 86400000; }
  function daysAgo(iso) {
    var t = new Date(String(iso).slice(0, 10) + 'T00:00').getTime();
    if (!isFinite(t)) return null;
    return Math.floor((Date.now() - t) / dayMs());
  }

  /* 1RM משוער. חזרות חסרות — מניחים אחת, כלומר המשקל עצמו. */
  function e1rm(w, reps) {
    var W = num(w); if (!W) return null;
    var R = num(reps) || 1;
    if (R <= 1) return W;                // חזרה אחת היא ה-1RM עצמו
    if (R > 12) R = 12;                  // מעל זה הנוסחה מנפחת
    return W * (1 + R / 30);
  }

  /* ---------- נפח ----------
     משקל כפול חזרות, מסוכם על כל הסטים של האימון. זה המדד שזז
     כשהמשקל עומד במקום: מי שהוסיף סט באותו משקל עשה יותר עבודה,
     והמערכת שמסתכלת רק על המשקל המקסימלי קוראת לזה "תקוע".

     setLog הוא הפירוט לכל סט, והוא קיים רק ביומן החדש. לאימונים
     ישנים נופלים חזרה למשקל ולחזרות של הסט הכבד. */
  function volumeOf(entries) {
    var v = 0;
    (entries || []).forEach(function (e) {
      if (!e || !e.done) return;
      var log = e.setLog || [];
      if (log.length) {
        log.forEach(function (s) {
          var w = num(s.w), r = num(s.r);
          if (w && r) v += w * r;
        });
      } else {
        var w2 = num(e.weight), r2 = num(e.reps), n = num(e.sets) || 1;
        if (w2 && r2) v += w2 * r2 * n;
      }
    });
    return Math.round(v);
  }

  /* נפח לאימון, לפי תאריך */
  function volumeSeries() {
    var by = {};
    LOGS.forEach(function (l) {
      var d = String(l.date || '').slice(0, 10);
      if (!d) return;
      by[d] = (by[d] || 0) + volumeOf(l.entries);
    });
    return Object.keys(by).sort().map(function (d) { return { date: d, vol: by[d] }; });
  }

  /* ---------- מעקב יום-יום ----------
     הרצף השבועי עונה על "האם אני בכלל בעניין"; הרצף היומי עונה על
     "מה עשיתי השבוע". מתאמן שמתאמן שלוש פעמים בשבוע לא אמור לראות
     רצף שנשבר ביום מנוחה, ולכן יום מנוחה אינו שובר — רק שבעה ימים
     רצופים בלי אימון שוברים. */
  function dailyTrack(days) {
    days = days || 14;
    var seen = {};
    LOGS.forEach(function (l) {
      var d = String(l.date || '').slice(0, 10);
      if (d) seen[d] = (seen[d] || 0) + 1;
    });
    var out = [];
    var cur = new Date();
    for (var i = days - 1; i >= 0; i--) {
      var d = new Date(cur.getTime() - i * dayMs());
      var iso = localISO(d);
      out.push({ date: iso, wd: d.getDay(), trained: !!seen[iso] });
    }
    return out;
  }

  /* השבוע הנוכחי מול המתוכנן */
  /* ימים אמיתיים בתוכנית — לא ימים ריקים ולא ימי הנחיות. עד ספטמבר 2026 כל
     יום נספר, ומתאמן עם 14 ימים בתוכנית (9 מהם ריקים) "היה צריך"
     להתאמן 14 פעמים בשבוע, וקיבל "פחות אימונים מהתוכנית" על כל שבוע. */
  function realDays() {
    return ((PROGRAM || {}).days || []).filter(function (d) {
      return (d.exercises || []).some(function (e) {
        if (window.EBWLog && EBWLog.isReal) return EBWLog.isReal(e);
        return String(e.name || '').trim() && (e.sets || e.reps || e.weight);
      });
    });
  }
  /* תוכנית מחזורית ("מחזור 1 · אימון A", "שבוע ב׳ · יום 1") היא כמה
     שבועות ברצף, לא 13 אימונים בשבוע. מקבצים לפי הקידומת, והשבוע הוא
     הקבוצה הגדולה. עד 6 בשבוע — מעבר לזה זו תוכנית ולא תדירות. */
  function cycleKey(name) {
    var m = String(name || '').match(/^\s*((?:מחזור|שבוע)\s*[^·\-—:|]{0,6})\s*[·\-—:|]/);
    return m ? m[1].replace(/\s+/g, ' ').trim() : null;
  }
  function isCycle() {
    var keys = {};
    realDays().forEach(function (d) { var k = cycleKey(d.name); if (k) keys[k] = (keys[k] || 0) + 1; });
    return Object.keys(keys).length >= 2 ? keys : null;
  }
  function plannedPerWeek() {
    var cyc = isCycle();
    var n = cyc ? Math.max.apply(null, Object.keys(cyc).map(function (k) { return cyc[k]; })) : realDays().length;
    return Math.min(6, n);
  }

  function thisWeek() {
    var start = weekStart(localISO(new Date()));
    var n = 0;
    LOGS.forEach(function (l) {
      var d = String(l.date || '').slice(0, 10);
      if (d && weekStart(d) === start) n++;
    });
    var planned = plannedPerWeek();
    return { done: n, planned: planned, left: Math.max(0, planned - n) };
  }

  /* מגמת נפח: ארבעה אימונים אחרונים מול הארבעה שלפניהם */
  function volumeTrend() {
    var s = volumeSeries().filter(function (x) { return x.vol > 0; });
    if (s.length < 4) return null;
    var tail = s.slice(-4), head = s.slice(-8, -4);
    if (!head.length) return null;
    var avg = function (a) { return a.reduce(function (x, y) { return x + y.vol; }, 0) / a.length; };
    var now = avg(tail), before = avg(head);
    if (!before) return null;
    return { now: Math.round(now), before: Math.round(before),
             pct: Math.round((now - before) / before * 100) };
  }

  function load(opts) {
    opts = opts || {};
    LOGS    = Array.isArray(opts.logs) ? opts.logs.slice() : [];
    WEIGH   = Array.isArray(opts.weighins) ? opts.weighins.slice() : [];
    PROGRAM = opts.program || null;
    GOAL    = String(opts.goal || '');
    HABITS  = opts.habits || null;
    FOOD    = opts.food || null;
    LOGS.sort(function (a, b) { return String(a.date) < String(b.date) ? -1 : 1; });
    return true;
  }

  /* ---------- סדרות לפי תרגיל ----------
     שורה אחת לכל תרגיל בכל אימון: הסט הכבד ביותר באותו יום. */
  function series() {
    var by = {};
    LOGS.forEach(function (l) {
      var d = String(l.date || '').slice(0, 10);
      if (!d) return;
      (l.entries || []).forEach(function (e) {
        var name = String(e.ex || '').trim();
        if (!name || !e.done) return;
        var est = e1rm(e.weight, e.reps);
        if (est === null) return;
        by[name] = by[name] || {};
        /* אותו תרגיל פעמיים באותו יום — הסט החזק קובע */
        if (!by[name][d] || est > by[name][d].est) {
          by[name][d] = { date: d, est: est, w: num(e.weight), reps: num(e.reps) };
        }
      });
    });
    var out = {};
    Object.keys(by).forEach(function (k) {
      out[k] = Object.keys(by[k]).sort().map(function (d) { return by[k][d]; });
    });
    return out;
  }

  /* ---------- מגמה לכל תרגיל ---------- */
  function trends() {
    var s = series(), out = [];
    Object.keys(s).forEach(function (name) {
      var pts = s[name];
      if (!pts.length) return;
      var last = pts[pts.length - 1];
      var best = pts.reduce(function (a, p) { return p.est > a.est ? p : a; }, pts[0]);
      var first = pts[0];
      var gain = pts.length > 1 ? (last.est - first.est) / first.est * 100 : 0;

      /* תקיעה: שלושה אימונים אחרונים בלי שיפור על המרב שלפניהם */
      var stalled = false;
      if (pts.length >= 4) {
        var tail = pts.slice(-3);
        var head = pts.slice(0, -3);
        var headBest = head.reduce(function (a, p) { return Math.max(a, p.est); }, 0);
        stalled = tail.every(function (p) { return p.est <= headBest + 0.01; });
      }
      out.push({
        name: name, points: pts, sessions: pts.length,
        last: last, best: best, gainPct: gain,
        /* שיא = טוב מכל אימון קודם. עד ספטמבר 2026 גם חזרה על אותו משקל נקראה
           "שיא חדש", יחד עם "נתקע" על אותו תרגיל. */
        isPR: pts.length > 1 && last.est > pts.slice(0, -1).reduce(function (a, p) { return Math.max(a, p.est); }, 0) + 0.01,
        stalled: stalled,
        daysSince: daysAgo(last.date)
      });
    });
    out.sort(function (a, b) { return b.sessions - a.sessions; });
    return out;
  }

  /* ---------- מסלול התוכנית ----------
     המאמן מוכר בחודשים והמתאמן חי בשבועות, ולכן נשמר planMonths
     ומוצג שבוע. 4.345 ולא 4: שנה היא 52 שבועות ולא 48, וחבילה של
     שישה חודשים הייתה מסתיימת שבועיים מוקדם מדי.

     planStart ו-planMonths יושבים בתוך program, שכבר מסונכרן —
     אותה החלטה כמו בהערות, ומאותה סיבה: בלי מיגרציה בשרת. */
  function plan() {
    var p = PROGRAM || {};
    var startISO = String(p.planStart || '').slice(0, 10);
    var months = Number(p.planMonths);
    if (!isFinite(months) || months <= 0) months = 3;
    if (!startISO) return null;

    var d0 = new Date(startISO + 'T00:00').getTime();
    if (!isFinite(d0)) return null;

    var total = Math.max(1, Math.round(months * 4.345));
    var passed = Math.floor((Date.now() - d0) / dayMs());
    var weekNow = Math.max(1, Math.floor(passed / 7) + 1);

    var end = new Date(d0);
    end.setDate(end.getDate() + total * 7 - 1);

    return {
      start: startISO, months: months, totalWeeks: total,
      weekNow: weekNow, ended: weekNow > total,
      weeksLeft: Math.max(0, total - weekNow + 1),
      pct: Math.max(0, Math.min(100, Math.round((weekNow - 1) / total * 100))),
      endISO: end.getFullYear() + '-' + String(end.getMonth() + 1).padStart(2, '0')
            + '-' + String(end.getDate()).padStart(2, '0')
    };
  }

  /* ---------- רצף שבועות ----------
     שבועות רצופים עם אימון אחד לפחות. נספר מכל היומן ולא מתוך חלון
     התוכנית — מתאמן שסיים תוכנית והאריך אותה אינו מאבד שנה של
     התמדה רק כי נגמר לו התאריך.

     השבוע הנוכחי אינו שובר רצף כשעוד לא התאמנו בו: ביום ראשון בבוקר
     איש עוד לא התאמן השבוע, וזו אינה הפסקה. */
  /* תאריך בשעון המקומי. המרה ל-UTC מזיזה בישראל את חצות ליום
     הקודם, ורצף היה נשבר בליל שבת-ראשון. */
  function localISO(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
         + '-' + String(d.getDate()).padStart(2, '0');
  }
  function weekStart(iso) {
    var d = new Date(String(iso).slice(0, 10) + 'T00:00');
    d.setDate(d.getDate() - d.getDay());
    return localISO(d);
  }
  function streak() {
    var weeks = {};
    LOGS.forEach(function (l) {
      var d = String(l.date || '').slice(0, 10);
      if (d) weeks[weekStart(d)] = 1;
    });
    if (!Object.keys(weeks).length) return { weeks: 0, active: false };

    var cur = new Date();
    cur.setDate(cur.getDate() - cur.getDay());
    var thisW = weekStart(localISO(cur));
    var active = !!weeks[thisW];

    /* אם השבוע עוד ריק — מתחילים לספור מהשבוע שעבר */
    if (!active) cur.setDate(cur.getDate() - 7);

    var n = 0;
    for (;;) {
      var k = weekStart(localISO(cur));
      if (!weeks[k]) break;
      n++;
      cur.setDate(cur.getDate() - 7);
      if (n > 520) break;                 // עשר שנים — עצירת בטיחות
    }
    return { weeks: n, active: active };
  }

  /* ---------- עקביות ---------- */
  function consistency() {
    var cut = Date.now() - 28 * dayMs();
    var days = {};
    LOGS.forEach(function (l) {
      var d = String(l.date || '').slice(0, 10);
      var t = new Date(d + 'T00:00').getTime();
      if (isFinite(t) && t >= cut) days[d] = 1;
    });
    var n = Object.keys(days).length;
    var planned = plannedPerWeek();
    return {
      last4Weeks: n,
      perWeek: r1(n / 4),
      planned: planned,
      expected: planned * 4,
      lastAt: LOGS.length ? daysAgo(LOGS[LOGS.length - 1].date) : null
    };
  }

  /* ימים בתוכנית שלא אומנו בשלושה שבועות */
  function neglectedDays() {
    /* בתוכנית מחזורית רוב הימים עוד לא הגיעו — זה לא הזנחה */
    if (isCycle()) return [];
    var planned = realDays();
    if (!planned.length) return [];
    var seen = {};
    LOGS.forEach(function (l) {
      var d = daysAgo(l.date);
      /* בשרת השדה הוא day_name. עד ספטמבר 2026 נקרא רק dayName, ולכן כל יום
         נראה מוזנח — גם כזה שאומן יומיים קודם. */
      if (d !== null && d <= 21) seen[String(l.day_name || l.dayName || '').trim()] = 1;
    });
    return planned
      .map(function (d) { return String(d.name || '').trim(); })
      .filter(function (n) { return n && !seen[n]; });
  }

  /* ---------- ההודעות ----------
     מסודרות לפי מה שדחוף לומר, לא לפי סדר החישוב. ההודעה הראשונה
     היא זו שתיקרא — שלוש שורות של שבחים מעל אזהרה מבטלות אותה. */
  /* skipWeight: כשכרטיס "השיפור שלי" מוצג באותו מסך, הוא
     כבר אומר את משפט משקל הגוף במלואו. אותה פסקה פעמיים במסך
     אחד נקראת כתקלה, ומלמדת לדלג על הכרטיס. חלוקת התפקידים:
     הכרטיס על המשקל, הבוט על הכוח והעקביות. */
  /* ---------- מוביליטי ותזונה ----------
     שני אלה אינם אימון ואין להם דיווח: הם קורים כל יום והמתאמן רק
     מסמן. לכן הם נמדדים בדבקות ורצף ולא בנפח או ב-1RM, ולכן גם
     המשפט שונה — "כמה ימים מתוך שבעה" ולא "כמה עלית".

     שתי הודעות לכל היותר, אחת לכל תחום. מתאמן שמקבל שש הודעות
     מפסיק לקרוא את כולן, וההודעות על האימון עצמו חשובות יותר. */
  function foodLoggedThisWeek() {
    return !!(FOOD && FOOD.days && FOOD.days.slice(0, 7).some(function (d) { return d.n >= 1; }));
  }
  function habitWatch() {
    var out = [];
    if (!window.EBHabits || !HABITS) return out;

    var hasList = !!((PROGRAM || {}).mobility || []).length
               || !!((HABITS.own) || []).length;

    [{ kind: 'mob',  on: hasList, icon: '🧘', what: 'מתיחות',
       zero: 'יש לך רשימת מתיחות ועוד לא סימנת אף יום. חמש דקות ביום הן ההפרש בין טווח תנועה שנשמר לבין כזה שנסגר בשקט.' },
     /* מי שרושם אוכל ביומן — הודעות התזונה מדברות עליו (nutritionMsgs).
        בלי זה הבוט אמר "עוד לא סימנת תזונה" למי שרשם שישה ימים. */
     { kind: 'food', on: !foodLoggedThisWeek(), icon: '🥗', what: 'תזונה',
       zero: 'עוד לא סימנת ימי תזונה. האימון בונה את הגירוי, האוכל בונה את התוצאה — וסימון יומי אחד מספיק כדי שנראה מגמה.' }
    ].forEach(function (cfg) {
      if (!cfg.on) return;
      var a = EBHabits.adherence(HABITS, cfg.kind, 7);
      var s = EBHabits.streak(HABITS, cfg.kind);

      if (!a.done && !s) {
        out.push({ tone: 'info', icon: cfg.icon, title: 'עוד לא סימנת ' + cfg.what, text: cfg.zero });
        return;
      }
      if (a.done >= 5) {
        out.push({ tone: 'good', icon: cfg.icon,
          title: cfg.what + ': ' + a.done + ' מתוך 7 השבוע',
          text: (s > 1 ? 'רצף של ' + heDays(s) + '. ' : '')
              + 'זה בדיוק החלק שרוב האנשים מוותרים עליו ראשון, ואתה עומד בו.' });
      } else if (a.done) {
        out.push({ tone: 'info', icon: cfg.icon,
          title: cfg.what + ': ' + a.done + ' מתוך 7 השבוע',
          text: 'סימנת ' + heDays(a.done) + ' בשבוע האחרון. היעד אינו מושלם אלא רציף — '
              + 'עוד יום או שניים בשבוע וזה כבר הרגל.' });
      } else {
        out.push({ tone: 'warn', icon: cfg.icon,
          title: cfg.what + ' נעצרו השבוע',
          text: 'שבוע שלם בלי סימון, אחרי שכבר היה לך רצף. אל תתחיל מחדש — תסמן היום אחד, וזה חוזר.' });
      }
    });
    return out;
  }

  /* ---------- כאב ועייפות ----------
     מאמן שרואה "כואבת לי הברך" פעמיים ושלושה אימונים "קשה" ברצף לא
     מדבר על שיאים. עד ספטמבר 2026 הבוט לא קרא את ההערות ואת ה"איך היה" בכלל.
     הגבול בעברית מפורש — \b של JS לא מכיר אותיות עבריות. */
  var PAIN = /(^|[^\u05D0-\u05EA])[והבלמשכ]{0,2}(כאב|כאבים|כואב|כואבת|כואבים|כאבה|פציעה|פצוע|פצועה|נפצע|נפצעה|נפצעתי|דלקת|נקע|נפיחות|נפוח|נפוחה|סחרחורת|נתפס|נתפסה|נתפסו|צריבה|חבלה)(?=$|[^\u05D0-\u05EA])/;
  function painNote() {
    for (var i = LOGS.length - 1; i >= 0; i--) {
      var l = LOGS[i], d = daysAgo(l.date);
      if (d === null || d > 14) break;
      if (PAIN.test(String(l.note || ''))) return { note: String(l.note).trim(), day: l.day_name || l.dayName || '', ago: d };
    }
    return null;
  }
  function fatigue() {
    var last = LOGS.slice(-3);
    if (last.length < 2) return null;
    var hard = last.filter(function (l) { return l.feel === 'קשה'; }).length;
    if (hard < 2) return null;
    /* קשה + ירידה בביצועים = עייפות אמיתית, לא רק אימון מאתגר */
    var dropped = trends().some(function (x) {
      var p = x.points; if (p.length < 2) return false;
      return p[p.length - 1].est < p[p.length - 2].est * 0.97 && x.daysSince !== null && x.daysSince <= 10;
    });
    return { hard: hard, of: last.length, dropped: dropped };
  }
  /* ---------- מתי להעלות משקל ----------
     התקדמות כפולה: עובדים בטווח חזרות (8-10), וכשכל הסטים מגיעים
     לקצה העליון — מעלים משקל ומתחילים שוב מלמטה. זה מה שמאמן היה
     אומר אחרי אימון כזה, והבוט לא אמר. */
  function topReps(v) {
    var m = String(v || '').match(/(\d+)\s*(?:[-–—]\s*(\d+))?/);
    if (!m || /[\u05D0-\u05EA]/.test(String(v))) return null;   // "לכשל", "30 שנ׳" — לא טווח חזרות
    return Number(m[2] || m[1]);
  }
  /* ---------- בכמה להעלות ----------
     עד כאן הבוט אמר לכולם אותו דבר: 2.5 ק״ג מעל 40. בפועל סקוואט של
     100 עולה בחמישה, הרחקות צד של 8 עולות בקילו, וקטלבל בכלל קופץ
     בארבעה כי אין ביניים. המלצה שלא מתאימה לציוד היא המלצה שאי אפשר
     לבצע, והמתאמן פשוט מתעלם ממנה.

     שלושה דברים קובעים: סוג התרגיל (תרגיל רב-מפרקי לפלג גוף תחתון
     סופג יותר), הציוד (מה בכלל אפשר להוסיף), ואחוז מהמשקל הנוכחי —
     כדי שקפיצה לא תהיה 20 אחוז אצל מתחיל. */
  var LOWER = /סקוואט|דדליפט|לג פרס|לחיצת רגליים|היפ ת׳רסט|לאנג׳|מכרעים|סטפ-אפ|הק |עגלה|גוד מורנינג/;
  var UPPER = /לחיצ|מתח|חתיר|משיכ|מקבילים|שכיבות סמיכה|פולי|דחיפ|קרוסאובר/;
  function exInfo(name) {
    var L = window.EBEx && window.EBEx.ALL;
    if (!L) return null;
    var n = String(name || '').trim();
    for (var i = 0; i < L.length; i++) if (L[i].n === n) return L[i];
    return null;
  }
  /* הקפיצה הקטנה ביותר שאפשר לבצע עם הציוד הזה */
  function grain(info, w) {
    var e = info ? info.e : '';
    if (e === 'kb') return 4;                  // קטלבלים קופצים ב-4 ק״ג
    if (e === 'db') return w >= 10 ? 2 : 1;    // מדף משקולות: 1 ק״ג עד 10, אחר כך 2
    if (e === 'band' || e === 'bw' || e === 'water' || e === 'trx' || e === 'ball') return 0;
    return 2.5;                                // מוט, מכונה, כבל — זוג צלחות 1.25
  }
  function stepFor(name, w) {
    var info = exInfo(name), n = String(name || '');
    var cap = (LOWER.test(n) || (info && /quads|hams|glutes/.test(info.m) && UPPER.test(n))) ? 5
            : (UPPER.test(n) || (info && /chest|back|shoulders/.test(info.m))) ? 2.5
            : 2;                                                    // תרגיל בידוד
    var g = grain(info, w);
    if (!g) return 0;                          // משקל גוף או גומייה — מוסיפים חזרה, לא קילו
    var raw = Math.min(cap, Math.max(g, w * 0.05));                 // לא יותר מ-5 אחוז
    return Math.max(g, Math.round(raw / g) * g);
  }
  function readyToAdd() {
    var target = {};
    realDays().forEach(function (d) {
      (d.exercises || []).forEach(function (e) {
        var n = String(e.name || '').trim(), top = topReps(e.reps);
        if (n && top && top <= 20) target[n] = top;
      });
    });
    var out = [];
    for (var i = LOGS.length - 1, seen = {}; i >= 0; i--) {
      var l = LOGS[i]; if ((daysAgo(l.date) || 0) > 21) break;
      (l.entries || []).forEach(function (e) {
        var n = String(e.ex || '').trim();
        if (!n || seen[n] || !target[n] || !e.done) return;
        seen[n] = 1;                                   // רק האימון האחרון בכל תרגיל
        var sets = (e.setLog || []).filter(function (x) { return num(x.w) && num(x.r); });
        var w = num(e.weight), allTop;
        if (sets.length) { w = Math.max.apply(null, sets.map(function (x) { return num(x.w); }));
          allTop = sets.filter(function (x) { return num(x.w) >= w; }).every(function (x) { return num(x.r) >= target[n]; }); }
        else allTop = num(e.reps) >= target[n];
        if (!allTop) return;
        if (w) {
          var st = stepFor(n, w);
          /* משקל גוף שנרשם עם משקל חיצוני (חגורה) — עדיין מוסיפים קילו */
          if (!st) st = w >= 10 ? 2 : 1;
          out.push({ name: n, w: w, top: target[n], step: st, next: r1(w + st) });
        } else if (!num(e.weight) && !sets.length && num(e.reps) >= target[n]) {
          /* תרגיל משקל גוף בקצה הטווח — אין מה להעלות, מוסיפים חזרה או סט */
          out.push({ name: n, w: 0, top: target[n], step: 0, next: 0 });
        }
      });
    }
    return out;
  }

  /* ---------- תזונה ----------
     עד ספטמבר 2026 הבוט לא ראה מה המתאמן אוכל, ועל משקל שלא זז אמר רק "זה
     כמעט תמיד הכמויות". עכשיו יש יומן אוכל ויעד, ולכן אפשר להגיד את
     המספר עצמו.

     "יום רשום" הוא יום עם שתי ארוחות לפחות. יום עם ארוחה אחת רשומה הוא
     כמעט תמיד יום שלא נרשם עד הסוף, וממוצע שכולל אותו היה אומר למתאמן
     שהוא אוכל מעט מדי כשהוא פשוט לא סימן. היום עצמו לא נספר — הוא עוד
     לא נגמר. */
  function foodStats() {
    if (!FOOD || !FOOD.days) return null;
    var week = FOOD.days.slice(1, 8);
    var full = week.filter(function (d) { return d.n >= 2; });
    var any = FOOD.days.slice(0, 7).filter(function (d) { return d.n >= 1; }).length;
    var avg = function (k) { return full.length ? Math.round(full.reduce(function (a, d) { return a + (d[k] || 0); }, 0) / full.length) : 0; };
    return { logged: any, full: full.length, kcal: avg('k'), protein: avg('p'), tKcal: FOOD.kcal || 0, tProt: FOOD.protein || 0 };
  }
  function nutritionMsgs() {
    var f = foodStats(); if (!f) return [];
    var dir = (window.EBProg && window.EBProg.direction) ? window.EBProg.direction(GOAL) : null;
    var out = [];
    if (!f.logged) return out;                             // לא משתמש ברישום בכלל — לא מציקים
    if (f.full < 3) {
      out.push({ tone: 'info', icon: '📝', title: 'רשמת תזונה ' + f.logged + ' מתוך 7 ימים',
        text: 'כדי לדעת למה המשקל זז או לא זז, צריך לפחות שלושה ימים רשומים עד הסוף בשבוע. '
            + 'לסמן "אכלתי?" על כל ארוחה, ומה שלא בתפריט — "אכלתי משהו שלא בתפריט".' });
      return out;
    }
    if (f.tKcal) {
      var ratio = f.kcal / f.tKcal;
      var nums = 'ממוצע ' + f.kcal.toLocaleString('en-US') + ' קק״ל ביום מול יעד ' + f.tKcal.toLocaleString('en-US');
      if (ratio < 0.7) {
        out.push({ tone: 'warn', icon: '🍽', title: 'אוכל מעט מדי',
          text: nums + '. כל כך מעט אוכל בא על חשבון השריר והאנרגיה באימון, ובסוף גם המשקל נתקע. '
              + 'להוסיף ארוחה או להגדיל מנות — עדיף לרדת לאט ולשמור על השריר.' });
      } else if (dir === 'down' && ratio > 1.1) {
        out.push({ tone: 'warn', icon: '🍽', title: 'מעל היעד הקלורי',
          text: nums + '. זה ההסבר הכי סביר לכך שהירידה לא מתקדמת כמו שצריך. '
              + 'הכי קל להוריד: שמן, רטבים, אגוזים ונשנושים — הם הרבה קלוריות בכמות קטנה.' });
      } else if (dir === 'up' && ratio < 0.9) {
        out.push({ tone: 'warn', icon: '🍽', title: 'מתחת ליעד — קשה לבנות ככה',
          text: nums + '. בלי עודף קטן בקלוריות השריר לא נבנה, גם באימון מצוין. '
              + 'ארוחה נוספת לפני או אחרי האימון היא הדרך הכי פשוטה לסגור את הפער.' });
      } else if (ratio >= 0.9 && ratio <= 1.1) {
        out.push({ tone: 'good', icon: '🎯', title: 'תזונה מדויקת',
          text: nums + ', ב-' + f.full + ' ימים רשומים. זה הבסיס שהכל נבנה עליו — ככה ממשיכים.' });
      }
    }
    if (f.tProt && f.protein && f.protein < f.tProt * 0.8) {
      out.push({ tone: 'warn', icon: '🥩', title: 'חלבון נמוך',
        text: 'ממוצע ' + f.protein + ' ג׳ חלבון ביום מול יעד ' + f.tProt + '. חלבון הוא מה ששומר ובונה שריר — '
            + 'מקור חלבון בכל ארוחה: עוף, ביצים, יוגורט, קוטג׳, טונה או טופו.' });
    }
    return out;
  }

  function messages(opts) {
    opts = opts || {};
    var out = [];
    var c = consistency();
    var t = trends();

    /* אין נתונים בכלל */
    if (!LOGS.length) {
      out.push({ tone: 'info', icon: '👋', title: 'עוד לא דיווחת אימון',
        text: 'סמן תרגילים תוך כדי האימון ולחץ "סיימתי" בסוף. אחרי שלושה אימונים אני כבר יודע להגיד לך מה עולה ומה נתקע.' });
      /* מתיחות ותזונה אינן תלויות בדיווח אימון: מי שעוד לא התאמן
         אבל כבר מסמן אותן ראוי לקבל על זה מילה, ולא מסך ריק. */
      return out.concat(habitWatch());
    }

    /* הגוף קודם לכל דבר אחר */
    var pn = painNote();
    if (pn) {
      out.push({ tone: 'warn', icon: '🩹', title: 'כתבת שמשהו כאב',
        text: '"' + (pn.note.length > 70 ? pn.note.slice(0, 70) + '…' : pn.note) + '"'
            + (pn.day ? ' (' + pn.day + ')' : '') + '. לא ממשיכים דרך כאב: להוריד משקל בתרגיל שכואב או לדלג עליו, '
            + 'ואם זה לא עובר — להפסיק ולעדכן. המאמן רואה את ההערה.' });
    }
    var fg = fatigue();
    if (fg) {
      out.push({ tone: 'warn', icon: '🔋', title: fg.dropped ? 'הגוף מבקש מנוחה' : 'כמה אימונים קשים ברצף',
        text: fg.hard + ' מתוך ' + fg.of + ' האימונים האחרונים סומנו "קשה"'
            + (fg.dropped ? ' והביצועים ירדו' : '') + '. '
            + (fg.dropped ? 'זה סימן לעייפות מצטברת, לא לחולשה. שבוע קל — משקלים 10% פחות — ושינה טובה יחזירו אותך חזק יותר.'
                          : 'שינה, אוכל ושתייה לפני שמעלים עומס. אם זה ממשיך — שווה לדבר עם המאמן על שבוע קל.') });
    }

    /* נעלם */
    var twNow = thisWeek(), weekFull = twNow.planned && twNow.done >= twNow.planned;
    if (c.lastAt !== null && c.lastAt >= 10) {
      out.push({ tone: 'warn', icon: '⏳', title: 'לא התאמנת ' + c.lastAt + ' ימים',
        text: 'הכושר לא נעלם בשבוע, אבל ההרגל כן. תחזור לאימון אחד קצר — זה מספיק כדי לחזור למסלול.' });
    } else if (c.planned && c.perWeek + 0.01 < c.planned * 0.6 && !weekFull) {
      out.push({ tone: 'warn', icon: '📉', title: 'פחות אימונים מהתוכנית',
        text: 'בחודש האחרון ' + c.last4Weeks + ' אימונים, בערך ' + c.perWeek
            + ' בשבוע, מול ' + c.planned + ' שתוכננו. עדיף להוריד ליעד שאתה עומד בו מלפספס אותו כל שבוע.' });
    }

    /* תזונה: אזהרה עולה לכאן — היא מה שמסביר משקל שלא זז, והכרטיס
       מציג ארבע הודעות בלבד. מחמאה נשארת למטה. */
    var nm = nutritionMsgs();
    nm.filter(function (m) { return m.tone !== 'good'; }).slice(0, 1).forEach(function (m) { out.push(m); });

    /* שיאים */
    var prs = t.filter(function (x) { return x.isPR && x.sessions >= 2 && x.daysSince !== null && x.daysSince <= 14; });
    if (prs.length) {
      var p = prs[0];
      out.push({ tone: 'good', icon: '🏆', title: 'שיא חדש ב' + p.name,
        text: 'האימון האחרון היה הכי חזק שלך בתרגיל הזה — ' + r1(p.last.w) + ' ק״ג'
            + (p.last.reps ? ' ל-' + p.last.reps + ' חזרות' : '') + '. '
            + (prs.length > 1 ? 'ועוד ' + (prs.length - 1) + ' תרגילים בשיא. ' : '')
            + 'זה בדיוק איך שזה אמור להיראות.' });
    }

    /* מוכן להעלות משקל — המשפט שאפשר לפעול לפיו באימון הבא */
    var ra = pn ? [] : readyToAdd();
    if (ra.length) {
      /* תרגיל עם משקל קודם — שם יש מספר לפעול לפיו */
      var a = ra.filter(function (x) { return x.w; })[0] || ra[0];
      var rest = ra.filter(function (x) { return x !== a; });
      var also = rest.length ? ' (וגם ' + rest.slice(0, 2).map(function (x) { return x.name; }).join(', ') + ')' : '';
      if (a.w) {
        out.push({ tone: 'good', icon: '⬆️', title: 'זמן להעלות משקל ב' + a.name,
          text: 'באימון האחרון ' + r1(a.w) + ' ק״ג ל-' + a.top + ' חזרות בכל הסטים — הקצה העליון של הטווח. '
              + 'באימון הבא: ' + a.next + ' ק״ג (עלייה של ' + r1(a.step) + '), ובונים שוב עד ' + a.top + '.' + also });
      } else {
        out.push({ tone: 'good', icon: '⬆️', title: 'זמן להקשות ב' + a.name,
          text: 'הגעת ל-' + a.top + ' חזרות בכל הסטים. בתרגיל משקל גוף אין מה להוסיף למוט — '
              + 'מוסיפים סט, מאטים את הירידה לשלוש שניות, או עוברים לגרסה קשה יותר.' + also });
      }
    }

    /* עלייה מצטברת */
    var climbing = t.filter(function (x) { return x.sessions >= 4 && x.gainPct >= 5; });
    if (climbing.length && !prs.length) {
      var b = climbing[0];
      out.push({ tone: 'good', icon: '📈', title: 'עלייה יפה ב' + b.name,
        text: 'התחזקת ' + Math.round(b.gainPct) + ' אחוז בתרגיל הזה מאז שהתחלת למדוד אותו. ההתקדמות איטית ויציבה — זו הצורה הנכונה.' });
    }

    /* תקיעות */
    var stuck = t.filter(function (x) { return x.stalled && x.sessions >= 4; });
    if (stuck.length) {
      var s = stuck[0];
      out.push({ tone: 'warn', icon: '🧱', title: s.name + ' נתקע',
        text: 'שלושה אימונים בלי לעבור את המשקל הטוב שלך. זה נורמלי ולא סימן לכישלון — נסה להוריד מעט משקל ולהוסיף חזרות, או לדבר עם המאמן על שינוי בתרגיל.' });
    }

    /* יום שנזנח */
    var nd = neglectedDays();
    if (nd.length) {
      out.push({ tone: 'warn', icon: '🗓', title: 'לא נגעת ב' + nd[0],
        text: 'שלושה שבועות בלי היום הזה'
            + (nd.length > 1 ? ' (וגם ' + (nd.length === 2 ? 'יום נוסף' : (nd.length - 1) + ' ימים נוספים') + ')' : '')
            + '. חוסר איזון מצטבר בשקט ומופיע בסוף כפציעה.' });
    }

    /* מה נשאר השבוע. ההודעה הזאת היא היחידה שאפשר לפעול לפיה
       היום, ולכן היא נכנסת גם כשהכול תקין. */
    var tw = thisWeek();
    if (tw.planned && tw.left > 0 && c.lastAt !== null && c.lastAt < 10) {
      out.push({ tone: 'info',
        icon: '🗒',
        title: tw.left === 1 ? 'נשאר אימון אחד השבוע' : 'נשארו ' + tw.left + ' אימונים השבוע',
        text: 'סיימת ' + tw.done + ' מתוך ' + tw.planned + '. '
            + (tw.left === 1 ? 'עוד אחד ואתה סוגר שבוע מלא.' : 'יש עוד זמן לסגור את השבוע במלואו.') });
    } else if (tw.planned && tw.done >= tw.planned) {
      out.push({ tone: 'good', icon: '✅', title: 'סגרת את השבוע',
        text: 'כל ' + tw.planned + ' האימונים שתוכננו בוצעו. שבוע מלא הוא מה שמזיז את המחט לאורך זמן.' });
    }

    /* נפח: המדד שזז כשהמשקל עומד. מוצג רק כשיש מספיק אימונים
       עם פירוט סטים, אחרת הוא רועש ומטעה. */
    var vt = volumeTrend();
    if (vt && Math.abs(vt.pct) >= 8) {
      if (vt.pct > 0) {
        out.push({ tone: 'good', icon: '🧱', title: 'נפח האימונים עלה ' + vt.pct + ' אחוז',
          text: 'ארבעת האימונים האחרונים שלך היו כבדים יותר בסך הכול מהארבעה שלפניהם — '
              + vt.now.toLocaleString('en-US') + ' מול ' + vt.before.toLocaleString('en-US')
              + ' ק״ג. זו התקדמות גם אם המשקל על המוט לא זז.' });
      } else {
        out.push({ tone: 'info', icon: '🪶', title: 'נפח האימונים ירד ' + Math.abs(vt.pct) + ' אחוז',
          text: 'עשית פחות עבודה בסך הכול בארבעת האימונים האחרונים. אם זה מכוון — שבוע קל הוא חלק מהתוכנית. אם לא, שווה לבדוק אם קיצרת אימונים.' });
      }
    }

    /* משקל גוף — נשען על המנוע שכבר קיים */
    if (!opts.skipWeight && window.EBProg && EBProg.coach && WEIGH.length) {
      var dir = EBProg.direction(GOAL);
      var bw = num(WEIGH[WEIGH.length - 1].weight) || num(WEIGH[WEIGH.length - 1].w);
      if (dir && bw) {
        var cc = EBProg.coach(dir, bw);
        if (cc && cc.head) {
          out.push({ tone: cc.cls === 'good' ? 'good' : cc.cls === 'warn' ? 'warn' : 'info',
                     icon: '⚖️', title: cc.head, text: cc.body });
        }
      }
    }

    /* תזונה — אחרי המשקל, כי היא מסבירה אותו. הודעה אחת לכל היותר
       כשיש כבר אזהרה דחופה יותר, כדי לא להציף. */
    nm.filter(function (m) { return m.tone === 'good'; }).slice(0, 1).forEach(function (m) { out.push(m); });

    /* לא בסוף הרשימה: הכרטיס מציג ארבע הודעות בלבד, והוספה בסוף
       פירושה שההרגלים נחתכים ולא נראים אף פעם אצל מתאמן פעיל —
       כלומר בדיוק אצל מי שיש לו מה להגיד עליו. אחרי ההודעה
       הראשונה, שהיא תמיד הדחופה ביותר. */
    var hw = habitWatch();
    if (hw.length) out.splice(1, 0, hw[0]);
    if (hw.length > 1) out.splice(3, 0, hw[1]);

    if (!out.length) {
      out.push({ tone: 'info', icon: '👀', title: 'עוקב אחריך',
        text: 'הכל יציב. תמשיך לדווח אימונים ולשקול פעם בשבוע, ואני אגיד לך ברגע שמשהו יזוז.' });
    }
    return out;
  }

  /* ---------- הכרטיס ---------- */
  function block(opts) {
    var msgs = messages(opts);
    var c = consistency();
    var COL = { good: 'var(--ok)', warn: '#D9605A', info: 'var(--cop)' };

    var h = '<div class="card bot-card" style="margin-bottom:12px">'
      + '<div class="row" style="align-items:center;gap:9px;margin-bottom:10px">'
      + '<span class="bot-dot"></span>'
      + '<div style="flex:1;font-family:Heebo;font-weight:700;font-size:15px">המאמן החכם</div>'
      + (c.last4Weeks
          ? '<span class="mt" style="font-size:11.5px">' + c.last4Weeks + ' אימונים ב-4 שבועות</span>'
          : '')
      + '</div>';

    /* פס שבועיים: עמודה לכל יום. תמונה אחת שאומרת "מתי התאמנתי"
       מהר יותר מכל משפט, והיא גם מראה את החורים. */
    var track = dailyTrack(14);
    var HE = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
    h += '<div class="bot-track">';
    track.forEach(function (d, i) {
      h += '<div class="bot-day' + (d.trained ? ' on' : '') + (i === track.length - 1 ? ' now' : '') + '">'
        + '<span>' + HE[d.wd] + '</span></div>';
    });
    h += '</div>';

    msgs.slice(0, 4).forEach(function (m) {
      var col = COL[m.tone] || COL.info;
      h += '<div class="bot-msg" style="border-inline-start:3px solid ' + col + '">'
        + '<div style="font-family:Heebo;font-weight:700;font-size:13.5px;color:' + col + ';margin-bottom:3px">'
        + m.icon + ' ' + esc(m.title) + '</div>'
        + '<div style="font-size:12.5px;line-height:1.7">' + esc(m.text) + '</div></div>';
    });

    return h + '</div>';
  }

  /* =================== גרפים ===================
     SVG מוטמע ולא ספרייה: הדף חייב לעבוד בלי רשת, וספריית גרפים
     שוקלת יותר מכל שאר האפליקציה יחד.

     ציר ה-X הוא זמן אמיתי ולא מיקום ברשימה. שקילה אחרי הפסקה של
     חודש חייבת להיראות רחוקה, אחרת הגרף מספר סיפור של התמדה שלא
     הייתה. */

  /* ריפוד לא סימטרי: תוויות הערכים יושבות משמאל, ולכן שם צריך מקום
     והקו מתחיל אחריהן. כשהתוויות היו בצד ימין הן התנגשו בערך האחרון,
     שתמיד יושב בקצה הימני — הנקודה החדשה ביותר. */
  var PAD = { l: 30, r: 12, t: 18, b: 18 };

  function pathOf(pts, W, H) {
    var xs = pts.map(function (p) { return p.t; });
    var ys = pts.map(function (p) { return p.v; });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
    var lo = Math.min.apply(null, ys), hi = Math.max.apply(null, ys);
    var span = (hi - lo) || 1;
    lo -= span * 0.18; hi += span * 0.18;
    var dx = (x1 - x0) || 1;
    var X = function (t) { return PAD.l + (t - x0) / dx * (W - PAD.l - PAD.r); };
    var Y = function (v) { return H - PAD.b - (v - lo) / (hi - lo) * (H - PAD.t - PAD.b); };
    return { X: X, Y: Y, lo: lo, hi: hi };
  }

  /* גרף אחד: קווים מנחים אופקיים, קו רך ונקודות מעגליות */
  function lineChart(pts, opts) {
    opts = opts || {};
    if (!pts || pts.length < 2) return '';
    var W = 320, H = 148;
    var m = pathOf(pts, W, H);
    var col = opts.color || 'var(--or)';
    var id = 'g' + Math.random().toString(36).slice(2, 8);

    var d = pts.map(function (p, i) {
      return (i ? 'L' : 'M') + m.X(p.t).toFixed(1) + ' ' + m.Y(p.v).toFixed(1);
    }).join(' ');

    /* שטח מתחת לקו — נותן משקל ויזואלי בלי להוסיף רעש */
    var base = H - PAD.b;
    var area = d + ' L' + m.X(pts[pts.length - 1].t).toFixed(1) + ' ' + base
             + ' L' + m.X(pts[0].t).toFixed(1) + ' ' + base + ' Z';

    var grid = '';
    for (var i = 0; i <= 3; i++) {
      var y = PAD.t + (H - PAD.t - PAD.b) * i / 3;
      var val = m.hi - (m.hi - m.lo) * i / 3;
      grid += '<line x1="' + PAD.l + '" y1="' + y.toFixed(1) + '" x2="' + (W - PAD.r)
            + '" y2="' + y.toFixed(1) + '" class="ch-grid"/>'
            + '<text x="' + (PAD.l - 5) + '" y="' + (y + 3).toFixed(1)
            + '" class="ch-lbl">' + r1(val) + '</text>';
    }

    var dots = pts.map(function (p, i) {
      var lastOne = i === pts.length - 1;
      return '<circle cx="' + m.X(p.t).toFixed(1) + '" cy="' + m.Y(p.v).toFixed(1)
        + '" r="' + (lastOne ? 4.5 : 2.6) + '" fill="' + col + '"'
        + (lastOne ? ' class="ch-last"' : '') + '><title>' + esc(p.label || r1(p.v)) + '</title></circle>';
    }).join('');

    var last = pts[pts.length - 1];
    /* הערך האחרון מעל הנקודה, אלא אם הנקודה נוגעת בתקרה — אז מתחתיה,
       כדי שלא ייחתך בקצה ה-viewBox */
    var ly = m.Y(last.v) - 9;
    if (ly < PAD.t + 2) ly = m.Y(last.v) + 15;
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="ch" role="img" aria-label="'
      + esc(opts.title || 'גרף התקדמות') + '">'
      + '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1">'
      + '<stop offset="0%" stop-color="' + col + '" stop-opacity=".22"/>'
      + '<stop offset="100%" stop-color="' + col + '" stop-opacity="0"/></linearGradient></defs>'
      + grid
      + '<path d="' + area + '" fill="url(#' + id + ')"/>'
      + '<path d="' + d + '" fill="none" stroke="' + col + '" stroke-width="2.2" '
      + 'stroke-linecap="round" stroke-linejoin="round"/>'
      + dots
      + '<text x="' + m.X(last.t).toFixed(1) + '" y="' + ly.toFixed(1)
      + '" text-anchor="middle" class="ch-val">' + r1(last.v) + '</text>'
      + '</svg>';
  }

  function tOf(iso) { return new Date(String(iso).slice(0, 10) + 'T00:00').getTime(); }

  function weightPoints() {
    return WEIGH.map(function (r) {
      var v = num(r.weight) || num(r.w);
      var t = tOf(r.date);
      return (v && isFinite(t)) ? { t: t, v: v, label: r1(v) + ' ק״ג · ' + String(r.date).slice(0, 10) } : null;
    }).filter(Boolean).sort(function (a, b) { return a.t - b.t; });
  }

  /* ---------- הכרטיס של קטגוריית "גוף" ---------- */
  function bodyBlock() {
    var wp = weightPoints();
    /* הכוח לפי תרגיל עבר לגרף ההתקדמות המלא ב"מעקב" (progress-chart.js).
       כאן נשאר משקל הגוף, כדי לא להציג אותו דבר פעמיים. */
    var t  = window.EBChart ? [] : trends().filter(function (x) { return x.sessions >= 2; }).slice(0, 3);

    if (wp.length < 2 && !t.length) {
      return '<div class="card" style="margin-bottom:12px">'
        + '<div style="font-family:Heebo;font-weight:700;font-size:15px;margin-bottom:6px">ההתקדמות שלי</div>'
        + '<div class="mt" style="font-size:13px;line-height:1.65">'
        + 'עוד אין מספיק נתונים לגרף. שקול את עצמך פעם בשבוע ודווח אימונים — '
        + 'אחרי שתי מדידות הגרף מופיע כאן.</div></div>';
    }

    var h = '<div class="card" style="margin-bottom:12px">'
      + '<div style="font-family:Heebo;font-weight:700;font-size:15px;margin-bottom:2px">ההתקדמות שלי</div>';

    if (wp.length >= 2) {
      var first = wp[0].v, lastV = wp[wp.length - 1].v;
      var diff = r1(lastV - first);
      h += '<div class="mt" style="font-size:12px;margin-bottom:4px">משקל הגוף · '
        + wp.length + ' שקילות · '
        + '<b style="color:' + (diff < 0 ? 'var(--ok)' : diff > 0 ? 'var(--cop)' : 'var(--mut)') + '">'
        + '<span dir="ltr">' + (diff > 0 ? '+' : '') + diff + '</span> ק״ג מאז ההתחלה</b></div>'
        + lineChart(wp, { color: 'var(--or)', title: 'משקל הגוף' });
    }

    if (t.length) {
      h += '<div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--line)">'
        + '<div class="mt" style="font-size:12px;margin-bottom:6px">כוח לפי תרגיל · מדד משוער</div>';
      t.forEach(function (x) {
        var pts = x.points.map(function (p) {
          return { t: tOf(p.date), v: p.est,
                   label: r1(p.w) + ' ק״ג × ' + (p.reps || 1) + ' · ' + p.date };
        }).filter(function (p) { return isFinite(p.t); });
        if (pts.length < 2) return;
        h += '<div style="margin-top:8px">'
          + '<div style="display:flex;gap:8px;align-items:baseline;font-size:12.5px">'
          + '<span style="flex:1;font-family:Heebo;font-weight:700">' + esc(x.name) + '</span>'
          + '<span class="mt" style="font-size:11.5px">'
          + (x.gainPct >= 1 ? '<span dir="ltr">+' + Math.round(x.gainPct) + '%</span>'
                            : x.stalled ? 'נתקע' : '') + '</span></div>'
          + lineChart(pts, { color: x.stalled ? 'var(--cop)' : 'var(--ok)', title: x.name })
          + '</div>';
      });
      h += '</div>';
    }

    return h + '</div>';
  }

  /* =================== המסע ===================
     אבני הדרך נגזרות מאירועים שקרו באמת ביומן ובשקילות, ולא ממטרה
     מספרית — השדה "הגדרת הצלחה ל-3 חודשים" הוא טקסט חופשי ולעיתים
     קרובות ריק, ומסך שנשען עליו היה נשאר ריק אצל חצי מהמתאמנים.

     תוכנית שהסתיימה אינה מאפסת דבר: הרצף, השיאים ואבני הדרך נשארים
     על המסך. מי שסיים שלושה חודשים והאריך צריך לראות המשך, לא
     התחלה מחדש. */
  function heMonth(iso) {
    var M = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי',
             'אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
    var d = new Date(String(iso).slice(0, 10) + 'T00:00');
    if (!isFinite(d.getTime())) return '';
    return d.getDate() + ' ב' + M[d.getMonth()];
  }

  function milestones() {
    var out = [];
    if (LOGS.length) {
      out.push({ date: String(LOGS[0].date).slice(0, 10), title: 'האימון הראשון', done: true });
    }

    /* שינוי משקל מצטבר — אבן דרך על כל קילו שלם */
    var wp = weightPoints();
    if (wp.length >= 2) {
      var base = wp[0].v, seen = {};
      wp.forEach(function (p) {
        var whole = Math.trunc(Math.abs(p.v - base));
        if (whole >= 1 && !seen[whole]) {
          seen[whole] = 1;
          out.push({
            date: localISO(new Date(p.t)),
            title: whole + ' ק״ג ' + (p.v < base ? 'למטה' : 'למעלה'),
            done: true
          });
        }
      });
    }

    /* השיא האחרון */
    var prs = trends().filter(function (x) { return x.isPR && x.sessions >= 2; });
    if (prs.length) {
      out.push({ date: prs[0].last.date, title: 'שיא ב' + prs[0].name, done: true, accent: true });
    }

    out.sort(function (a, b) { return String(a.date) < String(b.date) ? -1 : 1; });
    return out.slice(-4);                  // ארבע האחרונות — יותר מזה זו גלילה
  }

  function journeyBlock() {
    var p = plan();
    var st = streak();
    if (!p) return '';

    var ring = 2 * Math.PI * 23;
    var off = ring * (1 - p.pct / 100);

    var h = '<div class="card jr-card" style="margin-bottom:12px">';

    /* כותרת */
    h += '<div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">'
      + '<div style="flex:1;min-width:0">'
      + '<div style="font-size:11px;letter-spacing:.16em;color:var(--cop);font-weight:800">המסע שלך</div>'
      + '<div style="font-family:Frank Ruhl Libre,serif;font-size:23px;font-weight:700;margin-top:3px">'
      + (p.ended ? 'התוכנית הסתיימה' : 'שבוע ' + p.weekNow + ' מתוך ' + p.totalWeeks)
      + '</div></div>'
      + '<div style="position:relative;width:54px;height:54px;flex:none">'
      + '<svg width="54" height="54" viewBox="0 0 54 54">'
      + '<circle cx="27" cy="27" r="23" fill="none" stroke="var(--line2)" stroke-width="5"/>'
      + '<circle cx="27" cy="27" r="23" fill="none" stroke="' + (p.ended ? 'var(--cop)' : 'var(--or)')
      + '" stroke-width="5" stroke-linecap="round" stroke-dasharray="' + ring.toFixed(1)
      + '" stroke-dashoffset="' + off.toFixed(1) + '" transform="rotate(-90 27 27)"/></svg>'
      + '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;'
      + 'font-family:Heebo;font-weight:900;font-size:13.5px">' + p.pct + '%</div>'
      + '</div></div>';

    /* פס הזמן */
    h += '<div style="height:9px;border-radius:99px;background:var(--ink);overflow:hidden;margin-bottom:9px">'
      + '<div style="width:' + p.pct + '%;height:100%;border-radius:99px;'
      + 'background:linear-gradient(90deg,var(--or),var(--gold))"></div></div>';

    h += '<div class="mt" style="font-size:11.5px;line-height:1.6;margin-bottom:13px">'
      + (p.ended
          ? 'התוכנית שלך הסתיימה ב-' + esc(heMonth(p.endISO)) + '. כל מה שצברת נשאר כאן — דבר עם המאמן על ההמשך.'
          : 'התחלת ב-' + esc(heMonth(p.start)) + ' · מסתיימת ב-' + esc(heMonth(p.endISO))
            + ' · נשארו ' + p.weeksLeft + (p.weeksLeft === 1 ? ' שבוע' : ' שבועות'))
      + '</div>';

    /* צ׳יפים */
    var chips = [];
    if (st.weeks) {
      chips.push('<span class="jr-chip" style="color:var(--gold);border-color:rgba(231,184,115,.45);'
        + 'background:rgba(231,184,115,.1)">רצף ' + st.weeks
        + (st.weeks === 1 ? ' שבוע' : ' שבועות') + '</span>');
    }
    var prCount = trends().filter(function (x) { return x.isPR && x.sessions >= 2; }).length;
    if (prCount) {
      chips.push('<span class="jr-chip" style="color:var(--ok);border-color:rgba(221,191,142,.45);'
        + 'background:rgba(221,191,142,.1)">' + prCount + ' שיאים</span>');
    }
    var c = consistency();
    if (c.last4Weeks) {
      chips.push('<span class="jr-chip">' + c.last4Weeks + ' אימונים בחודש</span>');
    }
    if (chips.length) {
      h += '<div style="display:flex;gap:7px;flex-wrap:wrap;margin-bottom:4px">' + chips.join('') + '</div>';
    }

    /* אבני דרך */
    var ms = milestones();
    if (ms.length) {
      h += '<div style="margin-top:14px;padding-top:13px;border-top:1px solid var(--line)">'
        + '<div class="mt" style="font-size:11px;letter-spacing:.16em;font-weight:800;margin-bottom:11px">'
        + 'אבני הדרך</div>';
      ms.forEach(function (m, i) {
        var last = i === ms.length - 1;
        h += '<div style="display:flex;gap:12px">'
          + '<div style="flex:none;width:22px;display:flex;flex-direction:column;align-items:center">'
          + '<div style="width:22px;height:22px;border-radius:50%;background:'
          + (m.accent ? 'var(--gold)' : 'var(--or)') + ';display:flex;align-items:center;justify-content:center">'
          + '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" '
          + 'stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>'
          + '</div>'
          + (last ? '' : '<div style="flex:1;width:2px;background:var(--line2)"></div>')
          + '</div>'
          + '<div style="flex:1;min-width:0;padding-bottom:' + (last ? '0' : '14px') + '">'
          + '<div style="font-size:13.5px;font-weight:700">' + esc(m.title) + '</div>'
          + '<div class="mt" style="font-size:11px;margin-top:1px">' + esc(heMonth(m.date)) + '</div>'
          + '</div></div>';
      });
      h += '</div>';
    }

    return h + '</div>';
  }

  window.EBBot = {
    volumeOf: volumeOf, volumeSeries: volumeSeries, volumeTrend: volumeTrend,
    dailyTrack: dailyTrack, thisWeek: thisWeek,
    load: load, messages: messages, trends: trends, series: series,
    stepFor: stepFor, readyToAdd: readyToAdd,
    consistency: consistency, neglectedDays: neglectedDays,
    e1rm: e1rm, block: block, bodyBlock: bodyBlock,
    plan: plan, streak: streak, weekStart: weekStart,
    journeyBlock: journeyBlock, milestones: milestones, habitWatch: habitWatch,
    lineChart: lineChart, weightPoints: weightPoints,
    data: function () { return { logs: LOGS, weighins: WEIGH }; }
  };
})();

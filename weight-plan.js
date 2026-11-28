/* =====================================================================
   BAUER POWER — יעד המשקל השבועי
   ---------------------------------------------------------------------
   לכל שבוע יש מספר אחד: כמה המשקל אמור להיות ביום חמישי, לפי המטרה.
   לידו מה שנשקל בפועל. מי שעוד לא נשקל רואה את היעד בלבד — "זה מה
   שאמור להיות".

   איך המספר נקבע: מהמשקל הידוע האחרון (שקילה של המתאמן, ואם לא נשקל
   באותו שבוע — מדידה של המאמן) ועוד קצב שבועי כפול מספר השבועות שעברו.
   היעד נשען בכל שבוע מחדש על מה שנמדד באמת ולא על קו שנקבע פעם אחת:
   קו קבוע מתרחק מהמציאות אחרי חודש של עצירה, ומספר שאי אפשר להגיע
   אליו מפסיקים להסתכל עליו.

   הקצב נגזר מהיעד הקלורי שהמתאמן כבר קיבל: גירעון של 500 קק״ל ביום
   הוא כחצי קילו בשבוע. כך המאזניים והתפריט אומרים אותו דבר. המאמן
   יכול לקבוע קצב אחר, משקל יעד שבו היעד נעצר, או לכבות למתאמן מסוים.

   הקובץ נטען בשני הצדדים. ההגדרות מחושבות אצל המאמן ונשמרות בתוך
   התוכנית (program.wplan), כי היא כבר מגיעה לדף המתאמן בלי SQL חדש.
   המספר של השבוע מחושב בכל צד מאותם נתונים באותה פונקציה, ולכן
   המאמן והמתאמן רואים אותו מספר.

   מה נשמר בתוכנית: כיוון, קצב, משקל יעד, ושש המדידות האחרונות של
   המאמן. שום דבר שתלוי בתאריך של היום — אחרת התוכנית של כל מתאמן
   הייתה משתנה מעצמה כל שבוע ונדחפת לשרת בלי שאיש נגע בה.
   ===================================================================== */
(function () {
  'use strict';

  (window.EB_MOD = window.EB_MOD || {})['weight-plan'] = 'v291';

  var WEIGH_DAY = 4;      // חמישי. getDay: 0 ראשון … 4 חמישי
  var MAX_GAP   = 8;      // שבועות. מעבר לזה המשקל הישן כבר לא אומר כלום
  var TOL       = 0.3;    // ק״ג. מתחת לזה זו תנודת מים ומלח, כמו ב-progress.js
  var KEEP_TOL  = 0.7;    // ק״ג. בשמירה, עד כאן זה "יציב"
  var KCAL_KG   = 7700;   // קק״ל לקילו רקמת שומן
  var MAX_PTS   = 6;      // כמה מדידות של המאמן נשמרות בתוכנית

  function r1(x) { return Math.round(x * 10) / 10; }
  /* "85.0" ולא "85": ליד "85.3" מספר בלי ספרה אחרי הנקודה נראה כמו מדידה אחרת */
  function fmt(v) { return r1(Number(v)).toFixed(1); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /* ---------- תאריכים בשעון המקומי ----------
     מחרוזת ISO נקראת כחצות מקומית ולא כ-UTC, כמו ב-targets.js. */
  function isoOf(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function dateOf(iso) { return new Date(String(iso).slice(0, 10) + 'T00:00'); }
  function addDays(iso, n) { var d = dateOf(iso); d.setDate(d.getDate() + n); return isoOf(d); }
  /* השבוע מתחיל בראשון, כמו בכל הדף */
  function weekOf(iso) { var d = dateOf(iso); d.setDate(d.getDate() - d.getDay()); return isoOf(d); }
  /* עיגול ולא חילוק שלם: שבוע שיש בו מעבר לשעון קיץ ארוך או קצר בשעה */
  function weeksBetween(a, b) { return Math.round((dateOf(b) - dateOf(a)) / (7 * 86400000)); }
  function todayOf(when) {
    if (typeof when === 'string' && when) return when.slice(0, 10);
    return isoOf(when instanceof Date ? when : new Date());
  }
  function okDate(s) {
    s = String(s == null ? '' : s).slice(0, 10);
    return (/^\d{4}-\d{2}-\d{2}$/.test(s) && isFinite(dateOf(s).getTime())) ? s : null;
  }
  function okW(v) {
    if (v === '' || v === null || v === undefined) return null;
    var n = Number(v);
    return (isFinite(n) && n >= 25 && n <= 350) ? n : null;
  }
  /* "4.12" */
  function dayLabel(iso) { var d = dateOf(iso); return d.getDate() + '.' + (d.getMonth() + 1); }

  /* ---------- ההגדרות ---------- */
  function norm(p) {
    if (!p || typeof p !== 'object') return null;
    var dir = (p.dir === 'down' || p.dir === 'up' || p.dir === 'keep') ? p.dir : null;
    if (!dir) return null;
    var rate = Number(p.rate);
    if (!isFinite(rate) || rate < 0) rate = 0;
    if (rate > 1.5) rate = 1.5;
    if (dir !== 'keep' && rate <= 0) return null;
    var goal = Number(p.goal);
    goal = (dir !== 'keep' && isFinite(goal) && goal >= 30 && goal <= 300) ? goal : null;
    return { dir: dir, rate: dir === 'keep' ? 0 : rate, goal: goal, pts: Array.isArray(p.pts) ? p.pts : [] };
  }

  /* ---------- המשקל של כל שבוע ----------
     השקילה האחרונה של המתאמן באותו שבוע. בשבוע שבו לא נשקל — המדידה
     האחרונה של המאמן. שקילה של המתאמן קודמת כי היא נעשית באותם תנאים
     כל שבוע (בוקר, לפני אוכל); מדידה באמצע אימון אינה בת-השוואה לה. */
  function weeks(logs, pts) {
    var m = {};
    function put(date, w, src) {
      var d = okDate(date), v = okW(w);
      if (!d || v === null) return;
      var k = weekOf(d), cur = m[k];
      if (cur && cur.src === 'self' && src !== 'self') return;
      if (cur && cur.src === src && cur.date > d) return;
      m[k] = { week: k, date: d, w: v, src: src };
    }
    (pts || []).forEach(function (p) {
      if (!p) return;
      if (Array.isArray(p)) put(p[0], p[1], 'coach'); else put(p.date, p.w != null ? p.w : p.weight, 'coach');
    });
    (logs || []).forEach(function (l) { if (l) put(l.date, l.w != null ? l.w : l.weight, 'self'); });
    return Object.keys(m).sort().map(function (k) { return m[k]; });
  }

  /* המשקל הצפוי אחרי gap שבועות, ממשקל ידוע w0.
     משקל יעד עוצר את ההתקדמות: מי שהגיע אליו אמור להישאר בו. */
  function project(p, w0, gap) {
    if (p.dir === 'keep') return { v: r1(w0), reached: false };
    var s = p.dir === 'down' ? -1 : 1, g = p.goal;
    if (g !== null && (s < 0 ? w0 <= g : w0 >= g)) return { v: r1(g), reached: true };
    var v = w0 + s * p.rate * gap;
    if (g !== null) v = s < 0 ? Math.max(v, g) : Math.min(v, g);
    return { v: r1(v), reached: false };
  }

  function kgTxt(x) { return String(r1(Math.abs(x))); }

  /* מה שנשקל מול מה שהיה אמור להיות.
     "מאחור" נצבע כאזהרה ולא באדום — פער של חצי קילו אינו כישלון. */
  function verdict(p, diff, reached) {
    var a = Math.abs(diff);
    if (p.dir === 'keep') {
      if (a <= KEEP_TOL) return { cls: 'good', side: 'on', txt: 'יציב — בדיוק המטרה' };
      return { cls: 'warn', side: 'off', txt: (diff > 0 ? 'מעל היעד ב-' : 'מתחת ליעד ב-') + kgTxt(diff) + ' ק״ג' };
    }
    if (a <= TOL) return { cls: 'good', side: 'on', txt: reached ? 'במשקל היעד' : 'בדיוק ביעד' };
    var over = diff > 0;
    var behind = p.dir === 'down' ? over : !over;
    return { cls: behind ? 'warn' : 'good', side: behind ? 'behind' : 'ahead',
             txt: (over ? 'מעל היעד ב-' : 'מתחת ליעד ב-') + kgTxt(diff) + ' ק״ג' };
  }

  /* ---------- שבוע אחד ----------
     state:
       none   אין יעד (כבוי, או שהמטרה אינה כיוון משקל)
       start  אין עדיין אף משקל — השקילה הראשונה קובעת את נקודת ההתחלה
       first  נשקל השבוע, ואין משקל קודם להשוות אליו
       stale  המשקל האחרון ישן מדי
       wait   יש יעד לשבוע, ועוד לא נשקל
       done   יש יעד ויש שקילה */
  function at(plan, logs, wk) {
    var p = norm(plan);
    var o = { state: 'none', week: wk, thu: addDays(wk, WEIGH_DAY), plan: p, actual: null, anchor: null,
              expected: null, gap: null, diff: null, verdict: null, reached: false, next: null };
    if (!p) return o;
    var W = weeks(logs, p.pts);
    for (var i = 0; i < W.length; i++) {
      if (W[i].week === wk) o.actual = W[i];
      else if (W[i].week < wk) o.anchor = W[i];
    }
    /* היעד של השבוע הבא, אם יישקל שוב */
    if (o.actual) o.next = project(p, o.actual.w, 1).v;
    if (!o.anchor) { o.state = o.actual ? 'first' : 'start'; return o; }
    o.gap = weeksBetween(o.anchor.week, wk);
    if (o.gap > MAX_GAP) { o.state = o.actual ? 'first' : 'stale'; return o; }
    var pr = project(p, o.anchor.w, o.gap);
    o.expected = pr.v; o.reached = pr.reached;
    if (!o.actual) { o.state = 'wait'; return o; }
    o.state = 'done';
    o.diff = r1(o.actual.w - pr.v);
    o.verdict = verdict(p, o.diff, pr.reached);
    return o;
  }
  /* השבוע הנוכחי */
  function now(plan, logs, when) { return at(plan, logs, weekOf(todayOf(when))); }

  /* השבועות האחרונים, מהחדש לישן: השבוע הנוכחי וכל שבוע שיש בו משקל */
  function history(plan, logs, when, n) {
    var p = norm(plan);
    if (!p) return [];
    var cur = weekOf(todayOf(when)), ks = {};
    weeks(logs, p.pts).forEach(function (x) { if (x.week <= cur) ks[x.week] = 1; });
    ks[cur] = 1;
    return Object.keys(ks).sort().reverse().slice(0, n || 8).map(function (k) { return at(p, logs, k); });
  }

  /* ---------- ניסוחים ---------- */
  function rateTxt(r) { return String(Math.round(Number(r) * 100) / 100); }
  function paceText(plan) {
    var p = norm(plan);
    if (!p) return '';
    if (p.dir === 'keep') return 'שמירה על המשקל';
    return (p.dir === 'down' ? 'ירידה של כ-' : 'עלייה של כ-') + rateTxt(p.rate) + ' ק״ג בשבוע';
  }
  /* הכותרת של היעד לפי היום בשבוע: עד רביעי הוא "לחמישי", בחמישי "להיום" */
  function headText(o, when) {
    var t = todayOf(when);
    var lead = t < o.thu ? 'היעד ליום חמישי' : t === o.thu ? 'היעד להיום' : 'היעד של השבוע';
    return lead + ' · ' + dayLabel(o.thu);
  }
  /* על מה היעד נשען — כדי שהמספר לא ייראה כאילו נפל מהשמיים */
  function basisText(o) {
    if (!o || !o.anchor || !o.plan) return '';
    var from = (o.anchor.src === 'coach' ? 'מהמדידה האחרונה אצל המאמן' : 'מהשקילה האחרונה')
             + ' (' + fmt(o.anchor.w) + ' ק״ג · ' + dayLabel(o.anchor.date) + ')';
    if (o.reached) return 'משקל היעד שנקבע לך: ' + r1(o.plan.goal) + ' ק״ג';
    if (o.plan.dir === 'keep') return 'שמירה על המשקל ' + from;
    return paceText(o.plan) + ', ' + from;
  }

  /* ---------- צד המאמן: בניית ההגדרות ----------
     הקצב האוטומטי: ההפרש בין היעד הקלורי ל-TDEE, מתורגם לקילו בשבוע,
     ומוגבל לטווח סביר כאחוז ממשקל הגוף — 700 גרם בשבוע סבירים למי
     ששוקל 110 ומהירים מדי למי ששוקלת 55.
       ירידה  0.25%–1.0% ממשקל הגוף לשבוע
       עלייה  0.1%–0.5%
     בלי יעד קלורי (חסר גובה או תאריך לידה): 0.6% בירידה, 0.25% בעלייה. */
  function autoRate(dir, o) {
    o = o || {};
    var w = okW(o.weight), lo, hi, def;
    if (dir === 'down') { lo = w ? w * 0.0025 : 0.2; hi = w ? w * 0.01  : 0.9; def = w ? w * 0.006  : 0.5; }
    else                { lo = w ? w * 0.001  : 0.1; hi = w ? w * 0.005 : 0.4; def = w ? w * 0.0025 : 0.25; }
    var k = Number(o.kcal), t = Number(o.tdee), r = null;
    if (isFinite(k) && isFinite(t) && k > 0 && t > 0) {
      var perWeek = (k - t) * 7 / KCAL_KG;                 // שלילי בגירעון
      if (dir === 'down' ? perWeek < -0.05 : perWeek > 0.05) r = Math.min(hi, Math.max(lo, Math.abs(perWeek)));
    }
    if (r === null) r = def;
    return Math.max(0.1, Math.round(r * 20) / 20);         // בקפיצות של 50 גרם
  }

  function coachPts(ms, today) {
    var by = {}, t = today ? String(today).slice(0, 10) : isoOf(new Date());
    (ms || []).forEach(function (m) {
      var d = okDate(m && m.date), w = okW(m && m.weight);
      if (d && w !== null && d <= t) by[d] = w;
    });
    return Object.keys(by).sort().slice(-MAX_PTS).map(function (d) { return [d, by[d]]; });
  }

  /* o: { mode: 'cut' | 'mass' | 'keep'   — המטרה שלפיה חושב היעד הקלורי
          explicit: המאמן בחר אותה ביד
          textDir: הכיוון שעולה מהמטרה הכתובה — 'down' | 'up' | 'keep' | אחר
          tdee, kcal, weight · cfg: { off, rate, goal } · measures · today }
     מחזיר null כשאין יעד.

     כשהמאמן לא בחר ביד, שני הזיהויים חייבים להסכים: זה שקובע את היעד
     הקלורי וזה שקורא את המטרה הכתובה. "שמירה" שנפלה כברירת מחדל (מטרה
     כמו "כוח" או "חזרה מפציעה") אינה יעד משקל. ומטרה כמו "חיטוב ועלייה
     במסה" מקבלת עודף קלורי, אבל המשקל שלה אמור לעמוד — עדיף בלי יעד
     מאשר יעד בכיוון הלא נכון. בחירה ביד מכריעה. */
  function build(o) {
    o = o || {};
    var cfg = o.cfg || {};
    if (cfg.off) return null;
    var want = o.mode === 'cut' ? 'down' : o.mode === 'mass' ? 'up' : o.mode === 'keep' ? 'keep' : null;
    var dir = !want ? null : (o.explicit || o.textDir === want) ? want : null;
    if (!dir) return null;
    /* סדר המפתחות הוא הסדר שבו השרת (jsonb) מחזיר אותם: לפי אורך ואז
       לפי אלף-בית. כך העותק שחוזר מהשרת זהה תו-בתו למה שנבנה כאן, והוא
       לא נראה כשינוי שצריך לדחוף שוב. */
    var out = { dir: dir };
    var pts = coachPts(o.measures, o.today);
    if (pts.length) out.pts = pts;
    var rate = 0;
    if (dir !== 'keep') {
      var man = Number(cfg.rate);
      rate = (isFinite(man) && man > 0) ? Math.min(1.5, Math.round(man * 100) / 100) : autoRate(dir, o);
      var g = Number(cfg.goal);
      if (isFinite(g) && g >= 30 && g <= 300) out.goal = Math.round(g * 10) / 10;
    }
    out.rate = rate;
    return out;
  }

  window.EBWPlan = {
    norm: norm, weeks: weeks, at: at, now: now, history: history, project: project, verdict: verdict,
    build: build, autoRate: autoRate, coachPts: coachPts,
    paceText: paceText, headText: headText, basisText: basisText, dayLabel: dayLabel,
    weekOf: weekOf, addDays: addDays, weeksBetween: weeksBetween, r1: r1, fmt: fmt,
    WEIGH_DAY: WEIGH_DAY, MAX_GAP: MAX_GAP, TOL: TOL, KEEP_TOL: KEEP_TOL
  };
})();

/* =====================================================================
   E.B FIT — בוט ניתוח ההתקדמות
   ---------------------------------------------------------------------
   לוקח את השקילות של מתאמן ואת המטרה שנקלטה בשאלון, ואומר דבר אחד:
   האם הוא מתקדם לכיוון שלו, נתקע, או הולך אחורה.

   שלוש רזולוציות, כי כל אחת עונה על שאלה אחרת:

     שבועי   — האם משהו קרה השבוע. רועש מאוד; שקילה בודדת אינה מגמה.
     חודשי   — הרזולוציה שבאמת קובעת. קצב אמיתי נמדד על ארבעה שבועות
               ומעלה, דרך שיפוע רגרסיה ולא הפרש בין שתי נקודות.
     שנתי    — האם הכיוון הכללי נשמר, או שהשנה התבזבזה על תנודות.

   העיקרון שמנחה את כל הקובץ: מספר אינו טוב או רע בפני עצמו.
   ירידה של חצי קילו היא הצלחה בחיטוב וכישלון בבניית מסה. לכן כל
   שיפוט עובר דרך כיוון המטרה, ובלי מטרה ידועה אין שיפוט בכלל.
   ===================================================================== */
(function () {
  'use strict';

  (window.EB_MOD = window.EB_MOD || {})['analysis'] = 'v70';

  /* ---------- כיוון המטרה ---------- */
  var DOWN = ['ירידה', 'להוריד', 'לרדת', 'חיטוב', 'לחטב', 'שריפת שומן', 'הרזיה', 'לרזות', 'אחוז שומן'];
  var UP   = ['עלייה', 'עליה', 'להעלות', 'מסה', 'מסת שריר', 'לבנות', 'בניית שריר'];
  var KEEP = ['שמירה', 'לשמור', 'תחזוקה', 'להתמיד', 'בריאות', 'כושר כללי'];
  /* כוח אינו כיוון משקל. אפשר להתחזק מאוד בלי לעלות גרם, ולכן
     מתאמן שמטרתו כוח בלבד לא נשפט לפי המאזניים — המדד שלו הוא
     העומס שהוא מרים, ולא המשקל שלו. */
  var STRENGTH = ['כוח', 'חיזוק', 'להתחזק', 'שיאים'];

  function has(txt, list) {
    var t = String(txt || '');
    for (var i = 0; i < list.length; i++) if (t.indexOf(list[i]) > -1) return true;
    return false;
  }

  /* מחזיר 'down' | 'up' | 'keep' | null.
     מטרה שמכילה גם ירידה וגם עלייה היא רה-קומפוזיציה — המשקל אמור
     לעמוד במקום בזמן שההרכב משתנה, ולכן היעד הוא שמירה. */
  function direction(goal, goal2) {
    var g = String(goal || '') + ' ' + String(goal2 || '');
    var d = has(g, DOWN), u = has(g, UP);
    if (d && u) return 'keep';
    if (d) return 'down';
    if (u) return 'up';
    if (has(g, KEEP)) return 'keep';
    if (has(g, STRENGTH)) return 'strength';
    return null;
  }
  var DIR_HE = { down: 'ירידה במשקל', up: 'עלייה במסה', keep: 'שמירה על המשקל',
                 strength: 'כוח — לא נמדד במאזניים' };

  /* ---------- כלי עזר ---------- */
  function num(v) { var n = Number(v); return isFinite(n) && n > 0 ? n : null; }
  function r1(x) { return Math.round(x * 10) / 10; }
  function r2(x) { return Math.round(x * 100) / 100; }
  function days(a, b) { return Math.round((new Date(b) - new Date(a)) / 86400000); }

  /* שקילות של מתאמן, ממוינות, בלי כפילויות באותו יום.

     שני מקורות: מדידות שהמאמן רשם (S.measures) ושקילות שהמתאמן הזין
     בעצמו בקישור שלו (t.weighins). כשיש שתיהן באותו יום, זו של המאמן
     גוברת — הוא שקל במשקל אחד קבוע, והמתאמן במאזניים של הבית. */
  function series(t) {
    var id = (t && t.id) || t;
    var seen = {};

    ((t && t.weighins) || []).forEach(function (m) {
      if (m && m.date && num(m.weight)) {
        seen[m.date] = { date: m.date, w: num(m.weight), fat: num(m.fat),
                         waist: num(m.waist), self: true };
      }
    });

    var src = (typeof S !== 'undefined' && S.measures) ? S.measures : [];
    src.filter(function (m) { return m.traineeId === id && num(m.weight); })
       .forEach(function (m) {
         seen[m.date] = { date: m.date, w: num(m.weight), fat: num(m.fat),
                          waist: num(m.waist) };
       });

    var out = [];
    Object.keys(seen).sort().forEach(function (k) { out.push(seen[k]); });
    return out;
  }

  /* שיפוע רגרסיה לינארית — ק״ג ליום.
     עדיף על הפרש בין שתי נקודות: שקילה בודדת חריגה לא מטה את התוצאה,
     ותנודות מים לא נקראות כמגמה. */
  function slopePerDay(pts) {
    if (pts.length < 3) return null;
    var t0 = new Date(pts[0].date).getTime();
    var n = pts.length, sx = 0, sy = 0, sxy = 0, sxx = 0;
    for (var i = 0; i < n; i++) {
      var x = (new Date(pts[i].date).getTime() - t0) / 86400000;
      var y = pts[i].w;
      sx += x; sy += y; sxy += x * y; sxx += x * x;
    }
    var den = n * sxx - sx * sx;
    if (!den) return null;
    return (n * sxy - sx * sy) / den;
  }

  /* ---------- ספי שיפוט ---------- */
  /* מתחת לזה זו תנודת מים ולא שינוי אמיתי */
  var WEEK_NOISE = 0.3;                 // ק״ג בשקילה שבועית
  /* קצב שבועי בריא, כאחוז ממשקל הגוף. מעל התקרה — מהיר מדי. */
  var RATE = {
    down: { min: 0.20, max: 1.00 },
    up:   { min: 0.10, max: 0.50 },
    keep: { min: 0.00, max: 0.30 }      // סטייה מותרת לכל כיוון
  };

  /* ---------- ניתוח שבועי ---------- */
  function weekly(pts, dir) {
    if (pts.length < 2) return { ok: false, txt: 'צריך לפחות שתי שקילות' };
    var last = pts[pts.length - 1], prev = pts[pts.length - 2];
    var gap = days(prev.date, last.date);
    var d = r1(last.w - prev.w);
    var a = Math.abs(d);

    var out = { ok: true, delta: d, from: prev.date, to: last.date, gapDays: gap, weight: last.w };

    if (gap > 21) { out.stale = true; out.txt = 'השקילה האחרונה לפני ' + gap + ' ימים'; return out; }
    if (a < WEEK_NOISE) {
      out.state = dir === 'keep' ? 'good' : 'flat';
      out.txt = dir === 'keep' ? 'יציב — בדיוק המטרה' : 'ללא שינוי משמעותי';
      return out;
    }
    if (!dir) { out.state = 'unknown'; out.txt = 'אין מטרה מוגדרת — אי אפשר לשפוט'; return out; }
    if (dir === 'strength') { out.state = 'unknown';
      out.txt = 'המטרה כוח — השינוי במשקל אינו המדד'; return out; }

    var toward = (dir === 'down' && d < 0) || (dir === 'up' && d > 0);
    if (dir === 'keep') {
      out.state = 'warn';
      out.txt = 'זז ' + r1(a) + ' ק״ג, והמטרה היא שמירה';
    } else if (toward) {
      out.state = 'good';
      out.txt = (d < 0 ? 'ירידה' : 'עלייה') + ' של ' + r1(a) + ' ק״ג — בכיוון';
    } else {
      out.state = 'bad';
      out.txt = (d < 0 ? 'ירידה' : 'עלייה') + ' של ' + r1(a) + ' ק״ג — נגד הכיוון';
    }
    return out;
  }

  /* ---------- ניתוח חודשי ---------- */
  /* כאן נמצאת התשובה האמיתית לשאלה "האם זה עובד". */
  function monthly(pts, dir) {
    var cut = Date.now() - 35 * 86400000;
    var win = pts.filter(function (p) { return new Date(p.date).getTime() >= cut; });
    if (win.length < 3) return { ok: false, txt: 'צריך לפחות שלוש שקילות בחודש האחרון' };

    var sl = slopePerDay(win);
    if (sl === null) return { ok: false, txt: 'אין מספיק נתונים' };

    var base = win[win.length - 1].w;
    var perWeek = sl * 7;
    var pct = Math.abs(perWeek) / base * 100;      // אחוז ממשקל הגוף לשבוע

    var out = {
      ok: true, perWeek: r2(perWeek), pctPerWeek: r2(pct),
      points: win.length, spanDays: days(win[0].date, win[win.length - 1].date),
      projected30: r1(perWeek / 7 * 30)
    };
    if (!dir) { out.state = 'unknown'; out.txt = 'אין מטרה מוגדרת'; return out; }
    if (dir === 'strength') { out.state = 'unknown';
      out.txt = 'המטרה כוח — יש לעקוב אחרי העומס בשיאים, לא אחרי המשקל'; return out; }

    var lim = RATE[dir];
    var toward = (dir === 'down' && perWeek < 0) || (dir === 'up' && perWeek > 0);

    if (dir === 'keep') {
      if (pct <= lim.max) { out.state = 'good'; out.txt = 'המשקל יציב — ' + r1(Math.abs(perWeek)) + ' ק״ג לשבוע'; }
      else { out.state = 'warn'; out.txt = 'זז ' + r1(Math.abs(perWeek)) + ' ק״ג לשבוע, והמטרה שמירה'; }
      return out;
    }
    if (!toward) {
      out.state = 'bad';
      out.txt = 'המגמה החודשית הפוכה למטרה — ' + r1(Math.abs(perWeek)) + ' ק״ג לשבוע לכיוון הלא נכון';
    } else if (pct < lim.min) {
      out.state = 'warn';
      out.txt = 'בכיוון אבל איטי מאוד — ' + r2(pct) + '% לשבוע. נתקע.';
    } else if (pct > lim.max) {
      out.state = 'warn';
      out.txt = 'מהיר מדי — ' + r2(pct) + '% לשבוע. קצב כזה בא על חשבון מסת שריר.';
    } else {
      out.state = 'good';
      out.txt = 'קצב תקין — ' + r1(Math.abs(perWeek)) + ' ק״ג לשבוע (' + r2(pct) + '%)';
    }
    return out;
  }

  /* ---------- ניתוח שנתי ---------- */
  function yearly(pts, dir) {
    var cut = Date.now() - 365 * 86400000;
    var win = pts.filter(function (p) { return new Date(p.date).getTime() >= cut; });
    if (win.length < 4) return { ok: false, txt: 'צריך לפחות ארבע שקילות בשנה האחרונה' };

    var first = win[0], last = win[win.length - 1];
    var total = r1(last.w - first.w);
    var span = days(first.date, last.date);
    if (span < 60) return { ok: false, txt: 'טווח קצר מדי לניתוח שנתי (' + span + ' ימים)' };

    /* השיא והשפל בדרך — מספרים שמראים אם היו תנודות גדולות */
    var lo = win[0], hi = win[0];
    win.forEach(function (p) { if (p.w < lo.w) lo = p; if (p.w > hi.w) hi = p; });
    var swing = r1(hi.w - lo.w);

    var out = {
      ok: true, total: total, spanDays: span, points: win.length,
      from: first.date, to: last.date, low: lo.w, high: hi.w, swing: swing,
      startWeight: first.w, endWeight: last.w
    };
    if (!dir) { out.state = 'unknown'; out.txt = 'אין מטרה מוגדרת'; return out; }
    if (dir === 'strength') { out.state = 'unknown';
      out.txt = 'המטרה כוח — המשקל אינו המדד'; return out; }

    var toward = (dir === 'down' && total < 0) || (dir === 'up' && total > 0);
    if (dir === 'keep') {
      out.state = Math.abs(total) <= first.w * 0.03 ? 'good' : 'warn';
      out.txt = (out.state === 'good' ? 'נשמר לאורך השנה' : 'סטה ' + r1(Math.abs(total)) + ' ק״ג מנקודת ההתחלה');
    } else if (Math.abs(total) < 1) {
      out.state = 'warn';
      out.txt = 'אחרי ' + span + ' ימים המשקל כמעט זהה להתחלה';
    } else if (toward) {
      out.state = 'good';
      out.txt = (total < 0 ? 'ירידה' : 'עלייה') + ' של ' + r1(Math.abs(total)) + ' ק״ג לאורך ' + span + ' ימים';
    } else {
      out.state = 'bad';
      out.txt = 'לאורך השנה זז ' + r1(Math.abs(total)) + ' ק״ג לכיוון ההפוך למטרה';
    }
    /* תנודה גדולה יחסית לשינוי נטו — סימן ליו-יו */
    if (out.state === 'good' && swing > Math.abs(total) * 2.5 && swing > 4) {
      out.note = 'תנודות גדולות בדרך (' + swing + ' ק״ג בין השפל לשיא) — התוצאה הושגה בגלים.';
    }
    return out;
  }

  /* ---------- כוח: התקדמות בעומס ----------
     מתאמן שמטרתו כוח לא נשפט במאזניים. המדד שלו הוא מה שהוא מרים,
     והנתון הזה כבר יושב במערכת תחת השיאים — הבוט פשוט לא הסתכל עליו. */
  function strength(traineeId) {
    var src = (typeof S !== 'undefined' && S.prs) ? S.prs : [];
    var mine = src.filter(function (p) { return p.traineeId === traineeId && num(p.value); });
    if (mine.length < 2) return { ok: false, txt: 'צריך לפחות שני שיאים רשומים' };

    var byEx = {};
    mine.forEach(function (p) {
      (byEx[p.exercise] = byEx[p.exercise] || []).push({ d: p.date, v: num(p.value) });
    });

    var up = 0, flat = 0, down = 0, best = null, lifts = [];
    Object.keys(byEx).forEach(function (k) {
      var a = byEx[k].sort(function (x, y) { return String(x.d).localeCompare(String(y.d)); });
      if (a.length < 2) return;
      var first = a[0].v, last = a[a.length - 1].v;
      var g = last - first;
      var gp = first > 0 ? g / first * 100 : 0;
      lifts.push({ ex: k, from: first, to: last, gain: r1(g), pct: r1(gp) });
      if (gp > 2) up++; else if (gp < -2) down++; else flat++;
      if (!best || gp > best.pct) best = { ex: k, pct: r1(gp), gain: r1(g) };
    });

    if (!lifts.length) return { ok: false, txt: 'אין תרגיל עם שתי מדידות או יותר' };

    var out = { ok: true, lifts: lifts, up: up, flat: flat, down: down, best: best };
    if (down > up) {
      out.state = 'bad';
      out.txt = down + ' תרגילים ירדו בעומס מול ' + up + ' שעלו';
    } else if (up === 0) {
      out.state = 'warn';
      out.txt = 'העומסים עומדים במקום בכל ' + lifts.length + ' התרגילים';
    } else {
      out.state = 'good';
      out.txt = up + ' מתוך ' + lifts.length + ' תרגילים עלו בעומס'
              + (best ? ' — ' + best.ex + ' ' + (best.gain > 0 ? '+' : '') + best.gain + ' ק״ג' : '');
    }
    return out;
  }

  /* ---------- הרכב גוף ----------
     במטרת חיטוב או רה-קומפוזיציה המשקל הוא מדד גרוע: אפשר לרדת
     באחוז שומן ולעלות בשריר, והמאזניים לא יזוזו. אחוז השומן והיקף
     המותן נאספים כבר במערכת, ולכן כשהם קיימים הם המדד העדיף. */
  function composition(pts, dir) {
    var f = pts.filter(function (p) { return p.fat != null; });
    var wl = pts.filter(function (p) { return p.waist != null; });
    if (f.length < 2 && wl.length < 2) return { ok: false, txt: 'אין מספיק מדידות שומן או היקף' };

    var out = { ok: true }, parts = [];
    if (f.length >= 2) {
      out.fatDelta = r1(f[f.length - 1].fat - f[0].fat);
      parts.push('אחוז שומן ' + (out.fatDelta > 0 ? '+' : '') + out.fatDelta);
    }
    if (wl.length >= 2) {
      out.waistDelta = r1(wl[wl.length - 1].waist - wl[0].waist);
      parts.push('היקף מותן ' + (out.waistDelta > 0 ? '+' : '') + out.waistDelta + ' ס״מ');
    }
    out.txt = parts.join(' · ');

    var moved = (out.fatDelta != null ? out.fatDelta : 0) + (out.waistDelta != null ? out.waistDelta : 0);
    if (dir === 'up') {
      out.state = moved <= 1 ? 'good' : 'warn';
      if (moved > 1) out.txt += ' — עלייה בשומן לצד המסה';
    } else {
      out.state = moved < -0.4 ? 'good' : (moved > 0.4 ? 'bad' : 'warn');
      if (out.state === 'warn') out.txt += ' — כמעט ללא שינוי';
    }
    return out;
  }

  /* ---------- הניתוח המלא למתאמן ---------- */
  function analyze(t) {
    var ans = (t.intake && t.intake.answers) || {};
    var dir = direction(t.goal || ans.goal, ans.goal2);
    var pts = series(t);

    var w = weekly(pts, dir), m = monthly(pts, dir), y = yearly(pts, dir);
    var st = strength(t.id);
    var comp = composition(pts, dir);

    /* המדד הראשי נבחר לפי המטרה, ולא תמיד המשקל:

       כוח            -> העומס בשיאים
       רה-קומפוזיציה  -> הרכב הגוף, כי המשקל אמור לעמוד במקום
       חיטוב          -> משקל, אבל אם יש נתוני שומן הם גוברים
       מסה            -> משקל

       זה ההבדל בין בוט שמסתכל על מספר לבין בוט שמבין מה המטרה. */
    var verdict, why, basis = 'משקל';

    /* רה-קומפוזיציה: 'keep' שנוצר מצירוף של ירידה ועלייה במטרה */
    var g = String(t.goal || ans.goal || '') + ' ' + String(ans.goal2 || '');
    var recomp = has(g, DOWN) && has(g, UP);

    if (dir === 'strength') {
      basis = 'עומס';
      if (st.ok) {
        verdict = st.state === 'good' ? 'ontrack' : (st.state === 'bad' ? 'offtrack' : 'stalled');
        why = st.txt;
      } else {
        verdict = 'nodata';
        why = 'המטרה היא כוח, וההתקדמות נמדדת בעומס — ' + st.txt;
      }
    } else if (recomp && comp.ok) {
      basis = 'הרכב גוף';
      verdict = comp.state === 'good' ? 'ontrack' : (comp.state === 'bad' ? 'offtrack' : 'stalled');
      why = 'רה-קומפוזיציה: ' + comp.txt
          + (m.ok ? '. המשקל ' + (Math.abs(m.perWeek) < 0.15 ? 'יציב כמצופה' : 'זז ' + r1(Math.abs(m.perWeek)) + ' ק״ג לשבוע') : '');
    } else if (!dir) {
      verdict = 'unknown';
      why = 'אין מטרה מוגדרת בשאלון, ולכן אי אפשר לקבוע אם הכיוון נכון';
    } else if (!pts.length) {
      verdict = 'nodata';
      why = 'אין שקילות במערכת';
    } else if (m.ok) {
      verdict = m.state === 'good' ? 'ontrack' : (m.state === 'bad' ? 'offtrack' : 'stalled');
      why = m.txt;
    } else if (w.ok && w.state) {
      verdict = w.state === 'good' ? 'ontrack' : (w.state === 'bad' ? 'offtrack' : 'stalled');
      why = w.txt + ' (על בסיס שבוע בלבד — צריך עוד שקילות למסקנה)';
    } else {
      verdict = 'nodata';
      why = m.txt || w.txt || 'אין מספיק שקילות';
    }

    /* מתי נשקל לאחרונה — מי שהפסיק לשקול הוא הסימן הראשון לנטישה */
    var lastAt = pts.length ? pts[pts.length - 1].date : null;
    var since = lastAt ? days(lastAt, new Date().toISOString().slice(0, 10)) : null;

    /* חיטוב עם נתוני שומן: המשקל קבע את הפסק, אבל אם הרכב הגוף
       מספר סיפור אחר — זה חייב להיאמר, כי הוא המדד הנכון יותר. */
    var note = null;
    if (!recomp && dir === 'down' && comp.ok) {
      if (comp.state === 'good' && verdict !== 'ontrack') {
        note = 'לפי המאזניים זה נראה תקוע, אבל הרכב הגוף משתפר: ' + comp.txt
             + '. במקרה כזה המשקל הוא המדד הפחות נכון.';
      } else if (comp.state === 'bad' && verdict === 'ontrack') {
        note = 'המשקל יורד, אבל ' + comp.txt + ' — ייתכן שהירידה באה ממסת שריר.';
      }
    }

    return {
      dir: dir, dirName: dir ? DIR_HE[dir] : null,
      goal: t.goal || ans.goal || '',
      /* מה המתאמן עצמו הגדיר כהצלחה — נשאל בשאלון ולא הוצג מעולם */
      ownGoal: ans.success3m || '',
      recomp: recomp, basis: basis,
      count: pts.length, lastAt: lastAt, daysSince: since,
      silent: since != null && since > 14,
      weekly: w, monthly: m, yearly: y,
      strength: st, composition: comp,
      verdict: verdict, why: why, note: note
    };
  }

  var V = {
    ontrack: { t: 'בכיוון',      c: '#1E8449' },
    stalled: { t: 'נתקע',        c: '#B9770E' },
    offtrack:{ t: 'הולך אחורה',  c: '#C0392B' },
    unknown: { t: 'אין מטרה',    c: '#6B5B47' },
    nodata:  { t: 'אין נתונים',  c: '#6B5B47' }
  };

  window.EBAnalyze = {
    analyze: analyze,
    direction: direction,
    series: series,
    slopePerDay: slopePerDay,
    weekly: weekly, monthly: monthly, yearly: yearly,
    VERDICT: V, DIR_HE: DIR_HE
  };
})();

/* =====================================================================
   ממשק — דוח שבועי למאמן וכרטיס למתאמן בודד
   ===================================================================== */
(function () {
  'use strict';
  if (!window.EBAnalyze) return;
  var A = window.EBAnalyze;

  function pill(state, txt) {
    var C = { good: '#1E8449', warn: '#B9770E', bad: '#C0392B', flat: '#6B5B47', unknown: '#6B5B47' };
    var c = C[state] || C.unknown;
    return '<span style="display:inline-block;font-weight:800;font-size:12px;padding:3px 10px;border-radius:20px;'
         + 'color:' + c + ';background:' + c + '1A;border:1px solid ' + c + '33">' + esc(txt) + '</span>';
  }

  /* שורה של רזולוציה אחת — שבועי, חודשי או שנתי */
  function row(label, r) {
    if (!r || !r.ok) {
      return '<div class="line-item"><span class="muted" style="width:80px;font-size:13px">' + label + '</span>'
           + '<span class="muted" style="flex:1;font-size:13px">' + esc((r && r.txt) || 'אין נתונים') + '</span></div>';
    }
    return '<div class="line-item"><span class="muted" style="width:80px;font-size:13px">' + label + '</span>'
         + '<span style="flex:1;font-size:13.5px">' + esc(r.txt) + '</span>'
         + (r.state ? pill(r.state, { good: 'תקין', warn: 'לשים לב', bad: 'בעיה', flat: '—', unknown: '?' }[r.state] || '') : '')
         + '</div>';
  }

  /* כרטיס מלא למתאמן אחד */
  function tab(t) {
    var a = A.analyze(t);
    var V = A.VERDICT[a.verdict] || A.VERDICT.nodata;

    var h = '<div class="card" style="border-color:' + V.c + '44;background:' + V.c + '0D">'
      + '<div class="row" style="margin-bottom:8px"><h3 style="flex:1;font-size:15px">ניתוח התקדמות</h3>'
      + '<span style="font-weight:800;font-size:13px;color:' + V.c + '">' + V.t + '</span></div>'
      + '<div style="font-size:14px;margin-bottom:4px">' + esc(a.why) + '</div>'
      + (a.note ? '<div style="font-size:13px;margin-top:6px;padding:8px 10px;border-radius:8px;'
          + 'background:rgba(154,95,30,.10);border:1px solid rgba(154,95,30,.3)">'
          + esc(a.note) + '</div>' : '')
      + '<div class="muted" style="font-size:12.5px;margin-top:6px">'
      + (a.dirName ? 'מטרה: ' + esc(a.dirName) : 'לא הוגדרה מטרה בשאלון')
      + ' · נמדד לפי ' + esc(a.basis)
      + ' · ' + a.count + ' שקילות'
      + (a.lastAt ? ' · אחרונה לפני ' + a.daysSince + ' ימים' : '')
      + '</div>'
      + (a.ownGoal ? '<div class="muted" style="font-size:12.5px;margin-top:5px">'
          + 'הוא הגדיר הצלחה כ: ' + esc(a.ownGoal) + '</div>' : '');
    if (a.silent) {
      h += '<div style="margin-top:8px;font-weight:700;font-size:13px;color:#B9770E">'
         + 'לא נשקל ' + a.daysSince + ' ימים — זה הסימן הראשון לנטישה.</div>';
    }
    h += '</div>';

    h += '<div class="card">'
      + row('שבועי', a.weekly)
      + row('חודשי', a.monthly)
      + row('שנתי', a.yearly)
      + row('עומס', a.strength)
      + row('הרכב גוף', a.composition);
    if (a.yearly && a.yearly.note) {
      h += '<div class="muted" style="font-size:12.5px;margin-top:8px">' + esc(a.yearly.note) + '</div>';
    }
    h += '<div class="muted" style="font-size:11.5px;margin-top:10px;line-height:1.6">'
      + 'הקצב החודשי נמדד בשיפוע רגרסיה על כל השקילות בחודש האחרון, ולא כהפרש בין שתי נקודות — '
      + 'כך ששקילה חריגה אחת לא הופכת את המסקנה. '
      + 'המדד הראשי נבחר לפי המטרה: כוח נמדד בעומס, רה-קומפוזיציה בהרכב הגוף, '
      + 'והשאר במשקל.</div>';
    return h + '</div>';
  }

  /* הדוח השבועי — כל המתאמנים, הבעייתיים למעלה */
  function view() {
    var rows = activeTrainees().map(function (t) { return { t: t, a: A.analyze(t) }; });
    if (!rows.length) return '';

    var ORDER = { offtrack: 0, stalled: 1, unknown: 2, nodata: 3, ontrack: 4 };
    rows.sort(function (x, y) {
      var d = ORDER[x.a.verdict] - ORDER[y.a.verdict];
      return d || String(x.t.name).localeCompare(String(y.t.name), 'he');
    });

    var n = function (v) { return rows.filter(function (x) { return x.a.verdict === v; }).length; };
    var silent = rows.filter(function (x) { return x.a.silent; });

    var h = '<div class="grid stats-auto" style="margin-bottom:14px">'
      + stat('בכיוון', n('ontrack'), '')
      + stat('נתקעו', n('stalled'), n('stalled') ? 'צריך שינוי' : '')
      + stat('הולכים אחורה', n('offtrack'), n('offtrack') ? 'לטפל השבוע' : '')
      + stat('הפסיקו לשקול', silent.length, silent.length ? 'מעל שבועיים' : '')
      + '</div>';

    var act = rows.filter(function (x) { return x.a.verdict === 'offtrack' || x.a.verdict === 'stalled'; });
    if (act.length) {
      h += '<div class="card" style="border-color:#B9770E55;background:#B9770E14">'
        + '<h3 style="font-size:15px;margin-bottom:8px">לטפל השבוע — ' + act.length + ' מתאמנים</h3>'
        + '<div style="font-size:13.5px;line-height:1.9">'
        + act.map(function (x) {
            return '<div><b>' + esc(x.t.name) + '</b> — ' + esc(x.a.why) + '</div>';
          }).join('')
        + '</div></div>';
    }

    h += '<div class="card" style="padding-inline:0"><div style="overflow-x:auto;padding-inline:14px">'
      + '<table class="tbl"><thead><tr><th>מתאמן</th><th>מטרה</th><th>פסק</th>'
      + '<th>חודשי</th><th>שקילה אחרונה</th><th></th></tr></thead><tbody>';

    rows.forEach(function (x) {
      var V = A.VERDICT[x.a.verdict] || A.VERDICT.nodata;
      h += '<tr><td><b>' + esc(x.t.name) + '</b></td>'
        + '<td class="muted" style="font-size:12.5px">' + esc(x.a.dirName || '—')
        + '<div style="font-size:11px;color:var(--dim)">' + esc(x.a.basis) + '</div></td>'
        + '<td><b style="font-size:12.5px;color:' + V.c + '">' + V.t + '</b></td>'
        + '<td style="font-size:12.5px">' + esc(x.a.monthly.ok ? x.a.monthly.txt : '—') + '</td>'
        + '<td class="muted" style="font-size:12.5px">'
        + (x.a.lastAt ? 'לפני ' + x.a.daysSince + ' ימים' : 'אין') + '</td>'
        + '<td><button class="btn sm ghost" onclick="go(\'trainee\',\'' + x.t.id + '\')">פתח</button></td></tr>';
    });

    return h + '</tbody></table></div></div>';
  }

  A.tab = tab;
  A.view = view;
})();

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

  (window.EB_MOD = window.EB_MOD || {})['bot'] = 'v96';

  var LOGS = [], WEIGH = [], PROGRAM = null, GOAL = '';

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

  function load(opts) {
    opts = opts || {};
    LOGS    = Array.isArray(opts.logs) ? opts.logs.slice() : [];
    WEIGH   = Array.isArray(opts.weighins) ? opts.weighins.slice() : [];
    PROGRAM = opts.program || null;
    GOAL    = String(opts.goal || '');
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
        isPR: last.est >= best.est - 0.01 && pts.length > 1,
        stalled: stalled,
        daysSince: daysAgo(last.date)
      });
    });
    out.sort(function (a, b) { return b.sessions - a.sessions; });
    return out;
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
    var planned = ((PROGRAM || {}).days || []).length;
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
    var planned = ((PROGRAM || {}).days || []);
    if (!planned.length) return [];
    var seen = {};
    LOGS.forEach(function (l) {
      var d = daysAgo(l.date);
      if (d !== null && d <= 21) seen[String(l.dayName || '').trim()] = 1;
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
  function messages(opts) {
    opts = opts || {};
    var out = [];
    var c = consistency();
    var t = trends();

    /* אין נתונים בכלל */
    if (!LOGS.length) {
      out.push({ tone: 'info', icon: '👋', title: 'עוד לא דיווחת אימון',
        text: 'סמן תרגילים תוך כדי האימון ולחץ "סיימתי" בסוף. אחרי שלושה אימונים אני כבר יודע להגיד לך מה עולה ומה נתקע.' });
      return out;
    }

    /* נעלם */
    if (c.lastAt !== null && c.lastAt >= 10) {
      out.push({ tone: 'warn', icon: '⏳', title: 'לא התאמנת ' + c.lastAt + ' ימים',
        text: 'הכושר לא נעלם בשבוע, אבל ההרגל כן. תחזור לאימון אחד קצר — זה מספיק כדי לחזור למסלול.' });
    } else if (c.planned && c.perWeek + 0.01 < c.planned * 0.6) {
      out.push({ tone: 'warn', icon: '📉', title: 'פחות אימונים מהתוכנית',
        text: 'בחודש האחרון ' + c.last4Weeks + ' אימונים, בערך ' + c.perWeek
            + ' בשבוע, מול ' + c.planned + ' שתוכננו. עדיף להוריד ליעד שאתה עומד בו מלפספס אותו כל שבוע.' });
    }

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
        text: 'שלושה שבועות בלי היום הזה' + (nd.length > 1 ? ' (וגם ' + (nd.length - 1) + ' ימים נוספים)' : '')
            + '. חוסר איזון מצטבר בשקט ומופיע בסוף כפציעה.' });
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
    var t  = trends().filter(function (x) { return x.sessions >= 2; }).slice(0, 3);

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

  window.EBBot = {
    load: load, messages: messages, trends: trends, series: series,
    consistency: consistency, neglectedDays: neglectedDays,
    e1rm: e1rm, block: block, bodyBlock: bodyBlock,
    lineChart: lineChart, weightPoints: weightPoints,
    data: function () { return { logs: LOGS, weighins: WEIGH }; }
  };
})();

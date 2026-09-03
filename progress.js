/* =====================================================================
   E.B FIT — השיפור השבועי של המתאמן
   ---------------------------------------------------------------------
   המתאמן שוקל את עצמו פעם בשבוע, והכרטיס אומר לו אם הוא זז בכיוון
   הנכון — לפי המטרה של התוכנית שלו ולא לפי כלל אחיד.

   ירידה של 400 גרם היא הצלחה למי שבחיטוב וכישלון למי שבבניית מסה,
   ולכן אותו מספר נצבע אחרת לכל אחד. למי שהמטרה לא חד-משמעית מוצג
   השינוי בלי שיפוט — עדיף מלהמציא כיוון.

   הכול נשמר במכשיר של המתאמן. אין כאן טבלה חדשה בשרת ואין מיגרציה
   להריץ — המשקל שהוא שוקל בבית הוא שלו, והמאמן ממשיך לראות את
   המדידות שהוא עצמו לוקח.
   ===================================================================== */
(function () {
  'use strict';

  (window.EB_MOD = window.EB_MOD || {})['progress'] = 'v63';

  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  var KEY = 'ebfit_prog';
  var DB  = { logs: [], workouts: {} };

  /* ---------- תאריכים בשעון המקומי ---------- */
  function isoOf(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
         + '-' + String(d.getDate()).padStart(2, '0');
  }
  /* השבוע מתחיל בראשון — כך נהוג כאן, ולא לפי ISO שמתחיל בשני */
  function weekOf(iso) {
    var d = new Date(iso + 'T00:00');
    d.setDate(d.getDate() - d.getDay());
    return isoOf(d);
  }
  function weekLabel(wIso) {
    var a = new Date(wIso + 'T00:00'), b = new Date(wIso + 'T00:00');
    b.setDate(b.getDate() + 6);
    var f = function (x) { return x.getDate() + '.' + (x.getMonth() + 1); };
    return f(a) + ' – ' + f(b);
  }
  function today() { return isoOf(new Date()); }

  /* ---------- אחסון ---------- */
  function load(token) {
    KEY = 'ebfit_prog_' + String(token || '').slice(0, 12);
    try { DB = JSON.parse(localStorage.getItem(KEY)) || { logs: [], workouts: {} }; }
    catch (e) { DB = { logs: [], workouts: {} }; }
    DB.logs = DB.logs || [];
    DB.workouts = DB.workouts || {};
    return DB;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch (e) {} }

  /* ---------- כיוון ההצלחה לפי המטרה ---------- */
  var DOWN = ['חיטוב', 'ירידה', 'הרזי', 'לרזות', 'שריפת שומן', 'אחוזי שומן', 'לרדת', 'הפחתת', 'דיאטה'];
  var UP   = ['מסה', 'עלייה', 'לעלות', 'בניית שריר', 'הגדלת', 'להעלות', 'בנייה', 'בניה', 'נפח'];
  var KEEP = ['שמירה', 'תחזוקה', 'שימור'];

  function has(txt, list) {
    for (var i = 0; i < list.length; i++) if (txt.indexOf(list[i]) > -1) return true;
    return false;
  }
  /* 'down' ירידה טובה · 'up' עלייה טובה · 'keep' יציבות טובה · null בלי שיפוט */
  function direction(goal) {
    var g = String(goal || '');
    if (!g.trim()) return null;
    var d = has(g, DOWN), u = has(g, UP);
    if (d && u) return 'keep';          // רה-קומפוזיציה: המשקל יציב וההרכב משתנה
    if (d) return 'down';
    if (u) return 'up';
    if (has(g, KEEP)) return 'keep';
    return null;
  }
  function dirName(dir) {
    return dir === 'down' ? 'ירידה במשקל'
         : dir === 'up'   ? 'עלייה במשקל'
         : dir === 'keep' ? 'משקל יציב' : '';
  }

  /* ---------- נתונים שבועיים ---------- */
  function byWeek() {
    var m = {};
    DB.logs.forEach(function (l) {
      var w = weekOf(l.date);
      /* השקילה האחרונה בשבוע קובעת — היא העדכנית ביותר */
      if (!m[w] || l.date >= m[w].date) m[w] = l;
    });
    return Object.keys(m).sort().map(function (w) { return { week: w, log: m[w] }; });
  }

  function num(v) { var n = Number(v); return isFinite(n) ? n : null; }
  function r1(x)  { return Math.round(x * 10) / 10; }

  /* ---------- הערכה ----------
     סף של 300 גרם: מתחתיו זו תנודת מים ומלח ולא שינוי אמיתי. צביעת
     רעש בירוק או באדום מלמדת את המתאמן להאמין לרעש. */
  var NOISE = 0.3;

  function judge(delta, dir) {
    if (delta === null) return { cls: 'flat', txt: '' };
    var a = Math.abs(delta);
    if (a < NOISE) return { cls: 'flat', txt: dir === 'keep' ? 'יציב — בדיוק המטרה' : 'ללא שינוי משמעותי' };
    if (!dir) return { cls: 'flat', txt: '' };
    if (dir === 'keep') {
      return a <= 0.7 ? { cls: 'good', txt: 'יציב — בדיוק המטרה' }
                      : { cls: 'warn', txt: 'תנודה גדולה מהרצוי' };
    }
    var good = dir === 'down' ? delta < 0 : delta > 0;
    return good ? { cls: 'good', txt: 'בכיוון הנכון' }
                : { cls: 'warn', txt: 'בכיוון ההפוך למטרה' };
  }

  /* ---------- גרף קו ---------- */
  function spark(rows) {
    if (rows.length < 2) return '';
    var vals = rows.map(function (r) { return r.log.w; });
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    var pad = (hi - lo) < 1 ? 1 : (hi - lo) * 0.18;
    lo -= pad; hi += pad;
    var W = 280, H = 62;
    var x = function (i) { return (i / (rows.length - 1)) * (W - 12) + 6; };
    var y = function (v) { return H - 8 - ((v - lo) / (hi - lo)) * (H - 18); };
    var pts = rows.map(function (r, i) { return x(i).toFixed(1) + ',' + y(r.log.w).toFixed(1); });
    var last = rows[rows.length - 1];
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:62px;margin-top:10px" '
      + 'role="img" aria-label="מגמת המשקל">'
      + '<polyline points="' + pts.join(' ') + '" fill="none" stroke="var(--or)" '
      + 'stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
      + rows.map(function (r, i) {
          return '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(r.log.w).toFixed(1) + '" r="'
            + (i === rows.length - 1 ? 3.5 : 2) + '" fill="var(--or)"/>';
        }).join('')
      + '<text x="' + x(rows.length - 1).toFixed(1) + '" y="' + (y(last.log.w) - 8).toFixed(1) + '" '
      + 'text-anchor="end" font-size="11" fill="var(--mut)">' + r1(last.log.w) + '</text>'
      + '</svg>';
  }

  /* ---------- הכרטיס ---------- */
  function block(data) {
    var dir  = direction((data && data.goal) || '');
    var rows = byWeek();
    var thisW = weekOf(today());
    var cur = null;
    rows.forEach(function (r) { if (r.week === thisW) cur = r; });
    var idx  = rows.map(function (r) { return r.week; }).indexOf(thisW);
    var prev = idx > 0 ? rows[idx - 1] : null;

    var wk = DB.workouts[thisW] || 0;
    var h = '<div class="card" style="margin-bottom:12px">'
      + '<div class="row" style="align-items:baseline;margin-bottom:2px">'
      + '<div style="flex:1;font-family:Heebo;font-weight:700;font-size:15px">השיפור שלי</div>'
      + (dir ? '<div class="mt" style="font-size:11.5px">היעד: ' + dirName(dir) + '</div>' : '')
      + '</div>';

    if (!rows.length) {
      return h
        + '<div class="mt" style="font-size:13px;line-height:1.6;margin:8px 0 12px">'
        + 'שקול את עצמך פעם בשבוע, באותו יום ובאותה שעה — הכי מדויק בבוקר, אחרי השירותים ולפני האוכל.'
        + '</div>'
        + logForm()
        + '<div class="mt" style="font-size:11.5px;margin-top:10px">'
        + 'השקילות נשמרות במכשיר הזה בלבד.</div></div>';
    }

    var delta = (cur && prev) ? r1(cur.log.w - prev.log.w) : null;
    var j = judge(delta, dir);
    var color = j.cls === 'good' ? 'var(--ok)' : j.cls === 'warn' ? '#D9605A' : 'var(--mut)';
    var arrow = delta === null ? '' : (delta > 0 ? '▲' : delta < 0 ? '▼' : '=');

    h += '<div class="row" style="align-items:center;gap:14px;margin-top:10px">'
      + '<div style="flex:none;text-align:center;min-width:98px">'
      + '<div style="font-family:Heebo;font-weight:900;font-size:26px;line-height:1;color:' + color + '">'
      + (delta === null ? '—' : arrow + ' ' + num2(Math.abs(delta))) + '</div>'
      + '<div class="mt" style="font-size:10.5px;margin-top:3px">'
      + (delta === null ? 'אין עדיין השוואה' : 'ק״ג מהשבוע שעבר') + '</div></div>'
      + '<div style="flex:1;min-width:0">'
      + (j.txt ? '<div style="font-size:13.5px;color:' + color + ';font-weight:500">' + j.txt + '</div>' : '')
      + '<div class="mt" style="font-size:12.5px;margin-top:3px">'
      + (cur ? 'נשקלת השבוע: ' + num2(r1(cur.log.w)) + ' ק״ג'
             : 'לא נשקלת השבוע — אחרונה ב-' + weekLabel(rows[rows.length - 1].week))
      + '</div></div></div>';

    if (rows.length >= 2) {
      var first = rows[0].log.w, lastW = rows[rows.length - 1].log.w;
      var tot = r1(lastW - first);
      var jt = judge(tot, dir);
      h += '<div class="row" style="gap:8px;margin-top:12px;flex-wrap:wrap">'
        + chip('מאז ההתחלה', (tot > 0 ? '+' : '') + tot + ' ק״ג',
               jt.cls === 'good' ? 'var(--ok)' : jt.cls === 'warn' ? '#D9605A' : null)
        + chip('שקילות', String(rows.length), null)
        + chip('אימונים השבוע', String(wk), wk > 0 ? 'var(--ok)' : null)
        + '</div>';
    }

    h += spark(rows.slice(-8));

    var loggedToday = DB.logs.some(function (l) { return l.date === today(); });
    h += '<div style="margin-top:12px">'
      + (loggedToday
          ? '<div class="mt" style="font-size:12.5px">✓ נשקלת היום · '
            + '<button data-pg="edit" style="background:none;border:0;color:var(--or);'
            + 'font:inherit;padding:0;cursor:pointer;text-decoration:underline">עדכון</button></div>'
          : logForm())
      + '</div>';

    if (rows.length >= 2) {
      h += '<details style="margin-top:10px">'
        + '<summary class="mt" style="font-size:12.5px;cursor:pointer">כל השקילות</summary>'
        + '<div style="margin-top:8px">'
        + '<div style="display:flex;gap:12px;font-size:10.5px;color:var(--dim);'
        + 'padding-bottom:5px;border-bottom:1px solid var(--line)">'
        + '<span style="flex:1;min-width:0">שבוע</span>'
        + '<span style="min-width:52px;text-align:center">ק״ג</span>'
        + '<span style="min-width:48px;text-align:center">שינוי</span></div>'
        + rows.slice().reverse().map(function (r, i, arr) {
            var nx = arr[i + 1];
            var d  = nx ? r1(r.log.w - nx.log.w) : null;
            return '<div style="display:flex;gap:12px;align-items:baseline;font-size:12.5px;'
              + 'padding:6px 0;border-bottom:1px solid var(--line)">'
              + '<span class="mt" style="flex:1;min-width:0">' + num2(weekLabel(r.week)) + '</span>'
              + '<span style="font-family:Heebo;font-weight:700;min-width:52px;text-align:center">'
              + num2(r1(r.log.w)) + '</span>'
              + '<span style="min-width:48px;text-align:center;font-family:Heebo;color:'
              + (d === null ? 'var(--dim)' : d < 0 ? 'var(--ok)' : d > 0 ? '#D9605A' : 'var(--dim)') + '">'
              + (d === null ? '—' : num2((d > 0 ? '+' : '') + d)) + '</span></div>';
          }).join('')
        + '</div></details>';
    }

    return h + '</div>';
  }

  function chip(label, val, color) {
    return '<span style="font-size:11.5px;padding:4px 10px;border-radius:20px;background:var(--ink);'
      + 'border:1px solid var(--line);white-space:nowrap">'
      + '<span class="mt">' + esc(label) + ' </span>'
      + '<b style="font-family:Heebo' + (color ? ';color:' + color : '') + '">' + num2(val) + '</b></span>';
  }

  /* מספר עם סימן בתוך משפט עברי מתהפך — "‎-2.4" מוצג כ-"2.4-".
     בידוד דו-כיווני מצמיד את הסימן למספר שאליו הוא שייך. */
  function num2(v) {
    return '<span dir="ltr" style="unicode-bidi:isolate;display:inline-block">' + esc(v) + '</span>';
  }

  function logForm() {
    return '<div class="row" style="gap:8px;align-items:stretch">'
      + '<input id="pg_w" type="number" inputmode="decimal" step="0.1" placeholder="משקל בק״ג" '
      + 'style="flex:1;min-width:0;background:var(--ink);border:1px solid var(--line);'
      + 'border-radius:9px;padding:10px;font-size:15px;text-align:center">'
      + '<button class="btn" data-pg="save" style="flex:none">רישום</button></div>';
  }

  /* ---------- פעולות ---------- */
  function add(w) {
    var v = num(w);
    if (v === null || v < 25 || v > 350) return false;
    var d = today();
    DB.logs = DB.logs.filter(function (l) { return l.date !== d; });
    DB.logs.push({ date: d, w: v });
    DB.logs.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    save();
    return true;
  }
  function clearToday() {
    var d = today();
    DB.logs = DB.logs.filter(function (l) { return l.date !== d; });
    save();
  }
  function logWorkout() {
    var w = weekOf(today());
    DB.workouts[w] = (DB.workouts[w] || 0) + 1;
    save();
  }

  window.EBProg = {
    load: load, block: block, add: add, clearToday: clearToday, logWorkout: logWorkout,
    direction: direction, weekOf: weekOf, judge: judge, db: function () { return DB; }
  };
})();

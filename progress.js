/* =====================================================================
   E.B FIT — השיפור השבועי של המתאמן
   ---------------------------------------------------------------------
   המתאמן שוקל את עצמו פעם בשבוע, והכרטיס אומר לו אם הוא זז בכיוון
   הנכון — לפי המטרה של התוכנית שלו ולא לפי כלל אחיד.

   ירידה של 400 גרם היא הצלחה למי שבחיטוב וכישלון למי שבבניית מסה,
   ולכן אותו מספר נצבע אחרת לכל אחד. למי שהמטרה לא חד-משמעית מוצג
   השינוי בלי שיפוט — עדיף מלהמציא כיוון.

   יום השקילה הוא חמישי. יום קבוע מייצר הרגל, ומשווה שבוע לשבוע
   באותם תנאים — משקל אחרי סוף שבוע אינו בר-השוואה למשקל של אמצע
   השבוע, וההפרש שנמדד הוא של המלח ולא של השומן.

   השקילות נשמרות במכשיר וגם בשרת דרך trainee_weigh. המכשיר קודם,
   כדי שהרישום יעבוד בחדר כושר בלי קליטה; השרת אחריו, כדי שהמאמן
   יראה, שהמעבר לטלפון חדש לא יאבד את ההיסטוריה, ושהשקילות ייכנסו
   לגיבוי — הן יושבות בעמודה weighins של trainees.
   ===================================================================== */
(function () {
  'use strict';

  (window.EB_MOD = window.EB_MOD || {})['progress'] = 'v104';

  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  var KEY = 'ebfit_prog';
  var DB  = { logs: [], workouts: {} };

  var SB = null, TOKEN = '';

  /* יום חמישי. getDay: 0 ראשון … 4 חמישי */
  var WEIGH_DAY = 4;

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
  function isWeighDay() { return new Date().getDay() === WEIGH_DAY; }

  /* כמה ימים נשארו עד חמישי הקרוב. 0 = היום */
  function daysToWeighDay() {
    return (WEIGH_DAY - new Date().getDay() + 7) % 7;
  }

  /* ---------- אחסון ---------- */
  function load(token) {
    TOKEN = String(token || '');
    KEY = 'ebfit_prog_' + TOKEN.slice(0, 12);
    try { DB = JSON.parse(localStorage.getItem(KEY)) || { logs: [], workouts: {} }; }
    catch (e) { DB = { logs: [], workouts: {} }; }
    DB.logs = DB.logs || [];
    DB.workouts = DB.workouts || {};
    return DB;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch (e) {} }

  /* ---------- השרת ----------
     המכשיר הוא מקור האמת לרישום עצמו, והשרת הוא עותק. מיזוג לפי
     תאריך: שקילה שקיימת בשני הצדדים אינה מוכפלת, ומה שנרשם במכשיר
     אחר מצטרף. שורה שטרם עלתה מסומנת ב-pend ונשלחת שוב בטעינה הבאה. */
  function attach(client, token) {
    SB = client || null;
    if (token) TOKEN = String(token);
  }

  function mergeServer(rows) {
    if (!Array.isArray(rows)) return;          // העמודה עוד לא קיימת בשרת
    var byDate = {};
    DB.logs.forEach(function (l) { byDate[l.date] = l; });
    rows.forEach(function (r) {
      if (!r || !r.date) return;
      var w = Number(r.weight);
      if (!isFinite(w) || w <= 0) return;
      /* שורה מקומית שממתינה לשליחה גוברת: היא חדשה מזו שבשרת */
      if (byDate[r.date] && byDate[r.date].pend) return;
      byDate[r.date] = { date: r.date, w: w };
    });
    DB.logs = Object.keys(byDate).sort().map(function (k) { return byDate[k]; });
    save();
    flush();
  }

  async function pushOne(log) {
    if (!SB || !TOKEN || !log) return false;
    try {
      var r = await SB.rpc('trainee_weigh', {
        p_token: TOKEN, p_date: log.date, p_weight: log.w, p_fat: null
      });
      if (r.error) throw r.error;
      return true;
    } catch (e) { return false; }
  }

  /* שולח את כל מה שממתין. נכשל בשקט — הרישום כבר במכשיר */
  async function flush() {
    if (!SB || !TOKEN) return;
    var pend = DB.logs.filter(function (l) { return l.pend; });
    for (var i = 0; i < pend.length; i++) {
      var ok = await pushOne(pend[i]);
      if (!ok) return;                         // אין רשת — לנסות בטעינה הבאה
      delete pend[i].pend;
      save();
    }
  }

  /* ---------- כיוון ההצלחה לפי המטרה ---------- */
  /* הרשימות זהות לאלה של analysis.js. שתי גרסאות שונות של אותה
     שאלה ייתנו למתאמן ולמאמן תשובות סותרות על אותה מטרה — וכך בדיוק
     נוצר הפער ש"בניית מסת שריר" לא זוהתה כאן ככיוון עלייה: הרשימה
     חיפשה "מסה", והניסוח הנפוץ הוא "מסת". */
  var DOWN = ['ירידה', 'להוריד', 'לרדת', 'חיטוב', 'לחטב', 'שריפת שומן',
              'הרזי', 'לרזות', 'אחוז שומן', 'אחוזי שומן', 'הפחתת', 'דיאטה'];
  var UP   = ['עלייה', 'עליה', 'לעלות', 'להעלות', 'מסה', 'מסת שריר', 'בניית מסת',
              'לבנות', 'בניית שריר', 'בנייה', 'בניה', 'הגדלת', 'נפח'];
  var KEEP = ['שמירה', 'לשמור', 'תחזוקה', 'שימור', 'להתמיד', 'בריאות', 'כושר כללי'];
  /* כוח אינו כיוון משקל. אפשר להתחזק מאוד בלי לעלות גרם, ולכן מי
     שמטרתו כוח בלבד לא נשפט לפי המאזניים. */
  var STRENGTH = ['כוח', 'חיזוק', 'להתחזק', 'שיאים'];

  function has(txt, list) {
    for (var i = 0; i < list.length; i++) if (txt.indexOf(list[i]) > -1) return true;
    return false;
  }
  /* 'down' · 'up' · 'keep' · 'strength' לא נמדד במאזניים · null בלי שיפוט */
  function direction(goal) {
    var g = String(goal || '');
    if (!g.trim()) return null;
    var d = has(g, DOWN), u = has(g, UP);
    if (d && u) return 'keep';          // רה-קומפוזיציה: המשקל יציב וההרכב משתנה
    if (d) return 'down';
    if (u) return 'up';
    if (has(g, KEEP)) return 'keep';
    if (has(g, STRENGTH)) return 'strength';
    return null;
  }
  function dirName(dir) {
    return dir === 'down'     ? 'ירידה במשקל'
         : dir === 'up'       ? 'עלייה במשקל'
         : dir === 'keep'     ? 'משקל יציב'
         : dir === 'strength' ? 'כוח — לא נמדד במאזניים' : '';
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
  function r2(x)  { return Math.round(x * 100) / 100; }

  /* ---------- הערכה ----------
     סף של 300 גרם: מתחתיו זו תנודת מים ומלח ולא שינוי אמיתי. צביעת
     רעש בירוק או באדום מלמדת את המתאמן להאמין לרעש. */
  var NOISE = 0.3;

  function judge(delta, dir) {
    if (delta === null) return { cls: 'flat', txt: '' };
    var a = Math.abs(delta);
    if (a < NOISE) return { cls: 'flat', txt: dir === 'keep' ? 'יציב — בדיוק המטרה' : 'ללא שינוי משמעותי' };
    if (!dir || dir === 'strength') return { cls: 'flat', txt: '' };
    if (dir === 'keep') {
      return a <= 0.7 ? { cls: 'good', txt: 'יציב — בדיוק המטרה' }
                      : { cls: 'warn', txt: 'תנודה גדולה מהרצוי' };
    }
    var good = dir === 'down' ? delta < 0 : delta > 0;
    return good ? { cls: 'good', txt: 'בכיוון הנכון' }
                : { cls: 'warn', txt: 'בכיוון ההפוך למטרה' };
  }

  /* ---------- הקצב שאליו הוא אמור להתקדם ----------
     כאחוז ממשקל הגוף לשבוע, ולא במספר קבוע: 700 גרם בשבוע הם קצב
     סביר למי ששוקל 110 ומהירים מדי למי ששוקל 55.

     ירידה   0.4%–1.0%  — מתחת לזה איטי, מעל זה בא על חשבון שריר
     עלייה   0.15%–0.5% — מעל זה רוב התוספת שומן ולא שריר
     שמירה   עד 0.4% לכל כיוון */
  var PACE = {
    down: { lo: 0.4,  hi: 1.0 },
    up:   { lo: 0.15, hi: 0.5 },
    keep: { lo: 0,    hi: 0.4 }
  };

  /* מגמה אמיתית נמדדת על ארבעה שבועות ולא על שבוע בודד: שבוע אחד
     הוא בעיקר מים. רגרסיה לינארית — שקילה חריגה אחת לא מטה אותה. */
  function trendPerWeek() {
    var cut = Date.now() - 28 * 86400000;
    var pts = DB.logs.filter(function (l) {
      return new Date(l.date + 'T00:00').getTime() >= cut;
    });
    if (pts.length < 3) return null;
    var t0 = new Date(pts[0].date + 'T00:00').getTime();
    var n = pts.length, sx = 0, sy = 0, sxy = 0, sxx = 0;
    for (var i = 0; i < n; i++) {
      var x = (new Date(pts[i].date + 'T00:00').getTime() - t0) / 86400000;
      var y = pts[i].w;
      sx += x; sy += y; sxy += x * y; sxx += x * x;
    }
    var den = n * sxx - sx * sx;
    if (!den) return null;
    return ((n * sxy - sx * sy) / den) * 7;    // ק״ג לשבוע
  }

  /* ---------- המאמן שבכרטיס ----------
     שלוש תשובות אפשריות: בקצב, איטי מהיעד, ולא בכיוון. מי שאין לו
     מטרה חד-משמעית או שאין לו מספיק שקילות מקבל עידוד להמשיך לשקול
     ולא שיפוט על סמך נקודה אחת. */
  function coach(dir, bw) {
    var rows = byWeek();
    if (!rows.length) {
      return { cls: 'flat', head: 'נתחיל למדוד',
               body: 'שקילה ראשונה היום, ומכאן כל יום חמישי. אחרי שלושה שבועות נדע בדיוק באיזה קצב אתה מתקדם.' };
    }
    if (dir === 'strength') {
      return { cls: 'flat', head: 'המאזניים אינם המדד שלך',
               body: 'המטרה שלך היא כוח, ואפשר להתחזק מאוד בלי לזוז גרם. תמשיך לשקול כדי לראות מגמה, '
                   + 'אבל תשפוט את עצמך לפי המשקלים שאתה מרים.' };
    }
    if (!dir) {
      return { cls: 'flat', head: 'ממשיכים לעקוב',
               body: 'המשך לשקול כל שבוע. כשהמאמן יגדיר מטרה מספרית, הכרטיס יראה לך אם אתה בקצב.' };
    }

    var per = trendPerWeek();
    if (per === null || !bw) {
      return { cls: 'flat', head: 'עוד קצת נתונים',
               body: 'צריך שלוש שקילות כדי לזהות מגמה אמיתית. יש לך ' + rows.length
                   + (rows.length === 1 ? ' שקילה' : ' שקילות') + ' — תמשיך, אתה בדרך.' };
    }

    var p   = PACE[dir];
    var pct = Math.abs(per) / bw * 100;
    var toward = dir === 'down' ? per < 0 : dir === 'up' ? per > 0 : true;
    var kg = r2(Math.abs(per));

    if (dir === 'keep') {
      if (pct <= p.hi) {
        return { cls: 'good', head: 'כל הכבוד — אתה בדיוק במטרה',
                 body: 'המשקל שלך יציב (' + r2(pct) + '% תנודה לשבוע). זו בדיוק המטרה, וזה קשה יותר ממה שזה נשמע.' };
      }
      return { cls: 'warn', head: 'המשקל מתנדנד',
               body: 'תנודה של ' + kg + ' ק״ג לשבוע היא מעל הרצוי. נסה לשמור על אותם תנאי שקילה — בוקר, אחרי השירותים, לפני האוכל — ולדייק את הכמויות.' };
    }

    /* לא בכיוון בכלל */
    if (!toward || pct < 0.1) {
      return { cls: 'warn',
               head: dir === 'down' ? 'השבועות האחרונים לא זזו' : 'עוד לא רואים עלייה',
               body: dir === 'down'
                 ? 'המשקל לא יורד. זה כמעט תמיד הכמויות ולא חילוף החומרים — שקול את השמן, הטחינה והאגוזים, ואל תדלג על ארוחות. תדבר עם המאמן, אתם מתקנים את זה יחד.'
                 : 'המשקל לא עולה. כנראה אתה אוכל פחות ממה שאתה חושב — הוסף ארוחה, העלה פחמימה סביב האימון, ואל תוותר על האוכל בימים שאין אימון. תדבר עם המאמן.' };
    }
    /* בכיוון אבל איטי */
    if (pct < p.lo) {
      return { cls: 'warn', head: 'בכיוון הנכון, אבל איטי',
               body: 'אתה זז ' + kg + ' ק״ג לשבוע (' + r2(pct) + '%), והיעד שלך הוא '
                   + p.lo + '%–' + p.hi + '%. הכיוון נכון — צריך לחדד את הביצוע. עוד שבועיים כאלה ונבין אם זה עניין של דיוק בכמויות.' };
    }
    /* מהר מדי */
    if (pct > p.hi) {
      return { cls: 'warn', head: 'מהר מדי',
               body: kg + ' ק״ג לשבוע (' + r2(pct) + '%) זה מעל היעד. '
                   + (dir === 'down'
                       ? 'ירידה מהירה באה על חשבון מסת שריר ולרוב חוזרת. תוסיף אוכל — זה לא כישלון, זה תיקון.'
                       : 'עלייה מהירה היא בעיקר שומן. תוריד קצת מהעודף ותשמור על העלייה איטית ונקייה.') };
    }
    /* בול בקצב */
    return { cls: 'good', head: 'כל הכבוד — התקדמת',
             body: 'אתה בקצב של ' + kg + ' ק״ג לשבוע (' + r2(pct) + '%), בדיוק בטווח היעד שלך. '
                 + 'תמשיך בדיוק ככה — זה מה שמייצר תוצאה שנשארת.' };
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

  /* ---------- תזכורת יום חמישי ---------- */
  function reminder(weighedThisWeek) {
    if (weighedThisWeek) return '';
    var left = daysToWeighDay();
    if (left === 0) {
      return '<div style="background:var(--or-soft);border:1px solid var(--or);border-radius:10px;'
        + 'padding:10px 12px;margin:10px 0;font-size:13px;line-height:1.55">'
        + '<b style="font-family:Heebo;color:var(--or)">היום יום השקילה.</b> '
        + 'עלה על המשקל בבוקר, אחרי השירותים ולפני האוכל, ורשום כאן.</div>';
    }
    return '<div class="mt" style="font-size:12.5px;margin:8px 0;line-height:1.55">'
      + 'יום השקילה הוא חמישי — עוד ' + (left === 1 ? 'יום' : left + ' ימים') + '. '
      + 'אפשר לשקול גם היום, רק תשמור על אותו יום בכל שבוע.</div>';
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
        + '<div class="mt" style="font-size:13px;line-height:1.6;margin:8px 0 4px">'
        + 'שקול את עצמך פעם בשבוע ביום חמישי, באותה שעה — הכי מדויק בבוקר, אחרי השירותים ולפני האוכל.'
        + '</div>'
        + reminder(false)
        + logForm()
        + '<div class="mt" style="font-size:11.5px;margin-top:10px">'
        + 'השקילות נשמרות במכשיר ונשלחות למאמן.</div></div>';
    }

    var delta = (cur && prev) ? r1(cur.log.w - prev.log.w) : null;
    var j = judge(delta, dir);
    var color = j.cls === 'good' ? 'var(--ok)' : j.cls === 'warn' ? '#D9605A' : 'var(--mut)';
    var arrow = delta === null ? '' : (delta > 0 ? '▲' : delta < 0 ? '▼' : '=');

    h += '<div class="row" style="align-items:center;gap:14px;margin-top:10px">'
      + '<div style="flex:none;text-align:center;min-width:98px">'
      + '<div style="font-family:Frank Ruhl Libre,serif;font-weight:900;font-size:34px;line-height:1;color:' + color + '">'
      + (delta === null ? '—' : arrow + ' ' + num2(Math.abs(delta))) + '</div>'
      + '<div class="mt" style="font-size:10.5px;margin-top:3px">'
      + (delta === null ? 'אין עדיין השוואה' : 'ק״ג מהשבוע שעבר') + '</div></div>'
      + '<div style="flex:1;min-width:0">'
      + (j.txt ? '<div style="font-size:13.5px;color:' + color + ';font-weight:500">' + j.txt + '</div>' : '')
      + '<div class="mt" style="font-size:12.5px;margin-top:3px">'
      + (cur ? 'נשקלת השבוע: ' + num2(r1(cur.log.w)) + ' ק״ג'
             : 'לא נשקלת השבוע — אחרונה ב-' + weekLabel(rows[rows.length - 1].week))
      + '</div></div></div>';

    /* ההודעה של המאמן — לפי המטרה ולפי הקצב בפועל */
    var bw = rows[rows.length - 1].log.w;
    var c  = coach(dir, bw);
    var cc = c.cls === 'good' ? 'var(--ok)' : c.cls === 'warn' ? '#D9605A' : 'var(--mut)';
    h += '<div style="margin-top:12px;padding:11px 12px;border-radius:10px;'
      + 'background:' + (c.cls === 'good' ? 'var(--ok)' : c.cls === 'warn' ? '#D9605A' : 'var(--mut)') + '14;'
      + 'border:1px solid ' + cc + '3A">'
      + '<div style="font-family:Heebo;font-weight:700;font-size:13.5px;color:' + cc + ';margin-bottom:3px">'
      + esc(c.head) + '</div>'
      + '<div style="font-size:12.5px;line-height:1.65;color:var(--txt)">' + esc(c.body) + '</div>'
      + '</div>';

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
          : reminder(!!cur) + logForm())
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
    DB.logs.push({ date: d, w: v, pend: true });
    DB.logs.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    save();
    flush();                                   // לא ממתינים — הרישום כבר נשמר
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
    direction: direction, weekOf: weekOf, judge: judge, coach: coach,
    attach: attach, mergeServer: mergeServer, flush: flush,
    isWeighDay: isWeighDay, daysToWeighDay: daysToWeighDay, trendPerWeek: trendPerWeek,
    PACE: PACE, WEIGH_DAY: WEIGH_DAY,
    db: function () { return DB; }
  };
})();

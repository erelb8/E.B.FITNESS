/* =====================================================================
   E.B FIT — דוח אוטומטי לכל מתאמן: יומי, שבועי וחודשי
   ---------------------------------------------------------------------
   הדוח נבנה מהנתונים שכבר קיימים ואינו דורש הזנה נוספת. כל מספר בו
   נגזר מרשומה אמיתית: אימונים שסומנו, שקילות, ארוחות שהמתאמן הוסיף,
   שיאים, ודיווחי ביצוע.

   שלוש החלטות שקבעו את המבנה:

   * שלוש תקופות ולא אחת. יום עונה על "מה קרה היום", שבוע על "האם
     השבוע היה טוב", וחודש על "האם זה בכלל עובד". מספר אחד לא עונה
     על השלושה.

   * ביצוע נמדד מול מה שתוכנן, לא כמספר מוחלט. שלושה אימונים מתוך
     שלושה ושלושה מתוך שישה הם אותו מספר וסיפור הפוך.

   * מה שאין נאמר במפורש. שדה ריק בדוח נראה כמו אפס, ואפס הוא טענה.
     חסר נתון נכתב "אין נתונים" ולא מוצג כתוצאה.
   ===================================================================== */
(function () {
  'use strict';

  (window.EB_MOD = window.EB_MOD || {})['reports'] = 'v102';

  var DAY = 86400000;

  var PERIODS = [
    { k: 'day',   he: 'יומי',  days: 1,  label: 'היום' },
    { k: 'week',  he: 'שבועי', days: 7,  label: '7 ימים' },
    { k: 'month', he: 'חודשי', days: 30, label: '30 ימים' }
  ];

  function iso(d) {
    var x = new Date(d), p = function (n) { return String(n).padStart(2, '0'); };
    return x.getFullYear() + '-' + p(x.getMonth() + 1) + '-' + p(x.getDate());
  }
  function ago(n) { return iso(Date.now() - n * DAY); }
  function num(v) { var n = Number(v); return isFinite(n) ? n : null; }
  function r1(x) { return Math.round(x * 10) / 10; }

  /* ---------- הדוח ---------- */
  function build(t, periodKey) {
    var P = PERIODS.find(function (x) { return x.k === periodKey; }) || PERIODS[1];
    var from = P.days === 1 ? iso(Date.now()) : ago(P.days - 1);
    var to = iso(Date.now());
    var inRange = function (d) { var s = String(d || ''); return s >= from && s <= to; };

    var S_ = (typeof S !== 'undefined') ? S : { sessions: [], measures: [], prs: [], daily: [] };

    /* ── אימונים ── */
    var mine = (S_.sessions || []).filter(function (s) {
      return s.traineeId === t.id && inRange(s.date);
    });
    var done = mine.filter(function (s) { return s.status === 'done'; }).length;
    var planned = mine.length;
    var cancelled = mine.filter(function (s) { return s.status === 'cancelled'; }).length;
    var adherence = planned ? Math.round(done / planned * 100) : null;

    /* ── משקל ── */
    var pts = [];
    (t.weighins || []).forEach(function (w) {
      if (w && w.date && num(w.weight)) pts.push({ date: w.date, w: num(w.weight), self: true });
    });
    (S_.measures || []).forEach(function (m) {
      if (m.traineeId === t.id && num(m.weight)) {
        var i = pts.findIndex(function (x) { return x.date === m.date; });
        var row = { date: m.date, w: num(m.weight), fat: num(m.fat) };
        if (i > -1) pts[i] = row; else pts.push(row);
      }
    });
    pts.sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
    var win = pts.filter(function (p) { return inRange(p.date); });

    var weight = null;
    if (win.length >= 2) {
      weight = { from: win[0].w, to: win[win.length - 1].w, delta: r1(win[win.length - 1].w - win[0].w), n: win.length };
    } else if (win.length === 1) {
      weight = { from: null, to: win[0].w, delta: null, n: 1 };
    } else if (pts.length) {
      weight = { from: null, to: pts[pts.length - 1].w, delta: null, n: 0, stale: pts[pts.length - 1].date };
    }

    /* כיוון המטרה — אותו מנוע שמשמש את בוט ההתקדמות, כדי ששני
       המסכים לא יגידו דברים סותרים על אותו מתאמן. */
    var dir = null, verdict = null;
    if (window.EBAnalyze) {
      var ans = (t.intake && t.intake.answers) || {};
      dir = EBAnalyze.direction(t.goal || ans.goal, ans.goal2);
      if (weight && weight.delta != null && dir && dir !== 'strength') {
        var d = weight.delta, a = Math.abs(d);
        if (a < 0.3) verdict = dir === 'keep' ? 'good' : 'flat';
        else if (dir === 'keep') verdict = 'warn';
        else verdict = ((dir === 'down' && d < 0) || (dir === 'up' && d > 0)) ? 'good' : 'bad';
      }
    }

    /* ── שיאים ── */
    var prs = (S_.prs || []).filter(function (p) {
      return p.traineeId === t.id && inRange(p.date);
    });

    /* ── ארוחות שהמתאמן הוסיף ── */
    var meals = (t.mealsSelf || []).filter(function (m) { return inRange(m.at); });

    /* ── תרגילים שהוסיף ── */
    var exSelf = (t.exercisesSelf || []).filter(function (e) { return inRange(e.at); });

    /* ── מעקב יומי ── */
    var daily = (S_.daily || []).filter(function (d) {
      return d.traineeId === t.id && inRange(d.date);
    });

    /* ── שתיקה ── */
    var lastActive = null;
    (S_.sessions || []).forEach(function (s) {
      if (s.traineeId === t.id && s.status === 'done' && (!lastActive || s.date > lastActive)) lastActive = s.date;
    });
    var silentDays = lastActive
      ? Math.floor((Date.now() - new Date(lastActive).getTime()) / DAY)
      : null;

    return {
      period: P, from: from, to: to,
      sessions: { planned: planned, done: done, cancelled: cancelled, adherence: adherence },
      weight: weight, dir: dir, verdict: verdict,
      prs: prs, meals: meals.length, exercises: exSelf.length, daily: daily.length,
      lastActive: lastActive, silentDays: silentDays,
      hasAny: !!(planned || (weight && weight.n) || prs.length || meals.length || exSelf.length || daily.length)
    };
  }

  /* ---------- שורה אחת בדוח ---------- */
  function line(label, value, sub, tone) {
    var C = { good: '#1E8449', warn: '#B9770E', bad: '#C0392B' };
    var c = C[tone] || 'var(--tx)';
    return '<div class="rep-row">'
      + '<span class="rep-lbl">' + esc(label) + '</span>'
      + '<span class="rep-val" style="color:' + c + '">' + value + '</span>'
      + (sub ? '<span class="rep-sub">' + esc(sub) + '</span>' : '')
      + '</div>';
  }

  /* ---------- הטאב ---------- */
  function tab(t) {
    var key = (typeof REPORT_PERIOD !== 'undefined' && REPORT_PERIOD) ? REPORT_PERIOD : 'week';
    var r = build(t, key);

    var h = '<div class="card"><div class="row" style="margin-bottom:12px;gap:6px;flex-wrap:wrap">'
      + '<h3 style="flex:1;font-size:15px;min-width:120px">דוח ' + esc(r.period.he) + '</h3>'
      + PERIODS.map(function (p) {
          return '<button class="btn sm' + (p.k === key ? '' : ' ghost') + '" '
               + 'onclick="setReportPeriod(\'' + p.k + '\')">' + p.he + '</button>';
        }).join('')
      + '</div>'
      + '<div class="muted" style="font-size:12px;margin-bottom:14px">'
      + esc(fmtFull(r.from)) + (r.from !== r.to ? ' — ' + esc(fmtFull(r.to)) : '')
      + ' · מחושב אוטומטית</div>';

    if (!r.hasAny) {
      h += '<div class="empty" style="padding:22px">אין נתונים בתקופה הזאת.<br>'
        + '<span class="muted" style="font-size:12.5px">אימונים שיסומנו, שקילות ודיווחים יופיעו כאן מיד.</span></div></div>';
      return h;
    }

    /* אימונים */
    h += '<div class="rep-sec">אימונים</div>';
    if (r.sessions.planned) {
      h += line('בוצעו', r.sessions.done + '<span class="rep-of">/' + r.sessions.planned + '</span>',
        r.sessions.adherence != null ? r.sessions.adherence + '% ביצוע' : '',
        r.sessions.adherence == null ? null
          : r.sessions.adherence >= 80 ? 'good' : r.sessions.adherence >= 50 ? 'warn' : 'bad');
      if (r.sessions.cancelled) h += line('בוטלו', r.sessions.cancelled, '', 'warn');
    } else {
      h += line('בוצעו', '—', 'לא תוכננו אימונים בתקופה');
    }
    if (r.silentDays != null && r.silentDays > 7) {
      h += line('אימון אחרון', 'לפני ' + r.silentDays + ' ימים', esc(fmtFull(r.lastActive)), 'bad');
    }

    /* משקל */
    h += '<div class="rep-sec">משקל</div>';
    if (r.weight && r.weight.delta != null) {
      var d = r.weight.delta;
      h += line('שינוי', (d > 0 ? '+' : '') + d + ' ק״ג',
        r.weight.from + ' ← ' + r.weight.to + ' · ' + r.weight.n + ' שקילות', r.verdict);
      if (r.dir === 'strength') {
        h += '<div class="rep-note">המטרה כוח — המשקל אינו המדד. ההתקדמות נמדדת בעומס.</div>';
      }
    } else if (r.weight && r.weight.n === 1) {
      h += line('משקל', r.weight.to + ' ק״ג', 'שקילה אחת בלבד — צריך שתיים למגמה');
    } else if (r.weight && r.weight.stale) {
      h += line('משקל', r.weight.to + ' ק״ג', 'נמדד ' + esc(fmtFull(r.weight.stale)) + ', מחוץ לתקופה', 'warn');
    } else {
      h += line('משקל', '—', 'אין שקילות');
    }

    /* פעילות המתאמן */
    h += '<div class="rep-sec">מה המתאמן עשה בעצמו</div>';
    h += line('ארוחות שהוסיף', r.meals || '—', '');
    h += line('תרגילים שהוסיף', r.exercises || '—', '');
    if (r.daily) h += line('דיווחי מעקב', r.daily, '');
    if (r.prs.length) {
      h += line('שיאים חדשים', r.prs.length, r.prs.slice(0, 3).map(function (p) {
        return p.exercise + ' ' + p.value;
      }).join(' · '), 'good');
    }

    h += '</div>';
    return h;
  }

  window.EBReports = { build: build, tab: tab, PERIODS: PERIODS };
})();

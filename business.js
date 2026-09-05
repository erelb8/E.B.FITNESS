/* =====================================================================
   E.B FIT — ניתוח העסק
   ---------------------------------------------------------------------
   נותן ציון 0-100 בשישה תחומים, ומתרגם כל ממצא לפעולה אחת קונקרטית.

   שני כללים שקבעו את הבנייה:

   * תחום בלי נתונים לא מקבל ציון נמוך — הוא יוצא מהחישוב לגמרי.
     ציון 20 על "אין נתוני הכנסה" היה מעניש את המאמן על כך שלא
     הזין נתונים, ומטה את הציון הכולל בלי שום קשר למצב העסק.

   * כל ממצא נושא פעולה. "שימור חלש" הוא לא תובנה; "שלושה מתאמנים
     לא סימנו אימון מעל שבועיים, לשלוח להם הודעה היום" זו תובנה.
   ===================================================================== */
(function () {
  'use strict';

  (window.EB_MOD = window.EB_MOD || {})['business'] = 'v68';

  var DAY = 86400000;
  function iso(d) { return new Date(d).toISOString().slice(0, 10); }
  function daysAgo(n) { return iso(Date.now() - n * DAY); }
  function since(d) { return Math.round((Date.now() - new Date(d).getTime()) / DAY); }
  function n0(v) { var x = Number(v); return isFinite(x) ? x : 0; }
  function pct(a, b) { return b > 0 ? Math.round(a / b * 100) : 0; }
  function money(v) { return '₪' + Math.round(v).toLocaleString('en-US'); }

  /* ממפה יחס 0..1 לציון, עם רצפה כדי שתחום חלש לא יאפס את הכל */
  function grade(ratio) { return Math.max(0, Math.min(100, Math.round(ratio * 100))); }

  function act(level, txt, action) { return { level: level, txt: txt, action: action || '' }; }

  /* ================= 1. הכנסות ================= */
  function revenue(S) {
    var p = S.payments || [];
    if (!p.length) return { skip: true, name: 'הכנסות', why: 'לא נרשמו תשלומים' };

    var d30 = daysAgo(30), d60 = daysAgo(60), d90 = daysAgo(90);
    var sum = function (from, to) {
      return p.filter(function (x) { var d = x.date || ''; return d >= from && (!to || d < to); })
              .reduce(function (a, x) { return a + n0(x.amount); }, 0);
    };
    var last30 = sum(d30), prev30 = sum(d60, d30), q = sum(d90);
    var avg30 = q / 3;

    /* ריכוזיות: כמה מההכנסה תלויה במתאמן אחד */
    var byT = {};
    p.filter(function (x) { return (x.date || '') >= d90; })
     .forEach(function (x) { byT[x.traineeId] = (byT[x.traineeId] || 0) + n0(x.amount); });
    var vals = Object.keys(byT).map(function (k) { return byT[k]; }).sort(function (a, b) { return b - a; });
    var topShare = q > 0 && vals.length ? vals[0] / q : 0;

    var debt = (S.trainees || []).reduce(function (a, t) { return a + n0(t.balanceDue); }, 0);

    var f = [];
    var trend = prev30 > 0 ? (last30 - prev30) / prev30 : null;
    if (trend !== null && trend < -0.15) {
      f.push(act('bad', 'ההכנסה ירדה ' + Math.round(-trend * 100) + '% מול החודש הקודם ('
        + money(last30) + ' מול ' + money(prev30) + ')', 'לבדוק מי הפסיק לשלם'));
    } else if (trend !== null && trend > 0.15) {
      f.push(act('good', 'ההכנסה עלתה ' + Math.round(trend * 100) + '% מול החודש הקודם', ''));
    } else {
      f.push(act('ok', 'הכנסה חודשית ' + money(last30) + ', ממוצע רבעוני ' + money(avg30), ''));
    }
    if (topShare > 0.3 && vals.length > 1) {
      f.push(act('warn', Math.round(topShare * 100) + '% מההכנסה הרבעונית מגיעה ממתאמן אחד',
        'תלות גבוהה במתאמן בודד — עזיבה שלו פוגעת מיידית. להרחיב את הבסיס'));
    }
    if (debt > 0) {
      f.push(act('warn', 'חוב פתוח ' + money(debt), 'לגבות לפני שהוא הופך לחוב אבוד'));
    }

    /* ציון: מגמה (חצי) + היעדר ריכוזיות וחוב (חצי) */
    var sTrend = trend === null ? 0.6 : Math.max(0, Math.min(1, 0.6 + trend));
    var sRisk = 1 - Math.min(1, topShare) * 0.6 - (last30 > 0 ? Math.min(0.4, debt / Math.max(last30, 1) * 0.4) : 0);
    return {
      name: 'הכנסות', score: grade(sTrend * 0.5 + Math.max(0, sRisk) * 0.5), findings: f,
      metrics: { last30: last30, prev30: prev30, avg30: avg30, debt: debt, topShare: topShare }
    };
  }

  /* ================= 2. שימור ================= */
  function retention(S) {
    var act_ = (S.trainees || []).filter(function (t) { return t.status !== 'archived'; });
    if (!act_.length) return { skip: true, name: 'שימור', why: 'אין מתאמנים פעילים' };

    var ss = S.sessions || [];
    var lastDone = {};
    ss.filter(function (x) { return x.status === 'done'; }).forEach(function (x) {
      if (!lastDone[x.traineeId] || x.date > lastDone[x.traineeId]) lastDone[x.traineeId] = x.date;
    });

    var silent = [], lowPack = [], noSess = [];
    act_.forEach(function (t) {
      var d = lastDone[t.id];
      if (!d) noSess.push(t);
      else if (since(d) > 14) silent.push({ t: t, d: since(d) });
    });

    var f = [];
    if (silent.length) {
      f.push(act('bad', silent.length + ' מתאמנים לא סימנו אימון מעל שבועיים: '
        + silent.slice(0, 4).map(function (x) { return x.t.name + ' (' + x.d + ' ימים)'; }).join(', '),
        'לשלוח הודעה היום. מתאמן ששותק שבועיים כבר בדרך החוצה'));
    }
    if (noSess.length) {
      f.push(act('warn', noSess.length + ' מתאמנים בלי אף אימון שבוצע',
        'או שהם לא התחילו, או שהאימונים לא מסומנים'));
    }
    if (!f.length) f.push(act('good', 'כל המתאמנים פעילים ומסמנים אימונים', ''));

    var healthy = act_.length - silent.length - noSess.length;
    return {
      name: 'שימור', score: grade(healthy / act_.length), findings: f,
      metrics: { active: act_.length, silent: silent.length, lowPack: lowPack.length }
    };
  }

  /* ================= 3. תפוסה ותמחור ================= */
  function capacity(S) {
    var ss = (S.sessions || []).filter(function (x) { return x.status === 'done'; });
    if (!ss.length) return { skip: true, name: 'תפוסה', why: 'אין אימונים מסומנים' };

    var d30 = daysAgo(30);
    var done30 = ss.filter(function (x) { return (x.date || '') >= d30; }).length;
    var perWeek = done30 / 4.3;

    var prices = (S.trainees || []).filter(function (t) { return t.status !== 'archived' && n0(t.pricePerSession) > 0; })
                                   .map(function (t) { return n0(t.pricePerSession); });
    var avgPrice = prices.length ? prices.reduce(function (a, b) { return a + b; }, 0) / prices.length : 0;
    var listPrice = n0(S.settings && S.settings.sessionPrice);

    var f = [];
    f.push(act('ok', Math.round(perWeek) + ' אימונים בשבוע בממוצע (' + done30 + ' ב-30 יום)', ''));
    if (avgPrice && listPrice && avgPrice < listPrice * 0.9) {
      f.push(act('warn', 'מחיר ממוצע בפועל ' + money(avgPrice) + ' מול מחירון ' + money(listPrice),
        'יש הנחות שלא נסגרו. פער של ' + money(listPrice - avgPrice) + ' לאימון מצטבר לסכום גדול'));
    }
    if (perWeek > 0 && perWeek < 8) {
      f.push(act('warn', 'תפוסה נמוכה — פחות משמונה אימונים בשבוע',
        'יש מקום פנוי. זה הזמן לשווק, לא כשהיומן מלא'));
    } else if (perWeek >= 25) {
      f.push(act('warn', 'תפוסה גבוהה מאוד — ' + Math.round(perWeek) + ' בשבוע',
        'קרוב לתקרה. או להעלות מחיר, או להתחיל להעביר מתאמנים לליווי דיגיטלי'));
    }
    var revPerWeek = perWeek * (avgPrice || listPrice);
    f.push(act('ok', 'שווי שבועי משוער ' + money(revPerWeek), ''));

    /* טווח בריא: 8-25 אימונים בשבוע */
    var occ = perWeek <= 0 ? 0 : (perWeek < 8 ? perWeek / 8 : (perWeek > 25 ? 0.85 : 1));
    var price = (avgPrice && listPrice) ? Math.min(1, avgPrice / listPrice) : 0.8;
    return {
      name: 'תפוסה ותמחור', score: grade(occ * 0.6 + price * 0.4), findings: f,
      metrics: { perWeek: perWeek, done30: done30, avgPrice: avgPrice, listPrice: listPrice }
    };
  }

  /* ================= 4. איכות הליווי ================= */
  function quality(S) {
    var act_ = (S.trainees || []).filter(function (t) { return t.status !== 'archived'; });
    if (!act_.length) return { skip: true, name: 'איכות הליווי', why: 'אין מתאמנים' };

    var noProg = act_.filter(function (t) { return !(t.program && t.program.days && t.program.days.length); });
    var thin = act_.filter(function (t) {
      var d = (t.program && t.program.days) || [];
      return d.length && d.some(function (x) { return ((x.exercises || []).length) < 9; });
    });
    var noTarget = act_.filter(function (t) { return !(t.program && t.program.targets && t.program.targets.kcal); });
    var noWeigh = act_.filter(function (t) {
      var w = (t.weighins || []).length + (S.measures || []).filter(function (m) { return m.traineeId === t.id; }).length;
      return w < 2;
    });

    var f = [];
    if (noProg.length) f.push(act('bad', noProg.length + ' מתאמנים בלי תוכנית: '
      + noProg.slice(0, 4).map(function (t) { return t.name; }).join(', '), 'לבנות תוכנית או לארכב'));
    if (thin.length) f.push(act('warn', thin.length + ' מתאמנים עם ימים מתחת לתשעה תרגילים',
      'להשלים דרך ספריית התרגילים'));
    if (noTarget.length) f.push(act('warn', noTarget.length + ' בלי יעדי תזונה מחושבים',
      'חסרים גיל, גובה או משקל — בלעדיהם אין חישוב'));
    if (noWeigh.length) f.push(act('warn', noWeigh.length + ' עם פחות משתי שקילות',
      'בלי שתי נקודות אין מגמה, והבוט לא יכול לומר אם זה עובד'));
    if (!f.length) f.push(act('good', 'לכל המתאמנים תוכנית, יעדים ומדידות', ''));

    var ok = act_.length * 4 - noProg.length - thin.length - noTarget.length - noWeigh.length;
    return {
      name: 'איכות הליווי', score: grade(ok / (act_.length * 4)), findings: f,
      metrics: { noProg: noProg.length, thin: thin.length, noTarget: noTarget.length, noWeigh: noWeigh.length }
    };
  }

  /* ================= 5. בטיחות ================= */
  function safety(S) {
    if (typeof EBHealth === 'undefined') return { skip: true, name: 'בטיחות', why: 'מודול הבריאות לא נטען' };
    var act_ = (S.trainees || []).filter(function (t) { return t.status !== 'archived'; });
    if (!act_.length) return { skip: true, name: 'בטיחות', why: 'אין מתאמנים' };

    var red = [], unknown = [], unsigned = [];
    act_.forEach(function (t) {
      var r = EBHealth.screen(t, null);
      if (r.needsClearance) red.push(t);
      if (r.level === 'unknown') unknown.push(t);
      if (!r.signed) unsigned.push(t);
    });

    var f = [];
    if (red.length) f.push(act('bad', red.length + ' מתאמנים דורשים אישור רופא: '
      + red.map(function (t) { return t.name; }).join(', '),
      'אין להתחיל או להמשיך אימון בלי אישור בכתב. זו החשיפה הגדולה ביותר של העסק'));
    if (unknown.length) f.push(act('warn', unknown.length + ' בלי מספיק מידע כדי לקבוע סיכון',
      'לשלוח להם את הקישור האישי למילוי ההצהרה'));
    if (unsigned.length) f.push(act('warn', unsigned.length + ' לא חתמו על הצהרת בריאות',
      'הצהרה חתומה היא גם בטיחות וגם הגנה משפטית עליך'));
    if (!f.length) f.push(act('good', 'כל המתאמנים חתומים ומסוננים', ''));

    var clean = act_.length - red.length * 1.5 - unknown.length * 0.4 - unsigned.length * 0.35;
    return {
      name: 'בטיחות', score: grade(Math.max(0, clean) / act_.length), findings: f,
      metrics: { red: red.length, unknown: unknown.length, unsigned: unsigned.length }
    };
  }

  /* ================= 6. תקינות נתונים ================= */
  function data(S) {
    var act_ = (S.trainees || []).filter(function (t) { return t.status !== 'archived'; });
    if (!act_.length) return { skip: true, name: 'נתונים', why: 'אין מתאמנים' };

    var noPhone = act_.filter(function (t) { return !String(t.phone || '').trim(); });
    var noGoal = act_.filter(function (t) { return String(t.goal || '').trim().length < 3; });
    /* מטרה שהיא שבר של שאלה מהשאלון ולא מטרה אמיתית */
    var badGoal = act_.filter(function (t) { return /\?|יחשב|מבחינתך/.test(String(t.goal || '')); });
    var noBody = act_.filter(function (t) { return !n0(t.height) || !(t.birth || (t.intake && t.intake.answers && t.intake.answers.birthOrAge)); });

    var f = [];
    if (noPhone.length) f.push(act('bad', noPhone.length + ' מתאמנים בלי טלפון: '
      + noPhone.map(function (t) { return t.name; }).join(', '), 'אין דרך ליצור איתם קשר'));
    if (badGoal.length) f.push(act('warn', badGoal.length + ' עם שדה מטרה שנקלט שגוי מהשאלון: '
      + badGoal.map(function (t) { return t.name; }).join(', '),
      'הבוט לא יכול לשפוט התקדמות בלי מטרה תקינה'));
    if (noGoal.length) f.push(act('warn', noGoal.length + ' בלי מטרה', 'למלא בכרטיס המתאמן'));
    if (noBody.length) f.push(act('warn', noBody.length + ' בלי גובה או גיל', 'בלעדיהם אין חישוב יעדים ואין סינון גיל'));
    if (!f.length) f.push(act('good', 'הנתונים מלאים', ''));

    var bad = noPhone.length + badGoal.length + noGoal.length + noBody.length;
    return {
      name: 'תקינות נתונים', score: grade(1 - Math.min(1, bad / (act_.length * 4))), findings: f,
      metrics: { noPhone: noPhone.length, badGoal: badGoal.length, noBody: noBody.length }
    };
  }

  /* ================= הרכבה ================= */
  var WEIGHT = { 'בטיחות': 1.6, 'שימור': 1.4, 'הכנסות': 1.4, 'איכות הליווי': 1.2, 'תפוסה ותמחור': 1.0, 'תקינות נתונים': 0.8 };

  function analyze(st) {
    var S_ = st || (typeof S !== 'undefined' ? S : { trainees: [], sessions: [], payments: [], measures: [] });
    var secs = [revenue(S_), retention(S_), capacity(S_), quality(S_), safety(S_), data(S_)];

    var scored = secs.filter(function (x) { return !x.skip; });
    var wSum = 0, tot = 0;
    scored.forEach(function (x) {
      var w = WEIGHT[x.name] || 1;
      x.weight = w; wSum += w; tot += x.score * w;
    });
    var score = wSum ? Math.round(tot / wSum) : null;

    /* פעולות, החמורות קודם */
    var RANK = { bad: 0, warn: 1, ok: 2, good: 3 };
    var actions = [];
    scored.forEach(function (x) {
      x.findings.forEach(function (f) {
        if (f.action) actions.push({ sec: x.name, level: f.level, txt: f.txt, action: f.action });
      });
    });
    actions.sort(function (a, b) { return RANK[a.level] - RANK[b.level]; });

    return {
      score: score,
      grade: score == null ? '—' : (score >= 85 ? 'מצוין' : score >= 70 ? 'טוב' : score >= 55 ? 'בינוני' : score >= 40 ? 'חלש' : 'דורש טיפול'),
      sections: secs, scored: scored, actions: actions,
      skipped: secs.filter(function (x) { return x.skip; })
    };
  }

  window.EBBiz = { analyze: analyze, WEIGHT: WEIGHT, _money: money };
})();

/* ===================== מסך הניתוח ===================== */
(function () {
  'use strict';
  if (!window.EBBiz) return;

  function col(s) { return s >= 85 ? '#1E8449' : s >= 70 ? '#5E7A2E' : s >= 55 ? '#B9770E' : '#C0392B'; }
  var LC = { bad: '#C0392B', warn: '#B9770E', ok: '#6B5B47', good: '#1E8449' };

  function view() {
    var r = EBBiz.analyze();
    var h = head('ניתוח העסק', 'ציון בשישה תחומים, וכל ממצא מתורגם לפעולה אחת', '');

    if (r.score == null) {
      return h + '<div class="empty"><div class="big">📊</div>אין מספיק נתונים לניתוח.<br>'
        + '<span class="muted" style="font-size:13px">צריך מתאמנים, אימונים מסומנים ותשלומים רשומים.</span></div>';
    }

    h += '<div class="card" style="text-align:center;border-color:' + col(r.score) + '55;background:' + col(r.score) + '0D">'
      + '<div style="font-weight:900;font-size:56px;line-height:1;color:' + col(r.score) + ';direction:ltr;'
      + 'font-variant-numeric:tabular-nums">' + r.score + '</div>'
      + '<div style="font-weight:800;font-size:16px;margin-top:6px">' + r.grade + '</div>'
      + '<div class="muted" style="font-size:12.5px;margin-top:6px">מתוך 100 · '
      + r.scored.length + ' תחומים נמדדו'
      + (r.skipped.length ? ' · ' + r.skipped.length + ' ללא נתונים' : '') + '</div></div>';

    /* התחומים */
    h += '<div class="grid stats-auto" style="margin-bottom:14px">'
      + r.scored.map(function (s) {
          return '<div class="card stat"><div class="lbl">' + esc(s.name) + '</div>'
            + '<div class="val" style="color:' + col(s.score) + '">' + s.score + '</div>'
            + '<div class="sub">משקל ' + s.weight + '</div></div>';
        }).join('') + '</div>';

    /* מה לעשות */
    if (r.actions.length) {
      h += '<div class="card"><h3 style="font-size:15px;margin-bottom:10px">מה לעשות, לפי סדר</h3>';
      r.actions.slice(0, 12).forEach(function (a, i) {
        h += '<div style="padding:11px 0;border-top:' + (i ? '1px solid var(--line)' : '0') + '">'
          + '<div style="display:flex;gap:8px;align-items:flex-start">'
          + '<span style="flex:none;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;'
          + 'font-size:11px;font-weight:800;background:' + LC[a.level] + '1A;color:' + LC[a.level] + '">' + (i + 1) + '</span>'
          + '<div style="flex:1;min-width:0">'
          + '<div style="font-size:13.5px;font-weight:600;line-height:1.5">' + esc(a.txt) + '</div>'
          + '<div class="muted" style="font-size:12.5px;margin-top:3px;line-height:1.5">' + esc(a.action) + '</div>'
          + '<div style="font-size:11px;color:var(--dim);margin-top:3px">' + esc(a.sec) + '</div>'
          + '</div></div></div>';
      });
      h += '</div>';
    }

    /* פירוט לפי תחום */
    r.scored.forEach(function (s) {
      h += '<div class="card"><div class="row" style="margin-bottom:8px">'
        + '<h3 style="flex:1;font-size:15px">' + esc(s.name) + '</h3>'
        + '<b style="color:' + col(s.score) + '">' + s.score + '</b></div>';
      s.findings.forEach(function (f) {
        h += '<div style="padding:7px 0;font-size:13.5px;line-height:1.6">'
          + '<span style="color:' + LC[f.level] + ';font-weight:800">•</span> ' + esc(f.txt)
          + (f.action ? '<div class="muted" style="font-size:12.5px;margin-right:14px">' + esc(f.action) + '</div>' : '')
          + '</div>';
      });
      h += '</div>';
    });

    if (r.skipped.length) {
      h += '<div class="card"><div class="muted" style="font-size:12.5px;line-height:1.7">'
        + 'לא נמדדו מחוסר נתונים: '
        + r.skipped.map(function (s) { return esc(s.name) + ' (' + esc(s.why) + ')'; }).join(' · ')
        + '<br>תחום בלי נתונים יוצא מהחישוב ולא מקבל ציון נמוך — אחרת הציון היה מודד '
        + 'כמה הוזן למערכת ולא איך העסק עובד.</div></div>';
    }
    return h;
  }

  EBBiz.view = view;
})();

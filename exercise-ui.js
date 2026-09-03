/* =====================================================================
   E.B FIT — בחירה מספריית התרגילים
   ---------------------------------------------------------------------
   נפתח מתוך יום אימון מסוים, ולכן ההוספה נכנסת בדיוק לאן שצריך בלי
   לבחור יום פעם נוספת. הסטים והחזרות שמגיעים עם התרגיל הם נקודת
   פתיחה — הם נכנסים לטבלה ואפשר לערוך אותם שם כרגיל.
   ===================================================================== */
(function () {
  'use strict';

  (window.EB_MOD = window.EB_MOD || {})['exUi'] = 'v65';

  var Q = '', MUS = 'all', EQ = 'all', FOR = null, DAY = 0, TARGET = null;

  /* הספרייה משמשת שני מקומות: יום בתוכנית השמורה, ויום בטיוטה של
     הבונה שעוד לא הוחלה. TARGET מפריד ביניהם — בלעדיו ההוספה מהבונה
     הייתה נכתבת ישר לתוכנית ועוקפת את "החלפה או הוספה". */
  function currentDay() {
    if (TARGET) return TARGET.day();
    var t = tById(FOR);
    return (((t || {}).program || {}).days || [])[DAY];
  }

  function chip(txt, on, attr) {
    return '<button class="btn sm ' + (on ? '' : 'ghost') + '" ' + attr + '>' + esc(txt) + '</button>';
  }

  function open(traineeId, dayIndex, target) {
    FOR = traineeId; DAY = dayIndex; TARGET = target || null;
    Q = ''; MUS = 'all'; EQ = 'all';
    paint();
  }

  function paint() {
    var t = tById(FOR); if (!t) return;
    var day = currentDay();
    if (!day) return;
    var have = (day.exercises || []).map(function (e) { return String(e.name || '').trim(); });
    var items = EBEx.search(Q, MUS, EQ);
    var byM = EBEx.byMuscle(), byE = EBEx.byEquip();

    var h = '<div class="mh"><h3>ספריית התרגילים</h3>'
      + '<button class="iconbtn" onclick="EBExUI.close()">✕</button></div><div class="mb">'
      + '<div class="muted" style="font-size:12.5px;margin-bottom:10px">'
      + 'מוסיף אל <b style="color:var(--tx)">' + esc(day.name || ('יום ' + (DAY + 1))) + '</b>'
      + '</div>'
      + '<div class="search" style="margin-bottom:10px"><span>⌕</span>'
      + '<input id="ex_q" placeholder="חיפוש לפי שם, שריר או ציוד" value="' + esc(Q) + '" '
      + 'oninput="EBExUI.search(this.value)"></div>';

    /* שריר */
    h += '<div class="row" style="gap:5px;flex-wrap:wrap;margin-bottom:7px">'
      + chip('כל השרירים', MUS === 'all', 'data-exm="all"');
    Object.keys(EBEx.MUSCLES).forEach(function (k) {
      if (!byM[k]) return;
      h += chip(EBEx.MUSCLES[k] + ' ' + byM[k].length, MUS === k, 'data-exm="' + k + '"');
    });
    h += '</div>';

    /* ציוד */
    h += '<div class="row" style="gap:5px;flex-wrap:wrap;margin-bottom:12px">'
      + chip('כל הציוד', EQ === 'all', 'data-exe="all"');
    Object.keys(EBEx.EQUIP).forEach(function (k) {
      if (!byE[k]) return;
      h += chip(EBEx.EQUIP[k] + ' ' + byE[k].length, EQ === k, 'data-exe="' + k + '"');
    });
    h += '</div>';

    h += '<div class="muted" style="font-size:12.5px;margin-bottom:10px">'
      + items.length + ' תרגילים</div>';

    if (!items.length) h += '<div class="empty">לא נמצא תרגיל מתאים.</div>';

    items.forEach(function (x) {
      var added = have.indexOf(x.n) > -1;
      h += '<div class="card" style="margin-bottom:8px;padding:11px 12px" data-exid="' + x.id + '">'
        + '<div class="row" style="align-items:flex-start;gap:9px">'
        + '<div style="flex:1;min-width:0">'
        + '<div style="font-family:Heebo;font-weight:700;font-size:14.5px;line-height:1.3">'
        + esc(x.n) + '</div>'
        + '<div class="row" style="gap:5px;margin-top:6px;flex-wrap:wrap">'
        + tagx(EBEx.MUSCLES[x.m]) + tagx(EBEx.EQUIP[x.e])
        + '<span class="pill" style="color:var(--or)">' + esc(x.s) + '×' + esc(x.r) + '</span>'
        + '</div>'
        + (x.note ? '<div style="font-size:11.5px;color:var(--amber);margin-top:6px;line-height:1.5">'
                    + esc(x.note) + '</div>' : '')
        + '</div>'
        + '</div>'
        /* השדות מגיעים מלאים בברירת המחדל של התרגיל. מי שרוצה
           להוסיף מהר לוחץ ומתעלם מהם; מי שרוצה לדייק — עורך כאן
           ולא בטבלה אחר כך. */
        + '<div class="row" style="gap:6px;margin-top:10px;align-items:center">'
        + inp('סטים',  'exs', x.id, x.s, 52)
        + inp('חזרות', 'exr', x.id, x.r, 76)
        + inp('משקל',  'exw', x.id, '',  62)
        + '<div style="flex:1"></div>'
        + '<button class="btn sm ' + (added ? 'ghost' : '') + '" data-exadd="' + x.id + '"'
        + (added ? ' disabled' : '') + ' style="flex:none">'
        + (added ? 'כבר ביום' : 'הוספה') + '</button>'
        + '</div></div>';
    });

    h += '</div><div class="mf">'
      + '<button class="btn" onclick="EBExUI.close()">'
      + (TARGET ? 'חזרה לטיוטה' : 'סגירה') + '</button></div>';
    openModal(h, true);
    var el = document.getElementById('ex_q');
    if (el && Q) { el.focus(); el.setSelectionRange(Q.length, Q.length); }
  }

  function inp(label, key, id, val, w) {
    return '<label style="display:flex;flex-direction:column;gap:3px">'
      + '<span class="muted" style="font-size:10px">' + label + '</span>'
      + '<input data-' + key + '="' + esc(id) + '" value="' + esc(val) + '" '
      + 'style="width:' + w + 'px;background:var(--ink);border:1px solid var(--line);'
      + 'border-radius:7px;padding:6px;font-size:13px;text-align:center"></label>';
  }

  function tagx(txt) {
    if (!txt) return '';
    return '<span class="pill" style="font-size:11px">' + esc(txt) + '</span>';
  }

  /* הספרייה נפתחה מעל הבונה באותו חלון. סגירה רגילה הייתה סוגרת גם
     אותו, והטיוטה שהמאמן בנה נעלמת מהמסך. */
  function close() {
    var back = TARGET && TARGET.back;
    TARGET = null;
    if (back) back(); else closeModal();
  }

  function search(v) { Q = v; paint(); }
  function setMuscle(k) { MUS = k; paint(); }
  function setEquip(k) { EQ = k; paint(); }

  function add(exId) {
    var x = EBEx.byId(exId);
    var day = currentDay();
    if (!x || !day) return;
    day.exercises = day.exercises || [];
    if (day.exercises.some(function (e) { return String(e.name || '').trim() === x.n; })) return;

    var g = function (key, dflt) {
      var el = document.querySelector('[data-' + key + '="' + exId + '"]');
      var v = el ? String(el.value).trim() : '';
      return v || dflt;
    };
    day.exercises.push({
      name: x.n,
      sets:   g('exs', x.s),
      reps:   g('exr', x.r),
      weight: g('exw', ''),
      rest:   '',
      note:   x.note || ''
    });
    if (TARGET) TARGET.after(); else { save(); render(); }

    /* מעדכנים כרטיס אחד ולא מציירים מחדש — ציור מלא מחזיר את הגלילה
       לראש הרשימה, ואחרי התרגיל השלושים זה מרגיז. */
    var card = document.querySelector('[data-exid="' + exId + '"]');
    var btn = card && card.querySelector('[data-exadd]');
    if (btn) { btn.textContent = 'כבר ביום'; btn.classList.add('ghost'); btn.disabled = true; }
    toast(x.n + ' נוסף');
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-exadd]');
    if (a) { add(a.dataset.exadd); return; }
    var m = e.target.closest('[data-exm]');
    if (m) { setMuscle(m.dataset.exm); return; }
    var q = e.target.closest('[data-exe]');
    if (q) { setEquip(q.dataset.exe); return; }
  });

  /* ══════════ השלמה למספר תרגילים אחיד ══════════
     היום מזוהה לפי מה שכבר בו ולפי שמו, וההשלמה נלקחת מאותן קבוצות
     שריר. יום דחיפה לא יקבל פתאום כפיפת מרפקים.

     רק מוסיפים ולעולם לא מוחקים: יום עם אחד-עשר תרגילים הוא בחירה
     של המאמן, ולא משהו שכלי אוטומטי אמור לקצץ. */

  var NAME_HINTS = [
    [/דחיפ|חזה|כתפ|טרייספס|יד אחורית/, ['chest','shoulders','triceps']],
    [/משיכ|גב|ביספס|יד קדמית/,          ['back','biceps']],
    [/רגל|רגליים|תחתון|סקוואט|דדליפט/,   ['quads','hams','glutes','calves']],
    [/עליון/,                            ['chest','back','shoulders','triceps','biceps']],
    [/בטן|ליבה|core/i,                   ['core']],
    [/אירובי|ריצה|קרדיו/,                ['cardio']],
    [/גמישות|מתיח/,                      ['flex']],
    [/ניידות|מוביל/,                     ['mob']],
    [/גוף מלא|פונקציונ/,                 ['full','core']]
  ];

  /* גם מה שכבר ביום וגם הרמז שבשמו. יום "דחיפה" שיש בו רק לחיצת חזה
     אמור לקבל גם כתפיים ויד אחורית — לא עוד שבעה תרגילי חזה. */
  function dayMuscles(day) {
    var have = {}, order = [];
    (day.exercises || []).forEach(function (e) {
      var x = EBEx.ALL.filter(function (y) { return y.n === String(e.name || '').trim(); })[0];
      if (x && !have[x.m]) { have[x.m] = 1; order.push(x.m); }
    });

    var nm = String(day.name || '');
    for (var i = 0; i < NAME_HINTS.length; i++) {
      if (NAME_HINTS[i][0].test(nm)) {
        NAME_HINTS[i][1].forEach(function (m) { if (!have[m]) { have[m] = 1; order.push(m); } });
        break;
      }
    }
    if (order.length) return order;
    return ['chest','back','quads','shoulders','core'];   // יום בלי שם ובלי תרגילים
  }

  function fillDay(t, day, n) {
    day.exercises = day.exercises || [];
    var missing = n - day.exercises.length;
    if (missing <= 0) return 0;

    var taken = {};
    day.exercises.forEach(function (e) { taken[String(e.name || '').trim()] = 1; });
    /* גם מה שכבר קיים בימים אחרים נדחה לסוף, כדי שהתוכנית לא תחזור
       על עצמה בכל יום. */
    var elsewhere = {};
    (((t.program || {}).days) || []).forEach(function (d) {
      if (d === day) return;
      (d.exercises || []).forEach(function (e) { elsewhere[String(e.name || '').trim()] = 1; });
    });

    var muscles = dayMuscles(day);
    /* סבב בין השרירים ולא מיצוי אחד אחרי השני: אחרת יום דחיפה מקבל
       תשעה תרגילי חזה רק כי chest ראשון ברשימה. */
    var byM = {}, maxLen = 0;
    muscles.forEach(function (m) {
      byM[m] = EBEx.ALL.filter(function (x) { return x.m === m && !taken[x.n]; });
      if (byM[m].length > maxLen) maxLen = byM[m].length;
    });
    var pool = [];
    for (var r = 0; r < maxLen; r++) {
      muscles.forEach(function (m) { if (byM[m][r]) pool.push(byM[m][r]); });
    }
    /* עדיפות למה שלא מופיע במקום אחר, ואחר כך גיוון בציוד */
    var usedEquip = {};
    day.exercises.forEach(function (e) {
      var x = EBEx.ALL.filter(function (y) { return y.n === String(e.name || '').trim(); })[0];
      if (x) usedEquip[x.e] = (usedEquip[x.e] || 0) + 1;
    });
    pool.sort(function (a, b) {
      var ea = elsewhere[a.n] ? 1 : 0, eb = elsewhere[b.n] ? 1 : 0;
      if (ea !== eb) return ea - eb;
      return (usedEquip[a.e] || 0) - (usedEquip[b.e] || 0);
    });

    var added = 0;
    for (var i = 0; i < pool.length && added < missing; i++) {
      var x = pool[i];
      if (taken[x.n]) continue;
      taken[x.n] = 1;
      usedEquip[x.e] = (usedEquip[x.e] || 0) + 1;
      day.exercises.push({ name: x.n, sets: x.s, reps: x.r,
                           weight: '', rest: '', note: x.note || '' });
      added++;
    }
    return added;
  }

  function fillTrainee(tid, n) {
    var t = tById(tid); if (!t) return 0;
    n = n || 9;
    var days = ((t.program || {}).days) || [];
    var total = 0;
    days.forEach(function (d) { total += fillDay(t, d, n); });
    if (total) { save(); render(); }
    toast(total ? (total + ' תרגילים נוספו') : 'כל הימים כבר מלאים');
    return total;
  }

  function fillAll(n) {
    n = n || 9;
    var list = (window.S.trainees || []).filter(function (t) { return t.status !== 'archived'; });
    if (!confirm('להשלים כל יום אימון ל-' + n + ' תרגילים אצל ' + list.length + ' מתאמנים?')) return;
    var total = 0, touched = 0;
    list.forEach(function (t) {
      var before = total;
      (((t.program || {}).days) || []).forEach(function (d) { total += fillDay(t, d, n); });
      if (total > before) touched++;
    });
    save(); render();
    toast(total ? (total + ' תרגילים נוספו אצל ' + touched + ' מתאמנים')
                : 'כל התוכניות כבר מלאות');
  }

  /* ══════════ התאמת המרשם למטרה ══════════
     אותו תרגיל נראה אחרת לפי המטרה: סקוואט לכוח הוא 5×3-5 עם שלוש
     דקות מנוחה, ולחיטוב הוא 4×10-12 עם דקה. ההבדל הוא לא קוסמטי —
     הוא מה שקובע איזו הסתגלות הגוף עושה.

     תרגילי בסיס מקבלים יותר סטים ויותר מנוחה מתרגילי בידוד, כי הם
     מגייסים יותר מסה ולכן דורשים התאוששות ארוכה יותר בין הסטים. */

  var COMPOUND = /סקוואט|דדליפט|לחיצת חזה|לחיצת כתפיים|לחיצת רגליים|מתח|חתירה|מקבילים|קלין|סנאץ|ת׳רסטר|היפ ת|לאנג|הק סקוואט|שכיבות סמיכה|מאסל|פיסטול|מכרעים|גובלט|סטפ-אפ|פולי עליון|משיכת פולי|בולגרי/;

  var RX = {
    strength: { n:'כוח',      comp:['5','3-5','180 שנ׳'],   iso:['3','6-8','90 שנ׳'] },
    mass:     { n:'מסה',      comp:['4','8-10','90 שנ׳'],   iso:['3','10-12','60 שנ׳'] },
    cut:      { n:'חיטוב',    comp:['4','10-12','60 שנ׳'],  iso:['3','12-15','45 שנ׳'] },
    endur:    { n:'סיבולת',   comp:['3','15-20','45 שנ׳'],  iso:['3','15-20','30 שנ׳'] },
    base:     { n:'כושר כללי', comp:['3','10-12','75 שנ׳'],  iso:['3','12','60 שנ׳'] }
  };

  /* ליבה, אירובי, גמישות וניידות לא נמדדים בסטים וחזרות של משקולות,
     ולכן נשארים עם מה שהספרייה קבעה להם. */
  var KEEP = { core:1, cardio:1, flex:1, mob:1 };

  function goalKey(t) {
    var g = String((t && t.goal) || '') + ' ' + String((t && t.goal2) || '');
    if (/סיבולת|מרתון|טריאתלון|ריצה למרחקים/.test(g)) return 'endur';
    if (/כוח|חזק|פאוור|powerlift/i.test(g))            return 'strength';
    if (/חיטוב|ירידה|שומן|הרזי|לרדת|דיאטה|מיצוק/.test(g)) return 'cut';
    if (/מסה|היפרטרופ|בניית שריר|לעלות|עלייה|נפח/.test(g)) return 'mass';
    return 'base';
  }

  function applyGoal(tid, silent) {
    var t = tById(tid); if (!t) return { changed: 0 };
    var key = goalKey(t), rx = RX[key];
    var changed = 0, kept = 0;

    (((t.program || {}).days) || []).forEach(function (d) {
      (d.exercises || []).forEach(function (e) {
        var nm = String(e.name || '').trim();
        var lib = EBEx.ALL.filter(function (x) { return x.n === nm; })[0];
        if (lib && KEEP[lib.m]) { kept++; return; }
        /* תרגיל שאינו בספרייה עדיין מקבל מרשם — הוא בדרך כלל תרגיל
           משקולות שהמאמן הקליד בעצמו. */
        var set = COMPOUND.test(nm) ? rx.comp : rx.iso;
        if (e.sets !== set[0] || e.reps !== set[1] || e.rest !== set[2]) changed++;
        e.sets = set[0]; e.reps = set[1]; e.rest = set[2];
      });
    });
    if (!silent && changed) { save(); render(); }
    return { changed: changed, kept: kept, goal: rx.n, key: key };
  }

  function applyGoalAll() {
    var list = (window.S.trainees || []).filter(function (t) { return t.status !== 'archived'; });
    if (!list.length) { toast('אין מתאמנים'); return; }
    if (!confirm('להתאים סטים, חזרות ומנוחה למטרה של ' + list.length + ' מתאמנים?\n'
               + 'המספרים הקיימים יוחלפו. השינוי לא הפיך.')) return;

    var rows = list.map(function (t) {
      var r = applyGoal(t.id, true);
      r.name = t.name;
      r.raw  = String(t.goal || '').trim() || '(אין מטרה)';
      return r;
    });
    save(); render();

    var h = '<div class="mh"><h3>התאמה למטרה</h3>'
      + '<button class="iconbtn" onclick="closeModal()">✕</button></div><div class="mb">';
    rows.forEach(function (r) {
      var rx = RX[r.key];
      h += '<div style="padding:10px 0;border-top:1px solid var(--line)">'
        + '<div class="row" style="align-items:baseline;gap:8px">'
        + '<span style="flex:1;font-size:14px;font-weight:500">' + esc(r.name) + '</span>'
        + '<span class="pill" style="color:var(--or)">' + esc(r.goal) + '</span></div>'
        + '<div class="muted" style="font-size:11.5px;margin-top:4px">'
        + esc(r.raw.slice(0, 60)) + '</div>'
        + '<div class="muted" style="font-size:11.5px;margin-top:4px">'
        + 'בסיס ' + rx.comp[0] + '×' + rx.comp[1] + ' · מנוחה ' + rx.comp[2]
        + '  ·  בידוד ' + rx.iso[0] + '×' + rx.iso[1] + ' · מנוחה ' + rx.iso[2]
        + '</div>'
        + '<div class="muted" style="font-size:11.5px;margin-top:3px">'
        + r.changed + ' תרגילים עודכנו'
        + (r.kept ? ' · ' + r.kept + ' נשארו (ליבה, אירובי, גמישות)' : '')
        + '</div></div>';
    });
    h += '</div><div class="mf"><button class="btn ghost" onclick="closeModal()">סגירה</button></div>';
    openModal(h, true);
  }

  window.EBExUI = { open: open, close: close,
                    fillTrainee: fillTrainee, fillAll: fillAll, fillDay: fillDay,
                    applyGoal: applyGoal, applyGoalAll: applyGoalAll, goalKey: goalKey, search: search, setMuscle: setMuscle, setEquip: setEquip, add: add };
})();

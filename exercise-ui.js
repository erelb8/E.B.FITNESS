/* =====================================================================
   E.B FIT — בחירה מספריית התרגילים
   ---------------------------------------------------------------------
   נפתח מתוך יום אימון מסוים, ולכן ההוספה נכנסת בדיוק לאן שצריך בלי
   לבחור יום פעם נוספת. הסטים והחזרות שמגיעים עם התרגיל הם נקודת
   פתיחה — הם נכנסים לטבלה ואפשר לערוך אותם שם כרגיל.
   ===================================================================== */
(function () {
  'use strict';

  (window.EB_MOD = window.EB_MOD || {})['exUi'] = 'v56';

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

  window.EBExUI = { open: open, close: close, search: search, setMuscle: setMuscle, setEquip: setEquip, add: add };
})();

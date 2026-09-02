/* =====================================================================
   E.B FIT — בחירה מספריית התרגילים
   ---------------------------------------------------------------------
   נפתח מתוך יום אימון מסוים, ולכן ההוספה נכנסת בדיוק לאן שצריך בלי
   לבחור יום פעם נוספת. הסטים והחזרות שמגיעים עם התרגיל הם נקודת
   פתיחה — הם נכנסים לטבלה ואפשר לערוך אותם שם כרגיל.
   ===================================================================== */
(function () {
  'use strict';

  (window.EB_MOD = window.EB_MOD || {})['exUi'] = 'v52';

  var Q = '', MUS = 'all', EQ = 'all', FOR = null, DAY = 0;

  function chip(txt, on, attr) {
    return '<button class="btn sm ' + (on ? '' : 'ghost') + '" ' + attr + '>' + esc(txt) + '</button>';
  }

  function open(traineeId, dayIndex) {
    FOR = traineeId; DAY = dayIndex;
    Q = ''; MUS = 'all'; EQ = 'all';
    paint();
  }

  function paint() {
    var t = tById(FOR); if (!t) return;
    var day = ((t.program || {}).days || [])[DAY];
    if (!day) return;
    var have = (day.exercises || []).map(function (e) { return String(e.name || '').trim(); });
    var items = EBEx.search(Q, MUS, EQ);
    var byM = EBEx.byMuscle(), byE = EBEx.byEquip();

    var h = '<div class="mh"><h3>ספריית התרגילים</h3>'
      + '<button class="iconbtn" onclick="closeModal()">✕</button></div><div class="mb">'
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
        + '<button class="btn sm ' + (added ? 'ghost' : '') + '" data-exadd="' + x.id + '"'
        + (added ? ' disabled' : '') + ' style="flex:none">'
        + (added ? 'כבר ביום' : 'הוספה') + '</button>'
        + '</div></div>';
    });

    h += '</div><div class="mf"><button class="btn ghost" onclick="closeModal()">סגירה</button></div>';
    openModal(h, true);
    var el = document.getElementById('ex_q');
    if (el && Q) { el.focus(); el.setSelectionRange(Q.length, Q.length); }
  }

  function tagx(txt) {
    if (!txt) return '';
    return '<span class="pill" style="font-size:11px">' + esc(txt) + '</span>';
  }

  function search(v) { Q = v; paint(); }
  function setMuscle(k) { MUS = k; paint(); }
  function setEquip(k) { EQ = k; paint(); }

  function add(exId) {
    var t = tById(FOR), x = EBEx.byId(exId);
    if (!t || !x) return;
    t.program = t.program || { days: [] };
    var day = t.program.days[DAY];
    if (!day) return;
    day.exercises = day.exercises || [];
    if (day.exercises.some(function (e) { return String(e.name || '').trim() === x.n; })) return;

    day.exercises.push({
      name: x.n, sets: x.s, reps: x.r, weight: '', rest: '', note: x.note || ''
    });
    save(); render();

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

  window.EBExUI = { open: open, search: search, setMuscle: setMuscle, setEquip: setEquip, add: add };
})();

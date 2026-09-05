/* =====================================================================
   E.B FIT — שינוי סדר תרגילים בלחיצה ארוכה
   ---------------------------------------------------------------------
   לחיצה ארוכה על שורת תרגיל מרימה אותה, גרירה מזיזה, שחרור שומר.

   שלוש החלטות שנובעות מכך שזה צריך לעבוד גם באצבע:

   * לחיצה ארוכה ולא גרירה מיידית. בטלפון גרירה מיידית הייתה חוטפת
     כל ניסיון לגלול את הטבלה. 400 מילישניות מפרידות בין השתיים.

   * תזוזה של יותר מ-8 פיקסלים לפני שהטיימר פג מבטלת. זו גלילה,
     לא כוונה להזיז תרגיל.

   * רטט קצר ברגע ההרמה. בלעדיו המשתמש לא יודע אם הלחיצה נתפסה,
     ומרים את האצבע בדיוק כשהיא כן.

   pointer events ולא touch/mouse בנפרד — אותו קוד לשני המקרים.
   ===================================================================== */
(function () {
  'use strict';

  (window.EB_MOD = window.EB_MOD || {})['reorder'] = 'v70';

  var HOLD = 400;      // כמה זמן להחזיק כדי להרים
  var SLOP = 8;        // תזוזה שמעליה זו גלילה ולא הרמה

  var timer = null, row = null, body = null, startY = 0, active = false, id = null;

  function rowsOf(tb) {
    return [].slice.call(tb.querySelectorAll('tr[data-ei]'));
  }

  function cleanup() {
    clearTimeout(timer);
    timer = null;
    if (row) row.classList.remove('eb-lift');
    document.body.classList.remove('eb-dragging');
    row = null; body = null; active = false; id = null;
  }

  function lift() {
    active = true;
    row.classList.add('eb-lift');
    document.body.classList.add('eb-dragging');
    try { if (navigator.vibrate) navigator.vibrate(18); } catch (e) {}
  }

  function onDown(e) {
    /* עריכת שדה או לחיצה על כפתור אינן גרירה */
    if (e.target.closest('input, button, select, textarea, a')) return;
    var tr = e.target.closest('tr[data-ei]');
    if (!tr) return;
    var tb = tr.parentNode;
    if (rowsOf(tb).length < 2) return;     // אין מה לסדר

    row = tr; body = tb; startY = e.clientY; active = false;
    id = { tid: tr.dataset.tid, di: +tr.dataset.di };

    clearTimeout(timer);
    timer = setTimeout(function () {
      if (!row) return;
      lift();
      try { row.setPointerCapture(e.pointerId); } catch (err) {}
    }, HOLD);
  }

  function onMove(e) {
    if (!row) return;

    /* עוד לא הורם — תזוזה גדולה מדי היא גלילה */
    if (!active) {
      if (Math.abs(e.clientY - startY) > SLOP) cleanup();
      return;
    }

    e.preventDefault();

    /* השורה שמתחת לאצבע, לפי מרכזה */
    var y = e.clientY, rows = rowsOf(body), target = null;
    for (var i = 0; i < rows.length; i++) {
      if (rows[i] === row) continue;
      var r = rows[i].getBoundingClientRect();
      if (y >= r.top && y <= r.bottom) { target = rows[i]; break; }
    }
    if (!target) return;

    var tr = target.getBoundingClientRect();
    var below = y > tr.top + tr.height / 2;
    body.insertBefore(row, below ? target.nextSibling : target);
  }

  function onUp() {
    if (!row || !active) { cleanup(); return; }

    /* הסדר החדש נקרא מה-DOM ומוחל על הנתונים */
    var order = rowsOf(body).map(function (r) { return +r.dataset.ei; });
    var tid = id.tid, di = id.di;
    cleanup();

    var t = (typeof tById === 'function') ? tById(tid) : null;
    if (!t || !t.program || !t.program.days[di]) return;

    var src = t.program.days[di].exercises || [];
    var next = order.map(function (i) { return src[i]; }).filter(Boolean);
    if (next.length !== src.length) { if (typeof render === 'function') render(); return; }

    /* בלי שינוי אין מה לשמור ואין מה לצייר מחדש */
    var same = next.every(function (x, i) { return x === src[i]; });
    if (same) return;

    t.program.days[di].exercises = next;
    if (typeof save === 'function') save();
    if (typeof render === 'function') render();
    if (typeof toast === 'function') toast('הסדר עודכן');
  }

  /* ---------- סגנון ---------- */
  function style() {
    if (document.getElementById('eb-reorder-css')) return;
    var s = document.createElement('style');
    s.id = 'eb-reorder-css';
    s.textContent =
      'tr[data-ei]{cursor:grab}' +
      'tr[data-ei].eb-lift{cursor:grabbing;background:var(--or-soft);' +
        'box-shadow:0 6px 18px rgba(0,0,0,.35);position:relative;z-index:5}' +
      'tr[data-ei].eb-lift td{border-color:transparent}' +
      /* בזמן גרירה אין בחירת טקסט ואין גלילה מהאצבע */
      'body.eb-dragging{user-select:none;-webkit-user-select:none}' +
      'body.eb-dragging tr[data-ei]{touch-action:none}';
    document.head.appendChild(s);
  }

  function init() {
    style();
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('pointermove', onMove, { passive: false });
    document.addEventListener('pointerup', onUp, true);
    document.addEventListener('pointercancel', cleanup, true);
    /* גלילה תוך כדי המתנה מבטלת — היד זזה, לא הכוונה */
    window.addEventListener('scroll', function () { if (!active) cleanup(); }, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.EBReorder = { HOLD: HOLD };
})();

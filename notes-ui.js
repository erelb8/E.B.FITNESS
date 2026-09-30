/* =====================================================================
   E.B FIT — בחירת הערה
   ---------------------------------------------------------------------
   חלון קטן שנפתח מכל שדה הערה בתוכנית: קודם מה שהמאמן כבר כתב
   (מדורג לפי שכיחות, ובתרגיל — מה שכתב על אותו תרגיל), אחריו רשימות
   מוכנות לפי נושא.

   לחיצה על הערה מכניסה אותה לשדה. לחיצה שנייה על הערה נוספת מוסיפה
   אותה בשורה חדשה במקום לדרוס — כך נבנית הערה מורכבת בלי להקליד.
   ===================================================================== */
(function () {
  'use strict';

  (window.EB_MOD = window.EB_MOD || {})['notesUi'] = 'v189';

  var CTX = null;   // { kind, exName, get, set, title }
  var Q = '';

  function esc2(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function open(ctx) {
    CTX = ctx; Q = '';
    paint();
  }

  function row(txt, badge) {
    return '<button class="btn ghost" data-nbpick="' + esc2(txt) + '" '
      + 'style="display:block;width:100%;text-align:right;white-space:normal;line-height:1.6;'
      + 'padding:10px 12px;margin-bottom:6px;font-size:13.5px">'
      + esc2(txt)
      + (badge ? '<span class="muted" style="font-size:11px;margin-inline-start:6px">· ' + badge + '</span>' : '')
      + '</button>';
  }

  function paint() {
    if (!CTX) return;
    var kind = CTX.kind;
    var my = EBNotes.mine(kind, CTX.exName);
    var ready = EBNotes.ready(kind);
    var q = Q.trim();
    var hit = function (t) { return !q || t.indexOf(q) > -1; };

    var h = '<div class="mh"><h3>' + esc2(CTX.title || 'בחירת הערה') + '</h3>'
      + '<button class="iconbtn" onclick="EBNotesUI.close()">✕</button></div><div class="mb">';

    if (CTX.exName) {
      h += '<div class="muted" style="font-size:12.5px;margin-bottom:10px">הערה ל<b style="color:var(--tx)">'
        + esc2(CTX.exName) + '</b></div>';
    }
    h += '<div class="search" style="margin-bottom:12px"><span>⌕</span>'
      + '<input id="nb_q" placeholder="חיפוש בהערות" value="' + esc2(Q) + '" '
      + 'oninput="EBNotesUI.search(this.value)" autocomplete="off"></div>';

    var mineHits = my.filter(function (x) { return hit(x.t); });
    if (mineHits.length) {
      h += '<div style="font-family:Heebo;font-weight:700;font-size:13px;margin:0 0 7px">הערות שלי</div>';
      mineHits.slice(0, 40).forEach(function (x) {
        h += row(x.t, x.n > 1 ? x.n + ' פעמים' : '');
      });
      if (mineHits.length > 40) h += '<div class="muted" style="font-size:12px;margin-bottom:10px">ועוד '
        + (mineHits.length - 40) + ' — אפשר לצמצם בחיפוש</div>';
    }

    var any = false;
    Object.keys(ready).forEach(function (cat) {
      var items = (ready[cat] || []).filter(hit);
      if (!items.length) return;
      any = true;
      h += '<div style="font-family:Heebo;font-weight:700;font-size:13px;margin:14px 0 7px">' + esc2(cat) + '</div>';
      items.forEach(function (t) { h += row(t); });
    });

    if (!mineHits.length && !any) {
      h += '<div class="empty">לא נמצאה הערה מתאימה. אפשר להקליד ישירות בשדה.</div>';
    }

    h += '</div><div class="mf"><button class="btn" onclick="EBNotesUI.close()">סגירה</button>'
      + '<span class="muted" style="font-size:12px;align-self:center">לחיצה מוסיפה לשדה</span></div>';
    openModal(h, true);
    var el = document.getElementById('nb_q');
    if (el && Q) { el.focus(); el.setSelectionRange(Q.length, Q.length); }
  }

  var QT = null;
  function search(v) { Q = v; clearTimeout(QT); QT = setTimeout(paint, 120); }

  function pickText(txt) {
    if (!CTX) return;
    var cur = String(CTX.get() || '').trim();
    /* אותה הערה פעמיים לא מוסיפה כלום */
    if (cur.split('\n').some(function (l) { return l.trim() === txt; })) { toast('כבר בהערה'); return; }
    CTX.set(cur ? cur + '\n' + txt : txt);
    toast('נוסף');
  }

  function close() { CTX = null; closeModal(); }

  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-nbpick]');
    if (b) { pickText(b.dataset.nbpick); return; }
  });

  /* ---------- קיצורים לשלושת המקומות שבהם כותבים הערה ---------- */
  function forExercise(tid, di, ei) {
    var t = tById(tid); if (!t) return;
    var ex = (((t.program || {}).days || [])[di] || {}).exercises || [];
    var e = ex[ei]; if (!e) return;
    open({
      kind: 'ex', exName: String(e.name || '').trim(), title: 'הערה לתרגיל',
      get: function () { return e.note || ''; },
      set: function (v) { e.note = v; updateProgramDock(tid); commitProgram(); render(); }
    });
  }
  function forDay(tid, di) {
    var t = tById(tid); if (!t) return;
    var d = ((t.program || {}).days || [])[di]; if (!d) return;
    open({
      kind: 'day', title: 'הערה ליום האימון',
      get: function () { return d.note || ''; },
      set: function (v) { d.note = v; updateProgramDock(tid); commitProgram(); render(); }
    });
  }
  function forProgram(tid, key, title) {
    var t = tById(tid); if (!t) return;
    var p = t.program || (t.program = { days: [] });
    open({
      kind: 'plan', title: title || 'הערה לתוכנית',
      get: function () { return p[key] || ''; },
      set: function (v) { p[key] = v; updateProgramDock(tid); commitProgram(); render(); }
    });
  }

  window.EBNotesUI = { open: open, close: close, search: search,
                       forExercise: forExercise, forDay: forDay, forProgram: forProgram };
})();

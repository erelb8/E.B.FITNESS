/* =====================================================================
   E.B FIT — דפדוף בספריית הארוחות
   ---------------------------------------------------------------------
   מסך אחד שמשמש לשני דברים: המאמן מוסיף ממנו ארוחה לתפריט של מתאמן,
   וכל מתאמן יכול לעיין בכולן בקישור שלו.

   כל ארוחה נפתחת לטבלה מלאה — שורה לכל מרכיב עם משקל, קלוריות
   ומאקרו, וסיכום למטה. הטבלה סגורה כברירת מחדל: 42 טבלאות פתוחות
   בבת אחת הופכות את המסך לבלתי-קריא בטלפון.
   ===================================================================== */
(function () {
  'use strict';

  (window.EB_MOD = window.EB_MOD || {})['libraryUi'] = 'v41';

  var Q = '', TYPE = 'all', OPEN = {};

  var r1 = function (x) { return Math.round(x * 10) / 10; };

  /* ---------- טבלת הפירוק ---------- */
  function table(m) {
    var c = EBLib.calc(m.items), t = c.total;
    var h = '<table style="width:100%;border-collapse:collapse;font-size:12.5px;margin-top:10px">'
      + '<thead><tr>'
      + th('רכיב','right') + th('גרם') + th('קק״ל') + th('חלבון') + th('פחמ׳') + th('שומן')
      + '</tr></thead><tbody>';
    c.rows.forEach(function (r) {
      h += '<tr>'
        + td(esc(r.name),'right') + td(r.g) + td(Math.round(r.k))
        + td(r1(r.p)) + td(r1(r.c)) + td(r1(r.f))
        + '</tr>';
    });
    h += '<tr style="border-top:2px solid var(--or)">'
      + td('<b>סה״כ</b>','right') + td('<b>'+t.g+'</b>') + td('<b>'+Math.round(t.k)+'</b>')
      + td('<b>'+r1(t.p)+'</b>') + td('<b>'+r1(t.c)+'</b>') + td('<b>'+r1(t.f)+'</b>')
      + '</tr></tbody></table>';
    return h;
  }
  function th(x, align) {
    return '<th style="text-align:' + (align||'left') + ';padding:5px 4px;border-bottom:1px solid var(--line);'
      + 'font-size:11px;color:var(--mut);font-weight:500;white-space:nowrap">' + x + '</th>';
  }
  function td(x, align) {
    return '<td style="text-align:' + (align||'left') + ';padding:5px 4px;border-bottom:1px solid var(--line);'
      + 'white-space:nowrap;font-variant-numeric:tabular-nums">' + x + '</td>';
  }

  /* ---------- כרטיס ארוחה ---------- */
  function card(m, action) {
    var t = EBLib.calc(m.items).total;
    var open = !!OPEN[m.id];
    return '<div class="card" style="margin-bottom:10px">'
      + '<div class="row" style="align-items:flex-start">'
      + '<div style="flex:1;min-width:0">'
      + '<div style="font-family:Rubik;font-weight:700;font-size:15px;line-height:1.3">' + esc(m.name) + '</div>'
      + '<div class="muted" style="font-size:12px;margin-top:3px">' + esc(EBLib.TYPES[m.type] || '') + '</div>'
      + '</div>'
      + '<div style="text-align:center;flex:none;padding-inline-start:10px">'
      + '<div style="font-family:Rubik;font-weight:900;font-size:20px;color:var(--or);line-height:1">' + Math.round(t.k) + '</div>'
      + '<div class="muted" style="font-size:10.5px">קק״ל</div></div>'
      + '</div>'
      + '<div class="row" style="gap:6px;margin-top:9px;flex-wrap:wrap">'
      + pill('חלבון ' + r1(t.p)) + pill('פחמימות ' + r1(t.c)) + pill('שומן ' + r1(t.f))
      + '</div>'
      + (m.note ? '<div style="font-size:12px;color:var(--amber);margin-top:8px;line-height:1.5">' + esc(m.note) + '</div>' : '')
      + '<div class="row" style="margin-top:10px">'
      + '<button class="btn sm ghost" onclick="EBLibUI.toggle(\'' + m.id + '\')">'
      + (open ? 'סגירת הפירוט' : 'פירוט מלא') + '</button>'
      + (action || '') + '</div>'
      + (open ? table(m) : '')
      + '</div>';
  }
  function pill(txt) {
    return '<span style="font-size:11.5px;padding:3px 9px;border-radius:20px;background:var(--panel-2,#1C1C22);'
      + 'border:1px solid var(--line);color:var(--mut);white-space:nowrap">' + esc(txt) + '</span>';
  }

  /* ---------- מסננים ---------- */
  function filters() {
    var counts = EBLib.byType();
    var btn = function (k, label, n) {
      return '<button class="btn sm ' + (TYPE === k ? '' : 'ghost') + '" '
        + 'onclick="EBLibUI.setType(\'' + k + '\')">' + esc(label)
        + (n ? ' <span style="opacity:.6">' + n + '</span>' : '') + '</button>';
    };
    var h = '<div class="row" style="gap:6px;flex-wrap:wrap;margin-bottom:12px">'
      + btn('all', 'הכול', EBLib.MEALS.length);
    ['breakfast','pre','post','lunch','snack','dinner'].forEach(function (k) {
      if (counts[k]) h += btn(k, EBLib.TYPES[k], counts[k].length);
    });
    return h + '</div>';
  }

  function list() {
    var q = Q.trim();
    return EBLib.MEALS.filter(function (m) {
      if (TYPE !== 'all' && m.type !== TYPE) return false;
      if (!q) return true;
      if (m.name.indexOf(q) > -1) return true;
      return m.items.some(function (p) { return p[0].indexOf(q) > -1; });
    });
  }

  /* ---------- המסך אצל המאמן ---------- */
  function browse(traineeId) {
    Q = ''; TYPE = 'all'; OPEN = {};
    paint(traineeId);
  }
  function paint(traineeId) {
    var t = traineeId ? tById(traineeId) : null;
    var items = list();
    var mine = t ? (t.meals || []).map(function (x) { return x.libId; }).filter(Boolean) : [];

    var h = '<div class="mh"><h3>ספריית הארוחות</h3>'
      + '<button class="iconbtn" onclick="closeModal()">✕</button></div><div class="mb">'
      + '<div class="search" style="margin-bottom:10px"><span>⌕</span>'
      + '<input id="lib_q" placeholder="חיפוש לפי שם ארוחה או מרכיב" value="' + esc(Q) + '" '
      + 'oninput="EBLibUI.search(this.value,\'' + (traineeId||'') + '\')"></div>'
      + filters()
      + '<div class="muted" style="font-size:12.5px;margin-bottom:10px">' + items.length + ' ארוחות</div>';

    if (!items.length) h += '<div class="empty">לא נמצאה ארוחה מתאימה.</div>';

    items.forEach(function (m) {
      var added = mine.indexOf(m.id) > -1;
      var act = t
        ? '<div style="flex:1"></div><button class="btn sm ' + (added ? 'ghost' : '') + '" '
          + 'onclick="EBLibUI.add(\'' + t.id + '\',\'' + m.id + '\')"' + (added ? ' disabled' : '') + '>'
          + (added ? 'כבר בתפריט' : 'הוספה לתפריט') + '</button>'
        : '';
      h += card(m, act);
    });

    h += '</div><div class="mf"><button class="btn ghost" onclick="closeModal()">סגירה</button></div>';
    openModal(h, true);
    var el = document.getElementById('lib_q');
    if (el && Q) { el.focus(); el.setSelectionRange(Q.length, Q.length); }
  }

  function search(v, tid) { Q = v; paint(tid || null); }
  function setType(k)     { TYPE = k; paint(currentTid()); }
  function toggle(id)     { OPEN[id] = !OPEN[id]; paint(currentTid()); }
  function currentTid()   { return window.VIEW === 'trainee' ? window.ARG : null; }

  /* ---------- הוספה לתפריט המתאמן ---------- */
  function add(traineeId, libId) {
    var t = tById(traineeId), m = EBLib.byId(libId);
    if (!t || !m) return;
    var c = EBLib.calc(m.items).total;
    t.meals = t.meals || [];
    if (t.meals.some(function (x) { return x.libId === libId; })) { toast('כבר בתפריט'); return; }

    t.meals.push({
      id: Math.random().toString(36).slice(2,10),
      libId: libId, name: m.name, type: m.type, desc: m.note || '',
      items: m.items,                       // נשמר כדי שהמתאמן יראה פירוק מלא
      kcal: String(Math.round(c.k)), protein: String(Math.round(c.p)),
      carbs: String(Math.round(c.c)), fat: String(Math.round(c.f))
    });
    save(); paint(traineeId); render();
    toast(m.name + ' נוספה');
  }

  window.EBLibUI = { browse:browse, search:search, setType:setType, toggle:toggle,
                     add:add, card:card, table:table, list:list, filters:filters };
})();

/* =====================================================================
   BAUER POWER — ערכות צבע (אפליקציית המאמן ודף המתאמן)
   ---------------------------------------------------------------------
   אראל ביקש (נובמבר 2026): הכהה בחום בהיר יותר ומט, ושתי אפשרויות
   נוספות — חום בהיר ולבן, ושחור ולבן. שלוש ערכות:
     dark  — חום מט (ברירת המחדל, בלי data-theme על <html>)
     light — חום בהיר ולבן   (theme-light.css)
     mono  — שחור ולבן      (theme.css)
   הבחירה נשמרת במכשיר בלבד (eb_theme) — העדפה אישית, לא נתון.

   נטען בראש הדף, לפני הציור הראשון, כדי שלא יהבהב מסך בצבע הלא נכון.
   מודול משותף לשני הדפים — לא סומך על esc/toast של אף אחד מהם.

   חלון ההתאמה האישית: שלוש דוגמאות צבע. דף המתאמן מוסיף לו גם בחירת
   דמות להדמיות (גבר/אישה) דרך EBTheme.figure = { get, set }.
   ===================================================================== */
(function () {
  var THEMES = [
    { id: 'dark',  he: 'חום',       bg: '#3B2E24', card: '#4A3A2E', ac: '#D6B188', tx: '#F7F1E9', meta: '#2C2119' },
    { id: 'light', he: 'חום ולבן',  bg: '#F6F0E7', card: '#FFFFFF', ac: '#A8764A', tx: '#2A1C11', meta: '#F6F0E7' },
    { id: 'mono',  he: 'שחור ולבן', bg: '#0B0B0B', card: '#1C1C1C', ac: '#FFFFFF', tx: '#FFFFFF', meta: '#0B0B0B' }
  ];
  var html = document.documentElement;
  function byId(id) { for (var i = 0; i < THEMES.length; i++) if (THEMES[i].id === id) return THEMES[i]; return THEMES[0]; }
  function get() { var t = html.getAttribute('data-theme'); return t === 'light' || t === 'mono' ? t : 'dark'; }
  function meta(t) { var m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', byId(t).meta); }
  function apply(t) {
    t = byId(t).id;
    if (t === 'dark') html.removeAttribute('data-theme'); else html.setAttribute('data-theme', t);
    meta(t);
  }
  var saved = null;
  try { saved = localStorage.getItem('eb_theme'); } catch (e) {}
  apply(saved || 'dark');
  document.addEventListener('DOMContentLoaded', function () { meta(get()); });

  var W = function (d) { return '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>'; };
  var ICO = {
    palette: W('<path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.8-.8 1.8-1.7 0-1.1-.9-1.5-.9-2.6 0-1 .8-1.7 1.8-1.7h2.1A4.2 4.2 0 0 0 21 10.8C21 6.5 17 3 12 3z"/><circle cx="7.6" cy="11.5" r="1.1"/><circle cx="10.4" cy="7.4" r="1.1"/><circle cx="15.2" cy="7.6" r="1.1"/>'),
    check: W('<path d="M5 12.5l4.2 4.2L19 7"/>'),
    man: W('<circle cx="12" cy="6" r="2.6"/><path d="M8.2 21v-6.4L6.6 14V10a2 2 0 0 1 2-2h6.8a2 2 0 0 1 2 2v4l-1.6.6V21M12 14.6V21"/>'),
    woman: W('<circle cx="12" cy="5.8" r="2.5"/><path d="M14.2 4.3c1.6.4 2.4 2 1.9 3.6M9.6 21v-5H7.4L10 9.4c.3-.8 1-1.3 2-1.3s1.7.5 2 1.3l2.6 6.6h-2.2v5"/>')
  };

  /* הכפתור שפותח את החלון. top — עיגול קטן בכותרת של דף המתאמן */
  function sw(top) {
    return '<button class="theme-sw' + (top ? ' top' : '') + '" data-thm-sw onclick="EBTheme.open()" aria-label="צבעים והתאמה אישית">'
      + '<i>' + ICO.palette + '</i>' + (top ? '' : 'צבעים') + '</button>';
  }

  function swatch(t) {
    var on = get() === t.id;
    return '<button class="thm-opt' + (on ? ' on' : '') + '" data-thm="' + t.id + '" aria-pressed="' + on + '">'
      + '<span class="thm-prev" style="background:' + t.bg + '">'
      + '<span class="thm-pc" style="background:' + t.card + '"><i style="background:' + t.tx + '"></i><i style="background:' + t.tx + ';opacity:.45;width:60%"></i>'
      + '<b style="background:' + t.ac + '"></b></span></span>'
      + '<span class="thm-nm">' + (on ? ICO.check : '') + t.he + '</span></button>';
  }
  function figRow() {
    var F = EBTheme.figure; if (!F) return '';
    var cur = F.get();
    return '<div class="thm-lbl">הדמות בהדמיות התרגילים</div><div class="thm-figs">'
      + [['m', 'גבר', ICO.man], ['f', 'אישה', ICO.woman]].map(function (x) {
          var on = cur === x[0];
          return '<button class="thm-fig' + (on ? ' on' : '') + '" data-thmfig="' + x[0] + '" aria-pressed="' + on + '">'
            + (window.EBAnim && EBAnim.mount ? '<canvas class="thm-cv" data-figprev="' + x[0] + '" width="120" height="120" aria-hidden="true"></canvas>' : '<i>' + x[2] + '</i>')
            + '<span>' + x[1] + '</span>' + (on ? '<em>' + ICO.check + '</em>' : '') + '</button>';
        }).join('') + '</div>';
  }
  function body() {
    return '<div class="thm-lbl">צבעים</div><div class="thm-row">' + THEMES.map(swatch).join('') + '</div>' + figRow();
  }
  /* דמות חיה מההדמיות עצמן — רואים בדיוק מה ייראה בתרגילים */
  function mountFigs(root) {
    if (!window.EBAnim || !EBAnim.mount) return;
    root.querySelectorAll('canvas[data-figprev]').forEach(function (cv) {
      try { EBAnim.mount(cv, 'סקוואט', { fig: cv.getAttribute('data-figprev') }); } catch (e) {}
    });
  }
  function close() { var w = document.getElementById('thmSheet'); if (w) w.remove(); }
  function open() {
    close();
    var w = document.createElement('div');
    w.id = 'thmSheet'; w.className = 'thm-mask';
    w.innerHTML = '<div class="thm-sheet" role="dialog" aria-modal="true" aria-label="התאמה אישית">'
      + '<div class="thm-h"><b>' + (EBTheme.figure ? 'התאמה אישית' : 'צבעים') + '</b>'
      + '<button class="thm-x" data-thm-close aria-label="סגירה">×</button></div>'
      + '<div class="thm-body">' + body() + '</div></div>';
    w.addEventListener('click', function (e) {
      var b;
      if (e.target === w || e.target.closest('[data-thm-close]')) return close();
      if ((b = e.target.closest('[data-thm]'))) { set(b.getAttribute('data-thm')); return; }
      if ((b = e.target.closest('[data-thmfig]')) && EBTheme.figure) { EBTheme.figure.set(b.getAttribute('data-thmfig')); w.querySelector('.thm-body').innerHTML = body(); mountFigs(w); }
    });
    document.body.appendChild(w);
    mountFigs(w);
    var f = w.querySelector('.thm-opt.on'); if (f) try { f.focus({ preventScroll: true }); } catch (e) {}
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });

  function set(t) {
    apply(t);
    try { localStorage.setItem('eb_theme', get()); } catch (e) {}
    var b = document.querySelector('#thmSheet .thm-body'); if (b) { b.innerHTML = body(); mountFigs(b); }
    try { window.dispatchEvent(new CustomEvent('eb-theme', { detail: get() })); } catch (e) {}
  }

  window.EBTheme = { THEMES: THEMES, get: get, set: set, open: open, close: close, sw: sw, figure: null };
  /* שמות שהדפים כבר קוראים להם */
  window.themeSw = sw;
  window.toggleTheme = open;
  window.isLight = function () { return get() === 'light'; };
})();

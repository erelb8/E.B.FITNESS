/* =====================================================================
   E.B FIT — תנועה: מעבר בין מסכים ומספרים שעולים
   ---------------------------------------------------------------------
   עובד משני הצדדים בלי לגעת בקוד שלהם: מסתכל על האזור שבו המסך
   מצויר (#view באפליקציית המאמן, #wrap בדף המתאמן) ומגיב כשהוא
   מתחלף.

   החלטה אחת שקובעת הכול: אנימציה רק כשעוברים למסך אחר. הסנכרון
   מצייר מחדש את אותו מסך כל כמה שניות, ומספר שעולה מאפס בכל ציור
   כזה, או מסך שקופץ, היו מעצבנים תוך דקה. לכן "מסך" מזוהה לפי
   VIEW/ARG/SUBTAB אצל המאמן ולפי הקטגוריה הפתוחה אצל המתאמן, ומספר
   עולה רק אם הערך שלו השתנה מאז הפעם הקודמת שהוצג.
   ===================================================================== */
(function () {
  'use strict';

  (window.EB_MOD = window.EB_MOD || {})['fx'] = 'v247';

  var REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = document.getElementById('view') || document.getElementById('wrap');
  document.documentElement.classList.add(document.getElementById('view') ? 'fx-coach' : 'fx-trainee');
  if (!root || REDUCED || !window.MutationObserver) return;

  function screenKey() {
    if (typeof window.VIEW !== 'undefined') return [window.VIEW, window.ARG, window.SUBTAB].join('|');
    var cat = document.querySelector('#categoryModal[class*="open"], #categoryModal.on');
    return cat ? 'cat:' + (cat.getAttribute('data-cat') || '') : 'home';
  }

  /* מספר שעולה: "1,790", "₪6,050", "2.8" — הספרות מתחלפות והשאר נשאר */
  var SEEN = {};
  function countUp(el, key) {
    var txt = el.textContent || '';
    var m = txt.match(/-?\d[\d,]*(\.\d+)?/);
    if (!m || txt.length > 18 || el.children.length) return;   // רק טקסט נקי — לא דורסים סימון בתוכו
    if (SEEN[key] === txt) return;          // אותו ערך כמו בפעם הקודמת — בלי אנימציה
    var first = SEEN[key] === undefined;
    SEEN[key] = txt;
    if (!first) return;                     // ערך שהשתנה בזמן שהמסך פתוח — מתעדכן בשקט
    var target = parseFloat(m[0].replace(/,/g, ''));
    if (!isFinite(target) || Math.abs(target) < 2) return;
    var dec = (m[1] || '').length ? m[1].length - 1 : 0;
    var pre = txt.slice(0, m.index), post = txt.slice(m.index + m[0].length);
    /* 14 צעדים ולא כל פריים: כל עדכון טקסט הוא חישוב פריסה, ובטלפון
       חלש 40 עדכונים בשנייה על מסך עמוס הורגשו כתקיעה */
    var n = 0, STEPS = 14;
    (function step() {
      if (!el.isConnected) return;
      n++;
      var k = n / STEPS, e = 1 - Math.pow(1 - k, 3), v = target * e;
      el.textContent = n >= STEPS ? txt : pre + (dec ? v.toFixed(dec) : Math.round(v).toLocaleString('en-US')) + post;
      if (n < STEPS) setTimeout(step, 45);
    })();
  }

  var last = null, busy = false;
  new MutationObserver(function () {
    if (busy) return;
    busy = true;
    requestAnimationFrame(function () {
      busy = false;
      var k = screenKey();
      var changed = k !== last; last = k;
      if (changed) {
        root.classList.remove('fx-in'); void root.offsetWidth; root.classList.add('fx-in');
        clearTimeout(root._fxT); root._fxT = setTimeout(function () { root.classList.remove('fx-in'); }, 700);
        SEEN = {};
      }
      var nums = root.querySelectorAll('.stat .val, .overview-card strong, .hstat b');
      for (var i = 0; i < nums.length; i++) countUp(nums[i], k + '#' + i);
    });
  }).observe(root, { childList: true });
})();

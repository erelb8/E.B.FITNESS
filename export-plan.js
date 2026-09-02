/* =====================================================================
   E.B FIT — ייצוא תוכנית לקובץ
   ---------------------------------------------------------------------
   מייצר מתוך התוכנית שבמערכת קובץ HTML עצמאי אחד למתאמן: כל יום
   אימון הוא כרטיס שנפתח בלחיצה, עם ציר אנכי שהתרגילים יושבים עליו
   וטבעת התקדמות שמתמלאת כשמסמנים.

   הקובץ עומד בפני עצמו — בלי שרת, בלי חשבון, בלי אינטרנט אחרי
   הפתיחה הראשונה. הסימונים נשמרים במכשיר של המתאמן.

   למה קובץ ולא רק הקישור: קישור דורש חיבור וכניסה. קובץ אפשר לשלוח
   בווטסאפ, לשמור ב"קבצים", ולפתוח גם כשאין קליטה במכון.
   ===================================================================== */
(function () {
  'use strict';

  (window.EB_MOD = window.EB_MOD || {})['exportPlan'] = 'v53';

  var esc2 = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  };

  /* ---------- בניית הקובץ ---------- */
  function build(t) {
    var days = ((t.program || {}).days) || [];
    var totalEx = days.reduce(function (a, d) { return a + (d.exercises || []).length; }, 0);
    var key = 'ebplan_' + t.id;

    var M = window.EBMetrics ? EBMetrics.compute(t) : {};
    var stats = [];
    if (M.height)            stats.push(['גובה', M.height + ' ס״מ']);
    if (M.weight)            stats.push(['משקל', M.weight.v + ' ק״ג']);
    if (t.goal)              stats.push(['מטרה', t.goal]);
    if (days.length)         stats.push(['ימי אימון', String(days.length)]);
    if (M.kcal)              stats.push(['יעד יומי', M.kcal + ' קק״ל']);
    if (M.protein)           stats.push(['חלבון', M.protein + ' ג׳']);

    var pills = stats.map(function (s) {
      return '<div class="pill"><span>' + esc2(s[0]) + '</span><b>' + esc2(s[1]) + '</b></div>';
    }).join('');

    var cards = days.map(function (d, di) {
      var ex = d.exercises || [];
      var rows = ex.map(function (e, ei) {
        var spec = [e.sets, e.reps].filter(Boolean).join('×') || (e.reps || '');
        return '<li class="ex" data-d="' + di + '" data-e="' + ei + '">'
          + '<button class="dot" aria-label="סימון"></button>'
          + '<div class="ex-main"><div class="ex-name">' + esc2(e.name) + '</div>'
          + (e.note ? '<div class="ex-note">' + esc2(e.note) + '</div>' : '')
          + '</div><div class="ex-spec">'
          + (spec ? '<span class="spec">' + esc2(spec) + '</span>' : '')
          + (e.weight ? '<span class="rest">' + esc2(e.weight) + '</span>' : '')
          + (e.rest ? '<span class="rest">מנוחה ' + esc2(e.rest) + '</span>' : '')
          + '</div></li>';
      }).join('');

      return '<section class="day" data-d="' + di + '">'
        + '<button class="day-head" aria-expanded="false">'
        + '<span class="ring"><svg viewBox="0 0 40 40">'
        + '<circle class="rb" cx="20" cy="20" r="16"/><circle class="rf" cx="20" cy="20" r="16"/></svg>'
        + '<i>' + (di + 1) + '</i></span>'
        + '<span class="day-t"><span class="day-name">' + esc2(d.name || ('יום ' + (di+1))) + '</span>'
        + '<span class="day-meta"><em class="cnt">0</em>/' + ex.length + ' תרגילים</span></span>'
        + '<span class="chev"></span></button>'
        + '<div class="day-body"><ul class="rail">' + rows + '</ul></div></section>';
    }).join('');

    /* התפריט, אם יש */
    var meals = t.meals || [];
    var mealsHtml = '';
    if (meals.length) {
      var byType = {};
      meals.forEach(function (m) { (byType[m.type||'other'] = byType[m.type||'other'] || []).push(m); });
      var TN = { breakfast:'בוקר', pre:'לפני אימון', post:'אחרי אימון',
                 lunch:'צהריים', snack:'ביניים', dinner:'ערב', other:'נוספות' };
      var n = function (v) { var x = Number(v); return isFinite(x) && x > 0 ? x : 0; };
      mealsHtml = '<h2 class="sec">התפריט שלך</h2>';
      ['breakfast','pre','post','lunch','snack','dinner','other'].forEach(function (k) {
        var g = byType[k]; if (!g) return;
        mealsHtml += '<div class="grp">' + esc2(TN[k]) + '</div>';
        g.forEach(function (m) {
          mealsHtml += '<div class="meal">'
            + (m.photo ? '<img src="' + esc2(m.photo) + '" alt="" loading="lazy">' : '')
            + '<div class="meal-b"><div class="meal-n">' + esc2(m.name) + '</div>'
            + (m.desc ? '<div class="meal-d">' + esc2(m.desc) + '</div>' : '')
            + '<div class="tags">'
            + (n(m.kcal)    ? '<span class="tg hot">' + n(m.kcal) + ' קק״ל</span>' : '')
            + (n(m.protein) ? '<span class="tg">חלבון ' + n(m.protein) + '</span>' : '')
            + (n(m.carbs)   ? '<span class="tg">פחמימות ' + n(m.carbs) + '</span>' : '')
            + (n(m.fat)     ? '<span class="tg">שומן ' + n(m.fat) + '</span>' : '')
            + '</div></div></div>';
        });
      });
    }

    return '<!DOCTYPE html>\n<html lang="he" dir="rtl"><head><meta charset="utf-8">'
+ '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
+ '<title>' + esc2(t.name) + ' — תוכנית אימונים</title>'
+ '<meta name="theme-color" content="#17140F">'
+ '<meta name="apple-mobile-web-app-capable" content="yes">'
+ '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">'
+ '<meta name="apple-mobile-web-app-title" content="' + esc2(t.name) + '">'
+ '<link rel="preconnect" href="https://fonts.googleapis.com">'
+ '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
+ '<link href="https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@500;700;900&family=Heebo:wght@300;400;500;700;800&display=swap" rel="stylesheet">'
+ '<style>'
+ ':root{--ink:#17140F;--panel:#1F1B15;--panel-2:#26221B;--line:#37312A;--line-2:#4A4239;'
+ '--text:#EDE4D6;--muted:#A69C8E;--dim:#756B5E;--flame:#8FA84F;--ember:#D9A441;--ok:#BCE05B;--r:14px}'
+ '*{box-sizing:border-box}html,body{margin:0;padding:0}'
+ 'body{background:var(--ink);color:var(--text);font-family:Heebo,system-ui,sans-serif;font-size:15px;line-height:1.5;'
+ '-webkit-font-smoothing:antialiased;background-image:radial-gradient(900px 460px at 88% -8%,rgba(143,168,79,.13),transparent 62%);'
+ 'background-attachment:fixed;padding-bottom:calc(48px + env(safe-area-inset-bottom))}'
+ 'h1,h2,h3{font-family:Frank Ruhl Libre,Georgia,serif;margin:0;font-weight:700;letter-spacing:-.02em}'
+ 'button{font-family:inherit;color:inherit;cursor:pointer}'
+ '.wrap{max-width:760px;margin:0 auto;padding:0 16px}'
+ 'header{padding:calc(30px + env(safe-area-inset-top)) 0 22px;position:relative;overflow:hidden}'
+ 'header::after{content:"";position:absolute;left:-90px;top:-120px;width:280px;height:280px;'
+ 'border:1px solid rgba(143,168,79,.16);border-radius:50%}'
+ 'header::before{content:"";position:absolute;left:-30px;top:-60px;width:170px;height:170px;'
+ 'border:1px solid rgba(143,168,79,.10);border-radius:50%}'
+ '.badge{display:inline-block;font-family:Heebo;font-weight:700;font-size:11px;letter-spacing:.14em;'
+ 'color:var(--flame);background:rgba(143,168,79,.10);border:1px solid rgba(143,168,79,.30);padding:5px 12px;border-radius:20px}'
+ 'header h1{font-size:clamp(28px,7vw,42px);margin:12px 0 6px;font-weight:900}'
+ 'header .sub{color:var(--muted);font-size:14.5px}'
+ '.pills{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px}'
+ '.pill{background:var(--panel);border:1px solid var(--line);border-radius:20px;padding:7px 14px;'
+ 'font-size:13px;color:var(--muted);display:flex;gap:7px;align-items:baseline}'
+ '.pill b{color:var(--text);font-family:Heebo;font-weight:700}'
+ '.prog{margin:22px 0 14px;background:var(--panel);border:1px solid var(--line);border-radius:var(--r);'
+ 'padding:18px;display:flex;gap:18px;align-items:center}'
+ '.gauge{position:relative;width:76px;height:76px;flex:none}'
+ '.gauge svg{width:100%;height:100%;transform:rotate(-90deg)}'
+ '.gauge circle{fill:none;stroke-width:6;stroke-linecap:round}'
+ '.gauge .g-bg{stroke:var(--line)}'
+ '.gauge .g-fg{stroke:url(#g);stroke-dasharray:207;stroke-dashoffset:207;transition:stroke-dashoffset .5s}'
+ '.gauge .g-num{position:absolute;inset:0;display:grid;place-items:center;font-family:Heebo;font-weight:900;font-size:19px}'
+ '.prog-info{flex:1;min-width:0}.prog-info .t{font-family:Heebo;font-weight:700;font-size:15px}'
+ '.prog-info .s{color:var(--muted);font-size:13px;margin-top:2px}'
+ '.bar{height:6px;background:var(--panel-2);border-radius:20px;overflow:hidden;margin-top:11px}'
+ '.bar i{display:block;height:100%;width:0;border-radius:20px;background:linear-gradient(90deg,var(--flame),var(--ember));transition:width .5s}'
+ '.reset{margin-top:12px;background:none;border:1px dashed var(--line-2);color:var(--dim);font-size:12.5px;padding:7px 14px;border-radius:9px}'
+ '.day{background:var(--panel);border:1px solid var(--line);border-radius:var(--r);margin-bottom:12px;overflow:hidden}'
+ '.day-head{width:100%;background:none;border:0;padding:15px 16px;display:flex;align-items:center;gap:13px;text-align:right}'
+ '.ring{position:relative;width:40px;height:40px;flex:none}'
+ '.ring svg{width:100%;height:100%;transform:rotate(-90deg)}.ring circle{fill:none;stroke-width:2.5}'
+ '.ring .rb{stroke:var(--line)}'
+ '.ring .rf{stroke:var(--flame);stroke-dasharray:100.5;stroke-dashoffset:100.5;stroke-linecap:round;transition:stroke-dashoffset .45s}'
+ '.ring i{position:absolute;inset:0;display:grid;place-items:center;font-style:normal;font-family:Heebo;font-weight:900;font-size:14px;color:var(--muted)}'
+ '.day.done .ring i{color:var(--ok)}'
+ '.day-t{flex:1;min-width:0}'
+ '.day-name{display:block;font-family:Heebo;font-weight:700;font-size:15.5px;line-height:1.3}'
+ '.day-meta{display:block;color:var(--dim);font-size:12.5px;margin-top:3px}'
+ '.day-meta em{font-style:normal;color:var(--flame);font-weight:700}'
+ '.chev{width:9px;height:9px;border-right:2px solid var(--dim);border-bottom:2px solid var(--dim);'
+ 'transform:rotate(45deg);transition:transform .25s;flex:none}'
+ '.day.on .chev{transform:rotate(-135deg)}'
+ '.day-body{display:none;padding:0 16px 6px}.day.on .day-body{display:block}'
+ '.rail{list-style:none;margin:0;padding:4px 0 12px;position:relative}'
+ '.rail::before{content:"";position:absolute;top:14px;bottom:22px;right:15px;width:1px;'
+ 'background:linear-gradient(180deg,transparent,var(--line) 8%,var(--line) 92%,transparent)}'
+ '.ex{display:flex;gap:12px;align-items:flex-start;padding:9px 0;position:relative}'
+ '.dot{width:31px;height:31px;flex:none;border-radius:50%;background:var(--ink);border:2px solid var(--line-2);'
+ 'position:relative;z-index:1;padding:0;transition:.18s}'
+ '.dot::after{content:"";position:absolute;inset:0;margin:auto;width:9px;height:5px;'
+ 'border-left:2px solid #141A06;border-bottom:2px solid #141A06;transform:rotate(-45deg) translate(1px,-2px);opacity:0}'
+ '.ex.done .dot{background:var(--ok);border-color:var(--ok)}.ex.done .dot::after{opacity:1}'
+ '.ex-main{flex:1;min-width:0;padding-top:4px}'
+ '.ex-name{font-size:15px;font-weight:500;line-height:1.35}'
+ '.ex.done .ex-name{color:var(--dim);text-decoration:line-through}'
+ '.ex-note{color:var(--ember);font-size:12.5px;margin-top:3px;line-height:1.45}'
+ '.ex-spec{display:flex;flex-direction:column;align-items:flex-end;gap:4px;padding-top:4px;flex:none}'
+ '.spec{font-family:Heebo;font-weight:700;font-size:13px;background:var(--panel-2);border:1px solid var(--line);'
+ 'border-radius:8px;padding:3px 9px;white-space:nowrap}'
+ '.ex.done .spec{color:var(--dim)}'
+ '.rest{font-size:11px;color:var(--dim);white-space:nowrap}'
+ '.sec{font-size:19px;margin:30px 0 4px}'
+ '.grp{color:var(--dim);font-size:12px;letter-spacing:.1em;margin:16px 0 8px}'
+ '.meal{background:var(--panel);border:1px solid var(--line);border-radius:var(--r);overflow:hidden;margin-bottom:10px}'
+ '.meal img{width:100%;aspect-ratio:16/10;object-fit:cover;display:block;background:var(--ink)}'
+ '.meal-b{padding:13px}'
+ '.meal-n{font-family:Heebo;font-weight:700;font-size:15.5px;line-height:1.3}'
+ '.meal-d{color:var(--muted);font-size:13px;margin-top:5px;line-height:1.5;white-space:pre-wrap}'
+ '.tags{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}'
+ '.tg{font-size:12px;padding:4px 10px;border-radius:20px;white-space:nowrap;background:var(--panel-2);'
+ 'color:var(--muted);border:1px solid var(--line)}'
+ '.tg.hot{background:rgba(143,168,79,.12);color:var(--flame);border-color:rgba(143,168,79,.3)}'
+ 'footer{text-align:center;color:var(--dim);font-size:12.5px;padding:26px 16px 10px}'
+ '#sv{position:fixed;bottom:calc(16px + env(safe-area-inset-bottom));right:50%;transform:translate(50%,12px);'
+ 'background:var(--panel-2);border:1px solid var(--line-2);color:var(--muted);font-size:12.5px;'
+ 'padding:8px 16px;border-radius:20px;opacity:0;pointer-events:none;transition:.25s}'
+ '#sv.on{opacity:1;transform:translate(50%,0)}'
+ '@media print{body{background:#fff;color:#000}.prog,.reset,.chev,#sv{display:none}'
+ '.day-body{display:block!important}.day{border-color:#ccc;break-inside:avoid}'
+ '.ex-name,.day-name,.spec,.meal-n{color:#000}}'
+ '</style></head><body>'
+ '<svg width="0" height="0" style="position:absolute"><defs>'
+ '<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">'
+ '<stop offset="0%" stop-color="#8FA84F"/><stop offset="100%" stop-color="#D9A441"/>'
+ '</linearGradient></defs></svg>'
+ '<header><div class="wrap"><div class="badge">' + esc2(t.goal || 'תוכנית אישית') + '</div>'
+ '<h1>' + esc2(t.name) + '</h1>'
+ '<p class="sub">' + days.length + ' ימי אימון · ' + totalEx + ' תרגילים'
+ (meals.length ? ' · ' + meals.length + ' ארוחות' : '') + '</p>'
+ '<div class="pills">' + pills + '</div></div></header>'
+ '<div class="wrap"><div class="prog">'
+ '<div class="gauge"><svg viewBox="0 0 76 76">'
+ '<circle class="g-bg" cx="38" cy="38" r="33"/><circle class="g-fg" cx="38" cy="38" r="33"/></svg>'
+ '<div class="g-num" id="pct">0%</div></div>'
+ '<div class="prog-info"><div class="t">התקדמות השבוע</div>'
+ '<div class="s"><b id="dn">0</b> מתוך ' + totalEx + ' תרגילים</div>'
+ '<div class="bar"><i id="bf"></i></div>'
+ '<button class="reset" id="rs">איפוס לשבוע חדש</button></div></div>'
+ '<main>' + cards + '</main>' + mealsHtml
+ '<footer>נבנה עבור <b>' + esc2(t.name) + '</b> · הסימונים נשמרים במכשיר הזה</footer>'
+ '</div><div id="sv">נשמר</div>'
+ '<script>(function(){'
+ 'var K=' + JSON.stringify(key) + ',T=' + totalEx + ',st={};'
+ 'try{st=JSON.parse(localStorage.getItem(K))||{}}catch(e){}'
+ 'function sv(){try{localStorage.setItem(K,JSON.stringify(st))}catch(e){}'
+ 'var s=document.getElementById("sv");s.classList.add("on");clearTimeout(sv._t);'
+ 'sv._t=setTimeout(function(){s.classList.remove("on")},1100)}'
+ 'function pt(){var d=0;'
+ 'document.querySelectorAll(".day").forEach(function(day){'
+ 'var it=day.querySelectorAll(".ex"),n=0;'
+ 'it.forEach(function(li){var on=!!st[li.dataset.d+":"+li.dataset.e];'
+ 'li.classList.toggle("done",on);if(on)n++});d+=n;'
+ 'day.querySelector(".cnt").textContent=n;'
+ 'day.classList.toggle("done",it.length>0&&n===it.length);'
+ 'var rf=day.querySelector(".rf");'
+ 'if(rf)rf.style.strokeDashoffset=100.5*(1-(it.length?n/it.length:0))});'
+ 'var p=T?Math.round(d/T*100):0;'
+ 'document.getElementById("pct").textContent=p+"%";'
+ 'document.getElementById("dn").textContent=d;'
+ 'document.getElementById("bf").style.width=p+"%";'
+ 'document.querySelector(".g-fg").style.strokeDashoffset=207*(1-p/100)}'
+ 'document.addEventListener("click",function(e){'
+ 'var h=e.target.closest(".day-head");'
+ 'if(h){var d=h.closest(".day");d.classList.toggle("on");'
+ 'h.setAttribute("aria-expanded",d.classList.contains("on"));return}'
+ 'var li=e.target.closest(".ex");'
+ 'if(li&&e.target.closest(".dot")){var k=li.dataset.d+":"+li.dataset.e;'
+ 'if(st[k])delete st[k];else st[k]=1;pt();sv()}});'
+ 'document.getElementById("rs").addEventListener("click",function(){'
+ 'if(!confirm("לאפס את כל הסימונים?"))return;st={};pt();sv()});'
+ 'var f=document.querySelector(".day");'
+ 'if(f){f.classList.add("on");f.querySelector(".day-head").setAttribute("aria-expanded","true")}'
+ 'pt()})();<\/script></body></html>';
  }

  /* ---------- ייצוא ---------- */
  function slug(name) {
    return String(name || 'plan').replace(/[^\w֐-׿]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  }

  async function run(traineeId) {
    var t = tById(traineeId); if (!t) return;
    var days = ((t.program || {}).days) || [];
    if (!days.length) { toast('אין תוכנית לייצוא — בנה או ייבא קודם'); return; }

    var html = build(t);
    var file = slug(t.name) + '.html';
    var blob = new Blob([html], { type: 'text/html;charset=utf-8' });

    /* בסאפארי על אייפון הורדה של blob מתנהגת אחרת, ולעיתים נחסמת.
       מנסים קודם שיתוף — שם המתאמן מקבל את הקובץ ישירות לווטסאפ. */
    if (navigator.canShare) {
      try {
        var f = new File([blob], file, { type: 'text/html' });
        if (navigator.canShare({ files: [f] })) {
          await navigator.share({ files: [f], title: t.name + ' — תוכנית אימונים' });
          toast('נשלח');
          return;
        }
      } catch (e) { if (e && e.name === 'AbortError') return; }
    }

    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = file;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    toast('הקובץ ירד: ' + file);
  }

  /* תצוגה מקדימה בלשונית חדשה, בלי להוריד */
  function preview(traineeId) {
    var t = tById(traineeId); if (!t) return;
    var days = ((t.program || {}).days) || [];
    if (!days.length) { toast('אין תוכנית להצגה'); return; }
    var w = window.open('', '_blank');
    if (!w) { toast('הדפדפן חסם את החלון'); return; }
    w.document.write(build(t));
    w.document.close();
  }

  window.EBExport = { run: run, preview: preview, build: build };
})();

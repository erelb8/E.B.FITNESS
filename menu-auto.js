/* =====================================================================
   E.B FIT — תפריט יומי אוטומטי לפי הדיאטה
   ---------------------------------------------------------------------
   המאמן לוחץ "תפריט אוטומטי" בלשונית התפריט, ומקבל יום שלם מהארוחות
   של הדיאטה שבחר למתאמן (metrics.js · meal-extra.js): ארוחה לכל משבצת,
   קרוב ככל האפשר ליעד הקלוריות והחלבון שלו.

   איך: לכל משבצת יש מאגר ארוחות מתאימות. עוברים על הצירופים (המאגרים
   קטנים — עשרות ספורות), מקטינים או מגדילים את כל המנות באותו יחס כדי
   להגיע לקלוריות, ובוחרים את הצירוף שבו החלבון הכי קרוב ליעד. היחס
   מוגבל ל-0.7–1.5: מעבר לזה זו כבר ארוחה אחרת, לא מנה גדולה יותר.

   כל משבצת אפשר להחליף בלחיצה, ושום דבר לא נכנס לתפריט עד "הוספה".
   הגרמים מעוגלים ל-5 — אף אחד לא שוקל 37 גרם אורז.
   ===================================================================== */
(function () {
  'use strict';

  (window.EB_MOD = window.EB_MOD || {})['menuAuto'] = 'v242';

  /* משבצות לכל דיאטה. pool: מאיזה חלק בספרייה; types: אילו סוגי ארוחה
     מתאימים למשבצת (הראשון קודם); ובצום — גם תבנית לשם, כדי ש"ארוחה
     מרכזית" לא תשב במשבצת של סגירת החלון */
  var PLANS = {
    '':       { pools: [''],        slots: [['בוקר', ['breakfast']], ['צהריים', ['lunch']], ['ערב', ['dinner']], ['ביניים', ['snack']]] },
    keto:     { pools: ['keto'],    slots: [['בוקר', ['breakfast']], ['צהריים', ['lunch']], ['ערב', ['dinner']], ['ביניים', ['snack']]] },
    keto_hp:  { pools: ['keto_hp'], slots: [['בוקר', ['breakfast']], ['צהריים', ['lunch']], ['ערב', ['dinner']], ['ביניים', ['snack', 'post']]] },
    keto_cyc: { pools: ['keto'],    slots: [['בוקר', ['breakfast']], ['צהריים', ['lunch']], ['ערב', ['dinner']], ['ביניים', ['snack']]],
                refeed: { pools: ['keto_cyc'], slots: [['בוקר', ['breakfast']], ['צהריים', ['lunch']], ['אחרי אימון', ['post', 'pre']], ['ערב', ['dinner']]] } },
    med:      { pools: ['med'],     slots: [['בוקר', ['breakfast']], ['צהריים', ['lunch']], ['ערב', ['dinner']], ['ביניים', ['snack']]] },
    if16:     { pools: ['if16'],    slots: [['שבירת צום', ['lunch', 'breakfast'], /^שבירת צום/], ['ארוחה מרכזית', ['dinner'], /^ארוחה מרכזית/],
                                        ['סגירת חלון', ['snack', 'dinner'], /^(ארוחת סגירה|סגירת חלון)/]] }
  };

  var ST = null;   // { tid, refeed, plan, pools: [[meal...]...], pick: [i...], scale, target }

  function r5(g) { return Math.max(5, Math.round(g / 5) * 5); }
  function mealsOf(pool) {
    return EBLib.MEALS.filter(function (m) {
      if (EBLib.kosherOf(m) !== 'ok') return false;
      return pool ? m.section === pool : !m.section;
    });
  }
  function totalsOf(list, s) {
    var T = { k: 0, p: 0, c: 0, f: 0 };
    list.forEach(function (m) { var c = EBLib.calc(m.items).total; T.k += c.k * s; T.p += c.p * s; T.c += c.c * s; T.f += c.f * s; });
    return T;
  }
  function target(t, refeed) {
    var m = null; try { m = EBMetrics.compute(t); } catch (e) {}
    if (!m || !m.kcal) return null;
    if (refeed && m.refeed) return { kcal: m.kcal, protein: m.protein, carbs: m.refeed.carbs, fat: m.refeed.fat };
    return { kcal: m.kcal, protein: m.protein, carbs: m.carbs, fat: m.fatG };
  }

  /* מאגר לכל משבצת. ארוחה שכבר נבחרה למשבצת אחרת לא חוזרת */
  function buildPools(plan) {
    var all = [];
    plan.pools.forEach(function (p) { all = all.concat(mealsOf(p)); });
    return plan.slots.map(function (sl) {
      var out = [];
      sl[1].forEach(function (ty) { all.forEach(function (m) {
        if (m.type === ty && out.indexOf(m) < 0 && (!sl[2] || sl[2].test(m.name))) out.push(m); }); });
      return out.length ? out : all.slice();
    });
  }
  function score(list, tg) {
    var T = totalsOf(list, 1);
    var s = Math.min(1.5, Math.max(0.7, tg.kcal / (T.k || 1)));
    var k = T.k * s, p = T.p * s, c = T.c * s, f = T.f * s;
    /* קלוריות וחלבון קודם; פחמימה ושומן במשקל נמוך יותר — בקיטו הם
       מה שמבדיל יום של 25 ג׳ פחמימה מיום של 45 */
    return { s: s, v: Math.abs(k - tg.kcal) / tg.kcal + 1.5 * Math.abs(p - tg.protein) / tg.protein
      + 0.8 * Math.abs(c - tg.carbs) / Math.max(tg.carbs, 40) + 0.6 * Math.abs(f - tg.fat) / Math.max(tg.fat, 30) };
  }
  /* הצירוף הטוב ביותר. רנדומליות קלה בין הטובים, כדי ש"הצעה אחרת"
     תיתן יום אחר ולא את אותו יום שוב */
  function best(pools, tg, fixed) {
    var res = [];
    var cap = 5000, n = 0;
    /* בתפריט רגיל יש מאות ארוחות לכל סוג — מדגם של 8 לכל משבצת */
    var sample = pools.map(function (p) {
      if (p.length <= 8) return p;
      var c = p.slice();
      for (var i = c.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var x = c[i]; c[i] = c[j]; c[j] = x; }
      return c.slice(0, 8);
    });
    (function rec(i, acc, used) {
      if (n > cap) return;
      if (i === pools.length) {
        n++; var sc = score(acc, tg); res.push({ pick: acc.map(function (m, j) { return pools[j].indexOf(m); }), s: sc.s, v: sc.v }); return;
      }
      var opts = fixed && fixed[i] != null ? [pools[i][fixed[i]]] : sample[i];
      opts.forEach(function (m) { if (used.indexOf(m) < 0) rec(i + 1, acc.concat([m]), used.concat([m])); });
    })(0, [], []);
    res.sort(function (a, b) { return a.v - b.v; });
    var top = res.slice(0, Math.min(5, res.length));
    return top[Math.floor(Math.random() * top.length)];
  }

  function open(tid, refeed) {
    var t = tById(tid); if (!t) return;
    var key = window.EBMetrics && EBMetrics.DIETS && EBMetrics.DIETS[t.diet] ? t.diet : '';
    var plan = PLANS[key];
    if (refeed && plan.refeed) plan = plan.refeed;
    var tg = target(t, refeed);
    if (!tg) { toast('אין יעד קלורי — חסרים משקל, גובה, גיל או מין'); return; }
    var pools = buildPools(plan);
    var b = best(pools, tg);
    if (!b) { toast('אין מספיק ארוחות לדיאטה הזאת'); return; }
    ST = { tid: tid, key: key, refeed: !!refeed, plan: plan, pools: pools, pick: b.pick, scale: b.s, target: tg };
    paint();
  }
  function list() { return ST.pick.map(function (i, j) { return ST.pools[j][i]; }); }
  function rescale() {
    var T = totalsOf(list(), 1);
    ST.scale = Math.min(1.5, Math.max(0.7, ST.target.kcal / (T.k || 1)));
  }
  /* החלפה: הבאה במאגר שלא נבחרה כבר במשבצת אחרת */
  function swap(j) {
    var pool = ST.pools[j], cur = ST.pick[j], taken = list();
    for (var k = 1; k <= pool.length; k++) {
      var i = (cur + k) % pool.length;
      if (taken.indexOf(pool[i]) < 0 || i === cur) { ST.pick[j] = i; break; }
    }
    rescale(); paint();
  }
  function again() { var b = best(ST.pools, ST.target); if (b) { ST.pick = b.pick; ST.scale = b.s; } paint(); }

  function scaled(m) {
    return m.items.map(function (p) { return [p[0], r5(p[1] * ST.scale)]; });
  }
  function paint() {
    var t = tById(ST.tid), D = (window.EBMetrics && EBMetrics.DIETS) || {};
    var ms = list(), rows = '';
    var T = { k: 0, p: 0, c: 0, f: 0 };
    ms.forEach(function (m, j) {
      var c = EBLib.calc(scaled(m)).total;
      T.k += c.k; T.p += c.p; T.c += c.c; T.f += c.f;
      rows += '<div class="line-item" style="align-items:flex-start;gap:10px">'
        + '<div style="flex:1;min-width:0"><div class="muted" style="font-size:11.5px">' + esc(ST.plan.slots[j][0]) + '</div>'
        + '<div style="font-weight:700;font-size:14px;line-height:1.35">' + esc(m.name) + '</div>'
        + '<div class="muted" style="font-size:12px">' + Math.round(c.k) + ' קק״ל · חלבון ' + Math.round(c.p)
        + ' · פחמימה ' + Math.round(c.c) + ' · שומן ' + Math.round(c.f) + '</div></div>'
        + '<button class="btn sm ghost" style="flex:none" onclick="EBMenu.swap(' + j + ')">החלפה</button></div>';
    });
    var tg = ST.target;
    var cell = function (l, v, g, u) {
      var off = g ? Math.round((v - g) / g * 100) : 0;
      return '<div style="flex:1;min-width:70px"><div style="font-family:Heebo;font-weight:700;font-size:17px;white-space:nowrap">' + Math.round(v)
        + '<span class="muted" style="font-size:11px;font-weight:400"> / ' + Math.round(g) + u + '</span></div>'
        + '<div class="muted" style="font-size:11px">' + l + (Math.abs(off) > 10 ? ' · <span dir="ltr" style="color:var(--cop);unicode-bidi:isolate">' + (off > 0 ? '+' : '') + off + '%</span>' : '') + '</div></div>';
    };
    var title = (ST.key ? D[ST.key].he : 'תפריט רגיל') + (ST.refeed ? ' · יום טעינה' : '');
    var hasMeals = (t.meals || []).length;
    openModal('<div class="mh"><h3>תפריט אוטומטי · ' + esc(title) + '</h3><button class="iconbtn" onclick="closeModal()">✕</button></div><div class="mb">'
      + (ST.key === 'keto_cyc'
          ? '<div class="row" style="gap:6px;margin-bottom:10px">'
            + '<button class="btn sm ' + (ST.refeed ? 'ghost' : '') + '" onclick="EBMenu.open(\'' + ST.tid + '\',false)">יום קיטו</button>'
            + '<button class="btn sm ' + (ST.refeed ? '' : 'ghost') + '" onclick="EBMenu.open(\'' + ST.tid + '\',true)">יום טעינה</button></div>' : '')
      + '<div class="row" style="gap:10px;flex-wrap:wrap;margin-bottom:10px">'
      + cell('קלוריות', T.k, tg.kcal, '') + cell('חלבון', T.p, tg.protein, ' ג׳') + cell('פחמימה', T.c, tg.carbs, ' ג׳') + cell('שומן', T.f, tg.fat, ' ג׳')
      + '</div>'
      + (Math.abs(ST.scale - 1) > 0.04 ? '<div class="muted" style="font-size:12px;margin-bottom:6px">המנות ' + (ST.scale > 1 ? 'הוגדלו' : 'הוקטנו')
          + ' פי ' + (Math.round(ST.scale * 100) / 100) + ' כדי להגיע ליעד הקלוריות. הגרמים בתפריט כבר מעודכנים.</div>' : '')
      + (/^keto/.test(ST.key) && !ST.refeed ? '<div class="muted" style="font-size:12px;margin-bottom:6px">הפחמימה כאן כוללת את הסיבים מהירקות — הפחמימה הנטו נמוכה יותר.</div>' : '')
      + rows
      + (hasMeals ? '<label style="display:block;margin-top:12px;font-size:13px"><input type="checkbox" id="mn_replace"> להחליף את '
          + hasMeals + ' הארוחות שכבר בתפריט</label>' : '')
      + '</div><div class="mf"><button class="btn" onclick="EBMenu.apply()">הוספה לתפריט</button>'
      + '<button class="btn ghost" onclick="EBMenu.again()">הצעה אחרת</button>'
      + '<button class="btn ghost" onclick="closeModal()">סגירה</button></div>', true);
  }
  function apply() {
    var t = tById(ST.tid); if (!t) return;
    var rep = document.getElementById('mn_replace');
    if (rep && rep.checked) t.meals = [];
    t.meals = t.meals || [];
    var tag = ST.refeed ? ' (יום טעינה)' : '';
    list().forEach(function (m, j) {
      var items = scaled(m), c = EBLib.calc(items).total;
      t.meals.push({
        id: Math.random().toString(36).slice(2, 10),
        libId: m.id, name: m.name + tag, type: m.type,
        desc: [ST.plan.slots[j][0], m.note || ''].filter(Boolean).join(' · '),
        items: items,
        kcal: String(Math.round(c.k)), protein: String(Math.round(c.p)),
        carbs: String(Math.round(c.c)), fat: String(Math.round(c.f))
      });
    });
    save(); closeModal(); render();
    toast(list().length + ' ארוחות נוספו לתפריט');
  }

  window.EBMenu = { open: open, swap: swap, again: again, apply: apply, PLANS: PLANS };
})();

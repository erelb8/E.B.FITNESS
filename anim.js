/* =====================================================================
   E.B FIT — הדמיות תרגילים
   ---------------------------------------------------------------------
   דמות מקלות שמבצעת את התנועה, מצוירת בזמן אמת על canvas. אין קבצים,
   אין אחסון ואין תעבורה — עובד גם בלי רשת. 855 סרטונים היו תופסים
   כשליש מהאחסון החינמי ושוחקים את מכסת הצפייה החודשית.

   איך זה בנוי:
   • תנוחה = מיקום האגן, זווית הגו, והיעדים של כפות הרגליים והידיים.
     הברכיים והמרפקים מחושבים בקינמטיקה הפוכה (IK) — כך אורכי הגפיים
     קבועים, והרגל שעל הרצפה נשארת על הרצפה.
   • תבנית תנועה = כמה תנוחות ברצף, בלולאה. בערך 40 תבניות מכסות את
     כל 855 התרגילים; הציוד (מוט, משקולות, כבל...) מצויר לפי התרגיל.
   • classify — מתאים לכל תרגיל תבנית לפי השם, השריר והציוד.

   ההדמיה היא תנועה כללית ולא הוראת טכניקה. סרטון אמיתי של המאמן
   (video.js) גובר עליה תמיד.

   מערכת צירים: הרצפה ב-y=0, למעלה שלילי. x חיובי = קדימה (אל מול
   הדמות). זווית 0 = למעלה, 90 = קדימה, 180 = למטה.
   ===================================================================== */
(function () {
  'use strict';

  (window.EB_MOD = window.EB_MOD || {})['anim'] = 'v225';

  var L = { shin: 62, thigh: 64, torso: 78, uarm: 46, farm: 42, neck: 9, head: 15, foot: 17 };
  var ARM = L.uarm + L.farm;

  function dir(a) { var r = a * Math.PI / 180; return [Math.sin(r), -Math.cos(r)]; }
  function add(p, v, k) { k = k == null ? 1 : k; return [p[0] + v[0] * k, p[1] + v[1] * k]; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function lerpP(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t)]; }

  /* שתי עצמות מ-root אל target. pref קובע לאיזה צד המפרק מתכופף:
     R קדימה, L אחורה, U למעלה, D למטה */
  function ik(root, target, l1, l2, pref) {
    var dx = target[0] - root[0], dy = target[1] - root[1];
    var d = Math.hypot(dx, dy) || 0.001;
    var max = l1 + l2 - 0.01, min = Math.abs(l1 - l2) + 0.01;
    var dd = Math.max(min, Math.min(max, d));
    var end = [root[0] + dx / d * dd, root[1] + dy / d * dd];
    var a = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + dd * dd - l2 * l2) / (2 * l1 * dd))));
    var base = Math.atan2(dy, dx);
    var c1 = [root[0] + l1 * Math.cos(base + a), root[1] + l1 * Math.sin(base + a)];
    var c2 = [root[0] + l1 * Math.cos(base - a), root[1] + l1 * Math.sin(base - a)];
    var pick = pref === 'L' ? (c1[0] < c2[0] ? c1 : c2)
             : pref === 'U' ? (c1[1] < c2[1] ? c1 : c2)
             : pref === 'D' ? (c1[1] > c2[1] ? c1 : c2)
             : (c1[0] > c2[0] ? c1 : c2);
    return { mid: pick, end: end };
  }

  /* ---------- תנוחה ---------- */
  /* יעד: [x,y] מוחלט, או ['s',dx,dy] יחסית לכתף, או ['h',dx,dy] לאגן */
  function resolve(kf) {
    var hip = kf.hip, sh = add(hip, dir(kf.torso), L.torso);
    sh = [sh[0], sh[1] - (kf.shy || 0)];
    function res(p, near) {
      if (!p) return near ? [near[0] - 7, near[1]] : null;
      if (p[0] === 's') return [sh[0] + p[1], sh[1] + p[2]];
      if (p[0] === 'h') return [hip[0] + p[1], hip[1] + p[2]];
      return p.slice();
    }
    var f1 = res(kf.f1), h1 = res(kf.h1);
    return {
      hip: hip.slice(), torso: kf.torso, shy: kf.shy || 0, head: kf.head || 0,
      f1: f1, f2: res(kf.f2, f1), h1: h1, h2: res(kf.h2, h1),
      fa1: kf.fa1 == null ? 90 : kf.fa1, fa2: kf.fa2 == null ? (kf.fa1 == null ? 90 : kf.fa1) : kf.fa2,
      kb: kf.kb || 'R', kb2: kf.kb2 || kf.kb || 'R', eb: kf.eb || 'D', eb2: kf.eb2 || kf.eb || 'D'
    };
  }
  function mix(a, b, t) {
    return {
      hip: lerpP(a.hip, b.hip, t), torso: lerp(a.torso, b.torso, t), shy: lerp(a.shy, b.shy, t),
      head: lerp(a.head, b.head, t),
      f1: lerpP(a.f1, b.f1, t), f2: lerpP(a.f2, b.f2, t), h1: lerpP(a.h1, b.h1, t), h2: lerpP(a.h2, b.h2, t),
      fa1: lerp(a.fa1, b.fa1, t), fa2: lerp(a.fa2, b.fa2, t),
      kb: t < 0.5 ? a.kb : b.kb, kb2: t < 0.5 ? a.kb2 : b.kb2, eb: t < 0.5 ? a.eb : b.eb, eb2: t < 0.5 ? a.eb2 : b.eb2
    };
  }
  function body(p) {
    var sh = add(p.hip, dir(p.torso), L.torso); sh[1] -= p.shy;
    var hd = add(sh, dir(p.torso + p.head), L.neck + L.head);
    /* הצד הרחוק יוצא מנקודה מוזזת מעט — בלי זה הדמות נראית שטוחה,
       כאילו שתי הרגליים והידיים יוצאות מאותו מפרק */
    var tv = dir(p.torso), dep = [-tv[1] * 0 - 4, -2];
    var hip2 = [p.hip[0] + dep[0], p.hip[1] + dep[1]], sh2 = [sh[0] + dep[0], sh[1] + dep[1]];
    var k1 = ik(p.hip, p.f1, L.thigh, L.shin, p.kb), k2 = ik(hip2, p.f2, L.thigh, L.shin, p.kb2);
    var e1 = ik(sh, p.h1, L.uarm, L.farm, p.eb), e2 = ik(sh2, p.h2, L.uarm, L.farm, p.eb2);
    return {
      hip: p.hip, sh: sh, head: hd, hip2: hip2, sh2: sh2,
      knee1: k1.mid, ank1: k1.end, toe1: add(k1.end, dir(p.fa1), L.foot),
      knee2: k2.mid, ank2: k2.end, toe2: add(k2.end, dir(p.fa2), L.foot),
      elb1: e1.mid, wr1: e1.end, elb2: e2.mid, wr2: e2.end
    };
  }

  /* ---------- תנוחות בסיס ---------- */
  var HANG = ['s', 4, 86];
  function stand(o) { return Object.assign({ hip: [0, -125], torso: 0, f1: [0, 0], h1: HANG }, o || {}); }
  /* ידיים לפי ציוד, בתבניות שבהן זה משנה (סקוואט, לאנג׳, הליכה) */
  function holdFor(eq, mode) {
    if (mode === 'back' || (eq === 'bar' || eq === 'smith')) return { h: ['s', -12, 8], eb: 'D', hold: 'back' };
    if (eq === 'db' || eq === 'kb') return mode === 'side' ? { h: HANG, hold: 'hand' } : { h: ['s', 20, 34], eb: 'D', hold: 'hand' };
    if (eq === 'ball') return { h: ['s', 30, 34], eb: 'D', hold: 'ball' };
    if (eq === 'band') return { h: ['s', 10, 70], hold: 'band' };
    return { h: ['s', 84, 14], hold: null };
  }

  /* ---------- התבניות ----------
     כל תבנית מחזירה { kf:[{t,pose}], dur, props:[], hold } */
  var P = {};
  function seq(poses, dur) {
    var n = poses.length, kf = [];
    poses.forEach(function (p, i) { kf.push({ t: i / n, p: p }); });
    return { kf: kf, dur: dur || 2600 };
  }
  function bench(x, y, w) { return { k: 'bench', r: [x, y, w, 9] }; }

  P.squat = { he: 'סקוואט', fn: function (eq) {
    var h = holdFor(eq);
    var A = stand({ h1: h.h, eb: h.eb }), B = stand({ hip: [-40, -66], torso: 38, h1: h.h, eb: h.eb });
    if (eq === 'machine') { A.torso = B.torso = 12; B.hip = [-30, -62]; }
    var s = seq([A, B], 2800); s.hold = h.hold; if (eq === 'smith') s.props = [{ k: 'rails' }];
    return s; } };
  P.jumpsquat = { he: 'קפיצה', fn: function () {
    var s = seq([stand({ h1: ['s', 40, 60] }), stand({ hip: [-38, -70], torso: 40, h1: ['s', -30, 70] }),
                 stand({ hip: [0, -160], f1: [0, -34], fa1: 140, h1: ['s', 20, -84] }), stand({ hip: [-38, -70], torso: 40, h1: ['s', 50, 60] })], 2000);
    return s; } };
  P.boxjump = { he: 'קפיצה לקופסה', fn: function () {
    var s = seq([stand({ hip: [-38, -70], torso: 40, h1: ['s', -30, 70] }), stand({ hip: [40, -190], f1: [60, -70], fa1: 120, h1: ['s', 30, -80] }),
                 stand({ hip: [55, -132], f1: [80, -55], torso: 25, h1: ['s', 50, 40] }), stand({ hip: [80, -180], f1: [80, -55], h1: HANG })], 2600);
    s.props = [{ k: 'box', r: [50, -55, 70, 55] }]; return s; } };
  P.lunge = { he: 'לאנג׳', fn: function (eq) {
    var h = holdFor(eq, 'side');
    var A = { hip: [-6, -122], torso: 3, f1: [42, 0], f2: [-62, 0], fa2: 125, h1: h.h, kb2: 'R' };
    var B = { hip: [-10, -64], torso: 6, f1: [42, 0], f2: [-62, 0], fa2: 125, h1: h.h, kb2: 'D' };
    var s = seq([A, B], 2800); s.hold = h.hold; return s; } };
  P.bulgarian = { he: 'סקוואט בולגרי', fn: function (eq) {
    var h = holdFor(eq, 'side');
    var A = { hip: [-4, -118], torso: 6, f1: [40, 0], f2: [-82, -48], fa2: 160, h1: h.h, kb2: 'D' };
    var B = { hip: [-14, -66], torso: 14, f1: [40, 0], f2: [-82, -48], fa2: 160, h1: h.h, kb2: 'D' };
    var s = seq([A, B], 2800); s.hold = h.hold; s.props = [bench(-130, -48, 70), { k: 'legs', r: [-125, -48, 60, 48] }]; return s; } };
  P.stepup = { he: 'עלייה על מדרגה', fn: function (eq) {
    var h = holdFor(eq, 'side');
    var A = { hip: [-4, -125], torso: 4, f1: [45, -52], f2: [-30, 0], h1: h.h };
    var B = { hip: [40, -178], torso: 2, f1: [45, -52], f2: [36, -60], fa2: 110, h1: h.h, kb2: 'R' };
    var s = seq([A, B], 3000); s.hold = h.hold; s.props = [{ k: 'box', r: [20, -52, 80, 52] }]; return s; } };
  P.hinge = { he: 'ציר ירך', fn: function (eq) {
    var back = eq === 'bar' && false;
    var A = stand({ h1: HANG }), B = stand({ hip: [-62, -110], torso: 76, h1: ['s', -4, 86] });
    var s = seq([A, B], 3000); s.hold = back ? 'back' : (eq === 'bar' ? 'plate' : (eq === 'db' || eq === 'kb') ? 'hand' : eq === 'band' ? 'bandfoot' : null);
    if (eq === 'cable') { s.hold = 'cable'; s.cable = [40, -6]; }
    return s; } };
  P.deadlift = { he: 'דדליפט', fn: function (eq) {
    var A = stand({ hip: [-54, -76], torso: 56, h1: ['s', -4, 86] }), B = stand({ h1: HANG });
    var s = seq([A, B], 3000); s.hold = eq === 'bar' || eq === 'smith' ? 'plate' : (eq === 'band' ? 'bandfoot' : 'hand'); return s; } };
  P.goodmorning = { he: 'גוד מורנינג', fn: function (eq) {
    var A = stand({ h1: ['s', -12, 8] }), B = stand({ hip: [-60, -112], torso: 76, h1: ['s', -12, 8] });
    var s = seq([A, B], 3000); s.hold = eq === 'bw' ? null : 'back'; return s; } };
  P.swing = { he: 'סווינג', fn: function () {
    var A = stand({ hip: [-54, -102], torso: 70, h1: ['s', -28, 74] }), B = stand({ torso: -4, h1: ['s', 84, 6] });
    var s = seq([A, B], 1700); s.hold = 'kb'; return s; } };
  P.hipthrust = { he: 'היפ ת׳רסט', fn: function (eq) {
    var A = { hip: [0, -26], torso: -73, f1: [70, 0], h1: ['h', 4, -6], kb: 'U', eb: 'U' };
    var B = { hip: [6, -80], torso: -110, f1: [70, 0], h1: ['h', 4, -6], kb: 'U', eb: 'U' };
    var s = seq([A, B], 2600); s.props = [bench(-125, -46, 70), { k: 'legs', r: [-120, -46, 60, 46] }];
    s.hold = eq === 'bar' || eq === 'smith' || eq === 'db' || eq === 'machine' ? 'hipbar' : (eq === 'band' ? 'hipband' : null); return s; } };
  P.bridge = { he: 'גשר', fn: function (eq) {
    var A = { hip: [0, -10], torso: -92, f1: [56, 0], h1: ['h', -20, 8], kb: 'U', eb: 'D' };
    var B = { hip: [0, -56], torso: -121, f1: [56, 0], h1: ['h', -20, 8], kb: 'U', eb: 'D' };
    if (eq === 'ball') { A.f1 = B.f1 = [96, -40]; A.hip = [0, -14]; B.hip = [0, -52]; }
    var s = seq([A, B], 2600); s.hold = eq === 'ball' ? 'ballfeet' : (eq === 'band' ? 'hipband' : null);
    if (eq === 'trx') { A.f1 = B.f1 = [100, -40]; s.hold = 'trxfeet'; }
    return s; } };
  P.calf = { he: 'עליות עקבים', fn: function (eq) {
    var h = holdFor(eq, 'side');
    var A = stand({ h1: h.h, fa1: 90 }), B = stand({ hip: [0, -139], f1: [0, -14], fa1: 142, h1: h.h });
    var s = seq([A, B], 2000); s.hold = eq === 'machine' || eq === 'smith' || eq === 'bar' ? 'back' : h.hold; return s; } };
  P.legext = { he: 'פשיטת ברך', fn: function () {
    var A = { hip: [0, -62], torso: -8, f1: [64, -2], h1: ['h', 10, 8], kb: 'U' }, B = { hip: [0, -62], torso: -8, f1: [122, -78], h1: ['h', 10, 8], kb: 'U' };
    var s = seq([A, B], 2600); s.props = [{ k: 'seat' }]; s.hold = 'pad'; return s; } };
  P.legcurl = { he: 'כפיפת ברך', fn: function (eq) {
    if (eq === 'ball' || eq === 'trx' || eq === 'other') return P.bridge.fn(eq === 'other' ? 'bw' : eq);
    var A = { hip: [10, -60], torso: -90, f1: [134, -60], h1: ['s', -12, 24], kb: 'D', eb: 'D', fa1: 180 };
    var B = { hip: [10, -60], torso: -90, f1: [80, -122], h1: ['s', -12, 24], kb: 'D', eb: 'D', fa1: 180 };
    var s = seq([A, B], 2600); s.props = [bench(-100, -50, 200), { k: 'legs', r: [-90, -50, 170, 50] }]; s.hold = eq === 'band' ? 'bandfoot' : (eq === 'db' ? 'footdb' : 'pad'); return s; } };
  P.legpress = { he: 'לחיצת רגליים', fn: function () {
    var A = { hip: [0, -42], torso: -58, f1: [112, -122], h1: ['h', 4, 8], kb: 'U', fa1: 30 }, B = { hip: [0, -42], torso: -58, f1: [62, -108], h1: ['h', 4, 8], kb: 'U', fa1: 30 };
    var s = seq([A, B], 2800); s.props = [{ k: 'sled' }]; return s; } };
  P.pushup = { he: 'שכיבת סמיכה', fn: function (eq) {
    var A = { hip: [-72, -55], torso: 67, f1: [-196, 0], h1: [0, 0], fa1: 160, kb: 'U', eb: 'L' };
    var B = { hip: [-74, -20], torso: 81, f1: [-196, 0], h1: [0, 0], fa1: 160, kb: 'U', eb: 'L' };
    var s = seq([A, B], 2400); if (eq === 'band') s.hold = 'bandback'; if (eq === 'trx') s.hold = 'trxhands';
    if (eq === 'ball') s.hold = 'ballhands'; return s; } };
  P.plank = { he: 'פלאנק', fn: function () {
    var A = { hip: [-72, -52], torso: 68, f1: [-196, 0], h1: [0, 0], fa1: 160, kb: 'U', eb: 'L' };
    var B = { hip: [-72, -58], torso: 66, f1: [-196, 0], h1: [0, 0], fa1: 160, kb: 'U', eb: 'L' };
    return seq([A, B], 3200); } };
  P.climber = { he: 'מטפס הרים', fn: function () {
    var A = { hip: [-72, -55], torso: 67, f1: [-120, -20], f2: [-196, 0], h1: [0, 0], fa1: 160, fa2: 160, kb: 'D', kb2: 'U', eb: 'L' };
    var B = { hip: [-72, -55], torso: 67, f1: [-196, 0], f2: [-120, -20], h1: [0, 0], fa1: 160, fa2: 160, kb: 'U', kb2: 'D', eb: 'L' };
    return seq([A, B], 1100); } };
  P.dip = { he: 'מקבילים', fn: function (eq) {
    var A = { hip: [0, -140], torso: 2, f1: [-34, -28], fa1: 170, h1: [4, -130], kb: 'R', eb: 'L' };
    var B = { hip: [-14, -96], torso: 20, f1: [-58, -8], fa1: 170, h1: [4, -130], kb: 'R', eb: 'L' };
    var s = seq([A, B], 2600); s.props = [{ k: 'dipbar', y: -130 }]; return s; } };
  P.scapdip = { he: 'דיפס שכמות', fn: function () {
    var A = { hip: [0, -140], torso: 2, f1: [-34, -28], fa1: 170, h1: [4, -130], kb: 'R', eb: 'L' };
    var B = { hip: [0, -126], torso: 2, shy: 12, f1: [-34, -14], fa1: 170, h1: [4, -130], kb: 'R', eb: 'L' };
    var s = seq([A, B], 2400); s.props = [{ k: 'dipbar', y: -130 }]; return s; } };
  P.benchdip = { he: 'דיפס על ספסל', fn: function () {
    var A = { hip: [-4, -60], torso: -4, f1: [110, 0], h1: [-22, -48], kb: 'U', eb: 'L' };
    var B = { hip: [-6, -24], torso: 6, f1: [110, 0], h1: [-22, -48], kb: 'U', eb: 'L' };
    var s = seq([A, B], 2400); s.props = [bench(-70, -48, 60), { k: 'legs', r: [-65, -48, 50, 48] }]; return s; } };
  P.press = { he: 'לחיצה בשכיבה', fn: function (eq, v) {
    var t = v === 'incline' ? -62 : v === 'decline' ? -100 : -90;
    var A = { hip: [40, -58], torso: t, f1: [104, 0], h1: ['s', 0, -86], kb: 'U', eb: 'D' };
    var B = { hip: [40, -58], torso: t, f1: [104, 0], h1: ['s', 6, -12], kb: 'U', eb: 'D' };
    var s = seq([A, B], 2600); s.props = [{ k: 'pbench', v: v || 'flat' }];
    s.hold = eq === 'bar' || eq === 'smith' ? 'plate' : eq === 'band' ? 'bandback' : eq === 'machine' ? 'handle' : 'hand';
    if (eq === 'smith') s.props.push({ k: 'rails' }); return s; } };
  P.fly = { he: 'פרפר', fn: function (eq) {
    if (eq === 'machine' || eq === 'cable') {
      var A1 = { hip: [0, -62], torso: eq === 'cable' ? 14 : 0, f1: [52, 0], h1: ['s', -18, 30], eb: 'D' };
      var B1 = { hip: [0, -62], torso: eq === 'cable' ? 14 : 0, f1: [52, 0], h1: ['s', 74, 26], eb: 'D' };
      if (eq === 'cable') { A1.hip = B1.hip = [0, -125]; A1.f1 = B1.f1 = [0, 0]; A1.f2 = B1.f2 = [-50, 0]; }
      var s1 = seq([A1, B1], 2600); s1.props = eq === 'machine' ? [{ k: 'seat' }] : []; s1.hold = eq === 'cable' ? 'cable' : 'handle';
      s1.cable = [-60, -260]; return s1; }
    var A = { hip: [40, -58], torso: -90, f1: [104, 0], h1: ['s', 0, -84], kb: 'U', eb: 'D' };
    var B = { hip: [40, -58], torso: -90, f1: [104, 0], h1: ['s', -8, 2], kb: 'U', eb: 'D' };
    var s = seq([A, B], 2800); s.props = [{ k: 'pbench', v: 'flat' }]; s.hold = 'hand'; return s; } };
  P.pullover = { he: 'פולאובר', fn: function (eq) {
    var A = { hip: [40, -58], torso: -90, f1: [104, 0], h1: ['s', 0, -86], kb: 'U', eb: 'U' };
    var B = { hip: [40, -58], torso: -90, f1: [104, 0], h1: ['s', -84, 4], kb: 'U', eb: 'U' };
    var s = seq([A, B], 2800); s.props = [{ k: 'pbench', v: 'flat' }]; s.hold = eq === 'cable' || eq === 'machine' ? null : 'hand'; return s; } };
  P.ohp = { he: 'לחיצת כתפיים', fn: function (eq, v) {
    var seated = v === 'seated';
    var base = seated ? { hip: [0, -62], torso: 0, f1: [60, 0], kb: 'R' } : { hip: [0, -125], torso: 0, f1: [0, 0] };
    var A = Object.assign({}, base, { h1: ['s', 16, -4], eb: 'R' }), B = Object.assign({}, base, { h1: ['s', 4, -86], eb: 'R' });
    var s = seq([A, B], 2600); if (seated) s.props = [{ k: 'seat' }];
    s.hold = eq === 'bar' || eq === 'smith' ? 'plate' : eq === 'band' ? 'bandfoot' : eq === 'machine' ? 'handle' : eq === 'cable' ? 'cable' : 'hand';
    s.cable = [20, 0]; if (eq === 'smith') s.props = (s.props || []).concat([{ k: 'rails' }]); return s; } };
  P.raise = { he: 'הרחקה / הנפה', fn: function (eq, v) {
    var up = v === 'front' ? ['s', 84, 2] : ['s', 40, 10];
    var A = stand({ h1: ['s', 6, 86] }), B = stand({ h1: up });
    var s = seq([A, B], 2600); s.hold = eq === 'cable' ? 'cable' : eq === 'band' ? 'bandfoot' : eq === 'machine' ? 'handle' : 'hand'; s.cable = [-20, -4]; return s; } };
  P.reardelt = { he: 'כתף אחורית', fn: function (eq) {
    var A = stand({ hip: [-52, -108], torso: 70, h1: ['s', -4, 86] }), B = stand({ hip: [-52, -108], torso: 70, h1: ['s', -42, 26], eb: 'U' });
    var s = seq([A, B], 2600); s.hold = eq === 'cable' ? 'cable' : eq === 'band' ? 'band' : eq === 'machine' ? 'handle' : 'hand'; s.cable = [80, -10]; return s; } };
  P.pullapart = { he: 'פתיחת גומייה', fn: function (eq) {
    var A = stand({ h1: ['s', 84, 2] }), B = stand({ h1: ['s', -6, 8] });
    var s = seq([A, B], 2600); s.hold = eq === 'band' ? 'band' : 'hand'; return s; } };
  P.facepull = { he: 'פייס פול', fn: function (eq) {
    var A = stand({ f2: [-40, 0], h1: ['s', 84, -4] }), B = stand({ f2: [-40, 0], h1: ['s', 22, -26], eb: 'U' });
    var s = seq([A, B], 2600); s.hold = eq === 'band' ? 'band' : 'cable'; s.cable = [190, -205]; return s; } };
  P.shrug = { he: 'שראגס', fn: function (eq) {
    var A = stand({ h1: HANG }), B = stand({ shy: 12, h1: ['s', 4, 86] });
    var s = seq([A, B], 2000); s.hold = eq === 'bar' || eq === 'smith' ? 'plate' : eq === 'cable' ? 'cable' : 'hand'; s.cable = [10, -2]; return s; } };
  P.uprow = { he: 'אפרייט רואו', fn: function (eq) {
    var A = stand({ h1: ['s', 8, 84] }), B = stand({ h1: ['s', 12, 10], eb: 'U' });
    var s = seq([A, B], 2600); s.hold = eq === 'cable' ? 'cable' : eq === 'bar' ? 'plate' : 'hand'; s.cable = [14, -2]; return s; } };
  P.row = { he: 'חתירה', fn: function (eq) {
    var A = stand({ hip: [-52, -108], torso: 68, h1: ['s', -6, 86] }), B = stand({ hip: [-52, -108], torso: 68, h1: ['s', -42, 44], eb: 'U' });
    var s = seq([A, B], 2600); s.hold = eq === 'bar' || eq === 'smith' ? 'plate' : eq === 'band' ? 'bandfoot' : 'hand'; return s; } };
  P.seatedrow = { he: 'חתירה בישיבה', fn: function (eq) {
    var A = { hip: [0, -30], torso: 8, f1: [110, -26], h1: ['s', 86, 12], kb: 'U', eb: 'L' }, B = { hip: [0, -30], torso: -6, f1: [110, -26], h1: ['s', 18, 42], kb: 'U', eb: 'L' };
    var s = seq([A, B], 2600); s.hold = eq === 'band' ? 'band' : eq === 'machine' ? 'handle' : 'cable'; s.cable = [190, -40];
    s.props = eq === 'machine' ? [{ k: 'seat', low: true }] : [{ k: 'plate', r: [116, -60, 8, 60] }]; return s; } };
  P.invrow = { he: 'חתירה הפוכה', fn: function (eq) {
    var A = { hip: [-78, -16], torso: 84, f1: [-198, 0], h1: [0, -110], kb: 'U', eb: 'L', fa1: 160 };
    var B = { hip: [-73, -52], torso: 68, f1: [-198, 0], h1: [0, -110], kb: 'U', eb: 'L', fa1: 160 };
    var s = seq([A, B], 2600); s.hold = eq === 'trx' ? 'trxhands' : null; s.props = eq === 'trx' ? [] : [{ k: 'hbar', y: -110 }]; return s; } };
  P.pulldown = { he: 'משיכה לחזה', fn: function (eq) {
    var A = { hip: [0, -62], torso: -10, f1: [56, 0], h1: ['s', 10, -86], eb: 'R' }, B = { hip: [0, -62], torso: -14, f1: [56, 0], h1: ['s', 12, -2], eb: 'D' };
    var s = seq([A, B], 2600); s.props = [{ k: 'seat' }]; s.hold = eq === 'band' ? 'band' : eq === 'machine' ? 'handle' : 'cable';
    s.cable = [20, -330]; return s; } };
  P.pullup = { he: 'מתח', fn: function (eq) {
    var A = { hip: [0, -132], torso: 0, f1: [-22, -18], h1: [6, -300], kb: 'L', eb: 'D' };
    var B = { hip: [0, -196], torso: 0, f1: [-22, -82], h1: [6, -300], kb: 'L', eb: 'D' };
    var s = seq([A, B], 2600); s.props = [{ k: 'hbar', y: -300 }]; s.ground = false; if (eq === 'band') s.hold = 'bandpull';
    if (eq === 'machine') { s.ground = true; s.props.push({ k: 'pad' }); } return s; } };
  P.hangraise = { he: 'הרמות רגליים בתלייה', fn: function () {
    var A = { hip: [0, -132], torso: 0, f1: [6, -8], h1: [6, -300], kb: 'R', eb: 'D' };
    var B = { hip: [0, -132], torso: 0, f1: [120, -150], h1: [6, -300], kb: 'U', eb: 'D' };
    var s = seq([A, B], 2600); s.props = [{ k: 'hbar', y: -300 }]; s.ground = false; return s; } };
  P.lsitpull = { he: 'מתח L-sit', fn: function () {
    var A = { hip: [0, -132], torso: -4, f1: [122, -126], h1: [6, -300], kb: 'U', eb: 'D' };
    var B = { hip: [0, -196], torso: -4, f1: [122, -190], h1: [6, -300], kb: 'U', eb: 'D' };
    var s = seq([A, B], 2600); s.props = [{ k: 'hbar', y: -300 }]; s.ground = false; return s; } };
  P.dipraise = { he: 'הרמות רגליים במקבילים', fn: function () {
    var A = { hip: [0, -140], torso: 2, f1: [-6, -16], fa1: 170, h1: [4, -130], kb: 'R', eb: 'L' };
    var B = { hip: [0, -140], torso: -6, f1: [122, -136], fa1: 170, h1: [4, -130], kb: 'U', eb: 'L' };
    var s = seq([A, B], 2600); s.props = [{ k: 'dipbar', y: -130 }]; return s; } };
  P.kpulldown = { he: 'פולי עליון ביד אחת בכריעה', fn: function () {
    var A = { hip: [-8, -64], torso: -4, f1: [44, 0], f2: [-64, 0], fa2: 125, kb: 'R', kb2: 'D', h1: ['s', 14, -86], eb: 'R', h2: ['s', 2, 60] };
    var B = { hip: [-8, -64], torso: -6, f1: [44, 0], f2: [-64, 0], fa2: 125, kb: 'R', kb2: 'D', h1: ['s', 10, -4], eb: 'D', h2: ['s', 2, 60] };
    var s = seq([A, B], 2600); s.hold = 'cable'; s.cable = [20, -330]; return s; } };
  P.ropeclimb = { he: 'טיפוס חבל', fn: function () {
    var A = { hip: [0, -150], torso: 4, f1: [18, -100], f2: [12, -104], kb: 'R', kb2: 'R', h1: [22, -318], h2: [22, -262], eb: 'D' };
    var B = { hip: [0, -176], torso: 2, f1: [16, -58], f2: [12, -60], kb: 'R', kb2: 'R', h1: [22, -262], h2: [22, -318], eb: 'D' };
    var s = seq([A, B], 2400); s.props = [{ k: 'rope', x: 22 }]; s.ground = false; return s; } };
  P.pistol = { he: 'פיסטול סקוואט', fn: function () {
    var A = stand({ f2: [40, -34], kb2: 'R', h1: ['s', 70, 24] });
    var B = { hip: [-34, -56], torso: 30, f1: [0, 0], f2: [104, -46], kb: 'R', kb2: 'U', h1: ['s', 86, 8] };
    return seq([A, B], 3000); } };
  P.hip9090 = { he: 'סיבובי ירך 90/90', fn: function () {
    var A = { hip: [0, -18], torso: 0, f1: [56, -4], f2: [-56, -4], kb: 'U', kb2: 'U', fa1: 0, fa2: 180, h1: ['s', 30, 44] };
    var B = { hip: [0, -18], torso: 4, f1: [96, -4], f2: [-82, -4], kb: 'U', kb2: 'U', fa1: 0, fa2: 180, h1: ['s', 30, 44] };
    return seq([A, B], 3600); } };
  P.inchworm = { he: 'תולעת מדידה', fn: function () {
    var K0 = stand(), K1 = { hip: [-8, -122], torso: 150, f1: [0, 0], h1: [34, 0], kb: 'R', eb: 'D' };
    var K2 = { hip: [40, -100], torso: 110, f1: [0, 0], h1: [140, 0], kb: 'U', eb: 'L', fa1: 120 };
    var K3 = { hip: [124, -52], torso: 68, f1: [0, 0], h1: [196, 0], kb: 'U', eb: 'L', fa1: 160 };
    return seq([K0, K1, K2, K3, K2, K1], 6400); } };
  P.legswing = { he: 'הנפות רגל', fn: function () {
    var A = stand({ f2: [-60, -20], kb2: 'R', h1: ['s', 30, 50] }), B = stand({ f2: [105, -62], kb2: 'U', h1: ['s', 30, 50] });
    return seq([A, B], 1800); } };
  P.curl = { he: 'כפיפת מרפקים', fn: function (eq) {
    var A = stand({ h1: ['s', 6, 86] }), B = stand({ h1: ['s', 26, 18], eb: 'D' });
    var s = seq([A, B], 2400); s.hold = eq === 'bar' || eq === 'smith' ? 'plate' : eq === 'cable' ? 'cable' : eq === 'band' ? 'bandfoot' : eq === 'machine' || eq === 'bench' ? 'handle' : eq === 'trx' ? 'trxhands' : 'hand';
    s.cable = [30, -4]; return s; } };
  P.pushdown = { he: 'פשיטת מרפק', fn: function (eq) {
    var A = stand({ torso: 8, h1: ['s', 28, 20], eb: 'D' }), B = stand({ torso: 8, h1: ['s', 10, 86] });
    var s = seq([A, B], 2400); s.hold = eq === 'band' ? 'band' : eq === 'machine' ? 'handle' : 'cable'; s.cable = [36, -330]; return s; } };
  P.ohext = { he: 'פשיטת מרפק מעל הראש', fn: function (eq) {
    var A = stand({ h1: ['s', -26, -14], eb: 'U' }), B = stand({ h1: ['s', 6, -86], eb: 'U' });
    var s = seq([A, B], 2600); s.hold = eq === 'cable' ? 'cable' : eq === 'band' ? 'bandfoot' : eq === 'bar' ? 'plate' : 'hand'; s.cable = [-60, 0]; return s; } };
  P.skull = { he: 'צרפתי', fn: function (eq) {
    var A = { hip: [40, -58], torso: -90, f1: [104, 0], h1: ['s', 4, -86], kb: 'U', eb: 'U' };
    var B = { hip: [40, -58], torso: -90, f1: [104, 0], h1: ['s', -32, -40], kb: 'U', eb: 'U' };
    var s = seq([A, B], 2600); s.props = [{ k: 'pbench', v: 'flat' }]; s.hold = eq === 'bar' ? 'plate' : eq === 'cable' ? 'cable' : 'hand'; s.cable = [-110, -40]; return s; } };
  P.kickback = { he: 'קיקבק', fn: function (eq) {
    var A = stand({ hip: [-52, -108], torso: 72, h1: ['s', -18, 40], eb: 'D' }), B = stand({ hip: [-52, -108], torso: 72, h1: ['s', -84, 22] });
    var s = seq([A, B], 2400); s.hold = eq === 'cable' ? 'cable' : 'hand'; s.cable = [60, -10]; return s; } };
  P.crunch = { he: 'כפיפות בטן', fn: function (eq, v) {
    var top = v === 'situp' ? -12 : -58;
    var A = { hip: [0, -8], torso: -92, f1: [62, 0], h1: ['s', -10, -16], kb: 'U', eb: 'U' };
    var B = { hip: [0, -8], torso: top, f1: [62, 0], h1: ['s', -10, -16], kb: 'U', eb: 'U' };
    if (eq === 'cable') { A = stand({ hip: [-20, -60], torso: 30, f1: [10, 0], h1: ['s', 4, -20], eb: 'U' }); A.kb = 'D';
      B = stand({ hip: [-20, -60], torso: 80, f1: [10, 0], h1: ['s', 4, -20], eb: 'U' }); B.kb = 'D'; }
    var s = seq([A, B], 2200); if (eq === 'cable') { s.hold = 'cable'; s.cable = [40, -300]; s.kneel = true; }
    if (eq === 'ball') s.props = [{ k: 'ball', c: [0, -30], r: 30 }]; return s; } };
  P.legraise = { he: 'הרמות רגליים', fn: function () {
    var A = { hip: [0, -8], torso: -92, f1: [124, -8], h1: ['h', -24, 6], kb: 'U', eb: 'D' };
    var B = { hip: [0, -8], torso: -92, f1: [14, -126], h1: ['h', -24, 6], kb: 'U', eb: 'D' };
    return seq([A, B], 2600); } };
  P.twist = { he: 'סיבוב גו', fn: function (eq) {
    var A = { hip: [0, -10], torso: -38, f1: [74, -30], h1: ['s', 56, 34], kb: 'U', eb: 'D' };
    var B = { hip: [0, -10], torso: -38, f1: [74, -30], h1: ['s', 14, 44], kb: 'U', eb: 'D' };
    var s = seq([A, B], 1600); s.hold = eq === 'db' || eq === 'kb' ? 'hand' : eq === 'ball' || eq === 'other' ? 'ball' : null;
    if (eq === 'cable' || eq === 'band') { var p = P.woodchop.fn(eq); return p; } return s; } };
  P.woodchop = { he: 'וודצ׳ופר', fn: function (eq) {
    var A = stand({ f2: [-40, 0], h1: ['s', -40, -50], eb: 'U' }), B = stand({ f2: [-40, 0], hip: [-10, -112], torso: 12, h1: ['s', 70, 60] });
    var s = seq([A, B], 2200); s.hold = eq === 'band' ? 'band' : eq === 'cable' ? 'cable' : eq === 'bw' ? null : 'hand'; s.cable = [-90, -270]; return s; } };
  P.pallof = { he: 'פאלוף פרס', fn: function (eq) {
    var A = stand({ f2: [-40, 0], h1: ['s', 14, 34], eb: 'D' }), B = stand({ f2: [-40, 0], h1: ['s', 86, 30] });
    var s = seq([A, B], 2600); s.hold = eq === 'band' ? 'band' : 'cable'; s.cable = [-140, -110]; return s; } };
  P.deadbug = { he: 'דד באג', fn: function () {
    var A = { hip: [0, -8], torso: -92, f1: [60, -66], f2: [124, -12], h1: ['s', 0, -86], h2: ['s', -86, -6], kb: 'U', kb2: 'U', eb: 'U', eb2: 'U' };
    var B = { hip: [0, -8], torso: -92, f1: [124, -12], f2: [60, -66], h1: ['s', -86, -6], h2: ['s', 0, -86], kb: 'U', kb2: 'U', eb: 'U', eb2: 'U' };
    return seq([A, B], 2400); } };
  P.birddog = { he: 'בירד דוג', fn: function () {
    var A = { hip: [-76, -62], torso: 71, f1: [-130, 0], f2: [-130, 0], h1: [0, 0], h2: [0, 0], kb: 'D', kb2: 'D', eb: 'L', fa1: 180, fa2: 180 };
    var B = { hip: [-76, -64], torso: 71, f1: [-200, -66], f2: [-130, 0], h1: ['s', 86, -10], h2: [0, 0], kb: 'D', kb2: 'D', eb: 'L', fa1: 180, fa2: 180 };
    return seq([A, B], 2600); } };
  P.kickbackleg = { he: 'בעיטה לאחור', fn: function (eq) {
    if (eq === 'cable' || eq === 'band' || eq === 'machine') {
      var A1 = stand({ torso: 18, f2: [-10, -6], h1: ['s', 40, 30] }), B1 = stand({ torso: 22, f2: [-90, -70], fa2: 170, h1: ['s', 40, 30] });
      A1.kb2 = 'R'; B1.kb2 = 'D'; var s1 = seq([A1, B1], 2400); s1.hold = 'anklecable'; s1.cable = [50, -10]; return s1; }
    var A = { hip: [-76, -62], torso: 71, f1: [-130, 0], f2: [-130, 0], h1: [0, 0], kb: 'D', kb2: 'D', eb: 'L', fa1: 180, fa2: 180 };
    var B = { hip: [-76, -64], torso: 71, f1: [-150, -120], f2: [-130, 0], h1: [0, 0], kb: 'D', kb2: 'D', eb: 'L', fa1: 180, fa2: 180 };
    return seq([A, B], 2200); } };
  P.sidelying = { he: 'הרמת רגל בשכיבה', fn: function (eq) {
    var A = { hip: [0, -12], torso: -94, f1: [124, -10], f2: [124, -10], h1: ['s', -14, -30], kb: 'U', eb: 'U' };
    var B = { hip: [0, -12], torso: -94, f1: [108, -70], f2: [124, -10], h1: ['s', -14, -30], kb: 'U', eb: 'U' };
    if (eq === 'machine') return P.legext.fn('machine');
    return seq([A, B], 2400); } };
  P.superman = { he: 'סופרמן', fn: function () {
    var A = { hip: [0, -10], torso: -90, f1: [124, -6], h1: ['s', -86, 4], kb: 'D', eb: 'U' };
    var B = { hip: [0, -10], torso: -102, head: -10, f1: [122, -34], h1: ['s', -84, -24], kb: 'D', eb: 'U' };
    return seq([A, B], 2400); } };
  /* ריצה בארבעה שלבים: נחיתה מתחת לאגן, דחיפה לאחור כשהברך השנייה
     עולה קדימה, ואותו דבר לצד השני. רגל באוויר מתקפלת (עקב לישבן). */
  P.run = { he: 'ריצה', fn: function () {
    function ph(near, far, up) {
      return { hip: [0, up ? -130 : -123], torso: 12, f1: near.f, f2: far.f, fa1: near.fa, fa2: far.fa, kb: near.kb, kb2: far.kb,
               h1: near.f[0] > 0 ? ['s', -34, 64] : ['s', 38, 48], h2: near.f[0] > 0 ? ['s', 38, 48] : ['s', -34, 64] };
    }
    var land = { f: [22, -2], fa: 95, kb: 'R' }, push = { f: [-44, -6], fa: 150, kb: 'R' },
        swingBack = { f: [-58, -52], fa: 170, kb: 'D' }, driveFwd = { f: [26, -54], fa: 120, kb: 'R' };
    var s = seq([ph(land, swingBack), ph(push, driveFwd, true), ph(swingBack, land), ph(driveFwd, push, true)], 900);
    s.cyc = true; s.props = [{ k: 'tread' }]; return s; } };
  /* הליכה: עקב נוחת, כף רגל שטוחה, דחיפה מהבהונות, והרגל השנייה עוברת
     קדימה בברך כפופה. תמיד רגל אחת על הקרקע. */
  P.walk = { he: 'הליכה', fn: function (eq) {
    var hh = eq === 'db' || eq === 'kb' || eq === 'other' ? ['s', 2, 86] : null;
    function ph(f1, f2, fa1, fa2, y, arm) {
      return { hip: [0, y], torso: 3, f1: f1, f2: f2, fa1: fa1, fa2: fa2, kb: 'R', kb2: 'R',
               h1: hh || ['s', arm, 84], h2: hh ? ['s', -4, 86] : ['s', -arm, 84] };
    }
    var s = seq([ph([30, 0], [-30, -2], 80, 140, -121, -14), ph([2, 0], [8, -20], 90, 110, -126, 0),
                 ph([-30, -2], [30, 0], 140, 80, -121, 14), ph([8, -20], [2, 0], 110, 90, -126, 0)], 1500);
    s.cyc = true; s.hold = eq === 'db' || eq === 'kb' ? 'hand' : eq === 'other' ? 'bag' : null;
    if (eq === 'water') s.water = -100; return s; } };
  P.bike = { he: 'אופניים', fn: function () {
    var c = [52, -50], r = 22, kf = [];
    for (var i = 0; i < 4; i++) { var a = i * 90;
      kf.push({ hip: [0, -112], torso: 42, f1: [c[0] + r * Math.sin(a * Math.PI / 180), c[1] - r * Math.cos(a * Math.PI / 180)],
                f2: [c[0] - r * Math.sin(a * Math.PI / 180), c[1] + r * Math.cos(a * Math.PI / 180)], h1: ['s', 52, 40], kb: 'R', kb2: 'R', fa1: 110, fa2: 110 }); }
    var s = seq(kf, 1400); s.props = [{ k: 'bike', c: c }]; return s; } };
  P.rower = { he: 'מכונת חתירה', fn: function () {
    var A = { hip: [40, -32], torso: 26, f1: [110, -26], h1: ['s', 66, 30], kb: 'U', eb: 'D' };
    var B = { hip: [-30, -32], torso: -24, f1: [110, -26], h1: ['s', 22, 48], kb: 'U', eb: 'L' };
    var s = seq([A, B], 2200); s.props = [{ k: 'rail' }]; return s; } };
  P.jumprope = { he: 'חבל קפיצה', fn: function () {
    var A = stand({ h1: ['s', 16, 70] }), B = stand({ hip: [0, -140], f1: [0, -15], fa1: 140, h1: ['s', 16, 70] });
    var s = seq([A, B], 700); s.hold = 'rope'; return s; } };
  P.box = { he: 'אגרוף', fn: function (eq) {
    var g = ['s', 28, -2], st = { hip: [0, -120], torso: 4, f1: [34, 0], f2: [-34, 0], eb: 'D', eb2: 'D' };
    var A = Object.assign({}, st, { h1: g, h2: ['s', 22, 6] });
    var B = Object.assign({}, st, { h1: ['s', 88, -4], h2: ['s', 22, 6], eb: 'R' });
    var C = Object.assign({}, st, { h1: g, h2: ['s', 88, -2], torso: 10, eb2: 'R' });
    var s = seq([A, B, A, C], 1600); if (eq === 'bag') s.props = [{ k: 'bag' }]; if (eq === 'mitts') s.props = [{ k: 'mitt' }];
    s.hold = eq === 'db' ? 'hand' : eq === 'band' ? 'bandback' : null; return s; } };
  P.kick = { he: 'בעיטה', fn: function (eq) {
    var st = { hip: [0, -120], torso: 4, f1: [24, 0], f2: [-34, 0], h1: ['s', 28, -2], h2: ['s', 22, 6] };
    var B = Object.assign({}, st, { torso: -14, f1: [112, -118], fa1: 100, kb: 'U' });
    var s = seq([st, B], 1500); if (eq === 'bag') s.props = [{ k: 'bag' }]; return s; } };
  P.swim = { he: 'שחייה', fn: function () {
    var A = { hip: [0, -150], torso: -90, f1: [124, -144], f2: [124, -156], h1: ['s', -86, 0], h2: ['s', 0, 80], kb: 'U', eb: 'D' };
    var B = { hip: [0, -150], torso: -90, f1: [124, -156], f2: [124, -144], h1: ['s', 0, 80], h2: ['s', -86, 0], kb: 'U', eb: 'D' };
    var s = seq([A, B], 1600); s.water = -158; s.ground = false; return s; } };
  P.popup = { he: 'פופ-אפ', fn: function () {
    var A = { hip: [0, -10], torso: -90, f1: [124, -6], h1: ['s', 6, 14], kb: 'D', eb: 'U' };
    var B = { hip: [6, -38], torso: -70, f1: [124, -6], h1: [-74, 0], kb: 'D', eb: 'R' };
    var C = { hip: [20, -104], torso: -14, f1: [-30, 0], f2: [80, 0], h1: ['s', -60, 30], h2: ['s', 60, 30], kb: 'L', kb2: 'R' };
    var s = seq([A, B, C, C], 2400); s.props = [{ k: 'board' }]; return s; } };
  P.stretchham = { he: 'מתיחה אחורית', fn: function () {
    var A = stand({ hip: [-40, -120], torso: 68, f2: [40, -2], fa2: 40, h1: ['s', 20, 84] }), B = stand({ hip: [-52, -116], torso: 80, f2: [40, -2], fa2: 40, h1: ['s', 30, 86] });
    A.kb2 = 'U'; B.kb2 = 'U'; return seq([A, B], 3600); } };
  P.stretchquad = { he: 'מתיחה קדמית', fn: function () {
    var A = stand({ f2: [-34, -96], kb2: 'D', fa2: 0, h1: ['s', -10, 80], h2: [-34, -96] }), B = stand({ f2: [-38, -100], kb2: 'D', fa2: 0, h1: ['s', -10, 80], h2: [-38, -100] });
    return seq([A, B], 3600); } };
  P.stretchhip = { he: 'מתיחת ירך', fn: function () {
    var A = { hip: [-10, -60], torso: 0, f1: [50, 0], f2: [-80, -2], fa2: 180, h1: ['s', 40, 60], kb: 'R', kb2: 'D' };
    var B = { hip: [6, -52], torso: -4, f1: [50, 0], f2: [-80, -2], fa2: 180, h1: ['s', 40, 60], kb: 'R', kb2: 'D' };
    return seq([A, B], 3600); } };
  P.stretchup = { he: 'מתיחת פלג עליון', fn: function () {
    var A = stand({ h1: ['s', 4, -86], h2: ['s', -10, -84] }), B = stand({ torso: -6, h1: ['s', -20, -84], h2: ['s', -30, -80] });
    return seq([A, B], 3600); } };
  P.childpose = { he: 'תנוחת הילד', fn: function () {
    var A = { hip: [-70, -48], torso: 112, f1: [-124, -2], h1: [40, -2], kb: 'D', eb: 'U', fa1: 180 };
    var B = { hip: [-74, -60], torso: 76, f1: [-124, -2], h1: [40, -2], kb: 'D', eb: 'U', fa1: 180 };
    return seq([A, B], 3600); } };
  P.circles = { he: 'סיבובי מפרקים', fn: function () {
    var kf = [];
    for (var i = 0; i < 4; i++) { var a = i * 90 + 180, r = 86;
      kf.push(stand({ h1: ['s', r * Math.sin(a * Math.PI / 180), -r * Math.cos(a * Math.PI / 180)], h2: ['s', -6, 86] })); }
    return seq(kf, 3200); } };
  P.hipcar = { he: 'סיבוב ירך', fn: function () {
    var pts = [[30, -60], [60, -96], [20, -110], [-30, -70]], kf = [];
    pts.forEach(function (p) { kf.push(stand({ f2: p, kb2: 'R', h1: ['s', 40, 40] })); });
    return seq(kf, 3600); } };
  P.catcow = { he: 'חתול-פרה', fn: function () {
    var A = { hip: [-76, -62], torso: 66, head: 30, f1: [-130, 0], h1: [0, 0], kb: 'D', eb: 'L', fa1: 180 };
    var B = { hip: [-76, -66], torso: 78, head: -26, f1: [-130, 0], h1: [0, 0], kb: 'D', eb: 'L', fa1: 180 };
    return seq([A, B], 3200); } };
  P.roll = { he: 'גלגול גליל', fn: function () {
    var A = { hip: [0, -40], torso: -92, f1: [110, 0], h1: ['s', 20, 40], kb: 'U', eb: 'D' };
    var B = { hip: [30, -40], torso: -92, f1: [110, 0], h1: ['s', 20, 40], kb: 'U', eb: 'D' };
    var s = seq([A, B], 2600); s.props = [{ k: 'roller' }]; return s; } };
  P.sled = { he: 'דחיפת מזחלת', fn: function () {
    var A = { hip: [0, -104], torso: 52, f1: [36, -4], f2: [-60, -30], fa2: 160, h1: ['s', 62, 22], kb: 'R', kb2: 'D', eb: 'D' };
    var B = { hip: [0, -108], torso: 52, f1: [-60, -30], f2: [36, -4], fa1: 160, h1: ['s', 62, 22], kb: 'D', kb2: 'R', eb: 'D' };
    var s = seq([A, B], 1200); s.props = [{ k: 'sledbox' }]; return s; } };
  P.ropes = { he: 'באטל רופס', fn: function () {
    var A = stand({ hip: [-20, -94], torso: 22, f2: [-30, 0], h1: ['s', 60, 4] }), B = stand({ hip: [-20, -94], torso: 22, f2: [-30, 0], h1: ['s', 60, 52] });
    var s = seq([A, B], 700); s.hold = 'ropes'; return s; } };
  P.throw = { he: 'זריקת כדור', fn: function () {
    var A = stand({ hip: [-38, -70], torso: 40, h1: ['s', 30, 40] }), B = stand({ h1: ['s', 10, -86] });
    var s = seq([A, B], 1800); s.hold = 'ball'; return s; } };
  P.slam = { he: 'הטחת כדור', fn: function () {
    var A = stand({ h1: ['s', 6, -86], eb: 'U' }), B = stand({ hip: [-38, -78], torso: 56, h1: ['s', 40, 80] });
    var s = seq([A, B], 1400); s.hold = 'ball'; return s; } };
  P.thruster = { he: 'ת׳רסטר', fn: function (eq) {
    var A = stand({ hip: [-40, -66], torso: 36, h1: ['s', 16, -2], eb: 'R' }), B = stand({ h1: ['s', 4, -86] });
    var s = seq([A, B], 2200); s.hold = eq === 'bar' ? 'plate' : eq === 'ball' || eq === 'other' ? 'ball' : 'hand'; return s; } };
  P.clean = { he: 'קלין', fn: function (eq) {
    var A = stand({ hip: [-42, -82], torso: 60, h1: ['s', 6, 86] }), B = stand({ hip: [-10, -112], torso: 8, h1: ['s', 16, -2], eb: 'R' });
    var s = seq([A, B, B], 2400); s.hold = eq === 'bar' ? 'plate' : eq === 'other' ? 'bag' : 'hand'; return s; } };
  P.snatch = { he: 'הנפה מעל הראש', fn: function (eq) {
    var A = stand({ hip: [-42, -82], torso: 60, h1: ['s', 6, 86] }), B = stand({ h1: ['s', 0, -86] });
    var s = seq([A, B, B], 2400); s.hold = eq === 'bar' ? 'plate' : 'hand'; return s; } };
  P.carryover = { he: 'נשיאה מעל הראש', fn: function () {
    var s = P.walk.fn('kb'); s.kf.forEach(function (k) { k.p.h1 = ['s', 2, -86]; }); s.hold = 'hand'; return s; } };
  P.getup = { he: 'קימה מהרצפה', fn: function () {
    var A = { hip: [0, -8], torso: -92, f1: [62, 0], h1: ['s', 0, -86], kb: 'U', eb: 'U' };
    var B = { hip: [0, -30], torso: -40, f1: [62, 0], h1: ['s', 0, -86], h2: [-60, 0], kb: 'U', eb: 'U' };
    var C = stand({ f2: [-50, 0], h1: ['s', 0, -86] });
    var s = seq([A, B, C, B], 4400); s.hold = 'hand'; return s; } };
  P.burpee = { he: 'ברפי', fn: function () {
    var s = seq([stand({ h1: HANG }), stand({ hip: [-40, -60], torso: 60, h1: [40, 0] }),
                 { hip: [-72, -55], torso: 67, f1: [-196, 0], h1: [40, 0], fa1: 160, kb: 'U', eb: 'L' },
                 stand({ hip: [-40, -60], torso: 60, h1: [40, 0] }), stand({ hip: [0, -150], f1: [0, -26], fa1: 140, h1: ['s', 10, -84] })], 3000);
    return s; } };
  P.hold = { he: 'נשימה', fn: function () {
    return seq([stand({ h1: HANG }), stand({ hip: [0, -127], h1: ['s', 6, 84] })], 3600); } };

  /* ---------- סיווג תרגיל לתבנית ---------- */
  /* גבול מילה בעברית: \b של JS לא מכיר אותיות עבריות. בלי זה "שק" (שק
     אגרוף) נתפס בתוך "משקולות" ו"משקל", ו"מתח" בתוך "מתחת" — 94 תרגילי
     משקולות סווגו כאגרוף בגרסה הראשונה. W() עוטף מילים שחייבות לעמוד
     לבד, עם אותיות השימוש ו/ב/ל/מ/ה/ש בתחילתן. */
  function W(s) { return '(?:^|[^א-ת])[ובלמהש]?(?:' + s + ')(?=$|[^א-ת])'; }
  function R(s, f) { return new RegExp(s, f); }
  var RULES = [
    [/דיפס שכמות|שכמות במקבילים/, 'scapdip'],
    [/טיפוס חבל/, 'ropeclimb'],
    [/פולי עליון.*(בכריעה|יד אחת)|משיכת פולי עליון ביד אחת/, 'kpulldown'],
    [/פיסטול/, 'pistol'],
    [/90\/90/, 'hip9090'],
    [/תולעת/, 'inchworm'],
    [/נדנוד רגל קדימה|הנפות רגל קדימה/, 'legswing'],
    [/שחיי|שחית|חתירות.*במים|ספרינטי חתירה|בעיטות בקצה הבריכה/, 'swim'],
    [/פופ-אפ|פופ אפ/, 'popup'],
    [/ברפי|דוויל פרס|מן-מייקר/, 'burpee'],
    [/קימה מהרצפה|טורקיש|גט-אפ/, 'getup'],
    [/ת׳רסטר|וול בול|סקוואט עם לחיצה/, 'thruster'],
    [/הטחת|סלאם|מכות פטיש/, 'slam'],
    [/זריקת|זריקה|מסירת כדור/, 'throw'],
    [/באטל רופס/, 'ropes'],
    [/מזחלת/, 'sled'],
    [/סנאץ׳|ג׳רק|פוש פרס|קלין אנד פרס/, 'snatch'],
    [/קלין|הפיכת צמיג|ג׳אמפ שראג|היי פול/, 'clean'],
    [/סווינג/, 'swing'],
    [/נשיאת .*מעל הראש|הליכת מלצר/, 'carryover'],
    [/לאנג׳ הליכה|הליכת לאנג׳/, 'lunge'],
    [/הליכת (מפלצת|גומייה|סומו)/, 'walk'],
    [/הליכת חקלאי|נשיאת|הליכת מזוודה|הליכה על בהונות עם/, 'walk'],
    [/חבל קפיצה|קפיצות על הבהונות בחבל/, 'jumprope'],
    [/אופני כושר|אופני ספין|אסולט|על אופניים/, 'bike'],
    [/מכונת חתירה|סקי-ארג/, 'rower'],
    [/ריצ|ספרינט|הליכון|היי ניז|שאטל|פארטלק|A-skip|טבטה/, 'run'],
    [/הליכה|אליפטיקל|מכונת מדרגות|עליית מדרגות/, 'walk'],
    [/בעיטה (עגולה|קדמית)|מואי תאי/, 'kick'],
    [R(W('שק|פאדים|ג׳אב|קרוס|אפרקוט|ספארינג|התחמקויות|ספרול') + '|עבודת צל|עבודת רגליים בסולם|בטן לאגרוף|מכות התנגדות|סלואו'), 'box'],
    [/קפיצה לקופסה|בוקס ג׳אמפ|דפת עומק|קפיצה עם מוט/, 'boxjump'],
    [/קפיצ|פוגו|סקייטר|בונדינג|טאק|ג׳אמפינג/, 'jumpsquat'],
    [/גלגול גליל|גלגול כדור ל/, 'roll'],
    [/חתול-פרה|חתול פרה/, 'catcow'],
    [/תנוחת הילד|כלב מביט|קוברה/, 'childpose'],
    [/קלאמשל|הרמת רגל צידית|מרחיקים|מקרבים במכונה|הרחקת רגל|בעיטה צידית|הליכה צידית/, 'sidelying'],
    [/סיבוב ירך|סיבובי ירך|90-90|מבוקר|קופסה נשימתית|ירך מעל משוכות|פתיחת ירכיים|נדנוד רגל/, 'hipcar'],
    [/סיבובי מפרקים|סיבוב כתפיים עם מקל|סיבובי קרסול|שורש כף יד|פרונציה|העברת גומייה מעל|הילו|נדנוד קרסול|עצב הסיאטיקה|ברצל|מגבי שמשה/, 'circles'],
    [/מתיחת ארבע ראשי/, 'stretchquad'],
    [/כופפי ירך|לאנג׳ נמוך|יונה|ספה|ספליט קדמי|ספליט צידי|חצי ספליט|פתיחת ירך בכריעה|המתיחה הגדולה|לאנג׳ ספיידרמן|לוחם/, 'stretchhip'],
    [/מתיחת (המסטרינג|שוק|סוליאוס|תאומים|פרפר|מקרבים|צפרדע|פיריפורמיס|עכוז|רצועת|שוקיים|אגן|שרשרת)/, 'stretchham'],
    [/מתיחת (חזה|כתף|יד|אמות|צוואר|רחב|מותניים|צד|טרפז)|תלייה על מתח|השחלת מחט|פתיחת ספר|סיבוב חזה|פשיטת חזה|מתיחת שינה/, 'stretchup'],
    [/ג׳פרסון/, 'hinge'],
    [/פיתול עמוד שדרה|ברכיים לחזה בשכיבה|גשר כתפיים בגלגול|רול-אפ|גלגול ככדור|מאה \(|טיזר|המסור|מתיחת (רגל|שתי)/, 'crunch'],
    [/סופרמן|שחיינים|שחייה על הבטן|היפר-אקסטנשן|בק אקסטנשן|אקסטנשן גב|רוורס היפר/, 'superman'],
    [/בירד דוג|ברך-מרפק/, 'birddog'],
    [/דד באג/, 'deadbug'],
    [/מטפס הרים/, 'climber'],
    [/מתח L-sit/, 'lsitpull'],
    [/הרמות רגליים במקבילים|הרמת רגליים במקבילים|^L-sit$/, 'dipraise'],
    [/גלגלת בטן|פלאנק|L-sit|V-sit|הולו|דגל|לוור|פלאנש|עמידת ידיים|זחילת דוב|הליכת דוב|תולעת|סקין דה קאט/, 'plank'],
    [/פאלוף|אנטי-רוטציה|דחיפת מים/, 'pallof'],
    [/וודצ׳ופר|סיבוב לנדמיין|הדף גומייה סיבובי|סיבוב מתפרץ/, 'woodchop'],
    [/הרמות רגליים בתלייה|ברכיים לחזה בתלייה|בהונות למוט|מגבים בתלייה/, 'hangraise'],
    [/רוסיאן|סיבוב גו|אלכסוניות|כפיפות אופניים/, 'twist'],
    [/הרמות רגליים|בעיטות (רפרוף|מספריים)|הרמת אגן הפוכה|כפיפות בטן הפוכות|פמוט|ברכיים לחזה/, 'legraise'],
    [/סיט-אפ|גלגול כדור מברכיים/, 'crunch:situp'],
    [/כפיפות בטן|קראנץ׳|העברת כדור בין/, 'crunch'],
    [/פייס פול|משיכה לפנים|משיכת פנים/, 'facepull'],
    [/פול-אפארט|פתיחת גומייה לצדדים/, 'pullapart'],
    [/פרפר הפוך|כתף אחורית|הרחקות בהטיה|הנפת Y|סקאפשן/, 'reardelt'],
    [R('מאסל-אפ|צ׳ין-אפ|' + W('מתח')), 'pullup'],
    [/משיכת פולי|פולי עליון|משיכה אנכית/, 'pulldown'],
    [/חתירה הפוכה|חתירה ברצועות/, 'invrow'],
    [/חתירה (בפולי תחתון|בכבל עם חבל|עם גומייה בישיבה|במכונה|במכונת|בכבל גבוה)|חתירת גב עליון במכונה/, 'seatedrow'],
    [/אפרייט/, 'uprow'],
    [/חתיר|פנדליי|ייטס|קרוק|מדוז|גורילה|כלב ים/, 'row'],
    [/שראגס|שראג/, 'shrug'],
    [/פולאובר/, 'pullover'],
    [/הנפה קדמית/, 'raise:front'],
    [/הרחק|סיבוב (חיצוני|פנימי)|סיבוב קובני|בר זרוע/, 'raise'],
    [/מקבילים|דיפס במכונה/, 'dip'],
    [/דיפס על ספסל/, 'benchdip'],
    [/שכיבות סמיכה|שכיבת סמיכה|אטומיק|פושאפ|לחיצת חזה ברצועות/, 'pushup'],
    [/פרפר|קרוסאובר|פק-דק|סקוויז/, 'fly'],
    [/לחיצת כתפיים|לחיצה מעל הראש|ארנולד|ויקינג|בראדפורד|לחיצת Z|לחיצת משקולת יד אחת בעמידה|לחיצת קטלבל|לחיצת לנדמיין|גלישת קיר/, 'ohp'],
    [/לחיצת חזה|לחיצה צרה|לחיצת רצפה|לחיצת סבנד|JM|טייט|דחיפה בכבל/, 'press'],
    [/צרפתי|סקאל קראשר|skull|פשיטת מרפק בשכיבה/, 'skull'],
    [/פשיטת מרפק.*מעל הראש|מעל הראש בחבל|מעל הראש בכבל/, 'ohext'],
    [/^קיקבק/, 'kickback'],
    [/פשיטת מרפק|טרייספס/, 'pushdown'],
    [/כפיפת אמות|כפיפ.*מרפק|כפיפה ב|כפיפה מרוכזת|פטישים|זוטמן|21ים|בייספס|כפיפת (פטיש|עכביש|דרג|בייסיאן)/, 'curl'],
    [/כפיפת ברך|נורדיק|גלישת עקבים/, 'legcurl'],
    [/פשיטת ברך/, 'legext'],
    [/לחיצת רגליים|הק סקוואט|סקוואט פנדולום|סקוואט במכונת בלט/, 'legpress'],
    [/עליות עקבים|קדמת השוק|טיביאליס|הרמת אצבעות רגל/, 'calf'],
    [/היפ ת׳רסט|פרוג פאמפ|פול-ת׳רו/, 'hipthrust'],
    [/גשר|הרמת אגן/, 'bridge'],
    [/בעיטה לאחור|דונקי|קיקבק בעמידה|ברז כיבוי|הרמת רגל לאחור/, 'kickbackleg'],
    [/גוד מורנינג/, 'goodmorning'],
    [/דדליפט רומני|רגליים ישרות|Stiff|דדליפט רגל אחת/, 'hinge'],
    [/דדליפט|Rack pull/, 'deadlift'],
    [/בולגרי/, 'bulgarian'],
    [/סטפ-אפ|עלייה על ספסל|עלייה צידית|עליית מדרגה|ירידה ממדרגה/, 'stepup'],
    [/לאנג׳|ספליט סקוואט|קידה/, 'lunge'],
    [/סקוואט|גובלט|כריעה|ישיבה בסקוואט|קוזאק|פיסטול|ברווז/, 'squat']
  ];
  /* סבב שני: שמות שהוקלדו ביד בתוכניות ("כפיפת ברכיים", "היפ תראסט",
     "הליכת פארמר", "חימום"). רץ רק כשאף כלל למעלה לא תפס — כך הוא לא
     יכול לשנות סיווג קיים. נמצאו 52 כאלה מתוך 411 שמות בתוכניות. */
  var SYN = [
    [/כפיפ\S* בר[כך]/, 'legcurl'],
    [/פטיש/, 'curl'],
    [/פארמר|farmer/i, 'walk'],
    [/לחיצת שיפוע/, 'press:incline'],
    [/שכיבות פייק|פייק/, 'pushup'],
    [/תאומים|הרמת עקבים/, 'calf'],
    [/(הנפ|הרמ)\S* (רגל|ברכ).*תלייה/, 'hangraise'],
    [/(הנפ|הרמ)\S* (רגל|ברכ)/, 'legraise'],
    [/תראסט|ת'רסט/, 'hipthrust'],
    [/חימום|סיבובי מפרק/, 'circles'],
    [/מתיחות|הרפיה|שחרור|מוביליטי|ניידות/, 'stretchham'],
    [/אירובי|Z[1-5]|אינטרוול|טמפו/, 'run'],
    [/צ׳ופ/, 'woodchop'],
    [/משיכה כנגד|bent over|בנט אובר/i, 'row'],
    [/פול אובר/, 'pullover'],
    [/מקרבים/, 'sidelying'],
    [/l-sit/i, 'plank'],
    [/הנפת זרוע|כתף קדמית/, 'raise:front'],
    [/russian/i, 'twist'],
    [/פשיטה עם חבל/, 'pushdown'],
    [/לאונג/, 'lunge'],
    [/גב תחתון/, 'superman'],
    [/בטן|ליבה/, 'crunch']
  ];
  var BY_MUSCLE = { chest: 'press', back: 'row', shoulders: 'ohp', biceps: 'curl', triceps: 'pushdown', quads: 'squat',
    hams: 'hinge', glutes: 'hipthrust', calves: 'calf', core: 'plank', full: 'squat', cardio: 'run', box: 'box',
    power: 'jumpsquat', surf: 'popup', mob: 'circles', flex: 'stretchham' };

  function libEntry(name) {
    var X = window.EBEx; if (!X || !X.ALL) return null;
    var k = String(name || '').replace(/\s+/g, ' ').trim();
    for (var i = 0; i < X.ALL.length; i++) if (X.ALL[i].n === k) return X.ALL[i];
    return null;
  }
  function eqFromName(n) {
    if (/במוט|מוט|בסמית׳/.test(n)) return /סמית׳/.test(n) ? 'smith' : 'bar';
    if (/קטלבל/.test(n)) return 'kb';
    if (/משקולת|משקולות|דמבל/.test(n)) return 'db';
    if (/בכבל|כבלים|בפולי|פולי/.test(n)) return 'cable';
    if (/גומייה/.test(n)) return 'band';
    if (/במכונ|מכונת|מכונה/.test(n)) return 'machine';
    if (/רצועות|TRX/.test(n)) return 'trx';
    if (/כדור/.test(n)) return 'ball';
    if (/במים/.test(n)) return 'water';
    return 'bw';
  }
  function classify(name, m, e) {
    var n = String(name || '');
    var lib = libEntry(n);
    m = m || (lib && lib.m) || '';
    e = e || (lib && lib.e) || eqFromName(n);
    if (e === 'water' && !/שחיי|שחית|חתירות/.test(n)) { var w = classify(n.replace(/במים/, ''), m, eqFromName(n.replace(/במים/, ''))); return { p: w ? w.p : 'walk', v: w && w.v, e: 'water', m: m }; }
    var p = null;
    for (var i = 0; i < RULES.length; i++) if (RULES[i][0].test(n)) { p = RULES[i][1]; break; }
    if (!p) for (var j = 0; j < SYN.length; j++) if (SYN[j][0].test(n)) { p = SYN[j][1]; break; }
    if (!p) p = BY_MUSCLE[m] || null;
    if (!p) return null;
    var v = null;
    if (p.indexOf(':') > -1) { v = p.split(':')[1]; p = p.split(':')[0]; }
    if (p === 'press') v = /שיפוע שלילי/.test(n) ? 'decline' : /שיפוע/.test(n) ? 'incline' : v;
    if (p === 'ohp' && (/ישיבה|מכונה|מכונת/.test(n) || e === 'machine')) v = 'seated';
    if (p === 'press' && /בעמידה|בכבלים בעמידה|דחיפה בכבל/.test(n)) return { p: 'fly', v: null, e: 'cable', m: m };
    if (p === 'press' && e === 'machine' && !/שיפוע/.test(n)) return { p: 'ohp', v: 'seated', e: 'machine', alt: 'chestpress', m: 'chest' };
    return { p: p, v: v, e: e, m: m };
  }

  /* ---------- שרירים עובדים ----------
     העיקרי — קבוצת השריר של התרגיל בספרייה. אם אין (שם שהוקלד ביד, או
     קטגוריה כמו "גוף מלא"), הראשון ברשימה של התבנית. השאר — מסייעים. */
  var MUS_HE = { chest: 'חזה', back: 'גב', shoulders: 'כתפיים', biceps: 'יד קדמית', triceps: 'יד אחורית',
                 quads: 'ארבע ראשי', hams: 'המסטרינג', glutes: 'עכוז', calves: 'תאומים', core: 'בטן וליבה' };
  var PM = {
    squat: ['quads', 'glutes', 'core'], jumpsquat: ['quads', 'glutes', 'calves'], boxjump: ['quads', 'glutes', 'calves'],
    lunge: ['quads', 'glutes'], bulgarian: ['quads', 'glutes'], stepup: ['quads', 'glutes'],
    hinge: ['hams', 'glutes', 'back'], deadlift: ['back', 'glutes', 'hams'], goodmorning: ['hams', 'back'],
    swing: ['glutes', 'hams', 'core'], hipthrust: ['glutes', 'hams'], bridge: ['glutes', 'hams'], calf: ['calves'],
    legext: ['quads'], legcurl: ['hams'], legpress: ['quads', 'glutes'], pushup: ['chest', 'triceps', 'core'],
    plank: ['core', 'shoulders'], climber: ['core', 'quads'], dip: ['triceps', 'chest'], benchdip: ['triceps'],
    press: ['chest', 'triceps', 'shoulders'], fly: ['chest'], pullover: ['back', 'chest'], ohp: ['shoulders', 'triceps'],
    raise: ['shoulders'], reardelt: ['shoulders', 'back'], facepull: ['shoulders', 'back'], shrug: ['back'],
    uprow: ['shoulders', 'back'], row: ['back', 'biceps'], seatedrow: ['back', 'biceps'], invrow: ['back', 'biceps'],
    pulldown: ['back', 'biceps'], pullup: ['back', 'biceps'], hangraise: ['core'], lsitpull: ['back', 'biceps', 'core'], dipraise: ['core'], pullapart: ['shoulders', 'back'], kpulldown: ['back', 'biceps'], scapdip: ['shoulders', 'back', 'triceps'], ropeclimb: ['back', 'biceps', 'core'], pistol: ['quads', 'glutes', 'core'], hip9090: ['glutes'], inchworm: ['hams', 'shoulders', 'core'], legswing: ['hams', 'glutes'], curl: ['biceps'],
    pushdown: ['triceps'], ohext: ['triceps'], skull: ['triceps'], kickback: ['triceps'], crunch: ['core'],
    legraise: ['core'], twist: ['core'], woodchop: ['core', 'shoulders'], pallof: ['core'], deadbug: ['core'],
    birddog: ['core', 'glutes', 'back'], kickbackleg: ['glutes'], sidelying: ['glutes'], superman: ['back', 'glutes'],
    run: ['quads', 'hams', 'calves'], walk: ['quads', 'calves', 'core'], bike: ['quads', 'calves'],
    rower: ['back', 'quads', 'biceps'], jumprope: ['calves'], box: ['shoulders', 'core'], kick: ['glutes', 'core'],
    swim: ['back', 'shoulders'], popup: ['chest', 'triceps', 'quads'], stretchham: ['hams'], stretchquad: ['quads'],
    stretchhip: ['glutes', 'quads'], stretchup: ['chest', 'shoulders'], childpose: ['back'], circles: ['shoulders'],
    hipcar: ['glutes'], catcow: ['back', 'core'], roll: [], sled: ['quads', 'glutes'], ropes: ['shoulders', 'core'],
    throw: ['shoulders', 'core', 'quads'], slam: ['core', 'back'], thruster: ['quads', 'shoulders'],
    clean: ['back', 'glutes', 'quads'], snatch: ['shoulders', 'back', 'glutes'], carryover: ['shoulders', 'core'],
    getup: ['core', 'shoulders'], burpee: ['quads', 'chest', 'core'], hold: []
  };
  function musclesFor(c) {
    var list = (PM[c.p] || []).slice();
    var pri = MUS_HE[c.m] ? c.m : list[0];
    if (!pri) return [];
    return [pri].concat(list.filter(function (k) { return k !== pri; }));
  }
  function muscles(name) { var c = classify(name); return c ? musclesFor(c) : []; }

  /* ---------- ציור ---------- */
  var C = { body: '#F2E9DD', far: '#8A7B6C', line: '#C9B9A6', eq: '#C49A6C', eqDark: '#8E6A45', gear: '#5E4A39', pad: '#3B2E24', floor: '#47372A', water: 'rgba(90,150,190,.22)' };
  function build(c) {
    var def = P[c.p]; if (!def) return null;
    var s = def.fn(c.e, c.v);
    if (s.kf.length === 2 && (ECC_FIRST[c.p] || STRENGTH[c.p])) s.dur = Math.max(s.dur, 3400);
    s.res = s.kf.map(function (k) { return resolve(k.p); });
    s.e = c.e; s.p = c.p; s.mus = musclesFor(c);
    if (c.e === 'water' && s.water == null) s.water = -104;
    if (c.alt === 'chestpress') { s.res.forEach(function (r, i) { r.h1 = i === 0 ? add(body(r).sh, [84, 6]) : add(body(r).sh, [20, 30]); r.h2 = [r.h1[0] - 7, r.h1[1]]; r.eb = 'D'; r.eb2 = 'D'; }); }
    s.bb = bounds(s);
    return s;
  }
  /* קצב: בתרגילי כוח הירידה (האקסצנטרית) איטית, העלייה מהירה, ועצירה
     קצרה בכל קצה — כמו שמבצעים באמת. ECC_FIRST — תבניות שבהן התנוחה
     הראשונה היא למעלה והתנועה הראשונה היא ירידה. תנועות מחזוריות
     (ריצה, הליכה, אופניים) רצות ברצף, בלי עצירות. */
  var ECC_FIRST = { pistol: 1, squat: 1, lunge: 1, bulgarian: 1, hinge: 1, goodmorning: 1, press: 1, fly: 1, pushup: 1, dip: 1,
                    benchdip: 1, legpress: 1, skull: 1, pullover: 1 };
  var STRENGTH = { deadlift: 1, calf: 1, legext: 1, legcurl: 1, pulldown: 1, pullup: 1, row: 1, seatedrow: 1, invrow: 1,
                   curl: 1, pushdown: 1, ohext: 1, kickback: 1, raise: 1, reardelt: 1, facepull: 1, shrug: 1, uprow: 1,
                   hipthrust: 1, bridge: 1, crunch: 1, legraise: 1, stepup: 1, kickbackleg: 1, sidelying: 1, superman: 1,
                   pallof: 1, hangraise: 1, ohp: 1, lsitpull: 1, dipraise: 1, pullapart: 1, kpulldown: 1, scapdip: 1 };
  function smooth(f) { return f * f * f * (f * (f * 6 - 15) + 10); }
  function phase(s, t) {
    var n = s.res.length;
    if (s.cyc) { var x = (t % 1) * n, i = Math.floor(x); return { i: i, f: x - i }; }
    if (n === 2 && (ECC_FIRST[s.p] || STRENGTH[s.p])) {
      /* [עצירה בתנוחה 1, תנועה 1←2, עצירה בתנוחה 2, תנועה 2←1] */
      var tp = ECC_FIRST[s.p] ? [0.08, 0.46, 0.1, 0.36] : [0.08, 0.32, 0.16, 0.44];
      var u = t % 1;
      if (u < tp[0]) return { i: 0, f: 0 };
      u -= tp[0]; if (u < tp[1]) return { i: 0, f: smooth(u / tp[1]) };
      u -= tp[1]; if (u < tp[2]) return { i: 1, f: 0 };
      u -= tp[2]; return { i: 1, f: smooth(Math.min(1, u / tp[3])) };
    }
    var y = (t % 1) * n, j = Math.floor(y), g = y - j;
    var hold = 0.12, m = g < hold ? 0 : (g - hold) / (1 - hold);
    return { i: j, f: smooth(m) };
  }
  function frame(s, t) {
    var ph = phase(s, t), n = s.res.length;
    return body(mix(s.res[ph.i], s.res[(ph.i + 1) % n], ph.f));
  }
  function bounds(s) {
    var xs = [], ys = [];
    for (var k = 0; k < 24; k++) {
      var b = frame(s, k / 24);
      Object.keys(b).forEach(function (j) { xs.push(b[j][0]); ys.push(b[j][1]); });
    }
    (s.props || []).forEach(function (p) { if (p.r) { xs.push(p.r[0], p.r[0] + p.r[2]); ys.push(p.r[1], p.r[1] + p.r[3]); } });
    if (s.cable && s.hold && /cable/.test(s.hold)) { xs.push(s.cable[0]); ys.push(s.cable[1]); }
    var minY = Math.min.apply(null, ys) - L.head - 6, maxY = s.ground === false ? Math.max.apply(null, ys) + 10 : Math.max(4, Math.max.apply(null, ys) + 6);
    return { x0: Math.min.apply(null, xs) - 26, x1: Math.max.apply(null, xs) + 26, y0: minY, y1: maxY };
  }

  function draw(cv, s, t, fill) {
    var ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
    var bb = s.bb, sc = Math.min(W / (bb.x1 - bb.x0), H / (bb.y1 - bb.y0)) * 0.92;
    if (!fill) sc = Math.min(sc, (H / 330));   // דמות לא מתנפחת בתבניות קטנות (fill — בסרטון, למלא את המסגרת)
    var ox = W / 2 - (bb.x0 + bb.x1) / 2 * sc, oy = H / 2 - (bb.y0 + bb.y1) / 2 * sc;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H);
    ctx.setTransform(sc, 0, 0, sc, ox, oy);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    var b = frame(s, t), lw = 9;

    function line(a, c2, col, w, alpha) { ctx.globalAlpha = alpha == null ? 1 : alpha; ctx.strokeStyle = col; ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(c2[0], c2[1]); ctx.stroke(); ctx.globalAlpha = 1; }
    function rect(r, col) { ctx.fillStyle = col; ctx.fillRect(r[0], r[1], r[2], r[3]); }
    function plate(c, r) { r = r || 22; circ(c, r, C.eq, true); ctx.strokeStyle = C.eqDark; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(c[0], c[1], r - 4, 0, Math.PI * 2); ctx.stroke(); circ(c, 4.5, C.gear, true); }
    function circ(p, r, col, fill) { ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, Math.PI * 2);
      if (fill) { ctx.fillStyle = col; ctx.fill(); } else { ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.stroke(); } }

    if (s.water != null) { ctx.fillStyle = C.water; ctx.fillRect(bb.x0 - 40, s.water, bb.x1 - bb.x0 + 80, -s.water + 40); }
    if (s.ground !== false) line([bb.x0 - 30, 4], [bb.x1 + 30, 4], C.floor, 6);

    (s.props || []).forEach(function (p) {
      if (p.k === 'bench') { rect(p.r, C.pad); rect([p.r[0], p.r[1] + p.r[3] - 3, p.r[2], 3], C.gear); }
      else if (p.k === 'legs') { line([p.r[0] + 6, p.r[1]], [p.r[0] + 6, 0], C.gear, 6); line([p.r[0] + p.r[2] - 6, p.r[1]], [p.r[0] + p.r[2] - 6, 0], C.gear, 6); }
      else if (p.k === 'box') { ctx.globalAlpha = 0.9; rect(p.r, C.gear); ctx.globalAlpha = 1; }
      else if (p.k === 'seat') { rect([-38, p.low ? -26 : -58, 66, 9], C.gear); line([-30, p.low ? -26 : -58], [-30, 0], C.gear, 6);
        if (!p.low) line([-36, -58], [-48, -150], C.gear, 8); }
      else if (p.k === 'pbench') { var v = p.v;
        if (v === 'incline') { line([-50, -150], [10, -48], C.gear, 10); line([10, -50], [70, -50], C.gear, 10); }
        else if (v === 'decline') { line([-80, -40], [80, -64], C.gear, 10); }
        else { line([-110, -50], [80, -50], C.pad, 12); line([-110, -45], [80, -45], C.gear, 3); }
        line([-80, -50], [-80, 0], C.gear, 6); line([60, -50], [60, 0], C.gear, 6); }
      else if (p.k === 'rails') { line([b.wr1[0] - 30, -290], [b.wr1[0] - 30, 0], C.gear, 5); line([b.wr1[0] + 30, -290], [b.wr1[0] + 30, 0], C.gear, 5); }
      else if (p.k === 'hbar') line([-60, p.y], [80, p.y], C.gear, 7);
      else if (p.k === 'rope') line([p.x, -380], [p.x, -20], C.eq, 6);
      else if (p.k === 'dipbar') { line([-30, p.y], [50, p.y], C.gear, 7); line([40, p.y], [40, 0], C.gear, 6); }
      else if (p.k === 'sled') { line([-30, -20], [150, -150], C.gear, 6); }
      else if (p.k === 'tread') { line([-90, 2], [100, 2], C.gear, 10); line([90, 0], [110, -90], C.gear, 6); }
      else if (p.k === 'rail') { line([-60, -10], [150, -10], C.gear, 8); circ([150, -40], 22, C.gear, true); }
      else if (p.k === 'bike') { line([0, -110], [p.c[0], p.c[1]], C.gear, 7); line([p.c[0], p.c[1]], [110, -150], C.gear, 7); circ(p.c, 26, C.gear); line([-10, -112], [16, -112], C.gear, 8); }
      else if (p.k === 'bag') { line([150, -300], [150, -250], C.gear, 4); ctx.fillStyle = C.gear; ctx.fillRect(126, -250, 48, 150); }
      else if (p.k === 'mitt') { circ([142, -200], 16, C.eq, true); }
      else if (p.k === 'ball') circ(p.c, p.r, C.gear, true);
      else if (p.k === 'board') { line([-90, 4], [150, 4], C.eq, 8); }
      else if (p.k === 'roller') { circ([b.hip[0] - 4, -20], 16, C.gear, true); }
      else if (p.k === 'sledbox') { rect([b.wr1[0] + 4, -90, 50, 90], C.gear); }
      else if (p.k === 'plate') rect(p.r, C.gear);
      else if (p.k === 'pad') { rect([-30, -150, 60, 10], C.gear); }
    });

    /* צל על הרצפה — בלעדיו הדמות נראית מרחפת */
    if (s.ground !== false) {
      var fx = (b.ank1[0] + b.ank2[0] + b.toe1[0]) / 3, fy = Math.max(b.ank1[1], b.ank2[1]);
      if (fy > -14) { ctx.globalAlpha = 0.28; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(fx, 4, 42, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
    }
    /* גוף עם נפח: כל איבר הוא צורה שמצטרת לכיוון המפרק (ירך עבה וברך
       צרה, זרוע ואמה), והצד הרחוק בגוון כהה ולא שקוף — שקיפות יצרה
       חפיפות מוזרות במקום שהגפיים נחצות. */
    taper(ctx, b.hip2, b.knee2, 14, 10, C.far); taper(ctx, b.knee2, b.ank2, 10, 7, C.far); foot(ctx, b.ank2, b.toe2, C.far);
    taper(ctx, b.sh2, b.elb2, 10, 8, C.far); taper(ctx, b.elb2, b.wr2, 8, 6, C.far); hand(ctx, b.wr2, C.far);
    torso(ctx, b, C.body);
    taper(ctx, b.hip, b.knee1, 15, 11, C.body); taper(ctx, b.knee1, b.ank1, 11, 7.5, C.body); foot(ctx, b.ank1, b.toe1, C.body);
    head(ctx, b, s.res[0], C.body);
    taper(ctx, b.sh, b.elb1, 10.5, 8, C.body); taper(ctx, b.elb1, b.wr1, 8, 6, C.body); hand(ctx, b.wr1, C.body);
    drawMuscles(ctx, b, s.mus || []);

    var h = s.hold, w = b.wr1, w2 = b.wr2;
    if (h === 'plate') { line([w[0] - 4, w[1]], [w2[0] + 4, w2[1]], C.eqDark, 4); plate(w); }
    else if (h === 'back') { plate(add(b.sh, dir(s.res[0].torso - 90), 8)); }
    else if (h === 'hand') { line([w[0] - 10, w[1]], [w[0] + 10, w[1]], C.eqDark, 4); rect([w[0] - 15, w[1] - 7, 7, 14], C.eq); rect([w[0] + 8, w[1] - 7, 7, 14], C.eq); }
    else if (h === 'kb') { circ([w[0], w[1] + 14], 12, C.eq, true); line([w[0] - 6, w[1]], [w[0] + 6, w[1]], C.eq, 4); }
    else if (h === 'ball') circ([w[0] + 4, w[1] - 4], 16, C.eq, true);
    else if (h === 'cable' || h === 'anklecable') { var from = h === 'anklecable' ? b.ank2 : w; line(from, s.cable, C.eq, 2.5); circ(s.cable, 7, C.gear, true); }
    else if (h === 'band' || h === 'bandback') { ctx.setLineDash([6, 5]); line(w, h === 'band' ? (s.cable || [w[0] + 120, w[1]]) : [b.sh[0] - 30, b.sh[1]], C.eq, 3); ctx.setLineDash([]); }
    else if (h === 'bandfoot' || h === 'bandpull') { ctx.setLineDash([6, 5]); line(w, h === 'bandpull' ? b.ank1 : [b.ank1[0] + 8, b.ank1[1]], C.eq, 3); ctx.setLineDash([]); }
    else if (h === 'handle') { line([w[0], w[1] - 10], [w[0], w[1] + 10], C.eq, 6); line(w, [w[0] + (s.p === 'pulldown' ? 0 : -40), w[1] + (s.p === 'pulldown' ? -60 : 0)], C.gear, 4); }
    else if (h === 'hipbar') { plate([b.hip[0], b.hip[1] - 13], 15); }
    else if (h === 'hipband') { ctx.setLineDash([6, 5]); line([b.hip[0] - 20, b.hip[1] - 10], [b.hip[0] + 20, b.hip[1] - 10], C.eq, 3); ctx.setLineDash([]); }
    else if (h === 'pad') { circ(b.ank1, 9, C.eq, true); }
    else if (h === 'footdb') { circ(b.ank1, 9, C.eq, true); }
    else if (h === 'ballfeet') { circ([b.ank1[0] + 4, b.ank1[1] + 20], 22, C.gear, true); }
    else if (h === 'ballhands') { circ([w[0], 10], 0.1, C.gear, true); }
    else if (h === 'trxhands') { line(w, [w[0] + 20, -330], C.eq, 2.5); }
    else if (h === 'trxfeet') { line(b.ank1, [b.ank1[0] + 10, -330], C.eq, 2.5); }
    else if (h === 'rope') { ctx.strokeStyle = C.eq; ctx.lineWidth = 2.5; ctx.beginPath();
      var up = Math.sin(t * Math.PI * 2) > 0, ry = up ? b.head[1] - 40 : 14;
      ctx.moveTo(w[0], w[1]); ctx.quadraticCurveTo((w[0] + w2[0]) / 2 - 20, ry, w2[0], w2[1]); ctx.stroke(); }
    else if (h === 'ropes') { ctx.strokeStyle = C.eq; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(w[0], w[1]);
      for (var q = 1; q <= 8; q++) ctx.lineTo(w[0] + q * 22, -10 + Math.sin(q * 1.3 + t * 18) * 18 * (1 - q / 9) + (w[1] + 10) * (1 - q / 8)); ctx.stroke(); }
    else if (h === 'bag') { rect([w[0] - 16, w[1] - 6, 32, 22], C.eq); }
    if (s.e === 'smith' && (h === 'plate' || h === 'back')) {}
  }

  /* ---------- צורות הגוף ---------- */
  function taper(ctx, a, c, w1, w2, col) {
    var v = unit([c[0] - a[0], c[1] - a[1]]), n = [-v[1], v[0]];
    ctx.fillStyle = col; ctx.beginPath();
    ctx.moveTo(a[0] + n[0] * w1 / 2, a[1] + n[1] * w1 / 2);
    ctx.lineTo(c[0] + n[0] * w2 / 2, c[1] + n[1] * w2 / 2);
    ctx.lineTo(c[0] - n[0] * w2 / 2, c[1] - n[1] * w2 / 2);
    ctx.lineTo(a[0] - n[0] * w1 / 2, a[1] - n[1] * w1 / 2);
    ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(a[0], a[1], w1 / 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(c[0], c[1], w2 / 2, 0, Math.PI * 2); ctx.fill();
  }
  function torso(ctx, b, col) {
    /* גו: אגן צר יותר, בית חזה רחב יותר, צוואר */
    var mid = [(b.hip[0] * 0.45 + b.sh[0] * 0.55), (b.hip[1] * 0.45 + b.sh[1] * 0.55)];
    taper(ctx, b.hip, mid, 21, 24, col);
    taper(ctx, mid, b.sh, 24, 19, col);
    var tv = unit([b.sh[0] - b.hip[0], b.sh[1] - b.hip[1]]);
    taper(ctx, b.sh, [b.sh[0] + tv[0] * 10, b.sh[1] + tv[1] * 10], 9, 8, col);
  }
  function foot(ctx, ank, toe, col) {
    var v = unit([toe[0] - ank[0], toe[1] - ank[1]]);
    var heel = [ank[0] - v[0] * 4, ank[1] - v[1] * 4];
    taper(ctx, heel, toe, 8, 5, col);
  }
  function hand(ctx, wr, col) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(wr[0], wr[1], 4.6, 0, Math.PI * 2); ctx.fill(); }
  function head(ctx, b, p0, col) {
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(b.head[0], b.head[1], L.head, 0, Math.PI * 2); ctx.fill();
    /* אף קטן לכיוון הפנים — כדי שיהיה ברור לאן הדמות מסתכלת */
    var tv = unit([b.head[0] - b.sh[0], b.head[1] - b.sh[1]]), f = [-tv[1], tv[0]];
    var nose = [b.head[0] + f[0] * (L.head + 2.5), b.head[1] + f[1] * (L.head + 2.5)];
    taper(ctx, [b.head[0] + f[0] * (L.head - 3), b.head[1] + f[1] * (L.head - 3)], nose, 6, 3, col);
  }

  /* השריר מצויר כפס צבעוני על הצד הנכון של הגפה: ארבע ראשי בצד שאליו
     הברך מתכופפת קדימה, המסטרינג בצד השני; יד אחורית בצד של המרפק.
     הצד נגזר מכיפוף המפרק בכל פריים, ולכן נשאר נכון גם כשהגוף שוכב. */
  var MC = '#E4622F';
  function unit(v) { var l = Math.hypot(v[0], v[1]); return l < 0.001 ? [0, 0] : [v[0] / l, v[1] / l]; }
  function drawMuscles(ctx, b, mus) {
    if (!mus.length) return;
    var tv = unit([b.sh[0] - b.hip[0], b.sh[1] - b.hip[1]]), tn = [-tv[1], tv[0]];
    function side(j, a, c, fb) {
      var m = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2], v = [j[0] - m[0], j[1] - m[1]];
      return Math.hypot(v[0], v[1]) < 3 ? fb : unit(v);
    }
    var kc = side(b.knee1, b.hip, b.ank1, tn), ec = side(b.elb1, b.sh, b.wr1, [-tn[0], -tn[1]]);
    function neg(v) { return [-v[0], -v[1]]; }
    function seg(a, c, f0, f1, off, alpha) {
      var o = 4;
      ctx.globalAlpha = alpha; ctx.strokeStyle = MC; ctx.lineWidth = 6.5; ctx.lineCap = 'round'; ctx.beginPath();
      ctx.moveTo(a[0] + (c[0] - a[0]) * f0 + off[0] * o, a[1] + (c[1] - a[1]) * f0 + off[1] * o);
      ctx.lineTo(a[0] + (c[0] - a[0]) * f1 + off[0] * o, a[1] + (c[1] - a[1]) * f1 + off[1] * o);
      ctx.stroke(); ctx.globalAlpha = 1;
    }
    function dot(p, r, alpha) { ctx.globalAlpha = alpha; ctx.fillStyle = MC; ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
    mus.forEach(function (k, i) {
      var a = i === 0 ? 0.95 : 0.5;
      if (k === 'quads') seg(b.hip, b.knee1, 0.15, 0.85, kc, a);
      else if (k === 'hams') seg(b.hip, b.knee1, 0.18, 0.85, neg(kc), a);
      else if (k === 'glutes') { dot([b.hip[0] - tn[0] * 5, b.hip[1] - tn[1] * 5], 7.5, a); }
      else if (k === 'calves') seg(b.knee1, b.ank1, 0.12, 0.6, neg(kc), a);
      else if (k === 'chest') seg(b.hip, b.sh, 0.62, 0.92, tn, a);
      else if (k === 'core') seg(b.hip, b.sh, 0.12, 0.58, tn, a);
      else if (k === 'back') seg(b.hip, b.sh, 0.3, 0.92, neg(tn), a);
      else if (k === 'shoulders') dot(b.sh, 7.5, a);
      else if (k === 'biceps') seg(b.sh, b.elb1, 0.18, 0.85, neg(ec), a);
      else if (k === 'triceps') seg(b.sh, b.elb1, 0.18, 0.85, ec, a);
    });
  }

  /* ---------- לולאה אחת לכל הקנבסים ---------- */
  var LIVE = [], RAF = 0, T0 = performance.now();
  function tick(now) {
    LIVE = LIVE.filter(function (x) { return x.cv.isConnected; });
    LIVE.forEach(function (x) { if (x.vis) draw(x.cv, x.s, ((now - T0) / x.s.dur) % 1); });
    RAF = LIVE.length ? requestAnimationFrame(tick) : 0;
  }
  var IO = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(function (ents) {
    ents.forEach(function (en) { LIVE.forEach(function (x) { if (x.cv === en.target) x.vis = en.isIntersecting; }); });
  }) : null;

  function mount(cv, name, opt) {
    opt = opt || {};
    var c = opt.cls || classify(name, opt.m, opt.e); if (!c) return false;
    var s = build(c); if (!s) return false;
    var dpr = Math.min(2, window.devicePixelRatio || 1), cssW = cv.clientWidth || +cv.getAttribute('width') || 300, cssH = cv.clientHeight || +cv.getAttribute('height') || cssW;
    cv.width = Math.round(cssW * dpr); cv.height = Math.round(cssH * dpr);
    var item = { cv: cv, s: s, vis: !IO };
    LIVE = LIVE.filter(function (x) { return x.cv !== cv; }); LIVE.push(item);
    if (IO) IO.observe(cv);
    draw(cv, s, 0.25);
    if (!RAF) RAF = requestAnimationFrame(tick);
    return true;
  }
  /* כל הקנבסים בתוך root שמסומנים data-anim="שם התרגיל" */
  function mountAll(root) {
    (root || document).querySelectorAll('canvas[data-anim]').forEach(function (cv) {
      if (cv.__animOn) return; cv.__animOn = 1; mount(cv, cv.getAttribute('data-anim'));
    });
  }
  function has(name) { return !!classify(name); }
  function label(name) { var c = classify(name); return c && P[c.p] ? P[c.p].he : ''; }

  /* ---------- חלון הדמיה — משותף למאמן ולמתאמן ----------
     עצמאי ולא דרך openModal: בדף המתאמן אין openModal, ובאפליקציה
     המאמן אפשר לפתוח אותו מעל חלון אחר (חלון הסרטון). */
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  var EQ_HE = { bar: 'מוט', db: 'משקולות', kb: 'קטלבל', cable: 'כבל', band: 'גומייה', machine: 'מכונה', smith: 'סמית׳',
                trx: 'רצועות', ball: 'כדור', bw: 'משקל גוף', water: 'מים', bench: 'ספסל', bike: 'מכשיר', other: '', bag: 'שק', mitts: 'פאדים', rope: 'חבל' };
  function noteOf(name) { var e = libEntry(name); return e && e.note ? e.note : ''; }
  function open(name, opt) {
    opt = opt || {};
    var c = classify(name); if (!c) return false;
    close();
    var note = opt.note != null ? opt.note : noteOf(name);
    var ov = document.createElement('div');
    ov.id = 'ebAnimModal';
    ov.style.cssText = 'position:fixed;inset:0;z-index:300;background:rgba(10,7,5,.72);display:flex;align-items:center;justify-content:center;padding:14px';
    ov.innerHTML = '<div role="dialog" aria-modal="true" style="width:min(430px,100%);max-height:92vh;overflow:auto;background:#241B14;'
      + 'border:1px solid #47372A;border-radius:18px;padding:14px 14px 16px;color:#F2E9DD;font-family:inherit;direction:rtl">'
      + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">'
      + '<div style="flex:1;min-width:0"><div style="font-weight:800;font-size:17px;line-height:1.3">' + esc(name) + '</div>'
      + '<div style="font-size:12px;color:#B8A898">' + esc(P[c.p].he) + (EQ_HE[c.e] ? ' · ' + esc(EQ_HE[c.e]) : '') + '</div></div>'
      + '<button aria-label="סגירה" onclick="EBAnim.close()" style="width:34px;height:34px;border-radius:50%;border:1px solid #47372A;'
      + 'background:transparent;color:#F2E9DD;font-size:18px;cursor:pointer">×</button></div>'
      + '<canvas data-anim="' + esc(name) + '" style="width:100%;aspect-ratio:1/1;display:block;border-radius:12px;background:#1C150F"></canvas>'
      + musLegend(musclesFor(c))
      + (note ? '<div style="font-size:13.5px;color:#C49A6C;margin-top:10px;line-height:1.55">' + esc(note) + '</div>' : '')
      + '<div style="font-size:11.5px;color:#9A8A7C;margin-top:8px;line-height:1.5">הדמיה כללית של התנועה. את הטכניקה המדויקת שלך — המשקל, הטווח והקצב — קובע המאמן.</div>'
      + '</div>';
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    document.body.appendChild(ov);
    var cv = ov.querySelector('canvas'); cv.__animOn = 1;
    /* מיד ולא ב-requestAnimationFrame: בלשונית ברקע הוא לא רץ, והחלון
       נשאר ריק. mount מצייר פריים ראשון בעצמו, והלולאה ממשיכה כשנראים. */
    mount(cv, name);
    document.addEventListener('keydown', escKey);
    return true;
  }
  function musLegend(mus) {
    if (!mus.length) return '';
    return '<div style="display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;margin-top:10px;font-size:12.5px">'
      + '<span style="color:#B8A898">שרירים עובדים:</span>'
      + mus.map(function (k, i) {
          return '<span style="display:inline-flex;align-items:center;gap:5px"><i style="width:10px;height:10px;border-radius:50%;background:' + MC
            + ';opacity:' + (i === 0 ? 1 : 0.5) + ';display:inline-block"></i>' + esc(MUS_HE[k]) + (i === 0 ? ' <b style="font-weight:600;color:#B8A898">(עיקרי)</b>' : '') + '</span>';
        }).join('') + '</div>';
  }
  function escKey(e) { if (e.key === 'Escape') { if (document.getElementById('ebAnimModal')) close(); else closeLibrary(); } }
  function close() {
    var m = document.getElementById('ebAnimModal'); if (m) m.remove();
    document.removeEventListener('keydown', escKey);
  }

  /* ---------- ספריית ההדמיות ----------
     אותו תוכן בשני מקומות: מסך באפליקציית המאמן, וחלון בדף המתאמן.
     כל מיכל מסומן data-animlib; החיפוש מחליף רק את הרשת (כדי לא לאבד
     את המיקוד בשדה), ובחירת שריר מחליפה גם את הכפתורים. */
  var LQ = '', LM = 'all', LLIM = 48;
  function libItems() {
    var X = window.EBEx; if (!X) return [];
    var q = LQ.trim();
    return X.ALL.filter(function (x) {
      var c = classify(x.n, x.m, x.e); if (!c) return false;
      if (LM !== 'all' && x.m !== LM && musclesFor(c).indexOf(LM) < 0) return false;
      if (q && x.n.indexOf(q) < 0 && ((P[c.p] || {}).he || '').indexOf(q) < 0) return false;
      return true;
    });
  }
  function libGrid() {
    var items = libItems(), shown = items.slice(0, LLIM);
    var h = '<div style="font-size:12.5px;color:var(--mut,#9A8A7C);margin:4px 0 10px">' + items.length + ' תרגילים</div>'
      + '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px">';
    shown.forEach(function (x) {
      var c = classify(x.n, x.m, x.e), mus = musclesFor(c);
      h += '<button onclick="EBAnim.open(this.dataset.n)" data-n="' + esc(x.n) + '" style="text-align:right;cursor:pointer;'
        + 'background:var(--card,#2A2019);border:1px solid var(--line,#47372A);border-radius:12px;padding:8px;color:inherit;font:inherit">'
        + '<canvas data-anim="' + esc(x.n) + '" style="width:100%;aspect-ratio:1/1;display:block;border-radius:9px;background:#1C150F"></canvas>'
        + '<div style="font-weight:700;font-size:13px;line-height:1.3;margin-top:7px">' + esc(x.n) + '</div>'
        + '<div style="font-size:11.5px;color:var(--mut,#9A8A7C)">' + esc(P[c.p].he) + (EQ_HE[c.e] ? ' · ' + esc(EQ_HE[c.e]) : '') + '</div>'
        + (mus.length ? '<div style="font-size:11.5px;color:' + MC + ';margin-top:2px">' + mus.slice(0, 2).map(function (k) { return esc(MUS_HE[k]); }).join(' · ') + '</div>' : '')
        + '</button>';
    });
    h += '</div>';
    if (items.length > shown.length) h += '<button class="btn ghost" style="width:100%;margin-top:12px;padding:11px;border-radius:10px;cursor:pointer;'
      + 'background:transparent;border:1px solid var(--line,#47372A);color:inherit;font:inherit" onclick="EBAnim.more()">הצג עוד (' + (items.length - shown.length) + ')</button>';
    return h;
  }
  function chips() {
    var X = window.EBEx, h = chip('all', 'הכול');
    Object.keys(MUS_HE).forEach(function (k) { h += chip(k, MUS_HE[k]); });
    if (X) ['full', 'cardio', 'mob', 'flex', 'box', 'power', 'surf'].forEach(function (k) { if (X.MUSCLES[k]) h += chip(k, X.MUSCLES[k]); });
    return h;
  }
  function libInner() {
    return '<input id="anim_q" placeholder="חיפוש לפי שם תרגיל או תנועה" value="' + esc(LQ) + '" oninput="EBAnim.search(this.value)" '
      + 'style="width:100%;box-sizing:border-box;margin-bottom:10px;padding:11px 12px;border-radius:10px;border:1px solid var(--line,#47372A);'
      + 'background:var(--ink,#1C150F);color:inherit;font:inherit;font-size:14px">'
      + '<div data-animchips style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">' + chips() + '</div>'
      + '<div data-animgrid>' + libGrid() + '</div>';
  }
  function libView() {
    var X = window.EBEx; if (!X) return '<div class="empty">ספריית התרגילים לא נטענה.</div>';
    return '<div class="head"><div><h1>ספריית הדמיות</h1>'
      + '<p class="muted">דמות שמבצעת את התנועה, לכל ' + X.ALL.length + ' התרגילים, והשרירים שעובדים מסומנים עליה. '
      + 'המתאמן רואה אותה בכפתור "▶ הדמיה" מתחת לתרגיל ובספריית ההדמיות שלו — אלא אם העלית סרטון משלך, ואז הוא רואה את הסרטון.</p></div></div>'
      + clipsCard()
      + '<div class="card" data-animlib>' + libInner() + '</div>';
  }

  /* ---------- הסרטונים שלי · טיוטה ----------
     סרטוני המאמן עם ההדמיה וההסבר על גביהם, לפני שמחליטים לפרסם.
     הרשימה יושבת בקובץ משלה באחסון (clips/index.json בדלי programs — דלי
     הסרטונים מקבל רק וידאו) ולא
     בהגדרות: ההגדרות נשמרות כגוש אחד, וחלון ישן של האפליקציה שפתוח
     במכשיר אחר דרס אותן פעמיים עם רשימה ישנה. את הקובץ הזה כותבים רק
     כשמוסיפים או מוחקים סרטון. trainee_videos מחזיר למתאמן רק את
     exVideos, כך שהמתאמן לא רואה אותם בשום מסך עד שהם עוברים לשם. */
  var CLIPS = null, clipsBusy = false;
  function clipsPath() { return window.EBSync && EBSync.user() ? EBSync.user().id + '/clips/index.json' : null; }
  function clips() {
    if (CLIPS) return CLIPS;
    var st = (window.S && window.S.settings) || {}; return st.coachClips || [];
  }
  async function clipsLoad() {
    var path = clipsPath(); if (!path || clipsBusy) return;
    clipsBusy = true;
    try {
      /* קישור חתום עם no-store: download() רגיל החזיר עותק ישן מהמטמון
         של הדפדפן, ואז הוספה חדשה נכתבה מעל רשימה ישנה */
      var su = await EBSync.client().storage.from('programs').createSignedUrl(path, 60);
      var res = su.error ? null : await fetch(su.data.signedUrl + '&t=' + Date.now(), { cache: 'no-store' });
      var r = res && res.ok ? { data: { text: function () { return res.text(); } } } : { error: true };
      if (r.error) {
        /* אין עדיין קובץ: מעבירים אליו את מה שיש בהגדרות, פעם אחת */
        var st = (window.S && window.S.settings) || {};
        if (st.coachClips && st.coachClips.length) await clipsSave(st.coachClips.slice());
      } else {
        CLIPS = JSON.parse(await r.data.text());
      }
    } catch (e) {} finally { clipsBusy = false; }
    var box = document.querySelector('[data-animclips]');
    if (box) box.innerHTML = clipsInner();
  }
  async function clipsSave(list) {
    var path = clipsPath(); if (!path) throw new Error('not signed in');
    var blob = new Blob([JSON.stringify(list)], { type: 'text/plain' });
    var r = await EBSync.client().storage.from('programs').upload(path, blob, { upsert: true, contentType: 'text/plain', cacheControl: '0' });
    if (r.error) throw r.error;
    CLIPS = list;
    return list.length;
  }
  function clipsCard() {
    setTimeout(clipsLoad, 0);
    return '<div data-animclips>' + clipsInner() + '</div>';
  }
  function clipsInner() {
    var list = clips();
    if (!list.length) return '';
    var mb = list.reduce(function (a, c) { return a + (c.size || 0); }, 0) / 1048576;
    var h = '<div class="card" style="margin-bottom:12px"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px">'
      + '<h3 style="flex:1;font-size:16px;margin:0">🎬 הסרטונים שלי · טיוטה</h3>'
      + '<span style="font-size:12px;padding:3px 10px;border-radius:20px;border:1px solid var(--line,#47372A);color:var(--mut,#9A8A7C)">🔒 לא גלוי למתאמנים</span>'
      + '<span style="font-size:12px;color:var(--mut,#9A8A7C)">' + list.length + ' סרטונים · ' + mb.toFixed(1) + 'MB</span></div>'
      + '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px">';
    list.forEach(function (c, i) {
      h += '<div style="background:var(--ink,#1C150F);border:1px solid var(--line,#47372A);border-radius:12px;padding:8px">'
        + '<video src="' + esc(c.url) + '" controls playsinline preload="metadata" style="width:100%;border-radius:8px;background:#000;display:block"></video>'
        + '<div style="display:flex;align-items:center;gap:6px;margin-top:7px"><div style="flex:1;min-width:0">'
        + '<div style="font-weight:700;font-size:13.5px">' + esc(c.exercise || c.name) + '</div>'
        + '<div style="font-size:11.5px;color:var(--mut,#9A8A7C)">' + esc(c.at || '') + (c.src ? ' · ' + esc(c.src) : '') + '</div></div>'
        + '<button onclick="EBAnim.clipDelete(' + i + ')" style="font:inherit;font-size:12px;padding:5px 10px;border-radius:8px;cursor:pointer;'
        + 'background:transparent;border:1px solid var(--line,#47372A);color:var(--mut,#9A8A7C)">מחיקה</button></div></div>';
    });
    return h + '</div></div>';
  }
  async function clipDelete(i) {
    var list = clips(), c = list[i]; if (!c) return;
    if (!confirm('למחוק את הסרטון "' + (c.exercise || c.name) + '"?')) return;
    list = list.slice(); list.splice(i, 1);
    try { await clipsSave(list); } catch (e) { alert('המחיקה לא נשמרה — בדקו את החיבור ונסו שוב.'); return; }
    try { if (c.path) await EBSync.client().storage.from('videos').remove([c.path]); } catch (e) {}
    var box = document.querySelector('[data-animclips]');
    if (box) box.innerHTML = clipsInner();
  }
  /* חלון הספרייה בדף המתאמן */
  function openLibrary() {
    closeLibrary();
    var ov = document.createElement('div');
    ov.id = 'ebAnimLib';
    ov.style.cssText = 'position:fixed;inset:0;z-index:250;background:rgba(10,7,5,.72);display:flex;align-items:flex-end;justify-content:center';
    ov.innerHTML = '<div role="dialog" aria-modal="true" style="width:min(760px,100%);height:min(92vh,100%);overflow:auto;background:#241B14;'
      + 'border:1px solid #47372A;border-radius:18px 18px 0 0;padding:16px 14px 28px;color:#F2E9DD;direction:rtl;-webkit-overflow-scrolling:touch">'
      + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px"><div style="flex:1">'
      + '<div style="font-weight:800;font-size:20px">ספריית הדמיות</div>'
      + '<div style="font-size:12px;color:#B8A898">לחיצה על תרגיל פותחת אותו בגדול, עם השרירים שעובדים</div></div>'
      + '<button aria-label="סגירה" onclick="EBAnim.closeLibrary()" style="width:36px;height:36px;border-radius:50%;border:1px solid #47372A;'
      + 'background:transparent;color:#F2E9DD;font-size:20px;cursor:pointer">×</button></div>'
      + '<div data-animlib>' + libInner() + '</div></div>';
    ov.addEventListener('click', function (e) { if (e.target === ov) closeLibrary(); });
    document.body.appendChild(ov);
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', escKey);
    mountAll(ov);
  }
  function closeLibrary() {
    var m = document.getElementById('ebAnimLib'); if (!m) return;
    m.remove();
    if (!document.getElementById('categoryModal') && !document.getElementById('exModal')) document.body.style.overflow = '';
  }
  function chip(k, t) {
    var on = LM === k;
    return '<button onclick="EBAnim.muscle(\'' + k + '\')" style="font:inherit;font-size:12.5px;padding:5px 11px;border-radius:20px;cursor:pointer;'
      + 'border:1px solid ' + (on ? 'var(--or,#C49A6C)' : 'var(--line,#47372A)') + ';background:' + (on ? 'var(--or,#C49A6C)' : 'transparent') + ';'
      + 'color:' + (on ? '#221A12' : 'inherit') + '">' + esc(t) + '</button>';
  }
  function regrid(withChips) {
    document.querySelectorAll('[data-animlib]').forEach(function (box) {
      var g = box.querySelector('[data-animgrid]'); if (g) { g.innerHTML = libGrid(); mountAll(g); }
      var ch = box.querySelector('[data-animchips]'); if (ch && withChips) ch.innerHTML = chips();
    });
  }
  function search(q) { LQ = q; LLIM = 48; regrid(); }
  function muscle(m) { LM = m; LLIM = 48; regrid(true); }
  function more() { LLIM += 48; regrid(); }

  window.EBAnim = { classify: classify, mount: mount, mountAll: mountAll, has: has, label: label,
                    open: open, close: close, view: libView, search: search, muscle: muscle, more: more,
                    openLibrary: openLibrary, closeLibrary: closeLibrary, muscles: muscles, MUSCLES: MUS_HE, clipDelete: clipDelete, clipsLoad: clipsLoad, clipsSave: clipsSave, clips: clips,
                    PATTERNS: P, _frame: frame, _build: build, _draw: draw };
})();

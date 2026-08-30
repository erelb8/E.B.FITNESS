/* =====================================================================
   E.B FIT — בניית תוכנית אימון
   ---------------------------------------------------------------------
   מנוע מקומי. בלי שרת, בלי מפתח API, בלי עלות, ועובד אופליין.

   העיקרון: לא מייצר תוכנית גנרית. קודם סורק את התוכניות שהמאמן כבר
   כתב — אילו תרגילים הוא בוחר, כמה סטים וחזרות הוא נותן, כמה מנוחה —
   ומעדיף את הבחירות שלו על ברירות המחדל. ככל שייכתבו עוד תוכניות,
   התוצאה תדמה יותר לסגנון שלו.

   מה שנבנה הוא טיוטה. המאמן רואה אותה, עורך, ורק אז מחיל.
   ===================================================================== */
(function () {
  'use strict';

  // חותמת גרסה — index.html משווה אליה כדי לזהות קובץ ישן במטמון
  (window.EB_MOD = window.EB_MOD || {})['builder'] = 'v32';

  /* ---------- דפוסי תנועה ----------
     החלוקה לפי דפוס ולא לפי שריר, כי כך בונים פיצולים מאוזנים
     ומחליפים תרגיל בתרגיל שקול כשיש מגבלה. */
  var P = {
    HPUSH: 'דחיפה אופקית', VPUSH: 'דחיפה אנכית',
    HPULL: 'משיכה אופקית', VPULL: 'משיכה אנכית',
    SQUAT: 'ברך',          HINGE: 'ירך',
    CORE : 'ליבה',         ARMS : 'ידיים',
    SHLD : 'כתפיים',       CARDIO:'אירובי'
  };

  /* eq: gym=חדר כושר מאובזר, home=ציוד ביתי/משקל גוף, park=פארק
     bad: מגבלות שהתרגיל בעייתי עבורן */
  var LIB = [
    // דחיפה אופקית
    { n:'לחיצת חזה במוט',        p:P.HPUSH, eq:['gym'],               lvl:2, bad:['כתף'] },
    { n:'לחיצת חזה בשיפוע חיובי',p:P.HPUSH, eq:['gym'],               lvl:2, bad:['כתף'] },
    { n:'לחיצת חזה בדמבלים',     p:P.HPUSH, eq:['gym','home'],        lvl:1, bad:[] },
    { n:'לחיצת חזה במכונה',      p:P.HPUSH, eq:['gym'],               lvl:1, bad:[] },
    { n:'שכיבות סמיכה',          p:P.HPUSH, eq:['gym','home','park'], lvl:1, bad:['שורש כף יד'] },
    { n:'מקבילים',               p:P.HPUSH, eq:['gym','park'],        lvl:3, bad:['כתף'] },
    { n:'פרפר בכבלים',           p:P.HPUSH, eq:['gym'],               lvl:2, bad:['כתף'] },

    // דחיפה אנכית
    { n:'לחיצת כתפיים בדמבלים',  p:P.VPUSH, eq:['gym','home'],        lvl:1, bad:['כתף'] },
    { n:'לחיצת כתפיים במוט',     p:P.VPUSH, eq:['gym'],               lvl:2, bad:['כתף'] },
    { n:'לחיצת כתפיים במכונה',   p:P.VPUSH, eq:['gym'],               lvl:1, bad:[] },

    // משיכה אופקית
    { n:'חתירה בכבל',            p:P.HPULL, eq:['gym'],               lvl:1, bad:[] },
    { n:'חתירה במוט',            p:P.HPULL, eq:['gym'],               lvl:2, bad:['גב'] },
    { n:'חתירה בדמבל יד אחת',    p:P.HPULL, eq:['gym','home'],        lvl:1, bad:[] },
    { n:'חתירה במכונה',          p:P.HPULL, eq:['gym'],               lvl:1, bad:[] },
    { n:'חתירה בגומייה',         p:P.HPULL, eq:['home','park'],       lvl:1, bad:[] },

    // משיכה אנכית
    { n:'מתח',                   p:P.VPULL, eq:['gym','park'],        lvl:3, bad:['כתף'] },
    { n:'מתח בסיוע מכונה',       p:P.VPULL, eq:['gym'],               lvl:1, bad:[] },
    { n:'פולי עליון',            p:P.VPULL, eq:['gym'],               lvl:1, bad:[] },

    // ברך
    { n:'סקוואט',                p:P.SQUAT, eq:['gym'],               lvl:2, bad:['ברך','גב'] },
    { n:'סקוואט גובלט',          p:P.SQUAT, eq:['gym','home'],        lvl:1, bad:['ברך'] },
    { n:'לחיצת רגליים',          p:P.SQUAT, eq:['gym'],               lvl:1, bad:[] },
    { n:'מכרעים',                p:P.SQUAT, eq:['gym','home','park'], lvl:2, bad:['ברך'] },
    { n:'מכרעים בולגריים',       p:P.SQUAT, eq:['gym','home'],        lvl:3, bad:['ברך'] },
    { n:'פשיטת ברך במכונה',      p:P.SQUAT, eq:['gym'],               lvl:1, bad:['ברך'] },
    { n:'עלייה על ספסל',         p:P.SQUAT, eq:['gym','home','park'], lvl:1, bad:['ברך'] },

    // ירך
    { n:'דדליפט',               p:P.HINGE, eq:['gym'],               lvl:3, bad:['גב'] },
    { n:'דדליפט רומני',         p:P.HINGE, eq:['gym'],               lvl:2, bad:['גב'] },
    { n:'כפיפת ברכיים במכונה',  p:P.HINGE, eq:['gym'],               lvl:1, bad:[] },
    { n:'היפ ת׳רסט',            p:P.HINGE, eq:['gym','home'],        lvl:1, bad:[] },
    { n:'גשר ירכיים',           p:P.HINGE, eq:['gym','home','park'], lvl:1, bad:[] },

    // כתפיים מבודד
    { n:'הרחקות צד בדמבלים',    p:P.SHLD,  eq:['gym','home'],        lvl:1, bad:[] },
    { n:'הרחקות אחוריות',       p:P.SHLD,  eq:['gym','home'],        lvl:1, bad:[] },
    { n:'פייס פול',             p:P.SHLD,  eq:['gym'],               lvl:1, bad:[] },

    // ידיים
    { n:'כפיפת מרפקים בדמבלים', p:P.ARMS,  eq:['gym','home'],        lvl:1, bad:[] },
    { n:'כפיפת מרפקים במוט',    p:P.ARMS,  eq:['gym'],               lvl:1, bad:[] },
    { n:'פשיטת מרפקים בכבל',    p:P.ARMS,  eq:['gym'],               lvl:1, bad:[] },
    { n:'לחיצה צרה',            p:P.ARMS,  eq:['gym'],               lvl:2, bad:['כתף'] },

    // ליבה
    { n:'פלאנק',                p:P.CORE,  eq:['gym','home','park'], lvl:1, bad:[] },
    { n:'פלאנק צד',             p:P.CORE,  eq:['gym','home','park'], lvl:1, bad:[] },
    { n:'הרמות רגליים בתלייה',  p:P.CORE,  eq:['gym','park'],        lvl:3, bad:['כתף'] },
    { n:'כפיפות בטן',           p:P.CORE,  eq:['gym','home','park'], lvl:1, bad:['גב'] },
    { n:'דד באג',               p:P.CORE,  eq:['gym','home'],        lvl:1, bad:[] },
    { n:'עץ פלאנק עם משיכה',    p:P.CORE,  eq:['gym','home'],        lvl:2, bad:[] },

    // אירובי
    { n:'הליכה בשיפוע',         p:P.CARDIO,eq:['gym'],               lvl:1, bad:[] },
    { n:'אופני כושר',           p:P.CARDIO,eq:['gym','home'],        lvl:1, bad:[] },
    { n:'חבל קפיצה',            p:P.CARDIO,eq:['gym','home','park'], lvl:1, bad:['ברך'] },
    { n:'אינטרוולים בהליכון',   p:P.CARDIO,eq:['gym'],               lvl:2, bad:['ברך'] }
  ];

  /* ---------- פיצולים לפי ימים בשבוע ---------- */
  var SPLITS = {
    2: [ { t:'גוף מלא A', pat:[P.SQUAT,P.HPUSH,P.HPULL,P.HINGE,P.CORE] },
         { t:'גוף מלא B', pat:[P.HINGE,P.VPULL,P.VPUSH,P.SQUAT,P.CORE] } ],

    3: [ { t:'דחיפה',  pat:[P.HPUSH,P.VPUSH,P.HPUSH,P.SHLD,P.ARMS] },
         { t:'משיכה',  pat:[P.VPULL,P.HPULL,P.HPULL,P.SHLD,P.ARMS] },
         { t:'רגליים', pat:[P.SQUAT,P.HINGE,P.SQUAT,P.HINGE,P.CORE] } ],

    4: [ { t:'פלג גוף עליון A', pat:[P.HPUSH,P.HPULL,P.VPUSH,P.VPULL,P.ARMS] },
         { t:'פלג גוף תחתון A', pat:[P.SQUAT,P.HINGE,P.SQUAT,P.CORE] },
         { t:'פלג גוף עליון B', pat:[P.VPUSH,P.VPULL,P.HPUSH,P.SHLD,P.ARMS] },
         { t:'פלג גוף תחתון B', pat:[P.HINGE,P.SQUAT,P.HINGE,P.CORE] } ],

    5: [ { t:'חזה וכתפיים', pat:[P.HPUSH,P.HPUSH,P.VPUSH,P.SHLD] },
         { t:'גב',          pat:[P.VPULL,P.HPULL,P.HPULL,P.SHLD] },
         { t:'רגליים A',    pat:[P.SQUAT,P.HINGE,P.SQUAT,P.CORE] },
         { t:'ידיים וליבה', pat:[P.ARMS,P.ARMS,P.CORE,P.CORE] },
         { t:'רגליים B',    pat:[P.HINGE,P.SQUAT,P.HINGE,P.CORE] } ]
  };

  /* ---------- מטרה -> סטים, חזרות ומנוחה ---------- */
  var GOALS = {
    mass:  { t:'מסת שריר',        sets:4, reps:'8-12', rest:90,  cardio:0 },
    cut:   { t:'חיטוב וירידה',    sets:3, reps:'12-15', rest:60,  cardio:1 },
    power: { t:'כוח',             sets:5, reps:'3-6',  rest:150, cardio:0 },
    fit:   { t:'כושר כללי',       sets:3, reps:'10-12', rest:60,  cardio:1 }
  };
  function guessGoal(txt) {
    var s = String(txt || '');
    if (/מסה|מסת שריר|היפרטרופ|לעלות/.test(s)) return 'mass';
    if (/חיטוב|ירידה|לרזות|שומן|להחטיב/.test(s)) return 'cut';
    if (/כוח|מתפרץ|פאוור/.test(s))               return 'power';
    return 'fit';
  }
  var LVL = { 'מתחיל':1, 'בינוני':2, 'מתקדם':3 };

  /* =====================================================================
     לימוד מהתוכניות הקיימות של המאמן
     ===================================================================== */
  function learn() {
    var out = { uses: {}, sets: [], reps: {}, rest: [], names: {}, programs: 0 };

    (window.S.trainees || []).forEach(function (t) {
      var days = (t.program && t.program.days) || [];
      if (!days.length) return;
      out.programs++;
      days.forEach(function (d) {
        (d.exercises || []).forEach(function (e) {
          var n = String(e.name || '').trim();
          if (!n) return;
          out.uses[n] = (out.uses[n] || 0) + 1;
          out.names[n.replace(/\s+/g, '')] = n;      // לזיהוי כתיב שונה
          var s = parseFloat(e.sets); if (s > 0 && s < 12) out.sets.push(s);
          var r = parseFloat(e.rest); if (r > 0 && r < 400) out.rest.push(r);
          if (e.reps) out.reps[e.reps] = (out.reps[e.reps] || 0) + 1;
        });
      });
    });
    return out;
  }
  function median(a) {
    if (!a.length) return null;
    var s = a.slice().sort(function (x, y) { return x - y; });
    return s[Math.floor(s.length / 2)];
  }
  function topKey(o) {
    var best = null, n = 0;
    for (var k in o) if (o[k] > n) { n = o[k]; best = k; }
    return best;
  }

  /* =====================================================================
     בניית התוכנית
     ===================================================================== */
  function build(opt) {
    var g    = GOALS[opt.goal] || GOALS.fit;
    var lvl  = LVL[opt.level] || 1;
    var days = SPLITS[opt.days] || SPLITS[3];
    var L    = learn();

    // ברירות המחדל של המאמן מנצחות את שלי
    var mySets = median(L.sets);
    var myRest = median(L.rest);
    var myReps = topKey(L.reps);
    var sets = mySets || g.sets;
    var rest = myRest || g.rest;
    var reps = (L.programs >= 2 && myReps) ? myReps : g.reps;

    var bad  = opt.limits || [];
    var eq   = opt.eq || 'gym';
    var used = {};                       // בלי לחזור על אותו תרגיל בתוכנית

    function pick(pattern) {
      var pool = LIB.filter(function (x) {
        if (x.p !== pattern) return false;
        if (used[x.n]) return false;
        if (x.eq.indexOf(eq) < 0) return false;
        if (x.lvl > lvl + (lvl === 1 ? 0 : 1)) return false;   // לא לזרוק מתחיל למתקדם
        for (var i = 0; i < bad.length; i++)
          if (x.bad.indexOf(bad[i]) > -1) return false;
        return true;
      });
      if (!pool.length) return null;

      // דירוג: תרגילים שהמאמן כבר משתמש בהם עולים לראש
      pool.sort(function (a, b) {
        var ua = L.uses[a.n] || 0, ub = L.uses[b.n] || 0;
        if (ua !== ub) return ub - ua;
        return Math.abs(a.lvl - lvl) - Math.abs(b.lvl - lvl);
      });
      /* אם יש בדפוס הזה תרגילים שהמאמן באמת משתמש בהם — בוחרים מתוכם
         בלבד. אחרת הבחירה האקראית הייתה מדללת את הסגנון שלו וממלאת
         את התוכנית בתרגילים שהוא לא נותן. רק כשאין לו כאלה, נפתחים
         לשלושת המובילים כדי שתהיה גם קצת שונות בין תוכניות. */
      var mine = pool.filter(function (x) { return (L.uses[x.n] || 0) > 0; });
      var head = mine.length ? mine.slice(0, 2) : pool.slice(0, 3);
      var chosen = head[Math.floor(Math.random() * head.length)];
      used[chosen.n] = 1;
      return chosen;
    }

    var outDays = days.map(function (d) {
      var ex = [];
      d.pat.forEach(function (pat) {
        var x = pick(pat);
        if (!x) return;
        var isCore = x.p === P.CORE, isArm = x.p === P.ARMS || x.p === P.SHLD;
        ex.push({
          name  : x.n,
          sets  : String(isCore ? Math.max(2, sets - 1) : sets),
          reps  : isCore ? '30-45 שנ׳' : (isArm ? bumpReps(reps) : reps),
          weight: '',
          rest  : String(isCore ? Math.min(45, rest) : (isArm ? Math.max(45, rest - 30) : rest)),
          note  : ''
        });
      });
      // אירובי בסוף, למטרות שמצדיקות אותו
      if (g.cardio) {
        var c = pick(P.CARDIO);
        if (c) ex.push({ name:c.n, sets:'1', reps:'12-20 דק׳', weight:'', rest:'0', note:'בסוף האימון' });
      }
      return { name: d.t, exercises: ex };
    });

    return {
      days: outDays,
      meta: {
        goal: g.t, level: opt.level, eq: eq, limits: bad,
        learned: L.programs, sets: sets, reps: reps, rest: rest,
        usedMine: !!(mySets || myRest)
      }
    };
  }
  // תרגילי בידוד מקבלים טווח חזרות גבוה יותר
  function bumpReps(r) {
    var m = String(r).match(/(\d+)\s*-\s*(\d+)/);
    if (!m) return r;
    return (Number(m[1]) + 2) + '-' + (Number(m[2]) + 3);
  }

  /* =====================================================================
     ממשק
     ===================================================================== */
  var DRAFT = null, FOR = null;

  function open(traineeId) {
    var t = tById(traineeId); if (!t) return;
    FOR = traineeId;

    var ik   = (t.intake && t.intake.answers) || {};
    var days = Number(ik.daysPerWeek) || 3;
    if (days < 2) days = 2; if (days > 5) days = 5;

    var loc  = String(ik.location || '');
    var eq   = /בית|ביתי/.test(loc) ? 'home' : /פארק|חוץ/.test(loc) ? 'park' : 'gym';

    var goal = guessGoal(t.goal || ik.goal2 || '');
    var lvl  = t.level || 'מתחיל';

    // מגבלות מזוהות מהצהרת הבריאות ומהשאלון
    var src = [t.health || '', ik.injuries || '', t.notes || ''].join(' ');
    var lim = ['כתף','ברך','גב','שורש כף יד'].filter(function (w) { return src.indexOf(w) > -1; });

    var L = learn();

    openModal(
      '<div class="mh"><h3>בניית תוכנית ל' + esc(t.name) + '</h3>'
      + '<button class="iconbtn" onclick="closeModal()">✕</button></div><div class="mb">'
      + (L.programs
          ? '<p class="muted" style="font-size:13px;margin:0 0 12px">הבוט למד מ-<b style="color:var(--or)">'
            + L.programs + '</b> תוכניות שכתבת, ויעדיף את התרגילים והמספרים שאתה נותן בפועל.</p>'
          : '<p class="muted" style="font-size:13px;margin:0 0 12px">זו התוכנית הראשונה, אז הבוט משתמש בברירות מחדל. '
            + 'ככל שתכתוב עוד — הוא ילמד את הסגנון שלך.</p>')
      + '<div class="grid g2">'
      + sel('ימים בשבוע','bd_days',[['2','2'],['3','3'],['4','4'],['5','5']], String(days))
      + sel('מטרה','bd_goal',[['mass','מסת שריר'],['cut','חיטוב וירידה'],['power','כוח'],['fit','כושר כללי']], goal)
      + sel('רמה','bd_lvl',['מתחיל','בינוני','מתקדם'], lvl)
      + sel('מיקום','bd_eq',[['gym','חדר כושר מאובזר'],['home','אימון ביתי'],['park','פארק / משקל גוף']], eq)
      + '</div>'
      + '<div class="sep"></div><label class="f">מגבלות — תרגילים שמעמיסים עליהן יוסרו</label>'
      + '<div class="row" style="margin-top:6px">'
      + ['כתף','ברך','גב','שורש כף יד'].map(function (w) {
          return '<label style="font-size:13.5px;display:flex;align-items:center;gap:6px">'
            + '<input type="checkbox" id="bd_l_' + w.replace(/\s/g,'_') + '" '
            + (lim.indexOf(w) > -1 ? 'checked' : '') + '>' + w + '</label>';
        }).join('')
      + '</div>'
      + (lim.length ? '<div class="muted" style="font-size:12px;margin-top:8px">סומן אוטומטית לפי הצהרת הבריאות והשאלון.</div>' : '')
      + '</div><div class="mf"><button class="btn" onclick="EBBuild.gen()">בניית טיוטה</button>'
      + '<button class="btn ghost" onclick="closeModal()">ביטול</button></div>', true);
  }

  function readOpts() {
    var lim = ['כתף','ברך','גב','שורש כף יד'].filter(function (w) {
      var el = document.getElementById('bd_l_' + w.replace(/\s/g,'_'));
      return el && el.checked;
    });
    return {
      days: Number(gv('bd_days')) || 3,
      goal: gv('bd_goal'),
      level: gv('bd_lvl'),
      eq: gv('bd_eq'),
      limits: lim
    };
  }

  function gen() {
    var opt = readOpts();
    DRAFT = build(opt);
    preview(opt);
  }

  function preview(opt) {
    var t = tById(FOR);
    var m = DRAFT.meta;
    var total = DRAFT.days.reduce(function (a, d) { return a + d.exercises.length; }, 0);

    var h = '<div class="mh"><h3>טיוטה ל' + esc(t.name) + '</h3>'
      + '<button class="iconbtn" onclick="closeModal()">✕</button></div><div class="mb">';

    h += '<div class="row" style="margin-bottom:12px;gap:8px;flex-wrap:wrap">'
      + pill(m.goal) + pill(DRAFT.days.length + ' ימים') + pill(total + ' תרגילים')
      + pill(m.sets + ' סטים · ' + m.reps) + pill('מנוחה ' + m.rest + ' שנ׳')
      + (m.limits.length ? pill('בלי: ' + m.limits.join(', '), 1) : '')
      + '</div>';

    if (m.usedMine)
      h += '<div class="muted" style="font-size:12.5px;margin-bottom:12px">'
         + 'הסטים והמנוחה נלקחו מהתוכניות שלך, לא מברירת מחדל.</div>';

    DRAFT.days.forEach(function (d, i) {
      h += '<div class="card" style="margin-bottom:10px;padding:12px">'
        + '<div style="font-family:Rubik;font-weight:700;margin-bottom:8px">' + esc(d.name) + '</div>';
      d.exercises.forEach(function (e) {
        h += '<div class="line-item" style="padding:5px 0">'
          + '<span style="flex:1;font-size:14px">' + esc(e.name) + '</span>'
          + '<span class="muted" style="font-size:12.5px">' + esc(e.sets) + '×' + esc(e.reps) + '</span>'
          + '<span class="muted" style="font-size:12px;width:56px;text-align:left">' + esc(e.rest) + ' שנ׳</span>'
          + '</div>';
      });
      h += '</div>';
    });

    var has = ((t.program && t.program.days) || []).length;
    h += '</div><div class="mf">'
      + '<button class="btn" onclick="EBBuild.apply(0)">' + (has ? 'החלפת התוכנית' : 'החלת התוכנית') + '</button>'
      + (has ? '<button class="btn ghost" onclick="EBBuild.apply(1)">הוספה לקיימת</button>' : '')
      + '<button class="btn ghost" onclick="EBBuild.gen()">גרסה אחרת</button>'
      + '<div style="flex:1"></div><button class="btn ghost" onclick="closeModal()">ביטול</button></div>';
    openModal(h, true);
  }
  function pill(txt, warn) {
    return '<span style="font-size:12px;padding:4px 10px;border-radius:20px;'
      + 'background:' + (warn ? 'rgba(255,93,93,.12)' : 'var(--or-soft)') + ';'
      + 'color:' + (warn ? 'var(--bad)' : 'var(--or)') + '">' + esc(txt) + '</span>';
  }

  function apply(append) {
    var t = tById(FOR); if (!t || !DRAFT) return;
    if (!append && ((t.program && t.program.days) || []).length &&
        !confirm('להחליף את התוכנית הקיימת? השינוי לא הפיך.')) return;

    t.program = t.program || { days: [] };
    t.program.days = append ? t.program.days.concat(DRAFT.days) : DRAFT.days.slice();

    save(); closeModal();
    SUBTAB = 'program'; render();
    toast('התוכנית נבנתה — אפשר לערוך כל שדה');
  }

  window.EBBuild = { open: open, gen: gen, apply: apply, build: build, learn: learn };
})();

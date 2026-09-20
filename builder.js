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
  (window.EB_MOD = window.EB_MOD || {})['builder'] = 'v182';

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
    { n:'לחיצת חזה בשיפוע במוט',p:P.HPUSH, eq:['gym'],               lvl:2, bad:['כתף'] },
    { n:'לחיצת חזה במשקולות',     p:P.HPUSH, eq:['gym','home'],        lvl:1, bad:[] },
    { n:'לחיצת חזה במכונה',      p:P.HPUSH, eq:['gym'],               lvl:1, bad:[] },
    { n:'שכיבות סמיכה',          p:P.HPUSH, eq:['gym','home','park'], lvl:1, bad:['שורש כף יד'] },
    { n:'מקבילים לחזה',               p:P.HPUSH, eq:['gym','park'],        lvl:3, bad:['כתף'] },
    { n:'פרפר בכבלים אמצעי',           p:P.HPUSH, eq:['gym'],               lvl:2, bad:['כתף'] },

    // דחיפה אנכית
    { n:'לחיצת כתפיים במשקולות',  p:P.VPUSH, eq:['gym','home'],        lvl:1, bad:['כתף'] },
    { n:'לחיצת כתפיים במוט בעמידה',     p:P.VPUSH, eq:['gym'],               lvl:2, bad:['כתף'] },
    { n:'לחיצת כתפיים במכונה',   p:P.VPUSH, eq:['gym'],               lvl:1, bad:[] },

    // משיכה אופקית
    { n:'חתירה בפולי תחתון',            p:P.HPULL, eq:['gym'],               lvl:1, bad:[] },
    { n:'חתירה במוט בהטיה',            p:P.HPULL, eq:['gym'],               lvl:2, bad:['גב'] },
    { n:'חתירה במשקולת יד אחת',    p:P.HPULL, eq:['gym','home'],        lvl:1, bad:[] },
    { n:'חתירה במכונה',          p:P.HPULL, eq:['gym'],               lvl:1, bad:[] },
    { n:'חתירה עם גומייה בישיבה',         p:P.HPULL, eq:['home','park'],       lvl:1, bad:[] },

    // משיכה אנכית
    { n:'מתח אחיזה רחבה',                   p:P.VPULL, eq:['gym','park'],        lvl:3, bad:['כתף'] },
    { n:'מתח במכונת סיוע',       p:P.VPULL, eq:['gym'],               lvl:1, bad:[] },
    { n:'משיכת פולי עליון',            p:P.VPULL, eq:['gym'],               lvl:1, bad:[] },

    // ברך
    { n:'סקוואט גבי',                p:P.SQUAT, eq:['gym'],               lvl:2, bad:['ברך','גב'] },
    { n:'גובלט סקוואט',          p:P.SQUAT, eq:['gym','home'],        lvl:1, bad:['ברך'] },
    { n:'לחיצת רגליים',          p:P.SQUAT, eq:['gym'],               lvl:1, bad:[] },
    { n:'לאנג׳ הליכה',                p:P.SQUAT, eq:['gym','home','park'], lvl:2, bad:['ברך'] },
    { n:'סקוואט בולגרי',       p:P.SQUAT, eq:['gym','home'],        lvl:3, bad:['ברך'] },
    { n:'פשיטת ברך',      p:P.SQUAT, eq:['gym'],               lvl:1, bad:['ברך'] },
    { n:'סטפ-אפ',         p:P.SQUAT, eq:['gym','home','park'], lvl:1, bad:['ברך'] },

    // ירך
    { n:'דדליפט קלאסי',               p:P.HINGE, eq:['gym'],               lvl:3, bad:['גב'] },
    { n:'דדליפט רומני',         p:P.HINGE, eq:['gym'],               lvl:2, bad:['גב'] },
    { n:'כפיפת ברך שוכב',  p:P.HINGE, eq:['gym'],               lvl:1, bad:[] },
    { n:'היפ ת׳רסט',            p:P.HINGE, eq:['gym','home'],        lvl:1, bad:[] },
    { n:'גשר עכוז',           p:P.HINGE, eq:['gym','home','park'], lvl:1, bad:[] },
    /* מאגר עכוז רחב יותר. בלעדיו פיצול עם שלושה ימי ירך חזר על
       אותם שניים-שלושה תרגילים, וזה בלט במיוחד בתבנית הנשים. */
    { n:'היפ ת׳רסט במכונה',     p:P.HINGE, eq:['gym'],               lvl:1, bad:[] },
    { n:'דדליפט רומני במשקולות',p:P.HINGE, eq:['gym','home'],        lvl:1, bad:['גב'] },
    { n:'פול-ת׳רו בכבל',        p:P.HINGE, eq:['gym'],               lvl:1, bad:[] },
    { n:'בעיטה לאחור בכבל',     p:P.HINGE, eq:['gym'],               lvl:1, bad:[] },
    { n:'גשר עכוז רגל אחת',     p:P.HINGE, eq:['gym','home','park'], lvl:2, bad:[] },
    { n:'בק אקסטנשן ב-45 מעלות', p:P.HINGE, eq:['gym'],               lvl:1, bad:['גב'] },

    // כתפיים מבודד
    { n:'הרחקות צד במשקולות',    p:P.SHLD,  eq:['gym','home'],        lvl:1, bad:[] },
    { n:'הרחקות בהטיה (כתף אחורית)',       p:P.SHLD,  eq:['gym','home'],        lvl:1, bad:[] },
    { n:'פייס פול',             p:P.SHLD,  eq:['gym'],               lvl:1, bad:[] },

    // ידיים
    { n:'כפיפת מרפקים במשקולות', p:P.ARMS,  eq:['gym','home'],        lvl:1, bad:[] },
    { n:'כפיפת מרפקים במוט',    p:P.ARMS,  eq:['gym'],               lvl:1, bad:[] },
    { n:'פשיטת מרפק בפולי עם חבל',    p:P.ARMS,  eq:['gym'],               lvl:1, bad:[] },
    { n:'לחיצת חזה אחיזה צרה',            p:P.ARMS,  eq:['gym'],               lvl:2, bad:['כתף'] },

    // ליבה
    { n:'פלאנק',                p:P.CORE,  eq:['gym','home','park'], lvl:1, bad:[] },
    { n:'פלאנק צידי',             p:P.CORE,  eq:['gym','home','park'], lvl:1, bad:[] },
    { n:'הרמות רגליים בתלייה',  p:P.CORE,  eq:['gym','park'],        lvl:3, bad:['כתף'] },
    { n:'כפיפות בטן',           p:P.CORE,  eq:['gym','home','park'], lvl:1, bad:['גב'] },
    { n:'דד באג',               p:P.CORE,  eq:['gym','home'],        lvl:1, bad:[] },
    { n:'פלאנק כוכב',    p:P.CORE,  eq:['gym','home'],        lvl:2, bad:[] },
    /* שני תרגילי ליבה בכל אימון דורשים מאגר גדול יותר: בפיצול של
       חמישה ימים צריך עשר בחירות, ובשש בלבד הימים האחרונים נשארו
       ריקים. */
    { n:'גלגלת בטן',            p:P.CORE,  eq:['gym','home'],        lvl:3, bad:['גב'] },
    { n:'כפיפות בטן בכבל',      p:P.CORE,  eq:['gym'],               lvl:2, bad:[] },
    { n:'הליכת חקלאי',          p:P.CORE,  eq:['gym','home'],        lvl:1, bad:[] },
    { n:'פלאנק עם נגיעות כתף',     p:P.CORE,  eq:['gym','home','park'], lvl:2, bad:['כתף'] },
    { n:'סופרמן',               p:P.CORE,  eq:['gym','home','park'], lvl:1, bad:[] },
    { n:'רוסיאן טוויסט',       p:P.CORE,  eq:['gym','home','park'], lvl:2, bad:['גב'] },

    // אירובי
    { n:'הליכון — הליכה בשיפוע',         p:P.CARDIO,eq:['gym'],               lvl:1, bad:[] },
    { n:'אופני כושר',           p:P.CARDIO,eq:['gym','home'],        lvl:1, bad:[] },
    { n:'חבל קפיצה',            p:P.CARDIO,eq:['gym','home','park'], lvl:1, bad:['ברך'] },
    { n:'הליכון — אינטרוולים',   p:P.CARDIO,eq:['gym'],               lvl:2, bad:['ברך'] }
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

  /* ---------- פיצול לפי תבנית הנשים ----------
     אותם דפוסי תנועה, חלוקה אחרת: יותר ימי ירך וברך, ועליון מרוכז
     ליום אחד בפיצולים הקצרים. משמש רק כשתבנית הבית לנשים היא
     ההתייחסות בפועל — ראה build(). */
  var SPLITS_F = {
    2: [ { t:'תחתון וליבה', pat:[P.HINGE,P.SQUAT,P.HINGE,P.CORE,P.CORE] },
         { t:'עליון וליבה', pat:[P.VPULL,P.HPUSH,P.HPULL,P.SHLD,P.CORE] } ],

    3: [ { t:'תחתון — ירך וישבן', pat:[P.HINGE,P.HINGE,P.SQUAT,P.CORE,P.CORE] },
         { t:'עליון',             pat:[P.VPULL,P.HPULL,P.VPUSH,P.HPUSH,P.SHLD,P.ARMS] },
         { t:'תחתון — ברך וליבה', pat:[P.SQUAT,P.SQUAT,P.HINGE,P.CORE,P.CORE] } ],

    4: [ { t:'תחתון A — ירך',  pat:[P.HINGE,P.HINGE,P.SQUAT,P.CORE,P.CORE] },
         { t:'עליון A',        pat:[P.VPULL,P.HPUSH,P.HPULL,P.SHLD,P.ARMS] },
         { t:'תחתון B — ברך',  pat:[P.SQUAT,P.SQUAT,P.HINGE,P.CORE,P.CORE] },
         { t:'עליון B',        pat:[P.HPULL,P.VPUSH,P.VPULL,P.SHLD,P.ARMS] } ],

    5: [ { t:'תחתון A — ירך',   pat:[P.HINGE,P.HINGE,P.SQUAT,P.CORE] },
         { t:'עליון — משיכה',   pat:[P.VPULL,P.HPULL,P.HPULL,P.SHLD] },
         { t:'תחתון B — ברך',   pat:[P.SQUAT,P.SQUAT,P.HINGE,P.CORE] },
         { t:'עליון — דחיפה',   pat:[P.HPUSH,P.VPUSH,P.SHLD,P.ARMS] },
         { t:'ישבן וליבה',      pat:[P.HINGE,P.SQUAT,P.CORE,P.CORE] } ]
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

  /* ---------- תבנית הבית לנשים ----------
     תוכנית דמה מובנית, שמשמשת התייחסות ברירת מחדל למתאמנות כל עוד
     לא נבחרה אחרת. היא נחוצה כי המנוע לומד מהתוכניות הקיימות, וכל
     עוד רובן נכתבו לגברים — מתאמנת ראשונה מקבלת פיצול שנבנה על
     סגנון אחר לגמרי.

     הבהרה מקצועית שחשוב שתישאר כתובה: אין הבדל פיזיולוגי שמחייב
     תרגילים אחרים לנשים. מה שהתבנית מקודדת הוא העדפה — נפח גבוה
     יותר לפלג התחתון ולירך, טווחי חזרות ארוכים ומנוחות קצרות —
     וזו העדפה של המאמן ושל רוב המתאמנות שפונות אליו, לא כלל
     ביולוגי. מתאמנת שרוצה אחרת תקבל אחרת: הבחירה בתפריט גוברת.

     השמות זהים לאלה שב-LIB, אחרת הדירוג לא יזהה אותם. */
  var TEMPLATE_F_ID = '__f__';
  var TEMPLATE_F = {
    name: 'תבנית הבית — נשים',
    days: [
      { name: 'תחתון — דגש ירך וישבן', exercises: [
        { name:'היפ ת׳רסט',          sets:'4', reps:'12-15', rest:'75' },
        { name:'דדליפט רומני',       sets:'3', reps:'12-15', rest:'75' },
        { name:'מכרעים בולגריים',    sets:'3', reps:'12',    rest:'60' },
        { name:'לחיצת רגליים',       sets:'3', reps:'12-15', rest:'60' },
        { name:'גשר ירכיים',         sets:'3', reps:'15',    rest:'45' },
        { name:'פלאנק צד',           sets:'3', reps:'30 שנ׳', rest:'45' }
      ] },
      { name: 'עליון', exercises: [
        { name:'פולי עליון',            sets:'3', reps:'12-15', rest:'75' },
        { name:'חתירה בכבל',            sets:'3', reps:'12-15', rest:'75' },
        { name:'לחיצת כתפיים בדמבלים',  sets:'3', reps:'12',    rest:'60' },
        { name:'לחיצת חזה בדמבלים',     sets:'3', reps:'12',    rest:'60' },
        { name:'הרחקות צד בדמבלים',     sets:'3', reps:'15',    rest:'45' },
        { name:'פשיטת מרפקים בכבל',     sets:'3', reps:'12-15', rest:'45' },
        { name:'דד באג',                sets:'3', reps:'12',    rest:'45' }
      ] },
      { name: 'תחתון וליבה', exercises: [
        { name:'סקוואט גובלט',        sets:'4', reps:'12-15', rest:'75' },
        { name:'דדליפט רומני',        sets:'3', reps:'12',    rest:'75' },
        { name:'עלייה על ספסל',       sets:'3', reps:'12',    rest:'60' },
        { name:'כפיפת ברכיים במכונה', sets:'3', reps:'12-15', rest:'60' },
        { name:'היפ ת׳רסט',           sets:'3', reps:'15',    rest:'60' },
        { name:'כפיפות בטן בכבל',     sets:'3', reps:'15',    rest:'45' },
        { name:'פלאנק',               sets:'3', reps:'40 שנ׳', rest:'45' }
      ] }
    ]
  };

  /* =====================================================================
     לימוד מהתוכניות הקיימות של המאמן
     ===================================================================== */
  /* ---------- תוכנית הבית ----------
     המנוע לומד מכל התוכניות במשקל שווה, ולכן תוכנית אחת מוצלחת
     נבלעת בין עשר בינוניות. כאן אפשר לסמן תוכנית אחת כהתייחסות,
     והיא נספרת כאילו נכתבה WEIGHT פעמים: התרגילים שלה עולים לראש
     הדירוג, והסטים, החזרות והמנוחה שלה מושכים את החציון אליהם.

     זו הטיה מכוונת ולא באג. היא אינה מוחקת את שאר התוכניות — מתאמן
     עם מגבלה עדיין יקבל תרגיל חלופי, כי הסינון קודם לדירוג. */
  var HOUSE_WEIGHT = 6;

  /* המתאמן שעבורו בונים כרגע. נקרא מ-FOR ולא מפרמטר, כי גם open()
     וגם build() רצים אחרי שהוא נקבע. */
  function isFemale() {
    var t = (typeof tById === 'function' && FOR) ? tById(FOR) : null;
    return !!t && t.gender === 'נקבה';
  }
  /* שתי התייחסויות נפרדות: אחת כללית ואחת לנשים. למתאמנת, ברירת
     המחדל כשלא נבחר דבר היא תבנית הבית לנשים ולא "ללא" — זה כל
     הטעם בתבנית. גבר לא מושפע מכלום מזה. */
  function houseId() {
    var st = (window.S && window.S.settings) || {};
    if (isFemale()) {
      return st.refProgramIdF === undefined ? TEMPLATE_F_ID : (st.refProgramIdF || '');
    }
    return st.refProgramId || '';
  }
  function learn() {
    var out = { uses: {}, sets: [], reps: {}, rest: [], names: {}, programs: 0,
                house: null };
    var ref = houseId();

    /* התבנית המובנית אינה מתאמנת ולכן אינה ברשימה — מקפלים אותה
       פנימה בעצמנו, באותו משקל שתוכנית התייחסות אמיתית מקבלת. */
    var pool = (window.S.trainees || []).slice();
    if (ref === TEMPLATE_F_ID) pool.push({ id: TEMPLATE_F_ID, name: TEMPLATE_F.name,
                                           program: { days: TEMPLATE_F.days } });

    pool.forEach(function (t) {
      var days = (t.program && t.program.days) || [];
      if (!days.length) return;
      /* התבנית המובנית אינה נספרת: המונה מוצג כ"תוכניות שכתבת",
         ולספור בו תוכנית שהמאמן לא כתב זו הטעיה. */
      if (t.id !== TEMPLATE_F_ID) out.programs++;
      var w = (ref && t.id === ref) ? HOUSE_WEIGHT : 1;
      if (w > 1) out.house = t.name || '';
      days.forEach(function (d) {
        (d.exercises || []).forEach(function (e) {
          var n = String(e.name || '').trim();
          if (!n) return;
          out.uses[n] = (out.uses[n] || 0) + w;
          out.names[n.replace(/\s+/g, '')] = n;      // לזיהוי כתיב שונה
          var s = parseFloat(e.sets), r = parseFloat(e.rest);
          for (var i = 0; i < w; i++) {
            if (s > 0 && s < 12) out.sets.push(s);
            if (r > 0 && r < 400) out.rest.push(r);
            if (e.reps) out.reps[e.reps] = (out.reps[e.reps] || 0) + 1;
          }
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

  /* מהשם שבבונה לרשומה בספרייה הגדולה. השמות זהים מאז ספטמבר 2026,
     ולכן אפשר לקחת משם את הציוד ואת קבוצת השריר במקום להחזיק אותם
     כאן פעם שנייה. */
  var BY_NAME = null;
  function byName(n) {
    if (!window.EBEx || !window.EBEx.ALL) return null;
    if (!BY_NAME) { BY_NAME = {}; window.EBEx.ALL.forEach(function (x) { BY_NAME[x.n] = x; }); }
    return BY_NAME[String(n || '').trim()] || null;
  }

  /* =====================================================================
     בניית התוכנית
     ===================================================================== */
  function build(opt) {
    var g    = GOALS[opt.goal] || GOALS.fit;
    var lvl  = LVL[opt.level] || 1;
    /* פיצול הנשים נכנס רק כשהתבנית המובנית היא ההתייחסות בפועל.
       בחר המאמן תוכנית אמיתית כהתייחסות — הפיצול הרגיל חוזר, כי אז
       הכוונה היא ללכת אחרי אותה תוכנית ולא אחרי התבנית. */
    var useF = isFemale() && houseId() === TEMPLATE_F_ID;
    var tbl  = useF ? SPLITS_F : SPLITS;
    var days = tbl[opt.days] || tbl[3] || SPLITS[3];
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

    /* מסננים לפי הציוד שבאמת קיים במקום, מתוך הספרייה הגדולה. רשימת
       ה-eq שכאן היא גיבוי בלבד — לתרגיל שאין לו רשומה בספרייה. */
    var FALLBACK = { gym:'gym', cross:'gym', studio:'home', home:'home', pool:'home', box:'park', out:'park' };
    function here(x) {
      var info = byName(x.n);
      if (info && window.EBEx.fitsPlace) return window.EBEx.fitsPlace(info, eq);
      return x.eq.indexOf(FALLBACK[eq] || 'gym') > -1;
    }

    function pick(pattern) {
      var pool = LIB.filter(function (x) {
        if (x.p !== pattern) return false;
        if (used[x.n]) return false;
        if (!here(x)) return false;
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

    /* תרגיל אגרוף מתוך הספרייה הגדולה, מתחלף בין הימים */
    function boxPick(names, i) {
      var n = names[i % names.length], x = byName(n);
      return x ? { n: x.n, s: x.s, r: x.r } : null;
    }

    /* ---------- ליבה בכל אימון ----------
       שניים, בסוף האימון. לא בהתחלה: ליבה עייפה לפני סקוואט או
       דדליפט פוגעת ביציבות העמוד ומעלה סיכון, וזה גם הסדר המקובל.

       הליבה אינה עוברת דרך used הרגיל. מאגר הליבה קטן מסך הבחירות
       הנדרשות בפיצול של חמישה ימים, ולכן חזרה על תרגיל בין ימים
       מותרת — אך לא באותו אימון. זה גם נכון אימונית: ליבה חוזרת
       היא בדיוק מה שמשפר אותה. */
    var coreSeen = {};
    function pickCore(dayUsed) {
      var pool = LIB.filter(function (x) {
        if (x.p !== P.CORE) return false;
        if (dayUsed[x.n]) return false;
        if (!here(x)) return false;
        if (x.lvl > lvl + (lvl === 1 ? 0 : 1)) return false;
        for (var i = 0; i < bad.length; i++)
          if (x.bad.indexOf(bad[i]) > -1) return false;
        return true;
      });
      if (!pool.length) return null;
      /* עדיפות למה שטרם הופיע בתוכנית, ואחר כך למה שהמאמן נותן */
      pool.sort(function (a, b) {
        var sa = coreSeen[a.n] || 0, sb = coreSeen[b.n] || 0;
        if (sa !== sb) return sa - sb;
        return (L.uses[b.n] || 0) - (L.uses[a.n] || 0);
      });
      var head = pool.slice(0, 2);
      var chosen = head[Math.floor(Math.random() * head.length)];
      coreSeen[chosen.n] = (coreSeen[chosen.n] || 0) + 1;
      dayUsed[chosen.n] = 1;
      return chosen;
    }

    var outDays = days.map(function (d, di) {
      var ex = [];
      /* הליבה שבדפוס יוצאת מהלולאה: היא מתווספת בסוף בכמות קבועה,
         ובלי זה היו שלושה תרגילי ליבה בימים שכבר כללו אחד. */
      d.pat.filter(function (pat) { return pat !== P.CORE; }).forEach(function (pat) {
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
      // שני תרגילי ליבה, אחרי עבודת הכוח
      var dayUsed = {};
      for (var ci = 0; ci < 2; ci++) {
        var c2 = pickCore(dayUsed);
        if (!c2) break;
        ex.push({
          name  : c2.n,
          sets  : String(Math.max(2, sets - 1)),
          reps  : '30-45 שנ׳',
          weight: '',
          rest  : String(Math.min(45, rest)),
          note  : ''
        });
      }

      // אירובי בסוף, למטרות שמצדיקות אותו
      if (g.cardio) {
        var c = pick(P.CARDIO);
        if (c) ex.push({ name:c.n, sets:'1', reps:'12-20 דק׳', weight:'', rest:'0', note:'בסוף האימון' });
      }
      /* במכון אגרוף הכוח הוא חצי מהעניין. סיבוב חימום בהתחלה
         ועבודת שק בסוף — אחרת זו תוכנית כושר שנכתבה במקרה במכון. */
      if (eq === 'box') {
        var warm = boxPick(['חבל קפיצה — סיבובים', 'עבודת צל (שדו-בוקסינג)'], di);
        var bag  = boxPick(['שק — ג׳אב-קרוס (1-2)', 'שק — קומבינציה חופשית',
                            'שק — 30 שניות פיצוץ', 'שק — 1-2-3 (ג׳אב, קרוס, הוק)'], di);
        if (warm) ex.unshift({ name: warm.n, sets: warm.s, reps: warm.r, weight: '', rest: '60', note: 'חימום' });
        if (bag)  ex.push({ name: bag.n, sets: bag.s, reps: bag.r, weight: '', rest: '60', note: 'בסוף האימון' });
      }
      return { name: d.t, place: eq, exercises: ex };
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

  /* המקומות שהבונה באמת יכול לשרת. בבריכה אין לו אף תרגיל,
     והצעה שלה הייתה מחזירה תוכנית ריקה. הסף הוא 15 תרגילים —
     מתחת לזה הפיצול חוזר על עצמו. */
  function placeOpts() {
    if (!window.EBEx || !window.EBEx.PLACES) return [['gym', 'חדר כושר'], ['home', 'בית']];
    return window.EBEx.PLACES.filter(function (pl) {
      if (!pl.eq) return true;
      var n = 0;
      LIB.forEach(function (x) {
        var info = byName(x.n);
        if (info && window.EBEx.fitsPlace(info, pl.k)) n++;
      });
      return n >= 15;
    }).map(function (pl) { return [pl.k, pl.i + ' ' + pl.n]; });
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
    var eq   = /בית|ביתי/.test(loc) ? 'home'
             : /פארק|חוץ/.test(loc) ? 'out'
             : /סטודיו/.test(loc)   ? 'studio'
             : /אגרוף|בוקס/.test(loc) ? 'box'
             : /קרוספיט/.test(loc)  ? 'cross'
             : /בריכ|שחי/.test(loc) ? 'pool' : 'gym';

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
      + sel('מקום האימון','bd_eq', placeOpts(), eq)
      + '</div>'
      + houseSelect(traineeId)
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


  /* בוחר תוכנית ההתייחסות. נשמר בהגדרות ולא בתוכנית, כי הוא חל על
     כל בנייה עתידית ולא על מתאמן מסוים. */
  function houseSelect(skipId) {
    var fem = isFemale();
    var opts = (window.S.trainees || []).filter(function (t) {
      return t.id !== skipId && !t.deleted
          && ((t.program || {}).days || []).some(function (d) {
               return ((d.exercises || []).length);
             });
    });
    /* למתאמנת התפריט מוצג גם בלי אף תוכנית קיימת — התבנית המובנית
       לבדה כבר נותנת ממה לבחור. */
    if (!opts.length && !fem) return '';
    var cur = houseId();
    return '<div style="margin:12px 0 4px">'
      + '<label class="f" style="display:block;margin-bottom:4px">תוכנית התייחסות</label>'
      + '<select class="f" id="bd_house" style="width:100%" '
      + 'onchange="EBBuild.setHouse(this.value)">'
      + (fem ? '<option value="' + TEMPLATE_F_ID + '"'
             + (cur === TEMPLATE_F_ID ? ' selected' : '') + '>'
             + esc(TEMPLATE_F.name) + ' (ברירת מחדל)</option>' : '')
      + '<option value=""' + (cur === '' ? ' selected' : '') + '>'
      + 'ללא — ללמוד מכל התוכניות באותו משקל</option>'
      + opts.map(function (t) {
          return '<option value="' + esc(t.id) + '"' + (t.id === cur ? ' selected' : '') + '>'
               + esc(t.name || 'ללא שם') + '</option>';
        }).join('')
      + '</select>'
      + '<div class="muted" style="font-size:11.5px;margin-top:5px;line-height:1.6">'
      + 'התוכנית שנבחרה תשפיע פי ' + HOUSE_WEIGHT + ' משאר התוכניות — התרגילים שלה '
      + 'יעלו לראש, והסטים והחזרות שלה יקבעו את ברירת המחדל. '
      + (fem ? 'הבחירה כאן נשמרת למתאמנות בלבד ואינה משנה את הבנייה לגברים.'
             : 'הבחירה נשמרת לכל הבניות הבאות.')
      + '</div></div>';
  }
  function setHouse(id) {
    window.S.settings = window.S.settings || {};
    /* שתי הגדרות נפרדות, אחרת בחירה למתאמנת הייתה דורסת את
       ההתייחסות של כל השאר. */
    if (isFemale()) window.S.settings.refProgramIdF = id || '';
    else            window.S.settings.refProgramId  = id || '';
    if (typeof save === 'function') save();
    if (FOR) { closeModal(); open(FOR); }
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
        + '<div style="font-family:Heebo;font-weight:700;margin-bottom:8px">' + esc(d.name) + '</div>';
      d.exercises.forEach(function (e, j) {
        h += '<div class="line-item" style="padding:5px 0">'
          + '<span style="flex:1;font-size:14px">' + esc(e.name) + '</span>'
          + '<span class="muted" style="font-size:12.5px">' + esc(e.sets) + '×' + esc(e.reps) + '</span>'
          + (e.weight ? '<span class="muted" style="font-size:12px">' + esc(e.weight) + '</span>' : '')
          + '<span class="muted" style="font-size:12px;width:56px;text-align:left">' + esc(e.rest) + ' שנ׳</span>'
          + '<button class="iconbtn" style="width:24px;height:24px;font-size:12px" '
          + 'onclick="EBBuild.drop(' + i + ',' + j + ')">✕</button>'
          + '</div>';
      });
      /* הוספה לטיוטה ולא לתוכנית: הבחירה בין החלפה להוספה עדיין
         לפני המאמן, וזו הנקודה שבה הוא מכוונן את מה שהבוט הציע. */
      h += '<button class="btn sm ghost" style="margin-top:8px" '
        + 'onclick="EBBuild.fromLib(' + i + ')">📚 הוספה מהספרייה</button>'
        + '</div>';
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

  /* פתיחת הספרייה על יום בטיוטה. אחרי כל הוספה מציירים מחדש את
     התצוגה המקדימה שמאחור, כך שהיא נשארת נכונה גם בלי לסגור. */
  function fromLib(dayIndex) {
    if (!DRAFT || !DRAFT.days[dayIndex]) return;
    EBExUI.open(FOR, dayIndex, {
      day:   function () { return DRAFT.days[dayIndex]; },
      after: function () { },
      back:  function () { preview(); }
    });
  }
  function drop(dayIndex, exIndex) {
    if (!DRAFT || !DRAFT.days[dayIndex]) return;
    DRAFT.days[dayIndex].exercises.splice(exIndex, 1);
    preview();
  }

  window.EBBuild = { open: open, gen: gen, apply: apply, build: build,
                     learn: learn, fromLib: fromLib, drop: drop,
                     setHouse: setHouse, houseId: houseId };
})();

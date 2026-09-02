/* =====================================================================
   E.B FIT — צח״מ, דופק, לחץ דם ובניית תוכנית אירובית
   ---------------------------------------------------------------------
   כל נוסחה מוצגת עם המספרים שהוצבו בה, כדי שאפשר יהיה לבדוק אותה
   ולא רק לסמוך עליה.

   מקורות:
     צח״מ    Uth-Sørensen (2004) · Cooper (1968) · Kline/Rockport (1987)
             George 1.5 מייל (1993) · Queens College (McArdle 1972)
             Jackson ללא מאמץ (1990) · Bruce/Foster (1984)
     דופק    Tanaka (2001) · Gellish (2007) · Nes (2013) · Fox (1971)
             Åstrand (1952) · Karvonen (1957) לאזורים
     לחץ דם  ACC/AHA 2017 · MAP · לחץ דופק · מכפלת לחץ-דופק
     אנרגיה  ACSM Metabolic Equations · MET
     ריצה    Daniels VDOT · Riegel (1981) · מהירות קריטית
     עומס    Banister TRIMP · Foster session-RPE

   הערכות ולא מדידות מעבדה. סטייה של 10–15% היא נורמלית, והן שימושיות
   בעיקר כקו בסיס למעקב אחרי שיפור — לא כמספר מוחלט.
   ===================================================================== */
(function () {
  'use strict';

  (window.EB_MOD = window.EB_MOD || {})['cardio'] = 'v54';

  var r1 = function (x) { return Math.round(x * 10) / 10; };
  var r0 = function (x) { return Math.round(x); };
  var n  = function (v) { var x = Number(v); return isFinite(x) && x > 0 ? x : null; };

  /* ================= עזרי גיל, מין ומשקל ================= */
  function ageOf(t) {
    if (!t.birth) return null;
    var b = new Date(t.birth + 'T00:00'), now = new Date();
    var a = now.getFullYear() - b.getFullYear();
    var m = now.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a--;
    return a > 0 && a < 120 ? a : null;
  }
  function sexOf(t) {
    var g = String(t.gender || '');
    if (g.indexOf('נק') > -1 || g.indexOf('אישה') > -1 || g.indexOf('female') > -1) return 'f';
    if (g.indexOf('זכ')  > -1 || g.indexOf('גבר')  > -1 || g.indexOf('male')   > -1) return 'm';
    return null;
  }
  /* המדידה האחרונה שיש בה את השדה המבוקש — לא תמיד האחרונה בכלל */
  function lastWith(t, field) {
    var list = (window.S && S.measures || [])
      .filter(function (m) { return m.traineeId === t.id && n(m[field]) !== null; })
      .sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    return list.length ? list[0] : null;
  }
  function val(t, field) { var m = lastWith(t, field); return m ? n(m[field]) : null; }

  /* ================= דופק מרבי ================= */
  function hrMax(age) {
    if (!age) return null;
    var all = {
      tanaka:  { v: 208   - 0.7  * age, f: '208 − 0.7 × '   + age, src: 'Tanaka 2001' },
      gellish: { v: 207   - 0.7  * age, f: '207 − 0.7 × '   + age, src: 'Gellish 2007' },
      nes:     { v: 211   - 0.64 * age, f: '211 − 0.64 × '  + age, src: 'Nes 2013' },
      astrand: { v: 216.6 - 0.84 * age, f: '216.6 − 0.84 × '+ age, src: 'Åstrand 1952' },
      fox:     { v: 220   - age,        f: '220 − ' + age,          src: 'Fox 1971 — הישן והפחות מדויק' }
    };
    Object.keys(all).forEach(function (k) { all[k].v = r0(all[k].v); });
    /* Tanaka הוא ברירת המחדל: הוא נגזר ממטא-אנליזה של 351 מחקרים,
       בעוד 220-פחות-גיל מעולם לא נבדק כראוי וסוטה עד 20 פעימות. */
    return { best: all.tanaka.v, src: 'Tanaka 2001', all: all };
  }

  /* ================= צח״מ — כל השיטות ================= */
  function vo2(t) {
    var age = ageOf(t), sex = sexOf(t);
    var w   = val(t, 'weight'), h = n(t.height);
    var rhr = val(t, 'restHr');
    var hm  = hrMax(age);
    var out = { methods: [], age: age, sex: sex, weight: w };

    var push = function (name, v, formula, note) {
      if (v === null || !isFinite(v) || v < 10 || v > 95) return;
      out.methods.push({ name: name, v: r1(v), f: formula, note: note || '' });
    };

    /* 1. Uth–Sørensen — יחס דופק מרבי לדופק מנוחה. דורש רק דופק מנוחה. */
    if (hm && rhr) {
      push('יחס דופק (Uth-Sørensen)', 15.3 * (hm.best / rhr),
        '15.3 × (' + hm.best + ' ÷ ' + rhr + ')',
        'הכי קל — דורש רק דופק מנוחה. מדויק פחות אצל לא-מאומנים.');
    }

    /* 2. Cooper — ריצת 12 דקות, מרחק במטרים */
    var c12 = val(t, 'cooper12');
    if (c12) push('מבחן קופר 12 דק׳', (c12 - 504.9) / 44.73,
      '(' + c12 + ' − 504.9) ÷ 44.73', 'ריצה 12 דקות, מרחק במטרים.');

    /* 3. Rockport — הליכת מייל. sex: גבר 1, אישה 0 */
    var rw = val(t, 'walkMin'), rwHr = val(t, 'walkHr');
    if (rw && rwHr && w && age && sex) {
      var lb = w * 2.20462;
      push('הליכת מייל (Rockport)',
        132.853 - 0.0769 * lb - 0.3877 * age + 6.315 * (sex === 'm' ? 1 : 0) - 3.2649 * rw - 0.1565 * rwHr,
        '132.853 − 0.0769×' + r1(lb) + ' − 0.3877×' + age + ' + 6.315×' + (sex === 'm' ? 1 : 0)
          + ' − 3.2649×' + rw + ' − 0.1565×' + rwHr,
        'הליכה מהירה 1.6 ק״מ, זמן בדקות ודופק בסיום.');
    }

    /* 4. George — ריצת 1.5 מייל */
    var r15 = val(t, 'run15');
    if (r15 && w && sex) {
      push('ריצת 2.4 ק״מ (George)',
        88.02 - 0.1656 * w - 2.76 * r15 + 3.716 * (sex === 'm' ? 1 : 0),
        '88.02 − 0.1656×' + w + ' − 2.76×' + r15 + ' + 3.716×' + (sex === 'm' ? 1 : 0),
        'ריצת 2.4 ק״מ, זמן בדקות.');
    }

    /* 5. Queens College — מבחן מדרגה 3 דקות */
    var stepHr = val(t, 'stepHr');
    if (stepHr && sex) {
      push('מבחן מדרגה (Queens College)',
        sex === 'm' ? 111.33 - 0.42 * stepHr : 65.81 - 0.1847 * stepHr,
        sex === 'm' ? '111.33 − 0.42 × ' + stepHr : '65.81 − 0.1847 × ' + stepHr,
        'מדרגה 41 ס״מ, 3 דקות, דופק 15 שנ׳ אחרי ×4.');
    }

    /* 6. Jackson — ללא מאמץ כלל, מדד פעילות 0–7 */
    var pa = n(t.paScore);
    if (pa !== null && age && sex && w && h) {
      var bmi = w / Math.pow(h / 100, 2);
      push('ללא מאמץ (Jackson)',
        56.363 + 1.921 * pa - 0.381 * age - 0.754 * bmi + 10.987 * (sex === 'm' ? 1 : 0),
        '56.363 + 1.921×' + pa + ' − 0.381×' + age + ' − 0.754×' + r1(bmi)
          + ' + 10.987×' + (sex === 'm' ? 1 : 0),
        'אומדן משאלון בלבד, בלי שום מבחן.');
    }

    /* 7. Bruce — הליכון, זמן בדקות */
    var br = val(t, 'bruceMin');
    if (br) push('הליכון (Bruce)',
      14.76 - 1.379 * br + 0.451 * br * br - 0.012 * br * br * br,
      '14.76 − 1.379×' + br + ' + 0.451×' + br + '² − 0.012×' + br + '³',
      'פרוטוקול ברוס, זמן עד תשישות.');

    if (out.methods.length) {
      /* חציון ולא ממוצע: שיטה אחת חריגה לא תזיז את התוצאה */
      var vals = out.methods.map(function (m) { return m.v; }).sort(function (a, b) { return a - b; });
      var mid = Math.floor(vals.length / 2);
      out.best = vals.length % 2 ? vals[mid] : r1((vals[mid - 1] + vals[mid]) / 2);
      out.spread = vals.length > 1 ? r1(vals[vals.length - 1] - vals[0]) : 0;
      out.band = classify(out.best, age, sex);
      out.mets = r1(out.best / 3.5);
    }
    out.needed = missingFor(t, hm, rhr);
    return out;
  }

  /* מה חסר כדי לקבל אומדן — במקום להשאיר מסך ריק */
  function missingFor(t, hm, rhr) {
    var need = [];
    if (!ageOf(t))       need.push('תאריך לידה');
    if (!sexOf(t))       need.push('מין');
    if (!val(t,'weight'))need.push('משקל');
    if (!rhr)            need.push('דופק מנוחה');
    return need;
  }

  /* דירוג לפי נורמות Cooper Institute — ערכי סף לפי גיל ומין */
  var NORMS = {
    m: [[20,[33,37,42,46]],[30,[31,35,40,45]],[40,[30,33,37,43]],
        [50,[26,30,35,40]],[60,[22,26,31,36]],[99,[20,23,27,32]]],
    f: [[20,[28,31,35,41]],[30,[27,30,33,38]],[40,[25,27,31,36]],
        [50,[21,24,28,32]],[60,[19,22,25,29]],[99,[17,20,23,27]]]
  };
  function classify(v, age, sex) {
    if (!age || !sex || !NORMS[sex]) return null;
    var row = NORMS[sex].find(function (r) { return age <= r[0]; }) || NORMS[sex][NORMS[sex].length - 1];
    var b = row[1];
    if (v < b[0]) return { txt: 'נמוך מאוד', cls: 'bad',  pct: 'מתחת ל-20%' };
    if (v < b[1]) return { txt: 'נמוך',      cls: 'bad',  pct: '20–40%' };
    if (v < b[2]) return { txt: 'ממוצע',     cls: 'mid',  pct: '40–60%' };
    if (v < b[3]) return { txt: 'טוב',       cls: 'good', pct: '60–80%' };
    return                { txt: 'מצוין',    cls: 'good', pct: 'מעל 80%' };
  }

  /* ================= אזורי דופק ================= */
  var ZONES = [
    { z:1, name:'התאוששות',     lo:.50, hi:.60, use:'שחרור, יום קל' },
    { z:2, name:'בסיס אירובי',  lo:.60, hi:.70, use:'שריפת שומן, בניית בסיס' },
    { z:3, name:'טמפו',         lo:.70, hi:.80, use:'סבולת אירובית' },
    { z:4, name:'סף חומצת חלב', lo:.80, hi:.90, use:'שיפור הסף' },
    { z:5, name:'מרבי',         lo:.90, hi:1.0, use:'אינטרוולים קצרים' }
  ];
  function zones(t) {
    var age = ageOf(t), hm = hrMax(age), rhr = val(t, 'restHr');
    if (!hm) return null;
    var out = { hrMax: hm.best, src: hm.src, all: hm.all, restHr: rhr, rows: [] };
    if (rhr) {
      out.reserve = hm.best - rhr;
      out.method = 'Karvonen — לפי רזרבת הדופק';
      out.f = 'דופק יעד = ' + rhr + ' + (' + hm.best + ' − ' + rhr + ') × אחוז';
    } else {
      out.method = 'אחוז מהדופק המרבי';
      out.f = 'דופק יעד = ' + hm.best + ' × אחוז';
      out.note = 'עם דופק מנוחה החישוב מדויק יותר (Karvonen).';
    }
    ZONES.forEach(function (z) {
      var lo = rhr ? rhr + (hm.best - rhr) * z.lo : hm.best * z.lo;
      var hi = rhr ? rhr + (hm.best - rhr) * z.hi : hm.best * z.hi;
      out.rows.push({ z: z.z, name: z.name, use: z.use, lo: r0(lo), hi: r0(hi),
                      pct: r0(z.lo * 100) + '–' + r0(z.hi * 100) + '%' });
    });
    return out;
  }

  /* ================= לחץ דם ================= */
  function bp(t) {
    var s = val(t, 'bpSys'), d = val(t, 'bpDia');
    if (!s || !d) return null;
    var o = { sys: s, dia: d };
    o.map = r0(d + (s - d) / 3);
    o.fMap = d + ' + (' + s + ' − ' + d + ') ÷ 3';
    o.pp  = s - d;
    o.fPp = s + ' − ' + d;

    /* סיווג ACC/AHA 2017 — הקטגוריה הגבוהה מבין השתיים קובעת */
    if (s > 180 || d > 120)      o.cls = { txt:'משבר יתר-לחץ-דם', cls:'bad',  act:'פנייה לרופא מיידית — לא להתאמן' };
    else if (s >= 140 || d >= 90)o.cls = { txt:'יתר לחץ דם שלב 2', cls:'bad',  act:'אישור רופא לפני אימון מאמץ' };
    else if (s >= 130 || d >= 80)o.cls = { txt:'יתר לחץ דם שלב 1', cls:'warn', act:'מעקב, להימנע מעצירת נשימה במאמץ' };
    else if (s >= 120)           o.cls = { txt:'לחץ דם מוגבר',     cls:'warn', act:'אירובי סדיר מוריד 5–8 ממ״כ' };
    else                         o.cls = { txt:'תקין',             cls:'good', act:'' };

    var rhr = val(t, 'restHr');
    if (rhr) {
      o.rpp  = s * rhr;
      o.fRpp = s + ' × ' + rhr;
      o.rppTxt = o.rpp < 10000 ? 'עומס לב נמוך במנוחה' : 'עומס לב מוגבר במנוחה';
    }
    return o;
  }

  /* ================= אנרגיה ================= */
  /* ACSM: קק״ל לדקה = MET × 3.5 × ק״ג ÷ 200 */
  function kcalMin(met, kg) { return met * 3.5 * kg / 200; }

  var ACTS = [
    ['הליכה 5 קמ״ש', 3.5], ['הליכה מהירה 6.4 קמ״ש', 5.0], ['הליכה בעלייה', 6.0],
    ['ריצה 8 קמ״ש', 8.3], ['ריצה 10 קמ״ש', 10.0], ['ריצה 12 קמ״ש', 12.5],
    ['אופניים קל', 5.8], ['אופניים מאומץ', 8.0], ['אופני ספין', 8.5],
    ['שחייה מתונה', 5.8], ['חתירה מתונה', 7.0], ['חבל קפיצה', 12.3],
    ['מכונת מדרגות', 9.0], ['אליפטיקל', 5.0], ['HIIT', 8.0], ['אימון כוח', 6.0]
  ];
  function energy(t) {
    var w = val(t, 'weight'); if (!w) return null;
    return {
      weight: w,
      f: 'קק״ל לדקה = MET × 3.5 × ' + w + ' ÷ 200',
      rows: ACTS.map(function (a) {
        var km = kcalMin(a[1], w);
        return { name: a[0], met: a[1], min: r1(km), c30: r0(km * 30), c45: r0(km * 45) };
      })
    };
  }

  /* ================= ריצה ================= */
  /* Riegel 1981: T2 = T1 × (D2/D1)^1.06 */
  function riegel(t1Min, d1Km, d2Km) { return t1Min * Math.pow(d2Km / d1Km, 1.06); }
  function fmtTime(min) {
    if (!isFinite(min) || min <= 0) return '—';
    var h = Math.floor(min / 60), m = Math.floor(min % 60), s = Math.round((min % 1) * 60);
    if (s === 60) { s = 0; m++; }
    return (h ? h + ':' + String(m).padStart(2,'0') : String(m)) + ':' + String(s).padStart(2,'0');
  }
  function pace(min, km) { return fmtTime(min / km) + ' לק״מ'; }

  function running(t) {
    /* בסיס: ריצת 2.4 ק״מ אם נמדדה, אחרת אומדן מהצח״מ */
    var r15 = val(t, 'run15');
    var v = vo2(t);
    var base = null;
    /* משוואת הריצה של ACSM: צח״מ = 0.2 × מהירות(מ׳/דק׳) + 3.5
       ומכאן מהירות(קמ״ש) = (צח״מ − 3.5) ÷ 0.2 × 60 ÷ 1000 = (צח״מ − 3.5) × 0.3 */
    var vMax = v.best ? (v.best - 3.5) * 0.3 : null;      // קמ״ש במאמץ מרבי
    if (r15)         base = { min: r15, km: 2.4, src: 'מבחן 2.4 ק״מ שנמדד' };
    else if (vMax)   base = { min: 2.4 / (vMax * 0.95) * 60, km: 2.4, src: 'אומדן מהצח״מ' };
    if (!base) return null;

    var out = { base: base, f: 'Riegel: זמן₂ = זמן₁ × (מרחק₂ ÷ מרחק₁)^1.06', races: [] };
    [['1 ק״מ',1],['5 ק״מ',5],['10 ק״מ',10],['חצי מרתון',21.1],['מרתון',42.2]].forEach(function (r) {
      out.races.push({ name: r[0], km: r[1],
        time: fmtTime(riegel(base.min, base.km, r[1])),
        pace: pace(riegel(base.min, base.km, r[1]), r[1]) });
    });
    if (vMax) {
      /* מהירות בסף האנאירובי ≈ 86% ממהירות הצח״מ (Daniels) */
      out.vVO2 = r1(vMax);
      out.vThr = r1(vMax * 0.86);
      out.fV   = 'מהירות בצח״מ = (' + v.best + ' − 3.5) × 0.3 = ' + r1(vMax)
               + ' קמ״ש · סף = 86% ממנה = ' + r1(vMax * 0.86) + ' קמ״ש';
      var pc = function (frac) { return pace(60 / (vMax * frac), 1); };
      out.paces = [
        ['קל (Z2)',       pc(0.65)],
        ['טמפו (Z3)',     pc(0.80)],
        ['סף (Z4)',       pc(0.86)],
        ['אינטרוול (Z5)', pc(1.00)]
      ];
    }
    return out;
  }

  /* ================= עומס אימון ================= */
  function trimp(minutes, avgHr, restHr, maxHr, sex) {
    if (!minutes || !avgHr || !restHr || !maxHr) return null;
    var dhr = (avgHr - restHr) / (maxHr - restHr);
    var b = sex === 'f' ? 1.67 : 1.92;
    return r0(minutes * dhr * 0.64 * Math.exp(b * dhr));
  }

  /* ================= בניית התוכנית האירובית ================= */
  /* המבנה נגזר מהמטרה, מרמת הכושר ומהעומס שכבר קיים בתוכנית הכוח.
     מי שמתאמן 5 פעמים בשבוע בכוח לא יקבל עוד 4 אימוני ריצה. */
  function planFor(t) {
    var v = vo2(t), z = zones(t);
    var goal = String(t.goal || '');
    var strengthDays = (((t.program || {}).days) || []).length;
    var lvl = v.band ? v.band.cls : 'mid';

    var dir = 'base';
    if (/חיטוב|ירידה|הרזי|שומן|לרדת|דיאטה/.test(goal)) dir = 'fat';
    if (/מסה|בניית שריר|לעלות|עלייה/.test(goal))        dir = 'mass';
    if (/סבולת|ריצה|מרתון|טריאתלון|אירובי/.test(goal))  dir = 'endur';
    if (/חיטוב/.test(goal) && /מסה|עלייה/.test(goal))   dir = 'fat';

    /* כמה ימים. ההצעה האוטומטית לוקחת בחשבון את עומס הכוח הקיים,
       אבל אם המאמן קבע מספר בעצמו — הוא קובע. */
    var auto = dir === 'mass'  ? 2
             : dir === 'endur' ? (strengthDays >= 4 ? 3 : 4)
             : strengthDays >= 5 ? 2 : 3;
    var picked = Number(t.cardioDays);
    var days = (isFinite(picked) && picked >= 0 && picked <= 7) ? picked : auto;

    var Z = function (num) {
      if (!z) return '';
      var r = z.rows[num - 1];
      return r ? r.lo + '–' + r.hi + ' פעימות' : '';
    };

    var lib = {
      fat: [
        { id:'fat_z2', name:'אירובי בסיס — Z2', min:40, zone:2,
          desc:'הליכה מהירה בעלייה, אליפטיקל או אופניים. קצב שמאפשר לדבר במשפטים שלמים.',
          why:'ב-Z2 שיעור חמצון השומן הוא הגבוה ביותר, וההתאוששות ממנו מהירה — אפשר להוסיף אותו בלי לפגוע באימוני הכוח.' },
        { id:'fat_int', name:'אינטרוולים — Z4', min:25, zone:4,
          desc:'חימום 8 דק׳ · 8 × (2 דק׳ מאמץ / 2 דק׳ קל) · שחרור 5 דק׳',
          why:'מעלה צח״מ מהר יותר מכל שיטה אחרת, ומייצר צריכת חמצן מוגברת גם שעות אחרי.' },
        { id:'fat_walk', name:'הליכה ארוכה — Z1–Z2', min:55, zone:2,
          desc:'הליכה רציפה, שיפוע קל. אפשר לפצל לשתי יחידות ביום.',
          why:'מוסיף הוצאה קלורית כמעט בלי עלות התאוששות.' }
      ],
      mass: [
        { id:'mass_z2', name:'אירובי קל — Z2', min:25, zone:2,
          desc:'אופניים או הליכה בשיפוע, ביום שאין בו רגליים.',
          why:'שומר על בריאות הלב ועל מחזור הדם לשרירים בלי לגזול מהתאוששות. יותר מזה פוגע בעלייה במסה.' },
        { id:'mass_cool', name:'שחרור אחרי כוח — Z1', min:15, zone:1,
          desc:'הליכה קלה מיד אחרי אימון הכוח.',
          why:'מאיץ פינוי תוצרי מאמץ ומקצר את כאבי השריר למחרת.' }
      ],
      endur: [
        { id:'end_long', name:'ריצה קלה ארוכה — Z2', min:60, zone:2,
          desc:'קצב שיחה רציף. להאריך ב-10% בשבוע, לא יותר.',
          why:'80% מנפח האימון של רצים מובילים הוא בעצימות נמוכה. זה מה שבונה את הבסיס.' },
        { id:'end_thr', name:'אימון סף — Z4', min:35, zone:4,
          desc:'חימום 10 דק׳ · 20 דק׳ בקצב סף · שחרור 5 דק׳',
          why:'מעלה את המהירות שבה מצטברת חומצת חלב — הגורם המגביל בתחרות.' },
        { id:'end_int', name:'אינטרוולים קצרים — Z5', min:30, zone:5,
          desc:'חימום 10 דק׳ · 6 × (3 דק׳ חזק / 3 דק׳ קל) · שחרור 5 דק׳',
          why:'מגייס את הצח״מ המרבי ומשפר כלכלת ריצה.' },
        { id:'end_rec', name:'ריצת התאוששות — Z1', min:30, zone:1,
          desc:'איטי בכוונה. אם מרגיש מהר — להאט.',
          why:'נפח בלי עומס. הטעות הנפוצה היא לרוץ אותו מהר מדי.' }
      ],
      base: [
        { id:'base_z2', name:'אירובי בסיס — Z2', min:30, zone:2,
          desc:'כל מכשיר או הליכה בחוץ, בקצב שמאפשר לדבר.',
          why:'הבסיס שממנו הכול נבנה, ומה שמשפר את הצח״מ בשלב הראשון.' },
        { id:'base_tempo', name:'טמפו — Z3', min:25, zone:3,
          desc:'חימום 5 דק׳ · 15 דק׳ בקצב נוח-קשה · שחרור 5 דק׳',
          why:'מגשר בין בסיס לעצימות, בלי העומס של אינטרוולים.' },
        { id:'base_int', name:'אינטרוולים — Z4', min:22, zone:4,
          desc:'חימום 6 דק׳ · 6 × (1 דק׳ מאמץ / 2 דק׳ קל) · שחרור 4 דק׳',
          why:'הדרך המהירה ביותר להעלות צח״מ בשבועות הראשונים.' }
      ]
    };

    /* בחירה ידנית גוברת על ההצעה. אם נבחרו אימונים מפורשות —
       הם נלקחים מכל הספרייה ולא רק מקבוצת המטרה. */
    var all = [];
    Object.keys(lib).forEach(function (g) {
      lib[g].forEach(function (x) { all.push(Object.assign({ group: g }, x)); });
    });
    var chosen;
    if (Array.isArray(t.cardioPick) && t.cardioPick.length) {
      chosen = t.cardioPick.map(function (id) {
        return all.filter(function (x) { return x.id === id; })[0];
      }).filter(Boolean);
      days = chosen.length;
    } else {
      /* מחזוריות אם ביקשו יותר ימים ממה שיש בקבוצה */
      var pool = lib[dir];
      chosen = [];
      for (var i = 0; i < days; i++) chosen.push(pool[i % pool.length]);
    }

    /* מתחילים מקצרים ומאריכים בהדרגה — התקדמות של 10% בשבוע */
    if (lvl === 'bad') chosen = chosen.map(function (s) {
      return Object.assign({}, s, { min: Math.max(15, r0(s.min * 0.65)),
        desc: s.desc + ' — מתחילים קצר ומאריכים 10% בשבוע.' });
    });

    return {
      dir: dir,
      auto: auto,
      manual: (isFinite(picked) && picked >= 0 && picked <= 7),
      hasPick: !!(Array.isArray(t.cardioPick) && t.cardioPick.length),
      catalogue: all,
      dirTxt: { fat:'חיטוב', mass:'בניית מסה', endur:'סבולת', base:'בסיס וכושר כללי' }[dir],
      days: days, level: v.band, vo2: v.best, strengthDays: strengthDays,
      zonesRef: z,
      sessions: chosen.map(function (s) {
        return Object.assign({}, s, { hr: Z(s.zone), kcal: (function () {
          var w = val(t, 'weight');
          if (!w) return null;
          var met = [0,3.5,5.5,7.5,9.5,11.5][s.zone] || 6;
          return r0(kcalMin(met, w) * s.min);
        })() });
      }),
      weekMin: chosen.reduce(function (a, s) { return a + s.min; }, 0)
    };
  }

  /* המרה לימי תוכנית שאפשר לערוך במסך הרגיל */
  function toDays(t) {
    var p = planFor(t);
    return p.sessions.map(function (s) {
      return {
        name: 'אירובי · ' + s.name,
        exercises: [
          { name: s.name, sets: '1', reps: s.min + ' דק׳', weight: s.hr || '',
            rest: '', note: s.desc },
          { name: 'למה זה בתוכנית', sets: '', reps: '', weight: '', rest: '', note: s.why }
        ]
      };
    });
  }

  /* ================= יחסי עבודה-מנוחה לפי מערכת אנרגיה =================
     ההפוגה נגזרת ממה שצריך להתמלא מחדש, ולא מתחושה. פוספגן מתמלא
     תוך 2-3 דקות ולכן ספרינט קצר דורש הפוגה ארוכה פי 12-20; מערכת
     חומצת החלב דורשת פי 3-5; ואירובי מסתפק ביחס 1:1. הפוגה קצרה מדי
     בספרינט הופכת אותו לאימון סבולת ומבטלת את מטרתו. */
  var SYSTEMS = [
    { name: 'פוספגן (ATP-CP)', dur: 'עד 10 שנ\u05f3', ratio: '1:12 עד 1:20',
      use: 'ספרינט מרבי, כוח מתפרץ',
      why: 'מאגר הקריאטין-פוספט מתמלא ב-2-3 דקות. הפוגה קצרה מזה מורידה את המהירות בחזרה הבאה.' },
    { name: 'גליקוליטי', dur: '20 שנ\u05f3 עד 2 דק\u05f3', ratio: '1:3 עד 1:5',
      use: 'אינטרוולים קשים, סבולת מהירות',
      why: 'פינוי חומצת חלב דורש פי 3-5 מזמן העבודה. זה האזור הכי לא נעים ובו הרווח הגדול.' },
    { name: 'חמצני (אירובי)', dur: '2-5 דק\u05f3', ratio: '1:1 עד 1:2',
      use: 'העלאת צח\u05f4מ, אינטרוולים ארוכים',
      why: 'הפוגה קצרה ומכוונת שומרת את הדופק גבוה, וכך מצטבר יותר זמן קרוב לצריכת החמצן המרבית.' },
    { name: 'אירובי מתמשך', dur: 'מעל 5 דק\u05f3', ratio: 'ללא הפוגה',
      use: 'בסיס, ריצה ארוכה',
      why: 'הגירוי הוא משך המאמץ הרציף עצמו.' }
  ];

  /* ================= פרוטוקולי אינטרוולים =================
     כל פרוטוקול מקבל את הדופק והקצב האמיתיים של המתאמן. */
  function intervals(t) {
    var z = zones(t), r = running(t), v = vo2(t);
    var Z = function (i) {
      if (!z) return '';
      var x = z.rows[i - 1];
      return x ? x.lo + '-' + x.hi : '';
    };
    var P = function (label) {
      if (!r || !r.paces) return '';
      var f = r.paces.filter(function (p) { return p[0].indexOf(label) > -1; })[0];
      return f ? f[1] : '';
    };

    var list = [
      { name: 'נורווגי 4x4', tag: 'צח\u05f4מ',
        work: '4 דק\u05f3', rest: '3 דק\u05f3', reps: '4 חזרות', total: 'כ-35 דק\u05f3',
        hr: Z(5), pace: P('אינטרוול'), ratio: '1:0.75',
        desc: 'חימום 10 דק\u05f3 · 4 x (4 דק\u05f3 ב-90-95% מהדופק המרבי / 3 דק\u05f3 קל) · שחרור 5 דק\u05f3',
        why: 'הפרוטוקול עם התיעוד המחקרי הטוב ביותר להעלאת צח\u05f4מ. מייצר את הזמן הרב ביותר קרוב לצריכת החמצן המרבית.' },
      { name: 'ביללה 30/30', tag: 'צח\u05f4מ',
        work: '30 שנ\u05f3', rest: '30 שנ\u05f3', reps: '12-20', total: 'כ-25 דק\u05f3',
        hr: Z(5), pace: P('אינטרוול'), ratio: '1:1',
        desc: 'חימום 10 דק\u05f3 · 12-20 x (30 שנ\u05f3 במהירות הצח\u05f4מ / 30 שנ\u05f3 הליכה) · שחרור',
        why: 'מצטבר זמן רב בעצימות גבוהה בתחושת מאמץ נמוכה יחסית. קל יותר לביצוע מ-4x4.' },
      { name: 'טבטה', tag: 'אנאירובי',
        work: '20 שנ\u05f3', rest: '10 שנ\u05f3', reps: '8', total: '4 דק\u05f3',
        hr: 'מרבי', pace: 'מרבי', ratio: '1:0.5',
        desc: 'חימום מלא · 8 x (20 שנ\u05f3 מאמץ מרבי / 10 שנ\u05f3 מנוחה) · שחרור',
        why: 'קצר וקשה מאוד. במחקר המקורי בוצע ב-170% מהצח\u05f4מ, ולא מתאים למתחילים.' },
      { name: '30-15 IFT', tag: 'משולב',
        work: '30 שנ\u05f3', rest: '15 שנ\u05f3', reps: '12-16', total: 'כ-20 דק\u05f3',
        hr: Z(4), pace: P('סף'), ratio: '1:0.5',
        desc: '3 סטים של 12-16 x (30 שנ\u05f3 ריצה / 15 שנ\u05f3 הליכה), 3 דק\u05f3 בין סטים',
        why: 'פותח לספורט קבוצתי - משלב סבולת עם שינויי כיוון ועצירות.' },
      { name: '10-20-30', tag: 'משולב',
        work: '10 שנ\u05f3 ספרינט', rest: '30 שנ\u05f3 קל', reps: '5 x 3-4 סטים', total: 'כ-20 דק\u05f3',
        hr: Z(4), pace: 'משתנה', ratio: 'משתנה',
        desc: '5 x (30 שנ\u05f3 קל · 20 שנ\u05f3 בינוני · 10 שנ\u05f3 ספרינט), 2 דק\u05f3 בין סטים',
        why: 'מוריד נפח כולל ועדיין משפר צח\u05f4מ וזמני ריצה. מתאים למי שאין לו הרבה זמן.' },
      { name: 'אינטרוולים ארוכים 5x5', tag: 'סף',
        work: '5 דק\u05f3', rest: '90 שנ\u05f3', reps: '5', total: 'כ-40 דק\u05f3',
        hr: Z(4), pace: P('סף'), ratio: '1:0.3',
        desc: 'חימום 10 דק\u05f3 · 5 x (5 דק\u05f3 בקצב סף / 90 שנ\u05f3 קל) · שחרור',
        why: 'מעלה את מהירות הסף - הגורם שקובע בפועל את זמני התחרות במרחקים בינוניים.' },
      { name: 'פארטלק', tag: 'חופשי',
        work: 'משתנה', rest: 'משתנה', reps: '-', total: '30-45 דק\u05f3',
        hr: Z(3) + ' עד ' + Z(5), pace: 'לפי תחושה', ratio: 'חופשי',
        desc: 'ריצה רציפה עם האצות ספונטניות - לעמוד תאורה, לעץ, לפי מצב רוח',
        why: 'משלב עצימויות בלי מבנה קשיח. טוב לשבירת שגרה ולשמירה על הנאה.' }
    ];

    var sprints = [
      { name: 'ספרינט בעלייה', work: '8-12 שנ\u05f3', rest: '2-3 דק\u05f3', reps: '6-10',
        why: 'העלייה מגבילה את המהירות ולכן מפחיתה עומס על ההמסטרינג. הכי בטוח להתחלה.' },
      { name: 'ספרינט מעוף', work: '20-30 מ\u05f3 אחרי האצה', rest: '3-4 דק\u05f3', reps: '4-6',
        why: 'מגיעים למהירות מרבית בלי עומס ההתנעה. מפתח מהירות אמיתית.' },
      { name: 'סבולת ספרינט (RSA)', work: '6 x 30 מ\u05f3', rest: '20-25 שנ\u05f3', reps: '2-3 סטים',
        why: 'היכולת לחזור על ספרינט היא מה שקובע בכדורגל ובכדורסל, לא הספרינט הבודד.' },
      { name: 'ספרינט מרבי במישור', work: '30-60 מ\u05f3', rest: '3-5 דק\u05f3', reps: '4-8',
        why: 'הפוגה מלאה היא תנאי. עם פחות מ-3 דקות זה כבר לא אימון מהירות.' }
    ];

    return { list: list, sprints: sprints, systems: SYSTEMS,
             hasHr: !!z, hasPace: !!(r && r.paces), vo2: v.best,
             caution: (v.band && v.band.cls === 'bad')
               ? 'רמת הכושר עדיין נמוכה - להתחיל מהפרוטוקולים הארוכים והמתונים, ולא מטבטה או מספרינטים.'
               : '' };
  }

  /* ================= נפח והתקדמות =================
     כמה להוסיף בכל שבוע, ומתי לרדת. */
  function volume(t) {
    var p = planFor(t);
    var cur = p.weekMin;
    var v = vo2(t);
    var lvl = v.band ? v.band.cls : 'mid';

    /* כלל ה-10%: העלאה מהירה יותר היא הגורם המוביל לפציעות עומס יתר.
       הגבול נקבע לפי רמת הכושר - מתחיל נשבר מהר יותר. */
    var pct = lvl === 'bad' ? 5 : lvl === 'good' ? 10 : 8;
    var ceiling = lvl === 'bad' ? 150 : lvl === 'good' ? 300 : 220;

    var weeks = [], m = cur;
    for (var i = 1; i <= 8; i++) {
      /* כל שבוע רביעי הוא שבוע הורדה - ההסתגלות קורית במנוחה ולא בעומס */
      var deload = (i % 4 === 0);
      var val = deload ? Math.round(m * 0.6) : Math.round(m);
      weeks.push({ week: i, min: Math.min(val, ceiling), deload: deload });
      if (!deload) m = Math.min(m * (1 + pct / 100), ceiling);
    }

    return {
      current: cur, pct: pct, ceiling: ceiling, level: v.band,
      f: 'נפח שבוע הבא = ' + cur + ' x ' + (1 + pct / 100).toFixed(2)
         + ' = ' + Math.round(cur * (1 + pct / 100)) + ' דק\u05f3',
      weeks: weeks,
      hard: lvl === 'bad' ? 1 : 2,
      acwr: 'יחס עומס חד ל-כרוני: לשמור בין 0.8 ל-1.3. מעל 1.5 סיכון הפציעה עולה חדות.',
      rules: [
        ['כלל ה-10%', 'לא להוסיף יותר מ-' + pct + '% נפח בשבוע ברמה הנוכחית'],
        ['שבוע הורדה', 'כל שבוע רביעי - 60% מהנפח. ההסתגלות קורית במנוחה'],
        ['ימים קשים', 'עד ' + (lvl === 'bad' ? 'אחד' : 'שניים') + ' בשבוע, עם 48 שעות ביניהם'],
        ['80/20', 'רוב הנפח בעצימות נמוכה. הטעות הנפוצה היא לרוץ בינוני תמיד'],
        ['סימן אזהרה', 'דופק מנוחה גבוה ב-7 פעימות ומעלה מהרגיל - יום מנוחה, לא אימון']
      ]
    };
  }

  var GROUP_NAMES = { fat:'חיטוב', mass:'בניית מסה', endur:'סבולת', base:'בסיס וכושר כללי' };

  /* כל האימונים שיש, מכל המטרות — כדי שאפשר יהיה לבחור מהם ידנית */
  function catalogue(t) {
    var p = planFor(t);
    var picked = (t && Array.isArray(t.cardioPick)) ? t.cardioPick : [];
    return p.catalogue.map(function (x) {
      return Object.assign({}, x, {
        groupName: GROUP_NAMES[x.group] || x.group,
        chosen: picked.indexOf(x.id) > -1,
        suggested: x.group === p.dir
      });
    });
  }

  window.EBCardio = {
    catalogue: catalogue, groupNames: GROUP_NAMES,
    intervals: intervals, volume: volume, systems: SYSTEMS,
    vo2: vo2, zones: zones, bp: bp, energy: energy, running: running,
    plan: planFor, toDays: toDays, hrMax: hrMax, trimp: trimp,
    ageOf: ageOf, sexOf: sexOf, val: val, kcalMin: kcalMin,
    fmtTime: fmtTime, classify: classify
  };
})();

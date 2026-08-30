/* =====================================================================
   E.B FIT — כרטיס מדדים
   ---------------------------------------------------------------------
   התמונה המלאה של מתאמן, נגזרת אוטומטית מהשאלון ומהמדידות:
   הרכב גוף, אנרגיה, מאקרו, היקפים, קצב לב, ויעדי שינוי.

   שלוש הבחנות שנשמרות לאורך כל הכרטיס:

   1. מדוד מול משוער. משקל וגובה נמדדו; אחוז שומן מנוסחה הוא הערכה
      עם סטייה של 3–5 אחוזים. הכרטיס מסמן כל ערך משוער, כי מאמן
      שמציג למתאמן מספר מנוסחה כאילו נמדד — מאבד אמון כשהמתאמן
      הולך לבדיקה אמיתית.

   2. מה חסר נאמר במפורש. שדה ריק שקט הוא הדרך הבטוחה לחשב יעד שגוי.

   3. מה לא מחושב כאן: ויטמינים, מינרלים ומינונים. אלה החלטות רפואיות
      שתלויות בבדיקות דם ובתרופות, ואין דרך לגזור אותן משאלון.
   ===================================================================== */
(function () {
  'use strict';

  (window.EB_MOD = window.EB_MOD || {})['metrics'] = 'v30';

  var r1 = function (x) { return Math.round(x * 10) / 10; };

  /* ---------- קלט ---------- */
  function latest(t, field) {
    var ms = (window.S.measures || [])
      .filter(function (m) { return m.traineeId === t.id && m[field]; })
      .sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
    return ms.length ? { v: Number(ms[0][field]), date: ms[0].date } : null;
  }
  function ageOf(t) {
    if (!t.birth) return null;
    var d = new Date(t.birth), n = new Date();
    var a = n.getFullYear() - d.getFullYear();
    if (n < new Date(n.getFullYear(), d.getMonth(), d.getDate())) a--;
    return (a > 5 && a < 100) ? a : null;
  }
  function ik(t, k) {
    var v = ((t.intake || {}).answers || {})[k];
    return (v === undefined || v === '') ? null : v;
  }

  /* ---------- החישוב ---------- */
  function compute(t) {
    var w = latest(t, 'weight'), waist = latest(t, 'waist'), fatM = latest(t, 'fat');
    var h = Number(t.height) || null;
    var a = ageOf(t);
    var sex = t.gender === 'זכר' ? 'm' : t.gender === 'נקבה' ? 'f' : null;

    var o = {
      missing: [], weight: w, height: h, age: a, sex: sex,
      waist: waist, fatMeasured: fatM
    };
    if (!w) o.missing.push('משקל');
    if (!h) o.missing.push('גובה');
    if (!a) o.missing.push('תאריך לידה');
    if (!sex) o.missing.push('מין');
    if (!waist) o.missing.push('היקף בטן');

    if (w && h) {
      var m = h / 100;
      o.bmi = r1(w.v / (m * m));
      o.bmiClass = o.bmi < 18.5 ? 'תת-משקל'
                 : o.bmi < 25   ? 'תקין'
                 : o.bmi < 30   ? 'עודף משקל' : 'השמנה';
      // טווח המשקל שמתאים ל-BMI 18.5–24.9 בגובה הזה
      o.weightRange = [r1(18.5 * m * m), r1(24.9 * m * m)];

      /* אחוז שומן: מדידה אמיתית עדיפה תמיד. בלעדיה — Deurenberg,
         שנשען על BMI, גיל ומין. סטייה טיפוסית 3–5 אחוזים, וגבוהה
         יותר אצל מי שמאומן היטב, כי שריר מנפח את ה-BMI. */
      if (fatM) { o.fat = fatM.v; o.fatSrc = 'measured'; }
      else if (a && sex) {
        o.fat = r1(1.20 * o.bmi + 0.23 * a - 10.8 * (sex === 'm' ? 1 : 0) - 5.4);
        o.fatSrc = 'estimated';
      }
      if (o.fat != null) {
        o.fatKg  = r1(w.v * o.fat / 100);
        o.leanKg = r1(w.v - o.fatKg);
        var ranges = sex === 'f'
          ? [['אתלטי', 14, 20], ['כשיר', 21, 24], ['ממוצע', 25, 31], ['גבוה', 32, 99]]
          : [['אתלטי', 6, 13], ['כשיר', 14, 17], ['ממוצע', 18, 24], ['גבוה', 25, 99]];
        var band = null;
        ranges.forEach(function (x) { if (!band && o.fat <= x[2]) band = x[0]; });
        o.fatBand = band || ranges[ranges.length - 1][0];
      }
    }

    if (waist && h) {
      /* יחס מותן-גובה. מנבא סיכון מטבולי טוב יותר מ-BMI, כי הוא
         מבחין בין שומן בטני לשומן היקפי. סף מקובל: 0.5 */
      o.whtr = r1(waist.v / h * 100) / 100;
      o.whtrOk = o.whtr < 0.5;
    }

    if (a) {
      // Tanaka — מדויק יותר מ-220 פחות גיל, במיוחד מעל גיל 40
      o.hrMax = Math.round(208 - 0.7 * a);
      o.hrFat  = [Math.round(o.hrMax * 0.60), Math.round(o.hrMax * 0.70)];
      o.hrCard = [Math.round(o.hrMax * 0.70), Math.round(o.hrMax * 0.85)];
    }

    // אנרגיה ומאקרו — מהמודול הקיים, כדי שלא יהיו שני חישובים שונים
    if (window.EBTrack) {
      var T = EBTrack.targets(t);
      if (!T.missing || !T.missing.length) o.energy = T;
    }

    /* קצב שינוי מומלץ: אחוז ממשקל הגוף בשבוע. אגרסיבי מזה מגיע
       על חשבון מסת שריר בירידה, ועל חשבון שומן בעלייה. */
    if (w && o.energy) {
      var g = o.energy.goal;
      if (g === 'cut')       o.rate = { txt:'ירידה', lo:r1(w.v*0.005), hi:r1(w.v*0.01) };
      else if (g === 'mass') o.rate = { txt:'עלייה', lo:r1(w.v*0.0025), hi:r1(w.v*0.005) };
      if (o.rate && o.weightRange) {
        var target = g === 'cut' ? o.weightRange[1] : o.weightRange[1];
        var diff = Math.abs(w.v - target);
        if (diff > 0.5) o.weeksToRange = Math.ceil(diff / ((o.rate.lo + o.rate.hi) / 2));
      }
    }

    // אורח חיים מהשאלון
    o.life = {
      sleep: ik(t, 'sleepHours'), sleepQ: ik(t, 'sleepQuality'),
      stress: ik(t, 'stress'), waterNow: ik(t, 'water'),
      days: ik(t, 'daysPerWeek'), place: ik(t, 'location'),
      diet: ik(t, 'diet'), supps: ik(t, 'supplements')
    };
    return o;
  }

  /* ---------- תצוגה ---------- */
  function row(label, value, note, flag) {
    if (value === undefined || value === null || value === '') return '';
    return '<div class="line-item">'
      + '<span class="muted" style="width:150px;font-size:13px;flex:none">' + esc(label) + '</span>'
      + '<span style="flex:1;font-size:14.5px">' + esc(value)
      + (flag ? ' <span style="font-size:11px;color:var(--amber)">' + esc(flag) + '</span>' : '')
      + '</span>'
      + (note ? '<span class="muted" style="font-size:12px">' + esc(note) + '</span>' : '')
      + '</div>';
  }
  function box(title, inner, sub) {
    if (!inner) return '';
    return '<div class="card" style="margin-top:12px">'
      + '<h3 style="font-size:15px;margin-bottom:' + (sub ? '2px' : '8px') + '">' + esc(title) + '</h3>'
      + (sub ? '<div class="muted" style="font-size:12px;margin-bottom:10px">' + esc(sub) + '</div>' : '')
      + inner + '</div>';
  }

  function tab(t) {
    var o = compute(t);
    var h = '';

    /* מה חסר — ראשון, כי בלעדיו כל השאר חלקי */
    if (o.missing.length) {
      h += '<div class="card" style="border-color:rgba(255,197,61,.35)">'
        + '<h3 style="font-size:15px;margin-bottom:6px">חסר כדי להשלים את התמונה</h3>'
        + '<p style="font-size:13.5px;margin:0 0 10px">' + esc(o.missing.join(' · ')) + '</p>'
        + '<div class="row">'
        + '<button class="btn sm ghost" onclick="editTrainee(\'' + t.id + '\')">עריכת פרטים</button>'
        + '<button class="btn sm ghost" onclick="SUBTAB=\'measures\';render()">הוספת מדידה</button>'
        + '</div></div>';
    }

    /* הרכב גוף */
    var body = '';
    if (o.weight) body += row('משקל', o.weight.v + ' ק״ג', 'נמדד ' + fmtDate(o.weight.date));
    if (o.height) body += row('גובה', o.height + ' ס״מ');
    if (o.bmi)    body += row('BMI', o.bmi + ' — ' + o.bmiClass);
    if (o.fat != null)
      body += row('אחוז שומן', o.fat + '% — ' + o.fatBand, '',
                  o.fatSrc === 'estimated' ? 'משוער' : '');
    if (o.fatKg)  body += row('מסת שומן', o.fatKg + ' ק״ג');
    if (o.leanKg) body += row('מסה רזה', o.leanKg + ' ק״ג');
    if (o.whtr)   body += row('יחס מותן-גובה', o.whtr + (o.whtrOk ? ' — תקין' : ' — מעל הסף 0.5'));
    if (o.weightRange)
      body += row('טווח משקל תקין', o.weightRange[0] + '–' + o.weightRange[1] + ' ק״ג', 'לגובה הזה');
    h += box('הרכב גוף', body,
             o.fatSrc === 'estimated'
               ? 'אחוז השומן מחושב מנוסחה ולא נמדד — סטייה טיפוסית 3–5 אחוזים, וגבוהה יותר אצל מאומנים.'
               : '');

    /* אנרגיה ומאקרו */
    var e = o.energy, en = '';
    if (e) {
      en += row('BMR', e.bmr + ' קק״ל', 'מנוחה מוחלטת');
      en += row('TDEE', e.tdee + ' קק״ל', e.act.t);
      en += row('יעד יומי', e.kcal + ' קק״ל',
                e.goal === 'cut' ? 'גירעון 20%' : e.goal === 'mass' ? 'עודף 12%' : 'שמירה');
      en += row('חלבון', e.protein + ' ג׳', r1(e.protein / e.weight) + ' ג׳ לק״ג');
      en += row('פחמימות', e.carbs + ' ג׳', Math.round(e.carbs * 4 / e.kcal * 100) + '% מהקלוריות');
      en += row('שומן', e.fat + ' ג׳', Math.round(e.fat * 9 / e.kcal * 100) + '% מהקלוריות');
      en += row('מים', e.water + ' ליטר');
      if (o.rate)
        en += row('קצב ' + o.rate.txt + ' מומלץ', o.rate.lo + '–' + o.rate.hi + ' ק״ג בשבוע');
      if (o.weeksToRange)
        en += row('הערכת זמן', o.weeksToRange + ' שבועות', 'לטווח התקין');
    }
    h += box('אנרגיה ותזונה', en,
             e && e.assumedSex ? 'המין לא מוגדר — החישוב הוא ממוצע בין הנוסחאות, הפרש של כ-166 קק״ל.' : '');

    /* קצב לב */
    var hr = '';
    if (o.hrMax) {
      hr += row('דופק מקסימלי', o.hrMax + ' פעימות', 'לפי Tanaka');
      hr += row('אזור שריפת שומן', o.hrFat[0] + '–' + o.hrFat[1], '60–70%');
      hr += row('אזור אירובי', o.hrCard[0] + '–' + o.hrCard[1], '70–85%');
    }
    h += box('קצב לב', hr, 'הערכה מהגיל. מי שמודד דופק בפועל — עדיף להשתמש במספר שלו.');

    /* היקפים */
    var circ = '';
    ['waist','chest','arm','thigh'].forEach(function (k) {
      var lbl = { waist:'בטן', chest:'חזה', arm:'זרוע', thigh:'ירך' }[k];
      var m = latest(t, k);
      if (m) circ += row(lbl, m.v + ' ס״מ', fmtDate(m.date));
    });
    h += box('היקפים', circ, 'שינוי בהיקפים מקדים לרוב שינוי במשקל — שווה למדוד כל שבועיים.');

    /* אורח חיים */
    var L = o.life, lf = '';
    lf += row('ימי אימון בשבוע', L.days);
    lf += row('מיקום אימון', L.place);
    lf += row('שעות שינה', L.sleep, L.sleepQ || '');
    lf += row('רמת סטרס', L.stress ? L.stress + ' מתוך 10' : '');
    lf += row('שתיית מים כיום', L.waterNow ? L.waterNow + ' ליטר' : '',
              e && L.waterNow && Number(L.waterNow) < e.water ? 'מתחת ליעד' : '');
    lf += row('תזונה ומגבלות', L.diet);
    lf += row('תוספים', L.supps);
    h += box('אורח חיים', lf, lf ? '' : null);

    if (!h) h = '<div class="empty">אין מספיק נתונים. מלא פרטי מתאמן והוסף מדידה.</div>';

    h += '<div class="muted" style="font-size:12px;margin-top:14px;line-height:1.6">'
      + 'כל המספרים כאן הם נוסחאות מקובלות לאוכלוסייה בריאה — נקודת פתיחה שמתכווננת '
      + 'לפי התוצאות בפועל, לא מרשם. ויטמינים, מינרלים ומינונים לא מחושבים כאן: '
      + 'אלה החלטות רפואיות שתלויות בבדיקות דם.</div>';
    return h;
  }

  window.EBMetrics = { tab: tab, compute: compute };
})();

/* =====================================================================
   E.B FIT — מדדים ונוסחאות
   ---------------------------------------------------------------------
   כל מדד מוצג עם הנוסחה שממנה הוא חושב והמספרים שהוצבו בה, כדי
   שהמאמן יוכל להסביר למתאמן מאיפה המספר הגיע — ולזהות מתי הוא לא
   מתאים.

   מקורות:
     BMR      Mifflin-St Jeor (1990) · Harris-Benedict מתוקן (Roza 1984)
              Katch-McArdle — מדויק יותר כשאחוז השומן ידוע
     שומן     US Navy / Hodgdon-Beckett (1984) · Deurenberg (1991)
     חלבון    ISSN Position Stand: Protein and Exercise (2017)
     שומן במזון  20–35% מהקלוריות; מינימום 0.8 ג׳/ק״ג לתפקוד הורמונלי
     1RM      Epley (1985) · Brzycki (1993)
     דופק     Tanaka (2001) · Karvonen לאזורים לפי דופק מנוחה

   מה שלא מחושב כאן: ויטמינים, מינרלים ומינונים. אלה החלטות רפואיות
   שתלויות בבדיקות דם ובתרופות, ואין דרך לגזור אותן משאלון.
   ===================================================================== */
(function () {
  'use strict';

  (window.EB_MOD = window.EB_MOD || {})['metrics'] = 'v45';

  var r1 = function (x) { return Math.round(x * 10) / 10; };
  var r2 = function (x) { return Math.round(x * 100) / 100; };
  var IN = 0.393701;                      // ס״מ לאינץ׳
  var log10 = function (x) { return Math.log(x) / Math.LN10; };

  /* ---------- קלט ---------- */
  function latest(t, field) {
    var ms = (window.S.measures || [])
      .filter(function (m) { return m.traineeId === t.id && m[field] !== '' && m[field] != null; })
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

  /* =====================================================================
     החישוב
     ===================================================================== */
  function compute(t) {
    var W = latest(t,'weight'), waist = latest(t,'waist'), neck = latest(t,'neck'),
        hip = latest(t,'hips'), fatM = latest(t,'fat');
    var w = W ? W.v : null;
    var h = Number(t.height) || null;
    var a = ageOf(t);
    var sex = t.gender === 'זכר' ? 'm' : t.gender === 'נקבה' ? 'f' : null;

    var o = { f: {}, missing: [], weight:W, height:h, age:a, sex:sex,
              waist:waist, neck:neck, hip:hip, fatMeasured:fatM };
    if (!w) o.missing.push('משקל');
    if (!h) o.missing.push('גובה');
    if (!a) o.missing.push('תאריך לידה');
    if (!sex) o.missing.push('מין');

    /* ---------- BMI ---------- */
    if (w && h) {
      var m = h / 100;
      o.bmi = r1(w / (m*m));
      o.f.bmi = w + ' ÷ ' + r2(m*m) + ' (' + m + ' מ׳ בריבוע)';
      o.bmiClass = o.bmi < 18.5 ? 'תת-משקל' : o.bmi < 25 ? 'תקין'
                 : o.bmi < 30 ? 'עודף משקל' : o.bmi < 35 ? 'השמנה דרגה 1'
                 : o.bmi < 40 ? 'השמנה דרגה 2' : 'השמנה דרגה 3';
      o.weightRange = [r1(18.5*m*m), r1(24.9*m*m)];
      o.f.weightRange = '18.5 עד 24.9 כפול ' + r2(m*m);
    }

    /* ---------- אחוז שומן ---------- */
    if (fatM) { o.fat = fatM.v; o.fatSrc = 'measured'; o.f.fat = 'נמדד ' + fmtDate(fatM.date); }

    // US Navy — עדיף על Deurenberg כי הוא מודד היקפים ולא נשען על BMI
    if (h && waist && neck && (sex === 'm' || (sex === 'f' && hip))) {
      var hIn = h * IN, wIn = waist.v * IN, nIn = neck.v * IN;
      var navy;
      if (sex === 'm') {
        navy = 86.010*log10(wIn - nIn) - 70.041*log10(hIn) + 36.76;
        o.f.navy = '86.010·log₁₀(' + r1(wIn) + '−' + r1(nIn) + ') − 70.041·log₁₀(' + r1(hIn) + ') + 36.76';
      } else {
        var hipIn = hip.v * IN;
        navy = 163.205*log10(wIn + hipIn - nIn) - 97.684*log10(hIn) - 78.387;
        o.f.navy = '163.205·log₁₀(' + r1(wIn) + '+' + r1(hipIn) + '−' + r1(nIn) + ') − 97.684·log₁₀(' + r1(hIn) + ') − 78.387';
      }
      if (isFinite(navy) && navy > 2 && navy < 70) {
        o.navy = r1(navy);
        if (!fatM) { o.fat = o.navy; o.fatSrc = 'navy'; }
      }
    } else if (h && waist && !neck) {
      o.needForNavy = sex === 'f' ? 'היקף צוואר וירכיים' : 'היקף צוואר';
    }

    // Deurenberg — גיבוי כשאין היקפים. נשען על BMI ולכן שוגה במאומנים
    if (o.bmi && a && sex) {
      o.deuren = r1(1.20*o.bmi + 0.23*a - 10.8*(sex==='m'?1:0) - 5.4);
      o.f.deuren = '1.20·' + o.bmi + ' + 0.23·' + a + ' − 10.8·' + (sex==='m'?1:0) + ' − 5.4';
      if (o.fat == null) { o.fat = o.deuren; o.fatSrc = 'deurenberg'; }
    }

    if (o.fat != null && w) {
      o.fatKg  = r1(w * o.fat/100);
      o.leanKg = r1(w - o.fatKg);
      o.f.lean = w + ' − ' + o.fatKg + ' (' + o.fat + '% שומן)';
      var bands = sex === 'f'
        ? [['חיוני',10,13],['אתלטי',14,20],['כשיר',21,24],['ממוצע',25,31],['גבוה',32,99]]
        : [['חיוני',2,5],['אתלטי',6,13],['כשיר',14,17],['ממוצע',18,24],['גבוה',25,99]];
      var band = null;
      bands.forEach(function (x) { if (!band && o.fat <= x[2]) band = x[0]; });
      o.fatBand = band || 'גבוה';

      if (h) {
        /* FFMI — מסה רזה ביחס לגובה. מדד טוב יותר מ-BMI לספורטאים,
           כי הוא לא "מעניש" על שריר. מנורמל לגובה 1.80 מ׳. */
        var mm = h/100;
        o.ffmi = r1(o.leanKg / (mm*mm));
        o.ffmiNorm = r1(o.ffmi + 6.1*(1.8 - mm));
        o.f.ffmi = o.leanKg + ' ÷ ' + r2(mm*mm) + '  ·  מנורמל: +6.1·(1.8−' + mm + ')';
        o.ffmiBand = sex === 'f'
          ? (o.ffmiNorm < 15 ? 'מתחת לממוצע' : o.ffmiNorm < 18 ? 'טוב' : o.ffmiNorm < 21 ? 'מצוין' : 'גבוה מאוד')
          : (o.ffmiNorm < 18 ? 'מתחת לממוצע' : o.ffmiNorm < 20 ? 'ממוצע' : o.ffmiNorm < 22 ? 'טוב'
             : o.ffmiNorm < 25 ? 'מצוין' : 'גבוה מאוד');
      }
    }

    /* ---------- יחסי היקפים ---------- */
    if (waist && h) {
      o.whtr = r2(waist.v / h);
      o.f.whtr = waist.v + ' ÷ ' + h;
      o.whtrOk = o.whtr < 0.5;
    }
    if (waist && hip) {
      o.whr = r2(waist.v / hip.v);
      o.f.whr = waist.v + ' ÷ ' + hip.v;
      o.whrOk = sex === 'f' ? o.whr < 0.85 : o.whr < 0.90;
    }

    /* ---------- BMR בשלוש שיטות ---------- */
    o.bmrAll = {};
    if (w && h && a) {
      var male = 10*w + 6.25*h - 5*a + 5, female = 10*w + 6.25*h - 5*a - 161;
      o.bmrAll.mifflin = Math.round(sex==='f' ? female : sex==='m' ? male : (male+female)/2);
      o.f.mifflin = '10·' + w + ' + 6.25·' + h + ' − 5·' + a + (sex==='f' ? ' − 161' : sex==='m' ? ' + 5' : ' (ממוצע בין המינים)');

      var hbM = 88.362 + 13.397*w + 4.799*h - 5.677*a;
      var hbF = 447.593 + 9.247*w + 3.098*h - 4.330*a;
      o.bmrAll.harris = Math.round(sex==='f' ? hbF : sex==='m' ? hbM : (hbM+hbF)/2);
      o.f.harris = sex==='f' ? '447.593 + 9.247·'+w+' + 3.098·'+h+' − 4.330·'+a
                             : '88.362 + 13.397·'+w+' + 4.799·'+h+' − 5.677·'+a;
    }
    if (o.leanKg) {
      o.bmrAll.katch = Math.round(370 + 21.6*o.leanKg);
      o.f.katch = '370 + 21.6·' + o.leanKg + ' (מסה רזה)';
    }
    /* Katch-McArdle עדיף כשמסת הגוף הרזה ידועה — נוסחאות שנשענות
       על משקל בלבד שוגות ביותר מ-10% אצל רזים מאוד או שמנים מאוד. */
    o.bmr = o.bmrAll.katch || o.bmrAll.mifflin || null;
    o.bmrSrc = o.bmrAll.katch ? 'Katch-McArdle' : o.bmrAll.mifflin ? 'Mifflin-St Jeor' : null;

    /* ---------- TDEE ---------- */
    var ACT = [
      {d:0,f:1.2,t:'יושבני, בלי אימונים'}, {d:1,f:1.375,t:'1–3 אימונים בשבוע'},
      {d:3,f:1.55,t:'3–5 אימונים בשבוע'},  {d:6,f:1.725,t:'6–7 אימונים בשבוע'},
      {d:8,f:1.9,t:'אימון פעמיים ביום'}
    ];
    var days = Number(ik(t,'daysPerWeek')) || (((t.program||{}).days||[]).length) || 3;
    var act = ACT[0]; ACT.forEach(function (x) { if (days >= x.d) act = x; });
    o.days = days; o.act = act;
    if (o.bmr) {
      o.tdee = Math.round(o.bmr * act.f);
      o.f.tdee = o.bmr + ' × ' + act.f + '  (' + days + ' ימי אימון)';
    }

    /* ---------- מטרה ויעד קלורי ---------- */
    var g = /מסה|מסת שריר|היפרטרופ|לעלות/.test(String(t.goal||'')+' '+String(t.notes||'')) ? 'mass'
          : /חיטוב|ירידה|לרזות|שומן|להחטיב/.test(String(t.goal||'')+' '+String(t.notes||'')) ? 'cut' : 'keep';
    o.goal = g;
    o.goalTxt = {cut:'חיטוב וירידה', mass:'עלייה במסה', keep:'שמירה'}[g];
    if (o.tdee) {
      var adj = g==='cut' ? 0.80 : g==='mass' ? 1.12 : 1;
      o.kcal = Math.round(o.tdee * adj);
      o.f.kcal = o.tdee + ' × ' + adj + '  (' + (g==='cut'?'גירעון 20%':g==='mass'?'עודף 12%':'ללא שינוי') + ')';
    }

    /* ---------- מאקרו ---------- */
    if (w && o.kcal) {
      /* חלבון לפי ISSN: 1.4–2.0 ג׳/ק״ג לרוב המתאמנים, ו-2.3–3.1
         בגירעון קלורי כדי לשמר מסה רזה. */
      var pk = g==='cut' ? 2.4 : g==='mass' ? 1.9 : 1.6;
      o.protein = Math.round(w * pk);
      o.proteinPerKg = pk;
      o.proteinRange = g==='cut' ? [Math.round(w*2.3), Math.round(w*3.1)] : [Math.round(w*1.4), Math.round(w*2.0)];
      o.f.protein = w + ' × ' + pk + ' ג׳/ק״ג  (ISSN: ' + (g==='cut' ? '2.3–3.1 בגירעון' : '1.4–2.0') + ')';
      o.perMeal = [Math.round(w*0.25), 40];
      o.f.perMeal = w + ' × 0.25 ג׳/ק״ג למנה, או 20–40 ג׳';

      /* שומן: לא פחות מ-20% מהקלוריות ולא פחות מ-0.8 ג׳/ק״ג —
         מתחת לזה נפגעת יצירת הורמוני מין וספיגת ויטמינים מסיסי שומן. */
      var fatByW = w * 0.9, fatMin = Math.max(w*0.8, o.kcal*0.20/9);
      o.fatG = Math.round(Math.max(fatByW, fatMin));
      o.fatPct = Math.round(o.fatG*9 / o.kcal * 100);
      o.f.fatG = 'הגבוה מבין: ' + w + '×0.9 = ' + Math.round(fatByW)
               + ' · מינימום ' + Math.round(fatMin) + ' (20% מהקלוריות או 0.8 ג׳/ק״ג)';

      o.carbs = Math.max(0, Math.round((o.kcal - o.protein*4 - o.fatG*9) / 4));
      o.carbsPct = Math.round(o.carbs*4 / o.kcal * 100);
      o.f.carbs = '(' + o.kcal + ' − ' + o.protein + '×4 − ' + o.fatG + '×9) ÷ 4';
      o.proteinPct = Math.round(o.protein*4 / o.kcal * 100);

      o.water = Math.max(2.5, r1(w * 35 / 1000));
      o.f.water = w + ' × 35 מ״ל/ק״ג';

      o.fiber = Math.round(o.kcal / 1000 * 14);
      o.f.fiber = o.kcal + ' ÷ 1000 × 14 ג׳';
    }

    /* ---------- קצב שינוי ---------- */
    if (w && o.kcal) {
      if (g==='cut')       o.rate = {txt:'ירידה', lo:r1(w*0.005), hi:r1(w*0.01), f:'0.5–1% ממשקל הגוף בשבוע'};
      else if (g==='mass') o.rate = {txt:'עלייה', lo:r1(w*0.0025), hi:r1(w*0.005), f:'0.25–0.5% ממשקל הגוף בשבוע'};
      if (o.rate && o.weightRange) {
        var tgt = o.weightRange[1], diff = Math.abs(w - tgt);
        if (diff > 0.5) o.weeks = Math.ceil(diff / ((o.rate.lo+o.rate.hi)/2));
      }
    }

    /* ---------- משקל אידיאלי, ארבע נוסחאות ---------- */
    if (h && sex) {
      var inchesOver5ft = Math.max(0, (h - 152.4) * IN);
      o.ideal = {
        devine:   r1((sex==='m' ? 50   : 45.5) + 2.3*inchesOver5ft),
        robinson: r1((sex==='m' ? 52   : 49  ) + (sex==='m'?1.9:1.7)*inchesOver5ft),
        miller:   r1((sex==='m' ? 56.2 : 53.1) + (sex==='m'?1.41:1.36)*inchesOver5ft),
        hamwi:    r1((sex==='m' ? 48   : 45.5) + (sex==='m'?2.7:2.2)*inchesOver5ft)
      };
      o.f.ideal = 'בסיס לגובה 152 ס״מ + תוספת לכל אינץ׳ מעל (' + r1(inchesOver5ft) + ' אינץ׳)';
    }

    /* ---------- דופק ---------- */
    if (a) {
      o.hrMax = Math.round(208 - 0.7*a);
      o.f.hrMax = '208 − 0.7 × ' + a + '  (Tanaka — מדויק יותר מ-220 פחות גיל)';
      var rhr = Number(ik(t,'restingHr')) || Number(t.restingHr) || null;
      o.restHr = rhr;
      if (rhr) {
        // Karvonen — אחוז מרזרבת הדופק, מדויק יותר מאחוז מהמקסימלי
        var res = o.hrMax - rhr;
        o.zones = [
          ['התאוששות 50–60%', Math.round(rhr+res*0.50), Math.round(rhr+res*0.60)],
          ['שריפת שומן 60–70%', Math.round(rhr+res*0.60), Math.round(rhr+res*0.70)],
          ['אירובי 70–80%', Math.round(rhr+res*0.70), Math.round(rhr+res*0.80)],
          ['סף אנאירובי 80–90%', Math.round(rhr+res*0.80), Math.round(rhr+res*0.90)]
        ];
        o.f.zones = 'Karvonen: ' + rhr + ' + (' + o.hrMax + '−' + rhr + ') × אחוז';
      } else {
        o.zones = [
          ['שריפת שומן 60–70%', Math.round(o.hrMax*0.60), Math.round(o.hrMax*0.70)],
          ['אירובי 70–80%', Math.round(o.hrMax*0.70), Math.round(o.hrMax*0.80)],
          ['סף אנאירובי 80–90%', Math.round(o.hrMax*0.80), Math.round(o.hrMax*0.90)]
        ];
        o.f.zones = 'אחוז מהדופק המקסימלי. עם דופק מנוחה אפשר לחשב מדויק יותר (Karvonen).';
      }
    }

    o.life = { sleep:ik(t,'sleepHours'), sleepQ:ik(t,'sleepQuality'), stress:ik(t,'stress'),
               waterNow:ik(t,'water'), place:ik(t,'location'), diet:ik(t,'diet'),
               supps:ik(t,'supplements') || t.supplements };
    return o;
  }

  /* ---------- 1RM ---------- */
  function oneRM(weight, reps) {
    var w = Number(weight), r = Number(reps);
    if (!w || !r || r < 1) return null;
    var epley = w * (1 + r/30);
    var brz   = r < 37 ? w / (1.0278 - 0.0278*r) : null;
    return {
      epley: Math.round(epley), brzycki: brz ? Math.round(brz) : null,
      best: Math.round(r <= 10 && brz ? brz : epley),
      pref: r <= 10 ? 'Brzycki' : 'Epley'
    };
  }

  /* =====================================================================
     תצוגה
     ===================================================================== */
  var SHOW_F = false;

  function row(label, value, note, flag, formula) {
    if (value === undefined || value === null || value === '') return '';
    return '<div class="line-item" style="align-items:flex-start">'
      + '<span class="muted" style="width:158px;font-size:13px;flex:none;padding-top:2px">' + esc(label) + '</span>'
      + '<span style="flex:1;min-width:0">'
      + '<span style="font-size:14.5px">' + esc(value) + '</span>'
      + (flag ? ' <span style="font-size:11px;color:var(--amber)">' + esc(flag) + '</span>' : '')
      + (SHOW_F && formula ? '<div class="muted" style="font-size:11.5px;margin-top:3px;direction:ltr;text-align:right;font-family:ui-monospace,monospace">' + esc(formula) + '</div>' : '')
      + '</span>'
      + (note ? '<span class="muted" style="font-size:12px;flex:none">' + esc(note) + '</span>' : '')
      + '</div>';
  }
  function box(title, inner, sub) {
    if (!inner) return '';
    return '<div class="card" style="margin-top:12px">'
      + '<h3 style="font-size:15px;margin-bottom:' + (sub?'2px':'8px') + '">' + esc(title) + '</h3>'
      + (sub ? '<div class="muted" style="font-size:12px;margin-bottom:10px">' + esc(sub) + '</div>' : '')
      + inner + '</div>';
  }

  function tab(t) {
    var o = compute(t), h = '';

    h += '<div class="row" style="margin-bottom:4px">'
      + '<button class="btn sm ' + (SHOW_F?'':'ghost') + '" onclick="EBMetrics.toggle()">'
      + (SHOW_F ? 'הסתרת הנוסחאות' : 'הצגת הנוסחאות') + '</button>'
      + '<div style="flex:1"></div>'
      + '<button class="btn sm ghost" onclick="EBMetrics.rm(\'' + t.id + '\')">מחשבון 1RM</button></div>';

    if (o.missing.length || o.needForNavy) {
      h += '<div class="card" style="border-color:rgba(255,197,61,.35)">'
        + '<h3 style="font-size:15px;margin-bottom:6px">מה שחסר</h3>'
        + (o.missing.length ? '<p style="font-size:13.5px;margin:0 0 6px">לחישוב בסיסי: <b>' + esc(o.missing.join(' · ')) + '</b></p>' : '')
        + (o.needForNavy ? '<p style="font-size:13.5px;margin:0 0 6px">לאחוז שומן מדויק יותר: <b>' + esc(o.needForNavy) + '</b> — נוסחת US Navy מודדת היקפים ולא נשענת על BMI.</p>' : '')
        + '<div class="row" style="margin-top:8px">'
        + '<button class="btn sm ghost" onclick="editTrainee(\'' + t.id + '\')">עריכת פרטים</button>'
        + '<button class="btn sm ghost" onclick="SUBTAB=\'measures\';render()">הוספת מדידה</button></div></div>';
    }

    /* --- הרכב גוף --- */
    var b = '';
    if (o.weight) b += row('משקל', o.weight.v + ' ק״ג', fmtDate(o.weight.date));
    if (o.height) b += row('גובה', o.height + ' ס״מ');
    if (o.bmi)    b += row('BMI', o.bmi + ' — ' + o.bmiClass, '', '', o.f.bmi);
    if (o.fat != null)
      b += row('אחוז שומן', o.fat + '% — ' + o.fatBand, '',
               o.fatSrc==='measured' ? '' : o.fatSrc==='navy' ? 'US Navy' : 'Deurenberg',
               o.fatSrc==='navy' ? o.f.navy : o.fatSrc==='deurenberg' ? o.f.deuren : o.f.fat);
    if (o.navy && o.fatSrc!=='navy') b += row('· לפי US Navy', o.navy + '%', '', '', o.f.navy);
    if (o.deuren && o.fatSrc!=='deurenberg') b += row('· לפי Deurenberg', o.deuren + '%', '', '', o.f.deuren);
    if (o.fatKg)  b += row('מסת שומן', o.fatKg + ' ק״ג');
    if (o.leanKg) b += row('מסה רזה', o.leanKg + ' ק״ג', '', '', o.f.lean);
    if (o.ffmiNorm) b += row('FFMI מנורמל', o.ffmiNorm + ' — ' + o.ffmiBand, '', '', o.f.ffmi);
    if (o.whtr)   b += row('יחס מותן-גובה', o.whtr + (o.whtrOk?' — תקין':' — מעל הסף 0.5'), '', '', o.f.whtr);
    if (o.whr)    b += row('יחס מותן-ירך', o.whr + (o.whrOk?' — תקין':' — מעל הסף'), '', '', o.f.whr);
    if (o.weightRange) b += row('טווח משקל תקין', o.weightRange[0] + '–' + o.weightRange[1] + ' ק״ג', 'BMI 18.5–24.9', '', o.f.weightRange);
    h += box('הרכב גוף', b,
      o.fatSrc==='deurenberg' ? 'אחוז השומן מחושב מ-BMI ולכן שוגה כלפי מעלה אצל מאומנים — שריר מנפח את ה-BMI.' : '');

    /* --- משקל אידיאלי --- */
    if (o.ideal) {
      var id = '';
      id += row('Devine', o.ideal.devine + ' ק״ג', 'הנפוצה ברפואה');
      id += row('Robinson', o.ideal.robinson + ' ק״ג', '1983');
      id += row('Miller', o.ideal.miller + ' ק״ג', '1983');
      id += row('Hamwi', o.ideal.hamwi + ' ק״ג', '1964');
      h += box('משקל אידיאלי לפי הגובה', id,
        'ארבע נוסחאות שנותנות טווח. הן מתעלמות מהרכב גוף, ולכן פחות רלוונטיות למאומנים — FFMI וטווח ה-BMI מדויקים יותר.');
    }

    /* --- אנרגיה --- */
    var e = '';
    if (o.bmrAll.mifflin) e += row('BMR · Mifflin-St Jeor', o.bmrAll.mifflin + ' קק״ל', '1990', '', o.f.mifflin);
    if (o.bmrAll.harris)  e += row('BMR · Harris-Benedict', o.bmrAll.harris + ' קק״ל', 'מתוקן 1984', '', o.f.harris);
    if (o.bmrAll.katch)   e += row('BMR · Katch-McArdle', o.bmrAll.katch + ' קק״ל', 'לפי מסה רזה', '', o.f.katch);
    if (o.bmr)  e += row('BMR נבחר', o.bmr + ' קק״ל', o.bmrSrc);
    if (o.tdee) e += row('TDEE', o.tdee + ' קק״ל', o.act.t, '', o.f.tdee);
    if (o.kcal) e += row('יעד יומי', o.kcal + ' קק״ל', o.goalTxt, '', o.f.kcal);
    if (o.rate) e += row('קצב ' + o.rate.txt + ' מומלץ', o.rate.lo + '–' + o.rate.hi + ' ק״ג בשבוע', '', '', o.rate.f);
    if (o.weeks) e += row('הערכת זמן', o.weeks + ' שבועות', 'לטווח התקין');
    h += box('אנרגיה', e,
      o.bmrAll.katch ? 'נבחר Katch-McArdle — הוא נשען על מסה רזה, ומדויק יותר כשאחוז השומן ידוע.'
                     : (o.sex ? '' : 'המין לא מוגדר — החישוב הוא ממוצע בין הנוסחאות, הפרש של כ-166 קק״ל.'));

    /* --- מאקרו --- */
    var mc = '';
    if (o.protein) {
      mc += row('חלבון', o.protein + ' ג׳', o.proteinPct + '% · ' + o.proteinPerKg + ' ג׳/ק״ג', '', o.f.protein);
      mc += row('· טווח ISSN', o.proteinRange[0] + '–' + o.proteinRange[1] + ' ג׳');
      mc += row('· למנה', o.perMeal[0] + '–' + o.perMeal[1] + ' ג׳', 'כל 3–4 שעות', '', o.f.perMeal);
      mc += row('פחמימות', o.carbs + ' ג׳', o.carbsPct + '%', '', o.f.carbs);
      mc += row('שומן', o.fatG + ' ג׳', o.fatPct + '%', o.fatPct < 20 ? 'נמוך' : '', o.f.fatG);
      mc += row('סיבים', o.fiber + ' ג׳', '14 ג׳ לכל 1000 קק״ל', '', o.f.fiber);
      mc += row('מים', o.water + ' ליטר', '', '', o.f.water);
    }
    h += box('תפריט יומי', mc,
      'חלבון לפי ISSN Position Stand. שומן לא יורד מתחת ל-20% מהקלוריות ולא מתחת ל-0.8 ג׳/ק״ג — מתחת לזה נפגעת יצירת הורמוני מין וספיגת ויטמינים מסיסי שומן. פחמימות הן היתרה.');

    /* --- דופק --- */
    var hr = '';
    if (o.hrMax) {
      hr += row('דופק מקסימלי', o.hrMax + ' פעימות', '', '', o.f.hrMax);
      if (o.restHr) hr += row('דופק מנוחה', o.restHr);
      (o.zones||[]).forEach(function (z) { hr += row(z[0], z[1] + '–' + z[2]); });
    }
    h += box('אזורי דופק', hr, o.f.zones);

    /* --- היקפים --- */
    var c = '';
    [['waist','מותן'],['hips','ירכיים'],['neck','צוואר'],['chest','חזה'],['arm','זרוע'],['thigh','ירך']]
      .forEach(function (p) { var m = latest(t,p[0]); if (m) c += row(p[1], m.v + ' ס״מ', fmtDate(m.date)); });
    h += box('היקפים', c, 'שינוי בהיקפים מקדים לרוב שינוי במשקל — כדאי למדוד כל שבועיים.');

    /* --- אורח חיים --- */
    var L = o.life, lf = '';
    lf += row('ימי אימון בשבוע', o.days);
    lf += row('מיקום אימון', L.place);
    lf += row('שעות שינה', L.sleep, L.sleepQ || '');
    lf += row('רמת סטרס', L.stress ? L.stress + ' מתוך 10' : '');
    lf += row('שתיית מים כיום', L.waterNow ? L.waterNow + ' ליטר' : '', '',
              o.water && L.waterNow && Number(L.waterNow) < o.water ? 'מתחת ליעד' : '');
    lf += row('תזונה ומגבלות', L.diet);
    lf += row('תוספים', L.supps);
    h += box('אורח חיים', lf);

    h += '<div class="muted" style="font-size:12px;margin-top:14px;line-height:1.7">'
      + '<b>מקורות:</b> Mifflin-St Jeor 1990 · Harris-Benedict מתוקן (Roza) 1984 · Katch-McArdle · '
      + 'US Navy / Hodgdon-Beckett 1984 · Deurenberg 1991 · ISSN Position Stand: Protein and Exercise 2017 · '
      + 'Tanaka 2001 · Karvonen · Epley 1985 · Brzycki 1993.<br>'
      + 'כל אלה נוסחאות לאוכלוסייה בריאה — נקודת פתיחה שמתכווננת לפי התוצאות בפועל, לא מרשם. '
      + 'ויטמינים, מינרלים ומינונים לא מחושבים כאן: אלה החלטות רפואיות שתלויות בבדיקות דם.</div>';
    return h;
  }

  function toggle(){ SHOW_F = !SHOW_F; render(); }

  /* מחשבון 1RM */
  function rm(id) {
    openModal('<div class="mh"><h3>מחשבון 1RM</h3><button class="iconbtn" onclick="closeModal()">✕</button></div>'
      + '<div class="mb"><p class="muted" style="font-size:13px;margin:0 0 12px">'
      + 'מעריך את המשקל המרבי לחזרה אחת מסט שבוצע עד כשל. מדויק עד 10 חזרות; מעבר לזה העייפות משתלטת.</p>'
      + '<div class="grid g2">'
      + '<div><label class="f">משקל (ק״ג)</label><input class="f" id="rm_w" type="number" inputmode="decimal"></div>'
      + '<div><label class="f">חזרות שבוצעו</label><input class="f" id="rm_r" type="number" inputmode="numeric"></div>'
      + '</div><div id="rm_out" style="margin-top:14px"></div></div>'
      + '<div class="mf"><button class="btn" onclick="EBMetrics.calcRM()">חישוב</button>'
      + '<button class="btn ghost" onclick="closeModal()">סגירה</button></div>', true);
  }
  function calcRM() {
    var r = oneRM(gv('rm_w'), gv('rm_r'));
    var el = document.getElementById('rm_out');
    if (!r) { el.innerHTML = '<div class="muted" style="font-size:13px">צריך משקל ומספר חזרות</div>'; return; }
    var w = Number(gv('rm_w'));
    var pcts = [[100,'1RM'],[95,'2–3 חזרות'],[90,'4 חזרות'],[85,'6 חזרות'],[80,'8 חזרות'],[75,'10 חזרות'],[70,'12 חזרות']];
    el.innerHTML = '<div class="card" style="padding:12px">'
      + row('Epley', r.epley + ' ק״ג', '', '', 'w × (1 + r ÷ 30)')
      + (r.brzycki ? row('Brzycki', r.brzycki + ' ק״ג', '', '', 'w ÷ (1.0278 − 0.0278·r)') : '')
      + row('הערכה נבחרת', r.best + ' ק״ג', r.pref)
      + '</div><div class="card" style="padding:12px;margin-top:10px">'
      + '<div class="muted" style="font-size:12.5px;margin-bottom:8px">משקלי עבודה לפי אחוז מה-1RM</div>'
      + pcts.map(function (p) {
          return '<div class="line-item"><span class="muted" style="width:90px;font-size:13px">' + p[0] + '%</span>'
            + '<span style="flex:1;font-size:14px">' + Math.round(r.best*p[0]/100) + ' ק״ג</span>'
            + '<span class="muted" style="font-size:12px">' + p[1] + '</span></div>';
        }).join('') + '</div>';
  }

  window.EBMetrics = { tab:tab, compute:compute, toggle:toggle, rm:rm, calcRM:calcRM, oneRM:oneRM };
})();

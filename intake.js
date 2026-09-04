/* =====================================================================
   E.B FIT — קליטת מתאמן משאלון
   ---------------------------------------------------------------------
   מפענח מקומי, רץ כולו בדפדפן. בלי שרת, בלי מפתח API, בלי עלות.

   הפענוח שמרני בכוונה: מה שלא זוהה בוודאות נשאר ריק ומוצג לאישור
   לפני היצירה. עדיף שדה ריק שהמאמן ימלא, מאשר ניחוש שגוי שנשמר בשקט.
   ===================================================================== */
(function () {
  'use strict';

  // חותמת גרסה — index.html משווה אליה כדי לזהות קובץ ישן במטמון
  (window.EB_MOD = window.EB_MOD || {})['intake'] = 'v66';

  /* ---------- מילון: תווית בשאלון -> שדה במערכת ---------- */
  /* הסדר משנה — הביטוי הראשון שמתאים מנצח, ולכן ביטויים ארוכים
     וספציפיים חייבים להופיע לפני הקצרים ('משקל עדכני' לפני 'משקל'). */
  var MAP = [
    ['name',        ['שם מלא', 'שם המתאמן', 'שם']],
    ['birthOrAge',  ['תאריך לידה', 'גיל']],
    ['phone',       ['מספר טלפון', 'טלפון', 'נייד']],
    ['email',       ['דואל', 'דוא"ל', 'אימייל', 'מייל']],
    ['occupation',  ['עיסוק', 'שגרת יום']],
    ['weight',      ['משקל עדכני', 'משקל נוכחי', 'משקל']],
    ['height',      ['גובה']],
    ['waist',       ['בטן']],
    ['chest',       ['חזה']],
    ['arm',         ['זרוע']],
    ['thigh',       ['ירך']],
    ['goal',        ['המטרה המרכזית', 'מטרה מרכזית', 'מטרה עיקרית']],
    ['goal2',       ['המטרה המשנית', 'מטרה משנית']],
    ['success3m',   ['הצלחה בתוכנית', 'יחשב מבחינתך להצלחה', 'הצלחה']],
    ['injuries',    ['פציעות עבר', 'פציעות אקטיביות', 'פציעות']],
    ['medical',     ['בעיות רפואיות', 'מחלות רקע', 'בעיות רפואיות/מחלות רקע']],
    ['pain',        ['כאבים המופיעים', 'כאבים']],
    ['medCert',     ['אישור רפואי']],
    ['experience',  ['הוותק שלך', 'ותק', 'ניסיון']],
    ['recentTrain', ['תרגילים/אימונים ביצעת', 'אימונים ביצעת', 'תרגילים']],
    ['daysPerWeek', ['ימים בשבוע']],
    ['location',    ['מיקום האימונים', 'מיקום']],
    ['sleepHours',  ['שעות שינה']],
    ['sleepQuality',['איכות השינה', 'איכות שינה']],
    ['stress',      ['מתח/סטרס', 'סטרס', 'מתח']],
    ['water',       ['צריכת מים', 'מים']],
    ['diet',        ['מגבלות תזונתיות', 'העדפות תזונתיות', 'מגבלות']],
    ['supplements', ['תוספי תזונה', 'תוספים']]
  ];

  /* תוויות לתצוגה */
  var HE = {
    name:'שם מלא', birthOrAge:'תאריך לידה / גיל', phone:'טלפון', email:'דוא״ל',
    occupation:'עיסוק ושגרת יום', weight:'משקל (ק״ג)', height:'גובה (ס״מ)',
    waist:'היקף בטן', chest:'היקף חזה', arm:'היקף זרוע', thigh:'היקף ירך',
    goal:'מטרה מרכזית', goal2:'מטרה משנית', success3m:'הגדרת הצלחה ל-3 חודשים',
    injuries:'פציעות', medical:'רקע רפואי', pain:'כאבים במאמץ', medCert:'אישור רפואי',
    experience:'ותק באימונים', recentTrain:'אימונים אחרונים', daysPerWeek:'ימים בשבוע',
    location:'מיקום אימון', sleepHours:'שעות שינה', sleepQuality:'איכות שינה',
    stress:'רמת סטרס (1-10)', water:'שתיית מים (ליטר)', diet:'תזונה ומגבלות',
    supplements:'תוספי תזונה'
  };

  /* שדות שנכנסים לכרטיס המתאמן עצמו; השאר נשמר ברשומת השאלון */
  var CORE = ['name','phone','height','birthOrAge','goal','experience'];

  /* ---------- כלי עזר ---------- */
  function clean(v) {
    return String(v == null ? '' : v)
      .replace(/[_]{2,}/g, ' ')      // ______ מהתבנית הריקה
      .replace(/^[\s:*•\-–—]+/, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  // מסיר סוגריים עם רשימת אפשרויות, כדי שהתווית תהיה נקייה להשוואה
  function labelKey(s) {
    return String(s || '')
      .replace(/\([^)]*\)/g, ' ')
      .replace(/["'׳״?]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  function isLabelLine(s) {
    var t = clean(s);
    return !t || /:/.test(t) || /\?/.test(t) || /^\d+\./.test(String(s).trim());
  }
  // מחפש את הערך בשורות הבאות, אם השורה הנוכחית נשארה ריקה
  function lookAhead(lines, i) {
    for (var j = i + 1; j < Math.min(i + 3, lines.length); j++) {
      if (isLabelLine(lines[j])) return null;
      var v = clean(lines[j]);
      if (v) return { v: v, i: j };
    }
    return null;
  }
  /* התאמת מילה שלמה, מודעת לעברית.
     \b של JS חסר תועלת כאן — אותיות עבריות אינן \w, ולכן /\bכן\b/ תמיד נכשל.
     בלי זה גם נתפסות מילים בתוך מילים: 'גיל' יושב בתוך 'תרגילים',
     מה שגרם לשאלה על התרגילים להיקלט כשדה הגיל. */
  var HEB = /[֐-׿]/;
  function hasWord(hay, needle) {
    var i = hay.indexOf(needle);
    while (i > -1) {
      var before = i === 0 ? '' : hay.charAt(i - 1);
      var after  = hay.charAt(i + needle.length);
      if (!HEB.test(before) && !HEB.test(after)) return true;
      i = hay.indexOf(needle, i + 1);
    }
    return false;
  }

  function matchKey(label) {
    var L = labelKey(label);
    if (!L) return null;
    for (var i = 0; i < MAP.length; i++) {
      var syns = MAP[i][1];
      for (var j = 0; j < syns.length; j++) {
        if (hasWord(L, syns[j])) return MAP[i][0];
      }
    }
    return null;
  }

  /* ---------- המפענח ---------- */
  function parseIntake(text) {
    var lines = String(text || '').split(/\r?\n/);
    var out = {}, unknown = [];

    for (var i = 0; i < lines.length; i++) {
      var raw = lines[i];
      var L = String(raw).replace(/^[\s*•\-–—]+/, '').replace(/^\d+\.\s*/, '').trim();
      if (!L) continue;

      // שורת היקפים: "בטן: 88 | חזה: 100 | זרוע: 35"
      if (L.indexOf('|') > -1 && L.indexOf(':') > -1) {
        L.split('|').forEach(function (part) {
          var ci = part.indexOf(':');
          if (ci < 0) return;
          var k = matchKey(part.slice(0, ci)), v = clean(part.slice(ci + 1));
          if (k && v && !out[k]) out[k] = v;
        });
        continue;
      }

      var label = null, value = '';
      var ci2 = L.indexOf(':');
      var qi  = L.indexOf('?');

      if (ci2 > -1) {
        label = L.slice(0, ci2);
        value = clean(L.slice(ci2 + 1));
      } else if (qi > -1) {
        label = L.slice(0, qi + 1);
        value = clean(L.slice(qi + 1).replace(/\([^)]*\)/g, ' '));
      } else {
        continue;
      }

      if (!value) {
        var nx = lookAhead(lines, i);
        if (nx) { value = nx.v; i = nx.i; }
      }
      if (!value) continue;

      var key = matchKey(label);
      if (key) { if (!out[key]) out[key] = value; }
      else unknown.push({ label: labelKey(label), value: value });
    }

    out._unknown = unknown;
    return normalize(out);
  }

  /* ---------- נרמול ערכים ---------- */
  function normalize(o) {
    // טלפון: להשאיר ספרות בלבד, עם 0 מוביל
    if (o.phone) {
      var d = o.phone.replace(/\D/g, '');
      if (d.indexOf('972') === 0) d = '0' + d.slice(3);
      o.phone = d;
    }
    // מספרים
    ['weight','height','waist','chest','arm','thigh','sleepHours','stress','daysPerWeek'].forEach(function (k) {
      if (!o[k]) return;
      var m = String(o[k]).match(/\d+(\.\d+)?/);
      o[k] = m ? Number(m[0]) : '';
    });
    // תאריך לידה או גיל
    if (o.birthOrAge) {
      var s = o.birthOrAge;
      var dm = s.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
      var iso = s.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (iso) o.birth = iso[0];
      else if (dm) o.birth = dm[3] + '-' + pad(dm[2]) + '-' + pad(dm[1]);
      else {
        var age = String(s).match(/\b(\d{1,2})\b/);
        // גיל בלבד — נגזר תאריך משוער ומסומן ככזה
        if (age) { o.birth = (new Date().getFullYear() - Number(age[1])) + '-01-01'; o.birthApprox = true; }
      }
    }
    // ותק -> רמה
    if (o.experience) {
      var e = o.experience;
      // מתחיל נבדק ראשון: "מתחיל, שנתיים" הוא מתחיל, ואילו בדיקת
      // 'שנים' תחילה הייתה מסווגת אותו בטעות כמתקדם.
      o.level = /ללא ניסיון|מתחיל|חדש/.test(e) ? 'מתחיל'
              : /מתקדם|שנים|שנתי/.test(e)      ? 'מתקדם' : 'בינוני';
    }
    // אישור רפואי
    if (o.medCert) {
      var c = o.medCert;
      o.medCertOk = (hasWord(c,'כן') || hasWord(c,'בתוקף') || hasWord(c,'יש')) && !hasWord(c,'לא');
    }
    return o;
  }
  function pad(n) { return String(n).length < 2 ? '0' + n : String(n); }

  /* ---------- מסך ההדבקה ---------- */
  function intakeModal() {
    openModal(
      '<div class="mh"><h3>קליטה משאלון</h3><button class="iconbtn" onclick="closeModal()">✕</button></div>'
      + '<div class="mb"><p class="muted" style="font-size:13px;margin:0 0 10px">'
      + 'הדבק את השאלון המלא כפי שהמתאמן החזיר אותו. הפענוח מקומי — שום דבר לא נשלח החוצה.</p>'
      + '<textarea class="f" id="ik_txt" style="min-height:260px;font-size:13px" '
      + 'placeholder="הדבק כאן את כל השאלון…"></textarea></div>'
      + '<div class="mf"><button class="btn" onclick="EBIntake.preview()">פענוח</button>'
      + '<button class="btn ghost" onclick="closeModal()">ביטול</button></div>', true);
    setTimeout(function () { var e = document.getElementById('ik_txt'); if (e) e.focus(); }, 60);
  }

  /* ---------- תצוגה מקדימה לאישור ---------- */
  var PARSED = null;

  function preview() {
    var txt = (document.getElementById('ik_txt') || {}).value || '';
    if (!txt.trim()) { toast('צריך להדביק את השאלון'); return; }
    var p = parseIntake(txt);
    if (!p.name) { toast('לא זוהה שם — בדוק שהשאלון הודבק במלואו'); return; }
    PARSED = p;

    var h = '<div class="mh"><h3>אישור קליטה</h3><button class="iconbtn" onclick="closeModal()">✕</button></div><div class="mb">';

    h += '<p class="muted" style="font-size:13px;margin:0 0 10px">אפשר לתקן כל שדה לפני היצירה.</p>';
    h += '<div class="grid g2">'
      + f('שם מלא','ik_name', p.name || '')
      + f('טלפון','ik_phone', p.phone || '')
      + f('גובה (ס״מ)','ik_height', p.height || '')
      + f('משקל (ק״ג)','ik_weight', p.weight || '')
      + f('מטרה','ik_goal', p.goal || '')
      + f('תאריך לידה','ik_birth', p.birth || '', 'date')
      + '</div>';
    if (p.birthApprox)
      h += '<div class="muted" style="font-size:12px;margin-top:6px">תאריך הלידה נגזר מגיל בלבד — מדויק לשנה, לא ליום.</div>';

    // בריאות
    // תשובות שליליות ("אין", "לא") לא נכנסות להצהרה — הן רק מרעישות
    // אותה ומקשות לראות את מה שבאמת דורש תשומת לב.
    var neg = function (v) { return !v || /^(אין|לא|ללא|-|אין מגבלות)\.?$/.test(String(v).trim()); };
    var health = [!neg(p.injuries) && 'פציעות: ' + p.injuries,
                  !neg(p.medical)  && 'רקע רפואי: ' + p.medical,
                  !neg(p.pain)     && 'כאבים במאמץ: ' + p.pain].filter(Boolean).join('\n');
    if (health) {
      h += '<div class="sep"></div><label class="f">הצהרת בריאות</label>'
        + '<textarea class="f" id="ik_health" style="min-height:80px">' + esc(health) + '</textarea>'
        + '<div class="row" style="margin-top:8px"><label style="font-size:13px">'
        + '<input type="checkbox" id="ik_hok" ' + (p.medCertOk ? 'checked' : '') + '> יש אישור רפואי בתוקף</label></div>';
    }

    // כל השאר
    var extra = Object.keys(HE).filter(function (k) {
      return CORE.indexOf(k) < 0 && ['weight','birth','injuries','medical','pain','medCert'].indexOf(k) < 0 && p[k];
    });
    if (extra.length || (p._unknown || []).length) {
      h += '<div class="sep"></div><h3 style="font-size:14px;margin-bottom:8px">נשמר ברשומת השאלון</h3>'
        + '<div class="card" style="padding:10px">';
      extra.forEach(function (k) {
        h += '<div class="line-item"><span class="muted" style="width:150px;font-size:12.5px">' + esc(HE[k]) + '</span>'
          + '<span style="flex:1;font-size:13px">' + esc(p[k]) + '</span></div>';
      });
      (p._unknown || []).forEach(function (u) {
        h += '<div class="line-item"><span class="muted" style="width:150px;font-size:12.5px">' + esc(u.label.slice(0, 40)) + '</span>'
          + '<span style="flex:1;font-size:13px">' + esc(u.value) + '</span></div>';
      });
      h += '</div>';
    }

    h += '</div><div class="mf"><button class="btn" onclick="EBIntake.apply()">יצירת המתאמן</button>'
      + '<button class="btn ghost" onclick="EBIntake.open()">חזרה</button></div>';
    openModal(h, true);
  }

  function f(label, id, v, type) {
    return '<div><label class="f">' + label + '</label><input class="f" id="' + id
      + '" type="' + (type || 'text') + '" value="' + esc(v) + '"></div>';
  }

  /* ---------- יצירה ---------- */
  function apply() {
    var p = PARSED || {};
    var name = (document.getElementById('ik_name') || {}).value || '';
    name = name.trim();
    if (!name) { toast('צריך שם'); return; }

    var g = function (id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; };
    var n = function (id) { return Number(g(id) || 0); };

    // רשומת השאלון — כל מה שאין לו שדה ייעודי
    var intake = { date: todayISO(), answers: {}, extra: p._unknown || [] };
    Object.keys(HE).forEach(function (k) {
      if (CORE.indexOf(k) < 0 && p[k] !== undefined && p[k] !== '') intake.answers[k] = p[k];
    });

    var t = {
      id: uid(),
      name: name,
      phone: g('ik_phone'),
      height: n('ik_height'),
      goal: g('ik_goal'),
      birth: g('ik_birth'),
      level: p.level || 'מתחיל',
      status: 'active',
      joined: todayISO(),
      pkgTotal: S.settings.defaultPack, pkgUsed: 0,
      pricePerSession: S.settings.sessionPrice,
      notes: '',
      program: { days: [] },
      intake: intake
    };

    var healthEl = document.getElementById('ik_health');
    if (healthEl && healthEl.value.trim()) {
      t.health = healthEl.value.trim();
      var hok = document.getElementById('ik_hok');
      t.healthOk = hok ? hok.checked : false;
      if (!S.features.health) S.features.health = true;   // אחרת ההצהרה לא תוצג
    }

    S.trainees.push(t);

    // מדידה ראשונה — נקודת הפתיחה של גרף ההתקדמות
    var w = n('ik_weight');
    if (w || p.waist) {
      S.measures.push({
        id: uid(), traineeId: t.id, date: todayISO(),
        weight: w || '', fat: '', waist: p.waist || '', note: 'מהשאלון'
      });
    }

    save(); closeModal();
    toast(name + ' נקלט/ה מהשאלון');
    go('trainee', t.id);
  }

  /* ---------- כרטיסיית השאלון בתיק ---------- */
  function tabIntake(t) {
    var k = t.intake;
    if (!k) return '<div class="empty">לא נקלט שאלון עבור מתאמן זה.</div>';
    var h = '<div class="card"><div class="row" style="margin-bottom:10px">'
      + '<h3 style="flex:1;font-size:15px">שאלון קליטה</h3>'
      + '<span class="muted" style="font-size:12px">' + fmtFull(k.date) + '</span></div>';

    var ans = k.answers || {};
    var keys = Object.keys(ans);
    if (!keys.length && !(k.extra || []).length)
      h += '<div class="muted" style="font-size:13px">אין תשובות נוספות.</div>';

    keys.forEach(function (key) {
      h += '<div class="line-item"><span class="muted" style="width:170px;font-size:13px">' + esc(HE[key] || key) + '</span>'
        + '<span style="flex:1;font-size:14px">' + esc(ans[key]) + '</span></div>';
    });
    (k.extra || []).forEach(function (u) {
      h += '<div class="line-item"><span class="muted" style="width:170px;font-size:13px">' + esc(u.label.slice(0, 50)) + '</span>'
        + '<span style="flex:1;font-size:14px">' + esc(u.value) + '</span></div>';
    });
    return h + '</div>';
  }

  window.EBIntake = {
    open: intakeModal, preview: preview, apply: apply,
    parse: parseIntake, tab: tabIntake, labels: HE
  };
})();

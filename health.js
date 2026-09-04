/* =====================================================================
   E.B FIT — הצהרת בריאות וסינון סיכון לפני אימון
   ---------------------------------------------------------------------
   שני חלקים:

   1. הצהרה שהמתאמן ממלא וחותם עליה בקישור האישי שלו (t.html).
      שבע שאלות הסינון מבוססות על PAR-Q+, התקן המקובל לסינון לפני
      פעילות גופנית. תשובת "כן" אחת מספיקה כדי לדרוש אישור רופא.

   2. סורק שעובר על השאלונים שכבר קיימים במערכת ומסמן מי צריך
      להביא אישור, עוד לפני שהוא מילא הצהרה.

   שלושה עקרונות שהנחו את הלוגיקה:

   * היעדר מידע איננו "בריא". מתאמן בלי מידע רפואי מסומן 'unknown'
     ולא 'green'. זו ההבחנה החשובה ביותר בקובץ הזה — סיווג של חסר
     כתקין הוא בדיוק איך מפספסים את המקרה האחד שחשוב.

   * בספק — מפנים. הסיווג שמרני בכוונה. עדיף מתאמן אחד מיותר שילך
     לרופא, מאשר אחד שלא הלך וצריך היה.

   * זה סינון, לא אבחון. הקובץ הזה לא קובע שמישהו בריא, לא מאבחן
     ולא מאשר. הוא רק מחליט את מי להפנות לרופא.
   ===================================================================== */
(function () {
  'use strict';

  (window.EB_MOD = window.EB_MOD || {})['health'] = 'v67';

  /* ---------- שבע שאלות הסינון ---------- */
  /* כל אחת מהן, אם נענתה ב'כן', מחייבת אישור רופא לפני תחילת אימון. */
  var PARQ = [
    { k: 'q1', q: 'האם רופא אמר לך אי פעם שיש לך בעיה בלב, ושעליך לבצע רק פעילות גופנית שרופא ממליץ עליה?' },
    { k: 'q2', q: 'האם אתה חש כאב בחזה בזמן פעילות גופנית?' },
    { k: 'q3', q: 'בחודש האחרון, האם חשת כאב בחזה גם כשלא עסקת בפעילות גופנית?' },
    { k: 'q4', q: 'האם אתה מאבד שיווי משקל בגלל סחרחורת, או מאבד הכרה?' },
    { k: 'q5', q: 'האם יש לך בעיה בעצם או במפרק שעלולה להחמיר משינוי בפעילות הגופנית?' },
    { k: 'q6', q: 'האם רופא רושם לך כיום תרופות ללחץ דם או למחלת לב?' },
    { k: 'q7', q: 'האם ידועה לך סיבה אחרת כלשהי שבגללה אסור לך לעסוק בפעילות גופנית?' }
  ];

  /* ---------- מילות דגל בטקסט חופשי ---------- */
  /* אדום: מצבים שמחייבים אישור רופא לפני תחילת אימון. */
  var RED = [
    'לב', 'לבבי', 'התקף לב', 'אוטם', 'צנתור', 'סטנט', 'מסתם', 'אי ספיקת לב',
    'הפרעת קצב', 'פרפור', 'קוצב', 'תעוקה', 'אנגינה',
    'כאב בחזה', 'כאבים בחזה', 'לחץ בחזה',
    'שבץ', 'אירוע מוחי', 'קריש',
    'התעלפות', 'עילפון', 'איבוד הכרה', 'סחרחורות',
    'אפילפסיה', 'פרכוסים',
    'תסחיף', 'אנוריזמה', 'מפרצת',
    'הריון', 'בהריון',
    'ניתוח לאחרונה', 'אחרי ניתוח', 'לפני ניתוח',
    'כימותרפיה', 'סרטן פעיל',
    'אי ספיקת כליות', 'דיאליזה'
  ];

  /* כתום: אפשר להתאמן, אבל בהתאמות מפורשות ובעדיפות לאישור רופא. */
  var AMBER = [
    'לחץ דם', 'יתר לחץ דם', 'סוכרת', 'טרום סוכרת',
    'אסתמה', 'אסטמה', 'קוצר נשימה', 'ריאות',
    'דיסק', 'פריצת דיסק', 'גב תחתון', 'כאבי גב', 'סקוליוזיס',
    'ברך', 'מניסקוס', 'צלב', 'רצועה', 'רצועות',
    'כתף', 'שרוול מסובב', 'נקע', 'שבר',
    'בקע', 'אוסטאופורוזיס', 'דלדול עצם',
    'שיגרון', 'ארתריטיס', 'דלקת מפרקים',
    'תריסריון', 'בלוטת התריס', 'תירואיד',
    'מיגרנה', 'אנמיה',
    'ניתוח', 'פציעה', 'כאב', 'כאבים'
  ];

  /* ביטויים שמשמעם "אין" — כדי ש"אין בעיות לב" לא ייספר כדגל אדום */
  var NEG = ['אין', 'ללא', 'לא ידוע', 'שלילי', 'בריא', 'הכל תקין', 'תקין', 'לא'];

  /* ---------- כלי עזר ---------- */
  function norm(s) {
    return String(s == null ? '' : s).replace(/["'׳״]/g, '').replace(/\s+/g, ' ').trim();
  }
  function isEmpty(s) {
    var t = norm(s);
    if (!t) return true;
    /* '-' או 'אין' לבד הם תשובה אמיתית, לא שדה ריק */
    return /^[-–—.]+$/.test(t);
  }
  /* תשובה ששוללת לגמרי: 'אין', 'ללא', 'אין פציעות' */
  function isNegative(s) {
    var t = norm(s).toLowerCase();
    if (!t) return false;
    if (t.length > 25) return false;            // משפט ארוך — כנראה תיאור, לא שלילה
    for (var i = 0; i < NEG.length; i++) {
      if (t === NEG[i] || t.indexOf(NEG[i]) === 0) {
        /* 'לא הייתי בטוח שאני...' הוא לא שלילה. דורש שהמשפט יהיה קצר. */
        return t.length <= 14 || NEG[i].length >= 3;
      }
    }
    return false;
  }
  /* התאמת מילה שלמה, מודעת לעברית.
     \b של JS חסר תועלת כאן — אותיות עבריות אינן \w. בלי זה 'לב'
     נתפס בתוך 'לבן' ובתוך 'בלבד', ומייצר דגל אדום מדומה. */
  var HEB = /[֐-׿]/;
  function hasWord(hay, needle) {
    var i = hay.indexOf(needle);
    while (i > -1) {
      var before = i === 0 ? '' : hay.charAt(i - 1);
      var after = hay.charAt(i + needle.length);
      /* ו' החיבור ומילות יחס דבוקות הן תחילית לגיטימית */
      var okBefore = !HEB.test(before) || 'ובכלמשה'.indexOf(before) > -1;
      if (okBefore && !HEB.test(after)) return true;
      i = hay.indexOf(needle, i + 1);
    }
    return false;
  }
  function findTerms(text, list) {
    var t = norm(text), out = [];
    if (!t || isNegative(t)) return out;
    for (var i = 0; i < list.length; i++) {
      if (hasWord(t, list[i]) && out.indexOf(list[i]) === -1) out.push(list[i]);
    }
    return out;
  }

  /* גיל מתוך 'תאריך לידה / גיל' — הערך יכול להיות גיל או תאריך */
  function ageOf(t, ans) {
    var raw = norm((ans && ans.birthOrAge) || (t && t.birthOrAge) || (t && t.age) || '');
    if (!raw) return null;
    var n = raw.match(/^\s*(\d{1,2})\s*$/);
    if (n) return +n[1];
    var y = raw.match(/(19|20)\d{2}/);
    if (y) {
      /* שנה נוכחית מהשעון של המכשיר — אין תלות בנתון חיצוני */
      var age = new Date().getFullYear() - +y[0];
      if (age > 0 && age < 120) return age;
    }
    return null;
  }

  /* ---------- הסינון ---------- */
  /*
    מחזיר:
      level          'red' | 'amber' | 'green' | 'unknown'
      needsClearance האם צריך אישור רופא לפני תחילת אימון
      reasons        למה, בעברית, לתצוגה למאמן
      missing        שדות שחסרים ומונעים החלטה
  */
  function screen(t, intake) {
    /* אצל המאמן השאלון יושב ב-t.intake; דרך ה-RPC הוא מגיע
       תחת private.intake. שניהם נתמכים כדי שאותה לוגיקה תרוץ בשני הצדדים. */
    var ans = (intake && intake.answers)
           || (t && t.intake && t.intake.answers)
           || (t && t.private && t.private.intake && t.private.intake.answers)
           || {};
    var decl = (t && t.health) || null;

    var reasons = [], missing = [], level = 'green', needs = false;

    /* 1. הצהרה חתומה — הקובעת ביותר, כי המתאמן ענה ישירות */
    if (decl && decl.signedAt) {
      var yes = [];
      for (var i = 0; i < PARQ.length; i++) {
        if (decl.answers && decl.answers[PARQ[i].k] === 'yes') yes.push(PARQ[i]);
      }
      if (yes.length) {
        level = 'red';
        needs = true;
        reasons.push('בהצהרה החתומה סומן "כן" ב-' + yes.length + ' משאלות הסינון:');
        yes.forEach(function (q) { reasons.push('· ' + q.q); });
      }
      if (decl.notes && norm(decl.notes)) {
        var rn = findTerms(decl.notes, RED), an = findTerms(decl.notes, AMBER);
        if (rn.length) {
          level = 'red'; needs = true;
          reasons.push('בהערות ההצהרה: ' + rn.join(', '));
        } else if (an.length && level !== 'red') {
          level = 'amber';
          reasons.push('בהערות ההצהרה: ' + an.join(', '));
        }
      }
    } else {
      missing.push('הצהרת בריאות חתומה');
    }

    /* 2. טקסט חופשי מהשאלון */
    var fields = [
      ['medical', 'רקע רפואי'],
      ['pain', 'כאבים במאמץ'],
      ['injuries', 'פציעות']
    ];
    var anyFilled = false;
    fields.forEach(function (f) {
      var v = ans[f[0]];
      if (isEmpty(v)) return;
      anyFilled = true;
      var r = findTerms(v, RED);
      var a = findTerms(v, AMBER);
      if (r.length) {
        level = 'red'; needs = true;
        reasons.push(f[1] + ': ' + r.join(', ') + ' — ' + norm(v));
      } else if (a.length) {
        if (level !== 'red') level = 'amber';
        reasons.push(f[1] + ': ' + a.join(', ') + ' — ' + norm(v));
      }
    });
    if (!anyFilled) missing.push('שאלון: רקע רפואי, כאבים ופציעות');

    /* 3. גיל — גורם סיכון מוכר, מעלה לכתום גם בלי ממצא אחר */
    var age = ageOf(t, ans);
    if (age == null) {
      missing.push('גיל');
    } else if (age >= 45 && level === 'green') {
      level = 'amber';
      reasons.push('גיל ' + age + ' — מומלץ אישור רופא לפני התחלה, גם בלי ממצא אחר');
    } else if (age >= 45) {
      reasons.push('גיל ' + age);
    }

    /* 4. אישור רפואי שכבר קיים במערכת מוריד את הדרישה */
    var cert = norm(ans.medCert || '');
    var hasCert = !!(decl && decl.certFile) ||
                  (!!cert && !isNegative(cert) && !/לא|אין|טרם/.test(cert));
    if (hasCert && needs) {
      reasons.push('קיים אישור רפואי במערכת — לוודא שהוא בתוקף ומתייחס לאימון גופני');
    }

    /* 5. חסר מידע איננו בריא.
       זו ההחלטה החשובה בקובץ: מתאמן בלי נתונים מסווג 'unknown',
       לא 'green'. סיווג חסר כתקין הוא בדיוק איך מפספסים מקרה. */
    if (level === 'green' && missing.length) {
      level = 'unknown';
      reasons.push('אין מספיק מידע כדי לקבוע — חסר: ' + missing.join(', '));
    }

    return {
      level: level,
      needsClearance: needs && !hasCert,
      hasCert: hasCert,
      age: age,
      reasons: reasons,
      missing: missing,
      signed: !!(decl && decl.signedAt),
      signedAt: decl ? decl.signedAt : null
    };
  }

  /* ---------- תצוגה ---------- */
  var LABEL = {
    red:     { t: 'נדרש אישור רופא', c: '#C0392B', bg: 'rgba(192,57,43,.10)' },
    amber:   { t: 'התאמות נדרשות',   c: '#B9770E', bg: 'rgba(185,119,14,.10)' },
    green:   { t: 'תקין',            c: '#1E8449', bg: 'rgba(30,132,73,.10)' },
    unknown: { t: 'חסר מידע',        c: '#6B5B47', bg: 'rgba(107,91,71,.10)' }
  };
  function badge(level) {
    var L = LABEL[level] || LABEL.unknown;
    return '<span style="display:inline-block;font-weight:800;font-size:12px;padding:3px 10px;'
         + 'border-radius:20px;color:' + L.c + ';background:' + L.bg + ';border:1px solid ' + L.c + '33">'
         + L.t + '</span>';
  }

  /* ---------- צד המאמן: טאב בתיק המתאמן ---------- */
  function tabHealth(t) {
    var r = screen(t, null);
    var L = LABEL[r.level] || LABEL.unknown;

    var h = '<div class="card" style="border-color:' + L.c + '44;background:' + L.bg + '">'
      + '<div class="row" style="margin-bottom:8px"><h3 style="flex:1;font-size:15px">סינון בריאות</h3>'
      + badge(r.level) + '</div>';

    if (r.needsClearance) {
      h += '<div style="font-weight:800;color:' + LABEL.red.c + ';font-size:14px;margin-bottom:8px">'
         + 'אין להתחיל אימון עד לקבלת אישור רופא בכתב.</div>';
    }

    if (r.reasons.length) {
      h += '<ul style="margin:0 18px 0 0;padding:0;font-size:13.5px;line-height:1.7">'
        + r.reasons.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('')
        + '</ul>';
    } else {
      h += '<div class="muted" style="font-size:13px">לא נמצאו ממצאים.</div>';
    }
    h += '</div>';

    /* ההצהרה החתומה */
    var d = t.health;
    h += '<div class="card"><div class="row" style="margin-bottom:10px">'
      + '<h3 style="flex:1;font-size:15px">הצהרת בריאות</h3>'
      + (d && d.signedAt
          ? '<span class="muted" style="font-size:12px">נחתמה ' + esc(fmtFull(d.signedAt)) + '</span>'
          : '<span class="muted" style="font-size:12px">טרם נחתמה</span>')
      + '</div>';

    if (d && d.signedAt) {
      PARQ.forEach(function (q) {
        var a = d.answers ? d.answers[q.k] : null;
        var yes = a === 'yes';
        h += '<div class="line-item"><span style="flex:1;font-size:13.5px">' + esc(q.q) + '</span>'
          + '<b style="font-size:13px;color:' + (yes ? LABEL.red.c : LABEL.green.c) + '">'
          + (a == null ? '—' : (yes ? 'כן' : 'לא')) + '</b></div>';
      });
      if (d.notes) {
        h += '<div class="line-item"><span class="muted" style="width:120px;font-size:13px">הערות</span>'
          + '<span style="flex:1;font-size:13.5px">' + esc(d.notes) + '</span></div>';
      }
      h += '<div class="line-item"><span class="muted" style="width:120px;font-size:13px">חתימה</span>'
        + '<span style="flex:1;font-size:13.5px">' + esc(d.signature || '—') + '</span></div>';
    } else {
      h += '<div class="muted" style="font-size:13px">המתאמן טרם מילא הצהרה בקישור האישי שלו.</div>';
    }

    h += '<div class="row" style="margin-top:12px;gap:8px">'
      + '<button class="btn sm" onclick="EBHealth.toggleCert(\'' + t.id + '\')">'
      + (t.health && t.health.certFile ? 'בטל סימון אישור רופא' : 'סמן שהתקבל אישור רופא')
      + '</button></div>';

    h += '<div class="muted" style="font-size:11.5px;margin-top:10px;line-height:1.6">'
      + 'הסינון הזה מפנה לרופא כשצריך. הוא אינו אבחון ואינו קובע שמישהו כשיר לאימון. '
      + 'ההחלטה הרפואית היא של רופא בלבד.</div>';

    return h + '</div>';
  }

  /* סימון ידני שהתקבל אישור רופא. לא מוריד את דירוג הסיכון —
     רק את הדרישה להביא אישור, כדי שההתאמות באימון יישארו על השולחן. */
  function toggleCert(id) {
    var t = S.trainees.find(function (x) { return x.id === id; });
    if (!t) return;
    t.health = t.health || {};
    if (t.health.certFile) {
      delete t.health.certFile;
      delete t.health.certAt;
    } else {
      t.health.certFile = 'confirmed';
      t.health.certAt = todayISO();
    }
    save();
    render();
  }

  /* ---------- צד המאמן: מסך הסינון הכולל ---------- */
  function view() {
    var rows = activeTrainees().map(function (t) {
      return { t: t, r: screen(t, null) };
    });

    var ORDER = { red: 0, unknown: 1, amber: 2, green: 3 };
    rows.sort(function (a, b) {
      var d = ORDER[a.r.level] - ORDER[b.r.level];
      return d || String(a.t.name).localeCompare(String(b.t.name), 'he');
    });

    var n = function (lv) { return rows.filter(function (x) { return x.r.level === lv; }).length; };
    var needs = rows.filter(function (x) { return x.r.needsClearance; });

    var h = head('סינון בריאות',
      'מי צריך להביא אישור רופא, ומי חסר מידע — מחושב מהשאלון ומההצהרה החתומה', '');

    h += '<div class="grid stats-auto" style="margin-bottom:14px">'
      + stat('נדרש אישור רופא', needs.length, needs.length ? 'לפני תחילת אימון' : 'אין')
      + stat('התאמות נדרשות', n('amber'), '')
      + stat('חסר מידע', n('unknown'), 'לא ניתן לקבוע')
      + stat('תקין', n('green'), '')
      + '</div>';

    if (!rows.length) return h + '<div class="empty">אין מתאמנים פעילים.</div>';

    if (needs.length) {
      h += '<div class="card" style="border-color:' + LABEL.red.c + '55;background:' + LABEL.red.bg + '">'
        + '<h3 style="font-size:15px;margin-bottom:8px;color:' + LABEL.red.c + '">'
        + 'לבקש אישור רופא מ-' + needs.length + ' מתאמנים</h3>'
        + '<div style="font-size:13.5px;line-height:1.8">'
        + needs.map(function (x) {
            return '<div><b>' + esc(x.t.name) + '</b> — ' + esc(x.r.reasons[0] || '') + '</div>';
          }).join('')
        + '</div></div>';
    }

    h += '<div class="card"><table class="tbl"><thead><tr>'
      + '<th>מתאמן</th><th>סטטוס</th><th>הצהרה</th><th>הסיבה</th><th></th>'
      + '</tr></thead><tbody>';

    rows.forEach(function (x) {
      h += '<tr>'
        + '<td><b>' + esc(x.t.name) + '</b></td>'
        + '<td>' + badge(x.r.level) + '</td>'
        + '<td class="muted" style="font-size:12px">' + (x.r.signed ? 'נחתמה' : 'חסרה') + '</td>'
        + '<td style="font-size:12.5px">' + esc((x.r.reasons[0] || '—').slice(0, 90)) + '</td>'
        + '<td><button class="btn sm ghost" onclick="go(\'trainee\',\'' + x.t.id + '\')">פתח</button></td>'
        + '</tr>';
    });

    h += '</tbody></table></div>'
      + '<div class="muted" style="font-size:11.5px;margin-top:10px;line-height:1.6">'
      + 'שבע שאלות הסינון מבוססות על PAR-Q+, התקן המקובל לסינון לפני פעילות גופנית. '
      + 'הסיווג שמרני בכוונה: היעדר מידע מסומן "חסר מידע" ולא "תקין", ובספק ההפניה היא לרופא. '
      + 'זהו סינון בלבד — לא אבחון ולא אישור כשירות.</div>';

    return h;
  }

  /* כמה מתאמנים דורשים טיפול — לתג המספר בתפריט */
  function needCount() {
    try {
      return activeTrainees().filter(function (t) {
        var r = screen(t, null);
        return r.level === 'red' || r.level === 'unknown';
      }).length;
    } catch (e) { return 0; }
  }

  window.EBHealth = {
    PARQ: PARQ,
    screen: screen,
    badge: badge,
    label: LABEL,
    tab: tabHealth,
    view: view,
    needCount: needCount,
    toggleCert: toggleCert,
    /* נחשפים לבדיקות ולשימוש חוזר */
    _terms: { RED: RED, AMBER: AMBER },
    _ageOf: ageOf
  };
})();

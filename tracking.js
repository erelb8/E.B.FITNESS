/* =====================================================================
   E.B FIT — מעקב יומי
   ---------------------------------------------------------------------
   יעדים מחושבים לכל מתאמן, וטבלת הזנה יומית: קלוריות, חלבון, פחמימות,
   שומן, מים, משקל, תוספים, ואימון — עם סימון "הכל הוזן".

   החישוב:
     BMR לפי Mifflin-St Jeor, מוכפל במקדם פעילות לפי ימי האימון,
     ומותאם למטרה. חלבון ושומן לפי משקל גוף, פחמימות מהיתרה.
     אלה נוסחאות מקובלות לאוכלוסייה בריאה — נקודת פתיחה, לא מרשם.

   מה שלא מחושב כאן, בכוונה: ויטמינים ומינרלים. מינון מיקרו-נוטריינטים
   הוא החלטה רפואית שתלויה בבדיקות דם ובתרופות. במקום מספר מומצא,
   המאמן מגדיר רשימת תוספים והמתאמן מסמן מה לקח.

   האחסון: מערך S.daily נפרד, שמסונכרן אל טבלת measures בשרת עם סימון
   kind='daily' ומופרד חזרה במשיכה. כך אין טבלה חדשה ואין מיגרציה,
   והרשומות היומיות לא מזהמות את טבלת המדידות ואת גרפי ההתקדמות.
   ===================================================================== */
(function () {
  'use strict';

  (window.EB_MOD = window.EB_MOD || {})['tracking'] = 'v51';

  /* ---------- חישוב היעדים ---------- */
  var ACT = [
    { d:0, f:1.2,   t:'ללא אימונים' },
    { d:2, f:1.375, t:'2 אימונים בשבוע' },
    { d:3, f:1.55,  t:'3–4 אימונים בשבוע' },
    { d:5, f:1.725, t:'5 אימונים בשבוע' },
    { d:6, f:1.9,   t:'6+ אימונים בשבוע' }
  ];
  function actFor(days) {
    var pick = ACT[0];
    ACT.forEach(function (a) { if (days >= a.d) pick = a; });
    return pick;
  }
  function goalKind(t) {
    var s = String((t.goal || '') + ' ' + (t.notes || ''));
    if (/מסה|מסת שריר|היפרטרופ|לעלות/.test(s)) return 'mass';
    if (/חיטוב|ירידה|לרזות|שומן|להחטיב/.test(s)) return 'cut';
    return 'keep';
  }
  var GOAL_TXT = { cut:'חיטוב וירידה', mass:'עלייה במסה', keep:'שמירה' };

  function latestWeight(t) {
    var ms = (window.S.measures || [])
      .filter(function (m) { return m.traineeId === t.id && m.weight; })
      .sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
    return ms.length ? Number(ms[0].weight) : null;
  }
  function ageOf(t) {
    if (!t.birth) return null;
    var d = new Date(t.birth), n = new Date();
    var a = n.getFullYear() - d.getFullYear();
    if (n < new Date(n.getFullYear(), d.getMonth(), d.getDate())) a--;
    return (a > 5 && a < 100) ? a : null;
  }

  function targets(t) {
    var w = latestWeight(t), h = Number(t.height) || null, a = ageOf(t);
    var missing = [];
    if (!w) missing.push('משקל');
    if (!h) missing.push('גובה');
    if (!a) missing.push('תאריך לידה');

    // ידני גובר על מחושב
    var man = t.targets || {};
    if (missing.length && !man.kcal) return { missing: missing };

    var g = goalKind(t);
    var days = Number(((t.intake || {}).answers || {}).daysPerWeek) ||
               (((t.program || {}).days || []).length) || 3;
    var act = actFor(days);

    var out = { goal: g, goalTxt: GOAL_TXT[g], act: act, weight: w, height: h, age: a, missing: [] };

    if (w && h && a) {
      // Mifflin-St Jeor. בלי מין ידוע משתמשים בממוצע בין שתי הנוסחאות,
      // שהפער ביניהן הוא 166 קק"ל — ומצוין בממשק שזו הערכה.
      var male   = 10*w + 6.25*h - 5*a + 5;
      var female = 10*w + 6.25*h - 5*a - 161;
      out.assumedSex = !t.gender;
      var bmr = t.gender === 'זכר' ? male : t.gender === 'נקבה' ? female : (male + female) / 2;
      out.bmr  = Math.round(bmr);
      out.tdee = Math.round(bmr * act.f);
      out.kcal = Math.round(out.tdee * (g === 'cut' ? 0.80 : g === 'mass' ? 1.12 : 1));
      out.protein = Math.round(w * (g === 'cut' ? 2.2 : g === 'mass' ? 1.9 : 1.6));
      /* שומן לפי משקל גוף, אבל לא פחות מ-25% מהקלוריות. בתפריט עתיר
         קלוריות החישוב לפי משקל בלבד מוריד את השומן מתחת ל-20%, וזה
         כבר לא מומלץ — משפיע על הורמונים ועל ספיגת ויטמינים מסיסי שומן. */
      out.fat     = Math.round(Math.max(w * 0.9, out.kcal * 0.25 / 9));
      out.carbs   = Math.max(0, Math.round((out.kcal - out.protein*4 - out.fat*9) / 4));
      out.water   = Math.max(2.5, Math.round(w * 35 / 100) / 10);
    }
    // דריסה ידנית
    ['kcal','protein','carbs','fat','water'].forEach(function (k) {
      if (man[k] !== undefined && man[k] !== '') { out[k] = Number(man[k]); out.manual = true; }
    });
    return out;
  }

  /* ---------- רשומות יומיות ---------- */
  function dayRow(traineeId, date) {
    return (window.S.daily || []).find(function (m) {
      return m.traineeId === traineeId && m.date === date;
    });
  }
  function ensureRow(traineeId, date) {
    var r = dayRow(traineeId, date);
    if (r) return r;
    r = { id: uid(), traineeId: traineeId, date: date,
          kcal:'', protein:'', carbs:'', fat:'', water:'', weight:'',
          supps: [], workout: false, complete: false, note: '' };
    (window.S.daily = window.S.daily || []).push(r);
    return r;
  }
  function lastDays(n) {
    var out = [];
    for (var i = 0; i < n; i++) out.push(addDays(todayISO(), -i));
    return out;
  }

  /* ---------- הלשונית ---------- */
  function tab(t) {
    var T = targets(t);
    var today = todayISO();
    var row = dayRow(t.id, today);
    var suppList = (t.supplements || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);

    var h = '';

    /* --- יעדים --- */
    h += '<div class="card"><div class="row" style="margin-bottom:10px">'
      + '<h3 style="flex:1;font-size:15px">היעדים היומיים</h3>'
      + '<button class="btn sm ghost" onclick="EBTrack.editTargets(\'' + t.id + '\')">עריכה ידנית</button></div>';

    if (T.missing && T.missing.length) {
      h += '<p class="muted" style="font-size:13px;margin:0">כדי לחשב יעדים חסר: <b style="color:var(--or)">'
        + esc(T.missing.join(', ')) + '</b>. אפשר להשלים בעריכת המתאמן או במדידות, '
        + 'או להזין יעדים ידנית.</p></div>';
    } else {
      h += '<div class="grid g4">'
        + stat('קלוריות', T.kcal, 'ליום')
        + stat('חלבון', T.protein + ' ג׳', Math.round(T.protein / T.weight * 10) / 10 + ' ג׳ לק״ג')
        + stat('פחמימות', T.carbs + ' ג׳', '')
        + stat('שומן', T.fat + ' ג׳', '')
        + '</div>'
        + '<div class="row" style="margin-top:10px;gap:8px;flex-wrap:wrap">'
        + pill('מים ' + T.water + ' ליטר')
        + (T.manual ? pill('יעדים ידניים', 1)
                    : pill('BMR ' + T.bmr) + pill(T.act.t) + pill(T.goalTxt))
        + '</div>';
      if (!T.manual) {
        h += '<div class="muted" style="font-size:12px;margin-top:10px">'
          + 'חושב לפי Mifflin-St Jeor ממשקל ' + T.weight + ' ק״ג, גובה ' + T.height + ' ס״מ וגיל ' + T.age + '. '
          + (T.assumedSex ? 'המין לא מוגדר, אז זו הערכה ממוצעת — הפרש של כ-166 קק״ל בין גבר לאישה. ' : '')
          + 'נקודת פתיחה שמתכווננת לפי התוצאות בפועל, לא מרשם.</div>';
      }
      h += '</div>';
    }

    /* --- הזנה להיום --- */
    h += '<div class="card" style="margin-top:14px">'
      + '<div class="row" style="margin-bottom:10px"><h3 style="flex:1;font-size:15px">היום · ' + fmtFull(today) + '</h3>'
      + (row && row.complete ? '<span class="pill ok">הוזן במלואו</span>' : '') + '</div>'
      + '<div class="grid g4">'
      + fld2('קלוריות', 'dk', row && row.kcal, T.kcal)
      + fld2('חלבון (ג׳)', 'dp', row && row.protein, T.protein)
      + fld2('פחמימות (ג׳)', 'dc', row && row.carbs, T.carbs)
      + fld2('שומן (ג׳)', 'df', row && row.fat, T.fat)
      + '</div><div class="grid g3" style="margin-top:10px">'
      + fld2('מים (ליטר)', 'dw', row && row.water, T.water)
      + fld2('משקל (ק״ג)', 'dwt', row && row.weight, '')
      + '<div><label class="f">אימון</label>'
      + '<select class="f" id="tr_dworkout"><option value="">לא בוצע</option>'
      + '<option value="1"' + (row && row.workout ? ' selected' : '') + '>בוצע</option></select></div>'
      + '</div>';

    if (suppList.length) {
      h += '<div class="sep"></div><label class="f">תוספים</label><div class="row" style="margin-top:6px;flex-wrap:wrap">'
        + suppList.map(function (s, i) {
            var on = row && (row.supps || []).indexOf(s) > -1;
            return '<label style="font-size:13.5px;display:flex;align-items:center;gap:6px">'
              + '<input type="checkbox" class="tr_supp" data-s="' + esc(s) + '"' + (on ? ' checked' : '') + '>' + esc(s) + '</label>';
          }).join('') + '</div>';
    } else {
      h += '<div class="sep"></div><div class="muted" style="font-size:12.5px">'
        + 'לא הוגדרו תוספים ל' + esc(t.name) + '. '
        + '<button class="btn sm ghost" onclick="EBTrack.editSupps(\'' + t.id + '\')">הגדרת רשימה</button></div>';
    }

    h += '<div class="row" style="margin-top:12px">'
      + '<button class="btn" onclick="EBTrack.saveDay(\'' + t.id + '\')">שמירה</button>'
      + '<label style="font-size:13.5px;display:flex;align-items:center;gap:7px;margin-inline-start:8px">'
      + '<input type="checkbox" id="tr_complete"' + (row && row.complete ? ' checked' : '') + '> הכל הוזן להיום</label>'
      + '<div style="flex:1"></div>'
      + (suppList.length ? '<button class="btn sm ghost" onclick="EBTrack.editSupps(\'' + t.id + '\')">עריכת תוספים</button>' : '')
      + '</div></div>';

    /* --- שבעת הימים האחרונים --- */
    var days = lastDays(7), rows = days.map(function (d) { return dayRow(t.id, d); });
    var filled = rows.filter(Boolean);
    h += '<div class="card" style="margin-top:14px"><h3 style="font-size:15px;margin-bottom:10px">שבעת הימים האחרונים</h3>';

    if (!filled.length) {
      h += '<div class="muted" style="font-size:13px">עוד לא הוזנו נתונים.</div>';
    } else {
      h += '<div style="overflow-x:auto"><table><thead><tr>'
        + '<th>תאריך</th><th>קק״ל</th><th>חלבון</th><th>פחמ׳</th><th>שומן</th><th>מים</th><th>משקל</th><th>אימון</th><th>הוזן</th>'
        + '</tr></thead><tbody>';
      days.forEach(function (d, i) {
        var r = rows[i];
        h += '<tr>'
          + '<td>' + fmtDate(d) + '</td>'
          + cell(r && r.kcal, T.kcal) + cell(r && r.protein, T.protein)
          + cell(r && r.carbs, T.carbs) + cell(r && r.fat, T.fat)
          + cell(r && r.water, T.water) + '<td>' + (r && r.weight ? esc(r.weight) : '—') + '</td>'
          + '<td>' + (r && r.workout ? '✓' : '—') + '</td>'
          + '<td>' + (r && r.complete ? '<span style="color:var(--ok)">✓</span>' : '—') + '</td>'
          + '</tr>';
      });
      h += '</tbody></table></div>';

      var avg = function (k) {
        var v = filled.map(function (r) { return Number(r[k]); }).filter(function (n) { return n > 0; });
        return v.length ? Math.round(v.reduce(function (a, b) { return a + b; }, 0) / v.length) : null;
      };
      var ak = avg('kcal'), ap = avg('protein');
      h += '<div class="row" style="margin-top:12px;gap:8px;flex-wrap:wrap">'
        + pill('ימים שהוזנו ' + filled.length + '/7')
        + pill('אימונים ' + filled.filter(function (r) { return r.workout; }).length)
        + (ak ? pill('ממוצע קק״ל ' + ak + (T.kcal ? ' (יעד ' + T.kcal + ')' : '')) : '')
        + (ap ? pill('ממוצע חלבון ' + ap + ' ג׳' + (T.protein ? ' (יעד ' + T.protein + ')' : '')) : '')
        + '</div>';
    }
    h += '</div>';
    return h;
  }

  function fld2(label, id, val, ph) {
    return '<div><label class="f">' + label + '</label>'
      + '<input class="f" id="tr_' + id + '" type="number" step="any" value="' + esc(val == null ? '' : val)
      + '" placeholder="' + esc(ph || '') + '"></div>';
  }
  function cell(v, target) {
    if (!v) return '<td class="muted">—</td>';
    var n = Number(v), col = '';
    if (target) {
      var d = Math.abs(n - target) / target;
      col = d <= 0.10 ? 'color:var(--ok)' : d >= 0.25 ? 'color:var(--warn)' : '';
    }
    return '<td style="' + col + '">' + esc(v) + '</td>';
  }
  function pill(txt, warn) {
    return '<span style="font-size:12px;padding:4px 10px;border-radius:20px;background:'
      + (warn ? 'rgba(255,197,61,.12)' : 'var(--or-soft)') + ';color:'
      + (warn ? 'var(--warn)' : 'var(--or)') + '">' + esc(txt) + '</span>';
  }

  /* ---------- פעולות ---------- */
  function saveDay(id) {
    var t = tById(id); if (!t) return;
    var r = ensureRow(id, todayISO());
    var g = function (x) { var e = document.getElementById('tr_' + x); return e ? e.value.trim() : ''; };

    r.kcal = g('dk'); r.protein = g('dp'); r.carbs = g('dc'); r.fat = g('df');
    r.water = g('dw'); r.weight = g('dwt');
    r.workout = document.getElementById('tr_dworkout') ? document.getElementById('tr_dworkout').value === '1' : false;
    r.supps = [].slice.call(document.querySelectorAll('.tr_supp:checked')).map(function (c) { return c.dataset.s; });
    var c = document.getElementById('tr_complete');
    r.complete = c ? c.checked : false;

    save(); render();
    toast(r.complete ? 'נשמר וסומן כהוזן במלואו' : 'נשמר');
  }

  function editSupps(id) {
    var t = tById(id); if (!t) return;
    openModal('<div class="mh"><h3>תוספים ל' + esc(t.name) + '</h3>'
      + '<button class="iconbtn" onclick="closeModal()">✕</button></div><div class="mb">'
      + '<p class="muted" style="font-size:13px;margin:0 0 10px">רשימה מופרדת בפסיקים. היא תופיע כתיבות סימון בהזנה היומית.</p>'
      + '<input class="f" id="sp_list" value="' + esc(t.supplements || '') + '" '
      + 'placeholder="אבקת חלבון, קראטין, ויטמין D, אומגה 3, מגנזיום">'
      + '<div class="muted" style="font-size:12px;margin-top:10px">'
      + 'המערכת לא קובעת מינונים — מינון ויטמינים ומינרלים תלוי בבדיקות דם ובתרופות, '
      + 'וזו החלטה של רופא או דיאטן.</div>'
      + '</div><div class="mf"><button class="btn" onclick="EBTrack.saveSupps(\'' + id + '\')">שמירה</button>'
      + '<button class="btn ghost" onclick="closeModal()">ביטול</button></div>');
  }
  function saveSupps(id) {
    var t = tById(id); if (!t) return;
    t.supplements = gv('sp_list');
    save(); closeModal(); render(); toast('רשימת התוספים נשמרה');
  }

  function editTargets(id) {
    var t = tById(id); if (!t) return;
    var m = t.targets || {}, T = targets(t);
    openModal('<div class="mh"><h3>יעדים ידניים</h3><button class="iconbtn" onclick="closeModal()">✕</button></div><div class="mb">'
      + '<p class="muted" style="font-size:13px;margin:0 0 12px">שדה שתמלא גובר על החישוב. שדה ריק ימשיך להתחשב.</p>'
      + '<div class="grid g2">'
      + fld('קלוריות', 'mt_kcal', 'number', m.kcal) + fld('חלבון (ג׳)', 'mt_protein', 'number', m.protein)
      + fld('פחמימות (ג׳)', 'mt_carbs', 'number', m.carbs) + fld('שומן (ג׳)', 'mt_fat', 'number', m.fat)
      + fld('מים (ליטר)', 'mt_water', 'number', m.water)
      + '</div>'
      + (T.missing && T.missing.length ? '' :
         '<div class="muted" style="font-size:12px;margin-top:10px">המחושב כרגע: '
         + T.kcal + ' קק״ל · ' + T.protein + ' ג׳ חלבון · ' + T.carbs + ' ג׳ פחמימות · ' + T.fat + ' ג׳ שומן</div>')
      + '</div><div class="mf"><button class="btn" onclick="EBTrack.saveTargets(\'' + id + '\')">שמירה</button>'
      + '<button class="btn ghost" onclick="EBTrack.clearTargets(\'' + id + '\')">חזרה לחישוב</button></div>');
  }
  function saveTargets(id) {
    var t = tById(id); if (!t) return;
    t.targets = {};
    ['kcal','protein','carbs','fat','water'].forEach(function (k) {
      var v = gv('mt_' + k);
      if (v) t.targets[k] = Number(v);
    });
    save(); closeModal(); render(); toast('היעדים נשמרו');
  }
  function clearTargets(id) {
    var t = tById(id); if (!t) return;
    delete t.targets;
    save(); closeModal(); render(); toast('חזרה לחישוב אוטומטי');
  }

  window.EBTrack = { tab: tab, targets: targets, saveDay: saveDay,
                     editSupps: editSupps, saveSupps: saveSupps,
                     editTargets: editTargets, saveTargets: saveTargets, clearTargets: clearTargets };
})();

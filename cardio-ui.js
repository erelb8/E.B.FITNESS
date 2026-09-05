/* =====================================================================
   E.B FIT — מסך "אירובי ולב"
   ---------------------------------------------------------------------
   כל מספר מוצג יחד עם הנוסחה שהניבה אותו והמספרים שהוצבו בה. אומדן
   שלא ניתן לבדוק אותו הוא אומדן שאי אפשר לסמוך עליו.

   התוכנית האירובית נבנית לבד מהמטרה, מרמת הכושר וממספר אימוני הכוח
   שכבר קיימים — ואז נכנסת לתוכנית ככל יום אחר, לעריכה רגילה.
   ===================================================================== */
(function () {
  'use strict';

  (window.EB_MOD = window.EB_MOD || {})['cardioUi'] = 'v68';

  var SHOW_F = false;   // הצגת הנוסחאות

  function card(title, body, sub) {
    return '<div class="card" style="margin-bottom:14px">'
      + '<div class="row" style="align-items:baseline;margin-bottom:10px">'
      + '<h3 style="flex:1;font-size:15px">' + title + '</h3>'
      + (sub ? '<span class="muted" style="font-size:12px">' + sub + '</span>' : '')
      + '</div>' + body + '</div>';
  }
  function f(txt) {
    if (!SHOW_F || !txt) return '';
    return '<div style="font-family:ui-monospace,Menlo,monospace;font-size:11.5px;color:var(--dim);'
      + 'background:var(--ink);border:1px solid var(--line);border-radius:8px;padding:7px 9px;'
      + 'margin-top:6px;direction:ltr;text-align:left;overflow-x:auto">' + esc(txt) + '</div>';
  }
  function ltr(v) {
    return '<span dir="ltr" style="unicode-bidi:isolate;display:inline-block">' + esc(v) + '</span>';
  }
  function big(v, unit, color) {
    return '<div style="font-family:Heebo;font-weight:900;font-size:34px;line-height:1;'
      + (color ? 'color:' + color : '') + '">' + ltr(v)
      + (unit ? '<span style="font-size:13px;font-weight:500;color:var(--mut)"> ' + unit + '</span>' : '')
      + '</div>';
  }
  function clsColor(c) {
    return c === 'good' ? 'var(--ok)' : c === 'bad' ? 'var(--bad,#D9605A)'
         : c === 'warn' ? 'var(--amber)' : 'var(--mut)';
  }
  function need(list) {
    return '<div class="empty" style="text-align:right;padding:16px">'
      + '<div style="font-size:13.5px;margin-bottom:6px">חסר כדי לחשב:</div>'
      + '<div class="row" style="gap:6px;flex-wrap:wrap">'
      + list.map(function (x) {
          return '<span class="pill" style="color:var(--amber)">' + esc(x) + '</span>';
        }).join('') + '</div></div>';
  }

  /* ---------------- צח״מ ---------------- */
  function vo2Block(t) {
    var v = EBCardio.vo2(t);
    if (!v.best) {
      return card('צריכת חמצן מרבית (צח״מ)',
        need(v.needed.length ? v.needed : ['תוצאת מבחן כושר אחד לפחות']),
        'VO₂max');
    }
    var b = v.band;
    var h = '<div class="row" style="align-items:flex-end;gap:16px;flex-wrap:wrap">'
      + '<div>' + big(v.best, 'מ״ל/ק״ג/דק׳', b ? clsColor(b.cls) : '')
      + '<div class="muted" style="font-size:12px;margin-top:5px">'
      + (b ? b.txt + ' · אחוזון ' + b.pct : 'אין נורמה לגיל או למין הזה') + '</div></div>'
      + '<div style="flex:1"></div>'
      + '<div style="text-align:center"><div style="font-family:Heebo;font-weight:700;font-size:19px">'
      + ltr(v.mets) + '</div><div class="muted" style="font-size:11px">MET מרבי</div></div>'
      + '</div>';

    if (v.methods.length > 1) {
      h += '<div class="muted" style="font-size:12px;margin-top:12px">'
        + v.methods.length + ' שיטות · פער ' + ltr(v.spread) + ' · '
        + '<b style="color:var(--tx)">הערך הוא החציון</b>, כדי ששיטה חריגה אחת לא תזיז את התוצאה.</div>';
    }

    h += '<div style="margin-top:12px">';
    v.methods.forEach(function (m) {
      h += '<div style="padding:9px 0;border-top:1px solid var(--line)">'
        + '<div class="row" style="align-items:baseline">'
        + '<span style="flex:1;font-size:13.5px">' + esc(m.name) + '</span>'
        + '<b style="font-family:Heebo;font-size:15px">' + ltr(m.v) + '</b></div>'
        + (m.note ? '<div class="muted" style="font-size:11.5px;margin-top:3px">' + esc(m.note) + '</div>' : '')
        + f(m.f) + '</div>';
    });
    h += '</div>';

    if (v.needed.length) {
      h += '<div class="muted" style="font-size:12px;margin-top:10px">'
        + 'להוספת שיטות נוספות חסר: ' + v.needed.join(' · ') + '</div>';
    }
    return card('צריכת חמצן מרבית (צח״מ)', h, 'VO₂max');
  }

  /* ---------------- דופק ---------------- */
  function hrBlock(t) {
    var z = EBCardio.zones(t);
    if (!z) return card('דופק ואזורי אימון', need(['תאריך לידה']));

    var h = '<div class="row" style="gap:16px;flex-wrap:wrap;align-items:flex-end">'
      + '<div>' + big(z.hrMax, 'פעימות') + '<div class="muted" style="font-size:12px;margin-top:5px">'
      + 'דופק מרבי · ' + esc(z.src) + '</div></div>';
    if (z.restHr) {
      h += '<div style="flex:1"></div><div style="text-align:center">'
        + '<div style="font-family:Heebo;font-weight:700;font-size:19px">' + ltr(z.restHr) + '</div>'
        + '<div class="muted" style="font-size:11px">מנוחה</div></div>'
        + '<div style="text-align:center"><div style="font-family:Heebo;font-weight:700;font-size:19px">'
        + ltr(z.reserve) + '</div><div class="muted" style="font-size:11px">רזרבה</div></div>';
    }
    h += '</div>';
    h += '<div class="muted" style="font-size:12px;margin-top:8px">' + esc(z.method) + '</div>' + f(z.f);
    if (z.note) h += '<div style="font-size:12px;color:var(--amber);margin-top:6px">' + esc(z.note) + '</div>';

    h += '<div style="overflow-x:auto;margin-top:12px"><table style="width:100%;border-collapse:collapse;font-size:12.5px">'
      + '<thead><tr>' + ['אזור','שם','דופק','% ','למה'].map(function (x, i) {
          return '<th style="text-align:' + (i < 2 ? 'right' : 'center') + ';padding:6px 5px;'
            + 'border-bottom:1px solid var(--line);font-size:11px;color:var(--mut);font-weight:500;'
            + 'white-space:nowrap">' + x + '</th>'; }).join('') + '</tr></thead><tbody>';
    z.rows.forEach(function (r) {
      h += '<tr>'
        + '<td style="padding:7px 5px;border-bottom:1px solid var(--line);font-family:Heebo;'
        + 'font-weight:900;color:var(--or)">Z' + r.z + '</td>'
        + '<td style="padding:7px 5px;border-bottom:1px solid var(--line);white-space:nowrap">' + esc(r.name) + '</td>'
        + '<td style="padding:7px 5px;border-bottom:1px solid var(--line);text-align:center;'
        + 'font-family:Heebo;font-weight:700;white-space:nowrap">' + ltr(r.lo + '–' + r.hi) + '</td>'
        + '<td style="padding:7px 5px;border-bottom:1px solid var(--line);text-align:center;'
        + 'color:var(--mut);white-space:nowrap">' + ltr(r.pct) + '</td>'
        + '<td style="padding:7px 5px;border-bottom:1px solid var(--line);color:var(--mut);'
        + 'font-size:11.5px">' + esc(r.use) + '</td></tr>';
    });
    h += '</tbody></table></div>';

    if (SHOW_F) {
      h += '<div class="muted" style="font-size:12px;margin-top:12px">כל נוסחאות הדופק המרבי:</div>';
      Object.keys(z.all).forEach(function (k) {
        var a = z.all[k];
        h += '<div class="row" style="font-size:12.5px;padding:5px 0;border-top:1px solid var(--line)">'
          + '<span style="flex:1">' + esc(a.src) + '</span>'
          + '<span dir="ltr" style="font-family:ui-monospace,monospace;color:var(--dim);font-size:11.5px">'
          + esc(a.f) + '</span>'
          + '<b style="font-family:Heebo;min-width:42px;text-align:left">' + ltr(a.v) + '</b></div>';
      });
    }
    return card('דופק ואזורי אימון', h, 'Karvonen · Tanaka');
  }

  /* ---------------- לחץ דם ---------------- */
  function bpBlock(t) {
    var b = EBCardio.bp(t);
    if (!b) return card('לחץ דם', need(['לחץ דם עליון ותחתון במדידה']));
    var col = clsColor(b.cls.cls);
    var h = '<div class="row" style="gap:16px;flex-wrap:wrap;align-items:flex-end">'
      + '<div>' + big(b.sys + '/' + b.dia, 'ממ״כ', col)
      + '<div style="font-size:13px;margin-top:5px;color:' + col + ';font-weight:500">'
      + esc(b.cls.txt) + '</div></div><div style="flex:1"></div>'
      + '<div style="text-align:center"><div style="font-family:Heebo;font-weight:700;font-size:19px">'
      + ltr(b.map) + '</div><div class="muted" style="font-size:11px">לחץ ממוצע</div></div>'
      + '<div style="text-align:center"><div style="font-family:Heebo;font-weight:700;font-size:19px">'
      + ltr(b.pp) + '</div><div class="muted" style="font-size:11px">לחץ דופק</div></div>'
      + (b.rpp ? '<div style="text-align:center"><div style="font-family:Heebo;font-weight:700;font-size:19px">'
          + ltr(b.rpp.toLocaleString('en-US')) + '</div>'
          + '<div class="muted" style="font-size:11px">מכפלת לחץ-דופק</div></div>' : '')
      + '</div>';
    if (b.cls.act) {
      h += '<div style="font-size:13px;margin-top:10px;padding:9px 11px;border-radius:9px;'
        + 'background:' + (b.cls.cls === 'bad' ? 'rgba(217,96,90,.10)' : 'rgba(217,164,65,.09)')
        + ';border:1px solid ' + col + ';color:' + col + '">' + esc(b.cls.act) + '</div>';
    }
    h += f('לחץ ממוצע = ' + b.fMap) + f('לחץ דופק = ' + b.fPp)
      + (b.rpp ? f('מכפלת לחץ-דופק = ' + b.fRpp + '  ·  ' + b.rppTxt) : '');
    h += '<div class="muted" style="font-size:11.5px;margin-top:10px">'
      + 'סיווג לפי ACC/AHA 2017. הקטגוריה הגבוהה מבין שני הערכים היא הקובעת. '
      + 'מדידה בודדת אינה אבחנה — נדרשות שתי מדידות בשני מועדים.</div>';
    return card('לחץ דם', h, 'ACC/AHA 2017');
  }

  /* ---------------- הוצאה אנרגטית ---------------- */
  function energyBlock(t) {
    var e = EBCardio.energy(t);
    if (!e) return '';
    var h = '<div class="muted" style="font-size:12px;margin-bottom:8px">'
      + 'לפי משקל ' + ltr(e.weight) + ' ק״ג</div>' + f(e.f)
      + '<div style="overflow-x:auto;margin-top:10px"><table style="width:100%;border-collapse:collapse;font-size:12.5px">'
      + '<thead><tr>' + ['פעילות','MET','לדקה','30 דק׳','45 דק׳'].map(function (x, i) {
          return '<th style="text-align:' + (i ? 'center' : 'right') + ';padding:6px 5px;'
            + 'border-bottom:1px solid var(--line);font-size:11px;color:var(--mut);font-weight:500;'
            + 'white-space:nowrap">' + x + '</th>'; }).join('') + '</tr></thead><tbody>';
    e.rows.forEach(function (r) {
      h += '<tr><td style="padding:6px 5px;border-bottom:1px solid var(--line)">' + esc(r.name) + '</td>'
        + [r.met, r.min, r.c30, r.c45].map(function (x, i) {
            return '<td style="padding:6px 5px;border-bottom:1px solid var(--line);text-align:center;'
              + 'font-family:Heebo' + (i > 1 ? ';font-weight:700' : ';color:var(--mut)') + '">'
              + ltr(x) + '</td>'; }).join('') + '</tr>';
    });
    return card('הוצאה קלורית לפי פעילות', h + '</tbody></table></div>', 'ACSM · MET');
  }

  /* ---------------- ריצה ---------------- */
  function runBlock(t) {
    var r = EBCardio.running(t);
    if (!r) return '';
    var h = '<div class="muted" style="font-size:12px">בסיס: ' + esc(r.base.src) + '</div>';
    if (r.paces) {
      h += '<div class="row" style="gap:8px;flex-wrap:wrap;margin-top:10px">'
        + r.paces.map(function (p) {
            return '<span class="pill" style="white-space:nowrap"><span class="muted">' + esc(p[0])
              + ' </span><b style="font-family:Heebo">' + ltr(p[1]) + '</b></span>'; }).join('')
        + '</div>' + f(r.fV);
    }
    h += '<div class="muted" style="font-size:12px;margin:14px 0 6px">תחזית זמנים</div>'
      + '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12.5px"><tbody>';
    r.races.forEach(function (x) {
      h += '<tr><td style="padding:6px 5px;border-bottom:1px solid var(--line)">' + esc(x.name) + '</td>'
        + '<td style="padding:6px 5px;border-bottom:1px solid var(--line);text-align:center;'
        + 'font-family:Heebo;font-weight:700">' + ltr(x.time) + '</td>'
        + '<td style="padding:6px 5px;border-bottom:1px solid var(--line);text-align:center;'
        + 'color:var(--mut)">' + ltr(x.pace) + '</td></tr>';
    });
    h += '</tbody></table></div>' + f(r.f)
      + '<div class="muted" style="font-size:11.5px;margin-top:8px">'
      + 'תחזית מניחה אימון מתאים למרחק. בלי אימון ספציפי המרתון יהיה איטי משמעותית.</div>';
    return card('ריצה — קצבים ותחזיות', h, 'Riegel · Daniels');
  }

  /* ---------------- התוכנית האירובית ---------------- */
  function planBlock(t) {
    var p = EBCardio.plan(t);
    var h = '<div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:12px">'
      + '<span class="pill"><span class="muted">מטרה </span><b>' + esc(p.dirTxt) + '</b></span>'
      + '<span class="pill"><span class="muted">שבועי </span><b>' + ltr(p.weekMin) + ' דק׳</b></span>'
      + (p.vo2 ? '<span class="pill"><span class="muted">צח״מ </span><b>' + ltr(p.vo2) + '</b></span>' : '')
      + '</div>';

    /* בורר מספר הימים. ההצעה מסומנת, אבל ההחלטה של המאמן גוברת עליה. */
    h += '<div class="muted" style="font-size:12px;margin-bottom:7px">אימוני אירובי בשבוע</div>'
      + '<div class="row" style="gap:5px;flex-wrap:wrap;margin-bottom:10px">';
    for (var d = 0; d <= 7; d++) {
      var on = p.hasPick ? false : (p.days === d);
      h += '<button class="btn sm ' + (on ? '' : 'ghost') + '" style="min-width:38px;padding:7px 0" '
        + 'onclick="EBCardioUI.setDays(\'' + t.id + '\',' + d + ')">' + d + '</button>';
    }
    h += '<div style="flex:1"></div>'
      + (p.manual || p.hasPick
          ? '<button class="btn sm ghost" onclick="EBCardioUI.setDays(\'' + t.id + '\',null)">'
            + 'חזרה להצעה (' + p.auto + ')</button>'
          : '<span class="pill" style="color:var(--or)">מוצע ' + p.auto + '</span>')
      + '</div>';

    h += '<div class="muted" style="font-size:12.5px;line-height:1.6;margin-bottom:12px">'
      + (p.hasPick
          ? 'בחרת את האימונים ידנית. אפשר לשנות בכל רגע ברשימה למטה.'
          : 'ההצעה לוקחת בחשבון את המטרה, את רמת הכושר ואת ' + p.strengthDays
            + ' ימי הכוח שכבר בתוכנית — מי שמתאמן הרבה בכוח לא מקבל עוד ארבעה אימוני ריצה.')
      + '</div>';

    p.sessions.forEach(function (s, i) {
      h += '<div class="card" style="margin-bottom:10px;background:var(--ink)">'
        + '<div class="row" style="align-items:baseline;gap:10px">'
        + '<span style="width:26px;height:26px;flex:none;border-radius:50%;display:grid;place-items:center;'
        + 'background:var(--or-soft);color:var(--or);font-family:Heebo;font-weight:900;font-size:12px">'
        + (i + 1) + '</span>'
        + '<div style="flex:1;min-width:0;font-family:Heebo;font-weight:700;font-size:14.5px">'
        + esc(s.name) + '</div>'
        + '<span class="pill" style="white-space:nowrap">' + ltr(s.min) + ' דק׳</span>'
        + '</div>'
        + '<div style="font-size:13px;margin-top:8px;line-height:1.55">' + esc(s.desc) + '</div>'
        + '<div class="row" style="gap:6px;margin-top:9px;flex-wrap:wrap">'
        + (s.hr   ? '<span class="pill" style="color:var(--or)">' + ltr(s.hr) + '</span>' : '')
        + (s.kcal ? '<span class="pill">~' + ltr(s.kcal) + ' קק״ל</span>' : '')
        + '</div>'
        + '<div style="font-size:12px;color:var(--amber);margin-top:9px;line-height:1.55">'
        + esc(s.why) + '</div></div>';
    });

    /* כל האימונים שיש, מכל המטרות — לבחירה ידנית */
    var cat = EBCardio.catalogue(t);
    h += '<details style="margin-top:14px"' + (p.hasPick ? ' open' : '') + '>'
      + '<summary class="muted" style="font-size:12.5px;cursor:pointer">'
      + 'בחירה ידנית מתוך כל ' + cat.length + ' האימונים</summary>'
      + '<div class="muted" style="font-size:11.5px;margin:8px 0 10px">'
      + 'לחיצה מוסיפה או מסירה. סדר הבחירה הוא הסדר בתוכנית.</div>';
    var lastG = '';
    cat.forEach(function (x) {
      if (x.groupName !== lastG) {
        lastG = x.groupName;
        h += '<div class="muted" style="font-size:11px;letter-spacing:.1em;margin:12px 0 6px">'
          + esc(lastG) + (x.suggested ? ' · מותאם למטרה' : '') + '</div>';
      }
      h += '<button style="width:100%;text-align:right;background:'
        + (x.chosen ? 'var(--or-soft)' : 'var(--ink)') + ';border:1px solid '
        + (x.chosen ? 'var(--or)' : 'var(--line)') + ';border-radius:11px;padding:10px 12px;'
        + 'margin-bottom:6px;cursor:pointer;color:inherit;font:inherit" '
        + 'onclick="EBCardioUI.pick(\'' + t.id + '\',\'' + x.id + '\')">'
        + '<div class="row" style="align-items:baseline;gap:8px">'
        + '<span style="width:16px;flex:none;color:' + (x.chosen ? 'var(--or)' : 'var(--dim)') + '">'
        + (x.chosen ? '✓' : '+') + '</span>'
        + '<span style="flex:1;min-width:0;font-size:13.5px;font-weight:500">' + esc(x.name) + '</span>'
        + '<span class="pill" style="white-space:nowrap">' + ltr(x.min) + ' דק׳</span></div>'
        + '<div class="muted" style="font-size:11.5px;margin-top:5px;line-height:1.5;'
        + 'padding-inline-start:24px">' + esc(x.desc) + '</div></button>';
    });
    h += '</details>';

    h += '<div class="row" style="gap:8px;margin-top:12px;flex-wrap:wrap">'
      + '<button class="btn" onclick="EBCardioUI.add(\'' + t.id + '\')">הוספה לתוכנית האימון</button>'
      + '<button class="btn ghost" onclick="EBCardioUI.replace(\'' + t.id + '\')">החלפת ימי האירובי הקיימים</button>'
      + '</div>'
      + '<div class="muted" style="font-size:11.5px;margin-top:8px">'
      + 'הימים נכנסים לתוכנית ככל יום אחר — אפשר לערוך בהם כל שדה.</div>';

    return card('התוכנית האירובית', h, p.dirTxt);
  }

  /* ---------------- נפח והתקדמות ---------------- */
  function volumeBlock(t) {
    var v = EBCardio.volume(t);
    var max = Math.max.apply(null, v.weeks.map(function (w) { return w.min; })) || 1;

    var h = '<div class="row" style="gap:16px;flex-wrap:wrap;align-items:flex-end">'
      + '<div>' + big(v.current, 'דק\u05f3 בשבוע') + '</div>'
      + '<div style="flex:1"></div>'
      + '<div style="text-align:center"><div style="font-family:Heebo;font-weight:700;font-size:19px;'
      + 'color:var(--or)">+' + ltr(v.pct) + '%</div>'
      + '<div class="muted" style="font-size:11px">תוספת שבועית</div></div>'
      + '<div style="text-align:center"><div style="font-family:Heebo;font-weight:700;font-size:19px">'
      + ltr(v.hard) + '</div><div class="muted" style="font-size:11px">ימים קשים</div></div>'
      + '<div style="text-align:center"><div style="font-family:Heebo;font-weight:700;font-size:19px">'
      + ltr(v.ceiling) + '</div><div class="muted" style="font-size:11px">תקרה</div></div>'
      + '</div>' + f(v.f);

    h += '<div class="muted" style="font-size:12px;margin:14px 0 8px">שמונה השבועות הבאים</div>'
      + '<div style="display:flex;gap:5px;align-items:flex-end">';
    var TRACK = 84;   /* גובה מפורש: אחוזים מול עמודה שהתוויות תופסות בה מקום דוחסים את ההפרש */
    var min = Math.min.apply(null, v.weeks.map(function (w) { return w.min; }));
    var floor = Math.max(0, min - (max - min) * 0.35);
    v.weeks.forEach(function (w) {
      var px = Math.max(6, Math.round((w.min - floor) / ((max - floor) || 1) * TRACK));
      h += '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">'
        + '<div style="font-size:10px;color:var(--mut);font-family:Heebo">' + ltr(w.min) + '</div>'
        + '<div style="width:100%;height:' + px + 'px;border-radius:5px 5px 0 0;background:'
        + (w.deload ? 'var(--line2)' : 'linear-gradient(180deg,var(--or),rgba(143,168,79,.45))') + '"></div>'
        + '<div style="font-size:10px;color:' + (w.deload ? 'var(--amber)' : 'var(--dim)') + '">'
        + (w.deload ? 'הורדה' : ltr(w.week)) + '</div></div>';
    });
    h += '</div>';

    h += '<div style="margin-top:14px">';
    v.rules.forEach(function (r) {
      h += '<div style="display:flex;gap:10px;padding:7px 0;border-top:1px solid var(--line);font-size:12.5px">'
        + '<span style="min-width:92px;color:var(--or);font-weight:500">' + esc(r[0]) + '</span>'
        + '<span style="flex:1;color:var(--mut);line-height:1.5">' + esc(r[1]) + '</span></div>';
    });
    h += '</div><div class="muted" style="font-size:11.5px;margin-top:10px">' + esc(v.acwr) + '</div>';
    return card('נפח והתקדמות', h, 'כמה להוסיף');
  }

  /* ---------------- יחסי עבודה-מנוחה ---------------- */
  function systemsBlock() {
    var h = '<div class="muted" style="font-size:12.5px;line-height:1.6;margin-bottom:10px">'
      + 'ההפוגה נגזרת ממה שצריך להתמלא מחדש, ולא מתחושה. הפוגה קצרה מדי בספרינט '
      + 'הופכת אותו לאימון סבולת ומבטלת את מטרתו.</div>'
      + '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12.5px">'
      + '<thead><tr>' + ['מערכת', 'משך', 'עבודה:מנוחה', 'למה'].map(function (x, i) {
          return '<th style="text-align:' + (i === 2 ? 'center' : 'right') + ';padding:6px 5px;'
            + 'border-bottom:1px solid var(--line);font-size:11px;color:var(--mut);font-weight:500;'
            + 'white-space:nowrap">' + x + '</th>'; }).join('') + '</tr></thead><tbody>';
    EBCardio.systems.forEach(function (r) {
      h += '<tr>'
        + '<td style="padding:8px 5px;border-bottom:1px solid var(--line);white-space:nowrap;font-weight:500">'
        + esc(r.name) + '</td>'
        + '<td style="padding:8px 5px;border-bottom:1px solid var(--line);white-space:nowrap;color:var(--mut)">'
        + ltr(r.dur) + '</td>'
        + '<td style="padding:8px 5px;border-bottom:1px solid var(--line);text-align:center;'
        + 'font-family:Heebo;font-weight:700;color:var(--or);white-space:nowrap">' + ltr(r.ratio) + '</td>'
        + '<td style="padding:8px 5px;border-bottom:1px solid var(--line);color:var(--mut);'
        + 'font-size:11.5px;line-height:1.5">' + esc(r.why) + '</td></tr>';
    });
    return card('הפוגות - יחסי עבודה ומנוחה', h + '</tbody></table></div>', 'מערכות אנרגיה');
  }

  /* ---------------- אינטרוולים וספרינטים ---------------- */
  function intervalsBlock(t) {
    var iv = EBCardio.intervals(t);
    var h = '';
    if (iv.caution) {
      h += '<div style="font-size:13px;padding:9px 11px;border-radius:9px;margin-bottom:12px;'
        + 'background:rgba(217,164,65,.09);border:1px solid var(--amber);color:var(--amber)">'
        + esc(iv.caution) + '</div>';
    }
    if (!iv.hasHr) {
      h += '<div class="muted" style="font-size:12px;margin-bottom:10px">'
        + 'בלי תאריך לידה ודופק מנוחה אי אפשר להציג דופק יעד לכל פרוטוקול.</div>';
    }

    iv.list.forEach(function (x) {
      h += '<div class="card" style="margin-bottom:10px;background:var(--ink)">'
        + '<div class="row" style="align-items:baseline;gap:8px">'
        + '<div style="flex:1;min-width:0;font-family:Heebo;font-weight:700;font-size:14.5px">'
        + esc(x.name) + '</div>'
        + '<span class="pill" style="color:var(--or);white-space:nowrap">' + esc(x.tag) + '</span>'
        + '<span class="pill" style="white-space:nowrap">' + ltr(x.total) + '</span></div>'
        + '<div class="row" style="gap:6px;margin-top:9px;flex-wrap:wrap">'
        + pill2('עבודה', x.work) + pill2('הפוגה', x.rest) + pill2('חזרות', x.reps)
        + pill2('יחס', x.ratio)
        + (x.hr   ? pill2('דופק', x.hr) : '')
        + (x.pace && x.pace !== 'מרבי' && x.pace !== 'משתנה' && x.pace !== 'לפי תחושה'
             ? pill2('קצב', x.pace) : '')
        + '</div>'
        + '<div style="font-size:12.5px;margin-top:9px;line-height:1.55">' + esc(x.desc) + '</div>'
        + '<div style="font-size:12px;color:var(--amber);margin-top:8px;line-height:1.55">'
        + esc(x.why) + '</div></div>';
    });

    h += '<div class="muted" style="font-size:12px;letter-spacing:.1em;margin:18px 0 10px">ספרינטים</div>';
    iv.sprints.forEach(function (x) {
      h += '<div class="card" style="margin-bottom:10px;background:var(--ink)">'
        + '<div style="font-family:Heebo;font-weight:700;font-size:14.5px">' + esc(x.name) + '</div>'
        + '<div class="row" style="gap:6px;margin-top:9px;flex-wrap:wrap">'
        + pill2('מאמץ', x.work) + pill2('הפוגה', x.rest) + pill2('חזרות', x.reps) + '</div>'
        + '<div style="font-size:12px;color:var(--amber);margin-top:8px;line-height:1.55">'
        + esc(x.why) + '</div></div>';
    });
    h += '<div class="muted" style="font-size:11.5px;margin-top:6px">'
      + 'ספרינטים תמיד אחרי חימום מלא, ולעולם לא בסוף אימון כשהשרירים עייפים - שם רוב '
      + 'קרעי ההמסטרינג קורים.</div>';

    return card('אינטרוולים וספרינטים', h, iv.list.length + ' פרוטוקולים');
  }

  function pill2(label, val) {
    if (!val) return '';
    return '<span class="pill" style="white-space:nowrap"><span class="muted">' + esc(label)
      + ' </span><b style="font-family:Heebo">' + ltr(val) + '</b></span>';
  }

  /* ---------------- הלשונית ---------------- */
  function tab(t) {
    var h = '<div class="row noprint" style="margin-bottom:12px">'
      + '<h3 style="flex:1;font-size:16px">אירובי, לב וכלי דם</h3>'
      + '<button class="btn sm ghost" onclick="EBCardioUI.toggleF()">'
      + (SHOW_F ? 'הסתרת הנוסחאות' : 'הצגת הנוסחאות') + '</button>'
      + '<button class="btn sm ghost" onclick="editMeasure(null,\'' + t.id + '\')">+ מדידה</button>'
      + '</div>';
    return h + vo2Block(t) + planBlock(t) + hrBlock(t) + volumeBlock(t)
      + intervalsBlock(t) + systemsBlock() + bpBlock(t) + runBlock(t) + energyBlock(t);
  }

  /* ---------------- פעולות ---------------- */
  function add(tid) {
    var t = tById(tid); if (!t) return;
    var days = EBCardio.toDays(t);
    if (!days.length) { toast('אין מה להוסיף'); return; }
    t.program = t.program || { days: [] };
    t.program.days = t.program.days.concat(days);
    save(); render();
    toast(days.length + ' ימי אירובי נוספו לתוכנית');
  }
  function replace(tid) {
    var t = tById(tid); if (!t) return;
    t.program = t.program || { days: [] };
    var before = t.program.days.length;
    /* מזוהים לפי הקידומת שאנחנו עצמנו כתבנו, כדי לא למחוק יום
       אירובי שהמאמן בנה בעצמו וקרא לו אחרת */
    t.program.days = t.program.days.filter(function (d) {
      return String(d.name || '').indexOf('אירובי · ') !== 0;
    });
    var removed = before - t.program.days.length;
    t.program.days = t.program.days.concat(EBCardio.toDays(t));
    save(); render();
    toast(removed ? (removed + ' הוחלפו') : 'נוספו ימי אירובי');
  }
  /* מספר ימים שנבחר ידנית מבטל בחירה פרטנית קודמת, ולהפך —
     שני מצבים שמתחרים על אותה תוצאה רק היו מבלבלים. */
  function setDays(tid, d) {
    var t = tById(tid); if (!t) return;
    if (d === null) { delete t.cardioDays; delete t.cardioPick; }
    else            { t.cardioDays = d;    delete t.cardioPick; }
    save(); render();
  }
  function pick(tid, id) {
    var t = tById(tid); if (!t) return;
    var list = Array.isArray(t.cardioPick) ? t.cardioPick.slice() : [];
    var i = list.indexOf(id);
    if (i > -1) list.splice(i, 1); else list.push(id);
    if (list.length) { t.cardioPick = list; delete t.cardioDays; }
    else delete t.cardioPick;
    save(); render();
  }
  function toggleF() { SHOW_F = !SHOW_F; render(); }

  window.EBCardioUI = { tab: tab, add: add, replace: replace, toggleF: toggleF,
                        setDays: setDays, pick: pick };
})();

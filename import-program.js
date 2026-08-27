/* =====================================================================
   E.B FIT — ייבוא תוכנית מקובץ HTML
   ---------------------------------------------------------------------
   קורא תוכנית שנכתבה מחוץ למערכת ומכניס אותה לתיק המתאמן.
   הכל מקומי — הקובץ לא נשלח לשום מקום.

   שלוש אסטרטגיות, לפי הסדר:
     1. נתוני JS בקובץ (const DATA = [...] עם rows) — הפורמט של
        התוכניות שהמאמן מייצר. שם המידע האמיתי יושב, כי ה-HTML
        עצמו בנוי מתבניות ${...} וריק מתוכן.
     2. טבלאות HTML — הפורמט הנפוץ בקבצים שנוצרו ביד או ביצוא מ-Word.
     3. כותרות ורשימות — גיבוי אחרון.

   הפענוח לא מריץ את קוד הקובץ. אין eval ואין new Function: קובץ HTML
   הוא קלט לא מהימן, והרצה שלו הייתה נותנת לו גישה מלאה לנתונים
   ולחיבור לשרת. במקום זה יש מפענח מחרוזות ייעודי.
   ===================================================================== */
(function () {
  'use strict';

  var FOR = null, DRAFT = null;

  /* ---------- מפענח מחרוזות מצוטטות ----------
     מטפל בגרש בודד, במרכאות כפולות ובתווי בריחה. נדרש כי כותרות
     בקובץ נראות כך:  title:"יום א' — חזה"  — מרכאות שעוטפות גרש. */
  function readString(s, i) {
    var q = s.charAt(i);
    if (q !== '"' && q !== "'" && q !== '`') return null;
    var out = '', j = i + 1;
    while (j < s.length) {
      var c = s.charAt(j);
      if (c === '\\') {
        var n = s.charAt(j + 1);
        out += (n === 'n') ? '\n' : (n === 't') ? '\t' : n;
        j += 2; continue;
      }
      if (c === q) return { v: out, i: j + 1 };
      out += c; j++;
    }
    return null;
  }

  // מדלג על רווחים, פסיקים והערות
  function skip(s, i) {
    while (i < s.length) {
      var c = s.charAt(i);
      if (c === ' ' || c === '\n' || c === '\r' || c === '\t' || c === ',') { i++; continue; }
      if (c === '/' && s.charAt(i + 1) === '/') { while (i < s.length && s.charAt(i) !== '\n') i++; continue; }
      if (c === '/' && s.charAt(i + 1) === '*') { i = s.indexOf('*/', i); i = i < 0 ? s.length : i + 2; continue; }
      break;
    }
    return i;
  }

  // מערך של מערכי מחרוזות:  [ ['a','b'], ['c','d'] ]
  function readRows(s, i) {
    i = skip(s, i);
    if (s.charAt(i) !== '[') return null;
    i++;
    var rows = [];
    while (true) {
      i = skip(s, i);
      if (i >= s.length) break;
      if (s.charAt(i) === ']') { i++; break; }
      if (s.charAt(i) !== '[') { i++; continue; }
      i++;
      var cells = [];
      while (true) {
        i = skip(s, i);
        if (i >= s.length) break;
        if (s.charAt(i) === ']') { i++; break; }
        var r = readString(s, i);
        if (r) { cells.push(r.v); i = r.i; }
        else i++;                                  // מספר או ערך אחר — מדלגים
      }
      if (cells.length) rows.push(cells);
    }
    return { rows: rows, i: i };
  }

  // מערך מחרוזות פשוט:  ['a', 'b']
  function readStrArray(s, i) {
    i = skip(s, i);
    if (s.charAt(i) !== '[') return null;
    i++;
    var out = [];
    while (i < s.length) {
      i = skip(s, i);
      if (s.charAt(i) === ']') { i++; break; }
      var r = readString(s, i);
      if (r) { out.push(r.v); i = r.i; } else i++;
    }
    return { arr: out, i: i };
  }

  /* ימי אירובי/מוביליטי בנויים מ-blocks עם כותרת ורשימת פריטים,
     ולא משורות של סטים וחזרות. בלי זה יום שלם היה נופל מהייבוא. */
  function fromBlocks(src) {
    var days = [], re = /\bblocks\s*:/g, m;
    while ((m = re.exec(src))) {
      var i = skip(src, m.index + m[0].length);
      if (src.charAt(i) !== '[') continue;
      i++;
      var ex = [];
      while (i < src.length) {
        i = skip(src, i);
        if (src.charAt(i) === ']') { i++; break; }
        if (src.charAt(i) !== '{') { i++; continue; }
        var end = src.indexOf('}', i);
        if (end < 0) break;
        var chunk = src.slice(i, end + 1);

        var head = lastField(chunk, 'h') || lastField(chunk, 'title') || '';
        var im = /\bitems\s*:/.exec(chunk);
        var items = [];
        if (im) {
          var got = readStrArray(chunk, im.index + im[0].length);
          if (got) items = got.arr;
        }
        if (head && !items.length) ex.push({ name:head, sets:'', reps:'', weight:'', rest:'', note:'' });
        items.forEach(function (it, k) {
          ex.push({ name: (k === 0 && head) ? head : '·', sets:'', reps:'', weight:'', rest:'', note: it });
        });
        i = end + 1;
      }
      if (!ex.length) continue;
      var before = src.slice(Math.max(0, m.index - 700), m.index);
      days.push({ name: lastField(before, 'title') || 'אירובי', exercises: ex });
    }
    return days;
  }

  /* ---------- אסטרטגיה 1: נתוני JS ---------- */
  function fromJS(src) {
    var days = [], re = /\brows\s*:/g, m;
    while ((m = re.exec(src))) {
      var got = readRows(src, m.index + m[0].length);
      if (!got || !got.rows.length) continue;

      // הכותרת והחימום של אותו יום — בטקסט שלפני rows
      var before = src.slice(Math.max(0, m.index - 700), m.index);
      var title  = lastField(before, 'title') || lastField(before, 'label') || '';
      var warm   = lastField(before, 'warmup') || '';

      var ex = [];
      if (warm) ex.push({ name:'חימום', sets:'', reps:'', weight:'', rest:'', note:warm });

      got.rows.forEach(function (c) {
        if (!c[0] || !String(c[0]).trim()) return;
        ex.push({
          name  : String(c[0]).trim(),
          sets  : clean(c[1]),
          reps  : clean(c[2]),
          weight: clean(c[3]),
          rest  : '',                       // הפורמט הזה לא כולל מנוחה
          note  : clean(c[4])
        });
      });
      if (ex.length) days.push({ name: title || ('יום ' + (days.length + 1)), exercises: ex });
    }
    return days;
  }
  // הערך האחרון של שדה מסוים בקטע טקסט
  function lastField(txt, key) {
    var re = new RegExp('\\b' + key + '\\s*:\\s*', 'g'), m, val = '';
    while ((m = re.exec(txt))) {
      var r = readString(txt, m.index + m[0].length);
      if (r) val = r.v;
    }
    return val;
  }
  function clean(v) {
    return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().replace(/^-$/, '');
  }

  /* ---------- אסטרטגיה 2: טבלאות HTML ----------
     שלוש דרכים לזהות עמודה, לפי סדר אמינות:
       1. מחלקת ה-td   (ex-name, ex-sets...)
       2. כותרת הטבלה  (תרגיל, סטים, חזרות...)
       3. מיקום, אחרי דילוג על תאי בקרה בתחילת השורה

     הדילוג בסעיף 3 הכרחי: בתוכניות עם תיבות סימון התא הראשון ריק,
     וקריאה לפי מיקום בלבד הייתה מזהה כל שורה כחסרת שם ומוחקת אותה. */
  var COL_CLASS = {
    name:/(^|[\s-])(ex-)?name\b|תרגיל/i, sets:/(^|[\s-])(ex-)?sets\b/i,
    reps:/(^|[\s-])(ex-)?reps\b/i,       weight:/(^|[\s-])(ex-)?weight\b/i,
    rest:/(^|[\s-])(ex-)?rest\b/i,       note:/(^|[\s-])(ex-)?notes?\b/i
  };
  var COL_HEAD = {
    name:/תרגיל|שם|exercise/i, sets:/סטים|sets/i, reps:/חזרות|reps/i,
    weight:/משקל|weight|קילו/i, rest:/מנוחה|rest/i, note:/הערה|הערות|note/i
  };

  function headerMap(tb) {
    var map = {}, ths = tb.querySelectorAll('thead th, tr:first-child th');
    for (var i = 0; i < ths.length; i++) {
      var t = (ths[i].textContent || '').trim();
      if (!t) continue;
      for (var k in COL_HEAD) if (map[k] === undefined && COL_HEAD[k].test(t)) { map[k] = i; break; }
    }
    return map;
  }

  function fromTables(doc) {
    var days = [];
    var tables = doc.querySelectorAll('table');
    for (var i = 0; i < tables.length; i++) {
      var tb = tables[i];
      var hmap = headerMap(tb);
      var trs = tb.querySelectorAll('tbody tr');
      if (!trs.length) trs = tb.querySelectorAll('tr');
      var ex = [];

      for (var j = 0; j < trs.length; j++) {
        if (trs[j].querySelector('th')) continue;           // שורת כותרת
        var tds = trs[j].querySelectorAll('td');
        if (tds.length < 2) continue;

        var txt = [].map.call(tds, function (td) {
          return (td.textContent || '').replace(/\s+/g, ' ').trim();
        });
        var cls = [].map.call(tds, function (td) { return td.className || ''; });

        var row = {};
        // 1. לפי מחלקה
        for (var c = 0; c < tds.length; c++)
          for (var k in COL_CLASS)
            if (row[k] === undefined && COL_CLASS[k].test(cls[c])) row[k] = txt[c];

        // 2. לפי כותרת
        for (var k2 in hmap)
          if (row[k2] === undefined && txt[hmap[k2]] !== undefined) row[k2] = txt[hmap[k2]];

        // 3. לפי מיקום, אחרי דילוג על תאי בקרה ריקים בתחילת השורה
        if (row.name === undefined) {
          var s = 0;
          while (s < txt.length && !txt[s]) s++;
          if (s >= txt.length) continue;
          row.name   = txt[s];
          row.sets   = row.sets   !== undefined ? row.sets   : (txt[s+1] || '');
          row.reps   = row.reps   !== undefined ? row.reps   : (txt[s+2] || '');
          row.weight = row.weight !== undefined ? row.weight : (txt[s+3] || '');
          row.note   = row.note   !== undefined ? row.note   : (txt[s+4] || '');
        }

        var nm = (row.name || '').trim();
        if (!nm || nm === '×' || /^(תרגיל|שם|exercise)$/i.test(nm)) continue;

        ex.push({
          name: nm, sets: clean(row.sets), reps: clean(row.reps),
          weight: clean(row.weight), rest: clean(row.rest), note: clean(row.note)
        });
      }
      if (!ex.length) continue;
      days.push({ name: titleNear(tb) || ('יום ' + (days.length + 1)), exercises: ex });
    }
    return days;
  }
  // הכותרת הקרובה ביותר שמעל האלמנט
  function titleNear(el) {
    // כותרת ייעודית בתוך הכרטיס של היום עדיפה על סריקה כלפי מעלה
    var box = el.closest ? el.closest('[class*="day"],[class*="card"],section,article') : null;
    if (box) {
      var d = box.querySelector('[class*="dtitle"],[class*="daytitle"],h3,h4');
      if (d) {
        var dt = (d.textContent || '').replace(/\s+/g, ' ').trim();
        if (dt && dt.length < 90) return dt;
      }
    }
    var n = el;
    for (var hop = 0; hop < 6 && n; hop++) {
      var p = n.previousElementSibling;
      while (p) {
        if (/^H[1-5]$/.test(p.tagName) || /title|daytitle|head/i.test(p.className || '')) {
          var t = (p.textContent || '').replace(/\s+/g, ' ').trim();
          if (t && t.length < 90) return t;
        }
        p = p.previousElementSibling;
      }
      n = n.parentElement;
    }
    return '';
  }

  /* ---------- אסטרטגיה 3: כותרות ורשימות ---------- */
  function fromLists(doc) {
    var days = [], heads = doc.querySelectorAll('h1,h2,h3,h4');
    for (var i = 0; i < heads.length; i++) {
      var ex = [], n = heads[i].nextElementSibling;
      while (n && !/^H[1-4]$/.test(n.tagName)) {
        var lis = n.tagName === 'UL' || n.tagName === 'OL'
          ? n.querySelectorAll('li') : n.querySelectorAll('li');
        for (var j = 0; j < lis.length; j++) {
          var t = (lis[j].textContent || '').replace(/\s+/g, ' ').trim();
          if (!t) continue;
          // "סקוואט 4×10" / "סקוואט - 4x10"
          var m = t.match(/^(.{2,60}?)\s*[-–—:]?\s*(\d+)\s*[x×]\s*([\w֐-׿-]+)/);
          ex.push(m
            ? { name:m[1].trim(), sets:m[2], reps:m[3], weight:'', rest:'', note:'' }
            : { name:t.slice(0, 70), sets:'', reps:'', weight:'', rest:'', note:'' });
        }
        n = n.nextElementSibling;
      }
      if (ex.length >= 2)
        days.push({ name:(heads[i].textContent || '').replace(/\s+/g,' ').trim().slice(0,80), exercises: ex });
    }
    return days;
  }

  /* ---------- תזונה ----------
     חלק מהתוכניות הן "אימונים ותזונה". למערכת אין מבנה לתפריט, ובלי
     החילוץ הזה חצי מהמסמך היה נעלם בייבוא. נאסף כטקסט להערות. */
  function extractNutrition(src) {
    var out = [];

    var mm = /\bmeals\s*:/.exec(src);
    if (mm) {
      var i = skip(src, mm.index + mm[0].length);
      if (src.charAt(i) === '[') {
        i++;
        while (i < src.length) {
          i = skip(src, i);
          if (src.charAt(i) === ']') break;
          if (src.charAt(i) !== '{') { i++; continue; }
          var depth = 0, start = i, j = i;
          for (; j < src.length; j++) {                 // סוגר תואם, לא הראשון
            var ch = src.charAt(j);
            if (ch === '"' || ch === "'" || ch === '`') { var r = readString(src, j); j = r ? r.i - 1 : j; continue; }
            if (ch === '{') depth++;
            else if (ch === '}') { depth--; if (!depth) break; }
          }
          var chunk = src.slice(start, j + 1);
          var title = lastField(chunk, 'title');
          var im = /\bitems\s*:/.exec(chunk);
          var items = im ? (readStrArray(chunk, im.index + im[0].length) || { arr: [] }).arr : [];
          if (title || items.length) {
            out.push((title ? '— ' + title + ' —' : '') +
                     (items.length ? '\n' + items.map(function (x) { return '• ' + x; }).join('\n') : ''));
          }
          i = j + 1;
        }
      }
    }

    var rm = /\brules\s*:/.exec(src);
    if (rm) {
      var got = readStrArray(src, rm.index + rm[0].length);
      if (got && got.arr.length)
        out.push('— כללים —\n' + got.arr.map(function (x) { return '• ' + x; }).join('\n'));
    }
    return out.join('\n\n');
  }

  /* ---------- הפענוח ---------- */
  function parse(src) {
    var days = fromJS(src), how = 'נתוני התוכנית שבקובץ';
    if (days.length) days = days.concat(fromBlocks(src));   // ימי אירובי בסוף
    if (!days.length) {
      var doc = new DOMParser().parseFromString(src, 'text/html');
      days = fromTables(doc); how = 'טבלאות';
      if (!days.length) { days = fromLists(doc); how = 'כותרות ורשימות'; }
    }
    return { days: days, how: how, nutrition: extractNutrition(src) };
  }

  /* ---------- ממשק ---------- */
  function open(traineeId) {
    FOR = traineeId;
    var inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.html,.htm,text/html';
    inp.onchange = function () {
      var f = inp.files && inp.files[0];
      if (!f) return;
      if (f.size > 8 * 1024 * 1024) { toast('הקובץ גדול מדי'); return; }
      var fr = new FileReader();
      fr.onload = function () { handle(String(fr.result || ''), f.name); };
      fr.onerror = function () { toast('לא הצלחנו לקרוא את הקובץ'); };
      fr.readAsText(f, 'utf-8');
    };
    inp.click();
  }

  function handle(src, fname) {
    var r = parse(src);
    if (!r.days.length) {
      openModal('<div class="mh"><h3>לא זוהתה תוכנית</h3>'
        + '<button class="iconbtn" onclick="closeModal()">✕</button></div><div class="mb">'
        + '<p style="font-size:13.5px;margin:0 0 10px">לא הצלחנו לזהות תרגילים בקובץ <b>' + esc(fname) + '</b>.</p>'
        + '<p class="muted" style="font-size:13px;margin:0">המייבא מזהה שלושה מבנים: נתוני תוכנית בקובץ, '
        + 'טבלאות HTML, ורשימות תחת כותרות. אם הקובץ בנוי אחרת — שלח אותו לפיתוח ונוסיף תמיכה.</p>'
        + '</div><div class="mf"><button class="btn ghost" onclick="closeModal()">סגירה</button></div>', true);
      return;
    }
    DRAFT = r;
    preview(fname);
  }

  function preview(fname) {
    var t = tById(FOR);
    var total = DRAFT.days.reduce(function (a, d) { return a + d.exercises.length; }, 0);
    var partial = DRAFT.days.reduce(function (a, d) {
      return a + d.exercises.filter(function (e) { return !e.sets || !e.reps; }).length; }, 0);

    var h = '<div class="mh"><h3>ייבוא תוכנית ל' + esc(t.name) + '</h3>'
      + '<button class="iconbtn" onclick="closeModal()">✕</button></div><div class="mb">'
      + '<div class="muted" style="font-size:12.5px;margin-bottom:10px">'
      + esc(fname) + ' · זוהה לפי ' + esc(DRAFT.how) + ' · '
      + DRAFT.days.length + ' ימים, ' + total + ' תרגילים</div>';

    DRAFT.days.forEach(function (d) {
      h += '<div class="card" style="margin-bottom:10px;padding:12px">'
        + '<div style="font-family:Rubik;font-weight:700;margin-bottom:8px">' + esc(d.name) + '</div>';
      d.exercises.forEach(function (e) {
        var meta = [e.sets && e.sets + (e.reps ? '×' + e.reps : ' סטים'),
                    !e.sets && e.reps ? e.reps : '', e.weight].filter(Boolean).join(' · ');
        h += '<div class="line-item" style="padding:5px 0;align-items:flex-start">'
          + '<span style="flex:1;font-size:14px">' + esc(e.name)
          + (e.note ? '<div class="muted" style="font-size:12px;margin-top:2px">' + esc(e.note.slice(0,110)) + '</div>' : '')
          + '</span>'
          + '<span class="muted" style="font-size:12.5px;white-space:nowrap">' + esc(meta) + '</span></div>';
      });
      h += '</div>';
    });

    if (partial)
      h += '<div class="muted" style="font-size:12.5px">' + partial
         + ' תרגילים הגיעו בלי סטים או חזרות מלאים — אפשר להשלים אחרי הייבוא.</div>';

    if (DRAFT.nutrition) {
      h += '<div class="sep"></div>'
        + '<label style="font-size:13.5px;display:flex;align-items:center;gap:8px">'
        + '<input type="checkbox" id="ip_nutri" checked> לצרף גם את התזונה שבקובץ להערות המתאמן</label>'
        + '<div class="card" style="margin-top:8px;padding:12px;max-height:180px;overflow:auto">'
        + '<pre style="margin:0;white-space:pre-wrap;font-family:inherit;font-size:12.5px;color:var(--mut)">'
        + esc(DRAFT.nutrition) + '</pre></div>';
    }

    var has = ((t.program && t.program.days) || []).length;
    h += '</div><div class="mf">'
      + '<button class="btn" onclick="EBImport.apply(0)">' + (has ? 'החלפת התוכנית' : 'ייבוא') + '</button>'
      + (has ? '<button class="btn ghost" onclick="EBImport.apply(1)">הוספה לקיימת</button>' : '')
      + '<div style="flex:1"></div><button class="btn ghost" onclick="closeModal()">ביטול</button></div>';
    openModal(h, true);
  }

  function apply(append) {
    var t = tById(FOR); if (!t || !DRAFT) return;
    if (!append && ((t.program && t.program.days) || []).length &&
        !confirm('להחליף את התוכנית הקיימת? השינוי לא הפיך.')) return;
    t.program = t.program || { days: [] };
    t.program.days = append ? t.program.days.concat(DRAFT.days) : DRAFT.days.slice();

    var nu = document.getElementById('ip_nutri');
    if (DRAFT.nutrition && nu && nu.checked) {
      var block = 'תזונה (מהקובץ המיובא)\n' + DRAFT.nutrition;
      t.notes = t.notes ? (t.notes + '\n\n' + block) : block;
    }

    save(); closeModal();
    SUBTAB = 'program'; render();
    toast('התוכנית יובאה — אפשר לערוך כל שדה');
  }

  window.EBImport = { open: open, apply: apply, parse: parse };
})();

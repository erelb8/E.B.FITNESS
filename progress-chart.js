/* =====================================================================
   E.B FIT — גרף התקדמות בתרגילים
   ---------------------------------------------------------------------
   משותף לתיק המתאמן אצל המאמן (לשונית "אימונים") ולדף המתאמן ("מעקב").
   נבנה מהדיווחים — workout_logs — ולא מהתוכנית: מה שהורם, לא מה שתוכנן.

   שלושה מדדים, וכל אחד בגרף משלו עם ציר אחד:
     כוח משוער  — 1RM לפי אפלי, w·(1+r/30). משווה 60×10 ל-65×5 בהגינות.
     משקל כבד   — המשקל הכבד ביותר באותו אימון, כמו שהמתאמן מכיר אותו.
     נפח        — משקל × חזרות על כל הסטים. זז גם כשהמשקל עומד.

   קו מגמה (ריבועים פחותים) עם שינוי לחודש, שיא מסומן, תווית ישירה על
   הערך האחרון, ריחוף עם כל הסטים, ותצוגת טבלה. צבע אחד לסדרה אחת —
   הכותרת מזהה אותה, ואין מקרא.
   ===================================================================== */
(function () {
  'use strict';

  (window.EB_MOD = window.EB_MOD || {})['chart'] = 'v180';

  var STATE = {};      // לכל פאנל: הדיווחים, התרגיל, המדד, טבלה או גרף
  var GEO = {};        // רוחב הציור לכל פאנל — בשביל מיקום החלונית הצפה

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function num(v) { var n = Number(v); return isFinite(n) && n > 0 ? n : null; }
  function r1(x) { return Math.round(x * 10) / 10; }
  function e1rm(w, r) { w = num(w); if (!w) return null; r = num(r) || 1; if (r > 12) r = 12; return r <= 1 ? w : w * (1 + r / 30); }
  function tOf(d) { return new Date(String(d).slice(0, 10) + 'T00:00').getTime(); }
  function fmtD(d) { var x = new Date(String(d).slice(0, 10) + 'T00:00'); return x.getDate() + '.' + (x.getMonth() + 1); }

  /* ---------- מהדיווחים לסדרה לכל תרגיל ---------- */
  function sets(e) {
    var L = (e.setLog || []).map(function (x) { return { w: num(x && x.w), r: num(x && x.r) }; })
                            .filter(function (x) { return x.w || x.r; });
    if (!L.length && (num(e.weight) || num(e.reps))) L = [{ w: num(e.weight), r: num(e.reps) }];
    return L;
  }
  function series(logs) {
    var by = {};
    (logs || []).forEach(function (l) {
      var d = String(l.date || '').slice(0, 10); if (!d) return;
      (l.entries || []).forEach(function (e) {
        var name = String(e.ex || e.name || '').trim();
        if (!name || e.done === false) return;
        var S = sets(e); if (!S.length) return;
        var best = null, heavy = 0, vol = 0;
        S.forEach(function (s) {
          var est = e1rm(s.w, s.r); if (est && (!best || est > best.est)) best = { est: est, w: s.w, r: s.r };
          if (s.w && s.w > heavy) heavy = s.w;
          if (s.w && s.r) vol += s.w * s.r;
        });
        if (!best && !vol) return;
        var p = { date: d, t: tOf(d), est: best ? best.est : 0, heavy: heavy, vol: vol, sets: S,
                  top: best ? best : { w: heavy, r: null } };
        var arr = by[name] = by[name] || [];
        var same = arr.filter(function (x) { return x.date === d; })[0];
        if (same) { if (p.est > same.est) arr[arr.indexOf(same)] = p; }   // אותו יום פעמיים — החזק נשאר
        else arr.push(p);
      });
    });
    Object.keys(by).forEach(function (k) { by[k].sort(function (a, b) { return a.t - b.t; }); });
    return by;
  }

  var METRICS = {
    est:   { label: 'כוח משוער', unit: 'ק״ג', val: function (p) { return p.est; } },
    heavy: { label: 'משקל כבד',  unit: 'ק״ג', val: function (p) { return p.heavy; } },
    vol:   { label: 'נפח',        unit: 'ק״ג', val: function (p) { return p.vol; } }
  };

  /* ---------- מגמה: ריבועים פחותים, בק״ג ליום ---------- */
  function trend(pts, f) {
    var P = pts.filter(function (p) { return f(p) > 0; });
    if (P.length < 3) return null;
    var t0 = P[0].t, n = P.length, sx = 0, sy = 0, sxy = 0, sxx = 0;
    P.forEach(function (p) { var x = (p.t - t0) / 864e5, y = f(p); sx += x; sy += y; sxy += x * y; sxx += x * x; });
    var den = n * sxx - sx * sx; if (!den) return null;
    var b = (n * sxy - sx * sy) / den, a = (sy - b * sx) / n;
    return { a: a, b: b, t0: t0 };
  }

  /* ---------- הגרף ---------- */
  function chart(id, pts, mk) {
    var M = METRICS[mk], f = M.val;
    var P = pts.filter(function (p) { return f(p) > 0; });
    if (P.length < 2) {
      return '<div class="pc-empty">צריך לפחות שני אימונים בתרגיל הזה כדי לראות מגמה.</div>';
    }
    /* בטלפון מציירים ברוחב של טלפון. גרף שצויר ב-640 והוקטן ל-350 הפך
       את המספרים לגודל 6 פיקסלים. */
    var narrow = (window.innerWidth || 800) < 600;
    var W = narrow ? 360 : 640, H = narrow ? 210 : 230, L = narrow ? 38 : 44, R = narrow ? 58 : 70, T = 14, B = 28;
    GEO[id] = W;
    var tMin = P[0].t, tMax = P[P.length - 1].t; if (tMax === tMin) tMax = tMin + 864e5;
    var vals = P.map(f), vMin = Math.min.apply(null, vals), vMax = Math.max.apply(null, vals);
    var pad = (vMax - vMin) * 0.18 || vMax * 0.08 || 1; vMin = Math.max(0, vMin - pad); vMax += pad;
    var X = function (t) { return L + (t - tMin) / (tMax - tMin) * (W - L - R); };
    var Y = function (v) { return T + (1 - (v - vMin) / (vMax - vMin)) * (H - T - B); };
    var best = P.reduce(function (a, p) { return f(p) > f(a) ? p : a; }, P[0]);
    var last = P[P.length - 1];

    var g = '<svg class="pc-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(M.label) + ' לאורך זמן" direction="ltr">';
    // קווי רשת וציר — חלשים
    for (var i = 0; i <= 3; i++) {
      var v = vMin + (vMax - vMin) * i / 3, y = Y(v);
      g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '" class="pc-grid"/>'
        + '<text x="' + (L - 6) + '" y="' + (y + 4).toFixed(1) + '" class="pc-ax" text-anchor="end">'
        + (mk === 'vol' ? Math.round(v).toLocaleString('en-US') : r1(v)) + '</text>';
    }
    g += '<text x="' + L + '" y="' + (H - 8) + '" class="pc-ax" text-anchor="start">' + fmtD(P[0].date) + '</text>'
      + '<text x="' + (W - R) + '" y="' + (H - 8) + '" class="pc-ax" text-anchor="end">' + fmtD(last.date) + '</text>';
    // מגמה
    var tr = trend(P, f);
    if (tr) {
      var y1 = tr.a + tr.b * ((tMin - tr.t0) / 864e5), y2 = tr.a + tr.b * ((tMax - tr.t0) / 864e5);
      g += '<line x1="' + X(tMin).toFixed(1) + '" y1="' + Y(y1).toFixed(1) + '" x2="' + X(tMax).toFixed(1) + '" y2="' + Y(y2).toFixed(1)
        + '" class="pc-trend"/>';
    }
    // הקו
    g += '<path class="pc-line" d="' + P.map(function (p, i) { return (i ? 'L' : 'M') + X(p.t).toFixed(1) + ' ' + Y(f(p)).toFixed(1); }).join(' ') + '"/>';
    // נקודות — עם טבעת בצבע המשטח, השיא מודגש
    P.forEach(function (p, i) {
      var isBest = p === best;
      g += '<circle cx="' + X(p.t).toFixed(1) + '" cy="' + Y(f(p)).toFixed(1) + '" r="' + (isBest ? 6 : 4.5)
        + '" class="pc-dot' + (isBest ? ' pc-best' : '') + '"/>';
    });
    // תווית ישירה: הערך האחרון, והשיא אם הוא אחר
    var lab = function (p, txt, cls) {
      return '<text x="' + (X(p.t) + 9).toFixed(1) + '" y="' + (Y(f(p)) + 4).toFixed(1) + '" class="' + cls + '">' + txt + '</text>';
    };
    var topTxt = function (p) {
      return mk === 'vol' ? Math.round(p.vol).toLocaleString('en-US')
           : mk === 'heavy' ? r1(p.heavy) + ''
           : (p.top.w ? r1(p.top.w) + (p.top.r ? '×' + p.top.r : '') : r1(p.est));
    };
    g += lab(last, topTxt(last), 'pc-lab');
    if (best !== last) g += lab(best, '★ ' + topTxt(best), 'pc-lab pc-lab-best');
    // שכבת ריחוף: עמודה שקופה לכל נקודה, רחבה מהסימן
    P.forEach(function (p, i) {
      var x0 = i ? (X(P[i - 1].t) + X(p.t)) / 2 : L, x1 = i < P.length - 1 ? (X(p.t) + X(P[i + 1].t)) / 2 : W - R;
      g += '<rect class="pc-hit" x="' + x0.toFixed(1) + '" y="' + T + '" width="' + Math.max(1, x1 - x0).toFixed(1) + '" height="' + (H - T - B)
        + '" data-pc="' + id + '" data-i="' + pts.indexOf(p) + '"/>';
    });
    g += '<line class="pc-cross" x1="0" x2="0" y1="' + T + '" y2="' + (H - B) + '" style="display:none"/>';
    return g + '</svg>';
  }

  function tableView(pts, mk) {
    return '<div style="overflow-x:auto"><table class="pc-table"><thead><tr><th>תאריך</th><th>סטים</th><th>'
      + esc(METRICS[mk].label) + '</th></tr></thead><tbody>'
      + pts.slice().reverse().map(function (p) {
          return '<tr><td>' + fmtD(p.date) + '</td><td><span class="pc-ltr">' + esc(setsTxt(p)) + '</span></td><td>'
            + (mk === 'vol' ? Math.round(p.vol).toLocaleString('en-US') : r1(METRICS[mk].val(p))) + '</td></tr>';
        }).join('') + '</tbody></table></div>';
  }
  function setsTxt(p) {
    return p.sets.map(function (s) { return (s.w ? r1(s.w) : '') + (s.w && s.r ? '×' : '') + (s.r || ''); }).join(' · ');
  }

  /* ---------- הפאנל ---------- */
  function panel(id, logs, opts) {
    opts = opts || {};
    var st = STATE[id] = STATE[id] || { mk: 'est', ex: null, table: false };
    st.logs = logs; st.opts = opts;
    return '<div class="pc" id="' + id + '">' + inner(id) + '</div>';
  }
  function inner(id) {
    var st = STATE[id], by = series(st.logs);
    var names = Object.keys(by).filter(function (k) { return by[k].length >= 1; })
      .sort(function (a, b) { return by[b].length - by[a].length || (by[b][by[b].length - 1].t - by[a][by[a].length - 1].t); });
    var head = '<div class="pc-head"><div class="pc-title">' + esc(st.opts.title || 'התקדמות בתרגילים') + '</div>';
    if (!names.length) {
      return head + '</div><div class="pc-empty">' + esc(st.opts.empty ||
        'הגרף מתמלא מהאימונים שמדווחים עם משקל וחזרות. אחרי שני אימונים באותו תרגיל תופיע כאן מגמה.') + '</div>';
    }
    if (!st.ex || !by[st.ex]) st.ex = names[0];
    var pts = by[st.ex], M = METRICS[st.mk], f = M.val;
    var P = pts.filter(function (p) { return f(p) > 0; });
    // סיכום בשורה אחת: שינוי, שיא, תדירות
    var sum = '';
    if (P.length >= 2) {
      var first = f(P[0]), lastV = f(P[P.length - 1]);
      var pct = first ? Math.round((lastV - first) / first * 100) : 0;
      var weeks = Math.max(1, Math.round((P[P.length - 1].t - P[0].t) / (7 * 864e5)));
      var tr = trend(P, f), perMonth = tr && first ? Math.round(tr.b * 30 / first * 1000) / 10 : null;
      sum = '<div class="pc-sum">'
        + '<span><b dir="ltr" class="' + (pct > 0 ? 'pc-up' : pct < 0 ? 'pc-down' : '') + '">' + (pct > 0 ? '+' : '') + pct + '%</b> ב-' + weeks + (weeks === 1 ? ' שבוע' : ' שבועות') + '</span>'
        + (perMonth != null ? '<span>מגמה <b dir="ltr">' + (perMonth > 0 ? '+' : '') + perMonth + '%</b> לחודש</span>' : '')
        + '<span>' + P.length + ' אימונים</span></div>';
    }
    var chips = names.slice(0, 8).map(function (n) {
      return '<button class="pc-chip' + (n === st.ex ? ' on' : '') + '" data-pcex="' + esc(n) + '" data-pcid="' + id + '">'
        + esc(n) + ' <span>' + by[n].length + '</span></button>';
    }).join('');
    var more = names.length > 8 ? '<select class="pc-more" data-pcsel="' + id + '"><option value="">עוד ' + (names.length - 8) + ' תרגילים…</option>'
      + names.slice(8).map(function (n) { return '<option' + (n === st.ex ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('') + '</select>' : '';
    var mks = Object.keys(METRICS).map(function (k) {
      return '<button class="pc-seg' + (k === st.mk ? ' on' : '') + '" data-pcmk="' + k + '" data-pcid="' + id + '">' + METRICS[k].label + '</button>';
    }).join('');
    return head
      + '<button class="pc-seg" data-pctab="' + id + '">' + (st.table ? 'גרף' : 'טבלה') + '</button></div>'
      + '<div class="pc-chips">' + chips + more + '</div>'
      + '<div class="pc-bar"><div class="pc-name">' + esc(st.ex) + '</div><div class="pc-segs">' + mks + '</div></div>'
      + sum
      + (st.table ? tableView(pts, st.mk) : '<div class="pc-plot">' + chart(id, pts, st.mk) + '<div class="pc-tip" hidden></div></div>')
      + '<div class="pc-note">' + (st.mk === 'est' ? 'כוח משוער = כמה אפשר להרים לחזרה אחת, לפי המשקל והחזרות. משווה בהגינות אימון של 60×10 לאימון של 65×5.'
          : st.mk === 'vol' ? 'נפח = משקל × חזרות על כל הסטים. עולה גם כשמוסיפים סט או חזרות באותו משקל.'
          : 'המשקל הכבד ביותר שהורם באותו אימון.') + ' הקו המקווקו — המגמה.</div>';
  }
  function repaint(id) { var el = document.getElementById(id); if (el && STATE[id]) el.innerHTML = inner(id); }

  /* ---------- אינטראקציה ---------- */
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-pcex],[data-pcmk],[data-pctab]');
    if (!b) return;
    var id = b.dataset.pcid || b.dataset.pctab, st = STATE[id]; if (!st) return;
    if (b.dataset.pcex) st.ex = b.dataset.pcex;
    else if (b.dataset.pcmk) st.mk = b.dataset.pcmk;
    else st.table = !st.table;
    repaint(id);
  });
  document.addEventListener('change', function (e) {
    var s = e.target.closest && e.target.closest('[data-pcsel]');
    if (!s || !s.value) return;
    var st = STATE[s.dataset.pcsel]; if (!st) return;
    st.ex = s.value; repaint(s.dataset.pcsel);
  });
  function tip(e) {
    var r = e.target.closest && e.target.closest('.pc-hit');
    var plot = e.target.closest && e.target.closest('.pc-plot');
    if (!plot) return;
    var box = plot.querySelector('.pc-tip'), cross = plot.querySelector('.pc-cross');
    if (!r) { if (box) box.hidden = true; if (cross) cross.style.display = 'none'; return; }
    var st = STATE[r.dataset.pc]; if (!st) return;
    var by = series(st.logs), p = by[st.ex][+r.dataset.i]; if (!p) return;
    var M = METRICS[st.mk];
    box.innerHTML = '<b>' + fmtD(p.date) + '</b><span class="pc-ltr">' + esc(setsTxt(p)) + '</span>'
      + '<span>' + M.label + ': <b dir="ltr">' + (st.mk === 'vol' ? Math.round(p.vol).toLocaleString('en-US') : r1(M.val(p))) + '</b> ' + M.unit + '</span>';
    box.hidden = false;
    var svg = plot.querySelector('svg'), sb = svg.getBoundingClientRect(), pb = plot.getBoundingClientRect();
    var cx = Number(r.getAttribute('x')) + Number(r.getAttribute('width')) / 2;
    // מרכז הנקודה עצמה, לא של אזור הריחוף
    var dots = svg.querySelectorAll('.pc-dot'), idx = [].indexOf.call(svg.querySelectorAll('.pc-hit'), r);
    if (dots[idx]) cx = Number(dots[idx].getAttribute('cx'));
    cross.setAttribute('x1', cx); cross.setAttribute('x2', cx); cross.style.display = '';
    var px = (cx / (GEO[r.dataset.pc] || 640)) * sb.width + (sb.left - pb.left);
    box.style.left = Math.max(4, Math.min(pb.width - box.offsetWidth - 4, px - box.offsetWidth / 2)) + 'px';
  }
  document.addEventListener('mousemove', tip);
  document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('.pc-hit')) tip(e); });
  document.addEventListener('mouseleave', tip, true);

  /* ---------- עיצוב — משתמש במשתני הצבע של הדף ---------- */
  var css = document.createElement('style');
  css.textContent =
    '.pc{min-width:0;max-width:100%;overflow:hidden}'
  + '.pc-ltr{direction:ltr;unicode-bidi:isolate;display:inline-block}'
  + '.pc-head{display:flex;align-items:center;gap:8px;margin-bottom:10px}'
  + '.pc-title{flex:1;min-width:0;font-family:Heebo;font-weight:700;font-size:15px}'
  + '.pc-chips{display:flex;gap:6px;overflow-x:auto;max-width:100%;padding-bottom:4px;margin-bottom:10px;-webkit-overflow-scrolling:touch}'
  + '.pc-chip{flex:none;font:inherit;font-size:12.5px;padding:6px 11px;border-radius:20px;cursor:pointer;white-space:nowrap;'
  +   'border:1px solid var(--line2,#5E4A38);background:transparent;color:var(--mut,#D6CBBB)}'
  + '.pc-chip span{opacity:.55;margin-inline-start:3px}'
  + '.pc-chip.on{border-color:var(--or,#C49A6C);background:var(--or-soft,rgba(196,154,108,.15));color:var(--or,#C49A6C)}'
  + '.pc-more{flex:none;font:inherit;font-size:12.5px;padding:5px 8px;border-radius:20px;background:transparent;color:var(--mut,#D6CBBB);border:1px solid var(--line2,#5E4A38)}'
  + '.pc-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px}'
  + '.pc-name{flex:1;min-width:120px;font-family:Heebo;font-weight:800;font-size:16px}'
  + '.pc-segs{display:flex;border:1px solid var(--line2,#5E4A38);border-radius:10px;overflow:hidden}'
  + '.pc-seg{font:inherit;font-size:12px;padding:5px 10px;border:0;background:transparent;color:var(--mut,#D6CBBB);cursor:pointer}'
  + '.pc-head .pc-seg{border:1px solid var(--line2,#5E4A38);border-radius:10px}'
  + '.pc-seg.on{background:var(--or-soft,rgba(196,154,108,.15));color:var(--or,#C49A6C);font-weight:700}'
  + '.pc-sum{display:flex;gap:14px;flex-wrap:wrap;font-size:12.5px;color:var(--mut,#D6CBBB);margin-bottom:6px}'
  + '.pc-sum b{color:var(--tx,#F7F2EA);font-family:Heebo}.pc-sum .pc-up{color:var(--ok,#DDBF8E)}.pc-sum .pc-down{color:var(--cop,#B8901F)}'
  + '.pc-plot{position:relative}'
  + '.pc-svg{display:block;width:100%;height:auto;overflow:visible;font-family:Heebo}'
  + '.pc-grid{stroke:var(--line,#47372A);stroke-width:1}'
  + '.pc-ax{fill:var(--dim,#978774);font-size:11px}'
  + '.pc-trend{stroke:var(--dim,#978774);stroke-width:1.5;stroke-dasharray:5 5}'
  + '.pc-line{fill:none;stroke:var(--or,#C49A6C);stroke-width:2.2;stroke-linejoin:round;stroke-linecap:round}'
  + '.pc-dot{fill:var(--or,#C49A6C);stroke:var(--card,#30231A);stroke-width:2}'
  + '.pc-best{fill:var(--cop,#B8901F)}'
  + '.pc-lab{fill:var(--tx,#F7F2EA);font-size:12px;font-weight:700}'
  + '.pc-lab-best{fill:var(--cop,#B8901F)}'
  + '.pc-hit{fill:transparent;cursor:crosshair}'
  + '.pc-cross{stroke:var(--mut,#D6CBBB);stroke-width:1;opacity:.45;pointer-events:none}'
  + '.pc-tip{position:absolute;top:-6px;display:flex;flex-direction:column;gap:2px;font-size:12px;line-height:1.35;'
  +   'padding:7px 10px;border-radius:9px;background:var(--ink,#1C140E);border:1px solid var(--line2,#5E4A38);'
  +   'box-shadow:0 8px 22px rgba(0,0,0,.4);pointer-events:none;white-space:nowrap;z-index:2}'
  + '.pc-tip[hidden]{display:none}'
  + '.pc-note{font-size:11.5px;color:var(--dim,#978774);margin-top:8px;line-height:1.55}'
  + '.pc-empty{font-size:13px;color:var(--mut,#D6CBBB);line-height:1.6;padding:6px 0}'
  + '.pc-table{width:100%;border-collapse:collapse;font-size:12.5px}'
  + '.pc-table th,.pc-table td{padding:6px 5px;border-bottom:1px solid var(--line,#47372A);text-align:right}'
  + '.pc-table th{color:var(--mut,#D6CBBB);font-weight:500;font-size:11.5px}';
  document.head.appendChild(css);

  window.EBChart = { panel: panel, series: series, e1rm: e1rm, trend: trend };
})();

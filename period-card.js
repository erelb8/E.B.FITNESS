/* =====================================================================
   E.B FIT — סיכום תקופה: תמונה של השינוי של המתאמן
   ---------------------------------------------------------------------
   בסוף תקופת מעקב (planOf) המאמן לוחץ "סיכום תקופה" ומקבל תמונה
   אחת, 1080×1350 — הגודל של פוסט ושל תמונה בוואטסאפ — עם מה שהשתנה
   מתחילת התקופה ועד סופה: משקל, אחוז שומן, היקף מותניים, כמה אימונים,
   כמה הורם בסך הכול, ובאילו תרגילים המתאמן התחזק הכי הרבה.

   הכול נגזר מרשומות אמיתיות: דיווחי אימון (workout_logs, דרך
   EBSync.logsFor), אימונים ביומן, שקילות ומדידות. מה שאין עליו נתון
   לא מופיע בתמונה — אין "0 ק״ג" ואין משבצת ריקה.

   התמונה מצוירת על canvas ולא מצילום של HTML: אין תלות בספרייה
   חיצונית, והתוצאה זהה בכל מכשיר. הטקסט מימין לשמאל, המספרים
   משמאל לימין — אחרת "-4.2" הופך ל-"4.2-".
   ===================================================================== */
(function () {
  'use strict';

  (window.EB_MOD = window.EB_MOD || {})['period'] = 'v252';

  var W = 1080, H = 1350, PAD = 80;
  var C = { bg1: '#2b1d13', bg2: '#140d08', card: 'rgba(255,255,255,.045)', line: 'rgba(196,154,108,.22)',
            tx: '#F7F2EA', mut: '#B8A898', gold: '#C49A6C', amber: '#D8B26A', good: '#DDBF8E' };

  var ST = null;   // { tid, mode, logs, data, url }

  function r1(x) { return Math.round(x * 10) / 10; }
  function d10(x) { return String(x || '').slice(0, 10); }
  function heDate(iso) { var p = String(iso).split('-'); return Number(p[2]) + '.' + Number(p[1]) + '.' + p[0]; }
  function addDaysISO(iso, n) { var d = new Date(iso + 'T00:00'); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function sign(x) { return (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x); }

  /* ---------- טווח ---------- */
  function rangeOf(t, mode) {
    var today = todayISO();
    var p = (typeof planOf === 'function') ? planOf(t) : null;
    if (mode === 'plan' && p) {
      var end = p.endISO < today ? p.endISO : today;
      return { from: p.start, to: end, label: p.months + (p.months === 1 ? ' חודש' : ' חודשים'), plan: true };
    }
    if (mode === 'joined' && t.joined) return { from: d10(t.joined), to: today, label: 'מאז ההצטרפות' };
    return { from: addDaysISO(today, -89), to: today, label: '90 ימים' };
  }

  /* ---------- נתונים ---------- */
  function seriesOf(t, field) {
    var pts = [];
    (t.weighins || []).forEach(function (w) {
      var v = Number(w && w[field]);
      if (w && w.date && v > 0) pts.push({ date: d10(w.date), v: v });
    });
    (S.measures || []).forEach(function (m) {
      var v = Number(m[field]);
      if (m.traineeId === t.id && m.date && v > 0) {
        var i = pts.findIndex(function (x) { return x.date === m.date; });
        if (i > -1) pts[i].v = v; else pts.push({ date: d10(m.date), v: v });   // מדידת המאמן קודמת
      }
    });
    return pts.sort(function (a, b) { return a.date.localeCompare(b.date); });
  }
  /* תחילה: המדידה האחרונה עד 21 יום לפני תחילת התקופה, ואם אין — הראשונה בתוכה */
  function change(pts, R) {
    var before = pts.filter(function (p) { return p.date < R.from && p.date >= addDaysISO(R.from, -21); }).pop();
    var inside = pts.filter(function (p) { return p.date >= R.from && p.date <= R.to; });
    var a = before || inside[0], b = inside[inside.length - 1];
    if (!a || !b || a === b) return null;
    return { a: a.v, b: b.v, d: r1(b.v - a.v), pts: (before ? [before] : []).concat(inside) };
  }
  function topOf(e) {
    var m = Number(e.weight) || 0;
    (e.setLog || []).forEach(function (s) { m = Math.max(m, Number(s.w) || 0); });
    return m;
  }
  function volOf(entries) {
    var v = 0;
    (entries || []).forEach(function (e) {
      var log = e.setLog || [];
      if (log.length) log.forEach(function (s) { if (s.w && s.r) v += s.w * s.r; });
      else if (e.weight && e.reps) v += (Number(e.weight) || 0) * (parseFloat(e.reps) || 0) * (Number(e.sets) || 1);
    });
    return v;
  }

  function compute(t, mode, logs) {
    var R = rangeOf(t, mode);
    var inR = function (d) { d = d10(d); return d >= R.from && d <= R.to; };
    var L = (logs || []).filter(function (l) { return inR(l.date); })
      .sort(function (a, b) { return d10(a.date).localeCompare(d10(b.date)); });
    var sess = (S.sessions || []).filter(function (s) { return s.traineeId === t.id && s.status === 'done' && inR(s.date); }).length;
    var workouts = L.length + sess;
    var weeks = Math.max(1, Math.round(((new Date(R.to) - new Date(R.from)) / 86400000 + 1) / 7));
    var vol = Math.round(L.reduce(function (a, l) { return a + volOf(l.entries); }, 0));

    var first = {}, best = {}, cnt = {};
    L.forEach(function (l) {
      (l.entries || []).forEach(function (e) {
        var n = String(e.ex || e.name || '').trim(), w = topOf(e);
        if (!n || !w) return;
        if (first[n] == null) first[n] = w;
        best[n] = Math.max(best[n] || 0, w);
        cnt[n] = (cnt[n] || 0) + 1;
      });
    });
    var gains = Object.keys(best).filter(function (n) { return cnt[n] >= 2 && best[n] > first[n]; })
      .map(function (n) { return { n: n, a: first[n], b: best[n], pct: Math.round((best[n] - first[n]) / first[n] * 100) }; })
      .sort(function (x, y) { return y.pct - x.pct || (y.b - y.a) - (x.b - x.a); });

    return {
      R: R, name: t.name || '', first: (typeof firstName === 'function' ? firstName(t) : t.name),
      workouts: workouts, perWeek: r1(workouts / weeks), weeks: weeks, vol: vol,
      gains: gains, records: gains.length,
      weight: change(seriesOf(t, 'weight'), R), fat: change(seriesOf(t, 'fat'), R), waist: change(seriesOf(t, 'waist'), R),
      goal: String(t.goal || ''), logsOk: !!logs
    };
  }

  /* ---------- ציור ---------- */
  function font(px, w) { return (w || 700) + ' ' + px + 'px Heebo, Arial, sans-serif'; }
  function txt(ctx, s, x, y, px, col, w, align, dir) {
    ctx.font = font(px, w); ctx.fillStyle = col;
    ctx.direction = dir || 'rtl'; ctx.textAlign = align || 'right';
    ctx.fillText(s, x, y);
  }
  function round(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  /* טקסט שלא נכנס ברוחב — מקטינים עד שנכנס */
  function fit(ctx, s, maxW, px, w) {
    while (px > 18) { ctx.font = font(px, w); if (ctx.measureText(s).width <= maxW) break; px -= 2; }
    return px;
  }

  function draw(D, logo) {
    var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var ctx = cv.getContext('2d');
    var g = ctx.createRadialGradient(W * 0.5, H * 0.32, 60, W * 0.5, H * 0.45, H * 0.85);
    g.addColorStop(0, C.bg1); g.addColorStop(1, C.bg2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    var R = W - PAD, y = PAD;
    // ראש: לוגו ושם המותג
    if (logo) ctx.drawImage(logo, R - 84, y - 6, 84, 84);
    txt(ctx, 'BAUER POWER', R - 104, y + 30, 34, C.gold, 800);
    txt(ctx, 'סיכום תקופה', R - 104, y + 70, 28, C.mut, 500);
    txt(ctx, heDate(D.R.from) + ' – ' + heDate(D.R.to), PAD, y + 30, 28, C.mut, 500, 'left', 'ltr');
    txt(ctx, D.R.label, PAD, y + 70, 28, C.mut, 500, 'left');

    y += 180;
    var nm = D.name;
    txt(ctx, nm, R, y, fit(ctx, nm, W - PAD * 2, 92, 900), C.tx, 900);
    if (D.goal) { y += 52; txt(ctx, D.goal, R, y, 32, C.gold, 600); }

    /* --- המספר הגדול: משקל, ואם אין — אימונים --- */
    y += 46;
    round(ctx, PAD, y, W - PAD * 2, 262, 34); ctx.fillStyle = C.card; ctx.fill();
    ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.stroke();
    if (D.weight) {
      var hg = ctx.createLinearGradient(0, y + 40, 0, y + 230);
      hg.addColorStop(0, '#F3D9A8'); hg.addColorStop(1, '#B07F4E');
      ctx.font = font(170, 900); ctx.fillStyle = hg; ctx.direction = 'ltr'; ctx.textAlign = 'center';
      ctx.fillText(sign(D.weight.d), W / 2 - 50, y + 172);
      txt(ctx, 'ק״ג', W / 2 + ctx.measureText(sign(D.weight.d)).width / 2 - 40, y + 172, 52, C.gold, 800, 'left', 'rtl');
      labeled(ctx, 'משקל', D.weight.a + ' → ' + D.weight.b, W / 2, y + 228, 34);
    } else {
      ctx.font = font(170, 900); ctx.fillStyle = C.gold; ctx.direction = 'ltr'; ctx.textAlign = 'center';
      ctx.fillText(String(D.workouts), W / 2, y + 172);
      txt(ctx, 'אימונים בתקופה', W / 2, y + 228, 36, C.mut, 500, 'center');
    }
    y += 292;

    /* --- משבצות --- */
    var tiles = [];
    if (D.weight) tiles.push([String(D.workouts), 'אימונים', D.perWeek + ' בשבוע בממוצע']);
    /* מספר → מספר נכתב משמאל לימין, אחרת בשורה עברית הוא מתהפך */
    if (D.vol) tiles.push([D.vol.toLocaleString('en-US'), 'ק״ג הורמו בסך הכול', 'משקל × חזרות, כל הסטים']);
    if (D.records) tiles.push([String(D.records), D.records === 1 ? 'תרגיל עם שיא חדש' : 'תרגילים עם שיא חדש', 'מעל המשקל בתחילת התקופה']);
    if (D.fat) tiles.push([sign(D.fat.d) + '%', 'אחוז שומן', D.fat.a + '% → ' + D.fat.b + '%', 1]);
    if (D.waist) tiles.push([sign(D.waist.d) + ' ס״מ', 'היקף מותניים', D.waist.a + ' → ' + D.waist.b + ' ס״מ', 1]);
    if (!D.weight && D.perWeek) tiles.unshift([String(D.perWeek), 'אימונים בשבוע', 'בממוצע, לאורך ' + D.weeks + ' שבועות']);
    tiles = tiles.slice(0, 4);
    var tw = (W - PAD * 2 - 24) / 2, th = 150;
    tiles.forEach(function (tl, i) {
      var x = i % 2 === 0 ? R - tw : PAD, yy = y + Math.floor(i / 2) * (th + 24);
      round(ctx, x, yy, tw, th, 26); ctx.fillStyle = C.card; ctx.fill(); ctx.strokeStyle = C.line; ctx.stroke();
      ctx.font = font(fit(ctx, tl[0], tw - 60, 64, 900), 900); ctx.fillStyle = C.tx; ctx.direction = 'ltr'; ctx.textAlign = 'right';
      ctx.fillText(tl[0], x + tw - 30, yy + 68);
      txt(ctx, tl[1], x + tw - 30, yy + 106, fit(ctx, tl[1], tw - 60, 30, 700), C.gold, 700);
      txt(ctx, tl[2], x + tw - 30, yy + 134, fit(ctx, tl[2], tw - 60, 22, 500), C.mut, 500, 'right', tl[3] ? 'ltr' : 'rtl');
    });
    y += Math.ceil(tiles.length / 2) * (th + 20) + 14;

    /* --- הכי השתפרו --- */
    var gl = D.gains.slice(0, 3);
    if (gl.length && y < H - 200) {
      txt(ctx, 'הכי השתפרו', R, y + 34, 32, C.gold, 800);
      y += 56;
      gl.forEach(function (x) {
        if (y > H - 150) return;
        var right = x.a + ' → ' + x.b + ' ק״ג';   // נכתב משמאל לימין — ראו labeled
        var pctS = '+' + x.pct + '%';
        ctx.font = font(30, 800); var pw = ctx.measureText(pctS).width;
        ctx.font = font(30, 500); var rw = ctx.measureText(right).width;
        var nmMax = W - PAD * 2 - pw - rw - 70;
        txt(ctx, x.n, R, y + 34, fit(ctx, x.n, nmMax, 32, 700), C.tx, 700);
        txt(ctx, pctS, PAD, y + 34, 30, C.good, 800, 'left', 'ltr');
        txt(ctx, right, PAD + pw + 22, y + 34, 30, C.mut, 500, 'left', 'ltr');
        ctx.strokeStyle = C.line; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(PAD, y + 58); ctx.lineTo(R, y + 58); ctx.stroke();
        y += 66;
      });
    }

    /* --- תחתית --- */
    var coach = (S.settings && S.settings.trainer) || '';
    txt(ctx, (coach ? 'המאמן: ' + coach + ' · ' : '') + 'BAUER POWER', W / 2, H - 56, 26, C.mut, 500, 'center');
    return cv;
  }

  /* "משקל  84.8 → 80.2" ממורכז: התווית מימין בעברית, המספרים משמאל לימין */
  function labeled(ctx, label, nums, cx, y, px) {
    ctx.font = font(px, 500); var wn = ctx.measureText(nums).width;
    var wl = ctx.measureText(label).width, gap = 18, left = cx - (wn + gap + wl) / 2;
    txt(ctx, nums, left, y, px, C.mut, 500, 'left', 'ltr');
    txt(ctx, label, left + wn + gap + wl, y, px, C.mut, 500, 'right', 'rtl');
  }

  function loadLogo() {
    return new Promise(function (res) {
      var im = new Image(); im.onload = function () { res(im); }; im.onerror = function () { res(null); };
      im.src = 'brand-assets/eb-fit-icon-512.png?v=' + (window.EB_APP_VER || '');
    });
  }

  /* ---------- חלון ---------- */
  function open(tid, mode) {
    var t = tById(tid); if (!t) return;
    var p = (typeof planOf === 'function') ? planOf(t) : null;
    mode = mode || (p ? 'plan' : (t.joined ? 'joined' : 'last90'));
    var same = ST && ST.tid === tid && ST.logs;
    ST = { tid: tid, mode: mode, logs: same ? ST.logs : null };
    openModal('<div class="mh"><h3>סיכום תקופה · ' + esc(t.name) + '</h3><button class="iconbtn" onclick="closeModal()">✕</button></div>'
      + '<div class="mb" id="pc_body"><div class="muted" style="padding:30px;text-align:center">מכין את התמונה…</div></div>'
      + '<div class="mf" id="pc_foot"><button class="btn ghost" onclick="closeModal()">סגירה</button></div>', true);
    var getLogs = same ? Promise.resolve(ST.logs)
      : (window.EBSync && EBSync.enabled && EBSync.enabled() && EBSync.logsFor) ? EBSync.logsFor(tid, 1000).catch(function () { return null; }) : Promise.resolve(null);
    Promise.all([getLogs, loadLogo(), document.fonts ? document.fonts.load('900 40px Heebo').catch(function () {}) : null])
      .then(function (r) {
        if (!ST || ST.tid !== tid) return;
        ST.logs = r[0];
        ST.data = compute(t, mode, r[0] || []);
        var cv = draw(ST.data, r[1]);
        ST.url = cv.toDataURL('image/png');
        cv.toBlob(function (b) { if (ST) ST.blob = b; }, 'image/png');
        paint(t, p);
      });
  }
  function paint(t, p) {
    var body = document.getElementById('pc_body'), foot = document.getElementById('pc_foot');
    if (!body) return;
    var opt = function (k, l) {
      return '<button class="btn sm ' + (ST.mode === k ? '' : 'ghost') + '" onclick="EBPeriod.open(\'' + t.id + '\',\'' + k + '\')">' + l + '</button>';
    };
    body.innerHTML = '<div class="row" style="gap:6px;flex-wrap:wrap;margin-bottom:10px">'
      + (p ? opt('plan', 'תקופת המעקב') : '') + (t.joined ? opt('joined', 'מאז ההצטרפות') : '') + opt('last90', '90 ימים')
      + '</div>'
      + (!ST.logs ? '<div class="muted" style="font-size:12px;margin-bottom:8px">דיווחי האימון לא נטענו (אין חיבור לשרת), ולכן אין בתמונה אימונים ושיאים מהדף של המתאמן.</div>' : '')
      + (!ST.data.weight && !ST.data.workouts ? '<div class="muted" style="font-size:12px;margin-bottom:8px">אין בתקופה הזאת שקילות ואין אימונים, אז עוד אין מה להראות.</div>' : '')
      + '<img src="' + ST.url + '" alt="" style="width:100%;border-radius:14px;display:block">';
    var canShare = !!(navigator.canShare && window.File);
    foot.innerHTML = (canShare ? '<button class="btn" onclick="EBPeriod.share()">שיתוף</button>' : '')
      + '<button class="btn ' + (canShare ? 'ghost' : '') + '" onclick="EBPeriod.download()">הורדה</button>'
      + '<button class="btn ghost" onclick="closeModal()">סגירה</button>';
  }
  function fileName() {
    var t = tById(ST.tid);
    return 'סיכום-תקופה-' + String((t && t.name) || 'מתאמן').replace(/\s+/g, '-') + '.png';
  }
  function download() {
    if (!ST || !ST.url) return;
    var a = document.createElement('a'); a.href = ST.url; a.download = fileName();
    document.body.appendChild(a); a.click(); a.remove();
  }
  /* בטלפון: נפתח חלון השיתוף של המכשיר, ומשם וואטסאפ עם התמונה מצורפת */
  function share() {
    if (!ST || !ST.blob) { download(); return; }
    var f = new File([ST.blob], fileName(), { type: 'image/png' });
    var t = tById(ST.tid);
    if (navigator.canShare && navigator.canShare({ files: [f] })) {
      navigator.share({ files: [f], text: 'הסיכום שלך מהתקופה האחרונה, ' + ((t && firstName(t)) || '') }).catch(function () {});
    } else download();
  }

  window.EBPeriod = { open: open, download: download, share: share, compute: compute, draw: draw };
})();

/* =====================================================================
   BAUER POWER — כרטיס סיכום אימון לשיתוף
   ---------------------------------------------------------------------
   אחרי אימון (ובכל אימון ביומן) המתאמן יכול לשתף תמונה ממותגת של מה
   שעשה: לווטסאפ, לסטורי, או לשמור לטלפון. כל שיתוף כזה מגיע לאנשים
   שעוד לא מכירים את העסק — בלי שהמאמן עשה משהו.

   בכרטיס יש רק מה שהמתאמן עצמו עשה (שם האימון, תאריך, תרגילים, סטים,
   נפח, שיאים), הלוגו ושם המאמן. אין בו שם המתאמן, משקל גוף או נתון אחר
   — והוא נוצר במכשיר בלבד: שום דבר לא נשלח לשרת.

   הציור על canvas ולא צילום של המסך: התמונה זהה בכל ערכת צבע ובכל טלפון.
   render() מכין מראש קובץ PNG, כדי ש-navigator.share ייקרא מיד בנגיעה
   (ספארי דוחה שיתוף שמגיע אחרי המתנה).
   ===================================================================== */
(function () {
  'use strict';

  (window.EB_MOD = window.EB_MOD || {})['share'] = 'v291';

  var W = 1080, H = 1350, PAD = 76;
  var C = { top: '#35281E', bot: '#211710', card: '#3E3026', line: '#5B4838',
            tx: '#F7F1E9', mut: '#DBCEBE', dim: '#AD9A83', or: '#D6B188', gold: '#EBD6AF' };
  var SERIF = '"Frank Ruhl Libre", Georgia, serif', SANS = 'Heebo, Arial, sans-serif';
  var LOGO = 'icons/icon-512.png?v=v291';
  var NAME = 'bauer-power-workout.png';

  function loadImg(src) {
    return new Promise(function (res) {
      var i = new Image();
      i.onload = function () { res(i); };
      i.onerror = function () { res(null); };
      i.src = src;
    });
  }
  function fontsReady() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    var want = ['900 90px "Frank Ruhl Libre"', '500 40px Heebo', '700 40px Heebo', '800 40px Heebo'];
    var all = Promise.all(want.map(function (f) { return document.fonts.load(f, 'אבג 123').catch(function () {}); }));
    return Promise.race([all, new Promise(function (r) { setTimeout(r, 1800); })]);
  }
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  /* קובע גופן שבו הטקסט נכנס לרוחב; אם גם בגודל המינימלי לא — חותך עם שלוש נקודות */
  function fit(ctx, text, maxW, weight, px, min, family) {
    text = String(text == null ? '' : text);
    for (; px >= min; px -= 2) {
      ctx.font = weight + ' ' + px + 'px ' + family;
      if (ctx.measureText(text).width <= maxW) return text;
    }
    ctx.font = weight + ' ' + min + 'px ' + family;
    var t = text;
    while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
    return t + '…';
  }

  function draw(d, logo) {
    var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var ctx = cv.getContext('2d');
    var g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, C.top); g.addColorStop(1, C.bot);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = C.or; ctx.fillRect(0, 0, W, 10);          // פס הזהב של המותג
    ctx.textBaseline = 'alphabetic';
    try { ctx.direction = 'rtl'; } catch (e) {}

    var isPr = !!(d.prs && d.prs.length);
    var rows = (isPr ? d.prs : (d.lifts || [])).slice(0, 3);
    var L = 250, RH = 84, boxH = rows.length ? 82 + rows.length * RH : 0, SH = 196;
    var FOOT = H - 156;                                       // קו התחתית
    var total = L + 104 + 62 + 66 + SH + (rows.length ? 44 + boxH : 0);
    var y = Math.max(52, Math.round((FOOT - 10 - total) / 2) + 10);

    /* לוגו */
    var lx = (W - L) / 2;
    if (logo) {
      ctx.save(); rr(ctx, lx, y, L, L, 44); ctx.clip(); ctx.drawImage(logo, lx, y, L, L); ctx.restore();
      ctx.strokeStyle = C.line; ctx.lineWidth = 3; rr(ctx, lx, y, L, L, 44); ctx.stroke();
    } else {
      ctx.save(); try { ctx.direction = 'ltr'; } catch (e) {}
      ctx.textAlign = 'center'; ctx.fillStyle = C.or; ctx.font = '800 60px ' + SANS;
      ctx.fillText('BAUER POWER', W / 2, y + L / 2 + 22); ctx.restore();
    }
    y += L + 104;

    /* כותרת ושורת המשנה */
    ctx.textAlign = 'center';
    ctx.fillStyle = isPr ? C.gold : C.tx;
    ctx.fillText(fit(ctx, d.title, W - PAD * 2, 900, 104, 60, SERIF), W / 2, y);
    y += 62;
    ctx.fillStyle = C.mut;
    ctx.fillText(fit(ctx, d.sub, W - PAD * 2, 500, 42, 28, SANS), W / 2, y);
    y += 66;

    /* שלושה מספרים — הראשון מימין */
    var st = (d.stats || []).slice(0, 3), n = st.length || 1, gap = 22, bw = (W - PAD * 2 - gap * (n - 1)) / n;
    st.forEach(function (s, i) {
      var x = W - PAD - bw - i * (bw + gap);
      ctx.fillStyle = C.card; rr(ctx, x, y, bw, SH, 28); ctx.fill();
      ctx.strokeStyle = C.line; ctx.lineWidth = 2; rr(ctx, x, y, bw, SH, 28); ctx.stroke();
      ctx.textAlign = 'center';
      ctx.fillStyle = C.tx; ctx.fillText(fit(ctx, s.v, bw - 36, 900, 88, 46, SERIF), x + bw / 2, y + 108);
      ctx.fillStyle = C.mut; ctx.font = '500 34px ' + SANS; ctx.fillText(String(s.l || ''), x + bw / 2, y + 160);
    });
    y += SH;

    /* שיאים, ואם אין — התרגילים הכבדים של האימון */
    if (rows.length) {
      y += 44;
      ctx.fillStyle = isPr ? 'rgba(214,177,136,.13)' : C.card; rr(ctx, PAD, y, W - PAD * 2, boxH, 28); ctx.fill();
      ctx.strokeStyle = isPr ? C.or : C.line; ctx.lineWidth = 2; rr(ctx, PAD, y, W - PAD * 2, boxH, 28); ctx.stroke();
      ctx.textAlign = 'right'; ctx.fillStyle = C.or; ctx.font = '800 30px ' + SANS;
      ctx.fillText(isPr ? 'שיא חדש' : 'מהאימון', W - PAD - 36, y + 54);
      rows.forEach(function (r, i) {
        var ry = y + 82 + i * RH;
        if (i) { ctx.fillStyle = C.line; ctx.fillRect(PAD + 36, ry - 4, W - PAD * 2 - 72, 1); }
        ctx.textAlign = 'left'; ctx.fillStyle = C.tx; ctx.font = '700 38px ' + SANS;
        var val = String(r.val || ''), vw = ctx.measureText(val).width;
        ctx.fillText(val, PAD + 36, ry + 54);
        ctx.textAlign = 'right'; ctx.fillStyle = C.tx;
        ctx.fillText(fit(ctx, r.name, W - PAD * 2 - 72 - vw - 40, 500, 38, 28, SANS), W - PAD - 36, ry + 54);
      });
    }

    /* תחתית: שם העסק ושם המאמן */
    ctx.fillStyle = C.line; ctx.fillRect(PAD, FOOT, W - PAD * 2, 2);
    ctx.save();
    try { ctx.direction = 'ltr'; ctx.letterSpacing = '10px'; } catch (e) {}
    ctx.textAlign = 'center'; ctx.fillStyle = C.or; ctx.font = '800 36px ' + SANS;
    ctx.fillText('BAUER POWER', W / 2, FOOT + 66);
    ctx.restore();
    ctx.textAlign = 'center'; ctx.fillStyle = C.dim;
    ctx.fillText(fit(ctx, d.foot || 'ליווי אישי', W - PAD * 2, 500, 30, 24, SANS), W / 2, FOOT + 114);
    return cv;
  }

  /* מכין את התמונה: canvas, קובץ לשיתוף, וכתובת לתצוגה ולהורדה */
  function render(d) {
    return Promise.all([loadImg(LOGO), fontsReady()]).then(function (a) {
      var cv = draw(d, a[0]);
      return new Promise(function (res) {
        var done = function (b) {
          var f = null;
          try { if (b && window.File) f = new File([b], NAME, { type: 'image/png' }); } catch (e) {}
          var url = '';
          try { url = b ? URL.createObjectURL(b) : cv.toDataURL('image/png'); } catch (e) {}
          res({ canvas: cv, blob: b || null, file: f, url: url, logo: !!a[0] });
        };
        try { if (cv.toBlob) cv.toBlob(done, 'image/png'); else done(null); } catch (e) { done(null); }
      });
    });
  }
  function canShare(r) {
    try { return !!(r && r.file && navigator.share && navigator.canShare && navigator.canShare({ files: [r.file] })); }
    catch (e) { return false; }
  }
  function save(r) {
    try {
      var a = document.createElement('a'); a.href = r.url; a.download = NAME;
      document.body.appendChild(a); a.click(); a.remove();
      return 'saved';
    } catch (e) { return 'failed'; }
  }
  /* שיתוף דרך חלון השיתוף של הטלפון; דפדפן שלא יודע לשתף קובץ — שומר את התמונה */
  function send(r, text) {
    if (!r) return Promise.resolve('failed');
    if (!canShare(r)) return Promise.resolve(save(r));
    return navigator.share({ files: [r.file], text: text || '' }).then(
      function () { return 'shared'; },
      function (e) { return e && e.name === 'AbortError' ? 'cancelled' : save(r); });
  }
  function wa(text) {
    try { window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank'); return 'wa'; }
    catch (e) { return 'failed'; }
  }
  /* הודעת טקסט (ההמלצה לחבר): חלון השיתוף, ובלעדיו — ווטסאפ */
  function sendText(text) {
    if (!navigator.share) return Promise.resolve(wa(text));
    return navigator.share({ text: text }).then(
      function () { return 'shared'; },
      function (e) { return e && e.name === 'AbortError' ? 'cancelled' : wa(text); });
  }

  window.EBShare = { render: render, send: send, save: save, sendText: sendText, canShare: canShare, W: W, H: H };
})();

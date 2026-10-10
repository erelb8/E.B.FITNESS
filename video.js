/* =====================================================================
   E.B FIT — סרטוני ביצוע לתרגילים
   ---------------------------------------------------------------------
   שתי שכבות:
   • סרטון כללי — לפי שם התרגיל. יושב ב-S.settings.exVideos ומסתנכרן עם
     ההגדרות. כל מתאמן שיש לו תרגיל באותו שם רואה אותו, גם בתוכנית
     שתיבנה מחר. דף המתאמן קורא את הרשימה דרך trainee_videos.
   • סרטון אישי — e.video על התרגיל בתוכנית של מתאמן אחד. גובר על הכללי
     אצלו בלבד (למשל תיקון טכניקה שלו).

   הקבצים בדלי "videos" (supabase/videos.sql), תחת <מזהה מאמן>/...
   הדלי ציבורי: הקישור מנגן בלי התחברות, וההגנה היא נתיב אקראי — אותו
   עיקרון כמו קבצי התוכנית.

   התוכנית החינמית של Supabase: 1GB אחסון ו-50MB לקובץ. לכן המגבלה כאן
   50MB, והכרטיס בהגדרות מראה כמה תפוס.
   ===================================================================== */
(function () {
  'use strict';

  (window.EB_MOD = window.EB_MOD || {})['video'] = 'v240';

  var BUCKET = 'videos';
  var MAX    = 50 * 1024 * 1024;
  var QUOTA  = 1024 * 1024 * 1024;
  var EXT    = { mp4: 'video/mp4', mov: 'video/quicktime', m4v: 'video/x-m4v',
                 webm: 'video/webm', '3gp': 'video/3gpp' };

  function key(n) { return String(n || '').replace(/\s+/g, ' ').trim(); }
  function map() {
    S.settings = S.settings || {};
    return (S.settings.exVideos = S.settings.exVideos || {});
  }
  function rand() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  }
  function mb(b) { return (b / 1024 / 1024).toFixed(b < 10485760 ? 1 : 0) + 'MB'; }
  function tOf(id) { return (S.trainees || []).find(function (x) { return x.id === id; }); }
  function exercisesNamed(t, name) {
    var out = [], k = key(name);
    ((t && t.program && t.program.days) || []).forEach(function (d) {
      (d.exercises || []).forEach(function (e) { if (key(e.name) === k) out.push(e); });
    });
    return out;
  }

  /* מה המתאמן הזה רואה בתרגיל הזה: אישי קודם, אחר כך כללי */
  function resolve(e, m) {
    if (e && e.video && e.video.url) return { url: e.video.url, own: true };
    var g = (m || {})[key(e && e.name)];
    return g && g.url ? { url: g.url, own: false } : null;
  }

  /* כל הקבצים שבשימוש — כדי לא למחוק קובץ שעוד מוצג במקום אחר,
     ולחשב כמה מהמכסה תפוס */
  function usage() {
    var paths = {}, bytes = 0;
    Object.keys(map()).forEach(function (k) {
      var v = map()[k];
      if (v && v.path && !paths[v.path]) { paths[v.path] = 1; bytes += v.size || 0; }
    });
    (S.trainees || []).forEach(function (t) {
      ((t.program && t.program.days) || []).forEach(function (d) {
        (d.exercises || []).forEach(function (e) {
          var v = e.video;
          if (v && v.path && !paths[v.path]) { paths[v.path] = 1; bytes += v.size || 0; }
        });
      });
    });
    return { paths: paths, bytes: bytes };
  }
  async function dropFile(path) {
    if (!path || usage().paths[path]) return;   // עוד בשימוש
    try { await EBSync.client().storage.from(BUCKET).remove([path]); } catch (e) {}
  }

  /* ---------- העלאה ---------- */
  function chooseFile() {
    return new Promise(function (res) {
      var inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = 'video/*';
      inp.onchange = function () { res((inp.files || [])[0] || null); };
      inp.click();
    });
  }
  async function upload(file, folder) {
    if (!window.EBSync || !EBSync.user()) { toast('צריך להתחבר כדי להעלות סרטונים'); return null; }
    if (!navigator.onLine) { toast('צריך חיבור לאינטרנט להעלאה'); return null; }
    var ext = (file.name.split('.').pop() || '').toLowerCase();
    var type = EXT[ext] || (/^video\//.test(file.type) ? file.type : '');
    if (!type) { toast('זה לא קובץ וידאו. אפשר MP4, MOV או WEBM'); return null; }
    if (file.size > MAX) {
      toast('הסרטון ' + mb(file.size) + ' — המקסימום 50MB. צלם קצר יותר (10–20 שניות) או באיכות 720p');
      return null;
    }
    if (usage().bytes + file.size > QUOTA) {
      toast('אין מספיק מקום באחסון החינמי (1GB). מחק סרטונים ישנים בהגדרות');
      return null;
    }
    var path = EBSync.user().id + '/' + folder + '/' + rand() + '.' + (ext || 'mp4');
    toast('מעלה סרטון (' + mb(file.size) + ')…');
    var sb = EBSync.client();
    var up = await sb.storage.from(BUCKET).upload(path, file, {
      cacheControl: '31536000', upsert: false, contentType: type
    });
    if (up.error) {
      var m = String(up.error.message || up.error);
      if (/bucket not found/i.test(m)) m = 'עוד לא הוגדר אחסון לסרטונים — צריך להריץ את supabase/videos.sql';
      else if (/size|large|exceeded/i.test(m)) m = 'הסרטון גדול מדי (מקסימום 50MB)';
      else if (/mime|content.?type/i.test(m)) m = 'סוג הקובץ נחסם בשרת';
      else if (/policy|security|403|unauthorized/i.test(m)) m = 'אין הרשאה להעלות — צריך להריץ את supabase/videos.sql';
      console.error('[EBVideo] upload failed:', up.error);
      toast('ההעלאה נכשלה: ' + m);
      return null;
    }
    return { url: sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl,
             path: path, size: file.size, at: todayISO() };
  }

  async function setGeneral(name) {
    var k = key(name); if (!k) { toast('לתרגיל אין שם'); return; }
    var f = await chooseFile(); if (!f) return;
    var v = await upload(f, 'all'); if (!v) return;
    var old = map()[k];
    map()[k] = v;
    save();
    if (old && old.path) await dropFile(old.path);
    toast('הסרטון נשמר — כל מי שיש לו "' + k + '" יראה אותו');
    refresh();
  }
  async function setOwn(tid, name) {
    var t = tOf(tid), list = exercisesNamed(t, name);
    if (!list.length) return;
    var f = await chooseFile(); if (!f) return;
    var v = await upload(f, tid); if (!v) return;
    var olds = list.map(function (e) { return e.video && e.video.path; }).filter(Boolean);
    list.forEach(function (e) { e.video = v; });
    save();
    for (var i = 0; i < olds.length; i++) await dropFile(olds[i]);
    toast('סרטון אישי נשמר ל' + (t.name || 'מתאמן'));
    refresh();
  }
  async function clearGeneral(name) {
    var k = key(name), old = map()[k];
    if (!old || !confirm('למחוק את הסרטון הכללי של "' + k + '"? הוא ייעלם אצל כל המתאמנים.')) return;
    delete map()[k];
    save();
    await dropFile(old.path);
    toast('הסרטון נמחק');
    refresh();
  }
  async function clearOwn(tid, name) {
    var t = tOf(tid), list = exercisesNamed(t, name);
    var olds = list.map(function (e) { return e.video && e.video.path; }).filter(Boolean);
    if (!olds.length || !confirm('למחוק את הסרטון האישי? ' + (t.name || 'המתאמן') + ' יראה שוב את הכללי, אם יש.')) return;
    list.forEach(function (e) { delete e.video; });
    save();
    for (var i = 0; i < olds.length; i++) await dropFile(olds[i]);
    toast('הסרטון האישי נמחק');
    refresh();
  }

  /* ---------- חלון לתרגיל אחד ---------- */
  var CUR = null;   // { tid, name }
  function player(url) {
    return '<video src="' + esc(url) + '" controls playsinline preload="metadata" '
      + 'style="width:100%;max-height:46vh;border-radius:10px;background:#000;margin:6px 0 8px"></video>';
  }
  function body() {
    var t = tOf(CUR.tid), k = key(CUR.name), g = map()[k];
    var own = exercisesNamed(t, k).map(function (e) { return e.video; }).filter(Boolean)[0];
    var h = '<div class="muted" style="font-size:12.5px;margin-bottom:12px">סרטון קצר, 10–20 שניות, עד 50MB. '
      + 'המתאמן רואה כפתור "▶ צפייה בביצוע" מתחת לתרגיל.</div>';
    h += '<div class="card" style="padding:12px;margin-bottom:10px"><div style="font-weight:700;font-size:14px">סרטון כללי</div>'
      + '<div class="muted" style="font-size:12px">כל מתאמן שיש לו "' + esc(k) + '" רואה אותו</div>'
      + (g ? player(g.url) : '<div class="muted" style="font-size:13px;margin:8px 0">אין עדיין.</div>')
      + '<div class="row" style="gap:6px"><button class="btn sm" onclick="EBVideo.setGeneral(EBVideo.cur())">'
      + (g ? 'החלפה' : 'העלאת סרטון') + '</button>'
      + (g ? '<button class="btn sm ghost" onclick="EBVideo.clearGeneral(EBVideo.cur())">מחיקה</button>' : '')
      + '</div></div>';
    if (t) {
      h += '<div class="card" style="padding:12px"><div style="font-weight:700;font-size:14px">סרטון אישי ל' + esc(t.name || 'מתאמן') + '</div>'
        + '<div class="muted" style="font-size:12px">מחליף את הכללי אצלו בלבד — למשל תיקון טכניקה</div>'
        + (own ? player(own.url) : '<div class="muted" style="font-size:13px;margin:8px 0">אין. ' + (g ? 'הוא רואה את הכללי.' : '') + '</div>')
        + '<div class="row" style="gap:6px"><button class="btn sm ghost" onclick="EBVideo.setOwn(\'' + esc(t.id) + '\',EBVideo.cur())">'
        + (own ? 'החלפה' : 'העלאת סרטון אישי') + '</button>'
        + (own ? '<button class="btn sm ghost" onclick="EBVideo.clearOwn(\'' + esc(t.id) + '\',EBVideo.cur())">מחיקה</button>' : '')
        + '</div></div>';
    }
    if (window.EBAnim && EBAnim.has(k)) {
      h += '<div class="card" style="padding:12px;margin-top:10px;display:flex;gap:12px;align-items:center">'
        + '<canvas data-anim="' + esc(k) + '" style="width:120px;height:120px;flex:none;border-radius:10px;background:#1C150F"></canvas>'
        + '<div style="font-size:12.5px;line-height:1.6"><b>הדמיה אוטומטית</b><br><span class="muted">'
        + (g || own ? 'מוצגת רק למתאמנים שאין להם סרטון.' : 'זה מה שהמתאמן רואה עכשיו, כל עוד אין סרטון.') + '</span></div></div>';
    }
    return h;
  }
  function open(tid, di, ei) {
    var t = tOf(tid);
    var e = t && t.program && t.program.days[di] && t.program.days[di].exercises[ei];
    if (!e || !key(e.name)) { toast('קודם כותבים שם לתרגיל'); return; }
    CUR = { tid: tid, name: key(e.name) };
    openModal('<div class="mh"><h3>🎥 ' + esc(CUR.name) + '</h3><button class="iconbtn" onclick="closeModal()">✕</button></div>'
      + '<div class="mb" id="vidBody">' + body() + '</div>'
      + '<div class="mf"><button class="btn" onclick="closeModal()">סגירה</button></div>');
    if (window.EBAnim) EBAnim.mountAll(document.getElementById('vidBody'));
  }
  function refresh() {
    var b = document.getElementById('vidBody');
    if (b && CUR) { b.innerHTML = body(); if (window.EBAnim) EBAnim.mountAll(b); }
    if (typeof render === 'function' && !b) render();
  }

  /* ---------- כפתור בשורת התרגיל ---------- */
  function btn(t, di, ei, e) {
    var r = resolve(e, map());
    return '<button class="iconbtn noprint" title="' + (r ? (r.own ? 'סרטון אישי' : 'סרטון כללי') : 'הוספת סרטון ביצוע') + '"'
      + ' style="width:28px;height:28px;font-size:13px' + (r ? ';border-color:var(--or);color:var(--or)' : ';opacity:.55') + '"'
      + ' onclick="EBVideo.open(\'' + esc(t.id) + '\',' + di + ',' + ei + ')">🎥</button>';
  }

  /* ---------- כרטיס בהגדרות: כל הסרטונים הכלליים ---------- */
  function card() {
    var m = map(), names = Object.keys(m).sort(), u = usage();
    var pct = Math.min(100, Math.round(u.bytes / QUOTA * 100));
    var own = Object.keys(u.paths).length - names.length;
    var h = '<div class="card" style="margin-top:14px"><div class="row" style="margin-bottom:8px">'
      + '<h3 style="flex:1;font-size:15px">🎥 סרטוני ביצוע</h3>'
      + '<span class="muted" style="font-size:12px">' + mb(u.bytes) + ' מתוך 1GB · ' + pct + '%</span></div>'
      + '<div style="height:5px;border-radius:9px;background:var(--line);overflow:hidden;margin-bottom:10px">'
      + '<div style="height:100%;width:' + pct + '%;background:' + (pct > 85 ? 'var(--bad)' : 'var(--or)') + '"></div></div>'
      + '<div class="muted" style="font-size:12.5px;margin-bottom:10px">מעלים מכפתור 🎥 ליד כל תרגיל בתוכנית, או כאן לפי שם התרגיל.'
      + (own > 0 ? ' יש גם ' + own + ' סרטונים אישיים בתוכניות.' : '') + '</div>'
      + '<div class="row" style="gap:6px;margin-bottom:10px">'
      + '<input class="f" id="vid_name" list="vid_names" placeholder="שם התרגיל, בדיוק כמו בתוכנית" style="flex:1;min-width:0">'
      + '<button class="btn sm" onclick="EBVideo.setGeneral(document.getElementById(\'vid_name\').value)">העלאה</button></div>'
      + '<datalist id="vid_names">' + namesInUse().map(function (n) { return '<option value="' + esc(n) + '">'; }).join('') + '</datalist>';
    if (!names.length) h += '<div class="muted" style="font-size:13px">אין עדיין סרטונים.</div>';
    names.forEach(function (n) {
      var v = m[n];
      h += '<div class="line-item" style="gap:8px"><span style="flex:1;min-width:0;font-size:13.5px">' + esc(n) + '</span>'
        + '<span class="muted" style="font-size:12px">' + (v.size ? mb(v.size) : '') + '</span>'
        + '<a class="btn sm ghost" href="' + esc(v.url) + '" target="_blank" rel="noopener">צפייה</a>'
        + '<button class="btn sm ghost" onclick="EBVideo.clearGeneral(this.dataset.n)" data-n="' + esc(n) + '">מחיקה</button></div>';
    });
    return h + '</div>';
  }
  /* שמות התרגילים שכבר יש בתוכניות — כדי שהשם שמקלידים יתאים בדיוק */
  function namesInUse() {
    var s = {};
    (S.trainees || []).forEach(function (t) {
      ((t.program && t.program.days) || []).forEach(function (d) {
        (d.exercises || []).forEach(function (e) { var k = key(e.name); if (k) s[k] = 1; });
      });
    });
    return Object.keys(s).sort();
  }

  window.EBVideo = {
    open: open, btn: btn, card: card, resolve: resolve, key: key,
    setGeneral: setGeneral, setOwn: setOwn, clearGeneral: clearGeneral, clearOwn: clearOwn,
    cur: function () { return CUR && CUR.name; }
  };
})();

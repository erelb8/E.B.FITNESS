/* =====================================================================
   E.B FIT — קבצי תוכנית
   ---------------------------------------------------------------------
   העלאת קובץ תוכנית מוכן (PDF, תמונה, Word, Excel) וצירופו למתאמן.
   המתאמן פותח אותו מהקישור האישי שלו, ישירות בטלפון.

   הקבצים יושבים ב-Supabase Storage תחת נתיב
       <trainer_id>/<trainee_id>/<אקראי>-<שם>
   הקריאה פתוחה, וההגנה היא שהנתיב אינו ניתן לניחוש — אותו עיקרון
   כמו הטוקן של המתאמן. לכן: תוכניות אימון כן, מסמכים רפואיים לא.
   ===================================================================== */
(function () {
  'use strict';

  // חותמת גרסה — index.html משווה אליה כדי לזהות קובץ ישן במטמון
  (window.EB_MOD = window.EB_MOD || {})['files'] = 'v40';

  var BUCKET = 'programs';
  var MAX    = 10 * 1024 * 1024;   // 10MB, תואם למגבלת הדלי

  var OK_EXT = ['pdf','png','jpg','jpeg','webp','heic','docx','xlsx','txt','html','htm'];

  /* הדפדפן לא תמיד יודע לזהות סוג קובץ — במיוחד docx/xlsx/heic, ובקבצים
     שהגיעו מווטסאפ או מ-Drive. במקרה כזה הוא מדווח סוג ריק, Supabase
     מקבל application/octet-stream, והדלי דוחה. לכן גוזרים מהסיומת. */
  var MIME = {
    pdf : 'application/pdf',
    png : 'image/png',
    jpg : 'image/jpeg',  jpeg: 'image/jpeg',
    webp: 'image/webp',  heic: 'image/heic',
    txt : 'text/plain',
    html: 'text/html',  htm : 'text/html',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  };
  function mimeOf(file, ext) {
    var t = file.type || '';
    // סומכים על הדפדפן רק אם מה שדיווח תואם למה שהסיומת אומרת
    return (t && t === MIME[ext]) ? t : (MIME[ext] || t || 'application/octet-stream');
  }

  function icon(name) {
    var e = (name.split('.').pop() || '').toLowerCase();
    if (e === 'pdf') return '📄';
    if (['png','jpg','jpeg','webp','heic'].indexOf(e) > -1) return '🖼';
    if (e === 'xlsx') return '📊';
    if (e === 'docx') return '📝';
    if (e === 'html' || e === 'htm') return '🌐';
    return '📎';
  }
  function human(b) {
    if (!b) return '';
    return b < 1024 * 1024 ? Math.round(b / 1024) + ' KB'
                           : (b / 1024 / 1024).toFixed(1) + ' MB';
  }
  // שם בטוח לנתיב: בלי רווחים ותווים שעלולים לשבור URL
  function safeName(n) {
    return String(n).replace(/[^\w.\-]+/g, '_').slice(-60);
  }
  function rand() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  }

  /* ---------- העלאה ---------- */
  async function pick(traineeId) {
    if (!window.EBSync || !EBSync.user()) { toast('צריך להתחבר כדי להעלות קבצים'); return; }
    var inp = document.createElement('input');
    inp.type = 'file';
    inp.multiple = true;
    inp.accept = '.pdf,.png,.jpg,.jpeg,.webp,.heic,.docx,.xlsx,.txt,.html,.htm';
    inp.onchange = function () {
      var list = Array.prototype.slice.call(inp.files || []);
      if (list.length) uploadMany(traineeId, list);
    };
    inp.click();
  }

  async function upload(traineeId, file) {
    var t = tById(traineeId); if (!t) return;
    var ext = (file.name.split('.').pop() || '').toLowerCase();

    if (OK_EXT.indexOf(ext) < 0) {
      toast('"' + (ext || '?') + '" לא נתמך. אפשר: ' + OK_EXT.join(', '));
      return;
    }
    if (file.size > MAX) { toast('הקובץ גדול מ-10MB'); return; }
    if (!navigator.onLine) { toast('צריך חיבור לאינטרנט להעלאה'); return; }

    var sb = EBSync.client(), uid_ = EBSync.user().id;
    var path = uid_ + '/' + traineeId + '/' + rand() + '-' + safeName(file.name);

    toast('מעלה…');
    try {
      var up = await sb.storage.from(BUCKET).upload(path, file, {
        cacheControl: '3600', upsert: false, contentType: mimeOf(file, ext)
      });
      if (up.error) throw up.error;

      var url = sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

      t.files = t.files || [];
      t.files.push({
        id: rand(), name: file.name, path: path, url: url,
        size: file.size, type: file.type || ext, at: todayISO()
      });
      save(); render();
      toast('הקובץ נוסף');
    } catch (e) {
      var m = (e && e.message) || String(e || '');
      if (/row-level security|violates|policy|Unauthorized|403/i.test(m))
        m = 'אין הרשאה לאחסון — צריך להריץ את storage.sql ב-Supabase';
      else if (/bucket not found|Bucket/i.test(m))
        m = 'דלי האחסון לא קיים — צריך להריץ את storage.sql';
      else if (/mime|content.?type/i.test(m))
        m = 'סוג הקובץ נחסם בשרת';
      else if (/size|large|exceeded/i.test(m))
        m = 'הקובץ גדול מדי (מקסימום 10MB)';
      else if (/already exists|duplicate/i.test(m))
        m = 'קובץ בשם הזה כבר קיים — נסה שוב';
      else if (/fetch|network/i.test(m))
        m = 'אין חיבור לשרת';
      console.error('[EBFiles] upload failed:', e);   // הפירוט המלא לקונסול
      toast('ההעלאה נכשלה: ' + (m || 'שגיאה לא ידועה'));
    }
  }

  /* ---------- מחיקה ---------- */
  async function remove(traineeId, fileId) {
    var t = tById(traineeId); if (!t || !t.files) return;
    var f = t.files.find(function (x) { return x.id === fileId; });
    if (!f) return;
    if (!confirm('למחוק את "' + f.name + '"? המתאמן לא יוכל לפתוח אותו יותר.')) return;

    try {
      var sb = EBSync.client();
      if (sb) await sb.storage.from(BUCKET).remove([f.path]);
    } catch (e) { /* גם אם המחיקה באחסון נכשלה, מסירים מהרשימה */ }

    t.files = t.files.filter(function (x) { return x.id !== fileId; });
    save(); render();
    toast('הקובץ נמחק');
  }

  /* ---------- כרטיס הקבצים בתיק המתאמן ---------- */
  function card(t) {
    var on = window.EBSync && EBSync.enabled() && EBSync.user();
    var files = t.files || [];

    var h = '<div class="card" style="margin-top:14px">'
      + '<div class="row" style="margin-bottom:8px">'
      + '<h3 style="flex:1;font-size:15px">קבצי תוכנית</h3>'
      + (on ? '<button class="btn sm" onclick="EBFiles.pick(\'' + t.id + '\')">העלאת קובץ</button>' : '')
      + '</div>';

    if (!on) {
      return h + '<p class="muted" style="font-size:13px;margin:0">'
        + 'צריך להתחבר לסנכרון כדי להעלות קבצים.</p></div>';
    }

    if (!files.length) {
      return h
        + '<p class="muted" style="font-size:13px;margin:0 0 10px">'
        + 'אפשר להעלות תוכנית מוכנה כ-PDF, תמונה או מסמך — '
        + esc(t.name) + ' יראה אותה בקישור האישי ויוכל לפתוח בטלפון.</p>'
        + dropHint() + '</div>';
    }

    files.forEach(function (f) {
      h += '<div class="line-item">'
        + '<span style="font-size:17px;width:26px">' + icon(f.name) + '</span>'
        + '<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'
        + esc(f.name) + '</span>'
        + '<span class="muted" style="font-size:12px">' + human(f.size) + '</span>'
        + '<button class="btn sm ghost" onclick="window.open(\'' + esc(f.url) + '\',\'_blank\')">פתיחה</button>'
        + '<button class="iconbtn" style="width:28px;height:28px" title="מחיקה" '
        + 'onclick="EBFiles.remove(\'' + t.id + '\',\'' + f.id + '\')">✕</button>'
        + '</div>';
    });

    h += dropHint()
      + '<div class="muted" style="font-size:12px;margin-top:10px">'
      + 'הקבצים נפתחים דרך קישור אקראי שאי אפשר לנחש. אל תעלה לכאן מסמכים רפואיים.</div>';
    return h + '</div>';
  }

  // רמז ויזואלי — בלעדיו אף אחד לא מנחש שאפשר לגרור
  function dropHint() {
    return '<div style="margin-top:10px;border:1.5px dashed var(--line2);border-radius:11px;'
      + 'padding:14px;text-align:center;color:var(--dim);font-size:13px">'
      + 'אפשר גם לגרור קבצים לכאן מהמחשב</div>';
  }

  /* ---------- גרירה ושחרור ----------
     מאזינים ברמת המסמך ולא על אלמנט מסוים, כי render() בונה מחדש את
     כל ה-DOM בכל שינוי — מאזין שמוצמד לאלמנט היה נעלם איתו.
     היעד נגזר מהמתאמן שפתוח כרגע. */
  var dragDepth = 0;

  function draggingFiles(e) {
    var dt = e.dataTransfer;
    if (!dt) return false;
    if (dt.types) for (var i = 0; i < dt.types.length; i++)
      if (dt.types[i] === 'Files') return true;
    return false;
  }
  // המתאמן שפתוח כרגע, או null אם לא נמצאים בתיק מתאמן
  function target() {
    if (window.VIEW !== 'trainee' || !window.ARG) return null;
    return tById(window.ARG) || null;
  }

  function overlay(on, text) {
    var el = document.getElementById('ebDropOv');
    if (!on) { if (el) el.remove(); return; }
    if (!el) {
      el = document.createElement('div');
      el.id = 'ebDropOv';
      el.style.cssText =
        'position:fixed;inset:0;z-index:200;display:grid;place-items:center;' +
        'background:rgba(12,12,14,.82);backdrop-filter:blur(3px);pointer-events:none;' +
        'font-family:Rubik,sans-serif';
      document.body.appendChild(el);
    }
    el.innerHTML =
      '<div style="border:2px dashed var(--or);border-radius:18px;padding:38px 54px;text-align:center;' +
      'background:rgba(255,107,26,.07)">' +
      '<div style="font-size:38px;margin-bottom:10px">📎</div>' +
      '<div style="font-size:19px;font-weight:700;color:var(--tx)">' + esc(text) + '</div>' +
      '<div style="font-size:13px;color:var(--mut);margin-top:6px;font-family:Heebo,sans-serif">' +
      'PDF, תמונה, Word או Excel — עד 10MB</div></div>';
  }

  function onDragEnter(e) {
    if (!draggingFiles(e)) return;
    armWatchdog();                            // ראשון — לפני כל דבר שעלול לזרוק
    e.preventDefault();
    dragDepth++;
    var t = target();
    overlay(true, t ? 'שחרר כדי לצרף ל' + t.name
                    : 'צריך לפתוח תיק מתאמן כדי לצרף קובץ');
  }
  function onDragOver(e) {
    if (!draggingFiles(e)) return;
    armWatchdog();
    e.preventDefault();                       // בלי זה הדפדפן פותח את הקובץ
    try { e.dataTransfer.dropEffect = target() ? 'copy' : 'none'; } catch (_) {}
  }
  function onDragLeave(e) {
    if (!draggingFiles(e)) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) hide();
  }

  /* ספירת dragenter/dragleave לבדה לא אמינה: גרירה אל מחוץ לחלון,
     ביטול עם Escape, או שחרור מעל לשונית אחרת — כולם משאירים enter
     בלי leave תואם, והאוברליי נתקע על המסך. לכן שומר נוסף:
     אם הפסיקו להגיע אירועי dragover, מסתירים. */
  var wd = null;
  function armWatchdog() {
    clearTimeout(wd);
    wd = setTimeout(hide, 900);
  }
  function hide() {
    clearTimeout(wd);
    dragDepth = 0;
    overlay(false);
  }
  window.addEventListener('dragend', hide);
  window.addEventListener('blur', hide);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') hide(); });
  async function onDrop(e) {
    if (!draggingFiles(e)) return;
    e.preventDefault();
    hide();

    var t = target();
    if (!t) { toast('פתח תיק מתאמן ואז גרור לשם את הקובץ'); return; }
    var list = Array.prototype.slice.call(e.dataTransfer.files || []);
    if (!list.length) return;

    /* קובץ HTML בודד הוא דו-משמעי: הוא יכול להיות תוכנית אימון לייבוא,
       או סתם קובץ לצרף. עד עכשיו הגרירה תמיד צירפה — מי שגרר תוכנית
       קיבל קובץ מצורף בשקט ולא הבין למה התוכנית לא השתנתה. שואלים. */
    if (list.length === 1 && /\.(html?|htm)$/i.test(list[0].name) && window.EBImport) {
      askHtml(t, list[0]);
      return;
    }
    if (!loggedIn()) return;
    await uploadMany(t.id, list);
  }

  /* ההעלאה דורשת שרת; הייבוא לא. עד עכשיו שתיהן נחסמו יחד, וגרירת
     תוכנית בזמן שהסנכרון מנותק נענתה ב"צריך להתחבר" בלי סיבה. */
  function loggedIn() {
    if (window.EBSync && EBSync.user()) return true;
    toast('צריך להתחבר כדי לצרף קבצים');
    return false;
  }

  function askHtml(t, file) {
    var name = esc(file.name);
    openModal(
      '<div class="mh"><h3>מה לעשות עם הקובץ?</h3>'
      + '<button class="iconbtn" onclick="closeModal()">✕</button></div>'
      + '<div class="mb"><div class="muted" style="font-size:13px;line-height:1.6">'
      + '<b style="color:var(--tx)">' + name + '</b><br>'
      + 'קובץ HTML יכול להיות תוכנית אימון לייבוא, או קובץ לצרף לתיק.'
      + '</div></div>'
      + '<div class="mf" style="gap:8px;flex-wrap:wrap">'
      + '<button class="btn" onclick="EBFiles.asProgram()">ייבוא כתוכנית אימון</button>'
      + '<button class="btn ghost" onclick="EBFiles.asAttachment()">צירוף כקובץ</button>'
      + '<div style="flex:1"></div>'
      + '<button class="btn ghost" onclick="closeModal()">ביטול</button></div>');
    PENDING = { t: t, file: file };
  }

  var PENDING = null;

  function asProgram() {
    if (!PENDING) return;
    var f = PENDING.file, tid = PENDING.t.id;
    PENDING = null; closeModal();
    var fr = new FileReader();
    fr.onload  = function () { EBImport.fromText(String(fr.result || ''), f.name, tid); };
    fr.onerror = function () { toast('לא הצלחנו לקרוא את הקובץ'); };
    fr.readAsText(f, 'utf-8');
  }

  async function asAttachment() {
    if (!PENDING) return;
    var f = PENDING.file, tid = PENDING.t.id;
    PENDING = null; closeModal();
    if (!loggedIn()) return;
    await uploadMany(tid, [f]);
  }

  // העלאה סדרתית ולא במקביל — כך שכשל בקובץ אחד לא מפיל את השאר,
  // והדיווח למאמן נשאר ברור
  async function uploadMany(traineeId, list) {
    if (list.length === 1) { await upload(traineeId, list[0]); return; }
    var ok = 0, bad = 0;
    for (var i = 0; i < list.length; i++) {
      toast('מעלה ' + (i + 1) + ' מתוך ' + list.length + '…');
      try { var before = (tById(traineeId).files || []).length;
            await upload(traineeId, list[i]);
            if ((tById(traineeId).files || []).length > before) ok++; else bad++; }
      catch (e) { bad++; }
    }
    toast(bad ? (ok + ' הועלו, ' + bad + ' נכשלו') : (ok + ' קבצים נוספו'));
  }

  document.addEventListener('dragenter', onDragEnter);
  document.addEventListener('dragover',  onDragOver);
  document.addEventListener('dragleave', onDragLeave);
  document.addEventListener('drop',      onDrop);

  window.EBFiles = { asProgram: asProgram, asAttachment: asAttachment,
    pick: pick, remove: remove, card: card, icon: icon, human: human,
    uploadMany: uploadMany
  };
})();

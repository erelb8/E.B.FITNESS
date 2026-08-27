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

  var BUCKET = 'programs';
  var MAX    = 10 * 1024 * 1024;   // 10MB, תואם למגבלת הדלי

  var OK_EXT = ['pdf','png','jpg','jpeg','webp','heic','docx','xlsx','txt'];

  function icon(name) {
    var e = (name.split('.').pop() || '').toLowerCase();
    if (e === 'pdf') return '📄';
    if (['png','jpg','jpeg','webp','heic'].indexOf(e) > -1) return '🖼';
    if (e === 'xlsx') return '📊';
    if (e === 'docx') return '📝';
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
    inp.accept = '.pdf,.png,.jpg,.jpeg,.webp,.heic,.docx,.xlsx,.txt';
    inp.onchange = function () { if (inp.files && inp.files[0]) upload(traineeId, inp.files[0]); };
    inp.click();
  }

  async function upload(traineeId, file) {
    var t = tById(traineeId); if (!t) return;
    var ext = (file.name.split('.').pop() || '').toLowerCase();

    if (OK_EXT.indexOf(ext) < 0) { toast('סוג קובץ לא נתמך'); return; }
    if (file.size > MAX) { toast('הקובץ גדול מ-10MB'); return; }
    if (!navigator.onLine) { toast('צריך חיבור לאינטרנט להעלאה'); return; }

    var sb = EBSync.client(), uid_ = EBSync.user().id;
    var path = uid_ + '/' + traineeId + '/' + rand() + '-' + safeName(file.name);

    toast('מעלה…');
    try {
      var up = await sb.storage.from(BUCKET).upload(path, file, {
        cacheControl: '3600', upsert: false, contentType: file.type || undefined
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
      var m = (e && e.message) || '';
      if (/mime|type/i.test(m))      m = 'סוג הקובץ נחסם בשרת';
      else if (/size|large/i.test(m)) m = 'הקובץ גדול מדי';
      else if (/bucket/i.test(m))     m = 'האחסון לא הוגדר — צריך להריץ את storage.sql';
      toast('ההעלאה נכשלה: ' + (m || 'שגיאה'));
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
      return h + '<p class="muted" style="font-size:13px;margin:0">'
        + 'אין קבצים. אפשר להעלות תוכנית מוכנה כ-PDF, תמונה או מסמך — '
        + esc(t.name) + ' יראה אותה בקישור האישי ויוכל לפתוח בטלפון.</p></div>';
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

    h += '<div class="muted" style="font-size:12px;margin-top:10px">'
      + 'הקבצים נפתחים דרך קישור אקראי שאי אפשר לנחש. אל תעלה לכאן מסמכים רפואיים.</div>';
    return h + '</div>';
  }

  window.EBFiles = { pick: pick, remove: remove, card: card, icon: icon, human: human };
})();

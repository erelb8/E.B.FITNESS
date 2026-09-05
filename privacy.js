/* =====================================================================
   E.B FIT — יידוע, הסכמה וזכויות המתאמן
   ---------------------------------------------------------------------
   המערכת אוספת מידע רפואי: תשובות PAR-Q+, פציעות, רקע רפואי, משקל.
   חוק הגנת הפרטיות מחייב שלושה דברים שלא היו כאן:

   1. הודעת יידוע לפי סעיף 11, *במקום שבו האדם ממלא את הפרטים*.
      קישור למדיניות בתחתית הדף אינו תחליף — הרשות קבעה זאת במפורש.
   2. הסכמה מפורשת ומתועדת לעיבוד מידע רפואי, בתיבה שאינה מסומנת מראש.
   3. דרך מעשית לממש את זכות העיון והמחיקה.

   הטקסטים מרוכזים כאן ולא מפוזרים בקוד, כדי שאפשר יהיה לעדכן נוסח
   במקום אחד. NOTICE_VERSION נשמר יחד עם ההסכמה — בלעדיו אי אפשר לדעת
   על מה בדיוק המתאמן הסכים כשהנוסח ישתנה.
   ===================================================================== */
(function () {
  'use strict';

  (window.EB_MOD = window.EB_MOD || {})['privacy'] = 'v70';

  var NOTICE_VERSION = '2026-09-05';

  /* פרטי בעל המאגר. נקראים מההגדרות אם קיימים, כדי שמאמן אחר
     שישתמש במערכת לא ימסור את הפרטים של אראל. */
  function owner() {
    var s = (typeof S !== 'undefined' && S.settings) ? S.settings : {};
    return {
      name: s.trainer || 'אראל באואר',
      biz: s.business || 'E.B FIT',
      phone: s.phone || '054-268-7313'
    };
  }

  /* חמשת הפרטים שסעיף 11 מחייב, בשפה שאדם מבין */
  function noticeHTML(compact) {
    var o = owner();
    var f = compact ? '11.5px' : '12.5px';
    return '<div style="font-size:' + f + ';line-height:1.65;color:var(--mut);'
      + 'background:var(--ink);border:1px solid var(--line);border-radius:10px;padding:11px 13px">'
      + '<b style="color:var(--tx);display:block;margin-bottom:5px">לפני שאתה ממלא — חשוב שתדע</b>'
      + 'מסירת המידע היא <b>מרצון</b> ואינך חייב בה על פי חוק. בלעדיה לא נוכל לבנות '
      + 'לך תוכנית בטוחה.<br>'
      + 'המידע נאסף על ידי <b>' + esc(o.name) + '</b> (' + esc(o.biz) + ', ' + esc(o.phone) + ') '
      + 'ומשמש <b>אך ורק</b> לבניית תוכנית האימון והתזונה שלך ולמעקב אחריה.<br>'
      + 'המידע נשמר בשרתי Supabase <b>מחוץ לישראל</b>, ואינו מועבר לאף גורם אחר.<br>'
      + 'בכל רגע אתה רשאי <b>לעיין</b> במידע, <b>לתקן</b> אותו או <b>לבקש שיימחק</b> — '
      + 'פנה ל' + esc(o.name) + ' בטלפון ' + esc(o.phone) + '.'
      + '</div>';
  }

  /* תיבת ההסכמה. אינה מסומנת מראש — הסכמה מראש אינה הסכמה. */
  function consentHTML(id) {
    return '<label style="display:flex;gap:9px;align-items:flex-start;cursor:pointer;'
      + 'font-size:12.5px;line-height:1.55;margin-top:12px">'
      + '<input type="checkbox" id="' + id + '" style="margin-top:2px;flex:none;width:17px;height:17px">'
      + '<span>אני מסכים שהמידע הרפואי שמסרתי — ובכלל זה תשובותיי על שאלות הבריאות — '
      + 'ייאסף ויישמר לצורך בניית תוכנית אימון ותזונה בטוחה עבורי, '
      + 'ומאשר שקראתי את המידע שלמעלה.</span></label>';
  }

  /* מה נשמר יחד עם ההסכמה. בלי הנוסח והגרסה אי אפשר להוכיח
     על מה בדיוק ניתנה ההסכמה אחרי שהנוסח ישתנה. */
  function consentRecord() {
    return {
      at: new Date().toISOString(),
      version: NOTICE_VERSION,
      text: 'אני מסכים שהמידע הרפואי שמסרתי ייאסף ויישמר לצורך בניית תוכנית '
          + 'אימון ותזונה בטוחה עבורי.',
      controller: owner().name,
      storedOutsideIsrael: true
    };
  }

  /* ---------- זכות העיון: כל מה שיש על מתאמן, בקובץ אחד ---------- */
  function exportTrainee(id) {
    var t = (typeof S !== 'undefined' ? S.trainees : []).find(function (x) { return x.id === id; });
    if (!t) return null;
    var pick = function (arr) {
      return (arr || []).filter(function (r) { return r.traineeId === id; });
    };
    return {
      נוצר: new Date().toISOString(),
      הערה: 'כל המידע השמור על ' + t.name + ' במערכת E.B FIT.',
      פרטים: {
        שם: t.name, טלפון: t.phone || '', גובה: t.height || '',
        תאריך_לידה: t.birth || '', מטרה: t.goal || '',
        הצטרף: t.joined || '', סטטוס: t.status || ''
      },
      שאלון_קליטה: t.intake || null,
      הצהרת_בריאות: t.health || null,
      תוכנית_אימון: t.program || null,
      תפריט: t.meals || [],
      שהוסיף_בעצמו: { ארוחות: t.mealsSelf || [], תרגילים: t.exercisesSelf || [] },
      שקילות_שהזין: t.weighins || [],
      מדידות: pick(typeof S !== 'undefined' ? S.measures : []),
      אימונים: pick(typeof S !== 'undefined' ? S.sessions : []),
      תשלומים: pick(typeof S !== 'undefined' ? S.payments : []),
      שיאים: pick(typeof S !== 'undefined' ? S.prs : []),
      מעקב_יומי: pick(typeof S !== 'undefined' ? S.daily : [])
    };
  }

  function download(id) {
    var data = exportTrainee(id);
    if (!data) return;
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'המידע-של-' + data.פרטים.שם.replace(/\s+/g, '-') + '.json';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    if (typeof toast === 'function') toast('הקובץ הורד');
  }

  /* ---------- הבלוק בתיק המתאמן ---------- */
  function block(t) {
    var c = t.health && t.health.consent;
    return '<div class="card">'
      + '<div class="row" style="margin-bottom:8px"><h3 style="flex:1;font-size:15px">פרטיות וזכויות</h3></div>'
      + '<div class="line-item"><span class="muted" style="width:130px;font-size:13px">הסכמה מתועדת</span>'
      + '<span style="flex:1;font-size:13.5px">'
      + (c ? 'נמסרה ' + esc(String(c.at).slice(0, 10).split('-').reverse().join('.'))
             + ' <span class="muted">(נוסח ' + esc(c.version) + ')</span>'
           : '<b style="color:#D9605A">חסרה</b> — המתאמן טרם אישר את היידוע')
      + '</span></div>'
      + '<div class="line-item"><span class="muted" style="width:130px;font-size:13px">מיקום הנתונים</span>'
      + '<span style="flex:1;font-size:13.5px">שרתי Supabase, מחוץ לישראל</span></div>'
      + '<div class="row" style="margin-top:12px;gap:8px">'
      + '<button class="btn sm" onclick="EBPrivacy.download(\'' + t.id + '\')">הורדת כל המידע שלו</button>'
      + '</div>'
      + '<div class="muted" style="font-size:11.5px;margin-top:10px;line-height:1.6">'
      + 'הקובץ נועד למימוש זכות העיון. אם המתאמן ביקש שהמידע יימחק — '
      + 'יש לארכב אותו כאן ולמחוק את הרשומה בסופאבייס, ולתעד את הבקשה ואת מועד הטיפול.'
      + '</div></div>';
  }

  window.EBPrivacy = {
    VERSION: NOTICE_VERSION,
    noticeHTML: noticeHTML,
    consentHTML: consentHTML,
    consentRecord: consentRecord,
    exportTrainee: exportTrainee,
    download: download,
    block: block,
    owner: owner
  };
})();

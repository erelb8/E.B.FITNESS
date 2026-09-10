/* =====================================================================
   E.B FIT — מצב הגישה של המתאמנים
   ---------------------------------------------------------------------
   "המתאמנים לא מצליחים להיכנס" הוא דיווח שאי אפשר לפעול לפיו.
   המסך הזה הופך אותו לרשימה: מי יכול להיכנס, מי לא, ולמה בדיוק.

   שלוש דרכי כניסה, וכל אחת נכשלת אחרת:
     קישור אישי  — צריך טוקן, וצריך ש-access_active יהיה דלוק
     שם משתמש    — צריך ששם המשתמש והסיסמה הוגדרו
     אף אחת      — המתאמן פשוט לא הוגדר, וזה הרוב במקרים כאלה

   הבדיקה נעשית על הנתונים שכבר סונכרנו, ולכן היא מיידית ואינה
   דורשת רשת.
   ===================================================================== */
(function () {
  'use strict';

  (window.EB_MOD = window.EB_MOD || {})['access'] = 'v95';

  /* מצב הגישה של מתאמן אחד */
  function check(t) {
    var hasToken = !!t._token;
    var active   = t._tokenActive !== false;          // ברירת המחדל בשרת היא דלוק
    var hasUser  = !!String(t._username || '').trim();
    var archived = t.status === 'archived';

    var ways = [];
    if (hasToken && active && !archived) ways.push('קישור');
    if (hasUser && !archived) ways.push('שם משתמש');

    var why = null, fix = null;

    if (archived) {
      why = 'המתאמן בארכיון'; fix = 'להחזיר אותו לפעיל בכרטיס שלו';
    } else if (!hasToken) {
      why = 'לא סונכרן לשרת — אין לו קישור בכלל';
      fix = 'להתחבר לסנכרון ולהמתין שהסנכרון יסתיים';
    } else if (!active) {
      why = 'הגישה שלו בוטלה';
      fix = 'להפעיל מחדש בכרטיס המתאמן';
    } else if (!hasUser) {
      why = null;   // הקישור עובד, פשוט אין לו שם משתמש
      fix = 'אפשר להפעיל כניסה בשם משתמש אם הוא מעדיף';
    }

    return {
      ok: ways.length > 0,
      ways: ways,
      why: why,
      fix: fix,
      hasToken: hasToken, active: active, hasUser: hasUser, archived: archived,
      link: (hasToken && window.EBSync && EBSync.traineeLink) ? EBSync.traineeLink(t) : null
    };
  }

  function blocked() {
    try {
      return (typeof activeTrainees === 'function' ? activeTrainees() : [])
        .filter(function (t) { return !check(t).ok; }).length;
    } catch (e) { return 0; }
  }

  /* ---------- המסך ---------- */
  function view() {
    var list = (typeof S !== 'undefined' ? S.trainees : []) || [];
    if (!list.length) {
      return head('גישת מתאמנים', 'מי יכול להיכנס לתוכנית שלו, ומי לא', '')
           + '<div class="empty">אין מתאמנים.</div>';
    }

    var rows = list.map(function (t) { return { t: t, c: check(t) }; });
    rows.sort(function (a, b) {
      if (a.c.ok !== b.c.ok) return a.c.ok ? 1 : -1;
      return String(a.t.name).localeCompare(String(b.t.name), 'he');
    });

    var bad = rows.filter(function (r) { return !r.c.ok; });
    var noUser = rows.filter(function (r) { return r.c.ok && !r.c.hasUser; });

    var h = head('גישת מתאמנים', 'מי יכול להיכנס לתוכנית שלו, ומי לא', '');

    h += '<div class="grid stats-auto" style="margin-bottom:14px">'
      + stat('יכולים להיכנס', rows.length - bad.length, 'מתוך ' + rows.length)
      + stat('חסומים', bad.length, bad.length ? 'צריך טיפול' : '')
      + stat('בלי שם משתמש', noUser.length, noUser.length ? 'קישור בלבד' : '')
      + '</div>';

    if (bad.length) {
      h += '<div class="card" style="border-color:#C0392B55;background:#C0392B0D">'
        + '<h3 style="font-size:15px;margin-bottom:8px;color:#C0392B">'
        + bad.length + ' מתאמנים לא יכולים להיכנס</h3>'
        + '<div style="font-size:13.5px;line-height:1.9">'
        + bad.map(function (r) {
            return '<div><b>' + esc(r.t.name) + '</b> — ' + esc(r.c.why || '')
                 + (r.c.fix ? ' <span class="muted">(' + esc(r.c.fix) + ')</span>' : '') + '</div>';
          }).join('')
        + '</div></div>';
    }

    h += '<div class="card" style="padding-inline:0"><div style="overflow-x:auto;padding-inline:14px">'
      + '<table class="tbl"><thead><tr><th>מתאמן</th><th>איך נכנס</th><th>שם משתמש</th>'
      + '<th>מצב</th><th></th></tr></thead><tbody>';

    rows.forEach(function (r) {
      var c = r.c;
      h += '<tr>'
        + '<td><b>' + esc(r.t.name) + '</b></td>'
        + '<td style="font-size:12.5px">' + (c.ways.length ? esc(c.ways.join(' · ')) : '—') + '</td>'
        + '<td class="muted" style="font-size:12.5px;direction:ltr;text-align:right">'
        + esc(r.t._username || '—') + '</td>'
        + '<td>' + (c.ok
            ? '<span style="color:#1E8449;font-weight:800;font-size:12.5px">תקין</span>'
            : '<span style="color:#C0392B;font-weight:800;font-size:12.5px">' + esc(c.why || 'חסום') + '</span>')
          + '</td>'
        + '<td style="white-space:nowrap">'
        + (c.link ? '<button class="btn sm ghost" onclick="EBAccess.copy(\'' + r.t.id + '\')">העתקת קישור</button>' : '')
        + '<button class="btn sm ghost" onclick="go(\'trainee\',\'' + r.t.id + '\')">פתח</button>'
        + '</td></tr>';
    });

    h += '</tbody></table></div></div>'
      + '<div class="muted" style="font-size:11.5px;margin-top:10px;line-height:1.6">'
      + 'הבדיקה נעשית על הנתונים שכבר סונכרנו. מתאמן שנוצר ועדיין לא סונכרן '
      + 'לא יופיע כתקין עד שהסנכרון יסתיים. אם מתאמן שמסומן תקין עדיין נכשל — '
      + 'סביר שהוא מקליד סיסמה שגויה או שהקישור נחתך בשליחה בוואטסאפ.'
      + '</div>';

    return h;
  }

  function copy(id) {
    var t = (typeof tById === 'function') ? tById(id) : null;
    if (!t) return;
    var link = window.EBSync && EBSync.traineeLink ? EBSync.traineeLink(t) : null;
    if (!link) { toast('אין קישור — צריך לסנכרן קודם'); return; }
    /* clipboard.writeText נכשל בהקשר לא מאובטח; textarea עובד תמיד */
    try {
      navigator.clipboard.writeText(link).then(
        function () { toast('הקישור הועתק'); },
        function () { fallback(link); }
      );
    } catch (e) { fallback(link); }
  }
  function fallback(link) {
    var ta = document.createElement('textarea');
    ta.value = link; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('הקישור הועתק'); }
    catch (e) { toast('לא הצלחתי להעתיק — הקישור: ' + link); }
    ta.remove();
  }

  window.EBAccess = { view: view, check: check, blocked: blocked, copy: copy };
})();

/* =====================================================================
   E.B FIT — מדריכים
   ---------------------------------------------------------------------
   כל טקסט שהמאמן שולח שוב ושוב יושב כאן: המדריך המלא למתאמן, הודעת
   הפתיחה, הסבר הסימון, החימום, הסבר השקילה ותזכורת למי שנעלם.

   עד היום הם היו פזורים — חלק בקוד, חלק בשיחות ישנות בוואטסאפ, וחלק
   הוקלדו מחדש בכל פעם. כאן הם במקום אחד: מעתיקים בלחיצה, או שולחים
   ישירות בוואטסאפ למתאמן ספציפי כשהשם והקישור נכנסים לבד.

   הטקסטים הם ברירת מחדל. מי שעורך אותם — הגרסה שלו נשמרת בהגדרות
   וגוברת, ו"איפוס" מחזיר את המקור.
   ===================================================================== */
(function () {
  'use strict';

  (window.EB_MOD = window.EB_MOD || {})['guides'] = 'v188';

  /* {שם} ו-{קישור} מוחלפים בשליחה למתאמן */
  var G = [
    { id: 'open', ic: '👋', t: 'הודעת פתיחה', d: 'ההודעה הראשונה עם הקישור והסבר קצר',
      wa: true,
      body:
'היי {שם}! 💪\n' +
'התוכנית שלך ב-*E.B FIT* מוכנה.\n' +
'הקישור האישי שלך:\n{קישור}\n\n' +
'*📲 פעם אחת בהתחלה — לשמור כאפליקציה*\n' +
'• אייפון: לפתוח ב*ספארי* ← שיתוף ← *הוסף למסך הבית*\n' +
'• אנדרואיד: לפתוח ב*כרום* ← ⋮ ← *הוספה למסך הבית*\n' +
'בכניסה הראשונה מאשרים את התקנון וממלאים הצהרת בריאות.\n\n' +
'הקישור אישי — לא להעביר הלאה. שאלות? אני כאן 🙌' },

    { id: 'full', ic: '📖', t: 'המדריך המלא', d: 'כל מסך באפליקציה — מה עושים בו ולמה',
      wa: true,
      body:
'*המדריך שלך ל-E.B FIT* 💪\n\n' +
'*🏋️ אימון — התוכנית שלך*\n' +
'בוחרים את היום ← ✓ על כל תרגיל שסיימת ← "איך היה?" (קל/בסדר/קשה) ← הערה אם משהו כאב ← *סיימתי את האימון הזה*.\n' +
'יש שם גם ספריית תרגילים, ואפשר לערוך את התוכנית ולהוסיף תרגילים משלך.\n\n' +
'*📓 יומן — כמה הרמת*\n' +
'משקל וחזרות בכל סט. המספר הגדול למעלה הוא הנפח (משקל × חזרות).\n' +
'רק מהמספרים האלה אני יודע מתי להעלות לך משקל ובכמה — זו הדקה הכי משתלמת באימון.\n\n' +
'*🍽 תזונה*\n' +
'התפריט הוא אפשרויות, לא חובה לאכול הכל.\n' +
'אכלת ארוחה? לוחצים *אכלתי?* והיא נספרת מול היעד היומי.\n' +
'אכלת משהו אחר? מוסיפים בשורת ההוספה או מספריית המזון. אפשר גם לבנות ארוחה משלך ולשמור אותה.\n\n' +
'*🧍 גוף*\n' +
'BMI, הצהרת בריאות (חשוב לעדכן אם משהו השתנה) וכל הקבצים ששלחתי לך.\n\n' +
'*📈 מעקב*\n' +
'שקילה פעם בשבוע, גרף התקדמות לכל תרגיל, ו"המאמן החכם" שאומר מתי להעלות משקל ומה נתקע.\n\n' +
'*🧘 הרגלים*\n' +
'מתיחות ומוביליטי לסימון יומי, וסימון תזונה.\n\n' +
'*הכל נשמר לבד* — גם בלי אינטרנט במכון. אני רואה מה שסימנת ומתאים את התוכנית לפי זה.' },

    { id: 'mark', ic: '✅', t: 'איך מסמנים אימון', d: 'למי שלא מדווח — הסבר קצר וממוקד',
      wa: true,
      body:
'{שם}, בקצרה איך מדווחים אימון — לוקח 30 שניות:\n\n' +
'1. פותחים את הקישור ← *אימון* ← היום של היום\n' +
'2. ✓ על כל תרגיל שסיימת\n' +
'3. *איך היה?* — קל / בסדר / קשה\n' +
'4. *סיימתי את האימון הזה*\n\n' +
'ואת המשקלים עצמם — ב*יומן*: משקל וחזרות בכל סט.\n' +
'זה מה שמאפשר לי לדעת מתי להעלות לך משקל במקום לנחש 💪' },

    { id: 'food', ic: '🍽', t: 'הסבר תזונה וסימון', d: '"אכלתי?", הוספת אוכל, ובניית ארוחה',
      wa: true,
      body:
'{שם}, לגבי התזונה באפליקציה:\n\n' +
'• התפריט הוא *אפשרויות* — לא חובה לאכול הכל. בוחרים מכל קטגוריה מה שמתאים היום.\n' +
'• אכלת ארוחה מהתפריט? לוחצים *אכלתי?* והיא נספרת מול היעד היומי.\n' +
'• אכלת משהו שלא בתפריט? מוסיפים אותו — שורת הוספה מהירה או מתוך ספריית המזון.\n' +
'• אפשר לבנות ארוחה משלך מרכיבים, והאפליקציה מחשבת קלוריות וחלבון.\n\n' +
'מה שלא מסומן — לא נספר, גם אם אכלת. אז שווה לסמן תוך כדי ולא בסוף היום 🙂' },

    { id: 'weigh', ic: '⚖️', t: 'הסבר שקילה', d: 'מתי, איך, ולמה לא להיבהל ממספר אחד',
      wa: true,
      body:
'{שם}, לגבי השקילה:\n\n' +
'• פעם בשבוע, ב*מעקב* באפליקציה.\n' +
'• הכי מדויק *ביום חמישי בבוקר* — אחרי שירותים, לפני אוכל ושתייה.\n' +
'• אותם תנאים בכל פעם, אחרת משווים תפוחים לתפוזים.\n\n' +
'חשוב: המשקל זז קילו למעלה ולמטה בגלל מלח, מים, שינה ומחזור.\n' +
'*מה שקובע זה הקו לאורך שבועות, לא המספר של הבוקר.* אני מסתכל על המגמה 📉' },

    { id: 'warm', ic: '🔥', t: 'טקסט החימום', d: 'החימום המלא — גם נכנס לתוכנית בלחיצה',
      wa: true, warm: true, body: '' },

    { id: 'back', ic: '👋', t: 'תזכורת למי שנעלם', d: 'הודעה קצרה בלי אשמה, שמחזירה לאימון',
      wa: true,
      body:
'היי {שם}, מה קורה?\n' +
'ראיתי שלא היה אימון השבוע — וזה בסדר, לכולם יש שבועות כאלה.\n\n' +
'לא צריך לחזור חזק. בוא נתחיל מאימון אחד קצר השבוע, וממנו נמשיך.\n' +
'משהו מפריע — זמן, כאב, משהו בתוכנית? תגיד לי ונתאים 💪' },

    { id: 'terms', ic: '🩺', t: 'הצהרת בריאות', d: 'למה זה חשוב ואיפה ממלאים',
      wa: true,
      body:
'{שם}, לפני שמתחילים — צריך למלא הצהרת בריאות באפליקציה:\n' +
'*גוף* ← הצהרת בריאות ← שבע שאלות קצרות.\n\n' +
'זה לא בירוקרטיה: זה מה שקובע אם מתחילים ישר או שצריך קודם אישור רופא, ומה כדאי להימנע ממנו בתוכנית.\n' +
'אם משהו משתנה בדרך — פציעה, ניתוח, תרופה חדשה — נכנסים ומעדכנים, ואני רואה את זה 🙏' }
  ];

  function text(g) {
    if (g.warm) return (typeof WARMUP_TEXT !== 'undefined') ? WARMUP_TEXT : '';
    var mine = ((S.settings || {}).guides || {})[g.id];
    return (mine != null && String(mine).trim()) ? mine : g.body;
  }
  function edited(g) {
    var mine = ((S.settings || {}).guides || {})[g.id];
    return !g.warm && mine != null && String(mine).trim() && mine !== g.body;
  }
  function byId(id) { for (var i = 0; i < G.length; i++) if (G[i].id === id) return G[i]; return null; }

  /* השם והקישור נכנסים לבד. בלי מתאמן נבחר — משאירים את הסימון,
     כדי שברור מה להשלים כשמדביקים ידנית. */
  function fill(txt, t) {
    if (!t) return txt;
    var link = (window.EBSync && EBSync.traineeLink) ? (EBSync.traineeLink(t) || '') : '';
    return String(txt)
      .replace(/\{שם\}/g, (typeof firstName === 'function' ? firstName(t) : t.name) || '')
      .replace(/\{קישור\}/g, link || '(הקישור עוד לא נוצר — סנכרן קודם)');
  }

  var PICK = '';   // המתאמן שנבחר לשליחה

  function view() {
    var opts = (typeof activeTrainees === 'function' ? activeTrainees() : (S.trainees || []));
    var t = PICK ? tById(PICK) : null;

    var h = '<div class="head"><div><h1>מדריכים</h1>'
      + '<p class="muted">כל מה שאתה שולח למתאמנים, מוכן להעתקה. השם והקישור נכנסים לבד.</p></div></div>';

    h += '<div class="card" style="margin-bottom:14px">'
      + '<div class="row" style="gap:10px;align-items:center;flex-wrap:wrap">'
      + '<span class="muted" style="font-size:13px">ממלא עבור:</span>'
      + '<select class="f" style="flex:1;min-width:180px" onchange="EBGuides.setTrainee(this.value)">'
      + '<option value="">— בלי מתאמן (טקסט כללי) —</option>'
      + opts.map(function (x) {
          return '<option value="' + x.id + '"' + (x.id === PICK ? ' selected' : '') + '>' + esc(x.name) + '</option>';
        }).join('')
      + '</select></div>'
      + (t ? '<div class="muted" style="font-size:12px;margin-top:8px">'
             + (((window.EBSync && EBSync.traineeLink && EBSync.traineeLink(t)) ? '✓ יש קישור אישי — ייכנס להודעה'
                : '⚠ אין עדיין קישור אישי. צור אותו ב"גישת מתאמנים".')) + '</div>' : '')
      + '</div>';

    G.forEach(function (g) {
      var body = fill(text(g), t);
      var preview = body.split('\n').filter(function (l) { return l.trim(); }).slice(0, 3).join(' · ');
      h += '<div class="card" style="margin-bottom:12px">'
        + '<div class="row" style="align-items:flex-start;gap:11px">'
        + '<div style="font-size:22px;line-height:1">' + g.ic + '</div>'
        + '<div style="flex:1;min-width:0">'
        + '<div style="font-family:Heebo;font-weight:700;font-size:15px">' + esc(g.t)
        + (edited(g) ? ' <span class="pill" style="font-size:10.5px">ערוך שלי</span>' : '') + '</div>'
        + '<div class="muted" style="font-size:12.5px;margin-top:2px">' + esc(g.d) + '</div>'
        + '<div class="muted" style="font-size:12px;margin-top:8px;line-height:1.6;'
        + 'overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">'
        + esc(preview) + '</div>'
        + '</div></div>'
        + '<div class="row" style="gap:6px;margin-top:11px;flex-wrap:wrap">'
        + '<button class="btn sm" onclick="EBGuides.copy(\'' + g.id + '\')">העתקה</button>'
        + '<button class="btn sm ghost" onclick="EBGuides.show(\'' + g.id + '\')">תצוגה</button>'
        + (t ? '<button class="btn sm ghost" onclick="EBGuides.wa(\'' + g.id + '\')">שליחה בוואטסאפ</button>' : '')
        + (g.warm ? '<div style="flex:1"></div><button class="btn sm ghost" onclick="EBGuides.toWarm()">הכנסה לתוכנית</button>' : '')
        + (g.warm ? '' : '<div style="flex:1"></div><button class="btn sm ghost" onclick="EBGuides.edit(\'' + g.id + '\')">עריכה</button>')
        + '</div></div>';
    });

    h += '<div class="card"><div style="font-family:Heebo;font-weight:700;font-size:14px;margin-bottom:6px">קישור למדריך המעוצב</div>'
      + '<div class="muted" style="font-size:12.5px;margin-bottom:8px">אם יש לך מדריך כדף אינטרנט — הדבק כאן את הקישור, והוא יתווסף להודעת הפתיחה.</div>'
      + '<input class="f" style="width:100%" placeholder="https://…" value="'
      + esc((S.settings || {}).guideUrl || '') + '" onchange="EBGuides.setUrl(this.value)"></div>';

    return h;
  }

  function setTrainee(id) { PICK = id || ''; render(); }
  function setUrl(v) { S.settings.guideUrl = String(v || '').trim(); save(); toast('נשמר'); }

  function bodyFor(id) {
    var g = byId(id); if (!g) return '';
    var t = PICK ? tById(PICK) : null;
    var txt = fill(text(g), t);
    var url = (S.settings || {}).guideUrl;
    if (url && (id === 'open' || id === 'full')) txt += '\n\nהמדריך המלא: ' + url;
    return txt;
  }

  function copy(id) {
    var txt = bodyFor(id);
    var done = function () { toast('הועתק — אפשר להדביק'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(done, function () { show(id); });
    } else show(id);
  }

  function show(id) {
    var g = byId(id); if (!g) return;
    openModal('<div class="mh"><h3>' + g.ic + ' ' + esc(g.t) + '</h3>'
      + '<button class="iconbtn" onclick="closeModal()">✕</button></div><div class="mb">'
      + '<textarea class="f" id="gd_show" readonly rows="16" style="width:100%;line-height:1.7;font-size:13.5px">'
      + esc(bodyFor(id)) + '</textarea>'
      + '<div class="muted" style="font-size:12px;margin-top:8px">אפשר לסמן הכל ולהעתיק ידנית.</div>'
      + '</div><div class="mf"><button class="btn" onclick="EBGuides.copy(\'' + id + '\')">העתקה</button>'
      + '<button class="btn ghost" onclick="closeModal()">סגירה</button></div>', true);
  }

  function edit(id) {
    var g = byId(id); if (!g || g.warm) return;
    openModal('<div class="mh"><h3>עריכת "' + esc(g.t) + '"</h3>'
      + '<button class="iconbtn" onclick="closeModal()">✕</button></div><div class="mb">'
      + '<div class="muted" style="font-size:12.5px;margin-bottom:8px">'
      + '{שם} ו-{קישור} יוחלפו אוטומטית בשליחה למתאמן.</div>'
      + '<textarea class="f" id="gd_edit" rows="18" style="width:100%;line-height:1.7;font-size:13.5px">'
      + esc(text(g)) + '</textarea>'
      + '</div><div class="mf"><button class="btn" onclick="EBGuides.saveEdit(\'' + id + '\')">שמירה</button>'
      + '<button class="btn ghost" onclick="EBGuides.reset(\'' + id + '\')">איפוס למקור</button>'
      + '<div style="flex:1"></div><button class="btn ghost" onclick="closeModal()">ביטול</button></div>', true);
  }
  function saveEdit(id) {
    var el = document.getElementById('gd_edit'); if (!el) return;
    S.settings.guides = S.settings.guides || {};
    S.settings.guides[id] = el.value;
    save(); closeModal(); render(); toast('נשמר');
  }
  function reset(id) {
    if (!(S.settings.guides || {})[id]) { closeModal(); return; }
    if (!confirm('לאפס את הטקסט חזרה למקור?')) return;
    delete S.settings.guides[id];
    save(); closeModal(); render(); toast('חזר למקור');
  }

  function wa(id) {
    var t = PICK ? tById(PICK) : null;
    if (!t) { toast('בחר מתאמן קודם'); return; }
    var p = String(t.phone || '').replace(/\D/g, '');
    if (!p) { toast('אין מספר טלפון למתאמן הזה'); return; }
    if (p.charAt(0) === '0') p = '972' + p.slice(1);
    window.open('https://wa.me/' + p + '?text=' + encodeURIComponent(bodyFor(id)), '_blank');
  }

  function toWarm() {
    var t = PICK ? tById(PICK) : null;
    if (!t) { toast('בחר מתאמן קודם'); return; }
    if (typeof warmupFill === 'function') { warmupFill(t.id); toast('החימום נכנס לתוכנית של ' + t.name); }
  }

  window.EBGuides = { view: view, copy: copy, show: show, edit: edit, saveEdit: saveEdit,
                      reset: reset, wa: wa, toWarm: toWarm, setTrainee: setTrainee, setUrl: setUrl,
                      all: function () { return G; }, text: bodyFor };
})();

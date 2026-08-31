/* =====================================================================
   E.B FIT — תפריט ארוחות עם תמונות
   ---------------------------------------------------------------------
   המאמן בונה למתאמן תפריט: לכל ארוחה שם, תמונה, וערכים תזונתיים.
   המתאמן רואה אותו בקישור האישי שלו, עם סיכום יומי מול היעדים.

   התמונות יושבות ב-Supabase Storage תחת נתיב אקראי, ומוקטנות בדפדפן
   לפני ההעלאה — תמונה מצלמת טלפון שוקלת 3–5MB, וגלריה של עשרים
   ארוחות הייתה ממלאת את מכסת האחסון החינמית ומעמיסה על הטלפון של
   המתאמן בכל פתיחה.
   ===================================================================== */
(function () {
  'use strict';

  (window.EB_MOD = window.EB_MOD || {})['meals'] = 'v46';

  var BUCKET = 'programs';
  var MAXW   = 900;          // רוחב מרבי אחרי הקטנה
  var Q      = 0.72;         // איכות JPEG

  var TYPES = [
    ['breakfast','בוקר'], ['lunch','צהריים'], ['dinner','ערב'],
    ['snack','ביניים'], ['pre','לפני אימון'], ['post','אחרי אימון']
  ];
  function typeName(k){ var f = TYPES.find(function(x){return x[0]===k;}); return f?f[1]:''; }

  function rand(){ return Math.random().toString(36).slice(2,10) + Date.now().toString(36).slice(-4); }
  function num(v){ var n = Number(v); return isFinite(n) && n > 0 ? n : 0; }

  /* ---------- הקטנת תמונה בדפדפן ---------- */
  function shrink(file) {
    return new Promise(function (resolve, reject) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        URL.revokeObjectURL(url);
        var w = img.width, h = img.height;
        if (w > MAXW) { h = Math.round(h * MAXW / w); w = MAXW; }
        var c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        c.toBlob(function (b) {
          b ? resolve(b) : reject(new Error('ההמרה נכשלה'));
        }, 'image/jpeg', Q);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('לא הצלחנו לקרוא את התמונה')); };
      img.src = url;
    });
  }

  async function uploadPhoto(traineeId, file) {
    if (!window.EBSync || !EBSync.user()) throw new Error('צריך להתחבר');
    var blob = await shrink(file);
    var sb = EBSync.client(), uid_ = EBSync.user().id;
    var path = uid_ + '/' + traineeId + '/meals/' + rand() + '.jpg';
    var up = await sb.storage.from(BUCKET).upload(path, blob, {
      cacheControl: '86400', upsert: false, contentType: 'image/jpeg'
    });
    if (up.error) throw up.error;
    return { path: path, url: sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl,
             size: blob.size };
  }

  /* ---------- סיכום ---------- */
  function totals(list) {
    return (list || []).reduce(function (a, m) {
      a.kcal += num(m.kcal); a.p += num(m.protein);
      a.c += num(m.carbs);   a.f += num(m.fat);
      return a;
    }, { kcal:0, p:0, c:0, f:0 });
  }

  /* ---------- כרטיס בתיק המאמן ---------- */
  function tab(t) {
    var on = window.EBSync && EBSync.enabled() && EBSync.user();
    var list = t.meals || [];
    var T = totals(list);
    var goals = window.EBMetrics ? EBMetrics.compute(t) : {};

    var h = '<div class="row" style="margin-bottom:12px">'
      + '<h3 style="flex:1;font-size:16px">תפריט · ' + list.length + ' ארוחות</h3>'
      + (on ? '<button class="btn sm ghost" onclick="EBLibUI.browse(\'' + t.id + '\')">ספריית ארוחות</button>'
            + '<button class="btn sm" onclick="EBMeals.edit(\'' + t.id + '\')">+ ארוחה</button>' : '')
      + '</div>';

    if (!on) return h + '<div class="empty">צריך להתחבר לסנכרון כדי לנהל תפריט.</div>';

    /* אם עמודת meals חסרה בשרת, התפריט נשמר במכשיר בלבד ולא מגיע
       למתאמן. בלי ההודעה הזו זה נראה כאילו הכול עובד. */
    if (window.EBSync && EBSync.missing) {
      var miss = (EBSync.missing().trainees || []);
      if (miss.indexOf('meals') > -1) {
        h += '<div class="card" style="margin-bottom:12px;border-color:var(--amber);'
          + 'background:rgba(255,162,77,.07)">'
          + '<div style="font-family:Rubik;font-weight:700;font-size:14px;color:var(--amber)">'
          + 'התפריט נשמר במכשיר הזה בלבד</div>'
          + '<div class="muted" style="font-size:13px;line-height:1.6;margin-top:6px">'
          + 'בשרת חסרה עמודת הארוחות, ולכן התפריט לא מגיע למתאמן בקישור שלו. '
          + 'הכול כאן ממשיך לעבוד, וברגע שתריץ את <b>supabase/meals.sql</b> '
          + 'התפריטים יסונכרנו מעצמם.</div></div>';
      }
    }

    /* סיכום מול היעד */
    if (list.length) {
      var bar = function (label, val, goal, unit) {
        var pct = goal ? Math.min(100, Math.round(val / goal * 100)) : 0;
        var over = goal && val > goal * 1.05;
        return '<div style="flex:1;min-width:120px">'
          + '<div class="row" style="font-size:12.5px;margin-bottom:4px">'
          + '<span class="muted" style="flex:1">' + label + '</span>'
          + '<span style="font-family:Rubik;font-weight:700">' + Math.round(val) + (goal ? ' / ' + Math.round(goal) : '') + ' ' + unit + '</span></div>'
          + '<div style="height:5px;background:var(--panel);border-radius:20px;overflow:hidden">'
          + '<div style="height:100%;width:' + pct + '%;border-radius:20px;background:'
          + (over ? 'var(--bad)' : 'linear-gradient(90deg,var(--or),var(--amber))') + '"></div></div></div>';
      };
      h += '<div class="card" style="margin-bottom:14px">'
        + '<div class="row" style="gap:14px;flex-wrap:wrap">'
        + bar('קלוריות', T.kcal, goals.kcal, '')
        + bar('חלבון', T.p, goals.protein, 'ג׳')
        + bar('פחמימות', T.c, goals.carbs, 'ג׳')
        + bar('שומן', T.f, goals.fatG, 'ג׳')
        + '</div>'
        + (goals.kcal
            ? '<div class="muted" style="font-size:12px;margin-top:10px">הסיכום הוא של כל הארוחות בתפריט מול היעד היומי המחושב.</div>'
            : '<div class="muted" style="font-size:12px;margin-top:10px">אין יעדים מחושבים — חסרים משקל, גובה, גיל או מין.</div>')
        + '</div>';
    }

    if (!list.length)
      return h + '<div class="empty"><div class="big">🍽</div>אין עדיין ארוחות.<br>'
        + '<div class="row" style="justify-content:center;margin-top:12px">'
        + '<button class="btn" onclick="EBLibUI.browse(\'' + t.id + '\')">בחירה מהספרייה</button>'
        + '<button class="btn ghost" onclick="EBMeals.edit(\'' + t.id + '\')">ארוחה משלי</button></div></div>';

    /* רשימה מקובצת לפי סוג */
    var byType = {};
    list.forEach(function (m) { (byType[m.type || 'other'] = byType[m.type || 'other'] || []).push(m); });
    var order = TYPES.map(function (x) { return x[0]; }).concat(['other']);

    order.forEach(function (k) {
      var g = byType[k];
      if (!g || !g.length) return;
      h += '<div class="muted" style="font-size:12px;letter-spacing:.1em;margin:16px 0 8px">'
        + esc(typeName(k) || 'ללא שיוך') + '</div><div class="grid g3">';
      g.forEach(function (m) {
        h += '<div class="card" style="padding:0;overflow:hidden">'
          + (m.photo
              ? '<div style="aspect-ratio:16/10;background:var(--ink) url(' + esc(m.photo) + ') center/cover"></div>'
              : '<div style="aspect-ratio:16/10;background:var(--panel-2);display:grid;place-items:center;font-size:30px">🍽</div>')
          + '<div style="padding:12px">'
          + '<div style="font-family:Rubik;font-weight:700;font-size:15px;line-height:1.3">' + esc(m.name || 'ארוחה') + '</div>'
          + (m.desc ? '<div class="muted" style="font-size:12.5px;margin-top:4px;line-height:1.45">' + esc(m.desc) + '</div>' : '')
          + '<div class="row" style="gap:6px;margin-top:10px;flex-wrap:wrap">'
          + (num(m.kcal)    ? '<span class="pill">' + num(m.kcal) + ' קק״ל</span>' : '')
          + (num(m.protein) ? '<span class="pill">ח ' + num(m.protein) + '</span>' : '')
          + (num(m.carbs)   ? '<span class="pill">פ ' + num(m.carbs) + '</span>' : '')
          + (num(m.fat)     ? '<span class="pill">ש ' + num(m.fat) + '</span>' : '')
          + '</div>'
          + '<div class="row" style="margin-top:10px">'
          + '<button class="btn sm ghost" onclick="EBMeals.edit(\'' + t.id + '\',\'' + m.id + '\')">עריכה</button>'
          + '<div style="flex:1"></div>'
          + '<button class="iconbtn" style="width:28px;height:28px" onclick="EBMeals.del(\'' + t.id + '\',\'' + m.id + '\')">✕</button>'
          + '</div></div></div>';
      });
      h += '</div>';
    });

    h += '<div class="muted" style="font-size:12px;margin-top:14px">'
      + 'התמונות מוקטנות אוטומטית לפני ההעלאה, כדי לא למלא את מכסת האחסון '
      + 'ולא להעמיס על הטלפון של המתאמן. הן נפתחות דרך קישור אקראי שאי אפשר לנחש.</div>';
    return h;
  }

  /* ---------- טופס ארוחה ---------- */
  var PENDING = null;    // תמונה שהועלתה וטרם נשמרה

  function edit(traineeId, mealId) {
    var t = tById(traineeId); if (!t) return;
    var m = mealId ? (t.meals || []).find(function (x) { return x.id === mealId; }) : null;
    m = m || { type:'breakfast' };
    PENDING = null;

    openModal('<div class="mh"><h3>' + (mealId ? 'עריכת ארוחה' : 'ארוחה חדשה') + '</h3>'
      + '<button class="iconbtn" onclick="closeModal()">✕</button></div><div class="mb">'
      + '<div id="mlPhoto">' + photoBox(m.photo) + '</div>'
      + '<div class="grid g2" style="margin-top:12px">'
      + fld('שם הארוחה','ml_name','text',m.name)
      + sel('סוג','ml_type',TYPES,m.type)
      + '</div>'
      + '<div style="margin-top:12px"><label class="f">תיאור — מה בדיוק ובאיזו כמות</label>'
      + '<textarea class="f" id="ml_desc" style="min-height:70px">' + esc(m.desc || '') + '</textarea></div>'
      + '<div class="sep"></div><label class="f">ערכים תזונתיים</label>'
      + '<div class="grid g4" style="margin-top:6px">'
      + fld('קלוריות','ml_kcal','number',m.kcal)
      + fld('חלבון (ג׳)','ml_p','number',m.protein)
      + fld('פחמימות (ג׳)','ml_c','number',m.carbs)
      + fld('שומן (ג׳)','ml_f','number',m.fat)
      + '</div>'
      + '<button class="btn sm ghost" style="margin-top:10px" onclick="EBMeals.calcKcal()">חישוב קלוריות מהמאקרו</button>'
      + '</div><div class="mf">'
      + '<button class="btn" onclick="EBMeals.save(\'' + traineeId + '\',' + (mealId ? '\'' + mealId + '\'' : 'null') + ')">שמירה</button>'
      + '<button class="btn ghost" onclick="closeModal()">ביטול</button>'
      + (mealId ? '<div style="flex:1"></div><button class="btn danger" onclick="EBMeals.del(\'' + traineeId + '\',\'' + mealId + '\')">מחיקה</button>' : '')
      + '</div>', true);
  }

  function photoBox(url) {
    if (url)
      return '<div style="position:relative;border-radius:12px;overflow:hidden">'
        + '<div style="aspect-ratio:16/9;background:var(--ink) url(' + esc(url) + ') center/cover"></div>'
        + '<button class="btn sm ghost" style="position:absolute;bottom:10px;inset-inline-start:10px" '
        + 'onclick="EBMeals.pickPhoto()">החלפת תמונה</button></div>';
    return '<button onclick="EBMeals.pickPhoto()" style="width:100%;border:1.5px dashed var(--line-2);'
      + 'background:var(--panel);border-radius:12px;padding:26px;text-align:center;color:var(--dim)">'
      + '<div style="font-size:26px;margin-bottom:6px">📷</div>הוספת תמונה</button>';
  }

  function pickPhoto() {
    var inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = async function () {
      var f = inp.files && inp.files[0]; if (!f) return;
      var box = document.getElementById('mlPhoto');
      box.innerHTML = '<div class="card" style="text-align:center;padding:24px;color:var(--mut)">מעלה…</div>';
      try {
        var tid = currentTrainee();
        var r = await uploadPhoto(tid, f);
        PENDING = r;
        box.innerHTML = photoBox(r.url);
        toast('התמונה הועלתה · ' + Math.round(r.size/1024) + 'KB');
      } catch (e) {
        box.innerHTML = photoBox(null);
        var msg = (e && e.message) || '';
        if (/row-level security|policy|Unauthorized/i.test(msg)) msg = 'אין הרשאה לאחסון — צריך להריץ את storage.sql';
        else if (/mime|content.?type/i.test(msg)) msg = 'סוג התמונה נחסם בשרת';
        console.error('[EBMeals] upload failed:', e);
        toast('ההעלאה נכשלה: ' + (msg || 'שגיאה'));
      }
    };
    inp.click();
  }
  function currentTrainee(){ return window.ARG; }

  function calcKcal() {
    var p = num(gv('ml_p')), c = num(gv('ml_c')), f = num(gv('ml_f'));
    if (!p && !c && !f) { toast('צריך למלא לפחות מאקרו אחד'); return; }
    document.getElementById('ml_kcal').value = Math.round(p*4 + c*4 + f*9);
    toast('חושב: חלבון ופחמימה 4 קק״ל לגרם, שומן 9');
  }

  function save(traineeId, mealId) {
    var t = tById(traineeId); if (!t) return;
    var name = gv('ml_name');
    if (!name) { toast('צריך שם לארוחה'); return; }

    t.meals = t.meals || [];
    var m = mealId ? t.meals.find(function (x) { return x.id === mealId; }) : null;
    if (!m) { m = { id: rand() }; t.meals.push(m); }

    m.name    = name;
    m.type    = gv('ml_type');
    m.desc    = gv('ml_desc');
    m.kcal    = gv('ml_kcal');
    m.protein = gv('ml_p');
    m.carbs   = gv('ml_c');
    m.fat     = gv('ml_f');
    if (PENDING) { m.photo = PENDING.url; m.photoPath = PENDING.path; PENDING = null; }

    save_(); closeModal(); render();
    toast(mealId ? 'הארוחה עודכנה' : 'הארוחה נוספה');
  }
  function save_(){ if (typeof window.save === 'function') window.save(); }

  async function del(traineeId, mealId) {
    var t = tById(traineeId); if (!t || !t.meals) return;
    var m = t.meals.find(function (x) { return x.id === mealId; });
    if (!m) return;
    if (!confirm('למחוק את "' + (m.name || 'הארוחה') + '"?')) return;

    if (m.photoPath && window.EBSync && EBSync.client()) {
      try { await EBSync.client().storage.from(BUCKET).remove([m.photoPath]); } catch (e) {}
    }
    t.meals = t.meals.filter(function (x) { return x.id !== mealId; });
    save_(); closeModal(); render();
    toast('הארוחה נמחקה');
  }

  window.EBMeals = { tab:tab, edit:edit, save:save, del:del,
                     pickPhoto:pickPhoto, calcKcal:calcKcal, totals:totals, typeName:typeName };
})();

/* =====================================================================
   BAUER POWER — הצוות שלי
   ---------------------------------------------------------------------
   חמישה "עובדים" שעוברים כל בוקר על נתוני העסק: רואה חשבון, עורך דין,
   מנהל תפעול, מכירות ושימור, ומאמן ראשי. לכל אחד שולחן עם מה שמחכה
   למאמן, ולכל ממצא פעולה אחת.

   שלושה כללים שקבעו את הבנייה:

   * הבדיקות רצות במכשיר, בלי רשת ובלי מודל. הן חוקים פשוטים על S,
     ולכן הן חינם, עובדות בלי חיבור, ושום מידע לא יוצא בשבילן.

   * הצ׳אט החופשי הוא התוספת, לא הבסיס. הוא שולח למודל מספרים וקודים
     בלבד: שמות מוחלפים ב"מתאמן-07" לפני השליחה ומוחזרים בתצוגה, וטקסט
     חופשי רפואי (שאלון, הצהרה, הערות) לא נכנס לבקשה בשום צורה. הודעת
     הפרטיות שהמתאמנים חתמו עליה אומרת שהמידע לא עובר לצד שלישי.

   * רואה החשבון ועורך הדין הם סדר ותזכורות, לא ייעוץ. מספר שאי אפשר
     לאמת (תקרת עוסק פטור) הוא הגדרה שהמאמן יכול לתקן, לא קבוע בקוד.

   הליבה (analyze, ask, context, mask) טהורה ומקבלת את הסביבה כפרמטר,
   כדי שאפשר יהיה לבדוק אותה ב-node בלי דפדפן.
   ===================================================================== */
(function () {
  'use strict';

  var W = (typeof window !== 'undefined') ? window : {};
  (W.EB_MOD = W.EB_MOD || {})['team'] = 'v277';

  var DAY = 86400000;
  var WORKERS = [
    { id: 'finance',  t: 'רואה חשבון',     s: 'כספים, גבייה ותקרות',          ic: '₪' },
    { id: 'legal',    t: 'עורך דין',       s: 'הצהרות בריאות, תקנון ופרטיות',  ic: '§' },
    { id: 'coaching', t: 'מאמן ראשי',      s: 'בטיחות, תוכניות ויעדים',        ic: '✚' },
    { id: 'growth',   t: 'מכירות ושימור',  s: 'מי מתקרר, מי מחדש',             ic: '↗' },
    { id: 'ops',      t: 'מנהל תפעול',     s: 'נתונים נקיים ומערכת בריאה',     ic: '⚙' }
  ];
  var SEV = { pain: 0, wait: 1, info: 2 };
  var BIZ_DEFAULT = { type: '', ceiling: 122833, payDay: 10, maxTrainees: '', insuranceUntil: '', certUntil: '', declMonths: 24 };

  /* ---------- עזרים טהורים ---------- */
  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function isoOf(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function addD(iso, n) { var d = new Date(iso + 'T00:00'); d.setDate(d.getDate() + n); return isoOf(d); }
  function daysBetween(a, b) {
    var x = new Date(String(a).slice(0, 10) + 'T00:00').getTime(), y = new Date(String(b).slice(0, 10) + 'T00:00').getTime();
    return (isFinite(x) && isFinite(y)) ? Math.round((y - x) / DAY) : null;
  }
  function monOf(iso) { return String(iso || '').slice(0, 7); }
  function prevMon(mon, back) {
    var y = Number(mon.slice(0, 4)), m = Number(mon.slice(5, 7)) - 1 - (back || 1);
    var d = new Date(y, m, 1); return d.getFullYear() + '-' + pad(d.getMonth() + 1);
  }
  var HE_MON = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
  function monName(mon) { return HE_MON[Number(mon.slice(5, 7)) - 1] + ' ' + mon.slice(0, 4); }
  function heDate(iso) { var s = String(iso || '').slice(0, 10).split('-'); return s.length === 3 ? Number(s[2]) + '.' + Number(s[1]) + '.' + s[0] : ''; }
  function money0(n) { return '₪' + Math.round(n).toLocaleString('en-US'); }
  function first(name) { return String(name || '').trim().split(/\s+/)[0] || ''; }
  function ageOf(t, today) {
    var b = t.birth; if (!b || !/^\d{4}-\d{2}-\d{2}/.test(b)) return null;
    var a = Number(today.slice(0, 4)) - Number(b.slice(0, 4));
    if (today.slice(5) < b.slice(5, 10)) a--;
    return a;
  }
  function namesOf(ts, max) {
    max = max || 6;
    var n = ts.map(function (t) { return t.name || 'בלי שם'; });
    return n.slice(0, max).join(', ') + (n.length > max ? ' ועוד ' + (n.length - max) : '');
  }
  /* ריבוי בעברית: "1 מתאמנים" נתפס בצילום המסך הראשון */
  function nT(n) { return n === 1 ? 'מתאמן אחד' : n + ' מתאמנים'; }
  function nP(n) { return n === 1 ? 'תשלום אחד' : n + ' תשלומים'; }
  function isActive(t) { return t && t.status === 'active'; }
  function notArch(t) { return t && t.status !== 'archived'; }
  function daysOfProg(t) { return (t.program && t.program.days) || []; }
  function healthObj(t) { return (t.health && typeof t.health === 'object') ? t.health : null; }
  function signed(t) { var h = healthObj(t); return !!(h && h.signedAt); }

  /* ---------- התאמת מילים בעברית ----------
     ‎\b של JS לא מכיר אותיות עבריות, ו"לב" נתפס בתוך "לבן". לכן
     מפרקים למשפטונים ולמילים, ומתירים תחילית של אות אחת (או ו׳ ועוד
     אות) רק על המילה הראשונה של הביטוי. שלילה קרובה ("אין", "ללא")
     מבטלת את ההתאמה. */
  var PREF = 'ובלמהשכ';
  var STOP = {}; ['כלב', 'כלבים', 'שלב', 'שלבים', 'בשלב', 'משלב', 'לבלב', 'בלבלב', 'בריאות', 'הבריאות',
    'משבר', 'משברים', 'מברך', 'לבן', 'בלבד', 'מלבן', 'חלב', 'הברכה', 'ברכה', 'מקרע'].forEach(function (w) { STOP[w] = 1; });
  var NEG = { 'אין': 1, 'ללא': 1, 'בלי': 1, 'לא': 1, 'שלילי': 1, 'מעולם': 1, 'ולא': 1, 'ואין': 1, 'ובלי': 1 };
  function clausesOf(text) {
    return String(text == null ? '' : text).replace(/["'׳״]/g, '')
      .split(/[.,;:!?\n()\/]|\s(?:אבל|אך|למעט)\s/)
      .map(function (s) { return s.trim().split(/\s+/).filter(Boolean); })
      .filter(function (a) { return a.length; });
  }
  function tokIs(tok, word) {
    if (tok === word) return true;
    if (STOP[tok]) return false;
    if (tok.length === word.length + 1 && PREF.indexOf(tok.charAt(0)) > -1 && tok.slice(1) === word) return true;
    if (tok.length === word.length + 2 && tok.charAt(0) === 'ו' && PREF.indexOf(tok.charAt(1)) > -1 && tok.slice(2) === word) return true;
    return false;
  }
  function hasTerm(text, term) {
    var ws = term.split(' '), cl = clausesOf(text);
    for (var c = 0; c < cl.length; c++) {
      var tk = cl[c];
      for (var i = 0; i + ws.length <= tk.length; i++) {
        if (!tokIs(tk[i], ws[0])) continue;
        var ok = true;
        for (var j = 1; j < ws.length; j++) if (tk[i + j] !== ws[j]) { ok = false; break; }
        if (!ok) continue;
        var neg = false;
        for (var k = Math.max(0, i - 4); k < i; k++) if (NEG[tk[k]]) neg = true;
        if (!neg) return true;
      }
    }
    return false;
  }
  function anyTerm(text, terms) { for (var i = 0; i < terms.length; i++) if (hasTerm(text, terms[i])) return true; return false; }

  /* מה שהמתאמן כתב על הבריאות שלו. נשאר במכשיר: משמש רק להתאמת מילים,
     והתוצאה שיוצאת מכאן היא שם קבוצה ("גב ומפרקים"), לא הטקסט. */
  function medText(t, withNotes) {
    var a = (t.intake && t.intake.answers) || {}, out = [a.medical, a.injuries, a.pain];
    ((t.intake && t.intake.extra) || []).forEach(function (x) { if (x) out.push((x.label || '') + ' ' + (x.value || '')); });
    var h = healthObj(t); if (h) out.push(h.notes);
    if (withNotes) out.push(t.notes);
    return out.filter(Boolean).join('\n');
  }
  var MED_GROUPS = [
    { g: 'לב', q: 'q1', terms: ['לב', 'לבבי', 'התקף לב', 'אוטם', 'צנתור', 'סטנט', 'מסתם', 'קוצב', 'הפרעת קצב', 'פרפור', 'תעוקה', 'אנגינה'] },
    { g: 'כאב בחזה', q: 'q2', terms: ['כאב בחזה', 'כאבים בחזה', 'לחץ בחזה'] },
    { g: 'סחרחורת והכרה', q: 'q4', terms: ['סחרחורת', 'סחרחורות', 'התעלפות', 'עילפון', 'איבוד הכרה', 'אפילפסיה', 'פרכוס', 'פרכוסים'] },
    { g: 'גב ומפרקים', q: 'q5', terms: ['דיסק', 'פריצת דיסק', 'בלט דיסק', 'מניסקוס', 'רצועה צולבת', 'צלב', 'שבר', 'פריקה', 'בקע', 'סקוליוזיס', 'אוסטאופורוזיס', 'דלקת מפרקים', 'ארתריטיס', 'ניתוח', 'ניתוחים', 'קרע'] },
    { g: 'לחץ דם', q: 'q6', terms: ['לחץ דם', 'יתר לחץ דם', 'מדלל דם', 'מדללי דם'] },
    { g: 'מצב רפואי אחר', q: 'q7', terms: ['סוכרת', 'אסתמה', 'אסטמה', 'קוצר נשימה', 'קשיי נשימה', 'בעיות נשימה', 'הריון', 'בהריון', 'טרשת', 'טרשת נפוצה', 'סרטן', 'כימותרפיה', 'דיאליזה', 'שבץ', 'אירוע מוחי', 'מפרצת'] }
  ];
  function medGroups(t) {
    var txt = medText(t, false); if (!txt) return [];
    return MED_GROUPS.filter(function (G) { return anyTerm(txt, G.terms); }).map(function (G) { return G.g; });
  }
  function allNo(t) {
    var h = healthObj(t); if (!h || !h.signedAt || !h.answers) return false;
    for (var i = 1; i <= 7; i++) if (h.answers['q' + i] !== 'no') return false;
    return true;
  }
  function anyYes(t) {
    var h = healthObj(t); if (!h || !h.signedAt || !h.answers) return false;
    for (var i = 1; i <= 7; i++) if (h.answers['q' + i] === 'yes') return true;
    return false;
  }

  /* מגבלה → תרגילים שמעמיסים עליה. רשימה שמרנית: עדיף ממצא שהמאמן
     יסמן "טופל" מאשר דדליפט כבד למי שכתב "בלט דיסק". */
  var LIMITS = [
    { tag: 'גב', terms: ['דיסק', 'בלט דיסק', 'פריצת דיסק', 'גב תחתון', 'סקוליוזיס', 'חוליות', 'חוליה'],
      rx: /דדליפט|סקוואט גבי|סקוואט קדמי|גוד מורנינג|חתירה במוט|סווינג|היפר-אקסטנשן|כפיפות בטן|רוסיאן/ },
    { tag: 'ברך', terms: ['ברך', 'ברכיים', 'מניסקוס', 'רצועה צולבת', 'צלב'],
      rx: /סקוואט|לאנג׳|סיסי|קפיצ|פשיטת ברך/ },
    { tag: 'כתף', terms: ['כתף', 'כתפיים', 'שרוול מסובב'],
      rx: /לחיצת כתפיים במוט|לחיצה מעל הראש|מתח אחיזה רחבה|מקבילים|דיפס|מאחורי הראש/ }
  ];
  function riskyFor(t) {
    var txt = medText(t, true); if (!txt) return [];
    var out = [];
    LIMITS.forEach(function (L) {
      if (!anyTerm(txt, L.terms)) return;
      var ex = {};
      daysOfProg(t).forEach(function (d) { (d.exercises || []).forEach(function (e) { if (e && e.name && L.rx.test(e.name)) ex[e.name] = 1; }); });
      var list = Object.keys(ex);
      if (list.length) out.push({ tag: L.tag, ex: list });
    });
    return out;
  }

  /* ---------- פעילות אחרונה ---------- */
  function lastAct(t, st, env) {
    var d = '';
    function mark(x) { x = String(x || '').slice(0, 10); if (x && x > d) d = x; }
    (t.weighins || []).forEach(function (w) { mark(w.date); });
    (st.sessions || []).forEach(function (s) { if (s.traineeId === t.id && s.status === 'done') mark(s.date); });
    (st.measures || []).forEach(function (m) { if (m.traineeId === t.id) mark(m.date); });
    (env.logs || []).forEach(function (l) { if ((l.trainee_id || l.traineeId) === t.id) mark(l.date); });
    return d;
  }
  function weightsOf(t, st) {
    var w = [];
    (t.weighins || []).forEach(function (x) { if (num(x.weight) > 0) w.push({ d: String(x.date).slice(0, 10), w: num(x.weight) }); });
    (st.measures || []).forEach(function (m) { if (m.traineeId === t.id && num(m.weight) > 0) w.push({ d: String(m.date).slice(0, 10), w: num(m.weight) }); });
    return w.sort(function (a, b) { return a.d < b.d ? -1 : 1; });
  }
  function goalDir(t) {
    var e = String(t.macroGoal || '');
    if (e === 'cut' || e === 'mass' || e === 'keep') return e;
    var s = String(t.goal || '') + ' ' + String(t.notes || '');
    return /מסה|מסת שריר|היפרטרופ|לעלות/.test(s) ? 'mass' : /חיטוב|ירידה|לרזות|שומן|להחטיב/.test(s) ? 'cut' : 'keep';
  }

  /* =====================================================================
     הבדיקות. כל פונקציה מחזירה רשימת ממצאים:
     { w, id, key, sev, title, text, ids, act, ok }
     title קבוע ובלי שמות (הוא מה שמותר לשלוח לצ׳אט); text לתצוגה בלבד.
     ===================================================================== */
  function mk(w, id, sev, title, text, ts, act, ok) {
    var ids = (ts || []).map(function (t) { return typeof t === 'string' ? t : t.id; });
    return { w: w, id: id, sev: sev, title: title, text: text || '', ids: ids, n: ids.length,
             key: id + '|' + ids.slice().sort().join(','), act: act || null, ok: !!ok };
  }

  function bizOf(st) { return Object.assign({}, BIZ_DEFAULT, (st.settings && st.settings.biz) || {}); }
  function paysOf(st) { return (st.payments || []).filter(function (p) { return p && num(p.amount) > 0 && p.date; }); }

  function finance(st, env) {
    var f = [], B = bizOf(st), today = env.today, mon = monOf(today), year = today.slice(0, 4);
    var pays = paysOf(st), money = env.money || money0;
    var act = (st.trainees || []).filter(isActive);
    var pkgOf = env.pkgOf || function (t) { return t.pkg ? { price: num(t.pkg.price), monthly: t.pkg.k === 'coach' } : null; };
    var pkgPaid = env.pkgPaid || function (t, m) {
      var mine = pays.filter(function (p) { return p.traineeId === t.id; }), p0 = pkgOf(t);
      if (p0 && !p0.monthly) return mine[0] || null;          // תוכנית חד-פעמית: כל תשלום נחשב
      return mine.filter(function (p) { return monOf(p.date) === m; })[0] || null;
    };

    /* תקרת עוסק פטור: רק מה שנרשם באפליקציה נספר, ולכן הניסוח זהיר */
    var ytd = pays.filter(function (p) { return p.date.slice(0, 4) === year; }).reduce(function (a, p) { return a + num(p.amount); }, 0);
    if (!B.type) {
      f.push(mk('finance', 'fin_setup', 'wait', 'לא הוגדר סוג העוסק',
        'בלי לדעת אם אתה עוסק פטור או מורשה אי אפשר לעקוב אחרי התקרה.', [], { k: 'set', label: 'פרטי העסק' }));
    } else if (B.type === 'patur' && num(B.ceiling) > 0) {
      var pct = ytd / num(B.ceiling);
      var firstPay = pays.filter(function (p) { return p.date.slice(0, 4) === year; }).map(function (p) { return p.date; }).sort()[0];
      var span = firstPay ? Math.max(30, daysBetween(firstPay, today) + 1) : 0;
      var yearly = span ? ytd / span * 365 : 0;
      var base = 'נרשמו השנה ' + money(ytd) + ' מתוך תקרה של ' + money(B.ceiling) + ' (' + Math.round(pct * 100) + '%).';
      if (pct >= 1) f.push(mk('finance', 'fin_ceiling', 'pain', 'המחזור עבר את תקרת עוסק פטור', base + ' צריך לדבר עם רואה החשבון עוד היום.', [], { k: 'report', label: 'דוח לרואה החשבון' }));
      else if (pct >= 0.8) f.push(mk('finance', 'fin_ceiling', 'wait', 'המחזור מתקרב לתקרת עוסק פטור', base + ' נשארו ' + money(num(B.ceiling) - ytd) + '. לתאם עם רואה החשבון לפני התשלום שחוצה.', [], { k: 'report', label: 'דוח לרואה החשבון' }));
      else if (yearly >= num(B.ceiling)) f.push(mk('finance', 'fin_runrate', 'wait', 'בקצב הנוכחי שנה מלאה תעבור את התקרה',
        base + ' הקצב מאז התשלום הראשון שנרשם שווה בערך ' + money(yearly) + ' לשנה.', [], { k: 'report', label: 'דוח לרואה החשבון' }));
    }

    /* לא שילמו החודש: אותו כלל של מסך התשלומים, ורק אחרי יום התשלום */
    var day = Number(today.slice(8, 10));
    var unpaid = act.filter(function (t) {
      var p = pkgOf(t); if (!p) return false;
      var got = pkgPaid(t, mon);
      var due = p.monthly || !got || monOf(got.date) === mon;
      return due && !got;
    });
    if (unpaid.length && day > num(B.payDay || 10)) {
      var sum = unpaid.reduce(function (a, t) { var p = pkgOf(t); return a + (p ? num(p.price) : 0); }, 0);
      f.push(mk('finance', 'fin_unpaid', 'wait', 'לא שילמו החודש',
        nT(unpaid.length) + ', ' + money(sum) + ': ' + namesOf(unpaid) + '.', unpaid, { k: 'go', v: 'money', label: 'למסך התשלומים' }));
    }
    if (!pays.some(function (p) { return monOf(p.date) === mon; }) && day > 5 && act.length) {
      f.push(mk('finance', 'fin_none_month', 'wait', 'לא נרשם אף תשלום החודש',
        'ייתכן ששילמו ולא סימנת. בלי רישום אין מעקב ואין דוח.', [], { k: 'go', v: 'money', label: 'למסך התשלומים' }));
    }

    /* חודשים חסרים בליווי חודשי: רק בין התשלום הראשון לחודש שעבר */
    var gapT = [], gapSum = 0;
    act.forEach(function (t) {
      var p = pkgOf(t); if (!p || !p.monthly) return;
      var mine = pays.filter(function (x) { return x.traineeId === t.id; }).map(function (x) { return monOf(x.date); });
      if (!mine.length) return;
      var have = {}; mine.forEach(function (m) { have[m] = 1; });
      var m = mine.slice().sort()[0], miss = 0, guard = 0;
      while (m < mon && guard++ < 36) { if (!have[m]) miss++; m = prevMon(m, -1); }
      if (miss) { gapT.push(t); gapSum += miss * num(p.price); }
    });
    if (gapT.length) f.push(mk('finance', 'fin_gap', 'pain', 'חודשים שלא שולמו בליווי חודשי',
      nT(gapT.length) + ', בערך ' + money(gapSum) + ': ' + namesOf(gapT) + '.', gapT, { k: 'go', v: 'money', label: 'למסך התשלומים' }, true));

    /* חשד לכפילות: אותו מתאמן ואותו סכום בתוך 10 ימים */
    var dupT = {}, byT = {};
    pays.forEach(function (p) { (byT[p.traineeId] = byT[p.traineeId] || []).push(p); });
    Object.keys(byT).forEach(function (id) {
      var a = byT[id].slice().sort(function (x, y) { return x.date < y.date ? -1 : 1; });
      for (var i = 1; i < a.length; i++) {
        var gap = daysBetween(a[i - 1].date, a[i].date);
        if (num(a[i].amount) === num(a[i - 1].amount) && gap !== null && gap <= 10 && daysBetween(a[i].date, today) <= 60) dupT[id] = 1;
      }
    });
    var dups = (st.trainees || []).filter(function (t) { return dupT[t.id]; });
    if (dups.length) f.push(mk('finance', 'fin_dup', 'wait', 'חשד לתשלום שנרשם פעמיים',
      'אותו סכום פעמיים בתוך 10 ימים: ' + namesOf(dups) + '. לבדוק שלא נרשם בטעות.', dups, { k: 'go', v: 'money', label: 'למסך התשלומים' }, true));

    var noPay = act.filter(function (t) {
      return pkgOf(t) && !pays.some(function (p) { return p.traineeId === t.id; }) && t.joined && daysBetween(t.joined, today) > 14;
    });
    if (noPay.length) f.push(mk('finance', 'fin_pkg_nopay', 'wait', 'חבילה בלי אף תשלום',
      namesOf(noPay) + ' התחילו לפני יותר משבועיים ואין להם תשלום רשום.', noPay, { k: 'go', v: 'money', label: 'למסך התשלומים' }, true));

    var noPkg = act.filter(function (t) { return !pkgOf(t); });
    if (noPkg.length) f.push(mk('finance', 'fin_nopkg', 'info', 'מתאמנים בלי חבילה מוגדרת',
      nT(noPkg.length) + ' בלי חבילה, ולכן אי אפשר לדעת כמה הם אמורים לשלם: ' + namesOf(noPkg) + '.', noPkg, null, true));

    var payCat = env.payCat || function (p) { return p.category || ''; };
    var bare = pays.filter(function (p) { return daysBetween(p.date, today) <= 90 && (!p.method || !payCat(p)); });
    if (bare.length) f.push(mk('finance', 'fin_fields', 'info', 'תשלומים בלי אמצעי תשלום או קטגוריה',
      nP(bare.length) + ' מ-90 הימים האחרונים. רואה החשבון יבקש את הפרטים האלה.', [], { k: 'go', v: 'money', label: 'למסך התשלומים' }, true));

    if (day <= 7) f.push(mk('finance', 'fin_close', 'info', 'סגירת החודש שעבר',
      'לוודא שיצאה קבלה על כל תשלום של ' + monName(prevMon(mon)) + ' ולשלוח את הדוח לרואה החשבון.', [], { k: 'report', label: 'דוח לרואה החשבון' }));
    if (today.slice(5) >= '11-15') f.push(mk('finance', 'fin_yearend', 'info', 'סוף שנת המס מתקרב',
      'לתאם עם רואה החשבון את סגירת השנה ואת ההצהרה השנתית. הדוח השנתי מוכן כאן.', [], { k: 'report', label: 'דוח לרואה החשבון' }));
    return f;
  }

  function legal(st, env) {
    var f = [], B = bizOf(st), today = env.today;
    var live = (st.trainees || []).filter(notArch);
    var act = live.filter(isActive);

    var yes = live.filter(function (t) { return anyYes(t) && !(healthObj(t) || {}).certFile; });
    if (yes.length) f.push(mk('legal', 'legal_yes', 'pain', 'ענו "כן" בהצהרת הבריאות ואין אישור רופא',
      namesOf(yes) + '. לא מאמנים לפני אישור רופא בכתב.', yes, { k: 'go', v: 'health', label: 'לסינון הבריאות' }));

    var contra = [], why = {};
    live.forEach(function (t) { if (!allNo(t)) return; var g = medGroups(t); if (g.length) { contra.push(t); why[t.id] = g; } });
    if (contra.length) f.push(mk('legal', 'legal_contra', 'pain', 'סתירה בין השאלון להצהרת הבריאות',
      contra.map(function (t) { return (t.name || '') + ' (' + why[t.id].join(', ') + ')'; }).join('; ')
      + '. בשאלון כתבו על בעיה, ובהצהרה סימנו "לא" על הכול. לברר איתם ולבקש הצהרה מתוקנת.', contra,
      { k: 'msg', label: 'הודעה מוכנה', tpl: 'היי {name}, עברתי על הצהרת הבריאות שלך. בשאלון ההיכרות כתבת על מצב רפואי, ובהצהרה סימנת "לא" על כל השאלות. חשוב לי שזה יהיה מדויק לפני שממשיכים להתאמן. אפשר לעדכן את ההצהרה בדף האישי שלך? תודה, BAUER POWER' }, true));

    var noDecl = act.filter(function (t) { return !signed(t); });
    if (noDecl.length) f.push(mk('legal', 'legal_nodecl', 'pain', 'מתאמנים בלי הצהרת בריאות חתומה',
      nT(noDecl.length) + ': ' + namesOf(noDecl, 10) + '.', noDecl,
      { k: 'msg', label: 'הודעה מוכנה', tpl: 'היי {name}, לפני האימון הבא אני צריך שתמלא את הצהרת הבריאות בדף האישי שלך. זה לוקח דקה. תודה, BAUER POWER' }));

    var minors = live.filter(function (t) { var a = ageOf(t, today); return a !== null && a < 18; });
    if (minors.length) f.push(mk('legal', 'legal_minor', 'pain', 'קטינים: צריך אישור הורה בכתב',
      namesOf(minors) + '. לשמור אישור חתום של הורה, ולסמן "טופל" כשיש.', minors, null, true));

    var months = num(B.declMonths) || 24;
    var old = live.filter(function (t) {
      var h = healthObj(t); if (!h || !h.signedAt) return false;
      var d = daysBetween(h.signedAt, today); return d !== null && d > months * 30.4;
    });
    if (old.length) f.push(mk('legal', 'legal_old', 'wait', 'הצהרות בריאות שהגיע זמן לחדש',
      namesOf(old) + '. עברו יותר מ-' + months + ' חודשים מהחתימה.', old,
      { k: 'msg', label: 'הודעה מוכנה', tpl: 'היי {name}, עבר זמן מאז שחתמת על הצהרת הבריאות. אפשר לחדש אותה בדף האישי שלך? תודה, BAUER POWER' }));

    var noCons = live.filter(function (t) { var h = healthObj(t); return h && h.signedAt && !(h.consent && h.consent.at); });
    if (noCons.length) f.push(mk('legal', 'legal_consent', 'wait', 'מידע רפואי בלי הסכמה מתועדת',
      namesOf(noCons) + '. ההצהרה נחתמה לפני שנוספה הסכמת הפרטיות. לבקש מהם לחתום שוב.', noCons, null, true));

    var noTerms = act.filter(function (t) { return (t._token || t._username) && !t.termsAccepted; });
    if (noTerms.length) f.push(mk('legal', 'legal_terms', 'wait', 'לא אישרו את התקנון',
      nT(noTerms.length) + ': ' + namesOf(noTerms, 10) + '.', noTerms,
      { k: 'msg', label: 'הודעה מוכנה', tpl: 'היי {name}, כשתיכנס לדף האישי שלך יופיע התקנון של BAUER POWER. צריך לאשר אותו כדי להמשיך. תודה!' }));

    var open = (st.trainees || []).filter(function (t) { return t.status === 'archived' && t._tokenActive; });
    if (open.length) f.push(mk('legal', 'legal_access', 'wait', 'גישה פתוחה למי שכבר לא מתאמן',
      namesOf(open) + ' בארכיון, והקישור האישי שלהם עדיין פעיל.', open, { k: 'go', v: 'access', label: 'לגישת מתאמנים' }));

    function docCheck(key, id, name) {
      var until = B[key];
      if (!until) { if (key === 'insuranceUntil') f.push(mk('legal', id, 'wait', 'לא רשום תוקף ' + name, 'כדאי לרשום עד מתי הביטוח בתוקף, ואזכיר לך חודש לפני.', [], { k: 'set', label: 'פרטי העסק' })); return; }
      var d = daysBetween(today, until);
      if (d === null) return;
      if (d < 0) f.push(mk('legal', id, 'pain', name + ' לא בתוקף', 'פג ב-' + heDate(until) + '.', [], { k: 'set', label: 'פרטי העסק' }));
      else if (d <= 30) f.push(mk('legal', id, 'wait', name + ' פג בקרוב', 'בתוקף עד ' + heDate(until) + ' (עוד ' + d + ' ימים).', [], { k: 'set', label: 'פרטי העסק' }));
    }
    docCheck('insuranceUntil', 'legal_ins', 'ביטוח אחריות מקצועית');
    docCheck('certUntil', 'legal_cert', 'תעודת המאמן');
    return f;
  }

  function coaching(st, env) {
    var f = [], today = env.today;
    var act = (st.trainees || []).filter(isActive);

    if (env.screen) {
      var red = act.filter(function (t) {
        var r; try { r = env.screen(t); } catch (e) { r = null; }
        return r && r.needsClearance && daysOfProg(t).length;
      });
      if (red.length) f.push(mk('coaching', 'co_red', 'pain', 'יש תוכנית פעילה למי שצריך אישור רופא',
        namesOf(red) + '. הסינון הרפואי מסמן אותם באדום ואין אישור רשום.', red, { k: 'go', v: 'health', label: 'לסינון הבריאות' }));
    }

    var risky = [], rtxt = [];
    act.forEach(function (t) {
      var r = riskyFor(t); if (!r.length) return;
      risky.push(t);
      rtxt.push((t.name || '') + ': ' + r.map(function (x) { return x.tag + ' — ' + x.ex.slice(0, 4).join(', ') + (x.ex.length > 4 ? ' ועוד' : ''); }).join('; '));
    });
    if (risky.length) f.push(mk('coaching', 'co_limit', 'pain', 'מגבלה ותרגיל שמעמיס עליה',
      rtxt.join(' | ') + '. להחליף בתרגיל נתמך, או לסמן "טופל" אם כבר התאמת.', risky, null, true));

    var painT = {};
    (env.logs || []).forEach(function (l) {
      if (!l || !l.note || daysBetween(l.date, today) > 14) return;
      if (anyTerm(l.note, ['כאב', 'כאבים', 'כואב', 'כואבת', 'נתפס', 'נתפסה', 'פציעה', 'נפצעתי', 'סחרחורת', 'צריבה'])) painT[l.trainee_id || l.traineeId] = 1;
    });
    var pains = act.filter(function (t) { return painT[t.id]; });
    if (pains.length) f.push(mk('coaching', 'co_pain', 'pain', 'דיווח על כאב באימון בשבועיים האחרונים',
      namesOf(pains) + '. לקרוא את ההערה בכרטיס ולדבר איתם לפני האימון הבא.', pains, null, true));

    var low = act.filter(function (t) {
      var k = num(t.program && t.program.targets && t.program.targets.kcal); if (!k) return false;
      return k < (t.gender === 'נקבה' ? 1200 : 1500);
    });
    if (low.length) f.push(mk('coaching', 'co_kcal', 'pain', 'יעד קלוריות נמוך מדי',
      namesOf(low) + '. מתחת ל-1,200 לאישה או 1,500 לגבר. לבדוק גובה, משקל ומטרה בכרטיס.', low, null, true));

    var noProg = act.filter(function (t) { return !daysOfProg(t).length; });
    if (noProg.length) f.push(mk('coaching', 'co_noprog', 'wait', 'מתאמנים בלי תוכנית',
      namesOf(noProg) + '.', noProg));

    var noTarget = act.filter(function (t) { return daysOfProg(t).length && !num(t.program.targets && t.program.targets.kcal); });
    if (noTarget.length) f.push(mk('coaching', 'co_notarget', 'wait', 'חסרים יעדי תזונה',
      namesOf(noTarget) + '. בדרך כלל חסר משקל, גובה, תאריך לידה או מין בכרטיס.', noTarget));

    var noW = [], staleW = [];
    act.forEach(function (t) {
      var w = weightsOf(t, st);
      if (!w.length) noW.push(t);
      else if (daysBetween(w[w.length - 1].d, today) > 21) staleW.push(t);
    });
    if (noW.length) f.push(mk('coaching', 'co_noweight', 'wait', 'אין אף שקילה', namesOf(noW) + '. בלי משקל אין יעדים ואין מעקב.', noW));
    if (staleW.length) f.push(mk('coaching', 'co_staleweight', 'info', 'לא נשקלו יותר משלושה שבועות', namesOf(staleW) + '.', staleW,
      { k: 'msg', label: 'הודעה מוכנה', tpl: 'היי {name}, מזמן לא ראיתי שקילה שלך. תעלה על המשקל מחר בבוקר ותעדכן בדף האישי? כך אדע אם אנחנו בכיוון.' }));

    var off = [];
    act.forEach(function (t) {
      var dir = goalDir(t); if (dir === 'keep') return;
      var w = weightsOf(t, st).filter(function (x) { return daysBetween(x.d, today) <= 56; });
      if (w.length < 3 || daysBetween(w[0].d, w[w.length - 1].d) < 14) return;
      var ch = w[w.length - 1].w - w[0].w;
      if ((dir === 'cut' && ch > 0.5) || (dir === 'mass' && ch < -0.5)) off.push(t);
    });
    if (off.length) f.push(mk('coaching', 'co_trend', 'wait', 'המשקל זז נגד המטרה',
      namesOf(off) + '. בחיטוב המשקל עלה, או במסה הוא ירד, לאורך שבועיים ומעלה.', off, null, true));

    var tired = act.filter(function (t) {
      var a = (t.intake && t.intake.answers) || {};
      return (num(a.sleepHours) > 0 && num(a.sleepHours) < 6) || num(a.stress) >= 8;
    });
    if (tired.length) f.push(mk('coaching', 'co_recovery', 'info', 'מעט שינה או סטרס גבוה בשאלון',
      namesOf(tired) + '. לשקול פחות נפח ויותר מנוחה בין סטים.', tired, null, true));
    return f;
  }

  function growth(st, env) {
    var f = [], B = bizOf(st), today = env.today;
    var act = (st.trainees || []).filter(isActive);

    /* בלי יומני האימון אי אפשר לדעת מי פעיל. לא מכריזים על אף אחד
       כ"נעלם" לפני שהם נטענו. */
    if (env.logs) {
      var gone = [], cool = [], stuck = [];
      act.forEach(function (t) {
        var since = t.joined ? daysBetween(t.joined, today) : null;
        var la = lastAct(t, st, env), idle = la ? daysBetween(la, today) : null;
        if (since !== null && since <= 14) { if (since >= 3 && !la) stuck.push(t); return; }
        if (idle === null || idle >= 21) gone.push(t);
        else if (idle >= 10) cool.push(t);
      });
      if (gone.length) f.push(mk('growth', 'gr_gone', 'pain', 'שקטים שלושה שבועות ומעלה',
        nT(gone.length) + ' בלי אימון, שקילה או פגישה: ' + namesOf(gone, 8) + '.', gone,
        { k: 'msg', label: 'הודעה מוכנה', tpl: 'היי {name}, שמתי לב שעבר זמן מאז האימון האחרון שלך. הכול בסדר? אם משהו בתוכנית לא מסתדר לך, תגיד ונתאים אותה. אני כאן. BAUER POWER' }));
      if (cool.length) f.push(mk('growth', 'gr_cool', 'wait', 'מתחילים להתקרר',
        namesOf(cool, 8) + '. 10 ימים ומעלה בלי פעילות.', cool,
        { k: 'msg', label: 'הודעה מוכנה', tpl: 'היי {name}, איך הולך השבוע? ראיתי שלא סימנת אימון כמה ימים. מה היום הקרוב שאתה מתאמן בו?' }));
      if (stuck.length) f.push(mk('growth', 'gr_onboard', 'wait', 'חדשים שעוד לא עשו צעד ראשון',
        namesOf(stuck) + '. הצטרפו בשבועיים האחרונים ואין אימון או שקילה.', stuck,
        { k: 'msg', label: 'הודעה מוכנה', tpl: 'היי {name}, התוכנית שלך מחכה בדף האישי. מתי האימון הראשון? אם משהו לא ברור שם, תכתוב לי.' }));

      var cnt = {};
      env.logs.forEach(function (l) { if (daysBetween(l.date, today) <= 28) { var id = l.trainee_id || l.traineeId; cnt[id] = (cnt[id] || 0) + 1; } });
      var stars = act.filter(function (t) { return (cnt[t.id] || 0) >= 10; });
      if (stars.length) f.push(mk('growth', 'gr_referral', 'info', 'זמן טוב לבקש המלצה',
        namesOf(stars) + '. 10 אימונים ומעלה בארבעה שבועות.', stars,
        { k: 'msg', label: 'הודעה מוכנה', tpl: 'היי {name}, רציתי להגיד שאתה עובד מצוין בחודש האחרון. אם יש לך חבר שמחפש מאמן, אשמח שתחבר בינינו. ואם בא לך לכתוב כמה מילים על התהליך, זה יעזור לי מאוד.' }, true));
    } else {
      f.push(mk('growth', 'gr_wait', 'info', 'יומני האימון עוד לא נטענו',
        'כדי לדעת מי מתקרר צריך חיבור לשרת. הבדיקות האלה יופיעו כשהנתונים יגיעו.', []));
    }

    if (env.planOf) {
      var ended = [], soon = [];
      act.forEach(function (t) {
        var p; try { p = env.planOf(t); } catch (e) { p = null; }
        if (!p) return;
        if (p.ended) ended.push(t); else if (num(p.left) <= 2) soon.push(t);
      });
      if (ended.length) f.push(mk('growth', 'gr_ended', 'pain', 'התקופה הסתיימה בלי החלטה',
        namesOf(ended) + '. לקבוע שיחת סיכום והמשך.', ended,
        { k: 'msg', label: 'הודעה מוכנה', tpl: 'היי {name}, סיימנו את התקופה שקבענו. בוא נקבע שיחה קצרה: מה השגנו, ומה המטרה לתקופה הבאה. מתי נוח לך?' }));
      if (soon.length) f.push(mk('growth', 'gr_renew', 'wait', 'מסיימים תקופה בשבועיים הקרובים',
        namesOf(soon) + '. הזמן לדבר על המשך הוא לפני הסיום.', soon,
        { k: 'msg', label: 'הודעה מוכנה', tpl: 'היי {name}, אנחנו מתקרבים לסוף התקופה. רוצה שנעבור יחד על מה שהשגת ונתכנן את ההמשך? מתי נוח לך לדבר?' }));
    }

    var bday = act.filter(function (t) {
      if (!t.birth) return false;
      for (var i = 0; i < 7; i++) if (addD(today, i).slice(5) === String(t.birth).slice(5, 10)) return true;
      return false;
    });
    if (bday.length) f.push(mk('growth', 'gr_bday', 'info', 'ימי הולדת השבוע', namesOf(bday) + '.', bday,
      { k: 'msg', label: 'הודעה מוכנה', tpl: 'מזל טוב {name}! שתהיה שנה חזקה ובריאה. BAUER POWER' }, true));

    var max = num(B.maxTrainees);
    if (max > 0 && act.length >= max * 0.9) f.push(mk('growth', 'gr_capacity', 'wait', 'קרוב לתפוסה מלאה',
      act.length + ' פעילים מתוך ' + max + ' שקבעת. זמן לשקול רשימת המתנה או העלאת מחיר למצטרפים חדשים.', []));
    return f;
  }

  function ops(st, env) {
    var f = [], today = env.today;
    var live = (st.trainees || []).filter(notArch), act = live.filter(isActive);

    if (env.sync) {
      if (env.sync.state === 'out') f.push(mk('ops', 'ops_sync', 'pain', 'המכשיר הזה לא מחובר לחשבון',
        'מה שאתה רואה הוא עותק שמור, ושינויים לא עולים לשרת. צריך להתחבר.', []));
      else if (env.sync.error) f.push(mk('ops', 'ops_sync', 'pain', 'הסנכרון נכשל', 'השינויים האחרונים נשמרו רק במכשיר הזה. לבדוק את החיבור בהגדרות.', [], { k: 'go', v: 'settings', label: 'להגדרות' }));
      else if (env.sync.at && daysBetween(String(env.sync.at).slice(0, 10), today) >= 2) f.push(mk('ops', 'ops_sync_old', 'wait', 'הסנכרון האחרון היה לפני יומיים ומעלה', 'לפתוח את האפליקציה עם רשת ולוודא שהיא מתעדכנת.', []));
    }
    if (env.backupDays !== undefined) {
      if (env.backupDays === null) f.push(mk('ops', 'ops_backup', 'wait', 'עוד לא נעשה גיבוי מהמכשיר הזה', 'גיבוי אחד לקובץ שומר עליך מפני טעות או תקלה.', [], { k: 'go', v: 'settings', label: 'להגדרות' }));
      else if (env.backupDays > 7) f.push(mk('ops', 'ops_backup', env.backupDays > 30 ? 'pain' : 'wait', 'הגיבוי האחרון ישן',
        'עברו ' + env.backupDays + ' ימים מהגיבוי האחרון.', [], { k: 'go', v: 'settings', label: 'להגדרות' }));
    }

    var miss = { 'טלפון': [], 'תאריך לידה': [], 'גובה': [], 'מין': [] };
    act.forEach(function (t) {
      var ph = String(t.phone || '').replace(/\D/g, '');
      if (ph.length < 9) miss['טלפון'].push(t);
      if (!t.birth) miss['תאריך לידה'].push(t);
      if (!num(t.height)) miss['גובה'].push(t);
      if (!t.gender) miss['מין'].push(t);
    });
    var mAll = {}, mTxt = [];
    Object.keys(miss).forEach(function (k) { if (miss[k].length) { mTxt.push(k + ': ' + namesOf(miss[k], 4)); miss[k].forEach(function (t) { mAll[t.id] = t; }); } });
    if (mTxt.length) f.push(mk('ops', 'ops_basics', 'wait', 'פרטי בסיס חסרים בכרטיסים', mTxt.join(' | ') + '.', Object.keys(mAll).map(function (k) { return mAll[k]; })));

    var debris = live.filter(function (t) {
      var n = String(t.name || ''), g = String(t.goal || '').trim();
      return /^[_\s]/.test(n) || /\s{2,}/.test(n) || (g && (/^[\/(\)]/.test(g) || g.length < 3));
    });
    if (debris.length) f.push(mk('ops', 'ops_debris', 'wait', 'שמות או מטרות משובשים', namesOf(debris) + '. שם עם תו מיותר, או מטרה שהיא שארית מהשאלון.', debris));

    var noGoal = act.filter(function (t) { return !String(t.goal || '').trim(); });
    if (noGoal.length) f.push(mk('ops', 'ops_nogoal', 'info', 'בלי מטרה בכרטיס', namesOf(noGoal) + '.', noGoal));

    var seenN = {}, seenP = {}, dupIds = {};
    live.forEach(function (t) {
      var n = String(t.name || '').replace(/[_\s]+/g, ' ').trim();
      var p = String(t.phone || '').replace(/\D/g, '');
      if (n) { if (seenN[n]) { dupIds[t.id] = t; dupIds[seenN[n].id] = seenN[n]; } else seenN[n] = t; }
      if (p.length >= 9) { if (seenP[p]) { dupIds[t.id] = t; dupIds[seenP[p].id] = seenP[p]; } else seenP[p] = t; }
    });
    var dd = Object.keys(dupIds).map(function (k) { return dupIds[k]; });
    if (dd.length) f.push(mk('ops', 'ops_dup', 'wait', 'כרטיסים עם אותו שם או אותו טלפון', namesOf(dd) + '. לבדוק אם זה כפול או טעות הקלדה.', dd, null, true));

    var bad = live.filter(function (t) {
      var h = num(t.height), p = String(t.phone || '').replace(/\D/g, '');
      if (h && (h < 120 || h > 230)) return true;
      if (p && !/^(0\d{8,9}|972\d{8,9})$/.test(p)) return true;
      return false;
    });
    if (bad.length) f.push(mk('ops', 'ops_values', 'wait', 'גובה או טלפון שנראים שגויים', namesOf(bad) + '.', bad, null, true));

    var empty = act.filter(function (t) {
      return !daysOfProg(t).length && !t.intake && !(st.payments || []).some(function (p) { return p.traineeId === t.id; })
        && t.joined && daysBetween(t.joined, today) > 7;
    });
    if (empty.length) f.push(mk('ops', 'ops_empty', 'wait', 'כרטיסים ריקים', namesOf(empty) + '. בלי תוכנית, שאלון או תשלום כבר יותר משבוע. למלא או להעביר לארכיון.', empty, null, true));

    var messy = act.filter(function (t) {
      var d = daysOfProg(t); if (!d.length) return false;
      var names = {}, dupName = false;
      d.forEach(function (x) { var n = String(x.name || '').trim(); if (n && names[n]) dupName = true; names[n] = 1; });
      var hollow = d.some(function (x) { return !(x.exercises || []).length && !String(x.note || '').trim(); });
      return d.length > 7 || dupName || hollow;
    });
    if (messy.length) f.push(mk('ops', 'ops_prog', 'wait', 'תוכניות שצריך לסדר', namesOf(messy) + '. יום ריק, שני ימים באותו שם, או יותר משבעה ימים.', messy, null, true));

    if (env.hasKey === false) f.push(mk('ops', 'ops_key', 'info', 'הצ׳אט עם הצוות כבוי',
      'בלי מפתח Claude הבדיקות עובדות כרגיל, אבל אי אפשר לשאול שאלות חופשיות.', [], { k: 'go', v: 'settings', label: 'להגדרות' }));
    return f;
  }

  var RUN = { finance: finance, legal: legal, coaching: coaching, growth: growth, ops: ops };

  function analyze(st, env) {
    st = st || {}; env = env || {}; env.today = env.today || isoOf(new Date());
    var okMap = (st.settings && st.settings.teamOk) || {};
    var by = {}, all = [];
    WORKERS.forEach(function (w) {
      var list = [];
      try { list = RUN[w.id](st, env) || []; }
      catch (e) { list = [mk(w.id, w.id + '_err', 'info', 'הבדיקה נכשלה', String((e && e.message) || e), [])]; }
      list = list.filter(function (x) { return !okMap[x.key]; })
                 .sort(function (a, b) { return SEV[a.sev] - SEV[b.sev]; });
      by[w.id] = list; all = all.concat(list);
    });
    var order = {}; WORKERS.forEach(function (w, i) { order[w.id] = i; });
    var brief = all.filter(function (x) { return x.sev !== 'info'; })
      .sort(function (a, b) { return (SEV[a.sev] - SEV[b.sev]) || (order[a.w] - order[b.w]); });
    return { by: by, all: all, brief: brief,
             pain: all.filter(function (x) { return x.sev === 'pain'; }).length,
             wait: all.filter(function (x) { return x.sev === 'wait'; }).length };
  }

  /* ---------- דוח לרואה החשבון ---------- */
  function report(st, env) {
    env = env || {}; var today = env.today || isoOf(new Date()), year = today.slice(0, 4);
    var pays = paysOf(st).filter(function (p) { return p.date.slice(0, 4) === year; });
    var name = {}; (st.trainees || []).forEach(function (t) { name[t.id] = t.name; });
    var biz = (st.settings && st.settings.business) || 'BAUER POWER';
    var byM = {}, byMeth = {}, tot = 0;
    pays.forEach(function (p) {
      var m = monOf(p.date); (byM[m] = byM[m] || []).push(p);
      var k = p.method || 'לא צוין'; byMeth[k] = (byMeth[k] || 0) + num(p.amount); tot += num(p.amount);
    });
    var L = ['דוח הכנסות ' + year + ' — ' + biz, 'הופק ב-' + heDate(today) + ' מתוך רישום התשלומים באפליקציה.', ''];
    L.push('סיכום לפי חודש:');
    Object.keys(byM).sort().forEach(function (m) {
      L.push(monName(m) + ': ' + money0(byM[m].reduce(function (a, p) { return a + num(p.amount); }, 0)) + ' (' + nP(byM[m].length) + ')');
    });
    L.push('סה״כ ' + year + ': ' + money0(tot) + ' (' + nP(pays.length) + ')', '');
    L.push('לפי אמצעי תשלום:');
    Object.keys(byMeth).forEach(function (k) { L.push(k + ': ' + money0(byMeth[k])); });
    L.push('', 'פירוט (תאריך, שם, סכום, אמצעי, קטגוריה):');
    pays.slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; }).forEach(function (p) {
      L.push([heDate(p.date), name[p.traineeId] || 'לא ידוע', money0(num(p.amount)), p.method || '-', p.category || p.note || '-'].join(', '));
    });
    return L.join('\n');
  }

  /* ---------- שאלות מהירות: תשובה מהחוקים, בלי מודל ---------- */
  var QUICK = {
    finance: [{ id: 'ytd', q: 'כמה הכנסתי השנה?' }, { id: 'unpaid', q: 'מי לא שילם החודש?' }, { id: 'months', q: 'כמה נכנס בכל חודש?' }, { id: 'report', q: 'דוח לרואה החשבון' }],
    legal: [{ id: 'nodecl', q: 'מי לא חתום על הצהרת בריאות?' }, { id: 'doctor', q: 'ממי אני צריך אישור רופא?' }, { id: 'minors', q: 'יש אצלי קטינים?' }, { id: 'promo', q: 'מותר לשלוח מבצע לכולם בווטסאפ?' }],
    coaching: [{ id: 'risk', q: 'למי יש מגבלה ותרגיל מסוכן?' }, { id: 'newprog', q: 'מי צריך תוכנית?' }, { id: 'trend', q: 'מי לא מתקדם לפי המטרה?' }, { id: 'targets', q: 'למי חסרים יעדי תזונה?' }],
    growth: [{ id: 'churn', q: 'מי בסיכון לעזוב?' }, { id: 'renew', q: 'מי מסיים תקופה?' }, { id: 'referral', q: 'ממי לבקש המלצה?' }, { id: 'today', q: 'למי לכתוב היום?' }],
    ops: [{ id: 'routine', q: 'מה סדר היום שלי?' }, { id: 'missing', q: 'מה חסר בכרטיסים?' }, { id: 'backup', q: 'מתי גיביתי בפעם האחרונה?' }, { id: 'dups', q: 'יש כפולים?' }]
  };
  var QMAP = {
    unpaid: ['fin_unpaid', 'fin_gap'], nodecl: ['legal_nodecl'], doctor: ['legal_yes', 'legal_contra'], minors: ['legal_minor'],
    risk: ['co_limit', 'co_red', 'co_pain'], newprog: ['co_noprog'], trend: ['co_trend'], targets: ['co_notarget', 'co_noweight'],
    churn: ['gr_gone', 'gr_cool', 'gr_wait'], renew: ['gr_ended', 'gr_renew'], referral: ['gr_referral', 'gr_wait'],
    today: ['gr_gone', 'gr_ended', 'gr_onboard', 'gr_cool', 'gr_renew', 'gr_bday'],
    missing: ['ops_basics', 'ops_nogoal', 'ops_debris', 'ops_values'], dups: ['ops_dup'], backup: ['ops_backup']
  };
  function ask(worker, qid, st, env) {
    env = env || {}; env.today = env.today || isoOf(new Date());
    var today = env.today, money = env.money || money0, pays = paysOf(st);
    if (qid === 'report') return report(st, env);
    if (qid === 'ytd') {
      var y = today.slice(0, 4), s = pays.filter(function (p) { return p.date.slice(0, 4) === y; }).reduce(function (a, p) { return a + num(p.amount); }, 0);
      var B = bizOf(st), out = 'נרשמו ב-' + y + ' תשלומים של ' + money(s) + '.';
      if (B.type === 'patur' && num(B.ceiling) > 0) out += ' התקרה של עוסק פטור שהגדרת היא ' + money(B.ceiling) + ', כלומר נשארו ' + money(Math.max(0, num(B.ceiling) - s)) + '.';
      return out + ' הסכום כולל רק מה שנרשם באפליקציה.';
    }
    if (qid === 'months') {
      var L = [], m = monOf(today);
      for (var i = 0; i < 6; i++) {
        var mm = i ? prevMon(m, i) : m;
        var x = pays.filter(function (p) { return monOf(p.date) === mm; });
        L.push(monName(mm) + ': ' + money(x.reduce(function (a, p) { return a + num(p.amount); }, 0)) + ' (' + x.length + ')');
      }
      return L.join('\n');
    }
    if (qid === 'promo') return 'הודעה שיווקית (מבצע, הצעה) דורשת הסכמה מראש של מי שמקבל אותה. הודעה אישית למתאמן על האימון שלו היא לא פרסומת. לפני שליחה גורפת לכל הרשימה, ובמיוחד למי שכבר לא מתאמן אצלך, כדאי לבדוק עם עורך דין. אני רשימת בדיקה, לא ייעוץ משפטי.';
    var A = analyze(st, env);
    if (qid === 'routine') {
      if (!A.brief.length) return 'אין היום שום דבר דחוף. יום טוב לעבודה על תוכן או על תוכניות.';
      return A.brief.slice(0, 5).map(function (x, i) { return (i + 1) + '. ' + x.title + (x.text ? ' — ' + x.text : ''); }).join('\n');
    }
    if (qid === 'backup') {
      if (env.backupDays === undefined) return 'אין לי גישה למידע על הגיבוי במכשיר הזה.';
      return env.backupDays === null ? 'מהמכשיר הזה עוד לא נעשה גיבוי.' : 'הגיבוי האחרון מהמכשיר הזה היה לפני ' + env.backupDays + ' ימים.';
    }
    var want = QMAP[qid] || [];
    var hit = A.all.filter(function (x) { return want.indexOf(x.id) > -1; });
    if (!hit.length) return 'בדקתי, ואין כרגע אף אחד כזה.';
    return hit.map(function (x) { return x.title + ': ' + x.text; }).join('\n\n');
  }

  /* =====================================================================
     פרטיות: קודים במקום שמות
     ===================================================================== */
  function tokenFor(map, id) {
    for (var k in map.t) if (map.t[k] === id) return k;
    map.seq = (map.seq || 0) + 1;
    var tok = 'מתאמן-' + pad(map.seq);
    map.t[tok] = id; return tok;
  }
  function escRx(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  /* מחליף שמות מלאים ושמות פרטיים בקודים. שם פרטי ששייך לשניים
     הופך ל"מתאמן" סתם: עדיף תשובה פחות מדויקת מאשר שם שיוצא החוצה. */
  function mask(text, st, map) {
    var out = String(text == null ? '' : text), list = [], firsts = {};
    (st.trainees || []).forEach(function (t) {
      var n = String(t.name || '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim(); if (!n) return;
      list.push({ n: n, tok: tokenFor(map, t.id) });
      var fn = first(n); if (fn && fn !== n) (firsts[fn] = firsts[fn] || []).push(t.id);
    });
    Object.keys(firsts).forEach(function (fn) {
      if (fn.length < 2) return;
      list.push({ n: fn, tok: firsts[fn].length === 1 ? tokenFor(map, firsts[fn][0]) : 'מתאמן' });
    });
    list.sort(function (a, b) { return b.n.length - a.n.length; });
    list.forEach(function (x) {
      var rx = new RegExp('(^|[^א-ת\\d-])([ובלמהשכ]{0,2})' + escRx(x.n).replace(/ /g, '\\s+') + '(?![א-ת])', 'g');
      out = out.replace(rx, function (m, pre, pf) { return pre + pf + x.tok; });
    });
    out = out.replace(/(?:\+?972|0)[\d\- ]{8,12}\d/g, '[טלפון]');
    out = out.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[אימייל]');
    return out;
  }
  function unmask(text, st, map) {
    var name = {}; (st.trainees || []).forEach(function (t) { name[t.id] = t.name; });
    return String(text == null ? '' : text).replace(/מתאמן-(\d{2,})/g, function (m) {
      var id = map.t[m]; return (id && name[id]) ? name[id] : m;
    });
  }

  /* מה שנשלח למודל: מספרים, כותרות קבועות וקודים. בלי text של ממצא
     (יש בו שמות), בלי מטרות, הערות, שאלונים או הצהרות. */
  function context(st, worker, env, map) {
    env = env || {}; env.today = env.today || isoOf(new Date());
    var A = analyze(st, env), today = env.today, pays = paysOf(st), ts = st.trainees || [];
    var ctx = {
      today: today,
      trainees: { active: ts.filter(isActive).length, paused: ts.filter(function (t) { return t.status === 'paused'; }).length,
                  archived: ts.filter(function (t) { return t.status === 'archived'; }).length },
      findings: (A.by[worker] || []).map(function (x) {
        return { title: x.title, severity: x.sev, count: x.n, who: x.ids.slice(0, 12).map(function (id) { return tokenFor(map, id); }) };
      }),
      otherTeams: WORKERS.filter(function (w) { return w.id !== worker; }).map(function (w) {
        var l = A.by[w.id] || [];
        return { team: w.t, urgent: l.filter(function (x) { return x.sev === 'pain'; }).length, waiting: l.filter(function (x) { return x.sev === 'wait'; }).length };
      })
    };
    if (worker === 'finance' || worker === 'growth') {
      var B = bizOf(st), m = monOf(today), months = [];
      for (var i = 0; i < 6; i++) {
        var mm = i ? prevMon(m, i) : m, x = pays.filter(function (p) { return monOf(p.date) === mm; });
        months.push({ month: mm, income: Math.round(x.reduce(function (a, p) { return a + num(p.amount); }, 0)), payments: x.length });
      }
      ctx.income = { months: months,
        yearToDate: Math.round(pays.filter(function (p) { return p.date.slice(0, 4) === today.slice(0, 4); }).reduce(function (a, p) { return a + num(p.amount); }, 0)),
        businessType: B.type || 'לא הוגדר', exemptCeiling: num(B.ceiling), maxTrainees: num(B.maxTrainees) || null };
    }
    return ctx;
  }

  var RULES = '\n\nכללים: עונים בעברית, קצר וישיר, בלי הקדמות. הנתונים היחידים שיש לך הם ה-JSON שמצורף; אל תמציא מספרים או שמות. '
    + 'מתאמנים מופיעים כקודים ("מתאמן-07"); השתמש בקוד כמו שהוא ואל תנחש שם. אין לך גישה למידע רפואי, להערות או לשאלונים, ואל תבקש אותם. '
    + 'בסוף כל תשובה: הצעד הבא, במשפט אחד.';
  var SYS = {
    finance: 'אתה רואה החשבון הפנימי של BAUER POWER, עסק של מאמן כושר עצמאי בישראל. אתה מסדר את המספרים, מזהה גבייה שחסרה ומזכיר מועדים. '
      + 'אינך רואה חשבון מוסמך: כל החלטת מס (סוג עוסק, מע״מ, מקדמות, הוצאות מוכרות) הולכת לרואה החשבון של המאמן, ואתה אומר זאת במפורש. אל תיתן ייעוץ השקעות.',
    legal: 'אתה קצין הציות של BAUER POWER, עסק של מאמן כושר עצמאי בישראל. אתה עובר על הצהרות בריאות, תקנון, הסכמות ופרטיות ומסמן מה חסר. '
      + 'אינך עורך דין ואינך נותן חוות דעת משפטית: חוזה, סכסוך, תביעה או כל חשיפה משפטית הולכים לעורך דין אמיתי, ואתה אומר זאת במפורש.',
    coaching: 'אתה המאמן הראשי של BAUER POWER: מאמן כוח מנוסה עם ידע בתזונת ספורט. אתה עובר על תוכניות ויעדים, קודם בטיחות ואחר כך איכות. '
      + 'אתה שמרן עם פציעות, לא מאבחן, ומפנה לרופא או לפיזיותרפיסט כשיש סימן אזהרה.',
    growth: 'אתה מנהל המכירות והשימור של BAUER POWER. אתה מזהה מי מתקרר, מי מסיים תקופה ומי מתאים להמלצה, ומנסח הודעות קצרות וחמות בלי לחץ מכירתי. '
      + 'כשמבקשים הודעה, כתוב אותה מוכנה לשליחה, עם {name} במקום השם.',
    ops: 'אתה מנהל התפעול של BAUER POWER. אתה שומר על נתונים נקיים, גיבוי וסנכרון, ובונה למאמן סדר יום קצר מהממצאים של כל הצוות.'
  };

  /* =====================================================================
     מכאן: דפדפן בלבד
     ===================================================================== */
  var LS = 'ebfit_team_v1';
  var UI = { w: 'finance', draft: '', busy: false, memo: null, memoAt: 0 };

  function store() {
    var d = null;
    try { d = JSON.parse(localStorage.getItem(LS) || 'null'); } catch (e) { d = null; }
    if (!d || typeof d !== 'object') d = {};
    d.chats = d.chats || {}; d.map = d.map || { t: {}, seq: 0 }; d.map.t = d.map.t || {};
    return d;
  }
  function keep(d) { try { localStorage.setItem(LS, JSON.stringify(d)); } catch (e) {} }
  function reset() { try { localStorage.removeItem(LS); } catch (e) {} UI.draft = ''; UI.memo = null; }

  function liveEnv() {
    var env = { today: (typeof todayISO === 'function') ? todayISO() : isoOf(new Date()) };
    env.logs = (typeof DASH !== 'undefined' && DASH && DASH.logs) ? DASH.logs : null;
    if (typeof W.pkgOf === 'function') env.pkgOf = W.pkgOf;
    if (typeof W.pkgPaid === 'function') env.pkgPaid = W.pkgPaid;
    if (typeof W.payCat === 'function') env.payCat = W.payCat;
    if (typeof W.planOf === 'function') env.planOf = W.planOf;
    if (typeof W.moneyTxt === 'function') env.money = W.moneyTxt;
    if (W.EBHealth && W.EBHealth.screen) env.screen = W.EBHealth.screen;
    if (W.EBBackup && W.EBBackup.daysSince) { try { env.backupDays = W.EBBackup.daysSince(); } catch (e) {} }
    if (W.EBSync && W.EBSync.enabled && W.EBSync.enabled()) {
      var s = {}; try { s = W.EBSync.status() || {}; } catch (e) {}
      var at = null; try { at = localStorage.getItem('ebfit_sync_at'); } catch (e) {}
      var err = null; try { err = W.EBSync.lastError ? W.EBSync.lastError() : null; } catch (e) {}
      env.sync = { state: s.state, error: !!err && s.state !== 'out', at: at };
    }
    env.hasKey = !!(W.S && W.S.settings && W.S.settings.apiKey);
    return env;
  }
  /* renderNav רץ בכל ציור. הניתוח נשמר לשנייה כדי שלא ירוץ פעמיים
     באותו ציור (תג בתפריט ואחריו המסך). */
  function current() {
    var now = Date.now();
    if (UI.memo && now - UI.memoAt < 1000) return UI.memo;
    UI.memo = analyze(W.S || {}, liveEnv()); UI.memoAt = now;
    return UI.memo;
  }
  function count() { try { return current().pain; } catch (e) { return 0; } }

  function E(s) { return (typeof esc === 'function') ? esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  var CSS = '.tm-tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}'
    + '.tm-tab{flex:1 1 150px;min-width:0;text-align:right;background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:11px 12px;color:var(--tx);cursor:pointer;font:inherit}'
    + '.tm-tab.on{border-color:var(--or);background:var(--or-soft)}'
    + '.tm-tab b{display:block;font-size:14px}.tm-tab span{display:block;font-size:11.5px;color:var(--dim);margin-top:2px}'
    + '.tm-tab em{font-style:normal;font-size:11.5px;font-weight:700;border-radius:20px;padding:1px 8px;margin-inline-start:6px}'
    + '.tm-tab em.pain{background:rgba(217,96,90,.14);color:var(--bad)}.tm-tab em.wait{background:var(--cop-soft);color:var(--cop)}'
    + '.tm-f{display:flex;gap:10px;align-items:flex-start;padding:12px 0;border-bottom:1px solid var(--line)}.tm-f:last-child{border-bottom:0}'
    + '.tm-dot{flex:0 0 9px;height:9px;border-radius:50%;margin-top:6px;background:var(--or)}.tm-dot.pain{background:var(--bad)}.tm-dot.wait{background:var(--cop)}'
    + '.tm-b{flex:1;min-width:0}.tm-b b{font-size:14px;display:block}.tm-b p{margin:3px 0 0;font-size:13px;color:var(--mut);line-height:1.55;overflow-wrap:anywhere}'
    + '.tm-chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}'
    + '.tm-chip{background:transparent;border:1px solid var(--line2);color:var(--tx);border-radius:20px;padding:3px 10px;font:inherit;font-size:12px;cursor:pointer}'
    + '.tm-acts{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}'
    + '.tm-note{font-size:12px;color:var(--dim);line-height:1.5;margin-top:10px}'
    + '.tm-chat{display:flex;flex-direction:column;gap:10px;max-height:min(52vh,420px);overflow:auto;padding:4px 2px;margin-bottom:10px}'
    + '.tm-in{display:flex;gap:8px}.tm-in input{flex:1;min-width:0}'
    + '.tm-set{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}';
  function css() {
    if (typeof document === 'undefined' || document.getElementById('tm-css')) return;
    var s = document.createElement('style'); s.id = 'tm-css'; s.textContent = CSS; document.head.appendChild(s);
  }

  function findingRow(x, showWorker) {
    var st = W.S || {}, name = {};
    (st.trainees || []).forEach(function (t) { name[t.id] = t.name; });
    var h = '<div class="tm-f"><span class="tm-dot ' + x.sev + '"></span><div class="tm-b"><b>' + E(x.title)
      + (showWorker ? ' <span class="muted" style="font-weight:400;font-size:12px">· ' + E(workerOf(x.w).t) + '</span>' : '') + '</b>'
      + (x.text ? '<p>' + E(x.text) + '</p>' : '');
    if (x.ids.length && x.ids.length <= 12) {
      h += '<div class="tm-chips">' + x.ids.map(function (id) {
        return name[id] ? '<button class="tm-chip" onclick="go(\'trainee\',\'' + E(id) + '\')">' + E(name[id]) + '</button>' : '';
      }).join('') + '</div>';
    }
    var a = '';
    if (x.act) a += '<button class="btn sm" onclick="EBTeam.act(\'' + E(x.w) + '\',\'' + E(x.id) + '\')">' + E(x.act.label) + '</button>';
    if (x.ok) a += '<button class="btn sm ghost" onclick="EBTeam.done(\'' + E(x.w) + '\',\'' + E(x.id) + '\')">טופל</button>';
    if (a) h += '<div class="tm-acts">' + a + '</div>';
    return h + '</div></div>';
  }
  function workerOf(id) { return WORKERS.filter(function (w) { return w.id === id; })[0] || WORKERS[0]; }
  function findOne(w, id) { return (current().by[w] || []).filter(function (x) { return x.id === id; })[0] || null; }

  function bubbleOf(m, st, map) {
    return '<div class="msg ' + (m.r === 'me' ? 'me' : 'bot') + '">' + E(unmask(m.t, st, map)) + '</div>';
  }

  function view() {
    css();
    var st = W.S || {}, A = current(), w = workerOf(UI.w), list = A.by[w.id] || [], d = store();
    if (typeof dashLoad === 'function' && typeof DASH !== 'undefined' && DASH.logs === null) { try { dashLoad(); } catch (e) {} }

    var h = (typeof head === 'function')
      ? head('הצוות שלי', 'חמישה עובדים שעוברים על העסק כל בוקר. הבדיקות רצות במכשיר, בלי עלות.',
          '<button class="btn ghost" onclick="EBTeam.settings()">פרטי העסק</button>')
      : '<h1>הצוות שלי</h1>';

    h += '<div class="card"><h3 style="font-size:15px;margin:0 0 4px">ישיבת בוקר</h3>';
    if (!A.brief.length) h += '<p class="muted" style="font-size:13.5px;margin:6px 0 0">אין היום שום דבר דחוף. הכול מסודר.</p>';
    else {
      h += '<p class="muted" style="font-size:12.5px;margin:0 0 4px">' + A.pain + ' דחופים, ' + A.wait + ' מחכים לך.</p>';
      h += A.brief.slice(0, 5).map(function (x) { return findingRow(x, true); }).join('');
      if (A.brief.length > 5) h += '<div class="tm-note">ועוד ' + (A.brief.length - 5) + ' אצל העובדים למטה.</div>';
    }
    h += '</div>';

    h += '<div class="tm-tabs">' + WORKERS.map(function (x) {
      var l = A.by[x.id] || [], p = l.filter(function (y) { return y.sev === 'pain'; }).length, q = l.filter(function (y) { return y.sev === 'wait'; }).length;
      return '<button class="tm-tab' + (x.id === w.id ? ' on' : '') + '" onclick="EBTeam.open(\'' + x.id + '\')"><b>' + E(x.t)
        + (p ? '<em class="pain">' + p + '</em>' : '') + (q ? '<em class="wait">' + q + '</em>' : '') + '</b><span>' + E(x.s) + '</span></button>';
    }).join('') + '</div>';

    h += '<div class="card"><h3 style="font-size:15px;margin:0 0 2px">' + E(w.t) + ' — מה מחכה לך</h3>';
    h += list.length ? list.map(function (x) { return findingRow(x, false); }).join('')
                     : '<p class="muted" style="font-size:13.5px;margin:8px 0 0">אין ממצאים. התחום הזה מסודר.</p>';
    if (w.id === 'finance') h += '<div class="tm-note">אני מסדר מספרים ומזכיר מועדים. אני לא מחליף רואה חשבון מוסמך, וכל החלטת מס עוברת דרכו. הסכומים כוללים רק מה שנרשם באפליקציה.</div>';
    if (w.id === 'legal') h += '<div class="tm-note">אני רשימת בדיקה לציות, לא ייעוץ משפטי. חוזה, סכסוך או כל חשיפה משפטית הולכים לעורך דין.</div>';
    h += '</div>';

    var chat = d.chats[w.id] || [], hasKey = !!(st.settings && st.settings.apiKey);
    h += '<div class="card"><div class="row" style="align-items:center;margin-bottom:8px"><h3 style="font-size:15px;margin:0;flex:1">שאלה ל' + E(w.t) + '</h3>'
      + (chat.length ? '<button class="btn sm ghost" onclick="EBTeam.clear()">ניקוי</button>' : '') + '</div>';
    h += '<div class="tm-chips" style="margin:0 0 10px">' + (QUICK[w.id] || []).map(function (q) {
      return '<button class="tm-chip" onclick="EBTeam.quick(\'' + q.id + '\')">' + E(q.q) + '</button>';
    }).join('') + '</div>';
    if (chat.length) h += '<div class="tm-chat" id="tmChat">' + chat.map(function (m) { return bubbleOf(m, st, d.map); }).join('')
      + (UI.busy ? '<div class="msg bot">חושב…</div>' : '') + '</div>';
    if (hasKey) {
      h += '<div class="tm-in"><input class="f" id="tmIn" placeholder="שאלה חופשית…" value="' + E(UI.draft) + '" oninput="EBTeam.draft(this.value)" onkeydown="if(event.key===\'Enter\')EBTeam.send()">'
        + '<button class="btn" onclick="EBTeam.send()"' + (UI.busy ? ' disabled' : '') + '>שליחה</button></div>'
        + '<div class="tm-note">לשאלה חופשית נשלחים ל-Claude מספרים וקודים בלבד: שמות מוחלפים ב"מתאמן-07", ומידע רפואי, הערות ושאלונים לא נשלחים בכלל.</div>';
    } else {
      h += '<div class="tm-note">השאלות המוכנות למעלה עובדות בלי שום חיבור. לשאלות חופשיות צריך מפתח Claude בהגדרות (שירות בתשלום לפי שימוש). '
        + '<button class="tm-chip" onclick="go(\'settings\')">להגדרות</button></div>';
    }
    h += '</div>';

    h += '<div class="tm-chips" style="margin-top:4px">'
      + '<button class="tm-chip" onclick="go(\'biz\')">ניתוח העסק</button>'
      + '<button class="tm-chip" onclick="go(\'health\')">סינון בריאות</button>'
      + '<button class="tm-chip" onclick="go(\'access\')">גישת מתאמנים</button>'
      + '<button class="tm-chip" onclick="go(\'progress\')">התקדמות</button>'
      + '<button class="tm-chip" onclick="go(\'lab\')">פיצ׳רים ובוט</button></div>';
    return h;
  }

  function afterRender() {
    var c = document.getElementById('tmChat'); if (c) c.scrollTop = c.scrollHeight;
  }
  function rerender() { UI.memo = null; if (typeof render === 'function') render(); }
  function open(id) { if (RUN[id]) UI.w = id; UI.draft = ''; rerender(); }
  function draft(v) { UI.draft = String(v || ''); }

  function push(worker, r, text) {
    var d = store(), st = W.S || {};
    var a = d.chats[worker] = d.chats[worker] || [];
    a.push({ r: r, t: mask(text, st, d.map), at: Date.now() });
    if (a.length > 30) d.chats[worker] = a.slice(-30);
    keep(d);
  }
  function clear() { var d = store(); d.chats[UI.w] = []; keep(d); rerender(); }

  function quick(qid) {
    var q = (QUICK[UI.w] || []).filter(function (x) { return x.id === qid; })[0]; if (!q) return;
    push(UI.w, 'me', q.q);
    var ans; try { ans = ask(UI.w, qid, W.S || {}, liveEnv()); } catch (e) { ans = 'לא הצלחתי לחשב את זה: ' + ((e && e.message) || e); }
    push(UI.w, 'bot', ans);
    rerender();
  }

  /* שולח רק את ההיסטוריה המקודדת ואת הקשר המספרים. בלי מפתח לא קורה
     כלום — גם לא בבדיקות, שלא מזייפות את api.anthropic.com. */
  function send() {
    var st = W.S || {}, txt = String(UI.draft || '').trim(), worker = UI.w;
    if (!txt || UI.busy) return;
    if (!(st.settings && st.settings.apiKey) || typeof W.claudeAPI !== 'function') return;
    push(worker, 'me', txt); UI.draft = ''; UI.busy = true; rerender();
    var d = store();
    var ctx = context(st, worker, liveEnv(), d.map); keep(d);
    var hist = (d.chats[worker] || []).slice(-12).map(function (m) { return { role: m.r === 'me' ? 'user' : 'assistant', content: m.t }; });
    while (hist.length && hist[0].role !== 'user') hist.shift();
    W.claudeAPI({
      system: SYS[worker] + RULES + '\n\nנתוני העסק (JSON):\n' + JSON.stringify(ctx),
      messages: hist
    }).then(function (out) {
      push(worker, 'bot', String(out || '').trim() || 'לא התקבלה תשובה.');
    }).catch(function (e) {
      push(worker, 'bot', 'לא הצלחתי לענות עכשיו (' + ((e && e.message) || 'שגיאת חיבור') + ').');
    }).then(function () { UI.busy = false; if (typeof VIEW !== 'undefined' && VIEW === 'team') rerender(); });
  }

  function act(w, id) {
    var x = findOne(w, id); if (!x || !x.act) return;
    var a = x.act;
    if (a.k === 'go' && typeof go === 'function') return go(a.v);
    if (a.k === 'set') return settings();
    if (a.k === 'report') return reportModal();
    if (a.k === 'msg') return msgModal(x);
  }
  /* "טופל": הממצא נעלם עד שהרכב המתאמנים בו משתנה. נשמר בהגדרות
     (מסונכרן), והמפתח בנוי ממזהים בלבד. */
  function done(w, id) {
    var x = findOne(w, id); if (!x || !W.S) return;
    var S_ = W.S; S_.settings = S_.settings || {};
    var m = Object.assign({}, S_.settings.teamOk || {});
    m[x.key] = (typeof todayISO === 'function') ? todayISO() : isoOf(new Date());
    var keys = Object.keys(m);
    if (keys.length > 150) keys.sort(function (a, b) { return m[a] < m[b] ? -1 : 1; }).slice(0, keys.length - 150).forEach(function (k) { delete m[k]; });
    S_.settings.teamOk = m;
    if (typeof save === 'function') save();
    if (typeof toast === 'function') toast('סומן כטופל');
    rerender();
  }

  function reportModal() {
    if (typeof openModal !== 'function') return;
    var txt = report(W.S || {}, liveEnv());
    openModal('<div class="mh"><h3>דוח לרואה החשבון</h3><button class="iconbtn" onclick="closeModal()">✕</button></div><div class="mb">'
      + '<div class="muted" style="font-size:12.5px;margin-bottom:8px">כל התשלומים שנרשמו השנה. אפשר להעתיק ולשלוח.</div>'
      + '<textarea class="f" id="tm_rep" readonly style="min-height:300px;line-height:1.6;font-size:12.5px">' + E(txt) + '</textarea></div>'
      + '<div class="mf"><button class="btn" onclick="EBTeam.copy(\'tm_rep\')">העתקה</button>'
      + '<button class="btn ghost" onclick="closeModal()">סגירה</button></div>', true);
  }
  function msgModal(x) {
    if (typeof openModal !== 'function') return;
    var st = W.S || {}, byId = {};
    (st.trainees || []).forEach(function (t) { byId[t.id] = t; });
    var rows = x.ids.map(function (id) {
      var t = byId[id]; if (!t) return '';
      var ph = String(t.phone || '').replace(/\D/g, '');
      return '<div class="line-item"><span style="flex:1;font-size:13.5px">' + E(t.name) + '</span>'
        + (ph.length >= 9 ? '<button class="btn sm" onclick="EBTeam.wa(\'' + E(id) + '\')">ווטסאפ</button>'
                          : '<span class="muted" style="font-size:12px">אין טלפון</span>') + '</div>';
    }).join('');
    openModal('<div class="mh"><h3>' + E(x.title) + '</h3><button class="iconbtn" onclick="closeModal()">✕</button></div><div class="mb">'
      + '<div class="muted" style="font-size:12.5px;margin-bottom:8px">אפשר לערוך. במקום {name} ייכנס השם הפרטי של כל מתאמן.</div>'
      + '<textarea class="f" id="tm_msg" style="min-height:130px;line-height:1.6">' + E(x.act.tpl || '') + '</textarea>'
      + '<div style="margin-top:10px">' + rows + '</div></div>'
      + '<div class="mf"><button class="btn ghost" onclick="EBTeam.copy(\'tm_msg\')">העתקה</button>'
      + '<button class="btn ghost" onclick="closeModal()">סגירה</button></div>', true);
  }
  function wa(id) {
    var t = ((W.S || {}).trainees || []).filter(function (x) { return x.id === id; })[0]; if (!t) return;
    var el = document.getElementById('tm_msg'), msg = (el ? el.value : '').replace(/\{name\}/g, first(t.name));
    var p = String(t.phone || '').replace(/\D/g, ''); if (p.charAt(0) === '0') p = '972' + p.slice(1);
    W.open('https://wa.me/' + p + '?text=' + encodeURIComponent(msg), '_blank');
  }
  function copy(id) {
    var el = document.getElementById(id); if (!el) return;
    if (navigator.clipboard) navigator.clipboard.writeText(el.value).then(function () { if (typeof toast === 'function') toast('הועתק'); });
  }

  function settings() {
    if (typeof openModal !== 'function') return;
    var B = bizOf(W.S || {});
    function inp(l, id, type, v, hint) {
      return '<div><label class="f">' + l + '</label><input class="f" id="' + id + '" type="' + type + '" value="' + E(v == null ? '' : v) + '">'
        + (hint ? '<div class="muted" style="font-size:11.5px;margin-top:3px">' + hint + '</div>' : '') + '</div>';
    }
    openModal('<div class="mh"><h3>פרטי העסק</h3><button class="iconbtn" onclick="closeModal()">✕</button></div><div class="mb">'
      + '<div class="muted" style="font-size:12.5px;margin-bottom:10px">הצוות משתמש בפרטים האלה לתזכורות. נשמר לבד.</div><div class="tm-set">'
      + '<div><label class="f">סוג העוסק</label><select class="f" id="tb_type">'
      + [['', 'לא הוגדר'], ['patur', 'עוסק פטור'], ['murshe', 'עוסק מורשה'], ['company', 'חברה']].map(function (o) {
          return '<option value="' + o[0] + '"' + (B.type === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div>'
      + inp('תקרת עוסק פטור לשנה (₪)', 'tb_ceiling', 'number', B.ceiling, 'לוודא את הסכום מול רואה החשבון.')
      + inp('יום בחודש שעד אליו משלמים', 'tb_payday', 'number', B.payDay)
      + inp('מקסימום מתאמנים שאתה רוצה', 'tb_max', 'number', B.maxTrainees)
      + inp('ביטוח אחריות מקצועית בתוקף עד', 'tb_ins', 'date', B.insuranceUntil)
      + inp('תעודת מאמן בתוקף עד', 'tb_cert', 'date', B.certUntil, 'אם אין תאריך תפוגה, להשאיר ריק.')
      + inp('חידוש הצהרת בריאות כל (חודשים)', 'tb_decl', 'number', B.declMonths)
      + '</div></div><div class="mf"><button class="btn ghost" onclick="closeModal()">סגירה</button></div>');
    if (typeof autoModal === 'function') autoModal(saveSettings);
  }
  function saveSettings() {
    var g = function (id) { var e = document.getElementById(id); return e ? e.value : null; };
    if (g('tb_type') === null || !W.S) return;
    var S_ = W.S; S_.settings = S_.settings || {};
    S_.settings.biz = Object.assign({}, S_.settings.biz, {
      type: g('tb_type'), ceiling: num(g('tb_ceiling')) || BIZ_DEFAULT.ceiling, payDay: Math.min(28, Math.max(1, num(g('tb_payday')) || 10)),
      maxTrainees: g('tb_max') ? num(g('tb_max')) : '', insuranceUntil: g('tb_ins') || '', certUntil: g('tb_cert') || '',
      declMonths: num(g('tb_decl')) || 24
    });
    UI.memo = null;
    if (typeof save === 'function') save();
  }

  var API = { WORKERS: WORKERS, QUICK: QUICK, analyze: analyze, ask: ask, report: report, context: context, mask: mask, unmask: unmask,
    hasTerm: hasTerm, medGroups: medGroups, riskyFor: riskyFor,
    view: view, afterRender: afterRender, count: count, open: open, draft: draft, send: send, quick: quick, clear: clear,
    act: act, done: done, settings: settings, wa: wa, copy: copy, reset: reset };
  W.EBTeam = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();

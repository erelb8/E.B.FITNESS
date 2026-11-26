/* אפליקציית המאמן ברוחב של טלפון — בלחיצות אמיתיות.
   אראל (נובמבר 2026): "תבדוק שהכל עובד גם בטלפון". הבדיקה הראשונה מצאה שיומן האימונים
   (שבעה ימים זה לצד זה) רחב מהמסך: העמוד התרחב ל-473px על מסך של 390, הכול זז הצידה,
   והכפתור השמאלי בתפריט התחתון יצא מהמסך. ובטלפון של 320px — הטבלה של סינון הבריאות.
   מכאן הכלל שנבדק לכל מסך: שום דבר לא מרחיב את העמוד, והתפריט התחתון נלחץ ממנו.
   בלוח הבקרה: כל אריח נפתח ונסגר בלחיצה, "עוד התראות" נפתח, וכפתור הצבע מחליף. */
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'); const { chromium } = require(ROOT + '/node_modules/playwright');
const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.json': 'application/json', '.css': 'text/css' };
const srv = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0].split('#')[0]));
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });

let pass = 0, fail = 0;
const t = (n, ok, i) => { ok ? pass++ : fail++; console.log((ok ? '✓ ' : '✗ ') + n + (ok ? '' : '  → ' + i)); };

/* נתונים מומצאים שממלאים כל חלק: כאב, מי שלא שילם, אימונים היום, תוכנית שהסתיימה */
const seed = () => {
  if (window.EBSync) { EBSync.enabled = () => false; EBSync.schedule = () => {}; EBSync.feedbackOn = () => true; } window.save = () => {};
  const iso = d => addDays(todayISO(), -d);
  const P = { days: [{ name: 'יום A — חזה וכתפיים', exercises: [{ name: 'לחיצת חזה במוט', sets: '4', reps: '6-8' }, { name: 'הרחקות צד במשקולות', sets: '3', reps: '12' }] },
                     { name: 'יום B — רגליים', exercises: [{ name: 'סקוואט גבי', sets: '4', reps: '5' }] }] };
  const mk = (id, name, g, extra) => Object.assign({ id, name, gender: g, status: 'active', height: 170, birth: '1996-03-03', phone: '0500000000',
    program: JSON.parse(JSON.stringify(P)), meals: [], weighins: [{ date: iso(3), weight: 70 }], joined: iso(60) }, extra || {});
  S.settings.trainer = 'אראל בדיקה'; S.features.calc = true;
  S.trainees = [mk('a1', 'נועה בדיקה-ארוכה מאוד', 'נקבה', { pkg: { k: 'coach', price: 350, months: 3 } }), mk('a2', 'יואב בדיקה', 'זכר'),
    mk('a3', 'מיכל בדיקה', 'נקבה', { program: { days: [] } }), mk('a4', 'דניאל בדיקה', 'זכר'), mk('a5', 'שירה בדיקה', 'נקבה')];
  S.trainees[0].program.planStart = iso(100); S.trainees[0].program.planMonths = 3;
  S.payments = [{ id: 'p1', traineeId: 'a2', date: iso(2), amount: 350, method: 'ביט' }];
  S.sessions = [{ id: 's1', traineeId: 'a1', date: todayISO(), time: '17:30', type: 'אימון אישי', status: 'scheduled' },
    { id: 's2', traineeId: 'a2', date: todayISO(), time: '19:00', type: 'אימון אישי', status: 'scheduled' },
    { id: 's3', traineeId: 'a4', date: iso(-2), time: '08:00', type: 'אימון אישי', status: 'scheduled' }];
  DASH.logs = [{ id: 'l1', trainee_id: 'a2', date: iso(1), created_at: iso(1) + 'T10:00:00+00', day_name: 'יום B — רגליים', entries: [1], feel: 'קשה', note: 'כאב בברך ימין בסקוואט',
      coach_note: 'ראיתי. באימון הבא יורדים בעומס ועובדים על טווח תנועה מלא, ואם זה חוזר עוצרים ומדברים איתי לפני שממשיכים', coach_note_at: iso(0) + 'T08:00:00+00', coach_seen_at: null },
    { id: 'l2', trainee_id: 'a4', date: iso(0), created_at: iso(0) + 'T09:00:00+00', day_name: 'יום A — חזה וכתפיים', entries: [1, 2], feel: 'טוב' },
    { trainee_id: 'a5', date: iso(20), day_name: 'יום A — חזה וכתפיים', entries: [1], feel: 'קל' }];
  S.trainees[4].weighins = [{ date: iso(20), weight: 61 }];
  DASH.at = Date.now() + 1e9; DASH.tile = ''; VIEW = 'dash'; render(); window.scrollTo(0, 0);
};
/* מה רחב מהמסך, והאם כל כפתור בתפריט התחתון באמת מקבל את הלחיצה */
const look = () => {
  const W = document.documentElement.clientWidth, wide = [];
  document.querySelectorAll('#view *').forEach(e => {
    const r = e.getBoundingClientRect(); if (r.width <= W + 1) return;
    for (let q = e.parentElement; q && q !== document.body; q = q.parentElement) if (/(auto|scroll|hidden)/.test(getComputedStyle(q).overflowX)) return;
    wide.push((typeof e.className === 'string' && e.className ? e.className.split(' ')[0] : e.tagName) + ' ' + Math.round(r.width));
  });
  const nav = [].map.call(document.querySelectorAll('#mobnav button'), e => { const r = e.getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!(hit && hit.closest('#mobnav')) && r.left >= -1 && r.right <= W + 1; });
  const top = [].every.call(document.querySelectorAll('.top button'), e => { if (!e.offsetParent) return true; const r = e.getBoundingClientRect(); return r.left >= -1 && r.right <= W + 1; });
  return { page: window.innerWidth, scroll: document.documentElement.scrollWidth, W, wide: wide.slice(0, 3), nav, top };
};

(async () => {
  await new Promise(r => srv.listen(0, r));
  let b; try { b = await chromium.launch(); } catch (e) { b = await chromium.launch({ channel: 'chrome' }); }
  for (const [name, w, h] of [['390', 390, 844], ['320', 320, 568]]) {
    console.log('=== טלפון ברוחב ' + name + ' ===');
    const c = await b.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
    const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.setDefaultTimeout(8000);
    await p.route(/supabase\.co/, rt => rt.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await p.goto('http://localhost:' + srv.address().port + '/index.html');
    await p.waitForFunction(() => typeof vDash === 'function' && window.EBExUI && window.EBHealth && window.EBAccess, null, { timeout: 30000 });
    await p.evaluate(seed); await p.waitForTimeout(400);

    /* כל המסכים, וכל לשונית בתיק מתאמן */
    const screens = ['dash', 'trainees', 'schedule', 'money', 'lab', 'progress', 'access', 'health', 'biz', 'guides', 'settings', 'anims', 'team'];
    const badW = [], badNav = [];
    for (const v of screens) {
      await p.evaluate(v => { go(v); }, v); await p.waitForTimeout(250);
      const r = await p.evaluate(look);
      if (r.page !== w || r.scroll > w + 1 || r.wide.length) badW.push(v + ' (' + r.scroll + 'px' + (r.wide.length ? ': ' + r.wide.join(', ') : '') + ')');
      if (r.nav.length !== 5 || r.nav.includes(false) || !r.top) badNav.push(v);
    }
    for (const tb of ['details', 'program', 'meals', 'measures', 'pay', 'history']) {
      await p.evaluate(tb => { VIEW = 'trainee'; ARG = 'a1'; SUBTAB = tb; render(); window.scrollTo(0, 0); }, tb); await p.waitForTimeout(200);
      const r = await p.evaluate(look);
      if (r.page !== w || r.scroll > w + 1 || r.wide.length) badW.push('trainee/' + tb + ' (' + r.scroll + 'px' + (r.wide.length ? ': ' + r.wide.join(', ') : '') + ')');
      if (r.nav.includes(false) || !r.top) badNav.push('trainee/' + tb);
    }
    t('אף מסך לא רחב מהטלפון (' + (screens.length + 6) + ' מסכים)', !badW.length, badW.join(' | '));
    t('התפריט התחתון והכפתורים למעלה בתוך המסך בכל מסך', !badNav.length, badNav.join(', '));

    /* התפריט התחתון — לחיצה אמיתית, גם מתוך היומן */
    await p.evaluate(() => { go('schedule'); }); await p.waitForTimeout(250);
    let navOk = true, navWhy = '';
    for (const i of [1, 3, 4, 2, 0]) {
      try { await p.locator('#mobnav button').nth(i).tap(); await p.waitForTimeout(250); } catch (e) { navOk = false; navWhy = 'לא נלחץ כפתור ' + i; break; }
      const on = await p.evaluate(i => document.querySelectorAll('#mobnav button')[i].classList.contains('on'), i);
      if (!on) { navOk = false; navWhy = 'כפתור ' + i + ' לא סומן'; break; }
    }
    t('התפריט התחתון עובר בין המסכים בלחיצה', navOk && await p.evaluate(() => VIEW) === 'dash', navWhy);

    /* לוח הבקרה: האריחים */
    const keys = await p.evaluate(() => [].map.call(document.querySelectorAll('.dtiles > .dtile'), e => (e.getAttribute('onclick') || '').replace(/.*'(\w+)'.*/, '$1')));
    const badT = [];
    for (const k of keys) {
      try {
        await p.locator('.dtiles > .dtile[onclick*="\'' + k + '\'"]').tap(); await p.waitForTimeout(500);
        const st = await p.evaluate(() => { const d = document.getElementById('dpanel'); if (!d) return null; const r = d.getBoundingClientRect();
          return { top: r.top, cards: d.querySelectorAll('.card').length, on: !!document.querySelector('.dtile.on'), w: document.documentElement.scrollWidth }; });
        if (!st || !st.cards || !st.on) badT.push(k + ' לא נפתח'); else if (st.top < 0 || st.top > h - 100) badT.push(k + ' נפתח מחוץ למסך (' + Math.round(st.top) + ')'); else if (st.w > w + 1) badT.push(k + ' רחב מהמסך');
        await p.locator('#dpanel .dp-head .iconbtn').tap(); await p.waitForTimeout(200);
        if (await p.evaluate(() => !!document.getElementById('dpanel'))) badT.push(k + ' לא נסגר');
      } catch (e) { badT.push(k + ' לא נלחץ'); }
    }
    t('כל אריח נפתח במסך ונסגר (' + keys.join(', ') + ')', keys.length >= 6 && !badT.length, badT.join(' | '));

    /* תגובת המאמן על אימון (נובמבר 2026): בפיד שבאריח, ובחלון */
    await p.locator('.dtiles > .dtile[onclick*="\'feed\'"]').tap(); await p.waitForTimeout(450);
    const rep = await p.evaluate(() => ({ btn: document.querySelectorAll('#dpanel .ev-rep').length, done: document.querySelectorAll('#dpanel .ev-reply').length,
      w: document.documentElement.scrollWidth, in: [].every.call(document.querySelectorAll('#dpanel .ev-rep, #dpanel .ev-reply'), e => { const r = e.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1; }) }));
    t('בפיד: תגובה שנכתבה וכפתור "תגובה", בתוך המסך', rep.btn === 1 && rep.done === 1 && rep.w <= w + 1 && rep.in, JSON.stringify(rep));
    await p.locator('#dpanel .ev-rep').first().tap(); await p.waitForTimeout(350);
    const lr = await p.evaluate(() => { const ta = document.getElementById('lr_t'), go = document.getElementById('lr_go'); if (!ta || !go) return null;
      const inside = e => { const r = e.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1 && r.width > 0; };
      const out = { view: VIEW, ta: inside(ta), go: inside(go), chips: [].every.call(document.querySelectorAll('.lr-quick button'), inside), n: document.querySelectorAll('.lr-quick button').length,
        fits: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1 };
      closeModal(); return out; });
    t('חלון התגובה נפתח מהפיד ונכנס במסך', !!lr && lr.view === 'dash' && lr.ta && lr.go && lr.chips && lr.n === 4 && lr.fits, JSON.stringify(lr));
    await p.locator('#dpanel .dp-head .iconbtn').tap(); await p.waitForTimeout(200);

    /* "עוד התראות", כפתור הצבע, ושתי הפעולות */
    await p.evaluate(() => window.scrollTo(0, 0));
    const vis = () => [].filter.call(document.querySelectorAll('.dash-alerts .al-row'), e => e.offsetParent).length;
    const a0 = await p.evaluate(vis); let a1 = a0, a2 = a0;
    if (await p.locator('.dash-alerts .al-more').count()) { await p.locator('.dash-alerts .al-more').tap(); a1 = await p.evaluate(vis); await p.locator('.dash-alerts .al-more').tap(); a2 = await p.evaluate(vis); }
    t('"עוד התראות" פותח וסוגר', a0 === 2 && a1 > a0 && a2 === a0, a0 + '→' + a1 + '→' + a2);
    const th = () => document.documentElement.getAttribute('data-theme') || 'dark';
    /* שלוש ערכות (נובמבר 2026): הכפתור פותח חלון עם שלוש דוגמאות, ובחירה מחליפה מיד */
    const t0 = await p.evaluate(th); await p.locator('.dhero .theme-sw').tap(); await p.waitForTimeout(150);
    const opts = await p.locator('#thmSheet .thm-opt').count();
    const sheetFits = await p.evaluate(() => { const r = document.querySelector('#thmSheet .thm-sheet').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1; });
    await p.locator('#thmSheet [data-thm="mono"]').tap(); const t1 = await p.evaluate(th);
    await p.locator('#thmSheet [data-thm="light"]').tap(); const t1b = await p.evaluate(th);
    await p.locator('#thmSheet [data-thm-close]').tap();
    await p.locator('#themeBtn').tap(); await p.waitForTimeout(150); await p.locator('#thmSheet [data-thm="dark"]').tap(); const t2 = await p.evaluate(th);
    await p.mouse.click(5, 5); const closed = await p.evaluate(() => !document.getElementById('thmSheet'));
    const kept = await p.evaluate(() => localStorage.getItem('eb_theme'));
    t('כפתור הצבעים — שלוש ערכות, בכרטיס הפתיחה ובכותרת', opts === 3 && sheetFits && t1 === 'mono' && t1b === 'light' && t2 === 'dark' && closed && kept === 'dark'
      && await p.evaluate(() => !!document.querySelector('.dhero .theme-sw svg') && !!document.querySelector('#themeBtn svg')), [opts, sheetFits, t0, t1, t1b, t2, closed, kept].join(' '));
    await p.locator('.dhero .dh-acts .btn').first().tap(); await p.waitForTimeout(250);
    const form = await p.evaluate(() => { const m = document.getElementById('mask'); const open = getComputedStyle(m).display !== 'none'; const fits = document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1; closeModal(); return open && fits; });
    t('"מתאמן חדש" נפתח ונכנס במסך', form);
    /* מסך הכניסה — מי שמוסיף את האפליקציה מחדש למסך הבית מתחבר שוב, מהטלפון */
    const login = await p.evaluate(() => { document.getElementById('view').innerHTML = vLogin();
      const m = document.getElementById('sy_mail'), pw = document.getElementById('sy_pass');
      let called = 0; const keep = window.doSignIn; window.doSignIn = () => { called++; };
      pw.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); window.doSignIn = keep;
      return { cap: m.getAttribute('autocapitalize'), cor: m.getAttribute('autocorrect'), ac: m.getAttribute('autocomplete'), pac: pw.getAttribute('autocomplete'), type: pw.type, called,
               fits: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1 }; });
    t('מסך הכניסה מתאים לטלפון: בלי אות גדולה ותיקון אוטומטי, סיסמה שמורה, Enter מתחבר',
      login.cap === 'none' && login.cor === 'off' && login.ac === 'username' && login.pac === 'current-password' && login.type === 'password' && login.called === 1 && login.fits, JSON.stringify(login));
    t('בלי שגיאות', !errs.length, errs.join(' | '));
    await c.close();
  }
  await b.close(); srv.close();
  console.log('\n' + (fail ? 'נכשלו: ' + fail : 'הכל עבר') + '  |  עברו: ' + pass);
  process.exit(fail ? 1 : 0);
})();

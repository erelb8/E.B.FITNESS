/* תזכורות עם התראה בטלפון (נובמבר 2026): ההרשמה וההעדפות בדף המתאמן,
   והצגת ההתראה ב-sw.js. השליחה עצמה בשרת (supabase/push-reminders.sql +
   functions/push-reminders) ולא נבדקת כאן. */
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'); const { chromium } = require(ROOT + '/node_modules/playwright');
const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.json': 'application/json', '.css': 'text/css' };
const srv = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0].split('#')[0]));
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });

let pass = 0, fail = 0;
const t = (n, ok, i) => { ok ? pass++ : fail++; console.log((ok ? '✓ ' : '✗ ') + n + (ok ? '' : '  → ' + i)); };
const D = { name: 'דני בדיקה', goal: 'כוח', health: { signedAt: '2026-08-01', answers: {} },
  program: { days: [{ name: 'יום A', exercises: [{ name: 'סקוואט', sets: '3', reps: '6' }] }] }, meals: [], meals_self: [], exercises_self: [], files: [] };
const KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';

async function visit(b, { key, perm }) {
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', permissions: perm ? ['notifications'] : [] });
  /* דפדפן הבדיקה חוסם service worker — מחליפים אותו בדמה שזוכר את ההרשמה */
  await c.addInitScript(() => {
    const pm = { getSubscription: async () => window.__sub || null,
      subscribe: async o => { window.__subOpts = { visible: o.userVisibleOnly, keyLen: o.applicationServerKey.length };
        window.__sub = { endpoint: 'https://push.example/abc', toJSON() { return { endpoint: this.endpoint, keys: { p256dh: 'p'.repeat(60), auth: 'a'.repeat(20) } }; },
          unsubscribe: async () => { window.__sub = null; return true; } }; return window.__sub; } };
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { ready: Promise.resolve({ pushManager: pm }),
      register: async () => ({ addEventListener() {}, update() {} }), getRegistrations: async () => [], addEventListener() {}, controller: null } });
    if (!('PushManager' in window)) window.PushManager = function () {};
  });
  const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); const calls = [];
  await p.route(/supabase\.co/, rt => {
    const fn = (rt.request().url().split('/rpc/')[1] || '').split('?')[0]; let body = 'null', a = {}; try { a = JSON.parse(rt.request().postData() || '{}'); } catch (e) {}
    if (fn === 'trainee_program') body = JSON.stringify([D]);
    if (fn === 'trainee_extras') body = JSON.stringify([{ logs: [], weighins: [], session_state: { terms: { at: '2026-10-01T10:00:00.000Z', version: '3' } } }]);
    if (fn === 'push_public_key') body = JSON.stringify(key);
    if (/^trainee_push_/.test(fn)) { calls.push([fn, a]); body = 'true'; }
    rt.fulfill({ status: 200, contentType: 'application/json', body });
  });
  await p.goto('http://localhost:' + srv.address().port + '/t.html#tok-remind');
  await p.waitForSelector('.category-tile'); await p.waitForTimeout(1200);
  await p.tap('.top .theme-sw'); await p.waitForTimeout(700);
  return { c, p, errs, calls };
}
const remText = p => p.evaluate(() => (document.querySelector('.thm-rem') || {}).innerText || '');

(async () => {
  await new Promise(r => srv.listen(0, r));
  let b; try { b = await chromium.launch(); } catch (e) { b = await chromium.launch({ channel: 'chrome' }); }

  console.log('=== השרת עוד לא הופעל ===');
  { const { c, p, errs } = await visit(b, { key: null, perm: true });
    t('בלי מפתח מהשרת — אין כפתור, יש הסבר', /עוד לא הופעלו/.test(await remText(p)) && !(await p.$('#thmSheet [data-rem="on"]')), await remText(p));
    t('הצבעים והדמות עדיין שם', await p.evaluate(() => document.querySelectorAll('#thmSheet .thm-opt').length === 3 && document.querySelectorAll('#thmSheet [data-thmfig]').length === 2));
    t('אין שגיאות', !errs.length, errs.join(' | ')); await c.close(); }

  console.log('=== הפעלה, שינוי וכיבוי ===');
  { const { c, p, errs, calls } = await visit(b, { key: KEY, perm: true });
    t('כפתור הפעלה אחד, עם הסבר מה יישלח', !!(await p.$('#thmSheet [data-rem="on"]')) && /3 ימים/.test(await remText(p)) && /חמישי/.test(await remText(p)));
    await p.tap('#thmSheet [data-rem="on"]'); await p.waitForTimeout(600);
    const sub = calls[0] || [], opts = await p.evaluate(() => window.__subOpts);
    t('נרשם אצל הדפדפן עם המפתח של השרת', opts && opts.visible === true && opts.keyLen === 65, JSON.stringify(opts));
    t('ההרשמה נשמרה בשרת עם ברירות המחדל', sub[0] === 'trainee_push_subscribe' && sub[1].p_token === 'tok-remind' && sub[1].p_endpoint === 'https://push.example/abc'
      && JSON.stringify(sub[1].p_prefs) === '{"workout":true,"weigh":true,"checkin":true,"coach":true,"hour":18}', JSON.stringify(sub));
    t('אחרי ההפעלה — ארבעה מתגים (כולל תגובה מהמאמן) ושעה', await p.evaluate(() => document.querySelectorAll('.thm-rem .rm.on').length === 4 && !!document.querySelector('.thm-rem [data-rem="coach"].on') && document.querySelector('[data-remhour]').value === '18'));
    await p.tap('[data-rem="weigh"]'); await p.waitForTimeout(400);
    t('כיבוי השקילה מגיע לשרת', calls[1] && calls[1][1].p_prefs.weigh === false && calls[1][1].p_prefs.workout === true, JSON.stringify(calls[1]));
    await p.selectOption('[data-remhour]', '7'); await p.waitForTimeout(400);
    t('שינוי שעה מגיע לשרת', calls[2] && calls[2][1].p_prefs.hour === 7, JSON.stringify(calls[2]));
    await p.tap('[data-rem="coach"]'); await p.waitForTimeout(400);
    t('כיבוי "תגובה מהמאמן" מגיע לשרת', calls[3] && calls[3][1].p_prefs.coach === false && calls[3][1].p_prefs.workout === true && calls[3][1].p_prefs.hour === 7, JSON.stringify(calls[3]));
    await p.reload(); await p.waitForSelector('.category-tile'); await p.waitForTimeout(900);
    await p.evaluate(() => { window.__sub = { endpoint: 'https://push.example/abc', toJSON() { return { endpoint: this.endpoint, keys: { p256dh: 'p'.repeat(60), auth: 'a'.repeat(20) } }; }, unsubscribe: async () => { window.__sub = null; return true; } }; });
    await p.tap('.top .theme-sw'); await p.waitForTimeout(700);
    t('ההעדפות נזכרות אחרי סגירה ופתיחה', await p.evaluate(() => document.querySelector('[data-remhour]').value === '7' && !document.querySelector('[data-rem="weigh"]').classList.contains('on')));
    await p.tap('[data-rem="off"]'); await p.waitForTimeout(500);
    const last = calls[calls.length - 1] || [];
    t('כיבוי הכול מוחק את ההרשמה מהשרת ומהדפדפן', last[0] === 'trainee_push_unsubscribe' && last[1].p_endpoint === 'https://push.example/abc' && await p.evaluate(() => !window.__sub) && !!(await p.$('#thmSheet [data-rem="on"]')), JSON.stringify(last));
    t('החלון נכנס במסך', await p.evaluate(() => { const s = document.querySelector('.thm-sheet').getBoundingClientRect(); return s.top >= 0 && s.bottom <= innerHeight + 1; }));
    t('אין שגיאות', !errs.length, errs.join(' | ')); await c.close(); }

  console.log('=== הצעה במסך הבית, ונחיתה מהתראה ===');
  { const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', permissions: ['notifications'] });
    await c.addInitScript(() => {
      const pm = { getSubscription: async () => window.__sub || null, subscribe: async () => { window.__sub = { endpoint: 'https://push.example/abc', toJSON() { return { endpoint: this.endpoint, keys: { p256dh: 'p'.repeat(60), auth: 'a'.repeat(20) } }; }, unsubscribe: async () => true }; return window.__sub; } };
      Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { ready: Promise.resolve({ pushManager: pm }), register: async () => ({ addEventListener() {}, update() {} }), getRegistrations: async () => [], addEventListener() {}, controller: null } });
      if (!('PushManager' in window)) window.PushManager = function () {};
    });
    const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); const calls = [];
    await p.route(/supabase\.co/, rt => {
      const fn = (rt.request().url().split('/rpc/')[1] || '').split('?')[0]; let body = 'null', a = {}; try { a = JSON.parse(rt.request().postData() || '{}'); } catch (e) {}
      if (fn === 'trainee_program') body = JSON.stringify([D]);
      if (fn === 'trainee_extras') body = JSON.stringify([{ logs: [], weighins: [], session_state: { terms: { at: '2026-10-01T10:00:00.000Z', version: '3' } } }]);
      if (fn === 'push_public_key') body = JSON.stringify(KEY);
      if (/^trainee_push_/.test(fn)) { calls.push([fn, a]); body = 'true'; }
      rt.fulfill({ status: 200, contentType: 'application/json', body });
    });
    const base = 'http://localhost:' + srv.address().port + '/t.html';
    await p.goto(base + '?go=workout#tok-remind2'); await p.waitForSelector('.category-tile'); await p.waitForTimeout(1800);
    t('נגיעה בהתראת אימון — האימון נפתח לבד', await p.evaluate(() => !!document.querySelector('#categoryModal .dayc.on .srow')));
    t('הכתובת מתנקה, כדי שרענון לא יפתח שוב', await p.evaluate(() => location.search === '' && location.hash === '#tok-remind2'));
    await p.evaluate(() => document.querySelector('[data-category-close]').click()); await p.waitForTimeout(400);
    t('במסך הבית: הצעה להפעיל תזכורות', !!(await p.$('[data-remind-card] [data-rem="on"]')));
    await p.tap('[data-remind-card] [data-rem="on"]'); await p.waitForTimeout(700);
    t('נגיעה אחת מפעילה, וההצעה נעלמת', calls[0] && calls[0][0] === 'trainee_push_subscribe' && !(await p.$('[data-remind-card]')), JSON.stringify(calls[0]));
    await p.evaluate(() => { localStorage.removeItem('eb_push_tok-remind2'); }); await p.reload(); await p.waitForSelector('.category-tile'); await p.waitForTimeout(1500);
    await p.tap('[data-remind-later]'); await p.waitForTimeout(300);
    await p.reload(); await p.waitForSelector('.category-tile'); await p.waitForTimeout(1500);
    t('"לא עכשיו" — ההצעה לא חוזרת בפתיחה הבאה', !(await p.$('[data-remind-card]')));
    t('אין שגיאות', !errs.length, errs.join(' | ')); await c.close(); }

  console.log('=== בלי אישור להתראות ===');
  { const { c, p, calls } = await visit(b, { key: KEY, perm: false });
    const has = !!(await p.$('#thmSheet [data-rem="on"]'));
    if (has) { await p.tap('#thmSheet [data-rem="on"]'); await p.waitForTimeout(600); }
    t('בלי אישור — לא נרשם, ויש הסבר', !calls.length && /לא ניתן אישור|חסומות/.test(await remText(p)), await remText(p));
    await c.close(); }
  await b.close(); srv.close();

  console.log('=== sw.js: הצגת ההתראה ===');
  { const L = {}, shown = [], opened = [];
    const self_ = { addEventListener: (k, f) => { L[k] = f; }, registration: { scope: 'https://x.test/app/', showNotification: (title, o) => { shown.push([title, o]); return Promise.resolve(); } },
      clients: { matchAll: async () => self_._open || [], openWindow: async u => { opened.push(u); }, claim: async () => {} }, skipWaiting: async () => {}, location: { href: 'https://x.test/app/sw.js' } };
    new Function('self', 'caches', 'fetch', fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'))(self_, {}, () => Promise.reject());
    let w; L.push({ data: { json: () => ({ title: 'יום שקילה', body: 'בוקר טוב', tag: 'bp-weigh', url: 't.html#tok', kind: 'weigh' }) }, waitUntil: x => { w = x; } }); await w;
    t('ההתראה מוצגת עם הכותרת, הטקסט והאייקון', shown[0] && shown[0][0] === 'יום שקילה' && shown[0][1].body === 'בוקר טוב' && shown[0][1].tag === 'bp-weigh' && /icon-192/.test(shown[0][1].icon) && shown[0][1].dir === 'rtl', JSON.stringify(shown[0]));
    L.push({ data: { json: () => { throw new Error('x'); } }, waitUntil: x => { w = x; } }); await w;
    t('הודעה פגומה לא מפילה — מוצגת התראה כללית', shown[1] && shown[1][0] === 'BAUER POWER');
    L.notificationclick({ notification: { close() {}, data: { url: 't.html#tok' } }, waitUntil: x => { w = x; } }); await w;
    t('נגיעה פותחת את דף המתאמן', opened[0] === 'https://x.test/app/t.html#tok', opened[0]);
    let focused = 0; self_._open = [{ url: 'https://x.test/app/t.html#tok', focus: async () => { focused++; } }];
    L.notificationclick({ notification: { close() {}, data: { url: 't.html#tok' } }, waitUntil: x => { w = x; } }); await w;
    t('אם הדף כבר פתוח — עוברים אליו ולא פותחים עוד אחד', focused === 1 && opened.length === 1);
    let msg = null; self_._open = [{ url: 'https://x.test/app/t.html#tok', focus: async () => {}, postMessage: m => { msg = m; } }];
    L.notificationclick({ notification: { close() {}, data: { url: 't.html?go=weigh#tok', kind: 'weigh' } }, waitUntil: x => { w = x; } }); await w;
    t('דף פתוח מקבל לאיזה מסך ללכת', msg && msg.go === 'weigh' && opened.length === 1, JSON.stringify(msg)); }

  console.log('\n' + (fail ? '### נכשלו: ' + fail : 'הכל עבר') + '  |  עברו: ' + pass);
  process.exit(fail ? 1 : 0);
})();

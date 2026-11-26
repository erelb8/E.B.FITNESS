/* דף המתאמן בטלפון צר (320×568) עם כל מה שנוסף בנובמבר 2026 בבת אחת:
   כרטיס תגובת המאמן (שלושה כפתורים), אימון שמחכה בתור והשרת סירב לו
   (שני כפתורים), "לכתוב למאמן" ו"להמליץ", מסך הסיכום עם שיא + כרטיס
   לשיתוף + המלצה, התצוגה הגדולה של הכרטיס, והיומן עם הערה, תגובה ושיתוף.
   הכלל: שום דבר לא מרחיב את העמוד, וכל כפתור בתוך המסך. */
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
let chromium;
try { ({ chromium } = require(ROOT + '/node_modules/playwright')); } catch (e) { console.log('דילוג: playwright לא מותקן'); process.exit(0); }
const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.json': 'application/json', '.css': 'text/css' };
const srv = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0].split('#')[0]));
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });

let pass = 0, fail = 0;
const t = (n, ok, i) => { ok ? pass++ : fail++; console.log((ok ? '✓ ' : '✗ ') + n + (ok ? '' : '  → ' + i)); };

const D = { name: 'אלכסנדרה בדיקה-ארוכה', goal: 'כוח', health: { signedAt: '2026-08-01', answers: {} }, trainer_name: 'אראל באואר',
  program: { days: [{ name: 'רגליים וגב תחתון — יום כבד', exercises: [{ name: 'סקוואט גבי עם מוט אולימפי', sets: '3', reps: '6-8', weight: '80' }] },
                    { name: 'חזה וכתפיים', exercises: [{ name: 'לחיצת חזה', sets: '3', reps: '8' }] }] },
  meals: [], meals_self: [], exercises_self: [], files: [] };
const LOGS = [
  { id: 'a1', date: '2026-11-17', dayName: 'רגליים וגב תחתון — יום כבד', note: null, coach: null, coachAt: null, coachSeen: false,
    entries: [{ ex: 'סקוואט גבי עם מוט אולימפי', done: true, weight: 80, reps: 6, sets: 3, setLog: [{ w: 75, r: 8 }, { w: 80, r: 6 }, { w: 80, r: 6 }] }] },
  { id: 'a2', date: '2026-11-24', dayName: 'חזה וכתפיים', feel: 'קשה', note: 'הכתף הימנית קצת הציקה בסט האחרון, ובסוף גם המרפק. לא משהו חזק אבל מרגיש.',
    coach: 'ראיתי. באימון הבא יורדים 5 ק״ג בלחיצה ועובדים על טווח תנועה מלא. אם זה חוזר — עוצרים וכותבים לי לפני שממשיכים.', coachAt: '2026-11-25T08:10:00+00:00', coachSeen: false,
    entries: [{ ex: 'לחיצת חזה', done: true, weight: 60, reps: 8, sets: 3, setLog: [{ w: 55, r: 8 }, { w: 60, r: 8 }, { w: 60, r: 7 }] }] }];
const WAIT = [{ cid: 'w1', date: '2026-11-25', at: '2026-11-25T18:00:00.000Z', tried: false,
  args: { p_day_index: 1, p_day_name: 'חזה וכתפיים', p_feel: null, p_note: null, p_entries: [{ ex: 'לחיצת חזה', done: true, weight: 60, reps: 8, cid: 'w1' }] } }];

/* מה יוצא מהמסך: רוחב העמוד, וכל כפתור/קישור שנראה */
const look = root => {
  const W = innerWidth, out = [];
  (root ? document.querySelectorAll(root + ' button, ' + root + ' a') : document.querySelectorAll('#wrap button, #wrap a')).forEach(e => {
    if (!e.offsetParent) return; const r = e.getBoundingClientRect();
    if (r.left < -1 || r.right > W + 1) out.push((e.innerText || e.className || e.tagName).slice(0, 18) + ' ' + Math.round(r.left) + '–' + Math.round(r.right));
  });
  return { scroll: document.documentElement.scrollWidth, W, out: out.slice(0, 4) };
};

(async () => {
  await new Promise(r => srv.listen(0, r));
  let b; try { b = await chromium.launch(); } catch (e) { try { b = await chromium.launch({ channel: 'chrome' }); } catch (e2) { console.log('דילוג: אין דפדפן ל-playwright'); srv.close(); process.exit(0); } }
  for (const theme of ['dark', 'light', 'mono']) {
    console.log('=== 320×568, ערכת ' + theme + ' ===');
    const c = await b.newContext({ viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
    await c.addInitScript(a => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1');
      localStorage.setItem('ebfit_outbox_tok-narrow-x', JSON.stringify(a.wait)); if (a.theme !== 'dark') localStorage.setItem('eb_theme', a.theme); }
      navigator.share = async () => {}; navigator.canShare = () => true; }, { wait: WAIT, theme });
    const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.clock.install({ time: new Date('2026-11-26T10:00:00') });
    let refuse = true;
    await p.route(/supabase\.co/, rt => {
      const fn = (rt.request().url().split('/rpc/')[1] || '').split('?')[0]; let body = 'null';
      if (fn === 'trainee_program') body = JSON.stringify([D]);
      if (fn === 'trainee_extras') body = JSON.stringify([{ logs: LOGS, weighins: [], session_state: { terms: { at: '2026-10-01T10:00:00.000Z', version: '3' } } }]);
      if (fn === 'trainee_coach') body = JSON.stringify({ name: 'אראל באואר', phone: '0541234567', business: 'BAUER POWER' });
      if (fn === 'trainee_save_state' || fn === 'trainee_feedback_seen') body = '1';
      if (fn === 'trainee_log') { if (refuse) return rt.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: 'P0001', message: 'too many logs today' }) }); body = '"00000000-0000-0000-0000-000000000001"'; }
      rt.fulfill({ status: 200, contentType: 'application/json', body });
    });
    await p.goto('http://localhost:' + srv.address().port + '/t.html#tok-narrow-x');
    await p.waitForSelector('.category-tile'); await p.waitForTimeout(2200);
    t('הערכה נטענה', await p.evaluate(() => document.documentElement.getAttribute('data-theme') || 'dark') === theme);
    const has = await p.evaluate(() => ({ fb: !!document.querySelector('[data-fb]'), fbBtns: document.querySelectorAll('[data-fb] .fb-a .btn').length, out: !!document.querySelector('[data-outbox] [data-out-drop]'),
      wa: !!document.querySelector('[data-coach-wa]'), fr: !!document.querySelector('[data-friend]') }));
    t('במסך הבית: תגובת המאמן (3 כפתורים), אימון שהשרת סירב לו, לכתוב למאמן ולהמליץ', has.fb && has.fbBtns === 3 && has.out && has.wa && has.fr, JSON.stringify(has));
    let r = await p.evaluate(look);
    t('מסך הבית לא רחב מהטלפון, וכל הכפתורים בפנים', r.scroll <= 321 && !r.out.length, JSON.stringify(r));

    /* היומן: הערה ארוכה, תגובה ארוכה, שיתוף */
    await p.tap('[data-fb-open]'); await p.waitForTimeout(600);
    r = await p.evaluate(() => { const W = innerWidth, bad = []; document.querySelectorAll('#categoryModal .wl-done, #categoryModal .wl-done *').forEach(e => { const q = e.getBoundingClientRect(); if (q.right > W + 1 || q.left < -1) bad.push(e.className || e.tagName); });
      return { scroll: document.documentElement.scrollWidth, bad: bad.slice(0, 3), note: !!document.querySelector('.wl-done-n'), rep: !!document.querySelector('.wl-done-c'), sh: !!document.querySelector('[data-wlshare]') }; });
    t('ביומן: ההערה, התגובה והשיתוף בתוך המסך', r.scroll <= 321 && !r.bad.length && r.note && r.rep && r.sh, JSON.stringify(r));
    await p.tap('[data-wlshare]'); await p.waitForTimeout(900);
    r = await p.evaluate(() => { const s = document.querySelector('#shareSheet .fin-sheet'); if (!s) return null; const q = s.getBoundingClientRect();
      const btn = [].every.call(s.querySelectorAll('button'), e => { const k = e.getBoundingClientRect(); return k.left >= 0 && k.right <= innerWidth + 1 && k.bottom <= innerHeight + 1 && k.top >= 0; });
      return { l: q.left, r: q.right, b: q.bottom, t: q.top, btn, img: !!s.querySelector('img').getAttribute('src') }; });
    t('תצוגת הכרטיס נכנסת כולה במסך, עם הכפתורים', !!r && r.l >= 0 && r.r <= 321 && r.t >= 0 && r.b <= 569 && r.btn && r.img, JSON.stringify(r));
    await p.tap('#shareSheet [data-share-close]'); await p.waitForTimeout(200);
    await p.evaluate(() => document.querySelector('[data-category-close]').click()); await p.waitForTimeout(300);

    /* סיכום אחרי אימון עם שיא: הכי הרבה שורות שיש */
    refuse = false;
    await p.evaluate(() => { const x = document.querySelector('.th-hero [data-go-day]'); x.dataset.goDay = '0'; x.click(); }); await p.waitForTimeout(500);
    await p.fill('#categoryModal .dayc.on [data-sf="w"][data-s="0"]', '85'); await p.fill('#categoryModal .dayc.on [data-sf="r"][data-s="0"]', '5'); await p.waitForTimeout(200);
    r = await p.evaluate(() => ({ scroll: document.documentElement.scrollWidth, bar: (() => { const d = document.getElementById('dateBar').getBoundingClientRect(); return d.left >= 0 && d.right <= innerWidth + 1; })() }));
    t('מסך האימון לא רחב מהטלפון', r.scroll <= 321 && r.bar, JSON.stringify(r));
    await p.evaluate(() => { const f = document.querySelector('#categoryModal .dayc.on [data-fin]'); f.scrollIntoView(); f.click(); });
    await p.waitForSelector('#finSheet'); await p.waitForTimeout(1200);
    r = await p.evaluate(() => { const s = document.querySelector('#finSheet .fin-sheet'), q = s.getBoundingClientRect();
      const inW = [].every.call(s.querySelectorAll('button, .fin-st div, .fin-pr, .fin-share'), e => { const k = e.getBoundingClientRect(); return k.left >= q.left - 1 && k.right <= q.right + 1; });
      const close = s.querySelector('[data-fin-close]'); close.scrollIntoView({ block: 'end' }); const k = close.getBoundingClientRect();
      return { l: q.left, r: q.right, t: q.top, b: q.bottom, inW, pr: /שיא חדש/.test(s.innerText), share: !!s.querySelector('.fin-share'), friend: !!s.querySelector('[data-friend]'),
               closeIn: k.top >= 0 && k.bottom <= innerHeight + 1, scroll: document.documentElement.scrollWidth }; });
    t('מסך הסיכום (שיא + שיתוף + המלצה) בתוך המסך, והסגירה בהישג יד', r.l >= 0 && r.r <= 321 && r.t >= 0 && r.b <= 569 && r.inW && r.pr && r.share && r.friend && r.closeIn && r.scroll <= 321, JSON.stringify(r));
    t('בלי שגיאות', !errs.length, errs.join(' | '));
    await c.close();
  }
  await b.close(); srv.close();
  console.log((fail ? '✗' : '✓') + ' דף המתאמן בטלפון צר: ' + pass + ' עברו' + (fail ? ', ' + fail + ' נכשלו' : ''));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  שגיאה בלתי צפויה: ' + (e && e.stack || e)); process.exit(1); });

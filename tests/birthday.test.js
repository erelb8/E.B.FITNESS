/* מזל טוב בימי הולדת (נובמבר 2026, אראל: "שליחת מזל טוב בימי הולדת").
   א. החישוב: היום עצמו, וה-29 בפברואר בשנה שאינה מעוברת.
   ב. המאמן: שורה ב"דורש טיפול" ביום עצמו, מיד אחרי כאב, עם ווטסאפ מוכן
      בלחיצה; אחרי ששלחו (או "בירכתי") היא יורדת ולא חוזרת בריענון.
   ג. המתאמן: כרטיס ברכה במסך הבית באותו יום בלבד, עד "תודה". הדף מקבל
      מהשרת רק "היום יום ההולדת" — לא את תאריך הלידה. */
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');

let pass = 0, fail = 0;
const t = (n, ok, i) => { ok ? pass++ : fail++; console.log((ok ? '✓ ' : '✗ ') + n + (ok ? '' : '  → ' + i)); };

/* ---------- א. החישוב, מהקוד האמיתי ---------- */
(function unit() {
  console.log('=== החישוב ===');
  const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace(/\r\n/g, '\n');
  const a = src.indexOf('function isBirthday(birth, today){'), b = src.indexOf('function bdayStore()', a);
  t('הפונקציות נמצאו ב-index.html', a > 0 && b > a);
  const { isBirthday, bdayAge } = new Function(src.slice(a, b) + '\nreturn { isBirthday, bdayAge };')();
  t('אותו יום ואותו חודש', isBirthday('1990-11-26', '2026-11-26') === true);
  t('יום אחר', isBirthday('1990-11-25', '2026-11-26') === false && isBirthday('1990-10-26', '2026-11-26') === false);
  t('בלי תאריך או תאריך שבור', !isBirthday('', '2026-11-26') && !isBirthday(null, '2026-11-26') && !isBirthday('26.11.1990', '2026-11-26'));
  t('נולד ב-29 בפברואר: בשנה רגילה מברכים ב-28', isBirthday('1996-02-29', '2027-02-28') === true && isBirthday('1996-02-29', '2027-03-01') === false);
  t('ובשנה מעוברת — ב-29 עצמו, לא ב-28', isBirthday('1996-02-29', '2028-02-29') === true && isBirthday('1996-02-29', '2028-02-28') === false);
  t('מי שנולד ב-28 בפברואר לא מושפע', isBirthday('1990-02-28', '2027-02-28') === true && isBirthday('1990-02-28', '2028-02-28') === true);
  t('הגיל', bdayAge('1996-11-26', '2026-11-26') === 30 && bdayAge('2026-11-26', '2026-11-26') === 0);
})();

let chromium;
try { ({ chromium } = require(ROOT + '/node_modules/playwright')); } catch (e) { chromium = null; }
const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.json': 'application/json', '.css': 'text/css' };
const srv = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0].split('#')[0]));
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });

async function coach(b) {
  for (const [name, w, h, mob] of [['מחשב', 1320, 900, false], ['טלפון 320', 320, 568, true]]) {
    console.log('=== המאמן, ' + name + ' ===');
    const c = await b.newContext({ viewport: { width: w, height: h }, isMobile: mob, hasTouch: mob, serviceWorkers: 'block' });
    await c.addInitScript(() => { window.__opened = []; window.open = (u) => { window.__opened.push(String(u)); return null; }; });
    const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await p.goto('http://localhost:' + srv.address().port + '/index.html');
    await p.waitForFunction(() => typeof vDash === 'function' && typeof isBirthday === 'function' && window.EBSync, null, { timeout: 30000 });
    const seed = pain => p.evaluate(pain => {
      if (window.EBSync) { EBSync.enabled = () => false; EBSync.schedule = () => {}; } window.save = () => {};
      const md = todayISO().slice(5), iso = d => addDays(todayISO(), -d);
      S.settings.trainer = 'אראל בדיקה';
      S.trainees = [
        { id: 'b1', name: 'דנה בדיקה', gender: 'נקבה', status: 'active', birth: '1996-' + md, phone: '050-123-4567', program: { days: [{ name: 'A', exercises: [{ name: 'סקוואט', sets: '3', reps: '5' }] }] }, meals: [], weighins: [{ date: iso(1), weight: 60 }], height: 165 },
        { id: 'b2', name: 'יואב בלי-טלפון', gender: 'זכר', status: 'paused', birth: '2000-' + md, phone: '', program: { days: [{ name: 'A', exercises: [{ name: 'סקוואט', sets: '3', reps: '5' }] }] }, meals: [], weighins: [{ date: iso(1), weight: 80 }], height: 180 },
        { id: 'b3', name: 'מיכל לא-היום', gender: 'נקבה', status: 'active', birth: '1990-' + addDays(todayISO(), 1).slice(5), phone: '0500000000', program: { days: [{ name: 'A', exercises: [{ name: 'סקוואט', sets: '3', reps: '5' }] }] }, meals: [], weighins: [{ date: iso(1), weight: 60 }], height: 165 },
        { id: 'b4', name: 'רון בארכיון', gender: 'זכר', status: 'archived', birth: '1990-' + md, phone: '0500000001', program: { days: [] }, meals: [] }];
      S.payments = []; S.sessions = [];
      DASH.logs = pain ? [{ id: 'p1', trainee_id: 'b3', date: iso(0), created_at: iso(0) + 'T09:00:00+00:00', day_name: 'A', entries: [1], feel: 'קשה', note: 'כאב בברך' }] : [];
      DASH.at = Date.now() + 1e9; DASH.alOpen = true; localStorage.removeItem('eb_bday_done'); VIEW = 'dash'; render(); window.scrollTo(0, 0);
    }, pain);
    const rows = () => p.evaluate(() => [].map.call(document.querySelectorAll('.dash-alerts .al-row'), e => e.innerText.replace(/\s+/g, ' ').trim()));
    const bd = async () => (await rows()).filter(x => /יום הולדת היום/.test(x));

    await seed(false); await p.waitForTimeout(300);
    let r = await bd();
    t('שורה לכל מי שחוגג היום — גם בהקפאה, לא בארכיון ולא מי שמחר', r.length === 2 && /לדנה בדיקה/.test(r[0] + r[1]) && /ליואב בלי-טלפון/.test(r[0] + r[1]) && !/מיכל|רון/.test(r.join('')), JSON.stringify(r));
    const dana = r.find(x => /דנה/.test(x)) || '', yoav = r.find(x => /יואב/.test(x)) || '';
    t('עם הגיל, לפי המין', /בת 30/.test(dana) && /בן 26/.test(yoav), dana + ' | ' + yoav);
    t('עם טלפון: "מזל טוב בווטסאפ"; בלי טלפון: "לתיק"', /מזל טוב בווטסאפ/.test(dana) && /לתיק/.test(yoav) && !/ווטסאפ/.test(yoav), dana + ' | ' + yoav);
    t('השורה הראשונה ברשימה כשאין כאב', /יום הולדת היום/.test((await rows())[0] || ''), (await rows())[0]);
    t('בלי אימוג׳י בלוח (אייקון קו)', await p.evaluate(() => { const x = [].find.call(document.querySelectorAll('.dash-alerts .al-row'), e => /יום הולדת/.test(e.innerText)); return !!x.querySelector('.al-ic svg') && !/[\u{1F300}-\u{1FAFF}☀-➿]/u.test(x.innerText); }));
    t('השורות בתוך המסך', await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
      && [].every.call(document.querySelectorAll('.dash-alerts .al-row button'), e => { if (!e.offsetParent) return true; const q = e.getBoundingClientRect(); return q.left >= -1 && q.right <= innerWidth + 1; })));

    await p.evaluate(() => { const x = [].find.call(document.querySelectorAll('.dash-alerts .al-row'), e => /דנה/.test(e.innerText)); x.querySelector('.al-btns .btn').click(); }); await p.waitForTimeout(300);
    const opened = await p.evaluate(() => window.__opened);
    const msg = opened[0] ? decodeURIComponent(opened[0].split('?text=')[1] || '') : '';
    t('נפתח ווטסאפ למספר שלה, בקידומת בינלאומית', opened.length === 1 && /^https:\/\/wa\.me\/972501234567\?text=/.test(opened[0]), JSON.stringify(opened));
    t('הברכה: שם פרטי, ובחתימה השם הפרטי של המאמן', /^מזל טוב דנה!/.test(msg) && /שנה חזקה/.test(msg) && /\nאראל$/.test(msg), JSON.stringify(msg));
    r = await bd();
    t('אחרי השליחה השורה שלה יורדת, של השני נשארת', r.length === 1 && /יואב/.test(r[0]), JSON.stringify(r));
    await p.evaluate(() => { const x = [].find.call(document.querySelectorAll('.dash-alerts .al-row'), e => /יואב/.test(e.innerText)); [].find.call(x.querySelectorAll('button'), q => /בירכתי/.test(q.innerText)).click(); }); await p.waitForTimeout(300);
    t('"בירכתי" מוריד את השורה בלי לפתוח כלום', (await bd()).length === 0 && (await p.evaluate(() => window.__opened.length)) === 1);
    await p.evaluate(() => render()); await p.waitForTimeout(150);
    const done = await p.evaluate(() => JSON.parse(localStorage.getItem('eb_bday_done') || '{}'));
    t('לא חוזר בריענון, ונשמר לפי שנה', (await bd()).length === 0 && done.b1 === String(new Date().getFullYear()) && done.b2 === done.b1, JSON.stringify(done));
    await p.evaluate(() => { localStorage.setItem('eb_bday_done', JSON.stringify({ b1: String(new Date().getFullYear() - 1) })); render(); }); await p.waitForTimeout(150);
    t('סימון משנה שעברה לא מסתיר את השנה', (await bd()).length === 2);

    await seed(true); await p.waitForTimeout(300);
    const all = await rows();
    t('כאב נשאר ראשון, ויום ההולדת מיד אחריו', /כאב בברך/.test(all[0] || '') && /יום הולדת היום/.test(all[1] || '') && /יום הולדת היום/.test(all[2] || ''), JSON.stringify(all.slice(0, 3)));
    t('בלי שגיאות', !errs.length, errs.join(' | '));
    await c.close();
  }
}

async function trainee(b) {
  console.log('=== המתאמן ===');
  const D = { name: 'דני בדיקה', goal: 'כוח', health: { signedAt: '2026-08-01', answers: {} }, trainer_name: 'אראל באואר',
    program: { days: [{ name: 'יום A', exercises: [{ name: 'סקוואט', sets: '3', reps: '6' }] }] }, meals: [], meals_self: [], exercises_self: [], files: [] };
  const c = await b.newContext({ viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.clock.install({ time: new Date('2026-11-26T10:00:00') });
  const S = { bday: true, known: true, fail: false };
  await p.route(/supabase\.co/, rt => {
    const fn = (rt.request().url().split('/rpc/')[1] || '').split('?')[0]; let body = 'null';
    if (fn === 'trainee_program') body = JSON.stringify([D]);
    if (fn === 'trainee_extras') body = JSON.stringify([{ logs: [], weighins: [], session_state: { terms: { at: '2026-10-01T10:00:00.000Z', version: '3' } } }]);
    if (fn === 'trainee_coach' && S.fail) return rt.abort('internetdisconnected');
    if (fn === 'trainee_coach') body = JSON.stringify(S.known ? { name: 'אראל באואר', phone: '0541234567', business: 'BAUER POWER', birthday: S.bday } : { name: 'אראל באואר', phone: '0541234567', business: 'BAUER POWER' });
    if (fn === 'trainee_save_state') body = 'true';
    rt.fulfill({ status: 200, contentType: 'application/json', body });
  });
  const url = 'http://localhost:' + srv.address().port + '/t.html';
  const load = async q => { await p.goto('about:blank'); await p.goto(url + (q || '') + '#tok-bday-x'); await p.waitForSelector('.category-tile'); await p.waitForTimeout(1400); };
  const card = () => p.evaluate(() => (document.querySelector('[data-bday]') || {}).innerText || '');

  await load();
  let txt = await card();
  t('ביום ההולדת: כרטיס ברכה עם השם הפרטי, וחתימה של המאמן והעסק', /מזל טוב, דני!/.test(txt) && /שנה חזקה/.test(txt) && /אראל · BAUER POWER/.test(txt), txt);
  t('הכרטיס מעל האריחים, ובתוך המסך', await p.evaluate(() => { const q = document.querySelector('[data-bday]').getBoundingClientRect(); return q.top < document.querySelector('.category-tile').getBoundingClientRect().top && q.left >= 0 && q.right <= innerWidth + 1 && document.documentElement.scrollWidth <= innerWidth + 1; }));
  t('תאריך הלידה עצמו לא נשמר במכשיר — רק היום שבו זה נכון', await p.evaluate(() => { const c = JSON.parse(localStorage.getItem('ebfit_coach_tok-bday-x') || '{}'); return c.bday === '2026-11-26' && !('birth' in c) && !/19\d\d|20[01]\d/.test(JSON.stringify(c)); }));
  await p.tap('[data-bday-ok]'); await p.waitForTimeout(200);
  t('"תודה" מוריד את הכרטיס', !(await p.$('[data-bday]')));
  await load();
  t('ולא חוזר באותו יום', !(await p.$('[data-bday]')));
  await p.evaluate(() => localStorage.removeItem('ebfit_bday_tok-bday-x'));
  await load('?go=bday');
  t('נגיעה בהתראה פותחת את הדף על הכרטיס, והכתובת נוקתה', await p.evaluate(() => { const c = document.querySelector('[data-bday]'); if (!c) return false; const q = c.getBoundingClientRect(); return q.top >= 0 && q.bottom <= innerHeight + 1 && !location.search; }));

  /* למחרת: השרת כבר אומר "לא", וגם העותק השמור במכשיר לא מציג */
  S.bday = false;
  await p.clock.setFixedTime(new Date('2026-11-27T09:00:00'));
  await load();
  t('למחרת אין כרטיס', !(await p.$('[data-bday]')));
  /* השרת לא עונה: הדף עובד מהעותק השמור מאתמול — והוא לא מציג ברכה היום */
  await p.evaluate(() => localStorage.setItem('ebfit_coach_tok-bday-x', JSON.stringify({ name: 'אראל באואר', phone: '0541234567', business: 'BAUER POWER', bday: '2026-11-26' })));
  S.fail = true; await load();
  t('עותק שמור מאתמול (בלי תשובה מהשרת) לא מציג ברכה היום', !(await p.$('[data-bday]')) && !!(await p.$('[data-coach-wa]')));
  S.fail = false;
  S.known = false; await load();
  t('שרת שעוד לא מכיר ימי הולדת — הדף כמו שהיה', !(await p.$('[data-bday]')) && !!(await p.$('[data-coach-wa]')));
  t('בלי שגיאות', !errs.length, errs.join(' | '));
  await c.close();
}

(async () => {
  if (!chromium) { console.log('דילוג על בדיקות הדפדפן: playwright לא מותקן'); }
  else {
    await new Promise(r => srv.listen(0, r));
    let b; try { b = await chromium.launch(); } catch (e) { try { b = await chromium.launch({ channel: 'chrome' }); } catch (e2) { b = null; console.log('דילוג: אין דפדפן ל-playwright'); } }
    if (b) { await coach(b); await trainee(b); await b.close(); }
    srv.close();
  }
  console.log((fail ? '✗' : '✓') + ' ימי הולדת: ' + pass + ' עברו' + (fail ? ', ' + fail + ' נכשלו' : ''));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  שגיאה בלתי צפויה: ' + (e && e.stack || e)); process.exit(1); });

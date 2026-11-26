/* "סיימתי" גם בלי רשת (נובמבר 2026).
   בחדר כושר בלי קליטה השליחה נכשלה והאימון נשאר תלוי. עכשיו:
   1. אימון שלא יצא נשמר בתור במכשיר, והמסך מתנהג כאילו נשלח.
   2. כשהרשת חוזרת הוא יוצא לבד — פעם אחת, עם התאריך שבו נעשה.
   3. בקשה שהגיעה לשרת אבל התשובה שלה אבדה לא נשלחת שוב (מזהה cid).
   4. כשהשרת מסרב (לא תקלת רשת) — לא נכנס לתור, והסימונים נשארים.
   5. בלי רשת עדיין רואים "בפעם הקודמת" מהיומן האחרון שנשמר במכשיר. */
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

const TOK = 'tok-queue-x', TODAY = '2026-11-26';
const D = { name: 'דני בדיקה', goal: 'כוח', health: { signedAt: '2026-08-01', answers: {} }, trainer_name: 'מאמן בדיקה',
  program: { days: [
    { name: 'יום A', exercises: [{ name: 'סקוואט', sets: '3', reps: '6-8', weight: '60', rest: '90' }, { name: 'מתח', sets: '3', reps: '8' }] },
    { name: 'יום B', exercises: [{ name: 'דדליפט', sets: '3', reps: '5' }] }] },
  meals: [], meals_self: [], exercises_self: [], files: [] };
const BASE = [{ date: '2026-11-20', dayName: 'יום A', entries: [{ ex: 'מתח', done: true, weight: 12, reps: 7 }] }];
/* אימון של אתמול שכבר מחכה בתור כשהדף נפתח */
const SEED = [{ cid: 'seed1', date: '2026-11-25', at: '2026-11-25T18:00:00.000Z', tried: false,
  args: { p_day_index: 1, p_day_name: 'יום B', p_feel: null, p_note: null, p_entries: [{ ex: 'דדליפט', done: true, weight: 100, reps: 5, sets: 1, setLog: [{ w: 100, r: 5 }], cid: 'seed1' }] } }];

(async () => {
  await new Promise(r => srv.listen(0, r));
  let b; try { b = await chromium.launch(); } catch (e) { b = await chromium.launch({ channel: 'chrome' }); }
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await c.addInitScript(seed => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1');
    localStorage.setItem('ebfit_outbox_tok-queue-x', JSON.stringify(seed)); } }, SEED);
  const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  p.on('dialog', d => d.accept());
  await p.clock.install({ time: new Date(TODAY + 'T10:00:00') });

  /* שרת מדומה. mode: ok | down (אין רשת) | lost (הבקשה נרשמה, התשובה אבדה) | refuse (השרת מסרב) */
  let mode = 'ok'; const got = []; const calls = { extras: 0 };
  const asLog = a => ({ date: a.p_date || TODAY, dayName: a.p_day_name, entries: a.p_entries, feel: a.p_feel });
  await p.route(/supabase\.co/, rt => {
    const fn = (rt.request().url().split('/rpc/')[1] || '').split('?')[0];
    if (mode === 'down') return rt.abort('internetdisconnected');
    if (fn === 'trainee_log') {
      const a = JSON.parse(rt.request().postData());
      if (mode === 'refuse') return rt.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: 'P0001', message: 'too many logs today', details: null, hint: null }) });
      got.push(a);
      if (mode === 'lost') return rt.abort('connectionreset');
      return rt.fulfill({ status: 200, contentType: 'application/json', body: '"00000000-0000-0000-0000-000000000001"' });
    }
    let body = 'null';
    if (fn === 'trainee_program') body = JSON.stringify([D]);
    if (fn === 'trainee_extras') { calls.extras++; body = JSON.stringify([{ logs: BASE.concat(got.map(asLog)), weighins: [], session_state: { terms: { at: '2026-10-01T10:00:00.000Z', version: '3' } } }]); }
    if (fn === 'trainee_save_state') body = 'true';
    rt.fulfill({ status: 200, contentType: 'application/json', body });
  });
  const box = () => p.evaluate(() => JSON.parse(localStorage.getItem('ebfit_outbox_tok-queue-x') || '[]'));
  const st = () => p.evaluate(() => JSON.parse(localStorage.getItem('ebfit_t_state_tok-queue-x') || '{}'));
  const home = sel => p.evaluate(sel => (document.querySelector(sel) || {}).innerText || '', sel);
  const openDay = async d => { await p.evaluate(d => { const x = document.querySelector('.th-hero [data-go-day]'); x.dataset.goDay = String(d); x.click(); }, d); await p.waitForTimeout(500); };
  const tapFinish = async () => { await p.evaluate(() => { const f = document.querySelector('#categoryModal .dayc.on [data-fin]'); f.scrollIntoView(); f.click(); }); };
  const stopRest = () => p.evaluate(() => { const x = document.querySelector('#restPill [data-rest="stop"]'); if (x) x.click(); });

  await p.goto('http://localhost:' + srv.address().port + '/t.html#' + TOK);
  await p.waitForSelector('.category-tile'); await p.waitForTimeout(1800);

  console.log('=== אימון שחיכה בתור יוצא כשהדף נפתח ===');
  t('נשלח פעם אחת', got.length === 1, String(got.length));
  t('עם התאריך שבו נעשה (אתמול)', got[0] && got[0].p_date === '2026-11-25' && got[0].p_day_name === 'יום B', JSON.stringify(got[0] && [got[0].p_date, got[0].p_day_name]));
  t('אותו דיווח בדיוק, עם המזהה', got[0] && got[0].p_entries[0].cid === 'seed1' && got[0].p_entries[0].weight === 100);
  t('התור התרוקן, והכרטיס ירד', (await box()).length === 0 && !(await p.$('[data-outbox]')));

  console.log('=== בלי רשת: "סיימתי" נשמר בטלפון ===');
  await openDay(0);
  await p.tap('#categoryModal .dayc.on .ex >> nth=0 >> [data-sok="0"]'); await p.waitForTimeout(250); await stopRest();
  await p.fill('#categoryModal .dayc.on .ex >> nth=0 >> [data-sf="w"][data-s="1"]', '65');
  await p.fill('#categoryModal .dayc.on .ex >> nth=0 >> [data-sf="r"][data-s="1"]', '7'); await p.waitForTimeout(200);
  mode = 'down'; await c.setOffline(true); await p.waitForTimeout(150);
  const before = got.length;
  await tapFinish(); await p.waitForTimeout(700);
  const fin = await home('#finSheet');
  t('מסך הסיכום אומר שנשמר בטלפון ויישלח לבד', /נשמר בטלפון/.test(fin) && /יישלח למאמן לבד/.test(fin) && !/נשלח למאמן\n/.test(fin), fin);
  t('הסיכום עם המספרים', /יום A/.test(fin) && /2\s*סטים/.test(fin), fin);
  let q = await box();
  t('האימון בתור, עם מזהה ועם התאריך', q.length === 1 && q[0].cid && q[0].date === TODAY && q[0].args.p_entries[0].cid === q[0].cid && q[0].args.p_entries[0].sets === 2 && q[0].tried === false, JSON.stringify(q));
  t('לא נשמר טוקן בתור', q.length === 1 && !('p_token' in q[0].args));
  t('שום דבר לא יצא לשרת', got.length === before);
  t('הסימונים של היום נוקו כמו אחרי שליחה', !Object.keys(await st()).some(k => /^0:\d+$/.test(k)), JSON.stringify(Object.keys(await st())));
  await p.tap('[data-fin-close]'); await p.waitForTimeout(300);
  const card = await home('[data-outbox]');
  t('במסך הבית: אימון אחד ממתין לשליחה', /אימון אחד ממתין לשליחה/.test(card) && /יישלח למאמן לבד/.test(card), card);
  t('השבוע סופר את האימון שמחכה', /[12]/.test(await p.evaluate(() => (document.querySelector('.th-ring') || {}).getAttribute('aria-label') || '')) && await p.evaluate(() => !!document.querySelector('.th-week button.today.on')),
    await p.evaluate(() => (document.querySelector('.th-ring') || {}).getAttribute('aria-label')));
  await p.tap('.category-tile[data-category="log"]'); await p.waitForTimeout(500);
  const day = await home('.wl-done');
  t('ביומן: האימון של היום מסומן "ממתין לשליחה"', /יום A/.test(day) && /ממתין לשליחה/.test(day) && /60×6 · 65×7/.test(day), day);
  t('ובלוח השנה היום מסומן', await p.evaluate(() => !!document.querySelector('.cal-g button.today.on')));
  await p.evaluate(() => document.querySelector('[data-category-close]').click()); await p.waitForTimeout(300);
  await p.tap('[data-out-send]'); await p.waitForTimeout(400);
  t('"לשלוח עכשיו" בלי רשת — נשאר בתור, עם הודעה', (await box()).length === 1 && /אין רשת/.test(await home('#toast')), await home('#toast'));

  console.log('=== הדף נפתח מחדש בלי שרת ===');
  await c.setOffline(false); await p.reload(); await p.waitForSelector('.category-tile'); await p.waitForTimeout(1200);
  t('הכרטיס עדיין שם אחרי פתיחה מחדש', /אימון אחד ממתין/.test(await home('[data-outbox]')));
  await openDay(0);
  const ph = await p.evaluate(() => [...document.querySelectorAll('#categoryModal .dayc.on .ex')].map(e => [...e.querySelectorAll('.srow input')].slice(0, 2).map(i => i.placeholder)));
  t('"בפעם הקודמת" מוצג גם בלי שרת (מהיומן השמור)', ph[1] && ph[1][0] === '12' && ph[1][1] === '7', JSON.stringify(ph));
  await p.evaluate(() => document.querySelector('[data-category-close]').click()); await p.waitForTimeout(300);

  console.log('=== הרשת חזרה ===');
  mode = 'ok'; const n0 = got.length;
  await p.evaluate(() => window.dispatchEvent(new Event('online'))); await p.waitForTimeout(2600);
  t('האימון יצא פעם אחת', got.length === n0 + 1, String(got.length - n0));
  const last = got[got.length - 1] || {};
  t('אותו דיווח שנשמר', last.p_entries && last.p_entries[0].cid === q[0].cid && last.p_day_name === 'יום A' && last.p_token === TOK && JSON.stringify(last.p_entries[0].setLog) === '[{"w":60,"r":6},{"w":65,"r":7}]', JSON.stringify(last.p_entries && last.p_entries[0]));
  t('אימון של היום — בלי תאריך', !('p_date' in last));
  t('התור התרוקן והכרטיס ירד', (await box()).length === 0 && !(await p.$('[data-outbox]')));
  t('הודעה שהאימון נשלח', /נשלח למאמן/.test(await home('#toast')), await home('#toast'));
  await p.tap('.category-tile[data-category="log"]'); await p.waitForTimeout(500);
  const day2 = await home('.wl-done');
  t('ביומן: אותו אימון, כבר בלי "ממתין"', /יום A/.test(day2) && !/ממתין/.test(day2) && (await p.$$('.wl-done')).length === 1, day2);
  await p.evaluate(() => document.querySelector('[data-category-close]').click()); await p.waitForTimeout(300);

  console.log('=== התשובה אבדה בדרך: לא נשלח פעמיים ===');
  await openDay(1);
  await p.fill('#categoryModal .dayc.on [data-sf="w"][data-s="0"]', '105'); await p.fill('#categoryModal .dayc.on [data-sf="r"][data-s="0"]', '5'); await p.waitForTimeout(200);
  mode = 'lost'; const n1 = got.length;
  await tapFinish(); await p.waitForTimeout(900);
  t('השרת קיבל, הדף חושב שלא — נכנס לתור', got.length === n1 + 1 && (await box()).length === 1 && (await box())[0].tried === true, got.length - n1 + ' / ' + (await box()).length);
  t('ומסך הסיכום אומר שנשמר בטלפון', /נשמר בטלפון/.test(await home('#finSheet')));
  await p.tap('[data-fin-close]'); await p.waitForTimeout(200);
  mode = 'ok';
  await p.evaluate(() => window.dispatchEvent(new Event('online'))); await p.waitForTimeout(2200);
  t('בדקה הראשונה לא שולחים שוב (הבקשה אולי עוד בדרך)', got.length === n1 + 1 && (await box()).length === 1);
  await p.clock.fastForward(46000); await p.waitForTimeout(1500);
  t('אחר כך: נמצא בשרת, ולכן יורד מהתור בלי שליחה שנייה', got.length === n1 + 1 && (await box()).length === 0, (got.length - n1) + ' / ' + (await box()).length);
  t('הכרטיס ירד', !(await p.$('[data-outbox]')));

  console.log('=== השרת מסרב: לא נכנס לתור ===');
  await openDay(0);
  await p.tap('#categoryModal .dayc.on .ex >> nth=1 >> [data-sok="0"]'); await p.waitForTimeout(250); await stopRest();
  mode = 'refuse'; const n2 = got.length;
  await tapFinish(); await p.waitForTimeout(700);
  t('הודעה ברורה', /יותר מדי דיווחים/.test(await home('#toast')), await home('#toast'));
  t('לא בתור, והסימון נשאר', (await box()).length === 0 && !!(await st())['0:1'] && got.length === n2);
  t('החלון נשאר פתוח והכפתור חזר', await p.evaluate(() => { const f = document.querySelector('#categoryModal .dayc.on [data-fin]'); return !!f && !f.disabled && /סיימתי/.test(f.textContent); }));
  t('אין מסך סיכום', !(await p.$('#finSheet')));

  console.log('=== השרת מסרב לאימון שבתור ===');
  await p.evaluate(() => document.querySelector('[data-category-close]').click()); await p.waitForTimeout(200);
  await p.evaluate(seed => { localStorage.setItem('ebfit_outbox_tok-queue-x', JSON.stringify([Object.assign({}, seed, { cid: 'seed2', date: '2026-11-24' })])); }, SEED[0]);
  await p.evaluate(() => window.dispatchEvent(new Event('online'))); await p.waitForTimeout(2400);
  q = await box();
  t('נשאר בתור עם הסיבה', q.length === 1 && /too many/.test(q[0].err || ''), JSON.stringify(q.map(x => x.err)));
  const bad = await home('[data-outbox]');
  t('הכרטיס מסביר ומציע מחיקה', /יותר מדי דיווחים/.test(bad) && !!(await p.$('[data-out-drop]')), bad);
  await p.tap('[data-out-drop]'); await p.waitForTimeout(400);
  t('מחיקה (אחרי אישור) מנקה את התור', (await box()).length === 0 && !(await p.$('[data-outbox]')));

  t('בלי שגיאות בדף', !errs.length, errs.join(' | '));
  await b.close(); srv.close();
  console.log((fail ? '✗' : '✓') + ' שליחה בלי רשת: ' + pass + ' עברו' + (fail ? ', ' + fail + ' נכשלו' : ''));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  שגיאה בלתי צפויה: ' + (e && e.stack || e)); process.exit(1); });

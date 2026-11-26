/* דף המתאמן (נובמבר 2026, תלונות של מתאמנים):
   1. סימון משקל וחזרות — שורה לכל סט עם וי משלה, במקום שדה אחד לכל התרגיל.
   2. לוח שנה ביומן — רואים מתי התאמנו.
   3. הוספת אימון ליום אחר — נרשם בתאריך שנבחר (עד 14 יום אחורה). */
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'); const { chromium } = require(ROOT + '/node_modules/playwright');
const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.json': 'application/json', '.css': 'text/css' };
const srv = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0].split('#')[0]));
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });

let pass = 0, fail = 0;
const t = (n, ok, i) => { ok ? pass++ : fail++; console.log((ok ? '✓ ' : '✗ ') + n + (ok ? '' : '  → ' + i)); };

const D = { name: 'דני בדיקה', goal: 'כוח', health: { signedAt: '2026-08-01', answers: {} },
  program: { days: [
    { name: 'יום A', exercises: [{ name: 'סקוואט', sets: '3', reps: '6-8', weight: '60', rest: '90' }, { name: 'מתח', sets: '3', reps: '8' }, { name: 'לחיצת רגליים', sets: '4', reps: '10' }] },
    { name: 'יום B', exercises: [{ name: 'דדליפט', sets: '3', reps: '5' }] }] },
  meals: [], meals_self: [], exercises_self: [], files: [] };
const LOGS = [{ date: '2026-11-20', day_name: 'יום A', entries: [{ ex: 'מתח', done: true, weight: 10, reps: 7 }] },
              { date: '2026-11-03', day_name: 'יום B', entries: [{ ex: 'דדליפט', done: true, weight: 100, reps: 5, setLog: [{ w: 90, r: 5 }, { w: 100, r: 5 }] }] }];

(async () => {
  await new Promise(r => srv.listen(0, r));
  let b; try { b = await chromium.launch(); } catch (e) { b = await chromium.launch({ channel: 'chrome' }); }
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await c.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1');
    localStorage.setItem('ebfit_t_state_tok-sets-x', JSON.stringify({ wk: '2026-11-22', '1:0': { weight: '95', reps: '5', done: true } })); } });
  const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); const sent = [];
  await p.clock.install({ time: new Date('2026-11-26T10:00:00') });
  await p.route(/supabase\.co/, rt => {
    const fn = (rt.request().url().split('/rpc/')[1] || '').split('?')[0]; let body = 'null';
    if (fn === 'trainee_program') body = JSON.stringify([D]);
    if (fn === 'trainee_extras') body = JSON.stringify([{ logs: LOGS, weighins: [], session_state: { terms: { at: '2026-10-01T10:00:00.000Z', version: '3' } } }]);
    if (fn === 'trainee_save_state') body = 'true';
    if (fn === 'trainee_log') { sent.push(JSON.parse(rt.request().postData())); body = '"00000000-0000-0000-0000-000000000001"'; }
    rt.fulfill({ status: 200, contentType: 'application/json', body });
  });
  await p.goto('http://localhost:' + srv.address().port + '/t.html#tok-sets-x');
  await p.waitForSelector('.category-tile'); await p.waitForTimeout(1500);
  const st = k => p.evaluate(k => JSON.parse(localStorage.getItem('ebfit_t_state_tok-sets-x') || '{}')[k], k);

  console.log('=== שורה לכל סט ===');
  await p.evaluate(() => { const b = document.querySelector('.th-hero [data-go-day]'); b.dataset.goDay = '0'; b.click(); }); await p.waitForTimeout(500);
  const ex0 = '#categoryModal .dayc.on .ex >> nth=0', ex1 = '#categoryModal .dayc.on .ex >> nth=1';
  const rows = await p.evaluate(() => [...document.querySelectorAll('#categoryModal .dayc.on .ex')].map(e => e.querySelectorAll('.srow').length));
  t('מספר השורות = מספר הסטים בתוכנית', JSON.stringify(rows) === '[3,3,4]', JSON.stringify(rows));
  const ph = await p.evaluate(() => [...document.querySelectorAll('#categoryModal .dayc.on .ex')].map(e => [...e.querySelectorAll('.srow input')].slice(0, 2).map(i => i.placeholder)));
  t('רמז: משקל המאמן; ובלי — הפעם הקודמת', ph[0][0] === '60' && ph[0][1] === '6' && ph[1][0] === '10' && ph[1][1] === '7', JSON.stringify(ph));
  await p.tap(ex0 + ' >> [data-sok="0"]'); await p.waitForTimeout(300);
  let s0 = await st('0:0');
  t('וי על סט ריק ממלא אותו מהרמז', s0.sets[0].ok && s0.sets[0].w === '60' && s0.sets[0].r === '6' && !s0.done, JSON.stringify(s0));
  t('אחרי וי מתחילה מנוחה לפי התוכנית', await p.evaluate(() => (document.querySelector('#restPill b') || {}).textContent) === '1:30');
  await p.fill(ex0 + ' >> [data-sf="w"][data-s="1"]', '65'); await p.fill(ex0 + ' >> [data-sf="r"][data-s="1"]', '7'); await p.waitForTimeout(200);
  s0 = await st('0:0');
  t('הקלדה מסמנת את הסט כבוצע', s0.sets[1].ok && s0.sets[1].w === '65' && !s0.done, JSON.stringify(s0.sets));
  /* מי שמקליד ואז נוגע בווי "לאשר" — הסט נשאר מסומן, ולא מתבטל */
  await p.evaluate(() => { const x = document.querySelector('#restPill [data-rest="stop"]'); if (x) x.click(); }); await p.waitForTimeout(100);
  t('סט שהוקלד מוצג כממתין לאישור', await p.$eval(ex0 + ' >> [data-srow="1"]', x => x.classList.contains('typed') && !x.classList.contains('ok')));
  await p.tap(ex0 + ' >> [data-sok="1"]'); await p.waitForTimeout(250);
  s0 = await st('0:0');
  t('וי אחרי הקלדה מאשר (לא מבטל) ומתחיל מנוחה', s0.sets[1].ok === true && !s0.sets[1].t && s0.sets[1].w === '65' && await p.evaluate(() => !!document.getElementById('restPill')) && await p.$eval(ex0 + ' >> [data-srow="1"]', x => x.classList.contains('ok')), JSON.stringify(s0.sets[1]));
  t('הסט הבא מקבל את הרמז מהסט שלפניו', await p.$eval(ex0 + ' >> [data-sf="w"][data-s="2"]', x => x.placeholder) === '65');
  await p.tap(ex0 + ' >> [data-sok="2"]'); await p.waitForTimeout(400);
  s0 = await st('0:0');
  t('כל הסטים — התרגיל מסומן, והמונה מתעדכן', s0.done === true && s0.sets[2].w === '65' && await p.evaluate(() => document.querySelector('#categoryModal .dayc.on .ex').classList.contains('done') && /1\/3/.test(document.querySelector('#categoryModal .dayc.on .daym').innerText)), JSON.stringify(s0));
  await p.tap(ex0 + ' >> [data-sok="2"]'); await p.waitForTimeout(200);
  t('ביטול וי על סט מבטל את סימון התרגיל, המספרים נשארים', (await st('0:0')).done === false && (await st('0:0')).sets[2].w === '65');
  await p.tap(ex0 + ' >> [data-sok="2"]'); await p.waitForTimeout(200);
  await p.tap(ex1 + ' >> [data-chk="1"]'); await p.waitForTimeout(300);
  const s1 = await st('0:1');
  t('הווי הגדול מסמן את כל הסטים וממלא מהרמז', s1.done && [0, 1, 2].every(q => s1.sets[q].ok && s1.sets[q].w === '10' && s1.sets[q].r === '7'), JSON.stringify(s1));
  await p.evaluate(() => { const f = document.querySelector('#categoryModal .dayc.on [data-fin]'); f.scrollIntoView(); f.click(); }); await p.waitForTimeout(900);
  const e0 = sent[0] && sent[0].p_entries[0], e1 = sent[0] && sent[0].p_entries[1], e2 = sent[0] && sent[0].p_entries[2];
  const fin0 = await p.evaluate(() => (document.getElementById('finSheet') || {}).innerText || '');
  t('אחרי "סיימתי" — מסך סיכום עם המספרים', /נשלח למאמן/.test(fin0) && /יום A/.test(fin0) && /2\s*תרגילים/.test(fin0) && /6\s*סטים/.test(fin0), fin0);
  await p.tap('[data-fin-close]'); await p.waitForTimeout(300);
  t('נשלח פירוט לכל סט, והסט הכבד כמשקל התרגיל', e0 && e0.done && e0.weight === 65 && e0.sets === 3 && JSON.stringify(e0.setLog) === '[{"w":60,"r":6},{"w":65,"r":7},{"w":65,"r":7}]', JSON.stringify(e0));
  t('תרגיל שלא נגעו בו נשלח כלא בוצע', e1 && e1.done && e2 && e2.done === false && !e2.setLog, JSON.stringify(e2));
  t('אימון של היום — בלי תאריך', sent[0] && !('p_date' in sent[0]));

  console.log('=== סימון ישן (שדה אחד) ===');
  await p.evaluate(() => { const b = document.querySelector('.th-hero [data-go-day]'); b.dataset.goDay = '1'; b.click(); }); await p.waitForTimeout(500);
  const leg = await p.evaluate(() => { const r = document.querySelector('#categoryModal .dayc.on .ex .srow'); return [...r.querySelectorAll('input')].map(i => i.value).join('x') + (r.classList.contains('ok') ? ' ok' : ''); });
  t('סימון מהגרסה הקודמת מופיע בסט הראשון ולא נעלם', leg === '95x5 ok', leg);
  await p.evaluate(() => { document.querySelector('[data-category-close]').click(); }); await p.waitForTimeout(300);

  console.log('=== לוח שנה ===');
  await p.tap('.category-tile[data-category="log"]'); await p.waitForTimeout(500);
  const cal = await p.evaluate(() => ({ n: document.querySelectorAll('.cal-g button').length, on: [...document.querySelectorAll('.cal-g button.on')].map(b => b.dataset.cal),
    today: (document.querySelector('.cal-g button.today') || {}).dataset.cal, fut: [...document.querySelectorAll('.cal-g button.fut')].every(b => b.disabled) && document.querySelectorAll('.cal-g button.fut').length,
    next: document.querySelector('[data-calnav="1"]').disabled, form: !!document.getElementById('wlForm'), title: document.querySelector('.cal-h b').textContent }));
  t('נובמבר 2026, 30 ימים, היום מסומן', cal.n === 30 && cal.today === '2026-11-26' && cal.title === 'נובמבר 2026', JSON.stringify(cal));
  t('ימי האימון מסומנים', JSON.stringify(cal.on) === '["2026-11-03","2026-11-20"]', JSON.stringify(cal.on));
  t('ימים עתידיים נעולים, ואין חודש הבא', cal.fut === 4 && cal.next === true, cal.fut + ' ' + cal.next);
  t('הטופס סגור עד שבוחרים להוסיף', !cal.form);
  await p.tap('.cal-g [data-cal="2026-11-03"]'); await p.waitForTimeout(300);
  const old = await p.evaluate(() => ({ txt: (document.querySelector('.wl-done') || {}).innerText || '', add: !!document.querySelector('[data-wladd]') }));
  t('יום שהתאמנו בו — רואים מה נעשה, סט-סט', /יום B/.test(old.txt) && /דדליפט/.test(old.txt) && /90×5 · 100×5/.test(old.txt), old.txt);
  t('יותר מ-14 יום אחורה — אין הוספה', !old.add);

  console.log('=== הוספת אימון ליום אחר ===');
  await p.tap('.cal-g [data-cal="2026-11-24"]'); await p.waitForTimeout(300);
  t('הכפתור אומר לאיזה יום', /24 בנובמבר/.test(await p.evaluate(() => document.querySelector('[data-wladd]').innerText)));
  await p.tap('[data-wladd]'); await p.waitForTimeout(500);
  t('נפתח מסך האימון עם התאריך שנבחר', /24 בנובמבר/.test(await p.evaluate(() => (document.querySelector('.logdate') || {}).innerText || '')) && !!(await p.$('#categoryModal .dayc .srow')));
  await p.evaluate(() => { const d = document.querySelector('#categoryModal .dayc[data-d="1"]'); if (!d.classList.contains('on')) d.querySelector('.dayh').click(); }); await p.waitForTimeout(300);
  await p.fill('#categoryModal .dayc[data-d="1"] [data-sf="w"][data-s="0"]', '100'); await p.fill('#categoryModal .dayc[data-d="1"] [data-sf="r"][data-s="0"]', '5'); await p.waitForTimeout(200);
  await p.evaluate(() => { const s = document.querySelector('#categoryModal .dayc[data-d="1"] [data-fin]'); s.scrollIntoView(); s.click(); }); await p.waitForTimeout(1200);
  const add = sent[1];
  t('נשמר בתאריך שנבחר', add && add.p_date === '2026-11-24' && add.p_day_name === 'יום B' && add.p_entries[0].weight === 100, JSON.stringify(add));
  const fin = await p.evaluate(() => (document.getElementById('finSheet') || {}).innerText || '');
  t('מסך סיכום: סטים, נפח, והתאריך', /נשלח למאמן/.test(fin) && /24 בנובמבר/.test(fin) && /500/.test(fin), fin);
  await p.tap('[data-fin-close]'); await p.waitForTimeout(500);
  t('אחרי הסיכום חוזרים ליומן, על אותו יום', await p.evaluate(() => !document.getElementById('finSheet') && !!document.querySelector('.cal') && (document.querySelector('.cal-g button.sel') || {}).dataset.cal === '2026-11-24'));
  t('פתיחה רגילה של האימון אחר כך — בלי תאריך', await p.evaluate(async () => { document.querySelector('[data-category-close]').click(); await new Promise(r => setTimeout(r, 200)); document.querySelector('.category-tile[data-category="workout"]').click(); await new Promise(r => setTimeout(r, 300)); const ok = !document.querySelector('.logdate'); document.querySelector('[data-category-close]').click(); await new Promise(r => setTimeout(r, 200)); document.querySelector('.category-tile[data-category="log"]').click(); await new Promise(r => setTimeout(r, 300)); return ok; }));
  await p.tap('[data-calnav="-1"]'); await p.waitForTimeout(300);
  t('חודש קודם', await p.evaluate(() => document.querySelector('.cal-h b').textContent === 'אוקטובר 2026' && document.querySelectorAll('.cal-g button').length === 31 && !document.querySelector('[data-calnav="1"]').disabled));
  t('הכול נכנס ברוחב הטלפון', await p.evaluate(() => { const d = document.querySelector('.category-dialog'); return d.scrollWidth <= d.clientWidth + 1; }));

  console.log('=== מעבר יום בכל מקום ===');
  const closeAll = () => p.evaluate(async () => { const x = document.querySelector('[data-category-close]'); if (x) x.click(); await new Promise(r => setTimeout(r, 250)); });
  await closeAll();
  /* מסך הבית: ימי השבוע, הטבעת, והחצים של האימון המוצע */
  const wk = await p.evaluate(() => ({ n: document.querySelectorAll('.th-week button').length, fut: document.querySelectorAll('.th-week button:disabled').length, today: (document.querySelector('.th-week .today') || {}).dataset.week }));
  t('פס השבוע: 7 ימים, העתידיים נעולים', wk.n === 7 && wk.fut === 2 && wk.today === '2026-11-26', JSON.stringify(wk));
  await p.tap('.th-week [data-week="2026-11-24"]'); await p.waitForTimeout(400);
  t('נגיעה ביום בשבוע פותחת את היומן על אותו יום', await p.evaluate(() => (document.querySelector('.cal-g button.sel') || {}).dataset.cal === '2026-11-24'));
  await p.tap('[data-calstep="1"]'); await p.waitForTimeout(250);
  const stepF = await p.evaluate(() => document.querySelector('.cal-g button.sel').dataset.cal);
  await p.tap('[data-calstep="1"]'); await p.waitForTimeout(250);
  t('ביומן: היום הבא, ונעצר בהיום', stepF === '2026-11-25' && await p.evaluate(() => document.querySelector('.cal-g button.sel').dataset.cal === '2026-11-26' && document.querySelector('[data-calstep="1"]').disabled));
  for (let k = 0; k < 26; k++) { await p.tap('[data-calstep="-1"]'); } await p.waitForTimeout(300);
  t('ביומן: יום קודם עובר גם לחודש הקודם', await p.evaluate(() => document.querySelector('.cal-g button.sel').dataset.cal === '2026-10-31' && document.querySelector('.cal-h b').textContent === 'אוקטובר 2026'));
  await closeAll();
  await p.tap('.th-ring'); await p.waitForTimeout(400);
  t('הטבעת פותחת את היומן', await p.evaluate(() => !!document.querySelector('#categoryModal .cal')));
  await closeAll();
  const h0 = await p.evaluate(() => document.querySelector('.th-next strong').textContent + '|' + document.querySelector('.th-hero [data-go-day]').dataset.goDay);
  await p.tap('[data-hero-day="1"]'); await p.waitForTimeout(300);
  const h1 = await p.evaluate(() => document.querySelector('.th-next strong').textContent + '|' + document.querySelector('.th-hero [data-go-day]').dataset.goDay + '|' + document.querySelector('.th-k').textContent);
  t('חצים בכרטיס הפתיחה מחליפים את האימון', h0.split('|')[1] !== h1.split('|')[1] && /האימון שבחרת|האימון הבא/.test(h1), h0 + ' → ' + h1);
  await p.tap('.th-hero [data-go-day]'); await p.waitForTimeout(500);
  t('"להתחיל את האימון" פותח את היום שנבחר', await p.evaluate(() => document.querySelector('#categoryModal .dayc.on').dataset.d) === h1.split('|')[1]);
  /* מסך האימון: חצי התאריך וחצי יום התוכנית */
  const bar0 = await p.evaluate(() => { const b = document.getElementById('dateBar'); return b.innerText.replace(/\s+/g, ' ') + '|' + b.classList.contains('logdate') + '|' + b.querySelector('[data-logdate-step="1"]').disabled; });
  t('במסך האימון: "האימון של היום", ואין יום הבא', /האימון של היום/.test(bar0) && /\|false\|true$/.test(bar0), bar0);
  await p.tap('[data-logdate-step="-1"]'); await p.waitForTimeout(200); await p.tap('[data-logdate-step="-1"]'); await p.waitForTimeout(200);
  const bar2 = await p.evaluate(() => document.getElementById('dateBar').innerText.replace(/\s+/g, ' '));
  t('חץ אחורה פעמיים — רושם ל-24 בנובמבר', /24 בנובמבר/.test(bar2) && /לפני 2 ימים/.test(bar2), bar2);
  const dBefore = await p.evaluate(() => document.querySelector('#categoryModal .dayc.on').dataset.d);
  await p.tap('#wprog [data-wday-step="1"]'); await p.waitForTimeout(500);
  const dAfter = await p.evaluate(() => document.querySelector('#categoryModal .dayc.on').dataset.d + '|' + document.getElementById('dateBar').innerText.replace(/\s+/g, ' '));
  t('חץ יום התוכנית מחליף יום ושומר על התאריך שנבחר', dAfter.split('|')[0] !== dBefore && /24 בנובמבר/.test(dAfter), dBefore + ' → ' + dAfter);
  const dNow = dAfter.split('|')[0];
  await p.evaluate(d => { const c = document.querySelector('#categoryModal .dayc[data-d="' + d + '"] [data-sok="0"]'); c.scrollIntoView(); c.click(); }, dNow); await p.waitForTimeout(300);
  await p.evaluate(d => { const r = document.querySelector('#restPill [data-rest="stop"]'); if (r) r.click(); const f = document.querySelector('#categoryModal .dayc[data-d="' + d + '"] [data-fin]'); f.scrollIntoView(); f.click(); }, dNow); await p.waitForTimeout(1000);
  const lastSent = sent[sent.length - 1];
  t('האימון נשלח לתאריך שנבחר בחצים', lastSent && lastSent.p_date === '2026-11-24' && lastSent.p_day_index === +dNow, JSON.stringify(lastSent && [lastSent.p_date, lastSent.p_day_index]));
  await p.evaluate(() => { const x = document.querySelector('[data-fin-close]'); if (x) x.click(); }); await p.waitForTimeout(400);
  for (let k = 0; k < 16; k++) { }
  await closeAll();
  await p.tap('.category-tile[data-category="workout"]'); await p.waitForTimeout(400);
  for (let k = 0; k < 16; k++) { const dis = await p.evaluate(() => document.querySelector('[data-logdate-step="-1"]').disabled); if (dis) break; await p.tap('[data-logdate-step="-1"]'); await p.waitForTimeout(60); }
  t('אחורה עד 14 יום ולא יותר', /12 בנובמבר/.test(await p.evaluate(() => document.getElementById('dateBar').innerText)) && await p.evaluate(() => document.querySelector('[data-logdate-step="-1"]').disabled));
  t('הכול נכנס ברוחב', await p.evaluate(() => { const d = document.querySelector('.category-dialog'); return d.scrollWidth <= d.clientWidth + 1 && document.documentElement.scrollWidth <= innerWidth + 1; }));

  t('אין שגיאות', !errs.length, errs.join(' | '));
  await b.close(); srv.close();
  console.log('\n' + (fail ? '### נכשלו: ' + fail : 'הכל עבר') + '  |  עברו: ' + pass);
  process.exit(fail ? 1 : 0);
})();

/* =====================================================================
   הגיבוי המלא — הכפתור "גיבוי מלא עכשיו" בהגדרות
   ---------------------------------------------------------------------
   ב-17.11.2026 אראל אמר "לא נותן לי לגבות". בפועל הקובץ ירד שלוש
   פעמים, אבל (1) ההודעה הייתה toast של שתי שניות, ו-(2) דיווחי המתאמנים
   לא היו בקובץ: השרת החזיר 500 (חריגה ממגבלת זמן), והשגיאה נבלעה.

   כאן, בכרומיום עם שרת מדומה ונתונים מומצאים:
     - גיבוי תקין יורד ומציג חלון עם הכמויות;
     - כשהעמוד הגדול של הדיווחים נכשל — עמודים קטנים משלימים את כולם;
     - כשהדיווחים נכשלים לגמרי — הקובץ עדיין יורד, והחלון אומר מה חסר;
     - כשהשרת נכשל בטבלה ראשית — חלון "הגיבוי לא ירד", בלי קובץ;
     - כשההעדפות נכשלות — גם זה נרשם כחסר (עד נובמבר 2026 נבלע);
     - גיבוי חלקי לא נרשם כ"גיבוי אחרון", כדי שהכרטיס ימשיך להזכיר.
   ===================================================================== */
const http = require('http'), fs = require('fs'), path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { console.log('דילוג: playwright לא מותקן'); process.exit(0); }

const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json',
                '.png': 'image/png', '.svg': 'image/svg+xml', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
  const f = path.join(ROOT, u === '/' ? 'index.html' : u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

let pass = 0, fail = 0;
function t(name, ok, info) { ok ? pass++ : fail++; if (!ok) console.log('FAIL  ' + name + (info ? '\n      ' + info : '')); }

(async () => {
  await new Promise(r => server.listen(0, r));
  let browser;
  try { browser = await chromium.launch(); }
  catch (e) { try { browser = await chromium.launch({ channel: 'chrome' }); }
              catch (e2) { console.log('דילוג: אין דפדפן ל-playwright'); server.close(); process.exit(0); } }

  /* mode: ok | bigfail (עמוד גדול נכשל) | logsfail | mainfail | prefsfail */
  async function runCase(mode) {
    const ctx = await browser.newContext({ serviceWorkers: 'block', acceptDownloads: true });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await p.goto('http://localhost:' + server.address().port + '/index.html');
    await p.waitForFunction(() => typeof vSettings === 'function' && window.EBBackup && typeof openModal === 'function', null, { timeout: 30000 });
    await p.evaluate(mode => {
      const LOGS = Array.from({ length: 40 }, (_, i) => ({ id: 'l' + i, trainee_id: 'a', date: '2026-11-01' }));
      const rows = { trainees: [{ id: 'a', name: 'מתאמן מומצא', files: [] }], sessions: [], measures: [{ id: 'm' }],
                     payments: [{ id: 'p1' }, { id: 'p2' }], trainer_prefs: [] };
      const q = t => {
        let lo = 0, hi = 1e9;
        const res = () => {
          if (mode === 'mainfail' && t === 'payments') return { data: null, error: { message: 'canceling statement due to statement timeout' } };
          if (mode === 'prefsfail' && t === 'trainer_prefs') return { data: null, error: { message: 'permission denied' } };
          if (t === 'workout_logs') {
            if (mode === 'logsfail' || (mode === 'bigfail' && hi - lo + 1 > 100))
              return { data: null, error: { message: 'canceling statement due to statement timeout' } };
            return { data: LOGS.slice(lo, hi + 1), error: null };
          }
          return { data: (rows[t] || []).slice(lo, hi + 1), error: null };
        };
        const o = { select() { return o; }, order() { return o; }, eq() { return o; },
                    range(a, b) { lo = a; hi = b; return Promise.resolve(res()); },
                    limit() { return Promise.resolve(res()); },
                    then(f, g) { return Promise.resolve(res()).then(f, g); } };
        return o;
      };
      EBSync.enabled = () => true; EBSync.schedule = () => {};
      EBSync.client = () => ({ from: q }); EBSync.user = () => ({ email: 'test@example.com' });
      EBSync.adminState = () => 'allowed'; window.EB_AUTH_READY = true; window.save = () => {};
      S.trainees = [{ id: 'a', name: 'מתאמן מומצא', program: { days: [] }, meals: [] }];
      go('settings');
    }, mode);
    await p.waitForTimeout(300);
    const btn = p.locator('#bk_run');
    let file = null;
    const dl = p.waitForEvent('download', { timeout: 6000 }).catch(() => null);
    await btn.click();
    const d = await dl;
    if (d) { const fp = await d.path(); file = JSON.parse(fs.readFileSync(fp, 'utf8')); }
    await p.waitForSelector('.modal .mh h3, #modal .mh h3, .mh h3', { timeout: 6000 }).catch(() => {});
    const modal = await p.evaluate(() => { const h = document.querySelector('.mh h3'); const b = h && h.closest('div').parentElement; return h ? { title: h.innerText, body: b.innerText } : null; });
    const btnText = await btn.innerText().catch(() => '');
    const last = await p.evaluate(() => localStorage.getItem('ebfit_backup_at'));
    await ctx.close();
    return { file, modal, errs, btnText, last };
  }

  const ok = await runCase('ok');
  t('גיבוי תקין: הקובץ ירד', !!ok.file);
  t('גיבוי תקין: כל 40 הדיווחים בקובץ', ok.file && (ok.file.טבלאות.workout_logs || []).length === 40,
    ok.file && JSON.stringify(Object.keys(ok.file.טבלאות)));
  t('גיבוי תקין: אין שדה "חסר"', ok.file && !ok.file.חסר);
  t('גיבוי תקין: חלון "הגיבוי ירד" עם שם הקובץ ומספר המתאמנים',
    ok.modal && /הגיבוי ירד/.test(ok.modal.title) && !/חסר/.test(ok.modal.title) && /ebfit-גיבוי-/.test(ok.modal.body) && /ההורדות/.test(ok.modal.body),
    JSON.stringify(ok.modal));
  t('הכפתור חוזר למצבו', ok.btnText === 'גיבוי מלא עכשיו', ok.btnText);

  const big = await runCase('bigfail');
  t('עמוד גדול נכשל: עמודים קטנים משלימים את כל 40', big.file && (big.file.טבלאות.workout_logs || []).length === 40,
    big.file && String((big.file.טבלאות.workout_logs || []).length));
  t('עמוד גדול נכשל: בלי אזהרה', big.modal && !/חסר/.test(big.modal.title), JSON.stringify(big.modal));

  const lf = await runCase('logsfail');
  t('דיווחים נכשלו: הקובץ עדיין ירד', !!lf.file);
  t('דיווחים נכשלו: הקובץ מסמן מה חסר', lf.file && Array.isArray(lf.file.חסר) && lf.file.חסר.length === 1);
  t('דיווחים נכשלו: החלון אומר שחסר', lf.modal && /חסר/.test(lf.modal.title) && /דיווחי המתאמנים/.test(lf.modal.body), JSON.stringify(lf.modal));

  const mf = await runCase('mainfail');
  t('טבלה ראשית נכשלה: לא ירד קובץ', !mf.file);
  t('טבלה ראשית נכשלה: חלון "הגיבוי לא ירד"', mf.modal && /לא ירד/.test(mf.modal.title), JSON.stringify(mf.modal));

  const pf = await runCase('prefsfail');
  t('העדפות נכשלו: הקובץ עדיין ירד', !!pf.file);
  t('העדפות נכשלו: הקובץ מסמן מה חסר', pf.file && Array.isArray(pf.file.חסר) && pf.file.חסר.length === 1 && /העדפות המאמן/.test(pf.file.חסר[0]),
    pf.file && JSON.stringify(pf.file.חסר));
  t('העדפות נכשלו: בלי טבלה ריקה שנראית תקינה', pf.file && !('trainer_prefs' in pf.file.טבלאות));
  t('העדפות נכשלו: החלון אומר שחסר', pf.modal && /חסר/.test(pf.modal.title) && /העדפות המאמן/.test(pf.modal.body), JSON.stringify(pf.modal));

  t('גיבוי מלא נרשם כגיבוי האחרון', !!ok.last, String(ok.last));
  t('גיבוי חלקי (דיווחים) לא נרשם כגיבוי האחרון', !!lf.file && !lf.last, String(lf.last));
  t('גיבוי חלקי (העדפות) לא נרשם כגיבוי האחרון', !!pf.file && !pf.last, String(pf.last));

  for (const r of [ok, big, lf, mf, pf]) t('בלי שגיאות בדף', !r.errs.length, r.errs.join(' | '));

  await browser.close(); server.close();
  console.log((fail ? '✗' : '✓') + ' גיבוי מלא: ' + pass + ' עברו' + (fail ? ', ' + fail + ' נכשלו' : ''));
  process.exit(fail ? 1 : 0);
})();

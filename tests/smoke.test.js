/* =====================================================================
   בדיקת עשן — האפליקציה ודף המתאמן בדפדפן אמיתי
   ---------------------------------------------------------------------
   הבדיקות האחרות רצות על מודולים בודדים ב-node. תקלות שנשברו בפועל
   (פונקציה שנמחקה בספריית התרגילים, חלון שלא נפתח, ציור מחדש שמחק
   הקלדה) נתפסו רק בבדיקה ידנית בדפדפן. כאן כל המסכים והחלונות העיקריים
   נפתחים בכרומיום, וכל שגיאה בדף מכשילה את הבדיקה.

   הנתונים מומצאים לגמרי — הריפו ציבורי, ומידע של מתאמנים לא נכנס לכאן.
   אין פנייה לשרת: כל קריאה ל-Supabase נענית כאן בתשובה מדומה.

   דורש playwright (כבר ב-package.json). אם הדפדפן לא מותקן — הבדיקה
   מדלגת ומודיעה, ולא נכשלת.
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

const iso = b => { const d = new Date(); d.setDate(d.getDate() - b); return d.toISOString().slice(0, 10); };
const PROGRAM = { days: [
  { name: 'יום A — חזה', exercises: [{ name: 'לחיצת חזה במוט', sets: '4', reps: '8-10', rest: '90' },
                                    { name: 'פרפר', sets: '3', reps: '12', rest: '60 שנ׳' }] },
  { name: 'יום B — רגליים', exercises: [{ name: 'סקוואט', sets: '4', reps: '6-8', weight: '60' }] }] };
const TRAINEE_DATA = {
  name: 'מתאמן בדיקה', goal: 'ירידה במשקל', trainer_name: 'מאמן בדיקה', height: 175, weight: 80,
  program: Object.assign({ targets: { kcal: 2200, protein: 150 } }, PROGRAM),
  meals: [{ id: 'm1', name: 'חביתה וסלט', type: 'breakfast', kcal: '420', protein: '28' }],
  meals_self: [], exercises_self: [], weighins: [{ date: iso(3), weight: 80.4 }], files: [], health: null
};

(async () => {
  await new Promise(r => server.listen(0, r));
  const BASE = 'http://localhost:' + server.address().port;
  let browser;
  try { browser = await chromium.launch(); }
  catch (e) { try { browser = await chromium.launch({ channel: 'chrome' }); }
              catch (e2) { console.log('דילוג: אין דפדפן ל-playwright'); server.close(); process.exit(0); } }

  // כל קריאה לשרת נענית כאן — שום דבר לא יוצא מהמחשב
  const fakeServer = async page => {
    await page.route(/supabase\.co/, route => {
      const u = route.request().url();
      const fn = (u.split('/rpc/')[1] || '').split('?')[0];
      let body = '[]';
      if (fn === 'trainee_program') body = JSON.stringify([TRAINEE_DATA]);
      else if (fn === 'trainee_extras') body = JSON.stringify([{ logs: [{ date: iso(2), day_name: 'יום A — חזה',
          entries: [{ ex: 'לחיצת חזה במוט', done: true, weight: 60, reps: 10 }], feel: 'בסדר' }],
          weighins: [], session_state: { terms: { at: new Date().toISOString(), version: '3' } } }]);
      else if (fn) body = 'null';
      route.fulfill({ status: 200, contentType: 'application/json', body });
    });
  };

  /* ================= האפליקציה של המאמן ================= */
  {
    /* serviceWorkers: 'block' — ה-Service Worker מרענן את הדף רגע אחרי
       שהוא עולה (גרסה חדשה), והבדיקה נקטעה באמצע. הוא לא מה שנבדק כאן. */
    const actx = await browser.newContext({ serviceWorkers: 'block' });
    const page = await actx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await fakeServer(page);
    await page.goto(BASE + '/index.html');
    // לא זמן קבוע — ממתינים שהאפליקציה באמת עלתה (במחשב עמוס זה לוקח יותר)
    await page.waitForFunction(() => typeof vDash === 'function' && window.EBExUI && window.EBLibUI && window.EBMeals, null, { timeout: 30000 });
    const r = await page.evaluate(async (P) => {
      const wait = ms => new Promise(x => setTimeout(x, ms));
      const out = { views: {}, tabs: [], modals: {} };
      if (window.EBSync) { EBSync.enabled = () => false; EBSync.schedule = () => {}; }
      window.save = () => {};
      const iso = b => addDays(todayISO(), -b);
      S.trainees = [
        { id: 'a1', name: 'דנה בדיקה', gender: 'נקבה', height: 165, birth: '1995-01-01', status: 'active',
          program: JSON.parse(JSON.stringify(P)), meals: [{ id: 'm', name: 'שקשוקה', type: 'breakfast', kcal: '559' }],
          weighins: [{ date: iso(2), weight: 62 }], phone: '0500000000',
          habitsLog: { marks: { [iso(1)]: { meals: { 'breakfast|שקשוקה': true } } } },
          foodLog: { [iso(0)]: [{ id: 'q', name: 'פיצה', k: 285 }] } },
        { id: 'b1', name: 'יוסי בדיקה', gender: 'זכר', status: 'active', program: { days: [] }, meals: [] }];
      S.payments = [{ id: 'p', traineeId: 'a1', date: iso(5), amount: 250, method: 'ביט', note: 'תוכנית אימונים' }];
      S.measures = [{ id: 'ms', traineeId: 'a1', date: iso(9), weight: 63 }];
      DASH.logs = [{ trainee_id: 'a1', date: iso(1), day_name: 'יום A — חזה', entries: [1, 2], feel: 'קשה', note: 'כואבת לי הכתף' }];
      DASH.at = Date.now() + 1e9;
      const V = document.getElementById('view');
      const views = { dash: vDash, trainees: vTrainees, schedule: vSchedule, money: vMoney, settings: vSettings,
                      progress: vProgress, lab: vLab };
      for (const k in views) { try { VIEW = k; V.innerHTML = views[k](); out.views[k] = V.innerText.length > 20; }
                               catch (e) { out.views[k] = 'ERR ' + e.message; } }
      for (const tb of ['details', 'program', 'measures', 'history', 'pay', 'meals', 'nutri', 'health', 'metrics', 'report', 'track', 'cardio']) {
        try { VIEW = 'trainee'; ARG = 'a1'; SUBTAB = tb; V.innerHTML = vTrainee('a1'); }
        catch (e) { out.tabs.push(tb + ': ' + e.message); }
      }
      const tryM = async (n, f) => { try { await f(); out.modals[n] = 'ok'; } catch (e) { out.modals[n] = 'ERR ' + e.message; } try { closeModal(); } catch (e) {} };
      await tryM('editTrainee', () => editTrainee('a1'));
      await tryM('openPay', () => openPay('a1'));
      await tryM('editPay', () => openPay(null, 'p'));
      await tryM('mealEdit', () => EBMeals.edit('a1'));
      await tryM('weekly', () => { openWeekly('a1'); if (!/סיכום השבוע/.test(document.getElementById('wa_t').value)) throw new Error('empty summary'); });
      await tryM('waMsg', () => waMsg('a1'));
      await tryM('mealLibrary', async () => { EBLibUI.browse('a1'); EBLibUI.setType('sec:thai');
        if (!document.querySelector('[data-mid]')) throw new Error('no thai meals'); });
      await tryM('exerciseLibrary', async () => {
        VIEW = 'trainee'; ARG = 'a1'; SUBTAB = 'program'; V.innerHTML = vTrainee('a1');
        EBExUI.open('a1', 0);
        const q = document.getElementById('ex_q'); if (!q) throw new Error('library did not open');
        q.value = 'סקוו'; q.dispatchEvent(new Event('input', { bubbles: true })); await wait(250);
        if (document.getElementById('ex_q') !== q) throw new Error('search box was rebuilt');
        const add = document.querySelector('#ex_list [data-exadd]:not([disabled])');
        if (!add) throw new Error('no add button'); add.click();
        const n = tById('a1').program.days[0].exercises.length; if (n !== 3) throw new Error('not added: ' + n);
      });
      await tryM('dayPlace', async () => {
        VIEW = 'trainee'; ARG = 'a1'; SUBTAB = 'program'; V.innerHTML = vTrainee('a1');
        const btn = [].find.call(V.querySelectorAll('button'), b => /מכון אגרוף/.test(b.textContent));
        if (!btn) throw new Error('no place buttons');
        btn.click();
        if (tById('a1').program.days[0].place !== 'box') throw new Error('place not saved');
        if (!/מכון אגרוף/.test(V.innerText)) throw new Error('place not shown on day');
        // הספרייה נפתחת מסוננת למכון: אגרוף כן, מכונות לא
        EBExUI.open('a1', 0);
        const txt = document.getElementById('ex_list').innerText;
        if (!/שק —/.test(txt)) throw new Error('no boxing exercises');
        if (/פרפר במכונה/.test(txt)) throw new Error('machine exercise in boxing gym');
        closeModal();
        V.innerHTML = vTrainee('a1');
        [].find.call(V.querySelectorAll('button'), b => /מכון אגרוף/.test(b.textContent)).click();
        if (tById('a1').program.days[0].place) throw new Error('place not cleared on second click');
      });
      await tryM('traineeReports', async () => {
        const en = EBSync.enabled, lf = EBSync.logsFor;
        EBSync.enabled = () => true;
        EBSync.logsFor = async () => [{ date: iso(1), day_name: 'יום A — חזה', feel: 'קשה', note: 'כואבת לי הכתף',
          entries: [{ ex: 'לחיצת חזה במוט', done: true, weight: 62.5, reps: 8, setLog: [{ w: 60, r: 10 }, { w: 62.5, r: 8 }] }] }];
        const R1 = window.render; window.render = () => { V.innerHTML = vTrainee('a1'); };
        VIEW = 'trainee'; ARG = 'a1'; SUBTAB = 'history'; window.render();
        await wait(400); window.render();
        const txt = V.innerText; window.render = R1; EBSync.enabled = en; EBSync.logsFor = lf;
        if (!/כואבת לי הכתף/.test(txt)) throw new Error('note missing');
        if (!/60×10 · 62.5×8/.test(txt)) throw new Error('sets missing: ' + txt.slice(0, 200));
      });
      await tryM('progressChart', async () => {
        const en = EBSync.enabled, lf = EBSync.logsFor;
        delete TLOGS['a1'];   // אחרת נשארים הדיווחים מהבדיקה הקודמת
        EBSync.enabled = () => true;
        EBSync.logsFor = async () => [
          { date: iso(16), entries: [{ ex: 'לחיצת חזה במוט', done: true, setLog: [{ w: 55, r: 10 }, { w: 55, r: 9 }] }] },
          { date: iso(9),  entries: [{ ex: 'לחיצת חזה במוט', done: true, setLog: [{ w: 60, r: 9 }, { w: 60, r: 8 }] }] },
          { date: iso(2),  entries: [{ ex: 'לחיצת חזה במוט', done: true, setLog: [{ w: 62.5, r: 8 }, { w: 62.5, r: 8 }] }] }];
        const R1 = window.render; window.render = () => { V.innerHTML = vTrainee('a1'); };
        VIEW = 'trainee'; ARG = 'a1'; SUBTAB = 'history'; window.render();
        await wait(400); window.render();
        const pc = V.querySelector('.pc'); if (!pc) throw new Error('no chart');
        if (!pc.querySelector('.pc-svg')) throw new Error('no svg');
        if (pc.querySelectorAll('.pc-dot').length !== 3) throw new Error('dots: ' + pc.querySelectorAll('.pc-dot').length);
        if (!/\+\d+%/.test(pc.querySelector('.pc-sum').innerText)) throw new Error('no gain: ' + pc.querySelector('.pc-sum').innerText);
        // מעבר למדד אחר ולטבלה
        pc.querySelector('[data-pcmk="vol"]').click();
        if (!V.querySelector('.pc-svg')) throw new Error('volume chart missing');
        V.querySelector('[data-pctab]').click();
        const tbl = V.querySelector('.pc-table'); if (!tbl) throw new Error('no table view');
        if (!/62.5×8/.test(tbl.innerText)) throw new Error('table sets missing');
        V.querySelector('[data-pctab]').click();
        window.render = R1; EBSync.enabled = en; EBSync.logsFor = lf;
      });
      await tryM('importProgram', () => EBImport.fromText('<table><tr><th>תרגיל</th><th>סטים</th></tr><tr><td>מתח</td><td>3</td></tr></table>', 't.html', 'b1'));
      // ציור מסנכרון באמצע הקלדה — אסור
      VIEW = 'trainee'; ARG = 'a1'; SUBTAB = 'program'; let renders = 0;
      const R0 = window.render; window.render = () => { renders++; V.innerHTML = vTrainee('a1'); };
      window.render();
      renders = 0;
      const cell = V.querySelector('td input.f'); cell.focus(); cell.value = '9'; cell.dispatchEvent(new Event('input', { bubbles: true }));
      window.renderFromSync();
      out.noRenderWhileTyping = renders === 0 && cell.isConnected;
      window.render = R0;
      // תשלום: רישום בלי כפתור שמירה, ואז עריכה — בלי רשומה כפולה
      await tryM('payFlow', async () => {
        const set = (id, v) => { const el = document.getElementById(id); if (!el) throw new Error('אין שדה ' + id);
          el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
        const n0 = S.payments.length;
        openPay('a1');
        set('p_t', 'a1'); set('p_amt', '400'); set('p_cat', 'תוכנית אימונים'); set('p_m', 'ביט'); set('p_note', 'בדיקה');
        await wait(800);
        const p = S.payments.filter(x => Number(x.amount) === 400);
        if (p.length !== 1) throw new Error('נשמרו ' + p.length + ' רשומות');
        if (p[0].category !== 'תוכנית אימונים' || p[0].method !== 'ביט' || p[0].note !== 'בדיקה') throw new Error('שדות חסרים');
        closeModal();
        openPay(null, p[0].id);
        if (document.getElementById('p_amt').value !== '400') throw new Error('העריכה לא טענה את הסכום');
        set('p_amt', '450'); await wait(800);
        if (S.payments.filter(x => x.id === p[0].id).length !== 1) throw new Error('העריכה שכפלה');
        if (Number(S.payments.filter(x => x.id === p[0].id)[0].amount) !== 450) throw new Error('העריכה לא נשמרה');
        if (S.payments.length !== n0 + 1) throw new Error('מספר התשלומים השתנה ביותר מאחד');
        closeModal();
      });
      // גיבוי ושחזור: הכל חוזר כמו שהיה
      await tryM('backupRestore', async () => {
        const C = window.confirm; window.confirm = () => true;   // השחזור שואל לפני שהוא דורס
        const snap = JSON.parse(JSON.stringify(S));
        const nT = S.trainees.length, nP = S.payments.length;
        const days = ((tById('a1').program || {}).days || []).length;
        S.trainees = []; S.payments = []; S.measures = [];
        applyBackup(snap, () => {});
        await wait(300);
        if (S.trainees.length !== nT) throw new Error('חזרו ' + S.trainees.length + ' מתוך ' + nT);
        if (S.payments.length !== nP) throw new Error('תשלומים: ' + S.payments.length + ' מתוך ' + nP);
        const t = tById('a1');
        if (!t || ((t.program || {}).days || []).length !== days) throw new Error('התוכנית לא חזרה');
        if (!t.meals || !t.meals.length) throw new Error('הארוחות לא חזרו');
        window.confirm = C;
      });
      return out;
    }, PROGRAM);
    for (const k in r.views) t('מסך ' + k, r.views[k] === true, String(r.views[k]));
    t('כל הלשוניות בתיק', !r.tabs.length, r.tabs.join(' | '));
    for (const k in r.modals) t('חלון ' + k, r.modals[k] === 'ok', r.modals[k]);
    t('אין ציור מחדש באמצע הקלדה', r.noRenderWhileTyping);
    t('אין שגיאות באפליקציה', !errs.length, errs.slice(0, 3).join(' | '));
    await actx.close();
  }

  /* ================= דף המתאמן ================= */
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await fakeServer(page);
    await page.goto(BASE + '/t.html#smoke-test-token');
    await page.waitForFunction(() => { const h = document.getElementById('hTitle'); return h && h.textContent === 'מתאמן בדיקה'
      && document.querySelector('.category-tile'); }, null, { timeout: 30000 });
    await page.waitForTimeout(600);   // loadExtras — אישור התקנון והיסטוריה
    t('דף המתאמן נטען', (await page.textContent('#hTitle')) === 'מתאמן בדיקה');
    t('הכותרת לא מציגה זבל', !/[)/]\s*·/.test(await page.textContent('#hSub')));
    t('אין מסך תקנון למי שאישר', !(await page.$('#termsGate')));
    for (const cat of ['יומן', 'אימון', 'תזונה', 'גוף', 'מעקב', 'הרגלים']) {
      const ok = await page.evaluate(async c => {
        document.querySelector('#categoryModal')?.remove();
        const b = [...document.querySelectorAll('.category-tile')].find(e => e.innerText.includes(c));
        if (!b) return 'no tile';
        b.click(); await new Promise(x => setTimeout(x, 400));
        const m = document.querySelector('#categoryModal');
        return m && m.innerText.length > 30 ? true : 'empty';
      }, cat);
      t('קטגוריה ' + cat, ok === true, String(ok));
    }
    // תזונה: "אכלתי?" נספר, הרישום החופשי נספר
    const food = await page.evaluate(async () => {
      const wait = ms => new Promise(x => setTimeout(x, ms));
      document.querySelector('#categoryModal')?.remove();
      [...document.querySelectorAll('.category-tile')].find(e => e.innerText.includes('תזונה')).click(); await wait(400);
      const sum = () => { const t = document.querySelector('#categoryModal').innerText; const i = t.indexOf('אכלתי היום'); return t.slice(i, i + 40); };
      const s0 = sum();
      document.querySelector('#categoryModal [data-habkind="meals"]').click(); await wait(300);
      const s1 = sum();
      const det = document.querySelector('#categoryModal details'); det.open = true;
      det.querySelector('[data-qf="n"]').value = 'תפוח'; det.querySelector('[data-qf="k"]').value = '80';
      det.querySelector('[data-qfadd]').click(); await wait(300);
      return { s0, s1, s2: sum() };
    });
    t('בהתחלה אכלתי היום = 0', /אכלתי היום\s*0/.test(food.s0), food.s0);
    t('"אכלתי?" נספר', /420/.test(food.s1), food.s1);
    t('רישום חופשי נספר', /500/.test(food.s2), food.s2);
    // תצוגת סטים/חזרות/מנוחה
    const spec = await page.evaluate(async () => {
      document.querySelector('#categoryModal')?.remove();
      [...document.querySelectorAll('.category-tile')].find(e => e.innerText.includes('אימון')).click();
      await new Promise(x => setTimeout(x, 400));
      return document.querySelector('#categoryModal').innerText;
    });
    t('מנוחה בלי יחידה כפולה', !/שנ׳שנ|שנ'שנ/.test(spec));
    t('מנוחה מקבלת יחידה', /מנוחה 90 שנ׳/.test(spec));
    t('אין undefined או NaN', !/undefined|NaN/.test(spec));
    t('אין שגיאות בדף המתאמן', !errs.length, errs.slice(0, 3).join(' | '));
    await ctx.close();
  }

  /* ================= פתיחה בלי רשת =================
     מאמן שכבר התחבר פעם חייב להיכנס לאפליקציה גם כשאין חיבור: הנתונים
     במכשיר, והבדיקה מול השרת תיסגר כשתחזור הרשת. עד ספטמבר 2026 כישלון
     רשת בהפעלה הציג מסך התחברות, והמאמן חשב שהאפליקציה נתקעה ואיבדה
     את התוכניות. */
  {
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.route(/supabase\.co/, route => {
      const fn = (route.request().url().split('/rpc/')[1] || '').split('?')[0];
      let body = '[]';
      if (fn === 'admin_login')   body = JSON.stringify([{ token: 'tok', admin_id: 'adm1', email: 'c@x.com' }]);
      if (fn === 'admin_session') body = JSON.stringify([{ admin_id: 'adm1', email: 'c@x.com' }]);
      route.fulfill({ status: 200, contentType: 'application/json', body });
    });
    await page.goto(BASE + '/index.html');
    await page.waitForFunction(() => window.EBSync && typeof vTrainee === 'function', null, { timeout: 30000 });
    await page.evaluate(async () => {
      await EBSync.signIn('c@x.com', 'pw');
      S.trainees = [{ id: 'a1', name: 'דנה', status: 'active', meals: [],
                      program: { days: [{ name: 'יום A', exercises: [{ name: 'סקוואט גבי', sets: '3', reps: '8' }] }] } }];
      save();
    });
    t('הזהות נשמרת במכשיר בהתחברות', await page.evaluate(() => !!localStorage.getItem('ebfit_admin_user')));

    await page.unroute(/supabase\.co/);
    await page.route(/supabase\.co/, route => route.abort('failed'));
    await page.reload();
    await page.waitForFunction(() => document.querySelectorAll('#rail .nav').length > 0
      || /כניסה למערכת|בודק הרשאות/.test(document.body.innerText), null, { timeout: 20000 }).catch(() => {});
    const off = await page.evaluate(async () => {
      const wait = ms => new Promise(r => setTimeout(r, ms));
      const V = document.getElementById('view');
      const out = { login: /כניסה למערכת/.test(document.body.innerText),
                    checking: /בודק הרשאות/.test(document.body.innerText),
                    nav: document.querySelectorAll('#rail .nav').length };
      go('trainee', 'a1'); SUBTAB = 'program'; render();
      out.screen = V.innerText.length;
      EBExUI.open('a1', 0);
      const b = document.querySelector('#ex_list [data-exadd]:not([disabled])');
      if (b) b.click();
      await wait(300);
      EBExUI.close(); commitProgram(); render();
      out.exercises = tById('a1').program.days[0].exercises.length;
      out.after = V.innerText.length;
      return out;
    });
    t('בלי רשת — לא מסך התחברות', !off.login);
    t('בלי רשת — לא נתקע על "בודק הרשאות"', !off.checking);
    t('בלי רשת — התפריט נטען', off.nav > 0, String(off.nav));
    t('בלי רשת — מסך התוכנית נפתח', off.screen > 500, off.screen + ' תווים');
    t('בלי רשת — אפשר להוסיף תרגיל', off.exercises === 2, 'יש ' + off.exercises);
    t('בלי רשת — המסך לא נעלם אחרי הוספה', off.after > 500, off.after + ' תווים');
    t('אין שגיאות במצב לא מקוון', !errs.length, errs.slice(0, 3).join(' | '));
    await ctx.close();
  }

  await browser.close();
  server.close();
  console.log(fail ? '\n' + fail + ' נכשלו  |  עברו: ' + pass : '\nהכל עבר  |  עברו: ' + pass);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  ' + e.message); server.close(); process.exit(1); });

/* =====================================================================
   צילום לוח הבקרה עם נתוני דוגמה — לבדיקה בעין לפני שינוי עיצוב
   ---------------------------------------------------------------------
   שימוש:   node tools/dash-shot.js <תיקיית הפלט> [מצבים] [אריחים]
   למשל:    node tools/dash-shot.js ../shots pd,pl,dd,dl stats,week,feed

   מצב = אות למסך + אות לצבע (+ e ללוח ריק):
     p טלפון 390 · t טאבלט 820 · d מחשב 1366 · w מסך רחב 1920
     d חום מט · l חום ולבן · m שחור ולבן   דוגמאות: pd, pl, pm, dd, dl, dm, td, wd, pde
   לכל מצב נשמרים <מצב>_1.png (המסך הראשון) ו-<מצב>_full.png (כל העמוד),
   ובטלפון גם <מצב>_tile_<אריח>.png לכל אריח שנפתח.

   הנתונים מומצאים (12 מתאמנים, 8 שבועות של דיווחים, תשלומים, צ'ק-אין)
   ונזרעים ישר לתוך S ו-DASH בדפדפן — בלי שרת ובלי נתונים אמיתיים. הם
   בנויים כך שכל חלק בלוח מתמלא: כאב, רצף "קשה", תוכנית שהסתיימה, מתאמן
   שנעלם, מי שלא שילם, אימונים היום.
   ===================================================================== */
const ROOT = require('path').join(__dirname, '..'), OUT = process.argv[2] || 'dash-shots', WHICH = (process.argv[3] || 'pd,pl,dd,dl').split(','), TILES = (process.argv[4] || 'stats,week,feed,unpaid').split(',');
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'));
fs.mkdirSync(OUT, { recursive: true });
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.css': 'text/css', '.webp': 'image/webp', '.jpg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
  const f = path.join(ROOT, u === '/' ? 'index.html' : u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
const PROGRAM = { days: [
  { name: 'יום A — חזה וכתפיים', exercises: [{ name: 'לחיצת חזה במוט', sets: '4', reps: '6-8', rest: '120' }, { name: 'לחיצת חזה בשיפוע במשקולות', sets: '3', reps: '8-10' },
    { name: 'הרחקות צד במשקולות', sets: '3', reps: '12-15' }, { name: 'פשיטת מרפק בפולי עם חבל', sets: '3', reps: '12' }] },
  { name: 'יום B — רגליים', exercises: [{ name: 'סקוואט גבי', sets: '4', reps: '5-6', weight: '80' }, { name: 'דדליפט רומני', sets: '3', reps: '8-10' }, { name: 'לחיצת רגליים', sets: '3', reps: '10-12' }] },
  { name: 'יום C — גב', exercises: [{ name: 'מתח אחיזה רחבה', sets: '4', reps: '6-8' }, { name: 'חתירה במוט בהטיה', sets: '3', reps: '8-10' }] }] };

const seed = (P, EMPTY) => {
  if (window.EBSync) { EBSync.enabled = () => false; EBSync.schedule = () => {}; }
  window.save = () => {};
  const iso = d => addDays(todayISO(), -d);
  let r = 7; const rnd = () => { r = (r * 1103515245 + 12345) & 0x7fffffff; return r / 0x7fffffff; };
  S.settings.trainer = 'אראל באואר';
  if (EMPTY) { S.trainees = []; S.payments = []; S.sessions = []; DASH.logs = []; DASH.at = Date.now() + 1e9; return; }
  const mk = (id, name, g, joined, extra) => Object.assign({ id, name, gender: g, status: 'active', height: g === 'נקבה' ? 164 : 178, birth: '1996-03-03', phone: '0500000000',
    program: JSON.parse(JSON.stringify(P)), meals: [], weighins: [], joined: iso(joined) }, extra || {});
  const plan = (t, months, start) => { t.program.planStart = iso(start); t.program.planMonths = months; return t; };
  const T = [
    plan(mk('a1', 'נועה לביא', 'נקבה', 70, { pkg: { k: 'coach', price: 350, months: 3 } }), 3, 70),
    plan(mk('a2', 'יואב שחר', 'זכר', 40, { pkg: { k: 'coach', price: 400, months: 3 } }), 3, 40),
    mk('a3', 'מיכל אורן', 'נקבה', 20, { program: { days: [] } }),
    plan(mk('a4', 'דניאל פרץ', 'זכר', 100, { pkg: { k: 'coach', price: 350, months: 3 } }), 3, 100),
    mk('a5', 'שירה גולן', 'נקבה', 55, { pkg: { k: 'train', price: 300 } }),
    plan(mk('a6', 'עומר נחום', 'זכר', 30, { pkg: { k: 'coach', price: 450, months: 6 } }), 6, 30),
    mk('a7', 'תמר אלון', 'נקבה', 25, { pkg: { k: 'trainfood', price: 400 } }),
    plan(mk('a8', 'איתי רוזן', 'זכר', 62, { pkg: { k: 'coach', price: 350, months: 3 } }), 3, 62),
    plan(mk('a9', 'הילה ברק', 'נקבה', 15, { pkg: { k: 'coach', price: 350, months: 3 } }), 3, 15),
    plan(mk('a10', 'רון שגיא', 'זכר', 80, { pkg: { k: 'coach', price: 350, months: 6 } }), 6, 80),
    mk('a11', 'ליאור דגן', 'זכר', 120, { status: 'paused' }),
    plan(mk('a12', 'מאיה צור', 'נקבה', 10, { pkg: { k: 'coach', price: 350, months: 3 } }), 3, 10)
  ];
  S.trainees = T;
  // payments: previous months for monthly packages, this month only part of them
  const pays = []; let pid = 0;
  const monthStart = b => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - b); d.setDate(3 + Math.floor(rnd() * 6)); return isoOf(d); };
  T.forEach(t => {
    if (!t.pkg) return;
    const joinedMonths = Math.min(5, Math.floor((Date.now() - new Date(t.joined + 'T00:00')) / 86400000 / 30));
    if (t.pkg.k !== 'coach') { pays.push({ id: 'p' + (pid++), traineeId: t.id, date: t.joined, amount: t.pkg.price, method: 'ביט', category: t.pkg.k === 'train' ? 'תוכנית אימונים' : 'אימונים + תזונה' }); return; }
    for (let b = joinedMonths; b >= 1; b--) pays.push({ id: 'p' + (pid++), traineeId: t.id, date: monthStart(b), amount: t.pkg.price, method: rnd() > .3 ? 'ביט' : 'מזומן', category: 'ליווי אונליין חודשי' });
    if (['a1', 'a2', 'a6', 'a8', 'a12'].includes(t.id)) pays.push({ id: 'p' + (pid++), traineeId: t.id, date: iso(Math.min(new Date().getDate() - 1, 2 + Math.floor(rnd() * 5))), amount: t.pkg.price, method: 'ביט', category: 'ליווי אונליין חודשי' });
  });
  S.payments = pays;
  // workout logs: 8 weeks, growing, a10 stopped 20 days ago
  const logs = []; const feels = ['טוב', 'טוב', 'קל', 'קשה', 'טוב'];
  T.forEach((t, ti) => {
    if (t.status !== 'active' || !(t.program.days || []).length) return;
    const start = Math.min(55, Math.floor((Date.now() - new Date(t.joined + 'T00:00')) / 86400000));
    for (let d = start; d >= 0; d--) {
      if (t.id === 'a10' && d < 20) continue;
      const p = 0.30 + ti * 0.012 + (55 - d) * 0.003;
      if (rnd() < p) { const day = P.days[(d + ti) % 3]; logs.push({ trainee_id: t.id, date: iso(d), created_at: iso(d) + 'T' + String(7 + Math.floor(rnd() * 13)).padStart(2, '0') + ':' + String(Math.floor(rnd() * 60)).padStart(2, '0') + ':00+00', day_name: day.name, entries: day.exercises.map((e, i) => i), feel: feels[Math.floor(rnd() * feels.length)] }); }
    }
  });
  const mine = id => logs.filter(l => l.trainee_id === id).sort((a, b) => b.created_at.localeCompare(a.created_at));
  if (mine('a8')[0]) { mine('a8')[0].note = 'כאב קל בברך ימין בסקוואט, הורדתי משקל'; mine('a8')[0].feel = 'קשה'; }
  mine('a2').slice(0, 2).forEach(l => { l.feel = 'קשה'; });
  if (mine('a1')[0]) mine('a1')[0].note = 'שיא חדש בלחיצת חזה! 42.5 ק״ג';
  DASH.logs = logs; DASH.at = Date.now() + 1e9;
  // weigh-ins
  T.forEach((t, ti) => { if (t.status !== 'active') return; let w = (t.gender === 'נקבה' ? 62 : 82) + ti; for (let d = 49; d >= 0; d -= 7) { if (t.id === 'a10' && d < 20) continue; const dd = d + (ti % 5); if (rnd() < .75) { w = Math.round((w - 0.3 + rnd() * 0.3) * 10) / 10; t.weighins.push({ date: iso(dd), weight: w }); } } });
  // sessions: two today, some done earlier
  S.sessions = [
    { id: 's1', traineeId: 'a1', date: todayISO(), time: '17:30', type: 'אימון אישי', status: 'scheduled' },
    { id: 's2', traineeId: 'a6', date: todayISO(), time: '19:00', type: 'אימון אישי', status: 'scheduled' },
    { id: 's3', traineeId: 'a2', date: iso(2), time: '18:00', type: 'אימון אישי', status: 'done' },
    { id: 's4', traineeId: 'a8', date: iso(9), time: '18:00', type: 'אימון אישי', status: 'done' }
  ];
  const mon = todayISO().slice(0, 7);
  tById('a1').checkins = [{ month: mon, sleep: 4, energy: 4, food: 3, mot: 5 }];
  tById('a2').checkins = [{ month: mon, sleep: 2, energy: 3, food: 3, mot: 4, note: 'ישן רע בגלל העבודה' }];
  tById('a6').checkins = [{ month: mon, sleep: 4, energy: 4, food: 4, mot: 4, pain: true, painNote: 'כתף שמאל בלחיצות' }];
};

(async () => {
  await new Promise(r => server.listen(0, r));
  const BASE = 'http://localhost:' + server.address().port;
  let b; try { b = await chromium.launch(); } catch (e) { b = await chromium.launch({ channel: 'chrome' }); }
  const errs = [];
  for (const v of WHICH) {
    const phone = v[0] === 'p', light = v[1] === 'l' ? 'light' : v[1] === 'm' ? 'mono' : '', empty = v[2] === 'e';
    const ctx = await b.newContext({ serviceWorkers: 'block', viewport: phone ? { width: 390, height: 844 } : v[0] === 't' ? { width: 820, height: 1100 } : v[0] === 'w' ? { width: 1920, height: 1000 } : { width: 1366, height: 860 }, deviceScaleFactor: phone ? 2 : 1, isMobile: phone, hasTouch: phone });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(v + ': ' + e.message));
    p.on('console', m => { if (m.type() === 'error') errs.push(v + ' console: ' + m.text().slice(0, 160)); });
    await p.route(/supabase\.co/, route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    if (light) await p.addInitScript(t => { try { localStorage.setItem('eb_theme', t); } catch (e) {} }, light);
    await p.goto(BASE + '/index.html');
    await p.waitForFunction(() => typeof vDash === 'function' && window.EBExUI, null, { timeout: 30000 });
    await p.evaluate(`(${seed.toString()})(${JSON.stringify(PROGRAM)}, ${empty})`);
    await p.evaluate(() => { VIEW = 'dash'; DASH.tile = ''; render(); window.scrollTo(0, 0); });
    await p.waitForTimeout(900);
    await p.screenshot({ path: path.join(OUT, v + '_1.png') });
    if (phone) {
      await p.addStyleTag({ content: '.mobnav{display:none!important}' });
      await p.screenshot({ path: path.join(OUT, v + '_full.png'), fullPage: true });
      for (const k of TILES) {
        const ok = await p.evaluate(k => { DASH.tile = k; render(); const e = document.getElementById('dpanel'); if (e) e.scrollIntoView(); return !!e; }, k);
        if (!ok) continue;
        await p.waitForTimeout(500);
        await p.screenshot({ path: path.join(OUT, v + '_tile_' + k + '.png'), fullPage: true });
      }
    } else {
      await p.screenshot({ path: path.join(OUT, v + '_full.png'), fullPage: true });
    }
    await ctx.close();
  }
  console.log('done', WHICH.join(','), '| errors', errs.length, errs.slice(0, 6).join(' || '));
  await b.close(); server.close();
})();

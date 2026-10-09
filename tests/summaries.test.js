/* סיכום השבוע שעבר וסיכום החודש שעבר בדף המתאמן — שעון מזויף, שרת מדומה */
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const { chromium } = require(ROOT + '/node_modules/playwright');
const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.json': 'application/json' };
const srv = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split('?')[0].split('#')[0]); const f = path.join(ROOT, u);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
});
let pass = 0, fail = 0;
const t = (n, ok, i) => { ok ? pass++ : fail++; console.log((ok ? '✓ ' : '✗ ') + n + (ok ? '' : '  → ' + i)); };
// "היום" = ראשון 11.10.2026. השבוע שעבר: 4.10–10.10. השבוע שלפניו: 27.9–3.10
const D = { name: 'מתאמן', goal: 'כוח', health: { signedAt: '2026-10-01', answers: {} },
  program: { days: [{ name: 'A', exercises: [{ name: 'לחיצת חזה במוט' }] }, { name: 'B', exercises: [{ name: 'סקוואט גבי' }] }, { name: 'C', exercises: [{ name: 'דדליפט קלאסי' }] }] },
  meals: [], meals_self: [], exercises_self: [], files: [],
  weighins: [{ date: '2026-10-01', weight: 80.4 }, { date: '2026-10-08', weight: 79.8 }] };
const L = (date, ex, sets) => ({ date, day_name: 'A', entries: [{ ex, done: true, setLog: sets.map(([w, r]) => ({ w, r })) }] });
const logs = [
  L('2026-09-29', 'לחיצת חזה במוט', [[60, 8], [60, 8]]),           // השבוע שלפני: 960
  L('2026-10-05', 'לחיצת חזה במוט', [[62.5, 8], [62.5, 8]]),       // שיא: 62.5 > 60
  L('2026-10-07', 'סקוואט גבי', [[80, 5]])                          // פעם ראשונה — לא שיא
];
const DM = { name: 'מתאמן', goal: 'כוח', health: { signedAt: '2026-10-01', answers: {} },
  program: { days: [{ name: 'A', exercises: [{ name: 'לחיצת חזה במוט' }] }, { name: 'B', exercises: [{ name: 'סקוואט גבי' }] }, { name: 'C', exercises: [{ name: 'דדליפט קלאסי' }] }] },
  meals: [], meals_self: [], exercises_self: [], files: [],
  weighins: [{ date: '2026-09-28', weight: 81.0 }, { date: '2026-10-12', weight: 80.2 }, { date: '2026-10-30', weight: 79.5 }] };
const LM = (date, ex, sets) => ({ date, day_name: 'A', entries: [{ ex, done: true, setLog: sets.map(([w, r]) => ({ w, r })) }] });
const logsM = [
  LM('2026-09-10', 'לחיצת חזה במוט', [[60, 8], [60, 8]]),
  LM('2026-10-05', 'לחיצת חזה במוט', [[62.5, 8], [62.5, 8]]), LM('2026-10-20', 'לחיצת חזה במוט', [[65, 6]]),
  LM('2026-10-07', 'סקוואט גבי', [[80, 5]])
];
async function open(b, when, lg, label) {
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, serviceWorkers: 'block' });
  const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.clock.install({ time: new Date(when) });
  await p.route(/supabase\.co/, rt => {
    const fn = (rt.request().url().split('/rpc/')[1] || '').split('?')[0]; let body = 'null';
    if (fn === 'trainee_program') body = JSON.stringify([D]);
    if (fn === 'trainee_extras') body = JSON.stringify([{ logs: lg, weighins: D.weighins, session_state: { terms: { at: new Date(when).toISOString(), version: '3' } } }]);
    rt.fulfill({ status: 200, contentType: 'application/json', body });
  });
  await p.goto('http://localhost:' + srv.address().port + '/t.html#tok-' + label);
  await p.waitForSelector('.category-tile'); await p.waitForTimeout(1500);
  const card = await p.evaluate(() => { const b = document.querySelector('[data-week-hide]'); return b ? b.closest('.card').innerText : ''; });
  return { c, p, errs, card };
}
async function openM(b, when, lg, label) {
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, serviceWorkers: 'block' });
  const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.clock.install({ time: new Date(when) });
  await p.route(/supabase\.co/, rt => {
    const fn = (rt.request().url().split('/rpc/')[1] || '').split('?')[0]; let body = 'null';
    if (fn === 'trainee_program') body = JSON.stringify([DM]);
    if (fn === 'trainee_extras') body = JSON.stringify([{ logs: lg, weighins: DM.weighins, session_state: { terms: { at: new Date(when).toISOString(), version: '3' } } }]);
    rt.fulfill({ status: 200, contentType: 'application/json', body });
  });
  await p.goto('http://localhost:' + srv.address().port + '/t.html#tok-' + label);
  await p.waitForSelector('.category-tile'); await p.waitForTimeout(1500);
  const card = await p.evaluate(() => { const b = document.querySelector('[data-month-hide]'); return b ? b.closest('.card').innerText : ''; });
  return { c, p, errs, card };
}
(async () => {
  await new Promise(r => srv.listen(0, r));
  let b; try { b = await chromium.launch(); } catch (e) { b = await chromium.launch({ channel: 'chrome' }); }
  console.log('=== סיכום שבועי ===');
  {
    const { c, p, errs, card } = await open(b, '2026-10-11T10:00:00', logs, 'w1');
    t('ראשון — הסיכום מופיע', !!card, card);
    t('2 אימונים מתוך 3', /2 מתוך 3/.test(card), card);
    t('נפח 1,400 (+46%)', /1,400/.test(card) && /\+46%/.test(card), card);
    t('שיא חדש בלחיצת חזה 62.5', /שיא חדש/.test(card) && /לחיצת חזה במוט 62.5/.test(card), card);
    t('סקוואט בפעם הראשונה — לא שיא', !/סקוואט/.test(card), card);
    t('משקל 80.4 → 79.8 (-0.6)', /80\.4 → 79\.8 \(-0\.6\)/.test(card), card);
    await p.click('[data-week-hide]'); await p.waitForTimeout(300);
    t('"סגירה" מסתיר', !(await p.$('[data-week-hide]')));
    await p.reload(); await p.waitForSelector('.category-tile'); await p.waitForTimeout(1500);
    t('נשאר סגור אחרי רענון', !(await p.$('[data-week-hide]')));
    t('אין שגיאות', !errs.length, errs.join(' | '));
    await c.close();
  }
  {
    const { c, card } = await open(b, '2026-10-15T10:00:00', logs, 'w2');
    t('חמישי — לא מופיע', !card, card);
    await c.close();
  }
  {
    const { c, card } = await open(b, '2026-10-11T10:00:00', [logs[0]], 'w3');
    t('שבוע בלי אימונים — לא מופיע', !card, card);
    await c.close();
  }
  console.log('=== סיכום חודשי ===');
  {
    const { c, p, errs, card } = await openM(b, '2026-11-02T10:00:00', logsM, 'm1');
    t('2.11 — סיכום אוקטובר מופיע', /סיכום אוקטובר/.test(card), card);
    t('3 אימונים, בספטמבר 1', /3/.test(card) && /בספטמבר: 1/.test(card), card);
    t('שיא חדש: לחיצת חזה 65', /לחיצת חזה במוט 65/.test(card), card);
    t('סקוואט פעם ראשונה — לא שיא', !/סקוואט/.test(card), card);
    t('משקל 81 → 79.5 (-1.5)', /81 → 79\.5 \(-1\.5\)/.test(card), card);
    const wk = await p.$('[data-week-hide]');
    t('הסיכום השבועי לא מוצג יחד איתו', !wk);
    await p.click('[data-month-hide]'); await p.waitForTimeout(300);
    t('"סגירה" מסתיר', !(await p.$('[data-month-hide]')));
    await p.reload(); await p.waitForSelector('.category-tile'); await p.waitForTimeout(1500);
    t('נשאר סגור אחרי רענון', !(await p.$('[data-month-hide]')));
    t('אין שגיאות', !errs.length, errs.join(' | '));
    await c.close();
  }
  {
    const { c, card } = await openM(b, '2026-11-07T10:00:00', logsM, 'm2');
    t('7.11 — לא מופיע', !card, card);
    await c.close();
  }
  {
    const { c, card } = await openM(b, '2026-11-02T10:00:00', [logsM[0]], 'm3');
    t('חודש בלי אימונים — לא מופיע', !card, card);
    await c.close();
  }
  await b.close(); srv.close();
  console.log('\n' + (fail ? 'נכשלו: ' + fail : 'הכל עבר') + '  |  עברו: ' + pass);
  process.exit(fail ? 1 : 0);
})();

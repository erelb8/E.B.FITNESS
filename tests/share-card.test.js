/* כרטיס סיכום לשיתוף ו"להמליץ לחבר" (נובמבר 2026).
   1. אחרי "סיימתי": תמונה ממותגת מוכנה מראש, ושיתוף בנגיעה אחת —
      דרך חלון השיתוף של הטלפון, ובלעדיו כהורדה של התמונה.
   2. בכרטיס רק מה שהמתאמן עשה. שם המתאמן לא מופיע בו.
   3. שיא או אימון עגול — מוצעת גם המלצה לחבר; באימון רגיל לא.
   4. כל אימון ביומן אפשר לשתף, עם השיאים שהיו נכונים לאותו יום. */
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

const TOK = 'tok-share-x';
const D = { name: 'דני בדיקה', goal: 'כוח', health: { signedAt: '2026-08-01', answers: {} }, trainer_name: 'אראל באואר',
  program: { days: [{ name: 'רגליים וגב', exercises: [{ name: 'סקוואט', sets: '3', reps: '6-8', weight: '80' }, { name: 'מתח', sets: '3', reps: '8' }] },
                    { name: 'חזה וכתפיים', exercises: [{ name: 'לחיצת חזה', sets: '3', reps: '8' }] }] },
  meals: [], meals_self: [], exercises_self: [], files: [] };
const LOGS = [
  { date: '2026-11-10', dayName: 'רגליים וגב', entries: [{ ex: 'סקוואט', done: true, weight: 75, reps: 6, sets: 2, setLog: [{ w: 70, r: 8 }, { w: 75, r: 6 }] }] },
  { date: '2026-11-17', dayName: 'רגליים וגב', entries: [{ ex: 'סקוואט', done: true, weight: 80, reps: 6, sets: 2, setLog: [{ w: 75, r: 8 }, { w: 80, r: 6 }] }] },
  { date: '2026-11-20', dayName: 'חזה וכתפיים', entries: [{ ex: 'לחיצת חזה', done: true, weight: 60, reps: 8, sets: 1, setLog: [{ w: 60, r: 8 }] }] }];

(async () => {
  await new Promise(r => srv.listen(0, r));
  let b; try { b = await chromium.launch(); } catch (e) { try { b = await chromium.launch({ channel: 'chrome' }); } catch (e2) { console.log('דילוג: אין דפדפן ל-playwright'); srv.close(); process.exit(0); } }

  /* share: true — לטלפון יש חלון שיתוף; false — דפדפן בלי שיתוף קבצים */
  async function open(share, extra) {
    const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', acceptDownloads: true });
    await c.addInitScript(share => {
      window.__shared = [];
      if (share) { navigator.share = async d => { window.__shared.push({ text: d.text || '', files: (d.files || []).map(f => ({ name: f.name, type: f.type, size: f.size })) }); };
                   navigator.canShare = d => !!(d && d.files && d.files.length); }
      else { try { delete Navigator.prototype.share; delete Navigator.prototype.canShare; } catch (e) {} navigator.share = undefined; navigator.canShare = undefined; }
    }, share);
    const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.clock.install({ time: new Date('2026-11-26T10:00:00') });
    const logs = LOGS.concat(extra || []);
    await p.route(/supabase\.co/, rt => {
      const fn = (rt.request().url().split('/rpc/')[1] || '').split('?')[0]; let body = 'null';
      if (fn === 'trainee_program') body = JSON.stringify([D]);
      if (fn === 'trainee_extras') body = JSON.stringify([{ logs, weighins: [], session_state: { terms: { at: '2026-10-01T10:00:00.000Z', version: '3' } } }]);
      if (fn === 'trainee_coach') body = JSON.stringify({ name: 'אראל באואר', phone: '0541234567', business: 'BAUER POWER' });
      if (fn === 'trainee_save_state') body = 'true';
      if (fn === 'trainee_log') body = '"00000000-0000-0000-0000-000000000001"';
      rt.fulfill({ status: 200, contentType: 'application/json', body });
    });
    await p.goto('http://localhost:' + srv.address().port + '/t.html#' + TOK);
    await p.waitForSelector('.category-tile'); await p.waitForTimeout(1500);
    /* מה נמסר לציור הכרטיס */
    await p.evaluate(() => { window.__cards = []; const o = EBShare.render; EBShare.render = d => { window.__cards.push(JSON.parse(JSON.stringify(d))); return o(d); }; });
    return { c, p, errs };
  }
  const doWorkout = async (p, day, sets) => {
    await p.evaluate(d => { const x = document.querySelector('.th-hero [data-go-day]'); x.dataset.goDay = String(d); x.click(); }, day); await p.waitForTimeout(500);
    for (const [ex, s, w, r] of sets) {
      await p.fill('#categoryModal .dayc.on .ex >> nth=' + ex + ' >> [data-sf="w"][data-s="' + s + '"]', String(w));
      await p.fill('#categoryModal .dayc.on .ex >> nth=' + ex + ' >> [data-sf="r"][data-s="' + s + '"]', String(r));
    }
    await p.waitForTimeout(200);
    await p.evaluate(() => { const f = document.querySelector('#categoryModal .dayc.on [data-fin]'); f.scrollIntoView(); f.click(); });
    await p.waitForSelector('#finSheet'); await p.waitForFunction(() => { const b = document.querySelector('#finSheet [data-share-go]'); return !b || !b.disabled; }, null, { timeout: 8000 }).catch(() => {});
  };
  const txt = (p, sel) => p.evaluate(sel => (document.querySelector(sel) || {}).innerText || '', sel);

  console.log('=== אחרי אימון עם שיא ===');
  let { c, p, errs } = await open(true);
  await doWorkout(p, 0, [[0, 0, 80, 6], [0, 1, 85, 5]]);
  const fin = await txt(p, '#finSheet');
  t('במסך הסיכום: שיא, ושורת "כרטיס לשיתוף"', /שיא חדש/.test(fin) && /כרטיס לשיתוף/.test(fin), fin);
  const ready = await p.evaluate(() => { const im = document.querySelector('.fin-thumb img'), b = document.querySelector('#finSheet [data-share-go]'); return { src: (im && im.getAttribute('src')) || '', dis: !b || b.disabled, w: im && im.naturalWidth, h: im && im.naturalHeight }; });
  t('התמונה מוכנה מראש, והכפתור נפתח', /^blob:/.test(ready.src) && ready.dis === false && ready.w === 1080 && ready.h === 1350, JSON.stringify(ready));
  const card = await p.evaluate(() => window.__cards[0]);
  t('הכרטיס: "שיא חדש", שם האימון והתאריך', card && card.title === 'שיא חדש' && /רגליים וגב/.test(card.sub) && /26 בנובמבר/.test(card.sub), JSON.stringify(card));
  t('המספרים: תרגיל אחד, 2 סטים, נפח', card && card.stats[0].v === '1' && card.stats[0].l === 'תרגיל' && card.stats[1].v === '2' && card.stats[1].l === 'סטים' && card.stats[2].v === '905', JSON.stringify(card && card.stats));
  t('השיא: 80 ← 85', card && card.prs.length === 1 && card.prs[0].name === 'סקוואט' && card.prs[0].val === '80 ← 85 ק״ג', JSON.stringify(card && card.prs));
  t('שם המאמן בתחתית, ושם המתאמן לא מופיע בשום מקום', card && card.foot === 'מאמן: אראל באואר' && !/דני/.test(JSON.stringify(card)), JSON.stringify(card));
  const px = await p.evaluate(async () => { const im = document.querySelector('.fin-thumb img'); const cv = document.createElement('canvas'); cv.width = im.naturalWidth; cv.height = im.naturalHeight; const x = cv.getContext('2d'); x.drawImage(im, 0, 0);
    const at = (a, b) => [...x.getImageData(a, b, 1, 1).data].slice(0, 3); return { strip: at(540, 4), bg: at(20, 700), logo: at(540, 290) }; });
  t('התמונה צוירה: פס זהב למעלה, רקע חום, והלוגו במקום', px.strip[0] > 190 && px.strip[2] < 170 && px.bg[0] < 70 && px.bg[0] > 20 && JSON.stringify(px.logo) !== JSON.stringify(px.bg), JSON.stringify(px));
  await p.tap('#finSheet [data-share-go]'); await p.waitForTimeout(400);
  let sh = await p.evaluate(() => window.__shared);
  t('"שיתוף" פותח את חלון השיתוף עם קובץ תמונה', sh.length === 1 && sh[0].files.length === 1 && sh[0].files[0].type === 'image/png' && sh[0].files[0].name === 'bauer-power-workout.png' && sh[0].files[0].size > 20000, JSON.stringify(sh));
  t('והטקסט שנלווה נושא את שם העסק', sh[0] && /BAUER POWER/.test(sh[0].text) && /שיא חדש/.test(sh[0].text), sh[0] && sh[0].text);
  t('אחרי שיא מוצעת המלצה לחבר', /חבר או חברה/.test(fin) && !!(await p.$('#finSheet [data-friend]')));
  await p.tap('#finSheet [data-friend]'); await p.waitForTimeout(300);
  sh = await p.evaluate(() => window.__shared);
  t('ההמלצה: הודעת טקסט עם קישור למאמן, בלי קובץ', sh.length === 2 && sh[1].files.length === 0 && /wa\.me\/972541234567/.test(sh[1].text) && /BAUER POWER/.test(sh[1].text), JSON.stringify(sh[1]));
  await p.tap('#finSheet [data-share-open]'); await p.waitForTimeout(500);
  const big = await p.evaluate(() => { const s = document.getElementById('shareSheet'), im = s && s.querySelector('.sh-img img'); return { open: !!s, src: (im && im.getAttribute('src')) || '', go: s && !s.querySelector('[data-share-go]').disabled, save: s && !s.querySelector('[data-share-save]').disabled,
    fits: s && s.querySelector('.fin-sheet').getBoundingClientRect().right <= innerWidth && s.querySelector('.fin-sheet').getBoundingClientRect().bottom <= innerHeight }; });
  t('נגיעה בתמונה הקטנה פותחת תצוגה גדולה, בתוך המסך', big.open && /^blob:/.test(big.src) && big.go && big.save && big.fits, JSON.stringify(big));
  await p.tap('#shareSheet [data-share-close]'); await p.waitForTimeout(200);
  t('סגירת התצוגה משאירה את מסך הסיכום', !(await p.$('#shareSheet')) && !!(await p.$('#finSheet')));
  t('הכרטיס צויר פעם אחת בלבד', await p.evaluate(() => window.__cards.length) === 1);
  await p.tap('[data-fin-close]'); await p.waitForTimeout(300);
  t('בלי שגיאות', !errs.length, errs.join(' | '));
  await c.close();

  console.log('=== אימון רגיל, בדפדפן בלי חלון שיתוף ===');
  ({ c, p, errs } = await open(false));
  await doWorkout(p, 1, [[0, 0, 55, 8]]);
  const fin2 = await txt(p, '#finSheet');
  t('בלי שיא: יש כרטיס לשיתוף, אין הצעה להמליץ', /כרטיס לשיתוף/.test(fin2) && !/שיא חדש/.test(fin2) && !(await p.$('#finSheet [data-friend]')), fin2);
  const card2 = await p.evaluate(() => window.__cards[0]);
  t('הכרטיס: "אימון נוסף מאחוריי", והתרגיל של היום', card2 && card2.title === 'אימון נוסף מאחוריי' && card2.prs.length === 0 && card2.lifts.length === 1 && card2.lifts[0].name === 'לחיצת חזה' && card2.lifts[0].val === '55 ק״ג × 8', JSON.stringify(card2));
  const dl = p.waitForEvent('download', { timeout: 6000 }).catch(() => null);
  await p.tap('#finSheet [data-share-go]');
  const d = await dl;
  t('בלי חלון שיתוף — התמונה נשמרת כקובץ', !!d && d.suggestedFilename() === 'bauer-power-workout.png', d ? d.suggestedFilename() : 'אין הורדה');
  if (d) { const fp = await d.path(); const buf = fs.readFileSync(fp); t('והקובץ הוא PNG אמיתי', buf.length > 20000 && buf.slice(1, 4).toString() === 'PNG', String(buf.length)); }
  await p.waitForTimeout(300);
  t('עם הודעה שהתמונה נשמרה', /התמונה נשמרה/.test(await txt(p, '#toast')), await txt(p, '#toast'));
  await p.tap('[data-fin-close]'); await p.waitForTimeout(300);

  console.log('=== שיתוף אימון ישן מהיומן ===');
  await p.tap('.category-tile[data-category="log"]'); await p.waitForTimeout(500);
  await p.tap('.cal-g [data-cal="2026-11-17"]'); await p.waitForTimeout(300);
  await p.evaluate(() => { window.__cards = []; });
  await p.tap('.wl-done [data-wlshare]'); await p.waitForTimeout(900);
  const card3 = await p.evaluate(() => window.__cards[0]);
  t('הכרטיס של אותו אימון ואותו יום', card3 && /רגליים וגב/.test(card3.sub) && /17 בנובמבר/.test(card3.sub), JSON.stringify(card3));
  t('השיא נמדד מול מה שהיה לפניו (75 ← 80), לא מול מה שבא אחריו', card3 && card3.title === 'שיא חדש' && card3.prs[0].val === '75 ← 80 ק״ג', JSON.stringify(card3 && card3.prs));
  t('התצוגה נפתחת מעל היומן', await p.evaluate(() => { const s = document.getElementById('shareSheet'); return !!s && !!s.querySelector('.sh-img img').getAttribute('src'); }));
  await p.tap('#shareSheet [data-share-close]'); await p.waitForTimeout(200);
  await p.tap('.cal-g [data-cal="2026-11-10"]'); await p.waitForTimeout(300);
  await p.evaluate(() => { window.__cards = []; });
  await p.tap('.wl-done [data-wlshare]'); await p.waitForTimeout(700);
  const card4 = await p.evaluate(() => window.__cards[0]);
  t('האימון הראשון בתרגיל אינו "שיא"', card4 && card4.title === 'אימון נוסף מאחוריי' && card4.prs.length === 0 && card4.lifts[0].val === '75 ק״ג × 6', JSON.stringify(card4));
  t('בלי שגיאות', !errs.length, errs.join(' | '));
  await c.close();

  console.log('=== אימון עגול ===');
  ({ c, p, errs } = await open(true, [{ date: '2026-11-22', dayName: 'חזה וכתפיים', entries: [{ ex: 'לחיצת חזה', done: true, weight: 60, reps: 8 }] }]));
  await doWorkout(p, 1, [[0, 0, 50, 8]]);
  const fin5 = await txt(p, '#finSheet');
  t('האימון החמישי מצוין, ומוצעת המלצה לחבר גם בלי שיא', /האימון ה-5 שלך/.test(fin5) && !/שיא חדש/.test(fin5) && !!(await p.$('#finSheet [data-friend]')), fin5);
  t('בלי שגיאות', !errs.length, errs.join(' | '));
  await c.close();

  await b.close(); srv.close();
  console.log((fail ? '✗' : '✓') + ' כרטיס שיתוף: ' + pass + ' עברו' + (fail ? ', ' + fail + ' נכשלו' : ''));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  שגיאה בלתי צפויה: ' + (e && e.stack || e)); process.exit(1); });

/* יעד המשקל השבועי (נובמבר 2026, אראל: "שהמשקל מתעדכן לבד כל יום חמישי בבוקר...
   כמה אמור להיות המשקל לפי המטרה, וכמה בפועל... ולתת לו תזכורת ביום חמישי בבוקר").
   א. החישוב (weight-plan.js): המשקל של כל שבוע, היעד, ההשוואה, ובניית ההגדרות אצל המאמן.
   ב. השרת: התזכורת של יום חמישי לא נשלחת למי שכבר נשקל השבוע, ואין בה מספר.
   ג. המתאמן: כרטיס ביום חמישי במסך הבית, היעד בכרטיס השקילה, ואחרי שקילה — היעד מול מה שנשקל.
   ד. המאמן: ההגדרות נשמרות בתוכנית ונשארות יציבות, כרטיס במדידות, ושורה בלוח הבקרה.
   כל הנתונים כאן מומצאים. */
const http = require('http'), fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');

let pass = 0, fail = 0;
const t = (n, ok, i) => { ok ? pass++ : fail++; console.log((ok ? '✓ ' : '✗ ') + n + (ok ? '' : '  → ' + (i === undefined ? '' : i))); };
const J = x => JSON.stringify(x);

/* ---------- א. החישוב, מהקוד האמיתי ---------- */
(function unit() {
  console.log('=== החישוב ===');
  const win = {}; win.window = win;
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'weight-plan.js'), 'utf8'), vm.createContext({ window: win, Date, Math, JSON, String, Number, Array, Object, isFinite }));
  const W = win.EBWPlan;
  t('המודול נטען', !!W && typeof W.at === 'function');

  /* 2026-11-26 הוא יום חמישי; השבוע שלו מתחיל בראשון 22.11 */
  const cut = { dir: 'down', rate: 0.5 }, mass = { dir: 'up', rate: 0.25 }, keep = { dir: 'keep', rate: 0 };
  t('שבוע מתחיל בראשון, ויום היעד הוא חמישי', W.weekOf('2026-11-26') === '2026-11-22' && W.weekOf('2026-11-22') === '2026-11-22' && W.weekOf('2026-11-28') === '2026-11-22'
    && W.now(cut, [], '2026-11-24').thu === '2026-11-26');
  t('הפרש שבועות גם מעבר להחלפת השעון', W.weeksBetween('2026-10-18', '2026-11-01') === 2 && W.weeksBetween('2026-03-22', '2026-04-05') === 2 && W.weeksBetween('2026-11-22', '2026-11-22') === 0);

  /* המשקל של כל שבוע */
  let ws = W.weeks([{ date: '2026-11-16', w: 86 }, { date: '2026-11-19', w: 85.4 }, { date: '2026-11-12', weight: 86.2 }, { date: 'x', w: 80 }, { date: '2026-11-13', w: 5 }, null], []);
  t('השקילה האחרונה בשבוע קובעת; שורה שבורה או משקל לא סביר נזרקים', ws.length === 2 && ws[0].w === 86.2 && ws[1].w === 85.4 && ws[1].src === 'self', J(ws));
  ws = W.weeks([{ date: '2026-11-17', w: 85.4 }], [['2026-11-19', 84.8], ['2026-11-10', 86.4]]);
  t('באותו שבוע שקילה של המתאמן גוברת על מדידה של המאמן, גם כשהמדידה מאוחרת יותר', ws.length === 2 && ws[1].w === 85.4 && ws[1].src === 'self' && ws[0].src === 'coach', J(ws));

  /* היעד של השבוע */
  let o = W.now(cut, [{ date: '2026-11-19', w: 85.4 }], '2026-11-26');
  t('ירידה: שבוע אחרי 85.4 בקצב 0.5 — היעד 84.9, ועוד לא נשקל', o.state === 'wait' && o.expected === 84.9 && o.gap === 1 && o.actual === null, J(o));
  o = W.now(cut, [{ date: '2026-11-05', w: 86.9 }], '2026-11-26');
  t('שלושה שבועות בלי שקילה: היעד ממשיך להתקדם מהשקילה האחרונה', o.state === 'wait' && o.expected === 85.4 && o.gap === 3, J(o));
  o = W.now(mass, [{ date: '2026-11-19', w: 70 }], '2026-11-26');
  t('עלייה: היעד עולה', o.expected === 70.3 || o.expected === 70.2, o.expected);   // 70.25 מתעגל לאחד מהם
  o = W.now(keep, [{ date: '2026-11-19', w: 72.3 }], '2026-11-26');
  t('שמירה: היעד הוא המשקל האחרון', o.state === 'wait' && o.expected === 72.3);
  o = W.now(cut, [{ date: '2026-11-19', w: 85.4 }, { date: '2026-11-26', w: 85.3 }], '2026-11-26');
  t('נשקל: היעד מול מה שנשקל, וההפרש', o.state === 'done' && o.expected === 84.9 && o.actual.w === 85.3 && o.diff === 0.4 && o.verdict.side === 'behind' && o.verdict.cls === 'warn' && /מעל היעד ב-0\.4 ק״ג/.test(o.verdict.txt), J(o.verdict));
  t('והיעד של השבוע הבא נשען על מה שנשקל עכשיו', o.next === 84.8);
  o = W.now(cut, [{ date: '2026-11-19', w: 85.4 }, { date: '2026-11-23', w: 85.1 }], '2026-11-26');
  t('שקילה ביום ראשון של אותו שבוע נספרת לאותו חמישי', o.state === 'done' && o.diff === 0.2 && o.verdict.side === 'on' && o.verdict.cls === 'good');
  o = W.now(cut, [{ date: '2026-11-19', w: 85.4 }, { date: '2026-11-26', w: 84.2 }], '2026-11-26');
  t('ירד יותר מהיעד: "מתחת ליעד", לא אזהרה', o.verdict.side === 'ahead' && o.verdict.cls === 'good' && /מתחת ליעד ב-0\.7 ק״ג/.test(o.verdict.txt), J(o.verdict));
  o = W.now(mass, [{ date: '2026-11-19', w: 70 }, { date: '2026-11-26', w: 69.4 }], '2026-11-26');
  t('בעלייה הכיוון הפוך: מתחת ליעד הוא "מאחור"', o.verdict.side === 'behind' && /מתחת ליעד/.test(o.verdict.txt), J(o.verdict));
  o = W.now(keep, [{ date: '2026-11-19', w: 72 }, { date: '2026-11-26', w: 72.6 }], '2026-11-26');
  const o2 = W.now(keep, [{ date: '2026-11-19', w: 72 }, { date: '2026-11-26', w: 73 }], '2026-11-26');
  t('שמירה: עד 0.7 ק״ג יציב, מעבר לזה אזהרה', o.verdict.cls === 'good' && o2.verdict.cls === 'warn' && /מעל היעד ב-1 ק״ג/.test(o2.verdict.txt), J([o.verdict, o2.verdict]));

  /* מצבים בלי יעד */
  t('בלי הגדרות, או הגדרות שבורות — אין יעד', W.now(null, [{ date: '2026-11-19', w: 85 }], '2026-11-26').state === 'none' && W.norm({ dir: 'sideways', rate: 1 }) === null && W.norm({ dir: 'down', rate: 0 }) === null && W.norm('x') === null);
  t('אין אף משקל: מחכים לשקילה ראשונה', W.now(cut, [], '2026-11-26').state === 'start' && W.now(cut, [], '2026-11-26').expected === null);
  o = W.now(cut, [{ date: '2026-11-26', w: 85 }], '2026-11-26');
  t('שקילה ראשונה: נקודת התחלה, והיעד לשבוע הבא', o.state === 'first' && o.expected === null && o.next === 84.5);
  o = W.now(cut, [{ date: '2026-09-17', w: 88 }], '2026-11-26');
  t('משקל ישן מדי (מעל 8 שבועות) — אין מספר, מבקשים שקילה', o.state === 'stale' && o.expected === null && o.gap === 10, J(o));
  t('בדיוק 8 שבועות עוד נחשב', W.now(cut, [{ date: '2026-10-01', w: 88 }], '2026-11-26').state === 'wait');
  t('שקילה עם תאריך עתידי לא משפיעה על השבוע הזה', W.now(cut, [{ date: '2026-11-19', w: 85.4 }, { date: '2026-12-10', w: 70 }], '2026-11-26').expected === 84.9);

  /* מדידה של המאמן כנקודת משען */
  const withPts = { dir: 'down', rate: 0.5, pts: [['2026-11-03', 87], ['2026-11-17', 86]] };
  o = W.now(withPts, [], '2026-11-26');
  t('מתאמן שלא נשקל בעצמו: היעד נשען על המדידה האחרונה של המאמן', o.state === 'wait' && o.expected === 85.5 && o.anchor.src === 'coach' && /מהמדידה האחרונה אצל המאמן \(86\.0 ק״ג · 17\.11\)/.test(W.basisText(o)), W.basisText(o));
  o = W.now(withPts, [{ date: '2026-11-18', w: 85.2 }], '2026-11-26');
  t('ואם נשקל באותו שבוע — השקילה שלו היא המשען', o.expected === 84.7 && o.anchor.src === 'self' && /מהשקילה האחרונה \(85\.2 ק״ג · 18\.11\)/.test(W.basisText(o)), W.basisText(o));

  /* משקל יעד */
  const g = { dir: 'down', rate: 0.5, goal: 85 };
  t('משקל יעד עוצר את הירידה', W.now(g, [{ date: '2026-11-19', w: 85.3 }], '2026-11-26').expected === 85 && W.now(g, [{ date: '2026-11-19', w: 86 }], '2026-11-26').expected === 85.5);
  o = W.now(g, [{ date: '2026-11-19', w: 84.6 }], '2026-11-26');
  t('מי שכבר הגיע — היעד הוא משקל היעד', o.expected === 85 && o.reached === true);
  o = W.now(g, [{ date: '2026-11-19', w: 84.6 }, { date: '2026-11-26', w: 85.2 }], '2026-11-26');
  t('ונשאר בו: "במשקל היעד"', o.verdict.cls === 'good' && o.verdict.txt === 'במשקל היעד', J(o.verdict));
  t('בעלייה משקל היעד עוצר מלמעלה', W.now({ dir: 'up', rate: 0.3, goal: 75 }, [{ date: '2026-11-19', w: 74.9 }], '2026-11-26').expected === 75);

  /* היסטוריה */
  const hist = W.history(cut, [{ date: '2026-11-05', w: 86.9 }, { date: '2026-11-19', w: 85.4 }], '2026-11-28');
  t('היסטוריה: השבוע הנוכחי וכל שבוע עם משקל, מהחדש לישן', hist.length === 3 && hist[0].state === 'wait' && hist[0].expected === 84.9 && hist[1].expected === 85.9 && hist[1].actual.w === 85.4 && hist[2].state === 'first', J(hist.map(x => [x.week, x.state, x.expected])));

  /* ניסוחים */
  t('הכותרת לפי היום: עד רביעי "ליום חמישי", בחמישי "להיום", אחריו "של השבוע"',
    /^היעד ליום חמישי · 26\.11$/.test(W.headText(W.now(cut, [], '2026-11-24'), '2026-11-24'))
    && /^היעד להיום · 26\.11$/.test(W.headText(W.now(cut, [], '2026-11-26'), '2026-11-26'))
    && /^היעד של השבוע · 26\.11$/.test(W.headText(W.now(cut, [], '2026-11-28'), '2026-11-28')));
  t('הקצב במילים', W.paceText(cut) === 'ירידה של כ-0.5 ק״ג בשבוע' && W.paceText(mass) === 'עלייה של כ-0.25 ק״ג בשבוע' && W.paceText(keep) === 'שמירה על המשקל' && W.paceText(null) === '');
  t('משקל תמיד עם ספרה אחת אחרי הנקודה', W.fmt(85) === '85.0' && W.fmt(84.94) === '84.9' && W.fmt('58.44') === '58.4');

  /* בניית ההגדרות אצל המאמן */
  /* B: המאמן בחר את המטרה ביד. A: זוהתה מהטקסט, ולכן צריך גם את הכיוון של המטרה הכתובה */
  const B = x => W.build(Object.assign({ today: '2026-11-28', explicit: true }, x));
  const A = x => W.build(Object.assign({ today: '2026-11-28' }, x));
  t('חיטוב → ירידה, מסה → עלייה', B({ mode: 'cut', weight: 85 }).dir === 'down' && B({ mode: 'mass', weight: 70 }).dir === 'up');
  t('זיהוי אוטומטי: יעד רק כשהיעד הקלורי והמטרה הכתובה מסכימים', A({ mode: 'cut', textDir: 'down', weight: 85 }).dir === 'down' && A({ mode: 'mass', textDir: 'up', weight: 70 }).dir === 'up' && A({ mode: 'keep', textDir: 'keep' }).dir === 'keep');
  t('"שמירה" שנפלה כברירת מחדל (כוח, שיקום) אינה יעד משקל', A({ mode: 'keep', weight: 85 }) === null && A({ mode: 'keep', textDir: 'strength', weight: 85 }) === null && A({ mode: 'keep', textDir: null }) === null);
  t('"חיטוב ועלייה במסה" (עודף קלורי, משקל שאמור לעמוד) — בלי יעד', A({ mode: 'mass', textDir: 'keep', weight: 70 }) === null && A({ mode: 'cut', textDir: 'keep', weight: 70 }) === null && A({ mode: 'cut', textDir: 'up', weight: 70 }) === null && A({ mode: 'cut', weight: 70 }) === null);
  t('בחירה ביד מכריעה גם כשהטקסט אומר אחרת', B({ mode: 'keep' }).dir === 'keep' && B({ mode: 'keep' }).rate === 0 && B({ mode: 'cut', textDir: 'up', weight: 80 }).dir === 'down');
  t('כבוי למתאמן — אין יעד', B({ mode: 'cut', weight: 85, cfg: { off: true } }) === null);
  t('הקצב מהיעד הקלורי: גירעון 560 קק״ל ביום הוא כחצי קילו בשבוע', B({ mode: 'cut', tdee: 2800, kcal: 2240, weight: 85 }).rate === 0.5, J(B({ mode: 'cut', tdee: 2800, kcal: 2240, weight: 85 })));
  t('עודף 324 קק״ל ביום — 0.3 ק״ג בשבוע', B({ mode: 'mass', tdee: 2700, kcal: 3024, weight: 72 }).rate === 0.3);
  t('גירעון חריג מוגבל לאחוז אחד ממשקל הגוף', B({ mode: 'cut', tdee: 3000, kcal: 1500, weight: 60 }).rate === 0.6);
  t('גירעון זעיר לא יורד מתחת לרבע אחוז', B({ mode: 'cut', tdee: 2000, kcal: 1900, weight: 80 }).rate === 0.2);
  t('יעד קלורי שסותר את הכיוון (או חסר) — לפי אחוז ממשקל הגוף', B({ mode: 'cut', tdee: 2000, kcal: 2300, weight: 80 }).rate === 0.5 && B({ mode: 'cut', weight: 80 }).rate === 0.5 && B({ mode: 'mass', weight: 80 }).rate === 0.2 && B({ mode: 'cut' }).rate === 0.5);
  t('קצב שהמאמן קבע גובר, ומשקל יעד נשמר', J(B({ mode: 'cut', tdee: 2800, kcal: 2240, weight: 85, cfg: { rate: 0.7, goal: 78 } })) === '{"dir":"down","goal":78,"rate":0.7}');
  t('קצב לא הגיוני נחתך ל-1.5, משקל יעד לא הגיוני נזרק', B({ mode: 'cut', weight: 85, cfg: { rate: 9, goal: 5 } }).rate === 1.5 && !('goal' in B({ mode: 'cut', weight: 85, cfg: { rate: 9, goal: 5 } })));
  const ms = []; for (let i = 1; i <= 9; i++) ms.push({ date: '2026-11-0' + i, weight: 80 + i });
  ms.push({ date: '2026-12-25', weight: 70 }, { date: '2026-11-02', weight: '' }, { date: '', weight: 80 });
  const bp = B({ mode: 'cut', weight: 85, measures: ms });
  t('נשמרות שש המדידות האחרונות של המאמן, בלי תאריך עתידי ובלי שורות ריקות', bp.pts.length === 6 && bp.pts[0][0] === '2026-11-04' && bp.pts[5][0] === '2026-11-09' && bp.pts[5][1] === 89, J(bp.pts));
  t('סדר המפתחות הוא הסדר שהשרת מחזיר (jsonb) — אחרת כל משיכה נראית כשינוי', J(Object.keys(B({ mode: 'cut', weight: 85, cfg: { goal: 80 }, measures: ms }))) === '["dir","pts","goal","rate"]');
  t('אותו קלט — אותה תוצאה, בלי תלות בתאריך של היום', J(B({ mode: 'cut', tdee: 2800, kcal: 2240, weight: 85, measures: ms })) === J(W.build({ mode: 'cut', explicit: true, tdee: 2800, kcal: 2240, weight: 85, measures: ms, today: '2026-12-20' })));
})();

/* ---------- ב. השרת ---------- */
(function sql() {
  console.log('=== התזכורת בשרת ===');
  const s = fs.readFileSync(path.join(ROOT, 'supabase', 'coach-feedback.sql'), 'utf8').replace(/\r\n/g, '\n');
  const a = s.indexOf('-- weekly weigh-in, Thursday morning'), b = s.indexOf('-- no workout for 3+ days', a), br = s.slice(a, b);
  t('הענף של שקילת חמישי נמצא', a > 0 && b > a);
  t('חמישי ב-08:00 שעון ישראל, פעם ביום', /v_dow = 4 and v_hour = 8/.test(br) && /last_sent->>'weigh'/.test(br) && /Asia\/Jerusalem/.test(s));
  t('לא נשלחת למי שכבר נשקל השבוע (מיום ראשון)', /not exists \(select 1 from jsonb_array_elements\([\s\S]*r\.weighins[\s\S]*>= \(v_today - v_dow\)::text\)/.test(br), br);
  t('השקילות נשלפות בלולאה', /t\.session_state, t\.weighins,/.test(s));
  t('מזכירה את היעד רק כשיש כזה', /jsonb_typeof\(r\.program->'wplan'\) = 'object'/.test(br));
  t('בלי מספר משקל בהתראה (מסך נעילה)', !/weight|rate|goal/.test(br.replace(/weighins|weigh-in|'weigh'|>>'weigh'/g, '')), br);
})();

let chromium;
try { ({ chromium } = require(ROOT + '/node_modules/playwright')); } catch (e) { chromium = null; }
const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.json': 'application/json', '.css': 'text/css' };
const srv = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0].split('#')[0]));
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });

/* ---------- ג. המתאמן ---------- */
async function trainee(b) {
  console.log('=== המתאמן (טלפון 320) ===');
  const base = { name: 'דני בדיקה', goal: 'חיטוב', health: { signedAt: '2026-08-01', answers: {} }, trainer_name: 'אראל באואר', height: 178, weight: 86,
    meals: [], meals_self: [], exercises_self: [], files: [] };
  const days = [{ name: 'יום A', exercises: [{ name: 'סקוואט', sets: '3', reps: '6' }] }];
  const c = await b.newContext({ viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.clock.install({ time: new Date('2026-11-26T07:30:00') });
  const S = { wplan: { dir: 'down', rate: 0.5 }, W: [], calls: [] };
  await p.route(/supabase\.co/, rt => {
    const fn = (rt.request().url().split('/rpc/')[1] || '').split('?')[0]; let body = 'null';
    const prog = Object.assign({ days }, S.wplan ? { wplan: S.wplan } : {});
    if (fn === 'trainee_program') body = JSON.stringify([Object.assign({}, base, { program: prog, weighins: S.W })]);
    if (fn === 'trainee_extras') body = JSON.stringify([{ logs: [], weighins: S.W, session_state: { terms: { at: '2026-10-01T10:00:00.000Z', version: '3' } } }]);
    if (fn === 'trainee_coach') body = JSON.stringify({ name: 'אראל באואר', phone: '0541234567', business: 'BAUER POWER', birthday: false });
    if (fn === 'trainee_weigh') { const a = JSON.parse(rt.request().postData()); S.calls.push(a); S.W = S.W.filter(x => x.date !== a.p_date).concat({ date: a.p_date, weight: a.p_weight }); body = JSON.stringify(S.W); }
    if (fn === 'trainee_save_state') body = 'true';
    rt.fulfill({ status: 200, contentType: 'application/json', body });
  });
  const url = 'http://localhost:' + srv.address().port + '/t.html';
  let n = 0;
  /* כל טעינה עם קישור אחר — כדי שהמכשיר יתחיל בלי שקילות ובלי הסתרות מהתרחיש הקודם */
  const load = async q => { n++; await p.goto('about:blank'); await p.goto(url + (q || '') + '#tok-wplan-' + n); await p.waitForSelector('.category-tile'); await p.waitForTimeout(1400); };
  const home = () => p.evaluate(() => { const e = document.querySelector('[data-weigh-card]'); return e ? e.innerText.replace(/\s+/g, ' ').trim() : ''; });
  const wp = () => p.evaluate(() => { const e = document.querySelector('#categoryModal [data-wp]'); return e ? { st: e.dataset.wp, tx: e.innerText.replace(/\s+/g, ' ').trim() } : null; });
  const inScreen = sel => p.evaluate(sel => { const e = document.querySelector(sel); if (!e) return false; const q = e.getBoundingClientRect();
    return q.left >= -1 && q.right <= innerWidth + 1 && document.documentElement.scrollWidth <= innerWidth + 1; }, sel);
  const closeWin = async () => { await p.evaluate(() => { const x = document.querySelector('[data-category-close]'); if (x) x.click(); }); await p.waitForTimeout(300); };

  /* יום חמישי בבוקר, נשקל בשבוע שעבר */
  S.W = [{ date: '2026-11-12', weight: 86.2 }, { date: '2026-11-19', weight: 85.4 }];
  await load();
  let h = await home();
  t('חמישי בבוקר: כרטיס במסך הבית עם המשקל שאמור להיות', /היום יום שקילה/.test(h) && /אמור להיות בסביבות 84\.9 ק״ג/.test(h) && /לשקילה/.test(h), h);
  t('הכרטיס מעל האריחים ובתוך המסך', await inScreen('[data-weigh-card]') && await p.evaluate(() => document.querySelector('[data-weigh-card]').getBoundingClientRect().top < document.querySelector('.category-tile').getBoundingClientRect().top));
  await p.tap('[data-weigh-go]'); await p.waitForTimeout(500);
  let w = await wp();
  t('"לשקילה" פותח את מעקב, והיעד מוצג: "זה מה שאמור להיות"', w && w.st === 'wait' && /היעד להיום · 26\.11/.test(w.tx) && /84\.9 ק״ג/.test(w.tx) && /זה מה שהמשקל אמור להיות לפי המטרה: ירידה של כ-0\.5 ק״ג בשבוע, מהשקילה האחרונה \(85\.4 ק״ג · 19\.11\)/.test(w.tx), J(w));
  t('היעד וטופס השקילה בתוך המסך', await inScreen('#categoryModal [data-wp]') && await inScreen('#pg_w') && await p.evaluate(() => { const q = document.querySelector('#categoryModal [data-wp]').getBoundingClientRect(); return q.top >= 0 && q.top < innerHeight; }));
  await p.fill('#pg_w', '85.3'); await p.tap('[data-pg="save"]'); await p.waitForTimeout(700);
  w = await wp();
  t('אחרי הרישום, בלי לסגור את החלון: אמור להיות מול בפועל', w && w.st === 'done' && /אמור להיות 84\.9/.test(w.tx) && /בפועל 85\.3/.test(w.tx) && /מעל היעד ב-0\.4 ק״ג/.test(w.tx) && /היעד לחמישי הבא: 84\.8 ק״ג/.test(w.tx), J(w));
  t('השקילה נשלחה לשרת', S.calls.length === 1 && S.calls[0].p_date === '2026-11-26' && Number(S.calls[0].p_weight) === 85.3, J(S.calls));
  t('שני המספרים זה לצד זה, בתוך המסך', await p.evaluate(() => { const c = document.querySelectorAll('#categoryModal [data-wp] span[dir="ltr"]'); if (c.length < 2) return false; const a = c[0].getBoundingClientRect(), b = c[1].getBoundingClientRect(); return Math.abs(a.top - b.top) < 4 && a.left >= 0 && b.left >= 0 && a.right <= innerWidth && b.right <= innerWidth; }));
  await p.evaluate(() => { const d = document.querySelector('#categoryModal details'); if (d) d.open = true; }); await p.waitForTimeout(150);
  const tbl = await p.evaluate(() => { const d = document.querySelector('#categoryModal details'); return d ? d.innerText.replace(/\s+/g, ' ') : ''; });
  t('בטבלת כל השקילות: עמודת יעד לכל שבוע', /יעד/.test(tbl) && /85\.3 84\.9/.test(tbl) && /85\.4 85\.7/.test(tbl), tbl);
  await p.evaluate(() => { const e = document.querySelector('#categoryModal [data-pg="edit"]'); e.scrollIntoView(); e.click(); }); await p.waitForTimeout(400);
  t('"עדכון" מחזיר את הטופס ואת היעד בלבד', !!(await p.$('#pg_w')) && (await wp()).st === 'wait');
  await p.fill('#pg_w', '84.6'); await p.tap('[data-pg="save"]'); await p.waitForTimeout(700);
  w = await wp();
  t('שקילה מתוקנת: מתחת ליעד, לא אזהרה', w.st === 'done' && /בפועל 84\.6/.test(w.tx) && /מתחת ליעד ב-0\.3|בדיוק ביעד/.test(w.tx), J(w));
  await closeWin();
  t('אחרי שקילה הכרטיס במסך הבית יורד', !(await home()));

  /* שקילה אחרי שלושה שבועות בלי משקל: היעד רחוק, והכרטיס אומר ממה הוא חושב */
  S.W = [{ date: '2026-11-05', weight: 86.9 }];
  await load();
  await p.tap('[data-weigh-go]'); await p.waitForTimeout(500);
  await p.fill('#pg_w', '86.8'); await p.tap('[data-pg="save"]'); await p.waitForTimeout(700);
  w = await wp();
  t('אחרי הפסקה: היעד התקדם שלושה שבועות, והכרטיס אומר ממה הוא חושב', w.st === 'done' && /אמור להיות 85\.4/.test(w.tx) && /מעל היעד ב-1\.4 ק״ג/.test(w.tx) && /היעד חושב מהשקילה ב-5\.11, לפני 3 שבועות/.test(w.tx), J(w));
  await closeWin();

  /* "לא היום", ולמחרת */
  S.W = [{ date: '2026-11-19', weight: 85.4 }];
  await load();
  await p.tap('[data-weigh-hide]'); await p.waitForTimeout(250);
  t('"לא היום" מסתיר את הכרטיס', !(await home()));
  await p.clock.setFixedTime(new Date('2026-11-27T09:00:00'));
  await p.goto('about:blank'); await p.goto(url + '#tok-wplan-' + n); await p.waitForSelector('.category-tile'); await p.waitForTimeout(1400);
  h = await home();
  t('למחרת (שישי) הוא חוזר: "עוד אין שקילה השבוע"', /עוד אין שקילה השבוע/.test(h) && /84\.9/.test(h), h);

  /* יום רביעי: אין כרטיס, והיעד כבר מוצג לחמישי */
  await p.clock.setFixedTime(new Date('2026-11-25T09:00:00'));
  await load();
  t('לפני חמישי אין כרטיס במסך הבית', !(await home()));
  await p.tap('[data-category="follow"]'); await p.waitForTimeout(500);
  w = await wp();
  t('ובמעקב היעד כבר מחכה: "היעד ליום חמישי"', w && w.st === 'wait' && /היעד ליום חמישי · 26\.11/.test(w.tx) && /84\.9/.test(w.tx), J(w));
  await closeWin();

  /* בלי יעד: הדף כמו שהיה */
  await p.clock.setFixedTime(new Date('2026-11-26T07:30:00'));
  S.wplan = null; await load();
  t('מתאמן בלי יעד משקל: אין כרטיס במסך הבית', !(await home()));
  await p.tap('[data-category="follow"]'); await p.waitForTimeout(500);
  t('ואין יעד בכרטיס השקילה — רק הטופס', (await wp()) === null && !!(await p.$('#pg_w')));
  await closeWin();

  /* מתאמן שלא נשקל אף פעם: המדידה של המאמן */
  S.wplan = { dir: 'down', pts: [['2026-11-17', 86]], rate: 0.5 }; S.W = [];
  await load();
  h = await home();
  t('לא נשקל אף פעם, אבל המאמן מדד: היעד נשען על המדידה', /היום יום שקילה/.test(h) && /85\.5 ק״ג/.test(h), h);
  await p.tap('[data-category="follow"]'); await p.waitForTimeout(500);
  w = await wp();
  t('והכרטיס אומר מאיפה המספר', w && w.st === 'wait' && /מהמדידה האחרונה אצל המאמן \(86\.0 ק״ג · 17\.11\)/.test(w.tx), J(w));
  await closeWin();

  /* בלי אף משקל */
  S.wplan = { dir: 'down', rate: 0.5 }; S.W = [];
  await load();
  h = await home();
  t('בלי אף משקל: הכרטיס מבקש שקילה ראשונה, בלי מספר', /היום יום שקילה/.test(h) && /מתחיל היעד השבועי/.test(h) && !/\d\d\.\d/.test(h), h);

  /* נגיעה בהתראה */
  S.W = [{ date: '2026-11-19', weight: 85.4 }];
  await load('?go=weigh');
  await p.waitForTimeout(400);
  t('נגיעה בהתראת השקילה פותחת את מעקב על היעד, והכתובת נוקתה', await p.evaluate(() => { const e = document.querySelector('#categoryModal [data-wp]'); if (!e || !document.getElementById('pg_w')) return false; const q = e.getBoundingClientRect(); return q.bottom > 0 && q.top < innerHeight && !location.search; }));
  await closeWin();

  /* משקל יעד שהושג */
  S.wplan = { dir: 'down', goal: 85.5, rate: 0.5 };
  await load();
  await p.tap('[data-weigh-go]'); await p.waitForTimeout(500);
  w = await wp();
  t('מי שהגיע למשקל היעד: היעד הוא לשמור עליו', w && /85\.5 ק״ג/.test(w.tx) && /הגעת למשקל היעד/.test(w.tx), J(w));
  t('בלי שגיאות', !errs.length, errs.join(' | '));
  await c.close();
}

/* ---------- ד. המאמן ---------- */
async function coach(b) {
  for (const [name, wd, hg, mob] of [['מחשב', 1320, 900, false], ['טלפון 320', 320, 568, true]]) {
    console.log('=== המאמן, ' + name + ' ===');
    const c = await b.newContext({ viewport: { width: wd, height: hg }, isMobile: mob, hasTouch: mob, serviceWorkers: 'block' });
    const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.clock.install({ time: new Date('2026-11-26T07:30:00') });
    await p.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await p.goto('http://localhost:' + srv.address().port + '/index.html');
    await p.waitForFunction(() => typeof vDash === 'function' && window.EBSync && window.EBWPlan && window.EBMetrics, null, { timeout: 30000 });
    await p.evaluate(() => {
      if (window.EBSync) { EBSync.enabled = () => false; EBSync.schedule = () => {}; }
      const ex = [{ name: 'סקוואט', sets: '3', reps: '5' }];
      S.trainees = [
        { id: 'w1', name: 'דני בדיקה', gender: 'זכר', status: 'active', birth: '1992-03-10', height: 178, goal: 'חיטוב', phone: '0500000000', program: { days: [{ name: 'A', exercises: ex }] }, meals: [],
          weighins: [{ date: '2026-11-12', weight: 86.2 }, { date: '2026-11-19', weight: 85.4 }, { date: '2026-11-26', weight: 85.3, at: '2026-11-26T05:10:00+00' }] },
        { id: 'w2', name: 'מיכל בדיקה', gender: 'נקבה', status: 'active', birth: '1995-06-01', height: 165, goal: 'עלייה במסת שריר', phone: '0500000001', program: { days: [{ name: 'A', exercises: ex }] }, meals: [], weighins: [] },
        { id: 'w3', name: 'רון כוח', gender: 'זכר', status: 'active', birth: '1990-01-01', height: 180, goal: 'כוח', phone: '', program: { days: [{ name: 'A', exercises: ex }] }, meals: [], weighins: [{ date: '2026-11-20', weight: 90 }] },
        { id: 'w4', name: 'טל שמירה', gender: 'נקבה', status: 'active', birth: '1991-01-01', height: 168, goal: 'כושר', macroGoal: 'keep', phone: '', program: { days: [{ name: 'A', exercises: ex }] }, meals: [], weighins: [{ date: '2026-11-19', weight: 61 }] },
        { id: 'w5', name: 'גיל גם-וגם', gender: 'זכר', status: 'active', birth: '1993-01-01', height: 176, goal: 'חיטוב ועלייה במסת שריר', phone: '', program: { days: [{ name: 'A', exercises: ex }] }, meals: [], weighins: [{ date: '2026-11-19', weight: 78 }] },
        { id: 'w6', name: 'נועה בארכיון', gender: 'נקבה', status: 'archived', birth: '1993-01-01', height: 165, goal: 'חיטוב', phone: '', program: { days: [{ name: 'A', exercises: ex }] }, meals: [], weighins: [{ date: '2026-11-19', weight: 66 }] }];
      S.measures = [{ id: 'm1', traineeId: 'w1', date: '2026-10-20', weight: 88 }, { id: 'm2', traineeId: 'w2', date: '2026-11-17', weight: 58.4 }, { id: 'm3', traineeId: 'w2', date: '2026-11-03', weight: 58 }];
      S.payments = []; S.sessions = []; DASH.logs = []; DASH.at = Date.now() + 1e9;
      save();
    });
    const plans = () => p.evaluate(() => S.trainees.map(x => x.program.wplan || null));
    let P = await plans();
    t('בשמירה ההגדרות נכנסות לתוכנית: חיטוב ↓, מסה ↑, כוח — בלי, שמירה שנבחרה', P[0] && P[0].dir === 'down' && P[0].rate > 0 && P[1] && P[1].dir === 'up' && P[2] === null && P[3] && P[3].dir === 'keep' && P[3].rate === 0, J(P));
    t('"חיטוב ועלייה במסה" בלי בחירה ביד — בלי יעד; ומתאמנת בארכיון לא נוגעים בה', P[4] === null && P[5] === null, J(P.slice(4)));
    await p.evaluate(() => { setMacroGoal('w5', 'cut'); });
    t('אחרי שהמאמן בוחר "חיטוב" — יש יעד', ((await plans())[4] || {}).dir === 'down');
    await p.evaluate(() => { setMacroGoal('w5', ''); });
    t('וחזרה ל"אוטומטי" מורידה אותו', (await plans())[4] === null);
    t('עם המדידות של המאמן, ובלי שום דבר שתלוי בתאריך', J(P[0].pts) === '[["2026-10-20",88]]' && J(P[1].pts) === '[["2026-11-03",58],["2026-11-17",58.4]]' && !/2026-11-26/.test(J(P[0])), J(P));
    const before = await p.evaluate(() => JSON.stringify(S.trainees));
    await p.clock.setFixedTime(new Date('2026-12-03T07:30:00'));
    await p.evaluate(() => { save(); save(); });
    t('שמירה חוזרת, גם שבוע אחרי, לא משנה אף מתאמן (אין דחיפה מיותרת לשרת)', (await p.evaluate(() => JSON.stringify(S.trainees))) === before);
    await p.clock.setFixedTime(new Date('2026-11-26T07:30:00'));
    /* עותק שחזר מהשרת: אותם ערכים, והמפתחות בסדר של jsonb */
    t('הגדרות שחזרו מהשרת זהות תו-בתו למה שנבנה', await p.evaluate(() => { const t = S.trainees[0], a = JSON.stringify(t.program.wplan);
      const srv = {}; Object.keys(t.program.wplan).sort((x, y) => x.length - y.length || (x < y ? -1 : 1)).forEach(k => { srv[k] = JSON.parse(JSON.stringify(t.program.wplan[k])); });
      t.program.wplan = srv; save(); return JSON.stringify(t.program.wplan) === a && t.program.wplan === srv; }));

    const openM = async id => { await p.evaluate(id => { go('trainee', id); SUBTAB = 'measures'; render(); window.scrollTo(0, 0); }, id); await p.waitForTimeout(250); };
    const card = () => p.evaluate(() => { const e = document.querySelector('[data-wplan]'); return e ? e.innerText.replace(/\s+/g, ' ').trim() : ''; });
    const inScreen = () => p.evaluate(() => { const e = document.querySelector('[data-wplan]'); if (!e) return false; const q = e.getBoundingClientRect();
      return q.left >= -1 && q.right <= innerWidth + 1 && document.documentElement.scrollWidth <= innerWidth + 1
        && [].every.call(e.querySelectorAll('button,input'), x => { const r = x.getBoundingClientRect(); return r.left >= -1 && r.right <= innerWidth + 1; }); });

    await openM('w1');
    let cd = await card();
    const exp = await p.evaluate(() => EBWPlan.fmt(EBWPlan.now(S.trainees[0].program.wplan, S.trainees[0].weighins).expected));
    t('במדידות: היעד של השבוע מול מה שנשקל', /יעד משקל שבועי/.test(cd) && /היעד להיום · 26\.11/.test(cd) && cd.indexOf('אמור להיות ' + exp + ' ק״ג') > -1 && /בפועל 85\.3 ק״ג/.test(cd), cd);
    t('והקצב מוסבר: מהיעד הקלורי', /ירידה של כ-0\.\d+ ק״ג בשבוע\. מחושב מהיעד הקלורי: גירעון של \d+ קק״ל ביום/.test(cd), cd);
    t('טבלת השבועות האחרונים', /שבוע אמור להיות בפועל הפרש/.test(cd) && /חמישי 19\.11/.test(cd) && /חמישי 22\.10 — 88\.0 מדידה/.test(cd), cd);
    t('הכרטיס והשדות בתוך המסך', await inScreen());

    /* קצב ומשקל יעד */
    const setF = async (key, v) => { await p.evaluate(([key, v]) => { const i = document.querySelector('[data-wplan] [data-wgoal="' + key + '"]'); i.value = v; i.dispatchEvent(new Event('change', { bubbles: true })); }, [key, v]); await p.waitForTimeout(250); };
    await setF('rate', '0.7');
    P = await plans();
    t('קצב שהמאמן קבע נשמר בתוכנית ומוצג כידני', P[0].rate === 0.7 && /קצב שקבעת/.test(await card()) && /קצב · ידני/.test(await card()), J(P[0]));
    await setF('rate', '7');
    t('קצב לא הגיוני נדחה ולא נשמר', (await plans())[0].rate === 0.7 && (await p.evaluate(() => (S.trainees[0].wgoal || {}).rate)) === 0.7);
    await setF('goal', '84,9');
    P = await plans();
    t('משקל יעד נשמר (גם עם פסיק)', P[0].goal === 84.9 && (await p.evaluate(() => S.trainees[0].wgoal.goal)) === 84.9, J(P[0]));
    await setF('rate', ''); await setF('goal', '');
    P = await plans();
    t('שדות ריקים חוזרים לחישוב האוטומטי, וההגדרה נמחקת', P[0].rate !== 0.7 && !('goal' in P[0]) && (await p.evaluate(() => !('wgoal' in S.trainees[0]))), J(P[0]));

    /* כבוי / פעיל */
    await p.evaluate(() => [].find.call(document.querySelectorAll('[data-wplan] button'), x => x.innerText.trim() === 'כבוי').click()); await p.waitForTimeout(250);
    t('"כבוי" מוריד את היעד מהתוכנית של המתאמן', (await plans())[0] === null && /כבוי למתאמן הזה/.test(await card()));
    await p.evaluate(() => [].find.call(document.querySelectorAll('[data-wplan] button'), x => x.innerText.trim() === 'פעיל').click()); await p.waitForTimeout(250);
    t('"פעיל" מחזיר אותו', !!(await plans())[0] && /אמור להיות/.test(await card()));

    await openM('w2'); cd = await card();
    t('מתאמנת שלא נשקלה: היעד מהמדידה, "עוד לא נשקלה השבוע"', /אמור להיות 58\.\d ק״ג/.test(cd) && /עוד לא נשקלה השבוע/.test(cd) && /עלייה של כ-/.test(cd), cd);
    t('בתוך המסך', await inScreen());
    await openM('w3'); cd = await card();
    t('מטרה שאינה כיוון משקל: הסבר איך מפעילים, בלי מספר', /אין יעד משקל/.test(cd) && /חישוב לפי המטרה/.test(cd) && !/אמור להיות/.test(cd), cd);
    await openM('w5'); cd = await card();
    t('וכך גם מטרה לשני הכיוונים', /אין יעד משקל/.test(cd) && !/אמור להיות/.test(cd), cd);
    await openM('w4'); cd = await card();
    t('שמירה: היעד הוא המשקל של השבוע הקודם, בלי שדות קצב', /שמירה על המשקל/.test(cd) && /אמור להיות 61\.0 ק״ג/.test(cd) && !(await p.$('[data-wplan] [data-wgoal]')), cd);

    /* לוח הבקרה */
    /* בטלפון הפיד נפתח מאריח, ולכן קוראים את מה ש-dashFeed מצייר ולא את המסך */
    const feed = await p.evaluate(() => { DASH.more = true; const d = document.createElement('div'); d.innerHTML = dashFeed();
      return [].map.call(d.querySelectorAll('.ev'), e => e.textContent.replace(/\s+/g, ' ')).join(' || '); });
    t('בלוח הבקרה: ליד השקילה מופיע גם היעד', /נשקל · 85\.3 ק״ג · היעד \d\d\.\d/.test(feed) && /נשקל · 90 ק״ג(?! · היעד)/.test(feed), feed);
    t('בלי שגיאות', !errs.length, errs.join(' | '));
    await c.close();
  }
}

(async () => {
  if (!chromium) { console.log('דילוג על בדיקות הדפדפן: playwright לא מותקן'); }
  else {
    await new Promise(r => srv.listen(0, r));
    let b; try { b = await chromium.launch(); } catch (e) { try { b = await chromium.launch({ channel: 'chrome' }); } catch (e2) { b = null; console.log('דילוג: אין דפדפן ל-playwright'); } }
    if (b) { await trainee(b); await coach(b); await b.close(); }
    srv.close();
  }
  console.log((fail ? '✗' : '✓') + ' יעד משקל שבועי: ' + pass + ' עברו' + (fail ? ', ' + fail + ' נכשלו' : ''));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  שגיאה בלתי צפויה: ' + (e && e.stack || e)); process.exit(1); });

/* "התאמה למטרה" (exercise-ui.js) — הקוד האמיתי, ב-node, עם נתונים מומצאים.

   הכפתור כותב סטים, חזרות ומנוחה לפי המטרה של המתאמן. עד נובמבר 2026 הוא כתב אותם גם על
   שורות שאינן תרגילי משקולות, אם המאמן הקליד את השם בעצמו: "חימום — 10 דק׳", "הליכה יומית —
   12,000 צעדים" ו"פלאנק — 40 שנ׳" הפכו ל-"3 × 6-8, מנוחה 90 שנ׳" אצל מתאמנים אמיתיים, והמספרים
   המקוריים אבדו. הבדיקה שומרת על שלושת הסימנים שמשאירים שורה כמו שהיא, ועל כך שתרגיל משקולות
   עדיין מקבל את המרשם. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');

let pass = 0, fail = 0;
const t = (n, ok, i) => { ok ? pass++ : fail++; console.log((ok ? '✓ ' : '✗ ') + n + (ok ? '' : '  → ' + i)); };

const noop = () => {};
function boot(trainees) {
  const win = { EB_MOD: {} }; win.window = win;
  const seen = { modal: '', saves: 0 };
  const ctx = vm.createContext({
    window: win, console, navigator: {}, setTimeout, clearTimeout,
    document: { addEventListener: noop, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null },
    localStorage: { getItem: () => null, setItem: noop },
    S: { trainees }, tById: id => trainees.filter(x => x.id === id)[0],
    save: () => { seen.saves++; }, render: noop, toast: noop, esc: s => String(s == null ? '' : s),
    openModal: h => { seen.modal = h; }, closeModal: noop, confirm: () => true
  });
  win.S = ctx.S;
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'exercise-library.js'), 'utf8'), ctx);
  ctx.EBEx = win.EBEx;
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'exercise-ui.js'), 'utf8'), ctx);
  return { UI: win.EBExUI, EBEx: win.EBEx, seen };
}
const ex = (name, sets, reps, rest) => ({ name, sets: sets == null ? '' : sets, reps: reps == null ? '' : reps, weight: '', rest: rest == null ? '' : rest, note: '' });
const tri = e => [e.sets, e.reps, e.rest].join('|');
const one = (goal, rows) => ({ id: 'a', name: 'בדיקה', status: 'active', goal, program: { days: [{ name: 'יום A', exercises: rows }] } });

/* ---------- 1. מה שכבר כתוב בשורה הוא זמן, מרחק או מילה ---------- */
console.log('=== שורה שכתוב בה זמן, מרחק או מילה נשארת ===');
{
  const rows = [
    ex('חימום', '1', '10 דק׳'), ex('הליכה יומית', '1', '12,000 צעדים'), ex('ריצה בקצב אחיד', '3 ק״מ', ''),
    ex('חימום הליכה מהירה', '5 דק׳', ''), ex('ליבה — פלאנק על מרפקים', '3', '40 שנ׳', '45 שנ׳'),
    ex('הליכת חקלאי', '3', '30 מטר', '60 שנ׳'), ex('אינטרוולים בהליכון', '1', '12-20 דק׳', '0'),
    ex('כפיפת מרפקים במעגל', '3', '30-45 שנ׳', '45'), ex('החזקה במתח', '3', "20 שנ'"), ex('תלייה', '3', '20 שניות'),
    ex('אופני כושר ביתיים', '1', '2 דקות'), ex('דחיפת עגלה', '4', '20 מ׳'), ex('ריצת בוקר', '1', '3 קמ'),
    ex('שק חופשי', '3 סבבים', ''), ex('נשימות בטן', '2', '5 נשימות'),
    ex('כפיפת מרפקים לכשל', '3', 'כשל'), ex('שכיבות סמיכה חופשי', '3', 'עד כשל'), ex('מתח חופשי', '3', 'AMRAP'), ex('סקוואט חופשי', '2', 'מקסימום')
  ];
  const before = rows.map(tri);
  const { UI } = boot([one('כוח', rows)]);
  const r = UI.applyGoal('a', true);
  rows.forEach((e, i) => t(e.name + ' — ' + before[i].replace(/\|/g, ' · '), tri(e) === before[i], tri(e)));
  t('הדיווח: אף שורה לא עודכנה, כולן "נשארו"', r.changed === 0 && r.kept === rows.length, JSON.stringify(r));
}

/* ---------- 2. לפי הספרייה ---------- */
console.log('\n=== תרגיל מהספרייה שאינו תרגיל משקולות נשאר, גם כשהשורה ריקה ===');
{
  const { EBEx } = boot([]);
  const TIMEY = /שנ׳|דק׳|מטר|מ׳|סבב/;
  const pick = m => EBEx.ALL.filter(x => x.m === m)[0];
  const groups = ['core', 'cardio', 'flex', 'mob', 'box', 'power', 'surf'];
  const timed = EBEx.ALL.filter(x => !groups.includes(x.m) && TIMEY.test(String(x.r)));
  const names = groups.map(m => pick(m).n).concat(timed.slice(0, 6).map(x => x.n));
  const rows = names.map(n => ex(n)).concat([ex('L-SIT'), ex('  פלאנק  ')]);
  const { UI } = boot([one('חיטוב', rows)]);
  const r = UI.applyGoal('a', true);
  groups.forEach((m, i) => t('קבוצת ' + m + ': "' + rows[i].name + '" נשאר ריק', tri(rows[i]) === '||', tri(rows[i])));
  t('יש בספרייה תרגילים מחוץ לקבוצות האלה שנמדדים בזמן או במרחק', timed.length >= 20, timed.length);
  timed.slice(0, 6).forEach((x, i) => t('"' + x.n + '" (בספרייה: ' + x.s + '×' + x.r + ') נשאר', tri(rows[groups.length + i]) === '||', tri(rows[groups.length + i])));
  t('שם באותיות אחרות ("L-SIT") מזוהה כתרגיל מהספרייה', tri(rows[rows.length - 2]) === '||', tri(rows[rows.length - 2]));
  t('רווחים מסביב לשם לא מפריעים', tri(rows[rows.length - 1]) === '||', tri(rows[rows.length - 1]));
  t('כל השורות נספרו כ"נשארו"', r.kept === rows.length && r.changed === 0, JSON.stringify(r));

  const all = EBEx.ALL.filter(x => groups.includes(x.m) || TIMEY.test(String(x.r))).map(x => ex(x.n, x.s, x.r));
  const was = all.map(tri);
  const b2 = boot([one('כוח', all)]); b2.UI.applyGoal('a', true);
  const hurt = all.filter((e, i) => tri(e) !== was[i]);
  t('כל ' + all.length + ' תרגילי הספרייה שאינם משקולות שומרים על המרשם של הספרייה', hurt.length === 0, hurt.slice(0, 4).map(e => e.name + ' ' + tri(e)).join(' ; '));
}

/* ---------- 3. לפי השם שהמאמן הקליד ---------- */
console.log('\n=== שם שהמאמן הקליד בעצמו: חימום, אירובי, מתיחות, ליבה — נשאר, גם כשהשורה ריקה ===');
{
  const names = ['חימום', 'חימום (חובה)', 'מתיחות כלליות', 'מתיחות וניידות', 'מתיחת ירך אחורית שלי', 'שחרור', 'הרפיה / מתיחות רגליים',
    'אירובי בסיס — Z2', 'טמפו — Z3', 'אינטרוולים — Z4', 'קרדיו חופשי', 'הליכה יומית', 'הליכה בשיפוע', 'הליכת פארמר', 'ריצה בקצב אחיד',
    'עיקרי — שבוע A: אינטרוולי ספרינט', 'ליבה — פלאנק צד', 'ליבה — הרמת רגליים', 'ליבה — צ׳ופ בכבל', 'פלאנק צד', 'עץ פלאנק עם משיכה',
    'מעגל ליבה: פלאנק 45 · רוסיאן טוויסט 20', 'תרגיל בטן שאתה בוחר', 'בטן סטטית', 'הנפת רגליים בתלייה', 'הנפות רגל בתלייה', 'הנפת ברכיים',
    'הרמות ברכיים בתלייה / דד באג', 'גלגלת בטן / דד באג', '90-90 סיבובי אגן בישיבה', 'החלפת 90-90', 'סיבובי מפרק כף רגל וידיים', 'Russian twist'];
  const rows = names.map(n => ex(n));
  const { UI } = boot([one('כוח', rows)]);
  const r = UI.applyGoal('a', true);
  rows.forEach(e => t('"' + e.name + '" נשאר ריק', tri(e) === '||', tri(e)));
  t('הדיווח סופר את כולן כ"נשארו"', r.kept === rows.length && r.changed === 0, JSON.stringify(r));
  t('rxKeeps פתוח לבדיקה ולשימוש חוזר', typeof UI.rxKeeps === 'function' && UI.rxKeeps(ex('חימום')) === true && UI.rxKeeps(ex('סקוואט')) === false, typeof UI.rxKeeps);
}

/* ---------- 4. תרגיל משקולות עדיין מקבל את המרשם ---------- */
console.log('\n=== תרגיל משקולות מקבל את המרשם של המטרה, כמו קודם ===');
{
  const comp = ['סקוואט', 'דדליפט', 'לחיצת חזה בשיפוע — משקולות חופשיות', 'לאנג׳ הליכה עם משקולות', 'לאנג׳ים בהליכה', 'מתח (חימום)',
    'לחיצת חזה בשיפוע שלילי / ספסל בטן', 'חתירה במוט', 'מקבילים'];
  const iso = ['כפיפת מרפקים מוט W', 'הרחקת ירך בשכיבה על הצד', 'קיקבק ליד אחורית', 'פרפר מכונה', 'הרמת עקבים בעמידה', 'הליכתון מוזר', 'ליבהלה'];
  const rows = comp.concat(iso).map(n => ex(n));
  const { UI, seen } = boot([one('רוצה כוח', rows)]);
  const r = UI.applyGoal('a');
  comp.forEach((n, i) => t('בסיס: "' + n + '" ← 5 × 3-5, מנוחה 180 שנ׳', tri(rows[i]) === '5|3-5|180 שנ׳', tri(rows[i])));
  iso.forEach((n, i) => t('בידוד: "' + n + '" ← 3 × 6-8, מנוחה 90 שנ׳', tri(rows[comp.length + i]) === '3|6-8|90 שנ׳', tri(rows[comp.length + i])));
  t('הדיווח: כולן עודכנו, אף אחת לא "נשארה"', r.changed === rows.length && r.kept === 0 && r.key === 'strength', JSON.stringify(r));
  t('השינוי נשמר', seen.saves === 1, seen.saves);

  const old = [ex('סקוואט', '4', '12', '60'), ex('כפיפת מרפקים מוט W', '3', '15', '')];
  const b2 = boot([one('חיטוב', old)]); const r2 = b2.UI.applyGoal('a', true);
  t('מספרים קיימים של תרגיל משקולות מוחלפים (חיטוב: 4 × 10-12 / 60, 3 × 12-15 / 45)', tri(old[0]) === '4|10-12|60 שנ׳' && tri(old[1]) === '3|12-15|45 שנ׳' && r2.changed === 2, old.map(tri).join(' ; '));
}

/* ---------- 5. "לכל צד" ---------- */
console.log('\n=== "לכל צד" נשאר: המרשם מחליף את המספר, לא את מה שהוא סופר ===');
{
  const rows = [ex('חתירה חד-יד במשקולת', '3', '8 לכל צד'), ex('לאנג׳ אחורה', '3', '10-12 לרגל', '75 שנ׳'), ex('הרחקת ירך בשכיבה על הצד', '3', '12 לצד'),
    ex('כפיפת מרפק פטיש', '3', '10 לכל יד'), ex('פשיטת ברך במכונה רגל רגל', '3', '12   לכל  רגל '), ex('פרפר מכונה', '3', '12')];
  const { UI } = boot([one('כוח', rows)]);
  const r = UI.applyGoal('a', true);
  t('"8 לכל צד" ← "3-5 לכל צד" (חתירה היא תרגיל בסיס)', rows[0].reps === '3-5 לכל צד', rows[0].reps);
  t('"10-12 לרגל" ← "3-5 לרגל"', rows[1].reps === '3-5 לרגל', rows[1].reps);
  t('"12 לצד" ← "6-8 לצד"', rows[2].reps === '6-8 לצד', rows[2].reps);
  t('"10 לכל יד" ← "6-8 לכל יד"', rows[3].reps === '6-8 לכל יד', rows[3].reps);
  t('רווחים מיותרים מתנקים: "6-8 לכל רגל"', rows[4].reps === '6-8 לכל רגל', JSON.stringify(rows[4].reps));
  t('בלי "לכל צד" — בלי תוספת', rows[5].reps === '6-8', rows[5].reps);
  t('הסטים והמנוחה מהמרשם', rows.every(e => (e.sets === '5' && e.rest === '180 שנ׳') || (e.sets === '3' && e.rest === '90 שנ׳')), rows.map(tri).join(' ; '));
  const again = UI.applyGoal('a', true);
  t('לחיצה שנייה לא משנה כלום', again.changed === 0 && r.changed === rows.length, JSON.stringify([r, again]));
}

/* ---------- 6. תוכנית שלמה, ולכל המתאמנים ---------- */
console.log('\n=== תוכנית שלמה: רק תרגילי המשקולות משתנים ===');
{
  const mk = (id, name, goal) => ({ id, name, status: 'active', goal, program: { days: [
    { name: 'יום א', exercises: [ex('חימום', '1', '10 דק׳'), ex('לחיצת חזה במשקולות בשיפוע', '4', '10', '90'), ex('הרחקות צד', '3', '15', '60'), ex('ליבה — פלאנק צד', '3', '30 שנ׳ לצד', '45 שנ׳')] },
    { name: 'יום ד — אירובי', exercises: [ex('אירובי בסיס — Z2', '1', '30-40 דק׳'), ex('הליכה יומית', '1', '12,000 צעדים'), ex('מתיחות ומוביליטי', '1', '10 דק׳'), ex('חבל קפיצה', '5', '2 דק׳')] }] } });
  const A = mk('a', 'בדיקה אחת', 'כוח'), B = mk('b', 'בדיקה שתיים', 'ירידה במשקל'), C = mk('c', 'בדיקה בארכיון', 'כוח'); C.status = 'archived';
  const keepA = JSON.stringify([A.program.days[0].exercises[0], A.program.days[0].exercises[3], A.program.days[1]]);
  const cWas = JSON.stringify(C.program);
  const { UI, seen } = boot([A, B, C]);
  UI.applyGoalAll();
  t('כוח: חזה 5 × 3-5 / 180, הרחקות 3 × 6-8 / 90', tri(A.program.days[0].exercises[1]) === '5|3-5|180 שנ׳' && tri(A.program.days[0].exercises[2]) === '3|6-8|90 שנ׳', A.program.days[0].exercises.map(tri).join(' ; '));
  t('חיטוב: חזה 4 × 10-12 / 60, הרחקות 3 × 12-15 / 45', tri(B.program.days[0].exercises[1]) === '4|10-12|60 שנ׳' && tri(B.program.days[0].exercises[2]) === '3|12-15|45 שנ׳', B.program.days[0].exercises.map(tri).join(' ; '));
  t('חימום, פלאנק וכל יום האירובי נשארו בדיוק כמו שהיו', JSON.stringify([A.program.days[0].exercises[0], A.program.days[0].exercises[3], A.program.days[1]]) === keepA, JSON.stringify(A.program.days[1].exercises.map(tri)));
  t('מתאמן בארכיון לא נגעו בו', JSON.stringify(C.program) === cWas, 'השתנה');
  t('נשמר פעם אחת לכולם', seen.saves === 1, seen.saves);
  t('החלון מדווח לכל מתאמן כמה עודכנו וכמה נשארו', /2 תרגילים עודכנו/.test(seen.modal) && /6 נשארו כמו שהם/.test(seen.modal), seen.modal.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 260));
  t('החלון אומר במילים מה נשאר: חימום, אירובי, ליבה, מתיחות', /חימום, אירובי, ליבה, מתיחות/.test(seen.modal), '');
}

/* ---------- 7. זיהוי המטרה לא השתנה ---------- */
console.log('\n=== זיהוי המטרה ===');
{
  const { UI } = boot([]);
  const k = g => UI.goalKey({ goal: g });
  t('כוח / חיטוב / מסה / סבולת / כללי', k('כוח מתפרץ') === 'strength' && k('ירידה במשקל') === 'cut' && k('עלייה במסת שריר') === 'mass' && k('מרתון') === 'endur' && k('להרגיש טוב') === 'base',
    [k('כוח מתפרץ'), k('ירידה במשקל'), k('עלייה במסת שריר'), k('מרתון'), k('להרגיש טוב')].join(','));
}

console.log('\n' + pass + ' עברו, ' + fail + ' נכשלו');
process.exit(fail ? 1 : 0);

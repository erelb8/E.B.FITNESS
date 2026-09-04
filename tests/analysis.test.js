/* בדיקות לבוט ההתקדמות.
   העיקר שנבדק: אותו מספר בדיוק חייב לקבל פסק הפוך לפי המטרה. */
const fs = require('fs');
global.window = {};
global.S = { measures: [] };
eval(fs.readFileSync(__dirname + '/../analysis.js', 'utf8'));
const A = global.window.EBAnalyze;

let pass = 0, fail = 0;
function t(name, got, want) {
  const ok = got === want;
  ok ? pass++ : fail++;
  if (!ok) console.log('FAIL  ' + name + '\n      got=' + JSON.stringify(got) + '  want=' + JSON.stringify(want));
}

const DAY = 86400000;
function iso(daysAgo) { return new Date(Date.now() - daysAgo * DAY).toISOString().slice(0, 10); }

/* בונה מתאמן עם סדרת שקילות. weights[0] הוא הישן ביותר. */
function mk(goal, weights, everyDays) {
  const id = 'x' + Math.random().toString(36).slice(2);
  const step = everyDays || 7;
  S.measures = weights.map((w, i) => ({
    traineeId: id, date: iso((weights.length - 1 - i) * step), weight: w
  }));
  return A.analyze({ id, goal, intake: { answers: { goal } } });
}

console.log('=== כיוון המטרה ===');
t('חיטוב = ירידה',   A.direction('חיטוב ושמירה'), 'down');
t('מסה = עלייה',     A.direction('עלייה במסת שריר'), 'up');
t('שמירה',           A.direction('שמירה על הכושר'), 'keep');
t('רה-קומפוזיציה',   A.direction('ירידה באחוז שומן ועלייה במסת שריר'), 'keep');
t('בלי מטרה',        A.direction(''), null);

console.log('\n=== אותה ירידה, פסק הפוך לפי המטרה ===');
const CUT  = mk('חיטוב', [90, 89.4, 88.8, 88.2, 87.6]);      // -0.6 לשבוע מ-90
const BULK = mk('עלייה במסת שריר', [90, 89.4, 88.8, 88.2, 87.6]);
t('ירידה בחיטוב = בכיוון',      CUT.verdict, 'ontrack');
t('אותה ירידה במסה = אחורה',    BULK.verdict, 'offtrack');

console.log('\n=== קצב ===');
const SLOW = mk('חיטוב', [90, 89.95, 89.9, 89.85, 89.8]);     // ~0.05 לשבוע = 0.06%
t('איטי מדי = נתקע',            SLOW.verdict, 'stalled');
const FAST = mk('חיטוב', [90, 88.5, 87, 85.5, 84]);           // 1.5 לשבוע = 1.8%
t('מהיר מדי = אזהרה',           FAST.verdict, 'stalled');
t('והסיבה מציינת מהירות',       /מהיר מדי/.test(FAST.monthly.txt), true);
const GOOD = mk('חיטוב', [90, 89.5, 89, 88.5, 88]);           // 0.5 לשבוע = 0.57%
t('קצב תקין',                   GOOD.verdict, 'ontrack');

console.log('\n=== שמירה ===');
const KEEP_OK  = mk('שמירה על המשקל', [80, 80.1, 79.9, 80.05, 80]);
t('יציב = בכיוון',              KEEP_OK.verdict, 'ontrack');
const KEEP_BAD = mk('שמירה על המשקל', [80, 81, 82, 83, 84]);
t('זז והמטרה שמירה = נתקע',     KEEP_BAD.verdict, 'stalled');

console.log('\n=== נתונים חסרים ===');
t('בלי שקילות',      mk('חיטוב', []).verdict, 'nodata');
t('שקילה אחת',       mk('חיטוב', [90]).verdict, 'nodata');
const NOGOAL = mk('', [90, 89, 88]);
t('בלי מטרה אין פסק', NOGOAL.verdict, 'unknown');

console.log('\n=== שתיקה ===');
const SILENT = mk('חיטוב', [90, 89, 88], 30);   // כל 30 יום, אחרון לפני 0 ימים
t('שקל לאחרונה — לא שותק', SILENT.silent, false);
S.measures = [{ traineeId: 'z', date: iso(40), weight: 90 }, { traineeId: 'z', date: iso(47), weight: 91 }];
const OLD = A.analyze({ id: 'z', goal: 'חיטוב', intake: { answers: {} } });
t('לא שקל 40 יום = שותק', OLD.silent, true);

console.log('\n=== רגרסיה עמידה לחריג ===');
/* שקילה חריגה אחת (יום אחרי ארוחה גדולה) לא אמורה להפוך את המסקנה */
const OUTLIER = mk('חיטוב', [90, 89.5, 92, 88.5, 88]);
t('חריג לא הופך את הפסק', OUTLIER.verdict, 'ontrack');

console.log('\n=== שנתי ===');
S.measures = [];
const id = 'y1';
[[350, 95], [260, 92], [170, 89], [80, 86], [5, 84]].forEach(([d, w]) =>
  S.measures.push({ traineeId: id, date: iso(d), weight: w }));
const YR = A.analyze({ id, goal: 'חיטוב', intake: { answers: {} } });
t('שנתי תקין',        YR.yearly.ok, true);
t('סה"כ ירידה 11',    YR.yearly.total, -11);
t('שנתי בכיוון',      YR.yearly.state, 'good');


/* ===== שדרוג: המדד נבחר לפי המטרה ===== */
console.log('\n=== כוח נמדד בעומס, לא במאזניים ===');
global.S.prs = [];
function mkPR(goal, lifts) {
  const id = 'p' + Math.random().toString(36).slice(2);
  S.measures = [];
  S.prs = [];
  lifts.forEach(([ex, vals]) => vals.forEach((v, i) =>
    S.prs.push({ traineeId: id, exercise: ex, date: iso((vals.length - 1 - i) * 21), value: v })));
  return A.analyze({ id, goal, intake: { answers: { goal } } });
}
const up = mkPR('חיזוק וכוח', [['סקוואט', [80, 90, 100]], ['לחיצת חזה', [60, 65, 70]]]);
t('עומסים עולים = בכיוון', up.verdict, 'ontrack');
t('נמדד לפי עומס',        up.basis, 'עומס');
const flatPR = mkPR('חיזוק וכוח', [['סקוואט', [80, 80, 80]], ['לחיצת חזה', [60, 60, 60]]]);
t('עומסים עומדים = נתקע', flatPR.verdict, 'stalled');
const downPR = mkPR('חיזוק וכוח', [['סקוואט', [100, 92, 85]], ['לחיצת חזה', [70, 65, 60]]]);
t('עומסים יורדים = אחורה', downPR.verdict, 'offtrack');
t('בלי שיאים = אין נתונים', mkPR('כוח', []).verdict, 'nodata');

console.log('=== רה-קומפוזיציה נמדדת בהרכב גוף ===');
function mkComp(goal, rows) {
  const id = 'c' + Math.random().toString(36).slice(2);
  S.prs = [];
  S.measures = rows.map(([w, f, wa], i) => ({
    traineeId: id, date: iso((rows.length - 1 - i) * 14), weight: w, fat: f, waist: wa }));
  return A.analyze({ id, goal, intake: { answers: { goal } } });
}
/* משקל עומד במקום, שומן יורד — זו הצלחה, לא קיפאון */
const rc = mkComp('ירידה באחוז שומן ועלייה במסת שריר', [[80, 24, 90], [80.2, 22, 88], [79.9, 20, 86]]);
t('שומן יורד במשקל קבוע = בכיוון', rc.verdict, 'ontrack');
t('נמדד לפי הרכב גוף',             rc.basis, 'הרכב גוף');
t('מסומן כרה-קומפוזיציה',          rc.recomp, true);
const rcBad = mkComp('ירידה באחוז שומן ועלייה במסת שריר', [[80, 20, 86], [80.1, 22, 88], [80, 24, 90]]);
t('שומן עולה = אחורה', rcBad.verdict, 'offtrack');

console.log('=== חיטוב: הרכב הגוף סותר את המאזניים ===');
const stuck = mkComp('חיטוב', [[80, 26, 95], [80.1, 24, 92], [79.9, 22, 89]]);
t('המשקל תקוע אבל השומן יורד', /הרכב הגוף משתפר/.test(stuck.note || ''), true);

console.log('=== מטרת המתאמן עצמו ===');
S.measures = []; S.prs = [];
const own = A.analyze({ id: 'o1', goal: 'חיטוב',
  intake: { answers: { goal: 'חיטוב', success3m: 'להיכנס לחליפה של החתונה' } } });
t('נשלפת מהשאלון', own.ownGoal, 'להיכנס לחליפה של החתונה');

console.log('\n' + (fail ? '### נכשלו: ' + fail : 'הכל עבר') + '  |  עברו: ' + pass);
process.exit(fail ? 1 : 0);

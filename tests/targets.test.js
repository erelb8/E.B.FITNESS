/* בדיקות ליעדים היומיים.

   הנקודה הרגישה: יעד ליום מסוים גובר על הבסיס רק בשדות שמולאו.
   מי שקבע קלוריות גבוהות ליום רגליים אמור להמשיך לקבל את החלבון
   המחושב, ולא אפס. */
const fs = require('fs');
global.window = {};
eval(fs.readFileSync(__dirname + '/../targets.js', 'utf8'));
const T = global.window.EBTargets;

let pass = 0, fail = 0;
function t(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  if (!ok) console.log('FAIL  ' + name + '\n      got=' + JSON.stringify(got) + '  want=' + JSON.stringify(want));
}

const BASE = { targets: { kcal: 2000, protein: 150, carbs: 200, fat: 60, water: 3 } };

/* ---------- יום בשבוע ---------- */
console.log('=== יום בשבוע ===');
t('ראשון',                T.weekdayOf('2026-09-13'), 0);
t('שבת',                  T.weekdayOf('2026-09-12'), 6);
t('שם היום',              T.dayName(2), 'שלישי');
/* חצות מקומית ולא UTC — אחרת היעד של שבת מוצג בשישי */
t('ISO נקרא מקומית',      T.weekdayOf('2026-09-12'), new Date(2026, 8, 12).getDay());

/* ---------- מיזוג ---------- */
console.log('=== מיזוג ===');
t('בלי דריסות',           T.forDay(BASE, '2026-09-13').values.kcal, 2000);
t('אין יעד כלל',          T.forDay({}, '2026-09-13'), null);

const perDay = { targets: BASE.targets, targetsByDay: { '1': { kcal: 2600 } } };
const mon = T.forDay(perDay, '2026-09-14');       // שני
t('היעד של שני נדרס',     mon.values.kcal, 2600);
t('החלבון נשאר מהבסיס',   mon.values.protein, 150);
t('מסומן כנדרס',          mon.overridden, ['kcal']);
t('יום אחר לא הושפע',     T.forDay(perDay, '2026-09-13').values.kcal, 2000);
t('יום אחר בלי סימון',    T.forDay(perDay, '2026-09-13').overridden, []);

/* יעד ליום גם בלי בסיס — מתאמן בלי מדידות */
const onlyDay = { targetsByDay: { '3': { kcal: 1800 } } };
t('יעד ליום בלי בסיס',    T.forDay(onlyDay, '2026-09-16').values.kcal, 1800);
t('יום בלי כלום',         T.forDay(onlyDay, '2026-09-13'), null);

/* ---------- ערכים לא תקינים ---------- */
console.log('=== ערכים לא תקינים ===');
t('אפס נדחה',             T.dayOverrides({ targetsByDay: { '0': { kcal: 0 } } }, 0), null);
t('טקסט נדחה',            T.dayOverrides({ targetsByDay: { '0': { kcal: 'הרבה' } } }, 0), null);
t('שלילי נדחה',           T.dayOverrides({ targetsByDay: { '0': { kcal: -5 } } }, 0), null);
t('מחרוזת מספר מתקבלת',   T.dayOverrides({ targetsByDay: { '0': { kcal: '2200' } } }, 0).kcal, 2200);

/* ---------- כתיבה ---------- */
console.log('=== כתיבה ===');
const p = { targets: BASE.targets };
T.setDayValue(p, 5, 'kcal', 2400);
t('נכתב',                 p.targetsByDay['5'].kcal, 2400);
T.setDayValue(p, 5, 'protein', 180);
t('שדה שני באותו יום',    p.targetsByDay['5'].protein, 180);
T.setDayValue(p, 5, 'kcal', '');
t('ריק מוחק שדה',         p.targetsByDay['5'].kcal, undefined);
T.setDayValue(p, 5, 'protein', '');
t('יום ריק נמחק',         p.targetsByDay, undefined);

const p2 = { targets: BASE.targets, targetsByDay: { '2': { kcal: 2100 }, '4': { fat: 70 } } };
T.clearDay(p2, 2);
t('ניקוי יום',            p2.targetsByDay['2'], undefined);
t('יום אחר שרד',          p2.targetsByDay['4'].fat, 70);
t('רשימת ימים',           T.daysWithOverride(p2), [4]);
T.clearDay(p2, 4);
t('המפה נמחקת',           p2.targetsByDay, undefined);
t('מפתח לא מוכר נדחה',    T.setDayValue({ targets: {} }, 1, 'שוקולד', 5).targetsByDay, undefined);

console.log('\n' + (fail ? 'נכשלו: ' + fail : 'הכל עבר') + '  |  עברו: ' + pass);

/* ---------- ערכי טווח ----------
   מאמן שכותב "2100-2300" מתכוון לטווח. עד v126 num() דחה את זה
   והערך נמחק בשקט בשמירה הבאה. */
console.log('=== טווחים ===');
t('מספר רגיל',          T.normVal(2200), 2200);
t('טווח',               T.normVal('2100-2300'), '2100-2300');
t('קו מפריד',           T.normVal('2100–2300'), '2100-2300');
t('הפוך מסתדר',         T.normVal('2300-2100'), '2100-2300');
t('רווחים',             T.normVal(' 180 - 190 '), '180-190');
t('פסיקים',             T.normVal('2,100-2,300'), '2100-2300');
t('קצוות זהים',         T.normVal('200-200'), 200);
t('טקסט נדחה',          T.normVal('בערך 2000'), null);
t('ריק',                T.normVal(''), null);
t('שלילי נדחה',         T.normVal('-50'), null);

t('אמצע של טווח',       T.midVal('2100-2300'), 2200);
t('אמצע של מספר',       T.midVal(2200), 2200);
t('תצוגה של טווח',      T.fmtVal('2100-2300'), '2100–2300');
t('תצוגה של מספר',      T.fmtVal(2200), '2200');

console.log('=== עמידה ביעד ===');
t('בתוך הטווח',         T.inTarget(2200, '2100-2300'), true);
t('על הגבול התחתון',    T.inTarget(2100, '2100-2300'), true);
t('על הגבול העליון',    T.inTarget(2300, '2100-2300'), true);
t('מתחת לטווח',         T.inTarget(2050, '2100-2300'), false);
t('מעל הטווח',          T.inTarget(2400, '2100-2300'), false);
t('מספר יחיד בסטייה',   T.inTarget(2150, 2200), true);
t('מספר יחיד רחוק',     T.inTarget(2500, 2200), false);

console.log(fail ? '\nנכשלו: ' + fail : '\nהכל עבר  |  עברו: ' + pass);
process.exit(fail ? 1 : 0);

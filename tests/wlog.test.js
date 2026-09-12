/* בדיקות ליומן האימונים.

   שתי נקודות שהכי קל לשבור כאן:
   1. weight ו-reps חייבים להחזיק את הסט הכבד ביותר, כי coach-bot
      קורא אותם ישירות. אם הם יחזיקו את הסט האחרון, ירידה מכוונת
      בסוף האימון תיקרא אצל המאמן החכם כנסיגה.
   2. ההצעה היא ליום שהכי מזמן לא אומן, ולא ליום הבא ברשימה. */
const fs = require('fs');
global.window = {};
eval(fs.readFileSync(__dirname + '/../workout-log.js', 'utf8'));
const W = global.window.EBWLog;

let pass = 0, fail = 0;
function t(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  if (!ok) console.log('FAIL  ' + name + '\n      got=' + JSON.stringify(got) + '  want=' + JSON.stringify(want));
}
function ago(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
       + '-' + String(d.getDate()).padStart(2, '0');
}

/* ---------- מספר הסטים ---------- */
console.log('=== מספר הסטים ===');
t('מספר פשוט',            W.setCount({ sets: '3' }), 3);
t('טווח — הנמוך קובע',    W.setCount({ sets: '3-4' }), 3);
t('ריק — שלושה',          W.setCount({ sets: '' }), 3);
t('טקסט — שלושה',         W.setCount({ sets: 'שלושה' }), 3);
t('תקרה של שמונה',        W.setCount({ sets: '40' }), 8);
t('אפס אינו מצב',         W.setCount({ sets: '0' }), 3);
t('תרגיל בלי שדה',        W.setCount({}), 3);

/* ---------- הסט הכבד קובע ---------- */
console.log('=== בניית הדיווח ===');
const DAY = { name: 'יום A', exercises: [{ name: 'סקוואט', sets: '3' }, { name: 'לחיצת חזה', sets: '2' }] };
const draft = { sets: {
  '0:0': { w: 60, r: 8 },
  '0:1': { w: 80, r: 3 },     // הכבד ביותר
  '0:2': { w: 70, r: 5 },
  '1:0': { w: 40, r: 10 }
} };
const entries = W.buildEntries(DAY, draft);
t('שתי שורות',            entries.length, 2);
t('הסט הכבד נבחר',        entries[0].weight, 80);
t('החזרות של הסט הכבד',   entries[0].reps, 3);
t('שלושה סטים נרשמו',     entries[0].setLog.length, 3);
t('סומן כבוצע',           entries[0].done, true);

const partial = W.buildEntries(DAY, { sets: { '1:0': { w: 40, r: 10 } } });
t('תרגיל בלי רישום יורד', partial.length, 1);
t('הנשאר הוא הנכון',      partial[0].ex, 'לחיצת חזה');
t('טיוטה ריקה',           W.buildEntries(DAY, { sets: {} }).length, 0);
t('שדה חצי-מלא נספר',     W.buildEntries(DAY, { sets: { '0:0': { w: 50, r: '' } } })[0].setLog.length, 1);

/* ---------- נפח ---------- */
console.log('=== נפח ===');
t('סכום הסטים',           W.volumeOf([{ setLog: [{ w: 100, r: 5 }, { w: 100, r: 5 }] }]), 1000);
t('נפילה לשדות הישנים',   W.volumeOf([{ weight: 50, reps: 10, sets: 3 }]), 1500);
t('בלי נתונים',           W.volumeOf([]), 0);
t('סט בלי חזרות לא נספר', W.volumeOf([{ setLog: [{ w: 100, r: null }] }]), 0);

/* ---------- הפעם הקודמת ---------- */
console.log('=== הפעם הקודמת ===');
const LOGS = [
  { date: ago(14), day_name: 'יום A', entries: [{ ex: 'סקוואט', weight: 70, reps: 5, done: true }] },
  { date: ago(4),  day_name: 'יום A', entries: [{ ex: 'סקוואט', weight: 75, reps: 5, done: true, setLog: [{ w: 75, r: 5 }] }] },
  { date: ago(2),  day_name: 'יום B', entries: [{ ex: 'חתירה', weight: 50, reps: 8, done: false }] }
];
t('האחרון קובע',          W.lastTimeOf(LOGS, 'סקוואט').weight, 75);
t('תרגיל שלא בוצע',       W.lastTimeOf(LOGS, 'חתירה'), null);
t('תרגיל שלא היה',        W.lastTimeOf(LOGS, 'מתח'), null);
t('שם ריק',               W.lastTimeOf(LOGS, ''), null);

/* ---------- איזה יום להציע ---------- */
console.log('=== הצעת היום ===');
const PROG = { days: [{ name: 'יום A' }, { name: 'יום B' }, { name: 'יום C' }] };
t('יום שמעולם לא אומן',   W.suggestDay(PROG, LOGS), 2);
const allTrained = [
  { date: ago(1), day_name: 'יום A', entries: [] },
  { date: ago(9), day_name: 'יום B', entries: [] },
  { date: ago(3), day_name: 'יום C', entries: [] }
];
t('הישן ביותר נבחר',      W.suggestDay(PROG, allTrained), 1);
t('בלי יומן — הראשון',    W.suggestDay(PROG, []), 0);
t('תוכנית ריקה',          W.suggestDay({ days: [] }, LOGS), 0);

/* ---------- תאריכים ---------- */
console.log('=== תאריכים ===');
t('היום הוא אפס',         W.dayGap(ago(0)), 0);
t('אתמול הוא אחד',        W.dayGap(ago(1)), 1);
t('שבוע',                 W.dayGap(ago(7)), 7);
t('תאריך שבור',           W.dayGap('לא-תאריך'), null);

console.log('\n' + (fail ? 'נכשלו: ' + fail : 'הכל עבר') + '  |  עברו: ' + pass);
process.exit(fail ? 1 : 0);

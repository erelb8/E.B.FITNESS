/* בדיקות לשמירה האוטומטית של התוכנית.

   הרקע: עריכת תוכנית הייתה טיוטה עד ללחיצה על "שמירה", ולכן נשאל
   המאמן לפני כל מעבר מסך. בפועל הוא התרגל ללחוץ "לעזוב", ויום אימון
   נשמר ריק — היום נשמר, התרגילים שבתוכו לא.

   שלוש נקודות שהכי קל לשבור כאן:
   1. מעבר מסך חייב לשמור מיד, לא לחכות להשהיה — אחרת המשיכה הבאה
      מהשרת דורסת את מה שהוקלד רגע לפני.
   2. אחרי שמירה הבסיס זז קדימה. בלי זה כל render היה שומר שוב
      ושוב, וכל שמירה הייתה מעלה מונה גרסה ודוחפת לשרת.
   3. אין שום confirm. זו כל הבקשה. */
const fs = require('fs');

const src = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const a = src.indexOf('function hasUnsavedProgram(){');
const b = src.indexOf('function updateProgramDock(){ scheduleProgramAutosave(); }');
if (a < 0 || b < 0) { console.log('✗ לא נמצאו פונקציות השמירה ב-index.html'); process.exit(1); }
const block = src.slice(a, b + 'function updateProgramDock(){ scheduleProgramAutosave(); }'.length);

/* סביבה מדומה */
let saves = 0, confirms = 0;
const TR = [{ id: 't1', name: 'בדיקה', program: { days: [] } }];
global.window = {};
global.tById = id => TR.find(t => t.id === id) || null;
global.save = () => { saves++; };
global.confirm = () => { confirms++; return true; };
global.document = { getElementById: () => null };
const timers = [];
global.setTimeout = (fn) => { timers.push(fn); return timers.length; };
global.clearTimeout = (h) => { if (h) timers[h - 1] = null; };
const flushTimers = () => { const f = timers.splice(0); f.forEach(fn => fn && fn()); };

(0, eval)(block.replace(/\blet PROG_AUTOSAVE_T\b/, 'var PROG_AUTOSAVE_T'));
[ 'hasUnsavedProgram','commitProgram','scheduleProgramAutosave',
  'confirmLeaveProgram','programDock','updateProgramDock' ].forEach(n => {
  if (typeof global[n] !== 'function') global[n] = eval(n);
});

let pass = 0, fail = 0;
function t(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++; else { fail++; console.log('✗ ' + name + '\n   התקבל: ' + JSON.stringify(got)
    + '\n   ציפינו: ' + JSON.stringify(want)); }
}
function openProgram() {
  window.PROGRAM_BASE_ID = 't1';
  window.PROGRAM_BASE = JSON.parse(JSON.stringify(TR[0].program));
  saves = 0; confirms = 0; timers.length = 0;
}

console.log('=== אין שינוי — אין שמירה ===');
openProgram();
scheduleProgramAutosave(); flushTimers();
t('לא נשמר כלום', saves, 0);

console.log('=== שינוי נשמר מעצמו ===');
openProgram();
TR[0].program.days.push({ name: 'יום D', exercises: [] });
updateProgramDock('t1');
t('לא נשמר לפני ההשהיה', saves, 0);
flushTimers();
t('נשמר אחרי ההשהיה', saves, 1);
t('הבסיס זז קדימה', hasUnsavedProgram(), false);

console.log('=== תרגילים בתוך יום — המקרה של יום D ===');
TR[0].program.days[0].exercises.push({ name: 'סקוואט', sets: '3', reps: '10' });
scheduleProgramAutosave(); flushTimers();
t('התרגיל נשמר', saves, 2);
t('הבסיס כולל את התרגיל', JSON.parse(JSON.stringify(window.PROGRAM_BASE)).days[0].exercises.length, 1);

console.log('=== render חוזר לא שומר שוב ===');
const before = saves;
scheduleProgramAutosave(); scheduleProgramAutosave(); flushTimers();
t('אין שמירה כפולה', saves, before);

console.log('=== כמה שינויים רצופים — כתיבה אחת ===');
openProgram();
TR[0].program.days[0].exercises.push({ name: 'לאנג׳' });
scheduleProgramAutosave();
TR[0].program.days[0].exercises.push({ name: 'גשר עכוז' });
scheduleProgramAutosave();
flushTimers();
t('שמירה אחת', saves, 1);

console.log('=== מעבר מסך שומר מיד ===');
openProgram();
TR[0].program.days[0].name = 'יום D — רגליים';
t('מאשר מעבר', confirmLeaveProgram(), true);
t('נשמר מיד, בלי לחכות', saves, 1);
t('ההשהיה שהמתינה בוטלה', timers.filter(Boolean).length, 0);

console.log('=== אף פעם לא שואל ===');
openProgram();
TR[0].program.days.pop();
confirmLeaveProgram(); scheduleProgramAutosave(); flushTimers();
t('אפס שאלות', confirms, 0);

console.log('=== אין פס "שינויים שטרם נשמרו" ===');
t('programDock ריק', programDock('t1', true), '');

console.log('=== בלי מתאמן פתוח לא נוגעים בכלום ===');
window.PROGRAM_BASE_ID = null; saves = 0;
commitProgram(); scheduleProgramAutosave(); flushTimers();
t('לא נשמר', saves, 0);

console.log(fail ? '\nנכשלו: ' + fail : '\nהכל עבר  |  עברו: ' + pass);
process.exit(fail ? 1 : 0);

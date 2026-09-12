/* בדיקות למעקב יום-יום ולנפח במאמן החכם.

   הנפח הוא המדד שזז כשהמשקל עומד במקום: מי שהוסיף סט באותו משקל
   עשה יותר עבודה. מערכת שמסתכלת רק על המשקל המקסימלי קוראת לזה
   "תקוע", ולכן הנפח נמדד בנפרד.

   setLog קיים רק ביומן החדש. אימונים שנרשמו לפניו נופלים חזרה
   למשקל ולחזרות של הסט הכבד, ושתי הדרכים חייבות להסתדר יחד. */
const fs = require('fs');
global.window = {};
eval(fs.readFileSync(__dirname + '/../coach-bot.js', 'utf8'));
const B = global.window.EBBot;

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

/* ---------- נפח ---------- */
console.log('=== נפח ===');
t('סטים מפורטים',
  B.volumeOf([{ done: true, setLog: [{ w: 100, r: 5 }, { w: 90, r: 5 }] }]), 950);
t('נפילה לשדות הישנים',
  B.volumeOf([{ done: true, weight: 50, reps: 10, sets: 3 }]), 1500);
t('תרגיל שלא בוצע לא נספר',
  B.volumeOf([{ done: false, setLog: [{ w: 100, r: 5 }] }]), 0);
t('סט בלי חזרות',
  B.volumeOf([{ done: true, setLog: [{ w: 100, r: null }] }]), 0);
t('רשימה ריקה', B.volumeOf([]), 0);
t('שני תרגילים מצטברים',
  B.volumeOf([{ done: true, setLog: [{ w: 60, r: 10 }] },
              { done: true, setLog: [{ w: 40, r: 10 }] }]), 1000);
/* אימון ישן ואימון חדש באותה רשימה */
t('ישן וחדש יחד',
  B.volumeOf([{ done: true, setLog: [{ w: 100, r: 5 }] },
              { done: true, weight: 50, reps: 10, sets: 2 }]), 1500);

/* ---------- מעקב יומי ---------- */
console.log('=== מעקב יומי ===');
const PROGRAM = { days: [{ name: 'יום A' }, { name: 'יום B' }, { name: 'יום C' }] };
B.load({
  logs: [
    { date: ago(0), dayName: 'יום A', day_name: 'יום A', entries: [{ ex: 'סקוואט', done: true, setLog: [{ w: 100, r: 5 }] }] },
    { date: ago(2), dayName: 'יום B', day_name: 'יום B', entries: [{ ex: 'לחיצה', done: true, setLog: [{ w: 60, r: 8 }] }] }
  ],
  program: PROGRAM, goal: 'מסת שריר'
});
const track = B.dailyTrack(14);
t('ארבעה עשר ימים', track.length, 14);
t('היום האחרון הוא היום', track[13].date, ago(0));
t('היום סומן כאומן', track[13].trained, true);
t('יום לפני אתמול סומן', track[11].trained, true);
t('אתמול לא אומן', track[12].trained, false);
t('חלון קצר', B.dailyTrack(3).length, 3);

/* ---------- השבוע ---------- */
console.log('=== השבוע ===');
const wk = B.thisWeek();
t('התוכנית נספרת', wk.planned, 3);
t('נספר לפחות האימון של היום', wk.done >= 1, true);
t('הנותר אינו שלילי', wk.left >= 0, true);

/* ---------- מגמת נפח ---------- */
console.log('=== מגמת נפח ===');
t('בלי מספיק אימונים', B.volumeTrend(), null);

/* ארבעה קלים ואחריהם ארבעה כבדים */
const many = [];
[20, 18, 16, 14].forEach(function (d) {
  many.push({ date: ago(d), dayName: 'יום A', day_name: 'יום A',
              entries: [{ ex: 'סקוואט', done: true, setLog: [{ w: 50, r: 10 }] }] });
});
[8, 6, 4, 2].forEach(function (d) {
  many.push({ date: ago(d), dayName: 'יום A', day_name: 'יום A',
              entries: [{ ex: 'סקוואט', done: true, setLog: [{ w: 100, r: 10 }] }] });
});
B.load({ logs: many, program: PROGRAM, goal: 'מסת שריר' });
const vt = B.volumeTrend();
t('הנפח הוכפל', vt.pct, 100);
t('הממוצע האחרון', vt.now, 1000);
t('הממוצע הקודם', vt.before, 500);

/* ירידה מזוהה כירידה */
const down = many.slice(0, 4).map(function (l) { return l; });
[8, 6, 4, 2].forEach(function (d) {
  down.push({ date: ago(d), dayName: 'יום A', day_name: 'יום A',
              entries: [{ ex: 'סקוואט', done: true, setLog: [{ w: 25, r: 10 }] }] });
});
B.load({ logs: down, program: PROGRAM, goal: 'מסת שריר' });
t('ירידה שלילית', B.volumeTrend().pct, -50);

console.log('\n' + (fail ? 'נכשלו: ' + fail : 'הכל עבר') + '  |  עברו: ' + pass);
process.exit(fail ? 1 : 0);

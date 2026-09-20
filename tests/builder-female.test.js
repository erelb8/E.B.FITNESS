/* בדיקות לתבנית הבית לנשים בבנייה החכמה.

   שלוש נקודות שהכי קל לשבור כאן:
   1. ההפרדה בין שתי ההתייחסויות. בחירה למתאמנת נשמרת ב-refProgramIdF,
      ואם היא תדרוס את refProgramId — כל הבניות לגברים משתנות בשקט.
   2. ברירת המחדל חלה רק כשלא נבחר דבר. ברגע שהמאמן בחר תוכנית
      אמיתית, גם הפיצול חייב לחזור לרגיל — אחרת הוא רואה שם של
      תוכנית אחת ומקבל את המבנה של אחרת.
   3. התבנית אינה מתאמנת ולכן אסור שתיספר במונה "תוכניות שכתבת". */
const fs = require('fs');

const TRAINEES = [
  { id: 'f1', name: 'מתאמנת', gender: 'נקבה', level: 'מתחיל', program: { days: [] } },
  { id: 'm1', name: 'מתאמן',  gender: 'זכר',  level: 'מתקדם', program: { days: [] } },
  { id: 'ref', name: 'התייחסות', gender: 'זכר', program: { days: [
      { name: 'א', exercises: [
        { name: 'לחיצת חזה במוט', sets: '5', reps: '5', rest: '150' },
        { name: 'סקוואט',        sets: '5', reps: '5', rest: '150' } ] } ] } }
];

global.window    = { S: { trainees: TRAINEES, settings: {} } };
global.tById     = id => TRAINEES.find(t => t.id === id) || null;
global.esc       = s => String(s == null ? '' : s);
global.openModal = () => {};
global.closeModal= () => {};
global.sel       = () => '';
global.gv        = () => '';
global.save      = () => {};

/* הספרייה נטענת כי הבונה מסנן דרכה לפי מקום האימון */
eval(fs.readFileSync(__dirname + '/../exercise-library.js', 'utf8'));
eval(fs.readFileSync(__dirname + '/../builder.js', 'utf8'));
const B = window.EBBuild;

let pass = 0, fail = 0;
function t(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++; else { fail++; console.log('✗ ' + name + '\n   התקבל: ' + JSON.stringify(got)
    + '\n   ציפינו: ' + JSON.stringify(want)); }
}
/* open() קובע את המתאמן שעבורו בונים, ורק אז לבנייה יש מגדר לקרוא */
function buildFor(id, opt) {
  B.open(id);
  return B.build(Object.assign({ days: 3, goal: 'fit', level: 'מתחיל', eq: 'gym', limits: [] }, opt));
}
const lower = r => /תחתון/.test(r.days[0].name);

console.log('=== ברירת מחדל למתאמנת ===');
let f = buildFor('f1');
t('שלושה ימים',            f.days.length, 3);
t('פיצול הנשים',           lower(f), true);
t('אין יום ריק',           f.days.filter(d => !d.exercises.length).length, 0);
const names = f.days.reduce((a, d) => a.concat(d.exercises.map(e => e.name)), []);
t('תרגיל מהתבנית נבחר',    names.indexOf('היפ ת׳רסט') > -1 || names.indexOf('דדליפט רומני') > -1, true);

console.log('=== מתאמן אינו מושפע ===');
t('פיצול רגיל', lower(buildFor('m1')), false);

console.log('=== המונה אינו סופר את התבנית ===');
t('תוכנית אחת בלבד', buildFor('f1').meta.learned, 1);

console.log('=== בחירה ידנית גוברת ===');
B.open('f1'); B.setHouse('ref');
t('נשמר במפתח הנשי',       window.S.settings.refProgramIdF, 'ref');
t('הכללי לא נדרס',         !window.S.settings.refProgramId, true);
t('הפיצול חזר לרגיל',      lower(buildFor('f1')), false);

console.log('=== בחירה לגבר אינה נוגעת בנשים ===');
B.open('m1'); B.setHouse('ref');
t('נשמר במפתח הכללי',      window.S.settings.refProgramId, 'ref');
t('הנשי לא השתנה',         window.S.settings.refProgramIdF, 'ref');

console.log('=== ניקוי בחירה מחזיר לברירת המחדל ===');
B.open('f1'); B.setHouse('');
t('ריק מפורש אינו התבנית', lower(buildFor('f1')), false);

console.log('=== כל אורכי הפיצול ===');
window.S.settings = {};
[2, 3, 4, 5].forEach(n => {
  const r = buildFor('f1', { days: n });
  t(n + ' ימים — מספר הימים', r.days.length, n);
  t(n + ' ימים — אין יום ריק', r.days.filter(d => !d.exercises.length).length, 0);
});

console.log('=== מקום האימון ===');
const EX = window.EBEx;
const allNames = r => r.days.reduce((a, d) => a.concat(d.exercises.map(e => e.name)), []);
const fits = (r, place) => allNames(r).every(n => {
  const info = EX.ALL.filter(x => x.n === n)[0];
  return !info || EX.fitsPlace(info, place);
});
['gym','studio','box','cross','home','out'].forEach(place => {
  const r = buildFor('m1', { eq: place, days: 3 });
  t(place + ' — אין יום ריק', r.days.filter(d => !d.exercises.length).length, 0);
  t(place + ' — כל התרגילים אפשריים שם', fits(r, place), true);
  t(place + ' — המקום נשמר על היום', r.days[0].place, place);
});
const home = allNames(buildFor('m1', { eq: 'home', days: 3 }));
t('בבית אין מכונות וכבלים', home.some(n => /מכונה|בכבל|פולי|בסמית/.test(n)), false);
const gymNames = allNames(buildFor('m1', { eq: 'gym', days: 4 }));
t('כל שם שהבונה נותן קיים בספרייה', gymNames.every(n => EX.ALL.some(x => x.n === n)), true);

console.log(fail ? '\nנכשלו: ' + fail : '\nהכל עבר  |  עברו: ' + pass);
process.exit(fail ? 1 : 0);

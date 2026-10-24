/* מחירים ותשלומים לא מגיעים למתאמן.
   מה שהמתאמן מקבל מהשרת הוא רק העמודות המשותפות של שורת המתאמן
   (SHARED ב-sync.js) — כל השאר נשמר ב-private, שהקישור שלו לא מחזיר.
   שדה כספי שנוסף בטעות ל-SHARED היה נחשף לכל המתאמנים בלי שום סימן.
   נבדק מול השרת החי ב-22.10.2026: trainee_program מחזיר name, goal,
   program, files, trainer_name, goal2, success3m, meals, meals_self,
   exercises_self, health, weighins — בלי private; וטבלת payments מחזירה
   0 שורות למפתח הציבורי. */
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'sync.js'), 'utf8');
let pass = 0, fail = 0;
const t = (n, ok, i) => { ok ? pass++ : fail++; if (!ok) console.log('FAIL  ' + n + (i ? '\n      ' + i : '')); };

const m = src.match(/const SHARED = \[([\s\S]*?)\];/);
t('נמצאה רשימת השדות המשותפים', !!m);
const shared = m ? m[1].match(/'([^']+)'/g).map(s => s.slice(1, -1)) : [];
for (const f of ['pkg', 'pricePerSession', 'balanceDue', 'pkgTotal', 'pkgUsed', 'payments', 'notes', 'phone'])
  t('"' + f + '" לא נשלח למתאמן', shared.indexOf(f) < 0, shared.join(','));

/* program משותף — ולכן אסור שהחבילה תיכתב לתוכו */
const idx = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
t('המחיר לא נכתב לתוך program', !/program\.(price|pkg)/.test(idx));

console.log('\n' + (fail ? 'נכשלו: ' + fail : 'הכל עבר') + '  |  עברו: ' + pass);
process.exit(fail ? 1 : 0);

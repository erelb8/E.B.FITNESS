/* בדיקות למנוע ההתקדמות של המתאמן.

   הדגש הוא על מנוע העידוד: אותה ירידה עצמה חייבת להיקרא הצלחה למי
   שבחיטוב וכישלון למי שבבניית מסה, והקצב נמדד כאחוז ממשקל הגוף —
   700 גרם בשבוע הם קצב סביר ל-110 ק״ג ומהירים מדי ל-55.

   השקילות מוזנות ישירות ל-DB דרך db(), כי localStorage אינו קיים
   כאן. זו גם הסיבה ש-load אינו נקרא: הוא היה מאפס את מה שהוזן. */
const fs = require('fs');
global.window = {};
eval(fs.readFileSync(__dirname + '/../progress.js', 'utf8'));
const P = global.window.EBProg;

let pass = 0, fail = 0;
function t(name, got, want) {
  const ok = got === want;
  ok ? pass++ : fail++;
  if (!ok) console.log('FAIL  ' + name + '\n      got=' + got + '  want=' + want);
}

function iso(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
       + '-' + String(d.getDate()).padStart(2, '0');
}
/* n שקילות שבועיות אחורה, עם שינוי קבוע לשבוע. האחרונה היום. */
function seed(startW, perWeek, n) {
  const DB = P.db();
  DB.logs = [];
  DB.workouts = {};
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i * 7);
    DB.logs.push({ date: iso(d), w: Math.round((startW + (n - 1 - i) * perWeek) * 100) / 100 });
  }
  return DB.logs[DB.logs.length - 1].w;
}

/* ---------- כיוון לפי המטרה ---------- */
console.log('=== כיוון לפי נוסח המטרה ===');
t('חיטוב',            P.direction('חיטוב וירידה באחוזי שומן'), 'down');
t('מסה',              P.direction('עלייה במסה'),                'up');
t('שמירה',            P.direction('שמירה על המשקל'),            'keep');
t('רה-קומפוזיציה',    P.direction('ירידה באחוזי שומן ובניית שריר'), 'keep');
t('בניית מסת שריר',   P.direction('בניית מסת שריר'),           'up');
t('כוח',              P.direction('להתחזק ולהרים יותר'),       'strength');
t('בלי מטרה',         P.direction(''),                          null);
t('מטרה לא מוכרת',    P.direction('להרגיש טוב יותר'),           null);

/* ---------- שיפוט שינוי שבועי ---------- */
console.log('=== שיפוט שינוי שבועי ===');
t('ירידה בחיטוב טובה',   P.judge(-0.6, 'down').cls, 'good');
t('ירידה במסה רעה',      P.judge(-0.6, 'up').cls,   'warn');
t('עלייה במסה טובה',     P.judge(0.6, 'up').cls,    'good');
t('רעש אינו נצבע',       P.judge(-0.2, 'down').cls, 'flat');
t('יציבות בשמירה טובה',  P.judge(0.2, 'keep').cls,  'flat');
t('כוח אינו נשפט במאזניים', P.judge(0.6, 'strength').cls, 'flat');

/* ---------- מגמה ---------- */
console.log('=== מגמה על ארבעה שבועות ===');
seed(80, -0.5, 4);
const per = P.trendPerWeek();
t('ירידה של חצי קילו לשבוע', Math.round(per * 100) / 100, -0.5);

P.db().logs = [{ date: iso(new Date()), w: 80 }];
t('שקילה אחת אינה מגמה', P.trendPerWeek(), null);

/* ---------- מנוע העידוד ---------- */
console.log('=== מנוע העידוד ===');

let bw = seed(80, -0.5, 4);                 /* 0.625% לשבוע — בטווח 0.4–1.0 */
t('חיטוב בקצב — משבח',        P.coach('down', bw).cls,  'good');
t('חיטוב בקצב — כל הכבוד',    /כל הכבוד/.test(P.coach('down', bw).head), true);

bw = seed(80, -0.1, 4);                     /* 0.125% — זז אבל איטי */
t('חיטוב איטי — מדרבן',       P.coach('down', bw).cls,  'warn');
t('חיטוב איטי — מכיר בכיוון', /בכיוון הנכון/.test(P.coach('down', bw).head), true);

bw = seed(80, 0.3, 4);                      /* עולה בזמן חיטוב */
t('חיטוב בכיוון הפוך — מדרבן', P.coach('down', bw).cls, 'warn');

bw = seed(80, -1.2, 4);                     /* 1.5% — מהר מדי */
t('ירידה מהירה מדי — מתריע',  P.coach('down', bw).cls,  'warn');
t('ירידה מהירה מדי — כותרת',  P.coach('down', bw).head, 'מהר מדי');

bw = seed(70, 0.3, 4);                      /* 0.43% — בטווח 0.15–0.5 */
t('מסה בקצב — משבח',          P.coach('up', bw).cls,    'good');

bw = seed(70, 1.0, 4);                      /* 1.43% — מהר מדי למסה */
t('מסה מהירה מדי — מתריע',    P.coach('up', bw).cls,    'warn');

bw = seed(75, 0.05, 4);                     /* יציב */
t('שמירה יציבה — משבח',       P.coach('keep', bw).cls,  'good');

bw = seed(75, 1.0, 4);                      /* מתנדנד */
t('שמירה מתנדנדת — מתריע',    P.coach('keep', bw).cls,  'warn');

/* אותו קצב עצמו, שני משקלי גוף — האחוז הוא שקובע */
seed(55, -0.7, 4);
t('700 גרם ל-55 ק״ג מהיר מדי', P.coach('down', 55 - 0.7 * 3).head, 'מהר מדי');
seed(110, -0.7, 4);
t('700 גרם ל-110 ק״ג בקצב',    P.coach('down', 110 - 0.7 * 3).cls, 'good');

/* מצבי קצה */
P.db().logs = [];
t('בלי שקילות — מזמין להתחיל', P.coach('down', 0).cls, 'flat');
seed(80, -0.5, 4);
t('בלי מטרה — בלי שיפוט',      P.coach(null, 80).cls,  'flat');
P.db().logs = [{ date: iso(new Date()), w: 80 }];
t('שקילה אחת — בלי שיפוט',     P.coach('down', 80).cls, 'flat');
seed(80, 0.2, 4);
t('כוח — מסר ייעודי',          P.coach('strength', 80).cls,  'flat');
t('כוח — לא לפי המאזניים',     /מאזניים/.test(P.coach('strength', 80).head), true);

/* ---------- מיזוג מהשרת ---------- */
console.log('=== מיזוג שקילות מהשרת ===');
P.db().logs = [{ date: '2026-09-01', w: 80 }];
P.mergeServer([{ date: '2026-08-25', weight: 81 }, { date: '2026-09-01', weight: 80 }]);
t('שורה מהשרת מצטרפת',       P.db().logs.length, 2);
t('אותו תאריך אינו מוכפל',   P.db().logs.filter(l => l.date === '2026-09-01').length, 1);
t('הסדר כרונולוגי',          P.db().logs[0].date, '2026-08-25');

P.db().logs = [{ date: '2026-09-01', w: 79, pend: true }];
P.mergeServer([{ date: '2026-09-01', weight: 85 }]);
t('שורה שממתינה לשליחה גוברת', P.db().logs[0].w, 79);

P.db().logs = [{ date: '2026-09-01', w: 80 }];
P.mergeServer(null);
t('עמודה חסרה בשרת אינה מוחקת', P.db().logs.length, 1);
P.mergeServer([{ date: '2026-09-02', weight: 0 }, { date: '', weight: 70 }]);
t('שורות פסולות נדחות',        P.db().logs.length, 1);

/* ---------- יום השקילה ---------- */
console.log('=== יום השקילה ===');
t('חמישי הוא יום השקילה', P.WEIGH_DAY, 4);
const left = P.daysToWeighDay();
t('הספירה לחמישי בטווח', left >= 0 && left <= 6, true);
t('היום חמישי מתאים לספירה', P.isWeighDay(), left === 0);

console.log(fail ? '\n' + fail + ' נכשלו  |  עברו: ' + pass
                 : '\nהכל עבר  |  עברו: ' + pass);
process.exit(fail ? 1 : 0);

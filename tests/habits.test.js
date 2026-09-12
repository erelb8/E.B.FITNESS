/* בדיקות להרגלים היומיים.

   שלוש נקודות שהכי קל לשבור כאן:
   1. המזהה הוא השם ולא האינדקס. המאמן שמוסיף מתיחה באמצע הרשימה
      אסור שיזיז סימונים של אתמול לפריט אחר.
   2. "יום נסגר" בתזונה נכון גם מהסימון הכללי וגם מארוחה בודדת —
      למתאמן בלי תפריט מוגדר אין ארוחות לסמן בכלל.
   3. prune חייב למחוק. הבלוב משותף עם טיוטת האימון ויש תקרה של
      60,000 תווים בשרת, וחריגה ממנה נכשלת בשקט אצל המתאמן. */
const fs = require('fs');
global.window = {};
eval(fs.readFileSync(__dirname + '/../habits.js', 'utf8'));
const H = global.window.EBHabits;

let pass = 0, fail = 0;
function t(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  if (!ok) console.log('FAIL  ' + name + '\n      got=' + JSON.stringify(got) + '  want=' + JSON.stringify(want));
}
const ago = n => H.shiftISO(H.todayISO(), n);

/* ---------- מזהים ---------- */
console.log('=== מזהה לפי שם ===');
t('רווחים נדחסים',    H.idOf('  מתיחת   ארבע ראשי '), 'מתיחת ארבע ראשי');
t('אותיות גדולות',     H.idOf('Hip Flexor'), 'hip flexor');
t('ריק',               H.idOf(null), '');

/* ---------- נרמול ---------- */
console.log('=== נרמול קלט שבור ===');
t('לא אובייקט',        H.normalize(null), { own: [], marks: {} });
t('own כמחרוזות',      H.normalize({ own: ['גשר', ' גשר '] }).own, [{ id: 'גשר', name: 'גשר' }]);
t('תאריך לא תקין',     H.normalize({ marks: { 'מחר': { food: true } } }).marks, {});
t('ערך שאינו true',    H.normalize({ marks: { '2026-09-10': { mob: { a: 1 } } } }).marks, {});
t('יום ריק נזרק',      H.normalize({ marks: { '2026-09-10': {} } }).marks, {});
t('food תקין נשמר',    H.normalize({ marks: { '2026-09-10': { food: true } } }).marks,
                       { '2026-09-10': { food: true } });

/* ---------- הרשימה המשותפת ---------- */
console.log('=== רשימת המתיחות ===');
const prog = { mobility: [{ name: 'מתיחת ארבע ראשי', note: '30 שניות לכל צד' }, { name: 'גשר ירכיים' }] };
const own  = [{ id: 'פלאנק צד', name: 'פלאנק צד' }];
t('של המאמן ואז שלו',  H.items(prog, own).map(x => x.name),
                       ['מתיחת ארבע ראשי', 'גשר ירכיים', 'פלאנק צד']);
t('סימון בעלות',       H.items(prog, own).map(x => x.mine), [false, false, true]);
t('הערת המאמן עוברת',  H.items(prog, own)[0].note, '30 שניות לכל צד');
t('כפילות — של המאמן', H.items(prog, [{ id: 'גשר ירכיים', name: 'גשר ירכיים' }]).length, 2);
t('בלי תוכנית',        H.items(null, own).map(x => x.name), ['פלאנק צד']);

/* ---------- סימון ---------- */
console.log('=== סימון וביטול ===');
let h = H.normalize(null);
H.mark(h, '2026-09-10', 'mob', 'גשר', true);
t('סומן',              H.isMarked(h, '2026-09-10', 'mob', 'גשר'), true);
t('אחר לא סומן',       H.isMarked(h, '2026-09-10', 'mob', 'פלאנק'), false);
H.mark(h, '2026-09-10', 'mob', 'גשר', false);
t('בוטל',              H.isMarked(h, '2026-09-10', 'mob', 'גשר'), false);
t('יום ריק נמחק',      h.marks['2026-09-10'], undefined);
H.mark(h, '2026-09-10', 'food', null, true);
t('סימון יומי כללי',   H.isMarked(h, '2026-09-10', 'food', null), true);
H.mark(h, '2026-09-10', 'meals', 'בוקר|שייק', true);
t('ארוחה בודדת',       H.isMarked(h, '2026-09-10', 'meals', 'בוקר|שייק'), true);

/* המזהה הוא השם — הוספה באמצע הרשימה לא מזיזה סימונים */
console.log('=== יציבות מול שינוי סדר ===');
let h2 = H.normalize(null);
H.mark(h2, ago(1), 'mob', H.idOf('גשר ירכיים'), true);
const after = { mobility: [{ name: 'מתיחה חדשה' }, { name: 'מתיחת ארבע ראשי' }, { name: 'גשר ירכיים' }] };
t('הסימון נשאר על הנכון',
  H.items(after, []).map(x => H.isMarked(h2, ago(1), 'mob', x.id)), [false, false, true]);

/* ---------- יום נסגר ---------- */
console.log('=== יום נסגר ===');
let h3 = H.normalize(null);
H.mark(h3, '2026-09-10', 'mob', 'גשר', true);
t('מתיחה אחת מספיקה',  H.dayDone(h3, '2026-09-10', 'mob'), true);
t('תזונה עוד לא',      H.dayDone(h3, '2026-09-10', 'food'), false);
H.mark(h3, '2026-09-10', 'meals', 'בוקר|שייק', true);
t('ארוחה סוגרת תזונה', H.dayDone(h3, '2026-09-10', 'food'), true);
let h4 = H.normalize(null);
H.mark(h4, '2026-09-10', 'food', null, true);
t('סימון כללי סוגר',   H.dayDone(h4, '2026-09-10', 'food'), true);
t('יום שלא נגעו בו',   H.dayDone(h4, '2026-09-09', 'food'), false);

/* ---------- שבוע ודבקות ---------- */
console.log('=== שבוע ודבקות ===');
let h5 = H.normalize(null);
[0, 1, 3].forEach(n => H.mark(h5, ago(n), 'mob', 'גשר', true));
t('שבעה ימים',         H.week(h5, 'mob').length, 7);
t('האחרון הוא היום',   H.week(h5, 'mob')[6].date, H.todayISO());
t('שלושה מתוך שבעה',   H.adherence(h5, 'mob'), { done: 3, of: 7, pct: 43 });
t('אפס בתזונה',        H.adherence(h5, 'food'), { done: 0, of: 7, pct: 0 });

/* ---------- רצף ---------- */
console.log('=== רצף ===');
let h6 = H.normalize(null);
[0, 1, 2].forEach(n => H.mark(h6, ago(n), 'mob', 'גשר', true));
t('שלושה ברצף',        H.streak(h6, 'mob'), 3);
let h7 = H.normalize(null);
[1, 2].forEach(n => H.mark(h7, ago(n), 'mob', 'גשר', true));
t('היום עוד לא שובר',  H.streak(h7, 'mob'), 2);
let h8 = H.normalize(null);
[2, 3].forEach(n => H.mark(h8, ago(n), 'mob', 'גשר', true));
t('אתמול ריק — שובר',  H.streak(h8, 'mob'), 0);
t('בלי כלום',          H.streak(H.normalize(null), 'mob'), 0);

/* ---------- ניקוי ---------- */
console.log('=== ניקוי ===');
let h9 = H.normalize(null);
H.mark(h9, ago(5), 'mob', 'גשר', true);
H.mark(h9, ago(200), 'mob', 'גשר', true);
H.prune(h9);
t('הישן נמחק',         h9.marks[ago(200)], undefined);
t('החדש נשאר',         !!h9.marks[ago(5)], true);

/* ---------- מיזוג בין מכשירים ----------
   המתאמן מסמן מהטלפון ומהטאבלט. דריסה הייתה מוחקת לו חצי שבוע. */
console.log('=== מיזוג ===');
let phone = H.normalize(null), tablet = H.normalize(null);
H.mark(phone,  '2026-09-10', 'mob', 'גשר', true);
H.mark(tablet, '2026-09-11', 'mob', 'גשר', true);
H.mark(tablet, '2026-09-10', 'food', null, true);
tablet.own.push({ id: 'פלאנק צד', name: 'פלאנק צד' });
const m = H.merge(phone, tablet);
t('יום של הטלפון נשאר',  H.isMarked(m, '2026-09-10', 'mob', 'גשר'), true);
t('יום של הטאבלט נוסף',  H.isMarked(m, '2026-09-11', 'mob', 'גשר'), true);
t('תזונה מתאחדת',        H.isMarked(m, '2026-09-10', 'food', null), true);
t('פריט אישי עובר',      m.own.map(x => x.name), ['פלאנק צד']);
t('מיזוג עם ריק',        H.merge(phone, null).marks, phone.marks);
t('בלי כפילות בפריטים',  H.merge(tablet, tablet).own.length, 1);

console.log('=== ריק ===');
t('חדש הוא ריק',         H.isEmpty(H.normalize(null)), true);
t('עם סימון אינו ריק',   H.isEmpty(phone), false);
t('עם פריט אינו ריק',    H.isEmpty({ own: [{ id: 'a', name: 'a' }], marks: {} }), false);

console.log(fail ? '\nנכשלו: ' + fail : '\nהכל עבר  |  עברו: ' + pass);
process.exit(fail ? 1 : 0);

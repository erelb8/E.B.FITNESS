/* בדיקות למצבות המחיקה.

   הרקע: הדחיפה זיהתה מחיקה לפי מה שנעלם מהרשימה המקומית. מחיקה
   אמיתית של מתאמן אחד ורשימה שאיבדה מתאמן אחד נראות זהות לגמרי,
   ולכן ב-15.9.2026 נמחקה מתאמנת שלמה יום אחרי שנוספה, בלי שאיש
   לחץ עליה "מחק".

   מה שמבדיל ביניהן הוא כוונה, ואותה רושמים בזמן המחיקה. הבדיקות
   כאן מגנות על שלושת הכללים:
   1. בלי מצבה — לא מוחקים. זו ברירת המחדל הבטוחה.
   2. עם מצבה — מוחקים, גם אם זה מתאמן בודד.
   3. המצבה שייכת לטבלה שלה. מזהה שנמחק ב-sessions לא מרשה מחיקה
      של מתאמן שבמקרה נושא את אותו מזהה. */
const fs = require('fs');

/* אחסון מקומי מדומה — sync.js קורא לו ישירות */
const store = {};
global.localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; }
};
global.navigator = { onLine: true };
global.window = { EBFIT_CONFIG: { URL: '', ANON: '' }, addEventListener(){}, location:{href:''} };
global.document = { addEventListener(){}, getElementById: () => null, querySelectorAll: () => [] };
global.fetch = () => Promise.reject(new Error('אין רשת בבדיקה'));

eval(fs.readFileSync(__dirname + '/../sync.js', 'utf8'));
const Sy = window.EBSync;

let pass = 0, fail = 0;
function t(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++; else { fail++; console.log('✗ ' + name + '\n   התקבל: ' + JSON.stringify(got)
    + '\n   ציפינו: ' + JSON.stringify(want)); }
}
const P = Sy.partitionGone;

console.log('=== בלי מצבה לא מוחקים ===');
t('נעדר בלי מצבה',      P(['a'], {}, 'trainees'),  { wanted: [], unknown: ['a'] });
t('מצבות ריקות',        P(['a','b'], { trainees:{} }, 'trainees'), { wanted: [], unknown: ['a','b'] });
t('מצבות חסרות לגמרי',  P(['a'], null, 'trainees'), { wanted: [], unknown: ['a'] });

console.log('=== עם מצבה מוחקים, גם אחד בודד ===');
t('מתאמן בודד שנמחק',   P(['a'], { trainees:{ a:1 } }, 'trainees'), { wanted: ['a'], unknown: [] });
t('חלק מסומן וחלק לא',  P(['a','b','c'], { trainees:{ a:1, c:1 } }, 'trainees'),
                        { wanted: ['a','c'], unknown: ['b'] });

console.log('=== המצבה שייכת לטבלה שלה ===');
t('מצבה בטבלה אחרת אינה מתירה',
  P(['a'], { sessions:{ a:1 } }, 'trainees'), { wanted: [], unknown: ['a'] });

console.log('=== קלט ריק ===');
t('אין נעדרים', P([], { trainees:{ a:1 } }, 'trainees'), { wanted: [], unknown: [] });
t('undefined',  P(undefined, {}, 'trainees'),            { wanted: [], unknown: [] });

console.log('=== רישום מצבה נשמר ונקרא ===');
Sy.tomb('trainees', 'x1');
t('מזהה בודד',   P(['x1'], JSON.parse(store['ebfit_sync_tombs']), 'trainees'),
                 { wanted: ['x1'], unknown: [] });
Sy.tomb('sessions', ['s1','s2']);
const all = JSON.parse(store['ebfit_sync_tombs']);
t('רשימה',       P(['s1','s2'], all, 'sessions'), { wanted: ['s1','s2'], unknown: [] });
t('לא דרס טבלה קודמת', P(['x1'], all, 'trainees'), { wanted: ['x1'], unknown: [] });

console.log('=== קלט שבור לא מפיל ולא רושם ===');
const before = store['ebfit_sync_tombs'];
Sy.tomb('trainees', []);
Sy.tomb('', 'q');
Sy.tomb('trainees', null);
t('לא השתנה', store['ebfit_sync_tombs'], before);

console.log('=== מצבה אינה נוצרת מאליה ===');
t('מזהה שלא נרשם', P(['לא-נרשם'], JSON.parse(store['ebfit_sync_tombs']), 'trainees'),
                   { wanted: [], unknown: ['לא-נרשם'] });

/* ---------- מונה הגרסה ----------
   מכשיר שמחזיק עותק ישן ניצח נתונים טריים, כי "האחרון מנצח" מומש
   לפי סדר הדחיפה. ב-15.9.2026 המין של אחד-עשר מתאמנים נמחק והוחזר
   שלוש פעמים באותו יום, ובכל פעם חזר בדיוק אותו מצב ישן.

   הכלל: דוחפים רק אם השרת לא התקדם מאז המשיכה שלנו.

   ב-v133 נוסתה גרסה שהשוותה את updated_at של השרת. היא נכשלה כי
   updated_at משתנה בכל כתיבה — כולל כתיבה שלנו — ולכן גם שמירה חיה
   של המאמן נראתה כהתנגשות ונזרקה. הבדיקה האחרונה כאן היא בדיוק
   המקרה ההוא, והיא קיימת כדי שזה לא יחזור. */
const SR = Sy.splitByRev;
const snap = o => { const m = {}; Object.keys(o).forEach(k => { m[k] = JSON.stringify({ id:k, rev:o[k] }); }); return m; };
const R2 = list => list.map(id => ({ id: id }));
const ids = o => ({ send: o.send.map(r => r.id), stale: o.stale });

console.log('=== מכשיר שמפגר אינו דוחף ===');
t('השרת התקדם',
  ids(SR(R2(['a']), snap({ a:1 }), { a:2 })), { send: [], stale: ['a'] });
t('השרת התקדם הרבה',
  ids(SR(R2(['a']), snap({ a:0 }), { a:9 })), { send: [], stale: ['a'] });
t('חלק מפגר וחלק לא',
  ids(SR(R2(['a','b']), snap({ a:1, b:1 }), { a:2, b:1 })), { send: ['b'], stale: ['a'] });

console.log('=== שמירה חיה תמיד עוברת ===');
t('אותו מונה — שמירה רגילה',
  ids(SR(R2(['a']), snap({ a:3 }), { a:3 })), { send: ['a'], stale: [] });
t('אפס מול אפס — נתונים ישנים בלי מונה',
  ids(SR(R2(['a']), snap({ a:0 }), { a:0 })), { send: ['a'], stale: [] });
t('שורה חדשה שאינה בשרת',
  ids(SR(R2(['new']), snap({ a:5 }), { a:5 })), { send: ['new'], stale: [] });
t('אין לנו תצלום לשורה',
  ids(SR(R2(['a']), {}, { a:0 })), { send: ['a'], stale: [] });

console.log('=== בלי מידע מהשרת ממשיכים כרגיל ===');
t('srv חסר',       ids(SR(R2(['a','b']), snap({ a:1 }), null)), { send: ['a','b'], stale: [] });
t('srv null לשורה', ids(SR(R2(['a']), snap({ a:1 }), { a:null })), { send: ['a'], stale: [] });
t('אין שורות',      ids(SR([], {}, {})),        { send: [], stale: [] });
t('rows undefined', ids(SR(undefined, {}, {})), { send: [], stale: [] });

console.log('=== התצלום שבור — לא חוסמים ===');
t('JSON פגום בתצלום',
  ids(SR(R2(['a']), { a:'{לא JSON' }, { a:0 })), { send: ['a'], stale: [] });

console.log('=== הרגרסיה של v133 ===');
/* מכשיר מעודכן ששומר פעמיים ברצף: אחרי הדחיפה הראשונה השרת עלה
   ל-2, והתצלום עלה איתו. הדחיפה השנייה חייבת לעבור. */
t('שמירה שנייה ברצף עוברת',
  ids(SR(R2(['a']), snap({ a:2 }), { a:2 })), { send: ['a'], stale: [] });

console.log(fail ? '\nנכשלו: ' + fail : '\nהכל עבר  |  עברו: ' + pass);
process.exit(fail ? 1 : 0);

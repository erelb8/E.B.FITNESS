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

/* הערה על מה שלא נמצא כאן: ב-v133 נוסתה הגנה שהשוותה את updated_at
   של השרת לחותמת שנשמרה במשיכה, ודילגה על דחיפה של שורה שהשתנתה
   בינתיים. היא הוסרה ב-v134 — היא דילגה גם על שמירה חיה של המאמן,
   והמשיכה שמיד אחריה דרסה את מה שהרגע נשמר. הגנה שמאבדת עבודה
   גרועה מהבעיה שהיא מונעת. */

console.log(fail ? '\nנכשלו: ' + fail : '\nהכל עבר  |  עברו: ' + pass);
process.exit(fail ? 1 : 0);

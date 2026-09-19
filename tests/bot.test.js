/* בדיקות למאמן החכם.

   הדגש הוא על ההשוואה בין אימונים: המאמן חייב לקרוא 60 קילו לשמונה
   חזרות כחזקים מ-65 לשלוש, אחרת הוא יברך על נסיגה ויזהיר על שיא.
   לכן ההשוואה היא ב-1RM משוער ולא במשקל שעל המוט. */
const fs = require('fs');
global.window = {};
eval(fs.readFileSync(__dirname + '/../coach-bot.js', 'utf8'));
const B = global.window.EBBot;

let pass = 0, fail = 0;
function t(name, got, want) {
  const ok = got === want;
  ok ? pass++ : fail++;
  if (!ok) console.log('FAIL  ' + name + '\n      got=' + got + '  want=' + want);
}

function ago(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
       + '-' + String(d.getDate()).padStart(2, '0');
}
/* אימון אחד: [שם, משקל, חזרות, בוצע] */
function log(days, dayName, rows) {
  return { date: ago(days), dayName: dayName,
           entries: rows.map(r => ({ ex: r[0], weight: r[1], reps: r[2], done: r[3] !== false })) };
}
const PROGRAM = { days: [{ name: 'יום A', exercises: [{ name: 'סקוואט', sets: '3', reps: '8' }] },
                         { name: 'יום B', exercises: [{ name: 'לחיצה', sets: '3', reps: '8' }] }] };

/* ---------- 1RM משוער ---------- */
console.log('=== 1RM משוער ===');
t('משקל בלי חזרות',        B.e1rm(100, null),  100);
t('60 לשמונה',             Math.round(B.e1rm(60, 8)),  76);
t('65 לשלוש',              Math.round(B.e1rm(65, 3)),  72);
t('60x8 חזק מ-65x3',       B.e1rm(60, 8) > B.e1rm(65, 3), true);
t('משקל ריק נדחה',         B.e1rm('', 8),      null);
t('משקל אפס נדחה',         B.e1rm(0, 8),       null);

/* ---------- סדרות ---------- */
console.log('=== סדרות לפי תרגיל ===');
B.load({ logs: [
  log(20, 'יום A', [['סקוואט', 60, 8], ['לחיצת חזה', 40, 10]]),
  log(13, 'יום A', [['סקוואט', 62.5, 8]]),
  log(6,  'יום A', [['סקוואט', 65, 8], ['לחיצת חזה', 45, 10]])
], program: PROGRAM });
let s = B.series();
t('שני תרגילים',            Object.keys(s).length, 2);
t('שלוש נקודות לסקוואט',    s['סקוואט'].length, 3);
t('סדר כרונולוגי',          s['סקוואט'][0].w, 60);

/* סט לא מסומן אינו נספר, ושני סטים באותו יום — הכבד קובע */
B.load({ logs: [
  log(5, 'יום A', [['סקוואט', 50, 10, false], ['סקוואט', 70, 5], ['סקוואט', 60, 5]])
], program: PROGRAM });
s = B.series();
t('תרגיל שלא בוצע נדחה',    (s['סקוואט'] || []).length, 1);
t('הסט הכבד ביום קובע',     s['סקוואט'][0].w, 70);

/* ---------- מגמות ---------- */
console.log('=== מגמות ===');
B.load({ logs: [
  log(28, 'יום A', [['סקוואט', 60, 8]]),
  log(21, 'יום A', [['סקוואט', 62.5, 8]]),
  log(14, 'יום A', [['סקוואט', 65, 8]]),
  log(3,  'יום A', [['סקוואט', 70, 8]])
], program: PROGRAM });
let tr = B.trends().find(x => x.name === 'סקוואט');
t('ארבעה אימונים',          tr.sessions, 4);
t('האחרון הוא שיא',         tr.isPR, true);
t('לא תקוע',                tr.stalled, false);
t('עלייה מעל 5 אחוז',       tr.gainPct > 5, true);

/* תקיעה: שלושה אחרונים אינם עוברים את המרב שלפניהם */
B.load({ logs: [
  log(30, 'יום A', [['לחיצת חזה', 60, 8]]),
  log(23, 'יום A', [['לחיצת חזה', 70, 8]]),
  log(16, 'יום A', [['לחיצת חזה', 68, 8]]),
  log(9,  'יום A', [['לחיצת חזה', 69, 8]]),
  log(2,  'יום A', [['לחיצת חזה', 67, 8]])
], program: PROGRAM });
tr = B.trends().find(x => x.name === 'לחיצת חזה');
t('מזוהה כתקוע',            tr.stalled, true);
t('אינו שיא',               tr.isPR, false);

/* ---------- עקביות ---------- */
console.log('=== עקביות ===');
B.load({ logs: [log(2, 'יום A', [['סקוואט', 60, 8]]),
                log(9, 'יום B', [['סקוואט', 60, 8]])], program: PROGRAM });
let c = B.consistency();
t('שני אימונים בחודש',      c.last4Weeks, 2);
t('מתוכננים שני ימים',      c.planned, 2);
t('ימים מאז האחרון',        c.lastAt, 2);

/* ---------- ימים שנזנחו ---------- */
console.log('=== ימים שנזנחו ===');
B.load({ logs: [log(3, 'יום A', [['סקוואט', 60, 8]])], program: PROGRAM });
t('יום B נזנח',             B.neglectedDays().join(','), 'יום B');
B.load({ logs: [log(3, 'יום A', [['סקוואט', 60, 8]]),
                log(5, 'יום B', [['סקוואט', 60, 8]])], program: PROGRAM });
t('שני הימים אומנו',        B.neglectedDays().length, 0);

/* ---------- הודעות ---------- */
console.log('=== הודעות ===');
B.load({ logs: [], program: PROGRAM });
let m = B.messages();
t('בלי דיווחים — מסביר',    /עוד לא דיווחת/.test(m[0].title), true);

B.load({ logs: [log(25, 'יום A', [['סקוואט', 60, 8]])], program: PROGRAM });
m = B.messages();
t('נעלם — ההודעה ראשונה',   /לא התאמנת/.test(m[0].title), true);
t('נעלם — נצבע כאזהרה',     m[0].tone, 'warn');

B.load({ logs: [
  log(20, 'יום A', [['סקוואט', 60, 8]]),
  log(13, 'יום A', [['סקוואט', 62.5, 8]]),
  log(6,  'יום A', [['סקוואט', 65, 8]]),
  log(1,  'יום B', [['סקוואט', 70, 8]])
], program: PROGRAM });
m = B.messages();
t('שיא מדווח',              m.some(x => /שיא חדש/.test(x.title)), true);
t('שיא נצבע כטוב',          m.find(x => /שיא חדש/.test(x.title)).tone, 'good');

/* המשקל שמוצג הוא מה שהורם, לא ה-1RM המשוער */
t('מוצג המשקל בפועל',       /70 ק״ג/.test(m.find(x => /שיא חדש/.test(x.title)).text), true);

/* בלי מטרה ובלי שקילות — אין מסר משקל גוף, ואין קריסה */
t('אין הודעת משקל בלי נתונים', m.some(x => x.icon === '⚖️'), false);

/* ---------- גרפים ---------- */
console.log('=== גרפים ===');
B.load({ logs: [], weighins: [
  { date: ago(21), weight: 86 }, { date: ago(14), weight: 85.2 },
  { date: ago(7),  weight: 84.6 }, { date: ago(0), weight: 84.1 }
], program: PROGRAM });
const wp = B.weightPoints();
t('ארבע נקודות משקל', wp.length, 4);
t('ממוין לפי זמן', wp[0].v, 86);
const svg = B.lineChart(wp, { color: 'var(--or)' });
t('נוצר SVG', /^<svg /.test(svg), true);
t('יש קווים מנחים', (svg.match(/ch-grid/g) || []).length, 4);
t('נקודה לכל שקילה', (svg.match(/<circle/g) || []).length, 4);
t('נקודה אחת מודגשת', (svg.match(/ch-last/g) || []).length, 1);
t('נקודה בודדת אינה גרף', B.lineChart([wp[0]], {}), '');

/* ציר הזמן אמיתי: הפסקה ארוכה יוצרת מרווח רחב */
B.load({ weighins: [{ date: ago(60), weight: 90 }, { date: ago(59), weight: 89 },
                    { date: ago(0),  weight: 88 }], logs: [], program: PROGRAM });
const g = B.lineChart(B.weightPoints(), {});
const cx = [...g.matchAll(/<circle cx="([0-9.]+)"/g)].map(m => +m[1]);
t('הפסקה נראית כמרווח', (cx[2] - cx[1]) > (cx[1] - cx[0]) * 10, true);

B.load({ logs: [], weighins: [], program: PROGRAM });
t('כרטיס גוף בלי נתונים', /עוד אין מספיק נתונים/.test(B.bodyBlock()), true);

/* ---------- מסלול התוכנית ---------- */
console.log('=== מסלול התוכנית ===');
B.load({ logs: [], program: { planStart: ago(45), planMonths: 3 } });
let pl = B.plan();
t('שלושה חודשים = 13 שבועות', pl.totalWeeks, 13);
t('אחרי 45 יום זה שבוע 7', pl.weekNow, 7);
t('לא הסתיים', pl.ended, false);

B.load({ logs: [], program: { planStart: ago(0), planMonths: 3 } });
t('יום ההתחלה הוא שבוע 1', B.plan().weekNow, 1);

B.load({ logs: [], program: { planStart: ago(200), planMonths: 3 } });
t('אחרי הזמן — הסתיים', B.plan().ended, true);
t('אחוז נעצר ב-100', B.plan().pct, 100);

B.load({ logs: [], program: { planMonths: 6, planStart: ago(7) } });
t('שישה חודשים = 26 שבועות', B.plan().totalWeeks, 26);

B.load({ logs: [], program: {} });
t('בלי תאריך התחלה — null', B.plan(), null);

/* ---------- רצף ---------- */
console.log('=== רצף שבועות ===');
B.load({ logs: [{ date: ago(1) }, { date: ago(8) }, { date: ago(15) }], program: {} });
t('שלושה שבועות רצופים', B.streak().weeks >= 3, true);

B.load({ logs: [{ date: ago(1) }, { date: ago(8) }, { date: ago(40) }], program: {} });
t('פער שובר את הרצף', B.streak().weeks <= 2, true);

B.load({ logs: [], program: {} });
t('בלי אימונים — אפס', B.streak().weeks, 0);

/* הרצף אינו נמחק כשהתוכנית הסתיימה */
B.load({ logs: [{ date: ago(1) }, { date: ago(8) }, { date: ago(15) }, { date: ago(22) }],
         program: { planStart: ago(200), planMonths: 3 } });
t('תוכנית שהסתיימה', B.plan().ended, true);
t('הרצף שרד את סוף התוכנית', B.streak().weeks >= 4, true);

/* ---------- v175: מה שמאמן אמיתי היה אומר ---------- */
console.log('=== מאמן אמיתי ===');
const titles = () => B.messages({ skipWeight: true }).map(m => m.title).join(' | ');
const RANGE = { days: [{ name: 'יום A', exercises: [{ name: 'סקוואט', sets: '3', reps: '8-10' }] }] };
const withNote = (d, w, r, feel, note) => Object.assign(log(d, 'יום A', [['סקוואט', w, r]]), { feel: feel, note: note });

// אותו משקל ארבע פעמים — לא "שיא"
B.load({ logs: [12, 9, 5, 2].map(d => log(d, 'יום A', [['סקוואט', 60, 8]])), program: RANGE });
t('חזרה על אותו משקל אינה שיא', /שיא חדש/.test(titles()), false);

// שיפור אמיתי — כן שיא
B.load({ logs: [[12, 55], [9, 57.5], [5, 60], [2, 62.5]].map(x => log(x[0], 'יום A', [['סקוואט', x[1], 8]])), program: RANGE });
t('שיפור אמיתי הוא שיא', /שיא חדש/.test(titles()), true);

// הקצה העליון של הטווח — להעלות משקל
B.load({ logs: [5, 2].map(d => log(d, 'יום A', [['סקוואט', 60, 10]])), program: RANGE });
t('10 מתוך 8-10 — זמן להעלות', /זמן להעלות משקל בסקוואט/.test(titles()), true);
t('ההמלצה 62.5', /62\.5/.test(B.messages({ skipWeight: true }).map(m => m.text).join(' ')), true);
B.load({ logs: [log(2, 'יום A', [['סקוואט', 60, 9]])], program: RANGE });
t('9 מתוך 8-10 — עוד לא', /זמן להעלות/.test(titles()), false);

// כאב בהערה — ההודעה הראשונה
B.load({ logs: [withNote(5, 60, 8), withNote(2, 60, 8, 'בסדר', 'כואבת לי הברך בסקוואט')], program: RANGE });
t('כאב הוא ההודעה הראשונה', B.messages({ skipWeight: true })[0].title, 'כתבת שמשהו כאב');
t('עם כאב — לא מציעים להעלות', /זמן להעלות/.test(titles()), false);
B.load({ logs: [withNote(2, 60, 8, 'בסדר', 'הלבן היה טוב, תרגילים קלים')], program: RANGE });
t('"לבן" ו"תרגילים" אינם כאב', /כאב/.test(titles()), false);

// "קשה" ברצף וביצועים יורדים — מנוחה
B.load({ logs: [withNote(9, 60, 8, 'קשה'), withNote(5, 60, 7, 'קשה'), withNote(2, 55, 6, 'קשה')], program: RANGE });
t('קשה ויורד — הגוף מבקש מנוחה', /הגוף מבקש מנוחה/.test(titles()), true);

// day_name מהשרת — היום שאומן אינו "מוזנח"
B.load({ logs: [{ date: ago(2), day_name: 'יום A', entries: [] }], program: PROGRAM });
t('day_name מהשרת נספר', B.neglectedDays().join(','), 'יום B');

// ימים ריקים לא נספרים לתדירות
B.load({ logs: [], program: { days: PROGRAM.days.concat([{ name: 'יום F', exercises: [] }, { name: 'יום G', exercises: [] }]) } });
t('ימים ריקים לא נספרים', B.consistency().planned, 2);

// תוכנית מחזורית — שבוע אחד ולא 12 אימונים בשבוע
const cyc = [];
[1, 2, 3].forEach(c => ['A', 'B', 'C', 'D'].forEach(x => cyc.push({ name: 'מחזור ' + c + ' · אימון ' + x, exercises: [{ name: 'x', sets: '3', reps: '8' }] })));
B.load({ logs: [], program: { days: cyc } });
t('מחזורית — 4 בשבוע', B.consistency().planned, 4);
t('מחזורית — אין "יום מוזנח"', B.neglectedDays().length, 0);

/* ---------- v175: תזונה ---------- */
console.log('=== תזונה ===');
global.window.EBProg = { direction: g => /חיטוב|ירידה/.test(g) ? 'down' : /מסה|מסת/.test(g) ? 'up' : null };
const food = (k, p, n, tk, tp) => ({ days: Array.from({ length: 14 }, (_, i) => ({ iso: ago(i), k: i ? k : 0, p: i ? p : 0, n: i ? n : 0 })), kcal: tk, protein: tp });
const nt = (goal, f) => { B.load({ logs: [log(2, 'יום A', [['סקוואט', 60, 8]])], program: RANGE, goal: goal, food: f });
                          return B.messages({ skipWeight: true }).map(m => m.title).join(' | '); };
t('חיטוב ומעל היעד', /מעל היעד הקלורי/.test(nt('חיטוב', food(2600, 150, 3, 2000, 150))), true);
t('מסה ומתחת ליעד', /מתחת ליעד/.test(nt('מסת שריר', food(2200, 150, 3, 2800, 150))), true);
t('מעט מדי — בכל מטרה', /אוכל מעט מדי/.test(nt('חיטוב', food(1100, 90, 3, 2000, 150))), true);
t('ביעד — מחמאה', /תזונה מדויקת/.test(nt('חיטוב', food(2050, 150, 3, 2000, 150))), true);
t('חלבון נמוך', /חלבון נמוך/.test(nt('חיטוב', food(2000, 80, 3, 2000, 150))), true);
t('ארוחה אחת ביום — לא נספר כיום מלא', /רשמת תזונה/.test(nt('חיטוב', food(600, 30, 1, 2000, 150))), true);
t('ארוחה אחת ביום — לא "מעט מדי"', /מעט מדי/.test(nt('חיטוב', food(600, 30, 1, 2000, 150))), false);
t('בלי רישום בכלל — שקט', /תזונה|קלור|חלבון/.test(nt('חיטוב', food(0, 0, 0, 2000, 150))), false);
delete global.window.EBProg;

console.log(fail ? '\n' + fail + ' נכשלו  |  עברו: ' + pass
                 : '\nהכל עבר  |  עברו: ' + pass);
process.exit(fail ? 1 : 0);

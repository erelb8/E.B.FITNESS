/* בדיקות להדמיות התרגילים.

   1. כל תרגיל בספרייה מקבל תבנית — אחרת המתאמן לא רואה כפתור.
   2. מלכודת העברית: "שק" (שק אגרוף) בתוך "משקולות", "מתח" בתוך "מתחת".
      בגרסה הראשונה 94 תרגילי משקולות סווגו כאגרוף.
   3. אורכי הגפיים קבועים בכל פריים של כל תבנית. אם IK נשבר, יד או רגל
      "נמתחות" — וזה נראה מיד כמו באג.
   4. אין NaN באף נקודה — NaN בציור לא זורק שגיאה, פשוט לא מצייר. */
const fs = require('fs');
global.window = {};
global.performance = { now: () => 0 };
eval(fs.readFileSync(__dirname + '/../exercise-library.js', 'utf8'));
eval(fs.readFileSync(__dirname + '/../anim.js', 'utf8'));
const A = global.window.EBAnim, X = global.window.EBEx;

let pass = 0, fail = 0;
function t(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  if (!ok) console.log('FAIL  ' + name + '\n      got=' + JSON.stringify(got) + '  want=' + JSON.stringify(want));
}
const p = n => (A.classify(n) || {}).p || null;

console.log('=== כל הספרייה מכוסה ===');
const none = X.ALL.filter(x => !A.classify(x.n, x.m, x.e)).map(x => x.n);
t('אין תרגיל בלי הדמיה', none, []);

console.log('=== מלכודת "שק" ו"מתח" ===');
t('משקולות אינן אגרוף', p('לחיצת חזה במשקולות'), 'press');
t('משקל אינו אגרוף', p('מקבילים עם משקל'), 'dip');
t('שק אמיתי — אגרוף', p('שק — ג׳אב ישר'), 'box');
t('"מתחת" אינו מתח', p('דדליפט עם עצירה מתחת לברך'), 'deadlift');
t('מתח אמיתי', p('מתח אחיזה רחבה'), 'pullup');
t('פול-אפארט אינו מתח', p('פול-אפארט בגומייה'), 'pullapart');

console.log('=== סדר הכללים ===');
t('לאנג׳ הליכה — לאנג׳', p('לאנג׳ הליכה'), 'lunge');
t('מקרבים במכונה — לא מתיחה', p('מקרבים במכונה'), 'sidelying');
t('קלאמשל — לא פרפר חזה', p('פרפר בשכיבה (קלאמשל)'), 'sidelying');
t('כפיפות אופניים — בטן', p('כפיפות אופניים'), 'twist');
t('אפרייט — לא חתירה', p('אפרייט רואו'), 'uprow');
t('פשיטה בשכיבה — צרפתי', p('פשיטת מרפק בשכיבה במשקולות'), 'skull');
t('שם חופשי לפי מילת מפתח', p('סקוואט עם משהו שלא בספרייה'), 'squat');
t('שם בלי שום רמז', A.classify('משהו לגמרי אחר'), null);

console.log('=== שמות שהוקלדו ביד בתוכניות אמיתיות ===');
t('כפיפות ברך (ך סופית)', p('כפיפות ברך במכונה'), 'legcurl');
t('כפיפת ברכיים', p('כפיפת ברכיים במכונה'), 'legcurl');
t('היפ תראסט בלי גרש', p('היפ תראסט'), 'hipthrust');
t('הליכת פארמר', p('הליכת פארמר'), 'walk');
t('הרמת עקבים', p('הרמת עקבים בישיבה במכונה'), 'calf');
t('הנפות רגליים בתלייה', p('הנפות רגליים בתלייה'), 'hangraise');
t('לאונג׳ים', p('לאונג׳ים'), 'lunge');
t('חימום', p('חימום (חובה)'), 'circles');
t('אירובי Z2', p('אירובי בסיס — Z2'), 'run');
t('שורה שאינה תרגיל', A.classify('למה זה בתוכנית'), null);
t('סבב שני לא משנה סיווג קיים', p('מתיחת תאומים עם גומייה בישיבה'), 'seatedham');

console.log('=== שרירים עובדים ===');
const mus = n => A.muscles(n);
t('סקוואט — ארבע ראשי עיקרי', mus('סקוואט גבי')[0], 'quads');
t('לחיצת חזה — חזה עיקרי', mus('לחיצת חזה במוט')[0], 'chest');
t('השריר מהספרייה גובר: היפ ת׳רסט — עכוז', mus('היפ ת׳רסט')[0], 'glutes');
t('לחיצת חזה במכונה — חזה ולא כתפיים', mus('לחיצת חזה במכונה')[0], 'chest');
t('בלי כפילויות', (() => { const m = mus('דדליפט קלאסי'); return m.length === new Set(m).size; })(), true);
const noMus = X.ALL.filter(x => { const c = A.classify(x.n, x.m, x.e); return c && !['roll', 'hold'].includes(c.p) && !A.muscles(x.n).length; }).map(x => x.n);
t('לכל תרגיל (חוץ מגליל) יש שריר', noMus, []);

console.log('=== אורכי גפיים קבועים, אין NaN ===');
const L = { thigh: 64, shin: 62, uarm: 46, farm: 42 };
const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
let worst = { err: 0 }, nan = [];
const eqs = ['bw', 'bar', 'db', 'kb', 'cable', 'band', 'machine', 'smith', 'trx', 'ball', 'water', 'other'];
Object.keys(A.PATTERNS).forEach(k => {
  eqs.forEach(e => {
    let s; try { s = A._build({ p: k, e: e }); } catch (er) { nan.push(k + '/' + e + ': ' + er.message); return; }
    for (let i = 0; i < 20; i++) {
      const b = A._frame(s, i / 20);
      if (Object.keys(b).some(j => !isFinite(b[j][0]) || !isFinite(b[j][1]))) { nan.push(k + '/' + e); break; }
      [['hip', 'knee1', 'thigh'], ['knee1', 'ank1', 'shin'], ['hip2', 'knee2', 'thigh'], ['knee2', 'ank2', 'shin'],
       ['sh', 'elb1', 'uarm'], ['elb1', 'wr1', 'farm'], ['sh2', 'elb2', 'uarm'], ['elb2', 'wr2', 'farm']].forEach(([a, c, l]) => {
        const err = Math.abs(d(b[a], b[c]) - L[l]);
        if (err > worst.err) worst = { err: err, at: k + '/' + e + ' ' + a + '-' + c };
      });
    }
  });
});
t('אין NaN ואין קריסה', nan, []);
t('גפיים לא נמתחות (סטייה < 0.5)', worst.err < 0.5, true);
if (worst.err >= 0.5) console.log('      worst:', JSON.stringify(worst));

console.log('\n' + (fail ? '### נכשלו: ' + fail : 'הכל עבר') + '  |  עברו: ' + pass);
process.exit(fail ? 1 : 0);

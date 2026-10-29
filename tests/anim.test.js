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
t('פול-אפארט אינו מתח', p('פול-אפארט בגומייה'), 'fpullapart');

console.log('=== סדר הכללים ===');
t('לאנג׳ הליכה — לאנג׳', p('לאנג׳ הליכה'), 'lunge');
t('מקרבים במכונה — לא מתיחה ולא פשיטת ברך', p('מקרבים במכונה'), 'fhipmachine');
t('קלאמשל — לא פרפר חזה', p('פרפר בשכיבה (קלאמשל)'), 'sidelying');
t('כפיפות אופניים — בטן', p('כפיפות אופניים'), 'twist');
t('אפרייט — לא חתירה', p('אפרייט רואו'), 'uprow');
t('פשיטה בשכיבה — צרפתי', p('פשיטת מרפק בשכיבה במשקולות'), 'skull');
t('שם חופשי לפי מילת מפתח', p('סקוואט עם משהו שלא בספרייה'), 'squat');
t('שם בלי שום רמז', A.classify('משהו לגמרי אחר'), null);

console.log('=== תרגיל מקבל את התנועה שלו ולא של תרגיל דומה (אוקטובר 2026) ===');
const pv = n => { const c = A.classify(n) || {}; return c.p + (c.v ? ':' + c.v : ''); };
t('קיקבק לעכוז — רגל, לא יד אחורית', p('קיקבק בעמידה עם משקולת'), 'kickbackleg');
t('קיקבק ליד אחורית נשאר', p('קיקבק'), 'kickback');
t('כפיפה בסקוט — על כרית, לא בעמידה', pv('כפיפה בסקוט (preacher)'), 'curl:preacher');
t('היפר-אקסטנשן — ספסל 45, לא שכיבה', p('היפר-אקסטנשן'), 'hyper');
t('בק אקסטנשן 45', p('בק אקסטנשן 45 מעלות'), 'hyper');
t('רוורס היפר', p('רוורס היפר במכונה'), 'revhyper');
t('עליות עקבים בישיבה', pv('עליות עקבים בישיבה'), 'calf:seated');
t('עליות עקבים בלחיצת רגליים — לא לחיצת רגליים', pv('עליות עקבים בלחיצת רגליים'), 'calf:legpress');
t('טיביאליס — האצבעות עולות', pv('הרמת קדמת השוק (טיביאליס)'), 'calf:toes');
t('נורדיק — לא מכונת כפיפת ברך', p('נורדיק קרל'), 'nordic');
t('נורדיק הפוך', pv('נורדיק הפוך'), 'nordic:rev');
t('כפיפת ברך בישיבה', pv('כפיפת ברך בישיבה'), 'legcurl:seated');
t('כפיפת ברך בעמידה', pv('כפיפת ברך בכבל בעמידה'), 'legcurl:stand');
t('משיכה בזרועות ישרות — לא פולי עליון', p('משיכת פולי עליון בזרועות ישרות'), 'straightpull');
t('סיבוב חיצוני — לא הרחקה', p('סיבוב חיצוני בכבל'), 'fextrot');
t('עמידת ידיים — לא פלאנק', p('עמידת ידיים על קיר'), 'hspu');
t('שכיבת סמיכה על הראש', p('שכיבת סמיכה על הראש בקיר'), 'hspu');
t('V-up — לא פלאנק', p('V-up'), 'vup');
t('הולו — לא פלאנק', p('הולו הולד'), 'hollow');
t('פייק', pv('שכיבת סמיכה פייק'), 'pushup:pike');
t('שכיבות סמיכה על ברכיים', pv('שכיבות סמיכה על ברכיים'), 'pushup:knees');
t('לחיצת רצפה — בלי ספסל', pv('לחיצת רצפה במוט'), 'press:floor');
t('לחיצת סקוויז — לחיצה, לא פרפר', p('לחיצת סקוויז במשקולות'), 'press');
t('הליכה בהליכון — לא ריצה', pv('הליכון — הליכה בשיפוע'), 'walk:tread');
t('פול-ת׳רו — ציר ירך עם כבל', p('פול-ת׳רו בכבל'), 'hinge');
t('פיתול עמוד שדרה — לא כפיפות בטן', p('פיתול עמוד שדרה בשכיבה'), 'openbook');
t('השחלת מחט — על ארבע', p('השחלת מחט'), 'tkneel');
t('מכונת מרחיקים', p('מרחיקים במכונה'), 'fhipmachine');
t('לחיצת חזה בכבלים בישיבה — במכונה', (A.classify('לחיצת חזה בכבלים בישיבה') || {}).alt, 'chestpress');

console.log('=== תנועות שתוקנו ===');
const fr = (n, t) => A._frame(A._build(A.classify(n)), t);
/* מקבילים: הרגליים באוויר, לא על הרצפה */
t('מקבילים — כפות הרגליים מעל הרצפה', [0, 0.25, 0.5, 0.75].every(x => fr('מקבילים לחזה', x).ank1[1] < -40), true);
/* סופרמן: החזה עולה מהרצפה ולא שוקע מתחתיה */
t('סופרמן — הכתף לא מתחת לרצפה', [0, 0.25, 0.5, 0.75].every(x => fr('סופרמן', x).sh[1] < 0), true);
/* פייס פול: היד מגיעה לפנים והמרפק לאחור — לא מרפק שמצביע מעל הראש */
t('פייס פול — המרפק לא מעל הראש', [...Array(40).keys()].map(i => i / 40).every(x => { const b = fr('פייס פול', x); return b.elb1[1] > b.head[1] - 15; }), true);  // 15 — רדיוס הראש: לא מעל קודקוד הראש
/* מתיחות: היד מגיעה לרגל */
const hq = fr('מתיחת ארבע ראשי בעמידה', 0.5);
t('מתיחת ארבע ראשי — היד אוחזת בכף הרגל', Math.hypot(hq.wr2[0] - hq.ank2[0], hq.wr2[1] - hq.ank2[1]) < 10, true);

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
    /* th / ah — קיצור פרספקטיבה במבט מלפנים (ירך או זרוע שמכוונות
       אל המצלמה). שם האורך המצויר קצר בכוונה. */
    const shortLeg = s.res.some(r => r.th < 1), shortArm = s.res.some(r => r.ah < 1 || r.fs < 1);
    for (let i = 0; i < 20; i++) {
      const b = A._frame(s, i / 20);
      if (Object.keys(b).some(j => !isFinite(b[j][0]) || !isFinite(b[j][1]))) { nan.push(k + '/' + e); break; }
      [['hip', 'knee1', 'thigh'], ['knee1', 'ank1', 'shin'], ['hip2', 'knee2', 'thigh'], ['knee2', 'ank2', 'shin'],
       ['sh', 'elb1', 'uarm'], ['elb1', 'wr1', 'farm'], ['sh2', 'elb2', 'uarm'], ['elb2', 'wr2', 'farm']].forEach(([a, c, l]) => {
        if ((shortLeg && l === 'thigh') || (shortArm && (l === 'uarm' || l === 'farm'))) return;
        const err = Math.abs(d(b[a], b[c]) - L[l]);
        if (err > worst.err) worst = { err: err, at: k + '/' + e + ' ' + a + '-' + c };
      });
    }
  });
});
t('אין NaN ואין קריסה', nan, []);
t('גפיים לא נמתחות (סטייה < 0.5)', worst.err < 0.5, true);
if (worst.err >= 0.5) console.log('      worst:', JSON.stringify(worst));

console.log('=== מרפק וברך לא קופצים בין פריימים ===');
/* עד אוקטובר 2026 צד הכיפוף התחלף בבת אחת באמצע התנועה, והמרפק או
   הברך "קפצו" לצד השני בפריים אחד — בכמאה תבניות. 400 פריימים לסיבוב:
   תזוזה רגילה של מפרק היא 1-8 יחידות לפריים. */
const jumps = [], seenJ = {};
X.ALL.forEach(x => {
  const c = A.classify(x.n, x.m, x.e), k = c.p + '/' + c.e + '/' + (c.v || '') + (c.alt || '');
  if (seenJ[k]) return; seenJ[k] = 1;
  const s = A._build(c); let prev = null, worst = 0;
  for (let i = 0; i <= 400; i++) {
    const b = A._frame(s, i / 400);
    if (prev) ['elb1', 'elb2', 'knee1', 'knee2'].forEach(j => { worst = Math.max(worst, d(b[j], prev[j])); });
    prev = b;
  }
  if (worst > 14) jumps.push(x.n + ' (' + Math.round(worst) + ')');
});
t('אין קפיצות מפרק', jumps, []);

console.log('\n' + (fail ? '### נכשלו: ' + fail : 'הכל עבר') + '  |  עברו: ' + pass);
process.exit(fail ? 1 : 0);

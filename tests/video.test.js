/* בדיקות לסרטוני הביצוע.

   מה חשוב כאן:
   1. אישי גובר על כללי — זה כל הטעם בסרטון אישי (תיקון טכניקה למתאמן אחד).
   2. ההתאמה לפי שם סלחנית לרווחים, כי שמות בתוכניות הוקלדו ביד.
   3. דף המתאמן מחזיק עותק משלו של אותו כלל (vidOf ב-t.html). שתי
      הגרסאות חייבות לתת אותה תשובה, אחרת המאמן רואה 🎥 והמתאמן לא. */
const fs = require('fs');
global.window = {};
eval(fs.readFileSync(__dirname + '/../video.js', 'utf8'));
const V = global.window.EBVideo;

let pass = 0, fail = 0;
function t(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  if (!ok) console.log('FAIL  ' + name + '\n      got=' + JSON.stringify(got) + '  want=' + JSON.stringify(want));
}

const G = { 'סקוואט בולגרי': { url: 'g1' }, 'דד באג': { url: 'g2' } };

console.log('=== מה המתאמן רואה ===');
t('כללי לפי שם', V.resolve({ name: 'סקוואט בולגרי' }, G), { url: 'g1', own: false });
t('אישי גובר על כללי', V.resolve({ name: 'סקוואט בולגרי', video: { url: 'p1' } }, G), { url: 'p1', own: true });
t('אישי בלי כללי', V.resolve({ name: 'פלאנק', video: { url: 'p2' } }, G), { url: 'p2', own: true });
t('אין סרטון', V.resolve({ name: 'פלאנק' }, G), null);
t('אישי ריק לא נחשב', V.resolve({ name: 'דד באג', video: {} }, G), { url: 'g2', own: false });
t('בלי מפה', V.resolve({ name: 'דד באג' }, null), null);

console.log('=== שמות שהוקלדו ביד ===');
t('רווחים מסביב', V.resolve({ name: '  סקוואט בולגרי ' }, G), { url: 'g1', own: false });
t('רווח כפול באמצע', V.resolve({ name: 'סקוואט  בולגרי' }, G), { url: 'g1', own: false });
t('שם שונה — אין התאמה', V.resolve({ name: 'סקוואט בולגרי עם משקולות' }, G), null);

console.log('=== אותו כלל בדף המתאמן ===');
const src = fs.readFileSync(__dirname + '/../t.html', 'utf8');
function grab(name) {
  const i = src.indexOf('  function ' + name + '(');
  if (i < 0) throw new Error('לא נמצאה ' + name);
  let d = 0, started = false, j = i;
  for (; j < src.length; j++) {
    if (src[j] === '{') { d++; started = true; }
    else if (src[j] === '}') { d--; if (started && d === 0) { j++; break; } }
  }
  return src.slice(i, j);
}
const vidOf = new Function('VIDEOS', grab('vidKey') + grab('vidOf') + 'return vidOf;')(G);
[
  { name: 'סקוואט בולגרי' }, { name: 'סקוואט בולגרי', video: { url: 'p1' } },
  { name: 'פלאנק' }, { name: ' דד באג ' }, { name: 'דד באג', video: {} }
].forEach(e => {
  const r = V.resolve(e, G);
  t('זהה: ' + JSON.stringify(e), vidOf(e), r ? r.url : '');
});

console.log('\n' + (fail ? '### נכשלו: ' + fail : 'הכל עבר') + '  |  עברו: ' + pass);
process.exit(fail ? 1 : 0);

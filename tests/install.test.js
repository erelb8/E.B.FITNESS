/* מה שהטלפון שומר כשמוסיפים את האפליקציה למסך הבית: שם, אייקון וכתובת המניפסט.
   אראל (נובמבר 2026): "עדיין לא השתנה לי התמונה של הלוגו והשם בטלפון". הקבצים באתר
   היו נכונים — אבל הטלפון שומר שם ואייקון ברגע ההוספה, ובאייפון הם לא מתעדכנים אחר
   כך בכלל. באנדרואיד כרום כן מעדכן לבד, בתנאי שכתובת המניפסט לא משתנה; אצלנו היא
   נשאה ?v= והתחלפה בכל גרסה. הבדיקה שומרת שזה לא יחזור, ושמה שמותקן היום נכון:
   השם החדש, אייקון שקיים בגודל המוצהר, וגרסה אחת בכל המקומות. */
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..');
let pass = 0, fail = 0;
const t = (n, ok, i) => { ok ? pass++ : fail++; if (!ok) console.log('FAIL  ' + n + (i ? '\n      ' + i : '')); };
const idx = fs.readFileSync(path.join(R, 'index.html'), 'utf8');
const th = fs.readFileSync(path.join(R, 't.html'), 'utf8');
const sw = fs.readFileSync(path.join(R, 'sw.js'), 'utf8');
const man = JSON.parse(fs.readFileSync(path.join(R, 'manifest.json'), 'utf8'));
const dim = f => { const b = fs.readFileSync(path.join(R, f)); return b.readUInt32BE(16) + 'x' + b.readUInt32BE(20); };

const ver = (sw.match(/const VERSION = 'ebfit-(v\d+)'/) || [])[1];
t('נמצאה גרסה ב-sw.js', !!ver);
t('EB_VERSION ב-index.html תואם ל-sw.js', idx.includes("const EB_VERSION='" + ver + "'"), ver);

t('שם האפליקציה במניפסט', /^BAUER POWER/.test(man.name) && man.short_name === 'BAUER POWER', man.name + ' | ' + man.short_name);
t('אין שם ישן במניפסט', !/E\.B\.? ?FIT/i.test(JSON.stringify(man)));
t('השם שנשמר באייפון', idx.includes('<meta name="apple-mobile-web-app-title" content="BAUER POWER">'));
t('כותרת הדף', /<title>BAUER POWER/.test(idx));

const link = (idx.match(/<link rel="manifest" href="([^"]+)"/) || [])[1];
t('כתובת המניפסט קבועה — בלי ?v=', link === 'manifest.json', link);

t('יש אייקונים במניפסט', man.icons.length >= 3);
man.icons.forEach(i => {
  const [f, q] = i.src.split('?');
  const ok = fs.existsSync(path.join(R, f));
  t('האייקון קיים: ' + f, ok);
  t('האייקון נושא את הגרסה: ' + f, q === 'v=' + ver, i.src);
  if (ok) t('גודל האייקון כמוצהר: ' + f, dim(f) === i.sizes, dim(f) + ' / ' + i.sizes);
});
[['אפליקציית המאמן', idx], ['דף המתאמן', th]].forEach(([name, html]) => {
  const touch = (html.match(/<link rel="apple-touch-icon" href="([^"]+)"/) || [])[1] || '';
  const [f, q] = touch.split('?');
  t('אייקון לאייפון — ' + name, !!f && fs.existsSync(path.join(R, f)) && q === 'v=' + ver, touch);
  if (f && fs.existsSync(path.join(R, f))) t('אייקון לאייפון בגודל 180 — ' + name, dim(f) === '180x180', dim(f));
});
t('האייקונים במטמון של הגרסה', sw.includes('./icons/icon-180.png?v=' + ver) && sw.includes('./icons/icon-192.png?v=' + ver));

console.log('\n' + (fail ? 'נכשלו: ' + fail : 'הכל עבר') + '  |  עברו: ' + pass);
process.exit(fail ? 1 : 0);

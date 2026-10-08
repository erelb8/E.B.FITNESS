/* מדריכים: למתאמנת הטקסט עובר ללשון נקבה, למתאמן — לא נוגעים */
const path = require('path');
global.window = {}; global.S = { settings: {} };
require(path.join(__dirname, '..', 'guides.js'));
const G = window.EBGuides;

let pass = 0, fail = 0;
function t(name, ok, info) { ok ? pass++ : fail++; if (!ok) console.log('FAIL  ' + name + (info ? '\n      ' + info : '')); }
const body = id => G.all().find(g => g.id === id).body;

console.log('=== מי מתאמנת ===');
t('נקבה', G.isHer({ gender: 'נקבה' }));
t('זכר', !G.isHer({ gender: 'זכר' }));
t('בלי מתאמן', !G.isHer(null));

console.log('=== ארוחה משלי ===');
const mm = G.forHer(body('mymeal'));
t('שאת אוכלת', /ארוחה שאת אוכלת/.test(mm), mm);
t('תלחצי', /תלחצי \*אכלתי\?\*/.test(mm), mm);
t('תכתבי לי', /תכתבי לי/.test(mm), mm);
t('לא נשאר זכר', !/אתה|תלחץ |תכתוב/.test(mm), mm);

console.log('=== תזכורת ===');
const bk = G.forHer(body('back'));
t('בואי', /בואי נתחיל/.test(bk), bk);
t('תגידי', /תגידי לי/.test(bk), bk);

console.log('=== הודעת הצהרת הבריאות ===');
const hg = G.forHer(body('hgate'));
t('תיכנסי ותתבקשי', /שתיכנסי, לפני התוכנית, תתבקשי/.test(hg), hg);
t('תעני', /אם תעני "כן"/.test(hg), hg);
t('תכתבי', /תכתבי לי/.test(hg), hg);
t('לא נשאר זכר', !/תיכנס,|תתבקש |תענה|תכתוב/.test(hg), hg);

console.log('=== בלי הקשר לא נוגעים ===');
t('אתמול/אתר נשארים', G.forHer('אתמול באתר') === 'אתמול באתר');
t('טקסט זכר לא משתנה בלי מתאמנת', body('mymeal') === G.all().find(g => g.id === 'mymeal').body);

console.log('\n' + (fail ? 'נכשלו: ' + fail : 'הכל עבר') + '  |  עברו: ' + pass);
process.exit(fail ? 1 : 0);

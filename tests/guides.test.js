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

console.log('=== מדריכים חדשים בלשון נקבה ===');
const sm = G.forHer(body('summary'));
t('תראי / מסמנת / תסמני', /תראי בדף שלך/.test(sm) && /את מסמנת, אז ככל שתסמני/.test(sm), sm);
const rn = G.forHer(body('renew'));
t('את רוצה להמשיך', /אם את רוצה להמשיך/.test(rn), rn);
const op = G.forHer(body('open'));
t('פתיחה: תכתבי לי', /אם יש שאלות, תכתבי לי/.test(op), op);
t('צום: תגידי לי ונזיז', /תגידי לי ונזיז/.test(G.forHer(G.DIET_TXT.if16)));

console.log('=== מילוי דיאטה ותאריך סיום ===');
global.EBMetrics = window.EBMetrics = { DIETS: { if16: { he: 'צום לסירוגין 16:8' } } };
global.planOf = () => ({ endISO: '2026-11-27' });
const dn = G.fill(body('diet'), { name: 'דנה כהן', gender: 'נקבה', diet: 'if16' });
t('שם הדיאטה', /\*צום לסירוגין 16:8\*/.test(dn), dn);
t('ההסבר נכנס ובנקבה', /חלון של 8 שעות/.test(dn) && /תגידי לי ונזיז/.test(dn) && /תכתבי לי ונתאים/.test(dn), dn);
t('בלי דיאטה בכרטיס — אומר איפה בוחרים', /סוג תזונה/.test(G.fill(body('diet'), { name: 'יוסי' })));
const rf = G.fill(body('renew'), { name: 'יוסי', gender: 'זכר' });
t('תאריך סיום 27.11.2026', /מסתיימת ב-27\.11\.2026/.test(rf), rf);
t('לא נשאר סימון למילוי', !/\{/.test(dn + rf), dn + rf);

console.log('=== דף המתאמן ===');
const pg = G.pageList(), pS = pg.find(x => x.id === 'summary');
t('סיכומים מופיעים בדף', !!pS && /בתחילת כל שבוע מופיע כאן/.test(pS.body), pS && pS.body);
t('בדף אין פנייה בזכר', pg.every(x => !/תכתוב|תראה|אתה מסמן/.test(x.body)), pg.map(x => x.body).join('\n---\n'));
t('בלי מקפים ארוכים בהודעות', G.all().every(g => !/—/.test(g.body)), G.all().filter(g => /—/.test(g.body)).map(g => g.id).join(','));

console.log('=== בלי הקשר לא נוגעים ===');
t('אתמול/אתר נשארים', G.forHer('אתמול באתר') === 'אתמול באתר');
t('טקסט זכר לא משתנה בלי מתאמנת', body('mymeal') === G.all().find(g => g.id === 'mymeal').body);

console.log('\n' + (fail ? 'נכשלו: ' + fail : 'הכל עבר') + '  |  עברו: ' + pass);
process.exit(fail ? 1 : 0);

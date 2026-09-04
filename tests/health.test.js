/* בדיקות למנוע הסינון. הדגש על עברית — שם הלוגיקה נשברת.

   הערה על הציפיות: מתאמן בלי הצהרה חתומה לעולם אינו 'green' אלא
   'unknown', גם אם השאלון נקי. לכן בדיקות ה"ירוק" מספקות הצהרה
   חתומה נקייה, ויש קבוצה נפרדת לבדיקת החוסר עצמו. */
const fs = require('fs');
global.window = {};
eval(fs.readFileSync(__dirname + '/../health.js', 'utf8'));
const H = global.window.EBHealth;

let pass = 0, fail = 0;
function t(name, got, want) {
  const ok = got === want;
  ok ? pass++ : fail++;
  if (!ok) console.log('FAIL  ' + name + '\n      got=' + got + '  want=' + want);
}

const CLEAN_DECL = {
  signedAt: '2026-09-01',
  answers: { q1: 'no', q2: 'no', q3: 'no', q4: 'no', q5: 'no', q6: 'no', q7: 'no' }
};

function res(answers, extra) {
  return H.screen(Object.assign({ private: { intake: { answers } } }, extra || {}), null);
}
/* עם הצהרה חתומה נקייה — כדי לבודד את השפעת השאלון */
function lvl(answers) {
  return res(answers, { health: CLEAN_DECL }).level;
}
/* בלי הצהרה */
function lvlNoDecl(answers) {
  return res(answers).level;
}

console.log('=== שלילה: "אין" לא אמור לייצר דגל ===');
t('אין בעיות לב', lvl({ medical: 'אין בעיות לב', birthOrAge: '30', injuries: 'אין', pain: 'אין' }), 'green');
t('ללא',          lvl({ medical: 'ללא', birthOrAge: '30', injuries: 'ללא', pain: 'ללא' }), 'green');
t('אין',          lvl({ medical: 'אין', birthOrAge: '28', injuries: 'אין', pain: 'אין' }), 'green');
t('בריא',         lvl({ medical: 'בריא', birthOrAge: '25', injuries: 'אין', pain: 'אין' }), 'green');

console.log('=== מילים שמכילות מילת דגל ואינן היא ===');
t('לבן לא = לב',  lvl({ medical: 'אורז לבן', birthOrAge: '30', injuries: 'אין', pain: 'אין' }), 'green');
t('בלבד לא = לב', lvl({ medical: 'ריצה בלבד', birthOrAge: '30', injuries: 'אין', pain: 'אין' }), 'green');
t('מלבן לא = לב', lvl({ medical: 'מלבן', birthOrAge: '30', injuries: 'אין', pain: 'אין' }), 'green');

console.log('=== אדום אמיתי ===');
t('בעיות לב',     lvl({ medical: 'בעיות לב', birthOrAge: '40', injuries: 'אין', pain: 'אין' }), 'red');
t('כאב בחזה',     lvl({ medical: 'אין', birthOrAge: '35', injuries: 'אין', pain: 'כאב בחזה במאמץ' }), 'red');
t('התעלפות',      lvl({ medical: 'התעלפות', birthOrAge: '30', injuries: 'אין', pain: 'אין' }), 'red');
t('הריון',        lvl({ medical: 'בהריון', birthOrAge: '31', injuries: 'אין', pain: 'אין' }), 'red');
t('צנתור',        lvl({ medical: 'עבר צנתור', birthOrAge: '52', injuries: 'אין', pain: 'אין' }), 'red');
t('שבץ',          lvl({ medical: 'עבר שבץ', birthOrAge: '60', injuries: 'אין', pain: 'אין' }), 'red');

console.log('=== כתום ===');
t('לחץ דם',       lvl({ medical: 'לחץ דם גבוה', birthOrAge: '38', injuries: 'אין', pain: 'אין' }), 'amber');
t('פריצת דיסק',   lvl({ medical: 'אין', birthOrAge: '33', injuries: 'פריצת דיסק', pain: 'אין' }), 'amber');
t('אסתמה',        lvl({ medical: 'אסתמה', birthOrAge: '27', injuries: 'אין', pain: 'אין' }), 'amber');
t('סוכרת',        lvl({ medical: 'סוכרת סוג 2', birthOrAge: '44', injuries: 'אין', pain: 'אין' }), 'amber');

console.log('=== גיל כגורם סיכון עצמאי ===');
t('גיל 46',       lvl({ medical: 'אין', birthOrAge: '46', injuries: 'אין', pain: 'אין' }), 'amber');
t('גיל 44',       lvl({ medical: 'אין', birthOrAge: '44', injuries: 'אין', pain: 'אין' }), 'green');
t('לידה 1975',    lvl({ medical: 'אין', birthOrAge: '12/03/1975', injuries: 'אין', pain: 'אין' }), 'amber');

console.log('=== חסר מידע איננו בריא ===');
t('שאלון ריק',        lvlNoDecl({}), 'unknown');
t('שאלון נקי בלי הצהרה', lvlNoDecl({ medical: 'אין', birthOrAge: '30', injuries: 'אין', pain: 'אין' }), 'unknown');
t('הצהרה בלי גיל',    lvl({ medical: 'אין', injuries: 'אין', pain: 'אין' }), 'unknown');
t('ממצא גובר על חוסר', lvlNoDecl({ medical: 'בעיות לב' }), 'red');

console.log('=== אדום גובר על כתום ===');
t('לב + דיסק',    lvl({ medical: 'בעיות לב', birthOrAge: '50', injuries: 'פריצת דיסק', pain: 'אין' }), 'red');

console.log('=== הצהרה חתומה ===');
const yes = res({ medical: 'אין', birthOrAge: '30', injuries: 'אין', pain: 'אין' },
  { health: { signedAt: '2026-09-01', answers: { q1: 'no', q2: 'yes', q3: 'no', q4: 'no', q5: 'no', q6: 'no', q7: 'no' } } });
t('כן אחד = אדום', yes.level, 'red');
t('דורש אישור',    yes.needsClearance, true);
t('מסומן חתום',    yes.signed, true);

console.log('=== אישור קיים מוריד את הדרישה ===');
const cert = res({ medical: 'בעיות לב', birthOrAge: '55', injuries: 'אין', pain: 'אין', medCert: 'יש אישור מקרדיולוג' }, { health: CLEAN_DECL });
t('עדיין אדום',   cert.level, 'red');
t('לא דורש שוב',  cert.needsClearance, false);
const noCert = res({ medical: 'בעיות לב', birthOrAge: '55', injuries: 'אין', pain: 'אין', medCert: 'לא' }, { health: CLEAN_DECL });
t('"לא" אינו אישור', noCert.needsClearance, true);

console.log('\n' + (fail ? '### נכשלו: ' + fail : 'הכל עבר') + '  |  עברו: ' + pass);
process.exit(fail ? 1 : 0);

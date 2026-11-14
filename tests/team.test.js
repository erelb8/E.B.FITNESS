/* בדיקות ל"הצוות שלי" — מנוע החוקים וחוזה הפרטיות, בלי דפדפן.

   שני דברים שאסור שיישברו בשקט:
   1. התאמת מילים בעברית: "לב" בתוך "לבן" או "כלב", ושלילה ("אין בעיות לב").
   2. מה שיוצא לצ׳אט: שום שם, טלפון או טקסט רפואי לא מופיע בהקשר או בשאלה. */
const fs = require('fs');
global.window = {};
eval(fs.readFileSync(__dirname + '/../team.js', 'utf8'));
const T = global.window.EBTeam;

let pass = 0, fail = 0;
function t(name, got, want) {
  const ok = got === want;
  ok ? pass++ : fail++;
  if (!ok) console.log('FAIL  ' + name + '\n      got=' + got + '  want=' + want);
}
const TODAY = '2026-11-14';
const NO = { q1: 'no', q2: 'no', q3: 'no', q4: 'no', q5: 'no', q6: 'no', q7: 'no' };
const has = (A, id) => A.all.some(x => x.id === id);
const get = (A, id) => A.all.filter(x => x.id === id)[0];

/* ---------- עברית ---------- */
t('לב במשפט', T.hasTerm('יש לי בעיות לב', 'לב'), true);
t('לבן אינו לב', T.hasTerm('אוכל גבינה לבן', 'לב'), false);
t('כלב אינו לב', T.hasTerm('יש לי כלב', 'לב'), false);
t('חלב אינו לב', T.hasTerm('שותה חלב', 'לב'), false);
t('בשלב אינו לב', T.hasTerm('בשלב זה הכול טוב', 'לב'), false);
t('תחילית מותרת', T.hasTerm('ניתוח בלב לפני שנה', 'לב'), true);
t('שלילה', T.hasTerm('אין לי בעיות לב', 'לב'), false);
t('שלילה עם ו', T.hasTerm('אין סוכרת ולא לחץ דם', 'לחץ דם'), false);
t('שלילה לא עוברת משפטון', T.hasTerm('אין סוכרת, יש לחץ דם', 'לחץ דם'), true);
t('ביטוי של שתי מילים', T.hasTerm('בלט דיסק גב תחתון', 'בלט דיסק'), true);
t('ברכה אינה ברך', T.hasTerm('שוחה בברכה', 'ברך'), false);

/* ---------- מצב לדוגמה ---------- */
function state() {
  return {
    settings: { business: 'BAUER POWER', biz: { type: 'patur', ceiling: 10000, payDay: 10 } },
    trainees: [
      { id: 'a', name: 'דנה כהן', phone: '0501111111', status: 'active', gender: 'נקבה', height: 165, birth: '1995-03-02', joined: '2026-08-01',
        goal: 'חיטוב', pkg: { k: 'coach', price: 400 }, _token: 'x', termsAccepted: { at: 'x' },
        health: { signedAt: '2026-08-02', answers: NO, consent: { at: 'x' } },
        intake: { answers: { medical: 'SECRETMED אין' }, extra: [{ label: '', value: 'בלט דיסק גב תחתון' }] },
        program: { targets: { kcal: 1100 }, days: [{ name: 'יום 1', exercises: [{ name: 'דדליפט קלאסי' }, { name: 'משיכת פולי עליון' }] }] },
        weighins: [{ date: '2026-10-01', weight: 60 }, { date: '2026-10-20', weight: 61 }, { date: '2026-11-10', weight: 62 }], notes: 'SECRETNOTE' },
      { id: 'b', name: '_דנה לוי', phone: '0501111111', status: 'active', joined: '2026-09-01', goal: ')',
        program: { days: [] } },
      { id: 'c', name: 'יוסי מזרחי', phone: '0502222222', status: 'active', gender: 'זכר', height: 1.8, birth: '2010-05-05', joined: '2026-06-01',
        goal: 'מסה', pkg: { k: 'train', price: 300 }, health: { signedAt: '2026-06-02', answers: Object.assign({}, NO, { q5: 'yes' }) },
        program: { days: [{ name: 'A', exercises: [{ name: 'לחיצת חזה במוט' }] }, { name: 'A', exercises: [] }] } },
      { id: 'd', name: 'ישן בארכיון', status: 'archived', _tokenActive: true }
    ],
    payments: [
      { id: 'p1', traineeId: 'a', date: '2026-08-05', amount: 400, method: 'ביט', category: 'ליווי אונליין חודשי' },
      { id: 'p2', traineeId: 'a', date: '2026-10-03', amount: 400, method: 'ביט', category: 'ליווי אונליין חודשי' },
      { id: 'p3', traineeId: 'a', date: '2026-10-09', amount: 400, method: '', category: '' },
      { id: 'p4', traineeId: 'c', date: '2026-06-03', amount: 9000, method: 'מזומן', category: 'תוכנית אימונים' }
    ],
    sessions: [], measures: []
  };
}
const env = (o) => Object.assign({ today: TODAY, logs: [], backupDays: 40, sync: { state: 'out' }, hasKey: false }, o || {});
const A = T.analyze(state(), env());

/* כספים */
t('תקרה: עבר', get(A, 'fin_ceiling').sev, 'pain');
t('לא שילמו החודש', get(A, 'fin_unpaid').ids.join(), 'a');
t('חודש חסר בליווי (ספטמבר)', get(A, 'fin_gap').ids.join(), 'a');
t('חשד לכפילות', get(A, 'fin_dup').ids.join(), 'a');
t('בלי חבילה', get(A, 'fin_nopkg').ids.join(), 'b');
t('תשלום בלי פרטים', has(A, 'fin_fields'), true);
t('סוף שנה: לא לפני אמצע נובמבר', has(A, 'fin_yearend'), false);
t('סוף שנה מאמצע נובמבר', has(T.analyze(state(), env({ today: '2026-11-20' })), 'fin_yearend'), true);
t('בלי סוג עוסק', has(T.analyze(Object.assign(state(), { settings: {} }), env()), 'fin_setup'), true);

/* משפטי */
t('כן בלי אישור רופא', get(A, 'legal_yes').ids.join(), 'c');
t('סתירה שאלון-הצהרה', get(A, 'legal_contra').ids.join(), 'a');
t('בלי הצהרה', get(A, 'legal_nodecl').ids.join(), 'b');
t('קטין', get(A, 'legal_minor').ids.join(), 'c');
t('גישה פתוחה בארכיון', get(A, 'legal_access').ids.join(), 'd');
t('ביטוח לא רשום', has(A, 'legal_ins'), true);
const S2 = state(); S2.settings.biz.insuranceUntil = '2026-11-01';
t('ביטוח שפג', get(T.analyze(S2, env()), 'legal_ins').sev, 'pain');

/* מאמן ראשי */
t('מגבלת גב ודדליפט', get(A, 'co_limit').ids.join(), 'a');
t('קלוריות נמוכות', get(A, 'co_kcal').ids.join(), 'a');
t('בלי תוכנית', get(A, 'co_noprog').ids.join(), 'b');
t('משקל נגד המטרה', get(A, 'co_trend').ids.join(), 'a');
const AP = T.analyze(state(), env({ logs: [{ trainee_id: 'c', date: '2026-11-12', note: 'כואב לי בברך' }] }));
t('כאב ביומן', get(AP, 'co_pain').ids.join(), 'c');

/* מכירות ושימור */
t('שקטים 3 שבועות', get(A, 'gr_gone').ids.slice().sort().join(), 'b,c');
t('בלי יומנים לא מכריזים', has(T.analyze(state(), env({ logs: null })), 'gr_gone'), false);
t('בלי יומנים יש הסבר', has(T.analyze(state(), env({ logs: null })), 'gr_wait'), true);

/* תפעול */
t('לא מחובר', get(A, 'ops_sync').sev, 'pain');
t('גיבוי ישן', get(A, 'ops_backup').sev, 'pain');
t('שם ומטרה משובשים', get(A, 'ops_debris').ids.join(), 'b');
t('אותו טלפון', get(A, 'ops_dup').ids.slice().sort().join(), 'a,b');
t('גובה במטרים', get(A, 'ops_values').ids.join(), 'c');
t('שני ימים באותו שם ויום ריק', get(A, 'ops_prog').ids.join(), 'c');

/* ישיבת בוקר: דחוף לפני ממתין, בלי "מידע" */
t('בוקר ממוין', A.brief[0].sev, 'pain');
t('בוקר בלי info', A.brief.some(x => x.sev === 'info'), false);

/* "טופל" מסתיר עד שההרכב משתנה */
const S3 = state(); S3.settings.teamOk = {}; S3.settings.teamOk[get(A, 'fin_dup').key] = TODAY;
t('טופל מסתיר', has(T.analyze(S3, env()), 'fin_dup'), false);

/* מצב ריק לא נופל */
t('מצב ריק', T.analyze({}, { today: TODAY }).all.every(x => x.sev !== 'pain'), true);

/* ---------- פרטיות ---------- */
const map = { t: {}, seq: 0 };
const ctx = JSON.stringify(T.context(state(), 'legal', env(), map)) + JSON.stringify(T.context(state(), 'finance', env(), map))
          + JSON.stringify(T.context(state(), 'coaching', env(), map));
['דנה', 'כהן', 'לוי', 'יוסי', 'מזרחי', '0501111111', '0502222222', 'SECRETMED', 'SECRETNOTE', 'בלט דיסק', 'דדליפט'].forEach(w =>
  t('לא יוצא החוצה: ' + w, ctx.indexOf(w), -1));
t('ההקשר מכיל קודים', /מתאמן-0\d/.test(ctx), true);

const q = T.mask('מה קורה עם דנה כהן ולמה יוסי לא שילם? הטלפון שלו 050-2222222, ולדנה יש שאלה', state(), map);
t('שם מלא מוסתר', q.indexOf('כהן'), -1);
t('שם פרטי יחיד מוסתר', q.indexOf('יוסי'), -1);
t('שם פרטי משותף מוסתר', q.indexOf('דנה'), -1);
t('טלפון מוסתר', /2222222/.test(q), false);
t('תחילית נשמרת', /ולמתאמן/.test(q), true);
const back = T.unmask('מתאמן-01 צריך לשלם', state(), map);
t('החזרת שם בתצוגה', /מתאמן-01/.test(back), false);
t('קוד לא מוכר נשאר', T.unmask('מתאמן-99', state(), map), 'מתאמן-99');

/* שאלות מהירות ודוח */
t('כמה הכנסתי', /10,200/.test(T.ask('finance', 'ytd', state(), env())), true);
t('דוח לרואה חשבון', /סה״כ 2026: ₪10,200 \(4 תשלומים\)/.test(T.report(state(), env())), true);
t('אין ממצא — תשובה ברורה', T.ask('growth', 'renew', state(), env()), 'בדקתי, ואין כרגע אף אחד כזה.');

/* קוד המקור: בונה ההקשר לא נוגע בטקסט חופשי */
const src = fs.readFileSync(__dirname + '/../team.js', 'utf8');
const ctxSrc = src.slice(src.indexOf('function context('), src.indexOf('var RULES'));
['.notes', '.goal', 'intake', '.text', 'medText', '.name', '.phone'].forEach(w =>
  t('בונה ההקשר בלי ' + w, ctxSrc.indexOf(w), -1));

console.log(fail ? ('### ' + fail + ' נכשלו, ' + pass + ' עברו') : ('team: ' + pass + ' בדיקות עברו'));
process.exit(fail ? 1 : 0);

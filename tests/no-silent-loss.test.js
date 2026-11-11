/* בדיקות נגד הפסד שקט. בכל אחד מהמקרים כאן התוצאה נראתה תקינה למשתמש,
   והנתונים לא היו שם:
   1. גיבוי מלא שהשמיט דיווחים מעבר ל-1000 שורות (limit נחתך בשרת בשקט).
   2. גיבוי שנכשל בטבלה משנית נראה שלם. עכשיו הוא נרשם כחסר ומוצג למאמן.
   3. מתאמן שמחק ארוחה שהשרת לא מחק: הארוחה נעלמה מהמסך ולא הודיעו לו.
   4. דפי הפרומו נשאו את שם העסק הישן בכותרת.
   הבדיקות 3 ו-1-2 רצות על הקוד האמיתי: הפונקציות נשלפות מהקבצים עצמם. */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');

let pass = 0, fail = 0;
function t(name, ok, info) {
  ok ? pass++ : fail++;
  if (!ok) console.log('FAIL  ' + name + (info ? '\n      ' + info : ''));
}

/* ---------- 1–2: גיבוי ---------- */
const store = {};
global.localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; }
};
global.navigator = { onLine: true };
global.window = { addEventListener() {}, location: { href: '' } };
global.document = { addEventListener() {}, getElementById: () => null, querySelectorAll: () => [], readyState: 'complete' };
global.toast = () => {};
global.EBSync = { client: () => null, user: () => ({ email: 'trainer@example.com' }) };
eval(fs.readFileSync(path.join(ROOT, 'backup.js'), 'utf8'));
const collect = window.EBBackup.collect;

/* שרת מדומה: כמו Supabase, מחזיר לכל היותר 1000 שורות בבקשה, לא משנה מה ביקשו */
function fakeSb(data, failTable, orderLog) {
  const fail = { data: null, error: { message: 'permission denied' } };
  return {
    from(table) {
      return {
        select() {
          const cols = [];
          if (orderLog) (orderLog[table] = orderLog[table] || []).push(cols);
          const self = {
            order(col) { cols.push(col); return self; },
            range(from, to) {
              if (table === failTable) return Promise.resolve(fail);
              const rows = data[table] || [];
              const end = Math.min(to + 1, from + 1000, rows.length);
              return Promise.resolve({ data: rows.slice(from, end), error: null });
            },
            then(res, rej) {
              if (table === failTable) return Promise.resolve(fail).then(res, rej);
              return Promise.resolve({ data: data[table] || [], error: null }).then(res, rej);
            }
          };
          return self;
        }
      };
    }
  };
}
const logs = n => Array.from({ length: n }, (_, i) => ({ id: i + 1, trainee_id: 't' + (i % 7) }));

/* ---------- 3: מחיקת ארוחה ---------- */
const tsrc = fs.readFileSync(path.join(ROOT, 't.html'), 'utf8');
const fnStart = tsrc.indexOf('  async function myRemove(libId) {');
const fnEnd = tsrc.indexOf('\n  function todayStr()', fnStart);
const MSG = 'לא הצלחנו להסיר. נסה שוב כשתהיה רשת';

function makeRemover(initial, shouldFail) {
  const log = [];
  const body = `
    let MY_MEALS = init;
    const TOKEN = 'tok';
    const sb = { rpc: (name, args) => rpc(name, args) };
    const writeMy = () => log.push('writeMy');
    const refreshLib = () => log.push('refreshLib');
    const syncCustom = () => log.push('syncCustom');
    const paint = () => log.push('paint');
    const repaintFood = () => log.push('repaintFood');
    const toast = m => log.push('toast:' + m);
    const mergeMy = () => log.push('mergeMy');
    ${tsrc.slice(fnStart, fnEnd)}
    return { myRemove, meals: () => MY_MEALS };
  `;
  const rpc = async (name, args) => {
    log.push('rpc:' + name);
    return shouldFail(args)
      ? { data: null, error: { message: 'boom' } }
      : { data: [], error: null };
  };
  const api = new Function('init', 'log', 'rpc', body)(initial, log, rpc);
  return { api, log };
}
const ids = list => list.map(x => x.libId || x.name);
const lib = id => ({ libId: id, name: 'ארוחה ' + id });

(async () => {
  /* --- 1: גיבוי מלא עם יותר מ-1000 דיווחים --- */
  const ordLog = {};
  global.EBSync.client = () => fakeSb({ workout_logs: logs(2500) }, null, ordLog);
  const full = await collect();
  t('דיווחים נשלפים בעמודים: 2500 מתוך 2500', (full.טבלאות.workout_logs || []).length === 2500,
    'התקבל: ' + (full.טבלאות.workout_logs || []).length);
  const firstOrder = (ordLog.workout_logs || [])[0] || [];
  t('דיווחים נשלפים בסדר קבוע (created_at, id)',
    JSON.stringify(firstOrder) === '["created_at","id"]', JSON.stringify(firstOrder));
  t('גיבוי מלא לא מסמן חסר', (full.חסר || []).length === 0, JSON.stringify(full.חסר));
  t('הספירה מציגה את כל הדיווחים', (full._counts || []).includes('דיווחים 2500'), JSON.stringify(full._counts));

  /* --- 2a: דיווחים נכשלים --- */
  global.EBSync.client = () => fakeSb({}, 'workout_logs');
  const noLogs = await collect();
  t('כשל בדיווחים נרשם כחסר', (noLogs.חסר || []).some(s => s.startsWith('דיווחים')), JSON.stringify(noLogs.חסר));
  t('כשל בדיווחים לא מכניס טבלה ריקה שנראית תקינה', !('workout_logs' in noLogs.טבלאות));

  /* --- 2b: העדפות נכשלות --- */
  global.EBSync.client = () => fakeSb({}, 'trainer_prefs');
  const noPrefs = await collect();
  t('כשל בהעדפות נרשם כחסר', (noPrefs.חסר || []).some(s => s.startsWith('העדפות')), JSON.stringify(noPrefs.חסר));

  /* --- 2c: טבלה ראשית נכשלת — עדיין עוצרת את הגיבוי כמו קודם --- */
  global.EBSync.client = () => fakeSb({}, 'trainees');
  let threw = false;
  try { await collect(); } catch (e) { threw = true; }
  t('כשל בטבלה ראשית עוצר את הגיבוי', threw);

  /* --- 3a: השרת דחה מחיקה — הארוחה חוזרת למקומה --- */
  {
    const { api, log } = makeRemover([lib('a'), lib('b'), lib('c')], args => args.p_lib_id === 'b');
    await api.myRemove('b');
    t('מחיקה שנדחתה: הארוחה חוזרת לאותו מקום', JSON.stringify(ids(api.meals())) === '["a","b","c"]',
      JSON.stringify(ids(api.meals())));
    t('מחיקה שנדחתה: מודיעים למתאמן', log.includes('toast:' + MSG));
    t('מחיקה שנדחתה: המסך מצויר מחדש', log.includes('paint') && log.includes('repaintFood'));
  }

  /* --- 3b: מחיקה מוצלחת — נשארת מחוקה, בלי הודעה --- */
  {
    const { api, log } = makeRemover([lib('a'), lib('b'), lib('c')], () => false);
    await api.myRemove('b');
    t('מחיקה מוצלחת: הארוחה נשארת מחוקה', JSON.stringify(ids(api.meals())) === '["a","c"]',
      JSON.stringify(ids(api.meals())));
    t('מחיקה מוצלחת: בלי הודעת שגיאה', !log.some(s => s.startsWith('toast:')));
  }

  /* --- 3c: שתי מחיקות במקביל, הראשונה נדחית — רק היא חוזרת --- */
  {
    const { api } = makeRemover([lib('a'), lib('b'), lib('c')], args => args.p_lib_id === 'a');
    await Promise.all([api.myRemove('a'), api.myRemove('b')]);
    t('מחיקה נדחית לא מחזירה ארוחה שנמחקה בהצלחה',
      JSON.stringify(ids(api.meals())) === '["a","c"]', JSON.stringify(ids(api.meals())));
  }

  /* --- 3d: ארוחה מותאמת נמחקת מקומית בלבד, בלי שרת --- */
  {
    const { api, log } = makeRemover([{ custom: true, name: 'מותאמת' }], () => true);
    await api.myRemove('מותאמת');
    t('ארוחה מותאמת נמחקת בלי קריאה לשרת', api.meals().length === 0 && !log.some(s => s.startsWith('rpc:')));
    t('ארוחה מותאמת נשמרת דרך syncCustom', log.includes('syncCustom'));
  }

  /* --- 4: שם העסק בכותרות דפי הפרומו --- */
  for (const f of ['promo-trainers.html', 'promo-trainees.html']) {
    const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const title = (s.match(/<title>[^<]*<\/title>/) || [''])[0];
    t(f + ': הכותרת בשם BAUER POWER', /^<title>BAUER POWER — /.test(title), title);
    t(f + ': אין E.B FIT בכותרת', !/E\.B FIT/.test(title), title);
  }
  const pt = fs.readFileSync(path.join(ROOT, 'promo-trainers.html'), 'utf8');
  t('promo-trainers.html: תווית המסכה בשם BAUER POWER', /class="ph-top">BAUER POWER</.test(pt));

  console.log(pass + ' עברו, ' + fail + ' נכשלו');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  שגיאה בלתי צפויה: ' + (e && e.stack || e)); process.exit(1); });

/* בודק שטופס הצהרת הבריאות בצד המתאמן מרונדר בשלושת המצבים.
   הפונקציות נחלצות מ-t.html ומורצות עם תחליפים, כי אין כאן דפדפן. */
const fs = require('fs');

global.window = {};
eval(fs.readFileSync(__dirname + '/../health.js', 'utf8'));
const EBHealth = global.window.EBHealth;

const src = fs.readFileSync(__dirname + '/../t.html', 'utf8');
function grab(name) {
  const i = src.indexOf('  function ' + name + '(');
  if (i < 0) throw new Error('לא נמצאה הפונקציה ' + name);
  // סוגר על התאמת סוגריים מסולסלים
  let d = 0, started = false, j = i;
  for (; j < src.length; j++) {
    if (src[j] === '{') { d++; started = true; }
    else if (src[j] === '}') { d--; if (started && d === 0) { j++; break; } }
  }
  return src.slice(i, j);
}

const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

let pass = 0, fail = 0;
function t(name, got, want) {
  const ok = got === want;
  ok ? pass++ : fail++;
  if (!ok) console.log('FAIL  ' + name + '\n      got=' + JSON.stringify(got) + '  want=' + JSON.stringify(want));
}

function render(health, formOpen, data) {
  const ctx = {
    EBHealth, esc, TOKEN: 'tok',
    HEALTH: health, HFORM: formOpen, HOPEN: true, FOLDER: false, DATA: data || { name: 'ישראל ישראלי' },
    localStorage: { getItem: () => null, setItem: () => {} },
    document: { getElementById: () => null }
  };
  const body = `
    let HEALTH = __H, HFORM = __F;
    ${grab('hKey')}
    ${grab('hLoad')}
    ${grab('healthFiles')}
    ${grab('healthBlock')}
    ${grab('healthFolder')}
    ${grab('hBtn')}
    return ctx.FOLDER ? healthFolder() : healthBlock();
  `.replace('__H', 'ctx.HEALTH').replace('__F', 'ctx.HFORM');
  body2 = 'let HOPEN = ctx.HOPEN;' + body;
  const fn = new Function('ctx', 'EBHealth', 'esc', 'TOKEN', 'DATA', 'localStorage', 'document', body2);
  return fn(ctx, ctx.EBHealth, ctx.esc, ctx.TOKEN, ctx.DATA, ctx.localStorage, ctx.document);
}

console.log('=== מצב 1: טרם נחתמה ===');
const a = render(null, false);
t('מזמין למילוי',  /למילוי ההצהרה/.test(a), true);
t('לא מציג שאלות', /שאלה|רופא אמר לך/.test(a), false);

console.log('=== מצב 2: הטופס פתוח ===');
const b = render({ answers: {} }, true);
t('שבע שאלות',     (b.match(/border-top:1px solid var\(--line\)/g) || []).length >= 7, true);
t('כפתורי כן ולא', /EBT\.hPick/.test(b), true);
t('שדה חתימה',     /id="h_sign"/.test(b), true);
t('שדה הערות',     /id="h_notes"/.test(b), true);
t('כפתור שליחה',   /EBT\.hSave/.test(b), true);
t('הבהרה רפואית',  /אינה מחליפה בדיקה או ייעוץ רפואי/.test(b), true);
EBHealth.PARQ.forEach(function (q, i) {
  t('שאלה ' + (i + 1) + ' מופיעה', b.indexOf(esc(q.q)) > -1, true);
});

console.log('=== מצב 3: נחתמה ===');
const c = render({ signedAt: '2026-09-01', answers: { q1: 'no' } }, false);
t('מאשר שנשלח',  /ההצהרה נשלחה למאמן/.test(c), true);
t('מציע עדכון',   /hOpen/.test(c), true);
t('לא מציג טופס', /h_sign/.test(c), false);

console.log('=== תשובה נבחרת מסומנת ===');
const d = render({ answers: { q1: 'yes', q2: 'no' } }, true);
t('כן מסומן באדום',  /#D9605A/.test(d), true);
t('לא מסומן בזית',   /rgba\(143,168,79,\.18\)/.test(d), true);

console.log('\n' + (fail ? '### נכשלו: ' + fail : 'הכל עבר') + '  |  עברו: ' + pass);
process.exit(fail ? 1 : 0);

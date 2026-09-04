/* מריץ את כל הבדיקות. שימוש:  node tests/run.js  */
const { execFileSync } = require('child_process');
const fs = require('fs');
let bad = 0;
fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js')).forEach(f => {
  console.log('\n──────── ' + f + ' ────────');
  try { console.log(execFileSync(process.execPath, [__dirname + '/' + f], { encoding: 'utf8' })); }
  catch (e) { bad++; console.log(e.stdout || e.message); }
});
console.log(bad ? '\n### ' + bad + ' קבצי בדיקה נכשלו' : '\nכל הבדיקות עברו');
process.exit(bad ? 1 : 0);

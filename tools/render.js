/* =====================================================================
   ייצוא סרטון: מדף מתנגן לקובץ MP4
   ---------------------------------------------------------------------
   שימוש:
     node tools/render.js promo-demo
     node tools/render.js promo-demo --fps 60 --square --wide

   הצילום הוא פריים-פריים ולא הקלטת מסך, ולכן אין פריימים שנופלים,
   הרזולוציה קבועה ולא תלויה במסך, והתוצאה זהה בכל הרצה.

   השעון של הדף מזויף לפני הטעינה: performance.now, Date.now,
   requestAnimationFrame ו-setTimeout מוחלפים בשעון שהסקריפט מקדם
   ידנית. בלי זה הצילום היה תלוי במהירות המחשב, וסצנות היו נחתכות
   באמצע. עם זה כל פריים מצולם בדיוק ברגע שהוא אמור להופיע.
   ===================================================================== */
const { chromium } = require('playwright');
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'video');

/* ffmpeg הותקן דרך winget ואינו ב-PATH של כל מעטפת */
function ffmpegPath() {
  const probe = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
  if (!probe.error) return 'ffmpeg';
  const base = path.join(os.homedir(), 'AppData', 'Local', 'Microsoft', 'WinGet', 'Packages');
  const stack = [base];
  while (stack.length) {
    const dir = stack.pop();
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { continue; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) stack.push(full);
      else if (e.name === 'ffmpeg.exe') return full;
    }
  }
  throw new Error('ffmpeg לא נמצא. התקן עם: winget install Gyan.FFmpeg');
}

const args = process.argv.slice(2);
const name = (args[0] || 'promo-demo').replace(/\.html$/, '');
const flag = f => args.includes('--' + f);
const opt = (f, d) => { const i = args.indexOf('--' + f); return i > -1 ? +args[i + 1] : d; };

const FPS = opt('fps', 60);
const W = 1080, H = 1920;

(async () => {
  const src = path.join(ROOT, name + '.html');
  if (!fs.existsSync(src)) throw new Error('לא נמצא הקובץ ' + name + '.html');

  const FF = ffmpegPath();
  fs.mkdirSync(OUT, { recursive: true });
  const frames = fs.mkdtempSync(path.join(os.tmpdir(), 'ebfit-'));

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });

  /* שעון מזויף — מוזרק לפני כל סקריפט בדף */
  await page.addInitScript(() => {
    let now = 0;
    const raf = [], timers = [];
    window.__clock = {
      set: t => { now = t; },
      flush: () => {
        raf.splice(0).forEach(fn => { try { fn(now); } catch (e) {} });
        for (let i = timers.length - 1; i >= 0; i--) {
          if (timers[i] && timers[i].at <= now) {
            const fn = timers[i].fn; timers.splice(i, 1);
            try { fn(); } catch (e) {}
          }
        }
      }
    };
    performance.now = () => now;
    Date.now = () => now;
    window.requestAnimationFrame = fn => { raf.push(fn); return raf.length; };
    window.cancelAnimationFrame = () => {};
    window.setTimeout = (fn, ms) => { timers.push({ fn, at: now + (ms || 0) }); return timers.length; };
    window.clearTimeout = id => { if (timers[id - 1]) timers[id - 1] = null; };
    window.setInterval = (fn, ms) => {
      const step = { fn: null, at: now + (ms || 0) };
      step.fn = () => { try { fn(); } catch (e) {} step.at = now + (ms || 0); timers.push(step); };
      timers.push(step); return timers.length;
    };
    window.clearInterval = window.clearTimeout;
  });

  await page.goto('file:///' + src.replace(/\\/g, '/'));
  await page.waitForTimeout(1200);                 // גופנים
  await page.evaluate(() => document.getElementById('ctl')?.remove());

  /* משך הסרטון נקרא מהדף עצמו */
  const total = await page.evaluate(() =>
    [...document.querySelectorAll('[data-t]')].reduce((a, e) => a + (+e.dataset.t || 0), 0));
  if (!total) throw new Error('לא נמצאו סצנות עם data-t');

  const count = Math.round(total / 1000 * FPS);
  process.stdout.write('מצלם ' + count + ' פריימים (' + (total / 1000).toFixed(1) + ' שניות)\n');

  for (let f = 0; f < count; f++) {
    await page.evaluate(t => { window.__clock.set(t); window.__clock.flush(); }, Math.round(f / FPS * 1000));
    await page.screenshot({ path: path.join(frames, String(f).padStart(5, '0') + '.png') });
    if (f % Math.max(1, Math.round(count / 20)) === 0) {
      process.stdout.write('  ' + Math.round(f / count * 100) + '%\n');
    }
  }
  await browser.close();

  /* הרכבה. yuv420p ו-faststart נדרשים כדי שאינסטגרם וּוואטסאפ ינגנו. */
  const enc = (out, filter) => {
    const a = ['-y', '-framerate', String(FPS), '-i', path.join(frames, '%05d.png')];
    if (filter) a.push('-vf', filter);
    a.push('-c:v', 'libx264', '-preset', 'slow', '-crf', '18',
           '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out);
    execFileSync(FF, a, { stdio: ['ignore', 'ignore', 'ignore'] });
    return (fs.statSync(out).size / 1048576).toFixed(1);
  };

  const made = [];
  const v = path.join(OUT, name + '-9x16.mp4');
  made.push([v, enc(v)]);

  if (flag('square')) {                            // 1:1 לפיד
    const s = path.join(OUT, name + '-1x1.mp4');
    made.push([s, enc(s, 'crop=1080:1080:0:420')]);
  }
  if (flag('wide')) {                              // 16:9 עם רקע מטושטש
    const w = path.join(OUT, name + '-16x9.mp4');
    made.push([w, enc(w,
      'split[a][b];[a]scale=1920:1080,boxblur=40:2[bg];[b]scale=-1:1080[fg];[bg][fg]overlay=(W-w)/2:0')]);
  }
  if (flag('gif')) {                               // תצוגה מקדימה
    const g = path.join(OUT, name + '.gif');
    execFileSync(FF, ['-y', '-framerate', String(FPS), '-i', path.join(frames, '%05d.png'),
      '-vf', 'fps=15,scale=480:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse',
      g], { stdio: ['ignore', 'ignore', 'ignore'] });
    made.push([g, (fs.statSync(g).size / 1048576).toFixed(1)]);
  }

  fs.rmSync(frames, { recursive: true, force: true });
  process.stdout.write('\nנוצר:\n');
  made.forEach(([p, mb]) => process.stdout.write('  ' + path.basename(p) + '  ' + mb + ' MB\n'));
  process.stdout.write('בתיקייה: ' + OUT + '\n');
})().catch(e => { console.error('נכשל: ' + e.message); process.exit(1); });

/* =====================================================================
   סרטון מאמן לאפליקציה: חיתוך + כותרת + הדמיה + כיתוביות
   ---------------------------------------------------------------------
   שימוש (השרת המקומי על 8080 חייב לרוץ — הוא מגיש את tools/clip-render.html):
     node tools/make-clip.js tools/clips/clip-36.json

   שדות בקובץ: src, start, dur, exercise (שם מהספרייה — קובע את ההדמיה),
   title, sub, en, subEn, cues[], out, ואופציונלי flip (ההדמיה במראה, כדי
   שתזוז לאותו צד כמו אראל), panel ("x:y" — מיקום חלון ההדמיה כשהוא
   מסתיר את אראל), vf (פילטר ffmpeg לפני ההקטנה).

   לפני כל סרטון: לבדוק 2 פריימים לשנייה לאורך כל החלון שאין אף אדם
   אחר בפריים, גם ברקע (ראו CLIP_BLOCK ב-anim.js). אחרי ההכנה — "➕ הוספה
   לטיוטות" באפליקציה; שם הקובץ הוא המפתח ב-PUBLISH.

   עד נובמבר 2026 הסקריפט חי רק בתיקייה זמנית ונמחק, והיה צריך לבנות
   אותו מחדש מזיכרון של סשן אחר. לכן הוא כאן.
   ===================================================================== */
const path = require('path'), fs = require('fs'), { execFileSync } = require('child_process');
const proj = path.join(__dirname, '..'), cfg = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
cfg.work = cfg.work || path.join(require('os').tmpdir(), 'ebfit-clip-' + path.basename(cfg.out, '.mp4'));
const { chromium } = require(path.join(proj, 'node_modules', 'playwright'));
const FF = 'ffmpeg', FP = 'ffprobe';
const MUS_EN = { chest: 'Chest', back: 'Back', shoulders: 'Shoulders', biceps: 'Biceps', triceps: 'Triceps', quads: 'Quads', hams: 'Hamstrings', glutes: 'Glutes', calves: 'Calves', core: 'Core' };

(async () => {
  const work = cfg.work; fs.mkdirSync(path.join(work, 'anim'), { recursive: true });
  let b; try { b = await chromium.launch(); } catch (e) { b = await chromium.launch({ channel: 'chrome' }); }
  const p = await b.newPage({ viewport: { width: 1100, height: 1400 }, deviceScaleFactor: 1 });
  await p.goto('http://localhost:8080/tools/clip-render.html?' + Date.now());
  await p.evaluate(() => document.fonts.ready);
  const info = await p.evaluate((c) => {
    const k = EBAnim.muscles(c.exercise);
    document.getElementById('t1').textContent = c.title; document.getElementById('t2').textContent = c.sub;
    document.getElementById('t3').textContent = c.en; document.getElementById('t4').textContent = c.subEn;
    document.getElementById('mus').textContent = 'שרירים: ' + k.map(m => EBAnim.MUSCLES[m]).join(' · ');
    if (c.flip) document.getElementById('cv').style.transform = 'scaleX(-1)';
    return { k, cls: EBAnim.classify(c.exercise) };
  }, cfg);
  await p.evaluate((en) => { document.getElementById('musEn').textContent = 'Muscles: ' + en; }, info.k.map(m => MUS_EN[m]).join(' · '));
  await (await p.$('#title')).screenshot({ path: path.join(work, 'title.png'), omitBackground: true });
  for (let i = 0; i < cfg.cues.length; i++) {
    await p.evaluate(t => { document.getElementById('cue').textContent = t; }, cfg.cues[i]);
    await (await p.$('#cue')).screenshot({ path: path.join(work, 'cue' + i + '.png'), omitBackground: true });
  }
  await p.evaluate((ex) => { window.__s = EBAnim._build(EBAnim.classify(ex)); }, cfg.exercise);
  const panel = await p.$('#panel'), N = Math.round(cfg.dur * 30);
  for (let i = 0; i < N; i++) {
    await p.evaluate((i) => { const s = window.__s; EBAnim._draw(document.getElementById('cv'), s, ((i / 30) * 1000 / s.dur) % 1, true); }, i);
    await panel.screenshot({ path: path.join(work, 'anim', 'f_' + String(i).padStart(4, '0') + '.png'), omitBackground: true });
  }
  await b.close();

  /* orientation after rotation metadata */
  const pr = JSON.parse(execFileSync(FP, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:stream_side_data=rotation', '-of', 'json', cfg.src]).toString());
  const st = pr.streams[0], rot = Math.abs(((st.side_data_list || []).find(d => d.rotation != null) || {}).rotation || 0);
  let w = st.width, h = st.height; if (rot === 90 || rot === 270) { const t = w; w = h; h = t; }
  const portrait = h >= w, W = portrait ? 1080 : 1920, H = portrait ? 1920 : 1080;
  const inputs = ['-ss', String(cfg.start), '-t', String(cfg.dur), '-i', cfg.src, '-framerate', '30', '-i', path.join(work, 'anim', 'f_%04d.png'), '-i', path.join(work, 'title.png')];
  cfg.cues.forEach((c, i) => inputs.push('-i', path.join(work, 'cue' + i + '.png')));
  let f = `[0:v]${cfg.vf ? cfg.vf + ',' : ''}scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=0x221A12,fps=30,setsar=1[bg];`;
  f += portrait ? `[bg][1:v]overlay=${cfg.panel || '40:H-h-300'}[a];[a][2:v]overlay=W-w-40:70[s0];` : `[bg][1:v]overlay=40:H-h-40[a];[a][2:v]overlay=W-w-40:40[s0];`;
  const seg = cfg.dur / cfg.cues.length;
  cfg.cues.forEach((c, i) => {
    const pos = portrait ? '(W-w)/2:H-h-90' : 'W-w-40:H-h-40';
    f += `[s${i}][${i + 3}:v]overlay=${pos}:enable='between(t,${(i * seg).toFixed(2)},${((i + 1) * seg).toFixed(2)})'[s${i + 1}];`;
  });
  f = f.replace(/;$/, '');
  for (const crf of [23, 27, 31]) {
    execFileSync(FF, ['-v', 'error', '-y', ...inputs, '-filter_complex', f, '-map', `[s${cfg.cues.length}]`, '-map', '0:a:0?',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', String(crf), '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', '-t', String(cfg.dur), cfg.out]);
    const size = fs.statSync(cfg.out).size;
    console.log(path.basename(cfg.out), (portrait ? 'portrait' : 'landscape'), 'crf', crf, (size / 1048576).toFixed(1) + 'MB', 'pattern', info.cls.p);
    if (size < 9 * 1048576) break;
  }
})();

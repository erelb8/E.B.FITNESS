/* E.B FIT — Service Worker
   נותן לאפליקציה לעבוד לגמרי בלי אינטרנט אחרי הפתיחה הראשונה.
   כשמעדכנים את האפליקציה — מעלים את המספר ב-VERSION. */

const VERSION = 'ebfit-v143';
const SHELL   = VERSION + '-shell';
const FONTS   = VERSION + '-fonts';

const SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './t.html',
  './terms.html',
  './config.js?v=v129',
  './sync.js?v=v129',
  './business.js?v=v129',
  './health.js?v=v129',
  './privacy.js?v=v129',
  './backup.js?v=v129',
  './reorder.js?v=v129',
  './access.js?v=v129',
  './analysis.js?v=v129',
  './reports.js?v=v129',
  './business.js?v=v129',
  './intake.js?v=v129',
  './files.js?v=v129',
  './builder.js?v=v129',
  './import-program.js?v=v129',
  './tracking.js?v=v129',
  './metrics.js?v=v129',
  './targets.js?v=v129',
  './meals.js?v=v129',
  './meal-library.js?v=v129',
  './progress.js?v=v129',
  './habits.js?v=v129',
  './coach-bot.js?v=v129',
  './workout-log.js?v=v129',
  './library-ui.js?v=v129',
  './export-plan.js?v=v129',
  './cardio.js?v=v129',
  './cardio-ui.js?v=v129',
  './exercise-library.js?v=v129',
  './exercise-ui.js?v=v129',
  './vendor/supabase.js?v=v129',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-256.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/favicon-64.png',
  './icons/logo-96.png'
];

// ---------- התקנה: שמירת שלד האפליקציה ----------
self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(SHELL);
    // addAll נכשל כולו אם קובץ אחד חסר — לכן אחד־אחד
    await Promise.all(SHELL_FILES.map(u => c.add(u).catch(() => {})));
    await self.skipWaiting();
  })());
});

// ---------- הפעלה: ניקוי גרסאות ישנות ----------
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

// ---------- בקשות ----------
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // גופנים של גוגל — מהמטמון מיד, רענון ברקע
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(staleWhileRevalidate(req, FONTS));
    return;
  }

  /* ניווט (פתיחת הדף) — רשת קודם כדי לקבל עדכונים, מטמון כגיבוי.

     cache:'reload' ולא fetch רגיל: הדפים מוגשים עם max-age=600, ו-fetch
     רגיל מכבד את מטמון ה-HTTP — כלומר "רשת קודם" החזיר בפועל עותק מהדיסק
     עד עשר דקות, בלי לפנות לשרת בכלל. כך נוצר מצב שהטלפון כבר על הגרסה
     החדשה והדפדפן במחשב עדיין על הישנה.

     הנתיב נשמר תחת המפתח של עצמו ולא תמיד תחת index.html: ניווט ל-t.html
     דרס עד היום את גיבוי ה-offline של אפליקציית הניהול, כך שמאמן שפתח
     דף מתאמן פעם אחת קיבל אותו בלי רשת במקום את האפליקציה שלו. */
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const url  = new URL(req.url);
      const path = url.origin === self.location.origin
        ? './' + (url.pathname.split('/').pop() || '')
        : null;
      try {
        const fresh = await fetch(req, { cache: 'reload' });
        if (fresh && fresh.ok && path) {
          const c = await caches.open(SHELL);
          c.put(path === './' ? './index.html' : path, fresh.clone());
        }
        return fresh;
      } catch {
        return (path && await caches.match(path)) ||
               (await caches.match('./index.html')) ||
               (await caches.match('./')) ||
               new Response('אין חיבור והאפליקציה עוד לא נשמרה במכשיר.', {
                 status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' }
               });
      }
    })());
    return;
  }

  if (url.origin !== self.location.origin) return;

  /* תמונות ואייקונים כמעט לא משתנים — מהמטמון מיד, זה מהיר יותר. */
  if (/\.(png|jpg|jpeg|webp|svg|ico|woff2?)$/i.test(url.pathname)) {
    e.respondWith(staleWhileRevalidate(req, SHELL));
    return;
  }

  /* קוד — רשת קודם, מטמון רק כגיבוי.
     הגשה מהמטמון קודם גרמה לכך שעדכון לא הגיע למכשיר עד שנוקה המטמון
     ידנית: המשתמש קיבל קוד ישן גם כשהיה מחובר לרשת. עלות: מילישניות
     בודדות בטעינה. תמורה: מה שרואים הוא תמיד מה שפורסם. */
  e.respondWith((async () => {
    const c = await caches.open(SHELL);
    try {
      const fresh = await fetch(req);
      if (fresh && fresh.ok) c.put(req, fresh.clone());
      return fresh;
    } catch {
      return (await c.match(req)) || new Response('', { status: 504 });
    }
  })());
});

async function staleWhileRevalidate(req, cacheName) {
  const c = await caches.open(cacheName);
  const hit = await c.match(req);
  const net = fetch(req).then(res => {
    if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone());
    return res;
  }).catch(() => null);
  return hit || (await net) || new Response('', { status: 504 });
}

// מאפשר לדף לבקש הפעלת גרסה חדשה מיד
self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

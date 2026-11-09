/* E.B FIT — Service Worker
   נותן לאפליקציה לעבוד לגמרי בלי אינטרנט אחרי הפתיחה הראשונה.
   כשמעדכנים את האפליקציה — מעלים את המספר ב-VERSION. */

const VERSION = 'ebfit-v256';
const SHELL   = VERSION + '-shell';
const FONTS   = VERSION + '-fonts';

const SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './t.html',
  './terms.html',
  './vendor/supabase.js?v=v256',
  './config.js?v=v256',
  './health.js?v=v256',
  './privacy.js?v=v256',
  './backup.js?v=v256',
  './reorder.js?v=v256',
  './access.js?v=v256',
  './analysis.js?v=v256',
  './reports.js?v=v256',
  './business.js?v=v256',
  './intake.js?v=v256',
  './files.js?v=v256',
  './builder.js?v=v256',
  './import-program.js?v=v256',
  './tracking.js?v=v256',
  './metrics.js?v=v256',
  './targets.js?v=v256',
  './meal-library.js?v=v256',
  './meal-extra.js?v=v256',
  './progress-chart.js?v=v256',
  './notes.js?v=v256',
  './notes-ui.js?v=v256',
  './guides.js?v=v256',
  './library-ui.js?v=v256',
  './menu-auto.js?v=v256',
  './period-card.js?v=v256',
  './ui-fx.css?v=v256',
  './ui-fx.js?v=v256',
  './export-plan.js?v=v256',
  './cardio.js?v=v256',
  './cardio-ui.js?v=v256',
  './exercise-library.js?v=v256',
  './exercise-ui.js?v=v256',
  './video.js?v=v256',
  './anim.js?v=v256',
  './meals.js?v=v256',
  './sync.js?v=v256',
  './progress.js?v=v256',
  './habits.js?v=v256',
  './coach-bot.js?v=v256',
  './workout-log.js?v=v256',
  './icons/icon-180.png?v=v256',
  './icons/icon-192.png?v=v256',
  './icons/icon-256.png?v=v256',
  './icons/icon-512.png?v=v256',
  './icons/maskable-512.png?v=v256',
  './icons/favicon-64.png?v=v256',
  './icons/logo-96.png?v=v256'
];

// ---------- התקנה: שמירת שלד האפליקציה ----------
self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(SHELL);
    // addAll נכשל כולו אם קובץ אחד חסר — לכן אחד־אחד
    /* cache:'reload' — בלי זה c.add לוקח את הקובץ ממטמון ה-HTTP של
       הדפדפן, ובגרסה חדשה נשמר שוב האייקון הישן. כך קרה בהחלפת
       הלוגו ב-19.9.2026: המטמון החדש החזיק את התמונה הקודמת. */
    await Promise.all(SHELL_FILES.map(u =>
      fetch(u, { cache: 'reload' })
        .then(r => r.ok ? c.put(u, r) : null)
        .catch(() => {})));
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

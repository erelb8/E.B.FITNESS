/* E.B FIT — Service Worker
   נותן לאפליקציה לעבוד לגמרי בלי אינטרנט אחרי הפתיחה הראשונה.
   כשמעדכנים את האפליקציה — מעלים את המספר ב-VERSION. */

const VERSION = 'ebfit-v285';
const SHELL   = VERSION + '-shell';
const FONTS   = VERSION + '-fonts';

const SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './t.html',
  './terms.html',
  './vendor/supabase.js?v=v285',
  './config.js?v=v285',
  './health.js?v=v285',
  './privacy.js?v=v285',
  './backup.js?v=v285',
  './reorder.js?v=v285',
  './access.js?v=v285',
  './analysis.js?v=v285',
  './reports.js?v=v285',
  './business.js?v=v285',
  './team.js?v=v285',
  './intake.js?v=v285',
  './files.js?v=v285',
  './builder.js?v=v285',
  './import-program.js?v=v285',
  './tracking.js?v=v285',
  './metrics.js?v=v285',
  './targets.js?v=v285',
  './meal-library.js?v=v285',
  './meal-extra.js?v=v285',
  './progress-chart.js?v=v285',
  './notes.js?v=v285',
  './notes-ui.js?v=v285',
  './guides.js?v=v285',
  './library-ui.js?v=v285',
  './menu-auto.js?v=v285',
  './period-card.js?v=v285',
  './ui-fx.css?v=v285',
  './theme-light.css?v=v285',
  './theme.css?v=v285',
  './theme.js?v=v285',
  './ui-fx.js?v=v285',
  './export-plan.js?v=v285',
  './cardio.js?v=v285',
  './cardio-ui.js?v=v285',
  './exercise-library.js?v=v285',
  './exercise-ui.js?v=v285',
  './video.js?v=v285',
  './anim.js?v=v285',
  './meals.js?v=v285',
  './sync.js?v=v285',
  './progress.js?v=v285',
  './habits.js?v=v285',
  './coach-bot.js?v=v285',
  './workout-log.js?v=v285',
  './icons/icon-180.png?v=v285',
  './icons/icon-192.png?v=v285',
  './icons/icon-256.png?v=v285',
  './icons/icon-512.png?v=v285',
  './icons/maskable-512.png?v=v285',
  './icons/favicon-64.png?v=v285',
  './icons/logo-96.png?v=v285'
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
// ---------- תזכורות (נובמבר 2026) ----------
// ההתראה מגיעה מהשרת (supabase/functions/push-reminders). כאן רק מציגים
// אותה, ובנגיעה פותחים את דף המתאמן — חלון פתוח אם יש, אחרת חדש.
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (er) { d = {}; }
  e.waitUntil(self.registration.showNotification(d.title || 'BAUER POWER', {
    body: d.body || '', tag: d.tag || 'bp', renotify: true, dir: 'rtl', lang: 'he',
    icon: './icons/icon-192.png', badge: './icons/favicon-64.png',
    data: { url: d.url || 't.html', kind: d.kind || '' }
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || 't.html', self.registration.scope).href;
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const bare = u => u.split('#')[0].split('?')[0];
    const open = all.find(c => bare(c.url) === bare(url));
    /* דף פתוח: עוברים אליו ואומרים לו לאיזה מסך ללכת (אימון / שקילה / צ׳ק-אין) */
    if (open) {
      try { await open.focus(); } catch (er) {}
      try { open.postMessage({ go: (e.notification.data && e.notification.data.kind) || '' }); } catch (er) {}
      return;
    }
    await self.clients.openWindow(url);
  })());
});

self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

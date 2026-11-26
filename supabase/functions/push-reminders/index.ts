// BAUER POWER — sends the reminders that push_due() says are due.
// Called once an hour by the cron job in supabase/push-reminders.sql.
//
// This function holds no secret and uses no service_role key. The caller
// sends the cron key in the x-cron-key header; the function hands it to
// push_due(), which checks it inside the database and only then returns
// the list of phones and the VAPID keys. Without the right key the
// database returns nothing, so calling this URL from outside does nothing.
import webpush from "npm:web-push@3.6.7";

const URL_ = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

async function rpc(fn: string, args: Record<string, unknown>) {
  const r = await fetch(`${URL_}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!r.ok) throw new Error(`${fn} ${r.status}`);
  return await r.json();
}

Deno.serve(async (req: Request) => {
  const key = req.headers.get("x-cron-key") || "";
  if (key.length < 40) return new Response("forbidden", { status: 403 });
  try {
    let due = await rpc("push_due", { p_key: key });
    if (due && due.need_init) {
      // first run: the key pair is created here and stored in the database
      const k = webpush.generateVAPIDKeys();
      await rpc("push_init", { p_key: key, p_pub: k.publicKey, p_priv: k.privateKey });
      due = await rpc("push_due", { p_key: key });
    }
    const items = (due && due.items) || [];
    if (!items.length) return Response.json({ sent: 0, gone: 0 });
    webpush.setVapidDetails("https://erelb8.github.io/E.B.FITNESS/", due.public, due.private);
    let sent = 0;
    const gone: string[] = [];
    await Promise.all(items.map(async (it: any) => {
      try {
        await webpush.sendNotification(
          { endpoint: it.endpoint, keys: { p256dh: it.p256dh, auth: it.auth } },
          JSON.stringify(it.payload), { TTL: 6 * 3600, urgency: "normal" });
        sent++;
      } catch (e) {
        const code = (e as any)?.statusCode;
        if (code === 404 || code === 410) gone.push(it.id);
      }
    }));
    if (gone.length) await rpc("push_gone", { p_key: key, p_ids: gone });
    return Response.json({ sent, gone: gone.length });
  } catch (_e) {
    return new Response("error", { status: 500 });
  }
});

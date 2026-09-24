// Short-lived browser credentials for the Aussprache-Check. GET only, signed-in only.
//
// Provider-neutral: which service the credentials are for, and how they are made, is
// the adapter's business (src/lib/pronunciation/server.ts). This route only decides *who*
// gets them. The secret key never reaches the browser; the adapter trades it for a token
// that expires within minutes.
//
// Signed-in only because credentials are spendable: without the check this route would be
// a free, anonymous pronunciation API for anyone who finds it. The middleware has already
// revalidated the session with getUser() (see src/middleware.js), so locals.user is
// trustworthy here.
import type { APIRoute } from "astro";
import { pronunciationServer } from "../../lib/pronunciation/server";

export const prerender = false;

// Basic rate limiting: at most LIMIT credentials per user per WINDOW. The page needs one
// every few minutes, so 20 in 10 minutes only trips on a loop or a script. It is in
// memory, so on Vercel it is per instance — a speed bump against a runaway client, not a
// quota. A real quota would live in Supabase.
const LIMIT = 20;
const WINDOW_MS = 10 * 60_000;
const hits = new Map<string, number[]>();

function limited(id: string): boolean {
  const now = Date.now();
  const recent = (hits.get(id) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(id, recent);
  if (hits.size > 5000) {
    // Drop users with no recent hits so the map cannot grow without bound.
    for (const [k, v] of hits) if (!v.some((t) => now - t < WINDOW_MS)) hits.delete(k);
  }
  return recent.length > LIMIT;
}

const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...extra },
  });

export const GET: APIRoute = async ({ locals }) => {
  const user = (locals as { user?: { id: string } | null }).user;
  if (!user) return json({ error: "auth" }, 401);
  if (limited(user.id)) return json({ error: "rate" }, 429, { "Retry-After": "600" });

  const creds = await pronunciationServer.issueClientCredentials();
  if (!creds.ok) return creds.reason === "config" ? json({ error: "config" }, 503) : json({ error: "upstream" }, 502);
  return json({ ...creds.body, provider: pronunciationServer.id, expiresIn: creds.expiresIn });
};

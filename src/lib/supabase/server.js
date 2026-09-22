// The Supabase client for code running on the server — Astro middleware and the handful
// of `prerender = false` routes. It reads and writes the same cookie the browser client
// uses (see ./browser.js), so there is one session, not two.
//
// Nothing that is prerendered can use this. Astro middleware runs at *build* time for
// prerendered pages, not per request, so a static page has no server to call — it uses
// the browser client instead. Any route that calls this must carry
// `export const prerender = false`.
import { createServerClient, parseCookieHeader } from "@supabase/ssr";

// Same two public values as the browser client, and the same note about the name:
// the key is Supabase's newer publishable key (`sb_publishable_…`), and the variable is
// called `..._ANON_KEY` so it matches Supabase's own docs.
const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

/**
 * Create a Supabase client bound to one Astro request/response.
 *
 * Call this per request and never hoist the result to module scope: the client closes
 * over *this* request's cookies, and a shared instance would leak one visitor's session
 * into another's response.
 *
 * @param {Object} context - the Astro context (`Astro` in a page, or the middleware /
 *   endpoint context). Only `request` and `cookies` are used.
 * @param {Request} context.request - used to read the incoming Cookie header.
 * @param {import("astro").AstroCookies} context.cookies - used to write refreshed cookies.
 * @returns {import("@supabase/supabase-js").SupabaseClient} a request-scoped client
 */
export function createServerSupabase({ request, cookies }) {
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      // Read from the raw Cookie header rather than `cookies.get()`, because
      // @supabase/ssr needs *every* cookie at once — the session is split across
      // numbered chunks when it exceeds the 4KB cookie limit, and Astro's cookie API
      // has no enumeration method to find them with. parseCookieHeader can return a
      // value of `undefined` for a bare `name=` cookie, which the auth library does not
      // expect, so those are coerced to an empty string.
      getAll() {
        return parseCookieHeader(request.headers.get("Cookie") ?? "").map(
          ({ name, value }) => ({ name, value: value ?? "" }),
        );
      },
      // Astro turns each set() into a Set-Cookie header on the outgoing response. The
      // options come from @supabase/ssr (httpOnly, sameSite, secure, maxAge, path) and
      // are passed through untouched — overriding them here is how sessions silently
      // stop persisting.
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          cookies.set(name, value, options);
        }
      },
    },
  });
}

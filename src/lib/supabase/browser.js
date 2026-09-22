// The Supabase client for code running in the browser — islands, and any script on a
// prerendered page that needs to know who is signed in.
//
// This is `createBrowserClient` from @supabase/ssr, not `createClient` from
// @supabase/supabase-js, and the difference is the whole point: the @supabase/ssr client
// stores the session in a **cookie** rather than localStorage. That cookie is the one
// mechanism both sides read — the prerendered pages read it here in the browser, and the
// `prerender = false` routes read the same cookie on the server (see ./server.js). Using
// plain `createClient` anywhere that carries a session would give this site two session
// stores that drift apart.
//
// Astro middleware does not run per-request for prerendered pages, so on the ~670 static
// pages there is no server refreshing anything: this client refreshes its own session.
// That is expected and documented in the tier note, not a gap to paper over.
import { createBrowserClient } from "@supabase/ssr";

// PUBLIC_ so Astro inlines it into client bundles — both values are meant to be public.
//
// The key is Supabase's newer *publishable* key (`sb_publishable_…`), not the classic
// `anon` JWT. It is the drop-in successor and works unchanged with @supabase/ssr. The
// variable keeps the `..._ANON_KEY` name on purpose: every Supabase example, and every
// answer you will find while debugging this, calls it that. Do not swap in a legacy anon
// key to make the name literal.
const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

/**
 * Create a Supabase client for the browser.
 *
 * Cheap to call — the underlying library returns the same auth instance per set of
 * credentials, so callers do not need to cache it in a module-level singleton.
 *
 * @returns {import("@supabase/supabase-js").SupabaseClient} a cookie-backed client
 */
export function createBrowserSupabase() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

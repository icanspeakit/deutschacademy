// Where Google sends the learner back, and where the magic-link email lands.
//
// Both use Supabase's PKCE flow, so both arrive here with `?code=`. This route trades that
// code for a session, which @supabase/ssr writes into the cookie the rest of the site reads.
import type { APIRoute } from "astro";
import { createServerSupabase } from "../../lib/supabase/server.js";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const { searchParams, origin } = new URL(context.request.url);
  const code = searchParams.get("code");

  // Open-redirect guard. `next` comes back from the OAuth round trip untouched, so it is
  // attacker-controlled: anyone can send a learner to
  // /anmelden?next=https://evil.example and, without this check, have us bounce them
  // there *carrying a fresh session*. A single leading slash is a path on this site;
  // "//evil.example" is a protocol-relative URL that every browser reads as another
  // origin, which is why the second test is not redundant.
  const rawNext = searchParams.get("next") ?? "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  if (code) {
    const supabase = createServerSupabase(context);
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // A password-reset link signs the learner in exactly like any other, which is the
      // whole risk of it: land them on the homepage and they are logged in with a password
      // they could not remember five minutes ago and still cannot change. Recovery goes to
      // the one page that exists to set a new one.
      if (searchParams.get("type") === "recovery") {
        return context.redirect(`${origin}/passwort-neu`);
      }
      return context.redirect(`${origin}${next}`);
    }
  }

  // No code, or the exchange failed. Both are the same story to the learner: it did not
  // work, try again. The reason is deliberately not echoed into the URL — it would be
  // attacker-controlled text rendered on our own sign-in page.
  return context.redirect(`${origin}/anmelden?fehler=auth`);
};

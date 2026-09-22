// Refreshes the Supabase session and puts the signed-in user on `context.locals.user`.
//
// **This runs per request only for routes with `export const prerender = false`.** For the
// ~670 prerendered pages Astro runs middleware once, at build time, where there is no
// visitor and no cookie — so anything this file decides about "the current user" is
// meaningless there. That is not a limitation to configure around; it is what prerendering
// means. See docs/auth-sso-tier0-v1.md.
//
// The consequence, and the reason this file is short: the Next.js pattern of refreshing the
// session in middleware on every request covers the whole site there and covers three routes
// here. On every other page the browser client refreshes its own session from the same
// cookie (src/lib/supabase/browser.js). One cookie, two readers.
import { createServerSupabase } from "./lib/supabase/server.js";

export async function onRequest(context, next) {
  // Bail out for prerendered routes. This is not an optimisation — it is the difference
  // between a build that works and one that does not.
  //
  // Middleware still *runs* for a prerendered page, once, during the build. There is no
  // visitor there, so reading `request.headers` gets a warning from Astro and an empty
  // answer; worse, calling getUser() would fire one network request to Supabase per page,
  // 670 of them, to ask who is signed in during a build where nobody is.
  //
  // `context.isPrerendered` is the supported way to tell the two apart. Without this guard
  // the build logs `Astro.request.headers` warnings and takes a Supabase round trip for
  // every static page it writes.
  if (!context.isPrerendered) {
    const supabase = createServerSupabase(context);

    // getUser(), never getSession(). getSession() decodes the cookie and believes it;
    // getUser() revalidates it against Supabase. The cookie is attacker-controlled, so on
    // the server the difference is the whole security of the route.
    //
    // Errors are swallowed on purpose: a signed-out visitor, an expired session and an
    // unreachable Supabase all mean the same thing to a page — nobody is signed in. A
    // throw here would 500 the route instead.
    try {
      const { data } = await supabase.auth.getUser();
      context.locals.user = data?.user ?? null;
    } catch {
      context.locals.user = null;
    }

    context.locals.supabase = supabase;
  }

  return next();
}

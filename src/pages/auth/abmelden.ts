// Sign out. POST only.
//
// GET would make this a link, and a link that destroys state gets fired by anything that
// prefetches or crawls — a browser's link preview, an antivirus scanner, a chat client
// expanding a URL. Requiring POST also means a cross-site <img src="/auth/abmelden"> cannot
// silently sign a learner out.
import type { APIRoute } from "astro";
import { createServerSupabase } from "../../lib/supabase/server.js";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const supabase = createServerSupabase(context);

  // signOut() clears the auth cookie through the same setAll() the session was written
  // with. Its error is ignored on purpose: if the session was already gone, the learner
  // is signed out either way, which is the outcome they asked for.
  await supabase.auth.signOut();

  return context.redirect("/");
};

// Anything that is not a POST gets told so rather than 404-ing, which would read as "this
// route does not exist" while it plainly does.
export const ALL: APIRoute = () =>
  new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST" } });

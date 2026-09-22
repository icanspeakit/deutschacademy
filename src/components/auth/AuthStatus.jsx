// The account control in the nav: who is signed in, and the way out.
//
// This is an island on otherwise-static pages, so it cannot be told the answer at build
// time — it has to ask. `getUser()` revalidates against Supabase rather than trusting the
// cookie, and `onAuthStateChange` keeps it honest afterwards, so signing out in one tab
// updates the nav in the others without a reload.
//
// The pre-paint script in Layout.astro has already set `data-auth` on <html> from the mere
// presence of the auth cookie, which is what reserves the right shape before this mounts.
// That hint is a guess about layout; this component is the fact.
import { useEffect, useRef, useState } from "react";
import { createBrowserSupabase } from "../../lib/supabase/browser.js";
import { useT } from "./useT.js";

/**
 * @param {Object} props
 * @param {"nav"|"drawer"} [props.variant] - "nav" is the round avatar and its popup menu in
 *   the desktop cluster; "drawer" is a full-width row in the mobile panel, which is the one
 *   most learners here will actually see (the desktop cluster is display:none below 1080px).
 */
export default function AuthStatus({ variant = "nav" }) {
  const t = useT();
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    const supabase = createBrowserSupabase();
    let alive = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!alive) return;
      setUser(data?.user ?? null);
      setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive) return;
      setUser(session?.user ?? null);
      setReady(true);
    });

    return () => {
      alive = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  // Keep the pre-paint hint truthful once the real answer lands. Otherwise <html
  // data-auth="in"> would linger after a sign-out and reserve space for an avatar that is
  // no longer there.
  useEffect(() => {
    if (!ready) return;
    document.documentElement.dataset.auth = user ? "in" : "out";
  }, [ready, user]);

  // Close the menu on an outside click or Escape, matching how the rest of the nav behaves.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Where to come back to, so signing in from the middle of an exercise returns to that
  // exercise rather than to the homepage.
  //
  // Read in an effect, not during render, and that is not fussiness: this component is
  // prerendered into static HTML, where `window` does not exist and the href is a bare
  // /anmelden. Computing it during the first client render would produce a different href
  // than the HTML React is hydrating, which is a hydration mismatch — React discards the
  // markup and re-renders the subtree. Setting it afterwards makes the first render match
  // and the link correct one tick later, long before anyone can click it.
  const [nextParam, setNextParam] = useState("");
  useEffect(() => {
    if (window.location.pathname === "/anmelden") return;
    setNextParam(`?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
  }, []);

  // Before getUser() answers — including in the HTML Astro prerenders into all ~670 pages
  // at build time — this renders the signed-out control. Two reasons it guesses that way
  // rather than rendering a neutral placeholder:
  //
  //   1. With JavaScript off it is the only thing that ever renders, and "Anmelden"
  //      pointing at a working server route is a better no-JS fallback than a dead circle.
  //   2. It is right for most visitors most of the time.
  //
  // For the visitors it is wrong for, the pre-paint script in Layout.astro has already set
  // <html data-auth="in"> from the presence of the auth cookie, and auth.css hides this
  // guess under that attribute — the space stays reserved, nothing wrong is shown, and the
  // confirmed state replaces it a moment later. With JS off the attribute is never set, so
  // the fallback stays visible, which is the point.
  const signedOut = !user;
  const guessing = !ready;
  const avatarUrl = user?.user_metadata?.avatar_url ?? null;
  const label = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || "";

  // The monogram is the fallback everywhere: not every provider returns a photo, and a
  // broken <img> in the nav reads as a bug rather than as "no picture".
  const monogram = (label || "DA").trim().charAt(0).toUpperCase() || "DA";

  if (variant === "drawer") {
    // The drawer is the mobile path, and on this site that is the main path. It gets plain
    // rows rather than a popup: a menu inside a menu is a tap too many on a phone.
    if (signedOut) {
      return (
        <a
          className={`lp-drawer-row da-auth-drawer-row${guessing ? " da-auth-guess" : ""}`}
          href={`/anmelden${nextParam}`}
        >
          <span className="lp-drawer-ic" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <path d="m10 17 5-5-5-5" />
              <path d="M15 12H3" />
            </svg>
          </span>
          <span className="lp-drawer-txt">
            <b>{t("auth.nav.signIn", "Anmelden")}</b>
            <i>{t("auth.nav.signIn.sub", "Fortschritt auf allen Geräten")}</i>
          </span>
        </a>
      );
    }
    return (
      <div className="da-auth-drawer-me">
        <div className="da-auth-drawer-id">
          <Avatar url={avatarUrl} monogram={monogram} />
          <span className="lp-drawer-txt">
            <b>{label}</b>
            <i>{t("auth.nav.signedIn", "Angemeldet")}</i>
          </span>
        </div>
        <SignOutForm t={t} className="da-auth-drawer-out" />
      </div>
    );
  }

  if (signedOut) {
    // A word, not a monogram. The avatar circle is the right shape for "you" once there is
    // a you; before that it is a teal disc that says nothing — the same objection the repo
    // already recorded when the old monogram was pulled out of the nav, and it applies
    // twice as hard to a control whose whole job is to be findable by someone who has
    // never signed in. So signed-out is a labelled pill and signed-in is the avatar.
    return (
      <a
        className={`da-auth-signin${guessing ? " da-auth-guess" : ""}`}
        href={`/anmelden${nextParam}`}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
          <path d="m10 17 5-5-5-5" />
          <path d="M15 12H3" />
        </svg>
        <span>{t("auth.nav.signIn", "Anmelden")}</span>
      </a>
    );
  }

  return (
    <div className="lp-acct" ref={rootRef}>
      <button
        type="button"
        className="lp-acct-btn"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={t("nav.account", "Konto")}
        onClick={() => setOpen((v) => !v)}
      >
        <Avatar url={avatarUrl} monogram={monogram} />
      </button>

      {open && (
        <div className="lp-acct-menu" role="menu" aria-label={t("nav.account", "Konto")}>
          <div className="da-auth-menu-id">
            <b>{label}</b>
            {user?.email && label !== user.email && <i>{user.email}</i>}
          </div>
          <div className="lp-acct-sep" />
          <SignOutForm t={t} />
        </div>
      )}
    </div>
  );
}

function Avatar({ url, monogram }) {
  const [broken, setBroken] = useState(false);
  if (url && !broken) {
    return (
      <img
        className="da-auth-avatar"
        src={url}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <span className="lp-acct-mono" aria-hidden="true">
      {monogram}
    </span>
  );
}

// A form, not a link: /auth/abmelden is POST-only, so that a prefetch, a crawler or a
// cross-site <img> cannot sign anyone out. See src/pages/auth/abmelden.ts.
function SignOutForm({ t, className = "" }) {
  return (
    <form method="POST" action="/auth/abmelden" className={`da-auth-signout ${className}`.trim()}>
      <button type="submit" className="da-auth-signout-btn" role="menuitem">
        {t("auth.nav.signOut", "Abmelden")}
      </button>
    </form>
  );
}

// Google sign-in through Google Identity Services (GIS), ID-token flow.
//
// Replaces `signInWithOAuth({ provider: "google" })`. That was a redirect through
// `<ref>.supabase.co/auth/v1/callback`, and Google names the redirect host on its consent
// screen — so learners were asked to "continue to putrkafrcpqosqxrgttp.supabase.co", which
// reads as phishing. Here the browser never leaves /anmelden: Google's button opens its own
// account picker, hands back a signed ID token (a JWT), and Supabase verifies that token's
// signature server-side in `signInWithIdToken`. Same security, no foreign hostname.
// See docs/auth-gis-v1.md.
//
// **The button is Google's, not ours.** This flow only permits Google's rendered button
// (`renderButton`) or One Tap. A custom-styled button that clicks Google's hidden one
// underneath is exactly what the GIS terms forbid, so it is not done here. What we still
// control: locale, theme, size, shape, text variant and width. What we lost is listed in the
// tier doc.
//
// **One Tap is deliberately off.** `prompt()` is never called. One Tap goes through FedCM and
// third-party-cookie behaviour that differs per browser; that is its own job.
//
// **Loaded here and nowhere else.** The GIS script is injected when this component mounts,
// and this component is only rendered by SignInCard, which only /anmelden renders. Never add
// the script to Layout.astro or to anything the nav renders — the nav is on ~670 pages.
import { useEffect, useRef, useState } from "react";
import { createBrowserSupabase } from "../../lib/supabase/browser.js";
import { getLang, onLangChange } from "../../lib/i18n.js";

const GIS_SRC = "https://accounts.google.com/gsi/client";
// Public by design: the client ID is sent to every browser that renders the button. It is
// the same OAuth client Supabase's Google provider is configured with, so the token's `aud`
// matches what Supabase checks.
const CLIENT_ID = import.meta.env.PUBLIC_GOOGLE_CLIENT_ID;

// Google's button accepts a width between 200 and 400 px, nothing wider.
const MIN_W = 200;
const MAX_W = 400;

/**
 * Inject the GIS script once and resolve when `window.google.accounts.id` exists.
 * @returns {{ promise: Promise<void>, script: HTMLScriptElement | null }}
 */
function loadGis() {
  if (window.google?.accounts?.id) return { promise: Promise.resolve(), script: null };
  let script = document.querySelector(`script[src="${GIS_SRC}"]`);
  const owned = !script;
  if (!script) {
    script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }
  const promise = new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error("gis-load")), { once: true });
  });
  return { promise, script: owned ? script : null };
}

/**
 * A fresh nonce pair.
 *
 * - `raw`    → goes to **Supabase** (`signInWithIdToken({ nonce: raw })`).
 * - `hashed` → goes to **Google** (`initialize({ nonce: hashed })`), hex SHA-256 of `raw`.
 *
 * Google copies what it is given into the token's `nonce` claim; Supabase hashes the raw
 * value it receives and compares. Swap them and sign-in fails with a nonce-mismatch error
 * that does not say which side is wrong.
 */
async function makeNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const raw = btoa(String.fromCharCode(...bytes));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  const hashed = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  return { raw, hashed };
}

// Same guard as src/pages/auth/callback.ts: one leading slash is a path on this site;
// "//evil.example" is a protocol-relative URL to another origin and also starts with "/".
function safeNext(next) {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

function currentTheme() {
  return document.documentElement.dataset.theme === "dark" ? "filled_black" : "outline";
}

/**
 * @param {Object} props
 * @param {string} [props.next] - where to go after signing in. Re-validated here.
 * @param {boolean} [props.signup] - show Google's "Sign up with" wording instead of "Sign in with".
 * @param {(msg: string | null) => void} props.onError - hands an error to the card's alert.
 * @param {(key: string, fallback: string) => string} props.t - the card's translate function.
 */
export default function GoogleSignInButton({ next, signup = false, onError, t }) {
  const slotRef = useRef(null);
  const nonceRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  // Bumped to re-render Google's button when the language or theme changes.
  const [lang, setLang] = useState(() => getLang());
  const [theme, setTheme] = useState(null);

  // Kept in refs so the GIS callback — registered once in initialize() — always sees the
  // current values rather than the ones from the first render.
  const nextRef = useRef(next);
  const onErrorRef = useRef(onError);
  const tRef = useRef(t);
  nextRef.current = next;
  onErrorRef.current = onError;
  tRef.current = t;

  const fail = () =>
    onErrorRef.current?.(
      tRef.current("auth.error.google", "Anmeldung mit Google nicht möglich. Bitte versuche es noch einmal."),
    );

  // A token's nonce can be used once. Every initialize() gets a fresh pair, and a failed
  // attempt re-initializes so the next click does not reuse a spent nonce.
  async function initialize() {
    const pair = await makeNonce();
    nonceRef.current = pair;
    window.google.accounts.id.initialize({
      client_id: CLIENT_ID,
      nonce: pair.hashed, // hashed → Google
      callback: handleCredential,
      auto_select: false,
      cancel_on_tap_outside: true,
    });
  }

  async function handleCredential(response) {
    onErrorRef.current?.(null);
    setPending(true);
    const supabase = createBrowserSupabase();
    const { error } = await supabase.auth.signInWithIdToken({
      provider: "google",
      token: response.credential,
      nonce: nonceRef.current?.raw, // raw → Supabase
    });
    if (error) {
      console.error("[auth] signInWithIdToken:", error.message);
      setPending(false);
      fail();
      try {
        await initialize();
      } catch {}
      return;
    }
    // Spinner left on: the page is navigating away, and clearing it would flash the idle
    // button for the frame before it does.
    window.location.href = safeNext(nextRef.current);
  }

  // Load the script, initialize once. Cleanup cancels GIS and removes the script tag this
  // component added, so leaving the island leaves nothing of Google's behind in the DOM.
  useEffect(() => {
    if (!CLIENT_ID) {
      console.error("[auth] PUBLIC_GOOGLE_CLIENT_ID is not set");
      fail();
      return;
    }
    let alive = true;
    const { promise, script } = loadGis();
    promise
      .then(() => (alive ? initialize() : null))
      .then(() => {
        if (alive) {
          setTheme(currentTheme());
          setReady(true);
        }
      })
      .catch((e) => {
        console.error("[auth] Google Identity Services:", e?.message ?? e);
        if (alive) fail();
      });

    const offLang = onLangChange((code) => setLang(code));
    // The theme toggle writes <html data-theme>; Google's button has a dark variant, so
    // follow it rather than leaving a white button on a dark card.
    const mo = new MutationObserver(() => setTheme(currentTheme()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    return () => {
      alive = false;
      offLang();
      mo.disconnect();
      try {
        window.google?.accounts?.id?.cancel();
      } catch {}
      script?.remove();
    };
  }, []);

  // (Re)draw Google's button. renderButton replaces the slot's contents each time.
  useEffect(() => {
    const slot = slotRef.current;
    if (!ready || !slot || !window.google?.accounts?.id) return;
    const width = Math.max(MIN_W, Math.min(MAX_W, Math.floor(slot.clientWidth || MAX_W)));
    slot.replaceChildren();
    window.google.accounts.id.renderButton(slot, {
      type: "standard",
      theme: theme ?? "outline",
      size: "large",
      shape: "pill",
      text: signup ? "signup_with" : "signin_with",
      logo_alignment: "center",
      width,
      locale: lang,
    });
  }, [ready, lang, theme, signup]);

  return (
    <div className="da-auth-gis" aria-busy={pending || !ready}>
      <div ref={slotRef} className="da-auth-gis-slot" hidden={pending} />
      {!ready && !pending && <div className="da-auth-gis-placeholder" aria-hidden="true" />}
      {pending && (
        <div className="da-auth-gis-pending" role="status">
          <span className="da-auth-spinner da-auth-spinner--dark" aria-hidden="true" />
          <span>{t("auth.password.loading", "Einen Moment …")}</span>
        </div>
      )}
    </div>
  );
}

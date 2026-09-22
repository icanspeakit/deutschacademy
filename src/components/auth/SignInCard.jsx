// The sign-in card: Google, email + password, and a magic link.
//
// Logic ported from Colevitate's src/components/auth/SignInCard.tsx — the four auth calls,
// the mode switching, the "check your email" states, the callback URL with its `next` param.
// None of the chrome came with it: that version is shadcn/ui + lucide-react + Tailwind, and
// this project has none of those and is not getting them. Everything visual here is plain
// CSS in src/styles/auth.css built from the tokens in global.css.
//
// **Three ways in, and each earns its place.**
//   - *Google* is one tap and no password to forget.
//   - *Password* is what most people expect an account to mean, and it is the only method
//     that works on the first try when the email is slow or filtered.
//   - *Magic link* covers everyone else. A Google-only wall excludes a real slice of this
//     audience: GMX, Web.de and Hotmail addresses are ordinary in Germany, particularly
//     among older learners and on shared family devices where no Google account is signed
//     in.
// Apple and Facebook were considered and rejected: Apple charges $99/year for a Services ID
// and is only mandatory for App Store apps (there is no iOS app), and Meta requires business
// verification and app review. Revisit Apple if an iOS app ever ships.
//
// **Everything except Google needs working email.** Signup sends a confirmation, reset sends
// a link, magic link is a link. Supabase's built-in mailer is rate-limited and not for
// production — see docs/auth-sso-tier1-v1.md.
import { useState } from "react";
import { createBrowserSupabase } from "../../lib/supabase/browser.js";
import { useT } from "./useT.js";

// Inlined rather than imported: adding lucide-react or any icon package to pull one mark
// into one island is 40KB+ of dependency for four <path> elements, on a site whose content
// pages ship no framework at all.
function GoogleMark() {
  return (
    <svg className="da-auth-gmark" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.87c2.27-2.09 3.58-5.17 3.58-8.82Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.87-3c-1.08.72-2.46 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.11A11.998 11.998 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28V6.61H1.27A11.998 11.998 0 0 0 0 12c0 1.94.46 3.77 1.27 5.39l4-3.11Z" />
      <path fill="#EA4335" d="M12 4.76c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.69 1.27 6.61l4 3.11C6.22 6.87 8.87 4.76 12 4.76Z" />
    </svg>
  );
}

function MailMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m2 7 10 6 10-6" />
    </svg>
  );
}

/**
 * @param {Object} props
 * @param {string} [props.next] - where to land after signing in. Already validated
 *   server-side by anmelden.astro; the callback route validates it again on the way back,
 *   because that round trip goes through Google and comes back attacker-shaped.
 * @param {boolean} [props.initialError] - true when the callback bounced here with
 *   ?fehler=auth, so the card can say what happened instead of looking untouched.
 */
export default function SignInCard({ next, initialError = false }) {
  const t = useT();

  // "passwort" first: it is what most people mean by an account, and putting the method
  // that needs no inbox in front means a learner whose confirmation mail is slow still has
  // a way in.
  const [mode, setMode] = useState("passwort");
  const [action, setAction] = useState("anmelden");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Three different "check your email" endings, kept apart because they say different
  // things: a link to sign in, a link to confirm a new account, a link to reset a password.
  // Collapsing them into one flag is how people end up told to confirm an account they
  // already have.
  const [linkSent, setLinkSent] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const [googleLoading, setGoogleLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [error, setError] = useState(
    initialError ? t("auth.error.callback", "Die Anmeldung wurde abgebrochen. Bitte versuche es noch einmal.") : null,
  );

  // Built at call time, not at module scope: this component is prerendered into HTML at
  // build time, where `window` does not exist.
  const callbackUrl = () =>
    `${window.location.origin}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ""}`;

  function switchMode(m) {
    setMode(m);
    setError(null);
  }

  async function signInWithGoogle() {
    setError(null);
    setGoogleLoading(true);
    const supabase = createBrowserSupabase();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl() },
    });
    // On success the browser is already navigating to Google, so the spinner is left
    // running on purpose — clearing it would flash the idle button during the redirect.
    if (error) {
      setError(t("auth.error.google", "Anmeldung mit Google nicht möglich. Bitte versuche es noch einmal."));
      setGoogleLoading(false);
    }
  }

  async function submitPassword(e) {
    e.preventDefault();
    setError(null);
    setEmailLoading(true);
    const supabase = createBrowserSupabase();

    if (action === "anmelden") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setEmailLoading(false);
      if (error) {
        // Deliberately one message for both "no such account" and "wrong password".
        // Distinguishing them turns this form into a way to find out which addresses have
        // accounts here.
        setError(t("auth.error.credentials", "E-Mail oder Passwort stimmt nicht."));
        return;
      }
      window.location.href = next || "/";
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: callbackUrl() },
    });
    setEmailLoading(false);
    if (error) {
      setError(t("auth.error.signup", "Konto konnte nicht erstellt werden. Vielleicht gibt es schon eins mit dieser Adresse."));
      return;
    }
    // With email confirmation on, signUp returns no session and the learner has to open the
    // link first. If confirmation is ever switched off in Supabase, a session comes back
    // here and they are simply signed in — both paths are handled rather than assuming one.
    if (data.session) {
      window.location.href = next || "/";
      return;
    }
    setConfirmSent(true);
  }

  async function sendMagicLink(e) {
    e.preventDefault();
    setError(null);
    setEmailLoading(true);
    const supabase = createBrowserSupabase();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callbackUrl() },
    });
    setEmailLoading(false);
    if (error) {
      setError(t("auth.error.email", "E-Mail konnte nicht gesendet werden. Stimmt die Adresse?"));
      return;
    }
    setLinkSent(true);
  }

  async function sendReset() {
    if (!email) {
      setError(t("auth.error.needEmail", "Trag zuerst deine E-Mail-Adresse oben ein."));
      return;
    }
    setError(null);
    setResetLoading(true);
    const supabase = createBrowserSupabase();
    // Lands on /auth/callback with type=recovery, which forwards to /passwort-neu.
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
    });
    setResetLoading(false);
    if (error) {
      setError(t("auth.error.email", "E-Mail konnte nicht gesendet werden. Stimmt die Adresse?"));
      return;
    }
    setResetSent(true);
  }

  // ---- the three endings ----------------------------------------------------

  if (linkSent || confirmSent || resetSent) {
    const copy = linkSent
      ? {
          title: t("auth.sent.title", "Schau in dein Postfach"),
          lead: t("auth.sent.lead", "Wir haben einen Link geschickt an"),
          hint: t("auth.sent.hint", "Öffne ihn auf diesem Gerät, dann bist du angemeldet."),
        }
      : confirmSent
        ? {
            title: t("auth.confirm.title", "Bestätige deine E-Mail"),
            lead: t("auth.confirm.lead", "Wir haben einen Bestätigungslink geschickt an"),
            hint: t("auth.confirm.hint", "Öffne ihn, dann ist dein Konto fertig."),
          }
        : {
            title: t("auth.reset.title", "Schau in dein Postfach"),
            lead: t("auth.reset.lead", "Wir haben einen Link zum Zurücksetzen geschickt an"),
            hint: t("auth.reset.hint", "Öffne ihn, dann kannst du ein neues Passwort setzen."),
          };

    return (
      <div className="da-auth-card da-auth-card--sent">
        <div className="da-auth-sent-mark" aria-hidden="true">
          <MailMark />
        </div>
        <h1 className="da-auth-title">{copy.title}</h1>
        <p className="da-auth-lead">
          {copy.lead} <b>{email}</b>. {copy.hint}
        </p>
        <p className="da-auth-fineprint">
          {t("auth.sent.spam", "Nichts angekommen? Sieh im Spam-Ordner nach — oder versuche es noch einmal.")}
        </p>
        <button
          type="button"
          className="da-auth-btn da-auth-btn--ghost"
          onClick={() => {
            setLinkSent(false);
            setConfirmSent(false);
            setResetSent(false);
          }}
        >
          {t("auth.sent.back", "Zurück")}
        </button>
      </div>
    );
  }

  // ---- the card -------------------------------------------------------------

  // Signup is a state of the *password* form only — a magic link neither creates nor does
  // not create an account, it just sends a link. So switching to the link tab while the
  // password form happened to be in signup mode must not leave the card titled "Konto
  // erstellen" above a form that does nothing of the kind.
  const signup = mode === "passwort" && action === "registrieren";

  return (
    <div className="da-auth-card">
      <h1 className="da-auth-title">
        {signup ? t("auth.title.signup", "Konto erstellen") : t("auth.title", "Anmelden")}
      </h1>
      <p className="da-auth-lead">
        {t("auth.lead", "Melde dich an, damit dein Fortschritt auf allen deinen Geräten erhalten bleibt.")}
      </p>

      {error && (
        // role="alert" so a screen reader hears it without having to find it: the message
        // appears above the control the learner was just using, not below it.
        <p className="da-auth-error" role="alert">
          {error}
        </p>
      )}

      <button
        type="button"
        className="da-auth-btn da-auth-btn--google"
        onClick={signInWithGoogle}
        disabled={googleLoading}
      >
        <GoogleMark />
        <span>
          {googleLoading
            ? t("auth.google.loading", "Weiterleitung zu Google …")
            : t("auth.google", "Mit Google anmelden")}
        </span>
      </button>

      <div className="da-auth-or">
        <span>{t("auth.or", "oder")}</span>
      </div>

      {/* Tabs, not a second form stacked below: two email forms visible at once is two
          submit buttons a learner has to choose between before knowing what either does. */}
      <div className="da-auth-tabs" role="tablist" aria-label={t("auth.tabs.label", "Anmeldeart")}>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "passwort"}
          className={`da-auth-tab${mode === "passwort" ? " is-on" : ""}`}
          onClick={() => switchMode("passwort")}
        >
          {t("auth.tab.password", "Passwort")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "link"}
          className={`da-auth-tab${mode === "link" ? " is-on" : ""}`}
          onClick={() => switchMode("link")}
        >
          {t("auth.tab.link", "Magic-Link")}
        </button>
      </div>

      {mode === "passwort" ? (
        <form className="da-auth-form" onSubmit={submitPassword}>
          <label className="da-auth-label" htmlFor="da-auth-email">
            {t("auth.email.label", "E-Mail-Adresse")}
          </label>
          <input
            id="da-auth-email"
            className="da-auth-input"
            type="email"
            required
            autoComplete="email"
            // inputMode + autoCapitalize because ~90% of this audience is on a phone, where
            // the default keyboard capitalises the first letter of an email address.
            inputMode="email"
            autoCapitalize="none"
            spellCheck="false"
            placeholder="name@beispiel.de"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <label className="da-auth-label" htmlFor="da-auth-password">
            {t("auth.password.label", "Passwort")}
          </label>
          <input
            id="da-auth-password"
            className="da-auth-input"
            type="password"
            required
            // 8, above Supabase's default of 6. The extra two characters cost a learner
            // nothing and this is the whole account.
            minLength={8}
            // The right value matters: "current-password" stops a password manager
            // offering to save a new entry on every sign-in, and "new-password" is what
            // makes it offer to generate one.
            autoComplete={signup ? "new-password" : "current-password"}
            placeholder={signup ? t("auth.password.placeholder", "Mindestens 8 Zeichen") : ""}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button type="submit" className="da-auth-btn da-auth-btn--primary" disabled={emailLoading || !email || !password}>
            {emailLoading
              ? t("auth.password.loading", "Einen Moment …")
              : signup
                ? t("auth.password.signup", "Konto erstellen")
                : t("auth.password.signin", "Anmelden")}
          </button>

          <div className="da-auth-switchrow">
            <button
              type="button"
              className="da-auth-linkbtn"
              onClick={() => {
                setAction(signup ? "anmelden" : "registrieren");
                setError(null);
              }}
            >
              {signup
                ? t("auth.switch.toSignin", "Schon ein Konto? Anmelden")
                : t("auth.switch.toSignup", "Noch kein Konto? Registrieren")}
            </button>
            {!signup && (
              <button type="button" className="da-auth-linkbtn" onClick={sendReset} disabled={resetLoading}>
                {resetLoading ? t("auth.reset.loading", "…") : t("auth.reset.ask", "Passwort vergessen?")}
              </button>
            )}
          </div>
        </form>
      ) : (
        <form className="da-auth-form" onSubmit={sendMagicLink}>
          <label className="da-auth-label" htmlFor="da-auth-email-link">
            {t("auth.email.label", "E-Mail-Adresse")}
          </label>
          <input
            id="da-auth-email-link"
            className="da-auth-input"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            spellCheck="false"
            placeholder="name@beispiel.de"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button type="submit" className="da-auth-btn da-auth-btn--primary" disabled={emailLoading || !email}>
            {emailLoading ? t("auth.email.loading", "Wird gesendet …") : t("auth.email.submit", "Link per E-Mail")}
          </button>
          <p className="da-auth-fineprint">
            {t("auth.email.hint", "Kein Passwort nötig — du bekommst einen Link zum Anmelden.")}
          </p>
        </form>
      )}

      <p className="da-auth-legal">
        {t("auth.legal.pre", "Mit der Anmeldung stimmst du den")}{" "}
        <a href="/nutzungsbedingungen">{t("auth.legal.terms", "Nutzungsbedingungen")}</a>{" "}
        {t("auth.legal.mid", "zu und bestätigst die")}{" "}
        <a href="/datenschutz">{t("auth.legal.privacy", "Datenschutzerklärung")}</a>
        {t("auth.legal.post", " gelesen zu haben.")}
      </p>
    </div>
  );
}

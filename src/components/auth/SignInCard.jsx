// The sign-in card: Google, email + password, and a magic link.
//
// Google no longer goes through signInWithOAuth's redirect — it is the GIS ID-token flow in
// GoogleSignInButton.jsx, so the consent screen never names the Supabase host. Magic link,
// password and reset are unchanged and still return through /auth/callback.
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
import GoogleSignInButton from "./GoogleSignInButton.jsx";

// Inlined rather than imported: adding lucide-react or any icon package to pull one mark
// into one island is 40KB+ of dependency for a few <path> elements, on a site whose content
// pages ship no framework at all.

function MailMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m2 7 10 6 10-6" />
    </svg>
  );
}

// The two onboarding questions shown after email + password in signup mode. Stored in the
// account's user_metadata (and mirrored to localStorage for the static pages), and both are
// optional. Icons are inline line marks (no emoji: the flag renders as "DE" letters on
// Windows). Level uses the CEFR names the rest of the site already uses; "unsicher" points
// at /einstufungstest rather than making the learner guess.
const LEVELS = [
  { id: "A1", hint: "Anfänger" },
  { id: "A2", hint: "Grundlagen" },
  { id: "B1", hint: "Mittelstufe" },
  { id: "B2", hint: "Gut" },
  { id: "C1", hint: "Sehr gut" },
  { id: "unsicher", hint: "Test machen" },
];

const GOALS = [
  { id: "pruefung", label: "Prüfung (DTZ, telc, Goethe)", icon: <><rect x="6" y="4" width="12" height="17" rx="2" /><path d="M9 3h6v3H9z" /><path d="m9 14 2 2 4-4" /></> },
  { id: "beruf", label: "Arbeit & Beruf", icon: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M3 13h18" /></> },
  { id: "alltag", label: "Alltag in Deutschland", icon: <><path d="M3 11 12 4l9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></> },
  { id: "einbuergerung", label: "Einbürgerung", icon: <><path d="M3 21h18" /><path d="M5 21V11M9.5 21V11M14.5 21V11M19 21V11" /><path d="M2 10 12 4l10 6z" /></> },
  { id: "studium", label: "Studium & Ausbildung", icon: <><path d="M2 9 12 4l10 5-10 5z" /><path d="M6 11v5c3 2 9 2 12 0v-5" /></> },
];

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
  // Signup is two steps: email + password, then level + goal. Sign-in stays one.
  const [step, setStep] = useState(1);
  const [level, setLevel] = useState("");
  const [goal, setGoal] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Three different "check your email" endings, kept apart because they say different
  // things: a link to sign in, a link to confirm a new account, a link to reset a password.
  // Collapsing them into one flag is how people end up told to confirm an account they
  // already have.
  const [linkSent, setLinkSent] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);
  const [resetSent, setResetSent] = useState(false);

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
    setStep(1);
    setError(null);
  }

  async function submitPassword(e) {
    e.preventDefault();
    setError(null);

    // Step 1 of signup only collects; the browser has already enforced required + minLength.
    // Nothing is created until step 2, so "Zurück" never leaves a half-made account behind.
    if (action === "registrieren" && step === 1) {
      setStep(2);
      return;
    }

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

    // Mirrored locally so the static pages can use it before any account round trip.
    try {
      if (level) localStorage.setItem("da_level", level);
      if (goal) localStorage.setItem("da_goal", goal);
    } catch {}

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: callbackUrl(),
        data: { level: level || null, goal: goal || null },
      },
    });
    setEmailLoading(false);
    if (error) {
      // Back to step 1: the likely fix (a different address) is on that screen, not this one.
      setStep(1);
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
        {/* The envelope pops in and a check draws itself on its corner: the one moment in
            this flow where something actually *happened*, so it is the one that gets a
            flourish. Both are CSS-only and switched off under reduced motion. */}
        <div className="da-auth-sent-mark" aria-hidden="true">
          <MailMark />
          <span className="da-auth-sent-check">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 12.5 4 4 8-9" />
            </svg>
          </span>
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
            setStep(1);
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
  const onboarding = signup && step === 2;

  // Keyed on what the learner is looking at, so a change of view remounts the block and
  // replays its enter animation instead of snapping.
  const viewKey = `${mode}-${action}-${step}`;

  return (
    <div className={`da-auth-card${onboarding ? " da-auth-card--onboard" : ""}`}>
      {signup && (
        <div className="da-auth-steps" aria-label={t("auth.steps.label", "Fortschritt")}>
          <span className="da-auth-steps-txt">
            {t("auth.steps.of", "Schritt {n} von 2").replace("{n}", String(step))}
          </span>
          <span className="da-auth-steps-bar" aria-hidden="true">
            <span style={{ transform: `scaleX(${step / 2})` }} />
          </span>
        </div>
      )}

      <div className="da-auth-anim" key={`head-${viewKey}`}>
        <h1 className="da-auth-title">
          {onboarding
            ? t("auth.onboard.title", "Erzähl uns kurz von dir")
            : signup
              ? t("auth.title.signup", "Konto erstellen")
              : t("auth.title", "Anmelden")}
        </h1>
        <p className="da-auth-lead">
          {onboarding
            ? t("auth.onboard.lead", "Damit wir dir die passenden Übungen zeigen. Du kannst das später jederzeit ändern.")
            : signup
              ? t("auth.lead.signup", "Kostenlos. Dein Fortschritt bleibt auf allen deinen Geräten erhalten.")
              : t("auth.lead", "Melde dich an, damit dein Fortschritt auf allen deinen Geräten erhalten bleibt.")}
        </p>
      </div>

      {error && (
        // role="alert" so a screen reader hears it without having to find it: the message
        // appears above the control the learner was just using, not below it.
        <p className="da-auth-error" role="alert">
          {error}
        </p>
      )}

      {onboarding ? (
        <form className="da-auth-form da-auth-anim" key={`body-${viewKey}`} onSubmit={submitPassword}>
          <fieldset className="da-auth-choices">
            <legend className="da-auth-label">{t("auth.onboard.level", "Wie gut ist dein Deutsch?")}</legend>
            <div className="da-auth-chips da-auth-chips--level">
              {LEVELS.map((l) => (
                <label key={l.id} className={`da-auth-chip${level === l.id ? " is-on" : ""}`}>
                  <input type="radio" name="da-level" value={l.id} checked={level === l.id} onChange={() => setLevel(l.id)} />
                  <b>{l.id === "unsicher" ? t("auth.level.unsure", "Weiß nicht") : l.id}</b>
                  <i>{t(`auth.level.${l.id}`, l.hint)}</i>
                </label>
              ))}
            </div>
            {level === "unsicher" && (
              <p className="da-auth-fineprint da-auth-anim">
                {t("auth.level.unsureHint", "Kein Problem — nach der Anmeldung findest du es im")}{" "}
                <a href="/einstufungstest">{t("auth.level.test", "Einstufungstest")}</a>{" "}
                {t("auth.level.unsureHint2", "in 5 Minuten heraus.")}
              </p>
            )}
          </fieldset>

          <fieldset className="da-auth-choices">
            <legend className="da-auth-label">{t("auth.onboard.goal", "Wofür lernst du?")}</legend>
            <div className="da-auth-chips">
              {GOALS.map((g) => (
                <label key={g.id} className={`da-auth-chip da-auth-chip--row${goal === g.id ? " is-on" : ""}`}>
                  <input type="radio" name="da-goal" value={g.id} checked={goal === g.id} onChange={() => setGoal(g.id)} />
                  <svg className="da-auth-chip-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{g.icon}</svg>
                  <b>{t(`auth.goal.${g.id}`, g.label)}</b>
                </label>
              ))}
            </div>
          </fieldset>

          <button type="submit" className="da-auth-btn da-auth-btn--primary" disabled={emailLoading}>
            {emailLoading && <span className="da-auth-spinner" aria-hidden="true" />}
            {emailLoading
              ? t("auth.password.loading", "Einen Moment …")
              : t("auth.password.signup", "Konto erstellen")}
          </button>

          <div className="da-auth-switchrow">
            <button type="button" className="da-auth-linkbtn" onClick={() => { setStep(1); setError(null); }}>
              {t("auth.onboard.back", "← Zurück")}
            </button>
            {/* Optional on purpose: a question that blocks account creation is a question
                some learners answer with the back button. */}
            {!level && !goal && (
              <span className="da-auth-fineprint">{t("auth.onboard.optional", "Optional — du kannst auch überspringen.")}</span>
            )}
          </div>
        </form>
      ) : (
        <>
          {/* Google's own rendered button (ID-token flow) — see GoogleSignInButton.jsx for
              why it cannot be restyled to match the other buttons. */}
          <GoogleSignInButton next={next} signup={signup} onError={setError} t={t} />

          <div className="da-auth-or">
            <span>{t("auth.or", "oder")}</span>
          </div>

          {/* Tabs, not a second form stacked below: two email forms visible at once is two
              submit buttons a learner has to choose between before knowing what either does.
              The white pill is one element that slides between the two (data-on drives it),
              not a background that blinks from one button to the other. */}
          <div className="da-auth-tabs" role="tablist" data-on={mode} aria-label={t("auth.tabs.label", "Anmeldeart")}>
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
            <form className="da-auth-form da-auth-anim" key={`body-${viewKey}`} onSubmit={submitPassword}>
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
                {emailLoading && <span className="da-auth-spinner" aria-hidden="true" />}
                {emailLoading
                  ? t("auth.password.loading", "Einen Moment …")
                  : signup
                    ? t("auth.password.next", "Weiter")
                    : t("auth.password.signin", "Anmelden")}
              </button>

              <div className="da-auth-switchrow">
                <button
                  type="button"
                  className="da-auth-linkbtn"
                  onClick={() => {
                    setAction(signup ? "anmelden" : "registrieren");
                    setStep(1);
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
            <form className="da-auth-form da-auth-anim" key={`body-${viewKey}`} onSubmit={sendMagicLink}>
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
                {emailLoading && <span className="da-auth-spinner" aria-hidden="true" />}
                {emailLoading ? t("auth.email.loading", "Wird gesendet …") : t("auth.email.submit", "Link per E-Mail")}
              </button>
              <p className="da-auth-fineprint">
                {t("auth.email.hint", "Kein Passwort nötig — du bekommst einen Link zum Anmelden.")}
              </p>
            </form>
          )}
        </>
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

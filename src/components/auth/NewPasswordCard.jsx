// Set a new password. Reached only from a reset link, via /auth/callback?type=recovery.
//
// By the time this renders the learner is already signed in — the reset link exchanged its
// code for a real session. That is what makes `updateUser` work without asking for the old
// password, and it is also why /passwort-neu redirects anyone who arrives without a session:
// there is nothing to update.
import { useState } from "react";
import { createBrowserSupabase } from "../../lib/supabase/browser.js";
import { useT } from "./useT.js";

export default function NewPasswordCard() {
  const t = useT();
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const tooShort = password.length > 0 && password.length < 8;
  const mismatch = again.length > 0 && password !== again;

  async function submit(e) {
    e.preventDefault();
    if (password !== again) {
      setError(t("auth.new.mismatch", "Die beiden Passwörter sind nicht gleich."));
      return;
    }
    setError(null);
    setLoading(true);
    const supabase = createBrowserSupabase();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      // The common real cause is an expired link: Supabase recovery tokens are short-lived,
      // and a learner who opens the mail the next morning lands here with no session left.
      setError(t("auth.new.failed", "Das hat nicht geklappt. Der Link ist vielleicht abgelaufen — fordere einen neuen an."));
      return;
    }
    // Full navigation rather than a client-side state change: the session cookie changed,
    // and every island on the next page should read the new one.
    window.location.href = "/";
  }

  return (
    <div className="da-auth-card">
      <h1 className="da-auth-title">{t("auth.new.title", "Neues Passwort")}</h1>
      <p className="da-auth-lead">
        {t("auth.new.lead", "Wähle ein neues Passwort. Danach bist du direkt angemeldet.")}
      </p>

      {error && (
        <p className="da-auth-error" role="alert">
          {error}
        </p>
      )}

      <form className="da-auth-form" onSubmit={submit}>
        <label className="da-auth-label" htmlFor="da-new-password">
          {t("auth.new.label", "Neues Passwort")}
        </label>
        <input
          id="da-new-password"
          className="da-auth-input"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder={t("auth.password.placeholder", "Mindestens 8 Zeichen")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {tooShort && (
          <p className="da-auth-fineprint">{t("auth.new.short", "Mindestens 8 Zeichen.")}</p>
        )}

        <label className="da-auth-label" htmlFor="da-new-password-2">
          {t("auth.new.again", "Noch einmal")}
        </label>
        <input
          id="da-new-password-2"
          className="da-auth-input"
          type="password"
          required
          autoComplete="new-password"
          value={again}
          onChange={(e) => setAgain(e.target.value)}
        />
        {mismatch && (
          <p className="da-auth-fineprint">{t("auth.new.mismatch", "Die beiden Passwörter sind nicht gleich.")}</p>
        )}

        <button
          type="submit"
          className="da-auth-btn da-auth-btn--primary"
          disabled={loading || password.length < 8 || password !== again}
        >
          {loading ? t("auth.new.loading", "Wird gespeichert …") : t("auth.new.submit", "Passwort speichern")}
        </button>
      </form>
    </div>
  );
}

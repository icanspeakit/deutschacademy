// Translation for the React islands.
//
// The rest of the site translates by attribute: `initI18n()` sweeps the DOM once for
// [data-i18n] and rewrites the text in place. That cannot work for a React island — the
// island mounts *after* that sweep has run (client:load / client:idle), and even if it were
// mounted in time, the next render would put the German back, because React owns those text
// nodes and does not know a script edited them.
//
// So islands read the dictionary instead of being written into. Same JSON files, same
// merge-over-German fallback, same `da_lang` key — just pulled rather than pushed.
import { useEffect, useState } from "react";
import { getLang, loadDict, onLangChange, translate } from "../../lib/i18n.js";

/**
 * @returns {(key: string, fallback: string) => string} a translate function that renders
 *   the German fallback until the dictionary arrives, and re-renders when it does or when
 *   the learner switches language.
 */
export function useT() {
  const [dict, setDict] = useState(null);

  useEffect(() => {
    let alive = true;
    loadDict(getLang()).then((d) => {
      if (alive) setDict(d);
    });
    // LanguageSwitcher calls setLang(), which notifies these listeners with the new
    // dictionary. Without this the island would keep the language it mounted with while
    // the rest of the page changed around it.
    const off = onLangChange((_code, d) => {
      if (alive) setDict(d);
    });
    return () => {
      alive = false;
      off();
    };
  }, []);

  // The fallback is the German string written at the call site, so the first paint is
  // correct German rather than a flash of raw key names — `translate()` returns the key
  // itself when it misses, which would put "auth.signIn.google" on screen.
  return (key, fallback) => (dict && dict[key] != null ? translate(dict, key) : fallback);
}

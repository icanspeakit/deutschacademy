// One dictionary for everything an exam sitting paints from JS: the shell in examApp.js,
// the question cards in renderHelpers.js and the page's own sections. A page awaits
// readyExamI18n() once before it mounts; after that tx() is synchronous, and a language
// switch swaps the dictionary before examApp repaints (listeners run in the order they
// were added, and this one is added first).
//
// Only the chrome goes through here. Questions, options, transcripts and the German task
// rubric of a simulated exam paper stay German — they are what is being practised.
import { getLang, loadDict, onLangChange, translate } from "../i18n.js";

let dict = null;
let ready = null;

export function readyExamI18n() {
  if (!ready) {
    ready = loadDict(getLang()).then((d) => {
      dict = d;
      onLangChange((_code, d2) => { dict = d2; });
      return d;
    });
  }
  return ready;
}

const fill = (s, vars) => (vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : s);

/** Translate `key`; before the dictionary is loaded, or for a missing key, fall back to
    the German `fallback` (with the same {vars}) so nothing ever shows a raw key. */
export function tx(key, fallback, vars) {
  if (dict && dict[key] != null) return translate(dict, key, vars);
  return fill(fallback ?? key, vars);
}

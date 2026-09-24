// UI strings the quiz scripts write themselves (countdowns, ranks, error states). Static
// markup uses data-i18n like every page; this is for text built at runtime, which
// applyToDom() cannot reach. Each call carries its German text, so a key the dictionary
// does not have yet still shows German rather than the bare key.
import { getLang, loadDict, onLangChange } from "../i18n.js";

let dict = {};

export async function loadText(onChange) {
  dict = await loadDict(getLang()).catch(() => ({}));
  onLangChange((_code, d) => {
    dict = d;
    onChange?.();
  });
}

export function t(key, de, vars) {
  const str = dict[key] ?? de;
  return vars ? str.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : str;
}


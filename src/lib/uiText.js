/* UI text for markup that script renders — the counterpart of data-i18n for strings that
 * never sat in the server HTML. `t(key, de, vars)` answers from the loaded dictionary and
 * falls back to the German given inline, so a widget reads the same before and after the
 * dictionary arrives. Markup that should follow a later language switch by itself carries
 * `data-i18n` as well (see `i18nAttrs`): i18n.js repaints those in place.
 *
 * `onUiText(fn)` runs `fn` once the dictionary is in and again on every language change —
 * for text that has to be rebuilt rather than repainted. */
import { getLang, loadDict, onLangChange } from "./i18n.js";

let dict = null;
const subs = new Set();
const fire = () => subs.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });

if (typeof window !== "undefined") {
  loadDict(getLang()).then((d) => { dict = d; fire(); });
  onLangChange((_code, d) => { dict = d; fire(); });
}

function fill(str, vars) {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

export function t(key, de, vars) {
  const s = dict?.[key];
  return fill(s ?? de ?? key, vars);
}

const escAttr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** ` data-i18n="key" data-i18n-vars='…'` for a rendered element, so a switch repaints it. */
export function i18nAttrs(key, vars) {
  return ` data-i18n="${key}"${vars ? ` data-i18n-vars="${escAttr(JSON.stringify(vars))}"` : ""}`;
}

export function onUiText(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}

/** A German instruction with its translations, as UiText.astro renders it (ui-text.css
 *  picks the visible one from <html lang>). `tr` is `{ en, ar, uk, tr }` or null. */
export function uitHtml(de, tr, esc = (s) => String(s)) {
  const langs = tr ? ["en", "ar", "uk", "tr"].filter((l) => tr[l]) : [];
  if (!langs.length) return esc(de);
  return `<span class="uit"><span class="uit-de" lang="de">${esc(de)}</span>${langs
    .map((l) => `<span class="uit-l" lang="${l}" dir="${l === "ar" ? "rtl" : "ltr"}">${esc(tr[l])}</span>`)
    .join("")}</span>`;
}

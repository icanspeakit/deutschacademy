export const LANGUAGES = [
  { code: "de", label: "Deutsch", flag: "🇩🇪", dir: "ltr" },
  { code: "en", label: "English", flag: "🇬🇧", dir: "ltr" },
  { code: "ar", label: "العربية", flag: "🇸🇦", dir: "rtl" },
  { code: "tr", label: "Türkçe", flag: "🇹🇷", dir: "ltr" },
  { code: "uk", label: "Українська", flag: "🇺🇦", dir: "ltr" },
];

const STORAGE_KEY = "da_lang";
// The German file is the source of truth: every key exists there, and the server-rendered
// HTML is German. The other files are translations and lag behind it. See mergedDict().
const BASE_LANG = "de";
const dictCache = {};
const mergedCache = {};
const listeners = new Set();

export function getLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && LANGUAGES.some((l) => l.code === saved)) return saved;
  } catch {}
  return "de";
}

async function loadDict(code) {
  if (dictCache[code]) return dictCache[code];
  try {
    const res = await fetch(`/i18n/${code}.json`);
    dictCache[code] = await res.json();
  } catch {
    dictCache[code] = {};
  }
  return dictCache[code];
}

function interpolate(str, vars) {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (m, key) => (key in vars ? String(vars[key]) : m));
}

export function translate(dict, key, vars) {
  const str = dict[key];
  if (str == null) return key;
  return interpolate(str, vars);
}

function applyToDom(dict) {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    const vars = el.dataset.i18nVars ? JSON.parse(el.dataset.i18nVars) : undefined;
    const val = translate(dict, key, vars);
    if (dict[key] != null) el.textContent = val;
  });
  // Same as [data-i18n], but sets innerHTML instead of textContent — for the rare string that
  // must keep an embedded tag (e.g. a link) in place across languages. Dict values here are
  // authored by us, never user input, so trusting them as HTML is safe.
  document.querySelectorAll("[data-i18n-html]").forEach((el) => {
    const key = el.getAttribute("data-i18n-html");
    const vars = el.dataset.i18nVars ? JSON.parse(el.dataset.i18nVars) : undefined;
    if (dict[key] != null) el.innerHTML = translate(dict, key, vars);
  });
  document.querySelectorAll("[data-i18n-attr]").forEach((el) => {
    el.getAttribute("data-i18n-attr").split(";").forEach((pair) => {
      const [attr, key] = pair.split(":").map((s) => s.trim());
      if (!attr || !key || dict[key] == null) return;
      el.setAttribute(attr, translate(dict, key));
    });
  });
}

// A translation file that is missing a key used to mean "leave the element alone", which
// only looks right on a first paint, when the element still holds its German server text.
// After one switch it is stale: de -> en -> ar left every ar-untranslated string sitting in
// English. Layering the target language over the German base makes the fallback German
// wherever it is, no matter what was painted before.
async function mergedDict(code) {
  if (mergedCache[code]) return mergedCache[code];
  if (code === BASE_LANG) {
    mergedCache[code] = await loadDict(BASE_LANG);
    return mergedCache[code];
  }
  const [base, own] = await Promise.all([loadDict(BASE_LANG), loadDict(code)]);
  mergedCache[code] = { ...base, ...own };
  return mergedCache[code];
}

export async function applyLang(code) {
  const lang = LANGUAGES.find((l) => l.code === code) || LANGUAGES[0];
  document.documentElement.lang = lang.code;
  document.documentElement.dir = lang.dir;
  const dict = await mergedDict(lang.code);
  applyToDom(dict);
  listeners.forEach((fn) => fn(lang.code, dict));
  return dict;
}

export function setLang(code) {
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {}
  return applyLang(code);
}

export { mergedDict as loadDict };

export function onLangChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function initI18n() {
  return applyLang(getLang());
}

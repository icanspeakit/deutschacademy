/* Help in the learner's own language: a grammar rule or an explanation under the German
 * (mountGrammarHelp), a translation beside a Lesetext (mountTextTranslation), and a word
 * list (mountVocabList).
 *
 * ONE control decides the language, and it is the language menu in the site header. There
 * used to be a second one — a row of English / العربية / Українська / Türkçe chips and an
 * "in meiner Sprache" switch on every block — which meant a learner could have the site in
 * Arabic and the rule in English. The header choice is now all-encompassing:
 *   UI in en / ar / uk / tr  →  every help text shows, in that language, at every level;
 *   UI in German             →  German only; nothing is translated.
 * It follows the menu live, on every page, without a reload.
 */
import { getLang, onLangChange } from "./i18n.js";

export const HELP_LANGS = [
  { code: "en", label: "English", dir: "ltr" },
  { code: "ar", label: "العربية", dir: "rtl" },
  { code: "uk", label: "Українська", dir: "ltr" },
  { code: "tr", label: "Türkçe", dir: "ltr" },
];
const SHOW_KEY = "da-text-translation";

const isHelpLang = (c) => HELP_LANGS.some((l) => l.code === c);
const dirOf = (c) => HELP_LANGS.find((l) => l.code === c)?.dir ?? "ltr";

/** The language help is shown in: the header's, or null when that is German. */
export function helpLang(code = getLang()) {
  return isHelpLang(code) ? code : null;
}

/** Runs `fn(helpLang)` now and on every change of the header language. */
function followUi(fn) {
  fn(helpLang());
  onLangChange((code) => fn(helpLang(code)));
}

/** `**Heading**` → <b>, the same convention the German text uses. */
function fillRich(el, str) {
  el.textContent = "";
  (str ?? "").split(/\*\*(.+?)\*\*/g).forEach((part, i) => {
    if (!part) return;
    if (i % 2) { const b = document.createElement("b"); b.textContent = part; el.append(b); }
    else el.append(part);
  });
}

/**
 * The side-by-side text. `root` holds the German paragraphs, each with an empty
 * `.tt-tr[data-i]` cell beside it; `paragraphs` is `{ en: [...], ar: [...], … }`, aligned
 * to the German one-to-one.
 */
export function mountTextTranslation(root, paragraphs) {
  const toggle = root.querySelector("[data-tt-toggle]");
  const bar = root.querySelector(".tt-bar");
  const cells = [...root.querySelectorAll(".tt-tr")];

  function paint(lang) {
    // German UI: no translation, and no button offering one — the text reads as one column.
    if (bar) bar.hidden = !lang;
    if (!lang) root.dataset.translation = "off";
    else setShown(shown, false);
    root.dataset.ttLang = lang ?? "";
    const list = (lang && paragraphs[lang]) || [];
    cells.forEach((cell) => {
      fillRich(cell, list[Number(cell.dataset.i)] ?? "");
      cell.lang = lang ?? "";
      cell.dir = dirOf(lang);
    });
  }

  // Reading the German is the exercise here, so the translation beside it stays something
  // you open — the header says which language, this button only says whether.
  let shown = false;
  try { shown = localStorage.getItem(SHOW_KEY) === "1"; } catch {}
  function setShown(on, persist = true) {
    root.dataset.translation = on ? "on" : "off";
    toggle.setAttribute("aria-pressed", String(on));
    if (persist) { shown = on; try { localStorage.setItem(SHOW_KEY, on ? "1" : "0"); } catch {} }
  }
  toggle.addEventListener("click", () => setShown(root.dataset.translation !== "on"));
  followUi(paint);
}

/**
 * The word list. Rows are server-rendered with the German; the translation cells are filled
 * here. "Abdecken" hides the translations so the list can be used to test yourself — a row
 * opens on a tap, and the whole list comes back with the same button.
 */
export function mountVocabList(root, vocab) {
  const cells = [...root.querySelectorAll(".vl-tr")];
  const cover = root.querySelector("[data-vl-cover]");

  // A gloss has to be in some language: with a German UI the list falls back to English
  // rather than showing German words next to nothing.
  followUi((lang) => {
    const code = lang ?? "en";
    cells.forEach((cell) => {
      cell.textContent = vocab[Number(cell.dataset.i)]?.[code] ?? "";
      cell.lang = code;
      cell.dir = dirOf(code);
    });
  });

  cover.addEventListener("click", () => {
    const on = root.dataset.cover !== "on";
    root.dataset.cover = on ? "on" : "off";
    cover.setAttribute("aria-pressed", String(on));
    cover.textContent = on ? "Alle aufdecken" : "Abdecken & üben";
    root.querySelectorAll(".vl-row").forEach((r) => r.classList.remove("is-open"));
  });
  root.querySelectorAll(".vl-row").forEach((row) => {
    const flip = () => { if (root.dataset.cover === "on") row.classList.toggle("is-open"); };
    row.addEventListener("click", flip);
    row.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); flip(); }
    });
  });

}

/**
 * A rule or explanation in the learner's language, under each German block. Every language
 * is server-rendered (GrammarHelpText.astro, .gx-tr); this only sets two attributes on
 * `root` and CSS shows the block that matches. `bar` (one or several) carries just the
 * "machine draft" note and hides along with the translations.
 */
export function mountGrammarHelp(root, bar) {
  const bars = (bar instanceof Element ? [bar] : [...(bar ?? [])]).filter(Boolean);
  followUi((lang) => {
    root.dataset.gx = lang ? "on" : "off";
    if (lang) root.dataset.gxLang = lang;
    bars.forEach((b) => { b.hidden = !lang; });
  });
}

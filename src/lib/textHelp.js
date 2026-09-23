/* Help for a German text in the learner's own language: a translation beside the text, and
 * a word list under it. Both live on the Lesen and Schreiben pages.
 *
 * The site's UI language (i18n.js) only swaps the chrome — buttons, headings. The content
 * stays German on purpose, and so does this: the translation is something you switch on,
 * per text, and the German is always the thing on the left.
 *
 * One language for both helpers. A learner who reads the text in Ukrainian and then opens
 * the word list wants Ukrainian there too, so the choice is shared (localStorage + an event)
 * rather than held by each widget. It starts from the UI language when that is one we
 * translate into, and from English otherwise — German UI is the default, and German is no
 * help here.
 */
import { getLang } from "./i18n.js";

export const HELP_LANGS = [
  { code: "en", label: "English", dir: "ltr" },
  { code: "ar", label: "العربية", dir: "rtl" },
  { code: "uk", label: "Українська", dir: "ltr" },
  { code: "tr", label: "Türkçe", dir: "ltr" },
];
const LANG_KEY = "da-text-help-lang";
const SHOW_KEY = "da-text-translation";
const EVENT = "da-text-help-lang";

const isHelpLang = (c) => HELP_LANGS.some((l) => l.code === c);
const dirOf = (c) => HELP_LANGS.find((l) => l.code === c)?.dir ?? "ltr";

function readLang() {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (isHelpLang(saved)) return saved;
  } catch {}
  const ui = getLang();
  return isHelpLang(ui) ? ui : "en";
}

function writeLang(code) {
  try { localStorage.setItem(LANG_KEY, code); } catch {}
  window.dispatchEvent(new CustomEvent(EVENT, { detail: code }));
}

/** The chip row both widgets carry. Marks the current one and reports clicks. */
function wireChips(root, current) {
  const chips = [...root.querySelectorAll("[data-help-lang]")];
  const paint = (code) => chips.forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.helpLang === code)));
  chips.forEach((c) => c.addEventListener("click", () => writeLang(c.dataset.helpLang)));
  paint(current);
  return paint;
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
  const cells = [...root.querySelectorAll(".tt-tr")];
  let lang = readLang();

  function paint() {
    const list = paragraphs[lang] ?? [];
    cells.forEach((cell) => {
      fillRich(cell, list[Number(cell.dataset.i)] ?? "");
      cell.lang = lang;
      cell.dir = dirOf(lang);
    });
    paintChips(lang);
  }

  function setShown(on, persist = true) {
    root.dataset.translation = on ? "on" : "off";
    toggle.setAttribute("aria-pressed", String(on));
    if (persist) { try { localStorage.setItem(SHOW_KEY, on ? "1" : "0"); } catch {} }
  }

  const paintChips = wireChips(root, lang);
  toggle.addEventListener("click", () => setShown(root.dataset.translation !== "on"));
  // Picking a language is asking to see it.
  root.querySelectorAll("[data-help-lang]").forEach((c) => c.addEventListener("click", () => setShown(true)));
  window.addEventListener(EVENT, (e) => { lang = e.detail; paint(); });

  let shown = false;
  try { shown = localStorage.getItem(SHOW_KEY) === "1"; } catch {}
  paint();
  setShown(shown, false);
}

/**
 * The word list. Rows are server-rendered with the German; the translation cells are filled
 * here. "Abdecken" hides the translations so the list can be used to test yourself — a row
 * opens on a tap, and the whole list comes back with the same button.
 */
export function mountVocabList(root, vocab) {
  const cells = [...root.querySelectorAll(".vl-tr")];
  const cover = root.querySelector("[data-vl-cover]");
  let lang = readLang();

  function paint() {
    cells.forEach((cell) => {
      cell.textContent = vocab[Number(cell.dataset.i)]?.[lang] ?? "";
      cell.lang = lang;
      cell.dir = dirOf(lang);
    });
    paintChips(lang);
  }

  const paintChips = wireChips(root, lang);
  window.addEventListener(EVENT, (e) => { lang = e.detail; paint(); });

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

  paint();
}

/**
 * The grammar topics' rule, explained in the learner's language. Unlike a Lesetext, where
 * reading the German IS the exercise, a rule is scaffolding: an A1 learner cannot learn the
 * accusative from a German explanation of the accusative. So this starts ON at A1–A2 and
 * OFF at B1–B2 — by then the explanation in German is itself good reading — and an explicit
 * choice either way is remembered across topics.
 *
 * Every language is server-rendered (GrammarHelp.astro, .gx-tr); this only sets two
 * attributes on `root`, and CSS shows the one block that matches.
 */
const GX_SHOW_KEY = "da-grammar-help";
export function mountGrammarHelp(root, bar, { level }) {
  const toggle = bar.querySelector("[data-gx-toggle]");
  let lang = readLang();

  function setShown(on, persist = true) {
    root.dataset.gx = on ? "on" : "off";
    toggle.setAttribute("aria-pressed", String(on));
    if (persist) { try { localStorage.setItem(GX_SHOW_KEY, on ? "1" : "0"); } catch {} }
  }
  function setLang(code) {
    lang = code;
    root.dataset.gxLang = code;
    paintChips(code);
  }

  const paintChips = wireChips(bar, lang);
  toggle.addEventListener("click", () => setShown(root.dataset.gx !== "on"));
  bar.querySelectorAll("[data-help-lang]").forEach((c) => c.addEventListener("click", () => setShown(true)));
  window.addEventListener(EVENT, (e) => setLang(e.detail));

  let saved = null;
  try { saved = localStorage.getItem(GX_SHOW_KEY); } catch {}
  const shown = saved === null ? /^A[12]/.test(level ?? "") : saved === "1";
  setLang(lang);
  setShown(shown, false);
}

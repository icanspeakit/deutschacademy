/* Server-side lookup for src/data/uebersetzungen/grammatik-ui.json: the grammar pages'
 * instructions in the UI languages, keyed by the German text itself. See UiText.astro for
 * text in the page and `langAttrs` for text that lives in an attribute (a button whose
 * label is swapped by script, e.g. data-show / data-hide). */
import ui from "../data/uebersetzungen/grammatik-ui.json";

export const UI_LANGS = ["en", "ar", "uk", "tr"];

/** `{ en, ar, uk, tr }` for a German string, or null. */
export function uiTr(de) {
  if (!de || typeof de !== "string") return null;
  return ui.strings?.[de] ?? null;
}

/** `{ "data-show-en": "…", … }` — per-language copies of an attribute, for script to pick. */
export function langAttrs(name, de) {
  const t = uiTr(de);
  const out = {};
  if (t) for (const l of UI_LANGS) if (t[l]) out[`data-${name}-${l}`] = t[l];
  return out;
}

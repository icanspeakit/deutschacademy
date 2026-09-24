// Server-side glue between a translation sidecar (src/data/uebersetzungen/*.json) and
// GrammarHelpText.astro, which takes `{ en, ar, uk, tr }` as HTML. The sidecars for
// Leben in Deutschland, Kultur, Hören and Sprechen hold plain text with the German's own
// `**bold**` convention, so it is escaped here and never trusted as markup.
import { HELP_LANGS } from "./textHelp.js";

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Plain text with `**bold**` → safe HTML. */
export const helpHtml = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\n/g, "<br>");

/** `{ en: "…", ar: "…" }` → the same, as HTML. Null when there is nothing to show. */
export function field(obj) {
  if (!obj) return null;
  const out = {};
  for (const { code } of HELP_LANGS) if (obj[code]) out[code] = helpHtml(obj[code]);
  return Object.keys(out).length ? out : null;
}

/** `{ en: [...], ar: [...] }` → the i-th item of each language, as HTML. */
export function item(obj, i) {
  if (!obj) return null;
  const out = {};
  for (const { code } of HELP_LANGS) if (obj[code]?.[i]) out[code] = helpHtml(obj[code][i]);
  return Object.keys(out).length ? out : null;
}

/** A translated table `{ en: { label, columns, rows }, … }` → one small table per language. */
export function table(obj) {
  if (!obj) return null;
  const out = {};
  for (const { code } of HELP_LANGS) {
    const t = obj[code];
    if (!t) continue;
    const head = (t.columns ?? []).map((c) => `<th>${helpHtml(c)}</th>`).join("");
    const body = (t.rows ?? []).map((r) => `<tr>${r.map((c) => `<td>${helpHtml(c)}</td>`).join("")}</tr>`).join("");
    out[code] = `${t.label ? `<b>${helpHtml(t.label)}</b>` : ""}<div class="gx-tablewrap"><table class="gx-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  }
  return Object.keys(out).length ? out : null;
}

/** A translated list `{ en: [...], … }` → one bulleted list per language. */
export function list(obj) {
  if (!obj) return null;
  const out = {};
  for (const { code } of HELP_LANGS) {
    if (obj[code]?.length) out[code] = `<ul>${obj[code].map((x) => `<li>${helpHtml(x)}</li>`).join("")}</ul>`;
  }
  return Object.keys(out).length ? out : null;
}

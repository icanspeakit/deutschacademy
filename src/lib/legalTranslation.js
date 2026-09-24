// Server-side glue between src/data/uebersetzungen/rechtliches.json and the three legal pages.
//
// The German text stays the server-rendered HTML — it is the only binding version. Every
// translatable element carries data-lx="<key>"; this turns the sidecar's plain text for one
// page into ready HTML per key and language, which LegalTranslation.astro ships as a JSON
// blob and swaps in client-side when the UI language is not German.
//
// The sidecar is plain text with a tiny markup: **bold**, *em*, [text](url), and the
// placeholders {email}, {region}, {date}. Everything is escaped first, so nothing in the
// sidecar is ever trusted as HTML.
import data from "../data/uebersetzungen/rechtliches.json";
import { LEGAL } from "./legal.js";

export const LEGAL_LANGS = ["en", "ar", "tr", "uk"];
export const legalReviewed = data.reviewed === true;

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function render(text) {
  const email = esc(LEGAL.contactEmail);
  return esc(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) =>
      /^https?:/.test(href)
        ? `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`
        : `<a href="${href}">${label}</a>`
    )
    // <bdi>: German/Latin inserts must not scramble the word order of an Arabic sentence.
    .replace(/\{email\}/g, `<bdi><a href="mailto:${email}">${email}</a></bdi>`)
    .replace(/\{region\}/g, `<bdi>${esc(LEGAL.dataRegion)}</bdi>`)
    .replace(/\{date\}/g, `<bdi>${esc(LEGAL.lastUpdated)}</bdi>`);
}

/** `{ key: { en: html, ar: html, … } }` for one page, shared labels included. */
export function legalPayload(page) {
  const entries = { ...data.common, ...(data.pages[page] ?? {}) };
  const out = {};
  for (const [key, langs] of Object.entries(entries)) {
    out[key] = {};
    for (const code of LEGAL_LANGS) if (langs[code]) out[key][code] = render(langs[code]);
  }
  return out;
}

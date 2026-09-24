const UMLAUT_MAP = { "ä": "ae", "ö": "oe", "ü": "ue", "Ä": "Ae", "Ö": "Oe", "Ü": "Ue", "ß": "ss" };

/** A sentence's file name: its slug, cut to 70 characters, plus a short hash of the full
 *  text — two long sentences that start alike must not share a file. Used by
 *  scripts/generate-satz-audio.mjs and the Aussprache page to find the same file. */
export function satzSlug(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return `${slugify(text).slice(0, 70).replace(/-+$/, "")}-${(h >>> 0).toString(36).slice(0, 5)}`;
}

export function slugify(text) {
  const transliterated = text.replace(/[äöüÄÖÜß]/g, (ch) => UMLAUT_MAP[ch]);
  return transliterated
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

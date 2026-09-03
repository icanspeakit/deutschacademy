const UMLAUT_MAP = { "ä": "ae", "ö": "oe", "ü": "ue", "Ä": "Ae", "Ö": "Oe", "Ü": "Ue", "ß": "ss" };

export function slugify(text) {
  const transliterated = text.replace(/[äöüÄÖÜß]/g, (ch) => UMLAUT_MAP[ch]);
  return transliterated
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

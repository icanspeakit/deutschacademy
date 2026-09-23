// One canonical lexicon behind every vocabulary trainer, replacing the per-trainer data
// silos (src/data/artikel.json, src/data/wortschatz.json). Full rationale, on-disk format
// and the A1–C2 volume plan: docs/wortschatz-programm-v1.md.
//
// On disk each level file groups words by unit and states shared fields (level, unit,
// topics) once. This module flattens that into the runtime shape every selector returns:
// flat fields, no per-part-of-speech nesting, so `nouns().filter((n) => n.plural)` works.
//
// Import attributes (`with { type: "json" }`) keep this loadable from both Astro/Vite pages
// and plain `node` scripts — scripts/ relies on the latter.
import { slugify } from "./audioSlug.js";
import a1 from "../content/lexicon/a1.json" with { type: "json" };
import a2 from "../content/lexicon/a2.json" with { type: "json" };
import b1 from "../content/lexicon/b1.json" with { type: "json" };
import b2 from "../content/lexicon/b2.json" with { type: "json" };
import c1 from "../content/lexicon/c1.json" with { type: "json" };
import c2 from "../content/lexicon/c2.json" with { type: "json" };
// Arabic, Russian and Turkish live beside the lexicon rather than in it, keyed by word id.
// Why: src/content/lexicon/i18n/README.md. `en` is not among them — it ships inline with
// the word because it is part of how the lexicon was compiled.
import ar from "../content/lexicon/i18n/ar.json" with { type: "json" };
import ru from "../content/lexicon/i18n/ru.json" with { type: "json" };
import tr from "../content/lexicon/i18n/tr.json" with { type: "json" };

export const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

/** Every language a card can carry a translation in, English first. */
export const TRANSLATION_LANGS = ["en", "ar", "ru", "tr"];

const FILES = { A1: a1, A2: a2, B1: b1, B2: b2, C1: c1, C2: c2 };
const SIDECARS = { ar, ru, tr };

function flatten(file) {
  const out = [];
  for (const unit of file.units ?? []) {
    for (const word of unit.words ?? []) {
      out.push({
        // Defaults first, the word's own fields override them, then the fields the file
        // structure alone decides (id/level/unit) are applied last so they can't be
        // accidentally shadowed by a stray key in the data.
        topics: unit.topics ?? [],
        rank: null,
        audio: null,
        ...word,
        id: word.id ?? slugify(word.lemma),
        level: file.level,
        unit: unit.id,
      });
      // The sidecar glosses, joined on the id the line above just settled. A language with
      // no entry for this word leaves no key at all, so `w.ar != null` stays the honest
      // test for "this word has an Arabic translation".
      const row = out[out.length - 1];
      for (const [lang, table] of Object.entries(SIDECARS)) {
        const value = table[row.id];
        if (value) row[lang] = value;
      }
    }
  }
  return out;
}

const ENTRIES = LEVELS.flatMap((level) => flatten(FILES[level]));

// The unit headers themselves. flatten() spreads a unit's topics onto each word and then
// throws the unit away, but the unit's *title* has no word to live on — and the Lernset
// picker (src/lib/lernsets.js) lists units, not words. So keep the headers alongside.
const UNITS = LEVELS.flatMap((level) =>
  (FILES[level].units ?? []).map((u) => ({
    id: u.id,
    title: u.title ?? null,
    topics: u.topics ?? [],
    level: FILES[level].level,
    words: (u.words ?? []).length,
  }))
);

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

function toArray(value) {
  if (value == null) return null;
  return Array.isArray(value) ? value : [value];
}

/**
 * The one selector everything else is built on.
 *
 * @param {object} [opts]
 * @param {string|string[]} [opts.level]  "A1" or ["A1","A2"]
 * @param {string|string[]} [opts.topic]  topic slug(s) from the §4 taxonomy
 * @param {string|string[]} [opts.pos]    "noun" | "verb" | "adj" | …
 * @param {string|string[]} [opts.unit]   unit id, e.g. "a1-04"
 * @param {string|string[]} [opts.has]    require these fields to be present and non-null
 * @param {number}          [opts.limit]
 */
export function select(opts = {}) {
  const levels = toArray(opts.level);
  const topics = toArray(opts.topic);
  const pos = toArray(opts.pos);
  const units = toArray(opts.unit);
  const has = toArray(opts.has);

  let rows = ENTRIES;
  if (levels) rows = rows.filter((e) => levels.includes(e.level));
  if (pos) rows = rows.filter((e) => pos.includes(e.pos));
  if (units) rows = rows.filter((e) => units.includes(e.unit));
  if (topics) rows = rows.filter((e) => e.topics.some((t) => topics.includes(t)));
  if (has) rows = rows.filter((e) => has.every((f) => e[f] != null));
  return opts.limit ? rows.slice(0, opts.limit) : rows;
}

export const all = () => ENTRIES;
export const nouns = (opts = {}) => select({ ...opts, pos: "noun" });
export const verbs = (opts = {}) => select({ ...opts, pos: "verb" });
export const adjectives = (opts = {}) => select({ ...opts, pos: "adj" });
export const byTopic = (level, topic) => select({ level, topic });
export const byUnit = (unit) => select({ unit });
export const byId = (id) => ENTRIES.find((e) => e.id === id) ?? null;

/** Unit headers `{ id, title, topics, level, words }`, in file order. */
export function units(opts = {}) {
  const levels = toArray(opts.level);
  return levels ? UNITS.filter((u) => levels.includes(u.level)) : UNITS;
}
export const unitById = (id) => UNITS.find((u) => u.id === id) ?? null;

/** Per-level totals for the hub — derived, never hand-typed. */
export function counts() {
  const out = {};
  for (const level of LEVELS) {
    const rows = select({ level });
    out[level] = {
      words: rows.length,
      nouns: rows.filter((e) => e.pos === "noun").length,
      verbs: rows.filter((e) => e.pos === "verb").length,
      units: new Set(rows.map((e) => e.unit)).size,
    };
  }
  out.total = ENTRIES.length;
  return out;
}

// ---------------------------------------------------------------------------
// Back-compat adapters — emit the exact shapes the existing trainers already consume,
// so a page swaps its import and changes nothing else.
// ---------------------------------------------------------------------------

/** Shape of src/data/artikel.json: `{ word, gender }`. */
export const asArtikelRows = (opts = {}) =>
  nouns({ ...opts, has: "gender" }).map((n) => ({ word: n.lemma, gender: n.gender }));

/**
 * Which of TRANSLATION_LANGS every one of these rows can be quizzed in.
 *
 * `every`, not `some`, and that is the whole point: the trainer renders one tab per
 * language, and a tab that resolves to "Übersetzung folgt" partway through the deck is a
 * promise the content did not keep. So a language appears only once the deck is complete
 * in it — which also makes a half-finished translation pass invisible instead of broken.
 */
export function langsIn(rows) {
  if (!rows.length) return ["en"];
  return TRANSLATION_LANGS.filter((lang) => rows.every((r) => r[lang] != null));
}

/** The same question asked of cards rather than lexicon rows — what a page has in hand. */
export function langsOf(cards) {
  if (!cards.length) return ["en"];
  return TRANSLATION_LANGS.filter((lang) => cards.every((c) => c.translations?.[lang]));
}

/** What the voice says for a word: nouns carry their article, everything else is bare.
 *  One place, because the generator and the page have to agree on the text or the slug
 *  the page asks for is not the slug the file was written under. */
export const spokenForm = (e) => (e.pos === "noun" && e.gender ? `${e.gender} ${e.lemma}` : e.lemma);

/** Shape of src/data/wortschatz.json: `{ front, note, translations }`. */
const toCard = (e) => {
  const translations = {};
  for (const lang of TRANSLATION_LANGS) if (e[lang] != null) translations[lang] = e[lang];
  return {
    front: e.lemma,
    note: e.note ?? e.example ?? "",
    translations,
    // A German noun without its article is half a word: "Name" is not learnable, "der
    // Name" is. The lexicon has carried `gender` and `plural` all along — 2 577 of the
    // 2 594 nouns — and only the card dropped them, which is why the audio already said "der
    // Name" while the card showed "Name".
    //
    // They stay two fields rather than one string: the Wortliste sorts on `front` and
    // would otherwise file every noun under d, and the test checks against it. The
    // renderers compose them.
    //
    // A Pluraletantum (Eltern, Ferien, Möbel) has no gender of its own and takes the
    // plural article, which is what a dictionary prints: "die Eltern".
    ...(e.pos === "noun"
      ? {
          gender: e.gender ?? (e.pluralOnly ? "die" : null),
          plural: e.plural ?? null,
          pluralOnly: !!e.pluralOnly,
        }
      : {}),
    // Only the words that actually have a file. A deck is partly voiced for as long as
    // the generator has been run over part of the lexicon, and a play button that 404s
    // is worse than no play button — so the card carries the source or carries nothing,
    // and every renderer keys off its presence.
    ...(e.audio ? { audioSrc: `/audio/wortschatz/${e.audio}.mp3`, spoken: spokenForm(e) } : {}),
  };
};
export const asVokabelCards = (opts = {}) => select({ ...opts, has: "en" }).map(toCard);

/** The same shape for rows a caller has already selected some other way — the frequency
 *  cohorts in lernsets.js pick their words by rank, which `select` has no filter for. One
 *  mapping, so a deck built by query and a deck built by rank can never drift apart. */
export const toVokabelCards = (rows) => rows.filter((e) => e.en != null).map(toCard);

/** Shape consumed by src/lib/pronunciation.js via aussprache.astro. The files are the
 *  ones scripts/generate-wortschatz-audio.mjs writes, so every word it voices shows up on
 *  the Aussprache page without further wiring. */
export const asAudioItems = (opts = {}) =>
  select({ ...opts, has: "audio" }).map((e) => ({
    text: spokenForm(e),
    audioSrc: `/audio/wortschatz/${e.audio}.mp3`,
    note: [e.ipa ? `/${e.ipa}/` : "", e.example ?? ""].filter(Boolean).join(" · "),
    translations: Object.fromEntries(TRANSLATION_LANGS.filter((l) => e[l]).map((l) => [l, e[l]])),
  }));

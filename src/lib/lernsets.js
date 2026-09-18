// The Lernset layer: joins the offering (src/content/program.json) with the content
// (src/lib/lexicon.js), so a "Lernset" — one program unit, ~25 words, one sitting — is a
// thing the UI can list, count and link to.
//
// Nothing here is stored. Every number is computed from the lexicon at build time, which
// is the honesty convention the hub already follows (docs/wortschatz-programm-v1.md §3):
// if a word is not in src/content/lexicon/*.json, no page can claim it exists.
//
// data/lernsets/ is a *snapshot* produced by scripts/extract-lernsets.mjs for review. It
// is deliberately not imported here — importing it would recreate exactly the per-trainer
// data silo §1 of that document was written to kill.
//
// Import attributes keep this loadable from plain `node` as well as from Astro/Vite, the
// same as lexicon.js, so scripts/ can use it too.
import program from "../content/program.json" with { type: "json" };
import { LEVELS, all, select, byUnit, units, unitById, asVokabelCards, toVokabelCards } from "./lexicon.js";

// The trainer eligibility queries of docs/wortschatz-programm-v1.md §2. A trainer is not a
// data file, it is a filter over the one lexicon — so "which trainers can this set feed"
// is answered by running the filters, never by a flag in the content.
const TRAINERS = {
  karten: (w) => w.en != null,
  artikel: (w) => w.pos === "noun" && w.gender != null,
  plural: (w) => w.pos === "noun" && w.plural != null,
  verbformen: (w) => w.pos === "verb" && Array.isArray(w.forms) && w.forms.length > 0,
  trennbare: (w) => w.pos === "verb" && w.separable === true,
  komparativ: (w) => w.pos === "adj" && w.comparative != null,
  verbPraeposition: (w) => w.pos === "verb" && w.prep != null,
  aussprache: (w) => w.audio != null,
};

const pools = (words) =>
  Object.fromEntries(Object.entries(TRAINERS).map(([k, fn]) => [k, words.filter(fn).length]));

const tally = (words, key) => {
  const out = {};
  for (const w of words) {
    const v = w[key];
    for (const k of Array.isArray(v) ? v : [v]) if (k != null) out[k] = (out[k] ?? 0) + 1;
  }
  return out;
};

// unit id -> where the program puts it. Built once at module load.
const PLACEMENT = new Map();
for (const level of program.levels ?? []) {
  for (const mod of level.modules ?? []) {
    for (const unit of mod.units ?? []) {
      PLACEMENT.set(unit.id, {
        level: level.level,
        moduleId: mod.id,
        moduleTitle: mod.title,
        title: unit.title,
      });
    }
  }
}

// The two sides can disagree, and on 2026-09-17 they do: the lexicon has 46 B1 units and
// 10 B2 units whose words are written, while program.json still lists B1/B2 as modules
// with `plannedUnits` and no `units` — the placement has not caught up with the content.
//
// So a Lernset is the *union*: the program names the offering, the lexicon says what can
// actually be opened, and a unit only the lexicon knows about still appears (with
// `moduleId: null`) rather than being silently dropped. Inventing a module for it would be
// the one thing worse than showing it unplaced.
const ORDER = [...PLACEMENT.keys(), ...units().map((u) => u.id).filter((id) => !PLACEMENT.has(id))];

function rowFor(unitId) {
  const place = PLACEMENT.get(unitId);
  const head = unitById(unitId);
  const words = byUnit(unitId);
  return {
    id: unitId,
    // The lexicon's own title wins: it ships with the words and cannot go stale against
    // them. program.json is the fallback for a unit that has no words yet.
    title: head?.title ?? place?.title ?? unitId,
    level: place?.level ?? head?.level ?? null,
    moduleId: place?.moduleId ?? null,
    moduleTitle: place?.moduleTitle ?? null,
    topics: head?.topics ?? [],
    status: words.length ? "built" : "planned",
    placed: !!place,
    words: words.length,
    pos: tally(words, "pos"),
    trainers: pools(words),
  };
}

const ROWS = ORDER.map(rowFor);

/**
 * Lernset rows, program order first, then anything the lexicon has that the program has
 * not placed.
 *
 * @param {object} [opts]
 * @param {string|string[]} [opts.level]  "A1" or ["A1","A2"]
 * @param {"built"|"planned"} [opts.status]
 */
export function lernsets(opts = {}) {
  const levels = opts.level == null ? null : [].concat(opts.level);
  let rows = ROWS;
  if (levels) rows = rows.filter((r) => levels.includes(r.level));
  if (opts.status) rows = rows.filter((r) => r.status === opts.status);
  return rows;
}

/** One Lernset plus its words, or null when neither side knows that unit. */
export function lernset(id) {
  if (!PLACEMENT.has(id) && !unitById(id)) return null;
  return { ...rowFor(id), items: byUnit(id) };
}

/** The deck the flashcard trainer consumes, for one Lernset. */
export const lernsetCards = (id) => asVokabelCards({ unit: id });

/**
 * One level's Lernsets, grouped the way the picker renders them: the program's modules
 * first, then a trailing group for sets the program has not placed yet. Modules with no
 * units at all keep their `plannedUnits`, so the UI can say what is coming without
 * pretending it is here.
 */
export function modules(level) {
  const entry = (program.levels ?? []).find((l) => l.level === level);
  const groups = (entry?.modules ?? []).map((mod) => {
    const sets = (mod.units ?? []).map((u) => rowFor(u.id));
    return {
      id: mod.id,
      title: mod.title,
      plannedUnits: mod.plannedUnits ?? null,
      sets,
      words: sets.reduce((n, s) => n + s.words, 0),
    };
  });

  const loose = units({ level })
    .filter((u) => !PLACEMENT.has(u.id))
    .map((u) => rowFor(u.id));
  if (loose.length) {
    // A handful of unplaced sets alongside placed ones is a remainder, and "Weitere
    // Lernsets" is the honest name for it. A whole level of them is not a remainder, it
    // is the level — B1 is 46 unplaced sets — and one unnamed heading over all 46 says
    // nothing while the list underneath it runs for two thousand pixels. So when the
    // program has placed nothing here, the words group themselves (see BEREICHE).
    if (groups.some((g) => g.sets.length)) {
      groups.push({
        id: `${level.toLowerCase()}-ungeordnet`,
        title: "Weitere Lernsets",
        plannedUnits: null,
        sets: loose,
        words: loose.reduce((n, s) => n + s.words, 0),
      });
    } else {
      groups.push(...bereiche(level, loose));
    }
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Bereiche — the grouping a level gets when the program has not placed it
// ---------------------------------------------------------------------------
//
// A1 and A2 are placed into modules by src/content/program.json, and those modules are
// what the picker lists as subcategories. B1 and B2 are not, and nothing says when they
// will be — so the choice was between one flat list of 46 and inventing a placement.
//
// Neither, as it turns out: every unit already carries a topic slug from the §4 taxonomy
// (`arbeit`, `gesundheit`, `aemter` …), which is 31 distinct values at B1. Thirty-one
// headings over forty-six rows is not a grouping. So the slugs are rolled up into nine
// Lebensbereiche — the same grain A1's modules use, and the grain a learner scanning for
// "the work one" is actually scanning at.
//
// This is a presentation grouping, deliberately: it does not claim to be the course
// structure program.json will eventually declare, and it disappears the moment that file
// places a level. Anything whose topic is not listed here — or that has no topic at all —
// lands in a trailing "Weitere Lernsets" rather than being dropped, which is the same
// convention §3 applies to words.
const BEREICHE = [
  { id: "arbeit-wirtschaft", title: "Arbeit & Wirtschaft", topics: ["arbeit", "wirtschaft", "geld"] },
  { id: "recht-behoerden", title: "Recht & Behörden", topics: ["recht", "aemter", "politik"] },
  { id: "gesundheit-koerper", title: "Gesundheit & Körper", topics: ["gesundheit", "koerper", "psychologie"] },
  { id: "wohnen-stadt", title: "Wohnen & Stadt", topics: ["wohnen", "stadt"] },
  { id: "bildung-sprache", title: "Bildung & Sprache", topics: ["bildung", "sprache", "wissenschaft"] },
  { id: "gesellschaft-leben", title: "Gesellschaft & Leben", topics: ["gesellschaft", "familie", "migration", "kultur"] },
  { id: "unterwegs-umwelt", title: "Unterwegs & Umwelt", topics: ["verkehr", "reisen", "umwelt", "natur", "wetter"] },
  { id: "alltag-freizeit", title: "Alltag & Freizeit", topics: ["essen", "einkaufen", "freizeit", "kleidung", "zeit"] },
  { id: "medien-technik", title: "Medien & Technik", topics: ["medien", "technik", "kommunikation"] },
];

const BEREICH_OF = new Map();
for (const b of BEREICHE) for (const t of b.topics) BEREICH_OF.set(t, b.id);

function bereiche(level, rows) {
  const bins = new Map();
  for (const row of rows) {
    const id = row.topics.map((t) => BEREICH_OF.get(t)).find(Boolean) ?? "rest";
    if (!bins.has(id)) bins.set(id, []);
    bins.get(id).push(row);
  }
  // BEREICHE order, then the leftovers — never Map insertion order, which would make the
  // headings depend on which unit happened to be written first.
  const out = [];
  for (const b of [...BEREICHE, { id: "rest", title: "Weitere Lernsets" }]) {
    const sets = bins.get(b.id);
    if (!sets?.length) continue;
    out.push({
      id: `${level.toLowerCase()}-${b.id}`,
      title: b.title,
      plannedUnits: null,
      sets,
      words: sets.reduce((n, r) => n + r.words, 0),
    });
  }
  return out;
}

/** Per-level totals for the hub and the picker — derived, never hand-typed. */
export function counts() {
  const out = {};
  for (const level of LEVELS) {
    const entry = (program.levels ?? []).find((l) => l.level === level);
    const rows = lernsets({ level });
    const words = select({ level });
    // Modules that still carry only a plan. Their plannedUnits is the honest count of
    // sets that do not exist yet; sets that exist are counted from the lexicon instead.
    const planOnly = (entry?.modules ?? []).filter((m) => (m.units ?? []).length === 0);
    out[level] = {
      status: entry?.status ?? "planned",
      title: entry?.title ?? null,
      subtitle: entry?.subtitle ?? null,
      sets: rows.filter((r) => r.status === "built").length,
      plannedModules: planOnly.length,
      plannedUnits: planOnly.reduce((n, m) => n + (m.plannedUnits ?? 0), 0),
      words: words.length,
      targetWords: entry?.targetWords ?? null,
      trainers: pools(words),
    };
  }
  out.total = {
    sets: ROWS.filter((r) => r.status === "built").length,
    words: select({}).length,
    levelsLive: LEVELS.filter((l) => out[l].sets > 0),
  };
  return out;
}


// ---------------------------------------------------------------------------
// Frequency cohorts — the other way to cut the same lexicon
// ---------------------------------------------------------------------------
//
// A Lernset is thematic: 25 words that belong together ("Haus & Räume"). That is the right
// unit for a course, and the wrong one for the question most beginners actually ask, which
// is "what do I learn first". The answer to that is in the data already: scripts/attach-ranks.mjs
// wrote a corpus frequency `rank` onto every word it could match, and sorting by it puts
// nicht, und, was, zu, in, mit at the top — function words, verbs and nouns together,
// because that is what the top of a frequency list looks like. No balancing is applied and
// none is wanted: the mix IS the finding.
//
// Two things this is not:
//
//  - It is not a claim that unranked words are rare. The source is a WORDFORM list, so a
//    lemma only matches when its citation form appears in it; compounds like "Ausländerbehörde"
//    come back null because of how they are written, not because of how common they are.
//    Those words are left out of the cohorts entirely and stay reachable through their
//    thematic Lernset, which the UI says out loud.
//  - It is not a stable unit. Add fifty high-frequency words tomorrow and every cohort
//    after them shifts by fifty. That is fine because nothing is stored against a cohort:
//    progress.js records mastery per word, so a learner's history survives the reshuffle —
//    but it does mean a cohort id must never be treated as a permanent address for a
//    particular set of words the way "a1-04" is.
const COHORT_SIZE = 20;

const RANKED = all()
  .filter((w) => w.rank != null && w.en != null)
  .sort((a, b) => a.rank - b.rank);

/** Words the frequency list could not match — listed nowhere in the cohorts, counted here
 *  so the UI can say how many it is leaving out instead of quietly dropping them. */
export const unranked = () => all().filter((w) => w.rank == null);

const pad = (n) => String(n).padStart(3, "0");

const COHORTS = [];
for (let i = 0; i < RANKED.length; i += COHORT_SIZE) {
  const items = RANKED.slice(i, i + COHORT_SIZE);
  const index = COHORTS.length + 1;
  const levelTally = tally(items, "level");
  COHORTS.push({
    id: `haeufigkeit-${pad(index)}`,
    index,
    // The position in the frequency-ordered list, not the raw corpus rank: rank jumps
    // (6 … 49974) and means nothing to a learner, while "Wörter 41-60" is a place.
    from: i + 1,
    to: i + items.length,
    title: `Wörter ${i + 1}-${i + items.length}`,
    words: items.length,
    // Which levels these words were banded into. A frequency cohort cuts across levels by
    // construction, and saying so is the honest version of a level badge.
    levels: LEVELS.filter((l) => levelTally[l]),
    levelTally,
    pos: tally(items, "pos"),
    trainers: pools(items),
    items,
  });
}

/**
 * Frequency cohorts, most frequent first.
 * @param {object} [opts]
 * @param {number} [opts.limit]
 */
export function cohorts(opts = {}) {
  const rows = COHORTS.map(({ items, ...row }) => row);
  return opts.limit ? rows.slice(0, opts.limit) : rows;
}

/** One cohort plus its words, or null. */
export function cohort(id) {
  return COHORTS.find((c) => c.id === id) ?? null;
}

/** The deck the flashcard trainer consumes, for one cohort. */
export const cohortCards = (id) => toVokabelCards(cohort(id)?.items ?? []);

/**
 * Cohorts in blocks of `per`, the way the picker lists them — 123 flat rows is a scroll,
 * "Wörter 1-100" holding five of them is a place to aim for.
 */
export function cohortBlocks({ per = 5 } = {}) {
  const rows = cohorts();
  const blocks = [];
  for (let i = 0; i < rows.length; i += per) {
    const slice = rows.slice(i, i + per);
    blocks.push({
      id: `haeufigkeit-block-${pad(blocks.length + 1)}`,
      title: `Wörter ${slice[0].from}-${slice[slice.length - 1].to}`,
      cohorts: slice,
      words: slice.reduce((n, c) => n + c.words, 0),
    });
  }
  return blocks;
}

/** Totals for the frequency section — derived, never hand-typed. */
export function frequencyCounts() {
  const missing = unranked();
  return {
    size: COHORT_SIZE,
    cohorts: COHORTS.length,
    words: RANKED.length,
    unranked: missing.length,
    unrankedByLevel: tally(missing, "level"),
  };
}


// ---------------------------------------------------------------------------
// Portionen — the level deck, cut into sittings of 20
// ---------------------------------------------------------------------------
//
// "Alle A1" is 650 cards behind one link, and B1 is 1150. On a phone that is not a deck,
// it is a wall: there is no way to say where you stopped, no way to come back to the same
// twenty tomorrow, and the progress bar moves by a fifteenth of a percent per card.
//
// A Lernset already solves this thematically, but only for someone who wants to study
// "Haus & Räume". Someone who has simply chosen a level and wants to work through it in
// order has, until now, had nothing between one card and the whole level. A Portion is
// that middle rung: the level's own list, in the level's own order, cut every 20 words.
//
// Why 20 and not 25 (the Lernset size): a Portion is a cut across the level, not a topic,
// so it is not competing with a Lernset for the same job — and 20 is the size the
// frequency cohorts already use for exactly the same "one sitting, no theme" role. One
// number for both keeps "eine Portion" meaning one thing on this site.
//
// Boundaries are deliberately *not* snapped to unit edges. Snapping would just reproduce
// the Lernsets with a different name; the point of the Portion is that it is a ruler laid
// over the level, so Portion 2 spanning the end of one topic and the start of the next is
// the feature. Each row says which topics it crosses so that is visible rather than
// surprising.
//
// Only words with a translation are counted, the same filter asVokabelCards() applies, so
// a Portion's word count and the cards it actually opens with can never disagree.
const PORTION_SIZE = 20;

// Two digits, not the cohorts' three: the longest level is 58 Portionen, and "a1-teil-004"
// would promise a thousand of them.
const pad2 = (n) => String(n).padStart(2, "0");

const PORTIONS = [];
for (const level of LEVELS) {
  const rows = select({ level, has: "en" });
  const total = Math.ceil(rows.length / PORTION_SIZE);
  for (let i = 0; i < rows.length; i += PORTION_SIZE) {
    const items = rows.slice(i, i + PORTION_SIZE);
    const index = PORTIONS.filter((p) => p.level === level).length + 1;
    const titles = [...new Set(items.map((w) => unitById(w.unit)?.title).filter(Boolean))];
    PORTIONS.push({
      id: `${level.toLowerCase()}-teil-${pad2(index)}`,
      level,
      index,
      of: total,
      from: i + 1,
      to: i + items.length,
      title: `${level} Teil ${index}`,
      words: items.length,
      // The topics this cut lands in — "Familie & Beziehungen · Gefühle" when it straddles
      // two. This is what a Portion has instead of a name of its own.
      topics: titles,
      pos: tally(items, "pos"),
      trainers: pools(items),
      items,
    });
  }
}

/**
 * Portions of one level, or of every level when `level` is omitted.
 * @param {string} [level] "A1"
 */
export function portions(level) {
  const rows = PORTIONS.filter((p) => level == null || p.level === level);
  return rows.map(({ items, ...row }) => row);
}

/** One Portion plus its words, or null. */
export function portion(id) {
  return PORTIONS.find((p) => p.id === id) ?? null;
}

/** The deck the flashcard trainer consumes, for one Portion. */
export const portionCards = (id) => toVokabelCards(portion(id)?.items ?? []);

/** Portions in blocks, the way the picker lists them — same collapse the cohorts use, so
 *  58 B1 rows arrive as five headings rather than one scroll. */
export function portionBlocks(level, { per = 10 } = {}) {
  const rows = portions(level);
  const blocks = [];
  for (let i = 0; i < rows.length; i += per) {
    const slice = rows.slice(i, i + per);
    blocks.push({
      id: `${level.toLowerCase()}-teile-${pad2(blocks.length + 1)}`,
      title: `Wörter ${slice[0].from}-${slice[slice.length - 1].to}`,
      portions: slice,
      words: slice.reduce((n, p) => n + p.words, 0),
    });
  }
  return blocks;
}

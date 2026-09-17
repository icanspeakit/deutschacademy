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
    groups.push({
      id: `${level.toLowerCase()}-ungeordnet`,
      // A heading is only worth its line when it distinguishes this group from another.
      // At B1 today every set is unplaced, so "Weitere Lernsets" would be the sole heading
      // over the whole level and would say nothing.
      title: groups.some((g) => g.sets.length) ? "Weitere Lernsets" : null,
      plannedUnits: null,
      sets: loose,
      words: loose.reduce((n, s) => n + s.words, 0),
    });
  }
  return groups;
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

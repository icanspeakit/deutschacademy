// Extract every Wortschatz-Lernset (= program unit) into a standalone, self-contained
// dataset under data/lernsets/. Data only — nothing here is imported by the site.
//
//   node scripts/extract-lernsets.mjs
//
// Sources (read directly from disk, no runtime deps, no import attributes, so this also
// runs under older node and outside Astro):
//   src/content/program.json          level -> module -> unit  (the offering)
//   src/content/lexicon/{a1..c2}.json unit  -> words           (the content)
//   src/data/wortschatz.json          15 legacy Redemittel cards (en/ar/ru/tr)
//
// Outputs:
//   data/lernsets/lernsets.index.json  one row per Lernset, built + planned, no words
//   data/lernsets/lernsets.a1.json     built sets for A1, words inlined (runtime shape)
//   data/lernsets/lernsets.a2.json     built sets for A2
//   data/lernsets/lernsets.legacy-redemittel.json  the 4-language cards, unmigrated
//   data/lernsets/lernsets.words.csv   one row per word, flat, for review in a spreadsheet
//   data/lernsets/summary.json         totals per level / trainer / topic / pos
//
// Word counts and trainer pools are DERIVED here, never hand-typed — same convention as
// the hub page (docs/wortschatz-programm-v1.md §3).

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "data", "lernsets");
const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

const read = (p) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));
const write = (name, value) =>
  writeFileSync(join(OUT, name), JSON.stringify(value, null, 2) + "\n", "utf8");

// slugify — kept byte-identical to src/lib/audioSlug.js so ids match the progress keys
// the trainers already write to localStorage.
const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

// --- trainer eligibility: the queries of docs/wortschatz-programm-v1.md §2 ------------
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
  Object.fromEntries(
    Object.entries(TRAINERS).map(([name, fn]) => [name, words.filter(fn).length])
  );

const tally = (words, key) => {
  const out = {};
  for (const w of words) {
    const v = w[key];
    for (const k of Array.isArray(v) ? v : [v]) {
      if (k == null) continue;
      out[k] = (out[k] ?? 0) + 1;
    }
  }
  return Object.fromEntries(Object.entries(out).sort((a, b) => b[1] - a[1]));
};

// --- load -----------------------------------------------------------------------------
const program = read("src/content/program.json");
const lexicons = Object.fromEntries(
  LEVELS.map((l) => {
    try {
      return [l, read(`src/content/lexicon/${l.toLowerCase()}.json`)];
    } catch {
      return [l, { level: l, units: [] }]; // level not authored yet
    }
  })
);

// unit id -> { module, level } from the program layer
const placement = new Map();
for (const level of program.levels) {
  for (const mod of level.modules ?? []) {
    for (const unit of mod.units ?? []) {
      placement.set(unit.id, {
        level: level.level,
        levelTitle: level.title,
        levelStatus: level.status,
        moduleId: mod.id,
        moduleTitle: mod.title,
      });
    }
  }
}

// --- build the Lernsets ---------------------------------------------------------------
mkdirSync(OUT, { recursive: true });

const index = [];
const allWords = [];
const orphans = [];

for (const level of LEVELS) {
  const file = lexicons[level];
  const sets = [];

  for (const unit of file.units ?? []) {
    const place = placement.get(unit.id);
    if (!place) orphans.push(unit.id);

    // Runtime shape of src/lib/lexicon.js flatten(): defaults, then the word's own
    // fields, then the fields the file structure alone decides.
    const words = (unit.words ?? []).map((w) => ({
      topics: unit.topics ?? [],
      rank: null,
      audio: null,
      ...w,
      id: w.id ?? slugify(w.lemma),
      level: file.level,
      unit: unit.id,
    }));

    const row = {
      id: unit.id,
      title: unit.title,
      level: file.level,
      moduleId: place?.moduleId ?? null,
      moduleTitle: place?.moduleTitle ?? null,
      topics: unit.topics ?? [],
      status: "built",
      words: words.length,
      ranked: words.filter((w) => w.rank != null).length,
      withExample: words.filter((w) => w.example).length,
      pos: tally(words, "pos"),
      trainers: pools(words),
    };

    index.push(row);
    sets.push({ ...row, items: words });
    allWords.push(...words);
  }

  if (sets.length) write(`lernsets.${level.toLowerCase()}.json`, {
    level,
    source: file.source ?? null,
    generated: new Date().toISOString().slice(0, 10),
    sets: sets.length,
    words: sets.reduce((n, s) => n + s.words, 0),
    lernsets: sets,
  });
}

// planned sets: modules that carry plannedUnits but no units yet
for (const level of program.levels) {
  for (const mod of level.modules ?? []) {
    if ((mod.units ?? []).length > 0) continue;
    index.push({
      id: null,
      title: null,
      level: level.level,
      moduleId: mod.id,
      moduleTitle: mod.title,
      topics: [],
      status: "planned",
      plannedUnits: mod.plannedUnits ?? null,
      words: 0,
      trainers: pools([]),
    });
  }
}

// --- legacy Redemittel cards ----------------------------------------------------------
// Not in the lexicon: they carry en/ar/ru/tr, the lexicon ships `en` only, so
// /wortschatz still reads this file (docs §"Deliberately not migrated").
const legacy = read("src/data/wortschatz.json");
write("lernsets.legacy-redemittel.json", {
  id: "legacy-redemittel",
  title: "Redemittel & Alltagsvokabeln (Karteikarten)",
  level: null,
  status: "legacy",
  note:
    "Source: src/data/wortschatz.json, consumed by /wortschatz. Four languages " +
    "(en/ar/ru/tr) against the lexicon's en-only, so it is deliberately not migrated. " +
    "Overlaps thematically with a2-28 (Redemittel) and a1-20 (Tiere).",
  languages: ["en", "ar", "ru", "tr"],
  words: legacy.length,
  items: legacy.map((c, i) => ({ id: `redemittel-${String(i + 1).padStart(2, "0")}`, ...c })),
});

// --- index + summary ------------------------------------------------------------------
const built = index.filter((s) => s.status === "built");

write("lernsets.index.json", {
  generated: new Date().toISOString().slice(0, 10),
  note:
    "One row per Wortschatz-Lernset. A Lernset is one program unit (~25 words, one " +
    "sitting). Counts are derived from the lexicon, never hand-typed. Words live in " +
    "lernsets.<level>.json.",
  totals: {
    built: built.length,
    plannedModules: index.filter((s) => s.status === "planned").length,
    words: allWords.length,
  },
  lernsets: index,
});

write("summary.json", {
  generated: new Date().toISOString().slice(0, 10),
  byLevel: Object.fromEntries(
    LEVELS.map((l) => {
      const sets = built.filter((s) => s.level === l);
      const words = allWords.filter((w) => w.level === l);
      const target = program.levels.find((p) => p.level === l)?.targetWords ?? null;
      return [l, { sets: sets.length, words: words.length, targetWords: target, trainers: pools(words) }];
    })
  ),
  trainerPools: pools(allWords),
  byPos: tally(allWords, "pos"),
  byTopic: tally(allWords, "topics"),
  orphanUnits: orphans,
});

// --- flat CSV -------------------------------------------------------------------------
const COLS = [
  "level", "unit", "unitTitle", "moduleId", "moduleTitle", "topics", "id", "lemma", "pos",
  "gender", "plural", "en", "example", "forms", "aux", "separable", "reflexive", "prep",
  "case", "comparative", "superlative", "rank", "note", "audio",
];
const cell = (v) => {
  if (v == null) return "";
  const s = Array.isArray(v) ? v.join("|") : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const titleOf = new Map(built.map((s) => [s.id, s]));
const rows = allWords.map((w) => {
  const s = titleOf.get(w.unit);
  return COLS.map((c) =>
    cell(
      c === "unitTitle" ? s?.title
      : c === "moduleId" ? s?.moduleId
      : c === "moduleTitle" ? s?.moduleTitle
      : w[c]
    )
  ).join(",");
});
writeFileSync(join(OUT, "lernsets.words.csv"), [COLS.join(","), ...rows].join("\n") + "\n", "utf8");

console.log(
  `${built.length} Lernsets built · ${allWords.length} words · ` +
    `${index.length - built.length} planned modules · ${legacy.length} legacy cards` +
    (orphans.length ? ` · orphan units: ${orphans.join(", ")}` : " · no orphan units")
);

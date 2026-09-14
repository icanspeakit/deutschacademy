// Validates src/content/lexicon/*.json against the rules in docs/wortschatz-programm-v1.md.
// Plain JS, no schema library — package.json deliberately carries only `astro` at runtime.
//   node scripts/validate-lexicon.mjs
// Exits non-zero on any error, so it can gate a build or a commit hook.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { slugify } from "../src/lib/audioSlug.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const LEVELS = ["a1", "a2", "b1", "b2", "c1", "c2"];
const POS = ["noun", "verb", "adj", "adv", "prep", "conj", "pron", "num", "phrase"];
const GENDERS = ["der", "die", "das"];
const CASES = ["akk", "dat", "gen", "akk/dat"];
const AUX = ["haben", "sein"];

// §4 taxonomy. A word may only carry topics listed here, so a typo can't silently create
// a topic that no deck will ever select.
const TOPICS = new Set([
  "person", "familie", "gefuehle", "wohnen", "stadt", "essen", "einkaufen", "kleidung",
  "koerper", "gesundheit", "arbeit", "bildung", "freizeit", "reisen", "verkehr", "zeit",
  "wetter", "natur", "geld", "aemter", "medien", "kommunikation", "sprache",
  "umwelt", "politik", "wirtschaft", "recht", "wissenschaft", "technik", "kultur",
  "psychologie", "gesellschaft", "migration",
  "nominalstil", "idiomatik", "kollokation", "konnektoren", "fachsprache", "stilebene",
  "wortbildung",
]);

const errors = [];
const warnings = [];
const seenIds = new Map();
const seenUnits = new Set();
let total = 0;

function err(where, msg) {
  errors.push(`${where}: ${msg}`);
}

for (const level of LEVELS) {
  const file = path.join(ROOT, "src/content/lexicon", `${level}.json`);
  const data = JSON.parse(readFileSync(file, "utf8"));

  if (data.level !== level.toUpperCase()) {
    err(`${level}.json`, `level field is "${data.level}", expected "${level.toUpperCase()}"`);
  }

  for (const unit of data.units ?? []) {
    if (!unit.id) err(`${level}.json`, "a unit has no id");
    if (seenUnits.has(unit.id)) err(`${level}.json`, `duplicate unit id "${unit.id}"`);
    seenUnits.add(unit.id);
    if (!unit.title) err(unit.id, "unit has no title");

    for (const t of unit.topics ?? []) {
      if (!TOPICS.has(t)) err(unit.id, `unknown topic "${t}" — add it to the §4 taxonomy or fix the typo`);
    }

    for (const w of unit.words ?? []) {
      total++;
      const id = w.id ?? slugify(w.lemma ?? "");
      const where = `${unit.id}/${w.lemma ?? "?"}`;

      if (!w.lemma) err(where, "missing lemma");
      if (!w.pos) err(where, "missing pos");
      else if (!POS.includes(w.pos)) err(where, `unknown pos "${w.pos}"`);

      // Progress keys are ids, so a collision would silently merge two words' histories.
      if (seenIds.has(id)) err(where, `duplicate id "${id}" — also in ${seenIds.get(id)}`);
      else seenIds.set(id, where);

      if (w.pos === "noun") {
        if (!w.gender && !w.pluralOnly) err(where, "noun without gender (set pluralOnly for Eltern/Ferien)");
        if (w.gender && !GENDERS.includes(w.gender)) err(where, `bad gender "${w.gender}"`);
        if (!w.plural && !w.pluralOnly && !w.example) warnings.push(`${where}: no plural (uncountable?)`);
      }
      if (w.pos === "verb") {
        if (w.aux && !AUX.includes(w.aux)) err(where, `bad aux "${w.aux}"`);
        if (w.forms && w.forms.length !== 3) {
          err(where, `forms must be [3rd sg, Präteritum, Partizip II], got ${w.forms.length}`);
        }
        if (w.separable && w.forms && !w.forms[0].includes(" ")) {
          err(where, `separable verb but present form "${w.forms[0]}" has no split prefix`);
        }
      }
      if (w.case && !CASES.includes(w.case)) err(where, `bad case "${w.case}"`);
      if (w.en == null) err(where, "missing English gloss");
      if (w.example != null && !w.example.trim()) err(where, "empty example");
    }
  }
}

for (const w of warnings) console.warn(`warn  ${w}`);
for (const e of errors) console.error(`ERROR ${e}`);

console.log(`\n${total} words, ${seenUnits.size} units, ${errors.length} errors, ${warnings.length} warnings`);
if (errors.length) process.exit(1);

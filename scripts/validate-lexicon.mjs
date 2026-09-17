// Validates src/content/lexicon/*.json against the rules in docs/wortschatz-programm-v1.md.
// Plain JS, no schema library — package.json deliberately carries only `astro` at runtime.
//   node scripts/validate-lexicon.mjs
// Exits non-zero on any error, so it can gate a build or a commit hook.
import { readdirSync, readFileSync } from "node:fs";
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

// Provenance values scripts/fetch-wiktionary.mjs is allowed to stamp. A sourced field has to say
// where it came from, so a later pass can find the rows that were never sourced instead of
// guessing which of them to re-check. See docs/lexicon-enrichment-v1.md §2.1.
const IPA_SOURCES = ["wiktionary"];

// grammar_anchor keys to a grammar topic that must actually exist — same reasoning as the closed
// §4 topic taxonomy: an unchecked free-text field accumulates typos that no page ever selects,
// and the mistake only surfaces as a silently missing cross-link months later.
const GRAMMAR_IDS = new Set(
  readdirSync(path.join(ROOT, "src/data/grammatik"))
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""))
);

const errors = [];
const warnings = [];
const seenIds = new Map();
const seenUnits = new Set();
const sourced = { ipa: 0, anchor: 0 };
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

      // --- sourced fields (scripts/fetch-wiktionary.mjs) ---
      if (w.ipa) sourced.ipa++;
      if (w.grammar_anchor) sourced.anchor++;
      if (w.ipa != null) {
        if (typeof w.ipa !== "string" || !w.ipa.trim()) err(where, "empty ipa — omit the field instead");
        if (!w.ipaSource) err(where, "ipa without ipaSource — a sourced field must record its provenance");
        else if (!IPA_SOURCES.includes(w.ipaSource)) err(where, `unknown ipaSource "${w.ipaSource}"`);
      } else {
        if (w.ipaSource) err(where, "ipaSource without ipa");
        if (w.ipaVariants) err(where, "ipaVariants without ipa");
      }
      if (w.ipaVariants != null) {
        if (!Array.isArray(w.ipaVariants) || !w.ipaVariants.length) {
          err(where, "ipaVariants must be a non-empty array — omit the field when there is one pronunciation");
        } else {
          if (w.ipaVariants.some((v) => typeof v !== "string" || !v.trim())) err(where, "ipaVariants contains an empty entry");
          if (w.ipaVariants.includes(w.ipa)) err(where, "ipaVariants repeats ipa");
        }
      }

      if (w.grammar_anchor != null) {
        if (!GRAMMAR_IDS.has(w.grammar_anchor)) {
          err(where, `grammar_anchor "${w.grammar_anchor}" is not a topic in src/data/grammatik/`);
        }
      }
    }
  }
}

for (const w of warnings) console.warn(`warn  ${w}`);
for (const e of errors) console.error(`ERROR ${e}`);

console.log(`\n${total} words, ${seenUnits.size} units, ${errors.length} errors, ${warnings.length} warnings`);
console.log(`${sourced.ipa} with sourced ipa (${total - sourced.ipa} still unsourced), ${sourced.anchor} with grammar_anchor`);
if (errors.length) process.exit(1);

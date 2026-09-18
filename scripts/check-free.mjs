// Which candidate lemmas are still free, before a tranche is written.
//
//   node scripts/check-free.mjs Bündnis Konsulat aushandeln bilateral
//   node scripts/check-free.mjs --file data/incoming/b2-tranche-9.json
//
// Exists because of tranche-8: 26 of 125 picks collided with the bank, and every one of them
// was a word banked under a *different topic* than the one being written — `Gutachten` under
// `recht`, `Elternzeit` under `arbeit`, `Chor` under `freizeit`. Screening against the topic
// you are writing tells you nothing; the bank keys on `id`, which is `slugify(lemma)`, and
// `id` is the learner's localStorage progress key, so a collision is a merge refusal rather
// than a rename (see failure C and failure G in prompts/lexicon-entry-rubric.md).
//
// Case-folded on purpose: `slugify` lowercases, so `Schweigen` and `schweigen` are one id, and
// so are `Arm` and `arm`. A list scanned by eye misses exactly those.
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { slugify } from "../src/lib/audioSlug.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const LEVELS = ["a1", "a2", "b1", "b2", "c1", "c2"];

/** lemma → "a1-03" it is banked in, across every level file. */
const banked = new Map();
for (const level of LEVELS) {
  const file = path.join(ROOT, "src/content/lexicon", `${level}.json`);
  if (!existsSync(file)) continue;
  for (const unit of JSON.parse(readFileSync(file, "utf8")).units ?? []) {
    for (const word of unit.words ?? []) {
      banked.set(word.id ?? slugify(word.lemma), `${unit.id} ${word.lemma}`);
    }
  }
}

const args = process.argv.slice(2);
let candidates = args.filter((a) => !a.startsWith("--"));

const fileArg = args.indexOf("--file");
if (fileArg !== -1) {
  // A whole tranche, so the check can be repeated after edits without retyping the list.
  const tranche = JSON.parse(readFileSync(path.join(ROOT, args[fileArg + 1]), "utf8"));
  candidates = tranche.flatMap((u) => (u.words ?? []).map((w) => w.lemma));
}

if (candidates.length === 0) {
  console.error("usage: node scripts/check-free.mjs <lemma…> | --file <tranche.json>");
  process.exit(2);
}

const free = [];
const taken = [];
// Two candidates that collide with *each other* are as fatal as one that collides with the
// bank, and neither merge nor the validator will say which of the two it dropped.
const seen = new Map();
for (const lemma of candidates) {
  const id = slugify(lemma);
  if (seen.has(id)) taken.push(`${lemma} — duplicate of ${seen.get(id)} in this list`);
  else if (banked.has(id)) taken.push(`${lemma} — banked as ${banked.get(id)}`);
  else { free.push(lemma); seen.set(id, lemma); continue; }
  seen.set(id, lemma);
}

console.log(`${candidates.length} candidates · ${free.length} free · ${taken.length} taken\n`);
if (free.length) console.log("FREE\n  " + free.join(", ") + "\n");
if (taken.length) console.log("TAKEN\n  " + taken.join("\n  "));
process.exit(taken.length ? 1 : 0);

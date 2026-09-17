// Merges a generated tranche of units into a level file, without retyping anything that is
// already there. Safer than rewriting the level file wholesale: a transcription slip in an
// existing unit is exactly the kind of damage that is hard to notice and impossible to undo.
//
//   node scripts/merge-tranche.mjs b1 data/incoming/b1-tranche-1.json [--dry]
//
// Refuses to overwrite an existing unit id and refuses a lemma that already exists anywhere in
// the lexicon (a duplicate collides on `id`, which is the localStorage progress key).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { slugify } from "../src/lib/audioSlug.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const [level, tranchePath] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const DRY = process.argv.includes("--dry");
if (!level || !tranchePath) {
  console.error("usage: node scripts/merge-tranche.mjs <level> <tranche.json> [--dry]");
  process.exit(2);
}

const levelFile = path.join(ROOT, "src/content/lexicon", `${level}.json`);
if (!existsSync(levelFile)) {
  console.error(`no such level file: ${levelFile}`);
  process.exit(2);
}

const data = JSON.parse(readFileSync(levelFile, "utf8"));
const incoming = JSON.parse(readFileSync(path.join(ROOT, tranchePath), "utf8"));

// Every lemma and id already in the lexicon, across all six levels.
const existingLemmas = new Set();
const existingIds = new Set();
for (const l of ["a1", "a2", "b1", "b2", "c1", "c2"]) {
  const f = path.join(ROOT, "src/content/lexicon", `${l}.json`);
  if (!existsSync(f)) continue;
  const d = JSON.parse(readFileSync(f, "utf8"));
  for (const u of d.units ?? []) {
    for (const w of u.words ?? []) {
      existingLemmas.add(w.lemma);
      existingIds.add(w.id ?? slugify(w.lemma));
    }
  }
}
const existingUnits = new Set((data.units ?? []).map((u) => u.id));

const problems = [];
const accepted = [];
let words = 0;

for (const unit of incoming) {
  if (existingUnits.has(unit.id)) {
    problems.push(`unit ${unit.id} already exists — refusing to overwrite`);
    continue;
  }
  if (!unit.id || !unit.title || !Array.isArray(unit.topics) || !Array.isArray(unit.words)) {
    problems.push(`unit ${unit.id ?? "?"} is missing id/title/topics/words`);
    continue;
  }
  const keep = [];
  for (const w of unit.words) {
    const id = w.id ?? slugify(w.lemma ?? "");
    if (existingLemmas.has(w.lemma)) {
      problems.push(`${unit.id}/${w.lemma}: lemma already in the lexicon — skipped`);
      continue;
    }
    if (existingIds.has(id)) {
      problems.push(`${unit.id}/${w.lemma}: id "${id}" collides — skipped (give it an explicit unique id)`);
      continue;
    }
    existingLemmas.add(w.lemma);
    existingIds.add(id);
    keep.push(w);
    words++;
  }
  unit.words = keep;
  accepted.push(unit);
  existingUnits.add(unit.id);
}

for (const p of problems) console.warn(`warn  ${p}`);

data.units = [...(data.units ?? []), ...accepted].sort((a, b) => a.id.localeCompare(b.id));

if (!DRY) {
  writeFileSync(levelFile, JSON.stringify(data, null, 2) + "\n", "utf8");
}

const total = data.units.reduce((n, u) => n + u.words.length, 0);
console.log(
  `\n${level}: +${accepted.length} units, +${words} words  ->  ${data.units.length} units / ${total} words` +
    `  (${problems.length} skipped)${DRY ? "   [--dry: nothing written]" : ""}`
);

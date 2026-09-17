// Screens candidate lemmas against the whole lexicon before a tranche is written.
//
//   node scripts/check-lemmas.mjs "Kündigung,Betriebsrat,arm,schweigen"
//
// `merge-tranche.mjs` already refuses a duplicate at merge time, but by then the entry has
// been written, glossed and given an example sentence — the work is done and thrown away.
// This runs first and costs nothing.
//
// The check is **case-insensitive**, which is the whole point. `id` is `slugify(lemma)` and
// slugify lowercases, so the adjective `arm` collides with the noun `Arm`, and the verb
// `schweigen` with the noun `Schweigen`. Scanning an exclusion list by eye does not catch
// those, because the two spellings look different (rubric failure G). It also reports
// duplicates *within* the candidate list, which is how the same word twice in one tranche
// gets caught before the merge does it.
import { all } from "../src/lib/lexicon.js";

const taken = new Map();
for (const e of all()) taken.set(e.lemma.toLowerCase(), e.lemma);

const cands = (process.argv[2] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const bad = [];
const ok = [];
const seen = new Map();
for (const c of cands) {
  const k = c.toLowerCase();
  if (taken.has(k)) bad.push(`${c} <- ${taken.get(k)}`);
  else if (seen.has(k)) bad.push(`${c} <- dup in batch (${seen.get(k)})`);
  else { seen.set(k, c); ok.push(c); }
}

console.log(`TAKEN (${bad.length}): ${bad.join(" | ") || "—"}`);
console.log(`FREE (${ok.length})`);
if (process.argv.includes("--list")) console.log(ok.join(","));

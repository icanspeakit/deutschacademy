// Writes src/data/artikel-haeufigkeit.json: the corpus count behind every gendered noun
// that scripts/attach-ranks.mjs could rank. The Artikel-Trainer's "Nach Häufigkeit" view
// draws its coverage curve from these counts.
//   node scripts/artikel-haeufigkeit.mjs
//
// Why a file, and not the list at build time: the list lives in node_modules/.cache,
// which attach-ranks.mjs downloads and which a Vercel build does not have. The counts
// change only when the lexicon does, so they are written once and committed, like `rank`.
//
// Same source as `rank` (OpenSubtitles 2018, hermitdave/FrequencyWords, MIT) and the same
// limitation: it is a lowercased WORDFORM list. "bitte", "weg", "morgen" and "wissen"
// count their adverb and verb uses too, so the top of the curve is steeper than the nouns
// alone would make it. The order is the same one Wortschatz already uses. The share is an
// estimate, and the page labels it as one.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { nouns } from "../src/lib/lexicon.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = path.join(ROOT, "node_modules", ".cache", "de_50k.txt");
const OUT = path.join(ROOT, "src", "data", "artikel-haeufigkeit.json");

if (!existsSync(CACHE)) {
  console.error("Frequency list missing. Run `node scripts/attach-ranks.mjs` once to download it.");
  process.exit(1);
}

const counts = new Map();
for (const line of readFileSync(CACHE, "utf8").split("\n")) {
  const [word, n] = line.split(" ");
  if (word && !counts.has(word)) counts.set(word, Number(n));
}

const out = {};
let missing = 0;
for (const n of nouns({ level: ["A1", "A2", "B1", "B2"], has: "gender" })) {
  if (n.rank == null) continue;
  const c = counts.get(n.lemma.toLowerCase());
  if (c) out[n.id] = c;
  else missing++;
}

writeFileSync(OUT, JSON.stringify(out) + "\n", "utf8");
console.log(`${Object.keys(out).length} counts written to ${path.relative(ROOT, OUT)}${missing ? `, ${missing} ranked nouns without a count` : ""}.`);

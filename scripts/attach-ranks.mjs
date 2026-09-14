// Re-attaches corpus frequency ranks to src/content/lexicon/*.json in place.
//   node scripts/attach-ranks.mjs            # all levels
//   node scripts/attach-ranks.mjs a1 a2      # just these
//
// `rank` drives level banding and within-unit ordering and is never hand-typed — run this
// after adding words, then `node scripts/validate-lexicon.mjs`.
//
// Source: OpenSubtitles 2018 German list (hermitdave/FrequencyWords, MIT; data from the OPUS
// OpenSubtitles corpus). It is a WORDFORM list, so a lemma only matches when its citation
// form happens to appear — multi-word phrases and rarer compounds stay null, which is
// correct: a missing rank is honest, a guessed one is not.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const FREQ_URL = "https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/de/de_50k.txt";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const CACHE = path.join(ROOT, "node_modules", ".cache", "de_50k.txt");

const levels = process.argv.slice(2).length
  ? process.argv.slice(2).map((l) => l.toLowerCase())
  : ["a1", "a2", "b1", "b2", "c1", "c2"];

async function frequencyList() {
  if (!existsSync(CACHE)) {
    console.log(`Downloading ${FREQ_URL} …`);
    const res = await fetch(FREQ_URL);
    if (!res.ok) throw new Error(`Frequency list download failed: ${res.status} ${res.statusText}`);
    mkdirSync(path.dirname(CACHE), { recursive: true });
    writeFileSync(CACHE, await res.text(), "utf8");
  }
  const map = new Map();
  readFileSync(CACHE, "utf8")
    .split("\n")
    .forEach((line, i) => {
      const word = line.split(" ")[0];
      if (word && !map.has(word)) map.set(word, i + 1);
    });
  return map;
}

const freq = await frequencyList();

for (const level of levels) {
  const file = path.join(ROOT, "src/content/lexicon", `${level}.json`);
  if (!existsSync(file)) {
    console.warn(`skip ${level}: no such file`);
    continue;
  }
  const data = JSON.parse(readFileSync(file, "utf8"));

  let total = 0;
  let ranked = 0;
  for (const unit of data.units ?? []) {
    for (const word of unit.words ?? []) {
      total++;
      word.rank = freq.get(word.lemma.toLowerCase()) ?? null;
      if (word.rank) ranked++;
    }
  }

  if (!total) {
    console.log(`${level}: empty, nothing to rank`);
    continue;
  }
  writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log(`${level}: ${ranked}/${total} ranked (${Math.round((ranked / total) * 100)}%)`);
}

// Merge a TSV of translations into the sidecars in src/content/lexicon/i18n/.
//
//   node scripts/merge-translations.mjs ar  batch-01.tsv [batch-02.tsv ...]
//   node scripts/merge-translations.mjs all batch-01.tsv [batch-02.tsv ...]
//
// One language: the TSV is `id<TAB>translation`. `all`: it is `id<TAB>ar<TAB>ru<TAB>tr`,
// which is the shape a translation pass actually produces — you look a word up once and
// write all three, and splitting that into three files just invites them to drift apart.
// Blank lines and `#` comments are skipped, and a blank cell leaves that language alone.
// Re-running with the same id overwrites, so a correction is a one-line file.
//
// Every id is checked against the lexicon and an unknown one is reported and skipped
// rather than written. That check is the whole reason this is a script and not a text
// editor: a key the lexicon does not have produces no error at build time — the word just
// silently never gains a translation, the deck silently never gains its language tab, and
// nothing anywhere says why.
//
// Output is written sorted by id, so a diff shows the words that changed rather than the
// order they happened to arrive in.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { all } from "../src/lib/lexicon.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const LANGS = ["ar", "ru", "tr"];
const fileFor = (lang) => resolve(HERE, `../src/content/lexicon/i18n/${lang}.json`);

const [mode, ...files] = process.argv.slice(2);
const columns = mode === "all" ? LANGS : [mode];
if (!columns.every((l) => LANGS.includes(l)) || files.length === 0) {
  console.error(`usage: node scripts/merge-translations.mjs <${LANGS.join("|")}|all> <file.tsv> [...]`);
  process.exit(1);
}

const KNOWN = new Map(all().map((w) => [w.id, w]));
const tables = Object.fromEntries(columns.map((l) => [l, JSON.parse(readFileSync(fileFor(l), "utf8"))]));
const added = Object.fromEntries(columns.map((l) => [l, 0]));
const changed = Object.fromEntries(columns.map((l) => [l, 0]));
const unknown = [];

for (const file of files) {
  const text = readFileSync(resolve(process.cwd(), file), "utf8");
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith("#")) continue;
    const cells = line.split("\t");
    const id = cells[0].trim();
    if (!KNOWN.has(id)) { unknown.push(id); continue; }
    columns.forEach((lang, i) => {
      const value = (cells[i + 1] ?? "").trim();
      if (!value || tables[lang][id] === value) return;
      if (tables[lang][id] === undefined) added[lang]++; else changed[lang]++;
      tables[lang][id] = value;
    });
  }
}

for (const lang of columns) {
  const table = tables[lang];
  const sorted = Object.fromEntries(Object.keys(table).sort().map((k) => [k, table[k]]));
  writeFileSync(fileFor(lang), JSON.stringify(sorted, null, 2) + "\n", "utf8");
  const done = Object.keys(sorted).length;
  // What is still missing, by level, so the next batch has a target rather than a guess.
  const missing = {};
  for (const w of KNOWN.values()) if (!sorted[w.id]) missing[w.level] = (missing[w.level] ?? 0) + 1;
  const left = Object.entries(missing).map(([l, n]) => `${l} ${n}`).join(" · ");
  console.log(
    `${lang}: +${added[lang]} new, ${changed[lang]} changed → ${done}/${KNOWN.size}` +
      (left ? `  (offen: ${left})` : "  komplett.")
  );
}

if (unknown.length) console.warn(`skipped ${unknown.length} unknown id(s): ${unknown.slice(0, 10).join(", ")}`);

// Merges one language's grammar-rule translations into src/data/uebersetzungen/grammatik.json.
//
//   node scripts/merge-grammatik-hilfe.mjs <lang> <file.json>
//
// The file is `{ glossary: { term: translation }, entries: { id: { intro, qa: [...], note } } }`
// in ONE language — the shape a translator (or a drafting run) works in. The data file keeps
// the languages side by side per block, because that is how the page renders them.
//
// Checked on the way in, against the German it translates:
//   - the topic exists, and `qa` has exactly as many items as the topic's concept.qa —
//     a translation shifted by one item would sit under the wrong rule;
//   - every <em> of the German is still in the translation, character for character. The
//     <em>s are the German examples, and a translation that translated them has taken away
//     the thing being learned. Reported, not fixed: a person decides.
// Merging a language again marks every topic it touches as unreviewed.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const [lang, file] = process.argv.slice(2);
const LANGS = ["en", "ar", "uk", "tr"];
if (!LANGS.includes(lang) || !file) {
  console.error(`usage: node scripts/merge-grammatik-hilfe.mjs <${LANGS.join("|")}> <file.json>`);
  process.exit(1);
}

// The German each translation belongs to: the workspaces, plus the quiz-only topics'
// one-paragraph intro.
const german = {};
const wsDir = path.join(root, "src/data/grammatik");
for (const f of readdirSync(wsDir).filter((f) => f.endsWith(".json"))) {
  const w = JSON.parse(readFileSync(path.join(wsDir, f), "utf8"));
  german[w.id] = { intro: w.subtitle ?? null, qa: (w.concept?.qa ?? []).map((q) => q.html), note: w.concept?.noteHtml ?? null };
}
for (const t of JSON.parse(readFileSync(path.join(root, "src/data/grammatik.json"), "utf8"))) {
  if (!german[t.id] && t.id !== "akkusativ") german[t.id] = { intro: t.intro ?? null, qa: [], note: null };
}

const dataPath = path.join(root, "src/data/uebersetzungen/grammatik.json");
const data = JSON.parse(readFileSync(dataPath, "utf8"));
const input = JSON.parse(readFileSync(file, "utf8"));

const ems = (html) => [...String(html ?? "").matchAll(/<em>(.*?)<\/em>/g)].map((m) => m[1]);
let problems = 0;
const warn = (msg) => { problems++; console.log(`  ! ${msg}`); };
function checkEms(id, where, de, tr) {
  for (const em of ems(de)) if (!String(tr ?? "").includes(`<em>${em}</em>`)) warn(`${id} ${where}: <em>${em}</em> fehlt`);
}

let merged = 0;
for (const [id, e] of Object.entries(input.entries ?? {})) {
  const de = german[id];
  if (!de) { warn(`${id}: kein solches Thema — übersprungen`); continue; }
  if ((e.qa ?? []).length !== de.qa.length) { warn(`${id}: qa hat ${(e.qa ?? []).length} Einträge, Deutsch ${de.qa.length} — übersprungen`); continue; }

  const entry = (data.entries[id] ??= { reviewed: false, intro: null, qa: [], note: null });
  entry.reviewed = false;
  if (de.intro && e.intro) { entry.intro = { ...(entry.intro ?? {}), [lang]: e.intro }; checkEms(id, "intro", de.intro, e.intro); }
  entry.qa = de.qa.map((q, i) => {
    checkEms(id, `qa[${i}]`, q, e.qa[i]);
    return { ...(entry.qa?.[i] ?? {}), [lang]: e.qa[i] };
  });
  if (de.note && e.note) { entry.note = { ...(entry.note ?? {}), [lang]: e.note }; checkEms(id, "note", de.note, e.note); }
  merged++;
}

for (const [term, tr] of Object.entries(input.glossary ?? {})) {
  data.glossary[term] = { ...(data.glossary[term] ?? {}), [lang]: tr };
}
// Stable order, so a re-run is a readable diff.
data.entries = Object.fromEntries(Object.keys(data.entries).sort().map((k) => [k, data.entries[k]]));
data.glossary = Object.fromEntries(Object.keys(data.glossary).sort((a, b) => a.localeCompare(b, "de")).map((k) => [k, data.glossary[k]]));

writeFileSync(dataPath, JSON.stringify(data, null, 2) + "\n", "utf8");
const missing = Object.keys(german).filter((id) => !input.entries?.[id]);
console.log(`${lang}: ${merged} Themen übernommen, ${Object.keys(input.glossary ?? {}).length} Glossarbegriffe.`);
if (missing.length) console.log(`  fehlt in der Datei: ${missing.join(", ")}`);
console.log(problems ? `${problems} Hinweis(e) — bitte ansehen.` : "Keine Hinweise.");

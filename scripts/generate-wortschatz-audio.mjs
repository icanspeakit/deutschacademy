// Pronunciation MP3s for the whole lexicon — one file per word, played from the
// Wortschatz trainer's card face and Wortliste rows.
//
// Not scripts/generate-audio.mjs: that one voices the Aussprache-Training page from the
// old src/data/*.json silos, a curated 43-phrase set at full quality. This voices 4,000
// single words at speech-grade bitrate, writes the slug back into the lexicon, and has to
// survive being interrupted halfway through. Different job, different knobs.
//
//   ELEVENLABS_API_KEY=...  pnpm generate:wortschatz-audio
//   pnpm generate:wortschatz-audio --level a1      one level
//   pnpm generate:wortschatz-audio --level a1 --nouns   only the gendered nouns (the Artikel-Trainer's pool)
//   pnpm generate:wortschatz-audio --limit 20      a taste test before committing
//   pnpm generate:wortschatz-audio --dry-run       what it would cost, no API calls
//   pnpm generate:wortschatz-audio --stamp-only    re-sync the lexicon with the files on disk
//
// Resumable: a word whose file already exists is skipped, so an interrupted run is just
// re-run. Budget for the full lexicon is ~49,000 characters = ~49,000 credits on
// eleven_multilingual_v2, which one month of the Creator tier covers with room to spare.
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { all, spokenForm, LEVELS } from "../src/lib/lexicon.js";
import { slugify } from "../src/lib/audioSlug.js";

const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? null : argv[i + 1] ?? true;
};
const DRY_RUN = argv.includes("--dry-run");
// Re-sync the lexicon with whatever is on disk, without calling the API at all. For a
// run that was interrupted before it could stamp, and for files added by hand.
const STAMP_ONLY = argv.includes("--stamp-only");
const ONLY_LEVEL = flag("level")?.toUpperCase?.() ?? null;
const LIMIT = Number(flag("limit")) || null;
// Gendered nouns only — what the Artikel-Trainer draws from — so its audio can be bought a
// level at a time without spending the credits on the verbs and adjectives beside them.
const ONLY_NOUNS = argv.includes("--nouns");

const API_KEY = process.env.ELEVENLABS_API_KEY;
if (!API_KEY && !DRY_RUN && !STAMP_ONLY) {
  console.error("Missing ELEVENLABS_API_KEY. Add it to .env.local and re-run.");
  process.exit(1);
}

// Same voice as the Aussprache page unless overridden — one German voice across the site,
// so a word does not change speaker between two pages that both pronounce it.
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "EXAVITQu4vr4xnSDxMaL";
const MODEL_ID = process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2";
// 22 kHz / 32 kbps mono. The Aussprache files are the API default (44.1 kHz / 128 kbps)
// and average 19.7 KB each; at 4,000 words that is 79 MB in the repo for a single spoken
// word, which no learner can hear the benefit of. This is ~5 KB and ~20 MB all in.
const OUTPUT_FORMAT = process.env.ELEVENLABS_OUTPUT_FORMAT || "mp3_22050_32";
// Three at a time: the Starter plan's concurrency cap (Creator allows five). At four, a
// Starter run loses words to 429s faster than the retry below can back off.
const CONCURRENCY = Number(process.env.ELEVENLABS_CONCURRENCY) || 3;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "public", "audio", "wortschatz");
const lexiconDir = path.join(__dirname, "..", "src", "content", "lexicon");
mkdirSync(outDir, { recursive: true });

const rows = all()
  .filter((e) => (ONLY_LEVEL ? e.level === ONLY_LEVEL : true))
  .filter((e) => (ONLY_NOUNS ? e.pos === "noun" && e.gender : true));

/* Two words can share a slug — "der See" and "die See" both slugify to "see", and the
   lexicon carries both. The spoken text is what the file contains, so the text is what
   decides identity: same text, same file, generated once. A slug already claimed by a
   different text gets the id appended rather than quietly overwriting its neighbour. */
const byText = new Map();
const claimed = new Map();
const items = [];
for (const e of rows) {
  const text = spokenForm(e);
  if (byText.has(text)) {
    items.push({ ...byText.get(text), entry: e, duplicate: true });
    continue;
  }
  const base = slugify(text);
  if (!base) {
    console.warn(`Skipping "${e.lemma}" (${e.id}): empty slug.`);
    continue;
  }
  const slug = !claimed.has(base) || claimed.get(base) === text ? base : `${base}-${e.id}`;
  claimed.set(base, text);
  const item = { text, slug };
  byText.set(text, item);
  items.push({ ...item, entry: e });
}

const todo = items.filter((it) => !it.duplicate && !existsSync(path.join(outDir, `${it.slug}.mp3`)));
const capped = LIMIT ? todo.slice(0, LIMIT) : todo;
const chars = capped.reduce((s, it) => s + it.text.length, 0);

console.log(`${rows.length} words${ONLY_LEVEL ? ` in ${ONLY_LEVEL}` : ""} · ${items.length - todo.length} already voiced · ${capped.length} to generate`);
console.log(`${chars.toLocaleString("de-DE")} characters ≈ ${chars.toLocaleString("de-DE")} credits on ${MODEL_ID} (${OUTPUT_FORMAT})`);

if (DRY_RUN) {
  console.log("\nDry run — nothing generated, nothing written.");
  console.log(capped.slice(0, 10).map((it) => `  ${it.text} -> ${it.slug}.mp3`).join("\n"));
  process.exit(0);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateOne(text, attempt = 0) {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=${OUTPUT_FORMAT}`,
    {
      method: "POST",
      headers: { "xi-api-key": API_KEY, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({
        text,
        model_id: MODEL_ID,
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    }
  );
  // 429 is concurrency, not quota — back off and try again rather than losing the word.
  if (res.status === 429 && attempt < 4) {
    await sleep(1000 * 2 ** attempt);
    return generateOne(text, attempt + 1);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err = new Error(`ElevenLabs API error ${res.status}: ${body.slice(0, 300)}`);
    // Quota and plan errors end the run: every remaining word would fail the same way,
    // and 3,000 identical error lines buries the one that matters.
    if (res.status === 401 || res.status === 402 || body.includes("quota_exceeded")) err.fatal = true;
    throw err;
  }
  return Buffer.from(await res.arrayBuffer());
}

let generated = 0;
let failed = 0;
let stop = null;

async function worker(queue) {
  while (queue.length && !stop) {
    const it = queue.shift();
    try {
      writeFileSync(path.join(outDir, `${it.slug}.mp3`), await generateOne(it.text));
      generated++;
      if (generated % 25 === 0) console.log(`  ${generated}/${capped.length} …`);
    } catch (err) {
      failed++;
      console.error(`FAILED "${it.text}": ${err.message}`);
      if (err.fatal) stop = err;
    }
  }
}

const queue = STAMP_ONLY ? [] : capped.slice();
await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, () => worker(queue)));

/* Write the slug back into the level files, for every word that has a file on disk —
   including ones an earlier run made. The page renders a play button off this field, so
   a run that generated audio but did not record it would be invisible. Only the `audio`
   field is touched, and only when it changes. */
const itemByKey = new Map(items.map((it) => [`${it.entry.level}:${it.entry.id}`, it]));

let stamped = 0;
for (const level of LEVELS) {
  const file = path.join(lexiconDir, `${level.toLowerCase()}.json`);
  if (!existsSync(file)) continue;
  const json = JSON.parse(readFileSync(file, "utf8"));
  let dirty = false;
  for (const unit of json.units ?? []) {
    for (const word of unit.words ?? []) {
      const id = word.id ?? slugify(word.lemma);
      const item = itemByKey.get(`${level}:${id}`);
      if (!item) continue;
      const have = existsSync(path.join(outDir, `${item.slug}.mp3`));
      const next = have ? item.slug : null;
      if ((word.audio ?? null) === next) continue;
      if (next === null) delete word.audio;
      else word.audio = next;
      dirty = true;
      stamped++;
    }
  }
  if (dirty) writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`);
}

console.log(`\nGenerated ${generated}, failed ${failed}, stamped ${stamped} lexicon entries.`);
if (stop) {
  console.error(`\nStopped early: ${stop.message}`);
  console.error("Files already written are kept — fix the plan or key and re-run to continue.");
  process.exit(1);
}

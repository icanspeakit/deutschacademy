// Sentence audio for the Aussprache page (/uebungen/aussprache), in two parts:
//
//   saetze      the lexicon's example sentence for every word that already has word audio
//               ("Ich gehe morgen zum Arzt.") → public/audio/saetze/<slug>.mp3 — played by
//               the card's "Im Satz" switch, so the word is heard in a sentence, not only alone;
//   redemittel  src/data/redemittel.json (agreeing, disagreeing, doubting, consoling …)
//               → public/audio/redemittel/<slug>.mp3.
//
//   ELEVENLABS_API_KEY=...  node --env-file=.env.local scripts/generate-satz-audio.mjs
//   … --only redemittel | saetze      one part
//   … --dry-run                        what it would cost, no API calls
//
// Same voice, model and format as generate-wortschatz-audio.mjs, so a word and its
// sentence are one speaker. Resumable: a file that exists is skipped. The page finds the
// files on disk at build time (aussprache.astro), so nothing is stamped into the lexicon.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { select } from "../src/lib/lexicon.js";
import { satzSlug } from "../src/lib/audioSlug.js";
import redemittel from "../src/data/redemittel.json" with { type: "json" };

const argv = process.argv.slice(2);
const DRY_RUN = argv.includes("--dry-run");
const ONLY = argv.includes("--only") ? argv[argv.indexOf("--only") + 1] : null;
const API_KEY = process.env.ELEVENLABS_API_KEY;
if (!API_KEY && !DRY_RUN) {
  console.error("Missing ELEVENLABS_API_KEY. Run with --env-file=.env.local.");
  process.exit(1);
}
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "EXAVITQu4vr4xnSDxMaL";
const MODEL_ID = process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2";
const OUTPUT_FORMAT = process.env.ELEVENLABS_OUTPUT_FORMAT || "mp3_22050_32";
const CONCURRENCY = Number(process.env.ELEVENLABS_CONCURRENCY) || 3; // Starter plan cap

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dirOf = (part) => path.join(ROOT, "public", "audio", part);

const jobs = [];
// Redemittel first: they are the smaller set and the one a learner opens as sentences.
// A run that hits the quota should have spent it there, not on the tail of the examples.
if (!ONLY || ONLY === "redemittel") {
  for (const s of redemittel.sets) for (const p of s.phrases) jobs.push({ part: "redemittel", text: p.de, slug: satzSlug(p.de) });
}
if (!ONLY || ONLY === "saetze") {
  const seen = new Set();
  for (const e of select({ has: "audio" })) {
    if (!e.example || seen.has(e.example)) continue;
    seen.add(e.example);
    jobs.push({ part: "saetze", text: e.example, slug: satzSlug(e.example) });
  }
}

const todo = jobs.filter((j) => !existsSync(path.join(dirOf(j.part), `${j.slug}.mp3`)));
const chars = todo.reduce((n, j) => n + j.text.length, 0);
console.log(`${jobs.length} sentences · ${jobs.length - todo.length} already voiced · ${todo.length} to generate`);
console.log(`${chars.toLocaleString("de-DE")} characters ≈ credits on ${MODEL_ID} (${OUTPUT_FORMAT})`);
if (DRY_RUN) {
  console.log(todo.slice(0, 8).map((j) => `  [${j.part}] ${j.text} -> ${j.slug}.mp3`).join("\n"));
  process.exit(0);
}
for (const part of new Set(todo.map((j) => j.part))) mkdirSync(dirOf(part), { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function generateOne(text, attempt = 0) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=${OUTPUT_FORMAT}`, {
    method: "POST",
    headers: { "xi-api-key": API_KEY, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({ text, model_id: MODEL_ID, voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
  });
  if (res.status === 429 && attempt < 4) {
    await sleep(1000 * 2 ** attempt);
    return generateOne(text, attempt + 1);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err = new Error(`ElevenLabs API error ${res.status}: ${body.slice(0, 300)}`);
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
    const j = queue.shift();
    try {
      writeFileSync(path.join(dirOf(j.part), `${j.slug}.mp3`), await generateOne(j.text));
      if (++generated % 25 === 0) console.log(`  ${generated}/${todo.length} …`);
    } catch (err) {
      failed++;
      console.error(`FAILED "${j.text}": ${err.message}`);
      if (err.fatal) stop = err;
    }
  }
}
const queue = todo.slice();
await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, () => worker(queue)));
console.log(`\nGenerated ${generated}, failed ${failed}.`);
if (stop) {
  console.error(`Stopped early: ${stop.message}`);
  process.exit(1);
}

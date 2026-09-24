// Voices the Aktiv mode of every grammar topic — the Hörbeispiele, the minimal-pair
// sentences and both halves of each Sprechen drill item.
//
// Not scripts/generate-wortschatz-audio.mjs: that one voices 4,000 isolated words and
// stamps a slug back into the lexicon. This voices whole sentences inside a handful of
// topic files, and has one thing that one does not — two voices. A drill is a
// conversation: the prompt is asked in one voice, the model answer given in another, so
// the learner can hear whose turn it is without being told.
//
//   ELEVENLABS_API_KEY=...  pnpm generate:grammatik-audio
//   pnpm generate:grammatik-audio --topic adjektivdeklination    one topic
//   pnpm generate:grammatik-audio --except a,b                   leave these for later
//   pnpm generate:grammatik-audio --dry-run                      what it would cost
//   pnpm generate:grammatik-audio --stamp-only                   re-sync JSON with disk
//   pnpm generate:grammatik-audio --provider azure               Microsoft neural voices
//
// --provider azure uses the Azure Speech key that already runs the Aussprache-Check
// (AZURE_SPEECH_KEY / AZURE_SPEECH_REGION): Katja asks, Conrad answers. Its free tier is
// 0.5 M characters a month, so it voices the topics the ElevenLabs quota has not reached
// without touching that quota. Existing files are kept either way.
//
// Resumable: a line whose file already exists is skipped, so an interrupted run is just
// re-run. Budget is roughly 1,000 characters per topic — about 21,000 for all of them,
// which one Creator month covers alongside the wortschatz run with room to spare.
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { slugify } from "../src/lib/audioSlug.js";

const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? null : argv[i + 1] ?? true;
};
const DRY_RUN = argv.includes("--dry-run");
const STAMP_ONLY = argv.includes("--stamp-only");
const ONLY_TOPIC = flag("topic");
// Comma-separated topics to leave for a later run. The quota is monthly and the whole set
// does not always fit in what is left of it; holding the most expensive topics back is
// cheaper than a run that dies four files into topic nineteen.
const EXCEPT = new Set(String(flag("except") || "").split(",").filter(Boolean));

const AZURE = flag("provider") === "azure";
const API_KEY = process.env.ELEVENLABS_API_KEY;
const AZURE_KEY = process.env.AZURE_SPEECH_KEY;
const AZURE_REGION = process.env.AZURE_SPEECH_REGION;
if (!DRY_RUN && !STAMP_ONLY) {
  if (AZURE && (!AZURE_KEY || !AZURE_REGION)) {
    console.error("Missing AZURE_SPEECH_KEY / AZURE_SPEECH_REGION. Add them to .env.local and re-run.");
    process.exit(1);
  }
  if (!AZURE && !API_KEY) {
    console.error("Missing ELEVENLABS_API_KEY. Add it to .env.local and re-run.");
    process.exit(1);
  }
}

// Same default voice as the rest of the site, so a sentence does not change speaker
// between the Aussprache page and a grammar drill.
const VOICE_ID = AZURE
  ? process.env.AZURE_TTS_VOICE || "de-DE-KatjaNeural"
  : process.env.ELEVENLABS_VOICE_ID || "EXAVITQu4vr4xnSDxMaL";
// The drill's answering voice. Falls back to the main voice, which still works — you just
// lose the turn-taking cue, so set it before a real run.
const ANSWER_VOICE_ID = AZURE
  ? process.env.AZURE_TTS_ANSWER_VOICE || "de-DE-ConradNeural"
  : process.env.ELEVENLABS_ANSWER_VOICE_ID || VOICE_ID;
const MODEL_ID = process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2";
// Sentences, not single words, but the same speech-grade bitrate the wortschatz files use:
// ~5 KB a line, and nobody can hear the 128 kbps version of a four-word noun phrase.
const OUTPUT_FORMAT = process.env.ELEVENLABS_OUTPUT_FORMAT || "mp3_22050_32";
const CONCURRENCY = Number(process.env.ELEVENLABS_CONCURRENCY) || (AZURE ? 2 : 4);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "src", "data", "grammatik");
const audioRoot = path.join(__dirname, "..", "public", "audio", "grammatik");

/* ------------------------------------------------------------------ plan ---- */

/**
 * A readable file name that is still unique.
 *
 * Whole sentences slugify long — "Nachdem wir uns verabschiedet hatten, fuhr ich in die
 * Stadt" is already 64 characters — so the name has to be cut somewhere. Cutting alone is
 * not safe: two drill answers sharing a long opening would land on the same file and the
 * second would quietly overwrite the first, leaving one line playing the wrong audio with
 * nothing in the output to say so. Anything over the limit therefore keeps a short hash of
 * the FULL text, which collides only if the texts are identical — in which case sharing
 * the file is the right answer anyway.
 */
function fileStem(text) {
  const slug = slugify(text);
  if (slug.length <= 60) return slug;
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `${slug.slice(0, 51)}-${(h >>> 0).toString(36)}`;
}

/**
 * Every line one topic needs spoken, with where its file goes and which field in the
 * JSON has to point at it afterwards. Built before anything is called or written, so
 * --dry-run reports the true cost and a real run knows its whole shape up front.
 */
function planTopic(topic) {
  const lines = [];
  const a = topic.aktiv;
  if (!a) return lines;

  // The voice is part of the file's identity, not just its contents. "ein kleines Tier" is
  // a drill prompt in one round and a model answer in another, and those are two different
  // speakers; without the tag both roles resolve to one file, one of them is never
  // generated, and the drill loses the turn-taking it exists for. Twelve of the current
  // topics have at least one such line.
  // An Azure name ("de-DE-ConradNeural") shares its first six letters with every other
  // German voice, so it is tagged by the speaker's name instead.
  const tag = (voice) => {
    if (voice === VOICE_ID) return "";
    const azureName = voice.match(/^[a-z]{2}-[A-Z]{2}-(\w+?)Neural$/);
    return `--${(azureName ? azureName[1] : voice.slice(0, 6)).toLowerCase()}`;
  };
  const add = (text, voice, set) => {
    if (!text) return;
    lines.push({ text, voice, set, file: `${fileStem(text)}${tag(voice)}.mp3` });
  };

  (a.listen ?? []).forEach((it) => add(it.text, VOICE_ID, (p) => { it.audio = p; }));
  (a.hoeren?.items ?? []).forEach((it) => add(it.text, VOICE_ID, (p) => { it.audio = p; }));
  (a.sprechen?.rounds ?? []).forEach((round) => {
    (round.items ?? []).forEach((it) => {
      add(it.prompt, VOICE_ID, (p) => { it.audioPrompt = p; });
      add(it.answer, ANSWER_VOICE_ID, (p) => { it.audioAnswer = p; });
    });
  });

  // Two items in one topic can share a line — a drill's example answer often reappears as
  // the next round's prompt. Same text and same voice is the same file, generated once;
  // same text in the other voice is not, so the key carries both.
  const seen = new Map();
  for (const line of lines) {
    const key = `${line.voice}::${line.text}`;
    if (seen.has(key)) line.file = seen.get(key);
    else seen.set(key, line.file);
    line.url = `/audio/grammatik/${topic.id}/${line.file}`;
  }
  return lines;
}

/* ------------------------------------------------------------------- api ---- */

const xml = (t) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/* Same request and output as scripts/generate-aussprache-check-audio.mjs: a little under
   normal speed, because these are learners, and a small mono mp3. */
async function synthesiseAzure(text, voice) {
  const ssml = `<speak version="1.0" xml:lang="de-DE"><voice name="${voice}"><prosody rate="-8%">${xml(text)}</prosody></voice></speak>`;
  const res = await fetch(`https://${AZURE_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": AZURE_KEY,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
      "User-Agent": "deutschacademy-grammatik-audio",
    },
    body: ssml,
  });
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 3000));
    return synthesiseAzure(text, voice);
  }
  if (!res.ok) throw new Error(`Azure ${res.status} ${res.statusText} — ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

async function synthesise(text, voiceId) {
  if (AZURE) return synthesiseAzure(text, voiceId);
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=${OUTPUT_FORMAT}`,
    {
      method: "POST",
      headers: { "xi-api-key": API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ text, model_id: MODEL_ID }),
    }
  );
  // 429 is the Creator plan's concurrency limit, not a failure. Back off and retry rather
  // than abandoning a run that is 300 lines deep.
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 4000));
    return synthesise(text, voiceId);
  }
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

/* ------------------------------------------------------------------- run ---- */

const files = readdirSync(dataDir)
  .filter((f) => f.endsWith(".json"))
  .filter((f) => (ONLY_TOPIC ? f === `${ONLY_TOPIC}.json` : true))
  .filter((f) => !EXCEPT.has(f.replace(/\.json$/, "")));

let chars = 0;
let made = 0;
let skipped = 0;

for (const file of files) {
  const full = path.join(dataDir, file);
  const topic = JSON.parse(readFileSync(full, "utf8"));
  const lines = planTopic(topic);
  if (!lines.length) continue;

  const outDir = path.join(audioRoot, topic.id);
  // One topic, one pair of voices. A topic ElevenLabs already voiced keeps them: Azure
  // would otherwise add its own answer lines (their file names differ) and a drill would
  // switch speakers halfway. `.voice` marks a topic Azure started, so a resumed run
  // carries on with it.
  const marker = path.join(outDir, ".voice");
  const hasMp3 = existsSync(outDir) && readdirSync(outDir).some((f) => f.endsWith(".mp3"));
  const madeBy = existsSync(marker) ? readFileSync(marker, "utf8").trim() : hasMp3 ? "elevenlabs" : null;
  if (AZURE && madeBy === "elevenlabs") continue;
  if (!AZURE && madeBy === "azure") continue;
  if (!DRY_RUN) {
    mkdirSync(outDir, { recursive: true });
    if (!STAMP_ONLY && !madeBy) writeFileSync(marker, AZURE ? "azure" : "elevenlabs");
  }

  const todo = lines.filter((l) => !existsSync(path.join(outDir, l.file)));
  const unique = [...new Map(todo.map((l) => [l.file, l])).values()];
  chars += unique.reduce((n, l) => n + l.text.length, 0);

  if (DRY_RUN) {
    console.log(`${topic.id}: ${lines.length} lines, ${unique.length} to generate, ${unique.reduce((n, l) => n + l.text.length, 0)} chars`);
    continue;
  }

  if (!STAMP_ONLY) {
    for (let i = 0; i < unique.length; i += CONCURRENCY) {
      const batch = unique.slice(i, i + CONCURRENCY);
      await Promise.all(
        batch.map(async (line) => {
          const buf = await synthesise(line.text, line.voice);
          writeFileSync(path.join(outDir, line.file), buf);
          made += 1;
          process.stdout.write(`  ${topic.id}/${line.file}\n`);
        })
      );
    }
  }

  // Point the JSON at whatever is actually on disk. A line whose file is missing keeps no
  // `audio` key at all, so the player falls back to the browser voice for that one line
  // instead of requesting a 404 and going silent.
  let stamped = 0;
  for (const line of lines) {
    if (existsSync(path.join(outDir, line.file))) { line.set(line.url); stamped += 1; }
    else skipped += 1;
  }
  writeFileSync(full, JSON.stringify(topic, null, 2) + "\n");
  console.log(`${topic.id}: ${stamped}/${lines.length} lines stamped`);
}

if (DRY_RUN) console.log(`\nTotal: ${chars} characters ≈ ${chars} credits.`);
else console.log(`\nDone. ${made} files written, ${skipped} lines still without audio.`);

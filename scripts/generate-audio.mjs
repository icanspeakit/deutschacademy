// Generates pronunciation MP3s for the Aussprache-Training page from
// src/data/wortschatz.json and src/data/artikel.json via the ElevenLabs API.
// Requires ELEVENLABS_API_KEY (and optionally ELEVENLABS_VOICE_ID) in the
// environment. Re-run after adding new words/phrases:
//   pnpm generate:audio
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import wortschatz from "../src/data/wortschatz.json" with { type: "json" };
import artikel from "../src/data/artikel.json" with { type: "json" };
import { slugify } from "../src/lib/audioSlug.js";

const API_KEY = process.env.ELEVENLABS_API_KEY;
if (!API_KEY) {
  console.error("Missing ELEVENLABS_API_KEY. Add it to .env.local and re-run.");
  process.exit(1);
}

// Default: "Bella" (multilingual, well-suited to German via eleven_multilingual_v2).
// Override with ELEVENLABS_VOICE_ID if you prefer a different voice from your library.
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "EXAVITQu4vr4xnSDxMaL";
const MODEL_ID = "eleven_multilingual_v2";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "public", "audio", "aussprache");
mkdirSync(outDir, { recursive: true });

const items = [
  ...wortschatz.map((w) => ({ text: w.front, group: "wortschatz" })),
  ...artikel.map((a) => ({ text: `${a.gender} ${a.word}`, group: "artikel" })),
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateOne(text) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
    method: "POST",
    headers: {
      "xi-api-key": API_KEY,
      "Content-Type": "application/json",
      "Accept": "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: MODEL_ID,
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 402 || body.includes("paid_plan_required")) {
      const err = new Error("ElevenLabs: this voice requires a paid plan (Free tier can preview Voice Library voices but not call them via the API).");
      err.code = "PAID_PLAN_REQUIRED";
      throw err;
    }
    throw new Error(`ElevenLabs API error ${res.status}: ${body.slice(0, 300)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

console.log(`Using voice ${VOICE_ID} (model ${MODEL_ID}). ${items.length} items to check.`);

let generated = 0;
let skipped = 0;

for (const item of items) {
  const slug = slugify(item.text);
  if (!slug) {
    console.warn(`Skipping item with empty slug: "${item.text}"`);
    continue;
  }
  const outPath = path.join(outDir, `${slug}.mp3`);
  if (existsSync(outPath)) {
    skipped++;
    continue;
  }
  process.stdout.write(`Generating "${item.text}" -> ${slug}.mp3 ... `);
  try {
    const audio = await generateOne(item.text);
    writeFileSync(outPath, audio);
    console.log("done");
    generated++;
  } catch (err) {
    console.log("FAILED");
    console.error(err.message);
    if (err.code === "PAID_PLAN_REQUIRED") {
      console.error("\nUpgrade the ElevenLabs account to at least the Starter plan ($5/mo), then re-run `pnpm generate:audio`.");
      process.exit(1);
    }
  }
  await sleep(300);
}

console.log(`\nGenerated ${generated} file(s), skipped ${skipped} existing file(s).`);

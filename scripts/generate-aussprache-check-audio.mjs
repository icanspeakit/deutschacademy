// Voices the reference sentences of /uebungen/aussprache-check with Azure's German neural
// voice and stamps `audio: true` on each sentence that has a file.
//
// Azure rather than ElevenLabs: the same key already runs the assessment, the free tier
// (0.5 M characters a month) covers these ~900 characters many times over, and the
// ElevenLabs credits are spoken for by the lexicon (see scripts/generate-wortschatz-audio.mjs).
// The word you tap on the page is spoken by the same voice, so the two match.
//
//   node --env-file=.env.local scripts/generate-aussprache-check-audio.mjs [--force] [--dry-run]
//
// Resumable: an existing file is kept unless --force.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const KEY = process.env.AZURE_SPEECH_KEY;
// Same two ways to say where the key lives as src/lib/pronunciation/azure.server.ts:
// a Foundry / multi-service endpoint (its token names the region), or a plain region.
const ENDPOINT = process.env.AZURE_SPEECH_ENDPOINT;
const REGION_ENV = process.env.AZURE_SPEECH_REGION;
const VOICE = process.env.AZURE_TTS_VOICE || "de-DE-KatjaNeural";
const force = process.argv.includes("--force");
const dryRun = process.argv.includes("--dry-run");

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataPath = path.join(root, "src", "data", "aussprache-check.json");
const outDir = path.join(root, "public", "audio", "aussprache-check");
const data = JSON.parse(readFileSync(dataPath, "utf8"));
const sentences = data.levels.flatMap((l) => l.sentences);

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const todo = sentences.filter((s) => force || !existsSync(path.join(outDir, `${s.id}.mp3`)));
const chars = todo.reduce((n, s) => n + s.text.length, 0);
console.log(`${todo.length} of ${sentences.length} sentences to voice, ${chars} characters, voice ${VOICE}.`);

if (!dryRun && todo.length) {
  if (!KEY || (!ENDPOINT && !REGION_ENV)) {
    console.error("AZURE_SPEECH_KEY and AZURE_SPEECH_ENDPOINT (or AZURE_SPEECH_REGION) must be set (e.g. in .env.local).");
    process.exit(1);
  }
  // One STS token for the whole run (valid 10 minutes); it also tells us the region.
  const sts = ENDPOINT
    ? `${new URL(ENDPOINT).origin}/sts/v1.0/issueToken`
    : `https://${REGION_ENV}.api.cognitive.microsoft.com/sts/v1.0/issueToken`;
  const tokRes = await fetch(sts, { method: "POST", headers: { "Ocp-Apim-Subscription-Key": KEY, "Content-Length": "0" } });
  if (!tokRes.ok) {
    console.error(`Azure STS answered ${tokRes.status}.`);
    process.exit(1);
  }
  const token = await tokRes.text();
  let REGION = REGION_ENV;
  if (!REGION) {
    try { REGION = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8")).region; } catch {}
  }
  if (!REGION) {
    console.error("No region: set AZURE_SPEECH_REGION, the token did not name one.");
    process.exit(1);
  }
  mkdirSync(outDir, { recursive: true });
  for (const s of todo) {
    const ssml = `<speak version="1.0" xml:lang="de-DE"><voice name="${VOICE}"><prosody rate="-8%">${esc(s.text)}</prosody></voice></speak>`;
    const res = await fetch(`https://${REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
        "User-Agent": "deutschacademy-aussprache-check",
      },
      body: ssml,
    });
    if (!res.ok) {
      console.error(`✗ ${s.id}: Azure answered ${res.status}`);
      process.exitCode = 1;
      continue;
    }
    writeFileSync(path.join(outDir, `${s.id}.mp3`), Buffer.from(await res.arrayBuffer()));
    console.log(`✓ ${s.id}`);
  }
}

// Stamp from what is on disk, so the flag never claims a file that is not there.
let changed = 0;
for (const s of sentences) {
  const has = existsSync(path.join(outDir, `${s.id}.mp3`));
  if (Boolean(s.audio) !== has) {
    if (has) s.audio = true; else delete s.audio;
    changed++;
  }
}
if (changed && !dryRun) writeFileSync(dataPath, JSON.stringify(data, null, 2) + "\n");
console.log(`${changed} audio flag(s) updated.`);

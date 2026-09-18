// Renders the Hörverstehen clips in src/data/hoeren.json to public/audio/hoeren/<id>.mp3.
//
// Why this is a second script rather than a flag on generate-audio.mjs: that one voices
// single words with one voice and names the file after the word. A Hörtext is a sequence
// of turns, each turn belongs to a different speaker, and the file is named after the text.
// The two share only the API call.
//
// Each turn is rendered on its own with that speaker's voice, then the turns are joined
// with a short silence — which is what makes a dialogue sound like two people rather than
// one person reading a script. Joining is done by ffmpeg's concat demuxer with `-c copy`:
// every clip comes back from ElevenLabs in the same format, so there is nothing to
// re-encode and nothing to lose.
//
//   pnpm generate:hoeren            # only texts that have no mp3 yet
//   pnpm generate:hoeren -- --force # re-render everything
//   pnpm generate:hoeren -- --only b1-krankmeldung
//   pnpm generate:hoeren -- --dry   # no API calls: print what it would cost
//
// Requires ELEVENLABS_API_KEY in .env.local and ffmpeg on PATH.
import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import hoeren from "../src/data/hoeren.json" with { type: "json" };

const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const DRY = args.includes("--dry");
const ONLY = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;

const MODEL_ID = process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2";
const API_KEY = process.env.ELEVENLABS_API_KEY;

// The pause between two turns. Long enough to hear the speaker change, short enough that
// a four-turn Ansage does not feel padded.
const GAP_SECONDS = 0.45;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "public", "audio", "hoeren");

const texts = hoeren.texts.filter((t) => !ONLY || t.id === ONLY);
if (ONLY && !texts.length) {
  console.error(`No Hörtext with id "${ONLY}". Known ids:\n  ${hoeren.texts.map((t) => t.id).join("\n  ")}`);
  process.exit(1);
}

const pending = texts.filter((t) => FORCE || !existsSync(path.join(outDir, `${t.id}.mp3`)));
const chars = pending.reduce((n, t) => n + t.script.reduce((m, s) => m + s.text.length, 0), 0);

console.log(`${texts.length} Hörtext(e), ${pending.length} zu rendern, ${chars} Zeichen (= ElevenLabs credits).`);
if (DRY) {
  for (const t of pending) {
    const c = t.script.reduce((m, s) => m + s.text.length, 0);
    console.log(`  ${t.id.padEnd(30)} ${String(t.script.length).padStart(2)} Turns  ${String(c).padStart(5)} Zeichen`);
  }
  process.exit(0);
}
if (!pending.length) {
  console.log("Nichts zu tun. --force rendert alles neu.");
  process.exit(0);
}
if (!API_KEY) {
  console.error("Missing ELEVENLABS_API_KEY. Add it to .env.local and re-run.");
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });

function ffmpeg(cliArgs) {
  return execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...cliArgs]);
}

function seconds(file) {
  const out = execFileSync("ffprobe", [
    "-v", "error", "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1", file,
  ]).toString().trim();
  return Math.round(parseFloat(out));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function renderTurn(text, voiceId) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: { "xi-api-key": API_KEY, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({
      text,
      model_id: MODEL_ID,
      // Higher stability than the word trainer uses: a Durchsage that wobbles between
      // takes sounds like a different station every sentence.
      voice_settings: { stability: 0.65, similarity_boost: 0.75, style: 0.0, use_speaker_boost: true },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 402 || body.includes("paid_plan_required")) {
      const err = new Error("ElevenLabs: this voice requires a paid plan.");
      err.code = "PAID_PLAN_REQUIRED";
      throw err;
    }
    throw new Error(`ElevenLabs API error ${res.status}: ${body.slice(0, 300)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

const tmp = path.join(os.tmpdir(), `da-hoeren-${process.pid}`);
mkdirSync(tmp, { recursive: true });

// One silence clip, reused between every pair of turns.
const silence = path.join(tmp, "gap.mp3");
ffmpeg(["-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", String(GAP_SECONDS), "-b:a", "128k", silence]);

const durations = existsSync(path.join(outDir, "manifest.json"))
  ? JSON.parse(readFileSync(path.join(outDir, "manifest.json"), "utf8"))
  : {};

let done = 0;
try {
  for (const text of pending) {
    process.stdout.write(`${text.id} (${text.script.length} Turns) `);
    const parts = [];
    for (const [i, turn] of text.script.entries()) {
      const voice = hoeren.voices[turn.speaker];
      if (!voice) throw new Error(`${text.id}: unbekannter Sprecher "${turn.speaker}"`);
      const file = path.join(tmp, `${text.id}-${String(i).padStart(2, "0")}.mp3`);
      writeFileSync(file, await renderTurn(turn.text, voice.id));
      parts.push(file);
      process.stdout.write(".");
      await sleep(250);
    }

    // The concat demuxer wants a file of `file '<path>'` lines, with single quotes escaped.
    const listFile = path.join(tmp, `${text.id}.txt`);
    const withGaps = parts.flatMap((p, i) => (i ? [silence, p] : [p]));
    writeFileSync(listFile, withGaps.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n"));

    const outPath = path.join(outDir, `${text.id}.mp3`);
    ffmpeg(["-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", outPath]);
    durations[text.id] = seconds(outPath);
    console.log(` ✓ ${durations[text.id]}s`);
    done++;
  }
} catch (err) {
  console.log(" FEHLER");
  console.error(err.message);
  if (err.code === "PAID_PLAN_REQUIRED") {
    console.error("\nUpgrade the ElevenLabs account to at least the Starter plan, then re-run.");
  }
  process.exitCode = 1;
} finally {
  // The durations the page shows come from the real files, so a partial run still tells
  // the truth about the clips it did finish.
  writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(durations, null, 2) + "\n");
  rmSync(tmp, { recursive: true, force: true });
}

console.log(`\n${done} Hörtext(e) gerendert nach public/audio/hoeren/.`);

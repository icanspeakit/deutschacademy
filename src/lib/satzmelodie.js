// Satzmelodie for the Aussprache-Check: how close the learner's pitch contour is to the
// reference recording. Azure's prosody score is English-only, so the German card said
// "Nicht bewertet"; this fills it, entirely in the browser — no upload, no API cost.
//
//   1. Pitch (F0) every 10 ms with pitchy's McLeod detector. Frames that are quiet or not
//      clearly periodic (consonants, breath, silence) are dropped, not guessed.
//   2. Each speaker in semitones around their OWN median pitch. A man and the female
//      reference voice then line up: melody is the shape, not the height.
//   3. Dynamic time warping, so speaking slower or pausing is not punished — only a
//      different up-and-down is.
//   4. The SHAPE is compared, not the size: each contour is divided by its own spread, so a
//      calm native speaker who moves 3 semitones is not marked down against a lively TTS
//      voice that moves 8. Size only counts where it stops being melody: a voice that
//      barely moves at all (monotone).
//   5. The ending is checked on its own, by sentence type: a statement or W-question must not
//      end rising, a yes/no question must. That is the part a listener actually hears.
//   6. Mean aligned distance → 0–100, capped by 4. and 5.; the biggest mismatch becomes a
//      tip in plain German.
//
// The first version compared absolute semitones and was calibrated TTS against TTS; a
// native speaker on a real mic scored around 50, because a calmer voice with the right
// melody looked as different as another sentence. See the calibration note at toScore.
import { PitchDetector } from "pitchy";

const HOP_S = 0.01;          // 10 ms between frames
const WIN = 2048;            // ~43 ms at 48 kHz: long enough for a low male voice
const MIN_HZ = 60;
const MAX_HZ = 500;
const MIN_CLARITY = 0.85;
const W_WORDS = /^(wer|wen|wem|wessen|was|wann|wo|wohin|woher|wie|warum|wieso|weshalb|welche[rsmn]?|wieviel|wie viel)$/i;

/** "ja-nein" (voice goes up), "w-frage" and "aussage" (voice goes down). */
export function melodyType(text) {
  const t = text.trim();
  if (!t.endsWith("?")) return "aussage";
  const first = t.split(/\s+/)[0].replace(/[^\p{L}]/gu, "");
  return W_WORDS.test(first) ? "w-frage" : "ja-nein";
}

// Loudness gates, relative to the take's own loudest frame, so they behave the same on a
// quiet laptop mic and a loud headset. Room hum, a fan or the tail after the last word can
// be periodic enough to pass the clarity test, but it is far quieter than speech.
const GATE_DB = -28;   // a voiced frame must be within 28 dB of the loudest one
const TRIM_DB = -20;   // the take is trimmed to the first/last frame within 20 dB

/** Mono Float32 samples → [{ t, hz }] for voiced frames only. */
export function pitchContour(samples, sampleRate) {
  const hop = Math.round(sampleRate * HOP_S);
  const detector = PitchDetector.forFloat32Array(WIN);
  detector.minVolumeDecibels = -45;
  const frame = new Float32Array(WIN);
  const frames = [];
  let peak = 0;
  for (let i = 0; i + WIN <= samples.length; i += hop) {
    frame.set(samples.subarray(i, i + WIN));
    let e = 0;
    for (let k = 0; k < WIN; k++) e += frame[k] * frame[k];
    const rms = Math.sqrt(e / WIN);
    if (rms > peak) peak = rms;
    const [hz, clarity] = detector.findPitch(frame, sampleRate);
    frames.push({ t: i / sampleRate, hz, clarity, rms });
  }
  if (!peak) return [];
  const gate = peak * 10 ** (GATE_DB / 20), trim = peak * 10 ** (TRIM_DB / 20);
  const first = frames.findIndex((f) => f.rms >= trim);
  let last = frames.length - 1;
  while (last > first && frames[last].rms < trim) last--;
  const out = [];
  for (let i = Math.max(0, first); i <= last; i++) {
    const f = frames[i];
    if (f.rms >= gate && f.clarity >= MIN_CLARITY && f.hz >= MIN_HZ && f.hz <= MAX_HZ) out.push({ t: f.t, hz: f.hz });
  }
  return smooth(out);
}

// Median of 5 over neighbouring voiced frames: removes octave jumps and single-frame spikes
// without flattening the real movement.
function smooth(points) {
  return points.map((p, i) => {
    const win = points.slice(Math.max(0, i - 2), i + 3).map((q) => q.hz).sort((a, b) => a - b);
    return { t: p.t, hz: win[Math.floor(win.length / 2)] };
  });
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

/** Contour → semitones around the speaker's median, time from 0 (first voiced frame). */
export function normalise(points) {
  if (points.length < 8) return [];
  const med = median(points.map((p) => p.hz));
  const t0 = points[0].t;
  const dur = points[points.length - 1].t - t0 || 1;
  return points.map((p) => ({ x: (p.t - t0) / dur, st: 12 * Math.log2(p.hz / med) }));
}

/** Every other frame is plenty for a sentence and keeps DTW at a few ms. */
const thin = (xs, max = 220) => (xs.length <= max ? xs : xs.filter((_, i) => i % Math.ceil(xs.length / max) === 0));

/**
 * DTW over semitone values with a Sakoe-Chiba band. Returns the mean distance along the
 * path and the path itself (pairs of indices), which the tip uses to find the mismatch.
 */
function dtw(a, b) {
  const n = a.length, m = b.length;
  const band = Math.max(Math.abs(n - m), Math.ceil(Math.max(n, m) * 0.25));
  const INF = 1e9;
  const D = Array.from({ length: n + 1 }, () => new Float64Array(m + 1).fill(INF));
  D[0][0] = 0;
  for (let i = 1; i <= n; i++) {
    const jFrom = Math.max(1, Math.round((i * m) / n) - band);
    const jTo = Math.min(m, Math.round((i * m) / n) + band);
    for (let j = jFrom; j <= jTo; j++) {
      const c = Math.abs(a[i - 1].st - b[j - 1].st);
      D[i][j] = c + Math.min(D[i - 1][j], D[i][j - 1], D[i - 1][j - 1]);
    }
  }
  const path = [];
  let i = n, j = m;
  while (i > 0 && j > 0) {
    path.push([i - 1, j - 1]);
    const diag = D[i - 1][j - 1], up = D[i - 1][j], left = D[i][j - 1];
    if (diag <= up && diag <= left) { i--; j--; } else if (up < left) i--; else j--;
  }
  path.reverse();
  return { cost: D[n][m] / path.length, path };
}

// Mean distance between the two SHAPES (each contour in units of its own spread) → 0–100.
// Calibrated on every reference recording against copies of itself as a real speaker
// differs from it (5 semitones lower, faster or slower, room noise and a hum tail, half the
// pitch range) and against wrong melodies (inverted, flattened, another sentence). The
// numbers are in the note under compareMelody.
// 1.17 = 0.9 × 1.3: made 30 % more forgiving at the user's request (the exponent shrinks by 30 %).
const SHAPE_K = 1.17;
const toScore = (cost) => Math.max(0, Math.min(100, Math.round(100 * Math.exp(-cost / SHAPE_K))));
// Below this spread (semitones) a voice is not calm any more, it is flat: the melody is gone.
const MONOTONE_ST = 1.0;
// How far the ending has to move to count as a rise (semitones).
const END_ST = 1.0;

const meanOf = (pts, from, to) => {
  const xs = pts.filter((p) => p.x >= from && p.x <= to).map((p) => p.st);
  return xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : 0;
};
const spread = (pts) => {
  const xs = pts.map((p) => p.st);
  const m = xs.reduce((s, v) => s + v, 0) / (xs.length || 1);
  return Math.sqrt(xs.reduce((s, v) => s + (v - m) ** 2, 0) / (xs.length || 1));
};

/** Which written word sits at a relative position of the sentence (by letters). */
function wordAt(text, x) {
  const words = text.split(/\s+/).filter(Boolean);
  const lens = words.map((w) => w.replace(/[^\p{L}]/gu, "").length || 1);
  const total = lens.reduce((s, v) => s + v, 0);
  let acc = 0;
  for (let k = 0; k < words.length; k++) {
    acc += lens[k];
    if (acc / total >= x) return words[k].replace(/[^\p{L}-]/gu, "");
  }
  return words[words.length - 1].replace(/[^\p{L}-]/gu, "");
}

/**
 * Compare two normalised contours. `sentence` is { text, stress? } — `stress` maps a word
 * to its spoken stress pattern ("Brötchen": "BRÖT-chen") for the stress tip.
 */
export function compareMelody(ref, you, sentence) {
  if (ref.length < 8 || you.length < 8) return null;
  const type = melodyType(sentence.text);
  const refSpread = spread(ref), youSpread = spread(you);

  // The shapes: each contour divided by its own spread (never by less than a semitone, so
  // a flat take is not blown up into a lively one).
  const shape = (pts, sd) => pts.map((p) => ({ ...p, st: p.st / Math.max(sd, 1) }));
  const a = thin(shape(ref, refSpread)), b = thin(shape(you, youSpread));
  const { cost, path } = dtw(a, b);
  let score = toScore(cost);

  // Ending: the last fifth against the fifth before it, in semitones.
  const endMove = (pts) => meanOf(pts, 0.8, 1) - meanOf(pts, 0.55, 0.8);
  const refEnd = endMove(ref), youEnd = endMove(you);
  // Real voices often go creaky on the last syllable, and the detector then drops those
  // frames or halves their pitch — so the ending is only judged when both windows hold
  // enough voiced frames, and only a clear miss counts.
  const enough = (pts) => pts.filter((p) => p.x >= 0.8).length >= 5 && pts.filter((p) => p.x >= 0.55 && p.x < 0.8).length >= 5;
  // What a listener hears: a statement or W-question that ends clearly rising sounds like
  // a yes/no question, and a yes/no question that falls sounds like a statement. A smaller
  // rise or fall than the model's is still right.
  const endingWrong = enough(you) && (type === "ja-nein"
    ? refEnd > END_ST * 2 && youEnd < 0
    : refEnd < END_ST && youEnd > END_ST * 2);
  const monotone = youSpread < MONOTONE_ST && refSpread >= MONOTONE_ST * 2;
  if (endingWrong) score = Math.min(score, 72);
  if (monotone) score = Math.min(score, 72);

  let tip = null;
  // A take this close needs no correction: a different speaker legitimately rises a
  // little less or later than the model, and a tip would nag about it.
  if (score >= 75) return { score, cost, tip, type };
  if (type === "ja-nein" && endingWrong) {
    tip = "Bei Ja/Nein-Fragen geht die Stimme am Ende nach oben. Heb die Stimme beim letzten Wort.";
  } else if ((type === "aussage" || type === "w-frage") && endingWrong) {
    tip = type === "w-frage"
      ? "Bei W-Fragen geht die Stimme am Ende nach unten — wie bei einem normalen Satz."
      : "Bei Aussagesätzen geht die Stimme am Ende nach unten. Sonst klingt der Satz wie eine Frage.";
  } else if (monotone) {
    tip = "Deine Stimme ist sehr gleichmäßig. Geh beim wichtigsten Wort ruhig deutlich höher — Deutsch darf lebendig klingen.";
  } else {
    // The single worst stretch of the aligned path, mapped back to a word.
    let worst = 0, at = 0;
    for (const [i, j] of path) {
      const d = Math.abs(a[i].st - b[j].st);
      if (d > worst) { worst = d; at = a[i].x; }
    }
    // In shape units: more than about two spreads apart at one point.
    if (worst > 2) {
      const word = wordAt(sentence.text, at);
      const pattern = sentence.stress?.[word];
      tip = pattern
        ? `Achte auf die Betonung: ${pattern}. Bei „${word}“ bewegt sich die Stimme im Vorbild anders als bei dir.`
        : `Hör dir „${word}“ im Vorbild noch einmal an: Dort macht die Stimme eine andere Bewegung als bei dir.`;
    }
  }
  return { score, cost, tip, type };
}

// CALIBRATION (all 26 references, median score; strict first version in brackets):
//   same melody, 5 semitones lower ............... 93  (90)
//   same, half the pitch range (a calm voice) .... 92  (67)  <- the native-speaker case
//   same, slower / with room noise and hum tail .. 93-94
//   flattened to 15% of the range (monotone) ..... 72  (52)
//   another sentence's melody .................... 71  (66)
//   inverted melody .............................. 53  (39)
//   a second TTS voice (Conrad), the question .... 81  (72); read as a statement: 64 (50)

/** Decode audio (Blob or ArrayBuffer) to mono samples. */
export async function decodeToMono(data) {
  const buf = data instanceof Blob ? await data.arrayBuffer() : data;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ctx = new Ctx();
  try {
    const audio = await ctx.decodeAudioData(buf.slice(0));
    const ch = audio.getChannelData(0);
    if (audio.numberOfChannels === 1) return { samples: ch, sampleRate: audio.sampleRate };
    const mix = new Float32Array(ch.length);
    for (let c = 0; c < audio.numberOfChannels; c++) {
      const d = audio.getChannelData(c);
      for (let i = 0; i < d.length; i++) mix[i] += d[i] / audio.numberOfChannels;
    }
    return { samples: mix, sampleRate: audio.sampleRate };
  } finally {
    ctx.close?.();
  }
}

// The reference contour per sentence, computed once per visit.
const refCache = new Map();
export async function referenceMelody(sentence) {
  if (!sentence.audio) return null;
  if (!refCache.has(sentence.id)) {
    refCache.set(sentence.id, (async () => {
      const res = await fetch(`/audio/aussprache-check/${sentence.id}.mp3`);
      if (!res.ok) return null;
      const { samples, sampleRate } = await decodeToMono(await res.arrayBuffer());
      return normalise(pitchContour(samples, sampleRate));
    })().catch(() => null));
  }
  return refCache.get(sentence.id);
}

/** Recording (Blob) → normalised contour. */
export async function learnerMelody(blob) {
  const { samples, sampleRate } = await decodeToMono(blob);
  return normalise(pitchContour(samples, sampleRate));
}

/** Two contours as a small SVG: x = relative time, y = semitones (clamped ±9). */
export function melodyChart(ref, you) {
  const W = 320, H = 120, P = 8;
  const y = (st) => P + (H - 2 * P) * (1 - (Math.max(-9, Math.min(9, st)) + 9) / 18);
  const x = (v) => P + (W - 2 * P) * v;
  const line = (pts) => thin(pts, 160).map((p, i) => `${i ? "L" : "M"}${x(p.x).toFixed(1)} ${y(p.st).toFixed(1)}`).join(" ");
  return `<svg class="ac-mel-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Tonhöhenverlauf: Vorbild und deine Aufnahme" preserveAspectRatio="none">
    <line x1="${P}" x2="${W - P}" y1="${y(0)}" y2="${y(0)}" class="ac-mel-mid" />
    <path d="${line(ref)}" class="ac-mel-ref" />
    <path d="${line(you)}" class="ac-mel-you" />
  </svg>`;
}

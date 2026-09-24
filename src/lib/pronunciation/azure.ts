// Azure Speech, browser half: pronunciation assessment and the neural voice, behind the
// provider-neutral interface in ./types.ts. Everything Azure-specific in the browser is in
// this file — the SDK, the token format, the result JSON and its error names.
//
// The Speech SDK is ~1 MB, so it is imported the first time it is needed (a recording or a
// tapped word), never on page load. Credentials come from /api/speech-token (see
// ./azure.server.ts), which keeps the subscription key on the server; the token is cached
// here until shortly before it expires.
import {
  PronunciationError,
  type Assessment,
  type AssessedWord,
  type AssessOptions,
  type PronunciationProvider,
  type SpeakOptions,
  type WordError,
} from "./types";

const TOKEN_URL = "/api/speech-token";
const VOICE: Record<string, string> = { "de-DE": "de-DE-KatjaNeural" };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sdk = any;

/* ------------------------------------------------------------------ token ---- */
let tokenCache: { token: string; region: string; until: number } | null = null;

async function getToken({ force = false } = {}) {
  if (!force && tokenCache && tokenCache.until > Date.now()) return tokenCache;
  let res: Response;
  try {
    res = await fetch(TOKEN_URL, { credentials: "same-origin", cache: "no-store" });
  } catch {
    throw new PronunciationError("token");
  }
  if (res.status === 401) throw new PronunciationError("auth");
  if (res.status === 429) throw new PronunciationError("rate");
  if (res.status === 503) throw new PronunciationError("config");
  if (!res.ok) throw new PronunciationError("token");
  const { token, region, expiresIn } = await res.json();
  tokenCache = { token, region, until: Date.now() + Math.max(0, (expiresIn ?? 480) - 30) * 1000 };
  return tokenCache;
}

/* -------------------------------------------------------------------- SDK ---- */
// The SDK is CommonJS. Depending on the bundler it arrives with named exports or with
// everything under `default`, so take whichever carries SpeechConfig. A failed load is
// forgotten, so the next tap retries instead of replaying the same rejection.
let sdkPromise: Promise<Sdk> | null = null;
const loadSdk = (): Promise<Sdk> =>
  (sdkPromise ??= import("microsoft-cognitiveservices-speech-sdk")
    .then((m: Sdk) => (m.SpeechConfig ? m : m.default))
    .catch((err) => { sdkPromise = null; throw err; }));

// Internal: an expired token is worth one retry with a fresh one; nothing outside sees it.
class TokenExpired extends Error {}

/* ------------------------------------------------------------- assessment ---- */
const ERRORS: Record<string, WordError> = {
  None: "none",
  Mispronunciation: "mispronunciation",
  Omission: "omission",
  Insertion: "insertion",
  UnexpectedBreak: "unexpectedBreak",
  MissingBreak: "missingBreak",
  Monotone: "monotone",
};

const num = (v: unknown) => (typeof v === "number" ? Math.round(v) : undefined);

/** Azure's NBest[0] → the neutral Assessment. */
function toAssessment(best: Sdk): Assessment {
  const pa = best.PronunciationAssessment;
  const words: AssessedWord[] = (best.Words || []).map((w: Sdk) => {
    const error = ERRORS[w.PronunciationAssessment?.ErrorType] ?? "none";
    return {
      word: w.Word ?? "",
      score: error === "omission" ? 0 : Math.round(w.PronunciationAssessment?.AccuracyScore ?? 0),
      error,
      phonemes: (w.Phonemes || [])
        .filter((p: Sdk) => p.Phoneme)
        .map((p: Sdk) => ({ symbol: p.Phoneme, score: Math.round(p.PronunciationAssessment?.AccuracyScore ?? 0) })),
    };
  });
  return {
    overall: num(pa.PronScore) ?? num(pa.AccuracyScore) ?? 0,
    accuracy: num(pa.AccuracyScore) ?? 0,
    fluency: num(pa.FluencyScore),
    completeness: num(pa.CompletenessScore),
    prosody: num(pa.ProsodyScore),
    words,
  };
}

async function assessOnce({ referenceText, language, onListening }: AssessOptions): Promise<Assessment> {
  const sdk = await loadSdk();
  const { token, region } = await getToken();
  const speechConfig = sdk.SpeechConfig.fromAuthorizationToken(token, region);
  speechConfig.speechRecognitionLanguage = language;
  // Give up after 6 s of initial silence; end the take 1.2 s after the learner stops.
  speechConfig.setProperty(sdk.PropertyId.SpeechServiceConnection_InitialSilenceTimeoutMs, "6000");
  speechConfig.setProperty(sdk.PropertyId.SpeechServiceConnection_EndSilenceTimeoutMs, "1200");
  const audioConfig = sdk.AudioConfig.fromDefaultMicrophoneInput();
  const pa = new sdk.PronunciationAssessmentConfig(
    referenceText,
    sdk.PronunciationAssessmentGradingSystem.HundredMark,
    sdk.PronunciationAssessmentGranularity.Phoneme,
    true, // enableMiscue: omitted and inserted words are marked
  );
  try { pa.enableProsodyAssessment = true; } catch { /* older SDKs */ }
  const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);
  pa.applyTo(recognizer);
  recognizer.sessionStarted = () => onListening?.();

  const result = await new Promise<Sdk>((resolve, reject) =>
    recognizer.recognizeOnceAsync(resolve, (e: unknown) =>
      reject(String(e).includes("401") ? new TokenExpired() : new PronunciationError("failed"))),
  ).finally(() => recognizer.close());

  if (result.reason === sdk.ResultReason.NoMatch) throw new PronunciationError("noSpeech");
  if (result.reason === sdk.ResultReason.Canceled) {
    const details = sdk.CancellationDetails.fromResult(result);
    if (details.errorCode === sdk.CancellationErrorCode.AuthenticationFailure) throw new TokenExpired();
    if (details.errorCode === sdk.CancellationErrorCode.ConnectionFailure) throw new PronunciationError("token");
    throw new PronunciationError("failed");
  }
  const json = JSON.parse(result.properties.getProperty(sdk.PropertyId.SpeechServiceResponse_JsonResult) || "{}");
  const best = json.NBest?.[0];
  if (!best?.PronunciationAssessment) throw new PronunciationError("noSpeech");
  return toAssessment(best);
}

/* --------------------------------------------------------------- speaking ---- */
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export const azureProvider: PronunciationProvider = {
  id: "azure",

  async assess(options) {
    try {
      return await assessOnce(options);
    } catch (err) {
      if (!(err instanceof TokenExpired)) throw err;
      await getToken({ force: true });
      try {
        return await assessOnce(options);
      } catch (again) {
        throw again instanceof TokenExpired ? new PronunciationError("token") : again;
      }
    }
  },

  canSpeak() {
    return !!tokenCache && tokenCache.until > Date.now();
  },

  async speak(text: string, { language, slow = false }: SpeakOptions) {
    if (!tokenCache) throw new PronunciationError("token");
    const sdk = await loadSdk();
    const voice = VOICE[language] ?? VOICE["de-DE"];
    const cfg = sdk.SpeechConfig.fromAuthorizationToken(tokenCache.token, tokenCache.region);
    cfg.speechSynthesisVoiceName = voice;
    const synth = new sdk.SpeechSynthesizer(cfg, sdk.AudioConfig.fromDefaultSpeakerOutput());
    const ssml = `<speak version="1.0" xml:lang="${language}"><voice name="${voice}"><prosody rate="${slow ? "-25%" : "0%"}">${esc(text)}</prosody></voice></speak>`;
    await new Promise<void>((resolve, reject) =>
      synth.speakSsmlAsync(
        ssml,
        (r: Sdk) => { synth.close(); r.reason === sdk.ResultReason.SynthesizingAudioCompleted ? resolve() : reject(new PronunciationError("failed")); },
        () => { synth.close(); reject(new PronunciationError("failed")); },
      ),
    );
  },
};

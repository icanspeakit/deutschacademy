// The Aussprache-Check: the learner reads a sentence into the microphone and a
// pronunciation service scores every word. See src/pages/uebungen/aussprache-check.astro.
//
// Nothing in this file knows which service that is. It talks to the provider-neutral
// interface in src/lib/pronunciation/ (today backed by Azure, in ./pronunciation/azure.ts)
// and only handles what is the same for any provider: the microphone check, lining the
// scored words up with the sentence, the page, the tips, and the fallback voice.
import { tipFor, soundLabel } from "./ausspracheTipps.js";
import { pronunciationProvider as provider, PronunciationError } from "./pronunciation/index.ts";
import { referenceMelody, learnerMelody, compareMelody, melodyChart } from "./satzmelodie.js";

const LANG = "de-DE";
const BEST_KEY = "ac.best";
const POS_KEY = "ac.pos";

// Every message the learner can see, in one place, keyed by PronunciationErrorCode where
// one applies. German only for now: this page is speaking practice, and the words around
// it stay simple.
const MSG = {
  ready: "Tippe auf „Aufnehmen“ und lies den Satz laut vor.",
  preparing: "Mikrofon wird vorbereitet …",
  listening: "Ich höre zu … Lies jetzt den Satz vor.",
  analysing: "Wird ausgewertet …",
  done: "Fertig! Tippe auf ein Wort, um es zu hören.",
  micDenied: "Kein Zugriff auf das Mikrofon. Erlaube das Mikrofon in den Browser-Einstellungen (Schloss-Symbol neben der Adresse) und lade die Seite neu.",
  micMissing: "Kein Mikrofon gefunden. Schließ ein Mikrofon oder Headset an und versuch es noch einmal.",
  micUnsupported: "Dein Browser kann hier nicht aufnehmen. Öffne die Seite in Chrome, Edge oder Safari.",
  insecure: "Aufnehmen geht nur über eine sichere Verbindung (https).",
  auth: "Für die Auswertung musst du angemeldet sein.",
  rate: "Du hast gerade sehr viele Auswertungen gestartet. Mach eine kurze Pause und versuch es in ein paar Minuten noch einmal.",
  config: "Die Aussprache-Auswertung ist gerade nicht eingerichtet. Bitte versuch es später noch einmal.",
  token: "Keine Verbindung zum Sprachdienst. Prüfe deine Internetverbindung und versuch es noch einmal.",
  noSpeech: "Ich habe nichts gehört. Sprich etwas lauter oder näher am Mikrofon und versuch es noch einmal.",
  wrongText: "Ich habe etwas anderes gehört. Lies genau den Satz oben vor.",
  failed: "Die Auswertung hat nicht geklappt. Versuch es bitte noch einmal.",
  listenFailed: "Das Anhören hat nicht geklappt.",
};

/** WordError → what the detail panel says. */
const ERROR_LABEL = {
  none: "",
  mispronunciation: "Falsch ausgesprochen",
  omission: "Ausgelassen",
  insertion: "Zusätzlich gesagt",
  unexpectedBreak: "Unerwartete Pause",
  missingBreak: "Pause fehlt",
  monotone: "Zu monoton",
};

const band = (s) => (s >= 80 ? "good" : s >= 60 ? "ok" : "bad");
const norm = (w) => w.toLowerCase().replace(/[^a-zäöüß0-9]/g, "");
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function readJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || "") ?? fallback; } catch { return fallback; }
}
function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

/* ------------------------------------------------------------- microphone ---- */
// Ask for the microphone ourselves before the provider does: its own failure is usually a
// generic cancellation, and a learner who clicked "Blockieren" needs to be told where to
// undo it. The stream is kept, not closed: the Satzmelodie records from it while the
// provider listens (see record()).
async function checkMicrophone() {
  if (!window.isSecureContext) throw new PronunciationError("insecure");
  if (!navigator.mediaDevices?.getUserMedia) throw new PronunciationError("micUnsupported");
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    const name = err?.name;
    if (name === "NotAllowedError" || name === "SecurityError") throw new PronunciationError("micDenied");
    if (name === "NotFoundError" || name === "OverconstrainedError") throw new PronunciationError("micMissing");
    throw new PronunciationError("micUnsupported");
  }
}

/**
 * Line the scored words up with the words of the sentence as written (with capitals and
 * punctuation). Providers list every reference word — omitted ones as "omission" — plus
 * any extra words as "insertion"; the insertions are set aside.
 */
function alignWords(sentence, assessment) {
  const shown = sentence.split(/\s+/).filter(Boolean);
  const heard = assessment.words.filter((w) => w.error !== "insertion");
  let j = 0;
  return shown.map((display) => {
    const key = norm(display);
    // Prefer an exact match within the next two heard words, else take the next one.
    let k = heard.slice(j, j + 3).findIndex((w) => norm(w.word) === key);
    if (k < 0) k = 0;
    const w = heard[j + k];
    if (w) j += k + 1;
    const error = w ? w.error : "omission";
    return {
      display,
      word: display.replace(/[.,!?;:„“"]/g, ""),
      score: error === "omission" ? 0 : w.score,
      error,
      phonemes: w?.phonemes ?? [],
    };
  });
}

/* --------------------------------------------------------------- speaking ---- */
let currentAudio = null;
function stopAudio() {
  currentAudio?.pause?.();
  currentAudio = null;
  window.speechSynthesis?.cancel();
}

function browserSpeak(text, rate = 0.9) {
  return new Promise((resolve, reject) => {
    const synth = window.speechSynthesis;
    if (!synth) return reject(new Error("no tts"));
    const u = new SpeechSynthesisUtterance(text);
    u.lang = LANG;
    u.rate = rate;
    const de = synth.getVoices().find((v) => v.lang?.startsWith("de"));
    if (de) u.voice = de;
    u.onend = resolve;
    u.onerror = reject;
    synth.speak(u);
  });
}

// The provider's voice when it can speak without asking for credentials (so listening
// never forces a sign-in), the browser's own German voice otherwise.
async function speak(text, { slow = false } = {}) {
  stopAudio();
  if (provider.canSpeak()) {
    try { await provider.speak(text, { language: LANG, slow }); return; } catch { /* fall back */ }
  }
  await browserSpeak(text, slow ? 0.7 : 0.9);
}

async function playSentence(s) {
  stopAudio();
  if (s.audio) {
    const a = new Audio(`/audio/aussprache-check/${s.id}.mp3`);
    currentAudio = a;
    try { await a.play(); return; } catch { /* file missing or blocked: speak it instead */ }
  }
  await speak(s.text);
}

/* -------------------------------------------------------------------- UI ---- */
export function mountAusspracheCheck(root, data) {
  const $ = (sel) => root.querySelector(sel);
  const els = {
    tabs: [...root.querySelectorAll("[data-level]")],
    pos: $("[data-pos]"),
    best: $("[data-best]"),
    focus: $("[data-focus]"),
    sentence: $("[data-sentence]"),
    listen: $("[data-listen]"),
    record: $("[data-record]"),
    recordLabel: $("[data-record-label]"),
    status: $("[data-status]"),
    login: $("[data-login]"),
    results: $("[data-results]"),
    overall: $("[data-overall]"),
    overallRing: $("[data-overall-ring]"),
    scores: $("[data-scores]"),
    detail: $("[data-detail]"),
    tip: $("[data-tip]"),
    melody: $("[data-melody]"),
    prev: $("[data-prev]"),
    next: $("[data-next]"),
  };

  const levels = data.levels;
  const saved = readJSON(POS_KEY, {});
  let li = Math.max(0, levels.findIndex((l) => l.level === saved.level));
  let si = Math.min(saved.index ?? 0, levels[li].sentences.length - 1);
  let busy = false;
  let words = null;
  let best = readJSON(BEST_KEY, {});

  const sentence = () => levels[li].sentences[si];

  function setStatus(text, kind = "") {
    els.status.textContent = text;
    els.status.dataset.kind = kind;
  }

  function showError(err) {
    const code = err instanceof PronunciationError ? err.code : "failed";
    const msg = MSG[code] ?? MSG.failed;
    setStatus(msg, "error");
    els.login.hidden = code !== "auth";
  }

  function renderSentence() {
    const s = sentence();
    words = null;
    els.tabs.forEach((t, i) => {
      t.setAttribute("aria-selected", String(i === li));
      t.tabIndex = i === li ? 0 : -1;
    });
    els.pos.textContent = `Satz ${si + 1} / ${levels[li].sentences.length}`;
    els.best.textContent = best[s.id] != null ? `Bestwert ${best[s.id]}` : "";
    els.focus.innerHTML = s.focus.map((f) => `<span class="ac-chip">${esc(soundLabel(f))}</span>`).join("");
    els.sentence.innerHTML = s.text.split(/\s+/).map((w) => `<span class="ac-w">${esc(w)}</span>`).join(" ");
    els.results.hidden = true;
    els.melody.hidden = true;
    els.login.hidden = true;
    // Warm the reference contour while the learner reads, so the score is quick later.
    referenceMelody(s);
    els.prev.disabled = si === 0 && li === 0;
    els.next.disabled = si === levels[li].sentences.length - 1 && li === levels.length - 1;
    setStatus(MSG.ready);
    writeJSON(POS_KEY, { level: levels[li].level, index: si });
  }

  function renderWordDetail(i) {
    const w = words[i];
    els.sentence.querySelectorAll(".ac-w").forEach((b, k) => b.setAttribute("aria-pressed", String(k === i)));
    const label = w.error === "omission" ? "Ausgelassen" : `${w.score} von 100`;
    const err = w.error !== "none" && w.error !== "omission" ? ERROR_LABEL[w.error] ?? "" : "";
    const phon = w.phonemes.length
      ? `<p class="ac-detail-sub">Laute</p><div class="ac-phonemes">${w.phonemes
          .map((p) => `<span class="ac-ph ac-ph--${band(p.score)}" title="${p.score}"><b>${esc(p.symbol)}</b><small>${p.score}</small></span>`)
          .join("")}</div>`
      : "";
    els.detail.innerHTML = `
      <div class="ac-detail-head">
        <strong class="ac-detail-word">${esc(w.word)}</strong>
        <span class="ac-badge ac-badge--${w.error === "omission" ? "omit" : band(w.score)}">${esc(label)}</span>
      </div>
      ${err ? `<p class="ac-detail-err">${esc(err)}</p>` : ""}
      ${phon}
      <div class="ac-detail-actions">
        <button type="button" class="ac-btn ac-btn--quiet" data-say="normal">▶ Wort anhören</button>
        <button type="button" class="ac-btn ac-btn--quiet" data-say="slow">Langsam</button>
      </div>`;
    els.detail.hidden = false;
    els.detail.querySelectorAll("[data-say]").forEach((b) =>
      b.addEventListener("click", () => speak(w.word, { slow: b.dataset.say === "slow" }).catch(() => setStatus(MSG.listenFailed, "error"))),
    );
  }

  function renderResults(assessment) {
    const s = sentence();
    const aligned = alignWords(s.text, assessment);

    // A take that got none of the sentence scores zero everywhere; say so instead of
    // painting every word red.
    if (!aligned.some((w) => w.error !== "omission")) throw new PronunciationError("wrongText");
    words = aligned;

    const overall = assessment.overall;
    els.overall.textContent = overall;
    els.overallRing.style.setProperty("--p", overall);
    els.overallRing.dataset.band = band(overall);

    const rows = [
      ["Genauigkeit", assessment.accuracy, "Wie genau die Laute stimmen"],
      ["Flüssigkeit", assessment.fluency, "Tempo und Pausen"],
      ["Vollständigkeit", assessment.completeness, "Wie viele Wörter du gesagt hast"],
      // Our own score, filled in by renderMelody() — the provider's prosody score is
      // English-only.
      ["Satzmelodie", null, "Betonung und Melodie"],
    ];
    els.scores.innerHTML = rows
      .map(([name, v, hint]) => {
        const has = typeof v === "number";
        const n = has ? Math.round(v) : null;
        return `<div class="ac-score" data-band="${has ? band(n) : "none"}"${name === "Satzmelodie" ? " data-melody-score" : ""}>
          <div class="ac-score-top"><span>${name}</span><b>${has ? n : "—"}</b></div>
          <span class="ac-score-bar"><span style="width:${has ? n : 0}%"></span></span>
          <small>${has ? hint : name === "Satzmelodie" ? "Wird berechnet …" : "Nicht bewertet"}</small>
        </div>`;
      })
      .join("");

    els.sentence.innerHTML = words
      .map((w, i) => {
        const cls = w.error === "omission" ? "omit" : band(w.score);
        const aria = w.error === "omission" ? `${w.word}: ausgelassen` : `${w.word}: ${w.score} von 100`;
        return `<button type="button" class="ac-w ac-w--${cls}" data-word="${i}" aria-pressed="false" aria-label="${esc(aria)}">${esc(w.display)}</button>`;
      })
      .join(" ");

    // The tip is about the worst word that was actually said: a sound rule helps with that
    // one. Left-out words get their own line underneath, since there is no sound to fix.
    const spoken = words.filter((w) => w.error !== "omission");
    const worst = spoken.reduce((a, w) => (w.score < a.score ? w : a), spoken[0]);
    const missing = words.filter((w) => w.error === "omission").map((w) => `„${esc(w.word)}“`);
    const missingLine = missing.length
      ? `<p class="ac-tip-missing">Nicht gehört: ${missing.join(", ")}. Lies jedes Wort — auch die kleinen.</p>`
      : "";
    if (worst.score >= 85) {
      els.tip.innerHTML = missing.length
        ? `<p class="ac-tip-title">Gut ausgesprochen!</p>${missingLine}`
        : `<p class="ac-tip-title">Sehr gut!</p><p>Jedes Wort hat 85 Punkte oder mehr. Probier den nächsten Satz.</p>`;
    } else {
      const t = tipFor(worst.word, s.focus);
      els.tip.innerHTML = `<p class="ac-tip-title">Tipp für „${esc(worst.word)}“${t.label ? ` <span class="ac-chip">${esc(t.label)}</span>` : ""}</p><p>${esc(t.text)}</p>${missingLine}`;
    }

    els.detail.hidden = true;
    els.results.hidden = false;

    if (best[s.id] == null || overall > best[s.id]) {
      best = { ...best, [s.id]: overall };
      writeJSON(BEST_KEY, best);
    }
    els.best.textContent = `Bestwert ${best[s.id]}`;
  }

  /* Satzmelodie: pitch contour of the take against the reference clip, all in the
     browser (src/lib/satzmelodie.js). Runs after the word scores are on screen, so the
     learner never waits for it. */
  async function renderMelody(blob) {
    const s = sentence();
    const row = els.scores.querySelector("[data-melody-score]");
    const setRow = (n, hint) => {
      if (!row) return;
      row.dataset.band = n == null ? "none" : band(n);
      row.querySelector("b").textContent = n == null ? "—" : n;
      row.querySelector(".ac-score-bar span").style.width = `${n ?? 0}%`;
      row.querySelector("small").textContent = hint;
    };
    els.melody.hidden = true;
    try {
      const [ref, you] = await Promise.all([referenceMelody(s), blob ? learnerMelody(blob) : null]);
      if (!ref?.length) return setRow(null, "Für diesen Satz gibt es noch kein Vorbild");
      if (!you?.length) return setRow(null, "Zu wenig Stimme gehört");
      const r = compareMelody(ref, you, s);
      if (!r) return setRow(null, "Zu wenig Stimme gehört");
      setRow(r.score, "Betonung und Melodie");
      const kind = { "ja-nein": "Ja/Nein-Frage: am Ende hoch", "w-frage": "W-Frage: am Ende runter", aussage: "Aussage: am Ende runter" }[r.type];
      els.melody.innerHTML = `
        <div class="ac-mel-head">
          <span class="ac-mel-title">Satzmelodie</span>
          <span class="ac-mel-kind">${esc(kind)}</span>
        </div>
        ${melodyChart(ref, you)}
        <div class="ac-mel-legend"><span><i class="ac-mel-key ac-mel-key--ref"></i>Vorbild</span><span><i class="ac-mel-key ac-mel-key--you"></i>Du</span></div>
        ${r.tip ? `<p class="ac-mel-tip">${esc(r.tip)}</p>` : r.score >= 75 ? `<p class="ac-mel-tip">Deine Melodie passt gut zum Vorbild.</p>` : ""}`;
      els.melody.hidden = false;
    } catch (err) {
      console.error(err);
      setRow(null, "Nicht bewertet");
    }
  }

  /** MediaRecorder on the stream we already hold; resolves to the take as a Blob. */
  function startTake(stream) {
    if (!stream || typeof MediaRecorder === "undefined") return null;
    const rec = new MediaRecorder(stream);
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data); };
    const done = new Promise((resolve) => { rec.onstop = () => resolve(chunks.length ? new Blob(chunks, { type: rec.mimeType }) : null); });
    rec.start();
    return { stop: () => { if (rec.state !== "inactive") rec.stop(); return done; } };
  }

  async function record() {
    if (busy) return;
    busy = true;
    stopAudio();
    els.record.dataset.state = "prep";
    els.recordLabel.textContent = "Moment …";
    els.login.hidden = true;
    setStatus(MSG.preparing);
    let stream = null;
    let take = null;
    try {
      stream = await checkMicrophone();
      take = startTake(stream);
      const result = await provider.assess({
        referenceText: sentence().text,
        language: LANG,
        onListening: () => {
          els.record.dataset.state = "rec";
          els.recordLabel.textContent = "Ich höre zu …";
          setStatus(MSG.listening, "live");
        },
      });
      els.record.dataset.state = "prep";
      setStatus(MSG.analysing);
      const blob = await take?.stop();
      take = null;
      renderResults(result);
      setStatus(MSG.done, "ok");
      renderMelody(blob);
    } catch (err) {
      if (!(err instanceof PronunciationError)) console.error(err);
      showError(err);
    } finally {
      take?.stop();
      stream?.getTracks().forEach((t) => t.stop());
      busy = false;
      els.record.dataset.state = "idle";
      els.recordLabel.textContent = words ? "Noch einmal" : "Aufnehmen";
    }
  }

  function go(delta) {
    if (busy) return;
    si += delta;
    if (si < 0) { li = Math.max(0, li - 1); si = levels[li].sentences.length - 1; }
    if (si >= levels[li].sentences.length) { li = Math.min(levels.length - 1, li + 1); si = 0; }
    els.recordLabel.textContent = "Aufnehmen";
    renderSentence();
  }

  els.tabs.forEach((t, i) =>
    t.addEventListener("click", () => {
      if (busy || i === li) return;
      li = i; si = 0;
      els.recordLabel.textContent = "Aufnehmen";
      renderSentence();
    }),
  );
  root.querySelector("[role=tablist]").addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const i = (li + (e.key === "ArrowRight" ? 1 : -1) + levels.length) % levels.length;
    els.tabs[i].click();
    els.tabs[i].focus();
  });
  els.prev.addEventListener("click", () => go(-1));
  els.next.addEventListener("click", () => go(1));
  els.record.addEventListener("click", record);
  els.listen.addEventListener("click", () => playSentence(sentence()).catch(() => setStatus(MSG.listenFailed, "error")));
  els.sentence.addEventListener("click", (e) => {
    const b = e.target.closest("[data-word]");
    if (!b || !words) return;
    const i = Number(b.dataset.word);
    renderWordDetail(i);
    speak(words[i].word).catch(() => {});
  });

  renderSentence();
}

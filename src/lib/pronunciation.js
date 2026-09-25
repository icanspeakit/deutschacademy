// Aussprache-Workbench: one focused phrase on the stage, the full set in the
// rail. Drives server-rendered markup (see uebungen/aussprache.astro) rather
// than writing the page with innerHTML, so the i18n pass and the rail rows
// survive a language switch.
//
// Ported ideas from ../icanspeakit: the seeded waveform and rate chips from
// ListeningWorkbench.astro, the record-and-compare loop from ShadowRecorder.astro.

const ARTICLES = new Set(["der", "die", "das"]);
const BAR_COUNT = 48;

// Stable pseudo-random bar heights seeded by the phrase, so each item has its
// own waveform silhouette but it never reshuffles between visits.
function seededBars(seed, count) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let state = h >>> 0;
  const bars = [];
  for (let i = 0; i < count; i++) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    bars.push(Math.round(26 + (state / 4294967295) * 74));
  }
  return bars;
}

/** Where the words a learner has heard are kept: `{ setKey: ["der Name", …] }`. */
export const HEARD_KEY = "da-aussprache-gehoert";
export function readHeard() {
  try { return JSON.parse(localStorage.getItem(HEARD_KEY) || "{}") || {}; } catch { return {}; }
}

export function mountPronunciation(root, options = {}) {
  const { sets, onHeard, onSetChange, strings = {} } = options;

  const el = {
    setBtns: [...root.querySelectorAll("[data-set-btn]")],
    setSelect: root.querySelector("[data-set-select]"),
    lists: [...root.querySelectorAll("[data-rail-list]")],
    heardCount: root.querySelector("[data-heard-count]"),
    heardTotal: root.querySelector("[data-heard-total]"),
    railBar: root.querySelector("[data-rail-bar]"),
    kicker: root.querySelector("[data-kicker]"),
    phrase: root.querySelector("[data-phrase]"),
    translation: root.querySelector("[data-translation]"),
    play: root.querySelector("[data-play]"),
    playIcon: root.querySelector("[data-play-icon]"),
    wave: root.querySelector("[data-wave]"),
    waveBase: root.querySelector("[data-wave-base]"),
    wavePlayed: root.querySelector("[data-wave-played]"),
    rates: [...root.querySelectorAll("[data-rate]")],
    loop: root.querySelector("[data-loop]"),
    sentence: root.querySelector("[data-sentence]"),
    sentenceText: root.querySelector("[data-sentence-text]"),
    rec: root.querySelector("[data-rec]"),
    playMine: root.querySelector("[data-play-mine]"),
    status: root.querySelector("[data-status]"),
    note: root.querySelector("[data-note]"),
    prev: root.querySelector("[data-prev]"),
    next: root.querySelector("[data-next]"),
  };

  const ICON_PLAY = '<path d="M8 5v14l11-7z"/>';
  const ICON_STOP = '<path d="M7 7h10v10H7z"/>';

  let set = el.setSelect?.value || el.setBtns[0]?.dataset.setBtn || Object.keys(sets)[0];
  let index = 0;
  let rate = 1;
  let looping = false;
  // "Im Satz hören": the player plays the word's example sentence instead. It stays on from
  // word to word; a word without a voiced sentence just plays the word.
  let inSentence = false;
  // One Set per practice set, created on first visit — the sets come from the lexicon, so
  // their keys are not known here. Remembered per browser by the words themselves
  // (HEARD_KEY), not by position, so a set that gains a word keeps what was heard in it;
  // the side nav's "x/N" per topic reads the same record.
  const heard = {};
  let saved = readHeard();
  const heardIn = (key) =>
    (heard[key] ??= new Set(
      (sets[key] || []).map((it, i) => (saved[key]?.includes(it.text) ? i : -1)).filter((i) => i >= 0)
    ));
  function markHeard(key, i) {
    if (heardIn(key).has(i)) return false;
    heardIn(key).add(i);
    saved = readHeard();
    saved[key] = [...heardIn(key)].map((j) => sets[key]?.[j]?.text).filter(Boolean);
    try { localStorage.setItem(HEARD_KEY, JSON.stringify(saved)); } catch {}
    return true;
  }

  const audio = new Audio();
  audio.preload = "none";

  let recorder = null;
  let recChunks = [];
  let mineUrl = null;
  const mine = new Audio();

  const items = () => sets[set] || [];
  const current = () => items()[index];
  const useSentence = () => inSentence && !!current()?.sentence;
  const srcOf = (item) => (useSentence() ? item.sentence.audioSrc : item.audioSrc);

  // Rendering ---------------------------------------------------------------

  function renderPhrase(item) {
    const words = item.text.split(/\s+/);
    // A sentence ("Das sehe ich anders.") starts with a pronoun, not an article: the chip
    // is for a noun with its article ("der Name"), which never ends in punctuation.
    const isSentence = /[.!?…]$/.test(item.text.trim());
    el.phrase.innerHTML = words
      .map((word, i) => {
        const bare = word.toLowerCase();
        if (i === 0 && !isSentence && ARTICLES.has(bare)) {
          return `<span class="pr-word pr-word--article pr-word--${bare}">${word}</span>`;
        }
        return `<span class="pr-word">${word}</span>`;
      })
      .join("");
  }

  function renderWave(item) {
    const bars = seededBars(item.text, BAR_COUNT);
    const markup = (extra) =>
      bars.map((h) => `<span class="pr-wave-bar${extra}" style="height:${h}%"></span>`).join("");
    el.waveBase.innerHTML = markup("");
    el.wavePlayed.innerHTML = markup(" pr-wave-bar--played");
    el.wavePlayed.style.width = "0%";
  }

  function renderRail() {
    el.lists.forEach((list) => {
      const listSet = list.dataset.railList;
      list.hidden = listSet !== set;
      [...list.children].forEach((row, i) => {
        const isCurrent = listSet === set && i === index;
        row.setAttribute("aria-current", String(isCurrent));
        row.dataset.heard = String(heardIn(listSet).has(i));
        if (isCurrent) row.scrollIntoView({ block: "nearest", inline: "nearest" });
      });
    });

    const total = items().length;
    const done = heardIn(set).size;
    el.heardCount.textContent = String(done);
    el.heardTotal.textContent = String(total);
    el.railBar.style.width = total ? `${(done / total) * 100}%` : "0%";
  }

  function render() {
    const item = current();
    if (!item) return;

    el.kicker.textContent = (strings.position || "{i} / {n}")
      .replace("{i}", String(index + 1))
      .replace("{n}", String(items().length));
    renderPhrase(item);
    renderWave(useSentence() ? item.sentence : item);
    el.sentence.hidden = !item.sentence;
    el.sentence.setAttribute("aria-pressed", String(useSentence()));
    el.sentenceText.hidden = !useSentence();
    el.sentenceText.textContent = useSentence() ? item.sentence.text : "";
    el.translation.textContent = item.translation || "";
    el.note.textContent = item.note || "";
    el.prev.disabled = index === 0;
    el.next.disabled = index >= items().length - 1;

    resetRecording();
    renderRail();
  }

  // Playback ----------------------------------------------------------------

  function setPlayIcon(playing) {
    el.playIcon.innerHTML = playing ? ICON_STOP : ICON_PLAY;
  }

  // A phrase with no recording yet (audioSrc "") is read by the browser's German voice —
  // same button, same tempo and loop, no waveform progress. The note says it is synthetic.
  let speaking = false;
  function speak(text) {
    if (!("speechSynthesis" in window)) { el.status.textContent = strings.audioError || ""; return; }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "de-DE";
    u.rate = rate;
    const de = speechSynthesis.getVoices().find((v) => v.lang?.startsWith("de"));
    if (de) u.voice = de;
    u.onstart = () => {
      speaking = true;
      setPlayIcon(true);
      if (markHeard(set, index)) { onHeard?.(set); renderRail(); }
    };
    u.onend = () => {
      speaking = false;
      setPlayIcon(false);
      if (looping) setTimeout(play, 600);
    };
    speechSynthesis.speak(u);
  }

  function stop() {
    if (speaking || speechSynthesis?.speaking) { speaking = false; speechSynthesis.cancel(); }
    audio.pause();
    audio.currentTime = 0;
    el.wavePlayed.style.width = "0%";
    setPlayIcon(false);
  }

  function play() {
    const item = current();
    if (!item) return;
    if (!srcOf(item)) return speak(item.text);
    const src = new URL(srcOf(item), location.href).href;
    if (audio.src !== src) audio.src = src;
    audio.playbackRate = rate;
    audio.currentTime = 0;
    // Drive the UI off media events, not this promise: a backgrounded or
    // unfocused tab can leave play() pending forever, which would strand the
    // button on its play glyph while audio is actually running.
    audio.play().catch(() => {
      el.status.textContent = strings.audioError || "";
    });
  }

  audio.addEventListener("playing", () => {
    setPlayIcon(true);
    el.status.textContent = "";
    if (markHeard(set, index)) {
      onHeard?.(set);
      renderRail();
    }
  });
  audio.addEventListener("pause", () => setPlayIcon(false));
  audio.addEventListener("error", () => {
    setPlayIcon(false);
    el.status.textContent = strings.audioError || "";
  });

  audio.addEventListener("timeupdate", () => {
    if (!audio.duration) return;
    el.wavePlayed.style.width = `${(audio.currentTime / audio.duration) * 100}%`;
  });
  audio.addEventListener("ended", () => {
    el.wavePlayed.style.width = "100%";
    setPlayIcon(false);
    if (looping) setTimeout(play, 600);
  });

  el.play.addEventListener("click", () => (audio.paused && !speaking ? play() : stop()));

  // Scrub by clicking the waveform — the bars are decorative, but the track
  // position under the pointer is real.
  el.wave.addEventListener("click", (e) => {
    if (!audio.duration) return;
    const rect = el.wave.getBoundingClientRect();
    const ratio = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    audio.currentTime = ratio * audio.duration;
  });

  el.rates.forEach((btn) => {
    btn.addEventListener("click", () => {
      rate = Number(btn.dataset.rate);
      audio.playbackRate = rate;
      el.rates.forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
    });
  });

  el.sentence.addEventListener("click", () => {
    inSentence = !inSentence;
    stop();
    render();
    play();
  });

  el.loop.addEventListener("click", () => {
    looping = !looping;
    el.loop.setAttribute("aria-pressed", String(looping));
  });

  // Nachsprechen ------------------------------------------------------------

  function resetRecording() {
    if (recorder && recorder.state === "recording") recorder.stop();
    if (mineUrl) URL.revokeObjectURL(mineUrl);
    mineUrl = null;
    recChunks = [];
    el.rec.dataset.recording = "false";
    el.playMine.disabled = true;
    el.status.textContent = "";
  }

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      el.status.textContent = strings.recUnsupported || "";
      el.rec.disabled = true;
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recorder = new MediaRecorder(stream);
      recChunks = [];
      recorder.addEventListener("dataavailable", (e) => e.data.size && recChunks.push(e.data));
      recorder.addEventListener("stop", () => {
        stream.getTracks().forEach((t) => t.stop());
        if (!recChunks.length) return;
        if (mineUrl) URL.revokeObjectURL(mineUrl);
        mineUrl = URL.createObjectURL(new Blob(recChunks, { type: recorder.mimeType }));
        mine.src = mineUrl;
        el.playMine.disabled = false;
        el.status.textContent = strings.recDone || "";
      });
      recorder.start();
      el.rec.dataset.recording = "true";
      el.status.textContent = strings.recActive || "";
    } catch {
      el.status.textContent = strings.recDenied || "";
    }
  }

  el.rec.addEventListener("click", () => {
    if (el.rec.dataset.recording === "true") {
      recorder?.stop();
      el.rec.dataset.recording = "false";
    } else {
      startRecording();
    }
  });

  el.playMine.addEventListener("click", () => {
    mine.currentTime = 0;
    mine.play().catch(() => {});
  });

  // Navigation --------------------------------------------------------------

  function go(next) {
    const total = items().length;
    if (!total) return;
    index = Math.min(Math.max(next, 0), total - 1);
    stop();
    render();
  }

  el.prev.addEventListener("click", () => go(index - 1));
  el.next.addEventListener("click", () => go(index + 1));

  el.lists.forEach((list) => {
    list.addEventListener("click", (e) => {
      const row = e.target.closest("[data-row-index]");
      if (row) go(Number(row.dataset.rowIndex));
    });
  });

  function switchSet(key) {
    if (!sets[key]) return;
    set = key;
    index = 0;
    el.setBtns.forEach((b) => b.setAttribute("aria-selected", String(b.dataset.setBtn === key)));
    if (el.setSelect) el.setSelect.value = key;
    stop();
    render();
    onSetChange?.(key);
  }

  el.setBtns.forEach((btn) => btn.addEventListener("click", () => switchSet(btn.dataset.setBtn)));
  el.setSelect?.addEventListener("change", () => switchSet(el.setSelect.value));

  // Keyboard: only when focus is not on a control the keys would fight over.
  document.addEventListener("keydown", (e) => {
    if (e.target.closest("input, textarea, select, [contenteditable]")) return;
    if (e.key === "ArrowLeft") { e.preventDefault(); go(index - 1); }
    else if (e.key === "ArrowRight") { e.preventDefault(); go(index + 1); }
    else if (e.key === " " || e.code === "Space") {
      if (e.target.closest("button")) return;
      e.preventDefault();
      audio.paused && !speaking ? play() : stop();
    }
  });

  setPlayIcon(false);
  render();

  return {
    switchSet,
    refresh: (nextStrings) => {
      if (nextStrings) Object.assign(strings, nextStrings);
      render();
    },
  };
}

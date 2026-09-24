// "Aktiv" mode — the Üben · Hören · Sprechen half of a grammar topic.
//
// The workspaces at /uebungen/grammatik/<topic> are silent and text-only: the learner
// reads a rule and types endings. That trains recognition, not production. This adds the
// two beats a Grammatik-aktiv page is actually built on — hear the form, then say it
// under time pressure. The fourth beat, Schreiben, is the exercise column that page
// already has; nothing here re-implements it.
//
// Data is one optional `aktiv: { listen, hoeren, sprechen }` block in
// src/data/grammatik/<topic>.json. A topic without it renders exactly as before — no
// mode switch, no beats — so giving a topic a voice stays what adding a topic already is:
// editing one JSON file.
//
// AUDIO — until scripts/generate-grammatik-audio.mjs has run for a topic, every line is
// spoken by the browser's German SpeechSynthesis voice. Quality varies by OS and the
// voice can be absent entirely. Every item may carry an `audio` path; when it does the
// file wins and the synthesiser is never touched, so the generator is purely additive and
// nothing in this module changes when the mp3s land.

/* ---------------------------------------------------------------- voice ---- */

export function makeVoice() {
  const synth = typeof speechSynthesis !== "undefined" ? speechSynthesis : null;
  let preferred = null;

  function pickVoice() {
    if (!synth) return;
    const voices = synth.getVoices();
    // A real de-DE voice first; some platforms only ship de-AT/de-CH, still better than
    // an English voice reading "hoher" as "hoe-her".
    preferred =
      voices.find((v) => v.lang === "de-DE" && /google|natural|premium|siri/i.test(v.name)) ||
      voices.find((v) => v.lang === "de-DE") ||
      voices.find((v) => v.lang && v.lang.startsWith("de")) ||
      null;
  }
  pickVoice();
  if (synth && synth.addEventListener) synth.addEventListener("voiceschanged", pickVoice);

  const el = new Audio();
  el.preload = "none";
  let token = 0;

  function stop() {
    token++;
    if (synth) synth.cancel();
    el.pause();
  }

  /** Resolves when the line has finished, or when a newer call supersedes it. */
  function say(input, { rate = 1 } = {}) {
    const text = typeof input === "string" ? input : input && input.text;
    const src = typeof input === "object" && input ? input.audio : null;
    stop();
    if (!text && !src) return Promise.resolve();

    return new Promise((resolve) => {
      let settled = false;
      const done = () => { if (!settled) { settled = true; resolve(); } };

      if (src) {
        el.src = src;
        el.playbackRate = rate;
        el.onended = done;
        el.onerror = done;
        const p = el.play();
        if (p && p.catch) p.catch(done);
        return;
      }
      if (!synth) return done();

      const u = new SpeechSynthesisUtterance(text);
      u.lang = "de-DE";
      u.rate = rate * 0.95;
      if (preferred) u.voice = preferred;
      u.onend = done;
      u.onerror = done;
      // Chrome drops utterances queued while the tab was backgrounded; resume() is the
      // documented workaround and is harmless when nothing is paused.
      synth.resume();
      synth.speak(u);
      // Some Windows voices never fire onend for very short strings. A ceiling keeps the
      // drill's state machine from deadlocking on "der neue Film".
      setTimeout(done, 1200 + text.length * 110);
    });
  }

  return {
    say,
    stop,
    available: () => !!synth,
    get voiceName() { return preferred ? preferred.name : null; },
  };
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

import { t, i18nAttrs, uitHtml, onUiText } from "./uiText.js";

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c]);

/* ----------------------------------------------------------------- beats ---- */

/**
 * Four chips at the top, one panel at a time, plus a "Weiter" at the foot of each panel.
 * The beat lives in the hash so a learner can link straight to the drill. Switching beats
 * always silences whatever was playing — nothing is more confusing than a voice coming
 * from a panel you have left.
 */
export function mountBeats(root, { onLeave, onExit, anchor } = {}) {
  const chips = [...root.querySelectorAll("[data-beat-chip]")];
  const panels = [...root.querySelectorAll("[data-beat-panel]")];
  const order = chips.map((c) => c.dataset.beatChip);
  // A chip with no panel is a way out, not a beat: on the topic page the fourth chip,
  // Schreiben, hands the learner back to Üben mode, where the exercises already are.
  // Mounting them a second time inside a panel would give the topic two copies of every
  // answer's state.
  const owned = new Set(panels.map((p) => p.dataset.beatPanel));
  // The page ships with the first beat already open so there is no blank first paint.
  // That means the initial show() would be a no-op under a plain equality guard and the
  // chips would never light up — hence `synced`, which forces exactly one full pass.
  let synced = false;

  function show(beat, { scroll = true } = {}) {
    if (!order.includes(beat)) beat = order[0];
    if (!owned.has(beat)) {
      if (onLeave) onLeave(root.dataset.beat);
      if (onExit) onExit(beat);
      return;
    }
    if (synced && root.dataset.beat === beat) return;
    if (synced && onLeave) onLeave(root.dataset.beat);
    synced = true;
    root.dataset.beat = beat;
    chips.forEach((c) => {
      const on = c.dataset.beatChip === beat;
      c.classList.toggle("is-active", on);
      c.setAttribute("aria-selected", String(on));
    });
    panels.forEach((p) => { p.hidden = p.dataset.beatPanel !== beat; });
    // The step is not written into the address: the page's mode switch writes #aktiv, and
    // that is the only hash Aktiv has. Old links to #sehen / #hoeren / #sprechen still
    // open on that step (see `wanted` below).

    // scrollIntoView on the page root puts the top of the page under the site nav and
    // leaves the new panel's first rows hidden behind the sticky bar. Scroll to the point
    // where the sticky bar is exactly at its pinned offset instead: the panel then starts
    // immediately below the chips, which is where the learner is looking.
    if (scroll && anchor) {
      const navH = parseInt(getComputedStyle(root).getPropertyValue("--ak-nav-h"), 10) || 0;
      const top = anchor.getBoundingClientRect().top + scrollY - navH;
      scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    }
  }

  chips.forEach((c) => c.addEventListener("click", () => show(c.dataset.beatChip)));
  root.querySelectorAll("[data-beat-next]").forEach((b) =>
    b.addEventListener("click", () => show(b.dataset.beatNext))
  );

  // An exit chip is not a legal starting beat, so #schreiben opens on the first real one.
  const wanted = location.hash.slice(1);
  show(owned.has(wanted) ? wanted : order.find((b) => owned.has(b)), { scroll: false });
  return { show };
}

/* ----------------------------------------------------------------- sehen ---- */

/** The rule's own examples, each with a play button. Reading a form is not hearing it. */
export function mountListen(root, items, voice) {
  root.innerHTML = items
    .map(
      (it, i) => `
      <li class="ak-listen-row">
        <button type="button" class="ak-play" data-say="${i}" aria-label="${esc(t("ak.say", "Vorlesen"))}: ${esc(it.text)}">
          <span class="ak-play-icon" aria-hidden="true"></span>
        </button>
        <div>
          <p class="ak-listen-text">${esc(it.text)}</p>
          ${it.note ? `<p class="ak-listen-note">${uitHtml(it.note, it.noteTr, esc)}</p>` : ""}
        </div>
      </li>`
    )
    .join("");

  root.querySelectorAll("[data-say]").forEach((b) =>
    b.addEventListener("click", async () => {
      root.querySelectorAll(".ak-play").forEach((p) => p.classList.remove("is-playing"));
      b.classList.add("is-playing");
      await voice.say(items[+b.dataset.say]);
      b.classList.remove("is-playing");
    })
  );
}

/* ---------------------------------------------------------------- hören ---- */

/**
 * Minimal pairs, ear only. The sentence stays blurred until the learner has answered —
 * printing the transcript above the question turns a listening task into a reading task,
 * which is the failure mode of most "listening" exercises.
 */
export function mountHoeren(root, data, { voice, notify } = {}) {
  const state = { picked: {}, checked: {}, plays: {} };

  function render() {
    root.innerHTML = data.items
      .map((item, i) => {
        const picked = state.picked[i];
        const checked = !!state.checked[i];
        const opts = item.choices
          .map((c, ci) => {
            const on = picked === ci;
            const cls = checked
              ? ci === item.correct ? "is-correct" : on ? "is-wrong" : ""
              : on ? "is-chosen" : "";
            return `<button type="button" class="ak-opt ${cls}" data-i="${i}" data-o="${ci}" ${checked ? "disabled" : ""}>${esc(c)}</button>`;
          })
          .join("");
        return `
          <div class="ak-hear-item ${checked ? "is-done" : ""}">
            <div class="ak-hear-head">
              <button type="button" class="ak-play ak-play--lg" data-play="${i}" aria-label="${esc(t("ak.hear.play", "Satz {n} abspielen", { n: i + 1 }))}">
                <span class="ak-play-icon" aria-hidden="true"></span>
              </button>
              <span class="ak-hear-num"${i18nAttrs("ak.hear.num", { n: i + 1 })}>${esc(t("ak.hear.num", "Satz {n}", { n: i + 1 }))}</span>
              ${state.plays[i] ? `<span class="ak-hear-plays">${esc(t("ak.hear.plays", "{n}× gehört", { n: state.plays[i] }))}</span>` : ""}
            </div>
            <div class="ak-opts">${opts}</div>
            <p class="ak-transcript ${checked ? "" : "is-blurred"}" ${checked ? "" : 'aria-hidden="true"'}>${esc(item.text)}</p>
            ${checked ? "" : `<button type="button" class="ak-check" data-check="${i}" ${picked == null ? "disabled" : ""}${i18nAttrs("quiz.check")}>${esc(t("quiz.check", "Prüfen"))}</button>`}
          </div>`;
      })
      .join("");

    root.querySelectorAll("[data-play]").forEach((b) =>
      b.addEventListener("click", async () => {
        const i = +b.dataset.play;
        state.plays[i] = (state.plays[i] || 0) + 1;
        b.classList.add("is-playing");
        await voice.say(data.items[i]);
        b.classList.remove("is-playing");
        const head = b.parentElement;
        const badge = head.querySelector(".ak-hear-plays");
        const heard = t("ak.hear.plays", "{n}× gehört", { n: state.plays[i] });
        if (badge) badge.textContent = heard;
        else head.insertAdjacentHTML("beforeend", `<span class="ak-hear-plays">${esc(heard)}</span>`);
      })
    );
    root.querySelectorAll("[data-o]").forEach((b) =>
      b.addEventListener("click", () => { state.picked[+b.dataset.i] = +b.dataset.o; render(); })
    );
    root.querySelectorAll("[data-check]").forEach((b) =>
      b.addEventListener("click", () => {
        const i = +b.dataset.check;
        state.checked[i] = true;
        if (notify) notify(state.picked[i] === data.items[i].correct);
        render();
      })
    );
  }
  render();
  onUiText(render);
}

/* -------------------------------------------------------------- sprechen ---- */

/**
 * The pattern drill. One item runs prompt → silence → model answer, and the silence is
 * the whole exercise: it is the only place on the site where the learner has to produce a
 * form with no pills to pick from and a clock running.
 *
 * The gap scales with the answer — "mit einer jungen Frau" needs longer than "ein neuer
 * Film" — with a floor so short answers still feel like a beat rather than a stumble.
 *
 * Self-rating is the grade. There is no speech recognition here and there should not be:
 * a learner knows whether they said "einem neuen" or "einen neuen", and a recogniser that
 * mishears them once destroys trust in every score after it. Freihändig mode drops the
 * rating and just runs — the version you do while walking — and records nothing, which is
 * the honest thing to do with an unobserved answer.
 */
export function mountSprechen(root, data, { voice, onRate } = {}) {
  const rounds = data.rounds;
  let r = 0;
  let i = 0;
  let phase = "ready"; // ready | prompt | gap | answer | rate
  let run = 0;         // invalidates an in-flight sequence when the learner jumps
  let hands = false;
  let speed = 1;
  const scores = rounds.map((round) => round.items.map(() => null));

  const round = () => rounds[r];
  const item = () => round().items[i];
  const gapMs = (answer) => Math.min(5200, Math.max(2000, answer.length * 110));

  function render() {
    const cur = round();
    const done = scores[r].filter((s) => s !== null).length;
    const good = scores[r].filter((s) => s === true).length;
    const fresh = scores[r].every((s) => s === null) && i === 0;

    root.innerHTML = `
      <div class="ak-drill">
        <div class="ak-round-tabs" role="tablist">
          ${rounds
            .map((ro, ri) => `<button type="button" class="ak-round-tab ${ri === r ? "is-active" : ""}" data-round="${ri}" role="tab" aria-selected="${ri === r}">${uitHtml(ro.label, ro.labelTr, esc)}</button>`)
            .join("")}
        </div>
        <p class="ak-drill-instruction">${uitHtml(cur.instruction, cur.instructionTr, esc)}</p>
        <p class="ak-drill-example">${esc(t("ak.eg", "z. B."))} <strong>${esc(cur.example.prompt)}</strong> → <strong>${esc(cur.example.answer)}</strong></p>

        <div class="ak-stage" data-phase="${phase}">
          <div class="ak-stage-dots">
            ${cur.items
              .map((_, ii) => {
                // Score and position are separate marks: the current dot is ringed, not
                // recoloured, so the last item you rated does not lose its result the
                // moment it becomes the one you are on.
                const s = scores[r][ii];
                const cls = `${s === true ? "is-good" : s === false ? "is-bad" : ""} ${ii === i ? "is-current" : ""}`;
                return `<button type="button" class="ak-dot ${cls}" data-jump="${ii}" aria-label="${esc(t("ak.item", "Aufgabe {n}", { n: ii + 1 }))}"></button>`;
              })
              .join("")}
          </div>

          <p class="ak-stage-label">${
            esc(phase === "ready" ? t("ak.phase.ready", "Bereit?") :
            phase === "prompt" ? t("ak.phase.prompt", "Hör zu") :
            phase === "gap" ? t("ak.phase.gap", "Du bist dran — laut sagen!") :
            phase === "answer" ? t("ak.phase.answer", "So geht es") : t("ak.phase.rate", "Und? Richtig gesagt?"))
          }</p>

          <p class="ak-prompt">${esc(item().prompt)}</p>
          <div class="ak-arrow" aria-hidden="true">↓</div>
          <p class="ak-answer ${phase === "answer" || phase === "rate" ? "is-shown" : ""}">${
            phase === "answer" || phase === "rate" ? esc(item().answer) : "· · ·"
          }</p>

          <div class="ak-gap-ring ${phase === "gap" ? "is-running" : ""}" aria-hidden="true"><span class="ak-mic"></span></div>
        </div>

        <div class="ak-drill-actions">
          ${
            phase === "rate"
              ? `<button type="button" class="ak-rate ak-rate--no" data-rate="0">${esc(t("ak.rate.no", "Nochmal"))}</button>
                 <button type="button" class="ak-rate ak-rate--yes" data-rate="1">${esc(t("ak.rate.yes", "Konnte ich"))}</button>`
              : phase === "ready"
                ? `<button type="button" class="ak-go" data-go>${esc(fresh ? t("ak.go.start", "Drill starten") : t("ak.go.next", "Weiter"))}</button>`
                // Running, and stoppable. A drill that chains into the next item on its own
                // has to offer a way out that is not "leave the page" — the learner who
                // needs to rewind, or answer the door, taps this.
                : `<button type="button" class="ak-go ak-go--stop" data-stop>${esc(t("ak.go.stop", "Stopp"))}</button>`
          }
        </div>

        <div class="ak-drill-foot">
          <label class="ak-switch">
            <input type="checkbox" data-hands ${hands ? "checked" : ""}>
            <span>${esc(t("ak.hands", "Freihändig"))}<em>${esc(t("ak.hands.sub", "läuft durch, ohne Bewertung"))}</em></span>
          </label>
          <div class="ak-speeds" role="group" aria-label="${esc(t("ak.speed", "Tempo"))}">
            ${[0.75, 1, 1.25].map((v) => `<button type="button" class="ak-speed ${v === speed ? "is-active" : ""}" data-speed="${v}">${v}×</button>`).join("")}
          </div>
        </div>

        <p class="ak-drill-score">${esc(t("ak.score", "{done} / {total} bearbeitet", { done, total: cur.items.length }))}${done ? ` · ${esc(t("ak.score.sure", "{n} sicher", { n: good }))}` : ""}</p>
      </div>`;

    const go = root.querySelector("[data-go]");
    if (go) go.addEventListener("click", play);
    const halt = root.querySelector("[data-stop]");
    if (halt) halt.addEventListener("click", () => { stop(); phase = "ready"; render(); });
    root.querySelectorAll("[data-rate]").forEach((b) =>
      b.addEventListener("click", () => rateItem(b.dataset.rate === "1"))
    );
    root.querySelectorAll("[data-jump]").forEach((b) =>
      b.addEventListener("click", () => { stop(); i = +b.dataset.jump; phase = "ready"; render(); })
    );
    root.querySelectorAll("[data-round]").forEach((b) =>
      b.addEventListener("click", () => { stop(); r = +b.dataset.round; i = 0; phase = "ready"; render(); })
    );
    const sw = root.querySelector("[data-hands]");
    if (sw) sw.addEventListener("change", (e) => { hands = e.target.checked; });
    root.querySelectorAll("[data-speed]").forEach((b) =>
      b.addEventListener("click", () => { speed = +b.dataset.speed; render(); })
    );

    const ring = root.querySelector(".ak-gap-ring.is-running");
    if (ring) ring.style.setProperty("--gap-ms", gapMs(item().answer) + "ms");
  }

  function stop() {
    run++;
    voice.stop();
  }

  async function play() {
    const mine = ++run;
    const live = () => mine === run;

    phase = "prompt"; render();
    await voice.say({ text: item().prompt, audio: item().audioPrompt }, { rate: speed });
    if (!live()) return;

    phase = "gap"; render();
    await wait(gapMs(item().answer));
    if (!live()) return;

    phase = "answer"; render();
    await voice.say({ text: item().answer, audio: item().audioAnswer }, { rate: speed });
    if (!live()) return;

    if (hands) {
      await wait(400);
      if (live()) advance();
      return;
    }
    phase = "rate"; render();
  }

  function rateItem(ok) {
    scores[r][i] = ok;
    if (onRate) onRate(ok);
    advance();
  }

  function advance() {
    if (i < round().items.length - 1) {
      i++;
      phase = "ready";
      render();
      // Chained on purpose: a drill you have to re-tap between every item is not a drill.
      play();
    } else {
      phase = "ready";
      render();
    }
  }

  render();
  onUiText(render);
  return { stop };
}

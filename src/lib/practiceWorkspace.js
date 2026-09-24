// Shared "practice workspace" engine: Fokus-Modus (one question at a time) and
// Testmodus (compact list), sharing per-question progress within the session.
// Question shape: { id, difficulty?, prompt, options, answer, explain, explainLeicht?, change, audioSrc? }.
// `audioSrc` is the answer spoken (the Artikel-Trainer's "der Tisch"); optional. It plays
// once the question is settled — solved, or revealed — and the `change` chip replays it.
// `explainLeicht` is the Leichte-Sprache register of `explain`; optional, and absent means
// the switch leaves that question's explanation as it is.
// `difficulty` is optional — when absent, all questions form a single implicit group.

import { t, onUiText } from "./uiText.js";

const KNOWN_DIFFICULTY_ORDER = ["leicht", "mittel", "schwer"];
const WRONG_ATTEMPTS_BEFORE_REVEAL = 2;
const CORRECT_ADVANCE_DELAY_MS = 550;
const WRONG_FLASH_DELAY_MS = 550;

function sentenceHtml(prompt) {
  return prompt.replace("___", '<span class="akk-blank">___</span>');
}

const SPEAKER_SVG =
  '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>';

const MUTED_SVG =
  '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="m16 9 5 6"/><path d="m21 9-5 6"/></svg>';

/* Sound on or off, for the whole page and remembered per browser. On by default: the
   audio is the point, and a learner in a quiet room is one tap from turning it off. Off
   only silences the automatic play after an answer — a tap on the replay chip is an
   explicit ask and plays either way. */
const SOUND_KEY = "da.practice.sound";
let soundOn = true;
try { soundOn = localStorage.getItem(SOUND_KEY) !== "off"; } catch {}
export const isSoundOn = () => soundOn;

/* Langsam: the same file played at 0.7× with the pitch held, so a learner can hear where
   the article ends and the noun begins. No second recording needed — the browser stretches
   it. Remembered per browser like the sound switch. */
const SLOW_KEY = "da.practice.slow";
const SLOW_RATE = 0.7;
let slowOn = false;
try { slowOn = localStorage.getItem(SLOW_KEY) === "on"; } catch {}
function setSlowOn(on) {
  slowOn = Boolean(on);
  try { localStorage.setItem(SLOW_KEY, slowOn ? "on" : "off"); } catch {}
  document.querySelectorAll("[data-slow-toggle]").forEach((b) => b.setAttribute("aria-pressed", String(slowOn)));
}
export function setSoundOn(on) {
  soundOn = Boolean(on);
  try { localStorage.setItem(SOUND_KEY, soundOn ? "on" : "off"); } catch {}
  if (!soundOn && player) player.pause();
  document.dispatchEvent(new CustomEvent("practice:sound", { detail: { on: soundOn } }));
}

/* The "this word can be heard" mark beside the prompt. It cannot play the word before the
   answer — that would say the article — so it is the sound switch instead, and its icon
   says which way the switch is set. Only questions with a file get one, which is what
   tells a learner which words are voiced. */
function hearHtml(question, { slow = false } = {}) {
  if (!question.audioSrc) return "";
  const slowBtn = slow
    ? `<button type="button" class="akk-slow" data-slow-toggle aria-pressed="${slowOn}" title="${attr(t("pw.slow.title", "Langsamer vorlesen"))}"><span class="akk-slow-track" aria-hidden="true"><span class="akk-slow-knob"></span></span>${t("pw.slow", "Langsam")}</button>`
    : "";
  // One group, so a long noun on a phone takes the controls to the next line together
  // instead of leaving the speaker stranded under the word.
  return `<span class="akk-hear-group">${slowBtn}<button type="button" class="akk-hear" data-sound-toggle aria-pressed="${soundOn}"
    title="${attr(soundTitle())}"
    aria-label="${attr(t("pw.sound.aria", "Aussprache nach der Antwort"))}">${soundOn ? SPEAKER_SVG : MUTED_SVG}</button></span>`;
}
function soundTitle() {
  return soundOn
    ? t("pw.sound.on", "Nach der Antwort hörst du das Wort. Tippen: Ton aus")
    : t("pw.sound.off", "Ton ist aus. Tippen: Ton an");
}
function syncSoundMarks(scope = document) {
  scope.querySelectorAll(".akk-hear").forEach((b) => {
    b.setAttribute("aria-pressed", String(soundOn));
    b.title = soundTitle();
    b.innerHTML = soundOn ? SPEAKER_SVG : MUTED_SVG;
  });
}
if (typeof document !== "undefined") document.addEventListener("practice:sound", () => syncSoundMarks());

// One player for the page: a new answer cuts off the last one instead of talking over it,
// and it outlives the re-render Fokus-Modus does when it moves on to the next card.
let player = null;
function speak(question, { force = false } = {}) {
  if (!question.audioSrc || (!soundOn && !force)) return;
  if (!player) player = new Audio();
  player.pause();
  player.src = question.audioSrc;
  // Set after src: loading a new source resets the rate to the default.
  player.defaultPlaybackRate = player.playbackRate = slowOn ? SLOW_RATE : 1;
  player.preservesPitch = true;
  player.play().catch(() => {});
}

const attr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/* The "warum" line is the one the Leichte-Sprache switch matters most for: it is the
   sentence a learner reads precisely because they did not know the answer, and it was
   written at a level well above the question. A question that carries `explainLeicht` gets
   both registers on the element; one that does not keeps its single text and the switch
   leaves it alone. See src/lib/leichteSprache.js. */
function whyHtml(question) {
  const leicht = question.explainLeicht
    ? ` data-ls-leicht="${attr(question.explainLeicht)}"`
    : "";
  return `
    <div class="akk-why">
      <span class="akk-tag">${t("pw.why", "WARUM?")}</span>
      <p class="akk-why-text" data-ls="${attr(question.explain)}"${leicht}>${question.explain}</p>
      ${
        question.audioSrc
          ? `<button type="button" class="akk-why-chip akk-why-chip--audio" data-speak="${attr(question.id)}" aria-label="${attr(t("pw.listenTo", "{x} anhören", { x: question.change }))}">${SPEAKER_SVG}<span>${question.change}</span></button>`
          : `<span class="akk-why-chip">${question.change}</span>`
      }
    </div>`;
}

// `onAnswer(ok, id, { firstTry })`: `ok` is whether the question ended solved; `firstTry`
// says it was solved without a wrong tap first — the Artikel-Trainer counts only those
// toward "sicher", since a second try among three options is half a guess.
export function mountPracticeWorkspace(root, allQuestions, { onSessionUpdate, onAnswer } = {}) {
  // The chip in the WARUM box replays the answer; the mark beside the prompt flips the
  // sound. Delegated, because both modes re-render — and wired once per root, because the
  // Artikel-Trainer remounts into the same element for every round.
  root._practiceQuestions = allQuestions;
  if (!root._practiceWired) {
    root._practiceWired = true;
    root.addEventListener("click", (e) => {
      if (e.target.closest("[data-sound-toggle]")) return setSoundOn(!soundOn);
      const slowBtn = e.target.closest("[data-slow-toggle]");
      if (slowBtn) {
        setSlowOn(!slowOn);
        // Once the answer is out, hearing the change is the point of pressing it.
        const card = slowBtn.closest("[data-qid]");
        const q = card && root._practiceQuestions.find((x) => x.id === card.dataset.qid);
        if (q && card.dataset.settled === "true") speak(q, { force: true });
        return;
      }
      const chip = e.target.closest("[data-speak]");
      if (!chip) return;
      const q = root._practiceQuestions.find((x) => x.id === chip.dataset.speak);
      if (q) speak(q, { force: true });
    });
  }

  const hasTiers = allQuestions.some((q) => q.difficulty);
  const groups = hasTiers
    ? [...new Set(allQuestions.map((q) => q.difficulty))].sort(
        (a, b) => KNOWN_DIFFICULTY_ORDER.indexOf(a) - KNOWN_DIFFICULTY_ORDER.indexOf(b)
      )
    : ["alle"];
  const byGroup = Object.fromEntries(groups.map((g) => [g, hasTiers ? allQuestions.filter((q) => q.difficulty === g) : allQuestions]));

  const state = {
    group: groups[0],
    mode: "fokus",
    focusIndex: Object.fromEntries(groups.map((g) => [g, 0])),
    progress: Object.fromEntries(
      allQuestions.map((q) => [q.id, { answered: false, solved: false, revealed: false, wrongCount: 0 }])
    ),
  };

  function currentSet() {
    return byGroup[state.group];
  }

  function updateSession() {
    if (!onSessionUpdate) return;
    const set = currentSet();
    let answered = 0;
    let correct = 0;
    let hints = 0;
    set.forEach((q) => {
      const p = state.progress[q.id];
      if (p.answered) answered++;
      if (p.solved) correct++;
      if (p.wrongCount >= WRONG_ATTEMPTS_BEFORE_REVEAL) hints++;
    });
    onSessionUpdate({ answered, correct, hints, total: set.length, group: state.group });
  }

  function render() {
    root.innerHTML = state.mode === "fokus" ? renderFocusShell() : renderTestShell();
    if (state.mode === "fokus") wireFocus();
    else wireTest();
    updateSession();
  }

  // ---------- Fokus-Modus ----------
  function progressRailHtml(set, currentIdx) {
    return `
      <div class="akk-focus-progress">
        <button type="button" class="akk-back" id="akk-zurueck" aria-label="${attr(t("pw.prev", "Vorherige Frage"))}" title="${attr(t("pw.prev", "Vorherige Frage"))}"${currentIdx === 0 ? " disabled" : ""}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>
        </button>
        <div class="akk-rail">
          ${set
            .map((q, i) => {
              const cls = i < currentIdx ? "akk-rail-seg--done" : i === currentIdx ? "akk-rail-seg--current" : "";
              return `<span class="akk-rail-seg ${cls}"></span>`;
            })
            .join("")}
        </div>
        <span class="akk-counter">${currentIdx + 1} / ${set.length}</span>
      </div>`;
  }

  function renderFocusShell() {
    const set = currentSet();
    const idx = state.focusIndex[state.group];

    if (idx >= set.length) {
      const correct = set.filter((q) => state.progress[q.id].solved).length;
      return `
        <div class="akk-focus-done akk-anim-in">
          <div class="akk-focus-done-score">${correct} / ${set.length}</div>
          <p>${hasTiers ? t("pw.done.inGroup", "richtig in „{g}“", { g: t(`akk.diff.${state.group}`, state.group) }) : t("pw.done", "richtig")}</p>
          <div class="akk-focus-done-actions">
            <button class="akk-btn" id="akk-zurueck" type="button">${t("pw.back", "← Zurück")}</button>
            <button class="akk-btn akk-btn-primary" id="akk-focus-restart" type="button">${t("quiz.restart", "Nochmal üben")}</button>
          </div>
        </div>`;
    }

    const q = set[idx];
    const p = state.progress[q.id];
    const revealed = p.revealed;
    const solved = p.solved;
    const settled = solved || revealed;
    return `
      <div class="akk-anim-in">
        ${progressRailHtml(set, idx)}
        <div class="akk-focus-card" data-qid="${q.id}" data-settled="${settled}">
          <p class="akk-focus-sentence">${sentenceHtml(q.prompt)}${hearHtml(q, { slow: true })}</p>
          <div class="akk-pills">
            ${q.options
              .map((opt) => {
                const cls = revealed
                  ? (opt === q.answer ? "akk-pill--correct" : "akk-pill--incorrect")
                  : solved ? (opt === q.answer ? "akk-pill--correct" : "akk-pill--dim") : "";
                return `<button class="akk-pill ${cls}" type="button" data-opt="${opt}" ${settled ? "disabled" : ""}>${opt}</button>`;
              })
              .join("")}
          </div>
          <p class="akk-focus-instruction" data-ls="${attr(t("pw.instruction", "Wähle den passenden Artikel."))}" data-ls-leicht="${attr(t("pw.instruction.leicht", "Was passt: der, die oder das? Klicke auf ein Wort."))}">${t("pw.instruction", "Wähle den passenden Artikel.")}</p>
          <div class="akk-feedback" id="akk-focus-feedback">
            ${
              revealed
                ? `<div class="akk-feedback-row">
                     <span class="akk-feedback--incorrect">${t("pw.correctForm", "Die richtige Form ist „{a}“.", { a: q.answer })}</span>
                     <button class="akk-btn akk-btn-primary" id="akk-weiter" type="button">${t("quiz.next", "Weiter →")}</button>
                   </div>
                   ${whyHtml(q)}`
                : solved
                ? `<div class="akk-feedback-row">
                     <span class="akk-feedback--correct">${t("pw.right", "Richtig.")}</span>
                     <button class="akk-btn akk-btn-primary" id="akk-weiter" type="button">${t("quiz.next", "Weiter →")}</button>
                   </div>
                   ${whyHtml(q)}`
                : ""
            }
          </div>
        </div>
      </div>`;
  }

  // The auto-advance after a right answer is a timer; going back inside that window must
  // not have it fire afterwards and skip the card the learner went back to.
  let advanceTimer = null;
  function goToFocusIndex(nextIdx) {
    clearTimeout(advanceTimer);
    state.focusIndex[state.group] = Math.max(0, nextIdx);
    render();
  }

  function wireFocus() {
    const back = root.querySelector("#akk-zurueck");
    if (back) back.addEventListener("click", () => goToFocusIndex(state.focusIndex[state.group] - 1));

    const restart = root.querySelector("#akk-focus-restart");
    if (restart) {
      restart.addEventListener("click", () => {
        currentSet().forEach((q) => (state.progress[q.id] = { answered: false, solved: false, revealed: false, wrongCount: 0 }));
        state.focusIndex[state.group] = 0;
        render();
      });
      return;
    }

    const weiter = root.querySelector("#akk-weiter");
    if (weiter) {
      weiter.addEventListener("click", () => goToFocusIndex(state.focusIndex[state.group] + 1));
    }

    const card = root.querySelector(".akk-focus-card");
    const qid = card.dataset.qid;
    const question = allQuestions.find((q) => q.id === qid);
    const p = state.progress[qid];
    if (p.revealed || p.solved) return;

    const pills = [...root.querySelectorAll(".akk-pill")];

    pills.forEach((btn) => {
      btn.addEventListener("click", () => {
        pills.forEach((b) => (b.disabled = true));
        const ok = btn.dataset.opt === question.answer;
        p.answered = true;

        if (ok) {
          p.solved = true;
          btn.classList.add("akk-pill--correct", "akk-pill--pop");
          pills.forEach((b) => {
            if (b !== btn) b.classList.add("akk-pill--dim");
          });
          root.querySelector("#akk-focus-feedback").innerHTML = `<span class="akk-feedback--correct">${t("pw.right", "Richtig.")}</span>`;
          speak(question);
          if (onAnswer) onAnswer(true, question.id, { firstTry: p.wrongCount === 0 });
          updateSession();
          advanceTimer = setTimeout(() => goToFocusIndex(state.focusIndex[state.group] + 1), CORRECT_ADVANCE_DELAY_MS);
        } else {
          p.wrongCount++;
          if (p.wrongCount >= WRONG_ATTEMPTS_BEFORE_REVEAL) {
            p.revealed = true;
            speak(question);
            if (onAnswer) onAnswer(false, question.id, { firstTry: false });
            updateSession();
            render();
          } else {
            btn.classList.add("akk-pill--incorrect", "akk-pill--shake");
            updateSession();
            setTimeout(() => {
              pills.forEach((b) => {
                b.disabled = false;
                b.classList.remove("akk-pill--incorrect", "akk-pill--shake");
              });
            }, WRONG_FLASH_DELAY_MS);
          }
        }
      });
    });
  }

  // ---------- Testmodus ----------
  function renderTestShell() {
    const set = currentSet();
    const solved = set.filter((q) => state.progress[q.id].solved).length;
    const pct = set.length ? Math.round((solved / set.length) * 100) : 0;

    return `
      <div>
        <div class="akk-test-toolbar akk-anim-in">
          <span class="akk-test-count">${t("pw.solved", "{n} / {total} gelöst", { n: solved, total: set.length })}</span>
          <div class="akk-test-rail"><span class="akk-test-rail-fill" style="width:${pct}%"></span></div>
        </div>
        <div class="akk-test-list">
          ${set
            .map((q, i) => {
              const p = state.progress[q.id];
              let badgeContent = String(i + 1);
              let badgeCls = "";
              if (p.solved) {
                badgeContent = "✓";
                badgeCls = " akk-test-badge--solved";
              } else if (p.revealed) {
                badgeContent = "✗";
                badgeCls = " akk-test-badge--revealed";
              }
              const locked = p.solved || p.revealed;
              return `
              <div class="akk-test-row akk-anim-in" data-qid="${q.id}" style="animation-delay:${Math.min(i * 40, 240)}ms">
                <span class="akk-test-badge${badgeCls}">${badgeContent}</span>
                <div class="akk-test-body">
                  <p class="akk-test-sentence">${sentenceHtml(q.prompt)}${hearHtml(q)}</p>
                  <div class="akk-pills">
                    ${q.options
                      .map((opt) => {
                        const cls = p.revealed ? (opt === q.answer ? "akk-pill--correct" : "akk-pill--incorrect") : "";
                        return `<button class="akk-pill ${cls}" type="button" data-opt="${opt}" ${locked ? "disabled" : ""}>${opt}</button>`;
                      })
                      .join("")}
                  </div>
                  <div class="akk-row-why">${p.revealed ? whyHtml(q) : ""}</div>
                </div>
              </div>`;
            })
            .join("")}
        </div>
      </div>`;
  }

  function updateTestToolbar() {
    const set = currentSet();
    const solved = set.filter((q) => state.progress[q.id].solved).length;
    const pct = set.length ? Math.round((solved / set.length) * 100) : 0;
    const toolbar = root.querySelector(".akk-test-toolbar");
    if (!toolbar) return;
    toolbar.querySelector(".akk-test-count").textContent = t("pw.solved", "{n} / {total} gelöst", { n: solved, total: set.length });
    toolbar.querySelector(".akk-test-rail-fill").style.width = `${pct}%`;
  }

  function wireTest() {
    root.querySelectorAll(".akk-test-row").forEach((row) => {
      const qid = row.dataset.qid;
      const question = allQuestions.find((q) => q.id === qid);
      const p = state.progress[qid];
      if (p.solved || p.revealed) return;

      const pills = [...row.querySelectorAll(".akk-pill")];
      const badge = row.querySelector(".akk-test-badge");
      const whyBox = row.querySelector(".akk-row-why");

      pills.forEach((btn) => {
        btn.addEventListener("click", () => {
          pills.forEach((b) => (b.disabled = true));
          const ok = btn.dataset.opt === question.answer;
          p.answered = true;

          if (ok) {
            p.solved = true;
            btn.classList.add("akk-pill--correct", "akk-pill--pop");
            pills.forEach((b) => {
              if (b !== btn) b.classList.add("akk-pill--dim");
            });
            badge.textContent = "✓";
            badge.classList.add("akk-test-badge--solved", "akk-pill--pop");
            speak(question);
            if (onAnswer) onAnswer(true, question.id, { firstTry: p.wrongCount === 0 });
            updateSession();
            updateTestToolbar();
          } else {
            p.wrongCount++;
            if (p.wrongCount >= WRONG_ATTEMPTS_BEFORE_REVEAL) {
              p.revealed = true;
              pills.forEach((b) => {
                b.classList.add(b.dataset.opt === question.answer ? "akk-pill--correct" : "akk-pill--incorrect");
              });
              badge.textContent = "✗";
              badge.classList.add("akk-test-badge--revealed", "akk-pill--pop");
              whyBox.innerHTML = whyHtml(question);
              whyBox.firstElementChild.classList.add("akk-anim-in");
              speak(question);
              if (onAnswer) onAnswer(false, question.id, { firstTry: false });
              updateSession();
            } else {
              btn.classList.add("akk-pill--incorrect", "akk-pill--shake");
              updateSession();
              setTimeout(() => {
                pills.forEach((b) => {
                  b.disabled = false;
                  b.classList.remove("akk-pill--incorrect", "akk-pill--shake");
                });
              }, WRONG_FLASH_DELAY_MS);
            }
          }
        });
      });
    });
  }

  // ---------- Public controls ----------
  function setDifficulty(group) {
    state.group = group;
    render();
  }
  function setMode(mode) {
    state.mode = mode;
    render();
  }

  render();
  // Words follow the UI language. One subscription per root: the Artikel-Trainer remounts
  // into the same element for every round.
  root._practiceUiOff?.();
  root._practiceUiOff = onUiText(() => { if (root._practiceQuestions === allQuestions) render(); });

  return { setDifficulty, setMode, groups, hasTiers };
}

// Shared "practice workspace" engine: Fokus-Modus (one question at a time) and
// Testmodus (compact list), sharing per-question progress within the session.
// Question shape: { id, difficulty?, prompt, options, answer, explain, change }.
// `difficulty` is optional — when absent, all questions form a single implicit group.

const KNOWN_DIFFICULTY_ORDER = ["leicht", "mittel", "schwer"];
const WRONG_ATTEMPTS_BEFORE_REVEAL = 2;
const CORRECT_ADVANCE_DELAY_MS = 550;
const WRONG_FLASH_DELAY_MS = 550;

function sentenceHtml(prompt) {
  return prompt.replace("___", '<span class="akk-blank">___</span>');
}

function whyHtml(question) {
  return `
    <div class="akk-why">
      <span class="akk-tag">WARUM?</span>
      <p class="akk-why-text">${question.explain}</p>
      <span class="akk-why-chip">${question.change}</span>
    </div>`;
}

export function mountPracticeWorkspace(root, allQuestions, { onSessionUpdate } = {}) {
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
          <p>richtig${hasTiers ? ` in „${state.group}“` : ""}</p>
          <button class="akk-btn akk-btn-primary" id="akk-focus-restart" type="button">Nochmal üben</button>
        </div>`;
    }

    const q = set[idx];
    const p = state.progress[q.id];
    const revealed = p.revealed;
    return `
      <div class="akk-anim-in">
        ${progressRailHtml(set, idx)}
        <div class="akk-focus-card" data-qid="${q.id}">
          <p class="akk-focus-sentence">${sentenceHtml(q.prompt)}</p>
          <div class="akk-pills">
            ${q.options
              .map((opt) => {
                const cls = revealed ? (opt === q.answer ? "akk-pill--correct" : "akk-pill--incorrect") : "";
                return `<button class="akk-pill ${cls}" type="button" data-opt="${opt}" ${revealed ? "disabled" : ""}>${opt}</button>`;
              })
              .join("")}
          </div>
          <p class="akk-focus-instruction">Wähle den passenden Artikel.</p>
          <div class="akk-feedback" id="akk-focus-feedback">
            ${
              revealed
                ? `<div class="akk-feedback-row">
                     <span class="akk-feedback--incorrect">Die richtige Form ist „${q.answer}“.</span>
                     <button class="akk-btn akk-btn-primary" id="akk-weiter" type="button">Weiter →</button>
                   </div>
                   ${whyHtml(q)}`
                : ""
            }
          </div>
        </div>
      </div>`;
  }

  function goToFocusIndex(nextIdx) {
    state.focusIndex[state.group] = nextIdx;
    render();
  }

  function wireFocus() {
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
    if (p.revealed) return;

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
          root.querySelector("#akk-focus-feedback").innerHTML = `<span class="akk-feedback--correct">Richtig.</span>`;
          updateSession();
          setTimeout(() => goToFocusIndex(state.focusIndex[state.group] + 1), CORRECT_ADVANCE_DELAY_MS);
        } else {
          p.wrongCount++;
          if (p.wrongCount >= WRONG_ATTEMPTS_BEFORE_REVEAL) {
            p.revealed = true;
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
          <span class="akk-test-count">${solved} / ${set.length} gelöst</span>
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
                  <p class="akk-test-sentence">${sentenceHtml(q.prompt)}</p>
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
    toolbar.querySelector(".akk-test-count").textContent = `${solved} / ${set.length} gelöst`;
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

  return { setDifficulty, setMode, groups, hasTiers };
}

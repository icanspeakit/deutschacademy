// Shared quiz engine: mode "text" (typed answer) or "choice" (buttons).
export function mountQuiz(root, questions, { mode = "text", shuffle = true, onDone } = {}) {
  let order = questions.map((_, i) => i);
  if (shuffle) order = order.sort(() => Math.random() - 0.5);
  let pos = 0;
  let score = 0;
  const total = order.length;

  function render() {
    if (pos >= total) {
      root.innerHTML = `
        <div class="quiz-done">
          <div class="quiz-done-score">${score} / ${total}</div>
          <p>richtig beantwortet</p>
          <button class="quiz-btn quiz-btn--primary" id="quiz-restart" type="button">Nochmal üben</button>
        </div>`;
      root.querySelector("#quiz-restart").addEventListener("click", () => {
        order = order.sort(() => Math.random() - 0.5);
        pos = 0;
        score = 0;
        render();
      });
      if (onDone) onDone(score, total);
      return;
    }
    const q = questions[order[pos]];
    let inputHtml;
    if (mode === "choice") {
      inputHtml = `<div class="quiz-choices">${q.options
        .map((opt, i) => `<button class="quiz-choice" type="button" data-opt="${i}">${opt}</button>`)
        .join("")}</div>`;
    } else {
      inputHtml = `
        <form id="quiz-form" class="quiz-form" autocomplete="off">
          <input type="text" id="quiz-input" autocomplete="off" placeholder="Antwort eintippen…" />
          <button type="submit" class="quiz-btn quiz-btn--primary">Prüfen</button>
        </form>`;
    }
    root.innerHTML = `
      <div class="quiz-progress">Frage ${pos + 1} / ${total} · ${score} richtig</div>
      <div class="quiz-prompt">${q.prompt}</div>
      ${inputHtml}
      <div class="quiz-feedback" id="quiz-feedback"></div>`;

    const feedback = root.querySelector("#quiz-feedback");

    function lockInputs() {
      root.querySelectorAll(".quiz-choice").forEach((b) => (b.disabled = true));
      const form = root.querySelector("#quiz-form");
      if (form) [...form.elements].forEach((el) => (el.disabled = true));
    }

    function checkAnswer(given) {
      const norm = (s) => String(s).trim().toLowerCase();
      const accepted = [q.answer, ...(q.alt || [])].map(norm);
      const ok = accepted.includes(norm(given));
      if (ok) score++;
      feedback.innerHTML = ok
        ? `<span class="quiz-ok">✓ Richtig!</span>`
        : `<span class="quiz-no">✗ Nicht ganz — richtig: <strong>${q.answer}</strong></span>`;
      if (q.explain) feedback.innerHTML += `<div class="quiz-explain">${q.explain}</div>`;
      const nextBtn = document.createElement("button");
      nextBtn.className = "quiz-btn quiz-btn--next";
      nextBtn.type = "button";
      nextBtn.textContent = pos + 1 < total ? "Weiter →" : "Ergebnis anzeigen →";
      nextBtn.addEventListener("click", () => {
        pos++;
        render();
      });
      feedback.appendChild(nextBtn);
      lockInputs();
      if (mode === "choice") {
        root.querySelectorAll(".quiz-choice").forEach((b) => {
          if (norm(b.textContent) === norm(q.answer)) b.classList.add("quiz-choice--correct");
        });
      }
    }

    if (mode === "choice") {
      root.querySelectorAll(".quiz-choice").forEach((btn) => {
        btn.addEventListener("click", () => checkAnswer(q.options[+btn.dataset.opt]));
      });
    } else {
      const form = root.querySelector("#quiz-form");
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        checkAnswer(root.querySelector("#quiz-input").value);
      });
      root.querySelector("#quiz-input").focus();
    }
  }
  render();
}

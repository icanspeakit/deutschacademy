// "Lernen" mode: one card at a time, self-assessed via Weiß ich / Weiß ich nicht.
// Unknown cards get requeued a few positions later; known cards are removed until the deck is empty.
const LANG_STORAGE_KEY = "da-fc-lang";

export function mountLearn(root, cards, { languages = [] } = {}) {
  let queue = cards.map((_, i) => i).sort(() => Math.random() - 0.5);
  const total = queue.length;
  let mastered = 0;
  let flipped = false;

  let storedLang = null;
  try { storedLang = localStorage.getItem(LANG_STORAGE_KEY); } catch {}
  let lang = languages.some((l) => l.code === storedLang) ? storedLang : languages[0]?.code ?? null;

  function render() {
    if (queue.length === 0) {
      root.innerHTML = `
        <div class="quiz-done">
          <div class="quiz-done-score">🎉 ${total} / ${total}</div>
          <p>Alle Karten gelernt!</p>
          <button class="quiz-btn quiz-btn--primary" id="lrn-restart" type="button">Nochmal üben</button>
        </div>`;
      root.querySelector("#lrn-restart").addEventListener("click", () => {
        queue = cards.map((_, i) => i).sort(() => Math.random() - 0.5);
        mastered = 0;
        flipped = false;
        render();
      });
      return;
    }

    const card = cards[queue[0]];
    const meta = languages.find((l) => l.code === lang);
    const isRtl = !!meta?.rtl;
    const translation = lang ? card.translations?.[lang] : null;
    const front = translation && translation.trim() ? translation : "Übersetzung folgt";
    const pct = Math.round((mastered / total) * 100);

    const langPicker = languages.length
      ? `<div class="fc-lang-picker" role="group" aria-label="Sprache wählen">
          ${languages.map((l) => `<button type="button" class="topic-tab fc-lang-btn ${l.code === lang ? "active" : ""}" data-lang="${l.code}">${l.label}</button>`).join("")}
        </div>`
      : "";

    root.innerHTML = `
      ${langPicker}
      <div class="lrn-progress">
        <span class="lrn-progress-dot lrn-progress-dot--start">${mastered}</span>
        <span class="lrn-progress-track"><span class="lrn-progress-fill" style="width:${pct}%"></span></span>
        <span class="lrn-progress-dot lrn-progress-dot--end">${total}</span>
      </div>
      <div class="lrn-card" id="lrn-card" tabindex="0" role="button" aria-label="Karte umdrehen">
        ${flipped
          ? `<span class="lrn-answer">${card.front}</span>`
          : `<span class="${isRtl ? "fc-back-text--rtl" : ""}" ${isRtl ? `dir="rtl"` : ""} lang="${lang ?? ""}">${front}</span>`}
      </div>
      <div class="lrn-controls">
        <button class="quiz-btn lrn-btn--no" id="lrn-no" type="button">✗ Weiß ich nicht</button>
        <button class="quiz-btn quiz-btn--primary" id="lrn-yes" type="button">✓ Weiß ich</button>
      </div>`;

    root.querySelectorAll(".fc-lang-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        lang = btn.dataset.lang;
        try { localStorage.setItem(LANG_STORAGE_KEY, lang); } catch {}
        render();
      });
    });

    root.querySelector("#lrn-card").addEventListener("click", () => {
      flipped = !flipped;
      render();
    });

    function judge(knew) {
      if (!flipped) {
        flipped = true;
        render();
        return;
      }
      const idx = queue.shift();
      if (knew) {
        mastered++;
      } else {
        const insertAt = Math.min(queue.length, 2 + Math.floor(Math.random() * 2));
        queue.splice(insertAt, 0, idx);
      }
      flipped = false;
      render();
    }
    root.querySelector("#lrn-no").addEventListener("click", () => judge(false));
    root.querySelector("#lrn-yes").addEventListener("click", () => judge(true));
  }
  render();
}

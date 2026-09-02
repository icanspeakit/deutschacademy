// Shared flashcard deck: click/flip, prev/next, shuffle, per-language translation picker.
const LANG_STORAGE_KEY = "da-fc-lang";

export function mountFlashcards(root, cards, { shuffle = true, languages = [] } = {}) {
  let order = cards.map((_, i) => i);
  if (shuffle) order = order.sort(() => Math.random() - 0.5);
  let pos = 0;
  let flipped = false;

  let storedLang = null;
  try { storedLang = localStorage.getItem(LANG_STORAGE_KEY); } catch {}
  let lang = languages.some((l) => l.code === storedLang) ? storedLang : languages[0]?.code ?? null;

  function render() {
    const card = cards[order[pos]];
    const meta = languages.find((l) => l.code === lang);
    const isRtl = !!meta?.rtl;
    const translation = lang ? card.translations?.[lang] : null;
    const backText = translation && translation.trim() ? translation : "Übersetzung folgt";

    const langPicker = languages.length
      ? `<div class="fc-lang-picker" role="group" aria-label="Sprache wählen">
          ${languages.map((l) => `<button type="button" class="topic-tab fc-lang-btn ${l.code === lang ? "active" : ""}" data-lang="${l.code}">${l.label}</button>`).join("")}
        </div>`
      : "";

    root.innerHTML = `
      ${langPicker}
      <div class="fc-progress">${pos + 1} / ${order.length}</div>
      <div class="fc-card ${flipped ? "fc-card--flipped" : ""}" id="fc-card" tabindex="0" role="button" aria-label="Karte umdrehen">
        <div class="fc-face fc-face--front"><span>${card.front}</span></div>
        <div class="fc-face fc-face--back">
          <div class="fc-back-content">
            <span class="fc-back-text ${isRtl ? "fc-back-text--rtl" : ""}" ${isRtl ? `dir="rtl"` : ""} lang="${lang ?? ""}">${backText}</span>
            ${card.note ? `<span class="fc-note">${card.note}</span>` : ""}
          </div>
        </div>
      </div>
      <div class="fc-controls">
        <button class="quiz-btn" id="fc-prev" type="button">← Zurück</button>
        <button class="quiz-btn quiz-btn--primary" id="fc-flip" type="button">Umdrehen</button>
        <button class="quiz-btn" id="fc-next" type="button">Weiter →</button>
      </div>
      <button class="quiz-btn quiz-btn--ghost" id="fc-shuffle" type="button">🔀 Mischen</button>`;

    root.querySelectorAll(".fc-lang-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        lang = btn.dataset.lang;
        try { localStorage.setItem(LANG_STORAGE_KEY, lang); } catch {}
        render();
      });
    });

    const flip = () => {
      flipped = !flipped;
      render();
    };
    root.querySelector("#fc-card").addEventListener("click", flip);
    root.querySelector("#fc-flip").addEventListener("click", flip);
    root.querySelector("#fc-prev").addEventListener("click", () => {
      pos = (pos - 1 + order.length) % order.length;
      flipped = false;
      render();
    });
    root.querySelector("#fc-next").addEventListener("click", () => {
      pos = (pos + 1) % order.length;
      flipped = false;
      render();
    });
    root.querySelector("#fc-shuffle").addEventListener("click", () => {
      order = order.sort(() => Math.random() - 0.5);
      pos = 0;
      flipped = false;
      render();
    });
  }
  render();
}

// Pronunciation grid: click a card to hear it, toggle 1x/0.75x playback speed.
export function mountPronunciation(root, items) {
  let rate = 1;
  let activeAudio = null;
  let activeCard = null;

  function stopActive() {
    if (activeAudio) {
      activeAudio.pause();
      activeAudio.currentTime = 0;
    }
    if (activeCard) activeCard.classList.remove("pron-card--playing");
    activeAudio = null;
    activeCard = null;
  }

  function play(card, audioSrc) {
    if (activeCard === card) {
      stopActive();
      return;
    }
    stopActive();
    const audio = new Audio(audioSrc);
    audio.playbackRate = rate;
    audio.addEventListener("ended", stopActive);
    audio.addEventListener("error", stopActive);
    card.classList.add("pron-card--playing");
    activeAudio = audio;
    activeCard = card;
    audio.play().catch(stopActive);
  }

  root.innerHTML = `
    <div class="pron-toolbar">
      <button class="quiz-btn" id="pron-speed" type="button">🐢 Langsam abspielen</button>
    </div>
    <div class="pron-grid">
      ${items
        .map(
          (item, i) => `
        <button class="pron-card" type="button" data-index="${i}">
          <span class="pron-play-icon">🔊</span>
          <span class="pron-text">${item.text}</span>
        </button>`
        )
        .join("")}
    </div>`;

  root.querySelectorAll(".pron-card").forEach((card) => {
    const item = items[Number(card.dataset.index)];
    card.addEventListener("click", () => play(card, item.audioSrc));
  });

  const speedBtn = root.querySelector("#pron-speed");
  speedBtn.addEventListener("click", () => {
    rate = rate === 1 ? 0.75 : 1;
    speedBtn.textContent = rate === 1 ? "🐢 Langsam abspielen" : "🐢 Langsam (aktiv)";
    speedBtn.classList.toggle("active", rate !== 1);
    if (activeAudio) activeAudio.playbackRate = rate;
  });
}

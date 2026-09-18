// Unified engine for the Wortschatz page (Karteikarten / Lernen / Testen / Wortliste), matching
// the "Wortschatz Prototyp" design: one shared deck position, one results map keyed
// `${mode}:${cardIndex}`, and a selection-based custom round ("Auswahl testen") that flows
// from Wortliste into Testen. Kept page-local (not the shared quiz.js/flashcards.js engines)
// because those are reused by other practice pages with a different, simpler visual language.

const PUNCT_RE = new RegExp("[.!?,;:„“”\"']", "g");

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .trim()
    .replace(PUNCT_RE, "")
    .replace(/\s+/g, " ")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss");
}

export function mountWortschatzApp(els, cards, languages, { onAnswer, onSessionStart } = {}) {
  const { tabsEl, langTabsEl, dirSwitch, dirLabel, deckChip, counterEl, contentEl, eyebrowEl } = els;

  const eyebrows = { cards: "Karteikarten", learn: "Lernen", test: "Testen", list: "Wortliste" };

  const state = {
    mode: "cards",
    lastMode: "cards",
    idx: 0,
    lang: languages[0]?.code ?? null,
    dir: "toDe",
    flipped: false,
    pick: null,
    input: "",
    checked: false,
    results: {},
    selected: {},
    filter: null,
    part: 0,
    tick: 0,
  };

  let sessionStarted = false;
  // Set by a finished swipe, cleared by the click it swallows — see attachSwipe(). The
  // timer is the safety net: a browser only emits that click sometimes, and a flag left
  // standing would eat a deliberate tap on the next card.
  let suppressClick = false;
  function swallowNextClick() {
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 400);
  }

  /* A level deck is 650 cards, and a counter reading "01 / 650" is a wall, not a target:
     the learner has done one card and the number tells them about the 649 waiting. So a
     deck bigger than one sitting runs in parts of PART_SIZE — the counter says "01 / 25",
     the chip says which Runde — and the parts join end to end, so going past the last card
     of a part opens the next one rather than looping. "Runde", not "Teil": a Teil is a
     Portion route (a1-teil-03), a different 20-word cut of the same level, and Runde is
     what the Artikel-Trainer already calls a sitting. It is the same 650 words; it is just
     handed over in pieces someone can finish. PART_SIZE matches the Lernset (25 words) and
     the Artikel-Runde, so "one sitting" means the same thing everywhere on the site.

     A selection made in the Wortliste tab is already a hand-picked deck, so it is never
     cut further. */
  const PART_SIZE = 25;
  const partCount = Math.max(1, Math.ceil(cards.length / PART_SIZE));
  const chunked = partCount > 1;

  function filtered() {
    return !!(state.filter && state.filter.length);
  }

  function deck() {
    if (filtered()) return state.filter;
    if (!chunked) return cards.map((_, i) => i);
    const from = state.part * PART_SIZE;
    return cards.slice(from, from + PART_SIZE).map((_, i) => from + i);
  }

  /** Jump to a part, landing on its first card — or its last, when we arrived backwards. */
  function setPart(n, edge) {
    const part = (n + partCount) % partCount;
    const from = part * PART_SIZE;
    const size = Math.min(PART_SIZE, cards.length - from);
    reset({ part, idx: edge === "last" ? from + size - 1 : from });
    noteActivity();
    render();
  }

  /* Coaching hint ("Umdrehen für Englisch", "Tippen zum Umdrehen · wischen zum Blättern").
     It teaches the card in the first two seconds and then repeats itself once per word,
     25 times a set. So it shows once on arrival, fades out the moment the learner touches
     anything, and stays gone for every card after that — a flashcard only needs explaining
     once. The idle timer is the rescue for the learner it did not reach: a card left
     untouched on its front face for COACH_IDLE_MS means the gesture never landed, so the
     line fades back in until the next interaction. Armed only on the unflipped front —
     sitting on an answer for eight seconds is reading, not confusion. */
  const COACH_IDLE_MS = 8000;
  let coachOn = true;
  let idleTimer = null;

  function setCoach(on) {
    coachOn = on;
    contentEl.classList.toggle("vt-coach-on", on);
  }
  function armIdleCoach() {
    clearTimeout(idleTimer);
    if (state.mode !== "cards" || state.flipped) return;
    idleTimer = setTimeout(() => setCoach(true), COACH_IDLE_MS);
  }
  function noteActivity() {
    if (coachOn) setCoach(false);
    armIdleCoach();
  }


  function langMeta() {
    return languages.find((l) => l.code === state.lang) || languages[0] || {};
  }

  function foreignText(card) {
    const t = state.lang ? card.translations?.[state.lang] : null;
    return t && t.trim() ? t : "Übersetzung folgt";
  }

  // front()/back() follow the toolbar direction switch: "toDe" quizzes the foreign phrase
  // and expects German back; "fromDe" is the reverse.
  function front(card) { return state.dir === "toDe" ? foreignText(card) : card.front; }
  function back(card) { return state.dir === "toDe" ? card.front : foreignText(card); }

  function record(ok) {
    state.results[`${state.mode}:${state.idx}`] = ok;
    if (onAnswer) onAnswer(ok, cards[state.idx], state.idx);
  }

  function reset(extra) {
    state.tick++;
    state._learnOptions = null;
    Object.assign(state, { flipped: false, pick: null, input: "", checked: false }, extra);
  }

  function go(d) {
    const dk = deck();
    const p = dk.indexOf(state.idx);
    const at = (p < 0 ? 0 : p) + d;
    if (chunked && !filtered() && (at < 0 || at >= dk.length)) {
      setPart(state.part + (d > 0 ? 1 : -1), d > 0 ? "first" : "last");
      return;
    }
    reset({ idx: dk[(at + dk.length) % dk.length] });
    noteActivity();
    render();
  }

  function flip() {
    state.flipped = !state.flipped;
    noteActivity();
    // Toggle the class on the existing element rather than re-rendering: a fresh
    // .vt-flip-inner created via innerHTML already starts in its target rotation, so the
    // CSS transition never has a "from" state to animate — the flip just snaps instantly.
    const inner = state.mode === "cards" ? contentEl.querySelector(".vt-flip-inner") : null;
    if (inner) inner.classList.toggle("is-flipped", state.flipped);
    else render();
  }

  function setMode(mode) {
    reset({ mode });
    if (mode !== "cards") clearTimeout(idleTimer);
    if (mode !== "list") state.lastMode = mode;
    render();
  }

  function pickOption(label) {
    if (state.pick) return;
    const ok = label === back(cards[state.idx]);
    state.pick = label;
    record(ok);
    render();
  }

  function check() {
    if (state.checked) { go(1); return; }
    const ok = norm(state.input) === norm(back(cards[state.idx]));
    state.checked = true;
    record(ok);
    render();
  }

  function skip() { go(1); }

  function toggleDir() {
    reset({ dir: state.dir === "toDe" ? "fromDe" : "toDe" });
    render();
  }

  // Patch the affected row's classes in place instead of calling render(): renderList()
  // rebuilds the whole .vt-content node, which replays the tab-swap fade/slide animation
  // across the entire list. Picking a word should only animate that word's checkmark dot.
  function updateListRow(i) {
    const row = contentEl.querySelector(`.vt-list-row[data-i="${i}"]`);
    if (!row) return;
    const selected = !!state.selected[i];
    row.classList.toggle("is-selected", selected);
    const box = row.querySelector(".vt-list-box");
    if (!box) return;
    box.classList.remove("is-selected");
    if (selected) {
      void box.offsetWidth;
      box.classList.add("is-selected");
    }
  }

  function updateSelBar() {
    const selIds = selectedIds();
    const label = contentEl.querySelector(".vt-sel-label");
    if (label) {
      label.textContent = selIds.length
        ? `${selIds.length} von ${cards.length} Wörtern ausgewählt`
        : "Tippe Wörter an, um eine eigene Runde zusammenzustellen.";
    }
    const startBtn = contentEl.querySelector("#vt-sel-start");
    if (startBtn) startBtn.classList.toggle("is-active", !!selIds.length);
    const allBtn = contentEl.querySelector("#vt-sel-all");
    if (allBtn) allBtn.textContent = selIds.length === cards.length ? "Auswahl aufheben" : "Alle auswählen";
  }

  function toggleSelect(i) {
    if (state.selected[i]) delete state.selected[i];
    else state.selected[i] = true;
    updateListRow(i);
    updateSelBar();
  }

  function jumpTo(i) {
    reset({ idx: i, mode: state.lastMode });
    render();
  }

  // The chip is the deck's label and its one control: it drops a selection when there is
  // one, and otherwise steps to the next part — the same thing running off the end of a
  // part does, for a learner who would rather skip ahead than page through.
  function deckChipClick() {
    if (filtered()) { reset({ filter: null, part: 0, idx: 0 }); render(); return; }
    if (chunked) setPart(state.part + 1);
  }

  function startSelection() {
    const ids = selectedIds();
    if (!ids.length) return;
    reset({ filter: ids, idx: ids[0], mode: "test" });
    state.lastMode = "test";
    render();
  }

  function clearSelection() {
    const prev = selectedIds();
    state.selected = {};
    prev.forEach(updateListRow);
    updateSelBar();
  }

  function selectAll() {
    const all = Object.keys(state.selected).length === cards.length;
    state.selected = {};
    if (!all) cards.forEach((_, i) => (state.selected[i] = true));
    cards.forEach((_, i) => updateListRow(i));
    updateSelBar();
  }

  function selectedIds() {
    return Object.keys(state.selected).map(Number).sort((a, b) => a - b);
  }

  function optionLabels() {
    const idx = state.idx;
    const correct = back(cards[idx]);
    const pool = cards
      .map((c, i) => ({ i, v: back(c) }))
      .filter((o) => o.i !== idx && o.v !== correct);
    const shuffled = pool.slice().sort(() => Math.random() - 0.5);
    const distractors = [];
    for (const o of shuffled) {
      if (distractors.length >= 3) break;
      if (!distractors.includes(o.v)) distractors.push(o.v);
    }
    const options = [correct, ...distractors];
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
    return options;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function swapClass() { return state.tick % 2 ? "vt-swap-a" : "vt-swap-b"; }

  function renderToolbar() {
    langTabsEl.innerHTML = languages
      .map((l) => `<button type="button" class="vt-lang-tab ${l.code === state.lang ? "active" : ""}" data-lang="${l.code}">${escapeHtml(l.label)}</button>`)
      .join("");
    langTabsEl.querySelectorAll(".vt-lang-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        reset({ lang: btn.dataset.lang });
        render();
      });
    });

    const meta = langMeta();
    const deName = meta.deName ?? meta.label ?? "";
    dirSwitch.checked = state.dir === "toDe";
    dirLabel.textContent = state.dir === "toDe" ? `${deName} → Deutsch` : `Deutsch → ${deName}`;

    const isFiltered = filtered();
    deckChip.textContent = isFiltered ? `Auswahl: ${state.filter.length} · alle zeigen`
      : chunked ? `Runde ${state.part + 1} von ${partCount} ›`
      : `Alle ${cards.length} Wörter`;
    deckChip.classList.toggle("is-filtered", isFiltered);

    const dk = deck();
    const pos = Math.max(0, dk.indexOf(state.idx));
    counterEl.textContent = `${String(pos + 1).padStart(2, "0")} / ${String(dk.length).padStart(2, "0")}`;

    eyebrowEl.textContent = eyebrows[state.mode];
    [...tabsEl.children].forEach((btn) => btn.classList.toggle("active", btn.dataset.tab === state.mode));
  }

  function renderCards() {
    const card = cards[state.idx];
    const meta = langMeta();
    const isRtl = !!meta.rtl;
    const toDe = state.dir === "toDe";
    const deLabel = card.cat ? `Deutsch · ${card.cat}` : "Deutsch";
    const frontLabel = toDe ? meta.deName ?? meta.label : deLabel;
    const backLabel = toDe ? deLabel : meta.deName ?? meta.label;
    const frontRtl = toDe && isRtl;
    const backRtl = !toDe && isRtl;
    const flipHint = state.flipped ? "Zurück zur Vorderseite" : `Umdrehen für ${toDe ? "Deutsch" : meta.deName ?? meta.label}`;

    contentEl.innerHTML = `
      <div class="vt-content ${swapClass()}">
        <div class="vt-flip" id="vt-flip">
          <div class="vt-flip-inner ${state.flipped ? "is-flipped" : ""}">
            <div class="vt-face">
              <span class="vt-face-eyebrow">${escapeHtml(frontLabel)}</span>
              <span class="vt-prompt ${frontRtl ? "vt-rtl" : ""}">${escapeHtml(front(card))}</span>
              <span class="vt-hint">${escapeHtml(flipHint)}</span>
            </div>
            <div class="vt-face vt-face--back">
              <span class="vt-face-eyebrow">${escapeHtml(backLabel)}</span>
              <span class="vt-answer ${backRtl ? "vt-rtl" : ""}">${escapeHtml(back(card))}</span>
              <span class="vt-hint">Zurück zur Vorderseite</span>
            </div>
          </div>
        </div>
        <div class="vt-nav-row">
          <button type="button" class="vt-nav-link" id="vt-prev">Zurück</button>
          <button type="button" class="vt-nav-flip" id="vt-flip-btn">Umdrehen</button>
          <button type="button" class="vt-nav-next" id="vt-next">Weiter →</button>
        </div>
        <p class="vt-kbd-hint">
          <span class="vt-hint-touch">Tippen zum Umdrehen · wischen zum Blättern</span>
          <span class="vt-hint-keys">Leertaste umdrehen · ← → blättern</span>
        </p>
      </div>`;

    // The class carries the hint's opacity (see vokabeltrainer.css). Re-adding it a frame
    // after the fresh nodes land lets it fade in rather than snap on the first card.
    contentEl.classList.remove("vt-coach-on");
    if (coachOn) requestAnimationFrame(() => contentEl.classList.add("vt-coach-on"));
    armIdleCoach();

    const flipEl = contentEl.querySelector("#vt-flip");
    // Guarded rather than calling flip() straight: the click a finished swipe generates
    // would otherwise flip the card the swipe just moved away from.
    flipEl.addEventListener("click", () => {
      if (suppressClick) { suppressClick = false; return; }
      flip();
    });
    attachSwipe(flipEl);
    contentEl.querySelector("#vt-flip-btn").addEventListener("click", flip);
    contentEl.querySelector("#vt-prev").addEventListener("click", () => go(-1));
    contentEl.querySelector("#vt-next").addEventListener("click", () => go(1));
  }

  /* Swipe the card left/right to move through the deck.
     On a phone the nav row is three small text links under a card that fills the screen —
     reaching them means aiming, once per word, 25 times per set. A swipe is the gesture
     every other flashcard app on that phone already uses, so it needs no hint.
     The card follows the finger while dragging (a gesture with no feedback feels broken),
     and the thumbnail rules are: past a third of the card's width, or fast enough to read
     as a flick, counts as a turn; anything shorter springs back. Vertical intent wins
     early — touch-action: pan-y means the page still scrolls normally. */
  const SWIPE_DISTANCE = 0.33; // of the card's width
  const SWIPE_VELOCITY = 0.5; // px per ms
  const SWIPE_MIN = 24; // px — below this it is a twitch, however fast
  function attachSwipe(el) {
    let x0 = 0, y0 = 0, t0 = 0, dx = 0, axis = null, active = false;

    const setDrag = (px) => {
      el.style.transform = px ? `translateX(${px}px)` : "";
      el.style.opacity = px ? String(Math.max(0.45, 1 - Math.abs(px) / (el.offsetWidth || 1))) : "";
    };
    const release = () => {
      el.style.transition = "transform .22s ease, opacity .22s ease";
      setDrag(0);
      setTimeout(() => { el.style.transition = ""; }, 240);
    };

    el.addEventListener("touchstart", (e) => {
      if (e.touches.length !== 1) return;
      active = true; axis = null; dx = 0;
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; t0 = Date.now();
      el.style.transition = "";
    }, { passive: true });

    el.addEventListener("touchmove", (e) => {
      if (!active) return;
      const mx = e.touches[0].clientX - x0;
      const my = e.touches[0].clientY - y0;
      // Decide once, on the first meaningful movement, and stick with it: a gesture that
      // changes its mind halfway feels like the card is fighting the finger.
      if (axis === null && Math.abs(mx) + Math.abs(my) > 8) axis = Math.abs(mx) > Math.abs(my) ? "x" : "y";
      if (axis !== "x") return;
      dx = mx;
      setDrag(dx);
    }, { passive: true });

    el.addEventListener("touchend", () => {
      if (!active) return;
      active = false;
      const width = el.offsetWidth || 1;
      const velocity = Math.abs(dx) / Math.max(1, Date.now() - t0);
      // Read once, here: the reset at the bottom of this handler runs before the deferred
      // go() below, so anything that callback reads off `dx` is already zero by then.
      const dir = dx > 0 ? -1 : 1;
      const far = Math.abs(dx) > width * SWIPE_DISTANCE;
      // A flick counts even when it is short, but only if it actually travelled: without
      // the floor, a 5px twitch over 2ms reads as 2.5px/ms and turns the card.
      const flick = Math.abs(dx) > SWIPE_MIN && velocity > SWIPE_VELOCITY;
      const turn = axis === "x" && (far || flick);
      if (turn) {
        swallowNextClick();
        el.style.transition = "transform .16s ease, opacity .16s ease";
        setDrag(dir < 0 ? width : -width);
        // render() replaces this node, so the reset below lands on a fresh, untransformed
        // element — the slide-out is the whole animation, the new card fades in on its own.
        setTimeout(() => go(dir), 140);
      } else if (axis === "x" && dx) {
        // Sprang back rather than turned — but a drag this long was still not a tap.
        if (Math.abs(dx) > 10) swallowNextClick();
        release();
      }
      dx = 0; axis = null;
    });

    el.addEventListener("touchcancel", () => { active = false; axis = null; dx = 0; release(); });
  }

  function renderLearn() {
    const card = cards[state.idx];
    const tr = back(card);
    const toDe = state.dir === "toDe";
    const meta = langMeta();
    const answered = !!state.pick;
    const ok = state.pick === tr;
    const options = state._learnOptions || (state._learnOptions = optionLabels());

    let feedbackHtml = "";
    if (answered) {
      const title = ok ? "Richtig!" : "Nicht ganz.";
      const text = ok ? card.note || "" : `Erwartet war „${tr}“. ${card.note || ""}`;
      feedbackHtml = `
        <div class="vt-feedback ${ok ? "is-ok" : "is-no"}">
          <div class="vt-feedback-title">${escapeHtml(title)}</div>
          <div class="vt-feedback-text">${escapeHtml(text)}</div>
        </div>`;
    }

    contentEl.innerHTML = `
      <div class="vt-content ${swapClass()}">
        <div class="vt-learn-hint">${toDe ? "Wähle die passende deutsche Entsprechung." : "Wähle die passende Übersetzung."}</div>
        <div class="vt-learn-prompt">${escapeHtml(front(card))}</div>
        <div class="vt-options">
          ${options
            .map((label, i) => {
              const chosen = state.pick === label;
              const correct = label === tr;
              let cls = "vt-option";
              let mark = "";
              if (answered) {
                if (correct) { cls += " is-correct"; mark = "Richtig"; }
                else if (chosen) { cls += " is-wrong"; mark = "Falsch"; }
                else cls += " is-dim";
              }
              return `<button type="button" class="${cls}" data-i="${i}" ${answered ? "disabled" : ""}><span>${escapeHtml(label)}</span><span class="vt-option-mark">${mark}</span></button>`;
            })
            .join("")}
        </div>
        ${feedbackHtml}
        <div class="vt-primary-row">
          <button type="button" class="vt-primary-btn" id="vt-next-card">Nächste Karte</button>
        </div>
      </div>`;

    contentEl.querySelectorAll(".vt-option").forEach((btn) => {
      btn.addEventListener("click", () => pickOption(options[+btn.dataset.i]));
    });
    contentEl.querySelector("#vt-next-card").addEventListener("click", () => { state._learnOptions = null; go(1); });
  }

  function renderTest() {
    const card = cards[state.idx];
    const tr = back(card);
    const toDe = state.dir === "toDe";
    const meta = langMeta();
    const dk = deck();
    const pos = Math.max(0, dk.indexOf(state.idx));
    const answered = state.checked;
    const ok = norm(state.input) === norm(tr);

    const values = Object.keys(state.results)
      .filter((k) => k.indexOf("test:") === 0)
      .map((k) => state.results[k]);
    const right = values.filter(Boolean).length;
    const wrong = values.length - right;

    let feedbackHtml = "";
    if (answered) {
      const title = ok ? "Richtig!" : "Fast geschafft.";
      const text = ok ? card.note || "" : `Erwartet war „${tr}“. ${card.note || ""}`;
      feedbackHtml = `
        <div class="vt-feedback ${ok ? "is-ok" : "is-no"}">
          <div class="vt-feedback-title">${escapeHtml(title)}</div>
          <div class="vt-feedback-text">${escapeHtml(text)}</div>
        </div>`;
    }

    contentEl.innerHTML = `
      <div class="vt-content ${swapClass()}">
        <div class="vt-test-head">
          <span>Frage ${pos + 1} von ${dk.length}</span>
          <span class="vt-score-mono">${right} richtig · ${wrong} falsch</span>
        </div>
        <div class="vt-progress-track"><div class="vt-progress-fill" style="width:${Math.round(((pos + 1) / dk.length) * 100)}%"></div></div>
        <div class="vt-test-label">Übersetze ins ${toDe ? "Deutsche" : meta.deInto ?? meta.label ?? ""}</div>
        <div class="vt-test-prompt">${escapeHtml(front(card))}</div>
        <input type="text" class="vt-input" id="vt-input" placeholder="Antwort eingeben" value="${escapeHtml(state.input)}" ${answered ? "disabled" : ""} autocomplete="off">
        ${feedbackHtml}
        <div class="vt-nav-row">
          <button type="button" class="vt-nav-link" id="vt-skip">Überspringen</button>
          <button type="button" class="vt-primary-btn" id="vt-primary">${answered ? "Weiter" : "Prüfen"}</button>
        </div>
        <p class="vt-kbd-hint">Enter prüfen · ae/oe/ue werden akzeptiert</p>
      </div>`;

    const input = contentEl.querySelector("#vt-input");
    input.addEventListener("input", (e) => { state.input = e.target.value; });
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") check(); });
    if (!answered) input.focus();
    contentEl.querySelector("#vt-skip").addEventListener("click", skip);
    contentEl.querySelector("#vt-primary").addEventListener("click", check);
  }

  function renderList() {
    const dk = deck();
    const meta = langMeta();
    const isRtl = !!meta.rtl;
    const selIds = selectedIds();

    const rowsHtml = cards
      .map((card, i) => {
        const res = state.results[`${state.lastMode}:${i}`];
        const seen = res !== undefined;
        const selected = !!state.selected[i];
        const active = i === state.idx;
        return `
          <button type="button" class="vt-list-row ${selected ? "is-selected" : ""} ${active && !selected ? "is-active" : ""}" data-i="${i}">
            <span class="vt-list-box ${selected ? "is-selected" : ""}"></span>
            <span class="vt-list-word">
              <span class="vt-list-de">${escapeHtml(card.front)}</span>
              <span class="vt-list-tr ${isRtl ? "vt-rtl" : ""}">${escapeHtml(foreignText(card))}</span>
            </span>
            <span class="vt-list-dot ${seen ? (res ? "is-right" : "is-wrong") : ""}"></span>
            <span class="vt-list-jump ${active ? "is-active" : ""}" data-jump="${i}">→</span>
          </button>`;
      })
      .join("");

    contentEl.innerHTML = `
      <div class="vt-content ${swapClass()}">
        <div class="vt-list-head">
          <div class="vt-list-hint">Alle Wörter dieser Übung — tippe eines an, um dort weiterzumachen.</div>
          <div class="vt-list-legend">
            <span class="vt-legend-item"><span class="vt-legend-dot vt-legend-dot--richtig"></span>richtig</span>
            <span class="vt-legend-item"><span class="vt-legend-dot vt-legend-dot--falsch"></span>falsch</span>
            <span class="vt-legend-item"><span class="vt-legend-dot vt-legend-dot--offen"></span>offen</span>
            <span>${cards.length} Wörter</span>
          </div>
        </div>
        <div class="vt-list-grid">${rowsHtml}</div>
        <div class="vt-sel-bar">
          <span class="vt-sel-label">${selIds.length ? `${selIds.length} von ${cards.length} Wörtern ausgewählt` : "Tippe Wörter an, um eine eigene Runde zusammenzustellen."}</span>
          <button type="button" class="vt-sel-start ${selIds.length ? "is-active" : ""}" id="vt-sel-start">Auswahl testen</button>
          <button type="button" class="vt-sel-clear" id="vt-sel-clear">Auswahl leeren</button>
          <button type="button" class="vt-sel-all" id="vt-sel-all">${selIds.length === cards.length ? "Auswahl aufheben" : "Alle auswählen"}</button>
        </div>
      </div>`;

    contentEl.querySelectorAll(".vt-list-row").forEach((row) => {
      row.addEventListener("click", (e) => {
        const jump = e.target.closest("[data-jump]");
        if (jump) { e.stopPropagation(); jumpTo(+jump.dataset.jump); return; }
        toggleSelect(+row.dataset.i);
      });
    });
    contentEl.querySelector("#vt-sel-start").addEventListener("click", startSelection);
    contentEl.querySelector("#vt-sel-clear").addEventListener("click", clearSelection);
    contentEl.querySelector("#vt-sel-all").addEventListener("click", selectAll);
  }

  function render() {
    renderToolbar();
    if (!sessionStarted) { sessionStarted = true; if (onSessionStart) onSessionStart(); }
    if (state.mode === "cards") renderCards();
    else if (state.mode === "learn") renderLearn();
    else if (state.mode === "test") renderTest();
    else renderList();
  }

  [...tabsEl.children].forEach((btn) => {
    btn.addEventListener("click", () => setMode(btn.dataset.tab));
  });
  dirSwitch.addEventListener("change", toggleDir);
  deckChip.addEventListener("click", deckChipClick);

  contentEl.addEventListener("pointerdown", noteActivity);

  document.addEventListener("keydown", (e) => {
    const tag = document.activeElement?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    noteActivity();
    if (e.code === "Space") { e.preventDefault(); if (state.mode === "cards") flip(); }
    else if (e.key === "ArrowLeft") go(-1);
    else if (e.key === "ArrowRight") go(1);
  });

  render();

  return {
    setLang(code) { reset({ lang: code }); render(); },
  };
}

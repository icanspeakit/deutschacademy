// Engine for the "Verben mit Präpositionen" grammar workspace: five independent exercise
// widgets (Lückensatz, Zuordnen, Tabelle, Geschichte, Satzbau), each with its own state and
// its own re-render scope. Text-input exercises (1, 3, 4) never re-render on keystroke — only
// on an explicit Prüfen/Zurücksetzen click — so typing never breaks caret/focus the way a full
// re-render on `oninput` would. Match (2) and Satzbau (5) have no text inputs, so their sections
// can safely re-render on every click.

function normalize(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss");
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

const POP = "vp-pop .3s ease";
const SHAKE = "vp-shake .35s ease";

export function mountPrepositionWorkspace(roots, data, { onAnswer } = {}) {
  const { fillRoot, matchRoot, tableRoot, storyRoot, buildRoot } = roots;
  const notify = (ok) => { if (onAnswer) onAnswer(ok); };

  // ---- Exercise 1: Lückensatz ----
  const fillState = data.fillData.map(() => ({ value: "", checked: false, correct: false }));

  function renderFill() {
    fillRoot.innerHTML = data.fillData
      .map((item, idx) => {
        const f = fillState[idx];
        const anim = f.checked ? (f.correct ? POP : SHAKE) : "none";
        const feedback = f.checked
          ? `<span class="vp-feedback ${f.correct ? "is-correct" : "is-wrong"}">${f.correct ? "✓ Richtig!" : `✗ Richtig wäre: „${escapeHtml(item.answer)}“`}</span>
             <button type="button" class="vp-link-btn" data-reset="${idx}">Nochmal</button>`
          : `<button type="button" class="vp-btn-check" data-check="${idx}">Prüfen</button>`;
        return `
          <div class="vp-fill-item">
            <p class="vp-fill-prompt">${escapeHtml(item.prompt)}</p>
            <p class="vp-fill-hint">${escapeHtml(item.hint)}</p>
            <div class="vp-fill-row">
              <input type="text" class="vp-input" data-i="${idx}" value="${escapeHtml(f.value)}" ${f.checked ? "disabled" : ""} placeholder="Präposition…" style="animation:${anim}" />
              ${feedback}
            </div>
          </div>`;
      })
      .join("");

    fillRoot.querySelectorAll(".vp-input").forEach((input) => {
      input.addEventListener("input", (e) => { fillState[+input.dataset.i].value = e.target.value; });
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); checkFill(+input.dataset.i); } });
    });
    fillRoot.querySelectorAll("[data-check]").forEach((btn) => btn.addEventListener("click", () => checkFill(+btn.dataset.check)));
    fillRoot.querySelectorAll("[data-reset]").forEach((btn) => btn.addEventListener("click", () => resetFill(+btn.dataset.reset)));
  }

  function checkFill(idx) {
    const f = fillState[idx];
    f.checked = true;
    f.correct = normalize(f.value) === normalize(data.fillData[idx].answer);
    notify(f.correct);
    renderFill();
  }
  function resetFill(idx) {
    fillState[idx] = { value: "", checked: false, correct: false };
    renderFill();
  }

  // ---- Exercise 2: Zuordnen ----
  const rightOrder = data.pairs.map((_, i) => i);
  for (let i = rightOrder.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rightOrder[i], rightOrder[j]] = [rightOrder[j], rightOrder[i]];
  }
  const matchState = { selectedLeft: null, solved: [], wrong: null };

  function renderMatch() {
    const leftHtml = data.pairs
      .map((p, i) => {
        const solved = matchState.solved.includes(i);
        const wrong = !!(matchState.wrong && matchState.wrong.left === i);
        const selected = matchState.selectedLeft === i;
        const anim = solved ? POP : wrong ? SHAKE : "none";
        return `<button type="button" class="vp-match-btn ${solved ? "is-solved" : ""} ${selected ? "is-selected" : ""}" data-left="${i}" ${solved ? "disabled" : ""} style="animation:${anim}"><strong>${i + 1}</strong>${escapeHtml(p.q)}</button>`;
      })
      .join("");
    const rightHtml = rightOrder
      .map((rightIdx, pos) => {
        const solved = matchState.solved.includes(rightIdx);
        const wrong = !!(matchState.wrong && matchState.wrong.right === rightIdx);
        const anim = solved ? POP : wrong ? SHAKE : "none";
        return `<button type="button" class="vp-match-btn ${solved ? "is-solved" : ""}" data-right="${rightIdx}" ${solved ? "disabled" : ""} style="animation:${anim}"><strong>${String.fromCharCode(65 + pos)}</strong>${escapeHtml(data.pairs[rightIdx].a)}</button>`;
      })
      .join("");
    const done = matchState.solved.length === data.pairs.length;

    matchRoot.innerHTML = `
      <div class="vp-match-grid">
        <div class="vp-match-col">${leftHtml}</div>
        <div class="vp-match-col">${rightHtml}</div>
      </div>
      <div class="vp-actions">
        ${done ? `<span class="vp-feedback is-correct">✓ Alle Paare gefunden!</span>` : ""}
        <button type="button" class="vp-link-btn" id="vp-match-reset">Zurücksetzen</button>
      </div>`;

    matchRoot.querySelectorAll("[data-left]").forEach((btn) => btn.addEventListener("click", () => selectLeft(+btn.dataset.left)));
    matchRoot.querySelectorAll("[data-right]").forEach((btn) => btn.addEventListener("click", () => selectRight(+btn.dataset.right)));
    matchRoot.querySelector("#vp-match-reset").addEventListener("click", resetMatch);
  }

  function selectLeft(i) {
    if (matchState.solved.includes(i)) return;
    matchState.selectedLeft = i;
    matchState.wrong = null;
    renderMatch();
  }
  function selectRight(rightIdx) {
    const { selectedLeft, solved } = matchState;
    if (selectedLeft == null || solved.includes(rightIdx)) return;
    if (selectedLeft === rightIdx) {
      matchState.solved = [...matchState.solved, selectedLeft];
      matchState.selectedLeft = null;
      matchState.wrong = null;
      notify(true);
      renderMatch();
    } else {
      matchState.wrong = { left: selectedLeft, right: rightIdx };
      notify(false);
      renderMatch();
      setTimeout(() => {
        matchState.wrong = null;
        matchState.selectedLeft = null;
        renderMatch();
      }, 700);
    }
  }
  function resetMatch() {
    matchState.selectedLeft = null;
    matchState.solved = [];
    matchState.wrong = null;
    renderMatch();
  }

  // ---- Exercise 3: Tabelle ----
  const tableState = { values: {}, checked: false };

  function renderTable() {
    const rowsHtml = data.tableRows
      .map((row, idx) => {
        const val = tableState.values[idx] || "";
        const checked = tableState.checked;
        const ok = checked && normalize(val) === normalize(row.prep);
        const anim = checked ? (ok ? POP : SHAKE) : "none";
        return `
          <div class="vp-table-row">
            <span class="vp-table-verb">${escapeHtml(row.verb)}</span>
            <input type="text" class="vp-input vp-input-sm ${checked ? (ok ? "is-correct" : "is-wrong") : ""}" data-i="${idx}" value="${escapeHtml(val)}" ${checked ? "disabled" : ""} placeholder="Präposition…" style="animation:${anim}" />
          </div>`;
      })
      .join("");
    tableRoot.innerHTML = `
      <div class="vp-table">${rowsHtml}</div>
      <div class="vp-actions">
        <button type="button" class="vp-btn-check" id="vp-table-check">Prüfen</button>
        <button type="button" class="vp-link-btn" id="vp-table-reset">Zurücksetzen</button>
      </div>`;
    tableRoot.querySelectorAll(".vp-input").forEach((input) => {
      input.addEventListener("input", (e) => { tableState.values[+input.dataset.i] = e.target.value; });
    });
    tableRoot.querySelector("#vp-table-check").addEventListener("click", checkTable);
    tableRoot.querySelector("#vp-table-reset").addEventListener("click", resetTable);
  }
  function checkTable() {
    tableState.checked = true;
    data.tableRows.forEach((row, idx) => notify(normalize(tableState.values[idx] || "") === normalize(row.prep)));
    renderTable();
  }
  function resetTable() {
    tableState.values = {};
    tableState.checked = false;
    renderTable();
  }

  // ---- Exercise 4: Geschichte ----
  const storyState = { values: {}, checked: false };
  const storyBlanks = data.storySegments.filter((seg) => seg.blank !== undefined);

  function renderStory() {
    const html = data.storySegments
      .map((seg) => {
        if (seg.text !== undefined) return escapeHtml(seg.text);
        const val = storyState.values[seg.blank] || "";
        const checked = storyState.checked;
        const ok = checked && normalize(val) === normalize(seg.answer);
        const anim = checked ? (ok ? POP : SHAKE) : "none";
        return `<input type="text" class="vp-input vp-input-blank ${checked ? (ok ? "is-correct" : "is-wrong") : ""}" data-blank="${seg.blank}" value="${escapeHtml(val)}" ${checked ? "disabled" : ""} style="animation:${anim}" />`;
      })
      .join("");
    const allCorrect = storyState.checked && storyBlanks.every((seg) => normalize(storyState.values[seg.blank] || "") === normalize(seg.answer));

    storyRoot.innerHTML = `
      <p class="vp-story-text">${html}</p>
      <div class="vp-actions">
        <button type="button" class="vp-btn-check" id="vp-story-check">Prüfen</button>
        <button type="button" class="vp-link-btn" id="vp-story-reset">Zurücksetzen</button>
        ${storyState.checked ? `<span class="vp-feedback ${allCorrect ? "is-correct" : "is-wrong"}">${allCorrect ? "✓ Alles richtig!" : "Noch nicht alles richtig — markierte Lücken prüfen."}</span>` : ""}
      </div>`;

    storyRoot.querySelectorAll("[data-blank]").forEach((input) => {
      input.addEventListener("input", (e) => { storyState.values[+input.dataset.blank] = e.target.value; });
    });
    storyRoot.querySelector("#vp-story-check").addEventListener("click", checkStory);
    storyRoot.querySelector("#vp-story-reset").addEventListener("click", resetStory);
  }
  function checkStory() {
    storyState.checked = true;
    storyBlanks.forEach((seg) => notify(normalize(storyState.values[seg.blank] || "") === normalize(seg.answer)));
    renderStory();
  }
  function resetStory() {
    storyState.values = {};
    storyState.checked = false;
    renderStory();
  }

  // ---- Exercise 5: Satzbau ----
  const buildState = Object.fromEntries(data.buildSentences.map((s) => [s.id, { chosen: [], checked: false }]));

  function renderBuild() {
    buildRoot.innerHTML = data.buildSentences
      .map((sentence) => {
        const bs = buildState[sentence.id];
        const availableIdx = sentence.shuffled.map((_, i) => i).filter((i) => !bs.chosen.includes(i));
        const complete = bs.chosen.length === sentence.correct.length;
        const correct = bs.checked && bs.chosen.every((origIdx, pos) => sentence.shuffled[origIdx] === sentence.correct[pos]);
        const stripAnim = bs.checked ? (correct ? POP : SHAKE) : "none";
        const chosenHtml = bs.chosen
          .map((origIdx, pos) => `<button type="button" class="vp-chip vp-chip-chosen" data-sentence="${sentence.id}" data-remove="${pos}" ${bs.checked ? "disabled" : ""}>${escapeHtml(sentence.shuffled[origIdx])}</button>`)
          .join("");
        const availHtml = availableIdx
          .map((i) => `<button type="button" class="vp-chip" data-sentence="${sentence.id}" data-pick="${i}">${escapeHtml(sentence.shuffled[i])}</button>`)
          .join("");
        return `
          <div class="vp-build-item">
            <div class="vp-build-strip" style="animation:${stripAnim}">${chosenHtml}</div>
            <div class="vp-build-pool">${availHtml}</div>
            <div class="vp-actions">
              <button type="button" class="vp-btn-check" data-check="${sentence.id}" ${complete ? "" : "disabled"}>Prüfen</button>
              <button type="button" class="vp-link-btn" data-reset="${sentence.id}">Zurücksetzen</button>
              ${bs.checked ? `<span class="vp-feedback ${correct ? "is-correct" : "is-wrong"}">${correct ? "✓ Richtig!" : "✗ Reihenfolge nicht korrekt — versuch's nochmal."}</span>` : ""}
            </div>
          </div>`;
      })
      .join("");

    buildRoot.querySelectorAll("[data-pick]").forEach((btn) => btn.addEventListener("click", () => pickToken(btn.dataset.sentence, +btn.dataset.pick)));
    buildRoot.querySelectorAll("[data-remove]").forEach((btn) => btn.addEventListener("click", () => removeToken(btn.dataset.sentence, +btn.dataset.remove)));
    buildRoot.querySelectorAll("[data-check]:not(:disabled)").forEach((btn) => btn.addEventListener("click", () => checkBuild(btn.dataset.check)));
    buildRoot.querySelectorAll("[data-reset]").forEach((btn) => btn.addEventListener("click", () => resetBuild(btn.dataset.reset)));
  }
  function pickToken(id, origIdx) {
    const bs = buildState[id];
    if (bs.checked) return;
    bs.chosen.push(origIdx);
    renderBuild();
  }
  function removeToken(id, pos) {
    const bs = buildState[id];
    if (bs.checked) return;
    bs.chosen.splice(pos, 1);
    renderBuild();
  }
  function checkBuild(id) {
    const sentence = data.buildSentences.find((s) => s.id === id);
    const bs = buildState[id];
    bs.checked = true;
    const correct = bs.chosen.every((origIdx, pos) => sentence.shuffled[origIdx] === sentence.correct[pos]);
    notify(correct);
    renderBuild();
  }
  function resetBuild(id) {
    buildState[id] = { chosen: [], checked: false };
    renderBuild();
  }

  renderFill();
  renderMatch();
  renderTable();
  renderStory();
  renderBuild();
}

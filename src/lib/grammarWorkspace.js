// Engine for the grammar workspaces at /uebungen/grammatik/<topic>.
//
// Generalized from the original "Verben mit Präpositionen" page (src/lib/prepositionWorkspace.js,
// now retired): that page's five exercise widgets are topic-agnostic, so they live here as five
// renderers keyed by `type` and are driven entirely by src/data/grammatik/<topic>.json. Adding a
// topic is a JSON file — no new page, no new engine.
//
// Behavioural rule carried over from the original, worth keeping: the text-input exercises
// (fill, table, story) never re-render on keystroke, only on an explicit Prüfen/Zurücksetzen
// click, so typing never blows away caret position or focus. match and build have no text
// inputs, so they can safely re-render on every click.

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

/**
 * An answer may be a single string or an array of accepted strings — several topics have
 * slots where more than one form is genuinely right (e.g. "Nach dem Frühstück müssen/sollen
 * sie das Geschirr einsammeln"). The first entry is the one shown as the model answer.
 */
function accepts(answer, value) {
  const list = Array.isArray(answer) ? answer : [answer];
  return list.some((a) => normalize(a) === normalize(value));
}
function modelAnswer(answer) {
  return Array.isArray(answer) ? answer.join(" / ") : answer;
}

const POP = "vp-pop .3s ease";
const SHAKE = "vp-shake .35s ease";

const LABEL = {
  check: "Prüfen",
  reset: "Zurücksetzen",
  retry: "Nochmal",
  correct: "✓ Richtig!",
  wrongIs: (a) => `✗ Richtig wäre: „${escapeHtml(a)}“`,
  allPairs: "✓ Alle Paare gefunden!",
  allCorrect: "✓ Alles richtig!",
  someWrong: "Noch nicht alles richtig — markierte Lücken prüfen.",
  wrongOrder: "✗ Reihenfolge nicht korrekt — versuch's nochmal.",
};

/* ---------------------------------------------------------------- fill ---- */
function mountFill(root, ex, notify) {
  const placeholder = ex.placeholder || "";
  const state = ex.items.map(() => ({ value: "", checked: false, correct: false }));

  function render() {
    root.innerHTML = ex.items
      .map((item, idx) => {
        const f = state[idx];
        const anim = f.checked ? (f.correct ? POP : SHAKE) : "none";
        const feedback = f.checked
          ? `<span class="vp-feedback ${f.correct ? "is-correct" : "is-wrong"}">${f.correct ? LABEL.correct : LABEL.wrongIs(modelAnswer(item.answer))}</span>
             <button type="button" class="vp-link-btn" data-reset="${idx}">${LABEL.retry}</button>`
          : `<button type="button" class="vp-btn-check" data-check="${idx}">${LABEL.check}</button>`;
        return `
          <div class="vp-fill-item">
            <p class="vp-fill-prompt">${escapeHtml(item.prompt)}</p>
            ${item.hint ? `<p class="vp-fill-hint">${escapeHtml(item.hint)}</p>` : ""}
            <div class="vp-fill-row">
              <input type="text" class="vp-input" data-i="${idx}" value="${escapeHtml(f.value)}" ${f.checked ? "disabled" : ""} placeholder="${escapeHtml(placeholder)}" style="animation:${anim}" />
              ${feedback}
            </div>
          </div>`;
      })
      .join("");

    root.querySelectorAll(".vp-input").forEach((input) => {
      input.addEventListener("input", (e) => { state[+input.dataset.i].value = e.target.value; });
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); check(+input.dataset.i); } });
    });
    root.querySelectorAll("[data-check]").forEach((b) => b.addEventListener("click", () => check(+b.dataset.check)));
    root.querySelectorAll("[data-reset]").forEach((b) => b.addEventListener("click", () => reset(+b.dataset.reset)));
  }
  function check(idx) {
    const f = state[idx];
    f.checked = true;
    f.correct = accepts(ex.items[idx].answer, f.value);
    notify(f.correct);
    render();
  }
  function reset(idx) {
    state[idx] = { value: "", checked: false, correct: false };
    render();
  }
  render();
}

/* --------------------------------------------------------------- match ---- */
function mountMatch(root, ex, notify) {
  const order = ex.pairs.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const state = { selectedLeft: null, solved: [], wrong: null };

  function render() {
    const left = ex.pairs
      .map((p, i) => {
        const solved = state.solved.includes(i);
        const wrong = !!(state.wrong && state.wrong.left === i);
        const selected = state.selectedLeft === i;
        const anim = solved ? POP : wrong ? SHAKE : "none";
        return `<button type="button" class="vp-match-btn ${solved ? "is-solved" : ""} ${selected ? "is-selected" : ""}" data-left="${i}" ${solved ? "disabled" : ""} style="animation:${anim}"><strong>${i + 1}</strong>${escapeHtml(p.q)}</button>`;
      })
      .join("");
    const right = order
      .map((rightIdx, pos) => {
        const solved = state.solved.includes(rightIdx);
        const wrong = !!(state.wrong && state.wrong.right === rightIdx);
        const anim = solved ? POP : wrong ? SHAKE : "none";
        return `<button type="button" class="vp-match-btn ${solved ? "is-solved" : ""}" data-right="${rightIdx}" ${solved ? "disabled" : ""} style="animation:${anim}"><strong>${String.fromCharCode(65 + pos)}</strong>${escapeHtml(ex.pairs[rightIdx].a)}</button>`;
      })
      .join("");
    const done = state.solved.length === ex.pairs.length;

    root.innerHTML = `
      <div class="vp-match-grid">
        <div class="vp-match-col">${left}</div>
        <div class="vp-match-col">${right}</div>
      </div>
      <div class="vp-actions">
        ${done ? `<span class="vp-feedback is-correct">${LABEL.allPairs}</span>` : ""}
        <button type="button" class="vp-link-btn" data-match-reset>${LABEL.reset}</button>
      </div>`;

    root.querySelectorAll("[data-left]").forEach((b) => b.addEventListener("click", () => selectLeft(+b.dataset.left)));
    root.querySelectorAll("[data-right]").forEach((b) => b.addEventListener("click", () => selectRight(+b.dataset.right)));
    root.querySelector("[data-match-reset]").addEventListener("click", reset);
  }
  function selectLeft(i) {
    if (state.solved.includes(i)) return;
    state.selectedLeft = i;
    state.wrong = null;
    render();
  }
  function selectRight(rightIdx) {
    const { selectedLeft, solved } = state;
    if (selectedLeft == null || solved.includes(rightIdx)) return;
    if (selectedLeft === rightIdx) {
      state.solved = [...state.solved, selectedLeft];
      state.selectedLeft = null;
      state.wrong = null;
      notify(true);
      render();
    } else {
      state.wrong = { left: selectedLeft, right: rightIdx };
      notify(false);
      render();
      setTimeout(() => { state.wrong = null; state.selectedLeft = null; render(); }, 700);
    }
  }
  function reset() {
    state.selectedLeft = null;
    state.solved = [];
    state.wrong = null;
    render();
  }
  render();
}

/* --------------------------------------------------------------- table ---- */
function mountTable(root, ex, notify) {
  const placeholder = ex.placeholder || "";
  const state = { values: {}, checked: false };

  function render() {
    const head = ex.columns
      ? `<div class="vp-table-row vp-table-head"><span>${escapeHtml(ex.columns[0])}</span><span>${escapeHtml(ex.columns[1])}</span></div>`
      : "";
    const rows = ex.rows
      .map((row, idx) => {
        const val = state.values[idx] || "";
        const ok = state.checked && accepts(row.answer, val);
        const anim = state.checked ? (ok ? POP : SHAKE) : "none";
        return `
          <div class="vp-table-row">
            <span class="vp-table-verb">${escapeHtml(row.term)}</span>
            <input type="text" class="vp-input vp-input-sm ${state.checked ? (ok ? "is-correct" : "is-wrong") : ""}" data-i="${idx}" value="${escapeHtml(val)}" ${state.checked ? "disabled" : ""} placeholder="${escapeHtml(placeholder)}" style="animation:${anim}" />
          </div>`;
      })
      .join("");
    const wrong = state.checked ? ex.rows.filter((r, i) => !accepts(r.answer, state.values[i] || "")) : [];
    root.innerHTML = `
      <div class="vp-table">${head}${rows}</div>
      <div class="vp-actions">
        ${state.checked ? "" : `<button type="button" class="vp-btn-check" data-table-check>${LABEL.check}</button>`}
        <button type="button" class="vp-link-btn" data-table-reset>${LABEL.reset}</button>
        ${state.checked ? `<span class="vp-feedback ${wrong.length ? "is-wrong" : "is-correct"}">${wrong.length ? LABEL.someWrong : LABEL.allCorrect}</span>` : ""}
      </div>
      ${state.checked && wrong.length ? `<p class="vp-fill-hint">${wrong.map((r) => `${escapeHtml(r.term)} → <strong>${escapeHtml(modelAnswer(r.answer))}</strong>`).join(" · ")}</p>` : ""}`;

    root.querySelectorAll(".vp-input").forEach((input) => {
      input.addEventListener("input", (e) => { state.values[+input.dataset.i] = e.target.value; });
    });
    root.querySelector("[data-table-check]")?.addEventListener("click", check);
    root.querySelector("[data-table-reset]").addEventListener("click", reset);
  }
  function check() {
    state.checked = true;
    ex.rows.forEach((row, idx) => notify(accepts(row.answer, state.values[idx] || "")));
    render();
  }
  function reset() {
    state.values = {};
    state.checked = false;
    render();
  }
  render();
}

/* --------------------------------------------------------------- story ---- */
function mountStory(root, ex, notify) {
  const state = { values: {}, checked: false };
  const blanks = ex.segments.filter((s) => s.blank !== undefined);

  function render() {
    const html = ex.segments
      .map((seg) => {
        if (seg.text !== undefined) return escapeHtml(seg.text);
        const val = state.values[seg.blank] || "";
        const ok = state.checked && accepts(seg.answer, val);
        const anim = state.checked ? (ok ? POP : SHAKE) : "none";
        return `<input type="text" class="vp-input vp-input-blank ${state.checked ? (ok ? "is-correct" : "is-wrong") : ""}" data-blank="${seg.blank}" value="${escapeHtml(val)}" ${state.checked ? "disabled" : ""} style="animation:${anim}" />`;
      })
      .join("");
    const allCorrect = state.checked && blanks.every((s) => accepts(s.answer, state.values[s.blank] || ""));
    const missed = state.checked ? blanks.filter((s) => !accepts(s.answer, state.values[s.blank] || "")) : [];

    root.innerHTML = `
      <p class="vp-story-text">${html}</p>
      <div class="vp-actions">
        ${state.checked ? "" : `<button type="button" class="vp-btn-check" data-story-check>${LABEL.check}</button>`}
        <button type="button" class="vp-link-btn" data-story-reset>${LABEL.reset}</button>
        ${state.checked ? `<span class="vp-feedback ${allCorrect ? "is-correct" : "is-wrong"}">${allCorrect ? LABEL.allCorrect : LABEL.someWrong}</span>` : ""}
      </div>
      ${missed.length ? `<p class="vp-fill-hint">${missed.map((s) => `${s.blank + 1}. <strong>${escapeHtml(modelAnswer(s.answer))}</strong>`).join(" · ")}</p>` : ""}`;

    root.querySelectorAll("[data-blank]").forEach((input) => {
      input.addEventListener("input", (e) => { state.values[+input.dataset.blank] = e.target.value; });
    });
    root.querySelector("[data-story-check]")?.addEventListener("click", check);
    root.querySelector("[data-story-reset]").addEventListener("click", reset);
  }
  function check() {
    state.checked = true;
    blanks.forEach((s) => notify(accepts(s.answer, state.values[s.blank] || "")));
    render();
  }
  function reset() {
    state.values = {};
    state.checked = false;
    render();
  }
  render();
}

/* --------------------------------------------------------------- build ---- */
function mountBuild(root, ex, notify) {
  const state = Object.fromEntries(ex.sentences.map((s) => [s.id, { chosen: [], checked: false }]));

  function render() {
    root.innerHTML = ex.sentences
      .map((sentence) => {
        const bs = state[sentence.id];
        const available = sentence.shuffled.map((_, i) => i).filter((i) => !bs.chosen.includes(i));
        const complete = bs.chosen.length === sentence.correct.length;
        const correct = bs.checked && bs.chosen.every((origIdx, pos) => sentence.shuffled[origIdx] === sentence.correct[pos]);
        const stripAnim = bs.checked ? (correct ? POP : SHAKE) : "none";
        const chosen = bs.chosen
          .map((origIdx, pos) => `<button type="button" class="vp-chip vp-chip-chosen" data-sentence="${sentence.id}" data-remove="${pos}" ${bs.checked ? "disabled" : ""}>${escapeHtml(sentence.shuffled[origIdx])}</button>`)
          .join("");
        const pool = available
          .map((i) => `<button type="button" class="vp-chip" data-sentence="${sentence.id}" data-pick="${i}">${escapeHtml(sentence.shuffled[i])}</button>`)
          .join("");
        return `
          <div class="vp-build-item">
            ${sentence.hint ? `<p class="vp-fill-hint">${escapeHtml(sentence.hint)}</p>` : ""}
            <div class="vp-build-strip" style="animation:${stripAnim}">${chosen}</div>
            <div class="vp-build-pool">${pool}</div>
            <div class="vp-actions">
              <button type="button" class="vp-btn-check" data-check="${sentence.id}" ${complete && !bs.checked ? "" : "disabled"}>${LABEL.check}</button>
              <button type="button" class="vp-link-btn" data-reset="${sentence.id}">${LABEL.reset}</button>
              ${bs.checked ? `<span class="vp-feedback ${correct ? "is-correct" : "is-wrong"}">${correct ? LABEL.correct : LABEL.wrongOrder}</span>` : ""}
            </div>
            ${bs.checked && !correct ? `<p class="vp-fill-hint">${escapeHtml(sentence.correct.join(" "))}</p>` : ""}
          </div>`;
      })
      .join("");

    root.querySelectorAll("[data-pick]").forEach((b) => b.addEventListener("click", () => pick(b.dataset.sentence, +b.dataset.pick)));
    root.querySelectorAll("[data-remove]").forEach((b) => b.addEventListener("click", () => remove(b.dataset.sentence, +b.dataset.remove)));
    root.querySelectorAll("[data-check]:not(:disabled)").forEach((b) => b.addEventListener("click", () => check(b.dataset.check)));
    root.querySelectorAll("[data-reset]").forEach((b) => b.addEventListener("click", () => reset(b.dataset.reset)));
  }
  function pick(id, origIdx) {
    if (state[id].checked) return;
    state[id].chosen.push(origIdx);
    render();
  }
  function remove(id, pos) {
    if (state[id].checked) return;
    state[id].chosen.splice(pos, 1);
    render();
  }
  function check(id) {
    const sentence = ex.sentences.find((s) => s.id === id);
    const bs = state[id];
    bs.checked = true;
    notify(bs.chosen.every((origIdx, pos) => sentence.shuffled[origIdx] === sentence.correct[pos]));
    render();
  }
  function reset(id) {
    state[id] = { chosen: [], checked: false };
    render();
  }
  render();
}

/* ------------------------------------------------------------ wordbank ----
   telc "Sprachbausteine, Teil 1": one gap text, one bank of lettered words,
   each usable exactly once, and more words than gaps. Each gap is a <select>
   rather than a click-to-place target — a native control keeps the keyboard
   and screen-reader path intact and makes "which word did I already use"
   answerable at a glance. */
function mountWordbank(root, ex, notify) {
  const letters = Object.keys(ex.letters);
  const blanks = ex.segments.filter((s) => s.blank !== undefined);
  const state = { values: {}, checked: false };

  function render() {
    const used = new Set(Object.values(state.values).filter(Boolean));
    const text = ex.segments
      .map((seg) => {
        if (seg.text !== undefined) return escapeHtml(seg.text);
        const val = state.values[seg.blank] || "";
        const ok = state.checked && val === seg.answer;
        const opts = letters
          .map((l) => {
            // a letter already spent on another gap stays visible but unpickable
            const taken = used.has(l) && val !== l;
            return `<option value="${l}" ${val === l ? "selected" : ""} ${taken ? "disabled" : ""}>${l}) ${escapeHtml(ex.letters[l])}</option>`;
          })
          .join("");
        return `<select class="vp-gap-select ${state.checked ? (ok ? "is-correct" : "is-wrong") : ""}" data-blank="${seg.blank}" ${state.checked ? "disabled" : ""}>
            <option value="">${seg.blank + 1} —</option>${opts}
          </select>`;
      })
      .join("");

    const bank = letters
      .map((l) => `<li class="${used.has(l) ? "is-used" : ""}"><strong>${l}</strong> ${escapeHtml(ex.letters[l])}</li>`)
      .join("");

    const missed = state.checked ? blanks.filter((s) => state.values[s.blank] !== s.answer) : [];
    const allCorrect = state.checked && !missed.length;

    root.innerHTML = `
      <div class="vp-sb-letter-bank"><ul>${bank}</ul></div>
      <p class="vp-story-text vp-sb-text">${text}</p>
      <div class="vp-actions">
        ${state.checked ? "" : `<button type="button" class="vp-btn-check" data-wb-check>${LABEL.check}</button>`}
        <button type="button" class="vp-link-btn" data-wb-reset>${LABEL.reset}</button>
        ${state.checked ? `<span class="vp-feedback ${allCorrect ? "is-correct" : "is-wrong"}">${allCorrect ? LABEL.allCorrect : LABEL.someWrong}</span>` : ""}
      </div>
      ${missed.length ? `<p class="vp-fill-hint">${missed.map((s) => `${s.blank + 1}. <strong>${s.answer}) ${escapeHtml(ex.letters[s.answer])}</strong>`).join(" · ")}</p>` : ""}`;

    root.querySelectorAll("[data-blank]").forEach((sel) => {
      sel.addEventListener("change", (e) => {
        state.values[+sel.dataset.blank] = e.target.value;
        render(); // re-render so the bank + remaining options reflect what is now used
      });
    });
    root.querySelector("[data-wb-check]")?.addEventListener("click", check);
    root.querySelector("[data-wb-reset]").addEventListener("click", reset);
  }
  function check() {
    state.checked = true;
    blanks.forEach((s) => notify(state.values[s.blank] === s.answer));
    render();
  }
  function reset() {
    state.values = {};
    state.checked = false;
    render();
  }
  render();
}

/* --------------------------------------------------------------- mcgap ----
   telc "Sprachbausteine, Teil 2": the same gap text, but each gap offers three
   options. Text on top with numbered gaps, options listed underneath — the
   layout of the printed exam, so the page rehearses the real thing. */
function mountMcgap(root, ex, notify) {
  const state = { values: {}, checked: false };

  function render() {
    const text = ex.segments
      .map((seg) => {
        if (seg.text !== undefined) return escapeHtml(seg.text);
        const item = ex.items[seg.blank];
        const picked = state.values[seg.blank];
        const filled = picked != null ? item.options[picked] : null;
        const ok = state.checked && picked === item.correct;
        const cls = state.checked ? (ok ? "is-correct" : "is-wrong") : filled ? "is-filled" : "";
        return `<span class="vp-sb-gap ${cls}" data-gap="${seg.blank}">${filled ? escapeHtml(filled) : `___ ${seg.blank + 1} ___`}</span>`;
      })
      .join("");

    const questions = ex.items
      .map((item, i) => {
        const picked = state.values[i];
        const opts = item.options
          .map((opt, oi) => {
            const isPicked = picked === oi;
            const cls = state.checked
              ? oi === item.correct
                ? "is-solved"
                : isPicked
                  ? "is-wrongpick"
                  : ""
              : isPicked
                ? "is-selected"
                : "";
            return `<button type="button" class="vp-match-btn vp-sb-opt ${cls}" data-i="${i}" data-o="${oi}" ${state.checked ? "disabled" : ""}><strong>${"abc"[oi]}</strong>${escapeHtml(opt)}</button>`;
          })
          .join("");
        return `<div class="vp-sb-question"><span class="vp-sb-num">${i + 1}</span><div class="vp-sb-opts">${opts}</div></div>`;
      })
      .join("");

    const right = ex.items.filter((item, i) => state.values[i] === item.correct).length;

    root.innerHTML = `
      <p class="vp-story-text vp-sb-text">${text}</p>
      <div class="vp-sb-questions">${questions}</div>
      <div class="vp-actions">
        ${state.checked ? "" : `<button type="button" class="vp-btn-check" data-mc-check>${LABEL.check}</button>`}
        <button type="button" class="vp-link-btn" data-mc-reset>${LABEL.reset}</button>
        ${state.checked ? `<span class="vp-feedback ${right === ex.items.length ? "is-correct" : "is-wrong"}">${right} / ${ex.items.length} richtig</span>` : ""}
      </div>`;

    root.querySelectorAll("[data-o]").forEach((b) =>
      b.addEventListener("click", () => {
        state.values[+b.dataset.i] = +b.dataset.o;
        render();
      })
    );
    root.querySelector("[data-mc-check]")?.addEventListener("click", check);
    root.querySelector("[data-mc-reset]").addEventListener("click", reset);
  }
  function check() {
    state.checked = true;
    ex.items.forEach((item, i) => notify(state.values[i] === item.correct));
    render();
  }
  function reset() {
    state.values = {};
    state.checked = false;
    render();
  }
  render();
}

const RENDERERS = {
  fill: mountFill,
  match: mountMatch,
  table: mountTable,
  story: mountStory,
  build: mountBuild,
  wordbank: mountWordbank,
  mcgap: mountMcgap,
};

/**
 * Mounts every exercise the page rendered a slot for. The page emits one
 * <div data-ex-index="n"> per entry in data.exercises; this pairs them up by index.
 */
export function mountGrammarWorkspace(pageRoot, data, { onAnswer } = {}) {
  const notify = (ok) => { if (onAnswer) onAnswer(ok); };
  pageRoot.querySelectorAll("[data-ex-index]").forEach((slot) => {
    const ex = data.exercises[+slot.dataset.exIndex];
    const render = ex && RENDERERS[ex.type];
    if (!render) return;
    render(slot, ex, notify);
  });
}

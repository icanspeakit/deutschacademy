// Engine for the grammar workspaces at /<topic>.
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

import { t } from "./uiText.js";

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

/* -------------------------------------------------------------- choices ----
 * Learners click, they do not type. Every answerable slot in fill/table/story is a
 * pill. The option set is the exercise's own distinct answers — or an explicit
 * `choices` list where the data declares one — so this needed no new content.
 *
 * Two shapes, chosen by size: up to INLINE_MAX options render on each item, which
 * reads as a direct question. Above that they render once as a word bank the learner
 * picks from, because 14 options across 14 blanks would be ~200 buttons. `story`
 * always uses the bank: its blanks sit inside running prose, which pills would shred.
 *
 * The bank is a palette, not an inventory — words are not used up, because several
 * items legitimately share an answer.
 * -------------------------------------------------------------------------- */
const INLINE_MAX = 8;

function optionSet(ex, answers) {
  if (Array.isArray(ex.choices) && ex.choices.length) return ex.choices.slice();
  const flat = answers
    .map((a) => (Array.isArray(a) ? a[0] : a))
    .filter((a) => a != null && String(a).trim() !== "")
    .map(String);
  return [...new Set(flat)];
}

function shuffleList(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function stateClass(checked, ok, chosen) {
  if (!checked) return chosen ? "is-chosen" : "";
  return ok ? "is-correct" : chosen ? "is-wrong" : "";
}

/** Inline pill row for one slot. */
function pillsHtml(options, idx, value, checked, answer) {
  return `<span class="vp-pills">${options
    .map((o) => {
      const chosen = value === o;
      const ok = checked && accepts(answer, o);
      return `<button type="button" class="vp-pill-opt ${stateClass(checked, ok, chosen)}" data-slot="${idx}" data-val="${escapeHtml(o)}" ${checked ? "disabled" : ""}>${escapeHtml(o)}</button>`;
    })
    .join("")}</span>`;
}

/** The shared word bank, rendered once above the items. */
function bankHtml(options, selected) {
  return `<div class="vp-bank" role="group" aria-label="${escapeHtml(t("vp.wordBank", "Wortliste"))}">${options
    .map((o) => `<button type="button" class="vp-bankword${selected === o ? " is-selected" : ""}" data-bank="${escapeHtml(o)}" aria-pressed="${selected === o}">${escapeHtml(o)}</button>`)
    .join("")}</div>`;
}

/** A slot the learner drops a bank word into. */
function slotHtml(idx, value, checked, answer, placeholder) {
  const ok = checked && accepts(answer, value);
  const cls = checked ? (ok ? "is-correct" : "is-wrong") : value ? "is-chosen" : "";
  return `<button type="button" class="vp-slot ${cls}" data-slot="${idx}" ${checked ? "disabled" : ""}>${value ? escapeHtml(value) : escapeHtml(placeholder || "…")}</button>`;
}

/** Wires bank + slot clicks for a bank-mode exercise. */
function wireBank(root, state, render) {
  root.querySelectorAll("[data-bank]").forEach((b) => {
    b.addEventListener("click", () => {
      state.selected = state.selected === b.dataset.bank ? null : b.dataset.bank;
      render();
    });
  });
  root.querySelectorAll("[data-slot]").forEach((b) => {
    b.addEventListener("click", () => {
      const i = +b.dataset.slot;
      // Clicking a filled slot clears it; otherwise the armed bank word lands here.
      if (state.values[i]) { delete state.values[i]; }
      else if (state.selected) { state.values[i] = state.selected; state.selected = null; }
      render();
    });
  });
}

const POP = "vp-pop .3s ease";
const SHAKE = "vp-shake .35s ease";

// In the UI language (uiText.js). The three buttons also carry data-i18n, so a language
// switch repaints them in place; a feedback line follows on the next answer.
const LABEL = {
  get check() { return `<span data-i18n="quiz.check">${escapeHtml(t("quiz.check", "Prüfen"))}</span>`; },
  get reset() { return `<span data-i18n="vp.reset">${escapeHtml(t("vp.reset", "Zurücksetzen"))}</span>`; },
  get retry() { return `<span data-i18n="vp.retry">${escapeHtml(t("vp.retry", "Nochmal"))}</span>`; },
  get correct() { return escapeHtml(t("quiz.correct", "✓ Richtig!")); },
  wrongIs: (a) => escapeHtml(t("vp.wrongIs", "✗ Richtig wäre: „{a}“", { a })),
  get allPairs() { return escapeHtml(t("vp.allPairs", "✓ Alle Paare gefunden!")); },
  get allCorrect() { return escapeHtml(t("vp.allCorrect", "✓ Alles richtig!")); },
  get someWrong() { return escapeHtml(t("vp.someWrong", "Noch nicht alles richtig — markierte Lücken prüfen.")); },
  get wrongOrder() { return escapeHtml(t("vp.wrongOrder", "✗ Reihenfolge nicht korrekt — versuch's nochmal.")); },
};

/* ---------------------------------------------------------------- fill ---- */
function mountFill(root, ex, notify) {
  const answers = ex.items.map((it) => it.answer);
  const options = shuffleList(optionSet(ex, answers));
  const bankMode = options.length > INLINE_MAX;
  const state = { values: {}, checked: {}, selected: null };

  function render() {
    const items = ex.items
      .map((item, idx) => {
        const val = state.values[idx] || "";
        const checked = !!state.checked[idx];
        const ok = checked && accepts(item.answer, val);
        const feedback = checked
          ? `<span class="vp-feedback ${ok ? "is-correct" : "is-wrong"}">${ok ? LABEL.correct : LABEL.wrongIs(modelAnswer(item.answer))}</span>
             <button type="button" class="vp-link-btn" data-reset="${idx}">${LABEL.retry}</button>`
          : `<button type="button" class="vp-btn-check" data-check="${idx}" ${val ? "" : "disabled"}>${LABEL.check}</button>`;
        const control = bankMode
          ? slotHtml(idx, val, checked, item.answer, ex.placeholder)
          : pillsHtml(options, idx, val, checked, item.answer);
        return `
          <div class="vp-fill-item">
            <p class="vp-fill-prompt">${escapeHtml(item.prompt)}</p>
            ${item.hint ? `<p class="vp-fill-hint">${escapeHtml(item.hint)}</p>` : ""}
            <div class="vp-fill-row">${control}${feedback}</div>
          </div>`;
      })
      .join("");
    root.innerHTML = `${bankMode ? bankHtml(options, state.selected) : ""}${items}`;

    if (bankMode) wireBank(root, state, render);
    else {
      root.querySelectorAll("[data-val]").forEach((b) => {
        b.addEventListener("click", () => { state.values[+b.dataset.slot] = b.dataset.val; render(); });
      });
    }
    root.querySelectorAll("[data-check]").forEach((b) => b.addEventListener("click", () => check(+b.dataset.check)));
    root.querySelectorAll("[data-reset]").forEach((b) => b.addEventListener("click", () => reset(+b.dataset.reset)));
  }
  function check(idx) {
    state.checked[idx] = true;
    notify(accepts(ex.items[idx].answer, state.values[idx] || ""));
    render();
  }
  function reset(idx) {
    delete state.values[idx];
    delete state.checked[idx];
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
  const answers = ex.rows.map((r) => r.answer);
  const options = shuffleList(optionSet(ex, answers));
  const bankMode = options.length > INLINE_MAX;
  const state = { values: {}, checked: false, selected: null };

  function render() {
    const head = ex.columns
      ? `<div class="vp-table-row vp-table-head"><span>${escapeHtml(ex.columns[0])}</span><span>${escapeHtml(ex.columns[1])}</span></div>`
      : "";
    const rows = ex.rows
      .map((row, idx) => {
        const val = state.values[idx] || "";
        const control = bankMode
          ? slotHtml(idx, val, state.checked, row.answer, ex.placeholder)
          : pillsHtml(options, idx, val, state.checked, row.answer);
        return `
          <div class="vp-table-row">
            <span class="vp-table-verb">${escapeHtml(row.term)}</span>
            ${control}
          </div>`;
      })
      .join("");
    const wrong = state.checked ? ex.rows.filter((r, i) => !accepts(r.answer, state.values[i] || "")) : [];
    root.innerHTML = `
      ${bankMode ? bankHtml(options, state.selected) : ""}
      <div class="vp-table">${head}${rows}</div>
      <div class="vp-actions">
        ${state.checked ? "" : `<button type="button" class="vp-btn-check" data-table-check>${LABEL.check}</button>`}
        <button type="button" class="vp-link-btn" data-table-reset>${LABEL.reset}</button>
        ${state.checked ? `<span class="vp-feedback ${wrong.length ? "is-wrong" : "is-correct"}">${wrong.length ? LABEL.someWrong : LABEL.allCorrect}</span>` : ""}
      </div>
      ${state.checked && wrong.length ? `<p class="vp-fill-hint">${wrong.map((r) => `${escapeHtml(r.term)} → <strong>${escapeHtml(modelAnswer(r.answer))}</strong>`).join(" · ")}</p>` : ""}`;

    if (bankMode) wireBank(root, state, render);
    else {
      root.querySelectorAll("[data-val]").forEach((b) => {
        b.addEventListener("click", () => { state.values[+b.dataset.slot] = b.dataset.val; render(); });
      });
    }
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
    state.selected = null;
    state.checked = false;
    render();
  }
  render();
}

/* --------------------------------------------------------------- story ----
 * Sentence rows, not a word bank.
 *
 * The bank sat at the top and the blanks ran down the page, which on a 664px phone
 * put the words 328px above the gap being filled by the time the learner reached
 * the last one: you pick a word, scroll down, and forget which blank you were on.
 * It was also a two-move interaction (word, then blank) in a page whose other
 * exercises answer in one, and nothing said so.
 *
 * So the text breaks at its own sentence boundaries and each sentence carries its
 * own answer row — the same shape as the `fill` exercise directly above it, which
 * means no new mechanic to learn and nothing that can scroll out of reach.
 *
 * Every story uses this layout, whatever its answers cost. The row set used to be
 * capped at five options because the set repeats under EVERY gap, so the price is
 * options x gaps, not options: Perfekt (8 answers, 12 gaps) rendered 96 pills and
 * a 9000px card — the exact wall of choices the bank was invented to avoid — and
 * anything wider fell back to the bank. That price is now paid per gap instead of
 * per exercise (see `gapOptions`), so a text may range over as many answers as it
 * likes — fourteen connectors, ten negation words, one preposition per sentence —
 * without any row growing past a line.
 *
 * One thing the data forced (see src/data/grammatik): 11 of 15 stories have a
 * sentence holding two or three blanks, so a row with more than one gets numbered
 * gaps and numbered answer rows. A single-gap sentence stays unnumbered — a "1"
 * there is noise.
 */

/** Five is where a row still reads as one line of answers on a 390px phone. */
const STORY_ROW_OPTIONS = 5;

/** The options offered under one gap: its own answer plus distractors drawn from
 *  the exercise's other answers. Anything `accepts` would also mark correct here
 *  is excluded, so a row never offers two right answers against one key. */
function gapOptions(pool, answer, max) {
  const correct = String(Array.isArray(answer) ? answer[0] : answer);
  const distractors = shuffleList(pool.filter((o) => o !== correct && !accepts(answer, o)));
  return shuffleList([correct, ...distractors.slice(0, Math.max(0, max - 1))]);
}

/** Cut the segment list into sentences. The boundaries sit INSIDE the text
 *  segments — one routinely ends a sentence and opens the next ("… das Wochenende.
 *  Sie wartet ") — so this splits the text, not just the list.
 *
 *  A row is a sentence and the answers that belong to it, so a piece with no blank
 *  in it is not a row: it joins the next one. Without that, the list-numbered texts
 *  (zweiteilige-konnektoren opens its items "1. Jan möchte …") each spend a row on
 *  a bare "1." above the sentence it numbers. */
function storyRows(segments) {
  const rows = [];
  let cur = [];
  for (const seg of segments) {
    if (seg.text === undefined) { cur.push(seg); continue; }
    let rest = seg.text;
    let m;
    while ((m = rest.match(/^[\s\S]*?[.!?](?=\s|$)/))) {
      cur.push({ text: m[0] });
      rows.push(cur);
      cur = [];
      rest = rest.slice(m[0].length).replace(/^\s+/, "");
      if (!rest) break;
    }
    if (rest) cur.push({ text: rest });
  }
  if (cur.length) rows.push(cur);

  const hasBlank = (r) => r.some((s) => s.blank !== undefined);
  const merged = [];
  let carry = [];
  for (const row of rows.filter((r) => r.length)) {
    // The split ate the whitespace between the two pieces; put one back.
    const next = carry.length ? [...carry, { text: " " }, ...row] : [...row];
    carry = [];
    if (hasBlank(next)) merged.push(next);
    else carry = next;
  }
  // A gapless tail has nothing to carry into, so it rides on the last row.
  if (carry.length) {
    if (merged.length) merged[merged.length - 1].push({ text: " " }, ...carry);
    else merged.push(carry);
  }
  return merged;
}

function mountStory(root, ex, notify) {
  const blanks = ex.segments.filter((s) => s.blank !== undefined);
  const pool = optionSet(ex, blanks.map((b) => b.answer));
  const rows = storyRows(ex.segments);
  const state = { values: {}, checked: false };

  // An exercise whose whole answer set already fits the cap keeps showing all of
  // it everywhere: with four prepositions on the table the learner is comparing
  // them, and thinning that per gap would hand out free eliminations.
  const shared = pool.length <= STORY_ROW_OPTIONS ? shuffleList(pool) : null;
  // Drawn once, not per render — re-drawing a row must not reshuffle the answers
  // under the learner's thumb between one tap and the next.
  const optionsFor = {};
  blanks.forEach((s) => { optionsFor[s.blank] = shared || gapOptions(pool, s.answer, STORY_ROW_OPTIONS); });

  function gapHtml(seg, numbered) {
    const value = state.values[seg.blank] || "";
    const ok = state.checked && accepts(seg.answer, value);
    const cls = state.checked ? (ok ? "is-correct" : "is-wrong") : value ? "is-chosen" : "";
    const num = numbered ? `<span class="vp-gap-num">${seg.blank + 1}</span>` : "";
    return `<span class="vp-gap ${cls}" data-gap="${seg.blank}">${num}${value ? escapeHtml(value) : "&nbsp;&nbsp;&nbsp;"}</span>`;
  }

  function render() {
    const body = rows
      .map((segs) => {
        const gaps = segs.filter((s) => s.blank !== undefined);
        // Only a sentence with more than one gap needs its gaps told apart.
        const numbered = gaps.length > 1;
        const text = segs
          .map((s) => (s.text !== undefined ? escapeHtml(s.text) : gapHtml(s, numbered)))
          .join("");
        const answers = gaps
          .map((g) => `<div class="vp-srow-answer">${
            numbered ? `<span class="vp-srow-num">${g.blank + 1}</span>` : ""
          }${pillsHtml(optionsFor[g.blank], g.blank, state.values[g.blank] || "", state.checked, g.answer)}</div>`)
          .join("");
        return `<div class="vp-srow"><p class="vp-srow-text">${text}</p>${answers}</div>`;
      })
      .join("");

    const allCorrect = state.checked && blanks.every((s) => accepts(s.answer, state.values[s.blank] || ""));
    const missed = state.checked ? blanks.filter((s) => !accepts(s.answer, state.values[s.blank] || "")) : [];

    root.innerHTML = `
      ${body}
      <div class="vp-actions">
        ${state.checked ? "" : `<button type="button" class="vp-btn-check" data-story-check>${LABEL.check}</button>`}
        <button type="button" class="vp-link-btn" data-story-reset>${LABEL.reset}</button>
        ${state.checked ? `<span class="vp-feedback ${allCorrect ? "is-correct" : "is-wrong"}">${allCorrect ? LABEL.allCorrect : LABEL.someWrong}</span>` : ""}
      </div>
      ${missed.length ? `<p class="vp-fill-hint">${missed.map((s) => `${s.blank + 1}. <strong>${escapeHtml(modelAnswer(s.answer))}</strong>`).join(" · ")}</p>` : ""}`;

    root.querySelectorAll("[data-slot]").forEach((b) => {
      b.addEventListener("click", () => {
        state.values[+b.dataset.slot] = b.dataset.val;
        render();
      });
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

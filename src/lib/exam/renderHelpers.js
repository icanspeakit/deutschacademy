// DOM primitives shared by every exam trainer — the reusable pieces (state.js,
// scoring.js, this file and the .exam-app chrome in src/styles/exam-app.css) that a
// new exam page builds on. Ported from Pflegeplace's src/lib/exam/render-helpers.ts,
// rewritten against this project's plain-JS + design-token style.
import { tx } from "./i18n.js";

export function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

export function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

const CHECK = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M9.6 16.2 5.4 12l-1.4 1.4 5.6 5.6 12-12-1.4-1.4z"/></svg>';
const CROSS = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z"/></svg>';

/* A single auto-graded question: renders the options, locks and colours them on the
   first tap, shows the right/wrong line, and reports back through onAnswer so the
   caller can persist it and refresh the sidebar. Answering is one tap — no separate
   "Prüfen" — because that is how the click-to-answer exercises elsewhere behave. */
export function choiceCard({ qLabel, questionText, context, options, correctKey, existing, layout = "list", onAnswer }) {
  const card = el("div", "qcard");
  card.appendChild(el("div", "qhead", '<span class="qnum">' + escapeHtml(qLabel) + "</span>"));
  if (context) card.appendChild(el("p", "qcontext", escapeHtml(context)));
  if (questionText) card.appendChild(el("p", "qtext", escapeHtml(questionText)));

  const optWrap = el("div", "options" + (layout === "grid" ? " grid" : layout === "wrap" ? " wrap" : ""));
  const fb = el("div", "feedback");
  fb.hidden = true;

  for (const o of options) {
    const b = el("button", "opt");
    b.type = "button";
    b.dataset.key = o.key;
    b.innerHTML = '<span class="optbadge">' + escapeHtml(o.key.toUpperCase()) + "</span><span>" + escapeHtml(o.label) + "</span>";
    optWrap.appendChild(b);
  }

  function lock(givenKey) {
    for (const child of optWrap.children) {
      child.disabled = true;
      const k = child.dataset.key;
      if (k === correctKey) child.classList.add("correct");
      else if (k === givenKey) child.classList.add("incorrect");
      else child.classList.add("dim");
    }
    const ok = givenKey === correctKey;
    fb.hidden = false;
    fb.className = "feedback " + (ok ? "correct" : "incorrect");
    const right = options.find((o) => o.key === correctKey);
    fb.innerHTML = ok
      ? CHECK + " <span>" + escapeHtml(tx("exam.fb.correct", "Richtig.")) + "</span>"
      : CROSS + " <span>" + tx("exam.fb.wrong", "Nicht ganz — richtig ist <b>{a}</b>.", { a: escapeHtml(right ? right.label : correctKey) }) + "</span>";
  }

  if (existing) lock(existing.given);

  optWrap.addEventListener("click", (e) => {
    const b = e.target.closest(".opt");
    if (!b || b.disabled) return;
    const given = b.dataset.key;
    lock(given);
    onAnswer(given, given === correctKey);
  });

  card.appendChild(optWrap);
  card.appendChild(fb);
  return card;
}

/* For read-through material that has no right answer (a Fakten page, a speaking
   prompt): a manual "als geübt markieren" toggle that still records through the same
   state shape, so the progress math needs no special case for it. */
export function practiceToggle({ existing, onToggle }) {
  let marked = !!existing;
  const btn = el("button", "practice-toggle");
  btn.type = "button";
  function paint() {
    btn.classList.toggle("marked", marked);
    btn.innerHTML = marked
      ? CHECK + " <span>" + escapeHtml(tx("exam.practiced.done", "Als geübt markiert")) + "</span>"
      : '<span class="practice-toggle-dot"></span><span>' + escapeHtml(tx("exam.practiced.mark", "Als geübt markieren")) + "</span>";
  }
  paint();
  btn.addEventListener("click", () => {
    marked = !marked;
    paint();
    onToggle(marked);
  });
  return btn;
}

export function sectionHeader(main, { eyebrow, title, instruction }) {
  if (eyebrow) main.appendChild(el("p", "section-eyebrow", escapeHtml(eyebrow)));
  main.appendChild(el("h2", "section-title", escapeHtml(title)));
  if (instruction) main.appendChild(el("p", "instruction", instruction));
}

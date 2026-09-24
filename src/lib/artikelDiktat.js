// The Artikel Diktat (ArtikelDiktat.astro): hear "der Tisch", type it, get told exactly
// what was off — the article, the capital letter, or the spelling — rather than just "falsch".
//
// A round is ten nouns, drawn afresh each time. An answer is checked once; the learner then
// sees the right form, can hear it again, and goes on. Each answer is recorded like any other
// Artikel answer, so it counts on /fortschritt.
import { recordAttempt } from "./progress.js";

const shuffle = (a) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

/**
 * What was wrong, in the order a teacher would say it. `said` is what the learner typed,
 * split into article and noun on the first space.
 * @returns {{ ok: boolean, notes: string[] }}
 */
export function check(typed, q) {
  const said = typed.trim().replace(/\s+/g, " ");
  const [art = "", ...rest] = said.split(" ");
  const noun = rest.join(" ");
  // "Der Tisch" is right too: a capital at the start is how a sentence would begin.
  const cap = q.gender[0].toUpperCase() + q.gender.slice(1);
  if (said === `${q.gender} ${q.lemma}` || said === `${cap} ${q.lemma}`) return { ok: true, notes: [] };
  const notes = [];
  const artLow = art.toLowerCase();
  if (!noun) notes.push("Schreib den Artikel und das Nomen, z. B. „der Tisch“.");
  else {
    if (["ein", "eine", "einen"].includes(artLow)) notes.push(`Du hörst den bestimmten Artikel: „${q.gender}“, nicht „${artLow}“.`);
    else if (!["der", "die", "das"].includes(artLow)) notes.push(`„${art}“ ist kein Artikel. Es heißt „${q.gender}“.`);
    else if (artLow !== q.gender) notes.push(`Der Artikel ist „${q.gender}“, nicht „${artLow}“.`);
    else if (art !== artLow && art !== cap) notes.push(`Schreib den Artikel „${q.gender}“ klein.`);
    if (noun.toLowerCase() === q.lemma.toLowerCase()) {
      if (noun !== q.lemma) notes.push("Nomen schreibt man groß: " + q.lemma[0] + " am Anfang.");
    } else notes.push("Das Nomen ist anders geschrieben.");
  }
  return { ok: false, notes };
}

export function mountDiktat(root, { round: ROUND, pool }) {
  const $ = (s) => root.querySelector(s);
  const input = $("[data-akd-input]");
  const form = $("[data-akd-form]");
  const feedback = $("[data-akd-feedback]");
  const next = $("[data-akd-next]");
  const count = $("[data-akd-count]");
  const score = $("[data-akd-score]");
  const slow = $("[data-akd-slow]");
  const done = $("[data-akd-done]");
  const audio = new Audio();
  audio.preload = "auto";

  let items = [];
  let i = 0;
  let right = 0;
  let answered = false;

  function play() {
    const q = items[i];
    if (!q) return;
    audio.pause();
    audio.src = q.audio;
    audio.playbackRate = slow.getAttribute("aria-pressed") === "true" ? 0.7 : 1;
    audio.play().catch(() => {});
  }

  function show() {
    const q = items[i];
    answered = false;
    form.hidden = false;
    done.hidden = true;
    feedback.hidden = true;
    next.hidden = true;
    input.value = "";
    input.disabled = false;
    input.classList.remove("is-ok", "is-no");
    count.textContent = `${i + 1} / ${items.length}`;
    score.textContent = i ? `${right} richtig` : "";
    if (!q) return;
    audio.src = q.audio;
  }

  function start() {
    items = shuffle(pool.slice()).slice(0, ROUND);
    i = 0;
    right = 0;
    show();
  }

  function finish() {
    form.hidden = true;
    feedback.hidden = true;
    next.hidden = true;
    done.hidden = false;
    count.textContent = `${items.length} / ${items.length}`;
    score.textContent = "";
    $("[data-akd-done-title]").textContent = `${right} von ${items.length} richtig geschrieben.`;
    $("[data-akd-done-text]").textContent =
      right === items.length ? "Alles richtig — Artikel, Groß­schreibung und Rechtschreibung." : "Die Fehler kommen im nächsten Diktat vielleicht wieder. Nochmal?";
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = items[i];
    if (!q || answered || !input.value.trim()) return;
    answered = true;
    const r = check(input.value, q);
    if (r.ok) right++;
    input.disabled = true;
    input.classList.add(r.ok ? "is-ok" : "is-no");
    feedback.hidden = false;
    feedback.className = `akd-feedback ${r.ok ? "is-ok" : "is-no"}`;
    feedback.innerHTML = r.ok
      ? `<p class="akd-verdict">Richtig: <b>${esc(q.gender)} ${esc(q.lemma)}</b></p>`
      : `<p class="akd-verdict">Richtig ist: <b>${esc(q.gender)} ${esc(q.lemma)}</b></p><ul>${r.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>`;
    score.textContent = `${right} richtig`;
    next.hidden = false;
    next.textContent = i + 1 < items.length ? "Weiter →" : "Ergebnis →";
    next.focus();
    recordAttempt({ skill: "grammatik", correct: r.ok, id: q.id, trackVocab: true, topic: "artikel" });
  });

  next.addEventListener("click", () => {
    i++;
    if (i >= items.length) return finish();
    show();
    input.focus();
    play();
  });

  $("[data-akd-play]").addEventListener("click", () => { play(); if (!answered) input.focus(); });
  slow.addEventListener("click", () => {
    slow.setAttribute("aria-pressed", String(slow.getAttribute("aria-pressed") !== "true"));
    play();
  });
  // Umlauts and ß for keyboards that have none, typed where the cursor is.
  root.querySelectorAll("[data-akd-key]").forEach((b) =>
    b.addEventListener("click", () => {
      if (input.disabled) return;
      const { selectionStart: s = input.value.length, selectionEnd: e = s } = input;
      input.value = input.value.slice(0, s) + b.dataset.akdKey + input.value.slice(e);
      input.setSelectionRange(s + 1, s + 1);
      input.focus();
    }),
  );
  $("[data-akd-again]").addEventListener("click", () => { start(); input.focus(); play(); });

  // Silent whenever the panel is not on screen: leaving the beat must not leave a voice.
  const panel = root.closest("[data-beat-panel]");
  if (panel) new MutationObserver(() => { if (panel.hidden) audio.pause(); }).observe(panel, { attributes: true, attributeFilter: ["hidden"] });

  start();
}

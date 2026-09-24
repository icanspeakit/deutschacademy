// Shared renderers for every kind of exercise the site can mount inside a page
// shell. Extracted from the dashboard so the topic pages (/v1 and anything built
// on TopicShell) mount exactly the same widgets from exactly the same data —
// there is one implementation of "how a Wortschatz card behaves", not one per
// layout.
//
// Each renderer takes a host element and fills it. Answers are reported through
// the `credit(id, ok)` callback the caller supplies, so the caller decides what
// progress means in its context. Nothing here knows about any particular layout.
//
// The heavy topic data (grammar workspaces, the DTZ Ubungssatz, telc
// Sprachbausteine) is loaded lazily, one topic at a time.
import { mountQuiz } from "../lib/quiz.js";
import { mountGrammarWorkspace } from "../lib/grammarWorkspace.js";
import { mountPracticeWorkspace } from "../lib/practiceWorkspace.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const WORKSPACE_LOADERS = import.meta.glob("../data/grammatik/*.json");
export const loaderFor = (id) => {
  const key = Object.keys(WORKSPACE_LOADERS).find((k) => k.endsWith(`/${id}.json`));
  return key ? WORKSPACE_LOADERS[key] : null;
};

export const INLINE_TITLES = {
  choice: "Aufgaben zum Text",
  cards: "Karteikarten",
  audio: "Anhören und nachsprechen",
  speak: "Bild beschreiben",
  read: "Diskussionsthema",
  dtz: "DTZ-Übungssatz",
  picker: "Thema wählen",
  result: "Dein Ergebnis",
  bausteine: "Sprachbausteine üben",
};

/**
 * @param {object} deps
 *   DATA      the payload block (choice/cards/audio/speak/read/picker/…)
 *   ARTIKEL   { pool, levels, session } for the Artikel-Trainer
 *   credit    (topicId, correct) => void
 *   onPick    (topicId) => void        what a picker entry does
 *   totals    (sectionId) => {done,tasks,pct} | null, for the result view
 *   sections  { [id]: { label, items } }, for the result view
 */
export function createExerciseMounter({ DATA, ARTIKEL, credit, onPick, totals, sections }) {
  const creditAnswer = (id, ok) => credit(id, ok);
  let resultRepaint = null;


// Fisher-Yates, same as the live trainer: every round is a fresh draw.
function drawSession(level) {
  const filtered = level === "all" ? ARTIKEL.pool : ARTIKEL.pool.filter((q) => q.level === level);
  const shuffled = filtered.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, ARTIKEL.session);
}

// Each mount point gets its own session, controls and state, so the copy on
// the overview and the copy in the item view never fight over the DOM.
function mountTrainer(host) {
  if (host.dataset.mounted === "1") return;
  host.dataset.mounted = "1";

  host.innerHTML = `
    <div class="akk-mode-row">
      <div class="akk-mode" role="group" aria-label="Übungsmodus">
        <span class="akk-mode-label">Modus</span>
        <button class="akk-mode-btn active" data-mode="fokus" type="button">Fokus-Modus</button>
        <span class="akk-mode-sep">·</span>
        <button class="akk-mode-btn" data-mode="test" type="button">Testmodus</button>
      </div>
      <div class="akk-mode" role="group" aria-label="Niveau">
        <span class="akk-mode-label">Niveau</span>
        ${ARTIKEL.levels.map((l, i) =>
          `${i > 0 ? '<span class="akk-mode-sep">·</span>' : ""}<button class="akk-level-btn${i === 0 ? " active" : ""}" data-level="${l.key}" type="button" aria-label="Niveau ${l.label}, ${l.count} Nomen">${l.label}</button>`).join("")}
        <button class="akk-level-btn akk-level-reload" data-newround type="button">Neue Runde</button>
      </div>
    </div>
    <div data-trainer-mount></div>`;

  const mount = host.querySelector("[data-trainer-mount]");
  let level = "A1";
  let mode = "fokus";
  let practice = null;

  function start() {
    practice = mountPracticeWorkspace(mount, drawSession(level), {
      onAnswer: (ok) => creditAnswer("artikel-trainer", ok),
    });
    practice.setMode(mode);
  }
  start();

  host.querySelectorAll(".akk-level-btn[data-level]").forEach((btn) =>
    btn.addEventListener("click", () => {
      host.querySelectorAll(".akk-level-btn[data-level]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      level = btn.dataset.level;
      start();
    }));
  host.querySelector("[data-newround]")?.addEventListener("click", () => start());
  host.querySelectorAll(".akk-mode-btn").forEach((btn) =>
    btn.addEventListener("click", () => {
      host.querySelectorAll(".akk-mode-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      mode = btn.dataset.mode;
      practice?.setMode(mode);
    }));
}

// ── The remaining exercise kinds ──────────────────────────────────
// Everything here renders into one host element and reports correct answers
// through creditAnswer, so the rings, bars and the strip behave the same no
// matter which kind of exercise produced the answer.

// Reading comprehension and the Einbürgerungstest: a text (where there is
// one) plus multiple-choice questions, group by group.
function mountChoice(host, id) {
  const groups = DATA.choice[id];
  if (!groups) return;
  let g = 0;

  const render = () => {
    const group = groups[g];
    host.innerHTML = `
      ${groups.length > 1 ? `<div class="nv-grouptabs">${groups
        .map((x, i) => `<button type="button" class="nv-grouptab${i === g ? " active" : ""}" data-g="${i}">${esc(x.title)}</button>`)
        .join("")}</div>` : ""}
      ${group.text ? `<div class="nv-readtext">${group.text}</div>` : ""}
      <div class="nv-quiz" data-choice-root></div>`;
    host.querySelectorAll("[data-g]").forEach((b) =>
      b.addEventListener("click", () => { g = +b.dataset.g; render(); }));
    mountQuiz(host.querySelector("[data-choice-root]"), group.questions, {
      mode: "choice",
      onAnswer: (ok) => creditAnswer(id, ok),
    });
  };
  render();
}

// Karteikarten: front, flip, then say whether you knew it.
function mountCards(host, id) {
  const cards = DATA.cards;
  let i = 0;
  let flipped = false;

  const render = () => {
    const c = cards[i];
    host.innerHTML = `
      <div class="nv-card-counter">Karte ${i + 1} / ${cards.length}</div>
      <button type="button" class="nv-flashcard${flipped ? " flipped" : ""}" data-flip>
        <span class="nv-flashcard-front">${esc(c.front)}</span>
        ${flipped ? `<span class="nv-flashcard-back">${esc(c.back || c.note || "—")}</span>` : `<span class="nv-flashcard-hint">Klicken zum Umdrehen</span>`}
      </button>
      ${flipped ? `<div class="nv-card-actions">
        <button type="button" class="nv-btn nv-btn--ghost" data-again>Nochmal</button>
        <button type="button" class="nv-btn nv-btn--primary" data-knew>Gewusst →</button>
      </div>` : ""}`;
    host.querySelector("[data-flip]")?.addEventListener("click", () => { flipped = !flipped; render(); });
    const next = (ok) => {
      creditAnswer(id, ok);
      i = (i + 1) % cards.length;
      flipped = false;
      render();
    };
    host.querySelector("[data-knew]")?.addEventListener("click", () => next(true));
    host.querySelector("[data-again]")?.addEventListener("click", () => next(false));
  };
  render();
}

// Aussprache: the browser's own speech synthesis, same approach as the
// live page — no audio files needed for a study page.
function mountAudio(host, id) {
  const words = DATA.audio;
  let i = 0;
  let rate = 1;
  const speak = () => {
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(words[i]);
      u.lang = "de-DE";
      u.rate = rate;
      speechSynthesis.speak(u);
    } catch (e) {}
  };
  const render = () => {
    host.innerHTML = `
      <div class="nv-card-counter">Wort ${i + 1} / ${words.length}</div>
      <div class="nv-audioword">${esc(words[i])}</div>
      <div class="nv-card-actions">
        <button type="button" class="nv-btn nv-btn--primary" data-play>▶ Anhören</button>
        <button type="button" class="nv-btn nv-btn--ghost" data-slow>🐢 Langsam</button>
        <button type="button" class="nv-btn nv-btn--ghost" data-next>Nachgesprochen →</button>
      </div>
      <p class="nv-quickex-sub">Anhören, nachsprechen, weiter. Die Stimme kommt aus dem Browser.</p>`;
    host.querySelector("[data-play]")?.addEventListener("click", () => { rate = 1; speak(); });
    host.querySelector("[data-slow]")?.addEventListener("click", () => { rate = 0.6; speak(); });
    host.querySelector("[data-next]")?.addEventListener("click", () => {
      creditAnswer(id, true);
      i = (i + 1) % words.length;
      render();
    });
  };
  render();
}

// Bildbeschreibung: the picture, the examiner's questions, a 90-second
// timer — the shape of the real DTZ speaking part.
function mountSpeak(host, id) {
  const items = DATA.speak;
  let i = 0;
  let left = 90;
  let timer;

  const render = () => {
    const s = items[i];
    clearInterval(timer);
    left = 90;
    host.innerHTML = `
      <div class="nv-card-counter">${esc(s.title)} · ${i + 1} / ${items.length}</div>
      <img class="nv-speakimg" src="${esc(s.image)}" alt="${esc(s.title)}" loading="lazy" />
      <div class="nv-speakcols">
        <div><h4>Bild beschreiben</h4><ul>${s.beschreibung.map((q) => `<li>${esc(q)}</li>`).join("")}</ul></div>
        <div><h4>Persönliche Fragen</h4><ul>${s.persoenlich.map((q) => `<li>${esc(q)}</li>`).join("")}</ul></div>
      </div>
      <div class="nv-card-actions">
        <button type="button" class="nv-btn nv-btn--primary" data-timer>▶ 90 Sekunden starten</button>
        <span class="nv-timer" data-clock>1:30</span>
        <button type="button" class="nv-btn nv-btn--ghost" data-next>Gesprochen →</button>
      </div>`;
    const clock = host.querySelector("[data-clock]");
    host.querySelector("[data-timer]")?.addEventListener("click", () => {
      clearInterval(timer);
      timer = window.setInterval(() => {
        left--;
        clock.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
        if (left <= 0) { clearInterval(timer); clock.textContent = "Zeit um"; }
      }, 1000);
    });
    host.querySelector("[data-next]")?.addEventListener("click", () => {
      creditAnswer(id, true);
      i = (i + 1) % items.length;
      render();
    });
  };
  render();
}

// Kulturwissen is a discussion topic, not a drill: the question with its
// arguments, then a button to say you have worked through it.
function mountRead(host, id) {
  const items = DATA.read;
  let i = 0;
  const render = () => {
    const k = items[i];
    host.innerHTML = `
      <div class="nv-card-counter">${esc(k.eyebrow)} · ${i + 1} / ${items.length}</div>
      <h3 class="nv-readq">${esc(k.question ?? k.title)}</h3>
      <p class="nv-quickex-sub">${esc(k.intro ?? "")}</p>
      <div class="nv-speakcols">
        <div><h4>${esc(k.pros?.label ?? "Dafür")}</h4><ul>${(k.pros?.items ?? []).map((p) => `<li>${esc(p)}</li>`).join("")}</ul></div>
        <div><h4>${esc(k.cons?.label ?? "Dagegen")}</h4><ul>${(k.cons?.items ?? []).map((c) => `<li>${esc(c)}</li>`).join("")}</ul></div>
      </div>
      <div class="nv-card-actions">
        <button type="button" class="nv-btn nv-btn--primary" data-next>Durchgearbeitet →</button>
      </div>`;
    host.querySelector("[data-next]")?.addEventListener("click", () => {
      creditAnswer(id, true);
      i = (i + 1) % items.length;
      render();
    });
  };
  render();
}

// The DTZ Übungssatz — the real trainer, lazily loaded.
const DTZ_LOADERS = import.meta.glob("../data/pruefungen/dtz/*.json");
async function mountDtz(host, id) {
  host.innerHTML = `<p class="nv-ws-loading">Übungssatz wird geladen …</p>`;
  const key = Object.keys(DTZ_LOADERS)[0];
  if (!key) return;
  const mod = await DTZ_LOADERS[key]();
  const data = mod.default ?? mod;
  host.innerHTML = `<div class="dtz"><div data-dtz-nav></div><div data-dtz-body></div><div data-dtz-summary></div></div>`;
  const { mountDtzTrainer } = await import("../lib/dtzTrainer.js");
  mountDtzTrainer(host.querySelector(".dtz"), data, { onAnswer: (ok) => creditAnswer(id, ok) });
}

// The course module row is not an exercise — it is a way into one.
function mountPicker(host, id) {
  const scope = DATA.pickerScope[id];
  const list = scope ? DATA.picker.filter((t) => scope.includes(t.level)) : DATA.picker;
  host.innerHTML = `
    <p class="nv-quickex-sub">${list.length} Themen${scope ? ` auf ${scope.join(" und ")}` : ""}. Wähle eines — Regel und Übungen öffnen sich in dieser Ansicht.</p>
    <div class="nv-pickergrid">${list
      .map((t) => `<button type="button" class="nv-pickerbtn" data-pick="${t.id}">
        <span class="nv-levelchip">${esc(t.level)}</span><span>${esc(t.label)}</span><span class="nv-count">${t.tasks}</span>
      </button>`).join("")}</div>`;
  host.querySelectorAll("[data-pick]").forEach((b) =>
    b.addEventListener("click", () => onPick(b.dataset.pick)));
}

// Ergebnis: not an exercise but a real result view, computed live from
// everything practised on this page.
function mountResult(host) {
  const render = () => {
    const rows = Object.keys(sections)
      .filter((sid) => sid !== "weg" && totals(sid) && totals(sid).pct !== null)
      .map((sid) => ({ sid, label: sections[sid].label, ...totals(sid) }));
    const course = totals("weg") || { done: 0, tasks: 0, pct: 0 };
    host.innerHTML = `
      <p class="nv-quickex-sub">Stand dieser Sitzung — jede richtige Antwort oben zählt hier sofort mit.</p>
      <div class="nv-resultgrid">${rows.map((r) => `
        <div class="nv-resultrow">
          <span class="nv-levelchip">${esc(r.label)}</span>
          <span class="nv-modtrack"><span style="width:${r.pct}%"></span></span>
          <span class="nv-modpoints">${r.done} / ${r.tasks}</span>
          <span class="nv-resultpct">${r.pct} %</span>
        </div>`).join("")}</div>
      <p class="nv-resultsum">Kurs insgesamt: <strong>${course.done} von ${course.tasks} Aufgaben</strong> · ${course.pct} %</p>`;
  };
  render();
  resultRepaint = render;
}

// telc Sprachbausteine — workspace-shaped, so the grammar engine drives it.
const BAUSTEIN_LOADERS = import.meta.glob("../data/pruefungen/sprachbausteine/*.json");
async function mountBausteine(host, id) {
  host.innerHTML = `<p class="nv-ws-loading">Sprachbausteine werden geladen …</p>`;
  const key = Object.keys(BAUSTEIN_LOADERS)[0];
  if (!key) return;
  const mod = await BAUSTEIN_LOADERS[key]();
  const w = mod.default ?? mod;
  host.innerHTML = (w.exercises ?? []).map((ex, i) => `
    <div class="vp-card">
      <div class="vp-ex-head"><span class="badge badge-neutral">${i + 1}</span><h3>${esc(ex.title)}</h3></div>
      ${ex.hint ? `<p class="vp-ex-hint">${esc(ex.hint)}</p>` : ""}
      <div data-ex-index="${i}"></div>
    </div>`).join("");
  mountGrammarWorkspace(host, w, { onAnswer: (ok) => creditAnswer(id, ok) });
}

// One dispatcher, so every caller mounts exercises the same way.
function mountInline(host, id, kind) {
  // Anything but the result view means that view is gone; stop repainting it.
  if (kind !== "result") resultRepaint = null;
  if (host.dataset.mounted === kind + ":" + id) return;
  host.dataset.mounted = kind + ":" + id;
  if (kind === "trainer") { host.dataset.mounted = ""; mountTrainer(host); return; }
  if (kind === "choice") return mountChoice(host, id);
  if (kind === "cards") return mountCards(host, id);
  if (kind === "audio") return mountAudio(host, id);
  if (kind === "speak") return mountSpeak(host, id);
  if (kind === "read") return mountRead(host, id);
  if (kind === "dtz") { mountDtz(host, id); return; }
  if (kind === "picker") return mountPicker(host, id);
  if (kind === "result") return mountResult(host);
  if (kind === "bausteine") { mountBausteine(host, id); return; }
}

// The exercise that sits on a Stufenübersicht. Mounted once per section and
// then left alone, so switching back and forth does not wipe the answers.
  return { mountInline, mountTrainer, repaintResult: () => resultRepaint && resultRepaint() };
}

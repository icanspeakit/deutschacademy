/* "Mein Fortschritt" — the cross-exam progress view behind /fortschritt.
 *
 * Shape borrowed from the Pflegeplace dashboard: a left rail that nests the selected
 * exam's parts under it with a per-part count, the other exams listed below it as a
 * switcher, and a main panel with one headline number, a "carry on where you stopped"
 * button, and a module table. The point of that layout is that the rail answers "where
 * am I?" and the table answers "what is left?", and neither has to scroll to do it.
 *
 * Everything here reads localStorage and never writes an answer: this page reports on
 * the trainers, it does not grade. The one thing it writes is the last exam you looked
 * at, so coming back opens where you were.
 *
 * Progress survives a reload but lives only in this browser — there is no account yet.
 * A first visit therefore renders real zeros rather than a demo.
 */
import { examRegistry, examById, lidLandIds, lidDefaultLandIds } from "./exam/registry.js";

const LAST_KEY = "da-fortschritt-last";
const LID_LAND_KEY = "da-lid-land";

/* ------------------------------------------------------------------ state -- */

function readJson(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    // Private mode, cleared site data, or a corrupt entry — report nothing done
    // rather than failing the page.
    return null;
  }
}

/** The stored state for one exam, normalised to { answers, extra }. */
function stateOf(exam) {
  const prefix = exam.store.kind === "dtz" ? "da-dtz-v1:" : "da-exam-v1:";
  const parsed = readJson(prefix + exam.store.key);
  return { answers: parsed?.answers ?? {}, extra: parsed ?? {} };
}

/** Resolve a module whose ids only the browser knows. */
function resolveIds(exam, mod) {
  if (!mod.idsFrom) return mod.ids ?? [];
  if (mod.idsFrom === "lid-land") {
    let landId = null;
    try {
      landId = localStorage.getItem(LID_LAND_KEY);
    } catch {}
    return landId ? lidLandIds(landId) : lidDefaultLandIds;
  }
  return [];
}

/** A module that a human marks rather than the app: done is a flag, not an answer. */
function manualDone(exam, mod, state) {
  if (mod.doneFrom === "dtz-schreiben") return state.extra?.schreiben?.selfRate != null;
  return null;
}

/**
 * One row of truth per module: how many of its items are answered, how many right,
 * and whether it counts towards points.
 */
export function moduleStats(exam, mod, state) {
  const ids = resolveIds(exam, mod);
  const manual = manualDone(exam, mod, state);
  if (manual !== null) {
    return { key: mod.key, label: mod.label, scored: false, total: 1, done: manual ? 1 : 0, correct: 0 };
  }
  const done = ids.filter((id) => state.answers[id] != null).length;
  const correct = ids.filter((id) => state.answers[id]?.correct).length;
  return { key: mod.key, label: mod.label, scored: mod.scored !== false, total: ids.length, done, correct };
}

/** Everything the view needs about one exam, in one pass over its modules. */
export function examStats(exam) {
  const state = stateOf(exam);
  const modules = exam.modules.map((m) => moduleStats(exam, m, state));
  const scored = modules.filter((m) => m.scored);
  const points = scored.reduce((n, m) => n + m.correct, 0);
  const maxPoints = scored.reduce((n, m) => n + m.total, 0);
  const answered = scored.reduce((n, m) => n + m.done, 0);
  const started = modules.filter((m) => m.done > 0).length;
  // "Weiter bei …" points at the first module with something left, so the button
  // always means the same thing: the next thing you have not finished.
  const next = modules.find((m) => m.done < m.total) ?? null;
  return {
    exam,
    modules,
    points,
    maxPoints,
    answered,
    started,
    moduleCount: modules.length,
    pct: maxPoints ? Math.round((points / maxPoints) * 100) : 0,
    donePct: maxPoints ? Math.round((answered / maxPoints) * 100) : 0,
    next,
  };
}

export function allExamStats() {
  return examRegistry.map(examStats);
}

/* ------------------------------------------------------------------- view -- */

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function dot(m) {
  const cls = m.done === 0 ? "" : m.done >= m.total ? " is-done" : " is-part";
  const pct = m.total ? Math.round((m.done / m.total) * 100) : 0;
  return `<span class="fs-dot${cls}" style="--pct:${pct}%"></span>`;
}

function bar(done, total, cls = "") {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return `<span class="fs-bar ${cls}"><span class="fs-bar-fill" style="width:${pct}%"></span></span>`;
}

/** The left rail: the open exam with its parts nested under it, then the others. */
function railHtml(stats, activeId) {
  const active = stats.find((s) => s.exam.id === activeId) ?? stats[0];

  const parts = active.modules
    .map((m) => {
      const href = `${active.exam.href}#${m.key}`;
      // An unscored part with two tasks (Start Deutsch 1's Formular + Nachricht) must
      // not read "fertig" when only one is marked — it still gets a fraction.
      const count = m.scored || m.total > 1
        ? `${m.done}/${m.total}`
        : m.done ? "fertig" : "offen";
      return `<a class="fs-part" href="${esc(href)}">
        ${dot(m)}<span class="fs-part-label">${esc(m.label)}</span><span class="fs-part-n">${esc(count)}</span>
      </a>`;
    })
    .join("");

  const others = stats
    .map((s) => {
      const on = s.exam.id === active.exam.id;
      return `<button type="button" class="fs-examitem${on ? " is-on" : ""}" data-exam="${esc(s.exam.id)}">
        <span class="fs-examitem-name">${esc(s.exam.title)}</span>
        <span class="fs-examitem-n">${s.maxPoints ? `${s.points}/${s.maxPoints}` : ""}</span>
      </button>`;
    })
    .join("");

  return `
    <div class="fs-rail-head">
      <span class="fs-rail-flag">▶</span>
      <span>${esc(active.exam.title)}</span>
    </div>
    <nav class="fs-parts" aria-label="Prüfungsteile">${parts}</nav>
    <a class="fs-rail-result" href="${esc(active.exam.href)}#ergebnis">
      <span class="fs-rail-flag">■</span><span>Ergebnis</span>
    </a>
    <button type="button" class="fs-reset" data-reset-exam="${esc(active.exam.id)}">Fortschritt zurücksetzen</button>
    <p class="fs-rail-label">Prüfung</p>
    <div class="fs-examlist">${others}</div>`;
}

/** The big number, the ring, the carry-on button. */
function headHtml(s) {
  const ring = `
    <svg class="fs-ring" viewBox="0 0 44 44" aria-hidden="true">
      <circle class="fs-ring-track" cx="22" cy="22" r="19" />
      <circle class="fs-ring-fill" cx="22" cy="22" r="19"
              style="stroke-dasharray:${(s.donePct / 100) * 119.4} 119.4" />
    </svg>`;

  const nextBtn = s.next
    ? `<a class="fs-next" href="${esc(s.exam.href)}#${esc(s.next.key)}">Weiter bei ${esc(s.next.label)} →</a>`
    : `<a class="fs-next" href="${esc(s.exam.href)}#ergebnis">Ergebnis ansehen →</a>`;

  return `
    <div class="fs-head">
      <div class="fs-head-main">
        <p class="fs-eyebrow">Mein Fortschritt</p>
        <h2 class="fs-exam-title">${esc(s.exam.title)} <small>${esc(s.exam.subtitle)}</small></h2>
        <p class="fs-points"><b>${s.points}</b> von ${s.maxPoints} Punkten</p>
        ${bar(s.answered, s.maxPoints, "fs-bar--wide")}
        <p class="fs-sub">${s.donePct}% bearbeitet · ${s.started} von ${s.moduleCount} Teilen begonnen</p>
        <p class="fs-note">${esc(s.exam.passNote)}</p>
      </div>
      <div class="fs-head-side">
        <div class="fs-ringcard">
          ${ring}
          <div class="fs-ringcard-txt">
            <b>${s.points} / ${s.maxPoints}</b>
            <span>Punkte · ${s.moduleCount} Teile</span>
          </div>
        </div>
        ${nextBtn}
      </div>
    </div>`;
}

function tableHtml(s) {
  const rows = s.modules
    .map((m) => {
      const label = m.scored
        ? `${m.correct} / ${m.total}`
        : m.done >= m.total ? "geübt" : m.done ? `${m.done} / ${m.total}` : "—";
      const state = m.done === 0 ? "" : m.done >= m.total ? " is-done" : " is-part";
      return `<tr>
        <td class="fs-td-mod"><span class="fs-modmark${state}">${m.done >= m.total && m.total ? "✓" : "–"}</span>
          <span><b>${esc(m.label)}</b><i>${m.scored ? `${m.total} Aufgaben` : "wird von Hand bewertet"}</i></span></td>
        <td class="fs-td-bar">${bar(m.done, m.total)}</td>
        <td class="fs-td-pts">${esc(label)}</td>
        <td class="fs-td-go"><a href="${esc(s.exam.href)}#${esc(m.key)}">${m.done ? "Weiter" : "Starten"} →</a></td>
      </tr>`;
    })
    .join("");

  // The wrapper is load-bearing: a collapsed-border table will not shrink below its
  // own min-content, which on a 320px screen is ~26px wider than the column it sits in.
  // Inside a scroller that stops being the page's problem.
  return `
    <div class="fs-tablewrap">
      <table class="fs-table">
        <thead><tr><th>Teil</th><th>Fortschritt</th><th>Punkte</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function cardsHtml(s) {
  return `<div class="fs-cards">${s.modules
    .map((m) => {
      const state = m.done === 0 ? "" : m.done >= m.total ? " is-done" : " is-part";
      return `<a class="fs-card${state}" href="${esc(s.exam.href)}#${esc(m.key)}">
        <p class="fs-card-label">${esc(m.label)}</p>
        <p class="fs-card-n">${
          m.scored ? `${m.correct} <small>/ ${m.total}</small>`
          : m.done >= m.total ? "geübt"
          : m.done ? `${m.done} <small>/ ${m.total}</small>` : "offen"
        }</p>
        ${bar(m.done, m.total)}
        <span class="fs-card-go">${m.done ? "Weiter" : "Starten"} →</span>
      </a>`;
    })
    .join("")}</div>`;
}

/* ----------------------------------------------------------------- mount -- */

export function mountExamDashboard(root) {
  if (!root) return;
  const railEl = root.querySelector("[data-fs-rail]");
  const mainEl = root.querySelector("[data-fs-main]");
  if (!railEl || !mainEl) return;

  let view = "liste";
  let activeId = examRegistry[0].id;
  try {
    const saved = localStorage.getItem(LAST_KEY);
    if (saved && examById(saved)) activeId = saved;
  } catch {}
  // A ?pruefung= in the URL wins over the remembered one, so a link can point at a
  // particular exam's progress.
  const wanted = new URLSearchParams(location.search).get("pruefung");
  if (wanted && examById(wanted)) activeId = wanted;

  function paint() {
    const stats = allExamStats();
    const s = stats.find((x) => x.exam.id === activeId) ?? stats[0];

    railEl.innerHTML = railHtml(stats, activeId);
    mainEl.innerHTML = `
      <div class="fs-viewtabs" role="tablist">
        <button type="button" class="fs-viewtab${view === "karten" ? " is-on" : ""}" data-view="karten" role="tab" aria-selected="${view === "karten"}">Karten</button>
        <button type="button" class="fs-viewtab${view === "liste" ? " is-on" : ""}" data-view="liste" role="tab" aria-selected="${view === "liste"}">Liste</button>
      </div>
      ${headHtml(s)}
      ${view === "liste" ? tableHtml(s) : cardsHtml(s)}`;

    for (const b of railEl.querySelectorAll("[data-exam]")) {
      b.addEventListener("click", () => {
        activeId = b.dataset.exam;
        try {
          localStorage.setItem(LAST_KEY, activeId);
        } catch {}
        // Keep the URL in step so a reload and a share both land here.
        const u = new URL(location.href);
        u.searchParams.set("pruefung", activeId);
        history.replaceState(null, "", u);
        paint();
      });
    }
    for (const b of mainEl.querySelectorAll("[data-view]")) {
      b.addEventListener("click", () => {
        view = b.dataset.view;
        paint();
      });
    }
    railEl.querySelector("[data-reset-exam]")?.addEventListener("click", (e) => {
      const ex = examById(e.currentTarget.dataset.resetExam);
      if (!ex) return;
      // No confirm(): a modal dialog on a phone blocks the page, and a second
      // sitting rebuilds everything this throws away.
      try {
        localStorage.removeItem((ex.store.kind === "dtz" ? "da-dtz-v1:" : "da-exam-v1:") + ex.store.key);
      } catch {}
      paint();
    });
  }

  paint();
  // Another tab finishing a part should show up here without a reload.
  window.addEventListener("storage", paint);
  return { paint };
}

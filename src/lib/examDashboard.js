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
import { slide, replay } from "./fold.js";
import { getLang, loadDict, translate, onLangChange } from "./i18n.js";

/* The markup here is built by module-level helpers (railHtml, headHtml, tableHtml,
   cardsHtml), not by a closure inside the mount, so the dictionary has to live at module
   level too. mountExamDashboard() fills it and repaints; until then t() returns the key,
   which only the very first frame can see. Exam titles are names and stay as they are.
   Part labels ("Hören · Teil 1", "Bundesweit") and subtitles are chrome: locLabel() and
   locSub() translate the shapes registry.js uses and leave anything else as authored. */
let dict = {};
const t = (key, vars) => translate(dict, key, vars);
const tOr = (key, fallback, vars) => (dict[key] != null ? translate(dict, key, vars) : fallback);

const SKILL_KEY = { "Hören": "skill.hoeren", "Lesen": "skill.lesen", "Schreiben": "skill.schreiben" };
const PLAIN_LABEL_KEY = { "Schreiben": "skill.schreiben", "Bundesweit": "lid.sec.federal", "Mein Bundesland": "lid.sec.state" };
const SUB_KEY = { "Leseverstehen · Schreiben": "tdf.sub", "Einbürgerungstest": "lid.sub", "Übungssatz 1": "exam.h1.set1" };
export function locLabel(label) {
  const m = /^(Hören|Lesen|Schreiben) · (Teil|Aufgabe) ([0-9]+)$/.exec(label || "");
  if (m) {
    const part = m[2] === "Teil" ? tOr("exam.eb.part", `Teil ${m[3]}`, { n: m[3] }) : tOr("exam.qLabel.task", `Aufgabe ${m[3]}`, { n: m[3] });
    return `${tOr(SKILL_KEY[m[1]], m[1])} · ${part}`;
  }
  return PLAIN_LABEL_KEY[label] ? tOr(PLAIN_LABEL_KEY[label], label) : label;
}
const locSub = (s) => (SUB_KEY[s] ? tOr(SUB_KEY[s], s) : s);

/* An arrow carries its direction in its shape, so CSS mirroring cannot fix it: in Arabic
   a "carry on" arrow has to become ←. Read the live dir rather than the language code —
   dir is what the layout flipped on, and Layout.astro sets it before the first paint. */
const forward = () => (document.documentElement.dir === "rtl" ? "←" : "→");

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
    return { key: mod.key, label: locLabel(mod.label), scored: false, total: 1, done: manual ? 1 : 0, correct: 0 };
  }
  const done = ids.filter((id) => state.answers[id] != null).length;
  const correct = ids.filter((id) => state.answers[id]?.correct).length;
  return { key: mod.key, label: locLabel(mod.label), scored: mod.scored !== false, total: ids.length, done, correct };
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

/* Module labels read "Hören · Teil 1": the bit before the dot is the skill, and the
 * consecutive parts that share one belong together. A label without a dot ("Schreiben",
 * "Bundesweit") is a group of one and stays a plain row — a fold that hides a single
 * item only costs a click. */
export function groupModules(modules) {
  const groups = [];
  for (const m of modules) {
    const dotAt = m.label.indexOf("·");
    const name = dotAt > 0 ? m.label.slice(0, dotAt).trim() : null;
    const short = dotAt > 0 ? m.label.slice(dotAt + 1).trim() : m.label;
    const item = { ...m, short };
    const last = groups[groups.length - 1];
    if (name && last && !last.single && last.name === name) last.items.push(item);
    else groups.push({ name: name ?? short, single: !name, items: [item] });
  }
  return groups.map((g) => ({
    ...g,
    done: g.items.reduce((n, m) => n + m.done, 0),
    total: g.items.reduce((n, m) => n + m.total, 0),
  }));
}

/** Which group the rail opens on by itself: the one holding the next unfinished part,
 *  so the head names where you would carry on rather than where the list happens to start. */
export function defaultGroup(groups, next) {
  const hit = groups.find((g) => !g.single && g.items.some((m) => m.key === next?.key));
  return (hit ?? groups.find((g) => !g.single))?.name ?? null;
}

function partHtml(exam, m, label, cls = "") {
  // An unscored part with two tasks (Start Deutsch 1's Formular + Nachricht) must not
  // read "fertig" when only one is marked — it still gets a fraction.
  const count = m.scored || m.total > 1 ? `${m.done}/${m.total}` : t(m.done ? "fs.done" : "fs.open");
  return `<a class="fs-part${cls}" href="${esc(exam.href)}#${esc(m.key)}" aria-label="${esc(m.label)}">
    ${dot(m)}<span class="fs-part-label">${esc(label)}</span><span class="fs-part-n">${esc(count)}</span>
  </a>`;
}

/** The left rail: the open exam as a fold that names where you are, its parts grouped by
 *  skill underneath, and the other exams below as a switcher. */
function railHtml(stats, activeId, ui) {
  const active = stats.find((s) => s.exam.id === activeId) ?? stats[0];
  const groups = groupModules(active.modules);

  // The head says "Start Deutsch 1 · Hören": the exam, then the skill the rail is
  // pivoted to. With every group folded it falls back to the next open part, so the
  // line never goes blank.
  const where = ui.openGroup ?? active.next?.label ?? "";

  const parts = groups
    .map((g) => {
      if (g.single) return partHtml(active.exam, g.items[0], g.items[0].label, " fs-part--solo");
      const on = g.name === ui.openGroup;
      return `<div class="fs-group${on ? " is-open" : ""}">
        <button type="button" class="fs-group-head" data-group="${esc(g.name)}" aria-expanded="${on}">
          <span class="fs-caret" aria-hidden="true"></span>
          <span class="fs-group-name">${esc(g.name)}</span>
          <span class="fs-group-n">${g.done}/${g.total}</span>
        </button>
        <div class="fs-group-items"${on ? "" : " hidden"}>${g.items
          .map((m) => partHtml(active.exam, m, m.short))
          .join("")}</div>
      </div>`;
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
    <button type="button" class="fs-rail-head" data-rail-toggle aria-expanded="${ui.railOpen}" aria-controls="fs-rail-body">
      <span class="fs-caret" aria-hidden="true"></span>
      <span class="fs-rail-head-txt"><b>${esc(active.exam.title)}</b> <i data-fs-where>${where ? `· ${esc(where)}` : ""}</i></span>
      <span class="fs-rail-head-n">${active.maxPoints ? `${active.points}/${active.maxPoints}` : ""}</span>
    </button>
    <div class="fs-rail-body" id="fs-rail-body"${ui.railOpen ? "" : " hidden"}>
      <nav class="fs-parts" aria-label="${esc(t("fs.partsAria"))}">${parts}</nav>
      <a class="fs-rail-result" href="${esc(active.exam.href)}#ergebnis">
        <span class="fs-rail-flag">■</span><span>${esc(t("fs.result"))}</span>
      </a>
      <button type="button" class="fs-reset" data-reset-exam="${esc(active.exam.id)}">${esc(t("fs.reset"))}</button>
    </div>
    <p class="fs-rail-label">${esc(t("fs.examLabel"))}</p>
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
    ? `<a class="fs-next" href="${esc(s.exam.href)}#${esc(s.next.key)}">${esc(t("fs.continueAt", { label: s.next.label, arrow: forward() }))}</a>`
    : `<a class="fs-next" href="${esc(s.exam.href)}#ergebnis">${esc(t("fs.viewResult", { arrow: forward() }))}</a>`;

  return `
    <div class="fs-head">
      <div class="fs-head-main">
        <p class="fs-eyebrow">${esc(t("fs.eyebrow"))}</p>
        <h2 class="fs-exam-title">${esc(s.exam.title)} <small>${esc(locSub(s.exam.subtitle))}</small></h2>
        <p class="fs-points">${t("fs.points", { points: `<b>${s.points}</b>`, max: s.maxPoints })}</p>
        ${bar(s.answered, s.maxPoints, "fs-bar--wide")}
        <p class="fs-sub">${esc(t("fs.sub", { pct: s.donePct, started: s.started, total: s.moduleCount }))}</p>
        <p class="fs-note">${esc(s.exam.passNote)}</p>
      </div>
      <div class="fs-head-side">
        <div class="fs-ringcard">
          ${ring}
          <div class="fs-ringcard-txt">
            <b>${s.points} / ${s.maxPoints}</b>
            <span>${esc(t("fs.ringSub", { n: s.moduleCount }))}</span>
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
        : m.done >= m.total ? t("fs.practised") : m.done ? `${m.done} / ${m.total}` : "—";
      const state = m.done === 0 ? "" : m.done >= m.total ? " is-done" : " is-part";
      return `<tr>
        <td class="fs-td-mod"><span class="fs-modmark${state}">${m.done >= m.total && m.total ? "✓" : "–"}</span>
          <span><b>${esc(m.label)}</b><i>${esc(m.scored ? t("fs.tasks", { n: m.total }) : t("fs.handMarked"))}</i></span></td>
        <td class="fs-td-bar">${bar(m.done, m.total)}</td>
        <td class="fs-td-pts">${esc(label)}</td>
        <td class="fs-td-go"><a href="${esc(s.exam.href)}#${esc(m.key)}">${esc(t(m.done ? "fs.continue" : "fs.start"))} ${forward()}</a></td>
      </tr>`;
    })
    .join("");

  // The wrapper is load-bearing: a collapsed-border table will not shrink below its
  // own min-content, which on a 320px screen is ~26px wider than the column it sits in.
  // Inside a scroller that stops being the page's problem.
  return `
    <div class="fs-tablewrap">
      <table class="fs-table">
        <thead><tr><th>${esc(t("format.th.part"))}</th><th>${esc(t("dash.tab.progress"))}</th><th>${esc(t("format.th.points"))}</th><th></th></tr></thead>
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
          : m.done >= m.total ? esc(t("fs.practised"))
          : m.done ? `${m.done} <small>/ ${m.total}</small>` : esc(t("fs.open"))
        }</p>
        ${bar(m.done, m.total)}
        <span class="fs-card-go">${esc(t(m.done ? "fs.continue" : "fs.start"))} ${forward()}</span>
      </a>`;
    })
    .join("")}</div>`;
}

/* ------------------------------------------------------------- animation -- */

/**
 * The pivot itself: close whatever is open, open the one asked for, and move the head's
 * "· Hören" with it — all in place, so the rail animates instead of being rebuilt.
 */
function pivotRail(railEl, openGroup, next) {
  for (const group of railEl.querySelectorAll(".fs-group")) {
    const btn = group.querySelector("[data-group]");
    const items = group.querySelector(".fs-group-items");
    const on = btn.dataset.group === openGroup;
    if (on === (btn.getAttribute("aria-expanded") === "true")) continue;
    btn.setAttribute("aria-expanded", String(on));
    group.classList.toggle("is-open", on);
    slide(items, on);
    if (on) replay(items, "fs-group-items--enter");
  }
  const where = railEl.querySelector("[data-fs-where]");
  if (where) where.textContent = openGroup ? `· ${openGroup}` : next?.label ? `· ${next.label}` : "";
}

/* ----------------------------------------------------------------- mount -- */

export function mountExamDashboard(root) {
  if (!root) return;
  const railEl = root.querySelector("[data-fs-rail]");
  const mainEl = root.querySelector("[data-fs-main]");
  if (!railEl || !mainEl) return;

  let view = "liste";
  let activeId = examRegistry[0].id;
  // The rail is a fold, not a list: railOpen hides the whole part tree, openGroup is the
  // one skill showing inside it. undefined means "nobody has chosen yet" and lets paint()
  // pick the group holding the next open part; null means the learner closed them all.
  let railOpen = true;
  let openGroup = undefined;
  try {
    const saved = localStorage.getItem(LAST_KEY);
    if (saved && examById(saved)) activeId = saved;
  } catch {}
  // A ?pruefung= in the URL wins over the remembered one, so a link can point at a
  // particular exam's progress.
  const wanted = new URLSearchParams(location.search).get("pruefung");
  if (wanted && examById(wanted)) activeId = wanted;

  // Set by the exam switcher: the next paint is a replacement, not a first render.
  let swap = false;
  // Which way the main panel should come in. Switching from Start Deutsch 1 down to DTZ
  // and switching back up are different moves, and animating both the same way loses the
  // only cue that says which. Same convention as the topic swap in LearnShell: down the
  // list enters from the right, up from the left.
  let swapDir = "fwd";
  const orderOf = (id) => examRegistry.findIndex((e) => e.id === id);

  function paint(focusSel) {
    const stats = allExamStats();
    const s = stats.find((x) => x.exam.id === activeId) ?? stats[0];

    // Switching exams, or a group that this exam does not have, falls back to the
    // default — every exam opens on its own next part.
    const groups = groupModules(s.modules);
    if (openGroup === undefined || (openGroup !== null && !groups.some((g) => !g.single && g.name === openGroup))) {
      openGroup = defaultGroup(groups, s.next);
    }

    railEl.innerHTML = railHtml(stats, activeId, { railOpen, openGroup });
    mainEl.innerHTML = `
      <div class="fs-viewtabs" role="tablist">
        <button type="button" class="fs-viewtab${view === "karten" ? " is-on" : ""}" data-view="karten" role="tab" aria-selected="${view === "karten"}">${esc(t("fs.viewCards"))}</button>
        <button type="button" class="fs-viewtab${view === "liste" ? " is-on" : ""}" data-view="liste" role="tab" aria-selected="${view === "liste"}">${esc(t("fs.viewList"))}</button>
      </div>
      ${headHtml(s)}
      ${view === "liste" ? tableHtml(s) : cardsHtml(s)}`;

    if (swap) {
      // Rail and main together: the part tree on the left and the panel on the right are
      // two views of the same change, and staggering them made the switch feel like two
      // separate events.
      mainEl.dataset.fsDir = swapDir;
      replay(railEl.querySelector(".fs-parts"), "fs-parts--enter");
      replay(mainEl, "fs-main--enter");
      swap = false;
    } else {
      // Every other paint rewrites mainEl.innerHTML too — a Karten/Liste switch, a
      // language change, another tab finishing a part. Left on, the class would make all
      // of those replay the 250ms exam-switch stagger, which turns a tab click into a
      // wait. Only an exam switch is a switch.
      mainEl.classList.remove("fs-main--enter");
    }

    for (const b of railEl.querySelectorAll("[data-exam]")) {
      b.addEventListener("click", () => {
        if (b.dataset.exam === activeId) return;
        swapDir = orderOf(b.dataset.exam) < orderOf(activeId) ? "back" : "fwd";
        activeId = b.dataset.exam;
        openGroup = undefined;
        swap = true;
        try {
          localStorage.setItem(LAST_KEY, activeId);
        } catch {}
        // Keep the URL in step so a reload and a share both land here.
        const u = new URL(location.href);
        u.searchParams.set("pruefung", activeId);
        history.replaceState(null, "", u);
        paint(`[data-exam="${CSS.escape(activeId)}"]`);
      });
    }
    for (const b of mainEl.querySelectorAll("[data-view]")) {
      b.addEventListener("click", () => {
        view = b.dataset.view;
        paint();
      });
    }
    // Neither fold repaints: they animate the rail that is already on screen, which is
    // what makes the pivot read as one list replacing another — and it keeps the focus
    // and the scroll position where the learner left them.
    const headBtn = railEl.querySelector("[data-rail-toggle]");
    headBtn?.addEventListener("click", () => {
      railOpen = !railOpen;
      headBtn.setAttribute("aria-expanded", String(railOpen));
      slide(railEl.querySelector(".fs-rail-body"), railOpen);
    });
    for (const b of railEl.querySelectorAll("[data-group]")) {
      b.addEventListener("click", () => {
        const name = b.dataset.group;
        openGroup = openGroup === name ? null : name;
        pivotRail(railEl, openGroup, s.next);
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

    if (focusSel) railEl.querySelector(focusSel)?.focus();
  }

  paint();
  // The first paint runs before the dictionary has arrived, so it is repainted as soon as
  // it does — and again on every later switch. This view is built with innerHTML after
  // i18n's applyToDom() pass, so nothing in it can be reached by data-i18n.
  loadDict(getLang()).then((d) => { dict = d; paint(); });
  onLangChange((code, d) => { dict = d; paint(); });
  // Another tab finishing a part should show up here without a reload.
  // Wrapped: paint() now takes a focus selector, and an Event is not one.
  window.addEventListener("storage", () => paint());
  return { paint };
}

/* The exam-app shell: one sitting, split into sections, with progress that survives a
 * reload.
 *
 * Ported from the Pflegeplace project's exam trainers (src/lib/kenntnispruefung/render.ts
 * and friends), which all share this chrome: a left rail listing the parts with a
 * per-part progress dot, a thin progress bar across the top, a section pane that swaps
 * rather than scrolls, and a result section that is itself one of the parts. Below 860px
 * the rail is replaced by a single select — the same trade Pflegeplace makes, and the
 * one that matters here, since most learners are on a phone.
 *
 * A page supplies its own sections; everything about scoring, persistence and navigation
 * lives here. See src/pages/pruefungen/leben-in-deutschland/test.astro for a caller.
 *
 * Section: {
 *   key, label,
 *   ids,                         // array | () => array | null  (null = no scored items)
 *   render(main, ctx),           // paint the section into `main`
 * }
 * ctx: { state, record(id, given, correct), idsOf(key), goTo(key), refresh(), allIds() }
 */
import { loadExamState, saveExamState, freshExamState } from "./exam/state.js";
import { countAnswered, countCorrect, percent } from "./exam/scoring.js";
import { el } from "./exam/renderHelpers.js";

const calm = matchMedia("(prefers-reduced-motion: reduce)");

export function mountExamApp(root, { examId, sections, onAnswer, unit = "Fragen" }) {
  if (!root) return null;
  const topFill = root.querySelector("[data-exam-topfill]");
  const topCount = root.querySelector("[data-exam-topcount]");
  const sidebarEl = root.querySelector("[data-exam-sidebar]");
  const mobileNavEl = root.querySelector("[data-exam-mobile-nav]");
  const mainEl = root.querySelector("[data-exam-main]");
  if (!mainEl || !sidebarEl) return null;

  let state = loadExamState(examId);
  const hash = location.hash.slice(1);
  let currentKey = sections.some((s) => s.key === hash) ? hash : sections[0].key;

  const idsOfSection = (s) => (typeof s.ids === "function" ? s.ids() : s.ids) ?? [];
  const allIds = () => sections.flatMap(idsOfSection);

  function save() {
    saveExamState(examId, state);
  }

  const ctx = {
    get state() {
      return state;
    },
    allIds,
    idsOf: (key) => idsOfSection(sections.find((s) => s.key === key) ?? {}),
    record(id, given, correct) {
      state.answers[id] = { given, correct };
      save();
      paintSidebar();
      paintTopbar();
      onAnswer?.(correct, id);
    },
    goTo,
    refresh() {
      paintSidebar();
      paintTopbar();
      paintMain();
    },
  };

  /* ---------------------------------------------------------------- chrome -- */
  function navButton(section) {
    const ids = idsOfSection(section);
    const btn = el("button", "navitem" + (section.key === currentKey ? " active" : ""));
    btn.type = "button";
    let dot = '<span class="navdot"></span>';
    let frac = "";
    if (ids.length) {
      const done = countAnswered(ids, state);
      const cls = done === 0 ? "" : done === ids.length ? "done" : "partial";
      dot = '<span class="navdot ' + cls + '" style="--pct:' + percent(done, ids.length) + '%"></span>';
      frac = '<span class="navfrac">' + done + "/" + ids.length + "</span>";
    }
    btn.innerHTML = dot + "<span>" + section.label + "</span>" + frac;
    btn.addEventListener("click", () => goTo(section.key));
    return btn;
  }

  function paintSidebar() {
    sidebarEl.innerHTML = "";
    for (const s of sections) sidebarEl.appendChild(navButton(s));

    const reset = el("button", "reset-link", "Fortschritt zurücksetzen");
    reset.type = "button";
    reset.addEventListener("click", () => {
      // No confirm() — a browser dialog on a phone is a modal that blocks the page,
      // and there is nothing here that a second sitting cannot rebuild.
      state = freshExamState();
      save();
      ctx.refresh();
    });
    sidebarEl.appendChild(el("div", "sidebar-foot")).appendChild(reset);

    paintMobileNav();
  }

  function paintMobileNav() {
    if (!mobileNavEl) return;
    mobileNavEl.innerHTML = "";
    const select = el("select", "mobile-nav-select");
    select.setAttribute("aria-label", "Zu einem Prüfungsteil springen");
    for (const s of sections) {
      const ids = idsOfSection(s);
      const opt = document.createElement("option");
      opt.value = s.key;
      opt.textContent = ids.length ? `${s.label} (${countAnswered(ids, state)}/${ids.length})` : s.label;
      opt.selected = s.key === currentKey;
      select.appendChild(opt);
    }
    select.addEventListener("change", () => goTo(select.value));
    mobileNavEl.appendChild(select);
  }

  function paintTopbar() {
    const ids = allIds();
    const done = countAnswered(ids, state);
    if (topFill) topFill.style.width = percent(done, ids.length) + "%";
    if (topCount) topCount.textContent = `${done} / ${ids.length} ${unit}`;
  }

  function paintMain() {
    const section = sections.find((s) => s.key === currentKey) ?? sections[0];
    mainEl.innerHTML = "";
    section.render(mainEl, ctx);
  }

  function goTo(key) {
    currentKey = key;
    history.replaceState(null, "", "#" + key);
    paintSidebar();
    if (calm.matches) {
      paintMain();
      mainEl.scrollIntoView({ block: "start" });
      return;
    }
    mainEl.classList.add("is-swapping");
    setTimeout(() => {
      paintMain();
      // Scroll the pane, not the window: on a phone the rail is a select above it, and
      // landing mid-section is the one thing that makes a swap feel like a page load.
      mainEl.scrollIntoView({ block: "start", behavior: "smooth" });
      requestAnimationFrame(() => mainEl.classList.remove("is-swapping"));
    }, 90);
  }

  ctx.refresh();
  return ctx;
}

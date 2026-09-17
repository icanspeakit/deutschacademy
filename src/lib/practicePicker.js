/* Wiring for the ask-first picker (src/components/PracticePicker.astro).
 *
 * Two jobs. First: the trip between the question and its answer. B is the only shape where
 * the answer lives on a second screen, which makes that trip part of the design rather than
 * a detail — if the list just appeared, the learner would have to work out what happened to
 * the card they touched. So the icon and the name travel: the card becomes the header, and
 * nothing else is on screen to argue with. Ported from the /pivot study.
 *
 * Second: the "Weitermachen" card, which only exists for someone who has practised here
 * before. Everything in it is read back from this browser's own record (src/lib/progress.js);
 * a first visit renders no card at all.
 */
import { getResume } from "./progress.js";
import { getLang, loadDict, translate, onLangChange } from "./i18n.js";

const calm = matchMedia("(prefers-reduced-motion: reduce)");
const EASE = "cubic-bezier(.22, 1, .36, 1)";
const OUT = 170; // clearing the old screen
const MORPH = 320; // the shared icon + title travelling

const play = (el, frames, opts) => el?.animate(frames, { easing: EASE, fill: "both", ...opts });
const rect = (el) => el.getBoundingClientRect();

function esc(s) {
  const d = document.createElement("div");
  d.textContent = s == null ? "" : String(s);
  return d.innerHTML;
}

/* Standard FLIP: the element is already where it belongs, so it is drawn back at its old
   position for one frame and then allowed to travel there. `scale` is for the name, which
   changes size between the two screens; the icon is the same 46px on both. */
function flip(el, first, { scale = false } = {}) {
  const last = rect(el);
  if (!last.width) return;
  const s = scale && last.height ? first.height / last.height : 1;
  const dx = first.left - last.left;
  const dy = first.top + first.height / 2 - (last.top + last.height / 2);
  if (!dx && !dy && s === 1) return;
  play(el, [
    { transform: `translate(${dx}px, ${dy}px) scale(${s})`, transformOrigin: "left center" },
    { transform: "none", transformOrigin: "left center" },
  ], { duration: MORPH });
}

function todayStr(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function relativeDate(dateStr, t) {
  if (!dateStr) return t("dash.date.never");
  const days = Math.round((new Date(todayStr()) - new Date(dateStr)) / 86400000);
  if (days <= 0) return t("dash.date.today");
  if (days === 1) return t("dash.date.yesterday");
  if (days < 60) return t("dash.date.daysAgo", { n: days });
  return t("dash.date.longAgo");
}

/* The bar is the weekly goal, and the line underneath says so. It is deliberately not "how
   much of this topic is done": nothing recorded per answer knows how long a topic is, and a
   bar that implied it would be the one dishonest pixel on the page. */
function resumeMarkup(r, t, { recents: withRecents = true } = {}) {
  const pct = r.week.goal > 0 ? Math.min(100, Math.round((r.week.count / r.week.goal) * 100)) : 0;
  const recents = withRecents && r.recents.length
    ? `<div class="pp-recents">
         <p class="pp-recents-label">${esc(t("picker.resume.recents"))}</p>
         <div class="pp-list">
           ${r.recents.map((x) => `
             <a class="pp-row" href="${esc(x.path)}">
               <span class="pp-row-t">${esc(x.title)}</span>
               <span class="pp-count">${esc(relativeDate(x.at, t))}</span>
             </a>`).join("")}
         </div>
       </div>`
    : "";
  const when = relativeDate(r.last.at, t).toLowerCase();
  return `
    <a class="pp-resume" href="${esc(r.last.path)}">
      <span class="pp-resume-eyebrow">${esc(t("picker.resume.eyebrow"))}</span>
      <span class="pp-resume-title">${esc(r.last.title)}</span>
      <span class="pp-bar"><i style="width:${pct}%"></i></span>
      <span class="pp-resume-meta">${esc(t("picker.resume.meta", { n: r.week.count, goal: r.week.goal, when }))}</span>
      <span class="pp-btn">${esc(t("picker.resume.cta"))}</span>
    </a>${recents}`;
}

/* The same card, on its own. The homepage shows it above the fold for someone who has
   practised before — "Wo stehst du?" is a question a returning learner has already
   answered — and there it carries no recents list, because it is one line of a long page. */
export function mountResumeCard(slot, { remote = null, recents = true } = {}) {
  if (!slot) return;
  async function paint() {
    const r = getResume({ remote });
    if (!r) {
      slot.hidden = true;
      slot.innerHTML = "";
      return;
    }
    const dict = await loadDict(getLang());
    slot.innerHTML = resumeMarkup(r, (key, vars) => translate(dict, key, vars), { recents });
    slot.hidden = false;
  }
  paint();
  onLangChange(paint);
}

export function mountPracticePicker(root, { resume = true, remote = null } = {}) {
  if (!root) return;
  const home = root.querySelector("[data-pp-home]");
  const detail = root.querySelector("[data-pp-detail]");
  const back = root.querySelector("[data-pp-back]");
  const titleEl = root.querySelector("[data-pp-title]");
  const iconEl = root.querySelector("[data-pp-icon]");
  const foot = root.querySelector(".pp-foot");
  const panels = [...root.querySelectorAll("[data-panel]")];
  const choices = [...root.querySelectorAll("[data-group]")];
  let busy = false;
  let openId = null;

  const swap = (toDetail) => {
    home.hidden = toDetail;
    detail.hidden = !toDetail;
    if (foot) foot.hidden = toDetail;
    root.dataset.view = toDetail ? "detail" : "home";
    // Opening the answer must not leave the learner looking at the middle of it.
    if (rect(root).top < 0) root.scrollIntoView({ block: "start", behavior: calm.matches ? "auto" : "smooth" });
  };

  function fill(btn) {
    const id = btn.dataset.group;
    openId = id;
    for (const p of panels) p.hidden = p.dataset.panel !== id;
    titleEl.textContent = btn.querySelector(".pp-choice-txt b")?.textContent ?? btn.textContent.trim();
    const srcIcon = btn.querySelector(".pp-ic");
    iconEl.innerHTML = srcIcon ? srcIcon.innerHTML : "";
    iconEl.hidden = !srcIcon;
  }

  function open(btn) {
    if (busy) return;
    fill(btn);
    if (calm.matches) { swap(true); return; }
    busy = true;

    const srcIcon = btn.querySelector(".pp-ic");
    const srcTitle = btn.querySelector(".pp-choice-txt b");
    const first = srcIcon && srcTitle && { icon: rect(srcIcon), title: rect(srcTitle) };

    // Everything the learner did not tap leaves first, nearest last, so the screen empties
    // towards the card that is about to become the header.
    const siblings = [...home.children];
    const anchor = siblings.indexOf(btn);
    for (const n of siblings.filter((x) => x !== btn)) {
      const distance = Math.abs(siblings.indexOf(n) - anchor);
      play(n, [
        { opacity: 1, transform: "none" },
        { opacity: 0, transform: "translateY(8px) scale(.98)" },
      ], { duration: OUT, delay: (distance - 1) * 22 });
    }
    // The tapped card sheds everything the header will not carry, then dissolves.
    play(btn.querySelector(".pp-choice-txt i"), [{ opacity: 1 }, { opacity: 0 }], { duration: 120 });
    play(btn.querySelector(".pp-choice-n"), [{ opacity: 1 }, { opacity: 0 }], { duration: 120 });
    play(btn, [
      { backgroundColor: "var(--surface-card)", borderColor: "var(--border)" },
      { backgroundColor: "rgba(0,0,0,0)", borderColor: "rgba(0,0,0,0)" },
    ], { duration: OUT });

    setTimeout(() => {
      swap(true);
      if (first) {
        flip(iconEl, first.icon);
        flip(titleEl, first.title, { scale: true });
      }
      play(back, [
        { opacity: 0, transform: "scale(.7)" },
        { opacity: 1, transform: "none" },
      ], { duration: 220, delay: 90 });
      const list = panels.find((p) => !p.hidden);
      play(list, [
        { opacity: 0, transform: "translateY(10px)" },
        { opacity: 1, transform: "none" },
      ], { duration: 240 });
      [...(list?.querySelectorAll(".pp-row") ?? [])].forEach((r, i) =>
        play(r, [
          { opacity: 0, transform: "translateY(14px)" },
          { opacity: 1, transform: "none" },
        ], { duration: 280, delay: 70 + i * 45 })
      );
      setTimeout(() => {
        busy = false;
        // Clear the fills so a second visit animates from a clean slate.
        for (const el of [...siblings, ...btn.querySelectorAll("*")]) el.getAnimations().forEach((a) => a.cancel());
      }, MORPH + 200);
    }, OUT - 20);
  }

  function close() {
    if (busy) return;
    const btn = choices.find((c) => c.dataset.group === openId);
    if (calm.matches) { swap(false); openId = null; return; }
    busy = true;

    const first = { icon: rect(iconEl), title: rect(titleEl) };
    const rows = [...(panels.find((p) => !p.hidden)?.querySelectorAll(".pp-row") ?? [])];
    rows.forEach((r, i) =>
      play(r, [
        { opacity: 1, transform: "none" },
        { opacity: 0, transform: "translateY(10px)" },
      ], { duration: 130, delay: (rows.length - 1 - i) * 20 })
    );
    play(back, [{ opacity: 1 }, { opacity: 0 }], { duration: 120 });

    setTimeout(() => {
      swap(false);
      openId = null;
      if (btn) {
        flip(btn.querySelector(".pp-ic"), first.icon);
        flip(btn.querySelector(".pp-choice-txt b"), first.title, { scale: true });
        play(btn, [
          { backgroundColor: "rgba(0,0,0,0)", borderColor: "rgba(0,0,0,0)" },
          { backgroundColor: "var(--surface-card)", borderColor: "var(--border)" },
        ], { duration: 240, delay: 60 });
        play(btn.querySelector(".pp-choice-txt i"), [{ opacity: 0 }, { opacity: 1 }], { duration: 200, delay: 140 });
        play(btn.querySelector(".pp-choice-n"), [{ opacity: 0 }, { opacity: 1 }], { duration: 200, delay: 140 });
      }
      const siblings = [...home.children];
      const anchor = btn ? siblings.indexOf(btn) : -1;
      for (const n of siblings.filter((c) => c !== btn)) {
        const distance = Math.abs(siblings.indexOf(n) - anchor);
        play(n, [
          { opacity: 0, transform: "translateY(8px) scale(.98)" },
          { opacity: 1, transform: "none" },
        ], { duration: 240, delay: 80 + distance * 22 });
      }
      setTimeout(() => { busy = false; }, MORPH + 200);
    }, 190);
  }

  for (const btn of choices) btn.addEventListener("click", () => open(btn));
  back?.addEventListener("click", close);
  root.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && root.dataset.view === "detail") close();
  });

  /* --- Weitermachen ---------------------------------------------------------- */
  if (resume) mountResumeCard(root.querySelector("[data-pp-resume]"), { remote });
}

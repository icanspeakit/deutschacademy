// FROZEN COPY of wegPanel.js as of 539b20c, used only by LearnShellOld.astro (/olduxdashboard).
// "Dein Weg" — the left pane of /fortschritt, as a record rather than a menu.
//
// It used to list the five course modules, which was the Stufenübersicht again, two
// centimetres to the left of the Stufenübersicht. A learner opening this pane is not
// choosing what to do; they are asking how they are doing. So it answers the four
// questions they actually have, in the order they have them:
//
//   1. What do I do next?        the resume button — the only thing here you can click
//   2. Am I keeping it up?       the week, seven dots, and the streak
//   3. Where am I strong/weak?   the four levels, as bars
//   4. Am I any good at it?      accuracy per skill, and what was said out loud
//
// Everything is derived from the same localStorage the trainers write (progress.js). The
// server renders an empty skeleton, so nothing here can leak one browser's numbers into
// another's HTML, and a learner with JavaScript off sees no wrong figures — just none.
import { getProgress, getDrillProgress } from "./progress.js";

const SKILL_LABEL = {
  grammatik: "Grammatik",
  wortschatz: "Wortschatz",
  hoeren: "Hören",
  lesen: "Lesen",
  schreiben: "Schreiben",
  sprechen: "Sprechen",
  aussprache: "Aussprache",
  artikel: "Artikel",
};

const DAY = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

const iso = (d) => {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/**
 * The last seven days, ending today — not Monday to Sunday.
 *
 * A calendar week was the obvious first choice and the wrong one: on a Monday morning it
 * shows six empty squares to a learner who practised every day of the week before, which
 * reads as "you have done nothing" at exactly the moment the habit is most fragile. A
 * rolling window always has the same amount of evidence in it, so the shape of the row
 * means the same thing on a Monday as on a Friday.
 */
function lastSevenDays(today = new Date()) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    // getDay() is 0 for Sunday; shift it so Monday is index 0 in DAY.
    return { key: iso(d), label: DAY[(d.getDay() + 6) % 7], today: iso(d) === iso(today) };
  });
}

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const pct = (done, total) => (total ? Math.round((done / total) * 100) : 0);

/**
 * Paints the pane. Called once on mount and again from LearnShell's repaint(), so the
 * numbers move while the learner answers questions on the same page.
 *
 * `levels` comes from the caller because only LearnShell knows how a level's topics add
 * up — this module would have to re-derive the whole catalogue to compute it, and the two
 * copies would disagree the first time a topic moved.
 * `resume` is the portion the course is currently on, already labelled.
 */
export function paintWegPanel(root, { levels = [], resume = null } = {}) {
  if (!root) return;
  const $ = (sel) => root.querySelector(sel);

  let data;
  let drills;
  try {
    data = getProgress();
    drills = getDrillProgress();
  } catch (e) {
    return; // no storage, no record — the skeleton stays empty rather than lying
  }

  const skills = Object.entries(data.skills || {}).filter(([, s]) => (s.attempts || 0) > 0);
  const attempts = skills.reduce((n, [, s]) => n + (s.attempts || 0), 0);
  const correct = skills.reduce((n, [, s]) => n + (s.correct || 0), 0);
  const said = Object.values(drills || {}).reduce((n, d) => n + (d.said || 0), 0);
  const sure = Object.values(drills || {}).reduce((n, d) => n + (d.sure || 0), 0);

  // Nothing at all: one honest sentence beats six zeroed widgets.
  const blank = attempts === 0 && said === 0;
  const show = (el, on) => { if (el) el.hidden = !on; };
  show($("[data-weg-empty]"), blank);
  show($("[data-weg-week]"), !blank);
  show($("[data-weg-resume]"), !!resume);

  /* --------------------------------------------------------------- resume -- */

  if (resume) {
    const label = $("[data-weg-resume-label]");
    const meta = $("[data-weg-resume-meta]");
    if (label) label.textContent = resume.label;
    if (meta) meta.textContent = resume.meta;
  }

  if (blank) {
    const block = root.querySelectorAll(".wg-block");
    block.forEach((b) => (b.hidden = true));
    return;
  }
  root.querySelectorAll(".wg-block").forEach((b) => (b.hidden = false));

  /* ----------------------------------------------------------------- week -- */

  const activity = data.dailyActivity || {};
  const days = lastSevenDays();
  const active = days.filter((d) => (activity[d.key] || 0) > 0).length;

  const daysEl = $("[data-weg-days]");
  if (daysEl) {
    daysEl.innerHTML = days
      .map((d) => {
        const n = activity[d.key] || 0;
        const state = n > 0 ? "on" : "off";
        // Four steps of intensity, so a 40-answer day reads differently from a 2-answer
        // one without needing a number on a 28px square.
        const level = n === 0 ? 0 : n < 5 ? 1 : n < 15 ? 2 : n < 40 ? 3 : 4;
        return `<span class="wg-day" data-state="${state}" data-level="${level}"${d.today ? ' data-today="1"' : ""}
          title="${esc(d.label)}: ${n} ${n === 1 ? "Antwort" : "Antworten"}"><i></i>${esc(d.label)}</span>`;
      })
      .join("");
  }

  const streakEl = $("[data-weg-streak]");
  if (streakEl) {
    const s = data.streak || 0;
    streakEl.textContent = s > 0
      ? `${s} ${s === 1 ? "Tag" : "Tage"} in Folge`
      : `${active} von 7 Tagen`;
    streakEl.dataset.hot = s >= 3 ? "1" : "0";
  }

  /* --------------------------------------------------------------- levels -- */

  const levelsEl = $("[data-weg-levels]");
  if (levelsEl) {
    levelsEl.innerHTML = levels
      .map((l) => {
        const p = l.pct ?? pct(l.done, l.tasks);
        const state = p === 100 ? "done" : p > 0 ? "current" : "todo";
        return `<div class="wg-level" data-state="${state}">
          <span class="wg-level-name">${esc(l.label)}</span>
          <span class="wg-level-bar"><i style="width:${p}%"></i></span>
          <span class="wg-level-num">${l.done}<span>/${l.tasks}</span></span>
        </div>`;
      })
      .join("");
  }

  const started = levels.filter((l) => (l.done || 0) > 0);
  const sum = $("[data-weg-levelsum]");
  if (sum) {
    const done = levels.reduce((n, l) => n + (l.done || 0), 0);
    const total = levels.reduce((n, l) => n + (l.tasks || 0), 0);
    sum.textContent = started.length
      ? `${done} von ${total} Aufgaben`
      : "noch keine begonnen";
  }

  /* --------------------------------------------------------------- skills -- */

  show($("[data-weg-skillblock]"), attempts > 0);
  const skillsEl = $("[data-weg-skills]");
  if (skillsEl && attempts > 0) {
    skillsEl.innerHTML = skills
      .sort((a, b) => (b[1].attempts || 0) - (a[1].attempts || 0))
      .map(([id, s]) => {
        const p = pct(s.correct || 0, s.attempts || 0);
        // Under ten answers a percentage is noise, so it is shown as a raw count instead
        // of a figure the learner would read as a verdict.
        const thin = (s.attempts || 0) < 10;
        return `<div class="wg-skill" data-band="${p >= 80 ? "good" : p >= 60 ? "ok" : "low"}"${thin ? ' data-thin="1"' : ""}>
          <span class="wg-skill-name">${esc(SKILL_LABEL[id] || id)}</span>
          <span class="wg-skill-bar"><i style="width:${p}%"></i></span>
          <span class="wg-skill-num">${thin ? `${s.correct || 0}/${s.attempts}` : `${p} %`}</span>
        </div>`;
      })
      .join("");
  }
  const skillSum = $("[data-weg-skillsum]");
  if (skillSum) {
    // "157 von 209 richtig" wraps beside the heading in a 250px column; the slash reads
    // the same and fits on one line.
    skillSum.textContent = attempts ? `${correct}/${attempts} richtig` : "";
  }

  /* ---------------------------------------------------------------- spoken -- */

  // Kept apart from the accuracy block on purpose: these are the learner's own word, not
  // something the site checked, and folding them into "richtig" would inflate a number
  // the rest of this pane presents as measured.
  show($("[data-weg-speakblock]"), said > 0);
  if (said > 0) {
    const s = $("[data-weg-speaksum]");
    const note = $("[data-weg-speaknote]");
    const topics = Object.keys(drills).length;
    if (s) s.textContent = `${said} ${said === 1 ? "Satz" : "Sätze"}`;
    if (note) {
      note.textContent = `${sure} davon saßen sofort — aus ${topics} ${topics === 1 ? "Thema" : "Themen"}. Selbst eingeschätzt, nicht gemessen.`;
    }
  }
}

/**
 * Wires the resume button once. The painting itself is idempotent and happens on every
 * repaint, so only the click handler needs a mount step.
 */
export function mountWegPanel(root, { onResume } = {}) {
  if (!root) return;
  const btn = root.querySelector("[data-weg-resume]");
  if (btn && onResume) btn.addEventListener("click", onResume);
}

/* The guided run (/uebungen/grammatik/lauf).
 *
 * The grammar hub is a wall of 27 cards across four levels. That is the right shape for
 * someone who knows what they are looking for, and the wrong shape for everyone else:
 * choosing a topic is itself a skill, and a learner who cannot place themselves on the
 * CEFR scale cannot place a topic on it either. So the hub now asks once — pick for me,
 * or let me pick — and this is the first answer.
 *
 * The run makes exactly one promise: you never choose anything. It walks the syllabus
 * (src/data/grammatik-lehrplan.json) one exercise at a time, says what the topic is when
 * a new one starts, and the only control is "weiter". Where it stopped is remembered, so
 * closing the tab is a pause rather than a loss.
 *
 * It deliberately does NOT grade you into or out of anything. Nothing here has ever
 * measured a learner's level — the site has no placement test — so a run that claimed to
 * skip ahead "because you are clearly past A1" would be inventing that claim. It starts
 * at the beginning, and moving is the learner's own business: the jump control skips a
 * topic when one is too easy, which is a choice they can actually make.
 */
import { recordAttempt } from "./progress.js";
import { mountGrammarWorkspace } from "./grammarWorkspace.js";

const CURSOR_KEY = "da-grammatik-lauf";

const esc = (s) => {
  const d = document.createElement("div");
  d.textContent = s == null ? "" : String(s);
  return d.innerHTML;
};

/** Every exercise of every topic, flattened — the run's addressable unit is one exercise. */
export function buildStations(topics) {
  const out = [];
  topics.forEach((topic, ti) => {
    (topic.exercises ?? []).forEach((ex, xi) => {
      out.push({
        topicIndex: ti,
        exIndex: xi,
        // The learner meets the topic once, at its first exercise. After that the header
        // keeps naming it, but nothing stops the page again.
        first: xi === 0,
        last: xi === (topic.exercises ?? []).length - 1,
      });
    });
  });
  return out;
}

function loadCursor(max) {
  try {
    const n = parseInt(localStorage.getItem(CURSOR_KEY), 10);
    if (Number.isInteger(n) && n >= 0 && n < max) return n;
  } catch {}
  return 0;
}

function saveCursor(n) {
  try { localStorage.setItem(CURSOR_KEY, String(n)); } catch {}
}

export function mountGrammarRun(root, topics) {
  if (!root || !topics?.length) return;
  const stations = buildStations(topics);
  if (!stations.length) return;

  const $ = (sel) => root.querySelector(sel);
  const bar = $("[data-run-bar]");
  const count = $("[data-run-count]");
  const eyebrow = $("[data-run-eyebrow]");
  const title = $("[data-run-title]");
  const lead = $("[data-run-lead]");
  const intro = $("[data-run-intro]");
  const stage = $("[data-run-stage]");
  const nextBtn = $("[data-run-next]");
  const skipBtn = $("[data-run-skip]");
  const restartBtn = $("[data-run-restart]");
  const doneEl = $("[data-run-done]");
  const calm = matchMedia("(prefers-reduced-motion: reduce)");

  let cursor = loadCursor(stations.length);
  let answered = false;

  const topicOf = (i) => topics[stations[i].topicIndex];

  function paint() {
    const station = stations[cursor];
    const topic = topicOf(cursor);
    const ex = topic.exercises[station.exIndex];
    answered = false;

    // The counter is stations, not percent: "7 von 42" is a place you can hold in your
    // head, and the bar underneath is the same number drawn.
    count.textContent = `Station ${cursor + 1} von ${stations.length}`;
    bar.style.width = `${((cursor + 1) / stations.length) * 100}%`;

    eyebrow.textContent = `${topic.level} · Thema ${station.topicIndex + 1} von ${topics.length}`;
    title.textContent = topic.name;

    // A new topic gets its one sentence; the exercises inside it do not repeat it.
    intro.hidden = !station.first;
    if (station.first) lead.textContent = topic.subtitle ?? "";

    stage.innerHTML = `
      <p class="run-ex-title">${esc(ex.title ?? "")}</p>
      ${ex.hint ? `<p class="run-ex-hint">${esc(ex.hint)}</p>` : ""}
      <div data-ex-index="${station.exIndex}"></div>`;

    // The engine pairs [data-ex-index] slots with data.exercises by index, so handing it
    // the whole topic and rendering one slot mounts exactly that exercise.
    mountGrammarWorkspace(stage, topic, {
      onAnswer: (ok) => {
        recordAttempt({ skill: "grammatik", correct: ok, topic: topic.id });
        // "Weiter" appears once there is something to move on from, rather than sitting
        // there from the start inviting you to skip the exercise you just opened.
        if (!answered) {
          answered = true;
          nextBtn.removeAttribute("data-quiet");
        }
      },
    });

    nextBtn.textContent = cursor === stations.length - 1 ? "Lauf beenden" : "Weiter →";
    nextBtn.setAttribute("data-quiet", "");
    skipBtn.hidden = !!station.last && station.first;
    doneEl.hidden = true;
    root.scrollIntoView({ block: "start", behavior: calm.matches ? "auto" : "smooth" });
  }

  function go(next) {
    if (next >= stations.length) {
      // The end is a real end, not a silent wrap back to station 1.
      doneEl.hidden = false;
      stage.innerHTML = "";
      intro.hidden = true;
      nextBtn.hidden = true;
      skipBtn.hidden = true;
      count.textContent = `${stations.length} von ${stations.length} Stationen`;
      bar.style.width = "100%";
      saveCursor(0);
      return;
    }
    cursor = next;
    saveCursor(cursor);
    nextBtn.hidden = false;
    paint();
  }

  nextBtn.addEventListener("click", () => go(cursor + 1));

  // Skipping a topic, not an exercise: "too easy" is a judgement about the topic, and
  // one exercise at a time would make the learner press it five times to act on it.
  skipBtn.addEventListener("click", () => {
    const ti = stations[cursor].topicIndex;
    let n = cursor;
    while (n < stations.length && stations[n].topicIndex === ti) n++;
    go(n);
  });

  restartBtn?.addEventListener("click", () => {
    saveCursor(0);
    nextBtn.hidden = false;
    go(0);
  });

  paint();
}

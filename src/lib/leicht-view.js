/* /leicht — the screens.
 *
 * One <div> is handed in and every screen is rendered into it, so there is exactly one
 * thing on the phone at a time and no scroll position to lose between steps. Routing is
 * the hash, purely so Android's back button walks the flow backwards the way a learner
 * expects it to.
 *
 * Rules the prototype is testing, and which every screen below obeys:
 *   1. One decision per screen. Three options is the ceiling; a grid is a failure.
 *   2. A sitting, never a pile. No screen states a total — not 3.375 Wörter, not 28 Themen.
 *   3. Progress is a sentence, not a percent: "Du fragst nach dem Weg."
 *   4. The primary action sits in the thumb zone and there is only ever one of it.
 */
import {
  SITTINGS,
  loadState,
  saveState,
  resetState,
  completeSitting,
  capabilities,
  nextSitting,
} from "./leicht-app.js";

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const shuffle = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(([, v]) => v);

export function mountLeicht(root) {
  let state = loadState();
  /** The live sitting: null outside the runner. */
  let run = null;

  /* ------------------------------------------------------------- chrome */

  function shell({ back, title, body, action, center }) {
    root.innerHTML = `
      <header class="lt-bar">
        ${
          back
            ? `<button class="lt-back" type="button" data-go="${back}" aria-label="Zurück">‹</button>`
            : `<span class="lt-back lt-back--ghost" aria-hidden="true"></span>`
        }
        <span class="lt-bar-title">${esc(title)}</span>
        <span class="lt-chip">Prototyp</span>
      </header>
      <main class="lt-body${center ? " lt-body--center" : ""}">${body}</main>
      ${action ? `<footer class="lt-foot">${action}</footer>` : ""}
    `;
    root.querySelectorAll("[data-go]").forEach((el) =>
      el.addEventListener("click", () => {
        location.hash = "#/" + el.dataset.go;
      })
    );
  }

  /* -------------------------------------------------------------- heute

     The home screen is one card. The alternative underneath is a quiet single
     line, not a menu — a learner who wants to be told what to do can take the
     card without reading anything else on the screen.
  */

  function heute() {
    const next = nextSitting(state);
    const cans = capabilities(state);

    shell({
      title: "Heute",
      body: `
        <p class="lt-hello">${state.done.length ? "Weiter geht es." : "Zwei Minuten reichen."}</p>

        <button class="lt-offer" type="button" data-go="uebung/${next.id}">
          <span class="lt-offer-ic" aria-hidden="true">${next.icon}</span>
          <span class="lt-offer-txt">
            <b>${esc(next.title)}</b>
            <i>${next.tasks.length} Aufgaben · ${next.minutes} Minuten · ${next.level}</i>
          </span>
          <span class="lt-offer-go" aria-hidden="true">→</span>
        </button>

        ${
          cans.length
            ? `<button class="lt-shelf-peek" type="button" data-go="kannst">
                 <b>${cans.length} ${cans.length === 1 ? "Sache" : "Sachen"}, die du schon kannst</b>
                 <i>${esc(cans[cans.length - 1].text)}</i>
               </button>`
            : `<p class="lt-note">Nach der ersten Runde steht hier, was du kannst.</p>`
        }

        <button class="lt-quiet" type="button" data-go="waehlen">Ich will etwas anderes</button>
      `,
      center: true,
      action: `<button class="lt-cta" type="button" data-go="uebung/${next.id}">Los — ${next.minutes} Minuten</button>`,
    });
  }

  /* ------------------------------------------------------------- waehlen

     The whole picker: one question, three answers, no levels, no counts. This
     is what replaces a hub of 28 cards behind five level headings.
  */

  function waehlen() {
    shell({
      back: "heute",
      title: "Was jetzt?",
      body: `
        <p class="lt-hello">Wobei willst du sicherer werden?</p>
        <div class="lt-picks">
          ${SITTINGS.map(
            (s) => `
            <button class="lt-pick ${state.done.includes(s.id) ? "is-done" : ""}" type="button" data-go="uebung/${s.id}">
              <span class="lt-pick-ic" aria-hidden="true">${s.icon}</span>
              <span class="lt-pick-txt">
                <b>${esc(s.title)}</b>
                <i>${s.minutes} Minuten${state.done.includes(s.id) ? " · schon gemacht" : ""}</i>
              </span>
            </button>`
          ).join("")}
        </div>
        <p class="lt-note">Mehr gibt es hier mit Absicht nicht. Eine Liste, die man scrollen muss, ist schon eine Liste zu viel.</p>
      `,
    });
  }

  /* ------------------------------------------------------------- uebung */

  function uebung(id) {
    const sitting = SITTINGS.find((s) => s.id === id) || SITTINGS[0];
    if (!run || run.id !== sitting.id) {
      run = { id: sitting.id, i: 0, right: 0, answer: null, flipped: false, built: [], pool: null };
    }
    const task = sitting.tasks[run.i];
    const answered = run.answer !== null;

    const dots = sitting.tasks
      .map((_, n) => `<span class="lt-dot ${n < run.i ? "is-done" : n === run.i ? "is-now" : ""}"></span>`)
      .join("");

    shell({
      back: "heute",
      title: sitting.title,
      body: `
        <div class="lt-dots" role="progressbar" aria-valuemin="0" aria-valuemax="${sitting.tasks.length}" aria-valuenow="${run.i}">${dots}</div>
        <div class="lt-task" data-kind="${task.type}">${taskBody(task)}</div>
        <div class="lt-verdict" aria-live="polite">${answered ? verdict(task) : ""}</div>
      `,
      action: answered
        ? `<button class="lt-cta" type="button" data-next>${run.i + 1 < sitting.tasks.length ? "Weiter" : "Fertig"}</button>`
        : taskAction(task),
    });

    wire(sitting, task);
  }

  function taskBody(task) {
    const open = run.flipped || run.answer !== null;

    if (task.type === "wort") {
      return `
        <p class="lt-kind">Wort</p>
        <button class="lt-card ${open ? "is-open" : ""}" type="button" data-flip>
          <b>${esc(task.front)}</b>
          <span class="lt-card-back">${esc(task.back)}<i>${esc(task.hint || "")}</i></span>
          ${open ? "" : `<span class="lt-card-tap">tippen</span>`}
        </button>
      `;
    }

    const blankState = run.answer ? (run.answer === task.answer ? "is-right" : "is-wrong") : "";

    if (task.type === "artikel") {
      return `
        <p class="lt-kind">Artikel</p>
        <p class="lt-sentence"><span class="lt-blank ${blankState}">${esc(run.answer || "___")}</span> ${esc(task.noun)}</p>
        <p class="lt-gloss">${esc(task.back)}</p>
      `;
    }

    if (task.type === "luecke") {
      return `
        <p class="lt-kind">Satz</p>
        <p class="lt-sentence">${esc(task.before)} <span class="lt-blank ${blankState}">${esc(run.answer || "___")}</span> ${esc(task.after)}</p>
      `;
    }

    // satz — build the line by tapping chips; tapping a placed word takes it back.
    if (!run.pool) run.pool = shuffle(task.chips.slice());
    const placed = run.built.slice();
    const rest = run.pool.filter((w) => {
      const n = placed.indexOf(w);
      if (n === -1) return true;
      placed.splice(n, 1);
      return false;
    });
    return `
      <p class="lt-kind">Bau den Satz</p>
      <div class="lt-line ${run.answer ? (run.answer === "ok" ? "is-right" : "is-wrong") : ""}">
        ${
          run.built.map((w, n) => `<button class="lt-word" type="button" data-un="${n}">${esc(w)}</button>`).join("") ||
          `<span class="lt-line-ph">tippe die Wörter an</span>`
        }
      </div>
      <div class="lt-pool">
        ${rest.map((w) => `<button class="lt-word lt-word--pool" type="button" data-add="${esc(w)}">${esc(w)}</button>`).join("")}
      </div>
    `;
  }

  function taskAction(task) {
    if (task.type === "wort") {
      return run.flipped
        ? `<div class="lt-two">
             <button class="lt-cta lt-cta--ghost" type="button" data-know="0">Nochmal</button>
             <button class="lt-cta" type="button" data-know="1">Kann ich</button>
           </div>`
        : `<button class="lt-cta" type="button" data-flip>Umdrehen</button>`;
    }
    if (task.type === "artikel" || task.type === "luecke") {
      const opts = task.type === "artikel" ? ["der", "die", "das"] : task.options;
      return `<div class="lt-opts">${opts
        .map((o) => `<button class="lt-opt" type="button" data-pick="${esc(o)}">${esc(o)}</button>`)
        .join("")}</div>`;
    }
    return `<button class="lt-cta" type="button" data-check${run.built.length < task.chips.length ? " disabled" : ""}>Prüfen</button>`;
  }

  function verdict(task) {
    const ok = task.type === "wort" ? run.answer === "1" : task.type === "satz" ? run.answer === "ok" : run.answer === task.answer;
    const solution = task.type === "satz" ? task.answer.join(" ") : task.answer;
    const line =
      task.type === "wort"
        ? ok
          ? "Gemerkt."
          : `Kommt wieder — <b>${esc(task.front)}</b> heißt ${esc(task.back)}.`
        : ok
          ? "Richtig."
          : `Fast. Richtig ist <b>${esc(solution)}</b>.`;
    const why = task.why && !ok ? `<i>${esc(task.why)}</i>` : "";
    return `<p class="lt-said ${ok ? "is-right" : "is-wrong"}">${line}${why}</p>`;
  }

  function wire(sitting, task) {
    const on = (sel, fn) => root.querySelectorAll(sel).forEach((el) => el.addEventListener("click", () => fn(el)));
    const again = () => uebung(sitting.id);

    on("[data-flip]", () => {
      run.flipped = true;
      again();
    });
    on("[data-know]", (el) => {
      run.answer = el.dataset.know;
      if (el.dataset.know === "1") run.right++;
      again();
    });
    on("[data-pick]", (el) => {
      run.answer = el.dataset.pick;
      if (run.answer === task.answer) run.right++;
      again();
    });
    on("[data-add]", (el) => {
      run.built.push(el.dataset.add);
      again();
    });
    on("[data-un]", (el) => {
      run.built.splice(Number(el.dataset.un), 1);
      again();
    });
    on("[data-check]", () => {
      const ok = run.built.join(" ") === task.answer.join(" ");
      run.answer = ok ? "ok" : "no";
      if (ok) run.right++;
      again();
    });
    on("[data-next]", () => {
      if (run.i + 1 < sitting.tasks.length) {
        run.i++;
        run.answer = null;
        run.flipped = false;
        run.built = [];
        run.pool = null;
        again();
      } else {
        state = completeSitting(state, sitting.id, run.right, sitting.tasks.length);
        saveState(state);
        location.hash = "#/fertig/" + sitting.id;
      }
    });
  }

  /* ------------------------------------------------------------- fertig

     The payoff screen, and the reason the study exists. It does not lead with
     a score — it leads with the sentence the learner just bought. The count is
     underneath, small, because it is the less interesting fact.
  */

  function fertig(id) {
    const sitting = SITTINGS.find((s) => s.id === id) || SITTINGS[0];
    const right = run ? run.right : sitting.tasks.length;
    const next = nextSitting(state);
    run = null;

    shell({
      title: "Fertig",
      body: `
        <div class="lt-win">
          <span class="lt-win-ic" aria-hidden="true">${sitting.icon}</span>
          <p class="lt-win-lead">Das kannst du jetzt:</p>
          <ul class="lt-claims">
            ${sitting.claims.map((c) => `<li>${esc(c)}</li>`).join("")}
          </ul>
          <p class="lt-win-sub">${right} von ${sitting.tasks.length} richtig · Tag ${state.streak} in Folge</p>
        </div>
        <button class="lt-shelf-peek" type="button" data-go="kannst">
          <b>Alles, was du kannst</b>
          <i>${capabilities(state).length} Sätze auf dem Regal</i>
        </button>
      `,
      center: true,
      action:
        next.id === sitting.id
          ? `<button class="lt-cta" type="button" data-go="heute">Zurück</button>`
          : `<button class="lt-cta" type="button" data-go="uebung/${next.id}">Noch ${next.minutes} Minuten: ${esc(next.title)}</button>`,
    });
  }

  /* ------------------------------------------------------------- kannst

     The dashboard, replaced. No bars, no percentages, no per-skill grid — a
     list of things the learner can do, which is the only progress number they
     can actually feel. What is still to come is listed in the same voice, so
     the catalogue reads as a shelf of abilities rather than a pile of topics.
  */

  function kannst() {
    const cans = capabilities(state);
    const open = SITTINGS.filter((s) => !state.done.includes(s.id));

    shell({
      back: "heute",
      title: "Das kannst du",
      body: `
        ${
          cans.length
            ? `<ul class="lt-claims lt-claims--shelf">${cans
                .map((c) => `<li>${esc(c.text)}<i>${esc(c.from)}</i></li>`)
                .join("")}</ul>`
            : `<p class="lt-note">Noch nichts — eine Runde reicht für den ersten Satz.</p>`
        }
        ${
          open.length
            ? `<p class="lt-hello lt-hello--sm">Als Nächstes zu haben:</p>
               <ul class="lt-claims lt-claims--open">${open.map((s) => `<li>${esc(s.claims[0])}</li>`).join("")}</ul>`
            : `<p class="lt-note">Alles aus diesem Prototyp ist durch.</p>`
        }
        <button class="lt-quiet" type="button" data-reset>Prototyp zurücksetzen</button>
      `,
      center: true,
      action: `<button class="lt-cta" type="button" data-go="heute">Zurück</button>`,
    });

    root.querySelector("[data-reset]")?.addEventListener("click", () => {
      resetState();
      state = loadState();
      run = null;
      if (location.hash === "#/kannst") render();
      else location.hash = "#/kannst";
    });
  }

  /* -------------------------------------------------------------- router */

  function render() {
    const [screen, arg] = (location.hash.replace(/^#\/?/, "") || "heute").split("/");
    if (screen === "waehlen") return waehlen();
    if (screen === "uebung") return uebung(arg);
    if (screen === "fertig") return fertig(arg);
    if (screen === "kannst") return kannst();
    return heute();
  }

  addEventListener("hashchange", render);
  render();
}

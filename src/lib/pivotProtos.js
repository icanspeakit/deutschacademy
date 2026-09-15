/* The six /uebungen prototypes that run inside the phone frame on /pivot.
 *
 * All six are built from the same real tool + exam list, so the only thing that
 * differs between them is structure. Each one renders into its own scroll
 * container inside the frame; every container stays in the layout (hidden with
 * `visibility`, not `display`) so the page height of an idea you are not looking
 * at can still be measured. That measurement is the point of the page — "this
 * feels shorter" is not an argument, "1.6 screens instead of 4.2" is.
 *
 * Prototype-only. Whatever wins moves into uebungen-vorschau.css and the real
 * index.astro, and this file gets deleted.
 */

const byId = (list, id) => list.find((x) => x.id === id);

export function mountPivot({ data, iconHost, phone, switchEl, table, notes, storageKey }) {
  const icons = Object.fromEntries(
    [...iconHost.querySelectorAll("[data-icon]")].map((el) => [el.dataset.icon, el.innerHTML])
  );
  const ic = (name, cls = "pvx-ic") =>
    `<span class="${cls}"><svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">${icons[name] || ""}</svg></span>`;

  /* --- pieces every prototype shares -------------------------------------- */

  const nav = `
    <div class="pvx-nav">
      <span class="pvx-logo">db <i>für Dich</i></span>
      <span class="pvx-navcta">Kostenlos üben</span>
      <span class="pvx-burger"><i></i><i></i><i></i></span>
    </div>`;

  const pills = data.pills.map((p) => `<span>${p}</span>`).join("");

  const heroFull = `
    <div class="pvx-hero">
      <h2>Bereit zu üben?</h2>
      <p>Wähle eine Übung oder starte direkt mit deiner nächsten Prüfungsvorbereitung.</p>
      <div class="pvx-hpills">${pills}</div>
    </div>`;

  // The slim hero is itself part of several answers: the full one costs ~150px
  // before a single choice is on screen.
  const heroSlim = (title = "Bereit zu üben?") => `
    <div class="pvx-hero pvx-hero--slim">
      <h2>${title}</h2>
      <div class="pvx-hpills">${pills}</div>
    </div>`;

  const tabs = `
    <div class="pvx-tabs">
      <button class="is-on" type="button">Übungen &amp; Prüfungen</button>
      <button type="button">Mein Fortschritt</button>
    </div>`;

  const eyebrow = (t) => `<p class="pvx-eyebrow">${t}</p>`;

  /* `js-pick` marks a decision the thumb can make — an exercise, an exam, or a
     category that opens one. It is what the measurement counts, so it goes on
     every one of those in every prototype and on nothing else. Counting only
     exercises would score B and D at zero for the very move that makes them
     short, which would be a rigged comparison. */
  const row = (t) => `
    <a class="pvx-row js-pick" href="${t.href}">
      ${ic(t.icon)}
      <span class="pvx-row-t">${t.title}</span>
      <span class="pvx-count">${t.count}</span>
    </a>`;

  // Exams carry no description, so the paragraph has to disappear rather than
  // render the string "undefined" thirteen pixels tall.
  const bigCard = (t) => `
    <a class="pvx-card js-pick" href="${t.href}">
      ${ic(t.icon, "pvx-ic pvx-ic--lg")}
      <h3>${t.title}</h3>
      ${t.desc ? `<p>${t.desc}</p>` : ""}
      <span class="pvx-count">${t.count}</span>
    </a>`;

  const tile = (t, exam = false) => `
    <a class="pvx-tile js-pick${exam ? " pvx-tile--exam" : ""}" href="${t.href}">
      ${ic(t.icon, "pvx-ic pvx-ic--sm")}
      <span class="pvx-tile-t">${exam ? t.title : t.short}</span>
      <span class="pvx-count pvx-count--xs">${t.count}</span>
    </a>`;

  const groupItems = (g) => (g.exams ? data.exams : g.tools.map((id) => byId(data.tools, id)));

  /* --- the six ideas ------------------------------------------------------- */

  const PROTOS = {
    /* Today. Deliberately the full-fat card, because that is what the screenshot
       shows: description, count pill and 24px of padding, thirteen times over. */
    now: () => `
      ${nav}
      <div class="pvx-body">
        ${heroFull}
        ${tabs}
        ${eyebrow("Übungen")}
        <div class="pvx-stack">${data.tools.map(bigCard).join("")}</div>
        ${eyebrow("Prüfungen")}
        <div class="pvx-stack">${data.exams.map(bigCard).join("")}</div>
      </div>`,

    /* A — same information, two columns, no descriptions. The description is the
       expensive part: it is the only thing on the card nobody reads twice. */
    grid: () => `
      ${nav}
      <div class="pvx-body">
        ${heroSlim()}
        ${tabs}
        ${eyebrow("Übungen")}
        <div class="pvx-grid2">${data.tools.map((t) => tile(t)).join("")}</div>
        ${eyebrow("Prüfungen")}
        <div class="pvx-grid2">${data.exams.map((e) => tile(e, true)).join("")}</div>
      </div>`,

    /* B — the pivot. The first screen is a question with five answers; the answer
       replaces the screen with its own short list. Nothing is ever longer than
       one screen, and the back arrow is where the thumb already is. */
    ask: () => `
      ${nav}
      <div class="pvx-body" data-ask="home">
        <div class="pvx-ask-home">
          <div class="pvx-ask-head">
            <h2>Was willst du üben?</h2>
            <p>${data.total} Werkzeuge, in fünf Richtungen sortiert.</p>
          </div>
          ${data.groups
            .map(
              (g) => `
            <button class="pvx-choice js-pick" type="button" data-group="${g.id}">
              ${ic(g.icon, "pvx-ic pvx-ic--lg")}
              <span class="pvx-choice-txt">
                <b>${g.name}</b>
                <i>${g.blurb}</i>
              </span>
              <span class="pvx-choice-n">${groupItems(g).length}</span>
            </button>`
            )
            .join("")}
          <button class="pvx-plain" type="button" data-group="alle">Lieber die ganze Liste sehen</button>
        </div>
        <div class="pvx-ask-detail" hidden>
          <!-- The icon and the title are the same two elements as on the card the
               learner tapped, at the same size — that is what lets them be FLIPped
               from one screen to the other instead of cut to a new position. -->
          <div class="pvx-detail-head">
            <button class="pvx-back" type="button" data-back aria-label="Zurück">←</button>
            <span class="pvx-ic pvx-ic--lg" data-detail-icon></span>
            <span class="pvx-detail-title" data-detail-title></span>
          </div>
          <div class="pvx-stack pvx-stack--tight" data-detail-list></div>
        </div>
      </div>`,

    /* C — for the 80% of sessions that are a return visit. The page opens on the
       thing you were doing, not on a catalogue of things you were not. */
    resume: () => {
      const recent = ["praep", "artikel"].map((id) => byId(data.tools, id));
      return `
      ${nav}
      <div class="pvx-body">
        <a class="pvx-resume js-pick" href="/uebungen/grammatik">
          <span class="pvx-resume-eyebrow">Weitermachen</span>
          <span class="pvx-resume-title">Grammatik · Perfekt</span>
          <span class="pvx-bar"><i style="width:60%"></i></span>
          <span class="pvx-resume-meta">6 von 10 Fragen · gestern</span>
          <span class="pvx-btn">Weiter üben</span>
        </a>
        <label class="pvx-search">
          ${ic("target", "pvx-ic pvx-ic--ghost")}
          <input type="text" placeholder="Übung oder Thema suchen" data-search />
        </label>
        <div class="pvx-chips">
          ${["Artikel", "Grammatik", "Wortschatz", "Prüfung"].map((c) => `<span class="pvx-chip js-pick">${c}</span>`).join("")}
        </div>
        ${eyebrow("Zuletzt geübt")}
        <div class="pvx-stack pvx-stack--tight">${recent.map(row).join("")}</div>
        <button class="pvx-plain pvx-plain--wide" type="button" data-all>
          Alle ${data.total} Werkzeuge anzeigen <i>▾</i>
        </button>
        <div class="pvx-stack pvx-stack--tight" data-alllist hidden>
          ${[...data.tools, ...data.exams].map(row).join("")}
        </div>
      </div>`;
    },

    /* D — the cheap version of B: same five buckets, but they open in place and
       the page grows back as soon as you use it. */
    accordion: () => `
      ${nav}
      <div class="pvx-body">
        ${heroSlim()}
        <div class="pvx-acc">
          ${data.groups
            .map(
              (g) => `
            <div class="pvx-accgroup" data-acc>
              <button class="pvx-acchead js-pick" type="button">
                ${ic(g.icon, "pvx-ic pvx-ic--sm")}
                <span class="pvx-acc-t">${g.name}</span>
                <span class="pvx-count pvx-count--xs">${groupItems(g).length}</span>
                <span class="pvx-chev">▾</span>
              </button>
              <div class="pvx-accbody" hidden>
                ${groupItems(g).map(row).join("")}
              </div>
            </div>`
            )
            .join("")}
        </div>
      </div>`,

    /* E — trade the vertical scroll for a horizontal one. Cheapest height on the
       page; also the only idea where an item can be invisible without being
       collapsed, which is why it is not the recommendation. */
    rows: () => `
      ${nav}
      <div class="pvx-body pvx-body--rows">
        ${heroSlim()}
        ${data.groups
          .filter((g) => groupItems(g).length > 1)
          .map(
            (g) => `
          <p class="pvx-eyebrow pvx-eyebrow--row">${g.name} <i>${groupItems(g).length}</i></p>
          <div class="pvx-rail">
            ${groupItems(g)
              .map(
                (t) => `
              <a class="pvx-railcard js-pick" href="${t.href}">
                ${ic(t.icon, "pvx-ic pvx-ic--sm")}
                <span class="pvx-railcard-t">${t.short || t.title}</span>
                <span class="pvx-count pvx-count--xs">${t.count}</span>
              </a>`
              )
              .join("")}
          </div>`
          )
          .join("")}
      </div>`,
  };

  /* --- motion ---------------------------------------------------------------
     B is the only idea whose answer lives on a second screen, which makes the
     trip between them part of the design rather than a detail: if the list just
     appears, the learner has to work out what happened to the thing they tapped.
     So the icon and the title travel — the card they touched becomes the header
     they land under, and nothing else is on screen to argue with. */
  const calm = matchMedia("(prefers-reduced-motion: reduce)");
  const EASE = "cubic-bezier(.22, 1, .36, 1)";
  const OUT = 170; // clearing the old screen
  const MORPH = 320; // the shared icon + title travelling

  const play = (el, frames, opts) => el?.animate(frames, { easing: EASE, fill: "both", ...opts });

  /* Standard FLIP: the element is already where it belongs, so it is drawn back
     at its old position for one frame and then allowed to travel there. `scale`
     is for the title, which changes size between the two screens; the icon is
     the same 46px on both and translates only. */
  function flip(el, first, { scale = false } = {}) {
    const last = el.getBoundingClientRect();
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

  const rect = (el) => el.getBoundingClientRect();

  const WIRE = {
    ask(root) {
      const body = root.querySelector("[data-ask]");
      const home = root.querySelector(".pvx-ask-home");
      const detail = root.querySelector(".pvx-ask-detail");
      const head = root.querySelector(".pvx-detail-head");
      const back = root.querySelector("[data-back]");
      const title = root.querySelector("[data-detail-title]");
      const icon = root.querySelector("[data-detail-icon]");
      const list = root.querySelector("[data-detail-list]");
      const choices = [...root.querySelectorAll("[data-group]")];
      let busy = false;

      const swap = (toDetail) => {
        home.hidden = toDetail;
        detail.hidden = !toDetail;
        body.dataset.ask = toDetail ? "detail" : "home";
        root.scrollTop = 0;
      };

      function fill(id) {
        const group = data.groups.find((g) => g.id === id);
        const items = group ? groupItems(group) : [...data.tools, ...data.exams];
        title.textContent = group ? group.name : "Alle Werkzeuge";
        icon.innerHTML = group
          ? root.querySelector(`[data-group="${id}"] .pvx-ic`).innerHTML
          : "";
        icon.hidden = !group;
        list.innerHTML = items.map(row).join("");
      }

      function open(btn) {
        if (busy) return Promise.resolve();
        const id = btn.dataset.group;
        fill(id);
        if (calm.matches) { swap(true); return Promise.resolve(); }

        busy = true;
        // Shared elements, measured on the card before anything moves. The plain
        // "ganze Liste" link has neither, so it falls back to a straight cut.
        const srcIcon = btn.querySelector(".pvx-ic");
        const srcTitle = btn.querySelector(".pvx-choice-txt b");
        const first = srcIcon && { icon: rect(srcIcon), title: rect(srcTitle) };

        // Everything the learner did not tap leaves first, nearest last, so the
        // screen empties towards the card that is about to become the header.
        const leaving = [...home.children].filter((n) => n !== btn);
        const anchor = [...home.children].indexOf(btn);
        for (const n of leaving) {
          const distance = Math.abs([...home.children].indexOf(n) - anchor);
          play(n, [
            { opacity: 1, transform: "none" },
            { opacity: 0, transform: "translateY(8px) scale(.98)" },
          ], { duration: OUT, delay: (distance - 1) * 22 });
        }
        // The tapped card sheds everything the header will not carry, then the
        // card itself dissolves, leaving only the icon and the name behind.
        play(btn.querySelector(".pvx-choice-txt i"), [{ opacity: 1 }, { opacity: 0 }], { duration: 120 });
        play(btn.querySelector(".pvx-choice-n"), [{ opacity: 1 }, { opacity: 0 }], { duration: 120 });
        play(btn, [
          { backgroundColor: "var(--surface-card)", borderColor: "var(--border)" },
          { backgroundColor: "rgba(0,0,0,0)", borderColor: "rgba(0,0,0,0)" },
        ], { duration: OUT });

        return new Promise((done) => {
          setTimeout(() => {
            swap(true);
            if (first) {
              flip(icon, first.icon);
              flip(title, first.title, { scale: true });
            }
            play(back, [
              { opacity: 0, transform: "scale(.7)" },
              { opacity: 1, transform: "none" },
            ], { duration: 220, delay: 90 });
            /* The card comes in as one object before its contents arrive —
               without this it is already a full-height white box at frame one,
               and three empty row slots wait there while the rows fade in. */
            play(list, [
              { opacity: 0, transform: "translateY(10px)" },
              { opacity: 1, transform: "none" },
            ], { duration: 240 });
            // Then the rows themselves, under the header they belong to, top first.
            [...list.children].forEach((r, i) =>
              play(r, [
                { opacity: 0, transform: "translateY(14px)" },
                { opacity: 1, transform: "none" },
              ], { duration: 280, delay: 70 + i * 45 })
            );
            setTimeout(() => {
              busy = false;
              // Clear the fills so a second visit animates from a clean slate.
              for (const el of [...leaving, btn, ...btn.querySelectorAll("*")]) el.getAnimations().forEach((a) => a.cancel());
              done();
            }, MORPH + 200);
          }, OUT - 20);
        });
      }

      function close() {
        if (busy) return Promise.resolve();
        if (calm.matches) { swap(false); return Promise.resolve(); }
        busy = true;

        const first = { icon: rect(icon), title: rect(title) };
        const rows = [...list.children];
        rows.forEach((r, i) =>
          play(r, [
            { opacity: 1, transform: "none" },
            { opacity: 0, transform: "translateY(10px)" },
          ], { duration: 130, delay: (rows.length - 1 - i) * 20 })
        );
        play(back, [{ opacity: 1 }, { opacity: 0 }], { duration: 120 });
        play(list, [{ opacity: 1 }, { opacity: 0 }], { duration: 150, delay: 60 });

        return new Promise((done) => {
          setTimeout(() => {
            const btn = choices.find((c) => c.querySelector(".pvx-choice-txt b")?.textContent === title.textContent);
            swap(false);
            if (btn) {
              flip(btn.querySelector(".pvx-ic"), first.icon);
              flip(btn.querySelector(".pvx-choice-txt b"), first.title, { scale: true });
              play(btn, [
                { backgroundColor: "rgba(0,0,0,0)", borderColor: "rgba(0,0,0,0)" },
                { backgroundColor: "var(--surface-card)", borderColor: "var(--border)" },
              ], { duration: 240, delay: 60 });
              play(btn.querySelector(".pvx-choice-txt i"), [{ opacity: 0 }, { opacity: 1 }], { duration: 200, delay: 140 });
              play(btn.querySelector(".pvx-choice-n"), [{ opacity: 0 }, { opacity: 1 }], { duration: 200, delay: 140 });
            }
            const anchor = btn ? [...home.children].indexOf(btn) : -1;
            for (const n of [...home.children].filter((c) => c !== btn)) {
              const distance = Math.abs([...home.children].indexOf(n) - anchor);
              play(n, [
                { opacity: 0, transform: "translateY(8px) scale(.98)" },
                { opacity: 1, transform: "none" },
              ], { duration: 240, delay: 80 + distance * 22 });
            }
            setTimeout(() => { busy = false; done(); }, MORPH + 200);
          }, 190);
        });
      }

      for (const btn of choices) btn.addEventListener("click", () => open(btn));
      back.addEventListener("click", close);

      // Used by the "Ablauf abspielen" button on the sketch page, and to put the
      // screen back on its home view when you switch away and return.
      return {
        async demo() {
          if (body.dataset.ask === "detail") await close();
          await open(root.querySelector('[data-group="grammatik"]'));
          await new Promise((r) => setTimeout(r, 1300));
          await close();
        },
        reset() {
          if (body.dataset.ask === "detail" && !busy) swap(false);
        },
      };
    },

    resume(root) {
      const btn = root.querySelector("[data-all]");
      const list = root.querySelector("[data-alllist]");
      btn.addEventListener("click", () => {
        const open = list.hidden;
        list.hidden = !open;
        btn.classList.toggle("is-open", open);
        btn.querySelector("i").textContent = open ? "▴" : "▾";
      });
      // The search box is a prop, not a feature — but a dead input in a prototype
      // reads as a bug, so it filters the list it sits above.
      const search = root.querySelector("[data-search]");
      search.addEventListener("input", () => {
        const q = search.value.trim().toLowerCase();
        if (q && list.hidden) btn.click();
        for (const a of list.querySelectorAll(".pvx-row")) {
          a.hidden = q ? !a.textContent.toLowerCase().includes(q) : false;
        }
      });
    },

    accordion(root) {
      for (const group of root.querySelectorAll("[data-acc]")) {
        const head = group.querySelector(".pvx-acchead");
        const bodyEl = group.querySelector(".pvx-accbody");
        head.addEventListener("click", () => {
          const open = bodyEl.hidden;
          bodyEl.hidden = !open;
          group.classList.toggle("is-open", open);
        });
      }
    },
  };

  /* --- build, measure, switch ---------------------------------------------- */

  const ids = [...switchEl.querySelectorAll("[data-idea]")].map((b) => b.dataset.idea);
  const screens = new Map();
  const api = new Map();

  for (const id of ids) {
    const screen = document.createElement("div");
    screen.className = "pv-screen";
    screen.dataset.screen = id;
    screen.innerHTML = PROTOS[id]();
    phone.append(screen);
    api.set(id, WIRE[id]?.(screen));
    screens.set(id, screen);
  }

  /* Measured, not asserted. Every screen is laid out at 390x664 (hidden ones via
     `visibility`, which keeps layout), so scrollHeight is the real page height and
     the tile positions are the real positions. */
  /* The fold is the frame's own size, read back rather than assumed. On a desktop
     the frame is the 390x664 iPhone 13 viewport; on a real handset the bezel is
     dropped and the frame becomes the device width, and then 390 would be a lie
     that makes every ratio on the page slightly wrong. */
  function measure(screen) {
    const height = Math.round(screen.scrollHeight);
    const fold = screen.clientHeight;
    const width = screen.clientWidth;
    const box = screen.getBoundingClientRect();
    let above = 0;
    for (const t of screen.querySelectorAll(".js-pick")) {
      const r = t.getBoundingClientRect();
      // A collapsed accordion body is `display: none`, so its rows report an
      // all-zero rect that would otherwise sail through both tests below and
      // score the most-hidden idea as the most visible one.
      if (r.width === 0 || r.height === 0) continue;
      // Fully visible: below the fold does not count, and neither does a rail
      // card parked off to the right waiting to be swiped into view.
      if (r.bottom - box.top <= fold && r.right - box.left <= width) above++;
    }
    return { height, fold, screens: height / fold, above };
  }

  const de = (n, digits) => n.toLocaleString("de-DE", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const fmt = {
    height: (m) => `${de(m.height, 0)} px`,
    /* A page shorter than the frame still measures exactly one frame, so say
       "fits" rather than a 1,0× that reads like a rounding coincidence. The 4px
       of slack is there because sub-pixel layout can put a fitting page a pixel
       or two over its own frame, and "663 px · 1,0×" next to "662 px · passt"
       is noise dressed up as a finding — nothing a thumb can scroll. */
    screens: (m) => (m.height <= m.fold + 4 ? "passt auf einen" : `${de(m.screens, 1)}×`),
    above: (m) => `${m.above}`,
  };

  const stats = new Map();
  function measureAll() {
    for (const [id, screen] of screens) {
      const m = measure(screen);
      stats.set(id, m);
      const tr = table.querySelector(`[data-row="${id}"]`);
      const note = notes.querySelector(`[data-note="${id}"]`);
      for (const key of ["height", "screens", "above"]) {
        const text = fmt[key](m);
        tr?.querySelector(`[data-cell="${key}"]`)?.replaceChildren(text);
        note?.querySelector(`[data-metric="${key}"]`)?.replaceChildren(text);
      }
    }
    // Shortest and tallest get marked so the table reads without arithmetic.
    // Ties are marked too — B and D both land on exactly one frame, and singling
    // out whichever happened to sort first would invent a winner.
    const heights = [...stats.values()].map((m) => m.height);
    const min = Math.min(...heights);
    const max = Math.max(...heights);
    for (const [id, m] of stats) {
      const tr = table.querySelector(`[data-row="${id}"]`);
      tr?.classList.toggle("is-best", m.height === min);
      tr?.classList.toggle("is-worst", m.height === max);
    }
  }

  // Fonts change wrapping, and wrapping changes every number above.
  if (document.fonts?.ready) document.fonts.ready.then(measureAll);
  else measureAll();
  requestAnimationFrame(measureAll);
  // Below 480px the frame gives up its bezel and takes the device width, so a
  // rotation or a resized window makes every printed number stale.
  let resizeTimer;
  addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(measureAll, 200);
  });

  function show(id) {
    for (const [key, screen] of screens) screen.classList.toggle("is-active", key === id);
    for (const note of notes.querySelectorAll("[data-note]")) note.hidden = note.dataset.note !== id;
    for (const btn of switchEl.querySelectorAll("[data-idea]")) {
      const on = btn.dataset.idea === id;
      btn.setAttribute("aria-selected", String(on));
      btn.tabIndex = on ? 0 : -1;
    }
    for (const tr of table.querySelectorAll("[data-row]")) tr.classList.toggle("is-current", tr.dataset.row === id);
    // Leaving an idea mid-flow and coming back to a half-open detail screen would
    // make the next visit start from somewhere the learner never chose.
    for (const [key, a] of api) if (key !== id) a?.reset?.();
    try { localStorage.setItem(storageKey, id); } catch {}
  }

  /* The replay button lives in B's note, because B is the only idea where the
     motion is the argument — you cannot judge a transition from a still. */
  for (const btn of notes.querySelectorAll("[data-demo]")) {
    btn.addEventListener("click", async () => {
      const run = api.get(btn.dataset.demo)?.demo;
      if (!run) return;
      btn.disabled = true;
      await run();
      btn.disabled = false;
    });
  }

  switchEl.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-idea]");
    if (btn) show(btn.dataset.idea);
  });

  switchEl.addEventListener("keydown", (e) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const current = ids.indexOf(document.activeElement.dataset?.idea ?? ids[0]);
    const next = ids[(current + step + ids.length) % ids.length];
    show(next);
    switchEl.querySelector(`[data-idea="${next}"]`).focus();
  });

  // Tapping a row in the table is the same choice as tapping the switch.
  table.addEventListener("click", (e) => {
    const tr = e.target.closest("[data-row]");
    if (tr) {
      show(tr.dataset.row);
      switchEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });

  let saved = null;
  try { saved = localStorage.getItem(storageKey); } catch {}
  show(ids.includes(saved) ? saved : ids[0]);
}

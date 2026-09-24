/* The collapsing side column, shared by the grammar topics and the exam pages.
 *
 * One idea, two surfaces. A page has a thing you sometimes need to read — the
 * grammar rule, or what an exam actually consists of — and a thing you came to do.
 * Reading it is a per-learner preference, not a per-visit one, so the column is
 * remembered rather than re-asked; and it starts collapsed, because the learner who
 * already knows should not have to scroll past it every time.
 *
 * What "collapsed" means depends on the width, and the CSS owns both (see
 * verben-praepositionen.css): on desktop the whole right-hand column slides out of a
 * grid track that shrinks to zero, on a phone the card itself contracts to nothing
 * and leaves only the button. This module owns the trip between the two states, what
 * is reachable in each, and the one-time tour that tells a first-time learner the
 * column is there at all.
 *
 * Markup contract — all inside `page`, all optional except the first:
 *   .vp-col--rule     the column that slides away on desktop
 *   .vp-rule-card     the card that contracts on a phone
 *   .vp-rule-toggle   the desktop pill (hidden below 1001px)
 *   .vp-rule-peek     its phone counterpart (hidden above 1000px)
 *   .vp-rule-pivot    the edge tab the collapsed column leaves behind on desktop
 *   .vp-rule-min      a control inside the column that puts it away
 * The first three buttons carry data-show / data-hide labels; the page decides the words,
 * since "Regel einblenden" and "Erklärung einblenden" are not the same promise.
 *
 * The pivot is the answer to a column that vanishes completely. Where the aside is an
 * aside — a rule you consult — vanishing is right: the pill in the toolbar is enough of a
 * trace. Where it is *navigation*, as the Wortschatz Lernset list is, a column that leaves
 * nothing behind reads as a feature that went away, and the control that brings it back is
 * a pill at the other end of the toolbar with nothing to connect it to the space that just
 * closed. So a page may render a tab at the screen edge where the column was; it must sit
 * OUTSIDE .vp-col--rule, because that column goes inert when it collapses and a control
 * inside it would go with it.
 *
 * Three knobs exist for surfaces where the column is navigation rather than an aside:
 * `defaultHidden` may be a function, so the first-visit state can depend on the width — a
 * nav column earns its place on a desktop but not on a phone — `intro: false` turns
 * off the pop-out tour where a page does not want one, and `sheet: true` changes what
 * "open" means on a phone.
 *
 * The sheet is the answer to an accordion that is too tall to be one. Expanding the
 * Wortschatz picker in place added two screens of list ABOVE the trainer: the control
 * that closed it rode down with the content, so the way out was a scroll away, and
 * choosing a set meant navigating anyway — every row in that list is a link to another
 * page. So with `sheet: true` the card becomes a bottom sheet below 1001px: it slides
 * over the work instead of pushing it, it brings its own close button and scrim (CSS owns
 * both; this owns the body-scroll lock and Escape), and the page underneath never moves,
 * so dismissing it puts the learner back exactly where they were. Desktop is untouched —
 * there the column really does sit beside the work, which is the whole point of it.
 */
import { createRuleIntro } from "./ruleIntro.js";
import { createCardCollapse } from "./cardCollapse.js";
import { getLang, onLangChange } from "./i18n.js";

// A label from data-show / data-hide, or its copy for the UI language where the page
// rendered one (data-show-en, data-hide-ar …) — labels that come from a topic's data rather
// than from the i18n dictionary. i18n rewrites the plain attributes itself.
function label(btn, which, lang = getLang()) {
  const own = btn.dataset[which + lang.charAt(0).toUpperCase() + lang.slice(1)];
  return own ?? btn.dataset[which];
}

const WIDE = "(min-width: 1001px)";

export function mountRuleColumn(page, {
  storageKey,
  seenKey,
  coach,
  coachCompact,
  devResetId = "vp-dev-reset",
  defaultHidden = true,
  intro: withIntro = true,
  sheet = false,
  /** Extra tour beats for what is inside the column — see `beats` in ruleIntro.js. */
  beats = [],
  /** Beats for the phone telling. Empty by default: most columns have nothing a phone
      tour can reach. A beat that points at something always on screen (a button in the
      work, not in the sheet) can be played there too. */
  beatsCompact = [],
} = {}) {
  if (!page) return null;
  const ruleEl = page.querySelector(".vp-col--rule");
  const ruleCard = page.querySelector(".vp-rule-card");
  const ruleBtn = page.querySelector(".vp-rule-toggle");
  const peekBtn = page.querySelector(".vp-rule-peek");
  const pivotBtn = page.querySelector(".vp-rule-pivot");
  // A control INSIDE the column that puts it away — the counterpart to the pivot, which
  // is outside it and brings it back. It only ever collapses, so it has no labels to
  // swap; it goes inert with the column it closed, which is right, because once the
  // column is away this button is off screen with it.
  const minBtn = page.querySelector(".vp-rule-min");
  if (!ruleEl) return null;

  const wide = matchMedia(WIDE);
  const calm = matchMedia("(prefers-reduced-motion: reduce)");
  const compactMq = matchMedia("(max-width: 1000px)");
  // Note that the presentation switch itself is not made here: the page carries
  // `.vp-page--sheet` from the server, because CSS has to know which shape the card is
  // before the first paint or a sheet flashes as a full-height accordion on the way in.

  let hidden = true;

  // Collapsed means "out of play" on both layouts, but not the same box: the whole
  // column on desktop, and on a phone only the card — everything inside it is
  // unreachable, including any button in there, which would otherwise still be a tab
  // stop. The hero and the toggle sit outside it.
  function syncInert() {
    ruleEl.inert = hidden && wide.matches;
    if (ruleCard) ruleCard.inert = hidden && !wide.matches;
  }
  wide.addEventListener("change", syncInert);

  // CSS owns the collapsed height; this owns the trip to and from it (and holds the
  // button still while the page shrinks above it).
  // A sheet slides; it does not grow. Handing it to the height animator would have it
  // measuring a fixed, off-screen box and pinning an inline max-height over the one the
  // sheet needs, so on those pages the compact animator is simply never active.
  const crop = createCardCollapse({
    card: ruleCard,
    toggle: peekBtn,
    active: sheet ? matchMedia("not all") : compactMq,
    calm,
  });

  // Scroll lock. A sheet over a scrollable page that still scrolls underneath is the
  // oldest bug in the pattern; it is released on every close, including the one that a
  // resize past the breakpoint amounts to.
  function lockScroll(on) {
    if (!sheet) return;
    document.body.style.overflow = on && compactMq.matches ? "hidden" : "";
  }

  // Split out of apply() so a language change can repaint the words without moving the
  // column: the labels live in data-show / data-hide, which i18n rewrites in place, and
  // rewriting an attribute does not touch the text already painted from it.
  function paintLabels(next) {
    if (ruleBtn) ruleBtn.textContent = label(ruleBtn, next ? "show" : "hide");
    // The sheet's opener keeps its word: while the sheet is up the button is behind the
    // scrim, and the control the learner reaches for is the sheet's own ✕.
    if (peekBtn && !sheet) peekBtn.textContent = label(peekBtn, next ? "show" : "hide");
  }

  function apply(next, persist = true) {
    crop.animate(next);
    hidden = next;
    page.dataset.rule = next ? "hidden" : "";
    paintLabels(next);
    if (peekBtn) {
      peekBtn.setAttribute("aria-expanded", next ? "false" : "true");
    }
    // The pivot's label never changes — it only exists while the column is away, and
    // what it says is what it will bring back. CSS hides it in the other state; aria
    // says so too, for the reader that ignores CSS.
    if (pivotBtn) {
      pivotBtn.setAttribute("aria-expanded", next ? "false" : "true");
      pivotBtn.inert = !next;
    }
    if (minBtn) minBtn.setAttribute("aria-expanded", next ? "false" : "true");
    syncInert();
    lockScroll(!next);
    // A sheet is not a preference. Every row in the Wortschatz picker is a link, so
    // "open" means "I am choosing right now", and remembering it would open the next
    // page — and the one after that — underneath a sheet nobody asked for. The desktop
    // column is the opposite: there it is a standing choice about the layout, and that
    // is what the key holds.
    if (persist && storageKey && !(sheet && !wide.matches)) {
      try { localStorage.setItem(storageKey, next ? "hidden" : "shown"); } catch {}
    }
  }

  let saved = null, seen = true;
  try {
    if (storageKey) saved = localStorage.getItem(storageKey);
    if (seenKey) seen = localStorage.getItem(seenKey) === "1";
  } catch {}

  // Restore without animating: the slide is feedback for an action, and nobody took
  // one yet.
  const firstVisit =
    typeof defaultHidden === "function" ? !!defaultHidden({ wide: wide.matches }) : !!defaultHidden;
  // The state this learner has when nothing has happened yet — their saved preference, or
  // the default where they have none. The tour borrows it and gives it back.
  // Same reason in the other direction: a phone arriving with the desktop's "shown" must
  // not open the sheet over the cards. In sheet mode the default is the resting state.
  const resting = sheet && !wide.matches ? firstVisit : saved === null ? firstVisit : saved === "hidden";
  apply(resting, false);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    delete page.dataset.anim;
    crop.arm();
  }));

  // The intro never persists a preference — it is a demo, not a choice the learner
  // made — so it gets apply() with persistence off. On a phone the starting target is
  // the button, because a collapsed card is zero-height and there is nothing to light
  // until the tour opens it; `ruleCard` is what it opens and frames once it has.
  const compact = !wide.matches;
  const intro = createRuleIntro({
    ruleEl: compact ? (peekBtn ?? ruleEl) : ruleEl,
    ruleBtn: compact ? peekBtn : ruleBtn,
    // A sheet is not a panel the tour can open and frame: it covers the screen it would
    // be framed against, and it brings its own scrim, which the tour's own scrim then
    // sits on top of. There is also nothing left to explain — a labelled button opens a
    // labelled sheet with a ✕ in it. So on a phone the sheet's tour lights the button and
    // stops, which is the one-beat fallback ruleIntro.js already has.
    ruleCard: sheet && compact ? null : ruleCard,
    setRule: (next) => apply(next, false),
    compact,
    // Where to leave the page. A tour is a demo, and a demo that ends somewhere other
    // than where it started has changed a setting nobody touched — so it returns to the
    // state this learner would have had if it had never run. For a rule that is
    // collapsed; for a desktop Lernset column it is open, and the tour's two beats are
    // the other way round because of it.
    restHidden: resting,
    // Lighting the toolbar pill is right when that pill is the only trace the column
    // leaves. Where there is a pivot, the pivot IS the trace, and the tour should end
    // pointing at the thing the learner will actually reach for.
    pivot: pivotBtn,
    // The two tellings are different stories, not one string at two sizes: the desktop
    // tour opens the column and then points at its switch (two beats), the phone tour
    // only ever has the button to light (one). A page that overrides one should be able
    // to leave the other alone.
    coach: (compact ? coachCompact : coach) ?? undefined,
    beats: compact ? beatsCompact : beats,
  });

  // Once per browser on the learner's first page of this kind. ?intro replays it on
  // demand without spending that one time, which is how you show it to someone.
  const forced = new URLSearchParams(location.search).has("intro");
  if (withIntro && !calm.matches && (forced || (saved === null && !seen))) {
    if (!forced && seenKey) { try { localStorage.setItem(seenKey, "1"); } catch {} }
    // The phone tour frames boxes near the top of the page; a restored scroll position
    // would leave it framing nothing.
    if (compact) requestAnimationFrame(() => intro.play());
    else intro.play();
  }

  /* ── The nudge ───────────────────────────────────────────────────────────────────
     The pivot is a 40px sliver at the edge of the screen, and a learner who never saw
     the tour — or saw it three visits ago — has no reason to read it as a handle. So it
     leans out and back, twice on arrival and again whenever the page has gone quiet,
     and it stops for good the first time the column is actually opened: an animation
     that keeps asking after the answer is given is a nag.

     It is the same gesture as the hover lean, which is the point — the tab is telling
     you what it does when you touch it. */
  const USED_KEY = seenKey ? seenKey + "-used" : null;
  let used = false;
  try { used = USED_KEY ? localStorage.getItem(USED_KEY) === "1" : false; } catch {}

  const NUDGES_MAX = 3;
  const IDLE_MS = 45000;
  let nudges = 0;
  let idleTimer = null;

  function nudge() {
    if (!pivotBtn || used || calm.matches) return;
    // Nothing to point at while the column is open, and nothing to see below the
    // pivot's own 1180px floor — which offsetParent cannot answer here, because the tab
    // is position: fixed and that is always null.
    if (page.dataset.rule !== "hidden") return;
    const cs = getComputedStyle(pivotBtn);
    if (cs.display === "none" || cs.visibility === "hidden") return;
    if (nudges >= NUDGES_MAX) return;
    nudges++;
    pivotBtn.classList.remove("is-nudge");
    void pivotBtn.offsetWidth;
    pivotBtn.classList.add("is-nudge");
  }
  pivotBtn?.addEventListener("animationend", () => pivotBtn.classList.remove("is-nudge"));

  function armIdle() {
    clearTimeout(idleTimer);
    if (used || !pivotBtn) return;
    idleTimer = setTimeout(nudge, IDLE_MS);
  }
  if (pivotBtn && !used) {
    // After the first paint has settled, and not while the tour is doing the same job
    // with words.
    const playingIntro = withIntro && !calm.matches && (forced || (saved === null && !seen));
    if (!playingIntro) setTimeout(nudge, 1400);
    for (const ev of ["pointerdown", "keydown", "wheel", "scroll"]) {
      addEventListener(ev, armIdle, { passive: true });
    }
    armIdle();
  }

  const onToggle = () => {
    intro.cancel();
    // Opening the column is the answer the nudge was asking for.
    if (!used) {
      used = true;
      clearTimeout(idleTimer);
      pivotBtn?.classList.remove("is-nudge");
      if (USED_KEY) { try { localStorage.setItem(USED_KEY, "1"); } catch {} }
    }
    apply(page.dataset.rule !== "hidden");
  };
  ruleBtn?.addEventListener("click", onToggle);
  peekBtn?.addEventListener("click", onToggle);
  pivotBtn?.addEventListener("click", onToggle);
  minBtn?.addEventListener("click", onToggle);

  // The sheet's own ways out: its ✕, its scrim, Escape. All of them close, none of them
  // open, so they are not the toggle.
  if (sheet) {
    for (const el of page.querySelectorAll("[data-sheet-close]")) {
      el.addEventListener("click", () => { intro.cancel(); apply(true); });
    }
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && compactMq.matches && page.dataset.rule !== "hidden") apply(true);
    });
    // Crossing the breakpoint with the sheet up leaves a locked body behind an ordinary
    // column, so the lock is re-derived rather than remembered.
    compactMq.addEventListener("change", () => lockScroll(page.dataset.rule !== "hidden"));
  }

  // Dev reset. A full reload rather than just intro.play(), because the interesting
  // part is everything that happens BEFORE the tour decides to run.
  document.getElementById(devResetId)?.addEventListener("click", () => {
    try {
      if (storageKey) localStorage.removeItem(storageKey);
      if (seenKey) { localStorage.removeItem(seenKey); localStorage.removeItem(seenKey + "-used"); }
    } catch {}
    // A restored scroll position would put the compact tour's targets off screen,
    // which is the one thing a fresh load never has.
    history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
    // Without the query string this is the plain first-visit path, not ?intro.
    location.replace(location.pathname);
  });

  // Which of the two words is showing depends on the state the column is in, so the
  // buttons cannot carry a plain data-i18n; they get repainted from the freshly
  // translated attributes instead.
  onLangChange(() => paintLabels(page.dataset.rule === "hidden"));

  return { apply, intro };
}

/* The small "Referenzliste" disclosure some rule cards carry inside them. Unrelated to
 * the column's own state — it is a detail of one card — but every page that has one
 * wires it identically. */
export function mountRefToggle(btn, panel) {
  if (!btn || !panel) return;
  const paint = () => { btn.textContent = label(btn, panel.hidden ? "show" : "hide"); };
  btn.setAttribute("aria-expanded", String(!panel.hidden));
  // A label from the topic's data may have a copy for the UI language already on the page.
  if (btn.dataset.showEn || btn.dataset.hideEn) paint();
  btn.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    paint();
    btn.setAttribute("aria-expanded", String(!panel.hidden));
  });
  // Same reason as paintLabels() above: the words live in attributes i18n rewrites.
  onLangChange(paint);
}

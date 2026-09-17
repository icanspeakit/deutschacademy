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
 * Both buttons carry data-show / data-hide labels; the page decides the words, since
 * "Regel einblenden" and "Erklärung einblenden" are not the same promise.
 *
 * Two knobs exist for surfaces where the column is navigation rather than an aside
 * (the Wortschatz Lernset list): `defaultHidden` may be a function, so the first-visit
 * state can depend on the width — a nav column earns its place on a desktop but not on a
 * phone — and `intro: false` turns off the pop-out tour, which exists to advertise a panel
 * that starts collapsed and has nothing to say about one that does not.
 */
import { createRuleIntro } from "./ruleIntro.js";
import { createCardCollapse } from "./cardCollapse.js";

const WIDE = "(min-width: 1001px)";

export function mountRuleColumn(page, {
  storageKey,
  seenKey,
  coach,
  coachCompact,
  devResetId = "vp-dev-reset",
  defaultHidden = true,
  intro: withIntro = true,
} = {}) {
  if (!page) return null;
  const ruleEl = page.querySelector(".vp-col--rule");
  const ruleCard = page.querySelector(".vp-rule-card");
  const ruleBtn = page.querySelector(".vp-rule-toggle");
  const peekBtn = page.querySelector(".vp-rule-peek");
  if (!ruleEl) return null;

  const wide = matchMedia(WIDE);
  const calm = matchMedia("(prefers-reduced-motion: reduce)");

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
  const crop = createCardCollapse({
    card: ruleCard,
    toggle: peekBtn,
    active: matchMedia("(max-width: 1000px)"),
    calm,
  });

  function apply(next, persist = true) {
    crop.animate(next);
    hidden = next;
    page.dataset.rule = next ? "hidden" : "";
    if (ruleBtn) ruleBtn.textContent = next ? ruleBtn.dataset.show : ruleBtn.dataset.hide;
    if (peekBtn) {
      peekBtn.textContent = next ? peekBtn.dataset.show : peekBtn.dataset.hide;
      peekBtn.setAttribute("aria-expanded", next ? "false" : "true");
    }
    syncInert();
    if (persist && storageKey) { try { localStorage.setItem(storageKey, next ? "hidden" : "shown"); } catch {} }
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
  apply(saved === null ? firstVisit : saved === "hidden", false);
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
    ruleCard,
    setRule: (next) => apply(next, false),
    compact,
    // The two tellings are different stories, not one string at two sizes: the desktop
    // tour opens the column and then points at its switch (two beats), the phone tour
    // only ever has the button to light (one). A page that overrides one should be able
    // to leave the other alone.
    coach: (compact ? coachCompact : coach) ?? undefined,
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

  const onToggle = () => {
    intro.cancel();
    apply(page.dataset.rule !== "hidden");
  };
  ruleBtn?.addEventListener("click", onToggle);
  peekBtn?.addEventListener("click", onToggle);

  // Dev reset. A full reload rather than just intro.play(), because the interesting
  // part is everything that happens BEFORE the tour decides to run.
  document.getElementById(devResetId)?.addEventListener("click", () => {
    try {
      if (storageKey) localStorage.removeItem(storageKey);
      if (seenKey) localStorage.removeItem(seenKey);
    } catch {}
    // A restored scroll position would put the compact tour's targets off screen,
    // which is the one thing a fresh load never has.
    history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
    // Without the query string this is the plain first-visit path, not ?intro.
    location.replace(location.pathname);
  });

  return { apply, intro };
}

/* The small "Referenzliste" disclosure some rule cards carry inside them. Unrelated to
 * the column's own state — it is a detail of one card — but every page that has one
 * wires it identically. */
export function mountRefToggle(btn, panel) {
  if (!btn || !panel) return;
  btn.setAttribute("aria-expanded", String(!panel.hidden));
  btn.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    btn.textContent = panel.hidden ? btn.dataset.show : btn.dataset.hide;
    btn.setAttribute("aria-expanded", String(!panel.hidden));
  });
}

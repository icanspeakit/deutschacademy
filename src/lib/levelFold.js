/* Wiring for the level fold (src/components/LevelFold.astro).
 *
 * The fold asks "Wo stehst du?" — a question that is only worth asking once. So the
 * tile does one of two things, decided by whether this browser has a record at all
 * (src/lib/progress.js, localStorage, no account anywhere):
 *
 *   returning learner — the tap goes straight into an exercise at that level: the one
 *     they were last in if there is one, otherwise the first topic at that level they
 *     have never opened. No menu: they have answered this question already, and the
 *     fastest thing the homepage can do for them is get out of the way.
 *   first visit — the tap opens that level's own panel, the grammar topics and the word
 *     list for it. Dropping a new learner cold into one fixed topic decides for them
 *     what "A1" means; five named rows let them decide, and it is still one screen.
 *
 * Neither path is a fetch or a build: every panel is already in the HTML, server-rendered,
 * which is also why the tiles stay real links and work with no JS at all (straight to the
 * entry topic, the old behaviour).
 */
import { getProgress } from "./progress.js";
import { getLang, loadDict, translate, onLangChange } from "./i18n.js";

const calm = matchMedia("(prefers-reduced-motion: reduce)");
const EASE = "cubic-bezier(.22, 1, .36, 1)";
const OUT = 150;

const play = (el, frames, opts) => el?.animate(frames, { easing: EASE, fill: "both", ...opts });

/* "Knows us" is deliberately generous: one graded answer anywhere on the site is enough.
 * Someone who has practised once does not need the level menu; the cost of being wrong
 * here is a tile that opens a list they could have skipped, not a dead end. */
function knownLearner(data) {
  if (data.recents?.length) return true;
  return Object.values(data.skills ?? {}).some((s) => (s.attempts || 0) > 0 || (s.sessions || 0) > 0);
}

/* Where a returning learner's tap lands. In order: the most recent thing they did at this
 * level, then the first topic here they have never opened, then the tile's own entry topic.
 * Every candidate is a link that is already on the page, so this can never point at a route
 * that does not exist. */
function resumeHref(panel, fallback, data) {
  const hrefs = [...panel.querySelectorAll(".lf-row")].map((a) => a.getAttribute("href"));
  const seen = (data.recents ?? []).map((r) => r.path.replace(/\/+$/, ""));
  const norm = (h) => h.replace(/\/+$/, "");

  const last = seen.find((p) => hrefs.some((h) => norm(h) === p));
  if (last) return last;

  const fresh = hrefs.find((h) => !seen.includes(norm(h)));
  return fresh ?? fallback;
}

export function mountLevelFold(root) {
  if (!root) return;
  const home = root.querySelector("[data-lf-home]");
  const detail = root.querySelector("[data-lf-detail]");
  const back = root.querySelector("[data-lf-back]");
  const levelEl = root.querySelector("[data-lf-detail-level]");
  const sub = root.querySelector("[data-lf-sub]");
  const tiles = [...root.querySelectorAll("[data-lf-tile]")];
  const panels = [...root.querySelectorAll("[data-lf-panel]")];
  // The exam chips are a second question; while a level's panel is open they are noise
  // under it, and on a phone they are what pushes the panel off the screen.
  const extras = [root.querySelector(".lf-sub-head"), root.querySelector(".lf-chips")].filter(Boolean);
  if (!home || !detail) return;

  const known = knownLearner(getProgress());

  // The server copy promises the direct path, which is what no-JS and every returning
  // learner gets. Only the menu path needs a different sentence.
  if (!known && sub) {
    const paintSub = async () => {
      const dict = await loadDict(getLang());
      const s = translate(dict, "fold.askSubNew");
      if (s !== "fold.askSubNew") {
        sub.textContent = s;
        // Keep the language switcher from putting the old promise back.
        sub.setAttribute("data-i18n", "fold.askSubNew");
      }
    };
    paintSub();
    onLangChange(paintSub);
  }

  function swap(toDetail) {
    home.hidden = toDetail;
    detail.hidden = !toDetail;
    for (const el of extras) el.hidden = toDetail;
    root.dataset.view = toDetail ? "detail" : "home";
    if (root.getBoundingClientRect().top < 0) {
      root.scrollIntoView({ block: "start", behavior: calm.matches ? "auto" : "smooth" });
    }
  }

  function open(tile) {
    const level = tile.dataset.lfTile;
    const panel = panels.find((p) => p.dataset.lfPanel === level);
    if (!panel) return; // no panel for this level: let the link do its job
    for (const p of panels) p.hidden = p !== panel;
    if (levelEl) levelEl.textContent = level;
    swap(true);
    if (calm.matches) return;
    play(panel, [{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: 220 });
    [...panel.querySelectorAll(".lf-row")].forEach((r, i) =>
      play(r, [{ opacity: 0, transform: "translateY(12px)" }, { opacity: 1, transform: "none" }], { duration: 240, delay: 50 + i * 40 })
    );
    back?.focus({ preventScroll: true });
  }

  function close() {
    swap(false);
    if (calm.matches) return;
    [...home.children].forEach((n, i) =>
      play(n, [{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], { duration: 200, delay: i * 25 })
    );
  }

  for (const tile of tiles) {
    tile.addEventListener("click", (e) => {
      // A new tab or a saved link should still be the plain href.
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      const level = tile.dataset.lfTile;
      const panel = panels.find((p) => p.dataset.lfPanel === level);
      if (!panel) return;
      e.preventDefault();
      if (known) {
        location.href = resumeHref(panel, tile.getAttribute("href"), getProgress());
        return;
      }
      open(tile);
    });
  }

  back?.addEventListener("click", close);
  root.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && root.dataset.view === "detail") close();
  });
}

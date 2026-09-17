/* Per-exercise rule panels and their one-time glow.
 *
 * The page already has a rule: the column on the right, with its own toggle and its
 * own tour. An exercise that asks the learner to apply one narrow rule needs that rule
 * within reach of the thing they are doing, so it gets its own pill at its own height
 * — the same .vp-rule-toggle, the same show/hide, wired to the same mountRefToggle.
 *
 * The glow is the part that needs care. The column's tour plays at the top of the page
 * on first load; lighting a second button at the same moment would be two things
 * competing for one first impression, and the exercise button is usually off screen
 * anyway. So this one waits until the button is actually on screen and fires then —
 * which is also when it is worth knowing about. Once per browser, cancelled by the
 * first click, and skipped entirely under prefers-reduced-motion.
 *
 * Markup contract, inside `root`:
 *   [data-ex-rule="<i>"]   the pill, with data-show / data-hide labels
 *   #vp-ex-rule-<i>        the panel it toggles, rendered `hidden`
 */
import { mountRefToggle } from "./ruleColumn.js";

export function mountExerciseRules(root, {
  seenKey = "da-ex-rule-peek",
  devResetId = "vp-dev-reset",
} = {}) {
  if (!root) return;
  const btns = [...root.querySelectorAll("[data-ex-rule]")];

  // Cleared alongside the column's own flags, so "↻ Tour neu" resets the whole first
  // visit and not just three quarters of it.
  document.getElementById(devResetId)?.addEventListener("click", () => {
    try { localStorage.removeItem(seenKey); } catch {}
  });

  if (!btns.length) return;

  for (const btn of btns) {
    const panel = root.querySelector(`#vp-ex-rule-${btn.dataset.exRule}`);
    if (!panel) continue;
    mountRefToggle(btn, panel);
    // Asking for the rule answers the question the glow was asking.
    btn.addEventListener("click", () => btn.removeAttribute("data-peek"), { once: true });
  }

  const calm = matchMedia("(prefers-reduced-motion: reduce)");
  const forced = new URLSearchParams(location.search).has("intro");
  let seen = false;
  try { seen = localStorage.getItem(seenKey) === "1"; } catch {}
  if (calm.matches || (seen && !forced)) return;

  // Whichever rule button the learner reaches first is the one that glows — one per
  // browser, not one per exercise. A page with three of them would otherwise spend
  // its first visit blinking.
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      io.disconnect();
      const btn = e.target;
      btn.setAttribute("data-peek", "");
      if (!forced) { try { localStorage.setItem(seenKey, "1"); } catch {} }

      // Blink and go quiet. The column's peek keeps its highlight because a tour is
      // holding the learner's attention and will hand it back; this one interrupts
      // nothing and opens nothing, so leaving the pill permanently lit would just be
      // a second colour on the page with no meaning left. animationend fires after
      // the last iteration; the timer is the fallback for a browser that never fires
      // it (animation dropped, tab backgrounded mid-blink).
      const done = () => btn.removeAttribute("data-peek");
      btn.addEventListener("animationend", done, { once: true });
      setTimeout(done, 4000);
    }
  }, { threshold: 1 });

  for (const btn of btns) io.observe(btn);
}

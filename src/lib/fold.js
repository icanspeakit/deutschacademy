/* Folding, with the animation that makes a pivot read as one list replacing another.
 *
 * Two lists on this site pivot the same way — the exam rail on /fortschritt and the
 * Lernset picker on every Wortschatz page — and both hit the same wall: `hidden` cannot
 * tween, and a height of `auto` cannot either. So the height is measured and animated in
 * script, and the row stagger that goes with it stays in CSS, where each list names its
 * own class.
 *
 * Shared rather than copied: the two were written days apart and had already drifted by
 * one easing and 50ms before this file existed.
 */

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Open or close a block by animating its height.
 *
 * @param {HTMLElement|null} el     the block — anything whose closed state is `hidden`
 * @param {boolean}          open
 */
export function slide(el, open) {
  if (!el) return;
  // A second click while the first is still running must not animate from a height that
  // is mid-flight — cancel, then measure the resting size.
  el.getAnimations?.().forEach((a) => a.cancel());
  if (reduced()) {
    el.hidden = !open;
    return;
  }
  if (open) el.hidden = false;
  const full = el.scrollHeight;
  el.style.overflow = "hidden";
  const anim = el.animate(
    [
      { height: (open ? 0 : full) + "px", opacity: open ? 0 : 1 },
      { height: (open ? full : 0) + "px", opacity: open ? 1 : 0 },
    ],
    { duration: open ? 240 : 190, easing: "cubic-bezier(.22,.7,.28,1)" }
  );
  anim.onfinish = () => {
    el.style.overflow = "";
    if (!open) el.hidden = true;
  };
}

/**
 * Re-run a CSS arrival stagger on a list that has just opened. Removing the class and
 * reading offsetWidth is what makes the animation restart rather than being skipped as
 * "already applied".
 */
export function replay(el, cls) {
  if (!el || reduced()) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

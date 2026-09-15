/* Animating a collapsible panel is the one thing CSS still cannot do on its own:
 * `max-height` transitions fine, `height: auto` does not, and picking a fat
 * max-height instead makes the easing land early and look broken. So the open and
 * closed heights are pinned here for the length of the transition and handed back
 * to CSS the moment it lands — CSS owns the crop height (a custom property on the
 * page), this owns the trip between the two.
 *
 * The scroll pinning is the part worth having in one place. Closing a panel takes
 * several hundred pixels out of the page ABOVE the button that closed it, so
 * without it the reader taps "collapse" and whatever they were reading shoots off
 * the bottom of the screen. Holding the toggle still and scrolling the page
 * underneath it is what makes the control feel like it belongs to the panel.
 *
 *   const crop = createCardCollapse({ card, toggle, active: matchMedia("(max-width: 1000px)") });
 *   crop.arm();              // after the first, state-restoring paint
 *   crop.animate(hidden);    // call immediately BEFORE flipping the page's state attribute
 */
export function createCardCollapse({ card, toggle, active, calm = matchMedia("(prefers-reduced-motion: reduce)") }) {
  let armed = false;

  // Opening pushes content down from above, which is what an accordion is supposed
  // to look like. Only the closing direction needs holding still.
  function pin() {
    if (!toggle) return;
    const keep = toggle.getBoundingClientRect().top;
    let done = false;
    const stop = () => { done = true; };
    card.addEventListener("transitionend", stop, { once: true });
    setTimeout(stop, 1400);
    (function step() {
      if (done) return;
      const drift = toggle.getBoundingClientRect().top - keep;
      // At the top of the document there is nothing left to scroll and the toggle
      // simply rises — that is the honest result, not something to fight.
      if (drift) window.scrollBy(0, drift);
      requestAnimationFrame(step);
    })();
  }

  function animate(hidden) {
    if (!card || !armed || !active.matches || calm.matches) return;
    card.style.maxHeight = card.getBoundingClientRect().height + "px";
    if (hidden) pin();
    requestAnimationFrame(() => {
      // The new state is already on the page by now, so clearing the inline value
      // hands the collapse its target — the CSS crop height — to travel to.
      card.style.maxHeight = hidden ? "" : card.scrollHeight + "px";
    });
  }

  // Hand the card back once the trip is over: open, that means no ceiling at all so
  // it can reflow as its content changes. (Closing already cleared it on the way in,
  // so this is a no-op in that direction.)
  card?.addEventListener("transitionend", (e) => {
    if (e.propertyName === "max-height") card.style.maxHeight = "";
  });

  // A height measured on one layout means nothing on the other.
  active.addEventListener("change", () => { if (card) card.style.maxHeight = ""; });

  return { animate, arm: () => { armed = true; } };
}

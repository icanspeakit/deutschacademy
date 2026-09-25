/* The side navigation's fold, one behaviour for every page that has one.
 *
 * Folding takes the list away and leaves the rail, so changing level stays one click
 * (decision 3 of "Seitennavigation vereinheitlichen"). The control is the tab on the
 * panel's edge — `[data-nvb-collapse]` — and nothing else: no second button in the
 * toolbar, no chevron in the head.
 *
 * One key for every page (decision 2). A learner who folds the list on der/die/das has
 * said something about how they like to work, and should not have to say it again on
 * Wortschatz. Open on a first visit: the list is how a newcomer finds out what there is.
 *
 * Desktop only. On a phone the list is a bottom sheet, which has its own ✕, and a folded
 * sheet would be a rail with nothing beside it — so below 1001px the class is lifted and
 * put back when the width comes back.
 *
 * The state is restored before first paint by the inline snippet in SideNavFold.astro;
 * this module takes over from there.
 */
import { t, onUiText } from "./uiText.js";

export const FOLD_KEY = "da-sidenav-fold";
const WIDE = "(min-width: 1001px)";

/**
 * @param {HTMLElement} root  the `.nvb` card
 * @param {{ page?: HTMLElement|null }} [opts]  the element whose [data-fold] sizes the grid track
 */
export function mountSideNavFold(root, { page = null } = {}) {
  if (!root) return null;
  const wide = matchMedia(WIDE);
  const btns = () => [...root.querySelectorAll("[data-nvb-collapse]")];

  let folded = false;
  try { folded = localStorage.getItem(FOLD_KEY) === "1"; } catch {}

  function paint() {
    const on = folded && wide.matches;
    root.classList.toggle("collapsed", on);
    if (page) page.dataset.fold = on ? "1" : "";
    for (const b of btns()) {
      b.setAttribute("aria-expanded", on ? "false" : "true");
      b.setAttribute("aria-label", on ? t("ap.list.expand", "Liste ausklappen") : t("ap.list.collapse", "Liste einklappen"));
    }
  }

  function set(on, persist = true) {
    folded = on;
    paint();
    if (persist) { try { localStorage.setItem(FOLD_KEY, on ? "1" : "0"); } catch {} }
  }

  // Restored without animating: the slide is feedback for an action, and nobody took one.
  root.classList.add("no-anim");
  paint();
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove("no-anim")));

  for (const b of btns()) {
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      set(!folded);
    });
  }
  wide.addEventListener("change", paint);
  onUiText(paint);

  return {
    set,
    get folded() { return folded && wide.matches; },
    /** A rail button was pressed: that is a request to see its list, so a folded list opens. */
    reveal() { if (folded && wide.matches) set(false); },
  };
}

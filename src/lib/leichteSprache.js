/* Leichte Sprache — a prototype toggle for the German the site speaks *about* the German
 * it is teaching.
 *
 * The exercises are A1–B2, but the sentences around them are not. "Männliche
 * Personenbezeichnungen bleiben maskulin, auch wenn sie auf -e enden" is a B2 sentence
 * explaining an A1 rule, and a learner who needed the explanation cannot read it. Same for
 * the instructions and the feedback: every one of them is a place where the site asks for
 * more German than the task does.
 *
 * So: two registers for the same content, and a switch. `leicht` follows the Leichte
 * Sprache conventions that matter here — short main clauses, one statement per sentence, no
 * subordinate clauses, no Passiv, no nominal style, and the grammatical terms either
 * dropped or immediately restated in plain words.
 *
 * WHAT THIS IS NOT: a translation layer. Nothing is generated. Every easy sentence is
 * written next to the normal one in the same source file, so a text without a `leicht`
 * variant simply stays as it is rather than being machine-simplified into something nobody
 * checked. `has()` is how a caller asks whether a variant exists.
 *
 * Markup contract — an element carries both registers and this swaps between them:
 *   <p data-ls="Der normale Satz." data-ls-leicht="Der leichte Satz.">…</p>
 * The initial text in the element is whichever register the page rendered; after mount it
 * is always the one this module says. Elements added later (the workspace re-renders on
 * every answer) are picked up by calling `apply(root)` again — `mount` also watches for
 * them, so a caller that forgets does not silently get half a page.
 */

const KEY = "da-leichte-sprache";

let on = false;
try { on = localStorage.getItem(KEY) === "1"; } catch {}

const listeners = new Set();

/** Is the easy register currently on? */
export function isLeicht() {
  return on;
}

/** Does this pair actually have an easy variant, or only the normal one? */
export function has(el) {
  return !!el?.dataset?.lsLeicht;
}

/** Swap every [data-ls] under `root` into the current register. */
export function apply(root = document) {
  if (!root || !root.querySelectorAll) return;
  const all = root.querySelectorAll("[data-ls]");
  for (const el of all) {
    const normal = el.dataset.ls;
    const leicht = el.dataset.lsLeicht;
    // No easy variant written for this one: it stays as it is. Falling back to the normal
    // text is the honest behaviour — better than an empty line, and better than pretending
    // the switch did something.
    el.textContent = on && leicht ? leicht : normal;
  }
  // The root itself may be a pair.
  if (root.dataset?.ls) {
    root.textContent = on && root.dataset.lsLeicht ? root.dataset.lsLeicht : root.dataset.ls;
  }
}

/** Set the register, remember it, and repaint. */
export function setLeicht(next, root = document) {
  on = !!next;
  try { localStorage.setItem(KEY, on ? "1" : "0"); } catch {}
  document.documentElement.classList.toggle("is-leicht", on);
  apply(root);
  for (const fn of listeners) fn(on);
}

/** Called whenever the register changes — for callers that re-render rather than swap. */
export function onLeichtChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Wire up every [data-ls-toggle] on the page and paint the initial register.
 *
 * `root` is what gets repainted. The workspace rebuilds its DOM on every answer, so a
 * MutationObserver re-applies to whatever arrives; without it the switch would work
 * until the first question was answered and then quietly stop.
 */
export function mountLeichteSprache(root = document) {
  document.documentElement.classList.toggle("is-leicht", on);
  apply(root);

  for (const btn of document.querySelectorAll("[data-ls-toggle]")) {
    const paint = () => {
      btn.setAttribute("aria-pressed", String(on));
      const label = btn.querySelector("[data-ls-toggle-state]");
      if (label) label.textContent = on ? "Leichte Sprache" : "Normal";
    };
    btn.addEventListener("click", () => { setLeicht(!on, root); paint(); });
    paint();
  }

  const target = root === document ? document.body : root;
  if (target && typeof MutationObserver === "function") {
    const obs = new MutationObserver((records) => {
      for (const r of records) {
        for (const node of r.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.matches?.("[data-ls]") || node.querySelector?.("[data-ls]")) { apply(node); }
        }
      }
    });
    obs.observe(target, { childList: true, subtree: true });
    return () => obs.disconnect();
  }
  return () => {};
}

/** Build the attribute pair for a text that has both registers. Server-side helper. */
export function pair(normal, leicht) {
  return leicht ? { "data-ls": normal, "data-ls-leicht": leicht } : { "data-ls": normal };
}

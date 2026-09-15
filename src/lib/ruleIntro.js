/* How does a learner find out the rule panel exists?
 *
 * It starts collapsed, and the only thing pointing at it is one quiet pill in the
 * corner of a page full of exercises. So on a learner's first grammar page the page
 * shows them, once: a scrim dims everything, a simulated cursor travels to the
 * toggle and clicks it, the cutout follows the panel out and a coach mark names it,
 * then the cutout returns to the toggle for a second coach mark before the fake
 * click puts the panel away again. About nine seconds, and impossible to miss.
 *
 * (An earlier, quieter variant just slid the panel out and back with no scrim. It
 * lost: a learner already reading exercise 1 never noticed it happen.)
 *
 * Any real input cancels the tour, and it never writes the rule preference — a demo
 * is not a choice the learner made.
 *
 * `compact: true` is the phone telling of the same story. It cannot be the same one:
 * opening the rule there pushes its own button off the bottom of the screen, so a
 * demo that opens and closes it would spend half its run framing empty space — and a
 * simulated mouse cursor on a touch screen is a prop from the wrong device. So the
 * compact tour never touches the panel: it lights what is already on screen and says
 * what it is. Where the panel still shows a cropped preview it lights that first and
 * then moves down to the button, two beats; where the panel collapses to nothing —
 * the grammar pages — the button IS the rule as far as the first screen goes, and a
 * spotlight travelling from a target to itself is a beat nobody needs to sit through,
 * so that case plays once.
 */

const CURSOR_SVG =
  '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">' +
  '<path d="M5.5 2.2 5.5 20.4 10.1 16.1 13.1 22.2 16.1 20.7 13.1 14.7 19.2 14.7z" ' +
  'fill="#0f172a" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>';

// Two beats: what the panel is, then where the control for it lives. The second
// beat matters — the first one lights a panel whose toggle is still in the dark.
const COACH = [
  ["Die Regel bleibt neben dir",
   "Erklärung und Übungen nebeneinander — statt einer Erklärung, an der du einmal vorbeiscrollst."],
  ["Hier ein- und ausblenden",
   "Über diesen Schalter. Deine Wahl wird gemerkt, auch für die nächste Übung."],
];

// One beat: the button is the only thing standing in for the rule on a phone, so
// the message has to carry all three things at once — where the rule went, how to
// get it, and that the choice sticks.
const COACH_COMPACT = [
  ["Die Regel liegt hier",
   "Die Übungen beginnen sofort. Ein Tippen zeigt die ganze Erklärung, ein zweites klappt sie wieder ein — deine Wahl wird gemerkt."],
];

export function createRuleIntro({ ruleEl, ruleBtn, setRule, compact = false, coach: copy }) {
  // Two beats either way; `coach` lets a page that is collapsing something other
  // than a grammar rule say so in its own words.
  const script = copy ?? (compact ? COACH_COMPACT : COACH);
  let timers = [];
  let overlay = null;
  let hole = null;
  let coach = null;
  let cursor = null;
  let running = false;

  const at = (ms, fn) => timers.push(setTimeout(fn, ms));

  function buildOverlay() {
    overlay = document.createElement("div");
    overlay.className = "ri-overlay";
    overlay.innerHTML =
      '<div class="ri-hole"></div>' +
      '<div class="ri-coach">' +
      '<p class="ri-coach-title"></p>' +
      '<p class="ri-coach-text"></p>' +
      "</div>" +
      '<div class="ri-cursor">' + CURSOR_SVG + '<span class="ri-ripple"></span></div>';
    document.body.appendChild(overlay);
    hole = overlay.querySelector(".ri-hole");
    coach = overlay.querySelector(".ri-coach");
    cursor = overlay.querySelector(".ri-cursor");
  }

  // The "hole" is a zero-size box wearing a 9999px shadow, so moving it moves the
  // lit patch and everything else stays dimmed. Viewport coordinates, hence the
  // abort-on-scroll below.
  function frame(el, pad, radius) {
    const r = el.getBoundingClientRect();
    hole.style.left = r.left - pad + "px";
    hole.style.top = r.top - pad + "px";
    hole.style.width = r.width + pad * 2 + "px";
    hole.style.height = r.height + pad * 2 + "px";
    hole.style.borderRadius = radius + "px";
    return r;
  }

  function placeCursor(x, y, instant) {
    if (instant) cursor.style.transition = "none";
    cursor.style.transform = "translate(" + x + "px, " + y + "px)";
    if (instant) requestAnimationFrame(() => { if (cursor) cursor.style.transition = ""; });
  }

  function click() {
    cursor.classList.add("is-clicking");
    at(420, () => cursor?.classList.remove("is-clicking"));
  }

  // Beside a tall target (the panel), below a short one (the toggle).
  function showCoach(step, r, below) {
    const gap = 20;
    coach.querySelector(".ri-coach-title").textContent = script[step][0];
    coach.querySelector(".ri-coach-text").textContent = script[step][1];
    // The card is narrower than 300px on a small phone, so ask it rather than
    // assume — every clamp below is in terms of its real width.
    const w = coach.offsetWidth;

    if (below) {
      coach.style.left = Math.max(16, Math.min(r.right - w, window.innerWidth - w - 16)) + "px";
      // Never past the bottom edge — on a phone the anchor can sit low enough that
      // "below it" is off the screen.
      const top = Math.min(r.bottom + gap, window.innerHeight - coach.offsetHeight - 16);
      coach.style.top = Math.max(16, top) + "px";
      coach.dataset.side = "top";
    } else {
      let left = r.left - gap - w;
      const side = left >= 16 ? "left" : "right";
      if (side === "right") left = Math.min(r.right + gap, window.innerWidth - w - 16);
      coach.style.left = Math.max(16, left) + "px";
      coach.style.top = Math.max(16, r.top + 28) + "px";
      coach.dataset.side = side;
    }
    coach.classList.add("is-on");
  }

  function centerOf(el) {
    const r = el.getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2];
  }

  function clearTimers() {
    timers.forEach(clearTimeout);
    timers = [];
  }

  function removeOverlay() {
    overlay?.remove();
    overlay = hole = coach = cursor = null;
  }

  // Any real input wins over the demo — a tour you cannot walk out of is a modal.
  const onAbort = () => cancel();
  // Except one that isn't input: a phone browser retracting its address bar fires a
  // resize during the first seconds of the page, which is exactly when this runs.
  // Only a width change actually invalidates the boxes the spotlight is framing.
  let startW = 0;
  const onResize = () => { if (!compact || window.innerWidth !== startW) cancel(); };

  function listen(on) {
    const fn = on ? "addEventListener" : "removeEventListener";
    document[fn]("pointerdown", onAbort, true);
    document[fn]("keydown", onAbort, true);
    window[fn]("wheel", onAbort, { passive: true, capture: true });
    window[fn]("touchmove", onAbort, { passive: true, capture: true });
    window[fn]("resize", onResize);
  }

  function cancel() {
    if (!running) return;
    running = false;
    clearTimers();
    listen(false);
    removeOverlay();
    ruleBtn?.removeAttribute("data-peek");
    setRule(true);
  }

  function finish() {
    running = false;
    listen(false);
  }

  function run() {
    setRule(true);
    buildOverlay();

    const [bx, by] = centerOf(ruleBtn);
    frame(ruleBtn, 8, 999);
    // Start off to one side, but inside the viewport: a cursor that begins beyond
    // the edge either gets clipped away or drags the document wider.
    placeCursor(
      Math.min(bx + 130, window.innerWidth - 28),
      Math.min(by + 110, window.innerHeight - 28),
      true
    );
    requestAnimationFrame(() => overlay?.classList.add("is-on"));

    at(400, () => cursor?.classList.add("is-on"));
    at(650, () => placeCursor(bx, by));
    at(1500, () => {
      click();
      setRule(false);
    });
    // The panel has to finish sliding before its box is worth measuring — and the
    // toggle moves with it, so every later beat re-measures rather than reusing bx/by.
    // 900ms after the click is --vp-slide plus a breath; keep the two in step.
    at(2400, () => showCoach(0, frame(ruleEl, 12, 22), false));
    at(4700, () => {
      coach?.classList.remove("is-on");
      const r = frame(ruleBtn, 8, 999);
      placeCursor(r.left + r.width / 2, r.top + r.height / 2);
    });
    at(5300, () => showCoach(1, ruleBtn.getBoundingClientRect(), true));
    at(7100, () => {
      coach?.classList.remove("is-on");
      click();
      setRule(true);
    });
    at(8000, () => {
      const r = frame(ruleBtn, 8, 999);
      placeCursor(r.left + r.width / 2, r.top + r.height / 2);
    });
    at(8500, () => {
      overlay?.classList.remove("is-on");
      cursor?.classList.remove("is-on");
      ruleBtn?.setAttribute("data-peek", "");
    });
    at(9100, removeOverlay);
    at(11600, () => {
      ruleBtn?.removeAttribute("data-peek");
      finish();
    });
  }

  // Two beats hang off the button either way: it sits directly under the cropped
  // card, so one anchor keeps the coach mark in the same place while the spotlight
  // travels to it. When the panel and its control are the same box there is nowhere
  // for the light to travel to, and one beat is the whole tour.
  function runCompact() {
    setRule(true);
    buildOverlay();

    const single = ruleEl === ruleBtn || script.length < 2;
    // A pill target gets a pill cutout; a card gets the card's corner radius.
    frame(ruleEl, single ? 8 : 10, single ? 999 : 20);
    requestAnimationFrame(() => overlay?.classList.add("is-on"));

    at(500, () => showCoach(0, ruleBtn.getBoundingClientRect(), true));

    if (single) {
      at(4400, () => {
        coach?.classList.remove("is-on");
        overlay?.classList.remove("is-on");
        ruleBtn?.setAttribute("data-peek", "");
      });
      at(5000, removeOverlay);
      at(7600, () => {
        ruleBtn?.removeAttribute("data-peek");
        finish();
      });
      return;
    }

    at(3200, () => coach?.classList.remove("is-on"));
    at(3500, () => frame(ruleBtn, 8, 999));
    at(3900, () => showCoach(1, ruleBtn.getBoundingClientRect(), true));
    at(6600, () => {
      coach?.classList.remove("is-on");
      overlay?.classList.remove("is-on");
      ruleBtn?.setAttribute("data-peek", "");
    });
    at(7200, removeOverlay);
    at(9800, () => {
      ruleBtn?.removeAttribute("data-peek");
      finish();
    });
  }

  function play() {
    cancel();
    if (!ruleEl || !ruleBtn) return;
    running = true;
    startW = window.innerWidth;
    listen(true);
    if (compact) runCompact();
    else run();
  }

  return { play, cancel, get running() { return running; } };
}

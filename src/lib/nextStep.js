// The nav's one primary action, picked from what this browser already knows.
// Decision and table: NAV-CTA-PROMPT.md. Checked in this order:
//
//   A · resume     has practised           → "Weiter üben" + the topic   → last.path
//   B · level      took the placement test → "Mit A2 starten"            → /grammatik#niveau-a2
//   C · placement  nothing known           → "Wo stehe ich?" + "Einstufungstest" → /einstufungstest
//
// C is also what the server renders, so no JS, no storage and any failure here all land on
// the same honest button. Reads only existing keys; writes nothing.
import { getResume } from "./progress.js";

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const PLACEMENT = "/einstufungstest";

const norm = (p) => (String(p || "").split(/[?#]/)[0].replace(/\/+$/, "") || "/");

/** The state for a page at `path` that has no stored knowledge — also the server render. */
export function fallbackStep(path) {
  // The button never links to the page it is on: on the test itself, point onward.
  if (norm(path) === PLACEMENT) {
    return { state: "placement", labelKey: "nav.next.toExercises", label: "Zu den Übungen", href: "/uebungen" };
  }
  return {
    state: "placement",
    labelKey: "nav.next.placement", label: "Wo stehe ich?",
    subKey: "nav.next.placementSub", sub: "Einstufungstest",
    href: PLACEMENT,
  };
}

function placementLevel() {
  try {
    const v = String(localStorage.getItem("da-einstufung") || "").toUpperCase();
    return LEVELS.includes(v) ? v : null;
  } catch {
    return null;
  }
}

/**
 * @param {string} [path]  the current page, so the button never points at it
 * @returns {{ state: "resume"|"level"|"placement", labelKey: string, label: string,
 *   subKey?: string, sub?: string, vars?: object, href: string }}
 */
export function getNextStep(path = typeof location !== "undefined" ? location.pathname : "/") {
  const here = norm(path);
  try {
    const resume = getResume();
    if (resume) {
      const next = [resume.last, ...(resume.recents || [])].find((r) => r?.path && norm(r.path) !== here);
      if (next) {
        return {
          state: "resume",
          labelKey: "nav.next.resume", label: "Weiter üben",
          sub: next.title || "", href: next.path,
        };
      }
    }
  } catch {
    // Unreadable progress is the same as none.
  }

  const level = placementLevel();
  if (level) {
    const href = `/grammatik#niveau-${level.toLowerCase()}`;
    if (norm(href) !== here) {
      return { state: "level", labelKey: "nav.next.level", label: `Mit ${level} starten`, vars: { level }, href };
    }
  }

  return fallbackStep(path);
}

/** The level from the placement test, for marking "dein Niveau" in the drawer. */
export const getPlacementLevel = placementLevel;

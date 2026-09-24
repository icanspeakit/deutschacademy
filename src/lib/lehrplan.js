// The teaching order of the grammar topics, in one place.
//
// src/data/grammatik-lehrplan.json has held a deliberate order since the guided run was
// built — within a level, what later topics build on comes first: the form, then the
// sentence, then the refinements. But only /grammatik/lauf read it. Everywhere
// the learner actually browses (the Stufenübersicht, the rail, the dashboard) sorted
// workspaces alphabetically and then tacked the quiz-only topics on the end, so A2 opened
// on "Modalverben, Negation, Perfekt …" while the course itself teaches
// "Perfekt, Modalverben, Trennbare Verben …". Two orders for one curriculum, and the one
// the learner saw was the accidental one.
//
// Topics missing from the plan sort to the end of their level in whatever order they came
// in, so adding a topic never silently drops it — it just lands last until someone places
// it on purpose.
import lehrplan from "../data/grammatik-lehrplan.json";

/** The planned order for one level, as a list of ids. */
export const planAt = (level) => lehrplan.order?.[level] ?? [];

/**
 * Where a topic sits in its level's plan, or Infinity if it is not placed yet.
 *
 * Takes several keys because the two identifiers disagree for one topic:
 * verben-praepositionen.json is `id: "praepositionen"`, `slug: "verben-praepositionen"`,
 * and the plan names the slug. Checking both means neither file has to change.
 */
export function planRank(level, ...keys) {
  const order = planAt(level);
  for (const k of keys) {
    if (!k) continue;
    const i = order.indexOf(k);
    if (i !== -1) return i;
  }
  return Infinity;
}

/**
 * A comparator for objects that carry a level and one or more identifiers.
 * `keysOf` returns the identifiers to try, most specific first.
 *
 * Array.prototype.sort is stable in every engine this ships to, so unplaced topics keep
 * the order they arrived in rather than shuffling between builds.
 */
export const byPlan = (keysOf, levelOf = (x) => x.level) => (a, b) =>
  planRank(levelOf(a), ...keysOf(a)) - planRank(levelOf(b), ...keysOf(b));

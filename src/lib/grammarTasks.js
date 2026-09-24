// How many things a grammar topic asks the learner to get right.
//
// Lifted out of LearnShell.astro when the standalone topic page needed the same number:
// /dashboard shows "0 / 42" for Artikel and /artikel now shows it too,
// and two copies of this arithmetic would have disagreed the first time a new exercise
// type landed. One slot is one gradeable answer, counted the way the five renderers in
// grammarWorkspace.js actually consume their data.

/** Gradeable slots in one exercise of a workspace. */
export function slotsOf(ex) {
  if (ex.type === "fill") return ex.items.length;
  if (ex.type === "match") return ex.pairs.length;
  if (ex.type === "table") return ex.rows.length;
  if (ex.type === "story") return ex.segments.filter((s) => s.blank !== undefined).length;
  if (ex.type === "build") return ex.sentences.length;
  return 0;
}

/**
 * Gradeable slots across a whole workspace, including the Aktiv mode's Hören items.
 *
 * Hören is checked by the site, so it counts. The Sprechen drill is not: it is self-rated
 * and lives on its own counter (recordDrill in progress.js), so counting it here would put
 * a denominator on /dashboard that no checked answer can ever fill.
 */
export const workspaceSlots = (w) =>
  (w.exercises ?? []).reduce((n, e) => n + slotsOf(e), 0) + (w.aktiv?.hoeren?.items?.length ?? 0);

/**
 * Tasks in whatever [id].astro was handed: a workspace (exercises) or a bare quiz topic
 * (questions). Both shapes live on the same route, so both have to be countable here.
 */
export function taskCountOf(data) {
  if (Array.isArray(data?.exercises)) return workspaceSlots(data);
  if (Array.isArray(data?.questions)) return data.questions.length;
  return 0;
}

/**
 * The progress key for a grammar topic — the URL slug, never the raw `id`.
 *
 * These differ for exactly one topic today: verben-praepositionen.json has `id: "praepositionen"`
 * and `slug: "verben-praepositionen"`. The dashboard keys its rows on `slug ?? id`, so the
 * standalone page has to key on the same thing or a learner's answers land in two buckets and
 * neither surface shows the truth.
 */
export const topicKeyOf = (data) => data?.slug ?? data?.id ?? null;

// Per-noun history for the der/die/das trainer, and the sessions built from it.
//
// Local, like every other record on the site ("lokal · ohne Konto"): one versioned
// localStorage key, every access in try/catch, so the trainer still runs — just without
// memory — where storage is blocked. The old "Runde" system kept nothing per noun, so
// there is nothing to migrate.
//
// Shape: { v: 1, n: { [nounId]: { r: [1, 0, 1], t: 1790000000000 } } }
//   r  the last results, oldest first, 1 = right on the first try; at most KEEP of them
//   t  when it was last asked (ms)

const KEY = "da-artikel-verlauf-v1";
// Nothing to clear: the fold, Lernkurve and rule-column keys belong to the level rail,
// which is back (ArtikelPicker.astro), so they are live state again, not leftovers.
const LEGACY_KEYS = [];
const KEEP = 4;

/** "Sicher" = right on the first try this many times in a row, most recent last. */
export const SICHER_STREAK = 2;
/** A "Weiter üben" session opens with at most this share of nouns still being got wrong. */
export const REVIEW_SHARE = 0.4;

let cache = null;

function load() {
  if (cache) return cache;
  cache = { v: 1, n: {} };
  try {
    for (const k of LEGACY_KEYS) localStorage.removeItem(k);
    const raw = JSON.parse(localStorage.getItem(KEY) || "null");
    if (raw && raw.v === 1 && raw.n && typeof raw.n === "object") cache = raw;
  } catch {
    // Unreadable or blocked: start empty rather than fail.
  }
  return cache;
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch {}
}

/** Record one settled answer. `ok` = right on the first try. */
export function record(id, ok) {
  const data = load();
  const h = data.n[id] ?? { r: [], t: 0 };
  h.r = [...h.r, ok ? 1 : 0].slice(-KEEP);
  h.t = Date.now();
  data.n[id] = h;
  save();
}

export const seen = (id) => Boolean(load().n[id]);

export function isSicher(id) {
  const r = load().n[id]?.r ?? [];
  return r.length >= SICHER_STREAK && r.slice(-SICHER_STREAK).every((x) => x === 1);
}

/** Got wrong at some point and not sicher since — what "Fehler wiederholen" runs. */
export function isFehler(id) {
  const r = load().n[id]?.r ?? [];
  return r.includes(0) && !isSicher(id);
}

/** Counts for a set of noun ids: how many are sicher, how many have been seen at all. */
export function stats(ids) {
  let sicher = 0, gesehen = 0, fehler = 0;
  for (const id of ids) {
    if (isSicher(id)) sicher++;
    if (seen(id)) gesehen++;
    if (isFehler(id)) fehler++;
  }
  return { sicher, gesehen, fehler, total: ids.length };
}

function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * A session over `pool` (question objects with `id`, and `freqPos` where known):
 *   1. nouns got wrong and not yet sicher — up to REVIEW_SHARE of the session
 *   2. nouns never asked, most frequent first (the ones the learner meets soonest)
 *   3. nouns already asked, least recently practised first
 * Then shuffled, so the three kinds are not three blocks.
 */
export function buildSession(pool, size) {
  const data = load();
  const last = (q) => data.n[q.id]?.t ?? 0;
  const wrong = shuffle(pool.filter((q) => isFehler(q.id)));
  const fresh = pool
    .filter((q) => !seen(q.id))
    .sort((a, b) => (a.freqPos ?? Infinity) - (b.freqPos ?? Infinity));
  const known = pool.filter((q) => seen(q.id) && !wrong.includes(q)).sort((a, b) => last(a) - last(b));

  const pick = wrong.slice(0, Math.round(size * REVIEW_SHARE));
  for (const q of [...fresh, ...known, ...wrong]) {
    if (pick.length >= size) break;
    if (!pick.includes(q)) pick.push(q);
  }
  return shuffle(pick);
}

/** Only the nouns still being got wrong — "Fehler wiederholen". */
export function buildFehlerSession(pool, size) {
  return shuffle(pool.filter((q) => isFehler(q.id))).slice(0, size);
}

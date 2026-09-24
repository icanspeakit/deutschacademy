// The live quiz's wire protocol — the one place both screens agree on.
//
// Transport is Supabase Realtime (broadcast + presence) on the public key, with no table
// behind it: a game lives only as long as the host's tab. The host is authoritative. It
// picks the questions, times them, scores the answers and is the only side that knows
// the right option until it reveals it — so a phone cannot read the answer out of the
// payload, and a slow phone cannot argue with the clock.
//
// Channel: `quiz:<PIN>`. Presence carries who is in the room ({ role, id, name, lang });
// broadcast carries the game:
//
//   player → host   join     { id, name, lang }             asks for a seat (and a name)
//   host   → all    roster   { players: [{ id, name }] }     names as the host settled them
//   host   → all    question { n, total, mode, prompt, options, seconds }
//   player → host   answer   { id, n, choice }
//   host   → all    reveal   { n, correct, dist, results: { [id]: { ok, points, score, rank } } }
//   host   → all    end      { podium, results }
//   host   → all    closed   {}                              host ended the game
//
// `prompt` and each option are either { de: "der Tisch" } or a meaning
// { en, ar, ru, tr } — the phone shows the one in its player's language.

/** The four languages a meaning can be shown in: the lexicon's complete ones. */
export const MEANING_LANGS = ["en", "ar", "ru", "tr"];

export const MODES = {
  /** A meaning on screen, the German word to pick. */
  "meaning-de": "meaning-de",
  /** A German word on screen, its meaning to pick. */
  "de-meaning": "de-meaning",
};

export const channelName = (pin) => `quiz:${pin}`;

/** Six digits, never starting with 0 — read aloud in class, a leading zero gets dropped. */
export function makePin() {
  return String(100000 + Math.floor(Math.random() * 900000));
}

export function makeId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

/**
 * Kahoot's rule: a right answer is worth up to 1000, falling to 500 at the buzzer, so
 * speed counts but never more than being right. `ms` is the host's own measurement
 * from sending the question to receiving the answer.
 */
export function points(ms, seconds) {
  const t = Math.min(Math.max(ms / (seconds * 1000), 0), 1);
  return Math.round(1000 * (1 - t / 2));
}

/** A nickname as the room will show it: trimmed, single-spaced, at most 16 characters. */
export function cleanName(raw) {
  return String(raw ?? "").replace(/\s+/g, " ").trim().slice(0, 16);
}

/** The option shapes and colours, the same on the projector and on every phone. */
export const OPTION_STYLES = ["a", "b", "c", "d"];

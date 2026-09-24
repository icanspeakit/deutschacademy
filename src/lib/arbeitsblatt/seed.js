// Deterministic shuffling for the worksheets (src/pages/lehrkraefte/arbeitsblaetter/).
//
// A worksheet is printed once and its answer key read off later, often on another
// device: the order of a matching column must therefore be the same on every build and
// every visit. Math.random() would reshuffle on each build and silently break every key
// already handed out. So the order comes from a seed — the unit or topic id — instead.

/** FNV-1a: a stable 32-bit number for a string. */
function hash(s) {
  let h = 2166136261;
  for (const ch of String(s)) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32: a small seeded generator, good enough to shuffle a word list. */
function rng(seed) {
  let a = hash(seed);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The list in a seeded order. Never returns the input order for two or more items: a
    "shuffled" column that happens to line up with the left one gives every answer away. */
export function shuffle(list, seed) {
  const a = list.slice();
  const r = rng(seed);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  if (a.length > 1 && a.every((x, i) => x === list[i])) a.push(a.shift());
  return a;
}

export const LETTERS = "abcdefghijklmnopqrstuvwxyz";

/** Every accepted answer as an array: the data holds a string or a list of alternatives. */
export const answersOf = (a) => (Array.isArray(a) ? a : [a]).map(String).filter((s) => s !== "");

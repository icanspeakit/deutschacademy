// The emoji a lexicon unit (a Lernset) wears in a side nav.
//
// Borrowed from the der/die/das pack that covers the same lexicon topic, at the unit's
// level where the pack has its own (A1 Wohnen 🏠, A2 Mieten 🔑). One source, so a set shows
// the same picture on Wortschatz and on Aussprache, and the same one der/die/das gives the
// nouns it shares with it.
import packs from "../data/artikel-packs.json";

/** @param {{ topics?: string[], level?: string|null }} unit */
export function unitIcon(unit) {
  const topics = unit?.topics ?? [];
  const pack = packs.topics.find((p) => p.topics.some((t) => topics.includes(t)));
  return pack?.levels?.[unit?.level]?.icon ?? pack?.icon ?? "•";
}

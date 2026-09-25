// Which words each Lernset holds, by the key progress.js files a learnt card under
// (`wortschatz:<lemma>`). The Wortschatz side nav fetches this once a learner has learnt
// something, to show "12/25" per set and "x von N sicher" per level — the page itself
// does not carry the whole lexicon for a number most first visits never need.
import type { APIRoute } from "astro";
import { lernsets } from "../lib/lernsets.js";
import { byUnit } from "../lib/lexicon.js";

export const prerender = true;

export const GET: APIRoute = () => {
  const sets: Record<string, { level: string | null; words: string[] }> = {};
  for (const set of lernsets()) {
    if (!set.words) continue;
    sets[set.id] = { level: set.level, words: byUnit(set.id).filter((e: any) => e.en != null).map((e: any) => e.lemma) };
  }
  return new Response(JSON.stringify(sets), { headers: { "Content-Type": "application/json" } });
};

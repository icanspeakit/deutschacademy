// Builds a game's questions from the lexicon. Host only: imported lazily by host.js, so
// the lexicon (~2 MB of JSON) is fetched by the projector's browser when a teacher opens
// the quiz, never by a student's phone. Phones get only the four options of the question
// on screen, with their meanings — see protocol.js.
import { select, spokenForm } from "../lexicon.js";
import { MEANING_LANGS } from "./protocol.js";

const QUIZ_LEVELS = ["A1", "A2", "B1", "B2"];

/** Words that can be asked: a meaning in every one of the four languages. */
function pool(level) {
  return select({ level: level ? [level] : QUIZ_LEVELS }).filter((e) => MEANING_LANGS.every((l) => e[l]));
}

const meaning = (e) => Object.fromEntries(MEANING_LANGS.map((l) => [l, e[l]]));

function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Three wrong options for `word`: the same part of speech from the same level where
 * there are enough, so the answer cannot be spotted by its shape (a verb among nouns,
 * an article on the only noun). Never a word whose German or English reads the same —
 * two options that both mean "to drive" would make a right answer count as wrong.
 */
function distractors(word, candidates) {
  const taken = new Set([word.lemma.toLowerCase(), word.en.toLowerCase()]);
  const tiers = [
    candidates.filter((e) => e.pos === word.pos && e.level === word.level),
    candidates.filter((e) => e.pos === word.pos),
    candidates,
  ];
  const out = [];
  for (const tier of tiers) {
    for (const e of shuffle(tier)) {
      if (out.length === 3) return out;
      const keys = [e.lemma.toLowerCase(), e.en.toLowerCase()];
      if (keys.some((k) => taken.has(k))) continue;
      keys.forEach((k) => taken.add(k));
      out.push(e);
    }
  }
  return out;
}

/**
 * @param {{ level: string, unit: string | null, mode: "meaning-de" | "de-meaning", count: number }} opts
 * @returns {{ prompt: object, options: object[], correct: number }[]} with `correct` the
 *   index into `options` — kept on the host, never sent before the reveal.
 */
export function buildQuestions({ level, unit, mode, count }) {
  const all = pool(level);
  const asked = shuffle(unit ? all.filter((e) => e.unit === unit) : all).slice(0, count);
  const everyone = pool(null);
  return asked.map((word) => {
    const options = shuffle([word, ...distractors(word, everyone.filter((e) => e.id !== word.id))]);
    const correct = options.indexOf(word);
    return mode === "meaning-de"
      ? { prompt: meaning(word), options: options.map((e) => ({ de: spokenForm(e) })), correct }
      : { prompt: { de: spokenForm(word) }, options: options.map(meaning), correct };
  });
}

/** How many askable words a unit (or a whole level) has — the most questions it can give. */
export function poolSize(level, unit) {
  const all = pool(level);
  return unit ? all.filter((e) => e.unit === unit).length : all.length;
}

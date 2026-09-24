// A vocabulary worksheet for one Lernset (one lexicon unit, ~25 words), built at build
// time from src/content/lexicon via src/lib/lexicon.js — the same words the Wortschatz
// trainer uses, so the sheet and the site never disagree.
//
// Three parts, each with its own answer key:
//   A  Wort ↔ Bedeutung — up to 10 words against their meanings, shuffled by a seed.
//   B  der, die oder das? — up to 10 nouns with the article left out.
//   C  Lückensätze — the lexicon's example sentences with the word blanked (up to 6).
//
// Meanings exist in en/ar/ru/tr for (nearly) every word. The sheet carries all four and
// the page shows the one the teacher picks, so one static page serves every class.
// Ukrainian is not offered: the lexicon has no uk glosses yet (the few in
// src/data/uebersetzungen/woerter-uk.json cover the grammar tables, not whole Lernsets).
import { select, units } from "../lexicon.js";
import { shuffle, LETTERS } from "./seed.js";

export const SHEET_LANGS = ["en", "ar", "ru", "tr"];
export const LANG_NAMES = { en: "English", ar: "العربية", ru: "Русский", tr: "Türkçe" };

const MATCH_MAX = 10;
const NOUN_MAX = 10;
const SENTENCE_MAX = 6;

const clean = (s) => String(s).toLowerCase().replace(/[^a-zäöüß]/g, "");

/** The token of the example sentence that is this word (or one of its forms), if any. */
function findToken(word) {
  if (!word.example) return null;
  const targets = new Set(
    [word.lemma, word.plural, ...(word.forms ?? []).flatMap((f) => String(f).split(/\s+/))]
      .filter(Boolean)
      .map(clean),
  );
  const tokens = word.example.split(/(\s+)/);
  const i = tokens.findIndex((t) => targets.has(clean(t)));
  if (i < 0) return null;
  // Keep punctuation outside the gap: "Tisch." → gap "Tisch" + ".".
  const m = tokens[i].match(/^([„"(]*)(.*?)([.,!?;:“")]*)$/);
  return { before: tokens.slice(0, i).join("") + m[1], answer: m[2], after: m[3] + tokens.slice(i + 1).join("") };
}

export function wortschatzSheet(unitId) {
  const unit = units().find((u) => u.id === unitId);
  const words = select({ unit: unitId });

  // A — the words that have a meaning in every offered language, in lexicon order.
  const glossed = words.filter((w) => SHEET_LANGS.every((l) => w[l]));
  const picked = glossed.slice(0, MATCH_MAX);
  const order = shuffle(picked.map((_, i) => i), `${unitId}:match`);
  const match = {
    left: picked.map((w, i) => ({ n: i + 1, de: w.lemma })),
    right: order.map((wi, k) => ({
      letter: LETTERS[k],
      meanings: Object.fromEntries(SHEET_LANGS.map((l) => [l, picked[wi][l]])),
    })),
    // Left item i is answered by the letter at the position its word landed in.
    answers: picked.map((_, i) => LETTERS[order.indexOf(i)]),
  };

  // B — nouns with a known gender.
  const nouns = words
    .filter((w) => w.pos === "noun" && ["der", "die", "das"].includes(w.gender) && !w.pluralOnly)
    .slice(0, NOUN_MAX)
    .map((w) => ({ lemma: w.lemma, gender: w.gender, plural: w.plural ?? null }));

  // C — example sentences where the word itself can be found and blanked.
  const sentences = [];
  for (const w of words) {
    if (sentences.length >= SENTENCE_MAX) break;
    const t = findToken(w);
    if (t && t.answer) sentences.push({ ...t, lemma: w.lemma });
  }
  const box = shuffle(sentences.map((s) => s.answer), `${unitId}:box`);

  return { unit, count: words.length, match, nouns, sentences, box };
}

/** Every Lernset, for getStaticPaths and the index. */
export const worksheetUnits = () => units({ level: ["A1", "A2", "B1", "B2"] });

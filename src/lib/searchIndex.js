// What the search lens in the nav can find, built once at build time and served as
// /suche.json. The overlay (SiteSearch.astro) fetches it the first time it opens, so no
// page pays for it until someone actually searches.
//
// Three kinds of hit, in the order a learner is likely to mean them:
//   topic  a grammar topic, a Präpositionen pack or a Kultur topic — matched on its name,
//          its subtitle and the KEYWORDS below, which are the words a learner types
//          ("der die das", "past tense", "wo wohin") rather than the name we gave it.
//   page   a trainer or exam hub (catalog.js).
//   word   every lexicon entry with a translation, linked to the Lernset it belongs to.
//
// Rows are arrays, not objects, for words: ~2700 of them, and the keys would be most of
// the file. The overlay knows the column order (see WORD_COLUMNS).
import { grammarCatalog } from "./grammarCatalog.js";
import { tools, exams } from "./catalog.js";
import { all, LEVELS } from "./lexicon.js";
import { lernsets, lernsetCards } from "./lernsets.js";
import kultur from "../data/kultur.json";
import praepTrainer from "../data/praepositionen-trainer.json";

const workspaceMods = import.meta.glob("../data/grammatik/*.json", { eager: true });
const subtitles = Object.fromEntries(
  Object.values(workspaceMods).map((m) => m.default ?? m).map((w) => [w.slug ?? w.id, w.subtitle ?? ""]),
);

// Extra words per grammar topic key: the German terms a textbook uses, the English ones a
// learner coming from an English course uses, and the forms themselves.
const KEYWORDS = {
  artikel: "der die das genus geschlecht gender article artikel bestimmter unbestimmter ein eine",
  akkusativ: "akkusativ accusative den einen wen direct object kasus fall case",
  dativ: "dativ dative dem der einem mir dir ihm wem indirect object kasus fall case",
  plural: "plural mehrzahl plural endings -e -er -n -s umlaut",
  praesens: "präsens present tense gegenwart konjugation verb endungen ich du er",
  konjugation: "konjugation conjugation verb tabelle zeiten tenses präsens präteritum perfekt futur",
  imperativ: "imperativ imperative befehl aufforderung bitte komm kommen sie",
  "ja-nein-fragen": "ja nein fragen yes no questions doch entscheidungsfrage",
  "w-fragen": "w-fragen fragewort question words wer was wo wann wie warum woher wohin",
  possessivartikel: "possessiv possessive mein dein sein ihr unser euer",
  negation: "negation verneinung nicht kein keine negative not no",
  perfekt: "perfekt past tense vergangenheit partizip ii haben sein gemacht gegangen present perfect",
  modalverben: "modalverben modal verbs müssen können dürfen sollen wollen mögen möchten",
  satzstellung: "satzstellung wortstellung word order verb position 2 satzbau inversion",
  wechselpraepositionen: "wechselpräpositionen two-way prepositions wo wohin in an auf über unter vor hinter neben zwischen dativ akkusativ",
  "trennbare-verben": "trennbare verben separable verbs präfix aufstehen anrufen einkaufen",
  "verben-praepositionen": "verben mit präpositionen verbs with prepositions warten auf denken an sich freuen über",
  adjektivdeklination: "adjektivdeklination adjective endings adjektiv endungen deklination",
  "als-oder-wenn": "als wenn when nebensatz vergangenheit temporal",
  "indirekte-fragen": "indirekte fragen indirect questions ob wissen sie nebensatz",
  "infinitiv-mit-zu": "infinitiv mit zu um zu ohne zu anstatt zu infinitive",
  "n-deklination": "n-deklination weak nouns schwache nomen student kollege herr",
  "praeteritum-plusquamperfekt": "präteritum plusquamperfekt simple past past tense past perfect vergangenheit war hatte",
  relativpronomen: "relativpronomen relativsatz relative clause pronoun der die das welcher",
  "konjunktiv2": "konjunktiv ii subjunctive würde hätte wäre wunsch höflich conditional",
  passiv: "passiv passive voice werden modalverb wird gemacht",
  fokuspartikeln: "fokuspartikeln auch nur sogar position",
  irgend: "irgend irgendwer irgendwo irgendwie irgendwann",
  negationswoerter: "negationswörter nie niemand nichts nirgends nicht mehr",
  "nomen-verb-verbindungen": "nomen-verb-verbindungen funktionsverbgefüge feste verbindungen",
  "partizip-als-adjektiv": "partizip i partizip ii adjektiv participle",
  "zweiteilige-konnektoren": "zweiteilige konnektoren nicht nur sondern auch weder noch entweder oder sowohl als auch",
};

/** Word rows: [lemma, gender, plural, en, level, href, pos]. */
export const WORD_COLUMNS = ["lemma", "gender", "plural", "en", "level", "href", "pos"];

export function buildSearchIndex() {
  const topics = [
    ...grammarCatalog.map((t) => ({
      t: t.name,
      s: subtitles[t.key] ?? "",
      k: KEYWORDS[t.key] ?? "",
      l: t.level,
      h: t.href,
      c: "grammatik",
    })),
    // akkusativ has its own page outside the catalog's [id] route.
    { t: "Akkusativ", s: "", k: KEYWORDS.akkusativ, l: "A1", h: "/akkusativ", c: "grammatik" },
    ...praepTrainer.packs.map((p) => ({
      t: p.title ?? p.name,
      s: "Präpositionen",
      k: "präpositionen prepositions",
      l: p.id.slice(0, 2).toUpperCase(),
      h: "/praepositionen",
      c: "praep",
    })),
    ...kultur.topics.map((k) => ({
      t: k.title,
      s: "Kultur",
      k: "kultur landeskunde culture",
      l: k.level ?? "",
      h: `/kultur/${k.id}`,
      c: "kultur",
    })),
  ];

  const pages = [...tools, ...exams].map((e) => ({
    t: e.title,
    s: e.desc ?? "",
    k: [e.short, e.id].filter(Boolean).join(" "),
    h: e.href,
  }));

  // A word links to its Lernset when that set has a page, else to the level's full list.
  const builtSets = new Set(
    lernsets({ status: "built" }).map((s) => s.id).filter((id) => lernsetCards(id).length > 0),
  );
  const words = all()
    .filter((w) => w.en != null && LEVELS.includes(w.level))
    .map((w) => [
      w.lemma,
      w.gender ?? "",
      w.plural ?? "",
      w.en,
      w.level,
      builtSets.has(w.unit) ? `/wortschatz/${w.unit}` : `/wortschatz/${w.level.toLowerCase()}`,
      w.pos ?? "",
    ]);

  return { topics, pages, words };
}

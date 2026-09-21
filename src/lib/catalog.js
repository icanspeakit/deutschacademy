/* The one catalogue behind every "what can I practise here?" surface.
 *
 * /uebungen and / used to carry their own copy of the same thirteen entries, which is how
 * the homepage ended up advertising "31 Nomen" for a trainer that had read 864 out of the
 * lexicon for a week. Counts are derived here, once, from the same data the tools load.
 *
 * `group` is what makes the ask-first picker possible: five buckets in the learner's words
 * ("Wörter"), not the product's ("Wortschatz & Redemittel"). Everything keeps its i18n key,
 * so the German strings below stay the pre-translation fallback, not the only version.
 */
import { counts, asArtikelRows } from "./lexicon.js";
import { taskCountOf } from "./grammarTasks.js";
import { lernsets } from "./lernsets.js";
import artikel from "../data/artikel.json";
import grammatik from "../data/grammatik.json";
import wortschatz from "../data/wortschatz.json";
import sprechen from "../data/sprechen.json";
import sprechenB1B2 from "../data/sprechen-b1b2.json";
import lesen from "../data/lesen.json";
import hoeren from "../data/hoeren.json";
// The index files, not src/lib/fertigkeiten.js: that module imports NAV_LEVELS from here,
// and the nav only ever needs what an index already carries — id, level, title, type. The
// resolved content (the borrowed DTZ texts, the pictures) is the pages' business.
import lesenIndex from "../data/fertigkeiten/lesen.json";
import schreibenIndex from "../data/fertigkeiten/schreiben.json";
import sprechenIndex from "../data/fertigkeiten/sprechen.json";
import kultur from "../data/kultur.json";
import lid from "../data/leben-in-deutschland.json";
import verbenPraepositionen from "../data/grammatik/verben-praepositionen.json";

// The grammar catalogue has two pools and the hub tiles have to count both of them.
// src/data/grammatik/*.json are full workspaces (a concept card plus up to five exercise
// types); grammatik.json holds the quiz-only topics still waiting for one. A workspace
// shadows the quiz entry with the same id.
const workspaceModules = import.meta.glob("../data/grammatik/*.json", { eager: true });
const workspaces = Object.values(workspaceModules).map((m) => m.default ?? m);
const workspaceIds = new Set(workspaces.map((w) => w.id));

const grammarQuestionCount = grammatik.reduce((sum, t) => sum + t.questions.length, 0);
// Every gradeable answer behind the Grammatik tile. It used to advertise the 7 quiz
// topics alone — "7 Themen · 37 Fragen" — while the page behind it listed 28, so the 21
// workspaces (Wechselpräpositionen among them) were invisible from the hub and looked
// like they did not exist. taskCountOf is the same arithmetic the topic pages and the
// dashboard use, so the three cannot disagree.
const grammarTopicCount = workspaces.length + grammatik.filter((t) => !workspaceIds.has(t.id)).length;
const grammarTaskCount =
  workspaces.reduce((n, w) => n + taskCountOf(w), 0) +
  grammatik.filter((t) => !workspaceIds.has(t.id)).reduce((n, t) => n + t.questions.length, 0);
const readingQuestionCount = lesen.groups.reduce((sum, g) => sum + g.questions.length, 0);
const hoerenQuestionCount = hoeren.texts.reduce((sum, t) => sum + t.questions.length, 0);
export const prepositionVerbCount = verbenPraepositionen.concept.reference.boxes.reduce((n, b) => n + b.items.length, 0);

// Präpositionen were spread across the catalogue: Wechselpräpositionen sat unlisted
// behind the Grammatik tile, "Verben mit Präpositionen" had a tile of its own, and a
// learner asking "wo sind die Präpositionen?" found neither from /uebungen. They get one
// area instead — see src/pages/uebungen/praepositionen.astro — and this is the list it
// and the tile above it both read.
const PRAEPOSITION_IDS = ["wechselpraepositionen", "praepositionen"];
export const praepositionTopics = PRAEPOSITION_IDS
  .map((id) => workspaces.find((w) => w.id === id))
  .filter(Boolean)
  .map((w) => ({
    id: w.id,
    name: w.name,
    level: w.level,
    subtitle: w.subtitle,
    href: `/uebungen/grammatik/${w.slug ?? w.id}`,
    exercises: w.exercises.length,
    tasks: taskCountOf(w),
  }));
const praepositionTaskCount = praepositionTopics.reduce((n, t) => n + t.tasks, 0);

const kulturTopicCount = kultur.topics.length;
const kulturQuizCount = kultur.topics.reduce((n, t) => n + t.quiz.length, 0);

/* The menu quotes the sitting, not the pile.
   "A1 · 650 Wörter" and "der/die/das-Trainer · 864 Nomen" are both true and both the wrong
   number to put on a button: nobody sits down to 650 of anything, and a learner reading it
   decides they cannot. What they actually get when they click is 25 cards (the trainer runs
   the level in parts of PART_SIZE) or 25 nouns (one Artikel-Runde), and 25 is a number you
   can look at and think "that, I can do". The totals are not hidden — they are on the deck
   pages and in the picker, where someone asking "how big is A1?" goes looking. */
const PART_SIZE = 25;
const ARTIKEL_ROUND = 25; // SESSION_SIZE in uebungen/artikel-trainer.astro

/** How many sittings a pile of `n` breaks into. "Runde" rather than "Teil": Teil is taken
    — a Portion route (a1-teil-03) is a named 20-word cut of a level — and Runde is already
    the word this site uses for one sitting, on the Artikel-Trainer's "Neue Runde". */
const parts = (n) => Math.max(1, Math.ceil(n / PART_SIZE));

export const lexiconCounts = counts();

export const tools = [
  { id: "artikel", group: "grammatik", href: "/uebungen/artikel-trainer", icon: "target",
    titleKey: "tool.artikel.title", title: "der/die/das-Trainer", shortKey: "group.short.artikel", short: "Artikel",
    descKey: "tool.artikel.desc", desc: "Artikel gezielt üben, mit sofortigem Feedback.",
    countKey: "tool.artikel.round", countVars: { n: ARTIKEL_ROUND }, count: `${ARTIKEL_ROUND} Nomen pro Runde` },
  { id: "grammatik", group: "grammatik", href: "/uebungen/grammatik", icon: "book",
    titleKey: "tool.grammatik.title", title: "Grammatik", shortKey: "tool.grammatik.title", short: "Grammatik",
    descKey: "tool.grammatik.desc", desc: "Themen nach Niveau: Akkusativ, Dativ, Passiv und mehr.",
    countKey: "tool.grammatik.count", countVars: { n: grammarTopicCount, q: grammarTaskCount }, count: `${grammarTopicCount} Themen · ${grammarTaskCount} Aufgaben` },
  // The tile used to open one topic (verben-praepositionen) and call itself after it.
  // It now opens the area that holds both preposition topics; the single topic is one
  // tap further in, which is the right depth for a subject with more than one page.
  { id: "praep", group: "grammatik", href: "/uebungen/praepositionen", icon: "link",
    titleKey: "tool.praepositionen.title", title: "Präpositionen", shortKey: "group.short.praep", short: "Präpositionen",
    descKey: "tool.praepositionen.desc", desc: "Wechselpräpositionen und feste Verb-Präpositionen an einem Ort.",
    countKey: "tool.praepositionen.count", countVars: { n: praepositionTopics.length, q: praepositionTaskCount },
    count: `${praepositionTopics.length} Themen · ${praepositionTaskCount} Aufgaben` },
  { id: "wortschatz", group: "woerter", href: "/uebungen/wortschatz", icon: "folder",
    titleKey: "tool.wortschatz.title", title: "Wortschatz & Redemittel", shortKey: "group.short.wortschatz", short: "Wortschatz",
    descKey: "tool.wortschatz.desc", desc: "Karteikarten zum Umdrehen und Wiederholen.",
    countKey: "tool.wortschatz.count", countVars: { n: wortschatz.length }, count: `${wortschatz.length} Karten` },
  { id: "aussprache", group: "woerter", href: "/uebungen/aussprache", icon: "volume",
    titleKey: "tool.aussprache.title", title: "Aussprache-Training", shortKey: "group.short.aussprache", short: "Aussprache",
    descKey: "tool.aussprache.desc", desc: "Wörter anhören und im Langsam-Modus üben.",
    countKey: "tool.aussprache.count", countVars: { n: wortschatz.length + artikel.length }, count: `${wortschatz.length + artikel.length} Wörter` },
  { id: "hoeren", group: "fertigkeiten", href: "/uebungen/hoeren", icon: "volume",
    titleKey: "tool.hoeren.title", title: "Hörverstehen", shortKey: "group.short.hoeren", short: "Hören",
    descKey: "tool.hoeren.desc", desc: "Durchsagen, Telefonate und Gespräche — mit Transkript und Tempo-Regler.",
    countKey: "tool.hoeren.count", countVars: { n: hoeren.texts.length, q: hoerenQuestionCount },
    count: `${hoeren.texts.length} Hörtexte · ${hoerenQuestionCount} Fragen` },
  { id: "sprechen", group: "fertigkeiten", href: "/uebungen/sprechen/", icon: "mic",
    titleKey: "tool.sprechen.title", title: "Sprechen", shortKey: "group.short.sprechen", short: "Sprechen",
    descKey: "tool.sprechen.desc", desc: "Vorstellen, Bild beschreiben, Kurzvortrag — mit Timer.",
    count: `${sprechenIndex.tasks.length} Aufgaben` },
  { id: "lesen", group: "fertigkeiten", href: "/uebungen/lesen", icon: "book-open",
    titleKey: "tool.lesen.title", title: "Leseverstehen", shortKey: "group.short.lesen", short: "Lesen",
    descKey: "tool.lesen.desc", desc: "Schilder, Anzeigen, E-Mails und Artikel — A1 bis B2.",
    count: `${lesenIndex.texts.length} Lesetexte` },
  { id: "schreiben", group: "fertigkeiten", href: "/uebungen/schreiben", icon: "pencil",
    title: "Schreiben", short: "Schreiben",
    desc: "Formulare, Nachrichten und Briefe — mit Modelltext.",
    count: `${schreibenIndex.tasks.length} Aufgaben` },
  { id: "kultur", group: "kultur", href: "/uebungen/kultur", icon: "map-pin",
    titleKey: "tool.kultur.title", title: "Kulturwissen", shortKey: "group.short.kultur", short: "Kultur",
    descKey: "tool.kultur.desc", desc: "Wie Deutschland im Alltag funktioniert — mit Quiz.",
    countKey: "tool.kultur.count", countVars: { n: kulturTopicCount, q: kulturQuizCount },
    count: `${kulturTopicCount} Themen · ${kulturQuizCount} Fragen` },
];

/* The landing grid.
 * ---------------------------------------------------------------------------
 * `tools` is the full inventory: one entry per trainer, which is what the nav menus, the
 * PracticePicker and ExamPractice all need — they look things up by id and they list
 * what exists.
 *
 * A landing page is not an inventory. Ten tiles is a wall a visitor reads as "a lot of
 * things" rather than as an offer, and five of the ten were one tile's worth of idea
 * split five ways: Aussprache and Hören are both "listen to German", and Sprechen, Lesen
 * and Schreiben are the three halves of the same exam that /uebungen/fertigkeiten already
 * presents together. Nobody arrives wanting "Schreiben" specifically; they arrive wanting
 * to know whether the four Fertigkeiten are covered.
 *
 * So the grid quotes seven, and the five merged trainers keep their own pages, their own
 * nav entries and their own ids — nothing is removed, one tap moved.
 */
/** The count line for a merged tile. Not the parts' own lines concatenated: strung
 *  together they repeat a word ("20 Aufgaben · 11 Lesetexte · 8 Aufgaben") and run to
 *  three numbers, which is a paragraph on a 200px tile. One number per thing, named by
 *  the thing, in the order the title names them. */
const sumCount = (...parts) => parts.join(" · ");

export const landingTools = (() => {
  const t = Object.fromEntries(tools.map((x) => [x.id, x]));
  const merged = {
    hoerenAussprache: {
      id: "hoeren-aussprache", group: "fertigkeiten", href: "/uebungen/fertigkeiten#hoeren", icon: "volume",
      titleKey: "tool.hoerenAussprache.title", title: "Hören & Aussprache",
      shortKey: "group.short.hoeren", short: "Hören",
      descKey: "tool.hoerenAussprache.desc",
      desc: "Durchsagen, Telefonate und Gespräche mit Transkript — und einzelne Wörter im Langsam-Modus.",
      countKey: "tool.hoerenAussprache.count",
      countVars: { n: hoeren.texts.length, w: wortschatz.length + artikel.length },
      count: sumCount(`${hoeren.texts.length} Hörtexte`, `${wortschatz.length + artikel.length} Wörter`),
    },
    fertigkeiten: {
      id: "fertigkeiten", group: "fertigkeiten", href: "/uebungen/fertigkeiten#sprechen", icon: "mic",
      titleKey: "tool.fertigkeiten.title", title: "Sprechen, Lesen & Schreiben",
      shortKey: "group.short.sprechen", short: "Fertigkeiten",
      descKey: "tool.fertigkeiten.desc",
      desc: "Die drei Prüfungsteile am Stück: Bild beschreiben, Texte verstehen, Briefe schreiben.",
      countKey: "tool.fertigkeiten.count",
      countVars: {
        s: sprechenIndex.tasks.length,
        l: lesenIndex.texts.length,
        w: schreibenIndex.tasks.length,
      },
      count: sumCount(
        `${sprechenIndex.tasks.length} Sprechen`,
        `${lesenIndex.texts.length} Lesen`,
        `${schreibenIndex.tasks.length} Schreiben`,
      ),
    },
  };
  // Order matters: grammar first (what most people come for), then words, then the two
  // skill tiles, then Landeskunde.
  return [
    t.artikel, t.grammatik, t.praep, t.wortschatz,
    merged.hoerenAussprache, merged.fertigkeiten, t.kultur,
  ];
})();

export const exams = [
  { id: "telc", group: "pruefungen", href: "/pruefungen/telc", icon: "document", title: "telc", short: "telc", count: "A1–C2" },
  { id: "goethe", group: "pruefungen", href: "/pruefungen/goethe", icon: "landmark", title: "Goethe-Zertifikat", short: "Goethe", count: "A1–C2" },
  { id: "testdaf", group: "pruefungen", href: "/pruefungen/testdaf", icon: "graduation-cap", title: "TestDaF", short: "TestDaF", count: "≈ B2–C1" },
  { id: "dtz", group: "pruefungen", href: "/pruefungen/dtz", icon: "book-open", title: "DTZ", short: "DTZ", count: "A2 / B1" },
  { id: "lid", group: "pruefungen", href: "/pruefungen/leben-in-deutschland", icon: "map-pin", title: "Leben in Deutschland", short: "Leben in DE",
    countKey: "group.count.bundeslaender", countVars: { n: lid.bundeslaender.length }, count: `${lid.bundeslaender.length} Bundesländer` },
];

export const groups = [
  { id: "grammatik", icon: "book", nameKey: "group.grammatik.name", name: "Grammatik", blurbKey: "group.grammatik.blurb", blurb: "Artikel, Fälle, Zeiten" },
  { id: "woerter", icon: "folder", nameKey: "group.woerter.name", name: "Wörter & Aussprache", blurbKey: "group.woerter.blurb", blurb: "Vokabeln hören und behalten" },
  { id: "fertigkeiten", icon: "mic", nameKey: "group.fertigkeiten.name", name: "Sprechen, Lesen & Schreiben", blurbKey: "group.fertigkeiten.blurb", blurb: "Prüfungsteile am Stück üben" },
  { id: "kultur", icon: "map-pin", nameKey: "group.kultur.name", name: "Landeskunde", blurbKey: "group.kultur.blurb", blurb: "Alltag und Kultur in Deutschland" },
  { id: "pruefungen", icon: "graduation-cap", nameKey: "nav.exams", name: "Prüfungen", blurbKey: "group.pruefungen.blurb", blurb: "telc, Goethe, TestDaF, DTZ" },
];

export const entries = [...tools, ...exams];
export const total = entries.length;

export function itemsOf(groupId) {
  return entries.filter((e) => e.group === groupId);
}

// ---------------------------------------------------------------------------
// The nav's subject-focused shape
// ---------------------------------------------------------------------------
// The menu used to mirror the URL tree — "Übungen" and "Prüfungen" — which asked a
// learner to know which bucket a tool lives in before they could find it. It now names
// subjects instead (Grammatik, Wortschatz, Sprechen, Prüfungen) plus the two entries
// that are about the learner rather than the material: Niveaus and Profil.
//
// Landeskunde rode along under Sprechen while it was a single topic — one tool does not
// earn its own menu. With fifteen topics and a quiz over all of them it does, so it is
// its own section now. It keeps its group in `groups` above, which is what /uebungen
// and the picker read.


/* --- Niveaus --------------------------------------------------------------- */

// A1–B2 only. C1/C2 exist in the lexicon's level list but have no topic and no words
// yet, and a menu that opens onto four empty levels teaches the wrong thing about the
// site. They join the moment `levels` below finds content for them.
export const NAV_LEVELS = ["A1", "A2", "B1", "B2"];

// Landeskunde reaches further than the trainers do. A cultural topic can be written at C1
// without the lexicon having a single C1 word, so it gets its own list rather than waiting
// for grammar and vocabulary to catch up — and NAV_LEVELS stays the honest answer to
// "which levels can I practise at?".
export const KULTUR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

/** Every grammar topic that has a page — workspaces first, so a level leads with its
    fullest topic rather than with a bare quiz. */
export const grammarTopics = [
  ...workspaces.map((w) => ({
    id: w.id, name: w.name, level: w.level,
    href: `/uebungen/grammatik/${w.slug ?? w.id}`,
  })),
  ...grammatik
    .filter((t) => !workspaceIds.has(t.id))
    .map((t) => ({ id: t.id, name: t.name, level: t.level, href: `/uebungen/grammatik/${t.id}` })),
];

/* --- The Grammatik-Werkstatt ------------------------------------------------
 *
 * The 21 workspaces on their own, with enough on each to render a card: level, one line
 * of what it is, an icon and how many answers it asks for. /uebungen had no way to reach
 * a single one of them — the Grammatik tile led to a level index, and the tile's own
 * count did not include them — so the hub now lists them as their own Bereich.
 *
 * The icons lived in uebungen/grammatik.astro and are shared from here now, because two
 * surfaces drawing the same topic with two different pictures is how a catalogue starts
 * to look like two catalogues.
 */
export const GRAMMAR_ICON = {
  akkusativ: "🎯",
  artikel: "🏷️",
  "w-fragen": "❓",
  "ja-nein-fragen": "🙋",
  dativ: "🤝",
  modalverben: "🔑",
  "trennbare-verben": "✂️",
  satzstellung: "🌉",
  wechselpraepositionen: "🧭",
  negation: "🚫",
  perfekt: "⏪",
  praepositionen: "🔗",
  adjektivdeklination: "🎨",
  "als-oder-wenn": "⏱️",
  passiv: "🔄",
  relativpronomen: "🧩",
  "zweiteilige-konnektoren": "🔀",
  "infinitiv-mit-zu": "🏁",
  "indirekte-fragen": "🙏",
  "n-deklination": "📐",
  "praeteritum-plusquamperfekt": "📜",
  irgend: "🌫️",
  konjunktiv2: "💭",
  negationswoerter: "🔕",
  "partizip-als-adjektiv": "🖌️",
  "nomen-verb-verbindungen": "🧱",
  fokuspartikeln: "🔦",
};

export const grammarWorkspaces = workspaces
  .map((w) => ({
    id: w.id,
    name: w.name,
    level: w.level,
    subtitle: w.subtitle,
    href: `/uebungen/grammatik/${w.slug ?? w.id}`,
    icon: GRAMMAR_ICON[w.id] ?? "📚",
    exercises: w.exercises.length,
    tasks: taskCountOf(w),
  }))
  .sort((a, b) => a.level.localeCompare(b.level) || a.name.localeCompare(b.name, "de"));

/** The workspaces cut by level, for any surface that lists them as a Bereich. */
export const grammarWorkspaceLevels = NAV_LEVELS
  .map((level) => ({ level, topics: grammarWorkspaces.filter((t) => t.level === level) }))
  .filter((row) => row.topics.length > 0);

const LEVEL_BLURB = {
  A1: "Erste Sätze",
  A2: "Alltag auf Deutsch",
  B1: "Selbstständig sprechen",
  B2: "Sicher argumentieren",
  C1: "Differenziert formulieren",
  C2: "Mühelos und genau",
};

export const levels = NAV_LEVELS.map((level) => {
  const slug = level.toLowerCase();
  const grammar = grammarTopics.filter((t) => t.level === level);
  const words = lexiconCounts[level]?.words ?? 0;
  const genderedNouns = asArtikelRows({ level }).length;

  // Only tools that can genuinely be scoped to this level are listed. A level the
  // lexicon has not reached yet shows its grammar and says the words are coming,
  // rather than offering a "Wortschatz B1" that quietly hands back the A1 deck.
  const vocab = [];
  if (genderedNouns) {
    vocab.push({ id: "artikel", icon: "target", title: "der/die/das-Trainer",
      href: `/uebungen/artikel-trainer?niveau=${level}`, count: `${ARTIKEL_ROUND} Nomen pro Runde` });
  }
  if (words) {
    vocab.push({ id: "wortschatz", icon: "folder", title: `Wortliste ${level}`,
      href: `/uebungen/wortschatz/${slug}`, count: `${parts(words)} Runden · je ${PART_SIZE} Wörter` });
  }

  return {
    id: level,
    level,
    slug,
    blurbKey: `level.${slug}.blurb`,
    blurb: LEVEL_BLURB[level],
    href: `/uebungen/grammatik#niveau-${slug}`,
    grammar,
    vocab,
    words,
  };
});

const notSelf = (href, list) => list.filter((i) => i.href !== href);

// ---------------------------------------------------------------------------
// Level-tiled subject menus
// ---------------------------------------------------------------------------
// Grammatik, Wortschatz and Fertigkeiten all answer the same question — "what is here for
// me, at my level?" — so all three now use the shape the Niveaus menu already proved: A1–B2
// tiles across the top that switch the list underneath them, with no page load in between.
//
// A level view is a list of columns; a column may end in a "more" link and may declare
// itself empty. The empty states are load-bearing rather than filler. There is no Hören
// material on the site at all and no A1 Leseverstehen, and four tiles that each promise
// content would be a menu lying about the catalogue.

/** One row in a level view. `count` is optional — a grammar topic has nothing to count. */
/* `count` is the German line the server renders; `meta` is what the client i18n pass uses
   to rebuild it. It is split into a type key and a count template because the task type
   ("Durchsage", "Zeitungsartikel") and the numbers translate from different keys, and a
   data-i18n-vars payload is static JSON that cannot itself reference another key.
   Titles carry no key on purpose — a Hörtext or Lesetext title names the situation in the
   language being learnt and stays German. */
const levelRow = (title, href, count, meta) => ({ title, href, count, meta });

const levelHead = (level) => ({
  level,
  slug: level.toLowerCase(),
  blurbKey: `level.${level.toLowerCase()}.blurb`,
  blurb: LEVEL_BLURB[level],
});

/* --- Grammatik -------------------------------------------------------------- */

const grammarLevelView = (level) => {
  const head = levelHead(level);
  const rows = grammarTopics
    .filter((t) => t.level === level)
    .map((t) => levelRow(t.name, t.href));
  // Two balanced columns, not one long one: B1 has eleven topics and a single column of
  // eleven pushes the panel's footer off the bottom of a laptop screen.
  const half = Math.ceil(rows.length / 2);

  return {
    ...head,
    metaKey: "nav.level.topicCount", metaVars: { n: rows.length }, meta: `${rows.length} Themen`,
    cols: [
      { id: "a", items: rows.slice(0, half) },
      { id: "b", items: rows.slice(half) },
    ],
    more: {
      href: `/uebungen/grammatik#niveau-${head.slug}`,
      labelKey: "nav.level.allTopics", labelVars: { n: rows.length }, label: `Alle ${rows.length} Themen`,
    },
  };
};

/* --- Wortschatz ------------------------------------------------------------- */

// A level has 26–46 Lernsets. Five is what fits beside the word lists without the panel
// growing a scrollbar; the rest are one click away on the level's own deck page, which
// carries the full picker at the bottom.
const VOCAB_SETS_PREVIEW = 5;

const vocabLevelView = (level) => {
  const head = levelHead(level);
  const words = lexiconCounts[level]?.words ?? 0;
  const nouns = asArtikelRows({ level }).length;
  const sets = lernsets({ level, status: "built" });

  // Only what this level can actually open. A level the lexicon has not reached says the
  // words are coming rather than handing back another level's deck.
  const lists = [];
  if (words) {
    lists.push(levelRow(`Wortliste ${level}`, `/uebungen/wortschatz/${head.slug}`,
      `${parts(words)} Runden · je ${PART_SIZE} Wörter`));
  }
  if (nouns) {
    lists.push(levelRow(`der/die/das · ${level}`, `/uebungen/artikel-trainer?niveau=${level}`,
      `${ARTIKEL_ROUND} Nomen pro Runde`));
  }

  return {
    ...head,
    // Just the count on the tile: "26 Sets · je 25 Wörter" wrapped to two lines and made
    // every tile taller. The rows under it carry the size.
    metaKey: "nav.level.setCount", metaVars: { n: sets.length },
    meta: `${sets.length} Lernsets`,
    cols: [
      {
        id: "listen", name: "Wortlisten", nameKey: "nav.vocab.lists", icon: "folder",
        items: lists,
        empty: "Wortlisten für dieses Niveau folgen.", emptyKey: "nav.level.vocabSoon",
      },
      {
        id: "sets", name: "Lernsets", nameKey: "nav.vocab.sets", icon: "layers",
        items: sets.slice(0, VOCAB_SETS_PREVIEW)
          .map((s) => levelRow(s.title, `/uebungen/wortschatz/${s.id}`, `${s.words} Wörter`)),
        more: sets.length > VOCAB_SETS_PREVIEW
          ? {
              href: `/uebungen/wortschatz/${head.slug}`,
              labelKey: "nav.vocab.allSets", labelVars: { n: sets.length }, label: `Alle ${sets.length} Lernsets`,
            }
          : null,
        empty: "Lernsets für dieses Niveau folgen.", emptyKey: "nav.vocab.setsSoon",
      },
    ],
  };
};

/* --- Landeskunde ------------------------------------------------------------ */

/* The Landeskunde menu's entries: the quiz first, because it is the one thing that
   spans every topic, then the topics in the hub's own order. No i18n keys — topic
   titles live in kultur.json and are not translated yet, so they render as written. */
const kulturQuizItem = {
  id: "kultur-quiz", href: "/uebungen/kultur/quiz", icon: "target",
  title: "Quiz über alle Themen", count: `${kulturQuizCount} Fragen`,
};

/* `level: false` drops the level out of the count line: inside a level section the heading
   already says it, and "B1 · B1 · 4 Fragen" is what the learner would be reading. The flat
   list below has no heading over it, so there it stays. */
const kulturItem = (t, { level = true } = {}) => ({
  id: `kultur-${t.id}`,
  href: `/uebungen/kultur/${t.id}`,
  icon: t.icon,
  title: t.title,
  count: level ? `${t.level} · ${t.quiz.length} Fragen` : `${t.quiz.length} Fragen`,
});

/* Fifteen topics in one list is a wall: the menu needed a scrollbar in both directions and
   nothing in it could be found by scanning. Both cuts below fix that; they just answer to
   different constraints, so the desktop panel and the drawer no longer share one.

   Desktop keeps the subject cut — Wohnen, Ämter, Umgang, Bildung, Land. Five tabs fit in
   one row, each tab names something a learner recognises, and the panel's height is one
   group's worth however many topics land later. Two levels as two columns looked thinner
   than the catalogue is.

   The drawer gets the level cut. There are no tabs on a phone, the pane scrolls, and under
   a heading that says "A2" a learner can tell at a glance which rows are meant for them —
   which is the one thing a stacked subject list cannot say.

   `group` and `level` both live on the topic in kultur.json; neither view is derived from
   the other. */
const KULTUR_GROUPS = [
  { id: "wohnen", name: "Wohnen & Alltag", nameKey: "nav.kultur.wohnen" },
  { id: "aemter", name: "Ämter & Versicherung", nameKey: "nav.kultur.aemter" },
  { id: "umgang", name: "Umgang & Gewohnheiten", nameKey: "nav.kultur.umgang" },
  { id: "bildung", name: "Schule & Ausbildung", nameKey: "nav.kultur.bildung" },
  { id: "land", name: "Land & Kalender", nameKey: "nav.kultur.land" },
];

// Ordered by how soon a newcomer meets them, not alphabetically — registering with the
// Amt comes before joining a Verein.
const kulturNavGroups = KULTUR_GROUPS.map((g) => ({
  ...g,
  items: kultur.topics.filter((t) => t.group === g.id).map((t) => kulturItem(t)),
}));

// The drawer's cut. Full lists, no preview: the pane scrolls, so every topic is right
// there under its heading.
const kulturLevelGroups = KULTUR_LEVELS
  .map((level) => ({
    id: level.toLowerCase(),
    slug: level.toLowerCase(),
    level,
    name: level,
    blurbKey: `level.${level.toLowerCase()}.blurb`,
    blurb: LEVEL_BLURB[level],
    items: kultur.topics.filter((t) => t.level === level).map((t) => kulturItem(t, { level: false })),
  }))
  .filter((g) => g.items.length);

/** The same cut, for the hub page — which wants the level's blurb as a heading. */
export const kulturLevels = kulturLevelGroups;

// Loud rather than silent: a topic added to kultur.json without a known `group` would
// otherwise just quietly stop appearing in the desktop menu.
const ungrouped = kultur.topics.filter((t) => !KULTUR_GROUPS.some((g) => g.id === t.group));
if (ungrouped.length) {
  throw new Error(`kultur.json: kein bekanntes group-Feld für ${ungrouped.map((t) => t.id).join(", ")}`);
}

// Loud rather than silent: a topic whose level is outside A1–B2 would otherwise just
// quietly stop appearing in the menu.
const offLevel = kultur.topics.filter((t) => !KULTUR_LEVELS.includes(t.level));
if (offLevel.length) {
  throw new Error(`kultur.json: Niveau außerhalb ${KULTUR_LEVELS.join("/")} bei ${offLevel.map((t) => t.id).join(", ")}`);
}

const kulturNavItems = [kulturQuizItem, ...kultur.topics.map((t) => kulturItem(t))];

/* --- Fertigkeiten ----------------------------------------------------------- */

// Four skills, each with its own A1–B2 row, and each row holds exactly what exists: the
// Leseverstehen and the three Schreibaufgaben are the B1 DTZ simulation, Sprechen is the
// DTZ picture task plus the telc B1/B2 three-stage task, and Hören is src/data/hoeren.json
// — sixteen scripts written for this site and voiced with ElevenLabs, four per level.
//
// A skill still says "folgt" for a level it has nothing at, and that is the point: Lesen
// and Schreiben genuinely stop at B1 today, and a menu that pretended otherwise would be
// the one thing worse than a thin menu.
// Every skill now reads from a per-exercise index in src/data/fertigkeiten/, the way Hören
// has from the start. Before that, Lesen and Schreiben were two and three anchors on one
// B1 page, so the menu said "2 Übungen" where Hören said "16" — the same number counting
// two different things. `byLevelFrom` is what makes them comparable again.
const indexLevels = (items, row) =>
  Object.fromEntries(
    NAV_LEVELS.map((level) => [level, items.filter((i) => i.level === level).map(row)]),
  );

const SKILLS = [
  {
    id: "hoeren", name: "Hören", nameKey: "nav.skill.hoeren", icon: "volume",
    href: "/uebungen/hoeren",
    // The count line names the task type rather than the topic, because that is what a DTZ
    // or telc Hörteil actually varies between items. The three skills below follow it.
    byLevel: indexLevels(hoeren.texts, (t) =>
      levelRow(t.title, `/uebungen/hoeren/${t.id}`,
        `${hoeren.types[t.type]} · ${t.questions.length} Fragen`,
        { typeKey: `type.hoeren.${t.type}`, typeText: hoeren.types[t.type],
          countKey: "grammatik.card.questions", countVars: { n: t.questions.length },
          countText: `${t.questions.length} Fragen` })),
  },
  {
    id: "lesen", name: "Lesen", nameKey: "nav.skill.lesen", icon: "book-open",
    href: "/uebungen/lesen",
    byLevel: indexLevels(lesenIndex.texts, (t) =>
      levelRow(t.title, `/uebungen/lesen/${t.id}`,
        `${lesenIndex.types[t.type]} · ca. ${t.minutes} Min.`,
        { typeKey: `type.lesen.${t.type}`, typeText: lesenIndex.types[t.type],
          countKey: "meta.min", countVars: { m: t.minutes },
          countText: `ca. ${t.minutes} Min.` })),
  },
  {
    id: "schreiben", name: "Schreiben", nameKey: "nav.skill.schreiben", icon: "pencil",
    href: "/uebungen/schreiben",
    byLevel: indexLevels(schreibenIndex.tasks, (t) =>
      levelRow(t.title, `/uebungen/schreiben/${t.id}`,
        `${schreibenIndex.types[t.type]} · ca. ${t.minutes} Min.`,
        { typeKey: `type.schreiben.${t.type}`, typeText: schreibenIndex.types[t.type],
          countKey: "meta.min", countVars: { m: t.minutes },
          countText: `ca. ${t.minutes} Min.` })),
  },
  {
    id: "sprechen", name: "Sprechen", nameKey: "nav.skill.sprechen", icon: "mic",
    href: "/uebungen/sprechen/",
    byLevel: indexLevels(sprechenIndex.tasks, (t) =>
      levelRow(t.title, `/uebungen/sprechen/${t.id}`,
        `${sprechenIndex.types[t.type]} · ${t.seconds} Sek.`,
        { typeKey: `type.sprechen.${t.type}`, typeText: sprechenIndex.types[t.type],
          countKey: "meta.sek", countVars: { s: t.seconds },
          countText: `${t.seconds} Sek.` })),
  },
];

export const skills = SKILLS.map((skill) => ({
  ...skill,
  levels: NAV_LEVELS.map((level) => ({
    ...levelHead(level),
    items: skill.byLevel[level] ?? [],
    empty: skill.soon ? skill.soonText : "Übungen für dieses Niveau folgen.",
    emptyKey: skill.soon ? skill.soonKey : "nav.skill.soon",
  })),
  // Distinct pages, not rows: the picture task counting twice because it spans two levels
  // would put a "4" on a skill with two trainers behind it.
  total: new Set(Object.values(skill.byLevel).flat().map((i) => i.href)).size,
}));

// ---------------------------------------------------------------------------
// The nav's subject menus
// ---------------------------------------------------------------------------
// A section renders one of four ways, checked in this order: `skills` (skill tabs, each
// with its own level row), `levels` (level tiles), `groups` (sub-headings, or tabs past
// TAB_AT of them), or a flat `items` list.
//
// `items` stays a flat union whatever the shape — the noscript fallback and anything else
// that only wants "what is in here" reads it — and `badge` is what the drawer's home row
// counts, because for a level-tiled section the useful number is four levels, not the 135
// Lernsets behind them.
//
// No section lists a link to its own page: the panel footer already goes there. "Grammatik ›
// Grammatik" was the same URL three times in one menu (the menu button, the row, and
// "Übersicht"), which reads as a bug even when it works.

const grammatikTrainer = notSelf("/uebungen/grammatik", itemsOf("grammatik"));
const wortschatzItems = notSelf("/uebungen/wortschatz", itemsOf("woerter"));

export const navSections = [
  { id: "grammatik", icon: "book", href: "/uebungen/grammatik",
    nameKey: "nav.subject.grammatik", name: "Grammatik",
    blurbKey: "group.grammatik.blurb", blurb: "Artikel, Fälle, Zeiten",
    // Spans the levels rather than sitting inside one: the trainer draws its nouns from
    // A1 and A2 together, so it belongs above the tiles, not under one of them.
    feature: grammatikTrainer[0],
    levels: NAV_LEVELS.map(grammarLevelView),
    badge: NAV_LEVELS.length,
    items: [...grammatikTrainer, ...grammarTopics.map((t) => levelRow(t.name, t.href))] },

  { id: "wortschatz", icon: "folder", href: "/uebungen/wortschatz",
    nameKey: "nav.subject.wortschatz", name: "Wortschatz",
    blurbKey: "group.woerter.blurb", blurb: "Vokabeln hören und behalten",
    // Not level-scoped — it reads every deck at once — so it sits above the tiles too.
    feature: wortschatzItems[0],
    levels: NAV_LEVELS.map(vocabLevelView),
    badge: NAV_LEVELS.length,
    items: wortschatzItems },

  // Was "Sprechen", which was simply not true of the second entry in it: "Lesen & Schreiben"
  // is a reading and writing trainer. "Fertigkeiten" is the word the Lehrwerke and the
  // Integrationskurse use for exactly this set of four.
  // The subject's own page, not /uebungen/sprechen: clicking "Fertigkeiten" used to land
  // the learner inside the Bildbeschreibung trainer — one of the four skills — with the
  // other three only reachable by reopening the menu.
  { id: "fertigkeiten", icon: "mic", href: "/uebungen/fertigkeiten",
    nameKey: "nav.subject.fertigkeiten", name: "Fertigkeiten",
    blurbKey: "nav.subject.fertigkeiten.blurb", blurb: "Hören, Lesen, Schreiben, Sprechen",
    skills,
    badge: skills.length,
    items: notSelf("/uebungen/fertigkeiten", itemsOf("fertigkeiten")) },

  { id: "landeskunde", icon: "map-pin", href: "/uebungen/kultur",
    nameKey: "group.kultur.name", name: "Landeskunde",
    blurbKey: "group.kultur.blurb", blurb: "Alltag und Kultur in Deutschland",
    // The quiz spans every group, so it sits above them rather than inside one.
    feature: kulturQuizItem,
    groups: kulturNavGroups,
    // The phone gets the same topics cut by level instead — see the note above.
    drawerGroups: kulturLevelGroups,
    items: kulturNavItems },

  { id: "pruefungen", icon: "graduation-cap", href: "/pruefungen",
    nameKey: "nav.exams", name: "Prüfungen",
    blurbKey: "group.pruefungen.blurb", blurb: "telc, Goethe, TestDaF, DTZ",
    items: notSelf("/pruefungen", itemsOf("pruefungen")) },
];

// ---------------------------------------------------------------------------
// The "Üben" mega menu
// ---------------------------------------------------------------------------
// Eight top-level items, six of them dropdowns, mixing three kinds of thing: four content
// subjects, a cross-cutting filter (Niveaus) and two account/utility links. The bar was
// wide enough to run into the logo, and a learner deciding where to click had to hold all
// eight in mind.
//
// The four subjects are one decision, not four — "what do I practise" — so they become
// four columns of one menu. Each column is that subject's own trainers and hubs, with its
// overview page at the foot.
//
// What a column deliberately does NOT carry is the deep tree the old per-subject panels
// held: every grammar topic per level, every Lernset, every skill × level cross-product.
// Four columns cannot hold several hundred links, and the reason to merge the menus was
// that there were too many things in them. Every one of those routes is still reachable —
// one click further, from the hub the column links to, which is the page built to list
// them. The level chips below the columns are the other way in.
//
// `navSections` stays exactly as it was: the drawer and PracticeHeader still read it, and
// the per-subject panels it describes are what the section pages themselves render.
const skillColumnItems = skills.map((s) => ({
  id: s.id, icon: s.icon, href: s.href,
  titleKey: s.nameKey, title: s.name,
  countKey: s.total ? "nav.skill.count" : undefined,
  countVars: s.total ? { n: s.total } : undefined,
  count: s.total ? `${s.total} Übungen` : "folgt",
}));

export const navUeben = {
  id: "ueben",
  href: "/uebungen",
  nameKey: "nav.subject.ueben",
  name: "Üben",
  columns: [
    { id: "grammatik", icon: "book", href: "/uebungen/grammatik",
      nameKey: "nav.subject.grammatik", name: "Grammatik",
      items: itemsOf("grammatik") },
    { id: "wortschatz", icon: "folder", href: "/uebungen/wortschatz",
      nameKey: "nav.subject.wortschatz", name: "Wortschatz",
      items: itemsOf("woerter") },
    { id: "fertigkeiten", icon: "mic", href: "/uebungen/fertigkeiten",
      nameKey: "nav.subject.fertigkeiten", name: "Fertigkeiten",
      items: skillColumnItems },
    { id: "landeskunde", icon: "map-pin", href: "/uebungen/kultur",
      nameKey: "group.kultur.name", name: "Landeskunde",
      items: [...itemsOf("kultur"), kulturQuizItem] },
  ],
  // A CEFR level is a filter over all four columns, not a fifth column and not a
  // destination of its own — which is what "Niveaus" as a top-level menu made it, a
  // second copy of the whole content tree. One chip row under the columns says the same
  // thing in one line.
  levels: levels.map((lv) => ({
    level: lv.level,
    slug: lv.slug,
    href: `/uebungen/grammatik#niveau-${lv.slug}`,
    blurbKey: lv.blurbKey,
    blurb: lv.blurb,
  })),
};

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
import artikel from "../data/artikel.json";
import grammatik from "../data/grammatik.json";
import wortschatz from "../data/wortschatz.json";
import sprechen from "../data/sprechen.json";
import lesen from "../data/lesen.json";
import kultur from "../data/kultur.json";
import lid from "../data/leben-in-deutschland.json";
import verbenPraepositionen from "../data/grammatik/verben-praepositionen.json";

const grammarQuestionCount = grammatik.reduce((sum, t) => sum + t.questions.length, 0);
const readingQuestionCount = lesen.groups.reduce((sum, g) => sum + g.questions.length, 0);
const prepositionVerbCount = verbenPraepositionen.concept.reference.boxes.reduce((n, b) => n + b.items.length, 0);
const artikelNounCount = asArtikelRows({ level: ["A1", "A2"] }).length;
const kulturTopicCount = kultur.topics.length;
const kulturQuizCount = kultur.topics.reduce((n, t) => n + t.quiz.length, 0);

/* The Landeskunde menu's entries: the quiz first, because it is the one thing that
   spans every topic, then the topics in the hub's own order. No i18n keys — topic
   titles live in kultur.json and are not translated yet, so they render as written. */
const kulturQuizItem = {
  id: "kultur-quiz", href: "/uebungen/kultur/quiz", icon: "target",
  title: "Quiz über alle Themen", count: `${kulturQuizCount} Fragen`,
};

const kulturItem = (t) => ({
  id: `kultur-${t.id}`,
  href: `/uebungen/kultur/${t.id}`,
  icon: t.icon,
  title: t.title,
  count: `${t.level} · ${t.quiz.length} Fragen`,
});

/* Fifteen topics in one list is a wall: the menu needed a scrollbar in both directions and
   nothing in it could be found by scanning. They divide cleanly into five things a learner
   would go looking for, so `group` now lives on each topic in kultur.json and the order of
   the sub-sections is set here.

   Ordered by how soon a newcomer meets them, not alphabetically — registering with the
   Amt comes before joining a Verein. */
const KULTUR_GROUPS = [
  { id: "wohnen", name: "Wohnen & Alltag", nameKey: "nav.kultur.wohnen" },
  { id: "aemter", name: "Ämter & Versicherung", nameKey: "nav.kultur.aemter" },
  { id: "umgang", name: "Umgang & Gewohnheiten", nameKey: "nav.kultur.umgang" },
  { id: "bildung", name: "Schule & Ausbildung", nameKey: "nav.kultur.bildung" },
  { id: "land", name: "Land & Kalender", nameKey: "nav.kultur.land" },
];

const kulturNavGroups = KULTUR_GROUPS.map((g) => ({
  ...g,
  items: kultur.topics.filter((t) => t.group === g.id).map(kulturItem),
}));

// Loud rather than silent: a topic added to kultur.json without a `group` would otherwise
// just quietly stop appearing in the menu.
const ungrouped = kultur.topics.filter((t) => !KULTUR_GROUPS.some((g) => g.id === t.group));
if (ungrouped.length) {
  throw new Error(`kultur.json: kein bekanntes group-Feld für ${ungrouped.map((t) => t.id).join(", ")}`);
}

const kulturNavItems = [kulturQuizItem, ...kultur.topics.map(kulturItem)];

export const lexiconCounts = counts();

export const tools = [
  { id: "artikel", group: "grammatik", href: "/uebungen/artikel-trainer", icon: "target",
    titleKey: "tool.artikel.title", title: "der/die/das-Trainer", shortKey: "group.short.artikel", short: "Artikel",
    descKey: "tool.artikel.desc", desc: "Artikel gezielt üben, mit sofortigem Feedback.",
    countKey: "tool.artikel.count", countVars: { n: artikelNounCount }, count: `${artikelNounCount} Nomen` },
  { id: "grammatik", group: "grammatik", href: "/uebungen/grammatik", icon: "book",
    titleKey: "tool.grammatik.title", title: "Grammatik", shortKey: "tool.grammatik.title", short: "Grammatik",
    descKey: "tool.grammatik.desc", desc: "Themen nach Niveau: Akkusativ, Dativ, Passiv und mehr.",
    countKey: "tool.grammatik.count", countVars: { n: grammatik.length, q: grammarQuestionCount }, count: `${grammatik.length} Themen · ${grammarQuestionCount} Fragen` },
  { id: "praep", group: "grammatik", href: "/uebungen/grammatik/verben-praepositionen", icon: "link",
    titleKey: "tool.praepositionen.title", title: "Verben mit Präpositionen", shortKey: "group.short.praep", short: "Präpositionen",
    descKey: "tool.praepositionen.desc", desc: "Feste Präpositionen in fünf Aufgabentypen üben.",
    countKey: "tool.praepositionen.count", countVars: { n: prepositionVerbCount }, count: `${prepositionVerbCount} Verben` },
  { id: "wortschatz", group: "woerter", href: "/uebungen/wortschatz", icon: "folder",
    titleKey: "tool.wortschatz.title", title: "Wortschatz & Redemittel", shortKey: "group.short.wortschatz", short: "Wortschatz",
    descKey: "tool.wortschatz.desc", desc: "Karteikarten zum Umdrehen und Wiederholen.",
    countKey: "tool.wortschatz.count", countVars: { n: wortschatz.length }, count: `${wortschatz.length} Karten` },
  { id: "aussprache", group: "woerter", href: "/uebungen/aussprache", icon: "volume",
    titleKey: "tool.aussprache.title", title: "Aussprache-Training", shortKey: "group.short.aussprache", short: "Aussprache",
    descKey: "tool.aussprache.desc", desc: "Wörter anhören und im Langsam-Modus üben.",
    countKey: "tool.aussprache.count", countVars: { n: wortschatz.length + artikel.length }, count: `${wortschatz.length + artikel.length} Wörter` },
  { id: "sprechen", group: "fertigkeiten", href: "/uebungen/sprechen", icon: "mic",
    titleKey: "tool.sprechen.title", title: "Sprechen: Bildbeschreibung", shortKey: "group.short.sprechen", short: "Sprechen",
    descKey: "tool.sprechen.desc", desc: "Echte DTZ-Prüferfragen, mit 90-Sekunden-Timer.",
    countKey: "tool.sprechen.count", countVars: { n: sprechen.length }, count: `${sprechen.length} Bilder` },
  { id: "lesen", group: "fertigkeiten", href: "/uebungen/lesen-schreiben", icon: "pencil",
    titleKey: "tool.lesen.title", title: "Lesen & Schreiben", shortKey: "group.short.lesen", short: "Lesen",
    descKey: "tool.lesen.desc", desc: "DTZ-Leseverstehen-Simulation plus Schreibaufgaben.",
    countKey: "tool.lesen.count", countVars: { n: readingQuestionCount }, count: `${readingQuestionCount} Aufgaben` },
  { id: "kultur", group: "kultur", href: "/uebungen/kultur", icon: "map-pin",
    titleKey: "tool.kultur.title", title: "Kulturwissen", shortKey: "group.short.kultur", short: "Kultur",
    descKey: "tool.kultur.desc", desc: "Wie Deutschland im Alltag funktioniert — mit Quiz.",
    countKey: "tool.kultur.count", countVars: { n: kulturTopicCount, q: kulturQuizCount },
    count: `${kulturTopicCount} Themen · ${kulturQuizCount} Fragen` },
];

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

const workspaceModules = import.meta.glob("../data/grammatik/*.json", { eager: true });
const workspaces = Object.values(workspaceModules).map((m) => m.default ?? m);
const workspaceIds = new Set(workspaces.map((w) => w.id));

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

const LEVEL_BLURB = {
  A1: "Erste Sätze",
  A2: "Alltag auf Deutsch",
  B1: "Selbstständig sprechen",
  B2: "Sicher argumentieren",
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
      href: `/uebungen/artikel-trainer?niveau=${level}`, count: `${genderedNouns} Nomen` });
  }
  if (words) {
    vocab.push({ id: "wortschatz", icon: "folder", title: `Wortliste ${level}`,
      href: `/uebungen/wortschatz/${slug}`, count: `${words} Wörter` });
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

// ---------------------------------------------------------------------------
// The nav's subject menus
// ---------------------------------------------------------------------------
// A section renders as a flat list unless it carries `groups`, in which case the panel and
// the drawer show sub-headings instead. Long menus earned this: Landeskunde's fifteen topics
// in one column ran off the bottom of a 900px screen, and the two-column scrolling patch that
// replaced it scrolled in both directions and still could not be scanned.
//
// `items` stays the flat union either way — the drawer's row counts and anything else that
// only wants "how many things are in here" read it and do not care about the grouping.
//
// No section lists a link to its own page: the panel footer already goes there. "Grammatik ›
// Grammatik" was the same URL three times in one menu (the menu button, the row, and
// "Übersicht"), which reads as a bug even when it works.

const notSelf = (href, list) => list.filter((i) => i.href !== href);

const grammarLevelItems = () =>
  NAV_LEVELS.map((level) => {
    const slug = level.toLowerCase();
    const n = grammarTopics.filter((t) => t.level === level).length;
    return {
      id: `grammatik-${slug}`,
      href: `/uebungen/grammatik#niveau-${slug}`,
      icon: "book",
      title: level,
      countKey: "nav.level.topicCount",
      countVars: { n },
      count: `${n} Themen`,
    };
  });

const grammatikTrainer = notSelf("/uebungen/grammatik", itemsOf("grammatik"));

export const navSections = [
  { id: "grammatik", icon: "book", href: "/uebungen/grammatik",
    nameKey: "nav.subject.grammatik", name: "Grammatik",
    blurbKey: "group.grammatik.blurb", blurb: "Artikel, Fälle, Zeiten",
    groups: [
      { id: "trainer", name: "Trainer", nameKey: "nav.group.trainer", items: grammatikTrainer },
      // `inline`: the titles here are "A1", not "der/die/das-Trainer", so the count belongs
      // beside them rather than on a second line.
      { id: "themen", name: "Nach Niveau", nameKey: "nav.group.themen", inline: true, items: grammarLevelItems() },
    ],
    items: grammatikTrainer },

  { id: "wortschatz", icon: "folder", href: "/uebungen/wortschatz",
    nameKey: "nav.subject.wortschatz", name: "Wortschatz",
    blurbKey: "group.woerter.blurb", blurb: "Vokabeln hören und behalten",
    items: notSelf("/uebungen/wortschatz", itemsOf("woerter")) },

  // Was "Sprechen", which was simply not true of the second entry in it: "Lesen & Schreiben"
  // is a reading and writing trainer. "Fertigkeiten" is the word the Lehrwerke and the
  // Integrationskurse use for exactly this set, and it still fits when Hören lands here.
  { id: "fertigkeiten", icon: "mic", href: "/uebungen/sprechen",
    nameKey: "nav.subject.fertigkeiten", name: "Fertigkeiten",
    blurbKey: "nav.subject.fertigkeiten.blurb", blurb: "Sprechen, Lesen, Schreiben",
    items: notSelf("/uebungen/sprechen", itemsOf("fertigkeiten")) },

  { id: "landeskunde", icon: "map-pin", href: "/uebungen/kultur",
    nameKey: "group.kultur.name", name: "Landeskunde",
    blurbKey: "group.kultur.blurb", blurb: "Alltag und Kultur in Deutschland",
    // The quiz spans every group, so it sits above them rather than inside one.
    feature: kulturQuizItem,
    groups: kulturNavGroups,
    items: kulturNavItems },

  { id: "pruefungen", icon: "graduation-cap", href: "/pruefungen",
    nameKey: "nav.exams", name: "Prüfungen",
    blurbKey: "group.pruefungen.blurb", blurb: "telc, Goethe, TestDaF, DTZ",
    items: notSelf("/pruefungen", itemsOf("pruefungen")) },
];

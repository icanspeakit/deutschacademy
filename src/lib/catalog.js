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
    descKey: "tool.kultur.desc", desc: "Einblicke aus echten Unterrichtsgesprächen.",
    countKey: "tool.kultur.count", countVars: { n: kultur.length }, count: `${kultur.length} Thema${kultur.length === 1 ? "" : "n"}` },
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

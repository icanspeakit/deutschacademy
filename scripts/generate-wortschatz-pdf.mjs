// Builds the downloadable Wortlisten from the lexicon: one PDF per level, grouped by
// Lernset, with the article and plural folded into the word and an example sentence beside
// each entry.
//
//   pnpm generate:wortschatz-pdf
//
// Every word, translation and example comes from src/content/lexicon/*.json — the same data
// the flashcard trainer loads, so the list and the trainer can never disagree.
//
// IPA is deliberately left out. The lexicon has it for most words, but pdfkit's built-in
// fonts cannot draw ˈ ː ɐ̯ and would silently swallow them; a transcription with holes in it
// is worse than none. The pronunciation lives on the site, with audio.
import { statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { select } from "../src/lib/lexicon.js";
import { lernsets } from "../src/lib/lernsets.js";
import { createDoc, MUTED } from "./lib/pdf-brand.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "public", "downloads");

const LEVELS = ["A1", "A2", "B1", "B2"];
const LEVEL_BLURB = {
  A1: "Erste Sätze",
  A2: "Alltag auf Deutsch",
  B1: "Selbstständig sprechen",
  B2: "Sicher argumentieren",
};

const POS_LABEL = {
  noun: "Nomen",
  verb: "Verb",
  adj: "Adjektiv",
  adv: "Adverb",
  prep: "Präposition",
  konj: "Konjunktion",
  pron: "Pronomen",
  num: "Zahlwort",
  phrase: "Wendung",
};

/* The translated editions. Same list, the English column swapped for the learner's own
   language — a learner who does not read English was getting a German list glossed in a
   third language. The cover line is written in that language so the file says what it is
   to the person it is for; everything else stays German, because German is the subject.

   A level only gets an edition in a language that covers EVERY word in it: a list with
   holes in the translation column reads as a broken file. B2's sidecars are partial, so
   B2 has no editions until they are filled — the same rule langsOf() applies to the
   trainer's language tabs. */
const EDITIONS = {
  ar: {
    column: "Arabisch",
    rtl: true,
    cover: (level) => `قائمة المفردات الألمانية للمستوى ${level} مع الترجمة إلى العربية`,
  },
  ru: {
    column: "Russisch",
    cover: (level) => `Немецкий словарь уровня ${level} с переводом на русский язык`,
  },
  tr: {
    column: "Türkisch",
    cover: (level) => `${level} seviyesi Almanca kelime listesi, Türkçe çevirisiyle`,
  },
};

/** "der Name, die Namen" for a noun; the bare lemma for everything else. */
function headword(w) {
  if (w.pos === "noun") {
    const base = w.gender ? `${w.gender} ${w.lemma}` : w.lemma;
    return w.plural ? `${base}, die ${w.plural}` : base;
  }
  return w.lemma;
}

async function buildLevel(level, lang = null) {
  const words = select({ level });
  const ed = lang ? EDITIONS[lang] : null;
  if (ed && !words.every((w) => w[lang])) {
    const have = words.filter((w) => w[lang]).length;
    console.log(`wortschatz-${level.toLowerCase()}-${lang}.pdf  übersprungen: ${have}/${words.length} übersetzt`);
    return;
  }
  const sets = lernsets({ level, status: "built" });
  const fileName = `wortschatz-${level.toLowerCase()}${lang ? `-${lang}` : ""}.pdf`;
  const outPath = path.join(outDir, fileName);
  const pdf = createDoc({
    outPath,
    runningHead: `DEUTSCHACADEMY · WORTLISTE ${level}${ed ? ` · DEUTSCH–${ed.column.toUpperCase()}` : ""}`,
    unicode: Boolean(ed),
  });

  const withExample = words.filter((w) => w.example).length;

  pdf.cover({
    eyebrow: "DEUTSCHACADEMY · WORTSCHATZ",
    title: ed ? `Wortliste ${level} · Deutsch–${ed.column}` : `Wortliste ${level}`,
    subtitle: `${LEVEL_BLURB[level]} — der komplette Wortschatz dieses Niveaus, nach Lernsets geordnet.`,
    subtitleRtl: ed?.rtl,
    subtitleTranslated: ed?.cover(level),
    meta: [
      `${words.length} Wörter in ${sets.length} Lernsets`,
      `${withExample} Beispielsätze`,
      "Als Karteikarten mit Audio: deutschacademy.com/uebungen/wortschatz/" + level.toLowerCase(),
    ],
    footer:
      "Von DeutschAcademy geschrieben — von Lehrkräften, die wirklich unterrichten. Dieses PDF darfst du frei " +
      "herunterladen, ausdrucken und im Unterricht weitergeben. Kein Konto, keine Kosten.",
  });

  pdf.doc.addPage();
  pdf.h2("Inhalt");
  pdf.table(
    ["Lernset", "Thema", "Wörter"],
    sets.map((s) => [s.id.toUpperCase(), s.title, String(s.words)]),
    { widths: [70, pdf.contentWidth() - 140, 70] }
  );

  const w = pdf.contentWidth();
  for (const set of sets) {
    const items = words.filter((x) => x.unit === set.id);
    if (!items.length) continue;
    pdf.section(set.title, set.id.toUpperCase());
    pdf.paragraph(`${items.length} Wörter`, { color: MUTED, size: 9.5 });
    pdf.table(
      ["Wort", "Wortart", ed ? ed.column : "Englisch", "Beispiel"],
      items.map((x) => [headword(x), POS_LABEL[x.pos] ?? x.pos ?? "", (lang ? x[lang] : x.en) ?? "", x.example ?? ""]),
      {
        widths: [w * 0.27, w * 0.11, w * 0.2, w * 0.42],
        // The learner's own language is what they read the list by, so it is drawn in
        // ink rather than the muted grey the English gloss had.
        ...(ed && { inkCols: [2] }),
        ...(ed?.rtl && { rtl: [2] }),
      }
    );
  }

  await pdf.finish();
  const kb = Math.round(statSync(outPath).size / 1024);
  console.log(`${fileName.padEnd(26)} ${String(words.length).padStart(4)} Wörter  ${sets.length} Lernsets  ${kb} KB`);
}

for (const level of LEVELS) {
  await buildLevel(level);
  for (const lang of Object.keys(EDITIONS)) await buildLevel(level, lang);
}

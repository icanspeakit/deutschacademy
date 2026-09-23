// Builds the downloadable Grammatik books from the site's own grammar data:
// src/data/grammatik/*.json (the 21 workspaces) plus src/data/grammatik.json (the
// quiz-only topics). One book per level and one complete A1–B2 edition.
//
//   pnpm generate:grammatik-pdf
//
// A reference book, not a workbook. The exercises stay on the site, where they can mark an
// answer right or wrong; what a PDF is genuinely better at is the part a learner wants on
// paper next to them — the rule, an example, and the 41 reference tables (Partizipienliste,
// Wechselpräpositionen, Konnektoren …) that are tedious to scroll and useful to print.
//
// Everything here is written by DeutschAcademy. Nothing is scanned, copied or excerpted
// from a Lehrwerk, which is what makes these free to hand out.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createDoc, plain, MUTED, TEAL_DARK, TEAL_SOFT, INK, SURFACE } from "./lib/pdf-brand.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outDir = path.join(root, "public", "downloads");

const LEVELS = ["A1", "A2", "B1", "B2"];
const LEVEL_BLURB = {
  A1: "Erste Sätze",
  A2: "Alltag auf Deutsch",
  B1: "Selbstständig sprechen",
  B2: "Sicher argumentieren",
};

// --- Load -------------------------------------------------------------------

const wsDir = path.join(root, "src", "data", "grammatik");
const workspaces = readdirSync(wsDir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(path.join(wsDir, f), "utf8")));

const quizTopics = JSON.parse(readFileSync(path.join(root, "src", "data", "grammatik.json"), "utf8"));
const wsIds = new Set(workspaces.map((w) => w.id));

/** Workspaces first: a level should open with its fullest topic, not with a bare rule. */
const topics = [
  ...workspaces.map((w) => ({ kind: "workspace", ...w })),
  ...quizTopics.filter((t) => !wsIds.has(t.id)).map((t) => ({ kind: "quiz", ...t })),
];

// The rule in the learner's language — the same file the topic pages read
// (src/data/uebersetzungen/grammatik.json), so the site and the PDF never disagree.
const help = JSON.parse(readFileSync(path.join(root, "src", "data", "uebersetzungen", "grammatik.json"), "utf8"));

/* The translated editions: every German explanation is followed by its translation; the
   examples, tables and exercises stay German, because German is the subject. */
const EDITIONS = {
  en: { name: "Englisch", cover: (lv) => `German grammar ${lv} with explanations in English` },
  ar: { name: "Arabisch", rtl: true, cover: (lv) => `قواعد اللغة الألمانية ${lv} مع الشرح باللغة العربية` },
  uk: { name: "Ukrainisch", cover: (lv) => `Граматика німецької мови ${lv} з поясненнями українською` },
  tr: { name: "Türkisch", cover: (lv) => `${lv} Almanca dilbilgisi, Türkçe açıklamalarla` },
};

/** Whether a topic's every explained block has this language. A book goes out in a
    language only if all its topics do — half-translated reads as broken. */
function translatedIn(topic, lang) {
  const e = help.entries[topic.id];
  if (!e) return false;
  const intro = topic.kind === "quiz" ? topic.intro : topic.subtitle;
  if (intro && !e.intro?.[lang]) return false;
  const qa = topic.concept?.qa ?? [];
  if (qa.some((_, i) => !e.qa?.[i]?.[lang])) return false;
  if (topic.concept?.noteHtml && !e.note?.[lang]) return false;
  return true;
}

// --- Render one topic -------------------------------------------------------

function renderTopic(pdf, topic, { withBadge, lang = null }) {
  pdf.chapter(topic.name, withBadge ? topic.level : null);
  const ed = lang ? EDITIONS[lang] : null;
  const gx = lang ? help.entries[topic.id] : null;
  const tr = (block, opts = {}) => { if (block?.[lang]) pdf.translation(plain(block[lang]), { rtl: ed.rtl, ...opts }); };

  if (topic.subtitle) {
    pdf.paragraph(plain(topic.subtitle), { color: MUTED, size: 10 });
    tr(gx?.intro, { indent: 0 });
  }

  // A quiz-only topic is one paragraph of rule and that is all it has.
  if (topic.kind === "quiz") {
    if (topic.intro) {
      pdf.callout(plain(topic.intro));
      tr(gx?.intro, { indent: 0 });
    }
    const examples = (topic.questions ?? []).slice(0, 8);
    if (examples.length) {
      pdf.h2("Beispiele");
      pdf.table(
        ["Satz", "Lösung"],
        examples.map((q) => [plain(q.prompt).replace(/_{2,}/g, "______"), q.answer]),
        { widths: [pdf.contentWidth() * 0.72, pdf.contentWidth() * 0.28] }
      );
    }
    return;
  }

  const c = topic.concept ?? {};

  // The sentence-shape strip: "haben/sein > Position 2 > … > Partizip II · Ende".
  // Some flows already carry the arrow inside an item ("→ kein"), some do not, so the
  // separator is added and then any doubled arrow collapsed — otherwise Negation prints
  // "Artikel > > kein".
  if (c.flow?.length) {
    pdf.h2("Satzbau");
    const strip = c.flow.map((f) => plain(f.text)).join("   →   ").replace(/→\s*→/g, "→");
    pdf.callout(strip, { bold: true, fill: TEAL_SOFT });
  }

  if (c.exampleHtml) {
    pdf.paragraph(plain(c.exampleHtml), { italic: true, color: TEAL_DARK, size: 11 });
    pdf.doc.moveDown(0.3);
  }

  if (c.qa?.length) {
    pdf.h2("Die Regel");
    c.qa.forEach((item, i) => {
      const tag = item.tag ? `${plain(item.tag)} — ` : "";
      pdf.bullet(tag + plain(item.html ?? item.text));
      tr(gx?.qa?.[i]);
    });
  }

  if (c.noteHtml) {
    pdf.doc.moveDown(0.3);
    pdf.callout(plain(c.noteHtml), { fill: SURFACE, size: 10 });
    tr(gx?.note, { indent: 0 });
  }

  // The reason to print this at all.
  for (const t of c.reference?.tables ?? []) {
    pdf.h2(plain(t.caption) || "Übersicht");
    pdf.table(t.head.map(plain), t.rows.map((r) => r.map(plain)));
  }

  // `boxes` is the other reference shape: a `badge` over a list of examples. The badge is
  // the heading — there is no `title` on these, and falling back to a generic one printed
  // "Übersicht" five times in a row on the Negation chapter.
  for (const box of c.reference?.boxes ?? []) {
    if (box.badge) pdf.h2(plain(box.badge));
    for (const item of box.items ?? []) {
      pdf.bullet(typeof item === "string" ? plain(item) : plain(item.html ?? item.text ?? ""));
    }
  }

  // Only the table exercises come along: term → answer prints as a study list. The other
  // four types (fill, match, story, build) are interactions, and an interaction flattened
  // onto paper is just its answer key.
  const printable = (topic.exercises ?? []).filter((e) => e.type === "table" && e.rows?.length);
  for (const ex of printable) {
    pdf.h2(`Übung: ${plain(ex.title)}`);
    if (ex.hint) pdf.paragraph(plain(ex.hint), { color: MUTED, size: 9.5 });
    pdf.table(
      (ex.columns ?? ["", "Lösung"]).map(plain),
      ex.rows.map((r) => [plain(r.term), plain(r.answer)])
    );
  }
}

// --- Build one book ---------------------------------------------------------

async function buildBook({ level, fileName, lang = null }) {
  const list = level ? topics.filter((t) => t.level === level) : topics;
  // A1 first, then A2 … inside the complete edition; a single-level book keeps file order.
  const ordered = level
    ? list
    : LEVELS.flatMap((lv) => list.filter((t) => t.level === lv));

  const ed = lang ? EDITIONS[lang] : null;
  if (ed) {
    const missing = ordered.filter((t) => !translatedIn(t, lang));
    if (missing.length) {
      console.log(`${fileName.padEnd(34)} übersprungen: ${missing.length} Themen ohne ${ed.name}`);
      return;
    }
  }
  const baseTitle = level ? `Grammatik ${level}` : "Grammatik A1–B2";
  const title = ed ? `${baseTitle} · Deutsch–${ed.name}` : baseTitle;
  const outPath = path.join(outDir, fileName);
  const pdf = createDoc({ outPath, runningHead: `DEUTSCHACADEMY · ${title.toUpperCase()}`, unicode: Boolean(ed) });
  const unreviewed = ed && ordered.some((t) => !help.entries[t.id]?.reviewed);

  const tableCount = ordered.reduce((n, t) => n + (t.concept?.reference?.tables?.length ?? 0), 0);

  pdf.cover({
    eyebrow: "DEUTSCHACADEMY · GRAMMATIK",
    title,
    subtitle: level
      ? `${LEVEL_BLURB[level]} — alle Grammatikthemen dieses Niveaus zum Nachschlagen und Ausdrucken.`
      : "Alle Grammatikthemen von A1 bis B2 in einem Band, zum Nachschlagen und Ausdrucken.",
    subtitleTranslated: ed?.cover(level ?? "A1–B2"),
    subtitleRtl: ed?.rtl,
    meta: [
      ...(ed ? [`Jede Regel mit Erklärung auf ${ed.name}; Beispiele und Tabellen bleiben deutsch`] : []),
      ...(unreviewed ? [`Die Erklärungen auf ${ed.name} sind ein maschineller Entwurf, noch nicht von einer Lehrkraft geprüft`] : []),
      `${ordered.length} Themen${level ? "" : ` auf vier Niveaus (${LEVELS.join(", ")})`}`,
      `${tableCount} Übersichtstabellen zum Nachschlagen`,
      "Die Übungen dazu stehen kostenlos auf deutschacademy.com/uebungen/grammatik",
    ],
    footer:
      "Von DeutschAcademy geschrieben — von Lehrkräften, die wirklich unterrichten. Dieses PDF darfst du frei " +
      "herunterladen, ausdrucken und im Unterricht weitergeben. Kein Konto, keine Kosten.",
  });

  // Contents.
  pdf.doc.addPage();
  pdf.h2("Inhalt");
  pdf.table(
    level ? ["Thema"] : ["Niveau", "Thema"],
    ordered.map((t) => (level ? [t.name] : [t.level, t.name])),
    level ? {} : { widths: [70, pdf.contentWidth() - 70] }
  );

  for (const topic of ordered) renderTopic(pdf, topic, { withBadge: !level, lang });

  await pdf.finish();
  const kb = Math.round(statSync(outPath).size / 1024);
  console.log(`${fileName.padEnd(34)} ${String(ordered.length).padStart(2)} Themen  ${kb} KB`);
}

for (const lang of [null, ...Object.keys(EDITIONS)]) {
  const suffix = lang ? `-${lang}` : "";
  for (const level of LEVELS) {
    await buildBook({ level, lang, fileName: `grammatik-${level.toLowerCase()}${suffix}.pdf` });
  }
  await buildBook({ level: null, lang, fileName: `grammatik-a1-b2-komplett${suffix}.pdf` });
}

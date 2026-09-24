// Generates the downloadable "Leben in Deutschland" facts PDFs from
// src/data/leben-in-deutschland.json — the standard version and a parallel "in einfachem
// Deutsch" (A1–A2) version built from the same data's *Easy fields. Re-run after editing that
// file or this script:
//   node scripts/generate-fakten-pdf.mjs
//
// Both versions also go out in en/ar/uk/tr (…-fakten-en.pdf, …-fakten-einfach-ar.pdf):
// every German fact followed by its translation from src/data/uebersetzungen/
// leben-in-deutschland.json — the file the facts page reads. Those editions are drawn with
// scripts/lib/pdf-brand.mjs, whose Noto fonts can draw Arabic and Cyrillic; Helvetica here
// cannot. A language that misses a single fact gets no edition.
import PDFDocument from "pdfkit";
import { createWriteStream, mkdirSync, existsSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import lid from "../src/data/leben-in-deutschland.json" with { type: "json" };
import help from "../src/data/uebersetzungen/leben-in-deutschland.json" with { type: "json" };
import { createDoc } from "./lib/pdf-brand.mjs";

const { meta, topics, glossary, bundeslaender } = lid;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "public", "downloads");
mkdirSync(outDir, { recursive: true });

// Brand palette, matching src/styles/global.css.
const TEAL = "#0d9488";
const TEAL_DARK = "#0f766e";
const TEAL_SOFT = "#ccfbf1";
const INK = "#1a2230";
const MUTED = "#4b5768";
const BORDER = "#e7e9ee";
const SURFACE = "#f7f8fa";
const MARGIN = 56;

const MODES = {
  standard: {
    fileName: "leben-in-deutschland-fakten.pdf",
    eyebrow: "DEUTSCHACADEMY · PRÜFUNGSVORBEREITUNG",
    title: "Leben in Deutschland: Fakten",
    subtitle: "Bundesweite Fakten aus echtem Unterrichtsmaterial, gegliedert nach Themen, plus die Grunddaten zu allen 16 Bundesländern.",
    sourceNote: meta.sourceNote,
    stateFactsNote: meta.stateFactsNote,
    factsKey: "facts",
    defKey: "def",
    sourceFactsKey: "sourceFacts",
  },
  easy: {
    fileName: "leben-in-deutschland-fakten-einfach.pdf",
    eyebrow: "DEUTSCHACADEMY · EINFACHE SPRACHE (A1–A2)",
    title: "Leben in Deutschland: Fakten — in einfachem Deutsch",
    subtitle: "Diese Fakten sind in einfacher Sprache geschrieben. Sie helfen dir, wichtige Wörter und Themen zu verstehen — auf dem Niveau A1 bis A2.",
    sourceNote: meta.sourceNoteEasy,
    stateFactsNote: meta.stateFactsNoteEasy,
    factsKey: "factsEasy",
    defKey: "defEasy",
    sourceFactsKey: "sourceFactsEasy",
  },
};

for (const mode of Object.values(MODES)) {
  buildPdf(mode);
}

function buildPdf(mode) {
  const outPath = path.join(outDir, mode.fileName);
  const doc = new PDFDocument({ size: "A4", margin: MARGIN, bufferPages: true });
  doc.pipe(createWriteStream(outPath));

  // Running header on every page after the cover, drawn on 'pageAdded' so it also applies to
  // pages created mid-table (see drawTable) and the landscape Bundesländer page.
  let pageCount = 0;
  doc.on("pageAdded", () => {
    pageCount += 1;
    if (pageCount === 1) return;
    doc.fillColor(MUTED).font("Helvetica").fontSize(8).text(
      "LEBEN IN DEUTSCHLAND · FAKTEN",
      MARGIN,
      28,
      { characterSpacing: 0.6 }
    );
    doc.moveTo(MARGIN, 44).lineTo(doc.page.width - MARGIN, 44).strokeColor(BORDER).lineWidth(0.75).stroke();
    doc.x = MARGIN;
    doc.y = 60;
  });

  function contentBottom() {
    return doc.page.height - doc.page.margins.bottom;
  }

  function ensureSpace(height) {
    if (doc.y + height > contentBottom()) doc.addPage();
  }

  function h2(text) {
    ensureSpace(40);
    doc.moveDown(0.8);
    const y = doc.y;
    doc.rect(MARGIN, y + 2, 3, 14).fill(TEAL);
    doc.fillColor(TEAL_DARK).font("Helvetica-Bold").fontSize(14).text(text, MARGIN + 12, y, {
      width: doc.page.width - doc.page.margins.right - (MARGIN + 12),
    });
    doc.x = MARGIN;
    doc.moveDown(0.25);
    doc.moveTo(MARGIN, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).strokeColor(BORDER).lineWidth(0.75).stroke();
    doc.moveDown(0.5);
    doc.x = MARGIN;
  }

  function fact(text) {
    const bulletWidth = 12;
    ensureSpace(14);
    const y = doc.y;
    doc.fillColor(TEAL).font("Helvetica-Bold").fontSize(10.25).text("•", MARGIN, y, { width: bulletWidth });
    doc.fillColor(INK).font("Helvetica").fontSize(10.25).text(text, MARGIN + bulletWidth, y, {
      width: doc.page.width - doc.page.margins.right - (MARGIN + bulletWidth),
      lineGap: 2,
    });
    doc.x = MARGIN;
    doc.moveDown(0.35);
  }

  function paragraph(text, opts = {}) {
    ensureSpace(14);
    doc.fillColor(opts.color || MUTED).font(opts.bold ? "Helvetica-Bold" : "Helvetica").fontSize(opts.size || 9.5).text(text, MARGIN, doc.y, {
      width: doc.page.width - doc.page.margins.right - MARGIN,
      lineGap: 2,
      paragraphGap: 6,
      ...opts.textOpts,
    });
    doc.x = MARGIN;
  }

  // Generic bordered/striped table. Columns: [{ key, label, width }]. Rows: [{ [key]: value }].
  // Re-draws the header row whenever a row would overflow onto a new page.
  function drawTable(columns, rows, opts = {}) {
    const fontSize = opts.fontSize ?? 9;
    const headerHeight = opts.headerHeight ?? 22;
    const rowPadding = opts.rowPadding ?? 6;
    const startX = MARGIN;
    const totalWidth = columns.reduce((sum, c) => sum + c.width, 0);
    let y = doc.y;

    function drawHeader() {
      doc.rect(startX, y, totalWidth, headerHeight).fill(TEAL_SOFT);
      let x = startX;
      doc.font("Helvetica-Bold").fontSize(fontSize).fillColor(TEAL_DARK);
      for (const col of columns) {
        doc.text(col.label, x + 6, y + headerHeight / 2 - fontSize / 2 - 1, { width: col.width - 10 });
        x += col.width;
      }
      y += headerHeight;
    }

    drawHeader();

    rows.forEach((row, i) => {
      doc.font("Helvetica").fontSize(fontSize);
      let maxH = 0;
      for (const col of columns) {
        const h = doc.heightOfString(String(row[col.key] ?? ""), { width: col.width - 10, lineGap: 1 });
        if (h > maxH) maxH = h;
      }
      const rowHeight = maxH + rowPadding * 2;

      if (y + rowHeight > contentBottom()) {
        doc.addPage();
        y = doc.y;
        drawHeader();
      }

      if (i % 2 === 1) doc.rect(startX, y, totalWidth, rowHeight).fill(SURFACE);

      let x = startX;
      doc.font("Helvetica").fontSize(fontSize).fillColor(INK);
      for (const col of columns) {
        doc.text(String(row[col.key] ?? ""), x + 6, y + rowPadding, { width: col.width - 10, lineGap: 1 });
        x += col.width;
      }
      doc.moveTo(startX, y + rowHeight).lineTo(startX + totalWidth, y + rowHeight).strokeColor(BORDER).lineWidth(0.5).stroke();
      y += rowHeight;
    });

    doc.rect(startX, doc.y, totalWidth, y - doc.y).strokeColor(BORDER).lineWidth(0.75).stroke();
    doc.x = MARGIN;
    doc.y = y + 12;
  }

  // Two-up glossary layout (alternating left/right column per entry) instead of one long stack.
  function drawGlossary(entries) {
    const gutter = 28;
    const colWidth = (doc.page.width - MARGIN * 2 - gutter) / 2;
    const leftX = MARGIN;
    const rightX = MARGIN + colWidth + gutter;
    let leftY = doc.y;
    let rightY = doc.y;
    let col = 0;

    for (const g of entries) {
      const def = g[mode.defKey];
      doc.font("Helvetica-Bold").fontSize(10.25);
      const termH = doc.heightOfString(g.term, { width: colWidth });
      doc.font("Helvetica").fontSize(9.5);
      const defH = doc.heightOfString(def, { width: colWidth, lineGap: 1 });
      const needed = termH + defH + 14;

      let x = col === 0 ? leftX : rightX;
      let y = col === 0 ? leftY : rightY;

      if (y + needed > contentBottom()) {
        doc.addPage();
        leftY = doc.y;
        rightY = doc.y;
        col = 0;
        x = leftX;
        y = leftY;
      }

      doc.fillColor(TEAL_DARK).font("Helvetica-Bold").fontSize(10.25).text(g.term, x, y, { width: colWidth });
      const afterTerm = doc.y + 1;
      doc.fillColor(INK).font("Helvetica").fontSize(9.5).text(def, x, afterTerm, { width: colWidth, lineGap: 1 });
      const endY = doc.y + 12;

      if (col === 0) { leftY = endY; col = 1; } else { rightY = endY; col = 0; }
    }

    doc.x = MARGIN;
    doc.y = Math.max(leftY, rightY);
  }

  // --- Cover ---
  doc.rect(0, 0, doc.page.width, 130).fill(TEAL_DARK);
  doc.fillColor("#ffffff").font("Helvetica").fontSize(9.5).text(mode.eyebrow, MARGIN, 38, { characterSpacing: 0.6 });
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(mode === MODES.easy ? 19 : 23).text(mode.title, MARGIN, 58, {
    width: doc.page.width - MARGIN * 2,
  });
  doc.x = MARGIN;
  doc.y = 158;

  doc.fillColor(INK).font("Helvetica").fontSize(11).text(mode.subtitle, MARGIN, doc.y, {
    width: doc.page.width - MARGIN * 2,
    lineGap: 2,
    paragraphGap: 10,
  });
  doc.x = MARGIN;

  const noteWidth = doc.page.width - MARGIN * 2 - 24;
  doc.font("Helvetica").fontSize(8.5);
  const noteHeight = doc.heightOfString(mode.sourceNote, { width: noteWidth, lineGap: 2 }) + 22;
  const noteY = doc.y + 4;
  doc.roundedRect(MARGIN, noteY, doc.page.width - MARGIN * 2, noteHeight, 5).fill(SURFACE);
  doc.fillColor(MUTED).font("Helvetica").fontSize(8.5).text(mode.sourceNote, MARGIN + 12, noteY + 11, { width: noteWidth, lineGap: 2 });
  doc.x = MARGIN;
  doc.y = noteY + noteHeight + 18;

  // --- Testformat ---
  h2("Testformat");
  const availW = doc.page.width - MARGIN * 2;
  drawTable(
    [
      { key: "label", label: "Teil", width: availW * 0.55 },
      { key: "value", label: "Umfang", width: availW * 0.45 },
    ],
    [
      { label: "Bundesweiter Teil", value: `${meta.federalQuestions} von ${meta.totalQuestions} Fragen` },
      { label: "Landesspezifischer Teil", value: `${meta.stateQuestions} von ${meta.totalQuestions} Fragen` },
      { label: "Zeit", value: `${meta.minutes} Minuten` },
      { label: "Bestehen ab", value: `${meta.passScore} richtigen Antworten` },
    ],
    { fontSize: 10 }
  );

  // --- Topics ---
  for (const t of topics) {
    h2(t.title);
    for (const f of t[mode.factsKey]) fact(f);
  }

  // --- Glossary ---
  h2("Glossar");
  drawGlossary(glossary);

  // --- Bundesländer: landscape reference table (16 rows × 7 facts needs the extra width). The
  // core facts (capital, population, borders, …) are short proper nouns/numbers already, so this
  // table is identical in both modes — only the footnote text below it changes. ---
  doc.addPage({ size: "A4", layout: "landscape" });
  h2("Die 16 Bundesländer");
  paragraph(mode.stateFactsNote, { size: 9 });
  doc.moveDown(0.3);

  const landW = doc.page.width - MARGIN * 2;
  const stateColumns = [
    { key: "name", label: "Bundesland", width: landW * 0.15 },
    { key: "capital", label: "Hauptstadt", width: landW * 0.13 },
    { key: "type", label: "Typ", width: landW * 0.12 },
    { key: "population", label: "Einwohner", width: landW * 0.12 },
    { key: "borders", label: "Grenzt an (Ausland)", width: landW * 0.19 },
    { key: "parliamentName", label: "Landesparlament", width: landW * 0.16 },
    { key: "executiveTitle", label: "Regierungschef/in", width: landW * 0.13 },
  ];
  const stateRows = bundeslaender.map((l) => ({
    name: l.sourced ? `${l.name} *` : l.name,
    capital: l.capital,
    type: l.type,
    population: l.population,
    borders: l.borderCountries.length ? l.borderCountries.join(", ") : "—",
    parliamentName: l.parliamentName,
    executiveTitle: l.executiveTitle,
  }));
  drawTable(stateColumns, stateRows, { fontSize: 8.5 });
  paragraph("* Grunddaten aus echtem DeutschAcademy-Unterrichtsmaterial (Bayern). Alle anderen Bundesländer: allgemein bekannte, öffentliche Fakten, keine DeutschAcademy-Quelle.", { size: 8 });

  // --- Bayern deep dive (the only state with extra sourced facts) — back to portrait ---
  const bayern = bundeslaender.find((l) => l.id === "bayern");
  const bayernFacts = bayern?.[mode.sourceFactsKey];
  if (bayernFacts?.length) {
    doc.addPage();
    h2("Vertiefung: Bayern");
    paragraph("Aus echtem DeutschAcademy-Unterrichtsmaterial.", { size: 9 });
    doc.moveDown(0.2);
    for (const f of bayernFacts) fact(f);
  }

  // --- Footer with page numbers (skips the cover) ---
  // Drawing this close to the bottom edge would normally trip pdfkit's automatic page-break (it
  // thinks the text overflows the margin and silently inserts a blank page) — zeroing the bottom
  // margin for the duration of each call avoids that.
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    if (i === 0) continue;
    const bottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.fillColor(MUTED).font("Helvetica").fontSize(8).text(
      `deutschacademy.com/pruefungen/leben-in-deutschland/fakten · Seite ${i + 1} von ${range.count}`,
      MARGIN,
      doc.page.height - 36,
      { align: "center", width: doc.page.width - MARGIN * 2 }
    );
    doc.page.margins.bottom = bottomMargin;
  }

  // Record pages and size for the Wissensdatenbank, the same way the newer generators do
  // (see scripts/lib/pdf-brand.mjs) — otherwise these five are the only downloads on /wissen
  // that cannot say how long they are.
  const pages = doc.bufferedPageRange().count;
  const stream = doc.pipes?.[0];
  doc.end();
  const record = () => {
    const file = path.join(outDir, "manifest.json");
    const all = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
    all[mode.fileName] = { pages, bytes: statSync(outPath).size };
    const sorted = Object.fromEntries(Object.keys(all).sort().map((k) => [k, all[k]]));
    writeFileSync(file, JSON.stringify(sorted, null, 2) + "\n", "utf8");
    console.log(`PDF written to ${outPath} (${pages} Seiten)`);
  };
  if (stream) stream.on("finish", record);
  else record();
}

// --- Translated editions ------------------------------------------------------

const EDITIONS = {
  en: { name: "Englisch", cover: "Facts for the “Leben in Deutschland” test, explained in English" },
  ar: { name: "Arabisch", rtl: true, cover: "حقائق اختبار «الحياة في ألمانيا» مع الشرح بالعربية" },
  uk: { name: "Ukrainisch", cover: "Факти до тесту «Leben in Deutschland» з поясненнями українською" },
  tr: { name: "Türkisch", cover: "„Leben in Deutschland“ testi için bilgiler, Türkçe açıklamalarla" },
};

/** Every German string this mode prints, paired with where its translation lives. The
    edition is built only if each one has it — half a translation reads as broken. */
function missingIn(mode, lang) {
  const easy = mode === MODES.easy;
  const miss = [];
  const has = (obj, i) => (i == null ? obj?.[lang] : obj?.[lang]?.[i]);
  if (!has(help.meta?.[easy ? "sourceNoteEasy" : "sourceNote"])) miss.push("sourceNote");
  if (!has(help.meta?.[easy ? "stateFactsNoteEasy" : "stateFactsNote"])) miss.push("stateFactsNote");
  for (const t of topics) {
    const tx = help.topics?.[t.id];
    if (!has(tx?.title)) miss.push(`${t.id}.title`);
    t[mode.factsKey].forEach((_, i) => { if (!has(tx?.[mode.factsKey], i)) miss.push(`${t.id}.${i}`); });
  }
  for (const g of glossary) if (!has(help.glossary?.[g.term]?.[mode.defKey])) miss.push(g.term);
  const bayern = bundeslaender.find((l) => l.id === "bayern");
  (bayern?.[mode.sourceFactsKey] ?? []).forEach((_, i) => {
    if (!has(help.bayern?.[mode.sourceFactsKey], i)) miss.push(`bayern.${i}`);
  });
  return miss;
}

async function buildEdition(mode, lang) {
  const ed = EDITIONS[lang];
  const fileName = mode.fileName.replace(/\.pdf$/, `-${lang}.pdf`);
  const missing = missingIn(mode, lang);
  if (missing.length) {
    console.log(`${fileName.padEnd(46)} übersprungen: ${missing.length} Texte ohne ${ed.name}`);
    return;
  }
  const easy = mode === MODES.easy;
  const outPath = path.join(outDir, fileName);
  const pdf = createDoc({
    outPath,
    runningHead: `LEBEN IN DEUTSCHLAND · FAKTEN${easy ? " · EINFACH" : ""} · DEUTSCH–${ed.name.toUpperCase()}`,
    unicode: true,
  });
  const tr = (text) => pdf.translation(text, { rtl: ed.rtl });

  pdf.cover({
    eyebrow: `${mode.eyebrow} · DEUTSCH–${ed.name.toUpperCase()}`,
    title: easy ? "Leben in Deutschland: Fakten (einfach)" : mode.title,
    subtitle: mode.subtitle,
    subtitleTranslated: ed.cover,
    subtitleRtl: ed.rtl,
    meta: [
      `Jeder Fakt auf Deutsch, darunter auf ${ed.name} — der Test selbst ist auf Deutsch`,
      ...(help.reviewed ? [] : [`Die Übersetzung ins ${ed.name}e ist ein maschineller Entwurf, noch nicht von einer Lehrkraft geprüft`]),
      `${topics.length} Themen, ${glossary.length} Begriffe im Glossar, alle 16 Bundesländer`,
      "Der Übungstest dazu steht kostenlos auf deutschacademy.com/pruefungen/leben-in-deutschland",
    ],
    footer: "Von DeutschAcademy geschrieben. Dieses PDF darfst du frei herunterladen, ausdrucken und im Unterricht weitergeben.",
  });

  pdf.doc.addPage();
  pdf.h2("Über die Quelle");
  pdf.paragraph(mode.sourceNote, { size: 9.5, color: MUTED });
  tr(help.meta[easy ? "sourceNoteEasy" : "sourceNote"][lang]);

  pdf.h2("Testformat");
  pdf.table(["Teil", "Umfang"], [
    ["Bundesweiter Teil", `${meta.federalQuestions} von ${meta.totalQuestions} Fragen`],
    ["Landesspezifischer Teil", `${meta.stateQuestions} von ${meta.totalQuestions} Fragen`],
    ["Zeit", `${meta.minutes} Minuten`],
    ["Bestehen ab", `${meta.passScore} richtigen Antworten`],
  ]);

  for (const t of topics) {
    const tx = help.topics[t.id];
    pdf.section(t.title);
    tr(tx.title[lang]);
    t[mode.factsKey].forEach((f, i) => {
      pdf.bullet(f);
      tr(tx[mode.factsKey][lang][i]);
    });
  }

  pdf.section("Glossar");
  for (const g of glossary) {
    pdf.ensureSpace(60);
    pdf.paragraph(g.term, { bold: true, paragraphGap: 1 });
    pdf.paragraph(g[mode.defKey], { paragraphGap: 2 });
    tr(help.glossary[g.term][mode.defKey][lang]);
  }

  // The Bundesländer table is names and numbers — it stays German, the note above it does not.
  pdf.doc.addPage({ size: "A4", layout: "landscape" });
  pdf.h2("Die 16 Bundesländer");
  pdf.paragraph(mode.stateFactsNote, { size: 9, color: MUTED });
  tr(help.meta[easy ? "stateFactsNoteEasy" : "stateFactsNote"][lang]);
  pdf.table(
    ["Bundesland", "Hauptstadt", "Typ", "Einwohner", "Grenzt an (Ausland)", "Landesparlament", "Regierungschef/in"],
    bundeslaender.map((l) => [
      l.sourced ? `${l.name} *` : l.name, l.capital, l.type, l.population,
      l.borderCountries.length ? l.borderCountries.join(", ") : "—", l.parliamentName, l.executiveTitle,
    ]),
    { fontSize: 8 }
  );
  pdf.paragraph("* Grunddaten aus echtem DeutschAcademy-Unterrichtsmaterial (Bayern). Alle anderen Bundesländer: allgemein bekannte, öffentliche Fakten.", { size: 8, color: MUTED });

  const bayern = bundeslaender.find((l) => l.id === "bayern");
  const bayernFacts = bayern?.[mode.sourceFactsKey];
  if (bayernFacts?.length) {
    pdf.doc.addPage({ size: "A4", layout: "portrait" });
    pdf.h2("Vertiefung: Bayern");
    bayernFacts.forEach((f, i) => {
      pdf.bullet(f);
      tr(help.bayern[mode.sourceFactsKey][lang][i]);
    });
  }

  await pdf.finish();
  console.log(`${fileName.padEnd(46)} ${Math.round(statSync(outPath).size / 1024)} KB`);
}

// Last, so EDITIONS above is initialised.
for (const mode of Object.values(MODES)) {
  for (const lang of Object.keys(EDITIONS)) await buildEdition(mode, lang);
}

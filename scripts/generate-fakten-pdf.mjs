// Generates the downloadable "Leben in Deutschland" facts PDF from
// src/data/leben-in-deutschland.json. Re-run after editing that file:
//   node scripts/generate-fakten-pdf.mjs
import PDFDocument from "pdfkit";
import { createWriteStream, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import lid from "../src/data/leben-in-deutschland.json" with { type: "json" };

const { meta, topics, glossary, bundeslaender } = lid;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "public", "downloads");
mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "leben-in-deutschland-fakten.pdf");

const TEAL = "#0f766e";
const INK = "#1f2937";
const MUTED = "#6b7280";
const MARGIN = 56;

const doc = new PDFDocument({ size: "A4", margin: MARGIN, bufferPages: true });
doc.pipe(createWriteStream(outPath));

function ensureSpace(height) {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + height > bottom) doc.addPage();
}

function h1(text) {
  ensureSpace(40);
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(20).text(text, { paragraphGap: 4 });
}

function h2(text) {
  ensureSpace(30);
  doc.moveDown(0.6);
  doc.fillColor(TEAL).font("Helvetica-Bold").fontSize(14).text(text, { paragraphGap: 6 });
  doc.moveTo(doc.x, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).strokeColor("#d1d5db").lineWidth(0.75).stroke();
  doc.moveDown(0.4);
}

function h3(text) {
  ensureSpace(22);
  doc.moveDown(0.3);
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(11.5).text(text, { paragraphGap: 3 });
}

function fact(text) {
  const bulletWidth = 12;
  const startX = doc.x;
  ensureSpace(14);
  const y = doc.y;
  doc.fillColor(TEAL).font("Helvetica-Bold").fontSize(10.25).text("•", startX, y, { continued: false, width: bulletWidth });
  doc.fillColor(INK).font("Helvetica").fontSize(10.25).text(text, startX + bulletWidth, y, {
    width: doc.page.width - doc.page.margins.right - (startX + bulletWidth),
    lineGap: 2,
  });
  doc.moveDown(0.35);
}

function paragraph(text, opts = {}) {
  ensureSpace(14);
  doc.fillColor(opts.color || MUTED).font(opts.bold ? "Helvetica-Bold" : "Helvetica").fontSize(opts.size || 9.5).text(text, {
    lineGap: 2,
    paragraphGap: 6,
    ...opts.textOpts,
  });
}

// --- Cover / title ---
doc.fillColor(MUTED).font("Helvetica").fontSize(9.5).text("DeutschAcademy · Prüfungsvorbereitung", { paragraphGap: 2 });
h1("Leben in Deutschland: Fakten");
doc.fillColor(INK).font("Helvetica").fontSize(11).text(
  "Bundesweite Fakten aus echtem Unterrichtsmaterial, gegliedert nach Themen, plus die Grunddaten zu allen 16 Bundesländern.",
  { paragraphGap: 8 }
);
paragraph(meta.sourceNote);

// --- Testformat ---
h2("Testformat");
const rows = [
  ["Bundesweiter Teil", `${meta.federalQuestions} von ${meta.totalQuestions} Fragen`],
  ["Landesspezifischer Teil", `${meta.stateQuestions} von ${meta.totalQuestions} Fragen`],
  ["Zeit", `${meta.minutes} Minuten`],
  ["Bestehen ab", `${meta.passScore} richtigen Antworten`],
];
for (const [label, value] of rows) {
  ensureSpace(16);
  const y = doc.y;
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(10).text(label, doc.x, y, { continued: false, width: 200 });
  doc.fillColor(INK).font("Helvetica").fontSize(10).text(value, doc.x + 200, y);
  doc.moveDown(0.25);
}

// --- Topics ---
for (const t of topics) {
  h2(t.title);
  for (const f of t.facts) fact(f);
}

// --- Glossary ---
h2("Glossar");
for (const g of glossary) {
  ensureSpace(16);
  doc.fillColor(TEAL).font("Helvetica-Bold").fontSize(10.25).text(g.term, { continued: false, paragraphGap: 1 });
  doc.fillColor(INK).font("Helvetica").fontSize(10).text(g.def, { paragraphGap: 5, lineGap: 1 });
}

// --- Bundesländer ---
h2("Die 16 Bundesländer");
paragraph(meta.stateFactsNote, { size: 9 });
doc.moveDown(0.3);

for (const l of bundeslaender) {
  h3(`${l.name}${l.sourced ? " (aus DeutschAcademy-Material)" : ""}`);
  const borders = l.borderCountries.length ? l.borderCountries.join(", ") : "keine Auslandsgrenze";
  fact(`Hauptstadt: ${l.capital}`);
  fact(`Typ: ${l.type}`);
  fact(`Einwohner: ${l.population}`);
  fact(`Grenzt an (Ausland): ${borders}`);
  fact(`Landesparlament: ${l.parliamentName}`);
  fact(`Spitze der Landesregierung: ${l.executiveTitle}`);
  if (l.sourceFacts) {
    for (const f of l.sourceFacts) fact(f);
  }
}

// --- Footer with page numbers ---
const range = doc.bufferedPageRange();
for (let i = 0; i < range.count; i++) {
  doc.switchToPage(range.start + i);
  doc.fillColor(MUTED).font("Helvetica").fontSize(8).text(
    `deutschacademy.com/pruefungen/leben-in-deutschland/fakten · Seite ${i + 1} von ${range.count}`,
    MARGIN,
    doc.page.height - 36,
    { align: "center", width: doc.page.width - MARGIN * 2 }
  );
}

doc.end();
console.log(`PDF written to ${outPath}`);

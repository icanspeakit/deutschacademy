// The brand's look for generated PDFs, as reusable primitives.
//
// scripts/generate-fakten-pdf.mjs grew these inline and they were good; a second and third
// generator wanting the same cover, the same teal rule under a heading and the same striped
// table made copying them the wrong move. That script is left alone — it works, and a
// refactor of a shipping generator buys nothing here — but everything written after it
// builds on this file, so the downloads look like one set rather than three.
//
// pdfkit's built-in Helvetica is WinAnsi-encoded, which covers ä ö ü ß € — the whole set the
// German content needs. No font files to ship, no licence to check.
import PDFDocument from "pdfkit";
import { createWriteStream, mkdirSync, existsSync, readFileSync, writeFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FONT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "fonts");

// Matches src/styles/global.css.
export const TEAL = "#0d9488";
export const TEAL_DARK = "#0f766e";
export const TEAL_SOFT = "#ccfbf1";
export const INK = "#1a2230";
export const MUTED = "#4b5768";
export const BORDER = "#e7e9ee";
export const SURFACE = "#f7f8fa";
export const MARGIN = 56;

/* pdfkit's built-in fonts are WinAnsi-encoded, and a code point outside that repertoire does
   not fail loudly — it draws as whatever byte happens to land there. The site's German is
   fine (ä ö ü ß € „ “ – — … all exist), but the arrows the grammar flows are built from do
   not, and "haben/sein → Position 2" printed as "haben/sein !' Position 2" before this map
   existed. Everything that cannot be drawn is either replaced with something that can or
   dropped, and sanitising happens at draw time so no caller can forget. */
const CHAR_MAP = new Map(Object.entries({
  "→": ">", "⇒": ">", "➡": ">", "➔": ">", "➜": ">",
  "←": "<", "⇐": "<",
  "↔": "<>", "⇔": "<>",
  "↑": "^", "↓": "v",
  "✓": "+", "✔": "+", "✗": "-", "✘": "-", "✖": "-",
  "▲": "", "▼": "", "▶": "", "◀": "",
  "−": "-", "≠": "!=", "≈": "~", "≤": "<=", "≥": ">=",
  " ": " ", " ": " ", " ": " ", "​": "",
}));

// Latin-1 minus the C1 control block, plus the printable characters WinAnsi puts in 0x80–0x9F.
const WIN_ANSI_EXTRAS = new Set(
  "€‚ƒ„…†‡ˆ‰Š‹ŒŽ" +
  "‘’“”•–—˜™š›œžŸ"
);

/** Makes a string safe to draw with a built-in pdfkit font. */
export function safe(text) {
  let out = "";
  for (const ch of String(text ?? "")) {
    if (CHAR_MAP.has(ch)) { out += CHAR_MAP.get(ch); continue; }
    const cp = ch.codePointAt(0);
    if (ch === "\n" || ch === "\t" || (cp >= 0x20 && cp <= 0x7e) || (cp >= 0xa0 && cp <= 0xff) || WIN_ANSI_EXTRAS.has(ch)) {
      out += ch;
    }
    // anything else is dropped rather than drawn as a stray byte
  }
  return out;
}

/** `<strong>fett</strong>` -> `fett`. The content is authored as HTML for the web; a PDF
    wants the words. Entities are decoded, block-ish tags become spaces so words do not
    run together, everything else is dropped. */
export function plain(html) {
  if (!html) return "";
  return String(html)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|div|li|tr)>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Opens a document and returns it together with the helpers. Everything draws at the
 * current `doc.y` and leaves `doc.x` back at the margin, so callers can mix helpers and
 * raw pdfkit freely.
 *
 * @param {object} opts
 * @param {string} opts.outPath   where to write
 * @param {string} opts.runningHead  small caps line at the top of every page but the cover
 */
export function createDoc({ outPath, runningHead, unicode = false }) {
  mkdirSync(path.dirname(outPath), { recursive: true });
  const doc = new PDFDocument({ size: "A4", margin: MARGIN, bufferPages: true });

  // The translated editions carry Arabic, Cyrillic and Turkish ğ ş ı — none of which the
  // built-in WinAnsi fonts can draw. They embed Noto instead (scripts/fonts/README.md);
  // the German-only PDFs stay on Helvetica, and on safe(), exactly as before.
  let F = { regular: "Helvetica", bold: "Helvetica-Bold", italic: "Helvetica-Oblique" };
  let S = safe;
  if (unicode) {
    doc.registerFont("Noto", path.join(FONT_DIR, "NotoSans-Regular.ttf"));
    doc.registerFont("Noto-Bold", path.join(FONT_DIR, "NotoSans-Bold.ttf"));
    doc.registerFont("Noto-Arabic", path.join(FONT_DIR, "NotoSansArabic-Regular.ttf"));
    F = { regular: "Noto", bold: "Noto-Bold", italic: "Noto" };
    S = (text) => String(text ?? "");
  }

  /* Right-to-left text is placed word by word, from the right edge leftwards. Handing
     pdfkit a whole Arabic line lost the spaces between words ("الاسم الأول" printed as
     one run), because its line wrapper and fontkit's RTL reordering disagree about which
     end of a word its trailing space belongs to. One word per call leaves fontkit only
     the job it does well — joining and ordering the letters inside the word. A Latin
     token such as "A1" is drawn in the Latin face: Noto Sans Arabic has no "A". */
  const LATIN = /[A-Za-z0-9]/;
  const rtlFont = (word) => (LATIN.test(word) && !ARABIC.test(word) ? F.regular : "Noto-Arabic");
  function rtlWidth(words, size) {
    let wsum = 0;
    for (const word of words) wsum += doc.font(rtlFont(word)).fontSize(size).widthOfString(word);
    doc.font("Noto-Arabic").fontSize(size);
    return wsum + Math.max(0, words.length - 1) * doc.widthOfString(" ");
  }
  // pdfkit places text by the top of the line box, and Noto Sans Arabic's ascender is
  // taller than Noto Sans's — so each word is nudged onto the Latin face's baseline, the
  // one the German in the neighbouring cells sits on.
  const ascender = (name) => doc.font(name)._font.ascender;
  const drawWord = (word, x, y, size) => {
    const font = rtlFont(word);
    doc.font(font).fontSize(size).text(word, x, y + ((ascender(F.regular) - ascender(font)) * size) / 1000, { lineBreak: false });
  };
  /* A German phrase inside an Arabic sentence ("… مثل der hohe Baum …") must still read
     left to right, so a line is cut into runs: consecutive Latin words form one run whose
     words go left to right, and the runs themselves are placed right to left. A token with
     neither script (a dash, a bracket) joins the run before it. */
  const ARABIC = /[\u0600-\u06FF]/;
  function rtlRuns(words) {
    const runs = [];
    for (const word of words) {
      const kind = ARABIC.test(word) ? "rtl" : LATIN.test(word) ? "ltr" : runs.at(-1)?.kind ?? "rtl";
      if (runs.at(-1)?.kind === kind) runs.at(-1).words.push(word);
      else runs.push({ kind, words: [word] });
    }
    return runs;
  }
  function rtlDraw(words, right, y, size) {
    doc.font("Noto-Arabic").fontSize(size);
    const space = doc.widthOfString(" ");
    let x = right;
    for (const run of rtlRuns(words)) {
      if (run.kind === "ltr") {
        const width = rtlWidth(run.words, size);
        let lx = x - width;
        for (const word of run.words) {
          drawWord(word, lx, y, size);
          lx += doc.font(rtlFont(word)).fontSize(size).widthOfString(word) + space;
        }
        x -= width + space;
      } else {
        for (const word of run.words) {
          x -= doc.font(rtlFont(word)).fontSize(size).widthOfString(word);
          drawWord(word, x, y, size);
          x -= space;
        }
      }
    }
  }
  /** Greedy wrap of RTL text into lines of words, in reading order. */
  function rtlWrap(text, width, size) {
    const lines = [];
    let line = [];
    for (const word of String(text ?? "").split(/\s+/).filter(Boolean)) {
      const next = [...line, word];
      if (line.length && rtlWidth(next, size) > width) { lines.push(line); line = [word]; }
      else line = next;
    }
    if (line.length) lines.push(line);
    return lines;
  }
  const stream = createWriteStream(outPath);
  doc.pipe(stream);

  // Drawn on 'pageAdded' rather than per section, so it also lands on pages a table
  // created while it was breaking across a page boundary.
  let pageCount = 0;
  doc.on("pageAdded", () => {
    pageCount += 1;
    if (pageCount === 1) return;
    doc.fillColor(MUTED).font(F.regular).fontSize(8)
      .text(S(runningHead), MARGIN, 28, { characterSpacing: 0.6 });
    doc.moveTo(MARGIN, 44).lineTo(doc.page.width - MARGIN, 44)
      .strokeColor(BORDER).lineWidth(0.75).stroke();
    doc.x = MARGIN;
    doc.y = 60;
  });

  const contentWidth = () => doc.page.width - doc.page.margins.right - MARGIN;
  const contentBottom = () => doc.page.height - doc.page.margins.bottom;

  function ensureSpace(height) {
    if (doc.y + height > contentBottom()) doc.addPage();
  }

  function cover({ eyebrow, title, subtitle, subtitleTranslated, subtitleRtl, meta = [], footer }) {
    const w = contentWidth();
    doc.rect(0, 0, doc.page.width, 210).fill(TEAL_SOFT);
    doc.fillColor(TEAL_DARK).font(F.bold).fontSize(9)
      .text(S(eyebrow), MARGIN, 64, { characterSpacing: 1.2, width: w });
    doc.fillColor(INK).font(F.bold).fontSize(30)
      .text(S(title), MARGIN, 88, { width: w, lineGap: 2 });
    if (subtitle) {
      doc.fillColor(MUTED).font(F.regular).fontSize(11)
        .text(S(subtitle), MARGIN, doc.y + 8, { width: w, lineGap: 3 });
    }
    // The same line in the reader's language, for a translated edition. One line, short
    // enough never to wrap, so an RTL line can be drawn whole and right-aligned.
    if (subtitleTranslated) {
      doc.fillColor(TEAL_DARK);
      if (subtitleRtl) rtlDraw(subtitleTranslated.split(" "), MARGIN + w, doc.y + 6, 11.5);
      else doc.font(F.regular).fontSize(11.5).text(subtitleTranslated, MARGIN, doc.y + 6, { width: w, lineBreak: false });
    }
    doc.y = 250;
    for (const line of meta) {
      doc.fillColor(TEAL).font(F.bold).fontSize(10)
        .text("•", MARGIN, doc.y, { width: 12, continued: false });
      doc.fillColor(INK).font(F.regular).fontSize(10.5)
        .text(S(line), MARGIN + 12, doc.y - 12, { width: w - 12, lineGap: 2 });
      doc.x = MARGIN;
      doc.moveDown(0.4);
    }
    if (footer) {
      doc.fillColor(MUTED).font(F.regular).fontSize(8.5)
        .text(S(footer), MARGIN, contentBottom() - 60, { width: w, lineGap: 2 });
    }
    doc.x = MARGIN;
  }

  /** A chapter opener: big, with the level in a pill, and it always starts a page. */
  function chapter(title, badge) {
    doc.addPage();
    const w = contentWidth();
    if (badge) {
      badge = S(badge);
      const bw = doc.widthOfString(badge, { size: 9 }) + 16;
      doc.roundedRect(MARGIN, doc.y, bw, 16, 8).fill(TEAL_SOFT);
      doc.fillColor(TEAL_DARK).font(F.bold).fontSize(9)
        .text(badge, MARGIN + 8, doc.y + 4.5, { width: bw });
      doc.x = MARGIN;
      doc.y += 24;
    }
    doc.fillColor(INK).font(F.bold).fontSize(19)
      .text(S(title), MARGIN, doc.y, { width: w, lineGap: 1 });
    doc.x = MARGIN;
    doc.moveDown(0.35);
    doc.moveTo(MARGIN, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y)
      .strokeColor(TEAL).lineWidth(1.5).stroke();
    doc.moveDown(0.7);
    doc.x = MARGIN;
  }

  /** Like chapter(), but it only breaks the page when the heading would be stranded at the
      bottom. A Grammatik topic deserves its own page; a 25-word Lernset does not, and
      forcing one turned a 650-word list into 85 mostly-white pages. */
  function section(title, badge) {
    ensureSpace(150);
    const w = contentWidth();
    doc.moveDown(0.8);
    if (badge) {
      badge = S(badge);
      const bw = doc.widthOfString(badge, { size: 8.5 }) + 14;
      doc.roundedRect(MARGIN, doc.y, bw, 15, 7.5).fill(TEAL_SOFT);
      doc.fillColor(TEAL_DARK).font(F.bold).fontSize(8.5)
        .text(badge, MARGIN + 7, doc.y + 4, { width: bw });
      doc.x = MARGIN;
      doc.y += 20;
    }
    doc.fillColor(INK).font(F.bold).fontSize(14)
      .text(S(title), MARGIN, doc.y, { width: w });
    doc.x = MARGIN;
    doc.moveDown(0.3);
    doc.moveTo(MARGIN, doc.y).lineTo(MARGIN + w, doc.y).strokeColor(TEAL).lineWidth(1).stroke();
    doc.moveDown(0.5);
    doc.x = MARGIN;
  }

  function h2(text) {
    ensureSpace(42);
    doc.moveDown(0.7);
    const y = doc.y;
    doc.rect(MARGIN, y + 2, 3, 13).fill(TEAL);
    doc.fillColor(TEAL_DARK).font(F.bold).fontSize(12)
      .text(S(text), MARGIN + 12, y, { width: contentWidth() - 12 });
    doc.x = MARGIN;
    doc.moveDown(0.45);
  }

  function paragraph(text, opts = {}) {
    if (!text) return;
    ensureSpace(16);
    doc.fillColor(opts.color || INK)
      .font(opts.bold ? F.bold : opts.italic ? F.italic : F.regular)
      .fontSize(opts.size || 10.25)
      .text(S(text), MARGIN, doc.y, {
        width: contentWidth(),
        lineGap: opts.lineGap ?? 2,
        paragraphGap: opts.paragraphGap ?? 5,
      });
    doc.x = MARGIN;
  }

  function bullet(text, opts = {}) {
    const bw = 12;
    ensureSpace(16);
    const y = doc.y;
    doc.fillColor(opts.markerColor || TEAL).font(F.bold).fontSize(10.25)
      .text(opts.marker ?? "•", MARGIN, y, { width: bw });
    doc.fillColor(opts.color || INK).font(F.regular).fontSize(opts.size || 10.25)
      .text(S(text), MARGIN + bw, y, { width: contentWidth() - bw, lineGap: 2 });
    doc.x = MARGIN;
    doc.moveDown(0.3);
  }

  /** A tinted box — for the one sentence a page should be read around. */
  function callout(text, opts = {}) {
    text = S(text);
    const w = contentWidth();
    const inner = w - 24;
    const h = doc.heightOfString(text, { width: inner, lineGap: 2 }) + 20;
    ensureSpace(h + 8);
    const y = doc.y;
    doc.roundedRect(MARGIN, y, w, h, 6).fill(opts.fill || SURFACE);
    doc.rect(MARGIN, y, 3, h).fill(opts.accent || TEAL);
    doc.fillColor(opts.color || INK)
      .font(opts.bold ? F.bold : F.regular)
      .fontSize(opts.size || 10.25)
      .text(S(text), MARGIN + 14, y + 10, { width: inner, lineGap: 2 });
    doc.x = MARGIN;
    doc.y = y + h + 8;
  }

  /** The learner's-language version of the block just drawn: smaller, muted, indented,
      with a teal rule on its leading edge — so the German above it still leads. */
  function translation(text, opts = {}) {
    if (!text) return;
    const size = opts.size ?? 9.25;
    const indent = opts.indent ?? 12;
    const w = contentWidth() - indent - 10;
    const lineH = () => doc.currentLineHeight(true) + 1.5;
    doc.fillColor(MUTED);
    if (opts.rtl) {
      const lines = rtlWrap(text, w, size);
      doc.font("Noto-Arabic").fontSize(size);
      const h = lines.length * lineH();
      ensureSpace(h + 6);
      const y = doc.y;
      const right = MARGIN + indent + 10 + w;
      doc.rect(right + 6, y, 1.5, h).fill(TEAL);
      doc.fillColor(MUTED);
      lines.forEach((line, i) => rtlDraw(line, right, y + i * lineH(), size));
      doc.y = y + h + 5;
    } else {
      doc.font(F.regular).fontSize(size);
      const h = doc.heightOfString(S(text), { width: w, lineGap: 1.5 });
      ensureSpace(h + 6);
      const y = doc.y;
      doc.rect(MARGIN + indent, y, 1.5, h).fill(TEAL);
      doc.fillColor(MUTED).font(F.regular).fontSize(size)
        .text(S(text), MARGIN + indent + 10, y, { width: w, lineGap: 1.5 });
      doc.y = y + h + 5;
    }
    doc.x = MARGIN;
  }

  /**
   * Bordered, striped table that repeats its header after a page break.
   * @param {string[]} head
   * @param {string[][]} rows
   */
  function table(head, rows, opts = {}) {
    // Wide reference tables (te-ka-nicht-mo-lo is seven columns) need smaller type or every
    // cell wraps to one word per line.
    const fontSize = opts.fontSize ?? (head.length > 5 ? 7.5 : head.length > 3 ? 8.25 : 9);
    const pad = opts.rowPadding ?? 6;
    const headH = opts.headerHeight ?? 20;
    const w = contentWidth();
    const cols = head.length;
    const widths = opts.widths ?? head.map(() => w / cols);

    const drawHead = () => {
      const y = doc.y;
      doc.rect(MARGIN, y, w, headH).fill(TEAL_SOFT);
      let x = MARGIN;
      doc.fillColor(TEAL_DARK).font(F.bold).fontSize(fontSize - 0.5);
      head.forEach((label, i) => {
        doc.text(S(label), x + 7, y + 6, {
          width: widths[i] - 14,
          characterSpacing: 0.4,
          align: opts.rtl?.includes(i) ? "right" : "left",
        });
        x += widths[i];
      });
      doc.y = y + headH;
    };

    ensureSpace(headH + 30);
    drawHead();

    // The first column draws bold, so it has to be MEASURED bold: Helvetica-Bold is wider
    // than Helvetica, and measuring "der Nachname, die Nachnamen" in the regular face sized
    // the row for one line while the bold draw took two — the second line was then clipped
    // by the row separator.
    const rtl = new Set(opts.rtl ?? []);
    const cellFont = (i) => (rtl.has(i) ? "Noto-Arabic" : i === 0 && opts.boldFirst !== false ? F.bold : F.regular);
    const lineGap = 1.5;

    /* Right-to-left cells are wrapped here rather than by pdfkit — see rtlDraw(). */
    const rtlLines = (text, width) => rtlWrap(text, width, fontSize);
    const cellHeight = (cell, i) => {
      doc.font(cellFont(i)).fontSize(fontSize);
      const width = widths[i] - 14;
      if (!rtl.has(i)) return doc.heightOfString(S(cell), { width, lineGap });
      return rtlLines(cell, width).length * (doc.currentLineHeight(true) + lineGap);
    };

    rows.forEach((row, ri) => {
      const h = Math.max(...row.map(cellHeight)) + pad * 2;

      if (doc.y + h > contentBottom()) {
        doc.addPage();
        drawHead();
      }

      const y = doc.y;
      if (ri % 2 === 1) doc.rect(MARGIN, y, w, h).fill(SURFACE);
      let x = MARGIN;
      row.forEach((cell, i) => {
        doc.fillColor(i === 0 || opts.inkCols?.includes(i) ? INK : MUTED)
          .font(cellFont(i))
          .fontSize(fontSize);
        const width = widths[i] - 14;
        if (rtl.has(i)) {
          let ly = y + pad;
          for (const line of rtlLines(cell, width)) {
            rtlDraw(line, x + 7 + width, ly, fontSize);
            ly += doc.currentLineHeight(true) + lineGap;
          }
        } else {
          doc.text(S(cell), x + 7, y + pad, { width, lineGap });
        }
        x += widths[i];
      });
      doc.moveTo(MARGIN, y + h).lineTo(MARGIN + w, y + h)
        .strokeColor(BORDER).lineWidth(0.5).stroke();
      doc.y = y + h;
      doc.x = MARGIN;
    });

    doc.moveDown(0.6);
    doc.x = MARGIN;
  }

  /** Page numbers, written at the end because they need the final page count. */
  function paginate({ skipFirst = true } = {}) {
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      if (skipFirst && i === range.start) continue;
      doc.switchToPage(i);
      doc.fillColor(MUTED).font(F.regular).fontSize(8).text(
        `${i - range.start + 1} / ${range.count}`,
        MARGIN,
        doc.page.height - 38,
        { width: doc.page.width - MARGIN * 2, align: "right" }
      );
    }
  }

  /**
   * Resolves once the file is actually on disk, and records its size and page count in
   * public/downloads/manifest.json on the way out.
   *
   * The Wissensdatenbank page wants to say "PDF · 31 Seiten · 41 KB" before anyone clicks.
   * Size it could stat for itself; the page count it cannot, short of parsing the PDF. Here
   * it is free — pdfkit has just counted the pages — so it gets written down rather than
   * guessed at or hand-maintained in the catalogue.
   */
  function finish() {
    const pages = doc.bufferedPageRange().count;
    paginate();
    doc.end();
    return new Promise((resolve, reject) => {
      stream.on("error", reject);
      stream.on("finish", () => {
        const dir = path.dirname(outPath);
        const file = path.join(dir, "manifest.json");
        const all = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
        all[path.basename(outPath)] = { pages, bytes: statSync(outPath).size };
        // Sorted by rebuilding the object, not via stringify's replacer array — that
        // argument is a key *filter*, and passing the top-level names to it stripped
        // `pages` and `bytes` out of every entry.
        const sorted = Object.fromEntries(Object.keys(all).sort().map((k) => [k, all[k]]));
        writeFileSync(file, JSON.stringify(sorted, null, 2) + "\n", "utf8");
        resolve();
      });
    });
  }

  return { doc, cover, chapter, section, h2, paragraph, bullet, callout, translation, table, ensureSpace, contentWidth, finish };
}

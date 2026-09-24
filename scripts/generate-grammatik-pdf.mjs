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
import { all as lexicon } from "../src/lib/lexicon.js";

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

/* The cover and the contents page of a translated edition, in the reader's language. The
   reader chose this file because they want the help in their language; a cover that tells
   them what is inside in German is the one page they may not be able to read yet.
   Chapter content keeps its German headings — German is the subject. */
const ukPlural = (n, one, few, many) =>
  n % 10 === 1 && n % 100 !== 11 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? few : many;
const COVER_UI = {
  en: {
    explained: "Every rule explained in English; examples and tables stay in German",
    draft: "The English explanations are a machine draft, not yet checked by a teacher",
    topics: (n, levels) => `${n} topics${levels ? ` on four levels (${levels})` : ""}`,
    tables: (n) => `${n} reference tables`,
    online: "The matching exercises are free at deutschacademy.com/grammatik",
    footer: "Written by DeutschAcademy — by teachers who actually teach. You may download, print and share this PDF in class. No account, no cost.",
    contents: "Contents", level: "Level", topic: "Topic",
  },
  ar: {
    explained: "كل قاعدة مشروحة بالعربية، والأمثلة والجداول تبقى بالألمانية",
    draft: "الشرح بالعربية مسودة آلية لم يراجعها معلم بعد",
    topics: (n, levels) => `عدد المواضيع: ${n}${levels ? ` في أربعة مستويات (${levels})` : ""}`,
    tables: (n) => `عدد الجداول المرجعية: ${n}`,
    online: "التمارين المرافقة مجانية على deutschacademy.com/grammatik",
    footer: "كتبته DeutschAcademy — معلمون يدرّسون فعلًا. يمكنك تنزيل هذا الملف وطباعته ومشاركته في الصف بحرية. بدون حساب وبدون تكلفة.",
    contents: "المحتوى", level: "المستوى", topic: "الموضوع",
  },
  uk: {
    explained: "Кожне правило пояснено українською; приклади й таблиці залишаються німецькою",
    draft: "Пояснення українською — машинна чернетка, ще не перевірена викладачем",
    topics: (n, levels) => `${n} ${ukPlural(n, "тема", "теми", "тем")}${levels ? ` на чотирьох рівнях (${levels})` : ""}`,
    tables: (n) => `${n} ${ukPlural(n, "довідкова таблиця", "довідкові таблиці", "довідкових таблиць")}`,
    online: "Вправи до книги — безкоштовно на deutschacademy.com/grammatik",
    footer: "Написано DeutschAcademy — викладачами, які справді викладають. Цей PDF можна вільно завантажувати, друкувати й роздавати на заняттях. Без акаунта, безкоштовно.",
    contents: "Зміст", level: "Рівень", topic: "Тема",
  },
  tr: {
    explained: "Her kural Türkçe açıklamalı; örnekler ve tablolar Almanca kalır",
    draft: "Türkçe açıklamalar bir makine taslağıdır, henüz bir öğretmen tarafından kontrol edilmedi",
    topics: (n, levels) => (levels ? `Dört seviyede (${levels}) ${n} konu` : `${n} konu`),
    tables: (n) => `${n} başvuru tablosu`,
    online: "İlgili alıştırmalar ücretsiz: deutschacademy.com/grammatik",
    footer: "DeutschAcademy tarafından yazıldı — gerçekten ders veren öğretmenler tarafından. Bu PDF'yi serbestçe indirebilir, yazdırabilir ve derste paylaşabilirsin. Hesap yok, ücret yok.",
    contents: "İçindekiler", level: "Seviye", topic: "Konu",
  },
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

/* Word meanings for the word tables of a translated edition. A table whose rows are single
   German words (kaufen, der Tisch, du · kommen) gets one more column with the word's meaning
   in the reader's language, from the site's lexicon (A1–B2), so the site and the PDF agree.
   Ukrainian is not in the lexicon yet; its drafts live in src/data/uebersetzungen/woerter-uk.json.
   A table only gets the column when at least 70 % of its rows are such a word: sentence
   tables and grammar-term tables stay as they are, and a word the lexicon lacks gets an
   empty cell rather than a guess. */
const woerterUk = JSON.parse(readFileSync(path.join(root, "src", "data", "uebersetzungen", "woerter-uk.json"), "utf8")).uk;
const MEANING_HEAD = { en: "English", ar: "Arabisch", uk: "Українська", tr: "Türkçe" };
const LEAD = new Set("der die das ein eine ich du er sie es wir ihr sich".split(" "));
const normWord = (w) => w.toLowerCase().replace(/[^a-zäöüß-]/g, "");
const lexA1B2 = lexicon().filter((e) => LEVELS.includes(e.level));
const byLemma = new Map();
const byForm = new Map();
for (const e of lexA1B2) if (!byLemma.has(normWord(e.lemma))) byLemma.set(normWord(e.lemma), e);
for (const e of lexA1B2) {
  // A form ("hatte", "gegangen", "Äpfel") points back at its lemma, so a row that shows
  // one still finds the word.
  for (const f of [...(e.forms ?? []), e.plural]) {
    const n = f ? normWord(String(f).split(/\s+/).at(-1)) : "";
    if (n && !byForm.has(n)) byForm.set(n, e);
  }
}
/** The one German word a table row is about, or null when its first cell is not one word. */
function rowWord(cell) {
  const content = plain(cell).replace(/\([^)]*\)/g, " ").split(/[\s·,/]+/).map(normWord).filter((t) => t && !LEAD.has(t));
  return content.length === 1 ? byLemma.get(content[0]) ?? byForm.get(content[0]) ?? null : null;
}
const meaningOf = (e, lang) => (lang === "uk" ? woerterUk[e.id] : e[lang]) ?? "";

/** The table with a meaning column added, or the table as it was. */
function withMeanings(head, rows, lang) {
  if (!lang) return { head, rows, opts: {} };
  const words = rows.map((r) => rowWord(r[0]));
  if (words.filter(Boolean).length / rows.length < 0.7) return { head, rows, opts: {} };
  return {
    head: [...head, MEANING_HEAD[lang]],
    rows: rows.map((r, i) => [...r, words[i] ? meaningOf(words[i], lang) : ""]),
    opts: EDITIONS[lang].rtl ? { rtl: [head.length] } : {},
  };
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
    const tb = withMeanings(t.head.map(plain), t.rows.map((r) => r.map(plain)), lang);
    pdf.table(tb.head, tb.rows, tb.opts);
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
    const tb = withMeanings((ex.columns ?? ["", "Lösung"]).map(plain), ex.rows.map((r) => [plain(r.term), plain(r.answer)]), lang);
    pdf.table(tb.head, tb.rows, tb.opts);
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
  // The language pair goes in the eyebrow, not the title: "Grammatik A1–B2 · Deutsch–
  // Ukrainisch" wraps to two lines and pushes the translated line off the cover band.
  const title = baseTitle;
  const outPath = path.join(outDir, fileName);
  const pdf = createDoc({ outPath, runningHead: `DEUTSCHACADEMY · ${title.toUpperCase()}${ed ? ` · DEUTSCH–${ed.name.toUpperCase()}` : ""}`, unicode: Boolean(ed) });
  const unreviewed = ed && ordered.some((t) => !help.entries[t.id]?.reviewed);
  const ui = lang ? COVER_UI[lang] : null;

  const tableCount = ordered.reduce((n, t) => n + (t.concept?.reference?.tables?.length ?? 0), 0);

  pdf.cover({
    eyebrow: `DEUTSCHACADEMY · GRAMMATIK${ed ? ` · DEUTSCH–${ed.name.toUpperCase()}` : ""}`,
    title,
    subtitle: level
      ? `${LEVEL_BLURB[level]} — alle Grammatikthemen dieses Niveaus zum Nachschlagen und Ausdrucken.`
      : "Alle Grammatikthemen von A1 bis B2 in einem Band, zum Nachschlagen und Ausdrucken.",
    subtitleTranslated: ed?.cover(level ?? "A1–B2"),
    subtitleRtl: ed?.rtl,
    meta: ui
      ? [
          ui.explained,
          ...(unreviewed ? [ui.draft] : []),
          ui.topics(ordered.length, level ? null : LEVELS.join(", ")),
          ui.tables(tableCount),
          ui.online,
        ]
      : [
          `${ordered.length} Themen${level ? "" : ` auf vier Niveaus (${LEVELS.join(", ")})`}`,
          `${tableCount} Übersichtstabellen zum Nachschlagen`,
          "Die Übungen dazu stehen kostenlos auf deutschacademy.com/grammatik",
        ],
    footer: ui?.footer ??
      "Von DeutschAcademy geschrieben — von Lehrkräften, die wirklich unterrichten. Dieses PDF darfst du frei " +
      "herunterladen, ausdrucken und im Unterricht weitergeben. Kein Konto, keine Kosten.",
    rtl: Boolean(ed?.rtl),
  });

  // Contents. In a translated edition the headings are in the reader's language and the
  // topic names stay German — they are the names the chapters carry.
  pdf.doc.addPage();
  // Not for Arabic: h2() and the table head draw with the Latin face and cannot shape it.
  const toc = ed?.rtl ? null : ui;
  pdf.h2(toc ? `${toc.contents} · Inhalt` : "Inhalt");
  pdf.table(
    level ? [toc?.topic ?? "Thema"] : [toc?.level ?? "Niveau", toc?.topic ?? "Thema"],
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

// The Wissensdatenbank's catalogue, joined to what is actually on disk.
//
// src/data/downloads.json says what a file IS — title, level, category, who wrote it. The
// generators say how BIG it is and how many pages it has, in public/downloads/manifest.json.
// Keeping those apart is the point: the size of a PDF is not something anyone should be
// hand-maintaining in a catalogue, and it goes stale the first time a generator runs.
//
// A catalogue entry whose file is missing is dropped rather than rendered as a dead link —
// the Fakten PDFs are committed, but someone cloning the repo before running the generators
// would otherwise get a page full of 404s.
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import catalogue from "../data/downloads.json";
import { grammarTopics } from "./catalog.js";
import { lernsets } from "./lernsets.js";
import lid from "../data/leben-in-deutschland.json";

const DIR = path.join(process.cwd(), "public", "downloads");

const manifest = (() => {
  const file = path.join(DIR, "manifest.json");
  if (!existsSync(file)) return {};
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return {};
  }
})();

/** "1,2 MB" / "214 KB" — German decimal comma, because the whole page is German. */
export function formatSize(bytes) {
  if (!bytes) return null;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

function fileInfo(file) {
  const abs = path.join(DIR, file);
  if (!existsSync(abs)) return null;
  const meta = manifest[file] ?? {};
  const bytes = meta.bytes ?? statSync(abs).size;
  return { href: `/downloads/${file}`, pages: meta.pages ?? null, bytes, size: formatSize(bytes) };
}

/* The translated editions of a file: a Wortliste with the learner's own language in place
   of the English column (generate-wortschatz-pdf.mjs), a Grammatik book with every rule
   explained in it as well (generate-grammatik-pdf.mjs). Found on disk by
   name rather than listed in the catalogue — the generator skips a level whose
   translations are incomplete, and a catalogue entry would promise that file anyway.
   Labels are each language's own name: the reader looking for it reads that language. */
const EDITIONS = [
  { lang: "en", label: "English" },
  { lang: "ar", label: "العربية", rtl: true },
  { lang: "uk", label: "Українська" },
  { lang: "ru", label: "Русский" },
  { lang: "tr", label: "Türkçe" },
];
function editionsOf(entry) {
  const base = entry.file.replace(/\.pdf$/, "");
  return EDITIONS.map((e) => {
    const info = fileInfo(`${base}-${e.lang}.pdf`);
    return info && { ...e, ...info };
  }).filter(Boolean);
}

function hydrate(entry) {
  const info = fileInfo(entry.file);
  if (!info) return null;
  return { ...entry, ...info, editions: editionsOf(entry) };
}

// What is actually inside a PDF, read from the same data the generator used — not
// typed into the catalogue, where it would drift the first time a topic is added.
// The download page shows this before the file is fetched: a 210 KB PDF that turns
// out to be the wrong level is a wasted download on a phone plan.
function contentsOf(entry) {
  if (entry.category === "grammatik") {
    const level = entry.level === "A1–B2" ? null : entry.level;
    const topics = grammarTopics.filter((t) => !level || t.level === level);
    return {
      label: level ? "Themen in diesem Band" : "Alle 27 Themen, nach Niveau",
      labelKey: level ? "wissen.toc.topicsInBand" : "wissen.toc.allTopics",
      items: topics.map((t) => (level ? t.name : `${t.level} · ${t.name}`)),
    };
  }
  if (entry.category === "wortschatz") {
    // The A1–B2 book holds every level's sets; name the level in front of each.
    if (entry.level === "A1–B2") {
      const sets = ["A1", "A2", "B1", "B2"].flatMap((l) => lernsets({ level: l, status: "built" }).map((s) => ({ ...s, l })));
      return {
        label: `${sets.length} Lernsets`,
        labelKey: "wissen.toc.sets", labelVars: { n: sets.length },
        items: sets.map((s) => `${s.l} · ${s.title} · ${s.words} Wörter`),
      };
    }
    const sets = lernsets({ level: entry.level, status: "built" });
    return {
      label: `${sets.length} Lernsets`,
      labelKey: "wissen.toc.sets", labelVars: { n: sets.length },
      items: sets.map((s) => `${s.title} · ${s.words} Wörter`),
      // The set's name stays German (it is what the PDF prints); the count follows the UI.
      itemKeys: sets.map((s) => ({ key: "wissen.toc.setRow", vars: { title: s.title, n: s.words } })),
    };
  }
  if (entry.category === "pruefungen") {
    // The Bayern booklets are the Landesfragen; the two Fakten bands are the topic
    // chapters. Both are answered by what the file's own name says it is.
    if (entry.file.includes("bayern")) {
      return {
        label: "Landesteil Bayern", labelKey: "wissen.toc.bayern",
        items: ["10 Landesfragen mit Lösungen", "Karte und Kurzprofil des Bundeslands"],
        itemKeys: [{ key: "wissen.toc.bayern.q" }, { key: "wissen.toc.bayern.map" }],
      };
    }
    return { label: `${lid.topics.length} Kapitel`, labelKey: "wissen.toc.chapters", labelVars: { n: lid.topics.length }, items: lid.topics.map((t) => t.title) };
  }
  return null;
}

export const files = catalogue.files.map(hydrate).filter(Boolean).map((f) => ({ ...f, contents: contentsOf(f) }));

export const featured = files.filter((f) => f.featured);

/** Categories in catalogue order, each carrying only the files that exist.
 *  The featured ones are left out: they already lead the page, and listing them
 *  twice made "14 PDFs" look like sixteen rows. */
export const categories = catalogue.categories
  .map((c) => ({ ...c, items: files.filter((f) => f.category === c.id && !f.featured) }))
  .filter((c) => c.items.length);

export const links = catalogue.links;
export const rightsNote = catalogue.rightsNote;
export const rights = catalogue.rights;

export const totals = {
  files: files.length,
  pages: files.reduce((n, f) => n + (f.pages ?? 0), 0),
  bytes: files.reduce((n, f) => n + f.bytes, 0),
};

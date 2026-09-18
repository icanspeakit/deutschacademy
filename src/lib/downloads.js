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

function hydrate(entry) {
  const abs = path.join(DIR, entry.file);
  if (!existsSync(abs)) return null;
  const meta = manifest[entry.file] ?? {};
  const bytes = meta.bytes ?? statSync(abs).size;
  return {
    ...entry,
    href: `/downloads/${entry.file}`,
    pages: meta.pages ?? null,
    bytes,
    size: formatSize(bytes),
  };
}

export const files = catalogue.files.map(hydrate).filter(Boolean);

/** Categories in catalogue order, each carrying only the files that exist. */
export const categories = catalogue.categories
  .map((c) => ({ ...c, items: files.filter((f) => f.category === c.id) }))
  .filter((c) => c.items.length);

export const links = catalogue.links;
export const rightsNote = catalogue.rightsNote;
export const rights = catalogue.rights;

export const totals = {
  files: files.length,
  pages: files.reduce((n, f) => n + (f.pages ?? 0), 0),
  bytes: files.reduce((n, f) => n + f.bytes, 0),
};

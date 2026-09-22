// Build-time helper for the photo credit under the Sprechen pages.
//
// The Sprechen photos come from stock libraries whose licences do not require naming the
// photographer — that is why they were chosen. Pexels attaches one condition anyway: its
// API guidelines ask for a link back to Pexels wherever the photos appear. Pixabay asks
// for nothing.
//
// So the credit is derived, not written by hand. scripts/fetch-sprechen-bilder.mjs records
// the source of every file in provenance.json; this reads it back and returns a line only
// for the libraries actually on disk. Swap the last Pexels photo out and the Pexels link
// stops rendering by itself — nobody has to remember that it was ever owed.
//
// Node built-ins are fine here: every page that imports this is prerendered. The same
// reasoning as src/lib/hoeren.js, which reads the audio manifest the same way.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const PROV = path.join(process.cwd(), "public", "assets", "sprechen", "provenance.json");

const provenance = (() => {
  if (!existsSync(PROV)) return {};
  try {
    return JSON.parse(readFileSync(PROV, "utf8"));
  } catch {
    // A half-written provenance file should cost a credit line, not the build.
    return {};
  }
})();

/* One entry per library the script can pull from. `label` is what the sentence says; the
   wording is the site's, not a badge the licence dictates. */
const LIBRARIES = {
  pexels: { label: "Pexels", href: "https://www.pexels.com" },
  pixabay: { label: "Pixabay", href: "https://pixabay.com" },
};

/** The libraries that at least one rendered Sprechen photo actually came from. */
export function photoSources() {
  const used = new Set(Object.values(provenance).map((p) => p.source));
  return Object.entries(LIBRARIES)
    .filter(([id]) => used.has(id))
    .map(([id, lib]) => ({ id, ...lib }));
}

/** The same, narrowed to one task's photo — for the single-task page. */
export function photoSourceOf(task) {
  if (!task?.image) return null;
  const rec = provenance[path.basename(task.image)];
  const lib = rec && LIBRARIES[rec.source];
  return lib ? { id: rec.source, ...lib, photographer: rec.photographer } : null;
}

/* The card thumbnails, written by scripts/generate-sprechen-thumbs.mjs.

   The card grids show each picture task's photo, and the source photos are 1200-1880px
   wide: pointing a 38px card straight at one meant the Sprechen hub downloaded ~1.3MB of
   JPEG to paint six small squares. The thumbs are 240px WebP, 3-12KB each.

   Falls back to the original when no thumb is on disk, so a photo added without running the
   script still shows up — heavier than it should be, but never missing. */
const THUMB_DIR = path.join(process.cwd(), "public", "assets", "sprechen", "thumbs");

/**
 * @param {string} image - the public path of the full-size photo, e.g. "/assets/sprechen/a1-bild-bahnhof.jpg"
 * @returns {string} the thumbnail's public path, or `image` unchanged if there is none
 */
export function thumbFor(image) {
  if (!image) return image;
  const base = image.split("/").pop().replace(/\.[^.]+$/, ".webp");
  return existsSync(path.join(THUMB_DIR, base)) ? `/assets/sprechen/thumbs/${base}` : image;
}

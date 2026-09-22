// Thumbnails for the Sprechen cards.
//
//   node scripts/generate-sprechen-thumbs.mjs        write missing thumbs
//   node scripts/generate-sprechen-thumbs.mjs --force  rewrite all of them
//
// Why this exists: the hub and the Bildserie pages show each picture task's photo on its
// card, at 38px on the hub and 72px in a series. The source photos are 1200–1880px wide and
// 100–324KB each, so pointing the cards straight at them meant **1.3MB of JPEG to paint six
// 38px squares** on the Sprechen hub. On a site whose learners are overwhelmingly on phones
// and mobile data, that is the whole page budget spent on decoration.
//
// 240px wide covers every use: 38px at 3× is 114, 72px at 3× is 216. WebP because every
// browser that matters has supported it for years and it is roughly half of JPEG here.
//
// The originals stay exactly where they are — the task pages still show them full size, and
// provenance.json still describes them. This only adds a smaller copy beside them.
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

// sharp is a devDependency here, but it is also Astro's own image-service dependency, and
// under pnpm those live at different paths. Resolve it rather than assuming either.
const require = createRequire(import.meta.url);
const sharp = require("sharp");

const WIDTH = 240;
const FORCE = process.argv.includes("--force");

// Everything scripts/fetch-sprechen-bilder.mjs has pulled lives in one directory, plus the
// one telc picture the B1/B2 trainer borrows from public/assets.
//
// This used to also name three loose files one directory up — the older DTZ pictures. They
// are gone: nobody could say where they came from, so they were replaced from Pexels and
// now sit in public/assets/sprechen with provenance like everything else.
const SOURCES = [
  { dir: "public/assets/sprechen", files: null },
  { dir: "public/assets", files: ["foto-buero-1.jpg"] },
];

const OUT = "public/assets/sprechen/thumbs";
mkdirSync(OUT, { recursive: true });

let written = 0;
let skipped = 0;
let saved = 0;

for (const { dir, files } of SOURCES) {
  if (!existsSync(dir)) continue;
  const list = files ?? readdirSync(dir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
  for (const file of list) {
    const src = path.join(dir, file);
    if (!existsSync(src)) {
      console.warn(`  fehlt, übersprungen: ${src}`);
      continue;
    }
    const out = path.join(OUT, file.replace(/\.[^.]+$/, ".webp"));
    if (existsSync(out) && !FORCE) {
      skipped++;
      continue;
    }
    await sharp(src).resize({ width: WIDTH, withoutEnlargement: true }).webp({ quality: 72 }).toFile(out);
    const before = statSync(src).size;
    const after = statSync(out).size;
    saved += before - after;
    written++;
    console.log(`  ${file} → ${path.basename(out)}  ${Math.round(before / 1024)}KB → ${Math.round(after / 1024)}KB`);
  }
}

console.log(`\n${written} Thumbnails geschrieben, ${skipped} schon vorhanden.`);
if (written) console.log(`Gespart gegenüber den Originalen: ${Math.round(saved / 1024)}KB.`);

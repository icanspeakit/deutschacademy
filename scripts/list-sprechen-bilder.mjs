// The photos the Sprechen library is still waiting for.
//
//   node scripts/list-sprechen-bilder.mjs
//
// Every picture task in src/data/fertigkeiten/sprechen.json either points at a file in
// public/assets (`image`) or describes the photo it needs (`imageNeeded`). This prints the
// second list, grouped by Bildserie, so sourcing them is a shopping trip rather than a
// re-read of the JSON.
//
// Drop the file in public/assets and set `image: "/assets/<name>.jpg"` on the task; the
// page swaps the described scene for the photo on the next build. The site's images are its
// own — do not point these at a stock URL.
import { readFileSync } from "node:fs";

const data = JSON.parse(readFileSync("src/data/fertigkeiten/sprechen.json", "utf8"));
const setTitle = Object.fromEntries(data.sets.map((s) => [s.id, `${s.level} · ${s.title}`]));
const pending = data.tasks.filter((t) => t.imageNeeded && !t.image);

if (!pending.length) {
  console.log("Alle Sprechaufgaben haben ihr Bild.");
  process.exit(0);
}

let group = null;
for (const t of pending) {
  const head = t.set ? setTitle[t.set] : `${t.level} · Einzelaufgaben`;
  if (head !== group) {
    group = head;
    console.log(`\n${head}`);
  }
  console.log(`  ${t.id}`);
  console.log(`    ${t.title} — ${t.imageNeeded}`);
}
console.log(`\n${pending.length} von ${data.tasks.filter((t) => t.type === "bild" || t.imageNeeded).length} Bildern fehlen.`);

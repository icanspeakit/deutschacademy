// Fetches the photos the Sprechen library is waiting for, from Pixabay.
//
//   pnpm sprechen:fetch              every task that still has no image
//   pnpm sprechen:fetch --dry        show what it would pick, download nothing
//   pnpm sprechen:fetch --only a1-bild-kueche
//   pnpm sprechen:fetch --only a1-bild-kueche --pick 3   take the 3rd hit instead
//   pnpm sprechen:fetch --force      re-fetch tasks that already have an image
//
// Needs PIXABAY_API_KEY in .env.local (free: pixabay.com/api/docs). The Pixabay Content
// License allows commercial use without attribution, which is what a free public site
// needs — the same reason the Hörtexte are ElevenLabs rather than Lehrwerk-CDs.
//
// Two rules the Pixabay API terms actually require, both of which this script follows:
// the images are downloaded and served from our own domain (hotlinking cdn.pixabay.com is
// not allowed), and nothing here mass-harvests the library — one image per task, once.
//
// Provenance is recorded whether or not the licence demands it. `provenance.json` keeps
// the Pixabay id, the page URL, the photographer and the date for every file, so in two
// years "where did this come from?" has an answer that is not a guess. Attribution is not
// required, so no credit line is rendered; the record exists for us, not for the licence.
//
// The picks are not blind: --dry prints the candidates with their tags so a human decides
// before anything lands in the repo. A Bildbeschreibung lives or dies on whether the photo
// actually shows the scene, and a search engine does not know that.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";

const KEY = process.env.PIXABAY_API_KEY;
if (!KEY) {
  console.error("PIXABAY_API_KEY fehlt. Kostenlos anlegen: https://pixabay.com/api/docs");
  console.error("Dann in .env.local eintragen:  PIXABAY_API_KEY=…");
  process.exit(1);
}

const DATA = "src/data/fertigkeiten/sprechen.json";
const OUT_DIR = path.join("public", "assets", "sprechen");
const PROV = path.join(OUT_DIR, "provenance.json");

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f) => { const i = args.indexOf(f); return i === -1 ? null : args[i + 1]; };
const DRY = has("--dry");
const FORCE = has("--force");
const ONLY = val("--only");
const PICK = Number(val("--pick") ?? 1);

const data = JSON.parse(readFileSync(DATA, "utf8"));

const wanted = data.tasks.filter((t) => {
  if (ONLY) return t.id === ONLY;
  if (!t.imageQuery) return false;
  return FORCE || !t.image;
});

if (!wanted.length) {
  console.log("Nichts zu holen. (Mit --force auch schon belegte Aufgaben neu suchen.)");
  process.exit(0);
}

// Landscape only, and wide enough that the picture still carries on a desktop; the learner
// is meant to read a scene off it, not squint at a thumbnail. safesearch because this is a
// site for adult learners and their children look over the shoulder.
function endpoint(q) {
  const p = new URLSearchParams({
    key: KEY,
    q,
    image_type: "photo",
    orientation: "horizontal",
    min_width: "1200",
    safesearch: "true",
    per_page: "12",
    order: "popular",
  });
  return `https://pixabay.com/api/?${p}`;
}

const provenance = existsSync(PROV) ? JSON.parse(readFileSync(PROV, "utf8")) : {};
if (!DRY) mkdirSync(OUT_DIR, { recursive: true });

let taken = 0;
let missed = 0;

for (const task of wanted) {
  const q = task.imageQuery;
  console.log(`\n${task.id}  «${task.title}»`);
  console.log(`  Szene: ${task.imageNeeded}`);
  console.log(`  Suche: ${q}`);

  let hits;
  try {
    const res = await fetch(endpoint(q));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    hits = (await res.json()).hits ?? [];
  } catch (err) {
    console.log(`  ✗ Suche fehlgeschlagen: ${err.message}`);
    missed++;
    continue;
  }

  if (!hits.length) {
    console.log("  ✗ kein Treffer — imageQuery in sprechen.json anpassen");
    missed++;
    continue;
  }

  if (DRY) {
    hits.slice(0, 5).forEach((h, i) => {
      console.log(`  ${i + 1 === PICK ? "→" : " "} ${i + 1}. ${h.imageWidth}×${h.imageHeight} · ${h.user} · ${h.tags}`);
      console.log(`       ${h.pageURL}`);
    });
    continue;
  }

  const hit = hits[PICK - 1] ?? hits[0];
  const file = `${task.id}.jpg`;
  const dest = path.join(OUT_DIR, file);

  try {
    const img = await fetch(hit.largeImageURL);
    if (!img.ok) throw new Error(`HTTP ${img.status}`);
    writeFileSync(dest, Buffer.from(await img.arrayBuffer()));
  } catch (err) {
    console.log(`  ✗ Download fehlgeschlagen: ${err.message}`);
    missed++;
    continue;
  }

  task.image = `/assets/sprechen/${file}`;
  provenance[file] = {
    task: task.id,
    source: "pixabay",
    pixabayId: hit.id,
    pageURL: hit.pageURL,
    photographer: hit.user,
    tags: hit.tags,
    license: "Pixabay Content License — freie kommerzielle Nutzung, keine Namensnennung nötig",
    query: q,
    fetched: new Date().toISOString().slice(0, 10),
  };
  taken++;
  console.log(`  ✓ ${file} — ${hit.user} · ${hit.pageURL}`);
}

if (!DRY && taken) {
  writeFileSync(PROV, JSON.stringify(provenance, null, 2) + "\n");
  writeFileSync(DATA, JSON.stringify(data, null, 2) + "\n");
  console.log(`\n${taken} Bilder geholt, ${DATA} und ${PROV} aktualisiert.`);
  console.log("Jetzt anschauen: pnpm dev, dann /uebungen/sprechen — ein Foto, das die Szene");
  console.log("nicht zeigt, ist schlechter als die Beschreibung. Mit --only <id> --pick N neu wählen.");
}
if (missed) console.log(`${missed} Aufgaben ohne Bild geblieben.`);

// Fetches the photos the Sprechen library is waiting for, from Pexels or Pixabay.
//
//   pnpm sprechen:fetch              every task that still has no image
//   pnpm sprechen:fetch --dry        show what it would pick, download nothing
//   pnpm sprechen:fetch --only a1-bild-kueche
//   pnpm sprechen:fetch --only a1-bild-kueche --pick 3   take the 3rd hit instead
//   pnpm sprechen:fetch --force      re-fetch tasks that already have an image
//   pnpm sprechen:fetch --source pixabay                 the other library
//
// TWO SOURCES, one interface. Pexels is the default when PEXELS_API_KEY is set, because
// Pixabay's 100-requests-per-60-seconds is easy to walk into while iterating on queries
// and there is no reason to be stuck on one library. Keys go in .env.local:
//
//   PEXELS_API_KEY=…    free, instant: pexels.com/api
//   PIXABAY_API_KEY=…   free, instant: pixabay.com/api/docs
//
// Both licences allow commercial use and neither requires naming the photographer, which
// is what a free public site needs — the same reason the Hörtexte are ElevenLabs rather
// than Lehrwerk-CDs. They differ in one obligation: Pexels' API guidelines ask for a link
// back to Pexels where the photos appear. That link is rendered from provenance.json by
// src/lib/sprechenBilder.js, so it appears exactly when a Pexels photo is actually on the
// page and disappears again if the last one is replaced. Nothing to remember by hand.
//
// Two rules both APIs actually require, both of which this script follows: the images are
// downloaded and served from our own domain (hotlinking a stock CDN is not allowed — it is
// also why Unsplash is not an option here, their guidelines require the opposite), and
// nothing mass-harvests the library — one image per task, once.
//
// Provenance is recorded whether or not the licence demands it. `provenance.json` keeps
// the source, the id, the page URL, the photographer and the date for every file, so in
// two years "where did this come from?" has an answer that is not a guess.
//
// The picks are not blind: --dry prints the candidates with their tags so a human decides
// before anything lands in the repo. A Bildbeschreibung lives or dies on whether the photo
// actually shows the scene, and a search engine does not know that.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";

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

// Landscape only, and wide enough that the picture still carries on a desktop; the learner
// is meant to read a scene off it, not squint at a thumbnail.
const MIN_WIDTH = 1200;
const PER_PAGE = 12;

/* Each source normalises its hits to the same shape: { id, width, height, author,
 * authorURL, tags, pageURL, fileURL }. Everything below this object is source-agnostic. */
const SOURCES = {
  pexels: {
    env: "PEXELS_API_KEY",
    // Pexels has no safesearch flag — the library is curated and its content policy
    // already excludes explicit material, so there is no switch to set. Pixabay has one
    // and it is set below; the difference is in their APIs, not in what we accept.
    request(key, q) {
      const p = new URLSearchParams({
        query: q,
        orientation: "landscape",
        size: "large",
        per_page: String(PER_PAGE),
      });
      return [`https://api.pexels.com/v1/search?${p}`, { headers: { Authorization: key } }];
    },
    hits: (json) => json.photos ?? [],
    norm: (h) => ({
      id: h.id,
      width: h.width,
      height: h.height,
      author: h.photographer,
      authorURL: h.photographer_url,
      // Pexels returns no tag list; `alt` is the one human-written line about the photo,
      // which is what --dry needs to show for a scene to be judged.
      tags: h.alt ?? "",
      pageURL: h.url,
      fileURL: h.src?.large2x ?? h.src?.original,
    }),
    license:
      "Pexels-Lizenz — freie kommerzielle Nutzung, keine Namensnennung nötig; die API-Richtlinien verlangen einen Link auf Pexels, der im Fuß der Sprechen-Seiten steht",
  },
  pixabay: {
    env: "PIXABAY_API_KEY",
    request(key, q) {
      const p = new URLSearchParams({
        key,
        q,
        image_type: "photo",
        orientation: "horizontal",
        min_width: String(MIN_WIDTH),
        // safesearch because this is a site for adult learners and their children look
        // over the shoulder.
        safesearch: "true",
        per_page: String(PER_PAGE),
        order: "popular",
      });
      return [`https://pixabay.com/api/?${p}`, {}];
    },
    hits: (json) => json.hits ?? [],
    norm: (h) => ({
      id: h.id,
      width: h.imageWidth,
      height: h.imageHeight,
      author: h.user,
      authorURL: `https://pixabay.com/users/${h.user}-${h.user_id}/`,
      tags: h.tags,
      pageURL: h.pageURL,
      fileURL: h.largeImageURL,
    }),
    license:
      "Pixabay Content License — freie kommerzielle Nutzung, keine Namensnennung nötig",
  },
};

/* Which library, and does it have a key. Named explicitly with --source; otherwise the one
 * whose key is present, preferring Pexels when both are. Getting this wrong is a confusing
 * failure ("key fehlt" for a service you were not trying to use), so it is decided once
 * here rather than at the first request. */
const asked = val("--source");
if (asked && !SOURCES[asked]) {
  console.error(`--source ${asked}: unbekannt. Möglich: ${Object.keys(SOURCES).join(", ")}`);
  process.exit(1);
}
const name = asked ?? (process.env[SOURCES.pexels.env] ? "pexels" : "pixabay");
const source = SOURCES[name];
const KEY = process.env[source.env];

if (!KEY) {
  console.error(`${source.env} fehlt.`);
  console.error(name === "pexels"
    ? "Kostenlos anlegen: https://www.pexels.com/api/"
    : "Kostenlos anlegen: https://pixabay.com/api/docs");
  console.error(`Dann in .env.local eintragen:  ${source.env}=…`);
  const other = name === "pexels" ? "pixabay" : "pexels";
  if (process.env[SOURCES[other].env]) console.error(`Oder die andere Quelle nehmen:  --source ${other}`);
  process.exit(1);
}

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

const provenance = existsSync(PROV) ? JSON.parse(readFileSync(PROV, "utf8")) : {};
if (!DRY) mkdirSync(OUT_DIR, { recursive: true });

console.log(`Quelle: ${name} · ${wanted.length} Aufgabe(n)`);

/* A 429 used to surface as a bare "HTTP 429" and the loop carried on burning the rest of
 * the queue against a limit that was already spent. Both APIs say in the response headers
 * how much is left and when it resets, so that gets printed and the run stops. */
function rateInfo(res) {
  const left = res.headers.get("x-ratelimit-remaining");
  const reset = res.headers.get("x-ratelimit-reset");
  const parts = [];
  if (left !== null) parts.push(`noch ${left} Anfragen`);
  if (reset !== null) {
    // Pixabay counts seconds until the window resets, Pexels gives a UNIX timestamp.
    const n = Number(reset);
    const secs = n > 1e6 ? Math.max(0, Math.round(n - Date.now() / 1000)) : n;
    parts.push(`zurückgesetzt in ${secs} s`);
  }
  return parts.length ? ` (${parts.join(", ")})` : "";
}

let taken = 0;
let missed = 0;

for (const task of wanted) {
  const q = task.imageQuery;
  console.log(`\n${task.id}  «${task.title}»`);
  console.log(`  Szene: ${task.imageNeeded}`);
  console.log(`  Suche: ${q}`);

  let hits;
  try {
    const res = await fetch(...source.request(KEY, q));
    if (res.status === 429) {
      console.log(`  ✗ Rate-Limit erreicht${rateInfo(res)} — Abbruch.`);
      console.log(`    Später weiter, oder die andere Quelle: --source ${name === "pexels" ? "pixabay" : "pexels"}`);
      missed++;
      break;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}${rateInfo(res)}`);
    // Pexels has no min_width filter, so the floor is applied here for both libraries
    // rather than trusting one of them to have honoured it.
    hits = source.hits(await res.json()).map(source.norm).filter((h) => h.width >= MIN_WIDTH);
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
      console.log(`  ${i + 1 === PICK ? "→" : " "} ${i + 1}. ${h.width}×${h.height} · ${h.author} · ${h.tags}`);
      console.log(`       ${h.pageURL}`);
    });
    continue;
  }

  const hit = hits[PICK - 1] ?? hits[0];
  const file = `${task.id}.jpg`;
  const dest = path.join(OUT_DIR, file);

  try {
    const img = await fetch(hit.fileURL);
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
    source: name,
    sourceId: hit.id,
    pageURL: hit.pageURL,
    photographer: hit.author,
    photographerURL: hit.authorURL,
    tags: hit.tags,
    license: source.license,
    query: q,
    fetched: new Date().toISOString().slice(0, 10),
  };
  taken++;
  console.log(`  ✓ ${file} — ${hit.author} · ${hit.pageURL}`);
}

if (!DRY && taken) {
  writeFileSync(PROV, JSON.stringify(provenance, null, 2) + "\n");
  writeFileSync(DATA, JSON.stringify(data, null, 2) + "\n");
  console.log(`\n${taken} Bilder geholt, ${DATA} und ${PROV} aktualisiert.`);
  console.log("Jetzt anschauen: pnpm dev, dann /uebungen/sprechen — ein Foto, das die Szene");
  console.log("nicht zeigt, ist schlechter als die Beschreibung. Mit --only <id> --pick N neu wählen.");
}
if (missed) console.log(`${missed} Aufgaben ohne Bild geblieben.`);

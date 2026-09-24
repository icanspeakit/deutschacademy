// The flat URL structure (2026-09-24) and the way from the old one to it.
//
// Before: /uebungen/grammatik/artikel, /uebungen/hoeren/<id>, /pruefungen/telc …
// After:  /artikel, /hoeren/<id>, /telc …
//
// Grammar topics sit at the top level because every one of their names is unique and is
// what a learner would type. Everything with generic ids (Hören, Lesen, Kultur, Sprechen,
// Schreiben, the ~500 Wortschatz sets) keeps one level of section, so "/a1-supermarkt" can
// never collide with a topic added later. The hubs /uebungen and /pruefungen stay.
//
// One table, used twice: astro.config.mjs turns it into 301 redirects, and progress.js
// rewrites "where I was" entries saved in a browser before the move.

export const SECTIONS = [
  "wortschatz", "hoeren", "kultur", "lesen-schreiben", "lesen", "schreiben", "sprechen-b1b2", "sprechen",
  "aussprache-check", "aussprache", "fertigkeiten", "praepositionen",
];
export const EXAMS = ["telc", "goethe", "testdaf", "dtz", "leben-in-deutschland", "start-deutsch-1"];

/** An old path → its new path (unchanged when it was not moved). */
export function flattenPath(path) {
  if (typeof path !== "string") return path;
  let m;
  if ((m = path.match(/^\/uebungen\/grammatik\/(quiz|lauf)(\/.*)?$/))) return `/grammatik/${m[1]}${m[2] ?? ""}`;
  if ((m = path.match(/^\/uebungen\/grammatik\/(.+)$/))) return `/${m[1]}`;
  if (path === "/uebungen/grammatik") return "/grammatik";
  if (path === "/uebungen/artikel-trainer") return "/artikel";
  if ((m = path.match(/^\/uebungen\/([a-z0-9-]+)(\/.*)?$/)) && SECTIONS.includes(m[1])) return `/${m[1]}${m[2] ?? ""}`;
  if ((m = path.match(/^\/pruefungen\/([a-z0-9-]+)(\/.*)?$/)) && EXAMS.includes(m[1])) return `/${m[1]}${m[2] ?? ""}`;
  return path;
}

/** Pages that are hubs or overviews — places you pass through, not places you resume. */
export const NOT_RESUMABLE = new Set(["/", "/uebungen", "/pruefungen", "/fortschritt", "/grammatik", "/wissen",
  "/anmelden", "/passwort-neu", "/impressum", "/datenschutz", "/nutzungsbedingungen", "/einstufungstest",
  "/hoeren", "/lesen", "/schreiben", "/sprechen", "/kultur", "/wortschatz", "/fertigkeiten"]);

/**
 * The redirects, in the shape astro.config.mjs wants. Dynamic entries keep their params
 * (Astro and the Vercel adapter both support that for static output); the fixed ones
 * cover pages without an [id]. A #hash (e.g. #aktiv) survives a redirect in every browser.
 */
export function legacyRedirects() {
  const r = {
    "/uebungen/grammatik": "/grammatik",
    "/uebungen/grammatik/quiz": "/grammatik/quiz",
    "/uebungen/grammatik/lauf": "/grammatik/lauf",
    "/uebungen/grammatik/akkusativ": "/akkusativ",
    "/uebungen/grammatik/[id]": "/[id]",
    "/uebungen/wortschatz/[deck]": "/wortschatz/[deck]",
    "/uebungen/kultur/quiz": "/kultur/quiz",
    "/uebungen/sprechen/dtz-bildbeschreibung": "/sprechen/dtz-bildbeschreibung",
    "/uebungen/sprechen/set/[id]": "/sprechen/set/[id]",
    "/uebungen/artikel-trainer": "/artikel",
  };
  for (const s of SECTIONS) r[`/uebungen/${s}`] = `/${s}`;
  for (const s of ["hoeren", "kultur", "lesen", "schreiben", "sprechen"]) r[`/uebungen/${s}/[id]`] = `/${s}/[id]`;
  for (const e of EXAMS) r[`/pruefungen/${e}`] = `/${e}`;
  r["/pruefungen/telc/sprachbausteine"] = "/telc/sprachbausteine";
  r["/pruefungen/testdaf/uebungssatz"] = "/testdaf/uebungssatz";
  r["/pruefungen/dtz/mock-test"] = "/dtz/mock-test";
  r["/pruefungen/dtz/uebungssatz"] = "/dtz/uebungssatz";
  r["/pruefungen/leben-in-deutschland/fakten"] = "/leben-in-deutschland/fakten";
  r["/pruefungen/leben-in-deutschland/test"] = "/leben-in-deutschland/test";
  return r;
}

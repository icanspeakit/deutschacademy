// Checks everything /wissen promises: that our own PDFs exist, and that the external
// links still lead somewhere.
//
//   pnpm check:downloads          files + links
//   pnpm check:downloads --files  skip the network, just the PDFs
//
// Why it exists: three of the four "Offizielle Materialien" links rotted without anyone
// noticing. Two answered 404 and one quietly redirected from the exam page to the generic
// goethe.de/de/spr.html hub — which is worse than a 404, because the page loads and the
// learner just cannot find what the card promised. Nothing on the site could have caught
// that; it renders fine either way.
//
// A redirect is therefore reported, not followed silently: landing somewhere else is the
// failure mode this script exists to catch.
import { readFileSync, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const data = JSON.parse(readFileSync(path.join(root, "src/data/downloads.json"), "utf8"));
const FILES_ONLY = process.argv.includes("--files");

// A desktop UA: several publishers answer 403 to anything that looks automated.
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

let bad = 0;

/* ----------------------------------------------------------------- files -- */

console.log(`Dateien (${data.files.length})`);
for (const f of data.files) {
  const p = path.join(root, "public", "downloads", f.file);
  if (!existsSync(p)) {
    console.log(`  MISSING  ${f.file}`);
    bad++;
    continue;
  }
  const kb = Math.round(statSync(p).size / 1024);
  // A PDF that generated but held nothing still "exists"; a few KB means an empty shell.
  const thin = kb < 8;
  if (thin) bad++;
  console.log(`  ${thin ? "THIN   " : "ok     "}  ${String(kb).padStart(5)} KB  ${f.file}`);
}

/* ----------------------------------------------------------------- links -- */

if (!FILES_ONLY) {
  console.log(`\nLinks (${data.links.length})`);
  for (const l of data.links) {
    let line;
    try {
      // manual: a 30x that lands on a different page is the thing we want to see.
      const r = await fetch(l.href, { redirect: "manual", headers: { "user-agent": UA } });
      const to = r.headers.get("location");
      if (r.status >= 300 && r.status < 400 && to) {
        const abs = new URL(to, l.href).href;
        line = `REDIRECT ${r.status} → ${abs}`;
        bad++;
      } else if (r.status === 403) {
        // goethe.de blocks scripted requests but serves humans fine. Flagged, not failed —
        // verify this one in a browser rather than trusting either answer.
        line = "403      (bot-blocked, prüf im Browser)";
      } else if (!r.ok) {
        line = `DEAD     ${r.status}`;
        bad++;
      } else {
        line = `ok       ${r.status}`;
      }
    } catch (e) {
      line = `ERROR    ${e.message}`;
      bad++;
    }
    console.log(`  ${line}  ${l.title}`);
  }
}

console.log(bad ? `\n${bad} Problem(e).` : "\nAlles in Ordnung.");
process.exit(bad ? 1 : 0);

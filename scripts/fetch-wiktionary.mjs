// Attaches curated IPA to src/content/lexicon/*.json and audits the stored morphology
// against de.wiktionary.org.
//
//   node scripts/fetch-wiktionary.mjs                    # all levels
//   node scripts/fetch-wiktionary.mjs a1                 # one level
//   node scripts/fetch-wiktionary.mjs a1 --unit a1-01    # one unit (start here)
//   node scripts/fetch-wiktionary.mjs a1 --dry           # fetch + audit, write nothing
//
// Same shape as attach-ranks.mjs: plain Node, no dependencies, downloads once and caches, then
// merges in place. Rationale, the rejected espeak-ng alternative and every parser rule below:
// docs/lexicon-enrichment-v1.md.
//
// WRITES  ipa, ipaVariants, ipaSource   (only these — see below)
// AUDITS  gender, plural, comparative, superlative   -> docs/lexicon-audit-v1.md
//
// It deliberately does NOT overwrite morphology. A disagreement between this repo and Wiktionary
// is often a deliberate pedagogical simplification (one plural where Wiktionary lists two), so
// the script reports and a human decides. `ipa` is different: the repo has no prior value to
// defend, so sourcing it outright is safe.
//
// Requires network access to de.wiktionary.org. Reachable locally and from Claude Code; blocked
// by the egress proxy in the Cowork cloud sandbox, so run this on the workstation.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const API = "https://de.wiktionary.org/w/api.php";
const UA = "deutschacademy-lexicon/0.1 (https://deutschacademy.com; build script)";
const BATCH = 50; // API maximum for titles=A|B|C — 8k lemmas becomes ~160 calls
const PAUSE_MS = 400;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const CACHE_DIR = path.join(ROOT, "node_modules", ".cache", "wiktionary");
const ALL_LEVELS = ["a1", "a2", "b1", "b2", "c1", "c2"];

const argv = process.argv.slice(2);
const DRY = argv.includes("--dry");
const unitFilter = argv.includes("--unit") ? argv[argv.indexOf("--unit") + 1] : null;
const levels = argv.filter((a) => ALL_LEVELS.includes(a.toLowerCase())).map((a) => a.toLowerCase());
const targetLevels = levels.length ? levels : ALL_LEVELS;

// ---------------------------------------------------------------------------
// Fetch + cache
// ---------------------------------------------------------------------------

const safe = (title) => encodeURIComponent(title).replace(/[%*?:<>|"\\/]/g, "_");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function cached(title) {
  const f = path.join(CACHE_DIR, `${safe(title)}.wiki`);
  return existsSync(f) ? readFileSync(f, "utf8") : null;
}

function cache(title, text) {
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(path.join(CACHE_DIR, `${safe(title)}.wiki`), text, "utf8");
}

/** Fetches wikitext for up to BATCH titles. Returns Map<title, wikitext|"">. */
async function fetchBatch(titles) {
  const url =
    `${API}?action=query&prop=revisions&rvprop=content&rvslots=main` +
    `&format=json&formatversion=2&redirects=1&titles=${titles.map(encodeURIComponent).join("%7C")}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`Wiktionary API ${res.status} ${res.statusText}`);
  const data = await res.json();

  const out = new Map();
  // `redirects` and `normalized` mean a returned page title may differ from what we asked for;
  // map it back so the caller can look up by its own lemma.
  const back = new Map();
  for (const n of data.query?.normalized ?? []) back.set(n.to, n.from);
  for (const r of data.query?.redirects ?? []) back.set(r.to, back.get(r.from) ?? r.from);

  for (const page of data.query?.pages ?? []) {
    const asked = back.get(page.title) ?? page.title;
    out.set(asked, page.missing ? "" : page.revisions?.[0]?.slots?.main?.content ?? "");
  }
  for (const t of titles) if (!out.has(t)) out.set(t, "");
  return out;
}

async function wikitextFor(titles) {
  const result = new Map();
  const todo = [];
  for (const t of titles) {
    const hit = cached(t);
    if (hit === null) todo.push(t);
    else result.set(t, hit);
  }
  for (let i = 0; i < todo.length; i += BATCH) {
    const slice = todo.slice(i, i + BATCH);
    process.stdout.write(`  fetching ${i + 1}–${i + slice.length} of ${todo.length}…\r`);
    const got = await fetchBatch(slice);
    for (const [t, text] of got) {
      cache(t, text);
      result.set(t, text);
    }
    if (i + BATCH < todo.length) await sleep(PAUSE_MS);
  }
  if (todo.length) process.stdout.write("\n");
  return result;
}

// ---------------------------------------------------------------------------
// Parsing — every rule here corresponds to a wrong result from the naive version.
// See docs/lexicon-enrichment-v1.md §4.
// ---------------------------------------------------------------------------

/**
 * RULE 1 — isolate the German section before extracting anything.
 * `alt` carries Deutsch, Italienisch, Katalanisch and Polnisch sections; parsing the whole page
 * returns the Polish plural "alty" for a German adjective.
 */
function germanSection(wikitext) {
  if (!wikitext) return null;
  const lines = wikitext.split("\n");
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^==[^=]/.test(l) && /\{\{Sprache\|Deutsch\}\}/.test(l)) {
      start = i + 1;
      break;
    }
  }
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start; i < lines.length; i++) {
    if (/^==[^=]/.test(lines[i])) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join("\n");
}

/**
 * RULES 3, 4, 5 — multiple {{Lautschrift}} on the IPA line are pronunciation variants, not
 * duplicates (Mädchen: ˈmɛːtçən, ˈmeːtçən). Anything after {{Pl.}} is the plural's pronunciation,
 * not a variant of the singular. Empty {{Lautschrift||spr=xx}} must be skipped, not stored as "".
 */
function extractIpa(section) {
  if (!section) return [];
  const line = section.split("\n").find((l) => l.includes("{{IPA}}") && l.includes("{{Lautschrift"));
  if (!line) return [];
  const singular = line.split("{{Pl.}}")[0];
  const out = [];
  for (const m of singular.matchAll(/\{\{Lautschrift\|([^}|]*)/g)) {
    const v = m[1].trim();
    if (v && !out.includes(v)) out.push(v);
  }
  return out;
}

/** First {{Deutsch <kind> Übersicht}} block in the German section. */
function uebersicht(section, kind) {
  if (!section) return null;
  const m = section.match(new RegExp(`\\{\\{Deutsch ${kind} Übersicht([\\s\\S]*?)\\n\\}\\}`));
  return m ? m[1] : null;
}

// A dash is Wiktionary's way of saying "this form does not exist" (verheiratet has no
// comparative). That is data, not a value — returning it as a string makes every uninflectable
// word look like a disagreement.
const NONE = new Set(["—", "–", "-", "", "?"]);

function param(block, name) {
  if (!block) return null;
  const m = block.match(new RegExp(`\\|\\s*${name.replace(/[.*+?^${}()[\]\\]/g, "\\$&")}\\s*=\\s*([^\\n|}]*)`));
  const v = m?.[1]?.trim();
  return v && !NONE.has(v) ? v : null;
}

/** RULE 2 — plural params are numbered (Mädchen: "Nominativ Plural 1", "… 2"). */
function plurals(block) {
  if (!block) return [];
  const out = [];
  for (const m of block.matchAll(/\|\s*Nominativ Plural(?:\s+\d+)?\s*=\s*([^\n|}]*)/g)) {
    const v = m[1].trim();
    if (v && v !== "—" && v !== "-" && !out.includes(v)) out.push(v);
  }
  return out;
}

/** RULE 7 — Wiktionary uses m/f/n, this repo uses der/die/das. */
const GENUS = { m: "der", f: "die", n: "das" };

/** RULE 6 — normalise for comparison only; the repo stores "am ältesten" and keeps it. */
const bare = (s) => (s == null ? null : String(s).replace(/^am\s+/, "").trim());

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

const audit = [];
const stats = { words: 0, ipa: 0, noGerman: 0, noIpa: 0, checked: 0, mismatch: 0 };

for (const level of targetLevels) {
  const file = path.join(ROOT, "src/content/lexicon", `${level}.json`);
  if (!existsSync(file)) {
    console.warn(`skip ${level}: no such file`);
    continue;
  }
  const data = JSON.parse(readFileSync(file, "utf8"));
  const units = (data.units ?? []).filter((u) => !unitFilter || u.id === unitFilter);
  if (!units.length) {
    console.log(`${level}: no units match${unitFilter ? ` --unit ${unitFilter}` : ""}`);
    continue;
  }

  const titles = [...new Set(units.flatMap((u) => (u.words ?? []).map((w) => w.lemma)))];
  console.log(`${level}: ${titles.length} lemmas across ${units.length} unit(s)`);
  const pages = await wikitextFor(titles);

  for (const unit of units) {
    for (const w of unit.words ?? []) {
      stats.words++;
      const where = `${unit.id}/${w.lemma}`;
      const section = germanSection(pages.get(w.lemma) ?? "");

      if (!section) {
        stats.noGerman++;
        audit.push({ where, field: "—", repo: "", wiktionary: "", note: "no German section on page (or page missing)" });
        continue;
      }

      // --- IPA: sourced outright, since the repo holds no prior value ---
      const ipa = extractIpa(section);
      if (ipa.length) {
        w.ipa = ipa[0];
        if (ipa.length > 1) w.ipaVariants = ipa.slice(1);
        else delete w.ipaVariants;
        w.ipaSource = "wiktionary";
        stats.ipa++;
      } else {
        stats.noIpa++;
        audit.push({ where, field: "ipa", repo: "", wiktionary: "", note: "German section has no {{Lautschrift}}" });
      }

      // --- Morphology: audited, never overwritten ---
      const kind = w.pos === "noun" ? "Substantiv" : w.pos === "verb" ? "Verb" : w.pos === "adj" ? "Adjektiv" : null;
      if (!kind) continue;
      const block = uebersicht(section, kind);
      if (!block) {
        audit.push({ where, field: "—", repo: "", wiktionary: "", note: `no {{Deutsch ${kind} Übersicht}} block` });
        continue;
      }

      const cmp = (field, repoVal, wikiVal) => {
        if (wikiVal == null) return;
        stats.checked++;
        if (bare(repoVal) !== bare(wikiVal)) {
          stats.mismatch++;
          audit.push({ where, field, repo: repoVal ?? "(none)", wiktionary: wikiVal, note: "" });
        }
      };

      if (w.pos === "noun") {
        const g = param(block, "Genus") ?? param(block, "Genus 1");
        cmp("gender", w.gender, g ? GENUS[g] ?? g : null);

        const pl = plurals(block);
        if (pl.length) {
          if (!pl.some((p) => bare(p) === bare(w.plural))) {
            stats.checked++;
            stats.mismatch++;
            audit.push({ where, field: "plural", repo: w.plural ?? "(none)", wiktionary: pl.join(" / "), note: pl.length > 1 ? "several valid plurals" : "" });
          } else {
            stats.checked++;
            if (pl.length > 1) audit.push({ where, field: "plural", repo: w.plural, wiktionary: pl.join(" / "), note: "repo picks one of several valid plurals — fine, noted" });
          }
        }
      }

      if (w.pos === "adj") {
        cmp("comparative", w.comparative, param(block, "Komparativ"));
        cmp("superlative", w.superlative, param(block, "Superlativ"));
      }

      // Verb forms. Parameter names confirmed 2026-09-17 against the live blocks for heißen,
      // kommen, wohnen, sprechen, sein and haben — all six expose exactly these three, which map
      // onto this repo's forms = [3rd sg present, Präteritum, Partizip II].
      if (w.pos === "verb") {
        const wiki = [
          param(block, "Präsens_er, sie, es"),
          param(block, "Präteritum_ich"),
          param(block, "Partizip II"),
        ];
        const repo = w.forms ?? [];
        const labels = ["forms[0] 3.Sg", "forms[1] Präteritum", "forms[2] Partizip II"];
        wiki.forEach((v, i) => cmp(labels[i], repo[i], v));
      }
    }
  }

  if (!DRY) {
    writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
    console.log(`${level}: written`);
  }
}

// ---------------------------------------------------------------------------
// Audit report
// ---------------------------------------------------------------------------

const lines = [
  `# Lexicon audit — stored morphology vs de.wiktionary.org`,
  ``,
  `Generated by \`scripts/fetch-wiktionary.mjs\` on ${new Date().toISOString().slice(0, 10)}.`,
  `Scope: ${targetLevels.join(", ")}${unitFilter ? ` — unit ${unitFilter}` : ""}.`,
  ``,
  `**This is a report, not a change.** Nothing in \`src/content/lexicon/\` was overwritten except`,
  `\`ipa\`/\`ipaVariants\`/\`ipaSource\`. A disagreement is not automatically an error — the repo may`,
  `be simplifying deliberately. Decide per row.`,
  ``,
  `| words | ipa attached | no German section | no IPA | morphology checks | disagreements |`,
  `| ---: | ---: | ---: | ---: | ---: | ---: |`,
  `| ${stats.words} | ${stats.ipa} | ${stats.noGerman} | ${stats.noIpa} | ${stats.checked} | ${stats.mismatch} |`,
  ``,
];

if (audit.length) {
  lines.push(`| where | field | repo | wiktionary | note |`, `| --- | --- | --- | --- | --- |`);
  for (const r of audit) {
    lines.push(`| ${r.where} | ${r.field} | ${r.repo} | ${r.wiktionary} | ${r.note} |`);
  }
} else {
  lines.push(`No disagreements and nothing missing.`);
}

const reportPath = path.join(ROOT, "docs", "lexicon-audit-v1.md");
writeFileSync(reportPath, lines.join("\n") + "\n", "utf8");

console.log(
  `\n${stats.words} words · ${stats.ipa} IPA attached · ${stats.noIpa} without IPA · ` +
    `${stats.noGerman} without a German section · ${stats.checked} morphology checks, ${stats.mismatch} disagreements`
);
console.log(`report: docs/lexicon-audit-v1.md${DRY ? "  (--dry: lexicon not written)" : ""}`);

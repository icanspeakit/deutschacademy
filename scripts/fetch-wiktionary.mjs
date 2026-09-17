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

// --fill writes sourced morphology into fields that are null or absent. It never touches a field
// that already holds a value — filling a gap is not the same as overruling a human, and only the
// first is safe to automate. Generated rows arrive with gender/plural/forms explicitly null for
// exactly this pass to find; curated A1/A2 rows have values, so they stay audit-only either way.
const FILL = argv.includes("--fill");

// An explicit `null` means "awaiting sourcing" — generated rows arrive that way on purpose.
// An ABSENT field means a curator left it out, which is often deliberate (Alter has no plural in
// the "age" sense even though Wiktionary lists one). --fill writes the first and never the second.
// Proven necessary: the naive `== null` check filled Alter's plural on curated A1 data.
const awaiting = (w, field) => field in w && w[field] === null;
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

/** Single title, cache-first — used by the compound-head fallback, which needs a few extra pages. */
async function onePage(title) {
  const hit = cached(title);
  if (hit !== null) return hit;
  const got = await fetchBatch([title]);
  const text = got.get(title) ?? "";
  cache(title, text);
  await sleep(PAUSE_MS);
  return text;
}

/**
 * Walks the compound's head candidates and returns the first that is a German noun with a
 * {{Deutsch Substantiv Übersicht}} block. Caps the number of lookups — a long compound has many
 * candidate suffixes and most are nonsense.
 */
async function resolveViaHead(lemma) {
  let tries = 0;
  for (const head of headCandidates(lemma)) {
    if (tries++ >= 24) break;
    const sec = germanSection(await onePage(head));
    if (!sec) continue;
    const block = uebersicht(sec, "Substantiv");
    if (!block) continue;
    const gender = toGender(param(block, "Genus") ?? param(block, "Genus 1"));
    if (!gender) continue;
    const pl = plurals(block);
    return { head, gender, plural: pluralFromHead(lemma, head, pl[0] ?? null) };
  }
  return null;
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

/**
 * COMPOUND HEAD FALLBACK.
 *
 * German Wiktionary has thin coverage of long administrative compounds — measured at 18 of 125
 * generated B1 lemmas, all of them real words (Niederlassungserlaubnis, Wohnberechtigungsschein,
 * Mietspiegel, Prüfungsordnung, Lebensmittelverschwendung). A missing page there is a coverage
 * gap, not evidence the word was invented, and treating the two the same made the quality gate
 * useless.
 *
 * A German compound takes its gender and its plural pattern from its LAST element:
 * die Erlaubnis → die Niederlassungserlaubnis; Erlaubnis/Erlaubnisse → …erlaubnis/…erlaubnisse.
 * So when the whole compound misses, look up progressively shorter suffixes and inherit from the
 * head. Anything sourced this way is stamped `wiktionary-compound-head` — it is an inference from
 * a sourced fact, not the same thing as a sourced fact, and the audit report must say so.
 *
 * Returns candidate heads longest-first, capitalised as a noun.
 */
function headCandidates(lemma) {
  const out = [];
  for (let i = 1; i <= lemma.length - 4; i++) {
    const tail = lemma.slice(i);
    out.push(tail[0].toUpperCase() + tail.slice(1));
  }
  return out;
  // LONGEST FIRST, deliberately. A short suffix can be a real word without being the head —
  // Lebensmittelverschwendung ends in "…endung", and die Endung would give the right gender but
  // build the plural as "Lebensmittelverschendungen". Finding the true head first avoids that.
  // Two earlier bugs, both measured: skipping heads that start with s/n threw away …schein, and
  // a 6-try cap never reached Erlaubnis in Niederlassungserlaubnis (14 suffixes down).
}

/** Applies the head's plural pattern to the compound: Erlaubnis→Erlaubnisse ⇒ …erlaubnis→…erlaubnisse. */
function pluralFromHead(lemma, head, headPlural) {
  if (!headPlural) return null;
  const idx = lemma.toLowerCase().lastIndexOf(head.toLowerCase());
  if (idx < 0) return null;
  const prefix = lemma.slice(0, idx);
  return prefix + headPlural[0].toLowerCase() + headPlural.slice(1);
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

/**
 * RULE 7 — Wiktionary uses m/f/n, this repo uses der/die/das.
 * Only those three map. A template can carry `Genus=0` or other junk in the slot, and passing it
 * through produced `bad gender "0"` on Heizkosten — caught by validate-lexicon.mjs, which is the
 * argument for the validator running after every fill rather than at the end of the project.
 */
const GENUS = { m: "der", f: "die", n: "das" };
const toGender = (g) => (g && GENUS[g]) || null;

/** RULE 6 — normalise for comparison only; the repo stores "am ältesten" and keeps it. */
const bare = (s) => (s == null ? null : String(s).replace(/^am\s+/, "").trim());

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

const audit = [];
const stats = { words: 0, ipa: 0, noGerman: 0, noIpa: 0, checked: 0, mismatch: 0, filled: 0, gaps: 0, viaHead: 0, unresolved: 0 };

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
        // A missing page is a coverage gap for compounds, not proof of invention. Try the head.
        // pluralOnly nouns (Heizkosten, Eltern) have no gender by design — the validator exempts
        // them, and filling one in is a regression, not a gap being closed.
        if (w.pos === "noun" && !w.pluralOnly && (awaiting(w, "gender") || awaiting(w, "plural"))) {
          const viaHead = await resolveViaHead(w.lemma);
          if (viaHead) {
            stats.viaHead++;
            if (FILL) {
              if (awaiting(w, "gender") && viaHead.gender) w.gender = viaHead.gender;
              if (awaiting(w, "plural")) w.plural = viaHead.plural; // may stay null — honest
              w.morphSource = "wiktionary-compound-head";
              stats.filled++;
            }
            audit.push({
              where,
              field: "gender/plural",
              repo: FILL ? `${viaHead.gender ?? "?"} / ${viaHead.plural ?? "(none)"}` : "(null)",
              wiktionary: `inherited from head "${viaHead.head}"`,
              note: FILL ? "INFERRED from the compound head, not sourced directly — verify" : "head resolvable — re-run with --fill",
            });
            continue;
          }
          audit.push({ where, field: "—", repo: "", wiktionary: "", note: "no page AND no resolvable head — verify this word exists" });
          stats.unresolved++;
          continue;
        }
        // A VERB with no page is as doubtful as a noun with no page — it just fails quieter,
        // because the validator does not require `forms` the way it requires `gender`.
        // `instandsetzen` shipped that way in b2-tranche-4 and was caught by hand, not by this
        // number: no page (the standard spelling is the separated *instand setzen*), so `forms`
        // stayed null and the Verbformen trainer would never have seen the row. There is no head
        // to inherit verb forms from, so it counts straight as unresolved.
        //
        // ADJECTIVES are deliberately NOT counted here, though the first version of this check
        // did count them. Measured across the whole lexicon it flagged exactly four —
        // berufsbegleitend, eigenverantwortlich, überparteilich, verkehrsberuhigt — every one of
        // them ordinary current German that de.wiktionary simply has no page for. An adjective
        // with no page loses only `ipa` and a comparative that most of these do not have anyway;
        // nothing required goes missing. That is a Wiktionary coverage gap, the same kind the
        // compound-head fallback exists for, not a reason to doubt the word.
        if (w.pos === "verb") {
          audit.push({ where, field: "—", repo: "", wiktionary: "", note: "no page for this verb — verify the lemma and its spelling" });
          stats.unresolved++;
          continue;
        }
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

      // Fill a gap, or audit a value. `null` and absent both count as a gap; anything else is a
      // human's answer and only gets compared.
      const fillOrCmp = (field, wikiVal, transform = (v) => v) => {
        if (wikiVal == null) return;
        if (w[field] == null) {
          if (!awaiting(w, field)) return; // absent by a curator's choice — leave it alone
          if (FILL) {
            w[field] = transform(wikiVal);
            stats.filled++;
          } else {
            stats.gaps++;
            audit.push({ where, field, repo: "(null)", wiktionary: String(wikiVal), note: "gap — re-run with --fill to write it" });
          }
          return;
        }
        cmp(field, w[field], wikiVal);
      };

      if (w.pos === "noun") {
        if (!w.pluralOnly) fillOrCmp("gender", toGender(param(block, "Genus") ?? param(block, "Genus 1")));

        const pl = plurals(block);
        if (pl.length && (w.plural != null || awaiting(w, "plural"))) {
          if (w.plural == null) {
            // Several valid plurals is normal (Mädchen/Mädchens). Take the first, which is
            // Wiktionary's primary, and record that a choice was made.
            if (FILL) {
              w.plural = pl[0];
              stats.filled++;
              if (pl.length > 1) audit.push({ where, field: "plural", repo: pl[0], wiktionary: pl.join(" / "), note: "filled with the first of several valid plurals" });
            } else {
              stats.gaps++;
              audit.push({ where, field: "plural", repo: "(null)", wiktionary: pl.join(" / "), note: "gap — re-run with --fill to write it" });
            }
          } else if (!pl.some((p) => bare(p) === bare(w.plural))) {
            stats.checked++;
            stats.mismatch++;
            audit.push({ where, field: "plural", repo: w.plural, wiktionary: pl.join(" / "), note: pl.length > 1 ? "several valid plurals" : "" });
          } else {
            stats.checked++;
            if (pl.length > 1) audit.push({ where, field: "plural", repo: w.plural, wiktionary: pl.join(" / "), note: "repo picks one of several valid plurals — fine, noted" });
          }
        }
      }

      if (w.pos === "adj") {
        fillOrCmp("comparative", param(block, "Komparativ"));
        // The repo stores the superlative with the `am ` prefix; Wiktionary does not.
        fillOrCmp("superlative", param(block, "Superlativ"), (v) => (/^am\s/.test(v) ? v : `am ${v}`));
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
        if (w.forms == null && !awaiting(w, "forms")) {
          // absent by a curator's choice (a verb they chose not to give forms for) — leave it
        } else if (w.forms == null) {
          // forms is all-or-nothing: the validator requires exactly 3, so a partial source is a
          // gap to report, never a two-element array written into the data.
          if (wiki.every((v) => v)) {
            if (FILL) {
              w.forms = wiki;
              stats.filled++;
            } else {
              stats.gaps++;
              audit.push({ where, field: "forms", repo: "(null)", wiktionary: wiki.join(", "), note: "gap — re-run with --fill to write it" });
            }
          } else {
            stats.gaps++;
            audit.push({ where, field: "forms", repo: "(null)", wiktionary: wiki.map((v) => v ?? "?").join(", "), note: "INCOMPLETE on Wiktionary — needs a human" });
          }
        } else {
          const labels = ["forms[0] 3.Sg", "forms[1] Präteritum", "forms[2] Partizip II"];
          wiki.forEach((v, i) => cmp(labels[i], w.forms[i], v));
        }
        const aux = param(block, "Hilfsverb");
        if (aux && !["haben", "sein"].includes(aux)) {
          audit.push({ where, field: "aux", repo: w.aux ?? "(null)", wiktionary: aux, note: "unexpected Hilfsverb value — not written" });
        } else {
          fillOrCmp("aux", aux);
        }
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
  `| words | ipa attached | no German section | no IPA | morphology checks | disagreements | ${FILL ? "fields filled" : "gaps"} |`,
  `| ---: | ---: | ---: | ---: | ---: | ---: | ---: |`,
  `| ${stats.words} | ${stats.ipa} | ${stats.noGerman} | ${stats.noIpa} | ${stats.checked} | ${stats.mismatch} | ${FILL ? stats.filled : stats.gaps} |`,
  ``,
  `> **The quality signal for generated rows is \`unresolved\`, not \`no German section\`.**`,
  `> German Wiktionary covers long administrative compounds poorly, so a missing page usually means`,
  `> thin coverage, not an invented word. ${stats.noGerman} of ${stats.words} lemmas had no page;`,
  `> ${stats.viaHead} of those resolved through their compound head; **${stats.unresolved} resolved`,
  `> neither way and are the rows worth doubting** (${stats.words ? Math.round((stats.unresolved / stats.words) * 100) : 0}%).`,
  ``,
  `> Rows marked \`morphSource: "wiktionary-compound-head"\` are INFERRED from the head's gender and`,
  `> plural pattern (die Erlaubnis ⇒ die Niederlassungserlaubnis). Sound German morphology, but an`,
  `> inference — spot-check them.`,
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
    `${stats.noGerman} without a German section · ${stats.checked} morphology checks, ${stats.mismatch} disagreements` +
    (FILL ? ` · ${stats.filled} fields filled` : ` · ${stats.gaps} gaps (use --fill)`)
);
console.log(
  `${stats.noGerman} without a page: ${stats.viaHead} resolved via compound head, ${stats.unresolved} unresolved (these are the doubtful ones)`
);
console.log(`report: docs/lexicon-audit-v1.md${DRY ? "  (--dry: lexicon not written)" : ""}  [HEAD_FALLBACK_V4]`);

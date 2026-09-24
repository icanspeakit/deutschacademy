// "Woher kommt das Wort?" — the etymology line under the Artikel-Trainer's card.
//
//   node scripts/artikel-herkunft.mjs          # all A1–B2 nouns, cache-first
//   node scripts/artikel-herkunft.mjs --dry    # print a sample, write nothing
//
// Source: the {{Herkunft}} section of de.wiktionary.org (CC BY-SA 4.0 — the trainer links
// each entry back to its page). Reads the page cache fetch-wiktionary.mjs already keeps in
// node_modules/.cache/wiktionary and fetches only what is missing.
//
// The wikitext becomes plain German: templates reduced to their word, refs and markup dropped.
// Kept to the first two sentences, and cut at a sentence end under MAX — a learner reads it
// between two taps, it is not the dictionary entry. Compounds whose Herkunft is only
// "Determinativkompositum aus X und Y" are kept: that IS the useful fact for them.
//
// WRITES public/data/artikel-herkunft.json   { id: text }
//
// Served as a static file and fetched by the trainer on the first card (artikelHerkunft.js):
// ~250 KB of prose is too much to inline into a page that most visits use for 25 words.
// The link back to Wiktionary is built from the lemma, which the trainer already has.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { nouns } from "../src/lib/lexicon.js";

const API = "https://de.wiktionary.org/w/index.php";
const UA = "deutschacademy-lexicon/0.1 (https://deutschacademy.com; build script)";
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const CACHE_DIR = path.join(ROOT, "node_modules", ".cache", "wiktionary");
const OUT = path.join(ROOT, "public", "data", "artikel-herkunft.json");
const DRY = process.argv.includes("--dry");
const MAX = 320;

const safe = (title) => encodeURIComponent(title).replace(/[%*?:<>|"\\/]/g, "_");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function page(title) {
  const f = path.join(CACHE_DIR, `${safe(title)}.wiki`);
  if (existsSync(f)) return readFileSync(f, "utf8");
  const res = await fetch(`${API}?title=${encodeURIComponent(title)}&action=raw`, { headers: { "User-Agent": UA } });
  const text = res.ok ? await res.text() : "";
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(f, text, "utf8");
  await sleep(300);
  return text;
}

/** The German-noun Herkunft of a page: the first {{Herkunft}} after a Substantiv heading. */
function herkunftSection(wiki) {
  const de = wiki.split(/\n== .*\(\{\{Sprache\|/).find((s) => s.startsWith("Deutsch}}")) ?? wiki;
  const noun = de.split(/\n=== /).find((s) => /Wortart\|Substantiv\|Deutsch/.test(s)) ?? de;
  const m = noun.match(/\{\{Herkunft\}\}\n([\s\S]*?)(?=\n\{\{[A-ZÄÖÜ][^|}]*\}\}|\n==|$)/);
  return m ? m[1] : null;
}

// Wiktionary's language-label templates: {{gmh.}} renders "mittelhochdeutsch".
const LANG = {
  gmh: "mittelhochdeutsch", mhd: "mittelhochdeutsch", goh: "althochdeutsch", ahd: "althochdeutsch",
  lat: "lateinisch", la: "lateinisch", mlat: "mittellateinisch", nl: "niederländisch", en: "englisch",
  fr: "französisch", fro: "altfranzösisch", dum: "mittelniederländisch", ie: "indogermanisch",
  ine: "indogermanisch", sv: "schwedisch", got: "gotisch", gml: "mittelniederdeutsch", mnd: "mittelniederdeutsch",
  it: "italienisch", el: "griechisch", gr: "griechisch", grc: "altgriechisch", ang: "altenglisch",
  non: "altnordisch", osx: "altsächsisch", lt: "litauisch", ru: "russisch", ofs: "altfriesisch",
  nds: "niederdeutsch", is: "isländisch", germ: "germanisch", gem: "germanisch", da: "dänisch",
  pt: "portugiesisch", no: "norwegisch", nhd: "neuhochdeutsch", es: "spanisch", ar: "arabisch",
};

function plain(src) {
  let s = src;
  s = s.replace(/<ref[^>]*\/>/g, "").replace(/<ref[\s\S]*?<\/ref>/g, "").replace(/<!--[\s\S]*?-->/g, "");
  s = s.replace(/<sup>[\s\S]*?<\/sup>/g, "").replace(/<[^>]+>/g, "");
  // Innermost templates first, until none are left.
  for (let i = 0; i < 6 && /\{\{/.test(s); i++) {
    s = s.replace(/\{\{([^{}]*)\}\}/g, (_, body) => {
      const [name, ...args] = body.split("|").map((a) => a.trim());
      const pos = args.filter((a) => !a.includes("="));
      // With or without the dot: {{gmh.}} and {{gmh}} both render "mittelhochdeutsch".
      if (!args.length && LANG[name.replace(/\.$/, "")]) return LANG[name.replace(/\.$/, "")];
      if (/^(QS[ _]Herkunft|Verbherkunft|m|f|n|refl\.)$/.test(name)) return "";
      if (/^Üt?$|^Üxx\d?$/.test(name)) return (name === "Üt" && pos[2]) || pos[1] || "";
      if (/^(L|Wikipedia)$/.test(name)) return pos[1] ?? pos[0] ?? "";
      if (/^(Ref-|Lit-|Beispiele fehlen|Herkunft fehlt|Quelle|Internetquelle|WP)/.test(name)) return "";
      if (/^(lang\.|ugs\.|va\.|vatd\.|Pl\.|Sg\.|fachspr\.|übertr\.)$/.test(name)) return name.replace(/^va\.|^vatd\./, "veraltet");
      if (/^(Polytonisch|Hebr|Arab|Kyrillisch|lang)$/.test(name)) return pos.at(-1) ?? "";
      return pos.at(-1) ?? "";
    });
  }
  s = s.replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1").replace(/\[https?:\S+ ([^\]]*)\]/g, "$1");
  s = s.replace(/'''?/g, "").replace(/&nbsp;/g, " ").replace(/&[a-z]+;/g, " ");
  // Sense markers: [1], [2a], [1, 3], [1–4].
  s = s.replace(/^:\s*/gm, "").replace(/\[\d+[a-z]?(?:\s*[,–-]\s*\d+[a-z]?)*\]\s*/g, "");
  s = s.split("\n").map((l) => l.trim()).filter(Boolean).join(" ");
  s = s.replace(/\s+([,.;:)])/g, "$1").replace(/\(\s*\)/g, "").replace(/,\s*,/g, ",").replace(/\s{2,}/g, " ").trim();
  return s;
}

function trim(s) {
  // Sentence ends: a full stop not after a one/two-letter abbreviation (z. B., mhd., Jh.).
  const ends = [...s.matchAll(/(?<!\d)(?<![A-Za-zäöü]{1}\.[A-Za-zäöü]?|\b(?:vgl|bzw|lat|griech|mhd|ahd|frz|engl|Jh|Jhd|usw|etc|ca|u\.a|dt|germ|idg))\.(?=\s+[A-ZÄÖÜ„])/g)].map((m) => m.index + 1);
  const cut = [...ends.slice(0, 2), s.length].filter((e) => e <= MAX);
  if (cut.length) return s.slice(0, Math.max(...cut)).trim();
  if (ends[0] && ends[0] <= MAX * 1.4) return s.slice(0, ends[0]).trim();
  // One run-on chain of forms ("von mhd. …, von ahd. …, belegt seit …, von urgerm. …"): end
  // it at the last clause break that fits. Every clause of such a chain stands on its own.
  // Only a break outside brackets: "(vgl. altenglisch wæter, …" must not be left open.
  let clause = -1;
  for (let i = 0, depth = 0; i < MAX && i < s.length; i++) {
    if (s[i] === "(") depth++;
    else if (s[i] === ")") depth = Math.max(0, depth - 1);
    else if (depth === 0 && s.startsWith(", ", i)) clause = i;
  }
  return clause > 60 ? s.slice(0, clause).trim() : null;
}

// ---- The Stammbaum ------------------------------------------------------------------------
// The trainer draws the word's line of descent as a column of boxes, oldest at the top,
// today's word at the bottom — the etymonline chart. The steps come from the {{Ü|lang|form}}
// templates in the Herkunft's first paragraph, which Wiktionary writes newest-first
// ("mhd. tisch, ahd. tisc, … lat. discus, griech. diskos"), so the list is reversed.
// Cognates are not ancestors: everything from a "vgl." / "verwandt" on is dropped, and so
// is any bracket that starts with one. German forms ({{Ü|de|…}}) are the word's own family,
// not its history, and are left out of the column.

// Ü codes → the label a box carries. A form whose code is missing here is left out rather
// than labelled with a code no learner can read.
const TREE_LANG = {
  gmh: "Mittelhochdeutsch", goh: "Althochdeutsch", gem: "Germanisch", "gem-pro": "Germanisch",
  gmw: "Westgermanisch", ine: "Indogermanisch", "ine-pro": "Indogermanisch", la: "Latein",
  lat: "Latein", ml: "Mittellatein", "la-med": "Mittellatein", "la-lat": "Spätlatein", grc: "Altgriechisch",
  el: "Griechisch", fr: "Französisch", fro: "Altfranzösisch", frm: "Mittelfranzösisch", en: "Englisch",
  enm: "Mittelenglisch", ang: "Altenglisch", it: "Italienisch", es: "Spanisch", pt: "Portugiesisch",
  nl: "Niederländisch", dum: "Mittelniederländisch", odt: "Altniederländisch", gml: "Mittelniederdeutsch",
  nds: "Niederdeutsch", osx: "Altsächsisch", ofs: "Altfriesisch", non: "Altnordisch", got: "Gotisch",
  frk: "Fränkisch", ar: "Arabisch", fa: "Persisch", tr: "Türkisch", ru: "Russisch", pl: "Polnisch",
  cs: "Tschechisch", hu: "Ungarisch", he: "Hebräisch", yi: "Jiddisch", sa: "Sanskrit", sv: "Schwedisch",
  da: "Dänisch", ja: "Japanisch", zh: "Chinesisch", hi: "Hindi", ta: "Tamil", qu: "Quechua", nah: "Nahuatl",
};

// German's sister languages. Wiktionary lists them as relatives, often without a "vgl."
// ("Haus": ahd. hūs, … altenglisch hús, gotisch gudhūs) — they are never an ancestor of a
// German word, so they never enter the column. The low-German and Dutch ones stay out of
// this list: German does borrow from those (Boot, Deich).
const SISTERS = new Set(["Altenglisch", "Altsächsisch", "Altnordisch", "Gotisch", "Altfriesisch",
  "Mittelniederländisch", "Altniederländisch", "Schwedisch", "Dänisch", "Jiddisch", "Isländisch"]);

// How far back a language sits, so the column reads oldest → newest whatever order the
// text named them in (Haus names ahd. before mhd., Tisch the other way round). Only the
// order matters; ties keep the text's own order, reversed.
const DEPTH = {
  Indogermanisch: 100, Sanskrit: 98, Altgriechisch: 96, Hebräisch: 96, Arabisch: 94, Persisch: 94,
  Latein: 92, Germanisch: 90, Westgermanisch: 88, Spätlatein: 86, Mittellatein: 84, Fränkisch: 82,
  Altfranzösisch: 80, Althochdeutsch: 70, Mittelfranzösisch: 64, Mittelenglisch: 62,
  Mittelniederdeutsch: 60, Mittelhochdeutsch: 58,
};

const NATIVE = new Set(["Mittelhochdeutsch", "Althochdeutsch", "Germanisch", "Westgermanisch", "Indogermanisch"]);
const NATIVE_WORD = {
  mittelhochdeutsch: "Mittelhochdeutsch", gmh: "Mittelhochdeutsch", mhd: "Mittelhochdeutsch",
  althochdeutsch: "Althochdeutsch", goh: "Althochdeutsch", ahd: "Althochdeutsch",
  germanisch: "Germanisch", urgermanisch: "Germanisch", gem: "Germanisch", germ: "Germanisch",
  westgermanisch: "Westgermanisch", gmw: "Westgermanisch",
  indogermanisch: "Indogermanisch", indoeuropäisch: "Indogermanisch", ine: "Indogermanisch", ie: "Indogermanisch",
};
// "[[althochdeutsch]]", "{{goh.}}", "althochdeutschen" — the last such label before a form.
const NATIVE_LABEL = new RegExp(`(?:\\[\\[|\\{\\{|\\b)(${Object.keys(NATIVE_WORD).sort((a, b) => b.length - a.length).join("|")})(?:e[nms]?)?\\.?(?:\\]\\]|\\}\\}|\\b)`, "gi");

function stripRefs(s) {
  return s.replace(/<ref[^>]*\/>/g, "").replace(/<ref[\s\S]*?<\/ref>/g, "").replace(/<!--[\s\S]*?-->/g, "");
}

/** The descent as [{ lang, form, gloss? }], oldest first, or null. */
function chainOf(para) {
  let s = stripRefs(para);
  // A bracket that opens with a comparison holds cognates: drop it whole (nested once).
  s = s.replace(/\((?:vgl\.|vergleiche|siehe|verwandt|urverwandt)[^()]*(?:\([^()]*\)[^()]*)*\)/gi, "");
  const stop = s.search(/\b(?:vgl\.|vergleiche|verwandt|Kognaten|urverwandt|siehe auch)/i);
  if (stop >= 0) s = s.slice(0, stop);
  const re = /(\*)?\{\{(Üt?)\|([^|}]+)\|([^|}]*)(?:\|([^|}]*))?\}\}/g;
  const steps = [];
  let m;
  let prevEnd = 0;
  while ((m = re.exec(s))) {
    const [, star, kind, code, a, b] = m;
    let lang = TREE_LANG[code.trim()];
    // The German line's own stages are often mis-coded ("[[althochdeutsch]] {{Ü|gmh|bruodar}}"):
    // there the label the text puts in front of the form wins over the template's code.
    const before = s.slice(prevEnd, m.index);
    prevEnd = re.lastIndex;
    if (NATIVE.has(lang)) {
      const said = [...before.matchAll(NATIVE_LABEL)].at(-1);
      if (said) lang = NATIVE_WORD[said[1].toLowerCase()] ?? lang;
    }
    if (!lang || code.trim() === "de" || SISTERS.has(lang)) continue;
    const clean = (x) => x.replace(/'{2,}|^'|'$/g, "").trim();
    let form = kind === "Üt" && b ? `${clean(a)} (${clean(b)})` : clean(a);
    if (!form) continue;
    // Reconstructed forms keep their star, also when italics sit between: ''*{{Ü|gem|…}}''.
    if (star || /\*'*$/.test(s.slice(0, m.index))) form = "*" + form.replace(/^\*/, "");
    // A gloss right behind the form: „Schüssel“, ‚Gebäude‘ — within a few characters.
    const after = s.slice(re.lastIndex, re.lastIndex + 40).replace(/'''?/g, "");
    const g = after.match(/^[\s,:(=]*[„‚"]([^“‘"]{1,40})[“‘"]/);
    const gloss = g ? g[1].replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1").trim() : undefined;
    const last = steps.at(-1);
    if (last && last.lang === lang) {
      if (!last.form.split(", ").includes(form)) last.form += `, ${form}`;
      last.gloss ??= gloss;
    } else steps.push({ lang, form, ...(gloss ? { gloss } : {}) });
  }
  if (!steps.length) return null;
  // One box per language, oldest first. Modern languages without a depth (Englisch,
  // Französisch, Italienisch …) are the last hop before German and sort to the bottom.
  const seen = new Map();
  for (const st of steps) {
    const had = seen.get(st.lang);
    if (had) { had.form += `, ${st.form}`; had.gloss ??= st.gloss; } else seen.set(st.lang, st);
  }
  return [...seen.values()].reverse().sort((a, b) => (DEPTH[b.lang] ?? 0) - (DEPTH[a.lang] ?? 0));
}

/** A compound or derivation, from the plain text: ["Schmerz", "Mittel"], ["wohnen", "-ung"]. */
function partsOf(text) {
  const w = "([A-ZÄÖÜa-zäöüß][A-Za-zÄÖÜäöüß]*-?|-[a-zäöüß]+)";
  // "dem Stamm des substantivierten Adjektivs", "der Präposition", "den Substantiven" …:
  // the words Wiktionary puts before a part to say what kind of word it is.
  const kind = "(?:(?:de[mnrs]|der) )?(?:Stamm (?:des|der) )?(?:substantivierten |gebundenen )?(?:Lexems? |Substantiv(?:en|s)? |Verbs? |Adjektivs? |Präposition |Adverbs? |Präfix |Pronomens? |Numerales? )?";
  const comp = text.match(new RegExp(`(?:[Kk]ompositum|Zusammensetzung)[^.]*?\\baus ${kind}${w}(?:,? [^.]*?)? und ${kind}${w}`));
  let parts = comp ? [comp[1], comp[2]] : null;
  if (!parts) {
    // Greedy up to the last "Verbs/Substantivs X" before the suffix, so "Ableitung des
    // Substantivs vom Stamm des Verbs entwerten mit -er" lands on entwerten.
    const der = text.match(new RegExp(`Ableitung[^.]*(?:Verbs?|Adjektivs?|Substantivs?) ${w}[^.]*?(?:Derivatem|Suffix|Endung)[^.]*?(-[a-zäöüß]+)`));
    if (der) parts = [der[1], der[2]];
  }
  // Anything that is still a grammar word was not a part: say nothing rather than nonsense.
  const GRAMMAR = /^(?:Stamm|Präposition|Adjektivs?|Verbs?|Substantiv(?:en|s)?|Adverbs?|Präfix|Suffix|Pronomens?|Fugenelement|Lexem|Wort|vom|zum|dem|den|der|des|dessen|mit|aus|und)$/;
  return parts && !parts.some((p) => GRAMMAR.test(p)) ? parts : null;
}

const pool = nouns({ has: "gender" }).filter((n) => ["A1", "A2", "B1", "B2"].includes(n.level));
const out = {};
let missing = 0;
for (const n of pool) {
  const wiki = await page(n.lemma);
  const sec = wiki && herkunftSection(wiki);
  // The first paragraph is the derivation; the ones after it are "verwandte Wörter" lists.
  const para = sec?.split(/\n(?=:)/)[0];
  let text = sec && trim(plain(para));
  // Wiktionary often starts lower-case ("von mittelhochdeutsch …") and ends without a stop.
  if (text) {
    text = (text[0].toUpperCase() + text.slice(1)).replace(/[,;:]$/, "");
    if (!/[.!?…][“"‘’]?$/.test(text)) text += ".";
  }
  if (!text || text.length < 12 || /\{\{|\}\}|\[\[/.test(text)) { missing++; continue; }
  const chain = chainOf(para);
  const parts = chain ? null : partsOf(plain(para));
  out[n.id] = { text, ...(chain ? { chain } : {}), ...(parts ? { parts } : {}) };
}

if (DRY) {
  for (const id of ["tisch", "name", "tag", "angst", "wasser", "haus", "wohnung", "kaution", "schmerzmittel", "bezahlung", "handy"]) console.log(id, "→", JSON.stringify(out[id]));
  const v = Object.values(out);
  console.log("chain", v.filter((x) => x.chain).length, "parts", v.filter((x) => x.parts).length, "text only", v.filter((x) => !x.chain && !x.parts).length);
} else {
  mkdirSync(path.dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(out));
}
console.log(`${Object.keys(out).length} of ${pool.length} nouns have a Herkunft (${missing} without).`);

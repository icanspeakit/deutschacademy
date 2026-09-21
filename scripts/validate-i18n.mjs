// Checks the five translation files against each other. Run with `pnpm validate:i18n`.
//
// Written after three copies of the same bug shipped unnoticed: tool.praepositionen.count
// read "{n} Themen · {q} Aufgaben" in German but "{n} فعلاً" / "{n} fiil" / "{n} дієслів" in
// Arabic, Turkish and Ukrainian — all three had dropped the {q} placeholder and said
// "verbs" where every other language says "topics · tasks". Nothing failed: interpolate()
// leaves an unknown placeholder in place and a missing one simply never appears, so a
// translation can quietly lose half its content and still render.
//
// German is the source of truth (BASE in src/lib/i18n.js), so every check is "does this
// locale still match de". The placeholder check is the one that earns its keep: a
// translator can legitimately reorder or reword anything, but the set of {tokens} is a
// contract with the calling code and must come through unchanged.

import fs from 'fs';
import path from 'path';

const DIR = 'public/i18n';
const BASE = 'de';
const OTHERS = ['en', 'ar', 'tr', 'uk'];

const read = (code) => JSON.parse(fs.readFileSync(path.join(DIR, `${code}.json`), 'utf8'));
const tokens = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

const base = read(BASE);
const baseKeys = Object.keys(base);
const problems = [];

for (const code of OTHERS) {
  const dict = read(code);
  const keys = Object.keys(dict);

  for (const k of baseKeys) if (!(k in dict)) problems.push(`${code}: missing key ${k}`);
  for (const k of keys) if (!(k in base)) problems.push(`${code}: key not in ${BASE}.json — ${k}`);

  // Same order, not just the same set: the files are diffed against each other by hand,
  // and that only works while line N means the same key everywhere.
  if (keys.length === baseKeys.length && JSON.stringify(keys) !== JSON.stringify(baseKeys)) {
    const at = keys.findIndex((k, i) => k !== baseKeys[i]);
    problems.push(`${code}: key order differs from ${BASE}.json, first at index ${at} (${keys[at]} vs ${baseKeys[at]})`);
  }

  for (const k of baseKeys) {
    if (!(k in dict)) continue;
    const a = tokens(base[k]);
    const b = tokens(dict[k]);
    if (a.join(',') !== b.join(',')) {
      problems.push(
        `${code}: placeholders differ for ${k}\n` +
        `    ${BASE}: {${a.join('} {')}}  ${JSON.stringify(base[k])}\n` +
        `    ${code}: {${b.join('} {')}}  ${JSON.stringify(dict[k])}`,
      );
    }
  }
}

const n = baseKeys.length * OTHERS.length;
if (problems.length) {
  console.error(`i18n: ${problems.length} problem(s) across ${n} key/locale pairs\n`);
  for (const p of problems) console.error('  ' + p);
  process.exit(1);
}
console.log(`i18n: ${baseKeys.length} keys × ${OTHERS.length + 1} locales — keys, order and placeholders all match ${BASE}.json`);

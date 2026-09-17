# Prompt: integrate the Wortschatz-Lernsets into the site

Paste everything below the line into Claude Code, run from
`C:\Users\Edgar\Projects\deutschacademy`.

---

Read these before writing any code, in this order:

1. `docs/wortschatz-programm-v1.md` — the content layout system. §1 (why per-trainer data
   silos were the problem), §2 (one lexicon, many trainers — every trainer is a *query*),
   §3 (program layer), §7 (decisions), Appendix B (build status, pool sizes).
2. `data/lernsets/README.md` — what was extracted on 2026-09-14 and how.
3. `data/lernsets/lernsets.index.json` — all 109 Lernsets, 54 built + 55 planned modules.
4. `data/lernsets/summary.json` — totals per level, trainer, topic, part of speech.
5. `src/lib/lexicon.js` — the loader, the selectors, the back-compat adapters.
6. `src/content/program.json` — level → module → unit.
7. `scripts/extract-lernsets.mjs` — how the extraction derives everything.

Skim, don't read in full: `src/content/lexicon/a1.json`, `a2.json` (1350 words),
`data/lernsets/lernsets.a1.json`, `lernsets.a2.json` (the same words, resolved shape).

## What exists right now

- **A Lernset = one program unit**: ~25 words, one sitting, stable id (`a1-04`). The
  offering lives in `program.json`, the words live in `src/content/lexicon/*.json`, and
  nothing in the codebase currently joins the two.
- **54 built Lernsets, 1350 words** (A1: 26 sets / 650 · A2: 28 / 700). B1–C2 have
  modules in `program.json` with `plannedUnits` and empty `units` — no words yet.
- **`data/lernsets/` is a snapshot, not a source.** It was produced by
  `scripts/extract-lernsets.mjs` so the sets could be reviewed as data. It is not imported
  by anything and **must not become one** — importing it would recreate exactly the
  per-trainer data silo that `docs/wortschatz-programm-v1.md` §1 was written to kill.
- **Trainer pools across A1+A2** (derived, and they reproduce Appendix B exactly, which is
  the check that the extraction is faithful): karten 1350 · artikel 864 · plural 776 ·
  verbformen 277 · komparativ 94 · trennbare 84 · verb+Präposition 20 · aussprache 0.

## The job

Make the Lernset a first-class unit of study in the UI, derived at build time from the
lexicon and the program — never from the snapshot.

### 1. `src/lib/lernsets.js` — the derived layer

A new module that joins `program.json` with `lexicon.js`. Same style as `lexicon.js`: no
new runtime dependency (`package.json` has exactly one, `astro`), plain ESM with import
attributes so `node scripts/*.mjs` can load it too, selectors not classes.

Suggested surface — adjust if the call sites want something else:

```js
lernsets({ level, status })  // rows: id, title, level, moduleId, moduleTitle, topics,
                             // status: "built" | "planned", words, pos, trainers
lernset(id)                  // one row + items[] (the lexicon.byUnit(id) entries)
modules(level)               // module rows with their sets nested
counts()                     // per-level set/word totals for the hub
```

Every count is computed from the lexicon at build time. Nothing is hand-typed, in keeping
with the honesty convention the hub already follows (`artikel.length`,
`docs/wortschatz-programm-v1.md` §3).

### 2. `/uebungen/wortschatz` — from one deck to 54

Today the page loads `src/data/wortschatz.json`, a single flat deck of 15 Redemittel
cards, and hands it to `mountWortschatzApp` (`src/lib/wortschatz-app.js`).

Give it a Lernset picker: level (A1 · A2) → module → Lernset, then the four existing tabs
(Karteikarten · Lernen · Testen · Wortliste) run against the chosen set.

**The constraint that killed the earlier migration attempt** (docs Appendix B,
"Deliberately not migrated"): those 15 cards carry `en/ar/ru/tr`; the lexicon ships `en`
only (§7 decision 3). Switching naively drops three languages. So:

- Keep the 15 legacy cards reachable as their own deck — label it honestly, it is
  Redemittel, not a level unit — and keep the 4-language switcher working **for it**.
- For lexicon-backed Lernsets, show the language switcher with only the languages that
  actually exist for that set rather than rendering empty tabs. Do not fake ar/ru/tr.
- `a2-28` (Redemittel: Bitten, Vorschläge, Termine) is the lexicon's Redemittel set and
  the natural successor. It has `note` instead of `example` on all 25 entries.

`asVokabelCards()` in `lexicon.js` already emits the exact `{front, note, translations}`
shape `wortschatz-app.js` consumes — prefer extending that path over rewriting the app.

### 3. A Lernset route

`/uebungen/wortschatz/[unit]` — one page per built Lernset: title, module, level, topics,
the word list, which trainers this set can feed, and links into them. Static paths from
`lernsets({ status: "built" })`. Planned sets get no route.

### 4. Progress per Lernset

`src/lib/progress.js` already records `vocabMastered` (word ids) via
`recordAttempt({ skill, correct, id, trackVocab: true })`, and lexicon word ids are
`slugify(lemma)` — stable, content-addressed, already what the Artikel-Trainer writes.

So per-Lernset completion is **derivable, not a new store**: intersect `vocabMastered`
with the set's word ids. Add a read-only helper (`progressForLernset(id)` or similar) and
surface it on the hub, the picker and the dashboard. Do not add a second progress key.

### 5. Hub and dashboard numbers

`/uebungen` already derives its der/die/das count and the "1350 Wörter A1–A2" pill from
the lexicon. Extend the same way: sets available per level, sets started, sets completed.
Every new string goes into all five i18n dicts (`src/lib/i18n.js`) — the hub pill
precedent is `hub.pill.words`.

### 6. Keep the snapshot honest

Add `"lernsets": "node scripts/extract-lernsets.mjs"` to `package.json` scripts, and make
`scripts/validate-lexicon.mjs` (or a sibling check) fail if `data/lernsets/` is stale
relative to the lexicon — so the snapshot can never quietly contradict the source.

## Constraints

- **No new runtime dependency.** Astro only. Scripts stay dependency-free too.
- **Do not claim official level authority.** Level banding is frequency-derived from the
  OpenSubtitles list, not the Goethe/telc inventory (§7.1). Existing UI copy says
  "orientiert an A1/A2"; keep it that way.
- **Do not present a number the content does not support.** No placeholder counts, no
  rounded-up totals, no progress bars for things not recorded.
- **`audio` is null on all 1350 entries**, so the Aussprache pool is 0. `/uebungen/aussprache`
  and `scripts/generate-audio.mjs` stay on `src/data/artikel.json` + `wortschatz.json`;
  do not switch them in this pass.
- **`src/data/artikel.json` stays** until Aussprache is migrated. Don't delete it.
- Grammar drill files (`src/data/grammatik/*.json`, `akkusativ.json`) are a different
  concern — out of scope.

## Verify before you report done

1. `node scripts/validate-lexicon.mjs` → 0 errors.
2. `node scripts/extract-lernsets.mjs` → `54 Lernsets built · 1350 words · 55 planned
   modules · 15 legacy cards · no orphan units`, and `git diff` on `data/lernsets/` is
   empty (the snapshot still matches the source).
3. `npx astro build` → no errors; page count went up by the number of new Lernset routes.
4. Open `/uebungen/wortschatz` in the browser: pick an A1 set and an A2 set, run all four
   tabs, confirm the legacy Redemittel deck still shows all four languages, confirm no
   empty language tabs on lexicon sets, no console errors.
5. Confirm the counts rendered on `/uebungen` match `data/lernsets/summary.json`.

## Report back

What you built, which numbers are derived and from where, anything you had to decide that
the docs did not settle, and anything you deliberately left for a later pass. If a choice
would compromise one of the constraints above, stop and ask rather than working around it.

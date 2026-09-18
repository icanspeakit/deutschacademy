# Wortschatz-Programm v1 — content layout system (2026-09-14)

Design for scaling vocabulary from today's 31 nouns + 15 phrase cards to a full A1–C2
offering (~8,000 entries), without rewriting a trainer every time content is added.

## 1. The problem with today's layout

Each trainer owns its own data file, in its own shape:

| File | Shape | Consumers |
| --- | --- | --- |
| `src/data/artikel.json` | `{word, gender}` × 31 | artikel-trainer, aussprache, hub count |
| `src/data/wortschatz.json` | `{front, note, translations}` × 15 | wortschatz, aussprache, hub count |
| `src/data/verben-praepositionen.json` | hand-written drill sets | verben-praepositionen |

Consequences at scale:

- **The same word is re-entered per trainer.** `Haus` needs a row in artikel.json for the
  article drill, another in wortschatz.json for flashcards, another for a plural trainer.
- **No level.** Nothing in either file says A1 or B2, so nothing can be filtered, sequenced,
  or reported on per level.
- **Every new trainer = a new file to author.** A plural trainer, a Verbformen trainer, a
  Komparativ trainer each start from zero.
- **Translations are per-file and inconsistent.** wortschatz.json ships `en/ar/ru/tr`;
  the site UI (`src/lib/i18n.js`) ships `de/en/ar/tr/uk`. Russian cards on a Ukrainian UI.

## 2. The layout: one lexicon, many trainers

One canonical record per lemma, rich enough to feed every trainer. Trainers become
**queries over the lexicon**, not separate data files.

```
src/content/lexicon/
  a1.json  a2.json  b1.json  b2.json  c1.json  c2.json   # one file per level
src/content/program.json       # the offering: levels → modules → units
src/lib/lexicon.js             # loader, selectors, back-compat adapters
scripts/validate-lexicon.mjs   # schema + duplicate + taxonomy check
```

Sharding by level keeps each file human-editable (~600–2,300 entries) and lets a level ship
independently. No Astro content collections and no Zod: `package.json` currently carries
exactly one runtime dependency (`astro`), and a standalone validator script keeps it that way
while giving the same guarantees.

### On-disk format — grouped by unit, compact

The file is the authoring surface, so it is organised the way a teacher thinks: level → unit
→ words. Fields shared by a whole unit (`level`, `unit`, `topics`) are stated once.

```jsonc
{
  "level": "A1",
  "units": [
    {
      "id": "a1-04",
      "title": "Haus & Räume",
      "topics": ["wohnen"],
      "words": [
        { "lemma": "Haus", "pos": "noun", "gender": "das", "plural": "Häuser",
          "en": "house", "example": "Wir haben ein großes Haus." },
        { "lemma": "wohnen", "pos": "verb", "aux": "haben",
          "en": "to live, to reside", "example": "Ich wohne in München." }
      ]
    }
  ]
}
```

### Runtime shape — what `lexicon.js` returns

The loader flattens and fills in what the file left implicit:

```jsonc
{
  "id": "haus",              // slugify(lemma) — the progress key; override only for homographs
  "lemma": "Haus",
  "pos": "noun",             // noun | verb | adj | adv | prep | conj | pron | num
  "level": "A1",             // from the file
  "unit": "a1-04",           // from the unit
  "topics": ["wohnen"],      // from the unit, overridable per word
  "rank": 312,               // corpus frequency rank, attached by script (§6)
  "en": "house",
  "example": "Wir haben ein großes Haus.",
  "gender": "das",           // nouns
  "plural": "Häuser",
  "forms": ["fährt", "fuhr", "gefahren"],   // verbs: 3rd sg · Präteritum · Partizip II
  "aux": "haben", "separable": false, "prep": "auf", "case": "akk", "reflexive": true,
  "comparative": "größer", "superlative": "am größten",   // adjectives
  "audio": null              // slug in /audio/aussprache/, null = not generated
}
```

Fields are **flat, not nested per part of speech** — `nouns().filter(n => n.plural)` reads
better than `n.noun.plural`, and a word that is both countable and verbal doesn't need two
blocks. Only `lemma` and `pos` are required per word; everything else is additive, so a level
can ship at "lemma + gender + English" quality and gain examples, more languages and audio
later without a schema migration.

### Every trainer is a query

| Trainer | Query | Pool at full build |
| --- | --- | ---: |
| der/die/das (existing) | `nouns({ level })` | ~3,200 |
| Aussprache (existing) | `select({ has: "audio" })` | all |
| Wortschatz-Karten (existing) | `select({ level, topic })` | all |
| Verben + Präpositionen (existing) | `verbs().filter((v) => v.prep)` | ~250 |
| **Plural-Trainer** (new) | `nouns().filter((n) => n.plural)` | ~3,200 |
| **Verbformen / Partizip** (new) | `verbs().filter((v) => v.forms)` | ~1,100 |
| **Komparativ** (new) | `adjectives().filter((a) => a.comparative)` | ~900 |
| **Themen-Deck** (new) | `byTopic(level, topic)` | 16–24 per level |
| **Trennbare Verben** (new) | `verbs().filter((v) => v.separable)` | ~400 |

Nine trainers × 6 levels × ~20 topics from one pool. Adding a trainer costs a selector, not
a content project.

### Migration is adapter-shaped, not rewrite-shaped

`src/lib/lexicon.js` exposes adapters that emit **today's exact shapes**:

```js
export const asArtikelRows = (opts) =>
  nouns(opts).map((n) => ({ word: n.lemma, gender: n.gender }));

export const asVokabelCards = (opts) =>
  select(opts).map((e) => ({ front: e.lemma, note: e.example, translations: { en: e.en } }));
```

So `artikel-trainer.astro` and `wortschatz.astro` change one import line and nothing else.
`src/data/*.json` stays until the lexicon covers it, then is deleted. Grammar drill files
(`akkusativ.json`, `grammatik.json`) are a different concern and stay as they are.

## 3. Program layer — the offering

`program.json` is the sellable structure: **Level → Modul → Unit**. A unit is ~25 words, one
sitting, and names which trainers it unlocks.

```jsonc
{
  "level": "A1",
  "modules": [
    { "id": "a1-wohnen", "title": "Wohnen",
      "units": [
        { "id": "a1-04", "title": "Haus & Räume", "words": 25,
          "trainers": ["artikel", "plural", "karten", "aussprache"] }
      ] }
  ]
}
```

Word counts are **derived from the lexicon at build time**, never hand-typed — the hub page
already does this (`artikel.length`), and that honesty convention should hold at scale.

## 4. Topic taxonomy (fixed, shared across levels)

A1–B1 (concrete, DTZ/telc-aligned): `person`, `familie`, `wohnen`, `essen`, `einkaufen`,
`koerper`, `gesundheit`, `arbeit`, `bildung`, `freizeit`, `reisen`, `verkehr`, `zeit`,
`wetter`, `natur`, `kleidung`, `geld`, `aemter`, `medien`, `kommunikation`.

B2–C2 add (abstract): `umwelt`, `politik`, `wirtschaft`, `recht`, `wissenschaft`, `technik`,
`kultur`, `psychologie`, `gesellschaft`, `migration`.

C1–C2 also carry register tags rather than topics: `nominalstil`, `idiomatik`,
`kollokation`, `konnektoren`, `fachsprache`, `stilebene`, `wortbildung`.

## 5. Volume plan

Cumulative targets follow the conventional CEFR/Goethe figures (A1 ≈ 650, A2 ≈ 1,300,
B1 ≈ 2,400 cumulative); B2–C2 have no official list and are frequency-banded.

| Level | New words | Cumulative | Units (~25) | Modules |
| --- | ---: | ---: | ---: | ---: |
| A1 | 650 | 650 | 26 | 8 |
| A2 | 700 | 1,350 | 28 | 9 |
| B1 | 1,150 | 2,500 | 46 | 15 |
| B2 | 1,700 | 4,200 | 68 | 14 |
| C1 | 2,300 | 6,500 | 92 | 16 |
| C2 | 1,500 | 8,000 | 60 | 10 |
| **Total** | **8,000** | | **320** | **72** |

## 6. Sourcing

Follows the project convention (`docs/self-study-tools-v1.md`): provenance is recorded and
nothing is invented. It sits in a `source` block at the top of each level file rather than on
every entry, because it is uniform across a level.

- **Frequency — OpenSubtitles 2018 German list** (`hermitdave/FrequencyWords`, 50k wordforms,
  MIT; data from the OPUS OpenSubtitles corpus). Supplies `rank`, which drives level banding
  and within-unit ordering. Attached by `scripts/attach-ranks.mjs`, never hand-typed.
- **Lemma inventory and morphology** — gender, plural, verb forms, comparatives and the
  English gloss. Authored against the frequency list rather than copied from any publisher's
  wordlist, so nothing here reproduces a copyrighted compilation.
- **Level banding is frequency-derived, not official.** A1 draws from the highest-frequency
  band, A2 from the next. The UI must therefore say "orientiert an A1/A2", not claim to be
  the Goethe or telc list. See §7.

## 7. Decisions taken (2026-09-14)

1. **Level authority — frequency-banded, open data.** Fully licensable and reproducible for
   all six levels. Trade-off accepted: levels are an approximation, so no page may present
   them as the official Goethe/telc inventory.
2. **Phase-1 scope — A1 + A2 deep** (1,350 words) with gender, plural, verb forms, example
   sentence and English gloss on every entry. B1–C2 are structured in `program.json` but
   carry no words yet.
3. **Translations — English only for now.** `tr.ru` in the legacy `wortschatz.json` is a
   known inconsistency with the `uk` in `src/lib/i18n.js`; the lexicon sidesteps it by
   shipping a single `en` field, with ar/tr/uk added per level later.

   *Superseded 2026-09-18.* Arabic, Russian and Turkish now exist for all 3,375 words, in
   `src/content/lexicon/i18n/{ar,ru,tr}.json` rather than inline — see that folder's
   README for why they live beside the lexicon instead of in it. `langsIn()` /
   `langsOf()` in `src/lib/lexicon.js` decide which tabs a deck earns, and only name a
   language when every card in that deck has it.
4. **Audio — out of scope this phase.** `audio` stays `null` across the new pool; the
   existing 43 MP3s and `scripts/generate-audio.mjs` are untouched.

---

## Appendix A — the full offering map

Unit IDs are stable (`a1-04`) and are what `lexicon` entries point at via `unit`.

### A1 — 8 modules · 26 units · 650 words

| Modul | Units |
| --- | --- |
| Ich & die Anderen | `a1-01` Person & Vorstellung · `a1-02` Familie & Beziehungen · `a1-03` Gefühle (einfach) |
| Wohnen | `a1-04` Haus & Räume · `a1-05` Möbel & Haushalt |
| Essen & Einkaufen | `a1-06` Essen & Trinken · `a1-07` Einkaufen & Preise · `a1-08` Kleidung & Farben |
| Körper & Gesundheit | `a1-09` Körper & Befinden · `a1-10` Beim Arzt |
| Alltag & Arbeit | `a1-11` Tagesablauf · `a1-12` Arbeit & Berufe · `a1-13` Schule & Lernen · `a1-14` Freizeit & Hobbys |
| Unterwegs | `a1-15` Stadt & Orte · `a1-16` Verkehr & Wege · `a1-17` Reisen & Urlaub |
| Welt & Zeit | `a1-18` Zahlen, Zeit & Datum · `a1-19` Wetter & Jahreszeiten · `a1-20` Tiere & Natur |
| Sprachbausteine | `a1-21` Verben des Alltags I · `a1-22` Verben des Alltags II · `a1-23` Adjektive: Gegensätze · `a1-24` Präpositionen & Ortsangaben · `a1-25` Funktionswörter & Konnektoren · `a1-26` Ämter & Formulare (DTZ) |

### A2 — 9 modules · 28 units · 700 words

| Modul | Units |
| --- | --- |
| Wohnen & Nachbarschaft | Wohnungssuche & Mietvertrag · Nachbarschaft & Zusammenleben · Haushalt & Reparaturen |
| Essen & Versorgung | Lebensmittel & Kochen · Restaurant & Bestellen |
| Gesundheit | Gesundheit & Krankheiten · Apotheke & Medikamente · Körperpflege |
| Beruf | Bewerbung & Lebenslauf · Arbeitsalltag & Kollegen · Ausbildung & Weiterbildung |
| Geld & Behörden | Bank & Geld · Post & Behördengänge · Versicherungen |
| Kommunikation | Telefonieren & E-Mail · Internet & Geräte · Reklamation & Umtausch |
| Mobilität | Öffentlicher Verkehr & Tickets · Auto & Führerschein · Reise: Hotel & Buchung |
| Kultur & Freizeit | Feste & Feiertage · Sport & Bewegung · Musik, Film & Lesen |
| Person & Sprache | Charaktereigenschaften · Gefühle & Meinungen · Umwelt & Müll · Trennbare Verben (Wortbildung) · Redemittel A2: Bitten, Vorschläge, Termine |

### B1 — 15 modules · 46 units · 1,150 words

Arbeitswelt & Karriere (5) · Bildung & Studium (4) · Gesundheit & Ernährung (4) ·
Wohnen & Umzug (3) · Umwelt & Klima (4) · Medien & Digitalisierung (4) ·
Gesellschaft & Zusammenleben (4) · Migration & Integration (3) · Recht & Behörden (3) ·
Geld & Konsum (3) · Reisen & Mobilität (3) · Kultur & Freizeit (3) ·
Gefühle, Charakter & Beziehungen (3) · Wortbildung: Nomen aus Verben, Präfixverben (2) ·
Konnektoren & Satzstrukturen (2)

### B2 — 14 modules · 68 units · 1,700 words

Berufsleben & Bewerbung (6) · Wirtschaft & Arbeitsmarkt (6) · Politik & Gesellschaft (6) ·
Recht & Justiz (5) · Wissenschaft & Forschung (5) · Technik & Digitalisierung (6) ·
Umwelt, Energie & Klima (5) · Gesundheit & Medizin (5) · Bildung & Wissenschaftsbetrieb (4) ·
Medien & Kommunikation (5) · Kultur, Kunst & Literatur (4) · Psychologie & Verhalten (4) ·
Kollokationen & feste Wendungen (4) · Nomen-Verb-Verbindungen (3)

### C1 — 16 modules · 92 units · 2,300 words

The axis shifts from topic to **register**:

Wissenschaftssprache & Argumentation · Nominalstil & Funktionsverbgefüge ·
Konnektoren & Diskursmarker (fortgeschritten) · Fachwortschatz Wirtschaft ·
Fachwortschatz Recht · Fachwortschatz Medizin · Fachwortschatz Technik & IT ·
Fachwortschatz Umwelt & Energie · Gesellschaftliche Debatten · Redewendungen & Idiome ·
Kollokationen (Verb+Nomen, Adjektiv+Nomen) · Wortbildung: Präfixe, Suffixe, Fremdwörter ·
Stilebenen: gehoben vs. umgangssprachlich · Synonymfeinheiten & Verwechslungspaare ·
Partikeln & Abtönung · Textsorten: Essay, Bericht, Erörterung

### C2 — 10 modules · 60 units · 1,500 words

Idiomatik & Sprichwörter · Literarische & gehobene Lexik ·
Fachsprache: Verwaltung & Politik · Fachsprache: Philosophie & Geisteswissenschaft ·
Regionale Varianten (DE/AT/CH) · Historische & bildungssprachliche Begriffe ·
Feine Konnotationsunterschiede · Rhetorische Mittel & Stilfiguren ·
Anglizismen & Fremdwörter im Fachdiskurs · Wortfelder: Abstrakta

---

## Appendix B — build status (2026-09-14)

### Shipped

| | |
| --- | --- |
| `src/content/lexicon/a1.json` | 26 units, **650 words**, 644 frequency-ranked (99%) |
| `src/content/lexicon/a2.json` | 28 units, **700 words**, 606 frequency-ranked (87%) |
| `src/content/lexicon/{b1,b2,c1,c2}.json` | empty stubs — structure only, see `program.json` |
| `src/content/program.json` | all six levels; A1/A2 `live`, B1–C2 `planned` |
| `src/lib/lexicon.js` | loader, selectors, back-compat adapters |
| `scripts/validate-lexicon.mjs` | `node scripts/validate-lexicon.mjs` → 0 errors |

Every A1/A2 entry carries gender + plural (nouns), the three principal parts + auxiliary
(verbs), comparative + superlative (adjectives), an example sentence and an English gloss.
Separable verbs, reflexives and fixed prepositions with their case are marked.

### Derived pool sizes (A1+A2)

| Trainer | Words available |
| --- | ---: |
| der/die/das | 864 |
| Plural | 776 |
| Verbformen / Partizip II | 277 |
| Trennbare Verben | 84 |
| Komparativ | 94 |
| Karteikarten | 1,350 |
| Verb + Präposition | 20 |

### Migrated

- **`/uebungen/artikel-trainer`** now reads the lexicon. 31 → 864 nouns, so it gained a
  level picker (A1 · A2 · Alle) and draws a random 25-word session per round, with a
  "Neue Runde" button. Question ids are now lexicon slugs (`haus`) instead of array
  indices (`art-3`) — **this resets existing localStorage progress for this trainer once**,
  and makes it stable against every future content addition.
- **`/uebungen`** hub: the der/die/das count and the new "1350 Wörter A1–A2" hero pill are
  derived from the lexicon at build time. `hub.pill.words` added to all five i18n dicts.

### Deliberately not migrated

- **`/uebungen/aussprache`** — every new entry has `audio: null` (§7 decision 4), so
  switching it would empty the page. Stays on `artikel.json` + `wortschatz.json`.
- **`/uebungen/wortschatz`** — the curated Redemittel deck. The blocker named here (the
  lexicon shipped `en` only, so switching would have dropped three languages from the 15
  Redemittel cards) is gone as of 2026-09-18: every lexicon word now has ar/ru/tr. What
  keeps this page on `wortschatz.json` is no longer the data but the content — these are
  hand-written Redemittel with their own teaching notes, not lemmas.
- `src/data/artikel.json` is therefore still live (aussprache + `generate-audio.mjs`) and
  is not yet deleted.

### Verified

`npx astro build` → 36 pages, no errors. Artikel-Trainer exercised in Chrome: level switch
remounts with A2-only words, answers grade correctly, session counter tracks, no console
errors.

### Next

1. B1 (1,150 words, 46 units) — the structure is already in `program.json`.
2. ar/tr/uk translations for A1, then A2.
3. Audio: `generate-audio.mjs` currently reads the two legacy JSONs; point it at
   `select({ level, has: "example" })` and backfill the `audio` slugs.
4. New trainers, which are now selectors rather than content projects: Plural-Trainer
   (776 words ready), Verbformen (277), Komparativ (94).

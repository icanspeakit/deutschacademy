# Wortschatz-Lernsets — extracted data (2026-09-14)

Data only. Nothing in this folder is imported by the site; no `src/` file was changed.
Regenerate with:

```
node scripts/extract-lernsets.mjs
```

## What a Lernset is

One **program unit** — ~25 words, one sitting. Ids are stable (`a1-04`) and are what
lexicon entries point at via `unit`. The extraction joins the two layers that currently
hold this apart:

| Layer | File | Holds |
| --- | --- | --- |
| Offering | `src/content/program.json` | level → module → unit, targets, status |
| Content | `src/content/lexicon/{a1..c2}.json` | unit → words |

## Files

| File | Rows | What |
| --- | ---: | --- |
| `lernsets.index.json` | 109 | One row per Lernset — 54 built, 55 planned modules. No words. Per-set word count, POS breakdown and trainer pools. |
| `lernsets.a1.json` | 26 sets · 650 words | Built A1 sets with words inlined. |
| `lernsets.a2.json` | 28 sets · 700 words | Built A2 sets with words inlined. |
| `lernsets.legacy-redemittel.json` | 15 cards | `src/data/wortschatz.json`, the un-migrated 4-language flashcards. |
| `lernsets.words.csv` | 1350 | One row per word, flat, 24 columns — for review or bulk editing in a spreadsheet. |
| `summary.json` | — | Totals per level, trainer, topic and part of speech. |

B1–C2 carry no `lernsets.<level>.json` because they carry no words yet — their modules
appear in the index with `status: "planned"` and a `plannedUnits` count.

## Word shape

Each `items[]` entry is the **runtime shape** `src/lib/lexicon.js` produces, not the
compact on-disk shape: unit-level fields (`topics`) and defaults (`rank`, `audio`) are
resolved onto every word, and `id` / `level` / `unit` are filled in. So a set is
self-contained — it can be read without the loader.

```json
{
  "topics": ["person"], "rank": 440, "audio": null,
  "lemma": "Name", "pos": "noun", "gender": "der", "plural": "Namen",
  "en": "name", "example": "Mein Name ist Ana.",
  "id": "name", "level": "A1", "unit": "a1-01"
}
```

`id` is `slugify(lemma)` — the same key the trainers already write to localStorage, so
these rows line up with existing progress data.

## Trainer pools

Counted per set and in total, using the selector definitions of
`docs/wortschatz-programm-v1.md` §2:

| Field | Query |
| --- | --- |
| `karten` | has `en` |
| `artikel` | noun with `gender` |
| `plural` | noun with `plural` |
| `verbformen` | verb with `forms` |
| `trennbare` | verb, `separable: true` |
| `komparativ` | adj with `comparative` |
| `verbPraeposition` | verb with `prep` |
| `aussprache` | has `audio` |

Totals across A1+A2: karten 1350 · artikel 864 · plural 776 · verbformen 277 ·
komparativ 94 · trennbare 84 · verbPraeposition 20 · aussprache 0. These reproduce the
pool table in `docs/wortschatz-programm-v1.md` Appendix B exactly, which is the check that
the extraction is faithful.

## Caveats carried over from the source

- **Level banding is frequency-derived, not official.** A1/A2 here are not the Goethe or
  telc inventory; the UI must not claim otherwise (docs §7.1).
- **English only.** The lexicon ships `en`; ar/tr/uk are not in these sets. The 15 legacy
  Redemittel cards are the only 4-language content, which is why they are still a separate
  file and a separate trainer.
- **No audio.** `audio` is `null` on all 1350 entries, so the `aussprache` pool is 0.
- A2 has 25 words without an `example` (unit `a2-28`, which carries `note` instead);
  A1 is complete on examples. 644/650 A1 and 606/700 A2 words are frequency-ranked.

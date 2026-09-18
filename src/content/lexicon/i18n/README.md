# Übersetzungen — ar / ru / tr

One file per language, `{ "<word id>": "<translation>" }`, keyed by the `id` of a word in
`src/content/lexicon/<level>.json`. `en` is **not** here: it ships inline with the word,
because it is part of how the lexicon was compiled.

## Why a sidecar and not another field on the word

The word records are sourced — gender, plural, verb forms and IPA each came from a named
source and are checked against it. These glosses are not: they are a translation of the
lemma, written to make the flashcard trainer usable for learners who do not read English.
Mixing the two in one file would make "sourced" mean less than it does today, and would
make a corrected translation land in the same diff as morphology it did not touch.

A sidecar also means a language can be half-finished without breaking anything: a word
with no entry simply has no translation, and `langsIn()` in `src/lib/lexicon.js` drops a
language tab unless *every* card in the deck has it — so the trainer never offers a
language and then shows "Übersetzung folgt" on the third card.

## Adding to them

`node scripts/merge-translations.mjs <lang> <file.tsv>` — the TSV is `id<TAB>translation`,
one per line. Re-running with the same id overwrites; ids the lexicon does not know are
reported and skipped, which is the check that catches a drifted or misspelled key.

# Vocabulary generation — Tier 0: the 25-word probe (v1, 2026-09-17)

Status: **done.** `src/content/lexicon/b1.json` holds one unit, 25 entries. Validator exits 0,
`pnpm build` exits 0. `prompts/lexicon-entry-rubric.md` is at **v2**, every new rule traceable to a
failure observed here.

Tier 0 of `VOCAB-GENERATION-TIERED-PROMPT.md`. Its purpose was never the 25 words — it was to find
out what a bad rubric looks like before a bad rubric produces 6,650 rows. It found six things.

---

## 1. What was built

`b1-01` — **Arbeitsrecht & Kündigung**, topic `arbeit`, 25 entries: 17 nouns, 4 verbs, 4 adjectives.

The topic is deliberately the *next* slice of `arbeit` rather than a restatement of it. A2 already
covers application (`a2-09 Bewerbung & Lebenslauf`) and daily office life (`a2-10 Arbeitsalltag &
Kollegen`); B1 is where an adult in Germany has to handle the employment relationship itself —
notice periods, works councils, collective agreements, being laid off.

## 2. Sourced vs generated

Per `docs/lexicon-enrichment-v1.md` §1, and this is the whole point of the tier:

| Field | Written by | Coverage in b1-01 |
| --- | --- | ---: |
| `lemma` `pos` `en` `example` `grammar_anchor` | authored | 25 / 25 (anchor: 8) |
| `ipa` `ipaVariants` `ipaSource` | de.wiktionary.org | **25 / 25** |
| `gender` | de.wiktionary.org | **17 / 17 nouns** |
| `plural` | de.wiktionary.org | 15 / 17 nouns (2 uncountable) |
| `forms` `aux` | de.wiktionary.org | **4 / 4 verbs** |
| `comparative` `superlative` | de.wiktionary.org | 1 / 4 adjectives (3 uninflectable) |
| `rank` | not run this tier | 0 / 25 |

**Zero morphology values were generated.** Verified rather than assumed: the file was written with
`gender`, `plural` and `forms` explicitly `null` on all 25 rows and that invariant was machine-checked
(`0` rows violating) *before* anything else touched the file. Every non-null morphology value in
`b1.json` today came out of a de.wiktionary.org page.

The two `plural: null` rows are `Kündigungsschutz` and `Arbeitslosigkeit` — Wiktionary lists no
plural, which is correct, and the honest record of that is `null`. The three adjectives without a
comparative are `befristet`, `unbefristet` and `arbeitslos`: Wiktionary gives `—`, the parser's
`NONE` set already reads that as "this form does not exist" rather than as a value, and it worked.

## 3. Wiktionary lookup rate — the quality signal the tier asked for

> *"how many lemmas Wiktionary could not find (a high number means the generator picked words that
> aren't real German lemmas — the single most useful quality signal available)"*

**0 of 25 unfindable.** 25/25 pages had a German section, 25/25 carried `{{Lautschrift}}`. The
stop-and-raise threshold was >3; it was not approached.

This is worth recording precisely because it makes the tier's stated worry the *wrong* worry.
Invented-looking compounds were the anticipated risk, and the ones that felt riskiest —
`Kündigungsschutz`, `Arbeitszeugnis`, `Mindestlohn`, `Belegschaft`, `Elternzeit` — all exist. The
two selection failures that *did* occur (§5 C and D below) both passed an existence check and would
have passed it at any scale. **Lookup rate is necessary and not sufficient**; Tier 1 should not
treat a green lookup rate as evidence that selection is good.

One lemma was replaced during the tier: `Vorgesetzter` → `Abteilungsleiter` (§5 D).

## 4. Rubric v1 → v2

Six new rules, each named after the failure that produced it, in
`prompts/lexicon-entry-rubric.md` under **Observed failure modes**:

| | Rule added | Motivating failure |
| --- | --- | --- |
| A | ex. rule 11 — the finite verb must be easier than the headword | `beträgt`, `vertritt`, `gesunken` |
| B | ex. rule 12 — abstract nouns get a 1st/2nd-person sentence | `Arbeitslosigkeit` read as a news bulletin |
| C | selection — exclusion is by spelling, not by sense | 5 of the first 25 picks collided |
| D | selection — no adjectival nouns | `Vorgesetzter` is unsourceable and unfixable |
| E | anchor — must be practisable, not the headword's own morphology | `Vorgesetzter` → `adjektivdeklination` |
| F | anchor — reread for subordinate structures before emitting | `Tarifvertrag` → `indirekte-fragen`, found late |

Four example sentences were rewritten and one anchor added as a result, so the unit obeys the rubric
it produced.

### The measurement that did not work, and why that matters

Rule 2 ("every other word at or below the target level") is the rule the tier most needed to make
checkable, so it was tested mechanically: tokenise each example, flag anything absent from the
1,350-word A1/A2 bank. **It flagged 19 of 25 — useless as a gate.** The noise is inflections the
bank stores only in citation form (`Monaten`, `bekommst`, `Löhne`), transparent compounds that cost
a learner nothing (`Quartalsende`, `Nachtschichten`, `Personalabteilung`), and perfectly ordinary
words the bank happens not to contain (`Januar`, `Prozent`, `Leute`).

Narrowed to **the finite verb's lemma only**, the same check flagged exactly the three real
violations and nothing else. That is rule 11. A generator-side check is worth building at Tier 1;
the naive form of it is not.

## 5. `scripts/fetch-wiktionary.mjs` gained `--fill`

Tier 0's Definition of Done requires both *"every row has `gender`/`plural`/`forms` present and
`null`"* and *"`node scripts/validate-lexicon.mjs` exits 0"*. **Those two cannot both hold**: the
validator errors on `noun without gender`, so 17 of the 25 rows fail by construction the moment
they are generated correctly.

The only resolution that does not violate §1 is to *source* the morphology, which is what
`--fill` does — a flag `VOCAB-GENERATION-TIERED-PROMPT.md` Tier 2 already invokes
(`pnpm lexicon:ipa $LEVEL --fill`) and which did not exist. It fills a field only where the stored
value is `null` or absent; a field holding a value is still audited and never touched, so running it
cannot rewrite the curated A1/A2 rows. Confirmed: `git diff` on `a1.json` and `a2.json` is empty
after the fill.

Two consequences worth carrying forward:

- **A level file is invalid between generation and fill.** They are one operation, not two you can
  stop between. Tier 1 must not emit a level file and hand back; Tier 2's chained
  `lexicon:build` script is the right shape and the reason for it should be recorded there.
- `Hilfsverb` was confirmed as the `{{Deutsch Verb Übersicht}}` auxiliary parameter (`haben` on all
  four verbs here), closing part of the "unverified / open" note in
  `docs/lexicon-enrichment-v1.md` §4. Verbs listing two auxiliaries are left `null` with an audit
  row rather than having one picked for them.

## 6. Decisions taken, not assumed

- **B1 `arbeit` means the employment relationship**, not more office nouns. A2 holds the
  application and the working day; repeating that register at B1 would have produced "rarer A2
  words", which the rubric explicitly rejects.
- **`Streik` keeps `Streiks`.** Wiktionary lists `Streiks / Streike`; the fill takes Wiktionary's
  primary and records in `docs/lexicon-audit-v1.md` that a choice was made. The alternative —
  leaving it `null` — is defensible under §4 rule 2, but it drops a plural the trainer can teach in
  order to avoid a choice Wiktionary itself has already ranked.
- **`rank` was not attached.** `attach-ranks.mjs` is not part of Tier 0's sequence, and a null rank
  is honest. It runs in the Tier 2 chain.
- **`separable: true` on `einreichen` was authored, not sourced.** It is the one morphology-adjacent
  field `--fill` does not derive. The validator's cross-check passed on sourced data —
  `forms[0]` came back as `reicht ein`, with the split prefix — so the authored flag is confirmed
  rather than trusted. If Tier 1 generates `separable`, this is the check that keeps it honest.

## 7. Not done here

- B1's remaining 1,125 words. Tier 0 is 25.
- `scripts/generate-lexicon.mjs` — Tier 1. These 25 entries were authored directly, so the tier's
  cost-shape estimate (~80 output tokens/entry) is still unmeasured.
- `rank`, and the `aussprache` pool, which stays at 0 until audio exists —
  `docs/lexicon-enrichment-v1.md` §7.

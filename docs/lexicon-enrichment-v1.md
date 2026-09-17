# Lexicon enrichment — sourcing spec & compendium reconciliation (v1, 2026-09-17)

Status: **spec + verified findings. No lexicon file has been modified yet.**

Written in the pattern of `self-study-tools-v1.md` / `wortschatz-programm-v1.md`: every claim
below traces to a file in this repo or to a live source I queried, and anything unverified is
marked as such.

Scope: how the A1–C2 lexicon gets its `ipa`, morphology verification and `grammar_anchor`
fields, and how the separately-generated `german_compendium` output relates to this repo's
lexicon. Decided with Edgar on 2026-09-17: build the enrichment pipeline **in this repo** and
export slices out to pflegeplace / icanspeakit, rather than maintaining parallel data trees.

---

## 1. The governing rule

> Source it, don't generate it.

`attach-ranks.mjs` already states the principle this repo works by: *"a missing rank is honest,
a guessed one is not."* This spec extends that to every field that has a factual right answer.

| Field class | Examples | Rule |
| --- | --- | --- |
| **Factual morphology** | `gender`, `plural`, `forms`, `comparative`, `superlative`, `aux` | Never generated. Sourced, or left `null`. |
| **Phonetic** | `ipa` | Never generated. Sourced from curated IPA, or left `null`. |
| **Corpus-derived** | `rank` | Already sourced (`attach-ranks.mjs`). Unchanged. |
| **Pedagogical** | `en`, `example`, `topics`, `unit`, `grammar_anchor` | Authored or generated — there is no external ground truth for "the right A1 example sentence". |

A wrong plural in a static bank is permanent and unfalsifiable after the fact: you cannot tell
which rows are wrong without re-checking all of them, at which point the sourcing work has been
done anyway, only later and on top of bad data.

---

## 2. Canonical schema (what already exists — do not restate it differently anywhere else)

On disk, per level file (`src/content/lexicon/{a1..c2}.json`):

```json
{ "level": "A1", "source": "…",
  "units": [ { "id": "a1-01", "title": "Person & Vorstellung",
               "topics": ["person"], "words": [ … ] } ] }
```

Word entry, as verified against all 650 A1 rows (count = rows carrying that field):

| Field | A1 count | Notes |
| --- | ---: | --- |
| `lemma` | 650 | required |
| `pos` | 650 | required; one of the 9 in `validate-lexicon.mjs` |
| `en` | 650 | required — validator errors on missing English gloss |
| `example` | 650 | required non-empty if present |
| `rank` | 650 | from `attach-ranks.mjs`; `null` is legal and honest |
| `gender` | 386 | `"der"/"die"/"das"` — **not** `m/f/n` |
| `plural` | 350 | |
| `forms` | 134 | exactly 3: `[3rd sg, Präteritum, Partizip II]` |
| `aux` | 134 | `haben` \| `sein` |
| `comparative` / `superlative` | 56 / 56 | superlative stored **with** the `am ` prefix (`"am ältesten"`) |
| `case` | 30 | `akk` \| `dat` \| `gen` \| `akk/dat` |
| `separable` | 26 | if true and `forms` present, `forms[0]` must contain a space |
| `reflexive` / `prep` | 7 / 7 | |
| `pluralOnly` | 3 | exempts a noun from the gender requirement |
| `irregular` / `id` | 2 / 2 | `id` defaults to `slugify(lemma)` |

`unit`, `level`, `topics`, `rank: null`, `audio: null` are applied by `flatten()` in
`src/lib/lexicon.js` at load time — they are **not** written per word.

`id` is load-bearing beyond the data: it is the localStorage progress key the trainers already
write. Changing how an id is derived silently orphans every learner's history.

### 2.1 Fields this spec adds

| Field | Type | Source | Null when |
| --- | --- | --- | --- |
| `ipa` | string | de.wiktionary `{{Lautschrift}}`, German section only | no German IPA on the page |
| `ipaVariants` | string[] | remaining `{{Lautschrift}}` values in the German section | only one variant |
| `ipaSource` | `"wiktionary"` | provenance, so a later upgrade pass can find un-sourced rows | always set when `ipa` is set |
| `grammar_anchor` | string | authored — the grammar topic id this word illustrates | word illustrates no specific topic |

`grammar_anchor` is the one good idea imported from the compendium plan (see §5). It must key to
an **existing** id under `src/data/grammatik/*.json` (21 files) so the grammar template and the
vocabulary can cross-link; the validator has to enforce that, exactly as it already enforces the
§4 topic taxonomy, or the field will quietly accumulate typos that no page ever selects.

---

## 3. IPA source: decision and evidence

**Decision: de.wiktionary.org `{{Lautschrift}}`. Rejected: espeak-ng.**

espeak-ng 1.51 is installable and fast, but it is rule-based and systematically wrong for German
in ways a learner would notice. Measured side by side:

| Lemma | espeak-ng `-v de --ipa` | de.wiktionary | Verdict |
| --- | --- | --- | --- |
| Name | `nˈɑːmə` | `ˈnaːmə` | espeak wrong vowel (`ɑː` is back, German long a is not) |
| Vorname | `fˈɔɾnɑːmə` | `ˈfoːɐ̯ˌnaːmə` | espeak wrong on vowel, r-vocalisation and stress |
| Straße | `ʃtɾˈɑːsə` | `ˈʃtʁaːsə` | espeak uses tap `ɾ`, German has uvular `ʁ` |
| Mädchen | `mˈɛːdçən` | `ˈmɛːtçən` | espeak fails to devoice |
| Buch | `bˈuːx` | — | correct |
| Zug | `tsˈuːk` | `t͡suːk` | correct bar the tie bar |

Roughly a third of a 10-word sample was wrong, and wrong *consistently* — meaning the errors
would look like a deliberate transcription convention rather than noise. Wiktionary's is
human-curated and citable. Cost of both is zero.

**Consequence for the pipeline:** the enrichment script must run where de.wiktionary.org is
reachable. It is reachable from Edgar's machine and from Claude Code; it is **blocked by the
egress proxy in the Cowork cloud sandbox**, so the script belongs in `scripts/` and is run
locally, exactly like `attach-ranks.mjs`.

---

## 4. Wiktionary parser rules (each one is a bug found in a 25-word slice)

These are not hypothetical. Every rule below corresponds to a wrong result produced by the naive
version of the parser.

1. **Isolate the German section first.** A page can carry many languages. `alt` has four level-2
   sections — `{{Sprache|Deutsch}}`, `Italienisch`, `Katalanisch`, `Polnisch`. The naive parse
   returned `plural = "alty"`, which is **Polish**. Cut from
   `== <lemma> ({{Sprache|Deutsch}}) ==` to the next `^==` before extracting anything.

2. **Plural parameters are numbered.** `Mädchen` uses `Nominativ Plural 1=Mädchen` and
   `Nominativ Plural 2=Mädchens`. A regex for bare `Nominativ Plural` returns nothing and the
   word looks uncountable. Match `Nominativ Plural(\s+\d+)?` and collect all values — a word can
   legitimately have more than one plural, and picking one arbitrarily is a guess.

3. **Multiple `{{Lautschrift}}` on one line are variants, not duplicates.** `Mädchen` →
   `ˈmɛːtçən`, `ˈmeːtçən`. Take the first as `ipa`, keep the rest as `ipaVariants`.

4. **`{{Pl.}}` marks a plural pronunciation.** In `alt`'s Polish section:
   `{{Lautschrift|alt}}, {{Pl.}} {{Lautschrift|ˈaltɨ}}`. Never treat a value after `{{Pl.}}` as a
   variant of the singular. (Rule 1 already excludes this case, but the pattern recurs in German
   noun entries.)

5. **Empty `{{Lautschrift||spr=xx}}` exists.** Skip empty captures rather than storing `""`.

6. **Normalise before comparing, never before storing.** Wiktionary's adjective template gives
   `Superlativ=ältesten`; this repo stores `"am ältesten"`. Strip a leading `am ` on **both**
   sides for the comparison only. Do not rewrite the repo's convention — it is what the
   Komparativ trainer renders.

7. **Map genus on read.** Wiktionary `Genus=m|f|n` → `der|die|das`. Verified correct for Name (m),
   Straße (f), Mädchen (n), Telefonnummer (f).

8. **Batch politely.** The API accepts up to 50 titles per `titles=A|B|C` request, which turns
   8,000 lemmas into ~160 calls. Send a real `User-Agent` and cache raw wikitext under
   `node_modules/.cache/` — same convention as `attach-ranks.mjs`.

**Unverified / open:** the `{{Deutsch Verb Übersicht}}` parameter names for Präsens 3rd singular,
Präteritum and Partizip II were not confirmed (the probe call failed). Confirm them against a
live page before trusting verb-form verification. Adjective params **are** confirmed:
`Positiv` / `Komparativ` / `Superlativ`.

---

## 5. Adjacent gap, noted not scheduled

This repo has 21 rich grammar topics under `src/data/grammatik/`, 5 fallback topics, and **no
document mapping grammar to CEFR level**. `grammar_anchor` (§2.1) is the vocabulary half of that
link; the grammar half — a per-level grammar spine saying which of the 26 topics belongs to A1,
A2, B1 and so on — does not exist yet and is not part of this pass. Without it, `grammar_anchor`
can still be validated against topic ids, but not against level consistency.

---

## 6. Build order

1. `scripts/fetch-wiktionary.mjs` — batch fetch, cache, German-section isolation, §4 rules.
   Writes `ipa` / `ipaVariants` / `ipaSource` into the lexicon in place.
2. Same script emits `docs/lexicon-audit-v1.md`: every row where sourced genus / plural /
   comparative / superlative disagrees with the repo's stored value. **Report only — it must not
   auto-overwrite.** Existing values may be deliberate pedagogical simplifications.
3. Extend `validate-lexicon.mjs`: `ipa` non-empty when present, `ipaSource` set whenever `ipa` is,
   `grammar_anchor` resolves to a real `src/data/grammatik/*.json` id.
4. Run against **unit `a1-01` only** (25 words) and review the audit before touching all 650.
5. Export layer for pflegeplace / icanspeakit — a flat `lemma, ipa, pos, gender, plural, rank`
   slice. Shape to be decided with the consuming repos; not part of this pass.

## 7. What this does not do

- **It does not fill the `aussprache` pool.** That pool is defined as `has: "audio"`, and `audio`
  is `null` on all 1,350 entries. `ipa` is what the trainer can *teach* and what icanspeakit's
  minimal-pair work needs; the audio files are a separate job, and per the hosting review they
  belong in an object store (Cloudflare R2 — 10 GB free, egress free), not in this repo's git
  history.
- It does not add B1–C2 words. `b1.json`–`c2.json` remain 26-byte stubs until a sourcing pass for
  the lemma inventory itself is decided.

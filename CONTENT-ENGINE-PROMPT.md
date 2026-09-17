# Language Cluster — Content Engine (v1, 2026-09-17)

A long-run, resumable generation plan across **deutschacademy · pflegeplace · icanspeak.it**.
Total planned output: **≈14M output tokens.** This is the document for deliberately spending a
large budget on content, not for exploring whether to.

---

## How to run this

**It is designed to outlive a session.** A 14M-token run will span many sessions, so progress is
durable in a ledger, not in a conversation.

1. Open Claude Code in the repo the stream belongs to (each stream names its repo).
2. Paste **one BATCH prompt at a time**, never a whole stream.
3. Every batch ends by appending one line to `docs/content-engine-ledger.md` **in the repo it ran
   in**. That file is the only source of truth for what exists. A fresh session reads the ledger
   and the stream's spec — never the whole conversation, and never the lexicon JSON.
4. Between batches, context is disposable. Start a new session whenever it gets long; the ledger
   makes that free.

### The ledger format

Create `docs/content-engine-ledger.md` on the first batch if absent. One line per completed batch,
append-only:

```
| date | stream | batch | produced | gate result | validator | notes |
| 2026-09-17 | 1-lexicon | b1-02..b1-06 | 125 words | 0 unresolved of 125 | green | 15 via compound head |
```

A batch is not complete until its ledger line exists. If a session dies mid-batch, the next
session re-runs that batch from the last ledger line.

---

## Hard rules — these override any batch prompt

1. **Never generate factual morphology.** `gender`, `plural`, `forms`, `aux`, `comparative`,
   `superlative` are written as explicit `null` and filled by `scripts/fetch-wiktionary.mjs --fill`.
   Measured: Wiktionary sourcing plus compound-head inheritance resolves ~100% of B1 nouns. A
   generated gender is a permanent unfalsifiable error.
2. **Never generate what a source publishes.** The 460 Leben-in-Deutschland questions (BAMF), the
   telc/Goethe published exam formats, German minimal pairs (derivable from a phonemic lexicon),
   frequency ranks (`attach-ranks.mjs`), IPA (Wiktionary). Generate the *explanation*, never the
   item that already exists.
3. **Etymology is rewriting, not inventing.** Every etymology card cites the Wiktionary etymology
   section it was written from. No card without a source.
4. **Clinical content is gated on a physician, not on tokens.** FSP/Kenntnisprüfung case material
   carries `review: "pending-physician"` and does not ship. Generating faster than review produces
   inventory that cannot be released.
5. **Batch, then gate, then continue.** Never run two batches without the gate in between. The
   gate numbers below are abort conditions, not targets.
6. **Never `Read` a lexicon level file.** `a1.json` is 166KB, `a2.json` 192KB — about 100k tokens
   to read, versus 3.7k for the lemma list:
   ```
   node --input-type=module -e "import {all} from './src/lib/lexicon.js'; console.log(all().map(e=>e.lemma).join(','))"
   ```
7. **Every batch ends green.** `node scripts/validate-lexicon.mjs` exits 0 and `pnpm build`
   succeeds, or the batch is not done. Fix the data, never the validator.

---

## Budget map

| # | Stream | Repo | Output | Batches | Gate |
| --- | --- | --- | ---: | ---: | --- |
| 1 | B1–C2 lexicon inventory | deutschacademy | ~420k | 52 | unresolved ≤ 3 per 125 |
| 2 | **3 examples per word** | deutschacademy | **~4M** | 64 | level-purity check |
| 3 | L1 glosses (ar·tr·uk) | deutschacademy | ~1.5M | 48 | round-trip spot check |
| 4 | Grammar workspaces (45) | deutschacademy | ~150k | 9 | mounts + renders |
| 5 | Übungssätze banks | deutschacademy | ~500k | 40 | answer-key self-consistency |
| 6 | LiD explanations (460) | deutschacademy | ~120k | 10 | cites the official question |
| 7 | Sprachbausteine (50 sets) | deutschacademy | ~200k | 10 | exactly one defensible answer |
| 8 | Praxisdialoge (150) | pflegeplace | ~1M | 30 | vocab drawn from Fachwortschatz |
| 9 | Fachwortschatz + 6 L1s | pflegeplace | ~1M | 24 | term exists in German clinical use |
| 10 | Wissensdatenbank ×16 Länder | pflegeplace | ~600k | 16 | every claim cites an official page |
| 11 | Arztbrief bank + rubrics | pflegeplace | ~500k | 12 | model answer satisfies its own rubric |
| 12 | FSP/Kenntnisprüfung cases | pflegeplace | ~1.5M | 30 | **physician review, ships never without** |
| 13 | Etymology cards (1,000) | icanspeakit | ~1M | 20 | every card cites Wiktionary |
| 14 | Phonetics posts (60) | icanspeakit | ~500k | 20 | IPA claims match the lexicon |
| 15 | Worksheets per topic | icanspeakit | ~400k | 15 | answer key round-trips |
| 16 | Prosody item sets | icanspeakit | ~300k | 12 | stress marks are contrastive |
| 17 | Roleplay scenario bank | icanspeakit | ~400k | 12 | rubric is applicable by a human |

**Zero-token, run these first — they unblock streams 2, 13, 14, 16:**

```
node scripts/fetch-wiktionary.mjs a1 --fill && node scripts/fetch-wiktionary.mjs a2 --fill
node scripts/attach-ranks.mjs
node scripts/generate-audio.mjs          # to an object store, NOT into git
```

---

# Part A — deutschacademy

## Stream 1 — B1–C2 inventory (~420k out, 52 batches)

State at v1: B1 6 units / 150 words. B2, C1, C2 empty. Targets B1 1,150 · B2 1,700 · C1 2,300 ·
C2 1,500.

**BATCH prompt** (substitute LEVEL and the topics):

> Read `docs/lexicon-enrichment-v1.md` and `prompts/lexicon-entry-rubric.md`. Read the last
> `1-lexicon` line of `docs/content-engine-ledger.md` to find where to continue.
>
> Generate 5 units of 25 entries for LEVEL as `data/incoming/LEVEL-tranche-N.json`, topics from the
> closed §4 taxonomy, one topic per unit, German unit titles in the style of the A1/A2 units.
>
> Write `gender`/`plural`/`forms`/`comparative`/`superlative` as explicit `null`. Get the exclusion
> list with the one-liner in hard rule 6. Then:
> `merge-tranche --dry` → `merge-tranche` → `fetch-wiktionary LEVEL --fill` → `attach-ranks LEVEL`
> → `validate-lexicon` → `pnpm build`.
>
> **GATE:** report `unresolved` from the fetch output. **If > 3 of 125, stop** — the word selection
> is inventing compounds. `no German section` on its own is not a failure; German Wiktionary covers
> long administrative compounds poorly and the compound-head fallback handles them.
>
> Append the ledger line. Report: words added, unresolved, rows filled via compound head, validator
> state, and any lemma whose IPA is still missing.

At C1/C2, add to the prompt: topics may include `nominalstil`, `idiomatik`, `kollokation`,
`konnektoren`, `fachsprache`, `stilebene`, `wortbildung`, which exist in the taxonomy for exactly
these levels and are unused so far.

## Stream 2 — three examples per word (~4M out, 64 batches) — the largest single job

Rationale: one example per word means learners memorise the sentence, not the word. Spaced
repetition needs variety. This also backfills the 25 A2 words carrying `note` instead of `example`.

Schema change first: `example` stays the primary, and `examples: [string, string]` carries two
more. The validator must require, when `examples` is present, exactly 2 entries, each non-empty,
each distinct from `example`.

**BATCH prompt:**

> For 125 words (one level's worth of 5 units, continuing from the ledger's `2-examples` line),
> add `examples: [s1, s2]` — two further sentences per word, obeying every example rule in
> `prompts/lexicon-entry-rubric.md`.
>
> The three sentences per word must differ in **structure, not just wording**: a different
> grammatical frame, a different collocation, a different register. Three sentences that are the
> same sentence with synonyms swapped are a failure of this batch.
>
> **GATE — level purity, and run it as a script, not by eye:** for each new sentence, check every
> word against the lexicon. Report the percentage of sentences containing a lemma from a *higher*
> level than the headword, and list the ten worst offenders. **If over 15%, stop and fix the
> rubric** — an example built from harder vocabulary than its headword teaches nothing, and it is
> the failure mode this stream is most prone to at volume.
>
> Then `validate-lexicon`, `pnpm build`, ledger line.

## Stream 3 — L1 glosses (~1.5M out, 48 batches)

Your 15 legacy Redemittel cards are the only multilingual content, and `public/i18n/{ar,tr,uk}.json`
now exist for UI chrome. This is the content layer: `gloss: { ar, tr, uk }` per entry.

**BATCH prompt:**

> Add `gloss: { ar, tr, uk }` to 150 entries, continuing from the ledger. Gloss the **sense the
> `en` field names and the `example` demonstrates** — not the word's most common sense in general.
>
> Arabic gloss in Modern Standard Arabic, no diacritics. Turkish and Ukrainian in the standard
> written form. Keep each under six words; this is a gloss, not a definition.
>
> **GATE:** pick 15 rows at random and back-translate each gloss to English without looking at the
> `en` field. Report every case where the back-translation does not match `en`. **Stop if more than
> 2 of 15 diverge.**

## Stream 4 — grammar workspaces (~150k out, 9 batches)

5 topics currently fall back to a 4–6 question quiz; the inventory stops at 26.

**BATCH prompt:**

> Build 5 rich workspace JSON files in `src/data/grammatik/`, matching the structure and size of
> the existing 21 (8–13KB each). Start with the 5 silent fallbacks, then extend the inventory.
>
> Do not change `src/lib/grammarWorkspace.js` or the `[data-ex-index]` slot contract.
>
> **GATE:** for each new topic, load `/uebungen/grammatik/<id>` and confirm every exercise mounts
> and accepts input. A topic whose JSON parses but whose exercises do not mount is worse than the
> fallback it replaced. Then add each new id to the `grammar_anchor` list in
> `prompts/lexicon-entry-rubric.md`.

## Streams 5–7 — exam item banks (~820k out)

Per Edgar's 2026-09-16 decision: our own items, built to the officially published format, never
presented as official material. Every generated Übungssatz carries
`origin: "deutschacademy, written to the published <exam> format — not official material"`.

**BATCH prompt (stream 5):**

> Build one complete Übungssatz for <exam> in the shape of `src/data/pruefungen/dtz/uebungssatz-1.json`.
> All sections, all items, answer key, scoring table.
>
> **GATE — answer-key self-consistency, and do it adversarially:** solve your own Übungssatz from
> the item text alone, without looking at the key, then diff against the key. Report every
> disagreement. The DTZ prototype shipped with one transcription error caught only by this kind of
> cross-check; treat that as the minimum bar. **Any item where the key is wrong or two options are
> both defensible is rewritten, not shipped.**

**Stream 6:** source the 460 LiD questions from BAMF first — they are published. Generate only the
`why`: 460 explanations of 2–4 sentences, each restating the official question verbatim and then
explaining the answer. Never generate a question.

**Stream 7:** 50 Sprachbausteine sets in the shape of `src/data/pruefungen/sprachbausteine/satz-1.json`.
Gate: each gap has exactly one defensible answer. A gap with two plausible fillers is a broken item.

---

# Part B — pflegeplace

Run these from `~/Projects/Pflegeplace`. Read `REBUILD-PROMPT.md` and its three amendments first —
scope is a healthcare-language-exams hub over six tracks, the paid core is telc B1/B2 Pflege, DTZ
is a free lead magnet.

## Stream 8 — Praxisdialoge (~1M out, 30 batches)

**BATCH prompt:**

> Build 5 Praxisdialoge for <track> in the shape of the existing `src/data/<track>/praxisdialoge.ts`.
> Each: a scripted clinical dialogue, comprehension items, and a vocabulary pull.
>
> Speakers are named by role (Pflegekraft, Patient, Angehörige, Arzt), never by invented full names.
> Situations are ordinary shift realities — Übergabe, Schmerzäußerung, Medikamentengabe, Angehörigen-
> gespräch, Sturz, Aufnahme, Entlassung.
>
> **GATE:** every specialist term in the dialogue must already exist in that track's
> `fachwortschatz.ts`, or be added to it in the same batch. A dialogue that uses vocabulary the
> course never taught is a dialogue the learner cannot use.

## Stream 9 — Fachwortschatz + six L1s (~1M out, 24 batches)

Glosses in **tl, hi, tr, sr, ro, pl** — the actual nurse-migration languages. The German term stays
German; only the gloss and the usage note are translated.

> **GATE:** every term must be one used in German clinical practice, not a literal translation of an
> English medical term. Check each against a German-language clinical source and report any you
> could not confirm. Terms that fail this are removed, not softened.

## Stream 10 — Wissensdatenbank × 16 Bundesländer (~600k out, 16 batches)

Anerkennung procedure differs per Land. One article per Land, in the shape of the existing four.

> **GATE — this stream is sourcing-led, not generation-led.** Every procedural claim (which
> authority, which documents, which fees, which deadlines) cites the official page it came from.
> A paragraph without a citation is deleted before the batch ends. Getting Anerkennung requirements
> wrong costs a reader months of their life, so an honest "this Land's procedure could not be
> confirmed" is the correct output when the source is unclear.

## Stream 11 — Arztbrief / Dokumentation bank (~500k out, 12 batches)

Templates, model answers, and rubrics — writing practice by self-comparison, with no scoring
backend and no liability.

> **GATE:** apply each rubric to its own model answer. If the model answer does not score full
> marks against its own rubric, one of the two is wrong. Fix before shipping.

## Stream 12 — FSP / Kenntnisprüfung cases (~1.5M out, 30 batches) — LAST

> Every file carries `review: "pending-physician"` and is excluded from the build until a physician
> signs it off. **Do the language layer first** (Fachwortschatz, Kommunikationsphrasen, Arztbrief
> structure) — it needs no clinical sign-off. Generate clinical cases in batches of 5, sized to what
> a reviewer can actually read in a sitting. Never generate more than the review queue can absorb.

---

# Part C — icanspeak.it

Run these from `~/Projects/icanspeakit`. **Do the WordPress prune first** — 19,211 of 19,374
tracked files are a dead asset dump, and every batch here otherwise carries them.

## Stream 13 — Etymology cards (~1M out, 20 batches)

> 50 cards per batch. For each word, fetch the **de.wiktionary or en.wiktionary etymology section
> first**, then write the card in the voice of the existing posts. Each card stores
> `source: "<wiktionary url>"`.
>
> **GATE:** a card with no source field does not ship. Etymology is a hallucination minefield —
> a confident invented origin is indistinguishable from a real one to every reader, which is exactly
> why the citation is the deliverable and not a nicety.

## Stream 14 — Phonetics explainer posts (~500k out, 20 batches)

The one stream where free-form generation is exactly right, because the prose *is* the product.
3 posts per batch, in the voice of the existing seven.

> **GATE:** every IPA claim in a post must match the `ipa` field in the shared lexicon for that
> word, or cite Wiktionary directly. The market position is "teach the mechanism" — a wrong
> transcription in a phonetics explainer destroys exactly the credibility the brand is built on.

## Streams 15–17 — worksheets, prosody, roleplay (~1.1M out)

> **15:** one printable worksheet per explainer post. Gate: solve your own worksheet from the item
> text alone and diff against the key.
> **16:** prosody sets — same sentence, different stress, with the *why* for each. Gate: each
> stress placement must change the meaning. A set where two placements mean the same thing is not
> teaching contrast.
> **17:** roleplay scenario bank — personas, briefs, follow-up trees, rubrics. This is what makes
> the live Conversational-AI module cheap at runtime instead of improvising per session. Gate: a
> human can apply the rubric to a transcript and reach the same score twice.

---

## Abort conditions — stop the whole engine and raise it

- A gate fails twice on the same stream after a rubric change.
- The validator is edited to make data pass.
- A batch ships without its ledger line.
- Generated morphology appears anywhere in `src/content/lexicon/`.
- Stream 12 output exceeds what the physician review queue has absorbed.
- Stream 10 ships a procedural claim without a citation.

## Definition of done, whole engine

- deutschacademy: 8,000 lexicon entries, 3 examples each, ar/tr/uk glosses, 8 trainer pools
  reported before and after, `aussprache` explicitly noted as still 0 until audio ships from the
  object store.
- pflegeplace: six tracks with full Fachwortschatz + six L1 glosses, 150 Praxisdialoge, 16
  Bundesland articles, own DTZ Übungssätze replacing the g.a.s.t dependency, FSP/Kenntnisprüfung
  held in review.
- icanspeak.it: WordPress dump gone, 1,000 sourced etymology cards, 60 posts with worksheets,
  prosody and roleplay banks.
- Every level green: `validate-lexicon` exits 0, `pnpm build` succeeds, ledger complete.

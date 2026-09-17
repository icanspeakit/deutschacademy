# DeutschAcademy — Vocabulary Generation — Tiered Build Prompt (v1, 2026-09-17)

## How to use this file

Ready-to-paste prompts for filling `src/content/lexicon/b1.json` … `c2.json`, which are currently
26-byte empty stubs. Same pattern as `EXAMS-HUB-TIERED-PROMPT.md` and
`UEBUNGEN-REDESIGN-TIERED-PROMPT.md`: paste **one tier at a time** into Claude Code running in
this repo, review, then continue. Later tiers assume earlier tiers' files exist.

Every tier ends with a **Definition of Done** and writes a note to `docs/`, following
`self-study-tools-v1.md`: what was built, what is sourced vs generated, and any decision that was
taken rather than assumed.

## The three documents and who reads them

| File | Read by | Changes when |
| --- | --- | --- |
| `docs/lexicon-enrichment-v1.md` | humans, agents | the schema or the sourced/generated split changes |
| **this file** | an agent, one tier at a time | the build sequence changes |
| `prompts/lexicon-entry-rubric.md` | **`scripts/generate-lexicon.mjs`, at runtime** | the quality bar changes — and then every row it produced is stale |

The rubric is a separate file because it is **program input, not prose**. The generator sends it as
the cached prefix on every API call, and every row it produces records which version made it
(`rubric: "v1"`). Bury it inside this document and you lose the cache, and you lose the ability to
ask "which rows came from the old rubric?" — the same provenance argument that gives `ipa` its
`ipaSource`.

---

## Context (read before any tier)

- **Current state.** 1,350 words exist (A1 650, A2 700), curated, with `rank`, `example`, verb
  `forms`. Unit `a1-01` also has sourced `ipa`. `b1.json`–`c2.json` are `{"level":"B1","units":[]}`
  and nothing else. Targets from `data/lernsets/summary.json`: B1 1,150 · B2 1,700 · C1 2,300 ·
  C2 1,500 = **6,650 missing**.
- **Stack.** Astro 7 + vanilla JS. `package.json` carries exactly one runtime dependency (`astro`).
  Keep it that way — the generator is a `scripts/*.mjs` build tool, not a dependency.
- **Schema.** Defined in `docs/lexicon-enrichment-v1.md` §2. Do not restate it differently here or
  anywhere else. `id` is the localStorage progress key; changing how it derives orphans learner
  history.
- **The field split is non-negotiable** (`docs/lexicon-enrichment-v1.md` §1): the generator writes
  `lemma`, `pos`, `en`, `example`, `topics`, `grammar_anchor`. It writes `gender`, `plural`,
  `forms`, `aux`, `comparative`, `superlative` as **`null`**, and `scripts/fetch-wiktionary.mjs`
  fills them from de.wiktionary.org afterwards. A generated gender is a guess that ships forever.
- **Existing tooling to reuse, not rebuild.** `scripts/fetch-wiktionary.mjs` (IPA + morphology),
  `scripts/attach-ranks.mjs` (frequency), `scripts/validate-lexicon.mjs` (gate),
  `scripts/extract-lernsets.mjs` (Lernset export).
- **Cost shape.** ~80 output tokens per entry, so all 6,650 is ≈530k output tokens — the cheap end
  of the content plan, and the thing most of the rest depends on. Batch it; do not generate
  entries as chat turns.

## Non-negotiable constraints

1. **Never generate morphology.** See the field split above. This is the one rule whose violation
   cannot be detected later without re-checking every row.
2. **Do not touch `a1.json` or `a2.json`.** Those 1,350 rows are curated. This workstream is
   B1–C2 only.
3. **`grammar_anchor` must be one of the 21 ids** in `src/data/grammatik/*.json`, or absent.
   `validate-lexicon.mjs` enforces it.
4. **`topics` must come from the closed §4 taxonomy** in `validate-lexicon.mjs`. A new topic is a
   decision to raise, not a field to invent.
5. **No duplicate lemmas across levels.** 1,350 already exist; a repeated lemma collides on `id`
   and the validator will reject it. Load the existing lexicon and exclude before generating.
6. **Quality gate before scale.** Tier 0 exists because a bad rubric produces 6,650 bad rows
   faster than a good one produces 25 good ones.

---

## Tier 0 — 25-word probe, and the rubric comes *out* of it

The rubric is an **output** of this tier, not an input. You cannot write a good instruction for
"a B1 example sentence" until you have looked at twenty-five mediocre ones and named what's wrong.

**Prompt:**

> Generate **25 B1 entries** for `src/content/lexicon/b1.json` as a single unit `b1-01`, using the
> schema in `docs/lexicon-enrichment-v1.md` §2 and the draft rubric in
> `prompts/lexicon-entry-rubric.md`.
>
> 1. Load the existing lexicon (`node -e` importing `src/lib/lexicon.js`) and collect all 1,350
>    existing lemmas. Exclude them.
> 2. Pick one coherent topic from the §4 taxonomy for the unit — `arbeit` or `gesundheit` are good
>    candidates at B1 — and give the unit a German `title` in the style of the A1/A2 units
>    ("Person & Vorstellung", "Haus & Räume").
> 3. Generate 25 entries. Write `lemma`, `pos`, `en`, `example`, and `grammar_anchor` where one
>    genuinely applies. Write **`gender: null`, `plural: null`, `forms: null`** for every row —
>    do not fill them, do not omit them, so the fill pass can find them.
> 4. Then run, in order:
>    `node scripts/fetch-wiktionary.mjs b1 --unit b1-01 --dry`
>    and read `docs/lexicon-audit-v1.md`.
> 5. **Report to me, before writing anything further:**
>    - the 25 entries in full, so I can read every example sentence
>    - how many lemmas Wiktionary could not find (a high number means the generator picked words
>      that aren't real German lemmas — the single most useful quality signal available)
>    - your own critique: which example sentences are weak, and why
> 6. From that critique, propose a **revised `prompts/lexicon-entry-rubric.md`** as a diff. Name
>    each new rule after the specific failure that motivated it, the way
>    `docs/lexicon-enrichment-v1.md` §4 names each parser rule after the bug that caused it.

**Definition of Done:**

- 25 entries exist, `pnpm build` succeeds, `node scripts/validate-lexicon.mjs` exits 0.
- Every row has `gender`/`plural`/`forms` present and `null` — verified, not assumed.
- Wiktionary lookup rate reported. **If more than 3 of 25 lemmas are unfindable, stop and raise
  it** — the word selection is the problem, not the rubric.
- `prompts/lexicon-entry-rubric.md` bumped to v2 with rules traceable to observed failures.
- `docs/vocab-generation-tier0-v1.md` written: what was generated, the lookup rate, the rubric
  changes and why.

---

## Tier 1 — the harness

**Prompt:**

> Build `scripts/generate-lexicon.mjs`, following the conventions of the existing scripts (plain
> ESM, no new dependencies, `node_modules/.cache` for anything cached, exits non-zero on failure).
>
> ```
> node scripts/generate-lexicon.mjs b1 --count 200 --topic arbeit --dry
> node scripts/generate-lexicon.mjs b1 --count 200 --topic arbeit
> ```
>
> 1. Reads `prompts/lexicon-entry-rubric.md` and sends it as a **cached prefix**, so the rubric is
>    billed once per batch window rather than per call.
> 2. Loads every existing lemma across all six levels and excludes them, per constraint 5.
> 3. Batches ~50 entries per request. Requests strict JSON and **validates each row against the
>    schema before accepting it** — a malformed batch is retried once, then reported, never
>    silently dropped.
> 4. Stamps every row with `rubric: "<version from the rubric file's frontmatter>"`.
> 5. Groups accepted rows into 25-word units with stable ids (`b1-01`, `b1-02`, …) and German
>    titles, appending to the level file without disturbing existing units.
> 6. `--dry` writes nothing and prints what it would add.
> 7. Prints a cost line: input tokens, output tokens, cached tokens, entries accepted, entries
>    rejected.
>
> Use the Batch API where the provider offers it — this work is never latency-sensitive and the
> discount applies to exactly this shape of job.
>
> Do **not** have the script call `fetch-wiktionary.mjs` or `validate-lexicon.mjs` itself. Keep
> them composable; the chaining belongs in a `package.json` script (Tier 2).

**Definition of Done:**

- `--dry` on 50 B1 entries prints valid rows and a cost line, writes nothing.
- A deliberately corrupted model response is rejected and reported, not written. Test this.
- Re-running with the same arguments does not duplicate lemmas.
- `docs/vocab-generation-tier1-v1.md` written.

---

## Tier 2 — chain it and fill B1

**Prompt:**

> 1. Add to `package.json`:
>    ```json
>    "lexicon:generate": "node scripts/generate-lexicon.mjs",
>    "lexicon:ipa":      "node scripts/fetch-wiktionary.mjs",
>    "lexicon:ranks":    "node scripts/attach-ranks.mjs",
>    "lexicon:validate": "node scripts/validate-lexicon.mjs",
>    "lexicon:build":    "pnpm lexicon:generate $LEVEL && pnpm lexicon:ipa $LEVEL --fill && pnpm lexicon:ranks $LEVEL && pnpm lexicon:validate"
>    ```
>    Adjust the chained form to whatever actually works on Windows + pnpm — verify it runs, don't
>    assume the shell syntax.
> 2. Generate B1 to its full target of 1,150 words, in tranches of ~200, **pausing after each
>    tranche** for the audit report and my review. Do not run all 1,150 unattended.
> 3. After each tranche: fill morphology, attach ranks, validate, build.

**Definition of Done:**

- `b1.json` holds 1,150 entries across 46 units, validator exits 0, `pnpm build` succeeds.
- Every row has sourced-or-null morphology. Zero generated genders — spot-check 20 rows by hand
  against Wiktionary and report the result.
- Coverage table in `docs/vocab-generation-tier2-v1.md`: entries, IPA coverage, morphology
  coverage, rank coverage, and the count of rows where Wiktionary found nothing.

---

## Tier 3 — B2, C1, C2, and the trainer pools

**Prompt:**

> Repeat Tier 2 for `b2` (1,700), `c1` (2,300), `c2` (1,500). Then:
>
> 1. Re-run `node scripts/extract-lernsets.mjs` and confirm `data/lernsets/summary.json` reflects
>    the new totals.
> 2. Report the eight trainer pools (`karten`, `artikel`, `plural`, `verbformen`, `trennbare`,
>    `komparativ`, `verbPraeposition`, `aussprache`) before and after.
> 3. Flag explicitly that `aussprache` is still **0** until audio exists — `ipa` does not fill it,
>    the pool is defined as `has: "audio"`. Audio is a separate workstream and belongs in an
>    object store, not this repo's git history.

**Definition of Done:**

- 8,000 words total, validator green, build green.
- `docs/vocab-generation-tier3-v1.md` with the before/after pool table.

---

## Ground rules

- One tier at a time. Never start a tier without a checkpoint on the one before it.
- Never generate `gender`, `plural`, `forms`, `aux`, `comparative`, `superlative`.
- Never modify `a1.json` or `a2.json` in this workstream.
- Never add a runtime dependency to `package.json`.
- Never invent a `topic` or a `grammar_anchor` — both lists are closed and validated.
- If the validator fails, fix the data, not the validator.

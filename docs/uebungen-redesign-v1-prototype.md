# Übungen redesign — `/v1` prototype: the meaningful 10% (2026-09-14)

Sandbox execution of the highest-value parts of `UEBUNGEN-REDESIGN-TIERED-PROMPT.md`, built
at `/v1` rather than on the live routes so it can be judged before it ships. Internal page,
not linked from the public nav.

## What "the meaningful 10%" means here

Two changes, chosen because they are the ones that alter what a learner actually *learns* —
not just how the page looks — and because both run on data that already exists:

| In | Not in | Why |
| --- | --- | --- |
| **Tier 3 core** — Artikel-Trainer: gender with plural + sentence, 10 at a time, wrong answers return | Tier 2 — writing five grammar workspaces | That is teaching authorship (~200 example sentences) and needs Edgar. It is the expensive 90%. |
| **Tier 4 core** — Lesen: text and questions side by side | Tier 4 rest — Kultur, grammar hub counts | Lower impact; cheap to add later. |
| | Tier 1 | Already shipped to the live template — see `uebungen-redesign-tier1-v1.md`. |

## The toggle

Top bar has two switches: **area** (Artikel-Trainer / Lesen) and **view**
(Jetzt / V1 / Nebeneinander). "Nebeneinander" renders both versions in two panes so the
change is visible in one screen rather than remembered between clicks.

## 1. Artikel-Trainer

**Today**: one bare noun (`Polizist?`) and three buttons per screen. Gender detached from the
plural and from any sentence — the least durable way to learn it; 33% guessable; and each
round draws fresh, so wrong answers never come back.

**V1**:
- **Ten nouns per round in a grid**, so the pattern across words (`-ung` → die, `-chen` → das)
  is visible instead of hidden one word at a time.
- **After answering, the reveal**: `der Boden · Plural: die Böden` plus the real example
  sentence — both pulled from `src/lib/lexicon.js`, which already carries `gender`, `plural`
  and `example` for 776 A1/A2 nouns. No new content was written for this.
- **Wrong answers come back**: up to 40% of the next round is refilled from previously missed
  words, badged `nochmal`. Stored in `localStorage` (`da-v1-wrong`).
- Rule panel sits beside the exercise instead of behind a tab that hides it.

Verified: 10 answered → 4 wrong recorded → **all 4 returned in the next round**, badged.
The reveal contains both the plural and the sentence.

This is deliberately *not* spaced repetition. It is "what you got wrong comes back", which is
what the code does and what the page claims. A real interval schedule needs a decision about
whether progress stays local-only (no account to sync to) — flagged in the tiered prompt.

## 2. Lesen

**Today**: 46% of screen width, 7.19 screens tall, first question ~1.09 screens below the
text. The learner reads, scrolls away, then answers from memory — which tests recall, not
reading comprehension. The real DTZ puts text and items on one spread.

**V1**: two columns, text sticky on the left, questions on the right. Measured in the
prototype: text top 127px, first question top 175px — **both on the first screen**.

## One bug worth recording

The first build of the side-by-side view collapsed the V1 panes to a single column (a
`[data-view="split"]` override), so **the Lesen comparison showed no difference at all** —
the improvement being demonstrated was hidden by the thing demonstrating it. Fixed by letting
each ~858px pane keep its two-column layout and moving the collapse threshold to 1500px,
where a half-screen pane genuinely stops being readable.

Also worth noting for anyone extending this page: the styles are `is:global` with a strict
`v1-` namespace **on purpose**. The trainer grid is built by JS at runtime, and Astro's scoped
styles only reach elements that existed at build time, so scoped CSS would silently not apply
to it.

## Verification

- `npx astro build` — 61 pages, no errors.
- Playwright at 1800×1100: all three views, reveal content, repetition loop, reading columns.
- Mobile 390px and 360px: no horizontal overflow, trainer collapses to one column, all 10
  items render.

## Open, unchanged

- Tier 2 authorship (the five empty grammar topics) still needs Edgar's call.
- Whether `/v1` behaviour replaces the live Artikel-Trainer and Lesen pages, or whether those
  get it behind a flag first.

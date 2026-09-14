# DeutschAcademy — Übungen Redesign — Tiered Build Prompt (v1, 2026-09-14)

## How to use this file

Ready-to-paste prompts for fixing the didactic and layout problems found in a full audit of
all 37 `/uebungen` routes (exams excluded). Same pattern as `EXAMS-HUB-TIERED-PROMPT.md`:
paste **one tier at a time** into Claude Code running in this repo
(`C:\Users\Edgar\Projects\deutschacademy`), review, then continue. Later tiers assume earlier
tiers' files exist.

Every tier ends with a **Definition of Done** and writes a note to `docs/`, following
`self-study-tools-v1.md`: what was built, what is real vs. placeholder, and any decision that
was taken rather than assumed.

---

## Context (read this before starting any tier)

- **Stack**: Astro 7 + vanilla JS, no framework. One runtime dependency (`astro`) — keep it
  that way. Brand tokens in `src/styles/global.css`; practice styling in
  `src/styles/practice.css` and `src/styles/verben-praepositionen.css`.
- **Page scripts do not survive SPA navigation.** 20 pages mount themselves from a
  `<script type="module">`. Page transitions are therefore **cross-document**
  (`@view-transition` in `global.css`), not Astro's `<ClientRouter />`. Do not introduce
  `<ClientRouter />` without refactoring all 20.
- **The grammar template is the site's centre of gravity.** `src/pages/uebungen/grammatik/[id].astro`
  renders 26 topics. 21 have a rich workspace file in `src/data/grammatik/<topic>.json`;
  5 do not and silently fall back to a 4–6 question quiz from `src/data/grammatik.json`.
- **Exercise mounting contract**: `mountGrammarWorkspace(pageRoot, data)` in
  `src/lib/grammarWorkspace.js` finds slots via `pageRoot.querySelectorAll("[data-ex-index]")`.
  Any layout restructure is safe **as long as the slots stay inside `#vp-page`**.
- **The lexicon already exists.** `src/lib/lexicon.js` serves 1,350 A1/A2 entries with
  `gender`, `plural`, `forms`, `example` and an English gloss
  (`docs/wortschatz-programm-v1.md`). The Artikel-Trainer currently ignores all of it except
  `gender`.
- **Layout prototype**: `/better` (`src/pages/better.astro`) compares today's layout against
  two alternatives with a live metrics readout. `/sora` and `/front` are the same kind of
  internal study page. None are linked from the public nav.

### Audit baseline (1920×1040, all 37 Übungen routes)

| Metric | Value |
| --- | --- |
| Average screen width used | **50%** |
| Average page height | 3.11 screens |
| Average exercise items reachable without scrolling | **3 of 44** |
| Routes with 0 actionable items above the fold | 7 |
| Rich grammar topics (21) | 48–93 items each, **~1 above the fold** |
| Fallback grammar topics (5) | 0.74 screens, **2 interactive elements** |

---

## Tier 1 — Grammar workspace layout (21 routes, biggest single win)

**Prompt:**

> Port the "B · Übung zuerst" layout from `src/pages/better.astro` into the real grammar
> template `src/pages/uebungen/grammatik/[id].astro`, so all 26 topic pages get it.
>
> 1. Restructure the page body into two columns inside the existing `#vp-page` element:
>    an **exercises column** (primary, listed first in the DOM) and a **rule column**
>    (the hero text plus the `.vp-card` concept block and reference panel).
>    Every `[data-ex-index]` slot MUST stay inside `#vp-page` — `mountGrammarWorkspace`
>    binds to them from that root, and moving them outside it silently breaks every exercise.
> 2. The rule column is `position: sticky` so the rule stays visible while the learner works
>    through the exercises — that is the didactic point, not decoration.
> 3. Exercises render in a 2-up grid on wide screens. Add a "Regel ausblenden / einblenden"
>    toggle that collapses the rule column and widens the exercise grid to 3-up. Persist the
>    choice in `localStorage`.
> 4. Widen the page from its current 880px cap to ~1600px. Do this with a modifier class on
>    the page, not by changing `.practice-main` — that class is shared by 15 other pages.
> 5. Below 1000px collapse everything back to the current single-column order, with the rule
>    ABOVE the exercises (on a phone, scroll order is the only hierarchy there is).
> 6. Do not change any exercise engine, any JSON data, or `grammarWorkspace.js`. This tier is
>    layout only.
>
> Verify with Playwright at 1920×1040 on at least three topics (one table-heavy, one
> story/fill-heavy, one of the 5 fallback topics) that: every exercise still mounts and
> accepts input, and the number of exercise fields above the fold went from ~1 to >10.

**Definition of Done:**
- All 26 grammar routes build and render; exercises still mount and grade on every type
  (`table`, `fill`, `story`, `match`, and the legacy quiz fallback).
- Measured before/after for exercise fields above the fold, on at least 3 topics.
- Mobile (≤1000px) collapses to one column, rule first, with no horizontal overflow —
  verify with the `mobile-responsive-fix` sweep script, not by eye.
- `docs/uebungen-redesign-tier1-v1.md` written: what changed, the measured before/after, and
  explicitly which of the 5 fallback topics still look thin because they have no content yet
  (that is Tier 2's job, not a layout bug).

---

## Tier 2 — Content parity for the 5 fallback grammar topics

**Prompt:**

> Five topics have no workspace file and fall back to a 4–6 question legacy quiz, so they
> measure 0.74 screens with 2 interactive elements while their neighbours have 48–93:
> **dativ, konjunktiv2, passiv, relativpronomen, trennbare-verben**.
> From `/uebungen/grammatik` they are indistinguishable from the rich ones, so a learner
> picking "Passiv" gets a fifth of what "Negation" gives them.
>
> 1. Write `src/data/grammatik/<topic>.json` for all five, matching the existing schema
>    exactly (`id`, `name`, `level`, `subtitle`, `source`, `concept{flow, exampleHtml, qa,
>    noteHtml, reference}`, `exercises[]` with types `table` / `fill` / `story` / `match`).
>    Read two or three existing rich files first and follow them; do not invent new fields.
> 2. Each topic gets at least 4 exercises and at least 40 answerable items, so it is
>    comparable in weight to the existing 21.
> 3. Reuse the existing legacy questions from `src/data/grammatik.json` for that topic where
>    they fit — they are real teaching examples and should not be thrown away.
> 4. Where grammar content is drawn from the teacher's own material, say so in the `source`
>    field; where it is standard textbook grammar, say that instead. Do not present invented
>    example sentences as sourced.
> 5. Once a topic has a workspace file, the legacy entry in `src/data/grammatik.json` is dead
>    for that topic — leave the file alone but note which entries are now unused.
>
> Validate: every new file parses, every exercise type used is one `grammarWorkspace.js`
> actually implements, and every answer key is correct German.

**Definition of Done:**
- All 26 grammar topics render from a workspace file; no route falls back to the legacy quiz.
- Every new topic ≥ 4 exercises and ≥ 40 items; report the per-topic counts.
- `docs/uebungen-redesign-tier2-v1.md`: per-topic sourcing note (real teaching material vs.
  standard grammar), and the list of now-unused `grammatik.json` entries.

---

## Tier 3 — Artikel-Trainer: teach gender the way it is actually learned

**Prompt:**

> The Artikel-Trainer shows a bare noun (`Polizist?`) and three buttons. Three problems:
> gender is drilled detached from the plural and from any sentence, which is the least
> durable way to learn it; three choices means 33% is guessable; and wrong answers are never
> repeated, so the trainer can only test, not teach. Meanwhile `src/lib/lexicon.js` already
> holds `plural`, `example` and an English gloss for all 1,350 A1/A2 entries.
>
> 1. Show the noun **in context**: after answering, reveal `der Polizist → die Polizisten`
>    and the example sentence from the lexicon. The data is already there; use it.
> 2. Replace one-item-per-screen with a **grid of 8–12 nouns** answered together and checked
>    in one go, so the learner sees the pattern across items (all the `-ung` words, all the
>    `-chen` words) instead of one word in isolation.
> 3. Use the dead right-hand column for the rule and the running session list. The "Regel"
>    tab currently HIDES the exercise to show the rule; on a screen that is 80% empty that
>    trade should not exist.
> 4. **Close the repetition loop**: bias `drawSession()` toward items previously answered
>    wrong. `src/lib/progress.js` already records per-item correctness — read it back.
>    Keep it honest: no fake "mastery" claims, just "these came back because you missed them".
> 5. Keep ids as lexicon slugs so progress stays stable.
>
> Apply the same treatment to `/uebungen/grammatik/akkusativ`, which has the same
> one-item-per-screen shape (40% width, ~390px dead space).

**Definition of Done:**
- Artikel-Trainer shows plural + example after answering, grids 8–12 items, and repeats
  previously-wrong items measurably more often than chance (demonstrate it).
- Rule visible alongside the exercise; no mode switch needed.
- `docs/uebungen-redesign-tier3-v1.md`: what the repetition weighting actually does, in
  plain terms, so the claim on the page matches the code.

---

## Tier 4 — The long tail: Lesen, Kultur, hub

**Prompt:**

> Remaining audit findings, smallest-impact last.
>
> 1. **`/uebungen/lesen-schreiben`** (46% width, 7.19 screens): put the reading text and its
>    questions side by side — text left and sticky, questions right — so the learner reads
>    *against* the question. Today the first question sits a full screen below the text, which
>    tests memory rather than reading comprehension; the real DTZ has both on one spread.
> 2. **`/uebungen/kultur`** has **0 interactive elements**. Either add a real task
>    (a position/argument sort, or a Pro/Contra sorting exercise from the existing
>    `kultur.json` pros/cons arrays) or reframe it honestly as a reading page and stop
>    listing it beside the drills as if it were one.
> 3. **`/uebungen/grammatik`** is 2.19 screens of pure navigation with 0 actionable items.
>    Show per-topic weight (item counts, level) on the cards so a learner can tell a 90-item
>    topic from a 40-item one — the counts are derivable from the JSON, so derive them.
> 4. Re-run the full audit script and confirm the site averages are meaningfully better than
>    the Tier-0 baseline in the Context table above.

**Definition of Done:**
- Lesen two-column on desktop, stacked on mobile, no overflow.
- Kultur either has a real exercise or is presented as reading, not practice.
- Grammar hub cards show derived counts, never hand-typed.
- `docs/uebungen-redesign-tier4-v1.md` with the re-run audit table vs. baseline.

---

## Open decisions this prompt does NOT resolve (flag to Edgar, don't guess)

- **Tier 2 content authorship.** Writing five full grammar workspaces is real teaching work.
  Whether those should be drafted from the Deutsch v3 folder, written fresh, or held until
  Edgar writes them is his call — do not silently invent 200 example sentences and present
  them as sourced.
- **Whether `/uebungen/kultur` should stay in the exercises grid at all**, given it has no
  task. That is a product decision, not a layout one.
- **Whether the 5 fallback topics should be hidden from `/uebungen/grammatik` until Tier 2
  lands.** Shipping Tier 1 makes their thinness more visible, not less.
- **Spaced repetition model in Tier 3.** "Repeat what you got wrong" is the honest minimum.
  Anything stronger (SM-2, intervals across sessions) needs a decision about whether
  progress stays local-only, since it currently has no account to sync to.

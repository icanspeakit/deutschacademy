# Übungen redesign — Tier 1: grammar workspace layout (2026-09-14)

Tier 1 of `UEBUNGEN-REDESIGN-TIERED-PROMPT.md`. Layout only — no exercise engine, no JSON
data and no `grammarWorkspace.js` changes.

## Why this tier first

A scripted audit of all 37 `/uebungen` routes (exams excluded) at 1920×1040 found the site
averaging **50% of screen width, 3.11 screens tall, and 3 of 44 exercise items reachable
without scrolling**. The worst case was this one template: `[id].astro` serves 26 topics
carrying 48–93 exercise items each, and showed **about one of them above the fold**, because
six explanation cards plus the hero consumed the entire first screen of an 880px column.

Prototyped and compared at `/better` before committing to it.

## What changed

- `src/pages/uebungen/grammatik/[id].astro` — body restructured into `.vp-workspace` holding
  a rule column (`<aside id="vp-rule">`: hero + concept card + reference panel) and an
  exercises column (`<section class="vp-col--ex">`).
- `src/styles/verben-praepositionen.css` — `.vp-page--split` (1600px), the two-column grid,
  sticky rule column, 2-up exercise grid, and the collapsed-rule state.
- A "Regel ausblenden / einblenden" toggle, persisted in `localStorage` under
  `da-grammatik-rule`. Collapsing the rule widens the exercise grid from 2-up to 3-up.

### Two constraints that shaped the markup

1. **`[data-ex-index]` slots had to stay inside `#vp-page`.** `mountGrammarWorkspace` binds
   to them via `pageRoot.querySelectorAll("[data-ex-index]")`; moving them out of that root
   would have silently killed every exercise on all 26 pages with no build error.
2. **The rule is FIRST in the DOM, not the exercises.** On a phone there is one column and
   scroll order is the only hierarchy available, so the learner should still meet the rule
   first. Desktop uses explicit `grid-column`/`grid-row` placement to put the exercises on
   the left, rather than `order`, so the two orders are independent.

## Measured before → after (1920×1040)

| Topic | Exercise fields above fold | Width used | Page height |
| --- | --- | --- | --- |
| artikel | 1 → **19** | 46% → **83%** | 4.56 → **2.63** screens |
| negationswoerter | 1 → **12** | 46% → **83%** | 5.06 → **3.23** screens |
| wechselpraepositionen | 1 → **15** | 46% → **83%** | 4.68 → **2.87** screens |

All five exercise slots mount on every topic tested, across every exercise type in the
codebase (`table`, `fill`, `story`, `match`, `build`), and inputs still accept and grade
answers. Mobile sweep (16 routes × 4 real devices): **0 overflow**; grammar routes
specifically 0.

## Known and expected: the five fallback topics look worse, not better

`dativ`, `konjunktiv2`, `passiv`, `relativpronomen` and `trennbare-verben` have no
`src/data/grammatik/<topic>.json`, so `[id].astro` falls back to a 4–6 question legacy quiz
from `src/data/grammatik.json`. They measured 0.74 screens with 2 interactive elements before
this tier and **0.55 screens after** — widening the page made their emptiness more obvious.

This is a content gap, not a layout regression, and it is Tier 2's job. It was flagged in
advance under "Open decisions" in the tiered prompt: shipping Tier 1 makes their thinness more
visible, so the question of whether to hide them from `/uebungen/grammatik` until Tier 2 lands
is now live rather than hypothetical.

## Not done in this tier

- No content was written or changed.
- The Artikel-Trainer and `/uebungen/grammatik/akkusativ` still use the one-item-per-screen
  shape (Tier 3).
- `/uebungen/lesen-schreiben`, `/uebungen/kultur` and the grammar hub are untouched (Tier 4).

## Verification

- `npx astro build` — 60 pages, no errors.
- Playwright at 1920×1040 across 5 topics (3 rich, 2 fallback): slot mount counts, exercise
  types rendered, fields above fold, input acceptance.
- `mobile-responsive-fix` sweep: 0 overflow across 16 routes × 4 devices.

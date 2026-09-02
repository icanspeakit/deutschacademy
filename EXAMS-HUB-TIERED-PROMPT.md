# DeutschAcademy — Exams Hub — Tiered Build Prompt (v1, 2026-09-02)

## How to use this file

This is a set of ready-to-paste prompts for building a `/pruefungen` (exams) hub on deutschacademy.com — a section covering **telc, Goethe, TestDaF, DTZ, and Leben in Deutschland (LiD)**, inspired by deutsch-vorbereitung.com and prepdaf.com.

Each tier below is self-contained and builds on the previous one. Paste **one tier at a time** as a prompt to Claude Code running in this repo (`C:\Users\Edgar\Projects\deutschacademy`) — don't skip ahead, since later tiers assume earlier tiers' files exist. After each tier, review the output before starting the next.

Every tier ends with a **Definition of Done** and a required **sourcing/decisions note**, written to `docs/` in this project, following the same pattern as the existing `self-study-tools-v1` and `value-stack-v1` write-ups (every claim/question traces back to a real source file or is explicitly flagged as invented/placeholder).

---

## Context (read this before starting any tier)

- **Stack**: Astro + vanilla JS, no React/Vue. Shared engine already exists: `src/lib/quiz.js` (text-input/multiple-choice, self-scoring) and `src/lib/flashcards.js` (flip/shuffle deck), both data-driven from JSON in `src/data/`. Styling reuses brand tokens (`--brand-blue`, `--gradient-brand`, etc.) from `src/styles/global.css` and `src/styles/practice.css`.
- **Existing practice hub**: `/uebungen` already links five tools — `artikel-trainer`, `grammatik`, `wortschatz`, `sprechen`, `lesen-schreiben`. These are DTZ B1-flavored (sourced from the Deutsch v3 teaching folder) but not exam-branded.
- **Scope decision (revised)**: an earlier pass (`value-stack-v1.md`) scoped deutschacademy to Goethe/TestDaF/telc only and deliberately excluded DTZ, reasoning the source material was DTZ-heavy and Pflege-specific German is pflegeplace.com's lane. **This is now reversed** — the exams hub covers all five: **telc, Goethe, TestDaF, DTZ, Leben in Deutschland**. Note this reversal explicitly in the Tier 1 decisions doc so it's not silently lost.
- **Source material**: the Deutsch v3 teaching folder (same one used for `/uebungen`) is mostly DTZ-branded (`DTZ_Simulation_Leseverstehen_v2.pdf`, `gast_DTZ_Uebungssatz`, `Leben in Deutschland` material, `Bildbeschreibung.docx`, etc.) — so DTZ and LiD pages will have the richest real content. **Goethe and TestDaF have little to no dedicated source material** — flag this explicitly per tier rather than inventing exam-specific content; use only publicly-known, generic exam-format facts (levels, skill sections, timing) for those two, clearly separated from anything sourced from the teaching folder.
- **Competitor inspiration**:
  - deutsch-vorbereitung.com — dual navigation (by CEFR level *and* by exam), exam cards, DTZ/telc/Goethe/ÖIF/ÖSD coverage, testimonial + FAQ heavy homepage, monthly subscription paywall.
  - prepdaf.com — narrower (Goethe/telc/TestDaF), each exam page broken into six skills (Lesen/Hören/Schreiben/Sprechen/Grammatik/Wortschatz), AI feedback on writing/speaking, tiered subscription pricing (weekly/monthly/3mo/6mo), placement test as the free hook.
  - Borrow: the six-skill breakdown per exam page (prepdaf), and the exam-vs-level dual entry point (deutsch-vorbereitung) — not the AI-feedback claim (deutschacademy's existing copy already commits to **human** correction by an instructor, not a model — don't contradict that).

---

## Tier 1 — MVP info hub (no interactive tools, ships fast)

**Prompt:**

> Build a `/pruefungen` exams hub for deutschacademy (Astro project at repo root). Create:
> 1. `src/pages/pruefungen/index.astro` — hub page listing all five exams as cards (telc, Goethe, TestDaF, DTZ, Leben in Deutschland), each with a one-line description, target CEFR level(s), and a link to its detail page. Match the visual style of the existing `/uebungen` hub page (same layout patterns, brand tokens from `global.css`).
> 2. Five detail pages: `src/pages/pruefungen/telc.astro`, `goethe.astro`, `testdaf.astro`, `dtz.astro`, `leben-in-deutschland.astro`. Each page includes: exam overview (who it's for, why it matters e.g. citizenship/visa/university/work), CEFR levels covered, the skill sections tested (Lesen/Hören/Schreiben/Sprechen — note where an exam omits one, e.g. LiD has no separate Sprechen), a simple format table (duration, number of tasks, pass threshold if known), and a CTA linking to `/uebungen` for practice (since interactive per-exam practice doesn't exist yet — that's Tier 2).
> 3. Add a "Prüfungen" link to the main nav in `index.astro`, next to the existing "Übungen" link.
> 4. For every factual claim (level, format, duration, task count), pull from real source material in the Deutsch v3 folder where it exists (DTZ and Leben in Deutschland should have real sourced detail). For Goethe and TestDaF, where no source file exists, use only well-established public exam-format facts and mark the page with a code comment `<!-- GENERIC FORMAT INFO: no deutschacademy source material for this exam yet -->` at the top of the format section — do not invent specifics.
> 5. Do not build any interactive quizzes, flashcards, or timers in this tier — that's Tier 2.

**Definition of Done:**
- `/pruefungen` hub renders and links to all five exam pages; all five pages render without build errors.
- Nav updated.
- A `docs/exams-hub-tier1-v1.md` note written (same format as `self-study-tools-v1.md`): what was built, which pages have real sourced content vs. generic placeholder content, and an explicit line restating the DTZ-inclusion scope reversal.
- Verify with `pnpm dev` (or `astro dev --background` per `CLAUDE.md`) before calling it done — check all five routes load.

---

## Tier 2 — Wire in existing interactive practice

**Prompt:**

> Building on Tier 1's `/pruefungen` pages: add a "Practice for this exam" section to each of the five exam detail pages, linking to the relevant existing tools under `/uebungen` (`artikel-trainer`, `grammatik`, `wortschatz`, `sprechen`, `lesen-schreiben`). Since those tools were built from DTZ B1-level material, they map most directly to the DTZ and Leben in Deutschland pages — link all five tools there. For telc, Goethe, and TestDaF pages, link only the tools whose content genuinely overlaps (grammar and vocabulary are level-general; the `sprechen` Bildbeschreibung prompts and the `lesen-schreiben` DTZ-specific simulation should NOT be presented as telc/Goethe/TestDaF-authentic — either omit them for those three exams or relabel them clearly as "general German practice," not exam-specific practice.
> Do not duplicate or fork the existing tool pages — link to the single existing `/uebungen/*` pages from each exam page (multiple entry points, one implementation).

**Definition of Done:**
- Each of the five exam pages has a practice section with correctly-scoped links (no exam gets a tool falsely presented as exam-authentic).
- `docs/exams-hub-tier2-v1.md` note: which tools got linked to which exams and why, flagging the DTZ/LiD vs. telc/Goethe/TestDaF distinction explicitly.

---

## Tier 3 — Exam-specific mock tests

**Prompt:**

> Building on Tiers 1–2: build real per-exam mock-test content, reusing `src/lib/quiz.js` and the JSON-data pattern from `src/data/`. Priority order (richest source material first): DTZ (the existing `DTZ_Simulation_Leseverstehen_v2.pdf`-based simulation logic can likely be adapted/reused directly), Leben in Deutschland (33-question citizenship-test-style format, sourced from the LiD material in the Deutsch v3 folder), then telc/Goethe/TestDaF only if/where real source material exists in that folder — do not fabricate exam-authentic question content for exams with no source file; instead leave a clearly-marked "coming soon" state on that exam's page rather than a fake mock test.
> Each mock test should be self-scoring like the existing DTZ Leseverstehen simulation, with a results summary at the end.

**Definition of Done:**
- At minimum, DTZ and Leben in Deutschland have working, sourced mock tests.
- Any exam without real source material shows an honest "coming soon" state, not fabricated content.
- `docs/exams-hub-tier3-v1.md` note with the same per-claim sourcing discipline as `self-study-tools-v1.md` (trace every question to its source file).

---

## Tier 4 — Hub polish, comparison view, conversion

**Prompt:**

> Building on Tiers 1–3: add a second navigation path to the `/pruefungen` hub — a CEFR-level picker (A1–C1) alongside the existing exam-picker cards, similar to deutsch-vorbereitung.com's dual entry point. Add a simple comparison table on the hub page (exam, levels covered, who it's typically for, format at a glance). Tie the hub's CTAs into the existing Pricing section content from `value-stack-v1` (Free vs. Premium Membership) rather than inventing new pricing claims. Add basic per-page SEO (meta title/description per exam, matching how other pages in this project already handle it — check `src/layouts/` for the existing pattern before adding anything new).

**Definition of Done:**
- Level-based and exam-based navigation both work from the hub.
- Comparison table renders with sourced-or-flagged data only.
- No new pricing figures invented — CTA copy matches whatever `value-stack-v1`'s Pricing section currently says (including the still-open `€XX/month (TBD)` if it hasn't been resolved yet — don't silently pick a number).
- `docs/exams-hub-tier4-v1.md` note.

---

## Open decisions this prompt does NOT resolve (flag to Edgar, don't guess)

- Whether telc/Goethe/TestDaF pages ship in Tier 1 with only generic public-knowledge format info, or wait until real source material for those exams exists.
- Premium Membership pricing (`€XX/month (TBD)`) — still open per `value-stack-v1.md`, carried forward here.
- Whether DTZ re-inclusion (reversing the earlier `value-stack-v1` scoping call) should also be reflected back into the homepage Pricing/Deep-Dive copy, or left as hub-only for now.

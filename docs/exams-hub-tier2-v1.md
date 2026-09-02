# Exams Hub — Tier 2 (wire in existing interactive practice) — v1, 2026-09-02

## What was built

- New shared component `src/components/ExamPractice.astro`: renders a "practice for this
  exam" section from a fixed catalog of the five existing `/uebungen` tools, given a
  `tools` prop (which ones to show) and a `heading`/`intro` (why those specific ones).
  Reuses the existing `.tool-grid`/`.tool-card` styles from `practice.css`, plus a small
  new `.exam-practice` wrapper style in `pruefungen.css`.
- Replaced the single generic `/uebungen` CTA button on all five `/pruefungen/*` detail
  pages with `<ExamPractice>`, scoped per exam (see table below).
- No duplication: every exam page links to the same five `/uebungen/*` pages built in the
  earlier practice-hub work — nothing was forked or copied.

## Per-exam link scoping

| Exam | Tools linked | Why |
|---|---|---|
| **DTZ** | All five: artikel-trainer, grammatik, wortschatz, sprechen, lesen-schreiben | All five tools are genuinely built from DTZ material (see `src/data/lesen.json`, `sprechen.json` — already DTZ-labeled). Presented as authentic exam practice, correctly. |
| **telc** | artikel-trainer, grammatik, wortschatz only | These three are level/exam-general (article gender, grammar patterns, vocabulary) — real practice value regardless of which exam. `sprechen` (DTZ Bildbeschreibung prompts) and `lesen-schreiben` (DTZ reading/writing simulation) are omitted, not relabeled: they test DTZ-specific task formats (paired oral Bildbeschreibung, DTZ-style reading tasks) that don't resemble telc's own task types, so presenting them as telc practice — even "generally" — would be misleading. |
| **Goethe** | artikel-trainer, grammatik, wortschatz only | Same reasoning as telc. |
| **TestDaF** | artikel-trainer, grammatik, wortschatz only | Same reasoning as telc. |
| **Leben in Deutschland** | artikel-trainer, grammatik, wortschatz only | **Deviates from the tiered prompt's literal instruction** ("map most directly to the DTZ and Leben in Deutschland pages — link all five tools there"). The LiD page itself (built in Tier 1) states LiD has no separate Sprechen and no Schreiben component — it's multiple-choice only. Linking the DTZ `sprechen` (mündliche Bildbeschreibung) and `lesen-schreiben` (Schreibaufgaben) tools would contradict that page's own content and misrepresent LiD's format. Applied the same non-fabrication discipline used for telc/Goethe/TestDaF instead of the prompt's literal instruction. Flagging this explicitly rather than silently resolving it, per the tiered prompt's own stated preference. |

## Discrepancy from the tiered prompt (flagging, not silently resolving)

The Tier 2 prompt text says DTZ and LiD should each get all five tools linked "since those
tools were built from DTZ B1-level material." That's true for DTZ but doesn't hold for LiD:
LiD is a civics/knowledge test with no oral or written-production component, so the DTZ
speaking/writing tools have no format match there, unlike for DTZ itself. Gave LiD the same
three general tools as telc/Goethe/TestDaF instead, with an on-page note explaining why
`sprechen`/`lesen-schreiben` aren't linked there. If a different call is preferred here
(e.g. link them anyway since the content is still "German practice"), that's a one-line
change to the `tools` array in `src/pages/pruefungen/leben-in-deutschland.astro`.

## Verification

- `npx astro build` — all 14 routes build with no errors, including all five
  `/pruefungen/*` detail pages and `/pruefungen` itself.
- Checked the built HTML output (`dist/pruefungen/*/index.html`) directly to confirm each
  page's practice section links exactly the intended `/uebungen/*` tool set (grep'd for
  `href="/uebungen...` per page — see this session's terminal output).
- Chrome browser extension was not connected in this session, so the pages were not
  visually verified in a live browser — build success and HTML-output inspection stood in
  for that. Worth a manual look before shipping.

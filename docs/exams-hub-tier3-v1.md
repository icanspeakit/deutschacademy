# Exams Hub — Tier 3 (exam-specific mock tests) — v1, 2026-09-02

## What was built

- `src/pages/pruefungen/dtz/mock-test.astro` — a real, sourced DTZ Lesen mock test:
  the four `"DTZ-Simulation, Aufgabe N"` reading tasks in `src/data/lesen.json`
  (`anzeigen`, `zeitungsartikel`, `forumsbeitraege`, `interview` — 18 questions total),
  run as one continuous flow instead of four separate per-topic quiz cards. Each task
  shows its reading text, then a self-scored multiple-choice quiz (reusing
  `mountQuiz` from `src/lib/quiz.js`, `mode: "choice"`), then advances to the next task;
  the last task's "Weiter" click shows one combined results summary (total score, %,
  and a per-task breakdown table), with a restart button and a link onward to the
  existing `/uebungen/lesen-schreiben` for the form/writing tasks.
- `/pruefungen/dtz` now has a "Mock-Test: Lesen (Aufgabe 1–4)" CTA linking to it, above
  the Tier 2 practice-tools section.
- `/pruefungen/telc`, `/goethe`, `/testdaf`, `/leben-in-deutschland` each got an honest
  "Mock-Test: bald verfügbar" box instead — states plainly that no source material exists
  for a real mock test on that exam, with no button/link (nothing to click through to),
  rather than a fabricated question set.

## Sourcing — every question traced

| Task | Source | Questions |
|---|---|---|
| Aufgabe 1: Anzeigen und Aussagen zuordnen | `src/data/lesen.json` → `groups[1]` (`id: "anzeigen"`) | 5 |
| Aufgabe 2: Zeitungsartikel — richtig/falsch | `src/data/lesen.json` → `groups[2]` (`id: "zeitungsartikel"`) | 5 |
| Aufgabe 3: Forumsbeiträge — wer sagt das? | `src/data/lesen.json` → `groups[3]` (`id: "forumsbeitraege"`) | 4 |
| Aufgabe 4: Interview | `src/data/lesen.json` → `groups[4]` (`id: "interview"`) | 4 |

All four are already labeled `"DTZ-Simulation, Aufgabe N"` inside `lesen.json` itself —
nothing was invented for the mock test; it's the same data `/uebungen/lesen-schreiben`
already uses, re-sequenced into one continuous scored run instead of four independent
quiz cards.

**Deliberately left out of the mock test**, and why:
- `groups[0]` (`id: "digitales-buero"`, "Kurztext: Das digitale Büro") — this entry has no
  `"DTZ-Simulation, Aufgabe N"` label in the source data; it reads as a separate practice
  text, not part of the numbered simulation. Including it would misrepresent the mock
  test's exam-fidelity claim.
- `formTask` (Aufgabe 5, form-filling), `writingPrompt`, `errorHunt` — these are
  reveal-on-click / free-text formats, not multiple-choice, so they don't fit the
  self-scoring quiz engine used here. They stay at `/uebungen/lesen-schreiben` in their
  existing format; the mock test links onward to that page at the end rather than
  duplicating or reimplementing them as fake multiple-choice.

**telc / Goethe / TestDaF / Leben in Deutschland**: confirmed again (same finding as
Tier 1) that no dedicated source material exists in this repo for any of these four —
no citizenship-test question bank, no telc/Goethe/TestDaF sample papers. Building a mock
test for any of them would mean inventing exam-authentic-looking questions with no real
backing, which the tiered prompt explicitly rules out. Each shows a plain "coming soon"
statement instead.

## Verification

- `npx astro build` — 15 routes build with no errors, including the new
  `/pruefungen/dtz/mock-test` route.
- Chrome extension unavailable in this session (not connected), so the flow wasn't
  clicked through in a live browser. Instead: extracted and `node --check`'d the
  compiled mock-test client bundle from `dist/` to confirm valid JS syntax, and traced
  the click-handler logic by hand against `src/lib/quiz.js`'s `onDone` contract — the
  "next task" button calls `renderTask()` for tasks 1–3 and `renderSummary()` after task
  4, and the summary's totals are computed from the four per-task `{score, total}`
  results pushed by each `onDone`. Recommend a manual click-through before shipping,
  since this wasn't visually confirmed.

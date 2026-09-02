# DeutschAcademy self-study tools v1 (2026-08-28)

Built to compete with generic self-learning apps (Duolingo/Babbel/Anki-style) by turning real Deutsch v3 classroom material into working interactive tools on the site, not just marketing copy. All new files live under `C:\Users\Edgar\Projects\deutschacademy\src\`, no framework beyond plain Astro + vanilla JS (matches the existing stack — no React/Vue installed).

## What was built

- **`/uebungen`** — hub page linking all five tools.
- **`/uebungen/artikel-trainer`** — der/die/das drill, 31 nouns, type-the-article quiz.
- **`/uebungen/grammatik`** — topic-switcher quiz: Akkusativ, Dativ, Passiv mit Modalverben, Konjunktiv II, Relativpronomen, trennbare Verben (~28 questions total).
- **`/uebungen/wortschatz`** — flip-card deck: Redemittel (conversation phrases) + thematic vocab (Haustiere/pets, trip planning).
- **`/uebungen/sprechen`** — 4 real DTZ B1 Sprechen-Teil-2 Bildbeschreibung prompts, with a 90-second timer matching the actual exam format.
- **`/uebungen/lesen-schreiben`** — a full DTZ Leseverstehen simulation (5 task types, real answer key) + a short reading text, plus two writing exercises.

Shared engine: `src/lib/quiz.js` (text-input or multiple-choice, self-scoring) and `src/lib/flashcards.js` (flip/shuffle deck), both data-driven from JSON in `src/data/`. Styling in `src/styles/practice.css` reuses the site's existing brand tokens (`--brand-blue`, `--gradient-brand`, etc.) from `global.css`.

Nav: added an "Übungen" link to the main site nav in `index.astro`.

## Sourcing — every question/card traces back to a real file

- **Artikel (der/die/das) list** — nouns pulled from `artikel_uebersicht_a1.pdf` and confirmed-gender nouns appearing across `Akkusativ.docx`, `Dativ etc.docx`, `Stadtplan.docx`, `Redemittel.docx`, `trennbare Verben.docx`.
- **Grammar quiz questions** — each is a real example sentence (or a direct adaptation of one) from the teacher's own worked examples in `Akkusativ.docx`, `Dativ etc.docx`, `Passiv mit Modalverben.docx`, `Konjunktiv2_Teil2.docx`, `Relativpronomen etc.docx`, `trennbare Verben.docx`. The "correct answer" for each is literally what's already written in the source doc — not invented.
- **Redemittel/vocab flashcards** — from `Redemittel.docx` (the "Meinung äußern" / "Zustimmen" phrases) and the pets Vor-/Nachteile section in the same file, plus the conversational-starter lines at the top of `Akkusativ.docx`.
- **Speaking prompts** — verbatim from `Bildbeschreibung.docx` (real DTZ B1 Prüferfragen for 4 picture-description scenarios). No actual photos exist in the source file — these are text prompts only, flagged as such.
- **Reading simulation** — verbatim from `DTZ_Simulation_Leseverstehen_v2.pdf` (full 18-question, 5-task-type simulation with the teacher's own answer key) and `dtz_uebung_leseverstehen (1).pdf` (shorter 3-question set, also with its own key).
- **Writing exercises** — the email-reply prompt is verbatim from `DTZ_Schreiben_Fussballweltmeisterschaft.pdf` (open-ended, no scoring needed). The "Modelltext mit Fehlern" proofreading text is from `DTZ_Schreiben_AufgabeB_Modelltext.docx`.

## Deliberately NOT auto-graded

- The **Fehlersuche (error-hunt) text** — the source says "ein Fehler pro Zeile – finden Sie ihn?" but includes no answer key, and the original per-line structure wasn't fully recoverable from the extracted text. Rather than guess which word is "the" error per line and risk teaching wrong grammar, I left it as a read-and-discuss exercise (framed as "discuss with a teacher/partner"), not a scored quiz.
- The **Fußballweltmeisterschaft cloze/gap-fill task** (Aufgabe A, word-formation with Partizipien) was skipped entirely — no answer key in the source, and several blanks are genuinely ambiguous between Partizip I/II without one. Only Aufgabe B (the open-ended writing prompt) from that file was used.

## Not yet built / natural next steps

- No audio (pronunciation practice, listening comprehension) — the folder doesn't contain audio files.
- Grammar quiz only covers 6 of the 60+ topics in the folder — the pattern (JSON + shared quiz engine) makes adding more topics straightforward, just needs someone to pull the example sentences from each remaining doc the same way.
- No progress tracking / accounts yet — these are stateless, anonymous, one-session-at-a-time tools. Persisting scores would need the "full platform" work mentioned as the long-term goal.
- Build/dev-server verification: same limitation as the value-stack pass — the Linux-mounted `node_modules` here doesn't resolve (pnpm/Windows artifact, unrelated to these changes), so I verified via JSON validation, `node --check` on every script block, and HTML tag-balance checks rather than a real `astro build`. Worth running `pnpm dev` on your end before this ships.

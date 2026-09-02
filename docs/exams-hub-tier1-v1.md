# Exams Hub — Tier 1 (MVP info hub) — v1, 2026-09-02

## What was built

- `src/pages/pruefungen/index.astro` — hub page, five exam cards (telc, Goethe, TestDaF, DTZ, Leben in
  Deutschland), each with icon, one-line description, CEFR/level badge, link to its detail page.
- Five detail pages under `src/pages/pruefungen/`: `telc.astro`, `goethe.astro`, `testdaf.astro`,
  `dtz.astro`, `leben-in-deutschland.astro`. Each has: who it's for / why it matters, a skill-section
  grid (Lesen/Hören/Schreiben/Sprechen, with omitted skills visually greyed out and labeled), a format
  table, and a CTA linking to `/uebungen`.
- New stylesheet `src/styles/pruefungen.css`, reusing brand tokens from `global.css` and the hub-card
  visual language already established in `practice.css`.
- Nav: added a "Prüfungen" link next to "Übungen" in `src/pages/index.astro`.
- No interactive quizzes/flashcards/timers were built — that's Tier 2/3 per the tiered plan.

## DTZ-inclusion scope reversal (explicit, per instructions)

An earlier pass (`value-stack-v1`) reportedly scoped deutschacademy to Goethe/TestDaF/telc only and
excluded DTZ. **That scoping is reversed as of this tier**: the exams hub covers all five — telc,
Goethe, TestDaF, DTZ, Leben in Deutschland. This reversal is recorded here so it isn't silently lost.
Note: I could not locate the actual `value-stack-v1.md` file in this repo (see "Discrepancies" below) —
this reversal is recorded per the instruction in the tiered prompt, not verified against that file's
original text.

## Per-page sourcing

| Page | Sourced from project content | Generic public-knowledge info |
|---|---|---|
| **DTZ** | Format table rows (Anzeigen-Zuordnung, Richtig/Falsch, Forum/Interview, Formular, Schreiben, Bildbeschreibung with 90s+90s timer) — all pulled from `src/data/lesen.json` and `src/data/sprechen.json`, which already power `/uebungen/lesen-schreiben` and `/uebungen/sprechen` | Purpose (Integrationskurs completion), A2/B1 result split |
| **Leben in Deutschland** | None — see discrepancy below | Everything: 33 questions (30 federal + 3 state-specific) from a 300-question pool, 60-minute limit, pass at 15/33, purpose (naturalization/Orientierungskurs) |
| **telc** | None | Level range (A1–C2), modular system, four skills tested, written+oral split |
| **Goethe** | None | Level range (A1–C2), one certificate per level, four skills tested, Start Deutsch 1 note for family-reunification visas |
| **TestDaF** | None | TDN 3–5 scoring model (not a single pass %), four skills, approximate section timings |

Every detail page's format section for telc, Goethe, TestDaF, **and Leben in Deutschland** carries the
`<!-- GENERIC FORMAT INFO: no deutschacademy source material for this exam yet -->` HTML comment marker.

## Discrepancies from the tiered prompt (flagging, not silently resolving)

1. **No `docs/` folder existed in this repo before this tier**, and I could not find
   `self-study-tools-v1.md` or `value-stack-v1.md` anywhere in the working tree. The tiered prompt
   assumes both exist as format templates — they don't, at least not in this repo/branch. This doc was
   written to the same sourcing-discipline standard described in the prompt (every claim traced or
   flagged), but its structure isn't copied from an existing file.
2. **No "Deutsch v3" teaching folder exists in this repo** (no `DTZ_Simulation_Leseverstehen_v2.pdf`,
   `gast_DTZ_Uebungssatz`, `Bildbeschreibung.docx`, or any Leben-in-Deutschland source file). The real
   source material for DTZ is the JSON already checked into `src/data/` (`lesen.json`, `sprechen.json`),
   which is explicitly DTZ-labeled internally.
3. **Leben in Deutschland has no dedicated source material in this repo**, contrary to the tiered
   prompt's assumption that it would have "real sourced detail" like DTZ. There is no Einbürgerungstest/
   citizenship-test content anywhere in `src/data/`. I treated the LiD page the same way as Goethe/
   TestDaF — generic, well-established public format facts only, clearly flagged — rather than invent a
   sourcing story that isn't backed by anything in the project.

## Verification

Ran `astro dev --background` and loaded all six routes (`/pruefungen`, `/pruefungen/telc`,
`/pruefungen/goethe`, `/pruefungen/testdaf`, `/pruefungen/dtz`, `/pruefungen/leben-in-deutschland`) plus
`/` to confirm the new nav link — see terminal/build output in this session for the pass/fail result.

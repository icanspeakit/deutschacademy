# Exams Hub — Tier 4 (hub polish, comparison view, conversion) — v1, 2026-09-02

## What was built

- **Dual navigation on `/pruefungen`**: a "Nach Prüfung" / "Nach Niveau" tab toggle
  (reusing the existing `.topic-tabs`/`.topic-tab` pattern from `practice.css`, same
  as `/uebungen/grammatik`). "Nach Prüfung" shows the original five exam cards;
  "Nach Niveau" shows a new CEFR level grid (A1–C2) where each level lists the exams
  that offer it, as direct links to that exam's detail page. Plain `hidden` attribute
  toggle in a small inline script — no framework needed.
- **Comparison table** on the hub page: exam / levels / who it's for / format at a
  glance, for all five exams.
- **Pricing tie-in**: a Free-vs-Premium box at the bottom of the hub reusing the exact
  line items and the still-open `€XX / Monat (TBD)` figure from the homepage's Pricing
  section (`src/pages/index.astro`), linking to `/#pricing` for the full picture — no
  new price was invented.
- **Basic per-page SEO**: `src/layouts/Layout.astro` gained a `description` prop
  (there was no existing per-page meta-description pattern in this project to match —
  `Layout.astro` only had `title` before this tier, so this establishes the pattern
  rather than following one). Added a distinct `<meta name="description">` to all five
  exam detail pages, the `/pruefungen` hub, and the Tier 3 mock-test page.

## Level-picker scope: deviates from the prompt's literal "A1–C1"

The Tier 4 prompt text says "a CEFR-level picker (A1–C1)". Built A1–**C2** instead: the
telc and Goethe-Zertifikat detail pages (Tier 1) both already state their own level
range as A1–C2, so a picker capped at C1 would silently drop real, already-published
coverage for two of the five exams and contradict their own pages. Flagging this
explicitly (same discipline as the Tier 2 Leben-in-Deutschland deviation) rather than
resolving it silently.

Leben in Deutschland is intentionally absent from every level row — it has no CEFR
level (a civics/knowledge test, not a language test), per its own Tier 1 page. A note
under the level grid says so explicitly and links to its detail page directly, so it's
still reachable from the level view, just not filed under a level it doesn't have.

## Comparison table sourcing

Every cell restates a claim already made — and already sourced-or-flagged — on that
exam's own Tier 1 detail page. Nothing new is asserted:

| Exam | Levels | For whom | Format |
|---|---|---|---|
| telc | A1–C2 (telc.astro) | Job, Aufenthaltstitel, teils Hochschulzulassung (telc.astro) | Schriftlich + mündlich, modular (telc.astro) |
| Goethe-Zertifikat | A1–C2 (goethe.astro) | Visa/Studium/Beruf/Einbürgerung (goethe.astro) | Ein Termin + separate mündliche Prüfung (goethe.astro) |
| TestDaF | TDN 3–5 ≈ B2–C1 (testdaf.astro) | Internationale Studieninteressierte (testdaf.astro) | Eine Prüfung, TDN je Fertigkeit (testdaf.astro) |
| DTZ | A2/B1 (dtz.astro) | Integrationskurs-Abschluss, Aufenthaltstitel (dtz.astro) | 4 Fertigkeiten, Ergebnis A2/B1 (dtz.astro) |
| Leben in Deutschland | Kein Sprachniveau (leben-in-deutschland.astro) | Einbürgerung (leben-in-deutschland.astro) | 33 Fragen, 60 Min. (leben-in-deutschland.astro) |

## Pricing tie-in sourcing

Line items copied verbatim (translated framing kept identical) from the live
`src/pages/index.astro` Pricing section: Free plan's "Full A1–C1 core course" and
"60+ grammar topic breakdowns"; Premium's "Exam-format mock sittings (Goethe & telc)",
"Human corrections on every writing task", "Speaking & role-play practice sessions".
The `€XX / month (TBD)` placeholder and its `<!-- TODO(Edgar) -->` marker in
`index.astro` were left untouched — this tier does not resolve that open pricing
decision, matching the Tier 4 prompt's explicit instruction not to invent a number.

## Verification

- `npx astro build` — 15 routes build with no errors, including the updated
  `/pruefungen` hub.
- Grepped the built HTML to confirm: both `#view-exam` (visible) and `#view-level`
  (`hidden`) panels render with correct `data-view` targets on the two tab buttons;
  all six level cards (A1–C2) render; the comparison table renders with all five
  exams; the pricing tie-in shows `€XX / Monat (TBD)` unchanged; `<meta
  name="description">` renders correctly on the hub and all detail pages.
- Extracted the hub's inlined toggle script from the built HTML and read the minified
  logic by hand to confirm the click handler toggles `.active` on the correct tab and
  sets `hidden` on the correct panel.
- Chrome extension was not connected in this session, so the tab toggle wasn't
  clicked through live — recommend a manual check before shipping, consistent with
  the same caveat noted in Tiers 2 and 3.

## Tiered plan status

All four tiers from `EXAMS-HUB-TIERED-PROMPT.md` are now built: Tier 1 (info hub),
Tier 2 (practice-tool links), Tier 3 (DTZ mock test + honest "coming soon" for the
rest), Tier 4 (dual nav, comparison table, pricing tie-in, SEO). Open items carried
forward, unresolved by design (see the tiered prompt's own "Open decisions" section):
Premium Membership pricing, and whether telc/Goethe/TestDaF should get generic-only
Tier 1 content indefinitely or wait for real source material before expanding further.

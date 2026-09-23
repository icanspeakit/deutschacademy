# DeutschAcademy — Fortschritt als Karte — Build Prompt (v1, 2026-09-23)

## How to use this file

Paste **one tier at a time** into Claude Code running in this repo
(`C:\Users\Edgar\Projects\deutschacademy`), review, then continue. Tier 2 assumes Tier 1 exists.
Each tier ends with a Definition of Done and a note in `docs/` (same pattern as
`self-study-tools-v1.md`): what was built, what is real vs. placeholder, and every decision
taken rather than assumed.

## Decision (from the `/uxfocus` study)

`/uxfocus` compared six ways of handling the topic view on `/fortschritt`, where the same
exercises can be done inline **or** opened via „Eigene Seite öffnen ↗". Chosen:
**Variante 5 (Karte → Seite) + 3 (Hero schrumpft) + 4 (nur Teilen)**.

- `/fortschritt` becomes the **map**: overview, progress, what's next. No exercises inline.
- The topic page is the **one place to learn**, with course context (breadcrumb, Thema x von y, ‹ ›).
- **Explicitly not doing**: Fokus-Toggle (1) and Auto-Fokus (2). No layout that moves on its own
  while the learner taps, no extra UI modes.

Reason: one piece of content should have one home. Learners (DTZ, A1, mostly mobile) never have
to choose where to learn, every topic has one shareable URL, and there is the least state to maintain.

## Context (read before either tier)

- **Stack**: Astro + vanilla JS, one runtime dependency (`astro`). Keep it that way.
  Tokens in `src/styles/global.css`, practice styling in `src/styles/practice.css`.
- **Page transitions are cross-document** (`@view-transition`), not `<ClientRouter />`.
  Page scripts mount from `<script type="module">`. Do not introduce `<ClientRouter />`.
- `/fortschritt` = `src/pages/fortschritt.astro`, which renders
  `<LearnShell variants={["b"]} />` (`src/components/LearnShell.astro`, ~2,070 lines).
  LearnShell owns `?stufe=` / `?thema=`; fortschritt.astro owns only `?ansicht=`.
- The duplicate entry point lives in LearnShell: the item view mounts the grammar workspace
  inline, shows the badge „läuft in dieser Ansicht" (≈ l. 1081 and l. 1710) and the button
  „Eigene Seite öffnen ↗" with `target="_blank"` (≈ l. 1026).
- The topic page is `src/pages/uebungen/grammatik/[id].astro`. Mounting contract:
  `mountGrammarWorkspace(pageRoot, data)` (`src/lib/grammarWorkspace.js`) finds slots with
  `[data-ex-index]` inside `#vp-page`. Any restructure is safe as long as the slots stay inside `#vp-page`.
- Non-grammar entries (Artikel-Trainer, Wortschatz cards, Aussprache, DTZ, …) already have their own
  `href`. They follow the same rule: the map links to them, it does not embed them.
- `ShareButton.astro` exists (native share sheet on mobile, „Link kopiert" with a mouse).
- Progress is in localStorage, written by the trainers and read by LearnShell. **Do not rename or
  migrate any storage keys.**
- `/uxfocus` (`src/pages/uxfocus.astro`) is the clickable reference for the target look.
  Leave it untouched.

---

## Tier 1 — Fortschritt becomes the map, the topic page gets course context

**Prompt:**

> Implement "Karte → Seite" as decided in `FORTSCHRITT-KARTE-PROMPT.md` (read the Context
> section first). Use `/uxfocus?v=karte` as the visual reference.
>
> **A. `/fortschritt` (LearnShell item view)**
> 1. Remove the inline exercise mount from the item view, along with the „läuft in dieser Ansicht"
>    badge and the „Eigene Seite öffnen ↗" button. Delete the now-dead code paths; don't just hide them.
>    Keep the Stufe overview, rings, level bar and course strip exactly as they are.
> 2. The item view shows the topic card (title, level, lead, Aufgaben/Minuten, progress ring from
>    localStorage) with one primary action: **„Übungen starten →"** (or „Weiter üben →" once
>    progress > 0), a plain same-tab link to the entry's `href`. Clicking a topic in the left list
>    selects it on the map. It does not navigate.
> 3. Existing deep links (`/fortschritt?stufe=a1&thema=artikel`) must keep working and select
>    that topic on the map. No auto-redirect.
>
> **B. Course context on the topic page (`/uebungen/grammatik/[id]`)**
> 4. Add a slim bar above the hero: `← Dein Kurs A1` (links to
>    `/fortschritt?stufe=a1&thema=<id>`, so back lands on the same topic), `Thema 2 von 9`,
>    ‹ › for previous/next topic in that Stufe, and a `ShareButton` for the canonical URL.
>    On a phone at 390 px it must fit on one line. Shorten the label before letting it wrap.
> 5. The Stufe and the topic order must come from the **same source** LearnShell uses for its left
>    list. Extract that ordering into a small module in `src/lib/` and import it in both places.
>    Do not duplicate the list. Topics without a Stufe (or the first/last one) simply hide the
>    missing arrow.
> 6. Where Übungen pages other than grammar are reached from the map (trainer, cards, audio),
>    add the same `← Dein Kurs` back link if it is cheap. Otherwise list them in the docs note as
>    follow-up. Don't redesign those pages here.
>
> **Constraints:** no new dependencies, no `<ClientRouter />`, no storage-key changes,
> exercise slots stay inside `#vp-page`, `/uxfocus` untouched.
>
> **Definition of Done**
> - No exercise is mounted anywhere on `/fortschritt`. `grep` finds no „Eigene Seite öffnen"
>   and no `läuft in dieser Ansicht` outside `uxfocus.astro`.
> - Map → „Übungen starten" → answer 3 items → „← Dein Kurs A1" returns to the map with that
>   topic selected and its ring updated.
> - ‹ › walk through all topics of A1 in the same order as the map's left list.
> - Old `?stufe=&thema=` links still select the right topic.
> - `pnpm build` passes, no console errors at 390 px or desktop.
> - Note written to `docs/fortschritt-karte-tier1-v1.md`.

---

## Tier 2 — Hero shrinks + measure it

**Prompt:**

> Tier 1 of `FORTSCHRITT-KARTE-PROMPT.md` is in. Now apply "Hero schrumpft" on the grammar
> topic page (reference: `/uxfocus?v=hero`).
>
> 1. After the learner's **first answer** on the page, the hero card collapses to one line:
>    progress ring · topic title · `x/y` counter. Use a short, calm height transition (≤ 200 ms)
>    and respect `prefers-reduced-motion` (no animation). Nothing else moves: the header, course
>    bar and topic list stay put.
> 2. If localStorage already shows progress for this topic, render the compact hero from the start
>    (server markup plus a pre-paint class, so it doesn't flash large and then shrink).
> 3. The rule card / lead text that was in the hero stays reachable (e.g. a „Regel anzeigen" toggle
>    on the compact line). It collapses, it is not removed.
> 4. Measure: add a small Playwright script under `scripts/` (follow the style of the existing
>    `scripts/shoot-mobile.mjs`) that loads 3 representative topics at 390×844 and at 1920×1040 and records the
>    y-offset of the first `[data-ex-index]` slot. Do this before the change (fresh learner) and
>    after it (learner with progress). Put the numbers in the docs note.
>
> **Definition of Done**
> - At 390 px with progress, the first exercise starts inside the first screen on all 3 topics.
> - No layout shift while the learner is mid-answer other than the single collapse.
> - Reduced-motion users get no animation.
> - `pnpm build` passes. Note with before/after table written to `docs/fortschritt-karte-tier2-v1.md`.

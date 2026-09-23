# DeutschAcademy — Nav-CTA „Kostenlos üben" ersetzen — Build Prompt (v1, 2026-09-23)

## How to use this file

Paste the prompt below into Claude Code running in this repo
(`C:\Users\Edgar\Projects\deutschacademy`) and review. It ends with a Definition of Done and a
note in `docs/`, same pattern as the other prompt files.

## Decision

The primary button in the nav („Kostenlos üben" → `/uebungen`) does nothing the menu above it
can't. It sits under six practice links and usually points to where the learner already is.
„Kostenlos" is a landing-page sales line, not a next step.

It becomes a **state-aware next step**. It always shows exactly one action, picked from what this
browser already knows:

| State (checked in this order) | Label | Target |
| --- | --- | --- |
| A · Has practised (`getResume()` returns a `last`) | **Weiter üben** + small second line with the topic title („Verben im Präsens") | `last.path` |
| B · Took the placement test, hasn't practised yet (`localStorage["da-einstufung"]`, e.g. `A2`) | **Mit A2 starten** | `/uebungen/grammatik#niveau-a2` (same target the test's result screen uses) |
| C · Nothing known (new visitor, storage blocked, no JS) | **Wo stehe ich?** + second line „Einstufungstest" | `/einstufungstest` |

## Prompt

> Replace the nav CTA „Kostenlos üben" with a state-aware next-step button, as decided in
> `NAV-CTA-PROMPT.md` (read the table there first).
>
> **Where it lives today**
> - Mobile drawer: `src/components/NavDrawer.astro` ≈ l. 350,
>   `<a href="/uebungen" class="lp-btn lp-btn--primary lp-drawer-cta" data-i18n="nav.cta">`.
> - Desktop header: `src/components/SiteNav.astro` ≈ l. 46, same link, same `nav.cta` key.
> - Strings: `public/i18n/{de,en,tr,uk,ar}.json`, applied by `src/lib/i18n.js`, which sets
>   `textContent` of every `[data-i18n]` element on load and on language change.
>
> **Build**
> 1. Put the state logic in one small module (e.g. `src/lib/nextStep.js`) that exports
>    `getNextStep()` → `{ state: "resume" | "level" | "placement", labelKey, subKey?, vars, href }`.
>    Use `getResume()` from `src/lib/progress.js` for state A and `da-einstufung` for state B
>    (that key is written by `src/pages/einstufungstest.astro` ≈ l. 214). Wrap every storage read
>    in try/catch. Any failure means state C. Do not add new storage keys and do not change
>    existing ones.
> 2. Both NavDrawer and SiteNav render **state C server-side** (correct with no JS or no storage),
>    then a script upgrades to A or B. Set the new `data-i18n` key / `data-i18n-vars` on the element
>    **before** calling the i18n apply step, or re-run it, so a language switch doesn't reset the
>    label to the old string. In SiteNav, reserve the button width so the upgrade doesn't shift
>    the header.
> 3. **Never link to the page you're on.** If `last.path` equals the current path, use the next
>    entry in `recents`. If there is none, fall back to B/C. On `/einstufungstest` itself, state C
>    shows „Zu den Übungen" → `/uebungen` instead.
> 4. Two-line layout for A and C: bold main label with a smaller, muted second line in the same
>    button, truncating with an ellipsis (topic titles can be long). On the desktop header, show
>    only the main label and put the second line in `title`/`aria-label`. The accessible name must
>    include the topic for A („Weiter üben: Verben im Präsens").
> 5. Small extra in the drawer: if `da-einstufung` is set, visually mark the matching chip in the
>    NIVEAU row (A1/A2/B1/B2) as „dein Niveau" (e.g. a dot plus `aria-current="true"`). Nothing else
>    in the drawer changes.
> 6. i18n: add keys `nav.next.resume`, `nav.next.level` (with `{level}`), `nav.next.placement`,
>    `nav.next.placementSub`, `nav.next.toExercises` to **all five** locale files (translate
>    properly, not German copies). Leave `nav.cta` in place, because `layout/index.astro`, `m1`,
>    `mobile2` and `pivotProtos.js` still use the words. Run `scripts/validate-i18n.mjs`.
> 7. **Out of scope**: the hero/landing buttons that say „Kostenlos üben" in page bodies
>    (`layout/index.astro`, `pruefungen/index.astro`, prototypes). Only the two nav CTAs change.
>
> **Constraints**: no new dependencies, no `<ClientRouter />`, no new storage keys, keep the
> existing `lp-btn lp-btn--primary` styling. The button stays the drawer's only primary action.
>
> **Definition of Done**
> - Fresh profile (clear storage): drawer and header show „Wo stehe ich? · Einstufungstest" →
>   `/einstufungstest`.
> - Finish the placement test at A2 without practising: CTA reads „Mit A2 starten" and the A2
>   chip in the drawer is marked.
> - Answer one exercise on any `/uebungen/...` topic, then open the drawer on another page:
>   „Weiter üben · <that topic>" links back to it. Opened on that same topic page, it doesn't link
>   to itself.
> - Storage blocked or JS off: state C renders and works.
> - Switching language in the drawer updates the CTA text in all three states, and RTL (`ar`) looks right.
> - No header layout shift on load at 390 px or desktop. `pnpm build` and `validate-i18n` pass.
> - Note written to `docs/nav-cta-next-step-v1.md` with screenshots of the three states.

# Fortschritt als Karte — Tier 1 (2026-09-23)

Tier 1 of `FORTSCHRITT-KARTE-PROMPT.md`: `/fortschritt` is the map, the topic page is the
one place to learn, and the topic page now carries its course context. Decision and reasoning
are in that file (the `/uxfocus` study, "Karte → Seite").

## What was built

**A. `/fortschritt` is the map** (`src/components/LearnShell.astro`, 2,070 → 1,557 lines)

- No exercise is mounted anywhere on the map any more. Removed outright, not hidden:
  the item view's inline workspace, quiz, trainer and "every other kind" panels; the
  "direkt üben" exercise under every Stufenübersicht; the „Eigene Seite öffnen ↗" button;
  both „läuft in dieser Ansicht" badges; the client code behind them (`mountPractice`,
  `mountWorkspace`, `mountQuickExercise`, `creditAnswer`, the rule/exercise HTML builders,
  the focus-layout drawer) and the exercise content in `clientData` (`topics`, `choice`,
  `cards`, `audio`, `speak`, `read`, `pickerScope`, the embedded Artikel pool).
- `src/lib/inlineExercises.js` deleted — LearnShell was its only user.
- The item card has one primary action, a plain same-tab link to the entry's `href`:
  **„Übungen starten →"**, **„Weiter üben →"** once progress > 0, **„Öffnen →"** for an entry
  with nothing to count (an overview, an exam page). „Zurück zur Stufe" stays.
- Rows in the level overview and in the left list select the topic on the map; they do
  not navigate. The row label that said „Üben →" / „hier üben" now says „Ansehen →".
- Stufe overview, rings, level bar, course strip, Dein-Weg panel, reset, the Stufen tour:
  unchanged.
- Deep links (`/fortschritt?stufe=a1&thema=praesens`) select that topic. No redirect.

**B. Course context on the topic page**

- `src/lib/kursOrder.js` (new): `kursTopicsAt(level)` is the one ordered list of a level's
  grammar topics (workspaces + quiz-only topics, teaching order from `lehrplan.js`);
  `kursPosition(id)` gives level, place and neighbours. LearnShell's `grammarAt()` now maps
  over `kursTopicsAt()` instead of building its own list, so the map and the bar cannot
  disagree.
- `src/components/CourseBar.astro` (new), under the TopicBar:
  `← Dein Kurs A1` → `/fortschritt?stufe=a1&thema=<id>` (back lands on the same topic),
  `Thema 2 von 8`, ‹ › to the neighbouring topics, and a `ShareButton` for
  `/uebungen/grammatik/<id>`. The first/last topic keeps an invisible slot where the
  missing arrow would be, so the bar does not shift. Below 560px the labels shorten to
  `← Kurs A1` and `2/8`; it stays one line (44px) at 390px.
- On every `/uebungen/grammatik/[id]` page and on the bespoke `akkusativ.astro`.

## Decisions taken rather than assumed

- **/nav and /v2** (the study pages on the same component) — asked; answer: delete the
  inline code everywhere. `/nav` still compares the three navigation layouts, now without
  exercises. `/v2` existed to test practising inside the dashboard (`topicLayout="focus"`),
  so it is retired: `src/pages/v2.astro` deleted, `astro.config.mjs` redirects `/v2` →
  `/fortschritt`. The `topicLayout` prop is gone from LearnShell.
- **‹ › cover grammar topics only.** The A1 list on the map also ends with the
  der/die/das-Trainer row (`artikel-trainer`), which is not a grammar topic and has no
  place in `kursOrder.js`. „Thema x von y" therefore counts 8 in A1, the map shows 9 rows.
- **Stufe = the topic's level.** A topic is in exactly one level's list, so the bar never
  has to guess. A page whose topic is in no list renders no bar.

## Real vs. placeholder

All real: the order, the counts and the ring all read the same data and the same
localStorage store (`getTopicProgress`). No storage key was renamed or migrated.

## Verified

Headless Chromium, 390×844 and 1400×1000, dev server:

- `/fortschritt?stufe=a1&thema=praesens` selects Präsens; 0 exercise elements on the page;
  neither retired string anywhere in `src/` outside `uxfocus.astro`.
- Map → „Übungen starten" → 3 correct answers recorded → „← Kurs A1" returns to
  `?stufe=a1&thema=praesens` with the ring at „3 von 38 Aufgaben" and the button now
  „Weiter üben →".
- › from the first A1 topic walks `artikel, praesens, w-fragen, ja-nein-fragen, plural,
  akkusativ, possessivartikel, imperativ` — the map's left list in the same order; no ‹ on
  the first topic.
- `/nav?stufe=a2&thema=dativ` works; `/v2` → 301 → `/fortschritt`. No console errors.

**`pnpm build` did not pass — for a reason outside this tier.** It stops on
`/uebungen/grammatik/artikel`: `ArtikelPicker.astro` was rewritten in a parallel session
at 21:03 to take a `packs` prop, and `ArtikelTrainer.astro` does not pass one yet. Every
page this tier touched rendered in dev without errors. Re-run the build once that change
lands.

## Follow-up

- **Dead CSS in `src/styles/nav.css`**: ~64 rules for `.nvf-*`, `.nv--focus`,
  `.nv-quickex`, `.nv-learn*`, `.nv-ws*`, `.nv-inline*`. Left in place because `nav.css`
  is being edited in a parallel session; remove when it is free. Likewise LearnShell still
  imports `practice.css`, `akkusativ.css`, `dtz.css`, `verben-praepositionen.css` for
  widgets it no longer renders.
- **Back link on non-grammar pages** reached from the map (Wortschatz, Aussprache, Hören,
  Sprechen, Lesen, Kultur, the exam pages): not added. Each has its own header, and a
  `← Dein Kurs` there needs a decision on which Stufe it returns to (most are „A1–B1").
- **Two task counts for one topic**: the TopicBar on the Präsens page says „0 / 44
  Aufgaben", the map says 38. Pre-existing: `taskCountOf()` (grammarTasks.js) and
  LearnShell's `slotsOf()` count differently. One of them should go.
- **`artikel` vs. `artikel-trainer`**: both A1 rows now open the same page
  (`/uebungen/grammatik/artikel`, where the trainer is the Üben view). The trainer
  records its answers under `artikel`, so the `artikel-trainer` row will stop moving.
  Merge the two rows once Tier 2 is in.

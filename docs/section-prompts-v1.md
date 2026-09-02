# DeutschAcademy — tiered build prompts, all sections (v1, 2026-09-02)

Ready-to-paste prompts for a coding agent (Claude Code), one set per section. Each section is broken into **three tiers** so the work stays scoped instead of one giant ask:

- **Tier 1 — Scope.** Figure out exactly what belongs in this section, what source material exists for it (in the Deutsch v3 folder, on the live site, or nowhere yet), and what's explicitly out of scope. Output is a short plan, not code — matches how `self-study-tools-v1.md` and `value-stack-v1.md` were built (research the real material first, then build).
- **Tier 2 — Build.** Build the real thing from Tier 1's plan: real sourced content, no lorem ipsum, no invented numbers.
- **Tier 3 — Integrate & polish.** Wire it into nav/pricing tiers/progress tracking, cross-link it with other sections, verify it builds, and flag any open decisions rather than guessing (e.g. the `€XX/month (TBD)` pattern already in the pricing code).

Run these in order per section — don't jump to Tier 2 before Tier 1 has a real answer for "what sourced content actually exists for this." Sections can be worked in any order relative to each other.

Shared conventions already established on the site (reuse, don't reinvent): plain Astro + vanilla JS, no React/Vue; `src/lib/quiz.js` and `src/lib/flashcards.js` as the shared self-scoring engines; data-driven JSON under `src/data/`; styling via existing brand tokens in `src/styles/practice.css` / `global.css`; new tool pages live under `src/pages/uebungen/`; nav lives in `index.astro`. Scope note carried over from `value-stack-v1.md`: this is deutschacademy.com — Pflege/nursing-German content is out of scope (that's pflegeplace.com's lane), and DTZ-branded material should be used only as generic B1-level source text, not marketed as DTZ prep (the site's exam claims are Goethe/telc/TestDaF).

## Source material — real path

"The Deutsch v3 folder" referenced throughout this doc and in `self-study-tools-v1.md` / `value-stack-v1.md` is:

```
C:\Users\Edgar\Desktop\Top\Business and Private\Deutsch\Deutsch v3
```

It is **not** inside this repo and never has been — it's a separate folder on Edgar's Desktop, confirmed to contain the actual files named throughout these docs (Akkusativ.docx, Redemittel.docx, Bildbeschreibung.docx, DTZ_Simulation_Leseverstehen_v2.pdf, language-cluster-strategy.pdf, the Protokolle folder, the "Abschied Gruppe Q1 und Q2 2026.mp4" farewell video referenced in the testimonials section, etc.). Any Tier 1 prompt above that says "search the Deutsch v3 folder" means this path — an agent working only inside the git repo cannot see it and needs to be pointed here explicitly, or have the relevant files copied into the repo first.

Correction to a claim in `docs/exams-hub-tier1-v1.md` (written by a repo-scoped session that couldn't see this folder): it states "Leben in Deutschland has no dedicated source material" — that's wrong. Real LiD source material exists in this folder: `Leben_in_Deutschland_Bayern_A2.pdf`, `Leben_in_Deutschland_Bayern_B1.pdf`, `Leben_in_Deutschland_Bayern_B1_A.pdf`, and `LiD DTZ und mehr.docx`. Worth re-running that page's sourcing against these before treating its "generic public-knowledge only" framing as final.

## Doc sync note

`self-study-tools-v1.md`, `value-stack-v1.md`, and this file live in two places: the deutschacademy claude.ai Project (canonical, cloud-side) and `docs/` in this repo (static copies, for local Claude Code sessions to read). **These are not live-synced** — if one copy is edited, the other goes stale until someone re-copies it. If that becomes a problem, the simplest fix is to treat the repo copies as the only canonical ones and stop maintaining the Project-doc copies, or vice versa — worth deciding rather than silently drifting.

## Open discrepancy: DTZ in or out of scope?

`value-stack-v1.md` explicitly scoped deutschacademy.com to Goethe/TestDaF/telc and excluded DTZ-specific claims. `docs/exams-hub-tier1-v1.md` (built later, in the repo, without visibility into `value-stack-v1.md`) reversed that and shipped a DTZ exam page anyway. Resolve this explicitly before running section 3's Tier 2/3 prompts below — either the exams hub's DTZ page needs to come out, or the value-stack scope note needs to be formally updated (and the Pflege/pflegeplace.com boundary re-checked, since DTZ material historically overlapped with Pflege-track content).

---

## 1. Self-learning with tests

*Status: partially built — `/uebungen` hub + artikel-trainer, grammatik (6 of 60+ topics), wortschatz, sprechen, lesen-schreiben already exist per `self-study-tools-v1.md`.*

```
Tier 1 — Scope:
Read self-study-tools-v1.md in the project. List every grammar-topic .docx in the
Deutsch v3 folder that is NOT yet one of the 6 topics covered in the grammatik tool
(Akkusativ, Dativ, Passiv mit Modalverben, Konjunktiv II, Relativpronomen, trennbare
Verben). For the next 5 highest-value topics, confirm each source doc has enough
worked example sentences to build a quiz from (like the existing 6 did) without
inventing example sentences. Output: a prioritized list of the next topics to add,
with a one-line note per topic on what's actually in the source file.
```

```
Tier 2 — Build:
For the topics confirmed in Tier 1, extract real example sentences from each source
.docx the same way the existing 6 topics were built (source sentence -> quiz question,
source's own correct answer -> quiz answer, no invented grammar). Add them as new JSON
files under src/data/, wired into the existing grammatik topic-switcher via quiz.js.
Do not touch the 6 existing topics.
```

```
Tier 3 — Integrate & polish:
Update the /uebungen hub page to reflect the new topic count. Verify src/lib/quiz.js
still self-scores correctly with the larger topic set (spot-check a few new questions
against the source doc's stated answer). Run the same verification approach used
before (JSON validation, node --check, HTML tag-balance) since a real astro build
doesn't resolve in this environment — note in your output whether you were able to
run pnpm dev locally.
```

---

## 2. Vocab training

*Status: partially built — wortschatz flip-card tool exists (Redemittel + pets/trip-planning themes).*

```
Tier 1 — Scope:
Search the Deutsch v3 folder for vocab sets not yet in the wortschatz tool beyond
Redemittel and the pets/trip-planning themes (e.g. other thematic word lists,
Wortschatz-titled docs). List what's available and what natural theme groupings
they fall into. Flag anything that looks Pflege-specific so it can be excluded per
the site's scope.
```

```
Tier 2 — Build:
Add the confirmed new theme decks as JSON under src/data/, using the existing
flashcards.js flip/shuffle engine. Keep the same card format as the existing decks
(term, translation/definition, any example sentence from source).
```

```
Tier 3 — Integrate & polish:
Add a theme picker to the wortschatz page if there are now more than ~4 decks (rather
than one long scroll). Cross-link relevant vocab decks from the grammar topics that
use them (e.g. a Dativ-heavy vocab set linked from the Dativ quiz). Verify no dupes
across decks.
```

---

## 3. Test prep for exams

*Status: partially built — Sprechen (Bildbeschreibung, DTZ-format timer) and Lesen/Schreiben (DTZ simulation) exist, explicitly scoped to Goethe/telc branding per the strategy doc even where source material is DTZ-labeled.*

```
Tier 1 — Scope:
Confirm which exam formats deutschacademy.com actually claims (per the Product
Showcase copy already live and value-stack-v1.md: Goethe and telc formats). List
what exam-relevant source material exists per skill (Sprechen, Lesen, Schreiben,
Hören) and which of those already have a built tool vs. don't. Flag the two known
gaps from self-study-tools-v1.md: no Hören/listening material exists in source, and
the Fehlersuche + Fußballweltmeisterschaft cloze task were skipped for lacking an
answer key — decide whether those are worth reconstructing or should stay excluded.
```

```
Tier 2 — Build:
Build a "full mock sitting" mode that chains the existing Sprechen and
Lesen/Schreiben tools into one timed session matching real exam structure and
timing, rather than standalone practice. Do not fabricate a Hören section without
real audio or a real listening-transcript source — flag it as not-yet-possible
instead.
```

```
Tier 3 — Integrate & polish:
Add a results summary at the end of a mock sitting (score per skill, not just per
question). Decide, and document the decision, on how this ties to the "Exam Prep &
Coaching" tier from the pricing page — is the mock sitting free or premium-gated?
```

---

## 4. Cultural knowledge

*Status: not yet built — no dedicated source material identified yet.*

```
Tier 1 — Scope:
Search the Deutsch v3 folder and any other project material for anything
culture-adjacent (customs, holidays, regional differences, etiquette notes embedded
in lesson docs). Be honest in the output about how much real source material exists
vs. how much would need to be written fresh — this section has no confirmed source
yet, unlike the exercise tools. Propose a scope (e.g. "10 short culture notes tied to
topics learners already study") rather than an open-ended list.
```

```
Tier 2 — Build:
Build the confirmed scope as short-form content pages/cards, sourced from whatever
Tier 1 found, clearly written by a human (Edgar or a teacher), not presented as
AI-generated trivia. If Tier 1 found no usable source material, stop and flag that
this section needs source content supplied before it can be built, rather than
generating cultural claims from general knowledge.
```

```
Tier 3 — Integrate & polish:
Cross-link culture notes from relevant grammar/vocab lessons where a real connection
exists (e.g. a Redemittel phrase tied to a cultural norm). Add to nav.
```

---

## 5. Insider tips

*Status: not yet built — needs a scope decision on what this covers vs. section 4 and section 11.*

```
Tier 1 — Scope:
This section's name is ambiguous against "cultural knowledge" and a possible
"Alltag/practical life" section (see #11 below). Before building anything, propose
a clear boundary: e.g. "insider tips" = practical study/exam-day tactics from real
teacher experience (per the Teacher Training Frohsinn material referenced in
value-stack-v1.md), vs. "cultural knowledge" = customs/etiquette, vs. "Alltag" =
bureaucracy/daily-life logistics. Get that boundary confirmed before Tier 2.
```

```
Tier 2 — Build:
Build the confirmed scope from real teacher-sourced material only (e.g. concrete
exam-day advice, common mistake patterns actually seen in the classroom docs) —
not generic study-tips copy.
```

```
Tier 3 — Integrate & polish:
Tie tips contextually to the relevant tool (e.g. a Sprechen-specific tip surfaced
on the sprechen page, not just buried in a general list).
```

---

## 6. Learn how to learn

*Status: not yet built.*

```
Tier 1 — Scope:
Check whether the Teacher Training Frohsinn methodology material (Test-Teach-Test,
Fragekultur, breakout structuring — referenced in value-stack-v1.md as written for a
teacher audience) has any parts that translate honestly into learner-facing "how to
study German effectively" guidance, versus what would need to be written fresh for
learners. Propose scope.
```

```
Tier 2 — Build:
Build the confirmed scope — e.g. spaced-repetition guidance tied to how the vocab
tool actually works, a study-schedule template, guidance on using the self-study
tools effectively (which doubles as onboarding for sections 1-3).
```

```
Tier 3 — Integrate & polish:
Surface this as suggested reading for new users on first visit to /uebungen, not
just a standalone page.
```

---

## 7. Speaking & listening practice

*Status: gap explicitly flagged in self-study-tools-v1.md — "no audio (pronunciation practice, listening comprehension) — the folder doesn't contain audio files."*

```
Tier 1 — Scope:
Confirm there is still no audio source material anywhere in the project (re-check,
don't assume the earlier finding is stale). Decide what's actually buildable without
audio (e.g. text-based pronunciation guidance, IPA notes) vs. what genuinely needs
audio recorded or licensed before this section can exist. Output should make clear
which parts are blocked on Edgar supplying/recording audio.
```

```
Tier 2 — Build:
Build only the parts confirmed buildable without new audio. For anything audio-
dependent, do not fake it with text-to-speech presented as native audio — flag it
as pending instead.
```

```
Tier 3 — Integrate & polish:
Once real audio exists (future), wire it into the existing Sprechen tool's
Bildbeschreibung prompts rather than building a parallel listening tool.
```

---

## 8. Progress tracking / dashboard

*Status: gap explicitly flagged — "No progress tracking / accounts yet — these are stateless, anonymous, one-session-at-a-time tools."*

```
Tier 1 — Scope:
Decide the minimum viable version: local-only progress (browser storage, no
accounts) vs. account-backed progress (needs auth + backend, a much bigger scope).
Check whether the site has any auth/backend already or is purely static Astro —
if purely static, recommend starting with local-only and document that as the
constraint, rather than scoping a backend nobody asked to build yet.
```

```
Tier 2 — Build:
Build the local-only version first: track completion/scores per tool (quiz.js and
flashcards.js results) in browser storage, surfaced as a simple progress summary.
Do not build account infrastructure in this tier.
```

```
Tier 3 — Integrate & polish:
Surface progress on the /uebungen hub (e.g. "3 of 6 grammar topics attempted").
Document what a future account-backed version would need, as a follow-up scope,
not something to build now — this is also the natural premium-tier hook mentioned
in the pricing page, so flag that decision point rather than deciding it yourself.
```

---

## 9. Live coaching / tutoring

*Status: conceptually exists as the "Exam Prep & Coaching" tier in value-stack-v1.md's Deep Dive section — may just need pulling into its own section rather than building from scratch.*

```
Tier 1 — Scope:
Check whether this already has enough copy/structure on the live page (Deep Dive
tier card) to spin into its own section, or whether it needs new content (e.g.
booking flow, coach bios, session formats). List what exists vs. what's missing.
```

```
Tier 2 — Build:
Build the missing pieces only — likely a dedicated page expanding on what the Deep
Dive card currently summarizes. Do not invent coach names, credentials, or pricing
that aren't sourced from real material Edgar supplies.
```

```
Tier 3 — Integrate & polish:
Link this section from the relevant self-study tools (e.g. "stuck on Konjunktiv II?
book a session" from the grammatik tool) and from the pricing page's existing tier
card.
```

---

## 10. Grammar reference / cheat sheets

*Status: not yet built — distinct from the existing grammatik quiz tool (this is lookup, not testing).*

```
Tier 1 — Scope:
For the same topics already covered by the grammatik quiz tool (plus any added via
section 1's Tier 2), check whether the source .docx files contain clean rule
summaries/tables (not just example sentences) that could become a reference page.
List which topics have enough source material for a real reference vs. which would
need summarizing from scratch.
```

```
Tier 2 — Build:
Build reference pages/cards per topic sourced from the docs' own rule explanations
and tables, cross-linked 1:1 with the matching quiz topic. Reuse practice.css
styling rather than a new visual language.
```

```
Tier 3 — Integrate & polish:
Add a "look up the rule" link from each grammatik quiz question to its reference
entry, and vice versa (quiz -> "practice this" from the reference page).
```

---

## 11. Alltag in Deutschland / practical life guide

*Status: not yet built — practical-life angle distinct from "cultural knowledge," adjacent to (but not branded as) the DTZ/Leben-in-Deutschland source material.*

```
Tier 1 — Scope:
Confirm the boundary against sections 4 and 5 first (see #5's Tier 1). Then check
what real practical-life content exists in source material (Leben in Deutschland,
DTZ docs) that could be repurposed as generic "everyday life in Germany" guidance
WITHOUT DTZ branding or claims, per the site's scope note. List what's usable.
```

```
Tier 2 — Build:
Build the confirmed scope (e.g. Anmeldung, doctor's appointments, formal email
writing) as standalone practical guides, written in the site's own voice, not
copied DTZ exam framing.
```

```
Tier 3 — Integrate & polish:
Cross-link with section 3's Schreiben tool where a formal-email guide overlaps with
actual writing practice.
```

---

## 12. Success stories / testimonials

*Status: explicitly flagged as still lorem ipsum in value-stack-v1.md's "deliberately left untouched" list.*

```
Tier 1 — Scope:
Check what real student data exists (per value-stack-v1.md's suggestion: Protokolle,
the farewell video, or numbers Edgar supplies directly). This section cannot be
built from invented quotes or pass rates — output should be a request list of what
real material/numbers are needed if none is currently accessible, not placeholder
copy.
```

```
Tier 2 — Build:
Once real quotes/numbers are supplied, build the section from them verbatim
(with permission to use names/photos confirmed). Do not round or embellish numbers
the way the "60+ grammar topics" count was deliberately kept as a real sourced
count rather than a round guess.
```

```
Tier 3 — Integrate & polish:
Replace the corresponding lorem ipsum blocks (Hero, Trust Bar stats, Testimonials,
Team, Stats per value-stack-v1.md) with the real content, keeping everything else
on those blocks unchanged.
```

---

## 13. Placement / level test

*Status: not yet built.*

```
Tier 1 — Scope:
Decide the simplest honest version: a short self-assessment (e.g. 10-15 questions
spanning A1-B1 difficulty, drawn from the existing quiz question bank across
topics) that recommends a starting point among sections 1-3, vs. a full adaptive
test (bigger scope). Recommend starting simple.
```

```
Tier 2 — Build:
Build the simple version using existing quiz.js and real questions already sourced
for the grammatik/artikel tools (reuse rather than write new questions), with a
results mapping to "start here" recommendations across the site's tools.
```

```
Tier 3 — Integrate & polish:
Put this at the top of the /uebungen hub as the natural entry point for new
visitors, and feed its result into the progress-tracking dashboard (section 8) as
a starting baseline once that exists.
```

---

## Open scope decision to resolve before running these

Sections 4 (cultural knowledge), 5 (insider tips), and 11 (Alltag/practical life) overlap conceptually. Each Tier 1 prompt above flags this, but it's worth Edgar deciding the three-way boundary once up front rather than having each section's Tier 1 re-litigate it independently.

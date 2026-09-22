# DeutschAcademy — Monetization Strategy (v1, 2026-09-21)

Destination: `docs/monetization-strategy-v1.md`. House style follows `docs/value-stack-v1.md`
and `docs/exams-hub-tier1-v1.md` — every claim traces back to a real source file, a cited
URL, or is explicitly flagged as unverified.

## What this decides and what it doesn't

**Decides:** the revenue model, what stays free, what gets gated, concrete EUR prices, and
the order the lines get built in.

**Does not decide:** the implementation. That belongs in a `MONETIZATION-TIERED-PROMPT.md`
written after this doc is signed off, in the same tier-by-tier shape as
`AUTH-SSO-TIERED-PROMPT.md`.

**Inputs treated as fixed** (per Edgar, 2026-09-21): Stripe is the payment provider; the
auth work in `AUTH-SSO-TIERED-PROMPT.md` ships before any paywall; everything else open.

**Resolves:** the `€XX / month (TBD)` placeholder and its `<!-- TODO(Edgar) -->` in
`src/pages/index.astro`, carried as an open decision since `docs/value-stack-v1.md`
(2026-08-28).

---

## 1. The market reality, before the strategy

Three facts about German-language learning set the shape of everything below.

**a) The practice layer is already free, and given away by a serious incumbent.**
DeutschAkademie (`deutschakademie.de`) publishes 25,000+ free grammar exercises, 150+
grammar topics, 800+ hours, A1–C1, plus a free exam trainer and audio course — and
monetizes entirely through in-person/online courses, private tuition, and telc/ÖSD exam
registration. It runs ~614,050 visits/month and ranks #5,842 in Germany (Semrush, Aug 2026);
Similarweb records it with more total visits than goethe.de in the same month. Deutsche
Welle (Nicos Weg), Schubert-Verlag and mein-deutschbuch.de are also free. Lingolia gives one
free exercise per topic and charges €38.40/year for the rest.

**Implication:** charging for "practice exercises" as a category is charging for something
a better-ranked site gives away. The paid thing has to be something free sites structurally
cannot do.

**b) Consumer subscription pricing is already at the floor.**
Babbel is €8.99/mo on the 12-month plan (€107.88/yr) with a €299.99 lifetime that routinely
street-sells at 50–78% off; Busuu ~€6.99/mo annual; Duolingo's free tier is the real
competitor. Education is the single most discount-heavy app category (14.3% of education
apps run discounts — Adapty, 2026). Median global annual subscription price is $38.42.

**c) The money in German learning is not consumer subscriptions — it's deadlines and
third-party payers.**

| Who pays | What it costs them | Source |
|---|---|---|
| Goethe B1 exam sitting | €259 (B2 €289, C1 €349) | goethe.de Prüfungspreise 2026 |
| DTZ self-payer | €200 | MAS Sprachschule 2026 |
| TestDaF | €210 digital / €215 paper | Uni Stuttgart, goethe.de |
| telc B2 | €175–€255 depending on centre | vhs-Prüfungszentrale / alpha-zentrum |
| Integration course, self-payer | €2.29/UE → ~€1,603 for 700 UE | BAMF |
| Berufssprachkurs (DeuFöV §45a) | €2.56/UE → ~€1,024 for 400 UE; employer may pay directly | BAMF |
| Goethe online group course | €459 / 5 weeks | goethe.de |
| Private German tutor | €18–28/hr experienced, €55+/hr exam specialist | Preply, May 2026 |

A learner who will pay €259 for a B1 sitting — and the full fee again on a retake — has a
completely different price sensitivity than a learner choosing between Duolingo free and
Babbel at €8.99. **The second learner is the one every app is fighting over. The first one
is the one this site is already built for.**

---

## 2. Honest competitive read

**The good.** No established web property operates at the "DeutschAcademy" spelling today
(the research found only a YouTube channel), so the brand is clean. The repo's actual asset
base is unusual in combination:

- **4,000 words, A1–B2**, with full morphology (article, plural, POS, example sentence),
  across **160 Lernsets** — 650 A1 / 700 A2 / 1,150 B1 / 1,500 B2, counted directly from
  `src/content/lexicon/*.json` on 2026-09-21. **3,689 of the 4,000 carry IPA**, and
  `public/audio/` holds **760 pronunciation files**. (Note: commit messages still say
  "3,375 words" and "first 28 words" of audio — both are stale, the repo has moved past
  them. Use the counted figures.)
- **Arabic, Russian and Turkish translations for every word**, plus a runtime i18n layer
  with RTL support (`1f9c523`, `4494a30`). Almost nothing in this market does this, and it
  maps exactly onto the integration-course and skilled-worker population.
- **Exam modules already standing:** DTZ (mock test + Übungssatz), telc (Sprachbausteine),
  Goethe, TestDaF (Übungssatz), Leben in Deutschland (Fakten + Test), Start Deutsch 1
  (`src/pages/pruefungen/`).
- **Practice surfaces:** Artikel-Trainer, Aussprache, Fertigkeiten, Grammatik-Werkstatt +
  quiz, Hören, Kultur, Lesen, Schreiben, Sprechen (incl. B1/B2), Präpositionen, Wortschatz
  (`src/pages/uebungen/`).
- **14 own-authored PDFs** with a clean rights position — `src/data/downloads.json` states
  every file is DeutschAcademy-written and derived from this site's data, with publisher
  material deliberately excluded and official Modellsätze linked rather than hosted. That
  rights note is a genuine asset: it means the free layer can be given away without risk.
- **67 page files** producing ~666 prerendered pages on Vercel, zero-JS by default.

**The bad, stated plainly.**

1. **The name collision is a strategic problem, not a cosmetic one.** DeutschAkademie ranks
   for exactly the head queries a German-learning site wants ("kostenlos Deutsch lernen",
   "online Deutschkurs gratis") and for exam queries too. Every euro of brand-building at
   DeutschAcademy partially subsidizes a competitor one letter away, and the confusion runs
   one way only — toward the site with 614K visits. This needs a decision (§7).
2. **There is no traffic number in this repo.** Nothing here records current visits,
   registrations, or conversion. Every revenue projection below is therefore conditional,
   and flagged as such.
3. **No accounts exist.** All learner state is `localStorage` under `da_progress_v1`
   (`src/lib/progress.js`). There is nothing to attach an entitlement to until
   `AUTH-SSO-TIERED-PROMPT.md` ships. This is the hard prerequisite, already agreed.
4. **The landing page is not sellable as-is.** `src/components/Pricing.astro` still carries
   the old Philippine course pricing (PHP 45.000 / 55.000 / 60.000) and a "B2 Pflege" tier —
   and per the Language Cluster Strategy doc cited in `value-stack-v1.md`, **Pflege is
   pflegeplace.com's exclusive lane**, so that tier must not appear here at all. Hero, trust
   bar, stats, testimonials and team are still lorem ipsum per `value-stack-v1.md`.
5. **A live claim doesn't match the repo.** The landing page says "60+ grammar topics"
   (sourced in `value-stack-v1.md` from Deutsch v3 .docx filenames), while
   `downloads.json` describes "Alle 27 Grammatikthemen". Both may be true of different
   things, but a paid page cannot carry an unreconciled count. Fix before charging.

**Verdict.** A chance, yes — but not as "a more beautiful Babbel." As the exam-and-outcome
layer for learners with a date on the calendar and, often, someone else's money. Beauty and
comprehensiveness are how you win *that* buyer's trust; they are not, by themselves, a
reason for anyone to pay.

---

## 3. The free/paid line

**Principle: free is everything a search engine should index; paid is everything an account
makes possible.**

The free layer is not charity — it is the entire acquisition engine, and it is how
DeutschAkademie, Lingolia and Schubert-Verlag all operate. Gating the content would trade
the only distribution channel this site has for a conversion rate it cannot yet measure.

**Free forever, indexable, no account:**

- Every grammar explanation, rule and table.
- Every word list as reference (browse, search, sort) — `src/pages/uebungen/wortschatz`.
- All 14 PDFs in `downloads.json`, unchanged. The rights note is a trust asset; keep it loud.
- The Einstufungstest (`src/pages/einstufungstest.astro`) — it's a lead magnet, not a product.
- A metered slice of practice: a fixed number of exercises per topic per day, Lingolia-style.
- Leben in Deutschland / Fakten content — high-intent, low-cost, excellent SEO.

**Free with an account (the registration wall, not a paywall):**

- Progress sync across devices — the entire point of the Supabase work.
- Saving words to a personal list.
- One full exam sitting, once, so the value is felt before it is charged for.

**Paid:**

- Unlimited timed exam sittings with scoring and review (`src/lib/exam/`).
- The Wortschatz trainer beyond the daily meter, with spaced repetition and audio.
- Personalized PDF export (your weak words, your wrong answers) — cheap to build on data
  that already exists, and genuinely not available anywhere else.
- Written corrections and spoken mock sittings by a human.

Note on the benchmark: hard paywalls convert ~5× better than freemium (10.7% vs 2.1%
install-to-paid at D35, RevenueCat 2026). That benchmark is for apps acquired through app
stores. A site whose acquisition is 100% organic search cannot put a wall in front of the
content without destroying acquisition. The resolution is to put the **hard wall at the
account layer** — exam sittings and progress — while the content layer stays open.

---

## 4. The offers and the prices

Four lines, deliberately sequenced (build order in §5).

### Line 1 — Prüfungspakete (one-time) — **build first**

| Pack | Price | Anchor |
|---|---|---|
| DTZ / Leben in Deutschland | **€29** | exam fee €200; retake = €200 again |
| telc B1 or B2 | **€39** | exam fee €175–255 |
| Goethe B1 or B2 | **€39** | exam fee €259 / €289 |
| TestDaF | **€49** | exam fee €210; a failed sitting delays a whole semester |
| Any two packs | **€59** | |

One-time purchase, 12 months' access. Sold against the fee the learner is already committed
to: €39 is 15% of a Goethe B1 sitting, framed as insurance against paying €259 twice.

Why first: no churn, no proration, no dunning, no subscription lifecycle — a single Stripe
Checkout session writing a single entitlement row. Smallest possible Stripe surface, highest
willingness to pay, and it tests whether anyone pays at all before the pricing architecture
is locked.

### Line 2 — Premium-Mitgliedschaft (subscription)

- **€7.99 / month**
- **€59 / year** (≈€4.92/mo, −38%) ← the plan to push
- **No permanent lifetime SKU.** Optionally, a **€99 "Gründungsmitglied"** lifetime capped
  at the first 200 buyers, as a cash-and-signal instrument during launch only.

Rationale: undercuts Babbel's €8.99/mo annual without racing Lingolia's €38.40/yr to the
floor; sits above the €38.42 global median annual, which European pricing supports (Europe
runs 29–39% above North America — Adapty 2026). At the education-category first-renewal
median of 24% for annual plans, €59/yr implies ~€73 LTV, comfortably above the €45.10
category 12-month benchmark. Monthly at €7.99 with a 56% monthly renewal median implies only
~€28 LTV — which is exactly why annual is the default and monthly exists mainly to make
annual look correct.

A permanent lifetime SKU is rejected: Babbel's €299.99 lifetime street-sells at up to 78%
off, i.e. it functions as a discount instrument, and committing to lifetime access before
LTV is known caps revenue on the best customers.

### Line 3 — Der menschliche Teil (the margin)

- **Schreiben-Korrektur: €9** per text, **€39** for 5.
- **Sprech-Simulation (live, 30 min, exam format): €49.**
- **Prüfungs-Coaching block (4 × 60 min): €199.**

Anchored on Preply's €18–28/hr experienced and €55+/hr exam-specialist rates and Goethe's
€289 six-week B1 exam-prep course. This is the line no free site and no app can copy —
`value-stack-v1.md` already claims "human corrections by an instructor, not a model" on the
landing page, so the promise exists and needs a price behind it.

### Line 4 — Institutionell (later, and the largest)

Seat licenses for Volkshochschulen, Sprachschulen and DeuFöV/Berufssprachkurs providers who
need a homework and progress layer they don't have to build — a market where BAMF already
moves €2.29–2.56 per Unterrichtseinheit and the buyer is an institution, not a learner.
Indicative **€3–5 per seat per month, 20-seat minimum**, to be validated by conversation, not
by this doc. Explicitly **excludes Pflege/nursing**, which belongs to pflegeplace.com.

---

## 5. Build order

Each step is shippable and revenue-bearing on its own.

0. **`AUTH-SSO-TIERED-PROMPT.md` Tiers 0–4.** Prerequisite. No entitlement can exist without
   an account.
1. **Entitlements table** in Supabase — `user_id`, `product`, `granted_at`, `expires_at`,
   `source` — with RLS matching the profiles shape ported from colevitate. One table,
   deliberately, so a one-time pack and a subscription grant the same kind of row.
2. **Stripe Checkout for one product**, the DTZ pack. Vercel serverless route with
   `prerender = false`, webhook on `checkout.session.completed` writing the entitlement row.
   Test mode → live. Ship it and see if anyone buys.
3. **The gate itself** — a single server-side check, and a first-paint pattern for the
   client mirroring the existing `da-theme` / `da_lang` `is:inline` discipline in
   `Layout.astro`, so no page flashes locked-then-unlocked across ~666 prerendered pages.
4. **Remaining exam packs** — data-driven from the same product table, no new code.
5. **Subscription line** — `customer.subscription.*` webhooks, Stripe Customer Portal for
   cancellation (do not hand-build billing management), the daily meter on free practice.
6. **Rebuild `Pricing.astro`** against these prices, in German, with `data-i18n` keys, PHP
   pricing and the Pflege tier removed. Reconcile the 27-vs-60 grammar-topic count first.
7. **Human layer** — Checkout for a credit, a queue, a turnaround promise. Manual delivery
   at first; do not build a correction workflow tool before the first ten corrections are sold.
8. **Institutional** — only after lines 1–3 have real numbers to show a buyer.

---

## 6. What it would actually take (conditional arithmetic)

No traffic figures exist in this repo, so these are scenarios, not forecasts. Target:
**€2,000/month.**

| Route | Units needed / month | Traffic implied |
|---|---|---|
| Subscriptions at €59/yr | ~407 *active* annual subs | ~20,000 registered users at a 2% paid rate |
| Exam packs at €39 | **~51 sales** | ~5,100 visits/mo at 1% purchase, or ~1,700 at 3% |
| Human layer at €39–199 | **~15–50 units** | a few hundred qualified visitors |

For scale: if DeutschAcademy reached 5% of DeutschAkademie's 614K visits/month (~30K), at a
3% registration rate and 3% paid conversion that is ~27 subscription sales/month ≈ €1,600/yr
run-rate from Line 2 — versus €1,053/month from just 27 exam packs at €39.

**The conclusion the arithmetic forces:** the subscription line only works at traffic this
site does not yet have, while the exam and human lines work at traffic it plausibly has
today. Build the one-time lines first. Treat the subscription as what you graduate into once
the free layer is pulling five figures of monthly visits.

---

## 7. Open decisions — Edgar's calls, not mine

1. **The name.** Compete head-on at a one-letter remove from a 614K-visit/month incumbent,
   or differentiate the mark hard (logotype, a distinct second word, a different primary
   domain)? This affects every euro of acquisition spend. Recommend deciding before any paid
   channel is switched on. Trademark position not checked.
2. **Exam pack prices** (€29/€39/€49) — anchored to exam fees, but not tested. Worth running
   past three actual learners before Stripe products are created.
3. **The €99 founding lifetime** — ship it or not? Cash now against capped LTV later.
4. **Who delivers the human layer** and at what volume, since it is the only line that does
   not scale without a person.
5. **The 27 vs 60+ grammar-topic discrepancy** — which number is true, and which source is
   authoritative?
6. **Institutional lane** — whether to pursue schools at all, or stay direct-to-learner.

---

## Sources

Repo: `src/content/lexicon/*.json`, `src/data/downloads.json`, `src/pages/pruefungen/`,
`src/pages/uebungen/`, `src/components/Pricing.astro`, `src/lib/progress.js`,
`src/layouts/Layout.astro`, `docs/value-stack-v1.md`, `AUTH-SSO-TIERED-PROMPT.md`,
git commits `2182c84`, `1f9c523`, `4494a30`, `580e75b`.

External (all retrieved 2026-09-21): goethe.de Prüfungspreise 2026 · deutschakademie.de ·
Semrush/Similarweb traffic data (Aug 2026) · lingolia.com/en/plus · easy-deutsch.de ·
lingoda.com/en/pricing · trusted.de (Babbel, Memrise) · preply.guide · BAMF
Integrationskurs and Berufssprachkurs Kostenbeteiligung pages · RevenueCat *State of
Subscription Apps 2026* · Adapty *Education App Subscription Benchmarks 2026*.

**Flagged as unverified:** Babbel and Busuu EUR list prices (own pricing pages not
retrievable; German review sites dated Oct–Nov 2025 used instead, and two sources disagree
on Busuu's annual price by ~2.4×) · DTZ self-payer fee (€200 from one centre; a secondary
source gives a €130–170 range labelled "voraussichtlich") · telc fees vary by centre with no
national list · per-head employer cost of funded language training · DeutschAkademie
trademark position · the 3,375-word count (from commit messages, not recounted) ·
DeutschAcademy's own traffic and conversion, which do not exist anywhere in this repo.

\# DeutschAcademy landing page — value stack v1 (2026-08-28)

Applied directly to `C:\Users\Edgar\Projects\deutschacademy\src\pages\index.astro` (the live Astro landing page), replacing lorem-ipsum placeholders in three sections: **Value Props** (4 cards), **Deep Dive** (3 tier cards: Core / Exam Prep & Coaching / Community), and **Pricing** (Free / Premium Membership cards + section head).

Scope note: this is deutschacademy.com specifically — per `language-cluster-strategy.pdf` (Aug 16, 2026 rev.) in the Deutsch v3 folder, Pflege/nursing German is pflegeplace.com's exclusive lane, so no Pflege-specific claims were used here even though a lot of the raw material (old Pricing.astro, WhatYouDo.astro) was originally Pflege-focused.

\## Where each claim came from

- **"60+ grammar topics"** — counted from the distinct grammar-topic .docx filenames in Deutsch v3 (Adjektivdeklination, Akkusativ, Dativ, Genitiv, Passiv, Konjunktiv II, Relativpronomen, Präpositionen, trennbare Verben, Modalverben, zu-Infinitiv, etc.) — this is a real, sourced count, not a round-number guess.
- **"Real-life scenario library / everyday German, not textbook dialogues"** — sourced from the dozens of scenario-titled lesson docs (e.g. "Was hast du gestern gemacht", "Ich habe am Wochenende gekocht", "Heute Nachmittag gehe ich ins S", "Seid ihr schonmal umgezogen") — these are actual taught lessons built around real situations, not generic textbook dialogues.
- **"Speaking practice: role-play, partner exercises, Bildbeschreibung"** — from Bildbeschreibung.docx / Bildbeschreibung heute.docx, Stadtplan.docx, and the various *partneruebung*.pdf files.
- **"Exam-format mock sittings" / "Goethe and telc formats"** — the existing (non-lorem) Product Showcase checklist on the same page already claims this; kept consistent with it. Note: the folder's exam-prep material is mostly DTZ-branded (DTZ Vorbereitung, gast_DTZ_Uebungssatz, Leben in Deutschland) which is a BAMF integration exam, not Goethe/TestDaF — I did not claim DTZ-specific prep for deutschacademy since the strategy doc scopes this site to Goethe/TestDaF/telc, not DTZ.
- **"Human corrections by an instructor, not a model"** — matches the existing Product Showcase copy already on the page (not new).
- **"Teacher Training Frohsinn" methodology (Test-Teach-Test, Fragekultur, breakout structuring)** — reused conceptually for "Speaking practice built in" / "Community & Practice" framing, not name-dropped directly since that program was written for a teacher audience, not learners.

\## Deliberately left untouched (still lorem ipsum)

Hero, Trust Bar stats, How It Works steps, Final CTA, Footer, Testimonials, Team, Stats. These need either real numbers (student counts, pass rates) or real quotes that weren't in the material I reviewed — flag if you want these filled in too, and where the numbers/quotes should come from (e.g. the Protokolle, the farewell video, or numbers you supply directly).

\## Open decision carried over, not resolved

Premium Membership price is left as `€XX / month (TBD)` with a `<!-- TODO(Edgar) -->` comment in the code, pointing back to the Language Cluster Strategy doc's open decision (one-time €100–400 vs. €20–40/month vs. both). I did not pick a number — that's a pricing call, not a content one.

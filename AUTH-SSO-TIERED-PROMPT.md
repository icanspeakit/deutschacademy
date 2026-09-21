# DeutschAcademy — Accounts & Progress Sync — Tiered Build Prompt (v1, 2026-09-21)

## How to use this file

This is a set of ready-to-paste prompts for adding **Google SSO plus server-backed
progress** to deutschacademy.com: learners sign in with Google, and the practice state
that today lives only in one browser's `localStorage` follows them to any device.

Each tier below is self-contained and builds on the previous one. Paste **one tier at a
time** as a prompt to Claude Code running in this repo
(`C:\Users\Edgar\Projects\deutschacademy`) — don't skip ahead, since later tiers assume
earlier tiers' files exist. After each tier, review the output before starting the next.

Every tier ends with a **Definition of Done** and a required decisions note written to
`docs/`, following the same pattern as `self-study-tools-v1.md` and
`exams-hub-tier1-v1.md` (every claim traces back to a real source file or is explicitly
flagged).

**Prerequisite: `docs/auth-sso-console-checklist.md` must be fully worked through
before Tier 0 starts.** Tier 0 needs `PUBLIC_SUPABASE_URL` and
`PUBLIC_SUPABASE_ANON_KEY` to exist in `.env.local` and in Vercel. No tier in this file
creates a Supabase project, a Google OAuth client, or any DNS record — all of that is
console work and lives in the checklist.

---

## Context (read this before starting any tier)

### Where the project is now

- **Stack:** Astro 7, `output` unset (fully static), **no adapter, no React, no framework
  integration of any kind**. 66 page files in `src/pages` produce ~666 prerendered HTML
  files. Deployed on Vercel. All interactivity is vanilla JS modules in `src/lib/*.js`
  attached from `<script>` blocks in `.astro` files.
- **All learner state is `localStorage` today.** The main store is `da_progress_v1`,
  owned by `src/lib/progress.js`, whose header comment reads: *"No accounts, no server —
  everything lives in this browser's localStorage."* That comment becomes wrong in
  Tier 2 and must be rewritten there, not left to rot.
- **Styling:** brand tokens in `src/styles/global.css` (`--brand-blue`, `--gradient-brand`,
  `--surface-card`, the `--text-*` scale), with a full dark-mode block keyed on
  `[data-theme="dark"]`. Per-area stylesheets in `src/styles/`.
- **First-paint discipline already exists.** `src/layouts/Layout.astro` runs two
  `is:inline` scripts before paint — one for theme (`da-theme`), one for language
  (`da_lang`) — specifically so the page never flashes the wrong state. Auth must follow
  that same pattern (Tier 1), not introduce a flash of signed-out UI on 666 pages.

### Seams that already exist — use them, do not build parallel ones

The codebase anticipated this work. Three places are already shaped for it:

1. **`src/lib/progress.js` → `getResume({ remote })`.** Its comment reads: *"`remote` is
   the seam for a logged-in learner: when there is an account to read from, the caller
   fetches that record and passes it here, and the newer of the two wins. Nothing in this
   module ever fabricates one — no login exists yet, so today it is always local."*
   Tier 2 fills this seam. Do not change its signature.
2. **`src/components/NavAccount.astro`** — the avatar button and menu in the nav's
   right-hand cluster, already rendered by `src/components/SiteNav.astro`. Its comment
   reads: *"There is no account system yet, so the avatar is a monogram rather than a
   photo... No 'Einstellungen' row: /einstellungen does not exist."* Tier 1 replaces the
   monogram with real state and Tier 4 adds the account row. Update those comments as the
   facts change.
3. **`src/lib/exam/state.js`** — already namespaces per-exam state under the prefix
   `da-exam-v1:`, which makes it mirrorable as a group in Tier 3.

### Architecture decision (settled — do not relitigate)

**Hybrid Astro, not a Next.js port, and not fully-static client-only auth.**

- `output: 'static'` + the Vercel adapter. The ~660 content pages stay prerendered on the
  CDN. Only the handful of routes that genuinely need a server opt out with
  `export const prerender = false`.
- **React islands for the auth UI only** (`@astrojs/react`). Sign-in form, nav account
  state, account page. Everything else in the repo stays vanilla `.astro` + JS. Do not
  convert existing pages or `src/lib/*.js` modules to React. Do not add a React island to
  a page that does not need one — the zero-JS default on content pages is load-bearing
  for this site.
- **Sessions in cookies via `@supabase/ssr`, not localStorage.** `createBrowserClient`
  from `@supabase/ssr` writes the session to a cookie, which means the prerendered pages
  read it client-side *and* the server routes read the same cookie. One session
  mechanism, not two. Do not use plain `createClient` from `@supabase/supabase-js` for
  session-bearing code.
- **Known Astro constraint, plan around it:** Astro middleware does **not** run
  per-request for prerendered pages — for those it runs at build time. So "refresh the
  session on every request" (the Next.js middleware pattern) applies only to the
  `prerender = false` routes. On prerendered pages the browser client refreshes the
  session itself. This is expected; do not try to defeat it.

### Reference implementation

A working Next.js version of this exact flow exists at
`C:\Users\Edgar\Projects\colevitate` — `src/lib/supabase/{client,server,middleware}.ts`,
`src/app/auth/callback/route.ts`, `src/lib/supabase/AuthProvider.tsx`,
`src/components/auth/SignInCard.tsx`, `supabase/migrations/0001_create_profiles.sql`.

**Port the logic and the RLS shape. Do not port the chrome.** Colevitate's UI is
shadcn/ui + lucide-react + Tailwind; DeutschAcademy has none of those and is not getting
them. Rebuild every auth surface with this project's own brand tokens and plain CSS in a
new `src/styles/auth.css`, matching how `src/styles/practice.css` and
`src/styles/site-nav.css` are written.

### Language

The site is German-first with a runtime i18n layer (`src/lib/i18n.js`, JSON in
`public/i18n/`). **All user-facing auth copy is German**, and every string gets a
`data-i18n` key added to the locale files the same way existing components do. Do not
ship English strings into the UI.

---

## Tier 0 — Framework foundations, no auth yet

**Prompt:**

> Prepare the deutschacademy Astro project (repo root) for server routes and React
> islands, **without adding any authentication behaviour yet**. This tier must be a
> no-op for every existing page.
>
> 1. Install: `@astrojs/vercel`, `@astrojs/react`, `react`, `react-dom`,
>    `@supabase/supabase-js`, `@supabase/ssr`. Use `pnpm` — this project uses pnpm with a
>    `pnpm-workspace.yaml`.
> 2. Update `astro.config.mjs`: keep the existing `server.host` / `server.allowedHosts`
>    block and its comments verbatim, add `output: 'static'`, `adapter: vercel()`, and
>    `integrations: [react()]`. Add a short comment explaining that static stays the
>    default and individual routes opt out with `export const prerender = false`.
> 3. Add `src/lib/supabase/browser.js` exporting `createBrowserSupabase()` built on
>    `createBrowserClient` from `@supabase/ssr`, reading
>    `import.meta.env.PUBLIC_SUPABASE_URL` and `import.meta.env.PUBLIC_SUPABASE_ANON_KEY`.
>    Add `src/lib/supabase/server.js` exporting `createServerSupabase(astroContext)`
>    built on `createServerClient`, wired to Astro's `context.cookies` for get/set.
>    Both files: JSDoc, no TypeScript (this repo is JS with a `tsconfig.json` for editor
>    support only — match that).
> 4. Create one throwaway proof route `src/pages/auth/ping.ts` with
>    `export const prerender = false`, returning JSON `{ ok: true, hasSession: false }`.
>    It exists only to prove the adapter works; Tier 1 deletes it.
> 5. Do not touch any existing page, component, style or lib module beyond
>    `astro.config.mjs`.
>
> Verify with `astro dev --background` per `CLAUDE.md`, then a full `pnpm build`.

**Definition of Done:**
- `pnpm build` succeeds and the prerendered HTML count in `dist/` is **unchanged from
  before this tier** (count it before you start and state both numbers in the note — if
  pages dropped out of prerendering, the config is wrong).
- `/auth/ping` returns JSON when running `astro dev`.
- No diff in `git status` outside `astro.config.mjs`, `package.json`, the lockfile, and
  the three new files.
- `docs/auth-sso-tier0-v1.md`: the before/after prerender counts, and a note on the
  Astro-middleware-vs-prerendered-pages constraint so the next tier does not rediscover it.

---

## Tier 1 — Google sign-in, end to end, no data sync

**Prompt:**

> Building on Tier 0: make "Mit Google anmelden" work end to end. No progress syncing in
> this tier — signing in and out is the whole scope.
>
> 1. `src/middleware.js` — refresh the Supabase session for on-demand routes using
>    `createServerSupabase`. Call `supabase.auth.getUser()` (not `getSession()`), and put
>    the user on `context.locals.user`. Comment clearly that this runs only for
>    `prerender = false` routes and why (see Colevitate's
>    `src/lib/supabase/middleware.ts` for the equivalent, but Astro's cookie API differs —
>    do not copy it literally).
> 2. `src/pages/auth/callback.ts` — `prerender = false`. Handles the PKCE `?code=` return
>    from Google via `exchangeCodeForSession`. Honour a `next` param but **only if it
>    starts with a single `/`** (Colevitate's callback route has the exact open-redirect
>    guard — port that check). On error redirect to `/anmelden?fehler=auth`.
>    Delete `src/pages/auth/ping.ts`.
> 3. `src/pages/auth/abmelden.ts` — `prerender = false`, POST only, signs out and
>    redirects to `/`.
> 4. `src/components/auth/SignInCard.jsx` — React island. Google button only in this
>    tier; leave a clearly marked seam for the email/magic-link modes that Colevitate's
>    `SignInCard.tsx` has, but do not build them. Calls `signInWithOAuth({ provider:
>    'google', options: { redirectTo: <origin>/auth/callback?next=... } })`. German copy,
>    `data-i18n` keys, brand tokens, new `src/styles/auth.css`. Inline the Google "G"
>    SVG — do not add lucide-react or any icon package.
> 5. `src/pages/anmelden.astro` — `prerender = false`, uses `Layout.astro`, renders
>    `<SignInCard client:load />`. If already signed in, redirect to `next` or `/`.
> 6. `src/components/auth/AuthStatus.jsx` — React island for the nav. Signed out: the
>    existing "DA" monogram, linking to `/anmelden`. Signed in: the Google avatar
>    (`user_metadata.avatar_url`) with the monogram as fallback, plus an "Abmelden" row in
>    the menu. Mount it inside `src/components/NavAccount.astro` with `client:idle`,
>    keeping every existing link row and every existing comment in that file intact —
>    then **update the comments in `NavAccount.astro` that claim no account system
>    exists**, because after this tier that is no longer true.
> 7. **No flash of signed-out UI.** Add a third `is:inline` script to
>    `src/layouts/Layout.astro`, directly after the existing theme and language scripts
>    and following their exact style and commenting convention. It checks only for the
>    *presence* of the Supabase auth cookie — it must not parse or trust it — and sets
>    `document.documentElement.dataset.auth = "in" | "out"` before first paint, so the nav
>    can reserve the right shape. Add a comment saying this is a paint hint only and that
>    `getUser()` remains the sole source of truth.
> 8. Add every new German string to `public/i18n/de.json` and the other locale files,
>    matching how existing components register keys.
>
> Do not create any Supabase table in this tier. Do not read or write any learner data.

**Definition of Done:**
- Sign in with Google from `/anmelden` completes and lands back on the page you came from.
- The nav avatar reflects real state on both a prerendered page (e.g. `/uebungen`) and an
  on-demand page, with no visible flash on reload.
- Sign out works and the avatar returns to the monogram without a manual reload.
- `pnpm build` still prerenders the same page count as Tier 0; only
  `/anmelden`, `/auth/callback`, `/auth/abmelden` are on-demand.
- The stale "no account system yet" comments in `NavAccount.astro` are rewritten.
- `docs/auth-sso-tier1-v1.md`: which routes became on-demand and why, the open-redirect
  guard, and the cookie-presence paint hint with its explicit non-security caveat.

---

## Tier 2 — Core progress sync (`da_progress_v1`)

**Prompt:**

> Building on Tier 1: make practice progress follow a signed-in learner across devices.
> Local-first stays the rule — `localStorage` remains the working copy that every existing
> caller reads and writes synchronously, and Supabase is a mirror. A signed-out learner
> must behave exactly as they do today, with no network calls and no behaviour change.
>
> 1. Migration `supabase/migrations/0001_user_state.sql` — create the `supabase/` folder
>    (this repo has none yet; mirror Colevitate's layout):
>    ```sql
>    create table public.user_state (
>      user_id    uuid not null references auth.users(id) on delete cascade,
>      key        text not null,
>      value      jsonb not null,
>      updated_at timestamptz not null default now(),
>      primary key (user_id, key)
>    );
>    ```
>    Enable RLS and add four policies, all `auth.uid() = user_id`, plus a
>    `set_updated_at` trigger — copy the exact shape of Colevitate's
>    `supabase/migrations/0001_create_profiles.sql`.
>    One generic key/value table, **not** a column per feature: this site has 20+
>    localStorage keys and they will keep changing.
> 2. `src/lib/sync.js` — the only module that talks to `user_state`.
>    `pullState(key)`, `pushState(key, value)`, `mergeOnSignIn()`. Every function is a
>    no-op returning local data when signed out. Never throws into a caller; a failed
>    sync degrades to local-only and logs once.
> 3. **Mirror an explicit allowlist, never "every localStorage key".** This tier syncs
>    exactly three: `da_progress_v1`, `da_display_name`, `da_weekly_goal`. Define the
>    allowlist as a single exported constant in `src/lib/sync.js` so Tier 3 extends one
>    list rather than hunting call sites.
> 4. **The merge is the hard part and must not invent activity.** Write
>    `mergeProgress(local, remote)` in `src/lib/progress.js` with these rules, and comment
>    each one with its reasoning in this project's voice:
>    - `dailyActivity`: per-date **max, not sum**. Summing double-counts every sitting
>      that already synced. Max under-counts genuine same-day practice on two devices —
>      that is the honest direction to err, and the comment must say so.
>    - `vocabMastered`: set union.
>    - `skills[*]` `attempts` / `correct` / `sessions`: per-field max, same reasoning.
>    - `topics`: same treatment as `skills`.
>    - `recents`: union by `path`, keep the newer `at`, re-sort, cap at `RECENTS_MAX`.
>    - `lastActiveDate`: the later date.
>    - `streak`: **recompute from the merged `dailyActivity`** — never take the max of the
>      two stored streaks, which would hand someone a streak they did not earn.
> 5. Fill the existing seam: `getResume({ remote })` already accepts a remote record and
>    prefers the newer. Wire the real fetch into its callers. **Do not change its
>    signature.**
> 6. Push on write, debounced (~2s) and on `visibilitychange`, so a graded answer does not
>    fire a request per keystroke. Pull and merge once on sign-in and once per page load
>    for a signed-in learner.
> 7. Rewrite the header comment of `src/lib/progress.js`. It currently says "No accounts,
>    no server — everything lives in this browser's localStorage." State the new truth:
>    local-first, mirrored to Supabase when signed in, local-only when not.
> 8. Same for `resetProgress()`, whose comment says "there is no undo because there is no
>    server" — decide and document whether reset now clears the remote row too. It should,
>    and it should say so in the UI before doing it.

**Definition of Done:**
- Sign in on browser A, practise, sign in on browser B: the streak, weekly count and
  "Weitermachen" card carry over.
- A signed-out learner produces **zero** network requests to Supabase — verify in devtools
  and state it in the note.
- Merging a device that practised offline neither loses its activity nor double-counts it.
- RLS verified by hand: a second test account cannot read the first account's row.
- Both stale comments (`progress.js` header, `resetProgress`) rewritten.
- `docs/auth-sso-tier2-v1.md`: the merge rules table with the reasoning for each, and an
  explicit statement of what the max-not-sum choice under-counts.

---

## Tier 3 — Full mirror (exams, writing drafts, settings)

**Prompt:**

> Building on Tier 2: extend the `user_state` mirror to the rest of the learner's state,
> by extending the allowlist constant in `src/lib/sync.js`. Group and treat as follows:
>
> - **Exam state** — every key under the `da-exam-v1:` prefix owned by
>   `src/lib/exam/state.js`, **and every key under the `da-dtz-v1:` prefix** (a second,
>   older exam namespace still present in the repo — find its owning module and decide
>   whether it should be migrated onto `da-exam-v1:` or mirrored as-is; flag the choice
>   in the note), plus `da-fortschritt-last` and `da-lid-land`
>   (`src/lib/examDashboard.js`, `src/pages/pruefungen/leben-in-deutschland/test.astro`).
>   Sync per exam id, not as one blob, so two devices mid-sitting on different exams do
>   not clobber each other.
> - **Placement result** — `da-einstufung` (`src/pages/einstufungstest.astro`). This is a
>   real assessment outcome, not a preference: it decides what the site recommends. Sync
>   it, and on conflict keep the **more recent** result rather than the higher level.
> - **Writing drafts** — `da-sd1-schreiben`, `da-tdaf-schreiben`, and any sibling
>   `*-schreiben` key. These are free text a learner typed and are the most painful thing
>   on this list to lose: **last-write-wins is not acceptable**. If local and remote both
>   changed since the last sync, keep both and surface the conflict in the UI rather than
>   silently discarding one.
> - **Run state** — `da-grammatik-lauf` (`src/lib/grammarRun.js`), `da_leicht_v1`
>   (`src/lib/leicht-app.js`).
> - **Settings** — `da-theme`, `da_lang`, `da-wortschatz-lernsets-fold`,
>   `da-grammatik-mode`. These are last-write-wins; nothing is lost if the newer one wins. Note that `da-theme` and
>   `da_lang` are read by the `is:inline` scripts in `Layout.astro` before any module
>   loads, so a remote value can only apply from the *next* navigation — do not attempt to
>   make first paint wait on the network.
>
> **Explicitly never sync** the prototype and variant keys — `da-front-variant`,
> `da-mobile-variant`, `da-mobile2-concept`, `da-better-mode`, `da-font-test`,
> `da-no3-brief`, `da-no3-brief-seen`, `nv-variant`, `nv-view`, `hp-concept`,
> `concepts-active`, `fakten-lang`, `fakten-layout`, `da-navnew-variant`. These belong to
> design-exploration pages, not to learners. Also never sync `da-fc-theme`: it is a dead
> legacy key that `Layout.astro`'s inline theme script reads exactly once to migrate an
> old Wortschatz night-mode setting onto `da-theme`. Mirroring it would resurrect a
> setting the migration exists to retire. List them as a `NEVER_SYNC` constant beside
> the allowlist with a comment saying why, so the next person does not "helpfully" add them.
>
> Before writing code, grep the repo for `localStorage.` and reconcile what you find
> against the three lists above. If a key exists that this prompt does not mention, add it
> to the correct list and **flag it in the tier note** rather than guessing silently.

**Definition of Done:**
- Every key in the repo appears in exactly one of: allowlist, `NEVER_SYNC`, or the note's
  flagged-unknown list.
- An exam half-finished on one device resumes on another at the right part.
- A writing draft edited on two devices produces a visible conflict, not a silent loss —
  demonstrate this deliberately.
- Theme/language sync applies from the next navigation with no first-paint regression.
- `docs/auth-sso-tier3-v1.md` with the full key inventory as a table: key → owning file →
  sync treatment → reasoning.

---

## Tier 4 — Account page, DSGVO, and one genuinely server-guarded route

**Prompt:**

> Building on Tiers 1–3:
>
> 1. `src/pages/konto.astro` — `prerender = false`, redirects to `/anmelden?next=/konto`
>    when signed out. This is the tier's proof that server-side guarding actually works:
>    the redirect must happen **before any HTML is sent**, not in a client script. Shows
>    display name, weekly goal, Google email/avatar, and last sync time.
>    Add the "Einstellungen" row to `NavAccount.astro` that its comment says to add
>    "when the page does" — the page now does.
> 2. **DSGVO, non-optional — DeutschAcademy serves learners in Germany.**
>    - **Datenexport**: a button producing a JSON file of every `user_state` row for that
>      learner.
>    - **Konto löschen**: deletes the auth user and, by the `on delete cascade` in the
>      Tier 2 migration, every row with it. Requires typed confirmation. State plainly in
>      the UI that it cannot be undone.
>    - A short `docs/auth-datenschutz-v1.md` listing exactly what is stored, where
>      (Supabase, EU/Frankfurt region), and for how long. Facts only — no invented policy
>      language, and no legal claims this project cannot stand behind.
> 3. Email sign-in as the fallback for learners without a Google account: fill the seam
>    left in `SignInCard.jsx` at Tier 1 with magic-link and password modes, porting the
>    logic from Colevitate's `SignInCard.tsx` (including `resetPasswordForEmail` and the
>    `type=recovery` branch its callback route handles) — rebuilt in this project's styles
>    and in German.
> 4. A `<GuestSaveNotice>` equivalent: on `/dashboard` and `/fortschritt`, a signed-out
>    learner with real local progress sees one honest, dismissible line — their progress
>    lives only in this browser, and signing in keeps it. Do not nag, do not block
>    anything, do not show it to someone with no progress yet. Colevitate has
>    `src/components/auth/GuestSaveNotice.tsx` as a reference for placement and tone.

**Definition of Done:**
- Visiting `/konto` signed out redirects server-side — confirm with `curl -I` that the
  302 comes back with no HTML body, and paste the result into the note.
- Export produces valid JSON containing every synced key.
- Account deletion removes the auth user and all `user_state` rows; verify in the Supabase
  dashboard and state it.
- Magic link and password reset both deliver through Brevo and complete.
- `docs/auth-sso-tier4-v1.md` plus `docs/auth-datenschutz-v1.md`.

---

## Decisions (settled before this prompt was written)

- **Hybrid Astro, not a Next.js port.** Porting 66 Astro pages and ~30 vanilla JS modules
  to React buys nothing over hybrid for authentication, costs the zero-JS default on
  content pages, and makes the lexicon/content-collection pipeline a reimplementation.
  The Next.js option stays on the table only for a future where most pages become
  per-learner — a schools/licensing product — and even then a separate app sharing one
  Supabase is likely to beat a port.
- **React for auth surfaces only.** Sign-in card, nav status, account page. Nothing else.
- **Cookie sessions via `@supabase/ssr`**, so prerendered pages and server routes read one
  session, not two.
- **Local-first stays.** `localStorage` is the working copy; Supabase is the mirror. A
  signed-out learner loses nothing and gains no network traffic.
- **One generic `user_state` table**, not a column or table per feature.
- **Supabase EU (Frankfurt) region**, fixed at project creation — see the console checklist.

## Open decisions this prompt does NOT resolve (flag to Edgar, don't guess)

- Whether signing in should **offer** to merge guest progress or merge it silently. Tier 2
  assumes silent merge because the rules never destroy data; if that ever changes, it
  needs a prompt.
- What happens to a learner's data when a Free-plan Supabase project **pauses after a week
  of inactivity**. Tiers 2–4 assume the project is awake. The failure mode is not designed
  and must not be faked.
- Whether `/dashboard` and `/fortschritt` should become `prerender = false` for
  server-rendered personalisation, or stay prerendered and hydrate. Tier 4 leaves them
  prerendered. Revisit only with a measured reason.
- Whether teacher/school accounts (roles, seats, assignments) are coming. If yes, the
  `user_state` shape is still fine, but auth gains an org layer that none of these tiers
  designs. Do not pre-build it.

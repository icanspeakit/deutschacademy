# DeutschAcademy auth/SSO Tier 1 v1 (2026-09-22)

Google sign-in and magic-link sign-in, end to end. No progress syncing — signing in, showing
who is signed in, and signing out is the whole scope. Tier 1 of `AUTH-SSO-TIERED-PROMPT.md`,
building on `docs/auth-sso-tier0-v1.md`.

Two things in here need a decision and are not just notes: **the React runtime now reaches
every content page**, and **`pnpm build` cannot finish on this Windows machine**. Both are
below under "Still open", with numbers.

## What was built

- **`src/middleware.js`** — refreshes the session for on-demand routes and puts the user on
  `context.locals.user`. Uses `getUser()`, never `getSession()`.
- **`src/pages/auth/callback.ts`** — the PKCE `?code=` return from Google and from the magic
  link, with the open-redirect guard on `next`. Deletes nothing else; Tier 0's
  `src/pages/auth/ping.ts` was removed as this tier's first step.
- **`src/pages/auth/abmelden.ts`** — POST-only sign-out, 405 on anything else.
- **`src/components/auth/SignInCard.jsx`** — Google, **email + password (sign in and
  register)**, and magic link, on a Passwort/Magic-Link segmented control. Logic ported from
  Colevitate; none of the chrome.
- **`src/components/auth/NewPasswordCard.jsx`** + **`src/pages/passwort-neu.astro`** — where
  a reset link lands. `prerender = false`; redirects to `/anmelden` without a session.
- **`src/components/auth/AuthStatus.jsx`** — the account control, in two variants: `nav`
  (round avatar + menu) and `drawer` (a full-width row).
- **`src/components/auth/useT.js`** — translation for React islands.
- **`src/pages/anmelden.astro`** — `prerender = false`, redirects an already-signed-in
  visitor, `noindex`.
- **`src/styles/auth.css`** — every colour a token from `global.css`, so dark mode is free
  and this file has no dark-mode block.
- **57 new keys × 5 locales.** `node scripts/validate-i18n.mjs` green: 1298 keys, keys, order
  and placeholders all match `de.json`.

## The nav mount: three components, not one

The tier prompt says to mount the island in `NavAccount.astro`, "already rendered by
`SiteNav.astro`". **Neither half of that is true any more**, and following it literally would
have shipped a sign-in button that nothing renders.

`NavAccount.astro` is orphaned — nothing in `src/` imports it. The avatar was taken out of
`SiteNav.astro` at some point before this tier, on the reasoning recorded in that file: the
monogram fronted an account system that did not exist, its menu held exactly one thing (the
theme toggle), and a monogram is a poor sign for "light or dark". The toggle took the slot.

So the island went where the markup actually is, and it needed **three** mounts, not one:

| component | who renders it | what it gets |
|---|---|---|
| `SiteNav.astro` | homepage and marketing routes | `<AuthStatus client:idle />` |
| `PracticeHeader.astro` | **every practice page** — the bulk of the site | `<AuthStatus client:idle />` |
| `NavDrawer.astro` | every page, ≤1080px | `<AuthStatus client:idle variant="drawer" />` |

`PracticeHeader` was found by checking, not by reading: after the first two mounts,
`/uebungen`, `/pruefungen` and `/uebungen/grammatik/passiv` still had no account control on
desktop, because practice pages use their own bar. Without it a learner could sign in on the
homepage and then see no trace of it anywhere they actually study.

**The drawer mount is the one that matters most.** `.lp-acct` is `display: none` below
1080px and `.practice-header-utils` below 900px — so on a phone the desktop clusters do not
exist, and this audience is overwhelmingly on phones. The drawer is the main path here, not
the fallback.

`NavAccount.astro` was left in place with its comments rewritten to say plainly that nothing
renders it and where the live version now is. It is kept only because its menu markup and
keyboard handling are worth reading before Tier 4 builds the account rows — with a note to
delete it if Tier 4 builds those in the island instead.

## The signed-out control is a word, not a monogram

First pass put the signed-out state in the avatar circle, so the cluster would not change
width when someone signed in. Looking at it on the running site killed that: a teal disc in
the nav says nothing, and the one visitor this control exists for is the one who has never
signed in and does not know it is there.

It is a labelled pill now — an arrow-into-door glyph and the word **Anmelden** — and the
avatar is kept for the signed-in state, where a circle for "you" is the right shape because
there is a you. This is the same objection the repo already recorded when the old monogram
was pulled out of `SiteNav.astro`; it applies twice as hard to a sign-in affordance.

Quiet styling on purpose: `Kostenlos üben` is the primary CTA two slots to its left, and two
filled pills in one cluster is two things claiming to be the main action. Below 1240px the
cluster gets tight and **the icon drops, never the label** — hiding the word would turn it
back into the unlabelled glyph it exists to replace.

## Password sign-in, registration, and the reset that has to land somewhere

Added after the first pass, on request, matching Colevitate's card. Three methods now, on a
segmented control rather than stacked forms — two email forms on screen at once is two submit
buttons a learner has to choose between before knowing what either does.

**Password is the default tab.** It is what most people mean by "an account", and it is the
only method that works on the first try when the confirmation mail is slow or filtered.

Four decisions worth keeping:

- **One error for both wrong password and no such account.** `auth.error.credentials` says
  "E-Mail oder Passwort stimmt nicht." Distinguishing them would turn the form into a way to
  find out which addresses have accounts here.
- **Minimum 8 characters, not Supabase's default 6.** Two more characters cost a learner
  nothing and this is the whole account.
- **`autoComplete` flips between `current-password` and `new-password`** with the mode. Get
  it wrong and a password manager either offers to save a new entry on every sign-in or never
  offers to generate one.
- **Signup handles both outcomes.** With email confirmation on, `signUp` returns no session
  and the learner gets the "bestätige deine E-Mail" ending. If confirmation is ever switched
  off in Supabase, a session comes back and they are simply signed in — both paths are
  written, rather than assuming the current setting is permanent.

**A reset link needs somewhere to go, so `/passwort-neu` exists.** This is the part that is
easy to leave out and broken without: `resetPasswordForEmail` signs the learner in like any
other link, so landing them on the homepage means they are logged in with a password they
could not remember and still cannot change. `/auth/callback` now checks `type=recovery` and
forwards there; the page itself is `prerender = false` and redirects anyone without a session
to `/anmelden`, because with no session there is nothing to update and a form that cannot
work is worse than a redirect. Verified: `/passwort-neu` → `302 /anmelden` signed out.

**Three separate "check your email" endings**, not one flag — sign-in link, account
confirmation, password reset. Collapsing them is how people get told to confirm an account
they already have.

One bug found by clicking through it rather than reading it: switching to Magic-Link while
the password form was in signup mode left the card titled **Konto erstellen** above a form
that creates nothing. `signup` is now scoped to the password tab.

## No flash of signed-out UI

Three parts, and the split between them is the point:

1. **`Layout.astro`, third `is:inline` script**, after theme and language and in their style.
   It tests only that a cookie matching `sb-…-auth-token` *exists* and sets
   `<html data-auth="in|out">` before first paint. It does not parse the cookie and must
   never start to.
2. **`AuthStatus.jsx` renders the signed-out control as its initial state** — including in
   the HTML prerendered into all 670 pages. That is the right guess for most visitors and
   the only thing that renders with JavaScript off, where "Anmelden" pointing at a working
   route beats a dead placeholder circle.
3. **`auth.css` hides that guess** under `:root[data-auth="in"] .da-auth-guess`, using
   `visibility` rather than `display` so the slot keeps its width and nothing shifts when the
   confirmed state replaces it.

**None of this is a security boundary, and the comments say so in all three files.** A forged
cookie buys you a hidden sign-in link. `getUser()` — in the middleware and in the island —
decides who is actually signed in. With JavaScript off the attribute is never set, the
fallback stays visible, and it keeps working.

## The open-redirect guard

`next` survives the round trip through Google untouched, so it is attacker-controlled on the
way back. Both `/auth/callback` and `/anmelden` apply the same test:

```js
rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/"
```

The second clause is not redundant. `//evil.example` is a protocol-relative URL that every
browser reads as another origin, and it starts with a slash. Without it, a link like
`/anmelden?next=//evil.example` would bounce a learner off-site *carrying a fresh session*.

Verified against the running dev server:

| request | result |
|---|---|
| `/auth/callback?code=…&next=https://evil.example` | `302 → /anmelden?fehler=auth` |
| `/auth/callback?code=…&next=//evil.example` | `302 → /anmelden?fehler=auth` |
| `/auth/callback` (no code) | `302 → /anmelden?fehler=auth` |
| `/anmelden?next=https://evil.example` | renders; **zero** occurrences of `evil.example` in the HTML |
| `/anmelden?next=//evil.example` | renders; **zero** occurrences of `evil.example` in the HTML |

The `/anmelden` rows are the stronger evidence of the two. The callback rows all bounce for
the same reason — the code was bogus — so they exercise the failure path rather than proving
the guard; the `/anmelden` rows show the hostile `next` being dropped before it can reach the
island's props.

## Verified, and how

- **670 prerendered pages, byte-for-byte the same list as before Tier 0.** Captured and
  diffed by path, not counted. (The paths now sit under `dist/client/` — the adapter's
  layout, not a change in what is built.)
- **No `Astro.request.headers` warnings.** The first build had one per prerendered page,
  because middleware also runs at build time; `context.isPrerendered` now guards it. Without
  that guard the build would have made one Supabase round trip per page — 670 of them — to
  ask who is signed in during a build where nobody is.
- **Routes**, on `astro dev`: `/anmelden` 200 · `/auth/abmelden` GET 405 · `/auth/ping` 404
  (Tier 0's proof route, correctly gone).
- **The island renders on all three bars**: `/`, `/uebungen`, `/pruefungen` and
  `/uebungen/grammatik/passiv` each carry exactly one
  `class="lp-acct-btn da-auth-btn-link da-auth-guess"`, plus the drawer row.
- **i18n**: `validate-i18n.mjs` green across 5 locales.

**Not verified, and it cannot be from here:** nobody has actually signed in. Completing a
real Google round trip needs the deployed site, because the redirect URI registered with
Google points at Supabase and back at a real origin. The same goes for the magic link, which
additionally needs Brevo. Everything above tests the routes, the guards and the rendering —
not the flow end to end. **Do not read this note as "sign-in works".**

## Still open — two things that need your decision

### 1. Every content page now downloads React: 17 KB → 234 KB

Measured on `/uebungen`:

| | before Tier 1 | after |
|---|---|---|
| JS referenced by the page | 17,132 B raw | **233,838 B raw** |
| the React runtime | not referenced | 213,020 B raw · **65,604 B gzipped** |
| `AuthStatus` itself | — | 3,686 B raw · 1,407 B gzipped |

Tier 0's note recorded that the React runtime was emitted but referenced by zero pages. It is
referenced by all of them now, because the account control lives in the nav and the nav is on
every page. `client:idle` keeps it off the critical path — it downloads after the page is
interactive — but on a phone on mobile data it is still ~66 KB more per page than this site
has ever shipped.

This is in tension with a principle the codebase states outright: *"the zero-JS default on
content pages is load-bearing"*. It is not an accident or a mistake in the implementation —
the architecture section of the tier prompt settles on React islands for "sign-in form, nav
account state, account page", and nav account state is on every page by definition. I built
what was specified and am flagging the bill rather than quietly picking a different
architecture.

**The alternative, if 66 KB per page is too much:** keep React for `/anmelden` only, where it
is one page and the interactivity is real, and rewrite `AuthStatus` as a vanilla script in
the existing `.astro` components — the same pattern every other interactive thing in this
repo already uses. It reads the same cookie-backed session through `@supabase/supabase-js`,
which is far smaller than React plus the renderer. Say the word and I will do it; it is
maybe an hour, and it is much cheaper now than after Tier 4 has built an account page on the
React path.

### 2. `pnpm build` fails on this machine at the last step

```
EPERM: operation not permitted, symlink '.pnpm\react@19.3.0\node_modules\react'
  -> '…\.vercel\output\functions\_render.func\node_modules\react'
```

**The site builds fine — all 670 pages render and the client bundle is complete.** The
failure is the very last step, where `@astrojs/vercel` assembles the serverless function by
symlinking pnpm's nested dependencies into it.

Cause, confirmed by testing directly: Windows Developer Mode is off on this machine, so
creating a *directory symlink* needs elevation. (A junction works; `fs.symlink(…, "dir")`,
which `@astrojs/internal-helpers` uses, does not.) Tier 0 did not hit this because no island
existed, so React was never traced into the server bundle — this tier is what pulled it in.

**It will not affect Vercel**, which builds on Linux. It does mean local `pnpm build` exits
non-zero from here on. Two ways out:

- **Turn on Windows Developer Mode** (Settings → System → For developers). One-time, needs
  admin, no repo change. This is the one I would pick.
- **`node-linker=hoisted` in `.npmrc`** — a flat `node_modules` has no symlinks to copy, so
  the adapter falls back to copying files. It works, but it changes install semantics for the
  whole project and costs disk.

I did not do either: the first is a machine setting that is yours to make, and the second is a
project-wide change I would not make on my own to work around a local-only problem.

### 3. The site still advertises "ohne Konto" in three places

Not a bug, and not something to quietly rewrite — it is a positioning question:

- `src/components/LevelFold.astro:97` — `Kostenlos · ohne Konto`
- `src/pages/front.astro:78` — `Kostenlos, ohne Konto — von Lehrkräften, die wirklich unterrichten.`
- `src/pages/einstufungstest.astro:36` — in the page description

Both can be true — the site works signed-out and an account only adds cross-device sync —
but "ohne Konto" next to an **Anmelden** button reads as a contradiction unless the copy says
which one is optional. `/datenschutz` already words it correctly ("DeutschAcademy funktioniert
ohne Konto. Wenn du kein Konto anlegst, …") and is a good model. Your call; I changed nothing.

### 4. Carried over, still open

- **Brevo SMTP is not confirmed live, and three of the four methods now depend on it.**
  Magic link, account confirmation on signup, and password reset are all emails. Only Google
  and password *sign-in* (for an already-confirmed account) work without it. Supabase's
  built-in mailer is rate-limited and not for production, so until Brevo is live, registration
  is effectively untested and unusable at any volume. This got more important when password
  signup was added, not less.
- **The OAuth client secret** still has not been rotated after passing through a chat
  transcript.
- **Nothing is deployed.** The `_render` function has never run in production.

## Not done in this tier — deliberately

- No Supabase table, no RLS policy, no migration. No learner data is read or written.
- `src/lib/progress.js` untouched. `getResume({ remote })` is still always local, and its
  comment is still true. That seam is Tier 2's.
- Password sign-in, registration and reset were pulled forward from Tier 4 on request and
  are done. What is still Tier 4: the account page / `/konto`, and deleting an account.

## Files changed

**New:** `src/middleware.js`, `src/pages/auth/callback.ts`, `src/pages/auth/abmelden.ts`,
`src/pages/anmelden.astro`, `src/pages/passwort-neu.astro`,
`src/components/auth/SignInCard.jsx`, `src/components/auth/AuthStatus.jsx`,
`src/components/auth/NewPasswordCard.jsx`, `src/components/auth/useT.js`,
`src/styles/auth.css`, `docs/auth-sso-tier1-v1.md`.

**Deleted:** `src/pages/auth/ping.ts` (Tier 0's proof route, as planned).

**Modified:** `src/layouts/Layout.astro` (the pre-paint script), `src/components/SiteNav.astro`,
`src/components/PracticeHeader.astro`, `src/components/NavDrawer.astro` (mounts + imports),
`src/components/NavAccount.astro` (comments only — it renders nowhere), and the five
`public/i18n/*.json`.

Unrelated uncommitted work in the tree — `src/pages/fortschritt.astro`,
`src/pages/uebungen/artikel-trainer.astro`, `src/styles/verben-praepositionen.css`, the
deleted `.t/` scratch files, `AUTH-SSO-NEXT-STEPS-PROMPT.md`,
`docs/monetization-strategy-v1.md` — was left alone and must not be swept into a commit with
this.

## Then

Deploy, sign in with a real Google account, and only then believe it works. After that,
Tier 2: the `da_progress_v1` mirror through the `getResume({ remote })` seam.

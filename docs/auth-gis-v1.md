# DeutschAcademy auth — Google sign-in via GIS ID token v1 (2026-09-23)

Google sign-in no longer redirects through Supabase. It uses the Google Identity Services
(GIS) **ID-token flow**: Google's button on `/anmelden` hands back a signed ID token, and
`supabase.auth.signInWithIdToken` verifies it. The browser never leaves the site, so the
consent screen can no longer read "to continue to `putrkafrcpqosqxrgttp.supabase.co`".
Built from `AUTH-GIS-PROMPT.md`, on top of `docs/auth-sso-tier1-v1.md`.

**It will not work until three console/env steps are done** (below, "What Edgar must do").
A failed first test before then is expected, not a bug to chase.

## What changed

- **New `src/components/auth/GoogleSignInButton.jsx`** holds the entire Google path:
  - It injects `https://accounts.google.com/gsi/client` on mount, removes it and calls
    `google.accounts.id.cancel()` on unmount.
  - It calls `initialize` with a hashed nonce and `renderButton` into a slot.
  - On Google's callback it runs `signInWithIdToken({ provider: "google", token, nonce })`,
    then navigates to `next`.
- **`src/components/auth/SignInCard.jsx`**: `signInWithGoogle` / `signInWithOAuth`, the
  `googleLoading` state and the inline `GoogleMark` SVG are gone. The old
  `da-auth-btn--google` button is replaced by `<GoogleSignInButton next signup onError t />`.
  **Nothing else in the file changed.** Password sign-in, sign-up (including the two-step
  onboarding already in the working tree), magic link and reset are untouched, and
  `callbackUrl()` still serves them.
- **`src/styles/auth.css`**: `.da-auth-btn--google` and `.da-auth-gmark` are removed, since
  nothing renders them now. They are replaced by `.da-auth-gis*`, which is only a wrapper.
  - It centres Google's iframe and reserves its 44px height before the script arrives, so
    there is no layout jump.
  - It holds the "Einen Moment …" spinner while Supabase verifies the token.
- **New env var `PUBLIC_GOOGLE_CLIENT_ID`**, added to `.env.local` (gitignored) with the
  existing client ID `275259116185-ui85…apps.googleusercontent.com`. It is public by design:
  it ships to the browser inside Google's button either way.
- **Not touched:** `src/pages/auth/callback.ts`, `src/pages/auth/abmelden.ts`,
  `src/middleware.js`, `src/components/auth/AuthStatus.jsx`. `git diff` against HEAD is
  empty for the first three. `AuthStatus.jsx` has uncommitted changes from earlier today,
  and none of them are from this work.

### The nonce: which value goes where

`makeNonce()` returns a pair, and each value has one destination:

| value | goes to | why |
|---|---|---|
| `hashed`: hex SHA-256 of `raw` | **Google**, `initialize({ nonce })` | Google copies it into the token's `nonce` claim |
| `raw` | **Supabase**, `signInWithIdToken({ nonce })` | Supabase hashes it and compares it with the claim |

Swapping them fails with a nonce-mismatch error that does not say which side is wrong, so
the code comments both lines. A token's nonce is single-use: a failed attempt re-runs
`initialize` with a fresh pair before the next click. **Supabase's "skip nonce check" was
not touched.**

### The open-redirect guard

`next` is re-checked in the button with the same shape as `callback.ts`:

```js
next.startsWith("/") && !next.startsWith("//") ? next : "/"
```

`/anmelden` already strips a hostile `next` before it reaches the island, so this is the
second check, not the only one.

## What visual control was lost on the button

The ID-token flow only permits Google's own rendered button (or One Tap). Faking our button
on top of Google's was ruled out by the prompt and by Google's terms, and was not done.

**Still ours**, via `renderButton`:
- **Locale**: from `da_lang`, and it re-renders when the language switcher fires.
- **Theme**: `outline` in light mode, `filled_black` in dark mode. It follows the
  `<html data-theme>` toggle live.
- **Size**: `large`.
- **Shape**: `pill`, which matches our pill buttons.
- **Text variant**: `signin_with`, or `signup_with` in register mode.
- **Width**: the card's width, clamped to Google's 200–400px range.
- **Logo alignment**: `center`.

**Lost:**
- **The label is Google's wording**, in Google's translation. Our `Mit Google anmelden` /
  `Mit Google registrieren` strings (`auth.google`, `auth.google.signup`) are no longer
  shown. Those keys and `auth.google.loading` are now unused. I left them in the five i18n
  files; deleting them is a separate cleanup.
- **Height is 44px, not our 48px.** `large` is Google's biggest size, so the button sits
  4px shorter than "Anmelden" below it. It still clears WCAG 2.5.8 (24px minimum), but it
  loses the 48px rationale written in `auth.css`.
- **Font, border colour, hover shadow and press animation are all Google's.** It is an
  iframe, so no CSS in `auth.css` reaches inside it.
- **Dark mode is Google's black, not our `--surface-card`.** On the dark card it reads as a
  slightly darker pill with no border.
- **Widths above 400px are impossible.** The card is narrower than that today, so nothing
  is visible yet, but a wider card would leave the Google button short of the other buttons.
- **No spinner inside the button.** While Supabase verifies, the button is swapped for our
  spinner row instead.

## Verified, and how

On `astro dev`, in Chrome:

- **`/anmelden` renders Google's button** inside the existing card: GIS iframe from
  `accounts.google.com`, `hl=de`, `theme=outline`, `width=354`. Toggling dark mode switches
  it to `filled_black`. Screenshots were taken of both.
- **The GIS script loads on `/anmelden` only.** Checked with the browser's Resource Timing
  log (`performance.getEntriesByType("resource")`), which lists what the page actually
  fetched:

  | page | `accounts.google.com` resources | `window.google` |
  |---|---|---|
  | `/anmelden` | `gsi/client`, `gsi/style`, `gsi/button` | defined |
  | `/uebungen` | **none** | `undefined` |

  The Chrome extension's network-request reader missed the `/anmelden` requests too, so it
  was not used as evidence either way.
- **The built output agrees.** In `dist/client`, 0 prerendered HTML files reference
  `accounts.google.com/gsi`. The GIS code lives only in the `SignInCard` chunk, which only
  the on-demand `/anmelden` route loads.
- **The routes the other methods depend on are unchanged:**

  | request | result |
  |---|---|
  | `/auth/callback` (no code) | `302 → /anmelden?fehler=auth` |
  | `/auth/callback?code=bogus&next=//evil.example` | `302 → /anmelden?fehler=auth` |
  | `/passwort-neu` (signed out) | `302 → /anmelden` |
  | `/auth/abmelden` GET | `405` |

- **Magic link, password and reset:** those call sites are the same as before this change
  (`signInWithPassword`, `signUp`, `signInWithOtp`, `resetPasswordForEmail`, all still using
  `callbackUrl()`), and the forms render.
- **`pnpm build`**: every page built. It then failed at the known `@astrojs/vercel` `EPERM
  … symlink` step (Windows Developer Mode, see the Tier 1 note), which this change does not
  affect.

**Not verified, and it cannot be from here:**

- **No one has signed in with Google through the new flow.** It needs the JavaScript origins
  below. Until then Google serves a generic button: it rendered "Sign in with Google" in
  English even with `hl=de`, and also for `tr` and `ar` in a test render. That is the
  expected symptom of an unregistered origin; recheck the German label once the origins are
  saved.
- **So the nonce has not been proven end to end.** The code follows Supabase's documented
  pattern. If the first real sign-in fails with a nonce error, that is the stop condition in
  the prompt: report it, do not enable "skip nonce check".
- **Magic link, password sign-in and reset were not run end to end.** They need a real
  inbox, an existing account's password and a live SMTP sender (Brevo, still unconfirmed per
  Tier 1). The unchanged code and routes are evidence they still work, not proof.

## What Edgar must do (the code depends on these)

**Status 2026-09-23, evening: steps 1–3 are done.**
- **Step 1:** both origins were saved on `deutschacademy-web` (Google confirmed "OAuth
  client saved"), and the Supabase redirect URI was kept.
- **Step 2:** needed no change. Supabase's Google "Client IDs" field already held the client
  ID, and "Skip nonce checks" is off.
- **Step 3:** `PUBLIC_GOOGLE_CLIENT_ID` was added through the Vercel CLI for all three
  environments, and the value was read back to check it. It reaches the live site with the
  next deploy.

1. **Google Cloud → Google Auth Platform → Clients → `deutschacademy-web`**
   - **Authorised JavaScript origins**: add both of these, exactly as written:
     - `https://deutschacademy.com`
     - `http://localhost:4321`
   - **Authorised redirect URIs**: **leave**
     `https://putrkafrcpqosqxrgttp.supabase.co/auth/v1/callback` in place. The new flow does
     not use it, but it is harmless, and removing it breaks the old flow instantly if this
     change ever has to be reverted.
2. **Supabase → Authentication → Providers → Google**: keep it enabled with the same client
   ID and secret. If the panel has an **Authorized Client IDs** field, put the same client ID
   in it. The ID-token flow checks the token's `aud` against that list.
3. **Vercel → Project → Settings → Environment Variables**: add `PUBLIC_GOOGLE_CLIENT_ID` =
   `275259116185-ui85tfjnivl9j8s0htl20v8omi328720.apps.googleusercontent.com` for
   Production, Preview and Development. Without it the deployed `/anmelden` shows
   "Anmeldung mit Google nicht möglich" and logs `PUBLIC_GOOGLE_CLIENT_ID is not set`.
   - Preview deployments on `*.vercel.app` URLs are separate origins. Google sign-in will
     not work there unless each one is also added in step 1. Google does not accept
     wildcards.
4. **JavaScript origin changes can take a few minutes to propagate.** A failure right after
   saving usually means "wait", not "broken".

Then test, in this order:
- **Google** on `localhost:4321/anmelden`: the label should turn German, the popup should
  name DeutschAcademy / localhost and not the Supabase host, and you should land back on
  `next`.
- **Password sign-in, magic link, and "Passwort vergessen?" → `/passwort-neu`.**
- **Sign out from the nav**, to confirm `AuthStatus` still flips both ways.

## Follow-ups, deliberately not done

- **One Tap stays off.** `prompt()` is never called. One Tap goes through FedCM and
  third-party-cookie behaviour that differs per browser; that is its own job.
- **The three unused `auth.google*` i18n keys** could be deleted.
- **Still open from Tier 1, unchanged:** React on every page (~66 KB gzipped), local
  `pnpm build` EPERM on Windows, and "ohne Konto" in three places.

## Files changed

**New:** `src/components/auth/GoogleSignInButton.jsx`, `docs/auth-gis-v1.md`.
**Modified:** `src/components/auth/SignInCard.jsx` (Google path only),
`src/styles/auth.css` (Google button rules → `.da-auth-gis*`), `.env.local` (one line,
gitignored).

Both modified files already had uncommitted work from earlier today: the signup onboarding
step in `SignInCard.jsx` and assorted rules in `auth.css`. That work was left as it was, so
a commit of this change has to pick hunks, not whole files. Nothing was committed.

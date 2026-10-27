# Google sign-in through the official browser button

LINEUP remains a fully static Next.js export at **https://dailylineup.co.uk/**, published by GitHub Pages from **main /docs**. This authentication change replaces the hosted Google OAuth redirect with Google's official Google Identity Services (GIS) button and popup/callback credential flow. It does not change the game, question examples, account data, result saving, statistics, streaks, hosting, DNS or database policies.

## What changes and why

The previous `signInWithOAuth` flow sent Google back through Supabase's hosted callback. That Supabase domain could therefore appear in Google's sign-in interface. The new flow loads **https://accounts.google.com/gsi/client**, renders Google's own button using its supported appearance options, receives a Google **ID token** in the credential callback and sends it to the existing Supabase browser client:

```ts
supabase.auth.signInWithIdToken({
  provider: 'google',
  token: credential,
  nonce: originalNonce,
})
```

The browser generates a random nonce using Web Crypto. Google receives its SHA-256 hexadecimal hash; Supabase receives the corresponding original nonce. The prepared attempt keeps these values in memory and rejects duplicate, stale or unusable credential callbacks. Supabase validates the token and nonce and establishes the session. The application does not decode an ID token as proof of identity, implement JWT verification, send an OAuth access token in its place or introduce a server callback route.

Players actively choose the official button. The application does not request One Tap or automatically open a Google prompt. Signing out retains the existing Supabase sign-out handling and disables Google's automatic selection when its library is available. Guests can still play Daily and Practice, browse questions, finish, share and resume local Daily progress without Google or Supabase.

Google controls its chooser and browser-mediated interface. **The exact wording, LINEUP name/logo and chooser appearance remain unverified until a real browser test on the configured live domain.** This implementation cannot promise that Google will display a particular phrase.

## Public build configuration

The project-root `.env.local` must contain these three public browser values:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_public_key
NEXT_PUBLIC_GOOGLE_CLIENT_ID=123456789012-your_existing_web_client_id.apps.googleusercontent.com
```

Use the existing LINEUP Google OAuth **Web Client ID**, not a client secret. Keep the existing Supabase project URL and publishable key. `.env.example` contains placeholders; `.env.local` remains ignored and must never be committed. These three values deliberately appear in the compiled browser JavaScript. Google Client Secrets, Supabase secret/service-role keys and database passwords must never enter this file, the browser bundle or the public repository.

Next.js substitutes these public values at **build time**. Run `npm run build:pages` after changing them. GitHub Pages serves the committed output and has no runtime environment configuration. The static-export checker verifies the configured public Supabase values and Google Web Client ID are valid/present in generated JavaScript without printing them. A build without account configuration remains suitable for guest play; a configured account build must include the Google Web Client ID.

## Google Cloud and Supabase checks — perform manually

No Google Cloud, Supabase, GitHub or DNS settings are changed by the application or by this implementation. No database migration is required for this authentication replacement.

1. Open the **existing LINEUP OAuth Web Client** in Google Cloud. Keep the existing project/client; do not create another merely to enable this flow.
2. Under **Authorized JavaScript origins**, include exactly **https://dailylineup.co.uk**. An origin has no URL path. For the usual local development server, add **http://localhost:3000** if needed. A static preview at `http://127.0.0.1:4173` or another host/port needs that exact separate origin if testing sign-in there; a localhost entry does not cover every loopback host or port.
3. Retain the existing Google authorized redirect URI **https://gjjbhlwurunsgzfpqulx.supabase.co/auth/v1/callback** for compatibility and rollback. The new GIS popup credential flow does not require an application `/auth/callback` route. Do not remove the existing Supabase URL allowlist entries automatically.
4. Confirm the same Supabase project's **Google provider remains enabled** and its accepted Google client IDs include the existing Web Client ID used in `.env.local`. If the provider supports a comma-separated list, preserve existing entries. Leave nonce verification enabled; **do not enable Skip nonce checks**. A Google Client Secret, where required by the provider's existing configuration, stays in Google Cloud/Supabase and is never copied into LINEUP.
5. Confirm Google's branding, audience/test-user restrictions and publication status permit the intended users. LINEUP's application name, logo, website and authorized domain are managed in Google Cloud; changing the browser code alone does not verify their approval or final display.

When more than one Google client ID is configured in Supabase, keep the Web Client ID first as described in its Google provider guide.

The original SQL migration and RLS policies stay unchanged. Existing deployments must not rerun or replace the results table for this login change. The historical [account report](player-accounts.md) describes the existing schema and its live-project RLS checks; its redirect-based login steps describe the previous implementation.

## Existing accounts, sessions and private data

The new flow uses the same Supabase client, project, Google provider and `lineup:auth:v1` session storage key. It does not create a second profile system, migrate users, link/unlink identities, clear persistent sessions or change the `daily_results` table. Supabase resolves the verified Google identity to its account; saved results still belong to that account's existing user ID. Guest-result saving remains explicit, and duplicate Daily submissions keep the original saved result.

That architecture preserves the existing provider relationship, but **same-user-ID and saved-history continuity still require the real existing-account test below**. A wrong Supabase project, different Google account or incompatible provider/client-ID configuration must be corrected before publishing. Do not attempt to repair a mismatch by creating/replacing users, changing result ownership or deleting account data.

Only completed Daily summaries sync. Unfinished Daily progress and Practice state remain in the same browser storage as before. Practice never contributes to saved Daily statistics or streaks. Account authentication errors must stay inside the account UI and must not block guest gameplay.

## Cancellation, restrictions and retries

Google's ID-button API does not expose the OAuth token/code client's `error_callback`, nor a precise popup-close/blocked callback. One Tap prompt notifications are not popup cancellation events. Consequently, a delayed credential can produce a neutral waiting/retry message rather than a claim that a particular browser failure was detected. A player can dismiss the account panel and keep playing. An unused button reuses its nonce/configuration across panel remounts. Resizing re-renders only the official button, without reinitializing GIS or replacing its nonce. An explicit retry prepares a fresh nonce and intentionally updates GIS configuration; the application must not repeatedly open prompts or submit duplicate credentials.

A blocked or failed GIS script, missing configuration, unavailable Web Crypto, missing/expired credential, nonce mismatch or failed Supabase exchange shows a recoverable account error. Browser privacy restrictions, extensions, popup policies and connectivity can still prevent login. Test those real browser conditions manually. Do not loosen nonce validation to work around a failure.

An SDK request already sent to Supabase cannot be reliably aborted by dismissing the panel or by a UI timeout. If it succeeds late, the existing authentication observer may still establish a session. Check the Account state before retrying; a late successful session is not proof that cancellation failed to erase private data. Signing out remains available, and guest game state stays local.

## Local checks and deployment

Before committing a completed change, run:

```sh
npm run lint
npm run typecheck
npm test
npm run audit:public
npm run build:pages
```

The final command rebuilds `/docs` from the static export and checks root assets, canonical/social URLs, crawler files, `.nojekyll`, public browser configuration and `docs/CNAME`. The CNAME must remain exactly `dailylineup.co.uk` followed by a newline. Serve `docs/` directly from an ordinary static server for the local root-path smoke test; no Node application server is required by production.

Automated callback tests do not prove a real Google login, Google branding, provider configuration or production account continuity.

After all checks pass and the source plus rebuilt `/docs` have been committed locally to **main**:

1. In GitHub Desktop, choose the LINEUP repository and confirm the branch is **main**.
2. Review the local commit and ensure `.env.local` is absent from its changed files.
3. Click **Push origin** only when ready to publish. Keep GitHub Pages publishing from **main /docs**; no repository settings or workflow change is needed.
4. Wait for GitHub Pages to serve the new files. This is a manual push/deployment; a local build or commit alone does not update the live site.

## Real-browser release test

Use an existing LINEUP Google account with saved Daily history for the continuity test. Keep any access/session tokens private; do not paste them into reports or screenshots.

1. Before publishing, sign in through the old live flow and record the existing Supabase **user ID** and a few history/statistics values using the authenticated user's account record or the owner's Supabase Authentication Users view. A user ID is an identifier, not an access token. Record the Google account being tested without publishing its email. Sign out normally.
2. After the manual push is live, open **https://dailylineup.co.uk/** in the same browser profile. Verify Daily, Practice, posters, question search/Browse and sharing remain available while signed out. Check a narrow mobile viewport as well as desktop.
3. Open Sign in. Confirm one official Google button appears and no One Tap/login prompt opens by itself. Click it and inspect the actual chooser/consent interface. Confirm the app name/logo/domain association is appropriate; do not assume particular wording. The LINEUP page should not navigate through Supabase's hosted OAuth callback.
4. Select the **same Google account** as before. Confirm the Account panel becomes signed in and existing Daily history, best result and streak/statistics values return. Compare the authenticated Supabase user ID with the recorded old ID. It must match, and Supabase must not contain an unexpected second user for this test. Stop publication/roll back manually if it does not; investigate configuration without deleting data.
5. Refresh the page, close/reopen it and confirm the persistent session and saved history remain. Test an existing guest Daily save offer: it must require explicit Save to account. A duplicate must retain the earlier account result. Do not alter the published Daily schedule to manufacture a test result.
6. Sign out. Confirm private account information disappears, Daily/Practice remain playable and Google does not immediately sign the player back in. Explicitly sign in again and recheck the same ID/history. Test a different Google account in a separate browser profile to confirm private histories do not cross.
7. Cancel the chooser, dismiss the account panel during a slow login and retry after the waiting message. Verify the UI stays usable without duplicate requests/prompts. If a delayed exchange succeeds, inspect Account state before retrying. Test denied consent, a blocked Google script, offline Google/Supabase, blocked popups and browser storage restrictions where practical. Guest play and existing local Daily progress must continue.
8. Repeat the successful path on mobile Safari/Chrome and desktop. Confirm popup/browser-mediated sign-in is usable without horizontal overflow or an obscured official button. Browser behaviour can differ and requires a real test.

Never log or share Google ID tokens, nonces, refresh/access tokens, raw session objects, private result rows or personal information while testing. Results are still submitted by a browser client; account authentication does not make LINEUP cheat-proof. Existing SQL/RLS isolation tests remain necessary for the actual Supabase project.

Official references: [Google button integration](https://developers.google.com/identity/gsi/web/guides/display-button), [GIS JavaScript reference](https://developers.google.com/identity/gsi/web/reference/js-reference), [Supabase Google ID-token/nonce guide](https://supabase.com/docs/guides/auth/social-sign-in/auth-google), [Supabase signInWithIdToken](https://supabase.com/docs/reference/javascript/auth-signinwithidtoken), [Supabase identity relationships](https://supabase.com/docs/guides/auth/auth-identity-linking).


## Recorded local verification — 27 October 2026

- ESLint and `npm run typecheck` passed.
- All **288 automated tests** passed, including the existing game/account/statistics/history tests and new script, nonce, callback, lifecycle, guest fallback, responsive-button and compiled-configuration regressions.
- `npm run build:pages` passed: a fully static export of 89 files, about 4.93 MB, copied into `/docs`. Root assets, canonical/social metadata, crawler files, `.nojekyll`, CNAME and all three compiled public account values passed validation.
- The public-source audit reported no credential or private-metadata findings; `.env.local` remains ignored.
- An ordinary static server at `http://localhost:3000/` loaded the generated site. The official Google button rendered once with one GIS script. The open panel resized between 320px, 375px and 1280px without horizontal overflow after fixing Google's fixed button width.
- Guest Daily question answering, local Daily resume, Browse Questions after the first question, Practice mode, film details, final guess and result/share controls worked in the local browser. Opening examples disappeared after the first question as before.
- No real Google account was selected. Actual chooser branding, nonce acceptance by the configured live provider, persistent login and same-user-ID/history continuity still require the real-browser checklist above. No remote settings, user data, database policies, DNS or deployment were changed.

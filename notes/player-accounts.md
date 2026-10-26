# Optional player accounts — 26 October 2026

LINEUP remains a static Next.js export at https://dailylineup.co.uk/, served by GitHub Pages from **main /docs**. Optional accounts use the official `@supabase/supabase-js` browser SDK. No Next API routes, server actions, middleware, SSR auth helper, application server, deployment workflow, payment, leaderboard or hosting change was added.

## Manual setup before publishing

1. In Supabase SQL Editor, paste and run the **entire** file [`supabase/migrations/20261026_daily_player_results.sql`](../supabase/migrations/20261026_daily_player_results.sql). It is a transaction that creates `public.daily_results`, constraints, grants and RLS policies. It intentionally fails if that table already exists rather than silently adopting unknown security settings. Review any existing-table conflict; do not delete existing data to force it through. This migration has **not** been run by Codex.
2. In **Authentication → URL Configuration**, confirm Site URL **https://dailylineup.co.uk/** and an allowed redirect URL **https://dailylineup.co.uk/**. The app always returns Google sign-in to this static root. No `/auth/callback` application route or wildcard is needed. For browser PKCE, the SDK exchanges the returned code itself and removes it from the URL.
3. Google is already configured according to the project brief. Confirm the provider remains enabled and its Google Cloud authorized callback is **https://gjjbhlwurunsgzfpqulx.supabase.co/auth/v1/callback**. Google client secrets stay inside Supabase/Google. If the Google OAuth app is still in Testing, only its approved test users can sign in until the owner completes Google's applicable publication requirements. Codex did not inspect or change these settings.
4. `.env.local` at the project root has the supplied **public** URL and publishable key, is mode600 and is gitignored. It is never committed. `.env.example` contains placeholders only. The static production build must be regenerated after any public config change; setting variables on GitHub Pages is not part of this architecture. A publishable key is intentionally visible to browsers. Never substitute a service-role/secret key or database password.

## Player experience and storage

The header has a quiet **Sign in / Account** control. The account panel offers **Continue with Google**, private name/email display, Sign out, statistics and history. Sign-in is always optional; it does not gate Daily, Practice, questions, guesses or sharing. Loading, timeout, OAuth, missing migration and network errors remain inside the account UI. The game never awaits account requests.

Existing Daily progress, Practice history/statistics and onboarding keys/logic are retained. Auth uses its separate `lineup:auth:v1` storage key, persistent sessions, automatic token refresh, browser PKCE and safe in-memory fallback when storage is denied. Restricted storage can lose sign-in/progress on refresh; a warning states that limit. Sign out affects the current browser's auth session and does not erase local guest gameplay.

A fresh accepted final Daily guess while signed in is submitted automatically. A restored result or a result completed as a guest is **offered**, never uploaded merely because sign-in happens. Compact summaries survive an OAuth round trip in `lineup:account:guest-results:v1`. **Save to account** is explicit for each queued result. A duplicate keeps the original account record and reports that fact; no upsert, update or deletion is used. Failed saves remain available for manual retry. Practice and in-progress games are never submitted.

New completion timestamps are captured when the result finishes. Older completed guest records have no historic completion timestamp in the original game schema: their timestamp is the first time the account layer observes/imports the completed result. The database also records its own immutable receipt time, `created_at`, so neither timestamp is presented as proof of play time. Full question/film progress remains local; only completed summaries sync. A second device sees account statistics, not an unfinished attempt from another browser. Shared-device users should sign out when finished; saving a local guest result to a different account always requires an explicit action.

## Result data and statistics

Rows contain user ID, frozen Daily ID/date/number, outcome, questions used, actual films remaining, actual deduction path and completion time. There is **no numeric points score in the existing game**, so none was invented. Best successful result means fewest questions in a win, with the earliest puzzle date breaking a tie. History retains outcome/questions/path/remaining context. User email/name are not copied into the results table or a public profile.

Statistics are derived from saved rows: Daily games played, wins, win percentage, current/longest winning streak, average questions in wins, best win and history. No duplicate counters or Practice totals are stored. A win streak requires consecutive puzzle-calendar dates. A loss or missed day breaks it; yesterday's winning streak remains active while today's Daily is unplayed. Date arithmetic and the open panel's refresh timer use **Europe/London** through the existing IANA helpers, including GMT/BST and 23/25-hour days. Future/malformed rows are rejected/ignored rather than counted. The account panel scrolls as one sheet and paginates history twelve rows at a time.

## Security model and limits

The SQL makes results private and immutable through the public API. The primary key `(user_id, puzzle_id)` and unique `(user_id, puzzle_date)` prevent duplicate completion. The user FK targets `auth.users` with account-deletion cascade. Authenticated clients receive only SELECT and limited-column INSERT, with `auth.uid() = user_id` RLS checks. Guests have no table privileges. UPDATE/DELETE privileges and policies are absent even for a user's own results. Clients cannot set server receipt time. Outcome, budget, path shape, count ranges, known puzzle identity/date and timestamps have database constraints. Schema failures produce recoverable account errors while guest play continues.

The migration is deliberately bounded to the current **365 frozen puzzles**, starting 20 October 2026. Extending the schedule later also requires a reviewed migration extending `daily_results_known_number`; do not shift published IDs or dates. The client validates queued/API data against the frozen schedule and replays canonical results before queuing. These checks prevent accidents, **not deliberate cheating**: clients and future answers can be inspected, and a signed-in user can fabricate an otherwise constraint-valid result. No claim of anti-cheat protection is made.

Owner-tagged UI state, request tickets and auth-event guards prevent late responses from a previous account from appearing in a newly signed-in account. Requests use auth JWTs and the publishable project key, never a service-role credential. No token, raw provider error, email or private row is logged. Sessions in localStorage carry the normal browser/XSS risk; treat third-party scripts and future HTML injection carefully. No analytics, realtime subscription or periodic database polling was added. Database reads happen on session availability/explicit retry or after saves; writes are at most new completions/explicit retries. This fits the intended small free-tier usage pattern, but quota limits, project pauses and future traffic remain Supabase operational concerns, not a promise of unlimited free capacity.

### Checks that require the real Supabase project

These cannot be proven by a local static build or by the SQL Editor's privileged owner session. After manually applying the migration, test through actual anonymous and authenticated client credentials:

- Anonymous SELECT/INSERT must be denied. The publishable key alone must not reveal rows or emails.
- User A inserts their own result and can read it. User B cannot read A's row or insert a row with A's user ID. Use two real sessions/profiles and verify results remain separate; a privileged SQL Editor SELECT bypasses the real client role test.
- Duplicate puzzle/date inserts fail without replacing the first result. UPDATE and DELETE must be denied, including an owner's own row.
- Invalid question counts, paths, puzzle number/date/ID combinations and future dates must fail constraints.
- Sign out, change accounts and switch tabs during a pending request: no earlier user's private history should appear. A network failure/missing table should show an account error while gameplay stays usable.
- Confirm Google login, session refresh/reopening, sign-out, OAuth cancellation and the redirect allowlist in the deployed origin. No real account authentication or live RLS/database execution was performed during local development.

## Publish and real Google-login test

1. Run the SQL and check the auth configuration manually as above. No GitHub source-setting change is needed: keep **Deploy from a branch → main → /docs**.
2. In GitHub Desktop, select the LINEUP checkout, confirm **main** and the completed local account commit, then click **Push origin**. Codex does not push or deploy.
3. Wait for GitHub Pages to serve the committed `/docs`, then open **https://dailylineup.co.uk/** in a private window. Confirm `CNAME` and root assets work and Daily/Practice remain playable without signing in.
4. Finish a guest Daily, refresh to confirm the local result, then choose Sign in → Continue with Google. Use the same browser tab to preserve the PKCE verifier. Google should return to the site root and show Account. Confirm no consentless guest upload; choose Save to account, check history/statistics and try another save to confirm the first result stays unchanged.
5. Sign out. Sign back in and confirm saved results persist. Complete another Daily while signed in (on a later scheduled date) and verify automatic saving. Test a loss, missed day and active unplayed today using controlled test accounts/data where appropriate; do not alter published puzzle identities.
6. Test a second account/profile for RLS isolation, a mobile screen, copied Daily/Practice links, blocked/offline account requests and guest play. Confirm no service-role/secret key in Network requests or generated files. Keep authentication tokens private.

## Implementation map

- `lib/account/client.ts`, `auth.ts`: browser SDK, configuration, safe sessions and race/error boundaries.
- `lib/account/results.ts`, `repository.ts`, `guest-results.ts`: canonical result conversion, INSERT-only sync and explicit guest queue.
- `lib/account/statistics.ts`: pure calendar-aware derived statistics.
- `components/account/player-provider.tsx`: account lifecycle independent of gameplay, private request ownership and optional controls.
- `components/account/account-panel.tsx`, `account.css`: the existing dialog pattern, private stats/history and understated account additions.
- `components/game/lineup.tsx`, `game.tsx`, `game-shell.tsx`, `result-dialog.tsx`: small optional account-control/completion hooks. The engine, schedule/catalogue data and guest persistence are unchanged.
- `app/page.tsx`, `layout.tsx`: provider and account-only stylesheet. `package.json`/lock add the official browser SDK.
- `scripts/check-static-export.mjs` and `audit-public-source.mjs`: verify public config in the static bundle, root/CNAME and absence of secret credentials.

References: [Supabase public keys](https://supabase.com/docs/guides/getting-started/api-keys), [browser Google OAuth](https://supabase.com/docs/guides/auth/social-sign-in/auth-google), [PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Final validation

Final validation passed locally:

- `npm run lint` and `npm run typecheck` passed without warnings/errors. **All 230 automated tests passed**, zero failures/skips. This includes the original 177-test suite plus 53 account tests covering auth state/session races, SSR guest independence, Supabase/schema/network failures and timeouts, INSERT-only duplicates, guest queue consent/persistence, canonical Daily conversion, private UI states, statistics/streaks and GMT/BST calendars.
- `npm run build:pages` passed with only static `/` and `_not-found` output. The frozen Daily catalogue/schedule guard passed. The rebuilt export has **89 files / 5,157,070 bytes (4.92 MiB)**. Root assets, CNAME, crawler/social metadata and `.nojekyll` passed; configured public Supabase URL/key were found in the browser JS without printing their values. No runtime film metadata API references were found.
- HTTP verification served **all 89 files successfully** from a plain loopback static server, with byte-for-byte equality to both `docs` and `out`. Root Daily and direct `?mode=daily` / `?mode=practice` URLs loaded. `docs/CNAME` remains exactly `dailylineup.co.uk` plus newline. `.env.local` is ignored/untracked, contains only the supplied public account variables and is not in the export.
- The final public-source/export audit checked **270 files** with no secret-credential/private-hosting findings; environment files remain ignored. `.env.example` uses placeholders. The new audit rejects Supabase secret-key patterns, and production checks reject secrets/private keys/database credential URLs.
- Browser guest play opened Daily **#007 / 26 Oct** without registration. Asking a question consumed one question and eliminated twelve films; refresh restored the same history/four questions left. Practice remained one tap away, and its Browse category sheet worked. Film details/cast and lock-in remained available. Guest completion showed the real failed result and `24 → 12` path plus an optional sign-in invitation; refresh retained completion and its queued save offer. That invitation opened a single account dialog with Continue with Google and explicit optional/guest-result text. Google authentication was deliberately not initiated against the live project.
- Responsive checks at **375px, 390px and 1440px** found no horizontal overflow, three mobile poster columns/six desktop, and compact 60px mobile/72px desktop headers. Narrow screens use an accessible account icon; desktop retains Sign in/Account text. The account modal uses one scroll surface. No browser warnings/errors were captured in the final production UI check. Screenshots are saved outside the repo/export. The temporary viewport, owned tabs and preview server were cleaned up.

The catalogue, 365 frozen Daily entries, question engine, Practice selection, guest storage, shared result values and existing global visual styles have no source changes. SQL migration/schema/RLS enforcement and real Google OAuth/session refresh remain **manual live-project checks**, as listed above. No migration was executed, no real account authenticated, and no push, deployment, remote setting or DNS change was performed.

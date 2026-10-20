# Daily LINEUP and question discovery — 20 October 2026

## What ships

Daily is the default at the existing `/lineup/` URL. A compact, keyboard-accessible **Daily / Practice** selector sits beside the wordmark and Help. The Daily toolbar shows the frozen puzzle number and short UK date. No Start step, account, new route or extra promotional panel is introduced. Practice remains unlimited at `?mode=practice`, with the existing selector, recency rules and randomness.

The committed schedule covers **20 October 2026–19 October 2027**, with **365 consecutive numbered puzzles and 365 distinct mystery films**. It contains ordered film IDs, one mystery ID and version references, not 365 copies of movie objects. The existing normalized catalogue is loaded once and shared by both modes. See [schedule maintenance](daily-schedule.md) and the [first-30 quality audit](daily-generation-audit.json).

Daily preparation reuses the existing Practice selection with a separate offline history. Five neighbouring boards exclude repeated films; longer recency penalties and the existing recognisability, title/family and question-quality checks remain. All boards have 24 distinct resolvable films. The first 30 contain 553 different films in 720 appearances, with no adjacent overlap; all 365 have at least 191 valid questions, six decades and 13 genres. Question ranking does not inspect the mystery answer.

## Frozen identities and maintenance

The browser resolves the scheduled ordered IDs and answer directly; it never generates a Daily from a date seed. Numbers belong to the schedule. Builds validate the schedule's initial prefix and the full normalized catalogue fingerprint. Removing/changing published-version movie records fails before publishing. This avoids duplicate metadata while protecting old puzzles. Future catalogue changes require retaining the published version through a deliberate version-preservation migration; simply repinning changed records is unsafe.

Run from the repository:

```sh
npm run check:daily
# Append to a total of 730 days; existing entries stay unchanged:
npm run generate:daily -- --days 730
# Alternatively append through an inclusive date:
npm run generate:daily -- --through 2028-10-19
npm run check:daily
npm test
npm run build:pages
```

`npm run generate:daily` alone is a no-op once the initial 365 days exist. `prebuild` invokes the read-only check, not generation. Launch is configured in `lib/data/daily-config.ts`; the separate maintenance guide explains explicit unpublished-only replacement before any public release. No daily deployment, cron job, workflow or network service is involved. Extend the schedule before 19 October 2027.

## UK midnight and rollover

`daily-date.ts` uses **Europe/London** through `Intl.DateTimeFormat`, independently of the browser's local timezone. The next midnight is the actual next IANA calendar boundary, including 23-hour spring and 25-hour autumn days. It is not a rolling 24-hour interval.

The controller checks at that boundary, on focus/visibility return and every minute for clock changes. An active old-date attempt stays intact with its original film/mystery identities and saved progress. A status message offers the new scheduled puzzle explicitly; it never silently replaces the current answer. Refreshing or selecting Daily after a date change opens the current scheduled day. Earlier records are retained. If the schedule is exhausted, the UI offers Practice without claiming a new Daily is ready. No unreliable countdown is shown.

## Progress and one final attempt

Daily uses **`lineup:daily:progress:v1:YYYY-MM-DD`**. Each compact record contains puzzle/date/number/version, canonical question IDs, returned answers and elimination IDs, active films, questions used/left, final guess/status and remaining films at the guess. It does not duplicate movie objects or put a hidden answer in the progress record.

Every accepted question/guess is saved synchronously before updating the display. Resume replays question IDs through the same canonical reducer and verifies every stored answer/count/elimination. Invalid JSON, obsolete schemas, incompatible identities and inconsistent facts hold the attempt with a clear message and a Practice option; they do not silently grant five fresh questions. Completed records reject further questions, guesses and restart actions. A saved completion wins over a stale tab/cache. Storage events synchronize open tabs, and each action rereads the latest record.

Daily also has a per-date in-memory cache, so mode switching preserves an attempt when browser writes are denied. A warning explains that it may not survive refresh. Practice keeps its own in-memory session while switching; a full Practice refresh starts a fresh board with the existing cooldown history, as before. Practice history/statistics keys remain unchanged, and Daily never updates them. Onboarding retains its separate existing versioned dismissal key; mode choice is represented by the URL, not a new tracking preference.

After completion, the result is shown and can be revisited. The board states that today's LINEUP is complete and offers **Play Practice**; there is no Daily New lineup or Play again action. Completed data remains available after reload. No guest streak, account sync or long-term Daily statistics dashboard was added.

## Results, sharing and Browse questions

The existing result design is retained with a Daily number label, actual questions used and actual deduction path/remaining-film context. Daily share text starts `LINEUP #001`, contains only outcome/counts and the canonical Daily URL. It excludes film titles, mystery IDs, questions and answers. Practice has no Daily number and links to `?mode=practice`. Native sharing, explicit copies, cancellation, permission failure and selectable manual fallback retain truthful feedback.

Browse questions is now a **full-width, 44px cobalt-outlined secondary button directly under search**, with a small arrow. Suggested questions have their own label below it. The existing first-use hint now explains browsing instead of adding another hint. The existing bottom sheet, categories, ten-question pagination, focus handling and validity filtering are unchanged. Both modes use the same autocomplete, browser, canonical evaluator, unknown-data suppression and five-question limit.

## Implementation map

- `lib/data/daily-config.ts` / `daily-schedule.ts`: launch, pins and compact committed schedule.
- `scripts/generate-daily.ts` / `scripts/daily/preparation.ts`: append-only offline preparation and quality verification.
- `lib/game/daily-date.ts`: UK calendar/reset helpers.
- `lib/game/daily-persistence.ts`: versioned validation, replay, synchronous writes and cache reconciliation.
- `components/game/lineup.tsx`: shared catalogue, mode URL, retained sessions and rollover signals; replaces the former Practice-only bootstrap.
- `components/game/game.tsx` / `game-shell.tsx`: mode-specific controls, saved attempt initialization, completion/rollover UI and compact selector.
- `lib/game/share.ts` / `result-dialog.tsx`: mode-aware labels and spoiler-free URLs.
- `question-panel.tsx` / `app/globals.css`: Browse prominence and restrained mode/status styles. Logo, typography, palette, poster/details/cast and attribution remain intact.

## Verification

Final validation passed on 20 October 2026:

- `npm run lint`, `npm run typecheck` and **all 170 tests** passed (zero failures). The existing engine, Practice, Oscar accuracy, question-browser and sharing tests remain in the suite. New coverage includes every scheduled board, immutable schedule/catalogue guards, append-only extension, London calendar/DST boundaries, saved-question replay, five-question enforcement, completion locks, corrupt/blocked storage, mode separation, rollover/exhaustion rendering and spoiler-free Daily shares.
- `npm run audit:public` passed with 245 source files checked, environment files ignored and no credential/private-hosting findings.
- `npm run build:pages` passed, including the automatic read-only Daily schedule check and Next.js static production build. The rebuilt `/docs` has **86 files / 4,886,475 bytes**. The export checker confirmed `/lineup/`, asset references, `.nojekyll` and zero runtime API references.
- Local static HTTP verification fetched **all 86 publishable files** with HTTP 200 and byte-for-byte equality to both `/docs` and `out`. The Daily root and direct `?mode=practice` / `?mode=daily` URLs returned the same static entry successfully.
- Browser checks at **375, 390, 430, 768 and 1440px** found no horizontal overflow. Mobile retained three poster columns, tablet four and desktop six; the outlined Browse action remained 44px high. Screenshots were inspected for the selector, spacing, input, suggestions, board, completed Daily and result controls. The final build produced no browser warning/error logs in the fresh-visitor check.
- Actual browser play restored a two-question Daily after refresh with **three questions left, the same two answers and eight active films**. Switching modes retained a separate Practice attempt. A second tab restored the same Daily progress. Completing the Daily locked both tabs, including after reload, and allowed result revisits plus Play Practice without Daily replay. The observed path was `24 → 13 → 8 → 4 → 2 → 1`; copy feedback reported a spoiler-free result. Practice New lineup reset its own board to 24 films/five questions. A fresh visitor received the identical ordered 24-film Daily.
- Keyboard checks opened Browse with Enter, entered Release, paged through ten questions, and closed with Escape back to Browse focus. The same sheet opened in Practice; keyboard mode switching worked. Validity/unknown-Oscar filtering and canonical selections remain covered by the unchanged question engine/browser tests. Existing reduced-motion CSS and the question-animation preference branch remain intact.

Rollover, GMT/BST, device-timezone independence, restricted/corrupt storage and schedule exhaustion were verified with controlled automated cases rather than changing the system clock. No physical-device keyboard, native share destination, overnight session, Lighthouse score or live deployment is claimed. Local HTTP and UI checks used the production files, with no runtime application server.

## Limits

This is a guest, static implementation. Clearing storage, using other browsers/devices, changing the device clock or inspecting the committed future data can bypass the intended challenge. It is not cheat-proof, and there is no fingerprinting. LocalStorage does not provide server-style atomic transactions across deliberately simultaneous tab actions. Normal tab changes reread/synchronize stored progress; accounts or a backend are not introduced.

Blocked/full storage keeps this tab and mode switches playable but cannot guarantee persistence after closing/refreshing. Existing TMDB image CDN failures still use the normal poster fallback. The schedule is finite; after the last date, Daily explicitly becomes unavailable until an extension is published, while Practice stays open. No live GitHub deployment, native mobile share-target test or overnight wall-clock browser session is claimed by local verification.

The finished `/docs` uses the unchanged main-branch GitHub Pages publishing mechanism, `.nojekyll` and `/lineup/` base path. No push, remote settings, GitHub Actions, account, new service or recurring cost is part of this change.

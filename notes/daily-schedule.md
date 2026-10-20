# Daily LINEUP schedule and maintenance

The initial schedule contains **365 consecutive puzzles, 20 October 2026–19 October 2027**, numbered **001–365**. It is committed as compact ID references in `lib/data/daily-schedule.ts`. No live service, cloud job, deployment-per-day or runtime date-seeded puzzle generation is needed.

## How puzzles are prepared

`scripts/generate-daily.ts` uses the existing normalized local catalogue and `createPracticePuzzle`, with a separate offline Daily history. It does not read or write a player's Practice history or change Practice selection. Each entry stores its unique ID, ISO calendar date, sequential number, ordered 24 TMDB IDs, mystery TMDB ID, seed for preparation diagnostics and catalogue version. Runtime resolution uses those frozen IDs; it never re-runs selection from the seed.

The existing selection balances recognisability, decades, genres, people and franchise/title families. Five preceding Daily boards are excluded and boards six–ten receive the existing soft recency penalties. After a quality-checked board is chosen, the generator randomly selects an as-yet unused member as its mystery during the initial year. This yields **365 unique mystery answers**. Question usefulness is evaluated from the board alone, before choosing that answer; no suggestion ranking knows the mystery.

All 365 boards were validated: exactly 24 unique resolvable suitable films, mystery membership, no duplicate family/title, poster references, five-board cooldown and healthy question quality. Minimums were **191 valid questions, six decades and 13 genres per board**. Consecutive boards share zero films. The first 30 puzzles contain **553 distinct films in 720 appearances** and 30 distinct mysteries. The full first-30 distributions and repeat frequencies are in [daily-generation-audit.json](daily-generation-audit.json).

## Immutable data and catalogue maintenance

`lib/data/daily-config.ts` identifies launch date `2026-10-20`, initial duration 365 and catalogue version `lineup-catalogue-2026-10-20-v1`.

A SHA-256 fingerprint pins the complete normalized existing catalogue, including question facts and detail metadata. This deliberately reuses the existing catalogue once rather than adding another copy of movie objects or repeating 24 full objects in every puzzle. Normal builds run `check:daily`; silently changing/removing movies in the published catalogue version fails the check before publishing.

The first 365 entry identities also have a frozen prefix hash. Normal generation copies existing entries verbatim and appends only. Decreasing `--days` never truncates entries; changing launch date or published IDs does not silently regenerate them. The tests extend the actual full first-year schedule in memory and confirm its frozen prefix remains identical.

Future catalogue maintenance must retain the published version and its referenced normalized records. A future version-aware catalogue registry may load new records for new puzzles while preserving older versions; that is a deliberate maintenance change, not an automatic fallback. This release supports one pinned version and refuses mutation. Adding/revising movies requires a reviewed version-preservation migration before the current pin can be changed. Merely updating a hash after changing records is not a safe migration.

## Commands

Run from the LINEUP repository:

```sh
# Validate committed identities, referenced movies, fingerprint and quality audit:
npm run check:daily

# No-op for an already complete initial year; never regenerates existing puzzles:
npm run generate:daily

# Append to a total of 730 days (not 730 additional days):
npm run generate:daily -- --days 730

# Or append through an inclusive ISO calendar date:
npm run generate:daily -- --through 2028-10-19

npm run check:daily
npm test
npm run build:pages
```

The underlying script is `node --experimental-strip-types scripts/generate-daily.ts`; `--check` validates without writing. The commands do not contact a network. Review/commit the added entries and updated audit, rebuild `/docs`, then publish through the existing main-branch GitHub Pages process. Already generated entries and numbering remain unchanged when extending. The initial frozen-prefix pin stays unchanged after appending.

## Changing the launch date before any public release

The launch date is clearly configured in `lib/data/daily-config.ts`. Once any puzzle has been published, do not shift it. If the entire schedule is still **unpublished** and the owner explicitly decides to move launch:

1. Change `DAILY_LAUNCH_DATE` to the intended ISO date.
2. Deliberately reinitialize the generated schedule module with its matching `launchDate` and an empty `entries` array. Keep its typed schema/header. This is an explicit replacement of unpublished data, not a normal append operation.
3. Run `npm run generate:daily -- --days 365` to produce the complete newly dated schedule and audit.
4. Review the new schedule, then set `DAILY_FROZEN_PREFIX.sha256` to the new audit's `initial365Sha256` (retain length 365). The catalogue pin remains unchanged if its movie records did not change.
5. Run `npm run check:daily`, tests and `npm run build:pages`; review the complete initial release before committing/publishing.

The normal generator intentionally has no casual reset switch. An ordinary configuration typo cannot move published puzzles; the explicit unpublished review above is required. It has not been performed on this schedule.

## Calendar and runtime limits

A separate browser-safe `daily-date.ts` module determines the **Europe/London** calendar date with `Intl`, including GMT/BST. That date selects an explicit committed entry; the date does not calculate a mystery or assign a puzzle number. The stored `createdAt` value is stable metadata, not the reset clock. Rollover is based on the IANA calendar, not elapsed 24-hour increments.

Before the schedule starts or after it ends, the UI must state that Daily is unavailable and offer unlimited Practice. It must not invent a random Daily or claim a scheduled next puzzle beyond the committed range. Extend the schedule before 19 October 2027 to keep daily availability continuous without interruption.

This is static, inspectable data: committed future answer IDs can be examined by a determined player. The guest attempt restriction relies on browser storage, not accounts or a trusted clock, and cannot apply across cleared storage, other browsers/devices or deliberately changed clocks. There is no fingerprinting or claim of a cheat-proof system. Movie image CDN assets can still be unavailable; existing poster fallbacks apply. No new movie, awards or commercial-rights claims are introduced.

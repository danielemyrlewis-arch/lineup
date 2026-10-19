# LINEUP Oscar coverage — 19 October 2026

Historical report for commit a280b45. The [coverage improvement report](oscar-coverage-improvement.md) supersedes its availability figures and all-or-nothing verification model. This report and the original audit remain as the baseline.

This is a **limited, working integration**, not a complete Oscar catalogue. All seven questions are implemented in the existing engine. Only 20 independently checked film records are published. The remainder stay unknown. In a 100-lineup simulation using the ordinary first-suggestion strategy, Oscar questions appeared in **0/100 initial lineups and 0/100 games through five questions**. Broader source review is needed before this will be a commonly available question family. No selection rule or question-safety rule was relaxed to increase frequency.

## Selected source, licence and provenance

[Zac Delventhal's JSON Nominations](https://github.com/delventhalz/json-nominations) was selected for its explicit MIT notice, stable TMDB/IMDb identifiers, nominee-entry structure and winner flags. Pinned revision: [`e617f8a780d20a516280b35645585e66bdebec83`](https://github.com/delventhalz/json-nominations/tree/e617f8a780d20a516280b35645585e66bdebec83), committed 3 April 2024. The JSON is 2,937,285 bytes, SHA-256 `b6562caf59a0432b9d7c09f2ad0b42b08ef6a39f07c54dd7b8f48fc311b83bcd`. README SHA-256: `2c8412e4f10a37b7a1e9a03dd098704aa9bd92fb56f7b8a16b53ffa86f79c108`. Licence SHA-256: `c1f4b368d62026539cd3aef538f3715b2b11e5a34932d9cb9fae09e070c48816`.

The [README](https://github.com/delventhalz/json-nominations/blob/e617f8a780d20a516280b35645585e66bdebec83/README.md) credits the public [Oscars Winner and Nominee Master Spreadsheet](https://docs.google.com/spreadsheets/d/18P6JdOyU4Misxe66R5zMpATJBlwfmpQ_KkOOZ7ASm_c/edit), with corrections/expansion using TMDB. The author applies MIT to the JSON and disclaims ownership of the Oscars, categories and film names. The MIT permission allows reuse/modification/distribution, including commercial use, **of rights the licensor can grant**, with the copyright/permission notice. Its text is retained in [the published notice](../public/licenses/oscar-source.txt) and linked from About & credits.

No separate reuse licence or permission chain was found in the inspectable upstream spreadsheet. The upstream collection's rights and TMDB's separate terms are not resolved by a downstream MIT notice. **Commercial clearance is not established.** This implementation publishes a small set of independently checked factual totals, not the original nomination database or reference prose. The source's factual/coverage problems below block automatic bulk verification. Expansion/commercial release should include review of the upstream permissions, or an independently compiled, demonstrably reusable replacement. No Academy website scraping was performed and no Academy bulk data was copied.

## Exact source coverage and observed quality

- **10,568 nomination records; 2,183 records marked as winners.** Every row has a boolean winner flag; every observed year/category group has at least one winner. This verifies structural presence of winner information, **not factual completeness or correctness**.
- **96 eligibility periods/ceremonies**, from `1927/28` through `2023`; latest is the **96th ceremony in 2024**. There are **six** early split-year labels (`1927/28` … `1932/33`), not five. The 2nd and 3rd ceremonies both occurred in 1930. From eligibility year 1934 onward, ceremony ordinal = year − 1927, calendar year = year + 1. There is no wholly absent historical ceremony in this sequence.
- **34 source category labels**, including discontinued competitions, separate color/B&W competitions, and merged modern labels. 2010–2019 have 24 represented categories per period; 2020–2023 have 23 after the sound merger. All 23 competitive categories used at the 2024 ceremony are represented. There is no standalone Title Writing label; early writing categories have been merged. This does not establish that every historical competition/nominee is present or correctly identified.
- **0 exact/normalised duplicate nomination entries; 0 structurally malformed rows** under the documented schema, which allows a missing optional IMDb ID. **16 film associations have null IMDb IDs**, **17 rows have no movie association**, and **16 rows contain multiple movies**. Empty rows include studio/person awards as well as television, so the README's single-TV example is not a complete description of empty associations.
- There are legitimate ties and multi-person nominations. A `won: true` value is not proof that an award was competitive or that a nomination remained eligible.

Confirmed reasons not to certify the whole source:

1. Array index **7048** associates the 1993 Animated Short winner with *George Wallace: One Night Stand*, rather than *The Wrong Trousers*. The latter's win is independently recorded by [the film's official site](https://wallaceandgromit.com/films/the-wrong-trousers) and [Aardman](https://www.aardman.com/latest-news/2023/january/the-wrong-trousers-30th-anniversary/). A valid ID does not guarantee the correct film was selected.
2. Index **5788** attaches both *Fantozzi Against the Wind* and *Against Wind and Tide: A Cuban Odyssey* to one Documentary Feature nomination. The [Cuban documentary's record](https://en.wikipedia.org/wiki/Against_Wind_and_Tide:_A_Cuban_Odyssey) identifies the nominated work. This multi-film association is quarantined rather than automatically credited to both films.
3. Index **4457** marks both *Young Americans* and *Journey Into Self* as winners in one row; [the former's award was revoked for eligibility](https://en.wikipedia.org/wiki/Young_Americans_(1967_film)). It cannot safely be split into two film wins.
4. International Feature entries before the competitive category began and 1964/1968 makeup special awards cannot be included in ordinary competitive totals. Historical effects entries mix special awards and competitions. The importer excludes known noncompetitive cases and quarantines pre-1980 effects entries for individual competitive-status review.
5. Historical merged/renamed labels, write-ins, department-only entries, missing original-title metadata and possible incorrect IDs prevent certification of an exhaustive historical negative range. There is **no globally certified completeness interval for automatic zero inference** in this release.

Indices above and in the audit are **zero-based JSON array indices** into the pinned source. No questionable row was silently corrected. The complete per-period/category counts, winner counts, rejected entries and unmatched indices are in [oscar-import-audit.json](oscar-import-audit.json).

## Matching and release policy

The actual catalogue has **1,206 films**. `Movie.id` is the existing game ID and `Movie.tmdbId` is the numeric stable join. Current catalogue IDs correspond to their TMDB IDs. All joins use exact TMDB IDs. The catalogue does not have a complete original-title or IMDb crosswalk; no title-only matches are made.

**549 films match source TMDB IDs**, with **259 source-matched winning films**. **2,165 source records** touch a catalogue film; **8,403 records** do not touch the catalogue (this includes no-film records). Two explicitly documented title aliases are accepted for ID/title validation: ID 6114, *Dracula* / *Bram Stoker's Dracula*, and ID 194662, *Birdman* / its expanded subtitle. Their title aliases do not approve the films' awards. All other matched normalized titles agree, and their release years are within the nomination-period plausibility window. There are **0 unresolved title/year match ambiguities** in this catalogue. **16 matched films** are nevertheless quarantined for historical effects/noncompetitive-status review.

The three-year release/eligibility plausibility window catches obvious remake/year errors; it is **not** a completeness certificate or a substitute for US eligibility review. Multi-film rows, unknown category labels, inconsistent duplicate winner flags or mismatched identities never produce a published film record. Structural corruption fails publication closed. Shared nominees count once per entry; distinct songs or performers in the same film/category count separately. Nominee order does not change a duplicate key. Color/B&W and separate short/score competitions retain distinct category identities. Best Picture maps only documented title equivalents (Outstanding Picture/Production/Motion Picture; Best Motion Picture). Unique and Artistic Production is a separate competition; acting/directing wins are never Picture wins.

The importer first generates **candidate totals**, then requires an explicit complete-record film review with independent references, matching expected counts/outcomes and matching catalogue title/year. **Candidates are not marked verified.** There is no command-line switch to bypass the review list or automatically fill absent IDs with zeros.

## Published records and independent checks

The complete review inputs are in [reviews.ts](../scripts/awards/reviews.ts). Only individual factual counts/outcomes are retained; reference prose/artwork is not reproduced. `verifiedThroughAwardYear: 2023` refers to the source's eligibility/nomination year, while `coverageThroughCeremony: 96` refers to the 2024 ceremony. It does **not** claim coverage through 2026. The all-or-nothing validator also requires consistent counts, Picture flags, source, date, counting method and both cutoffs.

| Film | TMDB ID | Nominations | Wins | Picture | Independent check |
| --- | ---: | ---: | ---: | --- | --- |
| Inception (2010) | 27205 | 8 | 4 | Nominated | [CBS](https://www.cbsnews.com/pictures/inception/), [film record](https://en.wikipedia.org/wiki/Inception) |
| Titanic (1997) | 597 | 14 | 11 | Won | [Film record](https://en.wikipedia.org/wiki/Titanic_(1997_film)) |
| Everything Everywhere All at Once (2022) | 545611 | 11 | 7 | Won | [Film record](https://en.wikipedia.org/wiki/Everything_Everywhere_All_at_Once), [Time](https://time.com/6261965/everything-everywhere-all-at-once-oscars-frontrunner/) |
| Oppenheimer (2023) | 872585 | 13 | 7 | Won | [Film record](https://en.wikipedia.org/wiki/Oppenheimer_(film)) |
| Barbie (2023) | 346698 | 8 | 1 | Nominated | [Film record](https://en.wikipedia.org/wiki/Barbie_(film)); two different song nominations retained |
| Parasite (2019) | 496243 | 6 | 4 | Won | [Film record](https://en.wikipedia.org/wiki/Parasite_(2019_film)) |
| The Shawshank Redemption (1994) | 278 | 7 | 0 | Nominated | [Film record](https://en.wikipedia.org/wiki/The_Shawshank_Redemption) |
| 12 Angry Men (1957) | 389 | 3 | 0 | Nominated | [Film record](https://en.wikipedia.org/wiki/12_Angry_Men_(1957_film)) |
| Citizen Kane (1941) | 15 | 9 | 1 | Nominated | [Film record](https://en.wikipedia.org/wiki/Citizen_Kane) |
| Singin' in the Rain (1952) | 872 | 2 | 0 | Neither | [Film record](https://en.wikipedia.org/wiki/Singin%27_in_the_Rain) |

**Verified zero: 10 films.** Each is explicitly identified as having no Oscar nominations in [Rotten Tomatoes' independent retrospective](https://editorial.rottentomatoes.com/article/10-movie-classics-the-oscars-ignored/), and absent from the pinned source. The basis is the explicit whole-film no-nomination statement plus covered historic release/eligibility periods, not absence alone. The article predates the source cutoff, but all are older original releases with completed eligibility; there is no later source nomination through 2023. Restorations/remakes are not silently treated as the same film. The review manifest records the eligibility-year bounds; ceremonies follow those periods (including early split years).

| Film | TMDB ID | Release year | Eligibility years considered |
| --- | ---: | ---: | --- |
| Metropolis | 19 | 1927 | 1927–1928 |
| The Big Lebowski | 115 | 1998 | 1998 |
| Mean Streets | 203 | 1973 | 1973 |
| King Kong, original | 244 | 1933 | 1933 |
| Breathless | 269 | 1960 | 1960–1961 |
| Once Upon a Time in the West | 335 | 1968 | 1968–1969 |
| The Shining | 694 | 1980 | 1980 |
| M | 832 | 1931 | 1931–1933 |
| Heat | 949 | 1995 | 1995 |
| Three Kings | 6415 | 1999 | 1999 |

**Inferred zero classifications from absence alone: 0.** The ten explicit reviewed zero decisions, references and notes are also reproduced in the generated JSON `zeroAudit`. Other unmatched films, matched-but-unreviewed films, ambiguous cases and future/recent films remain unknown. For example, *The Godfather* is a source match but remains unknown pending its own review; the 2005 *King Kong* does not inherit the 1933 film's zero.

## Catalogue coverage

**Verified positive: 10. Verified zero: 10. Unknown: 1,186.** Unknown includes 539 source-matched but unapproved films and 647 unmatched films without independent negative verification. A source-matched win is not automatically a verified record.

| Release decade | Films | Exact ID matches | Verified positive | Verified zero | Unknown |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1920s | 6 | 0 | 0 | 1 | 5 |
| 1930s | 9 | 4 | 0 | 2 | 7 |
| 1940s | 16 | 14 | 1 | 0 | 15 |
| 1950s | 41 | 27 | 2 | 0 | 39 |
| 1960s | 49 | 33 | 0 | 2 | 47 |
| 1970s | 83 | 47 | 0 | 1 | 82 |
| 1980s | 86 | 49 | 0 | 1 | 85 |
| 1990s | 213 | 110 | 2 | 3 | 208 |
| 2000s | 273 | 116 | 0 | 0 | 273 |
| 2010s | 426 | 145 | 2 | 0 | 424 |
| 2020s | 4 | 4 | 3 | 0 | 1 |

Every film's status, source match, candidate entries, original category/year/win flag and quarantine state is listed in the JSON report. It also supplies category counts for every award period, enabling release-year and ceremony-year review separately.

## Current questions and UI

All seven canonical questions are functional: nominated for an Oscar; won an Oscar; nominated for Best Picture; won Best Picture; at least three nominations; at least five nominations; at least three wins. They use the ordinary `oscar:*` question IDs, YES/NO evaluator, canonical reducer and existing balance/partition ranking. There is no parallel awards engine. **Every active film must have a valid reviewed record, and both YES and NO must occur.** Unknown, partial, inconsistent, malformed or beyond-cutoff values return unknown; they cannot eliminate a film or spend a question. The existing five-question limit and one-guess rule remain intact.

Oscar/academy award/best picture/nominated/awards/won-an-Oscar searches work for available questions. Original people searches, including Oscar Isaac, still work. Suggestions do not repeat equivalent/inverse partitions and do not consult the mystery identity. None of the seven questions is globally disabled, but unreviewed coverage suppresses them in almost all ordinary games. With only 20 verified records, no fresh 24-unique-film board can be fully covered. The measured 100-game sample did not find a safe split even after deductions. Tests demonstrate safe availability on actual reviewed remaining-film subsets; that is not a claim of broad live coverage. [Reproducible simulation report](oscar-availability.json).

Film details now show compact totals only for verified records, e.g. `8 Oscar nominations · 4 wins`, with `Best Picture winner` where appropriate. Verified zeros display zero; unknowns show no awards line. Poster, synopsis, genres, director, cached cast, one scrolling surface, Cancel and sticky Lock it in remain in place. About links the source/notice and states the 2024 ceremony cutoff. No award imagery or redesign was added.

## Missing recent ceremonies and expansion route

The source stops at the 2024 ceremony. The **97th (2025, 2024 eligibility)** and **98th (15 March 2026, 2025 eligibility)** ceremonies are missing. [AP's completed 2026 results](https://apnews.com/article/5d9f5670eda0440276377a5f6c8b60b9) confirm the current endpoint; these news lists are reference checks, not a licensed bulk-data import.

[Wikidata structured data is CC0](https://www.wikidata.org/wiki/Wikidata:Licensing), and its [98th-ceremony item](https://www.wikidata.org/wiki/Q133827331) and [2026 winning-film item](https://www.wikidata.org/wiki/Q124419173) contain current award statements. It is a potentially reusable update route. Its film/performer/work statements require an exact ID crosswalk and entry-level/category/ceremony reconciliation; absent statements do not establish zeros or exhaustive totals. No such completeness validation was established in this task, so no automatic 2025/2026 records or recent-film negatives were imported. This also avoids copying a restricted Academy database. Completing the update requires a pinned reusable dataset covering those two full ceremonies (including the new casting category), reconciled film/contributor/song entries and reviewed eligibility/negative coverage. Historical incorrect associations and upstream rights must also be resolved before bulk certification.

## Reproduce, validate and publish

The raw 2.94 MB JSON was downloaded once during local preparation. It is outside the repository and never downloaded by development startup, production build or the browser. Obtain the exact pinned file from the linked repository separately, then run:

```sh
npm run prepare:oscars -- /absolute/path/to/oscar-nominations.json
npm run prepare:oscars -- /absolute/path/to/oscar-nominations.json --check
npm run simulate:oscars -- 100 --report
npm run lint
npm run typecheck
npm test
npm run audit:public
npm run build:pages
```

The importer checks the source hash before generating a small `lib/data/oscar-snapshot.ts` and this release's detailed JSON audit. Edit the source contract/review manifest deliberately for later updates; an unreviewed new download fails the pin. Builds consume only the committed local snapshot. No runtime award/TMDB metadata calls, service, account, secret, dependency, server function or deployment workflow is introduced. `/lineup/`, `docs/`, `.nojekyll`, local storage and the original film catalogue remain intact.

### Validation results

- Lint and TypeScript passed. **93 automated tests passed**, including 18 dedicated Oscar regressions, alongside the existing gameplay/static/onboarding tests. Covered: exact IDs/remakes, deduplication, shared/distinct nominations, win aggregation, Picture history, noncompetitive exclusions, corrupt/multi-film quarantine, independent review mismatches, explicit zero/unknown/recent distinctions, cutoff consistency, all seven evaluations, aliases/ranking, canonical tamper resistance, mystery survival, five-question limits, static loading and real detail-component rendering.
- Hash-pinned importer regeneration/check passed; generated review failures: zero. Source/private-metadata/credential audit passed with no findings. Original catalogue/detail snapshots, demo movies, core engine, selection/history logic, stylesheet and dependency lockfile are unchanged.
- `npm run build:pages` passed: **82 ordinary files, 4,681,192 bytes (~4.46 MiB)**, `/lineup/` asset checks passed, `.nojekyll` retained, no runtime metadata API references or deployment workflow files. Every `docs/` file returned HTTP 200 from a basic Python static server under `/lineup/`, with bytes matching `out/`.
- Browser QA used the actual static output at **390×844** and **1280×800**. A reviewed zero rendered its compact awards line; an unreviewed nominated film omitted it. No horizontal overflow; desktop sheet was 520×760 inside an 800-pixel viewport. Cast had no independent scrollbar. At the bottom of the mobile sheet, the last cast member ended above the sticky Lock it in action. About displayed the cutoff/source/notice with the correct `/lineup/licenses/` path. An `academy award` search with unknown films showed no unsafe question. Browser console had no warnings/errors. The mobile verification capture is saved separately in the workspace, outside the repository/publication output.
- The existing 20-lineup diversity simulation passed: 480 appearances, 421 distinct films, max two appearances per film, zero five-board repeats, zero mystery repeats, zero duplicate families and no missing core metadata. The 100-lineup Oscar availability result remains **0%**, as explained above.

Changes and regenerated `docs/` are committed locally on `main` for GitHub Desktop **Push origin**. No push, deployment or GitHub setting change was performed. The owned preview server/tab are stopped after verification.

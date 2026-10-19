# LINEUP Oscar coverage improvement — 19 October 2026

The implementation now separates **positive proof, exact totals and exhaustive category coverage**. Best Picture questions are usually available through normal question search in ordinary Practice games, while their automatic suggestion exposure remains low. General nomination/win and threshold questions still require more complete negative coverage; their limited availability is reported rather than hidden.

## What the original numbers meant

The original **549 matches were 549 distinct catalogue films**, associated with **2,165 individual source nomination rows**. They were candidates, not 549 nomination rows or 549 certified complete records. The importer checked exact TMDB IDs, normalized titles, release/award-year plausibility, categories and duplicates, but then required membership in a 20-film explicit review allow-list. Ten of those films had nominations; ten had explicit independent zero-nomination evidence.

The ten-positive limit was an intentional manual-review rule. It was **not a technical limit or evidence that the other 539 matched films lacked nominations**. The old `OscarRecord` validator also required complete nomination/win totals and both Best Picture outcomes together. Consequently, one missing count erased usable narrower evidence. Upstream rights/coverage concerns justified withholding automatic complete totals and inferred negatives; they did not require withholding every independently corroborated positive.

The old reports remain reviewable: [initial coverage](oscar-coverage.md), [initial import audit](oscar-import-audit.json), and [100-game baseline](oscar-availability.json).

## Added source and rights

The new factual input is a pinned export of **Wikidata structured statements, labels, identifiers and release dates**, obtained through its public query service during offline preparation. [Wikidata's official copyright policy](https://www.wikidata.org/wiki/Wikidata:Copyright) releases structured data under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). This provides an explicit reuse route, including potential commercial reuse under CC0's terms. Wikipedia/reference article prose, images and Academy bulk data are not imported.

The existing [JSON Nominations](https://github.com/delventhalz/json-nominations) snapshot remains a historical cross-check and the source for the original 20 complete film records. Its MIT notice does not establish the permission chain for the upstream spreadsheet. That concern remains documented in the [original report](oscar-coverage.md) and [published notice](../public/licenses/oscar-source.txt). **This is not a claim of commercial clearance for the whole integration or application.** The new client facts come from the CC0 input; reference/news sites are checks, not copied bulk data sources. No restricted Academy database was scraped.

The frozen [Wikidata input](oscar-wikidata-input.json) includes the exact query texts and SHA-256 receipts for 50 raw response files: 1,207 exact-ID crosswalk rows, 1,651 entity metadata records, 1,753 film/producer Best Picture statement bindings, and 2,671 catalogue award statement bindings. Bindings can repeat a film or shared award; they are not nomination totals. The approved input SHA-256 is `9c459b108a8cbfabd9c15776215371937c5aa945322bc9a7d3d152c51c1e1d01`. Historical corroboration audit SHA-256 is `2275047f6c61cff3d4c6c247642f441c47bdf9e2c12ac56ee1e2d30e573b3c65`.

## Batch verification and positive confidence

The verifier does not add hand-authored award examples. It processes the whole catalogue with these rules:

1. Join using exact TMDB IDs to Wikidata entities, then check the normalized catalogue title against supplied labels/titles/aliases and the catalogue release year against all non-deprecated regional release dates. Multiple entities, unmatched titles and conflicting years stay unknown. Preferred-only release dates are insufficient because they can omit other regions.
2. Use only non-deprecated statements with an explicit approved competitive-category mapping. Validate ceremony identifiers/ordinals and date consistency. Date-only evidence must resolve unambiguously; in particular, the two 1930 ceremonies cannot be chosen from calendar year alone. Unknown/honorary/scientific/technical categories and uncertain historical special-award eras are excluded.
3. For general nomination/win positives, corroborate the film, normalized competitive category, ceremony and win flag against the pinned original source's already audited entries. A win requires agreement on winner status; nomination proof can be either a verified nomination or competitive win. Old blanket whole-film quarantine does not erase reliable evidence in a different category.
4. Deduplicate by film, ceremony, category and statement role. Shared recipients do not multiply a film nomination. For thresholds, count **distinct confirmed competitive categories per ceremony** as a conservative minimum. Separate same-category songs/acting entries may increase the true total, but cannot inflate this lower bound. Color/B&W variants are conservatively grouped for this purpose. These minima can prove a threshold YES; a smaller minimum never proves threshold NO or an exact total.
5. A verified positive Best Picture nomination establishes a general nomination YES; a competitive Best Picture win establishes a general win YES. **Neither negative Picture outcome establishes a broader awards negative.**

Result: **512 films have verified evidence of at least one nomination**, and **232 have verified evidence of at least one competitive win**. Of the original 549 matched films, **37 still lack sufficient general-positive corroboration** under this process. Most are song-only or historical effects/sound cases requiring film↔song/contributor linkage or more precise competitive-status evidence; one is an unresolved identity. For example, an award stored on a song/performer cannot be attached to a film just by its title. No absence was turned into a negative to cover these gaps.

Exact film totals remain the original **20 complete records**: ten nominated films and ten verified zero-nomination films. For the other **1,186**, a confirmed minimum is never presented as an exact nomination/win count. Film-detail summary behavior is preserved: partial evidence does not produce a fabricated total or `0 wins` line.

## Exhaustive Best Picture verification

A narrow category can be complete even when the full awards graph is not. The added input reconciles **621 distinct Best Picture nominees and 98 winners across ceremonies 1–98**, ending **15 March 2026** (2025 eligibility/award year).

- Film-item statements and producer statements are included only when the latter explicitly identify the film as the awarded/nominated work. Shared producers are deduplicated per film/ceremony. A competitive winner is necessarily also a nominee.
- The first 96 ceremony sets match the original source's **601 Best Picture nominees and 96 winners exactly by TMDB ID**, after chronology/identity checks. The stored per-ceremony contracts include nominee counts and hashes of the exact nominee and winner sets. Mere presence of 98 ceremonies is not accepted as completeness.
- The 97th and 98th sets contain ten nominees and one winner each. Nominee identities were independently checked against [AP's 2025 list](https://apnews.com/article/fab5f8ce66e992c20c5a0caa0c9b6427) and [the broadcaster's 2026 list](https://abc.com/news/ad570605-f133-4543-a644-f7b799659c70/category/3590739). Winner outcomes were checked against [Anora's distributor](https://www.neonrated.com/film/anora) and [One Battle After Another's soundtrack label](https://www.nonesuch.com/journal/one-battle-after-another-wins-six-academy-awards-including-best-picture-2026-03-16). The published factual values come from CC0, not copied reference lists.
- Three inconsistent/unresolvable statement bindings are rejected, including date-only producer claims placing *Licorice Pizza* and *Everything Everywhere All at Once* in an earlier ceremony year. Correct, independently corroborated statements for their actual ceremonies remain. No erroneous source row was silently rewritten.
- Best Picture means the main historical Picture competition, including its name changes. Unique and Artistic Production is a separate award and does not become Best Picture. Acting/directing awards associated with a film cannot become Picture awards.
- Missing, additional, deprecated or conflicting winner/nominee sets make the relevant closed-category proof fail. The maintenance command refuses publication; the verifier's tests demonstrate that negative category answers disappear. No missing ceremony is filled with negatives.

For a film with a verified exact-ID identity and within the cutoff, membership/non-membership in these reconciled **complete category sets** supports Picture YES/NO. It is not an assumption about the film's US eligibility year based on its original release year. All ceremonies are covered, so international releases and later consideration are not missed by checking only `release year + 1`. Regional dates are a chronology/identity check, with explicit ceremony evidence allowing regional release dates in the ceremony year and the 2020 extended window. Recent films beyond the covered award year remain unknown.

**1,200 catalogue films pass identity validation.** Six remain unknown for all Oscar questions under the new batch input:

| TMDB ID | Catalogue film | Unresolved check |
| ---: | --- | --- |
| 28 | Apocalypse Now | Two entities share the TMDB ID, including a later cut |
| 1979 | Fantastic 4: Rise of the Silver Surfer | Supplied title says “Four” |
| 3050 | Doctor Dolittle | Supplied title says “Dr. Dolittle” |
| 14574 | The Boy in the Striped Pyjamas | Supplied spelling says “Pajamas” |
| 33701 | French Fried Vacation 2 | Supplied titles are French; translation not independently cross-checked |
| 260346 | Taken 3 | Catalogue year 2014; supplied dates only establish 2015 |

These are unresolved strict checks, not declarations that every catalogue value or alias is wrong. No guessed alias, title-only join or movie-data edit was used to remove them.

## Question-level model and coverage

`OscarRecord.answers` stores independently validated YES/NO facts, each with a source, verification date, award-year/ceremony cutoff and proof basis. Missing, invalid or conflicting facts are unknown. Exact totals remain separate. Legacy complete records continue to answer all seven questions; partial records only answer supported questions. The existing all-active-known + both-answers gate, search/ranking/deduplication and canonical reducer are preserved. The seven question IDs/wording are unchanged.

General positives and minimum-category proofs are corroborated through **ceremony 96 / 2023 award year / 2024 ceremony calendar year**. Best Picture membership covers **ceremony 98 / 2025 award year / 2026 ceremony calendar year**. Positive Picture evidence can support the corresponding general positive through that later cutoff. This does not imply that other competitive categories or exact totals are complete for 2025–2026.

| Question | YES | NO | Unknown |
| --- | ---: | ---: | ---: |
| Any Oscar nomination | 512 | 10 | 684 |
| Any Oscar win | 232 | 13 | 961 |
| Best Picture nominee | 177 | 1023 | 6 |
| Best Picture winner | 54 | 1146 | 6 |
| At least 3 nominations | 261 | 11 | 934 |
| At least 5 nominations | 168 | 12 | 1026 |
| At least 3 wins | 95 | 15 | 1096 |

“NO” in the general nomination row consists of the **same ten explicit verified zeros**. No additional general-zero classification was inferred. General win and threshold NOs come only from the original complete film records. Picture NO counts are category-specific and must not be reported as zero Oscar nominations/wins.

**Six films have no known Oscar answers.** Many other films still have unknown general statistics, as the table shows. **103 films have all seven question answers known**, but that does not mean all 103 have exact totals. The catalogue distribution by number of supported questions is:

| Supported questions | Films |
| ---: | ---: |
| 0 | 6 |
| 1 | 0 |
| 2 | 678 |
| 3 | 211 |
| 4 | 81 |
| 5 | 67 |
| 6 | 60 |
| 7 | 103 |

Per-film answers, conservative minima, accepted/rejected statement identifiers, corresponding legacy source indices and all 98 category contracts are in [the question coverage audit](oscar-question-coverage.json). Only the compact generated answer masks and shared provenance fields enter the browser, through `lib/data/oscar-question-snapshot.ts`; the raw input/audit/verifier do not.

## Representative 1,000-lineup availability

The [simulation report](oscar-availability-1000.json) uses seeds starting at `0x4f534300`, the real Practice selector and ten-board recency history, then the first ordinary balanced suggestion after each answer. It does not target awards or inspect the mystery to choose questions. Every offered Oscar question still needs both YES and NO, with all active films known.

Every board and mystery is also compared with the same generation call without awards metadata. **All 1,000 selections and all 1,000 mysteries match exactly.** All 1,206 films occur in the sample's 24,000 appearances. Five-board exclusions, mystery cooldown, distinct films/families, mystery survival and the five-question limit pass. No unknown film was filtered out, no Oscar-only mode was added and no diversity/selection rule was changed.

| Available question group | Opening board | Before question limit |
| --- | ---: | ---: |
| Any Oscar question | 855/1,000 (85.5%) | 942/1,000 (94.2%) |
| General nomination / nomination thresholds | 0/1,000 (0%) | 25/1,000 (2.5%) |
| General win / win threshold | 0/1,000 (0%) | 8/1,000 (0.8%) |
| Best Picture | 855/1,000 (85.5%) | 941/1,000 (94.1%) |

The general nomination group includes “any nomination” and the two nomination thresholds; the general win group includes “any win” and the three-win threshold. Best Picture is reported separately. Initial means the full 24-film board. During play means available **before spending the fifth question**; questions that appear only after the limit are not counted. The JSON includes each of the seven questions separately and a histogram of 0–24 covered films per initial board.

Availability is not the same as automatic exposure. **No Oscar question appeared in the opening three suggestions (0/1,000); a Best Picture question appeared in those suggestions during 38/1,000 games (3.8%).** General nomination/win questions appeared in the suggestions in 0/1,000 games under this strategy. The unchanged balanced ranking prefers other useful splits. Players can search for Best Picture on most opening boards, but players relying only on the suggested buttons will still encounter Oscar questions infrequently. This is a substantial improvement in answerable coverage, not broad automatic discovery. Changing suggestion exposure would be a separate product decision; no ranking change was made.

These are measured availability figures, not a guarantee for every random board or that a player will choose an Oscar question. The earlier 100-game baseline used different coverage and reported 0%; this release's 1,000-game run measures the actual updated product.

## Practical decision and remaining work

**Best Picture is now usually searchable in ordinary games, but automatic discovery remains uncommon (3.8%).** Keep the normal seven-question system, with independent suppression for missing facts. General nomination/win and threshold questions remain uncommon; do not market them as fully covered.

The next useful work is a demonstrably reusable **complete competitive film/contributor/song nomination and winner source** through ceremony 98, with entry-level shared-credit rules, withdrawals, historical special/competitive distinctions and explicit completeness/eligibility support for negatives. That would permit reliable general NOs and exact totals. Further Wikidata song/person links can improve positive evidence for the remaining 37 matched films, but positive additions alone will not solve the main negative-coverage bottleneck. A separate checked identity pass for the six cases above can improve Picture availability without changing film data or inventing awards. No additional manual film-awards examples were inserted in this change.

## Offline maintenance, reproducibility and validation

```sh
# Optional explicit network maintenance, never called by application startup/builds:
npm run download:oscar-evidence -- /absolute/cache/folder
# Supply the separately obtained original pinned JSON and actual retrieval date:
npm run compile:oscar-evidence -- /absolute/cache/folder /path/oscar-nominations.json 2026-10-19
# Review changed evidence before deliberately approving any new hash pin:
npm run prepare:oscar-coverage
npm run prepare:oscar-coverage -- --check
npm run simulate:oscars -- 1000 --report
npm run lint
npm run typecheck
npm test
npm run audit:public
npm run build:pages
```

Cached query responses cannot be relabelled with a different query; the downloader checks their query text. The compiler retains original response hashes and query texts. The verifier pins both the CC0 input and historical corroboration audit. Changing downloaded data does not approve it: a new pin requires source/identity/category/boundary review. Historical and expanded generators reproduce the committed data; Node HTTPS/certificate support and cached-download replay were checked. There is no new dependency, runtime metadata API, backend, account, service, secret, server function or deployment workflow.

Validation completed on 19 October 2026:

- Lint and TypeScript checks passed; all **110 automated tests passed**. Coverage tests exercise independent facts, malformed/conflicting fields, unknown-vs-NO, source cutoffs, thresholds without totals, missing/deprecated/duplicate category evidence, honorary exclusions and the real batch snapshot.
- Both historical import `--check` and expanded question-snapshot `--check` reproduce the prepared data. Cached download replay covers all 50 responses without changing queries, and compilation reproduces the approved input hash.
- The **1,000-lineup simulation passed**, including unchanged film/mystery selection for every seed and the existing history/diversity/mystery-survival invariants. Search availability and actual three-button suggestion exposure are reported separately above.
- `npm run audit:public` passed with no credential/private-hosting findings and environment files ignored.
- `npm run build:pages` passed: **82 static files, 4.50 MB, `/lineup` base path, zero runtime API references**. The complete `/docs` output matches the verified export byte-for-byte, including `.nojekyll`; there is no Pages workflow.
- A localhost HTTP check returned **200 with matching bytes for `/lineup/` and all 82 files**. Browser checks at 390×844 and 1280×900 verified normal Oscar autocomplete, asking a Best Picture question, one-question consumption and film elimination; no browser warnings/errors were captured.
- Source review confirms no changes to movie catalogue snapshots, Practice selection/history, engine/reducer, results, film cards/detail layout, question input, five-question limit, styles, dependencies or hosting configuration. The small About credit update identifies the new source/cutoff.

The changes and regenerated `/docs` are prepared for a local `main` commit and GitHub Desktop **Push origin**. No push, deployment or GitHub settings change is performed by this task.

# LINEUP question and catalogue audit — 19 October 2026

This records the earlier gameplay/onboarding change. Its Oscars decision is historical and has been superseded by the [Oscar integration coverage report](oscar-coverage.md), including the limited reviewed records now published.

## Repository and implementation plan

Preserve the current Next.js static export, `npm run build:pages`, `/lineup/` base path, committed `docs/` and `docs/.nojekyll`. No deployment workflow, service, credentials, runtime metadata fetching or dependency is added.

Audit first, then improve the existing Help dialog and controlled search, add only reliable metadata-backed questions, retain strict unknown suppression and existing balance/partition ranking, add regressions, and rebuild/test the static publication output. Grid, results, one-guess/five-question rules, recency/diversity selection and detail-sheet data remain in place.

## Catalogue provenance and completeness

Actual size: **1,206 unique TMDB IDs**, spanning **1920–2023**, not approximately 2,000. This keeps the catalogue previously confirmed by the user.

`scripts/build-demo-catalogue.py` prepared 1,200 recognisable feature films from its pinned historical TMDB-derived CSV, using age/language-adjusted vote thresholds. `catalogue.ts` merges 40 original curated entries by TMDB ID, adding six films. `build-details-snapshot.py` prepared original overviews, exact company IDs, lead-performer metadata and compact ten-person credits from pinned metadata/credits CSVs. `withBundledDetails` merges the sources and applies the existing reviewed musical/animal map. No datasets were regenerated for this change.

| Field | Known / 1,206 | Scope |
| --- | ---: | --- |
| Release year | 1,206 | Year only; no month/day gameplay questions |
| Genres | 1,206 | Multi-label metadata, 17 represented genres |
| Runtime | 1,206 | Minutes |
| Director | 1,206 | One stored director; not a complete co-director list |
| Featured question cast | 1,206 | Existing first-five-credit scope |
| Original language | 1,206 | 15 codes; not every spoken language |
| Production countries | 1,206 | 44 codes; not filming locations/settings |
| Production companies | 1,200 | Six unknown; no ownership/distribution inference |
| Collection status | 1,206 | TMDB collection membership, not every informal franchise |
| Lead-performer gender | 1,171 | Lowest-order performer, never character/protagonist gender |
| Musical classification | 73 (31 YES) | Reviewed narrative musicals; remaining 1,133 unknown |
| Main animal character | 40 (12 YES) | Reviewed values; remaining 1,166 unknown |
| Original overview | 1,200 | Text for the detail sheet, never question inference |
| Verified awards records | 0 | No Oscar questions enabled |

There are **88 non-English-original-language films** and **325 films with multiple distinct production countries**. These support the two new broad questions with complete coverage. Six company gaps and 35 lead-gender gaps suppress their respective questions whenever present among active candidates. Curated questions usually remain unavailable until all remaining films have reviewed values; this is deliberate.

Genre counts: Drama 472, Action 434, Adventure 377, Thriller 358, Comedy 313, Science Fiction 248, Fantasy 203, Crime 203, Family 174, Romance 146, Animation 124, Mystery 106, Horror 101, War 49, History 44, Music 31, Western 27. **Documentary: zero**. Documentary wording/aliases are supported when actual documentary-tagged films are supplied; no films/tags were invented to make it appear.

## Question inventory and changes

Already present: genre, strict before/after year, all represented decades, under 90/over 90/120/150 minutes, collections, featured cast, director, original language, production country, 14 recognisable production companies/rebrand mappings, lead performer, reviewed musical and main-animal attributes. These were not duplicated.

Added: original language other than English; international co-production based on two or more distinct production-country credits; over 180 minutes; older year thresholds drawn from represented decades. Improved western/cowboy, documentary, historical, musical-plural, word/numeric runtime, people and natural sentence aliases. Cantonese has a readable name for TMDB's `cn` code. Removed the misleading `space` alias from the science-fiction question: that genre cannot establish a space setting.

Studio matching now trusts a supplied stable ID over a conflicting name; exact historical names remain a fallback when the ID is absent. No new studio ownership assumptions. Unknown/malformed/empty values are explicitly unknown, including undefined, invalid runtime, empty lists, missing countries and unrecognised performer gender. Every offered question still requires both YES and NO and no unknown active film.

Lead labels now explicitly say **top-billed performer**. This is a wording clarification only: existing IDs and performer-gender logic are retained, including ensembles and nonbinary values. No character gender is inferred.

Featured cast still means the five stored leading credits, not every person in the movie or the ten-person detail sheet. Questions now name **featured cast**, and known `(uncredited)` cameos are excluded at evaluation/generation without changing the underlying cached credits. The audit found two such names among stored question credits. Extending to arbitrary full-cast or co-director questions requires more complete source data, not a guessed negative.

Search remains deterministic and only searches available canonical questions. Grammatical filler, case, accents, hyphens and common runtime units are handled; meaningful negation/numbers and exact male/female words are preserved. Duplicate search IDs are removed. Full/partial people names and unambiguous surnames remain searchable; ambiguous results display full names and require explicit selection. An Oscar-named performer may still appear for `Oscar`; this does not enable awards questions.

Existing suggestion ranking is retained: candidate balance first, limited category variety, identical/inverse partitions suppressed. It has no access to the mystery's identity. Search can still find less-balanced specific questions.

## Beginner experience

The existing named native Help dialog now explains the secret film, five yes/no questions, elimination, early guessing, one final guess and fewer-question scoring. An explicitly illustrative animated/NO example shows `24 → 15`; a strategy tip compares a broad year question with an actor question and makes the lineup/answer dependency explicit. The example never reads current game state.

No wizard or second tutorial is added. A short first-visit strategy hint uses existing help/history/stat keys to avoid returning-player clutter; the first successful question dismisses it in memory and localStorage. Storage failure does not block play. Mobile autocomplete stays in document flow so the page can scroll around the keyboard; selecting a question on a coarse-pointer device blurs the input. Help keeps one natural scroll surface, native modal keyboard handling and focus restoration.

## Oscars: research and decision

**Do not enable Oscar questions in this release.** There are no verified records in the catalogue. No awards dataset was downloaded, scraped, copied or redistributed.

The [official Academy database](https://www.oscars.org/oscars/awards-databases) is a comprehensive reference, but the Academy's [legal notice](https://www.oscars.org/footer/legal) explicitly includes the database and requires written consent for reproduction/copying. A public search interface is not a redistribution licence. Obtain permission for the intended commercial redistribution before an Academy bulk import.

[Wikidata structured data is CC0](https://www.wikidata.org/wiki/Wikidata:Licensing). The [CC0 deed](https://creativecommons.org/publicdomain/zero/1.0/) permits reuse, including commercially, without copyright permission under its terms. Its [TMDB ID property P4947](https://www.wikidata.org/wiki/Property:P4947) offers a stable join, and [nominated-for P1411](https://www.wikidata.org/wiki/Property:P1411) can provide positive statements. However, Wikidata distinguishes [unknown and explicitly no-value statements](https://www.wikidata.org/wiki/Help:Statements/en); a missing statement is not a completeness certificate. Counting only film-item statements can also miss contributor nominations associated with a film. **Inference:** CC0 is a promising reuse route, but an unreviewed Wikidata export does not establish exhaustive nomination/win totals or verified zeroes across this catalogue.

The [Kaggle Oscar dataset page](https://www.kaggle.com/datasets/unanimad/the-oscar-award) was also inspected. Its body/licence could not be independently inspected through the available page response, so third-party CC0 descriptions were not accepted as proof of upstream redistribution rights. No copy was used.

Optional `Movie.oscars` / `OscarRecord` schema and an offline-only consistency validator are ready. Counts/Best Picture booleans remain null unless a supplied reviewed record is complete and internally consistent, has an HTTPS source, verification date, explicit ceremony cutoff and counting methodology. A validator cannot independently certify factual accuracy/licensing. It is not wired to question generation, so even synthetic verified fixtures cannot accidentally enable an awards question.

Future import requirements:

1. Resolve and archive permitted commercial redistribution rights and provenance for the exact snapshot.
2. Join to TMDB IDs (or another verified stable-ID crosswalk); review release year, original title and collisions. Never automatically join title alone. The present catalogue has no complete original-title field, so ambiguous cases need separately verified metadata.
3. Count one competitive **film/category/nominee entry** per ceremony, including contributor awards for that film, rather than one per credited recipient. Multiple distinct nominated entries within a category count separately. Include Best Picture category renames; exclude honorary and scientific/technical awards; document revoked/disqualified nominations and the coverage cutoff.
4. Verify zeroes against complete records for the relevant eligibility/ceremony span; an unmatched row stays unknown.
5. Only then add canonical Oscar questions, including nomination/win thresholds, using the same all-active-known + YES/NO gate as every other question, with reviewed collision/count/negative fixtures.

This awards reuse research does not change the separate rights associated with the existing TMDB-derived catalogue/artwork.

## Further opportunities

The newly exposed language and co-production splits are fully supported. More thresholds/localised names can use the existing factual fields when meaningful. Books, true stories, time travel, space setting, Christmas, superheroes and child protagonists have no reviewed catalogue attributes: add sourced true/false/unknown entries to the extensible enrichment map before proposing those questions. Expanding reviewed musical/animal coverage would make the existing questions available more often without unsafe inference.

## Verification

Lint, TypeScript, 75 automated tests (18 new) and the static production export passed. New tests cover genre/musical distinctions, strict year/decade/runtime boundaries, controlled search/aliases, studio IDs, performer semantics, country/language splits, unknown/malformed data, optional verified/unknown award record validation, onboarding and real sequential lineups. No Oscar question/threshold is enabled to test as a production feature. Existing canonical-question, five-question-limit, one-guess, mystery-survival and recency tests remain in place.

A 20-lineup simulation produced 480 appearances/421 distinct films, zero five-board repeats, zero mystery repeats, zero family duplicates and no missing core metadata. No selection/diversity rule changed.

Browser checks used only Python's static HTTP server and the actual `docs/` output. At 375, 390 and 430 pixels, Help had no horizontal overflow, used one scrolling surface and kept the elimination example readable. Escape closed the modal and restored focus. Controlled western, three-hour, non-English, co-production and featured-cast searches worked at all three widths; studio questions stayed suppressed when data coverage required it. A reduced 390×500 viewport kept the first result visible and the page scrollable. This simulates constrained available space; a physical phone's native on-screen keyboard was not tested.

Two actual questions produced `24 → 19 → 12`, followed by a consistent two-question result. The first question removed the hint; replay/refresh kept it dismissed, reset the board to 24 and retained the completed game's local stats. Detail sheets still rendered ten cached cast credits and a visible sticky Lock it in action. Desktop checks at 1280 pixels confirmed the existing floating autocomplete, loaded Libre Franklin and no horizontal overflow or console errors.

The publication output contains 81 ordinary files/about 4.46 MB, matches `out/`, retains `.nojekyll` and `/lineup/`, and has no deployment workflow. All files were served successfully over basic static HTTP. The request log showed only successful static GETs, no API requests and no failures. Source/compiled-output audits found no credentials or private-hosting references. GitHub publishing itself was not run.

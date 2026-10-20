# LINEUP product refinement — 20 October 2026

## Audit and priorities

The existing charcoal/cobalt identity, Libre Franklin, poster-led grid, immediate playable Practice game, canonical question engine, elimination tutorial and offline catalogue are strengths. They are retained. The source review covered navigation, hero, search, suggestions/history, board/animations, film details/cast, help, results, sharing, credits, accessibility, font/image loading, metadata and static publishing. Desktop and mobile baseline screenshots were captured before implementation.

The highest-impact weaknesses were:

1. The opening copy did not say yes/no, and the mobile search/grid sat behind redundant guidance and stacked progress framing. At 390×844, the baseline first poster began at approximately 558px and search input at 371px.
2. Players had to know category/actor/studio words to discover the question engine's breadth. Oscar search availability had improved, but ordinary suggestion exposure remained limited.
3. Results showed raw counts without explaining the final number. Sharing lacked the public game URL, an explicit copy option and a clearly recoverable permission-failure path.
4. The page had no canonical/Open Graph/Twitter raster preview. Small controls and dialog focus recovery also warranted attention.

Implementation priority was compact first impression → question discovery → results/sharing → static preview/SEO → responsive, accessibility and regression verification. Gallery research and future growth ideas are in [design-research.md](design-research.md).

## Player-facing decisions

- Keep “24 films. One answer.” and explicitly explain up to five yes/no questions. Tighten the existing hero and put the question budget/brand-line indicators on one mobile row. One contextual guidance line replaces two competing lines.
- Keep the wordmark, line motif, regular-width Libre Franklin, palette and three-column mobile board. The wordmark scrolls to the top rather than navigating/reloading an active game. Help remains directly accessible; no hamburger or sticky header is added.
- Add one quiet **Browse questions** action beside Suggested. A short menu exposes only usable categories from the current `validQuestions` list. A category displays at most ten questions per page, using exactly the same ask callback/reducer as autocomplete. This adds a deliberate second discovery path without changing ranking, evaluator, unknown suppression or question accuracy.
- Preserve the existing broad-question tutorial and first-use dismissal logic. Short contextual guidance introduces the main search without adding a start screen or forced tutorial.
- Results lead with the outcome, film and accurate question count, then label the real remaining-film path and explain how many films remained at the guess. No artificial final 1, confetti or spoiler is added to shared text.
- Replay remains one primary action. One optional invitation accompanies sharing. Native sharing is supplemented by explicit Copy result and Copy game link actions; cancellation and failed clipboard permission are reported honestly with selectable manual text.
- Add quiet explanatory footer copy describing the real free game. Credits/licences remain accessible. No public player counts, testimonials or ratings are invented.

## Brand, metadata and SEO

The original 1200×630 typographic PNG uses the existing local font, dark background, cobalt line and proposition. No poster or copyrighted gallery artwork is included. It is 32,763 bytes. Original SVG/32px favicon and 180px Apple touch icon use the same line/letter treatment.

Metadata is generated statically: descriptive title, description, absolute canonical, Open Graph URL/title/description/image/dimensions/alt and Twitter `summary_large_image`. All public URLs use `https://danielemyrlewis-arch.github.io/lineup/`. A one-entry sitemap lists only that real page. Project-level robots.txt is omitted because robots policy is read at the origin root, which this repository deployment does not own. No fabricated schema ratings or unnecessary SEO article is added.

`scripts/generate-brand-assets.py` reproduces the raster assets from the existing WOFF2 font using Pillow in the provided authoring runtime; runtime/build dependencies are unchanged and the images are committed. The generator is optional maintenance, never part of player runtime or ordinary builds.

## Accessibility and performance

Native modal focus trapping, Escape handling and focus restoration are retained and strengthened when a trigger is removed/disabled. The question shortcut ignores open modals. Browser category/pagination changes focus the heading; choosing a question restores focus to a stable budget. Search option Tab focus, active-descendant validity and scroll-into-view are consistent. Search result counts and copy outcomes have accessible announcements.

Utility controls now provide 44px touch targets. Cobalt remains the brand/action colour; small coloured text uses a lighter accessible variant on dark surfaces. Elimination retains the X/text treatment alongside colour. Existing reduced-motion CSS and FLIP animation guards remain, and no decorative animation is added. The cast/detail sheet keeps a single scroll area and sticky lock action.

No new frontend dependency, third-party tracking, runtime service or high-resolution poster prefetch is introduced. Posters retain dimensions, aspect ratios, responsive sources and lazy loading. The original cacheable catalogue chunk remains architecturally unchanged. Measurement is based on actual build bytes and browser checks; no Lighthouse score or real-device keyboard claim is inferred.

## Validation

- **128 automated tests passed**, including 18 new tests covering canonical question grouping/selection, spoiler-free actual result values, native-share cancellation/failure, clipboard/manual fallback, raster dimensions and canonical asset URLs. Lint and TypeScript passed; the final production build also completed its TypeScript check after the sharing-focus refinement.
- Browser checks used **375, 390, 430, 768 and 1440px** viewports, with screenshots inspected. None had horizontal overflow. Mobile remains three columns; tablet/desktop retain the existing responsive grid. At 390px the input begins at roughly **321px instead of 371px**, and the first poster at **524px instead of 558px**. Taller tap targets and the Browse action consume some of that space saving deliberately.
- Browser-tested category menu, People pagination, available Awards questions, category selection consuming exactly one question, Escape restoration, the safe wordmark, Help open/close, modal shortcut guard, normal suggestions/eliminations, all five questions, final-pick state, lost/won results and Play again reset. Actual result paths included **24 → 20** on a failed guess and **24 → 13 → 7 → 4 → 2 → 1** after a real five-question game; the unit tests separately verify a successful result ending in 4 without appending 1.
- At reduced viewport height **390×500**, the search list was bounded to 225px, the first result remained visible, and ArrowDown/Enter selected a question. This is useful layout verification, not a claim of physical iOS/Android keyboard testing.
- The detail sheet rendered ten cast entries with one overall scrollbar. At the bottom, the final cast entry ended at about **689px**, above the sticky action starting around **717px**. No detail data/UI expansion or additional fetch was introduced.
- Actual copy-result/link actions produced the expected feedback. Keyboard Tab/Enter copying preserved focus on Copy result inside the dialog. Native-share and clipboard-denial paths are covered with platform-boundary tests; no message was actually sent to another person. The CUA clipboard adapter returned empty text on read-back, so the OS clipboard payload was not independently confirmed; formatted payload/spoiler exclusion are automated tests.
- **86 static files / 4.56 MiB** built successfully. All 86 returned HTTP 200 with matching bytes under `/lineup/`; `/docs` equals the checked export including `.nojekyll`. Canonical, OG/Twitter metadata, dimensions and absolute icon/image URLs were verified in the generated HTML before JavaScript. The sitemap contains only the canonical page.
- [Measured build data](design-validation.json): full uncompressed export increased from **4,716,007 to 4,777,725 bytes** (~62KB), including the new raster/icons. Total JavaScript decreased slightly from **2,760,699 to 2,759,068 bytes**, and aggregate gzip JavaScript from **1,136,833 to 1,135,699 bytes**. CSS increased from **30,893 to 33,639 bytes**. These are complete-export sizes, not initial network-transfer or Lighthouse measurements. No new dependency was installed.
- Source review confirms movie/awards data, question evaluation/ranking, selection/history/diversity, scoring/reducer, results storage, film cards/details, deployment configuration and dependency lockfile are unchanged. The public-source audit found no credentials/private-hosting metadata; no `.env` is staged.

No live deployment was run. Physical-device native-share targets and actual mobile keyboards remain recommended follow-up checks; no Lighthouse score is claimed.

## Deliberate trade-offs and deferrals

The question browser introduces a category step and ten-item pagination to avoid a giant wall of choices. Search and three suggestions remain the quickest paths. General awards data/ranking is untouched; browsing exposes only currently answerable Awards questions.

A result-image exporter is deferred: native file sharing and save/download differences would add another action and require broader device testing. Reliable text/native sharing plus a small branded default preview addresses the immediate need without a new rendering dependency.

Daily mode, accounts, premium, reminders, external analytics, public testimonials and additional ranking experiments remain documented future work. The event plan stores/sends nothing. The current Practice URL gives friends a fresh normal game, not an identical shared puzzle.

The publishing mechanism remains main-branch `/docs` with `.nojekyll` and `/lineup/` base path. No remote settings, Actions, tokens, services or deployment are introduced. The completed changes are to be committed locally on main for GitHub Desktop Push origin.

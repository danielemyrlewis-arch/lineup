# LINEUP

**Find the film.** A complete, mobile-first movie deduction game. Twenty-four recognisable films, up to five controlled yes/no questions, and one final pick. Practice Mode is playable without credentials.

## Run locally

Requires **Node.js 22.13+** (Node 24 recommended) and npm.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Open **http://127.0.0.1:5173**. Leave the token blank to play the **1,206-film fallback catalogue**. Fonts and the original 40 posters are local; additional posters use responsive TMDB CDN images without an API token. Practice selects 24 films with recency and diversity weighting. No account is needed. A refresh starts a new game while retaining recent-film memory; unfinished game state is not persisted.

### Add TMDB

Put a TMDB **API Read Access Token** in the project root's ignored `.env.local`:

```dotenv
TMDB_API_TOKEN=your_api_read_access_token
```

Get the token from your [TMDB API account settings](https://www.themoviedb.org/settings/api). Restart the dev server after changing it. Use the read access bearer token, rather than the legacy API key. Never prefix it with `NEXT_PUBLIC_` or `VITE_`, and never commit it. `.env.example` contains the required name only.

For the hosted Site, configure `TMDB_API_TOKEN` as a **server runtime secret** in Sites. For Vercel, set it in project environment variables and redeploy. No real token was supplied with this build; live TMDB requests are implemented and tested with mocked responses, while the deployed game runs in demo mode.

The server always starts with the full bundled catalogue. With a token, TMDB discovery covers eight release-period buckets, animation/horror/comedy, and Japanese/Korean/French/Spanish/Hindi films. Pages rotate daily and candidates interleave across buckets. Each refresh hydrates up to 30 films with appended credits, at most six concurrent requests and 46 upstream calls total, then merges valid records into the seed catalogue by TMDB ID. The resulting catalogue is cached for 24 hours per server instance. A 15-second overall deadline and five-second request deadlines bound upstream delays. Missing/invalid tokens or upstream failure keep the full fallback available; failures retry after a fixed one-minute backoff. This deliberately avoids fetching 1,000 detail records during a cold page load. Serverless instances refill independently; live additions are cache-local, not a durable catalogue sync.

### Check and build

```sh
npm run lint
npm run typecheck
npm test
npm run simulate:practice -- 20
npm run build
npm start
```

The default build produces the Sites-compatible Cloudflare Worker using Vinext. `npm start` serves the resulting Worker locally through Wrangler (normally http://127.0.0.1:8787). Use a runtime `.dev.vars` containing `TMDB_API_TOKEN` if testing secrets with Wrangler directly.

### Standard Next.js / Vercel

The application uses the Next.js App Router, React, TypeScript, Tailwind CSS 4 and small purpose-built components. The default Sites runtime uses the supplied Vinext adapter because Sites hosts Workers. A standard Next.js deployment is also supported. Its production command uses the supported Webpack build path to avoid local Turbopack sandbox restrictions:

```sh
npm run dev:next
# http://localhost:3000
npm run build:next
npm run start:next
```

For Vercel select **Next.js**, set the build command to `npm run build:next`, and leave the output directory at the framework default. Both deployment builds are checked as part of this delivery. The Sites adapter is beta; the standard Next.js path avoids depending on it for a Vercel launch.

## Project structure

```text
app/
  page.tsx                Server-rendered initial puzzle
  api/lineup/route.ts      Fresh practice puzzle endpoint; never caches a mystery
  globals.css             Responsive editorial design and reduced-motion styles
components/game/
  game.tsx                Game orchestration and practice lifecycle
  result-dialog.tsx       Win/loss screen and sharing controls
  info-dialogs.tsx         Help, attribution and local statistics
  pick-dialogs.tsx         Final-pick and fresh-lineup confirmation
  film-details.tsx        Compact title, genres, credits and clamped synopsis
  question-panel.tsx      Controlled autocomplete, suggestions and clue history
  movie-board.tsx         Posters, FLIP reflow and collapsible eliminated films
  poster.tsx              Sized/lazy artwork with accessible fallback
  dialog.tsx              Native modal focus trapping and focus return
lib/
  data/catalogue.ts       1,206-film server-side Practice seed catalogue
  data/catalogue-snapshot.ts Compact generated TMDB metadata snapshot
  data/demo.ts            Original 40 curated films and local artwork overrides
  data/details-snapshot.ts Original TMDB overviews, studios and principal credits
  data/bundled-details.ts Merge fallback details without overriding live unknowns
  data/enrichment.ts      Extensible reviewed true/false/unknown attributes
  data/studios.ts         Recognisable studio allow-list and explicit aliases
  data/normalise.ts       Defensive TMDB → internal Movie normalisation
  data/provider.ts        Replaceable demo/TMDB providers; server only
  game/types.ts           Movie, puzzle, question and state contracts
  game/engine.ts          Unchanged seeded Daily path and pure game reducer
  game/practice-selection.ts Weighted Practice generation and question checks
  game/practice-eligibility.ts Recognition and feature-film filters
  game/practice-history.ts Bounded local recency and SSR cookie mirror
  game/questions.ts       Definitions, evaluation, validation, search and ranking
  game/copy.ts            Central result copy
  game/share.ts           Spoiler-free Web Share / clipboard fallback
  game/persistence.ts     Lightweight local practice stats
public/
  posters/                Small demo poster assets (342px)
  fonts/                  Locally hosted open-source typography
  tmdb.svg                TMDB attribution logo
  licenses/               Font licenses and asset credits
tests/                   Core game and provider tests
.openai/hosting.json       Sites identity and deployment bindings; no secrets
```

## Rules and design decisions

- Only recognised questions are submitted. Release date, genre, runtime, collection, director, cast, language and country questions are supported alongside the added studio, lead-performer and reviewed curated questions; release dates include before/after thresholds and relevant decades.
- A question is available only if every active film has the needed data, at least one answers yes and one no. Unknown metadata is never guessed or treated as a negative answer.
- Suggestions rank primarily by balance, prefer a variety of categories, and avoid offering equivalent or inverse splits. Split counts are not shown to players.
- The pure reducer validates canonical questions, refuses duplicates and sixth questions, preserves the mystery, and accepts one active-film guess. Before/after and over/under comparisons are strict: “after 2000” excludes 2000.
- Films first desaturate in place, then reflow using FLIP animation. Eliminated films remain inspectable in a separate section that collapses when several are out. Reduced-motion users get a near-instant transition.
- Posters have fixed aspect ratios, title truncation, lazy loading, major cast limits and modest image sizes. Live artwork uses responsive TMDB sizes.
- Native `<dialog>` provides keyboard focus containment, Escape dismissal, background inertness and focus return. Autocomplete supports arrows, Enter, Escape and Cmd/Ctrl+K. The game announces clues and counts through a live region.
- The demo metadata is a curated snapshot, including collection membership as a simple franchise proxy. It is not a real-time claim about collections. Some films have multiple directors; V1 normalises the first credited director as requested by the singular `director` model. A future catalogue can use `directors[]`.
- Practice stats are stored only on this browser and are explicitly labelled that way. No account, daily puzzle, payment, advertising, award questions, arbitrary AI answers, or multiplayer has been implemented.
- Practice mysteries live in client memory so the game works without sessions. This is suitable for free practice, not an anti-cheat boundary. A scored Daily Mode should keep its mystery and answer evaluation on the server.

## Practice selection

The fallback combines **1,200 TMDB-derived snapshot records** with the original curated films, deduplicated by TMDB ID, giving **1,206 eligible films**. It retains compact gameplay facts (about 288 KB) plus selected film details (about 555 KB of generated source), not full credits. The full catalogue stays on the server; only 24 films reach the browser. The historical snapshot covers films through 2017, with newer films supplied by the original curated additions and optional live TMDB enrichment. It is a broad fallback, not a current movie chart.

Snapshot provenance: [movies_complete.csv at pinned commit 84d01fc](https://github.com/TjanMichela/Movie-Data-Analysis/blob/84d01fcfb0b89f12ce445740fddac37270e4a042/movies_complete.csv). The source repository’s MIT notice is preserved in `public/licenses/catalogue-source.txt`; TMDB metadata and artwork remain subject to TMDB’s terms. Rebuild with `python3 scripts/build-demo-catalogue.py /path/to/movies_complete.csv`. Original curated values and local poster paths override matching snapshot records while retaining collection hints. On 15 October 2026 all **1,166 additional poster URLs** returned HTTP 200; original artwork remains local.

Every candidate needs a valid TMDB ID, title, poster path, released year, genres and a 60–360 minute feature runtime. Adult/video/planned records, explicit TV Movie records, future/invalid dates and shorts are rejected. Preferred minimum vote counts are age-sensitive:

| Release year | Preferred | First widening | Final widening |
| ------------ | --------: | -------------: | -------------: |
| Before 1980  |       250 |            200 |            150 |
| 1980–1999    |       600 |            400 |            250 |
| 2000 onward  |     1,200 |            800 |            500 |

Non-English thresholds are 65% of these figures, floored at 150 votes. Marginal records also need popularity ≥0.5; films with at least twice the applicable vote threshold do not need that popularity floor. This preserves older/high-vote classics even when current popularity is low. Widening happens only when fewer than 24 candidates are fresh enough, with no arbitrary low-vote filler. Optional metadata gaps reduce selection weight; the fallback has all eight original gameplay categories populated. New studio/lead fields and curated flags retain explicit unknown states where coverage is incomplete.

`localStorage` key `lineup:practice-films:v1` stores the newest ten displayed boards (**at most 240 IDs**) and ten separate mystery IDs. Abandoned boards count as shown. Recording is idempotent, malformed input is sanitised, and unavailable/full storage falls back to in-memory history. A compact same-site cookie mirrors only the IDs so server-rendered refreshes also respect cooldown; it contains no account or result data. New-lineup requests send the bounded local history in a POST body. Daily puzzles and practice result statistics use their existing separate paths.

Films from the previous five boards are excluded whenever at least 24 suitable fresh candidates exist. Films from boards six through ten have **0.035×** normal weight. Small pools relax exclusion with **0.002×** weight for the most recent five boards. Recent mystery answers get an additional **0.005×** appearance penalty and are excluded from answer selection for ten games. Titles naturally re-enter once they leave history.

Weighted sampling reduces overrepresentation of decades, genres, animation/live action, collection membership, director/cast, original language and countries. There are no fixed genre or decade slots. Collection IDs/names, plus broad MCU/Middle-earth/Wizarding World groups, normally allow one franchise representative. Normalised same-title remakes cannot share a board when alternatives exist. Small homogeneous pools relax those preferences instead of failing.

Each proposed board is checked with the **unchanged `validQuestions`**. Acceptance targets at least six distinct splits with four or more films on each side, four valid categories and three categories with balanced splits. Up to five weighted attempts choose a healthy board or the best available board if a limited pool cannot meet that target. This changes selection, never question evaluation, ranking or suggestions.

For optional development diagnostics, run `LINEUP_DEBUG=1 npm run dev`. Server logs show eligible pool size, recency exclusions/penalties, selected IDs, decade/genre distributions and question quality. There is no production debug UI or API field. `npm run simulate:practice -- 20` provides a reproducible sequential-lineup report and asserts cooldown, metadata and franchise invariants.

## Additional questions and selected-film details

Production companies are normalised as `{ id, name }` records. Only the 14 configured production brands in `lib/data/studios.ts` generate questions. Matching uses exact TMDB IDs or explicit historical names; it never uses substring matches or infers credits from corporate ownership. Disney Pictures, Pixar and Marvel remain separate. DreamWorks Pictures and DreamWorks Animation are also separate. The 20th Century Fox/Studios and known legacy company entries are explicitly mapped. An absent, empty or malformed company list is unknown. A NO requires a populated list of other production credits. Questions still require all active films to have reliable values and a non-constant YES/NO split.

`topBilledLead` is the principal cast entry with the smallest valid TMDB `order`, using source order for ties; unnamed first credits remain unknown. The performer name, character and gender come from that same entry, not from another actor, a character name or a guessed protagonist. TMDB gender 0/missing/unrecognised means unknown, 1 means female, 2 male, and 3 nonbinary. Known nonbinary performers answer NO to both male/female questions. This is an operational definition for ensembles, animation and cross-gender roles, and the help dialog explains it. It describes the performer, not the character. Any unknown lead gender suppresses these questions for the current active set.

The original TMDB overviews, production-company IDs/names and top-billed credits for **1,200 fallback films** are extracted from the [matching historical TMDB dataset](https://github.com/tima-chan/TheMovieDataBase/tree/77aaa72bff5e687ad496f5a579217b312352977e). Gender is known for **1,171** of those credits. These are historical facts, not a real-time catalogue; a documented [TMDB person correction](https://www.themoviedb.org/person/27578-elliot-page) updates a known stale name/gender entry. Rebuild with `python3 scripts/build-details-snapshot.py /path/to/movies_metadata.csv /path/to/credits.csv`. Raw 190 MB credits are never shipped. TMDB remains the source; live details use their own current response and **never** fill missing fields with historical gender/company values. Newly added films without full fallback details show only what is known.

Curated booleans live in `Movie.enrichment`, with reviewed records keyed by TMDB ID in `lib/data/enrichment.ts`. `true`, `false` and absent/`null` are distinct. A generic descriptor list provides the question/aliases; future attributes can extend the interface, reviewed map and descriptors without new predicate cases. Only `hasMainAnimalCharacter` and `isMusical` are implemented now. Animal classifications cover obvious central literal/anthropomorphised animals (including dinosaurs); uncertain toys, spirits and fantasy creatures remain unreviewed. Synopses, genres, keywords and runtime AI do not classify animal characters.

**Music is separate from musical.** TMDB’s Music genre identifies review candidates, not a guaranteed narrative musical. `isMusical` is an explicit reviewed value: La La Land, The Lion King and known narrative musicals are YES; Whiplash, Amadeus and Straight Outta Compton are NO. Ambiguous performance films/biopics and unreviewed titles remain unknown. Reviewed musicals can override missing Music tags, including familiar animation. There is no default NO from an absent Music tag. Because coverage is deliberately partial, musical/animal questions may become available only after narrowing to reviewed films. Unknowns never silently become NO. New curated questions use the same valid-split, balance-ranking and inverse-partition rules as every other question.

Autocomplete includes studio/brand aliases, woman/female, man/male, animal, musical/singing/song/songs/musical film, before 1970 and short decade forms such as 60s. Gender words match whole words so male does not accidentally match female. Release questions now include the 1970 threshold; older decades are generated from films actually present. New categories are appended to existing tie-break priorities, without boosting them above better splits.

Selecting a film shows its poster, title, year, up to three genres, director, principal performer/character and original TMDB overview. The compact two-column header and three-line mobile synopsis keep both existing confirmation actions easy to reach. Synopsis input is bounded to 1,000 characters and rendered as plain text; missing sections disappear. Opening a card makes **no detail, credits or person requests**: data is prepared in the existing catalogue/cache path and only the selected 24 records reach the browser. Lock-in, five-question rules, elimination, result/share screens, recency and diversity algorithms are unchanged.

## Tests

The 54 tests cover the existing game/rule cases plus Practice uniqueness, five-/ten-board recency, mystery cooldown, franchise/remake grouping, smaller/homogeneous pools, gradual widening, malformed metadata, bounded local history and cookies, question quality, broad TMDB discovery and bounded metadata fetching. They use Node's built-in test runner without a state or testing framework dependency. Added tests cover company mapping/ownership isolation, lead definition/unknown gender, 1970/older decades, curated tri-state musical/animal flags, aliases and ranking, actual rendered film detail sections, missing sections and synopsis escaping. Browser review covers mobile confirmation cards, search, elimination, final picks and results.

## TMDB attribution and artwork

This product uses the TMDB API but is not endorsed or certified by TMDB.

The About & Credits dialog includes this notice, a TMDB logo and a link to TMDB. Demo film posters were downloaded at 342px from TMDB's image CDN. Film artwork belongs to its respective rights holders. TMDB images and metadata are used for the initial free, non-commercial prototype.

**Before public launch the developer must ensure all current TMDB branding, logo, attribution, API-use and licensing requirements are satisfied.** Review the [TMDB API FAQ](https://developer.themoviedb.org/docs/faq), [logos and attribution](https://www.themoviedb.org/about/logos-attribution), and your account's API terms. The initial hosted Site remains owner-private. This project does not claim ownership of posters or metadata.

API implementation follows TMDB's [append-to-response](https://developer.themoviedb.org/docs/append-to-response) and [image URL](https://developer.themoviedb.org/docs/image-basics) documentation. Secrets remain server-side.

## Sensible Phase 2

1. Store versioned daily puzzle records (24 movie IDs/order, immutable metadata snapshot, mystery ID and date/time-zone policy), with server-side question/guess validation and one scored attempt per day.
2. Add optional accounts and sync local statistics after completion, with streaks and win distributions.
3. Refresh the historical catalogue snapshot, allow multiple directors and version collection semantics so old daily answers stay stable.
4. Add reproducible daily sharing, production monitoring and real-device assistive-technology checks.

These are extension points, not partially built features. `Puzzle` already has a mode, stable seed, ID and creation timestamp; the engine is independent of data providers and presentation.

## Visual identity

Libre Franklin is the only interface font, hosted locally under the SIL Open Font License. The editorial design uses neutral black/grey surfaces with a restrained cobalt accent (#5B6CFF). Controls use sentence casing; poster artwork provides the visual variety. The previous condensed typography and decorative investigation labels have been removed.

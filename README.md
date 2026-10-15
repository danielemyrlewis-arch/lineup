# LINEUP

**Find the film.** A complete, mobile-first movie deduction game. Twenty-four recognisable films, up to five controlled yes/no questions, and one final pick. Practice Mode is playable without credentials.

## Run locally

Requires **Node.js 22.13+** (Node 24 recommended) and npm.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Open **http://127.0.0.1:5173**. Leave the token blank to play the curated 40-film demo catalogue, with poster artwork and fonts served locally. The game randomly selects 24 films and a mystery on each new lineup. No account is needed. A refresh starts a fresh practice game; unfinished games are deliberately not persisted indefinitely.

### Add TMDB

Put a TMDB **API Read Access Token** in the project root's ignored `.env.local`:

```dotenv
TMDB_API_TOKEN=your_api_read_access_token
```

Get the token from your [TMDB API account settings](https://www.themoviedb.org/settings/api). Restart the dev server after changing it. Use the read access bearer token, rather than the legacy API key. Never prefix it with `NEXT_PUBLIC_` or `VITE_`, and never commit it. `.env.example` contains the required name only.

For the hosted Site, configure `TMDB_API_TOKEN` as a **server runtime secret** in Sites. For Vercel, set it in project environment variables and redeploy. No real token was supplied with this build; live TMDB requests are implemented and tested with mocked responses, while the deployed game runs in demo mode.

The provider discovers well-known films with at least 2,500 TMDB votes, fetches details with appended credits in batches of six, takes the first five billed cast members, deduplicates titles/releases, and caches the catalogue for 24 hours per server instance. A 15-second overall deadline prevents repeated slow upstream requests from blocking the game indefinitely. Missing/invalid tokens, upstream errors, and insufficient catalogues automatically fall back to demo data, with a short retry backoff. Serverless instances may refill their caches independently.

### Check and build

```sh
npm run lint
npm run typecheck
npm test
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
  globals.css             Responsive cinematic design and reduced-motion styles
components/game/
  game.tsx                Game orchestration and practice lifecycle
  result-dialog.tsx       Win/loss screen and sharing controls
  info-dialogs.tsx         Help, attribution and local statistics
  pick-dialogs.tsx         Final-pick and fresh-lineup confirmation
  question-panel.tsx      Controlled autocomplete, suggestions and clue history
  movie-board.tsx         Posters, FLIP reflow and collapsible eliminated films
  poster.tsx              Sized/lazy artwork with accessible fallback
  dialog.tsx              Native modal focus trapping and focus return
lib/
  data/demo.ts            40 curated recognisable films
  data/normalise.ts       Defensive TMDB → internal Movie normalisation
  data/provider.ts        Replaceable demo/TMDB providers; server only
  game/types.ts           Movie, puzzle, question and state contracts
  game/engine.ts          Seeded lineup generation and pure game reducer
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

- Only recognised questions are submitted. All eight requested metadata categories are supported; release dates include before/after thresholds and relevant decades.
- A question is available only if every active film has the needed data, at least one answers yes and one no. Unknown metadata is never guessed or treated as a negative answer.
- Suggestions rank primarily by balance, prefer a variety of categories, and avoid offering equivalent or inverse splits. Split counts are not shown to players.
- The pure reducer validates canonical questions, refuses duplicates and sixth questions, preserves the mystery, and accepts one active-film guess. Before/after and over/under comparisons are strict: “after 2000” excludes 2000.
- Films first desaturate in place, then reflow using FLIP animation. Eliminated films remain inspectable in a separate section that collapses when several are out. Reduced-motion users get a near-instant transition.
- Posters have fixed aspect ratios, title truncation, lazy loading, major cast limits and modest image sizes. Live artwork uses responsive TMDB sizes.
- Native `<dialog>` provides keyboard focus containment, Escape dismissal, background inertness and focus return. Autocomplete supports arrows, Enter, Escape and Cmd/Ctrl+K. The game announces clues and counts through a live region.
- The demo metadata is a curated snapshot, including collection membership as a simple franchise proxy. It is not a real-time claim about collections. Some films have multiple directors; V1 normalises the first credited director as requested by the singular `director` model. A future catalogue can use `directors[]`.
- Practice stats are stored only on this browser and are explicitly labelled that way. No account, daily puzzle, payment, advertising, award questions, arbitrary AI answers, or multiplayer has been implemented.
- Practice mysteries live in client memory so the game works without sessions. This is suitable for free practice, not an anti-cheat boundary. A scored Daily Mode should keep its mystery and answer evaluation on the server.

## Tests

The tests cover all eleven requested rule cases, deterministic seeds, unknown metadata, strict threshold boundaries, invalid payloads, ended games, reset behaviour, spoiler-free results, aliases, equivalent suggestion partitions, TMDB normalisation, bounded metadata fetching and upstream failures. They use Node's built-in test runner without a state or testing framework dependency. Browser review covers the mobile and desktop layouts, controlled search, elimination, final picks and results.

## TMDB attribution and artwork

This product uses the TMDB API but is not endorsed or certified by TMDB.

The About & Credits dialog includes this notice, a TMDB logo and a link to TMDB. Demo film posters were downloaded at 342px from TMDB's image CDN. Film artwork belongs to its respective rights holders. TMDB images and metadata are used for the initial free, non-commercial prototype.

**Before public launch the developer must ensure all current TMDB branding, logo, attribution, API-use and licensing requirements are satisfied.** Review the [TMDB API FAQ](https://developer.themoviedb.org/docs/faq), [logos and attribution](https://www.themoviedb.org/about/logos-attribution), and your account's API terms. The initial hosted Site remains owner-private. This project does not claim ownership of posters or metadata.

API implementation follows TMDB's [append-to-response](https://developer.themoviedb.org/docs/append-to-response) and [image URL](https://developer.themoviedb.org/docs/image-basics) documentation. Secrets remain server-side.

## Sensible Phase 2

1. Store versioned daily puzzle records (24 movie IDs/order, immutable metadata snapshot, mystery ID and date/time-zone policy), with server-side question/guess validation and one scored attempt per day.
2. Add optional accounts and sync local statistics after completion, with streaks and win distributions.
3. Grow and audit the curated catalogue, allow multiple directors and version collection semantics so old daily answers stay stable.
4. Add reproducible daily sharing, production monitoring and real-device assistive-technology checks.

These are extension points, not partially built features. `Puzzle` already has a mode, stable seed, ID and creation timestamp; the engine is independent of data providers and presentation.

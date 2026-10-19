# LINEUP

**Find the film.** 24 films, up to five yes/no questions, one final pick.

## PUBLIC BETA — GITHUB PAGES

LINEUP is a fully static Next.js export. GitHub Pages serves HTML, CSS, JavaScript and the bundled film catalogue. All lineup generation, questions, eliminations, results and Practice storage run in the browser. Production has no server, account, database, environment secrets, API routes or live TMDB metadata requests.

### Run locally

Use Node.js 24 and npm:

```sh
npm install
npm run dev
```

Open http://localhost:3000. No `.env` file is needed. Development uses Next's local development server; production does not.

### Publish directly from main /docs

The complete publishable site is committed in **`docs/`**, including `docs/.nojekyll` so GitHub Pages serves Next.js's `_next` assets directly. There is no custom deployment workflow, build service, token or custom secret to configure.

1. Push the committed `main` branch using GitHub Desktop's **Push origin**.
2. In the repository, open **Settings → Pages → Build and deployment**.
3. Set **Source: Deploy from a branch**, **Branch: main**, **Folder: /docs**, then **Save**.
4. Once GitHub Pages finishes publishing, open **https://danielemyrlewis-arch.github.io/lineup/**.

GitHub serves the files already present in `docs/`; it does not build Next.js. For future application or catalogue updates, regenerate `docs/` locally, commit it together with the source changes, then push `main`.

### Rebuild the published site

```sh
npm run build:pages
```

This sets the build-time base path to `/lineup`, runs the existing `next build --webpack` static export and its asset checks, then replaces `docs/` with the complete verified `out/` output. The command preserves local development at the domain root. All public scripts, CSS, fonts, images, favicon and links in `docs/` are compiled for `/lineup/`. No production environment variables are needed.

The lower-level `npm run build` command still exports to `out/` at the domain root by default. `PAGES_BASE_PATH` remains an optional build-time setting for other hosting paths; the public beta uses `npm run build:pages` with its fixed repository path. Do not run `next start`; the published site has no application server.

### Test docs with a basic static server

After `npm run build:pages`, create an empty preview folder and mount `docs/` at the repository path:

```sh
mkdir -p /tmp/lineup-docs-preview
ln -s "$PWD/docs" /tmp/lineup-docs-preview/lineup
python3 -m http.server 4173 --bind 127.0.0.1 --directory /tmp/lineup-docs-preview
```

Open **http://127.0.0.1:4173/lineup/**. Remove an old preview symlink before recreating it. This symlink is only for local preview; `docs/` contains ordinary files. Next/Node does not need to be running.

Checks:

```sh
npm run lint
npm run typecheck
npm test
npm run audit:public
npm run build:pages
```

`postbuild` verifies HTML/CSS asset paths, `.nojekyll`, export size and the absence of old backend references in the JavaScript. The home page contains every game, sheet and result, so refreshing the repository URL works directly. Only generated publication files belong in `docs/`.

## Static catalogue and future updates

The [question/catalogue audit](notes/question-audit.md) records the earlier gameplay/onboarding work. The [Oscar coverage report](notes/oscar-coverage.md) records the current awards integration: 20 independently checked records, seven canonical questions and strict suppression whenever any active film is unknown. The other 1,186 films remain unknown; absent awards records never mean zero. This intentionally limits availability.

The catalogue actually present in this checkout contains **1,206 films**: a 1,200-film historical TMDB-derived snapshot merged with the original 40 curated films by TMDB ID. This conversion keeps the existing film data and selection/diversity rules unchanged.

- `lib/data/catalogue-snapshot.ts`: compact factual gameplay data: ID, title/year, poster reference, genres, runtime, director, question cast, collection, language/countries, votes and popularity.
- `lib/data/details-snapshot.ts`: original overviews, production companies, lead metadata and up to ten cast names/roles/profile paths/order. It retains 11,937 compact cast credits rather than full TMDB responses.
- `lib/data/demo.ts`: the original modern additions and 40 local poster overrides.
- `lib/data/enrichment.ts`: reviewed musical/animal true/false/unknown flags, keyed by TMDB ID.
- `lib/data/studios.ts`: exact studio IDs and explicit rebrand aliases, without ownership inference.
- `lib/data/oscar-snapshot.ts`: lightweight reviewed Oscar enrichment; full source JSON and audit reports never enter the browser bundle.
- `lib/data/catalogue.ts` and `bundled-details.ts`: merge these static sources.

The browser loads the catalogue as one cacheable static JavaScript chunk. Every initial, refreshed or new lineup is generated locally with a fresh random seed and existing recency history. No request-time data generation occurs. Images can still load from TMDB's public image CDN: those are image assets, not metadata/API calls. Only the existing 40 small poster files are local; no mass poster download was added. Missing/failed artwork retains its existing fallback behaviour.

The snapshot is historical (through 2017 plus curated newer additions), not a live movie chart. To refresh it later, obtain the source CSVs separately and run the offline generators, review the output, then test/build and push the changed snapshots:

```sh
python3 scripts/build-demo-catalogue.py /path/to/movies_complete.csv
python3 scripts/build-details-snapshot.py /path/to/movies_metadata.csv /path/to/credits.csv
```

Neither generator runs in the application, production build or published site. Their pinned sources are recorded in the scripts: [gameplay snapshot](https://github.com/TjanMichela/Movie-Data-Analysis/blob/84d01fcfb0b89f12ce445740fddac37270e4a042/movies_complete.csv), [details and credits](https://github.com/tima-chan/TheMovieDataBase/tree/77aaa72bff5e687ad496f5a579217b312352977e). The source repository MIT notice is in `public/licenses/catalogue-source.txt`. Raw CSVs are not included in public source. To expand coverage, adjust the generator's selected-film cap and regenerate details for the resulting IDs; the game architecture does not change.

Unknown studio, lead or curated values stay unknown. Questions require reliable YES and NO values for every active film and retain the existing balance ranking. Musical classification is reviewed rather than inferred from TMDB's Music tag. Lead questions explicitly describe the top-billed performer, not an ensemble's protagonist or character gender. Featured-cast questions use the existing five stored leading credits, excluding explicitly uncredited appearances; the detail sheet still shows up to ten. Original language is not a claim about all dialogue, and production countries are not story/filming locations. Original TMDB overviews stay plain text and clamped; detail-sheet cast keeps optional headshots, one scroll surface, top Cancel and sticky Lock it in.

## Browser storage and static-hosting limitations

Existing localStorage keys for recently shown films, mystery cooldown, help preference and Practice statistics are unchanged. History remains bounded to ten boards/240 film IDs and ten mysteries; new lineups and refreshes respect the same cooldown/diversity logic. Storage failures fall back to in-memory history. No cookies or server sessions are needed. Refresh starts a fresh game while retaining local history; unfinished games are not persisted, as before.

Browser storage belongs to an origin: moving from a previous host to `USERNAME.github.io` starts separate local statistics/history. There is no automatic cross-domain migration or account sync. Metadata changes require a new build/deployment. The first load downloads the bundled catalogue; remote posters/headshots still need an internet connection. JavaScript is required to play. This free Practice beta keeps its answer and metadata in client memory, as before.

## Public source and attribution

`.env`, `.env.local`, `.dev.vars`, keys, dependency/build folders and local editor/hosting caches are ignored. `.env.example` contains only an optional public build-time path. `npm run audit:public` reports credential/private-metadata locations without printing their values. The one-time `node scripts/audit-public-source.mjs --history` check also scans historical source blobs; the clean release archive deliberately omits all Git history and local state.

LINEUP retains its editorial black/cobalt identity and locally hosted **Libre Franklin** under the SIL Open Font License (`public/licenses/Libre-Franklin-OFL.txt`). Film metadata/artwork remain credited to [TMDB](https://www.themoviedb.org). About & credits retains the TMDB logo and notice: **This product uses the TMDB API but is not endorsed or certified by TMDB.** Static metadata was originally obtained from TMDB; the published beta makes no live metadata API requests.

Deployment references: [Next.js static export](https://nextjs.org/docs/app/guides/static-exports), [Next.js base paths](https://nextjs.org/docs/app/api-reference/config/next-config-js/basePath), [GitHub Pages publishing sources](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

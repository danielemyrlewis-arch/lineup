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

### Create the public repository and deploy

1. Create an **empty public repository** on GitHub, for example `lineup`. Do not initialise a README there.
2. Extract the supplied clean source archive into a new folder. It contains no `.git`, credentials, previous hosting configuration or local runtime state. Initialise a fresh public history from that folder:

   ```sh
   git init -b main
   git add .
   git commit -m "Prepare LINEUP static public beta"
   git remote add origin https://github.com/USERNAME/REPOSITORY.git
   git push -u origin main
   ```

   Replace `USERNAME` and `REPOSITORY` with your GitHub account and repository. Use this clean source rather than pushing the old hosting repository's history.

3. In the new GitHub repository, choose **Settings → Pages → Build and deployment → Source → GitHub Actions**.
4. Open **Actions → Deploy LINEUP to GitHub Pages → Run workflow**, selecting `main`. If the first push ran before Pages was enabled, rerun the workflow after step 3.
5. Once the deployment succeeds, open the URL shown by the `github-pages` environment. A project repository normally uses `https://USERNAME.github.io/REPOSITORY/`. A repository named `USERNAME.github.io`, or a configured custom domain, can use the domain root.
6. Every subsequent push to `main` automatically tests, builds and deploys. Manual workflow dispatch is also supported.

The workflow uses current official `actions/checkout`, `setup-node`, `configure-pages`, `upload-pages-artifact` and `deploy-pages`. It runs `npm ci`, public-source auditing, lint, type checking and tests before uploading **only `out/`**. GitHub provides its normal temporary workflow token/OIDC; no custom credentials or application secrets need configuring. The build job reads Pages metadata; deployment permissions are scoped to the deployment job.

### Static production build

```sh
npm run build
```

This runs `next build --webpack` with `output: "export"`, then verifies the exported assets. The output is **`out/`**. Do not run `next start`; there is no production application server.

For a project repository subpath, the one build-time setting is:

```sh
PAGES_BASE_PATH=/lineup npm run build
```

`PAGES_BASE_PATH` must be empty or `/REPOSITORY`. GitHub Actions supplies the actual Pages `base_path` automatically, so changing the repository name or using a root/custom-domain site does not require source edits. Rebuild when changing the published path. This value is compiled into the assets; there are no runtime environment variables. Next's base path covers scripts, CSS and internal links; local posters, favicon and the TMDB logo use the matching prefix. The local Libre Franklin font is bundled by `next/font/local`. Native poster/headshot images and unoptimised local images need no image server.

### Test the export with a basic static server

For a root build:

```sh
npm run build
python3 -m http.server 4173 --bind 127.0.0.1 --directory out
```

Open http://127.0.0.1:4173/. Next/Node does not need to be running.

To test the same repository subpath used by Pages:

```sh
PAGES_BASE_PATH=/lineup npm run build
mkdir -p /tmp/lineup-pages-preview
ln -s "$PWD/out" /tmp/lineup-pages-preview/lineup
python3 -m http.server 4173 --bind 127.0.0.1 --directory /tmp/lineup-pages-preview
```

Open http://127.0.0.1:4173/lineup/. Use an empty preview folder, or remove a previous preview symlink before recreating it. The symlink is a local preview convenience; the uploaded Pages artifact contains ordinary files.

Checks:

```sh
npm run lint
npm run typecheck
npm test
npm run simulate:practice -- 20
npm run audit:public
npm run build
```

`postbuild` verifies HTML/CSS asset paths, `.nojekyll`, a small export size and the absence of old backend references in the JavaScript. There are no nested routes or rewrite rules: the game and every sheet/result live on the home page, so refreshing the project URL works directly.

Preparation checks passed with a clean `npm ci`, lint, type checking, all 57 tests and a 20-lineup simulation. Root and `/lineup/` exports each contain 81 files/about 4.45 MB. Browser checks against Python's static server covered new lineups, questions, film details, posters, fonts, attribution, results, replay, refresh cooldown and persisted statistics. The preview log contained only successful static GET requests and no API requests. The GitHub deployment workflow itself still needs to run in your chosen repository.

## Static catalogue and future updates

The catalogue actually present in this checkout contains **1,206 films**: a 1,200-film historical TMDB-derived snapshot merged with the original 40 curated films by TMDB ID. This conversion keeps the existing film data and selection/diversity rules unchanged.

- `lib/data/catalogue-snapshot.ts`: compact factual gameplay data: ID, title/year, poster reference, genres, runtime, director, question cast, collection, language/countries, votes and popularity.
- `lib/data/details-snapshot.ts`: original overviews, production companies, lead metadata and up to ten cast names/roles/profile paths/order. It retains 11,937 compact cast credits rather than full TMDB responses.
- `lib/data/demo.ts`: the original modern additions and 40 local poster overrides.
- `lib/data/enrichment.ts`: reviewed musical/animal true/false/unknown flags, keyed by TMDB ID.
- `lib/data/studios.ts`: exact studio IDs and explicit rebrand aliases, without ownership inference.
- `lib/data/catalogue.ts` and `bundled-details.ts`: merge these static sources.

The browser loads the catalogue as one cacheable static JavaScript chunk. Every initial, refreshed or new lineup is generated locally with a fresh random seed and existing recency history. No request-time data generation occurs. Images can still load from TMDB's public image CDN: those are image assets, not metadata/API calls. Only the existing 40 small poster files are local; no mass poster download was added. Missing/failed artwork retains its existing fallback behaviour.

The snapshot is historical (through 2017 plus curated newer additions), not a live movie chart. To refresh it later, obtain the source CSVs separately and run the offline generators, review the output, then test/build and push the changed snapshots:

```sh
python3 scripts/build-demo-catalogue.py /path/to/movies_complete.csv
python3 scripts/build-details-snapshot.py /path/to/movies_metadata.csv /path/to/credits.csv
```

Neither generator runs in the application, production build or deployment workflow. Their pinned sources are recorded in the scripts: [gameplay snapshot](https://github.com/TjanMichela/Movie-Data-Analysis/blob/84d01fcfb0b89f12ce445740fddac37270e4a042/movies_complete.csv), [details and credits](https://github.com/tima-chan/TheMovieDataBase/tree/77aaa72bff5e687ad496f5a579217b312352977e). The source repository MIT notice is in `public/licenses/catalogue-source.txt`. Raw CSVs are not included in public source. To expand coverage, adjust the generator's selected-film cap and regenerate details for the resulting IDs; the game architecture does not change.

Unknown studio, lead or curated values stay unknown. Questions require reliable YES and NO values for every active film and retain the existing balance ranking. Musical classification is reviewed rather than inferred from TMDB's Music tag. Lead gender describes the lowest-order principal performer; display cast expansion does not alter question cast or that definition. Original TMDB overviews stay plain text and clamped; detail-sheet cast stays capped at ten with optional headshots, one scroll surface, top Cancel and sticky Lock it in.

## Browser storage and static-hosting limitations

Existing localStorage keys for recently shown films, mystery cooldown, help preference and Practice statistics are unchanged. History remains bounded to ten boards/240 film IDs and ten mysteries; new lineups and refreshes respect the same cooldown/diversity logic. Storage failures fall back to in-memory history. No cookies or server sessions are needed. Refresh starts a fresh game while retaining local history; unfinished games are not persisted, as before.

Browser storage belongs to an origin: moving from a previous host to `USERNAME.github.io` starts separate local statistics/history. There is no automatic cross-domain migration or account sync. Metadata changes require a new build/deployment. The first load downloads the bundled catalogue; remote posters/headshots still need an internet connection. JavaScript is required to play. This free Practice beta keeps its answer and metadata in client memory, as before.

## Public source and attribution

`.env`, `.env.local`, `.dev.vars`, keys, dependency/build folders and local editor/hosting caches are ignored. `.env.example` contains only an optional public build-time path. `npm run audit:public` reports credential/private-metadata locations without printing their values. The one-time `node scripts/audit-public-source.mjs --history` check also scans historical source blobs; the clean release archive deliberately omits all Git history and local state.

LINEUP retains its editorial black/cobalt identity and locally hosted **Libre Franklin** under the SIL Open Font License (`public/licenses/Libre-Franklin-OFL.txt`). Film metadata/artwork remain credited to [TMDB](https://www.themoviedb.org). About & credits retains the TMDB logo and notice: **This product uses the TMDB API but is not endorsed or certified by TMDB.** Static metadata was originally obtained from TMDB; the published beta makes no live metadata API requests.

Deployment references: [Next.js static export](https://nextjs.org/docs/app/guides/static-exports), [Next.js base paths](https://nextjs.org/docs/app/api-reference/config/next-config-js/basePath), [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

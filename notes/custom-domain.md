# Custom-domain preparation — 26 October 2026

LINEUP is prepared for **https://dailylineup.co.uk/**, still served by GitHub Pages from **main /docs**. This is a local source/export change only. No push, remote repository setting, GoDaddy record, service or hosting architecture was changed. Older reports in this directory describe their original `/lineup/` validation; this report and README describe the current root-domain configuration.

## Changes

- `next.config.ts` keeps `output: "export"`, trailing slashes and unoptimized static images, with an empty `basePath` and injected empty public asset prefix. The old `PAGES_BASE_PATH` override no longer applies, so a stale shell value cannot accidentally rebuild the custom domain under the repository subdirectory.
- `lib/site.ts` sets the canonical public origin. The existing layout and share helpers derive canonical, Open Graph, Twitter, icons, Daily share links and Practice query links from it. No game UI or share wording is redesigned.
- `public/CNAME` contains exactly `dailylineup.co.uk` followed by a newline. Next copies it into `out/CNAME`; `build:pages` validates it before replacing `/docs`. `docs/CNAME` is therefore generated afresh on every successful build.
- `public/sitemap.xml` lists the canonical root. `public/robots.txt` now provides a useful root policy and points to the sitemap; this is possible because the site owns its new origin root.
- `scripts/build-pages.mjs` builds the origin root and still copies only the verified static export to `/docs`, removing stale chunks. `scripts/check-static-export.mjs` checks root assets (including absolute same-origin assets), CNAME, canonical/social metadata, sitemap/robots and absence of old project paths or runtime metadata APIs.
- Tests update URL expectations and cover the domain configuration, metadata/share contracts, publication markers, and rejection of broken custom-domain exports. README and `.env.example` describe the root build. No dependencies or workflows were added.

The Daily schedule, catalogue, engine, question accuracy, Practice selection/history, UI/design, poster/headshot sources, local font and storage code remain unchanged. The same frozen Daily IDs and answers remain in use.

## Storage across the move

Daily progress, Practice history/statistics and onboarding retain the same versioned localStorage keys and validation. They work normally on the new origin, including refresh and mode switching. Browser security prevents `dailylineup.co.uk` from reading the old `github.io` origin's storage, so a visitor starts fresh on the new domain. No automatic transfer, account, fingerprinting or remote migration was added. Clearing or denying storage retains the existing documented limitations.

## Build and preview

```sh
npm run lint
npm run typecheck
npm test
npm run audit:public
npm run build:pages
python3 -m http.server 4173 --bind 127.0.0.1 --directory docs
```

Open `http://127.0.0.1:4173/` and `http://127.0.0.1:4173/?mode=practice`. This serves ordinary production files with no Next.js runtime or subdirectory mount.

## Owner handoff — not performed by Codex

1. Use GitHub Desktop **Push origin** for the local commit. Keep Pages publishing from **Deploy from a branch → main → /docs**.
2. Before directing DNS traffic, confirm **Settings → Pages → Custom domain** is `dailylineup.co.uk` (save it if GitHub has not adopted the published CNAME). GitHub recommends optionally verifying domain ownership first; any verification TXT value must come from the account's Pages screen, not an invented value.
3. In GoDaddy's **dailylineup.co.uk → DNS**, configure the following records. The values below are GitHub's published Pages endpoints checked on 26 October 2026. Use the normal **1 hour** TTL.

| Type | Name | Value |
| --- | --- | --- |
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| CNAME | www | danielemyrlewis-arch.github.io |

The `www` destination is the account hostname, with **no protocol or repository path**. The canonical domain remains the bare `dailylineup.co.uk`; GitHub handles its associated `www` variant when configured. Replace conflicting parking/forwarding or web records for `@`/`www`; retain unrelated MX, TXT, NS and email records. No apex CNAME, nameserver switch, GoDaddy forwarding or paid hosting is required. If old IPv6 web records exist, remove conflicting values or replace them with all four optional GitHub IPv6 addresses: `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`.

4. Once GitHub's DNS check/certificate are ready, enable **Enforce HTTPS**. Verify the root, Practice query URL, shared links and `www` redirect. DNS/certificate propagation can take time; a local successful build does not confirm the live domain is deployed.

Primary references: [GitHub custom-domain configuration and DNS values](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site), [GoDaddy A records](https://www.godaddy.com/help/add-an-a-record-19238), [GoDaddy CNAME records](https://www.godaddy.com/help/add-a-cname-record-19236).

## Verification

All final local checks passed on 26 October 2026:

- `npm run lint` and `npm run typecheck`: passed.
- `npm test`: **177 passed, zero failures/skips**. This includes the existing Daily, Practice, engine, awards, persistence and sharing suite plus custom-domain regressions. Fixture tests run the actual export checker and reject missing/wrong CNAME, old repository asset paths, missing same-origin assets and stale canonical/crawler URLs.
- `npm run audit:public`: 249 source files checked; environment files ignored; no credential or private-hosting findings.
- `npm run build:pages`: passed, including the frozen Daily schedule/catalogue guard, Next.js static production build and postbuild custom-domain checks. Export: **88 files / 4,883,830 bytes**, root base path, CNAME and metadata verified, zero runtime metadata API references. `/docs` was rebuilt from this export.
- A plain loopback HTTP server serving `/docs` directly returned **HTTP 200 for all 88 files**, with bytes identical to both `docs` and `out`. The root and direct `?mode=daily` / `?mode=practice` URLs returned the static home page. `docs/CNAME` contains exactly `dailylineup.co.uk\n`; `.nojekyll` remains present. Published text assets contain no old GitHub origin or `/lineup/` paths.
- Browser QA used these production files at the origin root and a **390×844** mobile viewport. Daily opened as **#007 / 26 Oct**; the layout retained three poster columns with no horizontal overflow. The local Libre Franklin stylesheet/font and posters loaded, scripts used `/_next/` paths, and canonical/OG URL DOM values were the new public root.
- Browse opened its category sheet and selecting an adventure question consumed one question and eliminated 12 films. Refresh restored the same Daily/history with four questions left. Direct Practice query loading/refresh worked; a Practice question updated its separate state; switching back preserved the Daily. Film confirmation showed synopsis/cast and lock-in controls. Completing the Daily displayed the correct failed result, one question used and actual `24 → 12` path; refresh restored the completed result. Copy-link UI reported success; exact new-domain Daily/Practice share payloads are verified in unit tests, not claimed from OS clipboard readback.
- About links used `/licenses/oscar-source.txt` while external attribution stayed unchanged. Browser warning/error logs were empty. The preview viewport was restored and the owned tab/server were cleaned up.

Gameplay components, catalogue/schedule data, engine and selection/storage logic, branding/CSS, dependencies and workflow settings have no source changes. No live-domain/DNS, GitHub publishing, HTTPS certificate or native share-destination success is claimed; those remain owner steps after Push origin.

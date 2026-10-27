# Google Search favicon check — 27 October 2026

The checkout was clean at `6a2242a`. The existing brand assets are unchanged: white L on the dark background with the existing small cobalt underline. No game, authentication, analytics, consent, SEO copy, sitemap, robots, sharing-image or hosting setting was changed.

## Findings before the change

- Homepage HTML declared `favicon.svg` and a 32×32 PNG as regular icons, plus a 180×180 PNG as the Apple touch icon. No conflicting file-based Next.js icon route was present.
- The two PNGs are valid square images (32×32 and 180×180); the existing 180px graphic was inspected and is sharp. Public assets match the exported copies.
- Read-only live checks, including a Googlebot-Image user-agent string, returned HTTP 200 for the homepage, robots.txt, SVG, 32px PNG and Apple PNG. Image MIME types were correct (`image/svg+xml` and `image/png`). The live large PNG bytes confirmed 180×180 dimensions. robots.txt allows all paths, including these files; no redirect/auth restriction or blocking X-Robots-Tag was found in the responses.
- `/favicon.ico` returns 404 because no ICO exists. An ICO is optional when the page declares a valid icon; no unnecessary replacement ICO was added.
- No definite technical reason for Google's missing favicon was found. Current Google guidance accepts square images from 8×8 and recommends larger than 48×48. It recognises Apple-touch declarations, so the existing 180px PNG was already a supported candidate. The 32px icon is not invalid merely because it is below 48px. SVG is not in the current Search format list, but supported PNG alternatives were already present.

## Minimal clarification

The existing 180×180 PNG is now also advertised as the first regular `rel="icon"` candidate with explicit PNG type and dimensions:

```html
<link rel="icon" href="https://dailylineup.co.uk/apple-touch-icon.png" type="image/png" sizes="180x180">
```

The SVG, 32px browser fallback and Apple touch declarations remain. They represent the same brand; multiple sizes/formats are intentional, not conflicting logos. The existing permanent PNG URL and every asset byte stay unchanged. Reusing it avoids a redesign, new raster file, URL churn, dependency or optional ICO. The new regular declaration becomes public only after the manual push/deployment; the image itself is already live.

Public favicon PNG: **https://dailylineup.co.uk/apple-touch-icon.png**.

## Validation and publication

Use the actual recorded test/build output for this commit. The full existing test suite, lint, TypeScript, static build and local HTTP checks are required. `/docs` is rebuilt from the fully static export and must retain `CNAME` with `dailylineup.co.uk`. Actual crawling by Google and Search-display selection cannot be proven by sending a crawler user-agent header.

After reviewing the local main commit, use GitHub Desktop **Push origin** when ready. No push, deployment or external setting change is performed by this task.

In Search Console, select the `dailylineup.co.uk` property, inspect **https://dailylineup.co.uk/**, run **Test live URL**, check that the fetched/rendered HTML contains the declared PNG, and choose **Request indexing** for the homepage. Keep the icon URL stable. Allow Google to recrawl and process it; its guidance says this can take days to weeks. Eligibility does not guarantee display, and there is no promise of an immediate favicon update.

Official reference: [Define a favicon to show in Google Search results](https://developers.google.com/search/docs/appearance/favicon-in-search).


## Recorded verification

ESLint, TypeScript, **380 automated tests**, the public-source audit and `npm run build:pages` passed. Two new regressions evaluate the real layout metadata, validate the large PNG's size/URL and detect conflicting automatic root icon routes. The rebuilt static export remains 96 files/about 5.04 MB and passed all existing root-path, SEO, consent/configuration and CNAME checks.

An ordinary local static HTTP server served the exported homepage as 200 text/html with the new regular PNG declaration. Googlebot/Googlebot-Image user-agent requests successfully fetched the homepage, robots and all three icon paths. The PNGs returned 200 image/png with 32×32 and 180×180 dimensions, the SVG returned 200 image/svg+xml, and downloaded asset bytes matched public originals. robots allowed the icons, the CNAME was exact, and optional favicon.ico remained 404. No asset or social-sharing-image bytes changed. These checks establish no observed technical crawl restriction; they do not prove an actual Google crawl or future Search-display choice.

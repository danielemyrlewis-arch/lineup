# LINEUP analytics, SEO and discovery handoff

This change is prepared locally for the existing static GitHub Pages site at **https://dailylineup.co.uk/**. Publishing remains **main /docs**. It adds no backend, deployment workflow, paid service or new account requirement. No Google Analytics, Search Console, Supabase, GitHub or GoDaddy settings were changed automatically. A local build does not prove that GA4 is receiving production traffic.

## SEO audit and resulting content

The previous homepage title described a free movie guessing game but did not identify the Daily challenge. Its main explanation before catalogue hydration was limited to the hero/footer. It had no concise rules, mode comparison, strategy explanation or useful FAQ in the initial HTML. There was no public privacy page or game structured data.

The existing root canonical, robots policy, custom-domain sharing URLs and 1200 × 630 social image were already correct. The social image remains in place. Local Libre Franklin fonts use swap rendering; poster images already have explicit dimensions, responsive sources, lazy loading and asynchronous decoding. These were preserved instead of adding a new image/font dependency or speculative performance rewrite.

The homepage now uses:

- **Title:** LINEUP — Daily Movie Guessing Game | Find the Film
- **Description:** Play LINEUP, the free daily movie guessing game. Ask up to five yes-or-no questions, narrow a lineup of 24 films and find the mystery movie. New each day.
- The same clear description and branding in Open Graph and Twitter/X metadata, with the existing spoiler-free social image.

The game stays first. The short support area below it is present in pre-rendered HTML before the catalogue loads. Its introduction reads:

> LINEUP is free to play. Start with 24 films, ask up to five yes-or-no questions and identify one mystery film. There’s a new Daily challenge each day, plus unlimited Practice whenever you want another go.

The following sections explain how to ask and lock in, the shared Daily versus unlimited Practice, why the player’s own question choices matter, and five FAQs about price, question count, repeat play, the UK-midnight reset and optional accounts. They add no optimal next-question path, hidden answer or film-specific clue. Existing search, Browse Questions and opening examples retain their behaviour.

The only supporting page is **/privacy/**, with its own title, description and canonical. It describes actual storage, account services and optional Analytics. The sitemap contains only the canonical homepage and this useful page. No future Daily puzzles, generated movie pages or query variants are added. robots.txt still allows crawling and points to the sitemap; the static 404 remains noindex. Export checks cover these facts, root-relative assets, old repository paths, crawlable support and structured data.

VideoGame/WebApplication JSON-LD describes the visible browser game, free access and JavaScript requirement. It includes no invented ratings, reviews, awards, prices, offers or player counts. Google may choose a different search title or snippet; structured data does not guarantee a rich result, ranking or indexing. [Google title guidance](https://developers.google.com/search/docs/appearance/title-link), [Schema.org VideoGame](https://schema.org/VideoGame), [Schema.org WebApplication](https://schema.org/WebApplication).

## Build-time public configuration

Keep the three existing public account values and add this fourth public value to ignored `.env.local`:

```dotenv
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-4923ZXESXM
```

`.env.example` documents the option; an empty or invalid measurement ID disables Analytics. The ID is public browser configuration and is expected in an Analytics-enabled static bundle. `.env.local` must remain ignored and uncommitted. It must contain no Google Client Secret, Supabase secret/service-role key, database password or other secret.

GitHub Pages has no runtime environment settings for this application. Rebuild `/docs` when changing public build values. Do not insert a second Google tag, Google Tag Manager container, Analytics plugin or automatic pageview snippet alongside this implementation.

## Event definitions

Application events use an explicit parameter allowlist. The game hooks run after accepted game actions, not from render effects or guesses based on browser navigation. No event contains a name, email, account identifier, auth token, puzzle/film identifier, movie title, question text, subject, answer or hidden mystery identity. Broad question groups are `release`, `genre`, `people`, `studios`, `awards` and `details`.

| Event | Actual trigger | Parameters |
| --- | --- | --- |
| `game_start` | First accepted question, or an accepted final guess with zero questions. Viewing a lineup is not a start. | `mode`: `daily` or `practice` |
| `question_asked` | A question accepted by the existing deduction engine. | `mode`, `question_number` (1–5), `question_category` (broad group) |
| `guess_submitted` | An accepted final guess. | `mode`, `correct` (boolean) |
| `game_complete` | The same accepted final guess reaches a win or loss. | `mode`, `outcome`: `won`/`lost`, `questions_used` (0–5), `films_remaining` (1–24) |
| `share_result` | Native sharing succeeds, or result/link copying succeeds. Cancellation and the manual-copy fallback do not claim a successful share. | `mode`, `share_method`: `native`, `copy_result` or `copy_link` |
| `login` | A successful active Google ID-token exchange through the official sign-in button. Session restoration/refresh does not count as a login. | `method`: `google` |
| `daily_return` | The first accepted action of a new current-day Daily attempt, when validated older Daily play exists in the same browser. | `mode`: `daily` |
| `question_browse` | The player actually opens Browse Questions. | `mode` |

**`sign_up` is not emitted.** Supabase’s ID-token result does not reliably identify a newly created account separately from an existing login. Comparing timestamps or assuming a first visit means a new account would invent an unreliable conversion. The event schema reserves `sign_up`/`method: google` for a future reliable signal; no current hook sends it.

A sanitized manual `page_view` is sent once per document after consent. The automatic config pageview is disabled. Daily/Practice query changes are mode changes in one game page, not extra page views. GA4 may also produce its standard session/engagement events after consent; those are distinct from LINEUP’s explicit game events. Google’s Enhanced Measurement must be disabled manually as described below. [Manual pageview guidance](https://developers.google.com/analytics/devguides/collection/ga4/views).

No `game_abandoned` event exists. For a useful consented-player funnel, compare `game_start` → `question_asked` → `guess_submitted` → `game_complete`, allowing the question step to be skipped by a zero-question guess. Compare completion event counts with start counts by mode over a suitable period; interpret the difference as non-completion within that observation window, not proof that someone abandoned a game. GA user-based funnels and aggregate event counts are not a perfect per-attempt join: no new player/puzzle identifier is transmitted.

## Consent, privacy and counting limitations

This is opt-in **basic consent mode**. Unknown/rejected Analytics does not load the GA script, send GA requests or set GA cookies, including cookieless denial pings. Accept and Reject have equal prominence, do not block the game or Google sign-in, and are remembered locally. The footer reopens preferences. Advertising storage, ad-user data and ad personalisation remain denied; Google signals and ad-personalisation signals are disabled in the tag. The source does not set a GA User-ID. [Google consent implementation guidance](https://developers.google.com/tag-platform/security/guides/consent).

Only the known homepage/privacy canonical address is sent as page location. Query strings, fragments and referrer details are removed. The subsequent [focused UX/attribution update](final-ux-analytics.md) allows only complete, validated promotional source/medium/campaign labels through standard campaign configuration fields after consent; arbitrary URL and callback data remain excluded. Google still receives normal network/device information after consent and uses pseudonymous Analytics cookies; the data is not described as wholly anonymous.

Consent uses `lineup:analytics:consent:v1`. Only after consent, `lineup:analytics:events:v1` stores bounded local event keys/timestamps to suppress repeat game events across rerenders, refresh, resume and available cross-tab storage updates. Those keys are never sent to GA4 and are not a cross-site identity. The ledger is limited to 5,000 entries/365 days; cookies use a non-rolling maximum 180-day lifetime. Clearing storage, unavailable storage, multiple devices, simultaneous tab races and blockers can prevent perfect deduplication or return recognition.

The tag is downloaded at most once per document. If it was blocked, or consent was withdrawn while its download was pending, reacceptance may require a page refresh before Analytics can run. An already-loaded runtime is reused without a duplicate document pageview. No automatic network retry occurs.

Withdrawal disables further application tracking/that GA stream, removes accessible Analytics cookies, clears queued/local analytics event records and follows saved changes across tabs where storage is available. Game storage and the Supabase session are preserved. Code already loaded in the browser cannot be unloaded as though it never ran, and withdrawing locally cannot erase data already received by Google. The owner needs a process for relevant data/erasure requests. Pre-consent actions are not stored for later replay, and consent granted midway through an attempt does not manufacture its earlier game start. Consequently, consent changes and blocked delivery can produce completions without a measured start; use the funnel directionally and document this limit.

Review [the privacy owner checklist](analytics-privacy-owner-review.md) and the public `/privacy/` wording before publication. The operator is **Daniel Lewis**, running LINEUP as an independent online game. **The owner has confirmed that privacy@dailylineup.co.uk forwarding is configured and successfully tested; keep it monitored.** Review applicable controller/contact details, functional-storage/account lawful bases, account-result retention, provider agreements and international transfers, rights/erasure handling and the intended audience. This implementation does not certify legal compliance or claim an analytics exemption.

## Manual GA4 settings before pushing

Use the existing property/web stream for **G-4923ZXESXM**. Do not create a duplicate tag/property merely to deploy this change. Admin labels can vary slightly; select the correct property first.

1. Open **Admin → Data collection and modification → Data streams → the LINEUP Web stream**. Confirm the website is `https://dailylineup.co.uk` and the measurement ID matches.
2. Turn **Enhanced measurement off** for this stream. Check the individual options if the interface requires it: disable history-based page changes, site search, forms, outbound clicks, scrolls, downloads and video measurement. This prevents automatic collection outside LINEUP’s explicit controls. `send_page_view: false` alone does not disable Enhanced Measurement’s history pageviews. [Enhanced Measurement settings](https://support.google.com/analytics/answer/9216061), [Google pageview guidance](https://developers.google.com/analytics/devguides/collection/ga4/views).
3. Under **Data collection**, keep **Google signals**, **user-provided data collection** and advertising personalisation disabled. Do not link Google Ads, enable remarketing or add advertising tags. Review any existing account/property sharing and linked-product settings; code cannot change them.
4. Open **Admin → Data collection and modification → Data retention**. Select **2 months** for user/event-level retention and disable reset-on-new-activity where available. Review/publish the owner’s chosen retention policy accurately. This setting is different from LINEUP’s 180-day cookie lifetime and does not promise deletion of all aggregated reports. [Google retention guidance](https://support.google.com/analytics/answer/7667196).
5. Under **Admin → Data display → Custom definitions**, add the event-scoped definitions below if needed for reports. Choose **Event** scope, use the exact parameter name and save. Do not create user-scoped definitions or high-cardinality identifiers. Existing standard definitions need not be duplicated. [Custom definitions](https://support.google.com/analytics/answer/14240153).

| Suggested event-scoped dimension | Parameter | Purpose |
| --- | --- | --- |
| Game mode | `mode` | Daily versus Practice |
| Question group | `question_category` | Broad categories only |
| Question number | `question_number` | Which of the five question slots was used |
| Result | `outcome` | Win/loss on completion |
| Share method | `share_method` | Native versus successful copying |
| Guess correct, optional | `correct` | Inspect the received boolean representation first; outcome already supports win/loss reporting |

`method` is fixed to `google`; register an event-scoped definition only if a useful report needs it. No account IDs, puzzle IDs, question subjects, emails or titles belong in custom definitions.

For numerical reporting, add **Custom metrics** for `questions_used` and `films_remaining`, using **Standard** units. Filter them to `game_complete`; for an average, divide the metric total by the corresponding completion count instead of displaying a summed metric as an average. Do not add a separate score or change LINEUP’s scoring. Allow normal reporting/definition processing time. [Custom metric instructions](https://support.google.com/analytics/answer/14239619).

After real data arrives, optionally mark `game_complete` as a key event if completion is the useful success measure. Do not create duplicate events in GA’s UI that recreate these application events. `sign_up` should remain absent until a reliable creation signal exists.

## Manual production Analytics validation

No local test proves real GA traffic. After the manual deployment, use a consenting test browser and **Reports → Realtime** to verify reception; normal reports can lag. **Admin → Data display → DebugView** requires a debug-enabled device. Use Google Tag Assistant for that test session, not a production-wide `debug_mode` switch or an extra installed tag. A consent rejection must continue to prevent collection, including during debugging. [Realtime/DebugView confirmation](https://support.google.com/analytics/answer/9333790), [DebugView setup](https://support.google.com/analytics/answer/7201382).

1. In a fresh browser profile on `https://dailylineup.co.uk/`, open DevTools **Network** and **Application/Storage**. Before making a choice, confirm there is no LINEUP GA tag request to `googletagmanager.com/gtag/js`, no GA `g/collect` request to Google Analytics endpoints and no `_ga`/`_ga_4923ZXESXM` cookies. Play a question while Analytics is still off; it must work and must not be replayed after later consent.
2. Choose **Reject analytics**. Reload and confirm the choice is remembered, gameplay still works and no Analytics collection starts. Independently test Google sign-in: its user-requested Google/Supabase requests are not GA requests and do not require enabling Analytics.
3. Reopen **Analytics preferences → Accept analytics**. Confirm one official GA script loads, one sanitized pageview is queued/sent and the event appears in Realtime. Browse Questions, ask a question, lock in and successfully copy/share a result. Inspect the documented events and safe parameters. On a fresh Practice attempt with prior consent, the first accepted question produces one `game_start`; every accepted question produces its slot event; the final guess produces one `guess_submitted` and one `game_complete`.
4. Refresh a partly played Daily and a completed Daily, switch modes and reopen the result. No start/completion should be invented by those views. A genuine subsequent new Practice attempt may have a new start. Cancel native sharing and deny clipboard permission: do not count a cancelled share or manual fallback as successful sharing.
5. Complete a real Google sign-in with consent on and check one `login`/`method: google`; refresh and restore the session without another login event. Confirm existing history, statistics and the same account still work. Expect no `sign_up` event. Test `daily_return` on a genuinely later UK date using existing saved Daily play; do not alter the published schedule or manufacture an account identity to force it.
6. Inspect event payloads and page locations for emails, names, IDs, tokens, query/hash/referrer text, question subjects or hidden film details. None belongs in the application data. Keep actual authentication/session data out of screenshots and reports.
7. Reopen preferences and choose **Reject analytics** to withdraw. Confirm accessible GA cookies disappear, further game actions produce no GA collection, progress stays intact and Google sign-in/session behaviour is unchanged. Check another open LINEUP tab, then reload. Test blocked Google tags/offline requests: guest play must remain usable. Network requests already in flight at withdrawal cannot be retroactively unsent.
8. Repeat the consent, account and game paths on mobile and desktop. Check that the preference panel never covers the poster grid or lock-in controls. Do not treat one synthetic test as field LCP/INP/CLS evidence; use real-user data when sufficient volume exists.

## Manual Search Console and GoDaddy handoff

1. Open [Google Search Console](https://search.google.com/search-console/), choose **Add property → Domain** and enter exactly **dailylineup.co.uk**. Do not enter a protocol, path or `www`. A Domain property covers the domain’s protocols and subdomains. Choose manual DNS verification if prompted. [Domain property instructions](https://support.google.com/webmasters/answer/34592).
2. Copy the unique TXT value supplied by Search Console, beginning **google-site-verification=**. This document does not invent that token. In GoDaddy, open the domain’s **DNS / Manage DNS → Add new record** and add: **Type TXT; Name/Host @; Value the exact Google-supplied string; TTL the default**. Add a new record: preserve existing GitHub Pages A records, CNAME records and other TXT records. If GoDaddy is not the authoritative DNS provider, add the TXT at the authoritative provider instead. [Google DNS verification](https://support.google.com/webmasters/answer/9008080), [GoDaddy TXT instructions](https://www.godaddy.com/help/add-a-txt-record-19232).
3. Save the TXT record, return to Search Console and click **Verify**. DNS propagation may require waiting and trying again. Keep the verification record after success so ownership can continue to be checked.
4. After the new static files are live, confirm `https://dailylineup.co.uk/sitemap.xml` opens publicly. In **Sitemaps → Add a new sitemap**, submit that full URL and check processing/fetch status. It should list only `/` and `/privacy/`. robots.txt also advertises it. [Sitemaps report](https://support.google.com/webmasters/answer/7451001).
5. Inspect **https://dailylineup.co.uk/** using **URL Inspection**, run **Test live URL**, review the fetched/rendered page and request indexing if indexable. Confirm the declared canonical is the custom-domain root. Google-selected canonical is shown in indexed data, not guaranteed by a live test. [URL Inspection instructions](https://support.google.com/webmasters/answer/9012289).
6. Monitor **Indexing → Pages** for exclusions/errors, **Performance → Search results** for impressions, clicks, queries and pages, and **Experience → Core Web Vitals** when enough real-user data exists. Investigate mobile fetch/layout and canonical issues before creating more pages. A successful sitemap submission or indexing request is not an indexing/ranking guarantee.

The old repository URL is excluded from canonical metadata and the sitemap. After publication, manually visit the old GitHub Pages address and confirm its redirect/custom-domain behaviour. Repository/domain redirects are hosting configuration, not something a canonical tag can force; no GitHub setting was changed here. Do not restore the `/lineup/` base path to address an indexing question.

## Local validation and GitHub Desktop publishing

Use the actual validation output and final Git result for this change; this note does not invent a passing test count or commit ID.

```sh
npm run lint
npm run typecheck
npm test
npm run audit:public
npm run build:pages
```

The final build must regenerate `/docs` and pass root/static SEO, sitemap, crawler, metadata, account public configuration and Analytics configuration checks. Keep `docs/CNAME` exactly `dailylineup.co.uk` followed by a newline. Existing game/account tests remain necessary alongside Analytics consent, safe-payload, once-per-action and SEO tests.

Once validation passes and the finished source plus generated `/docs` are committed locally to **main**:

1. Finish the owner/privacy review, keep the confirmed privacy email monitored and apply the GA property checks above manually.
2. In GitHub Desktop, choose the LINEUP repository and confirm **main**. Review the completed local commit; `.env.local` must be absent.
3. Click **Push origin** when ready. Keep GitHub Pages publishing from **main /docs**; no new workflow, server, domain change or hosting service is needed.
4. Wait for GitHub Pages to publish, then perform the production Analytics and Search Console checks above. Until that manual push occurs, the live site remains untouched by these local changes.


## Recorded completion checks — 27 October 2026

The interrupted SEO implementation was already present in the main checkout, together with the analytics core and consent/privacy drafts. No separate agent branch or worktree needed merging. Completion work preserved those changes, finished lifecycle/consent and accepted-action tests, added the operator details and owner-review requirements, validated compiled Analytics configuration and rebuilt the static site.

- ESLint and TypeScript checks passed; **336 automated tests passed**. The existing Google authentication, account/results/statistics, question examples, Daily calendar, catalogue and sharing tests remain in the passing suite.
- `npm run audit:public` found no credentials or private metadata. `.env.local` remains ignored and untracked; the supplied public GA Measurement ID is present at build time.
- `npm run build:pages` passed. `/docs` contains the verified **96-file, approximately 5.03 MB** static export. CNAME remains `dailylineup.co.uk`; root paths, canonical/social metadata, two-page sitemap, crawler policy, noindex404, crawlable support, JSON-LD and public account/Analytics configuration passed export checks. No eager GA tag/preload appears in exported HTML.
- A local static server at `http://localhost:3000/` served the built files. At 375px mobile and 1280px desktop widths, guest Daily resume/Browse, Practice questions/final guess/results and support copy worked. Opening examples disappeared after the first question. The Google sign-in button remained available with Analytics rejected; no real account was selected.
- Browser DOM checks showed zero GA tags with unknown/rejected consent, one after acceptance, zero after withdrawal and persistent rejection after reload. Granting/withdrawing updated a second open tab. Equal mobile choice sizes were verified. Cookie deletion and safe event payloads were verified through injected browser tests; actual Network/Cookie inspection and GA reception still require the manual production checklist.
- A read-only HTTP check observed the existing old GitHub Pages URL returning **301** to the custom-domain root. No redirect, DNS or hosting setting was changed.
- No field LCP/INP/CLS result, search indexing, real Google account continuity or real production GA traffic is claimed. No push, deployment or external settings change was performed. Confirm privacy-mailbox forwarding and the owner/GA property requirements before publication.

# Focused consent, attribution and Practice refinements

This change follows `70b0498` and preserves the one-suggestion allowance, Daily/Practice progress, account system, existing Analytics events, SEO and static main/docs deployment. The working tree was clean before implementation. No Google Analytics, Supabase, GitHub or GoDaddy setting was changed.

## Visible, fixed consent controls

The previous consent component was in normal document flow after the footer, so new visitors had to scroll past the game to see it. Reopening also focused that footer-area heading without preventing scrolling.

The existing component is now a compact, non-modal fixed panel at the viewport bottom. Safe-area insets cover mobile edges; equally styled Accept/Reject buttons remain together and visible on narrow screens. The copy can scroll independently on very short viewports while the action row remains visible. A ResizeObserver measures the panel and reserves bottom/anchor clearance so the last page controls can be scrolled above it. Native game/account dialogs remain in the browser's top layer above the panel.

Initial display does not take focus. Explicit reopening focuses the visible panel with `preventScroll`, and closing restores the invoking control without scrolling. An initial choice no longer moves focus to the footer. Stored decisions still suppress the initial banner; the footer's Analytics preferences control remains. Consent defaults, rejection, withdrawal, cookie cleanup, no advertising and gameplay/sign-in independence are unchanged.

## Broad campaign labels only after consent

Supported query names are `utm_source`, `utm_medium` and `utm_campaign`. One complete, unambiguous triplet is required:

| Field | Approved values |
| --- | --- |
| Source | reddit, playlin, foundplay, slowden, facebook, discord, letterboxd |
| Medium | community, directory, social |
| Campaign | public_testing, launch |

Keys/values normalise case, and ordinary surrounding ASCII spaces are trimmed. Duplicate keys, unapproved/missing/malformed/control/non-ASCII values, values over 32 characters or a URL over 8,192 characters discard the triplet. Other query keys, including OAuth codes/tokens and arbitrary UTM fields, are ignored and never passed on. Fragments and referring URLs are not used.

The current URL is read for campaigns only when Analytics is being installed after consent. Accepting while a valid tagged link remains present can capture it; leaving that URL before accepting cannot replay its tags or earlier gameplay. No campaign persistence or visit cache is added. A later document uses its own URL. Reconfiguration without valid tags clears the three campaign overrides so stale runtime values are not reused.

Approved labels go into Google's supported `campaign_source`, `campaign_medium` and `campaign_name` configuration fields. They are not new gameplay event parameters. The existing canonical `page_location` and blank referrer remain unchanged and contain no query/hash data. No second tag or duplicate pageview is added. Names, emails, account IDs, authentication data and mystery-film details are excluded. Google still receives its ordinary technical information after consent, as the Privacy Policy explains.

The Privacy Policy now briefly describes consented broad campaign tracking. Daniel Lewis is the operator. The owner confirmed that privacy@dailylineup.co.uk forwarding is configured and successfully tested; its earlier unconfirmed-mailbox warning has been updated. The remaining privacy/retention owner responsibilities are unchanged.

Reference: [Google Analytics configuration fields](https://developers.google.com/analytics/devguides/collection/ga4/reference/config).

## Practice wording

Only the completed-Daily primary navigation button and the Daily result dialog's equivalent CTA change from **Play Practice** to **Practice**. Their elements, classes, styles, dimensions and callbacks remain unchanged. Contextual fallback/instructional copy is not globally replaced.

## Ready-to-use promotional links

- Reddit: https://dailylineup.co.uk/?utm_source=reddit&utm_medium=community&utm_campaign=public_testing
- Playlin: https://dailylineup.co.uk/?utm_source=playlin&utm_medium=directory&utm_campaign=public_testing
- Foundplay: https://dailylineup.co.uk/?utm_source=foundplay&utm_medium=directory&utm_campaign=public_testing
- SlowDen: https://dailylineup.co.uk/?utm_source=slowden&utm_medium=directory&utm_campaign=public_testing
- Facebook: https://dailylineup.co.uk/?utm_source=facebook&utm_medium=social&utm_campaign=public_testing
- Discord: https://dailylineup.co.uk/?utm_source=discord&utm_medium=community&utm_campaign=public_testing

For the launch phase, change only `utm_campaign=public_testing` to `utm_campaign=launch`. Letterboxd is also supported with source `letterboxd` and medium `social`.

## Manual verification after GitHub Desktop Push origin

1. Open an example link in a fresh browser profile. Before accepting, the compact panel should be visible without scrolling; DevTools Network must show no GA tag or collection request, and no Analytics cookies should exist. Scroll and check the panel stays at the viewport bottom. Confirm both buttons are visible on narrow mobile/short landscape screens.
2. Reject, reload and confirm no repeat initial panel or Analytics collection. Play a question and open Google sign-in independently. Reopen preferences from the footer: the fixed panel should appear without jumping the document. Native dialogs should keep their controls accessible above it.
3. In a separate fresh test profile, accept while the complete campaign URL is still present. Check one GA tag/pageview and the supported campaign fields in Tag Assistant/DebugView or collection details. `page_location` must remain the canonical root; arbitrary query/OAuth/referrer values must never appear. Repeat with missing/invalid/duplicate tags: no unapproved label should be recorded.
4. Inspect GA4 Realtime/DebugView, then Traffic acquisition using **Session source / medium** and **Session campaign**. The intended report values are the approved labels. Reporting can take time. Community/directory are custom broad mediums and may appear as Unassigned in Google's default channel grouping; use the built-in source/medium/campaign dimensions rather than assuming a channel-group label. Existing active GA sessions can retain normal session attribution, so use a fresh test session/profile to compare campaigns.
5. Withdraw consent and confirm further collection stops and accessible GA cookies are deleted. Existing in-flight requests cannot be recalled. Reload and check the decision remains remembered; the existing blocked-tag/regrant refresh limitation remains documented in the analytics owner notes. No production-wide debug mode or extra tag is required.
6. Complete Daily normally. The cobalt CTA and Daily result CTA should read **Practice** and open Practice exactly as before. Confirm suggestion selection/submission and saved allowance, Daily resume and Practice resume still behave normally.

No real production reception, GA reporting classification or physical iPhone safe-area behaviour is claimed solely from local automated tests. Keep Enhanced Measurement and advertising/user-provided-data features disabled as already documented. No external configuration change is required by these code refinements.


## Recorded local validation — 27 October 2026

- ESLint, TypeScript and **378 automated tests** passed. Campaign tests cover valid Reddit/directories, case/space normalisation, invalid/missing/long/duplicate values, OAuth/unexpected fields, no reads/transmission/persistence before consent, no event replay, single pageview/tag and fresh-visit/regrant attribution.
- `npm run audit:public` reported no credential/private-metadata findings; `.env.local` remains ignored. `npm run build:pages` passed and rebuilt the 96-file/about 5.04 MB static `/docs` export. Root assets, public configuration, canonical/SEO/structured data, crawler files and `docs/CNAME` passed existing guards.
- An ordinary local static server on `http://localhost:3001/` supplied a fresh consent origin. Initial desktop display kept scroll at zero, placed the banner 12px above the viewport bottom and rendered equal 44px controls, with no GA tag. Scrolling kept that same anchor. At 320×568, 375×812 and 568×320, both choices remained visible with no horizontal overflow; landscape copy/actions fit separately.
- Initial rejection preserved the existing scroll position. Reload remembered it and loaded no GA tag. Explicit footer reopening preserved the measured scroll position (1561px before and after) and displayed the panel inside the viewport. Accepting loaded one GA tag with canonical page metadata; withdrawing removed the tag. Cookie cleanup and approved config payloads are covered by automated tests; real Network/Cookie and GA reporting checks remain manual.
- The local Daily could be completed without consent while native dialogs remained usable. Its result and completed panel both displayed Practice; the unchanged primary-button class/46px height and working Practice navigation were checked. Existing one-suggestion, persistence/account and consent tests remain in the full passing suite.
- No live deployment, external settings change or verified production GA reception is claimed. Physical iPhone safe-area behaviour and actual GA source reporting remain live-device/production checks.

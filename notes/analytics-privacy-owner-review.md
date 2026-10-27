# Analytics and privacy — owner review before publication

This document records implementation facts and remaining operator decisions. It does not certify legal compliance. No Google, Supabase, GitHub or GoDaddy settings were changed automatically.

## Pre-publication requirement: confirm the privacy mailbox

**Do not publish until forwarding/delivery for privacy@dailylineup.co.uk is confirmed and the mailbox is monitored.** The owner has supplied the address but has not yet confirmed forwarding. Send a real test message and verify receipt; the website cannot check mailbox delivery.

## Public notice and contact

The public static `/privacy/` page describes local game storage, Supabase Google authentication, account-linked Daily results, provider requests, optional GA4, consent, cookie lifetimes, withdrawal and data requests. The owner supplied **privacy@dailylineup.co.uk** as the public privacy contact. Check that it exists, receives mail and is monitored before publishing.

The owner supplied **Daniel Lewis, operating LINEUP as an independent online game** as the operator. The public notice now states this. Review whether an additional business/contact address or representative details are required for the intended audience and circumstances; no address or incorporated legal entity was invented.

## Decisions to confirm

- Confirm and document the lawful basis for functional game storage, account authentication and saved Daily history. The implementation uses **opt-in consent for GA4** and makes no claim that a statutory analytics exception applies. The absence of advertising is not an exemption.
- Choose and publish appropriate retention/deletion periods for account/profile data and saved results. The present account system has no automatic expiry, which the notice states. Review local Daily/history retention as well; clearing local storage does not delete account data.
- Verify Google Analytics **Data retention** settings in the actual property. The tag's **180-day, non-rolling cookie lifetime** is a browser setting, not a promise about Google's server-side event/report retention. Set event-level retention deliberately (for example the shortest suitable option), review any reset-on-new-activity option, and make the notice reflect the selected policy. GA4 settings and available periods must be checked in the account; none were changed here.
- Turn off Enhanced Measurement in this GA4 web stream before publishing. This avoids automatic extra events/history/form/search measurement outside the explicit allowlist. Keep Google signals, advertising features, user-provided data collection, Google Ads links, remarketing and advertising personalisation disabled. The source also requests the relevant privacy settings, but cannot change the property's administration.
- Review the appropriate Google/Supabase/GitHub processor/controller terms and data-processing agreements, actual Supabase region, provider subprocessors and international-transfer safeguards. Do not assume a provider's general privacy policy is a substitute for LINEUP's own obligations. No region or safeguard was invented in the public notice.
- Review whether any additional children's/privacy disclosures are necessary for the intended audience and jurisdictions. No age verification, advertising, profiling or new registration requirement was added.

## Withdrawal and erasure limitation

Rejecting Analytics after granting consent immediately disables further application tracking, disables the GA stream, removes accessible Analytics cookies and clears the analytics event ledger. A saved preference is followed across tabs where browser storage works. No pre-consent actions are replayed later.

That local control **cannot itself erase data already sent to Google**. The public notice gives the privacy contact for requests. Establish an owner-operated procedure for handling withdrawal-related erasure requests, notifying relevant recipients where required, finding/deleting identifiable GA data using supported Google tools, and replying to the user. Cookie removal and the lack of a LINEUP analytics account ID can limit retrospective identification; do not promise that aggregate reports can be mapped to a particular person.

Current ICO guidance treats withdrawal from consent-based storage/access processing as an erasure request for personal data gathered under that consent. Review how to fulfil that requirement in the actual GA property before publication. A manual recipient/data-deletion workflow is an outstanding operational responsibility, not a feature the static browser code can prove complete. Do not silently retain consent-derived personal data under another lawful basis after withdrawal.

Requests must never ask users to send access/refresh tokens, Google ID tokens, passwords or full session objects. For account requests, verify ownership through an appropriate safe process before reading/deleting private results. Do not weaken RLS or expose service-role credentials to the browser to facilitate deletion.

## Consent records and browser limits

The local preference record holds a version and accept/reject choice. It is not a central consent-management database. Review whether local evidence is sufficient for the site's accountability needs. Consent is remembered until changed/cleared, with a versioned format so materially changed purposes can request a fresh choice. Browsers blocking storage can only retain the choice for the current document.

Only one Analytics tag download is attempted in each document, preventing duplicate runtimes. If the tag was blocked or consent was withdrawn while it was still loading, a later acceptance is remembered but Analytics may require a page refresh. Reaccepting after a fully loaded runtime reuses it without a duplicate page view. Already-started network requests cannot be recalled; withdrawal prevents subsequent collection and removes accessible GA cookies. Gameplay remains available throughout.

Analytics cookies are pseudonymous identifiers; the site must not call all GA4 information anonymous. GA receives ordinary network/device information after consent even though application event parameters omit names, email, account IDs, tokens and hidden film data. The implementation does not set a GA User-ID or introduce a cross-site player identity. Sanitised page locations and blank referrers trade acquisition detail for reduced disclosure.

## Owner release checks

1. Confirm privacy-mailbox forwarding/delivery and monitoring before publication. Review the public notice and the items above, especially operator/contact details, retention, international processing and erasure handling.
2. Verify opt-in, rejection, withdrawal, cookie deletion and remembered preferences on the deployed domain in an ordinary browser, including another open tab. Confirm no Analytics requests/cookies before opt-in. Google sign-in is a separate, user-requested service and may contact Google without Analytics consent.
3. Inspect GA Realtime or DebugView with a consenting test browser, confirm only the documented safe events/parameters, then withdraw consent and verify no subsequent collection. No real production traffic is claimed by local tests.
4. Test account persistence, saved Daily history, guest progress and Google sign-in separately from Analytics consent. Do not delete real player data merely to test this analytics change.

Official references checked for this change:

- [ICO storage and access technology guidance, updated April 2026](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/)
- [ICO consent and withdrawal guidance](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/how-do-we-manage-consent-in-practice/)
- [Google Analytics cookie and privacy configuration](https://developers.google.com/analytics/devguides/collection/ga4/reference/config)
- [Google's handling of data from partner sites](https://policies.google.com/technologies/partner-sites)
- [Supabase customer-data processing information](https://supabase.com/privacy)

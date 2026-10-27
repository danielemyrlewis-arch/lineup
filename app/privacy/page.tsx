/* eslint-disable @next/next/no-html-link-for-pages -- Full document navigation gives each static page its own consent-gated analytics lifecycle. */
import type { Metadata } from "next";
import { AnalyticsPreferencesButton } from "@/components/analytics/analytics-consent";
import { SITE_URL, SOCIAL_IMAGE } from "@/lib/site";

const title = "Privacy & cookies | LINEUP";
const description = "How LINEUP uses local game storage, optional Google accounts and opt-in analytics, and how to manage your privacy choices.";
const url = new URL("privacy/", SITE_URL).href;
export const metadata: Metadata = {
  title,
  description,
  alternates: {canonical: url},
  openGraph: {type: "website", locale: "en_GB", siteName: "LINEUP", title, description, url, images: [SOCIAL_IMAGE]},
  twitter: {card: "summary_large_image", title, description, images: [{url: SOCIAL_IMAGE.url, alt: SOCIAL_IMAGE.alt}]},
};

export default function PrivacyPage() {
  return <div className="privacy-shell">
    <a className="skip-link" href="#privacy-content">Skip to privacy information</a>
    <header className="privacy-header">
      <a className="brand" href="/" aria-label="LINEUP — home">LINEUP</a>
      <a href="/">Back to the game</a>
    </header>
    <main className="privacy-page" id="privacy-content">
      <h1>Privacy &amp; cookies</h1>
      <p className="privacy-updated">Updated <time dateTime="2026-10-27">27 October 2026</time></p>
      <p>LINEUP is operated by Daniel Lewis as an independent online game and is free to play without an account. This notice explains the information used to run the game, optional account features and optional Google Analytics. Privacy questions or data requests can be sent to <a href="mailto:privacy@dailylineup.co.uk">privacy@dailylineup.co.uk</a>.</p>

      <section aria-labelledby="privacy-game-storage">
        <h2 id="privacy-game-storage">Playing in this browser</h2>
        <p>LINEUP uses localStorage on your device to resume Daily progress, remember Practice history and statistics, and keep interface preferences. LINEUP does not upload these stored records to Google Analytics; optional Analytics only receives the limited events described below. Clearing website data removes your local progress and preferences.</p>
        <ul>
          <li><span className="privacy-storage-name">Daily progress</span> — <code>lineup:daily:progress:v1:…</code> keeps each day’s questions, suggestion allowance, eliminations and completion in this browser.</li>
          <li><span className="privacy-storage-name">Unfinished Practice</span> — <code>lineup:practice:progress:v1</code> keeps the current lineup, questions and suggestion allowance so an unfinished game can resume after reopening. It is replaced by a new lineup and removed when the game is completed.</li>
          <li><span className="privacy-storage-name">Practice and help</span> — <code>lineup:practice:v1</code>, <code>lineup:practice-films:v1</code>, <code>lineup:help-seen</code> and <code>lineup:strategy-hint-dismissed:v1</code> keep local statistics, recent lineups and help preferences.</li>
          <li><span className="privacy-storage-name">Results awaiting an account save</span> — <code>lineup:account:guest-results:v1</code> keeps completed Daily summaries locally. Signing in does not automatically import a restored guest result; you can choose Save to account.</li>
        </ul>
        <p>These records remain until they are replaced by the game or you clear them. Recent Practice history is bounded; older Daily progress and local statistics do not have an automatic deletion date. If storage is blocked, some features use memory for the current page and may not survive a refresh.</p>
      </section>

      <section aria-labelledby="privacy-accounts">
        <h2 id="privacy-accounts">Optional Google accounts</h2>
        <p>When you open Sign in, LINEUP loads Google’s official sign-in button. If you continue, Google supplies an identity token that Supabase verifies to establish your account session. Google and Supabase receive the information needed to authenticate you, including your Google identity and basic profile details. Your name and email can appear in your private Account panel.</p>
        <p>The session is kept separately in <code>lineup:auth:v1</code> so you can remain signed in. Signing out removes that browser session; it does not delete your account or saved history.</p>
        <p>Supabase stores completed Daily results linked to your account: user ID, puzzle identifier and date, win or loss, questions used, films remaining, deduction counts and completion time. LINEUP uses these records for your private history, statistics and streaks. Practice does not enter account Daily statistics. There is no public leaderboard. The game runs in the browser; saved results are not claimed to be cheat-proof.</p>
        <p>Saved account information currently has no automatic expiry. Contact <a href="mailto:privacy@dailylineup.co.uk">privacy@dailylineup.co.uk</a> to request access, correction or deletion. Unfinished game progress remains in your browser.</p>
      </section>

      <section aria-labelledby="privacy-analytics">
        <h2 id="privacy-analytics">Optional analytics</h2>
        <p>Google Analytics 4 stays off until you choose Accept analytics. Before that choice, LINEUP does not load the Analytics tag, send Analytics requests or set Analytics cookies. Reject analytics leaves it off. We use basic consent mode, without advertising, remarketing, Google signals or advertising personalisation.</p>
        <p>If you accept, Analytics measures game starts, question counts and broad categories, completion outcomes, final-guess success, successful result sharing, Google sign-ins, question browsing and reliably observed Daily returns. It also receives ordinary technical information such as browser/device details and request information that can be used for approximate location. Google uses a pseudonymous cookie identifier; omitting account details does not make all Analytics data anonymous.</p>
        <p>LINEUP does not send names, email addresses, Supabase or Google account IDs, authentication tokens, question text, movie titles or mystery-film answers to Analytics. Page addresses are limited to the known website pages, with query strings, fragments and referrer details removed. No new cross-site player identity is created.</p>
        <ul>
          <li><span className="privacy-storage-name">Analytics choice</span> — <code>lineup:analytics:consent:v1</code> remembers accept or reject until you change it or clear website data.</li>
          <li><span className="privacy-storage-name">Event protection</span> — after consent, <code>lineup:analytics:events:v1</code> keeps a bounded local record to avoid repeating game events on refresh or resume. These local keys are not sent to Google.</li>
          <li><span className="privacy-storage-name">Analytics cookies</span> — <code>_ga</code> and <code>_ga_4923ZXESXM</code> support Google’s usage measurement. LINEUP configures a maximum lifetime of 180 days without extending it on each visit; browsers may remove them sooner.</li>
        </ul>
        <p>Use Analytics preferences in the footer to change your choice. Rejecting after accepting disables new collection and removes accessible Analytics cookies from this browser. Requests already in flight cannot be recalled. It does not clear your game progress or sign you out. Other open LINEUP tabs follow a saved preference change when browser storage is available.</p>
        <p>The browser preference cannot automatically erase information already received by Google. For a request concerning previously collected personal data, email <a href="mailto:privacy@dailylineup.co.uk">privacy@dailylineup.co.uk</a>. We may need enough information to identify the applicable data; never send passwords or authentication tokens. If storage is blocked, your preference may only last for the current page and you may be asked again on another visit.</p>
      </section>

      <section aria-labelledby="privacy-services">
        <h2 id="privacy-services">Services used by LINEUP</h2>
        <p>GitHub Pages serves the static website. Some posters and cast images load from TMDB’s image service. Those requests, like ordinary website requests, disclose network and browser information to the service delivering them. Fonts are hosted with LINEUP.</p>
        <p>Google handles optional sign-in and, only with consent, Analytics. Supabase handles optional accounts and saved results. These providers may process information outside your country. Their privacy information describes their own handling of data: <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement">GitHub</a>, <a href="https://policies.google.com/privacy">Google</a>, <a href="https://policies.google.com/technologies/partner-sites">Google services on other websites</a>, <a href="https://supabase.com/privacy">Supabase</a> and <a href="https://www.themoviedb.org/privacy-policy">TMDB</a>.</p>
      </section>

      <section aria-labelledby="privacy-choices">
        <h2 id="privacy-choices">Your choices and requests</h2>
        <p>You can reject or withdraw Analytics without losing access to the game or Google sign-in. You can sign out or clear local website data through your browser. Browser privacy signals do not replace the explicit Analytics choice on this site.</p>
        <p>Depending on applicable law, you may have rights to access, correct or erase personal data, restrict or object to its use, or request a portable copy. Contact <a href="mailto:privacy@dailylineup.co.uk">privacy@dailylineup.co.uk</a> to make a request or ask about retention and international processing. You can also raise a concern with the <a href="https://ico.org.uk/make-a-complaint/">UK Information Commissioner’s Office</a> or your local data protection authority.</p>
      </section>
    </main>
    <footer className="privacy-footer">
      <a href="/">Back to LINEUP</a>
      <AnalyticsPreferencesButton />
    </footer>
  </div>;
}

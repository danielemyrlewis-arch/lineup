"use client";
import { useEffect, useRef, useState, type RefObject } from "react";
import { getAnalyticsConsent, setAnalyticsConsent, startAnalytics, subscribeAnalyticsConsent } from "@/lib/analytics";

const OPEN_PREFERENCES = "lineup:analytics:preferences";
type Choice = "unknown" | "granted" | "denied";

/** Reopens the one shared preferences panel without changing consent. */
export function AnalyticsPreferencesButton() {
  return <button type="button" className="analytics-preferences-button" data-analytics-preferences
    onClick={() => window.dispatchEvent(new Event(OPEN_PREFERENCES))}>Analytics preferences</button>;
}

export function AnalyticsPreferencePanel({consent, onChoice, onClose, headingRef}: {
  consent: Choice;
  onChoice: (choice: "granted" | "denied") => void;
  onClose?: () => void;
  headingRef?: RefObject<HTMLHeadingElement | null>;
}) {
  return <section className="analytics-consent" aria-labelledby="analytics-preferences-heading">
    <div className="analytics-consent-copy">
      <h2 id="analytics-preferences-heading" ref={headingRef} tabIndex={-1}>Optional analytics</h2>
      <p>May we use Google Analytics to understand how LINEUP is played? It receives usage and browser information after you accept. We don’t send your name, email, account ID or film answers.</p>
      <p>Daily, Practice and Google sign-in work whichever you choose. You can change your choice here at any time. <a href="/privacy/">Privacy &amp; cookies</a></p>
      {consent !== "unknown" && <p className="analytics-consent-current" role="status">
        {consent === "granted" ? "Analytics is on. Reject analytics to withdraw consent and remove analytics cookies from this browser." : "Analytics is off."}
      </p>}
    </div>
    <div className="analytics-consent-actions">
      <button type="button" className="analytics-choice" onClick={() => onChoice("granted")}>Accept analytics</button>
      <button type="button" className="analytics-choice" onClick={() => onChoice("denied")}>Reject analytics</button>
      {onClose && <button type="button" className="analytics-consent-close" onClick={onClose}>Close preferences</button>}
    </div>
  </section>;
}

/** In-flow and non-modal: no analytics or preference read runs during static rendering. */
export function AnalyticsConsent() {
  const [consent, setConsent] = useState<Choice | null>(null);
  const [requested, setRequested] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const sync = () => setConsent(getAnalyticsConsent());
    const unsubscribe = subscribeAnalyticsConsent(sync);
    const stop = startAnalytics();
    sync();
    const open = () => {
      previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setRequested(true);
    };
    window.addEventListener(OPEN_PREFERENCES, open);
    return () => { unsubscribe(); stop(); window.removeEventListener(OPEN_PREFERENCES, open); };
  }, []);
  useEffect(() => { if (requested) heading.current?.focus(); }, [requested]);
  const restoreFocus = () => {
    const target = previousFocus.current?.isConnected ? previousFocus.current : document.querySelector<HTMLElement>("[data-analytics-preferences]");
    target?.focus({preventScroll: true});
  };
  const choose = (choice: "granted" | "denied") => {
    setAnalyticsConsent(choice);
    setConsent(getAnalyticsConsent());
    setRequested(false);
    setAnnouncement(`Analytics preference saved: ${choice === "granted" ? "on" : "off"}.`);
    restoreFocus();
  };
  return <>
    {consent !== null && (consent === "unknown" || requested) && <AnalyticsPreferencePanel consent={consent}
      headingRef={heading} onChoice={choose}
      onClose={consent === "unknown" ? undefined : () => { setRequested(false); restoreFocus(); }} />}
    <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
  </>;
}

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

export function AnalyticsPreferencePanel({consent, onChoice, onClose, headingRef, panelRef}: {
  consent: Choice;
  onChoice: (choice: "granted" | "denied") => void;
  onClose?: () => void;
  headingRef?: RefObject<HTMLHeadingElement | null>;
  panelRef?: RefObject<HTMLElement | null>;
}) {
  return <section ref={panelRef} className="analytics-consent" aria-labelledby="analytics-preferences-heading"
    onKeyDown={event => { if (event.key === "Escape" && onClose) { event.preventDefault(); onClose(); } }}>
    <div className="analytics-consent-copy">
      <h2 id="analytics-preferences-heading" ref={headingRef} tabIndex={-1}>Optional analytics</h2>
      <p>May we use Google Analytics to understand how LINEUP is played? Daily, Practice and Google sign-in work either way. <a href="/privacy/">Privacy &amp; cookies</a></p>
      {consent !== "unknown" && <p className="analytics-consent-current" role="status">
        {consent === "granted" ? "Analytics is on. Reject to withdraw consent and remove analytics cookies." : "Analytics is off."}
      </p>}
    </div>
    <div className="analytics-consent-actions">
      <button type="button" className="analytics-choice" onClick={() => onChoice("granted")}>Accept analytics</button>
      <button type="button" className="analytics-choice" onClick={() => onChoice("denied")}>Reject analytics</button>
      {onClose && <button type="button" className="analytics-consent-close" onClick={onClose}>Close preferences</button>}
    </div>
  </section>;
}

/** Fixed and non-modal: no analytics or preference read runs during static rendering. */
export function AnalyticsConsent() {
  const [consent, setConsent] = useState<Choice | null>(null);
  const [requested, setRequested] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const panel = useRef<HTMLElement>(null);
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
  const visible = consent !== null && (consent === "unknown" || requested);
  useEffect(() => { if (requested) heading.current?.focus({preventScroll: true}); }, [requested]);
  useEffect(() => {
    if (!visible || !panel.current) return;
    const banner = panel.current;
    const root = document.documentElement;
    const previous = root.style.getPropertyValue("--analytics-consent-space");
    const reserveSpace = () => {
      const bottom = Number.parseFloat(window.getComputedStyle(banner).bottom) || 0;
      root.style.setProperty("--analytics-consent-space", `${Math.ceil(banner.getBoundingClientRect().height + bottom + 12)}px`);
    };
    reserveSpace();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(reserveSpace);
    observer?.observe(banner);
    window.addEventListener("resize", reserveSpace);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", reserveSpace);
      if (previous) root.style.setProperty("--analytics-consent-space", previous);
      else root.style.removeProperty("--analytics-consent-space");
    };
  }, [visible, requested, consent]);
  const restoreFocus = () => {
    if (previousFocus.current?.isConnected) previousFocus.current.focus({preventScroll: true});
  };
  const choose = (choice: "granted" | "denied") => {
    setAnalyticsConsent(choice);
    setConsent(getAnalyticsConsent());
    setRequested(false);
    setAnnouncement(`Analytics preference saved: ${choice === "granted" ? "on" : "off"}.`);
    if (requested) restoreFocus();
  };
  return <>
    {visible && <AnalyticsPreferencePanel consent={consent!}
      headingRef={heading} panelRef={panel} onChoice={choose}
      onClose={consent === "unknown" ? undefined : () => { setRequested(false); restoreFocus(); }} />}
    <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
  </>;
}

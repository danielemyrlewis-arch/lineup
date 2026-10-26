"use client";
import { useEffect, useState } from "react";
import { Dialog } from "../game/dialog";
import { calculateDailyStatistics } from "@/lib/account/statistics";
import { londonDate, nextLondonMidnight } from "@/lib/game/daily-date";
import type { CompletedDailyResult, DailyResult } from "@/lib/account/results";

export interface AccountPanelProps {
  status: "loading" | "signed-in" | "signed-out" | "unavailable";
  user: { name: string; email: string | null } | null;
  error: string | null;
  authBusy: boolean;
  resultsLoading: boolean;
  resultsError: string | null;
  results: DailyResult[];
  pending: CompletedDailyResult | null;
  saveStatus: "idle" | "saving" | "saved" | "duplicate" | "error";
  saveError: string | null;
  onSignIn: () => void;
  onSignOut: () => void;
  onRetry: () => void;
  onSaveGuest: () => void;
  onClose: () => void;
}
const calendarDate = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London", day: "numeric", month: "short", year: "numeric",
});
const displayDate = (date: string) => calendarDate.format(new Date(`${date}T12:00:00.000Z`));
const countQuestions = (count: number) => `${count} question${count === 1 ? "" : "s"}`;
const puzzleLabel = (number: number) => `LINEUP #${String(number).padStart(3, "0")}`;

/** Optional account controls share the game's existing accessible dialog shell. */
export function AccountPanel(props: AccountPanelProps) {
  const [visibleHistory, setVisibleHistory] = useState(12);
  const [today, setToday] = useState(londonDate);
  useEffect(() => {
    let boundary: ReturnType<typeof setTimeout>;
    const checkDate = () => {
      const now = new Date();
      setToday(londonDate(now));
      clearTimeout(boundary);
      boundary = setTimeout(checkDate, nextLondonMidnight(now).getTime() - now.getTime() + 100);
    };
    const visible = () => { if (document.visibilityState === "visible") checkDate(); };
    checkDate();
    window.addEventListener("focus", checkDate);
    document.addEventListener("visibilitychange", visible);
    // A suspended tab checks on return; foreground device-clock changes are bounded.
    const clock = setInterval(checkDate, 60_000);
    return () => {
      clearTimeout(boundary); clearInterval(clock);
      window.removeEventListener("focus", checkDate);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);
  const signedIn = props.status === "signed-in" && props.user !== null;
  const stats = calculateDailyStatistics(props.results, today);
  return (
    <Dialog title="Your account" onClose={props.onClose} className="account-dialog">
      <h2>Your account</h2>
      {props.error && <p className="error-text" role="alert">{props.error}</p>}
      {props.status === "loading" && <p className="account-copy" role="status">Checking your session… You can keep playing.</p>}
      {props.status === "unavailable" && <div className="account-welcome">
        <p className="account-copy">Accounts aren’t available right now. Daily and Practice are still free to play, and your game stays in this browser.</p>
        <button type="button" className="secondary-button" onClick={props.onRetry} disabled={props.authBusy}>Try again</button>
      </div>}
      {props.status === "signed-out" && <div className="account-welcome">
        <h3>Keep your Daily results.</h3>
        <p className="account-copy">Sign in to save your Daily results, see your statistics and keep track of your winning streak.</p>
        {props.pending && <p className="account-copy">Your completed Daily is available in this browser. After signing in, you can choose to save it to your account.</p>}
        <button type="button" className="primary-button" onClick={props.onSignIn} disabled={props.authBusy}>
          {props.authBusy ? "Connecting…" : "Continue with Google"}
        </button>
        <p className="account-small">Always optional. You can play Daily and Practice without an account.</p>
      </div>}
      {signedIn && <>
        <div className="account-identity">
          <div><h3>{props.user!.name}</h3>{props.user!.email && <p>{props.user!.email}</p>}</div>
          <button type="button" className="text-button" onClick={props.onSignOut} disabled={props.authBusy}>
            {props.authBusy ? "Signing out…" : "Sign out"}
          </button>
        </div>
        {(props.pending || props.saveStatus !== "idle") && <section className="account-save" aria-label="Save completed Daily">
          {props.saveStatus === "saved" && <p className="account-copy" role="status">Your Daily result is saved to your account.</p>}
          {props.saveStatus === "duplicate" && <p className="account-copy" role="status">That Daily already has a result. Your account result has been kept.</p>}
          {props.pending && <>
            <p className="account-copy">Save your completed {puzzleLabel(props.pending.puzzle_number)} from {displayDate(props.pending.puzzle_date)} to this account?</p>
            {props.saveError && <p className="error-text" role="alert">{props.saveError}</p>}
            <button type="button" className="secondary-button" onClick={props.onSaveGuest} disabled={props.saveStatus === "saving" || props.authBusy}>
              {props.saveStatus === "saving" ? "Saving…" : props.saveStatus === "error" ? "Try saving again" : "Save to account"}
            </button>
            {props.saveStatus === "saving" && <span className="sr-only" role="status">Saving your Daily result.</span>}
          </>}
        </section>}
        <section className="account-statistics" aria-label="Daily statistics" aria-busy={props.resultsLoading}>
          <h3>Your Daily statistics</h3>
          {props.resultsLoading ? <p className="account-copy" role="status">Loading your results…</p>
            : props.resultsError ? <div>
              <p className="error-text" role="alert">{props.resultsError}</p>
              <button type="button" className="secondary-button" onClick={props.onRetry}>Retry results</button>
            </div> : <>
              <dl className="account-metrics">
                <div><dt>Daily games played</dt><dd>{stats.played}</dd></div>
                <div><dt>Games won</dt><dd>{stats.won}</dd></div>
                <div><dt>Win percentage</dt><dd>{stats.winPercentage.toFixed(0)}%</dd></div>
                <div><dt>Current winning streak</dt><dd>{stats.currentStreak}</dd></div>
                <div><dt>Longest winning streak</dt><dd>{stats.longestStreak}</dd></div>
                <div><dt>Average questions in wins</dt><dd>{stats.averageQuestionsInWins === null ? "—" : stats.averageQuestionsInWins.toFixed(1)}</dd></div>
              </dl>
              <div className="account-best">
                <h4>Best successful result</h4>
                <p>{stats.bestWin ? <>{countQuestions(stats.bestWin.questions_used)} · {puzzleLabel(stats.bestWin.puzzle_number)}</> : "No winning result yet."}</p>
                {stats.bestWin && <p className="account-small">{displayDate(stats.bestWin.puzzle_date)} · {stats.bestWin.deduction_path.join(" → ")}</p>}
              </div>
              <p className="account-small">Daily results only. Streaks follow midnight UK time; an unplayed today does not end yesterday’s streak. Best result means the fewest questions in a win.</p>
              <section className="account-history" aria-label="Daily game history">
                <h3>Daily history</h3>
                {!stats.history.length ? <p className="account-copy">No Daily results saved yet. Your next completed Daily can be saved here.</p> : <>
                  <ol>
                    {stats.history.slice(0, visibleHistory).map(result => <li key={result.puzzle_id}>
                      <div className="account-history-heading">
                        <strong>{puzzleLabel(result.puzzle_number)}</strong>
                        <time dateTime={result.puzzle_date}>{displayDate(result.puzzle_date)}</time>
                      </div>
                      <p><span className={result.outcome === "won" ? "account-win" : undefined}>{result.outcome === "won" ? "Won" : "Not this time"}</span> · {countQuestions(result.questions_used)}</p>
                      <p className="account-history-path">{result.deduction_path.join(" → ")}</p>
                    </li>)}
                  </ol>
                  {visibleHistory < stats.history.length && <button type="button" className="secondary-button" onClick={() => setVisibleHistory(previous => previous + 12)}>Show more results</button>}
                </>}
              </section>
            </>}
        </section>
        <p className="account-small account-private">Your account results are private. Practice games do not affect these statistics.</p>
      </>}
    </Dialog>
  );
}

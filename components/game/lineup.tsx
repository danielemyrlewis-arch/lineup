"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { GameState, Movie, Puzzle } from "@/lib/game/types";
import { initialState } from "@/lib/game/engine";
import { createPracticePuzzle } from "@/lib/game/practice-selection";
import { readPracticeHistory } from "@/lib/game/practice-history";
import { londonDate, nextLondonMidnight, formatDailyDate, addCalendarDays } from "@/lib/game/daily-date";
import { DAILY_SCHEDULE, getDailyEntry, resolveDailyPuzzle } from "@/lib/game/daily-schedule";
import { Game } from "./game";
import { GameShell } from "./game-shell";

type Mode = Puzzle["mode"];

/** Modes share one cached local catalogue. Only Practice generates puzzles in the browser. */
export function Lineup() {
  const [catalogue, setCatalogue] = useState<Movie[] | null>(null);
  const [error, setError] = useState(false);
  const [mode, setMode] = useState<Mode>("daily");
  const [today, setToday] = useState<string | null>(null);
  const [dailyDate, setDailyDate] = useState<string | null>(null);
  const [practice, setPractice] = useState<GameState | null>(null);
  const [dailySessions, setDailySessions] = useState<Record<string, GameState>>({});
  const rememberDaily = useCallback((state: GameState) => {
    setDailySessions(previous => previous[state.puzzle.id] === state ? previous : {...previous, [state.puzzle.id]: state});
  }, []);

  useEffect(() => {
    let cancelled = false;
    import("@/lib/data/provider").then(({ getCatalogue }) => getCatalogue())
      .then(({ movies }) => { if (!cancelled) setCatalogue(movies); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let boundary: ReturnType<typeof setTimeout>;
    const checkDate = () => {
      const now = new Date();
      const date = londonDate(now);
      setToday(date);
      // A new day never silently replaces an attempt already on screen.
      setDailyDate(previous => previous ?? date);
      clearTimeout(boundary);
      boundary = setTimeout(checkDate, Math.max(100, nextLondonMidnight(now).getTime() - now.getTime() + 100));
    };
    const followUrl = () => {
      const nextMode = new URL(window.location.href).searchParams.get("mode") === "practice" ? "practice" : "daily";
      setMode(nextMode);
      if (nextMode === "practice" && catalogue) {
        setPractice(previous => previous ?? initialState(createPracticePuzzle(catalogue, crypto.getRandomValues(new Uint32Array(1))[0], "demo", readPracticeHistory())));
      }
      if (nextMode === "daily") setDailyDate(londonDate());
    };
    const visible = () => { if (document.visibilityState === "visible") checkDate(); };
    checkDate();
    followUrl();
    window.addEventListener("popstate", followUrl);
    window.addEventListener("focus", checkDate);
    document.addEventListener("visibilitychange", visible);
    // Also handles foreground device-clock changes; suspended tabs check on return.
    const clock = setInterval(checkDate, 60_000);
    return () => {
      clearTimeout(boundary); clearInterval(clock);
      window.removeEventListener("popstate", followUrl);
      window.removeEventListener("focus", checkDate);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [catalogue]);

  const changeMode = useCallback((next: Mode) => {
    const url = new URL(window.location.href);
    if (next === "practice") {
      url.searchParams.set("mode", "practice");
      if (catalogue) setPractice(previous => previous ?? initialState(createPracticePuzzle(catalogue, crypto.getRandomValues(new Uint32Array(1))[0], "demo", readPracticeHistory())));
    }
    else { url.searchParams.delete("mode"); setDailyDate(londonDate()); }
    window.history.replaceState(null, "", url);
    setMode(next);
  }, [catalogue]);
  const playToday = useCallback(() => {
    setDailyDate(londonDate());
  }, []);
  const {puzzle: daily, failed: dailyFailed} = useMemo(() => {
    if (!catalogue || !dailyDate) return {puzzle: null, failed: false};
    const entry = getDailyEntry(dailyDate);
    if (!entry) return {puzzle: null, failed: false};
    try { return {puzzle: resolveDailyPuzzle(entry, catalogue), failed: false}; }
    catch { return {puzzle: null, failed: true}; }
  }, [catalogue, dailyDate]);

  if (catalogue && mode === "practice" && practice) return (
    <Game key="practice" initialPuzzle={practice.puzzle} initialGameState={practice}
      catalogue={catalogue} onModeChange={changeMode} onPracticeChange={setPractice} />
  );
  if (catalogue && mode === "daily" && daily && today) return (
    <Game key={daily.id} initialPuzzle={daily} initialGameState={dailySessions[daily.id]}
      onDailyChange={rememberDaily} catalogue={catalogue}
      onModeChange={changeMode} dailyToday={today} onToday={playToday}
      hasCurrentDaily={!!getDailyEntry(today)} hasNextDaily={!!getDailyEntry(addCalendarDays(today, 1))} />
  );
  const unavailable = !!catalogue && !!dailyDate && mode === "daily";
  const beforeLaunch = unavailable && dailyDate! < DAILY_SCHEDULE[0].date;
  return (
    <GameShell mode={mode} onModeChange={changeMode}>
      <section className="game-loading" aria-live="polite" aria-busy={!error && !unavailable}>
        <p>{error ? "The film catalogue couldn’t load. Please reload to try again."
          : dailyFailed ? "The Daily film data couldn’t be loaded. Practice is still available."
          : unavailable ? beforeLaunch
            ? `Daily LINEUP starts on ${formatDailyDate(DAILY_SCHEDULE[0].date)}.`
            : "There isn’t a Daily LINEUP scheduled for this date."
          : "Loading your lineup…"}</p>
        {unavailable && <button className="secondary-button" onClick={() => changeMode("practice")}>Play Practice</button>}
        {error && <button className="text-button" onClick={() => location.reload()}>Reload</button>}
      </section>
      <noscript>LINEUP needs JavaScript enabled to play.</noscript>
    </GameShell>
  );
}

import { getAnalyticsConsent, trackEvent } from "../analytics.ts";
import { readDailyProgress, dailyProgressKey } from "./daily-persistence.ts";
import { DAILY_SCHEDULE, resolveDailyPuzzle } from "./daily-schedule.ts";
import { londonDate } from "./daily-date.ts";
import type { GameState, Movie, QuestionKind } from "./types.ts";

/** Only broad groups cross the analytics boundary, never a question's subject or answer. */
export const ANALYTICS_QUESTION_CATEGORY: Record<QuestionKind, string> = {
  before: "release", after: "release", decade: "release", genre: "genre",
  cast: "people", director: "people", leadGender: "people", studio: "studios", oscar: "awards",
  under: "details", over: "details", collection: "details", language: "details", languageNot: "details",
  country: "details", coProduction: "details", curated: "details",
};
type StorageLike = Pick<Storage, "getItem" | "setItem">;

/** Existing, validated earlier Daily play is a local return signal, not a tracking identity. */
export function hasPreviousDailyPlay(date: string, catalogue: readonly Movie[], storage?: StorageLike): boolean {
  try {
    const source = storage ?? localStorage;
    for (const entry of [...DAILY_SCHEDULE].reverse()) {
      if (entry.date >= date || source.getItem(dailyProgressKey(entry.date)) === null) continue;
      const saved = readDailyProgress(resolveDailyPuzzle(entry, catalogue), source);
      if (saved.kind === "saved" && (saved.state.history.length > 0 || saved.state.status !== "playing")) return true;
    }
  } catch { /* Missing, restricted or invalid game storage cannot establish a return. */ }
  return false;
}

/** Called only after an accepted engine action, never during render, restore or auth refresh. */
export function trackGameAction(
  before: GameState,
  after: GameState,
  action: "ask" | "guess",
  catalogue: readonly Movie[],
  {track = trackEvent, consented = () => getAnalyticsConsent() === "granted", today = londonDate,
    previousDailyPlay = hasPreviousDailyPlay}: {
    track?: typeof trackEvent;
    consented?: () => boolean;
    today?: () => string;
    previousDailyPlay?: typeof hasPreviousDailyPlay;
  } = {},
): void {
  try {
    if (!consented() || before === after || before.status !== "playing" || before.puzzle.id !== after.puzzle.id) return;
    const mode = after.puzzle.mode;
    const questions = after.history.length;
    const acceptedAsk = action === "ask" && after.status === "playing" && questions > before.history.length;
    const acceptedGuess = action === "guess" && after.status !== "playing";
    if (!acceptedAsk && !acceptedGuess) return;
    // Resume cannot manufacture a start; consent granted mid-game does not backfill one.
    const firstAction = acceptedAsk ? questions === 1 : questions === 0;
    if (firstAction) {
      const started = track("game_start", {mode}, `${after.puzzle.id}:start`);
      if (started && mode === "daily" && after.puzzle.daily?.date === today() && previousDailyPlay(today(), catalogue))
        track("daily_return", {mode: "daily"}, `${after.puzzle.daily.date}:return`);
    }
    if (acceptedAsk) {
      const question = after.history.at(-1)!.question;
      track("question_asked", {mode, question_number: questions,
        question_category: ANALYTICS_QUESTION_CATEGORY[question.kind]}, `${after.puzzle.id}:question:${questions}`);
    } else {
      track("guess_submitted", {mode, correct: after.status === "won"}, `${after.puzzle.id}:guess`);
      track("game_complete", {mode, outcome: after.status, questions_used: questions,
        films_remaining: after.activeIds.length}, `${after.puzzle.id}:complete`);
    }
  } catch { /* Analytics must never affect an accepted game action. */ }
}

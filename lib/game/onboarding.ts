import { readPracticeHistory } from "./practice-history.ts";

export const STRATEGY_HINT_KEY = "lineup:strategy-hint-dismissed:v1";
type StorageLike = Pick<Storage, "getItem" | "setItem">;

/** Returning players keep their existing experience, even if they never opened Help. */
export function shouldShowStrategyHint(storage?: StorageLike): boolean {
  try {
    const target = storage ?? localStorage;
    if (
      target.getItem(STRATEGY_HINT_KEY) === "true" ||
      target.getItem("lineup:help-seen") === "true" ||
      readPracticeHistory(target).boards.length > 0
    ) return false;
    const stats = JSON.parse(target.getItem("lineup:practice:v1") ?? "null");
    return !(typeof stats?.played === "number" && stats.played > 0);
  } catch {
    return false;
  }
}

export function dismissStrategyHint(storage?: StorageLike): void {
  try {
    (storage ?? localStorage).setItem(STRATEGY_HINT_KEY, "true");
  } catch { /* A blocked/full browser store must never interrupt a question. */ }
}

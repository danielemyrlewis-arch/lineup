import { parseCompletedDailyResult, type CompletedDailyResult, type DailyResult } from "./results.ts";

export const GUEST_RESULTS_KEY = "lineup:account:guest-results:v1";
type StorageLike = Pick<Storage, "getItem" | "setItem">;

/** Only compact completed results, with no identity or auth tokens, enter this queue. */
export function readGuestResults(storage?: StorageLike): CompletedDailyResult[] {
  try {
    const raw = (storage ?? localStorage).getItem(GUEST_RESULTS_KEY);
    if (!raw || raw.length > 500_000) return [];
    const rows: unknown = JSON.parse(raw);
    if (!Array.isArray(rows) || rows.length > 365) return [];
    return rows.reduce<CompletedDailyResult[]>((valid, row) => {
      const result = parseCompletedDailyResult(row);
      return result ? rememberGuestResult(valid, result) : valid;
    }, []);
  } catch { return []; }
}

/** A refresh never replaces the first observed completion timestamp. */
export function rememberGuestResult(rows: CompletedDailyResult[], result: CompletedDailyResult): CompletedDailyResult[] {
  if (rows.some(row => row.puzzle_id === result.puzzle_id)) return rows;
  return [result, ...rows].sort((a, b) => b.puzzle_date.localeCompare(a.puzzle_date)).slice(0, 365);
}

export function writeGuestResults(rows: CompletedDailyResult[], storage?: StorageLike): boolean {
  try {
    (storage ?? localStorage).setItem(GUEST_RESULTS_KEY, JSON.stringify(rows));
    return true;
  } catch { return false; }
}

/** Existing account results win. Saving another browser's guest result is always explicit. */
export function pendingGuestResult(guests: CompletedDailyResult[], results: DailyResult[]): CompletedDailyResult | null {
  return guests.find(guest => !results.some(row => row.puzzle_id === guest.puzzle_id || row.puzzle_date === guest.puzzle_date)) ?? null;
}

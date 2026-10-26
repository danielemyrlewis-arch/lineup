import type { SupabaseClient } from "@supabase/supabase-js";
import { parseDailyResult, type DailyResult } from "./results.ts";

export type SaveStatus = "idle" | "saving" | "saved" | "duplicate" | "error";
export interface SaveOutcome { status: "saved" | "duplicate" | "error"; error: string | null }
const COLUMNS = "user_id,puzzle_id,puzzle_date,puzzle_number,outcome,questions_used,films_remaining,deduction_path,completed_at";
const READ_ERROR = "Your Daily statistics couldn’t load. Accounts may still be awaiting setup. Your game and local progress are safe.";
const SAVE_ERROR = "This result couldn’t be saved to your account. It remains in this browser; try again from Account.";

async function bounded<T>(request: (signal: AbortSignal) => PromiseLike<T>, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(() => request(controller.signal)),
      new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error("Account request timed out")); }, timeoutMs); }),
    ]);
  } finally { clearTimeout(timer); }
}

/** No public profile query; both the filter and database RLS scope reads to the user. */
export async function loadDailyResults(client: SupabaseClient, userId: string, timeoutMs = 10_000): Promise<{results: DailyResult[]; error: string | null}> {
  try {
    const results: DailyResult[] = [];
    for (let page = 0; page < 20; page++) {
      const {data, error} = await bounded(signal => client.from("daily_results").select(COLUMNS)
        .eq("user_id", userId).order("puzzle_date", {ascending: false}).range(page * 500, page * 500 + 499).abortSignal(signal), timeoutMs);
      if (error || !Array.isArray(data)) return {results: [], error: READ_ERROR};
      for (const value of data) {
        const row = parseDailyResult(value);
        if (!row || row.user_id !== userId) return {results: [], error: READ_ERROR};
        results.push(row);
      }
      if (data.length < 500) return {results, error: null};
    }
    // Never show silently truncated totals if a future schedule outgrows this limit.
    return {results: [], error: READ_ERROR};
  } catch { return {results: [], error: READ_ERROR}; }
}

/** INSERT only. A uniqueness conflict keeps the first account result untouched. */
export async function saveDailyResult(client: SupabaseClient, result: DailyResult, timeoutMs = 10_000): Promise<SaveOutcome> {
  const clean = parseDailyResult(result);
  if (!clean) return {status: "error", error: SAVE_ERROR};
  try {
    const {error} = await bounded(signal => client.from("daily_results").insert(clean).abortSignal(signal), timeoutMs);
    if (!error) return {status: "saved", error: null};
    if (error.code === "23505") return {status: "duplicate", error: null};
    return {status: "error", error: SAVE_ERROR};
  } catch { return {status: "error", error: SAVE_ERROR}; }
}

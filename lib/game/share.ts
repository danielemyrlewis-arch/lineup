import type { GameState } from "./types.ts";
import { deductionPath } from "./engine.ts";
export function shareText(state: GameState): string {
  const n = state.history.length;
  return `LINEUP · Find the film.\n${state.status === "won" ? `Found in ${n} question${n === 1 ? "" : "s"}` : "Not this time."}\n${deductionPath(state).join(" → ")}\nPractice mode`;
}
export async function shareResult(
  state: GameState,
): Promise<"shared" | "copied" | "cancelled"> {
  const text = shareText(state);
  if (navigator.share) {
    try {
      await navigator.share({ title: "LINEUP", text });
      return "shared";
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return "cancelled";
    }
  }
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return "copied";
  }
  throw new Error("Sharing is unavailable. You can copy the result below.");
}

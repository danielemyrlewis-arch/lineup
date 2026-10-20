import type { GameState } from "./types.ts";
export interface PracticeStats {
  played: number;
  won: number;
  distribution: number[];
  failed: number;
  lastGameId?: string;
}
export const emptyStats = (): PracticeStats => ({
  played: 0,
  won: 0,
  distribution: [0, 0, 0, 0, 0, 0],
  failed: 0,
});
export function readStats(): PracticeStats {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem("lineup:practice:v1") ?? "null",
    );
    if (typeof value !== "object" || !value) return emptyStats();
    const s = value as PracticeStats;
    if (
      !Number.isSafeInteger(s.played) ||
      s.played < 0 ||
      !Number.isSafeInteger(s.won) ||
      s.won < 0 ||
      s.won > s.played ||
      !Number.isSafeInteger(s.failed) ||
      s.failed < 0 ||
      !Array.isArray(s.distribution) ||
      s.distribution.length !== 6 ||
      !s.distribution.every((n) => Number.isSafeInteger(n) && n >= 0)
    )
      return emptyStats();
    return s;
  } catch {
    return emptyStats();
  }
}
export function recordResult(state: GameState) {
  if (state.puzzle.mode !== "practice" || state.status === "playing") return;
  try {
    const stats = readStats();
    if (stats.lastGameId === state.puzzle.id) return;
    stats.played++;
    stats.lastGameId = state.puzzle.id;
    if (state.status === "won") {
      stats.won++;
      stats.distribution[state.history.length]++;
    } else stats.failed++;
    localStorage.setItem("lineup:practice:v1", JSON.stringify(stats));
  } catch {
    /* Private browsing and full storage must never block play. */
  }
}

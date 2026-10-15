import type { Puzzle } from "./types.ts";

export const PRACTICE_HISTORY_KEY = "lineup:practice-films:v1";
export const PRACTICE_HISTORY_COOKIE = "lineup-practice-films";
export const HISTORY_BOARDS = 10;
export const STRONG_COOLDOWN_BOARDS = 5;
export interface PracticeHistory {
  /** Newest first. At most 10 × 24 shown IDs, including abandoned boards. */
  boards: number[][];
  mysteries: number[];
  lastPuzzleId?: string;
}
type StorageLike = Pick<Storage, "getItem" | "setItem">;
export const emptyPracticeHistory = (): PracticeHistory => ({
  boards: [],
  mysteries: [],
});
const validId = (id: unknown): id is number =>
  typeof id === "number" &&
  Number.isSafeInteger(id) &&
  id > 0 &&
  id <= 2147483647;

/** Treat both browser storage and request bodies as untrusted, bounded inputs. */
export function sanitisePracticeHistory(value: unknown): PracticeHistory {
  if (!value || typeof value !== "object") return emptyPracticeHistory();
  const raw = value as Partial<PracticeHistory>;
  return {
    boards: Array.isArray(raw.boards)
      ? raw.boards
          .slice(0, HISTORY_BOARDS)
          .flatMap((board) =>
            Array.isArray(board)
              ? [[...new Set(board.slice(0, 24).filter(validId))]].filter(
                  (ids) => ids.length,
                )
              : [],
          )
      : [],
    mysteries: Array.isArray(raw.mysteries)
      ? [...new Set(raw.mysteries.slice(0, HISTORY_BOARDS).filter(validId))]
      : [],
    ...(typeof raw.lastPuzzleId === "string" && raw.lastPuzzleId.length <= 80
      ? { lastPuzzleId: raw.lastPuzzleId }
      : {}),
  };
}
export function rememberPracticePuzzle(
  history: PracticeHistory,
  puzzle: Puzzle,
): PracticeHistory {
  const previous = sanitisePracticeHistory(history);
  if (puzzle.mode !== "practice" || previous.lastPuzzleId === puzzle.id)
    return previous;
  const mystery = puzzle.movies.find((m) => m.id === puzzle.mysteryId)?.tmdbId;
  return sanitisePracticeHistory({
    boards: [puzzle.movies.map((m) => m.tmdbId), ...previous.boards],
    mysteries: [mystery, ...previous.mysteries],
    lastPuzzleId: puzzle.id,
  });
}
export function readPracticeHistory(storage?: StorageLike): PracticeHistory {
  try {
    return sanitisePracticeHistory(
      JSON.parse(
        (storage ?? localStorage).getItem(PRACTICE_HISTORY_KEY) ?? "null",
      ),
    );
  } catch {
    return emptyPracticeHistory();
  }
}
/** A compact mirror lets SSR honour local recency on refresh, without replacing a visible board. */
export function encodePracticeHistory(history: PracticeHistory): string {
  const h = sanitisePracticeHistory(history);
  return (
    h.boards.map((b) => b.map((id) => id.toString(36)).join(".")).join("_") +
    "~" +
    h.mysteries.map((id) => id.toString(36)).join(".")
  );
}
export function decodePracticeHistory(
  value: string | undefined,
): PracticeHistory {
  if (!value || value.length > 3000 || !/^[0-9a-z._~]+$/.test(value))
    return emptyPracticeHistory();
  const [boards, mysteries] = value.split("~");
  const ids = (s: string) => s.split(".").map((id) => parseInt(id, 36));
  return sanitisePracticeHistory({
    boards: boards.split("_").map(ids),
    mysteries: ids(mysteries ?? ""),
  });
}
export function writePracticeHistory(
  history: PracticeHistory,
  storage?: StorageLike,
) {
  const safe = sanitisePracticeHistory(history);
  try {
    (storage ?? localStorage).setItem(
      PRACTICE_HISTORY_KEY,
      JSON.stringify(safe),
    );
  } catch {
    /* The in-memory history still works when storage is unavailable. */
  }
  if (typeof document !== "undefined") {
    document.cookie = `${PRACTICE_HISTORY_COOKIE}=${encodePracticeHistory(safe)}; Path=/; Max-Age=7776000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  }
}

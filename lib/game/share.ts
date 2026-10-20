import type { GameState } from "./types.ts";
import { deductionPath } from "./engine.ts";
import { SITE_URL } from "../site.ts";

export const GAME_URL = SITE_URL;

/** Query parameters keep both modes directly loadable on static GitHub Pages. */
export function gameUrl(state: GameState): string {
  return state.puzzle.mode === "daily" ? GAME_URL : `${GAME_URL}?mode=practice`;
}

/** Daily numbering belongs to the frozen schedule, never the viewer's clock. */
export function dailyResultLabel(state: GameState): string | null {
  if (state.puzzle.mode !== "daily") return null;
  const number = state.puzzle.daily?.number;
  return typeof number === "number" && Number.isSafeInteger(number) && number > 0
    ? `Daily LINEUP #${String(number).padStart(3, "0")}`
    : "Daily LINEUP";
}
export type ShareOutcome = "shared" | "copied" | "cancelled" | "manual";

/** A small platform boundary also lets tests cover denied permissions and cancellation. */
export interface SharingPlatform {
  share?: (data: ShareData) => Promise<void>;
  clipboard?: { writeText: (text: string) => Promise<void> };
}
const browserPlatform = (): SharingPlatform =>
  typeof navigator === "undefined" ? {} : navigator;

export function questionCount(state: GameState): string {
  const n = state.history.length;
  return `${n} question${n === 1 ? "" : "s"}`;
}

/** Share only the outcome and counts; neither selected film nor questions can spoil the answer. */
export function shareText(state: GameState): string {
  const won = state.status === "won";
  const outcome = won
    ? `Found in ${questionCount(state)}.`
    : state.status === "lost"
      ? `Not this time.\n${questionCount(state)} used.`
      : "Game in progress.";
  const dailyLabel = dailyResultLabel(state);
  const heading = dailyLabel ? dailyLabel.replace("Daily ", "") : "LINEUP";
  const modeOutcome = dailyLabel ? outcome : `Practice · ${outcome}`;
  return `${heading}\n${modeOutcome}\n\nFilms remaining:\n${deductionPath(state).join(" → ")}\n\n${won ? "Can you do better?" : "Can you find the film?"}\n${gameUrl(state)}`;
}

/** Manual selection remains available when the Clipboard API is missing or permission is denied. */
export async function copyText(
  text: string,
  platform: SharingPlatform = browserPlatform(),
): Promise<"copied" | "manual"> {
  if (platform.clipboard?.writeText) {
    try {
      await platform.clipboard.writeText(text);
      return "copied";
    } catch {
      // Do not claim success or use a deprecated automatic-copy workaround.
    }
  }
  return "manual";
}

export async function shareResult(
  state: GameState,
  platform: SharingPlatform = browserPlatform(),
): Promise<ShareOutcome> {
  const text = shareText(state);
  if (platform.share) {
    try {
      await platform.share({ title: dailyResultLabel(state)?.replace("Daily ", "") ?? "LINEUP — Find the film.", text });
      return "shared";
    } catch (error) {
      if (typeof error === "object" && error !== null &&
          "name" in error && error.name === "AbortError") return "cancelled";
    }
  }
  return copyText(text, platform);
}

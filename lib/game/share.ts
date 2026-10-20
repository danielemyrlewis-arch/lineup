import type { GameState } from "./types.ts";
import { deductionPath } from "./engine.ts";
import { SITE_URL } from "../site.ts";

export const GAME_URL = SITE_URL;
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
  return `LINEUP\nPractice · ${outcome}\n\nFilms remaining:\n${deductionPath(state).join(" → ")}\n\n${won ? "Can you do better?" : "Can you find the film?"}\n${GAME_URL}`;
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
      await platform.share({ title: "LINEUP — Find the film.", text });
      return "shared";
    } catch (error) {
      if (typeof error === "object" && error !== null &&
          "name" in error && error.name === "AbortError") return "cancelled";
    }
  }
  return copyText(text, platform);
}

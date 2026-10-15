import { getCatalogue } from "@/lib/data/provider";
import { createPracticePuzzle } from "@/lib/game/practice-selection";
import {
  decodePracticeHistory,
  PRACTICE_HISTORY_COOKIE,
  sanitisePracticeHistory,
  type PracticeHistory,
} from "@/lib/game/practice-history";
export const dynamic = "force-dynamic";
async function freshLineup(history: PracticeHistory) {
  const { movies, source } = await getCatalogue();
  const seed = crypto.getRandomValues(new Uint32Array(1))[0];
  return Response.json(createPracticePuzzle(movies, seed, source, history), {
    headers: { "Cache-Control": "no-store" },
  });
}
export async function GET(request: Request) {
  const cookie = request.headers
    .get("cookie")
    ?.split("; ")
    .find((part) => part.startsWith(`${PRACTICE_HISTORY_COOKIE}=`))
    ?.slice(PRACTICE_HISTORY_COOKIE.length + 1);
  return freshLineup(decodePracticeHistory(cookie));
}
export async function POST(request: Request) {
  // Histories are tiny. Reject large/malformed input before generating a board.
  if (Number(request.headers.get("content-length")) > 16384)
    return new Response("History too large", { status: 413 });
  try {
    const text = await request.text();
    if (text.length > 16384)
      return new Response("History too large", { status: 413 });
    return freshLineup(sanitisePracticeHistory(JSON.parse(text)));
  } catch {
    return new Response("Invalid practice history", { status: 400 });
  }
}

import { Game } from "@/components/game/game";
import { getCatalogue } from "@/lib/data/provider";
import { cookies } from "next/headers";
import { createPracticePuzzle } from "@/lib/game/practice-selection";
import {
  decodePracticeHistory,
  PRACTICE_HISTORY_COOKIE,
} from "@/lib/game/practice-history";
export const dynamic = "force-dynamic";
export default async function Home() {
  const { movies, source } = await getCatalogue();
  const seed = crypto.getRandomValues(new Uint32Array(1))[0];
  const history = decodePracticeHistory(
    (await cookies()).get(PRACTICE_HISTORY_COOKIE)?.value,
  );
  return (
    <Game initialPuzzle={createPracticePuzzle(movies, seed, source, history)} />
  );
}

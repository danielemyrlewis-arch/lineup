import { Game } from "@/components/game/game";
import { getCatalogue } from "@/lib/data/provider";
import { createPuzzle } from "@/lib/game/engine";
export const dynamic = "force-dynamic";
export default async function Home() {
  const { movies, source } = await getCatalogue();
  const seed = crypto.getRandomValues(new Uint32Array(1))[0];
  return <Game initialPuzzle={createPuzzle(movies, seed, source)} />;
}

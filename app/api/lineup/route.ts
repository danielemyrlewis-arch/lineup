import { getCatalogue } from "@/lib/data/provider";
import { createPuzzle } from "@/lib/game/engine";
export const dynamic = "force-dynamic";
export async function GET() {
  const { movies, source } = await getCatalogue();
  const seed = crypto.getRandomValues(new Uint32Array(1))[0];
  return Response.json(createPuzzle(movies, seed, source), {
    headers: { "Cache-Control": "no-store" },
  });
}

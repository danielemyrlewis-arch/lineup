import { PRACTICE_CATALOGUE } from "./catalogue.ts";
/** Static bundled metadata only. This module performs no network requests. */
export class DemoProvider {
  async catalogue() {
    return PRACTICE_CATALOGUE;
  }
}
export async function getCatalogue() {
  return { movies: PRACTICE_CATALOGUE, source: "demo" as const };
}

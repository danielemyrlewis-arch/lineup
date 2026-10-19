import type {
  CuratedAttribute,
  Movie,
  MovieEnrichment,
} from "../game/types.ts";

/** Authored facts only. An absent/null value means unknown, never false.
 * Musical = narrative song numbers, not simply TMDB's Music genre.
 * Animals = central literal/anthropomorphised animals, including dinosaurs.
 * Ambiguous creatures/toys and borderline musical performances remain unclassified.
 * Music tags help identify review candidates; they never set isMusical by themselves.
 */
export const MOVIE_ENRICHMENT: Readonly<
  Record<number, Readonly<MovieEnrichment>>
> = {
  27205: { isMusical: false, hasMainAnimalCharacter: false }, // Inception
  496243: { isMusical: false, hasMainAnimalCharacter: false }, // Parasite
  680: { isMusical: false, hasMainAnimalCharacter: false }, // Pulp Fiction
  120467: { isMusical: false, hasMainAnimalCharacter: false }, // Grand Budapest Hotel
  329: { isMusical: false, hasMainAnimalCharacter: true }, // Jurassic Park
  157336: { isMusical: false, hasMainAnimalCharacter: false }, // Interstellar
  155: { isMusical: false, hasMainAnimalCharacter: false }, // The Dark Knight
  244786: { isMusical: false, hasMainAnimalCharacter: false }, // Whiplash: Music, not a musical
  194: { isMusical: false, hasMainAnimalCharacter: false }, // Amélie
  348: { isMusical: false }, // Alien: creature classification intentionally unknown
  129: { isMusical: false }, // Spirited Away: spirits/transformations, not a safe animal classification
  37165: { isMusical: false, hasMainAnimalCharacter: false }, // The Truman Show
  37799: { isMusical: false, hasMainAnimalCharacter: false }, // The Social Network
  313369: { isMusical: true, hasMainAnimalCharacter: false }, // La La Land
  105: { isMusical: false, hasMainAnimalCharacter: false }, // Back to the Future
  578: { isMusical: false, hasMainAnimalCharacter: true }, // Jaws
  603: { isMusical: false, hasMainAnimalCharacter: false }, // The Matrix
  694: { isMusical: false, hasMainAnimalCharacter: false }, // The Shining
  278: { isMusical: false, hasMainAnimalCharacter: false }, // The Shawshank Redemption
  13: { isMusical: false, hasMainAnimalCharacter: false }, // Forrest Gump
  550: { isMusical: false, hasMainAnimalCharacter: false }, // Fight Club
  238: { isMusical: false, hasMainAnimalCharacter: false }, // The Godfather
  8587: { isMusical: true, hasMainAnimalCharacter: true }, // The Lion King: musical despite inconsistent Music tags
  862: { isMusical: false }, // Toy Story: toy-animal semantics intentionally unknown
  120: { isMusical: false }, // Fellowship: no inference about fantasy creatures
  12: { isMusical: false, hasMainAnimalCharacter: true }, // Finding Nemo
  545611: { isMusical: false }, // Everything Everywhere All at Once
  419430: { isMusical: false, hasMainAnimalCharacter: false }, // Get Out
  329865: { isMusical: false }, // Arrival
  872585: { isMusical: false, hasMainAnimalCharacter: false }, // Oppenheimer
  152601: { isMusical: false, hasMainAnimalCharacter: false }, // Her
  78: { isMusical: false, hasMainAnimalCharacter: false }, // Blade Runner
  38: { isMusical: false, hasMainAnimalCharacter: false }, // Eternal Sunshine
  769: { isMusical: false, hasMainAnimalCharacter: false }, // Goodfellas
  77338: { isMusical: false, hasMainAnimalCharacter: false }, // The Intouchables
  354912: { isMusical: true, hasMainAnimalCharacter: true }, // Coco: Dante is a central companion
  597: { isMusical: false, hasMainAnimalCharacter: false }, // Titanic
  346698: { isMusical: null, hasMainAnimalCharacter: false }, // Barbie: borderline musical format left unknown
  438631: { isMusical: false }, // Dune
  4935: { isMusical: false }, // Howl's Moving Castle
  279: { isMusical: false }, // Amadeus: composer drama, not a narrative musical
  277216: { isMusical: false }, // Straight Outta Compton: musician biopic
  1677: { isMusical: null }, // Ray: no classification from a musician-biopic/Music tag alone
  69: { isMusical: null }, // Walk the Line: no classification from Music alone
  824: { isMusical: true }, // Moulin Rouge!
  872: { isMusical: true }, // Singin' in the Rain
  1725: { isMusical: true }, // West Side Story
  3933: { isMusical: true }, // Corpse Bride
  9473: { isMusical: true }, // South Park: Bigger, Longer & Uncut
  9837: { isMusical: true }, // The Prince of Egypt
  10020: { isMusical: true }, // Beauty and the Beast
  10693: { isMusical: true }, // Peter Pan
  11113: { isMusical: true }, // My Fair Lady
  13885: { isMusical: true }, // Sweeney Todd
  15121: { isMusical: true }, // The Sound of Music
  36685: { isMusical: true }, // The Rocky Horror Picture Show
  82695: { isMusical: true }, // Les Misérables
  224141: { isMusical: true }, // Into the Woods
  335797: { isMusical: true, hasMainAnimalCharacter: true }, // Sing
  812: { isMusical: true }, // Aladdin
  408: { isMusical: true }, // Snow White and the Seven Dwarfs
  433: { isMusical: true }, // Mary Poppins
  525: { isMusical: true }, // The Blues Brothers
  621: { isMusical: true, hasMainAnimalCharacter: false }, // Grease
  630: { isMusical: true }, // The Wizard of Oz
  10895: { isMusical: true }, // Pinocchio
  10144: { isMusical: true, hasMainAnimalCharacter: true }, // The Little Mermaid
  109445: { isMusical: true }, // Frozen
  38757: { isMusical: true }, // Tangled
  10674: { isMusical: true }, // Mulan
  9479: { isMusical: true }, // The Nightmare Before Christmas
  9836: { isMusical: true, hasMainAnimalCharacter: true }, // Happy Feet
  2062: { isMusical: false, hasMainAnimalCharacter: true }, // Ratatouille
  950: { isMusical: false, hasMainAnimalCharacter: true }, // Ice Age: The Meltdown
  953: { isMusical: false, hasMainAnimalCharacter: true }, // Madagascar
  14160: { isMusical: false, hasMainAnimalCharacter: true }, // Up
};

export const CURATED_QUESTIONS: ReadonlyArray<{
  attribute: CuratedAttribute;
  label: string;
  category: string;
  aliases: readonly string[];
}> = [
  {
    attribute: "hasMainAnimalCharacter",
    label: "Are any of the main characters animals?",
    category: "Characters",
    aliases: ["animal", "animals", "main characters", "animal character"],
  },
  {
    attribute: "isMusical",
    label: "Is it a musical?",
    category: "Musical",
    aliases: ["musical", "musicals", "singing", "song", "songs", "musical film"],
  },
];
export function applyMovieEnrichment(
  movie: Movie,
  entries: Readonly<
    Record<number, Readonly<MovieEnrichment>>
  > = MOVIE_ENRICHMENT,
): Movie {
  const curated = entries[movie.tmdbId];
  return curated
    ? { ...movie, enrichment: { ...movie.enrichment, ...curated } }
    : movie;
}
export function curatedValue(
  movie: Movie,
  attribute: CuratedAttribute,
): boolean | null {
  const value = movie.enrichment?.[attribute];
  return typeof value === "boolean" ? value : null;
}

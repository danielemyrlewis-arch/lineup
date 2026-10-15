import type { Movie, ProductionCompany } from "../game/types.ts";
export interface Studio {
  key: string;
  name: string;
  tmdbIds: readonly number[];
  names: readonly string[];
  aliases: readonly string[];
}
/** Exact production credits/rebrands only. Ownership never implies a production credit. */
export const STUDIOS: readonly Studio[] = [
  {
    key: "disney",
    name: "Walt Disney Pictures",
    tmdbIds: [2],
    names: ["Walt Disney Pictures"],
    aliases: ["disney", "walt disney"],
  },
  {
    key: "marvel",
    name: "Marvel Studios",
    tmdbIds: [420],
    names: ["Marvel Studios"],
    aliases: ["marvel", "mcu"],
  },
  {
    key: "pixar",
    name: "Pixar",
    tmdbIds: [3],
    names: ["Pixar", "Pixar Animation Studios"],
    aliases: ["pixar"],
  },
  {
    key: "warner",
    name: "Warner Bros.",
    tmdbIds: [174, 6194],
    names: ["Warner Bros.", "Warner Bros. Pictures", "Warner Brothers"],
    aliases: ["warner", "warner brothers", "wb"],
  },
  {
    key: "universal",
    name: "Universal Pictures",
    tmdbIds: [33],
    names: ["Universal Pictures"],
    aliases: ["universal"],
  },
  {
    key: "paramount",
    name: "Paramount Pictures",
    tmdbIds: [4],
    names: ["Paramount", "Paramount Pictures"],
    aliases: ["paramount"],
  },
  {
    key: "columbia",
    name: "Columbia Pictures",
    tmdbIds: [5, 441],
    names: ["Columbia Pictures", "Columbia Pictures Corporation"],
    aliases: ["columbia"],
  },
  {
    key: "20th-century",
    name: "20th Century Studios",
    tmdbIds: [25, 306],
    names: [
      "20th Century Studios",
      "20th Century Fox",
      "Twentieth Century Fox",
      "Twentieth Century Fox Film Corporation",
    ],
    aliases: ["20th century", "twentieth century", "fox"],
  },
  {
    key: "dreamworks-pictures",
    name: "DreamWorks Pictures",
    tmdbIds: [7, 27, 7293],
    names: ["DreamWorks", "DreamWorks Pictures", "DreamWorks SKG"],
    aliases: ["dreamworks", "dream works", "dreamworks skg"],
  },
  {
    key: "dreamworks-animation",
    name: "DreamWorks Animation",
    tmdbIds: [521],
    names: ["DreamWorks Animation"],
    aliases: ["dreamworks", "dream works"],
  },
  {
    key: "new-line",
    name: "New Line Cinema",
    tmdbIds: [12],
    names: ["New Line Cinema"],
    aliases: ["new line"],
  },
  {
    key: "lionsgate",
    name: "Lionsgate",
    tmdbIds: [1632, 35],
    names: ["Lionsgate", "Lions Gate Films"],
    aliases: ["lionsgate", "lions gate"],
  },
  {
    key: "a24",
    name: "A24",
    tmdbIds: [41077],
    names: ["A24"],
    aliases: ["a24"],
  },
  {
    key: "ghibli",
    name: "Studio Ghibli",
    tmdbIds: [10342],
    names: ["Studio Ghibli"],
    aliases: ["ghibli"],
  },
];
const canonicalName = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]/g, "");
export function matchesStudio(
  company: ProductionCompany,
  studio: Studio,
): boolean {
  return (
    (company.id !== null && studio.tmdbIds.includes(company.id)) ||
    studio.names.some(
      (name) => canonicalName(name) === canonicalName(company.name),
    )
  );
}
export function producedBy(movie: Movie, key: string): boolean | null {
  const studio = STUDIOS.find((s) => s.key === key);
  if (!studio || !movie.productionCompanies?.length) return null;
  return movie.productionCompanies.some((company) =>
    matchesStudio(company, studio),
  );
}

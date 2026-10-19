import type { Movie, Question, QuestionKind, RankedQuestion } from "./types.ts";
import { STUDIOS, producedBy } from "../data/studios.ts";
import { CURATED_QUESTIONS, curatedValue } from "../data/enrichment.ts";

const genreLabels: Record<string, [string, string[]]> = {
  "Science Fiction": [
    "Is it science fiction?",
    ["sci fi", "scifi", "science fiction"],
  ],
  Animation: ["Is it animated?", ["cartoon", "animation", "animated"]],
  Horror: ["Is it a horror film?", ["scary", "horror", "frightening"]],
  Comedy: ["Is it a comedy?", ["funny", "comedy", "humour"]],
  Drama: ["Is it a drama?", ["drama"]],
  Action: ["Is it an action film?", ["action"]],
  Adventure: ["Is it an adventure film?", ["adventure"]],
  Thriller: ["Is it a thriller?", ["thriller", "suspense"]],
  Romance: ["Is it a romance?", ["romantic", "love", "romance"]],
  Crime: ["Is it a crime film?", ["crime", "gangster"]],
  Family: ["Is it in the family genre?", ["family"]],
  Fantasy: ["Is it a fantasy film?", ["fantasy", "magic"]],
  War: ["Is it a war film?", ["war"]],
  Mystery: ["Is it a mystery film?", ["mystery"]],
  Music: ["Is it in the music genre?", ["music", "music genre"]],
  Western: ["Is it a western?", ["western", "westerns", "cowboy", "cowboys"]],
  Documentary: ["Is it a documentary?", ["documentary", "documentaries", "nonfiction"]],
  History: ["Is it in the history genre?", ["history", "historical"]],
};
const languages: Record<string, string> = {
  en: "English",
  fr: "French",
  ko: "Korean",
  es: "Spanish",
  ja: "Japanese",
  it: "Italian",
  de: "German",
  zh: "Chinese",
  hi: "Hindi",
  pt: "Portuguese",
  cn: "Cantonese",
};

const knownText = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;
const knownList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.length > 0 && value.every(knownText);
const knownYear = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 1888;
const knownRuntime = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;
const knownLanguage = (value: unknown): value is string =>
  typeof value === "string" && /^[a-z]{2}$/.test(value);
const knownCountries = (value: unknown): value is string[] =>
  knownList(value) && value.every((code) => /^[A-Z]{2}$/.test(code));
/** Retain the existing five-featured-credit scope; omit explicitly uncredited cameos. */
const questionCast = (movie: Movie): string[] | null =>
  !knownList(movie.cast) ? null : movie.cast.filter((name) =>
    !movie.castMembers?.some((credit) => credit.name === name && /\buncredited\b/i.test(credit.character ?? "")),
  );
const countries: Record<string, string> = {
  US: "US",
  GB: "UK",
  FR: "French",
  KR: "South Korean",
  JP: "Japanese",
  CA: "Canadian",
  DE: "German",
  NZ: "New Zealand",
  AU: "Australian",
  ES: "Spanish",
  IT: "Italian",
  IN: "Indian",
};

/** Unknown metadata is never treated as NO. Exclude the question if any active film is unknown. */
export function evaluateQuestion(movie: Movie, q: Question): boolean | null {
  switch (q.kind) {
    case "before":
      return !knownYear(movie.releaseYear)
        ? null
        : movie.releaseYear < Number(q.value);
    case "after":
      return !knownYear(movie.releaseYear)
        ? null
        : movie.releaseYear > Number(q.value);
    case "decade":
      return !knownYear(movie.releaseYear)
        ? null
        : Math.floor(movie.releaseYear / 10) * 10 === q.value;
    case "genre":
      return !knownList(movie.genres)
        ? null
        : movie.genres.includes(String(q.value));
    case "under":
      return !knownRuntime(movie.runtime) ? null : movie.runtime < Number(q.value);
    case "over":
      return !knownRuntime(movie.runtime) ? null : movie.runtime > Number(q.value);
    case "collection":
      return typeof movie.belongsToCollection !== "boolean"
        ? null
        : movie.belongsToCollection === q.value;
    case "director":
      return !knownText(movie.director) ? null : movie.director === q.value;
    case "cast": {
      const cast = questionCast(movie);
      return cast === null ? null : cast.includes(String(q.value));
    }
    case "language":
      return !knownLanguage(movie.originalLanguage)
        ? null
        : movie.originalLanguage === q.value;
    case "languageNot":
      return !knownLanguage(movie.originalLanguage)
        ? null
        : movie.originalLanguage !== q.value;
    case "country":
      return !knownCountries(movie.productionCountries)
        ? null
        : movie.productionCountries.includes(String(q.value));
    case "coProduction":
      return !knownCountries(movie.productionCountries)
        ? null
        : new Set(movie.productionCountries).size > 1;
    case "studio":
      return producedBy(movie, String(q.value));
    case "leadGender":
      return !["male", "female", "nonbinary"].includes(movie.topBilledLead?.gender ?? "")
        ? null
        : movie.topBilledLead?.gender === q.value;
    case "curated": {
      const attribute = CURATED_QUESTIONS.find(
        (definition) => definition.attribute === q.value,
      )?.attribute;
      return attribute ? curatedValue(movie, attribute) : null;
    }
    default:
      return null;
  }
}

export function generateQuestions(movies: Movie[]): Question[] {
  const result: Question[] = [];
  const add = (
    kind: QuestionKind,
    value: Question["value"],
    label: string,
    shortLabel: string,
    category: string,
    aliases: string[],
  ) => {
    result.push({
      id: `${kind}:${value}`,
      kind,
      value,
      label,
      shortLabel,
      category,
      aliases,
    });
  };
  const decades = [...new Set(movies.flatMap((m) =>
    knownYear(m.releaseYear) ? [Math.floor(m.releaseYear / 10) * 10] : [],
  ))].sort((a, b) => a - b);
  const thresholds = [...new Set([1970, 1980, 1990, 2000, 2010, 2020, ...decades])].sort((a, b) => a - b);
  for (const y of thresholds) {
    add(
      "before",
      y,
      `Was it released before ${y}?`,
      `Before ${y}?`,
      "Release date",
      ["old", "year", "release", "earlier", "date", "before"],
    );
    add(
      "after",
      y,
      `Was it released after ${y}?`,
      `After ${y}?`,
      "Release date",
      ["new", "recent", "year", "release", "later", "date", "after"],
    );
  }
  for (const y of decades)
    add(
      "decade",
      y,
      `Was it released in the ${y}s?`,
      `In the ${y}s?`,
      "Release date",
      [
        y < 2000 ? "old" : "new recent",
        "year",
        "release",
        "decade",
        String(y),
        `${String(y).slice(-2)}s`,
        ({1920:"twenties",1930:"thirties",1940:"forties",1950:"fifties",1960:"sixties",1970:"seventies",1980:"eighties",1990:"nineties",2000:"noughties two thousands",2010:"twenty tens",2020:"twenty twenties"} as Record<number,string>)[y] ?? "",
      ],
    );
  for (const genre of new Set(movies.flatMap((m) => m.genres ?? []))) {
    const [label, aliases] = genreLabels[genre] ?? [
      `Is it a ${genre.toLowerCase()} film?`,
      [genre],
    ];
    add("genre", genre, label, label, "Genre", aliases);
  }
  add("under", 90, "Is it under 90 minutes?", "Under 90 minutes?", "Runtime", [
    "short",
    "shorter",
    "less",
    "90 minutes",
    "ninety minutes",
    "runtime",
    "length",
    "duration",
    "time",
  ]);
  for (const [minutes, text, aliases] of [
    [90, "90 minutes", ["ninety minutes"]],
    [120, "2 hours", ["two hours"]],
    [150, "2½ hours", ["2.5 hours", "two and a half hours", "two half hours"]],
    [180, "3 hours", ["three hours"]],
  ] as const) {
    add("over", minutes, `Is it over ${text}?`, `Over ${text}?`, "Runtime", [
      "long",
      "longer",
      "more",
      "runtime",
      "length",
      "duration",
      "time",
      String(minutes),
      `${minutes} minutes`,
      ...aliases,
    ]);
  }
  add(
    "collection",
    true,
    "Is it part of a franchise?",
    "Part of a franchise?",
    "Collection",
    ["sequel", "series", "collection", "franchise"],
  );
  add(
    "collection",
    false,
    "Is it a standalone film?",
    "A standalone film?",
    "Collection",
    ["standalone", "collection", "franchise"],
  );
  for (const name of new Set(
    movies.flatMap((m) => (m.director ? [m.director] : [])),
  ))
    add(
      "director",
      name,
      `Was it directed by ${name}?`,
      `Directed by ${name}?`,
      "Director",
      ["director", "directed", name],
    );
  for (const name of new Set(movies.flatMap((m) => questionCast(m) ?? [])))
    add("cast", name, `Is ${name} in its featured cast?`, `${name} in the cast?`, "Cast", [
      "actor",
      "actress",
      "cast",
      "stars",
      "feature",
      "features",
      "featuring",
      "starring",
      name,
    ]);
  for (const lang of new Set(
    movies.flatMap((m) => (m.originalLanguage ? [m.originalLanguage] : [])),
  )) {
    const name =
      languages[lang] ??
      new Intl.DisplayNames(["en"], { type: "language" }).of(lang) ??
      lang;
    add(
      "language",
      lang,
      `Is its original language ${name}?`,
      `${name}-language?`,
      "Language",
      ["language", "original", name],
    );
  }
  add(
    "languageNot", "en",
    "Is its original language other than English?",
    "Original language not English?", "Language",
    ["non English", "non-English", "not English", "foreign language", "original language"],
  );
  for (const country of new Set(
    movies.flatMap((m) => m.productionCountries ?? []),
  )) {
    const name =
      countries[country] ??
      new Intl.DisplayNames(["en"], { type: "region" }).of(country) ??
      country;
    add(
      "country",
      country,
      `Is it a production from ${new Intl.DisplayNames(["en"], { type: "region" }).of(country) ?? country}?`,
      `${name} production?`,
      "Production country",
      [
        "country",
        "production",
        country,
        name,
        country === "GB"
          ? "British Britain United Kingdom"
          : country === "US"
            ? "America American United States"
            : "",
      ],
    );
  }
  add(
    "coProduction", true,
    "Is it an international co-production?",
    "An international co-production?", "Production country",
    ["international", "co production", "coproduction", "multiple countries", "joint production"],
  );
  for (const studio of STUDIOS) {
    if (!movies.some((movie) => producedBy(movie, studio.key) === true))
      continue;
    add(
      "studio",
      studio.key,
      `Was it produced by ${studio.name}?`,
      `Produced by ${studio.name}?`,
      "Production company",
      [
        "studio",
        "studios",
        "production",
        "company",
        "produced",
        studio.name,
        ...studio.aliases,
      ],
    );
  }
  for (const [gender, aliases] of [
    ["female", ["female", "woman", "actress", "female lead"]],
    ["male", ["male", "man", "actor", "male lead"]],
  ] as const) {
    const label = `Is the top-billed performer ${gender}?`;
    add("leadGender", gender, label, label, "Lead performer", [
      "lead",
      "top billed",
      "principal performer",
      ...aliases,
    ]);
  }
  for (const definition of CURATED_QUESTIONS)
    add(
      "curated",
      definition.attribute,
      definition.label,
      definition.label,
      definition.category,
      [...definition.aliases],
    );
  return result;
}

export function validQuestions(
  movies: Movie[],
  askedIds: string[] = [],
): RankedQuestion[] {
  const asked = new Set(askedIds);
  return generateQuestions(movies)
    .flatMap((q) => {
      if (asked.has(q.id)) return [];
      const answers = movies.map((m) => evaluateQuestion(m, q));
      if (answers.some((a) => typeof a !== "boolean")) return [];
      const yesCount = answers.filter(Boolean).length;
      const noCount = movies.length - yesCount;
      if (!yesCount || !noCount) return [];
      const yesIds = movies
        .filter((_, i) => answers[i] === true)
        .map((m) => m.id)
        .sort()
        .join(",");
      const noIds = movies
        .filter((_, i) => answers[i] === false)
        .map((m) => m.id)
        .sort()
        .join(",");
      return [
        {
          ...q,
          yesCount,
          noCount,
          balance: Math.min(yesCount, noCount) / movies.length,
          partitionKey: [yesIds, noIds].sort().join("|"),
        },
      ];
    })
    .sort(
      (a, b) =>
        b.balance - a.balance ||
        categoryPriority(a) - categoryPriority(b) ||
        a.id.localeCompare(b.id),
    );
}
function categoryPriority(q: Question) {
  return [
    "Release date",
    "Genre",
    "Runtime",
    "Collection",
    "Language",
    "Production country",
    "Director",
    "Cast",
    "Production company",
    "Lead performer",
    "Characters",
    "Musical",
  ].indexOf(q.category);
}

/** Prefer balanced partitions; vary the categories without displacing a much better split. */
export function suggestedQuestions(
  questions: RankedQuestion[],
  count = 3,
): RankedQuestion[] {
  const selected: RankedQuestion[] = [];
  const partitions = new Set<string>();
  for (const q of questions) {
    if (
      selected.some((s) => s.category === q.category) &&
      selected.length < count - 1
    )
      continue;
    const key = q.partitionKey;
    if (partitions.has(key)) continue;
    if (q.balance < (questions[0]?.balance ?? 0) - 0.2) continue;
    selected.push(q);
    partitions.add(key);
    if (selected.length === count) return selected;
  }
  for (const q of questions) {
    if (!selected.some((s) => s.partitionKey === q.partitionKey))
      selected.push(q);
    if (selected.length === count) break;
  }
  return selected;
}
const normalise = (s: string) =>
  s
    .toLocaleLowerCase()
    .replace(/½/g, ".5")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/(\d)(?=(?:minutes?|mins?|hours?|hrs?)\b)/g, "$1 ")
    .replace(/\bmins?\b/g, "minutes")
    .replace(/\bhrs?\b/g, "hours")
    .replace(/\s+/g, " ")
    .trim();
// Ignore grammatical filler, while preserving meaningful negation and numbers.
const filler = new Set([
  "is", "it", "a", "an", "the", "was", "were", "does", "do", "did",
  "its", "of", "in", "than", "to", "for", "film", "films", "movie", "movies",
]);
export function searchQuestions(
  questions: RankedQuestion[],
  query: string,
): RankedQuestion[] {
  const phrase = normalise(query);
  const tokens = phrase.split(" ").filter((token) => token && !filler.has(token));
  if (!tokens.length) return questions.slice(0, 8);
  return [...new Map(questions.map((q) => [q.id, q])).values()]
    .flatMap((q, index) => {
      const haystack = normalise([q.label, q.category, ...q.aliases].join(" "));
      const words = haystack.split(" ");
      const matches = tokens.every((t) =>
        ["male", "female", "man", "woman"].includes(t) || /^\d+$/.test(t)
          ? words.includes(t)
          : haystack.includes(t),
      );
      if (!matches) return [];
      const exact = [q.label, ...q.aliases].some((text) => normalise(text) === phrase);
      return [{ q, score: exact ? 1 : 0, index }];
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 12)
    .map(({ q }) => q);
}

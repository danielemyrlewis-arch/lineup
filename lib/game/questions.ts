import type { Movie, Question, QuestionKind, RankedQuestion } from "./types.ts";

const genreLabels: Record<string, [string, string[]]> = {
  "Science Fiction": [
    "Is it science fiction?",
    ["sci fi", "scifi", "space", "science fiction"],
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
  Music: ["Is it in the music genre?", ["music", "musical"]],
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
};
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
      return movie.releaseYear === null
        ? null
        : movie.releaseYear < Number(q.value);
    case "after":
      return movie.releaseYear === null
        ? null
        : movie.releaseYear > Number(q.value);
    case "decade":
      return movie.releaseYear === null
        ? null
        : Math.floor(movie.releaseYear / 10) * 10 === q.value;
    case "genre":
      return movie.genres === null
        ? null
        : movie.genres.includes(String(q.value));
    case "under":
      return movie.runtime === null ? null : movie.runtime < Number(q.value);
    case "over":
      return movie.runtime === null ? null : movie.runtime > Number(q.value);
    case "collection":
      return movie.belongsToCollection === null
        ? null
        : movie.belongsToCollection === q.value;
    case "director":
      return movie.director === null ? null : movie.director === q.value;
    case "cast":
      return movie.cast === null ? null : movie.cast.includes(String(q.value));
    case "language":
      return movie.originalLanguage === null
        ? null
        : movie.originalLanguage === q.value;
    case "country":
      return movie.productionCountries === null
        ? null
        : movie.productionCountries.includes(String(q.value));
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
  for (const y of [1980, 1990, 2000, 2010, 2020]) {
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
  const decades = [
    ...new Set(
      movies.flatMap((m) =>
        m.releaseYear === null ? [] : [Math.floor(m.releaseYear / 10) * 10],
      ),
    ),
  ];
  for (const y of decades)
    add(
      "decade",
      y,
      `Was it released in the ${y}s?`,
      `In the ${y}s?`,
      "Release date",
      ["old", "new", "year", "release", "decade", String(y)],
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
    "runtime",
    "length",
    "duration",
    "time",
  ]);
  for (const [minutes, text] of [
    [90, "90 minutes"],
    [120, "2 hours"],
    [150, "2½ hours"],
  ] as const) {
    add("over", minutes, `Is it over ${text}?`, `Over ${text}?`, "Runtime", [
      "long",
      "runtime",
      "length",
      "duration",
      "time",
      String(minutes),
      minutes === 150 ? "2.5 hours" : "",
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
  for (const name of new Set(movies.flatMap((m) => m.cast ?? [])))
    add("cast", name, `Is ${name} in it?`, `${name} in it?`, "Cast", [
      "actor",
      "actress",
      "cast",
      "stars",
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
      `Is it a ${name} production?`,
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
      if (answers.some((a) => a === null)) return [];
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
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
export function searchQuestions(
  questions: RankedQuestion[],
  query: string,
): RankedQuestion[] {
  const tokens = normalise(query).split(" ").filter(Boolean);
  if (!tokens.length) return questions.slice(0, 8);
  return questions
    .filter((q) => {
      const haystack = normalise([q.label, q.category, ...q.aliases].join(" "));
      return tokens.every((t) => haystack.includes(t));
    })
    .slice(0, 12);
}

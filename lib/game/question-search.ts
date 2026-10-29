import type { QuestionKind, RankedQuestion } from "./types.ts";

const normalise = (value: string) => value.toLowerCase()
  .replace(/½/g, ".5")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9 ]/g, " ")
  .replace(/(\d)(?=(?:minutes?|mins?|hours?|hrs?)\b)/g, "$1 ")
  .replace(/\bmins?\b/g, "minutes").replace(/\bhrs?\b/g, "hours")
  .replace(/\s+/g, " ").trim();
const filler = new Set([
  "is", "it", "a", "an", "the", "was", "were", "are", "does", "do", "did",
  "its", "of", "in", "than", "to", "for", "by", "has", "have", "be", "been",
  "film", "films", "movie", "movies",
]);
const genericFilmWords = new Set(["film", "films", "movie", "movies"]);
// Search vocabulary only: these describe existing questions, never create predicates or answers.
const keywords: Partial<Record<QuestionKind, readonly string[]>> = {
  before: ["years", "release", "older", "earlier"],
  after: ["years", "release", "newer", "later"],
  decade: ["years", "release", "decades"],
  genre: ["genres"],
  cast: ["actors", "actresses", "performers", "people"],
  director: ["directors", "filmmaker", "filmmakers", "people", "made by"],
  studio: ["studios", "companies", "made by"],
  under: ["running time", "duration", "shorter"],
  over: ["running time", "duration", "longer"],
  collection: ["sequels", "franchises", "series"],
  country: ["countries"],
  coProduction: ["countries"],
};
interface Field { words: string[]; exact: number; prefix: number; partial: number }
interface SearchDocument { wording: string[]; aliases: string[]; fields: Field[] }
// Canonical questions are immutable for a board; normalise their fields once, not per keystroke.
const documents = new WeakMap<RankedQuestion, SearchDocument>();
function documentFor(question: RankedQuestion): SearchDocument {
  const cached = documents.get(question);
  if (cached) return cached;
  const wording = [question.label, question.shortLabel].map(normalise);
  const aliases = question.aliases.map(normalise);
  const field = (text: string, exact: number, prefix: number, partial: number, contentOnly = false): Field => ({
    words: text.split(" ").filter(word => word && (!contentOnly || !filler.has(word))), exact, prefix, partial,
  });
  const document: SearchDocument = { wording, aliases, fields: [
    ...wording.map(text => field(text, 600, 500, 100, true)),
    ...aliases.map(text => field(text, 450, 350, 90)),
    field(normalise(question.category), 300, 250, 75),
    ...(keywords[question.kind] ?? []).map(text => field(normalise(text), 200, 175, 50)),
  ] };
  documents.set(question, document);
  return document;
}
function tokenScore(token: string, fields: Field[]): number {
  // Numbers may match a year prefix, but never an interior fragment (90 must not match 1990).
  // Gender/negation must be whole words: male is not female, and not must not match another word.
  const wholeWord = ["male", "female", "man", "woman", "not", "non"].includes(token);
  const numeric = /^\d+$/.test(token);
  let best = 0;
  for (const field of fields) for (const [position, word] of field.words.entries()) {
    const score = word === token ? field.exact
      : !wholeWord && word.startsWith(token) ? field.prefix
      : !wholeWord && !numeric && word.includes(token) ? field.partial : 0;
    // Early subject words beat incidental wording for otherwise equally good prefix matches.
    if (score) best = Math.max(best, score - Math.min(position, 20));
  }
  return best;
}

/** Text relevance only. The caller supplies the current valid question bank; no split/secret is read. */
export function searchQuestions(questions: readonly RankedQuestion[], query: string): RankedQuestion[] {
  const phrase = normalise(query);
  if (!phrase) return [];
  const rawTokens = phrase.split(" ");
  const meaningful = rawTokens.filter(token => !filler.has(token));
  // A/AN/IS can be the beginning of a useful word. Keep single-token exploration, while
  // empty searches and complete filler-only phrases still offer no automatic recommendations.
  const tokens = meaningful.length ? meaningful
    : rawTokens.length === 1 && !genericFilmWords.has(phrase) ? rawTokens : [];
  if (!tokens.length) return [];
  return [...new Map(questions.map(question => [question.id, question])).values()]
    .flatMap(question => {
      const document = documentFor(question);
      const scores = tokens.map(token => tokenScore(token, document.fields));
      if (scores.some(score => score === 0)) return [];
      const exact = document.wording.includes(phrase) ? 2 : document.aliases.includes(phrase) ? 1 : 0;
      return [{question, exact, weakest: Math.min(...scores), total: scores.reduce((sum, score) => sum + score, 0)}];
    })
    .sort((a, b) => b.exact - a.exact || b.weakest - a.weakest || b.total - a.total ||
      a.question.label.localeCompare(b.question.label) || a.question.id.localeCompare(b.question.id))
    .slice(0, 12)
    .map(({question}) => question);
}

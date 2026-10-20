import type { QuestionKind, RankedQuestion } from "./types.ts";

/** Presentation groups only. The caller supplies the engine's current valid questions. */
const CATEGORIES: { id: string; label: string; description: string; kinds: QuestionKind[] }[] = [
  { id: "release", label: "Release", description: "Years and decades", kinds: ["before", "after", "decade"] },
  { id: "genre", label: "Genre", description: "Comedy, animation and more", kinds: ["genre"] },
  { id: "people", label: "People", description: "Cast, directors and leads", kinds: ["cast", "director", "leadGender"] },
  { id: "studios", label: "Studios", description: "Who made the film", kinds: ["studio"] },
  { id: "awards", label: "Awards", description: "Oscars and Best Picture", kinds: ["oscar"] },
  { id: "details", label: "Film details", description: "Runtime, language, country and more", kinds: ["under", "over", "collection", "language", "languageNot", "country", "coProduction", "curated"] },
];

export interface QuestionGroup {
  id: string;
  label: string;
  description: string;
  questions: RankedQuestion[];
}

export function groupQuestions(questions: readonly RankedQuestion[]): QuestionGroup[] {
  return CATEGORIES.flatMap(({ kinds, ...category }) => {
    const grouped = questions.filter((question) => kinds.includes(question.kind));
    return grouped.length ? [{ ...category, questions: grouped }] : [];
  });
}

export const QUESTION_PAGE_SIZE = 10;

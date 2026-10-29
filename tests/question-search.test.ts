import test from "node:test";
import assert from "node:assert/strict";
import { DEMO_MOVIES } from "../lib/data/demo.ts";
import { PRACTICE_CATALOGUE } from "../lib/data/catalogue.ts";
import { generateQuestions, searchQuestions, validQuestions } from "../lib/game/questions.ts";
import type { RankedQuestion } from "../lib/game/types.ts";

const demo = validQuestions(DEMO_MOVIES);
const bank = new Map(generateQuestions(PRACTICE_CATALOGUE).map(question => [question.id, question]));
/** Relevance fixtures use real bank definitions, with an adversarial incoming split order. */
const ranked = (id: string, yesCount = 12): RankedQuestion => {
  const question = bank.get(id);
  assert.ok(question, `Expected an existing question: ${id}`);
  return {...question, yesCount, noCount: 24 - yesCount,
    balance: Math.min(yesCount, 24 - yesCount) / 24, partitionKey: id};
};
const ids = (questions: readonly RankedQuestion[]) => questions.map(question => question.id);

test("autocomplete begins with the first character, including broad Y/U and grammatical-prefix A searches", () => {
  for (const query of ["Y", "y", "U", "u", "A", "a", "an"]) {
    const matches = searchQuestions(demo, query);
    assert.ok(matches.length > 0, `${query} should explore the question bank without a minimum length`);
    if (/^[yu]$/i.test(query)) assert.ok(matches.length > 1, `${query} may return several useful matches`);
    assert.ok(matches.every(question => demo.includes(question)));
  }
  assert.deepEqual(ids(searchQuestions(demo, "Y")), ids(searchQuestions(demo, "y")));
  assert.deepEqual(ids(searchQuestions(demo, "U")), ids(searchQuestions(demo, "u")));
});

test("animated-film autocomplete stays visible and relevant as a partial word becomes more specific", () => {
  for (const query of ["ani", "anim", "anima", "animat", "animated", "Is it animated?"]) {
    const matches = searchQuestions(demo, query);
    assert.equal(matches[0]?.id, "genre:Animation", query);
  }
});

test("strong wording prefixes outrank broad alias or weaker substring hits regardless of elimination rank", () => {
  const animation = ranked("genre:Animation", 1), animal = ranked("curated:hasMainAnimalCharacter");
  assert.equal(searchQuestions([animal, animation], "anim")[0]?.id, animation.id);
  const action = ranked("genre:Action", 1), actor = ranked("cast:Tom Hanks");
  assert.equal(searchQuestions([actor, action], "act")[0]?.id, action.id);
  assert.equal(searchQuestions([actor, action], "actor")[0]?.id, actor.id,
    "Typing the complete alias should resolve to its intended existing question");
});

test("whole actor-name words outrank prefixes and name prefixes outrank incidental interior substrings", () => {
  const tom = ranked("cast:Tom Hanks", 1), tommy = ranked("cast:Tommy Lee Jones");
  assert.equal(searchQuestions([tommy, tom], "tom")[0]?.id, tom.id);
  const mark = ranked("cast:Mark Ruffalo", 1), omar = ranked("cast:Omar Sharif");
  assert.equal(searchQuestions([omar, mark], "mar")[0]?.id, mark.id);
});

test("exact brand keywords and runtime phrases beat incidental matches in high-ranked questions", () => {
  const disney = ranked("studio:disney", 1), actor = ranked("cast:Walt Disney");
  assert.equal(searchQuestions([actor, disney], "disney")[0]?.id, disney.id);
  const twoHours = ranked("over:120", 1), twoAndHalfHours = ranked("over:150");
  for (const query of ["2 hours", "2hrs", "two hours", "120 minutes"])
    assert.equal(searchQuestions([twoAndHalfHours, twoHours], query)[0]?.id, twoHours.id, query);
});

test("keywords, partial words, synonyms and category searches resolve the existing question bank", () => {
  for (const [query, expected] of [
    ["thrill", "genre:Thriller"], ["scary", "genre:Horror"],
    ["cartoon", "genre:Animation"], ["sequel", "collection:true"],
  ]) assert.equal(searchQuestions(demo, query)[0]?.id, expected, query);
  const dateKinds = new Set(["before", "after", "decade"]);
  for (const query of ["year", "release date"]) {
    const matches = searchQuestions(demo, query);
    assert.ok(matches.length > 0);
    assert.ok(matches.every(question => dateKinds.has(question.kind)), query);
  }
  const actors = searchQuestions(demo, "actor");
  assert.ok(actors.length > 1 && actors.every(question => question.kind === "cast"));
  const genres = searchQuestions(demo, "genre");
  assert.ok(genres.length > 1 && genres.every(question => question.kind === "genre"));
  const studioQuestions = [ranked("studio:disney"), ranked("studio:marvel"), ranked("genre:Action")];
  assert.deepEqual(new Set(ids(searchQuestions(studioQuestions, "production company"))), new Set(["studio:disney", "studio:marvel"]));
  const musical = ranked("curated:isMusical"), music = ranked("genre:Music");
  for (const query of ["singing", "song", "songs", "musical film"])
    assert.equal(searchQuestions([music, musical], query)[0]?.id, musical.id, query);
});

test("multiword queries require their meaningful terms and preserve numeric and gender boundaries", () => {
  assert.deepEqual(searchQuestions(demo, "thriller disney"), []);
  const year = ranked("before:1990"), under = ranked("under:90"), over = ranked("over:90");
  assert.deepEqual(new Set(ids(searchQuestions([year, under, over], "90"))), new Set([under.id, over.id]));
  const male = ranked("leadGender:male"), female = ranked("leadGender:female");
  assert.deepEqual(ids(searchQuestions([female, male], "male")), [male.id]);
  assert.deepEqual(ids(searchQuestions([female, male], "man")), [male.id]);
  assert.deepEqual(ids(searchQuestions([male, female], "woman")), [female.id]);
  const english = ranked("language:en"), other = ranked("languageNot:en");
  for (const query of ["not English", "non-English"])
    assert.equal(searchQuestions([english, other], query)[0]?.id, other.id, query);
});

test("autocomplete returns bounded unique original candidates without mutating the bank or restoring unavailable questions", () => {
  const before = ids(demo);
  const matches = searchQuestions([...demo, ...demo], "actor");
  assert.ok(matches.length > 0 && matches.length <= 12);
  assert.equal(new Set(ids(matches)).size, matches.length);
  assert.ok(matches.every(question => demo.includes(question)));
  assert.deepEqual(ids(demo), before);
  const alreadyAsked = validQuestions(DEMO_MOVIES, ["genre:Animation"]);
  assert.ok(!searchQuestions(alreadyAsked, "anim").some(question => question.id === "genre:Animation"));
  const unknown = validQuestions(DEMO_MOVIES.map((movie, index) => index === 0 ? {...movie, genres: null} : movie));
  assert.ok(!searchQuestions(unknown, "anim").some(question => question.kind === "genre"));
  assert.deepEqual(searchQuestions(demo, ""), []);
  assert.deepEqual(searchQuestions(demo, "  "), []);
  assert.deepEqual(searchQuestions(demo, "an impossible unrelated search"), []);
});

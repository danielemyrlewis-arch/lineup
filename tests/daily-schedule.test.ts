import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PRACTICE_CATALOGUE } from "../lib/data/catalogue.ts";
import { DAILY_SCHEDULE, getDailyEntry, resolveDailyPuzzle, dailyNumber } from "../lib/game/daily-schedule.ts";
import { DAILY_LAUNCH_DATE, DAILY_CATALOGUE_SHA256, DAILY_FROZEN_PREFIX } from "../lib/data/daily-config.ts";
import { addDays, appendSchedule, catalogueFingerprint, digest } from "../scripts/daily/preparation.ts";
import { createPracticePuzzle } from "../lib/game/practice-selection.ts";
import { emptyPracticeHistory } from "../lib/game/practice-history.ts";
import type { DailyScheduleEntry } from "../lib/game/daily-schedule.ts";

const audit=JSON.parse(readFileSync(new URL("../notes/daily-generation-audit.json",import.meta.url),"utf8"));

test("365 committed days have unique stable dates, IDs, sequential numbers and valid film identities", () => {
  assert.ok(DAILY_SCHEDULE.length>=365);
  assert.equal(DAILY_SCHEDULE[0].date,DAILY_LAUNCH_DATE);
  const known=new Set(PRACTICE_CATALOGUE.map(movie=>movie.tmdbId));
  const ids=new Set(),dates=new Set(),answers=new Set();
  for(const [index,entry] of DAILY_SCHEDULE.entries()) {
    assert.equal(entry.number,index+1);
    assert.equal(entry.id,`daily-${dailyNumber(index+1)}`);
    assert.equal(entry.date,addDays(DAILY_LAUNCH_DATE,index));
    assert.equal(entry.movieIds.length,24);
    assert.equal(new Set(entry.movieIds).size,24);
    assert.ok(entry.movieIds.every(id=>known.has(id)));
    assert.ok(entry.movieIds.includes(entry.mysteryMovieId));
    assert.ok(!ids.has(entry.id));assert.ok(!dates.has(entry.date));
    if(index<365)assert.ok(!answers.has(entry.mysteryMovieId));
    ids.add(entry.id);dates.add(entry.date);answers.add(entry.mysteryMovieId);
  }
});

test("date lookup is explicit and independent of time, locale, random calls and catalogue order", () => {
  const first=getDailyEntry(DAILY_LAUNCH_DATE)!;
  assert.strictEqual(first,getDailyEntry(DAILY_LAUNCH_DATE));
  assert.notEqual(first.id,getDailyEntry(addDays(DAILY_LAUNCH_DATE,1))!.id);
  assert.equal(getDailyEntry("1900-01-01"),null);
  assert.equal(getDailyEntry("invalid"),null);
  const a=resolveDailyPuzzle(first,PRACTICE_CATALOGUE),b=resolveDailyPuzzle(first,[...PRACTICE_CATALOGUE].reverse());
  assert.deepEqual(a,b);
  assert.equal(a.id,first.id);assert.equal(a.mode,"daily");
  assert.equal(a.daily?.number,first.number);assert.equal(a.daily?.date,first.date);
  assert.deepEqual(a.movies.map(movie=>movie.tmdbId),first.movieIds);
  assert.equal(Number(a.mysteryId),first.mysteryMovieId);
});

test("missing film/version references fail rather than substitute another mystery or random board", () => {
  const entry=DAILY_SCHEDULE[0];
  assert.throws(()=>resolveDailyPuzzle(entry,PRACTICE_CATALOGUE.filter(movie=>movie.tmdbId!==entry.movieIds[0])),/unavailable film/);
  assert.throws(()=>resolveDailyPuzzle({...entry,catalogueVersion:"unretained-version"},PRACTICE_CATALOGUE),/version is unavailable/);
  assert.throws(()=>resolveDailyPuzzle({...entry,movieIds:entry.movieIds.slice(1)},PRACTICE_CATALOGUE),/unavailable film/);
});

test("published catalogue and initial 365 identities are pinned across rebuilds and unrelated updates", () => {
  assert.equal(catalogueFingerprint(PRACTICE_CATALOGUE),DAILY_CATALOGUE_SHA256);
  assert.equal(digest(DAILY_SCHEDULE.slice(0,DAILY_FROZEN_PREFIX.length)),DAILY_FROZEN_PREFIX.sha256);
  const changed=PRACTICE_CATALOGUE.map((movie,index)=>index?movie:{...movie,title:`${movie.title} changed`});
  assert.notEqual(catalogueFingerprint(changed),DAILY_CATALOGUE_SHA256);
  assert.notEqual(catalogueFingerprint(PRACTICE_CATALOGUE.slice(1)),DAILY_CATALOGUE_SHA256);
  assert.equal(catalogueFingerprint([...PRACTICE_CATALOGUE].reverse()),DAILY_CATALOGUE_SHA256);
});

test("offline extension appends without changing, renumbering or truncating existing puzzles", () => {
  const prefix=DAILY_SCHEDULE.slice(0,2),before=structuredClone(prefix);
  const extension=appendSchedule(prefix,PRACTICE_CATALOGUE,DAILY_LAUNCH_DATE,3);
  assert.deepEqual(extension.slice(0,2),before);
  assert.deepEqual(prefix,before);
  assert.deepEqual(extension[2],DAILY_SCHEDULE[2]);
  assert.deepEqual(appendSchedule(prefix,PRACTICE_CATALOGUE,DAILY_LAUNCH_DATE,1),before);
  const changed:DailyScheduleEntry[]=[{...prefix[0],number:99}];
  assert.throws(()=>appendSchedule(changed,PRACTICE_CATALOGUE,DAILY_LAUNCH_DATE,3),/Invalid\/changed/);
});

test("a complete first-year schedule can extend without changing its frozen release prefix", () => {
  const next=appendSchedule(DAILY_SCHEDULE,PRACTICE_CATALOGUE,DAILY_LAUNCH_DATE,366);
  assert.equal(next.length,366);
  assert.equal(digest(next.slice(0,365)),DAILY_FROZEN_PREFIX.sha256);
  assert.equal(next[365].number,366);
  assert.equal(next[365].date,"2027-10-20");
  assert.ok(!DAILY_SCHEDULE.some(entry=>entry.id===next[365].id));
});

test("all-board validation and first-30 audit show recognisable diverse useful lineups with cooldowns", () => {
  assert.equal(audit.puzzles,DAILY_SCHEDULE.length);
  assert.equal(audit.scheduleSha256,digest(DAILY_SCHEDULE));
  assert.equal(audit.initial365UniqueMysteries,365);
  assert.equal(audit.maximumConsecutiveOverlap,0);
  assert.ok(audit.minimumValidQuestions>=6);
  assert.ok(audit.minimumDecades>=4);
  assert.ok(audit.minimumGenres>=6);
  assert.equal(audit.first30.puzzles,30);
  assert.equal(audit.first30.uniqueMysteries,30);
  assert.ok(audit.first30.uniqueFilms>=400);
  for(const day of audit.first30.days) {
    assert.equal(day.franchiseDuplicates,0);assert.equal(day.missingPosters,0);
    assert.equal(day.recognitionTier,0);assert.equal(day.questionQuality.healthy,true);
    assert.equal(day.consecutiveOverlap,0);
  }
  for(const [index,entry] of DAILY_SCHEDULE.entries()) {
    const recent=new Set(DAILY_SCHEDULE.slice(Math.max(0,index-5),index).flatMap(day=>[...day.movieIds]));
    assert.ok(entry.movieIds.every(id=>!recent.has(id)));
  }
});

test("Daily generation does not mutate the catalogue or Practice randomness/history", () => {
  const history=emptyPracticeHistory(),before=structuredClone(history);
  const first=createPracticePuzzle(PRACTICE_CATALOGUE,4815,"demo",history);
  appendSchedule(DAILY_SCHEDULE.slice(0,1),PRACTICE_CATALOGUE,DAILY_LAUNCH_DATE,2);
  const second=createPracticePuzzle(PRACTICE_CATALOGUE,4815,"demo",history);
  assert.deepEqual(first.movies.map(m=>m.tmdbId),second.movies.map(m=>m.tmdbId));
  assert.equal(first.mysteryId,second.mysteryId);
  assert.deepEqual(history,before);
});


test("resolving Daily boards leaves Practice selection and mystery randomness identical across 20 seeds", () => {
  const history=emptyPracticeHistory();
  for(let seed=800;seed<820;seed++) {
    const baseline=createPracticePuzzle(PRACTICE_CATALOGUE,seed,"demo",history);
    resolveDailyPuzzle(DAILY_SCHEDULE[seed-800],PRACTICE_CATALOGUE);
    const after=createPracticePuzzle(PRACTICE_CATALOGUE,seed,"demo",history);
    assert.deepEqual(after.movies.map(movie=>movie.tmdbId),baseline.movies.map(movie=>movie.tmdbId));
    assert.equal(after.mysteryId,baseline.mysteryId);
  }
  assert.deepEqual(history,emptyPracticeHistory());
});

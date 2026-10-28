import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PRACTICE_CATALOGUE } from "../lib/data/catalogue.ts";
import { OSCAR_RECORDS } from "../lib/data/oscar-snapshot.ts";
import { OSCAR_QUESTION_EVIDENCE } from "../lib/data/oscar-question-snapshot.ts";
import { OSCAR_KEYS, evaluateOscar, normaliseOscarRecord, oscarSummary, UNKNOWN_OSCARS } from "../lib/data/awards.ts";
import { evaluateQuestion, generateQuestions, validQuestions, suggestedQuestions, searchQuestions } from "../lib/game/questions.ts";
import { verifyWikidataCoverage, resolveCeremony } from "../scripts/awards/wikidata-verifier.ts";
import type { WikidataOscarInput } from "../scripts/awards/wikidata-types.ts";
import type { OscarAnswerEvidence, OscarRecord, OscarQuestionKey } from "../lib/game/types.ts";

const input=JSON.parse(readFileSync(new URL("../notes/oscar-wikidata-input.json",import.meta.url),"utf8")) as WikidataOscarInput;
const legacy=JSON.parse(readFileSync(new URL("../notes/oscar-import-audit.json",import.meta.url),"utf8"));
const get=(id:number)=>PRACTICE_CATALOGUE.find(m=>m.tmdbId===id)!;
const q=(key:OscarQuestionKey)=>generateQuestions([]).find(q=>q.id===`oscar:${key}`)!;
const evidence=(value:boolean,basis:OscarAnswerEvidence["basis"]="complete-category"):OscarAnswerEvidence=>({
  value,basis,source:"https://www.wikidata.org/wiki/Q102427",verifiedOn:"2026-10-19",verifiedThroughAwardYear:2025,coverageThroughCeremony:98,
});
const partial=(answers:OscarRecord["answers"])=>normaliseOscarRecord({awardsDataStatus:"partial",answers});

test("one verified category answer works while broader awards and exact totals remain unknown",()=>{
  const record=partial({pictureWon:evidence(false)});
  assert.equal(record.awardsDataStatus,"partial");
  assert.equal(evaluateOscar(record,"pictureWon",2010),false);
  for(const key of OSCAR_KEYS.filter(k=>k!=="pictureWon"))assert.equal(evaluateOscar(record,key,2010),null,key);
  assert.equal(record.oscarNominations,null);assert.equal(record.oscarWins,null);
  assert.equal(oscarSummary(record),null);
});

test("positive evidence establishes YES without creating a zero total or a NO to another question",()=>{
  const record=partial({nominated:evidence(true,"positive-entry"),nominations3:evidence(true,"minimum-count")});
  assert.equal(evaluateOscar(record,"nominated",2000),true);
  assert.equal(evaluateOscar(record,"nominations3",2000),true);
  for(const key of ["won","nominations5","wins3"] as const)assert.equal(evaluateOscar(record,key,2000),null);
  assert.equal(record.oscarNominations,null);
});

test("negative answers require a reviewed full film or an exhaustive matching category, never a positive lower bound",()=>{
  for(const [key,fact] of [
    ["nominated",evidence(false,"positive-entry")], ["won",evidence(false,"positive-entry")],
    ["nominations3",evidence(false,"minimum-count")], ["nominated",evidence(false,"complete-category")],
  ] as const)assert.equal(evaluateOscar(partial({[key]:fact}),key,2000),null);
  assert.equal(evaluateOscar(partial({pictureNominated:evidence(false)}),"pictureNominated",2000),false);
});

test("bad or inconsistent evidence affects the relevant question without erasing independent category facts",()=>{
  for(const bad of [{...evidence(true,"positive-entry"),source:"http://example.org"},
    {...evidence(true,"positive-entry"),verifiedOn:"2026-02-30"},
    {...evidence(true,"positive-entry"),verifiedThroughAwardYear:2026,coverageThroughCeremony:99},
    {...evidence(true,"positive-entry"),coverageThroughCeremony:96}]) {
    const record=partial({pictureWon:evidence(false),nominated:bad});
    assert.equal(evaluateOscar(record,"nominated",2000),null);
    assert.equal(evaluateOscar(record,"pictureWon",2000),false);
  }
  const conflict=partial({nominated:evidence(false,"reviewed-film"),pictureNominated:evidence(true),pictureWon:evidence(false)});
  assert.equal(evaluateOscar(conflict,"nominated",2000),null);
  assert.equal(evaluateOscar(conflict,"pictureNominated",2000),null);
  assert.equal(evaluateOscar(conflict,"pictureWon",2000),false);
});

test("question evidence uses its own cutoff; no movie after the relevant award-year cutoff gets a negative",()=>{
  const record=partial({pictureWon:evidence(false),nominated:{...evidence(true,"positive-entry"),verifiedThroughAwardYear:2023,coverageThroughCeremony:96}});
  assert.equal(evaluateOscar(record,"pictureWon",2025),false);
  assert.equal(evaluateOscar(record,"nominated",2025),null);
  assert.equal(evaluateOscar(record,"pictureWon",2026),null);
});

test("same-cutoff contradictions to an exact record do not override its reviewed answer with the opposite value",()=>{
  const fact={...evidence(false,"reviewed-film"),verifiedThroughAwardYear:2023,coverageThroughCeremony:96};
  const record=normaliseOscarRecord({...OSCAR_RECORDS[597],answers:{nominated:fact}});
  assert.equal(evaluateOscar(record,"nominated",1997),null);
  assert.equal(evaluateOscar(record,"won",1997),true);
});

test("the batch verifier reconciles every Best Picture ceremony and publishes broad category coverage",()=>{
  const result=verifyWikidataCoverage(input,PRACTICE_CATALOGUE,legacy,OSCAR_RECORDS);
  assert.equal(result.audit.identityVerified,1200);
  assert.equal(result.audit.bestPicture.nominees,621);assert.equal(result.audit.bestPicture.winners,98);
  assert.equal(result.audit.bestPicture.ceremonies.length,98);
  assert.ok(result.audit.bestPicture.ceremonies.every(c=>c.nomineeVerified&&c.winnerVerified));
  assert.ok(result.audit.coverage.nominated.yes>=500);
  assert.equal(result.audit.verifiedZeroNominations,10);
  assert.equal(result.audit.exactTotals,20);assert.equal(result.audit.noKnownAnswers,6);
  assert.deepEqual(result.audit.conflicts,[]);
});

test("dropping a late ceremony winner disables historical-category negatives rather than filling the gap",()=>{
  const reduced=structuredClone(input);
  const latest=new Set(reduced.ceremonies.filter(c=>c.ordinal===98).map(c=>c.id));
  reduced.picture=reduced.picture.filter(r=>!(r.kind==="won"&&r.ceremony&&latest.has(r.ceremony)));
  const result=verifyWikidataCoverage(reduced,PRACTICE_CATALOGUE,legacy,OSCAR_RECORDS);
  assert.equal(result.audit.bestPicture.winnerCoverage,false);
  assert.equal(result.audit.bestPicture.nomineeCoverage,false);
  assert.equal(evaluateOscar(result.records[1091],"pictureWon",1982),null);
  assert.equal(evaluateOscar(result.records[1091],"pictureNominated",1982),null);
  assert.equal(evaluateOscar(result.records[862],"nominated",1995),true);
});

test("duplicate film/producer statements and repeated nomination/win rows cannot inflate minimum counts",()=>{
  const duplicated=structuredClone(input);
  duplicated.picture.push(...input.picture.slice(0,200));duplicated.positive.push(...input.positive);
  const result=verifyWikidataCoverage(duplicated,PRACTICE_CATALOGUE,legacy,OSCAR_RECORDS);
  const original=verifyWikidataCoverage(input,PRACTICE_CATALOGUE,legacy,OSCAR_RECORDS);
  assert.deepEqual(result.audit.coverage,original.audit.coverage);
  assert.equal(result.audit.bestPicture.nominees,621);
  assert.deepEqual(result.audit.films.map(f=>[f.minimumConfirmedNominationCategories,f.minimumConfirmedWinCategories]),
    original.audit.films.map(f=>[f.minimumConfirmedNominationCategories,f.minimumConfirmedWinCategories]));
});

test("honorary/unknown categories and unsupported winner claims never become competitive facts",()=>{
  const changed=structuredClone(input),theThing=get(1091);
  const entity=changed.ids.find(([id])=>id===theThing.tmdbId)![1];
  changed.positive.push({film:entity,category:"Q727328",kind:"won",statement:"fixture:honorary",rank:"normal",ceremony:input.ceremonies.find(c=>c.ordinal===55)!.id});
  changed.positive.push({film:entity,category:"Q103916",kind:"won",statement:"fixture:unconfirmed-win",rank:"normal",ceremony:input.ceremonies.find(c=>c.ordinal===55)!.id});
  const result=verifyWikidataCoverage(changed,PRACTICE_CATALOGUE,legacy,OSCAR_RECORDS);
  assert.equal(evaluateOscar(result.records[1091],"won",1982),null);
  assert.ok(result.audit.positiveEvidence.rejected.some(r=>r.statement==="fixture:honorary"));
  assert.ok(result.audit.positiveEvidence.rejected.some(r=>r.statement==="fixture:unconfirmed-win"));
});

test("deprecated winners and invalid/missing ceremony contracts cannot certify a closed category",()=>{
  const changed=structuredClone(input),first=input.ceremonies.find(c=>c.ordinal===1)!;
  for(const row of changed.picture)if(row.kind==="won"&&row.ceremony===first.id)row.rank="deprecated";
  const result=verifyWikidataCoverage(changed,PRACTICE_CATALOGUE,legacy,OSCAR_RECORDS);
  assert.equal(result.audit.bestPicture.winnerCoverage,false);
  assert.throws(()=>verifyWikidataCoverage({...input,ceremonies:input.ceremonies.slice(1)},PRACTICE_CATALOGUE,legacy,OSCAR_RECORDS),/registry/);
});

test("early same-calendar-year ceremonies are not guessed and inconsistent dates are rejected",()=>{
  const base={film:"Q1",category:"Q102427",kind:"won" as const,statement:"fixture:date",rank:"normal" as const};
  assert.equal(resolveCeremony(input,{...base,date:"1930-01-01T00:00:00Z"}),null);
  const event=input.ceremonies.find(c=>c.ordinal===3)!;
  assert.equal(resolveCeremony(input,{...base,ceremony:event.id,date:"1930-01-01T00:00:00Z"})?.ordinal,3);
  assert.equal(resolveCeremony(input,{...base,ceremony:event.id,date:"1931-01-01T00:00:00Z"}),null);
});

test("six unresolved identities remain unknown rather than matching a remake, translation or conflicting year",()=>{
  for(const id of [28,1979,3050,14574,33701,260346]) {
    assert.deepEqual(get(id).oscars,UNKNOWN_OSCARS);
    for(const key of OSCAR_KEYS)assert.equal(evaluateQuestion(get(id),q(key)),null);
  }
});

test("a non-Picture film can have two verified Picture NOs while nomination, win and total counts stay unknown",()=>{
  const movie=get(1091); // The Thing: no general-zero inference is made.
  assert.equal(evaluateQuestion(movie,q("pictureNominated")),false);
  assert.equal(evaluateQuestion(movie,q("pictureWon")),false);
  assert.equal(evaluateQuestion(movie,q("nominated")),null);
  assert.equal(evaluateQuestion(movie,q("won")),null);
  assert.equal(movie.oscars?.oscarNominations,null);assert.equal(oscarSummary(movie.oscars),null);
});

test("real previously unreviewed films now have reliable positives and threshold lower bounds, without fabricated totals",()=>{
  const godfather=get(238),returnOfKing=get(122);
  assert.equal(evaluateQuestion(godfather,q("nominated")),true);
  assert.equal(evaluateQuestion(godfather,q("pictureWon")),true);
  assert.equal(godfather.oscars?.oscarNominations,null);
  for(const key of ["nominated","won","nominations3","nominations5","wins3"] as const)
    assert.equal(evaluateQuestion(returnOfKing,q(key)),true,key);
  assert.equal(returnOfKing.oscars?.oscarWins,null);
});

test("Best Picture questions work on ordinary remaining films despite unknown general awards, with the same ranking/search gate",()=>{
  const movies=[get(238),get(1091),get(597),get(949)];
  const questions=validQuestions(movies);
  assert.ok(questions.some(q=>q.id==="oscar:pictureWon"));
  assert.ok(questions.some(q=>q.id==="oscar:pictureNominated"));
  assert.ok(!questions.some(q=>q.id==="oscar:nominated"));
  assert.ok(searchQuestions(questions,"best picture").some(q=>q.id==="oscar:pictureWon"));
  const suggestions=suggestedQuestions(questions);
  assert.equal(new Set(suggestions.map(q=>q.partitionKey)).size,suggestions.length);
  assert.equal(suggestions[0]?.balance,questions[0]?.balance, "The strongest split takes priority over category variety");
  assert.ok(suggestions.every(q=>questions.includes(q)));
  assert.ok(!validQuestions([...movies,get(28)]).some(q=>q.kind==="oscar"));
});

test("new static evidence does not change exact totals or inject the offline verifier/raw input into the game",()=>{
  assert.equal(Object.keys(OSCAR_RECORDS).length,20);
  assert.equal(Object.keys(OSCAR_QUESTION_EVIDENCE).length,1200);
  assert.equal(PRACTICE_CATALOGUE.length,1206);
  for(const file of ["../lib/data/bundled-awards.ts","../lib/data/oscar-question-snapshot.ts"]) {
    const source=readFileSync(new URL(file,import.meta.url),"utf8");
    assert.doesNotMatch(source,/fetch\(|wikidata-input|wikidata-verifier|node:crypto/);
  }
});

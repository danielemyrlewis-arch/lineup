import type { OscarRecord, OscarAnswerEvidence, OscarQuestionKey } from "../game/types.ts";

export const UNKNOWN_OSCARS: Readonly<OscarRecord> = Object.freeze({
  oscarNominations: null,
  oscarWins: null,
  nominatedForBestPicture: null,
  wonBestPicture: null,
  awardsDataStatus: "unknown",
  awardsSource: null,
  verifiedOn: null,
  coverageThroughCeremony: null,
  verifiedThroughAwardYear: null,
  countingMethod: null,
});

/** Validate prepared records for import and gameplay. A missing row is never a verified zero.
 * One count per competitive film/category/nominee entry, not per recipient.
 * Excludes honorary and scientific/technical awards. Requires a reviewed,
 * complete film record, including an explicit ceremony coverage cutoff.
 * This validates shape/consistency; it cannot certify a source's factual accuracy.
 */
function normaliseCompleteOscarRecord(value: unknown): OscarRecord {
  const unknown = (): OscarRecord => ({ ...UNKNOWN_OSCARS });
  if (!value || typeof value !== "object") return unknown();
  const row = value as Partial<OscarRecord>;
  const count = (n: unknown): n is number =>
    typeof n === "number" && Number.isSafeInteger(n) && n >= 0;
  if (
    row.awardsDataStatus !== "verified" ||
    !count(row.oscarNominations) ||
    !count(row.oscarWins) ||
    row.oscarWins > row.oscarNominations ||
    typeof row.nominatedForBestPicture !== "boolean" ||
    typeof row.wonBestPicture !== "boolean" ||
    (row.nominatedForBestPicture && row.oscarNominations === 0) ||
    (row.wonBestPicture && (!row.nominatedForBestPicture || row.oscarWins === 0)) ||
    typeof row.awardsSource !== "string" ||
    !URL.canParse(row.awardsSource) ||
    new URL(row.awardsSource).protocol !== "https:" ||
    typeof row.verifiedOn !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(row.verifiedOn) ||
    !Number.isFinite(Date.parse(row.verifiedOn)) ||
    new Date(row.verifiedOn).toISOString().slice(0, 10) !== row.verifiedOn ||
    !count(row.coverageThroughCeremony) ||
    row.coverageThroughCeremony < 1 ||
    !count(row.verifiedThroughAwardYear) ||
    row.verifiedThroughAwardYear < 1928 ||
    row.verifiedThroughAwardYear > Number(row.verifiedOn.slice(0, 4)) ||
    row.coverageThroughCeremony !== row.verifiedThroughAwardYear - 1927 ||
    (row.verifiedThroughAwardYear >= 1934 &&
      row.verifiedThroughAwardYear >= Number(row.verifiedOn.slice(0, 4))) ||
    row.countingMethod !== "competitive-film-category-entries"
  ) return unknown();
  return {
    oscarNominations: row.oscarNominations,
    oscarWins: row.oscarWins,
    nominatedForBestPicture: row.nominatedForBestPicture,
    wonBestPicture: row.wonBestPicture,
    awardsDataStatus: "verified",
    awardsSource: row.awardsSource,
    verifiedOn: row.verifiedOn,
    coverageThroughCeremony: row.coverageThroughCeremony,
    verifiedThroughAwardYear: row.verifiedThroughAwardYear,
    countingMethod: row.countingMethod,
  };
}

export const OSCAR_KEYS: readonly OscarQuestionKey[] = [
  "nominated", "won", "pictureNominated", "pictureWon", "nominations3", "nominations5", "wins3",
];

function normaliseAnswer(value: unknown, key: OscarQuestionKey): OscarAnswerEvidence | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<OscarAnswerEvidence>;
  if (typeof row.value !== "boolean" || typeof row.source !== "string" ||
      !URL.canParse(row.source) || new URL(row.source).protocol !== "https:" ||
      typeof row.verifiedOn !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(row.verifiedOn) ||
      !Number.isFinite(Date.parse(row.verifiedOn)) ||
      new Date(row.verifiedOn).toISOString().slice(0, 10) !== row.verifiedOn ||
      !Number.isSafeInteger(row.verifiedThroughAwardYear) || row.verifiedThroughAwardYear! < 1928 ||
      row.verifiedThroughAwardYear! > Number(row.verifiedOn.slice(0,4)) ||
      row.coverageThroughCeremony !== row.verifiedThroughAwardYear! - 1927 ||
      (row.verifiedThroughAwardYear! >= 1934 && row.verifiedThroughAwardYear! >= Number(row.verifiedOn.slice(0,4)))) return null;
  const picture = key === "pictureNominated" || key === "pictureWon";
  const threshold = key === "nominations3" || key === "nominations5" || key === "wins3";
  if (row.basis === "complete-category" ? !picture :
      row.basis === "minimum-count" ? !threshold || !row.value :
      row.basis === "positive-entry" ? threshold || !row.value :
      row.basis !== "reviewed-film") return null;
  return {value:row.value,source:row.source,verifiedOn:row.verifiedOn,
    verifiedThroughAwardYear:row.verifiedThroughAwardYear!,coverageThroughCeremony:row.coverageThroughCeremony!,basis:row.basis!};
}

/** Exact totals and question evidence are independent. A partial count is not an exact total. */
export function normaliseOscarRecord(value: unknown): OscarRecord {
  const complete = normaliseCompleteOscarRecord(value);
  if (!value || typeof value !== "object") return complete;
  const row = value as Partial<OscarRecord>;
  if (!["verified", "partial"].includes(row.awardsDataStatus ?? "") ||
      !row.answers || typeof row.answers !== "object") return complete;
  const answers: NonNullable<OscarRecord["answers"]> = {};
  for (const key of OSCAR_KEYS) {
    if (Object.hasOwn(row.answers,key)) answers[key] = normaliseAnswer(row.answers[key],key);
  }
  // Conflicting independent claims are held, without erasing unrelated evidence.
  const implications: [OscarQuestionKey,OscarQuestionKey][] = [
    ["pictureWon","pictureNominated"], ["pictureWon","won"], ["pictureNominated","nominated"],
    ["won","nominated"], ["nominations5","nominations3"], ["nominations3","nominated"],
    ["wins3","won"], ["wins3","nominations3"],
  ];
  const conflicts = new Set<OscarQuestionKey>();
  for (const [left,right] of implications)
    if (answers[left]?.value === true && answers[right]?.value === false) {
      conflicts.add(left); conflicts.add(right);
    }
  for (const key of conflicts) answers[key] = null;
  if (complete.awardsDataStatus === "verified") {
    for (const key of OSCAR_KEYS) {
      const answer=answers[key];
      if(answer && answer.verifiedThroughAwardYear<=complete.verifiedThroughAwardYear! &&
          answer.value!==exactAnswer(complete,key)) answers[key]=null;
    }
    return {...complete,answers};
  }
  if (row.awardsDataStatus === "partial" && Object.values(answers).some(Boolean))
    return {...UNKNOWN_OSCARS,awardsDataStatus:"partial",answers};
  return {...UNKNOWN_OSCARS};
}

export const OSCAR_QUESTIONS = [
  { key: "nominated", label: "Was it nominated for an Oscar?", aliases: ["nominated", "nomination", "nominations", "oscar nominations", "academy award nomination"] },
  { key: "won", label: "Did it win an Oscar?", aliases: ["win", "won", "winner", "won an Oscar", "academy award winner"] },
  { key: "pictureNominated", label: "Was it nominated for Best Picture?", aliases: ["best picture", "best picture nomination", "nominated for best picture"] },
  { key: "pictureWon", label: "Did it win Best Picture?", aliases: ["best picture", "best picture winner", "won best picture"] },
  { key: "nominations3", label: "Did it receive at least three Oscar nominations?", aliases: ["nominated", "nominations", "three nominations", "3 nominations", "at least 3 oscar nominations"] },
  { key: "nominations5", label: "Did it receive at least five Oscar nominations?", aliases: ["nominated", "nominations", "five nominations", "5 nominations", "at least 5 oscar nominations"] },
  { key: "wins3", label: "Did it win at least three Oscars?", aliases: ["win", "won", "wins", "three oscars", "3 oscars", "3 wins", "at least 3 academy awards"] },
] as const;

/** Each question needs its own proof. Positive evidence never creates an unproved NO. */
export function evaluateOscar(value: unknown, key: string, releaseYear?: number | null): boolean | null {
  if (!OSCAR_KEYS.includes(key as OscarQuestionKey)) return null;
  const record = normaliseOscarRecord(value);
  const answer = record.answers?.[key as OscarQuestionKey];
  if (record.answers && Object.hasOwn(record.answers,key))
    return !answer || (releaseYear != null && releaseYear > answer.verifiedThroughAwardYear) ? null : answer.value;
  if (record.awardsDataStatus !== "verified" ||
      (releaseYear != null && releaseYear > record.verifiedThroughAwardYear!)) return null;
  return exactAnswer(record,key as OscarQuestionKey);
}

function exactAnswer(record: OscarRecord, key: OscarQuestionKey): boolean | null {
  switch (key) {
    case "nominated": return record.oscarNominations! > 0;
    case "won": return record.oscarWins! > 0;
    case "pictureNominated": return record.nominatedForBestPicture;
    case "pictureWon": return record.wonBestPicture;
    case "nominations3": return record.oscarNominations! >= 3;
    case "nominations5": return record.oscarNominations! >= 5;
    case "wins3": return record.oscarWins! >= 3;
    default: return null;
  }
}

export function oscarSummary(value: unknown): string | null {
  const record = normaliseOscarRecord(value);
  if (record.awardsDataStatus !== "verified") return null;
  const n = record.oscarNominations!, w = record.oscarWins!;
  const counts = `${n} Oscar nomination${n === 1 ? "" : "s"} · ${w} win${w === 1 ? "" : "s"}`;
  return record.wonBestPicture ? `${counts} · Best Picture winner` : counts;
}

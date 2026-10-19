import type { OscarRecord } from "../game/types.ts";

export const UNKNOWN_OSCARS: Readonly<OscarRecord> = Object.freeze({
  oscarNominations: null,
  oscarWins: null,
  nominatedForBestPicture: null,
  wonBestPicture: null,
  awardsDataStatus: "unknown",
  awardsSource: null,
  verifiedOn: null,
  coverageThroughCeremony: null,
  countingMethod: null,
});

/** Offline preparation only. A missing row is never a verified zero.
 * One count per competitive film/category/nominee entry, not per recipient.
 * Excludes honorary and scientific/technical awards. Requires a reviewed,
 * complete film record, including an explicit ceremony coverage cutoff.
 * This validates shape/consistency; it cannot certify a source's factual accuracy.
 */
export function normaliseOscarRecord(value: unknown): OscarRecord {
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
    countingMethod: row.countingMethod,
  };
}

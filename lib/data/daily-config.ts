/** Before first publication only: choose launch date, then generate a new unpublished schedule.
 * Once published, extend the schedule; never shift its dates or reuse its numbers.
 */
export const DAILY_LAUNCH_DATE = "2026-10-20";
export const DAILY_INITIAL_DAYS = 365;
export const DAILY_CATALOGUE_VERSION = "lineup-catalogue-2026-10-20-v1";
// Pins the existing local catalogue, without copying movie metadata into every puzzle.
// Catalogue maintenance must retain this version and pass check:daily before publishing.
export const DAILY_CATALOGUE_SHA256 = "33298b6f7823da3feb66334715e9c508bad44c7d68b3d970fa76fb45a00e0368";

/** Frozen initial release boundary; future appends do not alter this proof. */
export const DAILY_FROZEN_PREFIX = {length:365,sha256:"3681a74f65367a11f358ac49dd786baf7b05cab7ef4cbe162465d9e8d24d3948"};

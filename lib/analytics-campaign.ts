/** Broad promotional labels only; no campaign value or raw URL is persisted here. */
export interface AnalyticsCampaign {
  campaign_source: "reddit" | "playlin" | "foundplay" | "slowden" | "facebook" | "discord" | "letterboxd";
  campaign_medium: "community" | "directory" | "social";
  campaign_name: "public_testing" | "launch";
}
const SOURCES = new Set(["reddit", "playlin", "foundplay", "slowden", "facebook", "discord", "letterboxd"]);
const MEDIUMS = new Set(["community", "directory", "social"]);
const CAMPAIGNS = new Set(["public_testing", "launch"]);
const KEYS = ["utm_source", "utm_medium", "utm_campaign"] as const;

/** Called by analytics installation after opt-in, using only the URL still present then. */
export function validatedAnalyticsCampaign(href: unknown): AnalyticsCampaign | null {
  if (typeof href !== "string" || href.length > 8_192) return null;
  try {
    const url = new URL(href);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return null;
    const found = new Map<string, string>();
    for (const [rawKey, rawValue] of url.searchParams) {
      const key = rawKey.toLowerCase();
      if (!(KEYS as readonly string[]).includes(key)) continue;
      // Case-normalised duplicate keys are ambiguous, even if their values agree.
      if (found.has(key) || !rawValue.length || rawValue.length > 32 || !/^[A-Za-z_ ]+$/.test(rawValue)) return null;
      found.set(key, rawValue.trim().toLowerCase());
    }
    // A complete triplet avoids mixing an approved source with unknown attribution.
    if (found.size !== KEYS.length) return null;
    const source = found.get("utm_source")!, medium = found.get("utm_medium")!, campaign = found.get("utm_campaign")!;
    if (!SOURCES.has(source) || !MEDIUMS.has(medium) || !CAMPAIGNS.has(campaign)) return null;
    return {campaign_source: source, campaign_medium: medium, campaign_name: campaign} as AnalyticsCampaign;
  } catch { return null; }
}

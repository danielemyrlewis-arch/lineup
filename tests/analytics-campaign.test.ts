import test from "node:test";
import assert from "node:assert/strict";
import { validatedAnalyticsCampaign } from "../lib/analytics-campaign.ts";

const url = (source = "reddit", medium = "community", campaign = "public_testing") =>
  `https://dailylineup.co.uk/?utm_source=${source}&utm_medium=${medium}&utm_campaign=${campaign}`;

test("approved Reddit and directory campaign triplets become Google's standard config fields", () => {
  assert.deepEqual(validatedAnalyticsCampaign(url()), {campaign_source: "reddit", campaign_medium: "community", campaign_name: "public_testing"});
  for (const source of ["playlin", "foundplay", "slowden"])
    assert.deepEqual(validatedAnalyticsCampaign(url(source, "directory", "launch")), {campaign_source: source, campaign_medium: "directory", campaign_name: "launch"});
  for (const source of ["facebook", "discord", "letterboxd"])
    assert.deepEqual(validatedAnalyticsCampaign(url(source, "social")), {campaign_source: source, campaign_medium: "social", campaign_name: "public_testing"});
});

test("approved values and parameter names normalise case and ordinary surrounding spaces", () => {
  assert.deepEqual(validatedAnalyticsCampaign("https://dailylineup.co.uk/?UTM_SOURCE=%20Reddit%20&utm_medium=COMMUNITY&utm_campaign=Launch"), {
    campaign_source: "reddit", campaign_medium: "community", campaign_name: "launch",
  });
  assert.deepEqual(validatedAnalyticsCampaign(url("%72eddit")), validatedAnalyticsCampaign(url()));
});

test("unknown, ambiguous, malformed, oversized or identifying campaign values are rejected", () => {
  for (const value of [
    url("a-person"), url("person%40example.test"), url("reddit%0A"), url("reddit%00"), url("r%C3%A9ddit"), url("reddit%2Fperson"),
    url("reddit", "email"), url("reddit", "community", "a_personal_campaign"), url("x".repeat(33)),
    url("%2572eddit"), url("%zz"), url("reddit", "social", ""),
    `${url()}&utm_source=reddit`, `${url()}&UTM_SOURCE=facebook`, `${url()}&utm_campaign=launch`,
  ]) assert.equal(validatedAnalyticsCampaign(value), null, value);
});

test("missing or partial tags produce no campaign and do not borrow other URL fields", () => {
  for (const value of [
    "https://dailylineup.co.uk/", "https://dailylineup.co.uk/?mode=practice", "https://dailylineup.co.uk/?utm_source=reddit",
    "https://dailylineup.co.uk/?utm_source=reddit&utm_medium=community", "https://dailylineup.co.uk/#utm_source=reddit&utm_medium=community&utm_campaign=launch",
    "https://dailylineup.co.uk/?source=reddit&medium=community&campaign=launch", null, undefined, 1, "not a URL",
    "javascript:alert(1)", `${url()}&padding=${"x".repeat(8_192)}`,
  ]) assert.equal(validatedAnalyticsCampaign(value), null);
});

test("OAuth parameters, arbitrary query values, fragments and referring URLs never appear in the result", () => {
  const result = validatedAnalyticsCampaign(`${url()}&code=private-code&email=private%40example.test&user_id=private-id&access_token=private-token&redirect_to=https%3A%2F%2Fprivate.example.test&utm_content=private-person&utm_term=secret-film#refresh_token=private-refresh`);
  assert.deepEqual(result, {campaign_source: "reddit", campaign_medium: "community", campaign_name: "public_testing"});
  const serialised = JSON.stringify(result);
  for (const forbidden of ["private", "code", "email", "user_id", "access_token", "redirect_to", "utm_", "secret-film", "refresh_token", "https:"])
    assert.ok(!serialised.includes(forbidden));
  assert.equal(validatedAnalyticsCampaign("https://dailylineup.co.uk/?code=private-code&state=private-state#access_token=private-token"), null);
});

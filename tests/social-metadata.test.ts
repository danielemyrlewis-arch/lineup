import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { SITE_URL, SITE_TITLE, SITE_DESCRIPTION, SOCIAL_IMAGE } from "../lib/site.ts";

const publicFile = (path: string) => new URL(`../public/${path}`, import.meta.url);

function pngSize(path: string): [number, number] {
  const bytes = readFileSync(publicFile(path));
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(bytes.toString("ascii", 12, 16), "IHDR");
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

test("the public share/canonical URL and raster preview use the custom domain root", () => {
  assert.equal(SITE_URL, "https://dailylineup.co.uk/");
  const image = new URL(SOCIAL_IMAGE.url);
  assert.equal(image.origin, new URL(SITE_URL).origin);
  assert.equal(image.pathname, "/social/lineup-og.png");
  assert.match(SITE_TITLE, /LINEUP.*Movie Guessing Game/);
  assert.match(SITE_DESCRIPTION, /five yes-or-no questions/);
  assert.ok(!/today|daily|premium|subscription/i.test(SITE_DESCRIPTION));
  assert.ok(SOCIAL_IMAGE.alt.includes("24 films"));
});

test("the social preview is a real lightweight 1200 by 630 PNG and icons have their declared sizes", () => {
  assert.deepEqual(pngSize("social/lineup-og.png"), [SOCIAL_IMAGE.width, SOCIAL_IMAGE.height]);
  assert.deepEqual(pngSize("apple-touch-icon.png"), [180, 180]);
  assert.deepEqual(pngSize("favicon-32.png"), [32, 32]);
  assert.ok(statSync(publicFile("social/lineup-og.png")).size < 100_000);
});

test("the single-page sitemap advertises only the real canonical game URL", () => {
  const sitemap = readFileSync(publicFile("sitemap.xml"), "utf8");
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
  assert.deepEqual(urls, [SITE_URL]);
  assert.ok(!sitemap.includes("lastmod"), "Do not invent a content modification date");
});


test("the custom domain and root crawler policy survive export as public files", () => {
  assert.equal(readFileSync(publicFile("CNAME"), "utf8"), "dailylineup.co.uk\n");
  const robots = readFileSync(publicFile("robots.txt"), "utf8");
  assert.match(robots, /^User-agent:\s*\*$/m);
  assert.match(robots, /^Allow:\s*\/$/m);
  assert.match(robots, /^Sitemap:\s*https:\/\/dailylineup\.co\.uk\/sitemap\.xml$/m);
  assert.ok(!robots.includes("github.io"));
  assert.ok(!robots.includes("/lineup/"));
});

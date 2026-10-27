import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
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
  assert.match(SITE_DESCRIPTION, /free daily movie guessing game/i);
  assert.ok(!/premium|subscription/i.test(SITE_DESCRIPTION));
  assert.ok(SOCIAL_IMAGE.alt.includes("24 films"));
});

test("the social preview is a real lightweight 1200 by 630 PNG and icons have their declared sizes", () => {
  assert.deepEqual(pngSize("social/lineup-og.png"), [SOCIAL_IMAGE.width, SOCIAL_IMAGE.height]);
  assert.deepEqual(pngSize("apple-touch-icon.png"), [180, 180]);
  assert.deepEqual(pngSize("favicon-32.png"), [32, 32]);
  assert.ok(statSync(publicFile("social/lineup-og.png")).size < 100_000);
});

test("the sitemap advertises only the canonical homepage and useful privacy page", () => {
  const sitemap = readFileSync(publicFile("sitemap.xml"), "utf8");
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
  assert.deepEqual(urls, [SITE_URL, `${SITE_URL}privacy/`]);
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


interface IconDeclaration {url: string; type?: string; sizes?: string}

/** Evaluate the actual Next metadata while keeping browser-only UI and font processing inert. */
async function layoutIcons(): Promise<{icon: IconDeclaration[]; apple: IconDeclaration[]}> {
  const exports = {} as {metadata: {icons: {icon: IconDeclaration[]; apple: IconDeclaration[]}}};
  const jsx = await import("react/jsx-runtime");
  const source = ts.transpileModule(readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8"), {
    compilerOptions: {jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017},
  }).outputText;
  runInNewContext(source, {exports, URL, require: (name: string) => {
    if (name === "react/jsx-runtime") return jsx;
    if (name === "next/font/local") return {default: () => ({variable: "fixture-font"})};
    if (name === "@/components/analytics/analytics-consent") return {AnalyticsConsent: () => null};
    if (name.endsWith(".css")) return {};
    assert.equal(name, "@/lib/site");
    return {SITE_URL, SITE_TITLE, SITE_DESCRIPTION, SOCIAL_IMAGE};
  }});
  return exports.metadata.icons;
}

test("homepage metadata advertises the existing large square PNG as its primary stable regular favicon", async () => {
  const icons = await layoutIcons();
  assert.ok(Array.isArray(icons.icon));
  const primary = icons.icon[0];
  assert.equal(primary.type, "image/png");
  assert.equal(primary.url, new URL("apple-touch-icon.png", SITE_URL).href);
  const [width, height] = pngSize(new URL(primary.url).pathname.slice(1));
  assert.equal(width, height);
  assert.ok(width >= 96, "The regular PNG candidate should exceed Google's recommended 48px size");
  assert.equal(primary.sizes, `${width}x${height}`);
  assert.ok(icons.apple.some(icon => icon.url === primary.url && icon.sizes === primary.sizes),
    "The existing Apple touch declaration must keep the same reviewed artwork and correct dimensions");
  assert.ok(icons.icon.some(icon => icon.url === new URL("favicon.svg", SITE_URL).href && icon.type === "image/svg+xml"));
  assert.ok(icons.icon.some(icon => icon.url === new URL("favicon-32.png", SITE_URL).href && icon.sizes === "32x32"));
  assert.equal(new Set(icons.icon.map(icon => icon.url)).size, icons.icon.length,
    "Regular icon declarations must not contain duplicate URLs");
  for (const icon of [...icons.icon, ...icons.apple]) {
    const url = new URL(icon.url);
    assert.equal(url.origin, new URL(SITE_URL).origin);
    assert.equal(url.search, ""); assert.equal(url.hash, "");
    assert.ok(statSync(publicFile(url.pathname.slice(1))).isFile());
  }
});

test("automatic root icon routes cannot silently take precedence over the reviewed favicon declarations", () => {
  const automatic = readdirSync(new URL("../app/", import.meta.url)).filter(name =>
    /^(?:favicon\.ico|(?:icon|apple-icon)(?:\d+)?\.(?:ico|jpe?g|png|svg|tsx?|jsx?))$/i.test(name));
  assert.deepEqual(automatic, [], "Review any Next file-convention icons before overriding the explicit favicon metadata");
});

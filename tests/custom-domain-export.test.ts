import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const checker = fileURLToPath(new URL("../scripts/check-static-export.mjs", import.meta.url));
const origin = "https://dailylineup.co.uk/";
const publicAccountKeys = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_GOOGLE_CLIENT_ID",
] as const;
type AccountEnvironment = Partial<Record<typeof publicAccountKeys[number], string>>;
const publicAccountFixture = {
  NEXT_PUBLIC_SUPABASE_URL: "https://fixture-project.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture_public_key",
  NEXT_PUBLIC_GOOGLE_CLIENT_ID: "123456789012-fixture_web_client.apps.googleusercontent.com",
};
const compiledAccountFixture = JSON.stringify(publicAccountFixture);
const html = `<!doctype html><html><head>
<link rel="canonical" href="${origin}"/>
<meta property="og:url" content="${origin}"/>
<meta property="og:image" content="${origin}social/lineup-og.png"/>
<meta name="twitter:image" content="${origin}social/lineup-og.png"/>
<link rel="stylesheet" href="/_next/static/app.css"/>
</head><body><img src="/posters/27205.jpg"/><script src="/_next/static/app.js"></script></body></html>`;

function checkFixture(changes: Record<string, string | null> = {}, staleBase = "", accountEnvironment: AccountEnvironment = {}) {
  const directory = mkdtempSync(path.join(tmpdir(), "lineup-domain-export-"));
  const files: Record<string, string | null> = {
    "index.html": html,
    ".nojekyll": "",
    "CNAME": "dailylineup.co.uk\n",
    "robots.txt": `User-agent: *\nAllow: /\nSitemap: ${origin}sitemap.xml\n`,
    "sitemap.xml": `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${origin}</loc></url></urlset>`,
    "_next/static/app.css": 'body { background: url("/posters/27205.jpg"); }',
    "_next/static/app.js": 'const poster = "/posters/27205.jpg";',
    "posters/27205.jpg": "fixture image",
    "social/lineup-og.png": "fixture image",
    ...changes,
  };
  try {
    for (const [name, content] of Object.entries(files)) {
      if (content === null) continue;
      const target = path.join(directory, "out", name);
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, content);
    }
    // Guest fixtures must stay independent of a developer shell's public values.
    const environment = { ...process.env };
    for (const key of publicAccountKeys) delete environment[key];
    const result = spawnSync(process.execPath, [checker], {
      cwd: directory,
      env: { ...environment, ...accountEnvironment, PAGES_BASE_PATH: staleBase },
      encoding: "utf8",
    });
    if (result.error) throw result.error;
    return { status: result.status, output: result.stdout + result.stderr };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test("a complete custom-domain static export passes even with an obsolete shell base path", () => {
  const result = checkFixture({}, "/lineup");
  assert.equal(result.status, 0, result.output);
  assert.equal(JSON.parse(result.output.trim()).basePath, "/");
});

test("publishing rejects a missing or incorrect CNAME rather than dropping the domain on a rebuild", () => {
  for (const value of [null, "www.dailylineup.co.uk\n", "dailylineup.co.uk\nextra.example\n"]) {
    const result = checkFixture({ CNAME: value });
    assert.notEqual(result.status, 0, "An absent or altered custom-domain declaration must fail export validation");
    assert.match(result.output, /CNAME/i);
  }
});

test("legacy subdirectory asset references cannot be published", () => {
  const scenarios: Record<string, string | null>[] = [
    { "index.html": html.replace('/_next/static/app.js', '/lineup/_next/static/app.js') },
    { "_next/static/app.js": 'const poster = "/lineup/posters/27205.jpg";' },
    { "_next/static/app.css": 'body { background: url("/lineup/posters/27205.jpg"); }' },
  ];
  for (const changes of scenarios) {
    const result = checkFixture(changes);
    assert.notEqual(result.status, 0, "Assets pointing at the old repository path must fail export validation");
  }
});

test("same-origin absolute URLs are checked against the exported files", () => {
  const valid = checkFixture({ "index.html": html.replace('/posters/27205.jpg', `${origin}posters/27205.jpg`) });
  assert.equal(valid.status, 0, valid.output);
  const missing = checkFixture({ "index.html": html.replace('/posters/27205.jpg', `${origin}posters/missing.jpg`) });
  assert.notEqual(missing.status, 0);
  assert.match(missing.output, /missing/i);
});

test("old canonical and crawler addresses cannot reach a publishable export", () => {
  const scenarios: Record<string, string | null>[] = [
    { "index.html": html.replace('href="https://dailylineup.co.uk/"', 'href="https://danielemyrlewis-arch.github.io/lineup/"') },
    { "sitemap.xml": '<urlset><url><loc>https://danielemyrlewis-arch.github.io/lineup/</loc></url></urlset>' },
    { "robots.txt": 'User-agent: *\nAllow: /\nSitemap: https://danielemyrlewis-arch.github.io/lineup/sitemap.xml\n' },
  ];
  for (const changes of scenarios) {
    const result = checkFixture(changes);
    assert.notEqual(result.status, 0, "A stale public address must fail export validation");
  }
});

test("account-enabled exports require all three public values in the browser bundle", () => {
  const result = checkFixture({ "_next/static/app.js": compiledAccountFixture }, "", publicAccountFixture);
  assert.equal(result.status, 0, result.output);
  const report = JSON.parse(result.output.trim());
  assert.equal(report.accountsConfigured, true);
  assert.equal(report.publicSupabaseConfigVerified, true);
  assert.equal(report.publicGoogleClientIdVerified, true);
  for (const value of Object.values(publicAccountFixture))
    assert.equal(result.output.includes(value), false, "Validation output must not print public configuration values");
});

test("account-enabled exports reject a missing Google Web Client ID", () => {
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY } = publicAccountFixture;
  const result = checkFixture({ "_next/static/app.js": compiledAccountFixture }, "", {
    NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  assert.notEqual(result.status, 0);
  assert.match(result.output, /Google Web Client ID/);
});

test("account-enabled exports reject a placeholder Google Web Client ID", () => {
  const configuration = { ...publicAccountFixture, NEXT_PUBLIC_GOOGLE_CLIENT_ID: "PASTE_YOUR_GOOGLE_WEB_CLIENT_ID_HERE" };
  const result = checkFixture({ "_next/static/app.js": JSON.stringify(configuration) }, "", configuration);
  assert.notEqual(result.status, 0);
  assert.match(result.output, /Google Web Client ID/);
});

test("account-enabled exports reject a Google Web Client ID omitted from compiled JavaScript", () => {
  const compiledWithoutGoogle = JSON.stringify({
    NEXT_PUBLIC_SUPABASE_URL: publicAccountFixture.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publicAccountFixture.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  const result = checkFixture({ "_next/static/app.js": compiledWithoutGoogle }, "", publicAccountFixture);
  assert.notEqual(result.status, 0);
  assert.match(result.output, /Google Web Client ID/);
});

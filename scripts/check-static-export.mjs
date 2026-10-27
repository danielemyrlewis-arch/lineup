import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import path from "node:path";

const root = path.resolve("out");
const site = new URL("https://dailylineup.co.uk/");
const files = [];
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else files.push(file);
  }
}
if (!existsSync(path.join(root, "index.html")))
  throw Error("Missing static out/index.html");
walk(root);
if (!existsSync(path.join(root, ".nojekyll"))) throw Error("Missing .nojekyll");
if (!existsSync(path.join(root, "CNAME")) ||
    readFileSync(path.join(root, "CNAME"), "utf8") !== `${site.hostname}\n`)
  throw Error("CNAME must contain only dailylineup.co.uk and a final newline");
const sitemap = readFileSync(path.join(root, "sitemap.xml"), "utf8");
if (JSON.stringify([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1])) !== JSON.stringify([site.href]))
  throw Error("The sitemap must advertise the custom-domain root");
const robots = readFileSync(path.join(root, "robots.txt"), "utf8");
if (!/^User-agent: \*$/m.test(robots) || !/^Allow: \/$/m.test(robots) ||
    !robots.includes(`Sitemap: ${site.href}sitemap.xml`))
  throw Error("robots.txt must allow the root site and link its sitemap");
const index = readFileSync(path.join(root, "index.html"), "utf8");
const publishedJs = files.filter(file => file.endsWith(".js")).map(file => readFileSync(file, "utf8")).join("\n");
// Next inlines only these public browser values; never print their contents.
const localEnv = existsSync(".env.local") ? readFileSync(".env.local", "utf8") : "";
const publicValue = name => process.env[name] ?? localEnv.match(new RegExp(`^${name}=(.*)$`, "m"))?.[1]?.trim();
const accountUrl = publicValue("NEXT_PUBLIC_SUPABASE_URL");
const accountKey = publicValue("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
const googleClientId = publicValue("NEXT_PUBLIC_GOOGLE_CLIENT_ID");
const accountsConfigured = !!(accountUrl && accountKey);
if (accountsConfigured && (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(accountUrl) ||
    !/^sb_publishable_[A-Za-z0-9_-]+$/.test(accountKey) ||
    !publishedJs.includes(accountUrl) || !publishedJs.includes(accountKey)))
  throw Error("The configured public Supabase values are missing or invalid in the static browser build");
if (accountsConfigured && (!googleClientId ||
    !/^\d+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(googleClientId) ||
    !publishedJs.includes(googleClientId)))
  throw Error("The public Google Web Client ID is missing or invalid in the static browser build");
for (const tag of [
  `rel="canonical" href="${site.href}"`,
  `property="og:url" content="${site.href}"`,
  `property="og:image" content="${site.href}social/lineup-og.png"`,
  `name="twitter:image" content="${site.href}social/lineup-og.png"`,
]) {
  if (!index.includes(tag)) throw Error(`Missing custom-domain metadata: ${tag}`);
}
function checkAsset(raw, from) {
  if (/^(data:|#|mailto:|tel:)/.test(raw)) return;
  const relative = path.relative(root, from).split(path.sep).join("/");
  const url = new URL(raw, new URL(relative, site));
  if (url.origin !== site.origin) return;
  let target = path.join(
    root,
    decodeURIComponent(url.pathname),
  );
  if (existsSync(target) && statSync(target).isDirectory())
    target = path.join(target, "index.html");
  if (!existsSync(target))
    throw Error(`Missing static asset: ${relative} → ${url.pathname}`);
}
for (const file of files) {
  const text = /\.(html|css|js|xml|txt)$/.test(file) ? readFileSync(file, "utf8") : "";
  if (/\bsb_secret_[A-Za-z0-9_-]{10,}\b|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|postgres(?:ql)?:\/\/[^\s/]+:[^\s@]+@/.test(text))
    throw Error(`A secret credential reached ${path.relative(root, file)}`);
  if (text.includes("danielemyrlewis-arch.github.io") || text.includes("/lineup/"))
    throw Error(`Obsolete repository URL or path in ${path.relative(root, file)}`);
  if (file.endsWith(".html")) {
    for (const match of text.matchAll(/\b(?:src|href)="([^"]+)"/g))
      checkAsset(match[1], file);
  }
  if (file.endsWith(".css")) {
    for (const match of text.matchAll(
      /url\(["']?([^\s)"']+)["']?\)/g,
    ))
      checkAsset(match[1], file);
  }
  if (
    file.endsWith(".js") &&
    /api\.themoviedb\.org|\/api\/lineup|TMDB_API_TOKEN|appgprj_[a-z0-9]{10}/.test(
      text,
    )
  )
    throw Error(
      "A runtime film API/private hosting reference reached a production bundle",
    );
}
const bytes = files.reduce((total, file) => total + statSync(file).size, 0);
if (bytes > 100 * 1024 * 1024)
  throw Error("Static export unexpectedly exceeds the project's 100 MB budget");
console.log(
  JSON.stringify({
    staticExport: true,
    basePath: "/",
    siteUrl: site.href,
    cnameVerified: true,
    metadataVerified: true,
    files: files.length,
    megabytes: +(bytes / 1024 / 1024).toFixed(2),
    assetsVerified: true,
    runtimeFilmApiReferences: 0,
    accountsConfigured,
    publicSupabaseConfigVerified: accountsConfigured,
    publicGoogleClientIdVerified: accountsConfigured,
  }),
);

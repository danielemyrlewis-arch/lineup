import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import path from "node:path";

const root = path.resolve("out");
const base = (process.env.PAGES_BASE_PATH ?? "").replace(/\/$/, "");
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
function checkAsset(raw, from) {
  if (/^(data:|https?:|#|mailto:)/.test(raw)) return;
  const relative = path.relative(root, from).split(path.sep).join("/");
  const url = new URL(raw, `https://static.invalid${base}/${relative}`);
  if (base && !url.pathname.startsWith(`${base}/`))
    throw Error(`Asset escapes repository path: ${relative} → ${url.pathname}`);
  let target = path.join(
    root,
    decodeURIComponent(url.pathname.slice(base.length)),
  );
  if (existsSync(target) && statSync(target).isDirectory())
    target = path.join(target, "index.html");
  if (!existsSync(target))
    throw Error(`Missing static asset: ${relative} → ${url.pathname}`);
}
for (const file of files) {
  if (file.endsWith(".html")) {
    const html = readFileSync(file, "utf8");
    for (const match of html.matchAll(/\b(?:src|href)="([^"]+)"/g))
      checkAsset(match[1], file);
  }
  if (file.endsWith(".css")) {
    for (const match of readFileSync(file, "utf8").matchAll(
      /url\(["']?([^\s)"']+)["']?\)/g,
    ))
      checkAsset(match[1], file);
  }
  if (
    file.endsWith(".js") &&
    /api\.themoviedb\.org|\/api\/lineup|TMDB_API_TOKEN|appgprj_[a-z0-9]{10}/.test(
      readFileSync(file, "utf8"),
    )
  )
    throw Error(
      "A backend/private hosting reference reached a production bundle",
    );
}
const bytes = files.reduce((total, file) => total + statSync(file).size, 0);
if (bytes > 100 * 1024 * 1024)
  throw Error("Static export unexpectedly exceeds the project's 100 MB budget");
console.log(
  JSON.stringify({
    staticExport: true,
    basePath: base || "/",
    files: files.length,
    megabytes: +(bytes / 1024 / 1024).toFixed(2),
    assetsVerified: true,
    runtimeApiReferences: 0,
  }),
);

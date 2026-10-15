import { execFileSync } from "node:child_process";
import { cpSync, existsSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = path.join(root, "out");
const docs = path.join(root, "docs");

// Keep development at /; compile the published site specifically for /lineup/.
execFileSync(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "build"], {
  cwd: root,
  env: { ...process.env, PAGES_BASE_PATH: "/lineup" },
  stdio: "inherit",
});
if (
  !existsSync(path.join(output, "index.html")) ||
  !existsSync(path.join(output, ".nojekyll"))
)
  throw Error("The verified static export is incomplete; docs was not replaced.");

// docs is generated publishable output. Remove stale chunks before copying.
rmSync(docs, { recursive: true, force: true });
cpSync(output, docs, { recursive: true });
console.log("docs is ready for GitHub Pages: main branch, /docs folder, /lineup/ path.");

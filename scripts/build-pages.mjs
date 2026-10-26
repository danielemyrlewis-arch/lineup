import { execFileSync } from "node:child_process";
import { cpSync, existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = path.join(root, "out");
const docs = path.join(root, "docs");

// Development and the GitHub Pages custom domain both serve the origin root.
execFileSync(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "build"], {
  cwd: root,
  stdio: "inherit",
});
if (
  !existsSync(path.join(output, "index.html")) ||
  !existsSync(path.join(output, ".nojekyll")) ||
  !existsSync(path.join(output, "CNAME")) ||
  readFileSync(path.join(output, "CNAME"), "utf8") !== "dailylineup.co.uk\n"
)
  throw Error("The verified static export is incomplete; docs was not replaced.");

// docs is generated publishable output. Remove stale chunks before copying.
rmSync(docs, { recursive: true, force: true });
cpSync(output, docs, { recursive: true });
console.log("docs is ready for GitHub Pages: main branch, /docs folder, https://dailylineup.co.uk/.");

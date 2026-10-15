import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";

// Findings report locations/types only, never credential values.
const patterns = [
  ["private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  [
    "GitHub token",
    /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/,
  ],
  ["API credential", /\bsk-[A-Za-z0-9_-]{32,}\b/],
  [
    "JWT bearer",
    /\beyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{20,}/,
  ],
  ["literal bearer", /["'`]Bearer [A-Za-z0-9._-]{30,}/],
  [
    "secret assignment",
    /(?:TMDB_API_TOKEN|API_KEY|ACCESS_TOKEN|CLIENT_SECRET)\s*[=:]\s*["'`]?[A-Za-z0-9_+./=-]{24,}/,
  ],
  ["credential URL", /https?:\/\/[^\s/:]+:[^\s/@]+@[^\s/]+/],
];
const privateMetadata =
  /https?:\/\/[^\s"']+\.chatgpt\.site|appgprj_[a-z0-9]{12,}|\/Users\/[A-Za-z][^\s"']*|seedy@sites\.test/;
const findings = [],
  metadata = [];
let sourceFiles = 0;
function scan(text, location, includeMetadata = true) {
  if (text.includes("\0")) return;
  // The previous README documented this literal example, not a credential.
  text = text.replaceAll(
    "your_api_read_access_token",
    "documented-placeholder",
  );
  for (const [kind, regex] of patterns)
    if (regex.test(text)) findings.push({ location, kind });
  if (includeMetadata && privateMetadata.test(text)) metadata.push(location);
}
const files = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { encoding: "utf8" },
)
  .split("\0")
  .filter(Boolean);
for (const file of files)
  if (existsSync(file) && statSync(file).isFile()) {
    sourceFiles++;
    scan(readFileSync(file, "utf8"), file);
  }
const ignoredEnvFiles = readdirSync(".").filter(
  (f) =>
    (/^\.env(?:\.|$)/.test(f) || f.startsWith(".dev.vars")) &&
    f !== ".env.example",
);
for (const file of ignoredEnvFiles)
  if (statSync(file).isFile())
    scan(readFileSync(file, "utf8"), `ignored:${file}`);
let historyBlobs = 0;
if (process.argv.includes("--history")) {
  const objects = execFileSync("git", ["rev-list", "--objects", "--all"], {
    encoding: "utf8",
  }).split("\n");
  for (const line of objects) {
    const [sha, file] = line.split(" ");
    if (
      !file ||
      !/\.(?:ts|tsx|mts|mjs|js|json|md|sh|py|yml|yaml)$|(?:^|\/)\.env/.test(
        file,
      )
    )
      continue;
    historyBlobs++;
    scan(
      execFileSync("git", ["cat-file", "blob", sha], {
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
      }),
      `history:${sha.slice(0, 8)}:${file}`,
      false,
    );
  }
}
const envIgnored = [".env", ".env.local"].every((file) => {
  try {
    execFileSync("git", ["check-ignore", "--no-index", "-q", file]);
    return true;
  } catch {
    return false;
  }
});
console.log(
  JSON.stringify(
    {
      sourceFiles,
      historyBlobs,
      envIgnored,
      credentialFindings: findings,
      privateMetadataFindings: metadata,
    },
    null,
    2,
  ),
);
if (findings.length || metadata.length || !envIgnored) process.exitCode = 1;

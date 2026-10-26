import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { publicAsset } from "../lib/assets.ts";

// Production is always at the custom-domain root, even if a developer has an
// obsolete repository-path variable in the shell from a previous release.
test("static production configuration stays at the domain root with stale path variables", () => {
  for (const staleBase of ["", "/lineup"]) {
    const config = JSON.parse(
      execFileSync(
        process.execPath,
        [
          "--experimental-strip-types",
          "--input-type=module",
          "-e",
          "import c from './next.config.ts'; console.log(JSON.stringify(c))",
        ],
        {
          env: { ...process.env, PAGES_BASE_PATH: staleBase, NEXT_PUBLIC_BASE_PATH: staleBase },
          encoding: "utf8",
        },
      ),
    );
    assert.equal(config.output, "export");
    assert.equal(config.basePath, "");
    assert.equal(config.assetPrefix ?? "", "");
    assert.equal(config.env.NEXT_PUBLIC_BASE_PATH, "");
    assert.equal(config.images.unoptimized, true);
    assert.equal(config.trailingSlash, true);
  }
});

test("local poster and attribution paths are rooted when compiled with the production prefix", () => {
  const previous = process.env.NEXT_PUBLIC_BASE_PATH;
  try {
    process.env.NEXT_PUBLIC_BASE_PATH = "";
    assert.equal(publicAsset("/posters/27205.jpg"), "/posters/27205.jpg");
    assert.equal(publicAsset("/tmdb.svg"), "/tmdb.svg");
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_BASE_PATH;
    else process.env.NEXT_PUBLIC_BASE_PATH = previous;
  }
});

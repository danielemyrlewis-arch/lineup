import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { publicAsset } from "../lib/assets.ts";

test("static configuration and local assets support root and repository subpaths at build time", () => {
  const previous = process.env.NEXT_PUBLIC_BASE_PATH;
  try {
    for (const base of ["", "/lineup-beta"]) {
      process.env.NEXT_PUBLIC_BASE_PATH = base;
      assert.equal(
        publicAsset("/posters/27205.jpg"),
        `${base}/posters/27205.jpg`,
      );
      assert.equal(publicAsset("/tmdb.svg"), `${base}/tmdb.svg`);
      const config = JSON.parse(
        execFileSync(
          process.execPath,
          [
            "--experimental-strip-types",
            "--input-type=module",
            "-e",
            "import c from './next.config.ts'; console.log(JSON.stringify(c))",
          ],
          { env: { ...process.env, PAGES_BASE_PATH: base }, encoding: "utf8" },
        ),
      );
      assert.equal(config.output, "export");
      assert.equal(config.basePath, base);
      assert.equal(config.env.NEXT_PUBLIC_BASE_PATH, base);
      assert.equal(config.images.unoptimized, true);
      assert.equal(config.trailingSlash, true);
    }
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_BASE_PATH;
    else process.env.NEXT_PUBLIC_BASE_PATH = previous;
  }
});

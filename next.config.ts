import type { NextConfig } from "next";
// Build-time only. GitHub Actions supplies configure-pages' actual base path.
const rawBasePath = process.env.PAGES_BASE_PATH?.trim() ?? "";
const basePath = rawBasePath === "/" ? "" : rawBasePath.replace(/\/$/, "");
if (basePath && !/^\/[A-Za-z0-9._-]+$/.test(basePath))
  throw new Error(
    "PAGES_BASE_PATH must be empty or one repository path such as /lineup",
  );
const config: NextConfig = {
  output: "export",
  trailingSlash: true,
  poweredByHeader: false,
  agentRules: false,
  basePath,
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};
export default config;

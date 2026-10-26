import type { NextConfig } from "next";
// The GitHub Pages custom domain serves the static export at its origin root.
const config: NextConfig = {
  output: "export",
  trailingSlash: true,
  poweredByHeader: false,
  agentRules: false,
  basePath: "",
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_BASE_PATH: "" },
};
export default config;

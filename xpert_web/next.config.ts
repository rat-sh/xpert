import type { NextConfig } from "next";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// Local monorepo fallback: production should provide GEMINI_API_KEY through the
// host environment. The value is never sent to the browser.
if (!process.env.GEMINI_API_KEY) {
  const rootEnv = resolve(process.cwd(), '..', '.env');
  if (existsSync(rootEnv)) {
    const line = readFileSync(rootEnv, 'utf8').match(/^GEMINI_API_KEY\s*=\s*([^\r\n]+)$/m)?.[1];
    if (line) process.env.GEMINI_API_KEY = line.trim().replace(/^['"]|['"]$/g, '');
  }
}

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;

/**
 * keepAlive.ts
 *
 * Self-pinger that prevents Render free-tier services from spinning down.
 *
 * How it works:
 *  - On the very first import (server boot), it schedules a ping every
 *    PING_INTERVAL_MS milliseconds to the app's own /api/health endpoint.
 *  - A global singleton guard prevents duplicate intervals across Next.js
 *    hot-reloads in development.
 *
 * Usage: import this file in layout.tsx (server component) so it initialises
 * once per server process lifetime.
 */

const PING_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

// Use a global to survive Next.js hot-module-replacement in dev
const globalForKeepAlive = globalThis as typeof globalThis & {
  __keepAliveStarted?: boolean;
};

function getBaseUrl(): string {
  // NEXT_PUBLIC_APP_URL should be set to your Render service URL in production
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  }
  // Fallback for local development
  const port = process.env.PORT ?? '3000';
  return `http://localhost:${port}`;
}

async function ping(): Promise<void> {
  const url = `${getBaseUrl()}/api/health`;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (res.ok) {
      console.log(`[keep-alive] ✅ ${new Date().toISOString()} — ${url} → ${res.status}`);
    } else {
      console.warn(`[keep-alive] ⚠️  ${new Date().toISOString()} — ${url} → ${res.status}`);
    }
  } catch (err) {
    console.error(`[keep-alive] ❌ ${new Date().toISOString()} — failed to ping ${url}:`, err);
  }
}

export function startKeepAlive(): void {
  // Only run on the server, never in the browser
  if (typeof window !== 'undefined') return;

  // Guard against duplicate intervals
  if (globalForKeepAlive.__keepAliveStarted) return;
  globalForKeepAlive.__keepAliveStarted = true;

  console.log(`[keep-alive] 🚀 Started — pinging /api/health every ${PING_INTERVAL_MS / 60_000} minutes`);

  // Ping once on startup after a short delay (give the server time to be ready)
  setTimeout(ping, 5_000);

  // Then ping on the recurring interval
  setInterval(ping, PING_INTERVAL_MS);
}

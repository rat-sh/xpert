import { NextResponse } from 'next/server';

/**
 * GET /api/health
 *
 * Health-check endpoint used to keep the Render free-tier service alive.
 * External cron services (e.g. cron-job.org) ping this every 10 minutes.
 * The built-in self-pinger (lib/keepAlive.ts) also calls this on startup.
 */
export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    },
    { status: 200 },
  );
}

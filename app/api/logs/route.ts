import { NextResponse } from 'next/server';
import { getLogs, getLogStats, clearLogs } from '@/lib/logger';
import type { LogLevel, LogCategory } from '@/lib/logger';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const level = url.searchParams.get('level') as LogLevel | null;
  const category = url.searchParams.get('category') as LogCategory | null;
  const agent = url.searchParams.get('agent') || undefined;
  const search = url.searchParams.get('search') || undefined;
  const limit = parseInt(url.searchParams.get('limit') || '200');
  const cycle = url.searchParams.get('cycle') ? parseInt(url.searchParams.get('cycle')!) : undefined;
  const statsOnly = url.searchParams.get('stats') === 'true';

  if (statsOnly) {
    return NextResponse.json({ success: true, data: getLogStats() });
  }

  const logs = getLogs({
    ...(level && { level }),
    ...(category && { category }),
    ...(agent && { agent }),
    ...(search && { search }),
    ...(cycle !== undefined && { cycleNumber: cycle }),
    limit,
  });

  return NextResponse.json({
    success: true,
    count: logs.length,
    stats: getLogStats(),
    data: logs,
  });
}

export async function DELETE() {
  clearLogs();
  return NextResponse.json({ success: true, message: 'All logs cleared' });
}

import { NextResponse } from 'next/server';
import { getLogs, getLogStats, clearLogs } from '@/lib/logger';
import type { LogLevel, LogCategory } from '@/lib/logger';
import { fetchHistoricalLogs, isSupabaseEnabled } from '@/lib/supabase';

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

  let logs = getLogs({
    ...(level && { level }),
    ...(category && { category }),
    ...(agent && { agent }),
    ...(search && { search }),
    ...(cycle !== undefined && { cycleNumber: cycle }),
    limit,
  });

  // Fallback to Supabase if in-memory buffer is empty (e.g., after a restart)
  if (logs.length === 0 && isSupabaseEnabled()) {
    const historical = await fetchHistoricalLogs({
      level: level || undefined,
      category: category || undefined,
      agent, search, cycleNumber: cycle, limit
    });
    logs = historical.map((l: any) => ({
      id: l.id,
      timestamp: l.timestamp,
      level: l.level,
      category: l.category,
      agent: l.agent,
      action: l.action,
      message: l.message,
      details: l.details,
      durationMs: l.duration_ms,
      success: l.success,
      errorMessage: l.error_message,
      requestPayload: l.request_payload,
      responsePayload: l.response_payload,
      confidence: l.confidence,
      cycleNumber: l.cycle_number,
    }));
  }

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

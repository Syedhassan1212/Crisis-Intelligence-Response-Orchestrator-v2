import { NextResponse } from 'next/server';
import { fetchHistoricalCrises, fetchCycleHistory } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const type = url.searchParams.get('type') || 'cycles';
  const limit = parseInt(url.searchParams.get('limit') || '50');

  if (type === 'crises') {
    const data = await fetchHistoricalCrises(limit);
    return NextResponse.json({ success: true, count: data.length, data });
  }

  const data = await fetchCycleHistory(limit);
  return NextResponse.json({ success: true, count: data.length, data });
}

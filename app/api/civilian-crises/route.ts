import { NextResponse } from 'next/server';
import { fetchHistoricalCrises, isSupabaseEnabled } from '@/lib/supabase';
import { isCivilianEvidence, rowToCrisisEvent } from '@/lib/civilianCrises';

export const runtime = 'nodejs';

/** Returns recent citizen SOS / mobile reports for the dashboard to merge. */
export async function GET() {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ success: true, data: [] });
  }

  try {
    const rows = await fetchHistoricalCrises(40);
    const civilian = rows
      .filter((r) => isCivilianEvidence(r.evidence))
      .map((r) => rowToCrisisEvent(r as Record<string, unknown>));

    return NextResponse.json({ success: true, data: civilian });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

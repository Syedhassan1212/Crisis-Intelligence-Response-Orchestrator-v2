import { NextResponse } from 'next/server';
import { fetchHistoricalCrises, isSupabaseEnabled } from '@/lib/supabase';
import { isCivilianEvidence, rowToCrisisEvent } from '@/lib/civilianCrises';

export const runtime = 'nodejs';

type CrisisRow = Record<string, unknown>;

/** Returns recent citizen SOS / mobile reports for the dashboard to merge. */
export async function GET() {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ success: true, data: [] });
  }

  try {
    const rows = (await fetchHistoricalCrises(40)) as CrisisRow[];
    const civilian = rows
      .filter((r: CrisisRow) => isCivilianEvidence(r.evidence))
      .map((r: CrisisRow) => rowToCrisisEvent(r));

    return NextResponse.json({ success: true, data: civilian });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

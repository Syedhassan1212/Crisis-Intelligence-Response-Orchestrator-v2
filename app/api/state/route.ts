import { NextResponse } from 'next/server';
import { getState } from '@/lib/orchestrator';

export const runtime = 'nodejs';

// GET: Return current state without running a new cycle
export async function GET() {
  try {
    const state = getState();
    return NextResponse.json({ success: true, data: state });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

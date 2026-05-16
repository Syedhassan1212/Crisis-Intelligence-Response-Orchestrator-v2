import { NextResponse } from 'next/server';
import { runCycle, getState } from '@/lib/orchestrator';

export const runtime = 'nodejs';
export const maxDuration = 60;

// GET: Run a new orchestration cycle
export async function GET() {
  try {
    const state = await runCycle();
    return NextResponse.json({ success: true, data: state });
  } catch (err: unknown) {
    console.error('[API/Orchestrate] Error:', err);
    return NextResponse.json(
      { success: false, error: 'Orchestration cycle failed', details: String(err) },
      { status: 500 }
    );
  }
}

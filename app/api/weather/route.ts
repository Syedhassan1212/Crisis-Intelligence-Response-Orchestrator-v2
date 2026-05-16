import { NextResponse } from 'next/server';
import { fetchWeatherData } from '@/lib/ingestion';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const weather = await fetchWeatherData();
    return NextResponse.json({ success: true, data: weather });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { fetchSocialPosts } from '@/lib/ingestion';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const count = parseInt(url.searchParams.get('count') || '10');
  try {
    const posts = await fetchSocialPosts(Math.min(count, 30));
    return NextResponse.json({ success: true, count: posts.length, data: posts });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

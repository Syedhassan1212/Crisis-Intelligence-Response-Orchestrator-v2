import { NextResponse } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';

export const runtime = 'nodejs';

function generateToken(room: string, identity: string) {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error('LiveKit credentials (LIVEKIT_API_KEY and LIVEKIT_API_SECRET) are not set in the server environment variables.');
  }

  // Create an AccessToken with participant identity
  const at = new AccessToken(apiKey, apiSecret, {
    identity: identity,
    ttl: '2h', // token expires in 2 hours
  });

  // Assign voice call permissions for the specific room
  at.addGrant({
    roomJoin: true,
    room: room,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  return at.toJwt();
}

// GET handler (convenient for browsers or query strings)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const room = searchParams.get('room');
    const identity = searchParams.get('identity') || searchParams.get('username');

    if (!room || !identity) {
      return NextResponse.json(
        { success: false, error: 'Query parameters "room" and "identity" (or "username") are required.' },
        { status: 400 }
      );
    }

    const token = await generateToken(room, identity);
    const serverUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || 'ws://localhost:7880';
    return NextResponse.json({ success: true, token, serverUrl });
  } catch (err: any) {
    console.error('[LiveKit Token API] Error:', err.message);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// POST handler (often used by mobile or JSON clients)
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const room = body.room || body.incidentId;
    const identity = body.identity || body.username || body.responderId;

    if (!room || !identity) {
      return NextResponse.json(
        { success: false, error: 'JSON fields "room" and "identity" (or "username") are required.' },
        { status: 400 }
      );
    }

    const token = await generateToken(room, identity);
    const serverUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || 'ws://localhost:7880';
    return NextResponse.json({ success: true, token, serverUrl });
  } catch (err: any) {
    console.error('[LiveKit Token API] Error:', err.message);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

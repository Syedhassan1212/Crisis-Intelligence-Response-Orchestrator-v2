'use client';

import { useEffect, useRef } from 'react';
import { Room, RoomEvent, Track } from 'livekit-client';

interface UseVoiceChannelOptions {
  ws: WebSocket | null; // Kept in signature for backwards compatibility with page.tsx
  incidentId: string | null; // Room ID; null = not in a call
  isMuted: boolean;
}

export function useVoiceChannel({ incidentId, isMuted }: UseVoiceChannelOptions) {
  const roomRef = useRef<Room | null>(null);
  const activeIncidentIdRef = useRef<string | null>(null);
  activeIncidentIdRef.current = incidentId;

  // Track subscription cleanup helper
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  // ── Start / Stop LiveKit Room connection based on incidentId ──────────────────
  useEffect(() => {
    if (!incidentId) {
      // Disconnect and clean up
      if (roomRef.current) {
        console.log('[LiveKit] Disconnecting from room...');
        roomRef.current.disconnect();
        roomRef.current = null;
      }
      // Remove any attached audio elements
      audioElementsRef.current.forEach((el) => el.remove());
      audioElementsRef.current.clear();
      return;
    }

    let isStopped = false;
    const roomName = incidentId;
    const participantName = `hq_commander_${Math.floor(Math.random() * 1000)}`;

    const startLiveKit = async () => {
      try {
        console.log(`[LiveKit] Fetching token for room "${roomName}" as "${participantName}"...`);
        const tokenRes = await fetch(`/api/livekit/token?room=${encodeURIComponent(roomName)}&identity=${encodeURIComponent(participantName)}`);
        const tokenData = await tokenRes.json();

        if (!tokenData.success || !tokenData.token) {
          throw new Error(tokenData.error || 'Failed to fetch LiveKit token.');
        }

        if (isStopped) return;

        // Initialize a new LiveKit Room
        const room = new Room();
        roomRef.current = room;

        // ── Handle incoming participant streams ─────────────────────────────
        room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
          if (track.kind === Track.Kind.Audio) {
            console.log(`[LiveKit] Subscribed to audio track from participant: ${participant.identity}`);
            if (!track.sid) return;
            const el = track.attach();
            audioElementsRef.current.set(track.sid, el);
            document.body.appendChild(el);
          }
        });

        room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
          console.log(`[LiveKit] Unsubscribed from track: ${track.sid}`);
          if (!track.sid) return;
          const el = audioElementsRef.current.get(track.sid);
          if (el) {
            el.remove();
            audioElementsRef.current.delete(track.sid);
          }
        });

        // Handle disconnect events
        room.on(RoomEvent.Disconnected, () => {
          console.log('[LiveKit] Room disconnected.');
          audioElementsRef.current.forEach((el) => el.remove());
          audioElementsRef.current.clear();
        });

        // ── Connect to the LiveKit Server ───────────────────────────────────
        const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || 'ws://localhost:7880';
        console.log(`[LiveKit] Connecting to: ${livekitUrl}`);
        
        await room.connect(livekitUrl, tokenData.token);
        
        if (isStopped) {
          room.disconnect();
          return;
        }

        console.log(`[LiveKit] Connected to room "${roomName}". Publishing microphone...`);

        // Enable microphone and auto-publish it (LiveKit Web handles getUserMedia)
        await room.localParticipant.setMicrophoneEnabled(!isMuted);

      } catch (err: any) {
        console.error('[LiveKit Hook] Connection failed:', err.message || err);
      }
    };

    startLiveKit();

    return () => {
      isStopped = true;
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
      audioElementsRef.current.forEach((el) => el.remove());
      audioElementsRef.current.clear();
    };
  }, [incidentId]);

  // ── Sync Mute State with LiveKit ───────────────────────────────────────────
  useEffect(() => {
    const room = roomRef.current;
    if (room && room.state === 'connected') {
      console.log(`[LiveKit] Syncing mute state: isMuted=${isMuted}`);
      room.localParticipant.setMicrophoneEnabled(!isMuted).catch((err) => {
        console.warn('[LiveKit Mute Sync] Failed to update microphone state:', err);
      });
    }
  }, [isMuted]);
}

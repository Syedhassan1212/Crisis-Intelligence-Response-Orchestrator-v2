'use client';

import { useEffect, useRef, useCallback } from 'react';

// ── WAV audio chunk format ──────────────────────────────────────────────────
// Convert raw Float32 samples to standard 16-bit PCM WAV format in memory

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function encodeWAV(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  /* RIFF identifier */
  writeString(view, 0, 'RIFF');
  /* file length */
  view.setUint32(4, 36 + samples.length * 2, true);
  /* RIFF type */
  writeString(view, 8, 'WAVE');
  /* format chunk identifier */
  writeString(view, 12, 'fmt ');
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw) */
  view.setUint16(20, 1, true);
  /* channel count */
  view.setUint16(22, 1, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * 2, true);
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, 2, true);
  /* bits per sample */
  view.setUint16(34, 16, true);
  /* data chunk identifier */
  writeString(view, 36, 'data');
  /* data chunk length */
  view.setUint32(40, samples.length * 2, true);

  // Write PCM audio samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}


interface UseVoiceChannelOptions {
  ws: WebSocket | null;
  incidentId: string | null; // active incident room; null = not in a call
  isMuted: boolean;
}

export function useVoiceChannel({ ws, incidentId, isMuted }: UseVoiceChannelOptions) {
  const audioCtxRef      = useRef<AudioContext | null>(null);
  const sourceNodeRef    = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef     = useRef<ScriptProcessorNode | null>(null);
  const streamRef        = useRef<MediaStream | null>(null);
  // Queue of audio frames to play: Map<incidentId, AudioBuffer[]>
  const playbackQueueRef = useRef<AudioBuffer[]>([]);
  const isPlayingRef     = useRef(false);

  // ── Playback scheduler ─────────────────────────────────────────────────────
  const schedulePlayback = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx || isPlayingRef.current) return;
    const buf = playbackQueueRef.current.shift();
    if (!buf) return;
    isPlayingRef.current = true;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.onended = () => {
      isPlayingRef.current = false;
      schedulePlayback(); // drain queue
    };
    src.start();
  }, []);

  // Binary frames not used in current JSON-based audio protocol — ignore
  const handleBinaryMessage = useCallback((_event: MessageEvent) => {
    // no-op: all audio is sent as JSON audio_chunk
  }, []);

  // ── Handle JSON audio_chunk from mobile (M4A base64) ──────────────────────
  const handleJsonMessage = useCallback((event: MessageEvent) => {
    if (typeof event.data !== 'string') return;
    try {
      const payload = JSON.parse(event.data);
      if (payload.type !== 'audio_chunk') return;
      if (payload.incidentId !== incidentId) return;
      if (!payload.data) return;

      const ctx = audioCtxRef.current;
      if (!ctx) return;

      // Convert base64 to ArrayBuffer and decode as audio
      const binary = atob(payload.data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

      ctx.decodeAudioData(bytes.buffer.slice(0)).then(audioBuf => {
        playbackQueueRef.current.push(audioBuf);
        schedulePlayback();
      }).catch(() => {}); // ignore decode errors (e.g., partial/corrupt frame)
    } catch {}
  }, [incidentId, schedulePlayback]);

  // ── Mute ref — updated each render so onaudioprocess always sees fresh value ─
  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;

  // ── Start / stop mic capture based on incidentId ──────────────────────────
  useEffect(() => {
    if (!incidentId) {
      // Stop everything
      processorRef.current?.disconnect();
      sourceNodeRef.current?.disconnect();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      audioCtxRef.current?.close().catch(() => {});
      audioCtxRef.current = null;
      playbackQueueRef.current = [];
      isPlayingRef.current = false;
      return;
    }

    let stopped = false;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        if (stopped) { stream.getTracks().forEach(t => t.stop()); return; }

        streamRef.current = stream;
        const ctx = new AudioContext({ sampleRate: 16000 });
        audioCtxRef.current = ctx;

        const source = ctx.createMediaStreamSource(stream);
        sourceNodeRef.current = source;

        // ScriptProcessor: 512 samples @ 16kHz ≈ 32ms per chunk — low latency
        const processor = ctx.createScriptProcessor(512, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (e) => {
          if (isMutedRef.current) return;
          if (!ws || ws.readyState !== WebSocket.OPEN) return;
          const samples = e.inputBuffer.getChannelData(0);
          const wav = encodeWAV(samples, ctx.sampleRate);
          const b64 = arrayBufferToBase64(wav);
          ws.send(JSON.stringify({ type: 'audio_chunk', incidentId, format: 'wav', data: b64 }));
        };

        source.connect(processor);
        processor.connect(ctx.destination); // required or Chrome mutes it

        console.log('[VoiceChannel] Mic capture started for room:', incidentId);
      } catch (err) {
        console.warn('[VoiceChannel] Mic access denied or error:', err);
      }
    })();

    return () => {
      stopped = true;
      processorRef.current?.disconnect();
      sourceNodeRef.current?.disconnect();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      audioCtxRef.current?.close().catch(() => {});
      audioCtxRef.current = null;
      playbackQueueRef.current = [];
      isPlayingRef.current = false;
    };
  }, [incidentId]); // re-run only when room changes

  // ── Attach WS binary + JSON listeners ────────────────────────────────────
  useEffect(() => {
    if (!ws) return;
    ws.binaryType = 'arraybuffer';
    ws.addEventListener('message', handleBinaryMessage);
    ws.addEventListener('message', handleJsonMessage);
    return () => {
      ws.removeEventListener('message', handleBinaryMessage);
      ws.removeEventListener('message', handleJsonMessage);
    };
  }, [ws, handleBinaryMessage, handleJsonMessage]);
}

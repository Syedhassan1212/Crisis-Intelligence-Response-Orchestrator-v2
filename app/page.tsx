'use client';

import { useState, useEffect, useRef } from 'react';
import { Map as MapIcon, Clock, Cpu, Radio, Package, LogOut, ChevronLeft, ChevronRight, X, Mic, MicOff } from 'lucide-react';
import Header from './components/Header';
import CrisisPanel from './components/CrisisPanel';
import CrisisMap from './components/CrisisMap';
import ResourcePanel from './components/ResourcePanel';
import SimulationPanel from './components/SimulationPanel';
import NotificationCenter from './components/NotificationCenter';
import AIDecisionTrace from './components/AIDecisionTrace';
import TimelineFeed from './components/TimelineFeed';
import WeatherWidget from './components/WeatherWidget';
import type { OrchestratorState } from '@/lib/types';
import { useVoiceChannel } from './hooks/useVoiceChannel';

// ── Sidebar items: each has a DISTINCT purpose ──────────────────────────────
// Map     → switch center to Map View
// Timeline → switch center to Decision Logs
// AI Trace → switch center to AI Cognitive Traces
// Signals  → toggle left panel (Interception Cards)
// Assets   → toggle right panel (Operations Control)

export default function Home() {
  const [state, setState] = useState<OrchestratorState | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRun, setAutoRun] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [centerTab, setCenterTab] = useState<'map' | 'timeline' | 'trace'>('map');
  const [rightTab, setRightTab] = useState<'resources' | 'simulations' | 'warnings'>('resources');
  const timerRef = useRef<any>(null);
  const [dashboardWs, setDashboardWs] = useState<WebSocket | null>(null);
  // Tracks which incident IDs have an active server-confirmed voice call
  const [voiceRoomIds, setVoiceRoomIds] = useState<Set<string>>(new Set());

  // Multi-incident room state: Map<incidentId, RoomState>
  type RoomState = {
    incidentId: string;
    location: string;
    sector: string;
    severity: string;
    startedAt: string;
    messages: Array<{ id: string; sender: string; text: string; timestamp: string; incidentId: string }>;
    input: string;
    minimized: boolean;
  };
  const [rooms, setRooms] = useState<Map<string, RoomState>>(new Map());
  // Keep a stable ref for use inside WebSocket callbacks
  const roomsRef = useRef<Map<string, RoomState>>(new Map());
  roomsRef.current = rooms;

  // activeCallStatus kept for compatibility with the audio hook (single context)
  const [activeCallStatus, setActiveCallStatus] = useState<{ location: string; sector: string; startedAt: string } | null>(null);
  // Voice: which room is the dashboard mic currently focused on + mute state
  const [focusedIncidentId, setFocusedIncidentId] = useState<string | null>(null);
  const [dashboardMuted, setDashboardMuted] = useState(false);

  // Real mic ↔ audio playback over WebSocket
  useVoiceChannel({
    ws: dashboardWs,
    incidentId: focusedIncidentId,
    isMuted: dashboardMuted,
  });

  // Audio state for walkie-talkie chirp (kept for SFX only — static removed)
  const audioContextRef = useRef<AudioContext | null>(null);
  const staticNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const staticGainRef = useRef<GainNode | null>(null);

  useEffect(() => {
    if (activeCallStatus) {
      // Start radio static
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioContextClass();
        audioContextRef.current = ctx;

        // Play intro walkie-talkie chirp beep (standard Motorola mic click)
        const playBeep = () => {
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const beepGain = ctx.createGain();

          osc1.type = 'sine';
          osc1.frequency.setValueAtTime(1247, ctx.currentTime);
          osc1.frequency.setValueAtTime(880, ctx.currentTime + 0.08);

          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(1600, ctx.currentTime);
          osc2.frequency.setValueAtTime(1200, ctx.currentTime + 0.08);

          beepGain.gain.setValueAtTime(0.08, ctx.currentTime);
          beepGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

          osc1.connect(beepGain);
          osc2.connect(beepGain);
          beepGain.connect(ctx.destination);

          osc1.start();
          osc2.start();
          osc1.stop(ctx.currentTime + 0.25);
          osc2.stop(ctx.currentTime + 0.25);
        };
        playBeep();

        // Create white noise for radio static
        const bufferSize = 2 * ctx.sampleRate;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          output[i] = Math.random() * 2 - 1;
        }

        const whiteNoise = ctx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;
        whiteNoise.loop = true;

        // Bandpass filter to make it sound like walkie-talkie radio static
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 1000; // speech range frequencies
        filter.Q.value = 1.0;

        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(0.015, ctx.currentTime); // very low background hum

        whiteNoise.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(ctx.destination);

        whiteNoise.start();

        // Save refs to stop later
        staticNodeRef.current = whiteNoise;
        staticGainRef.current = gainNode;
      } catch (err) {
        console.warn('[Dashboard Audio] Failed to start radio static simulation:', err);
      }
    } else {
      // Play outro radio beep click and close context
      if (audioContextRef.current) {
        const ctx = audioContextRef.current;
        try {
          // Play mic release click beep
          const osc = ctx.createOscillator();
          const clickGain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(440, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.15);
          clickGain.gain.setValueAtTime(0.08, ctx.currentTime);
          clickGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);

          osc.connect(clickGain);
          clickGain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.16);

          // Stop static
          if (staticNodeRef.current) {
            try {
              staticNodeRef.current.stop();
            } catch (e) {}
          }
          
          setTimeout(() => {
            ctx.close();
          }, 200);
        } catch (err) {
          console.warn('[Dashboard Audio] Failed to stop radio static simulation:', err);
        }
        audioContextRef.current = null;
        staticNodeRef.current = null;
        staticGainRef.current = null;
      }
    }
  }, [activeCallStatus]);

  const fetchState = async () => {
    try {
      const res = await fetch('/api/state');
      const data = await res.json();
      if (data.success) setState(data.data);
    } catch (error) {
      console.error('Failed to fetch state:', error);
    } finally {
      setLoading(false);
    }
  };

  const runSweepCycle = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/orchestrate');
      const text = await res.text();
      if (!text) throw new Error(`Empty response. Status: ${res.status}`);
      const data = JSON.parse(text);
      if (data.success) { setState(data.data); setCountdown(30); }
    } catch (error) {
      console.error('Orchestration cycle failed:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchState();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // Real-time WebSocket Broker connection
  useEffect(() => {
    let socket: WebSocket;
    let reconnectTimeout: any;
    let isComponentMounted = true;

    const connectWebSocket = () => {
      // Connect to port 3002 or public deployment
      const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3002';
      socket = new WebSocket(wsUrl);
      setDashboardWs(socket);

      socket.onopen = () => {
        if (!isComponentMounted) return;
        console.log('[Dashboard WS] Connected to real-time broker');
        // Register client
        socket.send(JSON.stringify({ type: 'register', clientType: 'dashboard' }));
      };

      socket.onmessage = (event) => {
        if (!isComponentMounted) return;
        try {
          const payload = JSON.parse(event.data);
          console.log('[Dashboard WS] Message received:', payload);

          if (payload.type === 'sos_broadcast') {
            const newSos = payload.data;
            
            // Play a distress alert sound (using browser AudioContext)
            try {
              const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
              const osc = audioCtx.createOscillator();
              const gain = audioCtx.createGain();
              osc.connect(gain);
              gain.connect(audioCtx.destination);
              osc.type = 'sawtooth';
              osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
              osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.5); // A4
              gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);
              osc.start(audioCtx.currentTime);
              osc.stop(audioCtx.currentTime + 0.6);
            } catch (err) {
              console.warn('Audio play failed:', err);
            }

            // Add the SOS to the crises state
            setState(prev => {
              if (!prev) return prev;
              
              // Check if already exists
              if (prev.crises.some(c => c.id === newSos.id)) return prev;

              const formattedCrisis = {
                id: newSos.id,
                type: newSos.incidentType || 'unknown',
                severity: newSos.severity || 'CRITICAL',
                location: newSos.location || 'Emergency Beacon Lock',
                lat: newSos.lat || 24.8607,
                lng: newSos.lng || 67.0104,
                description: newSos.description || 'IMMEDIATE SOS DISTRESS CALL! Citizen triggered 1-Tap emergency beacon.',
                status: 'active' as const,
                confidence: 0.99,
                affected_radius_km: 1.5,
                expected_duration_hours: 3,
                evidence: ['civilian_sos_app'],
                timestamp: newSos.timestamp || new Date().toISOString()
              };

              const newNotification = {
                id: `notif_${Date.now()}`,
                crisis_id: formattedCrisis.id,
                channel: 'public' as const,
                severity: formattedCrisis.severity,
                title: `🚨 EMERGENCY SOS BEACON: ${formattedCrisis.location.toUpperCase()}`,
                message: formattedCrisis.description,
                location: formattedCrisis.location,
                timestamp: new Date().toISOString(),
                sent: true
              };

              return {
                ...prev,
                crises: [formattedCrisis, ...prev.crises].slice(0, 20),
                notifications: [newNotification, ...prev.notifications].slice(0, 50)
              };
            });
          } 
          
          else if (payload.type === 'responder_location_broadcast') {
            const telemetry = payload.data;
            setState(prev => {
              if (!prev) return prev;
              
              const updatedResources = prev.resources.map(r => {
                if (r.id === telemetry.responderId) {
                  return {
                    ...r,
                    lat: telemetry.lat,
                    lng: telemetry.lng,
                    status: telemetry.status || r.status
                  };
                }
                return r;
              });

              return {
                ...prev,
                resources: updatedResources
              };
            });
          }

          else if (payload.type === 'rooms_update') {
            // Server sends full room list whenever rooms change
            const serverRooms: Array<{incidentId:string; location:string; sector:string; severity:string; startedAt:string}> = payload.rooms || [];
            const serverRoomIds = new Set(serverRooms.map((r:any) => r.incidentId));
            setVoiceRoomIds(serverRoomIds);
            setRooms(prev => {
              const next = new Map(prev);
              // Add new server rooms
              for (const r of serverRooms) {
                if (!next.has(r.incidentId)) {
                  next.set(r.incidentId, {
                    incidentId: r.incidentId,
                    location:   r.location,
                    sector:     r.sector,
                    severity:   r.severity,
                    startedAt:  r.startedAt,
                    messages:   [],
                    input:      '',
                    minimized:  false
                  });
                  // Request chat history for this room
                  if (socket?.readyState === WebSocket.OPEN) {
                    socket.send(JSON.stringify({ type: 'get_chat_history', incidentId: r.incidentId }));
                  }
                }
              }
              return next;
            });
            // Auto-focus mic on first room if none focused yet
            setFocusedIncidentId(prev => {
              if (!prev && serverRooms.length > 0) return serverRooms[0].incidentId;
              if (prev && !serverRooms.find(r => r.incidentId === prev)) return serverRooms[0]?.incidentId || null;
              return prev;
            });
            // Update single activeCallStatus for audio compat
            if (serverRooms.length > 0) {
              const first = serverRooms[0];
              setActiveCallStatus({ location: first.location, sector: first.sector, startedAt: first.startedAt });
            } else {
              setActiveCallStatus(null);
            }
          }

          else if (payload.type === 'voice_call_broadcast') {
            // Individual room join/leave events — rooms_update handles state
            console.log('[Dashboard WS] voice_call_broadcast:', payload.status, payload.incidentId);
          }

          else if (payload.type === 'chat_history') {
            const incidentId = payload.incidentId;
            setRooms(prev => {
              const next = new Map(prev);
              const room = next.get(incidentId);
              if (room) {
                next.set(incidentId, { ...room, messages: payload.messages || [] });
              }
              return next;
            });
          }

          else if (payload.type === 'chat_message_broadcast') {
            const incidentId = payload.incidentId;
            setRooms(prev => {
              const next = new Map(prev);
              const room = next.get(incidentId);
              if (room) {
                const updatedMsgs = [...room.messages, payload.data].slice(-100);
                next.set(incidentId, { ...room, messages: updatedMsgs });
              }
              return next;
            });
          }

        } catch (e) {
          console.error('[Dashboard WS] Error parsing message:', e);
        }
      };

      socket.onclose = () => {
        if (!isComponentMounted) return;
        console.log('[Dashboard WS] Connection closed. Attempting reconnect in 3s...');
        setDashboardWs(null);
        reconnectTimeout = setTimeout(connectWebSocket, 3000);
      };

      socket.onerror = (err) => {
        if (!isComponentMounted) return;
        console.error('[Dashboard WS] Socket error:', err);
        socket.close();
      };
    };

    connectWebSocket();

    return () => {
      isComponentMounted = false;
      if (socket) {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onclose = null;
        socket.onerror = null;
        socket.close();
      }
      setDashboardWs(null);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  // ── Per-incident call handlers ─────────────────────────────
  const handleCallForIncident = (incidentId: string, location: string, sector: string, severity: string) => {
    const ws = dashboardWs;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      alert('Cannot initiate call: real-time broker is offline.');
      return;
    }
    ws.send(JSON.stringify({ type: 'voice_call', status: 'started', incidentId, location, sector, severity }));
  };

  const handleHangUpIncident = (incidentId: string) => {
    const ws = dashboardWs;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'voice_call', status: 'ended', incidentId }));
    }
    setRooms(prev => { const next = new Map(prev); next.delete(incidentId); return next; });
  };

  const handleSendChat = (incidentId: string) => {
    const room = roomsRef.current.get(incidentId);
    if (!room || !room.input.trim()) return;
    const ws = dashboardWs;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'chat_message', incidentId, sender: 'HQ Commander', text: room.input.trim() }));
    }
    setRooms(prev => {
      const next = new Map(prev);
      const r = next.get(incidentId);
      if (r) next.set(incidentId, { ...r, input: '' });
      return next;
    });
  };

  const setRoomInput = (incidentId: string, val: string) => {
    setRooms(prev => {
      const next = new Map(prev);
      const r = next.get(incidentId);
      if (r) next.set(incidentId, { ...r, input: val });
      return next;
    });
  };

  const toggleRoomMinimized = (incidentId: string) => {
    setRooms(prev => {
      const next = new Map(prev);
      const r = next.get(incidentId);
      if (r) next.set(incidentId, { ...r, minimized: !r.minimized });
      return next;
    });
  };

  // Legacy single-call compat (used by old banner)
  const handleHangUpFromWeb = () => {
    for (const id of roomsRef.current.keys()) handleHangUpIncident(id);
  };

  const handleCallFromWeb = () => {
    handleCallForIncident('hq_general', 'HQ Command Center', 'Central Dispatch', 'HIGH');
  };

  // Open a chat-only panel without starting a voice call
  const handleOpenChat = (incidentId: string, location: string, sector: string, severity: string) => {
    setRooms(prev => {
      if (prev.has(incidentId)) return prev; // already open
      const next = new Map(prev);
      next.set(incidentId, {
        incidentId,
        location,
        sector,
        severity,
        startedAt: new Date().toISOString(),
        messages: [],
        input: '',
        minimized: false,
      });
      // Try to load chat history if WS is connected
      if (dashboardWs?.readyState === WebSocket.OPEN) {
        dashboardWs.send(JSON.stringify({ type: 'get_chat_history', incidentId }));
      }
      return next;
    });
    setFocusedIncidentId(prev => prev ?? incidentId);
  };


  useEffect(() => {
    if (autoRun) {
      timerRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) { runSweepCycle(); return 30; }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [autoRun]);

  const handleManualDispatch = (updatedState: OrchestratorState) => setState(updatedState);

  if (!state) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#111113] text-zinc-100 font-sans">
        <div className="text-4xl mb-4 animate-pulse">🛰️</div>
        <div className="text-sm font-semibold tracking-wider uppercase">Connecting to CIRO Tactical Command Center...</div>
        <div className="text-[11px] text-zinc-500 mt-2">Synchronizing city dispatch nodes...</div>
      </div>
    );
  }

  const criticalCrises = state.crises.filter(c => c.status === 'active' && c.severity === 'CRITICAL');
  const highCrises = state.crises.filter(c => c.status === 'active' && c.severity === 'HIGH');

  // 5 sidebar items — all distinct, none repeated
  const NAV_ITEMS = [
    {
      id: 'map',
      Icon: MapIcon,
      label: 'Map',
      desc: 'Tactical Map View',
      active: () => centerTab === 'map',
      action: () => setCenterTab('map'),
    },
    {
      id: 'timeline',
      Icon: Clock,
      label: 'Logs',
      desc: 'Decision Timeline',
      active: () => centerTab === 'timeline',
      action: () => setCenterTab('timeline'),
    },
    {
      id: 'trace',
      Icon: Cpu,
      label: 'AI Trace',
      desc: 'Cognitive Traces',
      active: () => centerTab === 'trace',
      action: () => setCenterTab('trace'),
    },
    {
      id: 'signals',
      Icon: Radio,
      label: 'Signals',
      desc: 'Interception Cards',
      active: () => leftOpen,
      action: () => setLeftOpen(v => !v),
      badge: criticalCrises.length > 0 ? criticalCrises.length : null,
    },
    {
      id: 'assets',
      Icon: Package,
      label: 'Assets',
      desc: 'Operations Control',
      active: () => rightOpen,
      action: () => setRightOpen(v => !v),
    },
  ];

  const TAB_ITEMS = [
    { id: 'map',      label: 'Map View' },
    { id: 'timeline', label: 'Tactical Decision Logs' },
    { id: 'trace',    label: 'AI Cognitive Traces' },
  ];

  const RIGHT_TABS = [
    { id: 'resources',   label: 'Assets' },
    { id: 'simulations', label: 'Predictions' },
    { id: 'warnings',    label: 'Alerts' },
  ];

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#111113] text-zinc-100 font-sans">

      {/* ── TOP HEADER ── */}
      <Header
        systemStatus={state.systemStatus}
        cycle={state.cycle}
        lastUpdated={state.lastUpdated}
        loading={loading}
        autoRun={autoRun}
        countdown={countdown}
        onRunCycle={runSweepCycle}
        onToggleAuto={() => {
          setAutoRun(prev => {
            const next = !prev;
            if (next) {
              runSweepCycle();
            }
            return next;
          });
        }}
        criticalCount={criticalCrises.length}
        highCount={highCrises.length}
        activeTab={centerTab}
        onTabChange={setCenterTab}
        weather={state.weatherData}
      />

      {/* ── MULTI-INCIDENT COMMS STATUS BAR ── */}
      <div className="bg-[#0d0d12] border-b border-[#1e1e26] text-xs px-4 py-1.5 flex items-center gap-3 font-mono z-50 overflow-x-auto">
        <span className="text-zinc-500 whitespace-nowrap flex-shrink-0">📡 COMMS ROOMS:</span>
        {rooms.size === 0 ? (
          <span className="text-zinc-700 italic">No open channels — click Message or Call on any incident</span>
        ) : (
          Array.from(rooms.values()).map(room => (
            <div key={room.incidentId} className={`flex items-center gap-1.5 border rounded px-2 py-0.5 whitespace-nowrap ${voiceRoomIds.has(room.incidentId) ? 'bg-red-950/40 border-red-500/30' : 'bg-zinc-900/60 border-zinc-700/40'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${voiceRoomIds.has(room.incidentId) ? 'bg-red-500 animate-ping' : 'bg-emerald-500'}`} />
              <span className={`font-bold text-[10px] ${voiceRoomIds.has(room.incidentId) ? 'text-red-300' : 'text-zinc-300'}`}>{room.location}</span>
              <span className="text-zinc-500 text-[9px]">({room.sector})</span>
              {voiceRoomIds.has(room.incidentId) && <span className="text-red-500 text-[8px] font-bold uppercase tracking-wider">VOICE</span>}
              <button
                onClick={() => handleHangUpIncident(room.incidentId)}
                className={`ml-1 text-white text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${voiceRoomIds.has(room.incidentId) ? 'bg-red-800 hover:bg-red-600' : 'bg-zinc-700 hover:bg-zinc-600'}`}
              >{voiceRoomIds.has(room.incidentId) ? '✕ End' : '✕ Close'}</button>
            </div>
          ))
        )}
        <button
          onClick={handleCallFromWeb}
          className="ml-auto flex-shrink-0 bg-emerald-800 hover:bg-emerald-700 text-white font-bold px-3 py-0.5 rounded text-[9px] uppercase tracking-wider transition-all active:scale-95"
        >
          + New Channel
        </button>
      </div>

      {/* ── BELOW HEADER: SIDEBAR + WORKSPACE ── */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* ── SIDEBAR — 5 distinct nav items ── */}
        <aside className="w-[68px] flex-shrink-0 bg-[#0e0e10] border-r border-[#1e1e21] flex flex-col items-center py-3 gap-0.5 z-40">

          <nav className="flex flex-col items-center gap-0.5 w-full flex-1">
            {NAV_ITEMS.map(({ id, Icon, label, active, action, badge }) => {
              const isActive = active();
              return (
                <button
                  key={id}
                  onClick={action}
                  title={label}
                  className={`relative w-full flex flex-col items-center gap-1 py-3 px-1 transition-all cursor-pointer group ${
                    isActive
                      ? 'text-white bg-[#1e1e21]'
                      : 'text-zinc-600 hover:text-zinc-200 hover:bg-[#161618]'
                  }`}
                >
                  {/* Active indicator bar */}
                  {isActive && (
                    <span className="absolute left-0 top-2 bottom-2 w-0.5 bg-emerald-500 rounded-r" />
                  )}

                  {/* Icon + badge */}
                  <div className="relative">
                    <Icon className={`w-[17px] h-[17px] ${isActive ? 'text-emerald-400' : 'text-zinc-500 group-hover:text-zinc-300'}`} />
                    {badge && (
                      <span className="absolute -top-1 -right-1.5 w-3.5 h-3.5 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center leading-none">
                        {badge > 9 ? '9+' : badge}
                      </span>
                    )}
                  </div>

                  <span className={`text-[9px] font-semibold tracking-wide leading-none ${isActive ? 'text-zinc-200' : 'text-zinc-600 group-hover:text-zinc-400'}`}>
                    {label}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Divider */}
          <div className="w-8 h-px bg-[#27272a] my-1" />

          {/* Logout */}
          <button
            title="Exit Session"
            className="w-full flex flex-col items-center gap-1 py-3 px-1 text-zinc-600 hover:text-zinc-400 hover:bg-[#161618] transition-all cursor-pointer"
            onClick={() => alert('CIRO session management')}
          >
            <LogOut className="w-[17px] h-[17px]" />
            <span className="text-[9px] font-semibold tracking-wide leading-none">Exit</span>
          </button>
        </aside>

        {/* ── THREE-COLUMN WORKSPACE ── */}
        <div className="flex flex-1 overflow-hidden min-h-0">

          {/* LEFT COL — Interception Cards */}
          <section className={`h-full border-r border-[#1e1e21] bg-[#111113] flex-shrink-0 flex flex-col transition-all duration-300 ${
            leftOpen ? 'w-[300px]' : 'w-0 overflow-hidden border-r-0'
          }`}>
            {leftOpen && (
              <CrisisPanel
                crises={state.crises}
                signals={state.signals}
                trafficActions={state.trafficActions}
                onCollapse={() => setLeftOpen(false)}
                onCallIncident={handleCallForIncident}
                onOpenChat={handleOpenChat}
                activeRoomIds={voiceRoomIds}
                activeChatIds={new Set(Array.from(rooms.keys()))}
              />
            )}
          </section>

          {/* CENTER — Map / Timeline / AI Traces */}
          <section className="flex-1 h-full flex flex-col overflow-hidden bg-[#111113] relative">

            {/* Tab strip always visible on top */}
            <TabStrip activeTab={centerTab} onTabChange={setCenterTab} tabs={TAB_ITEMS} leftOpen={leftOpen} rightOpen={rightOpen} onToggleLeft={() => setLeftOpen(v => !v)} onToggleRight={() => setRightOpen(v => !v)} />

            {/* Map view */}
            <div className={`flex-1 overflow-hidden relative ${centerTab === 'map' ? 'flex' : 'hidden'}`}>
              <CrisisMap
                crises={state.crises}
                resources={state.resources}
                trafficActions={state.trafficActions}
                signals={state.signals}
                onManualDispatch={handleManualDispatch}
                activeTab={centerTab}
                onTabChange={setCenterTab}
                leftOpen={leftOpen}
                rightOpen={rightOpen}
                onToggleLeft={() => setLeftOpen(v => !v)}
                onToggleRight={() => setRightOpen(v => !v)}
              />
            </div>

            {/* Decision Logs */}
            {centerTab === 'timeline' && (
              <div className="flex-1 overflow-auto bg-[#111113] p-4">
                <TimelineFeed signals={state.signals} crises={state.crises} cycle={state.cycle} />
              </div>
            )}

            {/* AI Cognitive Traces — full-height, no outer padding */}
            {centerTab === 'trace' && (
              <div className="flex-1 overflow-hidden">
                <AIDecisionTrace logs={state.decisionLogs} crises={state.crises} signals={state.signals} />
              </div>
            )}
          </section>

          {/* RIGHT COL — Operations Control + Tabs */}
          <section className={`h-full border-l border-[#1e1e21] bg-[#111113] flex-shrink-0 flex flex-col transition-all duration-300 ${
            rightOpen ? 'w-[280px]' : 'w-0 overflow-hidden border-l-0'
          }`}>
            {rightOpen && (
              <div className="w-full h-full flex flex-col overflow-hidden">

                {/* Panel header with collapse button */}
                <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-[#27272a]">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono">Operations Control</span>
                  <button
                    onClick={() => setRightOpen(false)}
                    className="w-6 h-6 flex items-center justify-center rounded text-zinc-600 hover:text-zinc-200 hover:bg-[#27272a] transition-all cursor-pointer"
                    title="Hide Operations Control"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Stats */}
                <WeatherWidget resources={state.resources} allocations={state.allocations} />

                {/* Right Panel Tabs */}
                <TabStrip activeTab={rightTab} onTabChange={setRightTab} tabs={RIGHT_TABS} />

                {/* Tab Content */}
                <div className="flex-1 overflow-auto bg-[#111113]">
                  {rightTab === 'resources' && (
                    <ResourcePanel
                      resources={state.resources}
                      allocations={state.allocations}
                      crises={state.crises}
                    />
                  )}
                  {rightTab === 'simulations' && (
                    <SimulationPanel simulations={state.simulations} crises={state.crises} />
                  )}
                  {rightTab === 'warnings' && (
                    <NotificationCenter notifications={state.notifications} />
                  )}
                </div>
              </div>
            )}
          </section>

        </div>
      </div>

      {/* ── MULTI-INCIDENT FLOATING CHAT PANELS ── */}
      {Array.from(rooms.values()).map((room, idx) => (
        <div
          key={room.incidentId}
          style={{ right: `${24 + idx * 336}px`, bottom: '24px' }}
          className="fixed w-80 bg-[#121217] border border-zinc-800 rounded-lg shadow-2xl flex flex-col overflow-hidden z-40 transition-all duration-300"
        >
          {/* Header */}
          <div
            className="bg-[#1b1b24] px-3 py-2 border-b border-zinc-800 flex items-center justify-between cursor-pointer select-none"
            onClick={() => { toggleRoomMinimized(room.incidentId); setFocusedIncidentId(room.incidentId); }}
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              <div>
                <div className="text-[10px] font-mono font-bold text-zinc-100 truncate max-w-[160px]">{room.location}</div>
                <div className="text-[8px] font-mono text-zinc-500">{room.incidentId} · {room.sector}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Mic focused indicator */}
              {focusedIncidentId === room.incidentId ? (
                <button
                  onClick={(e) => { e.stopPropagation(); setDashboardMuted(m => !m); }}
                  title={dashboardMuted ? 'Unmute mic' : 'Mute mic'}
                  className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-bold font-mono transition-all ${
                    dashboardMuted
                      ? 'bg-zinc-800 text-zinc-500'
                      : 'bg-emerald-900/60 text-emerald-400 border border-emerald-700/50'
                  }`}
                >
                  {dashboardMuted ? <MicOff className="w-2.5 h-2.5" /> : <Mic className="w-2.5 h-2.5" />}
                  <span>{dashboardMuted ? 'MUTED' : 'LIVE'}</span>
                </button>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); setFocusedIncidentId(room.incidentId); }}
                  title="Focus mic on this channel"
                  className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-mono text-zinc-600 hover:text-zinc-300 bg-zinc-900 border border-zinc-800 transition-all"
                >
                  <Mic className="w-2.5 h-2.5" />
                  <span>SPEAK</span>
                </button>
              )}
              <span className="text-[9px] font-mono text-red-400 font-bold tracking-wider">LIVE</span>
              <button
                onClick={(e) => { e.stopPropagation(); handleHangUpIncident(room.incidentId); }}
                className="text-zinc-500 hover:text-red-400 text-[11px] font-bold"
                title="End channel"
              >✕</button>
            </div>
          </div>

          {/* Messages — collapsible */}
          {!room.minimized && (
            <div className="h-52 p-3 overflow-y-auto flex flex-col gap-1.5 bg-zinc-950/20">
              {room.messages.length === 0 ? (
                <div className="text-center text-[10px] font-mono text-zinc-600 my-auto">
                  NO TRANSMISSIONS<br/>AWAITING FIELD COMMS...
                </div>
              ) : (
                room.messages.map(msg => (
                  <div key={msg.id} className={`flex flex-col ${msg.sender === 'HQ Commander' ? 'items-end' : 'items-start'}`}>
                    <span className="text-[8px] font-mono text-zinc-500 mb-0.5">
                      {msg.sender} · {new Date(msg.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'})}
                    </span>
                    <div className={`px-2.5 py-1.5 rounded text-[11px] font-mono max-w-[85%] ${
                      msg.sender === 'HQ Commander'
                        ? 'bg-zinc-800 text-emerald-300 rounded-tr-none'
                        : 'bg-emerald-950/50 border border-emerald-800/30 text-emerald-100 rounded-tl-none'
                    }`}>{msg.text}</div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Message input — always visible outside minimized area */}
          <form
            onSubmit={(e) => { e.preventDefault(); handleSendChat(room.incidentId); }}
            className="p-2 border-t border-zinc-800 bg-[#16161c] flex gap-1.5 flex-shrink-0"
          >
            <input
              type="text"
              value={room.input}
              onChange={(e) => setRoomInput(room.incidentId, e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendChat(room.incidentId); } }}
              placeholder="Transmit directive..."
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-[11px] text-zinc-100 font-mono focus:outline-none focus:border-emerald-700/60 focus:ring-1 focus:ring-emerald-900/50 placeholder-zinc-600 transition-all"
            />
            <button
              type="submit"
              className="bg-emerald-700 hover:bg-emerald-600 active:scale-95 text-white font-bold px-3 py-1.5 rounded text-[10px] font-mono uppercase tracking-wider transition-all"
            >Send</button>
          </form>
        </div>
      ))}
    </div>
  );
}

// ── Tab Strip component ──────────────────────────────────────────────────────
function TabStrip({ activeTab, onTabChange, tabs, leftOpen, rightOpen, onToggleLeft, onToggleRight }: {
  activeTab: string;
  onTabChange: (t: any) => void;
  tabs: { id: string; label: string }[];
  leftOpen?: boolean;
  rightOpen?: boolean;
  onToggleLeft?: () => void;
  onToggleRight?: () => void;
}) {
  return (
    <div className="flex-shrink-0 flex items-center border-b border-[#1e1e21] bg-[#0e0e10]">

      {/* Left panel toggle pill (only for center tab strip) */}
      {onToggleLeft !== undefined && (
        <button
          onClick={onToggleLeft}
          title={leftOpen ? 'Hide Interception Cards' : 'Show Interception Cards'}
          className={`flex-shrink-0 flex items-center gap-1.5 px-3 h-full border-r border-[#1e1e21] text-[10px] font-bold font-mono transition-all cursor-pointer ${
            leftOpen ? 'text-emerald-400 bg-[#0e0e10]' : 'text-zinc-600 hover:text-zinc-300 bg-[#0e0e10]'
          }`}
        >
          <ChevronLeft className={`w-3.5 h-3.5 transition-transform ${leftOpen ? '' : 'rotate-180'}`} />
        </button>
      )}

      {/* Tabs */}
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex-1 py-3 text-[12px] font-medium tracking-wide transition-all cursor-pointer border-b-2 ${
            activeTab === tab.id
              ? 'border-emerald-500 text-white bg-[#111113]'
              : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-[#111113]/50'
          }`}
        >
          {tab.label}
        </button>
      ))}

      {/* Right panel toggle pill (only for center tab strip) */}
      {onToggleRight !== undefined && (
        <button
          onClick={onToggleRight}
          title={rightOpen ? 'Hide Operations Control' : 'Show Operations Control'}
          className={`flex-shrink-0 flex items-center gap-1.5 px-3 h-full border-l border-[#1e1e21] text-[10px] font-bold font-mono transition-all cursor-pointer ${
            rightOpen ? 'text-emerald-400 bg-[#0e0e10]' : 'text-zinc-600 hover:text-zinc-300 bg-[#0e0e10]'
          }`}
        >
          <ChevronRight className={`w-3.5 h-3.5 transition-transform ${rightOpen ? '' : 'rotate-180'}`} />
        </button>
      )}
    </div>
  );
}

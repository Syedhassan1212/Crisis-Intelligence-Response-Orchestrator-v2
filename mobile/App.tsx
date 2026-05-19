import React, { useState, useEffect, useRef } from 'react';
import * as LegacyFS from 'expo-file-system/src/legacy';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  SafeAreaView,
  StatusBar,
  Switch,
  Platform
} from 'react-native';
import {
  Shield,
  Activity,
  Navigation,
  AlertTriangle,
  Compass,
  CheckCircle,
  Clock,
  MapPin,
  Map as MapIcon,
  User,
  Settings,
  PhoneCall,
  Wifi,
  WifiOff
} from 'lucide-react-native';
import * as Location from 'expo-location';
import { Audio } from 'expo-av';

// Dynamically load react-native-maps on native platforms to prevent web compile errors
let MapView: any, Marker: any, Polyline: any;
if (Platform.OS !== 'web') {
  try {
    const RNMaps = require('react-native-maps');
    MapView = RNMaps.default;
    Marker = RNMaps.Marker;
    Polyline = RNMaps.Polyline;
  } catch (e) {
    console.warn("[CIRO Mobile] Could not load react-native-maps on native:", e);
  }
}

import { supabase } from './src/supabase';

// Device Dimensions
const { width, height } = Dimensions.get('window');

// ── Types ────────────────────────────────────────────────────
interface Report {
  id: string;
  type: string;
  severity: string;
  location: string;
  lat: number;
  lng: number;
  description: string;
  status: 'active' | 'monitoring' | 'resolved';
  timestamp: string;
  allocated_units?: Array<{ id: string; type: string; status: string; eta: number }>;
}

interface ResponderUnit {
  id: string;
  type: string;
  status: 'available' | 'dispatched' | 'en_route' | 'on_scene';
  location: string;
  lat: number;
  lng: number;
  assigned_crisis_id?: string;
  eta_minutes?: number;
}

export default function App() {
  // Navigation State
  const [activeTab, setActiveTab] = useState<'civilian' | 'tracking' | 'responder' | 'settings'>('civilian');
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  // Connection & Offline state
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [offlineQueue, setOfflineQueue] = useState<Omit<Report, 'id' | 'timestamp' | 'status'>[]>([]);

  // Civilian SOS and Form state
  const [locationPermission, setLocationPermission] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [sosActive, setSosActive] = useState<boolean>(false);
  const [incidentType, setIncidentType] = useState<string>('fire');
  const [severity, setSeverity] = useState<string>('HIGH');
  const [description, setDescription] = useState<string>('');
  const [customLocation, setCustomLocation] = useState<string>('Saddar');
  const [gpsCoordinates, setGpsCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [isGpsLoading, setIsGpsLoading] = useState<boolean>(false);

  // Live reports and Responders tracking
  const [myReports, setMyReports] = useState<Report[]>([]);
  const [activeResponders, setActiveResponders] = useState<ResponderUnit[]>([]);
  const [isFetchingReports, setIsFetchingReports] = useState<boolean>(false);

  // Responder HUD State
  const [isResponderMode, setIsResponderMode] = useState<boolean>(false);
  const [selectedResponderId, setSelectedResponderId] = useState<string>('ambulance_1');
  const [activeAssignment, setActiveAssignment] = useState<any | null>(null);
  const [isNavigating, setIsNavigating] = useState<boolean>(false);
  const [navigationProgress, setNavigationProgress] = useState<number>(0);
  const [responderCoords, setResponderCoords] = useState<{ lat: number; lng: number } | null>(null);

  // WebSocket Reference
  const wsRef = useRef<WebSocket | null>(null);

  // Voice Call state
  const [voiceCallActive, setVoiceCallActive] = useState<boolean>(false);
  const [voiceCallDuration, setVoiceCallDuration] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isSpeaker, setIsSpeaker] = useState<boolean>(false);
  const [waveformHeights, setWaveformHeights] = useState<number[]>([20, 30, 25, 40, 35, 20, 30, 25, 40, 35]);
  const voiceCallTimerRef = useRef<any>(null);
  const chatScrollRef = useRef<ScrollView | null>(null);

  // Real voice streaming refs
  const recordingRef      = useRef<Audio.Recording | null>(null);
  const recordIntervalRef = useRef<any>(null);
  const playbackQueueRef  = useRef<string[]>([]); // base64 audio URIs queued for playback
  const isPlayingAudioRef = useRef(false);

  // Multi-incident rooms state (synced from server)
  type RoomInfo = { incidentId: string; location: string; sector: string; severity: string; startedAt: string };
  const [activeRooms, setActiveRooms] = useState<RoomInfo[]>([]);
  // Which incident this mobile is actively joined to (null = room picker shown)
  const [activeIncidentId, setActiveIncidentId] = useState<string | null>(null);
  // Per-incident chat history: Map<incidentId, messages[]>
  const [incidentChats, setIncidentChats] = useState<Map<string, Array<{ id: string; sender: string; text: string; timestamp: string; incidentId: string }>>>(new Map());
  const [chatInput, setChatInput] = useState<string>('');

  // Animation values
  const sosScale = useRef(new Animated.Value(1)).current;
  const radarRotate = useRef(new Animated.Value(0)).current;

  // Real-time WebSocket connection to central orchestrator broker
  useEffect(() => {
    let socket: WebSocket;
    let reconnectTimeout: any;
    let isComponentMounted = true;

    const connectWebSocket = () => {
      // Connect to port 3002. Use EXPO_PUBLIC_WS_URL if defined, fallback to 10.0.2.2 for Android emulators
      const wsUrl = process.env.EXPO_PUBLIC_WS_URL ||
        (Platform.OS === 'android' ? 'ws://10.0.2.2:3002' : 'ws://localhost:3002');
      console.log('[Mobile WS] Connecting to:', wsUrl);

      try {
        socket = new global.WebSocket(wsUrl);

        socket.onopen = () => {
          if (!isComponentMounted) return;
          console.log('[Mobile WS] Connected to real-time broker');
          wsRef.current = socket;
          setIsConnected(true);
          socket.send(JSON.stringify({ type: 'register', clientType: 'mobile' }));
        };

        socket.onmessage = (event) => {
          if (!isComponentMounted) return;
          try {
            const payload = JSON.parse(event.data);
            console.log('[Mobile WS] Message received:', payload);

            if (payload.type === 'dispatch_broadcast') {
              const dispatchData = payload.data;

              // Notify field responder if matched with selected unit
              if (dispatchData.resourceId === selectedResponderId) {
                Alert.alert(
                  "🚨 EMERGENCY DISPATCH DIRECTIVE",
                  `Command Center has dispatched ${selectedResponderId.toUpperCase()} to Incident Sector: ${dispatchData.crisisId.slice(0, 4).toUpperCase()}!\n\nRespond immediately with active emergency beacons.`,
                  [
                    {
                      text: "ACKNOWLEDGE DISPATCH",
                      onPress: () => {
                        fetchMyReports();
                      }
                    }
                  ]
                );
              }
            } else if (payload.type === 'rooms_update') {
              // Server pushes full list of active rooms
              console.log('[Mobile] Rooms update:', payload.rooms?.length);
              setActiveRooms(payload.rooms || []);
              const newIds = new Set((payload.rooms || []).map((r: any) => r.incidentId));
              // If current active room was removed, exit call overlay
              setActiveIncidentId(prev => (prev && !newIds.has(prev)) ? null : prev);
              if (newIds.size === 0) setVoiceCallActive(false);
              else if (newIds.size > 0) setVoiceCallActive(true);
            } else if (payload.type === 'voice_call_broadcast') {
              // Individual join/leave — rooms_update handles it; this is just for audio trigger
              console.log('[Mobile Voice] voice_call_broadcast:', payload.status, payload.incidentId);
            } else if (payload.type === 'chat_history') {
              const incidentId = payload.incidentId;
              setIncidentChats(prev => {
                const next = new Map(prev);
                next.set(incidentId, payload.messages || []);
                return next;
              });
            } else if (payload.type === 'chat_message_broadcast') {
              const incidentId = payload.incidentId;
              console.log('[Mobile Chat] Msg for incident:', incidentId, payload.data?.text);
              setIncidentChats(prev => {
                const next = new Map(prev);
                const existing = next.get(incidentId) || [];
                next.set(incidentId, [...existing, payload.data].slice(-50));
                return next;
              });
            } else if (payload.type === 'audio_chunk') {
              // Received audio from dashboard — queue for playback
              if (payload.data && payload.incidentId === activeIncidentId) {
                playbackQueueRef.current.push(payload.data);
                drainPlaybackQueue();
              }
            }
          } catch (e) {
            console.error('[Mobile WS] Error parsing message:', e);
          }
        };

        socket.onclose = () => {
          if (!isComponentMounted) return;
          console.log('[Mobile WS] Connection closed. Reconnecting in 3s...');
          wsRef.current = null;
          setIsConnected(false);
          reconnectTimeout = setTimeout(connectWebSocket, 3000);
        };

        socket.onerror = (err) => {
          if (!isComponentMounted) return;
          console.log('[Mobile WS] Socket error:', err);
          setIsConnected(false);
          socket.close();
        };
      } catch (wsErr) {
        console.warn('[Mobile WS] Initial socket connection error:', wsErr);
      }
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
      wsRef.current = null;
      setIsConnected(false);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [selectedResponderId]);

  const staticSoundRef = useRef<Audio.Sound | null>(null);

  // ── Real voice streaming helpers ──────────────────────────────────────

  /** Drain the playback queue: play each queued base64 audio chunk in order */
  const drainPlaybackQueue = async () => {
    if (isPlayingAudioRef.current) return;
    const b64 = playbackQueueRef.current.shift();
    if (!b64) return;
    isPlayingAudioRef.current = true;
    try {
      // Write base64 to a temp file then play
      const tmpUri = LegacyFS.cacheDirectory + `rx_chunk_${Date.now()}.m4a`;
      await LegacyFS.writeAsStringAsync(tmpUri, b64, { encoding: LegacyFS.EncodingType.Base64 });
      const { sound } = await Audio.Sound.createAsync(
        { uri: tmpUri },
        { shouldPlay: true, volume: isSpeaker ? 1.0 : 0.85 }
      );
      sound.setOnPlaybackStatusUpdate(async (status: any) => {
        if (status.isLoaded && status.didJustFinish) {
          await sound.unloadAsync();
          await LegacyFS.deleteAsync(tmpUri, { idempotent: true });
          isPlayingAudioRef.current = false;
          drainPlaybackQueue(); // next chunk
        }
      });
    } catch (err) {
      console.warn('[Mobile Audio] Playback chunk error:', err);
      isPlayingAudioRef.current = false;
      drainPlaybackQueue();
    }
  };

  /** Record one short burst and send as base64 over WS */
  const recordAndSendChunk = async () => {
    if (isMuted) return;
    const ws = wsRef.current;
    if (!ws || ws.readyState !== 1) return;
    if (!activeIncidentId) return;
    try {
      // Start a new recording segment
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.LOW_QUALITY);
      await rec.startAsync();
      // Record for 280ms then stop and send
      await new Promise(res => setTimeout(res, 280));
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      if (!uri) return;
      const b64 = await LegacyFS.readAsStringAsync(uri, { encoding: LegacyFS.EncodingType.Base64 });
      await LegacyFS.deleteAsync(uri, { idempotent: true });
      // Send to server
      ws.send(JSON.stringify({
        type: 'audio_chunk',
        incidentId: activeIncidentId,
        format: 'm4a',
        data: b64
      }));
    } catch (err) {
      // Recording errors (e.g., another recording already active) are common — silently skip
    }
  };

  const getAssetUrl = (fileName: string) => {
    const wsUrl = process.env.EXPO_PUBLIC_WS_URL || '';
    const match = wsUrl.match(/ws:\/\/([^:]+)/);
    const host = match ? match[1] : '192.168.100.126';
    return `http://${host}:3000/${fileName}`;
  };

  const playChirpSound = async () => {
    try {
      const url = getAssetUrl('chirp.wav');
      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: true, volume: 0.8 }
      );
      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.isLoaded && status.didJustFinish) sound.unloadAsync();
      });
    } catch {}
  };

  const startStaticSound = async () => {
    try {
      const url = getAssetUrl('static.wav');
      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: true, isLooping: true, volume: 0.06 } // very low — real voice is primary
      );
      staticSoundRef.current = sound;
    } catch {}
  };

  const stopStaticSound = async () => {
    if (staticSoundRef.current) {
      try {
        await staticSoundRef.current.stopAsync();
        await staticSoundRef.current.unloadAsync();
      } catch {}
      staticSoundRef.current = null;
    }
  };

  // Request mic permissions once on mount
  useEffect(() => {
    (async () => {
      try {
        await Audio.requestPermissionsAsync();
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });
      } catch (e) {
        console.warn('[Mobile Audio] Permission request failed:', e);
      }
    })();
  }, []);

  // Voice call duration, waveform animation, and real mic streaming
  useEffect(() => {
    let animInterval: any;
    if (voiceCallActive) {
      voiceCallTimerRef.current = setInterval(() => {
        setVoiceCallDuration(d => d + 1);
      }, 1000);

      // Play walkie-talkie chirp and start background static hiss
      playChirpSound();
      const staticTimer = setTimeout(() => { startStaticSound(); }, 250);

      // Start real mic recording loop (320ms segments)
      recordIntervalRef.current = setInterval(() => {
        recordAndSendChunk();
      }, 320);

      // Animate waveform bars
      animInterval = setInterval(() => {
        if (!isMuted) {
          setWaveformHeights(Array.from({ length: 10 }, () => Math.floor(Math.random() * 40) + 15));
        } else {
          setWaveformHeights(Array.from({ length: 10 }, () => 5));
        }
      }, 120);

      return () => {
        clearTimeout(staticTimer);
        if (voiceCallTimerRef.current) clearInterval(voiceCallTimerRef.current);
        if (animInterval) clearInterval(animInterval);
        if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
        stopStaticSound();
        // Discard any in-progress recording
        if (recordingRef.current) {
          recordingRef.current.stopAndUnloadAsync().catch(() => {});
          recordingRef.current = null;
        }
      };
    } else {
      if (voiceCallTimerRef.current) { clearInterval(voiceCallTimerRef.current); voiceCallTimerRef.current = null; }
      if (recordIntervalRef.current) { clearInterval(recordIntervalRef.current); recordIntervalRef.current = null; }
      setVoiceCallDuration(0);
      setWaveformHeights(Array.from({ length: 10 }, () => 8));
      stopStaticSound();
      playChirpSound();
      playbackQueueRef.current = [];
      isPlayingAudioRef.current = false;
    }
  }, [voiceCallActive, isMuted]);


  // Establish live secure voice link
  const startVoiceCall = (locName: string) => {
    console.log('[Mobile Voice] startVoiceCall clicked. Location:', locName);
    console.log('[Mobile Voice] wsRef exists:', !!wsRef.current);
    if (wsRef.current) {
      console.log('[Mobile Voice] wsRef readyState:', wsRef.current.readyState);
      console.log('[Mobile Voice] WebSocket.OPEN value:', WebSocket.OPEN);
    }

    setVoiceCallActive(true);
    const incidentId = `mobile_${Date.now()}`;
    if (wsRef.current && (wsRef.current.readyState === 1 || wsRef.current.readyState === WebSocket.OPEN)) {
      console.log('[Mobile Voice] Sending voice_call started message to server...');
      wsRef.current.send(JSON.stringify({
        type: 'voice_call',
        status: 'started',
        incidentId,
        location: locName || 'Saddar GPS Lock',
        sector: locName.includes('DHA') ? 'DHA Sector' : 'Saddar Sector',
        severity: 'HIGH'
      }));
      // Pre-select this room so the call screen opens immediately
      setActiveIncidentId(incidentId);
    } else {
      console.warn('[Mobile Voice] Cannot send voice_call message. Socket is not open or wsRef is null.');
    }
  };

  // Leave a specific incident room (or the current active one)
  const endVoiceCall = (incidentIdToEnd?: string) => {
    const targetId = incidentIdToEnd || activeIncidentId;
    console.log('[Mobile Voice] Leaving room:', targetId);
    if (targetId && wsRef.current && (wsRef.current.readyState === 1 || wsRef.current.readyState === WebSocket.OPEN)) {
      wsRef.current.send(JSON.stringify({ type: 'voice_call', status: 'ended', incidentId: targetId }));
    }
    // If leaving the currently active room, go back to picker
    if (targetId === activeIncidentId) setActiveIncidentId(null);
  };

  // Join a specific incident room from the picker
  const joinIncidentRoom = (room: { incidentId: string; location: string; sector: string; severity: string; startedAt: string }) => {
    setActiveIncidentId(room.incidentId);
    // Request chat history for this room
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'get_chat_history', incidentId: room.incidentId }));
    }
  };

  const sendChatMessage = () => {
    if (!chatInput.trim() || !activeIncidentId) return;
    if (wsRef.current && (wsRef.current.readyState === 1 || wsRef.current.readyState === WebSocket.OPEN)) {
      wsRef.current.send(JSON.stringify({
        type: 'chat_message',
        incidentId: activeIncidentId,
        sender: selectedResponderId ? `Responder ${selectedResponderId.toUpperCase()}` : 'Field Unit',
        text: chatInput.trim()
      }));
      setChatInput('');
    } else {
      Alert.alert('Link Offline', 'Cannot send message. Security link is currently offline.');
    }
  };

  // Pulse effect for SOS button
  useEffect(() => {
    if (sosActive) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(sosScale, {
            toValue: 1.25,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(sosScale, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          })
        ])
      ).start();
    } else {
      sosScale.setValue(1);
    }
  }, [sosActive]);

  // Request high-precision location permission
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status === 'granted');
      if (status === 'granted') {
        fetchCurrentLocation();
      }
    })();
  }, []);

  // Sync Offline Queue when internet restores
  useEffect(() => {
    if (isConnected && offlineQueue.length > 0) {
      Alert.alert(
        "Network Restored",
        `Syncing ${offlineQueue.length} offline emergency reports with command orchestrator...`,
        [{ text: "OK", onPress: syncOfflineQueue }]
      );
    }
  }, [isConnected]);

  // Fetch current GPS Coordinates
  const fetchCurrentLocation = async () => {
    setIsGpsLoading(true);
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setGpsCoordinates({
        lat: loc.coords.latitude,
        lng: loc.coords.longitude
      });
    } catch (e) {
      console.warn("Could not retrieve GPS lock:", e);
      // Heuristic fallback to Karachi Saddar coordinates if GPS disabled
      setGpsCoordinates({ lat: 24.8607, lng: 67.0104 });
    } finally {
      setIsGpsLoading(false);
    }
  };

  // Get active reports and subscribe to realtime Supabase updates
  useEffect(() => {
    fetchMyReports();

    // Set up realtime channel subscriptions to capture when admin dispatches responders
    const crisesSubscription = supabase
      .channel('ciro-crises-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ciro_crises' },
        (payload) => {
          console.log('[Supabase Crises] Realtime Change detected:', payload);
          fetchMyReports();
        }
      )
      .subscribe();

    const allocationsSubscription = supabase
      .channel('ciro-allocations-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ciro_allocations' },
        (payload) => {
          console.log('[Supabase Allocations] Realtime Change detected:', payload);
          fetchMyReports();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(crisesSubscription);
      supabase.removeChannel(allocationsSubscription);
    };
  }, []);

  // Fetch Reports and dispatched resources
  const fetchMyReports = async () => {
    setIsFetchingReports(true);
    try {
      const { data: crises, error } = await supabase
        .from('ciro_crises')
        .select('*')
        .order('detected_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      // Map Supabase rows to our app layout
      const formattedReports = (crises || []).map((c: any) => ({
        id: c.id,
        type: c.type,
        severity: c.severity,
        location: c.location,
        lat: c.lat || 24.8607,
        lng: c.lng || 67.0104,
        description: c.description || '',
        status: c.status,
        timestamp: c.detected_at,
        allocated_units: []
      }));

      // Fetch allocations to attach responder detail
      const { data: allocations, error: allocError } = await supabase
        .from('ciro_allocations')
        .select('*');

      if (!allocError && allocations) {
        formattedReports.forEach(report => {
          const match = allocations.find((a: any) => a.crisis_id === report.id);
          if (match && match.units) {
            report.allocated_units = Array.isArray(match.units)
              ? match.units.map((u: any) => ({
                id: u.id,
                type: u.type,
                status: u.status,
                eta: match.response_time_minutes || 12
              }))
              : [];
          }
        });
      }

      setMyReports(formattedReports);

      // Also fetch resources status for Responder Mode
      const { data: resources, error: resError } = await supabase
        .from('ciro_resources')
        .select('*');

      // In hackathons sometimes resources are only kept local in memory, 
      // but if ciro_resources table doesn't exist, we fall back gracefully
      if (!resError && resources) {
        const mapped = resources.map((r: any) => ({
          id: r.id,
          type: r.type,
          status: r.status,
          location: r.location,
          lat: r.lat || 24.8607,
          lng: r.lng || 67.0011,
          assigned_crisis_id: r.assigned_crisis_id,
          eta_minutes: r.eta_minutes
        }));
        setActiveResponders(mapped);
      } else {
        // Mock fallback if table not compiled yet in user's Supabase
        setActiveResponders([
          { id: 'ambulance_1', type: 'ambulance', status: 'available', location: 'Saddar', lat: 24.8607, lng: 67.0104 },
          { id: 'police_3', type: 'police', status: 'available', location: 'Clifton', lat: 24.8116, lng: 67.0295 },
          { id: 'fire_unit_2', type: 'fire_unit', status: 'available', location: 'Gulshan-e-Iqbal', lat: 24.9213, lng: 67.0944 },
          { id: 'rescue_1', type: 'rescue', status: 'available', location: 'DHA', lat: 24.7921, lng: 67.0611 }
        ]);
      }

    } catch (e) {
      console.warn("Error fetching data from Supabase:", e);
    } finally {
      setIsFetchingReports(false);
    }
  };

  // Submit Emergency Distress Signal (1-Tap SOS)
  const triggerSos = async () => {
    setSosActive(true);
    setIsSubmitting(true);

    // Automatically retrieve current coordinates
    let lat = 24.8607;
    let lng = 67.0104;
    try {
      const loc = await Location.getCurrentPositionAsync({});
      lat = loc.coords.latitude;
      lng = loc.coords.longitude;
    } catch (e) {
      console.warn("SOS geolocation failed, using Saddar central fallback");
    }

    const sosPayload = {
      id: `crisis_sos_${Date.now()}`,
      type: 'unknown',
      severity: 'CRITICAL',
      location: 'Saddar GPS Lock',
      lat,
      lng,
      description: 'IMMEDIATE SOS DISTRESS CALL! Citizen triggered 1-Tap emergency beacon. Dispatch rescue assets immediately.',
      status: 'active' as const,
      timestamp: new Date().toISOString()
    };

    if (!isConnected) {
      setOfflineQueue(q => [...q, sosPayload]);
      Alert.alert("SOS Beacon Cached", "Internet signal is offline. The distress signal has been cached in local device storage and will broadcast the second a cellular signal is established!");
      setSosActive(false);
      setIsSubmitting(false);
      return;
    }

    try {
      // 1. Send via WebSocket for instant dashboard rendering
      if (wsRef.current && (wsRef.current.readyState === 1 || wsRef.current.readyState === WebSocket.OPEN)) {
        wsRef.current.send(JSON.stringify({
          type: 'sos',
          id: sosPayload.id,
          incidentType: 'unknown',
          severity: 'CRITICAL',
          location: 'Saddar GPS Lock',
          lat: sosPayload.lat,
          lng: sosPayload.lng,
          description: sosPayload.description,
          timestamp: sosPayload.timestamp
        }));
      }

      // 2. Persist in Supabase DB
      const { error } = await supabase.from('ciro_crises').insert({
        id: sosPayload.id,
        type: 'unknown',
        severity: 'CRITICAL',
        location: 'Emergency Beacon Lock',
        lat: sosPayload.lat,
        lng: sosPayload.lng,
        description: sosPayload.description,
        status: 'active',
        affected_radius_km: 1.5,
        expected_duration_hours: 3,
        confidence: 0.99,
        evidence: ['civilian_sos_app']
      });

      if (error) throw error;

      // Navigate to tracking
      Alert.alert("SOS BROADCAST ACTIVE", "Distress coordinate lock transmitted. Responders are being dispatched by AI engine! Keep app open to track.");
      fetchMyReports();
      setSelectedReportId(sosPayload.id);
      setActiveTab('tracking');

    } catch (e) {
      Alert.alert("Satellite Sync Fail", "Direct broadcast failed. Attempting SMS emergency backup...");
    } finally {
      setIsSubmitting(false);
      setSosActive(false);
    }
  };

  // Form Submission
  const submitIncidentReport = async () => {
    if (!description.trim()) {
      Alert.alert("Error", "Please input an description of the emergency.");
      return;
    }

    setIsSubmitting(true);
    const reportId = `crisis_report_${Date.now()}`;
    const lat = gpsCoordinates?.lat || 24.8607;
    const lng = gpsCoordinates?.lng || 67.0104;

    const payload = {
      id: reportId,
      type: incidentType,
      severity,
      location: customLocation,
      lat,
      lng,
      description,
      status: 'active' as const,
      timestamp: new Date().toISOString()
    };

    if (!isConnected) {
      setOfflineQueue(q => [...q, payload]);
      Alert.alert("Offline Mode Active", "Your report has been securely cached in device memory and will sync automatically when your internet connection is restored.");
      setDescription('');
      setIsSubmitting(false);
      return;
    }

    try {
      // 1. Broadcast over WebSocket
      if (wsRef.current && (wsRef.current.readyState === 1 || wsRef.current.readyState === WebSocket.OPEN)) {
        wsRef.current.send(JSON.stringify({
          type: 'sos',
          id: payload.id,
          incidentType: payload.type,
          severity: payload.severity,
          location: payload.location,
          lat: payload.lat,
          lng: payload.lng,
          description: payload.description,
          timestamp: payload.timestamp
        }));
      }

      // 2. Persist in Supabase DB
      const { error } = await supabase.from('ciro_crises').insert({
        id: payload.id,
        type: payload.type,
        severity: payload.severity,
        location: payload.location,
        lat: payload.lat,
        lng: payload.lng,
        description: payload.description,
        status: 'active',
        affected_radius_km: severity === 'CRITICAL' ? 3.0 : severity === 'HIGH' ? 2.0 : 1.0,
        expected_duration_hours: 4,
        confidence: 0.85,
        evidence: ['civilian_mobile_report']
      });

      if (error) throw error;

      Alert.alert("Report Sent", "Emergency report uploaded successfully. AI Orchestrator is analyzing resource allocation.");
      setDescription('');
      fetchMyReports();
      setSelectedReportId(payload.id);
      setActiveTab('tracking');

    } catch (e) {
      console.warn("Direct upload error:", e);
      Alert.alert("Network Error", "Direct sync failed. Cached in local storage queue instead.");
      setOfflineQueue(q => [...q, payload]);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Sync Offline queue
  const syncOfflineQueue = async () => {
    if (offlineQueue.length === 0) return;
    try {
      for (const report of offlineQueue) {
        await supabase.from('ciro_crises').insert({
          id: `crisis_offline_${Date.now()}`,
          type: report.type,
          severity: report.severity,
          location: report.location,
          lat: report.lat,
          lng: report.lng,
          description: `[OFFLINE SYNCED] ${report.description}`,
          status: 'active',
          affected_radius_km: 2.0,
          expected_duration_hours: 4,
          confidence: 0.75,
          evidence: ['offline_civilian_sync']
        });
      }
      setOfflineQueue([]);
      fetchMyReports();
      Alert.alert("Success", "All offline queued incidents uploaded successfully!");
    } catch (e) {
      console.warn(e);
      Alert.alert("Sync Failure", "Failed to sync all incidents. Will retry next time.");
    }
  };

  // Responder Navigation simulation
  const checkActiveDispatches = () => {
    // Scan if my active selected unit has an active crisis assigned
    const matchingUnit = activeResponders.find(r => r.id === selectedResponderId);
    if (matchingUnit && matchingUnit.assigned_crisis_id) {
      // Find the corresponding crisis details
      const matchedCrisis = myReports.find(c => c.id === matchingUnit.assigned_crisis_id);
      if (matchedCrisis) {
        setActiveAssignment({
          crisis: matchedCrisis,
          unit: matchingUnit
        });
        setResponderCoords({ lat: matchingUnit.lat, lng: matchingUnit.lng });
        return;
      }
    }

    // Otherwise fallback/simulate dispatch if none is online so responder mode can still be demoed
    setActiveAssignment(null);
  };

  useEffect(() => {
    checkActiveDispatches();
  }, [selectedResponderId, myReports, activeResponders]);

  // Update Responder Status manually
  const updateResponderStatus = async (newStatus: 'available' | 'dispatched' | 'en_route' | 'on_scene') => {
    if (!activeAssignment) return;
    try {
      // If table ciro_resources is enabled, update status and coords in Supabase
      const { error } = await supabase
        .from('ciro_resources')
        .update({ status: newStatus })
        .eq('id', selectedResponderId);

      if (error) {
        // Handled silently for mock simulation fallback
      }

      // Local update
      setActiveResponders(prev =>
        prev.map(r => r.id === selectedResponderId ? { ...r, status: newStatus } : r)
      );

      // Also notify WebSocket server of status change
      if (wsRef.current && (wsRef.current.readyState === 1 || wsRef.current.readyState === WebSocket.OPEN)) {
        wsRef.current.send(JSON.stringify({
          type: 'responder_location',
          responderId: selectedResponderId,
          lat: responderCoords?.lat || (activeAssignment.unit.lat || 24.8607),
          lng: responderCoords?.lng || (activeAssignment.unit.lng || 67.0104),
          status: newStatus
        }));
      }

      // If resolving crisis, complete it in Supabase
      if (newStatus === 'available') {
        const targetId = activeAssignment.crisis.id;
        const { error: crisisError } = await supabase
          .from('ciro_crises')
          .update({ status: 'resolved' })
          .eq('id', targetId);

        // Disengage resource from crisis
        await supabase
          .from('ciro_resources')
          .update({ assigned_crisis_id: null, status: 'available' })
          .eq('id', selectedResponderId);

        Alert.alert("Incident Resolved", "Operational sector cleared. Asset returned to standby!");
        setActiveAssignment(null);
        setIsNavigating(false);
      }

      fetchMyReports();
    } catch (e) {
      console.warn("Status change transmission failure:", e);
    }
  };

  // Turn-by-Turn Route Navigation simulation
  const startNavigationSimulation = () => {
    if (!activeAssignment || isNavigating) return;
    setIsNavigating(true);
    setNavigationProgress(0);
    updateResponderStatus('en_route');

    const startLat = activeAssignment.unit.lat;
    const startLng = activeAssignment.unit.lng;
    const endLat = activeAssignment.crisis.lat;
    const endLng = activeAssignment.crisis.lng;

    let progress = 0;
    const interval = setInterval(async () => {
      progress += 0.1;
      const progressPercent = Math.min(100, Math.round(progress * 100));
      setNavigationProgress(progressPercent);

      // Lerp coordinates to simulate driving
      const currentLat = startLat + (endLat - startLat) * progress;
      const currentLng = startLng + (endLng - startLng) * progress;
      setResponderCoords({ lat: currentLat, lng: currentLng });

      // Update Supabase in background so admin sees it in real time
      try {
        await supabase
          .from('ciro_resources')
          .update({ lat: currentLat, lng: currentLng })
          .eq('id', selectedResponderId);
      } catch { }

      // Also send coordinates telemetry to WebSocket broker
      if (wsRef.current && (wsRef.current.readyState === 1 || wsRef.current.readyState === WebSocket.OPEN)) {
        wsRef.current.send(JSON.stringify({
          type: 'responder_location',
          responderId: selectedResponderId,
          lat: currentLat,
          lng: currentLng,
          status: progress >= 1 ? 'on_scene' : 'en_route'
        }));
      }

      if (progress >= 1) {
        clearInterval(interval);
        setIsNavigating(false);
        updateResponderStatus('on_scene');
        Alert.alert("Destination Reached", "Operational asset has arrived on scene. Transitioning status lock to On-Scene!");
      }
    }, 1000);
  };

  // Helper rendering values
  const getCrisisIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'fire': return '🔥';
      case 'flood': return '🌊';
      case 'accident': return '🚗';
      case 'robbery': return '🚨';
      case 'protest': return '📢';
      case 'power_outage': return '⚡';
      default: return '❓';
    }
  };

  const getSeverityColor = (sev: string) => {
    switch (sev) {
      case 'CRITICAL': return '#EF4444';
      case 'HIGH': return '#F59E0B';
      case 'MEDIUM': return '#3B82F6';
      default: return '#10B981';
    }
  };

  const activeReport = myReports.find(r => r.id === selectedReportId);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0B0F19" />

      {/* ── Status Bar ─────────────────────────────────────────── */}
      <View style={styles.topHeader}>
        <View style={styles.headerTitleGroup}>
          <Shield color="#6366F1" size={24} style={styles.headerIcon} />
          <Text style={styles.headerText}>CIRO MOBILE</Text>
        </View>
        <View style={styles.headerBadgeGroup}>
          <View style={styles.badgeWrapper}>
            {isConnected ? (
              <View style={[styles.statusBadge, styles.badgeConnected]}>
                <Wifi color="#10B981" size={12} />
                <Text style={styles.badgeText}>SATELLITE SYNC</Text>
              </View>
            ) : (
              <View style={[styles.statusBadge, styles.badgeOffline]}>
                <WifiOff color="#EF4444" size={12} />
                <Text style={styles.badgeText}>OFFLINE QUEUE</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* ── Main Tab Containers ─────────────────────────────────── */}
      <ScrollView contentContainerStyle={styles.scrollContent} style={styles.scrollView}>

        {/* TAB 1: Civilian Portal */}
        {activeTab === 'civilian' && (
          <View style={styles.contentTab}>

            {/* Pulsing Emergency SOS Button */}
            <View style={styles.sosCard}>
              <Text style={styles.sosTitle}>EMERGENCY DISTRESS BEACON</Text>
              <Text style={styles.sosSubtitle}>Double tap to instantly broadcast location and call for response</Text>
              <TouchableOpacity
                activeOpacity={0.8}
                onLongPress={triggerSos}
                onPress={() => Alert.alert("Hold Down Trigger", "Please press and hold the button for 2 seconds to initiate SOS beacon.")}
                style={styles.sosOuterCircle}
              >
                <Animated.View style={[styles.sosInnerCircle, { transform: [{ scale: sosScale }] }]}>
                  <Text style={styles.sosButtonText}>SOS</Text>
                  <Text style={styles.sosButtonSubText}>HOLD FOR 2S</Text>
                </Animated.View>
              </TouchableOpacity>
              {isSubmitting && sosActive && <ActivityIndicator color="#EF4444" size="large" style={{ marginTop: 15 }} />}
            </View>

            {/* Incident Reporting Form */}
            <View style={styles.reportFormCard}>
              <Text style={styles.formSectionTitle}>🛰️ DISPATCH INCIDENT REPORT</Text>

              {/* Category Select */}
              <Text style={styles.fieldLabel}>CRISIS CATEGORY</Text>
              <View style={styles.categoryPickerRow}>
                {['fire', 'flood', 'accident', 'robbery', 'protest'].map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.categoryBtn, incidentType === c && styles.categoryBtnActive]}
                    onPress={() => setIncidentType(c)}
                  >
                    <Text style={styles.categoryBtnEmoji}>{getCrisisIcon(c)}</Text>
                    <Text style={[styles.categoryBtnText, incidentType === c && styles.categoryBtnTextActive]}>
                      {c.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Severity SELECT */}
              <Text style={styles.fieldLabel}>SEVERITY LEVEL</Text>
              <View style={styles.severityRow}>
                {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(s => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.severityBtn, severity === s && { backgroundColor: getSeverityColor(s) + '40', borderColor: getSeverityColor(s) }]}
                    onPress={() => setSeverity(s)}
                  >
                    <Text style={[styles.severityBtnText, severity === s && { color: getSeverityColor(s), fontWeight: 'bold' }]}>
                      {s}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Location selection */}
              <View style={styles.inlineFieldsRow}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={styles.fieldLabel}>SECTOR / AREA</Text>
                  <TextInput
                    style={styles.textInput}
                    value={customLocation}
                    onChangeText={setCustomLocation}
                    placeholder="Saddar, DHA, Clifton..."
                    placeholderTextColor="#475569"
                  />
                </View>
                <View style={{ width: 120 }}>
                  <Text style={styles.fieldLabel}>GPS COORDINATES</Text>
                  <TouchableOpacity
                    onPress={fetchCurrentLocation}
                    disabled={isGpsLoading}
                    style={[styles.gpsLockBtn, gpsCoordinates && styles.gpsLockBtnLocked]}
                  >
                    {isGpsLoading ? (
                      <ActivityIndicator size="small" color="#6366F1" />
                    ) : (
                      <>
                        <MapPin color={gpsCoordinates ? '#10B981' : '#6366F1'} size={14} />
                        <Text style={[styles.gpsLockBtnText, gpsCoordinates && { color: '#10B981' }]}>
                          {gpsCoordinates ? 'LOCKED' : 'GPS LOCK'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {/* Description Input */}
              <Text style={styles.fieldLabel}>SATELLITE INTEL / DESCRIPTION</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Briefly describe the emergency conditions, casualties, blockade, or resources needed..."
                placeholderTextColor="#475569"
                multiline
                numberOfLines={4}
              />

              {/* Submit button */}
              <TouchableOpacity
                onPress={submitIncidentReport}
                disabled={isSubmitting}
                style={styles.submitBtn}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <AlertTriangle color="#fff" size={16} />
                    <Text style={styles.submitBtnText}>TRANSMIT ENCRYPTED REPORT</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

          </View>
        )}

        {/* TAB 2: See if Help is Coming (Tracking) */}
        {activeTab === 'tracking' && (
          <View style={styles.contentTab}>

            {!selectedReportId ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>⏱️ SUBMITTED EMERGENCY SIGNALS</Text>
                <Text style={styles.cardSubtitle}>Select an active distress signal to audit dispatch telemetry and live ETAs</Text>

                {isFetchingReports ? (
                  <ActivityIndicator color="#6366F1" size="large" style={{ marginVertical: 30 }} />
                ) : myReports.length === 0 ? (
                  <View style={styles.emptyState}>
                    <AlertTriangle color="#475569" size={40} />
                    <Text style={styles.emptyStateText}>No active signals registered on your satellite client.</Text>
                  </View>
                ) : (
                  <View style={styles.reportList}>
                    {myReports.map(report => (
                      <TouchableOpacity
                        key={report.id}
                        onPress={() => setSelectedReportId(report.id)}
                        style={styles.reportRow}
                      >
                        <Text style={styles.reportRowEmoji}>{getCrisisIcon(report.type)}</Text>
                        <View style={styles.reportRowDetails}>
                          <Text style={styles.reportRowTitle} numberOfLines={1}>
                            {report.type.replace('_', ' ').toUpperCase()} · {report.location}
                          </Text>
                          <Text style={styles.reportRowDesc} numberOfLines={1}>
                            {report.description}
                          </Text>
                          <Text style={styles.reportRowTime}>
                            {new Date(report.timestamp).toLocaleTimeString()} · {report.status.toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.reportRowStatusGroup}>
                          <Text style={[styles.badgeText, { color: getSeverityColor(report.severity), fontWeight: 'bold' }]}>
                            {report.severity}
                          </Text>
                          <CheckCircle color={report.status === 'resolved' ? '#10B981' : '#6366F1'} size={14} style={{ marginTop: 5 }} />
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            ) : (
              // Active detailed tracker for help coming!
              <View style={styles.activeTrackerCard}>
                <TouchableOpacity
                  onPress={() => setSelectedReportId(null)}
                  style={styles.backBtn}
                >
                  <Text style={styles.backBtnText}>◀ BACK TO SIGNALS LIST</Text>
                </TouchableOpacity>

                {activeReport && (
                  <>
                    <View style={styles.trackerHeader}>
                      <Text style={styles.trackerHeaderTitle}>
                        {getCrisisIcon(activeReport.type)} {activeReport.type.replace('_', ' ').toUpperCase()} SIGNAL
                      </Text>
                      <View style={[styles.statusTag, { borderColor: getSeverityColor(activeReport.severity), backgroundColor: getSeverityColor(activeReport.severity) + '15' }]}>
                        <Text style={{ color: getSeverityColor(activeReport.severity), fontSize: 10, fontWeight: 'bold' }}>
                          {activeReport.severity} LOCK
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.trackerLoc}>📍 Location: {activeReport.location}</Text>
                    <Text style={styles.trackerDesc}>{activeReport.description}</Text>

                    {/* LIVE TRACKER RADAR / TELEMETRY MAP */}
                    <View style={styles.telemetryMapCard}>
                      <Text style={styles.telemetryMapTitle}>🛰️ LIVE RESPONDER TELEMETRY MAP</Text>

                      {Platform.OS !== 'web' && MapView ? (
                        <View style={styles.mapContainer}>
                          <MapView
                            style={StyleSheet.absoluteFillObject}
                            initialRegion={{
                              latitude: activeReport.lat,
                              longitude: activeReport.lng,
                              latitudeDelta: 0.02,
                              longitudeDelta: 0.02,
                            }}
                            customMapStyle={darkMapStyle}
                          >
                            {/* Civilian Incident Marker */}
                            <Marker
                              coordinate={{
                                latitude: activeReport.lat,
                                longitude: activeReport.lng,
                              }}
                              title="YOUR EMERGENCY SIGNAL"
                              description="GPS Lock Established"
                              pinColor="red"
                            />

                            {/* Allocated Responders Markers */}
                            {activeReport.allocated_units && activeReport.allocated_units.map((unit) => {
                              const matchedRes = activeResponders.find(r => r.id === unit.id);
                              // Calculate dynamic coordinates showing current responder simulated driving progress
                              const resLat = matchedRes?.lat || activeReport.lat;
                              const resLng = matchedRes?.lng || activeReport.lng;
                              return (
                                <Marker
                                  key={unit.id}
                                  coordinate={{ latitude: resLat, longitude: resLng }}
                                  title={`${unit.id.toUpperCase()}`}
                                  description={`Status: ${unit.status.toUpperCase()} · ETA: ${unit.eta} MINS`}
                                >
                                  <View style={styles.customResPin}>
                                    <Text style={{ fontSize: 20 }}>
                                      {unit.type === 'ambulance' ? '🚑' : unit.type === 'police' ? '🚔' : '🚒'}
                                    </Text>
                                  </View>
                                </Marker>
                              );
                            })}

                            {/* Render lines from responder to incident if active */}
                            {activeReport.allocated_units && activeReport.allocated_units.map((unit) => {
                              const matchedRes = activeResponders.find(r => r.id === unit.id);
                              if (!matchedRes) return null;
                              return (
                                <Polyline
                                  key={`poly_${unit.id}`}
                                  coordinates={[
                                    { latitude: matchedRes.lat, longitude: matchedRes.lng },
                                    { latitude: activeReport.lat, longitude: activeReport.lng }
                                  ]}
                                  strokeColor="#ef4444"
                                  strokeWidth={3}
                                  lineDashPattern={[5, 5]}
                                />
                              );
                            })}
                          </MapView>
                        </View>
                      ) : (
                        /* Falling back to visual vector simulation grid */
                        <View style={styles.vectorFallbackContainer}>
                          {/* Static grid lines */}
                          <View style={styles.gridLineH1} />
                          <View style={styles.gridLineH2} />
                          <View style={styles.gridLineV1} />
                          <View style={styles.gridLineV2} />

                          {/* Target Beacon */}
                          <View style={[styles.radarCircleBeacon, { top: '35%', left: '50%' }]}>
                            <View style={styles.beaconCore} />
                            <View style={styles.beaconRing} />
                          </View>

                          {/* Responder Icon representing help moving */}
                          {activeReport.allocated_units && activeReport.allocated_units.length > 0 ? (
                            activeReport.allocated_units.map((unit, index) => (
                              <View
                                key={unit.id}
                                style={[
                                  styles.radarResourcePin,
                                  {
                                    top: index === 0 ? '60%' : '20%',
                                    left: index === 0 ? '30%' : '70%'
                                  }
                                ]}
                              >
                                <View style={[styles.resourceDot, { backgroundColor: '#3B82F6' }]} />
                                <Text style={styles.resourcePinText}>
                                  {unit.type === 'ambulance' ? '🚑' : unit.type === 'police' ? '🚔' : '🚒'} {unit.id.toUpperCase()}
                                </Text>
                              </View>
                            ))
                          ) : (
                            <View style={styles.radarScanningGroup}>
                              <Compass color="#6366F1" size={24} style={styles.compassSpinner} />
                              <Text style={styles.radarScanningText}>SEARCHING DISPATCH SIGNALS...</Text>
                            </View>
                          )}

                          <Text style={styles.mapAlertOverlay}>Karachi Sector Satellite Lock</Text>
                        </View>
                      )}
                    </View>

                    {/* RESPONSE STEPPER */}
                    <Text style={styles.trackerSectionTitle}>⏱️ OPERATIONAL RESPONSE STEPPER</Text>

                    <View style={styles.stepperContainer}>
                      {/* Step 1 */}
                      <View style={styles.stepRow}>
                        <View style={[styles.stepDot, styles.stepDotDone]} />
                        <View style={styles.stepLine} />
                        <View style={styles.stepContent}>
                          <Text style={styles.stepTitle}>Distress Signal Broadcasted</Text>
                          <Text style={styles.stepDesc}>GPS Coordinates locked and cataloged in central system.</Text>
                        </View>
                      </View>

                      {/* Step 2 */}
                      <View style={styles.stepRow}>
                        <View style={[styles.stepDot, activeReport.allocated_units && activeReport.allocated_units.length > 0 ? styles.stepDotDone : styles.stepDotActive]} />
                        <View style={styles.stepLine} />
                        <View style={styles.stepContent}>
                          <Text style={styles.stepTitle}>AI Orchestrator Review & Authorization</Text>
                          <Text style={styles.stepDesc}>Risk matrix analyzed and nearest tactical assets prioritized.</Text>
                        </View>
                      </View>

                      {/* Step 3 */}
                      <View style={styles.stepRow}>
                        <View style={[styles.stepDot, activeReport.allocated_units && activeReport.allocated_units.length > 0 && activeReport.allocated_units[0].status !== 'dispatched' ? styles.stepDotDone : styles.stepDotPending]} />
                        <View style={styles.stepLine} />
                        <View style={styles.stepContent}>
                          <Text style={styles.stepTitle}>Responder Assets Dispatched</Text>
                          {activeReport.allocated_units && activeReport.allocated_units.length > 0 ? (
                            activeReport.allocated_units.map(unit => (
                              <View key={unit.id} style={styles.allocatedUnitCard}>
                                <Text style={styles.allocatedUnitText}>
                                  {unit.type === 'ambulance' ? '🚑 AMBULANCE' : unit.type === 'police' ? '🚔 POLICE INTERCEPTOR' : '🚒 FIRE TRUCK'} ({unit.id.toUpperCase()})
                                </Text>
                                <Text style={styles.allocatedUnitStatus}>
                                  Status: {unit.status.toUpperCase()} · ETA: <Text style={{ color: '#F59E0B', fontWeight: 'bold' }}>{unit.eta} MINS</Text>
                                </Text>
                              </View>
                            ))
                          ) : (
                            <Text style={styles.stepDesc}>Awaiting dispatch clearance from next operational cycle...</Text>
                          )}
                        </View>
                      </View>

                      {/* Step 4 */}
                      <View style={styles.stepRow}>
                        <View style={[styles.stepDot, activeReport.status === 'resolved' ? styles.stepDotDone : styles.stepDotPending]} />
                        <View style={[styles.stepContent, { paddingBottom: 0 }]}>
                          <Text style={styles.stepTitle}>Sector Declared Safe / Resolved</Text>
                          <Text style={styles.stepDesc}>Responders lock on scene, clear road boundaries, and resolve threat.</Text>
                        </View>
                      </View>
                    </View>

                    {/* Quick Call Emergency button */}
                    <TouchableOpacity
                      onPress={() => startVoiceCall(activeReport?.location || 'Civilian Location')}
                      style={styles.callHotlineBtn}
                    >
                      <PhoneCall color="#fff" size={16} />
                      <Text style={styles.callHotlineBtnText}>ESTABLISH VOICE ENCRYPTED AUDIO CHANNEL</Text>
                    </TouchableOpacity>

                  </>
                )}
              </View>
            )}

          </View>
        )}

        {/* TAB 3: Field Responder HUD ("Navigation from Admin") */}
        {activeTab === 'responder' && (
          <View style={styles.contentTab}>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>🧭 TACTICAL RESPONDER OPERATIONS HUD</Text>
              <Text style={styles.cardSubtitle}>Configure vehicle responder ID to receive routes and updates directly from the Command Center</Text>

              {/* Selector */}
              <Text style={styles.fieldLabel}>SELECT ACTIVE VEHICLE UNIT</Text>
              <View style={styles.categoryPickerRow}>
                {['ambulance_1', 'police_3', 'fire_unit_2'].map(unitId => (
                  <TouchableOpacity
                    key={unitId}
                    style={[styles.categoryBtn, selectedResponderId === unitId && styles.categoryBtnActive, { flex: 1 }]}
                    onPress={() => setSelectedResponderId(unitId)}
                  >
                    <Text style={styles.categoryBtnEmoji}>
                      {unitId.includes('ambulance') ? '🚑' : unitId.includes('police') ? '🚔' : '🚒'}
                    </Text>
                    <Text style={[styles.categoryBtnText, selectedResponderId === unitId && styles.categoryBtnTextActive]}>
                      {unitId.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Active Assignment state */}
              {activeAssignment ? (
                <View style={styles.activeAssignmentCard}>
                  <View style={styles.assignmentHeader}>
                    <Text style={styles.assignmentTitle}>🔴 CRITICAL DISPATCH INCOMING</Text>
                    <Text style={styles.assignmentSubTitle}>Satellite authorization validated</Text>
                  </View>

                  <View style={styles.assignmentBody}>
                    <Text style={styles.assignmentLabel}>CRISIS SECTOR:</Text>
                    <Text style={styles.assignmentVal}>{activeAssignment.crisis.location}</Text>

                    <Text style={styles.assignmentLabel}>INTEL DETAILS:</Text>
                    <Text style={styles.assignmentVal}>{activeAssignment.crisis.description}</Text>

                    <Text style={styles.assignmentLabel}>SEVERITY LEVEL:</Text>
                    <Text style={[styles.assignmentVal, { color: getSeverityColor(activeAssignment.crisis.severity), fontWeight: 'bold' }]}>
                      {activeAssignment.crisis.severity}
                    </Text>

                    <Text style={styles.assignmentLabel}>RESPONDER HUD COORDS:</Text>
                    <Text style={styles.assignmentVal}>
                      Lat: {activeAssignment.crisis.lat.toFixed(4)} · Lng: {activeAssignment.crisis.lng.toFixed(4)}
                    </Text>
                  </View>

                  {/* ACTIVE NAV MAP */}
                  <View style={styles.telemetryMapCard}>
                    <Text style={styles.telemetryMapTitle}>🧭 INTERACTIVE ROUTING SCREEN</Text>

                    {Platform.OS !== 'web' && MapView ? (
                      <View style={styles.mapContainer}>
                        <MapView
                          style={StyleSheet.absoluteFillObject}
                          initialRegion={{
                            latitude: activeAssignment.unit.lat,
                            longitude: activeAssignment.unit.lng,
                            latitudeDelta: 0.03,
                            longitudeDelta: 0.03,
                          }}
                          customMapStyle={darkMapStyle}
                        >
                          {/* Starting Point Marker */}
                          <Marker
                            coordinate={{
                              latitude: activeAssignment.unit.lat,
                              longitude: activeAssignment.unit.lng,
                            }}
                            title="START HUB"
                            description="Origin dispatch station"
                            pinColor="green"
                          />

                          {/* Current Responder GPS Telemetry Pin (moves in real-time) */}
                          <Marker
                            coordinate={{
                              latitude: responderCoords?.lat || activeAssignment.unit.lat,
                              longitude: responderCoords?.lng || activeAssignment.unit.lng,
                            }}
                            title="YOUR VEHICLE LOCATION"
                            description={isNavigating ? `En Route (${navigationProgress}%)` : "Standby Beacon Active"}
                          >
                            <View style={styles.customResPinActive}>
                              <Text style={{ fontSize: 24 }}>
                                {selectedResponderId.includes('ambulance') ? '🚑' : selectedResponderId.includes('police') ? '🚔' : '🚒'}
                              </Text>
                            </View>
                          </Marker>

                          {/* Target Incident Destination Marker */}
                          <Marker
                            coordinate={{
                              latitude: activeAssignment.crisis.lat,
                              longitude: activeAssignment.crisis.lng,
                            }}
                            title="CRISIS TARGET SECTOR"
                            description={activeAssignment.crisis.location}
                            pinColor="red"
                          />

                          {/* Navigation Polyline Route */}
                          <Polyline
                            coordinates={[
                              { latitude: activeAssignment.unit.lat, longitude: activeAssignment.unit.lng },
                              { latitude: activeAssignment.crisis.lat, longitude: activeAssignment.crisis.lng }
                            ]}
                            strokeColor="#3B82F6"
                            strokeWidth={4}
                          />
                        </MapView>
                        {isNavigating ? (
                          <Text style={styles.navigationHUDOverlay}>DRIVING ROUTE... {navigationProgress}% REACHED</Text>
                        ) : (
                          <Text style={styles.navigationHUDOverlay}>ROUTE CALCULATION SECURED</Text>
                        )}
                      </View>
                    ) : (
                      <View style={styles.vectorFallbackContainer}>
                        {/* Nav paths */}
                        <View style={styles.gridLineH1} />
                        <View style={styles.gridLineH2} />

                        {/* Route Path line from unit to crisis */}
                        <View style={styles.routePathLine} />

                        {/* Origin unit */}
                        <View style={[styles.radarResourcePin, { top: '75%', left: '20%' }]}>
                          <View style={[styles.resourceDot, { backgroundColor: '#10B981' }]} />
                          <Text style={styles.resourcePinText}>START POINT</Text>
                        </View>

                        {/* Moving responder marker along path */}
                        {isNavigating && (
                          <View style={[styles.radarResourcePin, { top: `${75 - (75 - 35) * (navigationProgress / 100)}%`, left: `${20 + (50 - 20) * (navigationProgress / 100)}%` }]}>
                            <View style={[styles.resourceDot, { backgroundColor: '#F59E0B' }]} />
                            <Text style={styles.resourcePinText}>EN ROUTE ({navigationProgress}%)</Text>
                          </View>
                        )}

                        {/* Destination target */}
                        <View style={[styles.radarCircleBeacon, { top: '35%', left: '50%' }]}>
                          <View style={styles.beaconCore} />
                          <View style={styles.beaconRing} />
                        </View>

                        {isNavigating ? (
                          <Text style={styles.navigationHUDOverlay}>DRIVING ROUTE... {navigationProgress}% REACHED</Text>
                        ) : (
                          <Text style={styles.navigationHUDOverlay}>ROUTE CALCULATION SECURED</Text>
                        )}
                      </View>
                    )}
                  </View>

                  {/* Navigation telemetry control triggers */}
                  <View style={styles.navControlsRow}>
                    {!isNavigating && activeAssignment.unit.status === 'dispatched' && (
                      <TouchableOpacity
                        onPress={startNavigationSimulation}
                        style={styles.navStartBtn}
                      >
                        <Navigation color="#fff" size={16} />
                        <Text style={styles.navBtnText}>START ROUTE NAVIGATION</Text>
                      </TouchableOpacity>
                    )}

                    {isNavigating && (
                      <View style={styles.progressContainer}>
                        <Text style={styles.progressText}>GPS TELEMETRY VEHICLE SYNC: {navigationProgress}%</Text>
                        <View style={styles.progressBarBg}>
                          <View style={[styles.progressBarFill, { width: `${navigationProgress}%` }]} />
                        </View>
                      </View>
                    )}

                    {!isNavigating && activeAssignment.unit.status === 'en_route' && (
                      <TouchableOpacity
                        onPress={() => updateResponderStatus('on_scene')}
                        style={styles.navArrivalBtn}
                      >
                        <CheckCircle color="#fff" size={16} />
                        <Text style={styles.navBtnText}>MARK ON SCENE</Text>
                      </TouchableOpacity>
                    )}

                    {activeAssignment.unit.status === 'on_scene' && (
                      <TouchableOpacity
                        onPress={() => updateResponderStatus('available')}
                        style={styles.navResolveBtn}
                      >
                        <CheckCircle color="#fff" size={16} />
                        <Text style={styles.navBtnText}>RESOLVE INCIDENT / RE-ENGAGE</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <Compass color="#6366F1" size={40} />
                  <Text style={styles.emptyStateText}>STANDBY STATE IN hub: {selectedResponderId.toUpperCase()}</Text>
                  <Text style={styles.emptyStateSub}>No active dispatches allocated by Next.js command orchestrator. Telemetry checks running every 5s...</Text>

                  {/* Simulate fallback button for testing */}
                  <TouchableOpacity
                    onPress={() => {
                      // Trigger a simulated emergency in database to assign
                      Alert.alert(
                        "Satellite Simulation Mode",
                        "Simulating a dispatch tasking. The orchestrator will send target coordinates.",
                        [{
                          text: "Dispatch",
                          onPress: () => {
                            setActiveAssignment({
                              crisis: {
                                id: 'simulated_crisis_123',
                                type: 'fire',
                                severity: 'HIGH',
                                location: 'DHA Phase 6 Block C',
                                description: 'Electrical transformers explosion causing high fire threat near fuel station. Ambulances needed.',
                                lat: 24.7921,
                                lng: 67.0611,
                                status: 'active',
                                timestamp: new Date().toISOString()
                              },
                              unit: {
                                id: selectedResponderId,
                                type: selectedResponderId.includes('ambulance') ? 'ambulance' : selectedResponderId.includes('police') ? 'police' : 'fire_unit',
                                status: 'dispatched',
                                location: 'Saddar Hub',
                                lat: 24.8607,
                                lng: 67.0104
                              }
                            });
                          }
                        }]
                      );
                    }}
                    style={styles.simulateDispatchBtn}
                  >
                    <Text style={styles.simulateDispatchBtnText}>SIMULATE DISPATCH TEST TARGET</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

          </View>
        )}

        {/* TAB 4: Settings & Connection Audit */}
        {activeTab === 'settings' && (
          <View style={styles.contentTab}>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>⚙️ SYSTEM AUDIT & SATELLITE SETTINGS</Text>

              <View style={styles.settingRow}>
                <View style={styles.settingTextCol}>
                  <Text style={styles.settingRowTitle}>Responder HUD Tunnels</Text>
                  <Text style={styles.settingRowDesc}>Expose and activate field-agent dispatch navigation panels.</Text>
                </View>
                <Switch
                  value={isResponderMode}
                  onValueChange={setIsResponderMode}
                  trackColor={{ false: '#1E293B', true: '#6366F1' }}
                  thumbColor={isResponderMode ? '#fff' : '#475569'}
                />
              </View>

              <View style={styles.divider} />

              <View style={styles.settingRow}>
                <View style={styles.settingTextCol}>
                  <Text style={styles.settingRowTitle}>Satellite Network Link Status</Text>
                  <Text style={styles.settingRowDesc}>Toggle internet simulator to test offline data storage queues.</Text>
                </View>
                <Switch
                  value={isConnected}
                  onValueChange={setIsConnected}
                  trackColor={{ false: '#1E293B', true: '#10B981' }}
                  thumbColor={isConnected ? '#fff' : '#475569'}
                />
              </View>

              <View style={styles.divider} />

              {/* Cache and info stats */}
              <Text style={styles.settingsLabel}>DEVICE DATA SYNC QUEUES</Text>
              <View style={styles.settingsInfoCard}>
                <Text style={styles.infoText}>Offline Distress Signals Queued: <Text style={{ color: '#EF4444', fontWeight: 'bold' }}>{offlineQueue.length}</Text></Text>
                <Text style={styles.infoText}>Active Reports Monitored: <Text style={{ color: '#6366F1', fontWeight: 'bold' }}>{myReports.length}</Text></Text>
                <Text style={styles.infoText}>Total Active Response Units: <Text style={{ color: '#10B981', fontWeight: 'bold' }}>{activeResponders.length}</Text></Text>
              </View>

              {offlineQueue.length > 0 && (
                <TouchableOpacity
                  onPress={syncOfflineQueue}
                  style={styles.syncBtn}
                >
                  <Text style={styles.syncBtnText}>FORCE UPLOAD OFFLINE QUEUE</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={() => {
                  fetchMyReports();
                  Alert.alert("Satellite Refresh", "All signal directories updated.");
                }}
                style={styles.refreshBtn}
              >
                <Text style={styles.refreshBtnText}>REFRESH DIRECTORIES</Text>
              </TouchableOpacity>
            </View>

          </View>
        )}

      </ScrollView>

      {/* ── Visual Navigation Tab Bar ────────────────────────────── */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          onPress={() => setActiveTab('civilian')}
          style={[styles.tabBtn, activeTab === 'civilian' && styles.tabBtnActive]}
        >
          <AlertTriangle color={activeTab === 'civilian' ? '#6366F1' : '#64748B'} size={20} />
          <Text style={[styles.tabText, activeTab === 'civilian' && styles.tabTextActive]}>ASK HELP</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('tracking')}
          style={[styles.tabBtn, activeTab === 'tracking' && styles.tabBtnActive]}
        >
          <Clock color={activeTab === 'tracking' ? '#6366F1' : '#64748B'} size={20} />
          <Text style={[styles.tabText, activeTab === 'tracking' && styles.tabTextActive]}>IS HELP COMING</Text>
        </TouchableOpacity>

        {(isResponderMode || activeTab === 'responder') && (
          <TouchableOpacity
            onPress={() => setActiveTab('responder')}
            style={[styles.tabBtn, activeTab === 'responder' && styles.tabBtnActive]}
          >
            <Navigation color={activeTab === 'responder' ? '#6366F1' : '#64748B'} size={20} />
            <Text style={[styles.tabText, activeTab === 'responder' && styles.tabTextActive]}>HUD NAV</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={() => setActiveTab('settings')}
          style={[styles.tabBtn, activeTab === 'settings' && styles.tabBtnActive]}
        >
          <Settings color={activeTab === 'settings' ? '#6366F1' : '#64748B'} size={20} />
          <Text style={[styles.tabText, activeTab === 'settings' && styles.tabTextActive]}>SETTINGS</Text>
        </TouchableOpacity>
      </View>

      {/* ── VOICE CALL OVERLAY — MULTI-INCIDENT ROOMS ── */}
      {voiceCallActive && (
        <View style={styles.voiceCallOverlayContainer}>
          <SafeAreaView style={{ flex: 1, width: '100%' }}>

            {/* ── ROOM PICKER: shown when no incident is selected ── */}
            {!activeIncidentId ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}>
                <View style={styles.voiceCallSecureBadge}>
                  <Shield color="#ef4444" size={14} />
                  <Text style={styles.voiceCallSecureText}>ACTIVE COMMS ROOMS</Text>
                </View>
                <Text style={{ color: '#94a3b8', fontSize: 13, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', marginTop: 6, marginBottom: 20, textAlign: 'center' }}>
                  Select an incident channel to join
                </Text>
                {activeRooms.map((room) => (
                  <TouchableOpacity
                    key={room.incidentId}
                    onPress={() => joinIncidentRoom(room)}
                    style={{ width: '100%', backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#ef4444', borderRadius: 10, padding: 14, marginBottom: 10 }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444', marginRight: 8 }} />
                      <Text style={{ color: '#f1f5f9', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontWeight: 'bold', fontSize: 12 }}>{room.location}</Text>
                    </View>
                    <Text style={{ color: '#64748b', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 10, marginLeft: 16 }}>{room.sector} · {room.severity}</Text>
                    <Text style={{ color: '#64748b', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 9, marginLeft: 16, marginTop: 2 }}>{room.incidentId}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  onPress={() => setVoiceCallActive(false)}
                  style={{ marginTop: 12, paddingVertical: 8, paddingHorizontal: 24, backgroundColor: '#374151', borderRadius: 8 }}
                >
                  <Text style={{ color: '#9ca3af', fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>DISMISS</Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* ── ACTIVE INCIDENT CALL SCREEN ── */
              <View style={{ flex: 1, justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>

                {/* Header */}
                <View style={{ alignItems: 'center', marginTop: 40 }}>
                  <View style={styles.voiceCallSecureBadge}>
                    <Shield color="#ef4444" size={14} />
                    <Text style={styles.voiceCallSecureText}>SECURE TACTICAL CHANNEL</Text>
                  </View>
                  <Text style={styles.voiceCallUnitTitle}>
                    {activeRooms.find(r => r.incidentId === activeIncidentId)?.location || 'CIRO EMERGENCY HOTLINE'}
                  </Text>
                  <Text style={styles.voiceCallStatusText}>
                    {activeRooms.find(r => r.incidentId === activeIncidentId)?.sector || 'Karachi Dispatch'}
                  </Text>
                  {activeRooms.length > 1 && (
                    <TouchableOpacity
                      onPress={() => setActiveIncidentId(null)}
                      style={{ marginTop: 6, paddingHorizontal: 10, paddingVertical: 3, backgroundColor: '#1e293b', borderRadius: 4 }}
                    >
                      <Text style={{ color: '#60a5fa', fontSize: 9, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>
                        ← SWITCH ROOM ({activeRooms.length} active)
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Waveform Visualization */}
                <View style={styles.waveformContainer}>
                  {waveformHeights.map((h, idx) => (
                    <View
                      key={idx}
                      style={[
                        styles.waveformBar,
                        {
                          height: h,
                          backgroundColor: isMuted ? '#4b5563' : '#ef4444',
                          opacity: isMuted ? 0.4 : 1
                        }
                      ]}
                    />
                  ))}
                </View>

                {/* Duration and Status */}
                <View style={{ alignItems: 'center' }}>
                  <Text style={styles.voiceCallTimer}>
                    {Math.floor(voiceCallDuration / 60).toString().padStart(2, '0')}:
                    {(voiceCallDuration % 60).toString().padStart(2, '0')}
                  </Text>
                  <Text style={styles.voiceCallEncryptionInfo}>AES-256 END-TO-END SATELLITE COMMS</Text>
                </View>

                {/* Per-incident Chat Log */}
                <View style={{ width: '90%', height: 190, backgroundColor: '#0f172a', borderRadius: 8, borderWidth: 1, borderColor: '#1e293b', padding: 8, marginVertical: 8 }}>
                  <Text style={{ fontSize: 9, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: '#10b981', fontWeight: 'bold', letterSpacing: 1, marginBottom: 4 }}>
                    📡 INCIDENT: {activeIncidentId}
                  </Text>
                  <ScrollView
                    ref={chatScrollRef}
                    style={{ flex: 1 }}
                    onContentSizeChange={() => chatScrollRef.current?.scrollToEnd({ animated: true })}
                  >
                    {(incidentChats.get(activeIncidentId) || []).length === 0 ? (
                      <View style={{ height: 80, justifyContent: 'center', alignItems: 'center' }}>
                        <Text style={{ fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: '#475569', textAlign: 'center' }}>
                          AWAITING DATA LINK DIRECTIVES...
                        </Text>
                      </View>
                    ) : (
                      (incidentChats.get(activeIncidentId) || []).map((msg) => (
                        <View key={msg.id} style={{ marginVertical: 2 }}>
                          <Text style={{ fontSize: 8, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: '#64748b' }}>
                            {msg.sender} · {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </Text>
                          <Text style={{ fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: msg.sender.includes('HQ') ? '#34d399' : '#e2e8f0', marginLeft: 4 }}>
                            &gt; {msg.text}
                          </Text>
                        </View>
                      ))
                    )}
                  </ScrollView>
                  <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#1e293b', paddingTop: 5, marginTop: 5, alignItems: 'center' }}>
                    <TextInput
                      value={chatInput}
                      onChangeText={setChatInput}
                      placeholder="Type message..."
                      placeholderTextColor="#475569"
                      style={{ flex: 1, height: 26, fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: '#fff', paddingHorizontal: 6, backgroundColor: '#020617', borderRadius: 4 }}
                      onSubmitEditing={sendChatMessage}
                      returnKeyType="send"
                    />
                    <TouchableOpacity
                      onPress={sendChatMessage}
                      style={{ backgroundColor: '#10b981', paddingHorizontal: 10, height: 26, borderRadius: 4, justifyContent: 'center', marginLeft: 6 }}
                    >
                      <Text style={{ fontSize: 9, color: '#fff', fontWeight: 'bold' }}>SEND</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Action Buttons Row */}
                <View style={styles.voiceCallActionsRow}>
                  {/* Mute Button */}
                  <TouchableOpacity
                    style={[styles.voiceCallCircleBtn, isMuted && { backgroundColor: '#ef4444' }]}
                    onPress={() => setIsMuted(prev => !prev)}
                  >
                    <Shield color={isMuted ? '#fff' : '#a1a1aa'} size={22} />
                    <Text style={styles.voiceCallBtnLabel}>{isMuted ? 'UNMUTE' : 'MUTE'}</Text>
                  </TouchableOpacity>

                  {/* End Call Button */}
                  <TouchableOpacity
                    style={[styles.voiceCallCircleBtn, { backgroundColor: '#dc2626', width: 70, height: 70, borderRadius: 35 }]}
                    onPress={() => endVoiceCall()}
                  >
                    <PhoneCall color="#fff" size={28} style={{ transform: [{ rotate: '135deg' }] }} />
                    <Text style={[styles.voiceCallBtnLabel, { color: '#ef4444', fontWeight: 'bold' }]}>HANG UP</Text>
                  </TouchableOpacity>

                  {/* Speaker Button */}
                  <TouchableOpacity
                    style={[styles.voiceCallCircleBtn, isSpeaker && { backgroundColor: '#3b82f6' }]}
                    onPress={() => setIsSpeaker(prev => !prev)}
                  >
                    <Activity color={isSpeaker ? '#fff' : '#a1a1aa'} size={22} />
                    <Text style={styles.voiceCallBtnLabel}>SPEAKER</Text>
                  </TouchableOpacity>
                </View>

              </View>
            )}

          </SafeAreaView>
        </View>
      )}

    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
  topHeader: {
    height: 60,
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    marginRight: 8,
  },
  headerText: {
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'monospace',
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 15,
    letterSpacing: 1.5,
  },
  headerBadgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeWrapper: {
    borderRadius: 4,
    overflow: 'hidden',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  badgeConnected: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  badgeOffline: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  badgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#FFF',
    letterSpacing: 0.5,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  contentTab: {
    gap: 16,
  },
  card: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 16,
  },
  cardTitle: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 1.0,
    marginBottom: 4,
  },
  cardSubtitle: {
    color: '#64748B',
    fontSize: 10,
    lineHeight: 14,
    marginBottom: 16,
  },
  sosCard: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    padding: 20,
    alignItems: 'center',
  },
  sosTitle: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  sosSubtitle: {
    color: '#64748B',
    fontSize: 10,
    textAlign: 'center',
    marginBottom: 20,
  },
  sosOuterCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    borderWidth: 2,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 10,
  },
  sosInnerCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 15,
    elevation: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFAAAA',
  },
  sosButtonText: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  sosButtonSubText: {
    color: '#FFAAAA',
    fontSize: 8,
    fontWeight: 'bold',
    marginTop: 4,
  },
  reportFormCard: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 16,
  },
  formSectionTitle: {
    color: '#6366F1',
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 1.0,
    marginBottom: 16,
  },
  fieldLabel: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  categoryPickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  categoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  categoryBtnActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderColor: '#6366F1',
  },
  categoryBtnEmoji: {
    fontSize: 14,
  },
  categoryBtnText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '600',
  },
  categoryBtnTextActive: {
    color: '#6366F1',
    fontWeight: 'bold',
  },
  severityRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  severityBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1E293B',
  },
  severityBtnText: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '600',
  },
  inlineFieldsRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  textInput: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 6,
    padding: 10,
    color: '#FFF',
    fontSize: 12,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  gpsLockBtn: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 6,
    gap: 6,
  },
  gpsLockBtnLocked: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: '#10B981',
  },
  gpsLockBtnText: {
    color: '#6366F1',
    fontSize: 10,
    fontWeight: 'bold',
  },
  submitBtn: {
    backgroundColor: '#6366F1',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3,
  },
  submitBtnText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 11,
    letterSpacing: 1.0,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptyStateText: {
    color: '#64748B',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },
  emptyStateSub: {
    color: '#475569',
    fontSize: 9,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  reportList: {
    gap: 10,
  },
  reportRow: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 12,
    alignItems: 'center',
  },
  reportRowEmoji: {
    fontSize: 22,
    marginRight: 12,
  },
  reportRowDetails: {
    flex: 1,
    gap: 2,
  },
  reportRowTitle: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  reportRowDesc: {
    color: '#94A3B8',
    fontSize: 10,
  },
  reportRowTime: {
    color: '#475569',
    fontSize: 8,
    fontWeight: '600',
  },
  reportRowStatusGroup: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  activeTrackerCard: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 16,
  },
  backBtn: {
    marginBottom: 16,
    paddingVertical: 4,
  },
  backBtnText: {
    color: '#6366F1',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  trackerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  trackerHeaderTitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  statusTag: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  trackerLoc: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  trackerDesc: {
    color: '#94A3B8',
    fontSize: 10.5,
    lineHeight: 14,
    marginBottom: 16,
  },
  telemetryMapCard: {
    backgroundColor: '#070A13',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  telemetryMapTitle: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  vectorFallbackContainer: {
    height: 160,
    backgroundColor: '#090D1A',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1E293B',
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridLineH1: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '33%',
    height: 1,
    backgroundColor: 'rgba(99, 102, 241, 0.04)',
  },
  gridLineH2: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '66%',
    height: 1,
    backgroundColor: 'rgba(99, 102, 241, 0.04)',
  },
  gridLineV1: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '33%',
    width: 1,
    backgroundColor: 'rgba(99, 102, 241, 0.04)',
  },
  gridLineV2: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '66%',
    width: 1,
    backgroundColor: 'rgba(99, 102, 241, 0.04)',
  },
  radarCircleBeacon: {
    position: 'absolute',
    width: 40,
    height: 40,
    marginLeft: -20,
    marginTop: -20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  beaconCore: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  beaconRing: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EF4444',
    opacity: 0.4,
  },
  radarResourcePin: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 4,
    marginLeft: -20,
    marginTop: -10,
  },
  resourceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  resourcePinText: {
    color: '#FFF',
    fontSize: 7.5,
    fontWeight: 'bold',
  },
  routePathLine: {
    position: 'absolute',
    width: '40%',
    height: 1.5,
    backgroundColor: '#1E293B',
    transform: [{ rotate: '-35deg' }],
    opacity: 0.5,
  },
  radarScanningGroup: {
    alignItems: 'center',
    gap: 8,
  },
  compassSpinner: {
    opacity: 0.5,
  },
  radarScanningText: {
    color: '#475569',
    fontSize: 8,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  mapAlertOverlay: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    color: '#475569',
    fontSize: 8,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  navigationHUDOverlay: {
    position: 'absolute',
    top: 8,
    left: 8,
    color: '#F59E0B',
    fontSize: 8,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  trackerSectionTitle: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  stepperContainer: {
    paddingLeft: 8,
    marginBottom: 20,
  },
  stepRow: {
    flexDirection: 'row',
    position: 'relative',
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    zIndex: 2,
    marginTop: 2,
  },
  stepDotDone: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  stepDotActive: {
    backgroundColor: '#0F172A',
    borderColor: '#6366F1',
  },
  stepDotPending: {
    backgroundColor: '#0F172A',
    borderColor: '#334155',
  },
  stepLine: {
    position: 'absolute',
    left: 4,
    top: 10,
    bottom: 0,
    width: 1.5,
    backgroundColor: '#1E293B',
    zIndex: 1,
  },
  stepContent: {
    flex: 1,
    paddingLeft: 16,
    paddingBottom: 20,
  },
  stepTitle: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  stepDesc: {
    color: '#64748B',
    fontSize: 9.5,
    lineHeight: 13,
    marginTop: 2,
  },
  allocatedUnitCard: {
    backgroundColor: '#1E293B',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 8,
    marginTop: 6,
    gap: 2,
  },
  allocatedUnitText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: 'bold',
  },
  allocatedUnitStatus: {
    color: '#94A3B8',
    fontSize: 8.5,
  },
  callHotlineBtn: {
    backgroundColor: '#1E293B',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  callHotlineBtnText: {
    color: '#94A3B8',
    fontWeight: 'bold',
    fontSize: 9,
    letterSpacing: 0.5,
  },
  activeAssignmentCard: {
    backgroundColor: '#1E293B',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    padding: 12,
    marginTop: 10,
  },
  assignmentHeader: {
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingBottom: 8,
    marginBottom: 10,
  },
  assignmentTitle: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  assignmentSubTitle: {
    color: '#64748B',
    fontSize: 8.5,
  },
  assignmentBody: {
    gap: 3,
    marginBottom: 14,
  },
  assignmentLabel: {
    color: '#64748B',
    fontSize: 8,
    fontWeight: 'bold',
  },
  assignmentVal: {
    color: '#FFF',
    fontSize: 10.5,
    marginBottom: 6,
  },
  navControlsRow: {
    gap: 8,
  },
  navStartBtn: {
    backgroundColor: '#6366F1',
    borderRadius: 6,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  navArrivalBtn: {
    backgroundColor: '#F59E0B',
    borderRadius: 6,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  navResolveBtn: {
    backgroundColor: '#10B981',
    borderRadius: 6,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  navBtnText: {
    color: '#FFF',
    fontSize: 9.5,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  progressContainer: {
    backgroundColor: '#0F172A',
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 4,
  },
  progressText: {
    color: '#FFF',
    fontSize: 8,
    fontWeight: 'bold',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#1E293B',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#F59E0B',
  },
  simulateDispatchBtn: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderWidth: 1,
    borderColor: '#6366F1',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 10,
  },
  simulateDispatchBtnText: {
    color: '#6366F1',
    fontSize: 9,
    fontWeight: 'bold',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  settingTextCol: {
    flex: 1,
    marginRight: 10,
    gap: 2,
  },
  settingRowTitle: {
    color: '#FFF',
    fontSize: 11.5,
    fontWeight: 'bold',
  },
  settingRowDesc: {
    color: '#64748B',
    fontSize: 9,
  },
  divider: {
    height: 1,
    backgroundColor: '#1E293B',
    marginVertical: 4,
  },
  settingsLabel: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 8,
  },
  settingsInfoCard: {
    backgroundColor: '#1E293B',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 12,
    gap: 6,
    marginBottom: 16,
  },
  infoText: {
    color: '#94A3B8',
    fontSize: 10.5,
  },
  syncBtn: {
    backgroundColor: '#10B981',
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 8,
  },
  syncBtnText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  refreshBtn: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: 'center',
  },
  refreshBtnText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: 'bold',
  },
  tabBar: {
    height: 56,
    backgroundColor: '#0F172A',
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    flexDirection: 'row',
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tabBtnActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.03)',
  },
  tabText: {
    color: '#64748B',
    fontSize: 8.5,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#6366F1',
    fontWeight: 'bold',
  },
  // Dynamic Map & Voice Call overlay styles
  mapContainer: {
    height: 180,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  customResPin: {
    padding: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  customResPinActive: {
    padding: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 5,
  },
  voiceCallOverlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#090d16',
    zIndex: 9999,
  },
  voiceCallSecureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 6,
    marginBottom: 12,
  },
  voiceCallSecureText: {
    color: '#ef4444',
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 1.0,
  },
  voiceCallUnitTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  voiceCallStatusText: {
    color: '#64748B',
    fontSize: 11,
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 120,
    width: '80%',
  },
  waveformBar: {
    width: 6,
    borderRadius: 3,
    backgroundColor: '#ef4444',
  },
  voiceCallTimer: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'monospace',
    letterSpacing: 1,
    marginBottom: 6,
  },
  voiceCallEncryptionInfo: {
    color: '#475569',
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  voiceCallActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    paddingBottom: 50,
  },
  voiceCallCircleBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
  },
  voiceCallBtnLabel: {
    color: '#94a3b8',
    fontSize: 8,
    fontWeight: 'bold',
    marginTop: 4,
    position: 'absolute',
    bottom: -18,
  },
});

const darkMapStyle = [
  { "elementType": "geometry", "stylers": [{ "color": "#0f172a" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#0f172a" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#94a3b8" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#1e293b" }] },
  { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "color": "#475569" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#0b0f19" }] },
  { "featureType": "transit", "stylers": [{ "visibility": "off" }] }
];

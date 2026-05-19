'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { CrisisEvent, ResourceUnit, TrafficAction, FusedSignal } from '@/lib/types';

interface CrisisMapProps {
  crises: CrisisEvent[];
  resources: ResourceUnit[];
  trafficActions: TrafficAction[];
  signals: FusedSignal[];
  onManualDispatch?: (updatedState: any) => void;
  // Tab control — owned by CrisisMap as structural header
  activeTab?: 'map' | 'timeline' | 'trace';
  onTabChange?: (tab: 'map' | 'timeline' | 'trace') => void;
  // Panel visibility toggles
  leftOpen?: boolean;
  rightOpen?: boolean;
  onToggleLeft?: () => void;
  onToggleRight?: () => void;
}

const CRISIS_ICONS: Record<string, string> = {
  fire: '🔥', flood: '🌊', accident: '🚗', heatwave: '☀️',
  power_outage: '⚡', protest: '📢', robbery: '🚨',
  infrastructure_failure: '🏗️', unknown: '❓',
};

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: '#ff3333', HIGH: '#ff7700', MEDIUM: '#ffaa00', LOW: '#00ff66',
};

const RESOURCE_EMOJIS: Record<string, string> = {
  ambulance: '🚑', police: '🚔', fire_unit: '🚒', rescue: '🚁', utility: '🔧',
};

const RESOURCE_COLORS: Record<string, string> = {
  ambulance: '#ff3333', police: '#0088ff', fire_unit: '#ffaa00', rescue: '#a855f7', utility: '#00ff66',
};

// Karachi key locations for routing simulation
const KARACHI_COORDS: Record<string, [number, number]> = {
  'Saddar':            [24.8607, 67.0104],
  'Clifton':           [24.8116, 67.0295],
  'DHA':               [24.7921, 67.0611],
  'Gulshan-e-Iqbal':   [24.9213, 67.0944],
  'North Nazimabad':   [24.9480, 67.0433],
  'Korangi':           [24.8282, 67.1267],
  'Lyari':             [24.8611, 66.9928],
  'Malir':             [24.8915, 67.2019],
  'Tariq Road':        [24.8672, 67.0529],
  'Shahrah-e-Faisal':  [24.8714, 67.0572],
  'NIPA':              [24.9195, 67.0811],
  'Keamari':           [24.8116, 66.9838],
  'Defence View':      [24.8500, 67.0600],
};

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

interface MovingResource {
  unit: ResourceUnit;
  startLat: number; startLng: number;
  endLat: number;   endLng: number;
  progress: number; // 0→1
  etaMs: number;    // total travel time in ms
  startedAt: number;
  targetCrisis?: CrisisEvent;
  marker?: google.maps.Marker;
  label?: google.maps.InfoWindow;
  routePath?: google.maps.LatLng[]; // Actual Google Maps road route path
  polyline?: google.maps.Polyline;   // Dashboard route line
}

export default function CrisisMap({ crises, resources, trafficActions, signals, onManualDispatch, activeTab = 'map', onTabChange, leftOpen, rightOpen, onToggleLeft, onToggleRight }: CrisisMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const crisisMarkers = useRef<google.maps.Marker[]>([]);
  const crisisCircles = useRef<google.maps.Circle[]>([]);
  const movingRefs = useRef<Map<string, MovingResource>>(new Map());
  const availableMarkers = useRef<google.maps.Marker[]>([]);
  const animFrame = useRef<number>(0);
  const trafficLayerRef = useRef<google.maps.TrafficLayer | null>(null);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [showTraffic, setShowTraffic] = useState(true);
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
  const [etaDisplay, setEtaDisplay] = useState<Record<string, number>>({});
  const [legendOpen, setLegendOpen] = useState(false);

  // ── Map init ────────────────────────────────────────────────
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
    if (!apiKey || apiKey === 'your_google_maps_api_key_here') { setMapError(true); return; }
    if ((window as any).google?.maps) { initMap(); return; }
    
    // Detect if Google Maps script is already active in the document head (prevents double imports on hot-reloading)
    const existingScript = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
    if (existingScript) {
      existingScript.addEventListener('load', initMap);
      existingScript.addEventListener('error', () => setMapError(true));
      return;
    }

    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry`;
    s.async = true; s.onload = initMap; s.onerror = () => setMapError(true);
    document.head.appendChild(s);
  }, []);

  function initMap() {
    if (!mapRef.current || mapInstance.current) return;
    try {
      const map = new google.maps.Map(mapRef.current, {
        center: { lat: 24.8607, lng: 67.0011 }, zoom: 12,
        styles: darkMapStyles, 
        disableDefaultUI: true, // Turns off all default Google Maps controls
      });
      mapInstance.current = map;
      const tl = new google.maps.TrafficLayer();
      tl.setMap(map);
      trafficLayerRef.current = tl;
      setMapLoaded(true);
    } catch { setMapError(true); }
  }

  // ── Crisis markers ───────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded || !mapInstance.current) return;
    crisisMarkers.current.forEach(m => m.setMap(null));
    crisisCircles.current.forEach(c => c.setMap(null));
    crisisMarkers.current = []; crisisCircles.current = [];
    const map = mapInstance.current;

    for (const c of crises.filter(x => x.lat && x.lng && x.status === 'active')) {
      const col = SEVERITY_COLORS[c.severity] || '#64748b';
      crisisCircles.current.push(new google.maps.Circle({
        map, center: { lat: c.lat!, lng: c.lng! },
        radius: c.affected_radius_km * 1000,
        strokeColor: col, strokeOpacity: 0.85, strokeWeight: 1.5,
        fillColor: col, fillOpacity: 0.05,
      }));
      const marker = new google.maps.Marker({
        map, position: { lat: c.lat!, lng: c.lng! },
        title: `ID-${c.id.slice(0, 4).toUpperCase()} — ${c.location}`,
        label: { text: CRISIS_ICONS[c.type] || '❓', fontSize: '18px' },
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 22, fillColor: col, fillOpacity: 0.85, strokeColor: '#ffffff', strokeWeight: 2 },
        zIndex: c.severity === 'CRITICAL' ? 100 : 50,
      });
      const iw = new google.maps.InfoWindow({ content: buildCrisisInfoHtml(c) });
      marker.addListener('click', () => iw.open(map, marker));
      crisisMarkers.current.push(marker);
    }
  }, [crises, mapLoaded]);

  // ── Available (Idle) Resources with Manual Dispatch override ──
  useEffect(() => {
    if (!mapLoaded || !mapInstance.current) return;
    availableMarkers.current.forEach(m => m.setMap(null));
    availableMarkers.current = [];
    const map = mapInstance.current;

    const idleUnits = resources.filter(r => r.status === 'available');

    for (const unit of idleUnits) {
      if (!unit.lat || !unit.lng) continue;
      const col = '#52525b'; // Zinc-600 for standby hub resources

      const marker = new google.maps.Marker({
        map, position: { lat: unit.lat, lng: unit.lng },
        label: { text: RESOURCE_EMOJIS[unit.type] || '🚗', fontSize: '12px' },
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 13, fillColor: col, fillOpacity: 0.7, strokeColor: '#cbd5e1', strokeWeight: 2 },
        zIndex: 40,
        title: `${unit.id.toUpperCase()} — Standby at ${unit.location} Hub`,
      });

      const iw = new google.maps.InfoWindow({
        content: buildManualDispatchHtml(unit, crises.filter(c => c.status === 'active')),
      });

      marker.addListener('click', () => {
        iw.open(map, marker);
        // Expose global manual dispatch function for InfoWindow's HTML button
        (window as any).dispatchUnitManually = async (resId: string, crisisId: string) => {
          if (!crisisId) {
            alert('Please select an active target coordinates lock to dispatch asset!');
            return;
          }
          try {
            const res = await fetch('/api/allocate/manual', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ resourceId: resId, crisisId })
            });
            const data = await res.json();
            if (data.success) {
              iw.close();
              if (onManualDispatch) onManualDispatch(data.data);
            } else {
              alert(`Manual dispatch authorization rejected: ${data.error}`);
            }
          } catch (err) {
            alert(`Satellite authorization protocol error: ${err}`);
          }
        };
      });

      availableMarkers.current.push(marker);
    }

    return () => {
      availableMarkers.current.forEach(m => m.setMap(null));
    };
  }, [resources, crises, mapLoaded, onManualDispatch]);

  // ── Moving resource animation & Google Directions Road Routing ──
  const initMovingResources = useCallback(() => {
    if (!mapLoaded || !mapInstance.current) return;
    const map = mapInstance.current;
    const now = Date.now();
    const dispatched = resources.filter(r => r.status === 'dispatched' || r.status === 'en_route');

    for (const unit of dispatched) {
      const existing = movingRefs.current.get(unit.id);
      if (existing) {
        // Maintain latest reference so animation/telemetry checks have fresh data
        existing.unit = unit;
        continue;
      }
      const crisis = crises.find(c => c.id === unit.assigned_crisis_id && c.status === 'active');
      if (!unit.lat || !unit.lng) continue;

      const endCoords = crisis?.lat && crisis?.lng
        ? [crisis.lat, crisis.lng]
        : getCoords(crisis?.location || '');
      if (!endCoords) continue;

      const etaMs = (unit.eta_minutes || 12) * 60 * 1000;
      const col = RESOURCE_COLORS[unit.type] || '#ffaa00';

      const marker = new google.maps.Marker({
        map, position: { lat: unit.lat, lng: unit.lng },
        label: { text: RESOURCE_EMOJIS[unit.type] || '🚗', fontSize: '15px' },
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 15, fillColor: col, fillOpacity: 0.95, strokeColor: '#ffffff', strokeWeight: 2 },
        zIndex: 80,
        title: `${unit.id.toUpperCase()} — ETA: ${unit.eta_minutes || 12}m`,
      });

      const etaLabel = new google.maps.InfoWindow({
        content: buildUnitInfoHtml(unit, unit.eta_minutes || 12),
        disableAutoPan: true,
      });

      marker.addListener('click', () => {
        etaLabel.open(map, marker);
        setSelectedUnit(unit.id);
      });

      // Calculate Traffic-Aware Road Routing via Google Directions Service
      const directionsService = new google.maps.DirectionsService();
      directionsService.route({
        origin: { lat: unit.lat, lng: unit.lng },
        destination: { lat: endCoords[0], lng: endCoords[1] },
        travelMode: google.maps.TravelMode.DRIVING,
        provideRouteAlternatives: false,
      }, (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result && result.routes[0]) {
          const routePath = result.routes[0].overview_path;
          
          // Road route polyline
          const polyline = new google.maps.Polyline({
            map,
            path: routePath,
            strokeColor: '#3b82f6',
            strokeOpacity: 0.8,
            strokeWeight: 3,
            icons: [{
              icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 2, strokeColor: col },
              offset: '0',
              repeat: '18px'
            }]
          });

          const mv = movingRefs.current.get(unit.id);
          if (mv) {
            mv.routePath = routePath;
            mv.polyline = polyline;
          }
        }
      });

      movingRefs.current.set(unit.id, {
        unit, marker, label: etaLabel,
        startLat: unit.lat, startLng: unit.lng,
        endLat: endCoords[0], endLng: endCoords[1],
        progress: 0, etaMs, startedAt: now, targetCrisis: crisis,
      });
    }

    // Remove markers for units no longer dispatched
    for (const [id, mv] of movingRefs.current) {
      if (!dispatched.find(r => r.id === id)) {
        mv.marker?.setMap(null);
        mv.polyline?.setMap(null); // Clear road routing line!
        mv.label?.close();
        movingRefs.current.delete(id);
      }
    }
  }, [resources, crises, mapLoaded]);

  useEffect(() => { initMovingResources(); }, [initMovingResources]);

  // ── Animation loop with snap-to-road navigation snap ─────────
  useEffect(() => {
    if (!mapLoaded) return;
    let running = true;

    const tick = () => {
      if (!running) return;
      const now = Date.now();
      const newEta: Record<string, number> = {};

      for (const [id, mv] of movingRefs.current) {
        const elapsed = now - mv.startedAt;
        let lat: number = mv.startLat;
        let lng: number = mv.startLng;

        // If the latest props (via WebSocket) show coordinate shifts, snap the marker directly
        if (mv.unit && mv.unit.lat !== undefined && mv.unit.lng !== undefined && (mv.unit.lat !== mv.startLat || mv.unit.lng !== mv.startLng)) {
          lat = mv.unit.lat;
          lng = mv.unit.lng;
          
          // Re-calculate local progress based on distance to destination for consistency
          const totalDist = Math.hypot(mv.endLat - mv.startLat, mv.endLng - mv.startLng);
          const remainingDist = Math.hypot(mv.endLat - lat, mv.endLng - lng);
          mv.progress = totalDist > 0 ? Math.min(1, Math.max(0, 1 - (remainingDist / totalDist))) : 1;
        } else {
          // Standard simulated client-side animation fallback
          mv.progress = Math.min(1, elapsed / mv.etaMs);
          lat = lerp(mv.startLat, mv.endLat, mv.progress);
          lng = lerp(mv.startLng, mv.endLng, mv.progress);

          if (mv.routePath && mv.routePath.length > 0) {
            const totalPoints = mv.routePath.length;
            const pointIndex = Math.min(totalPoints - 1, Math.floor(mv.progress * totalPoints));
            const coords = mv.routePath[pointIndex];
            lat = coords.lat();
            lng = coords.lng();
          }
        }

        mv.marker?.setPosition({ lat, lng });

        const remainingMs = Math.max(0, mv.etaMs - elapsed);
        const remainingMin = Math.round(remainingMs / 60000);
        newEta[id] = remainingMin;

        // Proximity indicator when close to incident
        if (mv.progress > 0.85 && mv.marker) {
          const col = RESOURCE_COLORS[mv.unit.type] || '#ffaa00';
          mv.marker.setIcon({
            path: google.maps.SymbolPath.CIRCLE,
            scale: 15,
            fillColor: col, fillOpacity: 0.95,
            strokeColor: '#ffffff', strokeWeight: 2,
          });
        }

        // Target Objective reached
        if (mv.progress >= 1) {
          mv.marker?.setIcon({
            path: google.maps.SymbolPath.CIRCLE,
            scale: 17, fillColor: '#00ff66', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2,
          });
          newEta[id] = 0;
        }
      }

      setEtaDisplay(newEta);
      animFrame.current = requestAnimationFrame(tick);
    };

    animFrame.current = requestAnimationFrame(tick);
    return () => { running = false; cancelAnimationFrame(animFrame.current); };
  }, [mapLoaded]);

  // Traffic layer toggle
  useEffect(() => {
    if (trafficLayerRef.current) {
      trafficLayerRef.current.setMap(showTraffic && mapInstance.current ? mapInstance.current : null);
    }
  }, [showTraffic]);

  const dispatchedUnits = resources.filter(r => r.status === 'dispatched' || r.status === 'en_route' || r.status === 'on_scene');

    return (
      <div className="flex flex-col w-full h-full" style={{ background: '#111113' }}>
        {/* ── MAP AREA — fills remaining height ── */}
        <div className="relative flex-1 min-h-0" style={{ background: '#111113' }}>

          {/* Google Maps base layer */}
          <div ref={mapRef} className="absolute inset-0" />

          {/* Map command overlay controls */}
          <div className="absolute top-3 right-3 z-10 flex flex-col gap-2 select-none font-sans">
            <button onClick={() => setShowTraffic(v => !v)} className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider backdrop-blur-md transition-all border ${showTraffic ? 'bg-[#121214] text-white border-zinc-700' : 'bg-[#09090b]/90 text-zinc-400 border-[#27272a]'}`}>🚦 Traffic</button>
            <button onClick={() => { mapInstance.current?.setCenter({ lat: 24.8607, lng: 67.0011 }); mapInstance.current?.setZoom(12); }} className="px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-[#09090b]/90 text-zinc-300 border border-[#27272a] hover:text-white hover:border-zinc-700 backdrop-blur-md transition-all">🎯 Recenter</button>
          </div>

          {/* Deployed operational assets widget */}
          {dispatchedUnits.length > 0 && (
          <div className="absolute bottom-3 right-3 z-10 hud-panel p-3.5 max-w-[240px] space-y-2.5 bg-[#121214]/95 border-[#27272a] rounded-lg shadow-lg">
            <div className="text-[9.5px] font-bold text-zinc-300 tracking-wider flex items-center gap-2 border-b border-[#27272a] pb-1.5 uppercase select-none font-sans">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              <span>Active Deployments</span>
            </div>
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {dispatchedUnits.slice(0, 8).map(u => {
                const eta = etaDisplay[u.id];
                const arrived = eta === 0;
                const col = RESOURCE_COLORS[u.type] || '#ffaa00';
                const sectorTarget = u.assigned_crisis_id ? `ID-${u.assigned_crisis_id.slice(0, 4).toUpperCase()}` : 'STANDBY';
                return (
                  <div key={u.id} className={`flex items-center gap-2.5 p-1.5 rounded cursor-pointer transition-all border ${selectedUnit === u.id ? 'bg-[#121214] text-zinc-200 border-zinc-700' : 'bg-[#09090b]/40 border-[#27272a]/20 hover:border-[#27272a]'}`} onClick={() => setSelectedUnit(u.id)}>
                    <span className="text-base">{RESOURCE_EMOJIS[u.type]}</span>
                    <div className="flex-1 min-w-0 font-sans">
                      <div className="text-[9px] text-zinc-200 font-bold truncate uppercase">{u.id.replace('ambulance', 'AMB').replace('police', 'POL').replace('fire_unit', 'FIR').replace('rescue', 'RSC').replace('utility', 'UTL')}</div>
                      <div className="text-[7.5px] text-zinc-500 font-semibold truncate">Target: {sectorTarget}</div>
                    </div>
                    <div className="text-right flex-shrink-0 font-sans">
                      {arrived
                        ? <span className="text-[8.5px] text-emerald-400 font-bold tracking-wide">On Scene</span>
                        : eta !== undefined
                          ? <span className="text-[9.5px] font-bold" style={{ color: col }}>{eta}m ETA</span>
                          : <span className="text-[9.5px] text-zinc-600">—</span>
                      }
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          )}

          {/* Incident Legend — bottom-left, panel opens upward (shifted up to clear Google Logo) */}
          <div className="absolute bottom-8 left-3 z-10 flex flex-col-reverse items-start gap-1.5">

            {/* Toggle button */}
            <button
              onClick={() => setLegendOpen(v => !v)}
              className="flex items-center gap-2 px-3.5 py-2 rounded bg-[#1a1a1d]/95 border border-[#2e2e32] text-zinc-300 text-[12px] font-medium hover:bg-[#222226] hover:text-white transition-all shadow-xl backdrop-blur-sm cursor-pointer select-none"
            >
              <span>Incident Legend</span>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className={`transition-transform ${legendOpen ? 'rotate-180' : ''}`}>
                <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {/* Panel — rendered above button via flex-col-reverse */}
            {legendOpen && (
              <div className="bg-[#1a1a1d]/98 border border-[#2e2e32] rounded-lg shadow-2xl p-4 w-[190px] backdrop-blur-sm">

                {/* Severity rows */}
                <div className="space-y-2 mb-3">
                  {[
                    { label: 'CRITICAL (Red)',    color: '#ef4444' },
                    { label: 'HIGH (Amber)',       color: '#f59e0b' },
                    { label: 'MEDIUM (Yellow)',    color: '#eab308' },
                    { label: 'LOW (Green)',        color: '#22c55e' },
                  ].map(({ label, color }) => (
                    <div key={label} className="flex items-center gap-2.5">
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
                      <span className="text-[11px] text-zinc-300 font-medium">{label}</span>
                    </div>
                  ))}
                  <div className="flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-full flex-shrink-0 bg-zinc-500 opacity-70" />
                    <span className="text-[11px] text-zinc-300 font-medium">Standby Unit</span>
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-[#2e2e32] my-2.5" />

                {/* Resource type rows */}
                <div className="space-y-2">
                  {[
                    { icon: '🚑', label: 'Ambulance' },
                    { icon: '👮', label: 'Police' },
                    { icon: '🔥', label: 'Fire Unit' },
                    { icon: '🚁', label: 'Rescue' },
                    { icon: '🔧', label: 'Utility' },
                  ].map(({ icon, label }) => (
                    <div key={label} className="flex items-center gap-2.5">
                      <span className="text-[12px] w-4 text-center">{icon}</span>
                      <span className="text-[11px] text-zinc-300 font-medium">{label}</span>
                    </div>
                  ))}
                </div>

              </div>
            )}
          </div>{/* end legend */}

          {/* Offline Vector Map Fallback Grid */}
          {mapError && <SvgMapFallback crises={crises} resources={resources} etaDisplay={etaDisplay} />}

        </div>
      </div>
  );
}

// ── SvgMapFallback Offline View ────────────────────
function SvgMapFallback({ crises, resources, etaDisplay }: { crises: CrisisEvent[]; resources: ResourceUnit[]; etaDisplay: Record<string,number> }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 200);
    return () => clearInterval(id);
  }, []);

  const active = crises.filter(c => c.status === 'active');
  const dispatched = resources.filter(r => r.status === 'dispatched' || r.status === 'en_route' || r.status === 'on_scene');

  // Map bounds for Karachi (lat: 24.78-24.95, lng: 66.90-67.12)
  const MAP_LAT_MIN = 24.78, MAP_LAT_MAX = 24.96;
  const MAP_LNG_MIN = 66.88, MAP_LNG_MAX = 67.14;

  function toSvg(lat: number, lng: number, W: number, H: number): [number, number] {
    const x = ((lng - MAP_LNG_MIN) / (MAP_LNG_MAX - MAP_LNG_MIN)) * W;
    const y = H - ((lat - MAP_LAT_MIN) / (MAP_LAT_MAX - MAP_LAT_MIN)) * H;
    return [Math.round(x), Math.round(y)];
  }

  // Derive positions from actual lat/lng or fallback grid
  const FALLBACK_GRID: [number, number][] = [
    [24.8607, 67.0011], [24.9200, 66.9900], [24.8400, 67.0500],
    [24.8900, 67.0300], [24.8700, 66.9600], [24.9050, 67.0800],
  ];

  const crisisPositions = active.slice(0, 6).map((c, i) => {
    const lat = c.lat ?? FALLBACK_GRID[i % FALLBACK_GRID.length][0];
    const lng = c.lng ?? FALLBACK_GRID[i % FALLBACK_GRID.length][1];
    return { c, lat, lng };
  });

  const UNIT_STARTS: [number, number][] = [
    [24.830, 66.970], [24.810, 67.020], [24.860, 66.940],
    [24.900, 67.050], [24.940, 66.980], [24.820, 67.080],
  ];

  const unitPositions = dispatched.slice(0, 6).map((u, i) => {
    const cItem = crisisPositions.find(cp => cp.c.id === u.assigned_crisis_id);
    const targetLat = cItem?.lat ?? FALLBACK_GRID[0][0];
    const targetLng = cItem?.lng ?? FALLBACK_GRID[0][1];
    const startLat = UNIT_STARTS[i % UNIT_STARTS.length][0];
    const startLng = UNIT_STARTS[i % UNIT_STARTS.length][1];
    const prog = Math.min(1, (tick * 0.004) / (u.eta_minutes || 12));
    return {
      lat: lerp(startLat, targetLat, prog),
      lng: lerp(startLng, targetLng, prog),
      startLat, startLng, targetLat, targetLng,
      unit: u, prog,
    };
  });

  const W = 800, H = 520;

  // Street grid lines (approximating Karachi road network)
  const H_ROADS = [24.800, 24.820, 24.840, 24.860, 24.880, 24.900, 24.920, 24.940];
  const V_ROADS = [66.910, 66.940, 66.970, 67.000, 67.030, 67.060, 67.090, 67.120];

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: '#111113' }}>
      {/* Status banner */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-3 py-1.5 rounded bg-[#1a1a1d]/90 border border-[#27272a] text-[10px] text-zinc-400 font-mono select-none">
        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping flex-shrink-0" />
        <span>📍 OFFLINE INCIDENT GRID (SATELLITE LINK ACTIVE)</span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%" height="100%"
        preserveAspectRatio="xMidYMid slice"
        style={{ display: 'block' }}
      >
        {/* Dark background */}
        <rect width={W} height={H} fill="#111113" />

        {/* Water / sea area at bottom */}
        <rect x={0} y={H * 0.82} width={W} height={H * 0.18} fill="#0d1117" />
        <text x={W / 2} y={H * 0.91} textAnchor="middle" fill="rgba(255,255,255,0.12)" fontSize="11" fontWeight="bold" letterSpacing="0.15em">Arabian Sea Sector</text>

        {/* Horizontal road grid */}
        {H_ROADS.map(lat => {
          const [, y] = toSvg(lat, MAP_LNG_MIN, W, H);
          return <line key={`h${lat}`} x1={0} y1={y} x2={W} y2={y} stroke="rgba(255,255,255,0.07)" strokeWidth="0.8" />;
        })}

        {/* Vertical road grid */}
        {V_ROADS.map(lng => {
          const [x] = toSvg(MAP_LAT_MIN, lng, W, H);
          return <line key={`v${lng}`} x1={x} y1={0} x2={x} y2={H} stroke="rgba(255,255,255,0.07)" strokeWidth="0.8" />;
        })}

        {/* Major roads */}
        {[24.860, 24.900].map(lat => {
          const [, y] = toSvg(lat, MAP_LNG_MIN, W, H);
          return <line key={`mh${lat}`} x1={0} y1={y} x2={W} y2={y} stroke="rgba(255,255,255,0.13)" strokeWidth="1.5" />;
        })}
        {[67.000, 66.960].map(lng => {
          const [x] = toSvg(MAP_LAT_MIN, lng, W, H);
          return <line key={`mv${lng}`} x1={x} y1={0} x2={x} y2={H} stroke="rgba(255,255,255,0.13)" strokeWidth="1.5" />;
        })}

        {/* Route lines from units to their targets */}
        {unitPositions.map(({ lat, lng, targetLat, targetLng, unit }, i) => {
          const [ux, uy] = toSvg(lat, lng, W, H);
          const [tx, ty] = toSvg(targetLat, targetLng, W, H);
          const col = RESOURCE_COLORS[unit.type] || '#ffaa00';
          return (
            <line key={`route-${i}`} x1={ux} y1={uy} x2={tx} y2={ty}
              stroke={col} strokeWidth="1.2" strokeDasharray="5,4" opacity="0.55" />
          );
        })}

        {/* Crisis incident markers */}
        {crisisPositions.map(({ c, lat, lng }, i) => {
          const [x, y] = toSvg(lat, lng, W, H);
          const col = SEVERITY_COLORS[c.severity] || '#64748b';
          const pulsing = Math.sin(tick * 0.35 + i) > 0;
          const targetId = c.id.slice(0, 4).toUpperCase();
          const r1 = c.severity === 'CRITICAL' ? 22 : c.severity === 'HIGH' ? 18 : 14;
          const r2 = c.severity === 'CRITICAL' ? 11 : c.severity === 'HIGH' ? 9 : 7;
          return (
            <g key={c.id}>
              <circle cx={x} cy={y} r={pulsing ? r1 + 4 : r1} fill="none" stroke={col} opacity="0.35" strokeWidth="1" strokeDasharray="5,4" />
              <circle cx={x} cy={y} r={r1} fill="none" stroke={col} opacity="0.5" strokeWidth="0.8" />
              <circle cx={x} cy={y} r={r2} fill={col} opacity="0.9" />
              <circle cx={x} cy={y} r={r2} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.2" />
              <text x={x + 14} y={y - r2 - 2} fontSize="7" fill={col} fontWeight="bold" fontFamily="monospace">{c.severity}</text>
              <text x={x} y={y + r2 + 10} textAnchor="middle" fontSize="7.5" fill="#cbd5e1" fontWeight="bold" fontFamily="monospace">ID-{targetId}</text>
              <line x1={x - r1 - 4} y1={y} x2={x - r2 - 2} y2={y} stroke={col} strokeWidth="0.8" opacity="0.6" />
              <line x1={x + r2 + 2} y1={y} x2={x + r1 + 4} y2={y} stroke={col} strokeWidth="0.8" opacity="0.6" />
            </g>
          );
        })}

        {/* Dispatched unit markers */}
        {unitPositions.map(({ lat, lng, unit, prog }) => {
          const [x, y] = toSvg(lat, lng, W, H);
          const col = RESOURCE_COLORS[unit.type] || '#ffaa00';
          const eta = etaDisplay[unit.id];
          const arrived = prog >= 1;
          return (
            <g key={unit.id}>
              <circle cx={x} cy={y} r={7} fill={arrived ? '#10b981' : '#1a1a1d'} stroke={arrived ? '#10b981' : col} strokeWidth="1.5" opacity="0.95" />
              <text x={x} y={y + 3} textAnchor="middle" fontSize="7">{RESOURCE_EMOJIS[unit.type]}</text>
              {eta !== undefined && eta > 0 && (
                <text x={x} y={y - 11} textAnchor="middle" fontSize="6.5" fill={col} fontWeight="bold" fontFamily="monospace">{eta}m ETA</text>
              )}
              {arrived && <text x={x} y={y - 11} textAnchor="middle" fontSize="6" fill="#10b981" fontWeight="bold">On Scene</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function getCoords(location: string): [number, number] | null {
  for (const [k, v] of Object.entries(KARACHI_COORDS)) {
    if (location.toLowerCase().includes(k.toLowerCase())) return v;
  }
  return [24.8607, 67.0011];
}

function buildCrisisInfoHtml(c: CrisisEvent) {
  const col = SEVERITY_COLORS[c.severity] || '#64748b';
  const targetId = c.id.slice(0, 4).toUpperCase();
  return `<div style="background:#09090b;color:#f4f4f5;padding:12px;border-radius:6px;min-width:240px;font-family:system-ui, -apple-system, sans-serif;border:1px solid #27272a;box-shadow:0 8px 24px rgba(0,0,0,0.5)">
    <div style="font-size:9px;color:${col};text-transform:uppercase;letter-spacing:0.05em;font-weight:700;margin-bottom:4px">Incident ID: ${targetId} · Severity: ${c.severity}</div>
    <div style="font-size:12px;font-weight:800;margin:6px 0;color:#fff;">📍 Location: ${c.location}</div>
    <div style="font-size:10px;color:#a1a1aa;margin-bottom:8px;line-height:1.4">${c.description?.slice(0,140) || ''}</div>
    <div style="display:grid;grid-template-cols:1fr 1fr;gap:6px;font-size:9.5px;color:#a1a1aa;border-top:1px solid #27272a;padding-top:8px">
      <span>Confidence: <b style="color:#f4f4f5">${(c.confidence*100).toFixed(0)}%</b></span>
      <span>Impact Area: <b style="color:#f4f4f5">${c.affected_radius_km} km</b></span>
      <span>Est. Duration: <b style="color:#f4f4f5">${c.expected_duration_hours}h</b></span>
      ${c.escalation_probability !== undefined ? `<span>Escalation Risk: <b style="color:#ffaa00">${(c.escalation_probability*100).toFixed(0)}%</b></span>` : ''}
    </div>
  </div>`;
}

function buildUnitInfoHtml(u: ResourceUnit, eta: number) {
  const col = RESOURCE_COLORS[u.type] || '#ffaa00';
  const shortId = u.id.replace('ambulance', 'AMB').replace('police', 'POL').replace('fire_unit', 'FIR').replace('rescue', 'RSC').replace('utility', 'UTL').toUpperCase();
  return `<div style="background:#09090b;color:#f4f4f5;padding:10px;border-radius:6px;min-width:180px;font-family:system-ui, -apple-system, sans-serif;border:1px solid #27272a;box-shadow:0 8px 24px rgba(0,0,0,0.5)">
    <div style="font-size:10px;font-weight:800;color:#fff">${RESOURCE_EMOJIS[u.type]} Unit ${shortId}</div>
    <div style="font-size:8.5px;color:#a1a1aa;margin:4px 0 6px 0">Type: ${u.type.toUpperCase()} · Location: ${u.location}</div>
    <div style="font-size:11px;color:${col};font-weight:800;">ETA: ${eta} Min</div>
    <div style="font-size:9px;color:#a1a1aa;margin-top:2px">Status: ${u.status.replace('_', ' ')}</div>
  </div>`;
}

function buildManualDispatchHtml(u: ResourceUnit, activeCrises: CrisisEvent[]) {
  const shortId = u.id.replace('ambulance', 'AMB').replace('police', 'POL').replace('fire_unit', 'FIR').replace('rescue', 'RSC').replace('utility', 'UTL').toUpperCase();
  const optionsHtml = activeCrises.map(c => {
    const targetId = c.id.slice(0, 4).toUpperCase();
    return `<option value="${c.id}" style="color:#000;">ID-${targetId} · ${c.type.toUpperCase()} at ${c.location}</option>`;
  }).join('');

  return `<div style="background:#09090b;color:#f4f4f5;padding:12px;border-radius:6px;min-width:260px;font-family:system-ui, -apple-system, sans-serif;border:1px solid #27272a;box-shadow:0 8px 24px rgba(0,0,0,0.5)">
    <div style="font-size:11px;font-weight:800;color:#fff;display:flex;align-items:center;gap:6px">
      <span style="width:6px;height:6px;border-radius:50%;background:#10b981;display:inline-block;"></span>
      Unit ${shortId} (Standby)
    </div>
    <div style="font-size:8.5px;color:#a1a1aa;margin:4px 0 10px 0">Hub Location: ${u.location}</div>
    
    <div>
      <label style="font-size:9px;color:#a1a1aa;display:block;margin-bottom:6px;font-weight:700;">Manual Dispatch Override:</label>
      ${activeCrises.length === 0 
        ? `<div style="font-size:9px;color:#f43f5e;font-style:italic;margin-bottom:6px">No active validated incidents to dispatch to.</div>`
        : `<select id="manual_crisis_select_${u.id}" style="width:100%;background:#18181b;color:#f4f4f5;border:1px solid #27272a;border-radius:4px;padding:5px;font-size:10px;margin-bottom:8px;outline:none;">
            <option value="" style="color:#000;">-- Select Incident Target --</option>
            ${optionsHtml}
           </select>
           <button onclick="window.dispatchUnitManually('${u.id}', document.getElementById('manual_crisis_select_${u.id}').value)" style="width:100%;background:#f4f4f5;color:#09090b;border:none;border-radius:4px;padding:6px;font-size:10px;font-weight:700;cursor:pointer;transition:all 0.2s;">
             Authorize Dispatch
           </button>`
      }
    </div>
  </div>`;
}

const darkMapStyles: google.maps.MapTypeStyle[] = [
  { elementType:'geometry', stylers:[{color:'#09090b'}] },
  { elementType:'labels.text.stroke', stylers:[{color:'#09090b'}] },
  { elementType:'labels.text.fill', stylers:[{color:'#e4e4e7'}] },
  { featureType:'road', elementType:'geometry', stylers:[{color:'#18181b'}] },
  { featureType:'road', elementType:'labels.text.fill', stylers:[{color:'#71717a'}] },
  { featureType:'road.highway', elementType:'geometry', stylers:[{color:'#27272a'}] },
  { featureType:'water', elementType:'geometry', stylers:[{color:'#09090b'}] },
  { featureType:'poi', elementType:'labels', stylers:[{visibility:'off'}] },
];

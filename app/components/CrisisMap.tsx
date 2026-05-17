'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { CrisisEvent, ResourceUnit, TrafficAction, FusedSignal } from '@/lib/types';

interface CrisisMapProps {
  crises: CrisisEvent[];
  resources: ResourceUnit[];
  trafficActions: TrafficAction[];
  signals: FusedSignal[];
  onManualDispatch?: (updatedState: any) => void;
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

export default function CrisisMap({ crises, resources, trafficActions, signals, onManualDispatch }: CrisisMapProps) {
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
        styles: darkMapStyles, mapTypeControl: false, streetViewControl: false, fullscreenControl: true,
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
      const col = '#475569'; // High-tech slate grey for standby hub resources

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
      if (movingRefs.current.has(unit.id)) continue; // already animating
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
        mv.progress = Math.min(1, elapsed / mv.etaMs);

        // Snap to road path steps if Directions route exists, otherwise straight line lerp
        let lat = lerp(mv.startLat, mv.endLat, mv.progress);
        let lng = lerp(mv.startLng, mv.endLng, mv.progress);

        if (mv.routePath && mv.routePath.length > 0) {
          const totalPoints = mv.routePath.length;
          const pointIndex = Math.min(totalPoints - 1, Math.floor(mv.progress * totalPoints));
          const coords = mv.routePath[pointIndex];
          lat = coords.lat();
          lng = coords.lng();
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
      <div className="relative w-full h-full" style={{ background: '#09090b' }}>
        
        {/* Map command overlay controls */}
        <div className="absolute top-3 right-3 z-10 flex flex-col gap-2 select-none font-sans">
          <button onClick={() => setShowTraffic(v => !v)} className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider backdrop-blur-md transition-all border ${showTraffic ? 'bg-zinc-800 text-white border-zinc-700' : 'bg-zinc-900/90 text-zinc-400 border-zinc-800'}`}>🚦 Traffic Layer</button>
          <button onClick={() => { mapInstance.current?.setCenter({ lat: 24.8607, lng: 67.0011 }); mapInstance.current?.setZoom(12); }} className="px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-[#09090b]/90 text-zinc-300 border border-zinc-800 hover:text-white hover:border-zinc-700 backdrop-blur-md transition-all">🎯 Recenter Map</button>
        </div>
  
        {/* Roadblocks logs overlay */}
        {trafficActions.filter(a => a.action === 'block').length > 0 && (
          <div className="absolute top-3 left-3 z-10 p-3.5 max-w-xs bg-zinc-950/95 border border-red-500/30 rounded-lg font-sans shadow-lg">
            <div className="text-[10px] font-bold text-red-400 mb-2 tracking-wider flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span>🚫 Active Roadblocks ({trafficActions.filter(a => a.action === 'block').length})</span>
            </div>
            <div className="space-y-2 pr-1 max-h-48 overflow-y-auto">
              {trafficActions.filter(a => a.action === 'block').map((ta, i) => (
                <div key={i} className="text-[9.5px] text-zinc-300 border-b border-zinc-800/60 pb-1.5 last:border-0 last:pb-0">
                  <span className="text-red-400 font-semibold">● Closed Area:</span> {ta.area}
                  {ta.alternative_route && <span className="text-emerald-400 block mt-0.5 font-semibold">↳ Detour: {ta.alternative_route}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
  
        {/* Deployed operational assets widget */}
        {dispatchedUnits.length > 0 && (
          <div className="absolute bottom-3 right-3 z-10 hud-panel p-3.5 max-w-[240px] space-y-2.5 bg-zinc-950/95 border-zinc-800 rounded-lg shadow-lg">
            <div className="text-[9.5px] font-bold text-zinc-300 tracking-wider flex items-center gap-2 border-b border-zinc-800 pb-1.5 uppercase select-none font-sans">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-ping" />
              <span>Active Deployments</span>
            </div>
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {dispatchedUnits.slice(0, 8).map(u => {
                const eta = etaDisplay[u.id];
                const arrived = eta === 0;
                const col = RESOURCE_COLORS[u.type] || '#ffaa00';
                const sectorTarget = u.assigned_crisis_id ? `ID-${u.assigned_crisis_id.slice(0, 4).toUpperCase()}` : 'STANDBY';
                return (
                  <div key={u.id} className={`flex items-center gap-2.5 p-1.5 rounded cursor-pointer transition-all border border-zinc-800/20 ${selectedUnit === u.id ? 'bg-zinc-800 text-zinc-200 border-zinc-700' : 'bg-zinc-900/40 hover:border-zinc-800'}`} onClick={() => setSelectedUnit(u.id)}>
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
  
        {/* Incident legend card */}
        <div className="absolute bottom-3 left-3 z-10 hud-panel p-3.5 space-y-2.5 bg-zinc-950/95 max-w-[200px] border-zinc-800 rounded-lg shadow-lg">
          <div className="text-[9.5px] font-bold text-zinc-500 border-b border-zinc-800 pb-1.5 uppercase select-none tracking-wider font-sans">Incident Legend</div>
          <div className="space-y-1.5 font-sans">
            {Object.entries(SEVERITY_COLORS).map(([s, col]) => (
              <div key={s} className="flex items-center gap-2 text-[9.5px]">
                <span className="w-2 h-2 rounded-sm" style={{ background: col, border: '1px solid rgba(255,255,255,0.2)' }} />
                <span className="text-zinc-400 font-semibold">{s}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 text-[9.5px]">
              <span className="w-2 h-2 rounded-sm bg-zinc-600 opacity-60 border border-zinc-500" />
              <span className="text-zinc-400 font-semibold">Standby Unit</span>
            </div>
          </div>
          <div className="border-t border-zinc-800 pt-2 space-y-1.5 select-none font-sans">
            {Object.entries(RESOURCE_EMOJIS).map(([type, icon]) => (
              <div key={type} className="flex items-center gap-2 text-[9.5px] font-semibold text-zinc-500">
                <span>{icon}</span>
                <span className="capitalize">{type.replace('_', ' ')}</span>
              </div>
            ))}
          </div>
        </div>

      {/* Google Maps div */}
      <div ref={mapRef} className="w-full h-full" />

      {/* Offline Vector Map Fallback Grid */}
      {mapError && <SvgMapFallback crises={crises} resources={resources} etaDisplay={etaDisplay} />}
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
  const dispatched = resources.filter(r => r.status === 'dispatched' || r.status === 'on_scene');

  const crisisPositions = active.slice(0, 6).map((_, i) => ({ x: 80 + (i % 3) * 110, y: 70 + Math.floor(i / 3) * 100 }));
  const unitPositions = dispatched.slice(0, 6).map((u, i) => {
    const cIdx = active.findIndex(c => c.id === u.assigned_crisis_id);
    const target = cIdx >= 0 ? crisisPositions[cIdx] : { x: 200, y: 130 };
    const start = { x: 30 + i * 55, y: 200 };
    const prog = Math.min(1, (tick * 200) / ((u.eta_minutes || 12) * 60 * 1000 / 10));
    return { x: lerp(start.x, target.x, prog), y: lerp(start.y, target.y, prog), unit: u, prog };
  });

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-start bg-[#09090b] p-4 overflow-auto font-sans">
      <div className="text-[10px] text-zinc-400 mb-2 text-center uppercase tracking-wider font-semibold flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
        <span>📍 Offline Incident Grid (Satellite Link Active)</span>
      </div>
      <div className="w-full max-w-lg">
        <svg viewBox="0 0 400 280" className="w-full rounded border border-zinc-800" style={{ background: '#09090b' }}>
          {/* Subtle Grid lines */}
          {[60,120,180,240,300,360].map(x => <line key={x} x1={x} y1="0" x2={x} y2="280" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5"/>)}
          {[40,80,120,160,200,240].map(y => <line key={y} x1="0" y1={y} x2="400" y2={y} stroke="rgba(255,255,255,0.03)" strokeWidth="0.5"/>)}
          {/* Radar Circles */}
          <circle cx="200" cy="140" r="50" fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="1" strokeDasharray="3,3" />
          <circle cx="200" cy="140" r="100" fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="1" />
          {/* Shoreline */}
          <rect x="0" y="240" width="400" height="40" fill="rgba(255,255,255,0.01)" stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>
          <text x="200" y="262" textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="8" fontWeight="bold" letterSpacing="0.1em">Arabian Sea Sector</text>
          
          {/* Radar validated objectives */}
          {active.slice(0, 6).map((c, i) => {
            const pos = crisisPositions[i];
            const col = SEVERITY_COLORS[c.severity] || '#64748b';
            const pulse = Math.sin(tick * 0.4 + i) > 0;
            const targetId = c.id.slice(0, 4).toUpperCase();
            return (
              <g key={c.id}>
                {/* Locking Bracket indicators */}
                <circle cx={pos.x} cy={pos.y} r={pulse ? 18 : 15} fill="none" stroke={col} opacity="0.4" strokeWidth="0.8" strokeDasharray="4,4"/>
                <circle cx={pos.x} cy={pos.y} r="8" fill={col} opacity="0.8" stroke="#ffffff" strokeWidth="1.2"/>
                <text x={pos.x} y={pos.y+3} textAnchor="middle" fontSize="9" fill="white">{CRISIS_ICONS[c.type]}</text>
                
                {/* Target Locks Coordinates */}
                <text x={pos.x} y={pos.y+20} textAnchor="middle" fontSize="6.5" fill="#cbd5e1" fontWeight="bold">ID-{targetId}</text>
                <text x={pos.x+10} y={pos.y-8} fontSize="5.5" fill={col} fontWeight="bold">{c.severity}</text>
              </g>
            );
          })}
          
          {/* Active units telemetry march */}
          {unitPositions.map(({ x, y, unit, prog }) => {
            const col = RESOURCE_COLORS[unit.type] || '#ffaa00';
            const eta = etaDisplay[unit.id];
            const arrived = prog >= 1;
            return (
              <g key={unit.id}>
                <circle cx={x} cy={y} r={arrived ? 8 : 6.5} fill={arrived ? '#10b981' : col} opacity="0.95" stroke="#ffffff" strokeWidth="1.2"/>
                <text x={x} y={y+2} textAnchor="middle" fontSize="6.5">{RESOURCE_EMOJIS[unit.type]}</text>
                {eta !== undefined && eta > 0 && (
                  <text x={x} y={y-10} textAnchor="middle" fontSize="6" fill={col} fontWeight="bold">{eta}m ETA</text>
                )}
                {arrived && <text x={x} y={y-10} textAnchor="middle" fontSize="5.5" fill="#10b981" fontWeight="bold">On Scene</text>}
              </g>
            );
          })}
          
          {/* Marched vector routes */}
          {unitPositions.map(({ x, y, unit, prog }, i) => {
            const cIdx = active.findIndex(c => c.id === unit.assigned_crisis_id);
            if (cIdx < 0) return null;
            const target = crisisPositions[cIdx];
            return (
              <line key={`route-${i}`} x1={x} y1={y} x2={target.x} y2={target.y}
                stroke="#475569" strokeWidth="1" strokeDasharray="2,3" opacity="0.6"/>
            );
          })}
        </svg>

        {/* Dynamic status list */}
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          {dispatched.slice(0, 6).map(u => {
            const eta = etaDisplay[u.id];
            return (
              <div key={u.id} className="flex items-center gap-2.5 p-2 rounded border border-zinc-800 bg-[#09090b] text-[9.5px]">
                <span>{RESOURCE_EMOJIS[u.type]}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-zinc-200 font-bold truncate uppercase">{u.id.replace('ambulance', 'AMB').replace('police', 'POL').replace('fire_unit', 'FIR').replace('rescue', 'RSC').replace('utility', 'UTL')}</div>
                  <div className="telemetry-bar mt-1.5">
                    <div className="telemetry-fill" style={{ width: `${Math.min(100, (1 - (eta || 0) / (u.eta_minutes || 12)) * 100)}%`, background: RESOURCE_COLORS[u.type] }}/>
                  </div>
                </div>
                <span className="text-[9.5px] font-bold flex-shrink-0" style={{ color: RESOURCE_COLORS[u.type] }}>
                  {eta === 0 ? 'On Scene' : `${eta ?? '?'}m`}
                </span>
              </div>
            );
          })}
        </div>
      </div>
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

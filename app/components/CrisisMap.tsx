'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { CrisisEvent, ResourceUnit, TrafficAction, FusedSignal } from '@/lib/types';

interface CrisisMapProps {
  crises: CrisisEvent[];
  resources: ResourceUnit[];
  trafficActions: TrafficAction[];
  signals: FusedSignal[];
}

const CRISIS_ICONS: Record<string, string> = {
  fire: '🔥', flood: '🌊', accident: '🚗', heatwave: '☀️',
  power_outage: '⚡', protest: '📢', robbery: '🚨',
  infrastructure_failure: '🏗️', unknown: '❓',
};

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: '#ef4444', HIGH: '#f97316', MEDIUM: '#f59e0b', LOW: '#22c55e',
};

const RESOURCE_EMOJIS: Record<string, string> = {
  ambulance: '🚑', police: '🚔', fire_unit: '🚒', rescue: '🚁', utility: '🔧',
};

const RESOURCE_COLORS: Record<string, string> = {
  ambulance: '#ef4444', police: '#3b82f6', fire_unit: '#f97316', rescue: '#a855f7', utility: '#f59e0b',
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

// Moving resource marker state
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
}

export default function CrisisMap({ crises, resources, trafficActions, signals }: CrisisMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const crisisMarkers = useRef<google.maps.Marker[]>([]);
  const crisisCircles = useRef<google.maps.Circle[]>([]);
  const movingRefs = useRef<Map<string, MovingResource>>(new Map());
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
        strokeColor: col, strokeOpacity: 0.7, strokeWeight: 1.5,
        fillColor: col, fillOpacity: 0.08,
      }));
      const marker = new google.maps.Marker({
        map, position: { lat: c.lat!, lng: c.lng! },
        title: `${c.type} — ${c.location}`,
        label: { text: CRISIS_ICONS[c.type] || '❓', fontSize: '20px' },
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 20, fillColor: col, fillOpacity: 0.9, strokeColor: '#fff', strokeWeight: 2 },
        zIndex: c.severity === 'CRITICAL' ? 100 : 50,
      });
      const iw = new google.maps.InfoWindow({ content: buildCrisisInfoHtml(c) });
      marker.addListener('click', () => iw.open(map, marker));
      crisisMarkers.current.push(marker);
    }
  }, [crises, mapLoaded]);

  // ── Moving resource animation ────────────────────────────────
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
      const col = RESOURCE_COLORS[unit.type] || '#f97316';

      const marker = new google.maps.Marker({
        map, position: { lat: unit.lat, lng: unit.lng },
        label: { text: RESOURCE_EMOJIS[unit.type] || '🚗', fontSize: '16px' },
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 14, fillColor: col, fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 },
        zIndex: 80,
        title: `${unit.id} — ETA: ${unit.eta_minutes || 12}min`,
      });

      const etaLabel = new google.maps.InfoWindow({
        content: buildUnitInfoHtml(unit, unit.eta_minutes || 12),
        disableAutoPan: true,
      });

      marker.addListener('click', () => {
        etaLabel.open(map, marker);
        setSelectedUnit(unit.id);
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
        mv.label?.close();
        movingRefs.current.delete(id);
      }
    }
  }, [resources, crises, mapLoaded]);

  useEffect(() => { initMovingResources(); }, [initMovingResources]);

  // ── Animation loop ───────────────────────────────────────────
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

        const lat = lerp(mv.startLat, mv.endLat, mv.progress);
        const lng = lerp(mv.startLng, mv.endLng, mv.progress);
        mv.marker?.setPosition({ lat, lng });

        const remainingMs = Math.max(0, mv.etaMs - elapsed);
        const remainingMin = Math.round(remainingMs / 60000);
        newEta[id] = remainingMin;

        // Pulse effect when close
        if (mv.progress > 0.85 && mv.marker) {
          const col = RESOURCE_COLORS[mv.unit.type] || '#f97316';
          mv.marker.setIcon({
            path: google.maps.SymbolPath.CIRCLE,
            scale: 14 + Math.sin(now / 200) * 3,
            fillColor: col, fillOpacity: 1,
            strokeColor: '#fff', strokeWeight: 2.5,
          });
        }

        // Arrived
        if (mv.progress >= 1) {
          mv.marker?.setIcon({
            path: google.maps.SymbolPath.CIRCLE,
            scale: 16, fillColor: '#22c55e', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2,
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
    <div className="relative w-full h-full" style={{ background: '#0a1628' }}>
      {/* Map controls */}
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-2">
        <button onClick={() => setShowTraffic(v => !v)} className={`px-3 py-1.5 rounded-md text-xs font-medium backdrop-blur-sm transition-all ${showTraffic ? 'bg-blue-600/80 text-white border border-blue-500/50' : 'bg-black/60 text-gray-400 border border-white/10'}`}>🚦 Traffic</button>
        <button onClick={() => { mapInstance.current?.setCenter({ lat: 24.8607, lng: 67.0011 }); mapInstance.current?.setZoom(12); }} className="px-3 py-1.5 rounded-md text-xs bg-black/60 text-gray-400 border border-white/10 hover:text-white backdrop-blur-sm">🎯 Reset</button>
      </div>

      {/* Road blocks overlay */}
      {trafficActions.filter(a => a.action === 'block').length > 0 && (
        <div className="absolute top-3 left-3 z-10 glass-card p-3 max-w-xs">
          <div className="text-xs font-semibold text-red-400 mb-2">🚫 ROAD BLOCKS ({trafficActions.filter(a => a.action === 'block').length})</div>
          {trafficActions.filter(a => a.action === 'block').slice(0, 3).map((ta, i) => (
            <div key={i} className="text-xs text-gray-400 mb-1">
              <span className="text-red-400">●</span> {ta.area}
              {ta.alternative_route && <span className="text-green-400 block ml-3">↳ {ta.alternative_route}</span>}
            </div>
          ))}
        </div>
      )}

      {/* ETA panel — dispatched units */}
      {dispatchedUnits.length > 0 && (
        <div className="absolute bottom-3 right-3 z-10 glass-card p-3 max-w-[220px] space-y-1.5">
          <div className="text-xs font-bold text-white mb-2">🚨 DISPATCHED UNITS</div>
          {dispatchedUnits.slice(0, 8).map(u => {
            const eta = etaDisplay[u.id];
            const arrived = eta === 0;
            const col = RESOURCE_COLORS[u.type] || '#f97316';
            return (
              <div key={u.id} className={`flex items-center gap-2 p-1.5 rounded-lg cursor-pointer transition-all ${selectedUnit === u.id ? 'bg-white/10' : 'hover:bg-white/5'}`} onClick={() => setSelectedUnit(u.id)}>
                <span className="text-sm">{RESOURCE_EMOJIS[u.type]}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-white font-medium truncate">{u.id}</div>
                  <div className="text-xs text-gray-500 truncate">{u.assigned_crisis_id ? 'En route' : u.location}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  {arrived
                    ? <span className="text-xs text-green-400 font-bold">ON SCENE</span>
                    : eta !== undefined
                      ? <span className="text-xs font-bold" style={{ color: col }}>{eta}m</span>
                      : <span className="text-xs text-gray-600">—</span>
                  }
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Severity legend */}
      <div className="absolute bottom-3 left-3 z-10 glass-card p-3 space-y-1">
        <div className="text-xs font-semibold text-gray-500 mb-2">SEVERITY</div>
        {Object.entries(SEVERITY_COLORS).map(([s, col]) => (
          <div key={s} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: col }} />
            <span className="text-gray-400">{s}</span>
          </div>
        ))}
        <div className="border-t border-white/10 mt-2 pt-2 space-y-1">
          {Object.entries(RESOURCE_EMOJIS).map(([type, icon]) => (
            <div key={type} className="flex items-center gap-1.5 text-xs">
              <span>{icon}</span>
              <span className="text-gray-500 capitalize">{type.replace('_', ' ')}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Map div */}
      <div ref={mapRef} className="w-full h-full" />

      {/* SVG fallback */}
      {mapError && <SvgMapFallback crises={crises} resources={resources} etaDisplay={etaDisplay} />}
    </div>
  );
}

// ── SVG fallback with animated resources ────────────────────
function SvgMapFallback({ crises, resources, etaDisplay }: { crises: CrisisEvent[]; resources: ResourceUnit[]; etaDisplay: Record<string,number> }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 200);
    return () => clearInterval(id);
  }, []);

  const active = crises.filter(c => c.status === 'active');
  const dispatched = resources.filter(r => r.status === 'dispatched' || r.status === 'on_scene');

  // Fixed positions for the SVG grid
  const crisisPositions = active.slice(0, 6).map((_, i) => ({ x: 80 + (i % 3) * 110, y: 70 + Math.floor(i / 3) * 100 }));
  const unitPositions = dispatched.slice(0, 6).map((u, i) => {
    const cIdx = active.findIndex(c => c.id === u.assigned_crisis_id);
    const target = cIdx >= 0 ? crisisPositions[cIdx] : { x: 200, y: 130 };
    const start = { x: 30 + i * 55, y: 200 };
    const prog = Math.min(1, (tick * 200) / ((u.eta_minutes || 12) * 60 * 1000 / 10));
    return { x: lerp(start.x, target.x, prog), y: lerp(start.y, target.y, prog), unit: u, prog };
  });

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-start bg-gray-900 p-4 overflow-auto">
      <div className="text-xs text-gray-500 mb-2 text-center">📍 Karachi Emergency Grid (add Google Maps key for live map)</div>
      <div className="w-full max-w-lg">
        <svg viewBox="0 0 400 280" className="w-full rounded-xl border border-white/10" style={{ background: '#0d1b2a' }}>
          {/* Grid */}
          {[60,120,180,240,300,360].map(x => <line key={x} x1={x} y1="0" x2={x} y2="280" stroke="#1e3a5f" strokeWidth="0.4"/>)}
          {[40,80,120,160,200,240].map(y => <line key={y} x1="0" y1={y} x2="400" y2={y} stroke="#1e3a5f" strokeWidth="0.4"/>)}
          {/* Sea */}
          <rect x="0" y="240" width="400" height="40" fill="#0a1628"/>
          <text x="200" y="262" textAnchor="middle" fill="#1e4080" fontSize="9">Arabian Sea</text>
          {/* Crisis markers */}
          {active.slice(0, 6).map((c, i) => {
            const pos = crisisPositions[i];
            const col = SEVERITY_COLORS[c.severity] || '#64748b';
            const pulse = Math.sin(tick * 0.5 + i) > 0;
            return (
              <g key={c.id}>
                <circle cx={pos.x} cy={pos.y} r={pulse ? 22 : 18} fill={col} opacity="0.12"/>
                <circle cx={pos.x} cy={pos.y} r="10" fill={col} opacity="0.9" stroke="white" strokeWidth="1.5"/>
                <text x={pos.x} y={pos.y+4} textAnchor="middle" fontSize="9" fill="white">{CRISIS_ICONS[c.type]}</text>
                <text x={pos.x} y={pos.y+22} textAnchor="middle" fontSize="6" fill="#9ca3af">{c.location}</text>
                <text x={pos.x+12} y={pos.y-10} fontSize="5" fill={col} fontWeight="bold">{c.severity}</text>
              </g>
            );
          })}
          {/* Moving units */}
          {unitPositions.map(({ x, y, unit, prog }) => {
            const col = RESOURCE_COLORS[unit.type] || '#f97316';
            const eta = etaDisplay[unit.id];
            return (
              <g key={unit.id}>
                <circle cx={x} cy={y} r={prog >= 1 ? 9 : 7} fill={prog >= 1 ? '#22c55e' : col} opacity="0.95" stroke="white" strokeWidth="1.2"/>
                <text x={x} y={y+3} textAnchor="middle" fontSize="7">{RESOURCE_EMOJIS[unit.type]}</text>
                {eta !== undefined && eta > 0 && (
                  <text x={x} y={y-12} textAnchor="middle" fontSize="6" fill={col} fontWeight="bold">{eta}m</text>
                )}
                {prog >= 1 && <text x={x} y={y-12} textAnchor="middle" fontSize="6" fill="#22c55e" fontWeight="bold">ON SCENE</text>}
              </g>
            );
          })}
          {/* Route lines */}
          {unitPositions.map(({ x, y, unit, prog }, i) => {
            const cIdx = active.findIndex(c => c.id === unit.assigned_crisis_id);
            if (cIdx < 0) return null;
            const target = crisisPositions[cIdx];
            return (
              <line key={`route-${i}`} x1={x} y1={y} x2={target.x} y2={target.y}
                stroke={RESOURCE_COLORS[unit.type] || '#f97316'} strokeWidth="1" strokeDasharray="4,4" opacity="0.4"/>
            );
          })}
        </svg>

        {/* ETA list below map */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          {dispatched.slice(0, 6).map(u => {
            const eta = etaDisplay[u.id];
            return (
              <div key={u.id} className="flex items-center gap-2 p-2 rounded-lg bg-white/5 border border-white/5">
                <span>{RESOURCE_EMOJIS[u.type]}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-white font-medium truncate">{u.id}</div>
                  <div className="confidence-bar mt-1">
                    <div className="confidence-fill" style={{ width: `${Math.min(100, (1 - (eta || 0) / (u.eta_minutes || 12)) * 100)}%`, background: RESOURCE_COLORS[u.type] }}/>
                  </div>
                </div>
                <span className="text-xs font-bold flex-shrink-0" style={{ color: RESOURCE_COLORS[u.type] }}>
                  {eta === 0 ? '✅' : `${eta ?? '?'}m`}
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
  const col = SEVERITY_COLORS[c.severity];
  return `<div style="background:#111827;color:#fff;padding:12px;border-radius:8px;min-width:220px;font-family:system-ui;border:1px solid ${col}40">
    <div style="font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.08em">${c.severity} · ${c.type.replace('_',' ')}</div>
    <div style="font-size:13px;font-weight:700;margin:4px 0">📍 ${c.location}</div>
    <div style="font-size:11px;color:#9ca3af;margin-bottom:8px">${c.description?.slice(0,120) || ''}</div>
    <div style="display:flex;gap:12px;font-size:11px;color:#6b7280">
      <span>🎯 ${(c.confidence*100).toFixed(0)}% conf</span>
      <span>📏 ${c.affected_radius_km}km</span>
      <span>⏱ ${c.expected_duration_hours}h</span>
    </div>
    ${c.escalation_probability !== undefined ? `<div style="margin-top:6px;font-size:10px;color:#f97316">📈 Escalation: ${(c.escalation_probability*100).toFixed(0)}%</div>` : ''}
  </div>`;
}

function buildUnitInfoHtml(u: ResourceUnit, eta: number) {
  const col = RESOURCE_COLORS[u.type];
  return `<div style="background:#111827;color:#fff;padding:10px;border-radius:8px;min-width:160px;font-family:system-ui;border:1px solid ${col}50">
    <div style="font-size:11px;font-weight:700">${RESOURCE_EMOJIS[u.type]} ${u.id}</div>
    <div style="font-size:10px;color:#9ca3af;margin:3px 0">${u.type.replace('_',' ')} · ${u.location}</div>
    <div style="font-size:12px;color:${col};font-weight:700;margin-top:4px">ETA: ${eta} min</div>
    <div style="font-size:10px;color:#6b7280;margin-top:2px">Status: ${u.status}</div>
  </div>`;
}

const darkMapStyles: google.maps.MapTypeStyle[] = [
  { elementType:'geometry', stylers:[{color:'#0d1b2a'}] },
  { elementType:'labels.text.stroke', stylers:[{color:'#0d1b2a'}] },
  { elementType:'labels.text.fill', stylers:[{color:'#746855'}] },
  { featureType:'road', elementType:'geometry', stylers:[{color:'#38414e'}] },
  { featureType:'road', elementType:'labels.text.fill', stylers:[{color:'#9ca5b3'}] },
  { featureType:'road.highway', elementType:'geometry', stylers:[{color:'#746855'}] },
  { featureType:'water', elementType:'geometry', stylers:[{color:'#0a1628'}] },
  { featureType:'poi', elementType:'labels', stylers:[{visibility:'off'}] },
];

'use client';

import { Truck, Navigation, Battery, Wrench, ShieldCheck } from 'lucide-react';
import type { ResourceUnit, AllocationPlan, CrisisEvent } from '@/lib/types';

interface ResourcePanelProps {
  resources: ResourceUnit[];
  allocations: AllocationPlan[];
  crises: CrisisEvent[];
}

const RESOURCE_ICONS: Record<string, any> = {
  ambulance: Truck,
  police: Navigation,
  fire_unit: ShieldCheck,
  rescue: Wrench,
  utility: Wrench,
};

const STATUS_CONFIGS: Record<string, { label: string; text: string; bg: string; border: string }> = {
  available:  { label: 'STATIONARY', text: '#38bdf8', bg: '#38bdf810', border: '#38bdf840' },
  dispatched: { label: 'EN ROUTE',   text: '#a78bfa', bg: '#a78bfa10', border: '#a78bfa40' },
  en_route:   { label: 'EN ROUTE',   text: '#a78bfa', bg: '#a78bfa10', border: '#a78bfa40' },
  on_scene:   { label: 'ON SCENE',   text: '#f87171', bg: '#f8717110', border: '#f8717140' },
  offline:    { label: 'OFFLINE',    text: '#71717a', bg: '#71717a10', border: '#27272a' },
};

export default function ResourcePanel({ resources, allocations, crises }: ResourcePanelProps) {
  const totalAvailable = resources.filter(r => r.status === 'available').length;
  const totalDispatched = resources.filter(r => r.status === 'dispatched' || r.status === 'on_scene').length;

  return (
    <div className="h-full flex flex-col bg-[#111113] overflow-hidden">
      
      {/* ── SCROLLABLE FEED ── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar">

        {/* Deployments Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 border-b border-[#27272a] pb-2">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest font-mono">Deployed Unit Status</span>
            <span className="px-2 py-0.5 bg-[#27272a] text-zinc-300 border border-zinc-600 text-[9px] font-bold rounded">{resources.length}</span>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {resources.map(unit => {
              const cfg = STATUS_CONFIGS[unit.status] || STATUS_CONFIGS.available;
              const IconComponent = RESOURCE_ICONS[unit.type] || Truck;
              const mockFuel = unit.status === 'available' ? 100 : unit.status === 'on_scene' ? 65 : 82;
              
              return (
                <div 
                  key={unit.id}
                  className="bg-[#1a1a1d] border border-[#27272a] rounded p-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded border border-[#27272a] bg-[#111113] flex items-center justify-center">
                      <IconComponent className="w-3.5 h-3.5" style={{ color: cfg.text }} />
                    </div>
                    <div>
                      <div className="text-[11px] font-bold text-zinc-200 font-mono tracking-wider">
                        {unit.id.replace('ambulance', 'AMB').replace('police', 'POL').replace('fire_unit', 'FIR').replace('rescue', 'RSC').toUpperCase()}
                      </div>
                      <div className="text-[9px] text-zinc-500 font-mono mt-0.5 uppercase">
                        {unit.status === 'available' ? 'Standby Sector' : 'Assigned Op'}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <span 
                      className="px-2 py-0.5 rounded-sm text-[9px] font-bold tracking-widest font-mono border"
                      style={{ color: cfg.text, backgroundColor: cfg.bg, borderColor: cfg.border }}
                    >
                      {cfg.label}
                    </span>
                    <div className="flex items-center gap-1.5 opacity-60">
                      <Battery className="w-3 h-3 text-zinc-500" />
                      <div className="w-10 h-1 bg-[#27272a] rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full bg-zinc-400"
                          style={{ width: `${mockFuel}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Active Dispatch Allocations */}
        {allocations.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 border-b border-[#27272a] pb-2">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest font-mono">Active Allocations</span>
              <span className="px-2 py-0.5 bg-[#27272a] text-zinc-300 border border-zinc-600 text-[9px] font-bold rounded">{allocations.length}</span>
            </div>

            <div className="space-y-2">
              {allocations.slice(0, 5).map((alloc, idx) => {
                const targetId = alloc.crisis_id.slice(0, 4).toUpperCase();
                return (
                  <div 
                    key={`${alloc.crisis_id}-${idx}`}
                    className="bg-[#1a1a1d] border border-[#27272a] rounded p-3 space-y-3 border-l-2 border-l-violet-500"
                  >
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-zinc-300 font-mono">TRG-{targetId}</span>
                        <div className="flex flex-wrap gap-1">
                          {alloc.units.map(u => (
                            <span 
                              key={u.id}
                              className="bg-[#111113] border border-[#27272a] px-1.5 py-0.5 rounded-sm text-[9px] font-mono text-zinc-400"
                            >
                              ⚡ {u.id.toUpperCase().replace('AMBULANCE', 'AMB').replace('POLICE', 'POL').replace('FIRE_UNIT', 'FIR').replace('RESCUE', 'RSC')}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="text-[9px] font-mono font-bold px-2 py-1 bg-[#111113] border border-[#27272a] rounded-sm text-sky-400">
                        ETA: {alloc.total_response_time_minutes}M
                      </div>
                    </div>

                    <div className="bg-[#111113] border border-[#27272a] p-2 rounded text-[10px] font-mono text-zinc-400 italic">
                      "{alloc.reasoning}"
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

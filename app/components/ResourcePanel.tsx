'use client';

import { Truck, Navigation, Battery, Wrench, ShieldCheck, ChevronRight } from 'lucide-react';
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

const RESOURCE_LABELS: Record<string, string> = {
  ambulance: '🚑 Ambulance',
  police: '🚔 Patrol Cruiser',
  fire_unit: '🚒 Fire Engine',
  rescue: '🚁 Rescue Squad',
  utility: '🔧 Utility Truck',
};

const STATUS_CONFIGS: Record<string, { label: string; text: string; bg: string; border: string }> = {
  available: { label: 'STATIONARY', text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/25' },
  dispatched: { label: 'EN ROUTE', text: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/25' },
  en_route: { label: 'EN ROUTE', text: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/25' },
  on_scene: { label: 'ON SCENE', text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/25' },
  offline: { label: 'OFFLINE', text: 'text-zinc-500', bg: 'bg-zinc-800/40', border: 'border-zinc-800' },
};

export default function ResourcePanel({ resources, allocations, crises }: ResourcePanelProps) {
  const totalAvailable = resources.filter(r => r.status === 'available').length;
  const totalDispatched = resources.filter(r => r.status === 'dispatched' || r.status === 'on_scene').length;

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4 bg-[#09090b]">
      
      {/* Metrics Row */}
      <div className="grid grid-cols-4 gap-2 font-mono">
        {[
          { label: 'TOTAL ASSETS', value: resources.length, text: 'text-zinc-300' },
          { label: 'STANDBY', value: totalAvailable, text: 'text-emerald-400' },
          { label: 'ACTIVE', value: totalDispatched, text: 'text-sky-400' },
          { label: 'ALLOCS', value: allocations.length, text: 'text-violet-400' },
        ].map(stat => (
          <div key={stat.label} className="bg-zinc-950 p-2 text-center rounded border border-zinc-850">
            <div className={`text-[13px] font-bold ${stat.text}`}>{stat.value}</div>
            <div className="text-[7.5px] text-zinc-500 mt-1 uppercase tracking-wider font-semibold">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Deployed Unit Status List */}
      <div className="space-y-2">
        <span className="font-mono text-[9px] font-bold text-zinc-500 uppercase tracking-widest block pb-2 border-b border-zinc-850">
          DEPLOYED UNIT STATUS
        </span>

        {resources.map(unit => {
          const cfg = STATUS_CONFIGS[unit.status] || STATUS_CONFIGS.available;
          const IconComponent = RESOURCE_ICONS[unit.type] || Truck;
          const label = RESOURCE_LABELS[unit.type] || 'Emergency Responder';
          
          // Generate realistic mock fuel/battery status metrics
          const mockFuel = unit.status === 'available' ? 100 : unit.status === 'on_scene' ? 65 : 82;
          
          return (
            <div 
              key={unit.id}
              className="bg-zinc-950/20 border border-zinc-850 p-3 rounded flex items-center justify-between hover:border-zinc-800 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center text-sky-400">
                  <IconComponent className="w-4 h-4 text-sky-400 group-hover:scale-110 transition-transform" />
                </div>
                <div>
                  <div className="text-[11px] font-bold text-zinc-200 uppercase truncate max-w-[120px]">
                    {unit.id.replace('ambulance', 'AMB').replace('police', 'POL').replace('fire_unit', 'FIR').replace('rescue', 'RSC')}
                  </div>
                  <div className="font-mono text-[8.5px] text-zinc-500 uppercase tracking-wider mt-0.5">
                    {unit.status === 'available' ? 'Standby Sector' : 'Assigned Operation'}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="flex items-center gap-1.5 justify-end">
                  <span className={`px-1.5 py-0.5 rounded text-[7.5px] font-bold tracking-wider font-mono border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                    {cfg.label}
                  </span>
                </div>
                
                {/* Visual completion meter */}
                <div className="flex items-center gap-1.5 justify-end mt-1.5">
                  <Battery className="w-3 h-3 text-zinc-600" />
                  <div className="w-12 h-1 bg-zinc-900 rounded-full overflow-hidden border border-zinc-850">
                    <div 
                      className={`h-full rounded-full ${
                        mockFuel > 50 ? 'bg-sky-400' : 'bg-amber-400'
                      }`}
                      style={{ width: `${mockFuel}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Manual Dispatch Allocations Section */}
      {allocations.length > 0 && (
        <div className="space-y-2 pt-2">
          <span className="font-mono text-[9px] font-bold text-zinc-500 uppercase tracking-widest block pb-2 border-b border-zinc-850">
            ACTIVE DISPATCH ALLOCATIONS
          </span>

          <div className="space-y-2">
            {allocations.slice(0, 3).map((alloc, idx) => {
              const targetId = alloc.crisis_id.slice(0, 4).toUpperCase();
              return (
                <div 
                  key={`${alloc.crisis_id}-${idx}`}
                  className="bg-zinc-950/20 border border-zinc-850 p-3 rounded space-y-2.5"
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-zinc-300">INCIDENT ID: TRG-{targetId}</span>
                    </div>
                    <span className="text-[9px] font-mono font-bold text-sky-400">
                      ETA: {alloc.total_response_time_minutes} Min
                    </span>
                  </div>

                  {/* Allocated units taglist */}
                  <div className="flex flex-wrap gap-1">
                    {alloc.units.map(u => (
                      <span 
                        key={u.id}
                        className="bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded text-[8px] font-mono text-zinc-400"
                      >
                        ⚡ {u.id.toUpperCase().replace('AMBULANCE', 'AMB').replace('POLICE', 'POL').replace('FIRE_UNIT', 'FIR').replace('RESCUE', 'RSC')}
                      </span>
                    ))}
                  </div>

                  {/* Dispatch reason */}
                  <p className="bg-zinc-950 border border-zinc-800 p-2 rounded text-[9.5px] font-mono text-zinc-400 italic leading-relaxed">
                    <span className="text-[7.5px] text-zinc-500 block font-bold not-italic mb-0.5 uppercase">Dispatch Vector:</span>
                    "{alloc.reasoning}"
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}

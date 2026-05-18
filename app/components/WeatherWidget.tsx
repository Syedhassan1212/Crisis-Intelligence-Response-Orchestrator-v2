'use client';

import type { ResourceUnit, AllocationPlan } from '@/lib/types';

interface WeatherWidgetProps {
  weather?: any; // kept for prop compatibility — display moved to Header
  resources?: ResourceUnit[];
  allocations?: AllocationPlan[];
}

export default function WeatherWidget({ resources = [], allocations = [] }: WeatherWidgetProps) {
  const totalAssets = resources.length;
  const standbyCount = resources.filter(r => r.status === 'available').length;
  const activeCount  = resources.filter(r => ['dispatched', 'en_route', 'on_scene'].includes(r.status)).length;
  const allocsCount  = allocations.length;

  return (
    <div className="flex-shrink-0 bg-[#111113]">
      <div className="px-4 pt-4 pb-2 border-b border-[#27272a]">

        {/* 2×2 stat grid */}
        <div className="grid grid-cols-2 gap-3">
          <StatBox label="Total Assets" value={totalAssets} />
          <StatBox label="Standby"      value={standbyCount} />
          <StatBox label="Active"       value={activeCount}  accent />
          <StatBox label="Allocs"       value={allocsCount}  accent />
        </div>

      </div>
    </div>
  );
}

function StatBox({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="bg-[#1a1a1d] border border-[#27272a] rounded-md p-3.5">
      <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-2">{label}:</div>
      <div className={`text-[38px] font-bold leading-none ${accent ? 'text-emerald-400' : 'text-white'}`}>
        {value}
      </div>
    </div>
  );
}

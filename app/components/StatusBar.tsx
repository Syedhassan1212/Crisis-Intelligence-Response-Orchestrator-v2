'use client';

import { ShieldAlert, AlertTriangle } from 'lucide-react';
import type { CrisisEvent, ResourceUnit, FusedSignal } from '@/lib/types';

const Marquee = 'marquee' as any;

interface StatusBarProps {
  crises: CrisisEvent[];
  resources: ResourceUnit[];
  notifications: any[];
  weather?: any;
}

export default function StatusBar({ crises, resources, notifications }: StatusBarProps) {
  const active = crises.filter(c => c.status === 'active');
  const critical = active.filter(c => c.severity === 'CRITICAL');
  const high = active.filter(c => c.severity === 'HIGH');
  
  const dispatched = resources.filter(r => r.status === 'dispatched' || r.status === 'on_scene');
  const standby = resources.filter(r => r.status === 'available');

  // Compute mock stats dynamic values
  const interceptRate = active.length * 2 + 3;
  const dispatchRatio = `${dispatched.length}/${resources.length}`;
  const systemLoadPercentage = Math.min(Math.round((dispatched.length / (resources.length || 1)) * 100 + 15), 100);

  // Filter or join notifications to form the alert marquee content
  const warningTexts = notifications.length > 0
    ? notifications.map(n => n.message).join('  •  ')
    : 'System Operational Status Nominal  •  Awaiting Telemetry Grid Intercepts  •  Karachi Operations Zone Stable';

  return (
    <div className="h-14 mt-16 bg-[#121214] border-b border-[#27272a] flex items-center px-6 gap-6 relative z-30 select-none">
      
      {/* 1. Left Telemetry Sections */}
      <div className="flex items-center gap-6 border-r border-[#27272a] pr-6">
        
        {/* Intercept Rate */}
        <div className="flex flex-col font-mono">
          <span className="text-[8px] font-semibold text-zinc-500 uppercase tracking-widest leading-none">INTERCEPT RATE</span>
          <span className="text-[12px] font-bold text-emerald-400 mt-1">{interceptRate} Intercepts/Min</span>
        </div>

        {/* Asset Load */}
        <div className="flex flex-col font-mono">
          <span className="text-[8px] font-semibold text-zinc-500 uppercase tracking-widest leading-none">ASSET LOAD</span>
          <span className="text-[12px] font-bold text-amber-500 mt-1">{dispatchRatio} Dispatched</span>
        </div>

      </div>

      {/* 2. System Load Indicator */}
      <div className="flex-1 flex items-center gap-4 px-4 min-w-0">
        <span className="text-[8px] font-mono font-semibold text-zinc-500 uppercase tracking-widest whitespace-nowrap">SYSTEM LOAD</span>
        
        {/* Progress Bar Container */}
        <div className="w-32 h-1.5 bg-[#09090b] rounded-full overflow-hidden flex-shrink-0 border border-[#27272a]">
          <div 
            className="h-full bg-emerald-400 rounded-full transition-all duration-500 ease-in-out" 
            style={{ width: `${systemLoadPercentage}%` }}
          />
        </div>

        {/* Marquee warning ribbon */}
        <div className="flex-1 min-w-0 flex items-center gap-3 bg-red-500/5 px-4 py-1.5 border border-red-500/20 rounded">
          <ShieldAlert className="w-3.5 h-3.5 text-red-400 flex-shrink-0 animate-pulse" />
          <Marquee className="font-mono text-red-400 text-[10px] uppercase tracking-wider font-semibold whitespace-nowrap">
            {warningTexts}
          </Marquee>
        </div>
      </div>

      {/* 3. Threat counters */}
      <div className="flex items-center gap-2 pl-6 border-l border-[#27272a]">
        <div className="flex gap-1.5 font-mono">
          <span className="px-2 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded text-[9px] font-extrabold">
            {critical.length} CRITICAL
          </span>
          <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded text-[9px] font-extrabold">
            {high.length} HIGH
          </span>
        </div>
      </div>

    </div>
  );
}

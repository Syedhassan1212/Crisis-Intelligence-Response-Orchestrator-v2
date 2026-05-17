'use client';

import { Activity, Wifi, RotateCw, Bell, Radio } from 'lucide-react';
import type { OrchestratorState } from '@/lib/types';

interface HeaderProps {
  systemStatus: OrchestratorState['systemStatus'];
  cycle: number;
  lastUpdated?: string;
  loading: boolean;
  autoRun: boolean;
  countdown: number;
  onRunCycle: () => void;
  onToggleAuto: () => void;
  criticalCount: number;
  highCount: number;
  activeTab: 'map' | 'timeline' | 'trace';
  onTabChange: (tab: 'map' | 'timeline' | 'trace') => void;
}

export default function Header({
  systemStatus,
  cycle,
  loading,
  autoRun,
  countdown,
  onRunCycle,
  onToggleAuto,
  criticalCount,
  highCount,
  activeTab,
  onTabChange,
}: HeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 h-16 z-50 bg-[#10131a] backdrop-blur-md border-b border-zinc-800 flex justify-between items-center px-6">
      
      {/* Brand Title */}
      <div className="flex items-center gap-4">
        <span className="text-sm font-extrabold text-sky-300 tracking-wider">
          CIRO COMMAND CENTER
        </span>
        <div className="h-4 w-px bg-zinc-800"></div>
        
        {/* Navigation Tabs */}
        <nav className="flex gap-4">
          <button
            onClick={() => onTabChange('map')}
            className={`cursor-pointer pb-1 text-[11px] font-mono font-semibold transition-all duration-200 ${
              activeTab === 'map'
                ? 'text-sky-300 border-b-2 border-sky-400'
                : 'text-zinc-400 hover:text-sky-300 border-b-2 border-transparent'
            }`}
          >
            MAP
          </button>
          <button
            onClick={() => onTabChange('timeline')}
            className={`cursor-pointer pb-1 text-[11px] font-mono font-semibold transition-all duration-200 ${
              activeTab === 'timeline'
                ? 'text-sky-300 border-b-2 border-sky-400'
                : 'text-zinc-400 hover:text-sky-300 border-b-2 border-transparent'
            }`}
          >
            LOGS
          </button>
          <button
            onClick={() => onTabChange('trace')}
            className={`cursor-pointer pb-1 text-[11px] font-mono font-semibold transition-all duration-200 ${
              activeTab === 'trace'
                ? 'text-sky-300 border-b-2 border-sky-400'
                : 'text-zinc-400 hover:text-sky-300 border-b-2 border-transparent'
            }`}
          >
            TRACES
          </button>
        </nav>
      </div>

      {/* Connection & Telemetry Indicators */}
      <div className="flex items-center gap-4">
        
        {/* Cycle & Uplink Status */}
        <div className="flex items-center gap-3 font-mono text-[10px] bg-zinc-950 px-3 py-1.5 rounded border border-zinc-800">
          <span className="text-zinc-400 font-bold">Cycle #{cycle}</span>
          <span className="text-zinc-700 font-bold">•</span>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-emerald-400 font-bold">API Uplink Active</span>
          </div>
        </div>

        {/* Sync Controls */}
        <div className="flex items-center gap-2">
          
          {/* Stop/Start Auto Runner */}
          <button
            onClick={onToggleAuto}
            className={`px-3 py-1.5 rounded font-mono text-[9px] font-bold border transition-colors select-none ${
              autoRun
                ? 'bg-zinc-900/60 border-zinc-800 text-zinc-300 hover:bg-zinc-800/80'
                : 'bg-zinc-100 border-zinc-200 text-zinc-950 hover:bg-zinc-200'
            }`}
          >
            {autoRun ? `STOP AUTO (${countdown}S)` : 'START AUTO'}
          </button>

          {/* Manual Recalculation Sweep */}
          <button
            onClick={onRunCycle}
            disabled={loading}
            className="w-8 h-8 bg-zinc-900 border border-zinc-800 rounded flex items-center justify-center text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors disabled:opacity-40"
            title="Manual Grid Sync"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-sky-400' : ''}`} />
          </button>

          {/* Alert Notification Bell Indicator */}
          <div className="relative w-8 h-8 bg-zinc-900 border border-zinc-800 rounded flex items-center justify-center text-zinc-400 cursor-pointer hover:bg-zinc-800 transition-colors">
            <Bell className="w-3.5 h-3.5" />
            {(criticalCount > 0 || highCount > 0) && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full animate-ping" />
            )}
          </div>
        </div>

        {/* Profile Avatar */}
        <div className="w-8 h-8 rounded-full border border-sky-400/25 overflow-hidden flex-shrink-0 bg-zinc-900">
          <img
            alt="System Administrator Avatar"
            className="w-full h-full object-cover"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBQNOvdI7JgmzUpDbRzB5l-lDd4weHaQ5yGXVRdjr1M5i6hXhqGtlYTmwK6hWo1kUElCDKuycCQNn9K75pDjSH7O8nMYCL7L2b8mY5xK35FI6zSFhY-fXgK43fDOEAk_nvqZVtyf2dw2KQV7lxxZWiWHW4fMSVdeJyi5nUDIlBPZHmcCMvOuHHFVTgXmzQJ5V0c_Nar3XI6_DBm-iLV0ZGNYQ0wXET2_X863s5UIigyLuzU6g4Z0tLHPL3KYzmJCEsC6hYlszpAZeLN"
          />
        </div>

      </div>

    </header>
  );
}

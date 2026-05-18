'use client';

import { Menu, RotateCw, Bell } from 'lucide-react';
import type { OrchestratorState, WeatherData } from '@/lib/types';

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
  weather?: WeatherData;
}

export default function Header({
  cycle,
  loading,
  autoRun,
  countdown,
  onToggleAuto,
  onRunCycle,
  criticalCount,
  highCount,
  weather,
}: HeaderProps) {
  return (
    <header className="flex-shrink-0 h-14 z-50 bg-[#111113] border-b border-[#1e1e21] flex items-center px-4 gap-0">

      {/* ── LEFT: Hamburger + Brand ── */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <button className="w-8 h-8 flex items-center justify-center rounded text-zinc-500 hover:text-zinc-100 hover:bg-[#1c1c1f] transition-all cursor-pointer">
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-1.5">
          <span className="text-white font-extrabold text-[15px] tracking-tight">CIRO</span>
          <span className="text-zinc-400 font-semibold text-[15px] tracking-tight">COMMAND CENTER</span>
        </div>
      </div>

      {/* ── DIVIDER ── */}
      <div className="w-px h-6 bg-[#27272a] mx-5 flex-shrink-0" />

      {/* ── CENTER: Weather strip ── */}
      <div className="flex-1 flex items-center gap-0 overflow-hidden">
        {weather ? (
          <>
            {/* Temperature */}
            <div className="flex items-baseline gap-1.5 pr-5">
              <span className="text-white font-bold text-[20px] leading-none">{Math.round(weather.temperature)}°C</span>
              <span className="text-zinc-500 text-[11px] font-medium">{weather.condition}</span>
            </div>

            {/* Vertical separator */}
            <div className="w-px h-5 bg-[#27272a] flex-shrink-0 mr-5" />

            {/* Stat pills */}
            <div className="flex items-center gap-4">
              <WeatherStat label="Humidity" value={`${Math.round(weather.humidity)}%`} />
              <WeatherStat label="Wind" value={`${Math.round(weather.windSpeed)} km/h NE`} />
              <WeatherStat label="Precipitation" value={weather.rainfall > 0 ? `${weather.rainfall.toFixed(1)} mm` : '0%'} />
            </div>
          </>
        ) : (
          <span className="text-zinc-600 text-[11px] font-mono tracking-wider">CLIMATE TELEMETRY — ESTABLISHING LINK...</span>
        )}
      </div>

      {/* ── RIGHT: Controls + Avatar ── */}
      <div className="flex items-center gap-2 flex-shrink-0">

        {/* Cycle pill */}
        <div className="px-3 py-1 rounded bg-[#1c1c1f] border border-[#27272a] font-mono text-[11px] text-zinc-300 font-semibold">
          Cycle #{cycle}
        </div>

        {/* Divider */}
        <div className="w-px h-5 bg-[#27272a] mx-1" />

        {/* API Status pill */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded bg-[#1c1c1f] border border-[#27272a] font-mono text-[11px]">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-zinc-300">API Status: <span className="text-emerald-400 font-bold">Active</span></span>
        </div>

        {/* Auto-run toggle */}
        <button
          onClick={onToggleAuto}
          className={`px-3 py-1 rounded font-mono text-[11px] font-bold border transition-colors cursor-pointer select-none ${
            autoRun
              ? 'bg-[#1c1c1f] border-[#27272a] text-zinc-300 hover:bg-zinc-800'
              : 'bg-zinc-100 border-zinc-300 text-zinc-900 hover:bg-zinc-200'
          }`}
        >
          {autoRun ? `STOP AUTO (${countdown}S)` : 'START AUTO'}
        </button>

        {/* Divider */}
        <div className="w-px h-5 bg-[#27272a] mx-1" />

        {/* Sync */}
        <button
          onClick={onRunCycle}
          disabled={loading}
          title="Run Sweep Cycle"
          className="w-8 h-8 flex items-center justify-center rounded bg-[#1c1c1f] border border-[#27272a] text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all disabled:opacity-40 cursor-pointer"
        >
          <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
        </button>

        {/* Bell */}
        <div className="relative w-8 h-8 flex items-center justify-center rounded bg-[#1c1c1f] border border-[#27272a] text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all cursor-pointer">
          <Bell className="w-3.5 h-3.5" />
          {(criticalCount > 0 || highCount > 0) && (
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
          )}
        </div>

        {/* Avatar */}
        <div className="w-8 h-8 rounded-full border border-[#27272a] overflow-hidden flex-shrink-0 bg-[#1c1c1f]">
          <img
            alt="Admin"
            className="w-full h-full object-cover"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBQNOvdI7JgmzUpDbRzB5l-lDd4weHaQ5yGXVRdjr1M5i6hXhqGtlYTmwK6hWo1kUElCDKuycCQNn9K75pDjSH7O8nMYCL7L2b8mY5xK35FI6zSFhY-fXgK43fDOEAk_nvqZVtyf2dw2KQV7lxxZWiWHW4fMSVdeJyi5nUDIlBPZHmcCMvOuHHFVTgXmzQJ5V0c_Nar3XI6_DBm-iLV0ZGNYQ0wXET2_X863s5UIigyLuzU6g4Z0tLHPL3KYzmJCEsC6hYlszpAZeLN"
          />
        </div>

      </div>
    </header>
  );
}

function WeatherStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-zinc-600 text-[10px] font-medium uppercase tracking-wider">{label}</span>
      <span className="text-zinc-200 text-[11px] font-semibold">{value}</span>
    </div>
  );
}

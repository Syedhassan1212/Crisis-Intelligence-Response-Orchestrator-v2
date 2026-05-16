'use client';

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
}

const statusConfig = {
  idle: { label: 'STANDBY', color: 'text-green-400', bg: 'bg-green-400', border: 'border-green-500/30' },
  processing: { label: 'PROCESSING', color: 'text-cyan-400', bg: 'bg-cyan-400', border: 'border-cyan-500/30' },
  alert: { label: 'ALERT', color: 'text-amber-400', bg: 'bg-amber-400', border: 'border-amber-500/30' },
  critical: { label: 'CRITICAL', color: 'text-red-400', bg: 'bg-red-400', border: 'border-red-500/30' },
};

export default function Header({
  systemStatus, cycle, lastUpdated, loading, autoRun, countdown,
  onRunCycle, onToggleAuto, criticalCount, highCount
}: HeaderProps) {
  const cfg = statusConfig[systemStatus] || statusConfig.idle;

  return (
    <header className="header-gradient px-4 py-3 flex items-center gap-4 flex-shrink-0">
      {/* Logo & Name */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-700 flex items-center justify-center text-lg shadow-lg shadow-blue-900/50">
            🛡️
          </div>
          {(systemStatus === 'alert' || systemStatus === 'critical') && (
            <span className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${cfg.bg} ${systemStatus === 'critical' ? 'animate-pulse-red' : 'animate-pulse-amber'}`} />
          )}
        </div>
        <div>
          <div className="text-sm font-bold text-white tracking-wider">CIRO</div>
          <div className="text-xs text-gray-500 leading-tight">Crisis Intelligence & Response Orchestrator</div>
        </div>
      </div>

      {/* Divider */}
      <div className="h-8 w-px bg-white/10" />

      {/* System Status */}
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md border ${cfg.border} bg-white/3`}>
        <span className={`w-2 h-2 rounded-full ${cfg.bg} ${loading ? 'animate-pulse' : ''}`} />
        <span className={`text-xs font-bold tracking-widest ${cfg.color}`}>{loading ? 'PROCESSING' : cfg.label}</span>
      </div>

      {/* Cycle & Time */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <div>
          Cycle <span className="text-white font-mono font-bold">#{cycle}</span>
        </div>
        {lastUpdated && (
          <div>
            Updated <span className="text-gray-400">{new Date(lastUpdated).toLocaleTimeString()}</span>
          </div>
        )}
      </div>

      {/* Alert counts */}
      {criticalCount > 0 && (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-900/30 border border-red-500/30">
          <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
          <span className="text-xs font-bold text-red-300">{criticalCount} CRITICAL</span>
        </div>
      )}
      {highCount > 0 && (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-orange-900/30 border border-orange-500/30">
          <span className="w-2 h-2 rounded-full bg-orange-400" />
          <span className="text-xs font-bold text-orange-300">{highCount} HIGH</span>
        </div>
      )}

      {/* Integration badges */}
      <div className="flex items-center gap-2 ml-auto">
        <span className="px-2 py-0.5 text-xs rounded bg-blue-900/40 border border-blue-700/30 text-blue-400">Google Maps</span>
        <span className="px-2 py-0.5 text-xs rounded bg-purple-900/40 border border-purple-700/30 text-purple-400">Gemini Flash</span>
        <span className="px-2 py-0.5 text-xs rounded bg-cyan-900/40 border border-cyan-700/30 text-cyan-400">Social API</span>
        <span className="px-2 py-0.5 text-xs rounded bg-green-900/40 border border-green-700/30 text-green-400">Weather</span>
        <a
          href="/logs"
          className="px-2 py-0.5 text-xs rounded bg-orange-900/40 border border-orange-700/30 text-orange-400 hover:bg-orange-700/30 transition-all"
        >
          📋 Logs
        </a>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={onRunCycle}
          disabled={loading}
          className="px-3 py-1.5 rounded-md bg-cyan-700/30 border border-cyan-600/30 text-cyan-300 text-xs font-medium hover:bg-cyan-700/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? '⟳ Running...' : '▶ Run Cycle'}
        </button>
        <button
          onClick={onToggleAuto}
          className={`px-3 py-1.5 rounded-md border text-xs font-medium transition-all ${
            autoRun
              ? 'bg-green-700/30 border-green-600/30 text-green-300 hover:bg-red-700/20 hover:text-red-300 hover:border-red-600/30'
              : 'bg-white/5 border-white/10 text-gray-400 hover:bg-green-700/20 hover:text-green-300 hover:border-green-600/30'
          }`}
        >
          {autoRun ? `⏹ Stop (${countdown}s)` : '⚡ Auto'}
        </button>
      </div>
    </header>
  );
}

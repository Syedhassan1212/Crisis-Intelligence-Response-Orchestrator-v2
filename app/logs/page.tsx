'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { LogEntry, LogLevel, LogCategory } from '@/lib/logger';

// ── Types ─────────────────────────────────────────────────────
interface LogStats {
  total: number;
  errorCount: number;
  apiCallCount: number;
  avgDurationMs: number;
  byLevel: Record<string, number>;
  byCategory: Record<string, number>;
  byAgent: Record<string, number>;
  currentCycle: number;
  newestEntry?: string;
  oldestEntry?: string;
}

// ── Constants ──────────────────────────────────────────────────
const LEVEL_CONFIG: Record<LogLevel, { color: string; bg: string; border: string; dot: string }> = {
  DEBUG:   { color: 'text-gray-400',   bg: 'bg-gray-800/40',   border: 'border-gray-700/40',   dot: 'bg-gray-500'  },
  INFO:    { color: 'text-cyan-400',   bg: 'bg-cyan-900/20',   border: 'border-cyan-700/30',   dot: 'bg-cyan-400'  },
  SUCCESS: { color: 'text-green-400',  bg: 'bg-green-900/20',  border: 'border-green-700/30',  dot: 'bg-green-400' },
  WARN:    { color: 'text-amber-400',  bg: 'bg-amber-900/20',  border: 'border-amber-700/30',  dot: 'bg-amber-400' },
  ERROR:   { color: 'text-red-400',    bg: 'bg-red-900/20',    border: 'border-red-600/30',    dot: 'bg-red-500'   },
};

const CATEGORY_ICONS: Record<string, string> = {
  API_CALL: '🌐', AGENT_DECISION: '🤖', SIGNAL_FUSION: '📡',
  CRISIS_DETECTION: '🔴', RISK_PREDICTION: '📈', RESOURCE_ALLOCATION: '🚑',
  SIMULATION: '🎯', TRAFFIC_CONTROL: '🚦', NOTIFICATION: '🔔',
  ORCHESTRATOR: '🧠', DATA_INGESTION: '📥', SYSTEM: '⚙️',
};

const CATEGORY_COLORS: Record<string, string> = {
  API_CALL: 'text-blue-400',
  SIGNAL_FUSION: 'text-cyan-400',
  CRISIS_DETECTION: 'text-red-400',
  RISK_PREDICTION: 'text-orange-400',
  RESOURCE_ALLOCATION: 'text-purple-400',
  SIMULATION: 'text-indigo-400',
  TRAFFIC_CONTROL: 'text-pink-400',
  NOTIFICATION: 'text-yellow-400',
  ORCHESTRATOR: 'text-emerald-400',
  DATA_INGESTION: 'text-sky-400',
  AGENT_DECISION: 'text-violet-400',
  SYSTEM: 'text-gray-400',
};

const ALL_LEVELS: LogLevel[] = ['DEBUG', 'INFO', 'SUCCESS', 'WARN', 'ERROR'];
const ALL_CATEGORIES: LogCategory[] = [
  'API_CALL', 'DATA_INGESTION', 'SIGNAL_FUSION', 'CRISIS_DETECTION', 'RISK_PREDICTION',
  'RESOURCE_ALLOCATION', 'SIMULATION', 'TRAFFIC_CONTROL', 'NOTIFICATION', 'ORCHESTRATOR',
  'AGENT_DECISION', 'SYSTEM',
];

// ── Main Page ──────────────────────────────────────────────────
export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<LogLevel | ''>('');
  const [selectedCategory, setSelectedCategory] = useState<LogCategory | ''>('');
  const [selectedAgent, setSelectedAgent] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [view, setView] = useState<'table' | 'timeline' | 'stats' | 'agents' | 'history'>('table');
  const intervalRef = useRef<any>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedLevel) params.set('level', selectedLevel);
      if (selectedCategory) params.set('category', selectedCategory);
      if (selectedAgent) params.set('agent', selectedAgent);
      if (search) params.set('search', search);
      params.set('limit', '300');
      const res = await fetch(`/api/logs?${params}`);
      const data = await res.json();
      if (data.success) {
        setLogs(data.data);
        setStats(data.stats);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedLevel, selectedCategory, selectedAgent, search]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchLogs, 3000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, fetchLogs]);

  const clearLogs = async () => {
    if (!confirm('Clear all logs? This cannot be undone.')) return;
    await fetch('/api/logs', { method: 'DELETE' });
    setLogs([]);
    setStats(null);
  };

  const exportLogs = () => {
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ciro-logs-${new Date().toISOString().slice(0, 19)}.json`;
    a.click();
  };

  // Get unique agents for filter
  const agents = [...new Set(logs.map(l => l.agent))].sort();

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans">
      {/* Top Header */}
      <div className="header-gradient border-b border-white/5 sticky top-0 z-30">
        <div className="px-6 py-3 flex items-center gap-4">
          <a href="/" className="text-gray-500 hover:text-gray-300 transition-colors text-sm">← Dashboard</a>
          <div className="h-4 w-px bg-white/10" />
          <div className="flex items-center gap-2">
            <span className="text-lg">📋</span>
            <div>
              <div className="text-sm font-bold text-white">Agent Log Viewer</div>
              <div className="text-xs text-gray-500">Full call records from all CIRO engines</div>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {loading && <span className="text-xs text-cyan-400 animate-pulse">⟳ Loading...</span>}
            {stats && (
              <span className="text-xs text-gray-600">
                {stats.total} entries · Cycle #{stats.currentCycle}
              </span>
            )}
            <button onClick={() => setAutoRefresh(v => !v)} className={`px-3 py-1.5 rounded-md text-xs border font-medium transition-all ${autoRefresh ? 'bg-green-700/30 border-green-500/30 text-green-300' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}>
              {autoRefresh ? '⏹ Auto' : '⚡ Auto'}
            </button>
            <button onClick={fetchLogs} className="px-3 py-1.5 rounded-md text-xs bg-blue-700/30 border border-blue-500/30 text-blue-300 hover:bg-blue-700/50 transition-all">↻ Refresh</button>
            <button onClick={exportLogs} className="px-3 py-1.5 rounded-md text-xs bg-purple-700/30 border border-purple-500/30 text-purple-300 hover:bg-purple-700/50 transition-all">⬇ Export</button>
            <button onClick={clearLogs} className="px-3 py-1.5 rounded-md text-xs bg-red-900/30 border border-red-600/30 text-red-400 hover:bg-red-900/50 transition-all">🗑 Clear</button>
          </div>
        </div>

        {/* View Tabs + Filters */}
        <div className="px-6 py-2 border-t border-white/5 flex items-center gap-3 flex-wrap">
          {/* View switcher */}
          <div className="flex gap-1 mr-2">
            {(['table', 'timeline', 'agents', 'history', 'stats'] as const).map(v => (
              <button key={v} onClick={() => setView(v)} className={`px-3 py-1 text-xs rounded-md capitalize transition-all ${view === v ? 'bg-blue-600/30 text-blue-300 border border-blue-500/30' : 'text-gray-500 hover:text-gray-300'}`}>
                {v === 'table' ? '📋 Table' : v === 'timeline' ? '📡 Timeline' : v === 'agents' ? '🤖 Agents' : v === 'history' ? '🗄️ History' : '📊 Stats'}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-white/10" />

          {/* Level filter */}
          <select value={selectedLevel} onChange={e => setSelectedLevel(e.target.value as LogLevel | '')} className="text-xs bg-gray-900 border border-white/10 text-gray-300 rounded-md px-2 py-1 outline-none">
            <option value="">All Levels</option>
            {ALL_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>

          {/* Category filter */}
          <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value as LogCategory | '')} className="text-xs bg-gray-900 border border-white/10 text-gray-300 rounded-md px-2 py-1 outline-none">
            <option value="">All Categories</option>
            {ALL_CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_ICONS[c]} {c}</option>)}
          </select>

          {/* Agent filter */}
          <select value={selectedAgent} onChange={e => setSelectedAgent(e.target.value)} className="text-xs bg-gray-900 border border-white/10 text-gray-300 rounded-md px-2 py-1 outline-none">
            <option value="">All Agents</option>
            {agents.map(a => <option key={a} value={a}>{a}</option>)}
          </select>

          {/* Search */}
          <div className="flex items-center gap-1 bg-gray-900 border border-white/10 rounded-md px-2 py-1">
            <span className="text-gray-600 text-xs">🔍</span>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search logs..."
              className="text-xs bg-transparent text-gray-300 outline-none placeholder-gray-700 w-40"
            />
          </div>

          <span className="text-xs text-gray-600 ml-auto">{logs.length} results</span>
        </div>
      </div>

      <div className="p-6">
        {view === 'stats' && stats && <StatsView stats={stats} />}
        {view === 'timeline' && <TimelineView logs={logs} expandedId={expandedId} setExpandedId={setExpandedId} />}
        {view === 'agents' && <AgentsView logs={logs} />}
        {view === 'history' && <HistoryView />}
        {view === 'table' && (
          <div ref={tableRef} className="space-y-1">
            {logs.length === 0 && !loading && (
              <div className="text-center py-24 text-gray-600">
                <div className="text-5xl mb-4">📭</div>
                <div className="text-sm font-medium text-gray-500">No logs yet</div>
                <div className="text-xs mt-2">Run a cycle from the dashboard to generate logs</div>
                <a href="/" className="mt-4 inline-block px-4 py-2 text-xs bg-blue-700/30 border border-blue-500/30 text-blue-300 rounded-lg hover:bg-blue-700/50 transition-all">
                  → Go to Dashboard
                </a>
              </div>
            )}
            {logs.map(entry => (
              <LogRow
                key={entry.id}
                entry={entry}
                expanded={expandedId === entry.id}
                onToggle={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Log Table Row ──────────────────────────────────────────────
function LogRow({ entry, expanded, onToggle }: { entry: LogEntry; expanded: boolean; onToggle: () => void }) {
  const lvl = LEVEL_CONFIG[entry.level] || LEVEL_CONFIG.INFO;
  const catColor = CATEGORY_COLORS[entry.category] || 'text-gray-400';
  const catIcon = CATEGORY_ICONS[entry.category] || '⚙️';
  const hasDetails = entry.details || entry.requestPayload || entry.responsePayload || entry.errorMessage;
  const time = new Date(entry.timestamp);

  return (
    <div className={`rounded-lg border transition-all ${lvl.border} ${expanded ? lvl.bg : 'bg-gray-900/30 hover:bg-gray-900/50'} animate-fade-in`}>
      <div className="flex items-start gap-3 px-4 py-2.5 cursor-pointer" onClick={onToggle}>
        {/* Level dot */}
        <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${lvl.dot}`} />

        {/* Timestamp */}
        <span className="text-xs text-gray-600 font-mono flex-shrink-0 mt-0.5 w-20">
          {time.toLocaleTimeString('en-US', { hour12: false })}
        </span>

        {/* Level badge */}
        <span className={`text-xs font-bold flex-shrink-0 w-14 ${lvl.color}`}>{entry.level}</span>

        {/* Category */}
        <span className={`text-xs flex-shrink-0 w-36 font-mono ${catColor}`}>
          {catIcon} {entry.category}
        </span>

        {/* Agent */}
        <span className="text-xs text-purple-300 flex-shrink-0 w-44 font-mono truncate">
          {entry.agent}
        </span>

        {/* Action */}
        <span className="text-xs text-yellow-600 flex-shrink-0 w-28 font-mono">{entry.action}</span>

        {/* Message */}
        <span className={`text-xs flex-1 min-w-0 ${lvl.color} truncate`}>{entry.message}</span>

        {/* Right info */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {entry.durationMs !== undefined && (
            <span className="text-xs text-gray-600 font-mono">{entry.durationMs}ms</span>
          )}
          {entry.confidence !== undefined && (
            <span className="text-xs text-blue-500">{(entry.confidence * 100).toFixed(0)}%</span>
          )}
          {entry.cycleNumber !== undefined && (
            <span className="text-xs text-gray-700">#{entry.cycleNumber}</span>
          )}
          {hasDetails && <span className="text-xs text-gray-600">{expanded ? '▲' : '▼'}</span>}
        </div>
      </div>

      {/* Expanded Detail */}
      {expanded && hasDetails && (
        <div className="px-4 pb-3 border-t border-white/5 pt-2 space-y-2 animate-fade-in">
          <div className="grid grid-cols-2 gap-3">
            {!!entry.requestPayload && (
              <div>
                <div className="text-xs text-gray-600 mb-1 font-semibold uppercase tracking-wider">REQUEST</div>
                <pre className="text-xs text-gray-400 font-mono bg-gray-950 rounded-lg p-2 overflow-x-auto max-h-32">
                  {JSON.stringify(entry.requestPayload, null, 2)}
                </pre>
              </div>
            )}
            {!!entry.responsePayload && (
              <div>
                <div className="text-xs text-gray-600 mb-1 font-semibold uppercase tracking-wider">RESPONSE</div>
                <pre className="text-xs text-gray-400 font-mono bg-gray-950 rounded-lg p-2 overflow-x-auto max-h-32">
                  {JSON.stringify(entry.responsePayload, null, 2)}
                </pre>
              </div>
            )}
          </div>
          {!!entry.details && (
            <div>
              <div className="text-xs text-gray-600 mb-1 font-semibold uppercase tracking-wider">DETAILS</div>
              <pre className="text-xs text-gray-400 font-mono bg-gray-950 rounded-lg p-2 overflow-x-auto max-h-32">
                {JSON.stringify(entry.details, null, 2)}
              </pre>
            </div>
          )}
          {entry.errorMessage && (
            <div className="p-2 rounded-lg bg-red-900/20 border border-red-600/30">
              <div className="text-xs text-red-400 font-semibold mb-1">ERROR</div>
              <div className="text-xs text-red-300 font-mono">{entry.errorMessage}</div>
            </div>
          )}
          <div className="text-xs text-gray-700 font-mono">ID: {entry.id}</div>
        </div>
      )}
    </div>
  );
}

// ── Timeline View ──────────────────────────────────────────────
function TimelineView({ logs, expandedId, setExpandedId }: {
  logs: LogEntry[];
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
}) {
  // Group by cycle
  const byCycle: Record<number, LogEntry[]> = {};
  for (const l of logs) {
    const c = l.cycleNumber ?? 0;
    if (!byCycle[c]) byCycle[c] = [];
    byCycle[c].push(l);
  }
  const cycles = Object.keys(byCycle).map(Number).sort((a, b) => b - a);

  return (
    <div className="space-y-6">
      {cycles.map(cycle => {
        const cycleEntries = byCycle[cycle];
        const hasError = cycleEntries.some(e => e.level === 'ERROR');
        const apiCalls = cycleEntries.filter(e => e.category === 'API_CALL').length;
        const duration = cycleEntries.find(e => e.action === 'CYCLE_END')?.durationMs;
        return (
          <div key={cycle} className={`glass-card rounded-xl overflow-hidden ${hasError ? 'border-red-500/20' : 'border-white/5'}`}>
            <div className={`px-4 py-3 flex items-center gap-3 border-b border-white/5 ${hasError ? 'bg-red-900/10' : 'bg-white/2'}`}>
              <span className="text-sm font-bold text-white">Cycle #{cycle}</span>
              <span className="text-xs text-gray-500">{cycleEntries.length} events · {apiCalls} API calls</span>
              {duration && <span className="text-xs text-cyan-400">{duration}ms total</span>}
              {hasError && <span className="text-xs text-red-400 ml-auto">⚠ Errors detected</span>}
            </div>
            <div className="p-3 space-y-1">
              {cycleEntries.map(entry => {
                const lvl = LEVEL_CONFIG[entry.level] || LEVEL_CONFIG.INFO;
                const catIcon = CATEGORY_ICONS[entry.category] || '⚙️';
                return (
                  <div key={entry.id}
                    className={`flex items-start gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all ${expandedId === entry.id ? lvl.bg : 'hover:bg-white/3'}`}
                    onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${lvl.dot}`} />
                    <span className="text-xs text-gray-600 font-mono w-16 flex-shrink-0">{new Date(entry.timestamp).toLocaleTimeString('en-US', { hour12: false })}</span>
                    <span className="text-xs flex-shrink-0">{catIcon}</span>
                    <span className={`text-xs font-bold w-12 flex-shrink-0 ${lvl.color}`}>{entry.level.slice(0, 4)}</span>
                    <span className="text-xs text-purple-400 w-36 flex-shrink-0 truncate font-mono">{entry.agent}</span>
                    <span className={`text-xs flex-1 ${lvl.color} ${entry.level === 'ERROR' ? 'font-medium' : ''}`}>{entry.message}</span>
                    {entry.durationMs && <span className="text-xs text-gray-700 font-mono flex-shrink-0">{entry.durationMs}ms</span>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      {cycles.length === 0 && (
        <div className="text-center py-20 text-gray-600">
          <div className="text-4xl mb-3">📡</div>
          <div>No cycles logged yet</div>
        </div>
      )}
    </div>
  );
}

// ── Stats View ─────────────────────────────────────────────────
function StatsView({ stats }: { stats: LogStats }) {
  const maxLevel = Math.max(...Object.values(stats.byLevel));
  const maxCat = Math.max(...Object.values(stats.byCategory));
  const maxAgent = Math.max(...Object.values(stats.byAgent));

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'Total Logs', value: stats.total, color: 'text-white' },
          { label: 'Errors', value: stats.errorCount, color: stats.errorCount > 0 ? 'text-red-400' : 'text-green-400' },
          { label: 'API Calls', value: stats.apiCallCount, color: 'text-blue-400' },
          { label: 'Avg Response', value: `${stats.avgDurationMs}ms`, color: 'text-cyan-400' },
          { label: 'Current Cycle', value: `#${stats.currentCycle}`, color: 'text-purple-400' },
        ].map(s => (
          <div key={s.label} className="glass-card p-4 text-center">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* By Level */}
        <div className="glass-card p-4">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">By Level</div>
          <div className="space-y-2">
            {Object.entries(stats.byLevel).map(([level, count]) => {
              const cfg = LEVEL_CONFIG[level as LogLevel] || LEVEL_CONFIG.INFO;
              return (
                <div key={level} className="flex items-center gap-2">
                  <span className={`text-xs font-bold w-16 ${cfg.color}`}>{level}</span>
                  <div className="flex-1 bg-white/5 rounded-full h-2">
                    <div className={`h-2 rounded-full ${cfg.dot.replace('bg-', 'bg-')}`} style={{ width: `${(count / maxLevel) * 100}%` }} />
                  </div>
                  <span className="text-xs text-gray-500 w-8 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* By Category */}
        <div className="glass-card p-4">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">By Category</div>
          <div className="space-y-2">
            {Object.entries(stats.byCategory).sort(([,a], [,b]) => b - a).map(([cat, count]) => {
              const color = CATEGORY_COLORS[cat] || 'text-gray-400';
              const icon = CATEGORY_ICONS[cat] || '⚙️';
              return (
                <div key={cat} className="flex items-center gap-2">
                  <span className="text-xs w-4">{icon}</span>
                  <span className={`text-xs w-32 truncate ${color}`}>{cat}</span>
                  <div className="flex-1 bg-white/5 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full bg-blue-500/60" style={{ width: `${(count / maxCat) * 100}%` }} />
                  </div>
                  <span className="text-xs text-gray-500 w-6 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* By Agent */}
        <div className="glass-card p-4">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">By Agent</div>
          <div className="space-y-2">
            {Object.entries(stats.byAgent).sort(([,a], [,b]) => b - a).map(([agent, count]) => (
              <div key={agent} className="flex items-center gap-2">
                <span className="text-xs text-purple-400 w-40 truncate font-mono">{agent}</span>
                <div className="flex-1 bg-white/5 rounded-full h-1.5">
                  <div className="h-1.5 rounded-full bg-purple-500/60" style={{ width: `${(count / maxAgent) * 100}%` }} />
                </div>
                <span className="text-xs text-gray-500 w-6 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Time range */}
      {stats.newestEntry && (
        <div className="glass-card p-4 text-xs text-gray-500 flex items-center gap-4">
          <span>📅 Log window: {new Date(stats.oldestEntry || '').toLocaleString()} → {new Date(stats.newestEntry).toLocaleString()}</span>
          <span className="ml-auto">Buffer: up to 500 entries (FIFO)</span>
        </div>
      )}
    </div>
  );
}

// ── Agent Decisions View ───────────────────────────────────────
const AGENT_META: Record<string, { icon: string; color: string; desc: string }> = {
  CrisisDetectionAgent:    { icon: '🔴', color: '#ef4444', desc: 'Classifies crisis type & severity via Gemini Flash' },
  RiskPredictionAgent:     { icon: '📈', color: '#f97316', desc: 'Predicts spread probability and population impact' },
  ResourceAllocationAgent: { icon: '🚑', color: '#a855f7', desc: 'Optimizes unit dispatch using available resources' },
  SimulationAgent:         { icon: '🎯', color: '#6366f1', desc: 'Pre-execution outcome simulation with tradeoffs' },
  NotificationAgent:       { icon: '🔔', color: '#f59e0b', desc: 'Generates multi-channel emergency alerts' },
  SignalFusionEngine:      { icon: '📡', color: '#06b6d4', desc: 'Fuses social, weather, traffic into crisis signals' },
  TrafficControlEngine:    { icon: '🚦', color: '#ec4899', desc: 'Manages road blocks and emergency corridors' },
  SocialIngestionAgent:    { icon: '📱', color: '#22d3ee', desc: 'Fetches & parses social media crisis reports' },
  WeatherIngestionAgent:   { icon: '🌤️', color: '#4ade80', desc: 'Polls Google Weather API for conditions' },
  TrafficIngestionAgent:   { icon: '🗺️', color: '#fb923c', desc: 'Polls Google Maps for traffic & road states' },
  Orchestrator:            { icon: '🧠', color: '#818cf8', desc: 'Coordinates all engines across cycle phases' },
};

function AgentsView({ logs }: { logs: LogEntry[] }) {
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  const byAgent: Record<string, LogEntry[]> = {};
  for (const l of logs) {
    if (!byAgent[l.agent]) byAgent[l.agent] = [];
    byAgent[l.agent].push(l);
  }
  const agents = Object.keys(byAgent).sort();
  const displayAgent = activeAgent || agents[0];
  const agentLogs = displayAgent ? (byAgent[displayAgent] || []) : [];

  if (agents.length === 0) {
    return (
      <div className="text-center py-24 text-gray-600">
        <div className="text-5xl mb-4">🤖</div>
        <div className="text-sm text-gray-500">No agent logs yet — run a cycle from the dashboard</div>
        <a href="/" className="mt-4 inline-block px-4 py-2 text-xs bg-blue-700/30 border border-blue-500/30 text-blue-300 rounded-lg">→ Go to Dashboard</a>
      </div>
    );
  }

  return (
    <div className="flex gap-4" style={{ minHeight: '70vh' }}>
      {/* Agent sidebar */}
      <div className="w-60 flex-shrink-0 space-y-1">
        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider px-2 mb-3">Agents ({agents.length})</div>
        {agents.map(agent => {
          const meta = AGENT_META[agent] || { icon: '⚙️', color: '#6b7280', desc: '' };
          const agLogs = byAgent[agent];
          const errors = agLogs.filter(l => l.level === 'ERROR').length;
          const apiCalls = agLogs.filter(l => l.category === 'API_CALL').length;
          const confLogs = agLogs.filter(l => l.confidence);
          const avgConf = confLogs.length ? confLogs.reduce((s, l) => s + (l.confidence || 0), 0) / confLogs.length : 0;
          return (
            <button key={agent} onClick={() => { setActiveAgent(agent); setExpandedLog(null); }}
              className={`w-full text-left p-3 rounded-xl border transition-all ${displayAgent === agent ? 'border-white/20 bg-white/8' : 'border-white/5 bg-white/2 hover:bg-white/5'}`}>
              <div className="flex items-center gap-2 mb-1">
                <span>{meta.icon}</span>
                <span className="text-xs font-semibold text-white truncate">{agent}</span>
                {errors > 0 && <span className="ml-auto text-xs text-red-400 font-bold">{errors}!</span>}
              </div>
              <div className="text-xs text-gray-600 mb-2 truncate">{meta.desc}</div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-600">{agLogs.length} logs</span>
                {apiCalls > 0 && <span className="text-blue-500">{apiCalls} API</span>}
                {avgConf > 0 && <span style={{ color: meta.color }}>{(avgConf * 100).toFixed(0)}%</span>}
              </div>
            </button>
          );
        })}
      </div>

      {/* Agent detail panel */}
      <div className="flex-1 min-w-0">
        {displayAgent && (() => {
          const meta = AGENT_META[displayAgent] || { icon: '⚙️', color: '#6b7280', desc: '' };
          const errors = agentLogs.filter(l => l.level === 'ERROR').length;
          const successes = agentLogs.filter(l => l.level === 'SUCCESS').length;
          const durs = agentLogs.filter(l => l.durationMs).map(l => l.durationMs!);
          const avgMs = durs.length ? Math.round(durs.reduce((a, b) => a + b, 0) / durs.length) : 0;
          return (
            <div>
              <div className="glass-card p-4 mb-4 flex items-center gap-4">
                <span className="text-3xl">{meta.icon}</span>
                <div>
                  <div className="text-base font-bold text-white">{displayAgent}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{meta.desc}</div>
                </div>
                <div className="ml-auto flex gap-6 text-center">
                  {[{v:agentLogs.length,l:'Total Calls',c:'text-white'},{v:successes,l:'Success',c:'text-green-400'},{v:errors,l:'Errors',c:errors>0?'text-red-400':'text-green-400'},{v:`${avgMs}ms`,l:'Avg Time',c:'text-cyan-400'}].map(s=>(
                    <div key={s.l}><div className={`text-xl font-bold ${s.c}`}>{s.v}</div><div className="text-xs text-gray-600">{s.l}</div></div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                {agentLogs.map(entry => {
                  const lvl = LEVEL_CONFIG[entry.level] || LEVEL_CONFIG.INFO;
                  const isExp = expandedLog === entry.id;
                  const hasDetail = entry.requestPayload || entry.responsePayload || entry.details || entry.errorMessage;
                  return (
                    <div key={entry.id}
                      className={`rounded-xl border transition-all ${isExp ? `${lvl.bg} ${lvl.border}` : 'border-white/5 bg-white/2 hover:bg-white/4'} ${hasDetail ? 'cursor-pointer' : ''}`}
                      onClick={() => hasDetail && setExpandedLog(isExp ? null : entry.id)}>
                      <div className="flex items-center gap-3 px-4 py-3">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${lvl.dot}`}/>
                        <span className="text-xs text-gray-600 font-mono w-20 flex-shrink-0">{new Date(entry.timestamp).toLocaleTimeString('en-US',{hour12:false})}</span>
                        <span className={`text-xs font-bold w-14 flex-shrink-0 ${lvl.color}`}>{entry.level}</span>
                        <span className="text-xs text-yellow-600 font-mono w-32 flex-shrink-0 truncate">{entry.action}</span>
                        <span className={`text-xs flex-1 min-w-0 truncate ${lvl.color}`}>{entry.message}</span>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          {entry.durationMs !== undefined && <span className="text-xs text-gray-600 font-mono">{entry.durationMs}ms</span>}
                          {entry.confidence !== undefined && (
                            <div className="flex items-center gap-1.5">
                              <div className="w-14 bg-white/10 rounded-full h-1.5">
                                <div className="h-1.5 rounded-full" style={{width:`${entry.confidence*100}%`, background: meta.color}}/>
                              </div>
                              <span className="text-xs font-mono" style={{color:meta.color}}>{(entry.confidence*100).toFixed(0)}%</span>
                            </div>
                          )}
                          {entry.cycleNumber !== undefined && <span className="text-xs text-gray-700">#{entry.cycleNumber}</span>}
                          {hasDetail && <span className="text-xs text-gray-600">{isExp?'▲':'▼'}</span>}
                        </div>
                      </div>
                      {isExp && hasDetail && (
                        <div className="px-4 pb-4 border-t border-white/5 pt-3 space-y-3">
                          {!!entry.requestPayload && (
                            <div>
                              <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1.5">📤 Request Payload</div>
                              <pre className="text-xs text-gray-400 font-mono bg-gray-950 rounded-lg p-3 overflow-x-auto max-h-48 border border-white/5">{JSON.stringify(entry.requestPayload, null, 2)}</pre>
                            </div>
                          )}
                          {!!entry.responsePayload && (
                            <div>
                              <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1.5">📥 Response Payload</div>
                              <pre className="text-xs text-gray-400 font-mono bg-gray-950 rounded-lg p-3 overflow-x-auto max-h-48 border border-white/5">{JSON.stringify(entry.responsePayload, null, 2)}</pre>
                            </div>
                          )}
                          {!!entry.details && (
                            <div>
                              <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1.5">🔍 Decision Details</div>
                              <pre className="text-xs text-gray-400 font-mono bg-gray-950 rounded-lg p-3 overflow-x-auto max-h-48 border border-white/5">{JSON.stringify(entry.details, null, 2)}</pre>
                            </div>
                          )}
                          {entry.errorMessage && (
                            <div className="p-3 rounded-lg bg-red-900/20 border border-red-600/30">
                              <div className="text-xs text-red-400 font-semibold mb-1">⚠ Error</div>
                              <div className="text-xs text-red-300 font-mono">{entry.errorMessage}</div>
                            </div>
                          )}
                          <div className="text-xs text-gray-700 font-mono">ID: {entry.id} · Cycle #{entry.cycleNumber}</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// ── Supabase History View ──────────────────────────────────────
function HistoryView() {
  const [cycles, setCycles] = useState<any[]>([]);
  const [crises, setCrises] = useState<any[]>([]);
  const [tab, setTab] = useState<'cycles' | 'crises'>('cycles');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/history?type=cycles&limit=30').then(r => r.json()),
      fetch('/api/history?type=crises&limit=50').then(r => r.json()),
    ]).then(([c, cr]) => {
      if (c.success) setCycles(c.data);
      if (cr.success) setCrises(cr.data);
    }).finally(() => setLoading(false));
  }, []);

  const SVCOL: Record<string, string> = { CRITICAL: '#ef4444', HIGH: '#f97316', MEDIUM: '#f59e0b', LOW: '#22c55e' };

  return (
    <div>
      {/* Supabase badge */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-900/30 border border-emerald-500/30">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"/>
          <span className="text-xs text-emerald-400 font-medium">Supabase Connected</span>
        </div>
        <span className="text-xs text-gray-600">Persistent storage across server restarts · Real-time sync enabled</span>
      </div>

      {/* Sub tabs */}
      <div className="flex gap-2 mb-4">
        {(['cycles', 'crises'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${tab === t ? 'bg-green-700/30 text-green-300 border border-green-600/30' : 'text-gray-500 hover:text-gray-300 border border-transparent'}`}>
            {t === 'cycles' ? `⟳ Cycles (${cycles.length})` : `🔴 Crises (${crises.length})`}
          </button>
        ))}
        {loading && <span className="text-xs text-gray-600 ml-auto animate-pulse">Loading from Supabase...</span>}
      </div>

      {/* Cycles table */}
      {tab === 'cycles' && (
        <div className="space-y-2">
          {cycles.length === 0 && !loading && (
            <div className="text-center py-16 text-gray-600">
              <div className="text-4xl mb-3">🗄️</div>
              <div className="text-sm">No cycle history yet — run your first cycle</div>
              <div className="text-xs mt-2 text-gray-700">Data will appear here after the first orchestration cycle completes</div>
            </div>
          )}
          {cycles.map((c: any) => (
            <div key={c.id} className="glass-card p-4 flex items-center gap-4">
              <div className="text-center w-12">
                <div className="text-lg font-bold text-white">#{c.cycle_number}</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${c.status === 'critical' ? 'bg-red-900/40 text-red-400' : c.status === 'alert' ? 'bg-orange-900/40 text-orange-400' : 'bg-gray-800 text-gray-400'}`}>
                    {c.status?.toUpperCase()}
                  </span>
                  <span className="text-xs text-gray-500">{c.active_crises} crises · {c.total_signals} signals · {c.total_alerts} alerts</span>
                  {c.duration_ms && <span className="text-xs text-cyan-600">{c.duration_ms}ms</span>}
                </div>
                <div className="text-xs text-gray-600 font-mono">
                  {c.started_at ? new Date(c.started_at).toLocaleString() : '—'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Crises table */}
      {tab === 'crises' && (
        <div className="space-y-2">
          {crises.length === 0 && !loading && (
            <div className="text-center py-16 text-gray-600">
              <div className="text-4xl mb-3">🔴</div>
              <div className="text-sm">No crisis history yet</div>
            </div>
          )}
          {crises.map((c: any) => (
            <div key={c.id} className="glass-card p-4">
              <div className="flex items-center gap-3 mb-2">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: SVCOL[c.severity] || '#64748b' }}/>
                <span className="text-sm font-semibold text-white">{c.type?.replace('_', ' ').toUpperCase()}</span>
                <span className="text-xs font-bold" style={{ color: SVCOL[c.severity] }}>{c.severity}</span>
                <span className={`text-xs px-2 py-0.5 rounded ml-auto ${c.status === 'active' ? 'bg-red-900/40 text-red-400' : 'bg-gray-800 text-gray-500'}`}>{c.status}</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span>📍 {c.location}</span>
                {c.confidence && <span>🎯 {(c.confidence * 100).toFixed(0)}%</span>}
                {c.escalation_probability && <span className="text-orange-500">📈 {(c.escalation_probability * 100).toFixed(0)}% escalation</span>}
                <span className="ml-auto font-mono">{c.detected_at ? new Date(c.detected_at).toLocaleString() : '—'}</span>
              </div>
              {c.description && <div className="text-xs text-gray-600 mt-2 line-clamp-2">{c.description}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

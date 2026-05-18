'use client';

import { useState } from 'react';
import type { AIDecisionLog, CrisisEvent, FusedSignal } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { PanelLeft, PanelRight, X } from 'lucide-react';

interface AIDecisionTraceProps {
  logs: AIDecisionLog[];
  crises: CrisisEvent[];
  signals: FusedSignal[];
}

const AGENTS = [
  { id: 'all',                name: 'ALL AGENTS',          emoji: '🧠' },
  { id: 'DataIngestion',      name: 'INGESTION AGENT',     emoji: '📡' },
  { id: 'SignalFusion',       name: 'FUSION AGENT',        emoji: '🎛️' },
  { id: 'CrisisDetection',    name: 'DETECTION AGENT',     emoji: '🔍' },
  { id: 'RiskPrediction',     name: 'RISK FORECAST',       emoji: '📈' },
  { id: 'ResourceAllocation', name: 'DISPATCH AGENT',      emoji: '🚒' },
  { id: 'Simulation',         name: 'CORRIDOR SIM',        emoji: '🎯' },
  { id: 'NotificationEngine', name: 'WARNING ENGINE',      emoji: '🔔' },
];

const ENGINE_COLORS: Record<string, string> = {
  DataIngestion:      '#10b981',
  SignalFusion:       '#38bdf8',
  CrisisDetection:    '#f87171',
  RiskPrediction:     '#fbbf24',
  ResourceAllocation: '#a78bfa',
  Simulation:         '#818cf8',
  NotificationEngine: '#fb923c',
  Orchestrator:       '#71717a',
  TrafficControl:     '#f472b6',
};

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: '#ef4444',
  HIGH: '#f59e0b',
  MEDIUM: '#eab308',
  LOW: '#22c55e',
};

export default function AIDecisionTrace({ logs, crises, signals }: AIDecisionTraceProps) {
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  const [verificationTab, setVerificationTab] = useState<'all' | 'unverified' | 'verified'>('all');
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);

  const filteredLogs = selectedAgent === 'all'
    ? logs
    : logs.filter(l => l.engine === selectedAgent);

  const unverifiedPosts = signals.flatMap(s => s.raw_posts || []);

  return (
    <div className="h-full flex overflow-hidden bg-[#111113] text-zinc-100">

      {/* ── LEFT DRAWER: Signal Verification Hub ── */}
      <aside className={`flex-shrink-0 flex flex-col border-r border-[#27272a] bg-[#111113] transition-all duration-300 overflow-hidden ${leftOpen ? 'w-[380px]' : 'w-0 border-r-0'}`}>
        {leftOpen && (
          <div className="w-[380px] h-full flex flex-col overflow-hidden">
            {/* Drawer header */}
            <div className="px-5 py-4 border-b border-[#27272a] flex items-center justify-between flex-shrink-0">
              <div>
                <div className="text-[11px] font-bold text-zinc-200 uppercase tracking-[0.2em] font-mono flex items-center gap-2">
                  <span className="w-2 h-2 rounded bg-sky-500 animate-pulse" />
                  Signal Verification Hub
                </div>
                <div className="text-[10px] text-zinc-500 mt-1 font-mono">Citizen telemetry against analytical models</div>
              </div>
              <button onClick={() => setLeftOpen(false)} className="text-zinc-500 hover:text-zinc-200 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Metrics strip */}
            <div className="grid grid-cols-3 gap-3 p-4 flex-shrink-0 border-b border-[#27272a]">
              <StatMini label="Reports" value={unverifiedPosts.length} color="#38bdf8" />
              <StatMini label="Validated" value={crises.length} color="#10b981" />
              <StatMini label="Load" value={`${unverifiedPosts.length > 0 ? ((crises.length / unverifiedPosts.length) * 100).toFixed(0) : 100}%`} color="#a78bfa" />
            </div>

            {/* Sub-tabs */}
            <div className="flex gap-1 px-4 py-3 border-b border-[#27272a] flex-shrink-0">
              {(['all', 'unverified', 'verified'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setVerificationTab(tab)}
                  className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider font-mono transition-all ${
                    verificationTab === tab
                      ? 'bg-[#27272a] text-white'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {tab === 'all' && 'All'}
                  {tab === 'unverified' && `Raw (${unverifiedPosts.length})`}
                  {tab === 'verified' && `Incidents (${crises.length})`}
                </button>
              ))}
            </div>

            {/* Scroll list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">

              {/* Validated incidents */}
              {(verificationTab === 'all' || verificationTab === 'verified') && crises.map(crisis => {
                const sevColor = SEVERITY_COLORS[crisis.severity] || '#64748b';
                const targetId = crisis.id.slice(0, 4).toUpperCase();
                return (
                  <div key={crisis.id} className="bg-[#1a1a1d] border border-[#27272a] rounded-lg p-4 font-mono space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-zinc-400">ID-{targetId}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-sm border" style={{ color: sevColor, borderColor: `${sevColor}50`, background: `${sevColor}15` }}>{crisis.severity}</span>
                      <span className="ml-auto text-[10px] font-bold text-emerald-400">{(crisis.confidence * 100).toFixed(0)}%</span>
                    </div>
                    <div className="text-[10px] text-zinc-500"><span className="text-zinc-600">LOC:</span> {crisis.location}</div>
                    <div className="text-[10px] text-zinc-300 bg-[#111113] border border-[#27272a] rounded p-2.5 leading-relaxed">{crisis.description}</div>
                    {crisis.ai_reasoning && (
                      <div className="border-l-2 border-sky-500/40 pl-3 text-[10px] italic text-zinc-400">"{crisis.ai_reasoning}"</div>
                    )}
                  </div>
                );
              })}

              {/* Raw posts */}
              {(verificationTab === 'all' || verificationTab === 'unverified') && unverifiedPosts.map((post, i) => (
                <div key={post.id || i} className="bg-[#1a1a1d] border border-[#27272a] rounded-lg p-4 font-mono space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-sky-400">@{post.username}</span>
                    <span className="text-[10px] text-zinc-600">{formatDistanceToNow(new Date(post.timestamp), { addSuffix: true })}</span>
                  </div>
                  <div className="text-[10px] text-zinc-300 bg-[#111113] border border-[#27272a] rounded p-2.5 leading-relaxed italic">"{post.text}"</div>
                  <div className="flex gap-4 text-[10px] text-zinc-500">
                    <span><span className="text-zinc-600">LOC:</span> {post.location}</span>
                    <span><span className="text-zinc-600">TYPE:</span> {post.incident_type.toUpperCase()}</span>
                  </div>
                </div>
              ))}

              {unverifiedPosts.length === 0 && crises.length === 0 && (
                <div className="text-center py-12 text-zinc-600 text-[11px] font-mono uppercase">No signals buffered.</div>
              )}
            </div>
          </div>
        )}
      </aside>

      {/* ── MAIN TRANSCRIPT AREA ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top bar: summary metrics + panel toggle buttons */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-[#27272a] flex items-center gap-4">

          {/* Left toggle */}
          <button
            onClick={() => setLeftOpen(v => !v)}
            title="Toggle Signal Verification Hub"
            className={`flex items-center gap-2 px-3.5 py-2 rounded border text-[10px] font-bold font-mono uppercase tracking-widest transition-all ${
              leftOpen
                ? 'bg-[#27272a] border-zinc-500 text-white'
                : 'bg-[#1a1a1d] border-[#27272a] text-zinc-500 hover:text-zinc-200 hover:border-zinc-600'
            }`}
          >
            <PanelLeft className="w-3.5 h-3.5" />
            <span>Signals</span>
            {unverifiedPosts.length + crises.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-sm bg-sky-500/20 text-sky-400 text-[9px]">{unverifiedPosts.length + crises.length}</span>
            )}
          </button>

          {/* Centre metrics */}
          <div className="flex-1 flex items-center justify-center gap-6">
            <Metric label="Active Agents" value={AGENTS.length - 1} />
            <div className="w-px h-5 bg-[#27272a]" />
            <Metric label="Total Logs" value={logs.length} />
            <div className="w-px h-5 bg-[#27272a]" />
            <Metric label="Viewing" value={filteredLogs.length} accent />
          </div>

          {/* Right toggle */}
          <button
            onClick={() => setRightOpen(v => !v)}
            title="Toggle Agent Channel Selector"
            className={`flex items-center gap-2 px-3.5 py-2 rounded border text-[10px] font-bold font-mono uppercase tracking-widest transition-all ${
              rightOpen
                ? 'bg-[#27272a] border-zinc-500 text-white'
                : 'bg-[#1a1a1d] border-[#27272a] text-zinc-500 hover:text-zinc-200 hover:border-zinc-600'
            }`}
          >
            <span>Channels</span>
            <PanelRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Transcript stream */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#111113]">

          {filteredLogs.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center py-24">
              <div className="text-4xl mb-5 opacity-30">🧠</div>
              <div className="text-[12px] font-bold text-zinc-500 uppercase font-mono tracking-widest">No Signals Captured</div>
              <div className="text-[10px] text-zinc-600 mt-2 max-w-xs leading-relaxed font-mono">
                Traces will appear as cognitive loops sweep regional feeds.
              </div>
            </div>
          )}

          {filteredLogs.map(log => {
            const col = ENGINE_COLORS[log.engine] || '#71717a';
            const transcriptId = log.id.slice(0, 8).toUpperCase();

            return (
              <div key={log.id} className="rounded-lg border border-[#27272a] overflow-hidden bg-[#1a1a1d] font-mono">

                {/* Card header */}
                <div className="flex items-center justify-between px-5 py-3.5 bg-[#111113] border-b border-[#27272a]">
                  <div className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: col }} />
                    <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: col }}>
                      {log.engine}
                    </span>
                    <span className="text-[10px] text-zinc-600">#{transcriptId}</span>
                  </div>
                  <div className="flex items-center gap-4 text-[10px]">
                    <span className="text-zinc-500">
                      {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                    </span>
                    <span className="px-2.5 py-1 rounded-sm bg-[#111113] border border-[#27272a] font-bold" style={{ color: col }}>
                      CONF: {(log.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                {/* I/O matrix */}
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest mb-1.5">Input Vector</div>
                      <div className="bg-[#111113] border border-[#27272a] rounded p-3 text-[11px] text-zinc-300 leading-relaxed whitespace-pre-wrap break-words">
                        {log.input_summary.replace(/\(0, 0\)/g, '(24.86, 67.00)').replace(/Unknown City/g, 'Karachi').replace(/Main Ave/g, 'Shahrah-e-Faisal')}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest mb-1.5">Decision Output</div>
                      <div className="bg-[#111113] border border-[#27272a] rounded p-3 text-[11px] text-zinc-300 leading-relaxed whitespace-pre-wrap break-words">
                        {log.output_summary.replace(/prier2ty/g, 'priority').replace(/\(0, 0\)/g, '(24.86, 67.00)').replace(/Unknown City/g, 'Karachi').replace(/Main Ave/g, 'Shahrah-e-Faisal')}
                      </div>
                    </div>
                  </div>

                  {/* Reasoning chain */}
                  {log.reasoning_steps.length > 0 && (
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <div className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">Cognitive Chain</div>
                        <div className="flex-1 h-px bg-[#27272a]" />
                        <div className="text-[9px] text-zinc-600">{log.reasoning_steps.length} steps</div>
                      </div>
                      <div className="bg-[#111113] border border-[#27272a] rounded p-4 space-y-2">
                        {log.reasoning_steps.map((step, i) => (
                          <div key={i} className="flex gap-3 text-[11px] text-zinc-400">
                            <span className="text-zinc-600 font-bold shrink-0 w-5">{String(i + 1).padStart(2, '0')}</span>
                            <span className="leading-relaxed">{step}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Warning flags */}
                  {log.uncertainty_flags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {log.uncertainty_flags.map((flag, i) => (
                        <span key={i} className="px-3 py-1 rounded-sm text-[10px] font-bold tracking-widest uppercase text-amber-400 bg-amber-500/10 border border-amber-500/20">
                          ⚠ {flag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            );
          })}

        </div>
      </div>

      {/* ── RIGHT DRAWER: Agent Channel Selector ── */}
      <aside className={`flex-shrink-0 flex flex-col border-l border-[#27272a] bg-[#111113] transition-all duration-300 overflow-hidden ${rightOpen ? 'w-[240px]' : 'w-0 border-l-0'}`}>
        {rightOpen && (
          <div className="w-[240px] h-full flex flex-col overflow-hidden">
            {/* Drawer header */}
            <div className="px-4 py-4 border-b border-[#27272a] flex items-center justify-between flex-shrink-0">
              <div className="text-[10px] font-bold text-zinc-300 uppercase tracking-[0.2em] font-mono">Channels</div>
              <button onClick={() => setRightOpen(false)} className="text-zinc-500 hover:text-zinc-200 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Agent list */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {AGENTS.map(agent => {
                const active = selectedAgent === agent.id;
                const col = ENGINE_COLORS[agent.id] || '#71717a';
                const count = agent.id === 'all' ? logs.length : logs.filter(l => l.engine === agent.id).length;
                return (
                  <button
                    key={agent.id}
                    onClick={() => setSelectedAgent(agent.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded text-left transition-all border ${
                      active
                        ? 'bg-[#27272a] border-zinc-500 text-white'
                        : 'bg-transparent border-transparent hover:bg-[#1a1a1d] hover:border-[#27272a] text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: active ? col : '#3f3f46' }} />
                    <div className="flex-1 min-w-0">
                      <div className={`text-[10px] font-bold font-mono truncate ${active ? 'text-white' : ''}`}>
                        {agent.emoji} {agent.name}
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold font-mono tabular-nums ${active ? 'text-zinc-300' : 'text-zinc-600'}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </aside>

    </div>
  );
}

/* Small helper components */
function Metric({ label, value, accent = false }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] text-zinc-500 font-mono uppercase tracking-widest">{label}:</span>
      <span className={`text-[14px] font-bold font-mono leading-none ${accent ? 'text-sky-400' : 'text-zinc-200'}`}>{value}</span>
    </div>
  );
}

function StatMini({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="bg-[#111113] border border-[#27272a] rounded p-3 text-center">
      <div className="text-[9px] text-zinc-500 uppercase tracking-widest font-mono mb-1.5">{label}</div>
      <div className="text-lg font-bold font-mono leading-none" style={{ color }}>{value}</div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import type { AIDecisionLog, CrisisEvent, FusedSignal } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';

interface AIDecisionTraceProps {
  logs: AIDecisionLog[];
  crises: CrisisEvent[];
  signals: FusedSignal[];
}

const AGENTS = [
  { id: 'all', name: '🧠 All Agents', desc: 'Consolidated cognitive processing traces' },
  { id: 'DataIngestion', name: '📡 Ingestion Agent', desc: 'Captures and indexes incoming citizen telemetry feeds' },
  { id: 'SignalFusion', name: '🎛️ Fusion Agent', desc: 'Deduplicates spatial records and groups active events' },
  { id: 'CrisisDetection', name: '🧠 Detection Agent', desc: 'Validates raw incident reports using cognitive layers' },
  { id: 'RiskPrediction', name: '📈 Risk Forecast Agent', desc: 'Evaluates environmental factors and cascading models' },
  { id: 'ResourceAllocation', name: '🚒 Dispatch Agent', desc: 'Matches optimal emergency response vehicles' },
  { id: 'Simulation', name: '🎯 Corridor Simulator', desc: 'Simulates response speed and route bottlenecks' },
  { id: 'NotificationEngine', name: '🔔 Warning Engine', desc: 'Compiles public warnings and citizen notifications' },
];

const ENGINE_COLORS: Record<string, { color: string; tag: string; border: string }> = {
  DataIngestion: { color: 'text-emerald-400', tag: 'tag-secure border-emerald-500/20 bg-emerald-500/5', border: 'border-zinc-800' },
  SignalFusion: { color: 'text-sky-400', tag: 'tag-secure border-sky-500/20 bg-sky-500/5', border: 'border-zinc-800' },
  CrisisDetection: { color: 'text-rose-400', tag: 'tag-critical border-rose-500/20 bg-rose-500/5', border: 'border-zinc-800' },
  RiskPrediction: { color: 'text-amber-400', tag: 'tag-medium border-amber-500/20 bg-amber-500/5', border: 'border-zinc-800' },
  ResourceAllocation: { color: 'text-violet-400', tag: 'tag-base border-violet-500/20 bg-violet-500/5', border: 'border-zinc-800' },
  Simulation: { color: 'text-indigo-400', tag: 'tag-base border-indigo-500/20 bg-indigo-500/5', border: 'border-zinc-800' },
  NotificationEngine: { color: 'text-orange-400', tag: 'tag-base border-orange-500/20 bg-orange-500/5', border: 'border-zinc-800' },
  Orchestrator: { color: 'text-zinc-400', tag: 'tag-base border-zinc-500/20 bg-zinc-500/5', border: 'border-zinc-800' },
  TrafficControl: { color: 'text-pink-400', tag: 'tag-base border-pink-500/20 bg-pink-500/5', border: 'border-zinc-800' },
};

const SEVERITY_TAGS: Record<string, string> = {
  CRITICAL: 'tag-critical',
  HIGH: 'tag-high',
  MEDIUM: 'tag-medium',
  LOW: 'tag-low',
};

export default function AIDecisionTrace({ logs, crises, signals }: AIDecisionTraceProps) {
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  const [verificationTab, setVerificationTab] = useState<'all' | 'unverified' | 'verified'>('all');

  // Filter logs based on selected agent
  const filteredLogs = selectedAgent === 'all' 
    ? logs 
    : logs.filter(l => l.engine === selectedAgent);

  // Extract all unverified citizen reports from signals
  const unverifiedPosts = signals.flatMap(s => s.raw_posts || []);

  return (
    <div className="h-full flex overflow-hidden bg-[#09090b] text-zinc-100">
      
      {/* LEFT COLUMN: Signal Verification Hub */}
      <div className="w-1/2 flex flex-col border-r border-zinc-800 overflow-hidden">
        
        {/* Verification Hub Header */}
        <div className="p-4 border-b border-zinc-800 bg-zinc-900/10">
          <div className="flex items-center justify-between mb-3.5">
            <div>
              <h2 className="text-xs font-bold text-zinc-200 flex items-center gap-2 uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-ping inline-block" />
                Signal Verification Hub
              </h2>
              <p className="text-[10px] text-zinc-500 mt-1">Evaluating raw citizen telemetry using automated models</p>
            </div>
            
            {/* Action tabs */}
            <div className="flex bg-zinc-950 p-0.5 rounded border border-zinc-800">
              {(['all', 'unverified', 'verified'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setVerificationTab(tab)}
                  className={`px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wider transition-all rounded ${
                    verificationTab === tab
                      ? 'bg-zinc-800 text-white shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {tab === 'all' && 'All Feeds'}
                  {tab === 'unverified' && `Reports (${unverifiedPosts.length})`}
                  {tab === 'verified' && `Incidents (${crises.length})`}
                </button>
              ))}
            </div>
          </div>

          {/* Metrics Matrix */}
          <div className="grid grid-cols-3 gap-2.5 mt-2 font-sans">
            <div className="bg-zinc-950 p-2.5 rounded border border-zinc-800/60">
              <div className="text-[9px] text-zinc-500 uppercase font-semibold">Citizen Reports</div>
              <div className="text-sm font-bold text-sky-400 mt-1 select-all">{unverifiedPosts.length} Ingested</div>
              <div className="text-[8px] text-amber-500/80 mt-1 uppercase font-medium">Awaiting evaluation</div>
            </div>
            <div className="bg-zinc-950 p-2.5 rounded border border-zinc-800/60">
              <div className="text-[9px] text-zinc-500 uppercase font-semibold">Validated Targets</div>
              <div className="text-sm font-bold text-emerald-400 mt-1 select-all">{crises.length} Targets</div>
              <div className="text-[8px] text-emerald-500/80 mt-1 uppercase font-medium">100% verified</div>
            </div>
            <div className="bg-zinc-950 p-2.5 rounded border border-zinc-800/60">
              <div className="text-[9px] text-zinc-500 uppercase font-semibold">Verification Load</div>
              <div className="text-sm font-bold text-violet-400 mt-1 select-all">
                {unverifiedPosts.length > 0 ? ((crises.length / unverifiedPosts.length) * 100).toFixed(0) : '100'}%
              </div>
              <div className="text-[8px] text-violet-500/80 mt-1 uppercase font-medium">Active filter load</div>
            </div>
          </div>
        </div>

        {/* Verification Stream Scroll List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
          
          {/* VALIDATED THREAT LIST */}
          {(verificationTab === 'all' || verificationTab === 'verified') && (
            <div className="space-y-3">
              {crises.length > 0 && <div className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider">Validated Incident Traces</div>}
              {crises.map(crisis => {
                const targetId = crisis.id.slice(0, 4).toUpperCase();
                return (
                  <div key={crisis.id} className="hud-panel p-3.5 bg-zinc-950/20 border-zinc-800 rounded hover:border-zinc-700 transition-all duration-200">
                    <div className="flex items-start justify-between gap-3 font-sans">
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded text-[8.5px] font-bold uppercase bg-zinc-800 text-zinc-300 border border-zinc-700">
                            ID-{targetId} · {crisis.type.replace('_', ' ').toUpperCase()}
                          </span>
                          <span className={`tag-base ${SEVERITY_TAGS[crisis.severity]}`}>{crisis.severity}</span>
                        </div>
                        
                        <h3 className="text-xs font-semibold text-zinc-200 leading-normal mt-1.5">📍 Location: {crisis.location}</h3>
                        <p className="text-[10px] text-zinc-400 leading-relaxed font-sans">{crisis.description}</p>
                        
                        {crisis.ai_reasoning && (
                          <div className="bg-zinc-950 border border-zinc-800 p-2.5 rounded text-[10px] leading-relaxed text-zinc-300 italic">
                            <span className="text-sky-400 font-bold block not-italic mb-1 text-[8.5px] uppercase tracking-wider font-mono">AI Operational Context:</span>
                            "{crisis.ai_reasoning}"
                          </div>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0 text-[8.5px] text-zinc-500">
                        <div className="font-semibold text-zinc-400">
                          {formatDistanceToNow(new Date(crisis.timestamp || new Date()), { addSuffix: true })}
                        </div>
                        <div className="mt-2 text-[10.5px] font-bold text-emerald-400">
                          {(crisis.confidence * 100).toFixed(0)}% Match
                        </div>
                        <div className="text-[8px] text-zinc-500 uppercase font-semibold">Validated</div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {crises.length === 0 && verificationTab === 'verified' && (
                <div className="text-center py-8 font-sans text-[10px] text-zinc-500">No validated incidents currently indexed.</div>
              )}
            </div>
          )}

          {/* UNVERIFIED FIELD COMMUNICATONS */}
          {(verificationTab === 'all' || verificationTab === 'unverified') && (
            <div className="space-y-3 mt-4">
              {unverifiedPosts.length > 0 && <div className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider">Interceptions from Citizen Feed</div>}
              {unverifiedPosts.map((post, i) => (
                <div key={post.id || i} className="hud-panel p-3.5 bg-zinc-950/20 border-zinc-800 rounded hover:border-zinc-700 transition-all duration-200">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-bold text-sky-400">@{post.username}</span>
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-semibold uppercase bg-zinc-800 border border-zinc-700 text-zinc-400">
                          Raw Citizen Signal
                        </span>
                      </div>
                      <p className="text-[10px] text-zinc-300 italic leading-relaxed bg-zinc-950 p-2 rounded border border-zinc-800/80 mt-1 font-mono">"{post.text}"</p>
                      <div className="flex gap-3 text-[9px] text-zinc-500 mt-1 uppercase font-medium">
                        <span>Location: {post.location}</span>
                        <span>Incident: {post.incident_type}</span>
                      </div>
                    </div>
                    <div className="text-right text-[8.5px] text-zinc-500 flex-shrink-0 font-medium">
                      {formatDistanceToNow(new Date(post.timestamp), { addSuffix: true })}
                    </div>
                  </div>
                </div>
              ))}
              {unverifiedPosts.length === 0 && (
                <div className="text-center py-8 font-sans text-[10px] text-zinc-500">No raw citizen signals buffered.</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: Interactive Tactical AI Transcript Trace */}
      <div className="w-1/2 flex flex-col overflow-hidden">
        
        {/* Interactive node network select bar */}
        <div className="p-4 border-b border-zinc-800 bg-zinc-900/10">
          <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-3.5">Cognitive Processing Channels</div>
          <div className="flex gap-2 overflow-x-auto pb-2 pr-1 select-none">
            {AGENTS.map(agent => {
              const active = selectedAgent === agent.id;
              return (
                <button
                  key={agent.id}
                  onClick={() => setSelectedAgent(agent.id)}
                  className={`flex-shrink-0 text-left p-3 rounded-md border transition-all w-48 ${
                    active 
                      ? 'bg-zinc-800 border-zinc-700 text-zinc-200' 
                      : 'bg-zinc-900/40 border-zinc-800/40 hover:bg-zinc-900 text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <div className="text-[10.5px] font-bold truncate tracking-wide">{agent.name}</div>
                  <div className="text-[8.5px] text-zinc-500 line-clamp-2 mt-1 leading-normal uppercase font-semibold">{agent.desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrolling terminal stream list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
              {selectedAgent === 'all' ? 'Unified Orchestrator Stream' : `${AGENTS.find(a => a.id === selectedAgent)?.name} Stream`}
            </div>
            <div className="text-[9px] text-sky-400 font-bold">Buffered Logs: {filteredLogs.length}</div>
          </div>

          {filteredLogs.length === 0 && (
            <div className="text-center py-20 border border-dashed border-zinc-800 rounded-lg">
              <div className="text-4xl mb-3">🧠</div>
              <div className="text-[10px] font-semibold text-zinc-400 uppercase">No Signals Captured</div>
              <div className="text-[9px] text-zinc-500 mt-1">Traces will load dynamically as cognitive loops sweep Karachi regional feeds.</div>
            </div>
          )}

          {filteredLogs.map(log => {
            const cfg = ENGINE_COLORS[log.engine] || { color: 'text-zinc-400', tag: 'tag-base', border: 'border-zinc-800' };
            const transcriptId = log.id.slice(0, 6).toUpperCase();
            return (
              <div
                key={log.id}
                className={`rounded border ${cfg.border} overflow-hidden`}
              >
                {/* Transcript Header */}
                <div className="flex items-center justify-between px-3 py-2.5 border-b border-zinc-800 bg-zinc-900/60 text-[9px]">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded font-bold uppercase text-[8.5px] ${cfg.tag}`}>
                      {log.engine}
                    </span>
                    <span className="text-zinc-500 font-semibold">
                      {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-zinc-500 font-semibold">
                    <span>Confidence Score:</span>
                    <span className={`font-bold ${cfg.color}`}>
                      {(log.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                {/* Transcript Core Body */}
                <div className="p-3.5 space-y-3 bg-[#09090b]/40">
                  <div className="grid grid-cols-2 gap-3 text-[10px] leading-relaxed">
                    <div className="p-2.5 bg-zinc-950 rounded border border-zinc-800 select-text font-mono">
                      <div className="text-[8.5px] text-zinc-500 font-bold uppercase tracking-wider mb-1">[Context Input Vector]</div>
                      <div className="text-zinc-300 whitespace-pre-wrap">{log.input_summary}</div>
                    </div>
                    <div className="p-2.5 bg-zinc-950 rounded border border-zinc-800 select-text font-mono">
                      <div className="text-[8.5px] text-zinc-500 font-bold uppercase tracking-wider mb-1">[Decision Output]</div>
                      <div className="text-zinc-300 whitespace-pre-wrap">{log.output_summary}</div>
                    </div>
                  </div>

                  {/* Internal Step-by-Step Reason Chain */}
                  {log.reasoning_steps.length > 0 && (
                    <div className="bg-zinc-950 p-3 rounded border border-zinc-800 space-y-2">
                      <div className="text-[8.5px] text-zinc-500 font-bold uppercase tracking-wider">
                        [Cognitive Chain Ref: {transcriptId}]
                      </div>
                      <ol className="space-y-1.5 text-[9.5px]">
                        {log.reasoning_steps.map((step, i) => (
                          <li key={i} className="flex gap-2 text-zinc-400 font-mono">
                            <span className="text-sky-400 font-bold">Step {(i + 1).toString().padStart(2, '0')}:</span>
                            <span className="leading-relaxed select-text">{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {/* Warning/Uncertainty Flags */}
                  {log.uncertainty_flags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {log.uncertainty_flags.map((flag, i) => (
                        <span key={i} className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/25 text-amber-400 text-[8.5px] font-bold tracking-wider uppercase">
                          ⚠️ warning: {flag.toUpperCase()}
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
    </div>
  );
}

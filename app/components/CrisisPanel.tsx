'use client';

import { useState } from 'react';
import type { CrisisEvent, FusedSignal } from '@/lib/types';

interface CrisisPanelProps {
  crises: CrisisEvent[];
  signals: FusedSignal[];
}

const CRISIS_ICONS: Record<string, string> = {
  fire: '🔥', flood: '🌊', accident: '🚗', heatwave: '☀️',
  power_outage: '⚡', protest: '📢', robbery: '🚨',
  infrastructure_failure: '🏗️', unknown: '❓',
};

export default function CrisisPanel({ crises, signals }: CrisisPanelProps) {
  const [view, setView] = useState<'crises' | 'signals'>('crises');
  const [expanded, setExpanded] = useState<string | null>(null);

  const active = crises.filter(c => c.status === 'active').sort((a, b) => {
    const rank: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    return (rank[b.severity] || 0) - (rank[a.severity] || 0);
  });
  const resolved = crises.filter(c => c.status === 'resolved');

  return (
    <div className="flex flex-col h-full bg-gray-950">
      {/* Panel Header */}
      <div className="p-3 border-b border-white/5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-white tracking-wider">CRISIS EVENTS</span>
          <span className="text-xs text-gray-600">{active.length} active</span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setView('crises')}
            className={`flex-1 py-1 text-xs rounded-md transition-all ${view === 'crises' ? 'bg-blue-700/40 text-blue-300' : 'text-gray-500 hover:text-gray-300'}`}
          >
            Events ({crises.length})
          </button>
          <button
            onClick={() => setView('signals')}
            className={`flex-1 py-1 text-xs rounded-md transition-all ${view === 'signals' ? 'bg-blue-700/40 text-blue-300' : 'text-gray-500 hover:text-gray-300'}`}
          >
            Signals ({signals.length})
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {view === 'crises' ? (
          <>
            {active.length === 0 && (
              <div className="text-center py-8">
                <div className="text-2xl mb-2">✅</div>
                <div className="text-xs text-gray-600">No active incidents detected</div>
                <div className="text-xs text-gray-700 mt-1">Run a cycle to scan for events</div>
              </div>
            )}
            {active.map(crisis => (
              <div
                key={crisis.id}
                className={`rounded-xl border cursor-pointer transition-all animate-fade-in ${
                  crisis.severity === 'CRITICAL' ? 'glass-card-danger' : 'glass-card'
                } ${expanded === crisis.id ? 'ring-1 ring-blue-500/30' : ''}`}
                onClick={() => setExpanded(expanded === crisis.id ? null : crisis.id)}
              >
                <div className="p-3">
                  <div className="flex items-start gap-2">
                    <span className="text-xl flex-shrink-0">{CRISIS_ICONS[crisis.type] || '❓'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`badge-${crisis.severity.toLowerCase()}`}>{crisis.severity}</span>
                        <span className="text-xs text-gray-300 font-medium capitalize">
                          {crisis.type.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5 truncate">📍 {crisis.location}</div>
                    </div>
                  </div>

                  {/* Confidence bar */}
                  <div className="mt-2">
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>Confidence</span>
                      <span>{(crisis.confidence * 100).toFixed(0)}%</span>
                    </div>
                    <div className="confidence-bar">
                      <div
                        className="confidence-fill"
                        style={{
                          width: `${crisis.confidence * 100}%`,
                          background: crisis.confidence > 0.7 ? '#22c55e' : crisis.confidence > 0.4 ? '#f59e0b' : '#ef4444',
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Expanded Detail */}
                {expanded === crisis.id && (
                  <div className="px-3 pb-3 border-t border-white/5 mt-1 pt-2 space-y-2 animate-fade-in">
                    <p className="text-xs text-gray-400 leading-relaxed">{crisis.description}</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-white/5 rounded-lg p-2">
                        <div className="text-gray-600">Radius</div>
                        <div className="text-white font-bold">{crisis.affected_radius_km} km</div>
                      </div>
                      <div className="bg-white/5 rounded-lg p-2">
                        <div className="text-gray-600">Duration</div>
                        <div className="text-white font-bold">{crisis.expected_duration_hours}h</div>
                      </div>
                      {crisis.escalation_probability !== undefined && (
                        <div className="bg-white/5 rounded-lg p-2">
                          <div className="text-gray-600">Escalation</div>
                          <div className="text-orange-400 font-bold">{(crisis.escalation_probability * 100).toFixed(0)}%</div>
                        </div>
                      )}
                      {crisis.population_impact !== undefined && (
                        <div className="bg-white/5 rounded-lg p-2">
                          <div className="text-gray-600">Impacted</div>
                          <div className="text-white font-bold">{crisis.population_impact.toLocaleString()}</div>
                        </div>
                      )}
                    </div>
                    {crisis.ai_reasoning && (
                      <div className="bg-purple-900/20 border border-purple-500/20 rounded-lg p-2">
                        <div className="text-xs text-purple-400 font-semibold mb-1">🧠 AI Reasoning</div>
                        <p className="text-xs text-gray-400 leading-relaxed">{crisis.ai_reasoning.slice(0, 300)}</p>
                      </div>
                    )}
                    <div className="text-xs text-gray-600">
                      Sources: {crisis.evidence.join(' · ')}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Resolved section */}
            {resolved.length > 0 && (
              <div className="mt-3">
                <div className="text-xs text-gray-600 mb-2 px-1">RESOLVED ({resolved.length})</div>
                {resolved.slice(0, 3).map(c => (
                  <div key={c.id} className="p-2 rounded-lg flex items-center gap-2 opacity-40">
                    <span className="text-sm">{CRISIS_ICONS[c.type] || '❓'}</span>
                    <span className="text-xs text-gray-500 capitalize">{c.type.replace('_', ' ')} — {c.location}</span>
                    <span className="ml-auto text-xs text-green-600">✓</span>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          // Signals view
          <>
            {signals.length === 0 && (
              <div className="text-center py-8 text-xs text-gray-600">No signals yet. Run a cycle.</div>
            )}
            {signals.slice(0, 20).map((sig, i) => (
              <div key={i} className="glass-card p-2.5 rounded-lg animate-fade-in">
                <div className="flex items-center gap-2">
                  <span>{CRISIS_ICONS[sig.event_type] || '📡'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-white capitalize truncate">
                      {sig.event_type.replace('_', ' ')} · {sig.location}
                    </div>
                    <div className="flex gap-2 mt-0.5">
                      <span className={`badge-${sig.urgency_level.toLowerCase()}`}>{sig.urgency_level}</span>
                      <span className="text-xs text-gray-600">{(sig.confidence_score * 100).toFixed(0)}% conf</span>
                    </div>
                  </div>
                </div>
                <div className="text-xs text-gray-600 mt-1.5">{sig.evidence_sources.join(' · ')}</div>
                {sig.raw_posts && sig.raw_posts.length > 0 && (
                  <div className="text-xs text-gray-500 mt-1 italic truncate">
                    "{sig.raw_posts[0].text.slice(0, 60)}..."
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

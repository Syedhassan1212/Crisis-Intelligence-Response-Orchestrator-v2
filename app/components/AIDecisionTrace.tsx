'use client';

import type { AIDecisionLog } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';

interface AIDecisionTraceProps {
  logs: AIDecisionLog[];
}

const ENGINE_COLORS: Record<string, { color: string; bg: string }> = {
  DataIngestion: { color: '#22c55e', bg: '#052e16' },
  SignalFusion: { color: '#06b6d4', bg: '#0e3a4a' },
  CrisisDetection: { color: '#ef4444', bg: '#2d0a0a' },
  RiskPrediction: { color: '#f97316', bg: '#2d1200' },
  ResourceAllocation: { color: '#a855f7', bg: '#1e0a2d' },
  Simulation: { color: '#3b82f6', bg: '#0a1a2d' },
  NotificationEngine: { color: '#f59e0b', bg: '#2d1f00' },
  Orchestrator: { color: '#64748b', bg: '#0f172a' },
  TrafficControl: { color: '#ec4899', bg: '#2d0a1a' },
};

export default function AIDecisionTrace({ logs }: AIDecisionTraceProps) {
  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-bold text-white">AI Decision Trace</h2>
          <p className="text-xs text-gray-500">Full Gemini reasoning transparency — {logs.length} entries</p>
        </div>
        <div className="text-xs text-gray-600 font-mono">ENGINE LOG v2.0</div>
      </div>

      {/* Terminal-style log */}
      <div className="log-terminal space-y-0 mb-4">
        <div className="text-cyan-500 mb-2">$ ciro orchestrator --trace --verbose</div>
        {logs.slice(0, 5).map((log, i) => (
          <div key={log.id} className="log-line">
            <span className="log-time">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
            <span className="log-engine">[{log.engine}]</span>
            <span className="log-content">{log.output_summary.slice(0, 80)}</span>
          </div>
        ))}
        <div className="text-gray-700 mt-1">_</div>
      </div>

      {/* Detailed log cards */}
      {logs.length === 0 && (
        <div className="text-center py-16 text-xs text-gray-600">
          <div className="text-4xl mb-3">🧠</div>
          <div>No AI decisions logged yet</div>
          <div className="mt-1 text-gray-700">Run a cycle to see Gemini reasoning</div>
        </div>
      )}

      <div className="space-y-3">
        {logs.map(log => {
          const cfg = ENGINE_COLORS[log.engine] || { color: '#64748b', bg: '#0f172a' };
          return (
            <div
              key={log.id}
              className="rounded-xl border border-white/5 overflow-hidden animate-fade-in"
              style={{ background: cfg.bg + '80' }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <span
                    className="px-2 py-0.5 rounded text-xs font-bold font-mono"
                    style={{ color: cfg.color, border: `1px solid ${cfg.color}40` }}
                  >
                    {log.engine}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600">conf:</span>
                  <span style={{ color: cfg.color }} className="text-xs font-bold font-mono">
                    {(log.confidence * 100).toFixed(0)}%
                  </span>
                  {log.uncertainty_flags.length > 0 && (
                    <span className="text-xs text-amber-500">⚠ {log.uncertainty_flags.length} flags</span>
                  )}
                </div>
              </div>

              {/* Body */}
              <div className="px-4 py-3 space-y-2">
                <div>
                  <div className="text-xs text-gray-600 mb-0.5">INPUT</div>
                  <div className="text-xs text-gray-300 font-mono">{log.input_summary}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-600 mb-0.5">OUTPUT</div>
                  <div className="text-xs text-gray-300 font-mono">{log.output_summary}</div>
                </div>

                {/* Reasoning steps */}
                {log.reasoning_steps.length > 0 && (
                  <div>
                    <div className="text-xs text-gray-600 mb-1">REASONING STEPS</div>
                    <ol className="space-y-1">
                      {log.reasoning_steps.map((step, i) => (
                        <li key={i} className="flex gap-2 text-xs">
                          <span className="text-gray-600 flex-shrink-0 font-mono">{i + 1}.</span>
                          <span className="text-gray-400">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {/* Uncertainty flags */}
                {log.uncertainty_flags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {log.uncertainty_flags.map((flag, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-full text-xs bg-amber-900/30 border border-amber-600/30 text-amber-400">
                        ⚠ {flag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Confidence bar */}
                <div className="confidence-bar">
                  <div
                    className="confidence-fill"
                    style={{ width: `${log.confidence * 100}%`, background: cfg.color }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

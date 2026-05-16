'use client';

import type { FusedSignal, CrisisEvent } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';

interface TimelineFeedProps {
  signals: FusedSignal[];
  crises: CrisisEvent[];
  cycle: number;
}

const CRISIS_ICONS: Record<string, string> = {
  fire: '🔥', flood: '🌊', accident: '🚗', heatwave: '☀️',
  power_outage: '⚡', protest: '📢', robbery: '🚨',
  infrastructure_failure: '🏗️', unknown: '📡',
};

export default function TimelineFeed({ signals, crises, cycle }: TimelineFeedProps) {
  // Combine and sort events chronologically
  const events = [
    ...crises.map(c => ({
      id: c.id,
      type: 'crisis' as const,
      time: c.timestamp,
      title: `${c.type.replace('_', ' ').toUpperCase()} — ${c.location}`,
      detail: c.description,
      severity: c.severity,
      icon: CRISIS_ICONS[c.type] || '❓',
      confidence: c.confidence,
      extra: `${c.affected_radius_km}km radius · ${c.expected_duration_hours}h expected`,
    })),
    ...signals.map((s, i) => ({
      id: `sig_${i}`,
      type: 'signal' as const,
      time: s.timestamp,
      title: `Signal: ${s.event_type.replace('_', ' ')} at ${s.location}`,
      detail: s.raw_posts?.[0]?.text || 'Signal detected from multiple sources',
      severity: s.urgency_level,
      icon: CRISIS_ICONS[s.event_type] || '📡',
      confidence: s.confidence_score,
      extra: s.evidence_sources.join(' · '),
    })),
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-bold text-white">Live Event Timeline</h2>
          <p className="text-xs text-gray-500">Cycle #{cycle} — {events.length} events</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500/60 inline-block" /> Crisis</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-500/60 inline-block" /> Signal</span>
        </div>
      </div>

      {events.length === 0 && (
        <div className="text-center py-16 text-xs text-gray-600">
          <div className="text-4xl mb-3">📡</div>
          <div>No events in current cycle</div>
          <div className="mt-1 text-gray-700">Run a cycle to begin monitoring</div>
        </div>
      )}

      <div className="relative">
        {/* Timeline line */}
        {events.length > 0 && <div className="absolute left-5 top-0 bottom-0 w-px bg-white/5" />}

        <div className="space-y-3">
          {events.map(event => (
            <div key={event.id} className="relative flex gap-3 animate-fade-in group">
              {/* Icon dot */}
              <div className={`relative z-10 flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg border ${
                event.type === 'crisis'
                  ? 'bg-red-900/30 border-red-500/30'
                  : 'bg-blue-900/20 border-blue-500/20'
              }`}>
                {event.icon}
              </div>

              {/* Content */}
              <div className={`flex-1 glass-card p-3 rounded-xl group-hover:border-white/10 transition-all ${
                event.severity === 'CRITICAL' ? 'border-red-500/20' :
                event.severity === 'HIGH' ? 'border-orange-500/15' : ''
              }`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`badge-${event.severity.toLowerCase()}`}>{event.severity}</span>
                      <span className="text-xs font-semibold text-white">{event.title}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">{event.detail}</p>
                    <div className="text-xs text-gray-600 mt-1">{event.extra}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs text-gray-600">
                      {formatDistanceToNow(new Date(event.time), { addSuffix: true })}
                    </div>
                    <div className="text-xs text-blue-400 mt-1">{(event.confidence * 100).toFixed(0)}%</div>
                  </div>
                </div>
                {/* Confidence bar */}
                <div className="confidence-bar mt-2">
                  <div
                    className="confidence-fill"
                    style={{
                      width: `${event.confidence * 100}%`,
                      background: event.type === 'crisis' ? '#ef4444' : '#3b82f6',
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

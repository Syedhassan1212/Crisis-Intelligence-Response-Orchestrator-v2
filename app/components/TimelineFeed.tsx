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

const SEVERITY_TAGS: Record<string, string> = {
  CRITICAL: 'tag-critical',
  HIGH: 'tag-high',
  MEDIUM: 'tag-medium',
  LOW: 'tag-low',
};

export default function TimelineFeed({ signals, crises, cycle }: TimelineFeedProps) {
  // Combine and sort events chronologically
  const events = [
    ...crises.map(c => ({
      id: c.id,
      type: 'crisis' as const,
      time: c.timestamp,
      title: `${c.type.replace('_', ' ').toUpperCase()} — ${c.location.toUpperCase()}`,
      detail: c.description,
      severity: c.severity,
      icon: CRISIS_ICONS[c.type] || '❓',
      confidence: c.confidence,
      extra: `Affected Radius: ${c.affected_radius_km} KM · Est. Duration: ${c.expected_duration_hours} Hours`,
    })),
    ...signals.map((s, i) => ({
      id: `sig_${i}`,
      type: 'signal' as const,
      time: s.timestamp,
      title: `Raw Signal: ${s.event_type.replace('_', ' ').toUpperCase()} @ ${s.location.toUpperCase()}`,
      detail: s.raw_posts?.[0]?.text || 'Citizen incident report fused from public channels.',
      severity: s.urgency_level,
      icon: CRISIS_ICONS[s.event_type] || '📡',
      confidence: s.confidence_score,
      extra: `Source Channels: ${s.evidence_sources.join(' · ')}`,
    })),
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  return (
    <div className="h-full overflow-y-auto p-4 bg-[#09090b] font-sans">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-4 border-b border-zinc-800 pb-3">
        <div>
          <h2 className="text-xs font-bold tracking-wider text-zinc-200 uppercase">Operational Log Feed</h2>
          <p className="text-[10px] text-zinc-500 uppercase mt-1">Operation Cycle #{cycle} · {events.length} Correlated Logs</p>
        </div>
        <div className="flex items-center gap-3 text-[9px] text-zinc-500 uppercase font-medium select-none">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded bg-red-500/20 border border-red-500/40 inline-block" /> Validated Incidents</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded bg-sky-500/20 border border-sky-500/40 inline-block" /> Reported Signals</span>
        </div>
      </div>

      {events.length === 0 && (
        <div className="text-center py-16 border border-dashed border-zinc-800 rounded-lg">
          <div className="text-4xl mb-3">📡</div>
          <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">No Logs Buffered</div>
          <div className="text-[9px] text-zinc-500 mt-1">Incidents will populate this feed as data packages synchronize.</div>
        </div>
      )}

      <div className="relative">
        {/* Timeline trace line */}
        {events.length > 0 && <div className="absolute left-5 top-0 bottom-0 w-px bg-zinc-800" />}

        <div className="space-y-4">
          {events.map(event => {
            const isCrisis = event.type === 'crisis';
            const cardPnl = 'hud-panel'; // Pure modern Shadcn card borders
            const logId = event.id.slice(0, 5).toUpperCase();
            
            return (
              <div key={event.id} className="relative flex gap-4 group">
                
                {/* Timeline Icon Node */}
                <div className={`relative z-10 flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg border ${
                  isCrisis
                    ? 'bg-red-950/40 border-red-500/30 text-red-400'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-300'
                }`}>
                  {event.icon}
                </div>

                {/* Log Entry Panel */}
                <div className={`flex-1 rounded-lg p-3.5 ${cardPnl} border-zinc-800 hover:border-zinc-700 transition-all`}>
                  <div className="flex items-start justify-between gap-3">
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`tag-base ${SEVERITY_TAGS[event.severity]}`}>{event.severity}</span>
                        <span className="text-[10px] font-bold text-zinc-100 truncate">
                          {event.title}
                        </span>
                      </div>
                      
                      {/* Testimony block */}
                      <p className="text-[10px] text-zinc-300 mt-2 bg-zinc-950 border border-zinc-800/80 p-2.5 rounded leading-relaxed">
                        <span className="text-[8px] text-zinc-500 block font-bold uppercase tracking-wider mb-1">
                          Source Text (Report Ref: {logId})
                        </span>
                        "{event.detail}"
                      </p>
                      
                      <div className="text-[8.5px] text-zinc-500 mt-2 font-medium">
                        {event.extra}
                      </div>
                    </div>
                    
                    <div className="text-right flex-shrink-0 text-[9px] text-zinc-500">
                      <div className="font-semibold text-zinc-400">
                        {formatDistanceToNow(new Date(event.time), { addSuffix: true })}
                      </div>
                      <div className="text-zinc-300 font-bold mt-2 font-mono text-[9.5px]">
                        {(event.confidence * 100).toFixed(0)}% Match
                      </div>
                      <div className="text-[7.5px] text-zinc-500 uppercase">Confidence</div>
                    </div>

                  </div>
                  
                  {/* Gauge indicator */}
                  <div className="mt-3">
                    <div className="telemetry-bar">
                      <div
                        className="telemetry-fill"
                        style={{
                          width: `${event.confidence * 100}%`,
                          background: isCrisis ? '#ef4444' : '#3b82f6',
                        }}
                      />
                    </div>
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

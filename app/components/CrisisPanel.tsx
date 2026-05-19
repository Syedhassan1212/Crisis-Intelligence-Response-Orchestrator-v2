'use client';

import { useState } from 'react';
import { Radio, X, ChevronDown, ChevronRight, Zap } from 'lucide-react';
import type { CrisisEvent, FusedSignal, TrafficAction } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';

interface CrisisPanelProps {
  crises: CrisisEvent[];
  signals: FusedSignal[];
  trafficActions?: TrafficAction[];
  onCollapse?: () => void;
  onCallIncident?: (incidentId: string, location: string, sector: string, severity: string) => void;
  onOpenChat?: (incidentId: string, location: string, sector: string, severity: string) => void;
  activeRoomIds?: Set<string>;
  activeChatIds?: Set<string>;
}

const CRISIS_ICONS: Record<string, string> = {
  fire: '🔥', flood: '🌊', accident: '🚗', heatwave: '☀️',
  power_outage: '⚡', protest: '📢', robbery: '🚨',
  infrastructure_failure: '🏗️', unknown: '❓',
};

const SEV_STYLES: Record<string, { color: string; bg: string; border: string }> = {
  CRITICAL:    { color: '#ef4444', bg: '#ef444415', border: '#ef444440' },
  HIGH:        { color: '#f59e0b', bg: '#f59e0b15', border: '#f59e0b40' },
  MEDIUM:      { color: '#eab308', bg: '#eab30815', border: '#eab30840' },
  LOW:         { color: '#22c55e', bg: '#22c55e15', border: '#22c55e40' },
};

function formatTime(ts: string) {
  try {
    return new Date(ts).toISOString().slice(11, 19) + 'Z';
  } catch { return ts?.slice(0, 8) + 'Z'; }
}

export default function CrisisPanel({ crises, signals, trafficActions = [], onCollapse, onCallIncident, onOpenChat, activeRoomIds, activeChatIds }: CrisisPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const activeCrises = crises
    .filter(c => c.status === 'active')
    .sort((a, b) => {
      const rank: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
      return (rank[b.severity] || 0) - (rank[a.severity] || 0);
    });

  return (
    <div className="flex flex-col h-full bg-[#111113] overflow-hidden">

      {/* ── HEADER ── */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-[#27272a] bg-[#111113]">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-emerald-400" />
          <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-widest font-mono">
            Interception Cards
          </span>
        </div>
        {onCollapse && (
          <button 
            onClick={onCollapse}
            className="w-6 h-6 flex items-center justify-center rounded text-zinc-500 hover:text-zinc-200 hover:bg-[#27272a] transition-colors"
            title="Hide Interception Cards"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* ── SCROLLABLE FEED ── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-[#111113]">

        {activeCrises.length === 0 && signals.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center opacity-50">
            <Zap className="w-6 h-6 mb-3 text-zinc-500" />
            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono">Signal Void</div>
            <div className="text-[9px] text-zinc-600 mt-1 font-mono">No active intercepts detected.</div>
          </div>
        )}

        {/* VALIDATED CRISES */}
        {activeCrises.map(crisis => {
          const isExpanded = expandedId === crisis.id;
          const sev = SEV_STYLES[crisis.severity] || SEV_STYLES['LOW'];
          const typeName = crisis.type.replace(/_/g, ' ').toUpperCase();
          const icon = CRISIS_ICONS[crisis.type] || '❓';
          const targetId = crisis.id.slice(0, 6).toUpperCase();

          return (
            <div
              key={crisis.id}
              className="group bg-[#1a1a1d] border border-[#27272a] rounded overflow-hidden transition-colors hover:border-[#3f3f46]"
            >
              <div 
                className="p-3 cursor-pointer select-none flex items-start gap-3"
                onClick={() => setExpandedId(isExpanded ? null : crisis.id)}
              >
                {/* Status Indicator */}
                <div className="flex-shrink-0 mt-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: sev.color, boxShadow: `0 0 8px ${sev.color}80` }} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold font-mono tracking-wider text-zinc-200 truncate">
                      ID-{targetId}
                    </span>
                    <span className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded-sm uppercase" style={{ color: sev.color, backgroundColor: sev.bg, borderColor: sev.border, borderWidth: 1 }}>
                      {crisis.severity}
                    </span>
                  </div>

                  <div className="text-[11px] font-semibold text-zinc-300 leading-snug mb-2">
                    {icon} {typeName} <span className="text-zinc-500 font-normal">@</span> {crisis.location}
                  </div>

                  <div className="flex items-center gap-4 text-[9px] font-mono text-zinc-500 uppercase tracking-wide">
                    <span>{formatDistanceToNow(new Date(crisis.timestamp || new Date()), { addSuffix: true })}</span>
                    <span className="flex items-center gap-1"><span className="text-zinc-600">CONF:</span> <span className="text-emerald-400">{(crisis.confidence * 100).toFixed(0)}%</span></span>
                  </div>
                </div>

                <div className="flex-shrink-0 text-zinc-600 group-hover:text-zinc-400 transition-colors mt-1">
                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </div>
              </div>

              {isExpanded && (
                <div className="px-3 pb-3 pt-1 border-t border-[#27272a]/50 bg-[#141416]">
                  <div className="space-y-3 mt-2">
                    {/* Desc */}
                    <div>
                      <div className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest font-mono mb-1">Raw Report</div>
                      <div className="text-[10px] text-zinc-400 font-mono leading-relaxed bg-[#111113] p-2 rounded border border-[#27272a]">
                        {crisis.description}
                      </div>
                    </div>
                    
                    {/* Metrics */}
                    <div className="grid grid-cols-2 gap-2 text-[9px] font-mono">
                      <div className="bg-[#111113] p-2 rounded border border-[#27272a]">
                        <span className="text-zinc-600 block mb-0.5">LAT/LON</span>
                        <span className="text-zinc-300">{crisis.lat?.toFixed(4) ?? '24.8607'}, {crisis.lng?.toFixed(4) ?? '67.0011'}</span>
                      </div>
                      <div className="bg-[#111113] p-2 rounded border border-[#27272a]">
                        <span className="text-zinc-600 block mb-0.5">RADIUS/DUR</span>
                        <span className="text-zinc-300">{crisis.affected_radius_km}km / {crisis.expected_duration_hours}h</span>
                      </div>
                    </div>

                    {/* AI Reasoning */}
                    {crisis.ai_reasoning && (
                      <div>
                        <div className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest font-mono mb-1">AI Context</div>
                        <div className="text-[10px] text-sky-400/90 font-mono leading-relaxed italic border-l-2 border-sky-500/30 pl-2 py-0.5">
                          "{crisis.ai_reasoning}"
                        </div>
                      </div>
                    )}
                    {/* Action Buttons */}
                    <div className="flex items-center justify-end gap-2 pt-1">
                      {/* Chat button — always available */}
                      {onOpenChat && (
                        activeChatIds?.has(crisis.id) ? (
                          <div className="flex items-center gap-1 text-[9px] font-mono font-bold text-emerald-400 uppercase tracking-wider">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            CHAT OPEN
                          </div>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); onOpenChat(crisis.id, crisis.location, crisis.type.replace(/_/g,' '), crisis.severity); }}
                            className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/60 text-zinc-300 text-[9px] font-mono font-bold px-2.5 py-1 rounded uppercase tracking-wider transition-all active:scale-95"
                          >
                            💬 Message
                          </button>
                        )
                      )}
                      {/* Call button — independent */}
                      {onCallIncident && (
                        activeRoomIds?.has(crisis.id) ? (
                          <div className="flex items-center gap-1.5 text-[9px] font-mono font-bold text-red-400 uppercase tracking-wider">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                            VOICE LIVE
                          </div>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); onCallIncident(crisis.id, crisis.location, crisis.type.replace(/_/g,' '), crisis.severity); }}
                            className="flex items-center gap-1.5 bg-emerald-900/60 hover:bg-emerald-800 border border-emerald-700/40 text-emerald-300 text-[9px] font-mono font-bold px-2.5 py-1 rounded uppercase tracking-wider transition-all active:scale-95"
                          >
                            📞 Call
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* UNVERIFIED SIGNALS */}
        {signals.length > 0 && activeCrises.length > 0 && (
          <div className="flex items-center gap-3 pt-3 pb-1">
            <div className="h-px flex-1 bg-[#27272a]" />
            <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest font-mono">Raw Signals</span>
            <div className="h-px flex-1 bg-[#27272a]" />
          </div>
        )}

        {signals.slice(0, 10).map((sig, i) => {
          const typeName = sig.event_type.replace(/_/g, ' ').toUpperCase();
          const targetId = `SIG-${i.toString().padStart(3, '0')}`;
          
          return (
            <div key={`sig-${i}`} className="bg-[#1a1a1d] border border-[#27272a] border-l-4 border-l-zinc-700 rounded p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold font-mono tracking-wider text-zinc-500">
                  {targetId}
                </span>
                <span className="text-[9px] font-mono text-zinc-600 uppercase">
                  {formatDistanceToNow(new Date(sig.timestamp), { addSuffix: true })}
                </span>
              </div>
              
              <div className="text-[11px] font-semibold text-zinc-400 leading-snug mb-2">
                {CRISIS_ICONS[sig.event_type] || '📡'} {typeName} <span className="text-zinc-600 font-normal">@</span> {sig.location}
              </div>

              {sig.raw_posts?.[0] && (
                <div className="text-[10px] text-zinc-500 font-mono leading-relaxed bg-[#111113] p-2 rounded border border-[#27272a] mb-2 italic">
                  "{sig.raw_posts[0].text}"
                </div>
              )}

              <div className="flex items-center justify-between text-[9px] font-mono uppercase tracking-wide">
                <span className="text-zinc-600">SRC: {sig.evidence_sources?.[0] || 'social_media'}</span>
                <span className="text-zinc-500">CONF: {Math.round(sig.confidence_score * 100)}%</span>
              </div>
            </div>
          );
        })}

      </div>
    </div>
  );
}

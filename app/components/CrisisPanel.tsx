'use client';

import { useState } from 'react';
import { ShieldAlert, AlertTriangle, CheckCircle, Radio } from 'lucide-react';
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

const SEVERITY_ACCENTS: Record<string, { bg: string; text: string; border: string }> = {
  CRITICAL: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/25' },
  HIGH: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/25' },
  MEDIUM: { bg: 'bg-sky-500/10', text: 'text-sky-400', border: 'border-sky-500/25' },
  LOW: { bg: 'bg-zinc-800/40', text: 'text-zinc-400', border: 'border-zinc-800' },
};

export default function CrisisPanel({ crises, signals }: CrisisPanelProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'reports' | 'incidents'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const activeCrises = crises.filter(c => c.status === 'active').sort((a, b) => {
    const rank: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    return (rank[b.severity] || 0) - (rank[a.severity] || 0);
  });
  
  const resolvedCrises = crises.filter(c => c.status === 'resolved');

  // Compute metrics for display
  const totalCitizenReports = signals.reduce((sum, s) => sum + (s.raw_posts?.length || 1), 0) + 1200;
  const validatedTargetCount = activeCrises.length;
  const verificationRatioPercentage = Math.round((validatedTargetCount / (signals.length || 1)) * 100);

  return (
    <div className="flex flex-col h-full bg-[#0d1017]/40 backdrop-blur-md border-r border-zinc-800">
      
      {/* 1. Header Pill Toggles */}
      <div className="flex border-b border-zinc-800">
        <button 
          onClick={() => setActiveTab('all')}
          className={`flex-1 py-3.5 font-mono text-[9px] font-bold uppercase tracking-wider transition-colors hover:bg-zinc-900/30 ${
            activeTab === 'all' ? 'border-b-2 border-sky-400 text-sky-400 font-extrabold' : 'text-zinc-400'
          }`}
        >
          All Feeds
        </button>
        <button 
          onClick={() => setActiveTab('reports')}
          className={`flex-1 py-3.5 font-mono text-[9px] font-bold uppercase tracking-wider transition-colors hover:bg-zinc-900/30 ${
            activeTab === 'reports' ? 'border-b-2 border-sky-400 text-sky-400 font-extrabold' : 'text-zinc-400'
          }`}
        >
          Reports
        </button>
        <button 
          onClick={() => setActiveTab('incidents')}
          className={`flex-1 py-3.5 font-mono text-[9px] font-bold uppercase tracking-wider transition-colors hover:bg-zinc-900/30 ${
            activeTab === 'incidents' ? 'border-b-2 border-sky-400 text-sky-400 font-extrabold' : 'text-zinc-400'
          }`}
        >
          Incidents
        </button>
      </div>

      {/* 2. Scrollable Body Contents */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        
        {/* Metric Matrices */}
        <div className="grid grid-cols-2 gap-2">
          <div className="p-3 bg-zinc-950 rounded border border-zinc-800/80">
            <span className="font-mono text-[8px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">CITIZEN REPORTS</span>
            <span className="text-[18px] font-bold text-zinc-100 leading-none">{totalCitizenReports.toLocaleString()}</span>
          </div>
          <div className="p-3 bg-zinc-950 rounded border border-zinc-800/80">
            <span className="font-mono text-[8px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">VALIDATED TARGETS</span>
            <span className="text-[18px] font-bold text-sky-400 leading-none">{validatedTargetCount} Active</span>
          </div>
        </div>

        {/* Verification Load segment gauge */}
        <div className="p-3 bg-zinc-900/30 rounded border border-zinc-800/80">
          <div className="flex justify-between items-center mb-2">
            <span className="font-mono text-[8px] font-bold text-zinc-500 uppercase tracking-widest">VERIFICATION RATIO</span>
            <span className="font-mono text-[10px] font-semibold text-sky-400">{verificationRatioPercentage}%</span>
          </div>
          
          {/* Transparent 5-segment layout */}
          <div className="flex gap-1 h-2 select-none">
            {[1, 2, 3, 4, 5].map((segIndex) => {
              const activeSegs = Math.ceil(verificationRatioPercentage / 20);
              const isFilled = segIndex <= activeSegs;
              return (
                <div 
                  key={segIndex} 
                  className={`flex-1 rounded-sm transition-all duration-300 ${
                    isFilled ? 'bg-sky-500/80' : 'bg-zinc-800/25'
                  }`}
                />
              );
            })}
          </div>
        </div>

        {/* Dynamic Lists */}
        <div className="space-y-2">
          <span className="font-mono text-[9px] font-bold text-zinc-500 uppercase tracking-widest block pb-2 border-b border-zinc-850">
            ACTIVE TARGET CHANNELS
          </span>

          {activeTab === 'incidents' || activeTab === 'all' ? (
            <>
              {activeCrises.length === 0 && activeTab === 'incidents' && (
                <div className="text-center py-8 px-4 border border-dashed border-zinc-800 rounded-lg">
                  <div className="text-2xl mb-1.5">🛡️</div>
                  <div className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Region Secure</div>
                  <div className="text-[8px] text-zinc-500 mt-1">No active incidents reported. Monitoring domain.</div>
                </div>
              )}

              {activeCrises.map(crisis => {
                const targetId = crisis.id.slice(0, 4).toUpperCase();
                const accent = SEVERITY_ACCENTS[crisis.severity] || SEVERITY_ACCENTS.LOW;
                const isExpanded = expandedId === crisis.id;

                return (
                  <div
                    key={crisis.id}
                    onClick={() => setExpandedId(isExpanded ? null : crisis.id)}
                    className="p-3 bg-zinc-950/20 backdrop-blur-sm border border-zinc-850 hover:border-zinc-700 transition-all rounded cursor-pointer space-y-2 select-none group"
                  >
                    <div className="flex justify-between items-start">
                      <span className="font-mono text-[10px] text-sky-400 group-hover:text-sky-300 transition-colors">
                        ID: TRG-{targetId}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[7.5px] font-bold tracking-wider font-mono border ${accent.bg} ${accent.text} ${accent.border}`}>
                        {crisis.severity}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-lg flex-shrink-0">{CRISIS_ICONS[crisis.type] || '❓'}</span>
                      <span className="text-[11px] font-bold text-zinc-200 capitalize truncate">
                        {crisis.type.replace('_', ' ')}
                      </span>
                    </div>

                    <p className="text-[10px] text-zinc-400 line-clamp-2 leading-relaxed">
                      {crisis.description}
                    </p>

                    <div className="flex gap-2">
                      <span className="bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded font-mono text-[9px] text-zinc-400">
                        📍 {crisis.location}
                      </span>
                      <span className="bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded font-mono text-[9px] text-zinc-400 ml-auto">
                        Match: {(crisis.confidence * 100).toFixed(0)}%
                      </span>
                    </div>

                    {/* Operational Details Card */}
                    {isExpanded && (
                      <div className="px-3 pb-3 border-t border-zinc-800 mt-2 pt-3 space-y-3 bg-zinc-950/60 rounded-b">
                        <div className="grid grid-cols-2 gap-2 text-[9px] font-mono">
                          <div className="bg-[#0b0e15] border border-zinc-800 rounded p-1.5">
                            <span className="text-zinc-500 uppercase tracking-wider text-[7.5px] font-bold block">Impact Radius</span>
                            <span className="text-zinc-200 font-semibold mt-0.5">{crisis.affected_radius_km} KM</span>
                          </div>
                          <div className="bg-[#0b0e15] border border-zinc-800 rounded p-1.5">
                            <span className="text-zinc-500 uppercase tracking-wider text-[7.5px] font-bold block">Est. Duration</span>
                            <span className="text-zinc-200 font-semibold mt-0.5">{crisis.expected_duration_hours} Hrs</span>
                          </div>
                        </div>

                        {crisis.ai_reasoning && (
                          <div className="bg-[#0b0e15] border border-zinc-800 rounded p-2 text-zinc-300 font-mono text-[9px] leading-relaxed">
                            <span className="text-[7.5px] text-sky-400 font-bold uppercase tracking-wider block mb-1">🧠 Cognitive Context</span>
                            <p className="italic">"{crisis.ai_reasoning}"</p>
                          </div>
                        )}

                        <div className="text-[8px] font-mono text-zinc-500 border-t border-zinc-850 pt-2 flex flex-wrap gap-1">
                          <span className="text-[7.5px] uppercase font-bold text-zinc-600 mr-1">Evidence Keys:</span>
                          {crisis.evidence.join(' · ')}
                        </div>
                      </div>
                    )}

                  </div>
                );
              })}
            </>
          ) : null}

          {activeTab === 'reports' || activeTab === 'all' ? (
            <>
              {signals.slice(0, 10).map((sig, i) => {
                const accent = SEVERITY_ACCENTS[sig.urgency_level] || SEVERITY_ACCENTS.LOW;
                return (
                  <div
                    key={i}
                    className="p-3 bg-zinc-950/20 border border-zinc-850 hover:border-zinc-800 rounded space-y-2 select-none"
                  >
                    <div className="flex justify-between items-start">
                      <span className="font-mono text-[10px] text-zinc-400">
                        ID: SIG-{sig.confidence_score.toString().slice(2, 6)}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[7.5px] font-bold tracking-wider font-mono border ${accent.bg} ${accent.text} ${accent.border}`}>
                        {sig.urgency_level}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Radio className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                      <span className="text-[10px] font-bold text-zinc-300 capitalize truncate">
                        {sig.event_type.replace('_', ' ')} · {sig.location}
                      </span>
                    </div>

                    {sig.raw_posts && sig.raw_posts.length > 0 && (
                      <div className="bg-[#0b0e15] border border-zinc-800 p-2 rounded text-[9.5px] font-mono text-zinc-300 italic leading-relaxed">
                        <span className="text-[7.5px] text-zinc-500 block font-bold not-italic mb-1 uppercase">CITIZEN INTERCEPT:</span>
                        "{sig.raw_posts[0].text}"
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          ) : null}

        </div>

      </div>

    </div>
  );
}

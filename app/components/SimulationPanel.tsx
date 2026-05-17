'use client';

import type { SimulationResult, CrisisEvent } from '@/lib/types';

interface SimulationPanelProps {
  simulations: SimulationResult[];
  crises: CrisisEvent[];
}

export default function SimulationPanel({ simulations, crises }: SimulationPanelProps) {
  return (
    <div className="h-full overflow-y-auto p-4 space-y-4 bg-[#09090b]">
      
      {/* Simulation Engine Header */}
      <div className="border-b border-zinc-800 pb-3">
        <h2 className="text-xs font-bold tracking-wider text-zinc-200 uppercase">Response Prediction Engine</h2>
        <p className="text-[10px] text-zinc-500 uppercase tracking-wide mt-1">{simulations.length} Computed Scenarios Active</p>
      </div>

      {simulations.length === 0 && (
        <div className="text-center py-16 border border-dashed border-zinc-800 rounded-lg">
          <div className="text-4xl mb-3">🎯</div>
          <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Awaiting Incidents</div>
          <div className="text-[9px] text-zinc-500 mt-1">Simulations run automatically when high or critical incidents are logged into the coordinator.</div>
        </div>
      )}

      {simulations.map((sim, idx) => {
        const crisis = crises.find(c => c.id === sim.crisis_id);
        const targetId = sim.crisis_id.slice(0, 4).toUpperCase();
        return (
          <div key={sim.crisis_id + idx} className="hud-panel p-4.5 space-y-4 bg-zinc-900/40 border-zinc-800">
            
            {/* Header info */}
            <div className="flex items-start justify-between border-b border-zinc-800 pb-3">
              <div>
                <div className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold">Scenario Calculation #{idx + 1}</div>
                <div className="text-xs font-semibold text-zinc-200 mt-1">
                  ID: {targetId} · {crisis?.type?.replace('_', ' ').toUpperCase() || 'Incident Analysis'}
                </div>
                <div className="text-[9.5px] text-zinc-400 mt-1">
                  📍 {crisis?.location || 'Sector Unknown'} · Scenario: {sim.scenario}
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-sky-400">{(sim.confidence * 100).toFixed(0)}%</div>
                <div className="text-[8px] text-zinc-500 uppercase tracking-wider font-semibold">Match score</div>
              </div>
            </div>

            {/* Metrics Matrix */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="bg-zinc-950 border border-zinc-800/60 rounded p-2 text-center font-sans">
                <div className="text-sm font-bold text-emerald-400">
                  {sim.estimated_lives_saved !== undefined ? `+${sim.estimated_lives_saved}` : 'N/A'}
                </div>
                <div className="text-[8px] text-zinc-500 uppercase tracking-wider font-semibold mt-1">Impact Mitigation</div>
              </div>
              <div className="bg-zinc-950 border border-zinc-800/60 rounded p-2 text-center font-sans">
                <div className="text-sm font-bold text-amber-400">{sim.estimated_response_time} Min</div>
                <div className="text-[8px] text-zinc-500 uppercase tracking-wider font-semibold mt-1">Response Est.</div>
              </div>
              <div className="bg-zinc-950 border border-zinc-800/60 rounded p-2 text-center font-sans">
                <div className="text-sm font-bold text-sky-400">{sim.alternatives.length}</div>
                <div className="text-[8px] text-zinc-500 uppercase tracking-wider font-semibold mt-1">Alt Options</div>
              </div>
            </div>

            {/* Recommended Action Strategy */}
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded p-3 text-[10.5px] text-zinc-300">
              <div className="text-[9px] font-bold text-emerald-400 mb-1.5 uppercase tracking-wider">
                [Recommended Strategy]
              </div>
              <p className="leading-relaxed font-sans">{sim.best_action_plan}</p>
            </div>

            {/* AI Reasoning Log */}
            <div className="bg-zinc-950 border border-zinc-800 rounded p-3 text-[10.5px] text-zinc-300">
              <div className="text-[9px] font-bold text-sky-400 mb-1.5 uppercase tracking-wider">
                [AI Strategic Summary]
              </div>
              <p className="leading-relaxed font-sans">{sim.reasoning}</p>
            </div>

            {/* Risk Tradeoffs */}
            {sim.risk_tradeoffs.length > 0 && (
              <div className="text-[10px]">
                <div className="text-[9px] font-bold text-amber-400 mb-2 uppercase tracking-wider">⚖️ Risk Tradeoffs Matrix</div>
                <div className="space-y-1 bg-zinc-950 p-2.5 rounded border border-zinc-800/40">
                  {sim.risk_tradeoffs.map((t, i) => (
                    <div key={i} className="flex gap-2 text-zinc-400 text-[9.5px]">
                      <span className="text-amber-400 flex-shrink-0">▸</span>
                      <span className="leading-relaxed">{t}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Secondary Impacts */}
            {sim.secondary_impacts.length > 0 && (
              <div className="text-[10px]">
                <div className="text-[9px] font-bold text-orange-400 mb-2 uppercase tracking-wider">🔗 Secondary Environmental Impacts</div>
                <div className="space-y-1 bg-zinc-950 p-2.5 rounded border border-zinc-800/40">
                  {sim.secondary_impacts.map((impact, i) => (
                    <div key={i} className="flex gap-2 text-zinc-400 text-[9.5px]">
                      <span className="text-orange-400 flex-shrink-0">→</span>
                      <span className="leading-relaxed">{impact}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Alternative Plans */}
            {sim.alternatives.length > 0 && (
              <div className="text-[10px]">
                <div className="text-[9px] font-bold text-zinc-500 mb-2.5 uppercase tracking-wider">🔄 Alternative Operational Plans</div>
                <div className="space-y-2">
                  {sim.alternatives.map((alt, i) => (
                    <div key={i} className="border border-zinc-800 rounded p-3 bg-zinc-950">
                      <div className="text-[9.5px] font-bold text-zinc-200 mb-2 uppercase">
                        Option #{i + 1}: {alt.plan}
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-[9.5px]">
                        <div>
                          <div className="text-[8.5px] font-bold text-emerald-400 mb-1 uppercase">Advantages</div>
                          {alt.pros.map((p, j) => (
                            <div key={j} className="text-zinc-400 flex gap-1 mt-0.5"><span className="text-emerald-400">+</span> {p}</div>
                          ))}
                        </div>
                        <div>
                          <div className="text-[8.5px] font-bold text-rose-400 mb-1 uppercase">Disadvantages</div>
                          {alt.cons.map((c, j) => (
                            <div key={j} className="text-zinc-400 flex gap-1 mt-0.5"><span className="text-rose-400">-</span> {c}</div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Operational notice */}
            <div className="text-[8.5px] text-zinc-500 border-t border-zinc-800 pt-3 uppercase">
              Notice: Predictive models are advisory. Deployments are subject to agency dispatcher review.
            </div>
          </div>
        );
      })}
    </div>
  );
}

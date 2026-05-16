'use client';

import type { SimulationResult, CrisisEvent } from '@/lib/types';

interface SimulationPanelProps {
  simulations: SimulationResult[];
  crises: CrisisEvent[];
}

export default function SimulationPanel({ simulations, crises }: SimulationPanelProps) {
  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      <div>
        <h2 className="text-sm font-bold text-white">Simulation Engine</h2>
        <p className="text-xs text-gray-500">AI-simulated outcomes before execution — {simulations.length} scenarios</p>
      </div>

      {simulations.length === 0 && (
        <div className="text-center py-16 text-xs text-gray-600">
          <div className="text-5xl mb-3">🎯</div>
          <div className="font-medium text-gray-500">No simulations run yet</div>
          <div className="mt-1">Simulations run automatically when HIGH/CRITICAL crises are detected</div>
        </div>
      )}

      {simulations.map((sim, idx) => {
        const crisis = crises.find(c => c.id === sim.crisis_id);
        return (
          <div key={sim.crisis_id + idx} className="glass-card p-5 space-y-4 animate-fade-in">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wider">Simulation #{idx + 1}</div>
                <div className="text-sm font-bold text-white mt-0.5">
                  {crisis?.type?.replace('_', ' ').toUpperCase() || 'Unknown Event'} — {crisis?.location || 'Unknown'}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">{sim.scenario}</div>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold text-blue-400">{(sim.confidence * 100).toFixed(0)}%</div>
                <div className="text-xs text-gray-600">confidence</div>
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white/5 rounded-lg p-2.5 text-center">
                <div className="text-lg font-bold text-green-400">
                  {sim.estimated_lives_saved !== undefined ? sim.estimated_lives_saved : 'N/A'}
                </div>
                <div className="text-xs text-gray-500">Lives Protected</div>
              </div>
              <div className="bg-white/5 rounded-lg p-2.5 text-center">
                <div className="text-lg font-bold text-orange-400">{sim.estimated_response_time} min</div>
                <div className="text-xs text-gray-500">Response Time</div>
              </div>
              <div className="bg-white/5 rounded-lg p-2.5 text-center">
                <div className="text-lg font-bold text-purple-400">{sim.alternatives.length}</div>
                <div className="text-xs text-gray-500">Alternatives</div>
              </div>
            </div>

            {/* Best Action Plan */}
            <div className="bg-green-900/20 border border-green-500/20 rounded-lg p-3">
              <div className="text-xs font-bold text-green-400 mb-1.5">✅ RECOMMENDED ACTION PLAN</div>
              <p className="text-xs text-gray-300 leading-relaxed">{sim.best_action_plan}</p>
            </div>

            {/* Reasoning */}
            <div className="bg-blue-900/20 border border-blue-500/15 rounded-lg p-3">
              <div className="text-xs font-bold text-blue-400 mb-1.5">🧠 AI REASONING</div>
              <p className="text-xs text-gray-400 leading-relaxed">{sim.reasoning}</p>
            </div>

            {/* Risk Tradeoffs */}
            {sim.risk_tradeoffs.length > 0 && (
              <div>
                <div className="text-xs font-bold text-amber-400 mb-2">⚖️ RISK TRADEOFFS</div>
                <div className="space-y-1">
                  {sim.risk_tradeoffs.map((t, i) => (
                    <div key={i} className="flex gap-2 text-xs">
                      <span className="text-amber-600 flex-shrink-0">▸</span>
                      <span className="text-gray-400">{t}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Secondary Impacts */}
            {sim.secondary_impacts.length > 0 && (
              <div>
                <div className="text-xs font-bold text-orange-400 mb-2">🔗 SECONDARY IMPACTS</div>
                <div className="space-y-1">
                  {sim.secondary_impacts.map((impact, i) => (
                    <div key={i} className="flex gap-2 text-xs">
                      <span className="text-orange-600 flex-shrink-0">→</span>
                      <span className="text-gray-400">{impact}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Alternative Plans */}
            {sim.alternatives.length > 0 && (
              <div>
                <div className="text-xs font-bold text-gray-400 mb-2">🔄 ALTERNATIVE SCENARIOS</div>
                <div className="space-y-2">
                  {sim.alternatives.map((alt, i) => (
                    <div key={i} className="border border-white/5 rounded-lg p-3 bg-white/2">
                      <div className="text-xs font-medium text-gray-300 mb-1.5">{alt.plan}</div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <div className="text-xs text-green-600 mb-1">PROS</div>
                          {alt.pros.map((p, j) => (
                            <div key={j} className="text-xs text-gray-500 flex gap-1"><span className="text-green-700">+</span>{p}</div>
                          ))}
                        </div>
                        <div>
                          <div className="text-xs text-red-600 mb-1">CONS</div>
                          {alt.cons.map((c, j) => (
                            <div key={j} className="text-xs text-gray-500 flex gap-1"><span className="text-red-700">-</span>{c}</div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Override note */}
            <div className="text-xs text-gray-700 border-t border-white/5 pt-3">
              ⚠ Human override available — All AI decisions are advisory. Final authority rests with incident commanders.
            </div>
          </div>
        );
      })}
    </div>
  );
}

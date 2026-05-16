'use client';

import type { ResourceUnit, AllocationPlan, CrisisEvent } from '@/lib/types';

interface ResourcePanelProps {
  resources: ResourceUnit[];
  allocations: AllocationPlan[];
  crises: CrisisEvent[];
}

const RESOURCE_ICONS: Record<string, string> = {
  ambulance: '🚑', police: '🚔', fire_unit: '🚒', rescue: '🚁', utility: '🔧',
};

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  available: { color: 'text-green-400', bg: 'bg-green-400', label: 'Available' },
  dispatched: { color: 'text-orange-400', bg: 'bg-orange-400', label: 'En Route' },
  en_route: { color: 'text-amber-400', bg: 'bg-amber-400', label: 'En Route' },
  on_scene: { color: 'text-red-400', bg: 'bg-red-400', label: 'On Scene' },
};

export default function ResourcePanel({ resources, allocations, crises }: ResourcePanelProps) {
  const byType = resources.reduce<Record<string, ResourceUnit[]>>((acc, r) => {
    if (!acc[r.type]) acc[r.type] = [];
    acc[r.type].push(r);
    return acc;
  }, {});

  const totalAvailable = resources.filter(r => r.status === 'available').length;
  const totalDispatched = resources.filter(r => r.status === 'dispatched' || r.status === 'on_scene').length;

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {/* Summary Row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total Units', value: resources.length, color: 'text-white' },
          { label: 'Available', value: totalAvailable, color: 'text-green-400' },
          { label: 'Deployed', value: totalDispatched, color: 'text-orange-400' },
          { label: 'Allocations', value: allocations.length, color: 'text-blue-400' },
        ].map(stat => (
          <div key={stat.label} className="glass-card p-3 text-center">
            <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-xs text-gray-500 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Resource by type */}
      <div className="grid grid-cols-2 gap-4">
        {Object.entries(byType).map(([type, units]) => {
          const available = units.filter(u => u.status === 'available').length;
          const pct = (available / units.length) * 100;
          return (
            <div key={type} className="glass-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">{RESOURCE_ICONS[type] || '🚗'}</span>
                <div>
                  <div className="text-sm font-semibold text-white capitalize">{type.replace('_', ' ')}</div>
                  <div className="text-xs text-gray-500">{available}/{units.length} available</div>
                </div>
              </div>
              {/* Availability bar */}
              <div className="confidence-bar mb-3">
                <div
                  className="confidence-fill"
                  style={{ width: `${pct}%`, background: pct > 60 ? '#22c55e' : pct > 30 ? '#f59e0b' : '#ef4444' }}
                />
              </div>
              {/* Unit list */}
              <div className="space-y-1 max-h-36 overflow-y-auto">
                {units.map(unit => {
                  const cfg = STATUS_CONFIG[unit.status] || STATUS_CONFIG.available;
                  return (
                    <div key={unit.id} className={`resource-unit resource-${unit.status}`}>
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.bg}`} />
                      <span className="text-xs text-gray-300 flex-1 truncate">{unit.id}</span>
                      <span className={`text-xs ${cfg.color} flex-shrink-0`}>{cfg.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Allocation Plans */}
      {allocations.length > 0 && (
        <div>
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Active Dispatch Orders</div>
          <div className="space-y-3">
            {allocations.slice(0, 5).map(alloc => {
              const crisis = crises.find(c => c.id === alloc.crisis_id);
              return (
                <div key={alloc.crisis_id} className="glass-card p-4 border border-orange-500/10">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="text-sm font-semibold text-white">
                        {crisis?.type?.replace('_', ' ').toUpperCase() || 'Unknown Crisis'}
                      </div>
                      <div className="text-xs text-gray-500">📍 {crisis?.location || 'Unknown'}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-orange-400 font-bold">{alloc.total_response_time_minutes} min</div>
                      <div className="text-xs text-gray-600">ETA</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {alloc.units.map(u => (
                      <span key={u.id} className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-900/30 border border-orange-700/30 text-xs text-orange-300">
                        {RESOURCE_ICONS[u.type] || '🚗'} {u.type.replace('_', ' ')}
                      </span>
                    ))}
                  </div>
                  <div className="text-xs text-gray-500 italic">{alloc.reasoning.slice(0, 100)}</div>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="confidence-bar flex-1">
                      <div
                        className="confidence-fill"
                        style={{ width: `${alloc.confidence * 100}%`, background: '#3b82f6' }}
                      />
                    </div>
                    <span className="text-xs text-blue-400">{(alloc.confidence * 100).toFixed(0)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {allocations.length === 0 && (
        <div className="text-center py-8 text-xs text-gray-600">
          <div className="text-3xl mb-2">🚑</div>
          No active dispatch orders. All units on standby.
        </div>
      )}
    </div>
  );
}

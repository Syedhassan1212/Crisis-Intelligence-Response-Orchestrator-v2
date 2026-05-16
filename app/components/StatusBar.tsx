'use client';

import type { CrisisEvent, OrchestratorState, WeatherData } from '@/lib/types';

interface StatusBarProps {
  crises: CrisisEvent[];
  resources: OrchestratorState['resources'];
  notifications: OrchestratorState['notifications'];
  weather?: WeatherData;
}

export default function StatusBar({ crises, resources, notifications, weather }: StatusBarProps) {
  const active = crises.filter(c => c.status === 'active');
  const critical = active.filter(c => c.severity === 'CRITICAL');
  const dispatched = resources.filter(r => r.status === 'dispatched' || r.status === 'on_scene');
  const available = resources.filter(r => r.status === 'available');

  return (
    <div className="flex items-center gap-0 text-xs border-b border-white/5 bg-gray-900/60 overflow-x-auto flex-shrink-0">
      {[
        { label: 'CRITICAL EVENTS', value: critical.length, color: critical.length > 0 ? 'text-red-400' : 'text-gray-500', bg: critical.length > 0 ? 'bg-red-900/20' : '' },
        { label: 'ACTIVE INCIDENTS', value: active.length, color: 'text-amber-400', bg: '' },
        { label: 'UNITS DEPLOYED', value: dispatched.length, color: 'text-orange-400', bg: '' },
        { label: 'UNITS AVAILABLE', value: available.length, color: 'text-green-400', bg: '' },
        { label: 'ALERTS SENT', value: notifications.length, color: 'text-purple-400', bg: '' },
        ...(weather ? [{ label: `KARACHI ${weather.condition?.toUpperCase()}`, value: `${weather.temperature.toFixed(0)}°C`, color: 'text-cyan-400', bg: '' }] : []),
      ].map((item, i) => (
        <div key={i} className={`flex items-center gap-2 px-4 py-2 border-r border-white/5 ${item.bg} whitespace-nowrap`}>
          <span className="text-gray-600">{item.label}</span>
          <span className={`font-bold font-mono ${item.color}`}>{item.value}</span>
        </div>
      ))}
      <div className="px-4 py-2 text-gray-700 text-xs ml-auto whitespace-nowrap">
        Karachi Emergency Command Grid • {new Date().toLocaleDateString()}
      </div>
    </div>
  );
}

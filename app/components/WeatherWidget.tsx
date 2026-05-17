'use client';

import { Sun, CloudRain, Wind, Thermometer, Droplets } from 'lucide-react';
import type { WeatherData } from '@/lib/types';

interface WeatherWidgetProps {
  weather?: WeatherData;
}

export default function WeatherWidget({ weather }: WeatherWidgetProps) {
  if (!weather) {
    return (
      <div className="p-4 border-b border-zinc-800 bg-[#09090b]">
        <span className="font-mono text-[9px] font-bold text-zinc-500 uppercase tracking-widest block mb-2 select-none">
          CLIMATE TELEMETRY
        </span>
        <div className="text-[9.5px] text-zinc-500 italic uppercase">
          Establishing connection to environmental telemetry nodes...
        </div>
      </div>
    );
  }

  const isHot = weather.temperature > 38;
  const isRainy = weather.rainfall > 15;
  const isWindy = weather.windSpeed > 30;

  const riskLabel = isHot && isRainy 
    ? 'CRITICAL RISK' 
    : isHot || isRainy 
    ? 'ELEVATED RISK' 
    : isWindy 
    ? 'MODERATE RISK' 
    : 'STABLE CONDITION';

  const riskBadgeClass = isHot && isRainy
    ? 'bg-red-500/10 text-red-400 border-red-500/25'
    : isHot || isRainy
    ? 'bg-amber-500/10 text-amber-400 border-amber-500/25'
    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25';

  return (
    <div className="p-4 border-b border-zinc-800 bg-[#09090b] font-sans">
      <div className="flex justify-between items-center mb-4 select-none">
        <span className="font-mono text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
          CLIMATE TELEMETRY
        </span>
        <Sun className="w-4 h-4 text-sky-400" />
      </div>

      {/* Primary Climate Telemetry display */}
      <div className="flex items-end gap-4 mb-4 select-none">
        <span className="text-[42px] font-bold leading-none text-zinc-100 tracking-tighter">
          {weather.temperature.toFixed(0)}°C
        </span>
        <div className="flex flex-col mb-1 leading-tight">
          <span className="text-[11px] font-bold text-zinc-200">{weather.condition}</span>
          <span className="font-mono text-[9px] text-zinc-500 mt-0.5">HUMIDITY: {weather.humidity.toFixed(0)}%</span>
        </div>

        <div className="ml-auto text-right mb-1">
          <span className={`px-2 py-0.5 rounded text-[7.5px] font-bold font-mono border tracking-wider ${riskBadgeClass}`}>
            {riskLabel}
          </span>
        </div>
      </div>

      {/* Hourly climate forecasting indicators */}
      <div className="grid grid-cols-4 gap-1.5 h-12 select-none mb-3">
        {[
          { time: '14:00', temp: `${(weather.temperature).toFixed(0)}°`, active: false },
          { time: '15:00', temp: `${(weather.temperature - 1).toFixed(0)}°`, active: false },
          { time: '16:00', temp: `${(weather.temperature - 2).toFixed(0)}°`, active: true },
          { time: '17:00', temp: `${(weather.temperature - 3).toFixed(0)}°`, active: false },
        ].map((slot, i) => (
          <div 
            key={i} 
            className={`rounded flex flex-col items-center justify-center border font-mono text-[10px] ${
              slot.active 
                ? 'bg-sky-500/10 border-sky-400/30 text-sky-400' 
                : 'bg-zinc-950 border-zinc-850 text-zinc-400'
            }`}
          >
            <span className="text-[7.5px] text-zinc-500 uppercase font-semibold leading-none">{slot.time}</span>
            <span className="font-bold mt-1">{slot.temp}</span>
          </div>
        ))}
      </div>

      {/* Wind and Visibility parameters */}
      <div className="grid grid-cols-2 gap-2 text-[9.5px]">
        <div className="bg-zinc-950 border border-zinc-850 p-2 rounded flex items-center gap-2">
          <Wind className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
          <div>
            <span className="text-[7px] text-zinc-500 uppercase block font-bold leading-none">Wind Velocity</span>
            <span className="text-[10px] font-bold text-zinc-200 mt-1 block">{weather.windSpeed.toFixed(0)} km/h</span>
          </div>
        </div>
        <div className="bg-zinc-950 border border-zinc-850 p-2 rounded flex items-center gap-2">
          <Droplets className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
          <div>
            <span className="text-[7px] text-zinc-500 uppercase block font-bold leading-none">Precipitation</span>
            <span className="text-[10px] font-bold text-zinc-200 mt-1 block">{weather.rainfall.toFixed(1)} mm</span>
          </div>
        </div>
      </div>

      <div className="mt-3.5 text-[7px] text-zinc-600 font-mono uppercase select-none flex justify-between">
        <span>Sync: Stable</span>
        <span>Checked: {new Date(weather.fetchedAt).toLocaleTimeString()}</span>
      </div>
    </div>
  );
}

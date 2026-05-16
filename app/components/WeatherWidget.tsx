'use client';

import type { WeatherData } from '@/lib/types';

interface WeatherWidgetProps {
  weather?: WeatherData;
}

export default function WeatherWidget({ weather }: WeatherWidgetProps) {
  if (!weather) {
    return (
      <div className="p-4 border-b border-white/5">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Weather</div>
        <div className="text-xs text-gray-700 italic">Loading weather data...</div>
      </div>
    );
  }

  const isHot = weather.temperature > 38;
  const isRainy = weather.rainfall > 15;
  const isWindy = weather.windSpeed > 30;

  const getWeatherIcon = () => {
    if (isRainy) return '🌧️';
    if (isHot) return '☀️';
    if (isWindy) return '💨';
    if (weather.condition?.toLowerCase().includes('cloud')) return '⛅';
    return '🌤️';
  };

  const getRiskLevel = () => {
    if (isHot && isRainy) return { label: 'SEVERE', color: 'text-red-400' };
    if (isHot || isRainy) return { label: 'ELEVATED', color: 'text-amber-400' };
    if (isWindy) return { label: 'MODERATE', color: 'text-yellow-400' };
    return { label: 'NORMAL', color: 'text-green-400' };
  };

  const risk = getRiskLevel();

  return (
    <div className="p-4 border-b border-white/5">
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Karachi Weather</div>

      {/* Main temp display */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-4xl">{getWeatherIcon()}</span>
        <div>
          <div className="text-3xl font-bold text-white">{weather.temperature.toFixed(1)}°C</div>
          <div className="text-xs text-gray-400">{weather.condition}</div>
        </div>
        <div className="ml-auto text-right">
          <div className={`text-xs font-bold ${risk.color}`}>{risk.label}</div>
          <div className="text-xs text-gray-600">weather risk</div>
        </div>
      </div>

      {/* Weather stats */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'Humidity', value: `${weather.humidity.toFixed(0)}%`, icon: '💧', warn: weather.humidity > 85 },
          { label: 'Wind', value: `${weather.windSpeed.toFixed(0)} km/h`, icon: '💨', warn: isWindy },
          { label: 'Rainfall', value: `${weather.rainfall.toFixed(1)} mm`, icon: '🌧️', warn: isRainy },
          { label: 'Heat Index', value: weather.heatIndex ? `${weather.heatIndex.toFixed(0)}°C` : 'N/A', icon: '🌡️', warn: isHot },
        ].map(stat => (
          <div key={stat.label} className={`p-2 rounded-lg ${stat.warn ? 'bg-amber-900/20 border border-amber-700/20' : 'bg-white/3'}`}>
            <div className="flex items-center gap-1">
              <span className="text-xs">{stat.icon}</span>
              <span className="text-xs text-gray-600">{stat.label}</span>
            </div>
            <div className={`text-sm font-bold ${stat.warn ? 'text-amber-400' : 'text-white'}`}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Crisis triggers */}
      {(isHot || isRainy || isWindy) && (
        <div className="mt-3 p-2 rounded-lg bg-red-900/20 border border-red-700/20">
          <div className="text-xs font-bold text-red-400 mb-1">⚠️ WEATHER CRISIS TRIGGERS</div>
          <div className="space-y-0.5">
            {isHot && <div className="text-xs text-orange-400">● Heatwave conditions — heat emergency risk</div>}
            {isRainy && <div className="text-xs text-blue-400">● Heavy rainfall — flooding risk elevated</div>}
            {isWindy && <div className="text-xs text-cyan-400">● High winds — fire spread risk elevated</div>}
          </div>
        </div>
      )}

      {/* Forecast */}
      {weather.forecast && (
        <div className="mt-2 text-xs text-gray-600 italic">{weather.forecast}</div>
      )}

      <div className="mt-2 text-xs text-gray-700">
        Updated {new Date(weather.fetchedAt).toLocaleTimeString()}
      </div>
    </div>
  );
}

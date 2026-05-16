'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { OrchestratorState } from '@/lib/types';
import Header from './components/Header';
import CrisisMap from './components/CrisisMap';
import CrisisPanel from './components/CrisisPanel';
import ResourcePanel from './components/ResourcePanel';
import TimelineFeed from './components/TimelineFeed';
import AIDecisionTrace from './components/AIDecisionTrace';
import SimulationPanel from './components/SimulationPanel';
import NotificationCenter from './components/NotificationCenter';
import StatusBar from './components/StatusBar';
import WeatherWidget from './components/WeatherWidget';

const CYCLE_INTERVAL_MS = 30000; // 30 seconds

export default function CIRODashboard() {
  const [state, setState] = useState<OrchestratorState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'map' | 'resources' | 'timeline' | 'ai' | 'simulation' | 'notifications'>('map');
  const [autoRun, setAutoRun] = useState(false);
  const [lastCycleTime, setLastCycleTime] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  const runCycle = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/orchestrate');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.success) {
        setState(data.data);
        setLastCycleTime(new Date());
      } else {
        setError(data.error || 'Orchestration failed');
      }
    } catch (err) {
      setError(`Network error: ${err}`);
    } finally {
      setLoading(false);
    }
  }, [loading]);

  // Auto-run cycle
  useEffect(() => {
    if (autoRun) {
      runCycle();
      intervalRef.current = setInterval(runCycle, CYCLE_INTERVAL_MS);
      setCountdown(CYCLE_INTERVAL_MS / 1000);
      countdownRef.current = setInterval(() => {
        setCountdown(c => {
          if (c <= 1) return CYCLE_INTERVAL_MS / 1000;
          return c - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      setCountdown(0);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [autoRun]);

  const criticalCount = state?.crises.filter(c => c.severity === 'CRITICAL' && c.status === 'active').length || 0;
  const highCount = state?.crises.filter(c => c.severity === 'HIGH' && c.status === 'active').length || 0;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-950">
      {/* Header */}
      <Header
        systemStatus={state?.systemStatus || 'idle'}
        cycle={state?.cycle || 0}
        lastUpdated={state?.lastUpdated}
        loading={loading}
        autoRun={autoRun}
        countdown={countdown}
        onRunCycle={runCycle}
        onToggleAuto={() => setAutoRun(v => !v)}
        criticalCount={criticalCount}
        highCount={highCount}
      />

      {/* Status Bar */}
      {state && (
        <StatusBar
          crises={state.crises}
          resources={state.resources}
          notifications={state.notifications}
          weather={state.weatherData}
        />
      )}

      {/* Error Banner */}
      {error && (
        <div className="px-4 py-2 bg-red-900/40 border-b border-red-500/30 text-red-300 text-xs flex items-center gap-2">
          <span>⚠</span> {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-200">✕</button>
        </div>
      )}

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar — Crisis Panel */}
        <div className="w-80 flex-shrink-0 flex flex-col border-r border-white/5 overflow-hidden">
          <CrisisPanel crises={state?.crises || []} signals={state?.signals || []} />
        </div>

        {/* Center — Main Content with Tabs */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tab Navigation */}
          <div className="flex items-center gap-1 px-4 py-2 border-b border-white/5 bg-gray-950/80">
            {([
              { key: 'map', label: '🗺 Map', },
              { key: 'resources', label: '🚨 Resources', },
              { key: 'timeline', label: '📡 Timeline', },
              { key: 'ai', label: '🧠 AI Trace', },
              { key: 'simulation', label: '🎯 Simulation', },
              { key: 'notifications', label: '🔔 Alerts', },
            ] as const).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  activeTab === tab.key
                    ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                }`}
              >
                {tab.label}
              </button>
            ))}
            {/* Live indicator */}
            {autoRun && (
              <div className="ml-auto flex items-center gap-2 text-xs text-green-400">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block" />
                LIVE — {countdown}s
              </div>
            )}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'map' && (
              <CrisisMap
                crises={state?.crises || []}
                resources={state?.resources || []}
                trafficActions={state?.trafficActions || []}
                signals={state?.signals || []}
              />
            )}
            {activeTab === 'resources' && (
              <ResourcePanel
                resources={state?.resources || []}
                allocations={state?.allocations || []}
                crises={state?.crises || []}
              />
            )}
            {activeTab === 'timeline' && (
              <TimelineFeed
                signals={state?.signals || []}
                crises={state?.crises || []}
                cycle={state?.cycle || 0}
              />
            )}
            {activeTab === 'ai' && (
              <AIDecisionTrace logs={state?.decisionLogs || []} />
            )}
            {activeTab === 'simulation' && (
              <SimulationPanel
                simulations={state?.simulations || []}
                crises={state?.crises || []}
              />
            )}
            {activeTab === 'notifications' && (
              <NotificationCenter notifications={state?.notifications || []} />
            )}
          </div>
        </div>

        {/* Right Sidebar — Weather + Info */}
        <div className="w-72 flex-shrink-0 flex flex-col border-l border-white/5 overflow-y-auto">
          <WeatherWidget weather={state?.weatherData} />

          {/* Quick Stats */}
          <div className="p-4 space-y-3">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">System Overview</div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Active Crises', value: state?.crises.filter(c => c.status === 'active').length || 0, color: 'text-red-400' },
                { label: 'Signals', value: state?.signals.length || 0, color: 'text-cyan-400' },
                { label: 'Dispatched', value: state?.resources.filter(r => r.status === 'dispatched').length || 0, color: 'text-orange-400' },
                { label: 'Notifications', value: state?.notifications.length || 0, color: 'text-purple-400' },
              ].map(stat => (
                <div key={stat.label} className="glass-card p-3">
                  <div className={`text-xl font-bold ${stat.color}`}>{stat.value}</div>
                  <div className="text-xs text-gray-500 mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Notifications Preview */}
          <div className="p-4 border-t border-white/5">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Recent Alerts</div>
            <div className="space-y-2">
              {(state?.notifications || []).slice(0, 4).map(n => (
                <div key={n.id} className={`notif-item notif-${n.severity.toLowerCase()}`}>
                  <div className="text-xs font-medium text-white leading-tight">{n.title}</div>
                  <div className="text-xs text-gray-400 mt-1">{n.location}</div>
                </div>
              ))}
              {(!state?.notifications || state.notifications.length === 0) && (
                <div className="text-xs text-gray-600 italic">No alerts yet</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Empty state */}
      {!state && !loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-950/90 backdrop-blur-sm z-10">
          <div className="text-center space-y-6 max-w-md p-8">
            <div className="text-6xl mb-4">🛡️</div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              CIRO Online
            </h1>
            <p className="text-gray-400 text-sm leading-relaxed">
              Crisis Intelligence & Response Orchestrator.<br/>
              Fusing Google Maps, Weather, and social media signals<br/>
              with Gemini AI for real-time city emergency management.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={runCycle}
                className="px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-lg font-semibold text-white hover:from-cyan-500 hover:to-blue-500 transition-all shadow-lg shadow-blue-900/30"
              >
                ▶ Run First Analysis Cycle
              </button>
              <button
                onClick={() => setAutoRun(true)}
                className="px-6 py-3 border border-green-500/40 text-green-400 rounded-lg font-semibold hover:bg-green-500/10 transition-all text-sm"
              >
                ⚡ Start Live Monitoring
              </button>
            </div>
            <p className="text-xs text-gray-600">Add your Gemini API key in .env.local to enable AI analysis</p>
          </div>
        </div>
      )}
    </div>
  );
}

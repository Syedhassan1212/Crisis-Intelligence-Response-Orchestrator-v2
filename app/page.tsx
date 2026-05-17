'use client';

import { useState, useEffect, useRef } from 'react';
import { Radio, Shield, Sun, Settings, Terminal, HelpCircle, History, Rocket } from 'lucide-react';
import Header from './components/Header';
import StatusBar from './components/StatusBar';
import CrisisPanel from './components/CrisisPanel';
import CrisisMap from './components/CrisisMap';
import ResourcePanel from './components/ResourcePanel';
import SimulationPanel from './components/SimulationPanel';
import NotificationCenter from './components/NotificationCenter';
import AIDecisionTrace from './components/AIDecisionTrace';
import TimelineFeed from './components/TimelineFeed';
import WeatherWidget from './components/WeatherWidget';
import type { OrchestratorState } from '@/lib/types';

export default function Home() {
  const [state, setState] = useState<OrchestratorState | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRun, setAutoRun] = useState(true);
  const [countdown, setCountdown] = useState(30);

  // Collapsible sidebar state variables for clean, non-overwhelming cartography layout
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);

  // Tab views state variables
  const [centerTab, setCenterTab] = useState<'map' | 'timeline' | 'trace'>('map');
  const [rightTab, setRightTab] = useState<'resources' | 'simulations' | 'warnings'>('resources');

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch telemetry packet from backend
  const fetchState = async () => {
    try {
      const res = await fetch('/api/state');
      const data = await res.json();
      if (data.success) {
        setState(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch state:', error);
    } finally {
      setLoading(false);
    }
  };

  // Run orchestration sweep cycle
  const runSweepCycle = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/orchestrate', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setState(data.data);
        setCountdown(30);
      }
    } catch (error) {
      console.error('Orchestration cycle execution failed:', error);
    } finally {
      setLoading(false);
    }
  };

  // Auto runner logic
  useEffect(() => {
    fetchState();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (autoRun) {
      timerRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            runSweepCycle();
            return 30;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [autoRun]);

  const handleManualDispatch = (updatedState: OrchestratorState) => {
    setState(updatedState);
  };

  if (!state) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#09090b] text-zinc-100 font-sans animate-pulse">
        <div className="text-4xl mb-4">🛰️</div>
        <div className="text-sm font-semibold tracking-wider uppercase">Connecting to CIRO Tactical Command Center...</div>
        <div className="text-[11px] text-zinc-500 mt-2">Synchronizing city dispatch nodes...</div>
      </div>
    );
  }

  const criticalCrises = state.crises.filter(c => c.status === 'active' && c.severity === 'CRITICAL');
  const highCrises = state.crises.filter(c => c.status === 'active' && c.severity === 'HIGH');

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#10131a] text-zinc-100 font-sans">
      <div className="scan-line" />
      
      {/* 1. Tactical Command Header */}
      <Header
        systemStatus={state.systemStatus}
        cycle={state.cycle}
        lastUpdated={state.lastUpdated}
        loading={loading}
        autoRun={autoRun}
        countdown={countdown}
        onRunCycle={runSweepCycle}
        onToggleAuto={() => setAutoRun(v => !v)}
        criticalCount={criticalCrises.length}
        highCount={highCrises.length}
        activeTab={centerTab}
        onTabChange={setCenterTab}
      />

      {/* 2. Stitch Static SideNavBar */}
      <aside className="fixed left-0 top-16 bottom-0 w-64 bg-[#0b0e15]/40 backdrop-blur-md border-r border-zinc-800 flex flex-col h-full py-4 z-40">
        <div className="px-4 mb-6">
          <div className="flex items-center gap-3 mb-4 select-none">
            <div className="w-10 h-10 rounded bg-sky-500/10 flex items-center justify-center border border-sky-400/20">
              <Radio className="w-5 h-5 text-sky-400 animate-pulse" />
            </div>
            <div>
              <div className="font-mono text-[11px] font-bold text-sky-300 tracking-wider">NODE ALPHA</div>
              <div className="font-mono text-[8px] text-zinc-500 font-semibold tracking-widest mt-0.5">V.2.4.9 ACTIVE</div>
            </div>
          </div>
          <button 
            onClick={runSweepCycle}
            disabled={loading}
            className="w-full bg-sky-500/10 hover:bg-sky-500/20 border border-sky-400/20 text-sky-300 font-mono text-[9px] font-bold py-2.5 rounded transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
          >
            <Rocket className="w-3.5 h-3.5 animate-bounce" />
            DEPLOY ASSET
          </button>
        </div>

        <nav className="flex-1 px-2 space-y-1">
          {[
            { id: 'signals', label: 'Signals', icon: Radio, action: () => { setLeftOpen(true); setCenterTab('map'); } },
            { id: 'tactical', label: 'Tactical', icon: Shield, action: () => { setCenterTab('trace'); } },
            { id: 'climate', label: 'Climate', icon: Sun, action: () => { setRightOpen(true); setRightTab('simulations'); } },
            { id: 'ops', label: 'Ops', icon: Settings, action: () => { setRightOpen(true); setRightTab('resources'); } },
            { id: 'system', label: 'System', icon: Terminal, action: () => { setCenterTab('timeline'); } }
          ].map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={item.action}
                className="w-full flex items-center gap-3 px-4 py-3 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/30 rounded font-mono text-[10px] font-bold tracking-wider transition-all cursor-pointer text-left"
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="px-2 mt-auto pb-14 border-t border-zinc-850 pt-2">
          <button 
            onClick={() => alert("CIRO encrypted secure communication uplink active. All channels monitoring node intercepts.")}
            className="w-full flex items-center gap-3 px-4 py-2 text-zinc-500 hover:text-zinc-300 rounded font-mono text-[9px] font-semibold tracking-wider transition-all cursor-pointer text-left"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Help</span>
          </button>
          <button 
            onClick={() => setCenterTab('timeline')}
            className="w-full flex items-center gap-3 px-4 py-2 text-zinc-500 hover:text-zinc-300 rounded font-mono text-[9px] font-semibold tracking-wider transition-all cursor-pointer text-left"
          >
            <History className="w-3.5 h-3.5" />
            <span>Logs</span>
          </button>
        </div>
      </aside>

      {/* 3. Main Workspace Grid */}
      <main className="ml-64 mt-16 flex-1 flex flex-col h-[calc(100vh-64px)] overflow-hidden pb-8">
        
        {/* Horizontal Status Bar */}
        <StatusBar
          crises={state.crises}
          resources={state.resources}
          notifications={state.notifications}
          weather={state.weatherData}
        />

        <div className="flex-1 flex overflow-hidden min-h-0 relative">
          {/* Left Column: Collapsible Crisis Panel */}
          <section 
            className={`h-full border-r border-zinc-800 bg-[#09090b] flex-shrink-0 flex flex-col transition-all duration-300 ease-in-out relative z-10 ${
              leftOpen ? 'w-[24%] translate-x-0' : 'w-0 -translate-x-full border-r-0'
            }`}
          >
            {leftOpen && (
              <div className="w-full h-full flex flex-col overflow-hidden">
                <CrisisPanel
                  crises={state.crises}
                  signals={state.signals}
                />
              </div>
            )}
          </section>

          {/* Center Section: Fullscreen Map (Main focus of layout) */}
          <section className="flex-1 h-full flex flex-col overflow-hidden relative bg-[#09090b]">
            
            {/* Top Panel Controls Toggle Bar */}
            <div className="absolute top-3 left-4 z-20 flex items-center gap-2">
              {/* Left Drawer Toggle */}
              <button
                onClick={() => setLeftOpen(v => !v)}
                className="px-2.5 py-1.5 rounded-md bg-zinc-900/90 border border-zinc-800 text-zinc-300 hover:text-white transition-all shadow-lg backdrop-blur-md text-[10px] font-bold flex items-center gap-1.5 cursor-pointer animate-in fade-in"
                title={leftOpen ? "Collapse Incident Index" : "Expand Incident Index"}
              >
                <span>{leftOpen ? '◀' : '▶'}</span>
                <span>Signals</span>
              </button>

              {/* Right Drawer Toggle */}
              <button
                onClick={() => setRightOpen(v => !v)}
                className="px-2.5 py-1.5 rounded-md bg-zinc-900/90 border border-zinc-800 text-zinc-300 hover:text-white transition-all shadow-lg backdrop-blur-md text-[10px] font-bold flex items-center gap-1.5 cursor-pointer animate-in fade-in"
                title={rightOpen ? "Collapse Operations Panel" : "Expand Operations Panel"}
              >
                <span>Operations</span>
                <span>{rightOpen ? '▶' : '◀'}</span>
              </button>
            </div>

            {/* Central Display View Switcher */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex bg-zinc-900/95 p-1 rounded-lg border border-zinc-800 shadow-xl backdrop-blur-md select-none">
              {[
                { id: 'map', label: '🗺️ Map View' },
                { id: 'timeline', label: '📊 Decision Logs' },
                { id: 'trace', label: '🧠 AI Cognitive Traces' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setCenterTab(tab.id as any)}
                  className={`px-3.5 py-1.5 text-[10px] font-bold rounded transition-all cursor-pointer ${
                    centerTab === tab.id
                      ? 'bg-zinc-800 text-white border border-zinc-700 shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Core Display Panels Container */}
            <div className="w-full h-full relative">
              {/* Map is always rendered in background to prevent map instance reloading */}
              <div className="absolute inset-0 z-0">
                <CrisisMap
                  crises={state.crises}
                  resources={state.resources}
                  trafficActions={state.trafficActions}
                  signals={state.signals}
                  onManualDispatch={handleManualDispatch}
                />
              </div>

              {/* Decision Logs Overlay */}
              {centerTab === 'timeline' && (
                <div className="absolute inset-0 bg-[#09090b]/95 z-10 overflow-auto border-t border-zinc-800 p-4 animate-in fade-in slide-in-from-bottom duration-250">
                  <div className="max-w-6xl mx-auto h-full flex flex-col">
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
                      <h2 className="text-sm font-bold text-zinc-100">📋 Tactical Decision Logs & Timefeed</h2>
                      <button 
                        onClick={() => setCenterTab('map')} 
                        className="px-2.5 py-1 rounded bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-700 text-[10px] font-bold transition-all cursor-pointer"
                      >
                        ✕ Close
                      </button>
                    </div>
                    <div className="flex-1 min-h-0 overflow-y-auto">
                      <TimelineFeed
                        signals={state.signals}
                        crises={state.crises}
                        cycle={state.cycle}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* AI Cognitive Traces Overlay */}
              {centerTab === 'trace' && (
                <div className="absolute inset-0 bg-[#09090b]/95 z-10 overflow-auto border-t border-zinc-800 p-4 animate-in fade-in slide-in-from-bottom duration-250">
                  <div className="max-w-6xl mx-auto h-full flex flex-col">
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
                      <h2 className="text-sm font-bold text-zinc-100">🧠 AI Agents Cognitive Operations Trace</h2>
                      <button 
                        onClick={() => setCenterTab('map')} 
                        className="px-2.5 py-1 rounded bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-700 text-[10px] font-bold transition-all cursor-pointer"
                      >
                        ✕ Close
                      </button>
                    </div>
                    <div className="flex-1 min-h-0 overflow-y-auto">
                      <AIDecisionTrace
                        logs={state.decisionLogs}
                        crises={state.crises}
                        signals={state.signals}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Right Column: Collapsible Operations Panel */}
          <section 
            className={`h-full border-l border-zinc-800 bg-[#09090b] flex-shrink-0 flex flex-col transition-all duration-300 ease-in-out relative z-10 ${
              rightOpen ? 'w-[26%] translate-x-0' : 'w-0 translate-x-full border-l-0'
            }`}
          >
            {rightOpen && (
              <div className="w-full h-full flex flex-col overflow-hidden">
                
                {/* Climate module */}
                <WeatherWidget weather={state.weatherData} />

                {/* Operations tab switches */}
                <div className="px-4 py-2 border-b border-zinc-800 bg-zinc-900/40 flex items-center justify-between flex-shrink-0">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Operations Control</span>
                  <div className="flex bg-zinc-950 p-0.5 rounded border border-zinc-800">
                    {[
                      { id: 'resources', label: '🚒 Assets' },
                      { id: 'simulations', label: '🎯 Predictions' },
                      { id: 'warnings', label: '🔔 Warnings' }
                    ].map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setRightTab(tab.id as any)}
                        className={`px-3 py-1.5 text-[9.5px] font-bold rounded-sm transition-all cursor-pointer ${
                          rightTab === tab.id
                            ? 'bg-zinc-800 text-white'
                            : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Content Panel Area */}
                <div className="flex-1 min-h-0 relative">
                  {rightTab === 'resources' && (
                    <ResourcePanel
                      resources={state.resources}
                      allocations={state.allocations}
                      crises={state.crises}
                    />
                  )}
                  {rightTab === 'simulations' && (
                    <SimulationPanel
                      simulations={state.simulations}
                      crises={state.crises}
                    />
                  )}
                  {rightTab === 'warnings' && (
                    <NotificationCenter
                      notifications={state.notifications}
                    />
                  )}
                </div>
              </div>
            )}
          </section>
        </div>

      </main>

      {/* 4. Encrypted Footer channel bar */}
      <footer className="fixed bottom-0 left-0 right-0 h-8 bg-[#0b0e15] border-t border-zinc-850 flex items-center justify-between px-6 text-[9.5px] uppercase tracking-widest font-mono text-zinc-500 z-50 select-none">
        <span className="text-amber-500 font-semibold">© 2024 CIRO GLOBAL OPERATIONS - ENCRYPTED CHANNEL</span>
        <div className="flex gap-6">
          <span className="hover:text-zinc-300 cursor-pointer transition-colors">Privacy</span>
          <span className="hover:text-zinc-300 cursor-pointer transition-colors">Protocol</span>
          <span className="hover:text-zinc-300 cursor-pointer transition-colors text-sky-400">Audit</span>
        </div>
      </footer>

    </div>
  );
}

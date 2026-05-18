'use client';

import { useState, useEffect, useRef } from 'react';
import { Map, Clock, Cpu, Radio, Package, LogOut, ChevronLeft, ChevronRight, X } from 'lucide-react';
import Header from './components/Header';
import CrisisPanel from './components/CrisisPanel';
import CrisisMap from './components/CrisisMap';
import ResourcePanel from './components/ResourcePanel';
import SimulationPanel from './components/SimulationPanel';
import NotificationCenter from './components/NotificationCenter';
import AIDecisionTrace from './components/AIDecisionTrace';
import TimelineFeed from './components/TimelineFeed';
import WeatherWidget from './components/WeatherWidget';
import type { OrchestratorState } from '@/lib/types';

// ── Sidebar items: each has a DISTINCT purpose ──────────────────────────────
// Map     → switch center to Map View
// Timeline → switch center to Decision Logs
// AI Trace → switch center to AI Cognitive Traces
// Signals  → toggle left panel (Interception Cards)
// Assets   → toggle right panel (Operations Control)

export default function Home() {
  const [state, setState] = useState<OrchestratorState | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRun, setAutoRun] = useState(true);
  const [countdown, setCountdown] = useState(30);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [centerTab, setCenterTab] = useState<'map' | 'timeline' | 'trace'>('map');
  const [rightTab, setRightTab] = useState<'resources' | 'simulations' | 'warnings'>('resources');
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchState = async () => {
    try {
      const res = await fetch('/api/state');
      const data = await res.json();
      if (data.success) setState(data.data);
    } catch (error) {
      console.error('Failed to fetch state:', error);
    } finally {
      setLoading(false);
    }
  };

  const runSweepCycle = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/orchestrate');
      const text = await res.text();
      if (!text) throw new Error(`Empty response. Status: ${res.status}`);
      const data = JSON.parse(text);
      if (data.success) { setState(data.data); setCountdown(30); }
    } catch (error) {
      console.error('Orchestration cycle failed:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchState();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  useEffect(() => {
    if (autoRun) {
      timerRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) { runSweepCycle(); return 30; }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [autoRun]);

  const handleManualDispatch = (updatedState: OrchestratorState) => setState(updatedState);

  if (!state) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#111113] text-zinc-100 font-sans">
        <div className="text-4xl mb-4 animate-pulse">🛰️</div>
        <div className="text-sm font-semibold tracking-wider uppercase">Connecting to CIRO Tactical Command Center...</div>
        <div className="text-[11px] text-zinc-500 mt-2">Synchronizing city dispatch nodes...</div>
      </div>
    );
  }

  const criticalCrises = state.crises.filter(c => c.status === 'active' && c.severity === 'CRITICAL');
  const highCrises = state.crises.filter(c => c.status === 'active' && c.severity === 'HIGH');

  // 5 sidebar items — all distinct, none repeated
  const NAV_ITEMS = [
    {
      id: 'map',
      Icon: Map,
      label: 'Map',
      desc: 'Tactical Map View',
      active: () => centerTab === 'map',
      action: () => setCenterTab('map'),
    },
    {
      id: 'timeline',
      Icon: Clock,
      label: 'Logs',
      desc: 'Decision Timeline',
      active: () => centerTab === 'timeline',
      action: () => setCenterTab('timeline'),
    },
    {
      id: 'trace',
      Icon: Cpu,
      label: 'AI Trace',
      desc: 'Cognitive Traces',
      active: () => centerTab === 'trace',
      action: () => setCenterTab('trace'),
    },
    {
      id: 'signals',
      Icon: Radio,
      label: 'Signals',
      desc: 'Interception Cards',
      active: () => leftOpen,
      action: () => setLeftOpen(v => !v),
      badge: criticalCrises.length > 0 ? criticalCrises.length : null,
    },
    {
      id: 'assets',
      Icon: Package,
      label: 'Assets',
      desc: 'Operations Control',
      active: () => rightOpen,
      action: () => setRightOpen(v => !v),
    },
  ];

  const TAB_ITEMS = [
    { id: 'map',      label: 'Map View' },
    { id: 'timeline', label: 'Tactical Decision Logs' },
    { id: 'trace',    label: 'AI Cognitive Traces' },
  ];

  const RIGHT_TABS = [
    { id: 'resources',   label: 'Assets' },
    { id: 'simulations', label: 'Predictions' },
    { id: 'warnings',    label: 'Alerts' },
  ];

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#111113] text-zinc-100 font-sans">

      {/* ── TOP HEADER ── */}
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
        weather={state.weatherData}
      />

      {/* ── BELOW HEADER: SIDEBAR + WORKSPACE ── */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* ── SIDEBAR — 5 distinct nav items ── */}
        <aside className="w-[68px] flex-shrink-0 bg-[#0e0e10] border-r border-[#1e1e21] flex flex-col items-center py-3 gap-0.5 z-40">

          <nav className="flex flex-col items-center gap-0.5 w-full flex-1">
            {NAV_ITEMS.map(({ id, Icon, label, active, action, badge }) => {
              const isActive = active();
              return (
                <button
                  key={id}
                  onClick={action}
                  title={label}
                  className={`relative w-full flex flex-col items-center gap-1 py-3 px-1 transition-all cursor-pointer group ${
                    isActive
                      ? 'text-white bg-[#1e1e21]'
                      : 'text-zinc-600 hover:text-zinc-200 hover:bg-[#161618]'
                  }`}
                >
                  {/* Active indicator bar */}
                  {isActive && (
                    <span className="absolute left-0 top-2 bottom-2 w-0.5 bg-emerald-500 rounded-r" />
                  )}

                  {/* Icon + badge */}
                  <div className="relative">
                    <Icon className={`w-[17px] h-[17px] ${isActive ? 'text-emerald-400' : 'text-zinc-500 group-hover:text-zinc-300'}`} />
                    {badge && (
                      <span className="absolute -top-1 -right-1.5 w-3.5 h-3.5 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center leading-none">
                        {badge > 9 ? '9+' : badge}
                      </span>
                    )}
                  </div>

                  <span className={`text-[9px] font-semibold tracking-wide leading-none ${isActive ? 'text-zinc-200' : 'text-zinc-600 group-hover:text-zinc-400'}`}>
                    {label}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Divider */}
          <div className="w-8 h-px bg-[#27272a] my-1" />

          {/* Logout */}
          <button
            title="Exit Session"
            className="w-full flex flex-col items-center gap-1 py-3 px-1 text-zinc-600 hover:text-zinc-400 hover:bg-[#161618] transition-all cursor-pointer"
            onClick={() => alert('CIRO session management')}
          >
            <LogOut className="w-[17px] h-[17px]" />
            <span className="text-[9px] font-semibold tracking-wide leading-none">Exit</span>
          </button>
        </aside>

        {/* ── THREE-COLUMN WORKSPACE ── */}
        <div className="flex flex-1 overflow-hidden min-h-0">

          {/* LEFT COL — Interception Cards */}
          <section className={`h-full border-r border-[#1e1e21] bg-[#111113] flex-shrink-0 flex flex-col transition-all duration-300 ${
            leftOpen ? 'w-[300px]' : 'w-0 overflow-hidden border-r-0'
          }`}>
            {leftOpen && (
              <CrisisPanel
                crises={state.crises}
                signals={state.signals}
                trafficActions={state.trafficActions}
                onCollapse={() => setLeftOpen(false)}
              />
            )}
          </section>

          {/* CENTER — Map / Timeline / AI Traces */}
          <section className="flex-1 h-full flex flex-col overflow-hidden bg-[#111113] relative">

            {/* Tab strip always visible on top */}
            <TabStrip activeTab={centerTab} onTabChange={setCenterTab} tabs={TAB_ITEMS} leftOpen={leftOpen} rightOpen={rightOpen} onToggleLeft={() => setLeftOpen(v => !v)} onToggleRight={() => setRightOpen(v => !v)} />

            {/* Map view */}
            <div className={`flex-1 overflow-hidden relative ${centerTab === 'map' ? 'flex' : 'hidden'}`}>
              <CrisisMap
                crises={state.crises}
                resources={state.resources}
                trafficActions={state.trafficActions}
                signals={state.signals}
                onManualDispatch={handleManualDispatch}
                activeTab={centerTab}
                onTabChange={setCenterTab}
                leftOpen={leftOpen}
                rightOpen={rightOpen}
                onToggleLeft={() => setLeftOpen(v => !v)}
                onToggleRight={() => setRightOpen(v => !v)}
              />
            </div>

            {/* Decision Logs */}
            {centerTab === 'timeline' && (
              <div className="flex-1 overflow-auto bg-[#111113] p-4">
                <TimelineFeed signals={state.signals} crises={state.crises} cycle={state.cycle} />
              </div>
            )}

            {/* AI Cognitive Traces — full-height, no outer padding */}
            {centerTab === 'trace' && (
              <div className="flex-1 overflow-hidden">
                <AIDecisionTrace logs={state.decisionLogs} crises={state.crises} signals={state.signals} />
              </div>
            )}
          </section>

          {/* RIGHT COL — Operations Control + Tabs */}
          <section className={`h-full border-l border-[#1e1e21] bg-[#111113] flex-shrink-0 flex flex-col transition-all duration-300 ${
            rightOpen ? 'w-[280px]' : 'w-0 overflow-hidden border-l-0'
          }`}>
            {rightOpen && (
              <div className="w-full h-full flex flex-col overflow-hidden">

                {/* Panel header with collapse button */}
                <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-[#27272a]">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono">Operations Control</span>
                  <button
                    onClick={() => setRightOpen(false)}
                    className="w-6 h-6 flex items-center justify-center rounded text-zinc-600 hover:text-zinc-200 hover:bg-[#27272a] transition-all cursor-pointer"
                    title="Hide Operations Control"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Stats */}
                <WeatherWidget resources={state.resources} allocations={state.allocations} />

                {/* Right Panel Tabs */}
                <TabStrip activeTab={rightTab} onTabChange={setRightTab} tabs={RIGHT_TABS} />

                {/* Tab Content */}
                <div className="flex-1 overflow-auto bg-[#111113]">
                  {rightTab === 'resources' && (
                    <ResourcePanel
                      resources={state.resources}
                      allocations={state.allocations}
                      crises={state.crises}
                    />
                  )}
                  {rightTab === 'simulations' && (
                    <SimulationPanel simulations={state.simulations} crises={state.crises} />
                  )}
                  {rightTab === 'warnings' && (
                    <NotificationCenter notifications={state.notifications} />
                  )}
                </div>
              </div>
            )}
          </section>

        </div>
      </div>
    </div>
  );
}

// ── Tab Strip component ──────────────────────────────────────────────────────
function TabStrip({ activeTab, onTabChange, tabs, leftOpen, rightOpen, onToggleLeft, onToggleRight }: {
  activeTab: string;
  onTabChange: (t: any) => void;
  tabs: { id: string; label: string }[];
  leftOpen?: boolean;
  rightOpen?: boolean;
  onToggleLeft?: () => void;
  onToggleRight?: () => void;
}) {
  return (
    <div className="flex-shrink-0 flex items-center border-b border-[#1e1e21] bg-[#0e0e10]">

      {/* Left panel toggle pill (only for center tab strip) */}
      {onToggleLeft !== undefined && (
        <button
          onClick={onToggleLeft}
          title={leftOpen ? 'Hide Interception Cards' : 'Show Interception Cards'}
          className={`flex-shrink-0 flex items-center gap-1.5 px-3 h-full border-r border-[#1e1e21] text-[10px] font-bold font-mono transition-all cursor-pointer ${
            leftOpen ? 'text-emerald-400 bg-[#0e0e10]' : 'text-zinc-600 hover:text-zinc-300 bg-[#0e0e10]'
          }`}
        >
          <ChevronLeft className={`w-3.5 h-3.5 transition-transform ${leftOpen ? '' : 'rotate-180'}`} />
        </button>
      )}

      {/* Tabs */}
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex-1 py-3 text-[12px] font-medium tracking-wide transition-all cursor-pointer border-b-2 ${
            activeTab === tab.id
              ? 'border-emerald-500 text-white bg-[#111113]'
              : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-[#111113]/50'
          }`}
        >
          {tab.label}
        </button>
      ))}

      {/* Right panel toggle pill (only for center tab strip) */}
      {onToggleRight !== undefined && (
        <button
          onClick={onToggleRight}
          title={rightOpen ? 'Hide Operations Control' : 'Show Operations Control'}
          className={`flex-shrink-0 flex items-center gap-1.5 px-3 h-full border-l border-[#1e1e21] text-[10px] font-bold font-mono transition-all cursor-pointer ${
            rightOpen ? 'text-emerald-400 bg-[#0e0e10]' : 'text-zinc-600 hover:text-zinc-300 bg-[#0e0e10]'
          }`}
        >
          <ChevronRight className={`w-3.5 h-3.5 transition-transform ${rightOpen ? '' : 'rotate-180'}`} />
        </button>
      )}
    </div>
  );
}

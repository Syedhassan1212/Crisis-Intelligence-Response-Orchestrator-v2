// ============================================================
// CIRO — Main Orchestrator
// Coordinates all engines and maintains system state
// ============================================================

import type {
  OrchestratorState, CrisisEvent, FusedSignal, ResourceUnit,
  AllocationPlan, Notification, AIDecisionLog, SimulationResult, TrafficAction, TrafficData
} from './types';
import { fetchSocialPosts, fetchWeatherData, fetchTrafficData, fuseSocialSignals, getDefaultResources } from './ingestion';
import {
  analyzeCrisisBrain, planResponseBrain,
  buildDecisionLog, summarizeSignals
} from './gemini';
import { logInfo, logSuccess, logWarn, logError, setGlobalCycle, getLogs } from './logger';
import { persistLogs, persistCrises, persistAllocations, persistNotifications, persistCycle, isSupabaseEnabled } from './supabase';

// Use globalThis to maintain a single global state across Next.js Turbopack dev compilations
const globalForOrchestrator = globalThis as unknown as {
  state?: OrchestratorState;
};

export let state: OrchestratorState = globalForOrchestrator.state ?? {
  cycle: 0,
  lastUpdated: new Date().toISOString(),
  crises: [],
  signals: [],
  resources: getDefaultResources() as ResourceUnit[],
  allocations: [],
  trafficActions: [],
  simulations: [],
  notifications: [],
  decisionLogs: [],
  systemStatus: 'idle',
  weatherData: {
    location: 'Karachi',
    temperature: 32.5,
    condition: 'Partly Cloudy',
    humidity: 68,
    windSpeed: 14,
    rainfall: 0,
    forecast: 'Sunny',
    fetchedAt: new Date().toISOString()
  }
};

globalForOrchestrator.state = state;

export function getState(): OrchestratorState {
  return state;
}

export function resetState() {
  state = {
    cycle: 0,
    lastUpdated: new Date().toISOString(),
    crises: [],
    signals: [],
    resources: getDefaultResources() as ResourceUnit[],
    allocations: [],
    trafficActions: [],
    simulations: [],
    notifications: [],
    decisionLogs: [],
    systemStatus: 'idle',
  };
  globalForOrchestrator.state = state;
}

// ── Main Orchestration Cycle ─────────────────────────────────
export async function runCycle(): Promise<OrchestratorState> {
  state.systemStatus = 'processing';
  state.cycle += 1;
  setGlobalCycle(state.cycle);
  const cycleStart = Date.now();
  const logs: AIDecisionLog[] = [];
  logInfo('ORCHESTRATOR', 'Orchestrator', 'CYCLE_START', `=== Cycle #${state.cycle} started ===`, { cycleNumber: state.cycle });

  try {
    // ── Step 1: Ingest all data ──────────────────────────────
    const [posts, weather, traffic] = await Promise.all([
      fetchSocialPosts(20),
      fetchWeatherData(),
      fetchTrafficData(),
    ]);
    state.weatherData = weather;

    logs.push(buildDecisionLog(
      'DataIngestion',
      `Fetched ${posts.length} social posts, weather at ${weather.temperature.toFixed(1)}°C`,
      `Traffic: ${traffic.length} areas monitored`,
      0.9, ['Ingested social posts', 'Fetched weather', 'Got traffic data'],
      posts.length === 0 ? ['social_api_empty'] : []
    ));

    // ── Step 2: Signal Fusion ────────────────────────────────
    logInfo('SIGNAL_FUSION', 'SignalFusionEngine', 'FUSE', `Fusing ${posts.length} posts + weather + ${traffic.length} traffic zones`);
    const rawSignals = fuseSocialSignals(posts, weather, traffic);
    const topSignals = rawSignals.slice(0, 6); // Process top 6 signals
    state.signals = rawSignals;
    const critSigs = rawSignals.filter(s => s.urgency_level === 'CRITICAL').length;
    const highSigs = rawSignals.filter(s => s.urgency_level === 'HIGH').length;
    logSuccess('SIGNAL_FUSION', 'SignalFusionEngine', 'FUSE',
      `Fused ${rawSignals.length} signals: ${critSigs} CRITICAL, ${highSigs} HIGH — top ${topSignals.length} queued for AI`, {
      details: { totalSignals: rawSignals.length, criticalCount: critSigs, highCount: highSigs },
    });
    logs.push(buildDecisionLog(
      'SignalFusion',
      `${posts.length} posts → ${rawSignals.length} raw signals`,
      `Top ${topSignals.length} signals selected for analysis`,
      0.85, ['Grouped by location+type', 'Scored by confidence', 'Applied weather boost'],
    ));

    // ── Step 3: Crisis Detection (parallel for speed) ────────
    const newCrises: CrisisEvent[] = [];
    const CRISIS_THRESHOLD = 0.4;
    const highConfidenceSignals = topSignals.filter(s => s.confidence_score >= CRISIS_THRESHOLD);

    if (highConfidenceSignals.length > 0) {
      state.systemStatus = 'alert';
      const toProcess = highConfidenceSignals.slice(0, 3);
      
      const results = await Promise.all(
        toProcess.map(async (signal) => {
          try {
            return await analyzeCrisisBrain(signal);
          } catch (err) {
            logError('CRISIS_DETECTION', 'Orchestrator', 'CLASSIFY_FALLBACK',
              `Gemini classification failed for ${signal.event_type}@${signal.location}: ${err} — using heuristic fallback`, {
              errorMessage: String(err),
            });
            return signalToCrisis(signal);
          }
        })
      );
      newCrises.push(...results);

      // Check for CRITICAL events
      const critical = newCrises.find(c => c.severity === 'CRITICAL');
      if (critical) state.systemStatus = 'critical';
    }

    // Merge with existing crises (keep non-resolved, update status)
    const existingIds = new Set(state.crises.map(c => c.id));
    const merged = [
      ...state.crises.filter(c => c.status !== 'resolved').map(c => {
        // Age out old crises
        const ageH = (Date.now() - new Date(c.timestamp).getTime()) / 3600000;
        if (ageH > (c.expected_duration_hours || 4)) return { ...c, status: 'resolved' as const };
        return c;
      }),
      ...newCrises,
    ];
    state.crises = merged.slice(0, 20); // Keep max 20

    logs.push(buildDecisionLog(
      'CrisisDetection',
      `Classified ${newCrises.length} new crises from ${highConfidenceSignals.length} signals`,
      newCrises.map(c => `${c.type}@${c.location}(${c.severity})`).join(', '),
      newCrises.reduce((s, c) => s + c.confidence, 0) / Math.max(newCrises.length, 1),
      ['Applied Gemini classification', 'Predicted risk escalation'],
    ));

    // ── Step 4: Resource Allocation ──────────────────────────
    // ── Step 4 & 5 & 7: Unified Response Planning ────────────
    const newAllocations: AllocationPlan[] = [];
    const newSimulations: SimulationResult[] = [];
    const newNotifications: Notification[] = [];

    // ── Simulation Update: Progress assigned resources and resolve active crises ──
    for (let idx = 0; idx < state.resources.length; idx++) {
      const res = state.resources[idx];
      
      // If resource is dispatched/en_route
      if (res.status === 'dispatched' || res.status === 'en_route') {
        const assignedCrisis = state.crises.find(c => c.id === res.assigned_crisis_id);
        
        // If the assigned crisis is resolved or doesn't exist anymore, release the unit
        if (!assignedCrisis || assignedCrisis.status === 'resolved') {
          logInfo('RESOURCE_ALLOCATION', 'Orchestrator', 'RESOURCE_RELEASED', 
            `Releasing Unit ${res.id} (${res.type}) because its assigned crisis was resolved or removed.`);
          state.resources[idx] = {
            ...res,
            status: 'available',
            assigned_crisis_id: undefined,
            eta_minutes: undefined
          };
          continue;
        }

        // Decrement ETA
        const currentEta = res.eta_minutes ?? 10;
        const nextEta = Math.max(0, currentEta - 3); // 3 minutes progress per cycle
        
        if (nextEta === 0) {
          // Unit arrives on scene!
          logSuccess('RESOURCE_ALLOCATION', 'Orchestrator', 'RESOURCE_ARRIVED', 
            `Unit ${res.id} (${res.type}) has arrived on scene at ${assignedCrisis.location} for ${assignedCrisis.type}.`);
          
          state.resources[idx] = {
            ...res,
            status: 'on_scene',
            eta_minutes: 0,
            lat: assignedCrisis.lat,
            lng: assignedCrisis.lng
          };

          newNotifications.push({
            id: `arrival_${Date.now()}_${res.id}`,
            crisis_id: assignedCrisis.id,
            channel: 'emergency_services',
            severity: assignedCrisis.severity,
            title: `🚑 Unit Arrived: ${res.id.toUpperCase()}`,
            message: `Emergency response unit ${res.id.toUpperCase()} (${res.type.replace('_', ' ')}) has arrived on-scene at ${assignedCrisis.location} to mitigate the ${assignedCrisis.type} threat.`,
            location: assignedCrisis.location,
            timestamp: new Date().toISOString(),
            sent: true
          });
        } else {
          // Progress along coordinates towards the crisis location
          const progress = 3 / (currentEta || 3); // step fraction
          const currentLat = res.lat ?? 24.8607;
          const currentLng = res.lng ?? 67.0011;
          const targetLat = assignedCrisis.lat ?? currentLat;
          const targetLng = assignedCrisis.lng ?? currentLng;
          
          state.resources[idx] = {
            ...res,
            eta_minutes: nextEta,
            lat: currentLat + (targetLat - currentLat) * progress,
            lng: currentLng + (targetLng - currentLng) * progress
          };
        }
      } 
      // If resource is on scene
      else if (res.status === 'on_scene') {
        const assignedCrisis = state.crises.find(c => c.id === res.assigned_crisis_id);
        
        // If crisis is already resolved or gone, release the unit
        if (!assignedCrisis || assignedCrisis.status === 'resolved') {
          logInfo('RESOURCE_ALLOCATION', 'Orchestrator', 'RESOURCE_RELEASED', 
            `Unit ${res.id} (${res.type}) has completed scene mitigation and is returning to standby.`);
          
          state.resources[idx] = {
            ...res,
            status: 'available',
            assigned_crisis_id: undefined,
            eta_minutes: undefined
          };
        } else {
          // 60% chance to resolve the crisis each cycle while units are on scene
          const roll = Math.random();
          if (roll > 0.4) {
            const crisisIdx = state.crises.findIndex(c => c.id === assignedCrisis.id);
            if (crisisIdx >= 0) {
              state.crises[crisisIdx] = {
                ...state.crises[crisisIdx],
                status: 'resolved'
              };
              
              logSuccess('RESOURCE_ALLOCATION', 'Orchestrator', 'CRISIS_RESOLVED',
                `Crisis ${assignedCrisis.id} (${assignedCrisis.type} at ${assignedCrisis.location}) has been successfully resolved by responding units.`);
              
              newNotifications.push({
                id: `resolved_${Date.now()}_${assignedCrisis.id}`,
                crisis_id: assignedCrisis.id,
                channel: 'public',
                severity: 'LOW',
                title: `✅ Incident Resolved: ${assignedCrisis.location}`,
                message: `The ${assignedCrisis.type.replace('_', ' ')} incident at ${assignedCrisis.location} has been successfully mitigated by emergency responders. Normal traffic and routing are resuming.`,
                location: assignedCrisis.location,
                timestamp: new Date().toISOString(),
                sent: true
              });
            }
          }
        }
      }
    }

    const activeCrises = state.crises.filter(c => c.status === 'active');
    const availableResources = state.resources.filter(r => r.status === 'available');

    const crisesToPlan = activeCrises.slice(0, 3).filter(c => !state.allocations.some(a => a.crisis_id === c.id));
    
    if (crisesToPlan.length > 0) {
      const plans = await Promise.all(
        crisesToPlan.map(async (crisis) => {
          try {
            const result = await planResponseBrain(crisis, availableResources);
            return { success: true, crisis, ...result };
          } catch (err) {
            logWarn('RESPONSE_PLANNER', 'Orchestrator', 'PLAN_FALLBACK',
              `Unified planning failed for ${crisis.id}: ${err} — using heuristics`, { errorMessage: String(err) });
            return {
              success: false,
              crisis,
              plan: buildFallbackAllocation(crisis, availableResources),
              simulation: null,
              notifications: [buildFallbackNotification(crisis)],
            };
          }
        })
      );

      for (const res of plans) {
        newAllocations.push(res.plan);
        if (res.simulation) {
          newSimulations.push(res.simulation);
        }
        newNotifications.push(...res.notifications);

        // Mark resources as dispatched with ETA + coords
        for (const unit of res.plan.units) {
          const idx = state.resources.findIndex(r => r.id === unit.id);
          if (idx >= 0) {
            state.resources[idx] = {
              ...unit,
              status: 'dispatched',
              eta_minutes: res.plan.total_response_time_minutes,
              assigned_crisis_id: res.crisis.id,
              lat: state.resources[idx].lat ?? (24.8607 + (Math.random() - 0.5) * 0.08),
              lng: state.resources[idx].lng ?? (67.0011 + (Math.random() - 0.5) * 0.08),
            };

            // Notify WebSocket server of automated dispatch
            try {
              const WebSocket = require('ws');
              const ws = new WebSocket('ws://localhost:3002');
              ws.on('open', () => {
                ws.send(JSON.stringify({
                  type: 'dispatch',
                  resourceId: unit.id,
                  crisisId: res.crisis.id,
                  eta: res.plan.total_response_time_minutes
                }));
                setTimeout(() => ws.close(), 100);
              });
              ws.on('error', () => {});
            } catch (wsErr) {
              console.warn('[WS Dispatch Auto] Failed to notify WebSocket server:', wsErr);
            }
          }
        }
      }
    }
    state.allocations = [...state.allocations, ...newAllocations].slice(0, 30);
    state.simulations = [...newSimulations, ...state.simulations].slice(0, 10);
    
    // ── Step 6: Traffic Control ──────────────────────────────
    logInfo('TRAFFIC_CONTROL', 'TrafficControlEngine', 'UPDATE_ROADS', `Recalculating road states for ${state.crises.filter(c=>c.status==='active').length} active crises`);
    const newTrafficActions = generateTrafficActions(state.crises, traffic);
    state.trafficActions = newTrafficActions;
    logSuccess('TRAFFIC_CONTROL', 'TrafficControlEngine', 'UPDATE_ROADS',
      `${newTrafficActions.filter(a=>a.action==='block').length} roads blocked, ${newTrafficActions.filter(a=>a.action==='reroute').length} rerouted`);

    state.notifications = [...newNotifications, ...state.notifications].slice(0, 50);

    // ── Finalize ─────────────────────────────────────────────
    state.decisionLogs = [...logs, ...state.decisionLogs].slice(0, 100);
    state.lastUpdated = new Date().toISOString();
    if (state.systemStatus === 'processing') {
      state.systemStatus = activeCrises.length > 0 ? 'alert' : 'idle';
    }
    const cycleDuration = Date.now() - cycleStart;
    logSuccess('ORCHESTRATOR', 'Orchestrator', 'CYCLE_END',
      `=== Cycle #${state.cycle} complete in ${cycleDuration}ms — status: ${state.systemStatus.toUpperCase()} | ${activeCrises.length} active crises, ${state.notifications.length} alerts ===`, {
      durationMs: cycleDuration,
      details: { cycle: state.cycle, activeCrises: activeCrises.length, status: state.systemStatus },
    });

    // ── Supabase Persistence (non-blocking) ──────────────────
    if (isSupabaseEnabled()) {
      const cycleNum = state.cycle;
      const cycleStatus = state.systemStatus;
      const cycleStart2 = new Date(Date.now() - cycleDuration).toISOString();
      const cycleEnd2 = new Date().toISOString();
      (async () => {
        try {
          // Await crisis persistence first to satisfy foreign key (references ciro_crises(id))
          await persistCrises(state.crises, cycleNum);
          await Promise.all([
            persistAllocations(newAllocations, cycleNum),
            persistNotifications(newNotifications),
            persistLogs(getLogs({ limit: 200 })),
            persistCycle({
              cycleNumber: cycleNum,
              startedAt: cycleStart2,
              completedAt: cycleEnd2,
              durationMs: cycleDuration,
              status: cycleStatus,
              activeCrises: activeCrises.length,
              totalSignals: state.signals.length,
              totalAlerts: newNotifications.length,
            }),
          ]);
        } catch (e) {
          console.warn('[Supabase] Async persist failed:', e);
        }
      })();
    }

  } catch (err) {
    const cycleDuration = Date.now() - cycleStart;
    logError('ORCHESTRATOR', 'Orchestrator', 'CYCLE_ERROR',
      `Cycle #${state.cycle} FAILED after ${cycleDuration}ms: ${err}`, {
      durationMs: cycleDuration, errorMessage: String(err),
    });
    state.systemStatus = 'idle';
    state.decisionLogs = [
      buildDecisionLog('Orchestrator', 'Cycle run', `Error: ${err}`, 0, [], ['cycle_error']),
      ...state.decisionLogs
    ].slice(0, 100);
  }

  return state;
}

// ── Helpers ──────────────────────────────────────────────────
function signalToCrisis(signal: FusedSignal): CrisisEvent {
  const severityMap: Record<string, CrisisEvent['severity']> = {
    CRITICAL: 'CRITICAL', HIGH: 'HIGH', MEDIUM: 'MEDIUM', LOW: 'LOW',
  };
  return {
    id: `crisis_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type: signal.event_type,
    severity: severityMap[signal.urgency_level] || 'MEDIUM',
    confidence: signal.confidence_score,
    location: signal.location,
    lat: signal.lat,
    lng: signal.lng,
    affected_radius_km: 2,
    expected_duration_hours: 2,
    description: signal.raw_posts?.[0]?.text || `${signal.event_type} reported at ${signal.location}`,
    evidence: signal.evidence_sources,
    timestamp: new Date().toISOString(),
    status: 'active',
    ai_reasoning: 'Heuristic fallback classification (Gemini unavailable)',
  };
}

function buildFallbackAllocation(crisis: CrisisEvent, available: ResourceUnit[]): AllocationPlan {
  const typeMap: Record<string, string[]> = {
    fire: ['fire_unit', 'ambulance', 'police'],
    accident: ['ambulance', 'police', 'rescue'],
    flood: ['rescue', 'utility', 'ambulance'],
    power_outage: ['utility', 'police'],
    robbery: ['police', 'ambulance'],
    protest: ['police', 'ambulance'],
    default: ['ambulance', 'police', 'rescue'],
  };
  const preferred = typeMap[crisis.type] || typeMap.default;
  const selected = available
    .filter(r => preferred.includes(r.type))
    .slice(0, 3);
  return {
    crisis_id: crisis.id,
    units: selected.map(u => ({ ...u, status: 'dispatched', assigned_crisis_id: crisis.id })),
    total_response_time_minutes: 12,
    reasoning: `Standard allocation for ${crisis.type}`,
    confidence: 0.6,
    timestamp: new Date().toISOString(),
  };
}

function buildFallbackNotification(crisis: CrisisEvent): Notification {
  return {
    id: `notif_${Date.now()}`,
    crisis_id: crisis.id,
    channel: 'public',
    severity: crisis.severity,
    title: `${crisis.severity} Alert: ${crisis.type.replace('_', ' ').toUpperCase()} at ${crisis.location}`,
    message: `Emergency reported at ${crisis.location}. ${crisis.description || 'Please avoid the area and follow official instructions.'}`,
    location: crisis.location,
    timestamp: new Date().toISOString(),
    sent: true,
  };
}

function generateTrafficActions(crises: CrisisEvent[], traffic: TrafficData[]): TrafficAction[] {
  const actions: TrafficAction[] = [];
  for (const crisis of crises.filter(c => c.status === 'active')) {
    if (crisis.severity === 'HIGH' || crisis.severity === 'CRITICAL') {
      actions.push({
        area: crisis.location,
        road: `Main road near ${crisis.location}`,
        action: 'block',
        new_state: 'BLOCKED',
        reason: `${crisis.type} incident — severity: ${crisis.severity}`,
        alternative_route: `Use bypass via ${getAlternateRoute(crisis.location)}`,
      });
    }
  }
  // Mark congested traffic areas
  for (const t of traffic.filter(tr => tr.roadState === 'BLOCKED')) {
    if (!actions.find(a => a.area === t.area)) {
      actions.push({
        area: t.area,
        road: t.area,
        action: 'reroute',
        new_state: 'BLOCKED',
        reason: 'Traffic congestion detected',
        alternative_route: 'Use alternate routes',
      });
    }
  }
  return actions.slice(0, 10);
}

function getAlternateRoute(location: string): string {
  const alternates: Record<string, string> = {
    'Saddar': 'Tariq Road',
    'Clifton': 'DHA',
    'DHA': 'Clifton',
    'Gulshan-e-Iqbal': 'NIPA',
    'Korangi': 'Malir',
    'Lyari': 'Keamari',
    'North Nazimabad': 'Gulshan-e-Iqbal',
  };
  return alternates[location] || 'nearest alternate road';
}



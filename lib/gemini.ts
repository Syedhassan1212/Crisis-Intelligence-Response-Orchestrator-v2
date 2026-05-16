// ============================================================
// CIRO — Gemini 3 Flash AI Engine
// Multi-agent crisis intelligence powered by Google AI
// ============================================================

import { GoogleGenerativeAI } from '@google/generative-ai';
import type {
  FusedSignal, CrisisEvent, CrisisType, SeverityLevel,
  SimulationResult, AIDecisionLog, ResourceUnit, AllocationPlan
} from './types';
import { logInfo, logSuccess, logWarn, logError } from './logger';

let genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (!genAI) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error('GEMINI_API_KEY not set');
    genAI = new GoogleGenerativeAI(key);
  }
  return genAI;
}

async function callGemini(agent: string, action: string, prompt: string, systemInstruction?: string): Promise<string> {
  const start = Date.now();
  const promptPreview = prompt.trim().slice(0, 120).replace(/\n/g, ' ');
  logInfo('API_CALL', agent, action, `→ Gemini Flash: "${promptPreview}..."`, {
    requestPayload: { model: 'gemini-2.0-flash', promptLength: prompt.length },
  });
  try {
    const ai = getGenAI();
    const model = ai.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: systemInstruction || 'You are CIRO, an expert AI crisis intelligence analyst. Always respond with valid JSON only. No markdown, no code blocks, just raw JSON.',
    });
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const ms = Date.now() - start;
    logSuccess('API_CALL', agent, action, `← Gemini responded in ${ms}ms (${clean.length} chars)`, {
      durationMs: ms,
      responsePayload: { length: clean.length, preview: clean.slice(0, 150) },
    });
    return clean;
  } catch (err: unknown) {
    const ms = Date.now() - start;
    logError('API_CALL', agent, action, `✗ Gemini call failed after ${ms}ms: ${err}`, {
      durationMs: ms,
      errorMessage: String(err),
    });
    throw err;
  }
}

// ── Crisis Detection Engine ──────────────────────────────────
export async function classifyCrisis(signal: FusedSignal): Promise<CrisisEvent> {
  logInfo('CRISIS_DETECTION', 'CrisisDetectionAgent', 'CLASSIFY',
    `Classifying ${signal.event_type} signal at ${signal.location} (conf: ${signal.confidence_score.toFixed(2)})`, {
    confidence: signal.confidence_score,
    details: { event_type: signal.event_type, location: signal.location, urgency: signal.urgency_level },
  });
  const prompt = `Analyze this crisis signal and classify it. Return a single JSON object.

Signal:
- Event type hint: ${signal.event_type}
- Location: ${signal.location}
- Confidence: ${signal.confidence_score}
- Evidence: ${signal.evidence_sources.join(', ')}
- Urgency: ${signal.urgency_level}
- Weather context: ${signal.weather_context || 'unknown'}
- Traffic context: ${signal.traffic_context || 'unknown'}
${signal.raw_posts?.length ? `- Social posts: ${signal.raw_posts.map(p => p.text).slice(0, 3).join(' | ')}` : ''}

Return JSON with these exact fields:
{"type":"${signal.event_type}","severity":"LOW|MEDIUM|HIGH|CRITICAL","confidence":0.0,"affected_radius_km":0,"expected_duration_hours":0,"description":"brief description","ai_reasoning":"step-by-step reasoning"}`;

  const raw = await callGemini('CrisisDetectionAgent', 'CLASSIFY', prompt);
  const parsed = JSON.parse(raw);
  const id = `crisis_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const crisis: CrisisEvent = {
    id,
    type: (parsed.type || signal.event_type) as CrisisType,
    severity: (parsed.severity || 'MEDIUM') as SeverityLevel,
    confidence: Math.min(1, Math.max(0, parsed.confidence ?? signal.confidence_score)),
    location: signal.location,
    lat: signal.lat,
    lng: signal.lng,
    affected_radius_km: parsed.affected_radius_km ?? 2,
    expected_duration_hours: parsed.expected_duration_hours ?? 2,
    description: parsed.description ?? '',
    evidence: signal.evidence_sources,
    timestamp: new Date().toISOString(),
    status: 'active',
    ai_reasoning: parsed.ai_reasoning,
  };
  logSuccess('CRISIS_DETECTION', 'CrisisDetectionAgent', 'CLASSIFY',
    `Classified: ${crisis.type} @ ${crisis.location} → ${crisis.severity} (conf: ${crisis.confidence.toFixed(2)})`, {
    confidence: crisis.confidence,
    details: { id: crisis.id, severity: crisis.severity, radius: crisis.affected_radius_km },
  });
  return crisis;
}

// ── Risk Prediction Engine ───────────────────────────────────
export async function predictRisk(crisis: CrisisEvent): Promise<CrisisEvent> {
  logInfo('RISK_PREDICTION', 'RiskPredictionAgent', 'PREDICT_RISK',
    `Predicting risk spread for ${crisis.type} at ${crisis.location}`, {
    confidence: crisis.confidence,
    details: { crisisId: crisis.id, severity: crisis.severity },
  });
  const prompt = `Predict risk escalation for this crisis. Return JSON only.

Crisis:
- Type: ${crisis.type}
- Severity: ${crisis.severity}
- Location: ${crisis.location}
- Affected radius: ${crisis.affected_radius_km} km
- Confidence: ${crisis.confidence}

Return JSON: {"spread_probability":0.0,"population_impact":0,"escalation_probability":0.0,"time_to_peak_hours":0,"ai_reasoning":"brief risk reasoning"}`;

  const raw = await callGemini('RiskPredictionAgent', 'PREDICT_RISK', prompt);
  const parsed = JSON.parse(raw);
  const result: CrisisEvent = {
    ...crisis,
    spread_probability: parsed.spread_probability ?? 0.3,
    population_impact: parsed.population_impact ?? 1000,
    escalation_probability: parsed.escalation_probability ?? 0.2,
    time_to_peak_hours: parsed.time_to_peak_hours ?? 2,
    ai_reasoning: (crisis.ai_reasoning || '') + '\n\nRisk: ' + (parsed.ai_reasoning || ''),
  };
  logSuccess('RISK_PREDICTION', 'RiskPredictionAgent', 'PREDICT_RISK',
    `Risk: spread=${(result.spread_probability! * 100).toFixed(0)}%, escalation=${(result.escalation_probability! * 100).toFixed(0)}%, ~${result.population_impact?.toLocaleString()} people affected`, {
    details: { spread_probability: result.spread_probability, escalation_probability: result.escalation_probability, population_impact: result.population_impact },
  });
  return result;
}

// ── Resource Allocation Engine ───────────────────────────────
export async function optimizeResourceAllocation(
  crisis: CrisisEvent,
  availableResources: ResourceUnit[]
): Promise<AllocationPlan> {
  logInfo('RESOURCE_ALLOCATION', 'ResourceAllocationAgent', 'OPTIMIZE',
    `Optimizing allocation for ${crisis.type} at ${crisis.location} — ${availableResources.length} units available`, {
    details: { crisisId: crisis.id, availableCount: availableResources.length, severity: crisis.severity },
  });
  const prompt = `Optimize emergency resource allocation. Return JSON only.

Crisis:
- Type: ${crisis.type}
- Severity: ${crisis.severity}
- Location: ${crisis.location}
- Affected radius: ${crisis.affected_radius_km} km
- Population impact: ${crisis.population_impact ?? 'unknown'}

Available resources:
${availableResources.map(r => `- ${r.id}: ${r.type} at ${r.location}`).join('\n')}

Return JSON: {"recommended_unit_ids":["id1","id2"],"total_response_time_minutes":0,"reasoning":"allocation reasoning","confidence":0.0}`;

  const raw = await callGemini('ResourceAllocationAgent', 'OPTIMIZE', prompt);
  const parsed = JSON.parse(raw);
  const selectedIds: string[] = parsed.recommended_unit_ids ?? [];
  const selected = availableResources.filter(r => selectedIds.includes(r.id)).slice(0, 6);
  if (selected.length === 0 && availableResources.length > 0) {
    selected.push(...availableResources.slice(0, 3));
    logWarn('RESOURCE_ALLOCATION', 'ResourceAllocationAgent', 'OPTIMIZE',
      'Gemini unit IDs not matched in available pool — using top-3 fallback');
  }
  const plan: AllocationPlan = {
    crisis_id: crisis.id,
    units: selected.map(u => ({ ...u, status: 'dispatched', assigned_crisis_id: crisis.id })),
    total_response_time_minutes: parsed.total_response_time_minutes ?? 15,
    reasoning: parsed.reasoning ?? 'Default allocation',
    confidence: parsed.confidence ?? 0.7,
    timestamp: new Date().toISOString(),
  };
  logSuccess('RESOURCE_ALLOCATION', 'ResourceAllocationAgent', 'OPTIMIZE',
    `Dispatching ${plan.units.length} units → ETA ${plan.total_response_time_minutes}min (conf: ${plan.confidence.toFixed(2)})`, {
    confidence: plan.confidence,
    details: { unitsDispatched: plan.units.length, unitTypes: plan.units.map(u => u.type), eta: plan.total_response_time_minutes },
  });
  return plan;
}

// ── Simulation Engine ────────────────────────────────────────
export async function simulateOutcome(crisis: CrisisEvent, plan: AllocationPlan): Promise<SimulationResult> {
  logInfo('SIMULATION', 'SimulationAgent', 'SIMULATE',
    `Running pre-execution simulation for ${crisis.type} at ${crisis.location}`, {
    details: { crisisId: crisis.id, planUnits: plan.units.length, eta: plan.total_response_time_minutes },
  });
  const prompt = `Simulate the outcome of this emergency response plan. Return JSON only.

Crisis: ${crisis.type} at ${crisis.location}, severity: ${crisis.severity}
Plan: ${plan.reasoning}
Units: ${plan.units.map(u => u.type).join(', ')}
Response time: ${plan.total_response_time_minutes} min

Return JSON: {"scenario":"outcome description","best_action_plan":"actions","risk_tradeoffs":["t1"],"secondary_impacts":["i1"],"estimated_lives_saved":null,"estimated_response_time":0,"confidence":0.0,"reasoning":"reasoning","alternatives":[{"plan":"alt","pros":["p"],"cons":["c"]}]}`;

  const raw = await callGemini('SimulationAgent', 'SIMULATE', prompt);
  const parsed = JSON.parse(raw);
  const result: SimulationResult = {
    crisis_id: crisis.id,
    scenario: parsed.scenario ?? 'Standard response',
    best_action_plan: parsed.best_action_plan ?? plan.reasoning,
    risk_tradeoffs: parsed.risk_tradeoffs ?? [],
    secondary_impacts: parsed.secondary_impacts ?? [],
    estimated_lives_saved: parsed.estimated_lives_saved,
    estimated_response_time: parsed.estimated_response_time ?? plan.total_response_time_minutes,
    confidence: parsed.confidence ?? 0.75,
    reasoning: parsed.reasoning ?? '',
    alternatives: parsed.alternatives ?? [],
  };
  logSuccess('SIMULATION', 'SimulationAgent', 'SIMULATE',
    `Simulation done: ${result.alternatives.length} alts, ${result.estimated_lives_saved ?? 'N/A'} lives protected, ETA ${result.estimated_response_time}min`, {
    confidence: result.confidence,
    details: { alternatives: result.alternatives.length, livesSaved: result.estimated_lives_saved, responseTime: result.estimated_response_time },
  });
  return result;
}

// ── Notification Message Generator ──────────────────────────
export async function generateNotificationMessages(crisis: CrisisEvent): Promise<Array<{channel: string; title: string; message: string}>> {
  logInfo('NOTIFICATION', 'NotificationAgent', 'GENERATE_ALERTS',
    `Generating ${crisis.severity} alerts for ${crisis.type} at ${crisis.location}`);
  const prompt = `Generate emergency notifications for different channels. Return JSON array only.

Crisis: ${crisis.type} at ${crisis.location}
Severity: ${crisis.severity}
Description: ${crisis.description}
Affected radius: ${crisis.affected_radius_km} km

Return JSON array: [{"channel":"public","title":"title","message":"message"},{"channel":"emergency_services","title":"title","message":"message"},{"channel":"hospitals","title":"title","message":"message"},{"channel":"utilities","title":"title","message":"message"}]`;

  const raw = await callGemini('NotificationAgent', 'GENERATE_ALERTS', prompt);
  const messages = JSON.parse(raw);
  logSuccess('NOTIFICATION', 'NotificationAgent', 'GENERATE_ALERTS',
    `Generated ${messages.length} alerts: ${messages.map((m: {channel:string}) => m.channel).join(', ')}`);
  return messages;
}

// ── Decision Log Builder ─────────────────────────────────────
export function buildDecisionLog(
  engine: string,
  input: string,
  output: string,
  confidence: number,
  reasoningSteps: string[],
  uncertaintyFlags: string[] = []
): AIDecisionLog {
  return {
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    engine,
    input_summary: input.slice(0, 200),
    output_summary: output.slice(0, 200),
    confidence,
    reasoning_steps: reasoningSteps,
    uncertainty_flags: uncertaintyFlags,
  };
}

// ── Signal Summary (for orchestrator) ────────────────────────
export async function summarizeSignals(signals: FusedSignal[]): Promise<string> {
  if (!signals.length) return 'No active signals.';
  const prompt = `Summarize these crisis signals in 2-3 sentences for a city emergency command dashboard:
${signals.map(s => `- ${s.event_type} at ${s.location} (${s.urgency_level}, confidence: ${s.confidence_score})`).join('\n')}
Return a plain text summary string (no JSON).`;
  try {
    const ai = getGenAI();
    const model = ai.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch {
    return `${signals.length} active signals across ${[...new Set(signals.map(s => s.location))].join(', ')}.`;
  }
}

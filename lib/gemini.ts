// ============================================================
// CIRO — Dynamic AI Engine (Gemini & OpenRouter)
// Multi-agent crisis intelligence powered by Google AI & DeepSeek
// ============================================================

import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';
import type {
  FusedSignal, CrisisEvent, CrisisType, SeverityLevel,
  SimulationResult, AIDecisionLog, ResourceUnit, AllocationPlan, Notification
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

// ── Token Bucket Rate Limiter ────────────────────────────────
// Enforces Gemini's 15 RPM limit while allowing concurrent execution (up to 3 concurrent requests).
class TokenBucketLimiter {
  private tokens: number;
  private maxTokens: number;
  private refillIntervalMs: number;
  private lastRefillTime: number;
  private queue: (() => void)[] = [];

  constructor(maxTokens: number, refillRatePerMin: number) {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.refillIntervalMs = (60 * 1000) / refillRatePerMin;
    this.lastRefillTime = Date.now();
  }

  private refill() {
    const now = Date.now();
    const elapsed = now - this.lastRefillTime;
    if (elapsed > 0) {
      const newTokens = Math.floor(elapsed / this.refillIntervalMs);
      if (newTokens > 0) {
        this.tokens = Math.min(this.maxTokens, this.tokens + newTokens);
        this.lastRefillTime = now - (elapsed % this.refillIntervalMs);
      }
    }
  }

  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens > 0) {
      this.tokens--;
      return;
    }
    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
      this.scheduleRefill();
    });
  }

  private scheduleRefill() {
    const nextRefillIn = this.refillIntervalMs - (Date.now() - this.lastRefillTime);
    setTimeout(() => {
      this.refill();
      while (this.tokens > 0 && this.queue.length > 0) {
        this.tokens--;
        const next = this.queue.shift();
        if (next) next();
      }
      if (this.queue.length > 0) {
        this.scheduleRefill();
      }
    }, Math.max(0, nextRefillIn));
  }
}

// 15 RPM limit on free tier, allow burst of 3 concurrent requests
const limiter = new TokenBucketLimiter(3, 15);

// Main Model Caller with Hybrid Fallback
async function callGemini(agent: string, action: string, prompt: string, systemInstruction?: string, retryCount = 0): Promise<string> {
  const preferOpenRouter = process.env.PREFER_OPENROUTER === 'true';
  const hasGemini = !!process.env.GEMINI_API_KEY;
  const hasOpenRouter = !!(process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY !== 'your_openrouter_key_here');

  // Route request to primary service based on preference/availability
  if (preferOpenRouter && hasOpenRouter) {
    try {
      return await callOpenRouter(agent, action, prompt, systemInstruction);
    } catch (err) {
      logWarn('API_CALL', agent, action, `Primary OpenRouter failed. Trying fallback native Gemini...`);
      if (hasGemini) {
        return callNativeGemini(agent, action, prompt, systemInstruction, retryCount);
      }
      throw err;
    }
  } else {
    try {
      return await callNativeGemini(agent, action, prompt, systemInstruction, retryCount);
    } catch (err: any) {
      logWarn('API_CALL', agent, action, `Primary Gemini failed. Trying fallback OpenRouter...`);
      if (hasOpenRouter) {
        try {
          return await callOpenRouter(agent, action, prompt, systemInstruction);
        } catch (orErr) {
          logError('API_CALL', agent, action, `Fallback OpenRouter also failed: ${orErr}`);
        }
      }
      throw err;
    }
  }
}

// Native Google Gemini Implementation
async function callNativeGemini(agent: string, action: string, prompt: string, systemInstruction?: string, retryCount = 0): Promise<string> {
  await limiter.acquire();
  const apiStart = Date.now();
  const promptPreview = prompt.trim().slice(0, 120).replace(/\n/g, ' ');

  logInfo('API_CALL', agent, action, `→ Gemini 2.5 Flash: "${promptPreview}..."`, {
    requestPayload: { model: 'gemini-2.5-flash', fullPrompt: prompt },
  });

  try {
    const ai = getGenAI();
    const model = ai.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: systemInstruction || 'You are CIRO, an AI crisis analyst. You MUST NOT explain your reasoning. You MUST NOT use chain of thought. Output ONLY the final valid JSON object. Do not output anything before the JSON.',
      generationConfig: {
        responseMimeType: 'application/json',
      }
    });

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    
    // Robust JSON extraction
    let clean = text.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
    const firstBrace = clean.indexOf('{');
    const firstBracket = clean.indexOf('[');
    let startIndex = -1;
    let isArray = false;
    
    if (firstBrace !== -1 && firstBracket !== -1) {
      startIndex = Math.min(firstBrace, firstBracket);
      isArray = startIndex === firstBracket;
    } else if (firstBrace !== -1) {
      startIndex = firstBrace;
    } else if (firstBracket !== -1) {
      startIndex = firstBracket;
      isArray = true;
    }
    
    if (startIndex !== -1) {
      const endChar = isArray ? ']' : '}';
      const endIndex = clean.lastIndexOf(endChar);
      if (endIndex !== -1 && endIndex > startIndex) {
        clean = clean.substring(startIndex, endIndex + 1);
      }
    }

    const ms = Date.now() - apiStart;
    logSuccess('API_CALL', agent, action, `← Gemini responded in ${ms}ms (${clean.length} chars)`, {
      durationMs: ms,
      responsePayload: { rawOutput: text, extractedJson: clean },
    });
    return clean;
  } catch (err: any) {
    const ms = Date.now() - apiStart;
    const isRateLimit = err.message?.includes('429') || err.status === 429 || String(err).includes('429');
    
    if (isRateLimit && retryCount < 3) {
      const backoff = (retryCount + 1) * 5000 + Math.random() * 2000; // 5s, 10s, 15s backoff
      logWarn('API_CALL', agent, action, `Rate limited (429) on Gemini. Retrying in ${(backoff/1000).toFixed(1)}s... (Attempt ${retryCount + 1}/3)`);
      await new Promise(r => setTimeout(r, backoff));
      return callNativeGemini(agent, action, prompt, systemInstruction, retryCount + 1);
    }

    logError('API_CALL', agent, action, `✗ Gemini call failed after ${ms}ms: ${err}`, {
      durationMs: ms,
      errorMessage: String(err),
    });
    throw err;
  }
}

// OpenRouter API Implementation
async function callOpenRouter(agent: string, action: string, prompt: string, systemInstruction?: string): Promise<string> {
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  if (!openrouterKey || openrouterKey === 'your_openrouter_key_here') {
    throw new Error('OpenRouter key not configured');
  }
  const openrouterModel = process.env.OPENROUTER_MODEL || 'deepseek/deepseek-v4-flash:free';
  const apiStart = Date.now();
  const promptPreview = prompt.trim().slice(0, 120).replace(/\n/g, ' ');

  logInfo('API_CALL', agent, action, `→ OpenRouter (${openrouterModel}): "${promptPreview}..."`, {
    requestPayload: { model: openrouterModel, fullPrompt: prompt },
  });

  const response = await axios.post(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      model: openrouterModel,
      messages: [
        {
          role: 'system',
          content: systemInstruction || 'You are CIRO, an AI crisis analyst. You MUST NOT explain your reasoning. You MUST NOT use chain of thought. Output ONLY the final valid JSON object. Do not output anything before the JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' }
    },
    {
      headers: {
        'Authorization': `Bearer ${openrouterKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://ciro.emergency',
        'X-Title': 'CIRO Crisis Command Center'
      },
      timeout: 45000
    }
  );

  const text = response.data.choices?.[0]?.message?.content?.trim() || '';

  // Robust JSON extraction
  let clean = text.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
  const firstBrace = clean.indexOf('{');
  const firstBracket = clean.indexOf('[');
  let startIndex = -1;
  let isArray = false;
  
  if (firstBrace !== -1 && firstBracket !== -1) {
    startIndex = Math.min(firstBrace, firstBracket);
    isArray = startIndex === firstBracket;
  } else if (firstBrace !== -1) {
    startIndex = firstBrace;
  } else if (firstBracket !== -1) {
    startIndex = firstBracket;
    isArray = true;
  }
  
  if (startIndex !== -1) {
    const endChar = isArray ? ']' : '}';
    const endIndex = clean.lastIndexOf(endChar);
    if (endIndex !== -1 && endIndex > startIndex) {
      clean = clean.substring(startIndex, endIndex + 1);
    }
  }

  const ms = Date.now() - apiStart;
  logSuccess('API_CALL', agent, action, `← OpenRouter responded in ${ms}ms (${clean.length} chars)`, {
    durationMs: ms,
    responsePayload: { rawOutput: text, extractedJson: clean },
  });
  return clean;
}

// ── CALL #1: Analysis Brain (Detection + Risk) ──────────────────
export async function analyzeCrisisBrain(signal: FusedSignal): Promise<CrisisEvent> {
  logInfo('CRISIS_ANALYSIS', 'CrisisAnalysisBrain', 'ANALYZE',
    `Analyzing ${signal.event_type} signal at ${signal.location} (conf: ${signal.confidence_score.toFixed(2)})`, {
    confidence: signal.confidence_score,
    details: { event_type: signal.event_type, location: signal.location, urgency: signal.urgency_level },
  });
  
  const prompt = `Analyze this emergency signal and predict its risks. Return a single JSON object.

Signal Details:
- Hint Type: ${signal.event_type}
- Location: ${signal.location}
- Confidence: ${signal.confidence_score}
- Evidence: ${signal.evidence_sources.join(', ')}
- Urgency: ${signal.urgency_level}
- Weather: ${signal.weather_context || 'unknown'}
- Traffic: ${signal.traffic_context || 'unknown'}
${signal.raw_posts?.length ? `- Social posts: ${signal.raw_posts.map(p => p.text).slice(0, 3).join(' | ')}` : ''}

Return JSON with these exact fields:
{
  "type": "${signal.event_type}",
  "severity": "LOW|MEDIUM|HIGH|CRITICAL",
  "confidence": 0.0,
  "affected_radius_km": 0,
  "expected_duration_hours": 0,
  "description": "brief description",
  "spread_probability": 0.0,
  "population_impact": 0,
  "escalation_probability": 0.0,
  "time_to_peak_hours": 0,
  "ai_reasoning": "step-by-step reasoning"
}`;

  const raw = await callGemini('CrisisAnalysisBrain', 'ANALYZE', prompt);
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
    spread_probability: parsed.spread_probability ?? 0.3,
    population_impact: parsed.population_impact ?? 1000,
    escalation_probability: parsed.escalation_probability ?? 0.2,
    time_to_peak_hours: parsed.time_to_peak_hours ?? 2,
    evidence: signal.evidence_sources,
    timestamp: new Date().toISOString(),
    status: 'active',
    ai_reasoning: parsed.ai_reasoning,
  };

  logSuccess('CRISIS_ANALYSIS', 'CrisisAnalysisBrain', 'ANALYZE',
    `Analyzed: ${crisis.type} @ ${crisis.location} → ${crisis.severity} (spread: ${(crisis.spread_probability! * 100).toFixed(0)}%, esc: ${(crisis.escalation_probability! * 100).toFixed(0)}%)`, {
    confidence: crisis.confidence,
    details: { id: crisis.id, severity: crisis.severity, radius: crisis.affected_radius_km },
  });
  return crisis;
}


// ── CALL #2: Response Planner Brain (Alloc + Sim + Notif) ────────
export async function planResponseBrain(
  crisis: CrisisEvent,
  availableResources: ResourceUnit[]
): Promise<{ plan: AllocationPlan, simulation: SimulationResult, notifications: Notification[] }> {
  logInfo('RESPONSE_PLANNER', 'ResponsePlannerBrain', 'PLAN',
    `Planning response for ${crisis.type} at ${crisis.location} — ${availableResources.length} units available`);

  const prompt = `Formulate an emergency response plan, simulate the outcome, and generate alerts. Return JSON only.

Crisis Profile:
- Type: ${crisis.type}
- Severity: ${crisis.severity}
- Location: ${crisis.location}
- Description: ${crisis.description}
- Affected radius: ${crisis.affected_radius_km} km
- Population impact: ${crisis.population_impact ?? 'unknown'}

Available Resources for Dispatch:
${availableResources.map(r => `- [${r.type}] ID: ${r.id} at ${r.location}`).join('\n')}

Return JSON with these exact fields:
{
  "allocation": {
    "recommended_unit_ids": ["id1", "id2"],
    "total_response_time_minutes": 0,
    "allocation_reasoning": "reasoning",
    "confidence": 0.0
  },
  "simulation": {
    "predicted_scenario": "outcome description",
    "risk_tradeoffs": ["t1"],
    "estimated_lives_saved": 0
  },
  "notifications": [
    {"channel": "public", "title": "title", "message": "message"},
    {"channel": "emergency_services", "title": "title", "message": "message"},
    {"channel": "hospitals", "title": "title", "message": "message"},
    {"channel": "utilities", "title": "title", "message": "message"}
  ]
}`;

  const raw = await callGemini('ResponsePlannerBrain', 'PLAN', prompt);
  const parsed = JSON.parse(raw);
  
  // Parse Allocation
  const allocData = parsed.allocation || {};
  const selectedIds: string[] = allocData.recommended_unit_ids ?? [];
  const selected = availableResources.filter(r => selectedIds.includes(r.id)).slice(0, 6);
  if (selected.length === 0 && availableResources.length > 0) {
    selected.push(...availableResources.slice(0, 3));
  }
  const plan: AllocationPlan = {
    crisis_id: crisis.id,
    units: selected.map(u => ({ ...u, status: 'dispatched', assigned_crisis_id: crisis.id })),
    total_response_time_minutes: allocData.total_response_time_minutes ?? 15,
    reasoning: allocData.allocation_reasoning ?? 'Default allocation',
    confidence: allocData.confidence ?? 0.7,
    timestamp: new Date().toISOString(),
  };

  // Parse Simulation
  const simData = parsed.simulation || {};
  const simulation: SimulationResult = {
    crisis_id: crisis.id,
    scenario: simData.predicted_scenario ?? 'Standard response',
    best_action_plan: plan.reasoning,
    risk_tradeoffs: simData.risk_tradeoffs ?? [],
    secondary_impacts: [],
    estimated_lives_saved: simData.estimated_lives_saved ?? null,
    estimated_response_time: plan.total_response_time_minutes,
    confidence: plan.confidence,
    reasoning: '',
    alternatives: [],
  };

  // Parse Notifications
  const notifsData = Array.isArray(parsed.notifications) ? parsed.notifications : [];
  const notifications: Notification[] = notifsData.map((msg: any) => ({
    id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    crisis_id: crisis.id,
    channel: (msg.channel || 'public') as Notification['channel'],
    severity: crisis.severity,
    title: msg.title || 'Emergency Alert',
    message: msg.message || crisis.description,
    location: crisis.location,
    timestamp: new Date().toISOString(),
    sent: true,
  }));

  logSuccess('RESPONSE_PLANNER', 'ResponsePlannerBrain', 'PLAN',
    `Planned: Dispatching ${plan.units.length} units (ETA ${plan.total_response_time_minutes}m) + ${notifications.length} alerts`);

  return { plan, simulation, notifications };
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
    // Switched to gemini-2.5-flash for reliable high-speed inference
    const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch {
    return `${signals.length} active signals across ${[...new Set(signals.map(s => s.location))].join(', ')}.`;
  }
}

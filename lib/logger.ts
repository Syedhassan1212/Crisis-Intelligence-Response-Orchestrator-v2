// ============================================================
// CIRO — Centralized Logger
// Captures all agent decisions, API calls, errors, and events
// ============================================================

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS';

export type LogCategory =
  | 'API_CALL'
  | 'AGENT_DECISION'
  | 'SIGNAL_FUSION'
  | 'CRISIS_DETECTION'
  | 'RISK_PREDICTION'
  | 'RESOURCE_ALLOCATION'
  | 'SIMULATION'
  | 'TRAFFIC_CONTROL'
  | 'NOTIFICATION'
  | 'ORCHESTRATOR'
  | 'DATA_INGESTION'
  | 'SYSTEM';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  agent: string;
  action: string;
  message: string;
  details?: Record<string, unknown>;
  durationMs?: number;
  success: boolean;
  errorMessage?: string;
  requestPayload?: unknown;
  responsePayload?: unknown;
  confidence?: number;
  cycleNumber?: number;
}

// In-memory circular log buffer (last 500 entries)
const MAX_LOGS = 500;
let logs: LogEntry[] = [];
let globalCycle = 0;

export function setGlobalCycle(cycle: number) {
  globalCycle = cycle;
}

export function log(
  level: LogLevel,
  category: LogCategory,
  agent: string,
  action: string,
  message: string,
  extras: Partial<Omit<LogEntry, 'id' | 'timestamp' | 'level' | 'category' | 'agent' | 'action' | 'message'>> = {}
): LogEntry {
  const entry: LogEntry = {
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    level,
    category,
    agent,
    action,
    message,
    success: level !== 'ERROR',
    cycleNumber: globalCycle,
    ...extras,
  };

  logs.unshift(entry); // newest first
  if (logs.length > MAX_LOGS) logs = logs.slice(0, MAX_LOGS);
  return entry;
}

// Convenience helpers
export const logInfo = (cat: LogCategory, agent: string, action: string, msg: string, extras?: Partial<LogEntry>) =>
  log('INFO', cat, agent, action, msg, extras);

export const logSuccess = (cat: LogCategory, agent: string, action: string, msg: string, extras?: Partial<LogEntry>) =>
  log('SUCCESS', cat, agent, action, msg, extras);

export const logWarn = (cat: LogCategory, agent: string, action: string, msg: string, extras?: Partial<LogEntry>) =>
  log('WARN', cat, agent, action, msg, extras);

export const logError = (cat: LogCategory, agent: string, action: string, msg: string, extras?: Partial<LogEntry>) =>
  log('ERROR', cat, agent, action, msg, { ...extras, success: false });

export const logDebug = (cat: LogCategory, agent: string, action: string, msg: string, extras?: Partial<LogEntry>) =>
  log('DEBUG', cat, agent, action, msg, extras);

// Timed API call wrapper
export async function loggedApiCall<T>(
  agent: string,
  action: string,
  url: string,
  callFn: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  logInfo('API_CALL', agent, action, `→ ${url}`, { requestPayload: { url } });
  try {
    const result = await callFn();
    const ms = Date.now() - start;
    logSuccess('API_CALL', agent, action, `← ${url} (${ms}ms)`, {
      durationMs: ms,
      responsePayload: typeof result === 'object' ? { preview: JSON.stringify(result).slice(0, 200) } : result,
    });
    return result;
  } catch (err: unknown) {
    const ms = Date.now() - start;
    logError('API_CALL', agent, action, `✗ ${url} — ${String(err)}`, {
      durationMs: ms,
      errorMessage: String(err),
    });
    throw err;
  }
}

export function getLogs(filters?: {
  level?: LogLevel;
  category?: LogCategory;
  agent?: string;
  search?: string;
  limit?: number;
  cycleNumber?: number;
}): LogEntry[] {
  let result = [...logs];

  if (filters?.level) result = result.filter(l => l.level === filters.level);
  if (filters?.category) result = result.filter(l => l.category === filters.category);
  if (filters?.agent) result = result.filter(l => l.agent.toLowerCase().includes(filters.agent!.toLowerCase()));
  if (filters?.cycleNumber !== undefined) result = result.filter(l => l.cycleNumber === filters.cycleNumber);
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(l =>
      l.message.toLowerCase().includes(q) ||
      l.action.toLowerCase().includes(q) ||
      l.agent.toLowerCase().includes(q) ||
      l.category.toLowerCase().includes(q)
    );
  }
  return result.slice(0, filters?.limit || 200);
}

export function clearLogs() {
  logs = [];
}

export function getLogStats() {
  const total = logs.length;
  const byLevel: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  const byAgent: Record<string, number> = {};
  let errorCount = 0;
  let apiCallCount = 0;
  let avgDuration = 0;
  let durationSamples = 0;

  for (const l of logs) {
    byLevel[l.level] = (byLevel[l.level] || 0) + 1;
    byCategory[l.category] = (byCategory[l.category] || 0) + 1;
    byAgent[l.agent] = (byAgent[l.agent] || 0) + 1;
    if (l.level === 'ERROR') errorCount++;
    if (l.category === 'API_CALL') apiCallCount++;
    if (l.durationMs) { avgDuration += l.durationMs; durationSamples++; }
  }

  return {
    total,
    errorCount,
    apiCallCount,
    avgDurationMs: durationSamples ? Math.round(avgDuration / durationSamples) : 0,
    byLevel,
    byCategory,
    byAgent,
    oldestEntry: logs[logs.length - 1]?.timestamp,
    newestEntry: logs[0]?.timestamp,
    currentCycle: globalCycle,
  };
}

// ============================================================
// CIRO — Supabase Client + Persistence Layer
// Persists logs, crises, allocations, notifications & cycles
// ============================================================

import { createClient } from '@supabase/supabase-js';
import type { LogEntry } from './logger';
import type { CrisisEvent, AllocationPlan, Notification } from './types';

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Lazy singleton
let _client: ReturnType<typeof createClient> | null = null;
export function getSupabase(): any {
  if (!_client) _client = createClient(supabaseUrl, supabaseKey);
  return _client;
}

// ── Check if Supabase is configured ─────────────────────────
export function isSupabaseEnabled() {
  return !!(supabaseUrl && supabaseKey &&
    supabaseUrl !== 'your_supabase_url' &&
    !supabaseUrl.includes('placeholder'));
}

// ── Persist a batch of log entries ──────────────────────────
export async function persistLogs(logs: LogEntry[]): Promise<void> {
  if (!isSupabaseEnabled() || logs.length === 0) return;
  try {
    const rows = logs.map(l => ({
      id:               l.id,
      timestamp:        l.timestamp,
      level:            l.level,
      category:         l.category,
      agent:            l.agent,
      action:           l.action,
      message:          l.message,
      success:          l.success,
      duration_ms:      l.durationMs ?? null,
      confidence:       l.confidence ?? null,
      cycle_number:     l.cycleNumber ?? null,
      request_payload:  l.requestPayload ?? null,
      response_payload: l.responsePayload ?? null,
      details:          l.details ?? null,
      error_message:    l.errorMessage ?? null,
    }));
    const { error } = await getSupabase()
      .from('ciro_logs')
      .upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
    if (error) console.warn('[Supabase] Log persist error:', error.message);
  } catch (e) {
    console.warn('[Supabase] persistLogs failed:', e);
  }
}

// ── Persist crisis events ─────────────────────────────────
export async function persistCrises(crises: CrisisEvent[], cycle: number): Promise<void> {
  if (!isSupabaseEnabled() || crises.length === 0) return;
  try {
    const rows = crises.map(c => ({
      id:                     c.id,
      cycle_number:           cycle,
      type:                   c.type,
      severity:               c.severity,
      confidence:             c.confidence,
      location:               c.location,
      lat:                    c.lat ?? null,
      lng:                    c.lng ?? null,
      affected_radius_km:     c.affected_radius_km,
      expected_duration_hours: c.expected_duration_hours,
      description:            c.description,
      evidence:               c.evidence,
      status:                 c.status,
      spread_probability:     c.spread_probability ?? null,
      population_impact:      c.population_impact ?? null,
      escalation_probability: c.escalation_probability ?? null,
      time_to_peak_hours:     c.time_to_peak_hours ?? null,
      ai_reasoning:           c.ai_reasoning ?? null,
      updated_at:             new Date().toISOString(),
    }));
    const { error } = await getSupabase()
      .from('ciro_crises')
      .upsert(rows, { onConflict: 'id' });
    if (error) console.warn('[Supabase] Crisis persist error:', error.message);
  } catch (e) {
    console.warn('[Supabase] persistCrises failed:', e);
  }
}

// ── Persist allocations ──────────────────────────────────────
export async function persistAllocations(allocs: AllocationPlan[], cycle: number): Promise<void> {
  if (!isSupabaseEnabled() || allocs.length === 0) return;
  try {
    const rows = allocs.map(a => ({
      crisis_id:              a.crisis_id,
      cycle_number:           cycle,
      units:                  a.units,
      response_time_minutes:  a.total_response_time_minutes,
      reasoning:              a.reasoning,
      confidence:             a.confidence,
    }));
    const { error } = await getSupabase().from('ciro_allocations').insert(rows);
    if (error) console.warn('[Supabase] Allocation persist error:', error.message);
  } catch (e) {
    console.warn('[Supabase] persistAllocations failed:', e);
  }
}

// ── Persist notifications ────────────────────────────────────
export async function persistNotifications(notifs: Notification[]): Promise<void> {
  if (!isSupabaseEnabled() || notifs.length === 0) return;
  try {
    const rows = notifs.map(n => ({
      id:        n.id,
      crisis_id: n.crisis_id,
      channel:   n.channel,
      severity:  n.severity,
      title:     n.title,
      message:   n.message,
      location:  n.location,
      sent:      n.sent,
    }));
    const { error } = await getSupabase()
      .from('ciro_notifications')
      .upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
    if (error) console.warn('[Supabase] Notification persist error:', error.message);
  } catch (e) {
    console.warn('[Supabase] persistNotifications failed:', e);
  }
}

// ── Persist cycle record ──────────────────────────────────────
export async function persistCycle(opts: {
  cycleNumber: number; startedAt: string; completedAt: string;
  durationMs: number; status: string; activeCrises: number;
  totalSignals: number; totalAlerts: number;
}): Promise<void> {
  if (!isSupabaseEnabled()) return;
  try {
    const { error } = await getSupabase().from('ciro_cycles').upsert({
      cycle_number:  opts.cycleNumber,
      started_at:    opts.startedAt,
      completed_at:  opts.completedAt,
      duration_ms:   opts.durationMs,
      status:        opts.status,
      active_crises: opts.activeCrises,
      total_signals: opts.totalSignals,
      total_alerts:  opts.totalAlerts,
    }, { onConflict: 'cycle_number' });
    if (error) console.warn('[Supabase] Cycle persist error:', error.message);
  } catch (e) {
    console.warn('[Supabase] persistCycle failed:', e);
  }
}

// ── Query: fetch historical logs ──────────────────────────────
export async function fetchHistoricalLogs(opts: {
  limit?: number; level?: string; agent?: string; category?: string; search?: string; cycleNumber?: number;
}) {
  if (!isSupabaseEnabled()) return [];
  try {
    let q = getSupabase()
      .from('ciro_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(opts.limit || 500);
    if (opts.level)       q = q.eq('level', opts.level);
    if (opts.agent)       q = q.ilike('agent', `%${opts.agent}%`);
    if (opts.category)    q = q.eq('category', opts.category);
    if (opts.cycleNumber) q = q.eq('cycle_number', opts.cycleNumber);
    if (opts.search)      q = q.or(`message.ilike.%${opts.search}%,action.ilike.%${opts.search}%`);
    const { data, error } = await q;
    if (error) { console.warn('[Supabase] fetchLogs error:', error.message); return []; }
    return data || [];
  } catch { return []; }
}

// ── Query: historical crises ──────────────────────────────────
export async function fetchHistoricalCrises(limit = 100) {
  if (!isSupabaseEnabled()) return [];
  try {
    const { data, error } = await getSupabase()
      .from('ciro_crises')
      .select('*')
      .order('detected_at', { ascending: false })
      .limit(limit);
    if (error) return [];
    return data || [];
  } catch { return []; }
}

// ── Query: cycle history ──────────────────────────────────────
export async function fetchCycleHistory(limit = 50) {
  if (!isSupabaseEnabled()) return [];
  try {
    const { data, error } = await getSupabase()
      .from('ciro_cycles')
      .select('*')
      .order('cycle_number', { ascending: false })
      .limit(limit);
    if (error) return [];
    return data || [];
  } catch { return []; }
}

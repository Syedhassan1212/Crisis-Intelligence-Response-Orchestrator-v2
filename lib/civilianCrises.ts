import type { CrisisEvent, CrisisType, Notification, OrchestratorState, SeverityLevel } from './types';

/** True when crisis came from mobile / web-mobile citizen app */
export function isCivilianEvidence(evidence: unknown): boolean {
  if (evidence == null) return false;
  const tags = Array.isArray(evidence)
    ? evidence
    : typeof evidence === 'string'
      ? [evidence]
      : [];
  return tags.some(
    (t) =>
      String(t).includes('civilian_sos_app') ||
      String(t).includes('civilian_mobile_report')
  );
}

export function rowToCrisisEvent(c: Record<string, unknown>): CrisisEvent {
  const evidence = Array.isArray(c.evidence)
    ? (c.evidence as unknown[]).map(String)
    : isCivilianEvidence(c.evidence)
      ? [String(c.evidence)]
      : ['civilian_sos_app'];

  return {
    id: String(c.id),
    type: (c.type as CrisisType) || 'unknown',
    severity: (c.severity as SeverityLevel) || 'CRITICAL',
    location: String(c.location || 'Emergency Beacon Lock'),
    lat: Number(c.lat) || 24.8607,
    lng: Number(c.lng) || 67.0104,
    description: String(
      c.description || 'IMMEDIATE SOS DISTRESS CALL! Citizen triggered 1-Tap emergency beacon.'
    ),
    status: (c.status as CrisisEvent['status']) || 'active',
    confidence: Number(c.confidence ?? 0.99),
    affected_radius_km: Number(c.affected_radius_km ?? 1.5),
    expected_duration_hours: Number(c.expected_duration_hours ?? 3),
    evidence,
    timestamp: String(c.detected_at || c.timestamp || new Date().toISOString()),
  };
}

export function buildCivilianNotification(crisis: CrisisEvent, isSos: boolean): Notification {
  return {
    id: `notif_${Date.now()}_${crisis.id}`,
    crisis_id: crisis.id,
    channel: 'public',
    severity: crisis.severity,
    title: isSos
      ? `🚨 EMERGENCY SOS BEACON: ${crisis.location.toUpperCase()}`
      : `🚨 EMERGENCY BEACON: ${crisis.location.toUpperCase()}`,
    message: crisis.description,
    location: crisis.location,
    timestamp: new Date().toISOString(),
    sent: true,
  };
}

/** Merge one Supabase row into dashboard state (works even when prev is null). */
export function mergeCivilianCrisis(
  prev: OrchestratorState | null,
  row: Record<string, unknown>
): OrchestratorState | null {
  if (!isCivilianEvidence(row.evidence)) return prev;

  const crisis = rowToCrisisEvent(row);
  const isSos = crisis.evidence.some((e) => e.includes('civilian_sos_app'));

  if (!prev) {
    return {
      cycle: 0,
      lastUpdated: new Date().toISOString(),
      crises: [crisis],
      signals: [],
      resources: [],
      allocations: [],
      trafficActions: [],
      simulations: [],
      notifications: [buildCivilianNotification(crisis, isSos)],
      decisionLogs: [],
      systemStatus: 'critical',
    };
  }

  if (prev.crises.some((c) => c.id === crisis.id)) return prev;

  return {
    ...prev,
    systemStatus: isSos ? 'critical' : prev.systemStatus,
    crises: [crisis, ...prev.crises].slice(0, 20),
    notifications: [buildCivilianNotification(crisis, isSos), ...prev.notifications].slice(0, 50),
  };
}

export function mergeCivilianCrises(
  prev: OrchestratorState | null,
  rows: Record<string, unknown>[]
): OrchestratorState | null {
  let next = prev;
  for (const row of rows) {
    next = mergeCivilianCrisis(next, row);
  }
  return next;
}

export function playDistressAlert(): void {
  try {
    const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.5);
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.6);
  } catch {
    /* ignore */
  }
}

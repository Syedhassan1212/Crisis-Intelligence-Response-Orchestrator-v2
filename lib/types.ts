// ============================================================
// CIRO — Crisis Intelligence & Response Orchestrator
// Core Type Definitions
// ============================================================

export type CrisisType =
  | 'flood'
  | 'heatwave'
  | 'accident'
  | 'fire'
  | 'power_outage'
  | 'protest'
  | 'infrastructure_failure'
  | 'robbery'
  | 'unknown';

export type SeverityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type RoadState = 'OPEN' | 'CONGESTED' | 'BLOCKED';
export type ResourceType = 'ambulance' | 'police' | 'rescue' | 'fire_unit' | 'utility';

// Raw social media post
export interface SocialPost {
  id: string;
  username: string;
  timestamp: string;
  location: string;
  incident_type: string;
  text: string;
  likes: number;
  retweets: number;
}

// Weather data from Google Weather API
export interface WeatherData {
  location: string;
  temperature: number;
  condition: string;
  humidity: number;
  windSpeed: number;
  rainfall: number;
  forecast: string;
  heatIndex?: number;
  fetchedAt: string;
}

// Traffic/route data from Google Maps
export interface TrafficData {
  area: string;
  congestionLevel: number; // 0-1
  incidentsReported: number;
  roadState: RoadState;
  updatedAt: string;
}

// Fused signal from all sources
export interface FusedSignal {
  event_type: CrisisType;
  location: string;
  lat?: number;
  lng?: number;
  confidence_score: number;
  evidence_sources: string[];
  urgency_level: SeverityLevel;
  raw_posts?: SocialPost[];
  weather_context?: string;
  traffic_context?: string;
  timestamp: string;
}

// Classified crisis event
export interface CrisisEvent {
  id: string;
  type: CrisisType;
  severity: SeverityLevel;
  confidence: number;
  location: string;
  lat?: number;
  lng?: number;
  affected_radius_km: number;
  expected_duration_hours: number;
  description: string;
  evidence: string[];
  timestamp: string;
  status: 'active' | 'monitoring' | 'resolved';
  // Risk prediction fields
  spread_probability?: number;
  population_impact?: number;
  escalation_probability?: number;
  time_to_peak_hours?: number;
  ai_reasoning?: string;
}

// Resource unit
export interface ResourceUnit {
  id: string;
  type: ResourceType;
  status: 'available' | 'dispatched' | 'en_route' | 'on_scene';
  location: string;
  lat?: number;
  lng?: number;
  assigned_crisis_id?: string;
  eta_minutes?: number;
}

// Resource allocation plan
export interface AllocationPlan {
  crisis_id: string;
  units: ResourceUnit[];
  total_response_time_minutes: number;
  reasoning: string;
  confidence: number;
  timestamp: string;
}

// Traffic control action
export interface TrafficAction {
  area: string;
  road: string;
  action: 'block' | 'reroute' | 'clear';
  new_state: RoadState;
  reason: string;
  alternative_route?: string;
}

// Simulation result
export interface SimulationResult {
  crisis_id: string;
  scenario: string;
  best_action_plan: string;
  risk_tradeoffs: string[];
  secondary_impacts: string[];
  estimated_lives_saved?: number;
  estimated_response_time: number;
  confidence: number;
  reasoning: string;
  alternatives: Array<{
    plan: string;
    pros: string[];
    cons: string[];
  }>;
}

// Notification
export interface Notification {
  id: string;
  crisis_id: string;
  channel: 'public' | 'emergency_services' | 'hospitals' | 'utilities';
  severity: SeverityLevel;
  title: string;
  message: string;
  location: string;
  timestamp: string;
  sent: boolean;
}

// AI decision log entry
export interface AIDecisionLog {
  id: string;
  timestamp: string;
  engine: string;
  input_summary: string;
  output_summary: string;
  confidence: number;
  reasoning_steps: string[];
  uncertainty_flags: string[];
}

// Complete orchestrator state
export interface OrchestratorState {
  cycle: number;
  lastUpdated: string;
  crises: CrisisEvent[];
  signals: FusedSignal[];
  resources: ResourceUnit[];
  allocations: AllocationPlan[];
  trafficActions: TrafficAction[];
  simulations: SimulationResult[];
  notifications: Notification[];
  decisionLogs: AIDecisionLog[];
  weatherData?: WeatherData;
  systemStatus: 'idle' | 'processing' | 'alert' | 'critical';
}

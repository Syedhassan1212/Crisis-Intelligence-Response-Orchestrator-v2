// ============================================================
// CIRO — Data Ingestion Layer
// Fetches from Social Media API, Google Weather, Google Maps
// ============================================================

import axios from 'axios';
import type { SocialPost, WeatherData, TrafficData, FusedSignal, CrisisType, SeverityLevel } from './types';
import { logInfo, logSuccess, logWarn, logError, loggedApiCall } from './logger';

// ── Karachi location coordinates ────────────────────────────
export const KARACHI_LOCATIONS: Record<string, { lat: number; lng: number }> = {
  'Saddar': { lat: 24.8607, lng: 67.0104 },
  'Clifton': { lat: 24.8116, lng: 67.0295 },
  'DHA': { lat: 24.7921, lng: 67.0611 },
  'Gulshan-e-Iqbal': { lat: 24.9213, lng: 67.0944 },
  'North Nazimabad': { lat: 24.9480, lng: 67.0433 },
  'Korangi': { lat: 24.8282, lng: 67.1267 },
  'Lyari': { lat: 24.8611, lng: 66.9928 },
  'Malir': { lat: 24.8915, lng: 67.2019 },
  'Tariq Road': { lat: 24.8672, lng: 67.0529 },
  'Shahrah-e-Faisal': { lat: 24.8714, lng: 67.0572 },
  'NIPA': { lat: 24.9195, lng: 67.0811 },
  'Johar Mor': { lat: 24.9099, lng: 67.0851 },
  'Defence View': { lat: 24.8500, lng: 67.0600 },
  'Seaview': { lat: 24.7988, lng: 67.0298 },
  'Burns Road': { lat: 24.8633, lng: 67.0194 },
  'Orangi Town': { lat: 24.9421, lng: 66.9936 },
  'Keamari': { lat: 24.8116, lng: 66.9838 },
  'Baldia Town': { lat: 24.8978, lng: 67.0015 },
  'Site Area': { lat: 24.8907, lng: 67.0198 },
  'default': { lat: 24.8607, lng: 67.0011 },
};

export function getCoords(location: string): { lat: number; lng: number } {
  for (const [key, coords] of Object.entries(KARACHI_LOCATIONS)) {
    if (location.toLowerCase().includes(key.toLowerCase())) return coords;
  }
  return KARACHI_LOCATIONS['default'];
}

// ── Social Media Ingestion ───────────────────────────────────
export async function fetchSocialPosts(count: number = 15): Promise<SocialPost[]> {
  const url = `${process.env.NEXT_PUBLIC_SOCIAL_API || 'https://social-media-post-cquv.onrender.com'}/api/posts?count=${count}`;
  const start = Date.now();
  logInfo('API_CALL', 'SocialIngestionAgent', 'FETCH_POSTS', `Requesting ${count} posts from social API`, { requestPayload: { url, count } });
  try {
    const res = await axios.get(url, { timeout: 10000 });
    if (res.data?.success && Array.isArray(res.data.data)) {
      const posts = res.data.data as SocialPost[];
      logSuccess('API_CALL', 'SocialIngestionAgent', 'FETCH_POSTS', `Received ${posts.length} posts (${Date.now()-start}ms)`, {
        durationMs: Date.now() - start,
        responsePayload: { count: posts.length, sample: posts[0]?.text?.slice(0, 80) },
      });
      return posts;
    }
    logWarn('API_CALL', 'SocialIngestionAgent', 'FETCH_POSTS', 'API returned empty or invalid data, using mock', { durationMs: Date.now() - start });
    return generateMockSocialPosts(count);
  } catch (err) {
    logError('API_CALL', 'SocialIngestionAgent', 'FETCH_POSTS', `Social API failed: ${err} — falling back to mock data`, {
      durationMs: Date.now() - start,
      errorMessage: String(err),
    });
    const mocks = generateMockSocialPosts(count);
    logInfo('DATA_INGESTION', 'SocialIngestionAgent', 'MOCK_FALLBACK', `Generated ${mocks.length} mock social posts`);
    return mocks;
  }
}

function generateMockSocialPosts(count: number): SocialPost[] {
  const mockPosts: SocialPost[] = [];
  const locations = Object.keys(KARACHI_LOCATIONS).filter(l => l !== 'default');
  const types = ['fire', 'accident', 'power_outage', 'flood', 'robbery', 'protest'];
  const texts = [
    'Huge fire spotted in {location}! Black smoke everywhere.',
    'Terrible accident on main road near {location}. Ambulance needed.',
    'No electricity for 6 hours in {location}. K-Electric please help!',
    'Water logging at {location} after heavy rain. Roads blocked.',
    'Armed robbery reported near {location}. Police needed urgently.',
    'Large protest blocking {location} roads. Avoid the area.',
  ];
  for (let i = 0; i < count; i++) {
    const loc = locations[Math.floor(Math.random() * locations.length)];
    const typeIdx = Math.floor(Math.random() * types.length);
    mockPosts.push({
      id: `mock_${i}_${Date.now()}`,
      username: `citizen_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date(Date.now() - Math.random() * 3600000).toISOString(),
      location: loc,
      incident_type: types[typeIdx],
      text: texts[typeIdx].replace('{location}', loc),
      likes: Math.floor(Math.random() * 100),
      retweets: Math.floor(Math.random() * 50),
    });
  }
  return mockPosts;
}

// ── Weather Data Ingestion ───────────────────────────────────
export async function fetchWeatherData(): Promise<WeatherData> {
  const start = Date.now();
  logInfo('API_CALL', 'WeatherIngestionAgent', 'FETCH_WEATHER', 'Requesting Karachi weather conditions', { requestPayload: { lat: 24.8607, lng: 67.0011 } });
  try {
    const apiKey = process.env.GOOGLE_WEATHER_API_KEY;
    if (apiKey) {
      const res = await axios.get(
        `https://weather.googleapis.com/v1/currentConditions:lookup?key=${apiKey}&location.latitude=24.8607&location.longitude=67.0011`,
        { timeout: 8000 }
      );
      const d = res.data;
      const weather: WeatherData = {
        location: 'Karachi',
        temperature: d.temperature?.degrees ?? 35,
        condition: d.weatherCondition?.description?.text ?? 'Partly Cloudy',
        humidity: d.relativeHumidity ?? 70,
        windSpeed: d.wind?.speed?.value ?? 15,
        rainfall: d.precipitation?.probability?.percent ?? 0,
        forecast: d.weatherCondition?.description?.text ?? 'Clear',
        heatIndex: d.heatIndex?.degrees,
        fetchedAt: new Date().toISOString(),
      };
      logSuccess('API_CALL', 'WeatherIngestionAgent', 'FETCH_WEATHER', `Live weather: ${weather.temperature.toFixed(1)}°C, ${weather.condition} (${Date.now()-start}ms)`, {
        durationMs: Date.now() - start,
        responsePayload: { temperature: weather.temperature, condition: weather.condition, humidity: weather.humidity },
      });
      return weather;
    }
    throw new Error('No weather API key configured');
  } catch (err: unknown) {
    const ms = Date.now() - start;
    if (String(err).includes('No weather API key')) {
      logWarn('API_CALL', 'WeatherIngestionAgent', 'FETCH_WEATHER', 'No API key — using simulated Karachi weather', { durationMs: ms });
    } else {
      logError('API_CALL', 'WeatherIngestionAgent', 'FETCH_WEATHER', `Google Weather API failed: ${err}`, { durationMs: ms, errorMessage: String(err) });
    }
    const season = new Date().getMonth();
    const isHot = season >= 3 && season <= 9;
    const weather: WeatherData = {
      location: 'Karachi',
      temperature: isHot ? 35 + Math.random() * 10 : 22 + Math.random() * 8,
      condition: Math.random() > 0.7 ? 'Partly Cloudy' : Math.random() > 0.5 ? 'Sunny' : 'Overcast',
      humidity: 60 + Math.random() * 25,
      windSpeed: 10 + Math.random() * 20,
      rainfall: Math.random() > 0.8 ? Math.random() * 40 : 0,
      forecast: 'Mostly clear with isolated showers possible',
      fetchedAt: new Date().toISOString(),
    };
    logInfo('DATA_INGESTION', 'WeatherIngestionAgent', 'MOCK_WEATHER', `Simulated weather: ${weather.temperature.toFixed(1)}°C, ${weather.condition}`, {
      responsePayload: { temperature: weather.temperature, condition: weather.condition },
    });
    return weather;
  }
}

// ── Traffic Data (Google Maps style) ────────────────────────
export async function fetchTrafficData(): Promise<TrafficData[]> {
  const start = Date.now();
  logInfo('API_CALL', 'TrafficIngestionAgent', 'FETCH_TRAFFIC', 'Polling Google Maps traffic conditions for Karachi');
  try {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
    if (!apiKey || apiKey === 'your_google_maps_api_key_here') throw new Error('No Maps API key configured');
    // In production: Routes API / Traffic Layer
    throw new Error('Routes API not yet wired — using simulated traffic');
  } catch (err: unknown) {
    const ms = Date.now() - start;
    logWarn('API_CALL', 'TrafficIngestionAgent', 'FETCH_TRAFFIC', `Maps traffic unavailable (${String(err)}) — generating simulated grid`, { durationMs: ms, errorMessage: String(err) });
    const locations = Object.keys(KARACHI_LOCATIONS).filter(l => l !== 'default');
    const states: Array<'OPEN' | 'CONGESTED' | 'BLOCKED'> = ['OPEN', 'OPEN', 'OPEN', 'CONGESTED', 'CONGESTED', 'BLOCKED'];
    const data = locations.slice(0, 10).map(loc => ({
      area: loc,
      congestionLevel: Math.random(),
      incidentsReported: Math.floor(Math.random() * 3),
      roadState: states[Math.floor(Math.random() * states.length)],
      updatedAt: new Date().toISOString(),
    }));
    const blocked = data.filter(d => d.roadState === 'BLOCKED').length;
    const congested = data.filter(d => d.roadState === 'CONGESTED').length;
    logInfo('DATA_INGESTION', 'TrafficIngestionAgent', 'SIMULATED_TRAFFIC', `Simulated ${data.length} zones: ${blocked} blocked, ${congested} congested`, {
      responsePayload: { zones: data.length, blocked, congested },
    });
    return data;
  }
}

// ── Signal Fusion Engine ─────────────────────────────────────
export function fuseSocialSignals(posts: SocialPost[], weather: WeatherData, traffic: TrafficData[]): FusedSignal[] {
  // Group posts by location + incident type
  const groups: Record<string, SocialPost[]> = {};
  for (const post of posts) {
    const key = `${post.location}::${post.incident_type}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(post);
  }

  const signals: FusedSignal[] = [];

  for (const [key, groupPosts] of Object.entries(groups)) {
    const [location, incident_type] = key.split('::');
    const coords = getCoords(location);

    // Confidence: based on post count, engagement, recency
    const recencyBoost = groupPosts.filter(p => {
      const age = (Date.now() - new Date(p.timestamp).getTime()) / 60000;
      return age < 60;
    }).length / groupPosts.length;
    const engagementScore = groupPosts.reduce((s, p) => s + p.likes + p.retweets * 2, 0) / (groupPosts.length * 150);
    const baseConfidence = Math.min(0.95, 0.35 + groupPosts.length * 0.1 + recencyBoost * 0.2 + engagementScore * 0.15);

    // Urgency from severity keywords
    const urgencyText = groupPosts.map(p => p.text.toLowerCase()).join(' ');
    const criticalKeywords = ['critical', 'death', 'fire', 'explosion', 'flood', 'collapse'];
    const highKeywords = ['urgent', 'emergency', 'major', 'severe', 'accident', 'ambulance'];
    let urgency: SeverityLevel = 'LOW';
    if (criticalKeywords.some(k => urgencyText.includes(k))) urgency = 'CRITICAL';
    else if (highKeywords.some(k => urgencyText.includes(k))) urgency = 'HIGH';
    else if (groupPosts.length >= 3) urgency = 'MEDIUM';

    // Weather boost
    let weatherCtx = `Temp: ${weather.temperature.toFixed(1)}°C`;
    if (weather.rainfall > 20) { weatherCtx += ' Heavy rain'; if (incident_type === 'flood') urgency = 'CRITICAL'; }
    if (weather.temperature > 40) { weatherCtx += ' Extreme heat'; if (incident_type === 'heatwave') urgency = 'CRITICAL'; }

    // Traffic context
    const trafficForArea = traffic.find(t => t.area === location);
    const trafficCtx = trafficForArea ? `Roads: ${trafficForArea.roadState} (congestion: ${(trafficForArea.congestionLevel * 100).toFixed(0)}%)` : 'Traffic: unknown';

    const evidenceSources = ['social_media'];
    if (weather.fetchedAt) evidenceSources.push('weather_api');
    if (trafficForArea) evidenceSources.push('traffic_data');

    signals.push({
      event_type: mapIncidentType(incident_type),
      location,
      lat: coords.lat,
      lng: coords.lng,
      confidence_score: baseConfidence,
      evidence_sources: evidenceSources,
      urgency_level: urgency,
      raw_posts: groupPosts,
      weather_context: weatherCtx,
      traffic_context: trafficCtx,
      timestamp: new Date().toISOString(),
    });
  }

  // Sort by urgency + confidence
  return signals.sort((a, b) => {
    const urgencyRank: Record<SeverityLevel, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    return (urgencyRank[b.urgency_level] - urgencyRank[a.urgency_level]) ||
      (b.confidence_score - a.confidence_score);
  });
}

function mapIncidentType(raw: string): CrisisType {
  const map: Record<string, CrisisType> = {
    fire: 'fire',
    accident: 'accident',
    flood: 'flood',
    power_outage: 'power_outage',
    protest: 'protest',
    robbery: 'robbery',
    heatwave: 'heatwave',
    infrastructure_failure: 'infrastructure_failure',
  };
  return map[raw] || 'unknown';
}

// ── Default Resource Pool ────────────────────────────────────
export function getDefaultResources() {
  const locations = ['Saddar', 'Clifton', 'DHA', 'Gulshan-e-Iqbal', 'Korangi', 'North Nazimabad'];
  const types: Array<{ type: string; count: number }> = [
    { type: 'ambulance', count: 6 },
    { type: 'police', count: 8 },
    { type: 'fire_unit', count: 4 },
    { type: 'rescue', count: 4 },
    { type: 'utility', count: 4 },
  ];
  const resources = [];
  let idx = 0;
  for (const { type, count } of types) {
    for (let i = 0; i < count; i++) {
      const loc = locations[idx % locations.length];
      const coords = getCoords(loc);
      resources.push({
        id: `${type}_${i + 1}`,
        type,
        status: 'available',
        location: loc,
        lat: coords.lat + (Math.random() - 0.5) * 0.02,
        lng: coords.lng + (Math.random() - 0.5) * 0.02,
      });
      idx++;
    }
  }
  return resources;
}

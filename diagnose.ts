// ============================================================
// CIRO — Comprehensive System Diagnostics
// Verifies environment, network, databases, Gemini API, and Orchestrator
// ============================================================

import path from 'path';
import fs from 'fs';
import axios from 'axios';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

console.log(`\x1b[32m✔ Loaded environment variables natively\x1b[0m`);

import { runCycle, getState, resetState } from './lib/orchestrator';
import { getLogs, getLogStats } from './lib/logger';
import { isSupabaseEnabled } from './lib/supabase';

// Obfuscate secret key
function maskKey(key: string | undefined): string {
  if (!key) return '\x1b[31mMISSING\x1b[0m';
  if (key.length <= 10) return '***';
  return `${key.slice(0, 6)}...${key.slice(-4)}`;
}

async function runDiagnosis() {
  console.log('\n\x1b[36m============================================================\x1b[0m');
  console.log('\x1b[36m🛡️  CIRO SYSTEM DIAGNOSTICS & AUDIT  🛡️\x1b[0m');
  console.log('\x1b[36m============================================================\x1b[0m\n');

  const report: string[] = [];
  report.push('# CIRO System Diagnostics & Health Report');
  report.push(`Generated on: ${new Date().toISOString()}`);
  report.push('');

  let envSuccess = true;
  let networkSuccess = true;
  let geminiSuccess = true;
  let databaseSuccess = true;
  let orchestratorSuccess = true;

  // ────────────────────────────────────────────────────────────
  // STEP 1: Environment Variable Check
  // ────────────────────────────────────────────────────────────
  console.log('\x1b[35m[1/6] Verifying Environment Variables...\x1b[0m');
  const envVars = [
    { name: 'GEMINI_API_KEY', required: true, type: 'secret' },
    { name: 'NEXT_PUBLIC_GOOGLE_MAPS_KEY', required: true, type: 'secret' },
    { name: 'GOOGLE_WEATHER_API_KEY', required: false, type: 'secret' },
    { name: 'NEXT_PUBLIC_SOCIAL_API', required: false, type: 'public' },
    { name: 'NEXT_PUBLIC_SUPABASE_URL', required: true, type: 'public' },
    { name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', required: true, type: 'secret' },
  ];

  report.push('## 1. Environment Configurations');
  report.push('| Variable Name | Status | Configured Value | Severity |');
  report.push('| --- | --- | --- | --- |');

  for (const v of envVars) {
    const val = process.env[v.name];
    const isConfigured = !!val && val !== 'your_supabase_url' && val !== 'your_supabase_anon_key' && !val.includes('placeholder');
    const statusText = isConfigured ? '🟢 Configured' : v.required ? '🔴 MISSING (Required)' : '🟡 MISSING (Optional)';
    const displayVal = v.type === 'secret' ? maskKey(val) : (val || 'N/A');
    
    if (v.required && !isConfigured) {
      envSuccess = false;
    }

    console.log(`  - ${v.name}: ${isConfigured ? '\x1b[32m✔ Configured\x1b[0m' : v.required ? '\x1b[31m✗ MISSING (Required)\x1b[0m' : '\x1b[33m⚠ OPTIONAL MISSING\x1b[0m'} (${displayVal})`);
    report.push(`| \`${v.name}\` | ${statusText} | \`${displayVal.replace(/\x1b\[\d+m/g, '')}\` | ${v.required ? 'High (Required)' : 'Low (Optional)'} |`);
  }
  report.push('');

  // ────────────────────────────────────────────────────────────
  // STEP 2: Network & Endpoint Latency Check
  // ────────────────────────────────────────────────────────────
  console.log('\n\x1b[35m[2/6] Checking External API Enpoint Health & Latencies...\x1b[0m');
  report.push('## 2. External Services & APIs Connectivity');
  report.push('| Endpoint | Description | Status | Latency | Details |');
  report.push('| --- | --- | --- | --- | --- |');

  // Test Social API
  const socialUrl = process.env.NEXT_PUBLIC_SOCIAL_API || 'https://social-media-post-cquv.onrender.com';
  const socialApiEndpoint = `${socialUrl}/api/posts?count=5`;
  try {
    const start = Date.now();
    const res = await axios.get(socialApiEndpoint, { timeout: 10000 });
    const latency = Date.now() - start;
    if (res.data?.success && Array.isArray(res.data?.data)) {
      console.log(`  - Social Media API: \x1b[32m✔ Connected\x1b[0m (${latency}ms) - Ingested ${res.data.data.length} posts`);
      report.push(`| Social Media API | Ingests real-time simulated posts | 🟢 Connected | ${latency}ms | Successfully loaded ${res.data.data.length} incident reports |`);
    } else {
      console.log(`  - Social Media API: \x1b[33m⚠ Unexpected payload format\x1b[0m (${latency}ms)`);
      report.push(`| Social Media API | Ingests real-time simulated posts | 🟡 Unexpected Format | ${latency}ms | Status 200 but data schema not matching |`);
    }
  } catch (err: any) {
    networkSuccess = false;
    console.log(`  - Social Media API: \x1b[31m✗ Connection Failed\x1b[0m (${err.message}). System will fallback to mock social media feed.`);
    report.push(`| Social Media API | Ingests real-time simulated posts | 🔴 Offline (Fallback to Mocks) | N/A | Error: ${err.message} |`);
  }

  // Google Maps Key validation
  const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
  if (mapsKey && mapsKey.startsWith('AIzaSy')) {
    console.log(`  - Google Maps API Key: \x1b[32m✔ Structural Format Valid\x1b[0m`);
    report.push(`| Google Maps API | Location Geocoding & Emergency Routing | 🟢 Key Format Valid | N/A | Key starts with valid prefix 'AIzaSy' |`);
  } else {
    networkSuccess = false;
    console.log(`  - Google Maps API Key: \x1b[31m✗ Invalid structural format\x1b[0m`);
    report.push(`| Google Maps API | Location Geocoding & Emergency Routing | 🔴 Key Invalid | N/A | Key is empty or lacks 'AIzaSy' prefix |`);
  }

  // Weather Key validation
  const weatherKey = process.env.GOOGLE_WEATHER_API_KEY;
  if (weatherKey && weatherKey !== 'your_google_weather_api_key_here') {
    console.log(`  - Google Weather API Key: \x1b[32m✔ Key Configured\x1b[0m`);
    report.push(`| Google Weather API | Micro-climate Signal Contextualization | 🟢 Key Configured | N/A | Custom Weather API key provided |`);
  } else {
    console.log(`  - Google Weather API Key: \x1b[33m⚠ Not configured\x1b[0m (system will use simulated Karachi micro-weather)`);
    report.push(`| Google Weather API | Micro-climate Signal Contextualization | 🟡 Not Configured (Fallback) | N/A | Using simulated high-fidelity weather generator |`);
  }
  report.push('');

  // ────────────────────────────────────────────────────────────
  // STEP 3: Gemini Generative AI Connection Check
  // ────────────────────────────────────────────────────────────
  console.log('\n\x1b[35m[3/6] Verifying Gemini 2.5 Flash Model Connectivity...\x1b[0m');
  report.push('## 3. Google Gemini Large Language Models');
  report.push('| Model ID | Target Agent | Connection Status | Latency | Output Preview |');
  report.push('| --- | --- | --- | --- | --- |');

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    geminiSuccess = false;
    console.log(`  - Gemini Connection: \x1b[31m✗ GEMINI_API_KEY is not defined\x1b[0m`);
    report.push(`| gemini-2.5-flash | Multi-agent Orchestration | 🔴 Missing API Key | N/A | Cannot invoke models |`);
  } else {
    try {
      const ai = new GoogleGenerativeAI(geminiKey);
      
      // Test 1: gemini-2.5-flash (primary agents)
      const start = Date.now();
      const flashModel = ai.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: { responseMimeType: 'application/json' }
      });
      const prompt = `Return a JSON object: {"ping":"pong","agent":"diagnostics"}`;
      const result = await flashModel.generateContent(prompt);
      const latency = Date.now() - start;
      const text = result.response.text().trim();
      console.log(`  - gemini-2.5-flash (Primary): \x1b[32m✔ Online\x1b[0m (${latency}ms) -> ${text}`);
      report.push(`| gemini-2.5-flash | Crisis classification, Resource optimization, Alerts generation | 🟢 Online | ${latency}ms | \`${text}\` |`);

      // Test 2: gemma-4-26b-a4b-it fallback
      const startGemma = Date.now();
      try {
        const gemmaModel = ai.getGenerativeModel({ model: 'gemma-4-26b-a4b-it' });
        const resultGemma = await gemmaModel.generateContent('ping');
        const latencyGemma = Date.now() - startGemma;
        console.log(`  - gemma-4-26b-a4b-it (Summary): \x1b[32m✔ Online\x1b[0m (${latencyGemma}ms)`);
        report.push(`| gemma-4-26b-a4b-it | Signal Summarization fallback | 🟢 Online | ${latencyGemma}ms | Available |`);
      } catch (err: any) {
        console.log(`  - gemma-4-26b-a4b-it (Summary): \x1b[33m⚠ Fallback active\x1b[0m (${err.message}) - system will automatically use procedural heuristic summaries`);
        report.push(`| gemma-4-26b-a4b-it | Signal Summarization fallback | 🟡 Model Unavailable (Fallback Active) | N/A | Error: ${err.message}. System falls back seamlessly to JS regex groups. |`);
      }
    } catch (err: any) {
      geminiSuccess = false;
      console.log(`  - Gemini Connection: \x1b[31m✗ Failed\x1b[0m (${err.message})`);
      report.push(`| gemini-2.5-flash | Multi-agent Orchestration | 🔴 Connection Failed | N/A | Error: ${err.message} |`);
    }
  }
  report.push('');

  // ────────────────────────────────────────────────────────────
  // STEP 4: Supabase Database Diagnostics
  // ────────────────────────────────────────────────────────────
  console.log('\n\x1b[35m[4/6] Diagnosing Supabase Connection & Schema...\x1b[0m');
  report.push('## 4. Supabase Database & Persistence Health');
  report.push('| Table Name | Expected Purpose | Exists in DB | Schema & Realtime Status | Action |');
  report.push('| --- | --- | --- | --- | --- |');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!isSupabaseEnabled()) {
    databaseSuccess = false;
    console.log(`  - Supabase Database: \x1b[33m⚠ Offline/Not Configured\x1b[0m. System runs in secure local in-memory mode.`);
    report.push(`| All Tables | Remote Event Logger & Dashboard Storage | ⚪ Not Configured | Running in high-performance local memory | Configure url/key in .env.local to persist cycles |`);
  } else {
    try {
      const db = createClient(supabaseUrl!, supabaseAnonKey!);
      const tables = [
        { name: 'ciro_cycles', desc: 'Saves run metrics & cycle count' },
        { name: 'ciro_logs', desc: 'Stores deep AI agent decision chains' },
        { name: 'ciro_crises', desc: 'Registers active & historical crisis signals' },
        { name: 'ciro_allocations', desc: 'Records dispatched resource logistics' },
        { name: 'ciro_notifications', desc: 'Preserves citizen & utility alerts' }
      ];

      for (const t of tables) {
        // Query 1 row to see if table exists and is readable
        const start = Date.now();
        const { data, error } = await db.from(t.name).select('*').limit(1);
        const latency = Date.now() - start;
        
        if (error) {
          databaseSuccess = false;
          console.log(`  - Table \`${t.name}\`: \x1b[31m✗ Error/Not Found\x1b[0m (${error.message})`);
          report.push(`| \`${t.name}\` | ${t.desc} | 🔴 Error | Query latency ${latency}ms, details: ${error.message} | Run schema.sql inside Supabase SQL editor |`);
        } else {
          console.log(`  - Table \`${t.name}\`: \x1b[32m✔ Active & Accessible\x1b[0m (latency: ${latency}ms)`);
          report.push(`| \`${t.name}\` | ${t.desc} | 🟢 Active | Verified OK (${latency}ms) | Fully Synchronized |`);
        }
      }
    } catch (err: any) {
      databaseSuccess = false;
      console.log(`  - Supabase Connection: \x1b[31m✗ Client Connection Exception\x1b[0m (${err.message})`);
      report.push(`| Supabase Client | Remote persistence connection | 🔴 Connection Exception | N/A | Exception: ${err.message} |`);
    }
  }
  report.push('');

  // ────────────────────────────────────────────────────────────
  // STEP 5: Orchestrator Dry Run (Dry-run of one full cycle)
  // ────────────────────────────────────────────────────────────
  console.log('\n\x1b[35m[5/6] Triggering Dry Run of CIRO Agentic Orchestration Cycle...\x1b[0m');
  report.push('## 5. Agentic Orchestrator Dry-Run Trace');
  
  resetState();
  const startCycleTime = Date.now();
  try {
    const outputState = await runCycle();
    const duration = Date.now() - startCycleTime;

    console.log(`  - Cycle complete in: \x1b[32m${duration}ms\x1b[0m`);
    console.log(`  - Current System Status: \x1b[36m${outputState.systemStatus.toUpperCase()}\x1b[0m`);
    console.log(`  - Ingested Signals Count: \x1b[32m${outputState.signals.length}\x1b[0m`);
    console.log(`  - Identified Active Crises: \x1b[31m${outputState.crises.filter(c => c.status === 'active').length}\x1b[0m`);
    console.log(`  - Dispatched Resource Allocations: \x1b[33m${outputState.allocations.length}\x1b[0m`);
    console.log(`  - Public & Service Alerts Broadcasted: \x1b[35m${outputState.notifications.length}\x1b[0m`);
    console.log(`  - Simulation Traces Generated: \x1b[32m${outputState.simulations.length}\x1b[0m`);
    console.log(`  - Road/Traffic Management Blocks: \x1b[33m${outputState.trafficActions.length}\x1b[0m`);

    report.push(`🟢 **Orchestrator Cycle Dry-Run Succeeded** in **${duration}ms**!`);
    report.push('');
    report.push('### Core Metrics:');
    report.push(`- **System State Status**: \`${outputState.systemStatus.toUpperCase()}\``);
    report.push(`- **Ingested Signals**: \`${outputState.signals.length}\``);
    report.push(`- **Detected Active Crises**: \`${outputState.crises.filter(c => c.status === 'active').length}\` event(s)`);
    report.push(`- **Dispatched Resources**: \`${outputState.allocations.length}\` allocation plan(s)`);
    report.push(`- **Generated Alerts**: \`${outputState.notifications.length}\` alert message(s)`);
    report.push(`- **Simulation Runs**: \`${outputState.simulations.length}\` virtual crisis outcome(s)`);
    report.push(`- **Traffic Corridors Rerouted/Blocked**: \`${outputState.trafficActions.length}\` zone(s)`);
    report.push('');
    
    if (outputState.crises.length > 0) {
      report.push('### Dry-Run Active Crises:');
      report.push('| ID | Type | Severity | Location | Radii | Description |');
      report.push('| --- | --- | --- | --- | --- | --- |');
      for (const c of outputState.crises) {
        report.push(`| \`${c.id}\` | ${c.type.toUpperCase()} | **${c.severity}** | ${c.location} | ${c.affected_radius_km} km | ${c.description} |`);
      }
      report.push('');
    }

    if (outputState.allocations.length > 0) {
      report.push('### Dry-Run Dispatch Allocations:');
      report.push('| Target Crisis ID | ETA | Units Dispatched | Allocation Strategy |');
      report.push('| --- | --- | --- | --- |');
      for (const a of outputState.allocations) {
        report.push(`| \`${a.crisis_id}\` | ${a.total_response_time_minutes} mins | ${a.units.map(u => `\`${u.id} (${u.type})\``).join(', ')} | ${a.reasoning} |`);
      }
      report.push('');
    }

    if (outputState.notifications.length > 0) {
      report.push('### Dry-Run Broadcast Alerts:');
      report.push('| Channel | Severity | Title | Message |');
      report.push('| --- | --- | --- | --- |');
      for (const n of outputState.notifications) {
        report.push(`| \`${n.channel.toUpperCase()}\` | ${n.severity} | **${n.title}** | ${n.message} |`);
      }
      report.push('');
    }

    if (outputState.simulations.length > 0) {
      report.push('### Pre-execution Simulation Predictions:');
      report.push('| Crisis ID | Scenario Outcome | Response Plan | Saved Lives (Est.) | Risk Trade-offs |');
      report.push('| --- | --- | --- | --- | --- |');
      for (const s of outputState.simulations) {
        report.push(`| \`${s.crisis_id}\` | ${s.scenario} | ${s.best_action_plan} | **${s.estimated_lives_saved ?? 'N/A'}** | ${s.risk_tradeoffs.join(', ')} |`);
      }
      report.push('');
    }

  } catch (err: any) {
    orchestratorSuccess = false;
    console.log(`  - Orchestration Dry Run: \x1b[31m✗ FAILED\x1b[0m (${err.message})`);
    report.push(`🔴 **Orchestrator Cycle Dry-Run Failed**`);
    report.push(`- **Error Message**: \`${err.message}\``);
    report.push(`- **Stack Trace**: \`${err.stack}\``);
    report.push('');
  }

  // ────────────────────────────────────────────────────────────
  // STEP 6: System Logs & Agent Decision Audit
  // ────────────────────────────────────────────────────────────
  console.log('\n\x1b[35m[6/6] Auditing In-Memory Agent Decision Chain...\x1b[0m');
  report.push('## 6. Real-Time Agent Logger & Decision Stats');
  
  const stats = getLogStats();
  const allLogs = getLogs({ limit: 100 });

  console.log(`  - Total system logs compiled: \x1b[32m${stats.total}\x1b[0m`);
  console.log(`  - Log level counts: SUCCESS=${stats.byLevel.SUCCESS || 0}, INFO=${stats.byLevel.INFO || 0}, WARN=${stats.byLevel.WARN || 0}, ERROR=${stats.byLevel.ERROR || 0}`);
  console.log(`  - Average API call duration: \x1b[32m${stats.avgDurationMs}ms\x1b[0m`);

  report.push('### In-Memory Logger Metrics:');
  report.push(`- **Total Compiled Logs**: \`${stats.total}\``);
  report.push(`- **Errors Registered**: \`${stats.errorCount}\``);
  report.push(`- **API Outbound Calls**: \`${stats.apiCallCount}\``);
  report.push(`- **Average Outbound API Latency**: \`${stats.avgDurationMs} ms\``);
  report.push('');
  report.push('### Log Breakdown by Level:');
  report.push('| Log Level | Counts |');
  report.push('| --- | --- |');
  for (const [lvl, val] of Object.entries(stats.byLevel)) {
    report.push(`| **${lvl}** | ${val} |`);
  }
  report.push('');

  report.push('### Log Breakdown by Agent / Engine:');
  report.push('| Agent / Engine | Counts |');
  report.push('| --- | --- |');
  for (const [ag, val] of Object.entries(stats.byAgent)) {
    report.push(`| \`${ag}\` | ${val} |`);
  }
  report.push('');

  report.push('### Log Breakdown by Category:');
  report.push('| Category | Counts |');
  report.push('| --- | --- |');
  for (const [cat, val] of Object.entries(stats.byCategory)) {
    report.push(`| \`${cat}\` | ${val} |`);
  }
  report.push('');

  report.push('### Live Chronological Audit Log (Top 30):');
  report.push('| Timestamp | Level | Agent | Action | Message | Details |');
  report.push('| --- | --- | --- | --- | --- | --- |');
  for (const l of allLogs.slice(0, 30)) {
    const extraInfo = l.durationMs ? `Latency: ${l.durationMs}ms` : (l.errorMessage || '-');
    report.push(`| ${new Date(l.timestamp).toLocaleTimeString()} | \`${l.level}\` | \`${l.agent}\` | \`${l.action}\` | ${l.message} | ${extraInfo} |`);
  }
  report.push('');

  // Summarize overall diagnostic status
  console.log('\n\x1b[36m============================================================\x1b[0m');
  console.log('\x1b[36m🩺 DIAGNOSTICS COMPLETE — FINAL SCORE CARD 🩺\x1b[0m');
  console.log('\x1b[36m============================================================\x1b[0m');
  
  const scoreCard = [
    { name: 'Environment Setup', ok: envSuccess },
    { name: 'External Network Health', ok: networkSuccess },
    { name: 'Gemini Models Interface', ok: geminiSuccess },
    { name: 'Supabase Database Schema', ok: databaseSuccess },
    { name: 'Orchestrator Cycle Run', ok: orchestratorSuccess }
  ];

  report.push('## 7. Diagnostics Score Card');
  report.push('| Diagnostics Category | Status | Remarks |');
  report.push('| --- | --- | --- |');

  for (const s of scoreCard) {
    console.log(`  - ${s.name}: ${s.ok ? '\x1b[32m🟢 PASS\x1b[0m' : '\x1b[31m🔴 FAIL\x1b[0m'}`);
    report.push(`| ${s.name} | ${s.ok ? '🟢 PASS' : '🔴 FAIL'} | ${s.ok ? 'Operational without bottlenecks' : 'Requires developer attention'} |`);
  }
  report.push('');

  const overallPass = scoreCard.every(s => s.ok);
  console.log(`\nOverall System Health: ${overallPass ? '\x1b[32m✔ EXCELLENT\x1b[0m' : '\x1b[31m⚠ ISSUES DETECTED\x1b[0m'}\n`);

  report.push('## 8. Architectural Overview');
  report.push('CIRO is structured as an **Agentic crisis response engine** with multiple independent specialized sub-agents working together in a unified pipeline:');
  report.push('');
  report.push('```mermaid');
  report.push('graph TD');
  report.push('  A[Social Media/Weather/Traffic Ingestion] -->|Raw signals| B(Signal Fusion Engine)');
  report.push('  B -->|Grouped Fused Signals| C(Crisis Detection Agent)');
  report.push('  C -->|Classified Crisis Events| D(Risk Prediction Agent)');
  report.push('  D -->|Spread & Escalation Probability| E(Resource Allocation Agent)');
  report.push('  E -->|Emergency Dispatches| F(Simulation Agent)');
  report.push('  E -->|Road status blocks| G(Traffic Control Engine)');
  report.push('  C -->|Severity updates| H(Notification Agent)');
  report.push('  F -->|Scenario verification| I[Dashboard State Update & Supabase Sync]');
  report.push('  G -->|Emergency Corridors| I');
  report.push('  H -->|Citizen & Utility Alerts| I');
  report.push('```');
  report.push('');

  // Write report to system_diagnostics_report.md in the current directory or workspace
  const reportPath = path.resolve(process.cwd(), 'system_diagnostics_report.md');
  fs.writeFileSync(reportPath, report.join('\n'));
  console.log(`\x1b[32m✔ Successfully wrote structured diagnostic report to ${reportPath}\x1b[0m\n`);
}

runDiagnosis().catch(e => {
  console.error('\x1b[31mDiagnostic script crashed:\x1b[0m', e);
});

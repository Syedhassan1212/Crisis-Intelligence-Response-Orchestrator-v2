// ============================================================
// CIRO — WebSocket Real-Time Sync Server  (Multi-Incident Rooms)
// Run with: node websocket-server.js
// Runs on Port 3002
// ============================================================

const { WebSocketServer, WebSocket } = require('ws');
const fs = require('fs');
const path = require('path');

// ── Parse .env.local manually for Supabase Keys ──────────────
let supabaseUrl = '';
let supabaseKey = '';

try {
  const envPath = path.join(__dirname, '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const urlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.+)/);
    const keyMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY\s*=\s*(.+)/);
    if (urlMatch) supabaseUrl = urlMatch[1].trim();
    if (keyMatch) supabaseKey = keyMatch[1].trim();
    console.log('[WS Config] Read Supabase URL:', supabaseUrl);
  }
} catch (e) {
  console.warn('[WS Config] Failed to read .env.local:', e.message);
}

// Lazy Supabase client
let supabase = null;
if (supabaseUrl && supabaseKey) {
  try {
    const { createClient } = require('@supabase/supabase-js');
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log('[WS Supabase] Supabase client initialized.');
  } catch (e) {
    console.warn('[WS Supabase] Could not load @supabase/supabase-js:', e.message);
  }
}

// ── Start WebSocket Server ──────────────────────────────────
const PORT = process.env.PORT || 3002;
const wss = new WebSocketServer({ port: PORT });
console.log(`[WS Server] Real-time broker running on port ${PORT}`);

// ── Client Registrations ──────────────────────────────────
const dashboardClients = new Set();
const mobileClients    = new Set();
// Map: ws → { clientType, incidentId }
const clientMeta = new Map();

// ── Multi-Incident Room Store ─────────────────────────────
// rooms[incidentId] = {
//   incidentId, location, sector, severity, startedAt,
//   chat: [{ id, sender, text, timestamp }],
//   members: Set<ws>
// }
const rooms = new Map();

// ── Helpers ──────────────────────────────────────────────
function broadcastTo(clientSet, messageObj) {
  const serialized = JSON.stringify(messageObj);
  for (const client of clientSet) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(serialized);
    }
  }
}

function broadcastRoomListToAll() {
  const roomList = Array.from(rooms.values()).map(r => ({
    incidentId: r.incidentId,
    location:   r.location,
    sector:     r.sector,
    severity:   r.severity,
    startedAt:  r.startedAt
  }));
  const msg = { type: 'rooms_update', rooms: roomList };
  broadcastTo(dashboardClients, msg);
  broadcastTo(mobileClients, msg);
}

// ── Connection Handler ────────────────────────────────────
wss.on('connection', (ws) => {
  console.log('[WS Connection] New client connected.');
  let clientRegistration = null;

  ws.on('message', async (message, isBinary) => {
    // ── Audio relay (binary frame with JSON header prefix) ──────────
    if (isBinary) {
      // Format: first 4 bytes = header length (uint32 BE), then header JSON, then PCM data
      try {
        const buf = Buffer.isBuffer(message) ? message : Buffer.from(message);
        const headerLen = buf.readUInt32BE(0);
        const headerStr = buf.slice(4, 4 + headerLen).toString('utf8');
        const header    = JSON.parse(headerStr);
        const pcmData   = buf.slice(4 + headerLen);
        const incidentId = header.incidentId;

        // Relay to all OTHER open clients in the same room
        const room = rooms.get(incidentId);
        if (room) {
          for (const member of room.members) {
            if (member !== ws && member.readyState === 1 /*OPEN*/) {
              member.send(buf); // forward raw binary as-is
            }
          }
        }
      } catch (e) {
        // Silently ignore malformed binary frames
      }
      return; // do not fall through to JSON parsing
    }

    try {
      const payload = JSON.parse(message.toString());
      console.log(`[WS Message] type=${payload.type}${payload.incidentId ? ' incidentId=' + payload.incidentId : ''}`);

      switch (payload.type) {

        // ── REGISTER ──────────────────────────────────────
        case 'register':
          clientRegistration = payload.clientType;
          if (payload.clientType === 'dashboard') {
            dashboardClients.add(ws);
            console.log('[WS Register] Dashboard. Total:', dashboardClients.size);
            // Send all active rooms on connect
            ws.send(JSON.stringify({
              type: 'rooms_update',
              rooms: Array.from(rooms.values()).map(r => ({
                incidentId: r.incidentId,
                location:   r.location,
                sector:     r.sector,
                severity:   r.severity,
                startedAt:  r.startedAt
              }))
            }));
          } else if (payload.clientType === 'mobile') {
            mobileClients.add(ws);
            console.log('[WS Register] Mobile. Total:', mobileClients.size);
            // Also send rooms so mobile can pick one
            ws.send(JSON.stringify({
              type: 'rooms_update',
              rooms: Array.from(rooms.values()).map(r => ({
                incidentId: r.incidentId,
                location:   r.location,
                sector:     r.sector,
                severity:   r.severity,
                startedAt:  r.startedAt
              }))
            }));
          }
          break;

        // ── SOS ───────────────────────────────────────────
        case 'sos':
          console.log('[WS SOS] Distress beacon received:', payload);
          if (supabase) {
            try {
              const { error } = await supabase.from('ciro_crises').insert({
                id: payload.id || `crisis_sos_${Date.now()}`,
                type: payload.incidentType || 'unknown',
                severity: payload.severity || 'CRITICAL',
                location: payload.location || 'Emergency Beacon Lock',
                lat: payload.lat || 24.8607,
                lng: payload.lng || 67.0104,
                description: payload.description || 'IMMEDIATE SOS DISTRESS CALL!',
                status: 'active',
                affected_radius_km: 1.5,
                expected_duration_hours: 3,
                confidence: 0.99,
                evidence: ['civilian_sos_app']
              });
              if (error) console.error('[WS Supabase] SOS insert error:', error.message);
              else console.log('[WS Supabase] SOS inserted.');
            } catch (e) {
              console.error('[WS Supabase] SOS insert failed:', e.message);
            }
          }
          broadcastTo(dashboardClients, { type: 'sos_broadcast', data: payload });
          break;

        // ── RESPONDER LOCATION ────────────────────────────
        case 'responder_location':
          broadcastTo(dashboardClients, {
            type: 'responder_location_broadcast',
            data: {
              responderId: payload.responderId,
              lat:         payload.lat,
              lng:         payload.lng,
              status:      payload.status
            }
          });
          break;

        // ── DISPATCH ──────────────────────────────────────
        case 'dispatch':
          console.log('[WS Dispatch] Command received:', payload);
          if (supabase && payload.resourceId && payload.crisisId) {
            try {
              const { error } = await supabase
                .from('ciro_resources')
                .update({
                  status: 'dispatched',
                  assigned_crisis_id: payload.crisisId,
                  eta_minutes: payload.eta || 12
                })
                .eq('id', payload.resourceId);
              if (error) console.error('[WS Supabase] Dispatch update error:', error.message);
            } catch (e) {
              console.error('[WS Supabase] Dispatch update failed:', e.message);
            }
          }
          broadcastTo(mobileClients, { type: 'dispatch_broadcast', data: payload });
          break;

        // ── VOICE CALL (per-incident room join/leave) ─────
        case 'voice_call': {
          const incidentId = payload.incidentId;
          if (!incidentId) {
            console.warn('[WS Voice] voice_call missing incidentId — ignored.');
            break;
          }

          if (payload.status === 'started') {
            if (!rooms.has(incidentId)) {
              rooms.set(incidentId, {
                incidentId,
                location:  payload.location  || 'Unknown Location',
                sector:    payload.sector     || 'Unknown Sector',
                severity:  payload.severity   || 'HIGH',
                startedAt: new Date().toISOString(),
                chat:      [],
                members:   new Set()
              });
              console.log(`[WS Rooms] Room CREATED for incident ${incidentId}. Total rooms: ${rooms.size}`);
            } else {
              console.log(`[WS Rooms] Room already exists for incident ${incidentId}.`);
            }
            // Add this client to the room's member set
            rooms.get(incidentId).members.add(ws);
            clientMeta.set(ws, { clientType: clientRegistration, incidentId });
          } else if (payload.status === 'ended') {
            const r = rooms.get(incidentId);
            if (r) r.members.delete(ws);
            clientMeta.delete(ws);
            if (!r || r.members.size === 0) {
              rooms.delete(incidentId);
              console.log(`[WS Rooms] Room REMOVED for incident ${incidentId}. Total rooms: ${rooms.size}`);
            }
          }

          // Notify all clients of updated room list
          broadcastRoomListToAll();

          // Also send targeted voice event to both
          const room = rooms.get(incidentId) || {};
          broadcastTo(dashboardClients, {
            type: 'voice_call_broadcast',
            status: payload.status,
            incidentId,
            data: { incidentId, ...room }
          });
          broadcastTo(mobileClients, {
            type: 'voice_call_broadcast',
            status: payload.status,
            incidentId,
            data: { incidentId, ...room }
          });
          break;
        }

        // ── CHAT MESSAGE (per-incident room) ─────────────
        case 'chat_message': {
          const incidentId = payload.incidentId;
          if (!incidentId) {
            console.warn('[WS Chat] chat_message missing incidentId — ignored.');
            break;
          }

          const room = rooms.get(incidentId);
          if (!room) {
            console.warn(`[WS Chat] No room found for incidentId=${incidentId}`);
            break;
          }

          const chatMsg = {
            id:         `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            sender:     payload.sender || 'Unknown',
            text:       payload.text,
            timestamp:  new Date().toISOString(),
            incidentId
          };

          // Store in room chat history (cap at 200)
          room.chat.push(chatMsg);
          if (room.chat.length > 200) room.chat.shift();

          console.log(`[WS Chat] [${incidentId}] ${chatMsg.sender}: ${chatMsg.text}`);

          const outMsg = { type: 'chat_message_broadcast', incidentId, data: chatMsg };
          broadcastTo(dashboardClients, outMsg);
          broadcastTo(mobileClients, outMsg);
          break;
        }

        // ── REQUEST CHAT HISTORY (on room join) ──────────
        case 'get_chat_history': {
          const incidentId = payload.incidentId;
          const room = rooms.get(incidentId);
          if (room && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'chat_history',
              incidentId,
              messages: room.chat
            }));
          }
          break;
        }

        // ── JSON AUDIO CHUNK (mobile → dashboard) ─────────
        case 'audio_chunk': {
          const incidentId = payload.incidentId;
          if (!incidentId || !payload.data) break;
          const room = rooms.get(incidentId);
          if (!room) break;
          // Relay to all OTHER members of this room
          const serialized = JSON.stringify(payload);
          for (const member of room.members) {
            if (member !== ws && member.readyState === 1) {
              member.send(serialized);
            }
          }
          break;
        }

        default:
          console.warn(`[WS Warning] Unhandled type: ${payload.type}`);
      }
    } catch (e) {
      console.error('[WS Error] Error processing message:', e.message);
    }
  });

  ws.on('close', () => {
    if (clientRegistration === 'dashboard') {
      dashboardClients.delete(ws);
      console.log('[WS Close] Dashboard disconnected. Total:', dashboardClients.size);
    } else if (clientRegistration === 'mobile') {
      mobileClients.delete(ws);
      console.log('[WS Close] Mobile disconnected. Total:', mobileClients.size);
    }
    // Remove from any room member sets
    const meta = clientMeta.get(ws);
    if (meta?.incidentId) {
      const r = rooms.get(meta.incidentId);
      if (r) r.members.delete(ws);
    }
    clientMeta.delete(ws);
  });
});

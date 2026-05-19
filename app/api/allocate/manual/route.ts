import { NextResponse } from 'next/server';
import { state } from '@/lib/orchestrator';
import { logInfo, logSuccess, logError } from '@/lib/logger';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { resourceId, crisisId } = body;

    if (!resourceId || !crisisId) {
      return NextResponse.json({ success: false, error: 'Missing resourceId or crisisId' }, { status: 400 });
    }

    logInfo('RESOURCE_ALLOCATION', 'Orchestrator', 'MANUAL_DISPATCH', `Manually dispatching unit ${resourceId} to crisis ${crisisId}`);

    const resIdx = state.resources.findIndex(r => r.id === resourceId);
    if (resIdx === -1) {
      return NextResponse.json({ success: false, error: `Resource ${resourceId} not found` }, { status: 404 });
    }

    const crisis = state.crises.find(c => c.id === crisisId);
    if (!crisis) {
      return NextResponse.json({ success: false, error: `Crisis ${crisisId} not found` }, { status: 404 });
    }

    // Dispatch the unit!
    state.resources[resIdx] = {
      ...state.resources[resIdx],
      status: 'dispatched',
      assigned_crisis_id: crisisId,
      eta_minutes: 8, // 8 minutes default manual ETA
    };

    // Add manual allocation record
    let allocation = state.allocations.find(a => a.crisis_id === crisisId);
    if (allocation) {
      if (!allocation.units.find(u => u.id === resourceId)) {
        allocation.units.push({
          ...state.resources[resIdx],
          status: 'dispatched',
          assigned_crisis_id: crisisId,
        });
      }
    } else {
      // Create new manual allocation plan
      allocation = {
        crisis_id: crisisId,
        units: [{
          ...state.resources[resIdx],
          status: 'dispatched',
          assigned_crisis_id: crisisId,
        }],
        total_response_time_minutes: 8,
        reasoning: `Manual dispatcher override: unit ${resourceId} dispatched to ${crisis.location}`,
        confidence: 1.0,
        timestamp: new Date().toISOString(),
      };
      state.allocations.push(allocation);
    }

    // Add manual alert notification
    state.notifications.unshift({
      id: `manual_notif_${Date.now()}`,
      crisis_id: crisisId,
      channel: 'emergency_services',
      severity: crisis.severity,
      title: `🚨 Dispatch Override: ${state.resources[resIdx].type.toUpperCase()} Dispatched`,
      message: `Dispatcher manually routed ${resourceId} to Clifton/DHA crisis zone. En route with active beacons.`,
      location: crisis.location,
      timestamp: new Date().toISOString(),
      sent: true,
    });

    state.lastUpdated = new Date().toISOString();

    logSuccess('RESOURCE_ALLOCATION', 'Orchestrator', 'MANUAL_DISPATCH_SUCCESS', `Successfully dispatched ${resourceId} manually to ${crisisId}`);

    // Notify WebSocket server of manual dispatch
    try {
      const WebSocket = require('ws');
      const wsUrl = process.env.WS_URL || process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3002';
      const ws = new WebSocket(wsUrl);
      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'dispatch',
          resourceId,
          crisisId,
          eta: 8
        }));
        setTimeout(() => ws.close(), 100);
      });
      ws.on('error', () => {});
    } catch (wsErr) {
      console.warn('[WS Dispatch Manual] Failed to notify WebSocket server:', wsErr);
    }

    return NextResponse.json({ success: true, data: state });
  } catch (err) {
    logError('RESOURCE_ALLOCATION', 'Orchestrator', 'MANUAL_DISPATCH_ERROR', `Failed manual dispatch: ${err}`);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

'use client';

import type { Notification } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';

interface NotificationCenterProps {
  notifications: Notification[];
}

const CHANNEL_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  public: { icon: '📱', color: 'text-blue-400', label: 'Public Alert' },
  emergency_services: { icon: '🚨', color: 'text-red-400', label: 'Emergency Services' },
  hospitals: { icon: '🏥', color: 'text-green-400', label: 'Hospital Network' },
  utilities: { icon: '⚡', color: 'text-yellow-400', label: 'Utility Services' },
};

const severityOrder: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

export default function NotificationCenter({ notifications }: NotificationCenterProps) {
  const sorted = [...notifications].sort((a, b) =>
    (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0)
  );

  const byChannel = notifications.reduce<Record<string, number>>((acc, n) => {
    acc[n.channel] = (acc[n.channel] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      <div>
        <h2 className="text-sm font-bold text-white">Notification Center</h2>
        <p className="text-xs text-gray-500">{notifications.length} alerts dispatched across all channels</p>
      </div>

      {/* Channel stats */}
      <div className="grid grid-cols-4 gap-2">
        {Object.entries(CHANNEL_CONFIG).map(([ch, cfg]) => (
          <div key={ch} className="glass-card p-2.5 text-center">
            <div className="text-lg">{cfg.icon}</div>
            <div className={`text-lg font-bold ${cfg.color}`}>{byChannel[ch] || 0}</div>
            <div className="text-xs text-gray-600 leading-tight">{cfg.label}</div>
          </div>
        ))}
      </div>

      {/* Notification list */}
      {sorted.length === 0 && (
        <div className="text-center py-16 text-xs text-gray-600">
          <div className="text-5xl mb-3">🔕</div>
          <div>No alerts sent yet</div>
          <div className="mt-1 text-gray-700">Alerts fire automatically on HIGH/CRITICAL events</div>
        </div>
      )}

      <div className="space-y-2">
        {sorted.map(notif => {
          const ch = CHANNEL_CONFIG[notif.channel] || CHANNEL_CONFIG.public;
          return (
            <div key={notif.id} className={`notif-item notif-${notif.severity.toLowerCase()} animate-fade-in`}>
              <div className="flex items-start gap-2">
                <span className="text-lg flex-shrink-0 mt-0.5">{ch.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`badge-${notif.severity.toLowerCase()}`}>{notif.severity}</span>
                    <span className={`text-xs font-semibold ${ch.color}`}>{ch.label}</span>
                    <span className="text-xs text-gray-600">📍 {notif.location}</span>
                  </div>
                  <div className="text-xs font-medium text-white mt-1">{notif.title}</div>
                  <div className="text-xs text-gray-400 mt-1 leading-relaxed">{notif.message}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-xs text-gray-600">
                    {formatDistanceToNow(new Date(notif.timestamp), { addSuffix: true })}
                  </div>
                  {notif.sent && (
                    <div className="text-xs text-green-500 mt-1">✓ Sent</div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

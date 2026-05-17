'use client';

import type { Notification } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';

interface NotificationCenterProps {
  notifications: Notification[];
}

const CHANNEL_CONFIG: Record<string, { icon: string; color: string; tag: string; label: string }> = {
  public: { icon: '📱', color: 'text-sky-400', tag: 'tag-secure', label: 'Public Alert' },
  emergency_services: { icon: '🚨', color: 'text-rose-400', tag: 'tag-critical', label: 'Emergency Services' },
  hospitals: { icon: '🏥', color: 'text-emerald-400', tag: 'tag-secure', label: 'Hospitals' },
  utilities: { icon: '⚡', color: 'text-amber-400', tag: 'tag-medium', label: 'Utilities' },
};

const SEVERITY_TAGS: Record<string, string> = {
  CRITICAL: 'tag-critical',
  HIGH: 'tag-high',
  MEDIUM: 'tag-medium',
  LOW: 'tag-low',
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
    <div className="h-full overflow-y-auto p-4 space-y-4 bg-[#09090b]">
      
      {/* Broadcast Deck Header */}
      <div className="border-b border-zinc-800 pb-3">
        <h2 className="text-xs font-bold tracking-wider text-zinc-200 uppercase">Notification Dispatch Deck</h2>
        <p className="text-[10px] text-zinc-500 uppercase mt-1">{notifications.length} Active Alerts Across Channels</p>
      </div>

      {/* Network Stats Grid */}
      <div className="grid grid-cols-4 gap-3 font-sans">
        {Object.entries(CHANNEL_CONFIG).map(([ch, cfg]) => (
          <div key={ch} className="hud-panel p-2.5 text-center bg-zinc-900/50 border-zinc-800">
            <div className="text-lg">{cfg.icon}</div>
            <div className={`text-base font-bold ${cfg.color} mt-1`}>{byChannel[ch] || 0}</div>
            <div className="text-[8px] text-zinc-500 mt-1 uppercase font-semibold tracking-wider leading-none">{cfg.label}</div>
          </div>
        ))}
      </div>

      {/* Alarm list */}
      {sorted.length === 0 && (
        <div className="text-center py-16 border border-dashed border-zinc-800 rounded-lg font-sans">
          <div className="text-4xl mb-3">🔕</div>
          <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">No Alerts Dispatched</div>
          <div className="text-[9px] text-zinc-500 mt-1">Alerts populate here automatically when incidents are dispatched.</div>
        </div>
      )}

      <div className="space-y-3">
        {sorted.map(notif => {
          const ch = CHANNEL_CONFIG[notif.channel] || CHANNEL_CONFIG.public;
          const isCritical = notif.severity === 'CRITICAL';
          const pnlClass = isCritical ? 'hud-panel-danger' : 'hud-panel';
          const notifId = notif.id.slice(0, 5).toUpperCase();
          
          return (
            <div key={notif.id} className={`${pnlClass} p-3.5 rounded-lg border-zinc-800 bg-zinc-900/40`}>
              <div className="flex items-start gap-3">
                <span className="text-lg flex-shrink-0 mt-0.5">{ch.icon}</span>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap font-sans">
                    <span className={`tag-base ${SEVERITY_TAGS[notif.severity]}`}>{notif.severity}</span>
                    <span className={`tag-base ${ch.tag}`}>{ch.label}</span>
                    <span className="text-[9px] text-zinc-500 font-semibold font-mono">📍 {notif.location.toUpperCase()}</span>
                  </div>
                  
                  <div className="text-xs font-semibold text-zinc-200 mt-2">
                    {notif.title}
                  </div>
                  
                  {/* Alert message body */}
                  <div className="bg-zinc-950 border border-zinc-800/80 p-2.5 rounded text-[10px] text-zinc-300 italic leading-relaxed font-sans">
                    <span className="text-[8px] text-zinc-500 block font-bold not-italic mb-1 uppercase tracking-wider font-mono">
                      Alert Message (Ref: {notifId})
                    </span>
                    "{notif.message}"
                  </div>
                </div>
                
                <div className="text-right flex-shrink-0 text-[8.5px] text-zinc-500">
                  <div className="font-semibold text-zinc-400 font-sans">
                    {formatDistanceToNow(new Date(notif.timestamp), { addSuffix: true })}
                  </div>
                  {notif.sent && (
                    <div className="text-emerald-400 font-bold mt-2 uppercase select-none font-sans">
                      Sent
                    </div>
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

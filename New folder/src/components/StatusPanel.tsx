import { motion } from "motion/react";
import { Sun, Truck, Target, Car, Plane, Radar } from "lucide-react";

const assets = [
  { id: 'HEAVY_RESPONDER_01', icon: Truck, meta: 'ASSIGNED: SECTOR 4-B', status: 'EN ROUTE', color: 'text-primary', progress: 75 },
  { id: 'UTILITY_DRONE_77', icon: Target, meta: 'ASSIGNED: PERIMETER', status: 'STATIONARY', color: 'text-emerald-400', progress: 100 },
  { id: 'RAPID_INTERCEPT_04', icon: Car, meta: 'ASSIGNED: HIGHWAY 10', status: 'REFUELING', color: 'text-tertiary', progress: 25 },
  { id: 'AERIAL_RECON_A', icon: Plane, meta: 'STANDBY', status: 'OFFLINE', color: 'text-on-surface-variant', progress: 0, opacity: 0.7 },
];

export default function StatusPanel() {
  return (
    <section className="w-[26%] border-l border-outline-variant flex flex-col bg-surface-low/40 overflow-hidden">
      {/* Climate Section */}
      <div className="p-4 border-b border-outline-variant">
        <div className="flex justify-between items-center mb-4">
          <span className="font-mono text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">CLIMATE TELEMETRY</span>
          <Sun className="w-5 h-5 text-primary" />
        </div>
        <div className="flex items-end gap-3 mb-4">
          <span className="font-sans text-4xl font-bold leading-none">34°C</span>
          <div className="flex flex-col mb-0.5">
            <span className="font-sans text-xs font-bold">Clear Sky</span>
            <span className="font-mono text-[9px] text-on-surface-variant uppercase font-bold tracking-tight">HUMIDITY: 12%</span>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-1 h-12">
          {['14:00', '15:00', '16:00', '17:00'].map((time, i) => (
            <div 
              key={time}
              className={`border border-outline-variant rounded-sm flex flex-col items-center justify-center transition-all ${
                i === 2 ? 'bg-primary/10 border-primary/40' : 'bg-surface-variant/20'
              }`}
            >
              <span className={`text-[8px] font-mono font-bold uppercase ${i === 2 ? 'text-primary' : 'opacity-50'}`}>{time}</span>
              <span className={`font-mono text-[10px] font-bold ${i === 2 ? 'text-primary' : ''}`}>{34 - i}°</span>
            </div>
          ))}
        </div>
      </div>

      {/* Operations Section */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex border-b border-outline-variant bg-surface-low/60 backdrop-blur-sm">
          <button className="flex-1 py-3 font-mono text-[10px] font-bold uppercase tracking-wider border-b-2 border-primary text-primary">Assets</button>
          <button className="flex-1 py-3 font-mono text-[10px] font-bold uppercase tracking-wider text-on-surface-variant hover:bg-surface-variant/30">Predictions</button>
          <button className="flex-1 py-3 font-mono text-[10px] font-bold uppercase tracking-wider text-on-surface-variant hover:bg-surface-variant/30">Warnings</button>
        </div>
        
        <div className="p-4 flex-1 overflow-y-auto space-y-4 custom-scrollbar">
          <div className="font-mono text-[9px] font-bold text-on-surface-variant uppercase tracking-widest">DEPLOYED UNIT STATUS</div>
          <div className="space-y-1">
            {assets.map((asset) => (
              <motion.div 
                key={asset.id}
                whileHover={{ x: 5 }}
                className={`bg-surface/50 p-3 rounded-md flex items-center justify-between border border-outline-variant/30 ${asset.opacity ? 'opacity-70' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <asset.icon className="w-5 h-5 text-primary" />
                  <div>
                    <div className="font-sans text-[11px] font-bold">{asset.id}</div>
                    <div className="font-mono text-[8px] text-on-surface-variant font-bold">{asset.meta}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-mono text-[10px] font-bold uppercase tracking-tight ${asset.color}`}>{asset.status}</div>
                  {asset.progress > 0 && (
                    <div className="w-16 h-1 bg-surface-variant rounded-full mt-1.5 overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${asset.progress}%` }}
                        className={`h-full rounded-full ${asset.color.replace('text-', 'bg-')}`} 
                      />
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>

          <div className="pt-2">
            <div className="bg-surface-highest/10 border border-outline-variant/50 p-4 rounded-lg space-y-3 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-1 opacity-20 group-hover:opacity-40 transition-opacity">
                <Radar className="w-8 h-8 text-primary animate-pulse" />
              </div>
              <div className="font-mono text-[8px] font-bold text-on-surface-variant uppercase tracking-[0.2em] relative z-10">PREDICTION ENGINE</div>
              <div className="flex items-center justify-between relative z-10">
                <span className="font-sans text-[11px] font-medium">Crisis Escalation Risk</span>
                <span className="font-mono text-[11px] font-bold text-error">HIGH (82%)</span>
              </div>
              <div className="h-1 bg-surface-variant w-full rounded-full overflow-hidden relative z-10">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: "82%" }}
                  className="h-full bg-error rounded-full" 
                />
              </div>
              <p className="font-sans text-[10px] text-on-surface-variant italic leading-relaxed relative z-10">
                Pattern matching suggests similar historical events in Sector 4 led to cascading failures within 120 minutes.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

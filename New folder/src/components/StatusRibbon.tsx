import { motion } from "motion/react";
import { AlertTriangle, CircleStop } from "lucide-react";

export default function StatusRibbon() {
  return (
    <div className="h-14 bg-surface-lowest border-b border-outline-variant flex items-center px-6 gap-4">
      <div className="flex items-center gap-6 border-r border-outline-variant pr-6 shrink-0">
        <div className="flex flex-col">
          <span className="font-mono text-[8px] font-bold text-on-surface-variant uppercase tracking-wider">INTERCEPT RATE</span>
          <span className="font-mono text-primary text-sm font-bold">12 <span className="text-[10px] font-normal opacity-70">Intercepts/Min</span></span>
        </div>
        <div className="flex flex-col">
          <span className="font-mono text-[8px] font-bold text-on-surface-variant uppercase tracking-wider">ASSET LOAD</span>
          <span className="font-mono text-tertiary text-sm font-bold">8/10 <span className="text-[10px] font-normal opacity-70">Assets Dispatched</span></span>
        </div>
      </div>

      <div className="flex-1 flex items-center gap-4 px-4 overflow-hidden">
        <span className="font-mono text-[8px] font-bold text-on-surface-variant uppercase tracking-wider whitespace-nowrap">SYSTEM LOAD</span>
        <div className="w-48 h-1.5 bg-surface-variant rounded-full overflow-hidden shrink-0">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: "68%" }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className="h-full bg-primary-container"
          />
        </div>
        
        <div className="flex-1 flex items-center gap-4 bg-error-container/10 px-4 py-1.5 border border-error/20 rounded-md overflow-hidden">
          <AlertTriangle className="w-4 h-4 text-error shrink-0" />
          <div className="flex-1 whitespace-nowrap overflow-hidden">
            <motion.div 
              animate={{ x: ["100%", "-100%"] }}
              transition={{ repeat: Infinity, duration: 25, ease: "linear" }}
              className="font-mono text-error text-[10px] uppercase tracking-widest font-bold"
            >
              High risk of road blockages detected in sector 7G • Traffic anomalies reported near industrial complex • Atmospheric interference rising • Critical node status check required • 
            </motion.div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 pl-6 border-l border-outline-variant shrink-0">
        <button className="bg-surface-variant/50 border border-outline-variant px-3 py-1.5 rounded font-mono text-[10px] font-bold flex items-center gap-2 text-on-surface hover:bg-surface-variant transition-colors">
          <CircleStop className="w-3 h-3" />
          STOP AUTO (24S)
        </button>
        <div className="flex gap-1">
          <span className="px-2 py-1 bg-error/20 text-error border border-error/30 rounded font-mono text-[9px] font-bold tracking-tighter">12 CRITICAL</span>
          <span className="px-2 py-1 bg-tertiary/20 text-tertiary border border-tertiary/30 rounded font-mono text-[9px] font-bold tracking-tighter">48 HIGH</span>
        </div>
      </div>
    </div>
  );
}

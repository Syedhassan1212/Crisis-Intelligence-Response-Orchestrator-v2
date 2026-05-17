import { motion } from "motion/react";
import { Plus, Minus, Locate } from "lucide-react";

export default function MapPanel() {
  return (
    <section className="flex-1 relative flex flex-col overflow-hidden">
      <div className="absolute inset-0 z-0 bg-surface-lowest">
        <div 
          className="w-full h-full opacity-30 mix-blend-screen grayscale scale-110"
          style={{ 
            backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuDxvjKhPk_0bFPuXibhGdhPTRkAfQlLYqkNpdHxW8kOhsoZaNzPLqYnJnhmeUQXQB4V1vadEbcNxaNqcUQA4HtjiAM2hYH1T3q9j51fNU0aoSB5mMMJtVr7uOogHsCRwyYBMKFIjb_qM27UMxw0YLRMbYfuWSea0JNMZODrKwH08U1JN8vgJDwyRbF877X5th6uUvWv9dYaJgx5IaEAAUsC1e0UfBtNHIvQvcGKUs4Ffq4L-wgNI92YiDx2ekaO9q55l9fO49inMdlG')", 
            backgroundSize: 'cover', 
            backgroundPosition: 'center' 
          }}
        />
        
        {/* Heatmap/Grid effect overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(rgba(173,198,255,0.05)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
        
        {/* Active Indicators */}
        <div className="absolute top-1/4 left-1/3 flex flex-col items-center">
          <motion.div 
            animate={{ y: [0, -10, 0] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="text-2xl mb-1 filter drop-shadow(0 0 10px rgba(255,180,171,0.5))"
          >
            🔥
          </motion.div>
          <div className="w-2.5 h-2.5 rounded-full bg-error ring-4 ring-error/20" />
          <div className="mt-2 bg-surface-highest/80 backdrop-blur-sm px-2 py-1 rounded border border-error/50 text-[9px] font-mono font-bold tracking-tight shadow-lg">EVENT_FIRE_402</div>
        </div>

        <div className="absolute bottom-1/3 right-1/4 flex flex-col items-center">
          <motion.div 
            animate={{ y: [0, -10, 0] }}
            transition={{ repeat: Infinity, duration: 2, delay: 0.5 }}
            className="text-2xl mb-1 filter drop-shadow(0 0 10px rgba(255,183,134,0.5))"
          >
            🚗
          </motion.div>
          <div className="w-2.5 h-2.5 rounded-full bg-tertiary ring-4 ring-tertiary/20" />
          <div className="mt-2 bg-surface-highest/80 backdrop-blur-sm px-2 py-1 rounded border border-tertiary/50 text-[9px] font-mono font-bold tracking-tight shadow-lg">TRAFFIC_JAM_09</div>
        </div>

        <div className="absolute top-1/2 right-1/2 group cursor-pointer">
          <div className="w-5 h-5 rounded-full border-2 border-primary bg-primary/20 flex items-center justify-center animate-pulse">
            <div className="w-2 h-2 rounded-full bg-primary" />
          </div>
          <motion.div 
            initial={{ opacity: 0, y: 5 }}
            whileHover={{ opacity: 1, y: -5 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-primary/90 text-on-primary px-2 py-1 rounded text-[8px] font-mono font-bold whitespace-nowrap"
          >
            ASSET_SIG_LIMA
          </motion.div>
        </div>
      </div>

      {/* UI Overlays */}
      <div className="relative z-10 flex flex-col h-full pointer-events-none p-4">
        <div className="flex justify-between items-start">
          <div className="pointer-events-auto flex flex-col gap-2">
            <div className="glass-panel p-1 rounded-md flex flex-col gap-1">
              <button className="w-8 h-8 bg-surface rounded border border-outline-variant flex items-center justify-center hover:bg-surface-variant transition-colors group">
                <Plus className="w-4 h-4 text-on-surface-variant group-hover:text-primary" />
              </button>
              <button className="w-8 h-8 bg-surface rounded border border-outline-variant flex items-center justify-center hover:bg-surface-variant transition-colors group">
                <Minus className="w-4 h-4 text-on-surface-variant group-hover:text-primary" />
              </button>
            </div>
            <button className="pointer-events-auto w-8 h-8 glass-panel rounded-md flex items-center justify-center hover:bg-surface-variant transition-colors group">
              <Locate className="w-4 h-4 text-on-surface-variant group-hover:text-primary" />
            </button>
          </div>
          
          <div className="pointer-events-auto glass-panel p-1 rounded-lg flex gap-1 bg-surface-lowest/40">
            <button className="px-4 py-1.5 bg-primary text-on-primary font-mono text-[10px] font-bold rounded uppercase tracking-wider">Decision Logs</button>
            <button className="px-4 py-1.5 hover:bg-surface-variant/50 text-on-surface-variant font-mono text-[10px] font-bold rounded transition-colors uppercase tracking-wider">AI Traces</button>
          </div>
        </div>

        <div className="mt-auto flex justify-between items-end">
          <div className="pointer-events-auto glass-panel p-4 rounded-lg w-64 space-y-3 bg-surface-lowest/40">
            <div className="flex justify-between items-center border-b border-outline-variant/30 pb-2">
              <span className="font-mono text-[9px] font-bold uppercase tracking-wider">COORDINATE MESH</span>
              <span className="font-mono text-[9px] text-on-surface-variant">REF: 002-X</span>
            </div>
            <div className="space-y-1 font-mono text-[10px]">
              <div className="flex justify-between">
                <span className="text-on-surface-variant opacity-70">LAT:</span>
                <span className="font-bold">41.8781° N</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant opacity-70">LONG:</span>
                <span className="font-bold">87.6298° W</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant opacity-70">ELEV:</span>
                <span className="font-bold">179m</span>
              </div>
            </div>
          </div>

          <div className="pointer-events-auto flex gap-2">
            <div className="glass-panel px-4 py-2 rounded-full font-mono text-[10px] font-bold flex items-center gap-2 bg-surface-lowest/40">
              <div className="w-1.5 h-1.5 rounded-full bg-error animate-pulse" />
              CRISIS: 04
            </div>
            <div className="glass-panel px-4 py-2 rounded-full font-mono text-[10px] font-bold flex items-center gap-2 bg-surface-lowest/40">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              ASSETS: 12
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

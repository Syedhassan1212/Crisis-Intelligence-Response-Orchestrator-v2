import { motion } from "motion/react";
import { 
  Radar, 
  Rocket, 
  Crosshair, 
  Wind, 
  Settings as SettingsIcon, 
  Terminal, 
  HelpCircle, 
  History 
} from "lucide-react";

const navItems = [
  { id: 'signals', label: 'Signals', icon: Radar, active: true },
  { id: 'tactical', label: 'Tactical', icon: Crosshair },
  { id: 'climate', label: 'Climate', icon: Wind },
  { id: 'ops', label: 'Ops', icon: SettingsIcon },
  { id: 'system', label: 'System', icon: Terminal },
];

export default function SideNav() {
  return (
    <aside className="fixed left-0 top-16 bottom-0 w-64 bg-surface-low/20 backdrop-blur-md border-r border-outline-variant flex flex-col h-full py-4 z-40">
      <div className="px-3 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded bg-primary-container/20 flex items-center justify-center border border-primary/30">
            <Radar className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="font-sans text-primary text-sm font-bold uppercase tracking-tight">NODE ALPHA</div>
            <div className="font-mono text-[10px] text-on-surface-variant font-bold">V.2.4.9 ACTIVE</div>
          </div>
        </div>
        <button className="w-full bg-primary-container text-on-primary-container font-mono text-[10px] font-bold py-3 rounded-lg hover:brightness-110 transition-all flex items-center justify-center gap-2">
          <Rocket className="w-4 h-4" />
          DEPLOY ASSET
        </button>
      </div>

      <nav className="flex-1 px-2 space-y-1">
        {navItems.map((item) => (
          <div 
            key={item.id}
            className={`flex items-center gap-3 px-3 py-3 transition-all duration-150 ease-in-out cursor-pointer group ${
              item.active 
                ? 'bg-primary-container/10 text-primary border-r-2 border-primary' 
                : 'text-on-surface-variant hover:bg-surface-variant/30'
            }`}
          >
            <item.icon className={`w-5 h-5 ${item.active ? 'text-primary' : 'text-on-surface-variant group-hover:text-primary'}`} />
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider">{item.label}</span>
          </div>
        ))}
      </nav>

      <div className="px-2 mt-auto pt-4 border-t border-outline-variant">
        <div className="flex items-center gap-3 px-3 py-2 text-on-surface-variant hover:bg-surface-variant/30 transition-all duration-150 ease-in-out cursor-pointer group">
          <HelpCircle className="w-5 h-5 group-hover:text-primary" />
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider">Help</span>
        </div>
        <div className="flex items-center gap-3 px-3 py-2 text-on-surface-variant hover:bg-surface-variant/30 transition-all duration-150 ease-in-out cursor-pointer group">
          <History className="w-5 h-5 group-hover:text-primary" />
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider">Logs</span>
        </div>
      </div>
    </aside>
  );
}

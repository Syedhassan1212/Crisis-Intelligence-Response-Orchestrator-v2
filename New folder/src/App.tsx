import TopNav from './components/TopNav';
import SideNav from './components/SideNav';
import StatusRibbon from './components/StatusRibbon';
import SignalPanel from './components/SignalPanel';
import MapPanel from './components/MapPanel';
import StatusPanel from './components/StatusPanel';

export default function App() {
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* Visual background element */}
      <div className="scan-line" />
      
      <TopNav />
      
      <div className="flex flex-1 pt-16 overflow-hidden">
        <SideNav />
        
        <main className="flex-1 ml-64 flex flex-col h-full overflow-hidden">
          <StatusRibbon />
          
          <div className="flex-1 flex overflow-hidden">
            <SignalPanel />
            <MapPanel />
            <StatusPanel />
          </div>
        </main>
      </div>

      <footer className="fixed bottom-0 w-full h-8 bg-surface-lowest border-t border-outline-variant flex items-center justify-between px-6 text-[9px] uppercase tracking-widest font-mono text-secondary z-50">
        <span className="font-bold text-tertiary">
          © 2026 CIRO GLOBAL OPERATIONS - ENCRYPTED CHANNEL
        </span>
        <div className="flex gap-6 font-bold">
          <span className="hover:text-on-surface cursor-pointer transition-colors">Privacy</span>
          <span className="hover:text-on-surface cursor-pointer transition-colors">Protocol</span>
          <span className="hover:text-on-surface cursor-pointer transition-colors text-primary border-b border-primary/50">Audit</span>
        </div>
      </footer>
    </div>
  );
}


import { Wifi, RefreshCw, Bell } from "lucide-react";

export default function TopNav() {
  return (
    <header className="fixed top-0 w-full z-50 bg-surface-container/95 backdrop-blur-md border-b border-outline-variant shadow-sm flex justify-between items-center px-4 h-16">
      <div className="flex items-center gap-4">
        <span className="text-xl font-sans font-bold text-primary tracking-tighter uppercase">CIRO COMMAND CENTER</span>
        <div className="h-6 w-px bg-outline-variant mx-2"></div>
        <nav className="flex gap-4">
          <span className="cursor-pointer active:scale-95 text-primary border-b-2 border-primary pb-1 font-mono text-xs font-medium">MAP</span>
          <span className="cursor-pointer active:scale-95 text-on-surface-variant font-mono text-xs font-medium hover:text-primary transition-colors duration-200">LOGS</span>
          <span className="cursor-pointer active:scale-95 text-on-surface-variant font-mono text-xs font-medium hover:text-primary transition-colors duration-200">TRACES</span>
          <span className="cursor-pointer active:scale-95 text-on-surface-variant font-mono text-xs font-medium hover:text-primary transition-colors duration-200">ASSETS</span>
        </nav>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 font-mono text-[10px] bg-surface-lowest px-3 py-1.5 rounded border border-outline-variant">
          <span className="text-on-surface-variant uppercase">Cycle #47</span>
          <span className="text-primary">•</span>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500 pulse-emerald"></div>
            <span className="text-emerald-400 uppercase tracking-tight font-bold">API Uplink Active</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Wifi className="w-5 h-5 text-on-surface-variant cursor-pointer hover:text-primary transition-colors" />
          <RefreshCw className="w-5 h-5 text-on-surface-variant cursor-pointer hover:text-primary transition-colors" />
          <div className="relative">
            <Bell className="w-5 h-5 text-primary cursor-pointer" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-error rounded-full"></span>
          </div>
        </div>

        <img 
          alt="System Administrator Avatar" 
          className="w-8 h-8 rounded-full border border-primary/30 object-cover"
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuBQNOvdI7JgmzUpDbRzB5l-lDd4weHaQ5yGXVRdjr1M5i6hXhqGtlYTmwK6hWo1kUElCDKuycCQNn9K75pDjSH7O8nMYCL7L2b8mY5xK35FI6zSFhY-fXgK43fDOEAk_nvqZVtyf2dw2KQV7lxxZWiWHW4fMSVdeJyi5nUDIlBPZHmcCMvOuHHFVTgXmzQJ5V0c_Nar3XI6_DBm-iLV0ZGNYQ0wXET2_X863s5UIigyLuzU6g4Z0tLHPL3KYzmJCEsC6hYlszpAZeLN"
        />
      </div>
    </header>
  );
}

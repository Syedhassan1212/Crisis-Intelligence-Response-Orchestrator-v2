import { motion } from "motion/react";

const feedData = [
  { id: 'CX-9902', status: 'LIVE', message: 'Multiple drone signatures detected over perimeter 4.', tags: ['SEC-7', 'ALT-200m'], type: 'error' },
  { id: 'VX-1120', status: 'PENDING', message: 'Visual confirmation of road obstruction on main artery.', tags: ['SEC-2', 'FIXED'], type: 'warning' },
  { id: 'ZX-0041', status: 'LOGGED', message: 'System handshake completed with remote node Delta.', tags: ['NODE-D'], type: 'neutral' },
];

export default function SignalPanel() {
  return (
    <section className="w-[24%] border-r border-outline-variant bg-surface-low/40 flex flex-col h-full overflow-hidden">
      <div className="flex border-b border-outline-variant">
        <button className="flex-1 py-3 font-mono text-[10px] font-bold uppercase tracking-wider border-b-2 border-primary text-primary">All Feeds</button>
        <button className="flex-1 py-3 font-mono text-[10px] font-bold uppercase tracking-wider text-on-surface-variant hover:bg-surface-variant/30">Reports</button>
        <button className="flex-1 py-3 font-mono text-[10px] font-bold uppercase tracking-wider text-on-surface-variant hover:bg-surface-variant/30">Incidents</button>
      </div>

      <div className="p-4 space-y-4 overflow-y-auto custom-scrollbar flex-1">
        <div className="grid grid-cols-2 gap-2">
          <div className="p-3 bg-surface rounded border border-outline-variant">
            <div className="font-mono text-[8px] font-bold text-on-surface-variant mb-1 uppercase">CITIZEN REPORTS</div>
            <div className="font-sans text-xl font-bold leading-tight">1,242</div>
          </div>
          <div className="p-3 bg-surface rounded border border-outline-variant">
            <div className="font-mono text-[8px] font-bold text-on-surface-variant mb-1 uppercase">VALIDATED TARGETS</div>
            <div className="font-sans text-xl font-bold leading-tight text-primary">89</div>
          </div>
        </div>

        <div className="p-3 bg-surface-highest/30 rounded border border-outline-variant">
          <div className="flex justify-between items-center mb-2">
            <span className="font-mono text-[8px] font-bold text-on-surface-variant uppercase">VERIFICATION LOAD</span>
            <span className="font-mono text-[10px] text-primary">92%</span>
          </div>
          <div className="flex gap-1 h-2.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <motion.div 
                key={i}
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ delay: i * 0.1 }}
                className={`flex-1 rounded-sm ${i <= 3 ? 'bg-primary' : i === 4 ? 'bg-primary/40' : 'bg-primary/10'}`} 
              />
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="font-mono text-[10px] font-bold text-on-surface-variant pb-2 border-b border-outline-variant uppercase">ACTIVE INTERCEPTIONS</div>
          
          {feedData.map((item, index) => (
            <motion.div 
              key={item.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1 - (index * 0.2), x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="glass-panel p-3 rounded-md space-y-2 group cursor-pointer hover:border-primary/50 hover:bg-surface-highest/20 transition-all"
            >
              <div className="flex justify-between items-start">
                <span className="font-mono text-[10px] font-bold text-primary">ID: {item.id}</span>
                <span className={`px-1.5 py-0.5 rounded font-mono text-[8px] font-bold border uppercase ${
                  item.type === 'error' ? 'bg-error/10 text-error border-error/20' : 
                  item.type === 'warning' ? 'bg-tertiary/10 text-tertiary border-tertiary/20' : 
                  'bg-secondary-container text-on-surface border-outline-variant'
                }`}>
                  {item.status}
                </span>
              </div>
              <div className="font-sans text-sm text-on-surface leading-snug">
                {item.message}
              </div>
              <div className="flex gap-2">
                {item.tags.map(tag => (
                  <span key={tag} className="bg-surface-variant px-2 py-0.5 rounded font-mono text-[9px] text-on-surface-variant uppercase font-bold">
                    {tag}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

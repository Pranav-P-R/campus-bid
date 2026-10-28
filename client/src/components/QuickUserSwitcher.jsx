import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Users, CheckCircle2, Shield } from 'lucide-react';

export default function QuickUserSwitcher() {
  const { user, demoUsers, switchUser } = useAuth();

  if (!demoUsers || demoUsers.length === 0) return null;

  return (
    <div className="bg-slate-900/90 border-b border-slate-800 text-xs py-1.5 px-4">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-slate-400 font-medium">
          <Users className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden sm:inline">Hackathon Demo Switcher:</span>
          <span className="text-slate-500">Test multi-student bidding & handover</span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto py-0.5">
          {demoUsers.map((u) => {
            const isCurrent = user?.id === u.id;
            return (
              <button
                key={u.id}
                onClick={() => switchUser(u.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                  isCurrent
                    ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm ring-2 ring-amber-400/50 scale-105'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700/60'
                }`}
                title={`Switch session to ${u.full_name} (${u.email})`}
              >
                <span>{u.display_name}</span>
                {u.is_admin ? (
                  <Shield className="w-3 h-3 text-emerald-400" />
                ) : (
                  <span className="text-[10px] opacity-75 font-mono">
                    {u.display_name.startsWith('Priya') ? 'Seller' : 'Buyer'}
                  </span>
                )}
                {isCurrent && <CheckCircle2 className="w-3 h-3" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}


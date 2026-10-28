import React from 'react';
import { ArrowRight, Gavel, ShieldCheck, Users, Zap } from 'lucide-react';

export default function LandingPage({ onLogin, onRegister, onBrowse }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800/80">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center"><Gavel /></div>
            <div><strong className="text-xl">Campus<span className="text-amber-400">Bid</span></strong><p className="text-[10px] text-slate-500">The campus marketplace</p></div>
          </div>
          <div className="flex gap-2">
            <button onClick={onLogin} className="px-4 py-2 text-sm text-slate-300 hover:text-white">Sign in</button>
            <button onClick={onRegister} className="px-4 py-2 rounded-lg bg-amber-500 text-slate-950 font-bold text-sm">Join CampusBid</button>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-20 grid lg:grid-cols-2 gap-14 items-center">
        <section>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold"><Zap className="w-4 h-4" /> Built for student-to-student trade</div>
          <h1 className="mt-6 text-5xl sm:text-6xl font-black leading-[1.05]">Buy smarter.<br /><span className="text-amber-400">Sell fairly.</span></h1>
          <p className="mt-6 text-lg text-slate-400 leading-relaxed">A trusted campus auction marketplace for cycles, books, electronics and hostel essentials. Bid in real time, meet safely and keep every deal on campus.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button onClick={onRegister} className="px-6 py-3 rounded-xl bg-amber-500 text-slate-950 font-bold flex items-center gap-2">Create free account <ArrowRight className="w-4 h-4" /></button>
            <button onClick={onBrowse} className="px-6 py-3 rounded-xl border border-slate-700 text-white font-semibold hover:bg-slate-900">Explore listings</button>
          </div>
        </section>
        <section className="grid gap-4">
          {[
            [ShieldCheck, 'Campus-verified community', 'Trade with verified students and transparent seller profiles.'],
            [Gavel, 'Fair live bidding', 'Real-time bids, proxy bidding and anti-sniping protection.'],
            [Users, 'Safe handover', 'Both buyer and seller confirm the in-person handover.']
          ].map(([Icon, title, text]) => <div key={title} className="p-6 rounded-2xl bg-slate-900 border border-slate-800"><Icon className="text-amber-400 w-7 h-7" /><h2 className="mt-4 font-bold text-lg">{title}</h2><p className="mt-2 text-sm text-slate-400">{text}</p></div>)}
        </section>
      </main>
      <div className="max-w-6xl mx-auto px-6 pb-12 text-xs text-slate-600">CampusBid is exclusively for campus communities.</div>
    </div>
  );
}

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import confetti from 'canvas-confetti';
import { Gavel, Bot, ShieldAlert, ArrowUpRight, CheckCircle2, X } from 'lucide-react';

export default function BidModal({ auction, onClose, onBidSuccess, existingAutoBid }) {
  const { token, user } = useAuth();
  const [activeTab, setActiveTab] = useState('manual'); // 'manual' or 'auto'

  const currentPrice = auction.current_price !== null ? parseFloat(auction.current_price) : null;
  const startingPrice = parseFloat(auction.starting_price);
  const minIncrement = parseFloat(auction.min_bid_increment);

  const minRequired = currentPrice !== null ? currentPrice + minIncrement : startingPrice;

  const [manualAmount, setManualAmount] = useState(minRequired.toString());
  const [autoAmount, setAutoAmount] = useState(
    existingAutoBid?.maximum_amount ? existingAutoBid.maximum_amount.toString() : (minRequired + minIncrement * 2).toString()
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleManualBid = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    const val = parseFloat(manualAmount);
    if (isNaN(val) || val < minRequired) {
      setError(`Bid must be at least ₹${minRequired.toFixed(2)}.`);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/auctions/${auction.id}/bids`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ amount: val })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to place bid');
      }

      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 }
      });

      setSuccessMsg(data.message || 'Bid placed successfully!');
      setTimeout(() => {
        onBidSuccess(data);
        onClose();
      }, 1200);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAutoBid = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    const val = parseFloat(autoAmount);
    if (isNaN(val) || val < minRequired) {
      setError(`Automatic limit ceiling must be at least ₹${minRequired.toFixed(2)}.`);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/auctions/${auction.id}/auto-bid`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ maximumAmount: val })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to configure auto-bid');
      }

      setSuccessMsg(data.message);
      setTimeout(() => {
        onBidSuccess();
        onClose();
      }, 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelAutoBid = async () => {
    try {
      setLoading(true);
      await fetch(`/api/auctions/${auction.id}/auto-bid`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuccessMsg('Automatic proxy bidding deactivated.');
      setTimeout(() => {
        onBidSuccess();
        onClose();
      }, 1000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-4 bg-slate-800/60 border-b border-slate-700/60 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-white text-base">Place Your Bid</h3>
            <p className="text-xs text-slate-400 truncate max-w-[280px]">{auction.title}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-slate-800 bg-slate-950/40">
          <button
            onClick={() => { setActiveTab('manual'); setError(''); }}
            className={`flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border-b-2 ${
              activeTab === 'manual'
                ? 'border-amber-400 text-amber-400 bg-amber-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Gavel className="w-3.5 h-3.5" />
            Manual Bid
          </button>
          <button
            onClick={() => { setActiveTab('auto'); setError(''); }}
            className={`flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border-b-2 ${
              activeTab === 'auto'
                ? 'border-sky-400 text-sky-400 bg-sky-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            Automatic Proxy Bid
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs leading-relaxed flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs leading-relaxed flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Pricing Overview */}
          <div className="grid grid-cols-2 gap-2 mb-4 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <div>
              <span className="text-[11px] text-slate-400 block font-medium">
                {currentPrice !== null ? 'Current Leading Bid' : 'Starting Price'}
              </span>
              <span className="text-lg font-mono font-bold text-white">
                ₹{(currentPrice !== null ? currentPrice : startingPrice).toFixed(2)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-amber-400/90 block font-medium">
                Minimum Next Bid
              </span>
              <span className="text-lg font-mono font-bold text-amber-400">
                ₹{minRequired.toFixed(2)}
              </span>
            </div>
          </div>

          {activeTab === 'manual' ? (
            <form onSubmit={handleManualBid} className="space-y-4">
              {/* Quick increment buttons */}
              <div>
                <label className="text-xs text-slate-400 block mb-1.5 font-medium">
                  Quick increment presets:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[minRequired, minRequired + minIncrement, minRequired + minIncrement * 2].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setManualAmount(val.toString())}
                      className={`py-1.5 px-2 rounded-lg text-xs font-mono font-semibold transition-all border ${
                        parseFloat(manualAmount) === val
                          ? 'bg-amber-500 text-slate-950 border-amber-400'
                          : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      ₹{val.toFixed(0)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Input */}
              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">
                  Your Bid Amount (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-mono text-sm">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min={minRequired}
                    value={manualAmount}
                    onChange={(e) => setManualAmount(e.target.value)}
                    required
                    className="w-full pl-8 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-base font-bold focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Minimum increment required: +₹{minIncrement.toFixed(2)}
                </p>
              </div>

              {/* Anti-sniping reminder */}
              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300/90 leading-tight">
                ⚡ <span className="font-semibold">Anti-Sniping Rule:</span> Bids placed in the final 30 seconds automatically extend the deadline by 60s so all viewers get a fair chance to react.
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 hover:from-amber-400 hover:to-amber-300 transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50"
              >
                {loading ? 'Submitting Bid...' : `Confirm & Place Bid (₹${parseFloat(manualAmount || minRequired).toFixed(2)})`}
              </button>
            </form>
          ) : (
            <form onSubmit={handleAutoBid} className="space-y-4">
              <div className="p-3 rounded-xl bg-sky-950/40 border border-sky-800/40 text-xs text-sky-200 leading-relaxed">
                <span className="font-semibold block mb-1">How proxy bidding works:</span>
                Enter the highest amount you are willing to pay. The system will incrementally counter competitors by ₹{minIncrement.toFixed(2)} only when you are outbid, stopping at your maximum ceiling.
              </div>

              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">
                  Maximum Bid Ceiling (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-mono text-sm">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min={minRequired}
                    value={autoAmount}
                    onChange={(e) => setAutoAmount(e.target.value)}
                    required
                    className="w-full pl-8 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-base font-bold focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
                  />
                </div>
              </div>

              {existingAutoBid && existingAutoBid.is_active && (
                <div className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-slate-800 border border-slate-700">
                  <span className="text-slate-300">
                    Active limit: <strong className="text-sky-300">₹{parseFloat(existingAutoBid.maximum_amount).toFixed(2)}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={handleCancelAutoBid}
                    className="text-rose-400 hover:text-rose-300 text-xs font-semibold"
                  >
                    Cancel proxy
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-sky-500 to-sky-400 text-slate-950 hover:from-sky-400 hover:to-sky-300 transition-all shadow-lg shadow-sky-500/20 disabled:opacity-50"
              >
                {loading ? 'Activating Proxy...' : `Set Auto-Bid Limit (₹${parseFloat(autoAmount || minRequired).toFixed(2)})`}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}


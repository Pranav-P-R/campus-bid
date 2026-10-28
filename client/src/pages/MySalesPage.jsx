import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import confetti from 'canvas-confetti';
import {
  ShoppingBag,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Send,
  ThumbsUp,
  ThumbsDown,
  UserCheck,
  ShieldCheck,
  MapPin
} from 'lucide-react';

export default function MySalesPage({ onSelectAuction }) {
  const { user, token } = useAuth();
  const { socket } = useSocket();

  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState('all'); // 'all', 'seller', 'buyer'

  // Decision state
  const [processingId, setProcessingId] = useState(null);
  const [handoverNote, setHandoverNote] = useState({});

  const fetchSales = () => {
    setLoading(true);
    const url = filterRole === 'all' ? '/api/sales' : `/api/sales?role=${filterRole}`;
    fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.sales) setSales(data.sales);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    if (token) fetchSales();
  }, [token, filterRole]);

  // Socket updates
  useEffect(() => {
    if (!socket) return;

    const handleSaleStatusUpdate = () => {
      fetchSales();
    };

    socket.on('sale_status_updated', handleSaleStatusUpdate);
    return () => {
      socket.off('sale_status_updated', handleSaleStatusUpdate);
    };
  }, [socket]);

  // Seller approves or rejects
  const handleSellerDecision = async (saleId, decision) => {
    try {
      setProcessingId(saleId);
      const res = await fetch(`/api/sales/${saleId}/decision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ decision })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (decision === 'approve') {
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
      }

      fetchSales();
    } catch (err) {
      alert(err.message);
    } finally {
      setProcessingId(null);
    }
  };

  // Handover confirmation
  const handleConfirmHandover = async (saleId) => {
    try {
      setProcessingId(saleId);
      const note = handoverNote[saleId] || 'Met at campus, item inspected and transferred.';
      const res = await fetch(`/api/sales/${saleId}/handover-confirmations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ note })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (data.isCompleted) {
        confetti({ particleCount: 100, spread: 80, origin: { y: 0.5 } });
      }

      fetchSales();
    } catch (err) {
      alert(err.message);
    } finally {
      setProcessingId(null);
    }
  };

  // Pickup failure
  const handleFailPickup = async (saleId) => {
    const reason = prompt('Please specify why handover failed (e.g. no-show, item condition dispute):');
    if (!reason) return;

    try {
      setProcessingId(saleId);
      const res = await fetch(`/api/sales/${saleId}/fail-pickup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ reason })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      fetchSales();
    } catch (err) {
      alert(err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending_seller_approval':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            ⏳ Pending Seller Approval
          </span>
        );
      case 'reserved':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
            📦 Reserved • Awaiting Handover
          </span>
        );
      case 'completed':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            ✅ Transaction Completed
          </span>
        );
      case 'rejected':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
            ❌ Price Rejected by Seller
          </span>
        );
      case 'pickup_failed':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
            ⚠️ Pickup Failed
          </span>
        );
      case 'unsold':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700">
            Ended Unsold
          </span>
        );
      case 'cancelled':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700">
            Cancelled
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 pb-20 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
          Post-Auction Sales & Handover Lifecycle
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Review closing bids, approve transactions, coordinate campus meetup, and dual-confirm in-person handover.
        </p>
      </div>

      {/* Role Tabs */}
      <div className="flex border-b border-slate-800 gap-4">
        {[
          { id: 'all', label: 'All Transactions' },
          { id: 'seller', label: 'Items I am Selling' },
          { id: 'buyer', label: 'Auctions I Won' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterRole(tab.id)}
            className={`pb-3 text-xs sm:text-sm font-bold border-b-2 transition-colors ${
              filterRole === tab.id
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-500 text-sm">Loading sale records...</div>
      ) : sales.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/40 rounded-3xl border border-slate-800">
          <ShoppingBag className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white">No transactions found</h3>
          <p className="text-xs text-slate-400 mt-1">
            When your auctions close or you win an item, the sale confirmation lifecycle will appear here!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {sales.map((sale) => {
            const isSeller = user?.id === sale.seller_id;
            const isBuyer = user?.id === sale.buyer_id;

            return (
              <div
                key={sale.id}
                className="p-5 sm:p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-lg space-y-4"
              >
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <img
                      src={sale.primary_image || 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=200&q=80'}
                      alt={sale.auction_title}
                      className="w-14 h-14 rounded-xl object-cover shrink-0 bg-slate-800"
                    />
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                        {isSeller ? 'You are the Seller' : 'You are the Buyer'}
                      </span>
                      <h3
                        onClick={() => onSelectAuction(sale.auction_id)}
                        className="font-bold text-white text-base hover:text-amber-400 transition-colors cursor-pointer"
                      >
                        {sale.auction_title}
                      </h3>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {isSeller ? `Winning Buyer: ${sale.buyer_name || 'None'}` : `Seller: ${sale.seller_name}`}
                      </div>
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-end justify-between sm:justify-center gap-1">
                    {getStatusBadge(sale.status)}
                    {sale.final_price && (
                      <span className="text-xl font-mono font-extrabold text-amber-400">
                        ₹{parseFloat(sale.final_price).toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Status-specific action controls */}

                {/* 1. Pending Seller Approval */}
                {sale.status === 'pending_seller_approval' && (
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-xs text-amber-200">
                      {isSeller ? (
                        <>
                          <strong className="block text-sm text-amber-300 font-bold mb-1">
                            Decision Required: Approve winning price of ₹{parseFloat(sale.final_price).toFixed(2)}?
                          </strong>
                          As seller, you have the final authority to accept the winning price or reject it before arranging campus pickup.
                        </>
                      ) : (
                        <>
                          <strong className="block text-sm text-amber-300 font-bold mb-1">
                            Awaiting Seller Decision
                          </strong>
                          Congratulations on having the leading bid! The seller is reviewing the final price. You will receive an instant notification once approved.
                        </>
                      )}
                    </div>

                    {isSeller && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleSellerDecision(sale.id, 'reject')}
                          disabled={processingId === sale.id}
                          className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-rose-300 hover:bg-rose-950/40 border border-rose-800/40 transition-colors"
                        >
                          Reject Price
                        </button>
                        <button
                          onClick={() => handleSellerDecision(sale.id, 'approve')}
                          disabled={processingId === sale.id}
                          className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors shadow-md"
                        >
                          Approve Sale & Reserve
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* 2. Reserved - Meetup & Handover Confirmation */}
                {sale.status === 'reserved' && (
                  <div className="p-4 rounded-2xl bg-sky-950/40 border border-sky-800/50 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2 text-sky-300 font-bold text-xs">
                        <MapPin className="w-4 h-4" />
                        <span>Meetup & Physical Handover Stage</span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {sale.confirmation_count}/2 Confirmations Recorded
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">
                      Item is reserved! Meet your classmate at a safe campus area (e.g. Hostel entrance, Central Library, or Student Center) to inspect the item. Once physically transferred, both parties submit handover confirmation below to close the sale.
                    </p>

                    {/* Dual confirmation tracker */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-sky-900/60">
                      <div className="flex items-center gap-2 text-xs">
                        {sale.has_confirmed ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-bold">
                            <CheckCircle2 className="w-4 h-4" /> Your confirmation is submitted
                          </span>
                        ) : (
                          <span className="text-amber-300 font-medium">
                            Awaiting your handover confirmation
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {!sale.has_confirmed ? (
                          <button
                            onClick={() => handleConfirmHandover(sale.id)}
                            disabled={processingId === sale.id}
                            className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-emerald-400 text-slate-950 font-bold text-xs rounded-xl hover:from-emerald-400 hover:to-emerald-300 transition-all shadow-md active:scale-95"
                          >
                            Confirm Physical Handover
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400 italic">
                            Waiting for the other student to confirm...
                          </span>
                        )}

                        <button
                          onClick={() => handleFailPickup(sale.id)}
                          className="px-2.5 py-2 text-xs text-rose-400 hover:bg-rose-950/30 rounded-xl"
                          title="Report meetup failure"
                        >
                          Report Issue
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. Completed */}
                {sale.status === 'completed' && (
                  <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-800/40 text-xs text-emerald-300 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                      <span>
                        Both students verified physical handover. Transaction concluded successfully!
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-emerald-400/80">
                      Completed on {new Date(sale.completed_at || sale.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                )}

                {/* 4. Failure notes */}
                {sale.failure_reason && (
                  <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-800/30 text-xs text-rose-300">
                    Reason: {sale.failure_reason}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


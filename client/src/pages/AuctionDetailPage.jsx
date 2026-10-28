import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import CountdownTimer from '../components/CountdownTimer';
import BidModal from '../components/BidModal';
import {
  ArrowLeft,
  Gavel,
  Clock,
  User,
  CheckCircle2,
  Share2,
  ShieldAlert,
  Bot,
  MessageSquare,
  History,
  FileText,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Send,
  Sparkles
} from 'lucide-react';

export default function AuctionDetailPage({ auctionId, onBack, onOpenAuth, onOpenAssistant }) {
  const { user, token } = useAuth();
  const { socket } = useSocket();

  const [auction, setAuction] = useState(null);
  const [bids, setBids] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [sale, setSale] = useState(null);
  const [myAutoBid, setMyAutoBid] = useState(null);
  const [selectedImage, setSelectedImage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('bids'); // 'bids', 'qa', 'details'

  // Modal controls
  const [showBidModal, setShowBidModal] = useState(false);
  const [questionInput, setQuestionInput] = useState('');
  const [answeringQId, setAnsweringQId] = useState(null);
  const [answerInput, setAnswerInput] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // Anti-sniping notification banner
  const [extendedAlert, setExtendedAlert] = useState(false);

  const fetchAuctionDetails = () => {
    fetch(`/api/auctions/${auctionId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.auction) {
          setAuction(data.auction);
          setBids(data.bids || []);
          setQuestions(data.questions || []);
          setSale(data.sale || null);
          setMyAutoBid(data.myAutoBid || null);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchAuctionDetails();
  }, [auctionId, token]);

  // Socket.IO room subscription
  useEffect(() => {
    if (!socket || !auctionId) return;

    socket.emit('join_auction', auctionId);

    const handleAuctionUpdate = (payload) => {
      setAuction((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          current_price: payload.current_price,
          current_high_bidder_id: payload.current_high_bidder_id,
          leading_bidder_name: payload.current_high_bidder_name,
          end_time: payload.end_time,
          bid_count: (prev.bid_count || 0) + 1
        };
      });

      if (payload.bid) {
        setBids((prev) => [payload.bid, ...prev]);
      }

      if (payload.wasExtended) {
        setExtendedAlert(true);
        setTimeout(() => setExtendedAlert(false), 8000);
      }
    };

    const handleAuctionClosed = (payload) => {
      setAuction((prev) => (prev ? { ...prev, status: 'closed' } : prev));
      fetchAuctionDetails();
    };

    const handleNewQuestion = (q) => {
      setQuestions((prev) => [q, ...prev]);
    };

    const handleQuestionAnswered = (updatedQ) => {
      setQuestions((prev) => prev.map((q) => (q.id === updatedQ.id ? updatedQ : q)));
    };

    socket.on('auction_update', handleAuctionUpdate);
    socket.on('auction_closed', handleAuctionClosed);
    socket.on('new_question', handleNewQuestion);
    socket.on('question_answered', handleQuestionAnswered);

    return () => {
      socket.emit('leave_auction', auctionId);
      socket.off('auction_update', handleAuctionUpdate);
      socket.off('auction_closed', handleAuctionClosed);
      socket.off('new_question', handleNewQuestion);
      socket.off('question_answered', handleQuestionAnswered);
    };
  }, [socket, auctionId]);

  const handlePostQuestion = async (e) => {
    e.preventDefault();
    if (!user) {
      onOpenAuth();
      return;
    }
    if (!questionInput.trim()) return;

    try {
      const res = await fetch(`/api/auctions/${auctionId}/questions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ questionText: questionInput.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        setQuestions((prev) => [data.question, ...prev]);
        setQuestionInput('');
      } else {
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePostAnswer = async (qId) => {
    if (!answerInput.trim()) return;

    try {
      const res = await fetch(`/api/auctions/${auctionId}/questions/${qId}/answer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ answerText: answerInput.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        setQuestions((prev) => prev.map((q) => (q.id === qId ? data.question : q)));
        setAnsweringQId(null);
        setAnswerInput('');
      } else {
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCancelAuction = async () => {
    if (!cancelReason.trim()) {
      alert('Please state a reason for cancelling this auction.');
      return;
    }

    try {
      const res = await fetch(`/api/auctions/${auctionId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ reason: cancelReason.trim() })
      });

      const data = await res.json();
      if (res.ok) {
        setShowCancelModal(false);
        fetchAuctionDetails();
      } else {
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-slate-400">
        <Clock className="w-8 h-8 animate-spin mx-auto mb-2 text-amber-400" />
        <p className="text-sm">Loading auction details...</p>
      </div>
    );
  }

  if (!auction) {
    return (
      <div className="py-20 text-center">
        <h2 className="text-xl font-bold text-white">Auction not found</h2>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 bg-slate-800 text-amber-400 font-semibold rounded-xl"
        >
          Return to Browse
        </button>
      </div>
    );
  }

  const images = Array.isArray(auction.images) && auction.images.length > 0 ? auction.images : [
    'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=800&q=80'
  ];

  const currentPrice = auction.current_price !== null ? parseFloat(auction.current_price) : parseFloat(auction.starting_price);
  const isStarted = auction.current_price !== null;
  const isClosed = auction.status === 'closed' || new Date(auction.end_time) <= new Date();
  const isCancelled = auction.status === 'cancelled';
  const isSeller = user && user.id === auction.seller_id;
  const isLeadingBidder = user && user.id === auction.current_high_bidder_id;
  const minRequiredNext = isStarted ? currentPrice + parseFloat(auction.min_bid_increment) : currentPrice;

  return (
    <div className="space-y-6 pb-20">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Auctions</span>
        </button>

        <div className="flex items-center gap-2">
          {isCancelled && (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
              Cancelled
            </span>
          )}
          {isClosed && !isCancelled && (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700">
              Auction Ended
            </span>
          )}
          {!isClosed && !isCancelled && (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse">
              ● Active Bidding
            </span>
          )}
        </div>
      </div>

      {/* Anti-Sniping Alert Banner */}
      {extendedAlert && (
        <div className="p-4 rounded-2xl bg-amber-500/20 border border-amber-500/50 text-amber-200 flex items-center gap-3 animate-bounce">
          <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
          <div className="text-xs">
            <span className="font-bold block text-sm">Anti-Sniping Deadline Extended! ⚡</span>
            A last-second bid was placed in the final 30s. The auction closing time has been automatically extended by 60 seconds to ensure fairness!
          </div>
        </div>
      )}

      {/* Main Grid: Images (Left) + Pricing Card (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Image Carousel */}
        <div className="lg:col-span-7 space-y-3">
          <div className="relative aspect-[4/3] rounded-3xl overflow-hidden bg-slate-900 border border-slate-800 shadow-xl">
            <img
              src={images[selectedImage]}
              alt={auction.title}
              className="w-full h-full object-cover object-center"
            />
            <div className="absolute top-4 left-4 flex flex-wrap gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-950/80 backdrop-blur-md text-amber-300 border border-amber-500/40">
                {auction.item_condition.toUpperCase().replace('_', ' ')}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-950/80 backdrop-blur-md text-slate-300 border border-slate-700">
                {auction.category_name}
              </span>
            </div>
          </div>

          {/* Thumbnails */}
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImage(idx)}
                  className={`w-16 h-16 rounded-xl overflow-hidden border-2 transition-all shrink-0 ${
                    selectedImage === idx ? 'border-amber-400 scale-105' : 'border-slate-800 opacity-60'
                  }`}
                >
                  <img src={img} alt="thumbnail" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* Seller Profile Card */}
          <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-400 font-bold">
                {auction.seller_display_name?.[0] || 'S'}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-white">{auction.seller_display_name}</span>
                  {auction.seller_verified && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" title="Verified Campus Student" />
                  )}
                </div>
                <span className="text-xs text-slate-400">Campus Student Seller</span>
              </div>
            </div>

            <button
              onClick={() => setActiveTab('qa')}
              className="text-xs font-semibold text-slate-300 hover:text-white px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors flex items-center gap-1"
            >
              <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
              Ask Seller
            </button>
          </div>
        </div>

        {/* Right Column: Bidding Console */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-5">
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-white leading-snug">
                {auction.title}
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Listed {new Date(auction.created_at).toLocaleDateString()}
              </p>
            </div>

            {/* Countdown timer */}
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-400 font-medium block">Time Remaining</span>
                <span className="text-xs text-slate-500 font-mono">Closing Time: {new Date(auction.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <CountdownTimer endTime={auction.end_time} onExpire={fetchAuctionDetails} />
            </div>

            {/* Price Snapshot */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-950 to-slate-900 border border-slate-800">
              <span className="text-xs text-slate-400 font-medium block">
                {isStarted ? 'Current Leading Bid' : 'Starting Price'}
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-black text-amber-400 font-mono tracking-tight">
                  ₹{currentPrice.toFixed(2)}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  (Min Increment: +₹{parseFloat(auction.min_bid_increment).toFixed(2)})
                </span>
              </div>

              {/* Status / Leading Bidder Banner */}
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                {isLeadingBidder ? (
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> You are the leading bidder!
                  </span>
                ) : auction.leading_bidder_name ? (
                  <span className="text-slate-300">
                    Leader: <strong className="text-amber-300">{auction.leading_bidder_name}</strong>
                  </span>
                ) : (
                  <span className="text-slate-400">No bids placed yet. Be the first!</span>
                )}

                <span className="font-semibold text-slate-400">
                  {auction.bid_count} {auction.bid_count === 1 ? 'bid' : 'bids'}
                </span>
              </div>
            </div>

            {/* Auto-Bid Status Card */}
            {myAutoBid && myAutoBid.is_active && (
              <div className="p-3 rounded-xl bg-sky-950/40 border border-sky-800/40 flex items-center justify-between text-xs">
                <div>
                  <span className="text-sky-300 font-semibold block flex items-center gap-1">
                    <Bot className="w-3.5 h-3.5" /> Auto-Bid Proxy Active
                  </span>
                  <span className="text-slate-400 text-[11px]">
                    Ceiling limit: ₹{parseFloat(myAutoBid.maximum_amount).toFixed(2)}
                  </span>
                </div>
                <button
                  onClick={() => setShowBidModal(true)}
                  className="text-sky-300 hover:underline font-semibold"
                >
                  Adjust
                </button>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2">
              {!isClosed && !isCancelled && (
                <>
                  {isSeller ? (
                    <div className="space-y-2">
                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                        This is your listing. Sellers cannot place bids on their own items.
                      </div>
                      <button
                        onClick={() => setShowCancelModal(true)}
                        className="w-full py-2.5 rounded-xl font-bold text-xs bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30 transition-colors"
                      >
                        Cancel Auction Listing
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          if (!user) onOpenAuth();
                          else setShowBidModal(true);
                        }}
                        className="py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 hover:from-amber-400 hover:to-amber-300 transition-all shadow-lg shadow-amber-500/20 active:scale-95 flex items-center justify-center gap-2"
                      >
                        <Gavel className="w-4 h-4 font-bold" />
                        <span>Place Bid (₹{minRequiredNext.toFixed(0)})</span>
                      </button>

                      <button
                        onClick={() => {
                          if (!user) onOpenAuth();
                          else setShowBidModal(true);
                        }}
                        className="py-3 px-4 rounded-xl font-semibold text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Bot className="w-4 h-4 text-sky-400" />
                        <span>Proxy Auto-Bid</span>
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* Closed status feedback */}
              {isClosed && (
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-2">
                  <h4 className="font-bold text-white text-sm">Auction Closed</h4>
                  {sale ? (
                    <div className="text-xs text-slate-400">
                      Outcome: <strong className="text-amber-400 capitalize">{sale.status.replace(/_/g, ' ')}</strong>
                      {sale.final_price && (
                        <span className="block mt-1 font-mono text-white text-sm font-bold">
                          Final Price: ₹{parseFloat(sale.final_price).toFixed(2)}
                        </span>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">The auction concluded without bids.</p>
                  )}
                </div>
              )}

              {/* AI Advisor Button */}
              <button
                onClick={() => onOpenAssistant(auction.id)}
                className="w-full py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-950/60 hover:bg-slate-800 border border-slate-800 transition-colors flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Ask AI Advisor for Bid Strategy on this Item</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs: Description, Bid History, Q&A */}
      <div className="border-t border-slate-800 pt-6">
        <div className="flex border-b border-slate-800 gap-6">
          <button
            onClick={() => setActiveTab('bids')}
            className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'bids'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-4 h-4" />
            Bid History ({bids.length})
          </button>

          <button
            onClick={() => setActiveTab('qa')}
            className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'qa'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            Questions & Answers ({questions.length})
          </button>

          <button
            onClick={() => setActiveTab('details')}
            className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'details'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            Item Details & Condition
          </button>
        </div>

        {/* Tab Content */}
        <div className="py-6">
          {activeTab === 'bids' && (
            <div className="space-y-3 max-w-2xl">
              <div className="flex items-center justify-between text-xs text-slate-400 font-semibold px-4 pb-2 border-b border-slate-800">
                <span>Student Bidder</span>
                <span>Bid Type</span>
                <span>Time Placed</span>
                <span className="text-right">Bid Amount</span>
              </div>

              {bids.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  No bids have been recorded yet. The starting price is ₹{parseFloat(auction.starting_price).toFixed(2)}.
                </div>
              ) : (
                bids.map((b, i) => (
                  <div
                    key={b.id || i}
                    className={`p-3.5 rounded-xl border flex items-center justify-between text-xs transition-colors ${
                      i === 0
                        ? 'bg-amber-500/10 border-amber-500/30 text-white font-semibold'
                        : 'bg-slate-900/60 border-slate-800/80 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-800 text-amber-400 font-bold flex items-center justify-center text-[10px]">
                        {b.bidder_display_name?.[0] || 'U'}
                      </div>
                      <span>{b.bidder_display_name}</span>
                      {b.is_my_bid && (
                        <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1 rounded">You</span>
                      )}
                      {i === 0 && (
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-bold">
                          Leading
                        </span>
                      )}
                    </div>

                    <span className="capitalize font-mono text-slate-400 text-[11px]">
                      {b.bid_type === 'automatic' ? '🤖 Auto' : 'Manual'}
                    </span>

                    <span className="text-slate-400 font-mono text-[11px]">
                      {new Date(b.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>

                    <span className="font-mono font-bold text-amber-400 text-sm">
                      ₹{parseFloat(b.amount).toFixed(2)}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'qa' && (
            <div className="space-y-6 max-w-2xl">
              {/* Question input */}
              <form onSubmit={handlePostQuestion} className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 block">
                  Have a question before bidding? Ask the seller:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={questionInput}
                    onChange={(e) => setQuestionInput(e.target.value)}
                    placeholder="e.g. Can you meet near Central Library? Are both keys included?"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1 transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Ask</span>
                  </button>
                </div>
              </form>

              {/* Questions list */}
              <div className="space-y-4">
                {questions.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs">
                    No questions yet. Ask the seller anything about item condition or pickup!
                  </div>
                ) : (
                  questions.map((q) => (
                    <div key={q.id} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-bold text-white">{q.asker_name}</span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {new Date(q.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed font-medium">
                        Q: {q.question_text}
                      </p>

                      {/* Answer */}
                      {q.answer_text ? (
                        <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs space-y-1">
                          <div className="flex items-center gap-1.5 text-amber-400 font-bold text-[11px]">
                            <span>Seller Answer</span>
                            <span className="text-[10px] text-slate-500 font-normal">
                              • {new Date(q.answered_at).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-slate-200">{q.answer_text}</p>
                        </div>
                      ) : isSeller ? (
                        answeringQId === q.id ? (
                          <div className="space-y-2 pt-2 border-t border-slate-800">
                            <textarea
                              rows={2}
                              value={answerInput}
                              onChange={(e) => setAnswerInput(e.target.value)}
                              placeholder="Write your answer..."
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-amber-400"
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => setAnsweringQId(null)}
                                className="px-2.5 py-1 text-xs text-slate-400 hover:bg-slate-800 rounded"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handlePostAnswer(q.id)}
                                className="px-3 py-1 text-xs font-bold bg-amber-500 text-slate-950 rounded hover:bg-amber-400"
                              >
                                Publish Answer
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setAnsweringQId(q.id);
                              setAnswerInput('');
                            }}
                            className="text-xs text-amber-400 hover:underline font-semibold"
                          >
                            + Answer this question
                          </button>
                        )
                      ) : (
                        <span className="text-[11px] text-slate-500 italic">Waiting for seller reply</span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'details' && (
            <div className="max-w-2xl space-y-4">
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <h4 className="text-sm font-bold text-white">Item Description</h4>
                <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                  {auction.description}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-slate-400 block font-medium">Condition Grade</span>
                  <span className="text-white font-bold capitalize mt-0.5 block">
                    {auction.item_condition.replace('_', ' ')}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-slate-400 block font-medium">Campus Pickup Location</span>
                  <span className="text-white font-bold mt-0.5 block">
                    Hostel / Central Campus Grounds
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bid Modal */}
      {showBidModal && (
        <BidModal
          auction={auction}
          onClose={() => setShowBidModal(false)}
          onBidSuccess={() => fetchAuctionDetails()}
          existingAutoBid={myAutoBid}
        />
      )}

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="font-bold text-white text-base">Cancel Auction</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              In accordance with campus auction policy, cancelled auctions are never permanently deleted; their history is preserved in audit records.
            </p>
            <textarea
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Reason for cancellation (e.g. item damaged, decided to keep)..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-rose-400"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCancelModal(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-800 rounded-lg"
              >
                Go Back
              </button>
              <button
                onClick={handleCancelAuction}
                className="px-4 py-1.5 text-xs font-bold bg-rose-500 hover:bg-rose-400 text-white rounded-lg"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


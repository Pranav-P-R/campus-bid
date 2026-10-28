import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Sparkles, Send, Bot, Check, ArrowRight, ShieldCheck, X, Flame } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function AiAssistantModal({ onClose, onSelectAuction, currentAuctionId = null }) {
  const { token, user } = useAuth();
  const [messages, setMessages] = useState([
    {
      sender: 'ai',
      text: "Hi! I'm your **CampusBid AI Assistant**. I can translate natural language into campus auction filters, compare competing listings, and recommend safe bids. What are you looking for today?",
      options: [
        'Find me a cycle under ₹2000',
        'Compare scientific calculators',
        'Hostel room essentials',
        currentAuctionId ? 'What should I bid on this item?' : 'Textbooks under ₹400'
      ]
    }
  ]);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionProcessing, setActionProcessing] = useState(false);

  const handleSend = async (queryText) => {
    const textToSend = queryText || input;
    if (!textToSend.trim() || loading) return;

    // Append user message
    const newMsgList = [...messages, { sender: 'user', text: textToSend }];
    setMessages(newMsgList);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/assistant/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          queryText: textToSend,
          currentAuctionId
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setMessages([
        ...newMsgList,
        {
          sender: 'ai',
          text: data.reply,
          matchingAuctions: data.matchingAuctions || [],
          proposedAction: data.proposedAction || null
        }
      ]);
    } catch (err) {
      setMessages([
        ...newMsgList,
        {
          sender: 'ai',
          text: `Sorry, I encountered an issue analyzing the database: ${err.message}`
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveAction = async (action) => {
    if (!token) {
      alert('Please sign in as a student to place bids.');
      return;
    }

    try {
      setActionProcessing(true);
      const res = await fetch(`/api/auctions/${action.auctionId}/bids`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ amount: action.proposedAmount })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });

      setMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: `🎉 **Approved & Executed!** Your bid of **₹${action.proposedAmount.toFixed(2)}** on "${action.auctionTitle}" was accepted. You are now the leading bidder!`
        }
      ]);
    } catch (err) {
      alert(err.message);
    } finally {
      setActionProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl h-[650px] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-4 bg-slate-800/80 border-b border-slate-700/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center text-slate-950 shadow-md shadow-amber-500/20">
              <Sparkles className="w-4 h-4 font-bold" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                CampusBid AI Assistant
                <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded font-mono border border-amber-500/30">
                  Safe Proxy Ready
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">Natural language search, item comparisons & bid strategy</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message Log */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed ${
                  m.sender === 'user'
                    ? 'bg-amber-500 text-slate-950 font-medium'
                    : 'bg-slate-800/90 text-slate-200 border border-slate-700/70 shadow-sm'
                }`}
              >
                {/* Parse simple bold markdown */}
                <div
                  dangerouslySetInnerHTML={{
                    __html: m.text
                      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                      .replace(/\n/g, '<br/>')
                  }}
                />

                {/* Proposed Action Card with Mandatory Approval */}
                {m.proposedAction && (
                  <div className="mt-3 p-3 rounded-xl bg-slate-950/80 border border-amber-500/40 text-slate-200">
                    <div className="flex items-center gap-1.5 text-amber-400 font-bold mb-1">
                      <ShieldCheck className="w-4 h-4" />
                      <span>Proposed Action (Requires Explicit Confirmation)</span>
                    </div>

                    <p className="text-[11px] text-slate-300 mb-2">
                      {m.proposedAction.reason}
                    </p>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Proposed Bid</span>
                        <span className="text-base font-mono font-bold text-amber-400">
                          ₹{m.proposedAction.proposedAmount.toFixed(2)}
                        </span>
                      </div>

                      <button
                        onClick={() => handleApproveAction(m.proposedAction)}
                        disabled={actionProcessing}
                        className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 font-bold rounded-lg text-xs hover:from-amber-400 hover:to-amber-300 transition-all shadow-md active:scale-95 disabled:opacity-50"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Approve & Place Bid</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Matching Auctions Grid */}
                {m.matchingAuctions && m.matchingAuctions.length > 0 && (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-700/50">
                    {m.matchingAuctions.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => {
                          onSelectAuction(item.id);
                          onClose();
                        }}
                        className="p-2 rounded-lg bg-slate-900/90 border border-slate-700 hover:border-amber-400/60 transition-all cursor-pointer flex items-center gap-2 group"
                      >
                        <img
                          src={item.image_url || 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=200&q=80'}
                          alt={item.title}
                          className="w-10 h-10 object-cover rounded-md shrink-0 bg-slate-800"
                        />
                        <div className="truncate flex-1">
                          <span className="font-semibold text-white group-hover:text-amber-400 text-[11px] truncate block">
                            {item.title}
                          </span>
                          <span className="text-amber-300 font-mono text-[10px]">
                            ₹{parseFloat(item.current_price || item.starting_price).toFixed(2)}
                          </span>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-400 shrink-0" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick Prompt Pills */}
              {m.options && (
                <div className="flex flex-wrap gap-1.5 mt-2 max-w-[85%]">
                  {m.options.map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => handleSend(opt)}
                      className="px-2.5 py-1 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white rounded-full text-[11px] border border-slate-700/60 transition-colors"
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-xs text-slate-400 p-2">
              <Bot className="w-4 h-4 animate-spin text-amber-400" />
              <span>Analyzing catalog & calculating prices...</span>
            </div>
          )}
        </div>

        {/* Input bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="p-3 bg-slate-800/60 border-t border-slate-700/60 flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything, e.g. 'Casio calculator under ₹500' or 'Compare cycles'..."
            className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="p-2 rounded-xl bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 transition-colors disabled:opacity-40"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}


import React from 'react';
import CountdownTimer from './CountdownTimer';
import { Gavel, CheckCircle2, Flame, User } from 'lucide-react';

export default function AuctionCard({ auction, onSelect }) {
  const currentPrice = auction.current_price !== null ? parseFloat(auction.current_price) : parseFloat(auction.starting_price);
  const isStarted = auction.current_price !== null;
  const isClosed = auction.status === 'closed' || new Date(auction.end_time) <= new Date();

  const conditionLabels = {
    new: 'Brand New',
    like_new: 'Like New',
    good: 'Good',
    fair: 'Fair',
    poor: 'Poor'
  };

  const primaryImage =
    Array.isArray(auction.images) && auction.images.length > 0
      ? auction.images[0]
      : 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=600&q=80';

  return (
    <div
      onClick={() => onSelect(auction.id)}
      className="glass-card rounded-2xl overflow-hidden flex flex-col group cursor-pointer border border-slate-800 hover:border-amber-500/40 transition-all duration-300"
    >
      {/* Image container */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-900">
        <img
          src={primaryImage}
          alt={auction.title}
          className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />

        {/* Condition tag */}
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold tracking-wide bg-slate-950/80 backdrop-blur-md text-amber-300 border border-amber-500/30">
            {conditionLabels[auction.item_condition] || auction.item_condition}
          </span>
          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-950/70 backdrop-blur-md text-slate-300 border border-slate-700/60">
            {auction.category_name}
          </span>
        </div>

        {/* Timer badge */}
        <div className="absolute bottom-3 right-3">
          <CountdownTimer endTime={auction.end_time} compact />
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          <h3 className="font-bold text-white text-base line-clamp-2 group-hover:text-amber-400 transition-colors leading-snug">
            {auction.title}
          </h3>

          <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
            {auction.description}
          </p>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-800/80">
          <div className="flex items-end justify-between">
            <div>
              <span className="text-[11px] text-slate-400 font-medium block">
                {isStarted ? 'Current Leading Bid' : 'Starting Price'}
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-extrabold text-amber-400 font-mono tracking-tight">
                  ₹{currentPrice.toFixed(2)}
                </span>
                {auction.min_bid_increment && (
                  <span className="text-[10px] text-slate-500">
                    (+₹{parseFloat(auction.min_bid_increment).toFixed(0)})
                  </span>
                )}
              </div>
            </div>

            <div className="text-right">
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-md bg-slate-800 text-slate-300">
                <Gavel className="w-3 h-3 text-amber-400" />
                {auction.bid_count} {auction.bid_count === 1 ? 'bid' : 'bids'}
              </span>
            </div>
          </div>

          {/* Leader or Seller line */}
          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800/40">
            <div className="flex items-center gap-1 truncate">
              <User className="w-3 h-3 text-slate-500" />
              <span>By {auction.seller_display_name}</span>
              {auction.seller_verified && (
                <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
              )}
            </div>

            {auction.leading_bidder_name && !isClosed && (
              <span className="text-amber-300/90 font-medium truncate ml-2">
                Leader: {auction.leading_bidder_name}
              </span>
            )}
            {isClosed && (
              <span className="text-rose-400 font-medium">Closed</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


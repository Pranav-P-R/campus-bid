import React, { useState, useEffect } from 'react';
import AuctionCard from '../components/AuctionCard';
import { useSocket } from '../context/SocketContext';
import {
  Search,
  Filter,
  SlidersHorizontal,
  Flame,
  ArrowUpDown,
  Tag,
  Zap,
  Sparkles,
  RefreshCw
} from 'lucide-react';

export default function HomePage({ onSelectAuction, onOpenAssistant, onOpenCreate }) {
  const { socket } = useSocket();
  const [auctions, setAuctions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedCondition, setSelectedCondition] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [statusFilter, setStatusFilter] = useState('active'); // 'active', 'closing_soon', 'closed', 'all'
  const [sortBy, setSortBy] = useState('closing_soon');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Fetch categories
  useEffect(() => {
    fetch('/api/auctions/categories')
      .then((res) => res.json())
      .then((data) => {
        if (data.categories) setCategories(data.categories);
      })
      .catch(console.error);
  }, []);

  // Fetch auctions
  const fetchAuctions = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.append('q', searchQuery.trim());
    if (selectedCategory) params.append('categoryId', selectedCategory);
    if (selectedCondition) params.append('condition', selectedCondition);
    if (minPrice) params.append('minPrice', minPrice);
    if (maxPrice) params.append('maxPrice', maxPrice);
    if (statusFilter) params.append('status', statusFilter);
    if (sortBy) params.append('sortBy', sortBy);

    fetch(`/api/auctions?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.auctions) setAuctions(data.auctions);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchAuctions();
  }, [selectedCategory, selectedCondition, statusFilter, sortBy]);

  // Handle Enter key for search
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchAuctions();
  };

  // Socket.io real-time updates:
  useEffect(() => {
    if (!socket) return;

    const handleGlobalUpdate = (payload) => {
      setAuctions((prev) =>
        prev.map((auc) => {
          if (auc.id === payload.auctionId) {
            return {
              ...auc,
              current_price: payload.current_price !== undefined ? payload.current_price : auc.current_price,
              end_time: payload.end_time || auc.end_time,
              status: payload.status || auc.status,
              bid_count: payload.current_price ? (auc.bid_count || 0) + 1 : auc.bid_count
            };
          }
          return auc;
        })
      );
    };

    const handleNewAuction = () => {
      fetchAuctions();
    };

    socket.on('global_auction_update', handleGlobalUpdate);
    socket.on('new_auction_published', handleNewAuction);

    return () => {
      socket.off('global_auction_update', handleGlobalUpdate);
      socket.off('new_auction_published', handleNewAuction);
    };
  }, [socket]);

  return (
    <div className="space-y-6 pb-16">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/40 border border-slate-800 p-6 sm:p-10">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30 mb-4">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Fair Peer Bidding • Anti-Sniping Protection • In-Person Handover</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Buy & sell campus essentials at{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-200">
              fair student prices.
            </span>
          </h1>

          <p className="text-slate-300 text-sm sm:text-base mt-3 leading-relaxed max-w-2xl">
            Cycles, scientific calculators, engineering drafters, and hostel gear. Place competitive bids with real-time updates and zero middleman fees.
          </p>

          <div className="flex flex-wrap items-center gap-3 mt-6">
            <button
              onClick={onOpenCreate}
              className="px-5 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 hover:from-amber-400 hover:to-amber-300 transition-all shadow-lg shadow-amber-500/20"
            >
              Start an Auction (+ Sell)
            </button>
            <button
              onClick={onOpenAssistant}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-semibold text-sm bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              Ask AI Assistant
            </button>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search box */}
          <form onSubmit={handleSearchSubmit} className="flex-1 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search items by title or description (e.g. cycle, calculator, drafter)..."
              className="w-full pl-10 pr-24 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1.5 px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg transition-colors"
            >
              Search
            </button>
          </form>

          {/* Sort Selector */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-3 py-2 rounded-xl text-xs text-slate-300">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-transparent text-white focus:outline-none cursor-pointer"
              >
                <option value="closing_soon" className="bg-slate-900">Closing Soon</option>
                <option value="newest" className="bg-slate-900">Recently Listed</option>
                <option value="price_asc" className="bg-slate-900">Price: Low to High</option>
                <option value="price_desc" className="bg-slate-900">Price: High to Low</option>
                <option value="bids_desc" className="bg-slate-900">Most Bids</option>
              </select>
            </div>

            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`p-2.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-colors ${
                showAdvancedFilters
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span className="hidden sm:inline">Filters</span>
            </button>

            <button
              onClick={fetchAuctions}
              className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
              title="Refresh listings"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5">
          <button
            onClick={() => setSelectedCategory('')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              selectedCategory === ''
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'bg-slate-900/80 text-slate-300 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            All Categories
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.id.toString() === selectedCategory ? '' : c.id.toString())}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === c.id.toString()
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'bg-slate-900/80 text-slate-300 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* Advanced Filters Expandable Drawer */}
        {showAdvancedFilters && (
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs animate-fadeIn">
            <div>
              <label className="text-slate-400 font-medium block mb-1">Item Condition</label>
              <select
                value={selectedCondition}
                onChange={(e) => setSelectedCondition(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white focus:outline-none"
              >
                <option value="">Any Condition</option>
                <option value="new">Brand New</option>
                <option value="like_new">Like New</option>
                <option value="good">Good</option>
                <option value="fair">Fair</option>
              </select>
            </div>

            <div>
              <label className="text-slate-400 font-medium block mb-1">Auction Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white focus:outline-none"
              >
                <option value="active">Active Only</option>
                <option value="closed">Closed / Ended</option>
                <option value="all">All Auctions</option>
              </select>
            </div>

            <div>
              <label className="text-slate-400 font-medium block mb-1">Min Price (₹)</label>
              <input
                type="number"
                placeholder="₹ Min"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="text-slate-400 font-medium block mb-1">Max Price (₹)</label>
              <input
                type="number"
                placeholder="₹ Max"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white focus:outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Auction Grid */}
      {loading ? (
        <div className="py-20 text-center text-slate-500 text-sm">
          Loading live auctions...
        </div>
      ) : auctions.length === 0 ? (
        <div className="py-20 text-center bg-slate-900/40 rounded-3xl border border-slate-800 p-8">
          <Tag className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-white">No matching auctions found</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
            Try adjusting your search criteria or publish your own item to kick off a new auction!
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('');
              setSelectedCondition('');
              setMinPrice('');
              setMaxPrice('');
              setStatusFilter('active');
            }}
            className="mt-4 px-4 py-2 bg-slate-800 text-amber-400 font-semibold text-xs rounded-xl hover:bg-slate-700 transition-colors"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {auctions.map((auction) => (
            <AuctionCard
              key={auction.id}
              auction={auction}
              onSelect={onSelectAuction}
            />
          ))}
        </div>
      )}
    </div>
  );
}


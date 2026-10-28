import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import {
  Gavel,
  PlusCircle,
  Bell,
  Sparkles,
  Bookmark,
  ShoppingBag,
  CheckCircle,
  LogOut,
  LogIn,
  Check,
  CheckCheck
} from 'lucide-react';

export default function Navbar({
  onOpenCreate,
  onOpenAssistant,
  onOpenSavedSearches,
  onOpenAuth,
  activeView,
  setActiveView
}) {
  const { user, logout } = useAuth();
  const { notifications, unreadCount, markAllRead, markSingleRead, requestBrowserPermission } = useSocket();
  const [showNotifications, setShowNotifications] = useState(false);
  const [browserNoticeActive, setBrowserNoticeActive] = useState(Notification?.permission === 'granted');

  const handleEnableBrowserNotifications = async () => {
    const granted = await requestBrowserPermission();
    if (granted) setBrowserNoticeActive(true);
  };

  return (
    <nav className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-6">
            <button
              onClick={() => setActiveView('home')}
              className="flex items-center gap-2.5 text-left group"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center text-slate-950 shadow-md shadow-amber-500/20 group-hover:scale-105 transition-transform">
                <Gavel className="w-5 h-5 font-bold" />
              </div>
              <div>
                <span className="font-extrabold text-lg text-white tracking-tight flex items-center gap-1.5">
                  Campus<span className="text-amber-400">Bid</span>
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 bg-amber-500/10 text-amber-300 border border-amber-500/30 rounded">
                    P2P
                  </span>
                </span>
                <p className="text-[10px] text-slate-400 -mt-0.5">College Peer Auction Marketplace</p>
              </div>
            </button>

            {/* Nav links */}
            <div className="hidden md:flex items-center gap-1">
              <button
                onClick={() => setActiveView('home')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeView === 'home'
                    ? 'bg-slate-800 text-amber-400 font-semibold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                Browse Auctions
              </button>

              {user && !user.is_admin && (
                <button
                  onClick={() => setActiveView('sales')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    activeView === 'sales'
                      ? 'bg-slate-800 text-amber-400 font-semibold'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <ShoppingBag className="w-4 h-4" />
                  My Sales & Handover
                </button>
              )}

              <button
                onClick={onOpenAssistant}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors"
              >
                <Sparkles className="w-4 h-4 text-amber-400" />
                AI Assistant
              </button>

              {user && !user.is_admin && (
                <button
                  onClick={onOpenSavedSearches}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors"
                >
                  <Bookmark className="w-4 h-4 text-sky-400" />
                  Saved Alerts
                </button>
              )}
            </div>
          </div>

          {/* Right Action buttons */}
          <div className="flex items-center gap-3">
            {/* Create Listing Button */}
            {user?.account_type === 'seller' && !user?.is_admin && (
              <button onClick={onOpenCreate} className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 font-bold px-3.5 py-1.5 rounded-lg text-sm hover:from-amber-400 hover:to-amber-300 transition-all shadow-md shadow-amber-500/20 active:scale-95">
                <PlusCircle className="w-4 h-4" /><span className="hidden sm:inline">Sell Item</span>
              </button>
            )}

            {/* Notification Bell */}
            {user && (
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                  aria-label="Notifications"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white ring-2 ring-slate-950 animate-bounce">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {/* Notification Dropdown Panel */}
                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl z-50 overflow-hidden">
                    <div className="p-3 bg-slate-800/80 border-b border-slate-700/80 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Bell className="w-4 h-4 text-amber-400" />
                        <span className="font-semibold text-sm text-white">Notifications</span>
                        {unreadCount > 0 && (
                          <span className="text-xs bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-mono font-medium">
                            {unreadCount} new
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {unreadCount > 0 && (
                          <button
                            onClick={markAllRead}
                            className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 font-medium"
                          >
                            <CheckCheck className="w-3.5 h-3.5" />
                            Mark all read
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Browser push toggle prompt */}
                    {!browserNoticeActive && (
                      <div className="p-2.5 bg-slate-800/40 border-b border-slate-800 flex items-center justify-between text-xs">
                        <span className="text-slate-400">Get outbid alerts in background tabs:</span>
                        <button
                          onClick={handleEnableBrowserNotifications}
                          className="px-2 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded hover:bg-amber-500/30 font-medium"
                        >
                          Enable alerts
                        </button>
                      </div>
                    )}

                    {/* List */}
                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-800">
                      {notifications.length === 0 ? (
                        <div className="p-6 text-center text-slate-500 text-xs">
                          No notifications yet. You'll be alerted when outbid, when auctions close, or when saved searches match.
                        </div>
                      ) : (
                        notifications.map((n) => {
                          const isUnread = !n.read_at;
                          return (
                            <div
                              key={n.id}
                              onClick={() => markSingleRead(n.id)}
                              className={`p-3 text-left transition-colors cursor-pointer ${
                                isUnread ? 'bg-amber-500/5 hover:bg-amber-500/10' : 'hover:bg-slate-800/50'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <span className={`text-xs font-semibold ${isUnread ? 'text-amber-300' : 'text-slate-200'}`}>
                                  {n.title}
                                </span>
                                <span className="text-[10px] text-slate-500 font-mono whitespace-nowrap">
                                  {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{n.body}</p>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* User Profile / Auth */}
            {user ? (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
                {user.is_admin && <button onClick={() => setActiveView('admin')} className="text-xs font-bold text-emerald-300 hover:text-emerald-200">Admin</button>}
                <div className="text-right hidden sm:block">
                  <div className="flex items-center justify-end gap-1">
                    <span className="text-xs font-bold text-white">{user.display_name}</span>
                    {user.campus_verified && (
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400" title="Verified Campus Student" />
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 block font-mono">{user.is_admin ? 'Administrator' : `${user.account_type === 'seller' ? 'Seller' : 'Buyer'} · ${user.campus_id || 'Campus'}`}</span>
                </div>

                <button
                  onClick={logout}
                  className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenAuth}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition-colors"
              >
                <LogIn className="w-4 h-4 text-amber-400" />
                <span>Student Sign In</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

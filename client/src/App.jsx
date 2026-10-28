import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider, useSocket } from './context/SocketContext';

// Components & Pages
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import AuctionDetailPage from './pages/AuctionDetailPage';
import CreateAuctionPage from './pages/CreateAuctionPage';
import MySalesPage from './pages/MySalesPage';
import AuthModal from './pages/AuthModal';
import AiAssistantModal from './components/AiAssistantModal';
import SavedSearchesModal from './components/SavedSearchesModal';
import LandingPage from './pages/LandingPage';
import AdminPage from './pages/AdminPage';
import { Bell, Sparkles, X } from 'lucide-react';

function MainApp() {
  const { user, loading } = useAuth();
  const { toastMessage, clearToast } = useSocket();

  const [activeView, setActiveView] = useState('home'); // 'home', 'details', 'create', 'sales', 'admin'
  const [selectedAuctionId, setSelectedAuctionId] = useState(null);

  // Modals
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showAssistantModal, setShowAssistantModal] = useState(false);
  const [assistantAuctionContext, setAssistantAuctionContext] = useState(null);
  const [showSavedSearchesModal, setShowSavedSearchesModal] = useState(false);

  const handleSelectAuction = (auctionId) => {
    setSelectedAuctionId(auctionId);
    setActiveView('details');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenAssistant = (auctionId = null) => {
    setAssistantAuctionContext(auctionId);
    setShowAssistantModal(true);
  };

  const handleCreateSuccess = (auctionId) => {
    setSelectedAuctionId(auctionId);
    setActiveView('details');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) return <div className="min-h-screen bg-slate-950 text-slate-400 flex items-center justify-center">Loading CampusBid...</div>;
  if (!user) return <PublicApp />;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-black">
      {/* Main Navbar */}
      <Navbar
        activeView={activeView}
        setActiveView={(v) => {
          setActiveView(v);
          if (v === 'home') setSelectedAuctionId(null);
        }}
        onOpenCreate={() => {
          if (!user) setShowAuthModal(true);
          else if (user.account_type === 'seller' && !user.is_admin) setActiveView('create');
        }}
        onOpenAssistant={() => handleOpenAssistant(null)}
        onOpenSavedSearches={() => {
          if (!user) setShowAuthModal(true);
          else setShowSavedSearchesModal(true);
        }}
        onOpenAuth={() => setShowAuthModal(true)}
      />

      {/* Floating In-App Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full bg-slate-900 border border-amber-500/50 shadow-2xl rounded-2xl p-4 flex items-start gap-3 animate-slideIn">
          <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
            <Bell className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <h4 className="text-xs font-bold text-white">{toastMessage.title}</h4>
            <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">{toastMessage.body}</p>
          </div>
          <button
            onClick={clearToast}
            className="text-slate-500 hover:text-white p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Page Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {activeView === 'home' && (
          <HomePage
            onSelectAuction={handleSelectAuction}
            onOpenAssistant={() => handleOpenAssistant(null)}
            onOpenCreate={() => {
              if (!user) setShowAuthModal(true);
              else if (user.account_type === 'seller' && !user.is_admin) setActiveView('create');
            }}
          />
        )}

        {activeView === 'details' && selectedAuctionId && (
          <AuctionDetailPage
            auctionId={selectedAuctionId}
            onBack={() => {
              setActiveView('home');
              setSelectedAuctionId(null);
            }}
            onOpenAuth={() => setShowAuthModal(true)}
            onOpenAssistant={handleOpenAssistant}
          />
        )}

        {activeView === 'create' && (
          <CreateAuctionPage
            onBack={() => setActiveView('home')}
            onSuccess={handleCreateSuccess}
            onOpenAuth={() => setShowAuthModal(true)}
          />
        )}

        {activeView === 'sales' && (
          <MySalesPage
            onSelectAuction={handleSelectAuction}
          />
        )}

        {activeView === 'admin' && user.is_admin && <AdminPage />}
      </main>

      {/* Modals */}
      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)} />
      )}

      {showAssistantModal && (
        <AiAssistantModal
          currentAuctionId={assistantAuctionContext}
          onClose={() => setShowAssistantModal(false)}
          onSelectAuction={handleSelectAuction}
        />
      )}

      {showSavedSearchesModal && (
        <SavedSearchesModal onClose={() => setShowSavedSearchesModal(false)} />
      )}

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-8 mt-12 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 space-y-2">
          <p className="font-semibold text-slate-400">
            CampusBid — College Peer-to-Peer Auction Marketplace
          </p>
          <p className="text-[11px] text-slate-600">
            Built for Campus Students • ACID Transactions • Anti-Sniping Protection • Automated Proxy Bidding • Direct Physical Handover
          </p>
        </div>
      </footer>
    </div>
  );
}

function PublicApp() {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authTab, setAuthTab] = useState('login');
  const [showBrowse, setShowBrowse] = useState(false);
  if (showBrowse) {
    return <><LandingPage onLogin={() => { setAuthTab('login'); setShowAuthModal(true); }} onRegister={() => { setAuthTab('register'); setShowAuthModal(true); }} onBrowse={() => setShowBrowse(false)} />{showAuthModal && <AuthModal initialTab={authTab} onClose={() => setShowAuthModal(false)} />}</>;
  }
  return <><LandingPage onLogin={() => { setAuthTab('login'); setShowAuthModal(true); }} onRegister={() => { setAuthTab('register'); setShowAuthModal(true); }} onBrowse={() => setShowBrowse(true)} />{showAuthModal && <AuthModal initialTab={authTab} onClose={() => setShowAuthModal(false)} />}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <MainApp />
      </SocketProvider>
    </AuthProvider>
  );
}

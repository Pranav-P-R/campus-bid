import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogIn, UserPlus, Shield, CheckCircle2, X, AlertCircle } from 'lucide-react';

export default function AuthModal({ onClose, initialTab = 'login' }) {
  const { login } = useAuth();
  const [tab, setTab] = useState(initialTab); // 'login', 'register', 'verify'

  // Login form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Register form
  const [fullName, setFullName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [campusId, setCampusId] = useState('');
  const [accountType, setAccountType] = useState('buyer');

  // Verify form
  const [verifyCode, setVerifyCode] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const readResponse = async (res) => {
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(res.ok ? 'The server returned an invalid response.' : 'The CampusBid server is unavailable. Start it with npm start and try again.');
    }
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status}).`);
    return data;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password })
      });

      const data = await readResponse(res);

      login(data.token, data.user);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          displayName: displayName.trim(),
          email: regEmail.trim(),
          password: regPassword,
          campusId: campusId.trim() || undefined
          ,accountType
        })
      });

      const data = await readResponse(res);

      login(data.token, data.user);

      if (data.verificationCodeNeeded) {
        setTab('verify');
      } else {
        onClose();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('campusbid_token')}`
        },
        body: JSON.stringify({ code: verifyCode.trim() })
      });

      const data = await readResponse(res);

      onClose();
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
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-white text-base">Campus Student Access</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-slate-800 bg-slate-950/40">
          <button
            onClick={() => { setTab('login'); setError(''); }}
            className={`flex-1 py-2.5 text-xs font-bold border-b-2 transition-colors ${
              tab === 'login'
                ? 'border-amber-400 text-amber-400 bg-amber-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => { setTab('register'); setError(''); }}
            className={`flex-1 py-2.5 text-xs font-bold border-b-2 transition-colors ${
              tab === 'register'
                ? 'border-amber-400 text-amber-400 bg-amber-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Student Register
          </button>
        </div>

        {/* Content */}
        <div className="p-5 max-h-[500px] overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {tab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-3">
              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1">
                  Campus Email
                </label>
                <input
                  type="email"
                  required
                  placeholder="student@campus.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 hover:from-amber-400 hover:to-amber-300 transition-all shadow-md active:scale-95 disabled:opacity-50"
              >
                {loading ? 'Signing in...' : 'Sign In as Student'}
              </button>
            </form>
          )}

          {tab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-300 font-medium block mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rahul Verma"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-300 font-medium block mb-1">I want to join as</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['buyer', 'seller'].map((type) => <button key={type} type="button" onClick={() => setAccountType(type)} className={`p-2 rounded-lg border text-xs font-bold capitalize ${accountType === type ? 'border-amber-400 bg-amber-500/10 text-amber-300' : 'border-slate-700 text-slate-400'}`}>{type === 'buyer' ? 'Buyer — find deals' : 'Seller — list items'}</button>)}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-amber-400 font-medium block mb-1">
                    Public Display Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rahul V."
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>
              <p className="text-[10px] text-slate-500">
                Privacy guarantee: Only your chosen display name is publicly shown on bids. Your private email and campus ID are never exposed.
              </p>

              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1">
                  Campus Email *
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. yourname@campus.edu"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-300 font-medium block mb-1">
                    Campus ID (Roll No.)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 2024-CS-042"
                    value={campusId}
                    onChange={(e) => setCampusId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-300 font-medium block mb-1">
                    Password *
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 hover:from-amber-400 hover:to-amber-300 transition-all shadow-md active:scale-95 disabled:opacity-50"
              >
                {loading ? 'Creating Account...' : 'Register Student Account'}
              </button>
            </form>
          )}

          {tab === 'verify' && (
            <form onSubmit={handleVerify} className="space-y-4 text-center">
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200">
                <CheckCircle2 className="w-6 h-6 text-amber-400 mx-auto mb-1" />
                <span>Verification Code Sent</span>
                <p className="text-[11px] text-slate-400 mt-1">
                  For this demo, enter <strong>123456</strong> or the code generated for your account.
                </p>
              </div>

              <div>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="123456"
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value)}
                  className="w-48 text-center text-xl font-mono font-bold tracking-widest bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-amber-400 mx-auto block"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl font-bold text-xs bg-amber-500 text-slate-950 hover:bg-amber-400"
              >
                Verify Campus Enrollment
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

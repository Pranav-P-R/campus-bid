import React, { useEffect, useState } from 'react';
import { Shield, Users, Gavel, Ban, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AdminPage() {
  const { token } = useAuth();
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [auctions, setAuctions] = useState([]);
  const [sales, setSales] = useState([]);
  const [error, setError] = useState('');
  const headers = { Authorization: `Bearer ${token}` };

  const load = async () => {
    try {
      const responses = await Promise.all(['/api/admin/overview', '/api/admin/users', '/api/admin/auctions', '/api/admin/sales'].map((url) => fetch(url, { headers })));
      const data = await Promise.all(responses.map((response) => response.json()));
      if (responses.some((response) => !response.ok)) throw new Error(data.find((item) => item.error)?.error || 'Unable to load admin data.');
      setOverview(data[0]); setUsers(data[1].users || []); setAuctions(data[2].auctions || []); setSales(data[3].sales || []);
    } catch (err) { setError(err.message); }
  };
  useEffect(() => { load(); }, [token]);
  const update = async (url, body) => {
    const response = await fetch(url, { method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    load();
  };

  if (error) return <div className="p-8 text-rose-300">{error}</div>;
  if (!overview) return <div className="p-12 text-slate-400">Loading moderation dashboard...</div>;
  const cards = [['Users', overview.users.total, Users], ['Active auctions', overview.auctions.active, Gavel], ['Sales volume', `₹${overview.sales.volume}`, CheckCircle2], ['Reports pending', overview.moderation.total, Shield]];
  return <div className="space-y-8 pb-20">
    <div><div className="flex items-center gap-2 text-amber-400"><Shield className="w-5 h-5" /><span className="text-xs font-bold uppercase tracking-widest">Administration</span></div><h1 className="text-3xl font-black mt-2">Campus control centre</h1><p className="text-slate-400 mt-1">Review accounts, listings and marketplace health.</p></div>
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">{cards.map(([label, value, Icon]) => <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800" key={label}><Icon className="w-5 h-5 text-amber-400" /><p className="text-2xl font-black mt-3">{value}</p><p className="text-xs text-slate-400">{label}</p></div>)}</div>
    <section className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden"><div className="p-5 border-b border-slate-800"><h2 className="font-bold">Account moderation</h2></div><div className="divide-y divide-slate-800">{users.map((item) => <div className="p-4 flex flex-wrap gap-3 items-center justify-between" key={item.id}><div><p className="font-semibold">{item.display_name} <span className="text-xs text-slate-500">{item.account_type}</span></p><p className="text-xs text-slate-500">{item.email}</p></div><div className="flex items-center gap-3"><span className="text-xs text-slate-400">{item.account_status}</span>{item.account_status === 'active' ? <button onClick={() => update(`/api/admin/users/${item.id}/status`, { status: 'suspended' })} className="text-xs text-rose-300 flex gap-1 items-center"><Ban className="w-3 h-3" /> Suspend</button> : <button onClick={() => update(`/api/admin/users/${item.id}/status`, { status: 'active' })} className="text-xs text-emerald-300 flex gap-1 items-center"><CheckCircle2 className="w-3 h-3" /> Restore</button>}</div></div>)}</div></section>
    <section className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden"><div className="p-5 border-b border-slate-800"><h2 className="font-bold">Auction moderation</h2></div><div className="divide-y divide-slate-800">{auctions.map((item) => <div className="p-4 flex items-center justify-between gap-3" key={item.id}><div><p className="font-semibold">{item.title}</p><p className="text-xs text-slate-500">By {item.seller_name} · {item.status}</p></div>{item.status !== 'cancelled' && <button onClick={() => update(`/api/admin/auctions/${item.id}/status`, { status: 'cancelled' })} className="text-xs text-rose-300">Cancel listing</button>}</div>)}</div></section>
    <section className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden"><div className="p-5 border-b border-slate-800"><h2 className="font-bold">Transaction moderation</h2><p className="text-xs text-slate-400 mt-1">Block pending or reserved transactions before handover.</p></div><div className="divide-y divide-slate-800">{sales.length === 0 ? <p className="p-5 text-sm text-slate-500">No transactions found.</p> : sales.map((item) => <div className="p-4 flex items-center justify-between gap-3" key={item.id}><div><p className="font-semibold">{item.auction_title}</p><p className="text-xs text-slate-500">{item.seller_name} → {item.buyer_name || 'No buyer'} · {item.status}</p></div>{['pending_seller_approval', 'reserved'].includes(item.status) && <button onClick={() => update(`/api/admin/sales/${item.id}/status`, { status: 'cancelled' })} className="text-xs text-rose-300">Block transaction</button>}</div>)}</div></section>
  </div>;
}

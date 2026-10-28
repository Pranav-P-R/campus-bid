import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Bookmark, Plus, Trash2, Bell, Check, X, Tag } from 'lucide-react';

export default function SavedSearchesModal({ onClose, categories = [] }) {
  const { token } = useAuth();
  const [searches, setSearches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [keyword, setKeyword] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [itemCondition, setItemCondition] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchSearches = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/saved-searches', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setSearches(data.savedSearches || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchSearches();
  }, [token]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!name.trim()) {
      setFormError('Please give this alert a name.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/saved-searches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: name.trim(),
          keyword: keyword.trim() || undefined,
          categoryId: categoryId || undefined,
          itemCondition: itemCondition || undefined,
          maxPrice: maxPrice ? parseFloat(maxPrice) : undefined
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Reset form
      setName('');
      setKeyword('');
      setCategoryId('');
      setItemCondition('');
      setMaxPrice('');
      setShowCreateForm(false);
      fetchSearches();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await fetch(`/api/saved-searches/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      setSearches((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-4 bg-slate-800/60 border-b border-slate-700/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bookmark className="w-5 h-5 text-sky-400" />
            <div>
              <h3 className="font-bold text-white text-base">Saved Searches & Alerts</h3>
              <p className="text-xs text-slate-400">Get alerted automatically whenever a matching item is listed</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 max-h-[500px] overflow-y-auto">
          {!showCreateForm ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">Your Active Search Watches</span>
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="flex items-center gap-1 text-xs font-bold bg-sky-500/20 text-sky-300 border border-sky-500/40 px-2.5 py-1 rounded-lg hover:bg-sky-500/30 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Watch Alert
                </button>
              </div>

              {loading ? (
                <div className="py-8 text-center text-xs text-slate-500">Loading alerts...</div>
              ) : searches.length === 0 ? (
                <div className="py-8 text-center bg-slate-950/40 rounded-xl border border-slate-800 p-6">
                  <Bookmark className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-xs text-slate-400 font-medium">No saved searches yet.</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Save criteria like "Scientific calculator under ₹500" and never miss an item!
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {searches.map((s) => (
                    <div
                      key={s.id}
                      className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between hover:border-slate-700 transition-colors"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white text-xs">{s.name}</span>
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                            <Bell className="w-2.5 h-2.5" /> Watching
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-2 text-[11px] text-slate-400 mt-1">
                          {s.keyword && <span>Keyword: "{s.keyword}"</span>}
                          {s.category_name && <span>• {s.category_name}</span>}
                          {s.max_price && <span>• Max ₹{parseFloat(s.max_price).toFixed(0)}</span>}
                          {s.item_condition && <span>• {s.item_condition}</span>}
                        </div>
                      </div>

                      <button
                        onClick={() => handleDelete(s.id)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                        title="Delete alert"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleCreate} className="space-y-3">
              {formError && (
                <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                  {formError}
                </div>
              )}

              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1">
                  Alert Label *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Scientific calculator under ₹500"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-400"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1">
                  Keyword (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Casio, Hero, Drafter"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-300 font-medium block mb-1">
                    Category
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-400"
                  >
                    <option value="">Any Category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-medium block mb-1">
                    Max Price (₹)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 500"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-400"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-sky-500 hover:bg-sky-400 text-slate-950 disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Activate Alert'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}


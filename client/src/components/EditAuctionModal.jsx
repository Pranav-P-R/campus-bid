import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { X, Upload, Plus, Trash2, Check, AlertCircle, Image as ImageIcon } from 'lucide-react';

export default function EditAuctionModal({ auction, onClose, onSuccess }) {
  const { token } = useAuth();

  const [title, setTitle] = useState(auction.title || '');
  const [description, setDescription] = useState(auction.description || '');
  const [itemCondition, setItemCondition] = useState(auction.item_condition || 'good');
  const [images, setImages] = useState(
    Array.isArray(auction.images) && auction.images.length > 0 ? auction.images : []
  );
  const [newImageUrl, setNewImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('photos', files[i]);
    }

    try {
      setUploading(true);
      setError('');
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (data.urls && data.urls.length > 0) {
        setImages((prev) => [...prev, ...data.urls]);
      }
    } catch (err) {
      setError(`File upload failed: ${err.message}`);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleAddUrl = () => {
    if (newImageUrl.trim()) {
      setImages([...images, newImageUrl.trim()]);
      setNewImageUrl('');
    }
  };

  const handleRemoveImage = (indexToRemove) => {
    setImages(images.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!title.trim() || !description.trim()) {
      setError('Title and description are required.');
      return;
    }

    try {
      setSaving(true);
      const res = await fetch(`/api/auctions/${auction.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          itemCondition,
          images
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      onSuccess(data.auction);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-4 bg-slate-800/60 border-b border-slate-700/60 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-white text-base">Edit Auction Listing</h3>
            <p className="text-xs text-slate-400">Update item details, condition description, or photos</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-slate-300 font-semibold block mb-1">
                Item Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="text-xs text-slate-300 font-semibold block mb-1">
                Item Condition *
              </label>
              <select
                value={itemCondition}
                onChange={(e) => setItemCondition(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-400 cursor-pointer"
              >
                <option value="new">Brand New</option>
                <option value="like_new">Like New</option>
                <option value="good">Good</option>
                <option value="fair">Fair</option>
                <option value="poor">Poor</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-300 font-semibold block mb-1">
                Description & Specifications *
              </label>
              <textarea
                required
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-400 leading-relaxed"
              />
            </div>

            {/* Photos Management */}
            <div>
              <label className="text-xs text-slate-300 font-semibold block mb-1.5">
                Manage Item Photos
              </label>

              {/* Upload from Device */}
              <div className="flex flex-col sm:flex-row gap-2 mb-3">
                <label className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 rounded-xl cursor-pointer transition-colors text-xs font-semibold">
                  <Upload className="w-4 h-4" />
                  <span>{uploading ? 'Uploading...' : 'Upload Photos from Device'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    disabled={uploading}
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Or paste URL */}
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="Or paste direct image URL (https://...)"
                  value={newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
                <button
                  type="button"
                  onClick={handleAddUrl}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700"
                >
                  Add URL
                </button>
              </div>

              {/* Image Previews */}
              {images.length > 0 ? (
                <div className="flex flex-wrap gap-2 mt-3 p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                  {images.map((img, i) => (
                    <div key={i} className="relative group w-20 h-20 rounded-xl overflow-hidden border border-slate-700 bg-slate-800">
                      <img src={img} alt={`Item ${i}`} className="w-full h-full object-cover" />
                      {i === 0 && (
                        <span className="absolute bottom-1 left-1 bg-amber-500 text-slate-950 font-bold text-[9px] px-1 rounded">
                          Primary
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(i)}
                        className="absolute inset-0 bg-rose-950/80 text-rose-300 text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity font-bold gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-500 mt-2 italic">
                  No custom photos uploaded.
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-800 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || uploading}
                className="px-5 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl transition-colors shadow-md disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}


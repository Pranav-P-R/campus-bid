import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  ArrowLeft,
  Plus,
  Upload,
  Image as ImageIcon,
  Sparkles,
  Check,
  AlertCircle,
  Trash2,
  Tag
} from 'lucide-react';

export default function CreateAuctionPage({ onBack, onSuccess, onOpenAuth }) {
  const { user, token } = useAuth();

  const [categories, setCategories] = useState([]);
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [itemCondition, setItemCondition] = useState('good');
  const [startingPrice, setStartingPrice] = useState('');
  const [minBidIncrement, setMinBidIncrement] = useState('50');
  const [durationHours, setDurationHours] = useState('24');
  const [imageUrl, setImageUrl] = useState('');
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Category-specific high-resolution default photos
  const categoryDefaultPhotos = {
    cycles: 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=800&q=80',
    calculators: 'https://images.unsplash.com/photo-1594980596870-8aa52a78d8cd?auto=format&fit=crop&w=800&q=80',
    books: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80',
    electronics: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=800&q=80',
    'hostel-items': 'https://images.unsplash.com/photo-1584992236310-6edddc08acff?auto=format&fit=crop&w=800&q=80',
    other: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=800&q=80'
  };

  const presets = [
    { label: '🔢 Scientific Calculator', slug: 'calculators', url: categoryDefaultPhotos.calculators },
    { label: '🚲 Cycle', slug: 'cycles', url: categoryDefaultPhotos.cycles },
    { label: '📚 Engineering Book', slug: 'books', url: categoryDefaultPhotos.books },
    { label: '🎧 Electronics / Mouse', slug: 'electronics', url: categoryDefaultPhotos.electronics },
    { label: '🛏️ Mini Fridge / Hostel', slug: 'hostel-items', url: categoryDefaultPhotos['hostel-items'] }
  ];

  useEffect(() => {
    fetch('/api/auctions/categories')
      .then((res) => res.json())
      .then((data) => {
        if (data.categories) {
          setCategories(data.categories);
          if (data.categories.length > 0) setCategoryId(data.categories[0].id.toString());
        }
      })
      .catch(console.error);
  }, []);

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

  const handleAddImageUrl = () => {
    if (imageUrl.trim()) {
      setImages([...images, imageUrl.trim()]);
      setImageUrl('');
    }
  };

  const handleRemoveImage = (indexToRemove) => {
    setImages(images.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      onOpenAuth();
      return;
    }

    setError('');
    const startP = parseFloat(startingPrice);
    const incP = parseFloat(minBidIncrement);

    if (isNaN(startP) || startP <= 0) {
      setError('Starting price must be a valid positive amount.');
      return;
    }
    if (isNaN(incP) || incP <= 0) {
      setError('Minimum bid increment must be a valid positive amount.');
      return;
    }

    // Determine fallback photo based on selected category!
    const selectedCat = categories.find((c) => c.id.toString() === categoryId);
    const categorySlug = selectedCat?.slug || 'other';
    const fallbackPhoto = categoryDefaultPhotos[categorySlug] || categoryDefaultPhotos.other;

    const finalImages = images.length > 0
      ? images
      : (imageUrl.trim() ? [imageUrl.trim()] : [fallbackPhoto]);

    try {
      setLoading(true);
      const res = await fetch('/api/auctions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: title.trim(),
          categoryId,
          description: description.trim(),
          itemCondition,
          startingPrice: startP,
          minBidIncrement: incP,
          durationHours: parseFloat(durationHours),
          images: finalImages
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      onSuccess(data.auction.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Compute active preview image
  const selectedCat = categories.find((c) => c.id.toString() === categoryId);
  const activeFallback = categoryDefaultPhotos[selectedCat?.slug] || categoryDefaultPhotos.other;
  const previewImage = images.length > 0 ? images[0] : (imageUrl.trim() || activeFallback);

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Cancel & Back</span>
      </button>

      <div className="p-6 sm:p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-6">
        <div>
          <h2 className="text-2xl font-extrabold text-white">Create a Campus Auction</h2>
          <p className="text-xs text-slate-400 mt-1">
            List your item with your photos, starting price, and minimum increment. Active peer bids decide the final fair value!
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div>
            <label className="text-xs text-slate-300 font-semibold block mb-1.5">
              Item Title *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Casio fx-991EX Scientific Calculator or Hero Sprint Pro Cycle"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
          </div>

          {/* Category & Condition */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-300 font-semibold block mb-1.5">
                Category *
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400 cursor-pointer"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id} className="bg-slate-900">
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-300 font-semibold block mb-1.5">
                Item Condition *
              </label>
              <select
                value={itemCondition}
                onChange={(e) => setItemCondition(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400 cursor-pointer"
              >
                <option value="new" className="bg-slate-900">Brand New (Unopened/Unused)</option>
                <option value="like_new" className="bg-slate-900">Like New (Mint Condition)</option>
                <option value="good" className="bg-slate-900">Good (Lightly Used)</option>
                <option value="fair" className="bg-slate-900">Fair (Fully functional, signs of wear)</option>
                <option value="poor" className="bg-slate-900">Poor (Needs repair or spares)</option>
              </select>
            </div>
          </div>

          {/* Pricing: Starting Price & Increment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
            <div>
              <label className="text-xs text-amber-400 font-bold block mb-1.5">
                Starting Price (₹) *
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-slate-400 font-mono text-sm">₹</span>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  required
                  placeholder="300.00"
                  value={startingPrice}
                  onChange={(e) => setStartingPrice(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-4 py-2 text-white font-mono text-base font-bold focus:outline-none focus:border-amber-400"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Minimum initial bid required to open auction</p>
            </div>

            <div>
              <label className="text-xs text-amber-400 font-bold block mb-1.5">
                Minimum Bid Increment (₹) *
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-slate-400 font-mono text-sm">₹</span>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  required
                  placeholder="25.00"
                  value={minBidIncrement}
                  onChange={(e) => setMinBidIncrement(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-4 py-2 text-white font-mono text-base font-bold focus:outline-none focus:border-amber-400"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Each subsequent bid must beat current by at least this</p>
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="text-xs text-slate-300 font-semibold block mb-1.5">
              Auction Duration
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: '45 Minutes', hours: '0.75' },
                { label: '3 Hours', hours: '3' },
                { label: '12 Hours', hours: '12' },
                { label: '24 Hours', hours: '24' }
              ].map((d) => (
                <button
                  key={d.hours}
                  type="button"
                  onClick={() => setDurationHours(d.hours)}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                    durationHours === d.hours
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                      : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs text-slate-300 font-semibold block mb-1.5">
              Description & Specifications *
            </label>
            <textarea
              required
              rows={4}
              placeholder="Describe model number, working accessories, condition, and preferred campus pickup spots (e.g. Central Library, Hostel 4)..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 leading-relaxed"
            />
          </div>

          {/* Photos: Upload from Device + Presets + Preview */}
          <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-4">
            <div>
              <label className="text-xs text-white font-bold block mb-1">
                Item Photos
              </label>
              <p className="text-[11px] text-slate-400">
                Upload real photos from your computer/phone, choose a category sample, or paste an image URL.
              </p>
            </div>

            {/* Direct Device Upload Button */}
            <div className="flex flex-col sm:flex-row gap-3">
              <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-2 border-dashed border-amber-500/40 rounded-xl cursor-pointer transition-colors text-xs font-bold shadow-sm">
                <Upload className="w-4 h-4 text-amber-400" />
                <span>{uploading ? 'Uploading your photos...' : '📁 Upload Photos from Computer / Phone'}</span>
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

            {/* Or Paste URL */}
            <div className="flex gap-2">
              <input
                type="url"
                placeholder="Or paste direct image URL (https://...)"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
              <button
                type="button"
                onClick={handleAddImageUrl}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700"
              >
                Add Link
              </button>
            </div>

            {/* Category Presets */}
            <div>
              <span className="text-[11px] text-slate-400 block mb-1.5">Or click a sample photo for quick demo testing:</span>
              <div className="flex flex-wrap gap-1.5">
                {presets.map((p, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setImages([...images, p.url])}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg border border-slate-700 transition-colors"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Current Selected Photos Gallery */}
            <div>
              <span className="text-xs font-semibold text-slate-300 block mb-2">
                Photos to be displayed on listing ({images.length > 0 ? images.length : 1}):
              </span>

              <div className="flex flex-wrap gap-3">
                {images.length > 0 ? (
                  images.map((img, i) => (
                    <div
                      key={i}
                      className="relative group w-24 h-24 rounded-2xl overflow-hidden border-2 border-slate-700 bg-slate-900"
                    >
                      <img src={img} alt={`Uploaded ${i}`} className="w-full h-full object-cover" />
                      {i === 0 && (
                        <span className="absolute bottom-1.5 left-1.5 bg-amber-500 text-slate-950 font-extrabold text-[9px] px-1.5 py-0.5 rounded shadow">
                          PRIMARY
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(i)}
                        className="absolute inset-0 bg-rose-950/80 text-rose-300 text-xs font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity gap-1"
                      >
                        <Trash2 className="w-4 h-4" />
                        Remove
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="relative w-24 h-24 rounded-2xl overflow-hidden border-2 border-amber-500/50 bg-slate-900">
                    <img src={previewImage} alt="Auto category fallback" className="w-full h-full object-cover" />
                    <span className="absolute bottom-1.5 left-1.5 bg-slate-950/80 text-amber-300 font-bold text-[9px] px-1.5 py-0.5 rounded">
                      Category Default
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || uploading}
            className="w-full py-3.5 rounded-xl font-extrabold text-sm bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 hover:from-amber-400 hover:to-amber-300 transition-all shadow-xl shadow-amber-500/20 active:scale-95 disabled:opacity-50"
          >
            {loading ? 'Publishing Auction...' : 'Publish Item to Campus Marketplace'}
          </button>
        </form>
      </div>
    </div>
  );
}

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Coins,
  Search,
  Receipt,
  RotateCcw,
  Check,
  CheckCircle2,
  AlertCircle,
  Save,
  Tag,
  Percent,
  Sparkles,
  ArrowUpDown,
  Filter,
  RefreshCw,
  ShoppingBag,
  Sliders,
  X,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from '@/context/ToastContext';

export interface PosPriceItem {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  imageUrl?: string;
  price: number; // Master MRP
  posPrice?: number; // POS Selling Price
  posTaxPercent?: number; // POS GST
  posAvailable?: boolean; // Show in POS counter
  status?: string;
}

export default function PosPricesClient() {
  const [items, setItems] = useState<PosPriceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [availabilityFilter, setAvailabilityFilter] = useState<'All' | 'Active' | 'Hidden'>('All');
  const [sortBy, setSortBy] = useState<'name' | 'code' | 'pos_price_desc' | 'pos_price_asc'>('name');

  // Inline edit state tracking: map of itemId -> edited price string
  const [priceEdits, setPriceEdits] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [bulkAdjustmentPercent, setBulkAdjustmentPercent] = useState<string>('');
  const [isBulkAdjusting, setIsBulkAdjusting] = useState(false);

  // Real-time Firestore subscription to items
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'items'),
      (snapshot) => {
        const list: PosPriceItem[] = snapshot.docs.map((d) => {
          const data = d.data();
          const masterPrice = parseFloat(data.price || 0) || 0;
          const posPrice =
            data.posPrice !== undefined && data.posPrice !== null && !isNaN(parseFloat(data.posPrice))
              ? parseFloat(data.posPrice)
              : masterPrice;

          return {
            id: d.id,
            code: data.code || '',
            name: data.name || 'Untitled Item',
            category: data.category || 'General',
            unit: data.unit || 'KG',
            imageUrl: data.imageUrl,
            price: masterPrice,
            posPrice: posPrice,
            posTaxPercent: parseFloat(data.posTaxPercent ?? 5) || 5,
            posAvailable: data.posAvailable !== false,
            status: data.status || 'Active',
          };
        });

        setItems(list.filter((i) => i.status !== 'Inactive'));
        setIsLoading(false);
      },
      (error) => {
        console.error('Error fetching items for POS Prices:', error);
        toast.error('Error', 'Failed to load real-time item prices.');
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Available Categories
  const categories = useMemo(() => {
    const cats = new Set<string>();
    items.forEach((item) => {
      if (item.category) cats.add(item.category);
    });
    return ['All', ...Array.from(cats)];
  }, [items]);

  // Analytics Metrics
  const metrics = useMemo(() => {
    const totalCount = items.length;
    const activeInPosCount = items.filter((i) => i.posAvailable !== false).length;
    const avgPosPrice =
      totalCount > 0
        ? items.reduce((sum, i) => sum + (i.posPrice ?? i.price), 0) / totalCount
        : 0;

    return {
      totalCount,
      activeInPosCount,
      avgPosPrice,
    };
  }, [items]);

  // Filtered & Sorted items
  const filteredItems = useMemo(() => {
    let result = items.filter((item) => {
      const q = searchTerm.toLowerCase().trim();
      const matchSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q);

      const matchCategory = selectedCategory === 'All' || item.category === selectedCategory;

      const matchAvail =
        availabilityFilter === 'All' ||
        (availabilityFilter === 'Active' && item.posAvailable !== false) ||
        (availabilityFilter === 'Hidden' && item.posAvailable === false);

      return matchSearch && matchCategory && matchAvail;
    });

    result.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'code') return a.code.localeCompare(b.code);
      const priceA = a.posPrice ?? a.price;
      const priceB = b.posPrice ?? b.price;
      if (sortBy === 'pos_price_desc') return priceB - priceA;
      if (sortBy === 'pos_price_asc') return priceA - priceB;
      return 0;
    });

    return result;
  }, [items, searchTerm, selectedCategory, availabilityFilter, sortBy]);

  // Handle single item POS price save
  const handleSaveItemPrice = async (item: PosPriceItem, customValue?: number) => {
    const rawVal = customValue !== undefined ? String(customValue) : priceEdits[item.id];
    const newPrice = rawVal !== undefined ? parseFloat(rawVal) : item.posPrice ?? item.price;

    if (isNaN(newPrice) || newPrice < 0) {
      toast.warning('Invalid Price', 'Please enter a valid positive price amount.');
      return;
    }

    try {
      setSavingId(item.id);
      await updateDoc(doc(db, 'items', item.id), {
        posPrice: newPrice,
        updatedAt: serverTimestamp(),
      });

      // Clear local edit tracking for this item
      setPriceEdits((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });

      toast.success('Price Updated', `POS Price for ${item.name} set to ₹${newPrice.toFixed(2)}.`);
    } catch (err: any) {
      console.error('Error updating POS price:', err);
      toast.error('Update Failed', err?.message || 'Could not save price.');
    } finally {
      setSavingId(null);
    }
  };

  // Toggle item POS Availability
  const handleTogglePosAvailability = async (item: PosPriceItem) => {
    const newStatus = !item.posAvailable;
    try {
      await updateDoc(doc(db, 'items', item.id), {
        posAvailable: newStatus,
        updatedAt: serverTimestamp(),
      });
      toast.success(
        newStatus ? 'Item Visible in POS' : 'Item Hidden from POS',
        `${item.name} is now ${newStatus ? 'available' : 'hidden'} on Billing & POS counters.`
      );
    } catch (err: any) {
      toast.error('Failed to update status', err?.message);
    }
  };

  // Reset all filtered items POS Price to Master Price
  const handleResetAllToMaster = async () => {
    if (!window.confirm(`Reset POS prices for ${filteredItems.length} products to their Master Catalog Price?`)) {
      return;
    }

    try {
      setIsBulkAdjusting(true);
      for (const item of filteredItems) {
        await updateDoc(doc(db, 'items', item.id), {
          posPrice: item.price,
          updatedAt: serverTimestamp(),
        });
      }
      toast.success('Prices Synced', `Reset ${filteredItems.length} items to Master Price.`);
    } catch (err: any) {
      toast.error('Sync Error', err?.message);
    } finally {
      setIsBulkAdjusting(false);
    }
  };

  // Apply Bulk Percentage markup/discount
  const handleApplyBulkAdjustment = async () => {
    const percent = parseFloat(bulkAdjustmentPercent);
    if (isNaN(percent)) {
      toast.warning('Invalid Percentage', 'Please enter a valid percentage adjustment.');
      return;
    }

    const actionText = percent >= 0 ? `+${percent}% markup` : `${percent}% discount`;
    if (!window.confirm(`Apply ${actionText} to all ${filteredItems.length} filtered products for Billing & POS?`)) {
      return;
    }

    try {
      setIsBulkAdjusting(true);
      for (const item of filteredItems) {
        const base = item.price || 0;
        const adjusted = Math.round(base * (1 + percent / 100));
        await updateDoc(doc(db, 'items', item.id), {
          posPrice: adjusted,
          updatedAt: serverTimestamp(),
        });
      }
      setBulkAdjustmentPercent('');
      toast.success('Bulk Update Applied', `Updated ${filteredItems.length} product prices with ${actionText}.`);
    } catch (err: any) {
      toast.error('Bulk Update Failed', err?.message);
    } finally {
      setIsBulkAdjusting(false);
    }
  };

  // Count unsaved modified items
  const modifiedEntries = useMemo(() => {
    return Object.entries(priceEdits).filter(([id, val]) => {
      const item = items.find((i) => i.id === id);
      if (!item) return false;
      const num = parseFloat(val);
      if (isNaN(num) || num < 0) return false;
      const current = item.posPrice ?? item.price;
      return num !== current;
    });
  }, [priceEdits, items]);

  const [isSavingAll, setIsSavingAll] = useState(false);

  // Global Save All Modified Prices
  const handleSaveAllPrices = async () => {
    if (modifiedEntries.length === 0) {
      toast.info('No Changes', 'No price modifications to save.');
      return;
    }

    try {
      setIsSavingAll(true);
      const promises = modifiedEntries.map(([id, val]) => {
        const newPrice = parseFloat(val);
        return updateDoc(doc(db, 'items', id), {
          posPrice: newPrice,
          updatedAt: serverTimestamp(),
        });
      });

      await Promise.all(promises);
      setPriceEdits({});
      toast.success(
        'All Prices Saved',
        `Successfully updated POS prices for ${modifiedEntries.length} products.`
      );
    } catch (err: any) {
      console.error('Error saving all POS prices:', err);
      toast.error('Save Failed', err?.message || 'Could not save all prices.');
    } finally {
      setIsSavingAll(false);
    }
  };

  const handleDiscardAllEdits = () => {
    setPriceEdits({});
    toast.info('Changes Discarded', 'Reverted all unsaved price inputs.');
  };

  return (
    <div className="w-full min-h-screen bg-[#f6f6f7] font-sans pb-24">
      {/* ── Top Header Banner ── */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shadow-2xs">
              <Coins size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-slate-900 tracking-tight">Billing &amp; POS Prices</h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {metrics.activeInPosCount} POS Active Items
                </span>
                {modifiedEntries.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                    {modifiedEntries.length} Unsaved
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Set and synchronize live retail counter selling prices with automatic real-time POS update.
              </p>
            </div>
          </div>

          {/* Quick Action Links & Global Save */}
          <div className="flex items-center gap-2 flex-wrap">
            {modifiedEntries.length > 0 && (
              <button
                type="button"
                onClick={handleDiscardAllEdits}
                disabled={isSavingAll}
                className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-300 transition-all cursor-pointer"
              >
                Discard
              </button>
            )}

            <button
              type="button"
              onClick={handleSaveAllPrices}
              disabled={modifiedEntries.length === 0 || isSavingAll}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer ${
                modifiedEntries.length > 0
                  ? 'bg-emerald-700 hover:bg-emerald-800 text-white animate-bounce'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              {isSavingAll ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Saving All...</span>
                </>
              ) : (
                <>
                  <Save size={14} />
                  <span>Save All Changes {modifiedEntries.length > 0 ? `(${modifiedEntries.length})` : ''}</span>
                </>
              )}
            </button>

            <Link
              href="/pos"
              className="px-3.5 py-2 rounded-xl bg-[#02626D] hover:bg-[#014d56] text-white text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
            >
              <Receipt size={14} />
              <span>POS Counter</span>
              <ExternalLink size={11} className="opacity-70" />
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* ── Analytics Metric Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Total POS Items</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">{metrics.totalCount} Products</h3>
              <p className="text-[11px] text-slate-400 mt-1">Configured in Master Catalog</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-200 text-[#02626D] flex items-center justify-center">
              <ShoppingBag size={22} />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Active in POS Counter</p>
              <h3 className="text-2xl font-black text-emerald-700 mt-1">{metrics.activeInPosCount} Active</h3>
              <p className="text-[11px] text-emerald-600 font-semibold mt-1">
                {((metrics.activeInPosCount / (metrics.totalCount || 1)) * 100).toFixed(0)}% available at billing
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 size={22} />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Average POS Rate</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">₹ {metrics.avgPosPrice.toFixed(2)}</h3>
              <p className="text-[11px] text-slate-400 mt-1">Average Selling Price per Unit</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center">
              <Tag size={22} />
            </div>
          </div>
        </div>

        {/* ── Toolbar: Search, Filters & Bulk Price Tool ── */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-3">
            {/* Search Box */}
            <div className="relative w-full lg:w-80">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search product code, name, category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-9.5 pl-9 pr-3 text-xs font-medium border border-slate-200 rounded-xl bg-slate-50/70 focus:bg-white focus:outline-none focus:border-[#02626D] transition-colors"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-2 w-full lg:w-auto flex-wrap justify-end">
              {/* Category Select */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="h-9 px-3 text-xs font-bold border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-[#02626D]"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat === 'All' ? 'All Categories' : cat}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={availabilityFilter}
                onChange={(e) => setAvailabilityFilter(e.target.value as any)}
                className="h-9 px-3 text-xs font-bold border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-[#02626D]"
              >
                <option value="All">All Counter Status</option>
                <option value="Active">POS Active Only</option>
                <option value="Hidden">Hidden from POS</option>
              </select>

              {/* Sort By */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="h-9 px-3 text-xs font-bold border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-[#02626D]"
              >
                <option value="name">Product Name (A-Z)</option>
                <option value="code">Product Code</option>
                <option value="pos_price_desc">Highest POS Price</option>
                <option value="pos_price_asc">Lowest POS Price</option>
              </select>
            </div>
          </div>

          {/* ── Bulk Price Adjuster Sub-Bar ── */}
          <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-600 flex items-center gap-1">
                <Sliders size={13} className="text-[#02626D]" /> Bulk Quick Adjust:
              </span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 5 or -10"
                  value={bulkAdjustmentPercent}
                  onChange={(e) => setBulkAdjustmentPercent(e.target.value)}
                  className="w-24 h-8 px-2 text-xs font-bold border border-slate-300 rounded-lg bg-white"
                />
                <span className="font-bold text-slate-500">%</span>
                <button
                  type="button"
                  onClick={handleApplyBulkAdjustment}
                  disabled={!bulkAdjustmentPercent || isBulkAdjusting}
                  className="h-8 px-3 rounded-lg bg-[#02626D] hover:bg-[#014d56] text-white font-bold transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
                >
                  Apply to Filtered ({filteredItems.length})
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetAllToMaster}
                disabled={isBulkAdjusting}
                className="h-8 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold border border-slate-300 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                title="Reset POS Selling Price to match Item Master MRP"
              >
                <RotateCcw size={12} />
                <span>Sync with Master MRP</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── Products & Prices Table ── */}
        {isLoading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-16 flex flex-col items-center justify-center gap-3">
            <Loader2 size={32} className="animate-spin text-[#02626D]" />
            <p className="text-xs font-bold text-slate-500">Loading Billing &amp; POS Prices...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center flex flex-col items-center justify-center gap-2 text-slate-400">
            <AlertCircle size={36} className="text-amber-500" />
            <p className="text-sm font-bold text-slate-700">No Products Found</p>
            <p className="text-xs text-slate-500">
              {searchTerm ? 'Try adjusting your search criteria.' : 'Add items in the Item Master to set POS prices.'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="px-6 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">Configured Products Price List</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Showing {filteredItems.length} products with live counter pricing
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase text-[11px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Item Code</th>
                    <th className="py-3 px-4">Product Name</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Unit</th>
                    <th className="py-3 px-4 text-right">Master MRP</th>
                    <th className="py-3 px-4 text-center">POS Selling Price (₹)</th>
                    <th className="py-3 px-4 text-center">Margin / Diff</th>
                    <th className="py-3 px-4 text-center">POS Counter Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {filteredItems.map((item) => {
                    const currentPosPrice = item.posPrice ?? item.price;
                    const isEdited =
                      priceEdits[item.id] !== undefined &&
                      parseFloat(priceEdits[item.id]) !== currentPosPrice;
                    const diff = currentPosPrice - item.price;
                    const diffPercent = item.price > 0 ? (diff / item.price) * 100 : 0;
                    const isSaving = savingId === item.id;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Code */}
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">
                          {item.code || '—'}
                        </td>

                        {/* Name & Photo */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            {item.imageUrl ? (
                              <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-slate-200 shrink-0">
                                <Image
                                  src={item.imageUrl}
                                  alt={item.name}
                                  fill
                                  sizes="32px"
                                  className="object-cover"
                                />
                              </div>
                            ) : (
                              <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                                <Tag size={13} />
                              </div>
                            )}
                            <span className="font-extrabold text-slate-900">{item.name}</span>
                          </div>
                        </td>

                        {/* Category */}
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            {item.category}
                          </span>
                        </td>

                        {/* Unit */}
                        <td className="py-3 px-4 font-bold text-slate-600">{item.unit}</td>

                        {/* Master MRP */}
                        <td className="py-3 px-4 text-right font-semibold text-slate-500">
                          ₹ {item.price.toFixed(2)}
                        </td>

                        {/* POS Selling Price Input */}
                        <td className="py-3 px-4 text-center">
                          <div className="inline-flex items-center gap-1">
                            <span className="font-black text-slate-400 text-xs">₹</span>
                            <input
                              type="number"
                              step="any"
                              min="0"
                              value={
                                priceEdits[item.id] !== undefined
                                  ? priceEdits[item.id]
                                  : String(currentPosPrice)
                              }
                              onChange={(e) => {
                                const val = e.target.value;
                                setPriceEdits((prev) => ({
                                  ...prev,
                                  [item.id]: val,
                                }));
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleSaveItemPrice(item);
                                }
                              }}
                              className={`w-24 h-8 px-2 text-center text-xs font-black rounded-lg border transition-all ${
                                isEdited
                                  ? 'border-amber-400 bg-amber-50 text-amber-900 shadow-2xs'
                                  : 'border-slate-300 bg-white text-slate-900 focus:border-[#02626D]'
                              }`}
                            />
                          </div>
                        </td>

                        {/* Margin / Diff vs Master */}
                        <td className="py-3 px-4 text-center">
                          {diff === 0 ? (
                            <span className="text-[10px] font-bold text-slate-400">Exact MRP</span>
                          ) : diff > 0 ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              +₹{diff.toFixed(1)} (+{diffPercent.toFixed(0)}%)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200">
                              -₹{Math.abs(diff).toFixed(1)} ({diffPercent.toFixed(0)}%)
                            </span>
                          )}
                        </td>

                        {/* POS Available Toggle */}
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleTogglePosAvailability(item)}
                            className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide border transition-all cursor-pointer ${
                              item.posAvailable !== false
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                : 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200'
                            }`}
                          >
                            {item.posAvailable !== false ? 'POS Active' : 'Hidden'}
                          </button>
                        </td>

                        {/* Save Action */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {isEdited ? (
                              <button
                                type="button"
                                onClick={() => handleSaveItemPrice(item)}
                                disabled={isSaving}
                                className="px-2.5 py-1.5 rounded-lg bg-[#02626D] hover:bg-[#014d56] text-white text-[11px] font-bold shadow-2xs flex items-center gap-1 cursor-pointer transition-all animate-pulse"
                              >
                                {isSaving ? (
                                  <Loader2 size={11} className="animate-spin" />
                                ) : (
                                  <Save size={11} />
                                )}
                                <span>Save</span>
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-bold px-2 py-1">Synced</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Sticky Floating Bottom Bar for Unsaved Edits ── */}
      {modifiedEntries.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-xl px-4 animate-in slide-in-from-bottom-5 duration-200">
          <div className="bg-slate-900/95 text-white backdrop-blur-md rounded-2xl p-4 shadow-2xl border border-slate-700 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400 shrink-0">
                <Coins size={16} />
              </div>
              <div>
                <p className="text-xs font-black text-white">
                  {modifiedEntries.length} Product {modifiedEntries.length === 1 ? 'Price' : 'Prices'} Modified
                </p>
                <p className="text-[11px] text-slate-400">Save to update live counter rates across all POS terminals.</p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleDiscardAllEdits}
                disabled={isSavingAll}
                className="px-3 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Discard
              </button>

              <button
                type="button"
                onClick={handleSaveAllPrices}
                disabled={isSavingAll}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition-all shadow-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSavingAll ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save size={13} />
                    <span>Save All ({modifiedEntries.length})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Boxes,
  Layers,
  Tag,
  Plus,
  Search,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
  X,
  Loader2,
  AlertTriangle,
  Sparkles,
  Sliders,
  Package,
} from 'lucide-react';
import { db } from '@/lib/firebase';
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  serverTimestamp,
} from 'firebase/firestore';

export type UtilityType = 'box' | 'shrink' | 'sticker';

export interface UtilityItem {
  id: string;
  type: UtilityType;
  name: string;
  price: number;
  status: 'Active' | 'Inactive';
  description?: string;
  createdAt?: any;
  updatedAt?: any;
}

export default function UtilitiesClient() {
  const [activeTab, setActiveTab] = useState<UtilityType>('box');
  const [items, setItems] = useState<UtilityItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<UtilityItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<UtilityItem | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Form State
  const [formName, setFormName] = useState<string>('');
  const [formPrice, setFormPrice] = useState<string>('0');
  const [formStatus, setFormStatus] = useState<'Active' | 'Inactive'>('Active');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formError, setFormError] = useState<string>('');

  // Helper to remove any undefined fields before writing to Firestore
  const sanitizeForFirestore = (obj: any): any => {
    if (obj === undefined) return null;
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) {
      return obj.map(sanitizeForFirestore);
    }
    const clean: any = {};
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (val !== undefined) {
        clean[key] = sanitizeForFirestore(val);
      }
    }
    return clean;
  };

  // 1. Subscribe to Firestore `utilities` collection (pure listener, no auto-creation)
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'utilities')),
      (snapshot) => {
        const fetched: UtilityItem[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<UtilityItem, 'id'>),
        }));

        setItems(fetched);
        setIsLoading(false);
      },
      (err) => {
        console.error('Error fetching utilities:', err);
        setIsLoading(false);
      }
    );

    return () => unsub();
  }, []);

  // Filter items by active tab and search query
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (item.type !== activeTab) return false;
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase().trim();
      return (
        item.name.toLowerCase().includes(q) ||
        (item.description || '').toLowerCase().includes(q)
      );
    });
  }, [items, activeTab, searchTerm]);

  // Tab Metrics
  const boxesCount = items.filter((i) => i.type === 'box').length;
  const shrinksCount = items.filter((i) => i.type === 'shrink').length;
  const stickersCount = items.filter((i) => i.type === 'sticker').length;

  const openAddModal = () => {
    setEditingItem(null);
    setFormName('');
    setFormPrice('0');
    setFormStatus('Active');
    setFormDescription('');
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (item: UtilityItem) => {
    setEditingItem(item);
    setFormName(item.name);
    setFormPrice(item.price.toString());
    setFormStatus(item.status);
    setFormDescription(item.description || '');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const trimmedName = formName.trim();
    if (!trimmedName) {
      setFormError('Please enter a valid name.');
      return;
    }

    const parsedPrice = parseFloat(formPrice);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      setFormError('Please enter a valid price (₹ 0 or greater).');
      return;
    }

    setIsSaving(true);
    try {
      if (editingItem) {
        await updateDoc(doc(db, 'utilities', editingItem.id), sanitizeForFirestore({
          name: trimmedName,
          price: parsedPrice,
          status: formStatus,
          description: formDescription.trim(),
          updatedAt: serverTimestamp(),
        }));
      } else {
        await addDoc(collection(db, 'utilities'), sanitizeForFirestore({
          type: activeTab,
          name: trimmedName,
          price: parsedPrice,
          status: formStatus,
          description: formDescription.trim(),
          createdAt: serverTimestamp(),
        }));
      }

      setIsModalOpen(false);
      setEditingItem(null);
    } catch (err: any) {
      console.error('Failed to save utility item:', err);
      setFormError(err?.message || 'Failed to save utility item. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingItem) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'utilities', deletingItem.id));
      setDeletingItem(null);
    } catch (err) {
      console.error('Failed to delete utility item:', err);
      alert('Failed to delete item. Please check your connection.');
    } finally {
      setIsDeleting(false);
    }
  };

  const getTabLabel = (type: UtilityType) => {
    switch (type) {
      case 'box': return 'Box';
      case 'shrink': return 'Shrink';
      case 'sticker': return 'Sticker';
    }
  };

  const getTabPlural = (type: UtilityType) => {
    switch (type) {
      case 'box': return 'Boxes';
      case 'shrink': return 'Shrink Wrapping';
      case 'sticker': return 'Stickers';
    }
  };

  return (
    <div className="w-full flex flex-col gap-6 text-slate-800 pb-16 font-sans">
      
      {/* ── 1. PAGE HEADER BAR ──────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#02626D] text-white flex items-center justify-center shadow-xs">
            <Sliders size={19} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Utilities Setup</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Manage custom order packaging options: Boxes, Shrink wrap, and Stickers
            </p>
          </div>
        </div>

        <button
          onClick={openAddModal}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#02626D] hover:bg-[#024f58] text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
        >
          <Plus size={15} />
          <span>Add {getTabLabel(activeTab)}</span>
        </button>
      </div>

      {/* ── 2. TAB SWITCHER ────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-slate-200/90 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setActiveTab('box'); setSearchTerm(''); }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'box'
                ? 'bg-[#02626D] text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Boxes size={14} />
            <span>Boxes ({boxesCount})</span>
          </button>

          <button
            onClick={() => { setActiveTab('shrink'); setSearchTerm(''); }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'shrink'
                ? 'bg-[#02626D] text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Layers size={14} />
            <span>Shrink ({shrinksCount})</span>
          </button>

          <button
            onClick={() => { setActiveTab('sticker'); setSearchTerm(''); }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'sticker'
                ? 'bg-[#02626D] text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Tag size={14} />
            <span>Stickers ({stickersCount})</span>
          </button>
        </div>
      </div>

      {/* ── 3. MAIN CONTENT CONTAINER ──────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        
        {/* Search & Filter Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white">
          <div className="relative w-full sm:w-80">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={`Search ${getTabPlural(activeTab).toLowerCase()}...`}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:border-[#02626D] transition-all"
            />
          </div>

          <span className="text-xs font-bold text-slate-500 self-start sm:self-auto">
            Showing {filteredItems.length} {getTabPlural(activeTab).toLowerCase()}
          </span>
        </div>

        {/* Utilities Table */}
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs font-medium">
              <Loader2 size={24} className="animate-spin text-[#02626D]" />
              <span>Loading {getTabPlural(activeTab)}...</span>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs font-medium space-y-2">
              <Package size={32} className="mx-auto text-slate-300 stroke-[1.5]" />
              <p className="text-slate-600 font-bold text-sm">No {getTabPlural(activeTab)} found</p>
              <p>Click &quot;Add {getTabLabel(activeTab)}&quot; to configure your first option.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[650px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-600 uppercase">
                  <th className="py-3.5 px-4 sm:px-6">Name</th>
                  <th className="py-3.5 px-4">Price (₹)</th>
                  <th className="py-3.5 px-4">Description</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 sm:pr-6 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 sm:px-6 font-bold text-slate-900 flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg bg-teal-50 text-[#02626D] flex items-center justify-center flex-shrink-0 font-bold text-xs border border-teal-100">
                        {activeTab === 'box' ? '📦' : activeTab === 'shrink' ? '🔲' : '🏷'}
                      </span>
                      <span>{item.name}</span>
                    </td>
                    <td className="py-3.5 px-4 font-extrabold text-slate-900">
                      ₹ {item.price.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 max-w-xs truncate">
                      {item.description || '—'}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                          item.status === 'Active'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {item.status === 'Active' ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                        {item.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 sm:pr-6 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => openEditModal(item)}
                          className="flex items-center justify-center h-7 w-7 rounded-lg text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200/80 transition-colors cursor-pointer shadow-2xs"
                          title="Edit Item"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => setDeletingItem(item)}
                          className="flex items-center justify-center h-7 w-7 rounded-lg text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 transition-colors cursor-pointer shadow-2xs"
                          title="Delete Item"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>

      {/* ── 4. ADD / EDIT UTILITY MODAL ────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#02626D] text-white flex items-center justify-center shadow-xs">
                  {editingItem ? <Pencil size={15} /> : <Plus size={16} />}
                </div>
                <h3 className="text-sm font-bold text-slate-900">
                  {editingItem ? `Edit ${getTabLabel(activeTab)}` : `Add New ${getTabLabel(activeTab)}`}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSave} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle size={14} className="flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {getTabLabel(activeTab)} Name *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder={`e.g. ${activeTab === 'box' ? 'HandleBox 1Kg' : activeTab === 'shrink' ? 'Standard Shrink' : 'Golden Festival Sticker'}`}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-[#02626D] focus:ring-1 focus:ring-[#02626D] bg-white font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Price (₹) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-[#02626D] focus:ring-1 focus:ring-[#02626D] bg-white font-bold text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Status
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFormStatus('Active')}
                    className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      formStatus === 'Active'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-2xs'
                        : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Active
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormStatus('Inactive')}
                    className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      formStatus === 'Inactive'
                        ? 'bg-slate-100 text-slate-800 border-slate-300 shadow-2xs'
                        : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Inactive
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Description (Optional)
                </label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Notes, dimensions, or packaging details..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-[#02626D] focus:ring-1 focus:ring-[#02626D] bg-white font-medium"
                />
              </div>

              {/* Form Footer */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#02626D] hover:bg-[#024f58] text-white shadow-xs transition-all cursor-pointer disabled:opacity-60"
                >
                  {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  <span>{editingItem ? 'Update' : 'Save'} {getTabLabel(activeTab)}</span>
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* ── 5. DELETE CONFIRMATION MODAL ──────────────────────────── */}
      {deletingItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 text-red-500 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Delete {getTabLabel(deletingItem.type)}</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Are you sure you want to delete <strong className="text-slate-800">{deletingItem.name}</strong>?
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                onClick={() => setDeletingItem(null)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

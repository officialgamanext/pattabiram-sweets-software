'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Layers,
  Plus,
  Search,
  Edit2,
  Trash2,
  Check,
  X,
  Clock,
  Tag,
  Package,
  ShoppingBag,
  Sparkles,
  Info,
  CheckCircle2,
  AlertCircle,
  Copy,
  ChevronDown,
  ChevronUp,
  Filter,
} from 'lucide-react';
import { db } from '@/lib/firebase';
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { toast } from '@/context/ToastContext';

export const SLOT_TIMES = [
  '9:00 AM - 12:00 PM',
  '12:00 PM - 3:00 PM',
  '3:00 PM - 6:00 PM',
  '6:00 PM - 9:00 PM',
] as const;

export type SlotTime = typeof SLOT_TIMES[number];

export interface SlotCategory {
  id: string;
  name: string;
  description?: string;
  color?: string;
  assignedItemIds: string[];
  assignedItemNames: string[];
  slotLimits: Record<SlotTime, number>;
  status: 'active' | 'inactive';
  createdAt?: any;
  updatedAt?: any;
}

export interface ItemOption {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  price: number;
  imageUrl?: string;
  isFavorite?: boolean;
}

const CATEGORY_COLORS = [
  { name: 'Teal', bg: 'bg-[#02626D]', text: 'text-[#02626D]', border: 'border-[#02626D]', light: 'bg-teal-50', hex: '#02626D' },
  { name: 'Amber', bg: 'bg-amber-600', text: 'text-amber-700', border: 'border-amber-500', light: 'bg-amber-50', hex: '#d97706' },
  { name: 'Indigo', bg: 'bg-indigo-600', text: 'text-indigo-700', border: 'border-indigo-500', light: 'bg-indigo-50', hex: '#4f46e5' },
  { name: 'Rose', bg: 'bg-rose-600', text: 'text-rose-700', border: 'border-rose-500', light: 'bg-rose-50', hex: '#e11d48' },
  { name: 'Emerald', bg: 'bg-emerald-600', text: 'text-emerald-700', border: 'border-emerald-500', light: 'bg-emerald-50', hex: '#059669' },
  { name: 'Purple', bg: 'bg-purple-600', text: 'text-purple-700', border: 'border-purple-500', light: 'bg-purple-50', hex: '#9333ea' },
  { name: 'Cyan', bg: 'bg-cyan-600', text: 'text-cyan-700', border: 'border-cyan-500', light: 'bg-cyan-50', hex: '#0891b2' },
];

export default function SlotCategoriesClient() {
  const [categories, setCategories] = useState<SlotCategory[]>([]);
  const [itemsMaster, setItemsMaster] = useState<ItemOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<SlotCategory | null>(null);

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formColor, setFormColor] = useState('#02626D');
  const [formAssignedItemIds, setFormAssignedItemIds] = useState<string[]>([]);
  const [formSlotLimits, setFormSlotLimits] = useState<Record<SlotTime, string>>({
    '9:00 AM - 12:00 PM': '',
    '12:00 PM - 3:00 PM': '',
    '3:00 PM - 6:00 PM': '',
    '6:00 PM - 9:00 PM': '',
  });
  const [formStatus, setFormStatus] = useState<'active' | 'inactive'>('active');
  const [isSaving, setIsSaving] = useState(false);

  // Item Search within Modal
  const [itemSearchModal, setItemSearchModal] = useState('');
  const [selectedItemCategoryFilter, setSelectedItemCategoryFilter] = useState('All');
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);

  // 1. Subscribe to Slot Categories
  useEffect(() => {
    const unsubCategories = onSnapshot(
      collection(db, 'slot_categories'),
      (snap) => {
        const list: SlotCategory[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: data.name || 'Unnamed Category',
            description: data.description || '',
            color: data.color || '#02626D',
            assignedItemIds: Array.isArray(data.assignedItemIds) ? data.assignedItemIds : [],
            assignedItemNames: Array.isArray(data.assignedItemNames) ? data.assignedItemNames : [],
            slotLimits: data.slotLimits || {
              '9:00 AM - 12:00 PM': 0,
              '12:00 PM - 3:00 PM': 0,
              '3:00 PM - 6:00 PM': 0,
              '6:00 PM - 9:00 PM': 0,
            },
            status: data.status || 'active',
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          };
        });
        setCategories(list);
        setIsLoading(false);
      },
      (err) => {
        console.error('Error fetching slot categories:', err);
        toast.error('Failed to load', 'Could not sync slot categories.');
        setIsLoading(false);
      }
    );

    // 2. Subscribe to Items
    const unsubItems = onSnapshot(
      collection(db, 'items'),
      (snap) => {
        const list: ItemOption[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            code: data.code || '',
            name: data.name || 'Unnamed Item',
            category: data.category || 'General',
            unit: data.unit || 'KG',
            price: parseFloat(data.price || 0),
            imageUrl: data.imageUrl || '',
            isFavorite: Boolean(data.isFavorite),
          };
        });
        list.sort((a, b) => a.name.localeCompare(b.name));
        setItemsMaster(list);
      },
      (err) => console.error('Error fetching items for slot categories:', err)
    );

    return () => {
      unsubCategories();
      unsubItems();
    };
  }, []);

  // Distinct master item categories for filter
  const itemMasterCategories = useMemo(() => {
    const set = new Set<string>();
    itemsMaster.forEach((i) => {
      if (i.category) set.add(i.category);
    });
    return Array.from(set).sort();
  }, [itemsMaster]);

  // Modal Item Selection List
  const filteredModalItems = useMemo(() => {
    return itemsMaster.filter((item) => {
      const q = itemSearchModal.toLowerCase().trim();
      const matchSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q);

      const matchCat =
        selectedItemCategoryFilter === 'All' || item.category === selectedItemCategoryFilter;

      return matchSearch && matchCat;
    });
  }, [itemsMaster, itemSearchModal, selectedItemCategoryFilter]);

  // Open Create or Edit Modal
  const handleOpenModal = (cat?: SlotCategory) => {
    if (cat) {
      setEditingCategory(cat);
      setFormName(cat.name);
      setFormDescription(cat.description || '');
      setFormColor(cat.color || '#02626D');
      setFormAssignedItemIds(cat.assignedItemIds || []);
      setFormSlotLimits({
        '9:00 AM - 12:00 PM': String(cat.slotLimits?.['9:00 AM - 12:00 PM'] ?? ''),
        '12:00 PM - 3:00 PM': String(cat.slotLimits?.['12:00 PM - 3:00 PM'] ?? ''),
        '3:00 PM - 6:00 PM': String(cat.slotLimits?.['3:00 PM - 6:00 PM'] ?? ''),
        '6:00 PM - 9:00 PM': String(cat.slotLimits?.['6:00 PM - 9:00 PM'] ?? ''),
      });
      setFormStatus(cat.status || 'active');
    } else {
      setEditingCategory(null);
      setFormName('');
      setFormDescription('');
      setFormColor('#02626D');
      setFormAssignedItemIds([]);
      setFormSlotLimits({
        '9:00 AM - 12:00 PM': '',
        '12:00 PM - 3:00 PM': '',
        '3:00 PM - 6:00 PM': '',
        '6:00 PM - 9:00 PM': '',
      });
      setFormStatus('active');
    }
    setItemSearchModal('');
    setSelectedItemCategoryFilter('All');
    setIsModalOpen(true);
  };

  // Toggle item in modal assignment
  const handleToggleItem = (itemId: string) => {
    setFormAssignedItemIds((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  };

  // Select all filtered items in modal
  const handleSelectAllFilteredItems = () => {
    const idsToAdd = filteredModalItems.map((i) => i.id);
    setFormAssignedItemIds((prev) => Array.from(new Set([...prev, ...idsToAdd])));
  };

  // Deselect all filtered items in modal
  const handleDeselectAllFilteredItems = () => {
    const idsToRemove = new Set(filteredModalItems.map((i) => i.id));
    setFormAssignedItemIds((prev) => prev.filter((id) => !idsToRemove.has(id)));
  };

  // Copy first slot limit to all other slots
  const handleCopyLimitToAllSlots = () => {
    const firstVal = formSlotLimits['9:00 AM - 12:00 PM'];
    if (firstVal === '') return;
    setFormSlotLimits({
      '9:00 AM - 12:00 PM': firstVal,
      '12:00 PM - 3:00 PM': firstVal,
      '3:00 PM - 6:00 PM': firstVal,
      '6:00 PM - 9:00 PM': firstVal,
    });
    toast.success('Limits Copied', `Applied ${firstVal} KG/Units across all 4 time slots.`);
  };

  // Save Category
  const handleSaveCategory = async () => {
    if (!formName.trim()) {
      toast.warning('Name Required', 'Please enter a name for this Slot Category.');
      return;
    }

    const assignedNames = formAssignedItemIds
      .map((id) => itemsMaster.find((i) => i.id === id)?.name)
      .filter(Boolean) as string[];

    const numericSlotLimits: Record<SlotTime, number> = {
      '9:00 AM - 12:00 PM': parseFloat(formSlotLimits['9:00 AM - 12:00 PM']) || 0,
      '12:00 PM - 3:00 PM': parseFloat(formSlotLimits['12:00 PM - 3:00 PM']) || 0,
      '3:00 PM - 6:00 PM': parseFloat(formSlotLimits['3:00 PM - 6:00 PM']) || 0,
      '6:00 PM - 9:00 PM': parseFloat(formSlotLimits['6:00 PM - 9:00 PM']) || 0,
    };

    const payload = {
      name: formName.trim(),
      description: formDescription.trim(),
      color: formColor,
      assignedItemIds: formAssignedItemIds,
      assignedItemNames: assignedNames,
      slotLimits: numericSlotLimits,
      status: formStatus,
      updatedAt: serverTimestamp(),
    };

    try {
      setIsSaving(true);
      if (editingCategory) {
        await updateDoc(doc(db, 'slot_categories', editingCategory.id), payload);
        toast.success('Category Updated', `Slot category "${formName}" updated successfully.`);
      } else {
        await addDoc(collection(db, 'slot_categories'), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        toast.success('Category Created', `Slot category "${formName}" created successfully.`);
      }
      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Error saving slot category:', err);
      toast.error('Save Failed', err.message || 'Could not save slot category.');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Category
  const handleDeleteCategory = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete slot category "${name}"?`)) return;
    try {
      await deleteDoc(doc(db, 'slot_categories', id));
      toast.success('Category Deleted', `Slot category "${name}" was removed.`);
    } catch (err: any) {
      console.error('Error deleting slot category:', err);
      toast.error('Delete Failed', err.message || 'Could not delete slot category.');
    }
  };

  // Filter Categories for Display
  const filteredCategories = useMemo(() => {
    return categories.filter((cat) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        cat.name.toLowerCase().includes(q) ||
        (cat.description && cat.description.toLowerCase().includes(q)) ||
        cat.assignedItemNames.some((n) => n.toLowerCase().includes(q));

      const matchStatus =
        statusFilter === 'all' || cat.status === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [categories, searchQuery, statusFilter]);

  // High-Level Aggregations
  const stats = useMemo(() => {
    let totalItemsAssignedCount = 0;
    const uniqueAssignedItemIds = new Set<string>();
    let totalSlotCapacity = 0;

    categories.forEach((c) => {
      if (c.status === 'active') {
        c.assignedItemIds.forEach((id) => uniqueAssignedItemIds.add(id));
        totalItemsAssignedCount += c.assignedItemIds.length;
        Object.values(c.slotLimits || {}).forEach((lim) => {
          totalSlotCapacity += lim || 0;
        });
      }
    });

    return {
      totalCategories: categories.length,
      activeCategories: categories.filter((c) => c.status === 'active').length,
      uniqueAssignedItems: uniqueAssignedItemIds.size,
      totalSlotCapacity,
    };
  }, [categories]);

  return (
    <div className="w-full min-h-screen bg-[#f6f6f7] p-4 sm:p-6 md:p-8 space-y-6">
      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 shadow-2xs">
            <Layers size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 tracking-tight">Slot Categories & Limits</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-indigo-50 text-indigo-800 border border-indigo-200">
                {categories.length} Categories
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Group products into categories, assign items, and configure maximum batch limits per delivery slot.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/orders"
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
          >
            <ShoppingBag size={14} />
            <span>Orders by Slot</span>
          </Link>

          <button
            type="button"
            onClick={() => handleOpenModal()}
            className="px-4 py-2 rounded-xl bg-[#02626D] hover:bg-[#014d56] text-white text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center gap-1.5 active:scale-95"
          >
            <Plus size={15} />
            <span>Add Slot Category</span>
          </button>
        </div>
      </div>

      {/* ── SUMMARY STATS BAR ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Categories</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-slate-900">{stats.totalCategories}</span>
            <span className="text-xs text-emerald-600 font-bold">({stats.activeCategories} Active)</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Assigned Products</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-indigo-700">{stats.uniqueAssignedItems}</span>
            <span className="text-xs text-slate-400 font-semibold">of {itemsMaster.length} Total</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Daily Slot Capacity</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-emerald-700">
              {stats.totalSlotCapacity.toLocaleString()}
            </span>
            <span className="text-xs text-slate-400 font-semibold">KG / Units max</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Active Delivery Slots</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-amber-700">4 Slots</span>
            <span className="text-xs text-slate-400 font-semibold">9 AM to 9 PM</span>
          </div>
        </div>
      </div>

      {/* ── FILTER & SEARCH TOOLBAR ────────────────────────────────────────── */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search categories or assigned items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-[#02626D] focus:outline-none transition-all text-slate-800 font-medium"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            {(['all', 'active', 'inactive'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg font-bold capitalize transition-all cursor-pointer ${
                  statusFilter === st
                    ? 'bg-white text-[#02626D] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── CATEGORIES LIST ─────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="p-16 text-center bg-white rounded-2xl border border-slate-200 flex flex-col items-center justify-center gap-2">
          <div className="w-8 h-8 border-2 border-[#02626D] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-bold text-slate-500">Loading Slot Categories...</p>
        </div>
      ) : filteredCategories.length === 0 ? (
        <div className="p-16 text-center bg-white rounded-2xl border border-slate-200 flex flex-col items-center justify-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Layers size={28} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">No Slot Categories Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              {searchQuery
                ? 'No categories match your search keywords.'
                : 'Create your first Slot Category to group items and configure maximum delivery slot capacities.'}
            </p>
          </div>
          {!searchQuery && (
            <button
              type="button"
              onClick={() => handleOpenModal()}
              className="mt-2 px-4 py-2 rounded-xl bg-[#02626D] hover:bg-[#014d56] text-white text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center gap-1.5"
            >
              <Plus size={14} />
              <span>Create Slot Category</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredCategories.map((cat) => {
            const isExpanded = expandedCategoryId === cat.id;
            const assignedItems = itemsMaster.filter((i) => cat.assignedItemIds.includes(i.id));

            return (
              <div
                key={cat.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-2xs hover:shadow-xs transition-all overflow-hidden flex flex-col justify-between"
              >
                {/* Card Header with Color Accent */}
                <div>
                  <div
                    className="h-2 w-full"
                    style={{ backgroundColor: cat.color || '#02626D' }}
                  />

                  <div className="p-5 space-y-4">
                    {/* Top Row: Name + Actions */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
                            {cat.name}
                          </h3>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                              cat.status === 'active'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-slate-100 text-slate-500 border-slate-200'
                            }`}
                          >
                            {cat.status}
                          </span>
                        </div>
                        {cat.description && (
                          <p className="text-xs text-slate-500 font-medium mt-1 leading-snug">
                            {cat.description}
                          </p>
                        )}
                      </div>

                      {/* Edit / Delete Buttons */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenModal(cat)}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                          title="Edit Category"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(cat.id, cat.name)}
                          className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer"
                          title="Delete Category"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Slot-Wise Capacity Breakdown Grid */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                        <span className="flex items-center gap-1">
                          <Clock size={12} className="text-[#02626D]" /> Slot Max Limits
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">KG / Units</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {SLOT_TIMES.map((slot) => {
                          const limit = cat.slotLimits?.[slot] || 0;
                          return (
                            <div
                              key={slot}
                              className="p-2 bg-white rounded-lg border border-slate-200 flex flex-col justify-between"
                            >
                              <span className="text-[9.5px] font-bold text-slate-400 truncate" title={slot}>
                                {slot}
                              </span>
                              <span className="text-xs font-black text-slate-900 mt-0.5">
                                {limit > 0 ? `${limit} Max` : <span className="text-slate-300 font-normal">No Limit</span>}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Assigned Items Section */}
                    <div>
                      <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                        <span className="flex items-center gap-1.5">
                          <Tag size={13} className="text-indigo-600" />
                          <span>Assigned Products ({cat.assignedItemIds.length})</span>
                        </span>
                        {cat.assignedItemIds.length > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedCategoryId(isExpanded ? null : cat.id)
                            }
                            className="text-[11px] text-[#02626D] hover:underline flex items-center gap-0.5 font-bold cursor-pointer"
                          >
                            <span>{isExpanded ? 'Hide' : 'View All'}</span>
                            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </button>
                        )}
                      </div>

                      {cat.assignedItemIds.length === 0 ? (
                        <p className="text-[11px] text-slate-400 italic mt-1.5 bg-amber-50/70 p-2 rounded-lg border border-amber-200/60 text-amber-800">
                          ⚠️ No products assigned yet. Edit this category to link items.
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {(isExpanded ? assignedItems : assignedItems.slice(0, 5)).map((item) => (
                            <span
                              key={item.id}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-50/70 border border-indigo-200 text-indigo-800 text-[10.5px] font-semibold"
                            >
                              <span>{item.name}</span>
                              <span className="text-[9px] text-indigo-400 font-mono">({item.unit})</span>
                            </span>
                          ))}
                          {!isExpanded && cat.assignedItemIds.length > 5 && (
                            <button
                              type="button"
                              onClick={() => setExpandedCategoryId(cat.id)}
                              className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 text-[10.5px] font-bold hover:bg-slate-200 cursor-pointer"
                            >
                              +{cat.assignedItemIds.length - 5} more
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Footer */}
                <div className="px-5 py-3 bg-[#fafafa] border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-medium">
                  <span>Capacity Rule: Slot-Wise</span>
                  <span>{cat.assignedItemIds.length} Linked Items</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── CREATE / EDIT SLOT CATEGORY MODAL ─────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shadow-2xs">
                  <Layers size={20} />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">
                    {editingCategory ? `Edit: ${editingCategory.name}` : 'Create New Slot Category'}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Configure category details, link product items, and set slot maximum weights.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body - Scrollable */}
            <div className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1">
              {/* 1. Category Information */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  1. Category Details
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Category Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Special Ghee Sweets, Bengali Sweets..."
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white focus:border-[#02626D] focus:outline-none transition-all text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Color Accent Tag
                    </label>
                    <div className="flex items-center gap-2 pt-1">
                      {CATEGORY_COLORS.map((c) => (
                        <button
                          key={c.hex}
                          type="button"
                          onClick={() => setFormColor(c.hex)}
                          className={`w-7 h-7 rounded-xl transition-all cursor-pointer flex items-center justify-center shadow-2xs ${
                            c.bg
                          } ${
                            formColor === c.hex
                              ? 'ring-2 ring-offset-2 ring-slate-800 scale-110'
                              : 'opacity-70 hover:opacity-100'
                          }`}
                          title={c.name}
                        >
                          {formColor === c.hex && <Check size={12} className="text-white font-bold" />}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Description / Kitchen Notes (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Short description or production instructions..."
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-[#02626D] focus:outline-none transition-all text-slate-700 font-medium"
                  />
                </div>
              </div>

              {/* 2. Slot-Wise Quantity Capacity Limits */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      2. Slot-Wise Maximum Allowed Quantity (KG / Units)
                    </h4>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Maximum combined weight or quantity of all items in this category allowed per order slot.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyLimitToAllSlots}
                    className="text-[11px] font-bold text-[#02626D] hover:underline flex items-center gap-1 cursor-pointer self-start sm:self-auto"
                    title="Copy Slot 1 value to all other 3 slots"
                  >
                    <Copy size={12} />
                    <span>Copy Slot 1 to All</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  {SLOT_TIMES.map((slot, idx) => (
                    <div key={slot} className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                      <span className="text-[10px] font-extrabold text-slate-500 block truncate">
                        Slot {idx + 1}: {slot}
                      </span>
                      <div className="relative">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          placeholder="e.g. 300"
                          value={formSlotLimits[slot]}
                          onChange={(e) =>
                            setFormSlotLimits((prev) => ({
                              ...prev,
                              [slot]: e.target.value,
                            }))
                          }
                          className="w-full pl-3 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-xs font-extrabold text-slate-900 focus:border-[#02626D] focus:outline-none"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                          KG
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 3. Assign Product Items */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      3. Assign Products ({formAssignedItemIds.length} Selected)
                    </h4>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Select which sweet & snack items belong to this category for slot limit calculations.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAllFilteredItems}
                      className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold cursor-pointer transition-colors"
                    >
                      Select All Filtered
                    </button>
                    <button
                      type="button"
                      onClick={handleDeselectAllFilteredItems}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-bold cursor-pointer transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* Search & Category Filter for items */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search items by name, code or category..."
                      value={itemSearchModal}
                      onChange={(e) => setItemSearchModal(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-[#02626D] focus:outline-none"
                    />
                  </div>

                  {itemMasterCategories.length > 0 && (
                    <select
                      value={selectedItemCategoryFilter}
                      onChange={(e) => setSelectedItemCategoryFilter(e.target.value)}
                      className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none"
                    >
                      <option value="All">All Categories ({itemsMaster.length})</option>
                      {itemMasterCategories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Items Multi-Select Grid */}
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 max-h-56 overflow-y-auto space-y-1">
                  {filteredModalItems.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-6">
                      No product items match your search.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5">
                      {filteredModalItems.map((item) => {
                        const isSelected = formAssignedItemIds.includes(item.id);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleToggleItem(item.id)}
                            className={`p-2 rounded-xl text-left text-xs transition-all cursor-pointer flex items-center justify-between gap-1.5 border ${
                              isSelected
                                ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-bold shadow-2xs'
                                : 'bg-white border-slate-200/80 hover:border-slate-300 text-slate-700'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <span className="block truncate font-semibold">{item.name}</span>
                              <span className="text-[9.5px] text-slate-400 font-mono block">
                                {item.code} • ₹{item.price}/{item.unit}
                              </span>
                            </div>
                            <div
                              className={`w-4 h-4 rounded-md flex items-center justify-center flex-shrink-0 ${
                                isSelected ? 'bg-indigo-600 text-white' : 'border border-slate-300 bg-white'
                              }`}
                            >
                              {isSelected && <Check size={10} />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-5 sm:p-6 border-t border-slate-100 flex items-center justify-between bg-slate-50">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isSaving}
                onClick={handleSaveCategory}
                className="px-6 py-2.5 rounded-xl bg-[#02626D] hover:bg-[#014d56] text-white text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                {isSaving && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                <span>{editingCategory ? 'Update Slot Category' : 'Save Slot Category'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

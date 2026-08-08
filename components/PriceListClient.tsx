'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Plus,
  Search,
  Download,
  Eye,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
  Loader2,
  Filter,
  AlertTriangle,
  ClipboardList,
  Tag,
  Check,
  RotateCcw,
  Percent,
  Sparkles,
} from 'lucide-react';
import CustomSelect, { CustomSelectOption } from '@/components/CustomSelect';
import Pagination from '@/components/Pagination';
import { db } from '@/lib/firebase';
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
} from 'firebase/firestore';

export interface PriceListItemProduct {
  itemId: string;
  itemCode: string;
  itemName: string;
  category: string;
  unit: string;
  imageUrl?: string;
  defaultPrice: number;
  customPrice: number;
}

export interface PriceListRecord {
  id: string;
  code: string;
  name: string;
  status: 'Active' | 'Inactive';
  items: PriceListItemProduct[];
  totalItems: number;
  createdAt?: any;
}

interface ItemMaster {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  price: number;
  imageUrl?: string;
}

export default function PriceListClient() {
  const [priceLists, setPriceLists] = useState<PriceListRecord[]>([]);
  const [masterItems, setMasterItems] = useState<ItemMaster[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [firebaseError, setFirebaseError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [itemsPerPage, setItemsPerPage] = useState('10');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingPriceList, setEditingPriceList] = useState<PriceListRecord | null>(null);
  const [viewingPriceList, setViewingPriceList] = useState<PriceListRecord | null>(null);
  const [deletingPriceList, setDeletingPriceList] = useState<PriceListRecord | null>(null);

  // Full screen form state
  const [priceListName, setPriceListName] = useState('');
  const [priceListStatus, setPriceListStatus] = useState<'Active' | 'Inactive'>('Active');
  const [modalItems, setModalItems] = useState<PriceListItemProduct[]>([]);
  const [modalSearchTerm, setModalSearchTerm] = useState('');
  const [modalCategoryFilter, setModalCategoryFilter] = useState('All');

  // 1. Subscribe to Price Lists from Firebase Firestore
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'price_lists')),
      (snapshot) => {
        const fetched: PriceListRecord[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<PriceListRecord, 'id'>),
        }));
        fetched.sort((a, b) => (a.code || '').localeCompare(b.code || ''));
        setPriceLists(fetched);
        setIsLoading(false);
        setFirebaseError(null);
      },
      (error) => {
        console.error('Error fetching price lists:', error);
        setFirebaseError(error.message || 'Failed to connect to database');
        setIsLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // 2. Subscribe to Items Master to populate products list
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'items')),
      (snapshot) => {
        const fetched: ItemMaster[] = snapshot.docs.map((d) => ({
          id: d.id,
          code: d.data().code || 'ITM-000',
          name: d.data().name || 'Unnamed Item',
          category: d.data().category || 'General',
          unit: d.data().unit || 'KG',
          price: parseFloat(d.data().price || 0),
          imageUrl: d.data().imageUrl || '',
        }));
        fetched.sort((a, b) => a.code.localeCompare(b.code));
        setMasterItems(fetched);
      }
    );
    return () => unsub();
  }, []);

  // Open Full-Screen Add Price List Modal
  const handleOpenAddModal = () => {
    setPriceListName('');
    setPriceListStatus('Active');
    setModalSearchTerm('');
    setModalCategoryFilter('All');

    // Populate modal items from masterItems with customPrice = defaultPrice
    const initialModalItems: PriceListItemProduct[] = masterItems.map((item) => ({
      itemId: item.id,
      itemCode: item.code,
      itemName: item.name,
      category: item.category,
      unit: item.unit,
      imageUrl: item.imageUrl,
      defaultPrice: item.price,
      customPrice: item.price,
    }));

    setModalItems(initialModalItems);
    setIsAddModalOpen(true);
  };

  // Open Full-Screen Edit Price List Modal
  const handleOpenEditModal = (plist: PriceListRecord) => {
    setEditingPriceList(plist);
    setPriceListName(plist.name);
    setPriceListStatus(plist.status);
    setModalSearchTerm('');
    setModalCategoryFilter('All');

    // Merge existing custom prices with current master items
    const existingMap = new Map(plist.items.map((i) => [i.itemId, i.customPrice]));

    const mergedModalItems: PriceListItemProduct[] = masterItems.map((item) => ({
      itemId: item.id,
      itemCode: item.code,
      itemName: item.name,
      category: item.category,
      unit: item.unit,
      imageUrl: item.imageUrl,
      defaultPrice: item.price,
      customPrice: existingMap.has(item.id) ? existingMap.get(item.id)! : item.price,
    }));

    setModalItems(mergedModalItems);
  };

  // Update Custom Price for a product inside full-screen modal
  const handleCustomPriceChange = (itemId: string, newPrice: string) => {
    const numPrice = parseFloat(newPrice) || 0;
    setModalItems((prev) =>
      prev.map((item) =>
        item.itemId === itemId ? { ...item, customPrice: numPrice } : item
      )
    );
  };

  // Apply Bulk Percentage discount or markup
  const handleApplyBulkPercentage = (pct: number) => {
    setModalItems((prev) =>
      prev.map((item) => {
        const newPrice = Math.max(0, Math.round(item.defaultPrice * (1 + pct / 100) * 100) / 100);
        return { ...item, customPrice: newPrice };
      })
    );
  };

  // Reset all modal custom prices to default price
  const handleResetAllModalPrices = () => {
    setModalItems((prev) =>
      prev.map((item) => ({ ...item, customPrice: item.defaultPrice }))
    );
  };

  // Handle Save New Price List to Firebase
  const handleSaveAddPriceList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!priceListName.trim()) return;

    try {
      setIsSubmitting(true);
      const nextNumber = priceLists.length + 1;
      const nextCode = `PRC-${String(nextNumber).padStart(3, '0')}`;

      await addDoc(collection(db, 'price_lists'), {
        code: nextCode,
        name: priceListName.trim(),
        status: priceListStatus,
        items: modalItems,
        totalItems: modalItems.length,
        createdAt: serverTimestamp(),
      });

      setIsAddModalOpen(false);
      setPriceListName('');
      setModalItems([]);
    } catch (err: any) {
      console.error('Failed to create price list:', err);
      setFirebaseError(err?.message || 'Failed to create price list');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Update Price List in Firebase
  const handleSaveUpdatePriceList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPriceList || !priceListName.trim()) return;

    try {
      setIsSubmitting(true);
      const docRef = doc(db, 'price_lists', editingPriceList.id);
      await updateDoc(docRef, {
        name: priceListName.trim(),
        status: priceListStatus,
        items: modalItems,
        totalItems: modalItems.length,
        updatedAt: serverTimestamp(),
      });

      setEditingPriceList(null);
      setPriceListName('');
      setModalItems([]);
    } catch (err: any) {
      console.error('Failed to update price list:', err);
      setFirebaseError(err?.message || 'Failed to update price list');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Price List from Firebase
  const handleConfirmDelete = async () => {
    if (!deletingPriceList) return;

    try {
      setIsDeleting(true);
      await deleteDoc(doc(db, 'price_lists', deletingPriceList.id));
      setDeletingPriceList(null);
    } catch (err: any) {
      console.error('Failed to delete price list:', err);
      setFirebaseError(err?.message || 'Failed to delete price list');
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered Price Lists for table
  const filteredPriceLists = priceLists.filter((plist) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      plist.name.toLowerCase().includes(term) ||
      plist.code.toLowerCase().includes(term);

    const matchesStatus =
      statusFilter === 'All' ? true : plist.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const [currentPage, setCurrentPage] = useState(1);
  const paginatedPriceLists = filteredPriceLists.slice((currentPage - 1) * 45, currentPage * 45);

  // Unique Categories in modal items
  const modalCategories = Array.from(new Set(modalItems.map((i) => i.category))).filter(Boolean);

  // Filtered Products inside full-screen modal
  const filteredModalItems = modalItems.filter((item) => {
    const term = modalSearchTerm.toLowerCase();
    const matchesSearch =
      item.itemName.toLowerCase().includes(term) ||
      item.itemCode.toLowerCase().includes(term) ||
      item.category.toLowerCase().includes(term);

    const matchesCategory =
      modalCategoryFilter === 'All' ? true : item.category === modalCategoryFilter;

    return matchesSearch && matchesCategory;
  });

  const modifiedCustomPricesCount = modalItems.filter(
    (i) => i.customPrice !== i.defaultPrice
  ).length;

  // Custom Dropdown options
  const statusFilterOptions: CustomSelectOption[] = [
    { value: 'All', label: 'All Statuses' },
    { value: 'Active', label: 'Active Only', badge: 'Active' },
    { value: 'Inactive', label: 'Inactive Only', badge: 'Inactive' },
  ];

  const statusModalOptions: CustomSelectOption[] = [
    { value: 'Active', label: 'Active' },
    { value: 'Inactive', label: 'Inactive' },
  ];

  const paginationPageOptions: CustomSelectOption[] = [
    { value: '10', label: '10 / page' },
    { value: '25', label: '25 / page' },
    { value: '50', label: '50 / page' },
  ];

  return (
    <div className="w-full flex flex-col gap-4 text-slate-800 font-sans">

      {/* ── 1. SHOPIFY POLARIS PAGE TITLE & ACTION BAR ────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ClipboardList size={22} className="text-slate-800 stroke-[1.75]" />
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Price Lists</h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => alert('Exporting price lists...')}
            className="bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-300 shadow-2xs transition-colors cursor-pointer"
          >
            Export
          </button>
          <button
            onClick={handleOpenAddModal}
            className="bg-[#303030] hover:bg-[#111111] text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Plus size={14} />
            <span>Add price list</span>
          </button>
        </div>
      </div>

      {/* ── 2. DATA CARD CONTAINER & FILTER TOOLBAR ───────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">

        {/* Top Controls: Search, Filter, Export */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500 font-medium">
            {isLoading ? (
              <span className="flex items-center gap-2 text-indigo-600">
                <Loader2 size={14} className="animate-spin" />
                Loading price lists...
              </span>
            ) : firebaseError ? (
              <span className="text-red-500 font-semibold">Error: {firebaseError}</span>
            ) : (
              <span>Total Price Lists: <strong className="text-slate-800">{priceLists.length}</strong></span>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <input
                type="text"
                placeholder="Search price lists..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-3.5 pr-9 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 bg-slate-50/50"
              />
              <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>

            {/* Custom Status Filter Dropdown */}
            <CustomSelect
              options={statusFilterOptions}
              value={statusFilter}
              onChange={setStatusFilter}
              icon={<Filter size={14} />}
              size="md"
              className="w-full sm:w-auto"
            />

            {/* Export Button */}
            <button
              onClick={() => alert('Exporting price lists...')}
              className="p-2.5 text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
              title="Export CSV"
            >
              <Download size={16} />
            </button>
          </div>
        </div>

        {/* Table View */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="py-3.5 px-4 sm:px-6">Price List Code</th>
                <th className="py-3.5 px-4">Price List Name</th>
                <th className="py-3.5 px-4">Total Items</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 size={18} className="animate-spin text-indigo-600" />
                      <span>Loading price lists...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredPriceLists.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2 py-4">
                      <Tag size={32} className="text-slate-300" />
                      <p className="font-semibold text-slate-600">No price lists found</p>
                      <p className="text-xs text-slate-400">Click &quot;+ Add Price List&quot; above to create a price list.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedPriceLists.map((plist) => (
                  <tr key={plist.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-4 px-4 sm:px-6 font-bold text-indigo-600">{plist.code}</td>
                    <td className="py-4 px-4 font-semibold text-slate-900">{plist.name}</td>
                    <td className="py-4 px-4 font-semibold text-slate-700">
                      <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-[11px]">
                        {plist.totalItems || plist.items?.length || 0} products
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span
                        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                          plist.status === 'Active'
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                            : 'bg-red-50 text-red-500 border-red-200'
                        }`}
                      >
                        {plist.status}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setViewingPriceList(plist)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                          title="View Price List"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          onClick={() => handleOpenEditModal(plist)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                          title="Edit Price List"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => setDeletingPriceList(plist)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete Price List"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 45 Items Per Page Pagination */}
        <Pagination
          currentPage={currentPage}
          totalItems={filteredPriceLists.length}
          pageSize={45}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* ── 4. STUNNING FULL SCREEN MODAL: Add / Edit Price List ─────────────── */}
      {(isAddModalOpen || editingPriceList) && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 lg:p-6 animate-in fade-in zoom-in-95 duration-150">
          <div className="bg-slate-50 rounded-3xl shadow-2xl border border-slate-200/90 max-w-6xl w-full flex flex-col h-full max-h-[92vh] overflow-hidden">

            {/* 1. Modal Header Bar */}
            <div className="bg-white px-6 py-4 border-b border-slate-200/90 flex items-center justify-between flex-shrink-0 shadow-2xs">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
                  <Tag size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">
                      {editingPriceList ? 'Edit Price List' : 'Create New Price List'}
                    </h2>
                    {editingPriceList && (
                      <span className="px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-mono text-xs font-bold border border-indigo-100">
                        {editingPriceList.code}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">Set custom product prices or apply percentage rules across products</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {modifiedCustomPricesCount > 0 && (
                  <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold">
                    <Sparkles size={13} className="text-amber-500" />
                    <span>{modifiedCustomPricesCount} Custom Prices Modified</span>
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingPriceList(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={editingPriceList ? handleSaveUpdatePriceList : handleSaveAddPriceList}
                  disabled={isSubmitting || !priceListName.trim()}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                  <span>Save Price List</span>
                </button>
                <button
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingPriceList(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Close"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* 2. Modal Scrollable Content Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">

              {/* Price List Name & Status Card */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Price List Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Festival Wholesale Rates 2025"
                    value={priceListName}
                    onChange={(e) => setPriceListName(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm font-semibold text-slate-900 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 bg-slate-50/50"
                  />
                </div>

                <div className="w-full md:w-56">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Status</label>
                  <CustomSelect
                    options={statusModalOptions}
                    value={priceListStatus}
                    onChange={(val) => setPriceListStatus(val as any)}
                    className="w-full"
                    buttonClassName="w-full"
                  />
                </div>
              </div>

              {/* Bulk Pricing Tools & Filters Header */}
              <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs space-y-4">
                
                {/* Search Bar + Bulk Adjust Buttons */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="relative flex-1 max-w-md">
                    <input
                      type="text"
                      placeholder="Search products by name, code or category..."
                      value={modalSearchTerm}
                      onChange={(e) => setModalSearchTerm(e.target.value)}
                      className="w-full pl-3.5 pr-9 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 bg-slate-50/50"
                    />
                    <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>

                  {/* Quick Percentage Adjust Tools */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1 mr-1">
                      <Percent size={13} className="text-indigo-600" />
                      Bulk Price Adjustment:
                    </span>
                    <button
                      type="button"
                      onClick={() => handleApplyBulkPercentage(-5)}
                      className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60 transition-colors cursor-pointer"
                    >
                      -5%
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyBulkPercentage(-10)}
                      className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60 transition-colors cursor-pointer"
                    >
                      -10%
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyBulkPercentage(5)}
                      className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200/60 transition-colors cursor-pointer"
                    >
                      +5%
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyBulkPercentage(10)}
                      className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200/60 transition-colors cursor-pointer"
                    >
                      +10%
                    </button>

                    {modifiedCustomPricesCount > 0 && (
                      <button
                        type="button"
                        onClick={handleResetAllModalPrices}
                        className="flex items-center gap-1 px-3 py-1 text-[11px] font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer ml-1"
                      >
                        <RotateCcw size={12} />
                        <span>Reset All</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Category Filter Pills */}
                {modalCategories.length > 0 && (
                  <div className="flex items-center gap-2 overflow-x-auto pt-2 border-t border-slate-100 pb-1">
                    <span className="text-[11px] font-semibold text-slate-400 mr-1 flex-shrink-0">Category:</span>
                    <button
                      type="button"
                      onClick={() => setModalCategoryFilter('All')}
                      className={`px-3 py-1 rounded-full text-xs font-semibold transition-all flex-shrink-0 cursor-pointer ${
                        modalCategoryFilter === 'All'
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      All ({modalItems.length})
                    </button>
                    {modalCategories.map((cat) => {
                      const count = modalItems.filter((i) => i.category === cat).length;
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setModalCategoryFilter(cat)}
                          className={`px-3 py-1 rounded-full text-xs font-semibold transition-all flex-shrink-0 cursor-pointer ${
                            modalCategoryFilter === cat
                              ? 'bg-indigo-600 text-white shadow-2xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {cat} ({count})
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Product Pricing Table */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[750px]">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        <th className="py-3.5 px-4 sm:px-6">Product Name</th>
                        <th className="py-3.5 px-4">Code</th>
                        <th className="py-3.5 px-4">Category</th>
                        <th className="py-3.5 px-4">Default Price</th>
                        <th className="py-3.5 px-4 sm:px-6 w-80">Custom Price (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                      {filteredModalItems.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-14 text-center text-slate-400">
                            No products found matching your search.
                          </td>
                        </tr>
                      ) : (
                        filteredModalItems.map((item) => {
                          const diff = item.customPrice - item.defaultPrice;
                          const pct = item.defaultPrice > 0 ? Math.round((diff / item.defaultPrice) * 100) : 0;
                          const isModified = item.customPrice !== item.defaultPrice;

                          return (
                            <tr key={item.itemId} className={`hover:bg-slate-50/70 transition-colors ${isModified ? 'bg-indigo-50/20' : ''}`}>
                              <td className="py-3.5 px-4 sm:px-6">
                                <div className="flex items-center gap-3">
                                  <div className="relative w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 overflow-hidden flex-shrink-0 flex items-center justify-center shadow-2xs">
                                    <Image
                                      src={item.imageUrl || '/logo.png'}
                                      alt={item.itemName}
                                      fill
                                      className="object-contain p-1"
                                    />
                                  </div>
                                  <div>
                                    <span className="font-bold text-slate-900 text-sm block">{item.itemName}</span>
                                    <span className="text-[11px] text-slate-400">Per {item.unit}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3.5 px-4 font-mono font-bold text-indigo-600">
                                <span className="px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-100 text-[11px]">
                                  {item.itemCode}
                                </span>
                              </td>
                              <td className="py-3.5 px-4">
                                <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-semibold">
                                  {item.category}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-slate-500 font-semibold">
                                ₹ {item.defaultPrice} <span className="text-[11px] text-slate-400 font-normal">/ {item.unit}</span>
                              </td>
                              <td className="py-3.5 px-4 sm:px-6">
                                <div className="flex items-center gap-2">
                                  <div className="relative flex-1">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">₹</span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={item.customPrice}
                                      onChange={(e) => handleCustomPriceChange(item.itemId, e.target.value)}
                                      className={`w-full pl-7 pr-3 py-2 text-xs font-bold border rounded-xl focus:outline-none transition-all ${
                                        isModified
                                          ? 'border-indigo-500 text-indigo-700 bg-indigo-50/30 ring-2 ring-indigo-500/10'
                                          : 'border-slate-300 text-slate-800 bg-white focus:border-indigo-500'
                                      }`}
                                    />
                                  </div>

                                  {/* Price Delta Badge */}
                                  {isModified ? (
                                    <div className="flex items-center gap-1">
                                      <span
                                        className={`px-2 py-1 rounded-lg text-[10px] font-bold flex-shrink-0 ${
                                          diff < 0
                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                                        }`}
                                      >
                                        {pct > 0 ? `+${pct}%` : `${pct}%`}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleCustomPriceChange(item.itemId, item.defaultPrice.toString())}
                                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                        title="Reset to default price"
                                      >
                                        <RotateCcw size={13} />
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="px-2 py-1 rounded-lg text-[10px] font-medium bg-slate-100 text-slate-400 flex-shrink-0">
                                      Default
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

            {/* 3. Modal Footer Bar */}
            <div className="bg-white border-t border-slate-200 px-6 py-3.5 flex items-center justify-between flex-shrink-0 text-xs text-slate-500">
              <div>
                Total Products: <strong className="text-slate-800">{modalItems.length}</strong>
                {modifiedCustomPricesCount > 0 && (
                  <span className="ml-2 text-indigo-600 font-semibold">
                    • {modifiedCustomPricesCount} Custom Prices Modified
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingPriceList(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={editingPriceList ? handleSaveUpdatePriceList : handleSaveAddPriceList}
                  disabled={isSubmitting || !priceListName.trim()}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  <span>Save Price List</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ── 5. Custom Delete Modal for Price List ───────────────────── */}
      {deletingPriceList && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-full bg-red-50 text-red-500 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Price List</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Are you sure you want to delete <strong className="text-slate-800">{deletingPriceList.name}</strong> ({deletingPriceList.code})? This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                onClick={() => setDeletingPriceList(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-700 text-white shadow-xs disabled:opacity-50"
              >
                {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 6. View Details Modal for Price List ───────────────────── */}
      {viewingPriceList && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-600 border border-indigo-100 font-mono">
                  {viewingPriceList.code}
                </span>
                <h3 className="text-base font-bold text-slate-900">{viewingPriceList.name}</h3>
              </div>
              <button onClick={() => setViewingPriceList(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-700">Custom Item Prices:</p>
              <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600">
                    <tr>
                      <th className="py-2 px-3">Product</th>
                      <th className="py-2 px-3">Code</th>
                      <th className="py-2 px-3">Default Price</th>
                      <th className="py-2 px-3">Custom Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {viewingPriceList.items?.map((item) => (
                      <tr key={item.itemId} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-semibold text-slate-900">{item.itemName}</td>
                        <td className="py-2 px-3 font-bold text-indigo-600">{item.itemCode}</td>
                        <td className="py-2 px-3 text-slate-400">₹ {item.defaultPrice} / {item.unit}</td>
                        <td className="py-2 px-3 font-extrabold text-indigo-600">₹ {item.customPrice} / {item.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="pt-3 flex justify-end">
              <button
                onClick={() => setViewingPriceList(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

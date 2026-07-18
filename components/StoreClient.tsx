'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
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
  Store as StoreIcon,
  Loader2,
  Filter,
  AlertTriangle,
} from 'lucide-react';
import CustomSelect, { CustomSelectOption } from '@/components/CustomSelect';
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

export interface StoreItem {
  id: string;
  code: string;
  name: string;
  type: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  pincode: string;
  status: 'Active' | 'Inactive';
  createdAt?: any;
}

export default function StoreClient() {
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [firebaseError, setFirebaseError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [itemsPerPage, setItemsPerPage] = useState('10');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [viewStore, setViewStore] = useState<StoreItem | null>(null);
  const [editingStore, setEditingStore] = useState<StoreItem | null>(null);
  const [deletingStore, setDeletingStore] = useState<StoreItem | null>(null);

  // New store form state
  const [newStore, setNewStore] = useState({
    name: '',
    type: 'Retail Store',
    phone: '',
    email: '',
    city: '',
    state: 'Tamil Nadu',
    pincode: '',
    status: 'Active' as 'Active' | 'Inactive',
  });

  // Edit store form state
  const [editFormData, setEditFormData] = useState({
    name: '',
    type: 'Retail Store',
    phone: '',
    email: '',
    city: '',
    state: 'Tamil Nadu',
    pincode: '',
    status: 'Active' as 'Active' | 'Inactive',
  });

  // Real-time Firebase Firestore listener
  useEffect(() => {
    const storesCollectionRef = collection(db, 'stores');
    const q = query(storesCollectionRef);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedStores: StoreItem[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<StoreItem, 'id'>),
        }));

        // Sort by code locally
        fetchedStores.sort((a, b) => (a.code || '').localeCompare(b.code || ''));

        setStores(fetchedStores);
        setIsLoading(false);
        setFirebaseError(null);
      },
      (error) => {
        console.error('Error fetching stores from Firestore:', error);
        setFirebaseError(error.message || 'Failed to connect to Firebase');
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Filtered stores
  const filteredStores = stores.filter((store) => {
    const matchesSearch =
      store.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      store.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      store.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
      store.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === 'All' ? true : store.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Handle Add Store directly to Firebase
  const handleAddStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStore.name) return;

    try {
      setIsSubmitting(true);
      const nextNumber = stores.length + 1;
      const nextCode = `STR-${String(nextNumber).padStart(3, '0')}`;

      await addDoc(collection(db, 'stores'), {
        code: nextCode,
        ...newStore,
        createdAt: serverTimestamp(),
      });

      setIsAddModalOpen(false);
      setNewStore({
        name: '',
        type: 'Retail Store',
        phone: '',
        email: '',
        city: '',
        state: 'Tamil Nadu',
        pincode: '',
        status: 'Active',
      });
    } catch (err: any) {
      console.error('Failed to add store to Firestore:', err);
      setFirebaseError(err?.message || 'Failed to add store');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Edit Modal with store data
  const handleOpenEditModal = (store: StoreItem) => {
    setEditingStore(store);
    setEditFormData({
      name: store.name,
      type: store.type,
      phone: store.phone,
      email: store.email,
      city: store.city,
      state: store.state,
      pincode: store.pincode,
      status: store.status,
    });
  };

  // Handle Edit Store Submit to Firebase
  const handleUpdateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStore || !editFormData.name) return;

    try {
      setIsSubmitting(true);
      const storeRef = doc(db, 'stores', editingStore.id);
      await updateDoc(storeRef, {
        name: editFormData.name,
        type: editFormData.type,
        phone: editFormData.phone,
        email: editFormData.email,
        city: editFormData.city,
        state: editFormData.state,
        pincode: editFormData.pincode,
        status: editFormData.status,
        updatedAt: serverTimestamp(),
      });

      setEditingStore(null);
    } catch (err: any) {
      console.error('Failed to update store:', err);
      setFirebaseError(err?.message || 'Failed to update store');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Confirmed Delete Store from Firebase
  const handleConfirmDelete = async () => {
    if (!deletingStore) return;

    try {
      setIsDeleting(true);
      await deleteDoc(doc(db, 'stores', deletingStore.id));
      setDeletingStore(null);
    } catch (err: any) {
      console.error('Failed to delete store:', err);
      setFirebaseError(err?.message || 'Failed to delete store');
    } finally {
      setIsDeleting(false);
    }
  };

  // Custom Dropdown options
  const statusFilterOptions: CustomSelectOption[] = [
    { value: 'All', label: 'All Statuses' },
    { value: 'Active', label: 'Active Only', badge: 'Active' },
    { value: 'Inactive', label: 'Inactive Only', badge: 'Inactive' },
  ];

  const storeTypeOptions: CustomSelectOption[] = [
    { value: 'Retail Store', label: 'Retail Store' },
    { value: 'Wholesale Store', label: 'Wholesale Store' },
  ];

  const storeStatusModalOptions: CustomSelectOption[] = [
    { value: 'Active', label: 'Active' },
    { value: 'Inactive', label: 'Inactive' },
  ];

  const paginationPageOptions: CustomSelectOption[] = [
    { value: '10', label: '10 / page' },
    { value: '25', label: '25 / page' },
    { value: '50', label: '50 / page' },
  ];

  return (
    <div className="w-full flex flex-col gap-6">

      {/* ── 1. Page Title & Action Bar ─────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Store</h1>
          <nav className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
            <Link href="/" className="hover:text-indigo-600 transition-colors">Dashboard</Link>
            <span>&gt;</span>
            <span className="text-slate-800 font-medium">Store</span>
          </nav>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 hover:from-indigo-600 hover:to-indigo-800 text-white text-sm font-semibold shadow-sm transition-all hover:shadow cursor-pointer w-full sm:w-auto"
        >
          <Plus size={16} />
          <span>Add Store</span>
        </button>
      </div>

      {/* ── 2. View Tab ───────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <button className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold shadow-xs">
          Stores List
        </button>
      </div>

      {/* ── 3. Main Data Card Container ─────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">

        {/* Top Controls: Search, Filter, Export */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500 font-medium">
            {isLoading ? (
              <span className="flex items-center gap-2 text-indigo-600">
                <Loader2 size={14} className="animate-spin" />
                Loading stores...
              </span>
            ) : firebaseError ? (
              <span className="text-red-500 font-semibold">Error: {firebaseError}</span>
            ) : (
              <span>Total Stores: <strong className="text-slate-800">{stores.length}</strong></span>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <input
                type="text"
                placeholder="Search stores..."
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
              onClick={() => alert('Exporting store data...')}
              className="p-2.5 text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
              title="Export CSV"
            >
              <Download size={16} />
            </button>
          </div>
        </div>

        {/* Table View */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="py-3.5 px-4 sm:px-6">Store Code</th>
                <th className="py-3.5 px-4">Store Name</th>
                <th className="py-3.5 px-4">Store Type</th>
                <th className="py-3.5 px-4">Phone Number</th>
                <th className="py-3.5 px-4">Email</th>
                <th className="py-3.5 px-4">City</th>
                <th className="py-3.5 px-4">State</th>
                <th className="py-3.5 px-4">Pincode</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 size={18} className="animate-spin text-indigo-600" />
                      <span>Loading stores...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredStores.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2 py-4">
                      <StoreIcon size={32} className="text-slate-300" />
                      <p className="font-semibold text-slate-600">No stores found</p>
                      <p className="text-xs text-slate-400">Click &quot;+ Add Store&quot; above to create a new store.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredStores.map((store) => (
                  <tr key={store.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-4 px-4 sm:px-6 font-bold text-indigo-600">{store.code}</td>
                    <td className="py-4 px-4 font-semibold text-slate-900">{store.name}</td>
                    <td className="py-4 px-4 text-slate-600">{store.type}</td>
                    <td className="py-4 px-4 text-slate-600 whitespace-nowrap">{store.phone}</td>
                    <td className="py-4 px-4 text-slate-500">{store.email}</td>
                    <td className="py-4 px-4 text-slate-700">{store.city}</td>
                    <td className="py-4 px-4 text-slate-700">{store.state}</td>
                    <td className="py-4 px-4 text-slate-600">{store.pincode}</td>
                    <td className="py-4 px-4">
                      <span
                        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                          store.status === 'Active'
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                            : 'bg-red-50 text-red-500 border-red-200'
                        }`}
                      >
                        {store.status}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setViewStore(store)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                          title="View Store Details"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          onClick={() => handleOpenEditModal(store)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                          title="Edit Store"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => setDeletingStore(store)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete Store"
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

        {/* Pagination Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>
            Showing 1 to {filteredStores.length} of {stores.length} stores
          </p>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <button className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-50 cursor-not-allowed opacity-50">
                <ChevronLeft size={14} />
              </button>
              <button className="w-8 h-8 rounded-lg bg-indigo-600 text-white font-bold flex items-center justify-center shadow-xs">
                1
              </button>
              <button className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 cursor-pointer">
                <ChevronRight size={14} />
              </button>
            </div>

            {/* Custom Select for items per page */}
            <CustomSelect
              options={paginationPageOptions}
              value={itemsPerPage}
              onChange={setItemsPerPage}
              size="sm"
            />
          </div>
        </div>

      </div>

      {/* ── 4. Add Store Modal ───────────────────────────────────────── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <StoreIcon size={20} />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Add New Store</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddStore} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Store Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. South Zone Store"
                  value={newStore.name}
                  onChange={(e) => setNewStore({ ...newStore, name: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Store Type</label>
                  <CustomSelect
                    options={storeTypeOptions}
                    value={newStore.type}
                    onChange={(val) => setNewStore({ ...newStore, type: val })}
                    className="w-full"
                    buttonClassName="w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                  <CustomSelect
                    options={storeStatusModalOptions}
                    value={newStore.status}
                    onChange={(val) => setNewStore({ ...newStore, status: val as 'Active' | 'Inactive' })}
                    className="w-full"
                    buttonClassName="w-full"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    placeholder="+91 98765 43210"
                    value={newStore.phone}
                    onChange={(e) => setNewStore({ ...newStore, phone: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="store@example.com"
                    value={newStore.email}
                    onChange={(e) => setNewStore({ ...newStore, email: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    placeholder="Coimbatore"
                    value={newStore.city}
                    onChange={(e) => setNewStore({ ...newStore, city: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">State</label>
                  <input
                    type="text"
                    placeholder="Tamil Nadu"
                    value={newStore.state}
                    onChange={(e) => setNewStore({ ...newStore, state: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Pincode</label>
                  <input
                    type="text"
                    placeholder="641001"
                    value={newStore.pincode}
                    onChange={(e) => setNewStore({ ...newStore, pincode: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 size={14} className="animate-spin" />}
                  <span>Save</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── 5. Edit Store Modal ──────────────────────────────────────── */}
      {editingStore && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Pencil size={18} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Edit Store</h3>
                  <p className="text-xs text-slate-400 font-mono">{editingStore.code}</p>
                </div>
              </div>
              <button
                onClick={() => setEditingStore(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUpdateStore} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Store Name *</label>
                <input
                  type="text"
                  required
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Store Type</label>
                  <CustomSelect
                    options={storeTypeOptions}
                    value={editFormData.type}
                    onChange={(val) => setEditFormData({ ...editFormData, type: val })}
                    className="w-full"
                    buttonClassName="w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                  <CustomSelect
                    options={storeStatusModalOptions}
                    value={editFormData.status}
                    onChange={(val) => setEditFormData({ ...editFormData, status: val as 'Active' | 'Inactive' })}
                    className="w-full"
                    buttonClassName="w-full"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={editFormData.phone}
                    onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={editFormData.email}
                    onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    value={editFormData.city}
                    onChange={(e) => setEditFormData({ ...editFormData, city: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">State</label>
                  <input
                    type="text"
                    value={editFormData.state}
                    onChange={(e) => setEditFormData({ ...editFormData, state: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Pincode</label>
                  <input
                    type="text"
                    value={editFormData.pincode}
                    onChange={(e) => setEditFormData({ ...editFormData, pincode: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingStore(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 size={14} className="animate-spin" />}
                  <span>Update Store</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── 6. Custom Delete Confirmation Modal ────────────────────── */}
      {deletingStore && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-full bg-red-50 text-red-500 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={22} />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-slate-900">Delete Store</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Are you sure you want to delete <strong className="text-slate-800">{deletingStore.name}</strong> ({deletingStore.code})? This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeletingStore(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-700 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                <span>Delete Store</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 7. View Store Details Modal ────────────────────────────── */}
      {viewStore && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-600 border border-indigo-100">
                  {viewStore.code}
                </span>
                <h3 className="text-base font-bold text-slate-900">{viewStore.name}</h3>
              </div>
              <button
                onClick={() => setViewStore(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-slate-600">
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-400">Store Type:</span>
                <span className="font-semibold text-slate-800">{viewStore.type}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-400">Phone Number:</span>
                <span className="font-semibold text-slate-800">{viewStore.phone}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-400">Email:</span>
                <span className="font-semibold text-slate-800">{viewStore.email}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-400">Location:</span>
                <span className="font-semibold text-slate-800">{viewStore.city}, {viewStore.state} ({viewStore.pincode})</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Status:</span>
                <span className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${
                  viewStore.status === 'Active' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
                }`}>
                  {viewStore.status}
                </span>
              </div>
            </div>

            <div className="pt-3 flex justify-end">
              <button
                onClick={() => setViewStore(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
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

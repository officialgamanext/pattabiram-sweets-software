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
  Loader2,
  Filter,
  AlertTriangle,
  Users,
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

export interface WholesalerItem {
  id: string;
  code: string;
  name: string;
  personalMobile: string;
  businessName: string;
  businessMobile: string;
  email?: string;
  city: string;
  address: string;
  gstin?: string;
  status: 'Active' | 'Inactive';
  createdAt?: any;
}

export default function WholesalersClient() {
  const [wholesalers, setWholesalers] = useState<WholesalerItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [firebaseError, setFirebaseError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [itemsPerPage, setItemsPerPage] = useState('10');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [viewWholesaler, setViewWholesaler] = useState<WholesalerItem | null>(null);
  const [editingWholesaler, setEditingWholesaler] = useState<WholesalerItem | null>(null);
  const [deletingWholesaler, setDeletingWholesaler] = useState<WholesalerItem | null>(null);

  // Form states
  const emptyForm = {
    name: '',
    personalMobile: '',
    businessName: '',
    businessMobile: '',
    email: '',
    city: '',
    address: '',
    gstin: '',
    status: 'Active' as 'Active' | 'Inactive',
  };

  const [newWholesaler, setNewWholesaler] = useState(emptyForm);
  const [editFormData, setEditFormData] = useState(emptyForm);

  // Real-time Firebase Firestore listener
  useEffect(() => {
    const wholesalersRef = collection(db, 'wholesalers');
    const q = query(wholesalersRef);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetched: WholesalerItem[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<WholesalerItem, 'id'>),
        }));

        // Sort by code locally
        fetched.sort((a, b) => (a.code || '').localeCompare(b.code || ''));

        setWholesalers(fetched);
        setIsLoading(false);
        setFirebaseError(null);
      },
      (error) => {
        console.error('Error fetching wholesalers from Firestore:', error);
        setFirebaseError(error.message || 'Failed to connect to database');
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Filtered list
  const filteredWholesalers = wholesalers.filter((item) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      item.name.toLowerCase().includes(term) ||
      item.businessName.toLowerCase().includes(term) ||
      item.code.toLowerCase().includes(term) ||
      item.personalMobile.toLowerCase().includes(term) ||
      item.businessMobile.toLowerCase().includes(term) ||
      item.city.toLowerCase().includes(term) ||
      (item.gstin && item.gstin.toLowerCase().includes(term));

    const matchesStatus =
      statusFilter === 'All' ? true : item.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Handle Add Wholesaler to Firebase
  const handleAddWholesaler = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWholesaler.name || !newWholesaler.businessName) return;

    try {
      setIsSubmitting(true);
      const nextNumber = wholesalers.length + 1;
      const nextCode = `WHL-${String(nextNumber).padStart(3, '0')}`;

      await addDoc(collection(db, 'wholesalers'), {
        code: nextCode,
        ...newWholesaler,
        createdAt: serverTimestamp(),
      });

      setIsAddModalOpen(false);
      setNewWholesaler(emptyForm);
    } catch (err: any) {
      console.error('Failed to add wholesaler to Firestore:', err);
      setFirebaseError(err?.message || 'Failed to save wholesaler');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Edit Modal
  const handleOpenEditModal = (item: WholesalerItem) => {
    setEditingWholesaler(item);
    setEditFormData({
      name: item.name,
      personalMobile: item.personalMobile,
      businessName: item.businessName,
      businessMobile: item.businessMobile,
      email: item.email || '',
      city: item.city,
      address: item.address,
      gstin: item.gstin || '',
      status: item.status,
    });
  };

  // Handle Edit Submit
  const handleUpdateWholesaler = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWholesaler || !editFormData.name) return;

    try {
      setIsSubmitting(true);
      const docRef = doc(db, 'wholesalers', editingWholesaler.id);
      await updateDoc(docRef, {
        name: editFormData.name,
        personalMobile: editFormData.personalMobile,
        businessName: editFormData.businessName,
        businessMobile: editFormData.businessMobile,
        email: editFormData.email,
        city: editFormData.city,
        address: editFormData.address,
        gstin: editFormData.gstin,
        status: editFormData.status,
        updatedAt: serverTimestamp(),
      });

      setEditingWholesaler(null);
    } catch (err: any) {
      console.error('Failed to update wholesaler:', err);
      setFirebaseError(err?.message || 'Failed to update wholesaler');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Confirmed Delete
  const handleConfirmDelete = async () => {
    if (!deletingWholesaler) return;

    try {
      setIsDeleting(true);
      await deleteDoc(doc(db, 'wholesalers', deletingWholesaler.id));
      setDeletingWholesaler(null);
    } catch (err: any) {
      console.error('Failed to delete wholesaler:', err);
      setFirebaseError(err?.message || 'Failed to delete wholesaler');
    } finally {
      setIsDeleting(false);
    }
  };

  // Custom Dropdown Options
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
    <div className="w-full flex flex-col gap-6">

      {/* ── 1. Page Title & Action Bar ─────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Wholesalers</h1>
          <nav className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
            <Link href="/" className="hover:text-indigo-600 transition-colors">Dashboard</Link>
            <span>&gt;</span>
            <span className="text-slate-800 font-medium">Wholesalers</span>
          </nav>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 hover:from-indigo-600 hover:to-indigo-800 text-white text-sm font-semibold shadow-sm transition-all hover:shadow cursor-pointer w-full sm:w-auto"
        >
          <Plus size={16} />
          <span>Add Wholesaler</span>
        </button>
      </div>

      {/* ── 2. View Tab ───────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <button className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold shadow-xs">
          Wholesalers List
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
                Loading wholesalers...
              </span>
            ) : firebaseError ? (
              <span className="text-red-500 font-semibold">Error: {firebaseError}</span>
            ) : (
              <span>Total Wholesalers: <strong className="text-slate-800">{wholesalers.length}</strong></span>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <input
                type="text"
                placeholder="Search wholesalers..."
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
              onClick={() => alert('Exporting wholesaler data...')}
              className="p-2.5 text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
              title="Export CSV"
            >
              <Download size={16} />
            </button>
          </div>
        </div>

        {/* Table View */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="py-3.5 px-4 sm:px-6">Code</th>
                <th className="py-3.5 px-4">Wholesaler Name</th>
                <th className="py-3.5 px-4">Business Name</th>
                <th className="py-3.5 px-4">Personal Mobile</th>
                <th className="py-3.5 px-4">Business Mobile</th>
                <th className="py-3.5 px-4">City</th>
                <th className="py-3.5 px-4">GSTIN</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 size={18} className="animate-spin text-indigo-600" />
                      <span>Loading wholesalers...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredWholesalers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2 py-4">
                      <Users size={32} className="text-slate-300" />
                      <p className="font-semibold text-slate-600">No wholesalers found</p>
                      <p className="text-xs text-slate-400">Click &quot;+ Add Wholesaler&quot; above to add a new wholesaler.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredWholesalers.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-4 px-4 sm:px-6 font-bold text-indigo-600">{item.code}</td>
                    <td className="py-4 px-4 font-semibold text-slate-900">{item.name}</td>
                    <td className="py-4 px-4 font-medium text-slate-800">{item.businessName}</td>
                    <td className="py-4 px-4 text-slate-600 whitespace-nowrap">{item.personalMobile}</td>
                    <td className="py-4 px-4 text-slate-600 whitespace-nowrap">{item.businessMobile}</td>
                    <td className="py-4 px-4 text-slate-700">{item.city}</td>
                    <td className="py-4 px-4 text-slate-500 font-mono text-[11px]">{item.gstin || 'N/A'}</td>
                    <td className="py-4 px-4">
                      <span
                        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                          item.status === 'Active'
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                            : 'bg-red-50 text-red-500 border-red-200'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setViewWholesaler(item)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                          title="View Wholesaler Details"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          onClick={() => handleOpenEditModal(item)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                          title="Edit Wholesaler"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => setDeletingWholesaler(item)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete Wholesaler"
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
            Showing 1 to {filteredWholesalers.length} of {wholesalers.length} wholesalers
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

            <CustomSelect
              options={paginationPageOptions}
              value={itemsPerPage}
              onChange={setItemsPerPage}
              size="sm"
            />
          </div>
        </div>

      </div>

      {/* ── 4. Add Wholesaler Modal ─────────────────────────────────── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Users size={20} />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Add Wholesaler</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddWholesaler} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Wholesaler Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rajesh Kumar"
                    value={newWholesaler.name}
                    onChange={(e) => setNewWholesaler({ ...newWholesaler, name: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Personal Mobile Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="+91 98765 43210"
                    value={newWholesaler.personalMobile}
                    onChange={(e) => setNewWholesaler({ ...newWholesaler, personalMobile: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Business Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sri Balaji Sweets & Traders"
                    value={newWholesaler.businessName}
                    onChange={(e) => setNewWholesaler({ ...newWholesaler, businessName: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Business Mobile Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="+91 98765 11223"
                    value={newWholesaler.businessMobile}
                    onChange={(e) => setNewWholesaler({ ...newWholesaler, businessMobile: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email (Optional)</label>
                  <input
                    type="email"
                    placeholder="wholesaler@example.com"
                    value={newWholesaler.email}
                    onChange={(e) => setNewWholesaler({ ...newWholesaler, email: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">City *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Coimbatore"
                    value={newWholesaler.city}
                    onChange={(e) => setNewWholesaler({ ...newWholesaler, city: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">GSTIN Number</label>
                  <input
                    type="text"
                    placeholder="33AAAAA0000A1Z5"
                    value={newWholesaler.gstin}
                    onChange={(e) => setNewWholesaler({ ...newWholesaler, gstin: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                  <CustomSelect
                    options={statusModalOptions}
                    value={newWholesaler.status}
                    onChange={(val) => setNewWholesaler({ ...newWholesaler, status: val as 'Active' | 'Inactive' })}
                    className="w-full"
                    buttonClassName="w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Address *</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Enter business or shop address..."
                  value={newWholesaler.address}
                  onChange={(e) => setNewWholesaler({ ...newWholesaler, address: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                />
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

      {/* ── 5. Edit Wholesaler Modal ────────────────────────────────── */}
      {editingWholesaler && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Pencil size={18} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Edit Wholesaler</h3>
                  <p className="text-xs text-slate-400 font-mono">{editingWholesaler.code}</p>
                </div>
              </div>
              <button
                onClick={() => setEditingWholesaler(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUpdateWholesaler} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Wholesaler Name *</label>
                  <input
                    type="text"
                    required
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Personal Mobile Number *</label>
                  <input
                    type="text"
                    required
                    value={editFormData.personalMobile}
                    onChange={(e) => setEditFormData({ ...editFormData, personalMobile: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Business Name *</label>
                  <input
                    type="text"
                    required
                    value={editFormData.businessName}
                    onChange={(e) => setEditFormData({ ...editFormData, businessName: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Business Mobile Number *</label>
                  <input
                    type="text"
                    required
                    value={editFormData.businessMobile}
                    onChange={(e) => setEditFormData({ ...editFormData, businessMobile: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email (Optional)</label>
                  <input
                    type="email"
                    value={editFormData.email}
                    onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">City *</label>
                  <input
                    type="text"
                    required
                    value={editFormData.city}
                    onChange={(e) => setEditFormData({ ...editFormData, city: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">GSTIN Number</label>
                  <input
                    type="text"
                    value={editFormData.gstin}
                    onChange={(e) => setEditFormData({ ...editFormData, gstin: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                  <CustomSelect
                    options={statusModalOptions}
                    value={editFormData.status}
                    onChange={(val) => setEditFormData({ ...editFormData, status: val as 'Active' | 'Inactive' })}
                    className="w-full"
                    buttonClassName="w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Address *</label>
                <textarea
                  rows={2}
                  required
                  value={editFormData.address}
                  onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingWholesaler(null)}
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

      {/* ── 6. Custom Delete Confirmation Modal ────────────────────── */}
      {deletingWholesaler && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-full bg-red-50 text-red-500 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={22} />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-slate-900">Delete Wholesaler</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Are you sure you want to delete <strong className="text-slate-800">{deletingWholesaler.name}</strong> ({deletingWholesaler.businessName})? This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeletingWholesaler(null)}
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
                <span>Delete Wholesaler</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 7. View Wholesaler Details Modal ───────────────────────── */}
      {viewWholesaler && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-600 border border-indigo-100 font-mono">
                  {viewWholesaler.code}
                </span>
                <h3 className="text-base font-bold text-slate-900">{viewWholesaler.name}</h3>
              </div>
              <button
                onClick={() => setViewWholesaler(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-slate-600">
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-400">Business Name:</span>
                <span className="font-bold text-slate-900">{viewWholesaler.businessName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-400">Personal Mobile:</span>
                <span className="font-semibold text-slate-800">{viewWholesaler.personalMobile}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-400">Business Mobile:</span>
                <span className="font-semibold text-slate-800">{viewWholesaler.businessMobile}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-400">Email:</span>
                <span className="font-semibold text-slate-800">{viewWholesaler.email || 'N/A'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-400">City:</span>
                <span className="font-semibold text-slate-800">{viewWholesaler.city}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-400">GSTIN:</span>
                <span className="font-mono font-semibold text-slate-800">{viewWholesaler.gstin || 'N/A'}</span>
              </div>
              <div className="flex flex-col gap-1 py-1 border-b border-slate-50">
                <span className="text-slate-400">Address:</span>
                <span className="font-semibold text-slate-800 leading-relaxed">{viewWholesaler.address}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Status:</span>
                <span className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${
                  viewWholesaler.status === 'Active' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
                }`}>
                  {viewWholesaler.status}
                </span>
              </div>
            </div>

            <div className="pt-3 flex justify-end">
              <button
                onClick={() => setViewWholesaler(null)}
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

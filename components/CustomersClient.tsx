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
  UserCheck,
  Phone,
  Mail,
  MapPin,
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

export interface CustomerRecord {
  id: string;
  code: string;
  name: string;
  mobileNumber: string;
  email?: string;
  address: string;
  status: 'Active' | 'Inactive';
  createdAt?: any;
}

export default function CustomersClient() {
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [firebaseError, setFirebaseError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [itemsPerPage, setItemsPerPage] = useState('10');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [viewCustomer, setViewCustomer] = useState<CustomerRecord | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<CustomerRecord | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState<CustomerRecord | null>(null);

  // Form states
  const emptyForm = {
    name: '',
    mobileNumber: '',
    email: '',
    address: '',
    status: 'Active' as 'Active' | 'Inactive',
  };

  const [newCustomer, setNewCustomer] = useState(emptyForm);
  const [editFormData, setEditFormData] = useState(emptyForm);

  // 1. Subscribe to Customers collection from Firebase Firestore
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'customers')),
      (snapshot) => {
        const fetched: CustomerRecord[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<CustomerRecord, 'id'>),
        }));

        fetched.sort((a, b) => (a.code || '').localeCompare(b.code || ''));
        setCustomers(fetched);
        setIsLoading(false);
        setFirebaseError(null);
      },
      (error) => {
        console.error('Error fetching customers:', error);
        setFirebaseError(error.message || 'Failed to connect to database');
        setIsLoading(false);
      }
    );

    return () => unsub();
  }, []);

  // Filtered list
  const filteredCustomers = customers.filter((item) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      item.name.toLowerCase().includes(term) ||
      item.code.toLowerCase().includes(term) ||
      item.mobileNumber.toLowerCase().includes(term) ||
      (item.email && item.email.toLowerCase().includes(term)) ||
      item.address.toLowerCase().includes(term);

    const matchesStatus =
      statusFilter === 'All' ? true : item.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Handle Add Customer Submit
  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomer.name || !newCustomer.mobileNumber || !newCustomer.address) return;

    try {
      setIsSubmitting(true);
      const nextNumber = customers.length + 1;
      const nextCode = `CUST-${String(nextNumber).padStart(3, '0')}`;

      await addDoc(collection(db, 'customers'), {
        code: nextCode,
        ...newCustomer,
        createdAt: serverTimestamp(),
      });

      setIsAddModalOpen(false);
      setNewCustomer(emptyForm);
    } catch (err: any) {
      console.error('Failed to add customer:', err);
      setFirebaseError(err?.message || 'Failed to save customer');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Edit Modal
  const handleOpenEditModal = (item: CustomerRecord) => {
    setEditingCustomer(item);
    setEditFormData({
      name: item.name,
      mobileNumber: item.mobileNumber,
      email: item.email || '',
      address: item.address,
      status: item.status,
    });
  };

  // Handle Edit Submit
  const handleUpdateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer || !editFormData.name || !editFormData.mobileNumber) return;

    try {
      setIsSubmitting(true);
      const docRef = doc(db, 'customers', editingCustomer.id);
      await updateDoc(docRef, {
        name: editFormData.name,
        mobileNumber: editFormData.mobileNumber,
        email: editFormData.email,
        address: editFormData.address,
        status: editFormData.status,
        updatedAt: serverTimestamp(),
      });

      setEditingCustomer(null);
    } catch (err: any) {
      console.error('Failed to update customer:', err);
      setFirebaseError(err?.message || 'Failed to update customer');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Confirmed Delete
  const handleConfirmDelete = async () => {
    if (!deletingCustomer) return;

    try {
      setIsDeleting(true);
      await deleteDoc(doc(db, 'customers', deletingCustomer.id));
      setDeletingCustomer(null);
    } catch (err: any) {
      console.error('Failed to delete customer:', err);
      setFirebaseError(err?.message || 'Failed to delete customer');
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
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Customers</h1>
          <nav className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
            <Link href="/" className="hover:text-indigo-600 transition-colors">Dashboard</Link>
            <span>&gt;</span>
            <span className="text-slate-800 font-medium">Customers</span>
          </nav>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 hover:from-indigo-600 hover:to-indigo-800 text-white text-sm font-semibold shadow-sm transition-all hover:shadow cursor-pointer w-full sm:w-auto"
        >
          <Plus size={16} />
          <span>Add Customer</span>
        </button>
      </div>

      {/* ── 2. View Tab ───────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <button className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold shadow-xs">
          Customers List ({customers.length})
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
                Loading customers...
              </span>
            ) : firebaseError ? (
              <span className="text-red-500 font-semibold">Error: {firebaseError}</span>
            ) : (
              <span>Total Customers: <strong className="text-slate-800">{customers.length}</strong></span>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <input
                type="text"
                placeholder="Search customers..."
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
              onClick={() => alert('Exporting customer data...')}
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
                <th className="py-3.5 px-4 sm:px-6">Customer Code</th>
                <th className="py-3.5 px-4">Customer Name</th>
                <th className="py-3.5 px-4">Mobile Number</th>
                <th className="py-3.5 px-4">Email</th>
                <th className="py-3.5 px-4">Address</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 size={18} className="animate-spin text-indigo-600" />
                      <span>Loading customers...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2 py-4">
                      <UserCheck size={32} className="text-slate-300" />
                      <p className="font-semibold text-slate-600">No customers found</p>
                      <p className="text-xs text-slate-400">Click &quot;+ Add Customer&quot; above to create a new customer record.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-4 px-4 sm:px-6 font-bold text-indigo-600">{item.code}</td>
                    <td className="py-4 px-4 font-bold text-slate-900">{item.name}</td>
                    <td className="py-4 px-4 font-semibold text-slate-700 whitespace-nowrap">{item.mobileNumber}</td>
                    <td className="py-4 px-4 text-slate-600">{item.email || 'N/A'}</td>
                    <td className="py-4 px-4 text-slate-600 truncate max-w-xs">{item.address}</td>
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
                          onClick={() => setViewCustomer(item)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                          title="View Customer Details"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          onClick={() => handleOpenEditModal(item)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                          title="Edit Customer"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => setDeletingCustomer(item)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete Customer"
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

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>Showing {filteredCustomers.length} of {customers.length} customers</p>
          <CustomSelect options={paginationPageOptions} value={itemsPerPage} onChange={setItemsPerPage} size="sm" />
        </div>
      </div>

      {/* ── 4. Add Customer Modal ─────────────────────────────────────── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <UserCheck size={20} />
                </div>
                <h3 className="text-base font-bold text-slate-900">Add Customer</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddCustomer} className="space-y-3.5">
              {/* Customer Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Customer Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Suresh Kumar"
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Mobile Number & Email */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="+91 98765 43210"
                    value={newCustomer.mobileNumber}
                    onChange={(e) => setNewCustomer({ ...newCustomer, mobileNumber: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email (Optional)</label>
                  <input
                    type="email"
                    placeholder="customer@example.com"
                    value={newCustomer.email}
                    onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                <CustomSelect
                  options={statusModalOptions}
                  value={newCustomer.status}
                  onChange={(val) => setNewCustomer({ ...newCustomer, status: val as any })}
                  className="w-full"
                  buttonClassName="w-full"
                />
              </div>

              {/* Address */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Address *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Enter full customer delivery / billing address..."
                  value={newCustomer.address}
                  onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 size={14} className="animate-spin" />}
                  <span>Save</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── 5. Edit Customer Modal ────────────────────────────────────── */}
      {editingCustomer && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
                  <Pencil size={16} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Edit Customer</h3>
                  <p className="text-xs text-slate-400 font-mono">{editingCustomer.code}</p>
                </div>
              </div>
              <button onClick={() => setEditingCustomer(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateCustomer} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Customer Name *</label>
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile Number *</label>
                  <input
                    type="text"
                    required
                    value={editFormData.mobileNumber}
                    onChange={(e) => setEditFormData({ ...editFormData, mobileNumber: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email (Optional)</label>
                  <input
                    type="email"
                    value={editFormData.email}
                    onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                <CustomSelect
                  options={statusModalOptions}
                  value={editFormData.status}
                  onChange={(val) => setEditFormData({ ...editFormData, status: val as any })}
                  className="w-full"
                  buttonClassName="w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Address *</label>
                <textarea
                  rows={3}
                  required
                  value={editFormData.address}
                  onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingCustomer(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 size={14} className="animate-spin" />}
                  <span>Save</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── 6. Custom Delete Modal for Customer ──────────────────────── */}
      {deletingCustomer && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-full bg-red-50 text-red-500 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Customer</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Are you sure you want to delete <strong>{deletingCustomer.name}</strong> ({deletingCustomer.code})? This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button onClick={() => setDeletingCustomer(null)} className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50">
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

      {/* ── 7. View Customer Details Modal ──────────────────────────── */}
      {viewCustomer && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-600 border border-indigo-100 font-mono">
                  {viewCustomer.code}
                </span>
                <h3 className="text-base font-bold text-slate-900">{viewCustomer.name}</h3>
              </div>
              <button
                onClick={() => setViewCustomer(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-slate-600">
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-400 flex items-center gap-1"><Phone size={12} /> Mobile Number:</span>
                <span className="font-bold text-slate-900">{viewCustomer.mobileNumber}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-400 flex items-center gap-1"><Mail size={12} /> Email:</span>
                <span className="font-semibold text-slate-800">{viewCustomer.email || 'N/A'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-400 flex items-center gap-1"><MapPin size={12} /> Address:</span>
                <span className="font-medium text-slate-700 text-right max-w-[220px]">{viewCustomer.address}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Status:</span>
                <span className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${
                  viewCustomer.status === 'Active' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
                }`}>
                  {viewCustomer.status}
                </span>
              </div>
            </div>

            <div className="pt-3 flex justify-end">
              <button
                onClick={() => setViewCustomer(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 cursor-pointer"
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

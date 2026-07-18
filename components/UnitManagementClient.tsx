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
  Factory,
  Package,
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

export interface UnitItem {
  id: string;
  code: string;
  name: string;
  mobile: string;
  address: string;
  status: 'Active' | 'Inactive';
  createdAt?: any;
}

interface UnitManagementClientProps {
  unitType: 'manufacturing' | 'packing';
  title: string;
  collectionName: string;
  codePrefix: string;
}

export default function UnitManagementClient({
  unitType,
  title,
  collectionName,
  codePrefix,
}: UnitManagementClientProps) {
  const [units, setUnits] = useState<UnitItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [firebaseError, setFirebaseError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [itemsPerPage, setItemsPerPage] = useState('10');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [viewUnit, setViewUnit] = useState<UnitItem | null>(null);
  const [editingUnit, setEditingUnit] = useState<UnitItem | null>(null);
  const [deletingUnit, setDeletingUnit] = useState<UnitItem | null>(null);

  // New unit form state (Unit Name, Mobile Number, Address, Status)
  const [newUnit, setNewUnit] = useState({
    name: '',
    mobile: '',
    address: '',
    status: 'Active' as 'Active' | 'Inactive',
  });

  // Edit unit form state
  const [editFormData, setEditFormData] = useState({
    name: '',
    mobile: '',
    address: '',
    status: 'Active' as 'Active' | 'Inactive',
  });

  // Real-time Firebase Firestore listener
  useEffect(() => {
    const unitsCollectionRef = collection(db, collectionName);
    const q = query(unitsCollectionRef);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedUnits: UnitItem[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<UnitItem, 'id'>),
        }));

        // Sort by code locally
        fetchedUnits.sort((a, b) => (a.code || '').localeCompare(b.code || ''));

        setUnits(fetchedUnits);
        setIsLoading(false);
        setFirebaseError(null);
      },
      (error) => {
        console.error(`Error fetching ${collectionName} from Firestore:`, error);
        setFirebaseError(error.message || 'Failed to connect to Firebase');
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [collectionName]);

  // Filtered units
  const filteredUnits = units.filter((unit) => {
    const matchesSearch =
      unit.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      unit.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      unit.mobile.toLowerCase().includes(searchTerm.toLowerCase()) ||
      unit.address.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === 'All' ? true : unit.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Handle Add Unit directly to Firebase
  const handleAddUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUnit.name) return;

    try {
      setIsSubmitting(true);
      const nextNumber = units.length + 1;
      const nextCode = `${codePrefix}-${String(nextNumber).padStart(3, '0')}`;

      await addDoc(collection(db, collectionName), {
        code: nextCode,
        ...newUnit,
        createdAt: serverTimestamp(),
      });

      setIsAddModalOpen(false);
      setNewUnit({
        name: '',
        mobile: '',
        address: '',
        status: 'Active',
      });
    } catch (err: any) {
      console.error(`Failed to add ${unitType} unit to Firestore:`, err);
      setFirebaseError(err?.message || 'Failed to save unit');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Edit Modal
  const handleOpenEditModal = (unit: UnitItem) => {
    setEditingUnit(unit);
    setEditFormData({
      name: unit.name,
      mobile: unit.mobile,
      address: unit.address,
      status: unit.status,
    });
  };

  // Handle Edit Unit Submit to Firebase
  const handleUpdateUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUnit || !editFormData.name) return;

    try {
      setIsSubmitting(true);
      const unitRef = doc(db, collectionName, editingUnit.id);
      await updateDoc(unitRef, {
        name: editFormData.name,
        mobile: editFormData.mobile,
        address: editFormData.address,
        status: editFormData.status,
        updatedAt: serverTimestamp(),
      });

      setEditingUnit(null);
    } catch (err: any) {
      console.error('Failed to update unit:', err);
      setFirebaseError(err?.message || 'Failed to update unit');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Confirmed Delete Unit from Firebase
  const handleConfirmDelete = async () => {
    if (!deletingUnit) return;

    try {
      setIsDeleting(true);
      await deleteDoc(doc(db, collectionName, deletingUnit.id));
      setDeletingUnit(null);
    } catch (err: any) {
      console.error('Failed to delete unit:', err);
      setFirebaseError(err?.message || 'Failed to delete unit');
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

  const IconComponent = unitType === 'manufacturing' ? Factory : Package;

  return (
    <div className="w-full flex flex-col gap-6">

      {/* ── 1. Page Title & Action Bar ─────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{title}</h1>
          <nav className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
            <Link href="/" className="hover:text-indigo-600 transition-colors">Dashboard</Link>
            <span>&gt;</span>
            <span className="text-slate-800 font-medium">{title}</span>
          </nav>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 hover:from-indigo-600 hover:to-indigo-800 text-white text-sm font-semibold shadow-sm transition-all hover:shadow cursor-pointer w-full sm:w-auto"
        >
          <Plus size={16} />
          <span>Add {title}</span>
        </button>
      </div>

      {/* ── 2. View Tab ───────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <button className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold shadow-xs">
          {title} List
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
                Loading units...
              </span>
            ) : firebaseError ? (
              <span className="text-red-500 font-semibold">Error: {firebaseError}</span>
            ) : (
              <span>Total Units: <strong className="text-slate-800">{units.length}</strong></span>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <input
                type="text"
                placeholder={`Search ${title.toLowerCase()}...`}
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
              onClick={() => alert('Exporting data...')}
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
                <th className="py-3.5 px-4 sm:px-6">Unit Code</th>
                <th className="py-3.5 px-4">Unit Name</th>
                <th className="py-3.5 px-4">Mobile Number</th>
                <th className="py-3.5 px-4">Address</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 size={18} className="animate-spin text-indigo-600" />
                      <span>Loading units...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredUnits.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2 py-4">
                      <IconComponent size={32} className="text-slate-300" />
                      <p className="font-semibold text-slate-600">No {title.toLowerCase()} found</p>
                      <p className="text-xs text-slate-400">Click &quot;+ Add {title}&quot; above to create a new unit.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredUnits.map((unit) => (
                  <tr key={unit.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-4 px-4 sm:px-6 font-bold text-indigo-600">{unit.code}</td>
                    <td className="py-4 px-4 font-semibold text-slate-900">{unit.name}</td>
                    <td className="py-4 px-4 text-slate-600 whitespace-nowrap">{unit.mobile}</td>
                    <td className="py-4 px-4 text-slate-600 max-w-xs truncate">{unit.address}</td>
                    <td className="py-4 px-4">
                      <span
                        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                          unit.status === 'Active'
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                            : 'bg-red-50 text-red-500 border-red-200'
                        }`}
                      >
                        {unit.status}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setViewUnit(unit)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                          title="View Details"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          onClick={() => handleOpenEditModal(unit)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                          title="Edit Unit"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => setDeletingUnit(unit)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete Unit"
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
            Showing 1 to {filteredUnits.length} of {units.length} units
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

      {/* ── 4. Add Unit Modal ───────────────────────────────────────── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <IconComponent size={20} />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Add {title}</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddUnit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Unit Name *</label>
                <input
                  type="text"
                  required
                  placeholder={`e.g. ${title} #1`}
                  value={newUnit.name}
                  onChange={(e) => setNewUnit({ ...newUnit, name: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile Number</label>
                  <input
                    type="text"
                    placeholder="+91 98765 43210"
                    value={newUnit.mobile}
                    onChange={(e) => setNewUnit({ ...newUnit, mobile: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                  <CustomSelect
                    options={statusModalOptions}
                    value={newUnit.status}
                    onChange={(val) => setNewUnit({ ...newUnit, status: val as 'Active' | 'Inactive' })}
                    className="w-full"
                    buttonClassName="w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Address</label>
                <textarea
                  rows={3}
                  placeholder="Enter unit address details..."
                  value={newUnit.address}
                  onChange={(e) => setNewUnit({ ...newUnit, address: e.target.value })}
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

      {/* ── 5. Edit Unit Modal ──────────────────────────────────────── */}
      {editingUnit && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Pencil size={18} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Edit {title}</h3>
                  <p className="text-xs text-slate-400 font-mono">{editingUnit.code}</p>
                </div>
              </div>
              <button
                onClick={() => setEditingUnit(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUpdateUnit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Unit Name *</label>
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile Number</label>
                  <input
                    type="text"
                    value={editFormData.mobile}
                    onChange={(e) => setEditFormData({ ...editFormData, mobile: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                  />
                </div>
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">Address</label>
                <textarea
                  rows={3}
                  value={editFormData.address}
                  onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingUnit(null)}
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
      {deletingUnit && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-full bg-red-50 text-red-500 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={22} />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-slate-900">Delete {title}</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Are you sure you want to delete <strong className="text-slate-800">{deletingUnit.name}</strong> ({deletingUnit.code})? This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeletingUnit(null)}
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
                <span>Delete Unit</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 7. View Unit Details Modal ────────────────────────────── */}
      {viewUnit && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-600 border border-indigo-100">
                  {viewUnit.code}
                </span>
                <h3 className="text-base font-bold text-slate-900">{viewUnit.name}</h3>
              </div>
              <button
                onClick={() => setViewUnit(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-slate-600">
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-400">Mobile Number:</span>
                <span className="font-semibold text-slate-800">{viewUnit.mobile || 'N/A'}</span>
              </div>
              <div className="flex flex-col gap-1 py-1 border-b border-slate-50">
                <span className="text-slate-400">Address:</span>
                <span className="font-semibold text-slate-800 leading-relaxed">{viewUnit.address || 'N/A'}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Status:</span>
                <span className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${
                  viewUnit.status === 'Active' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
                }`}>
                  {viewUnit.status}
                </span>
              </div>
            </div>

            <div className="pt-3 flex justify-end">
              <button
                onClick={() => setViewUnit(null)}
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

'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Gift,
  Plus,
  Search,
  Eye,
  Pencil,
  Trash2,
  X,
  Loader2,
  Check,
  Package,
  Layers,
  Sparkles,
  ArrowRight,
  Grid3X3,
  Sliders,
  DollarSign,
  AlertTriangle,
  Info,
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
  query,
} from 'firebase/firestore';
import { toast } from '@/context/ToastContext';

export interface FestivalBoxRecord {
  id: string;
  code: string;
  name: string;
  rows: number;
  cols: number;
  basePrice?: number;
  description?: string;
  status: 'Active' | 'Inactive';
  createdAt?: any;
  updatedAt?: any;
}

export interface ItemSummary {
  id: string;
  name: string;
  price: number;
  piecePrice?: number;
  piecesPerKg?: number;
  imageUrl?: string;
  unit: string;
  category: string;
}

export default function FestivalBoxesClient() {
  const [boxes, setBoxes] = useState<FestivalBoxRecord[]>([]);
  const [items, setItems] = useState<ItemSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingBox, setEditingBox] = useState<FestivalBoxRecord | null>(null);
  const [deletingBox, setDeletingBox] = useState<FestivalBoxRecord | null>(null);
  const [previewSimulatorBox, setPreviewSimulatorBox] = useState<FestivalBoxRecord | null>(null);

  // Add / Edit Form State
  const emptyForm = {
    name: '',
    rows: 3,
    cols: 3,
    description: '',
    status: 'Active' as 'Active' | 'Inactive',
  };
  const [formData, setFormData] = useState(emptyForm);

  // 1. Subscribe to festival_boxes collection
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'festival_boxes')),
      (snapshot) => {
        const fetched: FestivalBoxRecord[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<FestivalBoxRecord, 'id'>),
        }));
        fetched.sort((a, b) => (a.code || '').localeCompare(b.code || ''));
        setBoxes(fetched);
        setIsLoading(false);
      },
      (err) => {
        console.error('Error fetching festival boxes:', err);
        setIsLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // 2. Subscribe to items collection for preview simulation
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'items')),
      (snapshot) => {
        const fetched: ItemSummary[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: data.name || '',
            price: Number(data.price) || 0,
            piecePrice: Number(data.piecePrice) || 0,
            piecesPerKg: Number(data.piecesPerKg) || 0,
            imageUrl: data.imageUrl || '',
            unit: data.unit || 'KG',
            category: data.category || 'Sweets',
          };
        });
        setItems(fetched);
      },
      (err) => console.error('Error fetching items for preview:', err)
    );
    return () => unsub();
  }, []);

  // Filtered Boxes
  const filteredBoxes = useMemo(() => {
    return boxes.filter((box) => {
      const matchSearch =
        box.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        box.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (box.description || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = statusFilter === 'All' || box.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [boxes, searchTerm, statusFilter]);

  // Handle Open Add Modal
  const handleOpenAddModal = () => {
    setFormData(emptyForm);
    setIsAddModalOpen(true);
  };

  // Handle Open Edit Modal
  const handleOpenEditModal = (box: FestivalBoxRecord) => {
    setEditingBox(box);
    setFormData({
      name: box.name,
      rows: box.rows || 3,
      cols: box.cols || 3,
      description: box.description || '',
      status: box.status || 'Active',
    });
  };

  // Handle Save Box (Create or Update)
  const handleSaveBox = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Validation Error', 'Box name is required.');
      return;
    }

    const rows = Math.min(8, Math.max(1, parseInt(String(formData.rows), 10) || 1));
    const cols = Math.min(8, Math.max(1, parseInt(String(formData.cols), 10) || 1));

    try {
      setIsSubmitting(true);

      if (editingBox) {
        // Update existing box
        await updateDoc(doc(db, 'festival_boxes', editingBox.id), {
          name: formData.name.trim(),
          rows: rows,
          cols: cols,
          compartmentsCount: rows * cols,
          description: formData.description.trim(),
          status: formData.status,
          updatedAt: serverTimestamp(),
        });
        toast.success('Box Updated', `"${formData.name}" updated successfully.`);
        setEditingBox(null);
      } else {
        // Create new box
        const nextNumber = boxes.length + 1;
        const nextCode = `FBX-${String(nextNumber).padStart(3, '0')}`;

        await addDoc(collection(db, 'festival_boxes'), {
          code: nextCode,
          name: formData.name.trim(),
          rows: rows,
          cols: cols,
          compartmentsCount: rows * cols,
          description: formData.description.trim(),
          status: formData.status,
          createdAt: serverTimestamp(),
        });
        toast.success('Box Created', `"${formData.name}" layout generated successfully.`);
        setIsAddModalOpen(false);
      }

      setFormData(emptyForm);
    } catch (err: any) {
      console.error('Failed to save festival box:', err);
      toast.error('Error', err?.message || 'Failed to save festival box.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Box
  const handleDeleteBox = async () => {
    if (!deletingBox) return;
    try {
      setIsDeleting(true);
      await deleteDoc(doc(db, 'festival_boxes', deletingBox.id));
      toast.success('Box Deleted', `"${deletingBox.name}" removed.`);
      setDeletingBox(null);
    } catch (err: any) {
      console.error('Failed to delete box:', err);
      toast.error('Error', 'Failed to delete box.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-[#f7f7f8] text-slate-900 pb-16">
      {/* ── TOP HEADER ─────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200/90 sticky top-0 z-20 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#02626D] to-[#014d56] text-white flex items-center justify-center shadow-xs">
              <Gift size={20} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
                  Festival Boxes
                </h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-[#02626D] border border-teal-200">
                  {boxes.length} Templates
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Design custom gift sweet boxes with row & column compartment grids for festival orders
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/orders/create"
              className="h-9 px-3.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Package size={14} className="text-[#02626D]" />
              <span>Create Order</span>
            </Link>

            <button
              type="button"
              onClick={handleOpenAddModal}
              className="h-9 px-4 rounded-xl bg-[#02626D] hover:bg-[#014d56] text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Plus size={15} />
              <span>Add Box</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT CONTAINER ─────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 space-y-5">
        
        {/* Info Banner */}
        <div className="bg-gradient-to-r from-amber-500/10 via-teal-500/10 to-transparent p-4 rounded-2xl border border-amber-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-900 flex items-center justify-center shrink-0 mt-0.5">
              <Sparkles size={17} />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-amber-950">
                Custom Compartment Layouts & Manufacturing Scale
              </h3>
              <p className="text-xs text-amber-900/80 mt-0.5 max-w-2xl">
                Define the rows and columns for each sweet box. When billing orders, staff can select sweets for every compartment, set piece counts, and the system automatically converts pieces to KGs for the kitchen!
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-bold text-teal-800 bg-white/80 px-2.5 py-1 rounded-lg border border-teal-200 shadow-2xs flex items-center gap-1">
              <Check size={12} className="text-teal-600" />
              <span>Ready in Create Order Accordion</span>
            </span>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <input
              type="text"
              placeholder="Search boxes by name or code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-8 h-9 text-xs border border-slate-300 rounded-xl bg-[#f7f7f8] focus:bg-white focus:outline-none focus:border-[#02626D] font-medium"
            />
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
            {(['All', 'Active', 'Inactive'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`h-8 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === st
                    ? 'bg-[#02626D] text-white shadow-2xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* ── BOXES GRID (GENERATED DIVS CONTAINING BOXES) ──────────────── */}
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400 bg-white rounded-2xl border border-slate-200">
            <Loader2 size={28} className="animate-spin text-[#02626D]" />
            <p className="text-xs font-semibold">Loading Festival Box Templates...</p>
          </div>
        ) : filteredBoxes.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-2xl border border-dashed border-slate-300 p-8">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3">
              <Gift size={28} />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No Festival Boxes Found</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {searchTerm
                ? 'No box matches your search query. Try clearing the search.'
                : 'Click "Add Box" to specify rows and columns, and generate your first custom festival gift box div!'}
            </p>
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="mt-4 inline-flex items-center gap-1.5 h-8.5 px-4 rounded-xl bg-[#02626D] text-white text-xs font-bold hover:bg-[#014d56] transition-all cursor-pointer"
            >
              <Plus size={14} />
              <span>Create First Box</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredBoxes.map((box) => {
              const rows = box.rows || 3;
              const cols = box.cols || 3;
              const totalCells = rows * cols;

              return (
                <div
                  key={box.id}
                  className="bg-white rounded-2xl border border-slate-200/90 hover:border-teal-300 shadow-2xs hover:shadow-md transition-all flex flex-col overflow-hidden group"
                >
                  {/* Box Top Header */}
                  <div className="p-4 pb-3 border-b border-slate-100 flex items-start justify-between gap-2 bg-gradient-to-b from-slate-50/50 to-white">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                          {box.code}
                        </span>
                        <span
                          className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full ${
                            box.status === 'Active'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {box.status}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 mt-1 truncate" title={box.name}>
                        {box.name}
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                        {box.description || `${rows} × ${cols} Compartment Grid Layout`}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(box)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                        title="Edit Box"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingBox(box)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        title="Delete Box"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* ── GENERATED DIV CONTAINING THE BOXES / COMPARTMENTS ── */}
                  <div className="p-4 flex-1 flex flex-col items-center justify-center bg-gradient-to-b from-[#fbfbfa] to-[#f4f3ef]/60">
                    <div className="w-full max-w-[280px]">
                      {/* Realistic Indian Sweet Gift Box Frame */}
                      <div className="relative p-2.5 sm:p-3 rounded-2xl bg-gradient-to-br from-amber-700 via-amber-800 to-amber-900 shadow-md border-2 border-amber-600/70">
                        {/* Decorative Gold Rim & Texture */}
                        <div className="absolute inset-0.5 rounded-[14px] border border-amber-400/40 pointer-events-none" />
                        
                        {/* Box Inner Parchment / Tray Container */}
                        <div
                          className="bg-gradient-to-br from-[#fffdf9] to-[#faf5eb] rounded-xl p-2 shadow-inner border border-amber-950/20"
                          style={{
                            display: 'grid',
                            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                            gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
                            gap: '5px',
                            aspectRatio: `${cols} / ${rows}`,
                            maxHeight: '220px',
                          }}
                        >
                          {Array.from({ length: totalCells }).map((_, idx) => (
                            <div
                              key={idx}
                              className="relative rounded-lg bg-white/90 border border-amber-300/60 shadow-2xs flex flex-col items-center justify-center p-1 group/slot transition-all hover:bg-amber-50 hover:border-amber-400"
                            >
                              <span className="text-[8.5px] font-mono font-bold text-amber-900/60 group-hover/slot:text-amber-900">
                                #{idx + 1}
                              </span>
                              <div className="w-1.5 h-1.5 rounded-full bg-amber-400/50 mt-0.5" />
                            </div>
                          ))}
                        </div>

                        {/* Metallic Box Seal Emblem */}
                        <div className="absolute -bottom-2 right-3 px-2 py-0.5 bg-gradient-to-r from-amber-500 to-amber-600 rounded-full shadow-xs border border-amber-300 text-[8.5px] font-extrabold text-amber-950 flex items-center gap-1">
                          <Sparkles size={8} />
                          <span>{rows}×{cols} Box</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card Bottom Meta & Actions */}
                  <div className="p-3.5 px-4 bg-white border-t border-slate-100 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block">
                        Dimensions
                      </span>
                      <span className="font-extrabold text-slate-800">
                        {rows} × {cols}{' '}
                        <span className="font-normal text-slate-500">
                          ({totalCells} Compartments)
                        </span>
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block">
                        Box Pricing
                      </span>
                      <span className="text-[11px] font-bold text-[#02626D] bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                        Sum of Pieces
                      </span>
                    </div>
                  </div>

                  {/* Interactive Simulator Button */}
                  <div className="p-2.5 px-4 pt-0 bg-white">
                    <button
                      type="button"
                      onClick={() => setPreviewSimulatorBox(box)}
                      className="w-full h-8 rounded-xl bg-slate-50 hover:bg-teal-50 text-slate-700 hover:text-[#02626D] border border-slate-200/90 hover:border-teal-200 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Eye size={13} />
                      <span>Test Fill & Preview</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── ADD / EDIT BOX MODAL ────────────────────────────────────── */}
      {(isAddModalOpen || editingBox) && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-teal-50 text-[#02626D] flex items-center justify-center font-bold">
                  <Gift size={16} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                    {editingBox ? 'Edit Festival Box Template' : 'Add New Festival Box'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Specify rows and columns to generate the box layout
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingBox(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveBox} className="space-y-4">
              {/* Box Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Box Template Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Royal 9-Compartment Festival Box"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-[#02626D] font-medium"
                />
              </div>

              {/* Rows and Columns */}
              <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
                {/* Rows Input */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-800">
                      Rows Count <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">1 to 8</span>
                  </div>
                  <input
                    type="number"
                    min="1"
                    max="8"
                    required
                    value={formData.rows}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        rows: Math.min(8, Math.max(1, parseInt(e.target.value, 10) || 1)),
                      })
                    }
                    className="w-full px-3 py-2 text-xs font-bold border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-[#02626D]"
                  />
                  {/* Row Preset Buttons */}
                  <div className="flex items-center gap-1 mt-1.5">
                    {[2, 3, 4].map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setFormData({ ...formData, rows: r })}
                        className={`text-[10px] px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                          formData.rows === r
                            ? 'bg-[#02626D] text-white'
                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {r} Rows
                      </button>
                    ))}
                  </div>
                </div>

                {/* Columns Input */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-800">
                      Columns Count <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">1 to 8</span>
                  </div>
                  <input
                    type="number"
                    min="1"
                    max="8"
                    required
                    value={formData.cols}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        cols: Math.min(8, Math.max(1, parseInt(e.target.value, 10) || 1)),
                      })
                    }
                    className="w-full px-3 py-2 text-xs font-bold border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-[#02626D]"
                  />
                  {/* Col Preset Buttons */}
                  <div className="flex items-center gap-1 mt-1.5">
                    {[2, 3, 4].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setFormData({ ...formData, cols: c })}
                        className={`text-[10px] px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                          formData.cols === c
                            ? 'bg-[#02626D] text-white'
                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {c} Cols
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Status & Pricing Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({ ...formData, status: e.target.value as 'Active' | 'Inactive' })
                    }
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-[#02626D] cursor-pointer"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>

                <div className="p-2.5 rounded-xl bg-teal-50/80 border border-teal-200 text-[11px] text-teal-900 leading-tight flex items-start gap-2">
                  <span className="text-base shrink-0">💡</span>
                  <div>
                    <span className="font-bold block text-teal-950">Dynamic Sweet Pricing:</span>
                    Box price is purely the sum of the piece prices placed inside this box.
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description / Packaging Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Premium gold-embossed box with handle & clear partition tray"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-[#02626D]"
                />
              </div>

              {/* ── LIVE DYNAMIC VISUAL BOX PREVIEW IN MODAL ── */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Grid3X3 size={13} className="text-[#02626D]" />
                    <span>Live Generated Box Div Preview</span>
                  </label>
                  <span className="text-[10px] font-bold text-[#02626D] bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                    {formData.rows} Rows × {formData.cols} Columns = {formData.rows * formData.cols} Compartments
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-gradient-to-br from-[#f8f7f4] to-[#f0eee9] border border-slate-200 flex items-center justify-center">
                  <div className="w-full max-w-[260px] p-2.5 rounded-2xl bg-gradient-to-br from-amber-700 to-amber-900 border-2 border-amber-500 shadow-md">
                    <div
                      className="bg-[#faf5eb] rounded-xl p-2 shadow-inner"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${formData.cols}, minmax(0, 1fr))`,
                        gridTemplateRows: `repeat(${formData.rows}, minmax(0, 1fr))`,
                        gap: '5px',
                        aspectRatio: `${formData.cols} / ${formData.rows}`,
                        maxHeight: '190px',
                      }}
                    >
                      {Array.from({ length: formData.rows * formData.cols }).map((_, idx) => (
                        <div
                          key={idx}
                          className="rounded-lg bg-white border border-amber-300/70 shadow-2xs flex flex-col items-center justify-center p-1 text-[9px] font-mono font-bold text-amber-900"
                        >
                          Slot {idx + 1}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingBox(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-[#02626D] hover:bg-[#014d56] rounded-xl transition-all shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmitting && <Loader2 size={13} className="animate-spin" />}
                  <span>{editingBox ? 'Update Box Template' : 'Generate & Save Box'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRMATION MODAL ──────────────────────────────── */}
      {deletingBox && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
              <AlertTriangle size={20} />
            </div>
            <div className="text-center">
              <h3 className="text-sm font-bold text-slate-900">Delete Festival Box</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to delete <span className="font-bold text-slate-800">"{deletingBox.name}"</span>?
                This box layout template will be removed.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingBox(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteBox}
                className="px-5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs disabled:opacity-50 flex items-center gap-1.5"
              >
                {isDeleting && <Loader2 size={13} className="animate-spin" />}
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── INTERACTIVE PREVIEW & TEST FILL SIMULATOR ───────────────── */}
      {previewSimulatorBox && (
        <SimulatorModal
          box={previewSimulatorBox}
          items={items}
          onClose={() => setPreviewSimulatorBox(null)}
        />
      )}
    </div>
  );
}

// ── SUB-COMPONENT: INTERACTIVE SWEET BOX SIMULATOR ──────────────────
function SimulatorModal({
  box,
  items,
  onClose,
}: {
  box: FestivalBoxRecord;
  items: ItemSummary[];
  onClose: () => void;
}) {
  const rows = box.rows || 3;
  const cols = box.cols || 3;
  const totalCells = rows * cols;

  interface SlotFill {
    itemId?: string;
    itemName?: string;
    imageUrl?: string;
    piecePrice?: number;
    piecesPerKg?: number;
    pieces: number;
  }

  const [slotFills, setSlotFills] = useState<Record<number, SlotFill>>({});
  const [activeSlotIdx, setActiveSlotIdx] = useState<number | null>(null);

  // Quick fill random sweets to test layout
  const handleAutoFill = () => {
    if (items.length === 0) return;
    const newFills: Record<number, SlotFill> = {};
    for (let i = 0; i < totalCells; i++) {
      const sweet = items[i % items.length];
      newFills[i] = {
        itemId: sweet.id,
        itemName: sweet.name,
        imageUrl: sweet.imageUrl,
        piecePrice: sweet.piecePrice || 25,
        piecesPerKg: sweet.piecesPerKg || 20,
        pieces: 2,
      };
    }
    setSlotFills(newFills);
  };

  const handleClear = () => {
    setSlotFills({});
  };

  // Calculations
  const totalPieces = Object.values(slotFills).reduce((s, f) => s + (f.pieces || 0), 0);
  const totalWeightKg = Object.values(slotFills).reduce((s, f) => {
    const pKg = f.piecesPerKg || 20;
    return s + (f.pieces || 0) / pKg;
  }, 0);
  const sweetsPrice = Object.values(slotFills).reduce(
    (s, f) => s + (f.pieces || 0) * (f.piecePrice || 0),
    0
  );
  const grandTotal = sweetsPrice;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-3xl w-full p-5 sm:p-6 shadow-2xl border border-slate-100 space-y-4 my-8">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
              <Gift size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900">{box.name}</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-[#02626D] border border-teal-200">
                  {rows} × {cols} Grid ({totalCells} Slots)
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Interactive box simulator and sweet preview</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAutoFill}
              className="px-2.5 py-1 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-all cursor-pointer"
            >
              ⚡ Auto-Fill
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="px-2.5 py-1 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── BIG BOX CONTAINER ── */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
          {/* Left: The Big Sweet Box with Compartments */}
          <div className="md:col-span-8 p-4 rounded-2xl bg-gradient-to-br from-[#fbfbfa] to-[#f4f3ef] border border-slate-200 flex flex-col items-center justify-center">
            <div className="w-full max-w-[380px] p-3 sm:p-4 rounded-3xl bg-gradient-to-br from-amber-700 via-amber-800 to-amber-900 shadow-xl border-3 border-amber-500/80">
              <div
                className="bg-gradient-to-br from-[#fffdfa] to-[#f7f2e7] rounded-2xl p-2.5 shadow-inner"
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                  gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
                  gap: '8px',
                  aspectRatio: `${cols} / ${rows}`,
                }}
              >
                {Array.from({ length: totalCells }).map((_, idx) => {
                  const fill = slotFills[idx];
                  return (
                    <div
                      key={idx}
                      onClick={() => setActiveSlotIdx(idx)}
                      className={`relative rounded-xl border transition-all cursor-pointer flex flex-col items-center justify-center p-1.5 text-center group ${
                        fill
                          ? 'bg-amber-50/80 border-amber-300 shadow-2xs hover:border-amber-500'
                          : 'bg-white/80 border-dashed border-amber-300/80 hover:bg-amber-50/50 hover:border-amber-400'
                      }`}
                    >
                      {fill ? (
                        <div className="w-full h-full flex flex-col items-center justify-between">
                          {fill.imageUrl ? (
                            <img
                              src={fill.imageUrl}
                              alt={fill.itemName}
                              className="w-7 h-7 sm:w-8 sm:h-8 object-cover rounded-md shadow-2xs"
                            />
                          ) : (
                            <div className="w-6 h-6 rounded-md bg-amber-200/80 text-amber-900 font-bold text-[10px] flex items-center justify-center">
                              🍬
                            </div>
                          )}
                          <span className="text-[10px] font-bold text-slate-800 line-clamp-1 w-full truncate">
                            {fill.itemName}
                          </span>
                          <span className="text-[8.5px] font-bold text-amber-800 bg-amber-100/80 px-1.5 py-0.2 rounded-full">
                            {fill.pieces} pcs • ₹{(fill.pieces * (fill.piecePrice || 0)).toFixed(0)}
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center text-amber-800/40 group-hover:text-amber-800">
                          <Plus size={16} />
                          <span className="text-[9px] font-bold font-mono">Slot {idx + 1}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: Calculations & Manufacturing Projections */}
          <div className="md:col-span-4 space-y-3">
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2.5 text-xs">
              <h4 className="font-extrabold text-slate-900 uppercase tracking-wider text-[11px] pb-1 border-b border-slate-200 flex items-center justify-between">
                <span>Box Summary</span>
                <span className="text-teal-700">Live Preview</span>
              </h4>

              <div className="flex justify-between py-0.5">
                <span className="text-slate-500">Filled Slots:</span>
                <span className="font-bold text-slate-800">
                  {Object.keys(slotFills).length} / {totalCells}
                </span>
              </div>

              <div className="flex justify-between py-0.5">
                <span className="text-slate-500">Total Pieces:</span>
                <span className="font-extrabold text-slate-900">{totalPieces} pcs</span>
              </div>

              {/* Manufacturing KG Calculation */}
              <div className="p-2.5 rounded-xl bg-teal-50 border border-teal-200 text-teal-900 space-y-1">
                <div className="flex items-center justify-between font-bold text-[11px]">
                  <span>🏭 Weight for Mfg:</span>
                  <span className="font-extrabold text-[#02626D] font-mono">
                    {totalWeightKg.toFixed(3)} KG
                  </span>
                </div>
                <p className="text-[9.5px] text-teal-700/90 leading-tight">
                  Auto-calculated using individual sweet "Pieces Per KG" setting
                </p>
              </div>

              <div className="flex justify-between py-1.5 border-t border-slate-200 text-sm font-extrabold text-[#02626D]">
                <span>Box Price (Sum of Pieces):</span>
                <span>₹{sweetsPrice.toFixed(2)}</span>
              </div>
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/80 text-[10.5px] text-amber-900">
              <span className="font-bold block mb-0.5">💡 How it works in Create Order:</span>
              Cashiers open the "Festival Boxes" accordion on the order screen, pick this box, click any compartment to choose sweets and set piece counts, and add to the customer's order in 1 click!
            </div>
          </div>
        </div>

        {/* Close Button */}
        <div className="flex justify-end pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold text-white bg-[#02626D] hover:bg-[#014d56] rounded-xl transition-all cursor-pointer"
          >
            Done Previewing
          </button>
        </div>
      </div>
    </div>
  );
}

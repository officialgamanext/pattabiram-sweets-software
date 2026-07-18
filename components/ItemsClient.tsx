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
  Package,
  FolderPlus,
  Upload,
  FileSpreadsheet,
  FileDown,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import CustomSelect, { CustomSelectOption } from '@/components/CustomSelect';
import { db } from '@/lib/firebase';
import { compressImageTo60KB, uploadToImageKit } from '@/lib/imageCompressor';
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

export interface ItemRecord {
  id: string;
  code: string;
  name: string;
  imageUrl?: string;
  price: number;
  category: string;
  unit: 'KG' | 'Piece' | 'Packet' | 'Litre';
  manufacturingUnitId?: string;
  manufacturingUnitName?: string;
  packingUnitId?: string;
  packingUnitName?: string;
  status: 'Active' | 'Inactive';
  createdAt?: any;
}

export interface CategoryRecord {
  id: string;
  name: string;
  icon: string;
  status: 'Active' | 'Inactive';
  createdAt?: any;
}

interface DropdownUnitOption {
  id: string;
  name: string;
}

interface BulkParsedItem {
  name: string;
  price: number;
  category: string;
  unit: 'KG' | 'Piece' | 'Packet' | 'Litre';
  manufacturingUnitName: string;
  packingUnitName: string;
  status: 'Active' | 'Inactive';
}

export default function ItemsClient() {
  const [activeTab, setActiveTab] = useState<'items' | 'categories'>('items');
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [mfgUnits, setMfgUnits] = useState<DropdownUnitOption[]>([]);
  const [pckUnits, setPckUnits] = useState<DropdownUnitOption[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [firebaseError, setFirebaseError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [itemsPerPage, setItemsPerPage] = useState('10');

  // Modals
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [isAddCategoryModalOpen, setIsAddCategoryModalOpen] = useState(false);
  const [isBulkUploadModalOpen, setIsBulkUploadModalOpen] = useState(false);

  const [viewItem, setViewItem] = useState<ItemRecord | null>(null);
  const [editingItem, setEditingItem] = useState<ItemRecord | null>(null);
  const [deletingItem, setDeletingItem] = useState<ItemRecord | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<CategoryRecord | null>(null);

  // Pending image file for Save click
  const [pendingImageBase64, setPendingImageBase64] = useState<string>('');
  const [pendingFileName, setPendingFileName] = useState<string>('');

  // Bulk Upload State
  const [bulkParsedItems, setBulkParsedItems] = useState<BulkParsedItem[]>([]);
  const [bulkFileName, setBulkFileName] = useState<string>('');

  // Forms State
  const emptyItemForm = {
    name: '',
    price: '',
    category: '',
    unit: 'KG' as 'KG' | 'Piece' | 'Packet' | 'Litre',
    manufacturingUnitName: '',
    packingUnitName: '',
    imageUrl: '',
    status: 'Active' as 'Active' | 'Inactive',
  };
  const [newItem, setNewItem] = useState(emptyItemForm);
  const [editItemForm, setEditItemForm] = useState(emptyItemForm);

  const emptyCategoryForm = {
    name: '',
    icon: '🍰',
    status: 'Active' as 'Active' | 'Inactive',
  };
  const [newCategory, setNewCategory] = useState(emptyCategoryForm);

  // 1. Subscribe to Items collection
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'items')),
      (snapshot) => {
        const fetched: ItemRecord[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<ItemRecord, 'id'>),
        }));
        fetched.sort((a, b) => (a.code || '').localeCompare(b.code || ''));
        setItems(fetched);
        setIsLoading(false);
      },
      (err) => {
        console.error('Error fetching items:', err);
        setFirebaseError(err.message);
        setIsLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // 2. Subscribe to Categories collection
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'categories')),
      (snapshot) => {
        const fetched: CategoryRecord[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<CategoryRecord, 'id'>),
        }));

        if (fetched.length === 0 && snapshot.metadata.fromCache === false) {
          const defaults = [
            { name: 'Sweets', icon: '🍰', status: 'Active' },
            { name: 'Savouries', icon: '📦', status: 'Active' },
            { name: 'Bakery', icon: '🍪', status: 'Active' },
            { name: 'Beverages', icon: '🥤', status: 'Active' },
          ];
          defaults.forEach((def) => {
            addDoc(collection(db, 'categories'), {
              ...def,
              createdAt: serverTimestamp(),
            });
          });
        }

        setCategories(fetched);
      },
      (err) => console.error('Error fetching categories:', err)
    );
    return () => unsub();
  }, []);

  // 3. Subscribe to Manufacturing Units collection
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'manufacturing_units')),
      (snapshot) => {
        const fetched = snapshot.docs.map((d) => ({
          id: d.id,
          name: d.data().name || d.data().code || 'Manufacturing Unit',
        }));
        setMfgUnits(fetched);
      }
    );
    return () => unsub();
  }, []);

  // 4. Subscribe to Packing Units collection
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'packing_units')),
      (snapshot) => {
        const fetched = snapshot.docs.map((d) => ({
          id: d.id,
          name: d.data().name || d.data().code || 'Packing Unit',
        }));
        setPckUnits(fetched);
      }
    );
    return () => unsub();
  }, []);

  // Compress image on file choose (NO upload until Save click)
  const handleImageSelect = async (
    e: React.ChangeEvent<HTMLInputElement>,
    isEditMode: boolean = false
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsCompressing(true);
      const compressedBase64 = await compressImageTo60KB(file);
      setPendingImageBase64(compressedBase64);
      setPendingFileName(file.name);

      if (isEditMode) {
        setEditItemForm((prev) => ({ ...prev, imageUrl: compressedBase64 }));
      } else {
        setNewItem((prev) => ({ ...prev, imageUrl: compressedBase64 }));
      }
    } catch (err) {
      console.error('Image compression failed:', err);
      alert('Failed to process image. Please try a different image.');
    } finally {
      setIsCompressing(false);
    }
  };

  // Handle Add Item (Upload to ImageKit ON CLICK OF SAVE)
  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.name || !newItem.price) return;

    try {
      setIsSubmitting(true);
      let finalImageUrl = newItem.imageUrl || '';

      if (pendingImageBase64) {
        finalImageUrl = await uploadToImageKit(
          pendingImageBase64,
          `${Date.now()}_${pendingFileName || 'item.jpg'}`
        );
      }

      const nextNumber = items.length + 1;
      const nextCode = `ITM-${String(nextNumber).padStart(3, '0')}`;

      await addDoc(collection(db, 'items'), {
        code: nextCode,
        name: newItem.name,
        price: parseFloat(newItem.price) || 0,
        category: newItem.category || (categories[0]?.name || 'Sweets'),
        unit: newItem.unit,
        manufacturingUnitName: newItem.manufacturingUnitName || (mfgUnits[0]?.name || 'N/A'),
        packingUnitName: newItem.packingUnitName || (pckUnits[0]?.name || 'N/A'),
        imageUrl: finalImageUrl,
        status: newItem.status,
        createdAt: serverTimestamp(),
      });

      setIsAddItemModalOpen(false);
      setNewItem(emptyItemForm);
      setPendingImageBase64('');
      setPendingFileName('');
    } catch (err: any) {
      console.error('Failed to add item:', err);
      setFirebaseError(err?.message || 'Failed to save item');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Edit Item (Upload to ImageKit ON CLICK OF SAVE)
  const handleUpdateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !editItemForm.name) return;

    try {
      setIsSubmitting(true);
      let finalImageUrl = editItemForm.imageUrl || '';

      if (pendingImageBase64) {
        finalImageUrl = await uploadToImageKit(
          pendingImageBase64,
          `${Date.now()}_${pendingFileName || 'item.jpg'}`
        );
      }

      const itemRef = doc(db, 'items', editingItem.id);
      await updateDoc(itemRef, {
        name: editItemForm.name,
        price: parseFloat(editItemItemFormPrice(editItemForm.price)) || 0,
        category: editItemForm.category,
        unit: editItemForm.unit,
        manufacturingUnitName: editItemForm.manufacturingUnitName,
        packingUnitName: editItemForm.packingUnitName,
        imageUrl: finalImageUrl,
        status: editItemForm.status,
        updatedAt: serverTimestamp(),
      });

      setEditingItem(null);
      setPendingImageBase64('');
      setPendingFileName('');
    } catch (err: any) {
      console.error('Failed to update item:', err);
      setFirebaseError(err?.message || 'Failed to update item');
    } finally {
      setIsSubmitting(false);
    }
  };

  const editItemItemFormPrice = (val: string) => {
    return parseFloat(val) || 0;
  };

  // Download Sample Excel Template
  const handleDownloadSampleExcel = () => {
    const sampleData = [
      {
        'Item Name': 'Special Mysore Pak',
        'Price': 480,
        'Category': 'Sweets',
        'Unit': 'KG',
        'Manufacturing Unit': mfgUnits[0]?.name || 'Main Factory',
        'Packing Unit': pckUnits[0]?.name || 'Central Packing Unit',
        'Status': 'Active',
      },
      {
        'Item Name': 'Kaju Katli',
        'Price': 950,
        'Category': 'Sweets',
        'Unit': 'KG',
        'Manufacturing Unit': mfgUnits[0]?.name || 'Main Factory',
        'Packing Unit': pckUnits[0]?.name || 'Central Packing Unit',
        'Status': 'Active',
      },
      {
        'Item Name': 'Motichoor Ladoo',
        'Price': 380,
        'Category': 'Sweets',
        'Unit': 'KG',
        'Manufacturing Unit': mfgUnits[0]?.name || 'Main Factory',
        'Packing Unit': pckUnits[0]?.name || 'Central Packing Unit',
        'Status': 'Active',
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sample Items');
    XLSX.writeFile(workbook, 'sample_items_template.xlsx');
  };

  // Handle Excel File Upload & Parse
  const handleExcelFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBulkFileName(file.name);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawData: any[] = XLSX.utils.sheet_to_json(ws);

        const parsed: BulkParsedItem[] = rawData.map((row) => ({
          name: row['Item Name'] || row['ItemName'] || row['name'] || 'Unnamed Item',
          price: parseFloat(row['Price'] || row['price'] || 0),
          category: row['Category'] || row['category'] || 'Sweets',
          unit: (row['Unit'] || row['unit'] || 'KG') as any,
          manufacturingUnitName: row['Manufacturing Unit'] || row['manufacturingUnit'] || mfgUnits[0]?.name || 'Main Factory',
          packingUnitName: row['Packing Unit'] || row['packingUnit'] || pckUnits[0]?.name || 'Central Packing Unit',
          status: (row['Status'] || row['status'] || 'Active') as any,
        }));

        setBulkParsedItems(parsed);
      } catch (err) {
        console.error('Failed to parse Excel file:', err);
        alert('Failed to parse Excel file. Please use the sample template.');
      }
    };

    reader.readAsBinaryString(file);
  };

  // Submit Bulk Items to Firebase
  const handleSaveBulkItems = async () => {
    if (bulkParsedItems.length === 0) return;

    try {
      setIsSubmitting(true);
      let currentCount = items.length;

      for (const item of bulkParsedItems) {
        currentCount++;
        const nextCode = `ITM-${String(currentCount).padStart(3, '0')}`;

        await addDoc(collection(db, 'items'), {
          code: nextCode,
          name: item.name,
          price: item.price,
          category: item.category,
          unit: item.unit,
          manufacturingUnitName: item.manufacturingUnitName,
          packingUnitName: item.packingUnitName,
          imageUrl: '',
          status: item.status,
          createdAt: serverTimestamp(),
        });
      }

      setIsBulkUploadModalOpen(false);
      setBulkParsedItems([]);
      setBulkFileName('');
    } catch (err: any) {
      console.error('Failed to bulk upload items:', err);
      setFirebaseError(err?.message || 'Failed bulk upload');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add Category Submit
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategory.name) return;

    try {
      setIsSubmitting(true);
      await addDoc(collection(db, 'categories'), {
        name: newCategory.name,
        icon: newCategory.icon || '🍰',
        status: newCategory.status,
        createdAt: serverTimestamp(),
      });

      setIsAddCategoryModalOpen(false);
      setNewCategory(emptyCategoryForm);
    } catch (err: any) {
      console.error('Failed to add category:', err);
      setFirebaseError(err?.message || 'Failed to save category');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Item
  const handleConfirmDeleteItem = async () => {
    if (!deletingItem) return;

    try {
      setIsDeleting(true);
      await deleteDoc(doc(db, 'items', deletingItem.id));
      setDeletingItem(null);
    } catch (err: any) {
      console.error('Failed to delete item:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Delete Category
  const handleConfirmDeleteCategory = async () => {
    if (!deletingCategory) return;

    try {
      setIsDeleting(true);
      await deleteDoc(doc(db, 'categories', deletingCategory.id));
      setDeletingCategory(null);
    } catch (err: any) {
      console.error('Failed to delete category:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered items
  const filteredItems = items.filter((item) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      item.name.toLowerCase().includes(term) ||
      item.code.toLowerCase().includes(term) ||
      item.category.toLowerCase().includes(term);

    const matchesStatus =
      statusFilter === 'All' ? true : item.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Custom Select Dropdowns Options
  const categoryOptions: CustomSelectOption[] = categories.map((c) => ({
    value: c.name,
    label: `${c.icon} ${c.name}`,
  }));

  const unitOptions: CustomSelectOption[] = [
    { value: 'KG', label: 'KG (Kilogram)' },
    { value: 'Piece', label: 'Piece' },
    { value: 'Packet', label: 'Packet' },
    { value: 'Litre', label: 'Litre' },
  ];

  const mfgUnitOptions: CustomSelectOption[] = mfgUnits.length > 0
    ? mfgUnits.map((u) => ({ value: u.name, label: u.name }))
    : [{ value: 'Main Factory', label: 'Main Factory' }];

  const pckUnitOptions: CustomSelectOption[] = pckUnits.length > 0
    ? pckUnits.map((u) => ({ value: u.name, label: u.name }))
    : [{ value: 'Central Packing Unit', label: 'Central Packing Unit' }];

  const statusFilterOptions: CustomSelectOption[] = [
    { value: 'All', label: 'All Statuses' },
    { value: 'Active', label: 'Active Only', badge: 'Active' },
    { value: 'Inactive', label: 'Inactive Only', badge: 'Inactive' },
  ];

  const statusModalOptions: CustomSelectOption[] = [
    { value: 'Active', label: 'Active' },
    { value: 'Inactive', label: 'Inactive' },
  ];

  const categoryIconOptions = ['🍰', '🍬', '🍪', '🥛', '📦', '🥤', '🎁', '🍨', '🍿'];

  return (
    <div className="w-full flex flex-col gap-6">

      {/* ── 1. Page Title & Action Bar ─────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Items</h1>
          <nav className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
            <Link href="/" className="hover:text-indigo-600 transition-colors">Dashboard</Link>
            <span>&gt;</span>
            <span className="text-slate-800 font-medium">Items</span>
          </nav>
        </div>

        {activeTab === 'items' ? (
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={() => setIsBulkUploadModalOpen(true)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold shadow-2xs transition-all cursor-pointer flex-1 sm:flex-none"
            >
              <FileSpreadsheet size={16} className="text-indigo-600" />
              <span>Bulk Upload</span>
            </button>

            <button
              onClick={() => setIsAddItemModalOpen(true)}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 hover:from-indigo-600 hover:to-indigo-800 text-white text-sm font-semibold shadow-sm transition-all hover:shadow cursor-pointer flex-1 sm:flex-none"
            >
              <Plus size={16} />
              <span>Add Item</span>
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsAddCategoryModalOpen(true)}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 hover:from-indigo-600 hover:to-indigo-800 text-white text-sm font-semibold shadow-sm transition-all hover:shadow cursor-pointer w-full sm:w-auto"
          >
            <FolderPlus size={16} />
            <span>Add Category</span>
          </button>
        )}
      </div>

      {/* ── 2. Navigation Tabs (Items List vs Categories) ─────────── */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('items')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'items'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Items List ({items.length})
        </button>
        <button
          onClick={() => setActiveTab('categories')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'categories'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Categories ({categories.length})
        </button>
      </div>

      {/* ── 3. Tab Content 1: Items List ───────────────────────────── */}
      {activeTab === 'items' && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          {/* Top Search & Filter Bar */}
          <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-500 font-medium">
              {isLoading ? (
                <span className="flex items-center gap-2 text-indigo-600">
                  <Loader2 size={14} className="animate-spin" />
                  Loading items...
                </span>
              ) : firebaseError ? (
                <span className="text-red-500 font-semibold">Error: {firebaseError}</span>
              ) : (
                <span>Total Items: <strong className="text-slate-800">{items.length}</strong></span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <input
                  type="text"
                  placeholder="Search items..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-3.5 pr-9 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 bg-slate-50/50"
                />
                <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>

              <CustomSelect
                options={statusFilterOptions}
                value={statusFilter}
                onChange={setStatusFilter}
                icon={<Filter size={14} />}
                size="md"
                className="w-full sm:w-auto"
              />

              <button
                onClick={() => alert('Exporting items...')}
                className="p-2.5 text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                title="Export CSV"
              >
                <Download size={16} />
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[950px]">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="py-3.5 px-4 sm:px-6">Item</th>
                  <th className="py-3.5 px-4">Code</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Price</th>
                  <th className="py-3.5 px-4">Unit</th>
                  <th className="py-3.5 px-4">Manufacturing Unit</th>
                  <th className="py-3.5 px-4">Packing Unit</th>
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
                        <span>Loading items...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2 py-4">
                        <Package size={32} className="text-slate-300" />
                        <p className="font-semibold text-slate-600">No items found</p>
                        <p className="text-xs text-slate-400">Click &quot;+ Add Item&quot; above to create a new item.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 sm:px-6">
                        <div className="flex items-center gap-3">
                          {/* Item Thumbnail: Uses /logo.png as default if no image uploaded */}
                          <div className="relative w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
                            <Image
                              src={item.imageUrl || '/logo.png'}
                              alt={item.name}
                              fill
                              className="object-contain p-1"
                            />
                          </div>
                          <span className="font-bold text-slate-900">{item.name}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-indigo-600">{item.code}</td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-semibold text-[11px]">
                          {item.category}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-extrabold text-slate-900">₹ {item.price}</td>
                      <td className="py-3.5 px-4 text-slate-600 font-semibold">{item.unit}</td>
                      <td className="py-3.5 px-4 text-slate-600">{item.manufacturingUnitName || 'N/A'}</td>
                      <td className="py-3.5 px-4 text-slate-600">{item.packingUnitName || 'N/A'}</td>
                      <td className="py-3.5 px-4">
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
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setViewItem(item)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                            title="View Item"
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            onClick={() => {
                              setEditingItem(item);
                              setEditItemForm({
                                name: item.name,
                                price: item.price.toString(),
                                category: item.category,
                                unit: item.unit,
                                manufacturingUnitName: item.manufacturingUnitName || '',
                                packingUnitName: item.packingUnitName || '',
                                imageUrl: item.imageUrl || '',
                                status: item.status,
                              });
                            }}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                            title="Edit Item"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => setDeletingItem(item)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete Item"
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
          <div className="p-4 sm:p-5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <p>Showing {filteredItems.length} of {items.length} items</p>
            <CustomSelect options={[{ value: '10', label: '10 / page' }]} value={itemsPerPage} onChange={setItemsPerPage} size="sm" />
          </div>
        </div>
      )}

      {/* ── 4. Tab Content 2: Categories ──────────────────────────── */}
      {activeTab === 'categories' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs hover:shadow-md transition-all flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-2xl flex items-center justify-center flex-shrink-0 shadow-2xs">
                  {cat.icon}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-900 truncate">{cat.name}</h3>
                  <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full inline-block mt-1">
                    {cat.status}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setDeletingCategory(cat)}
                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer flex-shrink-0"
                title="Delete Category"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── 5. Add Item Modal ──────────────────────────────────────── */}
      {isAddItemModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Add New Item</h3>
              <button onClick={() => setIsAddItemModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddItem} className="space-y-3.5">
              {/* Image Upload (<60KB + ImageKit on Save) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Item Image (Optional - Auto Compressed &lt;60KB)
                </label>
                <div className="flex items-center gap-3">
                  <div className="relative w-14 h-14 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                    <Image
                      src={newItem.imageUrl || '/logo.png'}
                      alt="Preview"
                      fill
                      className="object-contain p-1"
                    />
                  </div>
                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageSelect(e, false)}
                      className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100 cursor-pointer"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Image compresses to &lt;60KB and uploads to ImageKit when you click Save.</p>
                  </div>
                </div>
              </div>

              {/* Item Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Item Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Special Mysore Pak"
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Price & Unit */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Price (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="450.00"
                    value={newItem.price}
                    onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Unit *</label>
                  <CustomSelect
                    options={unitOptions}
                    value={newItem.unit}
                    onChange={(val) => setNewItem({ ...newItem, unit: val as any })}
                    className="w-full"
                    buttonClassName="w-full"
                  />
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Category *</label>
                <CustomSelect
                  options={categoryOptions.length > 0 ? categoryOptions : [{ value: 'Sweets', label: '🍰 Sweets' }]}
                  value={newItem.category || (categories[0]?.name || 'Sweets')}
                  onChange={(val) => setNewItem({ ...newItem, category: val })}
                  className="w-full"
                  buttonClassName="w-full"
                />
              </div>

              {/* Manufacturing Unit & Packing Unit Dropdowns */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Manufacturing Unit</label>
                  <CustomSelect
                    options={mfgUnitOptions}
                    value={newItem.manufacturingUnitName || (mfgUnits[0]?.name || 'Main Factory')}
                    onChange={(val) => setNewItem({ ...newItem, manufacturingUnitName: val })}
                    className="w-full"
                    buttonClassName="w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Packing Unit</label>
                  <CustomSelect
                    options={pckUnitOptions}
                    value={newItem.packingUnitName || (pckUnits[0]?.name || 'Central Packing Unit')}
                    onChange={(val) => setNewItem({ ...newItem, packingUnitName: val })}
                    className="w-full"
                    buttonClassName="w-full"
                  />
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                <CustomSelect
                  options={statusModalOptions}
                  value={newItem.status}
                  onChange={(val) => setNewItem({ ...newItem, status: val as any })}
                  className="w-full"
                  buttonClassName="w-full"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddItemModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || isCompressing}
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

      {/* ── 5.1 Edit Item Modal ─────────────────────────────────────── */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
                  <Pencil size={16} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Edit Item</h3>
                  <p className="text-xs text-slate-400 font-mono">{editingItem.code}</p>
                </div>
              </div>
              <button onClick={() => setEditingItem(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateItem} className="space-y-3.5">
              {/* Image Upload (<60KB + ImageKit on Save) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Item Image (Optional - Auto Compressed &lt;60KB)
                </label>
                <div className="flex items-center gap-3">
                  <div className="relative w-14 h-14 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                    <Image
                      src={editItemForm.imageUrl || '/logo.png'}
                      alt="Preview"
                      fill
                      className="object-contain p-1"
                    />
                  </div>
                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageSelect(e, true)}
                      className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100 cursor-pointer"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Image compresses to &lt;60KB and uploads to ImageKit when you click Save.</p>
                  </div>
                </div>
              </div>

              {/* Item Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Item Name *</label>
                <input
                  type="text"
                  required
                  value={editItemForm.name}
                  onChange={(e) => setEditItemForm({ ...editItemForm, name: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Price & Unit */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Price (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editItemForm.price}
                    onChange={(e) => setEditItemForm({ ...editItemForm, price: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Unit *</label>
                  <CustomSelect
                    options={unitOptions}
                    value={editItemForm.unit}
                    onChange={(val) => setEditItemForm({ ...editItemForm, unit: val as any })}
                    className="w-full"
                    buttonClassName="w-full"
                  />
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Category *</label>
                <CustomSelect
                  options={categoryOptions.length > 0 ? categoryOptions : [{ value: 'Sweets', label: '🍰 Sweets' }]}
                  value={editItemForm.category}
                  onChange={(val) => setEditItemForm({ ...editItemForm, category: val })}
                  className="w-full"
                  buttonClassName="w-full"
                />
              </div>

              {/* Manufacturing Unit & Packing Unit Dropdowns */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Manufacturing Unit</label>
                  <CustomSelect
                    options={mfgUnitOptions}
                    value={editItemForm.manufacturingUnitName || (mfgUnits[0]?.name || 'Main Factory')}
                    onChange={(val) => setEditItemForm({ ...editItemForm, manufacturingUnitName: val })}
                    className="w-full"
                    buttonClassName="w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Packing Unit</label>
                  <CustomSelect
                    options={pckUnitOptions}
                    value={editItemForm.packingUnitName || (pckUnits[0]?.name || 'Central Packing Unit')}
                    onChange={(val) => setEditItemForm({ ...editItemForm, packingUnitName: val })}
                    className="w-full"
                    buttonClassName="w-full"
                  />
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                <CustomSelect
                  options={statusModalOptions}
                  value={editItemForm.status}
                  onChange={(val) => setEditItemForm({ ...editItemForm, status: val as any })}
                  className="w-full"
                  buttonClassName="w-full"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || isCompressing}
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

      {/* ── 6. Bulk Upload Modal ─────────────────────────────────────── */}
      {isBulkUploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <FileSpreadsheet size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Bulk Upload Items</h3>
                  <p className="text-xs text-slate-400">Import multiple items instantly via Excel or CSV</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsBulkUploadModalOpen(false);
                  setBulkParsedItems([]);
                  setBulkFileName('');
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Template Download Option */}
            <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-indigo-900">Need the correct Excel format?</p>
                <p className="text-[11px] text-indigo-600 mt-0.5">Download our pre-formatted sample Excel file with example data.</p>
              </div>
              <button
                onClick={handleDownloadSampleExcel}
                className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer flex-shrink-0"
              >
                <FileDown size={14} />
                <span>Download Sample Template</span>
              </button>
            </div>

            {/* File Chooser */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Upload Spreadsheet (.xlsx, .xls, .csv)</label>
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleExcelFileSelect}
                className="block w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
              />
            </div>

            {/* Parsed Preview Table */}
            {bulkParsedItems.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span>Parsed Items Preview ({bulkParsedItems.length})</span>
                  <span className="text-slate-400 text-[11px]">{bulkFileName}</span>
                </div>
                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600">
                      <tr>
                        <th className="py-2 px-3">Item Name</th>
                        <th className="py-2 px-3">Price</th>
                        <th className="py-2 px-3">Category</th>
                        <th className="py-2 px-3">Unit</th>
                        <th className="py-2 px-3">Manufacturing Unit</th>
                        <th className="py-2 px-3">Packing Unit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {bulkParsedItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-semibold text-slate-900">{item.name}</td>
                          <td className="py-2 px-3 font-bold text-indigo-600">₹ {item.price}</td>
                          <td className="py-2 px-3 text-slate-600">{item.category}</td>
                          <td className="py-2 px-3 text-slate-600">{item.unit}</td>
                          <td className="py-2 px-3 text-slate-500">{item.manufacturingUnitName}</td>
                          <td className="py-2 px-3 text-slate-500">{item.packingUnitName}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setIsBulkUploadModalOpen(false);
                  setBulkParsedItems([]);
                  setBulkFileName('');
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveBulkItems}
                disabled={isSubmitting || bulkParsedItems.length === 0}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs disabled:opacity-50"
              >
                {isSubmitting && <Loader2 size={14} className="animate-spin" />}
                <span>Save Items ({bulkParsedItems.length})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 7. Add Category Modal ───────────────────────────────────── */}
      {isAddCategoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Add Category</h3>
              <button onClick={() => setIsAddCategoryModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddCategory} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Category Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dry Fruits"
                  value={newCategory.name}
                  onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Category Icon</label>
                <div className="flex items-center gap-2 flex-wrap pt-1">
                  {categoryIconOptions.map((icon) => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => setNewCategory({ ...newCategory, icon })}
                      className={`w-9 h-9 rounded-xl text-lg flex items-center justify-center transition-all ${
                        newCategory.icon === icon
                          ? 'bg-indigo-600 text-white ring-2 ring-indigo-600/30'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddCategoryModalOpen(false)}
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

      {/* ── 8. Custom Delete Modal for Item ────────────────────────── */}
      {deletingItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-full bg-red-50 text-red-500 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Item</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Are you sure you want to delete <strong>{deletingItem.name}</strong> ({deletingItem.code})? This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button onClick={() => setDeletingItem(null)} className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50">
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteItem}
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

      {/* ── 9. Custom Delete Modal for Category ────────────────────── */}
      {deletingCategory && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-full bg-red-50 text-red-500 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Category</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Are you sure you want to delete category <strong>{deletingCategory.name}</strong>? This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button onClick={() => setDeletingCategory(null)} className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50">
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteCategory}
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

      {/* ── 10. View Item Details Modal ────────────────────────────── */}
      {viewItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-600 border border-indigo-100 font-mono">
                  {viewItem.code}
                </span>
                <h3 className="text-base font-bold text-slate-900">{viewItem.name}</h3>
              </div>
              <button
                onClick={() => setViewItem(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex items-center justify-center p-2 bg-slate-50 rounded-xl border border-slate-100">
              <div className="relative w-24 h-24 rounded-lg overflow-hidden">
                <Image
                  src={viewItem.imageUrl || '/logo.png'}
                  alt={viewItem.name}
                  fill
                  className="object-contain"
                />
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-600">
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-400">Price:</span>
                <span className="font-extrabold text-slate-900">₹ {viewItem.price} / {viewItem.unit}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-400">Category:</span>
                <span className="font-semibold text-slate-800">{viewItem.category}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-400">Manufacturing Unit:</span>
                <span className="font-semibold text-slate-800">{viewItem.manufacturingUnitName || 'N/A'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-400">Packing Unit:</span>
                <span className="font-semibold text-slate-800">{viewItem.packingUnitName || 'N/A'}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Status:</span>
                <span className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${
                  viewItem.status === 'Active' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
                }`}>
                  {viewItem.status}
                </span>
              </div>
            </div>

            <div className="pt-3 flex justify-end">
              <button
                onClick={() => setViewItem(null)}
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

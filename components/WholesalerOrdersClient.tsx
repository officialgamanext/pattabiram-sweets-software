'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Users,
  Plus,
  Search,
  Filter,
  Eye,
  CheckCircle2,
  Clock,
  Package,
  X,
  Loader2,
  RefreshCw,
  Tag,
  DollarSign,
  Building2,
  FileText,
  Factory,
  CheckSquare,
  Square,
  Flame,
  Check,
  ArrowRight,
  Pencil,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import Pagination from '@/components/Pagination';
import CustomDatePicker from '@/components/CustomDatePicker';
import { db } from '@/lib/firebase';
import { toast } from '@/context/ToastContext';
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import type { ItemRecord } from './ItemsClient';

export interface WholesalerItem {
  id: string;
  code?: string;
  name?: string;
  personalMobile?: string;
  businessMobile?: string;
  mobile?: string;
  businessName?: string;
  companyName?: string;
  priceListId?: string;
  priceListName?: string;
  status?: string;
}

export interface PriceListRecord {
  id: string;
  name: string;
  items: Array<{
    itemId: string;
    itemName: string;
    customPrice: number;
  }>;
}

export interface WholesalerOrderLineItem {
  itemId: string;
  name: string;
  itemName?: string;
  unit: string;
  standardPrice: number;
  assignedPrice: number;
  quantity: number;
  totalAmount: number;
  needsManufacturing?: boolean;
  mfgStatus?: 'Pending' | 'Manufacturing Started' | 'Moved to Packing' | 'Not Required';
  pckStatus?: 'Pending' | 'Packing Started' | 'Moved to Store';
}

export interface WholesalerOrderRecord {
  id: string;
  orderId: string;
  wholesalerId: string;
  wholesalerName: string;
  wholesalerMobile: string;
  priceListName: string;
  orderDate?: string;
  manufacturingDate?: string;
  expectedDeliveryDate?: string;
  items: WholesalerOrderLineItem[];
  subtotal: number;
  tax: number;
  totalAmount: number;
  orderType: string;
  orderStatus?: string;
  status: 'Pending' | 'Approved' | 'Processing' | 'Delivered' | 'Cancelled';
  createdAt?: any;
}

const getTodayDateStr = () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export default function WholesalerOrdersClient() {
  const [orders, setOrders] = useState<WholesalerOrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [wholesalers, setWholesalers] = useState<WholesalerItem[]>([]);
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [priceLists, setPriceLists] = useState<PriceListRecord[]>([]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('All');
  
  // Add Order Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [orderDate, setOrderDate] = useState<string>(getTodayDateStr());
  const [selectedWholesaler, setSelectedWholesaler] = useState<WholesalerItem | null>(null);
  const [orderItems, setOrderItems] = useState<WholesalerOrderLineItem[]>([]);
  const [isSavingOrder, setIsSavingOrder] = useState(false);

  // View Order Modal State
  const [viewingOrder, setViewingOrder] = useState<WholesalerOrderRecord | null>(null);

  // Edit Order Modal State
  const [editingOrder, setEditingOrder] = useState<WholesalerOrderRecord | null>(null);
  const [editOrderDate, setEditOrderDate] = useState<string>(getTodayDateStr());
  const [editWholesaler, setEditWholesaler] = useState<WholesalerItem | null>(null);
  const [editOrderItems, setEditOrderItems] = useState<WholesalerOrderLineItem[]>([]);
  const [isUpdatingOrder, setIsUpdatingOrder] = useState(false);

  // Delete Order State
  const [deletingOrder, setDeletingOrder] = useState<WholesalerOrderRecord | null>(null);
  const [isDeletingOrder, setIsDeletingOrder] = useState(false);

  // Move to Manufacturing Modal State
  const [mfgModalOrder, setMfgModalOrder] = useState<WholesalerOrderRecord | null>(null);
  const [mfgItemSelections, setMfgItemSelections] = useState<{ [itemId: string]: boolean }>({});
  const [isUpdatingMfg, setIsUpdatingMfg] = useState(false);

  // Load Wholesalers, Price Lists, Products & B2B Orders from Firestore
  useEffect(() => {
    // 1. Wholesalers
    const unsubWholesalers = onSnapshot(
      collection(db, 'wholesalers'),
      (snapshot) => {
        const docs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as WholesalerItem[];
        setWholesalers(docs);
      },
      () => {}
    );

    // 2. Items
    const unsubItems = onSnapshot(
      collection(db, 'items'),
      (snapshot) => {
        const docs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as ItemRecord[];
        setItems(docs.filter((i) => i.status !== 'Inactive'));
      },
      () => {}
    );

    // 3. Price Lists
    const unsubPriceLists = onSnapshot(
      collection(db, 'price_lists'),
      (snapshot) => {
        const docs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as PriceListRecord[];
        setPriceLists(docs);
      },
      () => {}
    );

    // 4. B2B Orders
    const unsubOrders = onSnapshot(
      collection(db, 'orders'),
      (snapshot) => {
        const docs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as WholesalerOrderRecord[];
        const b2bOnly = docs.filter(
          (o) => o.orderType === 'Wholesaler B2B' || o.wholesalerId
        );
        setOrders(b2bOnly);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching wholesaler orders:', error);
        setLoading(false);
      }
    );

    return () => {
      unsubWholesalers();
      unsubItems();
      unsubPriceLists();
      unsubOrders();
    };
  }, []);

  // When a Wholesaler is selected in the Add Order Modal, compute their assigned price list
  const activeWholesalerPriceMap = useMemo(() => {
    if (!selectedWholesaler) return new Map<string, number>();

    const map = new Map<string, number>();
    
    // Find price list assigned to this wholesaler
    const assignedList = priceLists.find(
      (pl) =>
        pl.id === selectedWholesaler.priceListId ||
        pl.name === selectedWholesaler.priceListName
    );

    if (assignedList && assignedList.items) {
      assignedList.items.forEach((item) => {
        if (item.itemId && item.customPrice > 0) {
          map.set(item.itemId, item.customPrice);
        }
      });
    }

    return map;
  }, [selectedWholesaler, priceLists]);

  // Handle Wholesaler Selection change in Add Modal
  const handleSelectWholesaler = (wholesalerId: string) => {
    const ws = wholesalers.find((w) => w.id === wholesalerId) || null;
    setSelectedWholesaler(ws);

    // Initialize line items with assigned price list values!
    if (ws) {
      const assignedList = priceLists.find(
        (pl) => pl.id === ws.priceListId || pl.name === ws.priceListName
      );
      const priceMap = new Map<string, number>();
      if (assignedList && assignedList.items) {
        assignedList.items.forEach((item) => {
          if (item.itemId && item.customPrice > 0) {
            priceMap.set(item.itemId, item.customPrice);
          }
        });
      }

      const initialLines: WholesalerOrderLineItem[] = items.map((item) => {
        const customRate = priceMap.get(item.id) || item.price;
        return {
          itemId: item.id,
          name: item.name,
          itemName: item.name,
          unit: item.unit,
          standardPrice: item.price,
          assignedPrice: customRate,
          quantity: 0,
          totalAmount: 0,
          needsManufacturing: true,
          mfgStatus: 'Pending',
          pckStatus: 'Pending',
        };
      });
      setOrderItems(initialLines);
    } else {
      setOrderItems([]);
    }
  };

  // Quantity Change Handler in Order Modal
  const handleQuantityChange = (itemId: string, qty: number) => {
    setOrderItems((prev) =>
      prev.map((line) => {
        if (line.itemId === itemId) {
          const newQty = Math.max(0, qty);
          return {
            ...line,
            quantity: newQty,
            totalAmount: Math.round(line.assignedPrice * newQty),
          };
        }
        return line;
      })
    );
  };

  // Toggle manufacturing flag for a single line in Add Order Modal
  const handleToggleAddMfg = (itemId: string) => {
    setOrderItems((prev) =>
      prev.map((line) => {
        if (line.itemId === itemId) {
          return {
            ...line,
            needsManufacturing: line.needsManufacturing === false,
          };
        }
        return line;
      })
    );
  };

  // Modal Order Summary Calculation
  const modalSubtotal = useMemo(() => {
    return orderItems.reduce((sum, item) => sum + item.totalAmount, 0);
  }, [orderItems]);

  const modalTax = 0; // Prices are inclusive of GST

  const modalTotal = useMemo(() => {
    return modalSubtotal;
  }, [modalSubtotal]);

  // Submit Order Handler
  const handleSaveOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWholesaler) {
      toast.warning('Wholesaler Required', 'Please select a wholesaler.');
      return;
    }

    const selectedLines = orderItems.filter((i) => i.quantity > 0);
    if (selectedLines.length === 0) {
      toast.warning('Items Required', 'Please add at least one item quantity to the order.');
      return;
    }

    setIsSavingOrder(true);
    const newOrderId = `WSO-${Date.now().toString().slice(-6)}`;

    const wholesalerMobile =
      selectedWholesaler.personalMobile ||
      selectedWholesaler.businessMobile ||
      selectedWholesaler.mobile ||
      '';
    const wholesalerName =
      selectedWholesaler.name || selectedWholesaler.businessName || 'Wholesaler';
    const companyName =
      selectedWholesaler.businessName || selectedWholesaler.companyName || '';
    const priceListName = selectedWholesaler.priceListName || 'Standard';

    try {
      const hasMfgItems = selectedLines.some((l) => l.needsManufacturing !== false);

      await addDoc(collection(db, 'orders'), {
        orderId: newOrderId,
        orderDate: orderDate || getTodayDateStr(),
        manufacturingDate: orderDate || getTodayDateStr(),
        expectedDeliveryDate: orderDate || getTodayDateStr(),
        wholesalerId: selectedWholesaler.id || '',
        wholesalerName: wholesalerName,
        wholesalerMobile: wholesalerMobile,
        companyName: companyName,
        priceListName: priceListName,
        customerName: wholesalerName,
        customerMobile: wholesalerMobile,
        items: selectedLines.map((line) => ({
          itemId: line.itemId || '',
          name: line.name || '',
          itemName: line.name || '',
          unit: line.unit || 'Kg',
          standardPrice: Number(line.standardPrice) || 0,
          assignedPrice: Number(line.assignedPrice) || 0,
          quantity: Number(line.quantity) || 0,
          totalAmount: Number(line.totalAmount) || 0,
          needsManufacturing: line.needsManufacturing !== false,
          mfgStatus: line.needsManufacturing === false ? 'Not Required' : 'Pending',
          pckStatus: 'Pending',
        })),
        subtotal: Number(modalSubtotal) || 0,
        tax: Number(modalTax) || 0,
        totalAmount: Number(modalTotal) || 0,
        orderType: 'Wholesaler B2B',
        orderStatus: hasMfgItems ? 'Moved to Manufacturing' : 'Order Created',
        status: hasMfgItems ? 'Approved' : 'Pending',
        createdAt: serverTimestamp(),
      });

      setIsAddModalOpen(false);
      setSelectedWholesaler(null);
      setOrderDate(getTodayDateStr());
      setOrderItems([]);
      toast.success(
        'Order Created',
        hasMfgItems
          ? `Wholesaler Order ${newOrderId} created and sent to Manufacturing Portal!`
          : `Wholesaler Order ${newOrderId} created successfully.`
      );
    } catch (err: any) {
      console.error('Error saving wholesaler order:', err);
      toast.error('Order Failed', err?.message || 'Failed to save order. Please try again.');
    } finally {
      setIsSavingOrder(false);
    }
  };

  // Update Status Handler
  const handleUpdateStatus = async (orderId: string, newStatus: WholesalerOrderRecord['status']) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: newStatus,
      });
    } catch (err) {
      console.error('Error updating order status:', err);
    }
  };

  // Open Manufacturing Selection Modal for an order from the list
  const handleOpenMfgModal = (order: WholesalerOrderRecord) => {
    setMfgModalOrder(order);
    const initialMap: { [itemId: string]: boolean } = {};
    (order.items || []).forEach((it) => {
      const isSelected = it.needsManufacturing !== false && it.mfgStatus !== 'Not Required';
      initialMap[it.itemId || it.name] = isSelected;
    });
    setMfgItemSelections(initialMap);
  };

  // Toggle individual item in Mfg Modal
  const handleToggleMfgSelection = (itemId: string) => {
    setMfgItemSelections((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  // Select all / Deselect all in Mfg Modal
  const handleSetAllMfg = (selectAll: boolean) => {
    if (!mfgModalOrder) return;
    const next: { [itemId: string]: boolean } = {};
    (mfgModalOrder.items || []).forEach((it) => {
      next[it.itemId || it.name] = selectAll;
    });
    setMfgItemSelections(next);
  };

  // Save updated Manufacturing selection from Modal to Firestore
  const handleSaveMfgSelection = async () => {
    if (!mfgModalOrder) return;
    try {
      setIsUpdatingMfg(true);
      const updatedItems = (mfgModalOrder.items || []).map((it) => {
        const key = it.itemId || it.name;
        const isSelected = Boolean(mfgItemSelections[key]);
        return {
          ...it,
          name: it.name || it.itemName || '',
          itemName: it.itemName || it.name || '',
          needsManufacturing: isSelected,
          mfgStatus: isSelected
            ? (it.mfgStatus === 'Moved to Packing'
                ? 'Moved to Packing'
                : it.mfgStatus === 'Manufacturing Started'
                ? 'Manufacturing Started'
                : 'Pending')
            : 'Not Required',
          pckStatus: it.pckStatus || 'Pending',
        };
      });

      const hasMfgItems = updatedItems.some((it) => it.needsManufacturing);

      await updateDoc(doc(db, 'orders', mfgModalOrder.id), {
        items: updatedItems,
        orderStatus: hasMfgItems ? 'Moved to Manufacturing' : 'Order Created',
        status: hasMfgItems && mfgModalOrder.status === 'Pending' ? 'Approved' : mfgModalOrder.status,
        updatedAt: serverTimestamp(),
      });

      toast.success(
        'Manufacturing Updated',
        hasMfgItems
          ? `Order ${mfgModalOrder.orderId} items updated in Manufacturing Portal!`
          : `Order ${mfgModalOrder.orderId} items marked as Ready in Stock (Excluded from Mfg).`
      );
      setMfgModalOrder(null);
    } catch (err: any) {
      console.error('Failed to update manufacturing items:', err);
      toast.error('Update Failed', err?.message || 'Failed to update manufacturing queue.');
    } finally {
      setIsUpdatingMfg(false);
    }
  };

  // ── Edit Order Handlers & Calculations ───────────────────────────────────────
  const editModalSubtotal = useMemo(() => {
    return editOrderItems.reduce((sum, item) => sum + item.totalAmount, 0);
  }, [editOrderItems]);

  const editModalTax = 0; // Prices are inclusive of GST

  const editModalTotal = useMemo(() => {
    return editModalSubtotal;
  }, [editModalSubtotal]);

  // Open Edit Order Modal
  const handleOpenEditOrder = (order: WholesalerOrderRecord) => {
    setEditingOrder(order);
    const ordDate =
      order.orderDate ||
      (order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString('en-CA') : getTodayDateStr());
    setEditOrderDate(ordDate);

    const ws = wholesalers.find((w) => w.id === order.wholesalerId) || null;
    setEditWholesaler(ws);

    // Compute price map for assigned price list
    const assignedList = ws
      ? priceLists.find((pl) => pl.id === ws.priceListId || pl.name === ws.priceListName)
      : priceLists.find((pl) => pl.name === order.priceListName);

    const priceMap = new Map<string, number>();
    if (assignedList && assignedList.items) {
      assignedList.items.forEach((item) => {
        if (item.itemId && item.customPrice > 0) {
          priceMap.set(item.itemId, item.customPrice);
        }
      });
    }

    // Build line items map from existing order
    const existingMap = new Map<string, WholesalerOrderLineItem>();
    (order.items || []).forEach((it) => {
      existingMap.set(it.itemId || it.name, it);
    });

    const lines: WholesalerOrderLineItem[] = items.map((item) => {
      const existing = existingMap.get(item.id) || existingMap.get(item.name);
      const customRate = existing?.assignedPrice || priceMap.get(item.id) || item.price;
      const qty = existing?.quantity || 0;
      const needsMfg = existing
        ? existing.needsManufacturing !== false && existing.mfgStatus !== 'Not Required'
        : true;

      return {
        itemId: item.id,
        name: item.name,
        itemName: item.name,
        unit: item.unit,
        standardPrice: item.price,
        assignedPrice: customRate,
        quantity: qty,
        totalAmount: Math.round(customRate * qty),
        needsManufacturing: needsMfg,
        mfgStatus: existing?.mfgStatus || (needsMfg ? 'Pending' : 'Not Required'),
        pckStatus: existing?.pckStatus || 'Pending',
      };
    });

    setEditOrderItems(lines);
  };

  // Quantity Change Handler in Edit Modal
  const handleEditQuantityChange = (itemId: string, qty: number) => {
    setEditOrderItems((prev) =>
      prev.map((line) => {
        if (line.itemId === itemId) {
          const newQty = Math.max(0, qty);
          return {
            ...line,
            quantity: newQty,
            totalAmount: Math.round(line.assignedPrice * newQty),
          };
        }
        return line;
      })
    );
  };

  // Toggle Mfg in Edit Modal
  const handleToggleEditMfg = (itemId: string) => {
    setEditOrderItems((prev) =>
      prev.map((line) => {
        if (line.itemId === itemId) {
          return {
            ...line,
            needsManufacturing: line.needsManufacturing === false,
          };
        }
        return line;
      })
    );
  };

  // Save Edit Order
  const handleSaveEditOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder) return;

    const selectedLines = editOrderItems.filter((i) => i.quantity > 0);
    if (selectedLines.length === 0) {
      toast.warning('Items Required', 'Please add at least one item quantity to the order.');
      return;
    }

    try {
      setIsUpdatingOrder(true);
      const hasMfgItems = selectedLines.some((l) => l.needsManufacturing !== false);

      await updateDoc(doc(db, 'orders', editingOrder.id), {
        orderDate: editOrderDate || getTodayDateStr(),
        manufacturingDate: editOrderDate || getTodayDateStr(),
        expectedDeliveryDate: editOrderDate || getTodayDateStr(),
        items: selectedLines.map((line) => ({
          itemId: line.itemId || '',
          name: line.name || '',
          itemName: line.name || '',
          unit: line.unit || 'Kg',
          standardPrice: Number(line.standardPrice) || 0,
          assignedPrice: Number(line.assignedPrice) || 0,
          quantity: Number(line.quantity) || 0,
          totalAmount: Number(line.totalAmount) || 0,
          needsManufacturing: line.needsManufacturing !== false,
          mfgStatus:
            line.needsManufacturing === false
              ? 'Not Required'
              : line.mfgStatus === 'Moved to Packing'
              ? 'Moved to Packing'
              : line.mfgStatus || 'Pending',
          pckStatus: line.pckStatus || 'Pending',
        })),
        subtotal: Number(editModalSubtotal) || 0,
        tax: Number(editModalTax) || 0,
        totalAmount: Number(editModalTotal) || 0,
        orderStatus: hasMfgItems
          ? editingOrder.orderStatus === 'Moved to Manufacturing' || editingOrder.orderStatus === 'Order Created'
            ? 'Moved to Manufacturing'
            : editingOrder.orderStatus
          : 'Order Created',
        updatedAt: serverTimestamp(),
      });

      toast.success('Order Updated', `Wholesaler Order ${editingOrder.orderId} updated successfully!`);
      setEditingOrder(null);
    } catch (err: any) {
      console.error('Failed to update wholesaler order:', err);
      toast.error('Update Failed', err?.message || 'Failed to update order. Please try again.');
    } finally {
      setIsUpdatingOrder(false);
    }
  };

  // Delete Order Confirmation Handler
  const handleConfirmDeleteOrder = async () => {
    if (!deletingOrder) return;
    try {
      setIsDeletingOrder(true);
      await deleteDoc(doc(db, 'orders', deletingOrder.id));
      toast.success('Order Deleted', `Wholesaler Order ${deletingOrder.orderId} deleted successfully.`);
      setDeletingOrder(null);
    } catch (err: any) {
      console.error('Failed to delete order:', err);
      toast.error('Delete Failed', err?.message || 'Failed to delete order.');
    } finally {
      setIsDeletingOrder(false);
    }
  };

  // Filtered Orders List
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchQuery =
        order.orderId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.wholesalerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.wholesalerMobile?.includes(searchQuery);
      const matchStatus = selectedStatusFilter === 'All' || order.status === selectedStatusFilter;
      return matchQuery && matchStatus;
    });
  }, [orders, searchQuery, selectedStatusFilter]);

  const [currentPage, setCurrentPage] = useState(1);

  const paginatedOrders = useMemo(() => {
    return filteredOrders.slice((currentPage - 1) * 45, currentPage * 45);
  }, [filteredOrders, currentPage]);

  return (
    <div className="w-full flex flex-col gap-4 text-slate-800 font-sans pb-12">
      {/* ── Page Header Title Bar ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2">
          <Users size={22} className="text-slate-800 stroke-[1.75]" />
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Wholesaler B2B Orders</h1>
        </div>

        <button
          onClick={() => {
            setIsAddModalOpen(true);
            setOrderDate(getTodayDateStr());
            setSelectedWholesaler(null);
            setOrderItems([]);
          }}
          className="h-8 px-3 text-xs font-semibold rounded-lg bg-[#02626D] hover:bg-[#014d56] text-white shadow-2xs inline-flex items-center gap-1.5 cursor-pointer transition-colors"
        >
          <Plus size={14} />
          <span>Add Wholesaler Order</span>
        </button>
      </div>

      {/* ── Toolbar: Search & Status Filters ──────────────────────────────────── */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Order #, Wholesaler or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 h-8 bg-[#f7f7f8] focus:bg-white text-xs rounded-lg border border-slate-300 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-500 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <span className="text-xs text-slate-500 font-semibold">Status:</span>
          <div className="flex bg-[#f1f2f4] p-0.5 rounded-lg border border-slate-200">
            {(['All', 'Pending', 'Approved', 'Processing', 'Delivered'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setSelectedStatusFilter(st)}
                className={`h-7 px-3 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  selectedStatusFilter === st
                    ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── B2B Wholesaler Orders Table ───────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-slate-500" />
            Loading B2B Orders...
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">No wholesaler B2B orders found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[950px]">
              <thead>
                <tr className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider bg-[#f7f7f8] border-b border-slate-200">
                  <th className="py-3 px-4">Order ID</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Wholesaler Details</th>
                  <th className="py-3 px-4">Assigned Price List</th>
                  <th className="py-3 px-4">Items Count</th>
                  <th className="py-3 px-4">Manufacturing Queue</th>
                  <th className="py-3 px-4">Total Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {paginatedOrders.map((order) => {
                  const totalItemsCount = order.items?.length || 0;
                  const mfgItemsCount =
                    order.items?.filter(
                      (i) => i.needsManufacturing !== false && i.mfgStatus !== 'Not Required'
                    ).length || 0;

                  return (
                    <tr key={order.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-slate-900">{order.orderId}</span>
                      </td>

                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap font-medium">
                        {order.orderDate ||
                          (order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString('en-CA') : '—')}
                      </td>

                      <td className="py-3 px-4">
                        <p className="font-semibold text-slate-900">{order.wholesalerName}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{order.wholesalerMobile}</p>
                      </td>

                      <td className="py-3 px-4">
                        <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                          {order.priceListName || 'Standard Rates'}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-semibold text-slate-700">{totalItemsCount} Items</td>

                      {/* Manufacturing Status Summary Badge */}
                      <td className="py-3 px-4">
                        {mfgItemsCount > 0 ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-teal-50 text-teal-700 font-semibold text-[10px] border border-teal-200">
                            <Factory size={12} className="text-teal-600" />
                            <span>
                              {mfgItemsCount}/{totalItemsCount} in Mfg
                            </span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 font-medium text-[10px] border border-slate-200">
                            <span>Ready / In Stock</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 font-mono font-bold text-slate-900">₹{order.totalAmount}</td>

                      <td className="py-3 px-4">
                        <select
                          value={order.status || 'Pending'}
                          onChange={(e) => handleUpdateStatus(order.id, e.target.value as any)}
                          className={`text-[10px] font-bold px-2 py-1 rounded border focus:outline-none cursor-pointer ${
                            order.status === 'Delivered'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : order.status === 'Approved'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : order.status === 'Processing'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          <option value="Pending">Pending</option>
                          <option value="Approved">Approved</option>
                          <option value="Processing">Processing</option>
                          <option value="Delivered">Delivered</option>
                          <option value="Cancelled">Cancelled</option>
                        </select>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Manufacturing Items Action Button */}
                          <button
                            onClick={() => handleOpenMfgModal(order)}
                            className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors cursor-pointer"
                            title="Manufacturing Queue Selection"
                          >
                            <Factory size={15} />
                          </button>

                          {/* View Order Details Action Button */}
                          <button
                            onClick={() => setViewingOrder(order)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                            title="View Order Details"
                          >
                            <Eye size={15} />
                          </button>

                          {/* Edit Order Action Button */}
                          <button
                            onClick={() => handleOpenEditOrder(order)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="Edit Order"
                          >
                            <Pencil size={15} />
                          </button>

                          {/* Delete Order Action Button */}
                          <button
                            onClick={() => setDeletingOrder(order)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete Order"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 45 Items Per Page Pagination */}
        <Pagination
          currentPage={currentPage}
          totalItems={filteredOrders.length}
          pageSize={45}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* ── MODAL: Create New Wholesaler B2B Order ────────────────────────────── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Users size={18} className="text-indigo-600" />
                  Create Wholesaler B2B Order
                </h3>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* 1. Wholesaler Selection & Order Date */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="sm:col-span-2 space-y-2">
                  <label className="block text-xs font-bold text-slate-700">
                    Select Wholesaler <span className="text-rose-500">*</span>:
                  </label>
                  <select
                    value={selectedWholesaler?.id || ''}
                    onChange={(e) => handleSelectWholesaler(e.target.value)}
                    className="w-full h-9 px-3 bg-white text-xs rounded-lg border border-slate-300 text-slate-800 font-semibold focus:outline-none focus:border-indigo-600"
                  >
                    <option value="">-- Choose Wholesaler --</option>
                    {wholesalers.map((ws) => {
                      const phone =
                        ws.personalMobile || ws.businessMobile || ws.mobile || '';
                      const title = ws.name || ws.businessName || 'Wholesaler';
                      return (
                        <option key={ws.id} value={ws.id}>
                          {title} {phone ? `(${phone})` : ''} {ws.priceListName ? `— Assigned: ${ws.priceListName}` : ''}
                        </option>
                      );
                    })}
                  </select>

                  {selectedWholesaler && (
                    <div className="flex items-center justify-between text-xs pt-1 text-slate-600">
                      <span>Assigned Price List:</span>
                      <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                        {selectedWholesaler.priceListName || 'Standard Rates'}
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    Order Date <span className="text-rose-500">*</span>:
                  </label>
                  <CustomDatePicker
                    value={orderDate}
                    onChange={setOrderDate}
                    allowAll={false}
                    size="sm"
                  />
                </div>
              </div>

              {/* 2. Product Items Table with Assigned Rates & Mfg Toggle */}
              {selectedWholesaler ? (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold text-slate-700">
                      Itemized Order Quantities &amp; Rates:
                    </label>
                    <span className="text-[11px] text-slate-400">
                      Toggle <span className="font-bold text-teal-700">Mfg</span> on items to send directly to kitchen
                    </span>
                  </div>

                  <div className="max-h-[280px] overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                    {orderItems.map((line) => {
                      const hasQty = (line.quantity || 0) > 0;
                      const isMfg = line.needsManufacturing !== false;

                      return (
                        <div key={line.itemId} className="p-3 flex items-center justify-between gap-3 text-xs">
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-slate-900 truncate">{line.name}</p>
                            <p className="text-[11px] text-slate-500 font-mono">
                              Assigned Rate: <span className="font-bold text-slate-800">₹{line.assignedPrice}</span> / {line.unit}
                              {line.assignedPrice !== line.standardPrice && (
                                <span className="text-[10px] text-indigo-600 ml-1 font-semibold">
                                  (Custom override from standard ₹{line.standardPrice})
                                </span>
                              )}
                            </p>
                          </div>

                          {/* Move to Mfg Selector Button */}
                          <div className="flex items-center gap-2">
                            {hasQty && (
                              <button
                                type="button"
                                onClick={() => handleToggleAddMfg(line.itemId)}
                                className={`h-7 px-2.5 rounded-lg text-[10px] font-bold border flex items-center gap-1 cursor-pointer transition-colors ${
                                  isMfg
                                    ? 'bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100'
                                    : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                                }`}
                                title={isMfg ? 'Will move to Manufacturing' : 'In stock / Direct (Skip Mfg)'}
                              >
                                <Factory size={11} className={isMfg ? 'text-teal-600' : 'text-slate-400'} />
                                <span>{isMfg ? 'To Mfg' : 'In Stock'}</span>
                              </button>
                            )}

                            {/* Quantity Input */}
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              value={line.quantity || ''}
                              onChange={(e) => handleQuantityChange(line.itemId, parseFloat(e.target.value) || 0)}
                              placeholder="Qty..."
                              className="w-20 h-8 px-2 bg-[#f7f7f8] focus:bg-white text-xs font-bold font-mono rounded-lg border border-slate-300 text-center"
                            />
                            <span className="w-16 text-right font-mono font-bold text-slate-900">
                              ₹{line.totalAmount}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="p-12 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
                  Please select a Wholesaler to load their assigned custom Price List rates.
                </div>
              )}
            </div>

            {/* Modal Footer with Order Totals & Submit */}
            <div className="border-t border-slate-200 pt-3 flex items-center justify-between gap-3">
              <div className="text-xs font-mono">
                <span className="text-slate-500">Subtotal: ₹{modalSubtotal} (GST Inclusive) | </span>
                <span className="text-sm font-bold text-slate-900">Total: ₹{modalTotal}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="h-8 px-3 text-xs font-semibold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleSaveOrder}
                  disabled={isSavingOrder || !selectedWholesaler}
                  className="h-8 px-4 text-xs font-semibold rounded-lg bg-[#02626D] hover:bg-[#014d56] disabled:bg-slate-300 text-white shadow-2xs cursor-pointer flex items-center gap-1.5"
                >
                  {isSavingOrder ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  <span>Save B2B Order</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Decide & Move Items to Manufacturing ───────────────────────── */}
      {mfgModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                  <Factory size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Manufacturing Items Selection
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    Order: <strong className="text-slate-800">{mfgModalOrder.orderId}</strong> • {mfgModalOrder.wholesalerName}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setMfgModalOrder(null)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer rounded-lg hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Helper Notice & Select All Buttons */}
            <div className="bg-teal-50/70 border border-teal-100 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <span className="text-teal-800 font-medium">
                Select items that need production in kitchen. Unchecked items stay as ready/in-stock.
              </span>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => handleSetAllMfg(true)}
                  className="px-2 py-1 rounded-md bg-white border border-teal-200 text-teal-700 font-semibold text-[11px] hover:bg-teal-100/50 cursor-pointer"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={() => handleSetAllMfg(false)}
                  className="px-2 py-1 rounded-md bg-white border border-slate-200 text-slate-600 font-semibold text-[11px] hover:bg-slate-50 cursor-pointer"
                >
                  Deselect All
                </button>
              </div>
            </div>

            {/* Items Checklist Table */}
            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl">
              {mfgModalOrder.items?.map((item, idx) => {
                const key = item.itemId || item.name;
                const isSelected = Boolean(mfgItemSelections[key]);

                return (
                  <div
                    key={idx}
                    onClick={() => handleToggleMfgSelection(key)}
                    className={`p-3.5 flex items-center justify-between gap-3 text-xs transition-colors cursor-pointer ${
                      isSelected ? 'bg-teal-50/40 hover:bg-teal-50/60' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${
                        isSelected ? 'bg-teal-600 border-teal-600 text-white' : 'border-slate-300 bg-white'
                      }`}>
                        {isSelected && <Check size={13} strokeWidth={3} />}
                      </div>

                      <div>
                        <p className="font-bold text-slate-900">{item.name || item.itemName}</p>
                        <p className="text-[11px] text-slate-500 font-mono">
                          Quantity: <strong className="text-slate-800">{item.quantity} {item.unit}</strong> • Rate: ₹{item.assignedPrice || item.standardPrice}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        isSelected
                          ? 'bg-teal-100 text-teal-800 border-teal-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        {isSelected ? 'In Mfg Queue' : 'In Stock / Skip'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Actions */}
            <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-mono">
                {Object.values(mfgItemSelections).filter(Boolean).length} / {mfgModalOrder.items?.length || 0} items selected
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMfgModalOrder(null)}
                  className="h-8 px-3 text-xs font-semibold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveMfgSelection}
                  disabled={isUpdatingMfg}
                  className="h-8 px-4 text-xs font-semibold rounded-lg bg-teal-700 hover:bg-teal-800 text-white shadow-2xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isUpdatingMfg ? <Loader2 size={13} className="animate-spin" /> : <Factory size={13} />}
                  <span>Save &amp; Update Manufacturing Queue</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: View Order Details ─────────────────────────────────────────── */}
      {viewingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">{viewingOrder.orderId}</h3>
                <div className="flex items-center gap-2 text-xs text-slate-500 font-mono mt-0.5">
                  <span>Wholesaler: {viewingOrder.wholesalerName}</span>
                  {viewingOrder.orderDate && (
                    <>
                      <span>•</span>
                      <span>Date: {viewingOrder.orderDate}</span>
                    </>
                  )}
                </div>
              </div>
              <button
                onClick={() => setViewingOrder(null)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Line Items with Mfg Status */}
            <div className="divide-y divide-slate-100 text-xs max-h-60 overflow-y-auto">
              {viewingOrder.items?.map((item, idx) => {
                const inMfg = item.needsManufacturing !== false && item.mfgStatus !== 'Not Required';
                return (
                  <div key={idx} className="py-2.5 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-slate-900">{item.name || item.itemName}</p>
                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                          inMfg
                            ? 'bg-teal-50 text-teal-700 border-teal-200'
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}>
                          {inMfg ? (item.mfgStatus || 'Pending Mfg') : 'In Stock'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-mono">
                        {item.quantity} {item.unit} x ₹{item.assignedPrice || item.standardPrice}
                      </p>
                    </div>
                    <span className="font-mono font-bold text-slate-900">
                      ₹{item.totalAmount || item.quantity * (item.assignedPrice || 0)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Totals */}
            <div className="border-t border-slate-200 pt-3 text-xs space-y-1 font-mono">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>₹{viewingOrder.subtotal}</span>
              </div>
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>Tax:</span>
                <span>GST Inclusive</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-slate-900 border-t border-slate-100 pt-1">
                <span>Total Amount:</span>
                <span>₹{viewingOrder.totalAmount}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  const targetOrder = viewingOrder;
                  setViewingOrder(null);
                  handleOpenMfgModal(targetOrder);
                }}
                className="flex-1 h-8 text-xs font-semibold rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 cursor-pointer flex items-center justify-center gap-1"
              >
                <Factory size={13} />
                <span>Manage Mfg Items</span>
              </button>
              <button
                onClick={() => setViewingOrder(null)}
                className="h-8 px-4 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Edit Wholesaler B2B Order ──────────────────────────────────── */}
      {editingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Pencil size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Edit Wholesaler B2B Order
                    </h3>
                    <p className="text-xs text-slate-400 font-mono">{editingOrder.orderId}</p>
                  </div>
                </div>

                <button
                  onClick={() => setEditingOrder(null)}
                  className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer rounded-lg hover:bg-slate-100"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Wholesaler Details & Order Date */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="sm:col-span-2 space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Wholesaler:</label>
                  <p className="text-xs font-bold text-slate-900">{editingOrder.wholesalerName}</p>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
                    <span>{editingOrder.wholesalerMobile || 'No Phone'}</span>
                    <span>•</span>
                    <span className="text-indigo-700 font-semibold bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-100">
                      {editingOrder.priceListName || 'Standard Rates'}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">Order Date:</label>
                  <CustomDatePicker
                    value={editOrderDate}
                    onChange={setEditOrderDate}
                    allowAll={false}
                    size="sm"
                  />
                </div>
              </div>

              {/* Product Items Table with Assigned Rates & Mfg Toggle */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-slate-700">
                    Itemized Order Quantities &amp; Rates:
                  </label>
                  <span className="text-[11px] text-slate-400">
                    Toggle <span className="font-bold text-teal-700">Mfg</span> for kitchen production
                  </span>
                </div>

                <div className="max-h-[280px] overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                  {editOrderItems.map((line) => {
                    const hasQty = (line.quantity || 0) > 0;
                    const isMfg = line.needsManufacturing !== false;

                    return (
                      <div key={line.itemId} className="p-3 flex items-center justify-between gap-3 text-xs">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-900 truncate">{line.name}</p>
                          <p className="text-[11px] text-slate-500 font-mono">
                            Assigned Rate: <span className="font-bold text-slate-800">₹{line.assignedPrice}</span> / {line.unit}
                            {line.assignedPrice !== line.standardPrice && (
                              <span className="text-[10px] text-indigo-600 ml-1 font-semibold">
                                (Custom override from standard ₹{line.standardPrice})
                              </span>
                            )}
                          </p>
                        </div>

                        {/* Move to Mfg Selector Button */}
                        <div className="flex items-center gap-2">
                          {hasQty && (
                            <button
                              type="button"
                              onClick={() => handleToggleEditMfg(line.itemId)}
                              className={`h-7 px-2.5 rounded-lg text-[10px] font-bold border flex items-center gap-1 cursor-pointer transition-colors ${
                                isMfg
                                  ? 'bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100'
                                  : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                              }`}
                              title={isMfg ? 'Will move to Manufacturing' : 'In stock / Direct (Skip Mfg)'}
                            >
                              <Factory size={11} className={isMfg ? 'text-teal-600' : 'text-slate-400'} />
                              <span>{isMfg ? 'To Mfg' : 'In Stock'}</span>
                            </button>
                          )}

                          {/* Quantity Input */}
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={line.quantity || ''}
                            onChange={(e) => handleEditQuantityChange(line.itemId, parseFloat(e.target.value) || 0)}
                            placeholder="Qty..."
                            className="w-20 h-8 px-2 bg-[#f7f7f8] focus:bg-white text-xs font-bold font-mono rounded-lg border border-slate-300 text-center"
                          />
                          <span className="w-16 text-right font-mono font-bold text-slate-900">
                            ₹{line.totalAmount}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer with Order Totals & Submit */}
            <div className="border-t border-slate-200 pt-3 flex items-center justify-between gap-3">
              <div className="text-xs font-mono">
                <span className="text-slate-500">Subtotal: ₹{editModalSubtotal} (GST Inclusive) | </span>
                <span className="text-sm font-bold text-slate-900">Total: ₹{editModalTotal}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingOrder(null)}
                  className="h-8 px-3 text-xs font-semibold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleSaveEditOrder}
                  disabled={isUpdatingOrder}
                  className="h-8 px-4 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-2xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isUpdatingOrder ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  <span>Update B2B Order</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Delete Confirmation Modal ─────────────────────────────────── */}
      {deletingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-full bg-red-50 text-red-500 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={22} />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-slate-900">Delete Wholesaler Order</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Are you sure you want to delete order <strong className="text-slate-800">{deletingOrder.orderId}</strong> ({deletingOrder.wholesalerName}, ₹{deletingOrder.totalAmount})? This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeletingOrder(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteOrder}
                disabled={isDeletingOrder}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-700 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {isDeletingOrder ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                <span>Delete Order</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


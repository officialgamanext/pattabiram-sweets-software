'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
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
  ShoppingBag,
  Minus,
  Sparkles,
  WalletCards,
  ChevronDown,
  ChevronRight,
  Phone,
  Receipt,
  CreditCard,
  TrendingUp,
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
import { useBusinessSettings, calculateTax } from '@/lib/businessSettings';

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
  code?: string;
  category?: string;
  imageUrl?: string;
  unit: string;
  standardPrice: number;
  assignedPrice: number;
  quantity: number;
  totalAmount: number;
  needsManufacturing?: boolean;
  mfgStatus?: 'Pending' | 'Manufacturing Started' | 'Moved to Packing' | 'Not Required';
  pckStatus?: 'Pending' | 'Packing Started' | 'Moved to Store';
}

export interface PaymentEntry {
  id: string;
  amount: number;
  mode: string;
  note: string;
  paidAt: string;
}

export interface WholesalerOrderRecord {
  id: string;
  orderId: string;
  wholesalerId: string;
  wholesalerName: string;
  wholesalerMobile: string;
  companyName?: string;
  priceListName: string;
  orderDate?: string;
  manufacturingDate?: string;
  expectedDeliveryDate?: string;
  items: WholesalerOrderLineItem[];
  subtotal: number;
  tax: number;
  taxableAmount?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  cgstPercent?: number;
  sgstPercent?: number;
  taxType?: 'inclusive' | 'exclusive';
  totalAmount: number;
  receivedAmount?: number;
  paymentMode?: string;
  paymentStatus?: 'Paid' | 'Partial' | 'Pending';
  payments?: PaymentEntry[];
  orderType: string;
  orderStatus?: string;
  status: 'Pending' | 'Approved' | 'Processing' | 'Delivered' | 'Cancelled';
  createdAt?: any;
}

export interface WholesalerCreditSummary {
  key: string;
  wholesalerId: string;
  wholesalerName: string;
  companyName: string;
  wholesalerMobile: string;
  totalOrdersCount: number;
  pendingOrdersCount: number;
  totalBilled: number;
  totalPaid: number;
  outstandingBalance: number;
  latestOrderDate: string;
  orders: WholesalerOrderRecord[];
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
  const { settings: businessSettings } = useBusinessSettings();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('All');
  
  // Add Order Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [orderDate, setOrderDate] = useState<string>(getTodayDateStr());
  const [selectedWholesaler, setSelectedWholesaler] = useState<WholesalerItem | null>(null);
  const [orderItems, setOrderItems] = useState<WholesalerOrderLineItem[]>([]);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [addSearchQuery, setAddSearchQuery] = useState('');
  const [addCategoryFilter, setAddCategoryFilter] = useState('All');
  const [addShowOnlySelected, setAddShowOnlySelected] = useState(false);

  // View Order Modal State
  const [viewingOrder, setViewingOrder] = useState<WholesalerOrderRecord | null>(null);

  // Edit Order Modal State
  const [editingOrder, setEditingOrder] = useState<WholesalerOrderRecord | null>(null);
  const [editOrderDate, setEditOrderDate] = useState<string>(getTodayDateStr());
  const [editWholesaler, setEditWholesaler] = useState<WholesalerItem | null>(null);
  const [editOrderItems, setEditOrderItems] = useState<WholesalerOrderLineItem[]>([]);
  const [isUpdatingOrder, setIsUpdatingOrder] = useState(false);
  const [editSearchQuery, setEditSearchQuery] = useState('');
  const [editCategoryFilter, setEditCategoryFilter] = useState('All');
  const [editShowOnlySelected, setEditShowOnlySelected] = useState(false);

  // Delete Order State
  const [deletingOrder, setDeletingOrder] = useState<WholesalerOrderRecord | null>(null);
  const [isDeletingOrder, setIsDeletingOrder] = useState(false);

  // Move to Manufacturing Modal State
  const [mfgModalOrder, setMfgModalOrder] = useState<WholesalerOrderRecord | null>(null);
  const [mfgItemSelections, setMfgItemSelections] = useState<{ [itemId: string]: boolean }>({});
  const [isUpdatingMfg, setIsUpdatingMfg] = useState(false);

  // Main Tab State: 'orders' | 'credit'
  const [activeMainTab, setActiveMainTab] = useState<'orders' | 'credit'>('orders');

  // Manage Order Payments & Installments Modal State
  const [managingOrder, setManagingOrder] = useState<WholesalerOrderRecord | null>(null);
  const [installmentAmount, setInstallmentAmount] = useState<string>('');
  const [installmentMode, setInstallmentMode] = useState<string>('UPI');
  const [installmentDate, setInstallmentDate] = useState<string>(getTodayDateStr());
  const [installmentNote, setInstallmentNote] = useState<string>('');
  const [isSavingInstallment, setIsSavingInstallment] = useState(false);
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);

  // Credit Tab States
  const [creditSearchQuery, setCreditSearchQuery] = useState('');
  const [creditStatusFilter, setCreditStatusFilter] = useState<'All' | 'Pending' | 'Paid'>('Pending');
  const [expandedWholesalerKey, setExpandedWholesalerKey] = useState<string | null>(null);
  const [creditSortBy, setCreditSortBy] = useState<'due_desc' | 'due_asc' | 'name_asc'>('due_desc');
  const [creditViewMode, setCreditViewMode] = useState<'wholesaler' | 'orders'>('wholesaler');

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
          code: item.code,
          category: item.category,
          imageUrl: item.imageUrl,
          unit: item.unit,
          standardPrice: item.price,
          assignedPrice: customRate,
          quantity: 0,
          totalAmount: 0,
          needsManufacturing: false,
          mfgStatus: 'Not Required',
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
          const newQty = Math.max(0, Math.round(qty * 100) / 100);
          return {
            ...line,
            quantity: newQty,
            totalAmount: Math.round(line.assignedPrice * newQty * 100) / 100,
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
          const isNowMfg = !line.needsManufacturing;
          return {
            ...line,
            needsManufacturing: isNowMfg,
            mfgStatus: isNowMfg ? 'Pending' : 'Not Required',
          };
        }
        return line;
      })
    );
  };

  // All distinct item categories
  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    items.forEach((it) => {
      if (it.category) cats.add(it.category);
    });
    return ['All', ...Array.from(cats)];
  }, [items]);

  // Filtered Add Items based on Search & Category
  const filteredAddItems = useMemo(() => {
    return orderItems.filter((item) => {
      if (addShowOnlySelected && (!item.quantity || item.quantity <= 0)) {
        return false;
      }
      if (addCategoryFilter !== 'All' && item.category !== addCategoryFilter) {
        return false;
      }
      if (addSearchQuery.trim()) {
        const q = addSearchQuery.toLowerCase().trim();
        const matchName = item.name?.toLowerCase().includes(q);
        const matchCode = item.code?.toLowerCase().includes(q);
        const matchCat = item.category?.toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchCat) return false;
      }
      return true;
    });
  }, [orderItems, addShowOnlySelected, addCategoryFilter, addSearchQuery]);

  const addSelectedLines = useMemo(() => {
    return orderItems.filter((it) => (it.quantity || 0) > 0);
  }, [orderItems]);

  const addTotalWeight = useMemo(() => {
    return Math.round(addSelectedLines.reduce((acc, it) => acc + (it.quantity || 0), 0) * 100) / 100;
  }, [addSelectedLines]);

  // Modal Order Summary Calculation
  const modalSubtotal = useMemo(() => {
    return Math.round(orderItems.reduce((sum, item) => sum + item.totalAmount, 0) * 100) / 100;
  }, [orderItems]);

  const modalTaxCalc = useMemo(() => {
    return calculateTax(modalSubtotal, businessSettings);
  }, [modalSubtotal, businessSettings]);

  const modalTotal = modalTaxCalc.finalAmount;
  const modalTax = modalTaxCalc.totalTax;

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
      const hasMfgItems = selectedLines.some((l) => Boolean(l.needsManufacturing));

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
          needsManufacturing: Boolean(line.needsManufacturing),
          mfgStatus: line.needsManufacturing ? 'Pending' : 'Not Required',
          pckStatus: 'Pending',
        })),
        subtotal: modalTaxCalc.taxType === 'inclusive' ? Number(modalTaxCalc.taxableAmount) : (Number(modalSubtotal) || 0),
        tax: Number(modalTax) || 0,
        taxableAmount: modalTaxCalc.taxableAmount,
        cgstAmount: modalTaxCalc.cgstAmount,
        sgstAmount: modalTaxCalc.sgstAmount,
        cgstPercent: modalTaxCalc.cgstPercent,
        sgstPercent: modalTaxCalc.sgstPercent,
        taxType: modalTaxCalc.taxType,
        totalAmount: Number(modalTotal) || 0,
        receivedAmount: 0,
        paymentStatus: 'Pending',
        paymentMode: 'Pending',
        payments: [],
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

  const editModalTaxCalc = useMemo(() => {
    return calculateTax(editModalSubtotal, businessSettings);
  }, [editModalSubtotal, businessSettings]);

  const editModalTotal = editModalTaxCalc.finalAmount;
  const editModalTax = editModalTaxCalc.totalTax;

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
        ? existing.needsManufacturing === true && existing.mfgStatus !== 'Not Required'
        : false;

      return {
        itemId: item.id,
        name: item.name,
        itemName: item.name,
        code: item.code,
        category: item.category,
        imageUrl: item.imageUrl,
        unit: item.unit,
        standardPrice: item.price,
        assignedPrice: customRate,
        quantity: qty,
        totalAmount: Math.round(customRate * qty * 100) / 100,
        needsManufacturing: needsMfg,
        mfgStatus: existing?.mfgStatus || (needsMfg ? 'Pending' : 'Not Required'),
        pckStatus: existing?.pckStatus || 'Pending',
      };
    });

    setEditOrderItems(lines);
    setEditSearchQuery('');
    setEditCategoryFilter('All');
    setEditShowOnlySelected(false);
  };

  // Quantity Change Handler in Edit Modal
  const handleEditQuantityChange = (itemId: string, qty: number) => {
    setEditOrderItems((prev) =>
      prev.map((line) => {
        if (line.itemId === itemId) {
          const newQty = Math.max(0, Math.round(qty * 100) / 100);
          return {
            ...line,
            quantity: newQty,
            totalAmount: Math.round(line.assignedPrice * newQty * 100) / 100,
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
          const isNowMfg = !line.needsManufacturing;
          return {
            ...line,
            needsManufacturing: isNowMfg,
            mfgStatus: isNowMfg ? 'Pending' : 'Not Required',
          };
        }
        return line;
      })
    );
  };

  // Filtered Edit Items based on Search & Category
  const filteredEditItems = useMemo(() => {
    return editOrderItems.filter((item) => {
      if (editShowOnlySelected && (!item.quantity || item.quantity <= 0)) {
        return false;
      }
      if (editCategoryFilter !== 'All' && item.category !== editCategoryFilter) {
        return false;
      }
      if (editSearchQuery.trim()) {
        const q = editSearchQuery.toLowerCase().trim();
        const matchName = item.name?.toLowerCase().includes(q);
        const matchCode = item.code?.toLowerCase().includes(q);
        const matchCat = item.category?.toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchCat) return false;
      }
      return true;
    });
  }, [editOrderItems, editShowOnlySelected, editCategoryFilter, editSearchQuery]);

  const editSelectedLines = useMemo(() => {
    return editOrderItems.filter((it) => (it.quantity || 0) > 0);
  }, [editOrderItems]);

  const editTotalWeight = useMemo(() => {
    return Math.round(editSelectedLines.reduce((acc, it) => acc + (it.quantity || 0), 0) * 100) / 100;
  }, [editSelectedLines]);

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
      const hasMfgItems = selectedLines.some((l) => Boolean(l.needsManufacturing));

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
          needsManufacturing: Boolean(line.needsManufacturing),
          mfgStatus:
            !line.needsManufacturing
              ? 'Not Required'
              : line.mfgStatus === 'Moved to Packing'
              ? 'Moved to Packing'
              : line.mfgStatus || 'Pending',
          pckStatus: line.pckStatus || 'Pending',
        })),
        subtotal: editModalTaxCalc.taxType === 'inclusive' ? Number(editModalTaxCalc.taxableAmount) : (Number(editModalSubtotal) || 0),
        tax: Number(editModalTax) || 0,
        taxableAmount: editModalTaxCalc.taxableAmount,
        cgstAmount: editModalTaxCalc.cgstAmount,
        sgstAmount: editModalTaxCalc.sgstAmount,
        cgstPercent: editModalTaxCalc.cgstPercent,
        sgstPercent: editModalTaxCalc.sgstPercent,
        taxType: editModalTaxCalc.taxType,
        totalAmount: Number(editModalTotal) || 0,
        orderStatus: hasMfgItems
          ? editingOrder.orderStatus === 'Moved to Manufacturing' || editingOrder.orderStatus === 'Order Created'
            ? 'Moved to Manufacturing'
            : (editingOrder.orderStatus || 'Order Created')
          : (editingOrder.orderStatus || 'Order Created'),
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

  // Open Manage Payment Modal for an Order
  const handleOpenManagePayment = (order: WholesalerOrderRecord) => {
    setManagingOrder(order);
    const balanceDue = Math.max(0, (Number(order.totalAmount) || 0) - (Number(order.receivedAmount) || 0));
    setInstallmentAmount(balanceDue > 0 ? String(balanceDue) : '');
    setInstallmentMode(order.paymentMode && !order.paymentMode.includes('Pending') ? order.paymentMode : 'UPI');
    setInstallmentDate(getTodayDateStr());
    setInstallmentNote('');
  };

  // Submit Installment Payment
  const handleRecordInstallment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!managingOrder) return;

    const amt = parseFloat(installmentAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.warning('Invalid Amount', 'Please enter a valid installment payment amount.');
      return;
    }

    const currentReceived = Number(managingOrder.receivedAmount) || 0;
    const totalAmt = Number(managingOrder.totalAmount) || 0;
    const balanceDue = Math.max(0, totalAmt - currentReceived);

    if (amt > balanceDue + 0.01) {
      toast.error(
        'Amount Exceeds Due',
        `Installment amount (₹${amt.toLocaleString('en-IN')}) cannot exceed remaining balance due of ₹${balanceDue.toLocaleString('en-IN')}.`
      );
      return;
    }

    try {
      setIsSavingInstallment(true);
      const newEntry: PaymentEntry = {
        id: `inst-${Date.now()}`,
        amount: amt,
        mode: installmentMode,
        note: installmentNote.trim() || `Installment payment`,
        paidAt: installmentDate ? new Date(installmentDate).toISOString() : new Date().toISOString(),
      };

      const existingPayments = Array.isArray(managingOrder.payments)
        ? [...managingOrder.payments]
        : currentReceived > 0
        ? [
            {
              id: 'initial-pay',
              amount: currentReceived,
              mode: managingOrder.paymentMode || 'Cash',
              note: 'Initial payment',
              paidAt: managingOrder.createdAt?.toDate ? managingOrder.createdAt.toDate().toISOString() : new Date().toISOString(),
            },
          ]
        : [];

      const updatedPayments = [...existingPayments, newEntry];
      const newTotalReceived = Math.round((currentReceived + amt) * 100) / 100;
      const isFullyPaid = newTotalReceived >= totalAmt - 0.01;
      const newPaymentStatus: 'Paid' | 'Partial' | 'Pending' = isFullyPaid ? 'Paid' : 'Partial';

      await updateDoc(doc(db, 'orders', managingOrder.id), {
        receivedAmount: newTotalReceived,
        paymentStatus: newPaymentStatus,
        paymentMode: installmentMode,
        payments: updatedPayments,
        updatedAt: serverTimestamp(),
      });

      const updatedOrderRecord: WholesalerOrderRecord = {
        ...managingOrder,
        receivedAmount: newTotalReceived,
        paymentStatus: newPaymentStatus,
        paymentMode: installmentMode,
        payments: updatedPayments,
      };
      setManagingOrder(updatedOrderRecord);

      const remainingAfter = Math.max(0, totalAmt - newTotalReceived);
      setInstallmentAmount(remainingAfter > 0 ? String(remainingAfter) : '');
      setInstallmentNote('');

      toast.success(
        'Installment Recorded',
        `Recorded ₹${amt.toLocaleString('en-IN')} payment for Order ${managingOrder.orderId}. ${
          isFullyPaid ? 'Order is now fully settled!' : `Remaining balance: ₹${remainingAfter.toLocaleString('en-IN')}`
        }`
      );
    } catch (err: any) {
      console.error('Error recording payment installment:', err);
      toast.error('Payment Failed', err?.message || 'Could not record installment payment.');
    } finally {
      setIsSavingInstallment(false);
    }
  };

  // Void/Delete Installment
  const handleDeleteInstallment = async (paymentId: string) => {
    if (!managingOrder) return;
    if (!confirm('Are you sure you want to remove this installment payment? The order balance will be recalculated.')) {
      return;
    }

    try {
      setDeletingPaymentId(paymentId);
      const currentPayments = Array.isArray(managingOrder.payments) ? managingOrder.payments : [];
      const updatedPayments = currentPayments.filter((p) => p.id !== paymentId);
      const newReceived = Math.round(updatedPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) * 100) / 100;
      const totalAmt = Number(managingOrder.totalAmount) || 0;
      const newPaymentStatus: 'Paid' | 'Partial' | 'Pending' =
        newReceived >= totalAmt - 0.01 ? 'Paid' : newReceived > 0 ? 'Partial' : 'Pending';

      await updateDoc(doc(db, 'orders', managingOrder.id), {
        receivedAmount: newReceived,
        paymentStatus: newPaymentStatus,
        payments: updatedPayments,
        updatedAt: serverTimestamp(),
      });

      const updatedOrderRecord: WholesalerOrderRecord = {
        ...managingOrder,
        receivedAmount: newReceived,
        paymentStatus: newPaymentStatus,
        payments: updatedPayments,
      };
      setManagingOrder(updatedOrderRecord);

      const balanceDue = Math.max(0, totalAmt - newReceived);
      setInstallmentAmount(balanceDue > 0 ? String(balanceDue) : '');

      toast.success('Installment Removed', 'Payment entry deleted and order balance updated.');
    } catch (err: any) {
      console.error('Error removing installment:', err);
      toast.error('Failed to Remove', err?.message || 'Could not remove installment.');
    } finally {
      setDeletingPaymentId(null);
    }
  };

  // Credit High-Level Statistics
  const creditStats = useMemo(() => {
    let totalBilled = 0;
    let totalReceived = 0;
    let totalPending = 0;
    let pendingOrdersCount = 0;
    const wholesalersWithDues = new Set<string>();

    orders.forEach((o) => {
      const tot = Number(o.totalAmount) || 0;
      const rec = Number(o.receivedAmount) || 0;
      const due = Math.max(0, tot - rec);

      totalBilled += tot;
      totalReceived += rec;
      totalPending += due;

      if (due > 0.01) {
        pendingOrdersCount += 1;
        wholesalersWithDues.add(o.wholesalerId || o.wholesalerName);
      }
    });

    return {
      totalBilled: Math.round(totalBilled * 100) / 100,
      totalReceived: Math.round(totalReceived * 100) / 100,
      totalPending: Math.round(totalPending * 100) / 100,
      pendingOrdersCount,
      wholesalersWithDuesCount: wholesalersWithDues.size,
    };
  }, [orders]);

  // Wholesaler-wise aggregated credit ledger
  const wholesalerCreditList = useMemo(() => {
    const map = new Map<string, WholesalerCreditSummary>();

    orders.forEach((order) => {
      const wKey = (order.wholesalerId || order.wholesalerName || 'unknown').trim().toLowerCase();
      const tot = Number(order.totalAmount) || 0;
      const rec = Number(order.receivedAmount) || 0;
      const due = Math.max(0, tot - rec);
      const ordDate =
        order.orderDate ||
        (order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString('en-CA') : '');

      if (!map.has(wKey)) {
        map.set(wKey, {
          key: wKey,
          wholesalerId: order.wholesalerId || '',
          wholesalerName: order.wholesalerName || 'Unknown Wholesaler',
          companyName: order.companyName || '',
          wholesalerMobile: order.wholesalerMobile || '',
          totalOrdersCount: 1,
          pendingOrdersCount: due > 0.01 ? 1 : 0,
          totalBilled: tot,
          totalPaid: rec,
          outstandingBalance: due,
          latestOrderDate: ordDate,
          orders: [order],
        });
      } else {
        const item = map.get(wKey)!;
        item.totalOrdersCount += 1;
        if (due > 0.01) item.pendingOrdersCount += 1;
        item.totalBilled += tot;
        item.totalPaid += rec;
        item.outstandingBalance += due;
        item.orders.push(order);
        if (ordDate && (!item.latestOrderDate || ordDate > item.latestOrderDate)) {
          item.latestOrderDate = ordDate;
        }
      }
    });

    let list = Array.from(map.values());

    if (creditSearchQuery.trim()) {
      const q = creditSearchQuery.toLowerCase().trim();
      list = list.filter(
        (w) =>
          w.wholesalerName.toLowerCase().includes(q) ||
          w.companyName.toLowerCase().includes(q) ||
          w.wholesalerMobile.includes(q)
      );
    }

    if (creditStatusFilter === 'Pending') {
      list = list.filter((w) => w.outstandingBalance > 0.01);
    } else if (creditStatusFilter === 'Paid') {
      list = list.filter((w) => w.outstandingBalance <= 0.01);
    }

    list.sort((a, b) => {
      if (creditSortBy === 'due_desc') return b.outstandingBalance - a.outstandingBalance;
      if (creditSortBy === 'due_asc') return a.outstandingBalance - b.outstandingBalance;
      if (creditSortBy === 'name_asc') return a.wholesalerName.localeCompare(b.wholesalerName);
      return 0;
    });

    return list;
  }, [orders, creditSearchQuery, creditStatusFilter, creditSortBy]);

  // Credit Orders flat list
  const filteredCreditOrders = useMemo(() => {
    return orders
      .filter((order) => {
        const tot = Number(order.totalAmount) || 0;
        const rec = Number(order.receivedAmount) || 0;
        const due = Math.max(0, tot - rec);

        if (creditStatusFilter === 'Pending' && due <= 0.01) return false;
        if (creditStatusFilter === 'Paid' && due > 0.01) return false;

        if (creditSearchQuery.trim()) {
          const q = creditSearchQuery.toLowerCase().trim();
          const matchId = order.orderId?.toLowerCase().includes(q);
          const matchName = order.wholesalerName?.toLowerCase().includes(q);
          const matchMobile = order.wholesalerMobile?.includes(q);
          if (!matchId && !matchName && !matchMobile) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const dueA = Math.max(0, (Number(a.totalAmount) || 0) - (Number(a.receivedAmount) || 0));
        const dueB = Math.max(0, (Number(b.totalAmount) || 0) - (Number(b.receivedAmount) || 0));
        if (creditSortBy === 'due_desc') return dueB - dueA;
        if (creditSortBy === 'due_asc') return dueA - dueB;
        return (b.orderDate || '').localeCompare(a.orderDate || '');
      });
  }, [orders, creditStatusFilter, creditSearchQuery, creditSortBy]);

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

      {/* ── Main Tab Navigation: Orders List vs Credit Ledger ───────────────── */}
      <div className="flex items-center gap-2 border-b border-slate-200/90 pb-2">
        <button
          type="button"
          onClick={() => setActiveMainTab('orders')}
          className={`h-9 px-4 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
            activeMainTab === 'orders'
              ? 'bg-[#02626D] text-white shadow-xs'
              : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200/80'
          }`}
        >
          <ShoppingBag size={15} />
          <span>Orders List</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              activeMainTab === 'orders' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {orders.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveMainTab('credit')}
          className={`h-9 px-4 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
            activeMainTab === 'credit'
              ? 'bg-[#02626D] text-white shadow-xs'
              : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200/80'
          }`}
        >
          <WalletCards size={15} />
          <span>Credit & Dues</span>
          {creditStats.totalPending > 0 ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white shadow-2xs">
              ₹{creditStats.totalPending.toLocaleString('en-IN')} Due
            </span>
          ) : (
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeMainTab === 'credit' ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-700'
              }`}
            >
              All Settled
            </span>
          )}
        </button>
      </div>

      {/* ── TAB 1: Wholesale Orders List View ───────────────────────────────── */}
      {activeMainTab === 'orders' && (
        <>
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
                <table className="w-full text-left border-collapse min-w-[1050px]">
                  <thead>
                    <tr className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider bg-[#f7f7f8] border-b border-slate-200">
                      <th className="py-3 px-4">Order ID</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Wholesaler Details</th>
                      <th className="py-3 px-4">Assigned Price List</th>
                      <th className="py-3 px-4">Items Count</th>
                      <th className="py-3 px-4">Manufacturing Queue</th>
                      <th className="py-3 px-4">Total Amount</th>
                      <th className="py-3 px-4">Payment & Due</th>
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
                      const totalAmt = Number(order.totalAmount) || 0;
                      const receivedAmt = Number(order.receivedAmount) || 0;
                      const balanceDue = Math.max(0, totalAmt - receivedAmt);
                      const isPaid = receivedAmt >= totalAmt - 0.01;
                      const isPartial = receivedAmt > 0 && !isPaid;

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

                          {/* Payment & Due Status Badge */}
                          <td className="py-3 px-4">
                            {isPaid ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-semibold text-[10px] border border-emerald-200">
                                <CheckCircle2 size={11} className="text-emerald-600" />
                                <span>Paid (₹{receivedAmt})</span>
                              </span>
                            ) : isPartial ? (
                              <div className="flex flex-col gap-0.5">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 font-semibold text-[10px] border border-amber-200 w-fit">
                                  <Clock size={11} className="text-amber-600" />
                                  <span>Partial (₹{receivedAmt})</span>
                                </span>
                                <span className="text-[10px] text-rose-600 font-bold font-mono">
                                  Due: ₹{balanceDue.toFixed(2)}
                                </span>
                              </div>
                            ) : (
                              <div className="flex flex-col gap-0.5">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 font-semibold text-[10px] border border-rose-200 w-fit">
                                  <span>Pending</span>
                                </span>
                                <span className="text-[10px] text-rose-600 font-bold font-mono">
                                  Due: ₹{balanceDue.toFixed(2)}
                                </span>
                              </div>
                            )}
                          </td>

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
                              {/* Manage Order Payments & Installments Action Button */}
                              <button
                                onClick={() => handleOpenManagePayment(order)}
                                className="h-7 px-2.5 text-[11px] font-bold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 inline-flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                                title="Manage Payments & Installments"
                              >
                                <WalletCards size={13} className="text-emerald-600" />
                                <span>Manage</span>
                              </button>

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
        </>
      )}

      {/* ── TAB 2: Wholesale Credit & Dues Ledger ───────────────────────────── */}
      {activeMainTab === 'credit' && (
        <div className="space-y-4">
          {/* Credit Overview 4-Stat Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Card 1: Outstanding Credit Due */}
            <div className="bg-white rounded-2xl p-4 border border-rose-200/80 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider block">
                  Pending Credit Due
                </span>
                <span className="text-xl sm:text-2xl font-black text-rose-700 font-mono mt-0.5 block">
                  ₹{creditStats.totalPending.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </span>
                <span className="text-[11px] text-slate-500 mt-0.5 block">
                  {creditStats.pendingOrdersCount} orders with balance pending
                </span>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
                <WalletCards size={22} />
              </div>
            </div>

            {/* Card 2: Total Wholesale Billed */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Total Wholesale Billed
                </span>
                <span className="text-xl sm:text-2xl font-black text-slate-900 font-mono mt-0.5 block">
                  ₹{creditStats.totalBilled.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </span>
                <span className="text-[11px] text-slate-500 mt-0.5 block">
                  {orders.length} total wholesale orders
                </span>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                <Receipt size={22} />
              </div>
            </div>

            {/* Card 3: Total Collected / Paid */}
            <div className="bg-white rounded-2xl p-4 border border-emerald-200/80 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider block">
                  Total Collected
                </span>
                <span className="text-xl sm:text-2xl font-black text-emerald-700 font-mono mt-0.5 block">
                  ₹{creditStats.totalReceived.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </span>
                <span className="text-[11px] text-slate-500 mt-0.5 block">
                  {creditStats.totalBilled > 0
                    ? `${Math.round((creditStats.totalReceived / creditStats.totalBilled) * 100)}% collected`
                    : '0% collected'}
                </span>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                <CheckCircle2 size={22} />
              </div>
            </div>

            {/* Card 4: Wholesalers with Pending Balance */}
            <div className="bg-white rounded-2xl p-4 border border-amber-200/80 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider block">
                  Wholesalers with Dues
                </span>
                <span className="text-xl sm:text-2xl font-black text-amber-800 font-mono mt-0.5 block">
                  {creditStats.wholesalersWithDuesCount}
                </span>
                <span className="text-[11px] text-slate-500 mt-0.5 block">
                  Accounts with outstanding credit
                </span>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 border border-amber-100">
                <Building2 size={22} />
              </div>
            </div>
          </div>

          {/* Credit Toolbar: Search, Filters & View Toggle */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search wholesaler, company, phone, or order ID..."
                value={creditSearchQuery}
                onChange={(e) => setCreditSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 h-8 bg-[#f7f7f8] focus:bg-white text-xs rounded-lg border border-slate-300 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#02626D] transition-all"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Filter Pills */}
              <div className="flex bg-[#f1f2f4] p-0.5 rounded-lg border border-slate-200">
                {(['Pending', 'All', 'Paid'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setCreditStatusFilter(filter)}
                    className={`h-7 px-3 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                      creditStatusFilter === filter
                        ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/80'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {filter === 'Pending' ? 'Pending Dues' : filter === 'Paid' ? 'Settled Only' : 'All Accounts'}
                  </button>
                ))}
              </div>

              {/* View Mode Switcher */}
              <div className="flex bg-[#f1f2f4] p-0.5 rounded-lg border border-slate-200">
                <button
                  onClick={() => setCreditViewMode('wholesaler')}
                  className={`h-7 px-3 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                    creditViewMode === 'wholesaler'
                      ? 'bg-white text-[#02626D] shadow-2xs border border-slate-200/80 font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  By Wholesaler
                </button>
                <button
                  onClick={() => setCreditViewMode('orders')}
                  className={`h-7 px-3 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                    creditViewMode === 'orders'
                      ? 'bg-white text-[#02626D] shadow-2xs border border-slate-200/80 font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  By Orders
                </button>
              </div>

              {/* Sort Dropdown */}
              <select
                value={creditSortBy}
                onChange={(e) => setCreditSortBy(e.target.value as any)}
                className="h-8 px-2.5 bg-[#f7f7f8] text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 focus:outline-none focus:border-[#02626D] cursor-pointer"
              >
                <option value="due_desc">Highest Due First</option>
                <option value="due_asc">Lowest Due First</option>
                <option value="name_asc">Name (A-Z)</option>
              </select>
            </div>
          </div>

          {/* View 1: Wholesaler Ledger Breakdown Cards */}
          {creditViewMode === 'wholesaler' && (
            <div className="space-y-3">
              {wholesalerCreditList.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200/90 p-12 text-center text-slate-400 text-xs">
                  No wholesaler credit records matching the selected filter.
                </div>
              ) : (
                wholesalerCreditList.map((ws) => {
                  const isExpanded = expandedWholesalerKey === ws.key;
                  const hasDue = ws.outstandingBalance > 0.01;

                  return (
                    <div
                      key={ws.key}
                      className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden transition-all"
                    >
                      {/* Wholesaler Header Summary Row */}
                      <div
                        onClick={() => setExpandedWholesalerKey(isExpanded ? null : ws.key)}
                        className={`p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer select-none transition-colors ${
                          isExpanded ? 'bg-slate-50/70 border-b border-slate-200' : 'hover:bg-slate-50/40'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 border ${
                              hasDue
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}
                          >
                            {ws.wholesalerName.slice(0, 2).toUpperCase()}
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-slate-900 text-sm">{ws.wholesalerName}</h3>
                              {ws.companyName && (
                                <span className="text-[11px] text-slate-500 font-medium">({ws.companyName})</span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                              {ws.wholesalerMobile && (
                                <span className="flex items-center gap-1 font-mono text-slate-600">
                                  <Phone size={12} className="text-slate-400" />
                                  <span>{ws.wholesalerMobile}</span>
                                </span>
                              )}
                              <span>•</span>
                              <span>{ws.totalOrdersCount} Orders</span>
                              {ws.pendingOrdersCount > 0 && (
                                <>
                                  <span>•</span>
                                  <span className="font-semibold text-rose-600">
                                    {ws.pendingOrdersCount} with pending dues
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Financial Snapshot & Expand Button */}
                        <div className="flex items-center justify-between md:justify-end gap-4 shrink-0">
                          <div className="text-right">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Billed</span>
                            <span className="text-xs font-bold text-slate-700 font-mono">
                              ₹{ws.totalBilled.toLocaleString('en-IN')}
                            </span>
                          </div>

                          <div className="text-right">
                            <span className="text-[10px] uppercase font-bold text-emerald-600 block">Total Paid</span>
                            <span className="text-xs font-bold text-emerald-700 font-mono">
                              ₹{ws.totalPaid.toLocaleString('en-IN')}
                            </span>
                          </div>

                          <div className="text-right pl-2 border-l border-slate-200">
                            <span className="text-[10px] uppercase font-bold text-rose-600 block">Pending Due</span>
                            <span
                              className={`text-sm sm:text-base font-black font-mono px-2 py-0.5 rounded-lg border ${
                                hasDue
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              }`}
                            >
                              ₹{ws.outstandingBalance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                            </span>
                          </div>

                          <button
                            type="button"
                            className="p-1 text-slate-400 hover:text-slate-700 transition-colors"
                            aria-label="Expand orders"
                          >
                            {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                          </button>
                        </div>
                      </div>

                      {/* Expanded Orders Drilldown */}
                      {isExpanded && (
                        <div className="p-3 sm:p-4 bg-slate-50/40">
                          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                            <div className="px-4 py-2.5 bg-[#f7f7f8] border-b border-slate-200 flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-700">
                                Orders for {ws.wholesalerName} ({ws.orders.length})
                              </span>
                              <span className="text-[11px] text-slate-500">
                                Click &quot;Manage&quot; on any order to record installment payments
                              </span>
                            </div>

                            <div className="overflow-x-auto">
                              <table className="w-full text-left border-collapse text-xs min-w-[750px]">
                                <thead>
                                  <tr className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider bg-slate-50/70 border-b border-slate-200">
                                    <th className="py-2.5 px-3">Order ID</th>
                                    <th className="py-2.5 px-3">Date</th>
                                    <th className="py-2.5 px-3">Items</th>
                                    <th className="py-2.5 px-3">Order Total</th>
                                    <th className="py-2.5 px-3">Paid Amount</th>
                                    <th className="py-2.5 px-3">Pending Due</th>
                                    <th className="py-2.5 px-3">Payment Status</th>
                                    <th className="py-2.5 px-3">Fulfillment</th>
                                    <th className="py-2.5 px-3 text-center">Action</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {ws.orders.map((ord) => {
                                    const tot = Number(ord.totalAmount) || 0;
                                    const rec = Number(ord.receivedAmount) || 0;
                                    const due = Math.max(0, tot - rec);
                                    const isPaid = rec >= tot - 0.01;
                                    const isPartial = rec > 0 && !isPaid;

                                    return (
                                      <tr key={ord.id} className="hover:bg-slate-50/60 transition-colors">
                                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                                          {ord.orderId}
                                        </td>
                                        <td className="py-2.5 px-3 text-slate-600 font-medium">
                                          {ord.orderDate || '—'}
                                        </td>
                                        <td className="py-2.5 px-3 text-slate-600">
                                          {ord.items?.length || 0} items
                                        </td>
                                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                                          ₹{tot.toLocaleString('en-IN')}
                                        </td>
                                        <td className="py-2.5 px-3 font-mono font-semibold text-emerald-700">
                                          ₹{rec.toLocaleString('en-IN')}
                                        </td>
                                        <td className="py-2.5 px-3 font-mono font-bold">
                                          {due > 0.01 ? (
                                            <span className="text-rose-600 font-black">
                                              ₹{due.toLocaleString('en-IN')}
                                            </span>
                                          ) : (
                                            <span className="text-emerald-600 font-semibold">₹0 (Paid)</span>
                                          )}
                                        </td>
                                        <td className="py-2.5 px-3">
                                          {isPaid ? (
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                              Paid
                                            </span>
                                          ) : isPartial ? (
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                              Partial
                                            </span>
                                          ) : (
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                                              Pending
                                            </span>
                                          )}
                                        </td>
                                        <td className="py-2.5 px-3">
                                          <span className="text-[10px] font-semibold text-slate-600">
                                            {ord.status || 'Pending'}
                                          </span>
                                        </td>
                                        <td className="py-2.5 px-3 text-center">
                                          <button
                                            type="button"
                                            onClick={() => handleOpenManagePayment(ord)}
                                            className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs inline-flex items-center gap-1 cursor-pointer transition-colors active:scale-95"
                                          >
                                            <WalletCards size={12} />
                                            <span>Manage Payment</span>
                                          </button>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* View 2: Flat Pending Orders List */}
          {creditViewMode === 'orders' && (
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
              {filteredCreditOrders.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-xs">
                  No orders found matching the credit filter.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs min-w-[950px]">
                    <thead>
                      <tr className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider bg-[#f7f7f8] border-b border-slate-200">
                        <th className="py-3 px-4">Order ID</th>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Wholesaler Details</th>
                        <th className="py-3 px-4">Total Amount</th>
                        <th className="py-3 px-4">Paid Amount</th>
                        <th className="py-3 px-4">Pending Due</th>
                        <th className="py-3 px-4">Payment Status</th>
                        <th className="py-3 px-4">Fulfillment</th>
                        <th className="py-3 px-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredCreditOrders.map((ord) => {
                        const tot = Number(ord.totalAmount) || 0;
                        const rec = Number(ord.receivedAmount) || 0;
                        const due = Math.max(0, tot - rec);
                        const isPaid = rec >= tot - 0.01;
                        const isPartial = rec > 0 && !isPaid;

                        return (
                          <tr key={ord.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-3 px-4 font-mono font-bold text-slate-900">{ord.orderId}</td>
                            <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{ord.orderDate || '—'}</td>
                            <td className="py-3 px-4">
                              <p className="font-semibold text-slate-900">{ord.wholesalerName}</p>
                              <p className="text-[10px] text-slate-400 font-mono">{ord.wholesalerMobile}</p>
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-slate-900">
                              ₹{tot.toLocaleString('en-IN')}
                            </td>
                            <td className="py-3 px-4 font-mono font-semibold text-emerald-700">
                              ₹{rec.toLocaleString('en-IN')}
                            </td>
                            <td className="py-3 px-4 font-mono font-bold">
                              {due > 0.01 ? (
                                <span className="text-rose-600 font-black">₹{due.toLocaleString('en-IN')}</span>
                              ) : (
                                <span className="text-emerald-600 font-semibold">₹0 (Paid)</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              {isPaid ? (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  Paid
                                </span>
                              ) : isPartial ? (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                  Partial
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                                  Pending
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <span className="text-[10px] font-semibold text-slate-600">
                                {ord.status || 'Pending'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <button
                                type="button"
                                onClick={() => handleOpenManagePayment(ord)}
                                className="h-7 px-3 text-[11px] font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs inline-flex items-center gap-1 cursor-pointer transition-colors active:scale-95"
                              >
                                <WalletCards size={12} />
                                <span>Manage</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── MODAL: Create New Wholesaler B2B Order (Full Screen) ─────────────── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#f8fafc] flex flex-col overflow-hidden animate-in fade-in duration-150 font-sans">
          <div className="w-full h-full flex flex-col overflow-hidden">
            
            {/* Header */}
            <div className="bg-white border-b border-slate-200/80 px-4 sm:px-6 py-3.5 flex items-center justify-between shrink-0 shadow-2xs">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-50 text-[#02626D] flex items-center justify-center border border-teal-100 shadow-2xs shrink-0">
                  <Building2 size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm sm:text-base font-bold text-slate-900">
                      Create Wholesaler B2B Order
                    </h3>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#02626D] bg-teal-50 border border-teal-100 px-2 py-0.5 rounded-full">
                      B2B Portal
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {selectedWholesaler
                      ? `Ordering for: ${selectedWholesaler.name || selectedWholesaler.businessName} • Price List: ${selectedWholesaler.priceListName || 'Standard Rates'}`
                      : 'Select a wholesaler to apply assigned custom price lists and configure manufacturing dispatch.'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsAddModalOpen(false);
                  setSelectedWholesaler(null);
                  setOrderItems([]);
                  setAddSearchQuery('');
                  setAddCategoryFilter('All');
                  setAddShowOnlySelected(false);
                }}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body - 2 Columns */}
            <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-0">
              
              {/* Left Column: Wholesaler & Date + Item Catalog with Search */}
              <div className="lg:col-span-8 overflow-y-auto p-3 sm:p-4 space-y-3.5 border-b lg:border-b-0 lg:border-r border-slate-200/90 no-scrollbar">
                
                {/* 1. Wholesaler Selection & Order Date Card */}
                <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200/90 shadow-2xs space-y-3">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <div className="flex-1">
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Select Wholesaler <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={selectedWholesaler?.id || ''}
                        onChange={(e) => handleSelectWholesaler(e.target.value)}
                        className="w-full h-10 px-3 bg-white text-xs font-semibold rounded-xl border border-slate-300 text-slate-800 focus:outline-none focus:border-[#02626D] focus:ring-2 focus:ring-[#02626D]/15 cursor-pointer shadow-2xs"
                      >
                        <option value="">-- Choose Registered Wholesaler --</option>
                        {wholesalers.map((ws) => {
                          const phone = ws.personalMobile || ws.businessMobile || ws.mobile || '';
                          const title = ws.name || ws.businessName || 'Wholesaler';
                          return (
                            <option key={ws.id} value={ws.id}>
                              {title} {phone ? `(${phone})` : ''} {ws.priceListName ? `— [${ws.priceListName}]` : ''}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div className="w-full sm:w-48 shrink-0">
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Order Date <span className="text-rose-500">*</span>
                      </label>
                      <CustomDatePicker
                        value={orderDate}
                        onChange={setOrderDate}
                        allowAll={false}
                        size="sm"
                      />
                    </div>
                  </div>

                  {/* Wholesaler Details Card when selected */}
                  {selectedWholesaler && (
                    <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-teal-50/70 border border-teal-100 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-[#02626D]/15 text-[#02626D] flex items-center justify-center shrink-0">
                          <Building2 size={14} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 truncate">
                            {selectedWholesaler.name || selectedWholesaler.businessName}
                          </p>
                          <p className="text-[10px] text-slate-500 font-mono">
                            {selectedWholesaler.personalMobile || selectedWholesaler.businessMobile || selectedWholesaler.mobile || 'No Contact Number'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] text-slate-500 font-semibold">Assigned Price List:</span>
                        <span className="font-bold text-[11px] text-[#02626D] bg-white px-2 py-0.5 rounded-md border border-teal-200 shadow-2xs">
                          {selectedWholesaler.priceListName || 'Standard Rates'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Product Items Catalog with Search Bar */}
                {selectedWholesaler ? (
                  <div className="space-y-3">
                    {/* Search & Category Filter Toolbar */}
                    <div className="bg-white rounded-2xl p-3 sm:p-3.5 border border-slate-200/90 shadow-2xs space-y-2.5">
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                        {/* Search Input */}
                        <div className="relative flex-1">
                          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Search products by name, code, or category..."
                            value={addSearchQuery}
                            onChange={(e) => setAddSearchQuery(e.target.value)}
                            className="w-full h-9 pl-9 pr-8 text-xs text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#02626D] focus:ring-2 focus:ring-[#02626D]/15 placeholder:text-slate-400 transition-all shadow-2xs"
                          />
                          {addSearchQuery && (
                            <button
                              type="button"
                              onClick={() => setAddSearchQuery('')}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                            >
                              <X size={13} />
                            </button>
                          )}
                        </div>

                        {/* Selected Only Pill */}
                        <button
                          type="button"
                          onClick={() => setAddShowOnlySelected((prev) => !prev)}
                          className={`h-9 px-3 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                            addShowOnlySelected
                              ? 'bg-[#02626D] text-white border-[#02626D] shadow-2xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <Check size={12} />
                          <span>Selected Only ({addSelectedLines.length})</span>
                        </button>
                      </div>

                      {/* Category Filter Pills */}
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar text-xs">
                        {allCategories.map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setAddCategoryFilter(cat)}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                              addCategoryFilter === cat
                                ? 'bg-[#02626D] text-white shadow-2xs font-bold'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Product Cards Grid */}
                    {filteredAddItems.length === 0 ? (
                      <div className="py-12 text-center text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
                        <Package size={28} className="mx-auto mb-1.5 text-slate-300" />
                        <p className="text-xs font-medium">No products found</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">Try changing your search query or category filter</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
                        {filteredAddItems.map((line) => {
                          const isAdded = (line.quantity || 0) > 0;
                          const isMfg = Boolean(line.needsManufacturing);
                          const hasCustomPrice = line.assignedPrice !== line.standardPrice;

                          return (
                            <div
                              key={line.itemId}
                              className={`rounded-xl p-3 border transition-all duration-150 flex flex-col justify-between gap-2.5 ${
                                isAdded
                                  ? 'bg-white border-[#02626D] shadow-xs ring-1 ring-[#02626D]/20'
                                  : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                              }`}
                            >
                              {/* Top Details: Image + Title + Code + Rate */}
                              <div className="flex items-start gap-2.5">
                                <div className="relative w-12 h-12 rounded-lg bg-slate-50 border border-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                                  {line.imageUrl ? (
                                    <Image
                                      src={line.imageUrl}
                                      alt={line.name}
                                      fill
                                      className="object-contain p-1"
                                    />
                                  ) : (
                                    <Package size={20} className="text-slate-400" />
                                  )}
                                </div>

                                <div className="flex-1 min-w-0">
                                  <h4 className="text-xs font-bold text-slate-900 truncate" title={line.name}>
                                    {line.name}
                                  </h4>
                                  <p className="text-[10px] text-slate-400 font-mono truncate mt-0.5">
                                    {line.code || 'ITEM'} • {line.category || 'General'}
                                  </p>

                                  {/* Price Display */}
                                  <div className="flex items-baseline gap-1.5 mt-1 flex-wrap">
                                    <span className="text-xs font-black text-[#02626D]">
                                      ₹{line.assignedPrice}
                                      <span className="text-[9.5px] font-normal text-slate-400 ml-0.5">/{line.unit}</span>
                                    </span>

                                    {hasCustomPrice && (
                                      <span className="text-[9.5px] text-slate-400 line-through">
                                        ₹{line.standardPrice}
                                      </span>
                                    )}

                                    {hasCustomPrice && (
                                      <span className="text-[8.5px] font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-100 px-1 rounded">
                                        B2B Rate
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Bottom Controls: Mfg Toggle + Quantity Stepper */}
                              <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                                {/* Manufacturing Toggle */}
                                <button
                                  type="button"
                                  onClick={() => handleToggleAddMfg(line.itemId)}
                                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer shrink-0 ${
                                    isMfg
                                      ? 'bg-teal-50 text-teal-800 border-teal-200 hover:bg-teal-100 shadow-2xs'
                                      : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                                  }`}
                                  title={isMfg ? 'Will move to Manufacturing Kitchen' : 'In stock / Direct dispatch'}
                                >
                                  <Factory size={11} className={isMfg ? 'text-teal-700' : 'text-slate-400'} />
                                  <span>{isMfg ? 'To Mfg' : 'In Stock'}</span>
                                </button>

                                {/* Quantity Stepper */}
                                <div className="flex items-center gap-2">
                                  <div className="flex items-center rounded-lg border border-slate-200 bg-white overflow-hidden shadow-2xs">
                                    <button
                                      type="button"
                                      onClick={() => handleQuantityChange(line.itemId, (line.quantity || 0) - (line.unit?.toUpperCase() === 'KG' ? 0.5 : 1))}
                                      className="w-6 h-6 flex items-center justify-center text-slate-500 hover:bg-slate-100 active:bg-slate-200 transition-colors cursor-pointer"
                                      title="Decrease"
                                    >
                                      <Minus size={10} />
                                    </button>
                                    <input
                                      type="number"
                                      min="0"
                                      step="any"
                                      value={line.quantity === 0 ? '' : line.quantity}
                                      onChange={(e) => handleQuantityChange(line.itemId, parseFloat(e.target.value) || 0)}
                                      placeholder="0"
                                      className="w-12 h-6 text-center text-xs font-bold text-slate-900 bg-transparent border-x border-slate-200 focus:outline-none"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleQuantityChange(line.itemId, (line.quantity || 0) + (line.unit?.toUpperCase() === 'KG' ? 0.5 : 1))}
                                      className="w-6 h-6 flex items-center justify-center text-[#02626D] hover:bg-teal-50 active:bg-teal-100 transition-colors cursor-pointer"
                                      title="Increase"
                                    >
                                      <Plus size={10} />
                                    </button>
                                  </div>

                                  <span className="text-[11px] font-black text-slate-900 min-w-[50px] text-right">
                                    ₹{line.totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-20 text-center text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
                    <Building2 size={36} className="mx-auto mb-2 text-slate-300" />
                    <h4 className="text-sm font-bold text-slate-700">Please Select a Wholesaler</h4>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                      Choose a registered wholesaler above to automatically load their customized B2B price list rates and start building the order.
                    </p>
                  </div>
                )}
              </div>

              {/* Right Column: Order Summary & Cart */}
              <div className="lg:col-span-4 overflow-y-auto p-4 md:p-5 bg-white flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  {/* Summary Header */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-[#02626D]/10 text-[#02626D] flex items-center justify-center">
                        <ShoppingBag size={13} />
                      </div>
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Order Cart
                      </h3>
                    </div>
                    <span className="text-[11px] font-bold text-[#02626D] bg-teal-50 border border-teal-100 px-2 py-0.5 rounded-full">
                      {addSelectedLines.length} Items
                    </span>
                  </div>

                  {/* Wholesaler & Date Overview */}
                  {selectedWholesaler ? (
                    <div className="p-3 bg-slate-50 border border-slate-200/90 rounded-xl space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-medium">Wholesaler:</span>
                        <span className="font-bold text-slate-900 truncate max-w-[150px]">
                          {selectedWholesaler.name || selectedWholesaler.businessName}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 font-medium">Order Date:</span>
                        <span className="font-bold text-slate-700">{orderDate}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/60">
                        <span className="text-slate-500 font-medium">Rate List:</span>
                        <span className="font-bold text-[#02626D]">
                          {selectedWholesaler.priceListName || 'Standard Rates'}
                        </span>
                      </div>
                    </div>
                  ) : null}

                  {/* Selected Items Cart List */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                      <span>Selected Products</span>
                      <span className="text-slate-400 font-normal">
                        {addTotalWeight} units total
                      </span>
                    </div>

                    {addSelectedLines.length === 0 ? (
                      <div className="py-8 text-center text-slate-400 bg-slate-50/70 rounded-xl border border-dashed border-slate-200">
                        <ShoppingBag size={20} className="mx-auto mb-1 text-slate-300" />
                        <p className="text-[11px] font-medium">Cart is empty</p>
                        <p className="text-[10px] text-slate-400">Add item quantities on the left</p>
                      </div>
                    ) : (
                      <div className="max-h-[320px] overflow-y-auto space-y-2 pr-0.5 no-scrollbar divide-y divide-slate-100">
                        {addSelectedLines.map((item) => (
                          <div key={item.itemId} className="pt-2 first:pt-0 space-y-1">
                            <div className="flex items-start justify-between gap-1.5">
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-slate-900 truncate" title={item.name}>
                                  {item.name}
                                </p>
                                <p className="text-[10px] text-slate-500">
                                  ₹{item.assignedPrice} / {item.unit}
                                </p>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleQuantityChange(item.itemId, 0)}
                                className="text-slate-400 hover:text-red-500 p-0.5 rounded transition-colors cursor-pointer shrink-0"
                                title="Remove item"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>

                            <div className="flex items-center justify-between pt-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded border ${
                                  item.needsManufacturing
                                    ? 'bg-teal-50 text-teal-800 border-teal-200'
                                    : 'bg-slate-100 text-slate-600 border-slate-200'
                                }`}>
                                  {item.needsManufacturing ? 'To Mfg' : 'In Stock'}
                                </span>

                                <span className="text-xs font-bold text-slate-800">
                                  {item.quantity} {item.unit}
                                </span>
                              </div>

                              <span className="text-xs font-black text-slate-900">
                                ₹{item.totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Section: Order Totals & Submit */}
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <div className="space-y-1.5 text-xs font-semibold">
                    <div className="flex justify-between text-slate-500">
                      <span>Total Selected Lines:</span>
                      <span className="font-bold text-slate-800">{addSelectedLines.length}</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Total Order Units:</span>
                      <span className="font-bold text-slate-800">{addTotalWeight}</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>{modalTaxCalc.taxType === 'inclusive' ? 'Subtotal (Base Price):' : 'Subtotal:'}</span>
                      <span className="font-bold text-slate-800 font-mono">
                        ₹{(modalTaxCalc.taxType === 'inclusive' ? modalTaxCalc.taxableAmount : modalSubtotal).toFixed(2)}
                      </span>
                    </div>
                    {modalTaxCalc.totalGstPercent > 0 && (
                      <>
                        <div className="flex justify-between text-slate-600 text-[11px]">
                          <span>CGST ({modalTaxCalc.cgstPercent}%):</span>
                          <span className="font-bold font-mono">
                            {modalTaxCalc.taxType === 'exclusive' ? '+₹' : '₹'}{modalTaxCalc.cgstAmount.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-600 text-[11px]">
                          <span>SGST ({modalTaxCalc.sgstPercent}%):</span>
                          <span className="font-bold font-mono">
                            {modalTaxCalc.taxType === 'exclusive' ? '+₹' : '₹'}{modalTaxCalc.sgstAmount.toFixed(2)}
                          </span>
                        </div>
                      </>
                    )}
                    <div className="flex items-baseline justify-between pt-2 border-t border-slate-200">
                      <span className="text-sm font-bold text-slate-900">Grand Total:</span>
                      <span className="text-xl font-black text-[#02626D]">
                        ₹ {modalTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 pt-1">
                    <button
                      type="button"
                      onClick={handleSaveOrder}
                      disabled={isSavingOrder || !selectedWholesaler || addSelectedLines.length === 0}
                      className="w-full h-10 rounded-xl bg-[#02626D] hover:bg-[#014d56] text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95"
                    >
                      {isSavingOrder ? (
                        <>
                          <Loader2 size={15} className="animate-spin" />
                          <span>Saving B2B Order...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={15} />
                          <span>Save &amp; Place B2B Order</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsAddModalOpen(false);
                        setSelectedWholesaler(null);
                        setOrderItems([]);
                        setAddSearchQuery('');
                        setAddCategoryFilter('All');
                        setAddShowOnlySelected(false);
                      }}
                      className="w-full h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors flex items-center justify-center cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>

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
                <span>{viewingOrder.taxType === 'inclusive' ? 'Subtotal (Base Price):' : 'Subtotal:'}</span>
                <span>₹{viewingOrder.taxableAmount ?? viewingOrder.subtotal}</span>
              </div>
              <div className="flex justify-between text-[11px] text-slate-600">
                <span>CGST ({viewingOrder.cgstPercent ?? 2.5}%):</span>
                <span>{viewingOrder.taxType === 'exclusive' ? '+₹' : '₹'}{viewingOrder.cgstAmount ?? 0}</span>
              </div>
              <div className="flex justify-between text-[11px] text-slate-600">
                <span>SGST ({viewingOrder.sgstPercent ?? 2.5}%):</span>
                <span>{viewingOrder.taxType === 'exclusive' ? '+₹' : '₹'}{viewingOrder.sgstAmount ?? 0}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-slate-900 border-t border-slate-100 pt-1">
                <span>Total Amount:</span>
                <span>₹{viewingOrder.totalAmount}</span>
              </div>
              <div className="flex justify-between text-xs text-emerald-700 font-semibold">
                <span>Total Paid:</span>
                <span>₹{viewingOrder.receivedAmount || 0}</span>
              </div>
              <div className="flex justify-between text-xs font-bold">
                <span className={Math.max(0, (Number(viewingOrder.totalAmount) || 0) - (Number(viewingOrder.receivedAmount) || 0)) > 0.01 ? 'text-rose-600' : 'text-emerald-600'}>
                  Balance Due:
                </span>
                <span className={Math.max(0, (Number(viewingOrder.totalAmount) || 0) - (Number(viewingOrder.receivedAmount) || 0)) > 0.01 ? 'text-rose-600 font-black' : 'text-emerald-600 font-semibold'}>
                  ₹{Math.max(0, (Number(viewingOrder.totalAmount) || 0) - (Number(viewingOrder.receivedAmount) || 0)).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  const targetOrder = viewingOrder;
                  setViewingOrder(null);
                  handleOpenManagePayment(targetOrder);
                }}
                className="h-8 px-3 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs cursor-pointer flex items-center justify-center gap-1"
              >
                <WalletCards size={13} />
                <span>Manage Payments</span>
              </button>
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
                <span>Mfg Items</span>
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

      {/* ── MODAL: Edit Wholesaler B2B Order (Full Screen) ─────────────────── */}
      {editingOrder && (
        <div className="fixed inset-0 z-50 bg-[#f8fafc] flex flex-col overflow-hidden animate-in fade-in duration-150 font-sans">
          <div className="w-full h-full flex flex-col overflow-hidden">
            
            {/* Header */}
            <div className="bg-white border-b border-slate-200/80 px-4 sm:px-6 py-3.5 flex items-center justify-between shrink-0 shadow-2xs">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shadow-2xs shrink-0">
                  <Pencil size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm sm:text-base font-bold text-slate-900">
                      Edit Wholesaler B2B Order
                    </h3>
                    <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">
                      {editingOrder.orderId}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {editingOrder.wholesalerName} • Price List: {editingOrder.priceListName || 'Standard Rates'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setEditingOrder(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body - 2 Columns */}
            <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-0">
              
              {/* Left Column: Wholesaler & Date + Item Catalog with Search */}
              <div className="lg:col-span-8 overflow-y-auto p-3 sm:p-4 space-y-3.5 border-b lg:border-b-0 lg:border-r border-slate-200/90 no-scrollbar">
                
                {/* 1. Wholesaler Overview & Order Date Card */}
                <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200/90 shadow-2xs space-y-3">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div className="flex-1 space-y-1">
                      <label className="block text-xs font-bold text-slate-700">Wholesaler Details:</label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">{editingOrder.wholesalerName}</span>
                        <span className="text-xs font-semibold text-slate-500 font-mono">
                          ({editingOrder.wholesalerMobile || 'No Phone'})
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs pt-0.5">
                        <span className="text-slate-500 text-[11px]">Price List:</span>
                        <span className="font-bold text-[11px] text-[#02626D] bg-teal-50 border border-teal-100 px-2 py-0.5 rounded-md">
                          {editingOrder.priceListName || 'Standard Rates'}
                        </span>
                      </div>
                    </div>

                    <div className="w-full sm:w-48 shrink-0">
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Order Date <span className="text-rose-500">*</span>
                      </label>
                      <CustomDatePicker
                        value={editOrderDate}
                        onChange={setEditOrderDate}
                        allowAll={false}
                        size="sm"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Product Items Catalog with Search Bar */}
                <div className="space-y-3">
                  {/* Search & Category Filter Toolbar */}
                  <div className="bg-white rounded-2xl p-3 sm:p-3.5 border border-slate-200/90 shadow-2xs space-y-2.5">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                      {/* Search Input */}
                      <div className="relative flex-1">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search products by name, code, or category..."
                          value={editSearchQuery}
                          onChange={(e) => setEditSearchQuery(e.target.value)}
                          className="w-full h-9 pl-9 pr-8 text-xs text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#02626D] focus:ring-2 focus:ring-[#02626D]/15 placeholder:text-slate-400 transition-all shadow-2xs"
                        />
                        {editSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setEditSearchQuery('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                          >
                            <X size={13} />
                          </button>
                        )}
                      </div>

                      {/* Selected Only Pill */}
                      <button
                        type="button"
                        onClick={() => setEditShowOnlySelected((prev) => !prev)}
                        className={`h-9 px-3 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                          editShowOnlySelected
                            ? 'bg-[#02626D] text-white border-[#02626D] shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <Check size={12} />
                        <span>Selected Only ({editSelectedLines.length})</span>
                      </button>
                    </div>

                    {/* Category Filter Pills */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar text-xs">
                      {allCategories.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setEditCategoryFilter(cat)}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                            editCategoryFilter === cat
                              ? 'bg-[#02626D] text-white shadow-2xs font-bold'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Product Cards Grid */}
                  {filteredEditItems.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
                      <Package size={28} className="mx-auto mb-1.5 text-slate-300" />
                      <p className="text-xs font-medium">No products found</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Try changing your search query or category filter</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
                      {filteredEditItems.map((line) => {
                        const isAdded = (line.quantity || 0) > 0;
                        const isMfg = Boolean(line.needsManufacturing);
                        const hasCustomPrice = line.assignedPrice !== line.standardPrice;

                        return (
                          <div
                            key={line.itemId}
                            className={`rounded-xl p-3 border transition-all duration-150 flex flex-col justify-between gap-2.5 ${
                              isAdded
                                ? 'bg-white border-[#02626D] shadow-xs ring-1 ring-[#02626D]/20'
                                : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                            }`}
                          >
                            {/* Top Details: Image + Title + Code + Rate */}
                            <div className="flex items-start gap-2.5">
                              <div className="relative w-12 h-12 rounded-lg bg-slate-50 border border-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                                {line.imageUrl ? (
                                  <Image
                                    src={line.imageUrl}
                                    alt={line.name}
                                    fill
                                    className="object-contain p-1"
                                  />
                                ) : (
                                  <Package size={20} className="text-slate-400" />
                                )}
                              </div>

                              <div className="flex-1 min-w-0">
                                <h4 className="text-xs font-bold text-slate-900 truncate" title={line.name}>
                                  {line.name}
                                </h4>
                                <p className="text-[10px] text-slate-400 font-mono truncate mt-0.5">
                                  {line.code || 'ITEM'} • {line.category || 'General'}
                                </p>

                                {/* Price Display */}
                                <div className="flex items-baseline gap-1.5 mt-1 flex-wrap">
                                  <span className="text-xs font-black text-[#02626D]">
                                    ₹{line.assignedPrice}
                                    <span className="text-[9.5px] font-normal text-slate-400 ml-0.5">/{line.unit}</span>
                                  </span>

                                  {hasCustomPrice && (
                                    <span className="text-[9.5px] text-slate-400 line-through">
                                      ₹{line.standardPrice}
                                    </span>
                                  )}

                                  {hasCustomPrice && (
                                    <span className="text-[8.5px] font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-100 px-1 rounded">
                                      B2B Rate
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Bottom Controls: Mfg Toggle + Quantity Stepper */}
                            <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                              {/* Manufacturing Toggle */}
                              <button
                                type="button"
                                onClick={() => handleToggleEditMfg(line.itemId)}
                                className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer shrink-0 ${
                                  isMfg
                                    ? 'bg-teal-50 text-teal-800 border-teal-200 hover:bg-teal-100 shadow-2xs'
                                    : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                                }`}
                                title={isMfg ? 'Will move to Manufacturing Kitchen' : 'In stock / Direct dispatch'}
                              >
                                <Factory size={11} className={isMfg ? 'text-teal-700' : 'text-slate-400'} />
                                <span>{isMfg ? 'To Mfg' : 'In Stock'}</span>
                              </button>

                              {/* Quantity Stepper */}
                              <div className="flex items-center gap-2">
                                <div className="flex items-center rounded-lg border border-slate-200 bg-white overflow-hidden shadow-2xs">
                                  <button
                                    type="button"
                                    onClick={() => handleEditQuantityChange(line.itemId, (line.quantity || 0) - (line.unit?.toUpperCase() === 'KG' ? 0.5 : 1))}
                                    className="w-6 h-6 flex items-center justify-center text-slate-500 hover:bg-slate-100 active:bg-slate-200 transition-colors cursor-pointer"
                                    title="Decrease"
                                  >
                                    <Minus size={10} />
                                  </button>
                                  <input
                                    type="number"
                                    min="0"
                                    step="any"
                                    value={line.quantity === 0 ? '' : line.quantity}
                                    onChange={(e) => handleEditQuantityChange(line.itemId, parseFloat(e.target.value) || 0)}
                                    placeholder="0"
                                    className="w-12 h-6 text-center text-xs font-bold text-slate-900 bg-transparent border-x border-slate-200 focus:outline-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleEditQuantityChange(line.itemId, (line.quantity || 0) + (line.unit?.toUpperCase() === 'KG' ? 0.5 : 1))}
                                    className="w-6 h-6 flex items-center justify-center text-[#02626D] hover:bg-teal-50 active:bg-teal-100 transition-colors cursor-pointer"
                                    title="Increase"
                                  >
                                    <Plus size={10} />
                                  </button>
                                </div>

                                <span className="text-[11px] font-black text-slate-900 min-w-[50px] text-right">
                                  ₹{line.totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Order Summary & Cart */}
              <div className="lg:col-span-4 overflow-y-auto p-4 md:p-5 bg-white flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  {/* Summary Header */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                        <ShoppingBag size={13} />
                      </div>
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Order Cart
                      </h3>
                    </div>
                    <span className="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">
                      {editSelectedLines.length} Items
                    </span>
                  </div>

                  {/* Wholesaler & Date Overview */}
                  <div className="p-3 bg-slate-50 border border-slate-200/90 rounded-xl space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">Wholesaler:</span>
                      <span className="font-bold text-slate-900 truncate max-w-[150px]">
                        {editingOrder.wholesalerName}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 font-medium">Order Date:</span>
                      <span className="font-bold text-slate-700">{editOrderDate}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/60">
                      <span className="text-slate-500 font-medium">Rate List:</span>
                      <span className="font-bold text-[#02626D]">
                        {editingOrder.priceListName || 'Standard Rates'}
                      </span>
                    </div>
                  </div>

                  {/* Selected Items Cart List */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                      <span>Selected Products</span>
                      <span className="text-slate-400 font-normal">
                        {editTotalWeight} units total
                      </span>
                    </div>

                    {editSelectedLines.length === 0 ? (
                      <div className="py-8 text-center text-slate-400 bg-slate-50/70 rounded-xl border border-dashed border-slate-200">
                        <ShoppingBag size={20} className="mx-auto mb-1 text-slate-300" />
                        <p className="text-[11px] font-medium">Cart is empty</p>
                        <p className="text-[10px] text-slate-400">Add item quantities on the left</p>
                      </div>
                    ) : (
                      <div className="max-h-[320px] overflow-y-auto space-y-2 pr-0.5 no-scrollbar divide-y divide-slate-100">
                        {editSelectedLines.map((item) => (
                          <div key={item.itemId} className="pt-2 first:pt-0 space-y-1">
                            <div className="flex items-start justify-between gap-1.5">
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-slate-900 truncate" title={item.name}>
                                  {item.name}
                                </p>
                                <p className="text-[10px] text-slate-500">
                                  ₹{item.assignedPrice} / {item.unit}
                                </p>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleEditQuantityChange(item.itemId, 0)}
                                className="text-slate-400 hover:text-red-500 p-0.5 rounded transition-colors cursor-pointer shrink-0"
                                title="Remove item"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>

                            <div className="flex items-center justify-between pt-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded border ${
                                  item.needsManufacturing
                                    ? 'bg-teal-50 text-teal-800 border-teal-200'
                                    : 'bg-slate-100 text-slate-600 border-slate-200'
                                }`}>
                                  {item.needsManufacturing ? 'To Mfg' : 'In Stock'}
                                </span>

                                <span className="text-xs font-bold text-slate-800">
                                  {item.quantity} {item.unit}
                                </span>
                              </div>

                              <span className="text-xs font-black text-slate-900">
                                ₹{item.totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Section: Order Totals & Submit */}
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <div className="space-y-1.5 text-xs font-semibold">
                    <div className="flex justify-between text-slate-500">
                      <span>Total Selected Lines:</span>
                      <span className="font-bold text-slate-800">{editSelectedLines.length}</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Total Order Units:</span>
                      <span className="font-bold text-slate-800">{editTotalWeight}</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>{editModalTaxCalc.taxType === 'inclusive' ? 'Subtotal (Base Price):' : 'Subtotal:'}</span>
                      <span className="font-bold text-slate-800 font-mono">
                        ₹{(editModalTaxCalc.taxType === 'inclusive' ? editModalTaxCalc.taxableAmount : editModalSubtotal).toFixed(2)}
                      </span>
                    </div>
                    {editModalTaxCalc.totalGstPercent > 0 && (
                      <>
                        <div className="flex justify-between text-slate-600 text-[11px]">
                          <span>CGST ({editModalTaxCalc.cgstPercent}%):</span>
                          <span className="font-bold font-mono">
                            {editModalTaxCalc.taxType === 'exclusive' ? '+₹' : '₹'}{editModalTaxCalc.cgstAmount.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-600 text-[11px]">
                          <span>SGST ({editModalTaxCalc.sgstPercent}%):</span>
                          <span className="font-bold font-mono">
                            {editModalTaxCalc.taxType === 'exclusive' ? '+₹' : '₹'}{editModalTaxCalc.sgstAmount.toFixed(2)}
                          </span>
                        </div>
                      </>
                    )}
                    <div className="flex items-baseline justify-between pt-2 border-t border-slate-200">
                      <span className="text-sm font-bold text-slate-900">Grand Total:</span>
                      <span className="text-xl font-black text-[#02626D]">
                        ₹ {editModalTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 pt-1">
                    <button
                      type="button"
                      onClick={handleSaveEditOrder}
                      disabled={isUpdatingOrder || editSelectedLines.length === 0}
                      className="w-full h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95"
                    >
                      {isUpdatingOrder ? (
                        <>
                          <Loader2 size={15} className="animate-spin" />
                          <span>Updating B2B Order...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={15} />
                          <span>Update B2B Order</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditingOrder(null)}
                      className="w-full h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors flex items-center justify-center cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>

              </div>

            </div>

          </div>
        </div>
      )}

      {/* ── MODAL: Manage Order Payments & Installments ─────────────────────── */}
      {managingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-slate-100 max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 font-sans">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shadow-2xs shrink-0">
                  <WalletCards size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">Manage Order Payments</h3>
                    <span className="font-mono text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                      {managingOrder.orderId}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {managingOrder.wholesalerName} {managingOrder.companyName ? `(${managingOrder.companyName})` : ''} • {managingOrder.wholesalerMobile}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setManagingOrder(null)}
                className="text-slate-400 hover:text-slate-700 p-1.5 cursor-pointer rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Financial Summary 3-Box Stats */}
            {(() => {
              const total = Number(managingOrder.totalAmount) || 0;
              const received = Number(managingOrder.receivedAmount) || 0;
              const balanceDue = Math.max(0, total - received);
              const percentPaid = total > 0 ? Math.min(100, Math.round((received / total) * 100)) : 0;
              const isSettled = balanceDue <= 0.01;

              return (
                <div className="py-3 border-b border-slate-100 shrink-0 space-y-2.5">
                  <div className="grid grid-cols-3 gap-2.5 text-center">
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                      <span className="block text-[10px] font-semibold text-slate-400 uppercase">Total Bill</span>
                      <span className="text-sm sm:text-base font-black text-slate-900 font-mono">
                        ₹{total.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-100">
                      <span className="block text-[10px] font-semibold text-emerald-600 uppercase">Total Paid</span>
                      <span className="text-sm sm:text-base font-black text-emerald-700 font-mono">
                        ₹{received.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div
                      className={`p-2.5 rounded-xl border ${
                        isSettled ? 'bg-emerald-50/60 border-emerald-100' : 'bg-rose-50/70 border-rose-200'
                      }`}
                    >
                      <span className={`block text-[10px] font-semibold uppercase ${isSettled ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {isSettled ? 'Balance' : 'Pending Due'}
                      </span>
                      <span
                        className={`text-sm sm:text-base font-black font-mono ${
                          isSettled ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {isSettled ? '₹0 (Settled)' : `₹${balanceDue.toLocaleString('en-IN')}`}
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-semibold">
                      <span className="text-slate-500">Payment Collection Progress</span>
                      <span className={isSettled ? 'text-emerald-600 font-bold' : 'text-slate-700'}>
                        {percentPaid}% Paid ({managingOrder.payments?.length || (received > 0 ? 1 : 0)} installments)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${isSettled ? 'bg-emerald-500' : 'bg-[#02626D]'}`}
                        style={{ width: `${percentPaid}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Scrollable Body: Past Installments + Add Installment Form */}
            <div className="flex-1 overflow-y-auto p-1 space-y-4 pr-1 my-2">
              {/* Past Installments Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Receipt size={14} className="text-slate-500" />
                    <span>Payment Installments History</span>
                  </h4>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {(managingOrder.payments || []).length} recorded
                  </span>
                </div>

                {!managingOrder.payments || managingOrder.payments.length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400 bg-slate-50/50">
                    No installment payments recorded yet for this order. Use the form below to record an installment payment.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                    {managingOrder.payments.map((inst, idx) => (
                      <div
                        key={inst.id || idx}
                        className="p-3 flex items-center justify-between gap-3 text-xs hover:bg-slate-50/60 transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 font-bold text-[10px] flex items-center justify-center shrink-0">
                            #{idx + 1}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 font-mono">
                                ₹{Number(inst.amount).toLocaleString('en-IN')}
                              </span>
                              <span className="text-[10px] font-semibold px-2 py-0.2 rounded-md bg-blue-50 text-blue-700 border border-blue-100">
                                {inst.mode}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {inst.paidAt
                                ? new Date(inst.paidAt).toLocaleString('en-IN', {
                                    dateStyle: 'medium',
                                    timeStyle: 'short',
                                  })
                                : '—'}
                              {inst.note ? ` • ${inst.note}` : ''}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteInstallment(inst.id)}
                          disabled={deletingPaymentId === inst.id}
                          className="p-1.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Void/Delete this payment"
                        >
                          {deletingPaymentId === inst.id ? (
                            <Loader2 size={13} className="animate-spin text-red-500" />
                          ) : (
                            <Trash2 size={13} />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add Payment / Installment Form */}
              {(() => {
                const total = Number(managingOrder.totalAmount) || 0;
                const received = Number(managingOrder.receivedAmount) || 0;
                const balanceDue = Math.max(0, total - received);

                if (balanceDue <= 0.01) {
                  return (
                    <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2.5 text-xs font-semibold">
                      <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                      <span>This order is fully paid. All ₹{total.toLocaleString('en-IN')} collected successfully.</span>
                    </div>
                  );
                }

                return (
                  <form
                    onSubmit={handleRecordInstallment}
                    className="p-3.5 sm:p-4 rounded-xl bg-slate-50 border border-slate-200/90 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <Plus size={14} className="text-[#02626D]" />
                        <span>Add Payment Installment</span>
                      </h4>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setInstallmentAmount(String(balanceDue))}
                          className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-white border border-slate-200 text-[#02626D] hover:bg-slate-100 cursor-pointer"
                        >
                          Full Due: ₹{balanceDue}
                        </button>
                        {balanceDue >= 1000 && (
                          <button
                            type="button"
                            onClick={() => setInstallmentAmount(String(Math.round(balanceDue / 2)))}
                            className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer"
                          >
                            50%: ₹{Math.round(balanceDue / 2)}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Installment Amount (₹) <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                            ₹
                          </span>
                          <input
                            type="number"
                            step="any"
                            min="1"
                            max={balanceDue}
                            value={installmentAmount}
                            onChange={(e) => setInstallmentAmount(e.target.value)}
                            placeholder="0.00"
                            className="w-full pl-7 pr-3 h-9 bg-white text-xs font-bold font-mono rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:border-[#02626D] focus:ring-2 focus:ring-[#02626D]/15"
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Payment Mode <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={installmentMode}
                          onChange={(e) => setInstallmentMode(e.target.value)}
                          className="w-full px-2.5 h-9 bg-white text-xs font-semibold rounded-lg border border-slate-300 text-slate-800 focus:outline-none focus:border-[#02626D] cursor-pointer"
                        >
                          <option value="UPI">UPI / GPay / PhonePe</option>
                          <option value="Cash">Cash</option>
                          <option value="Bank Transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
                          <option value="Cheque">Cheque</option>
                          <option value="Card">Debit / Credit Card</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Payment Date</label>
                        <input
                          type="date"
                          value={installmentDate}
                          onChange={(e) => setInstallmentDate(e.target.value)}
                          className="w-full px-2.5 h-9 bg-white text-xs font-semibold rounded-lg border border-slate-300 text-slate-800 focus:outline-none focus:border-[#02626D]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Note / Reference (Optional)
                      </label>
                      <input
                        type="text"
                        value={installmentNote}
                        onChange={(e) => setInstallmentNote(e.target.value)}
                        placeholder="e.g. Installment 1 - Cheque #12345 or UPI ref"
                        className="w-full px-3 h-8 bg-white text-xs rounded-lg border border-slate-300 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#02626D]"
                      />
                    </div>

                    <div className="pt-1 flex items-center justify-end gap-2">
                      <button
                        type="submit"
                        disabled={isSavingInstallment || !installmentAmount || parseFloat(installmentAmount) <= 0}
                        className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95"
                      >
                        {isSavingInstallment ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
                            <span>Recording Payment...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 size={14} />
                            <span>Record Installment Payment</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setManagingOrder(null)}
                className="h-9 px-4 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer transition-colors"
              >
                Close
              </button>
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


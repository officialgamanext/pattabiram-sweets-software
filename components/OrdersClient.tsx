'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Search,
  Download,
  Eye,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  Loader2,
  Filter,
  AlertTriangle,
  ShoppingBag,
  Calendar,
  MoreVertical,
  Clock,
  CheckCircle2,
  PackageCheck,
  Truck,
  IndianRupee,
  UserCheck,
  Tag,
  Check,
  Building2,
  UserPlus,
  Printer,
  BarChart3,
  PieChart,
  Layers,
  Boxes,
  Star,
  Minus,
} from 'lucide-react';
import CustomSelect, { CustomSelectOption } from '@/components/CustomSelect';
import CustomDatePicker from '@/components/CustomDatePicker';
import Pagination from '@/components/Pagination';
import { compressImageTo60KB, uploadToImageKit } from '@/lib/imageCompressor';
import { usePrinter } from '@/context/PrinterContext';
import { useAuth } from '@/context/AuthContext';
import { toast } from '@/context/ToastContext';
import { db } from '@/lib/firebase';
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  serverTimestamp,
} from 'firebase/firestore';

export type SlotTime =
  | '9:00 AM - 12:00 PM'
  | '12:00 PM - 3:00 PM'
  | '3:00 PM - 6:00 PM'
  | '6:00 PM - 9:00 PM';

export type OrderStatus =
  | 'Order Created'
  | 'Moved to Manufacturing'
  | 'Manufacturing Started'
  | 'Manufacturing Completed'
  | 'Moved to Packing'
  | 'Packing Started'
  | 'Packing Completed'
  | 'Moved to Store'
  | 'Received at Store'
  | 'Awaiting for Delivery'
  | 'Delivered'
  | 'Cancelled'
  | 'Rejected'
  | 'Confirmed'
  | 'Processing'
  | 'Pending';

export type PaymentStatus = 'Paid' | 'Partial' | 'Pending' | 'Completed';

export interface OrderItemLine {
  lineId?: string;
  itemId: string;
  itemCode?: string;
  itemName: string;
  category?: string;
  unit?: string;
  imageUrl?: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  hasPacket?: boolean;
  packetCharge?: number;
  manufacturingDescription?: string;
  packingDescription?: string;
  mfgStatus?: 'Pending' | 'Manufacturing Started' | 'Moved to Packing';
  pckStatus?: 'Pending' | 'Packing Started' | 'Moved to Store';
}

export interface CustomisationData {
  noOfBoxes: number;
  boxType: string;
  boxPrice: number;
  boxImageUrl?: string;
  hasShrink: boolean;
  shrinkType: string;
  shrinkPrice: number;
  hasSticker: boolean;
  stickerType: string;
  stickerPrice: number;
}

export interface OrderRecord {
  id: string;
  code: string;
  customerId: string;
  customerName: string;
  customerMobile: string;
  customerType?: 'Customer' | 'Wholesaler';
  customerAddress?: string;
  orderDate: string;
  orderTime: string;
  manufacturingDate?: string;
  expectedDeliveryDate?: string;
  slot: SlotTime;
  isCustomisation: boolean;
  customisationDetails?: CustomisationData | null;
  items: OrderItemLine[];
  totalItems?: number;
  subTotal: number;
  boxChargesTotal?: number;
  stickerChargesTotal?: number;
  shrinkChargesTotal?: number;
  packetChargesTotal?: number;
  packingCharges?: number;
  globalPackingBoxPrice?: number;
  noOfBoxes?: number;
  additionalCharges?: number;
  isTransportRequired?: boolean;
  transportCharges?: number;
  deliveryAddress?: string;
  discountAmount?: number;
  totalAmount: number;
  receivedAmount: number;
  paymentMode: 'Cash' | 'Card' | 'UPI';
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  createdAt?: any;
}

interface CustomerOption {
  id: string;
  code: string;
  name: string;
  mobile: string;
  type: 'Customer' | 'Wholesaler';
  address?: string;
  priceListName?: string;
}

interface ItemMasterOption {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  price: number;
  imageUrl?: string;
  isFavorite?: boolean;
  slotAllowedWeights?: {
    '9:00 AM - 12:00 PM'?: number | string;
    '12:00 PM - 3:00 PM'?: number | string;
    '3:00 PM - 6:00 PM'?: number | string;
    '6:00 PM - 9:00 PM'?: number | string;
  };
}

export const SLOT_TIMES: SlotTime[] = [
  '9:00 AM - 12:00 PM',
  '12:00 PM - 3:00 PM',
  '3:00 PM - 6:00 PM',
  '6:00 PM - 9:00 PM',
];

export interface SlotCategory {
  id: string;
  name: string;
  description?: string;
  color?: string;
  assignedItemIds: string[];
  assignedItemNames: string[];
  slotLimits: Record<string, number>;
  status: 'active' | 'inactive';
}

export interface UtilityOption {
  id: string;
  type: 'box' | 'shrink' | 'sticker';
  name: string;
  price: number;
  status: 'Active' | 'Inactive';
}

const ALL_ORDER_STATUSES: OrderStatus[] = [
  'Order Created',
  'Moved to Manufacturing',
  'Manufacturing Started',
  'Manufacturing Completed',
  'Moved to Packing',
  'Packing Started',
  'Packing Completed',
  'Moved to Store',
  'Received at Store',
  'Awaiting for Delivery',
  'Delivered',
  'Confirmed',
  'Processing',
  'Pending',
];

export function getOrderStatusBadgeStyle(status?: string) {
  switch (status || '') {
    case 'Order Created':
      return { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' };
    case 'Moved to Manufacturing':
      return { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' };
    case 'Manufacturing Started':
      return { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' };
    case 'Manufacturing Completed':
      return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
    case 'Moved to Packing':
      return { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' };
    case 'Packing Started':
      return { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' };
    case 'Packing Completed':
      return { bg: 'bg-fuchsia-50', text: 'text-fuchsia-700', border: 'border-fuchsia-200' };
    case 'Moved to Store':
      return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' };
    case 'Received at Store':
      return { bg: 'bg-yellow-50', text: 'text-yellow-800', border: 'border-yellow-200' };
    case 'Awaiting for Delivery':
      return { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' };
    case 'Delivered':
      return { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' };
    case 'Confirmed':
      return { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' };
    case 'Processing':
      return { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' };
    case 'Pending':
      return { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' };
    default:
      return { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' };
  }
}

export default function OrdersClient() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'slot' | 'list'>('slot');
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [customersMaster, setCustomersMaster] = useState<CustomerOption[]>([]);
  const [itemsMaster, setItemsMaster] = useState<ItemMasterOption[]>([]);
  const [utilitiesMaster, setUtilitiesMaster] = useState<UtilityOption[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [firebaseError, setFirebaseError] = useState<string | null>(null);

  const getTodayDateStr = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('All');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('All');
  const [itemsPerPage, setItemsPerPage] = useState('10');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateStr());
  const [slotCategories, setSlotCategories] = useState<SlotCategory[]>([]);
  const { user, employeeProfile } = useAuth();
  const { isConnected: isPrinterConnected, printerType, printReceipt } = usePrinter();

  // Slot Analytics Modal State
  const [selectedSlotForAnalytics, setSelectedSlotForAnalytics] = useState<string | null>(null);
  const [isSlotAnalyticsModalOpen, setIsSlotAnalyticsModalOpen] = useState(false);
  const [slotAnalyticsSearchTerm, setSlotAnalyticsSearchTerm] = useState('');

  // Helper to remove any undefined fields before writing to Firestore
  const sanitizeForFirestore = (obj: any): any => {
    if (obj === undefined) return null;
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) {
      return obj.map(sanitizeForFirestore);
    }
    const clean: any = {};
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (val !== undefined) {
        clean[key] = sanitizeForFirestore(val);
      }
    }
    return clean;
  };

  const handlePrintOrderSlip = async (order: OrderRecord) => {
    if (!order) return;
    const orderItems = (order.items || []).map((it: any) => {
      const qty = parseFloat(it.quantity || it.qty || 1) || 1;
      let price = parseFloat(it.price || it.rate || it.itemPrice || it.unitPrice || 0) || 0;
      let total = parseFloat(it.amount || it.total || it.subTotal || it.itemTotal || 0) || 0;
      if (!total && price > 0) total = price * qty;
      if (!price && total > 0 && qty > 0) price = total / qty;
      return {
        name: it.itemName || it.name || it.item || 'Item',
        qty: qty,
        unit: it.unit || 'kg',
        price: price,
        total: total || (price * qty),
      };
    });

    if (isPrinterConnected && (printerType === 'USB' || printerType === 'Bluetooth')) {
      await printReceipt({
        storeName: 'PATTABIRAM SWEETS',
        storeAddress: '12, Main Road, Pattabiram, Chennai - 600072',
        storePhone: '+91 98765 43210',
        billNo: order.code || (order as any).orderId || order.id,
        customerName: order.customerName,
        customerPhone: order.customerMobile,
        dateStr: order.orderDate,
        timeStr: order.orderTime,
        slot: order.slot,
        deliveryDate: order.expectedDeliveryDate || order.manufacturingDate,
        orderType: order.isCustomisation ? 'Custom Box Order' : 'Standard Order',
        paymentMode: order.paymentMode,
        paymentStatus: order.paymentStatus,
        items: orderItems,
        subtotal: order.subTotal || order.totalAmount,
        discount: order.discountAmount || 0,
        tax: 0,
        boxCharges: order.boxChargesTotal || 0,
        boxDetails: order.isCustomisation && order.customisationDetails?.noOfBoxes ? `${order.customisationDetails.noOfBoxes}xRs.${order.customisationDetails.boxPrice || 0}` : undefined,
        stickerCharges: order.stickerChargesTotal || 0,
        shrinkCharges: order.shrinkChargesTotal || 0,
        packetCharges: order.packetChargesTotal || 0,
        packingCharges: order.packingCharges || 0,
        additionalCharges: order.additionalCharges || 0,
        grandTotal: order.totalAmount,
        footerNote: 'Order verified & recorded. Thank you!',
      });
    } else {
      toast.warning('Printer Not Connected', `Please connect USB/Bluetooth printer in the top Header to print ${order.code || 'Order'}.`);
    }
  };

  const getOrderDateStr = (order: OrderRecord): string => {
    if (order.orderDate && /^\d{4}-\d{2}-\d{2}$/.test(order.orderDate)) {
      return order.orderDate;
    }

    if (order.createdAt) {
      let d: Date | null = null;
      if (typeof order.createdAt.toDate === 'function') {
        d = order.createdAt.toDate();
      } else if (order.createdAt.seconds) {
        d = new Date(order.createdAt.seconds * 1000);
      } else if (typeof order.createdAt === 'string' || typeof order.createdAt === 'number') {
        d = new Date(order.createdAt);
      }
      if (d && !isNaN(d.getTime())) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    }

    if (order.orderDate) {
      const parsed = new Date(order.orderDate);
      if (!isNaN(parsed.getTime())) {
        const year = parsed.getFullYear();
        const month = String(parsed.getMonth() + 1).padStart(2, '0');
        const day = String(parsed.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    }

    if (order.code && order.code.startsWith('#ORD-')) {
      const parts = order.code.split('-');
      if (parts.length >= 2 && parts[1].length === 6) {
        const yy = parts[1].slice(0, 2);
        const mm = parts[1].slice(2, 4);
        const dd = parts[1].slice(4, 6);
        return `20${yy}-${mm}-${dd}`;
      }
    }

    return getTodayDateStr();
  };

  const handlePrevDate = () => {
    const baseDate = selectedDate && selectedDate !== 'All' ? new Date(selectedDate + 'T00:00:00') : new Date();
    if (isNaN(baseDate.getTime())) return;
    baseDate.setDate(baseDate.getDate() - 1);
    const y = baseDate.getFullYear();
    const m = String(baseDate.getMonth() + 1).padStart(2, '0');
    const d = String(baseDate.getDate()).padStart(2, '0');
    setSelectedDate(`${y}-${m}-${d}`);
  };

  const handleNextDate = () => {
    const baseDate = selectedDate && selectedDate !== 'All' ? new Date(selectedDate + 'T00:00:00') : new Date();
    if (isNaN(baseDate.getTime())) return;
    baseDate.setDate(baseDate.getDate() + 1);
    const y = baseDate.getFullYear();
    const m = String(baseDate.getMonth() + 1).padStart(2, '0');
    const d = String(baseDate.getDate()).padStart(2, '0');
    setSelectedDate(`${y}-${m}-${d}`);
  };

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr || dateStr === 'All') return 'All Dates';
    const todayStr = getTodayDateStr();
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return dateStr;
    const formatted = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    if (dateStr === todayStr) {
      return `Today (${formatted})`;
    }
    return formatted;
  };

  // Modals state
  const [isAddOrderModalOpen, setIsAddOrderModalOpen] = useState(false);
  const [isAddItemSelectorOpen, setIsAddItemSelectorOpen] = useState(false);
  const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false);
  // Navigation to order detail page
  const navigateToOrder = (orderId: string) => router.push(`/orders/${orderId}`);
  const [deletingOrder, setDeletingOrder] = useState<OrderRecord | null>(null);
  const [updatingStatusOrder, setUpdatingStatusOrder] = useState<OrderRecord | null>(null);

  // New Order Form State
  const [orderSlot, setOrderSlot] = useState<SlotTime>('9:00 AM - 12:00 PM');
  const [mfgDate, setMfgDate] = useState<string>('');
  const [expDeliveryDate, setExpDeliveryDate] = useState<string>('');
  const [isCustomisation, setIsCustomisation] = useState<boolean>(false);
  const [noOfBoxes, setNoOfBoxes] = useState<number | string>('');
  const [boxType, setBoxType] = useState<string>('HandleBox');
  const [boxImageUrl, setBoxImageUrl] = useState<string>('');
  const [shrinkType, setShrinkType] = useState<string>('None');
  const [stickerType, setStickerType] = useState<string>('None');
  const [packingCharges, setPackingCharges] = useState<string>('');
  const [additionalCharges, setAdditionalCharges] = useState<string>('');
  const [discountAmount, setDiscountAmount] = useState<string>('');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [orderItems, setOrderItems] = useState<OrderItemLine[]>([]);
  const [receivedAmount, setReceivedAmount] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'Card' | 'UPI'>('UPI');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('Pending');
  const [orderStatus, setOrderStatus] = useState<OrderStatus>('Order Created');

  // Add Customer Modal Inline Form State
  const [newCustomerForm, setNewCustomerForm] = useState({
    name: '',
    mobileNumber: '',
    email: '',
    address: '',
    status: 'Active' as 'Active' | 'Inactive',
  });

  // Product Selector Modal States
  const [targetRowIdForModal, setTargetRowIdForModal] = useState<string | null>(null);
  const [productSearchQuery, setProductSearchQuery] = useState<string>('');
  const [isUploadingBoxImage, setIsUploadingBoxImage] = useState<boolean>(false);

  // Open Product Selector Modal (targetRowId null means adding new item row)
  const handleOpenProductModal = (targetRowId: string | null = null) => {
    setTargetRowIdForModal(targetRowId);
    setProductSearchQuery('');
    setIsAddItemSelectorOpen(true);
  };

  // Confirm Product Selection from Modal
  const handleSelectProductFromModal = (prod: ItemMasterOption) => {
    if (targetRowIdForModal) {
      // Swapping / editing existing row
      setOrderItems((prev) =>
        prev.map((item, idx) => {
          const currentKey = item.lineId || `${item.itemId}-${idx}`;
          if (currentKey !== targetRowIdForModal) return item;
          return {
            ...item,
            itemId: prod.id,
            itemCode: prod.code,
            itemName: prod.name,
            category: prod.category,
            unit: prod.unit,
            imageUrl: prod.imageUrl || '',
            unitPrice: prod.price,
            quantity: item.quantity || 1,
            lineTotal: Math.round((item.quantity || 1) * prod.price * 100) / 100,
          };
        })
      );
    } else {
      // Adding new row to item table (always generate unique lineId)
      const uniqueLineId = `line-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const newLine: OrderItemLine = {
        lineId: uniqueLineId,
        itemId: prod.id,
        itemCode: prod.code,
        itemName: prod.name,
        category: prod.category,
        unit: prod.unit,
        imageUrl: prod.imageUrl || '',
        unitPrice: prod.price,
        quantity: 0,
        lineTotal: 0,
        hasPacket: false,
        packetCharge: 0,
        manufacturingDescription: '',
        packingDescription: '',
      };
      setOrderItems((prev) => [...prev, newLine]);
    }

    setIsAddItemSelectorOpen(false);
  };

  // Product Catalog Grid States in Create Order Modal
  const [productGridSearch, setProductGridSearch] = useState('');
  const [productGridCategory, setProductGridCategory] = useState('All');
  const [productGridOnlyFavorites, setProductGridOnlyFavorites] = useState(false);

  // Unique categories for filtering tiles
  const productCategories = useMemo(() => {
    const cats = Array.from(new Set(itemsMaster.map((i) => i.category).filter(Boolean)));
    return ['All', ...cats];
  }, [itemsMaster]);

  // Filtered and Sorted products for the in-modal Product Tile Grid (Favourites FIRST)
  const filteredProductTiles = useMemo(() => {
    let list = [...itemsMaster];

    if (productGridSearch.trim()) {
      const q = productGridSearch.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
      );
    }

    if (productGridCategory !== 'All') {
      list = list.filter((p) => p.category === productGridCategory);
    }

    if (productGridOnlyFavorites) {
      list = list.filter((p) => p.isFavorite);
    }

    // Sort: Favourites ALWAYS first, then by product name
    list.sort((a, b) => {
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      return a.name.localeCompare(b.name);
    });

    return list;
  }, [itemsMaster, productGridSearch, productGridCategory, productGridOnlyFavorites]);

  // Toggle product addition from tile click (useCallback for instant click performance)
  const handleToggleTileProduct = useCallback((prod: ItemMasterOption) => {
    setOrderItems((prev) => {
      const existingIndex = prev.findIndex((it) => it.itemId === prod.id);
      if (existingIndex >= 0) {
        return prev.filter((it) => it.itemId !== prod.id);
      } else {
        const uniqueLineId = `line-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const newLine: OrderItemLine = {
          lineId: uniqueLineId,
          itemId: prod.id,
          itemCode: prod.code,
          itemName: prod.name,
          category: prod.category,
          unit: prod.unit || 'KG',
          imageUrl: prod.imageUrl || '',
          unitPrice: prod.price,
          quantity: 1,
          lineTotal: prod.price * 1,
          hasPacket: false,
          packetCharge: 0,
          manufacturingDescription: '',
          packingDescription: '',
        };
        return [...prev, newLine];
      }
    });
  }, []);

  // Quick increment/decrement quantity on product tile (useCallback for instant click performance)
  const handleTileQuantityChange = useCallback((prodId: string, delta: number) => {
    setOrderItems((prev) => {
      const existing = prev.find((it) => it.itemId === prodId);
      if (!existing) {
        const prod = itemsMaster.find((p) => p.id === prodId);
        if (!prod) return prev;
        const uniqueLineId = `line-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        return [
          ...prev,
          {
            lineId: uniqueLineId,
            itemId: prod.id,
            itemCode: prod.code,
            itemName: prod.name,
            category: prod.category,
            unit: prod.unit || 'KG',
            imageUrl: prod.imageUrl || '',
            unitPrice: prod.price,
            quantity: 1,
            lineTotal: prod.price * 1,
            hasPacket: false,
            packetCharge: 0,
            manufacturingDescription: '',
            packingDescription: '',
          },
        ];
      }

      const nextQty = Math.max(0, Math.round(((existing.quantity || 0) + delta) * 10) / 10);
      if (nextQty === 0) {
        return prev.filter((it) => it.itemId !== prodId);
      }

      return prev.map((it) => {
        if (it.itemId === prodId) {
          return {
            ...it,
            quantity: nextQty,
            lineTotal: Math.round(nextQty * it.unitPrice * 100) / 100,
          };
        }
        return it;
      });
    });
  }, [itemsMaster]);

  // Update line field directly from tile (useCallback for instant keystroke performance)
  const handleTileFieldChange = useCallback((
    prodId: string,
    field: 'quantity' | 'unitPrice' | 'mfgDesc' | 'pckDesc' | 'hasPacket',
    val: any
  ) => {
    setOrderItems((prev) =>
      prev.map((item) => {
        if (item.itemId !== prodId) return item;

        let qty = item.quantity;
        let price = item.unitPrice;
        let mfgDesc = item.manufacturingDescription;
        let pckDesc = item.packingDescription;
        let packet = item.hasPacket;

        if (field === 'quantity') qty = val === '' ? 0 : Math.max(0, parseFloat(val) || 0);
        if (field === 'unitPrice') price = Math.max(0, parseFloat(val) || 0);
        if (field === 'mfgDesc') mfgDesc = val;
        if (field === 'pckDesc') pckDesc = val;
        if (field === 'hasPacket') packet = Boolean(val);

        return {
          ...item,
          quantity: qty,
          unitPrice: price,
          lineTotal: Math.round(qty * price * 100) / 100,
          manufacturingDescription: mfgDesc,
          packingDescription: pckDesc,
          hasPacket: packet,
          packetCharge: packet ? 5 : 0,
        };
      })
    );
  }, []);

  // Filter products for Product Modal (Favourites sorted first)
  const filteredProductMasterForModal = useMemo(() => {
    let list = [...itemsMaster];
    if (productSearchQuery.trim()) {
      const q = productSearchQuery.toLowerCase().trim();
      list = list.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.code.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [itemsMaster, productSearchQuery]);

  const [boxImageFile, setBoxImageFile] = useState<File | null>(null);

  // Handle local image file selection for Customisation Box (preview only, upload on order creation)
  const handleBoxImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBoxImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setBoxImageUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // 1. Subscribe to Orders collection from Firebase Firestore
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'orders')),
      (snapshot) => {
        const fetched: OrderRecord[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<OrderRecord, 'id'>),
        }));

        // Sort orders so the newest created orders always appear first at the top
        fetched.sort((a, b) => {
          const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.orderDate || 0).getTime() || 0);
          const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.orderDate || 0).getTime() || 0);
          if (timeB !== timeA) return timeB - timeA;
          return (b.code || '').localeCompare(a.code || '');
        });

        setOrders(fetched);
        setIsLoading(false);
        setFirebaseError(null);
      },
      (err) => {
        console.error('Error fetching orders:', err);
        setFirebaseError(err.message || 'Failed to fetch orders');
        setIsLoading(false);
      }
    );

    return () => unsub();
  }, []);

  // 2. Subscribe to Customers & Wholesalers collections to populate customer search
  useEffect(() => {
    const unsubCust = onSnapshot(query(collection(db, 'customers')), (snap) => {
      const custs: CustomerOption[] = snap.docs.map((d) => ({
        id: d.id,
        code: d.data().code || 'CUST-000',
        name: d.data().name || 'Unnamed Customer',
        mobile: d.data().mobileNumber || '',
        type: 'Customer',
        address: d.data().address || '',
      }));

      onSnapshot(query(collection(db, 'wholesalers')), (wSnap) => {
        const wholes: CustomerOption[] = wSnap.docs.map((d) => ({
          id: d.id,
          code: d.data().code || 'WHL-000',
          name: d.data().name || d.data().businessName || 'Wholesaler',
          mobile: d.data().personalMobile || d.data().businessMobile || '',
          type: 'Wholesaler',
          address: d.data().address || '',
          priceListName: d.data().priceListName || '',
        }));

        setCustomersMaster([...custs, ...wholes]);
      });
    });

    return () => unsubCust();
  }, []);

  // 3. Subscribe to Items collection to populate product items selector
  useEffect(() => {
    const unsubItems = onSnapshot(query(collection(db, 'items')), (snap) => {
      const items: ItemMasterOption[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          code: data.code || 'ITM-000',
          name: data.name || 'Unnamed Item',
          category: data.category || 'General',
          unit: data.unit || 'KG',
          price: parseFloat(data.price || 0),
          imageUrl: data.imageUrl || '',
          isFavorite: Boolean(data.isFavorite),
          slotAllowedWeights: data.slotAllowedWeights || undefined,
        };
      });
      items.sort((a, b) => {
        if (a.isFavorite && !b.isFavorite) return -1;
        if (!a.isFavorite && b.isFavorite) return 1;
        return a.name.localeCompare(b.name);
      });
      setItemsMaster(items);
    });

    return () => unsubItems();
  }, []);

  // 4. Subscribe to Utilities collection (Boxes, Shrink, Stickers)
  useEffect(() => {
    const unsubUtils = onSnapshot(query(collection(db, 'utilities')), (snap) => {
      const list: UtilityOption[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<UtilityOption, 'id'>),
      }));
      setUtilitiesMaster(list);
    });

    return () => unsubUtils();
  }, []);

  // Global utilities settings
  const [globalSettings, setGlobalSettings] = useState<{ individualItemPackingCost: number; globalPackingBoxPrice: number }>({
    individualItemPackingCost: 5,
    globalPackingBoxPrice: 0,
  });

  useEffect(() => {
    const unsubGlobal = onSnapshot(doc(db, 'utilities', 'global_settings'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setGlobalSettings({
          individualItemPackingCost: typeof data.individualItemPackingCost === 'number' ? data.individualItemPackingCost : (parseFloat(data.individualItemPackingCost) || 5),
          globalPackingBoxPrice: typeof data.globalPackingBoxPrice === 'number' ? data.globalPackingBoxPrice : (parseFloat(data.globalPackingBoxPrice) || 0),
        });
      }
    });

    const unsubSlotCats = onSnapshot(collection(db, 'slot_categories'), (snap) => {
      const list: SlotCategory[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name || 'Unnamed Category',
          description: data.description || '',
          color: data.color || '#02626D',
          assignedItemIds: Array.isArray(data.assignedItemIds) ? data.assignedItemIds : [],
          assignedItemNames: Array.isArray(data.assignedItemNames) ? data.assignedItemNames : [],
          slotLimits: data.slotLimits || {},
          status: data.status || 'active',
        };
      });
      setSlotCategories(list.filter((c) => c.status === 'active'));
    });

    return () => {
      unsubGlobal();
      unsubSlotCats();
    };
  }, []);

  // Compute active utilities lists (strictly manually created in Utilities setup)
  const activeBoxes = useMemo(() => {
    return utilitiesMaster.filter((u) => u.type === 'box' && u.status === 'Active');
  }, [utilitiesMaster]);

  const activeShrinks = useMemo(() => {
    return utilitiesMaster.filter((u) => u.type === 'shrink' && u.status === 'Active');
  }, [utilitiesMaster]);

  const activeStickers = useMemo(() => {
    return utilitiesMaster.filter((u) => u.type === 'sticker' && u.status === 'Active');
  }, [utilitiesMaster]);

  const [editingOrder, setEditingOrder] = useState<OrderRecord | null>(null);

  // Open Full Screen Add Order Modal for a specific Slot
  const handleOpenAddOrderModal = (slot: SlotTime = '9:00 AM - 12:00 PM') => {
    setEditingOrder(null);
    setOrderSlot(slot);
    setMfgDate('');
    setExpDeliveryDate('');
    setIsCustomisation(false);
    setNoOfBoxes('');
    setBoxType(activeBoxes[0]?.name || 'HandleBox');
    setBoxImageFile(null);
    setBoxImageUrl('');
    setShrinkType('None');
    setStickerType('None');
    setPackingCharges('');
    setAdditionalCharges('');
    setDiscountAmount('');
    setSelectedCustomer(null);
    setCustomerSearchTerm('');
    setOrderItems([]);
    setReceivedAmount('');
    setPaymentMode('UPI');
    setPaymentStatus('Pending');
    setOrderStatus('Order Created');
    setIsAddOrderModalOpen(true);
  };

  // Open Edit Order Page
  const handleOpenEditOrderModal = (order: OrderRecord) => {
    router.push(`/orders/create?editId=${order.id}`);
  };

  // Inline Quick Add New Customer
  const handleSaveQuickCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerForm.name || !newCustomerForm.mobileNumber) return;

    try {
      setIsSubmitting(true);
      const nextCode = `CUST-${String(customersMaster.length + 1).padStart(3, '0')}`;

      const docRef = await addDoc(collection(db, 'customers'), {
        code: nextCode,
        name: newCustomerForm.name,
        mobileNumber: newCustomerForm.mobileNumber,
        email: newCustomerForm.email,
        address: newCustomerForm.address,
        status: newCustomerForm.status,
        createdAt: serverTimestamp(),
      });

      const newlyCreatedCustomer: CustomerOption = {
        id: docRef.id,
        code: nextCode,
        name: newCustomerForm.name,
        mobile: newCustomerForm.mobileNumber,
        type: 'Customer',
        address: newCustomerForm.address,
      };

      // Automatically select newly created customer
      setSelectedCustomer(newlyCreatedCustomer);
      setCustomerSearchTerm(`${newlyCreatedCustomer.name} (${newlyCreatedCustomer.mobile})`);
      setIsAddCustomerModalOpen(false);
      setNewCustomerForm({
        name: '',
        mobileNumber: '',
        email: '',
        address: '',
        status: 'Active',
      });
      toast.success('Customer Created', `Customer "${newlyCreatedCustomer.name}" added successfully.`);
    } catch (err: any) {
      console.error('Failed to quick add customer:', err);
      toast.error('Customer Creation Failed', 'Failed to save customer. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Item Quantity & Price Changes in Order Table
  const handleItemLineChange = (
    targetLineKey: string,
    field: 'quantity' | 'unitPrice' | 'mfgDesc' | 'pckDesc' | 'hasPacket',
    val: any
  ) => {
    setOrderItems((prev) =>
      prev.map((item, idx) => {
        const currentKey = item.lineId || `${item.itemId}-${idx}`;
        if (currentKey !== targetLineKey) return item;

        let qty = item.quantity;
        let price = item.unitPrice;
        let mfgDesc = item.manufacturingDescription;
        let pckDesc = item.packingDescription;
        let packet = item.hasPacket;

        if (field === 'quantity') qty = val === '' ? 0 : Math.max(0, parseFloat(val) || 0);
        if (field === 'unitPrice') price = Math.max(0, parseFloat(val) || 0);
        if (field === 'mfgDesc') mfgDesc = val;
        if (field === 'pckDesc') pckDesc = val;
        if (field === 'hasPacket') packet = Boolean(val);

        return {
          ...item,
          quantity: qty,
          unitPrice: price,
          lineTotal: Math.round(qty * price * 100) / 100,
          manufacturingDescription: mfgDesc,
          packingDescription: pckDesc,
          hasPacket: packet,
          packetCharge: packet ? 5 : 0,
        };
      })
    );
  };

  // Remove Item line
  const handleRemoveItemLine = (targetLineKey: string) => {
    setOrderItems((prev) =>
      prev.filter((i, idx) => {
        const currentKey = i.lineId || `${i.itemId}-${idx}`;
        return currentKey !== targetLineKey;
      })
    );
  };

  // Order Dynamic Calculations based on Utilities Setup
  const selectedBoxObj = activeBoxes.find((b) => b.name.toLowerCase() === (boxType || '').toLowerCase()) || activeBoxes[0];
  const selectedBoxPrice = selectedBoxObj ? selectedBoxObj.price : 0;

  const selectedShrinkObj = activeShrinks.find((s) => s.name.toLowerCase() === (shrinkType || '').toLowerCase());
  const selectedShrinkPrice = selectedShrinkObj ? selectedShrinkObj.price : 0;

  const selectedStickerObj = activeStickers.find((st) => st.name.toLowerCase() === (stickerType || '').toLowerCase());
  const selectedStickerPrice = selectedStickerObj ? selectedStickerObj.price : 0;

  const numericNoOfBoxes = typeof noOfBoxes === 'number' ? noOfBoxes : (parseInt(String(noOfBoxes)) || 0);

  const subTotal = orderItems.reduce((acc, curr) => acc + curr.lineTotal, 0);

  // Packet charges: ₹ per box for each item line where packet is selected (ONLY when Customisation is enabled!)
  const packetCostPerBox = globalSettings.individualItemPackingCost;
  const packetChargesTotal = isCustomisation
    ? orderItems.reduce((acc, curr) => acc + (curr.hasPacket ? Math.max(0, numericNoOfBoxes) * packetCostPerBox : 0), 0)
    : 0;

  const boxChargesTotal = isCustomisation ? Math.max(0, numericNoOfBoxes) * selectedBoxPrice : 0;
  const stickerChargesTotal = isCustomisation && stickerType !== 'None' ? Math.max(0, numericNoOfBoxes) * selectedStickerPrice : 0;
  const shrinkChargesTotal = isCustomisation && shrinkType !== 'None' ? Math.max(0, numericNoOfBoxes) * selectedShrinkPrice : 0;

  const pCharges = !isCustomisation ? Math.max(0, numericNoOfBoxes) * globalSettings.globalPackingBoxPrice : 0;
  const addCharges = !isCustomisation ? parseFloat(additionalCharges) || 0 : 0;
  const discountVal = parseFloat(discountAmount) || 0;

  const grandTotal = isCustomisation
    ? Math.max(0, subTotal + boxChargesTotal + stickerChargesTotal + shrinkChargesTotal + packetChargesTotal - discountVal)
    : Math.max(0, subTotal + pCharges + addCharges - discountVal);

  // Automatically compute Payment Status based on received amount vs grand total
  useEffect(() => {
    const recv = parseFloat(receivedAmount) || 0;
    if (recv <= 0) {
      setPaymentStatus('Pending');
    } else if (recv >= grandTotal && grandTotal > 0) {
      setPaymentStatus('Completed');
    } else {
      setPaymentStatus('Partial');
    }
  }, [receivedAmount, grandTotal]);

  // Submit & Save Order to Firebase Firestore
  const handleCreateOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) {
      toast.warning('Customer Required', 'Please search and select a customer or wholesaler.');
      return;
    }
    if (orderItems.length === 0) {
      toast.warning('Items Required', 'Please add at least one item to the order.');
      return;
    }

    const validItems = orderItems.filter((i) => i.itemName.trim().length > 0);
    if (validItems.length === 0) {
      toast.warning('Invalid Items', 'Please select a valid product for at least one item row.');
      return;
    }

    const missingQtyItem = validItems.find((i) => !i.quantity || i.quantity <= 0);
    if (missingQtyItem) {
      toast.warning('Quantity Required', `Please enter a valid quantity for "${missingQtyItem.itemName}".`);
      return;
    }

    const recv = parseFloat(receivedAmount) || 0;
    if (recv > grandTotal) {
      toast.error('Invalid Payment Amount', `Received amount (₹${recv}) cannot exceed the order total of ₹${grandTotal.toFixed(2)}.`);
      return;
    }

    if (!mfgDate) {
      toast.warning('Date Required', 'Please select a Manufacturing Date.');
      return;
    }
    if (!expDeliveryDate) {
      toast.warning('Date Required', 'Please select an Expected Delivery Date.');
      return;
    }

    const isTuesdayDate = (dateStr: string) => {
      if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
      const [y, m, d] = dateStr.split('-').map(Number);
      return new Date(y, m - 1, d).getDay() === 2;
    };

    if (isTuesdayDate(mfgDate)) {
      toast.warning('Tuesday Blocked', 'Manufacturing Date cannot fall on Tuesday (Factory Closed).');
      return;
    }
    if (isTuesdayDate(expDeliveryDate)) {
      toast.warning('Tuesday Blocked', 'Expected Delivery Date cannot fall on Tuesday (Store Closed).');
      return;
    }

    try {
      setIsSubmitting(true);
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      // Generate Order Code e.g. #ORD-250529-001
      const orderCount = orders.length + 1;
      const orderCode = `#ORD-${now.getFullYear().toString().slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(orderCount).padStart(3, '0')}`;

      // Upload Box Image to ImageKit ONLY on Order Creation if image is present
      let finalBoxImageUrl = boxImageUrl;
      if (isCustomisation && boxImageFile) {
        try {
          const base64 = await compressImageTo60KB(boxImageFile);
          const fileName = `box_pkg_${Date.now()}_${boxImageFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
          finalBoxImageUrl = await uploadToImageKit(base64, fileName);
        } catch (imgErr) {
          console.warn('Failed box image upload to ImageKit on submit, using preview URL fallback:', imgErr);
        }
      } else if (isCustomisation && boxImageUrl && boxImageUrl.startsWith('data:')) {
        try {
          finalBoxImageUrl = await uploadToImageKit(boxImageUrl, `box_pkg_${Date.now()}.png`);
        } catch (imgErr) {
          console.warn('Fallback saving box image URL:', imgErr);
        }
      }

      const creatorName = employeeProfile?.name || (user?.email ? user.email.split('@')[0] : 'Staff');
      const creatorId = employeeProfile?.id || employeeProfile?.empId || user?.uid || 'staff';
      const creatorRole = employeeProfile?.isSuperAdmin || (user?.email && !employeeProfile) ? 'SuperAdmin' : 'Employee';
      const savedNoOfBoxes = numericNoOfBoxes;

      if (editingOrder) {
        // Update existing order
        await updateDoc(doc(db, 'orders', editingOrder.id), sanitizeForFirestore({
          code: editingOrder.code,
          customerName: selectedCustomer.name,
          customerMobile: selectedCustomer.mobile,
          customerId: selectedCustomer.id,
          customerType: selectedCustomer.type,
          slot: orderSlot,
          orderTime: editingOrder.orderTime || timeStr,
          orderDate: editingOrder.orderDate || (selectedDate && selectedDate !== 'All' ? selectedDate : getTodayDateStr()),
          manufacturingDate: mfgDate,
          expectedDeliveryDate: expDeliveryDate,
          isCustomisation: isCustomisation,
          customisationDetails: isCustomisation
            ? {
                noOfBoxes: savedNoOfBoxes,
                boxType: selectedBoxObj?.name || boxType,
                boxPrice: selectedBoxPrice,
                boxImageUrl: finalBoxImageUrl,
                shrinkType: shrinkType,
                shrinkPrice: selectedShrinkPrice,
                hasShrink: shrinkType !== 'None' && selectedShrinkPrice > 0,
                stickerType: stickerType,
                stickerPrice: selectedStickerPrice,
                hasSticker: stickerType !== 'None' && selectedStickerPrice > 0,
              }
            : null,
          items: validItems,
          totalItems: validItems.length,
          subTotal: subTotal,
          noOfBoxes: savedNoOfBoxes,
          boxChargesTotal: isCustomisation ? boxChargesTotal : 0,
          stickerChargesTotal: isCustomisation ? stickerChargesTotal : 0,
          shrinkChargesTotal: isCustomisation ? shrinkChargesTotal : 0,
          packetChargesTotal: packetChargesTotal,
          packingCharges: !isCustomisation ? pCharges : 0,
          additionalCharges: !isCustomisation ? addCharges : 0,
          discountAmount: discountVal,
          totalAmount: grandTotal,
          receivedAmount: parseFloat(receivedAmount) || 0,
          paymentMode: paymentMode,
          paymentStatus: paymentStatus,
          orderStatus: orderStatus,
          updatedAt: serverTimestamp(),
        }));
      } else {
        // Create new order
        const targetOrderDate = selectedDate && selectedDate !== 'All' ? selectedDate : getTodayDateStr();
        await addDoc(collection(db, 'orders'), sanitizeForFirestore({
          code: orderCode,
          customerName: selectedCustomer.name,
          customerMobile: selectedCustomer.mobile,
          customerId: selectedCustomer.id,
          customerType: selectedCustomer.type,
          slot: orderSlot,
          orderTime: timeStr,
          orderDate: targetOrderDate,
          manufacturingDate: mfgDate,
          expectedDeliveryDate: expDeliveryDate,
          isCustomisation: isCustomisation,
          customisationDetails: isCustomisation
            ? {
                noOfBoxes: savedNoOfBoxes,
                boxType: selectedBoxObj?.name || boxType,
                boxPrice: selectedBoxPrice,
                boxImageUrl: finalBoxImageUrl,
                shrinkType: shrinkType,
                shrinkPrice: selectedShrinkPrice,
                hasShrink: shrinkType !== 'None' && selectedShrinkPrice > 0,
                stickerType: stickerType,
                stickerPrice: selectedStickerPrice,
                hasSticker: stickerType !== 'None' && selectedStickerPrice > 0,
              }
            : null,
          items: validItems,
          totalItems: validItems.length,
          subTotal: subTotal,
          noOfBoxes: savedNoOfBoxes,
          boxChargesTotal: isCustomisation ? boxChargesTotal : 0,
          stickerChargesTotal: isCustomisation ? stickerChargesTotal : 0,
          shrinkChargesTotal: isCustomisation ? shrinkChargesTotal : 0,
          packetChargesTotal: packetChargesTotal,
          packingCharges: !isCustomisation ? pCharges : 0,
          additionalCharges: !isCustomisation ? addCharges : 0,
          discountAmount: discountVal,
          totalAmount: grandTotal,
          receivedAmount: parseFloat(receivedAmount) || 0,
          paymentMode: paymentMode,
          paymentStatus: paymentStatus,
          orderStatus: orderStatus,
          createdBy: creatorName,
          createdById: creatorId,
          creatorRole: creatorRole,
          createdAt: serverTimestamp(),
        }));

        // Reset date filter to 'All' or current order date so newly created order is immediately visible
        if (selectedDate !== 'All' && selectedDate !== targetOrderDate) {
          setSelectedDate('All');
        }
      }

      toast.success(
        editingOrder ? 'Order Updated' : 'Order Created',
        editingOrder ? `Order #${editingOrder.code} updated successfully.` : 'New order recorded in system.'
      );

      setEditingOrder(null);
      setIsAddOrderModalOpen(false);
    } catch (err: any) {
      console.error('Failed to save order:', err);
      setFirebaseError(err?.message || 'Failed to save order');
      toast.error('Order Save Failed', err?.message || 'Failed to save order to Firebase.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Fast Quick Status Update on Order Card
  const handleUpdateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    try {
      const docRef = doc(db, 'orders', orderId);
      await updateDoc(docRef, {
        orderStatus: newStatus,
        updatedAt: serverTimestamp(),
      });
      toast.success('Status Updated', `Order status changed to ${newStatus}`);
      setUpdatingStatusOrder(null);
    } catch (err: any) {
      console.error('Failed to update status:', err);
      toast.error('Update Failed', err?.message || 'Could not update order status.');
    }
  };

  // Delete Order
  const handleConfirmDeleteOrder = async () => {
    if (!deletingOrder) return;
    try {
      setIsDeleting(true);
      await deleteDoc(doc(db, 'orders', deletingOrder.id));
      setDeletingOrder(null);
    } catch (err) {
      console.error('Failed to delete order:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Customer Search Filtered Results
  const filteredCustomersSearch = customerSearchTerm.trim()
    ? customersMaster.filter((c) => {
      const term = customerSearchTerm.toLowerCase();
      return (
        c.name.toLowerCase().includes(term) ||
        c.mobile.toLowerCase().includes(term) ||
        c.code.toLowerCase().includes(term)
      );
    })
    : [];

  // Filter orders by selectedDate, orderStatusFilter, paymentStatusFilter, and searchTerm
  const filteredOrders = orders.filter((order) => {
    // 1. Date Filter (default today's date)
    if (selectedDate && selectedDate !== 'All') {
      const orderDate = getOrderDateStr(order);
      const mfgDate = order.manufacturingDate || '';
      const delivDate = order.expectedDeliveryDate || '';
      if (orderDate !== selectedDate && mfgDate !== selectedDate && delivDate !== selectedDate) {
        return false;
      }
    }

    // 2. Order Status Filter (default 'All')
    if (orderStatusFilter !== 'All') {
      if (order.orderStatus !== orderStatusFilter) {
        return false;
      }
    }

    // 3. Payment Status Filter (default 'All')
    if (paymentStatusFilter !== 'All') {
      if (order.paymentStatus !== paymentStatusFilter) {
        return false;
      }
    }

    // 4. Search Filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const codeMatch = (order.code || '').toLowerCase().includes(term);
      const custMatch = (order.customerName || '').toLowerCase().includes(term);
      const mobMatch = (order.customerMobile || '').toLowerCase().includes(term);
      if (!codeMatch && !custMatch && !mobMatch) {
        return false;
      }
    }

    return true;
  });

  // Pagination states (24 items per page)
  const [currentPage, setCurrentPage] = useState(1);
  const [slotPages, setSlotPages] = useState<Record<string, number>>({});

  // Reset pagination to page 1 on filter changes
  useEffect(() => {
    setCurrentPage(1);
    setSlotPages({});
  }, [selectedDate, orderStatusFilter, paymentStatusFilter, searchTerm]);

  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * 24;
    return filteredOrders.slice(start, start + 24);
  }, [filteredOrders, currentPage]);

  // Calculate Aggregated Item Breakdown for Selected Slot Analytics Modal
  const slotAnalyticsData = useMemo(() => {
    if (!selectedSlotForAnalytics) return { items: [], totalOrders: 0, totalRevenue: 0, totalUnitsCount: 0 };
    const slotOrders = filteredOrders.filter((o) => o.slot === selectedSlotForAnalytics);

    const map = new Map<string, {
      itemId: string;
      itemCode?: string;
      itemName: string;
      category?: string;
      unit: string;
      totalQuantity: number;
      totalAmount: number;
      orders: {
        orderId: string;
        orderCode: string;
        customerName: string;
        quantity: number;
        notes?: string;
      }[];
    }>();

    let revenue = 0;

    slotOrders.forEach((order) => {
      revenue += (order.totalAmount || 0);
      (order.items || []).forEach((it: any) => {
        const name = (it.itemName || it.name || 'Unnamed Item').trim();
        const unit = (it.unit || 'KG').toUpperCase();
        const key = `${name.toLowerCase()}__${unit.toLowerCase()}`;
        const qty = parseFloat(it.quantity || it.qty || 0) || 0;
        const price = parseFloat(it.unitPrice || it.price || it.rate || 0) || 0;
        const lineTotal = parseFloat(it.lineTotal || it.amount || 0) || (qty * price);

        if (!map.has(key)) {
          map.set(key, {
            itemId: it.itemId || key,
            itemCode: it.itemCode || '',
            itemName: name,
            category: it.category || 'General',
            unit: unit,
            totalQuantity: 0,
            totalAmount: 0,
            orders: [],
          });
        }

        const entry = map.get(key)!;
        entry.totalQuantity = Math.round((entry.totalQuantity + qty) * 100) / 100;
        entry.totalAmount = Math.round((entry.totalAmount + lineTotal) * 100) / 100;
        entry.orders.push({
          orderId: order.id,
          orderCode: order.code || '#ORD',
          customerName: order.customerName || 'Customer',
          quantity: qty,
          notes: it.manufacturingDescription || it.packingDescription || '',
        });
      });
    });

    const items = Array.from(map.values()).sort((a, b) => b.totalQuantity - a.totalQuantity);
    const totalUnitsCount = items.reduce((sum, it) => sum + it.totalQuantity, 0);

    return {
      items,
      totalOrders: slotOrders.length,
      totalRevenue: revenue,
      totalUnitsCount: Math.round(totalUnitsCount * 100) / 100,
    };
  }, [selectedSlotForAnalytics, filteredOrders]);

  const filteredSlotAnalyticsItems = slotAnalyticsData.items.filter((item) => {
    if (!slotAnalyticsSearchTerm.trim()) return true;
    const q = slotAnalyticsSearchTerm.toLowerCase().trim();
    return (
      item.itemName.toLowerCase().includes(q) ||
      (item.category || '').toLowerCase().includes(q) ||
      (item.itemCode || '').toLowerCase().includes(q)
    );
  });

  // Calculate Order Statistics for Summary Bar from filtered orders
  const totalOrdersCount = filteredOrders.length;
  const totalAmountSum = filteredOrders.reduce((acc, o) => acc + (o.totalAmount || 0), 0);
  const confirmedCount = filteredOrders.filter((o) => {
    const s = o.orderStatus || (o as any).status || '';
    return s === 'Confirmed' || s === 'Order Created';
  }).length;
  const pendingCount = filteredOrders.filter((o) => {
    const s = o.orderStatus || (o as any).status || '';
    return s === 'Pending' || o.paymentStatus === 'Pending';
  }).length;
  const processingCount = filteredOrders.filter((o) => {
    const s = (o.orderStatus || (o as any).status || '').toString();
    return s === 'Processing' || s.includes('Started');
  }).length;
  const deliveredCount = filteredOrders.filter((o) => {
    const s = o.orderStatus || (o as any).status || '';
    return s === 'Delivered';
  }).length;

  const orderStatusOptions: CustomSelectOption[] = [
    { value: 'All', label: 'All Order Statuses' },
    ...ALL_ORDER_STATUSES.map((s) => ({ value: s, label: s })),
  ];

  const paymentStatusOptions: CustomSelectOption[] = [
    { value: 'All', label: 'All Payment Statuses' },
    { value: 'Pending', label: 'Pending' },
    { value: 'Partial', label: 'Partial' },
    { value: 'Completed', label: 'Completed' },
  ];

  return (
    <div className="w-full flex flex-col gap-4 font-sans pb-10">

      {/* ── 1. SHOPIFY POLARIS PAGE TITLE & ACTION BAR ────────────────────── */}
      <div className="flex flex-col gap-3 pt-1">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#02626D]/10 text-[#02626D] flex items-center justify-center flex-shrink-0">
              <ShoppingBag size={18} />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">Orders</h1>
              <p className="text-[11px] text-slate-500 hidden sm:block">Manage, filter, and track manufacturing and delivery time slots</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => toast.info('Exporting Orders', 'Generating orders CSV / Excel export...')}
              className="bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold px-3 py-1.5 h-8 rounded-lg border border-slate-300 shadow-2xs transition-colors cursor-pointer"
            >
              Export
            </button>
            <Link
              href="/orders/create"
              className="bg-[#02626D] hover:bg-[#014d56] text-white text-xs font-semibold px-3.5 py-1.5 h-8 rounded-lg shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Plus size={14} />
              <span>Create order</span>
            </Link>
          </div>
        </div>

        {/* ── Filter Toolbar (Date, Order Status, Payment Status, Search) ── */}
        <div className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-2.5">
          {/* Left: Custom Date Picker Control */}
          <div className="flex items-center gap-2 flex-wrap">
            <CustomDatePicker
              value={selectedDate}
              onChange={setSelectedDate}
              allowAll={true}
              size="md"
            />

            <button
              type="button"
              onClick={() => setSelectedDate(getTodayDateStr())}
              className={`px-3 py-1 h-8 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                selectedDate === getTodayDateStr()
                  ? 'bg-slate-100 text-slate-900 border-slate-300 font-bold'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              Today
            </button>

            <button
              type="button"
              onClick={() => setSelectedDate('All')}
              className={`px-3 py-1 h-8 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                selectedDate === 'All'
                  ? 'bg-slate-100 text-slate-900 border-slate-300 font-bold'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              All Dates
            </button>
          </div>

          {/* Right: Order Status & Payment Status Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Order Status Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase hidden xl:inline">Order Status:</span>
              <CustomSelect
                options={orderStatusOptions}
                value={orderStatusFilter}
                onChange={setOrderStatusFilter}
                icon={<Filter size={13} />}
                size="sm"
                buttonClassName="h-8 text-xs font-medium border-slate-300 rounded-lg bg-white shadow-2xs"
              />
            </div>

            {/* Payment Status Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase hidden xl:inline">Payment:</span>
              <CustomSelect
                options={paymentStatusOptions}
                value={paymentStatusFilter}
                onChange={setPaymentStatusFilter}
                icon={<Tag size={13} />}
                size="sm"
                buttonClassName="h-8 text-xs font-medium border-slate-300 rounded-lg bg-white shadow-2xs"
              />
            </div>

            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search orders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-3 pr-8 py-1 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#02626D] bg-[#f7f7f8] focus:bg-white h-8 w-36 sm:w-48 shadow-2xs transition-colors"
              />
              <Search size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>

            {/* Reset Filters Button */}
            {(selectedDate !== getTodayDateStr() || orderStatusFilter !== 'All' || paymentStatusFilter !== 'All' || searchTerm !== '') && (
              <button
                type="button"
                onClick={() => {
                  setSelectedDate(getTodayDateStr());
                  setOrderStatusFilter('All');
                  setPaymentStatusFilter('All');
                  setSearchTerm('');
                }}
                className="px-2.5 py-1 h-8 rounded-lg text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer"
                title="Reset all filters to defaults"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── 2. TOP METRICS & SUMMARY CARDS BAR ───────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Orders Card */}
        <div className="bg-white rounded-xl p-3 sm:p-3.5 border border-slate-200/90 shadow-2xs flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#02626D]/10 text-[#02626D] flex items-center justify-center flex-shrink-0">
            <ShoppingBag size={17} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-slate-500 font-medium truncate">Total Orders</p>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">{totalOrdersCount}</h3>
            <p className="text-[10px] text-emerald-600 font-medium">Filtered count</p>
          </div>
        </div>

        {/* Total Amount Card */}
        <div className="bg-white rounded-xl p-3 sm:p-3.5 border border-slate-200/90 shadow-2xs flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center flex-shrink-0">
            <IndianRupee size={17} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-slate-500 font-medium truncate">Total Amount</p>
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight truncate">
              ₹ {totalAmountSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </h3>
            <p className="text-[10px] text-emerald-600 font-medium">Filtered total</p>
          </div>
        </div>

        {/* Confirmed Orders */}
        <div className="bg-white rounded-xl p-3 sm:p-3.5 border border-slate-200/90 shadow-2xs flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 size={17} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-slate-500 font-medium truncate">Confirmed</p>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">{confirmedCount}</h3>
            <p className="text-[10px] text-slate-400">Created/Confirmed</p>
          </div>
        </div>

        {/* Pending Orders */}
        <div className="bg-white rounded-xl p-3 sm:p-3.5 border border-slate-200/90 shadow-2xs flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center flex-shrink-0">
            <Clock size={17} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-slate-500 font-medium truncate">Pending</p>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">{pendingCount}</h3>
            <p className="text-[10px] text-slate-400">Status/Payment</p>
          </div>
        </div>

        {/* Processing Orders */}
        <div className="bg-white rounded-xl p-3 sm:p-3.5 border border-slate-200/90 shadow-2xs flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center flex-shrink-0">
            <PackageCheck size={17} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-slate-500 font-medium truncate">Processing</p>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">{processingCount}</h3>
            <p className="text-[10px] text-slate-400">In workflow</p>
          </div>
        </div>

        {/* Delivered Orders */}
        <div className="bg-white rounded-xl p-3 sm:p-3.5 border border-slate-200/90 shadow-2xs flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center flex-shrink-0">
            <Truck size={17} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-slate-500 font-medium truncate">Delivered</p>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">{deliveredCount}</h3>
            <p className="text-[10px] text-slate-400">Completed</p>
          </div>
        </div>
      </div>

      {/* ── 3. Navigation Sub-Tabs (Orders by Slot vs Orders List) ── */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveTab('slot')}
            className={`px-3 py-1.5 h-8 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'slot'
                ? 'bg-[#02626D] text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            Orders by Slot ({filteredOrders.length})
          </button>
          <button
            onClick={() => setActiveTab('list')}
            className={`px-3 py-1.5 h-8 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'list'
                ? 'bg-[#02626D] text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            Orders List ({filteredOrders.length})
          </button>
        </div>
      </div>

      {/* ── 4. SLOT VIEW (Grid of 4 Time Slots - WITHOUT visible scrollbar) ───── */}
      {activeTab === 'slot' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5">
          {SLOT_TIMES.map((slotTime) => {
            const slotOrders = filteredOrders.filter((o) => o.slot === slotTime);

            return (
              <div
                key={slotTime}
                className="bg-white rounded-xl border border-slate-200/90 shadow-2xs flex flex-col overflow-hidden"
              >
                {/* Slot Column Header */}
                <div className="p-3 sm:p-3.5 border-b border-slate-100 flex items-center justify-between bg-[#f7f7f8]">
                  <span className="font-bold text-xs sm:text-sm text-slate-800">{slotTime}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-200/80 text-slate-700">
                      {slotOrders.length}
                    </span>
                    {/* Analytics Button: Left of Plus Button */}
                    <button
                      onClick={() => {
                        setSelectedSlotForAnalytics(slotTime);
                        setIsSlotAnalyticsModalOpen(true);
                        setSlotAnalyticsSearchTerm('');
                      }}
                      className="flex items-center justify-center h-7 w-7 rounded-lg bg-white hover:bg-slate-50 text-slate-600 border border-slate-300 shadow-2xs transition-colors cursor-pointer"
                      title={`View Item Quantity Analytics for ${slotTime}`}
                    >
                      <BarChart3 size={14} />
                    </button>
                    {/* Plus Button */}
                    <Link
                      href={`/orders/create?slot=${encodeURIComponent(slotTime)}&date=${encodeURIComponent(selectedDate !== 'All' ? selectedDate : '')}`}
                      className="flex items-center justify-center h-7 w-7 rounded-lg bg-[#02626D] hover:bg-[#014d56] text-white shadow-2xs transition-colors cursor-pointer"
                      title={`Add Order for ${slotTime}`}
                    >
                      <Plus size={14} />
                    </Link>
                  </div>
                </div>

                {/* Slot Category Capacity Indicators */}
                {slotCategories.length > 0 && (() => {
                  const catStats = slotCategories.map((cat) => {
                    const maxLimit = cat.slotLimits?.[slotTime] || 0;
                    const assignedIds = new Set(cat.assignedItemIds || []);
                    const assignedNames = new Set((cat.assignedItemNames || []).map((n) => n.toLowerCase()));

                    let bookedQty = 0;
                    slotOrders.forEach((order) => {
                      if (order.orderStatus === 'Cancelled' || order.orderStatus === 'Rejected') return;
                      (order.items || []).forEach((it) => {
                        const itId = it.itemId || (it as any).id || '';
                        const itName = (it.itemName || (it as any).name || '').toLowerCase();
                        if (assignedIds.has(itId) || assignedNames.has(itName)) {
                          bookedQty += parseFloat(String(it.quantity || 0)) || 0;
                        }
                      });
                    });

                    const remaining = maxLimit > 0 ? maxLimit - bookedQty : Infinity;
                    const percent = maxLimit > 0 ? Math.min(100, Math.round((bookedQty / maxLimit) * 100)) : 0;
                    const isExceeded = maxLimit > 0 && bookedQty > maxLimit;

                    return {
                      id: cat.id,
                      name: cat.name,
                      color: cat.color || '#02626D',
                      maxLimit,
                      bookedQty: Math.round(bookedQty * 10) / 10,
                      remaining: remaining !== Infinity ? Math.round(remaining * 10) / 10 : Infinity,
                      percent,
                      isExceeded,
                      hasLimit: maxLimit > 0,
                    };
                  });

                  const categoriesWithLimits = catStats.filter((c) => c.hasLimit);
                  if (categoriesWithLimits.length === 0) return null;

                  return (
                    <div className="px-3 py-2 bg-gradient-to-r from-slate-50 to-indigo-50/30 border-b border-slate-100 space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        <span className="flex items-center gap-1">
                          <Layers size={11} className="text-indigo-600" />
                          <span>Category Capacity</span>
                        </span>
                        <Link href="/slot-categories" className="text-indigo-600 hover:underline">
                          Limits
                        </Link>
                      </div>

                      <div className="space-y-1.5">
                        {categoriesWithLimits.map((cat) => (
                          <div key={cat.id} className="bg-white p-1.5 rounded-lg border border-slate-200/80 shadow-2xs space-y-1">
                            <div className="flex items-center justify-between text-[10.5px]">
                              <span className="font-bold truncate max-w-[120px]" style={{ color: cat.color }}>
                                {cat.name}
                              </span>
                              <span className={`text-[9.5px] font-extrabold px-1.5 py-0.2 rounded ${cat.isExceeded ? 'bg-rose-100 text-rose-800' : cat.remaining <= (cat.maxLimit * 0.2) ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                                {cat.isExceeded ? `${Math.abs(cat.remaining)} KG Over` : `${cat.remaining} KG Left`}
                              </span>
                            </div>

                            <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${cat.isExceeded ? 'bg-rose-500' : cat.percent >= 80 ? 'bg-amber-500' : 'bg-[#02626D]'}`}
                                style={{ width: `${Math.min(100, cat.percent)}%` }}
                              />
                            </div>

                            <div className="flex items-center justify-between text-[9px] text-slate-400 font-medium">
                              <span>Booked: {cat.bookedQty} KG</span>
                              <span>Max: {cat.maxLimit} KG</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Order Cards List inside Slot (24 Items Per Page) */}
                <div className="p-3 space-y-2.5 flex-1">
                  {slotOrders.length === 0 ? (
                    <div className="py-10 text-center text-slate-400 text-xs font-medium">
                      No orders in this slot for the selected filters.
                    </div>
                  ) : (
                    (() => {
                      const currentSlotPage = slotPages[slotTime] || 1;
                      const slotPageSize = 24;
                      const paginatedSlotOrders = slotOrders.slice((currentSlotPage - 1) * slotPageSize, currentSlotPage * slotPageSize);
                      const totalSlotPages = Math.ceil(slotOrders.length / slotPageSize) || 1;

                      return (
                        <>
                          {paginatedSlotOrders.map((order) => (
                            <div
                              key={order.id}
                              onClick={() => navigateToOrder(order.id)}
                              className="bg-white border border-slate-200/90 hover:border-[#02626D]/50 rounded-lg p-3 shadow-2xs hover:shadow-xs transition-all space-y-2 relative group cursor-pointer"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-xs text-[#02626D] font-mono">{order.code}</span>
                                <span className="font-bold text-xs text-slate-900">
                                  ₹ {(order.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </span>
                              </div>

                              <div className="flex items-center justify-between gap-1">
                                <h4 className="text-xs font-semibold text-slate-900 truncate max-w-[120px]" title={order.customerName}>
                                  {order.customerName}
                                </h4>
                                <div className="flex items-center gap-1 flex-wrap justify-end">
                                  <span
                                    className={`text-[9px] font-semibold px-2 py-0.5 rounded-full border ${
                                      order.paymentStatus === 'Completed'
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        : order.paymentStatus === 'Partial'
                                          ? 'bg-sky-50 text-sky-700 border-sky-200'
                                          : 'bg-amber-50 text-amber-700 border-amber-200'
                                    }`}
                                  >
                                    {order.paymentStatus}
                                  </span>
                                  {(() => {
                                    const osStyle = getOrderStatusBadgeStyle(order.orderStatus);
                                    return (
                                      <span
                                        className={`text-[9px] font-semibold px-2 py-0.5 rounded-full border ${osStyle.bg} ${osStyle.text} ${osStyle.border}`}
                                      >
                                        {order.orderStatus}
                                      </span>
                                    );
                                  })()}
                                </div>
                              </div>

                              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1.5 border-t border-slate-100">
                                <div className="flex items-center gap-1">
                                  <ShoppingBag size={12} />
                                  <span>{order.totalItems || order.items?.length || 0} Items</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Clock size={12} />
                                  <span>{order.orderTime || '10:00 AM'}</span>
                                </div>

                                {/* Icon-Only Action Buttons for View, Print, Edit */}
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); navigateToOrder(order.id); }}
                                    className="flex items-center justify-center h-6.5 w-6.5 rounded-md text-slate-600 bg-white hover:bg-slate-50 transition-colors cursor-pointer border border-slate-300 shadow-2xs"
                                    title="View Order Details"
                                  >
                                    <Eye size={12} />
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handlePrintOrderSlip(order); }}
                                    className="flex items-center justify-center h-6.5 w-6.5 rounded-md text-[#02626D] bg-[#02626D]/10 hover:bg-[#02626D]/20 transition-colors cursor-pointer border border-[#02626D]/30 shadow-2xs"
                                    title="Print Thermal Receipt"
                                  >
                                    <Printer size={12} />
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleOpenEditOrderModal(order); }}
                                    className="flex items-center justify-center h-6.5 w-6.5 rounded-md text-slate-600 bg-white hover:bg-slate-50 transition-colors cursor-pointer border border-slate-300 shadow-2xs"
                                    title="Edit Order"
                                  >
                                    <Pencil size={12} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}

                          {totalSlotPages > 1 && (
                            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs gap-1">
                              <button
                                type="button"
                                disabled={currentSlotPage <= 1}
                                onClick={() => setSlotPages((prev) => ({ ...prev, [slotTime]: Math.max(1, currentSlotPage - 1) }))}
                                className="px-2 py-1 rounded-lg border border-slate-300 bg-white disabled:opacity-40 hover:bg-slate-50 font-semibold cursor-pointer text-[11px] flex items-center gap-0.5 shadow-2xs"
                              >
                                <ChevronLeft size={12} /> Prev
                              </button>
                              <span className="text-[10px] font-bold text-slate-600">
                                Page {currentSlotPage} / {totalSlotPages} ({slotOrders.length})
                              </span>
                              <button
                                type="button"
                                disabled={currentSlotPage >= totalSlotPages}
                                onClick={() => setSlotPages((prev) => ({ ...prev, [slotTime]: Math.min(totalSlotPages, currentSlotPage + 1) }))}
                                className="px-2 py-1 rounded-lg border border-slate-300 bg-white disabled:opacity-40 hover:bg-slate-50 font-semibold cursor-pointer text-[11px] flex items-center gap-0.5 shadow-2xs"
                              >
                                Next <ChevronRight size={12} />
                              </button>
                            </div>
                          )}
                        </>
                      );
                    })()
                  )}
                </div>

                {/* Footer Link */}
                <div className="p-2.5 text-center border-t border-slate-100 bg-[#f7f7f8]">
                  <button
                    onClick={() => setActiveTab('list')}
                    className="text-xs font-semibold text-[#02626D] hover:text-[#014d56] transition-colors cursor-pointer"
                  >
                    View all {slotOrders.length} orders →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── 5. LIST VIEW TAB ────────────────────────────────────────── */}
      {activeTab === 'list' && (
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="p-3.5 sm:p-4 border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Showing {filteredOrders.length} of {orders.length} total orders
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-[#f7f7f8] border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-2.5 px-4 sm:px-6">Order Code</th>
                  <th className="py-2.5 px-4">Customer</th>
                  <th className="py-2.5 px-4">Slot Time</th>
                  <th className="py-2.5 px-4">Items Count</th>
                  <th className="py-2.5 px-4">Total Amount</th>
                  <th className="py-2.5 px-4">Payment Status</th>
                  <th className="py-2.5 px-4">Order Status</th>
                  <th className="py-2.5 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400 font-medium">
                      No orders found matching the selected date and status filters.
                    </td>
                  </tr>
                ) : (
                  paginatedOrders.map((order) => (
                    <tr
                      key={order.id}
                      onClick={() => navigateToOrder(order.id)}
                      className="hover:bg-slate-50/60 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4 sm:px-6 font-bold text-[#02626D] font-mono">{order.code}</td>
                      <td className="py-3 px-4 font-semibold text-slate-900">{order.customerName}</td>
                      <td className="py-3 px-4 text-slate-600">{order.slot}</td>
                      <td className="py-3 px-4 text-slate-600 font-medium">{order.totalItems || order.items?.length} Items</td>
                      <td className="py-3 px-4 font-bold text-slate-900">₹ {order.totalAmount}</td>
                      <td className="py-3 px-4">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          order.paymentStatus === 'Completed'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : order.paymentStatus === 'Partial'
                              ? 'bg-sky-50 text-sky-700 border-sky-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {order.paymentStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {(() => {
                          const osStyle = getOrderStatusBadgeStyle(order.orderStatus);
                          return (
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${osStyle.bg} ${osStyle.text} ${osStyle.border}`}>
                              {order.orderStatus}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); navigateToOrder(order.id); }}
                            className="flex items-center justify-center h-7 w-7 rounded-lg text-slate-600 bg-white hover:bg-slate-50 transition-colors cursor-pointer border border-slate-300 shadow-2xs"
                            title="View Order Details"
                          >
                            <Eye size={13} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handlePrintOrderSlip(order); }}
                            className="flex items-center justify-center h-7 w-7 rounded-lg text-[#02626D] bg-[#02626D]/10 hover:bg-[#02626D]/20 transition-colors cursor-pointer border border-[#02626D]/30 shadow-2xs"
                            title="Print Thermal Receipt"
                          >
                            <Printer size={13} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleOpenEditOrderModal(order); }}
                            className="flex items-center justify-center h-7 w-7 rounded-lg text-slate-600 bg-white hover:bg-slate-50 transition-colors cursor-pointer border border-slate-300 shadow-2xs"
                            title="Edit Order"
                          >
                            <Pencil size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* 24 Items Per Page Pagination */}
          <Pagination
            currentPage={currentPage}
            totalItems={filteredOrders.length}
            pageSize={24}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      {/* ── 8. INLINE ADD CUSTOMER MODAL ────────────────────────────── */}
      {isAddCustomerModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 font-sans">
          <div className="bg-white rounded-xl max-w-lg w-full p-5 shadow-xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#02626D]/10 text-[#02626D] flex items-center justify-center">
                  <UserPlus size={15} />
                </div>
                <h3 className="text-sm font-bold text-slate-900">Add New Customer</h3>
              </div>
              <button onClick={() => setIsAddCustomerModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveQuickCustomer} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Customer Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Traders"
                  value={newCustomerForm.name}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, name: e.target.value })}
                  className="w-full px-3 py-1.5 h-8 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#02626D]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="+91 98765 43210"
                    value={newCustomerForm.mobileNumber}
                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, mobileNumber: e.target.value })}
                    className="w-full px-3 py-1.5 h-8 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#02626D]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email (Optional)</label>
                  <input
                    type="email"
                    placeholder="email@example.com"
                    value={newCustomerForm.email}
                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, email: e.target.value })}
                    className="w-full px-3 py-1.5 h-8 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#02626D]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Address *</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Full customer address..."
                  value={newCustomerForm.address}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, address: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#02626D]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddCustomerModalOpen(false)}
                  className="px-3 h-8 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 shadow-2xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-3.5 h-8 rounded-lg text-xs font-semibold bg-[#02626D] hover:bg-[#014d56] text-white shadow-2xs"
                >
                  {isSubmitting && <Loader2 size={14} className="animate-spin" />}
                  <span>Save Customer</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── 8.5. SELECT PRODUCT MODAL ────────────────────────────── */}
      {isAddItemSelectorOpen && (
        <div className="fixed inset-0 z-[200] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full p-5 shadow-xl border border-slate-200 space-y-3.5 animate-in fade-in zoom-in-95 duration-150 font-sans">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Select Product</h3>
                <p className="text-xs text-slate-500 mt-0.5">Search and select a product for the order</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddItemSelectorOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <input
                type="text"
                autoFocus
                placeholder="Search products by name, code, or category..."
                value={productSearchQuery}
                onChange={(e) => setProductSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 h-8.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#02626D] font-medium bg-[#f7f7f8] focus:bg-white"
              />
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>

            {/* Product List Responsive Grid (4 items in a row, Favourites first) */}
            <div className="max-h-96 overflow-y-auto border border-slate-200/90 rounded-lg p-2 bg-slate-50/30 no-scrollbar">
              {filteredProductMasterForModal.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 font-medium">
                  No matching products found. Try a different search query.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                  {filteredProductMasterForModal.map((prod) => (
                    <div
                      key={prod.id}
                      onClick={() => handleSelectProductFromModal(prod)}
                      className="p-2.5 rounded-xl border border-slate-200 hover:border-[#02626D] hover:bg-white bg-white/80 shadow-2xs hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between group select-none"
                    >
                      <div className="flex items-start justify-between gap-1.5 mb-1.5">
                        <div className="relative w-11 h-11 rounded-lg bg-slate-50 border border-slate-100 overflow-hidden flex-shrink-0 group-hover:border-[#02626D]/30">
                          <Image src={prod.imageUrl || '/app-icon.png'} alt={prod.name} fill className="object-contain p-1" />
                        </div>
                        {prod.isFavorite && (
                          <span className="p-0.5 rounded-md bg-amber-50 text-amber-500 shadow-2xs" title="Favourite">
                            <Star size={12} className="fill-amber-400 text-amber-400" />
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-900 group-hover:text-[#02626D] transition-colors truncate">
                          {prod.name}
                        </p>
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
                          <span className="font-mono">{prod.code}</span>
                          <span>•</span>
                          <span className="truncate">{prod.category}</span>
                        </div>
                      </div>

                      <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between gap-1">
                        <span className="text-xs font-extrabold text-[#02626D]">
                          ₹ {prod.price} <span className="text-[10px] text-slate-400 font-normal">/{prod.unit}</span>
                        </span>
                        <button
                          type="button"
                          className="px-2 h-5.5 rounded-md text-[10.5px] font-bold bg-[#02626D] text-white hover:bg-[#014d56] shadow-2xs transition-colors cursor-pointer"
                        >
                          Select
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-xs font-medium text-slate-500">
                Found {filteredProductMasterForModal.length} products
              </span>
              <button
                type="button"
                onClick={() => setIsAddItemSelectorOpen(false)}
                className="px-3 h-8 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer shadow-2xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 9. ORDER DETAILS → redirected to /orders/[id] page ────── */}

      {/* ── 10. CUSTOM DELETE CONFIRMATION MODAL ────────────────────── */}
      {deletingOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-red-50 text-red-500 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Delete Order</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Are you sure you want to delete order <strong className="text-slate-800">{deletingOrder.code}</strong> for {deletingOrder.customerName}?
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button onClick={() => setDeletingOrder(null)} className="px-3 h-8 rounded-lg text-xs font-semibold text-slate-700 border border-slate-300 hover:bg-slate-50 shadow-2xs">
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteOrder}
                disabled={isDeleting}
                className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-700 text-white shadow-2xs disabled:opacity-50"
              >
                {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 11. SLOT ITEM QUANTITY ANALYTICS MODAL ────────────────── */}
      {isSlotAnalyticsModalOpen && selectedSlotForAnalytics && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150 font-sans">
          <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            
            {/* Modal Header Bar */}
            <div className="p-3.5 sm:p-4 border-b border-slate-200 flex items-center justify-between bg-[#f7f7f8]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#02626D] text-white flex items-center justify-center shadow-2xs">
                  <BarChart3 size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                      Slot Analytics & Item Breakdown
                    </h2>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-200 text-slate-800">
                      {selectedSlotForAnalytics}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Aggregated product quantities required for all orders in this delivery time slot
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsSlotAnalyticsModalOpen(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Metric Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-white border-b border-slate-100">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Slot Orders</span>
                <p className="text-base font-extrabold text-slate-900 mt-0.5">{slotAnalyticsData.totalOrders}</p>
                <span className="text-[10px] text-slate-400 font-medium">Orders in slot</span>
              </div>
              <div className="p-3 rounded-lg bg-teal-50/60 border border-teal-100">
                <span className="text-[10px] font-bold uppercase text-teal-700 tracking-wider">Unique Items</span>
                <p className="text-base font-extrabold text-teal-800 mt-0.5">{slotAnalyticsData.items.length}</p>
                <span className="text-[10px] text-teal-600 font-medium">Product varieties</span>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                <span className="text-[10px] font-bold uppercase text-slate-600 tracking-wider">Total Quantity</span>
                <p className="text-base font-extrabold text-slate-900 mt-0.5">{slotAnalyticsData.totalUnitsCount}</p>
                <span className="text-[10px] text-slate-500 font-medium">Aggregated units</span>
              </div>
              <div className="p-3 rounded-lg bg-emerald-50/60 border border-emerald-100">
                <span className="text-[10px] font-bold uppercase text-emerald-700 tracking-wider">Total Revenue</span>
                <p className="text-base font-extrabold text-emerald-800 mt-0.5">
                  ₹ {slotAnalyticsData.totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
                <span className="text-[10px] text-emerald-600 font-medium">Slot order value</span>
              </div>
            </div>

            {/* Slot Category Capacity Breakdown Section */}
            {slotCategories.length > 0 && (() => {
              const slotOrders = filteredOrders.filter((o) => o.slot === selectedSlotForAnalytics);
              const catAnalytics = slotCategories.map((cat) => {
                const maxLimit = cat.slotLimits?.[selectedSlotForAnalytics as SlotTime] || 0;
                const assignedIds = new Set(cat.assignedItemIds || []);
                const assignedNames = new Set((cat.assignedItemNames || []).map((n) => n.toLowerCase()));

                let bookedQty = 0;
                slotOrders.forEach((order) => {
                  if (order.orderStatus === 'Cancelled' || order.orderStatus === 'Rejected') return;
                  (order.items || []).forEach((it) => {
                    const itId = it.itemId || (it as any).id || '';
                    const itName = (it.itemName || (it as any).name || '').toLowerCase();
                    if (assignedIds.has(itId) || assignedNames.has(itName)) {
                      bookedQty += parseFloat(String(it.quantity || 0)) || 0;
                    }
                  });
                });

                const remaining = maxLimit > 0 ? maxLimit - bookedQty : Infinity;
                const percent = maxLimit > 0 ? Math.min(100, Math.round((bookedQty / maxLimit) * 100)) : 0;
                const isExceeded = maxLimit > 0 && bookedQty > maxLimit;

                return {
                  id: cat.id,
                  name: cat.name,
                  color: cat.color || '#02626D',
                  maxLimit,
                  bookedQty: Math.round(bookedQty * 10) / 10,
                  remaining: remaining !== Infinity ? Math.round(remaining * 10) / 10 : Infinity,
                  percent,
                  isExceeded,
                  hasLimit: maxLimit > 0,
                };
              });

              return (
                <div className="p-3.5 bg-slate-50/80 border-b border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Layers size={13} className="text-indigo-600" />
                      <span>Slot Category Capacity Breakdown</span>
                    </span>
                    <Link
                      href="/slot-categories"
                      className="text-[11px] font-bold text-indigo-600 hover:underline"
                    >
                      Manage Limits →
                    </Link>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                    {catAnalytics.map((cat) => (
                      <div
                        key={cat.id}
                        className={`p-2.5 bg-white rounded-xl border transition-all ${
                          cat.isExceeded
                            ? 'border-rose-300 bg-rose-50/40 ring-1 ring-rose-300'
                            : 'border-slate-200 shadow-2xs'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 text-xs">
                          <span className="font-bold truncate max-w-[120px]" style={{ color: cat.color }}>
                            {cat.name}
                          </span>
                          {cat.hasLimit ? (
                            <span
                              className={`text-[9.5px] font-black px-1.5 py-0.2 rounded-md ${
                                cat.isExceeded
                                  ? 'bg-rose-100 text-rose-800'
                                  : cat.remaining <= cat.maxLimit * 0.2
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {cat.isExceeded ? `${Math.abs(cat.remaining)} KG Over!` : `${cat.remaining} KG Left`}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-medium">No Limit</span>
                          )}
                        </div>

                        {cat.hasLimit && (
                          <div className="space-y-1 mt-1.5">
                            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  cat.isExceeded
                                    ? 'bg-rose-500'
                                    : cat.percent >= 80
                                    ? 'bg-amber-500'
                                    : 'bg-[#02626D]'
                                }`}
                                style={{ width: `${Math.min(100, cat.percent)}%` }}
                              />
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
                              <span>Booked: {cat.bookedQty} KG</span>
                              <span>Max: {cat.maxLimit} KG</span>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Search Filter Bar */}
            <div className="p-3 sm:px-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={slotAnalyticsSearchTerm}
                  onChange={(e) => setSlotAnalyticsSearchTerm(e.target.value)}
                  placeholder="Search item name or category..."
                  className="w-full pl-8 pr-3 h-8 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#02626D]"
                />
              </div>
              <span className="text-xs font-semibold text-slate-500">
                Showing {filteredSlotAnalyticsItems.length} of {slotAnalyticsData.items.length} items
              </span>
            </div>

            {/* Item Aggregation Table */}
            <div className="flex-1 overflow-y-auto p-4">
              {filteredSlotAnalyticsItems.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs font-medium space-y-1">
                  <p className="text-sm font-bold text-slate-600">No items found</p>
                  <p>There are no products in this slot matching your query.</p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-lg overflow-hidden shadow-2xs">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#f7f7f8] border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase">
                        <th className="py-2.5 px-3">Item Name</th>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3 text-center">Unit</th>
                        <th className="py-2.5 px-3 text-right">Total Quantity</th>
                        <th className="py-2.5 px-3 text-right">Total Amount</th>
                        <th className="py-2.5 px-3">Contributing Orders</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {filteredSlotAnalyticsItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2.5 px-3 font-bold text-slate-900">
                            {item.itemName}
                            {item.itemCode && (
                              <span className="ml-1.5 text-[10px] text-slate-400 font-mono">({item.itemCode})</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                              {item.category || 'General'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center font-semibold text-slate-700">{item.unit}</td>
                          <td className="py-2.5 px-3 text-right">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-[#02626D]/10 text-[#02626D]">
                              {item.totalQuantity} {item.unit}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                            ₹ {item.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {item.orders.map((ord, oIdx) => (
                                <span
                                  key={oIdx}
                                  className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200"
                                  title={`${ord.customerName} - ${ord.quantity} ${item.unit}${ord.notes ? ` (${ord.notes})` : ''}`}
                                >
                                  <strong className="text-[#02626D] font-mono">{ord.orderCode}</strong> ({ord.quantity} {item.unit})
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 px-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">
                Tip: Quantities represent total production requirement for <strong className="text-slate-800">{selectedSlotForAnalytics}</strong>.
              </span>
              <button
                onClick={() => setIsSlotAnalyticsModalOpen(false)}
                className="px-3 h-8 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-900 text-white transition-colors cursor-pointer shadow-2xs"
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

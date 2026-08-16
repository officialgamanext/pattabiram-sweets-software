'use client';

import { useState, useEffect, useRef } from 'react';
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
} from 'lucide-react';
import CustomSelect, { CustomSelectOption } from '@/components/CustomSelect';
import CustomDatePicker from '@/components/CustomDatePicker';
import Pagination from '@/components/Pagination';
import { compressImageTo60KB, uploadToImageKit } from '@/lib/imageCompressor';
import { usePrinter } from '@/context/PrinterContext';
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

export type PaymentStatus = 'Pending' | 'Partial' | 'Completed';

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
  | 'Ready For Dispatch'
  | 'Dispatched'
  | 'Delivered'
  | 'Confirmed'
  | 'Processing'
  | 'Pending'
  | 'Cancelled';

export interface CustomisationDetails {
  noOfBoxes: number;
  boxType: string;
  boxPrice: number;
  boxImageUrl?: string;
  hasSticker?: boolean;
  stickerPrice?: number;
  hasShrink?: boolean;
  shrinkPrice?: number;
}

export interface OrderItemLine {
  lineId?: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  category: string;
  unit: string;
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

export interface OrderRecord {
  id: string;
  code: string;
  customerName: string;
  customerMobile: string;
  customerId: string;
  customerType: string;
  slot: SlotTime;
  orderTime: string;
  orderDate: string;
  manufacturingDate?: string;
  expectedDeliveryDate?: string;
  isCustomisation?: boolean;
  customisationDetails?: CustomisationDetails | null;
  items: OrderItemLine[];
  totalItems: number;
  subTotal: number;
  boxChargesTotal?: number;
  stickerChargesTotal?: number;
  shrinkChargesTotal?: number;
  packetChargesTotal?: number;
  packingCharges?: number;
  additionalCharges?: number;
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
}

export const SLOT_TIMES: SlotTime[] = [
  '9:00 AM - 12:00 PM',
  '12:00 PM - 3:00 PM',
  '3:00 PM - 6:00 PM',
  '6:00 PM - 9:00 PM',
];

export const BOX_TYPES = [
  { name: 'HandleBox', price: 5 },
  { name: 'cellbox', price: 10 },
  { name: '1/4 box', price: 10 },
  { name: '1/2 box', price: 10 },
  { name: '1kg box', price: 20 },
  { name: 'Dental box', price: 5 },
  { name: 'pakam gheebox', price: 10 },
];

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

  const { isConnected: isPrinterConnected, printerType, printReceipt } = usePrinter();

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
      alert(`Thermal Printer not connected. Please connect USB/Bluetooth printer in the top Header to print ${order.code || 'Order'}.`);
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
  const [mfgDate, setMfgDate] = useState<string>(getTodayDateStr());
  const [expDeliveryDate, setExpDeliveryDate] = useState<string>(getTodayDateStr());
  const [isCustomisation, setIsCustomisation] = useState<boolean>(false);
  const [noOfBoxes, setNoOfBoxes] = useState<number>(1);
  const [boxType, setBoxType] = useState<string>('HandleBox');
  const [boxImageUrl, setBoxImageUrl] = useState<string>('');
  const [hasSticker, setHasSticker] = useState<boolean>(false);
  const [hasShrink, setHasShrink] = useState<boolean>(false);
  const [packingCharges, setPackingCharges] = useState<string>('0');
  const [additionalCharges, setAdditionalCharges] = useState<string>('0');
  const [discountAmount, setDiscountAmount] = useState<string>('0');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [orderItems, setOrderItems] = useState<OrderItemLine[]>([]);
  const [receivedAmount, setReceivedAmount] = useState<string>('0');
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
        quantity: 1,
        lineTotal: prod.price,
        hasPacket: false,
        packetCharge: 0,
        manufacturingDescription: '',
        packingDescription: '',
      };
      setOrderItems((prev) => [...prev, newLine]);
    }

    setIsAddItemSelectorOpen(false);
  };

  // Filter products for Product Modal
  const filteredProductMasterForModal = itemsMaster.filter((item) => {
    if (!productSearchQuery.trim()) return true;
    const q = productSearchQuery.toLowerCase().trim();
    return (
      item.name.toLowerCase().includes(q) ||
      item.code.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q)
    );
  });

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

        fetched.sort((a, b) => (b.code || '').localeCompare(a.code || ''));
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
      const items: ItemMasterOption[] = snap.docs.map((d) => ({
        id: d.id,
        code: d.data().code || 'ITM-000',
        name: d.data().name || 'Unnamed Item',
        category: d.data().category || 'General',
        unit: d.data().unit || 'KG',
        price: parseFloat(d.data().price || 0),
        imageUrl: d.data().imageUrl || '',
      }));
      items.sort((a, b) => a.code.localeCompare(b.code));
      setItemsMaster(items);
    });

    return () => unsubItems();
  }, []);

  const [editingOrder, setEditingOrder] = useState<OrderRecord | null>(null);

  // Open Full Screen Add Order Modal for a specific Slot
  const handleOpenAddOrderModal = (slot: SlotTime = '9:00 AM - 12:00 PM') => {
    setEditingOrder(null);
    setOrderSlot(slot);
    setMfgDate(getTodayDateStr());
    setExpDeliveryDate(getTodayDateStr());
    setIsCustomisation(false);
    setNoOfBoxes(1);
    setBoxType('HandleBox');
    setBoxImageFile(null);
    setBoxImageUrl('');
    setHasSticker(false);
    setHasShrink(false);
    setPackingCharges('0');
    setAdditionalCharges('0');
    setDiscountAmount('0');
    setSelectedCustomer(null);
    setCustomerSearchTerm('');
    setOrderItems([]);
    setReceivedAmount('0');
    setPaymentMode('UPI');
    setPaymentStatus('Pending');
    setOrderStatus('Order Created');
    setIsAddOrderModalOpen(true);
  };

  // Open Full Screen Edit Order Modal
  const handleOpenEditOrderModal = (order: OrderRecord) => {
    setEditingOrder(order);
    setOrderSlot(order.slot || '9:00 AM - 12:00 PM');
    setMfgDate(order.manufacturingDate || getTodayDateStr());
    setExpDeliveryDate(order.expectedDeliveryDate || getTodayDateStr());
    setIsCustomisation(Boolean(order.isCustomisation));
    if (order.customisationDetails) {
      setNoOfBoxes(order.customisationDetails.noOfBoxes || 1);
      setBoxType(order.customisationDetails.boxType || 'HandleBox');
      setBoxImageUrl(order.customisationDetails.boxImageUrl || '');
      setHasSticker(Boolean(order.customisationDetails.hasSticker));
      setHasShrink(Boolean(order.customisationDetails.hasShrink));
    } else {
      setNoOfBoxes(1);
      setBoxType('HandleBox');
      setBoxImageUrl('');
      setHasSticker(false);
      setHasShrink(false);
    }
    setPackingCharges(String(order.packingCharges || 0));
    setAdditionalCharges(String(order.additionalCharges || 0));
    setDiscountAmount(String(order.discountAmount || 0));
    setSelectedCustomer({
      id: order.customerId || '',
      code: 'CUST-000',
      name: order.customerName,
      mobile: order.customerMobile,
      type: (order.customerType as 'Customer' | 'Wholesaler') || 'Customer',
    });
    setCustomerSearchTerm(order.customerName);
    setOrderItems(order.items || []);
    setReceivedAmount(String(order.receivedAmount || 0));
    setPaymentMode(order.paymentMode || 'UPI');
    setPaymentStatus(order.paymentStatus || 'Pending');
    setOrderStatus(order.orderStatus || 'Order Created');
    setIsAddOrderModalOpen(true);
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
    } catch (err: any) {
      console.error('Failed to quick add customer:', err);
      alert('Failed to save customer. Please try again.');
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

        if (field === 'quantity') qty = Math.max(0.01, parseFloat(val) || 0);
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

  // Order Calculations
  const selectedBoxPrice = BOX_TYPES.find((b) => b.name === boxType)?.price || 0;
  const subTotal = orderItems.reduce((acc, curr) => acc + curr.lineTotal, 0);

  // Packet charges: ₹5 per box for each item line where packet is selected (ONLY when Customisation is enabled!)
  const packetChargesTotal = isCustomisation
    ? orderItems.reduce((acc, curr) => acc + (curr.hasPacket ? Math.max(0, noOfBoxes) * 5 : 0), 0)
    : 0;

  const boxChargesTotal = isCustomisation ? Math.max(0, noOfBoxes) * selectedBoxPrice : 0;
  const stickerChargesTotal = isCustomisation && hasSticker ? Math.max(0, noOfBoxes) * 10 : 0;
  const shrinkChargesTotal = isCustomisation && hasShrink ? Math.max(0, noOfBoxes) * 10 : 0;

  const pCharges = !isCustomisation ? parseFloat(packingCharges) || 0 : 0;
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
      alert('Please search and select a customer or wholesaler.');
      return;
    }
    if (orderItems.length === 0) {
      alert('Please add at least one item to the order.');
      return;
    }

    const validItems = orderItems.filter((i) => i.itemName.trim().length > 0);
    if (validItems.length === 0) {
      alert('Please select a valid product for at least one item row.');
      return;
    }

    const recv = parseFloat(receivedAmount) || 0;
    if (recv > grandTotal) {
      alert(`Received amount (₹${recv}) cannot exceed the order total of ₹${grandTotal.toFixed(2)}.`);
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

      if (editingOrder) {
        // Update existing order
        await updateDoc(doc(db, 'orders', editingOrder.id), {
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
                noOfBoxes: noOfBoxes,
                boxType: boxType,
                boxPrice: selectedBoxPrice,
                boxImageUrl: finalBoxImageUrl,
                hasSticker: hasSticker,
                stickerPrice: 10,
                hasShrink: hasShrink,
                shrinkPrice: 10,
              }
            : null,
          items: validItems,
          totalItems: validItems.length,
          subTotal: subTotal,
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
        });
      } else {
        // Create new order
        await addDoc(collection(db, 'orders'), {
          code: orderCode,
          customerName: selectedCustomer.name,
          customerMobile: selectedCustomer.mobile,
          customerId: selectedCustomer.id,
          customerType: selectedCustomer.type,
          slot: orderSlot,
          orderTime: timeStr,
          orderDate: selectedDate && selectedDate !== 'All' ? selectedDate : getTodayDateStr(),
          manufacturingDate: mfgDate,
          expectedDeliveryDate: expDeliveryDate,
          isCustomisation: isCustomisation,
          customisationDetails: isCustomisation
            ? {
                noOfBoxes: noOfBoxes,
                boxType: boxType,
                boxPrice: selectedBoxPrice,
                boxImageUrl: finalBoxImageUrl,
                hasSticker: hasSticker,
                stickerPrice: 10,
                hasShrink: hasShrink,
                shrinkPrice: 10,
              }
            : null,
          items: validItems,
          totalItems: validItems.length,
          subTotal: subTotal,
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
          createdAt: serverTimestamp(),
        });
      }

      setEditingOrder(null);
      setIsAddOrderModalOpen(false);
    } catch (err: any) {
      console.error('Failed to save order:', err);
      setFirebaseError(err?.message || 'Failed to save order');
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
      setUpdatingStatusOrder(null);
    } catch (err) {
      console.error('Failed to update status:', err);
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
      if (orderDate !== selectedDate) {
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

  const [currentPage, setCurrentPage] = useState(1);
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * 45, currentPage * 45);

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
    <div className="w-full flex flex-col gap-6 font-sans pb-10">

      {/* ── 1. SHOPIFY POLARIS PAGE TITLE & ACTION BAR ────────────────────── */}
      <div className="flex flex-col gap-3 pt-1">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShoppingBag size={22} className="text-slate-800 stroke-[1.75]" />
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Orders</h1>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => alert('Exporting orders...')}
              className="bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-300 shadow-2xs transition-colors cursor-pointer"
            >
              Export
            </button>
            <button
              onClick={() => handleOpenAddOrderModal('9:00 AM - 12:00 PM')}
              className="bg-[#02626D] hover:bg-[#014d56] text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Plus size={14} />
              <span>Create order</span>
            </button>
          </div>
        </div>

        {/* ── Filter Toolbar (Date, Order Status, Payment Status, Search) ── */}
        <div className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-3">
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
              className={`px-3 py-1 h-[32px] rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
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
              className={`px-3 py-1 h-[32px] rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
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
                buttonClassName="h-[36px] border-slate-200 rounded-xl"
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
                buttonClassName="h-[36px] border-slate-200 rounded-xl"
              />
            </div>

            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search orders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-3.5 pr-8 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 h-[36px] bg-slate-50/50 w-36 sm:w-48"
              />
              <Search size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
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
                className="px-2.5 py-1.5 h-[36px] rounded-xl text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 transition-colors cursor-pointer"
                title="Reset all filters to defaults"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── 2. TOP METRICS & SUMMARY CARDS BAR ───────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Total Orders Card */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
            <ShoppingBag size={20} />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-semibold">Total Orders</p>
            <h3 className="text-lg font-extrabold text-slate-900">{totalOrdersCount}</h3>
            <p className="text-[10px] text-emerald-600 font-bold">Filtered count</p>
          </div>
        </div>

        {/* Total Amount Card */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center flex-shrink-0">
            <IndianRupee size={20} />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-semibold">Total Amount</p>
            <h3 className="text-sm font-extrabold text-slate-900">
              ₹ {totalAmountSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </h3>
            <p className="text-[10px] text-emerald-600 font-bold">Filtered total</p>
          </div>
        </div>

        {/* Confirmed Orders */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-semibold">Confirmed Orders</p>
            <h3 className="text-lg font-extrabold text-slate-900">{confirmedCount}</h3>
            <p className="text-[10px] text-slate-400">Created/Confirmed</p>
          </div>
        </div>

        {/* Pending Orders */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
            <Clock size={20} />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-semibold">Pending Orders</p>
            <h3 className="text-lg font-extrabold text-slate-900">{pendingCount}</h3>
            <p className="text-[10px] text-slate-400">Status/Payment</p>
          </div>
        </div>

        {/* Processing Orders */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
            <PackageCheck size={20} />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-semibold">Processing Orders</p>
            <h3 className="text-lg font-extrabold text-slate-900">{processingCount}</h3>
            <p className="text-[10px] text-slate-400">In workflow</p>
          </div>
        </div>

        {/* Delivered Orders */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
            <Truck size={20} />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-semibold">Delivered Orders</p>
            <h3 className="text-lg font-extrabold text-slate-900">{deliveredCount}</h3>
            <p className="text-[10px] text-slate-400">Completed</p>
          </div>
        </div>
      </div>

      {/* ── 3. Navigation Sub-Tabs (Orders by Slot vs Orders List) ── */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('slot')}
            className={`px-[12px] py-[6px] rounded-[8px] text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'slot'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Orders by Slot ({filteredOrders.length})
          </button>
          <button
            onClick={() => setActiveTab('list')}
            className={`px-[12px] py-[6px] rounded-[8px] text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'list'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Orders List ({filteredOrders.length})
          </button>
        </div>
      </div>

      {/* ── 4. SLOT VIEW (Grid of 4 Time Slots - WITHOUT visible scrollbar) ───── */}
      {activeTab === 'slot' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {SLOT_TIMES.map((slotTime) => {
            const slotOrders = filteredOrders.filter((o) => o.slot === slotTime);

            return (
              <div
                key={slotTime}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-xs flex flex-col overflow-hidden"
              >
                {/* Slot Column Header */}
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <span className="font-extrabold text-sm text-slate-800">{slotTime}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600">
                      {slotOrders.length} Orders
                    </span>
                    <button
                      onClick={() => handleOpenAddOrderModal(slotTime)}
                      className="flex items-center justify-center h-[30px] w-[30px] rounded-[6px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-all cursor-pointer shadow-xs"
                      title={`Add Order for ${slotTime}`}
                    >
                      <Plus size={15} />
                    </button>
                  </div>
                </div>

                {/* Order Cards List inside Slot - NO SCROLLBAR */}
                <div
                  className="p-3 space-y-3 flex-1 max-h-[550px] overflow-y-auto no-scrollbar"
                  style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                  {slotOrders.length === 0 ? (
                    <div className="py-10 text-center text-slate-400 text-xs font-medium">
                      No orders in this slot for the selected filters.
                    </div>
                  ) : (
                    slotOrders.map((order) => (
                      <div
                        key={order.id}
                        onClick={() => navigateToOrder(order.id)}
                        className="bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-2xs hover:shadow-sm hover:border-indigo-200 transition-all space-y-2.5 relative group cursor-pointer"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-indigo-600 font-mono">{order.code}</span>
                          <span className="font-extrabold text-xs text-slate-900">
                            ₹ {(order.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-1">
                          <h4 className="text-xs font-bold text-slate-900 truncate max-w-[110px]" title={order.customerName}>
                            {order.customerName}
                          </h4>
                          <div className="flex items-center gap-1.5 flex-wrap justify-end">
                            <span
                              className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
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
                                  className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${osStyle.bg} ${osStyle.text} ${osStyle.border}`}
                                >
                                  {order.orderStatus}
                                </span>
                              );
                            })()}
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-50">
                          <div className="flex items-center gap-1">
                            <ShoppingBag size={12} />
                            <span>{order.totalItems || order.items?.length || 0} Items</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock size={12} />
                            <span>{order.orderTime || '10:00 AM'}</span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={(e) => { e.stopPropagation(); navigateToOrder(order.id); }}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-600 transition-colors cursor-pointer border border-indigo-100 shadow-2xs"
                              title="View Order Details"
                            >
                              <Eye size={12} />
                              <span>View</span>
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handlePrintOrderSlip(order); }}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold bg-teal-50 hover:bg-teal-100 text-teal-700 transition-colors cursor-pointer border border-teal-200 shadow-2xs"
                              title="Print Thermal Receipt Slip"
                            >
                              <Printer size={12} />
                              <span>Print</span>
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleOpenEditOrderModal(order); }}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer border border-slate-200/80 shadow-2xs"
                              title="Edit Order"
                            >
                              <Pencil size={12} />
                              <span>Edit</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Footer Link */}
                <div className="p-3 text-center border-t border-slate-100 bg-slate-50/30">
                  <button
                    onClick={() => setActiveTab('list')}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
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
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
              Showing {filteredOrders.length} of {orders.length} total orders
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-600 uppercase">
                  <th className="py-3.5 px-4 sm:px-6">Order Code</th>
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4">Slot Time</th>
                  <th className="py-3.5 px-4">Items Count</th>
                  <th className="py-3.5 px-4">Total Amount</th>
                  <th className="py-3.5 px-4">Payment Status</th>
                  <th className="py-3.5 px-4">Order Status</th>
                  <th className="py-3.5 px-4 text-center">Actions</th>
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
                      className="hover:bg-indigo-50/30 cursor-pointer transition-colors"
                    >
                      <td className="py-3.5 px-4 sm:px-6 font-bold text-indigo-600">{order.code}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">{order.customerName}</td>
                      <td className="py-3.5 px-4 text-slate-600">{order.slot}</td>
                      <td className="py-3.5 px-4 text-slate-600 font-bold">{order.totalItems || order.items?.length} Items</td>
                      <td className="py-3.5 px-4 font-extrabold text-slate-900">₹ {order.totalAmount}</td>
                      <td className="py-3.5 px-4">
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                          order.paymentStatus === 'Completed'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : order.paymentStatus === 'Partial'
                              ? 'bg-sky-50 text-sky-700 border-sky-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {order.paymentStatus}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {(() => {
                          const osStyle = getOrderStatusBadgeStyle(order.orderStatus);
                          return (
                            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${osStyle.bg} ${osStyle.text} ${osStyle.border}`}>
                              {order.orderStatus}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={(e) => { e.stopPropagation(); navigateToOrder(order.id); }}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-600 transition-colors cursor-pointer border border-indigo-100 shadow-2xs"
                            title="View Order Details"
                          >
                            <Eye size={13} />
                            <span>View</span>
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handlePrintOrderSlip(order); }}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-teal-50 hover:bg-teal-100 text-teal-700 transition-colors cursor-pointer border border-teal-200 shadow-2xs"
                            title="Print Thermal Receipt Slip"
                          >
                            <Printer size={13} />
                            <span>Print</span>
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleOpenEditOrderModal(order); }}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer border border-slate-200/80 shadow-2xs"
                            title="Edit Order"
                          >
                            <Pencil size={13} />
                            <span>Edit</span>
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
            totalItems={filteredOrders.length}
            pageSize={45}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      {/* ── 6. FULL SCREEN MODAL: CREATE ORDER (Clean POS Page Workspace) */}
      {isAddOrderModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-50 flex flex-col overflow-hidden animate-in fade-in duration-150">

          {/* Modal Top Header Bar */}
          <div className="bg-white border-b border-slate-200/80 px-6 sm:px-8 py-4 flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                <ShoppingBag size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">
                    {editingOrder ? `Edit Order ${editingOrder.code}` : 'Create New Order'}
                  </h2>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                    {orderSlot}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">Select customer, add products with quantities, and set payment details</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsAddOrderModalOpen(false)}
                className="px-[8px] py-[4px] h-[30px] rounded-[6px] text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateOrderSubmit}
                disabled={isSubmitting || !selectedCustomer || orderItems.length === 0}
                className="flex items-center gap-2 px-[8px] py-[4px] h-[30px] rounded-[6px] text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                <span>{editingOrder ? 'Update Order' : 'Create Order'}</span>
              </button>
              <button
                onClick={() => setIsAddOrderModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-[6px] h-[30px] w-[30px] flex items-center justify-center hover:bg-slate-100 transition-colors cursor-pointer ml-1"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Modal Main Body: 2 Columns Layout */}
          <div className="flex-1 overflow-y-auto p-6 sm:p-8 w-full">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

              {/* Left Column (8 Cols): Time Slot, Customer Search, Product Items Table */}
              <div className="lg:col-span-8 space-y-6">

                {/* 1. Time Slot & Dates Selection */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Order Time Slot *
                      </label>
                      <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                        Required
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {SLOT_TIMES.map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => setOrderSlot(slot)}
                          className={`px-[8px] py-[4px] h-[34px] rounded-[6px] text-xs font-bold border transition-all cursor-pointer ${
                            orderSlot === slot
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Manufacturing Date *
                      </label>
                      <CustomDatePicker
                        value={mfgDate}
                        onChange={(d) => setMfgDate(d)}
                        allowAll={false}
                        size="md"
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Expected Delivery Date *
                      </label>
                      <CustomDatePicker
                        value={expDeliveryDate}
                        onChange={(d) => setExpDeliveryDate(d)}
                        allowAll={false}
                        size="md"
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Customisation Box Checkbox & Section */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="customisationCheckbox"
                        checked={isCustomisation}
                        onChange={(e) => setIsCustomisation(e.target.checked)}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      <label
                        htmlFor="customisationCheckbox"
                        className="text-xs font-extrabold text-slate-900 cursor-pointer select-none"
                      >
                        Include Customisation Box
                      </label>
                    </div>
                    {isCustomisation && (
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                        Customisation Active
                      </span>
                    )}
                  </div>

                  {/* Customisation Box Details (Label Below Layout) */}
                  {isCustomisation && (
                    <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200 space-y-4 animate-in fade-in duration-150">
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-200 pb-2">
                        Customisation Box Details
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                        {/* 1. No of Boxes */}
                        <div className="flex flex-col">
                          <input
                            type="number"
                            min="1"
                            value={noOfBoxes}
                            onChange={(e) => setNoOfBoxes(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 bg-white font-semibold shadow-2xs"
                          />
                          <label className="text-[11px] font-bold text-slate-500 mt-1">No of boxes</label>
                        </div>

                        {/* 2. Box Type Dropdown */}
                        <div className="flex flex-col">
                          <CustomSelect
                            options={BOX_TYPES.map((b) => ({
                              value: b.name,
                              label: `${b.name} (₹${b.price})`,
                            }))}
                            value={boxType}
                            onChange={(val) => setBoxType(val)}
                            className="w-full"
                            buttonClassName="w-full bg-white font-semibold shadow-2xs border-slate-200 rounded-xl text-xs py-2 h-[34px]"
                          />
                          <label className="text-[11px] font-bold text-slate-500 mt-1">Box type</label>
                        </div>

                        {/* 3. Packing Box Image Holder */}
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2 bg-white p-1 border border-slate-200 rounded-xl shadow-2xs">
                            <input
                              type="file"
                              accept="image/*"
                              disabled={isUploadingBoxImage}
                              onChange={handleBoxImageUpload}
                              className="text-[10px] text-slate-500 file:mr-1 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[10px] file:font-bold file:bg-indigo-50 file:text-indigo-700 cursor-pointer w-full"
                            />
                            {isUploadingBoxImage ? (
                              <Loader2 size={16} className="animate-spin text-indigo-600 flex-shrink-0 mr-1" />
                            ) : boxImageUrl ? (
                              <div className="relative w-7 h-7 rounded-md overflow-hidden border border-slate-200 flex-shrink-0">
                                <Image src={boxImageUrl} alt="Box Preview" fill className="object-cover" />
                              </div>
                            ) : null}
                          </div>
                          <label className="text-[11px] font-bold text-slate-500 mt-1">Packing box image</label>
                        </div>

                        {/* 4. Sticker Selection */}
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5 h-[34px]">
                            <button
                              type="button"
                              onClick={() => setHasSticker(true)}
                              className={`flex-1 py-1 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 border transition-all cursor-pointer ${
                                hasSticker
                                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                  : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              <Check size={13} /> Yes
                            </button>
                            <button
                              type="button"
                              onClick={() => setHasSticker(false)}
                              className={`flex-1 py-1 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 border transition-all cursor-pointer ${
                                !hasSticker
                                  ? 'bg-red-600 text-white border-red-600 shadow-xs'
                                  : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              <X size={13} /> No
                            </button>
                          </div>
                          <label className="text-[11px] font-bold text-slate-500 mt-1">Sticker (₹10)</label>
                        </div>

                        {/* 5. Shrink Selection */}
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5 h-[34px]">
                            <button
                              type="button"
                              onClick={() => setHasShrink(true)}
                              className={`flex-1 py-1 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 border transition-all cursor-pointer ${
                                hasShrink
                                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                  : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              <Check size={13} /> Yes
                            </button>
                            <button
                              type="button"
                              onClick={() => setHasShrink(false)}
                              className={`flex-1 py-1 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 border transition-all cursor-pointer ${
                                !hasShrink
                                  ? 'bg-red-600 text-white border-red-600 shadow-xs'
                                  : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              <X size={13} /> No
                            </button>
                          </div>
                          <label className="text-[11px] font-bold text-slate-500 mt-1">Shrink (₹10)</label>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Customer / Wholesaler Search */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Customer / Wholesaler *
                    </label>

                    <button
                      type="button"
                      onClick={() => setIsAddCustomerModalOpen(true)}
                      className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer bg-indigo-50 px-[8px] py-[4px] h-[30px] rounded-[6px] border border-indigo-100"
                    >
                      <UserPlus size={14} />
                      <span>+ Add Customer</span>
                    </button>
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search by Mobile Number, Customer Name, or Code..."
                      value={customerSearchTerm}
                      onChange={(e) => {
                        setCustomerSearchTerm(e.target.value);
                        setSelectedCustomer(null);
                      }}
                      className="w-full pl-3.5 pr-9 py-2.5 text-xs sm:text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 bg-slate-50/50"
                    />
                    <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />

                    {/* Customer Dropdown Results */}
                    {customerSearchTerm && !selectedCustomer && (
                      <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-2xl border border-slate-200 shadow-xl max-h-60 overflow-y-auto z-50 divide-y divide-slate-100">
                        {filteredCustomersSearch.length === 0 ? (
                          <div className="p-4 text-center">
                            <p className="text-xs text-slate-500 font-semibold mb-2">No matching customer found</p>
                            <button
                              type="button"
                              onClick={() => setIsAddCustomerModalOpen(true)}
                              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors cursor-pointer"
                            >
                              + Add New Customer
                            </button>
                          </div>
                        ) : (
                          filteredCustomersSearch.map((cust) => (
                            <div
                              key={cust.id}
                              onClick={() => {
                                setSelectedCustomer(cust);
                                setCustomerSearchTerm(`${cust.name} (${cust.mobile})`);
                              }}
                              className="p-3.5 hover:bg-slate-50 transition-colors cursor-pointer flex items-center justify-between"
                            >
                              <div>
                                <p className="text-xs font-bold text-slate-900">{cust.name}</p>
                                <p className="text-[11px] text-slate-500 mt-0.5">📞 {cust.mobile} • 📍 {cust.address}</p>
                              </div>
                              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${cust.type === 'Wholesaler' ? 'bg-purple-50 text-purple-700 border border-purple-100' : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                                }`}>
                                {cust.type}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {/* Selected Customer Display Card */}
                  {selectedCustomer && (
                    <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-100 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white font-bold flex items-center justify-center text-sm shadow-xs">
                          {selectedCustomer.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-900">{selectedCustomer.name}</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-600 text-white font-mono">
                              {selectedCustomer.code}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                              {selectedCustomer.type}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-0.5">
                            📞 {selectedCustomer.mobile} • 📍 {selectedCustomer.address}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCustomer(null);
                          setCustomerSearchTerm('');
                        }}
                        className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-white transition-colors cursor-pointer"
                        title="Remove selection"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  )}
                </div>

                {/* 4. Products Selector Table */}
                <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
                  <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Order Products</h3>
                      <p className="text-xs text-slate-500 mt-0.5">Add products, set quantities, select packet options, and add instructions</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenProductModal(null)}
                      className="flex items-center gap-1.5 px-[12px] py-[6px] h-[34px] rounded-[10px] bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                    >
                      <Plus size={15} />
                      <span>Add Item</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs min-w-[760px]">
                      <thead>
                        <tr className="bg-slate-100/70 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                          <th className="py-3 px-4 min-w-[220px]">Item Name</th>
                          <th className="py-3 px-3">Price (₹)</th>
                          <th className="py-3 px-3 w-24">Qty</th>
                          <th className="py-3 px-3">Total (₹)</th>
                          {isCustomisation && <th className="py-3 px-3 text-center">Packet (₹5/box)</th>}
                          <th className="py-3 px-3">Mfg Instructions</th>
                          <th className="py-3 px-3">Packing Instructions</th>
                          <th className="py-3 px-3 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                        {orderItems.length === 0 ? (
                          <tr>
                            <td colSpan={isCustomisation ? 8 : 7} className="py-12 text-center text-slate-400">
                              <div className="flex flex-col items-center justify-center gap-2">
                                <ShoppingBag size={28} className="text-slate-300" />
                                <p className="font-semibold text-slate-600">No items added yet</p>
                                <button
                                  type="button"
                                  onClick={() => handleOpenProductModal(null)}
                                  className="mt-1 px-3.5 py-1.5 rounded-xl bg-indigo-50 text-indigo-600 text-xs font-bold hover:bg-indigo-100 transition-colors cursor-pointer"
                                >
                                  + Click here to add item
                                </button>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          orderItems.map((item, idx) => {
                            const lineKey = item.lineId || `${item.itemId}-${idx}`;
                            return (
                              <tr key={lineKey} className="hover:bg-slate-50/60 transition-colors">
                                <td className="py-3 px-4">
                                  {item.itemName ? (
                                    <div
                                      onClick={() => handleOpenProductModal(lineKey)}
                                      className="flex items-center justify-between gap-2.5 bg-slate-50 hover:bg-indigo-50/70 border border-slate-200 hover:border-indigo-300 p-1.5 rounded-xl transition-all cursor-pointer group shadow-2xs min-w-[200px]"
                                      title="Click to change product"
                                    >
                                      <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="relative w-8 h-8 rounded-lg bg-white border border-slate-200 overflow-hidden flex-shrink-0">
                                          <Image
                                            src={item.imageUrl || '/logo.png'}
                                            alt={item.itemName}
                                            fill
                                            className="object-contain p-1"
                                          />
                                        </div>
                                        <div className="min-w-0 text-left">
                                          <p className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
                                            {item.itemName}
                                          </p>
                                          <p className="text-[10px] text-slate-400 font-mono truncate">{item.itemCode}</p>
                                        </div>
                                      </div>
                                      <Pencil size={13} className="text-slate-400 group-hover:text-indigo-600 flex-shrink-0 mr-1" />
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenProductModal(lineKey)}
                                      className="w-full flex items-center justify-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer min-w-[200px]"
                                    >
                                      <Plus size={14} />
                                      <span>Select Product</span>
                                    </button>
                                  )}
                                </td>
                                <td className="py-3 px-3">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={item.unitPrice}
                                    onChange={(e) => handleItemLineChange(lineKey, 'unitPrice', e.target.value)}
                                    className="w-20 px-2 py-1 border border-slate-200 rounded-lg font-semibold text-slate-800 text-xs focus:outline-none focus:border-indigo-500"
                                  />
                                </td>
                                <td className="py-3 px-3">
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      step="0.1"
                                      min="0.1"
                                      value={item.quantity}
                                      onChange={(e) => handleItemLineChange(lineKey, 'quantity', e.target.value)}
                                      className="w-16 px-2 py-1 border border-slate-200 rounded-lg font-bold text-indigo-600 text-xs focus:outline-none focus:border-indigo-500"
                                    />
                                    <span className="text-[10px] font-semibold text-slate-400">{item.unit}</span>
                                  </div>
                                </td>
                                <td className="py-3 px-3 font-extrabold text-slate-900">
                                  ₹ {item.lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </td>

                                {/* Packet Column - Displays only when customisation is enabled */}
                                {isCustomisation && (
                                  <td className="py-3 px-3 text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => handleItemLineChange(lineKey, 'hasPacket', !item.hasPacket)}
                                        className={`px-2.5 py-1 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                                          item.hasPacket
                                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                                            : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'
                                        }`}
                                        title={`Packet charge ₹5 per box (${noOfBoxes} boxes = ₹${noOfBoxes * 5})`}
                                      >
                                        {item.hasPacket ? (
                                          <>
                                            <Check size={13} />
                                            <span>₹{noOfBoxes * 5}</span>
                                          </>
                                        ) : (
                                          <>
                                            <X size={13} />
                                            <span>₹5</span>
                                          </>
                                        )}
                                      </button>
                                    </div>
                                  </td>
                                )}

                                <td className="py-3 px-3">
                                  <input
                                    type="text"
                                    placeholder="Mfg notes..."
                                    value={item.manufacturingDescription || ''}
                                    onChange={(e) => handleItemLineChange(lineKey, 'mfgDesc', e.target.value)}
                                    className="w-full px-2 py-1 text-[11px] border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500"
                                  />
                                </td>
                                <td className="py-3 px-3">
                                  <input
                                    type="text"
                                    placeholder="Packing notes..."
                                    value={item.packingDescription || ''}
                                    onChange={(e) => handleItemLineChange(lineKey, 'pckDesc', e.target.value)}
                                    className="w-full px-2 py-1 text-[11px] border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500"
                                  />
                                </td>
                                <td className="py-3 px-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveItemLine(lineKey)}
                                    className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                                  >
                                    <Trash2 size={15} />
                                  </button>
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

              {/* Right Column (4 Cols): Sticky Order Summary & Payment Checkout Panel */}
              <div className="lg:col-span-4 space-y-6">
                <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-2xs space-y-5 sticky top-6">
                  <h3 className="text-sm font-extrabold text-slate-900 border-b border-slate-100 pb-3.5">
                    Order Summary
                  </h3>

                  <div className="space-y-2.5 text-xs text-slate-600">
                    <div className="flex justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-400">Selected Slot:</span>
                      <span className="font-bold text-slate-800">{orderSlot}</span>
                    </div>

                    <div className="flex justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-400">Total Items Selected:</span>
                      <span className="font-bold text-slate-800">{orderItems.length} items</span>
                    </div>

                    <div className="flex justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-500 font-semibold">Sub Total:</span>
                      <span className="font-bold text-slate-800">
                        ₹ {subTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    {/* Breakdown based on Customisation Toggle */}
                    {isCustomisation ? (
                      <>
                        <div className="flex justify-between py-1 border-b border-slate-50">
                          <span className="text-slate-500 font-semibold">
                            Box Charges ({noOfBoxes} × ₹{selectedBoxPrice}):
                          </span>
                          <span className="font-bold text-slate-800">
                            + ₹ {boxChargesTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </div>

                        <div className="flex justify-between py-1 border-b border-slate-50">
                          <span className="text-slate-500 font-semibold">
                            Sticker Charges ({hasSticker ? `${noOfBoxes} × ₹10` : 'No'}):
                          </span>
                          <span className="font-bold text-slate-800">
                            + ₹ {stickerChargesTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </div>

                        <div className="flex justify-between py-1 border-b border-slate-50">
                          <span className="text-slate-500 font-semibold">
                            Shrink Charges ({hasShrink ? `${noOfBoxes} × ₹10` : 'No'}):
                          </span>
                          <span className="font-bold text-slate-800">
                            + ₹ {shrinkChargesTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </div>

                        <div className="flex justify-between py-1 border-b border-slate-50">
                          <span className="text-slate-500 font-semibold">
                            Packet Charges ({orderItems.filter((i) => i.hasPacket).length} items × {noOfBoxes} boxes × ₹5):
                          </span>
                          <span className="font-bold text-slate-800">
                            + ₹ {packetChargesTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </div>

                        <div className="pt-2">
                          <label className="block text-xs font-bold text-slate-700 mb-1">Discount (₹)</label>
                          <input
                            type="number"
                            step="1"
                            min="0"
                            placeholder="0"
                            value={discountAmount}
                            onChange={(e) => setDiscountAmount(e.target.value)}
                            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 bg-slate-50/50 font-semibold"
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="pt-2 space-y-2.5">
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Packing Charges (₹)</label>
                            <input
                              type="number"
                              step="1"
                              min="0"
                              placeholder="0"
                              value={packingCharges}
                              onChange={(e) => setPackingCharges(e.target.value)}
                              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 bg-slate-50/50 font-semibold"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Additional Charges (₹)</label>
                            <input
                              type="number"
                              step="1"
                              min="0"
                              placeholder="0"
                              value={additionalCharges}
                              onChange={(e) => setAdditionalCharges(e.target.value)}
                              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 bg-slate-50/50 font-semibold"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Discount (₹)</label>
                            <input
                              type="number"
                              step="1"
                              min="0"
                              placeholder="0"
                              value={discountAmount}
                              onChange={(e) => setDiscountAmount(e.target.value)}
                              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 bg-slate-50/50 font-semibold"
                            />
                          </div>
                        </div>
                      </>
                    )}

                    <div className="flex justify-between py-2.5 border-t border-slate-200 text-base font-extrabold text-slate-900 mt-2">
                      <span>Grand Total:</span>
                      <span className="text-indigo-600">
                        ₹ {grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {/* Payment Details */}
                  <div className="space-y-3.5 pt-1">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-xs font-bold text-slate-700">Received Amount (₹)</label>
                        {parseFloat(receivedAmount) > grandTotal && (
                          <span className="text-[10px] font-bold text-red-600">Exceeds total!</span>
                        )}
                      </div>
                      <input
                        type="number"
                        step="0.01"
                        max={grandTotal}
                        placeholder="0.00"
                        value={receivedAmount}
                        onChange={(e) => {
                          const val = e.target.value;
                          const num = parseFloat(val) || 0;
                          if (num > grandTotal && grandTotal > 0) {
                            setReceivedAmount(String(grandTotal));
                          } else {
                            setReceivedAmount(val);
                          }
                        }}
                        className={`w-full px-3.5 py-2.5 text-sm font-bold border rounded-xl focus:outline-none bg-slate-50/50 ${
                          parseFloat(receivedAmount) > grandTotal
                            ? 'text-red-600 border-red-300 focus:border-red-500'
                            : 'text-indigo-600 border-slate-200 focus:border-indigo-500'
                        }`}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Payment Mode</label>
                      <div className="grid grid-cols-3 gap-2">
                        {(['UPI', 'Cash', 'Card'] as const).map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => setPaymentMode(mode)}
                            className={`px-[8px] py-[4px] h-[30px] rounded-[6px] text-xs font-bold border transition-all cursor-pointer ${paymentMode === mode
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                              }`}
                          >
                            {mode}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Payment Status</label>
                      <span
                        className={`block w-full text-center py-2.5 rounded-xl text-xs font-extrabold border ${paymentStatus === 'Completed'
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                          : paymentStatus === 'Partial'
                            ? 'bg-sky-50 text-sky-600 border-sky-200'
                            : 'bg-amber-50 text-amber-600 border-amber-200'
                          }`}
                      >
                        {paymentStatus}
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Initial Order Status</label>
                      <CustomSelect
                        options={ALL_ORDER_STATUSES.map((s) => ({ value: s, label: s }))}
                        value={orderStatus}
                        onChange={(val) => setOrderStatus(val as OrderStatus)}
                        className="w-full"
                        buttonClassName="w-full"
                      />
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 space-y-2">
                    <button
                      type="button"
                      onClick={handleCreateOrderSubmit}
                      disabled={isSubmitting || !selectedCustomer || orderItems.length === 0}
                      className="w-full flex items-center justify-center gap-2 px-[8px] py-[4px] h-[30px] rounded-[6px] bg-gradient-to-br from-indigo-600 to-indigo-800 hover:from-indigo-700 hover:to-indigo-900 text-white text-xs font-bold shadow-md transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                      <span>{editingOrder ? 'Update Order' : 'Create Order'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsAddOrderModalOpen(false)}
                      className="w-full px-[8px] py-[4px] h-[30px] rounded-[6px] bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
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

      {/* ── 8. INLINE ADD CUSTOMER MODAL ────────────────────────────── */}
      {isAddCustomerModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Add New Customer</h3>
              <button onClick={() => setIsAddCustomerModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveQuickCustomer} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Customer Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Traders"
                  value={newCustomerForm.name}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, name: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
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
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email (Optional)</label>
                  <input
                    type="email"
                    placeholder="email@example.com"
                    value={newCustomerForm.email}
                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, email: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
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
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddCustomerModalOpen(false)}
                  className="px-[8px] py-[4px] h-[30px] rounded-[6px] text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-[8px] py-[4px] h-[30px] rounded-[6px] text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
                >
                  {isSubmitting && <Loader2 size={14} className="animate-spin" />}
                  <span>Save</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── 8.5. SELECT PRODUCT MODAL ────────────────────────────── */}
      {isAddItemSelectorOpen && (
        <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-150 font-sans">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Select Product</h3>
                <p className="text-xs text-slate-400 mt-0.5">Search and select a product for the order</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddItemSelectorOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                <X size={20} />
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
                className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm border border-slate-200 rounded-2xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 font-semibold bg-slate-50/50"
              />
              <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>

            {/* Product List Grid */}
            <div className="max-h-80 overflow-y-auto border border-slate-200/90 rounded-2xl divide-y divide-slate-100 p-1 bg-slate-50/30 no-scrollbar">
              {filteredProductMasterForModal.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 font-semibold">
                  No matching products found. Try a different search query.
                </div>
              ) : (
                filteredProductMasterForModal.map((prod) => (
                  <div
                    key={prod.id}
                    onClick={() => handleSelectProductFromModal(prod)}
                    className="p-3 rounded-xl hover:bg-indigo-50/80 transition-all cursor-pointer flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative w-11 h-11 rounded-xl bg-white border border-slate-200 overflow-hidden flex-shrink-0 shadow-2xs group-hover:border-indigo-200">
                        <Image src={prod.imageUrl || '/logo.png'} alt={prod.name} fill className="object-contain p-1.5" />
                      </div>
                      <div className="min-w-0 text-left">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-extrabold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
                            {prod.name}
                          </p>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 font-mono">
                            {prod.code}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {prod.category} • Unit: <span className="font-semibold text-slate-700">{prod.unit}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-xs font-extrabold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-xl border border-indigo-100">
                        ₹ {prod.price}
                      </span>
                      <button
                        type="button"
                        className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-2xs transition-colors cursor-pointer"
                      >
                        Select
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-xs font-semibold text-slate-500">
                Found {filteredProductMasterForModal.length} products
              </span>
              <button
                type="button"
                onClick={() => setIsAddItemSelectorOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
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
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-full bg-red-50 text-red-500 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Order</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Are you sure you want to delete order <strong className="text-slate-800">{deletingOrder.code}</strong> for {deletingOrder.customerName}?
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button onClick={() => setDeletingOrder(null)} className="px-[8px] py-[4px] h-[30px] rounded-[6px] text-xs font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50">
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteOrder}
                disabled={isDeleting}
                className="flex items-center gap-2 px-[8px] py-[4px] h-[30px] rounded-[6px] text-xs font-semibold bg-red-600 hover:bg-red-700 text-white shadow-xs disabled:opacity-50"
              >
                {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

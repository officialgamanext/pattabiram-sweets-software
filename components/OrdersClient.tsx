'use client';

import { useState, useEffect } from 'react';
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
  | 'Delivered'
  | 'Confirmed'
  | 'Processing'
  | 'Pending';

export interface OrderItemLine {
  itemId: string;
  itemCode: string;
  itemName: string;
  category: string;
  unit: string;
  imageUrl?: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  manufacturingDescription?: string;
  packingDescription?: string;
}

export interface OrderRecord {
  id: string;
  code: string;
  customerName: string;
  customerMobile: string;
  customerId?: string;
  customerType?: 'Customer' | 'Wholesaler';
  slot: SlotTime;
  orderTime: string;
  items: OrderItemLine[];
  totalItems: number;
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

const SLOT_TIMES: SlotTime[] = [
  '9:00 AM - 12:00 PM',
  '12:00 PM - 3:00 PM',
  '3:00 PM - 6:00 PM',
  '6:00 PM - 9:00 PM',
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

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [itemsPerPage, setItemsPerPage] = useState('10');
  const [selectedDate, setSelectedDate] = useState('29 May 2025');

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

  // Item selector check state inside item selector modal
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [itemSearchTerm, setItemSearchTerm] = useState('');

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

  // Open Full Screen Add Order Modal for a specific Slot
  const handleOpenAddOrderModal = (slot: SlotTime = '9:00 AM - 12:00 PM') => {
    setOrderSlot(slot);
    setSelectedCustomer(null);
    setCustomerSearchTerm('');
    setOrderItems([]);
    setReceivedAmount('0');
    setPaymentMode('UPI');
    setPaymentStatus('Pending');
    setOrderStatus('Order Created');
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

  // Open Item Multi-Selector Modal
  const handleOpenItemSelector = () => {
    setSelectedItemIds(orderItems.map((i) => i.itemId));
    setItemSearchTerm('');
    setIsAddItemSelectorOpen(true);
  };

  // Confirm Item Selection from Multi-Selector Modal
  const handleConfirmSelectedItems = () => {
    const updatedOrderItems: OrderItemLine[] = selectedItemIds.map((itemId) => {
      const existing = orderItems.find((i) => i.itemId === itemId);
      if (existing) return existing;

      const master = itemsMaster.find((i) => i.id === itemId);
      return {
        itemId: master?.id || itemId,
        itemCode: master?.code || 'ITM-000',
        itemName: master?.name || 'Item',
        category: master?.category || 'General',
        unit: master?.unit || 'KG',
        imageUrl: master?.imageUrl || '',
        unitPrice: master?.price || 0,
        quantity: 1,
        lineTotal: master?.price || 0,
        manufacturingDescription: '',
        packingDescription: '',
      };
    });

    setOrderItems(updatedOrderItems);
    setIsAddItemSelectorOpen(false);
  };

  // Handle Item Quantity & Price Changes in Order Table
  const handleItemLineChange = (
    itemId: string,
    field: 'quantity' | 'unitPrice' | 'mfgDesc' | 'pckDesc',
    val: string
  ) => {
    setOrderItems((prev) =>
      prev.map((item) => {
        if (item.itemId !== itemId) return item;

        let qty = item.quantity;
        let price = item.unitPrice;
        let mfgDesc = item.manufacturingDescription;
        let pckDesc = item.packingDescription;

        if (field === 'quantity') qty = Math.max(0.01, parseFloat(val) || 0);
        if (field === 'unitPrice') price = Math.max(0, parseFloat(val) || 0);
        if (field === 'mfgDesc') mfgDesc = val;
        if (field === 'pckDesc') pckDesc = val;

        return {
          ...item,
          quantity: qty,
          unitPrice: price,
          lineTotal: Math.round(qty * price * 100) / 100,
          manufacturingDescription: mfgDesc,
          packingDescription: pckDesc,
        };
      })
    );
  };

  // Remove Item line
  const handleRemoveItemLine = (itemId: string) => {
    setOrderItems((prev) => prev.filter((i) => i.itemId !== itemId));
  };

  // Calculate Order Grand Total
  const grandTotal = orderItems.reduce((acc, curr) => acc + curr.lineTotal, 0);

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

    try {
      setIsSubmitting(true);
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      // Generate Order Code e.g. #ORD-250529-001
      const orderCount = orders.length + 1;
      const orderCode = `#ORD-${now.getFullYear().toString().slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(orderCount).padStart(3, '0')}`;

      await addDoc(collection(db, 'orders'), {
        code: orderCode,
        customerName: selectedCustomer.name,
        customerMobile: selectedCustomer.mobile,
        customerId: selectedCustomer.id,
        customerType: selectedCustomer.type,
        slot: orderSlot,
        orderTime: timeStr,
        items: orderItems,
        totalItems: orderItems.length,
        totalAmount: grandTotal,
        receivedAmount: parseFloat(receivedAmount) || 0,
        paymentMode: paymentMode,
        paymentStatus: paymentStatus,
        orderStatus: orderStatus,
        createdAt: serverTimestamp(),
      });

      setIsAddOrderModalOpen(false);
    } catch (err: any) {
      console.error('Failed to create order:', err);
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

  // Filtered Item Master for Item Selector Modal
  const filteredItemsMaster = itemsMaster.filter((item) => {
    const term = itemSearchTerm.toLowerCase();
    return (
      item.name.toLowerCase().includes(term) ||
      item.code.toLowerCase().includes(term) ||
      item.category.toLowerCase().includes(term)
    );
  });

  // Calculate Order Statistics for Summary Bar at bottom
  const totalOrdersCount = orders.length;
  const totalAmountSum = orders.reduce((acc, o) => acc + (o.totalAmount || 0), 0);
  const confirmedCount = orders.filter((o) => o.orderStatus === 'Confirmed' || o.orderStatus === 'Order Created').length;
  const pendingCount = orders.filter((o) => o.orderStatus === 'Pending' || o.paymentStatus === 'Pending').length;
  const processingCount = orders.filter((o) => o.orderStatus === 'Processing' || o.orderStatus.includes('Started')).length;
  const deliveredCount = orders.filter((o) => o.orderStatus === 'Delivered').length;

  const statusFilterOptions: CustomSelectOption[] = [
    { value: 'All', label: 'All Statuses' },
    ...ALL_ORDER_STATUSES.map((s) => ({ value: s, label: s })),
  ];

  return (
    <div className="w-full flex flex-col gap-6 font-sans pb-10">

      {/* ── 1. Page Header & Top Sub-Tabs ──────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Orders</h1>
          <nav className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
            <Link href="/" className="hover:text-indigo-600 transition-colors">Dashboard</Link>
            <span>&gt;</span>
            <span className="text-slate-800 font-medium">Orders</span>
          </nav>
        </div>

        {/* Top Controls: Date Picker & Filters */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 shadow-2xs">
            <Calendar size={14} className="text-slate-400" />
            <span>{selectedDate}</span>
            <div className="flex items-center gap-1 ml-2 pl-2 border-l border-slate-200">
              <button onClick={() => { }} className="text-slate-400 hover:text-slate-700">
                <ChevronLeft size={14} />
              </button>
              <button onClick={() => { }} className="text-slate-400 hover:text-slate-700">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors cursor-pointer">
            <Filter size={14} />
            <span>Filters</span>
          </button>
        </div>
      </div>

      {/* ── 2. Navigation Sub-Tabs (Orders by Slot vs Orders List) ── */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('slot')}
            className={`px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'slot'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
              }`}
          >
            Orders by Slot
          </button>
          <button
            onClick={() => setActiveTab('list')}
            className={`px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'list'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
              }`}
          >
            Orders List ({orders.length})
          </button>
        </div>

        <button
          onClick={() => handleOpenAddOrderModal('9:00 AM - 12:00 PM')}
          className="flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 hover:from-indigo-600 hover:to-indigo-800 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
        >
          <Plus size={16} />
          <span>Add New Order</span>
        </button>
      </div>

      {/* ── 3. SLOT VIEW (Grid of 4 Time Slots as shown in image) ───── */}
      {activeTab === 'slot' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {SLOT_TIMES.map((slotTime) => {
            const slotOrders = orders.filter((o) => o.slot === slotTime);

            return (
              <div
                key={slotTime}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-xs flex flex-col overflow-hidden"
              >
                {/* Slot Column Header */}
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <span className="font-extrabold text-sm text-slate-800">{slotTime}</span>
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600">
                    {slotOrders.length} Orders
                  </span>
                </div>

                {/* + Add Order Button inside Slot */}
                <div className="p-3 border-b border-slate-100">
                  <button
                    onClick={() => handleOpenAddOrderModal(slotTime)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border-2 border-dashed border-indigo-200 text-indigo-600 hover:bg-indigo-50/50 text-xs font-bold transition-all cursor-pointer"
                  >
                    <Plus size={15} />
                    <span>+ Add Order</span>
                  </button>
                </div>

                {/* Order Cards List inside Slot */}
                <div className="p-3 space-y-3 flex-1 max-h-[550px] overflow-y-auto">
                  {slotOrders.length === 0 ? (
                    <div className="py-10 text-center text-slate-400 text-xs">
                      No orders in this slot yet.
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

                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-slate-900 truncate max-w-[160px]">
                            {order.customerName}
                          </h4>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${order.orderStatus === 'Delivered'
                              ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                              : order.orderStatus === 'Confirmed'
                                ? 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                                : order.orderStatus === 'Processing'
                                  ? 'bg-sky-50 text-sky-600 border border-sky-100'
                                  : 'bg-amber-50 text-amber-600 border border-amber-100'
                              }`}
                          >
                            {order.orderStatus}
                          </span>
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

                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); navigateToOrder(order.id); }}
                              className="p-1 text-slate-400 hover:text-indigo-600 rounded-md"
                              title="View Order Details"
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setDeletingOrder(order); }}
                              className="p-1 text-slate-400 hover:text-red-600 rounded-md"
                              title="Delete Order"
                            >
                              <Trash2 size={14} />
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
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                  >
                    View all {slotOrders.length} orders →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── 4. LIST VIEW TAB ────────────────────────────────────────── */}
      {activeTab === 'list' && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-64">
              <input
                type="text"
                placeholder="Search orders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-3.5 pr-9 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
              />
              <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>

            <CustomSelect
              options={statusFilterOptions}
              value={statusFilter}
              onChange={setStatusFilter}
              icon={<Filter size={14} />}
              size="md"
            />
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
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      No orders created yet.
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => (
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
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${order.paymentStatus === 'Completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                          }`}>
                          {order.paymentStatus}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-800">{order.orderStatus}</td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); navigateToOrder(order.id); }}
                            className="p-1 text-slate-400 hover:text-indigo-600"
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeletingOrder(order); }}
                            className="p-1 text-slate-400 hover:text-red-600"
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
        </div>
      )}

      {/* ── 5. BOTTOM METRICS & SUMMARY CARDS BAR (As shown in image) ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Total Orders Card */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
            <ShoppingBag size={20} />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-semibold">Total Orders</p>
            <h3 className="text-lg font-extrabold text-slate-900">{totalOrdersCount}</h3>
            <p className="text-[10px] text-emerald-600 font-bold">+12.5% vs yesterday</p>
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
            <p className="text-[10px] text-emerald-600 font-bold">+18.3% vs yesterday</p>
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
            <p className="text-[10px] text-slate-400">38.5% of total</p>
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
            <p className="text-[10px] text-slate-400">26.9% of total</p>
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
            <p className="text-[10px] text-slate-400">23.1% of total</p>
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
            <p className="text-[10px] text-slate-400">11.5% of total</p>
          </div>
        </div>
      </div>

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
                  <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">Create New Order</h2>
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
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateOrderSubmit}
                disabled={isSubmitting || !selectedCustomer || orderItems.length === 0}
                className="flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                <span>Create Order</span>
              </button>
              <button
                onClick={() => setIsAddOrderModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-2 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer ml-1"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Modal Main Body: 2 Columns Layout */}
          <div className="flex-1 overflow-y-auto p-6 sm:p-8 w-full">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Left Column (2 Cols): Time Slot, Customer Search, Product Items Table */}
              <div className="lg:col-span-2 space-y-6">

                {/* 1. Time Slot Selector */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs space-y-3">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Order Time Slot *
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {SLOT_TIMES.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setOrderSlot(slot)}
                        className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${orderSlot === slot
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs ring-2 ring-indigo-600/20'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Customer / Wholesaler Search */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Customer / Wholesaler *
                    </label>

                    <button
                      type="button"
                      onClick={() => setIsAddCustomerModalOpen(true)}
                      className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100"
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

                {/* 3. Products Selector Table */}
                <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
                  <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Order Products</h3>
                      <p className="text-xs text-slate-500 mt-0.5">Add products and set quantity and special instructions</p>
                    </div>

                    <button
                      type="button"
                      onClick={handleOpenItemSelector}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                    >
                      <Plus size={15} />
                      <span>+ Add Products</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs min-w-[700px]">
                      <thead>
                        <tr className="bg-slate-100/70 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                          <th className="py-3 px-4">Item</th>
                          <th className="py-3 px-3">Price (₹)</th>
                          <th className="py-3 px-3 w-28">Qty</th>
                          <th className="py-3 px-3">Total (₹)</th>
                          <th className="py-3 px-3">Mfg Instructions</th>
                          <th className="py-3 px-3">Packing Instructions</th>
                          <th className="py-3 px-3 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                        {orderItems.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-12 text-center text-slate-400">
                              <div className="flex flex-col items-center justify-center gap-2">
                                <ShoppingBag size={28} className="text-slate-300" />
                                <p className="font-semibold text-slate-600">No items added yet</p>
                                <button
                                  type="button"
                                  onClick={handleOpenItemSelector}
                                  className="mt-1 px-3.5 py-1.5 rounded-xl bg-indigo-50 text-indigo-600 text-xs font-bold hover:bg-indigo-100 transition-colors"
                                >
                                  + Click here to add products
                                </button>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          orderItems.map((item) => (
                            <tr key={item.itemId} className="hover:bg-slate-50/60 transition-colors">
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2.5">
                                  <div className="relative w-9 h-9 rounded-lg bg-slate-50 border border-slate-200 overflow-hidden flex-shrink-0">
                                    <Image
                                      src={item.imageUrl || '/logo.png'}
                                      alt={item.itemName}
                                      fill
                                      className="object-contain p-1"
                                    />
                                  </div>
                                  <div>
                                    <p className="font-bold text-slate-900">{item.itemName}</p>
                                    <p className="text-[10px] text-slate-400 font-mono">{item.itemCode}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-3">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={item.unitPrice}
                                  onChange={(e) => handleItemLineChange(item.itemId, 'unitPrice', e.target.value)}
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
                                    onChange={(e) => handleItemLineChange(item.itemId, 'quantity', e.target.value)}
                                    className="w-16 px-2 py-1 border border-slate-200 rounded-lg font-bold text-indigo-600 text-xs focus:outline-none focus:border-indigo-500"
                                  />
                                  <span className="text-[10px] font-semibold text-slate-400">{item.unit}</span>
                                </div>
                              </td>
                              <td className="py-3 px-3 font-extrabold text-slate-900">
                                ₹ {item.lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="py-3 px-3">
                                <input
                                  type="text"
                                  placeholder="Mfg notes..."
                                  value={item.manufacturingDescription || ''}
                                  onChange={(e) => handleItemLineChange(item.itemId, 'mfgDesc', e.target.value)}
                                  className="w-full px-2 py-1 text-[11px] border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500"
                                />
                              </td>
                              <td className="py-3 px-3">
                                <input
                                  type="text"
                                  placeholder="Packing notes..."
                                  value={item.packingDescription || ''}
                                  onChange={(e) => handleItemLineChange(item.itemId, 'pckDesc', e.target.value)}
                                  className="w-full px-2 py-1 text-[11px] border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500"
                                />
                              </td>
                              <td className="py-3 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItemLine(item.itemId)}
                                  className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>

              {/* Right Column (1 Col): Sticky Order Summary & Payment Checkout Panel */}
              <div className="space-y-6">
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

                    <div className="flex justify-between py-2 border-b border-slate-100 text-base font-extrabold text-slate-900">
                      <span>Grand Total:</span>
                      <span className="text-indigo-600">
                        ₹ {grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {/* Payment Details */}
                  <div className="space-y-3.5 pt-1">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Received Amount (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={receivedAmount}
                        onChange={(e) => setReceivedAmount(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-sm font-bold text-indigo-600 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 bg-slate-50/50"
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
                            className={`py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${paymentMode === mode
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
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-800 hover:from-indigo-700 hover:to-indigo-900 text-white text-xs font-bold shadow-md transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                      <span>Create Order</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsAddOrderModalOpen(false)}
                      className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
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

      {/* ── 7. ITEM MULTI-SELECTOR MODAL ───────────────────────────── */}
      {isAddItemSelectorOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Select Products for Order</h3>
              <button onClick={() => setIsAddItemSelectorOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={18} />
              </button>
            </div>

            <div className="relative">
              <input
                type="text"
                placeholder="Search products..."
                value={itemSearchTerm}
                onChange={(e) => setItemSearchTerm(e.target.value)}
                className="w-full pl-3.5 pr-9 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
              />
              <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>

            <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
              {filteredItemsMaster.map((item) => {
                const isChecked = selectedItemIds.includes(item.id);
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      if (isChecked) {
                        setSelectedItemIds((prev) => prev.filter((id) => id !== item.id));
                      } else {
                        setSelectedItemIds((prev) => [...prev, item.id]);
                      }
                    }}
                    className={`p-3 flex items-center justify-between cursor-pointer transition-colors ${isChecked ? 'bg-indigo-50/60' : 'hover:bg-slate-50'
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        readOnly
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      <div className="relative w-8 h-8 rounded-lg bg-slate-100 overflow-hidden flex-shrink-0">
                        <Image src={item.imageUrl || '/logo.png'} alt={item.name} fill className="object-contain p-1" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">{item.name}</p>
                        <p className="text-[10px] text-slate-400">{item.category} • {item.unit}</p>
                      </div>
                    </div>

                    <span className="font-extrabold text-xs text-indigo-600">₹ {item.price}</span>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <span className="text-xs text-slate-500">Selected: {selectedItemIds.length} items</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddItemSelectorOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSelectedItems}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
                >
                  Confirm Selected Items
                </button>
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
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
                >
                  {isSubmitting && <Loader2 size={14} className="animate-spin" />}
                  <span>Save</span>
                </button>
              </div>
            </form>
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
              <button onClick={() => setDeletingOrder(null)} className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50">
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteOrder}
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

    </div>
  );
}

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  WalletCards,
  Search,
  TrendingUp,
  Clock,
  CheckCircle2,
  Phone,
  MessageCircle,
  ExternalLink,
  ShoppingBag,
  User,
  Users,
  ChevronDown,
  Plus,
  Trash2,
  X,
  Loader2,
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';

export interface OrderItem {
  itemId?: string;
  itemName?: string;
  name?: string;
  quantity?: number;
  unitPrice?: number;
  lineTotal?: number;
  unit?: string;
}

export interface PaymentEntry {
  id: string;
  amount: number;
  mode: string;
  note: string;
  paidAt: string;
}

export interface CreditOrder {
  id: string;
  code?: string;
  orderId?: string;
  customerName: string;
  customerMobile: string;
  customerId?: string;
  customerType?: string;
  customerAddress?: string;
  orderDate?: string;
  manufacturingDate?: string;
  expectedDeliveryDate?: string;
  slot?: string;
  totalAmount: number;
  receivedAmount: number;
  paymentMode?: string;
  paymentStatus?: string;
  orderStatus?: string;
  payments?: PaymentEntry[];
  items?: OrderItem[];
  createdAt?: any;
}

export interface CustomerCreditSummary {
  key: string;
  customerId: string;
  customerName: string;
  customerMobile: string;
  customerType: string;
  customerAddress: string;
  totalOrdersCount: number;
  totalBilled: number;
  totalPaid: number;
  outstandingBalance: number;
  latestOrderDate: string;
  oldestOrderDate: string;
  orders: CreditOrder[];
}

export default function CreditClient() {
  const { employeeProfile, user } = useAuth();
  const [orders, setOrders] = useState<CreditOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Tab State: 'orders' | 'customers'
  const [activeTab, setActiveTab] = useState<'orders' | 'customers'>('orders');

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [customerTypeFilter, setCustomerTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All'); // 'All', 'Partial', 'Pending'
  const [sortBy, setSortBy] = useState<'due_desc' | 'due_asc' | 'date_desc' | 'date_asc'>('due_desc');

  // Expanded Customer Drilldown State
  const [expandedCustomerKey, setExpandedCustomerKey] = useState<string | null>(null);

  // Quick Payment Collection Modal State
  const [selectedOrderForPayment, setSelectedOrderForPayment] = useState<CreditOrder | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [payAmount, setPayAmount] = useState<string>('');
  const [payMode, setPayMode] = useState<string>('UPI');
  const [payNote, setPayNote] = useState<string>('');
  const [isSavingPayment, setIsSavingPayment] = useState(false);

  // Modal Split Payment Sub-state
  const [isModalSplit, setIsModalSplit] = useState(false);
  const [modalSplits, setModalSplits] = useState<
    { id: string; mode: string; amount: string; note: string }[]
  >([{ id: 'split-1', mode: 'UPI', amount: '', note: '' }]);

  // 1. Subscribe to Firebase orders in real-time
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'orders'),
      (snap) => {
        const list: CreditOrder[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            code: data.code || data.orderId || `#ORD-${d.id.slice(0, 5).toUpperCase()}`,
            customerName: data.customerName || 'Unknown Customer',
            customerMobile: data.customerMobile || data.phone || '',
            customerId: data.customerId || '',
            customerType: data.customerType || 'Customer',
            customerAddress: data.customerAddress || data.deliveryAddress || '',
            orderDate: data.orderDate || data.manufacturingDate || '',
            manufacturingDate: data.manufacturingDate || '',
            expectedDeliveryDate: data.expectedDeliveryDate || '',
            slot: data.slot || '',
            totalAmount: parseFloat(data.totalAmount || data.grandTotal || 0) || 0,
            receivedAmount: parseFloat(data.receivedAmount || 0) || 0,
            paymentMode: data.paymentMode || 'UPI',
            paymentStatus: data.paymentStatus || (data.receivedAmount >= data.totalAmount ? 'Completed' : 'Partial'),
            orderStatus: data.orderStatus || data.status || 'Order Created',
            payments: Array.isArray(data.payments) ? data.payments : [],
            items: Array.isArray(data.items) ? data.items : [],
            createdAt: data.createdAt,
          };
        });
        setOrders(list);
        setIsLoading(false);
      },
      (err) => {
        console.error('Error fetching credit orders:', err);
        toast.error('Failed to load orders', 'Could not sync real-time credit data.');
        setIsLoading(false);
      }
    );

    return () => unsub();
  }, []);

  // 2. Filter for orders that have outstanding credit balance or partial/pending status
  const creditOrders = useMemo(() => {
    return orders.filter((order) => {
      // Exclude cancelled / rejected orders if any
      if (order.orderStatus === 'Cancelled' || order.orderStatus === 'Rejected') return false;

      const total = order.totalAmount || 0;
      const received = order.receivedAmount || 0;
      const due = Math.max(0, total - received);

      // Condition: Has outstanding due or paymentStatus is Partial / Pending
      return due > 0.5 || order.paymentStatus === 'Partial' || order.paymentStatus === 'Pending';
    });
  }, [orders]);

  // 3. Analytics Aggregations
  const analytics = useMemo(() => {
    let totalOutstanding = 0;
    let totalBilled = 0;
    let totalCollected = 0;
    let partialOrdersCount = 0;
    let pendingOrdersCount = 0;
    const uniqueCustomerKeys = new Set<string>();

    creditOrders.forEach((o) => {
      const total = o.totalAmount || 0;
      const received = o.receivedAmount || 0;
      const due = Math.max(0, total - received);

      totalOutstanding += due;
      totalBilled += total;
      totalCollected += received;

      if (o.paymentStatus === 'Partial') partialOrdersCount++;
      else if (o.paymentStatus === 'Pending' || received <= 0) pendingOrdersCount++;

      const cKey = (o.customerMobile || o.customerName || o.id).toLowerCase().trim();
      if (cKey) uniqueCustomerKeys.add(cKey);
    });

    const recoveryRate = totalBilled > 0 ? (totalCollected / totalBilled) * 100 : 0;

    return {
      totalOutstanding,
      totalBilled,
      totalCollected,
      totalCreditOrders: creditOrders.length,
      partialOrdersCount,
      pendingOrdersCount,
      totalCreditCustomers: uniqueCustomerKeys.size,
      recoveryRate,
    };
  }, [creditOrders]);

  // 4. Filtered & Sorted Order-Wise List
  const filteredOrderWise = useMemo(() => {
    let result = creditOrders.filter((order) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        (order.code && order.code.toLowerCase().includes(q)) ||
        (order.customerName && order.customerName.toLowerCase().includes(q)) ||
        (order.customerMobile && order.customerMobile.includes(q)) ||
        (order.customerAddress && order.customerAddress.toLowerCase().includes(q));

      const matchType =
        customerTypeFilter === 'All' ||
        (customerTypeFilter === 'Wholesaler' && order.customerType === 'Wholesaler') ||
        (customerTypeFilter === 'Customer' && order.customerType !== 'Wholesaler');

      const matchStatus =
        statusFilter === 'All' ||
        (statusFilter === 'Partial' && order.paymentStatus === 'Partial') ||
        (statusFilter === 'Pending' && (order.paymentStatus === 'Pending' || order.receivedAmount <= 0));

      return matchSearch && matchType && matchStatus;
    });

    // Sorting
    result.sort((a, b) => {
      const dueA = Math.max(0, (a.totalAmount || 0) - (a.receivedAmount || 0));
      const dueB = Math.max(0, (b.totalAmount || 0) - (b.receivedAmount || 0));

      if (sortBy === 'due_desc') return dueB - dueA;
      if (sortBy === 'due_asc') return dueA - dueB;
      if (sortBy === 'date_desc') {
        return (b.orderDate || '').localeCompare(a.orderDate || '');
      }
      if (sortBy === 'date_asc') {
        return (a.orderDate || '').localeCompare(b.orderDate || '');
      }
      return 0;
    });

    return result;
  }, [creditOrders, searchQuery, customerTypeFilter, statusFilter, sortBy]);

  // 5. Customer-Wise Aggregation
  const customerWiseList = useMemo(() => {
    const map = new Map<string, CustomerCreditSummary>();

    creditOrders.forEach((order) => {
      const mobileKey = order.customerMobile ? order.customerMobile.trim().replace(/\D/g, '') : '';
      const nameKey = (order.customerName || 'Unknown').trim().toLowerCase();
      const uniqueKey = mobileKey ? `mob_${mobileKey}` : `name_${nameKey}`;

      const total = order.totalAmount || 0;
      const received = order.receivedAmount || 0;
      const due = Math.max(0, total - received);
      const ordDate = order.orderDate || '';

      if (!map.has(uniqueKey)) {
        map.set(uniqueKey, {
          key: uniqueKey,
          customerId: order.customerId || '',
          customerName: order.customerName || 'Unknown Customer',
          customerMobile: order.customerMobile || '',
          customerType: order.customerType || 'Customer',
          customerAddress: order.customerAddress || '',
          totalOrdersCount: 1,
          totalBilled: total,
          totalPaid: received,
          outstandingBalance: due,
          latestOrderDate: ordDate,
          oldestOrderDate: ordDate,
          orders: [order],
        });
      } else {
        const item = map.get(uniqueKey)!;
        item.totalOrdersCount += 1;
        item.totalBilled += total;
        item.totalPaid += received;
        item.outstandingBalance += due;
        item.orders.push(order);

        if (ordDate) {
          if (!item.latestOrderDate || ordDate > item.latestOrderDate) {
            item.latestOrderDate = ordDate;
          }
          if (!item.oldestOrderDate || ordDate < item.oldestOrderDate) {
            item.oldestOrderDate = ordDate;
          }
        }
      }
    });

    let list = Array.from(map.values());

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (c) =>
          c.customerName.toLowerCase().includes(q) ||
          c.customerMobile.includes(q) ||
          c.customerAddress.toLowerCase().includes(q)
      );
    }

    // Customer Type Filter
    if (customerTypeFilter !== 'All') {
      list = list.filter((c) =>
        customerTypeFilter === 'Wholesaler' ? c.customerType === 'Wholesaler' : c.customerType !== 'Wholesaler'
      );
    }

    // Sorting
    list.sort((a, b) => {
      if (sortBy === 'due_desc') return b.outstandingBalance - a.outstandingBalance;
      if (sortBy === 'due_asc') return a.outstandingBalance - b.outstandingBalance;
      if (sortBy === 'date_desc') return (b.latestOrderDate || '').localeCompare(a.latestOrderDate || '');
      if (sortBy === 'date_asc') return (a.latestOrderDate || '').localeCompare(b.latestOrderDate || '');
      return 0;
    });

    return list;
  }, [creditOrders, searchQuery, customerTypeFilter, sortBy]);

  // Open Payment Modal for an Order
  const handleOpenPaymentModal = (order: CreditOrder) => {
    setSelectedOrderForPayment(order);
    const balanceDue = Math.max(0, (order.totalAmount || 0) - (order.receivedAmount || 0));
    setPayAmount(String(balanceDue.toFixed(2)));
    setPayMode(order.paymentMode && !order.paymentMode.includes('Split') ? order.paymentMode : 'UPI');
    setPayNote('');
    setIsModalSplit(false);
    setModalSplits([
      {
        id: 'split-1',
        mode: 'UPI',
        amount: String(balanceDue.toFixed(2)),
        note: '',
      },
    ]);
    setIsPaymentModalOpen(true);
  };

  // Confirm Payment Recording (supports split payments)
  const handleConfirmPayment = async () => {
    if (!selectedOrderForPayment) return;

    const balanceDue = Math.max(
      0,
      (selectedOrderForPayment.totalAmount || 0) - (selectedOrderForPayment.receivedAmount || 0)
    );

    let collectedAmount = 0;
    let newPaymentEntries: PaymentEntry[] = [];

    if (isModalSplit) {
      const validSplits = modalSplits.filter((s) => (parseFloat(s.amount) || 0) > 0);
      if (validSplits.length === 0) {
        toast.warning('Amount Required', 'Please enter a valid amount for at least one split method.');
        return;
      }
      collectedAmount = validSplits.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
      if (collectedAmount > balanceDue + 0.01) {
        toast.error(
          'Amount Exceeds Due',
          `Total split amount (₹${collectedAmount.toFixed(2)}) cannot exceed balance due of ₹${balanceDue.toFixed(2)}.`
        );
        return;
      }

      newPaymentEntries = validSplits.map((s, idx) => ({
        id: `pay-${Date.now()}-${idx}`,
        amount: parseFloat(s.amount) || 0,
        mode: s.mode || 'UPI',
        note: s.note || 'Split balance payment',
        paidAt: new Date().toISOString(),
      }));
    } else {
      collectedAmount = parseFloat(payAmount) || 0;
      if (collectedAmount <= 0) {
        toast.warning('Amount Required', 'Please enter a valid payment amount.');
        return;
      }
      if (collectedAmount > balanceDue + 0.01) {
        toast.error(
          'Amount Exceeds Due',
          `Payment amount (₹${collectedAmount.toFixed(2)}) cannot exceed balance due of ₹${balanceDue.toFixed(2)}.`
        );
        return;
      }

      newPaymentEntries = [
        {
          id: `pay-${Date.now()}`,
          amount: collectedAmount,
          mode: payMode,
          note: payNote.trim() || 'Credit payment collection',
          paidAt: new Date().toISOString(),
        },
      ];
    }

    try {
      setIsSavingPayment(true);
      const existingList = Array.isArray(selectedOrderForPayment.payments)
        ? selectedOrderForPayment.payments
        : selectedOrderForPayment.receivedAmount > 0
        ? [
            {
              id: 'initial-pay',
              amount: selectedOrderForPayment.receivedAmount,
              mode: selectedOrderForPayment.paymentMode || 'UPI',
              note: 'Initial payment',
              paidAt: selectedOrderForPayment.createdAt?.toDate?.()?.toISOString?.() || new Date().toISOString(),
            },
          ]
        : [];

      const updatedPayments = [...existingList, ...newPaymentEntries];
      const newTotalReceived = updatedPayments.reduce((s, p) => s + (parseFloat(String(p.amount)) || 0), 0);
      const newPaymentStatus =
        newTotalReceived >= (selectedOrderForPayment.totalAmount || 0)
          ? 'Completed'
          : newTotalReceived > 0
          ? 'Partial'
          : 'Pending';

      const uniqueModes = Array.from(new Set(updatedPayments.map((p) => p.mode).filter(Boolean)));
      const finalCombinedMode =
        uniqueModes.length > 1 ? `Split (${uniqueModes.join(', ')})` : uniqueModes[0] || 'UPI';

      await updateDoc(doc(db, 'orders', selectedOrderForPayment.id), {
        payments: updatedPayments,
        receivedAmount: newTotalReceived,
        paymentMode: finalCombinedMode,
        paymentStatus: newPaymentStatus,
        updatedAt: serverTimestamp(),
      });

      toast.success(
        'Payment Recorded',
        `Received ₹${collectedAmount.toFixed(2)} for ${selectedOrderForPayment.code}. Status updated to ${newPaymentStatus}.`
      );

      setIsPaymentModalOpen(false);
      setSelectedOrderForPayment(null);
    } catch (err: any) {
      console.error('Failed to update payment:', err);
      toast.error('Payment Failed', err?.message || 'Could not save payment record.');
    } finally {
      setIsSavingPayment(false);
    }
  };

  // Helper for WhatsApp payment reminder link
  const generateWhatsAppLink = (customerName: string, mobile: string, dueAmount: number, orderCode?: string) => {
    if (!mobile) return '#';
    const cleanMobile = mobile.replace(/\D/g, '');
    const mobileWithCountry = cleanMobile.length === 10 ? `91${cleanMobile}` : cleanMobile;

    let text = `*Pattabiram Sweets — Payment Reminder*\n\nDear *${customerName}*,\nThis is a gentle reminder regarding your outstanding balance of *₹${dueAmount.toFixed(
      2
    )}*`;
    if (orderCode) {
      text += ` for Order *${orderCode}*.`;
    } else {
      text += ` across your orders with us.`;
    }
    text += `\n\nKindly arrange the payment at your earliest convenience.\n\nThank you for choosing *Pattabiram Sweets*!`;

    return `https://wa.me/${mobileWithCountry}?text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="w-full min-h-screen bg-[#f6f6f7] font-sans pb-16">
      {/* ── Top Header Banner ── */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shadow-2xs">
              <WalletCards size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-slate-900 tracking-tight">Credit & Due Balances</h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-rose-100 text-rose-800 border border-rose-200">
                  {analytics.totalCreditOrders} Active Dues
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Track partial orders, manage customer credit ledgers, and collect split payments.
              </p>
            </div>
          </div>

          {/* Quick Tab Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setActiveTab('orders')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'orders'
                  ? 'bg-white text-[#02626D] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShoppingBag size={14} />
              <span>Order-Wise Dues</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                  activeTab === 'orders' ? 'bg-teal-50 text-[#02626D]' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {creditOrders.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('customers')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'customers'
                  ? 'bg-white text-[#02626D] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users size={14} />
              <span>Customer-Wise Dues</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                  activeTab === 'customers' ? 'bg-teal-50 text-[#02626D]' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {analytics.totalCreditCustomers}
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* ── Analytics Metric Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Outstanding */}
          <div className="bg-gradient-to-br from-rose-500 to-rose-700 text-white p-5 rounded-2xl shadow-sm relative overflow-hidden flex flex-col justify-between">
            <div className="absolute right-3 -bottom-3 opacity-15 pointer-events-none">
              <WalletCards size={90} />
            </div>
            <div>
              <p className="text-rose-100 text-xs font-bold uppercase tracking-wider">Total Outstanding Due</p>
              <h3 className="text-2xl sm:text-3xl font-black mt-1 tracking-tight">
                ₹ {analytics.totalOutstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </h3>
            </div>
            <div className="mt-4 pt-3 border-t border-white/20 flex items-center justify-between text-xs text-rose-100 font-medium">
              <span>Across {analytics.totalCreditOrders} orders</span>
              <span className="font-bold bg-white/20 px-2 py-0.5 rounded-full text-[10px]">
                {analytics.totalCreditCustomers} Customers
              </span>
            </div>
          </div>

          {/* Partial Orders */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Partial Payment Orders</p>
                <h3 className="text-2xl font-black text-slate-900 mt-1">{analytics.partialOrdersCount}</h3>
              </div>
              <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center">
                <Clock size={20} />
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Unpaid / Pending:</span>
              <span className="font-bold text-slate-800">{analytics.pendingOrdersCount} orders</span>
            </div>
          </div>

          {/* Total Collected on Credit Orders */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Advance / Paid Amount</p>
                <h3 className="text-2xl font-black text-emerald-700 mt-1">
                  ₹ {analytics.totalCollected.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </h3>
              </div>
              <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center">
                <TrendingUp size={20} />
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Gross Billed:</span>
              <span className="font-bold text-slate-800">
                ₹ {analytics.totalBilled.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Recovery Ratio Progress */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Recovery Ratio</p>
                <span className="text-xs font-black text-[#02626D] bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                  {analytics.recoveryRate.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden mt-3 p-0.5 border border-slate-200">
                <div
                  className="bg-gradient-to-r from-emerald-500 to-[#02626D] h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, analytics.recoveryRate)}%` }}
                />
              </div>
            </div>
            <div className="mt-4 pt-2 flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1 text-emerald-700 font-bold">
                <CheckCircle2 size={12} /> {analytics.recoveryRate.toFixed(0)}% Received
              </span>
              <span className="text-rose-600 font-bold">
                {(100 - analytics.recoveryRate).toFixed(0)}% Due
              </span>
            </div>
          </div>
        </div>

        {/* ── Search, Filters & Sorting Toolbar ── */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative w-full md:w-80">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={
                activeTab === 'orders'
                  ? 'Search by Order #, Customer, Mobile...'
                  : 'Search by Customer Name, Mobile, Address...'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9.5 pl-9 pr-3 text-xs font-medium border border-slate-200 rounded-xl bg-slate-50/70 focus:bg-white focus:outline-none focus:border-[#02626D] transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filter Group */}
          <div className="flex items-center gap-2 w-full md:w-auto flex-wrap justify-end">
            {/* Customer Type Filter */}
            <div className="flex items-center gap-1 text-xs bg-slate-100 p-1 rounded-xl border border-slate-200">
              {['All', 'Customer', 'Wholesaler'].map((type) => (
                <button
                  key={type}
                  onClick={() => setCustomerTypeFilter(type)}
                  className={`px-3 py-1 rounded-lg font-bold transition-all text-xs cursor-pointer ${
                    customerTypeFilter === type
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {type === 'Customer' ? 'Retail' : type}
                </button>
              ))}
            </div>

            {/* Status Filter (Only in Orders Tab) */}
            {activeTab === 'orders' && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 px-3 text-xs font-bold border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-[#02626D]"
              >
                <option value="All">All Payment Statuses</option>
                <option value="Partial">Partial Payments</option>
                <option value="Pending">Unpaid / Pending</option>
              </select>
            )}

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="h-9 px-3 text-xs font-bold border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-[#02626D]"
            >
              <option value="due_desc">Highest Due First</option>
              <option value="due_asc">Lowest Due First</option>
              <option value="date_desc">Newest Date</option>
              <option value="date_asc">Oldest Date</option>
            </select>
          </div>
        </div>

        {/* ── Tab Content ── */}
        {isLoading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-16 flex flex-col items-center justify-center gap-3">
            <Loader2 size={32} className="animate-spin text-[#02626D]" />
            <p className="text-xs font-bold text-slate-500">Loading Credit Ledger data...</p>
          </div>
        ) : activeTab === 'orders' ? (
          /* ── TAB 1: ORDER-WISE VIEW ── */
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">Partial & Due Orders</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Showing {filteredOrderWise.length} orders with outstanding balance
                </p>
              </div>
            </div>

            {filteredOrderWise.length === 0 ? (
              <div className="p-12 text-center flex flex-col items-center justify-center gap-2 text-slate-400">
                <CheckCircle2 size={36} className="text-emerald-500" />
                <p className="text-sm font-bold text-slate-700">No Outstanding Credit Orders Found</p>
                <p className="text-xs text-slate-500">
                  {searchQuery ? 'Try clearing your search filters.' : 'All customer accounts are settled and paid up!'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase text-[11px] tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Order Code</th>
                      <th className="py-3 px-4">Customer Details</th>
                      <th className="py-3 px-4">Date / Slot</th>
                      <th className="py-3 px-4 text-right">Total Amount</th>
                      <th className="py-3 px-4 text-right">Received</th>
                      <th className="py-3 px-4 text-right">Balance Due</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Quick Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {filteredOrderWise.map((order) => {
                      const due = Math.max(0, (order.totalAmount || 0) - (order.receivedAmount || 0));
                      const isWholesale = order.customerType === 'Wholesaler';

                      return (
                        <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                          {/* Order Code */}
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                            <Link
                              href={`/orders/${order.id}`}
                              className="text-[#02626D] hover:underline flex items-center gap-1 font-bold"
                            >
                              <span>{order.code}</span>
                              <ExternalLink size={11} className="opacity-60" />
                            </Link>
                            <span className="text-[10px] text-slate-400 font-sans block">{order.orderStatus}</span>
                          </td>

                          {/* Customer Info */}
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              <span>{order.customerName}</span>
                              {isWholesale && (
                                <span className="text-[9px] font-black bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded uppercase">
                                  B2B
                                </span>
                              )}
                            </div>
                            {order.customerMobile ? (
                              <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5">
                                <Phone size={11} />
                                <span>{order.customerMobile}</span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-400">No Mobile</span>
                            )}
                          </td>

                          {/* Date & Slot */}
                          <td className="py-3.5 px-4">
                            <div className="text-slate-800 font-semibold">{order.orderDate || '—'}</div>
                            {order.slot && <div className="text-[10px] text-slate-500 font-sans">{order.slot}</div>}
                          </td>

                          {/* Total */}
                          <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                            ₹ {(order.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>

                          {/* Received */}
                          <td className="py-3.5 px-4 text-right font-semibold text-emerald-700">
                            ₹ {(order.receivedAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            {order.paymentMode && (
                              <span className="block text-[9px] text-slate-400 font-sans truncate max-w-[100px] ml-auto">
                                {order.paymentMode}
                              </span>
                            )}
                          </td>

                          {/* Balance Due */}
                          <td className="py-3.5 px-4 text-right">
                            <span className="inline-block px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 font-black text-xs shadow-2xs">
                              ₹ {due.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                          </td>

                          {/* Status Badge */}
                          <td className="py-3.5 px-4 text-center">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide border ${
                                order.paymentStatus === 'Completed'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : order.paymentStatus === 'Partial'
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : 'bg-rose-50 text-rose-700 border-rose-200'
                              }`}
                            >
                              {order.paymentStatus || 'Partial'}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* WhatsApp Reminder */}
                              {order.customerMobile && (
                                <a
                                  href={generateWhatsAppLink(order.customerName, order.customerMobile, due, order.code)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 text-emerald-600 hover:bg-emerald-50 border border-emerald-200 rounded-lg transition-colors"
                                  title="Send WhatsApp Payment Reminder"
                                >
                                  <MessageCircle size={14} />
                                </a>
                              )}

                              {/* Collect Payment Modal Button */}
                              <button
                                type="button"
                                onClick={() => handleOpenPaymentModal(order)}
                                className="px-2.5 py-1.5 rounded-lg bg-[#02626D] hover:bg-[#014d56] text-white text-[11px] font-bold transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                              >
                                <Plus size={12} />
                                <span>Collect</span>
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
          </div>
        ) : (
          /* ── TAB 2: CUSTOMER-WISE VIEW ── */
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">Customer Credit Ledgers</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Consolidated credit balance by customer ({customerWiseList.length} customers with outstanding due)
                </p>
              </div>
            </div>

            {customerWiseList.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center flex flex-col items-center justify-center gap-2 text-slate-400">
                <CheckCircle2 size={36} className="text-emerald-500" />
                <p className="text-sm font-bold text-slate-700">No Outstanding Customer Ledgers Found</p>
                <p className="text-xs text-slate-500">
                  {searchQuery ? 'Try clearing your search query.' : 'All customer accounts are clear!'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {customerWiseList.map((cust) => {
                  const isExpanded = expandedCustomerKey === cust.key;
                  const isWholesale = cust.customerType === 'Wholesaler';

                  return (
                    <div
                      key={cust.key}
                      className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden transition-all"
                    >
                      {/* Customer Summary Card Header */}
                      <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div className="flex items-start gap-3.5">
                          <div className="w-11 h-11 rounded-2xl bg-teal-50 border border-teal-200 text-[#02626D] flex items-center justify-center shrink-0">
                            {isWholesale ? <Users size={20} /> : <User size={20} />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-base font-extrabold text-slate-900">{cust.customerName}</h4>
                              <span
                                className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase ${
                                  isWholesale
                                    ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                                }`}
                              >
                                {cust.customerType}
                              </span>
                              <span className="text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full">
                                {cust.totalOrdersCount} Partial {cust.totalOrdersCount === 1 ? 'Order' : 'Orders'}
                              </span>
                            </div>

                            <div className="flex items-center gap-4 text-xs text-slate-500 mt-1 flex-wrap">
                              {cust.customerMobile && (
                                <span className="flex items-center gap-1 text-slate-600 font-medium">
                                  <Phone size={12} /> {cust.customerMobile}
                                </span>
                              )}
                              {cust.customerAddress && (
                                <span className="text-slate-400 truncate max-w-xs">{cust.customerAddress}</span>
                              )}
                              {cust.latestOrderDate && (
                                <span className="text-slate-400">Latest: {cust.latestOrderDate}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Financial Figures & Actions */}
                        <div className="flex items-center justify-between lg:justify-end gap-6 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                          <div className="text-right">
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Due</span>
                            <span className="text-lg font-black text-rose-600">
                              ₹ {cust.outstandingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                            <span className="text-[10px] text-slate-400 block">
                              Billed: ₹{cust.totalBilled.toFixed(0)} | Paid: ₹{cust.totalPaid.toFixed(0)}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {/* WhatsApp Reminder for Customer */}
                            {cust.customerMobile && (
                              <a
                                href={generateWhatsAppLink(
                                  cust.customerName,
                                  cust.customerMobile,
                                  cust.outstandingBalance
                                )}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors"
                                title="Send WhatsApp Consolidated Reminder"
                              >
                                <MessageCircle size={15} />
                                <span className="hidden sm:inline">WhatsApp</span>
                              </a>
                            )}

                            {/* Toggle Drilldown Orders Button */}
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedCustomerKey(isExpanded ? null : cust.key)
                              }
                              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer ${
                                isExpanded
                                  ? 'bg-[#02626D] text-white border-[#02626D]'
                                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              <span>{isExpanded ? 'Hide Orders' : 'View Orders'}</span>
                              <ChevronDown
                                size={14}
                                className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                              />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Customer Orders Drilldown Section */}
                      {isExpanded && (
                        <div className="border-t border-slate-100 bg-slate-50/70 p-4 sm:p-5 space-y-3 animate-in fade-in">
                          <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                            <span>Pending Orders Breakdown ({cust.orders.length})</span>
                            <span>Total Due: ₹ {cust.outstandingBalance.toFixed(2)}</span>
                          </h5>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {cust.orders.map((ord) => {
                              const ordDue = Math.max(0, (ord.totalAmount || 0) - (ord.receivedAmount || 0));

                              return (
                                <div
                                  key={ord.id}
                                  className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between gap-3"
                                >
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      <Link
                                        href={`/orders/${ord.id}`}
                                        className="font-mono font-bold text-xs text-[#02626D] hover:underline flex items-center gap-1"
                                      >
                                        <span>{ord.code}</span>
                                        <ExternalLink size={10} />
                                      </Link>
                                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200">
                                        {ord.paymentStatus}
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-slate-500">
                                      Date: <strong className="text-slate-700">{ord.orderDate || '—'}</strong>
                                      {ord.slot ? ` • ${ord.slot}` : ''}
                                    </p>
                                    <div className="text-[11px] text-slate-500">
                                      Total: ₹{ord.totalAmount?.toFixed(2)} | Paid: ₹{ord.receivedAmount?.toFixed(2)}
                                    </div>
                                  </div>

                                  <div className="text-right space-y-1.5 shrink-0">
                                    <div>
                                      <span className="text-[9px] font-bold text-slate-400 block uppercase">Due</span>
                                      <span className="text-xs font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                        ₹ {ordDue.toFixed(2)}
                                      </span>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => handleOpenPaymentModal(ord)}
                                      className="px-2 py-1 rounded bg-[#02626D] hover:bg-[#014d56] text-white text-[10px] font-bold shadow-2xs flex items-center gap-1 cursor-pointer ml-auto"
                                    >
                                      <Plus size={10} />
                                      <span>Collect</span>
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Quick Split Payment Collection Modal ── */}
      {isPaymentModalOpen && selectedOrderForPayment && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-50 text-[#02626D] flex items-center justify-center border border-teal-200">
                  <WalletCards size={18} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Collect Due Payment</h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Order <span className="font-bold text-slate-800">{selectedOrderForPayment.code}</span> (
                    {selectedOrderForPayment.customerName})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Order Due Summary Box */}
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 grid grid-cols-3 gap-2 text-center text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Order Total</span>
                <span className="font-extrabold text-slate-800">
                  ₹ {(selectedOrderForPayment.totalAmount || 0).toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Already Paid</span>
                <span className="font-extrabold text-emerald-600">
                  ₹ {(selectedOrderForPayment.receivedAmount || 0).toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Remaining Due</span>
                <span className="font-black text-rose-600">
                  ₹ {Math.max(0, (selectedOrderForPayment.totalAmount || 0) - (selectedOrderForPayment.receivedAmount || 0)).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Single Mode vs Split Payment Mode Switcher */}
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700">Payment Collection Mode</label>
              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setIsModalSplit(false)}
                  className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                    !isModalSplit ? 'bg-[#02626D] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Single Method
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsModalSplit(true);
                    if (modalSplits.length === 0 || (modalSplits.length === 1 && !modalSplits[0].amount)) {
                      setModalSplits([
                        {
                          id: 'split-1',
                          mode: payMode,
                          amount: payAmount || '',
                          note: '',
                        },
                      ]);
                    }
                  }}
                  className={`px-3 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                    isModalSplit ? 'bg-[#02626D] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>Split Payment</span>
                  <span className="text-[9px] bg-amber-400 text-amber-950 px-1 rounded font-black">NEW</span>
                </button>
              </div>
            </div>

            {/* Form Body */}
            {!isModalSplit ? (
              /* Single Payment Inputs */
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">Amount to Collect (₹)</label>
                    <button
                      type="button"
                      onClick={() => {
                        const bal = Math.max(
                          0,
                          (selectedOrderForPayment.totalAmount || 0) - (selectedOrderForPayment.receivedAmount || 0)
                        );
                        setPayAmount(String(bal.toFixed(2)));
                      }}
                      className="text-[10px] font-bold text-[#02626D] hover:underline cursor-pointer"
                    >
                      Fill Full Remaining Due
                    </button>
                  </div>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0.00"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    className="w-full h-10 px-3 text-sm font-black text-slate-900 border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-[#02626D]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Payment Method</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['UPI', 'Cash', 'Card', 'Bank Transfer', 'Cheque', 'Credit'].map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setPayMode(mode)}
                        className={`h-8 rounded-xl text-xs font-bold border transition-all cursor-pointer truncate px-2 ${
                          payMode === mode
                            ? 'bg-[#02626D] text-white border-[#02626D] shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Note / Reference (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Counter payment, GPay ref #12345"
                    value={payNote}
                    onChange={(e) => setPayNote(e.target.value)}
                    className="w-full h-8.5 px-3 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-[#02626D]"
                  />
                </div>
              </div>
            ) : (
              /* Split Payment Inputs */
              <div className="space-y-3 bg-[#f0f9fa] p-3 rounded-2xl border border-[#b2e3e8]">
                <div className="flex items-center justify-between text-xs font-bold text-[#02626D]">
                  <span>Split Entries</span>
                  <span>
                    Total Split:{' '}
                    ₹{' '}
                    {modalSplits
                      .reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0)
                      .toFixed(2)}
                  </span>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {modalSplits.map((split, index) => {
                    const balanceDue = Math.max(
                      0,
                      (selectedOrderForPayment.totalAmount || 0) - (selectedOrderForPayment.receivedAmount || 0)
                    );
                    const currentOtherTotal = modalSplits.reduce(
                      (sum, s, i) => (i === index ? sum : sum + (parseFloat(s.amount) || 0)),
                      0
                    );
                    const fillBal = Math.max(0, balanceDue - currentOtherTotal);

                    return (
                      <div key={split.id || index} className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-2">
                        <div className="flex items-center gap-2">
                          <select
                            value={split.mode}
                            onChange={(e) => {
                              const newMode = e.target.value;
                              setModalSplits((prev) =>
                                prev.map((s, i) => (i === index ? { ...s, mode: newMode } : s))
                              );
                            }}
                            className="h-8 px-2 text-xs font-bold text-slate-800 border border-slate-300 rounded-lg bg-slate-50"
                          >
                            <option value="UPI">UPI</option>
                            <option value="Cash">Cash</option>
                            <option value="Card">Card</option>
                            <option value="Bank Transfer">Bank Transfer</option>
                            <option value="Cheque">Cheque</option>
                          </select>

                          <input
                            type="number"
                            step="any"
                            min="0"
                            placeholder="0.00"
                            value={split.amount}
                            onChange={(e) => {
                              const val = e.target.value;
                              setModalSplits((prev) =>
                                prev.map((s, i) => (i === index ? { ...s, amount: val } : s))
                              );
                            }}
                            className="flex-1 h-8 px-2 text-xs font-black text-slate-900 border border-slate-300 rounded-lg bg-white"
                          />

                          {fillBal > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setModalSplits((prev) =>
                                  prev.map((s, i) => (i === index ? { ...s, amount: String(fillBal.toFixed(2)) } : s))
                                );
                              }}
                              className="h-8 px-2 text-[10px] font-bold bg-teal-50 text-[#02626D] hover:bg-teal-100 border border-teal-200 rounded-lg cursor-pointer shrink-0"
                            >
                              Fill Bal
                            </button>
                          )}

                          {modalSplits.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setModalSplits((prev) => prev.filter((_, i) => i !== index))}
                              className="h-8 w-7 flex items-center justify-center text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer shrink-0"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>

                        <input
                          type="text"
                          placeholder="Note / Ref # (optional)"
                          value={split.note || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setModalSplits((prev) =>
                              prev.map((s, i) => (i === index ? { ...s, note: val } : s))
                            );
                          }}
                          className="w-full h-6.5 px-2 text-[11px] border border-slate-200 rounded-md bg-slate-50/50"
                        />
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const balanceDue = Math.max(
                      0,
                      (selectedOrderForPayment.totalAmount || 0) - (selectedOrderForPayment.receivedAmount || 0)
                    );
                    const currentTotal = modalSplits.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
                    const remaining = Math.max(0, balanceDue - currentTotal);

                    setModalSplits((prev) => [
                      ...prev,
                      {
                        id: `split-${Date.now()}`,
                        mode: prev.some((p) => p.mode === 'UPI') ? 'Cash' : 'UPI',
                        amount: remaining > 0 ? String(remaining.toFixed(2)) : '',
                        note: '',
                      },
                    ]);
                  }}
                  className="w-full h-7.5 rounded-lg border border-dashed border-[#02626D]/40 hover:border-[#02626D] bg-white text-[#02626D] text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-all"
                >
                  <Plus size={13} />
                  <span>Add Split Payment Method</span>
                </button>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPayment}
                disabled={isSavingPayment}
                className="px-5 py-2 rounded-xl bg-[#02626D] hover:bg-[#014d56] text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSavingPayment ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={14} />
                    <span>Confirm Payment</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

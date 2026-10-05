'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Users,
  Building2,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Package,
  Receipt,
  Printer,
  FileText,
  WalletCards,
  CreditCard,
  TrendingUp,
  Tag,
  DollarSign,
  Plus,
  Trash2,
  X,
  Loader2,
  Search,
  Eye,
  Check,
  ShieldCheck,
} from 'lucide-react';
import { db } from '@/lib/firebase';
import {
  doc,
  onSnapshot,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { toast } from '@/context/ToastContext';
import Pagination from '@/components/Pagination';
import A4InvoiceModal from '@/components/A4InvoiceModal';
import { useBusinessSettings } from '@/lib/businessSettings';

export interface WholesalerItem {
  id: string;
  code: string;
  name: string;
  personalMobile: string;
  businessName: string;
  businessMobile: string;
  email?: string;
  city: string;
  address: string;
  gstin?: string;
  priceListId?: string;
  priceListName?: string;
  status: 'Active' | 'Inactive';
  date?: string;
  createdAt?: any;
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
  wholesalerGstin?: string;
  deliveryAddress?: string;
  priceListName: string;
  orderDate?: string;
  manufacturingDate?: string;
  expectedDeliveryDate?: string;
  items: any[];
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
  isTransportRequired?: boolean;
  transportCharges?: number;
  packingCharges?: number;
  createdAt?: any;
  updatedAt?: any;
}

const getTodayDateStr = () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export default function WholesalerDetailClient({ wholesalerId }: { wholesalerId: string }) {
  const router = useRouter();
  const { settings: businessSettings } = useBusinessSettings();

  const [wholesaler, setWholesaler] = useState<WholesalerItem | null>(null);
  const [orders, setOrders] = useState<WholesalerOrderRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Tabs: 'profile' | 'orders' | 'credit'
  const [activeTab, setActiveTab] = useState<'profile' | 'orders' | 'credit'>('profile');

  // Orders Tab States (Pagination with limit 24 per page)
  const [ordersSearch, setOrdersSearch] = useState('');
  const [ordersStatusFilter, setOrdersStatusFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 24;

  // Credit Tab States
  const [creditFilter, setCreditFilter] = useState<'Pending' | 'All'>('Pending');

  // Collect Payment Modal State
  const [collectOrder, setCollectOrder] = useState<WholesalerOrderRecord | null>(null);
  const [collectAmount, setCollectAmount] = useState<string>('');
  const [collectMode, setCollectMode] = useState<string>('UPI');
  const [collectDate, setCollectDate] = useState<string>(getTodayDateStr());
  const [collectNote, setCollectNote] = useState<string>('');
  const [isSavingCollect, setIsSavingCollect] = useState(false);

  // A4 Invoice Modal State
  const [a4InvoiceOrder, setA4InvoiceOrder] = useState<WholesalerOrderRecord | null>(null);

  // 1. Fetch Wholesaler Profile
  useEffect(() => {
    if (!wholesalerId) return;

    const unsubWholesaler = onSnapshot(
      doc(db, 'wholesalers', wholesalerId),
      (docSnap) => {
        if (docSnap.exists()) {
          setWholesaler({ id: docSnap.id, ...docSnap.data() } as WholesalerItem);
        } else {
          setWholesaler(null);
        }
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching wholesaler:', error);
        setLoading(false);
      }
    );

    return () => unsubWholesaler();
  }, [wholesalerId]);

  // 2. Fetch Orders for this Wholesaler Real-time
  useEffect(() => {
    if (!wholesalerId) return;

    const unsubOrders = onSnapshot(
      collection(db, 'orders'),
      (snapshot) => {
        const docs = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as WholesalerOrderRecord[];

        // Filter orders belonging to this wholesaler
        const matchedOrders = docs.filter(
          (o) =>
            o.wholesalerId === wholesalerId ||
            (wholesaler?.code && o.wholesalerId === wholesaler.code) ||
            (wholesaler?.name && o.wholesalerName?.toLowerCase() === wholesaler.name.toLowerCase()) ||
            (wholesaler?.businessName && o.companyName?.toLowerCase() === wholesaler.businessName.toLowerCase()) ||
            (wholesaler?.personalMobile && o.wholesalerMobile === wholesaler.personalMobile) ||
            (wholesaler?.businessMobile && o.wholesalerMobile === wholesaler.businessMobile)
        );

        // Sort latest at top (by orderDate or createdAt descending)
        matchedOrders.sort((a, b) => {
          const dateA = a.orderDate || (a.createdAt?.toDate ? a.createdAt.toDate().toISOString() : '');
          const dateB = b.orderDate || (b.createdAt?.toDate ? b.createdAt.toDate().toISOString() : '');
          if (dateB && dateA) {
            return dateB.localeCompare(dateA);
          }
          return (b.orderId || b.id || '').localeCompare(a.orderId || a.id || '');
        });

        setOrders(matchedOrders);
      },
      (error) => {
        console.error('Error fetching wholesaler orders:', error);
      }
    );

    return () => unsubOrders();
  }, [wholesalerId, wholesaler]);

  // Filtered Orders for the Orders Tab
  const filteredOrders = useMemo(() => {
    return orders.filter((ord) => {
      if (ordersStatusFilter !== 'All' && ord.status !== ordersStatusFilter) {
        return false;
      }
      if (ordersSearch.trim()) {
        const q = ordersSearch.toLowerCase().trim();
        const matchId = (ord.orderId || ord.id || '').toLowerCase().includes(q);
        const matchItems = (ord.items || []).some((it: any) =>
          (it.name || it.itemName || '').toLowerCase().includes(q)
        );
        if (!matchId && !matchItems) return false;
      }
      return true;
    });
  }, [orders, ordersStatusFilter, ordersSearch]);

  // Paginated Orders (24 items per page)
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, currentPage, pageSize]);

  // Credit Tab Filtered Orders
  const creditOrders = useMemo(() => {
    return orders.filter((ord) => {
      const tot = Number(ord.totalAmount) || 0;
      const rec = Number(ord.receivedAmount) || 0;
      const due = Math.max(0, tot - rec);
      if (creditFilter === 'Pending') {
        return due > 0.01;
      }
      return true;
    });
  }, [orders, creditFilter]);

  // Summary Metrics
  const metrics = useMemo(() => {
    let totalBilled = 0;
    let totalPaid = 0;
    let totalDue = 0;
    let pendingCount = 0;

    orders.forEach((o) => {
      const tot = Number(o.totalAmount) || 0;
      const rec = Number(o.receivedAmount) || 0;
      const due = Math.max(0, tot - rec);

      totalBilled += tot;
      totalPaid += rec;
      totalDue += due;
      if (due > 0.01) {
        pendingCount += 1;
      }
    });

    return {
      totalOrders: orders.length,
      totalBilled: Math.round(totalBilled * 100) / 100,
      totalPaid: Math.round(totalPaid * 100) / 100,
      totalDue: Math.round(totalDue * 100) / 100,
      pendingOrdersCount: pendingCount,
    };
  }, [orders]);

  // Open Collect Payment Modal
  const handleOpenCollect = (ord: WholesalerOrderRecord) => {
    setCollectOrder(ord);
    const tot = Number(ord.totalAmount) || 0;
    const rec = Number(ord.receivedAmount) || 0;
    const due = Math.max(0, tot - rec);
    setCollectAmount(due > 0 ? String(due) : '');
    setCollectMode('UPI');
    setCollectDate(getTodayDateStr());
    setCollectNote('');
  };

  // Submit Collect Payment
  const handleSaveCollect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collectOrder) return;

    const amt = parseFloat(collectAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.warning('Invalid Amount', 'Please enter a valid payment amount greater than zero.');
      return;
    }

    const currentReceived = Number(collectOrder.receivedAmount) || 0;
    const totalAmt = Number(collectOrder.totalAmount) || 0;
    const existingPayments = Array.isArray(collectOrder.payments) ? collectOrder.payments : [];

    const newEntry: PaymentEntry = {
      id: `PAY-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      amount: amt,
      mode: collectMode,
      note: collectNote.trim(),
      paidAt: collectDate || getTodayDateStr(),
    };

    try {
      setIsSavingCollect(true);
      const updatedPayments = [...existingPayments, newEntry];
      const newTotalReceived = Math.round((currentReceived + amt) * 100) / 100;
      const isFullyPaid = newTotalReceived >= totalAmt - 0.01;
      const newPaymentStatus: 'Paid' | 'Partial' | 'Pending' = isFullyPaid ? 'Paid' : 'Partial';

      await updateDoc(doc(db, 'orders', collectOrder.id), {
        receivedAmount: newTotalReceived,
        paymentStatus: newPaymentStatus,
        paymentMode: collectMode,
        payments: updatedPayments,
        updatedAt: serverTimestamp(),
      });

      toast.success(
        'Payment Collected',
        `Recorded ₹${amt.toLocaleString('en-IN')} payment for Order ${collectOrder.orderId}.`
      );
      setCollectOrder(null);
    } catch (err: any) {
      console.error('Error recording payment collection:', err);
      toast.error('Payment Failed', err?.message || 'Could not record collected payment.');
    } finally {
      setIsSavingCollect(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-slate-400 gap-3">
        <Loader2 size={32} className="animate-spin text-[#02626D]" />
        <p className="text-sm font-medium">Loading wholesaler profile...</p>
      </div>
    );
  }

  if (!wholesaler) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mb-3">
          <AlertTriangle size={28} />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Wholesaler Not Found</h2>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">
          No wholesaler profile exists with identifier &ldquo;{wholesalerId}&rdquo;.
        </p>
        <Link
          href="/wholesalers"
          className="mt-4 px-4 py-2 bg-[#02626D] text-white text-xs font-semibold rounded-xl hover:bg-[#014d56] transition-colors inline-flex items-center gap-2"
        >
          <ArrowLeft size={14} />
          <span>Back to Wholesalers</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-5 text-slate-800 font-sans pb-16">
      {/* ── Top Header Navigation Bar ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
        <div className="flex items-center gap-3">
          <Link
            href="/wholesalers"
            className="w-9 h-9 rounded-xl bg-white border border-slate-200/90 text-slate-600 hover:text-slate-900 hover:bg-slate-50 flex items-center justify-center shadow-2xs transition-colors shrink-0"
            title="Back to Wholesalers List"
          >
            <ArrowLeft size={16} />
          </Link>

          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {wholesaler.name}
              </h1>
              <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-lg">
                {wholesaler.code}
              </span>
              <span
                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                  wholesaler.status === 'Active'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border-rose-200'
                }`}
              >
                {wholesaler.status}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
              <span>{wholesaler.businessName}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <MapPin size={12} className="text-slate-400" />
                {wholesaler.city}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 text-[#02626D] font-semibold">
                <Tag size={12} />
                {wholesaler.priceListName || 'Standard Rates'}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href="/wholesaler-orders"
            className="h-9 px-3 text-xs font-bold rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs inline-flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Receipt size={14} className="text-slate-500" />
            <span>Wholesale Orders</span>
          </Link>
        </div>
      </div>

      {/* ── Key Metrics Overview Cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Card 1: Total Orders */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Total Orders
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Package size={16} />
            </div>
          </div>
          <span className="text-2xl font-black text-slate-900 font-mono mt-1 block">
            {metrics.totalOrders}
          </span>
          <span className="text-[10.5px] text-slate-400 mt-0.5 block">Lifetime B2B orders</span>
        </div>

        {/* Card 2: Total Billed */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Total Billed
            </span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <TrendingUp size={16} />
            </div>
          </div>
          <span className="text-2xl font-black text-slate-900 font-mono mt-1 block">
            ₹{metrics.totalBilled.toLocaleString('en-IN')}
          </span>
          <span className="text-[10.5px] text-slate-400 mt-0.5 block">Total invoice volume</span>
        </div>

        {/* Card 3: Total Paid */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Total Paid
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <span className="text-2xl font-black text-emerald-700 font-mono mt-1 block">
            ₹{metrics.totalPaid.toLocaleString('en-IN')}
          </span>
          <span className="text-[10.5px] text-emerald-600 mt-0.5 block">Collected revenue</span>
        </div>

        {/* Card 4: Outstanding Credit Due */}
        <div className="bg-white rounded-2xl p-4 border border-rose-200/90 shadow-2xs bg-rose-50/20">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider">
              Credit Due
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <WalletCards size={16} />
            </div>
          </div>
          <span className="text-2xl font-black text-rose-700 font-mono mt-1 block">
            ₹{metrics.totalDue.toLocaleString('en-IN')}
          </span>
          <span className="text-[10.5px] text-rose-600 mt-0.5 block">
            {metrics.pendingOrdersCount} orders pending payment
          </span>
        </div>
      </div>

      {/* ── Main Tab Navigation Bar ────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-1">
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`h-9 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'profile'
              ? 'bg-[#02626D] text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Building2 size={14} />
          <span>Profile</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('orders')}
          className={`h-9 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'orders'
              ? 'bg-[#02626D] text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Receipt size={14} />
          <span>Orders ({orders.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('credit')}
          className={`h-9 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'credit'
              ? 'bg-[#02626D] text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <WalletCards size={14} />
          <span>Credit &amp; Dues ({metrics.pendingOrdersCount})</span>
        </button>
      </div>

      {/* ── TAB 1: Profile Details Tab ────────────────────────────────────── */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Wholesaler Details Card */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-2xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Building2 size={16} className="text-[#02626D]" />
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Wholesaler Profile Information
                </h3>
              </div>
              <span className="text-xs font-mono font-bold text-slate-500">
                Code: {wholesaler.code}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Wholesaler Name
                </span>
                <p className="font-bold text-slate-900 text-sm">{wholesaler.name}</p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Business / Company Name
                </span>
                <p className="font-bold text-slate-900 text-sm">{wholesaler.businessName}</p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Personal Mobile
                </span>
                <p className="font-mono font-semibold text-slate-800">{wholesaler.personalMobile || '—'}</p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Business Mobile
                </span>
                <p className="font-mono font-semibold text-slate-800">{wholesaler.businessMobile || '—'}</p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Email Address
                </span>
                <p className="font-medium text-slate-800">{wholesaler.email || 'N/A'}</p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  City
                </span>
                <p className="font-semibold text-slate-800">{wholesaler.city || '—'}</p>
              </div>

              <div className="sm:col-span-2 p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Full Address
                </span>
                <p className="text-slate-700 leading-relaxed">{wholesaler.address || '—'}</p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  GSTIN Number
                </span>
                <p className="font-mono font-bold text-slate-900">{wholesaler.gstin || 'Unregistered / None'}</p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Assigned Rate List
                </span>
                <p className="font-bold text-[#02626D]">{wholesaler.priceListName || 'Standard Rates'}</p>
              </div>
            </div>
          </div>

          {/* Quick Info & Compliance Card */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs space-y-3">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Account Status &amp; Policy
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                  <span className="text-slate-500">Status:</span>
                  <span className={`px-2 py-0.5 rounded font-bold ${
                    wholesaler.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {wholesaler.status}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                  <span className="text-slate-500">Registration Date:</span>
                  <span className="font-medium text-slate-800">{wholesaler.date || '—'}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-teal-50 border border-teal-100 text-[11px] text-teal-900 space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <ShieldCheck size={14} className="text-[#02626D]" />
                  <span>Assigned Pricing Tier</span>
                </div>
                <p className="leading-relaxed text-teal-800">
                  When new orders are drafted for {wholesaler.name}, item rates are automatically populated from <strong>{wholesaler.priceListName || 'Standard'}</strong> price list.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: Orders Tab (Latest at top, Limit 24, Pagination) ──────── */}
      {activeTab === 'orders' && (
        <div className="space-y-3">
          {/* Orders Filter Toolbar */}
          <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search orders by Order ID or item name..."
                value={ordersSearch}
                onChange={(e) => {
                  setOrdersSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full h-9 pl-9 pr-8 text-xs text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#02626D]"
              />
              {ordersSearch && (
                <button
                  type="button"
                  onClick={() => setOrdersSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-semibold">Status:</span>
              <select
                value={ordersStatusFilter}
                onChange={(e) => {
                  setOrdersStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-9 px-3 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#02626D] cursor-pointer"
              >
                <option value="All">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Processing">Processing</option>
                <option value="Delivered">Delivered</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Orders Table */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs min-w-[850px]">
                <thead>
                  <tr className="text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50/80 border-b border-slate-200">
                    <th className="py-3 px-4">Order ID</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Items</th>
                    <th className="py-3 px-4">Order Total</th>
                    <th className="py-3 px-4">Paid</th>
                    <th className="py-3 px-4">Due</th>
                    <th className="py-3 px-4">Payment</th>
                    <th className="py-3 px-4">Fulfillment</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {paginatedOrders.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        <Package size={28} className="mx-auto mb-1.5 text-slate-300" />
                        <p className="font-semibold text-slate-600">No orders found</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {ordersSearch || ordersStatusFilter !== 'All'
                            ? 'Try clearing the search query or status filter'
                            : 'No orders have been recorded for this wholesaler yet.'}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    paginatedOrders.map((ord) => {
                      const tot = Number(ord.totalAmount) || 0;
                      const rec = Number(ord.receivedAmount) || 0;
                      const due = Math.max(0, tot - rec);
                      const isPaid = rec >= tot - 0.01;
                      const isPartial = rec > 0 && !isPaid;

                      return (
                        <tr key={ord.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4">
                            <Link
                              href={`/wholesaler-orders/${ord.id}`}
                              className="font-mono font-bold text-slate-900 hover:text-[#02626D] hover:underline"
                            >
                              {ord.orderId || ord.id}
                            </Link>
                            {ord.isTransportRequired && (
                              <span className="block text-[9.5px] font-bold text-amber-700 mt-0.5">
                                [Transport]
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-600">{ord.orderDate || '—'}</td>
                          <td className="py-3 px-4 text-slate-600">
                            {ord.items?.length || 0} items
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">
                            ₹{tot.toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 px-4 font-mono font-semibold text-emerald-700">
                            ₹{rec.toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold">
                            {due > 0.01 ? (
                              <span className="text-rose-600 font-black">
                                ₹{due.toLocaleString('en-IN')}
                              </span>
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
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Collect / Manage Payment */}
                              <button
                                type="button"
                                onClick={() => handleOpenCollect(ord)}
                                className="h-7 px-2 text-[11px] font-bold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 inline-flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                                title="Collect / Record Payment"
                              >
                                <WalletCards size={12} className="text-emerald-600" />
                                <span>Collect</span>
                              </button>

                              {/* A4 Invoice Preview */}
                              <button
                                type="button"
                                onClick={() => setA4InvoiceOrder(ord)}
                                className="h-7 px-2 text-[11px] font-bold rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 inline-flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                                title="View / Print A4 Tax Invoice"
                              >
                                <FileText size={12} className="text-indigo-600" />
                                <span>Invoice</span>
                              </button>

                              {/* View Details Page */}
                              <Link
                                href={`/wholesaler-orders/${ord.id}`}
                                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                title="View Details"
                              >
                                <Eye size={14} />
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* 24 Items Per Page Pagination */}
            <Pagination
              currentPage={currentPage}
              totalItems={filteredOrders.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
            />
          </div>
        </div>
      )}

      {/* ── TAB 3: Credit Tab (Pending Dues with Collect feature) ──────────── */}
      {activeTab === 'credit' && (
        <div className="space-y-3">
          {/* Credit Filter Bar */}
          <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200/90 shadow-2xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">Filter Dues:</span>
              <button
                type="button"
                onClick={() => setCreditFilter('Pending')}
                className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                  creditFilter === 'Pending'
                    ? 'bg-rose-50 text-rose-700 border-rose-200 shadow-2xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Pending Dues Only ({metrics.pendingOrdersCount})
              </button>
              <button
                type="button"
                onClick={() => setCreditFilter('All')}
                className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                  creditFilter === 'All'
                    ? 'bg-[#02626D] text-white border-[#02626D] shadow-2xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                All Orders ({orders.length})
              </button>
            </div>

            <div className="text-right">
              <span className="text-[11px] text-slate-400">Total Pending:</span>
              <span className="font-mono font-black text-rose-700 text-sm ml-1.5">
                ₹{metrics.totalDue.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Credit Orders List */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs min-w-[850px]">
                <thead>
                  <tr className="text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50/80 border-b border-slate-200">
                    <th className="py-3 px-4">Order ID</th>
                    <th className="py-3 px-4">Order Date</th>
                    <th className="py-3 px-4">Billed Amount</th>
                    <th className="py-3 px-4">Paid Amount</th>
                    <th className="py-3 px-4">Pending Due</th>
                    <th className="py-3 px-4">Payment Status</th>
                    <th className="py-3 px-4">Installments Count</th>
                    <th className="py-3 px-4 text-center">Collect Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {creditOrders.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <CheckCircle2 size={32} className="mx-auto mb-1.5 text-emerald-400" />
                        <p className="font-semibold text-slate-700">No Pending Credit Dues</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          All orders for this wholesaler have been fully settled!
                        </p>
                      </td>
                    </tr>
                  ) : (
                    creditOrders.map((ord) => {
                      const tot = Number(ord.totalAmount) || 0;
                      const rec = Number(ord.receivedAmount) || 0;
                      const due = Math.max(0, tot - rec);
                      const isPaid = rec >= tot - 0.01;
                      const installments = Array.isArray(ord.payments) ? ord.payments : [];

                      return (
                        <tr key={ord.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">
                            <Link
                              href={`/wholesaler-orders/${ord.id}`}
                              className="hover:text-[#02626D] hover:underline"
                            >
                              {ord.orderId || ord.id}
                            </Link>
                          </td>
                          <td className="py-3 px-4 text-slate-600">{ord.orderDate || '—'}</td>
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">
                            ₹{tot.toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 px-4 font-mono font-semibold text-emerald-700">
                            ₹{rec.toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold">
                            {due > 0.01 ? (
                              <span className="text-rose-600 font-black text-sm">
                                ₹{due.toLocaleString('en-IN')}
                              </span>
                            ) : (
                              <span className="text-emerald-600 font-semibold">₹0 (Paid)</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {isPaid ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Paid
                              </span>
                            ) : rec > 0 ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                Partial
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                                Pending
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-500 font-mono">
                            {installments.length} {installments.length === 1 ? 'payment' : 'payments'}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => handleOpenCollect(ord)}
                              className="h-8 px-3 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs inline-flex items-center gap-1.5 cursor-pointer transition-colors active:scale-95"
                            >
                              <WalletCards size={13} />
                              <span>Collect Payment</span>
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
      )}

      {/* ── Collect Payment Modal ────────────────────────────────────────── */}
      {collectOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <WalletCards size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Collect Credit Payment</h3>
                  <p className="text-[11px] text-slate-400 font-mono">Order: {collectOrder.orderId}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCollectOrder(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Due Breakdown Banner */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Order Total:</span>
                <span className="font-bold text-slate-800">
                  ₹{Number(collectOrder.totalAmount || 0).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Already Received:</span>
                <span className="font-bold text-emerald-700">
                  ₹{Number(collectOrder.receivedAmount || 0).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200 font-bold">
                <span className="text-rose-600">Pending Balance Due:</span>
                <span className="font-mono text-rose-700 text-sm">
                  ₹{Math.max(0, Number(collectOrder.totalAmount || 0) - Number(collectOrder.receivedAmount || 0)).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            <form onSubmit={handleSaveCollect} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Collection Amount (₹) *
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  required
                  value={collectAmount}
                  onChange={(e) => setCollectAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full h-9 px-3 border border-slate-300 rounded-xl font-bold text-slate-900 bg-white focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Payment Mode</label>
                  <select
                    value={collectMode}
                    onChange={(e) => setCollectMode(e.target.value)}
                    className="w-full h-9 px-3 border border-slate-300 rounded-xl font-semibold text-slate-800 bg-white focus:outline-none focus:border-emerald-600 cursor-pointer"
                  >
                    <option value="UPI">UPI / QR Code</option>
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer / NEFT</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Card">Card</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Payment Date</label>
                  <input
                    type="date"
                    value={collectDate}
                    onChange={(e) => setCollectDate(e.target.value)}
                    className="w-full h-9 px-3 border border-slate-300 rounded-xl text-slate-800 bg-white focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Notes / Ref No (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. UPI Ref #123456 or Cheque No"
                  value={collectNote}
                  onChange={(e) => setCollectNote(e.target.value)}
                  className="w-full h-9 px-3 border border-slate-300 rounded-xl text-slate-800 bg-white focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCollectOrder(null)}
                  className="h-9 font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingCollect}
                  className="h-9 font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
                >
                  {isSavingCollect ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check size={14} />
                      <span>Confirm Collection</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── A4 Tax Invoice Print Modal ────────────────────────────────────── */}
      <A4InvoiceModal
        isOpen={Boolean(a4InvoiceOrder)}
        onClose={() => setA4InvoiceOrder(null)}
        order={a4InvoiceOrder}
      />
    </div>
  );
}

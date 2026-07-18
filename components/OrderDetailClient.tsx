'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ShoppingBag,
  Clock,
  CheckCircle2,
  Truck,
  Calendar,
  Tag,
  CreditCard,
  Printer,
  Pencil,
  Trash2,
  Loader2,
  AlertTriangle,
  ChevronRight,
  Circle,
  Factory,
  Package,
  Store,
  X,
  Phone,
  Wallet,
  Plus,
  IndianRupee,
  History,
  BadgeCheck,
  Banknote,
  Smartphone,
} from 'lucide-react';
import { db } from '@/lib/firebase';
import {
  doc,
  onSnapshot,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import type { OrderRecord, OrderStatus, PaymentStatus } from './OrdersClient';
import CustomSelect from '@/components/CustomSelect';

// ── Types ────────────────────────────────────────────────────────
export interface PaymentEntry {
  id: string;
  amount: number;
  mode: 'Cash' | 'Card' | 'UPI';
  note: string;
  paidAt: string; // ISO date string or formatted date
}

interface OrderWithPayments extends OrderRecord {
  payments?: PaymentEntry[];
}

// ── Constants ────────────────────────────────────────────────────
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

const STATUS_TIMELINE: { status: OrderStatus; icon: React.ReactNode }[] = [
  { status: 'Order Created',           icon: <ShoppingBag size={14} /> },
  { status: 'Moved to Manufacturing',  icon: <ArrowLeft size={14} className="rotate-180" /> },
  { status: 'Manufacturing Started',   icon: <Factory size={14} /> },
  { status: 'Manufacturing Completed', icon: <CheckCircle2 size={14} /> },
  { status: 'Moved to Packing',        icon: <ArrowLeft size={14} className="rotate-180" /> },
  { status: 'Packing Started',         icon: <Package size={14} /> },
  { status: 'Packing Completed',       icon: <CheckCircle2 size={14} /> },
  { status: 'Moved to Store',          icon: <ArrowLeft size={14} className="rotate-180" /> },
  { status: 'Received at Store',       icon: <Store size={14} /> },
  { status: 'Awaiting for Delivery',   icon: <Clock size={14} /> },
  { status: 'Delivered',               icon: <Truck size={14} /> },
];

// ── Helpers ──────────────────────────────────────────────────────
function getStatusColor(status: string) {
  switch (status) {
    case 'Order Created':
      return { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', dot: 'bg-indigo-500' };
    case 'Moved to Manufacturing':
      return { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200', dot: 'bg-cyan-500' };
    case 'Manufacturing Started':
      return { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', dot: 'bg-teal-500' };
    case 'Manufacturing Completed':
      return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' };
    case 'Moved to Packing':
      return { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', dot: 'bg-violet-500' };
    case 'Packing Started':
      return { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', dot: 'bg-purple-500' };
    case 'Packing Completed':
      return { bg: 'bg-fuchsia-50', text: 'text-fuchsia-700', border: 'border-fuchsia-200', dot: 'bg-fuchsia-500' };
    case 'Moved to Store':
      return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' };
    case 'Received at Store':
      return { bg: 'bg-yellow-50', text: 'text-yellow-800', border: 'border-yellow-200', dot: 'bg-yellow-500' };
    case 'Awaiting for Delivery':
      return { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500' };
    case 'Delivered':
      return { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', dot: 'bg-green-600' };
    case 'Confirmed':
      return { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' };
    case 'Processing':
      return { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', dot: 'bg-sky-500' };
    case 'Pending':
      return { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500' };
    default:
      return { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200', dot: 'bg-slate-400' };
  }
}

function getPaymentStatusBadge(ps: PaymentStatus) {
  if (ps === 'Completed') {
    return {
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      border: 'border-emerald-200',
      dot: 'bg-emerald-500',
      icon: <CheckCircle2 size={12} className="text-emerald-600" />,
      label: 'Completed',
    };
  }
  if (ps === 'Partial') {
    return {
      bg: 'bg-sky-50',
      text: 'text-sky-700',
      border: 'border-sky-200',
      dot: 'bg-sky-500',
      icon: <Clock size={12} className="text-sky-600" />,
      label: 'Partial Payment',
    };
  }
  return {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
    icon: <AlertTriangle size={12} className="text-amber-600" />,
    label: 'Pending',
  };
}

function getModeIcon(mode: string) {
  if (mode === 'Cash') return <Banknote size={15} className="text-emerald-600" />;
  if (mode === 'Card') return <CreditCard size={15} className="text-indigo-600" />;
  if (mode === 'UPI') return <Smartphone size={15} className="text-purple-600" />;
  return <IndianRupee size={15} className="text-slate-600" />;
}

function computePaymentStatus(received: number, total: number): PaymentStatus {
  if (received <= 0) return 'Pending';
  if (received >= total && total > 0) return 'Completed';
  return 'Partial';
}

function fmtCurrency(n: number) {
  return '₹ ' + (n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

/**
 * Returns effective payment list.
 * If order.payments is set, use it.
 * If order.payments is not set but receivedAmount > 0, synthesize the initial payment entry.
 */
function getEffectivePayments(order: OrderWithPayments): PaymentEntry[] {
  if (order.payments && Array.isArray(order.payments) && order.payments.length > 0) {
    return order.payments;
  }
  if ((order.receivedAmount || 0) > 0) {
    return [
      {
        id: 'initial-payment',
        amount: order.receivedAmount,
        mode: order.paymentMode || 'UPI',
        note: 'Initial payment at order creation',
        paidAt: order.orderTime || new Date().toISOString(),
      },
    ];
  }
  return [];
}

// ── Component ─────────────────────────────────────────────────────
interface Props { orderId: string }

export default function OrderDetailClient({ orderId }: Props) {
  const router = useRouter();
  const [order, setOrder] = useState<OrderWithPayments | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // ── Status edit modal
  const [isStatusEditOpen, setIsStatusEditOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<OrderStatus>('Order Created');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // ── Delete order modal
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // ── Manage Payment modal & forms
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState<'Cash' | 'Card' | 'UPI'>('Cash');
  const [payNote, setPayNote] = useState('');
  const [isSavingPayment, setIsSavingPayment] = useState(false);

  // ── Edit Payment Entry state
  const [editingPayment, setEditingPayment] = useState<PaymentEntry | null>(null);
  const [editPayAmount, setEditPayAmount] = useState('');
  const [editPayMode, setEditPayMode] = useState<'Cash' | 'Card' | 'UPI'>('Cash');
  const [editPayNote, setEditPayNote] = useState('');

  // ── Delete Payment Confirm state
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);

  // ── Firebase listener
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'orders', orderId),
      (snap) => {
        if (!snap.exists()) { setNotFound(true); setIsLoading(false); return; }
        setOrder({ id: snap.id, ...(snap.data() as Omit<OrderWithPayments, 'id'>) });
        setIsLoading(false);
      },
      (err) => { console.error(err); setNotFound(true); setIsLoading(false); }
    );
    return () => unsub();
  }, [orderId]);

  // ── Order Status Update ──────────────────────────────────────────
  const handleStatusUpdate = async () => {
    if (!order) return;
    try {
      setIsUpdatingStatus(true);
      await updateDoc(doc(db, 'orders', order.id), {
        orderStatus: pendingStatus,
        updatedAt: serverTimestamp(),
      });
      setIsStatusEditOpen(false);
    } catch (e) { console.error(e); }
    finally { setIsUpdatingStatus(false); }
  };

  // ── Order Delete ────────────────────────────────────────────────
  const handleDeleteOrder = async () => {
    if (!order) return;
    try {
      setIsDeleting(true);
      await deleteDoc(doc(db, 'orders', order.id));
      router.push('/orders');
    } catch (e) { console.error(e); setIsDeleting(false); }
  };

  // ── Helper to save payments array and update total & status ─────
  const savePaymentsToFirebase = async (updatedList: PaymentEntry[]) => {
    if (!order) return;
    const totalReceived = updatedList.reduce((s, p) => s + p.amount, 0);
    const newPaymentStatus = computePaymentStatus(totalReceived, order.totalAmount || 0);

    await updateDoc(doc(db, 'orders', order.id), {
      payments: updatedList,
      receivedAmount: totalReceived,
      paymentStatus: newPaymentStatus,
      updatedAt: serverTimestamp(),
    });
  };

  // ── Add New Payment ─────────────────────────────────────────────
  const handleAddPayment = async () => {
    if (!order) return;
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) return;

    const remainingBalance = (order.totalAmount || 0) - displayReceived;
    if (amount > remainingBalance + 0.001) {
      alert(`Payment amount (₹${amount.toFixed(2)}) cannot exceed the remaining balance due of ₹${Math.max(0, remainingBalance).toFixed(2)}.`);
      return;
    }

    try {
      setIsSavingPayment(true);
      const newEntry: PaymentEntry = {
        id: `pay-${Date.now()}`,
        amount,
        mode: payMode,
        note: payNote.trim(),
        paidAt: new Date().toISOString(),
      };

      const currentList = getEffectivePayments(order);
      const updatedList = [...currentList, newEntry];

      await savePaymentsToFirebase(updatedList);

      setPayAmount('');
      setPayNote('');
      setPayMode('Cash');
    } catch (e) {
      console.error('Failed to add payment:', e);
    } finally {
      setIsSavingPayment(false);
    }
  };

  // ── Start Edit Payment ──────────────────────────────────────────
  const startEditPayment = (pay: PaymentEntry) => {
    setEditingPayment(pay);
    setEditPayAmount(String(pay.amount));
    setEditPayMode(pay.mode);
    setEditPayNote(pay.note || '');
  };

  // ── Save Edited Payment ─────────────────────────────────────────
  const handleSaveEditedPayment = async () => {
    if (!order || !editingPayment) return;
    const amount = parseFloat(editPayAmount);
    if (!amount || amount <= 0) return;

    const currentList = getEffectivePayments(order);
    const otherPaymentsTotal = currentList
      .filter((p) => p.id !== editingPayment.id)
      .reduce((s, p) => s + p.amount, 0);

    const maxAllowed = (order.totalAmount || 0) - otherPaymentsTotal;
    if (amount > maxAllowed + 0.001) {
      alert(`Payment amount (₹${amount.toFixed(2)}) cannot exceed the maximum allowed balance of ₹${Math.max(0, maxAllowed).toFixed(2)}.`);
      return;
    }

    try {
      setIsSavingPayment(true);
      const updatedList = currentList.map((p) =>
        p.id === editingPayment.id
          ? { ...p, amount, mode: editPayMode, note: editPayNote.trim() }
          : p
      );

      await savePaymentsToFirebase(updatedList);
      setEditingPayment(null);
    } catch (e) {
      console.error('Failed to edit payment:', e);
    } finally {
      setIsSavingPayment(false);
    }
  };

  // ── Delete Payment ──────────────────────────────────────────────
  const handleDeletePayment = async (payId: string) => {
    if (!order) return;
    try {
      setIsSavingPayment(true);
      const currentList = getEffectivePayments(order);
      const updatedList = currentList.filter((p) => p.id !== payId);

      await savePaymentsToFirebase(updatedList);
      setDeletingPaymentId(null);
    } catch (e) {
      console.error('Failed to delete payment:', e);
    } finally {
      setIsSavingPayment(false);
    }
  };

  // ── Guards ───────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center">
            <Loader2 size={24} className="text-indigo-600 animate-spin" />
          </div>
          <p className="text-sm text-slate-500 font-medium">Loading order details…</p>
        </div>
      </div>
    );
  }

  if (notFound || !order) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center">
            <AlertTriangle size={28} className="text-red-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">Order Not Found</h2>
            <p className="text-sm text-slate-500 mt-1">This order does not exist.</p>
          </div>
          <Link href="/orders" className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors">
            <ArrowLeft size={16} /> Back to Orders
          </Link>
        </div>
      </div>
    );
  }

  // ── Derived values ───────────────────────────────────────────
  const sc             = getStatusColor(order.orderStatus);
  const psBadge        = getPaymentStatusBadge(order.paymentStatus);
  const currentStepIdx = STATUS_TIMELINE.findIndex(t => t.status === order.orderStatus);
  const payments       = getEffectivePayments(order);
  const displayReceived = payments.reduce((s, p) => s + p.amount, 0);
  const balanceDue     = (order.totalAmount || 0) - displayReceived;
  const paidPct        = order.totalAmount > 0 ? Math.min(100, Math.round((displayReceived / order.totalAmount) * 100)) : 0;

  return (
    <div className="w-full flex flex-col gap-6 font-sans pb-10">

      {/* ── Breadcrumb & Actions bar ──────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link href="/orders" className="flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition-colors mb-1">
            <ArrowLeft size={16} /> Back to Orders
          </Link>
          <nav className="flex items-center gap-1.5 text-xs text-slate-400">
            <Link href="/" className="hover:text-indigo-600 transition-colors">Dashboard</Link>
            <ChevronRight size={12} />
            <Link href="/orders" className="hover:text-indigo-600 transition-colors">Orders</Link>
            <ChevronRight size={12} />
            <span className="text-slate-700 font-semibold">{order.code}</span>
          </nav>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Manage Payment primary CTA */}
          <button
            onClick={() => setIsPaymentModalOpen(true)}
            className="flex items-center gap-2 px-[8px] py-[4px] h-[30px] rounded-[6px] bg-gradient-to-br from-emerald-500 to-emerald-700 hover:from-emerald-600 hover:to-emerald-800 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
          >
            <Wallet size={14} />
            Manage Payment
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-[8px] py-[4px] h-[30px] rounded-[6px] bg-white border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 shadow-2xs transition-colors cursor-pointer"
          >
            <Printer size={14} /> Print
          </button>
          <button
            onClick={() => { setPendingStatus(order.orderStatus); setIsStatusEditOpen(true); }}
            className="flex items-center gap-2 px-[8px] py-[4px] h-[30px] rounded-[6px] bg-white border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 shadow-2xs transition-colors cursor-pointer"
          >
            <Pencil size={14} /> Edit Status
          </button>
          <button
            onClick={() => setIsDeleteOpen(true)}
            className="flex items-center gap-2 px-[8px] py-[4px] h-[30px] rounded-[6px] bg-red-50 border border-red-200 text-xs font-semibold text-red-600 hover:bg-red-100 transition-colors cursor-pointer"
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      </div>

      {/* ── Main 3-col grid ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* LEFT (2 cols) ─────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Order Header Card */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-600" />
            <div className="p-5 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-sm flex-shrink-0">
                    <ShoppingBag size={22} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-lg border border-indigo-100">
                        {order.code}
                      </span>
                      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${sc.bg} ${sc.text} ${sc.border} flex items-center gap-1.5`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                        {order.orderStatus}
                      </span>
                    </div>
                    <h1 className="text-xl font-extrabold text-slate-900 mt-1 tracking-tight">{order.customerName}</h1>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Total Amount</p>
                  <p className="text-2xl font-extrabold text-indigo-600">{fmtCurrency(order.totalAmount || 0)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-5 border-t border-slate-100">
                {[
                  { icon: <Calendar size={14} className="text-indigo-500" />, bg: 'bg-indigo-50', label: 'Slot',          val: order.slot },
                  { icon: <Clock size={14} className="text-sky-500" />,      bg: 'bg-sky-50',     label: 'Order Time',    val: order.orderTime || '—' },
                  { icon: <ShoppingBag size={14} className="text-amber-500" />, bg: 'bg-amber-50', label: 'Items',        val: `${order.totalItems || order.items?.length || 0} Products` },
                  { icon: <Tag size={14} className="text-violet-500" />,     bg: 'bg-violet-50',  label: 'Customer Type', val: order.customerType || 'Customer' },
                ].map(({ icon, bg, label, val }) => (
                  <div key={label} className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>{icon}</div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-semibold">{label}</p>
                      <p className="text-xs font-bold text-slate-800 leading-tight">{val}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Order Items Table */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h2 className="text-sm font-extrabold text-slate-900">Order Items</h2>
                <p className="text-xs text-slate-400 mt-0.5">{order.items?.length || 0} product(s) in this order</p>
              </div>
              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                {order.items?.length || 0} Items
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[580px]">
                <thead>
                  <tr className="text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50/60 border-b border-slate-100">
                    <th className="py-3 px-5">Product</th>
                    <th className="py-3 px-4">Unit Price</th>
                    <th className="py-3 px-4">Qty</th>
                    <th className="py-3 px-4">Line Total</th>
                    <th className="py-3 px-4">Instructions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {order.items?.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          <div className="relative w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex-shrink-0">
                            <Image src={item.imageUrl || '/logo.png'} alt={item.itemName} fill className="object-contain p-1" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-900">{item.itemName}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{item.itemCode} • {item.category}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-xs font-semibold text-slate-700">
                        {fmtCurrency(item.unitPrice || 0)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">
                          {item.quantity} <span className="text-indigo-400">{item.unit}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs font-extrabold text-slate-900">
                        {fmtCurrency(item.lineTotal || 0)}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          {item.manufacturingDescription && (
                            <p className="text-[10px] text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                              <Factory size={11} className="text-teal-600 flex-shrink-0" />
                              <span>{item.manufacturingDescription}</span>
                            </p>
                          )}
                          {item.packingDescription && (
                            <p className="text-[10px] text-violet-700 bg-violet-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                              <Package size={11} className="text-violet-600 flex-shrink-0" />
                              <span>{item.packingDescription}</span>
                            </p>
                          )}
                          {!item.manufacturingDescription && !item.packingDescription && (
                            <span className="text-[10px] text-slate-300">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50/80 border-t border-slate-200">
                    <td colSpan={3} className="py-3.5 px-5 text-xs font-bold text-slate-600 text-right">Grand Total:</td>
                    <td className="py-3.5 px-4 text-sm font-extrabold text-indigo-600">{fmtCurrency(order.totalAmount || 0)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Payment History Card */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <History size={15} className="text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-sm font-extrabold text-slate-900">Payment History</h2>
                  <p className="text-xs text-slate-400 mt-0.5">{payments.length} transaction(s) recorded</p>
                </div>
              </div>
              <button
                onClick={() => setIsPaymentModalOpen(true)}
                className="flex items-center gap-1.5 px-[8px] py-[4px] h-[30px] rounded-[6px] bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
              >
                <Plus size={13} /> Add Payment
              </button>
            </div>

            {payments.length === 0 ? (
              <div className="py-12 text-center">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                  <IndianRupee size={20} className="text-slate-400" />
                </div>
                <p className="text-sm font-semibold text-slate-500">No payments recorded yet</p>
                <p className="text-xs text-slate-400 mt-1">Click "Add Payment" to record a payment for this order.</p>
                <button
                  onClick={() => setIsPaymentModalOpen(true)}
                  className="mt-4 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer mx-auto shadow-xs"
                >
                  <Wallet size={14} /> Manage Payment
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {payments.map((pay, idx) => (
                  <div key={pay.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center flex-shrink-0">
                        {getModeIcon(pay.mode)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">Payment #{idx + 1}</span>
                          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                            {pay.mode}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">{fmtDate(pay.paidAt)}</p>
                        {pay.note && <p className="text-[10px] text-slate-500 italic mt-0.5">"{pay.note}"</p>}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-sm font-extrabold text-emerald-600">{fmtCurrency(pay.amount)}</span>
                      <div className="flex items-center gap-1 border-l border-slate-100 pl-2">
                        <button
                          onClick={() => {
                            setIsPaymentModalOpen(true);
                            startEditPayment(pay);
                          }}
                          className="p-1 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors"
                          title="Edit Payment"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => {
                            setIsPaymentModalOpen(true);
                            setDeletingPaymentId(pay.id);
                          }}
                          className="p-1 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                          title="Delete Payment"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Summary row */}
                <div className="px-5 py-3.5 bg-slate-50/80 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600">Total Paid</span>
                  <span className="text-sm font-extrabold text-emerald-700">{fmtCurrency(displayReceived)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Order Progress Timeline */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5">
            <h2 className="text-sm font-extrabold text-slate-900 mb-5">Order Progress</h2>
            <div className="relative">
              <div className="absolute left-[15px] top-4 bottom-4 w-0.5 bg-slate-100" />
              <div className="space-y-3">
                {STATUS_TIMELINE.map((step, idx) => {
                  const isCompleted = currentStepIdx > idx;
                  const isCurrent   = currentStepIdx === idx;
                  const dotClass    = isCurrent
                    ? 'bg-indigo-600 border-white shadow-md shadow-indigo-200'
                    : isCompleted
                      ? 'bg-emerald-500 border-white'
                      : 'bg-slate-200 border-white';
                  const labelClass  = isCurrent ? 'text-slate-900 font-bold' : isCompleted ? 'text-slate-600' : 'text-slate-400';

                  return (
                    <div key={step.status} className="flex items-center gap-4 relative">
                      <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 z-10 transition-all ${dotClass}`}>
                        {isCompleted
                          ? <CheckCircle2 size={14} className="text-white" />
                          : isCurrent
                            ? <span className="text-white">{step.icon}</span>
                            : <Circle size={12} className="text-slate-300" />
                        }
                      </div>
                      <div className="flex-1 flex items-center justify-between">
                        <span className={`text-xs font-semibold transition-all ${labelClass}`}>{step.status}</span>
                        {isCurrent && (
                          <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100 animate-pulse">
                            Current
                          </span>
                        )}
                        {isCompleted && <CheckCircle2 size={14} className="text-emerald-500" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

        </div>

        {/* RIGHT sidebar ──────────────────────────────────────── */}
        <div className="space-y-5">

          {/* Customer Details */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-sm font-extrabold text-slate-900">Customer Details</h2>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white font-extrabold flex items-center justify-center text-lg shadow-sm flex-shrink-0">
                  {order.customerName?.charAt(0).toUpperCase() || 'C'}
                </div>
                <div>
                  <p className="text-sm font-extrabold text-slate-900">{order.customerName}</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${order.customerType === 'Wholesaler' ? 'bg-purple-50 text-purple-700 border border-purple-100' : 'bg-indigo-50 text-indigo-700 border border-indigo-100'}`}>
                    {order.customerType || 'Customer'}
                  </span>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-100 flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-sky-50 flex items-center justify-center flex-shrink-0">
                  <Phone size={12} className="text-sky-500" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-semibold">Mobile</p>
                  <p className="text-xs font-bold text-slate-800">{order.customerMobile || '—'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Summary Card */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-slate-900">Payment Summary</h2>
              <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${psBadge.bg} ${psBadge.text} ${psBadge.border} flex items-center gap-1.5`}>
                {psBadge.icon}
                <span>{psBadge.label}</span>
              </span>
            </div>
            <div className="p-5 space-y-4">

              {/* Progress bar */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-semibold text-slate-500">Payment Progress</span>
                  <span className="text-[11px] font-extrabold text-emerald-600">{paidPct}%</span>
                </div>
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-500"
                    style={{ width: `${paidPct}%` }}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Total Amount</span>
                  <span className="font-extrabold text-slate-900">{fmtCurrency(order.totalAmount || 0)}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Total Received</span>
                  <span className="font-bold text-emerald-600">{fmtCurrency(displayReceived)}</span>
                </div>
                <div className="h-px bg-slate-100" />
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-700">Balance Due</span>
                  <span className={`text-sm font-extrabold ${balanceDue > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {fmtCurrency(Math.abs(balanceDue))}
                    {balanceDue < 0 && <span className="text-[10px] font-semibold ml-1">(Overpaid)</span>}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-500">Payment Mode</span>
                  <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                    <CreditCard size={13} className="text-slate-400" />
                    {order.paymentMode}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-500">Transactions</span>
                  <span className="text-xs font-bold text-slate-800">{payments.length} payment(s)</span>
                </div>
              </div>

              {/* Manage payment CTA inside card */}
              <button
                onClick={() => setIsPaymentModalOpen(true)}
                className="w-full flex items-center justify-center gap-2 px-[8px] py-[4px] h-[30px] rounded-[6px] bg-gradient-to-br from-emerald-500 to-emerald-700 hover:from-emerald-600 hover:to-emerald-800 text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
              >
                <Wallet size={13} /> Manage Payment
              </button>
            </div>
          </div>

          {/* Order Status Card */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-sm font-extrabold text-slate-900">Order Status</h2>
            </div>
            <div className="p-5 space-y-4">
              <div className={`flex items-center gap-3 p-3.5 rounded-xl border ${sc.bg} ${sc.border}`}>
                <div className={`w-2.5 h-2.5 rounded-full ${sc.dot} flex-shrink-0`} />
                <span className={`text-xs font-bold ${sc.text}`}>{order.orderStatus}</span>
              </div>
              <button
                onClick={() => { setPendingStatus(order.orderStatus); setIsStatusEditOpen(true); }}
                className="w-full flex items-center justify-center gap-2 px-[8px] py-[4px] h-[30px] rounded-[6px] border-2 border-dashed border-indigo-200 text-indigo-600 hover:bg-indigo-50/50 text-xs font-bold transition-all cursor-pointer"
              >
                <Pencil size={13} /> Update Status
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          MANAGE PAYMENT MODAL
      ══════════════════════════════════════════════════════════ */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150 overflow-hidden max-h-[90vh] flex flex-col">

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-white flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                  <Wallet size={17} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Manage Payment</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Order {order.code} • {order.customerName}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsPaymentModalOpen(false);
                  setEditingPayment(null);
                  setDeletingPaymentId(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-[6px] h-[30px] w-[30px] flex items-center justify-center hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto flex-1">

              {/* Summary strip */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-center">
                  <p className="text-[10px] text-slate-400 font-semibold uppercase">Order Total</p>
                  <p className="text-sm font-extrabold text-slate-900 mt-0.5">{fmtCurrency(order.totalAmount || 0)}</p>
                </div>
                <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100 text-center">
                  <p className="text-[10px] text-emerald-600 font-semibold uppercase">Paid</p>
                  <p className="text-sm font-extrabold text-emerald-700 mt-0.5">{fmtCurrency(displayReceived)}</p>
                </div>
                <div className={`rounded-xl p-3 border text-center ${balanceDue > 0 ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
                  <p className={`text-[10px] font-semibold uppercase ${balanceDue > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                    {balanceDue > 0 ? 'Balance Due' : 'Overpaid'}
                  </p>
                  <p className={`text-sm font-extrabold mt-0.5 ${balanceDue > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                    {fmtCurrency(Math.abs(balanceDue))}
                  </p>
                </div>
              </div>

              {/* Status Badge & Progress bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-500">Payment Status</span>
                  <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${psBadge.bg} ${psBadge.text} ${psBadge.border} flex items-center gap-1.5`}>
                    {psBadge.icon}
                    <span>{psBadge.label}</span>
                  </span>
                </div>
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-500"
                    style={{ width: `${paidPct}%` }}
                  />
                </div>
              </div>

              {/* ── EDIT EXISTING PAYMENT FORM ── */}
              {editingPayment ? (
                <div className="bg-indigo-50/70 rounded-2xl border border-indigo-200 p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Pencil size={13} className="text-indigo-600" /> Edit Payment Entry
                    </p>
                    <button
                      onClick={() => setEditingPayment(null)}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-700 px-[8px] py-[4px] h-[30px] rounded-[6px]"
                    >
                      Cancel Edit
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Amount (₹) *</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">₹</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={editPayAmount}
                        onChange={e => setEditPayAmount(e.target.value)}
                        className="w-full pl-8 pr-4 py-2 text-sm font-bold text-slate-900 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Payment Mode</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['Cash', 'UPI', 'Card'] as const).map(mode => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setEditPayMode(mode)}
                          className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${editPayMode === mode
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
                        >
                          {getModeIcon(mode)} {mode}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Note (Optional)</label>
                    <input
                      type="text"
                      placeholder="Reason or note..."
                      value={editPayNote}
                      onChange={e => setEditPayNote(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 bg-white"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleSaveEditedPayment}
                      disabled={isSavingPayment || !editPayAmount || parseFloat(editPayAmount) <= 0}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isSavingPayment ? <Loader2 size={14} className="animate-spin" /> : <BadgeCheck size={14} />}
                      Update Payment
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingPayment(null)}
                      className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* ── ADD NEW PAYMENT FORM ── */
                order.paymentStatus !== 'Completed' && (
                  <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-4">
                    <p className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Plus size={13} /> Add New Payment
                    </p>

                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="block text-xs font-semibold text-slate-600">
                          Amount (₹) <span className="text-red-500">*</span>
                        </label>
                        <span className="text-[10px] font-bold text-slate-400">
                          Max: ₹{Math.max(0, balanceDue).toFixed(2)}
                        </span>
                      </div>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">₹</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          max={Math.max(0, balanceDue)}
                          placeholder={`Max: ${Math.max(0, balanceDue).toFixed(2)}`}
                          value={payAmount}
                          onChange={e => {
                            const val = e.target.value;
                            const num = parseFloat(val) || 0;
                            if (num > balanceDue && balanceDue > 0) {
                              setPayAmount(String(balanceDue));
                            } else {
                              setPayAmount(val);
                            }
                          }}
                          className={`w-full pl-8 pr-4 py-2.5 text-sm font-bold border rounded-xl focus:outline-none bg-white ${
                            parseFloat(payAmount) > balanceDue
                              ? 'text-red-600 border-red-300 focus:border-red-500'
                              : 'text-emerald-700 border-slate-200 focus:border-emerald-500'
                          }`}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">Payment Mode</label>
                      <div className="grid grid-cols-3 gap-2">
                        {(['Cash', 'UPI', 'Card'] as const).map(mode => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => setPayMode(mode)}
                            className={`py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${payMode === mode
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
                          >
                            {getModeIcon(mode)} {mode}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">Note (Optional)</label>
                      <input
                        type="text"
                        placeholder="e.g. Advance payment, Final settlement..."
                        value={payNote}
                        onChange={e => setPayNote(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 bg-white"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleAddPayment}
                      disabled={isSavingPayment || !payAmount || parseFloat(payAmount) <= 0}
                      className="w-full flex items-center justify-center gap-2 px-[8px] py-[4px] h-[30px] rounded-[6px] bg-gradient-to-br from-emerald-500 to-emerald-700 hover:from-emerald-600 hover:to-emerald-800 text-white text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isSavingPayment ? <Loader2 size={14} className="animate-spin" /> : <BadgeCheck size={15} />}
                      Confirm Payment
                    </button>
                  </div>
                )
              )}

              {order.paymentStatus === 'Completed' && !editingPayment && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
                  <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-emerald-700">Payment Fully Collected</p>
                    <p className="text-[10px] text-emerald-600 mt-0.5">All {fmtCurrency(order.totalAmount || 0)} has been received.</p>
                  </div>
                </div>
              )}

              {/* Payment History List inside Modal */}
              <div>
                <p className="text-xs font-bold text-slate-600 mb-2 uppercase tracking-wider">Transaction History</p>
                {payments.length === 0 ? (
                  <p className="text-xs text-slate-400 italic p-3 text-center border border-dashed rounded-xl">No transactions yet.</p>
                ) : (
                  <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-56 overflow-y-auto">
                    {payments.map((pay, idx) => (
                      <div key={pay.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0">
                            {getModeIcon(pay.mode)}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-slate-900">Payment #{idx + 1}</span>
                              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.2 rounded-full border border-emerald-100">
                                {pay.mode}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400">{fmtDate(pay.paidAt)}</p>
                            {pay.note && <p className="text-[10px] text-slate-500 italic">"{pay.note}"</p>}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-sm font-extrabold text-emerald-600">{fmtCurrency(pay.amount)}</span>

                          {deletingPaymentId === pay.id ? (
                            <div className="flex items-center gap-1 bg-red-50 p-1 rounded-lg border border-red-100">
                              <span className="text-[10px] text-red-600 font-bold px-1">Delete?</span>
                              <button
                                onClick={() => handleDeletePayment(pay.id)}
                                disabled={isSavingPayment}
                                className="p-1 bg-red-600 text-white rounded hover:bg-red-700"
                                title="Confirm delete"
                              >
                                {isSavingPayment ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                              </button>
                              <button
                                onClick={() => setDeletingPaymentId(null)}
                                className="p-1 bg-slate-200 text-slate-600 rounded hover:bg-slate-300"
                                title="Cancel"
                              >
                                <X size={11} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => startEditPayment(pay)}
                                className="p-1 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors"
                                title="Edit payment"
                              >
                                <Pencil size={13} />
                              </button>
                              <button
                                onClick={() => setDeletingPaymentId(pay.id)}
                                className="p-1 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                                title="Delete payment"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ── Edit Status Modal ──────────────────────────────────── */}
      {isStatusEditOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900">Update Order Status</h3>
              <button onClick={() => setIsStatusEditOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer">
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Order <span className="font-bold text-indigo-600">{order.code}</span> for <span className="font-bold text-slate-800">{order.customerName}</span>
            </p>
            <CustomSelect
              options={ALL_ORDER_STATUSES.map(s => ({ value: s, label: s }))}
              value={pendingStatus}
              onChange={val => setPendingStatus(val as OrderStatus)}
              className="w-full"
              buttonClassName="w-full"
            />
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
              <button onClick={() => setIsStatusEditOpen(false)} className="px-[8px] py-[4px] h-[30px] rounded-[6px] text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer">
                Cancel
              </button>
              <button
                onClick={handleStatusUpdate}
                disabled={isUpdatingStatus}
                className="flex items-center gap-2 px-[8px] py-[4px] h-[30px] rounded-[6px] text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {isUpdatingStatus ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Save Status
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ─────────────────────────────── */}
      {isDeleteOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-full bg-red-50 text-red-500 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Order</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Are you sure you want to delete order <strong className="text-slate-800">{order.code}</strong> for {order.customerName}? This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button onClick={() => setIsDeleteOpen(false)} className="px-[8px] py-[4px] h-[30px] rounded-[6px] text-xs font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                Cancel
              </button>
              <button
                onClick={handleDeleteOrder}
                disabled={isDeleting}
                className="flex items-center gap-2 px-[8px] py-[4px] h-[30px] rounded-[6px] text-xs font-semibold bg-red-600 hover:bg-red-700 text-white shadow-xs disabled:opacity-50 cursor-pointer transition-colors"
              >
                {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Delete Order
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

'use client';

import { useState, useEffect, useMemo } from 'react';
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
  MapPin,
  Copy,
  Mail,
  MoreHorizontal,
  User,
  Eye,
  FileText,
  Check,
  Settings,
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { usePrinter } from '@/context/PrinterContext';
import { useAuth } from '@/context/AuthContext';
import { toast } from '@/context/ToastContext';
import {
  doc,
  onSnapshot,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import type { OrderRecord, OrderStatus, PaymentStatus } from './OrdersClient';
import CustomSelect from '@/components/CustomSelect';
import { OrderActionOtpModal } from '@/components/OrderActionOtpModal';

// ── Types ────────────────────────────────────────────────────────
export interface PaymentEntry {
  id: string;
  amount: number;
  mode: string;
  note: string;
  paidAt: string; // ISO date string or formatted date
}

interface OrderWithPayments extends OrderRecord {
  payments?: PaymentEntry[];
  customerEmail?: string;
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
  return '₹ ' + (n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
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
  const { user, employeeProfile } = useAuth();
  const [order, setOrder] = useState<OrderWithPayments | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Admin security check
  const isAdmin = Boolean(
    employeeProfile?.isSuperAdmin ||
    (user?.email && !employeeProfile) ||
    employeeProfile?.department === 'Management' ||
    employeeProfile?.department === 'Admin'
  );

  // OTP Authorization Modal state for non-admin edit/delete actions
  const [authModalState, setAuthModalState] = useState<{
    isOpen: boolean;
    action: 'edit' | 'delete';
  }>({
    isOpen: false,
    action: 'edit',
  });

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
  const [payMode, setPayMode] = useState<string>('Cash');
  const [payNote, setPayNote] = useState('');
  const [isSavingPayment, setIsSavingPayment] = useState(false);

  // ── Split Payment State in Manage Payment modal
  const [isSplitPayment, setIsSplitPayment] = useState(false);
  const [splitPayments, setSplitPayments] = useState<
    { id: string; mode: string; amount: string | number; note?: string }[]
  >([
    { id: 'split-1', mode: 'UPI', amount: '', note: '' },
    { id: 'split-2', mode: 'Cash', amount: '', note: '' },
  ]);

  const splitTotal = useMemo(() => {
    return splitPayments.reduce((sum, item) => sum + (parseFloat(String(item.amount)) || 0), 0);
  }, [splitPayments]);

  // ── Edit Payment Entry state
  const [editingPayment, setEditingPayment] = useState<PaymentEntry | null>(null);
  const [editPayAmount, setEditPayAmount] = useState('');
  const [editPayMode, setEditPayMode] = useState<string>('Cash');
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

  const { isConnected: isPrinterConnected, printerType, printReceipt, printWindow } = usePrinter();

  const handleThermalPrint = async () => {
    if (!order) return;
    const orderItems = (order.items || []).map((it: any) => {
      const qty = parseFloat(it.quantity || it.qty || 1) || 1;
      let price = parseFloat(it.price || it.rate || it.itemPrice || it.unitPrice || 0) || 0;
      let total = parseFloat(it.amount || it.total || it.subTotal || it.itemTotal || 0) || 0;
      if (!total && price > 0) total = price * qty;
      if (!price && total > 0 && qty > 0) price = total / qty;
      const mfgNote = (it.manufacturingDescription || it.mfgDesc || it.notes || it.note || '').trim();
      const pckNote = (it.packingDescription || it.pckDesc || '').trim();
      return {
        name: it.itemName || it.name || it.item || 'Item',
        qty: qty,
        unit: it.unit || 'kg',
        price: price,
        total: total || (price * qty),
        note: mfgNote,
        manufacturingDescription: mfgNote,
        packingDescription: pckNote,
      };
    });

    if (isPrinterConnected && (printerType === 'USB' || printerType === 'Bluetooth')) {
      await printReceipt({
        billNo: order.code || (order as any).orderId || order.id,
        customerName: order.customerName,
        customerPhone: order.customerMobile,
        customerEmail: (order as any).customerEmail || undefined,
        customerAddress: order.customerAddress || order.deliveryAddress || undefined,
        cashierName: (order as any).createdByName || (order as any).createdBy || undefined,
        dateStr: order.orderDate,
        timeStr: order.orderTime,
        slot: order.slot,
        deliveryDate: order.expectedDeliveryDate || order.manufacturingDate,
        deliveryTime: (order as any).deliveryTime || undefined,
        deliveryAddress: order.deliveryAddress || undefined,
        orderType: order.isCustomisation ? 'Custom Box Order' : 'Standard Order',
        orderStatus: order.orderStatus,
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
        transportCharges: order.transportCharges || 0,
        grandTotal: order.totalAmount,
        receivedAmount: order.receivedAmount,
        advanceAmount: (order as any).advanceAmount !== undefined ? (order as any).advanceAmount : order.receivedAmount,
        balanceAmount: (order as any).balanceAmount !== undefined ? (order as any).balanceAmount : Math.max(0, order.totalAmount - (order.receivedAmount || 0)),
        isCustomisation: order.isCustomisation,
        customisationDetails: order.isCustomisation && order.customisationDetails
          ? {
              ...order.customisationDetails,
              selectedSweets: (order.items || []).map((it: any) => ({
                itemName: it.itemName || it.name || 'Sweet',
                count: it.count,
                weight: parseFloat(it.quantity || it.qty || 1) || 1,
                unit: it.unit || 'kg',
                manufacturingDescription: (it.manufacturingDescription || it.mfgDesc || it.notes || it.note || '').trim(),
                packingDescription: (it.packingDescription || it.pckDesc || '').trim(),
              })),
            }
          : (order.customisationDetails as any),
        remarks: (order as any).remarks || (order as any).notes || undefined,
        footerNote: 'Thank you for choosing Pattabiram Sweets! Visit again!',
      });
    } else {
      window.print();
    }
  };

  // ── Order Delete ────────────────────────────────────────────────
  const handleDeleteClick = () => {
    if (isAdmin) {
      setIsDeleteOpen(true);
    } else {
      setAuthModalState({ isOpen: true, action: 'delete' });
    }
  };

  const handleDeleteOrder = async () => {
    if (!order) return;
    if (!isAdmin) {
      setIsDeleteOpen(false);
      setAuthModalState({ isOpen: true, action: 'delete' });
      return;
    }
    try {
      setIsDeleting(true);
      await deleteDoc(doc(db, 'orders', order.id));
      toast.success('Order Deleted', `Order #${order.code} was deleted successfully.`);
      router.push('/orders');
    } catch (e: any) {
      console.error(e);
      toast.error('Delete Failed', e?.message || 'Could not delete order.');
    } finally {
      setIsDeleting(false);
    }
  };

  // ── Order Edit ──────────────────────────────────────────────────
  const handleEditOrderClick = () => {
    if (!order) return;
    if (isAdmin) {
      router.push(`/orders/create?editId=${order.id}`);
    } else {
      setAuthModalState({ isOpen: true, action: 'edit' });
    }
  };

  // ── OTP Authorization Success Callback ───────────────────────────
  const handleAuthOtpSuccess = async (verifiedToken: string) => {
    if (!order) return;
    if (authModalState.action === 'edit') {
      try {
        sessionStorage.setItem(`order_auth_${order.id}`, verifiedToken);
      } catch {}
      router.push(`/orders/create?editId=${order.id}&auth=${verifiedToken}`);
    } else if (authModalState.action === 'delete') {
      try {
        setIsDeleting(true);
        await deleteDoc(doc(db, 'orders', order.id));
        toast.success('Order Deleted', `Order #${order.code} was deleted successfully.`);
        router.push('/orders');
      } catch (e: any) {
        console.error(e);
        toast.error('Delete Failed', e?.message || 'Could not delete order.');
      } finally {
        setIsDeleting(false);
      }
    }
  };

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

  // ── Helper to save payments array and update total & status ─────
  const savePaymentsToFirebase = async (updatedList: PaymentEntry[]) => {
    if (!order) return;
    const totalReceived = updatedList.reduce((s, p) => s + p.amount, 0);
    const newPaymentStatus = computePaymentStatus(totalReceived, order.totalAmount || 0);
    const uniqueModes = Array.from(new Set(updatedList.map((p) => p.mode).filter(Boolean)));
    const compositeMode = uniqueModes.length > 1
      ? `Split (${uniqueModes.join(', ')})`
      : (uniqueModes[0] || order.paymentMode || 'UPI');

    await updateDoc(doc(db, 'orders', order.id), {
      payments: updatedList,
      receivedAmount: totalReceived,
      paymentMode: compositeMode,
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
      toast.error('Invalid Payment Amount', `Payment amount (₹${amount.toFixed(2)}) cannot exceed the remaining balance due of ₹${Math.max(0, remainingBalance).toFixed(2)}.`);
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
      toast.success('Payment Recorded', `Payment of ₹${amount.toFixed(2)} recorded successfully.`);

      setPayAmount('');
      setPayNote('');
      setPayMode('Cash');
    } catch (e: any) {
      console.error('Failed to add payment:', e);
      toast.error('Payment Failed', e?.message || 'Could not record payment.');
    } finally {
      setIsSavingPayment(false);
    }
  };

  // ── Add Split Payments ──────────────────────────────────────────
  const handleAddSplitPayments = async () => {
    if (!order) return;
    const validSplits = splitPayments.filter((s) => (parseFloat(String(s.amount)) || 0) > 0);
    if (validSplits.length === 0) {
      toast.error('No Amounts Entered', 'Please enter an amount for at least one split payment.');
      return;
    }

    const totalSplitAmount = validSplits.reduce((s, p) => s + (parseFloat(String(p.amount)) || 0), 0);
    const remainingBalance = (order.totalAmount || 0) - displayReceived;

    if (totalSplitAmount > remainingBalance + 0.001) {
      toast.error(
        'Invalid Split Total',
        `Total split payment (₹${totalSplitAmount.toFixed(2)}) cannot exceed the remaining balance due of ₹${Math.max(0, remainingBalance).toFixed(2)}.`
      );
      return;
    }

    try {
      setIsSavingPayment(true);
      const now = new Date();
      const newEntries: PaymentEntry[] = validSplits.map((s, idx) => ({
        id: `pay-${Date.now()}-${idx}`,
        amount: parseFloat(String(s.amount)),
        mode: s.mode || 'UPI',
        note: (s.note || '').trim(),
        paidAt: new Date(now.getTime() + idx * 1000).toISOString(),
      }));

      const currentList = getEffectivePayments(order);
      const updatedList = [...currentList, ...newEntries];

      await savePaymentsToFirebase(updatedList);
      toast.success(
        'Split Payments Recorded',
        `${validSplits.length} split payments totaling ₹${totalSplitAmount.toFixed(2)} recorded successfully.`
      );

      // Reset split form
      setSplitPayments([
        { id: 'split-1', mode: 'UPI', amount: '', note: '' },
        { id: 'split-2', mode: 'Cash', amount: '', note: '' },
      ]);
      setIsSplitPayment(false);
    } catch (e: any) {
      console.error('Failed to add split payments:', e);
      toast.error('Payment Failed', e?.message || 'Could not record split payments.');
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
      toast.error('Invalid Payment Amount', `Payment amount (₹${amount.toFixed(2)}) cannot exceed the maximum allowed balance of ₹${Math.max(0, maxAllowed).toFixed(2)}.`);
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
      toast.success('Payment Updated', 'Payment record updated successfully.');
      setEditingPayment(null);
    } catch (e: any) {
      console.error('Failed to save edited payment:', e);
      toast.error('Update Failed', e?.message || 'Could not update payment.');
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
  const payments       = getEffectivePayments(order);
  const displayReceived = payments.reduce((s, p) => s + p.amount, 0);
  const balanceDue     = (order.totalAmount || 0) - displayReceived;
  const paidPct        = order.totalAmount > 0 ? Math.min(100, Math.round((displayReceived / order.totalAmount) * 100)) : 0;

  const handleCopy = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success(`Copied ${label} to clipboard`);
  };

  const DISPLAY_TIMELINE = [
    { id: 'Order Created',           label: 'Order Created',           time: order.orderTime || '04:00 PM', icon: <FileText size={13} /> },
    { id: 'Moved to Manufacturing',  label: 'Moved to Manufacturing',  time: '04:05 PM', icon: <Factory size={13} /> },
    { id: 'Manufacturing Started',   label: 'Manufacturing Started',   time: '05:00 PM', icon: <Factory size={13} /> },
    { id: 'Manufacturing Completed', label: 'Manufacturing Completed', time: '05:30 PM', icon: <CheckCircle2 size={13} /> },
    { id: 'Moved to Packing',        label: 'Moved to Packing',        time: '06:00 PM', icon: <Package size={13} /> },
    { id: 'Packing Completed',       label: 'Packing Completed',       time: '06:30 PM', icon: <CheckCircle2 size={13} /> },
    { id: 'Moved to Store',          label: 'Moved to Store',          time: '06:45 PM', icon: <Store size={13} /> },
    { id: 'Received at Store',       label: 'Received at Store',       time: '06:50 PM', icon: <Store size={13} /> },
    { id: 'Awaiting for Delivery',   label: 'Awaiting for Delivery',   time: '06:55 PM', icon: <Clock size={13} /> },
    { id: 'Delivered',               label: 'Delivered',               time: '07:10 PM', icon: <Truck size={13} /> },
  ];

  const getTimelineStepIndex = (status: OrderStatus) => {
    switch (status) {
      case 'Order Created': return 0;
      case 'Moved to Manufacturing': return 1;
      case 'Manufacturing Started': return 2;
      case 'Manufacturing Completed': return 3;
      case 'Moved to Packing':
      case 'Packing Started': return 4;
      case 'Packing Completed': return 5;
      case 'Moved to Store': return 6;
      case 'Received at Store': return 7;
      case 'Awaiting for Delivery': return 8;
      case 'Delivered': return 9;
      default: return 0;
    }
  };
  const activeTimelineIdx = getTimelineStepIndex(order.orderStatus);

  return (
    <div className="w-full flex flex-col gap-6 font-sans pb-10">

      {/* ── Breadcrumb & Actions bar ──────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href="/orders"
            className="flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition-colors mb-1.5"
          >
            <ArrowLeft size={16} /> Back to Orders
          </Link>
          <nav className="flex items-center gap-1.5 text-xs text-slate-400">
            <Link href="/" className="hover:text-indigo-600 transition-colors">
              Dashboard
            </Link>
            <ChevronRight size={12} className="text-slate-300" />
            <Link href="/orders" className="hover:text-indigo-600 transition-colors">
              Orders
            </Link>
            <ChevronRight size={12} className="text-slate-300" />
            <span className="text-slate-700 font-bold">#{order.code}</span>
          </nav>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Manage Payment primary CTA */}
          <button
            onClick={() => setIsPaymentModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#02626D] hover:bg-[#024f58] text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
          >
            <CreditCard size={14} />
            Manage Payment
          </button>
          <button
            onClick={handleThermalPrint}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors cursor-pointer"
          >
            <Printer size={14} /> Print
          </button>
          <button
            onClick={() => {
              setPendingStatus(order.orderStatus);
              setIsStatusEditOpen(true);
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors cursor-pointer"
          >
            <Pencil size={14} /> Edit Status
          </button>
          <button
            onClick={handleEditOrderClick}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors cursor-pointer"
            title="Edit Order Details"
          >
            <Pencil size={14} /> Edit Order
          </button>
          <button
            onClick={handleDeleteClick}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50/70 border border-red-200 text-xs font-semibold text-red-600 hover:bg-red-100 transition-colors cursor-pointer"
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      </div>

      {/* ── Full Width Order Status & Progress Card ──────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 sm:p-6 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
              <Truck size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-sm font-extrabold text-slate-900">Order Status</h2>
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {order.orderStatus}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Track manufacturing, packing, store receipt, and delivery stages
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setPendingStatus(order.orderStatus);
              setIsStatusEditOpen(true);
            }}
            className="self-start sm:self-auto flex items-center gap-2 px-3.5 py-1.5 rounded-xl border-2 border-dashed border-[#C7D2FE] text-[#4F46E5] hover:bg-indigo-50/50 text-xs font-bold transition-all cursor-pointer shadow-2xs"
          >
            <Pencil size={13} /> Update Status
          </button>
        </div>

        {/* Connected horizontal stepper with 10 steps */}
        <div className="overflow-x-auto pb-2 pt-6">
          <div className="min-w-[880px] flex items-start justify-between relative px-2">
            {/* Continuous Line behind circles */}
            <div className="absolute top-[17px] left-[35px] right-[35px] h-[3px] bg-slate-200 -z-0" />
            <div
              className="absolute top-[17px] left-[35px] h-[3px] bg-emerald-500 -z-0 transition-all duration-500"
              style={{
                width: `${
                  activeTimelineIdx === 0
                    ? 0
                    : (activeTimelineIdx / (DISPLAY_TIMELINE.length - 1)) * 100
                }%`,
                maxWidth: 'calc(100% - 70px)',
              }}
            />

            {DISPLAY_TIMELINE.map((step, idx) => {
              const isPast = idx < activeTimelineIdx;
              const isCurrent = idx === activeTimelineIdx;
              const isDelivered = order.orderStatus === 'Delivered' && idx === 9;

              let circleClass = 'bg-white border-2 border-slate-200 text-slate-300';
              if (isDelivered) {
                circleClass = 'bg-[#5B4EFF] text-white shadow-md shadow-indigo-100 ring-4 ring-indigo-50';
              } else if (isPast || (isCurrent && order.orderStatus === 'Delivered')) {
                circleClass = 'bg-emerald-500 text-white';
              } else if (isCurrent) {
                circleClass = 'bg-emerald-600 text-white ring-4 ring-emerald-100 shadow-md shadow-emerald-100';
              }

              return (
                <div
                  key={step.id}
                  className="flex flex-col items-center flex-1 relative z-10 text-center px-1"
                >
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${circleClass}`}
                  >
                    {step.icon}
                  </div>
                  <p
                    className={`text-[11px] font-bold mt-2.5 leading-tight ${
                      isCurrent
                        ? 'text-slate-900'
                        : isPast
                        ? 'text-slate-800'
                        : 'text-slate-400'
                    }`}
                  >
                    {step.label}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                    {order.orderDate
                      ? `${order.orderDate.split('-').slice(1).reverse().join(' ')}, `
                      : ''}
                    {step.time}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Main 12-col grid ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* LEFT (8 cols) ─────────────────────────────────────── */}
        <div className="lg:col-span-8 space-y-6">

          {/* Order Header Banner Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden p-6">
            {/* Background 3D Box Watermark */}
            <div className="absolute right-4 -top-8 text-indigo-100/40 pointer-events-none select-none">
              <Package size={170} strokeWidth={0.8} />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-[#5B4EFF] text-white flex items-center justify-center shadow-md shadow-indigo-100 flex-shrink-0">
                  <Package size={26} strokeWidth={2.2} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                      ORDER #{order.code}
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      {order.orderStatus}
                    </span>
                  </div>
                  <h1 className="text-2xl font-extrabold text-slate-900 mt-1 tracking-tight">
                    {order.customerName}
                  </h1>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium mt-1">
                    <Calendar size={13} className="text-slate-400" />
                    <span>
                      Created on{' '}
                      {order.orderDate
                        ? `${order.orderDate}, ${order.orderTime || '04:00 PM'}`
                        : order.createdAt
                        ? fmtDate(order.createdAt)
                        : '21 Sept 2026, 04:00 PM'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-left sm:text-right relative z-10">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  TOTAL AMOUNT
                </p>
                <p className="text-3xl font-extrabold text-[#3B49DF] mt-0.5 tracking-tight">
                  {fmtCurrency(order.totalAmount || 0)}
                </p>
              </div>
            </div>

            {/* 6 Metric capsules */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-5 border-t border-slate-100 relative z-10">
              {[
                {
                  icon: <Clock size={15} className="text-indigo-600" />,
                  bg: 'bg-indigo-50',
                  label: 'Time Slot',
                  val: order.slot || '12:00 PM - 3:00 PM',
                },
                {
                  icon: <Clock size={15} className="text-sky-600" />,
                  bg: 'bg-sky-50',
                  label: 'Order Time',
                  val: order.orderTime || '04:00 PM',
                },
                {
                  icon: <Calendar size={15} className="text-teal-600" />,
                  bg: 'bg-teal-50',
                  label: 'Mfg Date',
                  val: order.manufacturingDate || order.orderDate || '—',
                },
                {
                  icon: <Truck size={15} className="text-emerald-600" />,
                  bg: 'bg-emerald-50',
                  label: 'Exp Delivery',
                  val: order.expectedDeliveryDate || '—',
                },
                {
                  icon: <Package size={15} className="text-amber-600" />,
                  bg: 'bg-amber-50',
                  label: 'Items',
                  val: `${order.totalItems || order.items?.length || 0} Products`,
                },
                {
                  icon: <User size={15} className="text-purple-600" />,
                  bg: 'bg-purple-50',
                  label: 'Customer Type',
                  val: order.customerType || 'Customer',
                },
              ].map(({ icon, bg, label, val }) => (
                <div
                  key={label}
                  className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50/80 border border-slate-100"
                >
                  <div
                    className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}
                  >
                    {icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] text-slate-400 font-semibold truncate">
                      {label}
                    </p>
                    <p className="text-xs font-bold text-slate-800 truncate" title={val}>
                      {val}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Customisation Box Banner if present */}
            {order.isCustomisation && order.customisationDetails && (
              <div className="mt-5 p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 space-y-3 relative z-10">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-amber-900 uppercase tracking-wider">
                    Customisation Box Included
                  </span>
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-200 text-amber-900 border border-amber-300">
                    {order.customisationDetails.noOfBoxes} Boxes
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <p className="text-[10px] text-slate-400 font-semibold">Box Type</p>
                    <p className="font-bold text-slate-800">
                      {order.customisationDetails.boxType} (₹{order.customisationDetails.boxPrice})
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-semibold">Sticker</p>
                    <p className="font-bold text-slate-800">
                      {order.customisationDetails.hasSticker ? `Yes (₹10/box)` : 'No'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-semibold">Shrink</p>
                    <p className="font-bold text-slate-800">
                      {order.customisationDetails.hasShrink ? `Yes (₹10/box)` : 'No'}
                    </p>
                  </div>
                  {Boolean(order.customisationDetails.packingBoxesCount) && (
                    <div>
                      <p className="text-[10px] text-slate-400 font-semibold">Packing Boxes</p>
                      <p className="font-bold text-slate-800">
                        {order.customisationDetails.packingBoxesCount} Boxes (₹
                        {order.customisationDetails.packingBoxPrice || 0}/box)
                      </p>
                    </div>
                  )}
                  {order.customisationDetails.boxImageUrl && (
                    <div>
                      <p className="text-[10px] text-slate-400 font-semibold mb-1">Box Image</p>
                      <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-amber-300 shadow-2xs">
                        <Image
                          src={order.customisationDetails.boxImageUrl}
                          alt="Custom Box"
                          fill
                          className="object-cover"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Order Items Table Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                  <Package size={17} />
                </div>
                <div>
                  <h2 className="text-sm font-extrabold text-slate-900">Order Items</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {order.items?.length || 0} product(s) in this order
                  </p>
                </div>
              </div>
              <Link
                href={`/orders/create?editId=${order.id}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
              >
                <Plus size={13} /> Add Item
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[640px]">
                <thead>
                  <tr className="text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-[#FAFBFD] border-b border-slate-100">
                    <th className="py-3 px-5">PRODUCT</th>
                    <th className="py-3 px-4">UNIT PRICE</th>
                    <th className="py-3 px-4">QTY</th>
                    <th className="py-3 px-4">PACKET (₹)</th>
                    <th className="py-3 px-4">LINE TOTAL</th>
                    <th className="py-3 px-4">INSTRUCTIONS</th>
                    <th className="py-3 px-4 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {order.items?.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          <div className="relative w-11 h-11 rounded-xl bg-slate-900 overflow-hidden flex-shrink-0 border border-slate-200">
                            <Image
                              src={item.imageUrl || '/app-icon.png'}
                              alt={item.itemName}
                              fill
                              className="object-cover"
                            />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-900">{item.itemName}</p>
                            <p className="text-[11px] text-slate-400 font-mono">
                              {item.itemCode || 'ITM-001'} • {item.category || 'Sweet'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-xs font-semibold text-slate-800">
                        {fmtCurrency(item.unitPrice || 0)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
                          {item.quantity} {item.unit}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-600">
                        {item.hasPacket ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                            ✓ ₹5
                          </span>
                        ) : (
                          <span className="text-slate-400">No</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-extrabold text-slate-900">
                        {fmtCurrency(item.lineTotal || 0)}
                      </td>
                      <td className="py-3.5 px-4">
                        {item.manufacturingDescription || item.packingDescription ? (
                          <div className="flex flex-col gap-1 max-w-[200px]">
                            {item.manufacturingDescription && (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                <FileText size={11} className="text-amber-600 shrink-0" />
                                <span className="font-bold">Mfg:</span>
                                <span className="truncate" title={item.manufacturingDescription}>{item.manufacturingDescription}</span>
                              </span>
                            )}
                            {item.packingDescription && (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                                <FileText size={11} className="text-blue-600 shrink-0" />
                                <span className="font-bold">Pck:</span>
                                <span className="truncate" title={item.packingDescription}>{item.packingDescription}</span>
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 font-normal">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <Link
                          href={`/orders/create?editId=${order.id}`}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 transition-colors inline-flex items-center justify-center"
                          title="Options"
                        >
                          <MoreHorizontal size={16} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-white border-t border-slate-100">
                    <td colSpan={4} className="py-4 px-5 text-xs font-bold text-slate-600 text-right">
                      Grand Total:
                    </td>
                    <td colSpan={3} className="py-4 px-4 text-lg font-extrabold text-[#3B49DF]">
                      {fmtCurrency(order.totalAmount || 0)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Payment History Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                  <Wallet size={17} />
                </div>
                <div>
                  <h2 className="text-sm font-extrabold text-slate-900">Payment History</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {payments.length} transaction(s) recorded
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPaymentModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#02626D] hover:bg-[#024f58] text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
              >
                <Plus size={13} /> Add Payment
              </button>
            </div>

            {payments.length === 0 ? (
              <div className="py-10 text-center">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                  <IndianRupee size={20} className="text-slate-400" />
                </div>
                <p className="text-sm font-semibold text-slate-500">No payments recorded yet</p>
                <p className="text-xs text-slate-400 mt-1">
                  Click "Add Payment" to record a payment for this order.
                </p>
                <button
                  onClick={() => setIsPaymentModalOpen(true)}
                  className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-[#02626D] hover:bg-[#024f58] text-white text-xs font-bold transition-colors cursor-pointer mx-auto shadow-xs"
                >
                  <Wallet size={14} /> Add Payment
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[640px]">
                  <thead>
                    <tr className="text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-[#FAFBFD] border-b border-slate-100">
                      <th className="py-3 px-5">PAYMENT #</th>
                      <th className="py-3 px-4">DATE & TIME</th>
                      <th className="py-3 px-4">MODE</th>
                      <th className="py-3 px-4">AMOUNT</th>
                      <th className="py-3 px-4">STATUS</th>
                      <th className="py-3 px-4 text-center">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {payments.map((pay, idx) => (
                      <tr key={pay.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3.5 px-5 font-bold text-slate-800">
                          Payment #{idx + 1}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500">
                          {fmtDate(pay.paidAt)}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {pay.mode}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          {fmtCurrency(pay.amount)}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Completed
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => {
                                setIsPaymentModalOpen(true);
                                startEditPayment(pay);
                              }}
                              className="w-7 h-7 rounded-lg border border-slate-200 text-slate-500 hover:text-indigo-600 hover:bg-slate-50 flex items-center justify-center transition-colors cursor-pointer"
                              title="View / Edit Payment"
                            >
                              <Eye size={13} />
                            </button>
                            <button
                              onClick={() => {
                                setIsPaymentModalOpen(true);
                                setDeletingPaymentId(pay.id);
                              }}
                              className="w-7 h-7 rounded-lg border border-red-100 text-red-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition-colors cursor-pointer"
                              title="Delete Payment"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-white border-t border-slate-100">
                      <td colSpan={3} className="py-3.5 px-5 font-bold text-slate-800 text-sm">
                        Total Paid
                      </td>
                      <td colSpan={3} className="py-3.5 px-4 text-right font-extrabold text-emerald-600 text-sm">
                        {fmtCurrency(displayReceived)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

        </div>

        {/* RIGHT sidebar (4 cols) ──────────────────────────────────────── */}
        <div className="lg:col-span-4 space-y-6">

          {/* Customer Details Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <User size={16} />
                </div>
                <h2 className="text-sm font-extrabold text-slate-900">Customer Details</h2>
              </div>
              <Link
                href={`/orders/create?editId=${order.id}`}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
              >
                <Pencil size={12} /> Edit
              </Link>
            </div>

            <div className="pt-4 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#5B4EFF] text-white font-extrabold flex items-center justify-center text-lg shadow-sm flex-shrink-0">
                  {order.customerName?.charAt(0).toUpperCase() || 'R'}
                </div>
                <div>
                  <p className="text-sm font-extrabold text-slate-900 leading-tight">
                    {order.customerName}
                  </p>
                  <span className="inline-block mt-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
                    {order.customerType || 'Customer'}
                  </span>
                </div>
              </div>

              <div className="space-y-2.5 pt-2">
                {/* Phone */}
                <div className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-500 flex items-center justify-center flex-shrink-0">
                      <Phone size={13} />
                    </div>
                    <span className="text-xs font-semibold text-slate-700 truncate">
                      {order.customerMobile || '9963429286'}
                    </span>
                  </div>
                  <button
                    onClick={() => handleCopy(order.customerMobile || '9963429286', 'Phone Number')}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-md transition-colors cursor-pointer"
                    title="Copy Phone Number"
                  >
                    <Copy size={13} />
                  </button>
                </div>

                {/* Email */}
                <div className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-500 flex items-center justify-center flex-shrink-0">
                      <Mail size={13} />
                    </div>
                    <span className="text-xs font-semibold text-slate-700 truncate">
                      {order.customerEmail ||
                        `${(order.customerName || 'customer')
                          .toLowerCase()
                          .replace(/\s+/g, '.')}@example.com`}
                    </span>
                  </div>
                  <button
                    onClick={() =>
                      handleCopy(
                        order.customerEmail ||
                          `${(order.customerName || 'customer')
                            .toLowerCase()
                            .replace(/\s+/g, '.')}@example.com`,
                        'Email'
                      )
                    }
                    className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-md transition-colors cursor-pointer"
                    title="Copy Email"
                  >
                    <Copy size={13} />
                  </button>
                </div>

                {/* Address */}
                <div className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-500 flex items-center justify-center flex-shrink-0">
                      <MapPin size={13} />
                    </div>
                    <span className="text-xs font-semibold text-slate-700 truncate">
                      {order.deliveryAddress || order.customerAddress || 'Hyderabad, Telangana'}
                    </span>
                  </div>
                  <button
                    onClick={() =>
                      handleCopy(
                        order.deliveryAddress ||
                          order.customerAddress ||
                          'Hyderabad, Telangana',
                        'Address'
                      )
                    }
                    className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-md transition-colors cursor-pointer"
                    title="Copy Address"
                  >
                    <Copy size={13} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Summary Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 size={16} />
                </div>
                <h2 className="text-sm font-extrabold text-slate-900">Payment Summary</h2>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Check size={12} className="text-emerald-600" />
                {order.paymentStatus || 'Completed'}
              </span>
            </div>

            <div className="pt-4 space-y-4">
              {/* Payment Progress */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-slate-600">Payment Progress</span>
                  <span className="text-xs font-bold text-emerald-600">{paidPct}%</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#00A86B] transition-all duration-500"
                    style={{ width: `${paidPct}%` }}
                  />
                </div>
              </div>

              {/* Itemized charges */}
              <div className="space-y-2 text-xs border-b border-slate-100 pb-3">
                <div className="flex justify-between items-center text-slate-600">
                  <span>Sub Total</span>
                  <span className="font-semibold text-slate-800">
                    {fmtCurrency(order.subTotal || 0)}
                  </span>
                </div>

                {order.isCustomisation ? (
                  <>
                    {(order.boxChargesTotal || 0) > 0 && (
                      <div className="flex justify-between items-center text-slate-600">
                        <span>
                          Box Charges ({order.customisationDetails?.noOfBoxes || 1} × ₹
                          {order.customisationDetails?.boxPrice || 0}):
                        </span>
                        <span className="font-semibold text-slate-800">
                          + {fmtCurrency(order.boxChargesTotal || 0)}
                        </span>
                      </div>
                    )}
                    {(order.stickerChargesTotal || 0) > 0 && (
                      <div className="flex justify-between items-center text-slate-600">
                        <span>
                          Sticker Charges ({order.customisationDetails?.noOfBoxes || 1} × ₹10):
                        </span>
                        <span className="font-semibold text-slate-800">
                          + {fmtCurrency(order.stickerChargesTotal || 0)}
                        </span>
                      </div>
                    )}
                    {(order.shrinkChargesTotal || 0) > 0 && (
                      <div className="flex justify-between items-center text-slate-600">
                        <span>
                          Shrink Charges ({order.customisationDetails?.noOfBoxes || 1} × ₹10):
                        </span>
                        <span className="font-semibold text-slate-800">
                          + {fmtCurrency(order.shrinkChargesTotal || 0)}
                        </span>
                      </div>
                    )}
                    {(order.packetChargesTotal || 0) > 0 && (
                      <div className="flex justify-between items-center text-slate-600">
                        <span>
                          Packet Charges ({order.customisationDetails?.noOfBoxes || 1} boxes × ₹5):
                        </span>
                        <span className="font-semibold text-slate-800">
                          + {fmtCurrency(order.packetChargesTotal || 0)}
                        </span>
                      </div>
                    )}
                    {((order.customisationDetails?.packingBoxesTotal || order.customPackingBoxesTotal || (order.customisationDetails?.packingBoxesCount ? (order.customisationDetails.packingBoxesCount * (order.customisationDetails.packingBoxPrice || 0)) : 0)) > 0) && (
                      <div className="flex justify-between items-center text-slate-600">
                        <span>Packing Boxes ({order.customisationDetails?.packingBoxesCount || 0} × ₹{order.customisationDetails?.packingBoxPrice || 0}):</span>
                        <span className="font-semibold text-slate-800">
                          + {fmtCurrency(order.customisationDetails?.packingBoxesTotal || order.customPackingBoxesTotal || ((order.customisationDetails?.packingBoxesCount || 0) * (order.customisationDetails?.packingBoxPrice || 0)))}
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {(order.packingCharges || 0) > 0 && (
                      <div className="flex justify-between items-center text-slate-600">
                        <span>
                          Packing Charges{' '}
                          {order.noOfBoxes ? `(${order.noOfBoxes} boxes)` : ''}
                        </span>
                        <span className="font-semibold text-slate-800">
                          + {fmtCurrency(order.packingCharges || 0)}
                        </span>
                      </div>
                    )}
                    {(order.additionalCharges || 0) > 0 && (
                      <div className="flex justify-between items-center text-slate-600">
                        <span>Additional Charges:</span>
                        <span className="font-semibold text-slate-800">
                          + {fmtCurrency(order.additionalCharges || 0)}
                        </span>
                      </div>
                    )}
                  </>
                )}

                {(order.transportCharges || 0) > 0 && (
                  <div className="flex justify-between items-center text-emerald-700 font-medium">
                    <span>Transport Charges:</span>
                    <span className="font-bold">+ {fmtCurrency(order.transportCharges || 0)}</span>
                  </div>
                )}

                {(order.discountAmount || 0) > 0 && (
                  <div className="flex justify-between items-center text-emerald-600 font-medium">
                    <span>Discount:</span>
                    <span className="font-bold">- {fmtCurrency(order.discountAmount || 0)}</span>
                  </div>
                )}
              </div>

              {/* Totals */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-800">Grand Total</span>
                  <span className="text-base font-extrabold text-[#3B49DF]">
                    {fmtCurrency(order.totalAmount || 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-600 font-medium">Total Received</span>
                  <span className="font-extrabold text-emerald-600">
                    {fmtCurrency(displayReceived)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-800 font-bold">Balance Due</span>
                  <span
                    className={`font-extrabold ${
                      balanceDue > 0 ? 'text-red-600' : 'text-emerald-600'
                    }`}
                  >
                    {fmtCurrency(Math.abs(balanceDue))}
                    {balanceDue < 0 && <span className="text-[10px] font-semibold ml-1">(Overpaid)</span>}
                  </span>
                </div>
              </div>

              {/* Mode & Transactions */}
              <div className="pt-3 border-t border-slate-100 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Payment Mode</span>
                  <span className="flex items-center gap-1.5 font-bold text-slate-800">
                    <Banknote size={14} className="text-slate-400" />
                    {order.paymentMode || 'Cash'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Transactions</span>
                  <span className="font-bold text-slate-800">{payments.length} payment(s)</span>
                </div>
              </div>

              {/* Manage Payment CTA Button */}
              <button
                onClick={() => setIsPaymentModalOpen(true)}
                className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#02626D] hover:bg-[#024f58] text-white text-xs font-bold transition-all cursor-pointer shadow-sm"
              >
                <CreditCard size={14} /> Manage Payment
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
                    <div className="grid grid-cols-3 gap-1.5">
                      {['Cash', 'UPI', 'Card', 'Bank Transfer', 'Cheque', 'Credit'].map(mode => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setEditPayMode(mode as any)}
                          className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${editPayMode === mode
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
                        >
                          {getModeIcon(mode as any)} {mode}
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
                /* ── ADD NEW PAYMENT FORM (SINGLE OR SPLIT) ── */
                order.paymentStatus !== 'Completed' && (
                  <div className="space-y-3">
                    {/* Payment Mode Switcher (Single vs Split) */}
                    <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
                      <button
                        type="button"
                        onClick={() => setIsSplitPayment(false)}
                        className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                          !isSplitPayment
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Single Payment
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsSplitPayment(true);
                          if (splitPayments.length >= 1 && !splitPayments[0].amount && payAmount) {
                            setSplitPayments((prev) =>
                              prev.map((s, i) => (i === 0 ? { ...s, amount: payAmount, mode: payMode } : s))
                            );
                          }
                        }}
                        className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                          isSplitPayment
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <span>Split Payment</span>
                        <span className="text-[9px] bg-amber-400 text-amber-950 px-1.5 py-0.2 rounded font-extrabold">NEW</span>
                      </button>
                    </div>

                    {!isSplitPayment ? (
                      /* ── SINGLE PAYMENT FORM ── */
                      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-4 animate-in fade-in duration-150">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                            <Plus size={13} /> Add Single Payment
                          </p>
                          <div className="flex items-center gap-1 text-[10px]">
                            <button
                              type="button"
                              onClick={() => setPayAmount(balanceDue > 0 ? String(Math.round(balanceDue * 100) / 100) : '')}
                              className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold hover:bg-emerald-200 cursor-pointer"
                            >
                              100% Full
                            </button>
                            <button
                              type="button"
                              onClick={() => setPayAmount(balanceDue > 0 ? String(Math.round((balanceDue / 2) * 100) / 100) : '')}
                              className="px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 font-bold hover:bg-sky-200 cursor-pointer"
                            >
                              50% Half
                            </button>
                            <button
                              type="button"
                              onClick={() => setPayAmount('')}
                              className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-bold hover:bg-slate-300 cursor-pointer"
                            >
                              Clear
                            </button>
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between items-center mb-1.5">
                            <label className="block text-xs font-semibold text-slate-600">
                              Amount (₹) <span className="text-red-500">*</span>
                            </label>
                            <span className="text-[10px] font-bold text-slate-400">
                              Max: {fmtCurrency(Math.max(0, balanceDue))}
                            </span>
                          </div>
                          <div className="relative">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">₹</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0.01"
                              max={Math.max(0, balanceDue)}
                              placeholder={`Max: ${Math.max(0, balanceDue).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`}
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
                          <div className="grid grid-cols-3 gap-1.5">
                            {['Cash', 'UPI', 'Card', 'Bank Transfer', 'Cheque', 'Credit'].map(mode => (
                              <button
                                key={mode}
                                type="button"
                                onClick={() => setPayMode(mode as any)}
                                className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${payMode === mode
                                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
                              >
                                {getModeIcon(mode as any)} {mode}
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
                          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 hover:from-emerald-600 hover:to-emerald-800 text-white text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50"
                        >
                          {isSavingPayment ? <Loader2 size={14} className="animate-spin" /> : <BadgeCheck size={15} />}
                          Confirm Payment ({fmtCurrency(parseFloat(payAmount) || 0)})
                        </button>
                      </div>
                    ) : (
                      /* ── SPLIT PAYMENT FORM ── */
                      <div className="bg-[#f0f9fa] rounded-2xl border border-[#b2e3e8] p-4 space-y-3.5 animate-in fade-in duration-150">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#b2e3e8]/70 pb-2.5">
                          <div>
                            <p className="text-xs font-extrabold text-[#02626D] uppercase tracking-wider flex items-center gap-1.5">
                              <CreditCard size={13} /> Split Payment Collection
                            </p>
                            <p className="text-[10px] text-slate-500">Collect across multiple payment modes simultaneously</p>
                          </div>

                          <div className="flex items-center gap-1 text-[10px]">
                            <button
                              type="button"
                              onClick={() => {
                                const half = Math.round((balanceDue / 2) * 100) / 100;
                                const otherHalf = Math.round((balanceDue - half) * 100) / 100;
                                setSplitPayments([
                                  { id: 'split-1', mode: 'UPI', amount: String(half), note: '' },
                                  { id: 'split-2', mode: 'Cash', amount: String(otherHalf), note: '' },
                                ]);
                              }}
                              className="px-2 py-0.5 rounded bg-sky-100 text-sky-800 font-bold hover:bg-sky-200 cursor-pointer"
                            >
                              50 / 50 Split
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSplitPayments([
                                  { id: 'split-1', mode: 'UPI', amount: '', note: '' },
                                  { id: 'split-2', mode: 'Cash', amount: '', note: '' },
                                ]);
                              }}
                              className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-bold hover:bg-slate-300 cursor-pointer"
                            >
                              Clear
                            </button>
                          </div>
                        </div>

                        {/* Split Rows */}
                        <div className="space-y-2.5">
                          {splitPayments.map((split, index) => {
                            const currentSplitsTotalExceptThis = splitPayments.reduce(
                              (sum, s, i) => (i === index ? sum : sum + (parseFloat(String(s.amount)) || 0)),
                              0
                            );
                            const remainingToFill = Math.max(0, Math.round((balanceDue - currentSplitsTotalExceptThis) * 100) / 100);

                            return (
                              <div
                                key={split.id || index}
                                className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs space-y-2"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-bold text-slate-700">
                                    Split #{index + 1}
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    {remainingToFill > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSplitPayments((prev) =>
                                            prev.map((s, i) => (i === index ? { ...s, amount: String(remainingToFill) } : s))
                                          );
                                        }}
                                        className="text-[10px] font-bold text-[#02626D] bg-teal-50 px-2 py-0.5 rounded hover:bg-teal-100 cursor-pointer border border-teal-200"
                                      >
                                        Fill Balance ({fmtCurrency(remainingToFill)})
                                      </button>
                                    )}
                                    {splitPayments.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSplitPayments((prev) => prev.filter((_, i) => i !== index));
                                        }}
                                        className="text-slate-400 hover:text-red-500 p-0.5 rounded hover:bg-red-50 cursor-pointer"
                                        title="Remove Split"
                                      >
                                        <X size={14} />
                                      </button>
                                    )}
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  <div>
                                    <label className="block text-[10px] font-semibold text-slate-500 mb-1">Mode</label>
                                    <select
                                      value={split.mode}
                                      onChange={(e) => {
                                        const newMode = e.target.value;
                                        setSplitPayments((prev) =>
                                          prev.map((s, i) => (i === index ? { ...s, mode: newMode } : s))
                                        );
                                      }}
                                      className="w-full h-8 px-2.5 text-xs font-bold text-slate-800 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:border-[#02626D]"
                                    >
                                      {['UPI', 'Cash', 'Card', 'Bank Transfer', 'Cheque', 'Credit'].map((m) => (
                                        <option key={m} value={m}>
                                          {m}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <div>
                                    <label className="block text-[10px] font-semibold text-slate-500 mb-1">Amount (₹) *</label>
                                    <div className="relative">
                                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">₹</span>
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        placeholder="0.00"
                                        value={split.amount}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setSplitPayments((prev) =>
                                            prev.map((s, i) => (i === index ? { ...s, amount: val } : s))
                                          );
                                        }}
                                        className="w-full h-8 pl-6 pr-2.5 text-xs font-black text-slate-900 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:border-[#02626D]"
                                      />
                                    </div>
                                  </div>
                                </div>

                                <div>
                                  <input
                                    type="text"
                                    placeholder="Split note / reference (optional)..."
                                    value={split.note || ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setSplitPayments((prev) =>
                                        prev.map((s, i) => (i === index ? { ...s, note: val } : s))
                                      );
                                    }}
                                    className="w-full h-7 px-2.5 text-[11px] border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:border-[#02626D]"
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Add Split Button */}
                        <button
                          type="button"
                          onClick={() => {
                            const currentSum = splitPayments.reduce((sum, s) => sum + (parseFloat(String(s.amount)) || 0), 0);
                            const rem = Math.max(0, Math.round((balanceDue - currentSum) * 100) / 100);
                            setSplitPayments((prev) => [
                              ...prev,
                              {
                                id: `split-${Date.now()}`,
                                mode: prev.some((p) => p.mode === 'Cash') ? 'UPI' : 'Cash',
                                amount: rem > 0 ? String(rem) : '',
                                note: '',
                              },
                            ]);
                          }}
                          className="w-full py-1.5 rounded-lg border border-dashed border-[#02626D]/50 text-[#02626D] bg-white hover:bg-teal-50/60 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                        >
                          <Plus size={13} /> Add Another Split
                        </button>

                        {/* Total Breakdown Summary for Splits */}
                        <div className="p-2.5 rounded-xl bg-white border border-[#b2e3e8] text-xs space-y-1">
                          <div className="flex justify-between items-center text-slate-600">
                            <span>Total of Splits:</span>
                            <span className="font-extrabold text-slate-900">{fmtCurrency(splitTotal)}</span>
                          </div>
                          <div className="flex justify-between items-center text-slate-600">
                            <span>Balance Due:</span>
                            <span className="font-extrabold text-red-600">{fmtCurrency(Math.max(0, balanceDue))}</span>
                          </div>
                          <div className="pt-1 border-t border-slate-100 flex justify-between items-center font-bold">
                            <span className="text-[11px] text-slate-500">Remaining after splits:</span>
                            <span className={`text-xs font-black ${balanceDue - splitTotal < -0.001 ? 'text-red-600' : 'text-emerald-700'}`}>
                              {fmtCurrency(Math.max(0, balanceDue - splitTotal))}
                              {balanceDue - splitTotal < -0.001 && ' (Exceeds balance!)'}
                            </span>
                          </div>
                        </div>

                        {/* Confirm Split Payment Button */}
                        <button
                          type="button"
                          onClick={handleAddSplitPayments}
                          disabled={
                            isSavingPayment ||
                            splitTotal <= 0 ||
                            splitTotal > balanceDue + 0.001
                          }
                          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 hover:from-emerald-600 hover:to-emerald-800 text-white text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50"
                        >
                          {isSavingPayment ? <Loader2 size={14} className="animate-spin" /> : <BadgeCheck size={15} />}
                          Confirm Split Payment ({fmtCurrency(splitTotal)})
                        </button>
                      </div>
                    )}
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

      {/* ── OTP Authorization Modal for Non-Admin Edit / Delete ───── */}
      <OrderActionOtpModal
        isOpen={authModalState.isOpen}
        onClose={() => setAuthModalState((prev) => ({ ...prev, isOpen: false }))}
        order={
          order
            ? {
                id: order.id,
                code: order.code,
                customerName: order.customerName,
                totalAmount: order.totalAmount,
                orderDate: order.orderDate,
              }
            : null
        }
        action={authModalState.action}
        requestedBy={employeeProfile?.name || user?.email?.split('@')[0] || 'Staff'}
        onAuthorized={handleAuthOtpSuccess}
      />

    </div>
  );
}

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Users,
  Building2,
  Phone,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Package,
  Factory,
  WalletCards,
  Receipt,
  Printer,
  Plus,
  Trash2,
  X,
  Loader2,
  CreditCard,
  TrendingUp,
  Tag,
  DollarSign,
  ChevronRight,
  FileText,
  Check,
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
import { useBusinessSettings, formatStoreAddress, formatStorePhone } from '@/lib/businessSettings';
import { usePrinter } from '@/context/PrinterContext';

export interface PaymentEntry {
  id: string;
  amount: number;
  mode: string;
  note: string;
  paidAt: string;
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

export interface WholesalerOrderRecord {
  id: string;
  orderId: string;
  wholesalerId: string;
  wholesalerName: string;
  wholesalerMobile: string;
  companyName?: string;
  wholesalerGstin?: string;
  deliveryAddress?: string;
  notes?: string;
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
  updatedAt?: any;
}

const getTodayDateStr = () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export default function WholesalerOrderDetailClient({ orderId }: { orderId: string }) {
  const router = useRouter();
  const { settings: businessSettings } = useBusinessSettings();
  const { isConnected: isPrinterConnected, printerType, printReceipt } = usePrinter();

  const [order, setOrder] = useState<WholesalerOrderRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [showThermalModal, setShowThermalModal] = useState(false);

  // Payment installment states
  const [installmentAmount, setInstallmentAmount] = useState<string>('');
  const [installmentMode, setInstallmentMode] = useState<string>('UPI');
  const [installmentDate, setInstallmentDate] = useState<string>(getTodayDateStr());
  const [installmentNote, setInstallmentNote] = useState<string>('');
  const [isSavingInstallment, setIsSavingInstallment] = useState(false);
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);

  // Fetch Order Real-Time
  useEffect(() => {
    if (!orderId) return;

    // Try listening by document ID directly first
    const orderDocRef = doc(db, 'orders', orderId);
    const unsub = onSnapshot(
      orderDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setOrder({ id: docSnap.id, ...docSnap.data() } as WholesalerOrderRecord);
          setLoading(false);
        } else {
          // If not found by doc id, query by orderId field (e.g. WSO-xxx)
          const q = query(collection(db, 'orders'), where('orderId', '==', orderId));
          getDocs(q).then((querySnap) => {
            if (!querySnap.empty) {
              const firstDoc = querySnap.docs[0];
              setOrder({ id: firstDoc.id, ...firstDoc.data() } as WholesalerOrderRecord);
            } else {
              setOrder(null);
            }
            setLoading(false);
          }).catch((err) => {
            console.error('Error fetching order by orderId field:', err);
            setLoading(false);
          });
        }
      },
      (error) => {
        console.error('Error fetching wholesaler order:', error);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [orderId]);

  // Derived financial numbers
  const totalAmount = useMemo(() => Number(order?.totalAmount) || 0, [order]);
  const receivedAmount = useMemo(() => Number(order?.receivedAmount) || 0, [order]);
  const balanceDue = useMemo(() => Math.max(0, totalAmount - receivedAmount), [totalAmount, receivedAmount]);
  const isSettled = balanceDue <= 0.01;
  const percentPaid = totalAmount > 0 ? Math.min(100, Math.round((receivedAmount / totalAmount) * 100)) : 0;

  // When order changes, populate installment defaults
  useEffect(() => {
    if (order) {
      const curDue = Math.max(0, (Number(order.totalAmount) || 0) - (Number(order.receivedAmount) || 0));
      setInstallmentAmount(curDue > 0 ? String(curDue) : '');
      setInstallmentMode(order.paymentMode && !order.paymentMode.includes('Pending') ? order.paymentMode : 'UPI');
      setInstallmentDate(getTodayDateStr());
      setInstallmentNote('');
    }
  }, [order?.totalAmount, order?.receivedAmount]);

  // Update Status Handler
  const handleUpdateStatus = async (newStatus: WholesalerOrderRecord['status']) => {
    if (!order) return;
    try {
      setIsUpdatingStatus(true);
      await updateDoc(doc(db, 'orders', order.id), {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });
      toast.success('Status Updated', `Order status changed to ${newStatus}`);
    } catch (err: any) {
      console.error('Failed to update status:', err);
      toast.error('Update Failed', err?.message || 'Could not update status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Record Installment Payment
  const handleRecordInstallment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;

    const amt = parseFloat(installmentAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.warning('Invalid Amount', 'Please enter a valid installment payment amount.');
      return;
    }

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
        note: installmentNote.trim() || 'Installment payment',
        paidAt: installmentDate ? new Date(installmentDate).toISOString() : new Date().toISOString(),
      };

      const existingPayments = Array.isArray(order.payments)
        ? [...order.payments]
        : receivedAmount > 0
        ? [
            {
              id: 'initial-pay',
              amount: receivedAmount,
              mode: order.paymentMode || 'Cash',
              note: 'Initial payment',
              paidAt: order.createdAt?.toDate ? order.createdAt.toDate().toISOString() : new Date().toISOString(),
            },
          ]
        : [];

      const updatedPayments = [...existingPayments, newEntry];
      const newTotalReceived = Math.round((receivedAmount + amt) * 100) / 100;
      const isFullyPaid = newTotalReceived >= totalAmount - 0.01;
      const newPaymentStatus: 'Paid' | 'Partial' | 'Pending' = isFullyPaid ? 'Paid' : 'Partial';

      await updateDoc(doc(db, 'orders', order.id), {
        receivedAmount: newTotalReceived,
        paymentStatus: newPaymentStatus,
        paymentMode: installmentMode,
        payments: updatedPayments,
        updatedAt: serverTimestamp(),
      });

      const remainingAfter = Math.max(0, totalAmount - newTotalReceived);
      setInstallmentAmount(remainingAfter > 0 ? String(remainingAfter) : '');
      setInstallmentNote('');

      toast.success(
        'Installment Recorded',
        `Recorded ₹${amt.toLocaleString('en-IN')} payment for Order ${order.orderId}. ${
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
    if (!order) return;
    if (!confirm('Are you sure you want to remove this installment payment? The order balance will be recalculated.')) {
      return;
    }

    try {
      setDeletingPaymentId(paymentId);
      const currentPayments = Array.isArray(order.payments) ? order.payments : [];
      const updatedPayments = currentPayments.filter((p) => p.id !== paymentId);
      const newReceived = Math.round(updatedPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) * 100) / 100;
      const newPaymentStatus: 'Paid' | 'Partial' | 'Pending' =
        newReceived >= totalAmount - 0.01 ? 'Paid' : newReceived > 0 ? 'Partial' : 'Pending';

      await updateDoc(doc(db, 'orders', order.id), {
        receivedAmount: newReceived,
        paymentStatus: newPaymentStatus,
        payments: updatedPayments,
        updatedAt: serverTimestamp(),
      });

      const newDue = Math.max(0, totalAmount - newReceived);
      setInstallmentAmount(newDue > 0 ? String(newDue) : '');

      toast.success('Installment Removed', 'Payment entry deleted and order balance updated.');
    } catch (err: any) {
      console.error('Error removing installment:', err);
      toast.error('Failed to Remove', err?.message || 'Could not remove installment.');
    } finally {
      setDeletingPaymentId(null);
    }
  };

  // Thermal Receipt Print Handler
  const handleThermalPrint = async () => {
    if (!order) return;
    const orderItems = (order.items || []).map((it) => {
      const qty = parseFloat(String(it.quantity || 1)) || 1;
      const price = parseFloat(String(it.assignedPrice || it.standardPrice || 0)) || 0;
      const total = parseFloat(String(it.totalAmount || 0)) || (qty * price);
      return {
        name: it.name || it.itemName || 'Item',
        qty,
        unit: it.unit || 'kg',
        price,
        total,
        note: it.needsManufacturing ? 'Mfg Req' : 'In Stock',
      };
    });

    const paymentsList = Array.isArray(order.payments) ? order.payments : [];
    const lastPayment = paymentsList.length > 0 ? paymentsList[paymentsList.length - 1] : null;

    if (isPrinterConnected && (printerType === 'USB' || printerType === 'Bluetooth')) {
      try {
        await printReceipt({
          billNo: order.orderId || order.id,
          customerName: order.wholesalerName + (order.companyName ? ` (${order.companyName})` : ''),
          customerPhone: order.wholesalerMobile,
          customerAddress: order.deliveryAddress,
          dateStr: order.orderDate,
          deliveryDate: order.expectedDeliveryDate,
          orderType: 'Wholesale B2B Order',
          orderStatus: order.orderStatus || order.status,
          paymentMode: lastPayment ? lastPayment.mode : (order.paymentMode || 'Credit'),
          paymentStatus: order.paymentStatus || (receivedAmount >= totalAmount - 0.01 ? 'Paid' : receivedAmount > 0 ? 'Partial' : 'Pending'),
          items: orderItems,
          subtotal: order.taxableAmount ?? order.subtotal ?? totalAmount,
          tax: (order.cgstAmount || 0) + (order.sgstAmount || 0),
          cgstAmount: order.cgstAmount,
          sgstAmount: order.sgstAmount,
          cgstPercent: order.cgstPercent,
          sgstPercent: order.sgstPercent,
          taxType: order.taxType || 'inclusive',
          grandTotal: totalAmount,
          receivedAmount: receivedAmount,
          balanceAmount: balanceDue,
          footerNote: businessSettings.footerNote || 'Thank you for choosing Pattabiram Sweets! Visit again!',
        });
        toast.success('Thermal Print Sent', 'Receipt dispatched to connected thermal printer.');
        return;
      } catch (err: any) {
        console.error('Thermal printer error:', err);
      }
    }

    // Open Thermal Receipt Preview Modal
    setShowThermalModal(true);
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-slate-400 gap-3">
        <Loader2 size={32} className="animate-spin text-[#02626D]" />
        <p className="text-sm font-medium">Loading wholesale order details...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mb-3">
          <AlertTriangle size={28} />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Wholesale Order Not Found</h2>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">
          No order record exists with identifier &ldquo;{orderId}&rdquo;. It may have been deleted or moved.
        </p>
        <Link
          href="/wholesaler-orders"
          className="mt-4 px-4 py-2 bg-[#02626D] text-white text-xs font-semibold rounded-xl hover:bg-[#014d56] transition-colors inline-flex items-center gap-2"
        >
          <ArrowLeft size={14} />
          <span>Back to Wholesale Orders</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-5 text-slate-800 font-sans pb-16">
      {/* ── Top Header Navigation Bar ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1 print:hidden">
        <div className="flex items-center gap-3">
          <Link
            href="/wholesaler-orders"
            className="w-9 h-9 rounded-xl bg-white border border-slate-200/90 text-slate-600 hover:text-slate-900 hover:bg-slate-50 flex items-center justify-center shadow-2xs transition-colors shrink-0"
            title="Back to Orders List"
          >
            <ArrowLeft size={16} />
          </Link>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight font-mono">
                {order.orderId}
              </h1>

              {/* Status Badge */}
              <span
                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                  order.status === 'Delivered'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : order.status === 'Approved'
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : order.status === 'Processing'
                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}
              >
                {order.status || 'Pending'}
              </span>

              {/* Payment Status Badge */}
              <span
                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                  isSettled
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : receivedAmount > 0
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-rose-50 text-rose-700 border-rose-200'
                }`}
              >
                {isSettled ? 'Paid' : receivedAmount > 0 ? 'Partial' : 'Pending Payment'}
              </span>
            </div>

            <p className="text-xs text-slate-500 mt-0.5">
              Wholesale B2B Order • Assigned Price List: <strong className="text-slate-700">{order.priceListName || 'Standard'}</strong>
            </p>
          </div>
        </div>

        {/* Top Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status Changer */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-200/90 rounded-xl px-2 py-1 shadow-2xs">
            <span className="text-[11px] text-slate-400 font-semibold pl-1">Status:</span>
            <select
              value={order.status || 'Pending'}
              disabled={isUpdatingStatus}
              onChange={(e) => handleUpdateStatus(e.target.value as any)}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Processing">Processing</option>
              <option value="Delivered">Delivered</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          {/* Jump to Payments */}
          <a
            href="#manage-payments"
            className="h-9 px-3.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs inline-flex items-center gap-1.5 cursor-pointer transition-colors active:scale-95"
          >
            <WalletCards size={14} />
            <span>Manage Payments</span>
          </a>

          {/* Print Thermal Receipt */}
          <button
            type="button"
            onClick={handleThermalPrint}
            className="h-9 px-3.5 text-xs font-bold rounded-xl bg-[#02626D] hover:bg-[#014d56] text-white shadow-2xs inline-flex items-center gap-1.5 cursor-pointer transition-colors active:scale-95"
            title="Print Thermal Receipt (80mm)"
          >
            <Printer size={14} />
            <span>Print Thermal Receipt</span>
          </button>
        </div>
      </div>

      {/* ── Status Timeline Indicator ────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs print:hidden">
        <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-3">
          <span className="flex items-center gap-1.5">
            <Clock size={14} className="text-[#02626D]" />
            <span>Order Fulfillment Pipeline</span>
          </span>
          <span className="text-[11px] text-slate-400 font-normal">
            Current Stage: <strong className="text-slate-800">{order.orderStatus || order.status}</strong>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: 'Order Created', icon: Receipt, active: true },
            {
              label: 'Kitchen Mfg',
              icon: Factory,
              active:
                order.orderStatus === 'Moved to Manufacturing' ||
                order.orderStatus === 'Moved to Packing' ||
                order.orderStatus === 'Moved to Store' ||
                order.orderStatus === 'Delivered' ||
                order.status === 'Approved' ||
                order.status === 'Processing' ||
                order.status === 'Delivered',
            },
            {
              label: 'Packing',
              icon: Package,
              active:
                order.orderStatus === 'Moved to Packing' ||
                order.orderStatus === 'Moved to Store' ||
                order.orderStatus === 'Delivered' ||
                order.status === 'Delivered',
            },
            {
              label: 'Delivered',
              icon: CheckCircle2,
              active: order.status === 'Delivered' || order.orderStatus === 'Delivered',
            },
          ].map((step, idx) => (
            <div
              key={idx}
              className={`p-2.5 rounded-xl border flex items-center gap-2.5 transition-colors ${
                step.active
                  ? 'bg-teal-50/70 border-teal-200 text-teal-900 font-bold'
                  : 'bg-slate-50/60 border-slate-200/70 text-slate-400'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                  step.active ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-400'
                }`}
              >
                <step.icon size={14} />
              </div>
              <span className="text-xs truncate">{step.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Grid: Wholesaler Info + Key Dates + Financial Snapshot ───────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 print:grid-cols-3">
        {/* Card 1: Wholesaler & Company Information */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
            <Building2 size={14} className="text-[#02626D]" />
            <span>Wholesaler Profile</span>
          </div>

          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900">{order.wholesalerName}</h3>
            {order.companyName && (
              <p className="text-xs text-slate-600 font-semibold">{order.companyName}</p>
            )}
            {order.wholesalerMobile && (
              <p className="text-xs text-slate-600 flex items-center gap-1.5 font-mono pt-1">
                <Phone size={13} className="text-slate-400" />
                <a href={`tel:${order.wholesalerMobile}`} className="hover:text-[#02626D] hover:underline">
                  {order.wholesalerMobile}
                </a>
              </p>
            )}
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Price List:</span>
            <span className="font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
              {order.priceListName || 'Standard Rates'}
            </span>
          </div>
        </div>

        {/* Card 2: Dates & Delivery Logistics */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
            <Calendar size={14} className="text-[#02626D]" />
            <span>Order Timeline</span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Order Date:</span>
              <span className="font-bold text-slate-800 font-mono">
                {order.orderDate || (order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString('en-CA') : '—')}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-500">Expected Delivery:</span>
              <span className="font-bold text-slate-800 font-mono">
                {order.expectedDeliveryDate || order.orderDate || '—'}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-500">Manufacturing Date:</span>
              <span className="font-bold text-slate-800 font-mono">
                {order.manufacturingDate || order.orderDate || '—'}
              </span>
            </div>

            <div className="flex justify-between pt-1 border-t border-slate-100 text-[11px]">
              <span className="text-slate-400">Created At:</span>
              <span className="text-slate-600 font-mono">
                {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleString('en-IN') : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Financial Summary Snapshot */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
            <DollarSign size={14} className="text-[#02626D]" />
            <span>Financial Snapshot</span>
          </div>

          <div className="space-y-1.5 text-xs font-mono">
            <div className="flex justify-between text-slate-600">
              <span>{order.taxType === 'inclusive' ? 'Base Subtotal:' : 'Subtotal:'}</span>
              <span>₹{(order.taxableAmount ?? order.subtotal ?? 0).toFixed(2)}</span>
            </div>

            {(order.cgstAmount || order.sgstAmount) ? (
              <>
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>CGST ({order.cgstPercent ?? 2.5}%):</span>
                  <span>{order.taxType === 'exclusive' ? '+₹' : '₹'}{(order.cgstAmount ?? 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>SGST ({order.sgstPercent ?? 2.5}%):</span>
                  <span>{order.taxType === 'exclusive' ? '+₹' : '₹'}{(order.sgstAmount ?? 0).toFixed(2)}</span>
                </div>
              </>
            ) : null}

            <div className="flex justify-between text-sm font-bold text-slate-900 pt-1 border-t border-slate-100">
              <span>Grand Total:</span>
              <span className="text-base text-[#02626D]">₹{totalAmount.toLocaleString('en-IN')}</span>
            </div>

            <div className="flex justify-between text-xs text-emerald-700 font-semibold pt-0.5">
              <span>Total Paid:</span>
              <span>₹{receivedAmount.toLocaleString('en-IN')}</span>
            </div>

            <div className="flex justify-between text-xs font-black pt-1 border-t border-slate-100">
              <span className={balanceDue > 0.01 ? 'text-rose-600' : 'text-emerald-600'}>
                {balanceDue > 0.01 ? 'Balance Due:' : 'All Settled:'}
              </span>
              <span className={balanceDue > 0.01 ? 'text-rose-700 font-black' : 'text-emerald-600 font-bold'}>
                ₹{balanceDue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Order Line Items Table ───────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-200/90 bg-[#f7f7f8] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package size={16} className="text-[#02626D]" />
            <h3 className="text-sm font-bold text-slate-900">
              Order Items ({order.items?.length || 0})
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            Total Weight / Units: {Math.round((order.items || []).reduce((acc, it) => acc + (it.quantity || 0), 0) * 100) / 100}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs min-w-[700px]">
            <thead>
              <tr className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider bg-slate-50/70 border-b border-slate-200">
                <th className="py-3 px-4 w-12 text-center">#</th>
                <th className="py-3 px-4">Product Details</th>
                <th className="py-3 px-4">Standard Rate</th>
                <th className="py-3 px-4">Assigned B2B Rate</th>
                <th className="py-3 px-4">Quantity</th>
                <th className="py-3 px-4">Line Total</th>
                <th className="py-3 px-4 text-center">Production Route</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(order.items || []).map((line, idx) => {
                const isMfg = line.needsManufacturing !== false && line.mfgStatus !== 'Not Required';
                const hasDiscount = line.assignedPrice < line.standardPrice;

                return (
                  <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 text-center font-mono text-slate-400">{idx + 1}</td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 overflow-hidden shrink-0 flex items-center justify-center relative">
                          {line.imageUrl ? (
                            <Image
                              src={line.imageUrl}
                              alt={line.name || line.itemName || 'Product'}
                              fill
                              className="object-contain p-1"
                            />
                          ) : (
                            <Package size={16} className="text-slate-400" />
                          )}
                        </div>

                        <div>
                          <p className="font-bold text-slate-900">{line.name || line.itemName}</p>
                          <p className="text-[10px] text-slate-400 font-mono">
                            {line.code || 'ITEM'} • {line.category || 'General'}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4 font-mono text-slate-500">
                      ₹{line.standardPrice} /{line.unit}
                    </td>

                    <td className="py-3 px-4 font-mono font-bold text-[#02626D]">
                      ₹{line.assignedPrice} /{line.unit}
                      {hasDiscount && (
                        <span className="block text-[9.5px] font-normal text-emerald-600">
                          (Special B2B Price)
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 font-bold text-slate-800">
                      {line.quantity} {line.unit}
                    </td>

                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      ₹{line.totalAmount || Math.round(line.assignedPrice * line.quantity * 100) / 100}
                    </td>

                    <td className="py-3 px-4 text-center">
                      {isMfg ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-teal-50 text-teal-800 font-semibold text-[10px] border border-teal-200">
                          <Factory size={11} className="text-teal-600" />
                          <span>In Mfg Queue</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium text-[10px] border border-slate-200">
                          <span>In Stock / Ready</span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── SECTION: Manage Payment & Installments ───────────────────────────── */}
      <div id="manage-payments" className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden scroll-mt-6 print:hidden">
        {/* Section Header */}
        <div className="p-4 border-b border-slate-200/90 bg-[#f7f7f8] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
              <WalletCards size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Manage Order Payments &amp; Installments</h3>
              <p className="text-[11px] text-slate-400">Record customer partial or full installment payments</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleThermalPrint}
              className="h-8 px-2.5 text-[11px] font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 inline-flex items-center gap-1.5 cursor-pointer transition-colors"
              title="Print Thermal Receipt"
            >
              <Printer size={13} />
              <span>Print Slip</span>
            </button>
            <span
              className={`text-xs font-bold px-3 py-1 rounded-lg border ${
                isSettled
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}
            >
              {isSettled ? '✅ Fully Paid' : `Pending: ₹${balanceDue.toLocaleString('en-IN')}`}
            </span>
          </div>
        </div>

        <div className="p-4 sm:p-5 space-y-5">
          {/* Progress & 3 Metric Stat Boxes */}
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="block text-[10px] font-bold text-slate-400 uppercase">Total Bill Amount</span>
                <span className="text-base sm:text-lg font-black text-slate-900 font-mono mt-0.5 block">
                  ₹{totalAmount.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-100">
                <span className="block text-[10px] font-bold text-emerald-600 uppercase">Total Received / Paid</span>
                <span className="text-base sm:text-lg font-black text-emerald-700 font-mono mt-0.5 block">
                  ₹{receivedAmount.toLocaleString('en-IN')}
                </span>
              </div>

              <div
                className={`p-3 rounded-xl border ${
                  isSettled ? 'bg-emerald-50/70 border-emerald-100' : 'bg-rose-50/70 border-rose-200'
                }`}
              >
                <span className={`block text-[10px] font-bold uppercase ${isSettled ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {isSettled ? 'Balance' : 'Outstanding Due'}
                </span>
                <span
                  className={`text-base sm:text-lg font-black font-mono mt-0.5 block ${
                    isSettled ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {isSettled ? '₹0 (Settled)' : `₹${balanceDue.toLocaleString('en-IN')}`}
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-slate-500">Collection Completion</span>
                <span className={isSettled ? 'text-emerald-600 font-bold' : 'text-slate-700'}>
                  {percentPaid}% Paid ({order.payments?.length || (receivedAmount > 0 ? 1 : 0)} installments)
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${isSettled ? 'bg-emerald-500' : 'bg-[#02626D]'}`}
                  style={{ width: `${percentPaid}%` }}
                />
              </div>
            </div>
          </div>

          {/* Two-Column Grid: Installments History (Left) + Add Installment Form (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-2">
            {/* Left: Past Installments Log */}
            <div className="lg:col-span-6 space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Receipt size={14} className="text-slate-500" />
                  <span>Payment Installments History</span>
                </h4>
                <span className="text-[11px] text-slate-400 font-medium">
                  {(order.payments || []).length} recorded
                </span>
              </div>

              {(!order.payments || order.payments.length === 0) ? (
                <div className="p-6 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400 bg-slate-50/50">
                  No installment payments recorded yet for this order. Use the form to record the first installment.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                  {order.payments.map((inst, idx) => (
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
                            <span className="font-bold text-slate-900 font-mono text-sm">
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
                        title="Void/Delete this installment"
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

            {/* Right: Add Installment Form */}
            <div className="lg:col-span-6">
              {isSettled ? (
                <div className="p-6 rounded-xl bg-emerald-50 border border-emerald-200 text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                    <CheckCircle2 size={24} />
                  </div>
                  <h4 className="text-sm font-bold text-emerald-900">Order Fully Settled</h4>
                  <p className="text-xs text-emerald-700">
                    All dues for this wholesale order have been collected in full (₹{totalAmount.toLocaleString('en-IN')}).
                  </p>
                </div>
              ) : (
                <form
                  onSubmit={handleRecordInstallment}
                  className="p-4 rounded-xl bg-slate-50 border border-slate-200/90 space-y-3.5"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Plus size={14} className="text-[#02626D]" />
                      <span>Record Payment Installment</span>
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Payment Date</label>
                      <input
                        type="date"
                        value={installmentDate}
                        onChange={(e) => setInstallmentDate(e.target.value)}
                        className="w-full px-2.5 h-9 bg-white text-xs font-semibold rounded-lg border border-slate-300 text-slate-800 focus:outline-none focus:border-[#02626D]"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Note / Reference (Optional)
                      </label>
                      <input
                        type="text"
                        value={installmentNote}
                        onChange={(e) => setInstallmentNote(e.target.value)}
                        placeholder="e.g. Installment 1 - Cheque #12345 or UPI ref"
                        className="w-full px-3 h-9 bg-white text-xs rounded-lg border border-slate-300 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#02626D]"
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-end">
                    <button
                      type="submit"
                      disabled={isSavingInstallment || !installmentAmount || parseFloat(installmentAmount) <= 0}
                      className="w-full sm:w-auto h-9 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95"
                    >
                      {isSavingInstallment ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          <span>Recording Installment...</span>
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
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Thermal Receipt Preview Modal ────────────────────────────────────── */}
      {showThermalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs print:hidden">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-sm p-4 space-y-3 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <Printer size={16} className="text-[#02626D]" />
                <h3 className="text-xs font-bold text-slate-800">Thermal Receipt Preview (80mm)</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowThermalModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Scrollable Receipt Preview */}
            <div className="max-h-[65vh] overflow-y-auto pr-1">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-mono text-[10px] space-y-2">
                {/* Store Header */}
                <div className="text-center border-b border-dashed border-slate-300 pb-2">
                  <h2 className="text-xs font-black uppercase tracking-wide truncate">
                    {businessSettings.businessName || 'PATTABIRAM SWEETS'}
                  </h2>
                  {businessSettings.tagline && (
                    <p className="text-[9px] text-slate-500 italic">{businessSettings.tagline}</p>
                  )}
                  <p className="text-[9px] text-slate-500">{formatStoreAddress(businessSettings)}</p>
                  <p className="text-[9px] text-slate-500">Ph: {formatStorePhone(businessSettings)}</p>
                  {businessSettings.gstNumber && (
                    <p className="text-[9px] font-semibold text-slate-700">GSTIN: {businessSettings.gstNumber}</p>
                  )}
                  {businessSettings.fssaiNumber && (
                    <p className="text-[9px] text-slate-500">FSSAI: {businessSettings.fssaiNumber}</p>
                  )}
                  <div className="mt-1 pt-1 border-t border-dashed border-slate-300 text-[10px] font-bold uppercase tracking-wider text-slate-800">
                    WHOLESALE TAX INVOICE
                  </div>
                </div>

                {/* Order Information */}
                <div className="text-[9px] space-y-0.5 border-b border-dashed border-slate-300 py-1.5">
                  <div className="flex justify-between font-bold">
                    <span>Order: {order.orderId}</span>
                    <span>{order.orderDate || '—'}</span>
                  </div>
                  <div>Wholesaler: <span className="font-bold">{order.wholesalerName}</span></div>
                  {order.companyName && <div>Company: {order.companyName}</div>}
                  {order.wholesalerMobile && <div>Mobile: {order.wholesalerMobile}</div>}
                  {order.wholesalerGstin && <div>Wholesaler GST: {order.wholesalerGstin}</div>}
                  {order.deliveryAddress && <div className="truncate">Address: {order.deliveryAddress}</div>}
                  <div className="flex justify-between pt-0.5">
                    <span>Price Tier: {order.priceListName || 'Standard'}</span>
                    <span className="font-semibold">Status: {order.status || 'Pending'}</span>
                  </div>
                </div>

                {/* Items Table */}
                <div className="py-1">
                  <div className="flex justify-between font-bold pb-1 border-b border-slate-200 text-slate-600">
                    <span className="w-1/2">Item</span>
                    <span className="w-1/4 text-center">Qty</span>
                    <span className="w-1/4 text-right">Total</span>
                  </div>
                  <div className="divide-y divide-slate-200">
                    {(order.items || []).map((it, idx) => {
                      const qty = parseFloat(String(it.quantity || 1)) || 1;
                      const price = parseFloat(String(it.assignedPrice || it.standardPrice || 0)) || 0;
                      const lineTotal = parseFloat(String(it.totalAmount || 0)) || (qty * price);
                      return (
                        <div key={idx} className="py-1">
                          <div className="flex justify-between">
                            <span className="font-semibold text-slate-900 truncate">{it.name || it.itemName}</span>
                            <span className="font-bold">₹{lineTotal.toFixed(2)}</span>
                          </div>
                          <div className="text-[8px] text-slate-500 flex justify-between">
                            <span>{qty} {it.unit || 'kg'} x ₹{price}</span>
                            {it.needsManufacturing ? (
                              <span className="text-amber-700 italic font-semibold">[Mfg]</span>
                            ) : (
                              <span className="text-emerald-700 font-semibold">[Stock]</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Totals Breakdown */}
                <div className="border-t border-dashed border-slate-300 pt-1.5 space-y-0.5">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>₹{(order.taxableAmount ?? order.subtotal ?? 0).toFixed(2)}</span>
                  </div>
                  {order.cgstAmount ? (
                    <div className="flex justify-between text-slate-600">
                      <span>CGST ({order.cgstPercent ?? 2.5}%):</span>
                      <span>₹{order.cgstAmount.toFixed(2)}</span>
                    </div>
                  ) : null}
                  {order.sgstAmount ? (
                    <div className="flex justify-between text-slate-600">
                      <span>SGST ({order.sgstPercent ?? 2.5}%):</span>
                      <span>₹{order.sgstAmount.toFixed(2)}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between text-[11px] font-black border-t border-slate-300 pt-1 text-slate-900">
                    <span>GRAND TOTAL:</span>
                    <span>₹{totalAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-emerald-800">
                    <span>Total Paid:</span>
                    <span>₹{receivedAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-black text-rose-700">
                    <span>Balance Due:</span>
                    <span>₹{balanceDue.toFixed(2)}</span>
                  </div>
                </div>

                {/* Installments Breakdown */}
                {order.payments && order.payments.length > 0 && (
                  <div className="border-t border-dashed border-slate-300 pt-1.5 text-[8px] space-y-0.5 text-slate-700">
                    <p className="font-bold uppercase text-slate-500">Installments Recorded:</p>
                    {order.payments.map((p, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span>#{idx + 1} {p.mode} ({p.paidAt ? new Date(p.paidAt).toLocaleDateString() : ''})</span>
                        <span className="font-bold">₹{Number(p.amount).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Footer */}
                <div className="text-center text-[8px] text-slate-400 pt-2 border-t border-dashed border-slate-300">
                  <p>{businessSettings.footerNote || 'Thank you for choosing Pattabiram Sweets!'}</p>
                  <p>Visit Again!</p>
                </div>
              </div>
            </div>

            {/* Modal Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowThermalModal(false)}
                className="h-8 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  if (isPrinterConnected && (printerType === 'USB' || printerType === 'Bluetooth')) {
                    handleThermalPrint();
                  } else {
                    window.print();
                  }
                }}
                className="h-8 text-xs font-semibold rounded-lg bg-[#02626D] hover:bg-[#014d56] text-white shadow-2xs cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
              >
                <Printer size={13} />
                <span>Print Thermal</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Universal 80mm Thermal Receipt (Used by window.print / @media print) ── */}
      <div id="receipt-print-area" className="hidden print:block font-mono text-black text-[11px] leading-tight space-y-2 p-2 bg-white">
        {/* Store Header */}
        <div className="text-center border-b border-dashed border-black pb-2">
          <h2 className="text-sm font-black uppercase tracking-wider">{businessSettings.businessName || 'PATTABIRAM SWEETS'}</h2>
          {businessSettings.tagline && <p className="text-[10px] italic">{businessSettings.tagline}</p>}
          <p className="text-[10px]">{formatStoreAddress(businessSettings)}</p>
          <p className="text-[10px]">Ph: {formatStorePhone(businessSettings)}</p>
          {businessSettings.gstNumber && <p className="text-[10px] font-bold">GSTIN: {businessSettings.gstNumber}</p>}
          {businessSettings.fssaiNumber && <p className="text-[9px]">FSSAI: {businessSettings.fssaiNumber}</p>}
          <div className="mt-1 pt-1 border-t border-dashed border-black text-[11px] font-black uppercase">
            WHOLESALE TAX INVOICE
          </div>
        </div>

        {/* Order Details */}
        <div className="text-[10px] space-y-0.5 border-b border-dashed border-black pb-2">
          <div className="flex justify-between font-bold">
            <span>Bill No: {order.orderId}</span>
            <span>{order.orderDate || '—'}</span>
          </div>
          <div>Wholesaler: <span className="font-bold">{order.wholesalerName}</span></div>
          {order.companyName && <div>Company: {order.companyName}</div>}
          {order.wholesalerMobile && <div>Mobile: {order.wholesalerMobile}</div>}
          {order.wholesalerGstin && <div>Wholesaler GST: {order.wholesalerGstin}</div>}
          {order.deliveryAddress && <div>Address: {order.deliveryAddress}</div>}
          <div className="flex justify-between pt-0.5">
            <span>Price Tier: {order.priceListName || 'Standard'}</span>
            <span className="font-bold">Status: {order.status || 'Pending'}</span>
          </div>
        </div>

        {/* Items Table */}
        <div className="border-b border-dashed border-black pb-2">
          <div className="flex justify-between font-bold text-[10px] border-b border-black pb-1 mb-1">
            <span className="w-1/2">Item</span>
            <span className="w-1/4 text-center">Qty</span>
            <span className="w-1/4 text-right">Total</span>
          </div>
          <div className="space-y-1 text-[10px]">
            {(order.items || []).map((it, idx) => {
              const qty = parseFloat(String(it.quantity || 1)) || 1;
              const price = parseFloat(String(it.assignedPrice || it.standardPrice || 0)) || 0;
              const lineTotal = parseFloat(String(it.totalAmount || 0)) || (qty * price);
              return (
                <div key={idx}>
                  <div className="flex justify-between font-bold">
                    <span className="truncate">{it.name || it.itemName}</span>
                    <span>₹{lineTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[9px]">
                    <span>{qty} {it.unit || 'kg'} x ₹{price}</span>
                    <span>{it.needsManufacturing ? '[Mfg]' : '[In Stock]'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Totals */}
        <div className="text-[10px] space-y-0.5 border-b border-dashed border-black pb-2">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span>₹{(order.taxableAmount ?? order.subtotal ?? 0).toFixed(2)}</span>
          </div>
          {order.cgstAmount ? (
            <div className="flex justify-between">
              <span>CGST ({order.cgstPercent ?? 2.5}%):</span>
              <span>₹{order.cgstAmount.toFixed(2)}</span>
            </div>
          ) : null}
          {order.sgstAmount ? (
            <div className="flex justify-between">
              <span>SGST ({order.sgstPercent ?? 2.5}%):</span>
              <span>₹{order.sgstAmount.toFixed(2)}</span>
            </div>
          ) : null}
          <div className="flex justify-between text-xs font-black border-t border-black pt-1">
            <span>GRAND TOTAL:</span>
            <span>₹{totalAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold">
            <span>Total Paid:</span>
            <span>₹{receivedAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-black">
            <span>Balance Due:</span>
            <span>₹{balanceDue.toFixed(2)}</span>
          </div>
        </div>

        {/* Installments */}
        {order.payments && order.payments.length > 0 && (
          <div className="text-[9px] space-y-0.5 border-b border-dashed border-black pb-2">
            <p className="font-bold uppercase">Installments Recorded:</p>
            {order.payments.map((p, idx) => (
              <div key={idx} className="flex justify-between">
                <span>#{idx + 1} {p.mode} ({p.paidAt ? new Date(p.paidAt).toLocaleDateString() : ''})</span>
                <span className="font-bold">₹{Number(p.amount).toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-[9px] pt-1">
          <p>{businessSettings.footerNote || 'Thank you for choosing Pattabiram Sweets!'}</p>
          <p>Visit Again!</p>
        </div>
      </div>
    </div>
  );
}

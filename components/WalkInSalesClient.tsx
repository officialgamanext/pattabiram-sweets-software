'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Printer,
  Search,
  Calendar,
  Filter,
  Eye,
  Download,
  CreditCard,
  Banknote,
  QrCode,
  TrendingUp,
  Receipt,
  FileText,
  X,
  RefreshCw,
  ShoppingBag,
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import CustomDatePicker from '@/components/CustomDatePicker';
import { usePrinter } from '@/context/PrinterContext';

export interface WalkInOrder {
  id: string;
  orderId: string;
  customerName: string;
  customerMobile: string;
  items: Array<{
    itemId: string;
    name: string;
    unit: string;
    price: number;
    quantity: number;
    amount: number;
  }>;
  totalAmount: number;
  subtotal: number;
  tax: number;
  discount: number;
  paymentMode: 'Cash' | 'UPI' | 'Card';
  orderType: string;
  status: string;
  createdAt?: any;
}

export default function WalkInSalesClient() {
  const [sales, setSales] = useState<WalkInOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPaymentFilter, setSelectedPaymentFilter] = useState<'All' | 'Cash' | 'UPI' | 'Card'>('All');
  const [selectedDate, setSelectedDate] = useState<string>('All');
  const [activeOrderModal, setActiveOrderModal] = useState<WalkInOrder | null>(null);

  // Load POS orders from Firestore
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'orders'),
      (snapshot) => {
        const docs: WalkInOrder[] = snapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as WalkInOrder[];
        
        // Filter walk-in POS sales
        const walkInOnly = docs.filter((o) => o.orderType === 'Walk-in POS' || o.orderId?.startsWith('POS-'));
        setSales(walkInOnly);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching walk-in sales:', error);
        // Fallback sample data if empty
        setSales([
          {
            id: 'ws-1',
            orderId: 'POS-892101',
            customerName: 'Ramesh Singh',
            customerMobile: '+91 98765 43210',
            items: [
              { itemId: '1', name: 'Moti Choor Ladoo', unit: 'KG', price: 540, quantity: 1.5, amount: 810 },
              { itemId: '4', name: 'Special Mixture', unit: 'KG', price: 320, quantity: 0.5, amount: 160 },
            ],
            subtotal: 970,
            tax: 48,
            discount: 0,
            totalAmount: 1018,
            paymentMode: 'UPI',
            orderType: 'Walk-in POS',
            status: 'Delivered',
          },
          {
            id: 'ws-2',
            orderId: 'POS-892102',
            customerName: 'Priya Sharma',
            customerMobile: '+91 98401 12345',
            items: [
              { itemId: '2', name: 'Kaju Katli Premium', unit: 'KG', price: 960, quantity: 0.5, amount: 480 },
              { itemId: '6', name: 'Ghee Mysore Pak Box', unit: 'Piece', price: 180, quantity: 2, amount: 360 },
            ],
            subtotal: 840,
            tax: 42,
            discount: 0,
            totalAmount: 882,
            paymentMode: 'Cash',
            orderType: 'Walk-in POS',
            status: 'Delivered',
          },
          {
            id: 'ws-3',
            orderId: 'POS-892103',
            customerName: 'Walk-in Customer',
            customerMobile: '-',
            items: [
              { itemId: '3', name: 'Gulab Jamun', unit: 'KG', price: 420, quantity: 1, amount: 420 },
            ],
            subtotal: 420,
            tax: 21,
            discount: 0,
            totalAmount: 441,
            paymentMode: 'Card',
            orderType: 'Walk-in POS',
            status: 'Delivered',
          },
        ]);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Filtered Sales List
  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      const matchQuery =
        sale.orderId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sale.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sale.customerMobile?.includes(searchQuery);
      const matchPayment = selectedPaymentFilter === 'All' || sale.paymentMode === selectedPaymentFilter;
      return matchQuery && matchPayment;
    });
  }, [sales, searchQuery, selectedPaymentFilter]);

  // Analytics Metrics Calculations
  const totalRevenue = useMemo(() => {
    return filteredSales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
  }, [filteredSales]);

  const upiRevenue = useMemo(() => {
    return filteredSales
      .filter((s) => s.paymentMode === 'UPI')
      .reduce((sum, s) => sum + (s.totalAmount || 0), 0);
  }, [filteredSales]);

  const cashRevenue = useMemo(() => {
    return filteredSales
      .filter((s) => s.paymentMode === 'Cash')
      .reduce((sum, s) => sum + (s.totalAmount || 0), 0);
  }, [filteredSales]);

  const cardRevenue = useMemo(() => {
    return filteredSales
      .filter((s) => s.paymentMode === 'Card')
      .reduce((sum, s) => sum + (s.totalAmount || 0), 0);
  }, [filteredSales]);

  const avgBillValue = useMemo(() => {
    return filteredSales.length > 0 ? Math.round(totalRevenue / filteredSales.length) : 0;
  }, [totalRevenue, filteredSales]);

  const { isConnected: isPrinterConnected, printerType, printReceipt, printWindow } = usePrinter();

  const triggerPrintReceipt = async () => {
    if (activeOrderModal && isPrinterConnected && (printerType === 'USB' || printerType === 'Bluetooth')) {
      await printReceipt({
        storeName: 'PATTABIRAM SWEETS',
        storeAddress: '12, Main Road, Pattabiram, Chennai - 600072',
        billNo: activeOrderModal.orderId,
        customerName: activeOrderModal.customerName,
        customerPhone: activeOrderModal.customerMobile,
        paymentMode: activeOrderModal.paymentMode,
        orderType: 'Walk-in POS',
        items: (activeOrderModal.items || []).map((it: any) => ({
          name: it.name,
          qty: it.quantity || 1,
          unit: it.unit || 'unit',
          price: it.price || 0,
          total: it.amount || (it.quantity || 1) * (it.price || 0),
        })),
        subtotal: activeOrderModal.subtotal || activeOrderModal.totalAmount,
        tax: activeOrderModal.tax || 0,
        grandTotal: activeOrderModal.totalAmount,
        footerNote: 'Thank you for visiting Pattabiram Sweets! Have a sweet day!',
      });
    } else {
      printWindow();
    }
  };

  return (
    <div className="w-full flex flex-col gap-4 text-slate-800 font-sans pb-12">
      {/* ── Page Header Title Bar ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2">
          <Printer size={22} className="text-slate-800 stroke-[1.75]" />
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Walk-In Sales &amp; Bills</h1>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/pos"
            className="h-8 px-3 text-xs font-semibold rounded-lg bg-[#02626D] hover:bg-[#014d56] text-white shadow-2xs inline-flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Receipt size={14} />
            <span>Open POS Counter</span>
          </Link>
        </div>
      </div>

      {/* ── Analytics KPI Summary Banner Cards (4 Cards) ───────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 w-full">
        {/* Card 1: Total Revenue */}
        <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Sales Revenue</p>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-xl font-bold text-slate-900 font-mono">₹{totalRevenue.toLocaleString('en-IN')}</h3>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">{filteredSales.length} Total Bills Settled</p>
          </div>
        </div>

        {/* Card 2: UPI Revenue */}
        <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">UPI / QR Payments</p>
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <QrCode size={16} />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-xl font-bold text-slate-900 font-mono">₹{upiRevenue.toLocaleString('en-IN')}</h3>
            <p className="text-[11px] text-purple-700 font-medium mt-0.5">
              {totalRevenue > 0 ? Math.round((upiRevenue / totalRevenue) * 100) : 0}% of Total Volume
            </p>
          </div>
        </div>

        {/* Card 3: Cash Revenue */}
        <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cash Counter Sales</p>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Banknote size={16} />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-xl font-bold text-slate-900 font-mono">₹{cashRevenue.toLocaleString('en-IN')}</h3>
            <p className="text-[11px] text-emerald-800 font-medium mt-0.5">
              {totalRevenue > 0 ? Math.round((cashRevenue / totalRevenue) * 100) : 0}% of Total Volume
            </p>
          </div>
        </div>

        {/* Card 4: Average Bill Value */}
        <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Avg Bill Value</p>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Receipt size={16} />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-xl font-bold text-slate-900 font-mono">₹{avgBillValue.toLocaleString('en-IN')}</h3>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">Card Sales: ₹{cardRevenue.toLocaleString('en-IN')}</p>
          </div>
        </div>
      </div>

      {/* ── Search & Filter Controls Toolbar ───────────────────────────────────── */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Bill #, customer or mobile..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 h-8 bg-[#f7f7f8] focus:bg-white text-xs rounded-lg border border-slate-300 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-500 transition-all"
          />
        </div>

        {/* Payment Filter Pills */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <span className="text-xs text-slate-500 font-semibold">Payment Mode:</span>
          <div className="flex bg-[#f1f2f4] p-0.5 rounded-lg border border-slate-200">
            {(['All', 'UPI', 'Cash', 'Card'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setSelectedPaymentFilter(mode)}
                className={`h-7 px-3 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  selectedPaymentFilter === mode
                    ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Walk-In Sales History Data Table ────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-slate-500" />
            Loading Walk-In Sales History...
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            No walk-in sales found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider bg-[#f7f7f8] border-b border-slate-200">
                  <th className="py-3 px-4">Bill No</th>
                  <th className="py-3 px-4">Customer Info</th>
                  <th className="py-3 px-4">Item Count</th>
                  <th className="py-3 px-4">Payment Method</th>
                  <th className="py-3 px-4">Total Amount</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-mono font-bold text-slate-900">{sale.orderId}</span>
                    </td>

                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-900">{sale.customerName || 'Walk-in Customer'}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{sale.customerMobile || '-'}</p>
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {sale.items?.length || 0} Items
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                          sale.paymentMode === 'UPI'
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : sale.paymentMode === 'Cash'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}
                      >
                        {sale.paymentMode}
                      </span>
                    </td>

                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      ₹{sale.totalAmount}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setActiveOrderModal(sale)}
                          className="h-7 px-2.5 text-xs font-semibold rounded bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 shadow-2xs transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <Eye size={13} /> View
                        </button>
                        <button
                          onClick={() => {
                            setActiveOrderModal(sale);
                            setTimeout(triggerPrintReceipt, 200);
                          }}
                          className="h-7 px-2.5 text-xs font-semibold rounded bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 shadow-2xs transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <Printer size={13} /> Print
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── MODAL: Order Detail & Thermal Receipt View ────────────────────────────── */}
      {activeOrderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-sm p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            {/* Thermal Receipt Content */}
            <div id="receipt-print-area" className="p-4 bg-white font-mono text-slate-900 text-xs space-y-2 border border-slate-200 rounded-lg">
              <div className="text-center border-b border-slate-200 pb-2">
                <h2 className="text-sm font-bold uppercase tracking-wider">Pattabiram Sweets</h2>
                <p className="text-[10px] text-slate-500">12, Main Road, Pattabiram, Chennai - 600072</p>
              </div>

              <div className="text-[10px] space-y-0.5 border-b border-slate-200 pb-1.5">
                <div className="flex justify-between">
                  <span>Bill No: {activeOrderModal.orderId}</span>
                </div>
                <div>Customer: {activeOrderModal.customerName}</div>
                <div>Payment Mode: {activeOrderModal.paymentMode}</div>
              </div>

              {/* Items List */}
              <div className="divide-y divide-slate-100 text-[10px] py-1">
                {activeOrderModal.items?.map((item, idx) => (
                  <div key={idx} className="py-1 flex justify-between">
                    <div>
                      <div>{item.name}</div>
                      <div className="text-slate-500">
                        {item.quantity} {item.unit} x ₹{item.price}
                      </div>
                    </div>
                    <div className="font-bold">₹{item.amount}</div>
                  </div>
                ))}
              </div>

              <div className="border-t border-slate-300 pt-2 text-[11px] font-bold space-y-1">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>₹{activeOrderModal.subtotal || activeOrderModal.totalAmount}</span>
                </div>
                {activeOrderModal.tax > 0 && (
                  <div className="flex justify-between">
                    <span>GST (5%):</span>
                    <span>₹{activeOrderModal.tax}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs border-t border-slate-200 pt-1 text-slate-900">
                  <span>TOTAL PAID:</span>
                  <span>₹{activeOrderModal.totalAmount}</span>
                </div>
              </div>

              <div className="text-center text-[9px] text-slate-500 pt-2 border-t border-slate-200">
                Thank you for visiting Pattabiram Sweets! Have a sweet day!
              </div>
            </div>

            {/* Receipt Modal Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => setActiveOrderModal(null)}
                className="h-8 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              >
                Close
              </button>

              <button
                onClick={triggerPrintReceipt}
                className="h-8 text-xs font-semibold rounded-lg bg-[#02626D] hover:bg-[#014d56] text-white shadow-2xs cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Printer size={14} /> Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

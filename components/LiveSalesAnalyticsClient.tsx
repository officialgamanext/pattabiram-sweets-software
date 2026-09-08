'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  IndianRupee,
  Printer,
  Calendar,
  Eye,
  RefreshCw,
  Download,
  Receipt,
  CreditCard,
  Smartphone,
  Banknote,
  Layers,
  ShoppingBag,
  TrendingUp,
  X,
  Clock,
  User,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import CustomDatePicker from '@/components/CustomDatePicker';
import { usePrinter } from '@/context/PrinterContext';
import { toast } from '@/context/ToastContext';

interface LiveSaleItem {
  itemId: string;
  itemCode?: string;
  itemName: string;
  category?: string;
  unitPrice: number;
  weight: number;
  weightUnit: string;
  lineTotal: number;
}

interface LiveSaleDoc {
  id: string;
  receiptNumber: string;
  orderNumber?: string;
  cashierId?: string;
  cashierName?: string;
  customerName?: string;
  customerPhone?: string;
  items: LiveSaleItem[];
  subtotal: number;
  discount: number;
  tax: number;
  roundOff: number;
  grandTotal: number;
  paymentMode: 'Cash' | 'UPI' | 'Card' | 'Split';
  splitCash?: number;
  splitUpi?: number;
  cashGiven?: number;
  balanceReturn?: number;
  createdAt: any;
  dateStr?: string;
  status?: string;
}

export default function LiveSalesAnalyticsClient() {
  const { printReceipt } = usePrinter();
  const [sales, setSales] = useState<LiveSaleDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPaymentMode, setSelectedPaymentMode] = useState<string>('ALL');
  
  // Date filter (defaults to today or all)
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>('');
  
  // Selected sale for modal
  const [viewSale, setViewSale] = useState<LiveSaleDoc | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Real-time listener
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'live_sales'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list: LiveSaleDoc[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          list.push({
            id: docSnap.id,
            receiptNumber: d.receiptNumber || docSnap.id.substring(0, 8),
            orderNumber: d.orderNumber,
            cashierId: d.cashierId,
            cashierName: d.cashierName || 'Cashier',
            customerName: d.customerName,
            customerPhone: d.customerPhone,
            items: Array.isArray(d.items) ? d.items : [],
            subtotal: Number(d.subtotal) || 0,
            discount: Number(d.discount) || 0,
            tax: Number(d.tax) || 0,
            roundOff: Number(d.roundOff) || 0,
            grandTotal: Number(d.grandTotal) || 0,
            paymentMode: d.paymentMode || 'Cash',
            splitCash: Number(d.splitCash) || 0,
            splitUpi: Number(d.splitUpi) || 0,
            cashGiven: Number(d.cashGiven) || 0,
            balanceReturn: Number(d.balanceReturn) || 0,
            createdAt: d.createdAt,
            dateStr: d.dateStr || (d.createdAt?.toDate ? d.createdAt.toDate().toISOString().split('T')[0] : ''),
            status: d.status || 'Completed',
          });
        });
        setSales(list);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching live sales:', err);
        setLoading(false);
        toast.error('Failed to load live sales transactions');
      }
    );

    return () => unsub();
  }, []);

  // Filtered sales
  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      // Payment mode filter
      if (selectedPaymentMode !== 'ALL' && sale.paymentMode !== selectedPaymentMode) {
        return false;
      }
      // Date filter
      if (selectedDate && sale.dateStr !== selectedDate) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesReceipt = sale.receiptNumber?.toLowerCase().includes(q);
        const matchesCashier = sale.cashierName?.toLowerCase().includes(q);
        const matchesCustomer = sale.customerName?.toLowerCase().includes(q) || sale.customerPhone?.includes(q);
        const matchesItems = sale.items.some((i) => i.itemName.toLowerCase().includes(q));
        if (!matchesReceipt && !matchesCashier && !matchesCustomer && !matchesItems) {
          return false;
        }
      }
      return true;
    });
  }, [sales, selectedPaymentMode, selectedDate, searchQuery]);

  // Analytics Metrics
  const metrics = useMemo(() => {
    let totalRevenue = 0;
    let totalBills = filteredSales.length;
    let cashTotal = 0;
    let upiTotal = 0;
    let cardTotal = 0;
    let splitTotal = 0;

    filteredSales.forEach((s) => {
      totalRevenue += s.grandTotal;
      if (s.paymentMode === 'Cash') cashTotal += s.grandTotal;
      else if (s.paymentMode === 'UPI') upiTotal += s.grandTotal;
      else if (s.paymentMode === 'Card') cardTotal += s.grandTotal;
      else if (s.paymentMode === 'Split') {
        splitTotal += s.grandTotal;
        cashTotal += s.splitCash || 0;
        upiTotal += s.splitUpi || 0;
      }
    });

    const avgBillValue = totalBills > 0 ? Math.round(totalRevenue / totalBills) : 0;

    return {
      totalRevenue,
      totalBills,
      cashTotal,
      upiTotal,
      cardTotal,
      splitTotal,
      avgBillValue,
    };
  }, [filteredSales]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredSales.length / pageSize) || 1;
  const paginatedSales = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredSales.slice(start, start + pageSize);
  }, [filteredSales, currentPage]);

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredSales.length === 0) {
      toast.error('No records to export');
      return;
    }
    const headers = ['Receipt No', 'Date & Time', 'Cashier', 'Customer', 'Items Count', 'Payment Mode', 'Grand Total (INR)'];
    const rows = filteredSales.map((s) => {
      const dt = s.createdAt?.toDate ? s.createdAt.toDate().toLocaleString('en-IN') : s.dateStr || 'N/A';
      return [
        `"${s.receiptNumber}"`,
        `"${dt}"`,
        `"${s.cashierName}"`,
        `"${s.customerName || s.customerPhone || 'Walk-in'}"`,
        s.items.length,
        `"${s.paymentMode}"`,
        s.grandTotal.toFixed(2),
      ];
    });
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Live_Sales_${selectedDate || 'All'}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Sales data exported successfully!');
  };

  // Reprint Thermal Receipt
  const handleReprint = (sale: LiveSaleDoc) => {
    try {
      const formattedItems = sale.items.map((i) => ({
        name: i.itemName,
        qty: i.weight,
        unit: i.weightUnit,
        price: i.unitPrice,
        total: i.lineTotal,
      }));

      const dt = sale.createdAt?.toDate ? sale.createdAt.toDate() : new Date();
      const dateStr = dt.toLocaleDateString('en-IN');
      const timeStr = dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

      printReceipt({
        billNo: sale.receiptNumber,
        dateStr,
        timeStr,
        customerName: sale.customerName || 'Walk-in Customer',
        customerPhone: sale.customerPhone || '',
        items: formattedItems,
        subtotal: sale.subtotal,
        discount: sale.discount,
        tax: sale.tax,
        grandTotal: sale.grandTotal,
        paymentMode: sale.paymentMode,
        cashierName: sale.cashierName || 'Cashier',
      });
      toast.success(`Receipt #${sale.receiptNumber} sent to printer!`);
    } catch (err) {
      console.error('Printing error:', err);
      toast.error('Failed to trigger printer');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 px-4 lg:px-8 py-3.5 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-[#02626D] shadow-sm">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                Live Sales Analytics
                <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                  Live Feed
                </span>
              </h1>
              <p className="text-xs text-slate-500">
                Track real-time counter sales, mode of payment breakdown, and bill reprints
              </p>
            </div>
          </div>

          {/* Quick Actions & Date Filter */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-44">
              <CustomDatePicker
                value={selectedDate}
                onChange={(val) => {
                  setSelectedDate(val);
                  setCurrentPage(1);
                }}
                placeholder="Filter by Date"
              />
            </div>
            {selectedDate && (
              <button
                onClick={() => setSelectedDate('')}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1.5 rounded-xl transition"
              >
                Clear Date
              </button>
            )}
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 shadow-sm transition max-h-[36px]"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              Export CSV
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-8 space-y-6">
        {/* Analytics Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
          {/* Card 1: Total Live Revenue */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm hover:shadow-md transition">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold text-slate-600">Total Live Sales</span>
              <div className="w-7 h-7 rounded-lg bg-teal-50 flex items-center justify-center text-[#02626D]">
                <IndianRupee className="w-4 h-4" />
              </div>
            </div>
            <div className="text-lg font-bold text-slate-900 tracking-tight">
              ₹{metrics.totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 font-medium">
              {metrics.totalBills} Bills generated
            </div>
          </div>

          {/* Card 2: Cash Total */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm hover:shadow-md transition">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold text-slate-600">Cash Collected</span>
              <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center text-amber-700">
                <Banknote className="w-4 h-4" />
              </div>
            </div>
            <div className="text-lg font-bold text-amber-700 tracking-tight">
              ₹{metrics.cashTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Direct & split cash</div>
          </div>

          {/* Card 3: UPI Total */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm hover:shadow-md transition">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold text-slate-600">UPI Digital</span>
              <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-700">
                <Smartphone className="w-4 h-4" />
              </div>
            </div>
            <div className="text-lg font-bold text-emerald-700 tracking-tight">
              ₹{metrics.upiTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Direct & split UPI</div>
          </div>

          {/* Card 4: Card Total */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm hover:shadow-md transition">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold text-slate-600">Card Swipes</span>
              <div className="w-7 h-7 rounded-lg bg-sky-50 flex items-center justify-center text-sky-700">
                <CreditCard className="w-4 h-4" />
              </div>
            </div>
            <div className="text-lg font-bold text-sky-700 tracking-tight">
              ₹{metrics.cardTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">POS Card machines</div>
          </div>

          {/* Card 5: Split Total */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm hover:shadow-md transition">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold text-slate-600">Split Mode</span>
              <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center text-purple-700">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <div className="text-lg font-bold text-purple-700 tracking-tight">
              ₹{metrics.splitTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Multi-mode bills</div>
          </div>

          {/* Card 6: Average Bill */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm hover:shadow-md transition">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold text-slate-600">Avg Bill Value</span>
              <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-700">
                <Receipt className="w-4 h-4" />
              </div>
            </div>
            <div className="text-lg font-bold text-indigo-700 tracking-tight">
              ₹{metrics.avgBillValue.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Per transaction</div>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search receipt #, cashier, customer or item..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#02626D] focus:bg-white transition max-h-[36px]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Payment Mode Badges Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            {['ALL', 'Cash', 'UPI', 'Card', 'Split'].map((mode) => {
              const active = selectedPaymentMode === mode;
              return (
                <button
                  key={mode}
                  onClick={() => {
                    setSelectedPaymentMode(mode);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition max-h-[36px] border ${
                    active
                      ? 'bg-[#02626D] text-white border-[#02626D] shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {mode === 'ALL' ? 'All Payments' : mode}
                </button>
              );
            })}
          </div>
        </div>

        {/* Transactions Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800 tracking-tight flex items-center gap-2">
              <Receipt className="w-4 h-4 text-[#02626D]" />
              Live Sales Transactions ({filteredSales.length})
            </h2>
            <div className="text-xs text-slate-500 font-medium">
              Showing {paginatedSales.length} of {filteredSales.length} records
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Receipt #</th>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Cashier</th>
                  <th className="py-3 px-4">Items</th>
                  <th className="py-3 px-4">Payment Mode</th>
                  <th className="py-3 px-4 text-right">Grand Total</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="w-6 h-6 animate-spin text-[#02626D]" />
                        <span className="text-xs font-medium">Loading live transactions...</span>
                      </div>
                    </td>
                  </tr>
                ) : paginatedSales.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <ShoppingBag className="w-8 h-8 text-slate-300" />
                        <span className="text-xs font-medium">No live sales found matching criteria</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedSales.map((sale) => {
                    const formattedDate = sale.createdAt?.toDate
                      ? sale.createdAt.toDate().toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : sale.dateStr || 'Recent';

                    return (
                      <tr key={sale.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[#02626D]">{sale.receiptNumber}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>{formattedDate}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700">
                            <User className="w-3 h-3 text-slate-500" />
                            {sale.cashierName}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-700">
                          <div className="max-w-xs truncate" title={sale.items.map((i) => `${i.itemName} (${i.weight}${i.weightUnit})`).join(', ')}>
                            <span className="font-semibold text-slate-900">{sale.items.length} item(s): </span>
                            <span className="text-slate-500">
                              {sale.items.map((i) => i.itemName).join(', ')}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {sale.paymentMode === 'Cash' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                              <Banknote className="w-3 h-3" /> Cash
                            </span>
                          )}
                          {sale.paymentMode === 'UPI' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <Smartphone className="w-3 h-3" /> UPI
                            </span>
                          )}
                          {sale.paymentMode === 'Card' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-800 border border-sky-200">
                              <CreditCard className="w-3 h-3" /> Card
                            </span>
                          )}
                          {sale.paymentMode === 'Split' && (
                            <div>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-800 border border-purple-200">
                                <Layers className="w-3 h-3" /> Split
                              </span>
                              <div className="text-[10px] text-slate-500 mt-0.5">
                                Cash ₹{sale.splitCash || 0} + UPI ₹{sale.splitUpi || 0}
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900 text-sm">
                          ₹{sale.grandTotal.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setViewSale(sale)}
                              className="p-1.5 text-slate-500 hover:text-[#02626D] hover:bg-teal-50 rounded-lg transition"
                              title="View Bill Breakdown"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleReprint(sale)}
                              className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                              title="Reprint Thermal Receipt"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer with Pagination */}
          {totalPages > 1 && (
            <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
              <span className="text-xs text-slate-500">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <button
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Bill View Modal */}
      {viewSale && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-[#02626D] text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5" />
                <h3 className="font-bold text-sm">Receipt #{viewSale.receiptNumber}</h3>
              </div>
              <button
                onClick={() => setViewSale(null)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body: Thermal Style View */}
            <div className="p-5 max-h-[75vh] overflow-y-auto space-y-4 text-xs font-mono">
              <div className="text-center pb-2 border-b border-dashed border-slate-300">
                <h2 className="font-bold text-base font-sans text-slate-800">PATTABIRAM SWEETS</h2>
                <p className="text-[10px] text-slate-500 font-sans">Fresh Sweets, Savouries & Snacks</p>
                <p className="text-[10px] text-slate-400 mt-1">
                  {viewSale.createdAt?.toDate ? viewSale.createdAt.toDate().toLocaleString('en-IN') : viewSale.dateStr}
                </p>
                <p className="text-[10px] text-slate-600 font-semibold mt-0.5">
                  Cashier: {viewSale.cashierName}
                </p>
              </div>

              {/* Items List */}
              <div className="space-y-2 py-2 border-b border-dashed border-slate-300">
                <div className="grid grid-cols-12 font-bold text-slate-700 pb-1 border-b border-slate-200">
                  <span className="col-span-6">Item</span>
                  <span className="col-span-3 text-center">Qty/Wt</span>
                  <span className="col-span-3 text-right">Amount</span>
                </div>
                {viewSale.items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 text-slate-700 py-0.5">
                    <div className="col-span-6 truncate font-sans">
                      <p className="font-semibold text-slate-900">{item.itemName}</p>
                      <p className="text-[10px] text-slate-500">@ ₹{item.unitPrice}/kg</p>
                    </div>
                    <div className="col-span-3 text-center self-center">
                      {item.weight} {item.weightUnit}
                    </div>
                    <div className="col-span-3 text-right font-bold self-center">
                      ₹{item.lineTotal.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Calculation Summary */}
              <div className="space-y-1.5 py-2 border-b border-dashed border-slate-300 text-slate-700">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>₹{viewSale.subtotal.toFixed(2)}</span>
                </div>
                {viewSale.discount > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Discount:</span>
                    <span>-₹{viewSale.discount.toFixed(2)}</span>
                  </div>
                )}
                {viewSale.tax > 0 && (
                  <div className="flex justify-between">
                    <span>GST / Tax:</span>
                    <span>₹{viewSale.tax.toFixed(2)}</span>
                  </div>
                )}
                {viewSale.roundOff !== 0 && (
                  <div className="flex justify-between text-slate-500">
                    <span>Round Off:</span>
                    <span>₹{viewSale.roundOff.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-sm text-slate-900 pt-1 border-t border-slate-300">
                  <span>GRAND TOTAL:</span>
                  <span>₹{viewSale.grandTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* Payment details */}
              <div className="space-y-1 text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-lg">
                <div className="flex justify-between">
                  <span>Payment Mode:</span>
                  <span className="font-bold text-slate-900">{viewSale.paymentMode}</span>
                </div>
                {viewSale.paymentMode === 'Split' && (
                  <>
                    <div className="flex justify-between">
                      <span>Cash Paid:</span>
                      <span>₹{viewSale.splitCash || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>UPI Paid:</span>
                      <span>₹{viewSale.splitUpi || 0}</span>
                    </div>
                  </>
                )}
                {viewSale.cashGiven && viewSale.cashGiven > 0 ? (
                  <>
                    <div className="flex justify-between">
                      <span>Cash Tendered:</span>
                      <span>₹{viewSale.cashGiven}</span>
                    </div>
                    <div className="flex justify-between text-emerald-700 font-bold">
                      <span>Change Returned:</span>
                      <span>₹{viewSale.balanceReturn || 0}</span>
                    </div>
                  </>
                ) : null}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                onClick={() => setViewSale(null)}
                className="px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition max-h-[36px]"
              >
                Close
              </button>
              <button
                onClick={() => handleReprint(viewSale)}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-[#02626D] hover:bg-[#014d56] rounded-xl shadow-sm transition max-h-[36px]"
              >
                <Printer className="w-3.5 h-3.5" />
                Print Bill
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

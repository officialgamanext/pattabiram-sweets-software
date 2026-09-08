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
  Coins,
  AlertTriangle,
  Check,
  FileText,
  HandCoins,
  Phone,
  MapPin,
  Loader2,
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
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

export interface LiveSaleSettlement {
  id: string;
  amount: number;
  mode: string;
  note?: string;
  settledAt: string;
  cashierName?: string;
}

export interface LiveSaleDoc {
  id: string;
  receiptNumber: string;
  billNo?: string;
  orderNumber?: string;
  cashierId?: string;
  cashierName?: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAddress?: string;
  items: LiveSaleItem[];
  subtotal: number;
  discount: number;
  tax: number;
  roundOff: number;
  grandTotal: number;
  receivedAmount?: number;
  creditAmount?: number;
  paymentStatus?: 'Paid' | 'Partial' | 'Credit' | string;
  settlements?: LiveSaleSettlement[];
  paymentMode: 'Cash' | 'UPI' | 'Card' | 'Split' | string;
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

  // Navigation Tab: 'all' Live Sales vs 'credit' Sales & Dues
  const [activeTab, setActiveTab] = useState<'all' | 'credit'>('all');
  
  // Date filter (defaults to today or all)
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>('');
  
  // Selected sale for viewing breakdown modal
  const [viewSale, setViewSale] = useState<LiveSaleDoc | null>(null);

  // Due Collection Settlement Modal State
  const [settleTargetSale, setSettleTargetSale] = useState<LiveSaleDoc | null>(null);
  const [collectAmountInput, setCollectAmountInput] = useState<string>('');
  const [collectPaymentMode, setCollectPaymentMode] = useState<'Cash' | 'UPI' | 'Card'>('Cash');
  const [collectNote, setCollectNote] = useState<string>('');
  const [isSubmittingSettlement, setIsSubmittingSettlement] = useState<boolean>(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Real-time listener from `live_sales` collection
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'live_sales'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list: LiveSaleDoc[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          const billTotal = Number(d.grandTotal) || Number(d.total) || 0;
          const receivedAmt = d.receivedAmount !== undefined ? Number(d.receivedAmount) : billTotal;
          const creditAmt = d.creditAmount !== undefined ? Number(d.creditAmount) : (d.paymentStatus === 'Credit' ? billTotal : 0);
          const pStatus = d.paymentStatus || (creditAmt > 0 ? (receivedAmt > 0 ? 'Partial' : 'Credit') : 'Paid');

          list.push({
            id: docSnap.id,
            receiptNumber: d.receiptNumber || d.billNo || docSnap.id.substring(0, 8),
            billNo: d.billNo || d.receiptNumber,
            orderNumber: d.orderNumber,
            cashierId: d.cashierId,
            cashierName: d.cashierName || 'Cashier',
            customerId: d.customerId,
            customerName: d.customerName,
            customerPhone: d.customerPhone,
            customerEmail: d.customerEmail,
            customerAddress: d.customerAddress,
            items: Array.isArray(d.items)
              ? d.items.map((it: any) => ({
                  itemId: it.itemId || it.id || '',
                  itemCode: it.code || it.itemCode || '',
                  itemName: it.name || it.itemName || 'Item',
                  category: it.category || '',
                  unitPrice: Number(it.price) || Number(it.unitPrice) || 0,
                  weight: Number(it.quantity) || Number(it.weight) || 1,
                  weightUnit: it.unit || it.weightUnit || 'Piece',
                  lineTotal: Number(it.totalAmount) || Number(it.lineTotal) || 0,
                }))
              : [],
            subtotal: Number(d.subtotal) || 0,
            discount: Number(d.discount) || 0,
            tax: Number(d.tax) || 0,
            roundOff: Number(d.roundOff) || 0,
            grandTotal: billTotal,
            receivedAmount: receivedAmt,
            creditAmount: creditAmt,
            paymentStatus: pStatus,
            settlements: Array.isArray(d.settlements) ? d.settlements : [],
            paymentMode: d.paymentMode || 'Cash',
            splitCash: Number(d.splitCash) || 0,
            splitUpi: Number(d.splitUpi) || 0,
            cashGiven: Number(d.cashGiven) || 0,
            balanceReturn: Number(d.balanceReturn) || 0,
            createdAt: d.createdAt,
            dateStr: d.dateStr || (d.createdAt?.toDate ? d.createdAt.toDate().toISOString().split('T')[0] : (d.date || '')),
            status: d.status || (creditAmt > 0 ? 'Credit Due' : 'Completed'),
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

  // Filtered sales based on date, search and payment mode
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
        const matchesReceipt = sale.receiptNumber?.toLowerCase().includes(q) || sale.billNo?.toLowerCase().includes(q);
        const matchesCashier = sale.cashierName?.toLowerCase().includes(q);
        const matchesCustomer =
          sale.customerName?.toLowerCase().includes(q) ||
          sale.customerPhone?.includes(q) ||
          (sale.customerEmail && sale.customerEmail.toLowerCase().includes(q));
        const matchesItems = sale.items.some((i) => i.itemName.toLowerCase().includes(q));
        if (!matchesReceipt && !matchesCashier && !matchesCustomer && !matchesItems) {
          return false;
        }
      }
      return true;
    });
  }, [sales, selectedPaymentMode, selectedDate, searchQuery]);

  // Credit specific filtered sales
  const creditSales = useMemo(() => {
    return sales.filter(
      (s) =>
        (s.creditAmount !== undefined && s.creditAmount > 0) ||
        s.paymentStatus === 'Credit' ||
        s.paymentStatus === 'Partial'
    );
  }, [sales]);

  // Overall Live Sales Analytics Metrics
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

  // Credit Analytics Metrics
  const creditMetrics = useMemo(() => {
    let totalCreditBilled = 0;
    let totalReceived = 0;
    let totalOutstandingDue = 0;
    let pendingDueBillsCount = 0;

    creditSales.forEach((s) => {
      totalCreditBilled += s.grandTotal;
      totalReceived += s.receivedAmount !== undefined ? s.receivedAmount : (s.grandTotal - (s.creditAmount || 0));
      const due = s.creditAmount !== undefined ? s.creditAmount : 0;
      totalOutstandingDue += due;
      if (due > 0) {
        pendingDueBillsCount += 1;
      }
    });

    return {
      totalCreditBilled,
      totalReceived,
      totalOutstandingDue,
      pendingDueBillsCount,
      totalCreditBills: creditSales.length,
    };
  }, [creditSales]);

  // Sales to display based on active tab ('all' vs 'credit')
  const displayedSales = useMemo(() => {
    if (activeTab === 'credit') {
      return filteredSales.filter(
        (s) =>
          (s.creditAmount !== undefined && s.creditAmount > 0) ||
          s.paymentStatus === 'Credit' ||
          s.paymentStatus === 'Partial'
      );
    }
    return filteredSales;
  }, [filteredSales, activeTab]);

  // Pagination calculation
  const totalPages = Math.ceil(displayedSales.length / pageSize) || 1;
  const paginatedSales = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return displayedSales.slice(start, start + pageSize);
  }, [displayedSales, currentPage]);

  // Export to CSV
  const handleExportCSV = () => {
    if (displayedSales.length === 0) {
      toast.error('No records to export');
      return;
    }

    if (activeTab === 'credit') {
      const headers = ['Receipt No', 'Date & Time', 'Customer Name', 'Customer Phone', 'Cashier', 'Bill Total (INR)', 'Received (INR)', 'Credit Due (INR)', 'Status'];
      const rows = displayedSales.map((s) => {
        const dt = s.createdAt?.toDate ? s.createdAt.toDate().toLocaleString('en-IN') : s.dateStr || 'N/A';
        return [
          `"${s.receiptNumber}"`,
          `"${dt}"`,
          `"${s.customerName || 'N/A'}"`,
          `"${s.customerPhone || 'N/A'}"`,
          `"${s.cashierName}"`,
          s.grandTotal.toFixed(2),
          (s.receivedAmount || 0).toFixed(2),
          (s.creditAmount || 0).toFixed(2),
          `"${s.paymentStatus || (s.creditAmount && s.creditAmount > 0 ? 'Credit Due' : 'Paid')}"`,
        ];
      });
      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `Live_Sales_Credit_${selectedDate || 'All'}_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Credit sales data exported successfully!');
      return;
    }

    const headers = ['Receipt No', 'Date & Time', 'Cashier', 'Customer', 'Items Count', 'Payment Mode', 'Grand Total (INR)'];
    const rows = displayedSales.map((s) => {
      const dt = s.createdAt?.toDate ? s.createdAt.toDate().toLocaleString('en-IN') : s.dateStr || 'N/A';
      return [
        `"${s.receiptNumber}"`,
        `"${dt}"`,
        `"${s.cashierName}"`,
        `"${s.customerName || s.customerPhone || 'Customer'}"`,
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
        customerName: sale.customerName || 'Customer',
        customerPhone: sale.customerPhone || '',
        customerEmail: sale.customerEmail || undefined,
        customerAddress: sale.customerAddress || undefined,
        cashierName: sale.cashierName || 'Cashier',
        orderType: 'Live Sale',
        paymentMode: sale.paymentMode,
        paymentStatus: sale.paymentStatus,
        splitCash: sale.splitCash,
        splitUpi: sale.splitUpi,
        cashGiven: sale.cashGiven,
        balanceReturn: sale.balanceReturn,
        items: formattedItems,
        subtotal: sale.subtotal,
        discount: sale.discount,
        tax: sale.tax,
        roundOff: sale.roundOff,
        grandTotal: sale.grandTotal,
        receivedAmount: sale.receivedAmount,
        creditAmount: sale.creditAmount,
      });
      toast.success(`Receipt #${sale.receiptNumber} sent to printer!`);
    } catch (err) {
      console.error('Printing error:', err);
      toast.error('Failed to trigger printer');
    }
  };

  // Open Settle Due Modal
  const handleOpenCollectModal = (sale: LiveSaleDoc) => {
    setSettleTargetSale(sale);
    setCollectAmountInput((sale.creditAmount || 0).toString());
    setCollectPaymentMode('Cash');
    setCollectNote('');
  };

  // Handle Recording Due Collection in Firestore
  const handleRecordDuePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settleTargetSale) return;
    const amount = parseFloat(collectAmountInput);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Invalid Amount', 'Please enter a valid collection amount greater than 0.');
      return;
    }

    const currentDue = settleTargetSale.creditAmount || 0;
    if (amount > currentDue) {
      toast.warning('Excess Amount', `Amount ₹${amount} exceeds current due of ₹${currentDue}.`);
      return;
    }

    try {
      setIsSubmittingSettlement(true);
      const prevReceived = settleTargetSale.receivedAmount || 0;
      const newReceived = prevReceived + amount;
      const newCredit = Math.max(0, currentDue - amount);
      const newStatus = newCredit <= 0 ? 'Completed' : 'Credit Due';
      const newPaymentStatus = newCredit <= 0 ? 'Paid' : 'Partial';

      const settlementEntry: LiveSaleSettlement = {
        id: `SETTLE-${Date.now()}`,
        amount,
        mode: collectPaymentMode,
        note: collectNote.trim(),
        settledAt: new Date().toISOString(),
      };

      const updatedSettlements = [...(settleTargetSale.settlements || []), settlementEntry];

      await updateDoc(doc(db, 'live_sales', settleTargetSale.id), {
        receivedAmount: newReceived,
        creditAmount: newCredit,
        paymentStatus: newPaymentStatus,
        status: newStatus,
        settlements: updatedSettlements,
      });

      toast.success(
        'Due Payment Collected',
        `₹${amount.toFixed(2)} recorded for ${settleTargetSale.customerName || settleTargetSale.receiptNumber}. Remaining due: ₹${newCredit.toFixed(2)}`
      );

      setSettleTargetSale(null);
    } catch (err: any) {
      console.error('Error recording settlement:', err);
      toast.error('Settlement Failed', err.message || 'Could not record due payment.');
    } finally {
      setIsSubmittingSettlement(false);
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
                Track real-time counter sales, customer credit dues, and instant settlement
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
                className="text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1.5 rounded-xl transition cursor-pointer"
              >
                Clear Date
              </button>
            )}
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 shadow-sm transition max-h-[36px] cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Export {activeTab === 'credit' ? 'Credit CSV' : 'Sales CSV'}</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs: All Live Sales vs Credit Sales & Dues */}
        <div className="max-w-7xl mx-auto mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveTab('all');
                setCurrentPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'all'
                  ? 'bg-[#02626D] text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>All Live Sales</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                activeTab === 'all' ? 'bg-white/20 text-white' : 'bg-white text-slate-700'
              }`}>
                {sales.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('credit');
                setCurrentPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'credit'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200'
              }`}
            >
              <Coins className="w-3.5 h-3.5 text-amber-600" />
              <span>Credit Sales &amp; Dues</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                activeTab === 'credit' ? 'bg-white/20 text-white' : 'bg-amber-200 text-amber-900'
              }`}>
                {creditMetrics.pendingDueBillsCount} Due
              </span>
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <span>Viewing:</span>
            <span className="font-bold text-slate-800">
              {activeTab === 'all' ? 'Every Counter Sales Transaction' : 'Customer Credit Ledger & Due Collection'}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-8 space-y-6">
        
        {/* ── 1. ANALYTICS OVERVIEW CARDS ─────────────────────────────────── */}
        {activeTab === 'all' ? (
          /* All Sales 6-Card Grid */
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
              <div className="text-[11px] text-slate-500 mt-1">Direct &amp; split cash</div>
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
              <div className="text-[11px] text-slate-500 mt-1">Direct &amp; split UPI</div>
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
        ) : (
          /* Dedicated Credit 4-Card Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Credit Card 1: Total Credit Billed */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold text-slate-600">Total Credit Billed</span>
                <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                  <FileText className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl font-black text-slate-900 tracking-tight">
                ₹{creditMetrics.totalCreditBilled.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-slate-500 mt-1 font-medium">
                Across {creditMetrics.totalCreditBills} credit bills
              </div>
            </div>

            {/* Credit Card 2: Received / Collected Upfront */}
            <div className="bg-white rounded-2xl border border-emerald-200/90 p-4 shadow-sm hover:shadow-md transition bg-emerald-50/20">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold text-emerald-800">Received / Settled</span>
                <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl font-black text-emerald-700 tracking-tight">
                ₹{creditMetrics.totalReceived.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-emerald-600 mt-1 font-medium">
                Paid at counter or settled later
              </div>
            </div>

            {/* Credit Card 3: Outstanding Credit Due */}
            <div className="bg-white rounded-2xl border-2 border-amber-300 p-4 shadow-sm hover:shadow-md transition bg-amber-50/40">
              <div className="flex items-center justify-between text-amber-700 mb-2">
                <span className="text-xs font-extrabold uppercase tracking-wide">Outstanding Credit Due</span>
                <div className="w-8 h-8 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-800">
                  <Coins className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-amber-700 tracking-tight">
                ₹{creditMetrics.totalOutstandingDue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-amber-800 font-bold mt-1">
                {creditMetrics.pendingDueBillsCount} pending customer balances
              </div>
            </div>

            {/* Credit Card 4: Due Invoices Count */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold text-slate-600">Pending Credit Accounts</span>
                <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-700">
                  <HandCoins className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl font-black text-slate-900 tracking-tight">
                {creditMetrics.pendingDueBillsCount} <span className="text-sm font-normal text-slate-500">/ {creditMetrics.totalCreditBills} Bills</span>
              </div>
              <div className="text-xs text-slate-500 mt-1 font-medium">
                {creditMetrics.totalCreditBills - creditMetrics.pendingDueBillsCount} fully settled
              </div>
            </div>
          </div>
        )}

        {/* ── 2. FILTERS & SEARCH BAR ──────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search receipt #, cashier, customer name, mobile or item..."
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
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Mode Badges Tabs */}
          {activeTab === 'all' ? (
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
                    className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition max-h-[36px] border cursor-pointer ${
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
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold flex items-center gap-1.5">
                <Coins size={13} className="text-amber-600" />
                <span>Customer Credit Ledger View</span>
              </span>
            </div>
          )}
        </div>

        {/* ── 3. TRANSACTIONS TABLE ────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800 tracking-tight flex items-center gap-2">
              {activeTab === 'all' ? (
                <>
                  <Receipt className="w-4 h-4 text-[#02626D]" />
                  <span>Live Sales Transactions ({displayedSales.length})</span>
                </>
              ) : (
                <>
                  <Coins className="w-4 h-4 text-amber-600" />
                  <span>Customer Credit Invoices &amp; Balances ({displayedSales.length})</span>
                </>
              )}
            </h2>
            <div className="text-xs text-slate-500 font-medium">
              Showing {paginatedSales.length} of {displayedSales.length} records
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Receipt #</th>
                  <th className="py-3 px-4">Date &amp; Time</th>
                  {activeTab === 'credit' ? (
                    <>
                      <th className="py-3 px-4">Customer Details</th>
                      <th className="py-3 px-4">Cashier</th>
                      <th className="py-3 px-4 text-right">Bill Total</th>
                      <th className="py-3 px-4 text-right">Paid / Recv</th>
                      <th className="py-3 px-4 text-right">Credit Due</th>
                      <th className="py-3 px-4 text-center">Payment Status</th>
                    </>
                  ) : (
                    <>
                      <th className="py-3 px-4">Cashier</th>
                      <th className="py-3 px-4">Customer</th>
                      <th className="py-3 px-4">Items</th>
                      <th className="py-3 px-4">Payment Mode</th>
                      <th className="py-3 px-4 text-right">Grand Total</th>
                    </>
                  )}
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={activeTab === 'credit' ? 9 : 8} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="w-6 h-6 animate-spin text-[#02626D]" />
                        <span className="text-xs font-medium">Loading live transactions...</span>
                      </div>
                    </td>
                  </tr>
                ) : paginatedSales.length === 0 ? (
                  <tr>
                    <td colSpan={activeTab === 'credit' ? 9 : 8} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <ShoppingBag className="w-8 h-8 text-slate-300" />
                        <span className="text-xs font-medium">
                          {activeTab === 'credit' ? 'No credit sales found matching criteria' : 'No live sales found'}
                        </span>
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

                    const hasDue = Boolean(sale.creditAmount && sale.creditAmount > 0);

                    return (
                      <tr key={sale.id} className="hover:bg-slate-50/60 transition">
                        {/* Receipt # */}
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          <span className="text-[#02626D] font-mono">{sale.receiptNumber}</span>
                        </td>

                        {/* Date & Time */}
                        <td className="py-3 px-4 text-slate-600">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span className="whitespace-nowrap">{formattedDate}</span>
                          </div>
                        </td>

                        {activeTab === 'credit' ? (
                          /* Credit Specific Columns */
                          <>
                            {/* Customer Details */}
                            <td className="py-3 px-4">
                              <div className="min-w-[140px]">
                                <div className="font-bold text-slate-900 flex items-center gap-1">
                                  <User className="w-3 h-3 text-slate-400" />
                                  <span>{sale.customerName || 'Walk-in Customer'}</span>
                                </div>
                                {sale.customerPhone && (
                                  <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5 font-mono">
                                    <Phone className="w-2.5 h-2.5 text-[#02626D]" />
                                    <span>{sale.customerPhone}</span>
                                  </div>
                                )}
                                {sale.customerAddress && (
                                  <div className="text-[10px] text-slate-400 truncate max-w-[180px] mt-0.5">
                                    {sale.customerAddress}
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Cashier */}
                            <td className="py-3 px-4">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700">
                                {sale.cashierName}
                              </span>
                            </td>

                            {/* Bill Total */}
                            <td className="py-3 px-4 text-right font-bold text-slate-800 font-mono">
                              ₹{sale.grandTotal.toFixed(2)}
                            </td>

                            {/* Paid / Received */}
                            <td className="py-3 px-4 text-right font-bold text-emerald-700 font-mono">
                              ₹{(sale.receivedAmount !== undefined ? sale.receivedAmount : (sale.grandTotal - (sale.creditAmount || 0))).toFixed(2)}
                            </td>

                            {/* Credit Due */}
                            <td className="py-3 px-4 text-right">
                              {hasDue ? (
                                <span className="font-black text-amber-700 text-sm font-mono bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                                  ₹{sale.creditAmount?.toFixed(2)}
                                </span>
                              ) : (
                                <span className="text-emerald-700 font-bold text-xs">₹0.00</span>
                              )}
                            </td>

                            {/* Payment Status Badge */}
                            <td className="py-3 px-4 text-center">
                              {hasDue ? (
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold ${
                                  sale.receivedAmount && sale.receivedAmount > 0
                                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                    : 'bg-rose-100 text-rose-800 border border-rose-300'
                                }`}>
                                  <AlertTriangle size={11} />
                                  <span>{sale.receivedAmount && sale.receivedAmount > 0 ? 'Partial Due' : '100% Credit'}</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                  <CheckCircle2 size={11} />
                                  <span>Fully Settled</span>
                                </span>
                              )}
                            </td>
                          </>
                        ) : (
                          /* All Sales Columns */
                          <>
                            {/* Cashier */}
                            <td className="py-3 px-4">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700">
                                <User className="w-3 h-3 text-slate-500" />
                                {sale.cashierName}
                              </span>
                            </td>

                            {/* Customer */}
                            <td className="py-3 px-4">
                              <div className="font-bold text-slate-800">{sale.customerName || 'Walk-in Customer'}</div>
                              {sale.customerPhone && (
                                <div className="text-[10.5px] text-slate-400 font-mono">{sale.customerPhone}</div>
                              )}
                            </td>

                            {/* Items */}
                            <td className="py-3 px-4 text-slate-700">
                              <div className="max-w-xs truncate" title={sale.items.map((i) => `${i.itemName} (${i.weight}${i.weightUnit})`).join(', ')}>
                                <span className="font-semibold text-slate-900">{sale.items.length} item(s): </span>
                                <span className="text-slate-500">
                                  {sale.items.map((i) => i.itemName).join(', ')}
                                </span>
                              </div>
                            </td>

                            {/* Payment Mode */}
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

                            {/* Grand Total */}
                            <td className="py-3 px-4 text-right font-bold text-slate-900 text-sm font-mono">
                              ₹{sale.grandTotal.toFixed(2)}
                            </td>
                          </>
                        )}

                        {/* Actions */}
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Collect Due Button in Credit Mode */}
                            {hasDue && (
                              <button
                                onClick={() => handleOpenCollectModal(sale)}
                                className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px] flex items-center gap-1 shadow-2xs transition-all cursor-pointer"
                                title="Collect Outstanding Balance"
                              >
                                <Coins className="w-3 h-3" />
                                <span>Collect</span>
                              </button>
                            )}
                            <button
                              onClick={() => setViewSale(sale)}
                              className="p-1.5 text-slate-500 hover:text-[#02626D] hover:bg-teal-50 rounded-lg transition cursor-pointer"
                              title="View Bill Breakdown"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleReprint(sale)}
                              className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
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
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition cursor-pointer"
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

                <div className="flex justify-between text-emerald-700 font-bold">
                  <span>Total Paid / Received:</span>
                  <span>₹{(viewSale.receivedAmount !== undefined ? viewSale.receivedAmount : viewSale.grandTotal).toFixed(2)}</span>
                </div>

                {viewSale.creditAmount && viewSale.creditAmount > 0 ? (
                  <div className="flex justify-between text-amber-700 font-black text-xs bg-amber-50 p-1.5 rounded border border-amber-200">
                    <span>REMAINING CREDIT DUE:</span>
                    <span>₹{viewSale.creditAmount.toFixed(2)}</span>
                  </div>
                ) : null}
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

                {/* Settlement history if any */}
                {viewSale.settlements && viewSale.settlements.length > 0 && (
                  <div className="pt-2 border-t border-slate-200 mt-2 space-y-1">
                    <p className="font-bold text-[10.5px] text-slate-700">Due Settlements History:</p>
                    {viewSale.settlements.map((st, i) => (
                      <div key={st.id || i} className="flex justify-between text-[10px] text-slate-500">
                        <span>{new Date(st.settledAt).toLocaleDateString('en-IN')} ({st.mode})</span>
                        <span className="font-bold text-emerald-700">+₹{st.amount.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                onClick={() => setViewSale(null)}
                className="px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition max-h-[36px] cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => handleReprint(viewSale)}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-[#02626D] hover:bg-[#014d56] rounded-xl shadow-sm transition max-h-[36px] cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                Print Bill
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── COLLECT DUE SETTLEMENT MODAL ────────────────────────────────────── */}
      {settleTargetSale && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-amber-600 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5" />
                <div>
                  <h3 className="font-bold text-sm">Collect Customer Due</h3>
                  <p className="text-[10px] text-amber-100 font-mono">Bill #{settleTargetSale.receiptNumber}</p>
                </div>
              </div>
              <button
                onClick={() => setSettleTargetSale(null)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleRecordDuePayment} className="p-5 space-y-3.5">
              {/* Customer & Due Summary Card */}
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Customer:</span>
                  <span className="font-bold text-slate-900">{settleTargetSale.customerName || 'Customer'}</span>
                </div>
                {settleTargetSale.customerPhone && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Phone:</span>
                    <span className="font-mono font-bold text-slate-800">{settleTargetSale.customerPhone}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-1 border-t border-amber-200/60">
                  <span className="text-slate-500">Bill Total:</span>
                  <span className="font-mono font-bold text-slate-800">₹{settleTargetSale.grandTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Already Received:</span>
                  <span className="font-mono font-bold text-emerald-700">₹{(settleTargetSale.receivedAmount || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-amber-200 font-bold">
                  <span className="text-amber-800">Current Outstanding Due:</span>
                  <span className="font-mono font-black text-sm text-amber-700">
                    ₹{(settleTargetSale.creditAmount || 0).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Amount to collect input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Amount to Collect (₹) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs">₹</span>
                  <input
                    type="number"
                    step="any"
                    required
                    min="1"
                    max={settleTargetSale.creditAmount || 0}
                    value={collectAmountInput}
                    onChange={(e) => setCollectAmountInput(e.target.value)}
                    className="w-full pl-7 pr-3 h-9 border border-slate-300 rounded-xl text-xs font-black text-slate-900 bg-white focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
                  />
                </div>
                <div className="flex justify-end gap-1 mt-1">
                  <button
                    type="button"
                    onClick={() => setCollectAmountInput((settleTargetSale.creditAmount || 0).toString())}
                    className="text-[10.5px] font-bold text-amber-700 hover:underline cursor-pointer"
                  >
                    Clear Full Due (₹{(settleTargetSale.creditAmount || 0).toFixed(2)})
                  </button>
                </div>
              </div>

              {/* Payment Mode Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Payment Method</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Cash', 'UPI', 'Card'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setCollectPaymentMode(mode)}
                      className={`h-8.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1 ${
                        collectPaymentMode === mode
                          ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {mode === 'Cash' && <Banknote size={12} />}
                      {mode === 'UPI' && <Smartphone size={12} />}
                      {mode === 'Card' && <CreditCard size={12} />}
                      <span>{mode}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Note (Optional) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Notes / Reference <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Paid at shop counter / GPay ref #1234"
                  value={collectNote}
                  onChange={(e) => setCollectNote(e.target.value)}
                  className="w-full px-3 h-8.5 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 bg-[#f7f7f8] focus:bg-white focus:outline-none focus:border-amber-600"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSettleTargetSale(null)}
                  disabled={isSubmittingSettlement}
                  className="px-4 h-9 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSettlement}
                  className="px-5 h-9 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-xs shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmittingSettlement ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Recording...</span>
                    </>
                  ) : (
                    <>
                      <Check size={14} />
                      <span>Record Payment</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

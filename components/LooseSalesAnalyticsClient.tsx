'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Coins,
  Search,
  IndianRupee,
  Calendar,
  Filter,
  BarChart3,
  TrendingUp,
  User,
  Users,
  Smartphone,
  Banknote,
  CreditCard,
  Layers,
  Clock,
  Download,
  X,
  CheckCircle2,
  Receipt,
  RefreshCw,
  Sparkles,
  ChevronDown,
  ArrowRight,
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { LooseSaleRecord, useLooseSales } from '@/lib/looseSales';
import CustomDatePicker from '@/components/CustomDatePicker';
import { toast } from '@/context/ToastContext';

interface EmployeeMeta {
  id: string;
  empId?: string;
  name: string;
  department?: string;
  role: string;
}

export default function LooseSalesAnalyticsClient() {
  const { sales, isLoading, error } = useLooseSales();

  // Employee list from Firestore
  const [employees, setEmployees] = useState<EmployeeMeta[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);

  // Selected Employee Filter (id or 'ALL')
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('ALL');

  // Payment Mode, Date & Search Filters
  const [selectedPaymentMode, setSelectedPaymentMode] = useState<string>('ALL');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Fetch employees
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'employees'),
      (snapshot) => {
        const list: EmployeeMeta[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          if (d.status !== 'inactive' && d.status !== 'Inactive') {
            list.push({
              id: docSnap.id,
              empId: d.empId || d.employeeId || '',
              name: d.name || d.employeeName || 'Staff Member',
              department: d.department || '',
              role: d.department || d.role || 'Staff',
            });
          }
        });
        setEmployees(list.sort((a, b) => a.name.localeCompare(b.name)));
        setLoadingEmployees(false);
      },
      (err) => {
        console.error('Error loading employees:', err);
        setLoadingEmployees(false);
      }
    );
    return () => unsub();
  }, []);

  // Filtered sales
  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      // Employee filter
      if (selectedEmployeeId !== 'ALL' && s.employeeId !== selectedEmployeeId) {
        return false;
      }
      // Payment mode filter
      if (selectedPaymentMode !== 'ALL' && s.paymentMode !== selectedPaymentMode) {
        return false;
      }
      // Date filter
      if (selectedDate && (s.dateStr !== selectedDate && s.date !== selectedDate)) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchEmp = s.employeeName?.toLowerCase().includes(q);
        const matchNotes = (s.notes || s.note)?.toLowerCase().includes(q);
        const matchCust = s.customerName?.toLowerCase().includes(q);
        const matchAmt = s.amount.toString().includes(q);
        if (!matchEmp && !matchNotes && !matchCust && !matchAmt) return false;
      }
      return true;
    });
  }, [sales, selectedEmployeeId, selectedPaymentMode, selectedDate, searchQuery]);

  // Aggregate Metrics for currently selected employee & date filter
  const metrics = useMemo(() => {
    let totalSales = 0;
    let count = filteredSales.length;
    let cash = 0;
    let upi = 0;
    let card = 0;
    let split = 0;

    filteredSales.forEach((s) => {
      totalSales += s.amount;
      if (s.paymentMode === 'Cash') {
        cash += s.amount;
      } else if (s.paymentMode === 'UPI') {
        upi += s.amount;
      } else if (s.paymentMode === 'Card') {
        card += s.amount;
      } else if (s.paymentMode === 'Split') {
        split += s.amount;
        cash += s.splitCash || 0;
        upi += s.splitUpi || 0;
      }
    });

    const avgSale = count > 0 ? Math.round(totalSales / count) : 0;
    const cashPct = totalSales > 0 ? Math.round((cash / totalSales) * 100) : 0;
    const upiPct = totalSales > 0 ? Math.round((upi / totalSales) * 100) : 0;
    const cardPct = totalSales > 0 ? Math.round((card / totalSales) * 100) : 0;

    return {
      totalSales,
      count,
      cash,
      upi,
      card,
      split,
      avgSale,
      cashPct,
      upiPct,
      cardPct,
    };
  }, [filteredSales]);

  // Active employee object
  const selectedEmployeeObj = useMemo(() => {
    if (selectedEmployeeId === 'ALL') return null;
    return employees.find((e) => e.id === selectedEmployeeId) || null;
  }, [selectedEmployeeId, employees]);

  // Paginated records
  const totalPages = Math.ceil(filteredSales.length / pageSize) || 1;
  const paginatedSales = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredSales.slice(start, start + pageSize);
  }, [filteredSales, currentPage, pageSize]);

  // Export CSV
  const handleExportCSV = () => {
    if (filteredSales.length === 0) {
      toast.error('No records to export');
      return;
    }
    const headers = ['Date & Time', 'Staff Member', 'Department', 'Amount (INR)', 'Payment Mode', 'Split Cash', 'Split UPI', 'Notes', 'Customer', 'Recorded By'];
    const rows = filteredSales.map((s) => {
      const dt = s.createdAt?.toDate ? s.createdAt.toDate().toLocaleString('en-IN') : s.date || 'N/A';
      return [
        `"${dt}"`,
        `"${s.employeeName}"`,
        `"${s.employeeRole || ''}"`,
        s.amount.toFixed(2),
        `"${s.paymentMode}"`,
        s.splitCash ? s.splitCash.toFixed(2) : '0',
        s.splitUpi ? s.splitUpi.toFixed(2) : '0',
        `"${s.notes || s.note || ''}"`,
        `"${s.customerName || ''}"`,
        `"${s.createdByName || ''}"`,
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const empNameSlug = selectedEmployeeObj ? selectedEmployeeObj.name.replace(/\s+/g, '_') : 'All_Staff';
    link.setAttribute('download', `Loose_Sales_${empNameSlug}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Analytics CSV downloaded successfully');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 px-4 lg:px-8 py-3.5 shadow-2xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-200 shadow-2xs">
              <BarChart3 size={18} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                Loose Sales Analytics
                <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-teal-50 text-[#02626D] border border-teal-200">
                  {selectedEmployeeObj ? selectedEmployeeObj.name : 'All Staff'}
                </span>
              </h1>
              <p className="text-xs text-slate-500">
                Staff-wise loose counter transactions, Cash, UPI, and Card analytics
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <Link
              href="/loose-sales"
              className="h-8.5 px-3 text-xs font-semibold rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 shadow-2xs inline-flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Coins size={14} className="text-slate-500" />
              <span>+ Add Loose Sale</span>
            </Link>
            <button
              onClick={handleExportCSV}
              className="h-8.5 px-3 text-xs font-semibold rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 shadow-2xs inline-flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Download size={14} className="text-slate-500" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6 space-y-4">
        
        {/* Unified Filter Toolbar */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs space-y-3">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            {/* Left Controls: Employee Dropdown & Date Picker */}
            <div className="flex items-center gap-2.5 flex-wrap flex-1">
              
              {/* Employee Selector Dropdown */}
              <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 text-xs min-w-[240px]">
                <Users size={14} className="text-[#02626D] shrink-0" />
                <span className="text-[11px] font-bold text-slate-500 shrink-0">Staff:</span>
                <select
                  value={selectedEmployeeId}
                  onChange={(e) => {
                    setSelectedEmployeeId(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer w-full text-xs"
                >
                  <option value="ALL">All Staff Members ({employees.length})</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} {emp.department ? `(${emp.department})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Picker */}
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
                  onClick={() => {
                    setSelectedDate('');
                    setCurrentPage(1);
                  }}
                  className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 px-2.5 py-1.5 rounded-lg hover:bg-rose-100 transition"
                >
                  Clear Date
                </button>
              )}

              {selectedEmployeeId !== 'ALL' && (
                <button
                  onClick={() => {
                    setSelectedEmployeeId('ALL');
                    setCurrentPage(1);
                  }}
                  className="text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-200 px-2.5 py-1.5 rounded-lg hover:bg-teal-100 transition"
                >
                  Clear Staff Filter
                </button>
              )}
            </div>

            {/* Right Controls: Search & Payment Mode Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative w-full sm:w-56">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search staff, notes, customer..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#02626D] focus:bg-white transition"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Payment Mode Pills */}
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                {['ALL', 'Cash', 'UPI', 'Card', 'Split'].map((mode) => {
                  const active = selectedPaymentMode === mode;
                  return (
                    <button
                      key={mode}
                      onClick={() => {
                        setSelectedPaymentMode(mode);
                        setCurrentPage(1);
                      }}
                      className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                        active
                          ? 'bg-[#02626D] text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                      }`}
                    >
                      {mode === 'ALL' ? 'All' : mode}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* KPI Financial & Performance Metrics Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* 1. Total Loose Sales */}
          <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Total Loose Sales
              </span>
              <div className="p-2 rounded-lg bg-teal-50 text-[#02626D]">
                <IndianRupee size={16} />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold font-mono text-slate-900">
                ₹{metrics.totalSales.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {metrics.count} transactions recorded
              </p>
            </div>
          </div>

          {/* 2. Cash Collected */}
          <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Cash Collections
              </span>
              <div className="p-2 rounded-lg bg-amber-50 text-amber-700">
                <Banknote size={16} />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold font-mono text-amber-700">
                ₹{metrics.cash.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {metrics.cashPct}% of total volume
              </p>
            </div>
          </div>

          {/* 3. UPI Received */}
          <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                UPI Digital
              </span>
              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
                <Smartphone size={16} />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold font-mono text-emerald-700">
                ₹{metrics.upi.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {metrics.upiPct}% of total volume
              </p>
            </div>
          </div>

          {/* 4. Card Swipes */}
          <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Card Swipes
              </span>
              <div className="p-2 rounded-lg bg-sky-50 text-sky-700">
                <CreditCard size={16} />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold font-mono text-sky-700">
                ₹{metrics.card.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {metrics.cardPct}% of total volume
              </p>
            </div>
          </div>

          {/* 5. Average Sale & Split */}
          <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Average Sale
              </span>
              <div className="p-2 rounded-lg bg-indigo-50 text-indigo-700">
                <Receipt size={16} />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold font-mono text-indigo-700">
                ₹{metrics.avgSale.toLocaleString('en-IN')}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Split total: ₹{metrics.split.toLocaleString('en-IN')}
              </p>
            </div>
          </div>
        </div>

        {/* Detailed Transactions Table */}
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <Coins size={16} className="text-[#02626D]" />
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                Loose Sales Log ({filteredSales.length})
              </h2>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              Showing {paginatedSales.length} of {filteredSales.length} records
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Date &amp; Time</th>
                  <th className="py-3 px-4">Staff Member</th>
                  <th className="py-3 px-4 text-right">Sale Amount</th>
                  <th className="py-3 px-4">Payment Method</th>
                  <th className="py-3 px-4">Notes / Purpose</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Recorded By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="w-6 h-6 animate-spin text-[#02626D]" />
                        <span className="text-xs font-medium">Loading sales analytics...</span>
                      </div>
                    </td>
                  </tr>
                ) : paginatedSales.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Coins className="w-8 h-8 text-slate-300" />
                        <span className="text-xs font-medium">
                          No loose sales records found matching the filter criteria
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
                      : sale.dateStr || sale.date || 'Recent';

                    return (
                      <tr key={sale.id} className="hover:bg-slate-50/70 border-b border-slate-100 transition-colors">
                        <td className="py-3 px-4 text-slate-600">
                          <div className="flex items-center gap-1.5">
                            <Clock size={13} className="text-slate-400" />
                            <span>{formattedDate}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-teal-50 text-[#02626D] flex items-center justify-center text-[10px] font-bold">
                              {sale.employeeName ? sale.employeeName.charAt(0).toUpperCase() : 'E'}
                            </div>
                            <div>
                              <span>{sale.employeeName}</span>
                              {sale.employeeRole && (
                                <span className="text-[10px] text-slate-400 block font-normal">
                                  {sale.employeeRole}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900 font-mono text-sm">
                          ₹{sale.amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4">
                          {sale.paymentMode === 'Cash' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                              <Banknote size={12} /> Cash
                            </span>
                          )}
                          {sale.paymentMode === 'UPI' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <Smartphone size={12} /> UPI
                            </span>
                          )}
                          {sale.paymentMode === 'Card' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-800 border border-sky-200">
                              <CreditCard size={12} /> Card
                            </span>
                          )}
                          {sale.paymentMode === 'Split' && (
                            <div>
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-800 border border-purple-200">
                                <Layers size={12} /> Split
                              </span>
                              <div className="text-[10px] text-slate-500 mt-0.5">
                                Cash ₹{sale.splitCash || 0} + UPI ₹{sale.splitUpi || 0}
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-700">
                          {sale.notes || sale.note || <span className="text-slate-400 italic">General sale</span>}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {sale.customerName || <span className="text-slate-400">Walk-in</span>}
                        </td>
                        <td className="py-3 px-4 text-slate-500 text-[11px]">
                          {sale.createdByName || 'System'}
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
                  className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition"
                >
                  Previous
                </button>
                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

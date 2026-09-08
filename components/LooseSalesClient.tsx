'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Coins,
  Plus,
  Search,
  IndianRupee,
  Calendar,
  Filter,
  Trash2,
  Edit2,
  TrendingUp,
  User,
  Users,
  Smartphone,
  Banknote,
  CreditCard,
  Layers,
  Clock,
  X,
  Check,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import {
  LooseSaleRecord,
  useLooseSales,
  addLooseSale,
  updateLooseSale,
  deleteLooseSale,
} from '@/lib/looseSales';
import CustomDatePicker from '@/components/CustomDatePicker';
import { useAuth } from '@/context/AuthContext';
import { toast } from '@/context/ToastContext';

interface EmployeeOption {
  id: string;
  employeeId?: string;
  name: string;
  role: string;
  phone?: string;
}

export default function LooseSalesClient() {
  const { user, employeeProfile } = useAuth();
  const { sales, loading: salesLoading, error: salesError } = useLooseSales();

  // Employee list
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPaymentMode, setSelectedPaymentMode] = useState<string>('ALL');
  const [selectedDate, setSelectedDate] = useState<string>('');

  // Add / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<LooseSaleRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form Fields
  const [amount, setAmount] = useState<string>('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'UPI' | 'Card' | 'Split'>('Cash');
  const [splitCash, setSplitCash] = useState<string>('');
  const [splitUpi, setSplitUpi] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');

  // Delete Confirmation Modal
  const [deleteTarget, setDeleteTarget] = useState<LooseSaleRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Fetch employees from Firestore
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'employees'),
      (snapshot) => {
        const list: EmployeeOption[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          if (d.status !== 'inactive' && d.status !== 'Inactive') {
            list.push({
              id: docSnap.id,
              employeeId: d.empId || d.employeeId || docSnap.id.substring(0, 6),
              name: d.name || d.employeeName || 'Staff Member',
              role: d.department || d.role || 'Staff',
              phone: d.mobile || d.phone,
            });
          }
        });
        setEmployees(list.sort((a, b) => a.name.localeCompare(b.name)));
        setLoadingEmployees(false);
      },
      (err) => {
        console.error('Error fetching employees:', err);
        setLoadingEmployees(false);
      }
    );
    return () => unsub();
  }, []);

  // Quick Amount presets
  const quickPresets = [10, 20, 50, 100, 200, 500, 1000];
  const handleQuickAdd = (val: number) => {
    const current = parseFloat(amount) || 0;
    setAmount((current + val).toString());
  };

  // Open modal for new entry
  const openNewModal = () => {
    setEditingSale(null);
    setAmount('');
    setSelectedEmployeeId(employees[0]?.id || '');
    setPaymentMode('Cash');
    setSplitCash('');
    setSplitUpi('');
    setNotes('');
    setCustomerName('');
    setIsModalOpen(true);
  };

  // Open modal for editing
  const openEditModal = (sale: LooseSaleRecord) => {
    setEditingSale(sale);
    setAmount(sale.amount.toString());
    setSelectedEmployeeId(sale.employeeId);
    setPaymentMode(sale.paymentMode);
    setSplitCash(sale.splitCash ? sale.splitCash.toString() : '');
    setSplitUpi(sale.splitUpi ? sale.splitUpi.toString() : '');
    setNotes(sale.notes || '');
    setCustomerName(sale.customerName || '');
    setIsModalOpen(true);
  };

  // Split calculations
  useEffect(() => {
    if (paymentMode === 'Split') {
      const numAmt = parseFloat(amount) || 0;
      const numCash = parseFloat(splitCash) || 0;
      if (numAmt > 0 && splitCash !== '') {
        const remainingUpi = Math.max(0, numAmt - numCash);
        setSplitUpi(remainingUpi.toString());
      }
    }
  }, [amount, splitCash, paymentMode]);

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    const emp = employees.find((e) => e.id === selectedEmployeeId);
    if (!emp) {
      toast.error('Please select an employee');
      return;
    }

    let numSplitCash = 0;
    let numSplitUpi = 0;
    if (paymentMode === 'Split') {
      numSplitCash = parseFloat(splitCash) || 0;
      numSplitUpi = parseFloat(splitUpi) || 0;
      if (Math.abs(numSplitCash + numSplitUpi - numAmount) > 0.01) {
        toast.error(`Split Cash (₹${numSplitCash}) + UPI (₹${numSplitUpi}) must equal Total Amount (₹${numAmount})`);
        return;
      }
    }

    setSubmitting(true);
    try {
      if (editingSale) {
        // Update
        await updateLooseSale(
          editingSale.id,
          {
            amount: numAmount,
            employeeId: emp.id,
            employeeName: emp.name,
            employeeRole: emp.role,
            paymentMode,
            splitCash: paymentMode === 'Split' ? numSplitCash : undefined,
            splitUpi: paymentMode === 'Split' ? numSplitUpi : undefined,
            notes: notes.trim(),
            customerName: customerName.trim(),
          },
          {
            id: user?.uid || employeeProfile?.id || 'admin',
            name: user?.displayName || employeeProfile?.name || 'Admin',
            role: employeeProfile?.department || 'Staff',
          }
        );
        toast.success('Loose sale updated successfully');
      } else {
        // Add new
        await addLooseSale(
          {
            amount: numAmount,
            employeeId: emp.id,
            employeeName: emp.name,
            employeeRole: emp.role,
            paymentMode,
            splitCash: paymentMode === 'Split' ? numSplitCash : undefined,
            splitUpi: paymentMode === 'Split' ? numSplitUpi : undefined,
            notes: notes.trim(),
            customerName: customerName.trim(),
          },
          {
            id: user?.uid || employeeProfile?.id || 'admin',
            name: user?.displayName || employeeProfile?.name || 'Admin',
            role: employeeProfile?.department || 'Staff',
          }
        );
        toast.success(`Loose sale of ₹${numAmount} recorded!`);
      }
      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Error saving loose sale:', err);
      toast.error(err?.message || 'Failed to save loose sale');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Action
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteLooseSale(deleteTarget.id, deleteTarget, {
        id: user?.uid || employeeProfile?.id || 'admin',
        name: user?.displayName || employeeProfile?.name || 'Admin',
        role: employeeProfile?.department || 'Staff',
      });
      toast.success('Loose sale entry removed');
      setDeleteTarget(null);
    } catch (err) {
      console.error('Error deleting loose sale:', err);
      toast.error('Failed to delete entry');
    } finally {
      setDeleting(false);
    }
  };

  // Filtered sales
  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      if (selectedPaymentMode !== 'ALL' && s.paymentMode !== selectedPaymentMode) {
        return false;
      }
      if (selectedDate && s.dateStr !== selectedDate) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchEmp = s.employeeName?.toLowerCase().includes(q);
        const matchNotes = s.notes?.toLowerCase().includes(q);
        const matchCust = s.customerName?.toLowerCase().includes(q);
        const matchAmt = s.amount.toString().includes(q);
        if (!matchEmp && !matchNotes && !matchCust && !matchAmt) return false;
      }
      return true;
    });
  }, [sales, selectedPaymentMode, selectedDate, searchQuery]);

  // Today's Metrics
  const todayStr = new Date().toISOString().split('T')[0];
  const todayMetrics = useMemo(() => {
    const todayRecords = sales.filter((s) => s.dateStr === todayStr);
    let total = 0;
    let cash = 0;
    let upi = 0;
    let card = 0;
    let split = 0;

    todayRecords.forEach((s) => {
      total += s.amount;
      if (s.paymentMode === 'Cash') cash += s.amount;
      else if (s.paymentMode === 'UPI') upi += s.amount;
      else if (s.paymentMode === 'Card') card += s.amount;
      else if (s.paymentMode === 'Split') {
        split += s.amount;
        cash += s.splitCash || 0;
        upi += s.splitUpi || 0;
      }
    });

    return {
      count: todayRecords.length,
      total,
      cash,
      upi,
      card,
      split,
    };
  }, [sales, todayStr]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 px-4 lg:px-8 py-3.5 shadow-2xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-200 shadow-2xs">
              <Coins size={18} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                Loose Sales Entry
                <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-teal-50 text-[#02626D] border border-teal-200">
                  Counter Sales
                </span>
              </h1>
              <p className="text-xs text-slate-500">
                Quick entry for loose sweets, snacks, and counter items by employee &amp; payment mode
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <Link
              href="/loose-sales-analytics"
              className="h-8.5 px-3 text-xs font-semibold rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 shadow-2xs inline-flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <BarChart3 size={14} className="text-slate-500" />
              <span>Employee Analytics</span>
            </Link>
            <button
              onClick={openNewModal}
              className="h-8.5 px-3.5 text-xs font-semibold rounded-lg bg-[#02626D] hover:bg-[#014d56] text-white shadow-2xs inline-flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Plus size={14} />
              <span>Add Loose Sale</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6 space-y-4">
        {/* Today's Overview Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Today's Loose Total</span>
              <div className="p-2 rounded-lg bg-teal-50 text-[#02626D]">
                <IndianRupee size={16} />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold font-mono text-slate-900">
                ₹{todayMetrics.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">{todayMetrics.count} sales recorded today</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cash Collected</span>
              <div className="p-2 rounded-lg bg-amber-50 text-amber-700">
                <Banknote size={16} />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold font-mono text-amber-700">
                ₹{todayMetrics.cash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Cash mode &amp; split</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">UPI Received</span>
              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
                <Smartphone size={16} />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold font-mono text-emerald-700">
                ₹{todayMetrics.upi.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">UPI QR / PhonePe</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Card Swipes</span>
              <div className="p-2 rounded-lg bg-sky-50 text-sky-700">
                <CreditCard size={16} />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold font-mono text-sky-700">
                ₹{todayMetrics.card.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">POS Card Machine</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col justify-between col-span-1 sm:col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Split Total</span>
              <div className="p-2 rounded-lg bg-purple-50 text-purple-700">
                <Layers size={16} />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold font-mono text-purple-700">
                ₹{todayMetrics.split.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Cash + UPI split</p>
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 flex-1 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-[220px]">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search staff, notes, customer or amount..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
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

            {/* Date filter */}
            <div className="w-40">
              <CustomDatePicker
                value={selectedDate}
                onChange={(val) => setSelectedDate(val)}
                placeholder="Filter Date"
              />
            </div>
            {selectedDate && (
              <button
                onClick={() => setSelectedDate('')}
                className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 px-2.5 py-1.5 rounded-lg hover:bg-rose-100 transition"
              >
                Clear Date
              </button>
            )}
          </div>

          {/* Payment Method Badges */}
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            {['ALL', 'Cash', 'UPI', 'Card', 'Split'].map((mode) => {
              const active = selectedPaymentMode === mode;
              return (
                <button
                  key={mode}
                  onClick={() => setSelectedPaymentMode(mode)}
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

        {/* Loose Sales Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800 tracking-tight flex items-center gap-2">
              <Coins className="w-4 h-4 text-[#02626D]" />
              Loose Sales Log ({filteredSales.length})
            </h2>
            <span className="text-xs text-slate-500 font-medium">
              Real-time synchronization
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Staff / Employee</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4">Payment Method</th>
                  <th className="py-3 px-4">Notes / Purpose</th>
                  <th className="py-3 px-4">Recorded By</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {salesLoading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="w-6 h-6 animate-spin text-[#02626D]" />
                        <span className="text-xs font-medium">Loading loose sales...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredSales.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Coins className="w-8 h-8 text-slate-300" />
                        <span className="text-xs font-medium">No loose sales recorded matching criteria</span>
                        <button
                          onClick={openNewModal}
                          className="mt-2 text-xs font-semibold text-[#02626D] bg-teal-50 px-3 py-1.5 rounded-xl hover:bg-teal-100 transition"
                        >
                          + Record First Loose Sale
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredSales.map((sale) => {
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
                        <td className="py-3 px-4 text-slate-600">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
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
                        <td className="py-3 px-4 text-right font-bold text-slate-900 text-sm">
                          ₹{sale.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4">
                          {sale.paymentMode === 'Cash' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                              <Banknote className="w-3 h-3" /> Cash
                            </span>
                          )}
                          {sale.paymentMode === 'UPI' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <Smartphone className="w-3 h-3" /> UPI
                            </span>
                          )}
                          {sale.paymentMode === 'Card' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-800 border border-sky-200">
                              <CreditCard className="w-3 h-3" /> Card
                            </span>
                          )}
                          {sale.paymentMode === 'Split' && (
                            <div>
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-800 border border-purple-200">
                                <Layers className="w-3 h-3" /> Split
                              </span>
                              <div className="text-[10px] text-slate-500 mt-0.5">
                                Cash ₹{sale.splitCash || 0} + UPI ₹{sale.splitUpi || 0}
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {sale.notes ? (
                            <span className="font-medium text-slate-800">{sale.notes}</span>
                          ) : (
                            <span className="text-slate-400 italic">General counter sale</span>
                          )}
                          {sale.customerName && (
                            <span className="block text-[10px] text-slate-500">
                              Customer: {sale.customerName}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-500 text-[11px]">
                          {sale.createdByName || 'System'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => openEditModal(sale)}
                              className="p-1.5 text-slate-500 hover:text-[#02626D] hover:bg-teal-50 rounded-lg transition"
                              title="Edit"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(sale)}
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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
        </div>
      </main>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-[#02626D] text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Coins className="w-5 h-5" />
                <div>
                  <h3 className="font-bold text-base">
                    {editingSale ? 'Edit Loose Sale' : 'Add Loose Sale'}
                  </h3>
                  <p className="text-[11px] text-teal-100">
                    Record counter amount and assign to staff member
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-5 text-xs">
              {/* Amount input with quick rupee buttons */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Sale Amount (₹) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base font-bold text-slate-400">
                    ₹
                  </span>
                  <input
                    type="number"
                    step="any"
                    required
                    autoFocus
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 text-lg font-bold text-slate-900 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#02626D] focus:bg-white transition"
                  />
                </div>

                {/* Quick Add Presets */}
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  <span className="text-[11px] text-slate-500 font-medium mr-1">Quick Add:</span>
                  {quickPresets.map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handleQuickAdd(val)}
                      className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-teal-50 hover:text-[#02626D] text-slate-700 rounded-lg border border-slate-200 transition"
                    >
                      +₹{val}
                    </button>
                  ))}
                  {amount && (
                    <button
                      type="button"
                      onClick={() => setAmount('')}
                      className="px-2 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition ml-auto"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Employee Selection */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Select Staff / Employee <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={selectedEmployeeId}
                    onChange={(e) => setSelectedEmployeeId(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#02626D] focus:bg-white transition max-h-[38px]"
                  >
                    <option value="" disabled>
                      -- Choose Employee --
                    </option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} {emp.role ? `(${emp.role})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Payment Method Tabs */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Payment Method <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['Cash', 'UPI', 'Card', 'Split'] as const).map((mode) => {
                    const active = paymentMode === mode;
                    return (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setPaymentMode(mode)}
                        className={`py-2 px-3 rounded-xl font-bold flex flex-col items-center justify-center gap-1 border transition ${
                          active
                            ? 'bg-[#02626D] text-white border-[#02626D] shadow-sm'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {mode === 'Cash' && <Banknote className="w-4 h-4" />}
                        {mode === 'UPI' && <Smartphone className="w-4 h-4" />}
                        {mode === 'Card' && <CreditCard className="w-4 h-4" />}
                        {mode === 'Split' && <Layers className="w-4 h-4" />}
                        <span>{mode}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Split Breakdown Details if Split selected */}
              {paymentMode === 'Split' && (
                <div className="p-3.5 bg-purple-50/60 rounded-xl border border-purple-200 space-y-2.5 animate-in fade-in">
                  <div className="font-semibold text-purple-900 flex items-center justify-between text-[11px]">
                    <span>Split Payment Calculation</span>
                    <span className="font-bold">Total: ₹{amount || '0'}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-medium text-slate-700 mb-1 text-[11px]">
                        Cash Amount (₹)
                      </label>
                      <input
                        type="number"
                        step="any"
                        placeholder="0.00"
                        value={splitCash}
                        onChange={(e) => setSplitCash(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600 max-h-[36px]"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-700 mb-1 text-[11px]">
                        UPI Amount (₹)
                      </label>
                      <input
                        type="number"
                        step="any"
                        placeholder="0.00"
                        value={splitUpi}
                        onChange={(e) => setSplitUpi(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600 max-h-[36px]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Notes / Reason */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Reason / Item Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 250g Mixture, Water bottles, Special tea parcel..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#02626D] focus:bg-white transition max-h-[36px]"
                />
              </div>

              {/* Optional Customer Name */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Customer Name / Phone (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh / 9876543210"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#02626D] focus:bg-white transition max-h-[36px]"
                />
              </div>

              {/* Modal Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition max-h-[36px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 px-5 py-2 font-semibold text-white bg-[#02626D] hover:bg-[#014d56] rounded-xl shadow-sm disabled:opacity-50 transition max-h-[36px]"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      {editingSale ? 'Update Sale' : 'Save Loose Sale'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Delete Loose Sale?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to remove this loose sale of{' '}
                <span className="font-bold text-slate-900">₹{deleteTarget.amount}</span> recorded for{' '}
                <span className="font-bold text-slate-900">{deleteTarget.employeeName}</span>?
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition max-h-[36px]"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm transition max-h-[36px]"
              >
                {deleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Calendar as CalendarIcon,
  Plus,
  Search,
  Trash2,
  Lock,
  Unlock,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  ShoppingBag,
  Info,
  X,
  Filter,
  Check,
  CalendarCheck,
  RotateCcw,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { toast } from '@/context/ToastContext';
import CustomDatePicker from '@/components/CustomDatePicker';
import {
  useAllowedTuesdays,
  enableTuesdayOverride,
  disableTuesdayOverride,
  deleteTuesdayOverride,
  TuesdayOverride,
} from '@/lib/tuesdayOverrides';

// Helper to format date string to human readable string
function formatDisplayDate(dateStr: string): string {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  if (isNaN(dateObj.getTime())) return dateStr;
  return dateObj.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// Helper to calculate days countdown label
function getDaysCountdown(dateStr: string): { label: string; isPast: boolean; isToday: boolean } {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return { label: '', isPast: false, isToday: false };
  const [y, m, d] = dateStr.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);

  const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return { label: 'Today', isPast: false, isToday: true };
  if (diffDays === 1) return { label: 'Tomorrow', isPast: false, isToday: false };
  if (diffDays > 1) return { label: `In ${diffDays} days`, isPast: false, isToday: false };
  if (diffDays === -1) return { label: 'Yesterday', isPast: true, isToday: false };
  return { label: `${Math.abs(diffDays)}d ago`, isPast: true, isToday: false };
}

// Generate the upcoming next 8 Tuesdays starting from current week
function getUpcomingTuesdaysList(count: number = 8): { dateStr: string; label: string; dayNum: number; monthName: string }[] {
  const tuesdays = [];
  const curr = new Date();
  curr.setHours(0, 0, 0, 0);

  // Find next Tuesday (day 2)
  const day = curr.getDay();
  let daysUntilTuesday = (2 - day + 7) % 7;
  if (daysUntilTuesday === 0 && curr.getHours() >= 18) {
    daysUntilTuesday = 7;
  }

  const firstTuesday = new Date(curr);
  firstTuesday.setDate(curr.getDate() + daysUntilTuesday);

  for (let i = 0; i < count; i++) {
    const tDate = new Date(firstTuesday);
    tDate.setDate(firstTuesday.getDate() + i * 7);

    const y = tDate.getFullYear();
    const m = String(tDate.getMonth() + 1).padStart(2, '0');
    const d = String(tDate.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    tuesdays.push({
      dateStr,
      dayNum: tDate.getDate(),
      monthName: tDate.toLocaleDateString('en-IN', { month: 'short' }),
      label: tDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
    });
  }

  return tuesdays;
}

const COMMON_REASONS = [
  'Diwali Festival Orders',
  'Pongal / Sankranti Rush',
  'Ganesh Chaturthi Eve',
  'Bulk Marriage Order Dispatch',
  'Corporate Gift Delivery',
  'High Demand Production Run',
];

export default function TuesdayOverrideClient() {
  const { user, employeeProfile } = useAuth();
  const { allowedDates, overrides, isLoading } = useAllowedTuesdays();

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'upcoming' | 'all'>('active');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalDate, setModalDate] = useState('');
  const [modalReason, setModalReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check if current user has edit permission
  const canEdit = useMemo(() => {
    if (!employeeProfile) return true;
    if (employeeProfile.isSuperAdmin) return true;
    if (user?.email && !employeeProfile) return true;
    return Boolean(employeeProfile.permissions?.settings?.edit ?? true);
  }, [employeeProfile, user]);

  const upcomingTuesdays = useMemo(() => getUpcomingTuesdaysList(8), []);

  const todayStr = useMemo(() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  }, []);

  // Filtered overrides
  const filteredOverrides = useMemo(() => {
    return overrides.filter((item) => {
      // Tab filter
      if (statusFilter === 'active' && item.status !== 'enabled') return false;
      if (statusFilter === 'upcoming') {
        if (item.status !== 'enabled') return false;
        if (item.date < todayStr) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchDate = item.date.toLowerCase().includes(q);
        const matchReason = (item.reason || '').toLowerCase().includes(q);
        const matchUser = (item.enabledByName || '').toLowerCase().includes(q);
        if (!matchDate && !matchReason && !matchUser) return false;
      }

      return true;
    });
  }, [overrides, statusFilter, searchQuery, todayStr]);

  // Statistics
  const stats = useMemo(() => {
    const activeCount = allowedDates.length;
    const upcomingCount = overrides.filter((o) => o.status === 'enabled' && o.date >= todayStr).length;
    return {
      activeCount,
      upcomingCount,
      totalCount: overrides.length,
    };
  }, [allowedDates, overrides, todayStr]);

  // Open modal for enabling date
  const openEnableModal = (defaultDate?: string) => {
    setModalDate(defaultDate || '');
    setModalReason('');
    setIsModalOpen(true);
  };

  // Submit Enable Tuesday
  const handleSaveEnable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalDate) {
      toast.warning('Date Required', 'Please select a Tuesday date.');
      return;
    }

    const [y, m, d] = modalDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    if (dateObj.getDay() !== 2) {
      toast.error('Invalid Date', 'The selected date is not a Tuesday. Please pick a Tuesday.');
      return;
    }

    try {
      setIsSubmitting(true);
      await enableTuesdayOverride(modalDate, modalReason, {
        id: employeeProfile?.id || employeeProfile?.empId || user?.uid,
        name: employeeProfile?.name || (user?.email ? user.email.split('@')[0] : 'Admin User'),
        email: user?.email || '',
      });

      toast.success(
        'Tuesday Enabled!',
        `${formatDisplayDate(modalDate)} is now OPEN for order creation & dispatch.`
      );
      setIsModalOpen(false);
      setModalDate('');
      setModalReason('');
    } catch (err: any) {
      console.error('Failed to enable Tuesday:', err);
      toast.error('Operation Failed', err.message || 'Could not save override.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick 1-click Toggle
  const handleQuickToggle = async (dateStr: string, isCurrentlyEnabled: boolean) => {
    if (!canEdit) {
      toast.warning('Access Denied', 'You do not have permission to modify settings.');
      return;
    }

    if (isCurrentlyEnabled) {
      if (!confirm(`Are you sure you want to block Tuesday [${formatDisplayDate(dateStr)}]? New orders on this date will no longer be permitted.`)) {
        return;
      }
      try {
        await disableTuesdayOverride(dateStr, {
          id: employeeProfile?.id || employeeProfile?.empId || user?.uid,
          name: employeeProfile?.name || (user?.email ? user.email.split('@')[0] : 'Admin User'),
          email: user?.email || '',
        });
        toast.info('Tuesday Re-Blocked', `${formatDisplayDate(dateStr)} is now closed for orders.`);
      } catch (err: any) {
        toast.error('Action Failed', err.message);
      }
    } else {
      openEnableModal(dateStr);
    }
  };

  // Delete Record
  const handleDeleteRecord = async (dateStr: string) => {
    if (!confirm(`Permanently remove override record for ${formatDisplayDate(dateStr)}?`)) return;
    try {
      await deleteTuesdayOverride(dateStr, {
        id: employeeProfile?.id || employeeProfile?.empId || user?.uid,
        name: employeeProfile?.name || (user?.email ? user.email.split('@')[0] : 'Admin User'),
      });
      toast.success('Record Deleted', `Override record for ${dateStr} removed.`);
    } catch (err: any) {
      toast.error('Delete Failed', err.message);
    }
  };

  return (
    <div className="w-full min-h-screen bg-[#f6f6f7] p-4 sm:p-6 md:p-8 space-y-6">
      
      {/* ── 1. HEADER SECTION ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center text-[#02626D] shadow-2xs">
            <CalendarCheck size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Tuesday Overrides &amp; Enablement</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-teal-50 text-[#02626D] border border-teal-200">
                Order &amp; Factory Rules
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Select and enable specific festival or special business Tuesdays to unlock order creation and kitchen batching.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/orders"
            className="h-9 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
          >
            <ShoppingBag size={14} />
            <span>Orders Workspace</span>
          </Link>

          <button
            type="button"
            onClick={() => openEnableModal()}
            className="h-9 px-4 rounded-xl bg-[#02626D] hover:bg-[#014d56] text-white text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center gap-1.5 active:scale-95"
          >
            <Plus size={15} />
            <span>Enable a Tuesday</span>
          </button>
        </div>
      </div>

      {/* ── 2. SUMMARY STATS BAR ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Active Overrides</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-emerald-700">{stats.activeCount}</span>
            <span className="text-xs text-emerald-600 font-semibold">Tuesdays Open</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Upcoming Overrides</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-[#02626D]">{stats.upcomingCount}</span>
            <span className="text-xs text-slate-400 font-semibold">Scheduled</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Default Store Policy</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-base font-bold text-rose-700">Closed / Blocked</span>
            <span className="text-xs text-slate-400 font-semibold">on Tuesdays</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Logged Records</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-slate-900">{stats.totalCount}</span>
            <span className="text-xs text-slate-400 font-semibold">Overrides</span>
          </div>
        </div>
      </div>

      {/* ── 3. QUICK PICK UPCOMING TUESDAYS STRIP ──────────────────────────── */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock size={15} className="text-[#02626D]" />
            <span className="text-xs font-bold text-slate-800">Quick Pick Upcoming Tuesdays</span>
            <span className="text-[11px] text-slate-400 font-normal">(Next 8 Weeks)</span>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">Click to toggle or enable</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {upcomingTuesdays.map((item) => {
            const isEnabled = allowedDates.includes(item.dateStr);

            return (
              <button
                key={item.dateStr}
                type="button"
                onClick={() => handleQuickToggle(item.dateStr, isEnabled)}
                className={`p-2 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between select-none ${
                  isEnabled
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900 hover:bg-emerald-100 shadow-2xs'
                    : 'bg-[#f7f7f8] hover:bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className={`text-[10px] font-bold ${isEnabled ? 'text-emerald-700' : 'text-slate-400'}`}>
                    {item.monthName}
                  </span>
                  <span
                    className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded ${
                      isEnabled
                        ? 'bg-emerald-200/90 text-emerald-800'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {isEnabled ? 'OPEN' : 'BLOCKED'}
                  </span>
                </div>

                <div className="mt-1 flex items-baseline justify-between w-full">
                  <span className={`text-sm font-bold ${isEnabled ? 'text-emerald-900' : 'text-slate-800'}`}>
                    {item.dayNum} {item.monthName}
                  </span>
                  {isEnabled ? (
                    <Check size={12} className="text-emerald-700 stroke-[3]" />
                  ) : (
                    <Plus size={12} className="text-slate-400" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 4. MAIN DATA TABLE CARD ────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        
        {/* Table Toolbar */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#fafafa]">
          {/* Left: Search Bar */}
          <div className="relative flex-1 max-w-sm">
            <input
              type="text"
              placeholder="Search by date, occasion, or author..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 h-9 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-[#02626D] bg-white font-medium"
            />
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* Center/Right: Filter Tabs */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setStatusFilter('active')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  statusFilter === 'active'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Active ({allowedDates.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('upcoming')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  statusFilter === 'upcoming'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Upcoming
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  statusFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All History ({overrides.length})
              </button>
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-12 text-center text-xs text-slate-400 font-medium">
              Loading Tuesday overrides from database...
            </div>
          ) : filteredOverrides.length === 0 ? (
            <div className="p-14 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <CalendarIcon size={22} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">No Tuesday Overrides Found</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                  {searchQuery
                    ? 'No records match your search criteria. Try a different query.'
                    : statusFilter === 'active'
                    ? 'No Tuesdays are currently enabled. All Tuesdays are blocked by default for factory & store.'
                    : 'No overrides recorded in this view.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => openEnableModal()}
                className="h-8.5 px-4 rounded-xl bg-[#02626D] hover:bg-[#014d56] text-white text-xs font-bold shadow-2xs transition-all inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus size={14} />
                <span>Enable a Tuesday</span>
              </button>
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-[#f7f7f8] text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Tuesday Date</th>
                  <th className="py-3 px-4">Occasion / Reason</th>
                  <th className="py-3 px-4">Timing &amp; Countdown</th>
                  <th className="py-3 px-4">Order Status</th>
                  <th className="py-3 px-4">Configured By</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {filteredOverrides.map((item) => {
                  const isEnabled = item.status === 'enabled';
                  const countdown = getDaysCountdown(item.date);

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Date & Badge */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border ${
                              isEnabled
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-bold'
                                : 'bg-slate-100 border-slate-200 text-slate-500'
                            }`}
                          >
                            <CalendarIcon size={16} />
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 text-xs block">
                              {formatDisplayDate(item.date)}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">{item.date}</span>
                          </div>
                        </div>
                      </td>

                      {/* Reason */}
                      <td className="py-3 px-4">
                        <span className="text-xs text-slate-800 font-semibold block">
                          {item.reason || 'Special Business Opening'}
                        </span>
                      </td>

                      {/* Timing Countdown */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                            countdown.isToday
                              ? 'bg-amber-100 text-amber-800 font-bold'
                              : countdown.isPast
                              ? 'bg-slate-100 text-slate-500'
                              : 'bg-teal-50 text-[#02626D] font-bold'
                          }`}
                        >
                          <Clock size={12} />
                          <span>{countdown.label}</span>
                        </span>
                      </td>

                      {/* Order Status Badge */}
                      <td className="py-3 px-4">
                        {isEnabled ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 size={12} className="text-emerald-600" />
                            <span>OPEN FOR ORDERS</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            <Lock size={11} className="text-slate-500" />
                            <span>BLOCKED</span>
                          </span>
                        )}
                      </td>

                      {/* Configured By */}
                      <td className="py-3 px-4">
                        <span className="text-xs text-slate-700 font-medium block">
                          {item.enabledByName || 'Admin'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isEnabled ? (
                            <button
                              type="button"
                              onClick={() => handleQuickToggle(item.date, true)}
                              disabled={!canEdit}
                              className="h-7 px-2.5 rounded-lg text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer flex items-center gap-1"
                              title="Block this Tuesday again"
                            >
                              <Lock size={12} />
                              <span>Block Again</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openEnableModal(item.date)}
                              disabled={!canEdit}
                              className="h-7 px-2.5 rounded-lg text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors cursor-pointer flex items-center gap-1"
                              title="Re-enable this Tuesday"
                            >
                              <Unlock size={12} />
                              <span>Re-Enable</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDeleteRecord(item.date)}
                            disabled={!canEdit}
                            className="h-7 w-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 transition-colors cursor-pointer flex items-center justify-center"
                            title="Delete record"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── 5. ENABLE TUESDAY MODAL ────────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-teal-50 text-[#02626D] flex items-center justify-center font-bold">
                  <CalendarCheck size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Enable Tuesday Override</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Permit order booking &amp; production on this date</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveEnable} className="space-y-4">
              {/* Date Field with Custom Calendar */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tuesday Date <span className="text-rose-500">*</span>
                </label>
                <CustomDatePicker
                  value={modalDate}
                  onChange={(val) => setModalDate(val)}
                  allowAll={false}
                  blockTuesdays={false}
                  onlyTuesdays={true}
                  placeholder="Click to Select Tuesday Date"
                  size="md"
                  className="w-full"
                />
                {modalDate && (
                  <p className="text-[11px] font-semibold text-emerald-700 mt-1 flex items-center gap-1">
                    <CheckCircle2 size={13} className="text-emerald-600" />
                    <span>Selected: {formatDisplayDate(modalDate)}</span>
                  </p>
                )}
              </div>

              {/* Quick Pick Chips for Upcoming Tuesdays */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1.5">
                  Quick Select Upcoming Tuesday:
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {upcomingTuesdays.slice(0, 4).map((t) => (
                    <button
                      key={t.dateStr}
                      type="button"
                      onClick={() => setModalDate(t.dateStr)}
                      className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                        modalDate === t.dateStr
                          ? 'bg-[#02626D] text-white border-[#02626D]'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {t.dayNum} {t.monthName}
                    </button>
                  ))}
                </div>
              </div>

              {/* Occasion / Reason */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Occasion / Purpose <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Diwali Festival Orders, Special Bulk Wedding Batch"
                  value={modalReason}
                  onChange={(e) => setModalReason(e.target.value)}
                  className="w-full h-9 px-3 border border-slate-300 rounded-xl text-xs text-slate-800 bg-[#f7f7f8] focus:bg-white focus:outline-none focus:border-[#02626D] shadow-2xs font-medium"
                />

                {/* Common suggestion chips */}
                <div className="flex items-center gap-1.5 flex-wrap mt-2">
                  {COMMON_REASONS.slice(0, 4).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setModalReason(r)}
                      className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-[10.5px] font-medium text-slate-600 transition-colors cursor-pointer"
                    >
                      + {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="h-9 px-4 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !modalDate}
                  className="h-9 px-4 rounded-xl bg-[#02626D] hover:bg-[#014d56] disabled:opacity-50 text-white text-xs font-bold shadow-2xs transition-all cursor-pointer flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <span>Saving...</span>
                  ) : (
                    <>
                      <Unlock size={14} />
                      <span>Enable This Tuesday</span>
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

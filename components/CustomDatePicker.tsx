'use client';

import { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, Check, Sparkles } from 'lucide-react';
import { useAllowedTuesdays } from '@/lib/tuesdayOverrides';

interface CustomDatePickerProps {
  value: string; // Format: 'YYYY-MM-DD' or 'All'
  onChange: (date: string) => void;
  allowAll?: boolean;
  blockTuesdays?: boolean;
  allowedTuesdays?: string[];
  onlyTuesdays?: boolean;
  placeholder?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function CustomDatePicker({
  value,
  onChange,
  allowAll = true,
  blockTuesdays = false,
  allowedTuesdays,
  onlyTuesdays = false,
  placeholder = 'Select Date',
  className = '',
  size = 'md',
}: CustomDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fallback to real-time hook if allowedTuesdays is not explicitly passed
  const { allowedDates: hookAllowedDates } = useAllowedTuesdays();
  const effectiveAllowedTuesdays = allowedTuesdays || hookAllowedDates || [];

  // Get current date representation
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // State for currently displayed year & month in calendar popup
  const [viewYear, setViewYear] = useState<number>(() => {
    if (value && value !== 'All' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return parseInt(value.split('-')[0], 10);
    }
    return today.getFullYear();
  });

  const [viewMonth, setViewMonth] = useState<number>(() => {
    if (value && value !== 'All' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return parseInt(value.split('-')[1], 10) - 1;
    }
    return today.getMonth();
  });

  // Keep view in sync when value changes externally
  useEffect(() => {
    if (value && value !== 'All' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split('-').map(Number);
      if (!isNaN(y) && !isNaN(m)) {
        setViewYear(y);
        setViewMonth(m - 1);
      }
    }
  }, [value]);

  // Close popup on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Format date display label
  const getFormattedLabel = () => {
    if (value === 'All') return 'All Dates';
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return placeholder;

    const [y, m, d] = value.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    if (isNaN(dateObj.getTime())) return value;

    const dateFormatted = dateObj.toLocaleDateString('en-GB', {
      weekday: onlyTuesdays ? 'short' : undefined,
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    if (value === todayStr) {
      return `Today (${dateFormatted})`;
    }
    return dateFormatted;
  };

  // Calendar day calculation helpers
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfWeek = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((prev) => prev - 1);
    } else {
      setViewMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((prev) => prev + 1);
    } else {
      setViewMonth((prev) => prev + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    const monthStr = String(viewMonth + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const selected = `${viewYear}-${monthStr}-${dayStr}`;
    onChange(selected);
    setIsOpen(false);
  };

  const isBlockedTuesday = (d: Date) => {
    if (!blockTuesdays) return false;
    if (d.getDay() !== 2) return false;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dayStr = String(d.getDate()).padStart(2, '0');
    const formatted = `${y}-${m}-${dayStr}`;
    return !effectiveAllowedTuesdays.includes(formatted);
  };

  const handlePrevDayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    let base = value && value !== 'All' && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(value + 'T00:00:00')
      : new Date();
    
    if (onlyTuesdays) {
      base.setDate(base.getDate() - 7);
    } else {
      base.setDate(base.getDate() - 1);
      if (isBlockedTuesday(base)) {
        base.setDate(base.getDate() - 1);
      }
    }
    const y = base.getFullYear();
    const m = String(base.getMonth() + 1).padStart(2, '0');
    const d = String(base.getDate()).padStart(2, '0');
    onChange(`${y}-${m}-${d}`);
  };

  const handleNextDayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    let base = value && value !== 'All' && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(value + 'T00:00:00')
      : new Date();
    
    if (onlyTuesdays) {
      base.setDate(base.getDate() + 7);
    } else {
      base.setDate(base.getDate() + 1);
      if (isBlockedTuesday(base)) {
        base.setDate(base.getDate() + 1);
      }
    }
    const y = base.getFullYear();
    const m = String(base.getMonth() + 1).padStart(2, '0');
    const d = String(base.getDate()).padStart(2, '0');
    onChange(`${y}-${m}-${d}`);
  };

  // Build grid matrix
  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDayOfWeek = getFirstDayOfWeek(viewYear, viewMonth);
  const prevMonthDays = getDaysInMonth(viewYear, viewMonth - 1 < 0 ? 11 : viewMonth - 1);

  const sizeClasses = {
    sm: 'px-2.5 py-1 text-xs rounded-lg h-[32px] max-h-[36px]',
    md: 'px-3 py-1 text-xs rounded-lg h-[36px] max-h-[36px]',
    lg: 'px-3.5 py-1 text-xs rounded-lg h-[36px] max-h-[36px]',
  };

  const isFullWidth = className.includes('w-full');

  return (
    <div ref={containerRef} className={`relative ${isFullWidth ? 'w-full block' : 'inline-block'} ${className}`}>
      {/* Date Trigger Field */}
      <div className={`flex items-center gap-1 ${isFullWidth ? 'w-full' : ''}`}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center justify-between gap-2 bg-white border border-slate-300 hover:border-[#02626D] text-slate-800 font-semibold transition-all shadow-2xs cursor-pointer ${
            isFullWidth ? 'w-full' : ''
          } ${sizeClasses[size]} ${isOpen ? 'border-[#02626D] ring-2 ring-[#02626D]/10' : ''}`}
        >
          <div className="flex items-center gap-2 truncate">
            <CalendarIcon size={14} className="text-[#02626D] flex-shrink-0" />
            <span className="truncate">{getFormattedLabel()}</span>
          </div>

          <div className="flex items-center gap-0.5 ml-1 border-l border-slate-200 pl-1 flex-shrink-0">
            <span
              onClick={handlePrevDayClick}
              className="text-slate-400 hover:text-[#02626D] p-0.5 rounded hover:bg-slate-100 transition-colors"
              title={onlyTuesdays ? 'Previous Tuesday' : 'Previous Day'}
            >
              <ChevronLeft size={13} />
            </span>
            <span
              onClick={handleNextDayClick}
              className="text-slate-400 hover:text-[#02626D] p-0.5 rounded hover:bg-slate-100 transition-colors"
              title={onlyTuesdays ? 'Next Tuesday' : 'Next Day'}
            >
              <ChevronRight size={13} />
            </span>
          </div>
        </button>
      </div>

      {/* Floating Custom Calendar Popover */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 w-72 bg-white border border-slate-200/90 rounded-2xl shadow-xl z-50 p-4 animate-in fade-in zoom-in-95 duration-100 font-sans">
          
          {/* Calendar Header (Month/Year & Prev/Next Nav) */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
            <div className="flex items-center gap-1">
              <span className="font-extrabold text-sm text-slate-900">
                {MONTH_NAMES[viewMonth]} {viewYear}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                title="Previous Month"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                title="Next Month"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Days of Week Row */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {DAY_NAMES.map((d) => (
              <span key={d} className="text-[11px] font-bold text-slate-400">
                {d}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {/* Empty slots for previous month */}
            {Array.from({ length: firstDayOfWeek }).map((_, idx) => {
              const dayNum = prevMonthDays - firstDayOfWeek + idx + 1;
              return (
                <span
                  key={`prev-${idx}`}
                  className="h-8 flex items-center justify-center text-xs font-semibold text-slate-300 pointer-events-none"
                >
                  {dayNum}
                </span>
              );
            })}

            {/* Days of current month */}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const day = idx + 1;
              const monthStr = String(viewMonth + 1).padStart(2, '0');
              const dayStr = String(day).padStart(2, '0');
              const dateStr = `${viewYear}-${monthStr}-${dayStr}`;

              const isSelected = value === dateStr;
              const isToday = todayStr === dateStr;
              const dateObj = new Date(viewYear, viewMonth, day);
              const isTuesday = dateObj.getDay() === 2;
              const isAllowedTuesday = isTuesday && effectiveAllowedTuesdays.includes(dateStr);

              // If only Tuesdays mode (e.g. Tuesday Override picker)
              if (onlyTuesdays) {
                if (!isTuesday) {
                  return (
                    <span
                      key={day}
                      className="h-8 w-8 mx-auto flex items-center justify-center rounded-xl text-xs font-medium text-slate-300 bg-slate-50/30 cursor-not-allowed select-none"
                    >
                      {day}
                    </span>
                  );
                }

                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => handleSelectDay(day)}
                    title={`Tuesday, ${day} ${MONTH_NAMES[viewMonth]} ${viewYear}`}
                    className={`relative h-8 w-8 mx-auto flex items-center justify-center rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#02626D] text-white shadow-xs scale-105'
                        : isToday
                        ? 'bg-teal-100 text-[#02626D] border border-teal-300'
                        : isAllowedTuesday
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100'
                        : 'bg-teal-50/60 text-[#02626D] hover:bg-teal-100 border border-teal-200/70'
                    }`}
                  >
                    {day}
                    {isAllowedTuesday && (
                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-1 ring-white" />
                    )}
                  </button>
                );
              }

              if (blockTuesdays && isTuesday && !isAllowedTuesday) {
                return (
                  <button
                    key={day}
                    type="button"
                    disabled={true}
                    title="Tuesday is a Holiday / Factory Closed"
                    className="h-8 w-8 mx-auto flex items-center justify-center rounded-xl text-xs font-semibold text-slate-300 bg-slate-50/70 cursor-not-allowed line-through select-none"
                  >
                    {day}
                  </button>
                );
              }

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleSelectDay(day)}
                  title={isAllowedTuesday ? 'Special Tuesday Enabled (Open for Orders)' : undefined}
                  className={`relative h-8 w-8 mx-auto flex items-center justify-center rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#02626D] text-white shadow-xs scale-105'
                      : isToday
                      ? 'bg-teal-50 text-[#02626D] border border-teal-200 font-extrabold'
                      : isAllowedTuesday
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 font-extrabold'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {day}
                  {isAllowedTuesday && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-1 ring-white" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Calendar Action Footer */}
          <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-3 gap-2 flex-wrap">
            {onlyTuesdays ? (
              <span className="text-[10px] font-bold text-[#02626D] bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                Tuesdays Only
              </span>
            ) : blockTuesdays ? (
              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                Tuesdays: Closed
              </span>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onChange(todayStr);
                  setIsOpen(false);
                }}
                className="px-2.5 py-1 rounded-lg bg-teal-50 text-[#02626D] text-xs font-bold hover:bg-teal-100 transition-colors cursor-pointer"
              >
                Today
              </button>
            )}

            {allowAll && (
              <button
                type="button"
                onClick={() => {
                  onChange('All');
                  setIsOpen(false);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  value === 'All'
                    ? 'bg-[#02626D] text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                All Dates
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-xs text-slate-400 hover:text-slate-600 font-semibold cursor-pointer ml-auto"
            >
              Close
            </button>
          </div>

        </div>
      )}
    </div>
  );
}

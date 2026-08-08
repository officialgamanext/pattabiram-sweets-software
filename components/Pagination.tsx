'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({
  currentPage,
  totalItems,
  pageSize = 45,
  onPageChange,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  if (totalItems <= 0) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(totalItems, currentPage * pageSize);

  return (
    <div className="bg-white px-4 py-3 border-t border-slate-200/90 flex items-center justify-between gap-3 text-xs text-slate-600 font-sans select-none">
      {/* Items count summary */}
      <div>
        Showing <span className="font-bold text-slate-900">{startItem}</span> to{' '}
        <span className="font-bold text-slate-900">{endItem}</span> of{' '}
        <span className="font-bold text-slate-900">{totalItems}</span> items (45 per page)
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:hover:bg-white cursor-pointer disabled:cursor-not-allowed flex items-center gap-1 font-semibold transition-colors shadow-2xs"
        >
          <ChevronLeft size={15} />
          <span>Previous</span>
        </button>

        {/* Page indicator pill */}
        <div className="px-3 py-1 font-mono text-xs font-bold text-slate-800 bg-slate-100 rounded-lg border border-slate-200">
          Page {currentPage} of {totalPages}
        </div>

        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages}
          className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:hover:bg-white cursor-pointer disabled:cursor-not-allowed flex items-center gap-1 font-semibold transition-colors shadow-2xs"
        >
          <span>Next</span>
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}

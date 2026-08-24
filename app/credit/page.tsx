import { Suspense } from 'react';
import CreditClient from '@/components/CreditClient';

export const metadata = {
  title: 'Credit & Due Balances — Pattabiram Sweets',
  description: 'Track outstanding balances, partial orders, customer credit ledgers, and split payment recovery analytics.',
};

export default function CreditPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full min-h-screen bg-[#f6f6f7] flex items-center justify-center p-8 text-slate-500">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <div className="w-4 h-4 border-2 border-[#02626D] border-t-transparent rounded-full animate-spin" />
            <span>Loading Credit Ledger...</span>
          </div>
        </div>
      }
    >
      <CreditClient />
    </Suspense>
  );
}

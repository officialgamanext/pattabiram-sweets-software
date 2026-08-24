import { Suspense } from 'react';
import PosPricesClient from '@/components/PosPricesClient';

export const metadata = {
  title: 'Billing & POS Prices — Pattabiram Sweets',
  description: 'Manage and synchronize live retail counter selling prices for Billing & POS.',
};

export default function PosPricesPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full min-h-screen bg-[#f6f6f7] flex items-center justify-center p-8 text-slate-500">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <div className="w-4 h-4 border-2 border-[#02626D] border-t-transparent rounded-full animate-spin" />
            <span>Loading Billing &amp; POS Prices...</span>
          </div>
        </div>
      }
    >
      <PosPricesClient />
    </Suspense>
  );
}

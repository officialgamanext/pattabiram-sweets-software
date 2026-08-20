import { Suspense } from 'react';
import CreateOrderClient from '@/components/CreateOrderClient';

export const metadata = {
  title: 'Create Order — Pattabiram Sweets',
};

export default function CreateOrderPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full min-h-screen bg-[#f6f6f7] flex items-center justify-center p-8 text-slate-500">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <div className="w-4 h-4 border-2 border-[#02626D] border-t-transparent rounded-full animate-spin" />
            <span>Loading Order Form...</span>
          </div>
        </div>
      }
    >
      <CreateOrderClient />
    </Suspense>
  );
}

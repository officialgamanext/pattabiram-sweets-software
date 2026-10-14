import { Suspense } from 'react';
import FestivalBoxesClient from '@/components/FestivalBoxesClient';

export const metadata = {
  title: 'Festival Boxes — Pattabiram Sweets',
  description: 'Design custom festival gift boxes with row and column compartment layouts.',
};

export default function FestivalBoxesPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full min-h-screen bg-[#f7f7f8] flex items-center justify-center p-8 text-slate-500">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <div className="w-4 h-4 border-2 border-[#02626D] border-t-transparent rounded-full animate-spin" />
            <span>Loading Festival Boxes...</span>
          </div>
        </div>
      }
    >
      <FestivalBoxesClient />
    </Suspense>
  );
}

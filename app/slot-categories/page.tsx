import type { Metadata } from 'next';
import SlotCategoriesClient from '@/components/SlotCategoriesClient';

export const metadata: Metadata = {
  title: 'Slot Categories & Limits — Pattabiram Sweets',
  description: 'Manage category-level product groupings, assign items, and configure slot-wise capacity limits.',
};

export default function SlotCategoriesPage() {
  return <SlotCategoriesClient />;
}

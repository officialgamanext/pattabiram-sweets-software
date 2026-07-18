import ComingSoonPage from '@/components/ComingSoonPage';

export const metadata = { title: 'Orders — Pattabiram Sweets' };

export default function OrdersPage() {
  return (
    <ComingSoonPage
      title="Orders"
      description="Manage all your customer orders — track order status, process new orders, view order history, and handle returns effortlessly."
      icon={<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>}
      color="#6366f1" bg="#eef2ff"
    />
  );
}

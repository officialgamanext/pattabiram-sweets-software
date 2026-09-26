import WholesalerOrderDetailClient from '@/components/WholesalerOrderDetailClient';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  return {
    title: `Wholesale Order ${id} — Pattabiram Sweets`,
    description: `Detailed wholesale order view and payment installment management for order ${id}.`,
  };
}

export default async function WholesalerOrderDetailPage({ params }: Props) {
  const { id } = await params;
  return <WholesalerOrderDetailClient orderId={id} />;
}

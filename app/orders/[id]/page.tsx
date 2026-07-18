import OrderDetailClient from '@/components/OrderDetailClient';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  return {
    title: `Order Details — Pattabiram Sweets`,
  };
}

export default async function OrderDetailPage({ params }: Props) {
  const { id } = await params;
  return <OrderDetailClient orderId={id} />;
}

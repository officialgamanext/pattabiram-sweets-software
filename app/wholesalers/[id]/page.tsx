import WholesalerDetailClient from '@/components/WholesalerDetailClient';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  return {
    title: `Wholesaler Profile & Ledger — Pattabiram Sweets`,
    description: `Wholesaler profile details, order history, credit balance, and payment collection for wholesaler ID ${id}.`,
  };
}

export default async function WholesalerDetailPage({ params }: Props) {
  const { id } = await params;
  return <WholesalerDetailClient wholesalerId={id} />;
}

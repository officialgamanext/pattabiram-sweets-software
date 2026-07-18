import UnitManagementClient from '@/components/UnitManagementClient';

export const metadata = {
  title: 'Packing Unit — Pattabiram Sweets',
  description: 'Manage packing units, contact details, addresses, and unit operational statuses.',
};

export default function PackingPage() {
  return (
    <UnitManagementClient
      unitType="packing"
      title="Packing Unit"
      collectionName="packing_units"
      codePrefix="PCK"
    />
  );
}

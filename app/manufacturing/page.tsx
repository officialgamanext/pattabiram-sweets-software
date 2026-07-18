import UnitManagementClient from '@/components/UnitManagementClient';

export const metadata = {
  title: 'Manufacturing Unit — Pattabiram Sweets',
  description: 'Manage manufacturing units, track factory locations, mobile contacts, and operational statuses.',
};

export default function ManufacturingPage() {
  return (
    <UnitManagementClient
      unitType="manufacturing"
      title="Manufacturing Unit"
      collectionName="manufacturing_units"
      codePrefix="MFG"
    />
  );
}

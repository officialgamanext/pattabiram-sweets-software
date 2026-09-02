import { Metadata } from 'next';
import AuditLogsClient from '@/components/AuditLogsClient';

export const metadata: Metadata = {
  title: 'Audit Logs & Cash Handover | Pattabiram Sweets',
  description: 'Employee activity audit logs, cash in hand tracking, and cash handover management',
};

export default function AuditLogsPage() {
  return <AuditLogsClient />;
}

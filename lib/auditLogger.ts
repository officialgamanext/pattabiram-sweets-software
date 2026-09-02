import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export interface AuditLogEntry {
  id?: string;
  action: string; // e.g. 'Order Created', 'Payment Received', 'Cash Handover', 'Order Updated', 'Status Changed'
  actionType: 'order_created' | 'payment_received' | 'cash_handover' | 'order_updated' | 'status_changed' | 'order_deleted' | 'b2b_order_created' | 'walk_in_sale' | 'pos_sale' | 'general';
  description: string;
  employeeId: string;
  employeeName: string;
  employeeCode?: string;
  employeeRole?: string;
  date?: string; // 'YYYY-MM-DD'
  timestamp?: any;
  orderId?: string;
  orderCode?: string;
  customerName?: string;
  customerPhone?: string;
  amount?: number;
  cashAmount?: number;
  paymentMode?: 'Cash' | 'UPI' | 'Card' | 'Split' | 'Other' | string;
  isCash?: boolean;
  
  // For Cash Handover events:
  recipientId?: string;
  recipientName?: string;
  recipientPhone?: string;
  recipientRole?: string;
  handoverPurpose?: string;
  notes?: string;
  metadata?: Record<string, any>;
  createdAt?: any;
}

export async function logAuditEvent(params: Omit<AuditLogEntry, 'id' | 'createdAt'>) {
  try {
    const todayStr = params.date || new Date().toISOString().split('T')[0];
    await addDoc(collection(db, 'audit_logs'), {
      ...params,
      date: todayStr,
      isCash: (params.cashAmount || 0) > 0 || params.paymentMode === 'Cash' || params.actionType === 'cash_handover',
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error('Failed to write audit log to Firestore:', err);
  }
}

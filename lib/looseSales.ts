'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { logAuditEvent } from '@/lib/auditLogger';

export interface LooseSaleRecord {
  id: string;
  amount: number;
  employeeId: string;
  employeeName: string;
  employeeRole?: string;
  employeeCode?: string;
  paymentMode: 'Cash' | 'UPI' | 'Card' | 'Split';
  splitCash?: number;
  splitUpi?: number;
  splitCard?: number;
  note?: string;
  notes?: string;
  customerName?: string;
  date: string; // 'YYYY-MM-DD'
  dateStr?: string;
  time?: string; // 'HH:MM AM/PM'
  createdAt?: any;
  updatedAt?: any;
  createdBy?: string;
  createdByName?: string;
}

/**
 * React hook to subscribe to loose sales in real-time
 */
export function useLooseSales() {
  const [sales, setSales] = useState<LooseSaleRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'loose_sales'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list: LooseSaleRecord[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          const noteVal = data.notes || data.note || '';
          const dateVal = data.date || data.dateStr || (data.createdAt?.toDate ? data.createdAt.toDate().toISOString().split('T')[0] : '');
          return {
            id: docSnap.id,
            amount: parseFloat(data.amount || 0),
            employeeId: data.employeeId || '',
            employeeName: data.employeeName || 'Staff',
            employeeRole: data.employeeRole || 'Staff',
            employeeCode: data.employeeCode || '',
            paymentMode: data.paymentMode || 'Cash',
            splitCash: data.splitCash ? parseFloat(data.splitCash) : 0,
            splitUpi: data.splitUpi ? parseFloat(data.splitUpi) : 0,
            splitCard: data.splitCard ? parseFloat(data.splitCard) : 0,
            note: noteVal,
            notes: noteVal,
            customerName: data.customerName || '',
            date: dateVal,
            dateStr: dateVal,
            time: data.time || '',
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            createdBy: data.createdBy,
            createdByName: data.createdByName,
          };
        });
        setSales(list);
        setIsLoading(false);
      },
      (err) => {
        console.error('Error listening to loose_sales:', err);
        setError(err.message);
        setIsLoading(false);
      }
    );

    return () => unsub();
  }, []);

  return { sales, isLoading, loading: isLoading, error };
}

export type CurrentUserInfo = {
  uid?: string;
  email?: string;
  name?: string;
  id?: string;
  role?: string;
};

/**
 * Add a new loose sale transaction
 */
export async function addLooseSale(
  params: {
    amount: number;
    employeeId: string;
    employeeName: string;
    employeeRole?: string;
    employeeCode?: string;
    paymentMode: 'Cash' | 'UPI' | 'Card' | 'Split';
    splitCash?: number;
    splitUpi?: number;
    splitCard?: number;
    note?: string;
    notes?: string;
    customerName?: string;
    date?: string;
  },
  currentUser: CurrentUserInfo
): Promise<string> {
  const now = new Date();
  const dateStr = params.date || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const userId = currentUser.id || currentUser.uid || 'admin';
  const userName = currentUser.name || (currentUser.email ? currentUser.email.split('@')[0] : 'Admin');
  const userRole = currentUser.role || 'Staff';

  const payload = {
    amount: Number(params.amount),
    employeeId: params.employeeId,
    employeeName: params.employeeName,
    employeeRole: params.employeeRole || 'Staff',
    employeeCode: params.employeeCode || '',
    paymentMode: params.paymentMode,
    splitCash: Number(params.splitCash || 0),
    splitUpi: Number(params.splitUpi || 0),
    splitCard: Number(params.splitCard || 0),
    note: (params.notes || params.note || '').trim(),
    notes: (params.notes || params.note || '').trim(),
    customerName: (params.customerName || '').trim(),
    date: dateStr,
    dateStr: dateStr,
    time: timeStr,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: userId,
    createdByName: userName,
  };

  const docRef = await addDoc(collection(db, 'loose_sales'), payload);

  // Audit Log
  try {
    await logAuditEvent({
      action: 'Loose Sale Recorded',
      actionType: 'general',
      description: `Recorded ₹${params.amount.toFixed(2)} loose sale for ${params.employeeName} via ${params.paymentMode}. Note: "${payload.note || 'None'}"`,
      employeeId: params.employeeId || userId,
      employeeName: params.employeeName || userName,
      employeeRole: params.employeeRole || userRole,
      amount: params.amount,
      cashAmount: params.paymentMode === 'Cash' ? params.amount : params.paymentMode === 'Split' ? (params.splitCash || 0) : 0,
      paymentMode: params.paymentMode,
      date: dateStr,
      metadata: { looseSaleId: docRef.id, ...params },
    });
  } catch (err) {
    console.warn('Failed to write loose sale audit log:', err);
  }

  return docRef.id;
}

/**
 * Update an existing loose sale transaction
 */
export async function updateLooseSale(
  id: string,
  params: Partial<LooseSaleRecord>,
  currentUser: CurrentUserInfo
): Promise<void> {
  const docRef = doc(db, 'loose_sales', id);
  await updateDoc(docRef, {
    ...params,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete a loose sale transaction
 */
export async function deleteLooseSale(
  id: string,
  record: LooseSaleRecord,
  currentUser: CurrentUserInfo
): Promise<void> {
  const docRef = doc(db, 'loose_sales', id);
  await deleteDoc(docRef);

  const userId = currentUser.id || currentUser.uid || 'admin';
  const userName = currentUser.name || (currentUser.email ? currentUser.email.split('@')[0] : 'Admin');

  try {
    await logAuditEvent({
      action: 'Loose Sale Deleted',
      actionType: 'general',
      description: `Deleted loose sale entry ID [${id}]`,
      employeeId: userId,
      employeeName: userName,
      employeeRole: 'Staff',
    });
  } catch (err) {
    console.warn('Failed to log loose sale delete audit event:', err);
  }
}

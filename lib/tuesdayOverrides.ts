'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { logAuditEvent } from '@/lib/auditLogger';

export interface TuesdayOverride {
  id: string; // Document ID: 'YYYY-MM-DD'
  date: string; // 'YYYY-MM-DD'
  reason: string;
  status: 'enabled' | 'disabled';
  enabledAt?: any;
  enabledBy?: string;
  enabledByName?: string;
  disabledAt?: any;
  disabledBy?: string;
  disabledByName?: string;
  createdAt?: any;
  updatedAt?: any;
}

// In-memory runtime cache for instantaneous synchronous lookups
let runtimeAllowedTuesdaysCache: string[] = [];
let runtimeOverridesCache: TuesdayOverride[] = [];

// Load from localStorage if in browser
if (typeof window !== 'undefined') {
  try {
    const saved = localStorage.getItem('pattabiram_allowed_tuesdays');
    if (saved) {
      runtimeAllowedTuesdaysCache = JSON.parse(saved);
    }
  } catch (e) {
    // Ignore error
  }
}

/**
 * Returns currently enabled Tuesday date strings synchronously: e.g. ['2026-09-15', '2026-10-20']
 */
export function getEnabledTuesdaysSync(): string[] {
  return runtimeAllowedTuesdaysCache;
}

/**
 * Synchronous check if a given date string is an enabled Tuesday (or not a Tuesday)
 */
export function isTuesdayAllowedSync(dateStr: string): boolean {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return true;
  const [y, m, d] = dateStr.split('-').map(Number);
  const isTuesday = new Date(y, m - 1, d).getDay() === 2;
  if (!isTuesday) return true; // Non-tuesdays are always allowed
  return runtimeAllowedTuesdaysCache.includes(dateStr);
}

/**
 * React hook to listen to Tuesday overrides in real-time from Firestore
 */
export function useAllowedTuesdays() {
  const [allowedDates, setAllowedDates] = useState<string[]>(runtimeAllowedTuesdaysCache);
  const [overrides, setOverrides] = useState<TuesdayOverride[]>(runtimeOverridesCache);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const q = query(collection(db, 'tuesday_overrides'), orderBy('date', 'desc'));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list: TuesdayOverride[] = [];
        const enabledDates: string[] = [];

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const item: TuesdayOverride = {
            date: data.date || docSnap.id,
            reason: data.reason || '',
            status: data.status || 'enabled',
            enabledAt: data.enabledAt,
            enabledBy: data.enabledBy,
            enabledByName: data.enabledByName,
            disabledAt: data.disabledAt,
            disabledBy: data.disabledBy,
            disabledByName: data.disabledByName,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            id: docSnap.id,
          };
          list.push(item);
          if (item.status === 'enabled') {
            enabledDates.push(item.date);
          }
        });

        runtimeAllowedTuesdaysCache = enabledDates;
        runtimeOverridesCache = list;
        setAllowedDates(enabledDates);
        setOverrides(list);
        setIsLoading(false);

        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('pattabiram_allowed_tuesdays', JSON.stringify(enabledDates));
          } catch (e) {}
        }
      },
      (error) => {
        console.error('Error listening to tuesday_overrides:', error);
        setIsLoading(false);
      }
    );

    return () => unsub();
  }, []);

  return { allowedDates, overrides, isLoading };
}

/**
 * Enable/Unlock a specific Tuesday date for orders & manufacturing
 */
export async function enableTuesdayOverride(
  date: string,
  reason: string,
  currentUser: { uid?: string; email?: string; name?: string; id?: string }
): Promise<void> {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('Invalid date format. Expected YYYY-MM-DD.');
  }

  const [y, m, d] = date.split('-').map(Number);
  const dayOfWeek = new Date(y, m - 1, d).getDay();
  if (dayOfWeek !== 2) {
    throw new Error('Selected date is not a Tuesday.');
  }

  const docRef = doc(db, 'tuesday_overrides', date);
  const userName = currentUser.name || currentUser.email || 'Admin';
  const userId = currentUser.id || currentUser.uid || 'admin';

  const overrideData: TuesdayOverride = {
    id: date,
    date,
    reason: reason.trim() || 'Special Business Operations / Festival Opening',
    status: 'enabled',
    enabledAt: serverTimestamp(),
    enabledBy: userId,
    enabledByName: userName,
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  };

  await setDoc(docRef, overrideData, { merge: true });

  // Update in-memory cache immediately
  if (!runtimeAllowedTuesdaysCache.includes(date)) {
    runtimeAllowedTuesdaysCache.push(date);
  }

  // Audit logging
  try {
    await logAuditEvent({
      action: 'Tuesday Override Enabled',
      actionType: 'general',
      description: `Enabled Tuesday [${date}] for orders and manufacturing. Reason: "${overrideData.reason}"`,
      employeeId: userId,
      employeeName: userName,
      employeeRole: 'Admin',
      metadata: { date, reason: overrideData.reason },
    });
  } catch (err) {
    console.warn('Failed to log Tuesday override audit event:', err);
  }
}

/**
 * Disable/Revoke a Tuesday override (re-blocks that Tuesday)
 */
export async function disableTuesdayOverride(
  date: string,
  currentUser: { uid?: string; email?: string; name?: string; id?: string }
): Promise<void> {
  if (!date) return;

  const docRef = doc(db, 'tuesday_overrides', date);
  const userName = currentUser.name || currentUser.email || 'Admin';
  const userId = currentUser.id || currentUser.uid || 'admin';

  await setDoc(
    docRef,
    {
      status: 'disabled',
      disabledAt: serverTimestamp(),
      disabledBy: userId,
      disabledByName: userName,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  // Update in-memory cache immediately
  runtimeAllowedTuesdaysCache = runtimeAllowedTuesdaysCache.filter((d) => d !== date);

  // Audit logging
  try {
    await logAuditEvent({
      action: 'Tuesday Override Revoked',
      actionType: 'general',
      description: `Revoked Tuesday override for [${date}]. Tuesday is now blocked again.`,
      employeeId: userId,
      employeeName: userName,
      employeeRole: 'Admin',
      metadata: { date },
    });
  } catch (err) {
    console.warn('Failed to log Tuesday override audit event:', err);
  }
}

/**
 * Delete a Tuesday override record entirely
 */
export async function deleteTuesdayOverride(
  date: string,
  currentUser?: { uid?: string; email?: string; name?: string; id?: string }
): Promise<void> {
  if (!date) return;

  const docRef = doc(db, 'tuesday_overrides', date);
  await deleteDoc(docRef);

  runtimeAllowedTuesdaysCache = runtimeAllowedTuesdaysCache.filter((d) => d !== date);
}

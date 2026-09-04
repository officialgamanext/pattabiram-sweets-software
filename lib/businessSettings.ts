'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';

export interface BusinessSettings {
  businessName: string;
  mobile: string;
  alternateMobile?: string;
  address: string;
  city?: string;
  state?: string;
  pincode?: string;
  gstNumber: string;
  email: string;
  tagline?: string;
  fssaiNumber?: string;
  website?: string;
  footerNote?: string;
  updatedAt?: any;
  updatedBy?: string;
  updatedByName?: string;
}

export const DEFAULT_BUSINESS_SETTINGS: BusinessSettings = {
  businessName: 'Pattabiram Sweets',
  mobile: '9840000000',
  alternateMobile: '',
  address: 'No. 12, Main Bazaar Road, Pattabiram, Chennai, Tamil Nadu',
  city: 'Chennai',
  state: 'Tamil Nadu',
  pincode: '600072',
  gstNumber: '33AAAAA0000A1Z5',
  email: 'contact@pattabiramsweets.com',
  tagline: 'Traditional Taste & Premium Quality Sweets',
  fssaiNumber: '12419008000123',
  website: 'https://pattabiramsweets.com',
  footerNote: 'Thank you for choosing Pattabiram Sweets! Visit again!',
};

// In-memory runtime cache for instantaneous access
let runtimeSettingsCache: BusinessSettings = { ...DEFAULT_BUSINESS_SETTINGS };

// Load cache from localStorage if running in browser
if (typeof window !== 'undefined') {
  try {
    const saved = localStorage.getItem('pattabiram_business_settings');
    if (saved) {
      runtimeSettingsCache = {
        ...DEFAULT_BUSINESS_SETTINGS,
        ...JSON.parse(saved),
      };
    }
  } catch (e) {
    // Ignore JSON error
  }
}

/**
 * Returns current business settings synchronously from fast cache
 */
export function getBusinessSettingsSync(): BusinessSettings {
  return runtimeSettingsCache;
}

/**
 * Fetches latest business settings asynchronously from Firestore
 */
export async function getBusinessSettings(): Promise<BusinessSettings> {
  try {
    const docRef = doc(db, 'settings', 'business');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as BusinessSettings;
      runtimeSettingsCache = {
        ...DEFAULT_BUSINESS_SETTINGS,
        ...data,
      };
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('pattabiram_business_settings', JSON.stringify(runtimeSettingsCache));
        } catch (e) {}
      }
      return runtimeSettingsCache;
    }
  } catch (err) {
    console.error('Error fetching business settings from Firestore:', err);
  }
  return runtimeSettingsCache;
}

/**
 * Format address into single string with city and pincode
 */
export function formatStoreAddress(settings?: BusinessSettings): string {
  const s = settings || runtimeSettingsCache;
  const parts: string[] = [];
  if (s.address) parts.push(s.address.trim());
  if (s.city && !s.address?.toLowerCase().includes(s.city.toLowerCase())) parts.push(s.city.trim());
  if (s.pincode && !s.address?.includes(s.pincode)) parts.push(s.pincode.trim());
  return parts.join(', ') || 'No. 12, Main Bazaar Road, Pattabiram, Chennai - 600072';
}

/**
 * Format phone string with alternate contact
 */
export function formatStorePhone(settings?: BusinessSettings): string {
  const s = settings || runtimeSettingsCache;
  const phones: string[] = [];
  if (s.mobile) phones.push(s.mobile.trim());
  if (s.alternateMobile) phones.push(s.alternateMobile.trim());
  return phones.join(', ') || '9840000000';
}

/**
 * React hook to subscribe to business settings in real-time
 */
export function useBusinessSettings() {
  const [settings, setSettings] = useState<BusinessSettings>(runtimeSettingsCache);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const docRef = doc(db, 'settings', 'business');
    const unsub = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as BusinessSettings;
          const merged: BusinessSettings = {
            ...DEFAULT_BUSINESS_SETTINGS,
            ...data,
          };
          runtimeSettingsCache = merged;
          setSettings(merged);
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem('pattabiram_business_settings', JSON.stringify(merged));
            } catch (e) {}
          }
        } else {
          setSettings(DEFAULT_BUSINESS_SETTINGS);
        }
        setIsLoading(false);
      },
      (error) => {
        console.error('Error in useBusinessSettings listener:', error);
        setIsLoading(false);
      }
    );

    return () => unsub();
  }, []);

  return { settings, isLoading };
}

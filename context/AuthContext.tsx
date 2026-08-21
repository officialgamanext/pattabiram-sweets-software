'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { getMergedEmployeePermissions, MenuAccessPermission } from '@/lib/menuConstants';

export interface EmployeeAuthProfile {
  id: string;
  empId: string;
  name: string;
  mobile: string;
  department?: string;
  photoUrl?: string;
  isSuperAdmin?: boolean;
  assignedMfgUnits?: string[];
  assignedPckUnits?: string[];
  permissions: Record<string, MenuAccessPermission>;
}

interface AuthContextType {
  user: User | null;
  employeeProfile: EmployeeAuthProfile | null;
  loading: boolean;
  setEmployeeProfileByMobile: (mobile: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  employeeProfile: null,
  loading: true,
  setEmployeeProfileByMobile: async () => ({ success: false }),
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [employeeProfile, setEmployeeProfile] = useState<EmployeeAuthProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Restore stored employee session from localStorage if available
  useEffect(() => {
    const stored = localStorage.getItem('employee_auth_session');
    if (stored) {
      try {
        setEmployeeProfile(JSON.parse(stored));
      } catch {}
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser && currentUser.email) {
        // SuperAdmin Email Login: full admin access across all menus
        const fullPerms = getMergedEmployeePermissions([]);
        Object.keys(fullPerms).forEach((k) => {
          fullPerms[k].view = true;
          fullPerms[k].edit = true;
        });

        const adminProf: EmployeeAuthProfile = {
          id: 'superadmin',
          empId: 'ADMIN-001',
          name: currentUser.email.split('@')[0] || 'SuperAdmin',
          mobile: '+91 98765 43210',
          department: 'Management',
          isSuperAdmin: true,
          assignedMfgUnits: ['All'],
          assignedPckUnits: ['All'],
          permissions: fullPerms,
        };
        setEmployeeProfile(adminProf);
        localStorage.setItem('employee_auth_session', JSON.stringify(adminProf));
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const setEmployeeProfileByMobile = (mobile: string): Promise<{ success: boolean; error?: string }> => {
    const cleanMobile = mobile.trim().replace(/\D/g, '');

    return new Promise((resolve) => {
      const unsub = onSnapshot(
        collection(db, 'employees'),
        (snapshot) => {
          unsub();
          const docs = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as any[];

          const matched = docs.find((emp) => {
            const empMobileClean = (emp.mobile || '').replace(/\D/g, '');
            return (
              empMobileClean === cleanMobile ||
              cleanMobile.endsWith(empMobileClean) ||
              empMobileClean.endsWith(cleanMobile)
            );
          });

          if (matched) {
            const mergedPermissions = getMergedEmployeePermissions(matched.permissions);
            const profile: EmployeeAuthProfile = {
              id: matched.id,
              empId: matched.empId || 'EMP-100',
              name: matched.name,
              mobile: matched.mobile,
              department: matched.department || 'Staff',
              photoUrl: matched.photoUrl,
              isSuperAdmin: false,
              assignedMfgUnits: Array.isArray(matched.assignedMfgUnits) ? matched.assignedMfgUnits : ['All'],
              assignedPckUnits: Array.isArray(matched.assignedPckUnits) ? matched.assignedPckUnits : ['All'],
              permissions: mergedPermissions,
            };

            setEmployeeProfile(profile);
            localStorage.setItem('employee_auth_session', JSON.stringify(profile));
            resolve({ success: true });
          } else {
            resolve({
              success: false,
              error: `Access Denied: Mobile number (${mobile}) is not registered in the Employee database. Contact Administrator.`,
            });
          }
        },
        (error) => {
          console.error('Firestore employee lookup error:', error);
          resolve({
            success: false,
            error: 'Failed to connect to Employee database. Please try again.',
          });
        }
      );
    });
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
    }
    setEmployeeProfile(null);
    localStorage.removeItem('employee_auth_session');
  };

  return (
    <AuthContext.Provider value={{ user, employeeProfile, loading, setEmployeeProfileByMobile, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { collection, onSnapshot, doc } from 'firebase/firestore';
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
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object') {
          const mfgUnits = Array.isArray(parsed.assignedMfgUnits) ? parsed.assignedMfgUnits : [];
          const pckUnits = Array.isArray(parsed.assignedPckUnits) ? parsed.assignedPckUnits : [];
          const permissions = parsed.permissions || {};

          if (mfgUnits.length > 0) {
            permissions.manufacturing_portal = {
              menuKey: 'manufacturing_portal',
              menuName: 'Manufacturing Portal',
              view: true,
              edit: true,
            };
          }
          if (pckUnits.length > 0) {
            permissions.packing_portal = {
              menuKey: 'packing_portal',
              menuName: 'Packing Portal',
              view: true,
              edit: true,
            };
          }

          parsed.permissions = permissions;
          setEmployeeProfile(parsed);
        }
      } catch {}
    }
  }, []);

  // Real-time Firestore listener for live permission & unit assignment updates
  useEffect(() => {
    if (!employeeProfile?.id || employeeProfile.isSuperAdmin) return;

    const unsub = onSnapshot(
      doc(db, 'employees', employeeProfile.id),
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        const mergedPermissions = getMergedEmployeePermissions(data.permissions);
        const mfgUnits = Array.isArray(data.assignedMfgUnits) ? data.assignedMfgUnits : [];
        const pckUnits = Array.isArray(data.assignedPckUnits) ? data.assignedPckUnits : [];

        // Auto-grant portal view if employee has assigned units
        if (mfgUnits.length > 0 && mergedPermissions.manufacturing_portal) {
          mergedPermissions.manufacturing_portal.view = true;
        }
        if (pckUnits.length > 0 && mergedPermissions.packing_portal) {
          mergedPermissions.packing_portal.view = true;
        }

        const updatedProfile: EmployeeAuthProfile = {
          id: snap.id,
          empId: data.empId || employeeProfile.empId || 'EMP-100',
          name: data.name || employeeProfile.name,
          mobile: data.mobile || employeeProfile.mobile,
          department: data.department || employeeProfile.department || 'Staff',
          photoUrl: data.photoUrl || employeeProfile.photoUrl,
          isSuperAdmin: false,
          assignedMfgUnits: mfgUnits,
          assignedPckUnits: pckUnits,
          permissions: mergedPermissions,
        };

        setEmployeeProfile(updatedProfile);
        localStorage.setItem('employee_auth_session', JSON.stringify(updatedProfile));
      },
      (err) => {
        console.error('Real-time employee profile sync error:', err);
      }
    );

    return () => unsub();
  }, [employeeProfile?.id, employeeProfile?.isSuperAdmin]);

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
            const mfgUnits = Array.isArray(matched.assignedMfgUnits) ? matched.assignedMfgUnits : [];
            const pckUnits = Array.isArray(matched.assignedPckUnits) ? matched.assignedPckUnits : [];

            // Auto-grant portal view if employee has assigned units
            if (mfgUnits.length > 0 && mergedPermissions.manufacturing_portal) {
              mergedPermissions.manufacturing_portal.view = true;
            }
            if (pckUnits.length > 0 && mergedPermissions.packing_portal) {
              mergedPermissions.packing_portal.view = true;
            }

            const profile: EmployeeAuthProfile = {
              id: matched.id,
              empId: matched.empId || 'EMP-100',
              name: matched.name,
              mobile: matched.mobile,
              department: matched.department || 'Staff',
              photoUrl: matched.photoUrl,
              isSuperAdmin: false,
              assignedMfgUnits: mfgUnits,
              assignedPckUnits: pckUnits,
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

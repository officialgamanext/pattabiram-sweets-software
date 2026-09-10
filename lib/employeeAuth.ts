import { db } from '@/lib/firebase';
import { collection, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';

export interface EmployeeLookupResult {
  found: boolean;
  error?: string;
  employee?: {
    id: string;
    empId: string;
    name: string;
    mobile: string;
    status: string;
    hasMpin: boolean;
    mpin?: string;
    department?: string;
    photoUrl?: string;
  };
}

/**
 * Normalizes phone number to standard clean 10 digits or with country code
 */
export function cleanPhoneNumber(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Finds an employee in Firestore matching the provided mobile number
 */
export async function findEmployeeByMobile(phone: string): Promise<EmployeeLookupResult> {
  const cleanPhone = cleanPhoneNumber(phone);
  if (!cleanPhone || cleanPhone.length < 10) {
    return { found: false, error: 'Please enter a valid 10-digit mobile number.' };
  }

  try {
    const snap = await getDocs(collection(db, 'employees'));
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];

    const matched = docs.find((emp) => {
      const empPhoneClean = cleanPhoneNumber(emp.mobile || '');
      return (
        empPhoneClean === cleanPhone ||
        cleanPhone.endsWith(empPhoneClean) ||
        empPhoneClean.endsWith(cleanPhone)
      );
    });

    if (!matched) {
      return {
        found: false,
        error: `Mobile number (${phone}) is not registered in the Employee database. Contact Administrator.`,
      };
    }

    if (matched.status === 'inactive') {
      return {
        found: false,
        error: `Employee account for "${matched.name}" is inactive. Contact Administrator.`,
      };
    }

    const storedMpin = (matched.mpin || '').toString().trim();
    const hasMpin = Boolean(storedMpin && storedMpin.length >= 4);

    return {
      found: true,
      employee: {
        id: matched.id,
        empId: matched.empId || 'EMP-100',
        name: matched.name || 'Employee',
        mobile: matched.mobile || phone,
        status: matched.status || 'active',
        hasMpin,
        mpin: storedMpin,
        department: matched.department,
        photoUrl: matched.photoUrl,
      },
    };
  } catch (err: any) {
    console.error('Error looking up employee by mobile:', err);
    return {
      found: false,
      error: 'Failed to access Employee database. Please check connection and try again.',
    };
  }
}

/**
 * Saves or updates an employee's MPIN in Firestore
 */
export async function saveEmployeeMpin(
  employeeId: string,
  mpin: string
): Promise<{ success: boolean; error?: string }> {
  const cleanMpin = mpin.trim();
  if (!/^\d{4}$/.test(cleanMpin)) {
    return { success: false, error: 'MPIN must be exactly 4 numeric digits.' };
  }

  try {
    const empRef = doc(db, 'employees', employeeId);
    await updateDoc(empRef, {
      mpin: cleanMpin,
      mpinUpdatedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (err: any) {
    console.error('Error saving employee MPIN:', err);
    return { success: false, error: err.message || 'Failed to save MPIN to database.' };
  }
}

/**
 * Clears an employee's MPIN in Firestore (allows admin or reset flow to wipe MPIN)
 */
export async function resetEmployeeMpin(
  employeeId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const empRef = doc(db, 'employees', employeeId);
    await updateDoc(empRef, {
      mpin: '',
      mpinUpdatedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (err: any) {
    console.error('Error resetting employee MPIN:', err);
    return { success: false, error: err.message || 'Failed to reset MPIN.' };
  }
}

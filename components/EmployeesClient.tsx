'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Users,
  Plus,
  Search,
  MapPin,
  Camera,
  Phone,
  DollarSign,
  Calendar,
  Building2,
  ChevronRight,
  Edit2,
  Trash2,
  X,
  Check,
  RefreshCw,
  Navigation,
  CheckCircle2,
  AlertCircle,
  Eye,
  UserCheck,
  Award,
  Upload,
  User,
  Lock,
  ShieldCheck,
  Factory,
  Package,
  Boxes,
  HandCoins,
  Wallet,
  Receipt,
  CreditCard,
  ChevronDown,
  ChevronUp,
  History,
  Sparkles,
  PlusCircle,
} from 'lucide-react';
import { db } from '@/lib/firebase';
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy
} from 'firebase/firestore';
import { toast } from '@/context/ToastContext';
import CustomSelect from '@/components/CustomSelect';
import CustomDatePicker from '@/components/CustomDatePicker';
import Pagination from '@/components/Pagination';
import { uploadToImageKit } from '@/lib/imageCompressor';
import {
  APP_MENUS,
  MenuAccessPermission,
  getMergedEmployeePermissions
} from '@/lib/menuConstants';

export type { MenuAccessPermission };

export interface AdvanceInstallment {
  id?: string;
  installmentNumber?: number;
  amount: number;
  monthDue?: string; // 'YYYY-MM'
  paymentDate?: string; // 'YYYY-MM-DD'
  paymentMode?: 'Salary Deduction' | 'Cash' | 'UPI' | 'Bank Transfer';
  note?: string;
  status: 'Pending' | 'Deducted' | 'Paid';
  deductedInPayrollMonth?: string;
  deductedAt?: any;
  type?: 'salary_deduction' | 'manual_installment';
}

export interface EmployeeAdvanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  amount: number;
  date: string; // 'YYYY-MM-DD'
  reason?: string;
  numberOfInstallments?: number;
  monthlyInstallmentAmount?: number;
  installments: AdvanceInstallment[];
  totalRepaid: number;
  remainingBalance: number;
  status: 'Active' | 'Completed' | 'Cancelled';
  createdAt?: any;
  updatedAt?: any;
}

export interface EmployeeRecord {
  id: string;
  empId: string;
  name: string;
  mobile: string;
  salary: number;
  paymentMode: 'monthly' | 'daily';
  acceptedLeaves: number;
  latitude: number;
  longitude: number;
  address: string;
  photoUrl: string;
  department: string;
  status: 'active' | 'inactive';
  permissions?: MenuAccessPermission[];
  assignedMfgUnits?: string[];
  assignedPckUnits?: string[];
  createdAt?: any;
}

export default function EmployeesClient() {
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<string>('all');
  
  // Real-time Units Lists for assignment
  const [mfgUnitsList, setMfgUnitsList] = useState<{ id: string; name: string; code: string }[]>([]);
  const [pckUnitsList, setPckUnitsList] = useState<{ id: string; name: string; code: string }[]>([]);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState<EmployeeRecord | null>(null);
  
  // Form fields
  const [formName, setFormName] = useState('');
  const [formMobile, setFormMobile] = useState('');
  const [formSalary, setFormSalary] = useState('');
  const [formMode, setFormMode] = useState<'monthly' | 'daily'>('monthly');
  const [formLeaves, setFormLeaves] = useState('2');
  const [formLat, setFormLat] = useState('');
  const [formLng, setFormLng] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formDepartment, setFormDepartment] = useState('Production');
  const [formPhotoUrl, setFormPhotoUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDetectingGps, setIsDetectingGps] = useState(false);
  const [formPermissions, setFormPermissions] = useState<Record<string, MenuAccessPermission>>({});
  
  // Assigned Units state for the employee
  const [formAssignedMfgUnits, setFormAssignedMfgUnits] = useState<string[]>(['All']);
  const [formAssignedPckUnits, setFormAssignedPckUnits] = useState<string[]>(['All']);
  
  // Camera capture state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Advance Management state
  const [allAdvances, setAllAdvances] = useState<EmployeeAdvanceRecord[]>([]);
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
  const [selectedAdvanceEmp, setSelectedAdvanceEmp] = useState<EmployeeRecord | null>(null);
  const [advAmount, setAdvAmount] = useState('');
  const [advDate, setAdvDate] = useState(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });
  const [advReason, setAdvReason] = useState('');
  const [isSavingAdv, setIsSavingAdv] = useState(false);

  // Manual Installment state
  const [selectedAdvForInstallmentId, setSelectedAdvForInstallmentId] = useState<string | null>(null);
  const [manualInstAmount, setManualInstAmount] = useState<string>('');
  const [manualInstDate, setManualInstDate] = useState<string>(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });
  const [manualInstMode, setManualInstMode] = useState<string>('Cash');
  const [manualInstNote, setManualInstNote] = useState<string>('');
  const [isSavingManualInst, setIsSavingManualInst] = useState(false);

  // Firestore Sync & Realtime Updates
  useEffect(() => {
    setLoading(true);
    const unsubscribe = onSnapshot(
      collection(db, 'employees'),
      (snapshot) => {
        const list: EmployeeRecord[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<EmployeeRecord, 'id'>)
        }));
        setEmployees(list);
        setLoading(false);
      },
      (err) => {
        console.warn('Firestore subscription warning, falling back to local storage:', err);
        const local = localStorage.getItem('pattabiram_employees');
        setEmployees(local ? JSON.parse(local) : []);
        setLoading(false);
      }
    );

    // Fetch active manufacturing units
    const unsubMfg = onSnapshot(
      collection(db, 'manufacturing_units'),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, name: d.data().name || '', code: d.data().code || '', status: d.data().status }))
          .filter((u) => u.status !== 'Inactive' && u.name);
        setMfgUnitsList(list);
      },
      (err) => console.warn('Error fetching mfg units for assignment:', err)
    );

    // Fetch active packing units
    const unsubPck = onSnapshot(
      collection(db, 'packing_units'),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, name: d.data().name || '', code: d.data().code || '', status: d.data().status }))
          .filter((u) => u.status !== 'Inactive' && u.name);
        setPckUnitsList(list);
      },
      (err) => console.warn('Error fetching pck units for assignment:', err)
    );

    // Fetch employee advances
    const unsubAdvances = onSnapshot(
      collection(db, 'employee_advances'),
      (snap) => {
        const list: EmployeeAdvanceRecord[] = snap.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<EmployeeAdvanceRecord, 'id'>)
        }));
        setAllAdvances(list);
      },
      (err) => console.warn('Error fetching employee advances:', err)
    );

    return () => {
      unsubscribe();
      unsubMfg();
      unsubPck();
      unsubAdvances();
    };
  }, []);

  const saveEmployeesToStateAndStorage = (newList: EmployeeRecord[]) => {
    setEmployees(newList);
    localStorage.setItem('pattabiram_employees', JSON.stringify(newList));
  };

  // Open modal for Create or Edit
  const handleOpenModal = (emp?: EmployeeRecord) => {
    stopCamera();
    if (emp) {
      setEditingEmp(emp);
      setFormName(emp.name);
      setFormMobile(emp.mobile);
      setFormSalary(emp.salary.toString());
      setFormMode(emp.paymentMode);
      setFormLeaves(emp.acceptedLeaves.toString());
      setFormLat(emp.latitude ? emp.latitude.toString() : '');
      setFormLng(emp.longitude ? emp.longitude.toString() : '');
      setFormAddress(emp.address || '');
      setFormDepartment(emp.department || 'Production');
      setFormPhotoUrl(emp.photoUrl || '');

      setFormAssignedMfgUnits(Array.isArray(emp.assignedMfgUnits) && emp.assignedMfgUnits.length > 0 ? emp.assignedMfgUnits : ['All']);
      setFormAssignedPckUnits(Array.isArray(emp.assignedPckUnits) && emp.assignedPckUnits.length > 0 ? emp.assignedPckUnits : ['All']);

      // Load dynamically merged permissions (any new menu added to APP_MENUS automatically appears!)
      setFormPermissions(getMergedEmployeePermissions(emp.permissions));
    } else {
      setEditingEmp(null);
      setFormName('');
      setFormMobile('');
      setFormSalary('');
      setFormMode('monthly');
      setFormLeaves('2');
      setFormLat('13.1189');
      setFormLng('80.0967');
      setFormAddress('');
      setFormDepartment('Production');
      setFormPhotoUrl('');
      setFormAssignedMfgUnits(['All']);
      setFormAssignedPckUnits(['All']);
      setFormPermissions(getMergedEmployeePermissions());
    }
    setIsModalOpen(true);
  };

  const handleToggleMfgUnit = (unitName: string) => {
    if (unitName === 'All') {
      if (formAssignedMfgUnits.includes('All')) {
        setFormAssignedMfgUnits([]);
      } else {
        setFormAssignedMfgUnits(['All']);
        setFormPermissions((prev) => ({
          ...prev,
          manufacturing_portal: {
            menuKey: 'manufacturing_portal',
            menuName: 'Manufacturing Portal',
            view: true,
            edit: prev.manufacturing_portal?.edit ?? false,
          },
        }));
      }
      return;
    }

    setFormAssignedMfgUnits((prev) => {
      const withoutAll = prev.filter((u) => u !== 'All');
      if (withoutAll.includes(unitName)) {
        return withoutAll.filter((u) => u !== unitName);
      } else {
        const next = [...withoutAll, unitName];
        setFormPermissions((p) => ({
          ...p,
          manufacturing_portal: {
            menuKey: 'manufacturing_portal',
            menuName: 'Manufacturing Portal',
            view: true,
            edit: p.manufacturing_portal?.edit ?? false,
          },
        }));
        if (mfgUnitsList.length > 0 && next.length === mfgUnitsList.length) {
          return ['All'];
        }
        return next;
      }
    });
  };

  const handleTogglePckUnit = (unitName: string) => {
    if (unitName === 'All') {
      if (formAssignedPckUnits.includes('All')) {
        setFormAssignedPckUnits([]);
      } else {
        setFormAssignedPckUnits(['All']);
        setFormPermissions((prev) => ({
          ...prev,
          packing_portal: {
            menuKey: 'packing_portal',
            menuName: 'Packing Portal',
            view: true,
            edit: prev.packing_portal?.edit ?? false,
          },
        }));
      }
      return;
    }

    setFormAssignedPckUnits((prev) => {
      const withoutAll = prev.filter((u) => u !== 'All');
      if (withoutAll.includes(unitName)) {
        return withoutAll.filter((u) => u !== unitName);
      } else {
        const next = [...withoutAll, unitName];
        setFormPermissions((p) => ({
          ...p,
          packing_portal: {
            menuKey: 'packing_portal',
            menuName: 'Packing Portal',
            view: true,
            edit: p.packing_portal?.edit ?? false,
          },
        }));
        if (pckUnitsList.length > 0 && next.length === pckUnitsList.length) {
          return ['All'];
        }
        return next;
      }
    });
  };

  const handleCloseModal = () => {
    stopCamera();
    setIsModalOpen(false);
    setEditingEmp(null);
  };

  // Permission toggles
  const handleTogglePermission = (key: string, type: 'view' | 'edit', val: boolean) => {
    setFormPermissions((prev) => {
      const current = prev[key] || { menuKey: key, menuName: APP_MENUS.find((m) => m.key === key)?.name || key, view: false, edit: false };
      const updated = { ...current, [type]: val };
      if (type === 'edit' && val) {
        updated.view = true;
      }
      return { ...prev, [key]: updated };
    });
  };

  const handleSelectAllViewPermissions = () => {
    setFormPermissions((prev) => {
      const updated = { ...prev };
      const allChecked = APP_MENUS.every((m) => prev[m.key]?.view);
      APP_MENUS.forEach((m) => {
        const curr = updated[m.key] || { menuKey: m.key, menuName: m.name, view: false, edit: false };
        updated[m.key] = { ...curr, view: !allChecked };
      });
      return updated;
    });
  };

  const handleSelectAllEditPermissions = () => {
    setFormPermissions((prev) => {
      const updated = { ...prev };
      const allChecked = APP_MENUS.every((m) => prev[m.key]?.edit);
      APP_MENUS.forEach((m) => {
        const curr = updated[m.key] || { menuKey: m.key, menuName: m.name, view: false, edit: false };
        updated[m.key] = { ...curr, edit: !allChecked, view: !allChecked ? true : curr.view };
      });
      return updated;
    });
  };

  // Geolocation detector with live loading spinner
  const handleGetLocation = () => {
    if ('geolocation' in navigator) {
      setIsDetectingGps(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormLat(position.coords.latitude.toFixed(6));
          setFormLng(position.coords.longitude.toFixed(6));
          setIsDetectingGps(false);
          toast.success('GPS Detected', `Coordinates: ${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`);
        },
        (error) => {
          toast.error('GPS Failed', 'Could not retrieve GPS location: ' + error.message);
          setIsDetectingGps(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      toast.warning('Not Supported', 'Geolocation is not supported by your browser.');
    }
  };

  // Camera start / capture / stop logic
  const startCamera = async () => {
    setCameraError('');
    setIsCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err: any) {
      setCameraError('Camera access denied or unavailable: ' + err.message);
      setIsCameraActive(false);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setFormPhotoUrl(dataUrl);
      stopCamera();
    }
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setFormPhotoUrl(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Save Employee Form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formMobile.trim() || !formSalary.trim()) {
      toast.warning('Required Fields Missing', 'Please fill in required fields: Name, Mobile, and Salary Amount.');
      return;
    }

    setIsSaving(true);
    let finalPhotoUrl = formPhotoUrl;

    try {
      // If photo is base64 data URL (from camera capture or file upload), save to ImageKit first!
      if (formPhotoUrl && formPhotoUrl.startsWith('data:image/')) {
        const cleanName = formName.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
        const fileName = `employee_${cleanName}_${Date.now()}.jpg`;

        try {
          finalPhotoUrl = await uploadToImageKit(formPhotoUrl, fileName);
          console.log('Successfully uploaded employee photo to ImageKit:', finalPhotoUrl);
        } catch (imgKitErr: any) {
          console.warn('ImageKit upload warning, using local image data:', imgKitErr);
        }
      }

      if (!finalPhotoUrl) {
        finalPhotoUrl = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80';
      }

      const empPayload = {
        empId: editingEmp ? editingEmp.empId : `EMP-${1000 + employees.length + 1}`,
        name: formName.trim(),
        mobile: formMobile.trim(),
        salary: parseFloat(formSalary) || 0,
        paymentMode: formMode,
        acceptedLeaves: parseInt(formLeaves) || 0,
        latitude: parseFloat(formLat) || 13.1189,
        longitude: parseFloat(formLng) || 80.0967,
        address: formAddress.trim(),
        photoUrl: finalPhotoUrl,
        department: formDepartment,
        status: 'active' as const,
        assignedMfgUnits: formAssignedMfgUnits,
        assignedPckUnits: formAssignedPckUnits,
        permissions: Object.values(formPermissions)
      };

      if (editingEmp) {
        await updateDoc(doc(db, 'employees', editingEmp.id), empPayload);
        const updatedList = employees.map((emp) =>
          emp.id === editingEmp.id ? { ...emp, ...empPayload } : emp
        );
        saveEmployeesToStateAndStorage(updatedList);
        toast.success('Employee Updated', `Employee "${formName}" updated successfully.`);
      } else {
        const docRef = await addDoc(collection(db, 'employees'), {
          ...empPayload,
          createdAt: serverTimestamp()
        });
        const newRecord: EmployeeRecord = { id: docRef.id, ...empPayload };
        saveEmployeesToStateAndStorage([newRecord, ...employees]);
        toast.success('Employee Created', `Employee "${formName}" saved successfully.`);
      }
      handleCloseModal();
    } catch (err: any) {
      console.error('Error saving employee to Firebase:', err);
      toast.error('Save Failed', 'Error saving employee: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this employee?')) return;
    try {
      await deleteDoc(doc(db, 'employees', id));
      const filtered = employees.filter((emp) => emp.id !== id);
      saveEmployeesToStateAndStorage(filtered);
      toast.success('Employee Deleted', 'Employee record removed successfully.');
    } catch (err: any) {
      console.error('Error deleting employee from Firebase:', err);
      toast.error('Delete Failed', 'Error deleting employee: ' + err.message);
    }
  };

  // Open Advance Management Modal
  const handleOpenAdvanceModal = (emp: EmployeeRecord) => {
    setSelectedAdvanceEmp(emp);
    setAdvAmount('');
    setAdvReason('');
    setSelectedAdvForInstallmentId(null);
    setManualInstAmount('');
    setManualInstNote('');
    setManualInstMode('Cash');
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    setAdvDate(`${y}-${m}-${d}`);
    setManualInstDate(`${y}-${m}-${d}`);
    setIsAdvanceModalOpen(true);
  };

  // Create New Advance
  const handleCreateAdvance = async () => {
    if (!selectedAdvanceEmp) return;
    const amountNum = parseFloat(advAmount);

    if (isNaN(amountNum) || amountNum <= 0) {
      toast.warning('Invalid Amount', 'Please enter a valid positive advance amount.');
      return;
    }

    try {
      setIsSavingAdv(true);

      const docRef = await addDoc(collection(db, 'employee_advances'), {
        employeeId: selectedAdvanceEmp.id,
        employeeName: selectedAdvanceEmp.name,
        amount: amountNum,
        date: advDate,
        reason: advReason.trim() || 'General Advance',
        totalRepaid: 0,
        remainingBalance: amountNum,
        installments: [],
        status: 'Active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setSelectedAdvForInstallmentId(docRef.id);

      toast.success(
        'Advance Issued',
        `Successfully issued advance of ₹${amountNum.toLocaleString('en-IN')} for ${selectedAdvanceEmp.name}.`
      );
      setAdvAmount('');
      setAdvReason('');
    } catch (err: any) {
      console.error('Error creating advance:', err);
      toast.error('Failed to create advance', err?.message);
    } finally {
      setIsSavingAdv(false);
    }
  };

  // Record Manual Installment Repayment
  const handleAddManualInstallment = async (targetAdvanceId?: string) => {
    if (!selectedAdvanceEmp) return;
    const amountNum = parseFloat(manualInstAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.warning('Invalid Amount', 'Please enter a valid installment amount.');
      return;
    }

    const empAdvs = allAdvances
      .filter((a) => a.employeeId === selectedAdvanceEmp.id && a.status !== 'Cancelled')
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    const advId = targetAdvanceId || selectedAdvForInstallmentId;
    const targetAdv =
      empAdvs.find((a) => a.id === advId) ||
      empAdvs.find((a) => a.status === 'Active') ||
      empAdvs[0];

    if (!targetAdv) {
      toast.warning('No Advance Available', 'Please select an advance record to add installment.');
      return;
    }

    const currentBalance = targetAdv.remainingBalance ?? (targetAdv.amount - (targetAdv.totalRepaid || 0));
    if (amountNum > currentBalance) {
      toast.warning('Amount Exceeds Balance', `Remaining balance on this advance is ₹${currentBalance.toLocaleString('en-IN')}. Cannot enter higher amount.`);
      return;
    }

    try {
      setIsSavingManualInst(true);
      const newRepaid = (targetAdv.totalRepaid || 0) + amountNum;
      const newRemaining = Math.max(0, targetAdv.amount - newRepaid);
      const newStatus = newRemaining <= 0 ? 'Completed' : 'Active';

      const newEntry: AdvanceInstallment = {
        id: `inst_${Date.now()}`,
        installmentNumber: (targetAdv.installments?.length || 0) + 1,
        amount: amountNum,
        monthDue: (manualInstDate || new Date().toISOString().slice(0, 10)).slice(0, 7),
        paymentDate: manualInstDate || new Date().toISOString().slice(0, 10),
        paymentMode: manualInstMode as any,
        note: manualInstNote.trim() || `Manual ${manualInstMode} Installment`,
        status: 'Paid',
        type: 'manual_installment',
        deductedInPayrollMonth: `Manual (${manualInstMode})`,
        deductedAt: new Date().toISOString(),
      };

      // Put latest installment at the top of the array
      const updatedInstallments = [newEntry, ...(targetAdv.installments || [])];

      await updateDoc(doc(db, 'employee_advances', targetAdv.id), {
        totalRepaid: newRepaid,
        remainingBalance: newRemaining,
        status: newStatus,
        installments: updatedInstallments,
        updatedAt: serverTimestamp(),
      });

      toast.success(
        'Installment Recorded',
        `Recorded ₹${amountNum.toLocaleString('en-IN')} manual installment via ${manualInstMode} for ${selectedAdvanceEmp.name}.`
      );
      setManualInstAmount('');
      setManualInstNote('');
    } catch (err: any) {
      console.error('Error adding manual installment:', err);
      toast.error('Failed to record installment', err?.message);
    } finally {
      setIsSavingManualInst(false);
    }
  };

  // Delete / Revert an Installment entry
  const handleDeleteInstallment = async (adv: EmployeeAdvanceRecord, instIdx: number) => {
    if (!confirm('Are you sure you want to delete this installment record? The advance remaining balance will be restored.')) return;

    try {
      const targetInst = adv.installments[instIdx];
      const instAmount = targetInst.amount || 0;
      const updatedInstallments = adv.installments.filter((_, idx) => idx !== instIdx);
      const newRepaid = Math.max(0, (adv.totalRepaid || 0) - instAmount);
      const newRemaining = adv.amount - newRepaid;
      const newStatus = newRemaining > 0 ? 'Active' : 'Completed';

      await updateDoc(doc(db, 'employee_advances', adv.id), {
        totalRepaid: newRepaid,
        remainingBalance: newRemaining,
        status: newStatus,
        installments: updatedInstallments,
        updatedAt: serverTimestamp(),
      });

      toast.success('Installment Removed', 'Installment entry removed and balance restored.');
    } catch (err: any) {
      console.error('Error deleting installment:', err);
      toast.error('Failed to delete installment', err?.message);
    }
  };

  // Filter logic
  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.empId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.mobile.includes(searchQuery) ||
      emp.department.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesMode = filterMode === 'all' || emp.paymentMode === filterMode;
    return matchesSearch && matchesMode;
  });

  const [currentPage, setCurrentPage] = useState(1);
  const paginatedEmployees = filteredEmployees.slice((currentPage - 1) * 45, currentPage * 45);

  const totalMonthlySalary = employees
    .filter((e) => e.paymentMode === 'monthly')
    .reduce((sum, e) => sum + e.salary, 0);

  const totalDailyWorkers = employees.filter((e) => e.paymentMode === 'daily').length;

  return (
    <div className="w-full flex flex-col gap-4 text-slate-800 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users size={22} className="text-slate-800 stroke-[1.75]" />
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Employees</h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => toast.info('Exporting Employees', 'Preparing employees CSV export...')}
            className="bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-300 shadow-2xs transition-colors cursor-pointer"
          >
            Export
          </button>
          <button
            onClick={() => handleOpenModal()}
            className="bg-[#02626D] hover:bg-[#014d56] text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Plus size={14} />
            <span>Add employee</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-semibold">
            <Users size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold uppercase">Total Workforce</p>
            <h3 className="text-2xl font-semibold text-slate-900 mt-0.5">{employees.length}</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-semibold">
            <Calendar size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold uppercase">Monthly Salaried</p>
            <h3 className="text-2xl font-semibold text-slate-900 mt-0.5">
              {employees.filter((e) => e.paymentMode === 'monthly').length} Staff
            </h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-semibold">
            <ClockIcon size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold uppercase">Daily Wage Staff</p>
            <h3 className="text-2xl font-semibold text-slate-900 mt-0.5">{totalDailyWorkers} Workers</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center font-semibold">
            <DollarSign size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold uppercase">Monthly Payroll Est.</p>
            <h3 className="text-2xl font-semibold text-slate-900 mt-0.5">₹{totalMonthlySalary.toLocaleString('en-IN')}</h3>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-96">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, ID, phone or department..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <span className="text-xs text-slate-500 font-medium">Payment Filter:</span>
          <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                filterMode === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({employees.length})
            </button>
            <button
              onClick={() => setFilterMode('monthly')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                filterMode === 'monthly' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setFilterMode('daily')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                filterMode === 'daily' ? 'bg-white text-amber-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Daily
            </button>
          </div>
        </div>
      </div>

      {/* Employees Grid Card Display */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-slate-200 text-slate-400">
          <RefreshCw size={28} className="animate-spin text-indigo-600 mb-2" />
          <p className="text-sm font-semibold">Loading workforce database...</p>
        </div>
      ) : filteredEmployees.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-slate-200 text-slate-400 text-center">
          <User size={40} className="text-slate-300 mb-2" />
          <h3 className="text-base font-semibold text-slate-700">No Employees Found</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm">
            No employee records match your search filter. Click "Add New Employee" to register staff members.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {paginatedEmployees.map((emp) => (
              <div
                key={emp.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                {/* Employee Card Top */}
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 flex-shrink-0 relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={emp.photoUrl}
                      alt={emp.name}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                        {emp.empId}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          emp.paymentMode === 'monthly'
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {emp.paymentMode === 'monthly' ? 'Monthly' : 'Daily Worker'}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 truncate mt-1">{emp.name}</h3>
                    <p className="text-xs text-slate-500 font-medium truncate">{emp.department || 'Production'}</p>
                  </div>
                </div>

                {/* Info List */}
                <div className="mt-4 pt-3 border-t border-slate-100 space-y-2 text-xs text-slate-600">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <Phone size={13} className="text-slate-400" /> Mobile:
                    </span>
                    <span className="font-semibold text-slate-800 font-mono">{emp.mobile}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <DollarSign size={13} className="text-slate-400" /> Pay Rate:
                    </span>
                    <span className="font-bold text-emerald-600">
                      ₹{emp.salary.toLocaleString()}{' '}
                      <span className="text-[10px] font-normal text-slate-400">
                        /{emp.paymentMode === 'monthly' ? 'mo' : 'day'}
                      </span>
                    </span>
                  </div>

                  <div className="flex items-start gap-1.5 text-slate-500 text-[11px] mt-1">
                    <MapPin size={13} className="text-slate-400 flex-shrink-0 mt-0.5" />
                    <span className="truncate">{emp.address || 'Address not registered'}</span>
                  </div>

                  {/* Assigned Factory & Packing Units Badges */}
                  <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-1 text-[10px]">
                    <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-semibold flex items-center gap-1">
                      <Factory size={10} />
                      <span>
                        Mfg: {!emp.assignedMfgUnits || emp.assignedMfgUnits.includes('All') ? 'All Units' : `${emp.assignedMfgUnits.length} Units`}
                      </span>
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200 font-semibold flex items-center gap-1">
                      <Package size={10} />
                      <span>
                        Pck: {!emp.assignedPckUnits || emp.assignedPckUnits.includes('All') ? 'All Units' : `${emp.assignedPckUnits.length} Units`}
                      </span>
                    </span>
                  </div>

                  {/* Active Advance Balance Info if any */}
                  {(() => {
                    const empAdvs = allAdvances.filter((a) => a.employeeId === emp.id && a.status === 'Active');
                    const pendingAdvance = empAdvs.reduce((sum, a) => sum + (a.remainingBalance ?? (a.amount - (a.totalRepaid || 0))), 0);
                    if (pendingAdvance <= 0) return null;
                    return (
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] bg-amber-50/60 px-2.5 py-1 rounded-lg border border-amber-200">
                        <span className="font-semibold text-amber-900 flex items-center gap-1">
                          <HandCoins size={12} className="text-amber-700" /> Active Advance:
                        </span>
                        <span className="font-bold text-amber-900 font-mono">
                          ₹{pendingAdvance.toLocaleString('en-IN')}
                        </span>
                      </div>
                    );
                  })()}
                </div>

                {/* Card Actions */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/employee-portal?id=${emp.id}`}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 hover:underline"
                    >
                      <Eye size={13} /> View Portal
                    </Link>

                    <button
                      onClick={() => handleOpenAdvanceModal(emp)}
                      className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold transition-colors inline-flex items-center gap-1 cursor-pointer shadow-2xs"
                      title="Manage Advance Loans & Installments"
                    >
                      <HandCoins size={13} className="text-amber-700" />
                      <span>Manage Advance</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenModal(emp)}
                      className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-indigo-600 transition-colors cursor-pointer"
                      title="Edit Employee"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => handleDelete(emp.id)}
                      className="p-1.5 rounded-lg bg-white border border-slate-200 text-rose-500 hover:bg-rose-50 hover:border-rose-200 transition-colors cursor-pointer"
                      title="Delete Employee"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 45 Items Per Page Pagination */}
          <Pagination
            currentPage={currentPage}
            totalItems={filteredEmployees.length}
            pageSize={45}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      {/* Add / Edit Employee Full-Screen Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full h-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                  <UserCheck size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    {editingEmp ? 'Edit Employee Profile & Access' : 'Add New Employee'}
                    {editingEmp && (
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                        {editingEmp.empId}
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Employee profile details, geofence site coordinates, reference face photo & menu access controls.
                  </p>
                </div>
              </div>

              <button
                onClick={handleCloseModal}
                className="w-8 h-8 rounded-full bg-slate-200/70 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Form Content */}
            <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* Row 1: Name & Mobile */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Employee Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ramesh Kumar"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Mobile Number <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="e.g. +91 98765 43210"
                      value={formMobile}
                      onChange={(e) => setFormMobile(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Row 2: Payment Mode & Salary Amount & Accepted Leaves */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Payment Mode <span className="text-rose-500">*</span>
                    </label>
                    <CustomSelect
                      options={[
                        { value: 'monthly', label: 'Monthly Salary' },
                        { value: 'daily', label: 'Daily Wage' },
                      ]}
                      value={formMode}
                      onChange={(val) => setFormMode(val as 'monthly' | 'daily')}
                      className="w-full"
                      buttonClassName="w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Salary Amount (₹) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      placeholder={formMode === 'monthly' ? 'e.g. 25000' : 'e.g. 800'}
                      value={formSalary}
                      onChange={(e) => setFormSalary(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Accepted Leaves (Mo)
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder="e.g. 2"
                      value={formLeaves}
                      onChange={(e) => setFormLeaves(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Row 3: Department & Address */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
                    <CustomSelect
                      options={[
                        { value: 'Production', label: 'Production & Kitchen' },
                        { value: 'Packing', label: 'Packing & Dispatch' },
                        { value: 'Store & Billing', label: 'Store & Sales' },
                        { value: 'Management', label: 'Management & Admin' },
                      ]}
                      value={formDepartment}
                      onChange={(val) => setFormDepartment(val)}
                      className="w-full"
                      buttonClassName="w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Full Address</label>
                    <input
                      type="text"
                      placeholder="Residential address..."
                      value={formAddress}
                      onChange={(e) => setFormAddress(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Attendance Geo-location Section */}
                <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-indigo-950 flex items-center gap-1.5">
                      <MapPin size={16} className="text-indigo-600" />
                      Assigned Attendance GPS Geofence Coordinates
                    </label>
                    <button
                      type="button"
                      onClick={handleGetLocation}
                      disabled={isDetectingGps}
                      className={`inline-flex items-center gap-1.5 text-white text-[11px] font-semibold px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                        isDetectingGps ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
                      }`}
                    >
                      {isDetectingGps ? (
                        <>
                          <RefreshCw size={12} className="animate-spin" /> Fetching GPS...
                        </>
                      ) : (
                        <>
                          <Navigation size={12} /> Detect Current GPS
                        </>
                      )}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-[10px] font-semibold text-slate-500 uppercase">Latitude</span>
                      <input
                        type="number"
                        step="any"
                        placeholder="e.g. 13.1189"
                        value={formLat}
                        onChange={(e) => setFormLat(e.target.value)}
                        className="w-full mt-0.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-mono bg-white text-slate-900"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold text-slate-500 uppercase">Longitude</span>
                      <input
                        type="number"
                        step="any"
                        placeholder="e.g. 80.0967"
                        value={formLng}
                        onChange={(e) => setFormLng(e.target.value)}
                        className="w-full mt-0.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-mono bg-white text-slate-900"
                      />
                    </div>
                  </div>
                </div>

                {/* Live Photo Capture Section */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <label className="block text-xs font-semibold text-slate-900 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Camera size={16} className="text-indigo-600" />
                      Live Photo Capture (Face Identification Reference)
                    </span>
                    <span className="text-[10px] font-medium text-slate-500">
                      Used for biometric face verification at attendance
                    </span>
                  </label>

                  {/* Camera View or Captured Photo Preview */}
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    {/* Photo Display Frame */}
                    <div className="w-32 h-32 rounded-2xl border-2 border-dashed border-slate-300 bg-white flex flex-col items-center justify-center overflow-hidden relative shadow-xs flex-shrink-0">
                      {isCameraActive ? (
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          className="w-full h-full object-cover"
                        />
                      ) : formPhotoUrl ? (
                        <img
                          src={formPhotoUrl}
                          alt="Captured Employee Live Reference"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-center p-2 text-slate-400">
                          <Camera size={28} className="mx-auto mb-1 opacity-60" />
                          <span className="text-[10px] font-semibold block">No Live Photo</span>
                        </div>
                      )}
                    </div>

                    {/* Camera Control Buttons */}
                    <div className="flex-1 space-y-2 w-full">
                      {isCameraActive ? (
                        <button
                          type="button"
                          onClick={capturePhoto}
                          className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <CheckCircle2 size={16} /> Snap Live Photo
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={startCamera}
                          className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Camera size={16} /> Start Webcam Capture
                        </button>
                      )}

                      {cameraError && (
                        <p className="text-[11px] text-rose-600 font-medium flex items-center gap-1">
                          <AlertCircle size={12} /> {cameraError}
                        </p>
                      )}

                      <div className="relative">
                        <label className="w-full py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer">
                          <Upload size={14} /> Upload Photo File
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileUpload}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Unit & Section Access Assignment Section */}
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                  <div className="border-b border-slate-200/80 pb-3">
                    <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                      <Building2 size={16} className="text-indigo-600" />
                      Manufacturing &amp; Packing Unit Section Access
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Assign which specific factory kitchen unit(s) and packing section(s) this employee is authorized to access and view.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Manufacturing Units */}
                    <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <Factory size={14} className="text-amber-600" />
                          Manufacturing Units
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                          {formAssignedMfgUnits.includes('All') ? 'All Units' : `${formAssignedMfgUnits.length} Selected`}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => handleToggleMfgUnit('All')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                            formAssignedMfgUnits.includes('All')
                              ? 'bg-amber-600 text-white shadow-2xs'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          }`}
                        >
                          {formAssignedMfgUnits.includes('All') && <Check size={12} />}
                          <span>All Units (Full Access)</span>
                        </button>

                        {mfgUnitsList.map((unit) => {
                          const isSelected = formAssignedMfgUnits.includes('All') || formAssignedMfgUnits.includes(unit.name);
                          return (
                            <button
                              key={unit.id}
                              type="button"
                              onClick={() => handleToggleMfgUnit(unit.name)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                                isSelected
                                  ? 'bg-amber-100 text-amber-900 border border-amber-300 font-bold'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border border-transparent'
                              }`}
                            >
                              {isSelected && <Check size={12} className="text-amber-700" />}
                              <span>{unit.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Packing Units */}
                    <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <Package size={14} className="text-teal-600" />
                          Packing Units
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                          {formAssignedPckUnits.includes('All') ? 'All Units' : `${formAssignedPckUnits.length} Selected`}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => handleTogglePckUnit('All')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                            formAssignedPckUnits.includes('All')
                              ? 'bg-[#02626D] text-white shadow-2xs'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          }`}
                        >
                          {formAssignedPckUnits.includes('All') && <Check size={12} />}
                          <span>All Units (Full Access)</span>
                        </button>

                        {pckUnitsList.map((unit) => {
                          const isSelected = formAssignedPckUnits.includes('All') || formAssignedPckUnits.includes(unit.name);
                          return (
                            <button
                              key={unit.id}
                              type="button"
                              onClick={() => handleTogglePckUnit(unit.name)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                                isSelected
                                  ? 'bg-teal-50 text-[#02626D] border border-teal-300 font-bold'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border border-transparent'
                              }`}
                            >
                              {isSelected && <Check size={12} className="text-[#02626D]" />}
                              <span>{unit.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* System Menu Access Permissions Section */}
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                        <ShieldCheck size={16} className="text-indigo-600" />
                        System Menu Access Permissions & Privilege Control
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Configure View and Edit access privileges for all software module menus for this employee.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSelectAllViewPermissions}
                        className="px-2.5 py-1 text-[11px] font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                      >
                        Toggle All View
                      </button>
                      <button
                        type="button"
                        onClick={handleSelectAllEditPermissions}
                        className="px-2.5 py-1 text-[11px] font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                      >
                        Toggle All Edit
                      </button>
                    </div>
                  </div>

                  {/* Permissions Table Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {APP_MENUS.map((menu) => {
                      const perm = formPermissions[menu.key] || { menuKey: menu.key, menuName: menu.name, view: false, edit: false };
                      const isDefaultPortal = menu.key === 'employee_portal';

                      return (
                        <div
                          key={menu.key}
                          className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                            perm.view || perm.edit
                              ? 'bg-white border-indigo-200 shadow-xs'
                              : 'bg-white/60 border-slate-200/80 opacity-80'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div
                              className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                                perm.view ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              <Lock size={13} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-800 truncate">{menu.name}</p>
                              {isDefaultPortal && (
                                <span className="text-[9px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-100 inline-block">
                                  Default View Access
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-3 flex-shrink-0">
                            {/* View Checkbox */}
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={perm.view}
                                onChange={(e) => handleTogglePermission(menu.key, 'view', e.target.checked)}
                                className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                              />
                              <span className="text-[11px] font-semibold text-slate-600">View</span>
                            </label>

                            {/* Edit Checkbox */}
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={perm.edit}
                                onChange={(e) => handleTogglePermission(menu.key, 'edit', e.target.checked)}
                                className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                              />
                              <span className="text-[11px] font-semibold text-slate-600">Edit</span>
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>

              {/* Modal Actions Footer */}
              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3 flex-shrink-0">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-3.5 py-1 h-8 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSaving}
                  className={`px-4 py-1 h-8 rounded-lg text-white text-xs font-semibold shadow-2xs transition-all cursor-pointer flex items-center gap-1.5 ${
                    isSaving
                      ? 'bg-slate-700 cursor-not-allowed'
                      : 'bg-[#02626D] hover:bg-[#014d56]'
                  }`}
                >
                  {isSaving ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" /> Saving Profile...
                    </>
                  ) : (
                    <>
                      <Check size={14} /> Save Employee Profile & Access
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Manage Advance Full-Screen Modal */}
      {isAdvanceModalOpen && selectedAdvanceEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full h-[95vh] max-w-[98vw] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-3.5 border-b border-slate-100 bg-amber-50/70 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-600 text-white flex items-center justify-center shadow-xs">
                  <HandCoins size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    Manage Advances &amp; Installments: {selectedAdvanceEmp.name}
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200">
                      {selectedAdvanceEmp.empId}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Add employee advances on the left, and record/view monthly installments and salary deductions on the right.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsAdvanceModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-200/70 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Top Metrics Strip */}
            {(() => {
              const empAdvs = allAdvances
                .filter((a) => a.employeeId === selectedAdvanceEmp.id && a.status !== 'Cancelled')
                .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
              const totalTaken = empAdvs.reduce((sum, a) => sum + (a.amount || 0), 0);
              const totalRepaid = empAdvs.reduce((sum, a) => sum + (a.totalRepaid || 0), 0);
              const remainingBalance = empAdvs.reduce((sum, a) => sum + (a.remainingBalance ?? (a.amount - (a.totalRepaid || 0))), 0);

              const activeAdv =
                empAdvs.find((a) => a.id === selectedAdvForInstallmentId) ||
                empAdvs.find((a) => a.status === 'Active') ||
                empAdvs[0];

              return (
                <>
                  <div className="px-6 py-3 bg-slate-50 border-b border-slate-200/80 flex-shrink-0">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Advances Given</p>
                          <h4 className="text-lg font-black text-slate-900">₹{totalTaken.toLocaleString('en-IN')}</h4>
                        </div>
                        <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">
                          {empAdvs.length} Advances
                        </span>
                      </div>

                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Total Recovered / Repaid</p>
                          <h4 className="text-lg font-black text-emerald-700">₹{totalRepaid.toLocaleString('en-IN')}</h4>
                        </div>
                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-lg">
                          {totalTaken > 0 ? Math.round((totalRepaid / totalTaken) * 100) : 0}% Recovered
                        </span>
                      </div>

                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-bold text-amber-900 uppercase tracking-wider">Active Pending Balance</p>
                          <h4 className="text-lg font-black text-amber-700">₹{remainingBalance.toLocaleString('en-IN')}</h4>
                        </div>
                        <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-1 rounded-lg">
                          Outstanding
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Main 2-Column Full Screen Layout */}
                  <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-hidden">
                    {/* LEFT COLUMN: ADVANCES */}
                    <div className="lg:col-span-6 flex flex-col overflow-y-auto p-5 space-y-4 border-r border-slate-200 bg-slate-50/40">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <div className="flex items-center gap-2">
                          <Wallet size={16} className="text-amber-600" />
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                            1. Employee Advances
                          </h4>
                        </div>
                        <span className="text-[11px] text-slate-500 font-semibold">
                          {empAdvs.length} Recorded
                        </span>
                      </div>

                      {/* Issue New Advance Form */}
                      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs space-y-3">
                        <div className="flex items-center gap-1.5">
                          <PlusCircle size={15} className="text-amber-600" />
                          <h5 className="text-xs font-bold text-slate-900">Issue New Advance</h5>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                              Advance Amount (₹) <span className="text-rose-500">*</span>
                            </label>
                            <input
                              type="number"
                              placeholder="e.g. 5000"
                              value={advAmount}
                              onChange={(e) => setAdvAmount(e.target.value)}
                              className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                              Issue Date <span className="text-rose-500">*</span>
                            </label>
                            <CustomDatePicker
                              value={advDate}
                              onChange={setAdvDate}
                              allowAll={false}
                              size="sm"
                            />
                          </div>

                          <div className="sm:col-span-2">
                            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                              Reason / Purpose
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Festival Advance, Medical, Personal"
                              value={advReason}
                              onChange={(e) => setAdvReason(e.target.value)}
                              className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[11px] text-slate-500">
                            {parseFloat(advAmount) > 0 ? (
                              <strong className="text-amber-700">₹{parseFloat(advAmount).toLocaleString('en-IN')}</strong>
                            ) : (
                              'Enter amount to issue'
                            )}
                          </span>
                          <button
                            type="button"
                            disabled={isSavingAdv || !advAmount || parseFloat(advAmount) <= 0}
                            onClick={handleCreateAdvance}
                            className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            {isSavingAdv ? <RefreshCw size={13} className="animate-spin" /> : <PlusCircle size={13} />}
                            <span>Issue Advance</span>
                          </button>
                        </div>
                      </div>

                      {/* Advances List (Latest First) */}
                      <div className="space-y-3 pt-1">
                        <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          Advances List (Latest First)
                        </h5>

                        {empAdvs.length === 0 ? (
                          <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center text-slate-400 text-xs">
                            No advances issued yet for this employee.
                          </div>
                        ) : (
                          empAdvs.map((adv) => {
                            const isSelected = activeAdv?.id === adv.id;
                            const percent = adv.amount > 0 ? Math.min(100, Math.round(((adv.totalRepaid || 0) / adv.amount) * 100)) : 0;
                            const remaining = adv.remainingBalance ?? (adv.amount - (adv.totalRepaid || 0));

                            return (
                              <div
                                key={adv.id}
                                onClick={() => setSelectedAdvForInstallmentId(adv.id)}
                                className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                                  isSelected
                                    ? 'bg-amber-50/50 border-amber-400 ring-2 ring-amber-400/30 shadow-xs'
                                    : 'bg-white border-slate-200 hover:border-amber-200 shadow-2xs'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-center gap-2.5">
                                    <div
                                      className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                                        adv.status === 'Completed'
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : 'bg-amber-100 text-amber-800'
                                      }`}
                                    >
                                      ₹
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <h6 className="font-bold text-sm text-slate-900">
                                          ₹{adv.amount.toLocaleString('en-IN')}
                                        </h6>
                                        <span
                                          className={`text-[9px] font-bold px-2 py-0.2 rounded-full uppercase ${
                                            adv.status === 'Completed'
                                              ? 'bg-emerald-100 text-emerald-800'
                                              : 'bg-amber-100 text-amber-800'
                                          }`}
                                        >
                                          {adv.status}
                                        </span>
                                      </div>
                                      <p className="text-[11px] text-slate-500 mt-0.5">
                                        Issued on <span className="font-semibold text-slate-700">{adv.date}</span> • {adv.reason || 'General Advance'}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="text-right">
                                    <span className="text-xs font-bold text-slate-800 block">
                                      Remaining: ₹{remaining.toLocaleString('en-IN')}
                                    </span>
                                    <span className="text-[10px] text-slate-400">
                                      Repaid ₹{(adv.totalRepaid || 0).toLocaleString('en-IN')} ({percent}%)
                                    </span>
                                  </div>
                                </div>

                                {/* Progress Bar */}
                                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-3">
                                  <div
                                    className="bg-emerald-500 h-full rounded-full transition-all"
                                    style={{ width: `${percent}%` }}
                                  />
                                </div>

                                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
                                  <span>{(adv.installments || []).length} Installments / Deductions</span>
                                  <span className={`font-bold ${isSelected ? 'text-amber-700' : 'text-slate-400'}`}>
                                    {isSelected ? '✓ Selected for Installments' : 'Click to select'}
                                  </span>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* RIGHT COLUMN: INSTALLMENTS & REPAYMENTS */}
                    <div className="lg:col-span-6 flex flex-col overflow-y-auto p-5 space-y-4 bg-white">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <div className="flex items-center gap-2">
                          <CreditCard size={16} className="text-emerald-600" />
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                            2. Installments &amp; Salary Deductions
                          </h4>
                        </div>
                        {activeAdv && (
                          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            Paying towards: ₹{activeAdv.amount.toLocaleString('en-IN')} Advance
                          </span>
                        )}
                      </div>

                      {/* Add Manual Installment Form */}
                      {activeAdv && (
                        <div className="bg-emerald-50/40 border border-emerald-200/80 rounded-2xl p-4 shadow-2xs space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <PlusCircle size={15} className="text-emerald-700" />
                              <h5 className="text-xs font-bold text-slate-900">Add Manual Installment Repayment</h5>
                            </div>
                            <span className="text-[11px] font-bold text-emerald-800">
                              Pending Balance: ₹{(activeAdv.remainingBalance ?? (activeAdv.amount - (activeAdv.totalRepaid || 0))).toLocaleString('en-IN')}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                                Installment Amount (₹) <span className="text-rose-500">*</span>
                              </label>
                              <input
                                type="number"
                                placeholder="e.g. 1000"
                                value={manualInstAmount}
                                onChange={(e) => setManualInstAmount(e.target.value)}
                                className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                                Repayment Date <span className="text-rose-500">*</span>
                              </label>
                              <CustomDatePicker
                                value={manualInstDate}
                                onChange={setManualInstDate}
                                allowAll={false}
                                size="sm"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                                Payment Mode
                              </label>
                              <CustomSelect
                                options={[
                                  { value: 'Cash', label: 'Cash (Hand-to-Hand)' },
                                  { value: 'UPI', label: 'UPI / GPay / PhonePe' },
                                  { value: 'Bank Transfer', label: 'Bank Transfer / NEFT' },
                                ]}
                                value={manualInstMode}
                                onChange={setManualInstMode}
                                size="sm"
                              />
                            </div>

                            <div className="sm:col-span-3">
                              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                                Note / Remarks
                              </label>
                              <input
                                type="text"
                                placeholder="e.g. Returned direct cash in office, festival bonus deduction"
                                value={manualInstNote}
                                onChange={(e) => setManualInstNote(e.target.value)}
                                className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                              />
                            </div>
                          </div>

                          {/* Quick Amount Buttons */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-semibold text-slate-500">Quick Fill:</span>
                            {[500, 1000, 2000, 5000].map((amt) => (
                              <button
                                key={amt}
                                type="button"
                                onClick={() => setManualInstAmount(amt.toString())}
                                className="px-2 py-0.5 text-[10px] font-bold rounded-lg bg-white border border-emerald-200 hover:bg-emerald-100 text-emerald-800 transition-colors cursor-pointer"
                              >
                                +₹{amt.toLocaleString('en-IN')}
                              </button>
                            ))}
                            {activeAdv && (
                              <button
                                type="button"
                                onClick={() =>
                                  setManualInstAmount(
                                    (activeAdv.remainingBalance ?? (activeAdv.amount - (activeAdv.totalRepaid || 0))).toString()
                                  )
                                }
                                className="px-2 py-0.5 text-[10px] font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer"
                              >
                                Full Remaining
                              </button>
                            )}
                          </div>

                          <div className="flex items-center justify-end pt-1">
                            <button
                              type="button"
                              disabled={isSavingManualInst || !manualInstAmount || parseFloat(manualInstAmount) <= 0}
                              onClick={() => handleAddManualInstallment(activeAdv.id)}
                              className="px-4 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              {isSavingManualInst ? <RefreshCw size={13} className="animate-spin" /> : <PlusCircle size={13} />}
                              <span>Record Installment Repayment</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Installments & Deductions History List (Latest on top) */}
                      <div className="space-y-3 pt-1">
                        <div className="flex items-center justify-between">
                          <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            Installments &amp; Deductions History (Latest at Top)
                          </h5>
                          {activeAdv && (
                            <span className="text-[10px] text-slate-400">
                              {(activeAdv.installments || []).length} entries for this advance
                            </span>
                          )}
                        </div>

                        {(!activeAdv || !activeAdv.installments || activeAdv.installments.length === 0) ? (
                          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 text-center text-slate-400 text-xs">
                            <HandCoins size={32} className="mx-auto text-slate-300 mb-2" />
                            <p className="font-semibold">No Installments or Deductions Recorded Yet</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              Add manual installments above or deduct amounts during salary calculation in the Payroll page.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-2.5">
                            {(activeAdv.installments || []).map((inst, idx) => (
                              <div
                                key={inst.id || idx}
                                className="p-3.5 rounded-2xl border border-slate-200/90 bg-white hover:border-emerald-200 shadow-2xs flex items-center justify-between gap-3 transition-all"
                              >
                                <div className="flex items-center gap-3">
                                  <div
                                    className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                                      inst.type === 'manual_installment'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-indigo-100 text-indigo-800'
                                    }`}
                                  >
                                    {inst.type === 'manual_installment' ? <Wallet size={16} /> : <Receipt size={16} />}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <h6 className="font-bold text-sm text-emerald-800">
                                        ₹{inst.amount.toLocaleString('en-IN')}
                                      </h6>
                                      <span
                                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                          inst.type === 'manual_installment'
                                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                            : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                                        }`}
                                      >
                                        {inst.type === 'manual_installment'
                                          ? `Manual (${inst.paymentMode || 'Cash'})`
                                          : `Salary Deduction (${inst.deductedInPayrollMonth || inst.monthDue})`}
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 mt-0.5">
                                      Paid Date: <strong className="text-slate-700">{inst.paymentDate || inst.deductedInPayrollMonth || '-'}</strong>
                                      {inst.note ? ` • ${inst.note}` : ''}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                                    ✓ Repaid
                                  </span>

                                  {inst.type === 'manual_installment' && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteInstallment(activeAdv, idx)}
                                      className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                                      title="Delete Installment Record"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}

            {/* Modal Footer */}
            <div className="px-6 py-2.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between flex-shrink-0">
              <span className="text-xs text-slate-500 font-medium">
                💡 Employee advances can be repaid via manual installments here or automatically deducted from monthly salary in Payroll.
              </span>
              <button
                type="button"
                onClick={() => setIsAdvanceModalOpen(false)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                Done / Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ClockIcon(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  );
}

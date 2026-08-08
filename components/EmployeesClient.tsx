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
  ShieldCheck
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
import CustomSelect from '@/components/CustomSelect';
import Pagination from '@/components/Pagination';
import { uploadToImageKit } from '@/lib/imageCompressor';
import {
  APP_MENUS,
  MenuAccessPermission,
  getMergedEmployeePermissions
} from '@/lib/menuConstants';

export type { MenuAccessPermission };

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
  createdAt?: any;
}

export default function EmployeesClient() {
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<string>('all');
  
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
  
  // Camera capture state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

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

    return () => unsubscribe();
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
      setFormPermissions(getMergedEmployeePermissions());
    }
    setIsModalOpen(true);
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
        },
        (error) => {
          alert('Could not retrieve GPS location: ' + error.message);
          setIsDetectingGps(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      alert('Geolocation is not supported by your browser.');
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
      alert('Please fill in required fields: Name, Mobile, and Salary Amount.');
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
        permissions: Object.values(formPermissions)
      };

      if (editingEmp) {
        await updateDoc(doc(db, 'employees', editingEmp.id), empPayload);
        const updatedList = employees.map((emp) =>
          emp.id === editingEmp.id ? { ...emp, ...empPayload } : emp
        );
        saveEmployeesToStateAndStorage(updatedList);
        alert(`Employee "${formName}" updated successfully in Firebase!`);
      } else {
        const docRef = await addDoc(collection(db, 'employees'), {
          ...empPayload,
          createdAt: serverTimestamp()
        });
        const newRecord: EmployeeRecord = { id: docRef.id, ...empPayload };
        saveEmployeesToStateAndStorage([newRecord, ...employees]);
        alert(`Employee "${formName}" saved successfully to Firebase!`);
      }
      handleCloseModal();
    } catch (err: any) {
      console.error('Error saving employee to Firebase:', err);
      alert('Error saving employee to Firebase: ' + err.message);
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
      alert('Employee record deleted from Firebase.');
    } catch (err: any) {
      console.error('Error deleting employee from Firebase:', err);
      alert('Error deleting employee from Firebase: ' + err.message);
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
            onClick={() => alert('Exporting employees...')}
            className="bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-300 shadow-2xs transition-colors cursor-pointer"
          >
            Export
          </button>
          <button
            onClick={() => handleOpenModal()}
            className="bg-[#303030] hover:bg-[#111111] text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5"
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
                </div>

                {/* Card Actions */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <Link
                    href={`/employee-portal?id=${emp.id}`}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 hover:underline"
                  >
                    <Eye size={14} /> View Portal
                  </Link>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenModal(emp)}
                      className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-indigo-600 transition-colors cursor-pointer"
                      title="Edit Employee"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(emp.id)}
                      className="p-1.5 rounded-lg bg-white border border-slate-200 text-rose-500 hover:bg-rose-50 hover:border-rose-200 transition-colors cursor-pointer"
                      title="Delete Employee"
                    >
                      <Trash2 size={14} />
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
                      : 'bg-[#303030] hover:bg-[#111111]'
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

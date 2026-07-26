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
  User
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
import { uploadToImageKit } from '@/lib/imageCompressor';

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
  createdAt?: any;
}

const DEFAULT_EMPLOYEES: EmployeeRecord[] = [
  {
    id: 'emp-1',
    empId: 'EMP-1001',
    name: 'Ramesh Kumar',
    mobile: '+91 98765 43210',
    salary: 25000,
    paymentMode: 'monthly',
    acceptedLeaves: 2,
    latitude: 13.1189,
    longitude: 80.0967,
    address: '12, Main Road, Pattabiram, Chennai - 600072',
    photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
    department: 'Production',
    status: 'active'
  },
  {
    id: 'emp-2',
    empId: 'EMP-1002',
    name: 'Suresh V',
    mobile: '+91 98401 12345',
    salary: 800,
    paymentMode: 'daily',
    acceptedLeaves: 4,
    latitude: 13.1192,
    longitude: 80.0971,
    address: '45, Station Street, Pattabiram, Chennai - 600072',
    photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
    department: 'Packing',
    status: 'active'
  },
  {
    id: 'emp-3',
    empId: 'EMP-1003',
    name: 'Priya Sundaram',
    mobile: '+91 97100 88990',
    salary: 28000,
    paymentMode: 'monthly',
    acceptedLeaves: 2,
    latitude: 13.1185,
    longitude: 80.0962,
    address: '8, Bazaar Lane, Pattabiram, Chennai - 600072',
    photoUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80',
    department: 'Store & Billing',
    status: 'active'
  }
];

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
  
  // Camera capture state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Firestore Sync & Local Fallback
  useEffect(() => {
    setLoading(true);
    try {
      const q = query(collection(db, 'employees'), orderBy('createdAt', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          const list: EmployeeRecord[] = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as Omit<EmployeeRecord, 'id'>)
          }));
          setEmployees(list);
        } else {
          // Initialize local storage or fallback defaults
          const local = localStorage.getItem('pattabiram_employees');
          if (local) {
            setEmployees(JSON.parse(local));
          } else {
            setEmployees(DEFAULT_EMPLOYEES);
            localStorage.setItem('pattabiram_employees', JSON.stringify(DEFAULT_EMPLOYEES));
          }
        }
        setLoading(false);
      }, (err) => {
        console.warn('Firestore offline, using local storage fallback:', err);
        const local = localStorage.getItem('pattabiram_employees');
        setEmployees(local ? JSON.parse(local) : DEFAULT_EMPLOYEES);
        setLoading(false);
      });

      return () => unsubscribe();
    } catch (e) {
      const local = localStorage.getItem('pattabiram_employees');
      setEmployees(local ? JSON.parse(local) : DEFAULT_EMPLOYEES);
      setLoading(false);
    }
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
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    stopCamera();
    setIsModalOpen(false);
    setEditingEmp(null);
  };

  // Geolocation detector
  const handleGetLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormLat(position.coords.latitude.toFixed(6));
          setFormLng(position.coords.longitude.toFixed(6));
        },
        (error) => {
          alert('Could not retrieve GPS location: ' + error.message);
        },
        { enableHighAccuracy: true }
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
      };

      if (editingEmp) {
        try {
          await updateDoc(doc(db, 'employees', editingEmp.id), empPayload);
        } catch {
          // Local fallback
        }
        const updatedList = employees.map((emp) =>
          emp.id === editingEmp.id ? { ...emp, ...empPayload } : emp
        );
        saveEmployeesToStateAndStorage(updatedList);
      } else {
        let newId = 'emp-' + Date.now();
        try {
          const docRef = await addDoc(collection(db, 'employees'), {
            ...empPayload,
            createdAt: serverTimestamp()
          });
          newId = docRef.id;
        } catch {
          // Local fallback
        }
        const newRecord: EmployeeRecord = { id: newId, ...empPayload };
        saveEmployeesToStateAndStorage([newRecord, ...employees]);
      }
      handleCloseModal();
    } catch (err: any) {
      alert('Error saving employee record: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this employee?')) return;
    try {
      try {
        await deleteDoc(doc(db, 'employees', id));
      } catch {}
      const filtered = employees.filter((emp) => emp.id !== id);
      saveEmployeesToStateAndStorage(filtered);
    } catch (err: any) {
      alert('Error deleting employee: ' + err.message);
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

  const totalMonthlySalary = employees
    .filter((e) => e.paymentMode === 'monthly')
    .reduce((sum, e) => sum + e.salary, 0);

  const totalDailyWorkers = employees.filter((e) => e.paymentMode === 'daily').length;

  return (
    <div className="w-full flex flex-col gap-6 font-sans pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
              <Users size={22} />
            </div>
            Employee Directory & Management
          </h1>
          <nav className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
            <Link href="/" className="hover:text-indigo-600 transition-colors">Dashboard</Link>
            <ChevronRight size={12} />
            <span className="text-slate-800 font-medium">Employees</span>
          </nav>
        </div>

        <button
          onClick={() => handleOpenModal()}
          className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-sm px-5 py-2.5 rounded-xl shadow-md transition-all cursor-pointer"
        >
          <Plus size={18} />
          Add New Employee
        </button>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredEmployees.map((emp) => (
            <div
              key={emp.id}
              className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all overflow-hidden flex flex-col justify-between group"
            >
              <div className="p-5">
                {/* Header & Avatar */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3.5">
                    <div className="relative w-14 h-14 rounded-2xl overflow-hidden border-2 border-indigo-100 shadow-xs bg-slate-100">
                      <img
                        src={emp.photoUrl}
                        alt={emp.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                          {emp.name}
                        </h3>
                      </div>
                      <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
                        {emp.empId}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-semibold uppercase px-2.5 py-1 rounded-lg border ${
                      emp.paymentMode === 'monthly'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}
                  >
                    {emp.paymentMode}
                  </span>
                </div>

                {/* Details list */}
                <div className="space-y-2.5 border-t border-slate-100 pt-4 text-xs">
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <Phone size={14} /> Mobile:
                    </span>
                    <span className="font-semibold text-slate-800">{emp.mobile}</span>
                  </div>

                  <div className="flex items-center justify-between text-slate-600">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <DollarSign size={14} /> Salary Rate:
                    </span>
                    <span className="font-semibold text-slate-900">
                      ₹{emp.salary.toLocaleString('en-IN')}{' '}
                      <span className="text-[10px] text-slate-400 font-normal">
                        ({emp.paymentMode === 'monthly' ? '/ month' : '/ day'})
                      </span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-600">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <Calendar size={14} /> Accepted Leaves:
                    </span>
                    <span className="font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                      {emp.acceptedLeaves} Days / Mo
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-600">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <MapPin size={14} className="text-rose-500" /> Geofence Base:
                    </span>
                    <span className="font-mono text-[11px] text-slate-700">
                      {emp.latitude ? `${emp.latitude}, ${emp.longitude}` : 'Not set'}
                    </span>
                  </div>

                  {emp.address && (
                    <div className="text-[11px] text-slate-500 line-clamp-1 pt-1 border-t border-slate-100">
                      <span className="font-semibold text-slate-600">Address:</span> {emp.address}
                    </div>
                  )}
                </div>
              </div>

              {/* Action buttons footer */}
              <div className="bg-slate-50/80 px-5 py-3 border-t border-slate-100 flex items-center justify-between">
                <Link
                  href={`/employee-portal?id=${emp.id}`}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors"
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
      )}

      {/* Add / Edit Employee Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-2xl my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                  <UserCheck size={20} />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    {editingEmp ? 'Edit Employee Details' : 'Add New Employee'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Enter workforce information, geofence coordinates & reference face photo
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
            <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              
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
                    className="inline-flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold px-3 py-1 rounded-lg transition-colors cursor-pointer"
                  >
                    <Navigation size={12} /> Detect Current GPS
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
                  <div className="w-36 h-36 rounded-2xl border-2 border-dashed border-slate-300 bg-white flex flex-col items-center justify-center overflow-hidden relative shadow-xs">
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
                        <Camera size={32} className="mx-auto mb-1 opacity-60" />
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

              {/* Modal Actions Footer */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSaving}
                  className={`px-6 py-2 rounded-xl text-white text-xs font-semibold shadow-md transition-all cursor-pointer flex items-center gap-1.5 ${
                    isSaving
                      ? 'bg-indigo-400 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  {isSaving ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" /> Uploading Photo & Saving...
                    </>
                  ) : (
                    <>
                      <Check size={16} /> Save Employee
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

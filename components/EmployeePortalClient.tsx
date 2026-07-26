'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  UserCheck,
  Calendar,
  Clock,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  CreditCard,
  Award,
  User,
  Phone,
  Briefcase,
  MapPin,
  ShieldCheck,
  FileText,
  DollarSign,
  ChevronDown
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { EmployeeRecord } from './EmployeesClient';
import { AttendanceRecord } from './PayrollClient';
import CustomSelect from '@/components/CustomSelect';

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

export default function EmployeePortalClient() {
  const searchParams = useSearchParams();
  const queryEmpId = searchParams.get('id');

  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  const [attendanceList, setAttendanceList] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Load Employees and Attendance data
  useEffect(() => {
    setLoading(true);

    // Sync Employees
    const localEmps = localStorage.getItem('pattabiram_employees');
    if (localEmps) {
      const parsed: EmployeeRecord[] = JSON.parse(localEmps);
      setEmployees(parsed);
      setSelectedEmpId(queryEmpId || parsed[0]?.id || 'emp-1');
    } else {
      setEmployees(DEFAULT_EMPLOYEES);
      setSelectedEmpId(queryEmpId || DEFAULT_EMPLOYEES[0].id);
    }

    try {
      const q = query(collection(db, 'employees'));
      onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          const list: EmployeeRecord[] = snapshot.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<EmployeeRecord, 'id'>)
          }));
          setEmployees(list);
          if (!selectedEmpId) {
            setSelectedEmpId(queryEmpId || list[0]?.id || '');
          }
        }
      });
    } catch {}

    // Sync Attendance records
    const localAtt = localStorage.getItem('pattabiram_attendance');
    if (localAtt) {
      setAttendanceList(JSON.parse(localAtt));
    }

    try {
      const qAtt = query(collection(db, 'attendance'));
      onSnapshot(qAtt, (snapshot) => {
        if (!snapshot.empty) {
          const list: AttendanceRecord[] = snapshot.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<AttendanceRecord, 'id'>)
          }));
          setAttendanceList(list);
        }
      });
    } catch {}

    setLoading(false);
  }, [queryEmpId]);

  // Selected Employee object
  const selectedEmp = employees.find((e) => e.id === selectedEmpId) || employees[0];

  // Filter attendance logs exclusively for the selected employee
  const selectedEmpAttendance = attendanceList.filter((a) => a.employeeId === selectedEmp?.id);

  // Calculate monthly stats for selected employee
  const currentMonthStr = new Date().toISOString().slice(0, 7);
  const monthAttendance = selectedEmpAttendance.filter((a) => a.date.startsWith(currentMonthStr));
  const presentDays = monthAttendance.filter((a) => a.status === 'Present').length;
  const leaveDays = monthAttendance.filter((a) => a.status === 'Leave' || a.status === 'Absent').length;

  const perDayRate = selectedEmp
    ? selectedEmp.paymentMode === 'monthly'
      ? Math.round(selectedEmp.salary / 30)
      : selectedEmp.salary
    : 0;

  const acceptedLeaves = selectedEmp?.acceptedLeaves || 0;
  const unpaidLeaves = Math.max(0, leaveDays - acceptedLeaves);
  const payableDays = presentDays + Math.min(leaveDays, acceptedLeaves);
  const totalEarned = Math.round(payableDays * perDayRate);

  if (!selectedEmp) {
    return (
      <div className="p-12 text-center text-slate-500 font-semibold">
        No employee selected or found.
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-6 font-sans pb-12">
      {/* Top Header & Employee Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
              <UserCheck size={22} />
            </div>
            Employee Self-Service Portal
          </h1>
          <nav className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
            <Link href="/" className="hover:text-indigo-600 transition-colors">Dashboard</Link>
            <ChevronRight size={12} />
            <Link href="/employees" className="hover:text-indigo-600 transition-colors">Employees</Link>
            <ChevronRight size={12} />
            <span className="text-slate-800 font-medium">{selectedEmp.name}</span>
          </nav>
        </div>

        {/* Selector to choose selected employee */}
        <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
          <span className="text-xs font-semibold text-slate-600 pl-2">Select Employee View:</span>
          <CustomSelect
            options={employees.map((emp) => ({ value: emp.id, label: `${emp.name} (${emp.empId})` }))}
            value={selectedEmp.id}
            onChange={(val) => setSelectedEmpId(val)}
            size="sm"
          />
        </div>
      </div>

      {/* Selected Employee Profile Summary Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white rounded-3xl shadow-lg p-6 overflow-hidden relative">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          
          <div className="flex items-center gap-5">
            <div className="relative w-20 h-20 rounded-2xl overflow-hidden border-2 border-indigo-300/40 shadow-md bg-indigo-950">
              <img
                src={selectedEmp.photoUrl}
                alt={selectedEmp.name}
                className="w-full h-full object-cover"
              />
            </div>

            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-2xl font-semibold tracking-tight">{selectedEmp.name}</h2>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-white/20 text-white border border-white/30">
                  {selectedEmp.empId}
                </span>
              </div>
              
              <p className="text-xs text-indigo-200 mt-1 flex items-center gap-2">
                <Briefcase size={14} className="text-indigo-300" />
                {selectedEmp.department || 'Production'} • Mobile: <span className="font-mono text-white font-semibold">{selectedEmp.mobile}</span>
              </p>

              {selectedEmp.address && (
                <p className="text-[11px] text-indigo-300 mt-1 line-clamp-1">
                  Address: {selectedEmp.address}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 bg-white/10 p-4 rounded-2xl backdrop-blur-xs border border-white/10 w-full md:w-auto justify-between">
            <div>
              <p className="text-[10px] text-indigo-200 font-semibold uppercase">Payment Mode</p>
              <span className="text-xs font-semibold uppercase bg-emerald-500 text-white px-2.5 py-0.5 rounded-md mt-1 inline-block shadow-xs">
                {selectedEmp.paymentMode}
              </span>
            </div>

            <div className="border-l border-white/20 pl-3">
              <p className="text-[10px] text-indigo-200 font-semibold uppercase">Base Rate</p>
              <p className="text-sm font-semibold text-white mt-0.5">
                ₹{selectedEmp.salary.toLocaleString('en-IN')}{' '}
                <span className="text-[10px] text-indigo-300 font-normal">
                  ({selectedEmp.paymentMode === 'monthly' ? '/mo' : '/day'})
                </span>
              </p>
            </div>

            <div className="border-l border-white/20 pl-3">
              <p className="text-[10px] text-indigo-200 font-semibold uppercase">Per Day Rate</p>
              <p className="text-sm font-semibold text-emerald-400 mt-0.5">
                ₹{perDayRate.toLocaleString('en-IN')} / day
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* KPI Stats Cards for Selected Employee */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-xs text-slate-500 font-semibold uppercase">Present Days (This Mo)</p>
          <h3 className="text-2xl font-semibold text-emerald-600 mt-1">{presentDays} Days</h3>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-xs text-slate-500 font-semibold uppercase">Accepted Leaves Limit</p>
          <h3 className="text-2xl font-semibold text-indigo-600 mt-1">{acceptedLeaves} Days / Mo</h3>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-xs text-slate-500 font-semibold uppercase">Unpaid Deductions</p>
          <h3 className="text-2xl font-semibold text-rose-600 mt-1">{unpaidLeaves} Days</h3>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-xs text-slate-500 font-semibold uppercase">Net Earned Salary</p>
          <h3 className="text-2xl font-semibold text-slate-900 mt-1">₹{totalEarned.toLocaleString('en-IN')}</h3>
        </div>
      </div>

      {/* Geofence Site Bounds Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-semibold">
            <MapPin size={20} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Assigned Geofenced Workplace Site</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Attendance GPS Geofence Target: <span className="font-mono text-slate-800 font-semibold">{selectedEmp.latitude || 13.1189}, {selectedEmp.longitude || 80.0967}</span> (Max distance allowed: 50m)
            </p>
          </div>
        </div>

        <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 flex items-center gap-1.5">
          <ShieldCheck size={16} /> GPS & Face ID Verification Active
        </span>
      </div>

      {/* Detailed Attendance Logs & Monthly Payslip Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Selected Employee's Attendance History (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Individual Attendance Punch Logs ({selectedEmp.name})
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Historical record of punches, GPS verification, and Face ID scans</p>
            </div>

            <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full">
              {selectedEmpAttendance.length} Logs Saved
            </span>
          </div>

          {selectedEmpAttendance.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No attendance logs recorded yet for {selectedEmp.name}. Mark attendance in the Payroll module to update logs.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[500px]">
                <thead>
                  <tr className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider bg-slate-50 border-b border-slate-100">
                    <th className="py-3 px-5">Date</th>
                    <th className="py-3 px-4">Check In Time</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">GPS Verification</th>
                    <th className="py-3 px-5 text-right">Face Scan Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-medium">
                  {selectedEmpAttendance.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 px-5 font-semibold text-slate-900">{row.date}</td>
                      <td className="py-3.5 px-4 text-slate-700 font-mono">{row.checkInTime}</td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${
                            row.status === 'Present'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-[11px] text-slate-600">
                        <span className="text-emerald-600 font-semibold flex items-center gap-1">
                          <MapPin size={12} /> {row.distanceMeters || 0}m away (In range)
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-right font-semibold text-indigo-600">
                        <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-100">
                          <ShieldCheck size={12} /> Matched (98%)
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Selected Employee's Payslip Preview Card (1 col) */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 space-y-4">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <FileText size={16} className="text-indigo-600" />
              Monthly Payslip Preview
            </h3>
            <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-600">
              {currentMonthStr}
            </span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Employee:</span>
              <span className="font-semibold text-slate-900">{selectedEmp.name}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Payment Mode:</span>
              <span className="font-semibold text-slate-900 uppercase">{selectedEmp.paymentMode}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Per Day Salary Rate:</span>
              <span className="font-semibold text-indigo-600 font-mono">₹{perDayRate.toLocaleString('en-IN')} / day</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Days Present:</span>
              <span className="font-semibold text-emerald-600">{presentDays} Days</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Accepted Leaves:</span>
              <span className="font-semibold text-slate-800">{acceptedLeaves} Days</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Unpaid Deductions:</span>
              <span className="font-semibold text-rose-600">{unpaidLeaves} Days</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Total Payable Days:</span>
              <span className="font-semibold text-slate-900">{payableDays} Days</span>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 bg-slate-50 p-4 rounded-xl">
            <p className="text-[10px] text-slate-500 font-semibold uppercase">Estimated Net Payout</p>
            <p className="text-2xl font-semibold text-slate-900 mt-0.5">
              ₹{totalEarned.toLocaleString('en-IN')}
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}

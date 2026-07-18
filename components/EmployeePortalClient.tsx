'use client';

import { useState } from 'react';
import Link from 'next/link';
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
  TrendingUp,
} from 'lucide-react';

const MOCK_ATTENDANCE = [
  { date: '18 Jul 2026', checkIn: '08:45 AM', checkOut: '06:15 PM', status: 'Present', hours: '9.5 hrs' },
  { date: '17 Jul 2026', checkIn: '08:50 AM', checkOut: '06:00 PM', status: 'Present', hours: '9.1 hrs' },
  { date: '16 Jul 2026', checkIn: '09:00 AM', checkOut: '06:30 PM', status: 'Present', hours: '9.5 hrs' },
  { date: '15 Jul 2026', checkIn: '08:40 AM', checkOut: '05:55 PM', status: 'Present', hours: '9.2 hrs' },
  { date: '14 Jul 2026', checkIn: '—', checkOut: '—', status: 'Weekly Off', hours: '0 hrs' },
];

const MOCK_TASKS = [
  { title: 'Prepare Mysurpa 50kg Batch Shift 1', priority: 'High', status: 'In Progress' },
  { title: 'Inspect Packing Sealing Unit 2', priority: 'Normal', status: 'Completed' },
  { title: 'Verify Store Receipt #ORD-260718-005', priority: 'Normal', status: 'Pending' },
];

export default function EmployeePortalClient() {
  const [tasks, setTasks] = useState(MOCK_TASKS);

  const toggleTaskStatus = (idx: number) => {
    setTasks((prev) =>
      prev.map((t, i) =>
        i === idx
          ? { ...t, status: t.status === 'Completed' ? 'Pending' : 'Completed' }
          : t
      )
    );
  };

  return (
    <div className="w-full flex flex-col gap-6 font-sans pb-10">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <UserCheck size={22} />
            </div>
            Employee Portal
          </h1>
          <nav className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
            <Link href="/" className="hover:text-indigo-600 transition-colors">Dashboard</Link>
            <ChevronRight size={12} />
            <span className="text-slate-800 font-medium">Employee Portal</span>
          </nav>
        </div>

        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Shift Status: Checked In (08:45 AM)
        </span>
      </div>

      {/* Profile & Shift Overview Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white font-extrabold text-2xl flex items-center justify-center shadow-md">
              AK
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-extrabold text-slate-900">Arun Kumar</h2>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                  EMP-042
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                <Briefcase size={13} className="text-slate-400" /> Senior Production Supervisor • Manufacturing & Store
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 w-full md:w-auto pt-4 md:pt-0 border-t md:border-t-0 border-slate-100">
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <p className="text-[10px] text-slate-400 font-bold uppercase">Monthly Days</p>
              <p className="text-sm font-extrabold text-slate-900 mt-0.5">18 / 20 Days</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <p className="text-[10px] text-slate-400 font-bold uppercase">Hours Worked</p>
              <p className="text-sm font-extrabold text-emerald-600 mt-0.5">164.5 hrs</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 col-span-2 sm:col-span-1">
              <p className="text-[10px] text-slate-400 font-bold uppercase">Performance</p>
              <p className="text-sm font-extrabold text-indigo-600 mt-0.5 flex items-center gap-1">
                <Award size={14} /> 98.4%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Grid for Tasks & Attendance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Assigned Tasks Checklist (1 col) */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <ClipboardList size={16} className="text-indigo-600" />
              Daily Shift Tasks
            </h2>
            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full">
              {tasks.filter((t) => t.status === 'Completed').length} / {tasks.length}
            </span>
          </div>

          <div className="p-4 divide-y divide-slate-100 space-y-2">
            {tasks.map((task, idx) => {
              const isDone = task.status === 'Completed';
              return (
                <div
                  key={idx}
                  onClick={() => toggleTaskStatus(idx)}
                  className="pt-2 flex items-start gap-3 cursor-pointer group"
                >
                  <div
                    className={`w-5 h-5 rounded-md border flex items-center justify-center mt-0.5 transition-all ${
                      isDone
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : 'border-slate-300 group-hover:border-indigo-500'
                    }`}
                  >
                    {isDone && <CheckCircle2 size={13} />}
                  </div>
                  <div className="flex-1">
                    <p
                      className={`text-xs font-bold transition-all ${
                        isDone ? 'line-through text-slate-400' : 'text-slate-800 group-hover:text-indigo-600'
                      }`}
                    >
                      {task.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`text-[9px] font-bold px-2 py-0.2 rounded-full ${
                          task.priority === 'High'
                            ? 'bg-rose-50 text-rose-600 border border-rose-100'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {task.priority} Priority
                      </span>
                      <span className="text-[10px] text-slate-400">{task.status}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Attendance Log Table (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">Recent Attendance & Punch Logs</h2>
              <p className="text-xs text-slate-400 mt-0.5">Shift check-in, check-out, and total working hours</p>
            </div>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
              Biometric Verified
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[500px]">
              <thead>
                <tr className="text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50/60 border-b border-slate-100">
                  <th className="py-3 px-5">Date</th>
                  <th className="py-3 px-4">Check In</th>
                  <th className="py-3 px-4">Check Out</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-5 text-right">Total Hours</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium">
                {MOCK_ATTENDANCE.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 px-5 font-bold text-slate-900">{row.date}</td>
                    <td className="py-3.5 px-4 text-slate-700 font-mono">{row.checkIn}</td>
                    <td className="py-3.5 px-4 text-slate-700 font-mono">{row.checkOut}</td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                          row.status === 'Present'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-right font-extrabold text-indigo-600">{row.hours}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>
  );
}

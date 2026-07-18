'use client';

import { useState } from 'react';
import Image from 'next/image';
import {
  ShoppingBag,
  Store,
  Package,
  CreditCard,
  Users,
  Calendar,
  ChevronDown,
  Plus,
  Factory,
  ArrowRight,
} from 'lucide-react';
import CustomSelect from '@/components/CustomSelect';

// ─── Sales Overview Chart Component ─────────────────────────────────────────
function SalesOverviewChart() {
  const w = 480, h = 180;
  
  const thisMonthPath = "M 0 160 C 20 160, 30 130, 45 125 C 60 120, 75 100, 90 100 C 105 100, 115 130, 130 125 C 145 120, 160 80, 175 80 C 190 80, 205 110, 220 110 C 235 110, 250 85, 265 85 C 280 85, 295 110, 310 115 C 325 120, 340 105, 355 100 C 370 95, 385 55, 400 45 C 415 35, 430 70, 445 65 C 460 60, 475 62, 480 62";
  const thisMonthArea = `${thisMonthPath} L 480 180 L 0 180 Z`;

  const lastMonthPath = "M 0 170 C 30 170, 50 145, 80 145 C 110 145, 130 160, 160 155 C 190 150, 210 135, 240 135 C 270 135, 290 145, 320 140 C 350 135, 370 105, 400 100 C 430 95, 450 120, 480 115";
  const lastMonthArea = `${lastMonthPath} L 480 180 L 0 180 Z`;

  return (
    <div className="w-full h-full flex flex-col justify-between">
      <div className="relative flex-1 w-full min-h-[160px]">
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full overflow-visible" preserveAspectRatio="none">
          <defs>
            <linearGradient id="purpleGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="grayGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#cbd5e1" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#cbd5e1" stopOpacity="0.0" />
            </linearGradient>
          </defs>
          
          {/* Horizontal Grid lines */}
          {[0, 36, 72, 108, 144, 180].map((y) => (
            <line key={y} x1="0" y1={y} x2={w} y2={y} stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3 3" />
          ))}

          {/* Last Month Fill & Line */}
          <path d={lastMonthArea} fill="url(#grayGrad)" />
          <path d={lastMonthPath} fill="none" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />

          {/* This Month Fill & Line */}
          <path d={thisMonthArea} fill="url(#purpleGrad)" />
          <path d={thisMonthPath} fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" />

          {/* Key point markers */}
          <circle cx="90" cy="100" r="4" fill="#6366f1" stroke="#ffffff" strokeWidth="2" />
          <circle cx="175" cy="80" r="4" fill="#6366f1" stroke="#ffffff" strokeWidth="2" />
          <circle cx="265" cy="85" r="4" fill="#6366f1" stroke="#ffffff" strokeWidth="2" />
          <circle cx="400" cy="45" r="4" fill="#6366f1" stroke="#ffffff" strokeWidth="2" />
        </svg>
      </div>
    </div>
  );
}

// ─── Orders Donut Chart Component ────────────────────────────────────────────
function OrdersDonutChart() {
  const slices = [
    { label: 'Pending', val: 268, pct: 21.5, color: '#3b82f6' },
    { label: 'Processing', val: 352, pct: 28.2, color: '#06b6d4' },
    { label: 'Packed', val: 276, pct: 22.1, color: '#10b981' },
    { label: 'Shipped', val: 228, pct: 18.3, color: '#f59e0b' },
    { label: 'Delivered', val: 124, pct: 9.9, color: '#6366f1' },
  ];

  const r = 58, cx = 70, cy = 70, circ = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-2">
      {/* SVG Donut */}
      <div className="relative w-[140px] h-[140px] flex-shrink-0">
        <svg width="140" height="140" viewBox="0 0 140 140">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f8fafc" strokeWidth="20" />
          {slices.map((s) => {
            const da = `${(s.pct / 100) * circ} ${circ}`;
            const do_ = -offset * circ / 100;
            offset += s.pct;
            return (
              <circle
                key={s.label}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth="20"
                strokeDasharray={da}
                strokeDashoffset={do_}
                transform={`rotate(-90 ${cx} ${cy})`}
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <p className="text-xl sm:text-2xl font-extrabold text-slate-800 leading-none">1,248</p>
          <p className="text-[10px] text-slate-400 font-medium mt-0.5">Total Orders</p>
        </div>
      </div>

      {/* Legend List */}
      <div className="flex flex-col gap-2 flex-1 w-full min-w-0">
        {slices.map((s) => (
          <div key={s.label} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
              <span className="text-slate-600 font-medium truncate">{s.label}</span>
            </div>
            <span className="text-slate-500 font-semibold flex-shrink-0">
              {s.val} <span className="text-slate-400 font-normal">({s.pct}%)</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Status Badge Component ───────────────────────────────────────────────────
function OrderBadge({ status }: { status: string }) {
  const badgeStyles: Record<string, string> = {
    Delivered: 'bg-emerald-50 text-emerald-600 border-emerald-200/70',
    Shipped: 'bg-sky-50 text-sky-600 border-sky-200/70',
    Processing: 'bg-amber-50 text-amber-600 border-amber-200/70',
    Packed: 'bg-purple-50 text-purple-600 border-purple-200/70',
    Pending: 'bg-orange-50 text-orange-600 border-orange-200/70',
  };

  return (
    <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-md border whitespace-nowrap ${badgeStyles[status] || 'bg-slate-50 text-slate-600'}`}>
      • {status}
    </span>
  );
}

export default function DashboardClient() {
  const [period, setPeriod] = useState('Monthly');

  const statCards = [
    {
      title: 'Total Orders',
      value: '1,248',
      change: '18.5% vs last month',
      bgColor: 'bg-indigo-50/80',
      iconColor: 'text-indigo-600',
      icon: <ShoppingBag size={22} />,
    },
    {
      title: 'Total Sales',
      value: '₹ 24,85,300',
      change: '22.4% vs last month',
      bgColor: 'bg-sky-50/80',
      iconColor: 'text-sky-600',
      icon: <Store size={22} />,
    },
    {
      title: 'Total Items',
      value: '2,345',
      change: '8.3% vs last month',
      bgColor: 'bg-emerald-50/80',
      iconColor: 'text-emerald-600',
      icon: <Package size={22} />,
    },
    {
      title: 'Inventory Value',
      value: '₹ 18,75,600',
      change: '15.7% vs last month',
      bgColor: 'bg-amber-50/80',
      iconColor: 'text-amber-600',
      icon: <CreditCard size={22} />,
    },
    {
      title: 'Total Employees',
      value: '126',
      change: '5.2% vs last month',
      bgColor: 'bg-pink-50/80',
      iconColor: 'text-pink-600',
      icon: <Users size={22} />,
    },
  ];

  const recentOrders = [
    { id: '#ORD-1258', name: 'Ramesh Singh', time: 'Today, 10:30 AM', status: 'Delivered' },
    { id: '#ORD-1257', name: 'Priya Sharma', time: 'Today, 09:15 AM', status: 'Shipped' },
    { id: '#ORD-1256', name: 'Amit Verma', time: 'Today, 08:45 AM', status: 'Processing' },
    { id: '#ORD-1255', name: 'Sneha Patel', time: 'Yesterday, 07:30 PM', status: 'Packed' },
    { id: '#ORD-1254', name: 'Vikram Joshi', time: 'Yesterday, 06:20 PM', status: 'Pending' },
  ];

  const topSellingItems = [
    { rank: 1, name: 'Premium Hand Wash 500ml', units: '2,450 units', price: '₹ 4,85,000', img: '/images/hand_wash.png' },
    { rank: 2, name: 'Herbal Shampoo 200ml', units: '1,980 units', price: '₹ 3,95,000', img: '/images/shampoo_bottle.png' },
    { rank: 3, name: 'Face Cream 50g', units: '1,560 units', price: '₹ 3,12,000', img: '/images/face_cream.png' },
  ];

  const inventoryAlerts = [
    { name: 'Herbal Soap 100g', stock: 'Stock: 45 units', img: '/images/herbal_soap.png' },
    { name: 'Face Wash 100ml', stock: 'Stock: 32 units', img: '/images/hand_wash.png' },
    { name: 'Body Lotion 300ml', stock: 'Stock: 28 units', img: '/images/shampoo_bottle.png' },
  ];

  const yAxisLabels = ['₹ 50K', '₹ 40K', '₹ 30K', '₹ 20K', '₹ 10K', '₹ 0'];
  const xAxisLabels = ['1 May', '5 May', '10 May', '15 May', '20 May', '25 May', '30 May'];

  return (
    <div className="w-full flex flex-col gap-6">

      {/* ── 1. Title Header Row ─────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">Dashboard</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-normal">Welcome back, Arun Kumar! Here&apos;s what&apos;s happening today.</p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Date Picker Button */}
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 shadow-xs text-xs sm:text-sm font-medium text-slate-700 cursor-pointer hover:border-indigo-300 transition-colors flex-1 sm:flex-none justify-center">
            <Calendar size={15} className="text-slate-400" />
            <span>29 May 2025</span>
            <ChevronDown size={12} className="text-slate-400" />
          </div>

          {/* Quick Action Button */}
          <button className="flex items-center justify-center gap-1.5 px-4 sm:px-5 py-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 hover:from-indigo-600 hover:to-indigo-800 text-white text-xs sm:text-sm font-semibold shadow-sm transition-all hover:shadow cursor-pointer flex-1 sm:flex-none">
            <Plus size={15} />
            <span>Quick Action</span>
          </button>
        </div>
      </div>

      {/* ── 2. Top 5 Stat Cards Row ─────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 w-full">
        {statCards.map((card) => (
          <div
            key={card.title}
            className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-xs hover:shadow-md transition-shadow flex items-center gap-3.5"
          >
            <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${card.bgColor} ${card.iconColor}`}>
              {card.icon}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-slate-500 mb-0.5">{card.title}</p>
              <p className="text-lg sm:text-xl font-extrabold text-slate-900 leading-tight truncate">{card.value}</p>
              <p className="text-[11px] font-semibold text-emerald-600 mt-1 flex items-center gap-1">
                <span>↑</span> {card.change}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* ── 3. Middle Row (Sales Overview, Orders Status, Recent Orders) ──── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5 w-full items-stretch">

        {/* Card 1: Sales Overview (5 Cols on Desktop) */}
        <div className="col-span-1 md:col-span-2 lg:col-span-5 bg-white rounded-xl sm:rounded-2xl p-5 sm:p-6 border border-slate-100 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm sm:text-base font-bold text-slate-900">Sales Overview</h2>
            <CustomSelect
              options={[
                { value: 'Monthly', label: 'Monthly' },
                { value: 'Weekly', label: 'Weekly' },
                { value: 'Yearly', label: 'Yearly' },
              ]}
              value={period}
              onChange={setPeriod}
              size="sm"
            />
          </div>

          <div className="flex items-center gap-4 mb-4 text-xs font-medium">
            <div className="flex items-center gap-2 text-slate-600">
              <span className="w-4 h-0.5 bg-indigo-600 rounded-full inline-block" />
              This Month
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <span className="w-4 h-0.5 bg-slate-300 rounded-full inline-block" />
              Last Month
            </div>
          </div>

          {/* Chart + Y-Axis */}
          <div className="flex items-stretch gap-3 flex-1">
            <div className="flex flex-col justify-between text-[10px] sm:text-[11px] text-slate-400 font-medium py-0.5 w-8 flex-shrink-0">
              {yAxisLabels.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>

            <div className="flex-1 flex flex-col justify-between min-w-0">
              <div className="h-40 sm:h-44 w-full pt-1">
                <SalesOverviewChart />
              </div>
              <div className="flex justify-between text-[10px] sm:text-[11px] text-slate-400 font-medium pt-2 border-t border-slate-100 mt-2">
                {xAxisLabels.map((label) => (
                  <span key={label}>{label}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Orders Status (3 Cols on Desktop) */}
        <div className="col-span-1 md:col-span-1 lg:col-span-3 bg-white rounded-xl sm:rounded-2xl p-5 sm:p-6 border border-slate-100 shadow-xs flex flex-col justify-between">
          <h2 className="text-sm sm:text-base font-bold text-slate-900 mb-2">Orders Status</h2>
          <OrdersDonutChart />
        </div>

        {/* Card 3: Recent Orders (4 Cols on Desktop) */}
        <div className="col-span-1 md:col-span-1 lg:col-span-4 bg-white rounded-xl sm:rounded-2xl p-5 sm:p-6 border border-slate-100 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm sm:text-base font-bold text-slate-900">Recent Orders</h2>
            <button className="text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors cursor-pointer">
              View All
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {recentOrders.map((order) => (
              <div key={order.id} className="flex items-center justify-between py-2 sm:py-2.5">
                <div>
                  <p className="text-xs font-bold text-slate-800">{order.id}</p>
                  <p className="text-xs text-slate-600 font-medium mt-0.5">{order.name}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{order.time}</p>
                </div>
                <OrderBadge status={order.status} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 4. Bottom Row (Top Selling, Inventory Alert, Manufacturing & Packing) ─ */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 w-full items-stretch">

        {/* Card 1: Top Selling Items */}
        <div className="col-span-1 bg-white rounded-xl sm:rounded-2xl p-5 sm:p-6 border border-slate-100 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm sm:text-base font-bold text-slate-900">Top Selling Items</h2>
            <button className="text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors cursor-pointer">
              View All
            </button>
          </div>

          <div className="space-y-3.5">
            {topSellingItems.map((item) => (
              <div key={item.name} className="flex items-center gap-3">
                <span className="w-5 h-5 rounded bg-indigo-600 text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">
                  {item.rank}
                </span>
                <div className="relative w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 overflow-hidden flex-shrink-0">
                  <Image src={item.img} alt={item.name} fill className="object-contain p-1" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-800 truncate">{item.name}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{item.units}</p>
                </div>
                <p className="text-xs font-extrabold text-slate-900 flex-shrink-0">{item.price}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Card 2: Inventory Alert */}
        <div className="col-span-1 bg-white rounded-xl sm:rounded-2xl p-5 sm:p-6 border border-slate-100 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm sm:text-base font-bold text-slate-900">Inventory Alert</h2>
            <button className="text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors cursor-pointer">
              View All
            </button>
          </div>

          <div className="space-y-3.5">
            {inventoryAlerts.map((item) => (
              <div key={item.name} className="flex items-center gap-3">
                <div className="relative w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 overflow-hidden flex-shrink-0">
                  <Image src={item.img} alt={item.name} fill className="object-contain p-1" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-800 truncate">{item.name}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{item.stock}</p>
                </div>
                <span className="text-[10px] font-bold text-red-500 bg-red-50 border border-red-100 px-2 py-0.5 rounded-md flex-shrink-0">
                  Low Stock
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Card 3: Manufacturing & Packing */}
        <div className="col-span-1 md:col-span-2 lg:col-span-1 bg-white rounded-xl sm:rounded-2xl p-5 sm:p-6 border border-slate-100 shadow-xs flex flex-col justify-between">
          <h2 className="text-sm sm:text-base font-bold text-slate-900 mb-4">Manufacturing &amp; Packing</h2>

          <div className="grid grid-cols-2 gap-3.5">
            {/* Manufacturing Card */}
            <div className="rounded-xl p-3.5 bg-purple-50/70 border border-purple-100 hover:border-purple-200 transition-colors cursor-pointer group flex flex-col justify-between">
              <div>
                <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center mb-2.5 shadow-xs">
                  <Factory size={18} />
                </div>
                <p className="text-xs font-semibold text-slate-600">Manufacturing Units</p>
                <p className="text-2xl sm:text-3xl font-black text-slate-900 mt-1 leading-tight">3</p>
                <p className="text-[11px] text-slate-400 mt-0.5 font-medium">Active Units</p>
              </div>
              <p className="text-xs font-bold text-indigo-600 mt-3 group-hover:translate-x-1 transition-transform flex items-center gap-1">
                <span>View Details</span>
                <ArrowRight size={12} />
              </p>
            </div>

            {/* Packing Card */}
            <div className="rounded-xl p-3.5 bg-amber-50/70 border border-amber-100 hover:border-amber-200 transition-colors cursor-pointer group flex flex-col justify-between">
              <div>
                <div className="w-9 h-9 rounded-lg bg-amber-500 text-white flex items-center justify-center mb-2.5 shadow-xs">
                  <Package size={18} />
                </div>
                <p className="text-xs font-semibold text-slate-600">Packing Units</p>
                <p className="text-2xl sm:text-3xl font-black text-slate-900 mt-1 leading-tight">2</p>
                <p className="text-[11px] text-slate-400 mt-0.5 font-medium">Active Units</p>
              </div>
              <p className="text-xs font-bold text-amber-600 mt-3 group-hover:translate-x-1 transition-transform flex items-center gap-1">
                <span>View Details</span>
                <ArrowRight size={12} />
              </p>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}

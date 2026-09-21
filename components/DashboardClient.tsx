'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  ShoppingBag,
  Store,
  Coins,
  Receipt,
  CreditCard,
  TrendingUp,
  ArrowUpRight,
  ArrowRight,
  Calendar,
  Wallet,
  Smartphone,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  Filter,
  Layers,
  Sparkles,
  RefreshCw,
  UserCheck,
  PieChart,
  BarChart3,
  ExternalLink,
  Plus,
  HelpCircle,
} from 'lucide-react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import CustomDatePicker from '@/components/CustomDatePicker';

// ─── TYPES ──────────────────────────────────────────────────────────────────
interface BaseRecord {
  id: string;
  dateStr: string; // 'YYYY-MM-DD'
  timestamp: number;
}

interface OrderRecord extends BaseRecord {
  orderId: string;
  customerName: string;
  customerMobile: string;
  totalAmount: number;
  receivedAmount: number;
  balanceDue: number;
  paymentMode: string;
  paymentStatus: string;
  orderStatus: string;
  orderType: string;
  isWalkIn: boolean;
  payments?: { mode: string; amount: number }[];
}

interface LiveSaleRecord extends BaseRecord {
  receiptNumber: string;
  customerName: string;
  customerPhone: string;
  grandTotal: number;
  receivedAmount: number;
  creditAmount: number;
  paymentMode: string;
  paymentStatus: string;
  splitCash: number;
  splitUpi: number;
}

interface LooseSaleRecord extends BaseRecord {
  employeeName: string;
  amount: number;
  paymentMode: string;
  splitCash: number;
  splitUpi: number;
  splitCard: number;
  note: string;
}

type PeriodPreset = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'this_year' | 'all' | 'custom';

// ─── CURRENCY FORMATTER ─────────────────────────────────────────────────────
function formatINR(val: number): string {
  if (isNaN(val) || val === null || val === undefined) return '₹0';
  return '₹' + Number(val).toLocaleString('en-IN', {
    maximumFractionDigits: 2,
  });
}

function formatCompactINR(val: number): string {
  if (isNaN(val) || val === null || val === undefined) return '₹0';
  if (val >= 10000000) {
    const cr = (val / 10000000).toLocaleString('en-IN', { maximumFractionDigits: 2 });
    return `₹${cr} Cr`;
  }
  if (val >= 100000) {
    const lk = (val / 100000).toLocaleString('en-IN', { maximumFractionDigits: 2 });
    return `₹${lk} L`;
  }
  if (val >= 1000) {
    const k = (val / 1000).toLocaleString('en-IN', { maximumFractionDigits: 1 });
    return `₹${k} K`;
  }
  return `₹${Math.round(val)}`;
}

// ─── DATE HELPERS ────────────────────────────────────────────────────────────
function getTodayStr(): string {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

function getYesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

function extractDateStr(rawDate: any): string {
  if (!rawDate) return '';
  if (typeof rawDate === 'string') {
    if (rawDate.includes('T')) return rawDate.split('T')[0];
    if (rawDate.match(/^\d{4}-\d{2}-\d{2}/)) return rawDate.substring(0, 10);
    return rawDate;
  }
  if (rawDate.toDate && typeof rawDate.toDate === 'function') {
    return rawDate.toDate().toISOString().split('T')[0];
  }
  if (rawDate.seconds) {
    return new Date(rawDate.seconds * 1000).toISOString().split('T')[0];
  }
  return '';
}

function extractTimestamp(rawDate: any): number {
  if (!rawDate) return Date.now();
  if (rawDate.toDate && typeof rawDate.toDate === 'function') {
    return rawDate.toDate().getTime();
  }
  if (rawDate.seconds) {
    return rawDate.seconds * 1000;
  }
  if (typeof rawDate === 'string') {
    const t = new Date(rawDate).getTime();
    if (!isNaN(t)) return t;
  }
  return Date.now();
}

// ─── SVG DONUT CHART COMPONENT ───────────────────────────────────────────────
interface DonutSlice {
  label: string;
  value: number;
  pct: number;
  color: string;
  subtext?: string;
}

function SvgDonutChart({
  slices,
  centerTitle,
  centerSub,
  size = 170,
  strokeWidth = 24,
}: {
  slices: DonutSlice[];
  centerTitle: string;
  centerSub: string;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  let cumulativeOffset = 0;
  const totalVal = slices.reduce((acc, s) => acc + s.value, 0);

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6 justify-center w-full">
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-[-90deg]">
          {/* Background circle */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="transparent"
            stroke="#f1f5f9"
            strokeWidth={strokeWidth}
          />

          {/* Slices */}
          {totalVal > 0 &&
            slices.map((slice, i) => {
              const sliceRatio = slice.value / totalVal;
              const dashArray = `${sliceRatio * circumference} ${circumference}`;
              const dashOffset = -cumulativeOffset * circumference;
              cumulativeOffset += sliceRatio;

              return (
                <circle
                  key={i}
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="transparent"
                  stroke={slice.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={dashArray}
                  strokeDashoffset={dashOffset}
                  strokeLinecap="round"
                  className="transition-all duration-500 ease-out"
                />
              );
            })}
        </svg>

        {/* Center Text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-2">
          <span className="text-base sm:text-lg font-medium text-slate-800 tracking-tight leading-none truncate max-w-[110px]">
            {centerTitle}
          </span>
          <span className="text-[11px] font-normal text-slate-400 mt-1 uppercase tracking-wider">
            {centerSub}
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-col gap-2.5 flex-1 min-w-[190px]">
        {slices.map((s, idx) => (
          <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-slate-100 last:border-b-0">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
              <span className="text-slate-600 font-medium">{s.label}</span>
            </div>
            <div className="text-right">
              <span className="text-slate-800 font-medium">{formatCompactINR(s.value)}</span>
              <span className="text-[11px] text-slate-400 ml-1.5 font-normal">({s.pct.toFixed(1)}%)</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── SVG REVENUE TIMELINE CHART COMPONENT ───────────────────────────────────
function RevenueTimelineChart({
  data,
}: {
  data: { label: string; amount: number; date: string }[];
}) {
  if (!data || data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-xs text-slate-400 font-normal">
        No transaction activity recorded for this period
      </div>
    );
  }

  const width = 600;
  const height = 180;
  const paddingX = 35;
  const paddingY = 25;
  const graphWidth = width - paddingX * 2;
  const graphHeight = height - paddingY * 2;

  const maxVal = Math.max(...data.map((d) => d.amount), 100);

  // Generate SVG Points
  const points = data.map((d, i) => {
    const x = paddingX + (i / (Math.max(data.length - 1, 1))) * graphWidth;
    const y = paddingY + graphHeight - (d.amount / maxVal) * graphHeight;
    return { x, y, ...d };
  });

  const pathD = points.reduce((acc, pt, i) => {
    return i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
  }, '');

  const areaD = `${pathD} L ${points[points.length - 1].x} ${height - paddingY} L ${points[0].x} ${height - paddingY} Z`;

  return (
    <div className="w-full flex flex-col gap-2">
      <div className="w-full h-48 relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible" preserveAspectRatio="none">
          <defs>
            <linearGradient id="dashboardRevenueGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#02626D" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#02626D" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 0.33, 0.66, 1].map((ratio, idx) => {
            const y = paddingY + graphHeight * (1 - ratio);
            return (
              <g key={idx}>
                <line
                  x1={paddingX}
                  y1={y}
                  x2={width - paddingX}
                  y2={y}
                  stroke="#f1f5f9"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
                <text x={paddingX - 6} y={y + 3} textAnchor="end" fontSize="9" fill="#94a3b8">
                  {formatCompactINR(maxVal * ratio)}
                </text>
              </g>
            );
          })}

          {/* Area Fill */}
          <path d={areaD} fill="url(#dashboardRevenueGrad)" />

          {/* Line */}
          <path d={pathD} fill="none" stroke="#02626D" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

          {/* Data Points */}
          {points.map((pt, idx) => (
            <g key={idx} className="group cursor-pointer">
              <circle
                cx={pt.x}
                cy={pt.y}
                r="3.5"
                fill="#ffffff"
                stroke="#02626D"
                strokeWidth="2.5"
                className="transition-transform duration-200 group-hover:scale-150"
              />
            </g>
          ))}
        </svg>
      </div>

      {/* X-Axis labels */}
      <div className="flex justify-between items-center text-[10px] text-slate-400 font-normal px-6 pt-1 border-t border-slate-100">
        {points
          .filter((_, idx) => idx === 0 || idx === Math.floor(points.length / 2) || idx === points.length - 1)
          .map((pt, idx) => (
            <span key={idx} className="truncate">
              {pt.label}
            </span>
          ))}
      </div>
    </div>
  );
}

// ─── MAIN DASHBOARD CLIENT ──────────────────────────────────────────────────
export default function DashboardClient() {
  // 1. Data States
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [liveSales, setLiveSales] = useState<LiveSaleRecord[]>([]);
  const [looseSales, setLooseSales] = useState<LooseSaleRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // 2. Filter States
  const [period, setPeriod] = useState<PeriodPreset>('today');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [creditSearch, setCreditSearch] = useState<string>('');

  // 3. Real-Time Listeners
  useEffect(() => {
    setLoading(true);

    // 1) Orders Listener
    const unsubOrders = onSnapshot(collection(db, 'orders'), (snapshot) => {
      const list: OrderRecord[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        const tot = parseFloat(d.totalAmount || d.grandTotal || 0) || 0;
        const rec = parseFloat(d.receivedAmount || 0) || 0;
        const isWalkIn =
          d.orderType === 'Walk-in POS' ||
          (d.orderId && d.orderId.startsWith('POS-')) ||
          (d.code && d.code.startsWith('POS-'));

        const dateStr = extractDateStr(d.orderDate || d.manufacturingDate || d.createdAt || d.deliveryDate);
        const timestamp = extractTimestamp(d.createdAt || d.orderDate);

        return {
          id: docSnap.id,
          orderId: d.orderId || d.code || `#ORD-${docSnap.id.slice(0, 5).toUpperCase()}`,
          customerName: d.customerName || 'Walk-in Guest',
          customerMobile: d.customerMobile || d.phone || '',
          totalAmount: tot,
          receivedAmount: rec,
          balanceDue: Math.max(0, tot - rec),
          paymentMode: d.paymentMode || 'Cash',
          paymentStatus: d.paymentStatus || (rec >= tot ? 'Completed' : 'Partial'),
          orderStatus: d.orderStatus || d.status || 'Delivered',
          orderType: d.orderType || (isWalkIn ? 'Walk-in POS' : 'Normal'),
          isWalkIn,
          payments: Array.isArray(d.payments) ? d.payments : undefined,
          dateStr,
          timestamp,
        };
      });
      setOrders(list);
    });

    // 2) Live Sales Listener
    const unsubLiveSales = onSnapshot(collection(db, 'live_sales'), (snapshot) => {
      const list: LiveSaleRecord[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        const billTotal = Number(d.grandTotal) || Number(d.total) || 0;
        const receivedAmt =
          d.receivedAmount !== undefined
            ? Number(d.receivedAmount)
            : d.paymentStatus === 'Credit'
            ? 0
            : billTotal;
        const creditAmt =
          d.creditAmount !== undefined
            ? Number(d.creditAmount)
            : d.paymentStatus === 'Credit'
            ? billTotal
            : 0;

        const dateStr = extractDateStr(d.dateStr || d.date || d.createdAt);
        const timestamp = extractTimestamp(d.createdAt);

        return {
          id: docSnap.id,
          receiptNumber: d.receiptNumber || d.billNo || `#POS-${docSnap.id.substring(0, 6).toUpperCase()}`,
          customerName: d.customerName || 'Counter Guest',
          customerPhone: d.customerPhone || '',
          grandTotal: billTotal,
          receivedAmount: receivedAmt,
          creditAmount: creditAmt,
          paymentMode: d.paymentMode || 'Cash',
          paymentStatus: d.paymentStatus || (creditAmt > 0 ? 'Credit' : 'Paid'),
          splitCash: Number(d.splitCash) || 0,
          splitUpi: Number(d.splitUpi) || 0,
          dateStr,
          timestamp,
        };
      });
      setLiveSales(list);
    });

    // 3) Loose Sales Listener
    const unsubLooseSales = onSnapshot(collection(db, 'loose_sales'), (snapshot) => {
      const list: LooseSaleRecord[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        const amt = parseFloat(d.amount || 0) || 0;
        const dateStr = extractDateStr(d.date || d.dateStr || d.createdAt);
        const timestamp = extractTimestamp(d.createdAt || d.date);

        return {
          id: docSnap.id,
          employeeName: d.employeeName || 'Staff Member',
          amount: amt,
          paymentMode: d.paymentMode || 'Cash',
          splitCash: parseFloat(d.splitCash || 0) || 0,
          splitUpi: parseFloat(d.splitUpi || 0) || 0,
          splitCard: parseFloat(d.splitCard || 0) || 0,
          note: d.note || d.notes || '',
          dateStr,
          timestamp,
        };
      });
      setLooseSales(list);
      setLoading(false);
    });

    return () => {
      unsubOrders();
      unsubLiveSales();
      unsubLooseSales();
    };
  }, []);

  // 4. Period Filtering Helper
  const isDateInPeriod = (dateStr: string, timestamp: number) => {
    if (period === 'all') return true;

    const todayStr = getTodayStr();
    const yesterdayStr = getYesterdayStr();

    if (period === 'today') {
      return dateStr === todayStr;
    }
    if (period === 'yesterday') {
      return dateStr === yesterdayStr;
    }
    if (period === 'this_week') {
      const itemDate = new Date(timestamp || dateStr);
      const now = new Date();
      const diffDays = (now.getTime() - itemDate.getTime()) / (1000 * 3600 * 24);
      return diffDays >= 0 && diffDays <= 7;
    }
    if (period === 'this_month') {
      const itemDate = new Date(timestamp || dateStr);
      const now = new Date();
      return (
        itemDate.getFullYear() === now.getFullYear() &&
        itemDate.getMonth() === now.getMonth()
      );
    }
    if (period === 'this_year') {
      const itemDate = new Date(timestamp || dateStr);
      const now = new Date();
      return itemDate.getFullYear() === now.getFullYear();
    }
    if (period === 'custom') {
      if (!customStart && !customEnd) return true;
      if (customStart && dateStr < customStart) return false;
      if (customEnd && dateStr > customEnd) return false;
      return true;
    }
    return true;
  };

  // 5. Filtered Data Sets
  const filteredOrders = useMemo(() => {
    return orders.filter(
      (o) => !o.isWalkIn && isDateInPeriod(o.dateStr, o.timestamp)
    );
  }, [orders, period, customStart, customEnd]);

  const filteredWalkInOrders = useMemo(() => {
    return orders.filter(
      (o) => o.isWalkIn && isDateInPeriod(o.dateStr, o.timestamp)
    );
  }, [orders, period, customStart, customEnd]);

  const filteredLiveSales = useMemo(() => {
    return liveSales.filter((ls) => isDateInPeriod(ls.dateStr, ls.timestamp));
  }, [liveSales, period, customStart, customEnd]);

  const filteredLooseSales = useMemo(() => {
    return looseSales.filter((ls) => isDateInPeriod(ls.dateStr, ls.timestamp));
  }, [looseSales, period, customStart, customEnd]);

  // 6. Metrics Aggregation
  const metrics = useMemo(() => {
    // 1) Orders Channel
    let ordersRev = 0;
    let ordersCash = 0;
    let ordersUpi = 0;
    let ordersCard = 0;

    filteredOrders.forEach((o) => {
      const rec = o.receivedAmount > 0 ? o.receivedAmount : (o.paymentStatus === 'Completed' || o.paymentStatus === 'Paid' ? o.totalAmount : 0);
      ordersRev += rec;

      if (o.payments && o.payments.length > 0) {
        o.payments.forEach((p) => {
          const mode = (p.mode || '').toLowerCase();
          const amt = Number(p.amount) || 0;
          if (mode.includes('cash')) ordersCash += amt;
          else if (mode.includes('upi')) ordersUpi += amt;
          else if (mode.includes('card')) ordersCard += amt;
          else ordersUpi += amt;
        });
      } else {
        const mode = (o.paymentMode || '').toLowerCase();
        if (mode.includes('cash')) ordersCash += rec;
        else if (mode.includes('card')) ordersCard += rec;
        else ordersUpi += rec; // default fallback
      }
    });

    // 2) Walk-in POS Channel
    let posRev = 0;
    let posCash = 0;
    let posUpi = 0;
    let posCard = 0;

    filteredWalkInOrders.forEach((o) => {
      const rec = o.receivedAmount > 0 ? o.receivedAmount : o.totalAmount;
      posRev += rec;

      const mode = (o.paymentMode || '').toLowerCase();
      if (mode.includes('cash')) posCash += rec;
      else if (mode.includes('card')) posCard += rec;
      else posUpi += rec;
    });

    // 3) Live Sales Channel
    let liveRev = 0;
    let liveCash = 0;
    let liveUpi = 0;
    let liveCard = 0;

    filteredLiveSales.forEach((ls) => {
      const rec = ls.receivedAmount;
      liveRev += rec;

      if (ls.paymentMode === 'Split') {
        liveCash += ls.splitCash;
        liveUpi += ls.splitUpi;
      } else {
        const mode = (ls.paymentMode || '').toLowerCase();
        if (mode.includes('cash')) liveCash += rec;
        else if (mode.includes('card')) liveCard += rec;
        else liveUpi += rec;
      }
    });

    // 4) Loose Sales Channel
    let looseRev = 0;
    let looseCash = 0;
    let looseUpi = 0;
    let looseCard = 0;

    filteredLooseSales.forEach((ls) => {
      const amt = ls.amount;
      looseRev += amt;

      if (ls.paymentMode === 'Split') {
        looseCash += ls.splitCash;
        looseUpi += ls.splitUpi;
        looseCard += ls.splitCard;
      } else {
        const mode = (ls.paymentMode || '').toLowerCase();
        if (mode.includes('cash')) looseCash += amt;
        else if (mode.includes('card')) looseCard += amt;
        else looseUpi += amt;
      }
    });

    // 5) Grand Totals
    const totalRevenue = ordersRev + posRev + liveRev + looseRev;
    const totalTransactions =
      filteredOrders.length +
      filteredWalkInOrders.length +
      filteredLiveSales.length +
      filteredLooseSales.length;

    const totalCash = ordersCash + posCash + liveCash + looseCash;
    const totalUpi = ordersUpi + posUpi + liveUpi + looseUpi;
    const totalCard = ordersCard + posCard + liveCard + looseCard;

    return {
      totalRevenue,
      totalTransactions,
      aov: totalTransactions > 0 ? totalRevenue / totalTransactions : 0,

      // Channel Totals
      orders: {
        count: filteredOrders.length,
        revenue: ordersRev,
        cash: ordersCash,
        upi: ordersUpi,
        card: ordersCard,
        share: totalRevenue > 0 ? (ordersRev / totalRevenue) * 100 : 0,
      },
      pos: {
        count: filteredWalkInOrders.length,
        revenue: posRev,
        cash: posCash,
        upi: posUpi,
        card: posCard,
        share: totalRevenue > 0 ? (posRev / totalRevenue) * 100 : 0,
      },
      live: {
        count: filteredLiveSales.length,
        revenue: liveRev,
        cash: liveCash,
        upi: liveUpi,
        card: liveCard,
        share: totalRevenue > 0 ? (liveRev / totalRevenue) * 100 : 0,
      },
      loose: {
        count: filteredLooseSales.length,
        revenue: looseRev,
        cash: looseCash,
        upi: looseUpi,
        card: looseCard,
        share: totalRevenue > 0 ? (looseRev / totalRevenue) * 100 : 0,
      },

      // Payment Modes Total
      payments: {
        totalCash,
        totalUpi,
        totalCard,
        cashPct: totalRevenue > 0 ? (totalCash / totalRevenue) * 100 : 0,
        upiPct: totalRevenue > 0 ? (totalUpi / totalRevenue) * 100 : 0,
        cardPct: totalRevenue > 0 ? (totalCard / totalRevenue) * 100 : 0,
      },
    };
  }, [filteredOrders, filteredWalkInOrders, filteredLiveSales, filteredLooseSales]);

  // 7. Credit & Dues Details (All Pending Balances)
  const creditDetails = useMemo(() => {
    // 1) Credit from Orders
    const orderDues = orders
      .filter((o) => o.balanceDue > 0.5)
      .map((o) => ({
        id: o.id,
        refNo: o.orderId,
        source: 'Orders',
        customerName: o.customerName,
        customerPhone: o.customerMobile,
        totalAmount: o.totalAmount,
        paidAmount: o.receivedAmount,
        dueAmount: o.balanceDue,
        dateStr: o.dateStr,
        status: o.paymentStatus || 'Pending Due',
        detailUrl: `/orders/${o.id}`,
      }));

    // 2) Credit from Live Sales
    const liveDues = liveSales
      .filter((ls) => ls.creditAmount > 0.5)
      .map((ls) => ({
        id: ls.id,
        refNo: ls.receiptNumber,
        source: 'Live POS',
        customerName: ls.customerName,
        customerPhone: ls.customerPhone,
        totalAmount: ls.grandTotal,
        paidAmount: ls.receivedAmount,
        dueAmount: ls.creditAmount,
        dateStr: ls.dateStr,
        status: 'Credit Due',
        detailUrl: `/credit`,
      }));

    const combinedList = [...orderDues, ...liveDues].sort((a, b) => b.dueAmount - a.dueAmount);

    const totalOrdersDue = orderDues.reduce((acc, c) => acc + c.dueAmount, 0);
    const totalLiveDue = liveDues.reduce((acc, c) => acc + c.dueAmount, 0);
    const totalOutstanding = totalOrdersDue + totalLiveDue;

    const filteredList = combinedList.filter((item) => {
      if (!creditSearch.trim()) return true;
      const q = creditSearch.toLowerCase();
      return (
        item.customerName.toLowerCase().includes(q) ||
        item.customerPhone.includes(q) ||
        item.refNo.toLowerCase().includes(q)
      );
    });

    return {
      totalOutstanding,
      totalOrdersDue,
      totalLiveDue,
      totalAccounts: combinedList.length,
      list: filteredList,
    };
  }, [orders, liveSales, creditSearch]);

  // 8. Timeline Chart Data Points
  const timelineData = useMemo(() => {
    // Collect all transactions in selected period
    const dateMap = new Map<string, number>();

    const addRecord = (dateStr: string, amt: number) => {
      if (!dateStr || amt <= 0) return;
      dateMap.set(dateStr, (dateMap.get(dateStr) || 0) + amt);
    };

    filteredOrders.forEach((o) => addRecord(o.dateStr, o.receivedAmount));
    filteredWalkInOrders.forEach((o) => addRecord(o.dateStr, o.receivedAmount || o.totalAmount));
    filteredLiveSales.forEach((ls) => addRecord(ls.dateStr, ls.receivedAmount));
    filteredLooseSales.forEach((ls) => addRecord(ls.dateStr, ls.amount));

    const sortedDates = Array.from(dateMap.keys()).sort();

    return sortedDates.map((date) => {
      const dObj = new Date(date);
      const label = dObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      return {
        date,
        label,
        amount: dateMap.get(date) || 0,
      };
    });
  }, [filteredOrders, filteredWalkInOrders, filteredLiveSales, filteredLooseSales]);

  // 9. Recent Activity Stream across all 4 channels
  const recentActivity = useMemo(() => {
    const list: {
      id: string;
      source: 'Order' | 'POS' | 'Live' | 'Loose';
      title: string;
      subtitle: string;
      amount: number;
      paymentMode: string;
      timestamp: number;
      badgeColor: string;
    }[] = [];

    orders.slice(0, 8).forEach((o) => {
      list.push({
        id: o.id,
        source: o.isWalkIn ? 'POS' : 'Order',
        title: `${o.orderId} • ${o.customerName}`,
        subtitle: o.dateStr || 'Recent Order',
        amount: o.receivedAmount > 0 ? o.receivedAmount : o.totalAmount,
        paymentMode: o.paymentMode,
        timestamp: o.timestamp,
        badgeColor: o.isWalkIn ? 'bg-sky-50 text-sky-700 border-sky-200' : 'bg-[#02626D]/10 text-[#02626D] border-[#02626D]/20',
      });
    });

    liveSales.slice(0, 8).forEach((ls) => {
      list.push({
        id: ls.id,
        source: 'Live',
        title: `${ls.receiptNumber} • ${ls.customerName}`,
        subtitle: ls.dateStr || 'Counter Sale',
        amount: ls.receivedAmount,
        paymentMode: ls.paymentMode,
        timestamp: ls.timestamp,
        badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
      });
    });

    looseSales.slice(0, 8).forEach((ls) => {
      list.push({
        id: ls.id,
        source: 'Loose',
        title: `Loose Sale • ${ls.employeeName}`,
        subtitle: ls.dateStr || 'Employee Quick Entry',
        amount: ls.amount,
        paymentMode: ls.paymentMode,
        timestamp: ls.timestamp,
        badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
      });
    });

    return list.sort((a, b) => b.timestamp - a.timestamp).slice(0, 7);
  }, [orders, liveSales, looseSales]);

  return (
    <div className="w-full flex flex-col gap-6 text-slate-800 pb-12">
      {/* ── 1. HEADER & PERIOD FILTER TOOLBAR ───────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-1">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-medium text-slate-900 tracking-tight">Executive Dashboard</h1>
            <span className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Sync
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-normal">
            Real-time unified revenue and business performance across all retail &amp; wholesale streams.
          </p>
        </div>

        {/* Quick Date Range Selectors */}
        <div className="flex flex-wrap items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200/90 shadow-2xs">
          {[
            { key: 'today', label: 'Today' },
            { key: 'yesterday', label: 'Yesterday' },
            { key: 'this_week', label: 'This Week' },
            { key: 'this_month', label: 'This Month' },
            { key: 'this_year', label: 'Year' },
            { key: 'all', label: 'All Time' },
            { key: 'custom', label: 'Custom' },
          ].map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key as PeriodPreset)}
              className={`h-[34px] max-h-[34px] px-3 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                period === p.key
                  ? 'bg-[#02626D] text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Date Picker Sub-row */}
      {period === 'custom' && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">From:</span>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="h-[34px] max-h-[34px] px-3 bg-white border border-slate-300 rounded-lg text-xs text-slate-700 outline-none focus:border-[#02626D]"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">To:</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="h-[34px] max-h-[34px] px-3 bg-white border border-slate-300 rounded-lg text-xs text-slate-700 outline-none focus:border-[#02626D]"
            />
          </div>
          {(customStart || customEnd) && (
            <button
              onClick={() => {
                setCustomStart('');
                setCustomEnd('');
              }}
              className="h-[34px] max-h-[34px] px-3 text-slate-500 hover:text-slate-800 text-xs font-medium cursor-pointer"
            >
              Clear Range
            </button>
          )}
        </div>
      )}

      {/* ── 2. HERO TOTAL REVENUE CARD ─────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-[#02626D] via-[#024E57] to-[#01353B] rounded-2xl p-6 text-white shadow-sm relative overflow-hidden">
        {/* Subtle decorative background pattern */}
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-8 w-64 h-64 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute right-32 bottom-0 translate-y-12 w-48 h-48 rounded-full bg-white/5 pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider text-teal-200 font-medium">Grand Total Revenue</span>
              <span className="text-[10px] bg-teal-500/30 text-teal-100 border border-teal-400/30 px-2 py-0.5 rounded-full font-medium">
                4 Channels Combined
              </span>
            </div>
            <p className="text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight text-white mt-1">
              {formatINR(metrics.totalRevenue)}
            </p>
            <div className="flex flex-wrap items-center gap-4 text-xs text-teal-100/80 mt-1 font-normal">
              <span>{metrics.totalTransactions} Total Invoices &amp; Bills</span>
              <span>•</span>
              <span>Avg Order Value: {formatINR(metrics.aov)}</span>
              <span>•</span>
              <span className="capitalize">{period.replace('_', ' ')} summary</span>
            </div>
          </div>

          {/* Channel Contribution Pills */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10 flex flex-col">
              <span className="text-[11px] text-teal-200 font-medium">Orders</span>
              <span className="text-sm font-medium text-white mt-1">{formatCompactINR(metrics.orders.revenue)}</span>
              <span className="text-[10px] text-teal-300 mt-0.5">{metrics.orders.share.toFixed(1)}% share</span>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10 flex flex-col">
              <span className="text-[11px] text-teal-200 font-medium">Billing POS</span>
              <span className="text-sm font-medium text-white mt-1">{formatCompactINR(metrics.pos.revenue)}</span>
              <span className="text-[10px] text-teal-300 mt-0.5">{metrics.pos.share.toFixed(1)}% share</span>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10 flex flex-col">
              <span className="text-[11px] text-teal-200 font-medium">Live Sales</span>
              <span className="text-sm font-medium text-white mt-1">{formatCompactINR(metrics.live.revenue)}</span>
              <span className="text-[10px] text-teal-300 mt-0.5">{metrics.live.share.toFixed(1)}% share</span>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10 flex flex-col">
              <span className="text-[11px] text-teal-200 font-medium">Loose Sales</span>
              <span className="text-sm font-medium text-white mt-1">{formatCompactINR(metrics.loose.revenue)}</span>
              <span className="text-[10px] text-teal-300 mt-0.5">{metrics.loose.share.toFixed(1)}% share</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. INDIVIDUAL CHANNEL CARDS (4 COLS) ─────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Channel 1: Orders */}
        <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-2xs hover:border-[#02626D]/50 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-teal-50 text-[#02626D] flex items-center justify-center">
                  <ShoppingBag size={18} />
                </div>
                <div>
                  <h3 className="text-xs font-medium text-slate-500">Orders Revenue</h3>
                  <p className="text-[11px] text-slate-400 font-normal">Customer &amp; Wholesale</p>
                </div>
              </div>
              <Link
                href="/orders"
                className="text-slate-400 hover:text-[#02626D] transition-colors p-1"
                title="View All Orders"
              >
                <ArrowUpRight size={16} />
              </Link>
            </div>

            <div className="mt-3">
              <p className="text-xl font-medium text-slate-900 leading-tight">
                {formatINR(metrics.orders.revenue)}
              </p>
              <div className="flex items-center justify-between text-xs mt-2 text-slate-500">
                <span>Total Orders:</span>
                <span className="font-medium text-slate-800">{metrics.orders.count}</span>
              </div>
              <div className="flex items-center justify-between text-xs mt-1 text-slate-500">
                <span>Contribution:</span>
                <span className="font-medium text-[#02626D]">{metrics.orders.share.toFixed(1)}%</span>
              </div>
            </div>
          </div>

          <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Avg Ticket:</span>
            <span className="font-medium text-slate-700">
              {metrics.orders.count > 0 ? formatCompactINR(metrics.orders.revenue / metrics.orders.count) : '₹0'}
            </span>
          </div>
        </div>

        {/* Channel 2: Billing POS / Walk-in */}
        <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-2xs hover:border-sky-400 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                  <Store size={18} />
                </div>
                <div>
                  <h3 className="text-xs font-medium text-slate-500">Billing POS</h3>
                  <p className="text-[11px] text-slate-400 font-normal">Walk-in Counter Invoices</p>
                </div>
              </div>
              <Link
                href="/walk-in-sales"
                className="text-slate-400 hover:text-sky-600 transition-colors p-1"
                title="View Walk-in Sales"
              >
                <ArrowUpRight size={16} />
              </Link>
            </div>

            <div className="mt-3">
              <p className="text-xl font-medium text-slate-900 leading-tight">
                {formatINR(metrics.pos.revenue)}
              </p>
              <div className="flex items-center justify-between text-xs mt-2 text-slate-500">
                <span>Walk-in Bills:</span>
                <span className="font-medium text-slate-800">{metrics.pos.count}</span>
              </div>
              <div className="flex items-center justify-between text-xs mt-1 text-slate-500">
                <span>Contribution:</span>
                <span className="font-medium text-sky-600">{metrics.pos.share.toFixed(1)}%</span>
              </div>
            </div>
          </div>

          <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Avg Ticket:</span>
            <span className="font-medium text-slate-700">
              {metrics.pos.count > 0 ? formatCompactINR(metrics.pos.revenue / metrics.pos.count) : '₹0'}
            </span>
          </div>
        </div>

        {/* Channel 3: Live Sales */}
        <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-2xs hover:border-purple-400 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Receipt size={18} />
                </div>
                <div>
                  <h3 className="text-xs font-medium text-slate-500">Live Sales</h3>
                  <p className="text-[11px] text-slate-400 font-normal">Direct Counter Touch POS</p>
                </div>
              </div>
              <Link
                href="/live-sales"
                className="text-slate-400 hover:text-purple-600 transition-colors p-1"
                title="View Live Sales"
              >
                <ArrowUpRight size={16} />
              </Link>
            </div>

            <div className="mt-3">
              <p className="text-xl font-medium text-slate-900 leading-tight">
                {formatINR(metrics.live.revenue)}
              </p>
              <div className="flex items-center justify-between text-xs mt-2 text-slate-500">
                <span>Live Bills:</span>
                <span className="font-medium text-slate-800">{metrics.live.count}</span>
              </div>
              <div className="flex items-center justify-between text-xs mt-1 text-slate-500">
                <span>Contribution:</span>
                <span className="font-medium text-purple-600">{metrics.live.share.toFixed(1)}%</span>
              </div>
            </div>
          </div>

          <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Avg Ticket:</span>
            <span className="font-medium text-slate-700">
              {metrics.live.count > 0 ? formatCompactINR(metrics.live.revenue / metrics.live.count) : '₹0'}
            </span>
          </div>
        </div>

        {/* Channel 4: Loose Sales */}
        <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-2xs hover:border-amber-400 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Coins size={18} />
                </div>
                <div>
                  <h3 className="text-xs font-medium text-slate-500">Loose Sales</h3>
                  <p className="text-[11px] text-slate-400 font-normal">Staff Quick Cash &amp; Sweets</p>
                </div>
              </div>
              <Link
                href="/loose-sales"
                className="text-slate-400 hover:text-amber-600 transition-colors p-1"
                title="View Loose Sales"
              >
                <ArrowUpRight size={16} />
              </Link>
            </div>

            <div className="mt-3">
              <p className="text-xl font-medium text-slate-900 leading-tight">
                {formatINR(metrics.loose.revenue)}
              </p>
              <div className="flex items-center justify-between text-xs mt-2 text-slate-500">
                <span>Loose Entries:</span>
                <span className="font-medium text-slate-800">{metrics.loose.count}</span>
              </div>
              <div className="flex items-center justify-between text-xs mt-1 text-slate-500">
                <span>Contribution:</span>
                <span className="font-medium text-amber-600">{metrics.loose.share.toFixed(1)}%</span>
              </div>
            </div>
          </div>

          <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Avg Entry:</span>
            <span className="font-medium text-slate-700">
              {metrics.loose.count > 0 ? formatCompactINR(metrics.loose.revenue / metrics.loose.count) : '₹0'}
            </span>
          </div>
        </div>
      </div>

      {/* ── 4. PAYMENT MODE BREAKDOWN (COMBINED + CHANNELS) ──────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
          <div>
            <h2 className="text-base font-medium text-slate-900">Payment Modes Breakdown</h2>
            <p className="text-xs text-slate-500 mt-0.5 font-normal">
              Amount received via Cash, UPI, and Card across all 4 channels and individually.
            </p>
          </div>

          {/* Quick summary badges */}
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-slate-600 font-medium">Cash: {formatCompactINR(metrics.payments.totalCash)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
              <span className="text-slate-600 font-medium">UPI: {formatCompactINR(metrics.payments.totalUpi)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span className="text-slate-600 font-medium">Card: {formatCompactINR(metrics.payments.totalCard)}</span>
            </div>
          </div>
        </div>

        {/* Payment Modes Matrix Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-medium">
                <th className="py-2.5 px-3">Sales Channel</th>
                <th className="py-2.5 px-3">
                  <div className="flex items-center gap-1.5">
                    <Wallet size={14} className="text-emerald-600" />
                    <span>Cash</span>
                  </div>
                </th>
                <th className="py-2.5 px-3">
                  <div className="flex items-center gap-1.5">
                    <Smartphone size={14} className="text-indigo-600" />
                    <span>UPI</span>
                  </div>
                </th>
                <th className="py-2.5 px-3">
                  <div className="flex items-center gap-1.5">
                    <CreditCard size={14} className="text-amber-600" />
                    <span>Card</span>
                  </div>
                </th>
                <th className="py-2.5 px-3 text-right">Channel Revenue</th>
                <th className="py-2.5 px-3 w-44">Mode Distribution</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {/* Row 1: Orders */}
              <tr className="hover:bg-slate-50/50 transition-colors">
                <td className="py-3 px-3 font-medium text-slate-900 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#02626D]" />
                  <span>Orders</span>
                </td>
                <td className="py-3 px-3 font-medium text-slate-800">{formatINR(metrics.orders.cash)}</td>
                <td className="py-3 px-3 font-medium text-slate-800">{formatINR(metrics.orders.upi)}</td>
                <td className="py-3 px-3 font-medium text-slate-800">{formatINR(metrics.orders.card)}</td>
                <td className="py-3 px-3 text-right font-medium text-slate-900">{formatINR(metrics.orders.revenue)}</td>
                <td className="py-3 px-3">
                  <div className="w-full h-2 rounded-full bg-slate-100 flex overflow-hidden">
                    {metrics.orders.revenue > 0 && (
                      <>
                        <div
                          style={{ width: `${(metrics.orders.cash / metrics.orders.revenue) * 100}%` }}
                          className="bg-emerald-500 h-full"
                          title={`Cash: ${formatINR(metrics.orders.cash)}`}
                        />
                        <div
                          style={{ width: `${(metrics.orders.upi / metrics.orders.revenue) * 100}%` }}
                          className="bg-indigo-500 h-full"
                          title={`UPI: ${formatINR(metrics.orders.upi)}`}
                        />
                        <div
                          style={{ width: `${(metrics.orders.card / metrics.orders.revenue) * 100}%` }}
                          className="bg-amber-500 h-full"
                          title={`Card: ${formatINR(metrics.orders.card)}`}
                        />
                      </>
                    )}
                  </div>
                </td>
              </tr>

              {/* Row 2: Billing POS */}
              <tr className="hover:bg-slate-50/50 transition-colors">
                <td className="py-3 px-3 font-medium text-slate-900 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-sky-500" />
                  <span>Billing POS (Walk-in)</span>
                </td>
                <td className="py-3 px-3 font-medium text-slate-800">{formatINR(metrics.pos.cash)}</td>
                <td className="py-3 px-3 font-medium text-slate-800">{formatINR(metrics.pos.upi)}</td>
                <td className="py-3 px-3 font-medium text-slate-800">{formatINR(metrics.pos.card)}</td>
                <td className="py-3 px-3 text-right font-medium text-slate-900">{formatINR(metrics.pos.revenue)}</td>
                <td className="py-3 px-3">
                  <div className="w-full h-2 rounded-full bg-slate-100 flex overflow-hidden">
                    {metrics.pos.revenue > 0 && (
                      <>
                        <div
                          style={{ width: `${(metrics.pos.cash / metrics.pos.revenue) * 100}%` }}
                          className="bg-emerald-500 h-full"
                          title={`Cash: ${formatINR(metrics.pos.cash)}`}
                        />
                        <div
                          style={{ width: `${(metrics.pos.upi / metrics.pos.revenue) * 100}%` }}
                          className="bg-indigo-500 h-full"
                          title={`UPI: ${formatINR(metrics.pos.upi)}`}
                        />
                        <div
                          style={{ width: `${(metrics.pos.card / metrics.pos.revenue) * 100}%` }}
                          className="bg-amber-500 h-full"
                          title={`Card: ${formatINR(metrics.pos.card)}`}
                        />
                      </>
                    )}
                  </div>
                </td>
              </tr>

              {/* Row 3: Live Sales */}
              <tr className="hover:bg-slate-50/50 transition-colors">
                <td className="py-3 px-3 font-medium text-slate-900 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-500" />
                  <span>Live Sales</span>
                </td>
                <td className="py-3 px-3 font-medium text-slate-800">{formatINR(metrics.live.cash)}</td>
                <td className="py-3 px-3 font-medium text-slate-800">{formatINR(metrics.live.upi)}</td>
                <td className="py-3 px-3 font-medium text-slate-800">{formatINR(metrics.live.card)}</td>
                <td className="py-3 px-3 text-right font-medium text-slate-900">{formatINR(metrics.live.revenue)}</td>
                <td className="py-3 px-3">
                  <div className="w-full h-2 rounded-full bg-slate-100 flex overflow-hidden">
                    {metrics.live.revenue > 0 && (
                      <>
                        <div
                          style={{ width: `${(metrics.live.cash / metrics.live.revenue) * 100}%` }}
                          className="bg-emerald-500 h-full"
                          title={`Cash: ${formatINR(metrics.live.cash)}`}
                        />
                        <div
                          style={{ width: `${(metrics.live.upi / metrics.live.revenue) * 100}%` }}
                          className="bg-indigo-500 h-full"
                          title={`UPI: ${formatINR(metrics.live.upi)}`}
                        />
                        <div
                          style={{ width: `${(metrics.live.card / metrics.live.revenue) * 100}%` }}
                          className="bg-amber-500 h-full"
                          title={`Card: ${formatINR(metrics.live.card)}`}
                        />
                      </>
                    )}
                  </div>
                </td>
              </tr>

              {/* Row 4: Loose Sales */}
              <tr className="hover:bg-slate-50/50 transition-colors">
                <td className="py-3 px-3 font-medium text-slate-900 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>Loose Sales</span>
                </td>
                <td className="py-3 px-3 font-medium text-slate-800">{formatINR(metrics.loose.cash)}</td>
                <td className="py-3 px-3 font-medium text-slate-800">{formatINR(metrics.loose.upi)}</td>
                <td className="py-3 px-3 font-medium text-slate-800">{formatINR(metrics.loose.card)}</td>
                <td className="py-3 px-3 text-right font-medium text-slate-900">{formatINR(metrics.loose.revenue)}</td>
                <td className="py-3 px-3">
                  <div className="w-full h-2 rounded-full bg-slate-100 flex overflow-hidden">
                    {metrics.loose.revenue > 0 && (
                      <>
                        <div
                          style={{ width: `${(metrics.loose.cash / metrics.loose.revenue) * 100}%` }}
                          className="bg-emerald-500 h-full"
                          title={`Cash: ${formatINR(metrics.loose.cash)}`}
                        />
                        <div
                          style={{ width: `${(metrics.loose.upi / metrics.loose.revenue) * 100}%` }}
                          className="bg-indigo-500 h-full"
                          title={`UPI: ${formatINR(metrics.loose.upi)}`}
                        />
                        <div
                          style={{ width: `${(metrics.loose.card / metrics.loose.revenue) * 100}%` }}
                          className="bg-amber-500 h-full"
                          title={`Card: ${formatINR(metrics.loose.card)}`}
                        />
                      </>
                    )}
                  </div>
                </td>
              </tr>
            </tbody>

            {/* Total Row */}
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50/80 font-medium text-slate-900">
                <td className="py-3 px-3 text-slate-900">Total Received</td>
                <td className="py-3 px-3 text-emerald-700">{formatINR(metrics.payments.totalCash)}</td>
                <td className="py-3 px-3 text-indigo-700">{formatINR(metrics.payments.totalUpi)}</td>
                <td className="py-3 px-3 text-amber-700">{formatINR(metrics.payments.totalCard)}</td>
                <td className="py-3 px-3 text-right text-slate-900 font-medium">
                  {formatINR(metrics.totalRevenue)}
                </td>
                <td className="py-3 px-3 text-[11px] text-slate-500 font-normal">
                  Cash {metrics.payments.cashPct.toFixed(0)}% • UPI {metrics.payments.upiPct.toFixed(0)}% • Card{' '}
                  {metrics.payments.cardPct.toFixed(0)}%
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ── 5. GRAPHICAL REPRESENTATIONS ROW ─────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Chart 1: Revenue Timeline Area Chart (7 Cols) */}
        <div className="col-span-1 lg:col-span-7 bg-white rounded-xl p-5 border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm sm:text-base font-medium text-slate-900">Revenue Trajectory</h2>
              <p className="text-xs text-slate-500 mt-0.5 font-normal">Daily aggregated sales curve</p>
            </div>
            <span className="text-xs font-medium text-[#02626D] bg-[#02626D]/10 px-2.5 py-1 rounded-lg">
              {formatCompactINR(metrics.totalRevenue)} Total
            </span>
          </div>

          <div className="flex-1 w-full min-h-[190px] pt-2">
            <RevenueTimelineChart data={timelineData} />
          </div>
        </div>

        {/* Chart 2: Payment Mode Donut Chart (5 Cols) */}
        <div className="col-span-1 lg:col-span-5 bg-white rounded-xl p-5 border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-sm sm:text-base font-medium text-slate-900">Payment Modes</h2>
              <p className="text-xs text-slate-500 mt-0.5 font-normal">Cash vs UPI vs Card share</p>
            </div>
          </div>

          <div className="py-3 flex-1 flex items-center justify-center">
            <SvgDonutChart
              slices={[
                {
                  label: 'UPI Payments',
                  value: metrics.payments.totalUpi,
                  pct: metrics.payments.upiPct,
                  color: '#6366F1',
                },
                {
                  label: 'Cash In Hand',
                  value: metrics.payments.totalCash,
                  pct: metrics.payments.cashPct,
                  color: '#10B981',
                },
                {
                  label: 'Card POS',
                  value: metrics.payments.totalCard,
                  pct: metrics.payments.cardPct,
                  color: '#F59E0B',
                },
              ]}
              centerTitle={formatCompactINR(metrics.totalRevenue)}
              centerSub="Collected"
            />
          </div>
        </div>
      </div>

      {/* ── 6. CREDIT DETAILS & OUTSTANDING DUES SECTION ─────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-medium text-slate-900">Credit &amp; Outstanding Dues</h2>
              <span className="text-[11px] font-medium bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full">
                {creditDetails.totalAccounts} Pending Accounts
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 font-normal">
              Active credit balances from Delivered Orders and Live POS counter transactions.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search customer, phone, invoice..."
                value={creditSearch}
                onChange={(e) => setCreditSearch(e.target.value)}
                className="h-[34px] max-h-[34px] pl-8 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-[#02626D] outline-none w-56 transition-colors"
              />
            </div>

            <Link
              href="/credit"
              className="h-[34px] max-h-[34px] px-3.5 rounded-lg bg-[#02626D] hover:bg-[#014d56] text-white text-xs font-medium transition-colors flex items-center gap-1.5 shadow-2xs"
            >
              <span>Credit Portal</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>

        {/* Credit Summary KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          <div className="bg-red-50/60 border border-red-200/80 rounded-xl p-3.5 flex items-center justify-between">
            <div>
              <p className="text-xs text-red-600 font-medium">Total Credit Outstanding</p>
              <p className="text-xl font-medium text-red-900 mt-0.5">{formatINR(creditDetails.totalOutstanding)}</p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-red-100 text-red-700 flex items-center justify-center">
              <AlertCircle size={20} />
            </div>
          </div>

          <div className="bg-orange-50/60 border border-orange-200/80 rounded-xl p-3.5 flex items-center justify-between">
            <div>
              <p className="text-xs text-orange-700 font-medium">Orders Balance Due</p>
              <p className="text-xl font-medium text-orange-900 mt-0.5">{formatINR(creditDetails.totalOrdersDue)}</p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center">
              <ShoppingBag size={20} />
            </div>
          </div>

          <div className="bg-purple-50/60 border border-purple-200/80 rounded-xl p-3.5 flex items-center justify-between">
            <div>
              <p className="text-xs text-purple-700 font-medium">Live POS Credit</p>
              <p className="text-xl font-medium text-purple-900 mt-0.5">{formatINR(creditDetails.totalLiveDue)}</p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
              <Store size={20} />
            </div>
          </div>
        </div>

        {/* Credit Dues Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-medium">
                <th className="py-2.5 px-3">Customer</th>
                <th className="py-2.5 px-3">Source Channel</th>
                <th className="py-2.5 px-3">Ref / Invoice No</th>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Total Billed</th>
                <th className="py-2.5 px-3">Amount Paid</th>
                <th className="py-2.5 px-3 text-red-600 font-medium">Outstanding Due</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {creditDetails.list.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 font-normal">
                    No pending credit accounts matching your criteria.
                  </td>
                </tr>
              ) : (
                creditDetails.list.slice(0, 8).map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-3">
                      <p className="font-medium text-slate-900">{item.customerName}</p>
                      {item.customerPhone && (
                        <p className="text-[11px] text-slate-400 font-normal mt-0.5">{item.customerPhone}</p>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`text-[11px] font-medium px-2 py-0.5 rounded-md border ${
                          item.source === 'Orders'
                            ? 'bg-teal-50 text-[#02626D] border-teal-200'
                            : 'bg-purple-50 text-purple-700 border-purple-200'
                        }`}
                      >
                        {item.source}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-700">{item.refNo}</td>
                    <td className="py-3 px-3 text-slate-500">{item.dateStr || '—'}</td>
                    <td className="py-3 px-3 text-slate-700">{formatINR(item.totalAmount)}</td>
                    <td className="py-3 px-3 text-emerald-700 font-medium">{formatINR(item.paidAmount)}</td>
                    <td className="py-3 px-3 font-medium text-red-600 bg-red-50/30">
                      {formatINR(item.dueAmount)}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <Link
                        href={item.detailUrl}
                        className="inline-flex items-center gap-1 h-[28px] max-h-[34px] px-2.5 rounded-md bg-slate-100 hover:bg-[#02626D] hover:text-white text-slate-700 text-[11px] font-medium transition-colors cursor-pointer"
                      >
                        <span>View</span>
                        <ArrowUpRight size={12} />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {creditDetails.list.length > 8 && (
          <div className="pt-3 mt-2 border-t border-slate-100 flex justify-end">
            <Link
              href="/credit"
              className="text-xs font-medium text-[#02626D] hover:underline flex items-center gap-1"
            >
              <span>View all {creditDetails.list.length} credit accounts in Credit Portal</span>
              <ArrowRight size={12} />
            </Link>
          </div>
        )}
      </div>

      {/* ── 7. RECENT TRANSACTIONS FEED (LATEST ACROSS ALL 4 CHANNELS) ───────── */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-medium text-slate-900">Recent Transactions Pulse</h2>
            <p className="text-xs text-slate-500 mt-0.5 font-normal">
              Latest live activity stream across Orders, Walk-in POS, Live Sales, and Loose Sales.
            </p>
          </div>
          <span className="text-xs text-slate-400 font-normal">Real-time update</span>
        </div>

        <div className="divide-y divide-slate-100">
          {recentActivity.map((act) => (
            <div key={`${act.source}-${act.id}`} className="py-2.5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded border uppercase ${act.badgeColor}`}>
                  {act.source}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-800 truncate">{act.title}</p>
                  <p className="text-[11px] text-slate-400 font-normal">{act.subtitle}</p>
                </div>
              </div>

              <div className="text-right flex-shrink-0">
                <p className="text-xs font-medium text-slate-900">{formatINR(act.amount)}</p>
                <span className="text-[10px] font-normal text-slate-400">{act.paymentMode}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

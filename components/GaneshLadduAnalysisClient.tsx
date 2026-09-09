'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  PieChart,
  Search,
  Printer,
  Eye,
  RefreshCw,
  Clock,
  ShoppingBag,
  Factory,
  Layers,
  X,
  Boxes,
  Flame,
  FileSpreadsheet,
  ExternalLink,
  IndianRupee,
  Filter,
  ArrowUpDown,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query } from 'firebase/firestore';
import CustomDatePicker from '@/components/CustomDatePicker';
import CustomSelect, { CustomSelectOption } from '@/components/CustomSelect';
import Pagination from '@/components/Pagination';
import { toast } from '@/context/ToastContext';

// Types
export interface OrderItemLine {
  lineId?: string;
  itemId: string;
  itemCode?: string;
  code?: string;
  itemName: string;
  category?: string;
  unit?: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  hasPacket?: boolean;
  packetCharge?: number;
  manufacturingDescription?: string;
  manufacturingNote?: string;
  mfgDesc?: string;
  notes?: string;
  packingDescription?: string;
  needsManufacturing?: boolean;
  mfgStatus?: string;
  pckStatus?: string;
}

export interface OrderRecord {
  id: string;
  code: string;
  orderId?: string;
  customerId?: string;
  customerName?: string;
  customerMobile?: string;
  orderDate?: string;
  orderTime?: string;
  manufacturingDate?: string;
  expectedDeliveryDate?: string;
  deliveryDate?: string;
  slot?: string;
  orderStatus?: string;
  paymentStatus?: string;
  items?: OrderItemLine[];
  subTotal?: number;
  grandTotal?: number;
  finalAmount?: number;
  totalAmount?: number;
  deliveryAddress?: string;
  notes?: string;
  manufacturingDescription?: string;
  createdAt?: { seconds?: number; nanoseconds?: number; toDate?: () => Date } | null;
}

export interface ItemMasterOption {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  price: number;
}

export interface LineBreakdown {
  sizes: number[];
  rawNote: string;
  hasNote: boolean;
  quantity: number;
  lineTotal: number;
}

export interface EnrichedGaneshOrder {
  order: OrderRecord;
  ganeshItems: OrderItemLine[];
  allSizes: number[];
  sizeCounts: Record<number, number>;
  rawNotes: string[];
  hasAnyNote: boolean;
  totalLadduWeight: number;
  totalPieces: number;
}

export interface SizeDistributionItem {
  size: number;
  sizeLabel: string;
  count: number;
  totalWeightKg: number;
  orderCount: number;
  percentage: number;
}

const TARGET_ITEM_CODE = 'ITM-079';

function getTodayDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getTomorrowDateStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtCurrency(amt: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amt || 0);
}

function formatSizeLabel(size: number): string {
  if (size === 0.25) return '250g';
  if (size === 0.5) return '500g';
  return `${size} KG`;
}

function getStatusBadgeStyle(status?: string): { bg: string; text: string; border: string } {
  switch (status) {
    case 'Delivered':
      return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
    case 'Order Created':
    case 'Confirmed':
      return { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' };
    case 'Moved to Manufacturing':
    case 'Manufacturing Started':
      return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' };
    case 'Manufacturing Completed':
    case 'Moved to Packing':
    case 'Packing Started':
      return { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' };
    case 'Cancelled':
    case 'Rejected':
      return { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' };
    default:
      return { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' };
  }
}

export default function GaneshLadduAnalysisClient() {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [itemsMaster, setItemsMaster] = useState<ItemMasterOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [dateField, setDateField] = useState<'delivery' | 'order' | 'mfg'>('delivery');
  const [selectedDate, setSelectedDate] = useState<string>('All');
  const [selectedSlot, setSelectedSlot] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [noteFilter, setNoteFilter] = useState<'ALL' | 'WITH_NOTE' | 'WITHOUT_NOTE'>('ALL');
  const [selectedSizeFilter, setSelectedSizeFilter] = useState<number | 'ALL'>('ALL');
  const [sizeViewMode, setSizeViewMode] = useState<'cards' | 'table'>('cards');
  const [sizeSortOrder, setSizeSortOrder] = useState<'size_asc' | 'count_desc'>('size_asc');

  // Order Details Modal
  const [viewingOrder, setViewingOrder] = useState<EnrichedGaneshOrder | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  // Sorting
  const [sortField, setSortField] = useState<'date' | 'pieces' | 'weight' | 'orderId'>('date');
  const [sortAsc, setSortAsc] = useState(false);

  // 1. Subscribe to Items collection to map item IDs to code
  useEffect(() => {
    const unsubItems = onSnapshot(
      query(collection(db, 'items')),
      (snap) => {
        const list: ItemMasterOption[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            code: data.code || 'ITM-000',
            name: data.name || '',
            category: data.category || '',
            unit: data.unit || 'KG',
            price: parseFloat(data.price || 0),
          };
        });
        setItemsMaster(list);
      },
      (err) => {
        console.error('Failed to fetch items master:', err);
      }
    );
    return () => unsubItems();
  }, []);

  const itemsMasterMap = useMemo(() => {
    const map: Record<string, ItemMasterOption> = {};
    itemsMaster.forEach((it) => {
      map[it.id] = it;
      if (it.code) map[it.code] = it;
    });
    return map;
  }, [itemsMaster]);

  // 2. Subscribe to Orders collection
  useEffect(() => {
    const unsubOrders = onSnapshot(
      query(collection(db, 'orders')),
      (snapshot) => {
        const list: OrderRecord[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<OrderRecord, 'id'>),
        }));

        setOrders(list);
        setIsLoading(false);
        setFetchError(null);
      },
      (err) => {
        console.error('Error loading orders:', err);
        setFetchError(err.message || 'Failed to load orders');
        setIsLoading(false);
      }
    );
    return () => unsubOrders();
  }, []);

  // Check if an item line is Ganesh Laddu (ITM-079)
  const isGaneshLadduItem = useMemo(() => {
    return (item: OrderItemLine): boolean => {
      const code = (item.itemCode || item.code || '').trim().toUpperCase();
      if (code === TARGET_ITEM_CODE) return true;

      const id = (item.itemId || '').trim().toUpperCase();
      if (id === TARGET_ITEM_CODE) return true;

      if (itemsMasterMap[item.itemId]?.code?.toUpperCase() === TARGET_ITEM_CODE) return true;

      const name = (item.itemName || itemsMasterMap[item.itemId]?.name || '').toLowerCase();
      if (name.includes('ganesh') && (name.includes('laddu') || name.includes('ladu'))) return true;

      return false;
    };
  }, [itemsMasterMap]);

  // Parse manufacturing note and extract size numbers
  // RULE:
  // 1. Check if manufacturing note exists:
  //    If yes -> split by '+' symbol (e.g. '1+2+3+15' -> [1, 2, 3, 15]).
  // 2. If no manufacturing note:
  //    Quantity is the number (e.g. quantity 5 -> [5]).
  const parseItemBreakdown = (item: OrderItemLine): LineBreakdown => {
    const rawNote = (
      item.manufacturingDescription ||
      item.manufacturingNote ||
      item.mfgDesc ||
      item.notes ||
      ''
    ).trim();

    const qty = Number(item.quantity) || 0;
    const lineTotal = Number(item.lineTotal) || 0;

    // Case 1: Note contains '+' delimiter (e.g. 1+2+3+15, 5+5, 10+10+1)
    if (rawNote && rawNote.includes('+')) {
      const chunks = rawNote.split('+');
      const parsed: number[] = [];

      chunks.forEach((chunk) => {
        const cleaned = chunk.replace(/[^0-9.]/g, '').trim();
        const num = parseFloat(cleaned);
        // Valid laddu weight (e.g. up to 1000 KG)
        if (!isNaN(num) && num > 0 && num <= 1000) {
          parsed.push(num);
        }
      });

      if (parsed.length > 0) {
        return {
          sizes: parsed,
          rawNote,
          hasNote: true,
          quantity: qty,
          lineTotal,
        };
      }
    }

    // Case 2: Note has no '+' delimiter
    if (rawNote && !rawNote.includes('+')) {
      const trimmed = rawNote.trim();
      // If note is strictly a single weight (e.g. '5', '5kg', '21 KG')
      if (/^\d+(\.\d+)?\s*(kg|kgs|g|gm)?$/i.test(trimmed)) {
        const num = parseFloat(trimmed.replace(/[^0-9.]/g, ''));
        if (!isNaN(num) && num > 0 && num <= 1000) {
          return {
            sizes: [num],
            rawNote,
            hasNote: true,
            quantity: qty,
            lineTotal,
          };
        }
      }

      // If note has text words/codes (e.g. 'urgent', 'bill 26126', 'call customer'),
      // it is not a weight breakdown; take quantity as the number!
      if (qty > 0 && qty <= 1000) {
        return {
          sizes: [qty],
          rawNote,
          hasNote: true,
          quantity: qty,
          lineTotal,
        };
      }
    }

    // Case 3: No note -> quantity is the number!
    if (qty > 0 && qty <= 1000) {
      return {
        sizes: [qty],
        rawNote: '',
        hasNote: false,
        quantity: qty,
        lineTotal,
      };
    }

    return {
      sizes: [],
      rawNote: '',
      hasNote: false,
      quantity: 0,
      lineTotal,
    };
  };

  // Enriched Ganesh Laddu Orders list (only orders containing ITM-079)
  const enrichedGaneshOrders = useMemo<EnrichedGaneshOrder[]>(() => {
    const result: EnrichedGaneshOrder[] = [];

    orders.forEach((order) => {
      if (!order.items || !Array.isArray(order.items) || order.items.length === 0) return;

      const ganeshItems = order.items.filter(isGaneshLadduItem);
      if (ganeshItems.length === 0) return;

      const allSizes: number[] = [];
      const sizeCounts: Record<number, number> = {};
      const rawNotes: string[] = [];
      let hasAnyNote = false;
      let totalLadduWeight = 0;

      ganeshItems.forEach((item) => {
        const breakdown = parseItemBreakdown(item);
        breakdown.sizes.forEach((s) => {
          allSizes.push(s);
          sizeCounts[s] = (sizeCounts[s] || 0) + 1;
        });
        if (breakdown.rawNote) {
          rawNotes.push(breakdown.rawNote);
        }
        if (breakdown.hasNote) {
          hasAnyNote = true;
        }
        totalLadduWeight += breakdown.quantity;
      });

      result.push({
        order,
        ganeshItems,
        allSizes,
        sizeCounts,
        rawNotes,
        hasAnyNote,
        totalLadduWeight,
        totalPieces: allSizes.length,
      });
    });

    return result;
  }, [orders, isGaneshLadduItem]);

  // Apply Filters
  const filteredOrders = useMemo(() => {
    return enrichedGaneshOrders.filter((enr) => {
      const { order, allSizes, hasAnyNote, rawNotes } = enr;

      // 1. Specific Size Filter
      if (selectedSizeFilter !== 'ALL') {
        if (!allSizes.includes(selectedSizeFilter)) {
          return false;
        }
      }

      // 2. Note Filter
      if (noteFilter === 'WITH_NOTE' && !hasAnyNote) return false;
      if (noteFilter === 'WITHOUT_NOTE' && hasAnyNote) return false;

      // 3. Status Filter
      if (selectedStatus !== 'All') {
        if ((order.orderStatus || 'Order Created') !== selectedStatus) {
          return false;
        }
      }

      // 4. Delivery Slot Filter
      if (selectedSlot !== 'All') {
        if (order.slot !== selectedSlot) {
          return false;
        }
      }

      // 5. Date Filter
      let targetDateStr = '';
      if (dateField === 'delivery') {
        targetDateStr = order.expectedDeliveryDate || order.deliveryDate || '';
      } else if (dateField === 'mfg') {
        targetDateStr = order.manufacturingDate || order.orderDate || '';
      } else {
        targetDateStr = order.orderDate || '';
      }

      if (selectedDate && selectedDate !== 'All') {
        if (targetDateStr !== selectedDate) return false;
      }

      // 6. Search Query
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matchCode = (order.code || order.orderId || '').toLowerCase().includes(q);
        const matchCust = (order.customerName || '').toLowerCase().includes(q);
        const matchPhone = (order.customerMobile || '').toLowerCase().includes(q);
        const matchNotes = rawNotes.some((n) => n.toLowerCase().includes(q));
        const matchSizes = allSizes.some((s) => s.toString() === q);
        if (!matchCode && !matchCust && !matchPhone && !matchNotes && !matchSizes) {
          return false;
        }
      }

      return true;
    });
  }, [
    enrichedGaneshOrders,
    selectedSizeFilter,
    noteFilter,
    selectedStatus,
    selectedSlot,
    dateField,
    selectedDate,
    searchTerm,
  ]);

  // Overall Size Distribution Matrix across filtered orders
  const sizeDistribution = useMemo<SizeDistributionItem[]>(() => {
    const sizeMap: Record<
      number,
      { count: number; totalWeightKg: number; orderIds: Set<string> }
    > = {};

    let grandTotalPieces = 0;

    filteredOrders.forEach((enr) => {
      enr.allSizes.forEach((size) => {
        grandTotalPieces++;
        if (!sizeMap[size]) {
          sizeMap[size] = { count: 0, totalWeightKg: 0, orderIds: new Set() };
        }
        sizeMap[size].count += 1;
        sizeMap[size].totalWeightKg += size;
        sizeMap[size].orderIds.add(enr.order.id);
      });
    });

    const list = Object.keys(sizeMap).map((k) => {
      const s = Number(k);
      const data = sizeMap[s];
      return {
        size: s,
        sizeLabel: formatSizeLabel(s),
        count: data.count,
        totalWeightKg: data.totalWeightKg,
        orderCount: data.orderIds.size,
        percentage: grandTotalPieces > 0 ? (data.count / grandTotalPieces) * 100 : 0,
      };
    });

    if (sizeSortOrder === 'count_desc') {
      list.sort((a, b) => b.count - a.count || a.size - b.size);
    } else {
      list.sort((a, b) => a.size - b.size);
    }

    return list;
  }, [filteredOrders, sizeSortOrder]);

  // Aggregate Metric Cards
  const metrics = useMemo(() => {
    let totalPieces = 0;
    let totalWeightKg = 0;
    const totalOrdersCount = filteredOrders.length;
    let totalRevenue = 0;
    let ordersWithNotes = 0;

    filteredOrders.forEach((enr) => {
      totalPieces += enr.totalPieces;
      if (enr.hasAnyNote) ordersWithNotes++;
      enr.ganeshItems.forEach((it) => {
        totalRevenue += it.lineTotal || 0;
      });
      enr.allSizes.forEach((s) => {
        totalWeightKg += s;
      });
    });

    return {
      totalOrdersCount,
      totalPieces,
      totalWeightKg: Math.round(totalWeightKg * 10) / 10,
      totalRevenue,
      ordersWithNotes,
      distinctSizesCount: sizeDistribution.length,
    };
  }, [filteredOrders, sizeDistribution]);

  // Sorted Orders for Table
  const sortedOrders = useMemo(() => {
    const list = [...filteredOrders];
    list.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'date') {
        const dateA = a.order.expectedDeliveryDate || a.order.orderDate || '';
        const dateB = b.order.expectedDeliveryDate || b.order.orderDate || '';
        comparison = dateA.localeCompare(dateB);
      } else if (sortField === 'pieces') {
        comparison = a.totalPieces - b.totalPieces;
      } else if (sortField === 'weight') {
        comparison = a.totalLadduWeight - b.totalLadduWeight;
      } else if (sortField === 'orderId') {
        comparison = (a.order.code || '').localeCompare(b.order.code || '');
      }
      return sortAsc ? comparison : -comparison;
    });
    return list;
  }, [filteredOrders, sortField, sortAsc]);

  // Paginated Orders
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedOrders.slice(start, start + pageSize);
  }, [sortedOrders, currentPage, pageSize]);

  // Export to Excel
  const handleExportExcel = () => {
    try {
      const sizeRows = sizeDistribution.map((item) => ({
        'Laddu Size (KG)': item.size,
        'Size Label': item.sizeLabel,
        'Total Quantity (Laddus)': item.count,
        'Total Weight (KG)': item.totalWeightKg,
        'Orders Requiring This Size': item.orderCount,
        'Share (%)': `${item.percentage.toFixed(1)}%`,
      }));

      const orderRows = filteredOrders.map((enr) => {
        const { order, allSizes, sizeCounts, rawNotes, totalPieces, totalLadduWeight } = enr;
        const sizeBreakdownText = Object.entries(sizeCounts)
          .map(([sz, cnt]) => `${cnt} × ${formatSizeLabel(Number(sz))}`)
          .join(', ');

        return {
          'Order Code': order.code || order.orderId || order.id,
          'Customer Name': order.customerName || 'Customer',
          'Mobile Number': order.customerMobile || '',
          'Order Date': order.orderDate || '',
          'Expected Delivery Date': order.expectedDeliveryDate || order.deliveryDate || '',
          'Delivery Slot': order.slot || '',
          'Total Pieces (Laddus)': totalPieces,
          'Total Weight (KG)': totalLadduWeight,
          'Parsed Size Breakdown': sizeBreakdownText || allSizes.join(', '),
          'Manufacturing Notes': rawNotes.join(' | ') || 'None (Direct Qty)',
          'Order Status': order.orderStatus || 'Order Created',
          'Payment Status': order.paymentStatus || 'Pending',
          'Delivery Address': order.deliveryAddress || '',
        };
      });

      const wb = XLSX.utils.book_new();
      const wsSizes = XLSX.utils.json_to_sheet(sizeRows);
      const wsOrders = XLSX.utils.json_to_sheet(orderRows);

      XLSX.utils.book_append_sheet(wb, wsSizes, 'Size Breakdown Summary');
      XLSX.utils.book_append_sheet(wb, wsOrders, 'Ganesh Laddu Orders');

      const fileName = `Ganesh_Laddu_Analysis_${getTodayDateStr()}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success('Excel Exported', `Saved ${fileName} successfully.`);
    } catch (err: unknown) {
      console.error('Export Excel failed:', err);
      const errMsg = err instanceof Error ? err.message : 'Unable to generate Excel file';
      toast.error('Export Failed', errMsg);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSort = (field: 'date' | 'pieces' | 'weight' | 'orderId') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const statusSelectOptions: CustomSelectOption[] = [
    { value: 'All', label: 'All Order Statuses' },
    { value: 'Order Created', label: 'Order Created' },
    { value: 'Moved to Manufacturing', label: 'Moved to Mfg' },
    { value: 'Manufacturing Started', label: 'Mfg Started' },
    { value: 'Manufacturing Completed', label: 'Mfg Completed' },
    { value: 'Moved to Packing', label: 'Moved to Packing' },
    { value: 'Delivered', label: 'Delivered' },
  ];

  const slotSelectOptions: CustomSelectOption[] = [
    { value: 'All', label: 'All Delivery Slots' },
    { value: '9:00 AM - 12:00 PM', label: '9:00 AM - 12:00 PM' },
    { value: '12:00 PM - 3:00 PM', label: '12:00 PM - 3:00 PM' },
    { value: '3:00 PM - 6:00 PM', label: '3:00 PM - 6:00 PM' },
    { value: '6:00 PM - 9:00 PM', label: '6:00 PM - 9:00 PM' },
  ];

  return (
    <div className="w-full flex flex-col gap-4 font-sans text-slate-800 pb-10">
      {/* ── 1. SHOPIFY POLARIS PAGE TITLE & ACTION BAR ────────────────────── */}
      <div className="flex flex-col gap-3 pt-1">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#02626D]/10 text-[#02626D] flex items-center justify-center flex-shrink-0">
              <PieChart size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">Ganesh Laddu Analysis</h1>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                  {TARGET_ITEM_CODE}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                Manufacturing notes breakdown (+) &amp; real-time size distribution matrix
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleExportExcel}
              className="bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold px-3 py-1.5 h-8 rounded-lg border border-slate-300 shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <FileSpreadsheet size={14} className="text-emerald-600" />
              <span>Export Excel</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="bg-[#02626D] hover:bg-[#014d56] text-white text-xs font-semibold px-3.5 py-1.5 h-8 rounded-lg shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Printer size={14} />
              <span>Print Production Sheet</span>
            </button>
          </div>
        </div>

        {/* ── 2. FILTER TOOLBAR (Shopify Polaris style) ───────────────────────── */}
        <div className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-2.5">
          {/* Left: Date Type & Date Picker */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Target Date Selector */}
            <div className="w-36">
              <CustomSelect
                options={[
                  { value: 'delivery', label: 'Delivery Date' },
                  { value: 'order', label: 'Order Date' },
                  { value: 'mfg', label: 'Mfg Date' },
                ]}
                value={dateField}
                onChange={(v) => {
                  setDateField(v as 'delivery' | 'order' | 'mfg');
                  setCurrentPage(1);
                }}
                size="sm"
                buttonClassName="h-8 text-xs font-medium border-slate-300 rounded-lg bg-white shadow-2xs"
              />
            </div>

            {/* Date Picker */}
            <CustomDatePicker
              value={selectedDate}
              onChange={(d) => {
                setSelectedDate(d);
                setCurrentPage(1);
              }}
              allowAll={true}
              size="md"
            />

            {/* Quick Date Presets */}
            <button
              type="button"
              onClick={() => {
                setSelectedDate(getTodayDateStr());
                setCurrentPage(1);
              }}
              className={`px-3 py-1 h-8 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                selectedDate === getTodayDateStr()
                  ? 'bg-slate-100 text-slate-900 border-slate-300 font-bold'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              Today
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedDate(getTomorrowDateStr());
                setCurrentPage(1);
              }}
              className={`px-3 py-1 h-8 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                selectedDate === getTomorrowDateStr()
                  ? 'bg-slate-100 text-slate-900 border-slate-300 font-bold'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              Tomorrow
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedDate('All');
                setCurrentPage(1);
              }}
              className={`px-3 py-1 h-8 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                selectedDate === 'All'
                  ? 'bg-slate-100 text-slate-900 border-slate-300 font-bold'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              All Dates
            </button>
          </div>

          {/* Right: Slot, Status, Note, Search */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Slot Filter */}
            <div className="w-40">
              <CustomSelect
                options={slotSelectOptions}
                value={selectedSlot}
                onChange={(v) => {
                  setSelectedSlot(v);
                  setCurrentPage(1);
                }}
                icon={<Clock size={13} />}
                size="sm"
                buttonClassName="h-8 text-xs font-medium border-slate-300 rounded-lg bg-white shadow-2xs"
              />
            </div>

            {/* Status Filter */}
            <div className="w-38">
              <CustomSelect
                options={statusSelectOptions}
                value={selectedStatus}
                onChange={(v) => {
                  setSelectedStatus(v);
                  setCurrentPage(1);
                }}
                icon={<Filter size={13} />}
                size="sm"
                buttonClassName="h-8 text-xs font-medium border-slate-300 rounded-lg bg-white shadow-2xs"
              />
            </div>

            {/* Note Filter Buttons */}
            <div className="inline-flex rounded-lg border border-slate-300 bg-[#f7f7f8] p-0.5 h-8">
              <button
                type="button"
                onClick={() => {
                  setNoteFilter('ALL');
                  setCurrentPage(1);
                }}
                className={`px-2.5 text-[11px] font-semibold rounded-md transition-colors cursor-pointer ${
                  noteFilter === 'ALL' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => {
                  setNoteFilter('WITH_NOTE');
                  setCurrentPage(1);
                }}
                className={`px-2.5 text-[11px] font-semibold rounded-md transition-colors cursor-pointer ${
                  noteFilter === 'WITH_NOTE' ? 'bg-amber-100 text-amber-900 border border-amber-200 font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Orders with note like 1+2+15"
              >
                With Note (+)
              </button>
              <button
                type="button"
                onClick={() => {
                  setNoteFilter('WITHOUT_NOTE');
                  setCurrentPage(1);
                }}
                className={`px-2.5 text-[11px] font-semibold rounded-md transition-colors cursor-pointer ${
                  noteFilter === 'WITHOUT_NOTE' ? 'bg-[#02626D]/10 text-[#02626D] border border-[#02626D]/20 font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Orders with direct quantity"
              >
                Direct Qty
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search orders..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-3 pr-8 py-1 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#02626D] bg-[#f7f7f8] focus:bg-white h-8 w-36 sm:w-44 shadow-2xs transition-colors"
              />
              <Search size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>

            {/* Reset Button */}
            {(selectedDate !== 'All' ||
              selectedSlot !== 'All' ||
              selectedStatus !== 'All' ||
              noteFilter !== 'ALL' ||
              selectedSizeFilter !== 'ALL' ||
              searchTerm !== '') && (
              <button
                type="button"
                onClick={() => {
                  setSelectedDate('All');
                  setSelectedSlot('All');
                  setSelectedStatus('All');
                  setNoteFilter('ALL');
                  setSelectedSizeFilter('ALL');
                  setSearchTerm('');
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1 h-8 rounded-lg text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer"
                title="Reset all filters"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Error Alert if any */}
      {fetchError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 px-3.5 py-2 rounded-lg text-xs flex items-center justify-between">
          <span><strong>Data Warning:</strong> {fetchError}</span>
          <button onClick={() => setFetchError(null)} className="text-rose-500 hover:text-rose-700">
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── 3. TOP METRICS & SUMMARY CARDS BAR (Pattabiram Sweets standard) ─── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Orders Card */}
        <div className="bg-white rounded-xl p-3 sm:p-3.5 border border-slate-200/90 shadow-2xs flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#02626D]/10 text-[#02626D] flex items-center justify-center flex-shrink-0">
            <ShoppingBag size={17} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-slate-500 font-medium truncate">Ganesh Orders</p>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">{metrics.totalOrdersCount}</h3>
            <p className="text-[10px] text-emerald-600 font-medium">Filtered count</p>
          </div>
        </div>

        {/* Total Laddus (Pieces) */}
        <div className="bg-white rounded-xl p-3 sm:p-3.5 border border-slate-200/90 shadow-2xs flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center flex-shrink-0">
            <Flame size={17} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-slate-500 font-medium truncate">Total Laddus</p>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
              {metrics.totalPieces} <span className="text-xs font-semibold text-slate-500">pcs</span>
            </h3>
            <p className="text-[10px] text-amber-700 font-medium">Sum of sizes</p>
          </div>
        </div>

        {/* Total Weight KG */}
        <div className="bg-white rounded-xl p-3 sm:p-3.5 border border-slate-200/90 shadow-2xs flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center flex-shrink-0">
            <Boxes size={17} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-slate-500 font-medium truncate">Total Weight</p>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
              {metrics.totalWeightKg} <span className="text-xs font-semibold text-slate-500">KG</span>
            </h3>
            <p className="text-[10px] text-indigo-600 font-medium">Production load</p>
          </div>
        </div>

        {/* Distinct Sizes */}
        <div className="bg-white rounded-xl p-3 sm:p-3.5 border border-slate-200/90 shadow-2xs flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center flex-shrink-0">
            <Layers size={17} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-slate-500 font-medium truncate">Distinct Sizes</p>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
              {metrics.distinctSizesCount} <span className="text-xs font-semibold text-slate-500">sizes</span>
            </h3>
            <p className="text-[10px] text-purple-600 font-medium">1, 2, 5, 15 kg...</p>
          </div>
        </div>

        {/* With Manufacturing Notes */}
        <div className="bg-white rounded-xl p-3 sm:p-3.5 border border-slate-200/90 shadow-2xs flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center flex-shrink-0">
            <Factory size={17} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-slate-500 font-medium truncate">With Notes (+)</p>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
              {metrics.ordersWithNotes} <span className="text-xs font-semibold text-slate-500">orders</span>
            </h3>
            <p className="text-[10px] text-blue-600 font-medium">Custom split</p>
          </div>
        </div>

        {/* Total Laddu Value */}
        <div className="bg-white rounded-xl p-3 sm:p-3.5 border border-slate-200/90 shadow-2xs flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center flex-shrink-0">
            <IndianRupee size={17} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-slate-500 font-medium truncate">Laddu Amount</p>
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight truncate">
              {fmtCurrency(metrics.totalRevenue)}
            </h3>
            <p className="text-[10px] text-emerald-600 font-medium">ITM-079 value</p>
          </div>
        </div>
      </div>

      {/* ── 4. SIZES COUNT BREAKDOWN ("How Many 1s, 2s, 5s, 15s, 21s...") ── */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Flame size={14} className="text-amber-600" />
              <span>Laddu Sizes Count Breakdown (&quot;How Many 1s, 2s, 5s, 15s, 21s...&quot;)</span>
            </h2>
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              — Click any size to filter orders
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Sort Order Control */}
            <div className="inline-flex items-center gap-1.5 text-xs text-slate-600 bg-[#f7f7f8] border border-slate-300 rounded-lg px-2 h-7">
              <ArrowUpDown size={12} className="text-slate-400" />
              <span className="text-[11px] font-medium text-slate-500">Sort:</span>
              <select
                value={sizeSortOrder}
                onChange={(e) => setSizeSortOrder(e.target.value as 'size_asc' | 'count_desc')}
                aria-label="Sort laddu sizes"
                className="bg-transparent text-[11px] font-bold text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="size_asc">Size (1 KG, 2 KG...)</option>
                <option value="count_desc">Highest Count (Top Demand)</option>
              </select>
            </div>

            {/* View Mode Toggle */}
            <div className="inline-flex rounded-lg border border-slate-300 bg-[#f7f7f8] p-0.5 h-7 text-[11px]">
              <button
                type="button"
                onClick={() => setSizeViewMode('cards')}
                className={`px-2.5 py-0.5 rounded font-semibold transition-colors cursor-pointer ${
                  sizeViewMode === 'cards'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tiles View
              </button>
              <button
                type="button"
                onClick={() => setSizeViewMode('table')}
                className={`px-2.5 py-0.5 rounded font-semibold transition-colors cursor-pointer ${
                  sizeViewMode === 'table'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Summary Table
              </button>
            </div>

            {selectedSizeFilter !== 'ALL' && (
              <button
                type="button"
                onClick={() => setSelectedSizeFilter('ALL')}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#02626D] bg-[#02626D]/10 hover:bg-[#02626D]/20 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
              >
                <span>Filtered: <strong>{formatSizeLabel(selectedSizeFilter)}</strong></span>
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Quick select pills row for popular weights */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100/80">
          <span className="text-[11px] font-semibold text-slate-500 mr-1">Quick Filter:</span>
          <button
            type="button"
            onClick={() => setSelectedSizeFilter('ALL')}
            className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors cursor-pointer ${
              selectedSizeFilter === 'ALL'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Sizes ({sizeDistribution.length})
          </button>
          {[1, 2, 3, 5, 11, 15, 21, 25, 31, 51, 101].map((sz) => {
            const match = sizeDistribution.find((d) => d.size === sz);
            if (!match && selectedSizeFilter !== sz) return null;
            const count = match ? match.count : 0;
            const isSelected = selectedSizeFilter === sz;
            return (
              <button
                key={sz}
                type="button"
                onClick={() => setSelectedSizeFilter(isSelected ? 'ALL' : sz)}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                  isSelected
                    ? 'bg-[#02626D] text-white font-bold shadow-2xs'
                    : 'bg-[#02626D]/10 text-[#02626D] hover:bg-[#02626D]/20'
                }`}
              >
                <span>{sz} KG</span>
                {count > 0 && <span className="text-[10px] font-bold opacity-85">({count})</span>}
              </button>
            );
          })}
        </div>

        {/* Empty state */}
        {sizeDistribution.length === 0 ? (
          <div className="py-6 text-center text-slate-400 text-xs">
            No Ganesh Laddu sizes recorded for current filter criteria.
          </div>
        ) : sizeViewMode === 'cards' ? (
          /* Tiles View: Direct, High-Impact Counts */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2.5">
            {sizeDistribution.map((item) => {
              const isSelected = selectedSizeFilter === item.size;
              return (
                <div
                  key={item.size}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedSizeFilter(isSelected ? 'ALL' : item.size)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedSizeFilter(isSelected ? 'ALL' : item.size);
                    }
                  }}
                  className={`allow-any-height card-button h-auto min-h-[112px] p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between select-none ${
                    isSelected
                      ? 'bg-[#02626D]/5 border-2 border-[#02626D] shadow-2xs ring-2 ring-[#02626D]/20'
                      : 'bg-[#fcfcfd] border-slate-200/90 hover:border-[#02626D] hover:bg-white hover:shadow-2xs'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={`text-xs font-black font-mono px-2 py-0.5 rounded ${
                        isSelected ? 'bg-[#02626D] text-white' : 'bg-slate-200/80 text-slate-800'
                      }`}
                    >
                      {item.size} KG
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400">
                      {item.orderCount} ord
                    </span>
                  </div>

                  <div className="mt-3">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">How Many:</div>
                    <div className="text-xl sm:text-2xl font-black text-slate-900 leading-none mt-1 flex items-baseline gap-1">
                      <span>{item.count}</span>
                      <span className="text-xs font-bold text-[#02626D]">
                        {item.count === 1 ? 'Laddu' : 'Laddus'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium mt-1.5">
                      Total: <strong>{item.totalWeightKg} KG</strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Table View: Structured Breakdown Table */
          <div className="overflow-x-auto border border-slate-200/90 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#f7f7f8] text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200/90">
                <tr>
                  <th className="py-2.5 px-3.5">Size / Number</th>
                  <th className="py-2.5 px-3.5">Exact Count (How Many)</th>
                  <th className="py-2.5 px-3.5">Total Weight (KG)</th>
                  <th className="py-2.5 px-3.5">Orders Count</th>
                  <th className="py-2.5 px-3.5 text-right">Filter</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sizeDistribution.map((item) => {
                  const isSelected = selectedSizeFilter === item.size;
                  return (
                    <tr
                      key={item.size}
                      onClick={() => setSelectedSizeFilter(isSelected ? 'ALL' : item.size)}
                      className={`hover:bg-slate-50 cursor-pointer transition-colors ${
                        isSelected ? 'bg-[#02626D]/5 font-semibold' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3.5 font-bold font-mono text-slate-900">
                        {item.size} KG ({item.sizeLabel})
                      </td>
                      <td className="py-2.5 px-3.5">
                        <span className="text-sm font-black text-slate-900">{item.count}</span>{' '}
                        <span className="text-xs font-bold text-[#02626D]">Laddus</span>
                      </td>
                      <td className="py-2.5 px-3.5 font-semibold text-slate-700">
                        {item.totalWeightKg} KG
                      </td>
                      <td className="py-2.5 px-3.5 text-slate-500">
                        Found in {item.orderCount} order{item.orderCount !== 1 ? 's' : ''}
                      </td>
                      <td className="py-2.5 px-3.5 text-right">
                        <span
                          className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded border ${
                            isSelected
                              ? 'bg-[#02626D] text-white border-[#02626D]'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          {isSelected ? 'Active Filter ✓' : 'Filter Orders'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50 font-bold border-t border-slate-200/90 text-slate-900">
                <tr>
                  <td className="py-2 px-3.5">TOTAL</td>
                  <td className="py-2 px-3.5 text-sm text-[#02626D]">
                    {metrics.totalPieces} Laddus
                  </td>
                  <td className="py-2 px-3.5">
                    {metrics.totalWeightKg} KG
                  </td>
                  <td className="py-2 px-3.5 text-slate-600">
                    Across {metrics.totalOrdersCount} Orders
                  </td>
                  <td className="py-2 px-3.5 text-right">
                    {selectedSizeFilter !== 'ALL' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSizeFilter('ALL');
                        }}
                        className="text-xs text-rose-600 hover:underline"
                      >
                        Clear Filter
                      </button>
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ── 5. GANESH LADDU ORDERS TABLE ──────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        {/* Table Top Bar */}
        <div className="p-3 sm:p-3.5 border-b border-slate-100 flex items-center justify-between bg-[#f7f7f8]">
          <div className="flex items-center gap-2">
            <span className="font-bold text-xs sm:text-sm text-slate-800">Orders List</span>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-200/80 text-slate-700">
              {sortedOrders.length}
            </span>
          </div>

          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400 font-semibold uppercase">Sort:</span>
            <button
              type="button"
              onClick={() => handleSort('date')}
              className={`px-2 py-0.5 rounded text-xs font-semibold cursor-pointer ${
                sortField === 'date' ? 'bg-slate-200 text-slate-900 font-bold' : 'hover:bg-slate-100 text-slate-600'
              }`}
            >
              Date {sortField === 'date' && (sortAsc ? '↑' : '↓')}
            </button>
            <button
              type="button"
              onClick={() => handleSort('pieces')}
              className={`px-2 py-0.5 rounded text-xs font-semibold cursor-pointer ${
                sortField === 'pieces' ? 'bg-slate-200 text-slate-900 font-bold' : 'hover:bg-slate-100 text-slate-600'
              }`}
            >
              Laddus {sortField === 'pieces' && (sortAsc ? '↑' : '↓')}
            </button>
            <button
              type="button"
              onClick={() => handleSort('weight')}
              className={`px-2 py-0.5 rounded text-xs font-semibold cursor-pointer ${
                sortField === 'weight' ? 'bg-slate-200 text-slate-900 font-bold' : 'hover:bg-slate-100 text-slate-600'
              }`}
            >
              Weight {sortField === 'weight' && (sortAsc ? '↑' : '↓')}
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#f7f7f8] border-b border-slate-200/90 text-slate-600 font-semibold text-[11px] uppercase tracking-wider">
                <th className="py-2.5 px-3.5">Order Code</th>
                <th className="py-2.5 px-3.5">Delivery Slot</th>
                <th className="py-2.5 px-3.5">Customer</th>
                <th className="py-2.5 px-3.5 text-center">Ganesh Qty</th>
                <th className="py-2.5 px-3.5">Manufacturing Note</th>
                <th className="py-2.5 px-3.5">Decomposed Sizes</th>
                <th className="py-2.5 px-3.5 text-center">Status</th>
                <th className="py-2.5 px-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw size={15} className="animate-spin text-[#02626D]" />
                      <span>Loading orders...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400 text-xs">
                    No matching Ganesh Laddu orders found.
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((enr) => {
                  const { order, sizeCounts, rawNotes, hasAnyNote, totalLadduWeight, totalPieces } = enr;
                  const stStyle = getStatusBadgeStyle(order.orderStatus);

                  return (
                    <tr
                      key={order.id}
                      onClick={() => setViewingOrder(enr)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                    >
                      {/* Order Code */}
                      <td className="py-3 px-3.5 font-mono font-bold text-[#02626D]">
                        <div>{order.code || order.orderId || order.id}</div>
                        <div className="text-[10px] font-sans font-normal text-slate-400">
                          {order.orderDate || 'N/A'}
                        </div>
                      </td>

                      {/* Delivery Slot */}
                      <td className="py-3 px-3.5">
                        <div className="font-semibold text-slate-900">
                          {order.expectedDeliveryDate || order.deliveryDate || 'Not set'}
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium flex items-center gap-1 mt-0.5">
                          <Clock size={11} className="text-slate-400" />
                          <span>{order.slot || 'Standard Slot'}</span>
                        </div>
                      </td>

                      {/* Customer */}
                      <td className="py-3 px-3.5">
                        <div className="font-bold text-slate-900">{order.customerName || 'Customer'}</div>
                        <div className="text-[11px] font-mono text-slate-500">{order.customerMobile || '—'}</div>
                      </td>

                      {/* Total Ganesh Weight / Qty */}
                      <td className="py-3 px-3.5 text-center">
                        <div className="font-bold text-slate-900">{totalLadduWeight} KG</div>
                        <div className="text-[10px] text-slate-500 font-medium">
                          ({totalPieces} {totalPieces === 1 ? 'laddu' : 'laddus'})
                        </div>
                      </td>

                      {/* Manufacturing Note */}
                      <td className="py-3 px-3.5 max-w-xs">
                        {hasAnyNote ? (
                          <div className="flex flex-wrap gap-1">
                            {rawNotes.map((note, i) => (
                              <span
                                key={i}
                                className="bg-amber-50 text-amber-800 border border-amber-200/80 px-2 py-0.5 rounded font-mono text-[11px] font-semibold inline-flex items-center gap-1"
                              >
                                <Factory size={11} className="text-amber-600" />
                                <span>{note}</span>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">
                            No note (Direct {totalLadduWeight} KG)
                          </span>
                        )}
                      </td>

                      {/* Decomposed Sizes Chips */}
                      <td className="py-3 px-3.5">
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(sizeCounts).map(([sz, cnt]) => {
                            const szNum = Number(sz);
                            const isMatch = selectedSizeFilter === szNum;
                            return (
                              <span
                                key={sz}
                                className={`px-2 py-0.5 rounded text-[11px] font-semibold inline-flex items-center gap-1 ${
                                  isMatch
                                    ? 'bg-[#02626D] text-white'
                                    : 'bg-[#02626D]/10 text-[#02626D] border border-[#02626D]/20'
                                }`}
                              >
                                <span>{cnt} ×</span>
                                <span>{formatSizeLabel(szNum)}</span>
                              </span>
                            );
                          })}
                        </div>
                      </td>

                      {/* Order Status */}
                      <td className="py-3 px-3.5 text-center">
                        <span
                          className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${stStyle.bg} ${stStyle.text} ${stStyle.border}`}
                        >
                          {order.orderStatus || 'Order Created'}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setViewingOrder(enr)}
                          className="bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold px-2.5 py-1 h-7 rounded-lg border border-slate-300 shadow-2xs transition-colors cursor-pointer inline-flex items-center gap-1"
                        >
                          <Eye size={12} />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <Pagination
          currentPage={currentPage}
          totalItems={sortedOrders.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* ── 6. ORDER DETAIL MODAL ─────────────────────────────────────────── */}
      {viewingOrder && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-xl border border-slate-200 p-5 space-y-4 text-xs font-sans">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#02626D]/10 text-[#02626D] flex items-center justify-center">
                  <ShoppingBag size={14} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 font-mono">
                    {viewingOrder.order.code || viewingOrder.order.orderId || viewingOrder.order.id}
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    Booked: {viewingOrder.order.orderDate || 'N/A'} • Delivery: {viewingOrder.order.expectedDeliveryDate || 'N/A'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingOrder(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={16} />
              </button>
            </div>

            {/* Customer & Slot Box */}
            <div className="bg-[#f7f7f8] rounded-lg p-3 border border-slate-200/90 grid grid-cols-2 gap-3">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Customer</span>
                <div className="font-bold text-slate-900 mt-0.5">{viewingOrder.order.customerName || 'Customer'}</div>
                <div className="text-slate-500 font-mono">{viewingOrder.order.customerMobile || 'No Phone'}</div>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Slot &amp; Address</span>
                <div className="font-bold text-slate-900 mt-0.5">{viewingOrder.order.slot || 'Standard Slot'}</div>
                <div className="text-slate-500 truncate">{viewingOrder.order.deliveryAddress || 'Store Pickup'}</div>
              </div>
            </div>

            {/* Breakdown decomposition display */}
            <div className="bg-amber-50/60 border border-amber-200/80 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                  <Flame size={13} className="text-amber-600" />
                  <span>Decomposed Laddu Sizes</span>
                </span>
                <span className="text-xs font-bold text-amber-900">
                  {viewingOrder.totalPieces} laddus ({viewingOrder.totalLadduWeight} KG)
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {Object.entries(viewingOrder.sizeCounts).map(([sz, cnt]) => (
                  <div
                    key={sz}
                    className="bg-white border border-amber-300 rounded-md px-2.5 py-1 text-xs font-semibold flex items-center gap-1.5 shadow-2xs"
                  >
                    <span className="font-bold text-amber-800">{cnt} ×</span>
                    <span className="font-bold text-slate-900">{formatSizeLabel(Number(sz))}</span>
                  </div>
                ))}
              </div>

              <div className="text-[11px] text-amber-900 pt-1.5 border-t border-amber-200/50 flex items-start gap-1">
                <Factory size={12} className="text-amber-700 mt-0.5 flex-shrink-0" />
                <div>
                  <strong>Mfg Note: </strong>
                  {viewingOrder.hasAnyNote ? (
                    <span className="font-mono font-bold bg-amber-100/80 px-1.5 py-0.5 rounded text-amber-950">
                      {viewingOrder.rawNotes.join(', ')}
                    </span>
                  ) : (
                    <span className="italic text-slate-500">
                      None. Item quantity ({viewingOrder.totalLadduWeight} KG) is taken as size.
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Item Table */}
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="bg-[#f7f7f8] px-3 py-1.5 text-[10px] font-bold text-slate-600 uppercase">
                Ganesh Laddu Items
              </div>
              <table className="w-full text-left divide-y divide-slate-100">
                <tbody className="divide-y divide-slate-100">
                  {viewingOrder.ganeshItems.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2 px-3">
                        <div className="font-bold text-slate-900">{item.itemName}</div>
                        <div className="text-[10px] font-mono text-slate-400">{item.itemCode || TARGET_ITEM_CODE}</div>
                      </td>
                      <td className="py-2 px-3 text-center font-bold text-slate-800">
                        {item.quantity} {item.unit || 'KG'}
                      </td>
                      <td className="py-2 px-3 text-right font-semibold text-slate-900">
                        {fmtCurrency(item.lineTotal || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-2">
              <Link
                href="/orders"
                className="text-xs font-semibold text-[#02626D] hover:underline flex items-center gap-1"
              >
                <span>Go to Orders Page</span>
                <ExternalLink size={12} />
              </Link>
              <button
                type="button"
                onClick={() => setViewingOrder(null)}
                className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          header,
          nav,
          button,
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}

'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Receipt,
  Search,
  Barcode,
  Printer,
  Bluetooth,
  Usb,
  Plus,
  Minus,
  Trash2,
  Bookmark,
  CheckCircle2,
  QrCode,
  CreditCard,
  Banknote,
  User,
  X,
  RefreshCw,
  ShoppingBag,
  Clock,
  Sparkles,
  ChevronRight,
  AlertCircle,
  FileText,
  SlidersHorizontal,
  ChevronDown,
  Check,
  Coins,
  TrendingUp,
  Activity,
  Star,
  UserPlus,
  Loader2,
  Phone,
  Mail,
  MapPin,
  AlertTriangle,
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { usePrinter } from '@/context/PrinterContext';
import { useAuth } from '@/context/AuthContext';
import { toast } from '@/context/ToastContext';
import { useBusinessSettings, formatStoreAddress, formatStorePhone } from '@/lib/businessSettings';
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
} from 'firebase/firestore';
import type { ItemRecord } from './ItemsClient';
import { logAuditEvent } from '@/lib/auditLogger';

export interface PosCartItem {
  id: string;
  itemId: string;
  code: string;
  name: string;
  price: number; // rate per unit/kg
  unit: string; // 'KG' | 'Piece' | 'Packet' | 'Litre'
  isWeight: boolean;
  quantity: number; // weight in kg OR pieces count
  totalAmount: number;
  weightGrams?: number; // e.g. 250, 500, 1000
  note?: string;
}

export interface LiveSaleRecord {
  id: string;
  billNo: string;
  receiptNumber?: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  customerAddress?: string;
  cashierId?: string;
  cashierName?: string;
  cashierCode?: string;
  items: PosCartItem[];
  paymentMode: 'Cash' | 'UPI' | 'Card' | 'Split' | string;
  splitCash?: number;
  splitUpi?: number;
  splitCard?: number;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  grandTotal?: number;
  receivedAmount?: number;
  creditAmount?: number;
  paymentStatus?: 'Paid' | 'Partial' | 'Credit';
  status?: string;
  savedAt: string;
  date: string;
  time: string;
  createdAt?: any;
}

export interface CustomerRecord {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
}

export interface EmployeeOption {
  id: string;
  empId?: string;
  name: string;
  mobile?: string;
}

export const PRESET_WEIGHTS = [
  { label: '250g', kg: 0.25 },
  { label: '500g', kg: 0.5 },
  { label: '1kg', kg: 1.0 },
  { label: '1.5kg', kg: 1.5 },
  { label: '2kg', kg: 2.0 },
  { label: '2.5kg', kg: 2.5 },
  { label: '3kg', kg: 3.0 },
  { label: '5kg', kg: 5.0 },
];

export function isWeightUnit(unitStr: string | undefined): boolean {
  if (!unitStr) return false;
  const u = unitStr.toLowerCase().trim();
  return (
    u === 'kg' ||
    u === 'kgs' ||
    u === 'kg.' ||
    u === 'g' ||
    u === 'gm' ||
    u === 'gms' ||
    u === 'gram' ||
    u === 'grams' ||
    u === 'litre' ||
    u === 'litres' ||
    u === 'liter' ||
    u === 'liters' ||
    u === 'l' ||
    u === 'lt' ||
    u.includes('kg') ||
    u.includes('gram') ||
    u.includes('gm') ||
    u.includes('litre') ||
    u.includes('liter')
  );
}

export default function LiveSalesClient() {
  const { user, employeeProfile } = useAuth();
  const { settings: businessSettings } = useBusinessSettings();

  // Global Thermal Printer Subsystem
  const {
    isConnected: isPrinterConnected,
    printerType,
    printReceipt,
    printWindow,
  } = usePrinter();

  // Products & Categories state from Firestore
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Employees for Cashier selection
  const [employeesList, setEmployeesList] = useState<EmployeeOption[]>([]);
  const [selectedCashier, setSelectedCashier] = useState<EmployeeOption | null>(null);

  // Barcode State
  const [isBarcodeActive, setIsBarcodeActive] = useState<boolean>(true);
  const [barcodeInput, setBarcodeInput] = useState<string>('');

  // Cart State
  const [cart, setCart] = useState<PosCartItem[]>([]);
  const [selectedPayment, setSelectedPayment] = useState<'Cash' | 'UPI' | 'Card' | 'Split'>('UPI');
  const [posSplitCash, setPosSplitCash] = useState<string>('');
  const [posSplitUPI, setPosSplitUPI] = useState<string>('');
  const [discountAmount, setDiscountAmount] = useState<number>(0);

  // Customer Selection & Add Customer State
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRecord | null>(null);
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState<boolean>(false);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState<boolean>(false);
  const [newCustName, setNewCustName] = useState<string>('');
  const [newCustMobile, setNewCustMobile] = useState<string>('');
  const [newCustEmail, setNewCustEmail] = useState<string>('');
  const [newCustAddress, setNewCustAddress] = useState<string>('');
  const [isSavingCustomer, setIsSavingCustomer] = useState<boolean>(false);

  // Received Amount & Credit State
  const [receivedAmountInput, setReceivedAmountInput] = useState<string>('');

  // Modal State: Weight & Amount Calculator
  const [activeWeightItem, setActiveWeightItem] = useState<ItemRecord | null>(null);
  const [editingCartItemIndex, setEditingCartItemIndex] = useState<number | null>(null);
  const [inputWeightKg, setInputWeightKg] = useState<string>('1.0');
  const [inputAmount, setInputAmount] = useState<string>('');

  // Saved Draft Bills State
  const [savedBills, setSavedBills] = useState<LiveSaleRecord[]>([]);
  const [showSavedBillsDrawer, setShowSavedBillsDrawer] = useState<boolean>(false);
  const [activeBillNo, setActiveBillNo] = useState<string>(`LIVE-${Date.now().toString().slice(-6)}`);

  // Receipt Modal State
  const [lastSettledBill, setLastSettledBill] = useState<LiveSaleRecord | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Mobile Flyout & Checkout Modal State
  const [isMobileCheckoutOpen, setIsMobileCheckoutOpen] = useState<boolean>(false);

  // 1. Load Products from Firestore
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'items'),
      (snapshot) => {
        const list: ItemRecord[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<ItemRecord, 'id'>),
        }));
        setItems(list.filter((i) => i.status === 'Active' || (i as any).status === 'active'));
        setLoadingItems(false);
      },
      (err) => {
        console.error('Error fetching items for Live Sales:', err);
        setLoadingItems(false);
      }
    );
    return () => unsub();
  }, []);

  // 2. Load Customers from Firestore
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'customers'), (snapshot) => {
      const list: CustomerRecord[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name || 'Customer',
          phone: data.phone || data.mobile || data.mobileNumber || '',
          email: data.email || '',
          address: data.address || '',
        };
      });
      setCustomers(list);
    });
    return () => unsub();
  }, []);

  // 3. Load Employees from Firestore
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'employees'), (snapshot) => {
      const list: EmployeeOption[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          empId: data.empId || '',
          name: data.name || 'Staff',
          mobile: data.mobile || '',
        };
      });
      setEmployeesList(list);

      // Pre-select current logged-in employee if matched
      if (employeeProfile) {
        const matched = list.find(
          (e) => e.id === employeeProfile.id || e.name.toLowerCase() === employeeProfile.name.toLowerCase()
        );
        if (matched) {
          setSelectedCashier(matched);
        } else {
          setSelectedCashier({
            id: employeeProfile.id || 'staff',
            name: employeeProfile.name || 'Staff',
          });
        }
      } else if (list.length > 0) {
        setSelectedCashier(list[0]);
      }
    });
    return () => unsub();
  }, [employeeProfile]);

  // Extract distinct categories
  const categoriesList = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => {
      if (item.category) set.add(item.category);
    });
    return ['All', ...Array.from(set).sort()];
  }, [items]);

  // Filter products by search and category, with Favourites prioritized at the top
  const filteredProducts = useMemo(() => {
    const list = items.filter((item) => {
      const matchCat = selectedCategory === 'All' || item.category === selectedCategory;
      if (!matchCat) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        item.name.toLowerCase().includes(q) ||
        (item.code && item.code.toLowerCase().includes(q)) ||
        (item.category && item.category.toLowerCase().includes(q))
      );
    });

    // Favourites at the very top, followed by alphabetical order
    return list.sort((a, b) => {
      const aFav = Boolean(a.isFavorite || (a as any).isFavourite || (a as any).favorite);
      const bFav = Boolean(b.isFavorite || (b as any).isFavourite || (b as any).favorite);
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [items, selectedCategory, searchQuery]);

  // Subtotal, Discount & Grand Total Calculations
  const subtotal = useMemo(() => {
    return cart.reduce((acc, cur) => acc + cur.totalAmount, 0);
  }, [cart]);

  const grandTotal = useMemo(() => {
    return Math.max(0, subtotal - discountAmount);
  }, [subtotal, discountAmount]);

  // Received Amount and Credit Due Calculations
  const receivedAmount = useMemo(() => {
    if (receivedAmountInput.trim() === '') {
      return grandTotal;
    }
    const val = parseFloat(receivedAmountInput);
    return isNaN(val) ? 0 : Math.max(0, val);
  }, [receivedAmountInput, grandTotal]);

  const creditAmount = useMemo(() => {
    return Math.max(0, grandTotal - receivedAmount);
  }, [grandTotal, receivedAmount]);

  const paymentStatus = useMemo<'Paid' | 'Partial' | 'Credit'>(() => {
    if (creditAmount <= 0) return 'Paid';
    if (receivedAmount > 0) return 'Partial';
    return 'Credit';
  }, [creditAmount, receivedAmount]);

  // Filter customers based on search query
  const filteredCustomerOptions = useMemo(() => {
    if (!customerSearch.trim()) return customers.slice(0, 10);
    const q = customerSearch.toLowerCase().trim();
    return customers
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q) ||
          (c.email && c.email.toLowerCase().includes(q))
      )
      .slice(0, 20);
  }, [customers, customerSearch]);

  // Save New Customer & Immediately Select
  const handleSaveAndSelectCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim()) {
      toast.error('Name Required', 'Customer name is mandatory.');
      return;
    }
    if (!newCustMobile.trim() || newCustMobile.trim().length < 6) {
      toast.error('Mobile Required', 'Valid customer mobile number is mandatory.');
      return;
    }

    try {
      setIsSavingCustomer(true);
      const nextCode = `CUST-${Date.now().toString().slice(-4)}`;
      const docRef = await addDoc(collection(db, 'customers'), {
        code: nextCode,
        name: newCustName.trim(),
        phone: newCustMobile.trim(),
        mobile: newCustMobile.trim(),
        mobileNumber: newCustMobile.trim(),
        email: newCustEmail.trim() || '',
        address: newCustAddress.trim() || '',
        status: 'Active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const newlyAdded: CustomerRecord = {
        id: docRef.id,
        name: newCustName.trim(),
        phone: newCustMobile.trim(),
        email: newCustEmail.trim() || '',
        address: newCustAddress.trim() || '',
      };

      setSelectedCustomer(newlyAdded);
      setCustomerSearch('');
      setShowCustomerDropdown(false);
      setShowAddCustomerModal(false);
      setNewCustName('');
      setNewCustMobile('');
      setNewCustEmail('');
      setNewCustAddress('');
      toast.success('Customer Saved & Selected', `${newlyAdded.name} (${newlyAdded.phone}) selected for live sale.`);
    } catch (err: any) {
      console.error('Error saving customer:', err);
      toast.error('Failed to save customer', err.message || 'Could not create customer.');
    } finally {
      setIsSavingCustomer(false);
    }
  };

  // Auto calculate split balance
  useEffect(() => {
    if (selectedPayment === 'Split') {
      const cashVal = parseFloat(posSplitCash) || 0;
      if (cashVal <= receivedAmount) {
        setPosSplitUPI((receivedAmount - cashVal).toFixed(2));
      } else {
        setPosSplitUPI('0');
      }
    }
  }, [posSplitCash, receivedAmount, selectedPayment]);

  // Helper to add item to cart
  const addItemToCart = (item: ItemRecord, qty: number = 1, amount?: number) => {
    const unitPrice = typeof item.posPrice === 'number' && item.posPrice > 0 ? item.posPrice : item.price || 0;
    const isWeight = isWeightUnit(item.unit);
    const itemTotal = amount !== undefined ? amount : isWeight ? Math.round(unitPrice * qty * 100) / 100 : unitPrice * qty;

    setCart((prev) => {
      const existingIndex = prev.findIndex((c) => c.itemId === item.id);
      if (existingIndex > -1 && !isWeight) {
        const copy = [...prev];
        const updatedQty = copy[existingIndex].quantity + qty;
        copy[existingIndex] = {
          ...copy[existingIndex],
          quantity: updatedQty,
          totalAmount: unitPrice * updatedQty,
        };
        return copy;
      }
      return [
        ...prev,
        {
          id: `c_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          itemId: item.id,
          code: item.code || '',
          name: item.name,
          price: unitPrice,
          unit: item.unit || 'Piece',
          isWeight,
          quantity: qty,
          totalAmount: itemTotal,
        },
      ];
    });

    toast.success('Added to Cart', `${item.name} added`);
  };

  // Click on product card handler
  const handleProductClick = (item: ItemRecord) => {
    if (isWeightUnit(item.unit)) {
      setActiveWeightItem(item);
      setEditingCartItemIndex(null);
      setInputWeightKg('1.0');
      const unitPrice = typeof item.posPrice === 'number' && item.posPrice > 0 ? item.posPrice : item.price || 0;
      setInputAmount(unitPrice.toString());
    } else {
      addItemToCart(item, 1);
    }
  };

  // Barcode scanner listener
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;
    const code = barcodeInput.trim().toLowerCase();
    const matched = items.find(
      (it) => (it.code && it.code.toLowerCase() === code) || it.name.toLowerCase() === code
    );
    if (matched) {
      handleProductClick(matched);
      setBarcodeInput('');
    } else {
      toast.warning('Product Not Found', `No item matching code "${barcodeInput}"`);
    }
  };

  // Settle Bill & Save to `live_sales` in Firestore
  const handleSettleBill = async () => {
    if (cart.length === 0) {
      toast.warning('Cart Empty', 'Please add items before completing live sale.');
      return;
    }

    // MANDATORY CUSTOMER SELECTION CHECK
    if (!selectedCustomer) {
      toast.error(
        'Customer Required',
        'Customer selection is mandatory for Live Sales. Please search or add a customer to proceed.'
      );
      setShowCustomerDropdown(true);
      return;
    }

    try {
      setIsSubmitting(true);
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const customerId = selectedCustomer.id;
      const customerName = selectedCustomer.name;
      const customerPhone = selectedCustomer.phone;
      const customerEmail = selectedCustomer.email || '';
      const customerAddress = selectedCustomer.address || '';

      const cashierName = selectedCashier?.name || employeeProfile?.name || (user?.email ? user.email.split('@')[0] : 'Cashier');
      const cashierId = selectedCashier?.id || employeeProfile?.id || user?.uid || 'staff';

      const splitCashNum = selectedPayment === 'Split' ? parseFloat(posSplitCash) || 0 : selectedPayment === 'Cash' ? receivedAmount : 0;
      const splitUpiNum = selectedPayment === 'Split' ? parseFloat(posSplitUPI) || 0 : selectedPayment === 'UPI' ? receivedAmount : 0;
      const splitCardNum = selectedPayment === 'Card' ? receivedAmount : 0;

      const liveSalePayload: Omit<LiveSaleRecord, 'id'> = {
        billNo: activeBillNo,
        receiptNumber: activeBillNo,
        customerId,
        customerName,
        customerPhone,
        customerEmail,
        customerAddress,
        cashierId,
        cashierName,
        cashierCode: selectedCashier?.empId || '',
        items: cart,
        paymentMode: selectedPayment,
        splitCash: splitCashNum,
        splitUpi: splitUpiNum,
        splitCard: splitCardNum,
        subtotal,
        tax: 0,
        discount: discountAmount,
        total: grandTotal,
        grandTotal,
        receivedAmount,
        creditAmount,
        paymentStatus,
        status: creditAmount > 0 ? 'Credit Due' : 'Completed',
        savedAt: now.toISOString(),
        date: dateStr,
        time: timeStr,
        createdAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'live_sales'), liveSalePayload);

      const completedRecord: LiveSaleRecord = {
        id: docRef.id,
        ...liveSalePayload,
      };

      setLastSettledBill(completedRecord);
      setShowReceiptModal(true);

      // Audit Logging
      try {
        await logAuditEvent({
          action: 'Live Sale Completed',
          actionType: 'pos_sale',
          description: `Completed Live Sale [${activeBillNo}] of ₹${grandTotal.toFixed(2)} (Recv: ₹${receivedAmount.toFixed(2)}, Due: ₹${creditAmount.toFixed(2)}) by ${cashierName}`,
          employeeId: cashierId,
          employeeName: cashierName,
          employeeRole: 'Cashier',
          amount: grandTotal,
          cashAmount: splitCashNum,
          paymentMode: selectedPayment,
          date: dateStr,
          metadata: { billNo: activeBillNo, itemsCount: cart.length, liveSaleId: docRef.id, creditAmount, receivedAmount },
        });
      } catch (err) {
        console.warn('Live sale audit log error:', err);
      }

      // Auto Print Receipt if Thermal Printer is connected
      if (isPrinterConnected) {
        try {
          await printReceipt({
            billNo: activeBillNo,
            dateStr,
            timeStr,
            customerName,
            customerPhone,
            cashierName,
            items: cart.map((i) => ({
              name: i.name,
              qty: i.quantity,
              unit: i.unit,
              price: i.price,
              total: i.totalAmount,
            })),
            subtotal,
            tax: 0,
            discount: discountAmount,
            grandTotal,
            receivedAmount,
            creditAmount,
            paymentMode: selectedPayment,
          });
          toast.success('Printed Receipt', 'Live sale receipt sent to thermal printer.');
        } catch (printErr) {
          console.warn('Printer automatic slip error:', printErr);
        }
      }

      // Reset cart and generate next bill number
      setCart([]);
      setDiscountAmount(0);
      setSelectedCustomer(null);
      setCustomerSearch('');
      setReceivedAmountInput('');
      setPosSplitCash('');
      setPosSplitUPI('');
      setActiveBillNo(`LIVE-${Date.now().toString().slice(-6)}`);
      setIsMobileCheckoutOpen(false);
      toast.success('Live Sale Settled', `Bill ${activeBillNo} saved successfully!`);
    } catch (err: any) {
      console.error('Error settling live sale:', err);
      toast.error('Sale Settlement Failed', err.message || 'Could not save live sale transaction.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-[#f6f6f7] p-3 sm:p-5 md:p-6 space-y-4">
      {/* ── 1. TOP HEADER & QUICK STATS ────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center text-[#02626D] shadow-2xs">
            <Receipt size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">Live Counter POS Sales</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                <Activity size={11} className="text-emerald-600 animate-pulse" />
                <span>Live Terminal</span>
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              High-speed barcode cashier checkout, weight scale calculator &amp; thermal receipt printing.
            </p>
          </div>
        </div>

        {/* Right Header Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Cashier Selector */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200 text-xs">
            <User size={13} className="text-[#02626D]" />
            <span className="text-[11px] font-bold text-slate-500">Cashier:</span>
            <select
              value={selectedCashier?.id || ''}
              onChange={(e) => {
                const emp = employeesList.find((em) => em.id === e.target.value);
                if (emp) setSelectedCashier(emp);
              }}
              className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              {employeesList.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} {emp.empId ? `(${emp.empId})` : ''}
                </option>
              ))}
            </select>
          </div>

          <Link
            href="/live-sales-analytics"
            className="h-8.5 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
          >
            <TrendingUp size={14} className="text-[#02626D]" />
            <span>Live Analytics</span>
          </Link>
        </div>
      </div>

      {/* ── 2. MAIN POS WORKSPACE (2-Column Desktop Grid) ──────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        
        {/* Left Column: Product Search, Barcode & Category Grid (7 Cols) */}
        <div className="lg:col-span-7 space-y-3">
          
          {/* Search & Barcode Bar */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2.5">
            <div className="flex items-center gap-2">
              {/* Product Name Search */}
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Search products by name, code, or category..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 h-9 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-[#02626D] bg-[#f7f7f8] focus:bg-white font-medium"
                />
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>

              {/* Barcode Quick Scan Input */}
              <form onSubmit={handleBarcodeSubmit} className="relative w-44 hidden sm:block">
                <input
                  type="text"
                  placeholder="Scan Barcode..."
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  className="w-full pl-8 pr-3 h-9 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-[#02626D] bg-teal-50/50 focus:bg-white font-mono font-bold text-slate-800"
                />
                <Barcode size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#02626D] pointer-events-none" />
              </form>
            </div>

            {/* Category Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
              {categoriesList.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-[#02626D] text-white shadow-2xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Product Items Grid */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-2xs min-h-[460px]">
            {loadingItems ? (
              <div className="p-12 text-center text-xs text-slate-400 font-medium">
                Loading products catalog...
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400 font-medium">
                No products found matching &ldquo;{searchQuery}&rdquo;.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5 max-h-[580px] overflow-y-auto pr-1">
                {filteredProducts.map((prod) => {
                  const unitPrice = typeof prod.posPrice === 'number' && prod.posPrice > 0 ? prod.posPrice : prod.price || 0;
                  const isWeight = isWeightUnit(prod.unit);

                  return (
                    <div
                      key={prod.id}
                      onClick={() => handleProductClick(prod)}
                      className="p-2.5 rounded-xl border border-slate-200/90 hover:border-[#02626D] hover:bg-teal-50/20 bg-white shadow-2xs hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between group select-none"
                    >
                      <div className="flex items-start gap-2 mb-1.5 relative">
                        <div className="relative w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 overflow-hidden flex-shrink-0 group-hover:border-teal-200">
                          <Image
                            src={prod.imageUrl || '/app-icon.png'}
                            alt={prod.name}
                            fill
                            className="object-contain p-1"
                          />
                        </div>
                        <div className="min-w-0 flex-1 pr-4">
                          <p className="text-xs font-bold text-slate-900 group-hover:text-[#02626D] transition-colors line-clamp-2 leading-snug">
                            {prod.name}
                          </p>
                          <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                            {prod.code || prod.category}
                          </span>
                        </div>
                        {Boolean(prod.isFavorite || (prod as any).isFavourite || (prod as any).favorite) && (
                          <div
                            className="absolute top-0 right-0 p-0.5 rounded-full bg-amber-50 border border-amber-200"
                            title="Favourite Item"
                          >
                            <Star size={10} className="fill-amber-400 text-amber-500" />
                          </div>
                        )}
                      </div>

                      <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                        <div>
                          <span className="text-xs font-black text-[#02626D]">
                            ₹{unitPrice}
                          </span>
                          <span className="text-[10px] text-slate-400 font-normal">/{prod.unit}</span>
                        </div>
                        <button
                          type="button"
                          className="h-6 px-2 rounded-md bg-[#02626D] hover:bg-[#014d56] text-white text-[10.5px] font-bold shadow-2xs transition-all cursor-pointer"
                        >
                          {isWeight ? 'Scale' : '+ Add'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* Right Column: Billing Cart, Customer Info & Payment Settlement (5 Cols) */}
        <div className="lg:col-span-5 space-y-3">
          
          {/* Cart Card */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4 space-y-3.5">
            
            {/* Cart Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900">Current Sale Cart</span>
                <span className="px-2 py-0.2 rounded-full text-[10.5px] font-bold bg-teal-50 text-[#02626D] border border-teal-200">
                  {cart.length} Items
                </span>
              </div>
              <span className="text-[11px] font-mono font-bold text-slate-500">{activeBillNo}</span>
            </div>

            {/* Customer Selection (Mandatory) */}
            <div className="space-y-1.5 relative">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <div className="flex items-center gap-1">
                  <span className="text-slate-700">Customer</span>
                  <span className="text-rose-500 font-extrabold">* (Mandatory)</span>
                </div>
                {selectedCustomer && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCustomer(null);
                      setCustomerSearch('');
                    }}
                    className="text-rose-500 hover:text-rose-700 text-[10.5px] font-semibold flex items-center gap-0.5 cursor-pointer"
                  >
                    Change Customer
                  </button>
                )}
              </div>

              {selectedCustomer ? (
                <div className="p-2.5 rounded-xl border border-teal-200 bg-teal-50/60 flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs text-slate-900 truncate">{selectedCustomer.name}</span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-[#02626D] text-white">Selected</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10.5px] text-slate-600 mt-0.5">
                      <span className="flex items-center gap-0.5 font-medium">
                        <Phone size={11} className="text-[#02626D]" /> {selectedCustomer.phone}
                      </span>
                      {selectedCustomer.address && (
                        <span className="truncate max-w-[140px] text-slate-500">
                          • {selectedCustomer.address}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <div className="relative flex-1">
                      <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Search customer name or mobile..."
                        value={customerSearch}
                        onFocus={() => setShowCustomerDropdown(true)}
                        onChange={(e) => {
                          setCustomerSearch(e.target.value);
                          setShowCustomerDropdown(true);
                        }}
                        className="w-full pl-8 pr-2.5 h-8.5 border border-amber-300 rounded-xl text-xs font-medium text-slate-800 bg-amber-50/30 focus:bg-white focus:outline-none focus:border-[#02626D] focus:ring-1 focus:ring-[#02626D]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAddCustomerModal(true)}
                      className="h-8.5 px-2.5 rounded-xl bg-[#02626D] hover:bg-[#014d56] text-white text-[11px] font-bold flex items-center gap-1 whitespace-nowrap shadow-2xs transition-all cursor-pointer"
                    >
                      <UserPlus size={13} />
                      <span>+ Add</span>
                    </button>
                  </div>

                  {/* Warning banner when no customer selected */}
                  <div className="px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px] flex items-center gap-1.5">
                    <AlertTriangle size={12} className="text-amber-600 flex-shrink-0" />
                    <span>Please select or add a customer to enable live sale.</span>
                  </div>

                  {/* Customer Dropdown Results */}
                  {showCustomerDropdown && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl border border-slate-200 shadow-xl z-30 max-h-56 overflow-y-auto p-1 divide-y divide-slate-100">
                      <div className="px-2 py-1 flex items-center justify-between text-[10.5px] font-bold text-slate-400 bg-slate-50 rounded-lg">
                        <span>Select Matching Customer</span>
                        <button
                          type="button"
                          onClick={() => setShowCustomerDropdown(false)}
                          className="text-slate-500 hover:text-slate-800"
                        >
                          <X size={12} />
                        </button>
                      </div>

                      {filteredCustomerOptions.length === 0 ? (
                        <div className="p-3 text-center text-xs text-slate-500 space-y-1.5">
                          <p>No customer found matching &ldquo;{customerSearch}&rdquo;</p>
                          <button
                            type="button"
                            onClick={() => {
                              setShowCustomerDropdown(false);
                              if (/^\d+$/.test(customerSearch.trim())) {
                                setNewCustMobile(customerSearch.trim());
                              } else {
                                setNewCustName(customerSearch.trim());
                              }
                              setShowAddCustomerModal(true);
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-[#02626D] text-white font-bold text-xs rounded-lg hover:bg-[#014d56]"
                          >
                            <UserPlus size={12} />
                            <span>Create &ldquo;{customerSearch || 'New Customer'}&rdquo;</span>
                          </button>
                        </div>
                      ) : (
                        filteredCustomerOptions.map((cust) => (
                          <div
                            key={cust.id}
                            onClick={() => {
                              setSelectedCustomer(cust);
                              setCustomerSearch('');
                              setShowCustomerDropdown(false);
                            }}
                            className="p-2 hover:bg-teal-50/60 rounded-lg cursor-pointer transition-all flex items-center justify-between"
                          >
                            <div>
                              <p className="text-xs font-bold text-slate-800">{cust.name}</p>
                              <p className="text-[10.5px] text-slate-500 flex items-center gap-1">
                                <Phone size={10} className="text-[#02626D]" /> {cust.phone || 'No phone'}
                              </p>
                            </div>
                            <span className="text-[10px] font-bold text-[#02626D] bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full">
                              Select
                            </span>
                          </div>
                        ))
                      )}

                      <div className="p-1.5 pt-2 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => {
                            setShowCustomerDropdown(false);
                            setShowAddCustomerModal(true);
                          }}
                          className="w-full py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <UserPlus size={13} className="text-[#02626D]" />
                          <span>+ Add New Customer</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Cart Items List Table */}
            <div className="border border-slate-200/90 rounded-xl overflow-hidden">
              {cart.length === 0 ? (
                <div className="p-10 text-center text-xs text-slate-400 font-medium">
                  Cart is empty. Tap products on the left or scan barcode.
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
                  {cart.map((cItem, idx) => (
                    <div key={cItem.id} className="p-2.5 flex items-center justify-between gap-2 hover:bg-slate-50/50">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-900 truncate">{cItem.name}</p>
                        <div className="flex items-center gap-1.5 text-[10.5px] text-slate-400 font-mono mt-0.5">
                          <span>₹{cItem.price}/{cItem.unit}</span>
                          <span>•</span>
                          <span className="font-bold text-slate-700">
                            {cItem.isWeight ? `${cItem.quantity} KG` : `${cItem.quantity} pcs`}
                          </span>
                        </div>
                      </div>

                      {/* Quantity adjuster */}
                      <div className="flex items-center gap-1">
                        {!cItem.isWeight && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                if (cItem.quantity > 1) {
                                  setCart((prev) => {
                                    const cp = [...prev];
                                    cp[idx].quantity -= 1;
                                    cp[idx].totalAmount = cp[idx].price * cp[idx].quantity;
                                    return cp;
                                  });
                                }
                              }}
                              className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs cursor-pointer"
                            >
                              -
                            </button>
                            <span className="w-6 text-center text-xs font-bold text-slate-900">
                              {cItem.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setCart((prev) => {
                                  const cp = [...prev];
                                  cp[idx].quantity += 1;
                                  cp[idx].totalAmount = cp[idx].price * cp[idx].quantity;
                                  return cp;
                                });
                              }}
                              className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs cursor-pointer"
                            >
                              +
                            </button>
                          </>
                        )}

                        <span className="text-xs font-black text-[#02626D] w-16 text-right">
                          ₹{cItem.totalAmount.toFixed(2)}
                        </span>

                        <button
                          type="button"
                          onClick={() => {
                            setCart((prev) => prev.filter((_, i) => i !== idx));
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">Payment Mode</label>
              <div className="grid grid-cols-4 gap-1.5">
                {(['UPI', 'Cash', 'Card', 'Split'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setSelectedPayment(mode)}
                    className={`py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1 ${
                      selectedPayment === mode
                        ? 'bg-[#02626D] text-white border-[#02626D] shadow-2xs'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {mode === 'UPI' && <QrCode size={13} />}
                    {mode === 'Cash' && <Banknote size={13} />}
                    {mode === 'Card' && <CreditCard size={13} />}
                    {mode === 'Split' && <Coins size={13} />}
                    <span>{mode}</span>
                  </button>
                ))}
              </div>

              {/* Split payment inputs */}
              {selectedPayment === 'Split' && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500">Cash Portion (₹)</label>
                    <input
                      type="number"
                      placeholder="Cash ₹"
                      value={posSplitCash}
                      onChange={(e) => setPosSplitCash(e.target.value)}
                      className="w-full h-8 px-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500">UPI Portion (₹)</label>
                    <input
                      type="number"
                      placeholder="UPI ₹"
                      value={posSplitUPI}
                      readOnly
                      className="w-full h-8 px-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 bg-slate-100"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Bill Financial Summary */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-2">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal ({cart.length} items):</span>
                <span className="font-bold text-slate-800 font-mono">₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-slate-500">
                <span>Discount (₹):</span>
                <input
                  type="number"
                  value={discountAmount || ''}
                  onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="w-20 h-6 px-2 text-right border border-slate-300 rounded text-xs font-bold text-slate-800 bg-white"
                />
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline">
                <span className="font-extrabold text-slate-900 text-sm">Grand Total:</span>
                <span className="font-black text-xl text-[#02626D] font-mono">
                  ₹{grandTotal.toFixed(2)}
                </span>
              </div>

              {/* Received Amount Input & Credit Calculation */}
              <div className="pt-2 border-t border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700">Received Amount (₹):</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setReceivedAmountInput(grandTotal.toString())}
                      className="px-1.5 py-0.5 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold text-[10px] cursor-pointer"
                    >
                      Full Paid
                    </button>
                    <button
                      type="button"
                      onClick={() => setReceivedAmountInput('0')}
                      className="px-1.5 py-0.5 rounded bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold text-[10px] cursor-pointer"
                    >
                      100% Credit
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs">₹</span>
                  <input
                    type="number"
                    step="any"
                    placeholder={grandTotal.toFixed(2)}
                    value={receivedAmountInput}
                    onChange={(e) => setReceivedAmountInput(e.target.value)}
                    className="w-full h-8 pl-6 pr-3 border border-slate-300 rounded-lg text-xs font-black text-slate-900 bg-white focus:outline-none focus:border-[#02626D]"
                  />
                </div>

                {/* Credit / Balance Callout */}
                {creditAmount > 0 ? (
                  <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 space-y-0.5">
                    <div className="flex justify-between items-center font-bold text-xs">
                      <span>Remaining Credit Due:</span>
                      <span className="text-amber-700 font-mono font-black text-sm">₹{creditAmount.toFixed(2)}</span>
                    </div>
                    <p className="text-[10px] text-amber-700">
                      Balance will be stored as Credit Due for {selectedCustomer ? selectedCustomer.name : 'Customer'} and tracked in Live Sales Analytics.
                    </p>
                  </div>
                ) : (
                  <div className="px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10.5px] font-bold flex items-center gap-1">
                    <CheckCircle2 size={12} className="text-emerald-600" />
                    <span>Full payment received — Zero credit balance.</span>
                  </div>
                )}
              </div>
            </div>

            {/* Settle Action Button */}
            <button
              type="button"
              onClick={handleSettleBill}
              disabled={isSubmitting || cart.length === 0}
              className={`w-full h-11 rounded-xl font-bold text-xs shadow-2xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 ${
                !selectedCustomer
                  ? 'bg-amber-500 hover:bg-amber-600 text-white'
                  : 'bg-[#02626D] hover:bg-[#014d56] text-white disabled:opacity-50'
              }`}
            >
              {isSubmitting ? (
                <div className="flex items-center gap-1.5">
                  <Loader2 size={15} className="animate-spin" />
                  <span>Settling Live Sale...</span>
                </div>
              ) : !selectedCustomer ? (
                <div className="flex items-center gap-1.5">
                  <AlertTriangle size={15} />
                  <span>Select Customer (Mandatory) to Settle</span>
                </div>
              ) : (
                <>
                  <Printer size={15} />
                  <span>
                    Settle &amp; Print Slip (Recv: ₹{receivedAmount.toFixed(2)}
                    {creditAmount > 0 ? ` | Due: ₹${creditAmount.toFixed(2)}` : ''})
                  </span>
                </>
              )}
            </button>

          </div>

        </div>

      </div>

      {/* ── 3. WEIGHT & AMOUNT SCALE CALCULATOR MODAL ───────────────────────── */}
      {activeWeightItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div>
                <h3 className="text-sm font-bold text-slate-900">{activeWeightItem.name}</h3>
                <p className="text-[11px] text-slate-400 font-mono">
                  Rate: ₹{activeWeightItem.posPrice || activeWeightItem.price} / {activeWeightItem.unit}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveWeightItem(null)}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Quick Presets */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1.5">Weight Presets</label>
              <div className="grid grid-cols-4 gap-1.5">
                {PRESET_WEIGHTS.map((preset) => {
                  const unitPrice = activeWeightItem.posPrice || activeWeightItem.price || 0;
                  const presetAmt = (unitPrice * preset.kg).toFixed(2);
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setInputWeightKg(preset.kg.toString());
                        setInputAmount(presetAmt);
                      }}
                      className="p-1.5 rounded-lg border border-slate-200 hover:border-[#02626D] bg-slate-50 hover:bg-teal-50/40 text-center transition-all cursor-pointer"
                    >
                      <span className="text-xs font-bold text-slate-800 block">{preset.label}</span>
                      <span className="text-[10px] text-slate-500 block">₹{presetAmt}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Manual Inputs: Weight or Amount */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Weight (KG)</label>
                <input
                  type="number"
                  step="0.01"
                  value={inputWeightKg}
                  onChange={(e) => {
                    const val = e.target.value;
                    setInputWeightKg(val);
                    const num = parseFloat(val) || 0;
                    const unitPrice = activeWeightItem.posPrice || activeWeightItem.price || 0;
                    setInputAmount((unitPrice * num).toFixed(2));
                  }}
                  className="w-full h-9 px-2.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 bg-[#f7f7f8] focus:bg-white focus:outline-none focus:border-[#02626D]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Amount (₹)</label>
                <input
                  type="number"
                  step="1"
                  value={inputAmount}
                  onChange={(e) => {
                    const val = e.target.value;
                    setInputAmount(val);
                    const amt = parseFloat(val) || 0;
                    const unitPrice = activeWeightItem.posPrice || activeWeightItem.price || 0;
                    if (unitPrice > 0) {
                      setInputWeightKg((amt / unitPrice).toFixed(3));
                    }
                  }}
                  className="w-full h-9 px-2.5 border border-slate-300 rounded-lg text-xs font-black text-[#02626D] bg-[#f7f7f8] focus:bg-white focus:outline-none focus:border-[#02626D]"
                />
              </div>
            </div>

            {/* Add to Cart button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  const qty = parseFloat(inputWeightKg) || 0;
                  const amt = parseFloat(inputAmount) || 0;
                  if (qty > 0 && amt > 0) {
                    addItemToCart(activeWeightItem, qty, amt);
                    setActiveWeightItem(null);
                  }
                }}
                className="w-full h-9 rounded-xl bg-[#02626D] hover:bg-[#014d56] text-white font-bold text-xs shadow-2xs transition-all cursor-pointer"
              >
                Add {inputWeightKg} KG (₹{inputAmount})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 4. RECEIPT MODAL ───────────────────────────────────────────────── */}
      {showReceiptModal && lastSettledBill && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-3.5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-600" />
                <h3 className="text-xs font-bold text-slate-900">Sale Complete</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowReceiptModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Receipt Summary Card */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-2">
              <div className="text-center pb-2 border-b border-slate-200">
                <h4 className="font-extrabold text-slate-900 text-sm">{businessSettings.businessName}</h4>
                <p className="text-[10px] text-slate-400 font-mono">{lastSettledBill.billNo}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{lastSettledBill.date} {lastSettledBill.time}</p>
              </div>

              <div className="space-y-1 divide-y divide-slate-100 max-h-40 overflow-y-auto pr-1">
                {lastSettledBill.items.map((it) => (
                  <div key={it.id} className="pt-1 flex justify-between text-[11px]">
                    <span className="truncate pr-2">{it.name} ({it.quantity}{it.unit})</span>
                    <span className="font-bold font-mono">₹{it.totalAmount.toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-slate-200 flex justify-between font-black text-xs text-slate-700">
                <span>Net Total:</span>
                <span className="font-mono">₹{lastSettledBill.total.toFixed(2)}</span>
              </div>

              <div className="flex justify-between font-bold text-xs text-emerald-700">
                <span>Received / Paid:</span>
                <span className="font-mono">
                  ₹{(lastSettledBill.receivedAmount !== undefined ? lastSettledBill.receivedAmount : lastSettledBill.total).toFixed(2)}
                </span>
              </div>

              {lastSettledBill.creditAmount && lastSettledBill.creditAmount > 0 ? (
                <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 flex justify-between font-black text-xs text-amber-800">
                  <span>CREDIT / DUE:</span>
                  <span className="font-mono font-black text-sm text-amber-700">₹{lastSettledBill.creditAmount.toFixed(2)}</span>
                </div>
              ) : null}
            </div>

            {/* Print Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  if (isPrinterConnected) {
                    await printReceipt({
                      billNo: lastSettledBill.billNo,
                      dateStr: lastSettledBill.date,
                      timeStr: lastSettledBill.time,
                      customerName: lastSettledBill.customerName,
                      customerPhone: lastSettledBill.customerPhone,
                      cashierName: lastSettledBill.cashierName,
                      items: lastSettledBill.items.map((i) => ({
                        name: i.name,
                        qty: i.quantity,
                        unit: i.unit,
                        price: i.price,
                        total: i.totalAmount,
                      })),
                      subtotal: lastSettledBill.subtotal,
                      tax: 0,
                      discount: lastSettledBill.discount,
                      grandTotal: lastSettledBill.total,
                      receivedAmount: lastSettledBill.receivedAmount,
                      creditAmount: lastSettledBill.creditAmount,
                      paymentMode: lastSettledBill.paymentMode,
                    });
                  } else {
                    printWindow();
                  }
                }}
                className="flex-1 h-9 rounded-xl bg-[#02626D] hover:bg-[#014d56] text-white font-bold text-xs shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Printer size={14} />
                <span>Reprint Slip</span>
              </button>

              <button
                type="button"
                onClick={() => setShowReceiptModal(false)}
                className="h-9 px-4 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 5. ADD NEW CUSTOMER MODAL (MANDATORY INTAKE) ───────────────────── */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-[#02626D]">
                  <UserPlus size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Add &amp; Select Customer</h3>
                  <p className="text-[11px] text-slate-400">Mandatory for live sales billing &amp; credit tracking</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddCustomerModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveAndSelectCustomer} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Customer Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Kumar"
                    value={newCustName}
                    onChange={(e) => setNewCustName(e.target.value)}
                    className="w-full pl-8 pr-3 h-9 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 bg-[#f7f7f8] focus:bg-white focus:outline-none focus:border-[#02626D]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mobile Number <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Phone size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 9876543210"
                    value={newCustMobile}
                    onChange={(e) => setNewCustMobile(e.target.value)}
                    className="w-full pl-8 pr-3 h-9 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 bg-[#f7f7f8] focus:bg-white focus:outline-none focus:border-[#02626D]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email Address <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <Mail size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    placeholder="e.g. customer@example.com"
                    value={newCustEmail}
                    onChange={(e) => setNewCustEmail(e.target.value)}
                    className="w-full pl-8 pr-3 h-9 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 bg-[#f7f7f8] focus:bg-white focus:outline-none focus:border-[#02626D]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Address / City <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <MapPin size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
                  <textarea
                    rows={2}
                    placeholder="e.g. Door No. 4-12, Main Bazaar, Tirupati"
                    value={newCustAddress}
                    onChange={(e) => setNewCustAddress(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 bg-[#f7f7f8] focus:bg-white focus:outline-none focus:border-[#02626D] resize-none"
                  />
                </div>
              </div>

              {/* Form Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddCustomerModal(false)}
                  disabled={isSavingCustomer}
                  className="px-4 h-9 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingCustomer}
                  className="px-5 h-9 rounded-xl bg-[#02626D] hover:bg-[#014d56] disabled:opacity-50 text-white font-bold text-xs shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  {isSavingCustomer ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Saving &amp; Selecting...</span>
                    </>
                  ) : (
                    <>
                      <Check size={14} />
                      <span>Save &amp; Select Customer</span>
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

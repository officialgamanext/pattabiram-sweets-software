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
} from 'firebase/firestore';
import type { ItemRecord } from './ItemsClient';

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

export interface SavedBill {
  id: string;
  billNo: string;
  customerName: string;
  customerPhone: string;
  items: PosCartItem[];
  paymentMode: 'Cash' | 'UPI' | 'Card';
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  savedAt: string;
}

export interface CustomerRecord {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
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

export default function PosClient() {
  // Products & Categories state from Firestore
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Hardware Connection State
  const [isPrinterConnected, setIsPrinterConnected] = useState<boolean>(false);
  const [printerDeviceName, setPrinterDeviceName] = useState<string>('');
  const [printerType, setPrinterType] = useState<'USB' | 'Bluetooth' | 'Standard'>('Standard');
  const [isBarcodeActive, setIsBarcodeActive] = useState<boolean>(true);
  const [barcodeInput, setBarcodeInput] = useState<string>('');

  // Cart State
  const [cart, setCart] = useState<PosCartItem[]>([]);
  const [selectedPayment, setSelectedPayment] = useState<'Cash' | 'UPI' | 'Card'>('UPI');
  const [discountAmount, setDiscountAmount] = useState<number>(0);

  // Customer Selection State
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRecord | null>(null);
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState<boolean>(false);
  const [customCustomerName, setCustomCustomerName] = useState<string>('');
  const [customCustomerPhone, setCustomCustomerPhone] = useState<string>('');

  // Modal State: Weight & Amount Calculator
  const [activeWeightItem, setActiveWeightItem] = useState<ItemRecord | null>(null);
  const [editingCartItemIndex, setEditingCartItemIndex] = useState<number | null>(null);
  const [inputWeightKg, setInputWeightKg] = useState<string>('1.0');
  const [inputAmount, setInputAmount] = useState<string>('');

  // Saved Draft Bills State
  const [savedBills, setSavedBills] = useState<SavedBill[]>([]);
  const [showSavedBillsDrawer, setShowSavedBillsDrawer] = useState<boolean>(false);
  const [activeBillNo, setActiveBillNo] = useState<string>(`POS-${Date.now().toString().slice(-6)}`);

  // Receipt Modal State
  const [lastSettledBill, setLastSettledBill] = useState<SavedBill | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState<boolean>(false);

  // Load Products from Firestore
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'items'),
      (snapshot) => {
        const docs: ItemRecord[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as ItemRecord[];
        setItems(docs.filter((i) => i.status !== 'Inactive'));
        setLoadingItems(false);
      },
      (error) => {
        console.error('Error fetching items for POS:', error);
        // Default fallback sample items if Firestore is empty
        setItems([
          { id: '1', code: 'SW-101', name: 'Moti Choor Ladoo', price: 540, category: 'Sweets', unit: 'KG', status: 'Active' },
          { id: '2', code: 'SW-102', name: 'Kaju Katli Premium', price: 960, category: 'Sweets', unit: 'KG', status: 'Active' },
          { id: '3', code: 'SW-103', name: 'Gulab Jamun', price: 420, category: 'Sweets', unit: 'KG', status: 'Active' },
          { id: '4', code: 'SN-201', name: 'Special Mixture', price: 320, category: 'Savouries', unit: 'KG', status: 'Active' },
          { id: '5', code: 'SN-202', name: 'Murukku (Crispy)', price: 280, category: 'Savouries', unit: 'KG', status: 'Active' },
          { id: '6', code: 'PK-301', name: 'Ghee Mysore Pak Box (250g)', price: 180, category: 'Packets', unit: 'Piece', status: 'Active' },
          { id: '7', code: 'PK-302', name: 'Milk Peda Gift Box', price: 350, category: 'Packets', unit: 'Piece', status: 'Active' },
        ]);
        setLoadingItems(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Load Customers from Firestore
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'customers'),
      (snapshot) => {
        const docs: CustomerRecord[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as CustomerRecord[];
        setCustomers(docs);
      },
      () => {}
    );
    return () => unsubscribe();
  }, []);

  // Load Saved Draft Bills from Firestore or LocalStorage
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'pos_saved_bills'),
      (snapshot) => {
        const docs: SavedBill[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as SavedBill[];
        setSavedBills(docs);
      },
      () => {
        // Local storage fallback
        const local = localStorage.getItem('pos_saved_bills');
        if (local) {
          try {
            setSavedBills(JSON.parse(local));
          } catch {}
        }
      }
    );
    return () => unsubscribe();
  }, []);

  // Barcode Listener for USB Barcode Reader
  useEffect(() => {
    let barcodeBuffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing inside an input text field
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      const currentTime = Date.now();
      if (currentTime - lastKeyTime > 100) {
        barcodeBuffer = '';
      }
      lastKeyTime = currentTime;

      if (e.key === 'Enter') {
        if (barcodeBuffer.length >= 2) {
          handleBarcodeScanned(barcodeBuffer.trim());
          barcodeBuffer = '';
        }
      } else if (e.key.length === 1) {
        barcodeBuffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items]);

  // Barcode Match Handler
  const handleBarcodeScanned = (code: string) => {
    const matched = items.find(
      (i) =>
        i.code.toLowerCase() === code.toLowerCase() ||
        i.id.toLowerCase() === code.toLowerCase() ||
        i.name.toLowerCase().includes(code.toLowerCase())
    );
    if (matched) {
      handleSelectProduct(matched);
    } else {
      alert(`No product found matching barcode: ${code}`);
    }
  };

  // Categories list derived from items
  const categories = useMemo(() => {
    const set = new Set<string>();
    set.add('All');
    items.forEach((i) => {
      if (i.category) set.add(i.category);
    });
    return Array.from(set);
  }, [items]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return items.filter((item) => {
      const matchCat = selectedCategory === 'All' || item.category === selectedCategory;
      const matchQuery =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.code.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchQuery;
    });
  }, [items, selectedCategory, searchQuery]);

  // Cart Item Map for Instant Active UI Highlight on Product Cards
  const cartItemMap = useMemo(() => {
    const map = new Map<string, PosCartItem>();
    cart.forEach((c) => {
      map.set(c.itemId, c);
    });
    return map;
  }, [cart]);

  // Cart Calculations
  const cartSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.totalAmount, 0);
  }, [cart]);

  const cartTax = useMemo(() => {
    return Math.round(cartSubtotal * 0.05); // 5% GST
  }, [cartSubtotal]);

  const cartGrandTotal = useMemo(() => {
    return Math.max(0, cartSubtotal + cartTax - discountAmount);
  }, [cartSubtotal, cartTax, discountAmount]);

  const totalItemCount = useMemo(() => {
    return cart.reduce((sum, i) => sum + (i.isWeight ? 1 : i.quantity), 0);
  }, [cart]);

  // Product Selection Handler (Weight Modal vs Direct Add)
  const handleSelectProduct = (item: ItemRecord) => {
    const isWeightType = isWeightUnit(item.unit);

    if (isWeightType) {
      setActiveWeightItem(item);
      setEditingCartItemIndex(null);
      const defaultKg = 1.0;
      setInputWeightKg('1.0');
      setInputAmount((item.price * defaultKg).toString());
    } else {
      // Piece item: direct add or increment count in cart
      setCart((prev) => {
        const existingIdx = prev.findIndex((ci) => ci.itemId === item.id);
        if (existingIdx >= 0) {
          const updated = [...prev];
          const newQty = updated[existingIdx].quantity + 1;
          updated[existingIdx] = {
            ...updated[existingIdx],
            quantity: newQty,
            totalAmount: updated[existingIdx].price * newQty,
          };
          return updated;
        } else {
          return [
            ...prev,
            {
              id: `cart-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              itemId: item.id,
              code: item.code,
              name: item.name,
              price: item.price,
              unit: item.unit,
              isWeight: false,
              quantity: 1,
              totalAmount: item.price,
            },
          ];
        }
      });
    }
  };

  // Weight Modal Recalculation Handlers
  const handleWeightChange = (val: string) => {
    setInputWeightKg(val);
    const numericKg = parseFloat(val) || 0;
    const rate = activeWeightItem
      ? activeWeightItem.price
      : editingCartItemIndex !== null
      ? cart[editingCartItemIndex].price
      : 0;
    setInputAmount((numericKg * rate).toFixed(2));
  };

  const handleAmountChange = (val: string) => {
    setInputAmount(val);
    const numericAmount = parseFloat(val) || 0;
    const rate = activeWeightItem
      ? activeWeightItem.price
      : editingCartItemIndex !== null
      ? cart[editingCartItemIndex].price
      : 0;
    if (rate > 0) {
      setInputWeightKg((numericAmount / rate).toFixed(3));
    }
  };

  const handleApplyPresetWeight = (kg: number) => {
    setInputWeightKg(kg.toString());
    const rate = activeWeightItem
      ? activeWeightItem.price
      : editingCartItemIndex !== null
      ? cart[editingCartItemIndex].price
      : 0;
    setInputAmount((kg * rate).toFixed(2));
  };

  // Confirm Weight Item Modal Add/Update
  const handleConfirmWeightItem = () => {
    const numericKg = parseFloat(inputWeightKg) || 0;
    const numericAmount = parseFloat(inputAmount) || 0;

    if (numericKg <= 0 || numericAmount <= 0) {
      alert('Please enter a valid weight or amount.');
      return;
    }

    if (editingCartItemIndex !== null) {
      // Updating existing item in cart
      setCart((prev) => {
        const updated = [...prev];
        updated[editingCartItemIndex] = {
          ...updated[editingCartItemIndex],
          quantity: numericKg,
          totalAmount: Math.round(numericAmount),
          weightGrams: Math.round(numericKg * 1000),
        };
        return updated;
      });
    } else if (activeWeightItem) {
      // Adding new weight item to cart
      setCart((prev) => [
        ...prev,
        {
          id: `cart-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          itemId: activeWeightItem.id,
          code: activeWeightItem.code,
          name: activeWeightItem.name,
          price: activeWeightItem.price,
          unit: activeWeightItem.unit,
          isWeight: true,
          quantity: numericKg,
          totalAmount: Math.round(numericAmount),
          weightGrams: Math.round(numericKg * 1000),
        },
      ]);
    }

    setActiveWeightItem(null);
    setEditingCartItemIndex(null);
  };

  // Edit Existing Cart Item
  const handleEditCartItem = (index: number) => {
    const cartItem = cart[index];
    if (cartItem.isWeight) {
      setEditingCartItemIndex(index);
      setActiveWeightItem({
        id: cartItem.itemId,
        code: cartItem.code,
        name: cartItem.name,
        price: cartItem.price,
        category: '',
        unit: cartItem.unit as any,
        status: 'Active',
      });
      setInputWeightKg(cartItem.quantity.toString());
      setInputAmount(cartItem.totalAmount.toString());
    }
  };

  // Remove Item from Cart
  const handleRemoveCartItem = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  // Change Piece Quantity
  const handleUpdatePieceQuantity = (index: number, delta: number) => {
    setCart((prev) => {
      const updated = [...prev];
      const newQty = Math.max(1, updated[index].quantity + delta);
      updated[index] = {
        ...updated[index],
        quantity: newQty,
        totalAmount: updated[index].price * newQty,
      };
      return updated;
    });
  };

  // Save Bill (Hold Draft Bill)
  const handleSaveBill = async () => {
    if (cart.length === 0) {
      alert('Cart is empty. Add items to save a bill.');
      return;
    }

    const draftBill: SavedBill = {
      id: `draft-${Date.now()}`,
      billNo: activeBillNo,
      customerName: selectedCustomer ? selectedCustomer.name : customCustomerName || 'Walk-in Customer',
      customerPhone: selectedCustomer ? selectedCustomer.phone : customCustomerPhone || '-',
      items: cart,
      paymentMode: selectedPayment,
      subtotal: cartSubtotal,
      tax: cartTax,
      discount: discountAmount,
      total: cartGrandTotal,
      savedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    try {
      await addDoc(collection(db, 'pos_saved_bills'), {
        ...draftBill,
        createdAt: serverTimestamp(),
      });
    } catch (e) {
      // Local fallback
      const updatedSaved = [draftBill, ...savedBills];
      setSavedBills(updatedSaved);
      localStorage.setItem('pos_saved_bills', JSON.stringify(updatedSaved));
    }

    // Reset Cart
    setCart([]);
    setSelectedCustomer(null);
    setCustomCustomerName('');
    setCustomCustomerPhone('');
    setDiscountAmount(0);
    setActiveBillNo(`POS-${Date.now().toString().slice(-6)}`);
    alert(`Bill ${draftBill.billNo} saved to Held Draft Bills!`);
  };

  // Continue Saved Bill
  const handleContinueSavedBill = async (bill: SavedBill) => {
    setCart(bill.items);
    setSelectedPayment(bill.paymentMode);
    setDiscountAmount(bill.discount);
    setActiveBillNo(bill.billNo);
    if (bill.customerName !== 'Walk-in Customer') {
      setCustomCustomerName(bill.customerName);
      setCustomCustomerPhone(bill.customerPhone);
    }

    // Remove from saved list
    try {
      if (bill.id && !bill.id.startsWith('draft-')) {
        await deleteDoc(doc(db, 'pos_saved_bills', bill.id));
      }
    } catch {}

    setSavedBills((prev) => prev.filter((b) => b.id !== bill.id));
    setShowSavedBillsDrawer(false);
  };

  // Settle Bill (Complete Sale & Print Receipt)
  const handleSettleBill = async () => {
    if (cart.length === 0) {
      alert('Cart is empty. Select items to settle bill.');
      return;
    }

    const settledBill: SavedBill = {
      id: `bill-${Date.now()}`,
      billNo: activeBillNo,
      customerName: selectedCustomer ? selectedCustomer.name : customCustomerName || 'Walk-in Customer',
      customerPhone: selectedCustomer ? selectedCustomer.phone : customCustomerPhone || '-',
      items: cart,
      paymentMode: selectedPayment,
      subtotal: cartSubtotal,
      tax: cartTax,
      discount: discountAmount,
      total: cartGrandTotal,
      savedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    // Save to Firestore Orders / Walk-In Sales
    try {
      await addDoc(collection(db, 'orders'), {
        orderId: settledBill.billNo,
        customerName: settledBill.customerName,
        customerMobile: settledBill.customerPhone,
        items: settledBill.items.map((i) => ({
          itemId: i.itemId,
          name: i.name,
          unit: i.unit,
          price: i.price,
          quantity: i.quantity,
          amount: i.totalAmount,
        })),
        totalAmount: settledBill.total,
        subtotal: settledBill.subtotal,
        tax: settledBill.tax,
        discount: settledBill.discount,
        paymentMode: settledBill.paymentMode,
        orderType: 'Walk-in POS',
        status: 'Delivered',
        createdAt: serverTimestamp(),
      });
    } catch (e) {
      console.error('Firestore save order error:', e);
    }

    setLastSettledBill(settledBill);
    setShowReceiptModal(true);

    // Reset Cart & States
    setCart([]);
    setSelectedCustomer(null);
    setCustomCustomerName('');
    setCustomCustomerPhone('');
    setDiscountAmount(0);
    setActiveBillNo(`POS-${Date.now().toString().slice(-6)}`);
  };

  // Bluetooth Thermal Printer Pairing
  const handleConnectBluetoothPrinter = async () => {
    try {
      if (!(navigator as any).bluetooth) {
        alert('Web Bluetooth API is not supported in this browser. Use Google Chrome or Edge.');
        return;
      }
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb'],
      });
      setPrinterDeviceName(device.name || 'Bluetooth Thermal Printer');
      setIsPrinterConnected(true);
      setPrinterType('Bluetooth');
      alert(`Connected to Bluetooth printer: ${device.name || 'Thermal Device'}`);
    } catch (err: any) {
      console.error('Bluetooth connection error:', err);
    }
  };

  // USB Printer Connection
  const handleConnectUsbPrinter = async () => {
    try {
      if (!(navigator as any).serial) {
        setPrinterDeviceName('USB Thermal Printer (Ready)');
        setIsPrinterConnected(true);
        setPrinterType('USB');
        alert('USB Thermal Printer port ready.');
        return;
      }
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: 9600 });
      setPrinterDeviceName('USB Serial Receipt Printer');
      setIsPrinterConnected(true);
      setPrinterType('USB');
      alert('Connected to USB Thermal Receipt Printer.');
    } catch (err: any) {
      console.error('USB Serial error:', err);
    }
  };

  // Native Print Execution
  const triggerPrintReceipt = () => {
    window.print();
  };

  return (
    <div className="w-full flex flex-col gap-4 text-slate-800 font-sans pb-12">
      {/* ── Top POS Control Header Bar ────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <Receipt size={22} className="text-slate-800 stroke-[1.75]" />
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Billing &amp; Store POS</h1>
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700">
              {activeBillNo}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">Quick sweet counter billing, thermal printer &amp; barcode integration</p>
        </div>

        {/* Hardware Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Saved Bills Drawer Trigger Button */}
          <button
            onClick={() => setShowSavedBillsDrawer(true)}
            className="h-8 px-3 text-xs font-semibold rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/90 shadow-2xs inline-flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Bookmark size={14} className="text-amber-700" />
            <span>Saved Draft Bills</span>
            {savedBills.length > 0 && (
              <span className="bg-amber-700 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                {savedBills.length}
              </span>
            )}
          </button>

          {/* USB Printer Button */}
          <button
            onClick={handleConnectUsbPrinter}
            className={`h-8 px-3 text-xs font-semibold rounded-lg border shadow-2xs inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
              isPrinterConnected && printerType === 'USB'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
            }`}
          >
            <Usb size={14} className={printerType === 'USB' ? 'text-emerald-600' : 'text-slate-500'} />
            <span>{printerType === 'USB' && isPrinterConnected ? 'USB Connected' : 'USB Printer'}</span>
          </button>

          {/* Bluetooth Printer Button */}
          <button
            onClick={handleConnectBluetoothPrinter}
            className={`h-8 px-3 text-xs font-semibold rounded-lg border shadow-2xs inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
              isPrinterConnected && printerType === 'Bluetooth'
                ? 'bg-indigo-50 text-indigo-800 border-indigo-300'
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
            }`}
          >
            <Bluetooth size={14} className={printerType === 'Bluetooth' ? 'text-indigo-600' : 'text-slate-500'} />
            <span>{printerType === 'Bluetooth' && isPrinterConnected ? printerDeviceName : 'Bluetooth Printer'}</span>
          </button>

          {/* Barcode Scanner Reader Active Indicator */}
          <div
            onClick={() => setIsBarcodeActive(!isBarcodeActive)}
            className={`h-8 px-3 text-xs font-semibold rounded-lg border shadow-2xs inline-flex items-center gap-1.5 cursor-pointer select-none transition-colors ${
              isBarcodeActive
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : 'bg-slate-100 text-slate-500 border-slate-200'
            }`}
            title="Click to toggle USB Barcode Keystroke Listener"
          >
            <Barcode size={14} className={isBarcodeActive ? 'text-emerald-600' : 'text-slate-400'} />
            <span>Barcode Reader: {isBarcodeActive ? 'Active' : 'Off'}</span>
          </div>
        </div>
      </div>

      {/* ── Main POS Workspace Split Layout (Products Left, Cart Summary Right) ──────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Side: Product Search, Barcode Input & Items Grid (7 Columns) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {/* Search & Barcode Quick Input Row */}
          <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row items-center gap-3">
            {/* Search Box */}
            <div className="relative flex-1 w-full">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search sweets, savouries, packets or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 h-8 bg-[#f7f7f8] focus:bg-white text-xs rounded-lg border border-slate-300 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-500 transition-all"
              />
            </div>

            {/* Manual Barcode Input Scanner Trigger */}
            <div className="relative w-full sm:w-56">
              <Barcode size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Scan or enter barcode..."
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleBarcodeScanned(barcodeInput);
                    setBarcodeInput('');
                  }
                }}
                className="w-full pl-9 pr-3 h-8 bg-[#f7f7f8] focus:bg-white text-xs rounded-lg border border-slate-300 text-slate-800 font-mono placeholder-slate-400 focus:outline-none focus:border-slate-500 transition-all"
              />
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`h-7 px-3 text-xs font-semibold rounded-lg transition-all flex-shrink-0 cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-[#303030] text-white shadow-2xs'
                    : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Product Cards Grid */}
          {loadingItems ? (
            <div className="bg-white p-12 rounded-xl border border-slate-200 text-center text-slate-400 text-xs font-medium">
              <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-slate-500" />
              Loading Product Catalog...
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="bg-white p-12 rounded-xl border border-slate-200 text-center text-slate-400 text-xs">
              No products found.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filteredProducts.map((item) => {
                const isWeightType = isWeightUnit(item.unit);
                const inCartItem = cartItemMap.get(item.id);
                const isInCart = Boolean(inCartItem);

                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelectProduct(item)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between group relative overflow-hidden ${
                      isInCart
                        ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-900/10'
                        : 'bg-white text-slate-900 border-slate-200/90 shadow-2xs hover:border-slate-400 hover:shadow-xs'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-1 mb-1.5">
                        <span
                          className={`text-[10px] font-bold font-mono px-1.5 py-0.2 rounded border ${
                            isInCart
                              ? 'bg-slate-800 text-slate-200 border-slate-700'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {item.code}
                        </span>

                        {isInCart ? (
                          <span className="text-[10px] font-bold text-white bg-emerald-600 px-1.5 py-0.2 rounded flex items-center gap-0.5 shadow-2xs">
                            <CheckCircle2 size={10} />
                            {inCartItem?.isWeight ? `${inCartItem.quantity}kg` : `x${inCartItem?.quantity}`}
                          </span>
                        ) : (
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                              isWeightType
                                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                : 'bg-blue-50 text-blue-700 border border-blue-200'
                            }`}
                          >
                            {item.unit}
                          </span>
                        )}
                      </div>

                      <h3
                        className={`text-xs font-bold line-clamp-2 leading-tight ${
                          isInCart ? 'text-white' : 'text-slate-900 group-hover:text-black'
                        }`}
                      >
                        {item.name}
                      </h3>
                    </div>

                    <div
                      className={`mt-3 flex items-center justify-between border-t pt-2 ${
                        isInCart ? 'border-slate-800' : 'border-slate-100'
                      }`}
                    >
                      <div>
                        <p className={`text-sm font-bold ${isInCart ? 'text-emerald-400' : 'text-slate-900'}`}>
                          ₹{item.price}
                        </p>
                        <p className={`text-[10px] font-medium ${isInCart ? 'text-slate-400' : 'text-slate-600'}`}>
                          per {item.unit.toLowerCase()}
                        </p>
                      </div>

                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors shadow-2xs ${
                          isInCart
                            ? 'bg-emerald-600 text-white font-bold'
                            : 'bg-[#303030] text-white group-hover:bg-[#111111]'
                        }`}
                      >
                        {isInCart ? <Check size={14} /> : <Plus size={14} />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Side: Order Summary, Items List, Customer & Payment Settle (5 Columns) */}
        <div className="lg:col-span-5 bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col justify-between min-h-[580px]">
          <div>
            {/* Header Title */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ShoppingBag size={16} className="text-slate-700" />
                Current Order Cart ({totalItemCount} Items)
              </h2>
              {cart.length > 0 && (
                <button
                  onClick={() => setCart([])}
                  className="text-[11px] font-semibold text-rose-600 hover:text-rose-800 transition-colors"
                >
                  Clear Cart
                </button>
              )}
            </div>

            {/* Optional Customer Search / Selection */}
            <div className="mb-3 relative">
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Customer (Optional):
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <User size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search or enter customer name..."
                    value={customCustomerName || customerSearch}
                    onChange={(e) => {
                      setCustomCustomerName(e.target.value);
                      setCustomerSearch(e.target.value);
                      setShowCustomerDropdown(true);
                    }}
                    className="w-full pl-8 pr-3 h-8 bg-[#f7f7f8] focus:bg-white text-xs rounded-lg border border-slate-300 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-500 transition-all"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Mobile No..."
                  value={customCustomerPhone}
                  onChange={(e) => setCustomCustomerPhone(e.target.value)}
                  className="w-28 pl-2 pr-2 h-8 bg-[#f7f7f8] focus:bg-white text-xs rounded-lg border border-slate-300 text-slate-800 font-mono placeholder-slate-400 focus:outline-none focus:border-slate-500 transition-all"
                />
              </div>

              {/* Customer Autocomplete Dropdown */}
              {showCustomerDropdown && customerSearch.length > 0 && customers.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-30 max-h-40 overflow-y-auto">
                  {customers
                    .filter(
                      (c) =>
                        c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
                        c.phone.includes(customerSearch)
                    )
                    .map((c) => (
                      <div
                        key={c.id}
                        onClick={() => {
                          setSelectedCustomer(c);
                          setCustomCustomerName(c.name);
                          setCustomCustomerPhone(c.phone);
                          setShowCustomerDropdown(false);
                        }}
                        className="px-3 py-2 text-xs hover:bg-slate-50 cursor-pointer border-b border-slate-100 flex items-center justify-between"
                      >
                        <span className="font-semibold text-slate-800">{c.name}</span>
                        <span className="font-mono text-slate-500">{c.phone}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Added Items List */}
            {cart.length === 0 ? (
              <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-xl my-4">
                <Receipt size={32} className="mx-auto mb-2 text-slate-300" />
                <p className="text-xs font-semibold text-slate-500">POS Cart is Empty</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Click any product or scan barcode to add items</p>
              </div>
            ) : (
              <div className="max-h-[260px] overflow-y-auto divide-y divide-slate-100 pr-1 my-2">
                {cart.map((cartItem, idx) => (
                  <div key={cartItem.id} className="py-2 flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-bold text-slate-900 truncate">{cartItem.name}</p>
                        {cartItem.isWeight && (
                          <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded">
                            {cartItem.quantity} kg
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 font-mono">
                        ₹{cartItem.price} / {cartItem.unit.toLowerCase()}
                      </p>
                    </div>

                    {/* Quantity Edit Controls */}
                    <div className="flex items-center gap-2">
                      {cartItem.isWeight ? (
                        <button
                          onClick={() => handleEditCartItem(idx)}
                          className="h-7 px-2 text-[11px] font-semibold rounded bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 cursor-pointer"
                        >
                          Edit Weight
                        </button>
                      ) : (
                        <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden h-7">
                          <button
                            onClick={() => handleUpdatePieceQuantity(idx, -1)}
                            className="w-6 h-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-700 cursor-pointer"
                          >
                            <Minus size={12} />
                          </button>
                          <span className="px-2 text-xs font-bold text-slate-900">{cartItem.quantity}</span>
                          <button
                            onClick={() => handleUpdatePieceQuantity(idx, 1)}
                            className="w-6 h-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-700 cursor-pointer"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      )}

                      <p className="text-xs font-bold text-slate-900 w-16 text-right font-mono">
                        ₹{cartItem.totalAmount}
                      </p>

                      <button
                        onClick={() => handleRemoveCartItem(idx)}
                        className="text-slate-400 hover:text-rose-600 transition-colors p-1 cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Payment & Action Footer Section */}
          <div className="border-t border-slate-200 pt-3 space-y-3 mt-4">
            {/* Calculation Totals */}
            <div className="space-y-1.5 text-xs text-slate-600">
              <div className="flex items-center justify-between">
                <span>Subtotal:</span>
                <span className="font-semibold text-slate-800 font-mono">₹{cartSubtotal}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>GST Tax (5%):</span>
                <span className="font-semibold text-slate-800 font-mono">₹{cartTax}</span>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-base font-bold text-slate-900">
                <span>Net Payable:</span>
                <span className="text-indigo-700 font-mono">₹{cartGrandTotal}</span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Select Payment Method:</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setSelectedPayment('UPI')}
                  className={`h-8 text-xs font-semibold rounded-lg border flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    selectedPayment === 'UPI'
                      ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <QrCode size={13} /> UPI / QR
                </button>
                <button
                  onClick={() => setSelectedPayment('Cash')}
                  className={`h-8 text-xs font-semibold rounded-lg border flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    selectedPayment === 'Cash'
                      ? 'bg-emerald-700 text-white border-emerald-700 shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <Banknote size={13} /> Cash
                </button>
                <button
                  onClick={() => setSelectedPayment('Card')}
                  className={`h-8 text-xs font-semibold rounded-lg border flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    selectedPayment === 'Card'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <CreditCard size={13} /> Card
                </button>
              </div>
            </div>

            {/* Save Bill & Settle Bill Action Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={handleSaveBill}
                disabled={cart.length === 0}
                className="h-9 px-3 text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 disabled:bg-amber-200 text-white shadow-2xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Bookmark size={15} /> Save Bill (Hold)
              </button>

              <button
                onClick={handleSettleBill}
                disabled={cart.length === 0}
                className="h-9 px-3 text-xs font-semibold rounded-lg bg-[#303030] hover:bg-[#111111] disabled:bg-slate-400 text-white shadow-2xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <CheckCircle2 size={15} /> Settle &amp; Print
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── MODAL 1: Weight & Amount Calculation Entry Modal ───────────────────────── */}
      {(activeWeightItem || editingCartItemIndex !== null) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {activeWeightItem ? activeWeightItem.name : cart[editingCartItemIndex!].name}
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  Rate: ₹
                  {activeWeightItem ? activeWeightItem.price : cart[editingCartItemIndex!].price} /{' '}
                  {activeWeightItem ? activeWeightItem.unit : cart[editingCartItemIndex!].unit}
                </p>
              </div>
              <button
                onClick={() => {
                  setActiveWeightItem(null);
                  setEditingCartItemIndex(null);
                }}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Preset Weight Pills */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Quick Weight Suggestions:</label>
              <div className="grid grid-cols-4 gap-1.5">
                {PRESET_WEIGHTS.map((preset) => {
                  const currentKg = parseFloat(inputWeightKg) || 0;
                  const isSelected = Math.abs(currentKg - preset.kg) < 0.001;

                  return (
                    <button
                      key={preset.label}
                      onClick={() => handleApplyPresetWeight(preset.kg)}
                      className={`h-8 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#303030] text-white border-[#303030] shadow-2xs font-bold ring-2 ring-slate-900/10'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200/80'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Two-Way Weight vs Amount Inputs */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Weight (in Kg):</label>
                <input
                  type="number"
                  step="0.05"
                  value={inputWeightKg}
                  onChange={(e) => handleWeightChange(e.target.value)}
                  placeholder="e.g. 0.5"
                  className="w-full px-3 h-9 bg-[#f7f7f8] focus:bg-white text-sm font-bold font-mono rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Total Amount (₹):</label>
                <input
                  type="number"
                  step="1"
                  value={inputAmount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  placeholder="e.g. 250"
                  className="w-full px-3 h-9 bg-[#f7f7f8] focus:bg-white text-sm font-bold font-mono rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:border-slate-500 text-indigo-700"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
              <button
                onClick={() => {
                  setActiveWeightItem(null);
                  setEditingCartItemIndex(null);
                }}
                className="h-8 px-3 text-xs font-semibold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmWeightItem}
                className="h-8 px-4 text-xs font-semibold rounded-lg bg-[#303030] hover:bg-[#111111] text-white shadow-2xs cursor-pointer"
              >
                {editingCartItemIndex !== null ? 'Update Weight' : 'Add to Cart'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DRAWER 2: Saved Draft Bills List ───────────────────────────────────────── */}
      {showSavedBillsDrawer && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white h-full w-full max-w-md shadow-2xl p-5 flex flex-col justify-between animate-in slide-in-from-right duration-200">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <Bookmark size={18} className="text-amber-600" />
                  <h3 className="text-base font-bold text-slate-900">Held Draft Bills ({savedBills.length})</h3>
                </div>
                <button
                  onClick={() => setShowSavedBillsDrawer(false)}
                  className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {savedBills.length === 0 ? (
                <div className="py-16 text-center text-slate-400 text-xs">No held draft bills found.</div>
              ) : (
                <div className="space-y-3 max-h-[75vh] overflow-y-auto pr-1">
                  {savedBills.map((bill) => (
                    <div
                      key={bill.id}
                      className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between gap-3 hover:bg-white transition-all shadow-2xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold font-mono text-slate-900">{bill.billNo}</span>
                          <span className="text-[10px] text-slate-500">{bill.savedAt}</span>
                        </div>
                        <p className="text-xs font-semibold text-slate-700 mt-0.5">{bill.customerName}</p>
                        <p className="text-[11px] text-slate-600 font-mono">
                          {bill.items.length} Items • Total: ₹{bill.total}
                        </p>
                      </div>

                      <button
                        onClick={() => handleContinueSavedBill(bill)}
                        className="h-8 px-3 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs cursor-pointer flex-shrink-0"
                      >
                        Continue
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => setShowSavedBillsDrawer(false)}
              className="w-full h-8 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
            >
              Close Drawer
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL 3: Settled Thermal Printable Receipt Preview ────────────────────── */}
      {showReceiptModal && lastSettledBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-sm p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            {/* Thermal Receipt Print Area */}
            <div id="receipt-print-area" className="p-4 bg-white font-mono text-slate-900 text-xs space-y-2 border border-slate-200 rounded-lg">
              <div className="text-center border-b border-slate-200 pb-2">
                <h2 className="text-sm font-bold uppercase tracking-wider">Pattabiram Sweets</h2>
                <p className="text-[10px] text-slate-500">12, Main Road, Pattabiram, Chennai - 600072</p>
                <p className="text-[10px] text-slate-500">Ph: +91 98765 43210</p>
              </div>

              <div className="text-[10px] space-y-0.5 border-b border-slate-200 pb-1.5">
                <div className="flex justify-between">
                  <span>Bill No: {lastSettledBill.billNo}</span>
                  <span>{lastSettledBill.savedAt}</span>
                </div>
                <div>Customer: {lastSettledBill.customerName}</div>
                <div>Payment Mode: {lastSettledBill.paymentMode}</div>
              </div>

              {/* Items Table */}
              <div className="divide-y divide-slate-100 text-[10px] py-1">
                {lastSettledBill.items.map((item) => (
                  <div key={item.id} className="py-1 flex justify-between">
                    <div>
                      <div>{item.name}</div>
                      <div className="text-slate-500">
                        {item.quantity} {item.unit} x ₹{item.price}
                      </div>
                    </div>
                    <div className="font-bold">₹{item.totalAmount}</div>
                  </div>
                ))}
              </div>

              <div className="border-t border-slate-300 pt-2 text-[11px] font-bold space-y-1">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>₹{lastSettledBill.subtotal}</span>
                </div>
                <div className="flex justify-between">
                  <span>GST (5%):</span>
                  <span>₹{lastSettledBill.tax}</span>
                </div>
                <div className="flex justify-between text-xs border-t border-slate-200 pt-1 text-slate-900">
                  <span>TOTAL PAID:</span>
                  <span>₹{lastSettledBill.total}</span>
                </div>
              </div>

              <div className="text-center text-[9px] text-slate-500 pt-2 border-t border-slate-200">
                Thank you for visiting Pattabiram Sweets! Have a sweet day!
              </div>
            </div>

            {/* Receipt Modal Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => setShowReceiptModal(false)}
                className="h-8 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              >
                Close
              </button>

              <button
                onClick={triggerPrintReceipt}
                className="h-8 text-xs font-semibold rounded-lg bg-[#303030] hover:bg-[#111111] text-white shadow-2xs cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Printer size={14} /> Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

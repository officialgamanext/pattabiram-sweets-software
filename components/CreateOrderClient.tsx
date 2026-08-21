'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Plus,
  Search,
  Trash2,
  Clock,
  Check,
  X,
  Calendar,
  UserCheck,
  PackageCheck,
  AlertCircle,
  Loader2,
  Upload,
  IndianRupee,
  CreditCard,
  Tag,
  Boxes,
  FileText,
  Sparkles,
  Star,
  CheckCircle2,
  ChevronDown,
  ShoppingBag,
  Truck,
  MapPin,
  Minus,
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, addDoc, doc, getDoc, updateDoc, serverTimestamp, onSnapshot, query } from 'firebase/firestore';
import { toast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import { usePrinter } from '@/context/PrinterContext';
import CustomDatePicker from '@/components/CustomDatePicker';
import { compressImageTo60KB, uploadToImageKit } from '@/lib/imageCompressor';

export type SlotTime =
  | '9:00 AM - 12:00 PM'
  | '12:00 PM - 3:00 PM'
  | '3:00 PM - 6:00 PM'
  | '6:00 PM - 9:00 PM';

const ALL_SLOTS: SlotTime[] = [
  '9:00 AM - 12:00 PM',
  '12:00 PM - 3:00 PM',
  '3:00 PM - 6:00 PM',
  '6:00 PM - 9:00 PM',
];

export interface OrderItemLine {
  lineId?: string;
  itemId: string;
  itemCode?: string;
  itemName: string;
  category?: string;
  unit: string;
  imageUrl?: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  hasPacket?: boolean;
  packetCharge?: number;
  manufacturingDescription?: string;
  packingDescription?: string;
}

export interface ItemMasterOption {
  id: string;
  code: string;
  name: string;
  category: string;
  price: number;
  unit: string;
  imageUrl?: string;
  isFavorite?: boolean;
  slotAllowedWeights?: {
    '9:00 AM - 12:00 PM'?: number;
    '12:00 PM - 3:00 PM'?: number;
    '3:00 PM - 6:00 PM'?: number;
    '6:00 PM - 9:00 PM'?: number;
  };
}

export interface CustomerOption {
  id: string;
  code: string;
  name: string;
  mobile: string;
  type: 'Customer' | 'Wholesaler';
  address?: string;
  priceListName?: string;
}

export interface UtilityOption {
  id: string;
  type: 'box' | 'shrink' | 'sticker';
  name: string;
  price: number;
  status: 'Active' | 'Inactive';
}

// ── MEMOIZED HIGH-PERFORMANCE PRODUCT TILE COMPONENT ────────────────────────
interface ProductCatalogTileProps {
  prod: ItemMasterOption;
  addedItem?: OrderItemLine;
  currentSlotLimit?: number | string;
  isCustomisation: boolean;
  numericNoOfBoxes: number;
  packetCostPerBox: number;
  onToggle: (prod: ItemMasterOption) => void;
  onQuantityChange: (prodId: string, delta: number) => void;
  onFieldChange: (
    prodId: string,
    field: 'quantity' | 'unitPrice' | 'mfgDesc' | 'pckDesc' | 'hasPacket',
    val: any
  ) => void;
}

const ProductCatalogTile = React.memo(function ProductCatalogTile({
  prod,
  addedItem,
  currentSlotLimit,
  isCustomisation,
  numericNoOfBoxes,
  packetCostPerBox,
  onToggle,
  onQuantityChange,
  onFieldChange,
}: ProductCatalogTileProps) {
  const isAdded = Boolean(addedItem);

  return (
    <div
      className={`group relative rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between transition-all duration-150 select-none ${
        isAdded
          ? 'bg-[#02626D]/[0.03] border-2 border-[#02626D] shadow-md ring-2 ring-[#02626D]/15'
          : 'bg-white border border-slate-200/90 hover:border-slate-300 hover:shadow-md'
      }`}
    >
      {/* Top Bar: Image + Title + Badges */}
      <div>
        <div className="flex items-start justify-between gap-2.5">
          <div className="relative w-14 h-14 rounded-xl bg-slate-50 border border-slate-100 overflow-hidden flex-shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
            <Image
              src={prod.imageUrl || '/app-icon.png'}
              alt={prod.name}
              fill
              className="object-contain p-1"
            />
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {prod.isFavorite && (
              <span className="p-1 rounded-md bg-amber-50 text-amber-500 shadow-2xs" title="Favourite Product">
                <Star size={14} className="fill-amber-400 text-amber-400" />
              </span>
            )}
            {isAdded ? (
              <button
                type="button"
                onClick={() => onToggle(prod)}
                className="w-7.5 h-7.5 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-700 flex items-center justify-center transition-all cursor-pointer active:scale-90"
                title="Remove product"
              >
                <Trash2 size={14} />
              </button>
            ) : null}
          </div>
        </div>

        {/* Title & Code/Category */}
        <div className="mt-2.5 min-w-0">
          <h4
            className={`text-xs sm:text-sm font-bold leading-snug truncate ${
              isAdded ? 'text-[#02626D]' : 'text-slate-900 group-hover:text-[#02626D]'
            }`}
            title={prod.name}
          >
            {prod.name}
          </h4>
          <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5 font-medium">
            <span className="font-mono">{prod.code}</span>
            <span>•</span>
            <span className="truncate">{prod.category}</span>
          </div>
        </div>

        {/* Slot Limit Chip */}
        {currentSlotLimit ? (
          <div className="mt-2 space-y-1">
            <div className="inline-flex items-center gap-1 text-[10px] text-teal-800 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200/80 font-semibold">
              <Clock size={10} /> Slot Max: {currentSlotLimit} {prod.unit}
            </div>
            {isAdded && addedItem && addedItem.quantity > (parseFloat(String(currentSlotLimit)) || 0) && (
              <div className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded flex items-center gap-1 animate-pulse">
                <span>⚠️ Exceeds max limit ({currentSlotLimit} {prod.unit})</span>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Bottom Action Area */}
      {!addedItem ? (
        /* UNSELECTED STATE: Clean Price & + Add Button */
        <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between gap-1">
          <div>
            <span className="text-xs sm:text-sm font-extrabold text-[#02626D]">₹{prod.price}</span>
            <span className="text-[10.5px] text-slate-400 font-normal"> /{prod.unit}</span>
          </div>

          <button
            type="button"
            onClick={() => onToggle(prod)}
            className="h-8 px-3.5 rounded-xl bg-slate-100 hover:bg-[#02626D] hover:text-white text-slate-700 font-bold text-xs transition-all shadow-2xs cursor-pointer flex items-center gap-1 active:scale-95"
          >
            <Plus size={14} />
            <span>Add</span>
          </button>
        </div>
      ) : (
        /* SELECTED / ACTIVE STATE: Full options inside this tile */
        <div className="mt-3 pt-2.5 border-t border-slate-200/80 space-y-2.5">
          {/* Stepper + Price & Line Total */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 bg-white p-0.5 rounded-xl border border-slate-300 shadow-2xs">
              <button
                type="button"
                onClick={() => onQuantityChange(prod.id, -1)}
                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-extrabold text-sm transition-colors cursor-pointer active:scale-90"
                title="Decrease"
              >
                -
              </button>
              <input
                type="number"
                step="0.1"
                min="0"
                value={addedItem.quantity === 0 ? '' : addedItem.quantity}
                onChange={(e) => onFieldChange(prod.id, 'quantity', e.target.value)}
                className="w-12 h-7 text-center font-extrabold text-xs text-[#02626D] bg-transparent focus:outline-none"
              />
              <span className="text-[10.5px] font-bold text-slate-400 pr-1.5">{prod.unit}</span>
              <button
                type="button"
                onClick={() => onQuantityChange(prod.id, 1)}
                className="w-7 h-7 rounded-lg bg-[#02626D] hover:bg-[#014d56] text-white flex items-center justify-center font-extrabold text-sm transition-colors cursor-pointer shadow-2xs active:scale-90"
                title="Increase"
              >
                +
              </button>
            </div>

            <div className="text-right">
              <span className="text-[9.5px] text-slate-400 block font-medium uppercase tracking-tight">Total</span>
              <span className="text-xs sm:text-sm font-bold text-slate-900">
                ₹ {addedItem.lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Customisation Packet Toggle */}
          {isCustomisation && (
            <div className="flex items-center justify-between bg-white p-2 rounded-xl border border-slate-200 text-[11px]">
              <span className="font-semibold text-slate-700">
                Packet (+₹{numericNoOfBoxes * packetCostPerBox})
              </span>
              <button
                type="button"
                onClick={() => onFieldChange(prod.id, 'hasPacket', !addedItem.hasPacket)}
                className={`px-2.5 py-1 rounded-md text-[10.5px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  addedItem.hasPacket
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {addedItem.hasPacket ? <Check size={11} /> : <X size={11} />}
                <span>{addedItem.hasPacket ? 'Yes' : 'No'}</span>
              </button>
            </div>
          )}

          {/* Manufacturing & Packing Notes */}
          <div className="grid grid-cols-2 gap-2 pt-0.5">
            <input
              type="text"
              placeholder="Mfg notes..."
              value={addedItem.manufacturingDescription || ''}
              onChange={(e) => onFieldChange(prod.id, 'mfgDesc', e.target.value)}
              className="w-full h-7 px-2 text-[10.5px] bg-white border border-slate-200 rounded-lg focus:border-[#02626D] focus:outline-none text-slate-700"
              title="Manufacturing instructions"
            />
            <input
              type="text"
              placeholder="Packing notes..."
              value={addedItem.packingDescription || ''}
              onChange={(e) => onFieldChange(prod.id, 'pckDesc', e.target.value)}
              className="w-full h-7 px-2 text-[10.5px] bg-white border border-slate-200 rounded-lg focus:border-[#02626D] focus:outline-none text-slate-700"
              title="Packing instructions"
            />
          </div>
        </div>
      )}
    </div>
  );
});

export default function CreateOrderClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, employeeProfile } = useAuth();
  const { isConnected: isPrinterConnected, printerType, printReceipt } = usePrinter();

  const editId = searchParams.get('editId') || searchParams.get('id') || '';
  const isEditMode = Boolean(editId);

  const initialSlot = (searchParams.get('slot') as SlotTime) || '9:00 AM - 12:00 PM';
  const initialDate = searchParams.get('date') || '';

  const getTodayDateStr = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Order Core State
  const [orderSlot, setOrderSlot] = useState<SlotTime>(initialSlot);
  const [mfgDate, setMfgDate] = useState<string>(initialDate || getTodayDateStr());
  const [expDeliveryDate, setExpDeliveryDate] = useState<string>(initialDate || getTodayDateStr());

  // Edit Mode Specific State
  const [isLoadingOrder, setIsLoadingOrder] = useState<boolean>(Boolean(editId));
  const [existingOrderCode, setExistingOrderCode] = useState<string>('');
  const [existingOrderTime, setExistingOrderTime] = useState<string>('');
  const [existingCreatedAt, setExistingCreatedAt] = useState<any>(null);
  const [existingPayments, setExistingPayments] = useState<any[]>([]);

  // Customer State
  const [customersMaster, setCustomersMaster] = useState<CustomerOption[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);

  // New Customer Quick Modal State
  const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({
    name: '',
    mobileNumber: '',
    email: '',
    address: '',
    status: 'Active',
  });

  // Customisation & Utilities
  const [isCustomisation, setIsCustomisation] = useState(false);
  const [noOfBoxes, setNoOfBoxes] = useState<string | number>('');
  const numericNoOfBoxes = noOfBoxes === '' ? 0 : Math.max(0, parseInt(String(noOfBoxes), 10) || 0);

  const [boxType, setBoxType] = useState('HandleBox');
  const [boxImageUrl, setBoxImageUrl] = useState('');
  const [boxImageFile, setBoxImageFile] = useState<File | null>(null);
  const [shrinkType, setShrinkType] = useState('None');
  const [stickerType, setStickerType] = useState('None');

  // Transport State
  const [isTransportRequired, setIsTransportRequired] = useState(false);
  const [transportCharges, setTransportCharges] = useState<string | number>('');
  const [deliveryAddress, setDeliveryAddress] = useState<string>('');

  // Global Settings from Firestore utilities/global_settings
  const [globalSettings, setGlobalSettings] = useState<{ globalPackingBoxPrice: number; individualItemPackingCost: number }>({
    globalPackingBoxPrice: 0,
    individualItemPackingCost: 0,
  });

  // Items State
  const [itemsMaster, setItemsMaster] = useState<ItemMasterOption[]>([]);
  const [utilitiesMaster, setUtilitiesMaster] = useState<UtilityOption[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItemLine[]>([]);

  // Product Catalog Grid Search & Category Filters
  const [productGridSearch, setProductGridSearch] = useState('');
  const [productGridCategory, setProductGridCategory] = useState('All');
  const [productGridOnlyFavorites, setProductGridOnlyFavorites] = useState(false);

  // Payment & Order Meta
  const [discountAmount, setDiscountAmount] = useState<string | number>('');
  const [additionalCharges, setAdditionalCharges] = useState<string | number>('');
  const [receivedAmount, setReceivedAmount] = useState<string | number>('');
  const [paymentMode, setPaymentMode] = useState<string>('UPI');
  const [paymentStatus, setPaymentStatus] = useState<string>('Pending');
  const [orderStatus, setOrderStatus] = useState<string>('Order Created');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const customerSearchRef = useRef<HTMLDivElement>(null);

  // Load existing order when in edit mode
  useEffect(() => {
    if (!editId) return;
    let isMounted = true;
    setIsLoadingOrder(true);
    const loadOrderForEditing = async () => {
      try {
        const snap = await getDoc(doc(db, 'orders', editId));
        if (!snap.exists()) {
          toast.error('Order Not Found', 'The order you are trying to edit does not exist.');
          if (isMounted) setIsLoadingOrder(false);
          return;
        }
        const data = snap.data();
        if (!isMounted) return;

        setExistingOrderCode(data.code || '');
        setExistingOrderTime(data.orderTime || '');
        setExistingCreatedAt(data.createdAt || null);
        setExistingPayments(data.payments || []);

        if (data.slot) setOrderSlot(data.slot as SlotTime);
        if (data.manufacturingDate) setMfgDate(data.manufacturingDate);
        else if (data.orderDate) setMfgDate(data.orderDate);

        if (data.expectedDeliveryDate) setExpDeliveryDate(data.expectedDeliveryDate);
        else if (data.orderDate) setExpDeliveryDate(data.orderDate);

        if (data.customerName) {
          setSelectedCustomer({
            id: data.customerId || '',
            code: data.customerCode || 'CUST-000',
            name: data.customerName,
            mobile: data.customerMobile || '',
            type: (data.customerType as 'Customer' | 'Wholesaler') || 'Customer',
            address: data.customerAddress || '',
            priceListName: data.priceListName || '',
          });
          setCustomerSearchTerm(`${data.customerName}${data.customerMobile ? ` (${data.customerMobile})` : ''}`);
        }

        setIsCustomisation(Boolean(data.isCustomisation));
        if (data.customisationDetails) {
          setNoOfBoxes(
            data.customisationDetails.noOfBoxes !== undefined
              ? data.customisationDetails.noOfBoxes
              : (data.noOfBoxes !== undefined ? data.noOfBoxes : '')
          );
          if (data.customisationDetails.boxType) setBoxType(data.customisationDetails.boxType);
          if (data.customisationDetails.boxImageUrl) setBoxImageUrl(data.customisationDetails.boxImageUrl);
          if (data.customisationDetails.shrinkType) setShrinkType(data.customisationDetails.shrinkType);
          else if (data.customisationDetails.hasShrink) setShrinkType('Standard Shrink Wrap');
          if (data.customisationDetails.stickerType) setStickerType(data.customisationDetails.stickerType);
          else if (data.customisationDetails.hasSticker) setStickerType('Custom Brand Sticker');
        } else {
          setNoOfBoxes(data.noOfBoxes !== undefined ? data.noOfBoxes : '');
          if (data.boxType) setBoxType(data.boxType);
          if (data.boxImageUrl) setBoxImageUrl(data.boxImageUrl);
          setShrinkType('None');
          setStickerType('None');
        }

        if (data.isTransportRequired !== undefined) {
          setIsTransportRequired(Boolean(data.isTransportRequired));
        }
        if (data.transportCharges !== undefined) {
          setTransportCharges(data.transportCharges ? String(data.transportCharges) : '');
        }
        if (data.deliveryAddress) {
          setDeliveryAddress(data.deliveryAddress);
        } else if (data.customerAddress) {
          setDeliveryAddress(data.customerAddress);
        }

        if (Array.isArray(data.items)) {
          setOrderItems(
            data.items.map((it: any, index: number) => {
              const qty = typeof it.quantity === 'number' ? it.quantity : (parseFloat(it.quantity || it.qty) || 1);
              const price = typeof it.unitPrice === 'number' ? it.unitPrice : (parseFloat(it.price || it.unitPrice || it.rate) || 0);
              const total = typeof it.lineTotal === 'number' ? it.lineTotal : (parseFloat(it.totalPrice || it.lineTotal || it.amount || it.total) || (qty * price));
              return {
                lineId: it.lineId || `line-${index}-${Date.now()}`,
                itemId: it.itemId || it.id || '',
                itemCode: it.itemCode || it.code || '',
                itemName: it.itemName || it.name || '',
                category: it.category || 'General',
                unit: it.unit || 'KG',
                imageUrl: it.imageUrl || '',
                quantity: qty,
                unitPrice: price,
                lineTotal: total,
                hasPacket: Boolean(it.hasPacket),
                packetCharge: it.hasPacket ? 5 : (it.packetCharge || 0),
                manufacturingDescription: it.manufacturingDescription || it.mfgDesc || it.notes || '',
                packingDescription: it.packingDescription || it.pckDesc || it.packingInstructions || '',
              };
            })
          );
        }

        setDiscountAmount(data.discountAmount !== undefined ? String(data.discountAmount) : '');
        setAdditionalCharges(data.additionalCharges !== undefined ? String(data.additionalCharges) : '');
        setReceivedAmount(data.receivedAmount !== undefined ? String(data.receivedAmount) : '');
        if (data.paymentMode) setPaymentMode(data.paymentMode);
        if (data.paymentStatus) setPaymentStatus(data.paymentStatus);
        if (data.orderStatus) setOrderStatus(data.orderStatus);
      } catch (err: any) {
        console.error('Failed to fetch order for editing:', err);
        toast.error('Load Failed', err?.message || 'Could not fetch order data.');
      } finally {
        if (isMounted) setIsLoadingOrder(false);
      }
    };
    loadOrderForEditing();
    return () => {
      isMounted = false;
    };
  }, [editId]);

  // Click outside customer dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (customerSearchRef.current && !customerSearchRef.current.contains(e.target as Node)) {
        setIsCustomerDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 1. Subscribe to Customers & Wholesalers
  useEffect(() => {
    const unsubCust = onSnapshot(query(collection(db, 'customers')), (snap) => {
      const custs: CustomerOption[] = snap.docs.map((d) => ({
        id: d.id,
        code: d.data().code || 'CUST-000',
        name: d.data().name || 'Unnamed Customer',
        mobile: d.data().mobileNumber || '',
        type: 'Customer',
        address: d.data().address || '',
      }));

      onSnapshot(query(collection(db, 'wholesalers')), (wSnap) => {
        const wholes: CustomerOption[] = wSnap.docs.map((d) => ({
          id: d.id,
          code: d.data().code || 'WHL-000',
          name: d.data().name || d.data().businessName || 'Wholesaler',
          mobile: d.data().personalMobile || d.data().businessMobile || '',
          type: 'Wholesaler',
          address: d.data().address || '',
          priceListName: d.data().priceListName || '',
        }));

        setCustomersMaster([...custs, ...wholes]);
      });
    });

    return () => unsubCust();
  }, []);

  // 2. Subscribe to Items
  useEffect(() => {
    const unsubItems = onSnapshot(query(collection(db, 'items')), (snap) => {
      const items: ItemMasterOption[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          code: data.code || 'ITM-000',
          name: data.name || 'Unnamed Item',
          category: data.category || 'General',
          price: data.price || 0,
          unit: data.unit || 'KG',
          imageUrl: data.imageUrl || '',
          isFavorite: Boolean(data.isFavorite),
          slotAllowedWeights: data.slotAllowedWeights || undefined,
        };
      });

      items.sort((a, b) => {
        if (a.isFavorite && !b.isFavorite) return -1;
        if (!a.isFavorite && b.isFavorite) return 1;
        return a.name.localeCompare(b.name);
      });

      setItemsMaster(items);
    });

    return () => unsubItems();
  }, []);

  // 3. Subscribe to Utilities
  useEffect(() => {
    const unsubUtil = onSnapshot(query(collection(db, 'utilities')), (snap) => {
      const utils: UtilityOption[] = snap.docs.map((d) => ({
        id: d.id,
        type: d.data().type,
        name: d.data().name || '',
        price: d.data().price || 0,
        status: d.data().status || 'Active',
      }));
      setUtilitiesMaster(utils);
    });

    return () => unsubUtil();
  }, []);

  // 4. Subscribe to Firestore `utilities/global_settings`
  useEffect(() => {
    const unsubGlobal = onSnapshot(doc(db, 'utilities', 'global_settings'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setGlobalSettings({
          globalPackingBoxPrice: typeof data.globalPackingBoxPrice === 'number' ? data.globalPackingBoxPrice : (parseFloat(data.globalPackingBoxPrice) || 0),
          individualItemPackingCost: typeof data.individualItemPackingCost === 'number' ? data.individualItemPackingCost : (parseFloat(data.individualItemPackingCost) || 0),
        });
      }
    });
    return () => unsubGlobal();
  }, []);

  // Active Utilities
  const activeBoxes = useMemo(() => utilitiesMaster.filter((u) => u.type === 'box' && u.status === 'Active'), [utilitiesMaster]);
  const activeShrinks = useMemo(() => utilitiesMaster.filter((u) => u.type === 'shrink' && u.status === 'Active'), [utilitiesMaster]);
  const activeStickers = useMemo(() => utilitiesMaster.filter((u) => u.type === 'sticker' && u.status === 'Active'), [utilitiesMaster]);

  const selectedBoxObj = activeBoxes.find((b) => b.name === boxType);
  const selectedBoxPrice = selectedBoxObj?.price || 0;
  const selectedShrinkObj = activeShrinks.find((s) => s.name === shrinkType);
  const selectedShrinkPrice = shrinkType === 'None' ? 0 : selectedShrinkObj?.price || 0;
  const selectedStickerObj = activeStickers.find((st) => st.name === stickerType);
  const selectedStickerPrice = stickerType === 'None' ? 0 : selectedStickerObj?.price || 0;

  // Filter Customers
  const filteredCustomers = useMemo(() => {
    if (!customerSearchTerm.trim()) return customersMaster.slice(0, 15);
    const q = customerSearchTerm.toLowerCase().trim();
    return customersMaster.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.mobile.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q)
    );
  }, [customersMaster, customerSearchTerm]);

  // Product categories
  const productCategories = useMemo(() => {
    const cats = Array.from(new Set(itemsMaster.map((i) => i.category).filter(Boolean)));
    return ['All', ...cats];
  }, [itemsMaster]);

  // Filtered Product Tiles
  const filteredProductTiles = useMemo(() => {
    let list = [...itemsMaster];

    if (productGridSearch.trim()) {
      const q = productGridSearch.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
      );
    }

    if (productGridCategory !== 'All') {
      list = list.filter((p) => p.category === productGridCategory);
    }

    if (productGridOnlyFavorites) {
      list = list.filter((p) => p.isFavorite);
    }

    list.sort((a, b) => {
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      return a.name.localeCompare(b.name);
    });

    return list;
  }, [itemsMaster, productGridSearch, productGridCategory, productGridOnlyFavorites]);

  // Product Catalog Pagination (24 items per batch)
  const [visibleProductCount, setVisibleProductCount] = useState(24);

  // Reset pagination count when search or filters change
  useEffect(() => {
    setVisibleProductCount(24);
  }, [productGridSearch, productGridCategory, productGridOnlyFavorites]);

  const paginatedProductTiles = useMemo(() => {
    return filteredProductTiles.slice(0, visibleProductCount);
  }, [filteredProductTiles, visibleProductCount]);

  // Tile Handlers with useCallback for Instant 0ms response
  const handleToggleTileProduct = useCallback((prod: ItemMasterOption) => {
    setOrderItems((prev) => {
      const existingIndex = prev.findIndex((it) => it.itemId === prod.id);
      if (existingIndex >= 0) {
        return prev.filter((it) => it.itemId !== prod.id);
      } else {
        const uniqueLineId = `line-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const newLine: OrderItemLine = {
          lineId: uniqueLineId,
          itemId: prod.id,
          itemCode: prod.code,
          itemName: prod.name,
          category: prod.category,
          unit: prod.unit || 'KG',
          imageUrl: prod.imageUrl || '',
          unitPrice: prod.price,
          quantity: 1,
          lineTotal: prod.price * 1,
          hasPacket: false,
          packetCharge: 0,
          manufacturingDescription: '',
          packingDescription: '',
        };
        return [...prev, newLine];
      }
    });
  }, []);

  const handleTileQuantityChange = useCallback((prodId: string, delta: number) => {
    const prod = itemsMaster.find((p) => p.id === prodId);
    const existing = orderItems.find((it) => it.itemId === prodId);
    const currentQty = existing?.quantity || 0;
    const nextQty = existing ? Math.max(0, Math.round((currentQty + delta) * 10) / 10) : 1;

    const rawLimit = prod?.slotAllowedWeights?.[orderSlot as keyof typeof prod.slotAllowedWeights];
    const slotLimit = rawLimit !== undefined ? parseFloat(String(rawLimit)) : 0;
    if (slotLimit > 0 && nextQty > slotLimit) {
      toast.error(
        'Slot Limit Exceeded',
        `"${prod?.name || 'Item'}" allowed weight for ${orderSlot} is ${slotLimit} ${prod?.unit || 'KG'}. Current: ${nextQty} ${prod?.unit || 'KG'}.`
      );
    }

    setOrderItems((prev) => {
      const existingItem = prev.find((it) => it.itemId === prodId);
      if (!existingItem) {
        if (delta <= 0 || !prod) return prev;
        const uniqueLineId = `line-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        return [
          ...prev,
          {
            lineId: uniqueLineId,
            itemId: prod.id,
            itemCode: prod.code,
            itemName: prod.name,
            category: prod.category,
            unit: prod.unit || 'KG',
            imageUrl: prod.imageUrl || '',
            unitPrice: prod.price,
            quantity: 1,
            lineTotal: prod.price * 1,
            hasPacket: false,
            packetCharge: 0,
            manufacturingDescription: '',
            packingDescription: '',
          },
        ];
      }

      const updatedQty = Math.max(0, Math.round(((existingItem.quantity || 0) + delta) * 10) / 10);
      if (updatedQty === 0) {
        return prev.filter((it) => it.itemId !== prodId);
      }

      return prev.map((it) => {
        if (it.itemId === prodId) {
          return {
            ...it,
            quantity: updatedQty,
            lineTotal: Math.round(updatedQty * it.unitPrice * 100) / 100,
          };
        }
        return it;
      });
    });
  }, [itemsMaster, orderItems, orderSlot]);

  const handleTileFieldChange = useCallback((
    prodId: string,
    field: 'quantity' | 'unitPrice' | 'mfgDesc' | 'pckDesc' | 'hasPacket',
    val: any
  ) => {
    if (field === 'quantity') {
      const qty = val === '' ? 0 : Math.max(0, parseFloat(val) || 0);
      const prod = itemsMaster.find((p) => p.id === prodId);
      const rawLimit = prod?.slotAllowedWeights?.[orderSlot as keyof typeof prod.slotAllowedWeights];
      const slotLimit = rawLimit !== undefined ? parseFloat(String(rawLimit)) : 0;
      if (slotLimit > 0 && qty > slotLimit) {
        toast.error(
          'Slot Limit Exceeded',
          `"${prod?.name || 'Item'}" allowed weight for ${orderSlot} is ${slotLimit} ${prod?.unit || 'KG'}. You entered ${qty} ${prod?.unit || 'KG'}.`
        );
      }
    }

    setOrderItems((prev) =>
      prev.map((item) => {
        if (item.itemId !== prodId) return item;

        let qty = item.quantity;
        let price = item.unitPrice;
        let mfgDesc = item.manufacturingDescription;
        let pckDesc = item.packingDescription;
        let packet = item.hasPacket;

        if (field === 'quantity') qty = val === '' ? 0 : Math.max(0, parseFloat(val) || 0);
        if (field === 'unitPrice') price = Math.max(0, parseFloat(val) || 0);
        if (field === 'mfgDesc') mfgDesc = val;
        if (field === 'pckDesc') pckDesc = val;
        if (field === 'hasPacket') packet = Boolean(val);

        return {
          ...item,
          quantity: qty,
          unitPrice: price,
          lineTotal: Math.round(qty * price * 100) / 100,
          manufacturingDescription: mfgDesc,
          packingDescription: pckDesc,
          hasPacket: packet,
          packetCharge: packet ? 5 : 0,
        };
      })
    );
  }, [itemsMaster, orderSlot]);

  // Summary Quantity Modifier
  const handleSummaryQuantityChange = useCallback((itemId: string, newQty: number) => {
    const prod = itemsMaster.find((p) => p.id === itemId);
    const safeQty = Math.max(0, Math.round(newQty * 100) / 100);

    if (safeQty <= 0) {
      setOrderItems((prev) => prev.filter((it) => it.itemId !== itemId));
      return;
    }

    const rawLimit = prod?.slotAllowedWeights?.[orderSlot as keyof typeof prod.slotAllowedWeights];
    const slotLimit = rawLimit !== undefined ? parseFloat(String(rawLimit)) : 0;
    if (slotLimit > 0 && safeQty > slotLimit) {
      toast.error(
        'Slot Limit Exceeded',
        `"${prod?.name || 'Item'}" allowed weight for ${orderSlot} is ${slotLimit} ${prod?.unit || 'KG'}. Current: ${safeQty} ${prod?.unit || 'KG'}.`
      );
    }

    setOrderItems((prev) =>
      prev.map((item) => {
        if (item.itemId !== itemId) return item;
        return {
          ...item,
          quantity: safeQty,
          lineTotal: Math.round(safeQty * item.unitPrice * 100) / 100,
        };
      })
    );
  }, [itemsMaster, orderSlot]);

  const handleSummaryRemoveItem = useCallback((itemId: string) => {
    setOrderItems((prev) => prev.filter((it) => it.itemId !== itemId));
  }, []);

  // Box Image File Upload
  const handleBoxImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBoxImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setBoxImageUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Totals & Pricing Calculations
  const subTotal = orderItems.reduce((acc, curr) => acc + curr.lineTotal, 0);
  const packetCostPerBox = globalSettings.individualItemPackingCost || 0;
  const packetChargesTotal = isCustomisation
    ? orderItems.reduce((acc, curr) => acc + (curr.hasPacket ? Math.max(0, numericNoOfBoxes) * packetCostPerBox : 0), 0)
    : 0;

  const boxChargesTotal = isCustomisation ? Math.max(0, numericNoOfBoxes) * selectedBoxPrice : 0;
  const stickerChargesTotal = isCustomisation && stickerType !== 'None' ? Math.max(0, numericNoOfBoxes) * selectedStickerPrice : 0;
  const shrinkChargesTotal = isCustomisation && shrinkType !== 'None' ? Math.max(0, numericNoOfBoxes) * selectedShrinkPrice : 0;

  const pCharges = !isCustomisation ? Math.max(0, numericNoOfBoxes) * (globalSettings.globalPackingBoxPrice || 0) : 0;
  const addCharges = !isCustomisation ? (parseFloat(String(additionalCharges)) || 0) : 0;
  const transportChargesVal = isTransportRequired ? (parseFloat(String(transportCharges)) || 0) : 0;
  const discountVal = parseFloat(String(discountAmount)) || 0;

  const grandTotal = isCustomisation
    ? Math.max(0, subTotal + boxChargesTotal + stickerChargesTotal + shrinkChargesTotal + packetChargesTotal + transportChargesVal - discountVal)
    : Math.max(0, subTotal + pCharges + addCharges + transportChargesVal - discountVal);

  // Auto Payment Status calculation
  useEffect(() => {
    const recv = parseFloat(String(receivedAmount)) || 0;
    if (recv <= 0) {
      setPaymentStatus('Pending');
    } else if (recv >= grandTotal && grandTotal > 0) {
      setPaymentStatus('Completed');
    } else {
      setPaymentStatus('Partial');
    }
  }, [receivedAmount, grandTotal]);

  // Quick Customer Save
  const handleSaveQuickCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerForm.name || !newCustomerForm.mobileNumber) return;

    try {
      setIsSubmitting(true);
      const nextCode = `CUST-${String(customersMaster.length + 1).padStart(3, '0')}`;

      const docRef = await addDoc(collection(db, 'customers'), {
        code: nextCode,
        name: newCustomerForm.name,
        mobileNumber: newCustomerForm.mobileNumber,
        email: newCustomerForm.email,
        address: newCustomerForm.address,
        status: newCustomerForm.status,
        createdAt: serverTimestamp(),
      });

      const newlyCreatedCustomer: CustomerOption = {
        id: docRef.id,
        code: nextCode,
        name: newCustomerForm.name,
        mobile: newCustomerForm.mobileNumber,
        type: 'Customer',
        address: newCustomerForm.address,
      };

      setSelectedCustomer(newlyCreatedCustomer);
      setCustomerSearchTerm(`${newlyCreatedCustomer.name} (${newlyCreatedCustomer.mobile})`);
      if (!deliveryAddress && newlyCreatedCustomer.address) {
        setDeliveryAddress(newlyCreatedCustomer.address);
      }
      setIsAddCustomerModalOpen(false);
      setNewCustomerForm({
        name: '',
        mobileNumber: '',
        email: '',
        address: '',
        status: 'Active',
      });
      toast.success('Customer Created', `Customer "${newlyCreatedCustomer.name}" added successfully.`);
    } catch (err: any) {
      console.error('Failed to quick add customer:', err);
      toast.error('Customer Creation Failed', 'Failed to save customer. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper to remove any undefined fields before writing to Firestore
  const sanitizeForFirestore = (obj: any): any => {
    if (Array.isArray(obj)) {
      return obj.map(sanitizeForFirestore);
    } else if (obj !== null && typeof obj === 'object') {
      const sanitized: any = {};
      Object.keys(obj).forEach((key) => {
        if (obj[key] !== undefined) {
          sanitized[key] = sanitizeForFirestore(obj[key]);
        }
      });
      return sanitized;
    }
    return obj;
  };

  // Submit Order Creation
  const handleCreateOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) {
      toast.warning('Customer Required', 'Please search and select a customer or wholesaler.');
      return;
    }
    if (orderItems.length === 0) {
      toast.warning('Items Required', 'Please add at least one product item to the order.');
      return;
    }

    const validItems = orderItems.filter((i) => i.itemName.trim().length > 0);
    if (validItems.length === 0) {
      toast.warning('Invalid Items', 'Please select a valid product item.');
      return;
    }

    const missingQtyItem = validItems.find((i) => !i.quantity || i.quantity <= 0);
    if (missingQtyItem) {
      toast.warning('Quantity Required', `Please enter a valid quantity for "${missingQtyItem.itemName}".`);
      return;
    }

    // Strict slot allowed weight / capacity enforcement
    for (const item of validItems) {
      const prod = itemsMaster.find((p) => p.id === item.itemId || p.name === item.itemName);
      if (prod?.slotAllowedWeights && orderSlot) {
        const rawLimit = prod.slotAllowedWeights[orderSlot as keyof typeof prod.slotAllowedWeights];
        const limit = rawLimit !== undefined ? parseFloat(String(rawLimit)) : 0;
        if (limit > 0 && item.quantity > limit) {
          toast.error(
            'Slot Weight Limit Exceeded',
            `Cannot create order: "${item.itemName}" has exceeded the maximum allowed weight for slot "${orderSlot}". Maximum limit is ${limit} ${prod.unit}, but order requested ${item.quantity} ${prod.unit}. Please reduce the quantity.`
          );
          return;
        }
      }
    }

    const recv = parseFloat(String(receivedAmount)) || 0;
    if (recv > grandTotal) {
      toast.error('Invalid Payment Amount', `Received amount (₹${recv}) cannot exceed the order total of ₹${grandTotal.toFixed(2)}.`);
      return;
    }

    if (!mfgDate) {
      toast.warning('Date Required', 'Please select a Manufacturing Date.');
      return;
    }
    if (!expDeliveryDate) {
      toast.warning('Date Required', 'Please select an Expected Delivery Date.');
      return;
    }

    if (isTransportRequired && !deliveryAddress.trim()) {
      toast.warning('Address Required', 'Please enter a delivery / transport address for this transport order.');
      return;
    }

    const isTuesdayDate = (dateStr: string) => {
      if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
      const [y, m, d] = dateStr.split('-').map(Number);
      return new Date(y, m - 1, d).getDay() === 2;
    };

    if (isTuesdayDate(mfgDate)) {
      toast.warning('Tuesday Blocked', 'Manufacturing Date cannot fall on Tuesday (Factory Closed).');
      return;
    }
    if (isTuesdayDate(expDeliveryDate)) {
      toast.warning('Tuesday Blocked', 'Expected Delivery Date cannot fall on Tuesday (Store Closed).');
      return;
    }

    try {
      setIsSubmitting(true);
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      // Generate Order Code e.g. #ORD-YYMMDD-XXX
      const randomThree = Math.floor(100 + Math.random() * 900);
      const orderCode = `#ORD-${now.getFullYear().toString().slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${randomThree}`;

      // Upload Box Image to ImageKit if present
      let finalBoxImageUrl = boxImageUrl;
      if (isCustomisation && boxImageFile) {
        try {
          const base64 = await compressImageTo60KB(boxImageFile);
          const fileName = `box_pkg_${Date.now()}_${boxImageFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
          finalBoxImageUrl = await uploadToImageKit(base64, fileName);
        } catch (imgErr) {
          console.warn('Failed box image upload to ImageKit on submit, using preview URL fallback:', imgErr);
        }
      }

      const creatorName = employeeProfile?.name || (user?.email ? user.email.split('@')[0] : 'Staff');
      const creatorId = employeeProfile?.id || employeeProfile?.empId || user?.uid || 'staff';
      const creatorRole = employeeProfile?.isSuperAdmin || (user?.email && !employeeProfile) ? 'SuperAdmin' : 'Employee';
      const savedNoOfBoxes = numericNoOfBoxes;
      const targetOrderDate = mfgDate || getTodayDateStr();

      if (editId) {
        // Update existing order
        await updateDoc(doc(db, 'orders', editId), sanitizeForFirestore({
          customerName: selectedCustomer.name,
          customerMobile: selectedCustomer.mobile,
          customerId: selectedCustomer.id,
          customerType: selectedCustomer.type,
          customerAddress: selectedCustomer.address || '',
          slot: orderSlot,
          orderDate: mfgDate || targetOrderDate,
          manufacturingDate: mfgDate,
          expectedDeliveryDate: expDeliveryDate,
          isCustomisation: isCustomisation,
          customisationDetails: isCustomisation
            ? {
                noOfBoxes: savedNoOfBoxes,
                boxType: selectedBoxObj?.name || boxType,
                boxPrice: selectedBoxPrice,
                boxImageUrl: finalBoxImageUrl,
                shrinkType: shrinkType,
                shrinkPrice: selectedShrinkPrice,
                hasShrink: shrinkType !== 'None' && selectedShrinkPrice > 0,
                stickerType: stickerType,
                stickerPrice: selectedStickerPrice,
                hasSticker: stickerType !== 'None' && selectedStickerPrice > 0,
              }
            : null,
          isTransportRequired: isTransportRequired,
          transportCharges: transportChargesVal,
          deliveryAddress: isTransportRequired ? deliveryAddress : (selectedCustomer.address || ''),
          items: validItems,
          totalItems: validItems.length,
          subTotal: subTotal,
          noOfBoxes: savedNoOfBoxes,
          globalPackingBoxPrice: !isCustomisation ? (globalSettings.globalPackingBoxPrice || 0) : 0,
          boxChargesTotal: isCustomisation ? boxChargesTotal : 0,
          stickerChargesTotal: isCustomisation ? stickerChargesTotal : 0,
          shrinkChargesTotal: isCustomisation ? shrinkChargesTotal : 0,
          packetChargesTotal: packetChargesTotal,
          packingCharges: !isCustomisation ? pCharges : 0,
          additionalCharges: !isCustomisation ? addCharges : 0,
          discountAmount: discountVal,
          totalAmount: grandTotal,
          receivedAmount: parseFloat(String(receivedAmount)) || 0,
          paymentMode: paymentMode,
          paymentStatus: paymentStatus,
          orderStatus: orderStatus,
          updatedAt: serverTimestamp(),
        }));

        toast.success('Order Updated', `Order ${existingOrderCode || ''} updated successfully.`);
        router.push(`/orders/${editId}`);
        return;
      }

      await addDoc(collection(db, 'orders'), sanitizeForFirestore({
        code: orderCode,
        customerName: selectedCustomer.name,
        customerMobile: selectedCustomer.mobile,
        customerId: selectedCustomer.id,
        customerType: selectedCustomer.type,
        customerAddress: selectedCustomer.address || '',
        slot: orderSlot,
        orderTime: timeStr,
        orderDate: targetOrderDate,
        manufacturingDate: mfgDate,
        expectedDeliveryDate: expDeliveryDate,
        isCustomisation: isCustomisation,
        customisationDetails: isCustomisation
          ? {
              noOfBoxes: savedNoOfBoxes,
              boxType: selectedBoxObj?.name || boxType,
              boxPrice: selectedBoxPrice,
              boxImageUrl: finalBoxImageUrl,
              shrinkType: shrinkType,
              shrinkPrice: selectedShrinkPrice,
              hasShrink: shrinkType !== 'None' && selectedShrinkPrice > 0,
              stickerType: stickerType,
              stickerPrice: selectedStickerPrice,
              hasSticker: stickerType !== 'None' && selectedStickerPrice > 0,
            }
          : null,
        isTransportRequired: isTransportRequired,
        transportCharges: transportChargesVal,
        deliveryAddress: isTransportRequired ? deliveryAddress : (selectedCustomer.address || ''),
        items: validItems,
        totalItems: validItems.length,
        subTotal: subTotal,
        noOfBoxes: savedNoOfBoxes,
        globalPackingBoxPrice: !isCustomisation ? (globalSettings.globalPackingBoxPrice || 0) : 0,
        boxChargesTotal: isCustomisation ? boxChargesTotal : 0,
        stickerChargesTotal: isCustomisation ? stickerChargesTotal : 0,
        shrinkChargesTotal: isCustomisation ? shrinkChargesTotal : 0,
        packetChargesTotal: packetChargesTotal,
        packingCharges: !isCustomisation ? pCharges : 0,
        additionalCharges: !isCustomisation ? addCharges : 0,
        discountAmount: discountVal,
        totalAmount: grandTotal,
        receivedAmount: parseFloat(String(receivedAmount)) || 0,
        paymentMode: paymentMode,
        paymentStatus: paymentStatus,
        orderStatus: orderStatus,
        createdBy: creatorName,
        createdById: creatorId,
        creatorRole: creatorRole,
        createdAt: serverTimestamp(),
      }));

      toast.success('Order Created', `New order ${orderCode} recorded successfully.`);
      router.push('/orders');
    } catch (err: any) {
      console.error('Failed to save order:', err);
      toast.error('Order Save Failed', err?.message || 'Failed to save order to Firebase.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingOrder) {
    return (
      <div className="w-full min-h-screen bg-[#f6f6f7] font-sans flex flex-col items-center justify-center gap-3">
        <Loader2 size={36} className="animate-spin text-[#02626D]" />
        <p className="text-xs font-bold text-slate-700">Loading order details for editing...</p>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-[#f6f6f7] font-sans text-slate-800 pb-16">
      
      {/* ── TOP STICKY APP BAR ─────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200/90 shadow-2xs sticky top-0 z-30 px-3 sm:px-6 py-2.5">
        <div className="w-full flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href={isEditMode ? `/orders/${editId}` : '/orders'}
              className="w-8.5 h-8.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors cursor-pointer flex-shrink-0"
              title={isEditMode ? 'Back to Order Details' : 'Back to Orders'}
            >
              <ArrowLeft size={18} />
            </Link>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight truncate">
                  {isEditMode ? 'Edit Order' : 'Create Order'}
                </h1>
                {isEditMode && existingOrderCode && (
                  <span className="text-xs font-mono font-bold text-[#02626D] bg-[#02626D]/10 px-2 py-0.5 rounded-lg border border-teal-200/80">
                    {existingOrderCode}
                  </span>
                )}
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#02626D]/10 text-[#02626D] border border-teal-200/80 hidden sm:inline-block">
                  {orderSlot}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 truncate hidden sm:block">
                {isEditMode
                  ? 'Modify order items, customisation, schedule and update records'
                  : 'Select customer, choose products, set customisation & checkout'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Link
              href={isEditMode ? `/orders/${editId}` : '/orders'}
              className="h-8.5 px-3.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors flex items-center justify-center cursor-pointer shadow-2xs"
            >
              Cancel
            </Link>
            <button
              type="button"
              onClick={handleCreateOrderSubmit}
              disabled={isSubmitting}
              className="h-8.5 px-4 rounded-xl bg-[#02626D] hover:bg-[#014d56] text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>{isEditMode ? 'Updating...' : 'Creating...'}</span>
                </>
              ) : (
                <>
                  <Check size={14} />
                  <span>{isEditMode ? 'Update Order' : 'Create Order'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT WORKSPACE ─────────────────────────────────────────── */}
      <div className="w-full px-3 sm:px-6 pt-4">
        <form onSubmit={handleCreateOrderSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-start">
          
          {/* LEFT 8/9 COLUMNS: ORDER DETAILS, CUSTOMER, CUSTOMISATION & PRODUCT CATALOG */}
          <div className="lg:col-span-8 xl:col-span-8 2xl:col-span-9 space-y-4">
            
            {/* 1. Time Slot & Schedule Dates Card */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#02626D]/10 text-[#02626D] flex items-center justify-center">
                    <Clock size={15} />
                  </div>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider">
                    1. Delivery Slot &amp; Dates
                  </h3>
                </div>
                <span className="text-[11px] font-semibold text-slate-400">Step 1 of 4</span>
              </div>

              {/* Slot Selector Pills */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Select Delivery Slot
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {ALL_SLOTS.map((slot) => {
                    const isSelected = orderSlot === slot;
                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setOrderSlot(slot)}
                        className={`h-9 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer select-none ${
                          isSelected
                            ? 'bg-[#02626D] text-white shadow-xs ring-2 ring-[#02626D]/30'
                            : 'bg-[#f7f7f8] hover:bg-slate-100 text-slate-700 border border-slate-200/80'
                        }`}
                      >
                        <Clock size={12} className={isSelected ? 'text-white' : 'text-slate-400'} />
                        <span className="truncate">{slot}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Mfg Date & Exp Delivery Date Pickers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Manufacturing Date <span className="text-rose-500">*</span>
                  </label>
                  <CustomDatePicker
                    value={mfgDate}
                    onChange={(val) => setMfgDate(val)}
                    placeholder="Select Mfg Date"
                    blockTuesdays={true}
                    className="w-full"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Factory closed on Tuesdays</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Expected Delivery Date <span className="text-rose-500">*</span>
                  </label>
                  <CustomDatePicker
                    value={expDeliveryDate}
                    onChange={(val) => setExpDeliveryDate(val)}
                    placeholder="Select Delivery Date"
                    blockTuesdays={true}
                    className="w-full"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Store closed on Tuesdays</span>
                </div>
              </div>
            </div>

            {/* 2. Customer Selection Card */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                    <UserCheck size={15} />
                  </div>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider">
                    2. Customer Information
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddCustomerModalOpen(true)}
                  className="text-xs font-bold text-[#02626D] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={13} />
                  <span>New Customer</span>
                </button>
              </div>

              {/* Selected Customer View or Search Box */}
              {selectedCustomer ? (
                <div className="p-3.5 rounded-xl bg-teal-50/60 border border-teal-200/90 flex items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-[#02626D] text-white font-black text-sm flex items-center justify-center flex-shrink-0 shadow-2xs">
                      {selectedCustomer.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-sm text-slate-900 truncate">{selectedCustomer.name}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#02626D] text-white uppercase">
                          {selectedCustomer.type}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 font-medium">{selectedCustomer.mobile || 'No mobile'}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCustomer(null);
                      setCustomerSearchTerm('');
                    }}
                    className="text-xs font-bold text-slate-500 hover:text-red-600 px-2.5 py-1 rounded-lg border border-slate-300 hover:border-red-200 bg-white transition-colors cursor-pointer"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div className="relative" ref={customerSearchRef}>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search customer by name, mobile, or code..."
                      value={customerSearchTerm}
                      onChange={(e) => {
                        setCustomerSearchTerm(e.target.value);
                        setIsCustomerDropdownOpen(true);
                      }}
                      onFocus={() => setIsCustomerDropdownOpen(true)}
                      className="w-full pl-9 pr-3 h-9 text-xs border border-slate-300 rounded-xl bg-[#f7f7f8] focus:bg-white focus:outline-none focus:border-[#02626D] font-medium"
                    />
                  </div>

                  {/* Customer Dropdown Results */}
                  {isCustomerDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 max-h-56 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl z-20 divide-y divide-slate-100 no-scrollbar">
                      {filteredCustomers.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-400">
                          No matching customer found.{' '}
                          <button
                            type="button"
                            onClick={() => setIsAddCustomerModalOpen(true)}
                            className="text-[#02626D] font-bold underline ml-1"
                          >
                            Add New Customer
                          </button>
                        </div>
                      ) : (
                        filteredCustomers.map((cust) => (
                          <div
                            key={cust.id}
                            onClick={() => {
                              setSelectedCustomer(cust);
                              setIsCustomerDropdownOpen(false);
                            }}
                            className="p-2.5 hover:bg-slate-50 flex items-center justify-between cursor-pointer transition-colors"
                          >
                            <div>
                              <p className="text-xs font-bold text-slate-900">{cust.name}</p>
                              <p className="text-[10.5px] text-slate-400">{cust.mobile} • {cust.code}</p>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                              {cust.type}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 3. Packaging & Customisation Section */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                    <PackageCheck size={15} />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider">
                      3. Packaging &amp; Customisation
                    </h3>
                    <p className="text-[10.5px] text-slate-400">
                      {isCustomisation ? 'Custom sweet boxes, shrink wrap, and branding stickers' : 'Standard packaging boxes with global utility rates'}
                    </p>
                  </div>
                </div>

                {/* Toggle Switch */}
                <label className="flex items-center gap-3 cursor-pointer select-none group">
                  <span className={`text-xs font-bold transition-colors ${
                    isCustomisation ? 'text-[#02626D]' : 'text-slate-500 group-hover:text-slate-700'
                  }`}>
                    {isCustomisation ? 'Customised Order' : 'Standard Order'}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isCustomisation}
                    onClick={() => setIsCustomisation(!isCustomisation)}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 ease-in-out cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#02626D] focus:ring-offset-1 ${
                      isCustomisation ? 'bg-[#02626D]' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                        isCustomisation ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </label>
              </div>

              {/* Standard Packaging UI (When isCustomisation is OFF) */}
              {!isCustomisation && (
                <div className="space-y-3 pt-1 animate-in fade-in duration-150">
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800">Standard Box Packaging Rate</span>
                        <span className="text-[10.5px] font-extrabold px-2 py-0.5 rounded-md bg-[#02626D]/10 text-[#02626D] border border-teal-200">
                          ₹{globalSettings.globalPackingBoxPrice} / box
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Default standard sweet box rate configured in Global Utilities settings.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <label className="text-xs font-bold text-slate-700 whitespace-nowrap">No. of Boxes:</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={noOfBoxes}
                        onChange={(e) => setNoOfBoxes(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10) || 0))}
                        className="w-24 h-8.5 px-3 border border-slate-300 rounded-xl text-xs font-bold text-[#02626D] bg-white focus:outline-none focus:border-[#02626D] text-center"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-teal-50/50 border border-teal-200/60 text-xs">
                    <span className="font-semibold text-teal-900">
                      Packing Charges ({numericNoOfBoxes} boxes × ₹{globalSettings.globalPackingBoxPrice}):
                    </span>
                    <span className="font-extrabold text-[#02626D]">
                      ₹ {pCharges.toFixed(2)}
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Additional Charges (₹, Optional)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={additionalCharges}
                      onChange={(e) => setAdditionalCharges(e.target.value)}
                      className="w-full sm:w-64 h-8.5 px-3 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:border-[#02626D]"
                    />
                  </div>
                </div>
              )}

              {/* Customised Order UI (When isCustomisation is ON) */}
              {isCustomisation && (
                <div className="space-y-3.5 pt-1 animate-in fade-in duration-150">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* No of Boxes */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        No. of Boxes
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="Enter box count..."
                        value={noOfBoxes}
                        onChange={(e) => setNoOfBoxes(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10) || 0))}
                        className="w-full h-8.5 px-3 border border-slate-300 rounded-xl text-xs font-bold text-[#02626D] bg-white focus:outline-none focus:border-[#02626D]"
                      />
                    </div>

                    {/* Box Type */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Box Model
                      </label>
                      <select
                        value={boxType}
                        onChange={(e) => setBoxType(e.target.value)}
                        className="w-full h-8.5 px-2.5 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:border-[#02626D]"
                      >
                        {activeBoxes.map((b) => (
                          <option key={b.id} value={b.name}>
                            {b.name} (₹{b.price}/box)
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Shrink & Sticker */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Shrink Wrap</label>
                      <select
                        value={shrinkType}
                        onChange={(e) => setShrinkType(e.target.value)}
                        className="w-full h-8.5 px-2.5 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:border-[#02626D]"
                      >
                        <option value="None">None (₹0)</option>
                        {activeShrinks.map((s) => (
                          <option key={s.id} value={s.name}>
                            {s.name} (+₹{s.price}/box)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Branding Sticker</label>
                      <select
                        value={stickerType}
                        onChange={(e) => setStickerType(e.target.value)}
                        className="w-full h-8.5 px-2.5 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:border-[#02626D]"
                      >
                        <option value="None">None (₹0)</option>
                        {activeStickers.map((st) => (
                          <option key={st.id} value={st.name}>
                            {st.name} (+₹{st.price}/box)
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Custom Box Image Upload */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Box Reference Image (Optional)
                    </label>
                    <div className="flex items-center gap-3">
                      <div className="relative w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
                        {boxImageUrl ? (
                          <Image src={boxImageUrl} alt="Box Preview" fill className="object-contain p-1" />
                        ) : (
                          <Upload size={16} className="text-slate-400" />
                        )}
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleBoxImageUpload}
                        className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-teal-50 file:text-[#02626D] hover:file:bg-teal-100 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 4. Transport & Delivery Details Section */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                    <Truck size={15} />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider">
                      4. Transport &amp; Delivery
                    </h3>
                    <p className="text-[10.5px] text-slate-400">Specify transport freight charges and delivery destination address</p>
                  </div>
                </div>

                {/* Toggle Switch */}
                <label className="flex items-center gap-3 cursor-pointer select-none group">
                  <span className={`text-xs font-bold transition-colors ${
                    isTransportRequired ? 'text-emerald-700' : 'text-slate-500 group-hover:text-slate-700'
                  }`}>
                    {isTransportRequired ? 'Transport Required' : 'No Transport'}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isTransportRequired}
                    onClick={() => setIsTransportRequired(!isTransportRequired)}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 ease-in-out cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-1 ${
                      isTransportRequired ? 'bg-emerald-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                        isTransportRequired ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </label>
              </div>

              {isTransportRequired && (
                <div className="space-y-3.5 pt-1 animate-in fade-in duration-150">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-1">
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Transport Charges (₹) <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={transportCharges}
                          onChange={(e) => setTransportCharges(e.target.value)}
                          className="w-full h-8.5 pl-8 pr-3 border border-slate-300 rounded-xl text-xs font-bold text-[#02626D] bg-white focus:outline-none focus:border-[#02626D]"
                        />
                        <IndianRupee size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      </div>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                        <span>Delivery / Transport Address <span className="text-rose-500">*</span></span>
                        {selectedCustomer?.address && deliveryAddress !== selectedCustomer.address && (
                          <button
                            type="button"
                            onClick={() => setDeliveryAddress(selectedCustomer.address || '')}
                            className="text-[10.5px] font-semibold text-[#02626D] hover:underline cursor-pointer"
                          >
                            Use Customer Address
                          </button>
                        )}
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Enter destination delivery address for logistics/transport..."
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                        className="w-full p-2.5 text-xs font-medium border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-[#02626D]"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 5. Products Selector Section with Spacious, Premium Product Tiles Grid */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs space-y-4">
              
              {/* Header & Filter Controls */}
              <div className="space-y-3 pb-3.5 border-b border-slate-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider">
                        5. Select Products Catalog
                      </h3>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#02626D]/10 text-[#02626D]">
                        {filteredProductTiles.length} products
                      </span>
                      {orderItems.length > 0 && (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {orderItems.length} selected
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Tap product tile to select and customize quantity, packet, and notes directly on the tile.
                    </p>
                  </div>

                  {/* Search Input */}
                  <div className="relative w-full sm:w-64 flex-shrink-0">
                    <input
                      type="text"
                      placeholder="Search sweet name or code..."
                      value={productGridSearch}
                      onChange={(e) => setProductGridSearch(e.target.value)}
                      className="w-full pl-8 pr-7 h-8.5 text-xs border border-slate-300 rounded-xl bg-[#f7f7f8] focus:bg-white focus:outline-none focus:border-[#02626D] font-medium"
                    />
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    {productGridSearch && (
                      <button
                        type="button"
                        onClick={() => setProductGridSearch('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Category Pills & Favourites Toggle */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
                  <button
                    type="button"
                    onClick={() => setProductGridOnlyFavorites(!productGridOnlyFavorites)}
                    className={`h-7.5 px-3 rounded-xl font-bold flex items-center gap-1.5 flex-shrink-0 transition-all cursor-pointer ${
                      productGridOnlyFavorites
                        ? 'bg-amber-500 text-white shadow-2xs'
                        : 'bg-amber-50 text-amber-900 border border-amber-200/80 hover:bg-amber-100'
                    }`}
                  >
                    <Star size={12} className={productGridOnlyFavorites ? 'fill-white text-white' : 'fill-amber-400 text-amber-500'} />
                    <span>Favourites ({itemsMaster.filter((i) => i.isFavorite).length})</span>
                  </button>

                  {productCategories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setProductGridCategory(cat)}
                      className={`h-7.5 px-3 rounded-xl font-bold flex-shrink-0 transition-all cursor-pointer ${
                        productGridCategory === cat
                          ? 'bg-[#02626D] text-white shadow-2xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Spacious Responsive Products Grid (1 col on small phones, 2 on tablet, 3 on desktop) */}
              <div className="p-0.5">
                {filteredProductTiles.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <ShoppingBag size={28} className="mx-auto text-slate-300 mb-1.5" />
                    <p className="font-bold text-xs sm:text-sm text-slate-600">No products match your filter</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Try clearing your search or category filter</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                      {paginatedProductTiles.map((prod) => {
                        const addedItem = orderItems.find((it) => it.itemId === prod.id);
                        const currentSlotLimit = orderSlot && prod.slotAllowedWeights?.[orderSlot as keyof typeof prod.slotAllowedWeights];

                        return (
                          <ProductCatalogTile
                            key={prod.id}
                            prod={prod}
                            addedItem={addedItem}
                            currentSlotLimit={currentSlotLimit}
                            isCustomisation={isCustomisation}
                            numericNoOfBoxes={numericNoOfBoxes}
                            packetCostPerBox={packetCostPerBox}
                            onToggle={handleToggleTileProduct}
                            onQuantityChange={handleTileQuantityChange}
                            onFieldChange={handleTileFieldChange}
                          />
                        );
                      })}
                    </div>

                    {/* Show More / Pagination Controls (24 items per batch) */}
                    {filteredProductTiles.length > 24 && (
                      <div className="pt-3 pb-1 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                        <p className="text-xs text-slate-500 font-medium">
                          Showing <strong className="text-slate-900">{Math.min(visibleProductCount, filteredProductTiles.length)}</strong> of <strong className="text-slate-900">{filteredProductTiles.length}</strong> products
                        </p>

                        <div className="flex items-center gap-2">
                          {visibleProductCount < filteredProductTiles.length && (
                            <button
                              type="button"
                              onClick={() => setVisibleProductCount((prev) => prev + 24)}
                              className="px-3.5 py-1.5 rounded-xl bg-[#02626D] hover:bg-[#014d56] text-white text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                            >
                              Show More (+24)
                            </button>
                          )}

                          {visibleProductCount < filteredProductTiles.length ? (
                            <button
                              type="button"
                              onClick={() => setVisibleProductCount(filteredProductTiles.length)}
                              className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all cursor-pointer shadow-2xs"
                            >
                              Show All ({filteredProductTiles.length})
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setVisibleProductCount(24)}
                              className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all cursor-pointer shadow-2xs"
                            >
                              Show Less (First 24)
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>

          </div>

          {/* RIGHT 4/3 COLUMNS: STICKY ORDER SUMMARY & CHECKOUT PANEL */}
          <div className="lg:col-span-4 xl:col-span-4 2xl:col-span-3 space-y-4">
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs space-y-4 lg:sticky lg:top-16">
              
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Order Summary
                </h3>
                <p className="text-[11px] text-slate-400">Live bill calculation &amp; checkout</p>
              </div>

              {/* Summary Header Badges */}
              <div className="space-y-1.5 text-xs text-slate-600">
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-500">Delivery Slot:</span>
                  <span className="font-bold text-slate-900">{orderSlot}</span>
                </div>

                <div className="flex justify-between py-0.5">
                  <span className="text-slate-500">Packaging Mode:</span>
                  <span className={`font-bold ${isCustomisation ? 'text-amber-700' : 'text-teal-700'}`}>
                    {isCustomisation ? 'Customised' : 'Standard'}
                  </span>
                </div>
              </div>

              {/* Selected Items List with Quantity Controls */}
              <div className="space-y-2 border-t border-b border-slate-100 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Selected Items ({orderItems.length})
                  </span>
                  {orderItems.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setOrderItems([])}
                      className="text-[10px] font-bold text-red-500 hover:text-red-700 hover:underline cursor-pointer"
                    >
                      Clear All
                    </button>
                  )}
                </div>

                {orderItems.length === 0 ? (
                  <div className="py-4 text-center text-slate-400 bg-[#f7f7f8] rounded-xl border border-dashed border-slate-200">
                    <ShoppingBag size={20} className="mx-auto mb-1 text-slate-300" />
                    <p className="text-[11px] font-medium">No products added</p>
                    <p className="text-[10px] text-slate-400">Click items from catalog to add</p>
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto space-y-2 pr-0.5 no-scrollbar divide-y divide-slate-100">
                    {orderItems.map((item) => (
                      <div key={item.lineId || item.itemId} className="pt-2 first:pt-0 space-y-1">
                        <div className="flex items-start justify-between gap-1.5">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-slate-900 truncate" title={item.itemName}>
                              {item.itemName}
                            </p>
                            <p className="text-[10px] text-slate-500">
                              ₹{item.unitPrice} / {item.unit}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleSummaryRemoveItem(item.itemId)}
                            className="text-slate-400 hover:text-red-500 p-0.5 rounded transition-colors cursor-pointer flex-shrink-0"
                            title="Remove item"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>

                        {/* Inline Quantity Modifier */}
                        <div className="flex items-center justify-between gap-2 pt-0.5">
                          <div className="flex items-center rounded-lg border border-slate-200 bg-white overflow-hidden shadow-2xs">
                            <button
                              type="button"
                              onClick={() => handleSummaryQuantityChange(item.itemId, (item.quantity || 1) - (item.unit?.toUpperCase() === 'KG' ? 0.5 : 1))}
                              className="w-6 h-6 flex items-center justify-center text-slate-500 hover:bg-slate-100 active:bg-slate-200 transition-colors cursor-pointer"
                              title="Decrease quantity"
                            >
                              <Minus size={11} />
                            </button>
                            <input
                              type="number"
                              step={item.unit?.toUpperCase() === 'KG' ? '0.25' : '1'}
                              min="0.1"
                              value={item.quantity}
                              onChange={(e) => handleSummaryQuantityChange(item.itemId, parseFloat(e.target.value) || 0)}
                              className="w-12 h-6 text-center text-xs font-bold text-slate-900 bg-transparent border-x border-slate-200 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleSummaryQuantityChange(item.itemId, (item.quantity || 0) + (item.unit?.toUpperCase() === 'KG' ? 0.5 : 1))}
                              className="w-6 h-6 flex items-center justify-center text-[#02626D] hover:bg-teal-50 active:bg-teal-100 transition-colors cursor-pointer"
                              title="Increase quantity"
                            >
                              <Plus size={11} />
                            </button>
                          </div>

                          <span className="text-xs font-black text-slate-900">
                            ₹ {item.lineTotal.toFixed(2)}
                          </span>
                        </div>

                        {/* Optional Packing note badge */}
                        {(item.packingDescription || item.manufacturingDescription || item.hasPacket) && (
                          <div className="flex items-center gap-1.5 text-[9.5px] text-slate-500 pt-0.5 flex-wrap">
                            {item.hasPacket && (
                              <span className="px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
                                Packet (+₹5)
                              </span>
                            )}
                            {item.packingDescription && (
                              <span className="truncate max-w-[160px] italic">
                                {item.packingDescription}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Pricing Breakdown */}
              <div className="space-y-2 text-xs text-slate-600">
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-500">Items Subtotal:</span>
                  <span className="font-bold text-slate-900">₹ {subTotal.toFixed(2)}</span>
                </div>

                {isCustomisation ? (
                  <>
                    <div className="flex justify-between py-0.5 text-amber-900">
                      <span>Box Charges ({numericNoOfBoxes} × ₹{selectedBoxPrice}):</span>
                      <span className="font-bold">+ ₹ {boxChargesTotal.toFixed(2)}</span>
                    </div>

                    {stickerType !== 'None' && (
                      <div className="flex justify-between py-0.5 text-amber-900">
                        <span>Sticker ({numericNoOfBoxes} × ₹{selectedStickerPrice}):</span>
                        <span className="font-bold">+ ₹ {stickerChargesTotal.toFixed(2)}</span>
                      </div>
                    )}

                    {shrinkType !== 'None' && (
                      <div className="flex justify-between py-0.5 text-amber-900">
                        <span>Shrink Wrap ({numericNoOfBoxes} × ₹{selectedShrinkPrice}):</span>
                        <span className="font-bold">+ ₹ {shrinkChargesTotal.toFixed(2)}</span>
                      </div>
                    )}

                    {packetChargesTotal > 0 && (
                      <div className="flex justify-between py-0.5 text-amber-900">
                        <span>Packet Charges:</span>
                        <span className="font-bold">+ ₹ {packetChargesTotal.toFixed(2)}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {pCharges > 0 && (
                      <div className="flex justify-between py-0.5 text-slate-600">
                        <span>Packing Charges ({numericNoOfBoxes} × ₹{globalSettings.globalPackingBoxPrice}):</span>
                        <span className="font-bold">+ ₹ {pCharges.toFixed(2)}</span>
                      </div>
                    )}
                    {addCharges > 0 && (
                      <div className="flex justify-between py-0.5 text-slate-600">
                        <span>Additional Charges:</span>
                        <span className="font-bold">+ ₹ {addCharges.toFixed(2)}</span>
                      </div>
                    )}
                  </>
                )}

                {/* Transport Charges */}
                {isTransportRequired && transportChargesVal > 0 && (
                  <div className="flex justify-between py-0.5 text-emerald-800">
                    <span>Transport Charges:</span>
                    <span className="font-bold">+ ₹ {transportChargesVal.toFixed(2)}</span>
                  </div>
                )}

                {/* Discount */}
                <div className="pt-2 border-t border-slate-100">
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Discount (₹)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(e.target.value)}
                    className="w-full h-8 px-3 text-xs border border-slate-300 rounded-xl bg-[#f7f7f8] focus:bg-white focus:outline-none focus:border-[#02626D] font-bold text-slate-800"
                  />
                </div>

                {/* Grand Total */}
                <div className="pt-3 border-t-2 border-slate-200 flex justify-between items-baseline">
                  <span className="text-sm font-extrabold text-slate-900">Grand Total:</span>
                  <span className="text-xl font-black text-[#02626D]">
                    ₹ {grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Received Amount & Payment Mode */}
              <div className="pt-2 border-t border-slate-100 space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Received Amount (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={receivedAmount}
                    onChange={(e) => setReceivedAmount(e.target.value)}
                    className="w-full h-8.5 px-3 text-xs font-black text-slate-900 border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-[#02626D]"
                  />
                </div>

                {/* Payment Mode Pills */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Payment Mode</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {['UPI', 'Cash', 'Card', 'Credit'].map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setPaymentMode(mode)}
                        className={`h-7.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          paymentMode === mode
                            ? 'bg-[#02626D] text-white shadow-2xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Live Payment Status Indicator */}
                <div className="p-2 rounded-xl text-center font-bold text-xs border flex items-center justify-center gap-1.5 bg-amber-50 text-amber-900 border-amber-200">
                  <span>Payment Status:</span>
                  <span className="uppercase">{paymentStatus}</span>
                </div>

                {/* Order Status Select */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Initial Order Status</label>
                  <select
                    value={orderStatus}
                    onChange={(e) => setOrderStatus(e.target.value)}
                    className="w-full h-8 px-2.5 text-xs font-semibold text-slate-800 border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-[#02626D]"
                  >
                    <option value="Order Created">Order Created</option>
                    <option value="Confirmed">Confirmed</option>
                    <option value="Pending">Pending</option>
                  </select>
                </div>

                {/* Submit Action Buttons */}
                <div className="pt-2 space-y-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full h-10 rounded-xl bg-[#02626D] hover:bg-[#014d56] text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 size={15} className="animate-spin" />
                        <span>{isEditMode ? 'Updating Order...' : 'Creating Order...'}</span>
                      </>
                    ) : (
                      <>
                        <Check size={15} />
                        <span>{isEditMode ? 'Update Order' : 'Create Order'}</span>
                      </>
                    )}
                  </button>

                  <Link
                    href={isEditMode ? `/orders/${editId}` : '/orders'}
                    className="w-full h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors flex items-center justify-center cursor-pointer"
                  >
                    Cancel
                  </Link>
                </div>
              </div>

            </div>
          </div>

        </form>
      </div>

      {/* ── MODAL: QUICK ADD CUSTOMER ──────────────────────────────────────── */}
      {isAddCustomerModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150 font-sans">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="text-sm font-bold text-slate-900">Add New Customer</h3>
              <button
                type="button"
                onClick={() => setIsAddCustomerModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveQuickCustomer} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Customer Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={newCustomerForm.name}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, name: e.target.value })}
                  className="w-full h-8 px-3 border border-slate-300 rounded-xl focus:outline-none focus:border-[#02626D]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Mobile Number *</label>
                <input
                  type="tel"
                  required
                  placeholder="10-digit mobile number"
                  value={newCustomerForm.mobileNumber}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, mobileNumber: e.target.value })}
                  className="w-full h-8 px-3 border border-slate-300 rounded-xl focus:outline-none focus:border-[#02626D]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  placeholder="Optional email"
                  value={newCustomerForm.email}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, email: e.target.value })}
                  className="w-full h-8 px-3 border border-slate-300 rounded-xl focus:outline-none focus:border-[#02626D]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Address</label>
                <textarea
                  rows={2}
                  placeholder="Delivery address..."
                  value={newCustomerForm.address}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, address: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-xl focus:outline-none focus:border-[#02626D]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddCustomerModalOpen(false)}
                  className="px-3 h-8 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 h-8 rounded-xl text-xs font-bold text-white bg-[#02626D] hover:bg-[#014d56] shadow-2xs"
                >
                  Save &amp; Select
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

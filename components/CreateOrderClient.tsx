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
  Package,
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
  Pencil,
  Layers,
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, addDoc, doc, getDoc, updateDoc, serverTimestamp, onSnapshot, query } from 'firebase/firestore';
import { toast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import { usePrinter } from '@/context/PrinterContext';
import CustomDatePicker from '@/components/CustomDatePicker';
import { useAllowedTuesdays } from '@/lib/tuesdayOverrides';
import { compressImageTo60KB, uploadToImageKit } from '@/lib/imageCompressor';
import SlotLimitOverrideModal, { SlotLimitOverrideData } from '@/components/SlotLimitOverrideModal';
import { OrderActionOtpModal } from '@/components/OrderActionOtpModal';
import { useBusinessSettings, calculateTax } from '@/lib/businessSettings';

export type SlotTime =
  | '9:00 AM - 12:00 PM'
  | '12:00 PM - 3:00 PM'
  | '3:00 PM - 6:00 PM'
  | '6:00 PM - 9:00 PM';

export const ALL_SLOTS: SlotTime[] = [
  '9:00 AM - 12:00 PM',
  '12:00 PM - 3:00 PM',
  '3:00 PM - 6:00 PM',
  '6:00 PM - 9:00 PM',
];

export interface SlotCategory {
  id: string;
  name: string;
  description?: string;
  color?: string;
  assignedItemIds: string[];
  assignedItemNames: string[];
  slotLimits: Record<string, number>;
  status: 'active' | 'inactive';
}

export const DELIVERY_TIME_OPTIONS = [
  '07:00 AM',
  '08:00 AM',
  '09:00 AM',
  '10:00 AM',
  '11:00 AM',
  '12:00 PM',
  '01:00 PM',
  '02:00 PM',
  '03:00 PM',
  '04:00 PM',
  '05:00 PM',
  '06:00 PM',
  '07:00 PM',
  '08:00 PM',
  '09:00 PM',
  '10:00 PM',
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
  needsManufacturing?: boolean;
  mfgStatus?: string;
  pckStatus?: string;
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

// ── MEMOIZED HIGH-PERFORMANCE PRODUCT TILE COMPONENT (E-COMMERCE STYLE) ──────
interface ProductCatalogTileProps {
  prod: ItemMasterOption;
  addedItem?: OrderItemLine;
  isCustomisation: boolean;
  numericNoOfBoxes: number;
  packetCostPerBox: number;
  onOpenQtyModal: (prod: ItemMasterOption, isEdit: boolean) => void;
  onRemoveItem: (prodId: string) => void;
  onTogglePacket: (prodId: string) => void;
}

const ProductCatalogTile = React.memo(function ProductCatalogTile({
  prod,
  addedItem,
  isCustomisation,
  numericNoOfBoxes,
  packetCostPerBox,
  onOpenQtyModal,
  onRemoveItem,
  onTogglePacket,
}: ProductCatalogTileProps) {
  const isAdded = Boolean(addedItem);

  return (
    <div
      onClick={() => {
        if (!addedItem) {
          onOpenQtyModal(prod, false);
        }
      }}
      className={`group relative rounded-xl p-2 flex flex-col justify-between transition-all duration-150 select-none ${
        !addedItem ? 'cursor-pointer hover:scale-[1.01] active:scale-[0.99]' : ''
      } ${
        isAdded
          ? 'bg-[#02626D]/[0.03] border-2 border-[#02626D] shadow-sm ring-1 ring-[#02626D]/20'
          : 'bg-white border border-slate-200/90 hover:border-[#02626D]/50 hover:shadow-md'
      }`}
    >
      <div>
        {/* Top Product Image Container */}
        <div className="relative w-full aspect-square rounded-lg bg-slate-50 border border-slate-100/90 overflow-hidden flex items-center justify-center group-hover:scale-[1.02] transition-transform shadow-2xs">
          <Image
            src={prod.imageUrl || '/app-icon.png'}
            alt={prod.name}
            fill
            className="object-contain p-1"
          />

          {prod.isFavorite && (
            <span
              onClick={(e) => e.stopPropagation()}
              className="absolute top-1 right-1 p-0.5 rounded-md bg-white/95 backdrop-blur-xs text-amber-500 shadow-2xs"
              title="Favourite Product"
            >
              <Star size={11} className="fill-amber-400 text-amber-400" />
            </span>
          )}
        </div>

        {/* Product Name Below Image */}
        <div className="mt-1.5 min-w-0">
          <h4
            className={`text-xs font-bold leading-tight line-clamp-1 ${
              isAdded ? 'text-[#02626D]' : 'text-slate-800 group-hover:text-[#02626D]'
            }`}
            title={prod.name}
          >
            {prod.name}
          </h4>
          <p className="text-[9.5px] text-slate-400 font-mono truncate mt-0.5">
            {prod.code} • {prod.category}
          </p>
        </div>

        {/* Product Price Below Name */}
        <div className="mt-0.5 flex items-baseline gap-1">
          <span className="text-xs sm:text-sm font-extrabold text-[#02626D]">₹{prod.price}</span>
          <span className="text-[9.5px] text-slate-400 font-normal">/{prod.unit}</span>
        </div>
      </div>

      {/* SAVED STATE: Edit (Left), Quantity Display (Middle), Delete (Right) & Packet Toggle */}
      {addedItem && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="mt-1.5 pt-1 border-t border-slate-200/80 space-y-1"
        >
          <div className="flex items-center justify-between gap-1 bg-white p-1 rounded-lg border border-slate-300 shadow-2xs">
            {/* Left: Edit Icon Button */}
            <button
              type="button"
              onClick={() => onOpenQtyModal(prod, true)}
              className="w-6 h-6 flex items-center justify-center rounded-md bg-slate-100 hover:bg-[#02626D] hover:text-white text-slate-700 transition-colors cursor-pointer active:scale-90"
              title="Edit Quantity"
            >
              <Pencil size={11} />
            </button>

            {/* Middle: Quantity Display */}
            <div
              onClick={() => onOpenQtyModal(prod, true)}
              className="flex flex-col items-center justify-center cursor-pointer hover:opacity-80 px-1"
              title="Click to edit quantity"
            >
              <span className="text-xs font-black text-[#02626D] leading-tight">
                {addedItem.quantity} <span className="text-[9px] font-bold text-slate-500">{addedItem.unit}</span>
              </span>
              <span className="text-[9px] text-slate-400 font-bold leading-none">
                ₹{addedItem.lineTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </span>
            </div>

            {/* Right: Delete Icon Button */}
            <button
              type="button"
              onClick={() => onRemoveItem(prod.id)}
              className="w-6 h-6 flex items-center justify-center rounded-md bg-red-50 hover:bg-red-600 text-red-600 hover:text-white transition-colors cursor-pointer active:scale-90"
              title="Delete Item"
            >
              <Trash2 size={11} />
            </button>
          </div>

          {/* Packet Toggle on Tile */}
          <button
            type="button"
            onClick={() => onTogglePacket(prod.id)}
            className={`w-full py-0.5 px-1.5 rounded-lg text-[9px] font-bold flex items-center justify-between transition-all cursor-pointer ${
              addedItem.hasPacket
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
            title={addedItem.hasPacket ? 'Packet packing enabled' : 'Packet packing disabled'}
          >
            <span className="truncate">
              {isCustomisation && numericNoOfBoxes > 0 && packetCostPerBox > 0
                ? `Packet (+₹${numericNoOfBoxes * packetCostPerBox})`
                : `Packet: ${addedItem.hasPacket ? 'Yes' : 'No'}`}
            </span>
            {addedItem.hasPacket ? (
              <Check size={9} className="shrink-0 text-emerald-700" />
            ) : (
              <X size={9} className="shrink-0 text-slate-400" />
            )}
          </button>

          {/* Notes display on tile */}
          {(addedItem.manufacturingDescription || addedItem.packingDescription) && (
            <div
              onClick={() => onOpenQtyModal(prod, true)}
              className="pt-0.5 space-y-0.5 cursor-pointer"
              title="Click to edit notes & quantity"
            >
              {addedItem.manufacturingDescription && (
                <div className="text-[8.5px] font-medium text-amber-800 bg-amber-50/80 border border-amber-200/70 rounded px-1 py-0.2 truncate">
                  <span className="font-bold">Mfg:</span> {addedItem.manufacturingDescription}
                </div>
              )}
              {addedItem.packingDescription && (
                <div className="text-[8.5px] font-medium text-blue-800 bg-blue-50/80 border border-blue-200/70 rounded px-1 py-0.2 truncate">
                  <span className="font-bold">Pck:</span> {addedItem.packingDescription}
                </div>
              )}
            </div>
          )}
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
  const { settings: businessSettings } = useBusinessSettings();

  const editId = searchParams.get('editId') || searchParams.get('id') || '';
  const isEditMode = Boolean(editId);

  // Admin security check
  const isAdmin = Boolean(
    employeeProfile?.isSuperAdmin ||
    (user?.email && !employeeProfile) ||
    employeeProfile?.department === 'Management' ||
    employeeProfile?.department === 'Admin'
  );

  const [isEditAuthorized, setIsEditAuthorized] = useState<boolean>(() => {
    if (!editId) return true;
    return false;
  });
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);

  const { allowedDates: allowedTuesdays } = useAllowedTuesdays();

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
  const [deliveryTime, setDeliveryTime] = useState<string>('10:00 AM');
  const [mfgDate, setMfgDate] = useState<string>(initialDate || getTodayDateStr());
  const [expDeliveryDate, setExpDeliveryDate] = useState<string>(initialDate || getTodayDateStr());
  const [isSlotCapacityOpen, setIsSlotCapacityOpen] = useState<boolean>(false);

  const handleSelectSlot = (slot: SlotTime) => {
    setOrderSlot(slot);
    if (slot === '9:00 AM - 12:00 PM') setDeliveryTime('10:00 AM');
    else if (slot === '12:00 PM - 3:00 PM') setDeliveryTime('01:00 PM');
    else if (slot === '3:00 PM - 6:00 PM') setDeliveryTime('04:00 PM');
    else if (slot === '6:00 PM - 9:00 PM') setDeliveryTime('07:00 PM');
  };

  // Edit Mode Specific State
  const [isLoadingOrder, setIsLoadingOrder] = useState<boolean>(Boolean(editId));
  const [existingOrderCode, setExistingOrderCode] = useState<string>('');
  const [existingOrderTime, setExistingOrderTime] = useState<string>('');
  const [existingMfgDate, setExistingMfgDate] = useState<string>('');
  const [existingExpDeliveryDate, setExistingExpDeliveryDate] = useState<string>('');
  const [existingCreatedAt, setExistingCreatedAt] = useState<any>(null);
  const [existingPayments, setExistingPayments] = useState<any[]>([]);
  const [originalCategoryQuantities, setOriginalCategoryQuantities] = useState<Record<string, number>>({});
  const [loadedCustomisationPrices, setLoadedCustomisationPrices] = useState<{
    boxPrice?: number;
    shrinkPrice?: number;
    stickerPrice?: number;
  }>({});

  // Verify if non-admin has a valid session token for this edit session
  useEffect(() => {
    if (!editId) {
      setIsEditAuthorized(true);
      return;
    }
    if (isAdmin) {
      setIsEditAuthorized(true);
      return;
    }
    const tokenInQuery = searchParams.get('auth');
    const tokenInSession = typeof window !== 'undefined' ? sessionStorage.getItem(`order_auth_${editId}`) : null;
    if (tokenInQuery || tokenInSession) {
      setIsEditAuthorized(true);
    }
  }, [editId, isAdmin, searchParams]);

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

  // Packing Boxes Count in Customisation (multiplies by globalPackingBoxPrice)
  const [packingBoxesCount, setPackingBoxesCount] = useState<string | number>('');
  const numericPackingBoxesCount = packingBoxesCount === '' ? 0 : Math.max(0, parseInt(String(packingBoxesCount), 10) || 0);

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

  // Item Quantity Modal State
  const [qtyModalProduct, setQtyModalProduct] = useState<{
    prod: ItemMasterOption;
    existingQty?: number;
    isEdit?: boolean;
  } | null>(null);
  const [modalQuantityInput, setModalQuantityInput] = useState<string>('');
  const [modalMfgNote, setModalMfgNote] = useState<string>('');
  const [modalPckNote, setModalPckNote] = useState<string>('');

  // Slot Categories & Live Capacity Tracking
  const [slotCategories, setSlotCategories] = useState<SlotCategory[]>([]);
  const [allOrdersForCapacity, setAllOrdersForCapacity] = useState<any[]>([]);

  // Payment & Order Meta
  const [discountAmount, setDiscountAmount] = useState<string | number>('');
  const [additionalCharges, setAdditionalCharges] = useState<string | number>('');
  const [receivedAmount, setReceivedAmount] = useState<string | number>('');
  const [paymentMode, setPaymentMode] = useState<string>('UPI');
  const [isSplitPayment, setIsSplitPayment] = useState<boolean>(false);
  const [splitPayments, setSplitPayments] = useState<
    { id: string; mode: string; amount: string | number; note?: string; paidAt?: string }[]
  >([{ id: 'split-1', mode: 'UPI', amount: '', note: '' }]);
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

        setExistingOrderCode(data.code || data.orderId || '');
        setExistingOrderTime(data.orderTime || '');
        setExistingCreatedAt(data.createdAt || null);
        setExistingPayments(data.payments || []);

        const mfg = data.manufacturingDate || data.orderDate || '';
        const deliv = data.expectedDeliveryDate || data.orderDate || '';
        setExistingMfgDate(mfg);
        setExistingExpDeliveryDate(deliv);

        if (data.slot) setOrderSlot(data.slot as SlotTime);
        if (data.deliveryTime) setDeliveryTime(data.deliveryTime);
        else if (data.orderTime) setDeliveryTime(data.orderTime);
        if (mfg) setMfgDate(mfg);
        if (deliv) setExpDeliveryDate(deliv);

        const custName = data.customerName || data.wholesalerName || data.customer || '';
        const custMobile = data.customerMobile || data.customerPhone || data.wholesalerMobile || '';
        if (custName || custMobile || data.customerId) {
          setSelectedCustomer({
            id: data.customerId || data.wholesalerId || '',
            code: data.customerCode || 'CUST-000',
            name: custName || 'Customer',
            mobile: custMobile || '',
            type: (data.customerType as 'Customer' | 'Wholesaler') || (data.wholesalerId || data.wholesalerName ? 'Wholesaler' : 'Customer'),
            address: data.customerAddress || data.deliveryAddress || data.address || '',
            priceListName: data.priceListName || '',
          });
          setCustomerSearchTerm(custName ? `${custName}${custMobile ? ` (${custMobile})` : ''}` : custMobile);
        }

        setIsCustomisation(Boolean(data.isCustomisation));
        if (data.customisationDetails) {
          setNoOfBoxes(
            data.customisationDetails.noOfBoxes !== undefined
              ? data.customisationDetails.noOfBoxes
              : (data.noOfBoxes !== undefined ? data.noOfBoxes : '')
          );
          if (data.customisationDetails.packingBoxesCount !== undefined) {
            setPackingBoxesCount(data.customisationDetails.packingBoxesCount);
          } else if (data.packingBoxesCount !== undefined) {
            setPackingBoxesCount(data.packingBoxesCount);
          }
          if (data.customisationDetails.boxType) setBoxType(data.customisationDetails.boxType);
          if (data.customisationDetails.boxImageUrl) setBoxImageUrl(data.customisationDetails.boxImageUrl);
          if (data.customisationDetails.shrinkType) setShrinkType(data.customisationDetails.shrinkType);
          else if (data.customisationDetails.hasShrink) setShrinkType('Standard Shrink Wrap');
          if (data.customisationDetails.stickerType) setStickerType(data.customisationDetails.stickerType);
          else if (data.customisationDetails.hasSticker) setStickerType('Custom Brand Sticker');

          setLoadedCustomisationPrices({
            boxPrice: data.customisationDetails.boxPrice,
            shrinkPrice: data.customisationDetails.shrinkPrice,
            stickerPrice: data.customisationDetails.stickerPrice,
          });
        } else {
          setNoOfBoxes(data.noOfBoxes !== undefined ? data.noOfBoxes : '');
          if (data.packingBoxesCount !== undefined) {
            setPackingBoxesCount(data.packingBoxesCount);
          }
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
                needsManufacturing: it.needsManufacturing !== undefined ? it.needsManufacturing : true,
                mfgStatus: it.mfgStatus || (it.needsManufacturing === false ? 'Not Required' : 'Pending'),
                pckStatus: it.pckStatus || 'Pending',
              };
            })
          );
        }

        setDiscountAmount(data.discountAmount !== undefined ? String(data.discountAmount) : '');
        setAdditionalCharges(data.additionalCharges !== undefined ? String(data.additionalCharges) : '');
        
        if (data.payments && Array.isArray(data.payments) && data.payments.length > 0) {
          setExistingPayments(data.payments);
          if (data.payments.length > 1) {
            setIsSplitPayment(true);
            setSplitPayments(
              data.payments.map((p: any, idx: number) => ({
                id: p.id || `split-${idx + 1}`,
                mode: p.mode || 'UPI',
                amount: p.amount !== undefined ? String(p.amount) : '',
                note: p.note || '',
                paidAt: p.paidAt || undefined,
              }))
            );
            const totalRecv = data.payments.reduce((s: number, p: any) => s + (parseFloat(String(p.amount)) || 0), 0);
            setReceivedAmount(String(totalRecv));
          } else {
            setIsSplitPayment(false);
            setReceivedAmount(data.payments[0].amount !== undefined ? String(data.payments[0].amount) : '');
            setPaymentMode(data.payments[0].mode || data.paymentMode || 'UPI');
            setSplitPayments([
              {
                id: data.payments[0].id || 'split-1',
                mode: data.payments[0].mode || data.paymentMode || 'UPI',
                amount: data.payments[0].amount !== undefined ? String(data.payments[0].amount) : '',
                note: data.payments[0].note || '',
                paidAt: data.payments[0].paidAt || undefined,
              },
            ]);
          }
        } else {
          setReceivedAmount(data.receivedAmount !== undefined ? String(data.receivedAmount) : '');
          if (data.paymentMode) setPaymentMode(data.paymentMode);
          if (data.receivedAmount) {
            setSplitPayments([
              {
                id: 'split-1',
                mode: data.paymentMode || 'UPI',
                amount: String(data.receivedAmount),
                note: '',
              },
            ]);
          }
        }
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

  // Track original category quantities of this order in edit mode
  useEffect(() => {
    if (!editId || slotCategories.length === 0 || orderItems.length === 0) return;
    setOriginalCategoryQuantities((prev) => {
      if (Object.keys(prev).length > 0) return prev;
      const map: Record<string, number> = {};
      slotCategories.forEach((cat) => {
        const assignedIds = new Set(cat.assignedItemIds || []);
        const assignedNames = new Set((cat.assignedItemNames || []).map((n) => n.toLowerCase().trim()));
        let sum = 0;
        orderItems.forEach((it) => {
          const itId = it.itemId || '';
          const itName = (it.itemName || '').toLowerCase().trim();
          if (assignedIds.has(itId) || assignedNames.has(itName)) {
            sum += it.quantity || 0;
          }
        });
        map[cat.id] = sum;
      });
      return map;
    });
  }, [editId, slotCategories, orderItems]);

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

  // 5. Subscribe to Slot Categories & Orders for Live Slot Capacity
  useEffect(() => {
    const unsubSlotCats = onSnapshot(collection(db, 'slot_categories'), (snap) => {
      const list: SlotCategory[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name || 'Unnamed Category',
          description: data.description || '',
          color: data.color || '#02626D',
          assignedItemIds: Array.isArray(data.assignedItemIds) ? data.assignedItemIds : [],
          assignedItemNames: Array.isArray(data.assignedItemNames) ? data.assignedItemNames : [],
          slotLimits: data.slotLimits || {},
          status: data.status || 'active',
        };
      });
      setSlotCategories(list.filter((c) => c.status === 'active'));
    });

    const unsubOrders = onSnapshot(collection(db, 'orders'), (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        slot: d.data().slot || '',
        orderDate: d.data().orderDate || d.data().manufacturingDate || '',
        expectedDeliveryDate: d.data().expectedDeliveryDate || '',
        manufacturingDate: d.data().manufacturingDate || '',
        orderStatus: d.data().orderStatus || d.data().status || '',
        items: Array.isArray(d.data().items) ? d.data().items : [],
      }));
      setAllOrdersForCapacity(list);
    });

    return () => {
      unsubSlotCats();
      unsubOrders();
    };
  }, []);

  // Target date for slot capacity
  const effectiveTargetDate = expDeliveryDate || mfgDate;

  // Real-time Slot Category Capacity Calculations
  const slotCategoryCapacities = useMemo(() => {
    if (!orderSlot || slotCategories.length === 0) return [];

    // Filter active orders on this date & slot, excluding current edit order
    const relevantOrders = allOrdersForCapacity.filter((o) => {
      if (editId && o.id === editId) return false;
      if (o.orderStatus === 'Cancelled' || o.orderStatus === 'Rejected') return false;
      if (o.slot !== orderSlot) return false;

      const oDate = o.expectedDeliveryDate || o.manufacturingDate || o.orderDate;
      return oDate === effectiveTargetDate;
    });

    return slotCategories.map((cat) => {
      const maxLimit = cat.slotLimits?.[orderSlot] || 0;
      const assignedIds = new Set(cat.assignedItemIds || []);
      const assignedNames = new Set((cat.assignedItemNames || []).map((n) => n.toLowerCase()));

      // 1. Calculate booked qty across all other orders
      let bookedQty = 0;
      relevantOrders.forEach((o) => {
        (o.items || []).forEach((it: any) => {
          const itId = it.itemId || it.id || '';
          const itName = (it.itemName || it.name || '').toLowerCase();
          if (assignedIds.has(itId) || assignedNames.has(itName)) {
            const q = parseFloat(String(it.quantity || it.qty || 0)) || 0;
            bookedQty += q;
          }
        });
      });

      // 2. Calculate current order qty in progress
      let currentOrderQty = 0;
      orderItems.forEach((it) => {
        const itId = it.itemId || '';
        const itName = (it.itemName || '').toLowerCase();
        if (assignedIds.has(itId) || assignedNames.has(itName)) {
          currentOrderQty += it.quantity || 0;
        }
      });

      const totalProjected = bookedQty + currentOrderQty;
      const remainingBeforeCurrent = maxLimit > 0 ? Math.max(0, maxLimit - bookedQty) : Infinity;
      const remainingAfterCurrent = maxLimit > 0 ? maxLimit - totalProjected : Infinity;
      const isExceeded = maxLimit > 0 && totalProjected > maxLimit;
      const percentUsed = maxLimit > 0 ? Math.min(100, Math.round((totalProjected / maxLimit) * 100)) : 0;

      return {
        id: cat.id,
        name: cat.name,
        color: cat.color || '#02626D',
        maxLimit,
        bookedQty: Math.round(bookedQty * 100) / 100,
        currentOrderQty: Math.round(currentOrderQty * 100) / 100,
        totalProjected: Math.round(totalProjected * 100) / 100,
        remainingBeforeCurrent: remainingBeforeCurrent !== Infinity ? Math.round(remainingBeforeCurrent * 100) / 100 : Infinity,
        remainingAfterCurrent: remainingAfterCurrent !== Infinity ? Math.round(remainingAfterCurrent * 100) / 100 : Infinity,
        isExceeded,
        percentUsed,
        hasLimit: maxLimit > 0,
      };
    });
  }, [slotCategories, allOrdersForCapacity, orderSlot, effectiveTargetDate, orderItems, editId]);

  // Active Utilities
  const activeBoxes = useMemo(() => utilitiesMaster.filter((u) => u.type === 'box' && u.status === 'Active'), [utilitiesMaster]);
  const activeShrinks = useMemo(() => utilitiesMaster.filter((u) => u.type === 'shrink' && u.status === 'Active'), [utilitiesMaster]);
  const activeStickers = useMemo(() => utilitiesMaster.filter((u) => u.type === 'sticker' && u.status === 'Active'), [utilitiesMaster]);

  const selectedBoxObj = activeBoxes.find((b) => b.name === boxType);
  const selectedBoxPrice = selectedBoxObj?.price ?? loadedCustomisationPrices.boxPrice ?? 0;
  const selectedShrinkObj = activeShrinks.find((s) => s.name === shrinkType);
  const selectedShrinkPrice = shrinkType === 'None' ? 0 : (selectedShrinkObj?.price ?? loadedCustomisationPrices.shrinkPrice ?? 0);
  const selectedStickerObj = activeStickers.find((st) => st.name === stickerType);
  const selectedStickerPrice = stickerType === 'None' ? 0 : (selectedStickerObj?.price ?? loadedCustomisationPrices.stickerPrice ?? 0);

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

  // Track authorized slot category overrides for this session
  const [authorizedSlotCategoryIds, setAuthorizedSlotCategoryIds] = useState<Set<string>>(new Set());
  const [slotOverrideModalData, setSlotOverrideModalData] = useState<SlotLimitOverrideData | null>(null);

  // Helper to check if adding/increasing quantity for an item exceeds its slot category capacity
  const checkSlotExceeded = useCallback(
    (
      prodId: string,
      prodName: string,
      proposedQty: number
    ): {
      isExceeded: boolean;
      cat?: SlotCategory;
      maxLimit: number;
      bookedQty: number;
      currentOtherQty: number;
    } => {
      if (!orderSlot || slotCategories.length === 0) {
        return { isExceeded: false, maxLimit: 0, bookedQty: 0, currentOtherQty: 0 };
      }

      const pNameLower = prodName.toLowerCase().trim();
      const cat = slotCategories.find((c) => {
        const ids = c.assignedItemIds || [];
        const names = (c.assignedItemNames || []).map((n) => n.toLowerCase().trim());
        return ids.includes(prodId) || names.includes(pNameLower);
      });

      if (!cat) return { isExceeded: false, maxLimit: 0, bookedQty: 0, currentOtherQty: 0 };

      const maxLimit = cat.slotLimits?.[orderSlot] || 0;
      if (maxLimit <= 0) return { isExceeded: false, maxLimit: 0, bookedQty: 0, currentOtherQty: 0 };

      // If already authorized in this session for this category, don't re-prompt
      if (authorizedSlotCategoryIds.has(cat.id)) {
        return { isExceeded: false, cat, maxLimit, bookedQty: 0, currentOtherQty: 0 };
      }

      // Calculate bookedQty in other orders for this slot & date
      const relevantOrders = allOrdersForCapacity.filter((o) => {
        if (editId && o.id === editId) return false;
        if (o.orderStatus === 'Cancelled' || o.orderStatus === 'Rejected') return false;
        if (o.slot !== orderSlot) return false;
        const oDate = o.expectedDeliveryDate || o.manufacturingDate || o.orderDate;
        return oDate === effectiveTargetDate;
      });

      const assignedIds = new Set(cat.assignedItemIds || []);
      const assignedNames = new Set((cat.assignedItemNames || []).map((n) => n.toLowerCase().trim()));

      let bookedQty = 0;
      relevantOrders.forEach((o) => {
        (o.items || []).forEach((it: any) => {
          const itId = it.itemId || it.id || '';
          const itName = (it.itemName || it.name || '').toLowerCase().trim();
          if (assignedIds.has(itId) || assignedNames.has(itName)) {
            const q = parseFloat(String(it.quantity || it.qty || 0)) || 0;
            bookedQty += q;
          }
        });
      });

      // Calculate quantity of other items in the CURRENT order belonging to this category
      let currentOtherQty = 0;
      orderItems.forEach((it) => {
        if (it.itemId === prodId) return; // exclude this item
        const itId = it.itemId || '';
        const itName = (it.itemName || '').toLowerCase().trim();
        if (assignedIds.has(itId) || assignedNames.has(itName)) {
          currentOtherQty += it.quantity || 0;
        }
      });

      const totalProjected = bookedQty + currentOtherQty + proposedQty;
      const isExceeded = totalProjected > maxLimit;

      return {
        isExceeded,
        cat,
        maxLimit,
        bookedQty: Math.round(bookedQty * 100) / 100,
        currentOtherQty: Math.round(currentOtherQty * 100) / 100,
      };
    },
    [orderSlot, slotCategories, allOrdersForCapacity, effectiveTargetDate, editId, orderItems, authorizedSlotCategoryIds]
  );

  // Callback when OTP authorization succeeds for a slot limit override
  const handleSlotOverrideAuthorized = (authData: SlotLimitOverrideData) => {
    setAuthorizedSlotCategoryIds((prev) => new Set([...prev, authData.categoryId]));

    if (!authData.itemId) {
      toast.success('Capacity Override Approved', `Slot limit override for "${authData.categoryName}" authorized.`);
      return;
    }

    setOrderItems((prev) => {
      const existing = prev.find((it) => it.itemId === authData.itemId);
      if (existing) {
        return prev.map((it) =>
          it.itemId === authData.itemId
            ? {
                ...it,
                quantity: authData.requestedQty,
                lineTotal: Math.round(authData.requestedQty * it.unitPrice * 100) / 100,
                manufacturingDescription: authData.manufacturingDescription !== undefined ? authData.manufacturingDescription : it.manufacturingDescription,
                packingDescription: authData.packingDescription !== undefined ? authData.packingDescription : it.packingDescription,
              }
            : it
        );
      } else {
        const uniqueLineId = `line-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        return [
          ...prev,
          {
            lineId: uniqueLineId,
            itemId: authData.itemId,
            itemCode: authData.itemCode || 'ITEM',
            itemName: authData.itemName,
            category: 'General',
            unit: authData.unit || 'KG',
            imageUrl: authData.imageUrl || '',
            unitPrice: authData.unitPrice,
            quantity: authData.requestedQty,
            lineTotal: Math.round(authData.requestedQty * authData.unitPrice * 100) / 100,
            hasPacket: false,
            packetCharge: 0,
            manufacturingDescription: authData.manufacturingDescription || '',
            packingDescription: authData.packingDescription || '',
          },
        ];
      }
    });
  };

  // Quantity Modal Open & Save Handlers
  const handleOpenQtyModal = useCallback((prod: ItemMasterOption, isEdit: boolean) => {
    const existing = orderItems.find((it) => it.itemId === prod.id);
    setQtyModalProduct({
      prod,
      existingQty: existing?.quantity,
      isEdit,
    });
    // By default for new items, do NOT pre-fill any number like 1!
    setModalQuantityInput(isEdit && existing?.quantity ? String(existing.quantity) : '');
    setModalMfgNote(existing?.manufacturingDescription || '');
    setModalPckNote(existing?.packingDescription || '');
  }, [orderItems]);

  const handleSaveModalQuantity = useCallback(() => {
    if (!qtyModalProduct) return;
    const qtyVal = parseFloat(modalQuantityInput);
    if (!qtyVal || qtyVal <= 0 || isNaN(qtyVal)) {
      toast.error('Invalid Quantity', 'Please enter a valid quantity greater than 0.');
      return;
    }

    const { prod } = qtyModalProduct;

    // Check slot capacity limit
    const check = checkSlotExceeded(prod.id, prod.name, qtyVal);
    if (check.isExceeded && check.cat) {
      setQtyModalProduct(null);
      setModalQuantityInput('');
      setModalMfgNote('');
      setModalPckNote('');
      setSlotOverrideModalData({
        categoryId: check.cat.id,
        categoryName: check.cat.name,
        itemId: prod.id,
        itemCode: prod.code,
        itemName: prod.name,
        unit: prod.unit || 'KG',
        unitPrice: prod.price,
        imageUrl: prod.imageUrl || '',
        requestedQty: qtyVal,
        slot: orderSlot,
        date: effectiveTargetDate || 'Selected Date',
        maxLimit: check.maxLimit,
        bookedQty: check.bookedQty,
        manufacturingDescription: modalMfgNote.trim(),
        packingDescription: modalPckNote.trim(),
      });
      return;
    }

    // Capacity is available: Add or update item
    const existing = orderItems.find((it) => it.itemId === prod.id);
    if (existing) {
      setOrderItems((prev) =>
        prev.map((it) => {
          if (it.itemId !== prod.id) return it;
          return {
            ...it,
            quantity: qtyVal,
            lineTotal: Math.round(qtyVal * it.unitPrice * 100) / 100,
            manufacturingDescription: modalMfgNote.trim(),
            packingDescription: modalPckNote.trim(),
          };
        })
      );
      toast.success('Quantity Updated', `Updated ${prod.name} quantity to ${qtyVal} ${prod.unit}.`);
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
        quantity: qtyVal,
        lineTotal: Math.round(qtyVal * prod.price * 100) / 100,
        hasPacket: false,
        packetCharge: 0,
        manufacturingDescription: modalMfgNote.trim(),
        packingDescription: modalPckNote.trim(),
      };
      setOrderItems((prev) => [...prev, newLine]);
      toast.success('Item Added', `Added ${qtyVal} ${prod.unit} of ${prod.name}.`);
    }

    setQtyModalProduct(null);
    setModalQuantityInput('');
    setModalMfgNote('');
    setModalPckNote('');
  }, [qtyModalProduct, modalQuantityInput, modalMfgNote, modalPckNote, checkSlotExceeded, orderItems, orderSlot, effectiveTargetDate]);

  // Inline Note Changer for Cart Items
  const handleItemNoteChange = useCallback((itemId: string, type: 'mfg' | 'pck', val: string) => {
    setOrderItems((prev) =>
      prev.map((it) => {
        if (it.itemId !== itemId) return it;
        return {
          ...it,
          manufacturingDescription: type === 'mfg' ? val : it.manufacturingDescription,
          packingDescription: type === 'pck' ? val : it.packingDescription,
        };
      })
    );
  }, []);

  // Summary Quantity Modifier
  const handleSummaryQuantityChange = useCallback((itemId: string, newQty: number) => {
    const safeQty = Math.max(0, Math.round(newQty * 100) / 100);

    if (safeQty <= 0) {
      setOrderItems((prev) => prev.filter((it) => it.itemId !== itemId));
      return;
    }

    const prod = itemsMaster.find((p) => p.id === itemId);
    const existingItem = orderItems.find((it) => it.itemId === itemId);

    if (safeQty > (existingItem?.quantity || 0) && prod) {
      const check = checkSlotExceeded(prod.id, prod.name, safeQty);
      if (check.isExceeded && check.cat) {
        setSlotOverrideModalData({
          categoryId: check.cat.id,
          categoryName: check.cat.name,
          itemId: prod.id,
          itemCode: prod.code,
          itemName: prod.name,
          unit: prod.unit || 'KG',
          unitPrice: prod.price,
          imageUrl: prod.imageUrl || '',
          requestedQty: safeQty,
          slot: orderSlot,
          date: effectiveTargetDate || 'Selected Date',
          maxLimit: check.maxLimit,
          bookedQty: check.bookedQty,
        });
        return;
      }
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
  }, [itemsMaster, orderItems, checkSlotExceeded, orderSlot, effectiveTargetDate]);

  const handleSummaryRemoveItem = useCallback((itemId: string) => {
    setOrderItems((prev) => prev.filter((it) => it.itemId !== itemId));
  }, []);

  const handleToggleItemPacket = useCallback((itemId: string) => {
    setOrderItems((prev) =>
      prev.map((item) => {
        if (item.itemId !== itemId) return item;
        const nextPacket = !item.hasPacket;
        return {
          ...item,
          hasPacket: nextPacket,
          packetCharge: nextPacket ? 5 : 0,
        };
      })
    );
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
  const customPackingBoxesTotal = isCustomisation ? Math.max(0, numericPackingBoxesCount) * (globalSettings.globalPackingBoxPrice || 0) : 0;
  const stickerChargesTotal = isCustomisation && stickerType !== 'None' ? Math.max(0, numericNoOfBoxes) * selectedStickerPrice : 0;
  const shrinkChargesTotal = isCustomisation && shrinkType !== 'None' ? Math.max(0, numericNoOfBoxes) * selectedShrinkPrice : 0;

  const pCharges = !isCustomisation ? Math.max(0, numericNoOfBoxes) * (globalSettings.globalPackingBoxPrice || 0) : 0;
  const addCharges = parseFloat(String(additionalCharges)) || 0;
  const transportChargesVal = isTransportRequired ? (parseFloat(String(transportCharges)) || 0) : 0;
  const discountVal = parseFloat(String(discountAmount)) || 0;

  const baseBeforeTax = isCustomisation
    ? Math.max(0, subTotal + boxChargesTotal + customPackingBoxesTotal + stickerChargesTotal + shrinkChargesTotal + packetChargesTotal + transportChargesVal + addCharges - discountVal)
    : Math.max(0, subTotal + pCharges + addCharges + transportChargesVal - discountVal);

  const taxCalculation = calculateTax(baseBeforeTax, businessSettings);
  const grandTotal = taxCalculation.finalAmount;

  // Compute total received from splits
  const splitTotalReceived = useMemo(() => {
    return splitPayments.reduce((sum, item) => sum + (parseFloat(String(item.amount)) || 0), 0);
  }, [splitPayments]);

  const effectiveReceivedAmount = isSplitPayment
    ? splitTotalReceived
    : (parseFloat(String(receivedAmount)) || 0);

  // Auto Payment Status calculation
  useEffect(() => {
    const recv = effectiveReceivedAmount;
    if (recv <= 0) {
      setPaymentStatus('Pending');
    } else if (recv >= grandTotal && grandTotal > 0) {
      setPaymentStatus('Completed');
    } else {
      setPaymentStatus('Partial');
    }
  }, [effectiveReceivedAmount, grandTotal]);

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
    if (obj === undefined) return null;
    if (obj === null || typeof obj !== 'object') return obj;

    // Preserve Firestore FieldValue sentinels (serverTimestamp, deleteField, etc.)
    if (obj.constructor && obj.constructor.name === 'FieldValueImpl') return obj;
    if (obj._methodName !== undefined) return obj;

    // Preserve Dates and Timestamps
    if (obj instanceof Date) return obj;
    if (typeof obj.toDate === 'function') return obj;

    if (Array.isArray(obj)) {
      return obj.filter((val) => val !== undefined).map(sanitizeForFirestore);
    }

    const clean: Record<string, any> = {};
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (val !== undefined) {
        clean[key] = sanitizeForFirestore(val);
      }
    }
    return clean;
  };

  // Submit Order Creation
  const handleCreateOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) {
      toast.warning('Customer Required', 'Customer selection is mandatory. Please search and select or add a customer to proceed.');
      const custEl = document.getElementById('customer-search-input');
      if (custEl) {
        custEl.focus();
        custEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
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

    // Slot Category Capacity Enforcement
    for (const cap of slotCategoryCapacities) {
      if (cap.hasLimit && cap.isExceeded && cap.currentOrderQty > 0) {
        // In Edit Mode, if the category quantity was NOT increased, do not block
        const origCatQty = originalCategoryQuantities[cap.id] || 0;
        const netIncrease = cap.currentOrderQty - origCatQty;
        if (isEditMode && netIncrease <= 0) {
          continue;
        }

        if (!authorizedSlotCategoryIds.has(cap.id)) {
          // Open the override modal with category details so the manager can enter OTP
          setSlotOverrideModalData({
            categoryId: cap.id,
            categoryName: cap.name,
            itemId: '',
            itemCode: '',
            itemName: `${cap.name} (Total ${cap.currentOrderQty} KG)`,
            unit: 'KG',
            unitPrice: 0,
            imageUrl: '',
            requestedQty: cap.currentOrderQty,
            slot: orderSlot,
            date: effectiveTargetDate || 'Selected Date',
            maxLimit: cap.maxLimit,
            bookedQty: cap.bookedQty,
          });
          toast.error(
            'Slot Category Limit Exceeded',
            `"${cap.name}" maximum allowed limit for ${orderSlot} is ${cap.maxLimit} KG. Total requested: ${cap.totalProjected} KG. Please get Manager OTP authorization to proceed.`
          );
          return;
        }
      }
    }

    const recv = effectiveReceivedAmount;
    if (recv > grandTotal && grandTotal > 0) {
      if (isEditMode) {
        toast.warning(
          'Total Less Than Received Amount',
          `The updated order total (₹${grandTotal.toFixed(2)}) is less than the received payment (₹${recv.toFixed(2)}). Please issue a refund or credit note if necessary.`
        );
      } else {
        toast.error('Invalid Payment Amount', `Received amount (₹${recv}) cannot exceed the order total of ₹${grandTotal.toFixed(2)}.`);
        return;
      }
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

    const isBlockedTuesdayDate = (dateStr: string) => {
      if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
      const [y, m, d] = dateStr.split('-').map(Number);
      const isTue = new Date(y, m - 1, d).getDay() === 2;
      if (!isTue) return false;
      // If Tuesday is explicitly enabled in Overrides, allow it!
      return !allowedTuesdays.includes(dateStr);
    };

    if (isBlockedTuesdayDate(mfgDate) && (!isEditMode || mfgDate !== existingMfgDate)) {
      toast.warning('Tuesday Blocked', 'Manufacturing Date cannot fall on Tuesday (Factory Closed). To allow this date, enable it in Tuesday Overrides.');
      return;
    }
    if (isBlockedTuesdayDate(expDeliveryDate) && (!isEditMode || expDeliveryDate !== existingExpDeliveryDate)) {
      toast.warning('Tuesday Blocked', 'Expected Delivery Date cannot fall on Tuesday (Store Closed). To allow this date, enable it in Tuesday Overrides.');
      return;
    }

    // Guard: Non-admin editing an order requires OTP authorization
    if (isEditMode && !isAdmin && !isEditAuthorized) {
      const tokenInQuery = searchParams.get('auth');
      const tokenInSession = typeof window !== 'undefined' ? sessionStorage.getItem(`order_auth_${editId}`) : null;
      if (!tokenInQuery && !tokenInSession) {
        setAuthModalOpen(true);
        toast.warning(
          'Admin Authorization Required',
          'An administrator OTP code is required before saving changes to this order.'
        );
        return;
      } else {
        setIsEditAuthorized(true);
      }
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

      const validSplits = splitPayments
        .filter((s) => (parseFloat(String(s.amount)) || 0) > 0)
        .map((s, idx) => ({
          id: s.id || `pay-${Date.now()}-${idx}`,
          mode: s.mode || 'UPI',
          amount: parseFloat(String(s.amount)) || 0,
          note: s.note || (isSplitPayment ? 'Split payment' : 'Advance payment'),
          paidAt: (s as any).paidAt || new Date().toISOString(),
        }));

      const finalPayments = isSplitPayment
        ? validSplits
        : (recv > 0
            ? [
                {
                  id: (existingPayments[0] && existingPayments.length === 1) ? existingPayments[0].id : `pay-${Date.now()}`,
                  mode: paymentMode,
                  amount: recv,
                  note: (existingPayments[0] && existingPayments.length === 1 && existingPayments[0].note) || (isEditMode ? 'Payment on Order' : 'Initial payment'),
                  paidAt: (existingPayments[0] && existingPayments.length === 1 && existingPayments[0].paidAt) || new Date().toISOString(),
                },
              ]
            : []);

      const finalPaymentMode = isSplitPayment && finalPayments.length > 1
        ? `Split (${finalPayments.map((p) => p.mode).join(', ')})`
        : (finalPayments[0]?.mode || paymentMode || 'UPI');

      if (editId) {
        // Update existing order
        await updateDoc(doc(db, 'orders', editId), sanitizeForFirestore({
          customerName: selectedCustomer.name,
          customerMobile: selectedCustomer.mobile,
          customerId: selectedCustomer.id,
          customerType: selectedCustomer.type,
          customerAddress: selectedCustomer.address || '',
          slot: orderSlot,
          orderTime: deliveryTime || existingOrderTime || timeStr,
          deliveryTime: deliveryTime || existingOrderTime || timeStr,
          orderDate: mfgDate || targetOrderDate,
          manufacturingDate: mfgDate,
          expectedDeliveryDate: expDeliveryDate,
          isCustomisation: isCustomisation,
          customisationDetails: isCustomisation
            ? {
                noOfBoxes: savedNoOfBoxes,
                packingBoxesCount: numericPackingBoxesCount,
                packingBoxPrice: globalSettings.globalPackingBoxPrice || 0,
                packingBoxesTotal: customPackingBoxesTotal,
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
          items: validItems.map((item) => ({
            lineId: item.lineId || `line-${Date.now()}`,
            itemId: item.itemId || '',
            itemCode: item.itemCode || '',
            itemName: item.itemName,
            category: item.category || 'General',
            unit: item.unit || 'KG',
            imageUrl: item.imageUrl || '',
            unitPrice: item.unitPrice || 0,
            quantity: item.quantity || 1,
            lineTotal: item.lineTotal || 0,
            hasPacket: Boolean(item.hasPacket),
            packetCharge: item.hasPacket ? (item.packetCharge || 5) : 0,
            manufacturingDescription: item.manufacturingDescription || '',
            packingDescription: item.packingDescription || '',
            needsManufacturing: item.needsManufacturing !== undefined ? item.needsManufacturing : true,
            mfgStatus: item.mfgStatus || (item.needsManufacturing === false ? 'Not Required' : 'Pending'),
            pckStatus: item.pckStatus || 'Pending',
          })),
          totalItems: validItems.length,
          subTotal: taxCalculation.taxType === 'inclusive' ? taxCalculation.taxableAmount : subTotal,
          itemsTotal: subTotal,
          noOfBoxes: savedNoOfBoxes,
          packingBoxesCount: isCustomisation ? numericPackingBoxesCount : savedNoOfBoxes,
          globalPackingBoxPrice: globalSettings.globalPackingBoxPrice || 0,
          boxChargesTotal: isCustomisation ? boxChargesTotal : 0,
          customPackingBoxesTotal: isCustomisation ? customPackingBoxesTotal : 0,
          stickerChargesTotal: isCustomisation ? stickerChargesTotal : 0,
          shrinkChargesTotal: isCustomisation ? shrinkChargesTotal : 0,
          packetChargesTotal: packetChargesTotal,
          packingCharges: isCustomisation ? customPackingBoxesTotal : pCharges,
          additionalCharges: addCharges,
          discountAmount: discountVal,
          taxableAmount: taxCalculation.taxableAmount,
          tax: taxCalculation.totalTax,
          cgstAmount: taxCalculation.cgstAmount,
          sgstAmount: taxCalculation.sgstAmount,
          cgstPercent: taxCalculation.cgstPercent,
          sgstPercent: taxCalculation.sgstPercent,
          totalGstPercent: taxCalculation.totalGstPercent,
          taxType: taxCalculation.taxType,
          totalAmount: grandTotal,
          receivedAmount: recv,
          paymentMode: finalPaymentMode,
          paymentStatus: paymentStatus,
          payments: finalPayments.length > 0 ? finalPayments : existingPayments,
          orderStatus: orderStatus,
          updatedBy: creatorName,
          updatedById: creatorId,
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
        orderTime: deliveryTime || timeStr,
        deliveryTime: deliveryTime || timeStr,
        orderDate: targetOrderDate,
        manufacturingDate: mfgDate,
        expectedDeliveryDate: expDeliveryDate,
        isCustomisation: isCustomisation,
        customisationDetails: isCustomisation
          ? {
              noOfBoxes: savedNoOfBoxes,
              packingBoxesCount: numericPackingBoxesCount,
              packingBoxPrice: globalSettings.globalPackingBoxPrice || 0,
              packingBoxesTotal: customPackingBoxesTotal,
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
        subTotal: taxCalculation.taxType === 'inclusive' ? taxCalculation.taxableAmount : subTotal,
        itemsTotal: subTotal,
        noOfBoxes: savedNoOfBoxes,
        packingBoxesCount: isCustomisation ? numericPackingBoxesCount : savedNoOfBoxes,
        globalPackingBoxPrice: globalSettings.globalPackingBoxPrice || 0,
        boxChargesTotal: isCustomisation ? boxChargesTotal : 0,
        customPackingBoxesTotal: isCustomisation ? customPackingBoxesTotal : 0,
        stickerChargesTotal: isCustomisation ? stickerChargesTotal : 0,
        shrinkChargesTotal: isCustomisation ? shrinkChargesTotal : 0,
        packetChargesTotal: packetChargesTotal,
        packingCharges: isCustomisation ? customPackingBoxesTotal : pCharges,
        additionalCharges: addCharges,
        discountAmount: discountVal,
        taxableAmount: taxCalculation.taxableAmount,
        tax: taxCalculation.totalTax,
        cgstAmount: taxCalculation.cgstAmount,
        sgstAmount: taxCalculation.sgstAmount,
        cgstPercent: taxCalculation.cgstPercent,
        sgstPercent: taxCalculation.sgstPercent,
        totalGstPercent: taxCalculation.totalGstPercent,
        taxType: taxCalculation.taxType,
        totalAmount: grandTotal,
        receivedAmount: recv,
        paymentMode: finalPaymentMode,
        paymentStatus: paymentStatus,
        payments: finalPayments,
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

      {/* ── MAIN CONTENT WORKSPACE (3-COLUMN LAYOUT) ───────────────────────── */}
      <div className="w-full px-2.5 sm:px-4 lg:px-6 pt-3 pb-8">
        <form noValidate onSubmit={handleCreateOrderSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 lg:gap-4.5 items-start">
          
          {/* ── 1. LEFT COLUMN: SLOTS, DATES & TIMES, CUSTOMER, CAPACITY, PRODUCT CATALOG ── */}
          <div className="lg:col-span-8 xl:col-span-8 space-y-3.5">
            
            {/* Top Order Configuration Card: Slots, Dates, Customer, Slot Capacity */}
            <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200/90 shadow-2xs space-y-3.5">
              
              {/* 1.1 Four Slots at the Top */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
                    <Clock size={14} className="text-[#02626D]" />
                    <span>Delivery Slot</span>
                  </label>
                  <span className="text-[10px] font-mono font-bold text-[#02626D] bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                    Selected: {orderSlot}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {ALL_SLOTS.map((slot) => {
                    const isSelected = orderSlot === slot;
                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => handleSelectSlot(slot)}
                        className={`h-9.5 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer select-none ${
                          isSelected
                            ? 'bg-[#02626D] text-white shadow-xs ring-2 ring-[#02626D]/30'
                            : 'bg-[#f7f7f8] hover:bg-slate-100 text-slate-700 border border-slate-200/80'
                        }`}
                      >
                        <span className="flex items-center gap-1.5 truncate">
                          <Clock size={12} className={isSelected ? 'text-white' : 'text-slate-400'} />
                          <span className="truncate text-[11px] sm:text-xs">{slot}</span>
                        </span>
                        {isSelected && <Check size={12} className="text-white shrink-0 ml-1" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 1.2 Delivery Date, Delivery Time & Customer Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2.5 border-t border-slate-100 items-start">
                {/* Expected Delivery Date */}
                <div className="sm:col-span-3">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Delivery Date <span className="text-rose-500">*</span>
                  </label>
                  <CustomDatePicker
                    value={expDeliveryDate}
                    onChange={(val) => {
                      setExpDeliveryDate(val);
                      setMfgDate(val);
                    }}
                    placeholder="Select Date"
                    blockTuesdays={true}
                    allowedTuesdays={allowedTuesdays}
                    className="w-full"
                  />
                  {allowedTuesdays.includes(expDeliveryDate) ? (
                    <span className="text-[9.5px] text-emerald-600 font-bold mt-0.5 block flex items-center gap-1">
                      ✓ Special Tuesday Enabled
                    </span>
                  ) : (
                    <span className="text-[9.5px] text-slate-400 mt-0.5 block">Store closed on Tuesdays</span>
                  )}
                </div>

                {/* Specific Delivery Time (1-hr interval) */}
                <div className="sm:col-span-3">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Delivery Time <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={deliveryTime}
                    onChange={(e) => setDeliveryTime(e.target.value)}
                    className="w-full h-8.5 px-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 bg-[#f7f7f8] focus:bg-white focus:outline-none focus:border-[#02626D] shadow-2xs cursor-pointer"
                  >
                    {DELIVERY_TIME_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <span className="text-[9.5px] text-slate-400 mt-0.5 block">1-hr time slot</span>
                </div>

                {/* Customer Selection */}
                <div className="sm:col-span-6 space-y-1">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      <UserCheck size={13} className="text-[#02626D]" />
                      <span>Customer Selection</span>
                      <span className="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsAddCustomerModalOpen(true)}
                      className="text-[11px] font-bold text-[#02626D] hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      <Plus size={12} />
                      <span>New</span>
                    </button>
                  </div>

                  {selectedCustomer ? (
                    <div className="h-8.5 px-2.5 rounded-xl bg-teal-50/70 border border-teal-200/90 flex items-center justify-between gap-2 shadow-2xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-5 h-5 rounded-md bg-[#02626D] text-white font-black text-[10px] flex items-center justify-center shrink-0">
                          {selectedCustomer.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-extrabold text-xs text-slate-900 truncate max-w-[130px] sm:max-w-[170px]">{selectedCustomer.name}</span>
                          <span className="text-[8.5px] font-bold px-1.5 py-0.2 rounded bg-[#02626D] text-white uppercase shrink-0">
                            {selectedCustomer.type}
                          </span>
                          <span className="text-[10px] text-slate-500 truncate hidden md:inline">
                            {selectedCustomer.mobile || 'No mobile'}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCustomer(null);
                          setCustomerSearchTerm('');
                        }}
                        className="text-[10px] font-bold text-slate-500 hover:text-red-600 px-2 py-0.5 rounded-md border border-slate-300 hover:border-red-200 bg-white transition-colors cursor-pointer shrink-0 shadow-2xs"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <div className="relative" ref={customerSearchRef}>
                      <div className="relative">
                        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                          id="customer-search-input"
                          type="text"
                          placeholder="Search customer name or mobile..."
                          value={customerSearchTerm}
                          onChange={(e) => {
                            setCustomerSearchTerm(e.target.value);
                            setIsCustomerDropdownOpen(true);
                          }}
                          onFocus={() => setIsCustomerDropdownOpen(true)}
                          className="w-full pl-8 pr-3 h-8.5 text-xs border border-slate-300 rounded-xl bg-[#f7f7f8] focus:bg-white focus:outline-none focus:border-[#02626D] font-medium shadow-2xs"
                        />
                      </div>

                      {/* Customer Dropdown Results */}
                      {isCustomerDropdownOpen && (
                        <div className="absolute left-0 right-0 top-full mt-1.5 max-h-52 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl z-30 divide-y divide-slate-100 no-scrollbar">
                          {filteredCustomers.length === 0 ? (
                            <div className="p-3 text-center text-xs text-slate-400">
                              No customer found.{' '}
                              <button
                                type="button"
                                onClick={() => setIsAddCustomerModalOpen(true)}
                                className="text-[#02626D] font-bold underline ml-1"
                              >
                                Add New
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
                                  <p className="text-[10px] text-slate-400">{cust.mobile} • {cust.code}</p>
                                </div>
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                  {cust.type}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  <span className="text-[9.5px] text-slate-400 mt-0.5 block">Search name or mobile</span>
                </div>
              </div>

              {/* 1.4 Down Button: Display/Hide Slot Capacity */}
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsSlotCapacityOpen((prev) => !prev)}
                  className={`w-full py-2 px-3 rounded-xl border flex items-center justify-between text-xs font-bold transition-all cursor-pointer select-none ${
                    isSlotCapacityOpen
                      ? 'bg-teal-50/70 border-teal-200 text-[#02626D]'
                      : 'bg-slate-50/80 hover:bg-slate-100/80 border-slate-200/90 text-slate-700 shadow-2xs'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${
                      isSlotCapacityOpen ? 'bg-[#02626D] text-white' : 'bg-[#02626D]/10 text-[#02626D]'
                    }`}>
                      <Layers size={13} />
                    </div>
                    <div className="flex items-center gap-2">
                      <span>Slot Capacity ({orderSlot})</span>
                      {slotCategoryCapacities.length > 0 && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white text-slate-600 border border-slate-200">
                          {slotCategoryCapacities.length} {slotCategoryCapacities.length === 1 ? 'category' : 'categories'}
                        </span>
                      )}
                      {slotCategoryCapacities.some((c) => c.isExceeded) && (
                        <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-200 animate-pulse">
                          Exceeded
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-slate-400">
                    <span className="text-[11px] font-semibold text-slate-500">
                      {isSlotCapacityOpen ? 'Hide' : 'View'} Details
                    </span>
                    <ChevronDown
                      size={15}
                      className={`transition-transform duration-200 ${isSlotCapacityOpen ? 'rotate-180 text-[#02626D]' : 'text-slate-400'}`}
                    />
                  </div>
                </button>

                {/* Collapsible Slot Capacity Content */}
                {isSlotCapacityOpen && (
                  <div className="mt-2.5 p-3 bg-slate-50/60 rounded-xl border border-slate-200/90 space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700 border-b border-slate-200/80 pb-1.5">
                      <span className="flex items-center gap-1.5 text-[#02626D]">
                        <Layers size={13} />
                        <span>Active Category Capacity Limits</span>
                      </span>
                      <Link
                        href="/slot-categories"
                        target="_blank"
                        className="text-[10.5px] text-[#02626D] hover:underline font-bold"
                      >
                        Manage Limits
                      </Link>
                    </div>

                    {slotCategoryCapacities.length === 0 ? (
                      <p className="text-xs text-slate-400 py-1 italic">No slot category limits configured for this slot.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {slotCategoryCapacities.map((cap) => (
                          <div
                            key={cap.id}
                            className={`p-2.5 rounded-xl border text-[11px] ${
                              cap.isExceeded
                                ? 'border-rose-300 bg-rose-50/70 text-rose-900 shadow-2xs'
                                : 'border-slate-200 bg-white text-slate-800 shadow-2xs'
                            }`}
                          >
                            <div className="flex items-center justify-between font-bold">
                              <span className="truncate max-w-[120px]" style={{ color: cap.color }}>
                                {cap.name}
                              </span>
                              {cap.hasLimit ? (
                                <span className={cap.isExceeded ? 'text-rose-600 font-black' : 'text-slate-700 font-bold'}>
                                  {cap.remainingAfterCurrent < 0
                                    ? `${Math.abs(cap.remainingAfterCurrent)}KG Over!`
                                    : `${cap.remainingAfterCurrent}KG Left`}
                                </span>
                              ) : (
                                <span className="text-slate-400 text-[10px]">No Limit</span>
                              )}
                            </div>
                            {cap.hasLimit && (
                              <>
                                <div className="w-full bg-slate-200 rounded-full h-1.5 mt-1.5 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      cap.isExceeded
                                        ? 'bg-rose-500'
                                        : cap.percentUsed >= 80
                                        ? 'bg-amber-500'
                                        : 'bg-[#02626D]'
                                    }`}
                                    style={{ width: `${Math.min(100, cap.percentUsed)}%` }}
                                  />
                                </div>
                                <div className="flex justify-between text-[9.5px] text-slate-500 mt-1">
                                  <span>Used: {cap.totalProjected.toFixed(1)}KG</span>
                                  <span>Max: {cap.maxLimit}KG</span>
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>

            {/* 1.5 Products List (Below Slot Capacity) */}
            <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200/90 shadow-2xs space-y-3">
              {/* Catalog Header with Search & Count */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#02626D]/10 text-[#02626D] flex items-center justify-center shrink-0">
                    <ShoppingBag size={15} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider">
                        Products Catalog
                      </h3>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#02626D]/10 text-[#02626D]">
                        {filteredProductTiles.length} items
                      </span>
                    </div>
                    <p className="text-[10.5px] text-slate-400">Click Add to select item for this order</p>
                  </div>
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
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
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
                  className={`h-7 px-2.5 rounded-xl font-bold flex items-center gap-1 flex-shrink-0 transition-all cursor-pointer text-[11px] ${
                    productGridOnlyFavorites
                      ? 'bg-amber-500 text-white shadow-2xs'
                      : 'bg-amber-50 text-amber-900 border border-amber-200/80 hover:bg-amber-100'
                  }`}
                >
                  <Star size={11} className={productGridOnlyFavorites ? 'fill-white text-white' : 'fill-amber-400 text-amber-500'} />
                  <span>Favourites ({itemsMaster.filter((i) => i.isFavorite).length})</span>
                </button>

                {productCategories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setProductGridCategory(cat)}
                    className={`h-7 px-2.5 rounded-xl font-bold flex-shrink-0 transition-all cursor-pointer text-[11px] ${
                      productGridCategory === cat
                        ? 'bg-[#02626D] text-white shadow-2xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Products Tiles Grid */}
              <div className="pt-1">
                {filteredProductTiles.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <ShoppingBag size={28} className="mx-auto text-slate-300 mb-1.5" />
                    <p className="font-bold text-xs sm:text-sm text-slate-600">No products match your filter</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Try clearing your search or category filter</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5 sm:gap-3">
                      {paginatedProductTiles.map((prod) => {
                        const addedItem = orderItems.find((it) => it.itemId === prod.id);

                        return (
                          <ProductCatalogTile
                            key={prod.id}
                            prod={prod}
                            addedItem={addedItem}
                            isCustomisation={isCustomisation}
                            numericNoOfBoxes={numericNoOfBoxes}
                            packetCostPerBox={packetCostPerBox}
                            onOpenQtyModal={handleOpenQtyModal}
                            onRemoveItem={handleSummaryRemoveItem}
                            onTogglePacket={handleToggleItemPacket}
                          />
                        );
                      })}
                    </div>

                    {/* Show More / Pagination Controls */}
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

          {/* ── 2. RIGHT COLUMN: SELECTED ITEMS, CUSTOMISATION, TRANSPORT, TOTAL COUNT ── */}
          <div className="lg:col-span-4 xl:col-span-4 space-y-3.5">

            {/* Selected Items (Cart) */}
            <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200/90 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-lg bg-[#02626D]/10 text-[#02626D] flex items-center justify-center shrink-0">
                    <ShoppingBag size={13} />
                  </div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Selected Items ({orderItems.length})
                  </h3>
                </div>
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
                <div className="py-5 text-center text-slate-400 bg-[#f7f7f8] rounded-xl border border-dashed border-slate-200">
                  <ShoppingBag size={20} className="mx-auto mb-1 text-slate-300" />
                  <p className="text-[11px] font-medium">No products added yet</p>
                  <p className="text-[10px] text-slate-400">Tap Add on products catalog to select</p>
                </div>
              ) : (
                <div className="max-h-56 overflow-y-auto space-y-2 pr-0.5 no-scrollbar divide-y divide-slate-100">
                  {orderItems.map((item) => (
                    <div key={item.lineId || item.itemId} className="pt-2 first:pt-0 space-y-1">
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-slate-900 truncate" title={item.itemName}>
                              {item.itemName}
                            </span>
                            {/* Packet toggle beside item name */}
                            <button
                              type="button"
                              onClick={() => handleToggleItemPacket(item.itemId)}
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-bold border transition-all cursor-pointer shrink-0 ${
                                item.hasPacket
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 shadow-2xs'
                                  : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                              }`}
                              title={item.hasPacket ? 'Packet packing enabled. Click to disable.' : 'Click to enable packet packing'}
                            >
                              <div
                                className={`w-3 h-3 rounded-xs flex items-center justify-center border transition-colors ${
                                  item.hasPacket ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 bg-white'
                                }`}
                              >
                                {item.hasPacket && <Check size={8} strokeWidth={3} />}
                              </div>
                              <span>
                                Packet{isCustomisation && numericNoOfBoxes > 0 && packetCostPerBox > 0 ? ` (+₹${numericNoOfBoxes * packetCostPerBox})` : ''}
                              </span>
                              <span
                                className={`text-[8px] px-1 py-0.2 rounded font-extrabold ${
                                  item.hasPacket ? 'bg-emerald-200/80 text-emerald-900' : 'bg-slate-200 text-slate-500'
                                }`}
                              >
                                {item.hasPacket ? 'ON' : 'OFF'}
                              </span>
                            </button>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-0.5">
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

                      {/* Quantity Stepper + Line Total */}
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
                            step="any"
                            min="0"
                            value={item.quantity === 0 ? '' : item.quantity}
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

                      {/* Manufacturing & Packing Notes Inline Inputs */}
                      <div className="grid grid-cols-2 gap-1.5 pt-1">
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Mfg note..."
                            value={item.manufacturingDescription || ''}
                            onChange={(e) => handleItemNoteChange(item.itemId, 'mfg', e.target.value)}
                            className="w-full h-6 px-1.5 text-[10px] text-slate-700 bg-slate-50/80 border border-slate-200 rounded-md focus:bg-white focus:border-[#02626D] focus:outline-none transition-all placeholder:text-slate-400"
                            title="Manufacturing Note (Kitchen instructions)"
                          />
                        </div>
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Packing note..."
                            value={item.packingDescription || ''}
                            onChange={(e) => handleItemNoteChange(item.itemId, 'pck', e.target.value)}
                            className="w-full h-6 px-1.5 text-[10px] text-slate-700 bg-slate-50/80 border border-slate-200 rounded-md focus:bg-white focus:border-[#02626D] focus:outline-none transition-all placeholder:text-slate-400"
                            title="Packing Note (Packaging instructions)"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3.3 Packaging & Customisation */}
            <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200/90 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                    <PackageCheck size={13} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Customisation
                    </h3>
                    <p className="text-[10px] text-slate-400">
                      {isCustomisation ? 'Custom sweet boxes & branding' : 'Standard packaging with global rates'}
                    </p>
                  </div>
                </div>

                {/* Mode Switch */}
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <span className={`text-[11px] font-bold transition-colors ${
                    isCustomisation ? 'text-[#02626D]' : 'text-slate-500'
                  }`}>
                    {isCustomisation ? 'Custom' : 'Standard'}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isCustomisation}
                    onClick={() => setIsCustomisation(!isCustomisation)}
                    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 ease-in-out cursor-pointer ${
                      isCustomisation ? 'bg-[#02626D]' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                        isCustomisation ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </label>
              </div>

              {/* STANDARD MODE */}
              {!isCustomisation && (
                <div className="space-y-2.5 animate-in fade-in duration-150 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-800">Box Rate</span>
                        <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded-md bg-[#02626D]/10 text-[#02626D] border border-teal-200">
                          ₹{globalSettings.globalPackingBoxPrice} / box
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500">Default global box rate</p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <label className="text-xs font-bold text-slate-700 whitespace-nowrap">Boxes:</label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        placeholder="0"
                        value={noOfBoxes}
                        onChange={(e) => setNoOfBoxes(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10) || 0))}
                        className="w-16 h-7.5 px-2 border border-slate-300 rounded-lg text-xs font-bold text-[#02626D] bg-white focus:outline-none focus:border-[#02626D] text-center"
                      />
                    </div>
                  </div>

                  {numericNoOfBoxes > 0 && (
                    <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-teal-50/50 border border-teal-200/60 text-xs">
                      <span className="font-semibold text-teal-900">
                        Packing ({numericNoOfBoxes} × ₹{globalSettings.globalPackingBoxPrice}):
                      </span>
                      <span className="font-extrabold text-[#02626D]">
                        ₹ {pCharges.toFixed(2)}
                      </span>
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Additional Charges (₹, Optional)
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="0.00"
                      value={additionalCharges}
                      onChange={(e) => setAdditionalCharges(e.target.value)}
                      className="w-full h-8 px-2.5 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:border-[#02626D]"
                    />
                  </div>
                </div>
              )}

              {/* CUSTOMISED MODE */}
              {isCustomisation && (
                <div className="space-y-2.5 animate-in fade-in duration-150 text-xs">
                  {/* Custom Box Model & Count */}
                  <div className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200/90 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold text-amber-950">Custom Box Model</span>
                        <p className="text-[10px] text-amber-800 font-medium">Rate: ₹{selectedBoxPrice}/box</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <label className="text-xs font-bold text-amber-950 whitespace-nowrap">Boxes:</label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          placeholder="0"
                          value={noOfBoxes}
                          onChange={(e) => setNoOfBoxes(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10) || 0))}
                          className="w-16 h-7.5 px-2 border border-amber-300 rounded-lg text-xs font-bold text-amber-950 bg-white focus:outline-none focus:border-amber-600 text-center"
                        />
                      </div>
                    </div>

                    <select
                      value={boxType}
                      onChange={(e) => setBoxType(e.target.value)}
                      className="w-full h-8 px-2 border border-amber-300 rounded-xl text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:border-amber-600"
                    >
                      {activeBoxes.map((b) => (
                        <option key={b.id} value={b.name}>
                          {b.name} (₹{b.price}/box)
                        </option>
                      ))}
                    </select>

                    {numericNoOfBoxes > 0 && (
                      <div className="flex items-center justify-between text-[11px] font-bold text-amber-950 pt-1 border-t border-amber-200/60">
                        <span>Custom Box Charges:</span>
                        <span>₹ {boxChargesTotal.toFixed(2)}</span>
                      </div>
                    )}
                  </div>

                  {/* ── NEW: PACKING BOXES COUNT OPTION ── */}
                  <div className="p-2.5 rounded-xl bg-slate-50/90 border border-slate-200 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-800">
                        Packing Boxes Count
                      </label>
                      <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-teal-50 text-[#02626D] border border-teal-200">
                        ₹{globalSettings.globalPackingBoxPrice} / box
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        placeholder="0"
                        value={packingBoxesCount}
                        onChange={(e) => setPackingBoxesCount(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10) || 0))}
                        className="w-full h-8 px-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white focus:outline-none focus:border-[#02626D]"
                      />
                      {numericPackingBoxesCount > 0 && (
                        <div className="text-right shrink-0">
                          <span className="text-[9.5px] text-slate-400 block font-medium">Charges</span>
                          <span className="text-xs font-black text-[#02626D]">
                            ₹ {customPackingBoxesTotal.toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500">
                      Multiplied with Global Packing Box Price from Utilities ({numericPackingBoxesCount} × ₹{globalSettings.globalPackingBoxPrice}).
                    </p>
                  </div>

                  {/* Shrink Wrap & Branding Sticker */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Shrink Wrap</label>
                      <select
                        value={shrinkType}
                        onChange={(e) => setShrinkType(e.target.value)}
                        className="w-full h-8 px-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:border-[#02626D]"
                      >
                        <option value="None">None (₹0)</option>
                        {activeShrinks.map((s) => (
                          <option key={s.id} value={s.name}>
                            {s.name} (+₹{s.price})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Branding Sticker</label>
                      <select
                        value={stickerType}
                        onChange={(e) => setStickerType(e.target.value)}
                        className="w-full h-8 px-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:border-[#02626D]"
                      >
                        <option value="None">None (₹0)</option>
                        {activeStickers.map((st) => (
                          <option key={st.id} value={st.name}>
                            {st.name} (+₹{st.price})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Box Reference Image */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Box Image (Optional)
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="relative w-10 h-10 rounded-lg bg-slate-50 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                        {boxImageUrl ? (
                          <Image src={boxImageUrl} alt="Box Preview" fill className="object-contain p-0.5" />
                        ) : (
                          <Upload size={14} className="text-slate-400" />
                        )}
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleBoxImageUpload}
                        className="block w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[10px] file:font-semibold file:bg-teal-50 file:text-[#02626D] hover:file:bg-teal-100 cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Additional Charges */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Additional Charges (₹, Optional)
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="0.00"
                      value={additionalCharges}
                      onChange={(e) => setAdditionalCharges(e.target.value)}
                      className="w-full h-8 px-2.5 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:border-[#02626D]"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 3.4 Transport */}
            <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200/90 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                    <Truck size={13} />
                  </div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Transport
                  </h3>
                </div>

                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isTransportRequired}
                    onChange={(e) => setIsTransportRequired(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-[#02626D] focus:ring-[#02626D] cursor-pointer"
                  />
                  <span>Required</span>
                </label>
              </div>

              {isTransportRequired ? (
                <div className="space-y-2 pt-1 animate-in fade-in duration-150 text-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Transport Charges (₹) <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        placeholder="0.00"
                        value={transportCharges}
                        onChange={(e) => setTransportCharges(e.target.value)}
                        className="w-full h-8 pl-7 pr-3 border border-slate-300 rounded-xl text-xs font-bold text-[#02626D] bg-white focus:outline-none focus:border-[#02626D]"
                      />
                      <IndianRupee size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center justify-between">
                      <span>Delivery Address <span className="text-rose-500">*</span></span>
                      {selectedCustomer?.address && deliveryAddress !== selectedCustomer.address && (
                        <button
                          type="button"
                          onClick={() => setDeliveryAddress(selectedCustomer.address || '')}
                          className="text-[10px] font-semibold text-[#02626D] hover:underline cursor-pointer"
                        >
                          Use Customer Address
                        </button>
                      )}
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Destination delivery address..."
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      className="w-full p-2 text-xs font-medium border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-[#02626D]"
                    />
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-slate-400">Pickup order (no transport freight applied).</p>
              )}
            </div>

            {/* 3.5 Total Count & Billing Summary */}
            <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200/90 shadow-2xs space-y-3">
              <div className="border-b border-slate-100 pb-2 flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Total Count &amp; Bill
                </h3>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                  {orderItems.length} {orderItems.length === 1 ? 'item' : 'items'}
                </span>
              </div>

              {/* Pricing Breakdown */}
              <div className="space-y-1.5 text-xs text-slate-600">
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-500">
                    {taxCalculation.taxType === 'inclusive' ? 'Subtotal (Base Price):' : 'Items Subtotal:'}
                  </span>
                  <span className="font-bold text-slate-900">
                    ₹ {taxCalculation.taxType === 'inclusive' ? taxCalculation.taxableAmount.toFixed(2) : subTotal.toFixed(2)}
                  </span>
                </div>

                {isCustomisation ? (
                  <>
                    {boxChargesTotal > 0 && (
                      <div className="flex justify-between py-0.5 text-amber-900">
                        <span>Custom Boxes ({numericNoOfBoxes} × ₹{selectedBoxPrice}):</span>
                        <span className="font-bold">+ ₹ {boxChargesTotal.toFixed(2)}</span>
                      </div>
                    )}

                    {customPackingBoxesTotal > 0 && (
                      <div className="flex justify-between py-0.5 text-teal-800">
                        <span>Packing Boxes ({numericPackingBoxesCount} × ₹{globalSettings.globalPackingBoxPrice}):</span>
                        <span className="font-bold">+ ₹ {customPackingBoxesTotal.toFixed(2)}</span>
                      </div>
                    )}

                    {stickerType !== 'None' && stickerChargesTotal > 0 && (
                      <div className="flex justify-between py-0.5 text-amber-900">
                        <span>Sticker ({numericNoOfBoxes} × ₹{selectedStickerPrice}):</span>
                        <span className="font-bold">+ ₹ {stickerChargesTotal.toFixed(2)}</span>
                      </div>
                    )}

                    {shrinkType !== 'None' && shrinkChargesTotal > 0 && (
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

                    {addCharges > 0 && (
                      <div className="flex justify-between py-0.5 text-amber-900">
                        <span>Additional Charges:</span>
                        <span className="font-bold">+ ₹ {addCharges.toFixed(2)}</span>
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
                <div className="pt-1.5 border-t border-slate-100">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-[11px] font-bold text-slate-600 whitespace-nowrap">Discount (₹):</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="0"
                      value={discountAmount}
                      onChange={(e) => setDiscountAmount(e.target.value)}
                      className="w-28 h-7 px-2 text-xs border border-slate-300 rounded-lg bg-[#f7f7f8] focus:bg-white focus:outline-none focus:border-[#02626D] font-bold text-slate-800 text-right"
                    />
                  </div>
                </div>

                {/* Tax Breakdown */}
                {taxCalculation.totalGstPercent > 0 && (
                  <div className="pt-1.5 border-t border-slate-100 space-y-1">
                    <div className="flex justify-between py-0.5 text-slate-600 text-xs">
                      <span>CGST ({taxCalculation.cgstPercent}%):</span>
                      <span className="font-bold text-slate-800">
                        {taxCalculation.taxType === 'exclusive' ? '+ ' : ''}₹ {taxCalculation.cgstAmount.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between py-0.5 text-slate-600 text-xs">
                      <span>SGST ({taxCalculation.sgstPercent}%):</span>
                      <span className="font-bold text-slate-800">
                        {taxCalculation.taxType === 'exclusive' ? '+ ' : ''}₹ {taxCalculation.sgstAmount.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Grand Total */}
                <div className="pt-2.5 border-t-2 border-slate-200 flex justify-between items-baseline">
                  <span className="text-sm font-extrabold text-slate-900">Grand Total:</span>
                  <span className="text-xl font-black text-[#02626D]">
                    ₹ {grandTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Payment Section (Single or Split) */}
              <div className="pt-2 border-t border-slate-100 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">Payment Mode</label>
                  <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[10.5px] font-bold">
                    <button
                      type="button"
                      onClick={() => {
                        setIsSplitPayment(false);
                        if (splitPayments.length > 0 && splitPayments[0].amount) {
                          setReceivedAmount(String(splitTotalReceived || splitPayments[0].amount));
                        }
                      }}
                      className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                        !isSplitPayment
                          ? 'bg-[#02626D] text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Single
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsSplitPayment(true);
                        if (splitPayments.length === 0 || (splitPayments.length === 1 && !splitPayments[0].amount && receivedAmount)) {
                          setSplitPayments([
                            {
                              id: 'split-1',
                              mode: paymentMode,
                              amount: receivedAmount || '',
                              note: '',
                            },
                          ]);
                        }
                      }}
                      className={`px-2 py-0.5 rounded transition-all cursor-pointer flex items-center gap-1 ${
                        isSplitPayment
                          ? 'bg-[#02626D] text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span>Split</span>
                    </button>
                  </div>
                </div>

                {!isSplitPayment ? (
                  /* Single Payment Mode */
                  <div className="space-y-2 bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/80 text-xs">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-bold text-slate-700">Received (₹)</label>
                        <div className="flex items-center gap-1 text-[9.5px]">
                          <button
                            type="button"
                            onClick={() => setReceivedAmount(grandTotal > 0 ? String(grandTotal) : '')}
                            className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold hover:bg-emerald-200 cursor-pointer"
                          >
                            Full
                          </button>
                          <button
                            type="button"
                            onClick={() => setReceivedAmount(grandTotal > 0 ? String(Math.round(grandTotal / 2)) : '')}
                            className="px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 font-bold hover:bg-sky-200 cursor-pointer"
                          >
                            Half
                          </button>
                          <button
                            type="button"
                            onClick={() => setReceivedAmount('')}
                            className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-bold hover:bg-slate-300 cursor-pointer"
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        placeholder="0.00"
                        value={receivedAmount}
                        onChange={(e) => setReceivedAmount(e.target.value)}
                        className="w-full h-8 px-2.5 text-xs font-black text-slate-900 border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-[#02626D]"
                      />
                    </div>

                    <div>
                      <label className="block text-[10.5px] font-bold text-slate-600 mb-1">Method</label>
                      <div className="grid grid-cols-3 gap-1">
                        {['UPI', 'Cash', 'Card', 'Credit', 'Bank Transfer', 'Cheque'].map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => setPaymentMode(mode)}
                            className={`h-6.5 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer truncate px-1 ${
                              paymentMode === mode
                                ? 'bg-[#02626D] text-white shadow-2xs'
                                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {mode}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Split Payment Mode */
                  <div className="space-y-2 bg-[#f0f9fa] p-2.5 rounded-xl border border-[#b2e3e8] text-xs">
                    <div className="flex items-center justify-between text-[11px] font-bold text-[#02626D]">
                      <span>Splits</span>
                      <span>Total: ₹ {splitTotalReceived.toFixed(2)}</span>
                    </div>

                    <div className="space-y-1.5">
                      {splitPayments.map((split, index) => {
                        const currentSplitsTotalExceptThis = splitPayments.reduce(
                          (sum, s, i) => (i === index ? sum : sum + (parseFloat(String(s.amount)) || 0)),
                          0
                        );
                        const remainingToFill = Math.max(0, grandTotal - currentSplitsTotalExceptThis);

                        return (
                          <div
                            key={split.id || index}
                            className="bg-white p-2 rounded-lg border border-slate-200 shadow-2xs space-y-1"
                          >
                            <div className="flex items-center gap-1.5">
                              <select
                                value={split.mode}
                                onChange={(e) => {
                                  const newMode = e.target.value;
                                  setSplitPayments((prev) =>
                                    prev.map((s, i) => (i === index ? { ...s, mode: newMode } : s))
                                  );
                                }}
                                className="h-7 px-1.5 text-[10.5px] font-bold text-slate-800 border border-slate-300 rounded-lg bg-slate-50 focus:outline-none focus:border-[#02626D]"
                              >
                                <option value="UPI">UPI</option>
                                <option value="Cash">Cash</option>
                                <option value="Card">Card</option>
                                <option value="Bank Transfer">Bank Transfer</option>
                                <option value="Cheque">Cheque</option>
                                <option value="Credit">Credit</option>
                              </select>

                              <input
                                type="number"
                                step="any"
                                min="0"
                                placeholder="0.00"
                                value={split.amount}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setSplitPayments((prev) =>
                                    prev.map((s, i) => (i === index ? { ...s, amount: val } : s))
                                  );
                                }}
                                className="flex-1 h-7 px-2 text-xs font-black text-slate-900 border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-[#02626D]"
                              />

                              {remainingToFill > 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSplitPayments((prev) =>
                                      prev.map((s, i) =>
                                        i === index ? { ...s, amount: String(remainingToFill) } : s
                                      )
                                    );
                                  }}
                                  className="h-7 px-1.5 text-[9.5px] font-bold bg-teal-50 text-[#02626D] hover:bg-teal-100 border border-teal-200 rounded-lg cursor-pointer shrink-0"
                                >
                                  Fill Bal
                                </button>
                              )}

                              {splitPayments.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSplitPayments((prev) => prev.filter((_, i) => i !== index));
                                  }}
                                  className="h-7 w-6 flex items-center justify-center text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer shrink-0"
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const remaining = Math.max(0, grandTotal - splitTotalReceived);
                        setSplitPayments((prev) => [
                          ...prev,
                          {
                            id: `split-${Date.now()}`,
                            mode: prev.some((p) => p.mode === 'UPI') ? 'Cash' : 'UPI',
                            amount: remaining > 0 ? String(remaining) : '',
                            note: '',
                          },
                        ]);
                      }}
                      className="w-full h-6.5 rounded-lg border border-dashed border-[#02626D]/40 hover:border-[#02626D] bg-white text-[#02626D] text-[10.5px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Plus size={11} />
                      <span>Add Method</span>
                    </button>
                  </div>
                )}

                {/* Payment Status & Balance Due */}
                <div
                  className={`p-2 rounded-xl border flex flex-col gap-0.5 text-xs ${
                    paymentStatus === 'Completed'
                      ? 'bg-emerald-50 text-emerald-950 border-emerald-200'
                      : paymentStatus === 'Partial'
                      ? 'bg-amber-50 text-amber-950 border-amber-200'
                      : 'bg-slate-100 text-slate-800 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold">
                    <span className="flex items-center gap-1">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          paymentStatus === 'Completed'
                            ? 'bg-emerald-500'
                            : paymentStatus === 'Partial'
                            ? 'bg-amber-500 animate-pulse'
                            : 'bg-slate-400'
                        }`}
                      />
                      <span>Status:</span>
                    </span>
                    <span className="uppercase tracking-wider font-extrabold text-[9.5px]">
                      {paymentStatus}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[10.5px] pt-1 border-t border-current/10 font-semibold">
                    <span>Received: <strong>₹ {effectiveReceivedAmount.toFixed(2)}</strong></span>
                    <span>
                      Due:{' '}
                      <strong className={grandTotal - effectiveReceivedAmount > 0 ? 'text-rose-600 font-extrabold' : 'text-emerald-700'}>
                        ₹ {Math.max(0, grandTotal - effectiveReceivedAmount).toFixed(2)}
                      </strong>
                    </span>
                  </div>
                </div>

                {/* Order Status */}
                <div>
                  <label className="block text-[10.5px] font-bold text-slate-600 mb-1">
                    {isEditMode ? 'Order Status' : 'Initial Order Status'}
                  </label>
                  <select
                    value={orderStatus}
                    onChange={(e) => setOrderStatus(e.target.value)}
                    className="w-full h-8 px-2.5 text-xs font-semibold text-slate-800 border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-[#02626D]"
                  >
                    <option value="Order Created">Order Created</option>
                    <option value="Confirmed">Confirmed</option>
                    <option value="Pending">Pending</option>
                    <option value="Moved to Manufacturing">Moved to Manufacturing</option>
                    <option value="In Production">In Production</option>
                    <option value="Packed">Packed</option>
                    <option value="Ready for Delivery">Ready for Delivery</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>

                {/* Submit Action Buttons */}
                <div className="pt-1.5 space-y-1.5">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full h-9.5 rounded-xl bg-[#02626D] hover:bg-[#014d56] text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>{isEditMode ? 'Updating Order...' : 'Creating Order...'}</span>
                      </>
                    ) : (
                      <>
                        <Check size={14} />
                        <span>{isEditMode ? 'Update Order' : 'Create Order'}</span>
                      </>
                    )}
                  </button>

                  <Link
                    href={isEditMode ? `/orders/${editId}` : '/orders'}
                    className="w-full h-8.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors flex items-center justify-center cursor-pointer"
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

      {/* ── MODAL: ENTER / EDIT ITEM QUANTITY ─────────────────────── */}
      {qtyModalProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-150 font-sans">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-teal-50 text-[#02626D] flex items-center justify-center border border-teal-100 shrink-0">
                  <ShoppingBag size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {qtyModalProduct.isEdit ? 'Edit Item Quantity' : 'Enter Item Quantity'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {qtyModalProduct.prod.category} • {qtyModalProduct.prod.code}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setQtyModalProduct(null);
                  setModalQuantityInput('');
                  setModalMfgNote('');
                  setModalPckNote('');
                }}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Product Summary Card */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="relative w-12 h-12 rounded-lg bg-white border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                <Image
                  src={qtyModalProduct.prod.imageUrl || '/app-icon.png'}
                  alt={qtyModalProduct.prod.name}
                  fill
                  className="object-contain p-1"
                />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold text-slate-900 truncate">
                  {qtyModalProduct.prod.name}
                </h4>
                <p className="text-xs font-extrabold text-[#02626D] mt-0.5">
                  ₹{qtyModalProduct.prod.price} <span className="text-[10px] text-slate-400 font-normal">/ {qtyModalProduct.prod.unit}</span>
                </p>
              </div>
            </div>

            {/* Quantity Input Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveModalQuantity();
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Enter Quantity ({qtyModalProduct.prod.unit}) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    autoFocus
                    required
                    placeholder={`Enter quantity in ${qtyModalProduct.prod.unit}...`}
                    value={modalQuantityInput}
                    onChange={(e) => setModalQuantityInput(e.target.value)}
                    className="w-full h-12 px-4 text-xl font-black text-slate-900 bg-white border-2 border-slate-300 rounded-xl focus:outline-none focus:border-[#02626D] focus:ring-2 focus:ring-[#02626D]/20 transition-all placeholder:text-slate-300 placeholder:text-xs placeholder:font-normal"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-extrabold text-slate-500 bg-slate-100 px-2 py-1 rounded-md border border-slate-200">
                    {qtyModalProduct.prod.unit}
                  </span>
                </div>
              </div>

              {/* Manufacturing & Packing Notes */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <FileText size={12} className="text-[#02626D]" />
                      <span>Manufacturing Note (Kitchen)</span>
                    </span>
                    <span className="text-[10px] font-normal text-slate-400">Optional</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Less sugar, soft fry, extra crispy, special shape..."
                    value={modalMfgNote}
                    onChange={(e) => setModalMfgNote(e.target.value)}
                    className="w-full h-9 px-3 text-xs text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#02626D] focus:ring-2 focus:ring-[#02626D]/15 placeholder:text-slate-300 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Package size={12} className="text-[#02626D]" />
                      <span>Packing Note (Packaging)</span>
                    </span>
                    <span className="text-[10px] font-normal text-slate-400">Optional</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 500g boxes, gift packaging, separate bags..."
                    value={modalPckNote}
                    onChange={(e) => setModalPckNote(e.target.value)}
                    className="w-full h-9 px-3 text-xs text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#02626D] focus:ring-2 focus:ring-[#02626D]/15 placeholder:text-slate-300 transition-all"
                  />
                </div>
              </div>

              {/* Live Subtotal Preview */}
              {parseFloat(modalQuantityInput) > 0 && (
                <div className="p-3 bg-teal-50/70 border border-teal-200 rounded-xl flex items-center justify-between text-xs animate-in fade-in">
                  <span className="font-semibold text-slate-600">Projected Line Total:</span>
                  <span className="text-sm font-black text-[#02626D]">
                    ₹ {(parseFloat(modalQuantityInput) * qtyModalProduct.prod.price).toFixed(2)}
                  </span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setQtyModalProduct(null);
                    setModalQuantityInput('');
                    setModalMfgNote('');
                    setModalPckNote('');
                  }}
                  className="px-4 h-9 rounded-xl text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!modalQuantityInput || parseFloat(modalQuantityInput) <= 0}
                  className="px-5 h-9 rounded-xl text-xs font-bold text-white bg-[#02626D] hover:bg-[#014d56] shadow-2xs transition-all cursor-pointer disabled:opacity-40 active:scale-95 flex items-center gap-1.5"
                >
                  <Check size={14} />
                  <span>{qtyModalProduct.isEdit ? 'Update Quantity' : 'Save & Add Item'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Slot Limit Override Authorization Modal (OTP Protected) */}
      <SlotLimitOverrideModal
        isOpen={Boolean(slotOverrideModalData)}
        onClose={() => setSlotOverrideModalData(null)}
        data={slotOverrideModalData}
        userIdentifier={employeeProfile ? `${employeeProfile.name} (${employeeProfile.empId || employeeProfile.mobile})` : 'Order Booking Staff'}
        onAuthorized={handleSlotOverrideAuthorized}
      />

      {/* Order Edit Authorization Modal (OTP Protected for non-admins) */}
      <OrderActionOtpModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        order={
          editId
            ? {
                id: editId,
                code: existingOrderCode || editId,
                customerName: selectedCustomer?.name,
                totalAmount: grandTotal,
                orderDate: mfgDate || existingMfgDate,
              }
            : null
        }
        action="edit"
        requestedBy={employeeProfile?.name || user?.email?.split('@')[0] || 'Staff Member'}
        onAuthorized={(verifiedToken) => {
          setIsEditAuthorized(true);
          try {
            sessionStorage.setItem(`order_auth_${editId}`, verifiedToken);
          } catch {}
          setAuthModalOpen(false);
          toast.success('Authorization Confirmed', 'Admin OTP verified. You can now save changes.');
        }}
      />

    </div>
  );
}

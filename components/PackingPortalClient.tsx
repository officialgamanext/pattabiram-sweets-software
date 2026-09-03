'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Package,
  CheckCircle2,
  Clock,
  Search,
  Play,
  Check,
  ChevronRight,
  Loader2,
  Store,
  Boxes,
  ListOrdered,
  Building2,
  ShieldAlert,
  Lock,
  ArrowRightLeft
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, updateDoc, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import type { OrderRecord, OrderItemLine, CustomisationData } from './OrdersClient';
import CustomSelect from '@/components/CustomSelect';
import { useAuth } from '@/context/AuthContext';
import SwitchPackingUnitModal from '@/components/SwitchPackingUnitModal';

export interface DynamicUnit {
  id: string;
  code: string;
  name: string;
  status: string;
  isCustomisationUnit?: boolean;
  isTransportUnit?: boolean;
}

export interface ItemMasterInfo {
  mfgUnitName: string;
  pckUnitName: string;
  category: string;
}

export interface AggregatedPackingSummary {
  itemId: string;
  itemCode: string;
  itemName: string;
  category: string;
  unit: string;
  imageUrl?: string;
  manufacturingUnitName: string;
  packingUnitName: string;
  totalQuantity: number;
  orders: {
    orderId: string;
    orderCode: string;
    customerName: string;
    slot: string;
    quantity: number;
    pckStatus: 'Pending' | 'Packing Started' | 'Moved to Store';
    packingDescription?: string;
    isCustomisation?: boolean;
    customisationDetails?: CustomisationData | null;
    hasPacket?: boolean;
  }[];
}

export function isOrderEligibleForPacking(order: OrderRecord): boolean {
  // 1. Exclude POS bills completely
  const orderType = ((order as any).orderType || (order as any).source || '').toString().toLowerCase();
  if (orderType.includes('pos') || orderType.includes('walk-in')) {
    return false;
  }

  // 2. Ignore Delivered or Cancelled orders
  const status = (order.orderStatus || (order as any).status || '').toString();
  if (status === 'Delivered' || status === 'Cancelled') {
    return false;
  }

  // 3. Must have at least 1 item
  if (!order.items || order.items.length === 0) {
    return false;
  }

  return true;
}

/**
 * Checks if a specific packing unit is responsible for handling an order based on:
 * - Customisation order -> Customisation packing unit(s)
 * - Transport order -> Transport packing unit(s)
 * - Both -> Both Customisation and Transport packing units
 * - Standard order -> Standard (non-customisation, non-transport) packing units
 */
export function isOrderMatchingPackingUnit(
  order: OrderRecord,
  unit: DynamicUnit,
  allUnits: DynamicUnit[]
): boolean {
  const isCustom = Boolean(order.isCustomisation);
  const isTransport = Boolean(order.isTransportRequired);
  const isUnitCustom = Boolean(unit.isCustomisationUnit);
  const isUnitTransport = Boolean(unit.isTransportUnit);

  const hasCustomUnits = allUnits.some((u) => Boolean(u.isCustomisationUnit));
  const hasTransportUnits = allUnits.some((u) => Boolean(u.isTransportUnit));

  // Case 1: Order has BOTH Customisation AND Transport
  if (isCustom && isTransport) {
    if (hasCustomUnits || hasTransportUnits) {
      return isUnitCustom || isUnitTransport;
    }
    return !isUnitCustom && !isUnitTransport;
  }

  // Case 2: Order is Customisation ONLY
  if (isCustom) {
    if (hasCustomUnits) {
      return isUnitCustom;
    }
    return !isUnitCustom && !isUnitTransport;
  }

  // Case 3: Order is Transport ONLY
  if (isTransport) {
    if (hasTransportUnits) {
      return isUnitTransport;
    }
    return !isUnitCustom && !isUnitTransport;
  }

  // Case 4: Standard order (neither customisation nor transport)
  return !isUnitCustom && !isUnitTransport;
}

export function getEffectivePackingUnitName(
  order: OrderRecord,
  item: any,
  itemPckUnitName: string,
  allUnits: DynamicUnit[]
): string {
  // 1. Explicit item-level override takes precedence
  if (item?.packingUnitOverride) {
    return item.packingUnitOverride;
  }

  // 2. Explicit order-level override takes precedence
  if ((order as any)?.packingUnitOverride) {
    return (order as any).packingUnitOverride;
  }

  const isCustom = Boolean(order.isCustomisation);
  const isTransport = Boolean(order.isTransportRequired);

  const customUnits = allUnits.filter((u) => u.isCustomisationUnit);
  const transportUnits = allUnits.filter((u) => u.isTransportUnit);

  if (isCustom && isTransport) {
    const customNames = customUnits.map((u) => u.name).join(', ');
    const transportNames = transportUnits.map((u) => u.name).join(', ');
    if (customNames && transportNames) {
      return `${customNames} & ${transportNames}`;
    }
    return customNames || transportNames || itemPckUnitName || 'General Packing';
  }

  if (isCustom) {
    const customNames = customUnits.map((u) => u.name).join(', ');
    return customNames || itemPckUnitName || 'Customisation Packing';
  }

  if (isTransport) {
    const transportNames = transportUnits.map((u) => u.name).join(', ');
    return transportNames || itemPckUnitName || 'Transport Packing';
  }

  return itemPckUnitName || 'General Packing';
}

export default function PackingPortalClient() {
  const { employeeProfile } = useAuth();
  const isSuperAdmin = Boolean(employeeProfile?.isSuperAdmin);
  const assignedPckUnits = Array.isArray(employeeProfile?.assignedPckUnits) ? employeeProfile.assignedPckUnits : [];
  const isAllUnitsAllowed = isSuperAdmin || assignedPckUnits.includes('All');

  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [pckUnits, setPckUnits] = useState<DynamicUnit[]>([]);
  const [itemInfoMap, setItemInfoMap] = useState<Map<string, ItemMasterInfo>>(new Map());

  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('all');
  const [activeTab, setActiveTab] = useState<'item_wise' | 'order_wise'>('item_wise');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Switch Packing Unit Modal State
  const [switchModalData, setSwitchModalData] = useState<{
    isOpen: boolean;
    orderId: string;
    orderCode: string;
    targetType: 'order' | 'item';
    itemName?: string;
    currentUnitName: string;
  }>({
    isOpen: false,
    orderId: '',
    orderCode: '',
    targetType: 'order',
    currentUnitName: '',
  });

  // Accessible packing units for the logged-in employee
  const accessiblePckUnits = useMemo(() => {
    if (isAllUnitsAllowed) return pckUnits;
    return pckUnits.filter((u) =>
      assignedPckUnits.some((assigned) => assigned.toLowerCase() === u.name.toLowerCase())
    );
  }, [pckUnits, isAllUnitsAllowed, assignedPckUnits]);

  // 1. Subscribe to real-time packing units
  useEffect(() => {
    const unsubUnits = onSnapshot(
      collection(db, 'packing_units'),
      (snap) => {
        const list = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            code: data.code || '',
            name: data.name || '',
            status: data.status || 'Active',
            isCustomisationUnit: Boolean(data.isCustomisationUnit),
            isTransportUnit: Boolean(data.isTransportUnit),
          };
        });
        setPckUnits(list.filter((u) => u.status !== 'Inactive'));
      },
      (err) => console.error('Error fetching packing units:', err)
    );
    return () => unsubUnits();
  }, []);

  // 2. Subscribe to Item Master to retrieve assigned Packing Units
  useEffect(() => {
    const unsubItems = onSnapshot(
      collection(db, 'items'),
      (snap) => {
        const map = new Map<string, ItemMasterInfo>();
        snap.docs.forEach((docSnap) => {
          const data = docSnap.data();
          const nameKey = (data.name || '').toLowerCase().trim();
          map.set(nameKey, {
            mfgUnitName: data.manufacturingUnitName || 'General Kitchen',
            pckUnitName: data.packingUnitName || 'General Packing',
            category: data.category || 'General'
          });
        });
        setItemInfoMap(map);
      },
      (err) => console.error('Error fetching items master info:', err)
    );
    return () => unsubItems();
  }, []);

  // 3. Subscribe to real-time orders
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'orders'),
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<OrderRecord, 'id'>),
        }));
        setOrders(list);
        setIsLoading(false);
      },
      (err) => {
        console.error('Error fetching orders for packing:', err);
        setIsLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // Unit options based on accessible units
  const unitOptions = useMemo(() => {
    if (!isAllUnitsAllowed && accessiblePckUnits.length === 0) {
      return [{ value: 'none', label: 'No Units Assigned' }];
    }
    const opts = [];
    if (isAllUnitsAllowed || accessiblePckUnits.length > 1) {
      opts.push({
        value: 'all',
        label: isAllUnitsAllowed ? 'All Packing Units' : `All Assigned Units (${accessiblePckUnits.length})`
      });
    }
    accessiblePckUnits.forEach((u) => {
      let roleTag = '';
      if (u.isCustomisationUnit && u.isTransportUnit) {
        roleTag = ' [Custom & Transport]';
      } else if (u.isCustomisationUnit) {
        roleTag = ' [Customisation]';
      } else if (u.isTransportUnit) {
        roleTag = ' [Transport]';
      }

      opts.push({
        value: u.name,
        label: `${u.name} (${u.code})${roleTag}`
      });
    });
    return opts;
  }, [accessiblePckUnits, isAllUnitsAllowed]);

  // Ensure selectedUnit is set to a valid accessible unit for employees
  useEffect(() => {
    if (!isAllUnitsAllowed && accessiblePckUnits.length > 0) {
      const isCurrentValid = accessiblePckUnits.some(
        (u) => u.name.toLowerCase() === selectedUnit.toLowerCase()
      );
      if (!isCurrentValid && selectedUnit !== 'all') {
        setSelectedUnit(accessiblePckUnits[0].name);
      } else if (selectedUnit === 'all' && accessiblePckUnits.length === 1) {
        setSelectedUnit(accessiblePckUnits[0].name);
      }
    }
  }, [accessiblePckUnits, isAllUnitsAllowed, selectedUnit]);

  // Helper to check if an item in an order is permitted to be shown given the current selected unit / employee access
  const isItemAllowedForPacking = (
    order: OrderRecord,
    item: any,
    itemPckUnitName: string
  ): boolean => {
    // 1. Explicit override on item or order takes precedence
    const overrideUnit = item?.packingUnitOverride || (order as any)?.packingUnitOverride;
    if (overrideUnit) {
      if (selectedUnit !== 'all') {
        return selectedUnit.toLowerCase() === overrideUnit.toLowerCase();
      }
      if (isAllUnitsAllowed) return true;
      return accessiblePckUnits.some((u) => u.name.toLowerCase() === overrideUnit.toLowerCase());
    }

    const isCustom = Boolean(order.isCustomisation);
    const isTransport = Boolean(order.isTransportRequired);

    if (selectedUnit !== 'all') {
      const activeUnit = pckUnits.find((u) => u.name.toLowerCase() === selectedUnit.toLowerCase());
      if (!activeUnit) return false;

      // Check if activeUnit handles this order
      if (!isOrderMatchingPackingUnit(order, activeUnit, pckUnits)) {
        return false;
      }

      // If standard order, also check if item's assigned packing unit matches activeUnit
      if (!isCustom && !isTransport) {
        if (itemPckUnitName && activeUnit.name && itemPckUnitName.toLowerCase() !== activeUnit.name.toLowerCase()) {
          return false;
        }
      }
      return true;
    }

    // When selectedUnit === 'all'
    if (isAllUnitsAllowed) {
      return true;
    }

    // Restricted employee: check accessible units
    return accessiblePckUnits.some((unit) => {
      if (!isOrderMatchingPackingUnit(order, unit, pckUnits)) return false;
      if (!isCustom && !isTransport) {
        if (itemPckUnitName && unit.name && itemPckUnitName.toLowerCase() !== unit.name.toLowerCase()) {
          return false;
        }
      }
      return true;
    });
  };

  // Aggregate items across active packing stage orders (mfgStatus === 'Moved to Packing' AND pckStatus !== 'Moved to Store')
  const aggregatedItems = useMemo(() => {
    const map = new Map<string, AggregatedPackingSummary>();

    orders.forEach((order) => {
      if (!isOrderEligibleForPacking(order)) return;

      (order.items || []).forEach((item) => {
        const itemMfgStatus = item.mfgStatus || (
          order.orderStatus === 'Moved to Packing' || order.orderStatus === 'Packing Started' || order.orderStatus === 'Moved to Store'
            ? 'Moved to Packing'
            : 'Pending'
        );

        const itemPckStatus = item.pckStatus || (
          order.orderStatus === 'Moved to Store'
            ? 'Moved to Store'
            : order.orderStatus === 'Packing Started'
            ? 'Packing Started'
            : 'Pending'
        );

        // Item must have finished manufacturing AND not yet moved to store!
        if (itemMfgStatus !== 'Moved to Packing' || itemPckStatus === 'Moved to Store') return;

        const rawName = item.itemName || 'Unknown Item';
        const key = rawName.toLowerCase().trim();
        const masterInfo = itemInfoMap.get(key);

        const mfgUnitName = (item as any).manufacturingUnitName || masterInfo?.mfgUnitName || 'General Kitchen';
        const pckUnitName = (item as any).packingUnitName || masterInfo?.pckUnitName || 'General Packing';
        const category = item.category || masterInfo?.category || 'General';

        // Check if item is allowed for current packing portal view / unit filter
        if (!isItemAllowedForPacking(order, item, pckUnitName)) return;

        // Apply Search Term
        if (
          searchTerm &&
          !rawName.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !category.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !order.code.toLowerCase().includes(searchTerm.toLowerCase())
        ) {
          return;
        }

        const effectiveUnitName = getEffectivePackingUnitName(order, item, pckUnitName, pckUnits);
        const existing = map.get(key);

        if (existing) {
          existing.totalQuantity += item.quantity || 0;
          existing.orders.push({
            orderId: order.id,
            orderCode: order.code,
            customerName: order.customerName,
            slot: order.slot,
            quantity: item.quantity || 0,
            pckStatus: itemPckStatus,
            packingDescription: item.packingDescription,
            isCustomisation: Boolean(order.isCustomisation),
            customisationDetails: order.customisationDetails || null,
            hasPacket: Boolean(item.hasPacket)
          });
        } else {
          map.set(key, {
            itemId: item.itemId || key,
            itemCode: item.itemCode || 'ITEM',
            itemName: rawName,
            category: category,
            unit: item.unit || 'kg',
            imageUrl: item.imageUrl,
            manufacturingUnitName: mfgUnitName,
            packingUnitName: effectiveUnitName,
            totalQuantity: item.quantity || 0,
            orders: [
              {
                orderId: order.id,
                orderCode: order.code,
                customerName: order.customerName,
                slot: order.slot,
                quantity: item.quantity || 0,
                pckStatus: itemPckStatus,
                packingDescription: item.packingDescription,
                isCustomisation: Boolean(order.isCustomisation),
                customisationDetails: order.customisationDetails || null,
                hasPacket: Boolean(item.hasPacket)
              }
            ]
          });
        }
      });
    });

    return Array.from(map.values()).sort((a, b) => b.totalQuantity - a.totalQuantity);
  }, [orders, itemInfoMap, selectedUnit, searchTerm, isAllUnitsAllowed, accessiblePckUnits, pckUnits]);

  const filteredOrderWiseList = useMemo(() => {
    return orders.filter((order) => {
      if (!isOrderEligibleForPacking(order)) return false;

      // Order must have at least 1 item accessible and pending packing
      const hasPendingPackingItem = order.items?.some((item) => {
        const key = (item.itemName || (item as any).name || '').toLowerCase().trim();
        const masterInfo = itemInfoMap.get(key);
        const pckUnit = (item as any).packingUnitName || masterInfo?.pckUnitName || 'General Packing';

        if (!isItemAllowedForPacking(order, item, pckUnit)) return false;

        const itemMfgStatus = item.mfgStatus || (
          order.orderStatus === 'Moved to Packing' || order.orderStatus === 'Packing Started' || order.orderStatus === 'Moved to Store'
            ? 'Moved to Packing'
            : 'Pending'
        );
        const itemPckStatus = item.pckStatus || (
          order.orderStatus === 'Moved to Store'
            ? 'Moved to Store'
            : order.orderStatus === 'Packing Started'
            ? 'Packing Started'
            : 'Pending'
        );
        return itemMfgStatus === 'Moved to Packing' && itemPckStatus !== 'Moved to Store';
      });

      if (!hasPendingPackingItem) return false;

      if (searchTerm) {
        return (
          (order.code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          (order.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          order.items?.some((i) => (i.itemName || (i as any).name || '').toLowerCase().includes(searchTerm.toLowerCase()))
        );
      }

      return true;
    });
  }, [orders, selectedUnit, searchTerm, itemInfoMap, isAllUnitsAllowed, accessiblePckUnits, pckUnits]);

  // Helper to remove any undefined fields before writing to Firestore
  const sanitizeForFirestore = (obj: any): any => {
    if (obj === undefined) return null;
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) {
      return obj.map(sanitizeForFirestore);
    }
    const clean: any = {};
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (val !== undefined) {
        clean[key] = sanitizeForFirestore(val);
      }
    }
    return clean;
  };

  // Update item-level pckStatus for batch
  const handleBatchUpdateItemPckStatus = async (itemSummary: AggregatedPackingSummary, targetPckStatus: 'Packing Started' | 'Moved to Store') => {
    try {
      setUpdatingId(itemSummary.itemId);
      const batch = writeBatch(db);

      const targetOrderIds = Array.from(new Set(itemSummary.orders.map((o) => o.orderId)));

      targetOrderIds.forEach((ordId) => {
        const fullOrder = orders.find((o) => o.id === ordId);
        if (!fullOrder || !fullOrder.items) return;

        const updatedItems = fullOrder.items.map((it) => {
          const name = (it.itemName || (it as any).name || '').toLowerCase().trim();
          const targetName = (itemSummary.itemName || '').toLowerCase().trim();
          const isTarget = name && targetName && name === targetName;

          const newPckStatus = isTarget ? targetPckStatus : (it.pckStatus || 'Pending');
          const newMfgStatus = it.mfgStatus || 'Moved to Packing';

          const updated: any = {
            ...it,
            mfgStatus: newMfgStatus,
            pckStatus: newPckStatus,
          };
          return sanitizeForFirestore(updated);
        });

        // Determine overall order status
        const allItemsMovedToStore = updatedItems.every(
          (it: any) => it.pckStatus === 'Moved to Store'
        );

        const anyItemPackingStarted = updatedItems.some(
          (it: any) => it.pckStatus === 'Packing Started' || it.pckStatus === 'Moved to Store'
        );

        let newOrderStatus = fullOrder.orderStatus || 'Moved to Packing';
        if (allItemsMovedToStore) {
          newOrderStatus = 'Moved to Store';
        } else if (anyItemPackingStarted && fullOrder.orderStatus !== 'Moved to Store') {
          newOrderStatus = 'Packing Started';
        }

        const orderRef = doc(db, 'orders', ordId);
        batch.update(orderRef, sanitizeForFirestore({
          items: updatedItems,
          orderStatus: newOrderStatus,
          updatedAt: serverTimestamp()
        }));
      });

      await batch.commit();
    } catch (err) {
      console.error('Failed batch item packing status update:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  // Single Item status update inside order-wise view
  const handleSingleItemPckStatusUpdate = async (orderId: string, itemNameToUpdate: string, targetPckStatus: 'Packing Started' | 'Moved to Store') => {
    try {
      setUpdatingId(`${orderId}_${itemNameToUpdate}`);
      const fullOrder = orders.find((o) => o.id === orderId);
      if (!fullOrder || !fullOrder.items) return;

      const updatedItems = fullOrder.items.map((it) => {
        const name = (it.itemName || (it as any).name || '').toLowerCase().trim();
        const targetName = (itemNameToUpdate || '').toLowerCase().trim();
        const isTarget = name && targetName && name === targetName;

        const newPckStatus = isTarget ? targetPckStatus : (it.pckStatus || 'Pending');
        const newMfgStatus = it.mfgStatus || 'Moved to Packing';

        const updated: any = {
          ...it,
          mfgStatus: newMfgStatus,
          pckStatus: newPckStatus,
        };
        return sanitizeForFirestore(updated);
      });

      const allItemsMovedToStore = updatedItems.every(
        (it: any) => it.pckStatus === 'Moved to Store'
      );

      const anyItemPackingStarted = updatedItems.some(
        (it: any) => it.pckStatus === 'Packing Started' || it.pckStatus === 'Moved to Store'
      );

      let newOrderStatus = fullOrder.orderStatus || 'Moved to Packing';
      if (allItemsMovedToStore) {
        newOrderStatus = 'Moved to Store';
      } else if (anyItemPackingStarted && fullOrder.orderStatus !== 'Moved to Store') {
        newOrderStatus = 'Packing Started';
      }

      await updateDoc(doc(db, 'orders', orderId), sanitizeForFirestore({
        items: updatedItems,
        orderStatus: newOrderStatus,
        updatedAt: serverTimestamp()
      }));
    } catch (err) {
      console.error('Failed single item packing update:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  const queuedCount = aggregatedItems.filter((i) => i.orders.some((o) => o.pckStatus === 'Pending')).length;
  const activeCount = aggregatedItems.filter((i) => i.orders.some((o) => o.pckStatus === 'Packing Started')).length;

  return (
    <div className="w-full flex flex-col gap-4 text-slate-800 pb-12">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Package size={22} className="text-slate-800 stroke-[1.75]" />
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Packing & Dispatch Portal</h1>
        </div>

        {/* Dynamic Packing Unit Selector */}
        <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-lg border border-slate-300 shadow-2xs">
          <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <Building2 size={13} className="text-slate-500" /> Packing Unit:
          </span>
          <CustomSelect
            options={unitOptions}
            value={selectedUnit}
            onChange={(val) => setSelectedUnit(val)}
            size="sm"
            className="min-w-[200px]"
          />
        </div>
      </div>

      {/* Unassigned Packing Units Notice */}
      {!isAllUnitsAllowed && accessiblePckUnits.length === 0 && (
        <div className="bg-teal-50 border border-teal-200 p-6 rounded-2xl text-center space-y-2">
          <ShieldAlert size={36} className="text-[#02626D] mx-auto" />
          <h3 className="text-sm font-bold text-teal-950">No Packing Units Assigned</h3>
          <p className="text-xs text-teal-800 max-w-md mx-auto">
            You are logged in as <strong>{employeeProfile?.name || 'Staff'}</strong>, but no packing units have been assigned to your account. Please contact your SuperAdmin to assign units in the Employees section.
          </p>
        </div>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
            <Clock size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-semibold">Items Awaiting Packing</p>
            <h3 className="text-xl font-bold text-slate-900">{queuedCount} Unique Items</h3>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center flex-shrink-0">
            <Package size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-semibold">Items Currently Packing</p>
            <h3 className="text-xl font-bold text-slate-900">{activeCount} Active Lines</h3>
          </div>
        </div>
      </div>

      {/* TABS & SEARCH CONTAINER */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        {/* Controls header */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* TAB SWITCHER */}
          <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
            <button
              onClick={() => setActiveTab('item_wise')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'item_wise'
                  ? 'bg-white text-violet-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Boxes size={15} /> Item-Wise (Summed Packing Qty)
            </button>
            <button
              onClick={() => setActiveTab('order_wise')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'order_wise'
                  ? 'bg-white text-violet-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ListOrdered size={15} /> Order-Wise Packing List
            </button>
          </div>

          {/* SEARCH INPUT */}
          <div className="relative w-full md:w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={activeTab === 'item_wise' ? 'Search item name...' : 'Search order code or customer...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-4 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-violet-500 bg-white"
            />
          </div>
        </div>

        {/* LOADING STATE */}
        {isLoading ? (
          <div className="py-16 text-center text-slate-400 flex flex-col items-center gap-2">
            <Loader2 size={24} className="animate-spin text-violet-600" />
            <p className="text-xs font-semibold">Loading packing queue…</p>
          </div>
        ) : activeTab === 'item_wise' ? (
          /* ============================================================ */
          /* TAB 1: ITEM-WISE SUMMED TOTALS VIEW                          */
          /* ============================================================ */
          aggregatedItems.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <Package size={32} className="mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-bold text-slate-600">No active items pending packing for this Packing Unit</p>
              <p className="text-xs text-slate-400 mt-1">
                {selectedUnit === 'all'
                  ? 'Items moved from cooking will appear here for packaging.'
                  : `No items assigned to "${selectedUnit}" are currently awaiting packing.`}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {aggregatedItems.map((item) => {
                const isUpdating = updatingId === item.itemId;

                return (
                  <div key={item.itemId} className="p-5 hover:bg-slate-50/50 transition-colors space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      
                      {/* Left: Item Info & Badges */}
                      <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-xl bg-violet-50 text-violet-700 flex items-center justify-center font-bold text-lg border border-violet-100 flex-shrink-0">
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt={item.itemName} className="w-full h-full object-cover rounded-xl" />
                          ) : (
                            <Package size={24} />
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-bold text-slate-900">{item.itemName}</h3>
                            
                            {/* Assigned Packing Unit Badge */}
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-violet-50 text-violet-800 border border-violet-200 flex items-center gap-1">
                              <Building2 size={11} /> {item.packingUnitName}
                            </span>

                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 uppercase border border-slate-200">
                              {item.category}
                            </span>
                          </div>
                          
                          <p className="text-xs text-slate-500 mt-1">
                            Pending Packing in <span className="font-bold text-slate-800">{item.orders.length} Active Orders</span>
                          </p>
                        </div>
                      </div>

                      {/* Middle: SUMMED TOTAL WEIGHT / QUANTITY HIGHLIGHT */}
                      <div className="bg-violet-50/80 px-4 py-2 rounded-xl border border-violet-100 flex items-center gap-3">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-violet-800">Summed Packing Quantity</span>
                          <p className="text-lg font-extrabold text-violet-900 font-mono">
                            {item.totalQuantity} {item.unit}
                          </p>
                        </div>
                      </div>

                      {/* Right: ITEM-LEVEL BATCH ACTION BUTTONS */}
                      <div className="flex items-center gap-2">
                        <button
                          disabled={isUpdating}
                          onClick={() => handleBatchUpdateItemPckStatus(item, 'Packing Started')}
                          className="px-3.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {isUpdating ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <>
                              <Play size={14} /> Start Batch Packing
                            </>
                          )}
                        </button>

                        <button
                          disabled={isUpdating}
                          onClick={() => handleBatchUpdateItemPckStatus(item, 'Moved to Store')}
                          className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {isUpdating ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <>
                              <Store size={14} /> Finish & Move to Store
                            </>
                          )}
                        </button>
                      </div>

                    </div>

                    {/* Breakdown of Orders requesting this item */}
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                        Orders Breakdown requesting {item.itemName}:
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {item.orders.map((ord, idx) => (
                          <div key={idx} className="bg-white p-2.5 rounded-lg border border-slate-200 text-xs space-y-1.5 flex flex-col justify-between">
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <div>
                                  <span className="font-mono font-bold text-slate-800">{ord.orderCode}</span>
                                  <p className="text-[11px] text-slate-500">{ord.customerName} ({ord.slot})</p>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-bold text-violet-700 bg-violet-50 px-2 py-0.5 rounded border border-violet-100">
                                    {ord.quantity} {item.unit}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSwitchModalData({
                                        isOpen: true,
                                        orderId: ord.orderId,
                                        orderCode: ord.orderCode,
                                        targetType: 'item',
                                        itemName: item.itemName,
                                        currentUnitName: item.packingUnitName,
                                      });
                                    }}
                                    className="p-1 text-slate-400 hover:text-[#02626D] hover:bg-teal-50 rounded transition-colors cursor-pointer border border-transparent hover:border-teal-200"
                                    title={`Send ${item.itemName} for order ${ord.orderCode} to another packing unit (Requires OTP)`}
                                  >
                                    <ArrowRightLeft size={12} />
                                  </button>
                                </div>
                              </div>

                              {/* Customisation Badge if applicable */}
                              {ord.isCustomisation && ord.customisationDetails && (
                                <div className="p-2 rounded-lg bg-amber-50/90 border border-amber-200 text-[11px] space-y-1">
                                  <div className="flex items-center justify-between font-bold text-amber-950">
                                    <span className="flex items-center gap-1">
                                      <Boxes size={12} className="text-amber-700 flex-shrink-0" />
                                      <span>Custom ({ord.customisationDetails.noOfBoxes || 1} {ord.customisationDetails.noOfBoxes === 1 ? 'Box' : 'Boxes'})</span>
                                    </span>
                                    <span className="text-[10px] bg-amber-200/80 text-amber-900 px-1.5 py-0.2 rounded border border-amber-300 font-semibold truncate max-w-[120px]">
                                      {ord.customisationDetails.boxType || 'Custom Box'}
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap gap-1 text-[10px] text-amber-900 font-medium">
                                    {ord.customisationDetails.hasSticker && (
                                      <span className="bg-white/90 px-1.5 py-0.5 rounded border border-amber-200">
                                        🏷️ {ord.customisationDetails.stickerType || 'Sticker'}
                                      </span>
                                    )}
                                    {ord.customisationDetails.hasShrink && (
                                      <span className="bg-white/90 px-1.5 py-0.5 rounded border border-amber-200">
                                        ✨ {ord.customisationDetails.shrinkType || 'Shrink Wrap'}
                                      </span>
                                    )}
                                  </div>
                                  {ord.customisationDetails.boxImageUrl && (
                                    <div className="pt-1 flex items-center gap-2">
                                      <img
                                        src={ord.customisationDetails.boxImageUrl}
                                        alt="Custom Box"
                                        className="w-8 h-8 rounded border border-amber-300 object-cover shadow-2xs"
                                      />
                                      <span className="text-[10px] text-amber-800 font-semibold">Custom Design</span>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Packet badge if applicable */}
                              {ord.hasPacket && (
                                <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                                  <span>🛍️ Packet Required</span>
                                </div>
                              )}

                              {/* Packing Description / Notes */}
                              {ord.packingDescription && (
                                <p className="text-[11px] font-medium text-orange-900 bg-orange-50/90 px-2 py-1 rounded-md border border-orange-200 flex items-start gap-1">
                                  <span>📦</span>
                                  <span><strong>Packing Note:</strong> {ord.packingDescription}</span>
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          )
        ) : (
          /* ============================================================ */
          /* TAB 2: ORDER-WISE LIST VIEW                                  */
          /* ============================================================ */
          filteredOrderWiseList.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <Package size={32} className="mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-bold text-slate-600">No orders found for this Packing Unit</p>
              <p className="text-xs text-slate-400 mt-1">Orders assigned to this unit will appear here.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredOrderWiseList.map((order) => {
                return (
                  <div key={order.id} className="p-5 hover:bg-slate-50/50 transition-colors space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-xs text-violet-700 bg-violet-50 px-2.5 py-1 rounded-lg border border-violet-100">
                          {order.code}
                        </span>
                        <h3 className="text-sm font-bold text-slate-900">{order.customerName}</h3>
                        <span className="text-xs text-slate-400">• Slot: {order.slot}</span>
                        {order.isCustomisation && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                            Customisation
                          </span>
                        )}
                        {order.isTransportRequired && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200">
                            Transport
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
                          Overall Status: {order.orderStatus}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const currentUnit = (order as any).packingUnitOverride || (order.items?.[0] as any)?.packingUnitOverride || (order.items?.[0] as any)?.packingUnitName || 'General Packing';
                            setSwitchModalData({
                              isOpen: true,
                              orderId: order.id,
                              orderCode: order.code,
                              targetType: 'order',
                              currentUnitName: currentUnit,
                            });
                          }}
                          className="px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-[#02626D] text-xs font-bold border border-teal-200 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                          title="Switch entire order to another packing unit (Requires OTP authorization)"
                        >
                          <ArrowRightLeft size={13} />
                          <span>Send to other unit</span>
                        </button>
                      </div>
                    </div>

                    {/* Customisation Box Banner if present */}
                    {order.isCustomisation && order.customisationDetails && (
                      <div className="p-3.5 rounded-xl bg-amber-50/90 border border-amber-200/90 shadow-2xs space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="p-1 rounded-md bg-amber-200/70 text-amber-900">
                              <Boxes size={14} />
                            </span>
                            <span className="text-xs font-extrabold text-amber-950 uppercase tracking-wider">
                              Customisation Order Details
                            </span>
                          </div>
                          <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-amber-200 text-amber-950 border border-amber-300">
                            📦 {order.customisationDetails.noOfBoxes} {order.customisationDetails.noOfBoxes === 1 ? 'Box' : 'Boxes'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-white/80 p-2.5 rounded-lg border border-amber-200/70">
                          <div>
                            <p className="text-[10px] text-amber-900/70 font-bold uppercase tracking-wider">Box Type</p>
                            <p className="font-extrabold text-slate-800">{order.customisationDetails.boxType || 'Standard Box'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-amber-900/70 font-bold uppercase tracking-wider">Sticker</p>
                            <p className="font-extrabold text-slate-800">
                              {order.customisationDetails.hasSticker ? (order.customisationDetails.stickerType || 'Yes (Custom Sticker)') : 'No'}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-amber-900/70 font-bold uppercase tracking-wider">Shrink Wrap</p>
                            <p className="font-extrabold text-slate-800">
                              {order.customisationDetails.hasShrink ? (order.customisationDetails.shrinkType || 'Yes (Shrink Wrap)') : 'No'}
                            </p>
                          </div>
                          {order.customisationDetails.boxImageUrl && (
                            <div className="flex items-center gap-2">
                              <img
                                src={order.customisationDetails.boxImageUrl}
                                alt="Custom Box"
                                className="w-9 h-9 rounded-md border border-amber-300 object-cover shadow-2xs"
                              />
                              <div>
                                <p className="text-[10px] text-amber-900/70 font-bold uppercase tracking-wider">Box Preview</p>
                                <p className="text-[11px] font-bold text-amber-900">Custom Box</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Transport Details Banner if present */}
                    {order.isTransportRequired && (
                      <div className="p-3 rounded-xl bg-teal-50/90 border border-teal-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-teal-800">🚚</span>
                          <span className="text-xs font-extrabold text-teal-950 uppercase tracking-wider">
                            Transport &amp; Delivery Logistics
                          </span>
                        </div>
                        {order.deliveryAddress && (
                          <span className="text-xs font-semibold text-teal-900">
                            <strong className="text-teal-950">Destination:</strong> {order.deliveryAddress}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Items List for this order */}
                    <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200/80">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">Order Items to Pack</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {order.items?.filter((item) => {
                          const key = (item.itemName || '').toLowerCase().trim();
                          const masterInfo = itemInfoMap.get(key);
                          const pckUnit = (item as any).packingUnitName || masterInfo?.pckUnitName || 'General Packing';
                          return isItemAllowedForPacking(order, item, pckUnit);
                        }).map((item, idx) => {
                          const key = (item.itemName || '').toLowerCase().trim();
                          const masterInfo = itemInfoMap.get(key);
                          const pckUnit = (item as any).packingUnitName || masterInfo?.pckUnitName || 'General Packing';
                          const effectiveUnit = getEffectivePackingUnitName(order, item, pckUnit, pckUnits);

                          const itemMfgStatus = item.mfgStatus || (
                            order.orderStatus === 'Moved to Packing' || order.orderStatus === 'Packing Started' || order.orderStatus === 'Moved to Store'
                              ? 'Moved to Packing'
                              : 'Pending'
                          );

                          const itemPckStatus = item.pckStatus || (
                            order.orderStatus === 'Moved to Store'
                              ? 'Moved to Store'
                              : order.orderStatus === 'Packing Started'
                              ? 'Packing Started'
                              : 'Pending'
                          );

                          // Only render items that have finished cooking and are not yet moved to store
                          if (itemMfgStatus !== 'Moved to Packing') return null;

                          const isUpdatingSingle = updatingId === `${order.id}_${item.itemName}`;
                          const isMovedToStore = itemPckStatus === 'Moved to Store';

                          return (
                            <div key={idx} className="bg-white rounded-lg p-3 border border-slate-200 text-xs space-y-2 flex flex-col justify-between">
                              <div className="space-y-1">
                                <div className="flex justify-between items-center font-bold text-slate-800">
                                  <span>{item.itemName}</span>
                                  <span className="text-violet-600">{item.quantity} {item.unit}</span>
                                </div>
                                
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <p className="text-[10px] text-slate-400 flex items-center gap-1">
                                      <Building2 size={10} className="text-violet-600" /> {effectiveUnit}
                                    </p>
                                    {item.hasPacket && (
                                      <span className="text-[9px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                                        🛍️ Packet
                                      </span>
                                    )}
                                  </div>
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                    isMovedToStore
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : itemPckStatus === 'Packing Started'
                                      ? 'bg-violet-100 text-violet-700'
                                      : 'bg-amber-100 text-amber-700'
                                  }`}>
                                    {itemPckStatus}
                                  </span>
                                </div>

                                {/* Packing Description / Notes */}
                                {item.packingDescription && (
                                  <p className="text-[11px] font-medium text-orange-900 bg-orange-50/90 px-2 py-1 rounded-md border border-orange-200 flex items-start gap-1">
                                    <span>📦</span>
                                    <span><strong>Packing Note:</strong> {item.packingDescription}</span>
                                  </p>
                                )}
                              </div>

                              {/* Action Row */}
                              <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5">
                                {!isMovedToStore ? (
                                  <>
                                    <button
                                      disabled={isUpdatingSingle}
                                      onClick={() => handleSingleItemPckStatusUpdate(order.id, item.itemName, 'Packing Started')}
                                      className="flex-1 py-1 rounded bg-violet-600 hover:bg-violet-700 text-white text-[11px] font-bold transition-all shadow-xs flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                                    >
                                      {isUpdatingSingle ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />} Start
                                    </button>

                                    <button
                                      disabled={isUpdatingSingle}
                                      onClick={() => handleSingleItemPckStatusUpdate(order.id, item.itemName, 'Moved to Store')}
                                      className="flex-1 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition-all shadow-xs flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                                    >
                                      {isUpdatingSingle ? <Loader2 size={11} className="animate-spin" /> : <Store size={11} />} Complete
                                    </button>
                                  </>
                                ) : (
                                  <div className="pt-1 text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                                    <CheckCircle2 size={12} /> Moved to Store
                                  </div>
                                )}

                                {/* Switch Item Unit Button */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSwitchModalData({
                                      isOpen: true,
                                      orderId: order.id,
                                      orderCode: order.code,
                                      targetType: 'item',
                                      itemName: item.itemName,
                                      currentUnitName: effectiveUnit,
                                    });
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-[#02626D] hover:bg-teal-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-teal-200"
                                  title={`Send ${item.itemName} to another packing unit (Requires OTP)`}
                                >
                                  <ArrowRightLeft size={13} />
                                </button>
                              </div>

                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>

      {/* Switch Packing Unit Modal (OTP Protected) */}
      <SwitchPackingUnitModal
        isOpen={switchModalData.isOpen}
        onClose={() => setSwitchModalData((prev) => ({ ...prev, isOpen: false }))}
        orderId={switchModalData.orderId}
        orderCode={switchModalData.orderCode}
        targetType={switchModalData.targetType}
        itemName={switchModalData.itemName}
        currentUnitName={switchModalData.currentUnitName}
        pckUnits={pckUnits}
        userEmail={employeeProfile ? `${employeeProfile.name} (${employeeProfile.empId || employeeProfile.mobile})` : 'Packing Portal Manager'}
      />

    </div>
  );
}

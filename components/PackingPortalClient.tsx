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
  Building2
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, updateDoc, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import type { OrderRecord, OrderItemLine } from './OrdersClient';
import CustomSelect from '@/components/CustomSelect';

export interface DynamicUnit {
  id: string;
  code: string;
  name: string;
  status: string;
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
  }[];
}

export default function PackingPortalClient() {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [pckUnits, setPckUnits] = useState<DynamicUnit[]>([]);
  const [itemInfoMap, setItemInfoMap] = useState<Map<string, ItemMasterInfo>>(new Map());

  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('all');
  const [activeTab, setActiveTab] = useState<'item_wise' | 'order_wise'>('item_wise');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // 1. Subscribe to real-time packing units
  useEffect(() => {
    const unsubUnits = onSnapshot(
      collection(db, 'packing_units'),
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<DynamicUnit, 'id'>)
        }));
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

  // Unit options
  const unitOptions = useMemo(() => {
    const opts = [{ value: 'all', label: 'All Packing Units' }];
    pckUnits.forEach((u) => {
      opts.push({
        value: u.name,
        label: `${u.name} (${u.code})`
      });
    });
    return opts;
  }, [pckUnits]);

  // Aggregate items across active packing stage orders (mfgStatus === 'Moved to Packing' AND pckStatus !== 'Moved to Store')
  const aggregatedItems = useMemo(() => {
    const map = new Map<string, AggregatedPackingSummary>();

    orders.forEach((order) => {
      const st = order.orderStatus as string;
      if (st === 'Delivered' || st === 'Cancelled') return;

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

        // Filter by selected Packing Unit
        if (selectedUnit !== 'all' && pckUnitName.toLowerCase() !== selectedUnit.toLowerCase()) {
          return;
        }

        // Apply Search Term
        if (
          searchTerm &&
          !rawName.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !category.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !order.code.toLowerCase().includes(searchTerm.toLowerCase())
        ) {
          return;
        }

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
            packingDescription: item.packingDescription
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
            packingUnitName: pckUnitName,
            totalQuantity: item.quantity || 0,
            orders: [
              {
                orderId: order.id,
                orderCode: order.code,
                customerName: order.customerName,
                slot: order.slot,
                quantity: item.quantity || 0,
                pckStatus: itemPckStatus,
                packingDescription: item.packingDescription
              }
            ]
          });
        }
      });
    });

    return Array.from(map.values()).sort((a, b) => b.totalQuantity - a.totalQuantity);
  }, [orders, itemInfoMap, selectedUnit, searchTerm]);

  // Order-wise active packing list
  const filteredOrderWiseList = useMemo(() => {
    return orders.filter((order) => {
      const st = order.orderStatus as string;
      if (st === 'Delivered' || st === 'Cancelled') return false;

      // Order must have at least 1 item pending packing
      const hasPendingPackingItem = order.items?.some((item) => {
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

      if (selectedUnit !== 'all') {
        const hasMatchingItem = order.items?.some((i) => {
          const key = (i.itemName || (i as any).name || '').toLowerCase().trim();
          const masterInfo = itemInfoMap.get(key);
          const unit = (i as any).packingUnitName || masterInfo?.pckUnitName || 'General Packing';
          return (unit || '').toLowerCase() === selectedUnit.toLowerCase();
        });
        if (!hasMatchingItem) return false;
      }

      if (searchTerm) {
        return (
          (order.code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          (order.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          order.items?.some((i) => (i.itemName || (i as any).name || '').toLowerCase().includes(searchTerm.toLowerCase()))
        );
      }

      return true;
    });
  }, [orders, selectedUnit, searchTerm, itemInfoMap]);

  // Update item-level pckStatus for batch
  const handleBatchUpdateItemPckStatus = async (itemSummary: AggregatedPackingSummary, targetPckStatus: 'Packing Started' | 'Moved to Store') => {
    try {
      setUpdatingId(itemSummary.itemId);
      const batch = writeBatch(db);

      const targetOrderIds = Array.from(new Set(itemSummary.orders.map((o) => o.orderId)));

      targetOrderIds.forEach((ordId) => {
        const fullOrder = orders.find((o) => o.id === ordId);
        if (!fullOrder || !fullOrder.items) return;

        const updatedItems: OrderItemLine[] = fullOrder.items.map((it) => {
          const name = (it.itemName || (it as any).name || '').toLowerCase().trim();
          const targetName = (itemSummary.itemName || '').toLowerCase().trim();
          if (name && targetName && name === targetName) {
            return {
              ...it,
              pckStatus: targetPckStatus
            };
          }
          return it;
        });

        // Determine overall order status
        const allItemsMovedToStore = updatedItems.every(
          (it) => it.pckStatus === 'Moved to Store'
        );

        const anyItemPackingStarted = updatedItems.some(
          (it) => it.pckStatus === 'Packing Started' || it.pckStatus === 'Moved to Store'
        );

        let newOrderStatus = fullOrder.orderStatus;
        if (allItemsMovedToStore) {
          newOrderStatus = 'Moved to Store';
        } else if (anyItemPackingStarted && fullOrder.orderStatus !== 'Moved to Store') {
          newOrderStatus = 'Packing Started';
        }

        const orderRef = doc(db, 'orders', ordId);
        batch.update(orderRef, {
          items: updatedItems,
          orderStatus: newOrderStatus,
          updatedAt: serverTimestamp()
        });
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

      const updatedItems: OrderItemLine[] = fullOrder.items.map((it) => {
        const name = (it.itemName || (it as any).name || '').toLowerCase().trim();
        const targetName = (itemNameToUpdate || '').toLowerCase().trim();
        if (name && targetName && name === targetName) {
          return {
            ...it,
            pckStatus: targetPckStatus
          };
        }
        return it;
      });

      const allItemsMovedToStore = updatedItems.every(
        (it) => it.pckStatus === 'Moved to Store'
      );

      const anyItemPackingStarted = updatedItems.some(
        (it) => it.pckStatus === 'Packing Started' || it.pckStatus === 'Moved to Store'
      );

      let newOrderStatus = fullOrder.orderStatus;
      if (allItemsMovedToStore) {
        newOrderStatus = 'Moved to Store';
      } else if (anyItemPackingStarted && fullOrder.orderStatus !== 'Moved to Store') {
        newOrderStatus = 'Packing Started';
      }

      await updateDoc(doc(db, 'orders', orderId), {
        items: updatedItems,
        orderStatus: newOrderStatus,
        updatedAt: serverTimestamp()
      });
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
                          <div key={idx} className="bg-white p-2.5 rounded-lg border border-slate-200 text-xs space-y-1.5">
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="font-mono font-bold text-slate-800">{ord.orderCode}</span>
                                <p className="text-[11px] text-slate-500">{ord.customerName} ({ord.slot})</p>
                              </div>
                              <span className="font-mono font-bold text-violet-700 bg-violet-50 px-2 py-0.5 rounded border border-violet-100">
                                {ord.quantity} {item.unit}
                              </span>
                            </div>

                            {/* Packing Description / Notes */}
                            {ord.packingDescription && (
                              <p className="text-[11px] font-medium text-violet-800 bg-violet-50/90 px-2 py-1 rounded-md border border-violet-100 flex items-start gap-1">
                                <span>📦</span>
                                <span><strong>Packing Note:</strong> {ord.packingDescription}</span>
                              </p>
                            )}
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
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-xs text-violet-700 bg-violet-50 px-2.5 py-1 rounded-lg border border-violet-100">
                          {order.code}
                        </span>
                        <h3 className="text-sm font-bold text-slate-900">{order.customerName}</h3>
                        <span className="text-xs text-slate-400">• Slot: {order.slot}</span>
                      </div>

                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
                        Overall Order Status: {order.orderStatus}
                      </span>
                    </div>

                    {/* Items List for this order */}
                    <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200/80">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">Order Items to Pack</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {order.items?.map((item, idx) => {
                          const key = (item.itemName || '').toLowerCase().trim();
                          const masterInfo = itemInfoMap.get(key);
                          const pckUnit = (item as any).packingUnitName || masterInfo?.pckUnitName || 'General Packing';

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
                                  <p className="text-[10px] text-slate-400 flex items-center gap-1">
                                    <Building2 size={10} className="text-violet-600" /> {pckUnit}
                                  </p>
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
                                  <p className="text-[11px] font-medium text-violet-800 bg-violet-50/90 px-2 py-1 rounded-md border border-violet-100 flex items-start gap-1">
                                    <span>📦</span>
                                    <span><strong>Packing Note:</strong> {item.packingDescription}</span>
                                  </p>
                                )}
                              </div>

                              {/* Single Item Action */}
                              {!isMovedToStore ? (
                                <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5">
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
                                </div>
                              ) : (
                                <div className="pt-1 text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                                  <CheckCircle2 size={12} /> Moved to Store
                                </div>
                              )}

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
    </div>
  );
}

'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Factory,
  CheckCircle2,
  Clock,
  Flame,
  Search,
  Play,
  Check,
  ChevronRight,
  Loader2,
  Package,
  Boxes,
  ListOrdered,
  ChefHat,
  Building2,
  Calendar,
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, updateDoc, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import type { OrderRecord, OrderItemLine } from './OrdersClient';
import CustomSelect from '@/components/CustomSelect';
import CustomDatePicker from '@/components/CustomDatePicker';

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

export interface AggregatedItemSummary {
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
    mfgStatus: 'Pending' | 'Manufacturing Started' | 'Moved to Packing';
    manufacturingDescription?: string;
  }[];
}

export default function ManufacturingPortalClient() {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [mfgUnits, setMfgUnits] = useState<DynamicUnit[]>([]);
  const [itemInfoMap, setItemInfoMap] = useState<Map<string, ItemMasterInfo>>(new Map());
  
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('all');
  const [selectedMfgDate, setSelectedMfgDate] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'item_wise' | 'order_wise'>('item_wise');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Extract all manufacturing dates from active orders
  const availableMfgDates = useMemo(() => {
    const dateSet = new Set<string>();
    orders.forEach((o) => {
      const d = o.manufacturingDate || o.orderDate;
      if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
        dateSet.add(d);
      }
    });
    return Array.from(dateSet).sort().reverse();
  }, [orders]);

  // Filter orders by selected manufacturing date
  const filteredOrders = useMemo(() => {
    if (!selectedMfgDate || selectedMfgDate === 'all') return orders;
    return orders.filter((o) => {
      const d = o.manufacturingDate || o.orderDate;
      return d === selectedMfgDate;
    });
  }, [orders, selectedMfgDate]);

  // 1. Subscribe to real-time manufacturing units
  useEffect(() => {
    const unsubUnits = onSnapshot(
      collection(db, 'manufacturing_units'),
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<DynamicUnit, 'id'>)
        }));
        setMfgUnits(list.filter((u) => u.status !== 'Inactive'));
      },
      (err) => console.error('Error fetching manufacturing units:', err)
    );
    return () => unsubUnits();
  }, []);

  // 2. Subscribe to Item Master to retrieve assigned Manufacturing & Packing units
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
        console.error('Error fetching orders for manufacturing:', err);
        setIsLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // Unit Options
  const unitOptions = useMemo(() => {
    const opts = [{ value: 'all', label: 'All Manufacturing Units' }];
    mfgUnits.forEach((u) => {
      opts.push({
        value: u.name,
        label: `${u.name} (${u.code})`
      });
    });
    return opts;
  }, [mfgUnits]);

  // Aggregate items across active orders that are still pending cooking in Manufacturing (mfgStatus !== 'Moved to Packing')
  const aggregatedItems = useMemo(() => {
    const map = new Map<string, AggregatedItemSummary>();

    filteredOrders.forEach((order) => {
      // Ignore delivered or cancelled orders
      const st = order.orderStatus as string;
      if (st === 'Delivered' || st === 'Cancelled') return;

      (order.items || []).forEach((item) => {
        const itemMfgStatus = item.mfgStatus || (
          order.orderStatus === 'Moved to Packing' || order.orderStatus === 'Packing Started' || order.orderStatus === 'Packing Completed' || order.orderStatus === 'Moved to Store'
            ? 'Moved to Packing'
            : order.orderStatus === 'Manufacturing Started'
            ? 'Manufacturing Started'
            : 'Pending'
        );

        // If item has already moved to packing, omit it from manufacturing queue!
        if (itemMfgStatus === 'Moved to Packing') return;

        const rawName = item.itemName || 'Unknown Item';
        const key = rawName.toLowerCase().trim();
        const masterInfo = itemInfoMap.get(key);

        const mfgUnitName = (item as any).manufacturingUnitName || masterInfo?.mfgUnitName || 'General Kitchen';
        const pckUnitName = (item as any).packingUnitName || masterInfo?.pckUnitName || 'General Packing';
        const category = item.category || masterInfo?.category || 'General';

        // Filter by selected Manufacturing Unit
        if (selectedUnit !== 'all' && mfgUnitName.toLowerCase() !== selectedUnit.toLowerCase()) {
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
            mfgStatus: itemMfgStatus,
            manufacturingDescription: item.manufacturingDescription
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
                mfgStatus: itemMfgStatus,
                manufacturingDescription: item.manufacturingDescription
              }
            ]
          });
        }
      });
    });

    return Array.from(map.values()).sort((a, b) => b.totalQuantity - a.totalQuantity);
  }, [filteredOrders, itemInfoMap, selectedUnit, searchTerm]);

  // Order-wise active manufacturing list
  const filteredOrderWiseList = useMemo(() => {
    return filteredOrders.filter((order) => {
      const st = order.orderStatus as string;
      if (st === 'Delivered' || st === 'Cancelled') return false;

      // Order must have at least 1 item still pending manufacturing
      const hasPendingItem = order.items?.some((item) => {
        const status = item.mfgStatus || (
          order.orderStatus === 'Moved to Packing' || order.orderStatus === 'Packing Started' || order.orderStatus === 'Moved to Store'
            ? 'Moved to Packing'
            : order.orderStatus === 'Manufacturing Started'
            ? 'Manufacturing Started'
            : 'Pending'
        );
        return status !== 'Moved to Packing';
      });

      if (!hasPendingItem) return false;

      if (selectedUnit !== 'all') {
        const hasMatchingItem = order.items?.some((i) => {
          const key = (i.itemName || '').toLowerCase().trim();
          const masterInfo = itemInfoMap.get(key);
          const unit = (i as any).manufacturingUnitName || masterInfo?.mfgUnitName || 'General Kitchen';
          return unit.toLowerCase() === selectedUnit.toLowerCase();
        });
        if (!hasMatchingItem) return false;
      }

      if (searchTerm) {
        return (
          order.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
          order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          order.items?.some((i) => i.itemName.toLowerCase().includes(searchTerm.toLowerCase()))
        );
      }

      return true;
    });
  }, [filteredOrders, selectedUnit, searchTerm, itemInfoMap]);

  // Update item-level mfgStatus for an entire batch or single item
  const handleBatchUpdateItemMfgStatus = async (itemSummary: AggregatedItemSummary, targetMfgStatus: 'Manufacturing Started' | 'Moved to Packing') => {
    try {
      setUpdatingId(itemSummary.itemId);
      const batch = writeBatch(db);

      // Collect unique order IDs
      const targetOrderIds = Array.from(new Set(itemSummary.orders.map((o) => o.orderId)));

      targetOrderIds.forEach((ordId) => {
        const fullOrder = orders.find((o) => o.id === ordId);
        if (!fullOrder || !fullOrder.items) return;

        const updatedItems: OrderItemLine[] = fullOrder.items.map((it) => {
          if (it.itemName.toLowerCase().trim() === itemSummary.itemName.toLowerCase().trim()) {
            return {
              ...it,
              mfgStatus: targetMfgStatus,
              pckStatus: targetMfgStatus === 'Moved to Packing' ? (it.pckStatus || 'Pending') : it.pckStatus
            };
          }
          return it;
        });

        // Determine overall order status
        const allItemsMovedToPacking = updatedItems.every(
          (it) => it.mfgStatus === 'Moved to Packing'
        );

        const anyItemStarted = updatedItems.some(
          (it) => it.mfgStatus === 'Manufacturing Started' || it.mfgStatus === 'Moved to Packing'
        );

        let newOrderStatus = fullOrder.orderStatus;
        if (allItemsMovedToPacking) {
          newOrderStatus = 'Moved to Packing';
        } else if (anyItemStarted && fullOrder.orderStatus !== 'Moved to Packing') {
          newOrderStatus = 'Manufacturing Started';
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
      console.error('Failed batch item mfg status update:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  // Single Item status update inside order-wise view
  const handleSingleItemMfgStatusUpdate = async (orderId: string, itemNameToUpdate: string, targetMfgStatus: 'Manufacturing Started' | 'Moved to Packing') => {
    try {
      setUpdatingId(`${orderId}_${itemNameToUpdate}`);
      const fullOrder = orders.find((o) => o.id === orderId);
      if (!fullOrder || !fullOrder.items) return;

      const updatedItems: OrderItemLine[] = fullOrder.items.map((it) => {
        if (it.itemName.toLowerCase().trim() === itemNameToUpdate.toLowerCase().trim()) {
          return {
            ...it,
            mfgStatus: targetMfgStatus,
            pckStatus: targetMfgStatus === 'Moved to Packing' ? (it.pckStatus || 'Pending') : it.pckStatus
          };
        }
        return it;
      });

      const allItemsMovedToPacking = updatedItems.every(
        (it) => it.mfgStatus === 'Moved to Packing'
      );

      const anyItemStarted = updatedItems.some(
        (it) => it.mfgStatus === 'Manufacturing Started' || it.mfgStatus === 'Moved to Packing'
      );

      let newOrderStatus = fullOrder.orderStatus;
      if (allItemsMovedToPacking) {
        newOrderStatus = 'Moved to Packing';
      } else if (anyItemStarted && fullOrder.orderStatus !== 'Moved to Packing') {
        newOrderStatus = 'Manufacturing Started';
      }

      await updateDoc(doc(db, 'orders', orderId), {
        items: updatedItems,
        orderStatus: newOrderStatus,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error('Failed single item status update:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  // Metrics counts based on items status
  const queuedCount = aggregatedItems.filter((i) => i.orders.some((o) => o.mfgStatus === 'Pending')).length;
  const activeCount = aggregatedItems.filter((i) => i.orders.some((o) => o.mfgStatus === 'Manufacturing Started')).length;

  return (
    <div className="w-full flex flex-col gap-4 text-slate-800 pb-12">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Factory size={22} className="text-slate-800 stroke-[1.75]" />
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Manufacturing Portal</h1>
        </div>

        {/* Manufacturing Date & Dynamic Unit Selectors */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-lg border border-slate-300 shadow-2xs">
            <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Calendar size={13} className="text-slate-500" /> Mfg Date:
            </span>
            <CustomDatePicker
              value={selectedMfgDate}
              onChange={(val) => setSelectedMfgDate(val)}
              allowAll={true}
              size="sm"
            />
          </div>

          <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
            <span className="text-xs font-bold text-slate-700 pl-1 flex items-center gap-1.5">
              <Building2 size={14} className="text-teal-600" /> Unit:
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
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
            <Clock size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-semibold">Queued Items to Cook</p>
            <h3 className="text-xl font-bold text-slate-900">{queuedCount} Unique Items</h3>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center flex-shrink-0">
            <Flame size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-semibold">Items Currently Cooking</p>
            <h3 className="text-xl font-bold text-slate-900">{activeCount} Batches Active</h3>
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
                  ? 'bg-white text-teal-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Boxes size={15} /> Item-Wise (Summed Cooking Qty)
            </button>
            <button
              onClick={() => setActiveTab('order_wise')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'order_wise'
                  ? 'bg-white text-teal-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ListOrdered size={15} /> Order-Wise Manufacturing List
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
              className="w-full pl-8 pr-4 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500 bg-white"
            />
          </div>
        </div>

        {/* LOADING STATE */}
        {isLoading ? (
          <div className="py-16 text-center text-slate-400 flex flex-col items-center gap-2">
            <Loader2 size={24} className="animate-spin text-teal-600" />
            <p className="text-xs font-semibold">Loading manufacturing queue…</p>
          </div>
        ) : activeTab === 'item_wise' ? (
          /* ============================================================ */
          /* TAB 1: ITEM-WISE SUMMED TOTALS VIEW                          */
          /* ============================================================ */
          aggregatedItems.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <Boxes size={32} className="mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-bold text-slate-600">No active items pending cooking for this Manufacturing Unit</p>
              <p className="text-xs text-slate-400 mt-1">
                {selectedUnit === 'all'
                  ? 'Items requiring kitchen cooking will appear here.'
                  : `No items assigned to "${selectedUnit}" are currently pending cooking.`}
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
                        <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-lg border border-teal-100 flex-shrink-0">
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt={item.itemName} className="w-full h-full object-cover rounded-xl" />
                          ) : (
                            <ChefHat size={24} />
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-bold text-slate-900">{item.itemName}</h3>
                            
                            {/* Assigned Manufacturing Unit Badge */}
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 border border-teal-200 flex items-center gap-1">
                              <Building2 size={11} /> {item.manufacturingUnitName}
                            </span>

                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 uppercase border border-slate-200">
                              {item.category}
                            </span>
                          </div>
                          
                          <p className="text-xs text-slate-500 mt-1">
                            Pending Cooking in <span className="font-bold text-slate-800">{item.orders.length} Active Orders</span>
                          </p>
                        </div>
                      </div>

                      {/* Middle: SUMMED TOTAL WEIGHT / QUANTITY HIGHLIGHT */}
                      <div className="bg-teal-50/80 px-4 py-2 rounded-xl border border-teal-100 flex items-center gap-3">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800">Summed Cooking Quantity</span>
                          <p className="text-lg font-extrabold text-teal-900 font-mono">
                            {item.totalQuantity} {item.unit}
                          </p>
                        </div>
                      </div>

                      {/* Right: ITEM-LEVEL BATCH ACTION BUTTONS */}
                      <div className="flex items-center gap-2">
                        <button
                          disabled={isUpdating}
                          onClick={() => handleBatchUpdateItemMfgStatus(item, 'Manufacturing Started')}
                          className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {isUpdating ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <>
                              <Play size={14} /> Start Batch Cooking
                            </>
                          )}
                        </button>

                        <button
                          disabled={isUpdating}
                          onClick={() => handleBatchUpdateItemMfgStatus(item, 'Moved to Packing')}
                          className="px-3.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {isUpdating ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <>
                              <Package size={14} /> Finish & Move to Packing
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
                              <span className="font-mono font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-100">
                                {ord.quantity} {item.unit}
                              </span>
                            </div>

                            {/* Manufacturing Description / Notes */}
                            {ord.manufacturingDescription && (
                              <p className="text-[11px] font-medium text-teal-800 bg-teal-50/90 px-2 py-1 rounded-md border border-teal-100 flex items-start gap-1">
                                <span>🏭</span>
                                <span><strong>Mfg Note:</strong> {ord.manufacturingDescription}</span>
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
              <Factory size={32} className="mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-bold text-slate-600">No orders found for this Manufacturing Unit</p>
              <p className="text-xs text-slate-400 mt-1">Orders assigned to this unit will appear here.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredOrderWiseList.map((order) => {
                return (
                  <div key={order.id} className="p-5 hover:bg-slate-50/50 transition-colors space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-xs text-teal-700 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-100">
                          {order.code}
                        </span>
                        <h3 className="text-sm font-bold text-slate-900">{order.customerName}</h3>
                        <span className="text-xs text-slate-400">• Slot: {order.slot}</span>
                      </div>

                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
                        Overall Order Status: {order.orderStatus}
                      </span>
                    </div>

                    {/* Items List for this order with item-specific action buttons */}
                    <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200/80">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">Order Items to Produce</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {order.items?.map((item, idx) => {
                          const key = (item.itemName || '').toLowerCase().trim();
                          const masterInfo = itemInfoMap.get(key);
                          const mfgUnit = (item as any).manufacturingUnitName || masterInfo?.mfgUnitName || 'General Kitchen';

                          const itemMfgStatus = item.mfgStatus || (
                            order.orderStatus === 'Moved to Packing' || order.orderStatus === 'Packing Started' || order.orderStatus === 'Moved to Store'
                              ? 'Moved to Packing'
                              : order.orderStatus === 'Manufacturing Started'
                              ? 'Manufacturing Started'
                              : 'Pending'
                          );

                          const isUpdatingSingle = updatingId === `${order.id}_${item.itemName}`;
                          const isMovedToPacking = itemMfgStatus === 'Moved to Packing';

                          return (
                            <div key={idx} className="bg-white rounded-lg p-3 border border-slate-200 text-xs space-y-2 flex flex-col justify-between">
                              <div className="space-y-1">
                                <div className="flex justify-between items-center font-bold text-slate-800">
                                  <span>{item.itemName}</span>
                                  <span className="text-teal-600">{item.quantity} {item.unit}</span>
                                </div>
                                
                                <div className="flex items-center justify-between">
                                  <p className="text-[10px] text-slate-400 flex items-center gap-1">
                                    <Building2 size={10} className="text-teal-600" /> {mfgUnit}
                                  </p>
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                    isMovedToPacking
                                      ? 'bg-purple-100 text-purple-700'
                                      : itemMfgStatus === 'Manufacturing Started'
                                      ? 'bg-teal-100 text-teal-700'
                                      : 'bg-amber-100 text-amber-700'
                                  }`}>
                                    {itemMfgStatus}
                                  </span>
                                </div>

                                {/* Manufacturing Description / Notes */}
                                {item.manufacturingDescription && (
                                  <p className="text-[11px] font-medium text-teal-800 bg-teal-50/90 px-2 py-1 rounded-md border border-teal-100 flex items-start gap-1">
                                    <span>🏭</span>
                                    <span><strong>Mfg Note:</strong> {item.manufacturingDescription}</span>
                                  </p>
                                )}
                              </div>

                              {/* Single Item Action */}
                              {!isMovedToPacking ? (
                                <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5">
                                  <button
                                    disabled={isUpdatingSingle}
                                    onClick={() => handleSingleItemMfgStatusUpdate(order.id, item.itemName, 'Manufacturing Started')}
                                    className="flex-1 py-1 rounded bg-teal-600 hover:bg-teal-700 text-white text-[11px] font-bold transition-all shadow-xs flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                                  >
                                    {isUpdatingSingle ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />} Start
                                  </button>

                                  <button
                                    disabled={isUpdatingSingle}
                                    onClick={() => handleSingleItemMfgStatusUpdate(order.id, item.itemName, 'Moved to Packing')}
                                    className="flex-1 py-1 rounded bg-violet-600 hover:bg-violet-700 text-white text-[11px] font-bold transition-all shadow-xs flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                                  >
                                    {isUpdatingSingle ? <Loader2 size={11} className="animate-spin" /> : <Package size={11} />} Complete
                                  </button>
                                </div>
                              ) : (
                                <div className="pt-1 text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                                  <CheckCircle2 size={12} /> Moved to Packing
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

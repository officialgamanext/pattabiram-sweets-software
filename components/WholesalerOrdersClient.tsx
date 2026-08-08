'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Users,
  Plus,
  Search,
  Filter,
  Eye,
  CheckCircle2,
  Clock,
  Package,
  X,
  Loader2,
  RefreshCw,
  Tag,
  DollarSign,
  Building2,
  FileText,
} from 'lucide-react';
import { db } from '@/lib/firebase';
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import type { ItemRecord } from './ItemsClient';

export interface WholesalerItem {
  id: string;
  name: string;
  mobile: string;
  companyName?: string;
  priceListId?: string;
  priceListName?: string;
  status: string;
}

export interface PriceListRecord {
  id: string;
  name: string;
  items: Array<{
    itemId: string;
    itemName: string;
    customPrice: number;
  }>;
}

export interface WholesalerOrderLineItem {
  itemId: string;
  name: string;
  unit: string;
  standardPrice: number;
  assignedPrice: number;
  quantity: number;
  totalAmount: number;
}

export interface WholesalerOrderRecord {
  id: string;
  orderId: string;
  wholesalerId: string;
  wholesalerName: string;
  wholesalerMobile: string;
  priceListName: string;
  items: WholesalerOrderLineItem[];
  subtotal: number;
  tax: number;
  totalAmount: number;
  orderType: string;
  status: 'Pending' | 'Approved' | 'Processing' | 'Delivered' | 'Cancelled';
  createdAt?: any;
}

export default function WholesalerOrdersClient() {
  const [orders, setOrders] = useState<WholesalerOrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [wholesalers, setWholesalers] = useState<WholesalerItem[]>([]);
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [priceLists, setPriceLists] = useState<PriceListRecord[]>([]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('All');
  
  // Add Order Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedWholesaler, setSelectedWholesaler] = useState<WholesalerItem | null>(null);
  const [orderItems, setOrderItems] = useState<WholesalerOrderLineItem[]>([]);
  const [isSavingOrder, setIsSavingOrder] = useState(false);

  // View Order Modal State
  const [viewingOrder, setViewingOrder] = useState<WholesalerOrderRecord | null>(null);

  // Load Wholesalers, Price Lists, Products & B2B Orders from Firestore
  useEffect(() => {
    // 1. Wholesalers
    const unsubWholesalers = onSnapshot(
      collection(db, 'wholesalers'),
      (snapshot) => {
        const docs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as WholesalerItem[];
        setWholesalers(docs);
      },
      () => {}
    );

    // 2. Items
    const unsubItems = onSnapshot(
      collection(db, 'items'),
      (snapshot) => {
        const docs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as ItemRecord[];
        setItems(docs.filter((i) => i.status !== 'Inactive'));
      },
      () => {}
    );

    // 3. Price Lists
    const unsubPriceLists = onSnapshot(
      collection(db, 'price_lists'),
      (snapshot) => {
        const docs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as PriceListRecord[];
        setPriceLists(docs);
      },
      () => {}
    );

    // 4. B2B Orders
    const unsubOrders = onSnapshot(
      collection(db, 'orders'),
      (snapshot) => {
        const docs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as WholesalerOrderRecord[];
        const b2bOnly = docs.filter(
          (o) => o.orderType === 'Wholesaler B2B' || o.wholesalerId
        );
        setOrders(b2bOnly);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching wholesaler orders:', error);
        setLoading(false);
      }
    );

    return () => {
      unsubWholesalers();
      unsubItems();
      unsubPriceLists();
      unsubOrders();
    };
  }, []);

  // When a Wholesaler is selected in the Add Order Modal, compute their assigned price list
  const activeWholesalerPriceMap = useMemo(() => {
    if (!selectedWholesaler) return new Map<string, number>();

    const map = new Map<string, number>();
    
    // Find price list assigned to this wholesaler
    const assignedList = priceLists.find(
      (pl) =>
        pl.id === selectedWholesaler.priceListId ||
        pl.name === selectedWholesaler.priceListName
    );

    if (assignedList && assignedList.items) {
      assignedList.items.forEach((item) => {
        if (item.itemId && item.customPrice > 0) {
          map.set(item.itemId, item.customPrice);
        }
      });
    }

    return map;
  }, [selectedWholesaler, priceLists]);

  // Handle Wholesaler Selection change in Add Modal
  const handleSelectWholesaler = (wholesalerId: string) => {
    const ws = wholesalers.find((w) => w.id === wholesalerId) || null;
    setSelectedWholesaler(ws);

    // Initialize line items with assigned price list values!
    if (ws) {
      const assignedList = priceLists.find(
        (pl) => pl.id === ws.priceListId || pl.name === ws.priceListName
      );
      const priceMap = new Map<string, number>();
      if (assignedList && assignedList.items) {
        assignedList.items.forEach((item) => {
          if (item.itemId && item.customPrice > 0) {
            priceMap.set(item.itemId, item.customPrice);
          }
        });
      }

      const initialLines: WholesalerOrderLineItem[] = items.map((item) => {
        const customRate = priceMap.get(item.id) || item.price;
        return {
          itemId: item.id,
          name: item.name,
          unit: item.unit,
          standardPrice: item.price,
          assignedPrice: customRate,
          quantity: 0,
          totalAmount: 0,
        };
      });
      setOrderItems(initialLines);
    } else {
      setOrderItems([]);
    }
  };

  // Quantity Change Handler in Order Modal
  const handleQuantityChange = (itemId: string, qty: number) => {
    setOrderItems((prev) =>
      prev.map((line) => {
        if (line.itemId === itemId) {
          const newQty = Math.max(0, qty);
          return {
            ...line,
            quantity: newQty,
            totalAmount: Math.round(line.assignedPrice * newQty),
          };
        }
        return line;
      })
    );
  };

  // Modal Order Summary Calculation
  const modalSubtotal = useMemo(() => {
    return orderItems.reduce((sum, item) => sum + item.totalAmount, 0);
  }, [orderItems]);

  const modalTax = useMemo(() => {
    return Math.round(modalSubtotal * 0.05); // 5% GST
  }, [modalSubtotal]);

  const modalTotal = useMemo(() => {
    return modalSubtotal + modalTax;
  }, [modalSubtotal, modalTax]);

  // Submit Order Handler
  const handleSaveOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWholesaler) {
      alert('Please select a wholesaler.');
      return;
    }

    const selectedLines = orderItems.filter((i) => i.quantity > 0);
    if (selectedLines.length === 0) {
      alert('Please add at least one item quantity to the order.');
      return;
    }

    setIsSavingOrder(true);
    const newOrderId = `WSO-${Date.now().toString().slice(-6)}`;

    try {
      await addDoc(collection(db, 'orders'), {
        orderId: newOrderId,
        wholesalerId: selectedWholesaler.id,
        wholesalerName: selectedWholesaler.name,
        wholesalerMobile: selectedWholesaler.mobile,
        priceListName: selectedWholesaler.priceListName || 'Standard',
        customerName: selectedWholesaler.name,
        customerMobile: selectedWholesaler.mobile,
        items: selectedLines,
        subtotal: modalSubtotal,
        tax: modalTax,
        totalAmount: modalTotal,
        orderType: 'Wholesaler B2B',
        status: 'Pending',
        createdAt: serverTimestamp(),
      });

      setIsAddModalOpen(false);
      setSelectedWholesaler(null);
      setOrderItems([]);
      alert(`Wholesaler Order ${newOrderId} created successfully!`);
    } catch (err) {
      console.error('Error saving wholesaler order:', err);
      alert('Failed to save order. Please try again.');
    } finally {
      setIsSavingOrder(false);
    }
  };

  // Update Status Handler
  const handleUpdateStatus = async (orderId: string, newStatus: WholesalerOrderRecord['status']) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: newStatus,
      });
    } catch (err) {
      console.error('Error updating order status:', err);
    }
  };

  // Filtered Orders List
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchQuery =
        order.orderId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.wholesalerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.wholesalerMobile?.includes(searchQuery);
      const matchStatus = selectedStatusFilter === 'All' || order.status === selectedStatusFilter;
      return matchQuery && matchStatus;
    });
  }, [orders, searchQuery, selectedStatusFilter]);

  return (
    <div className="w-full flex flex-col gap-4 text-slate-800 font-sans pb-12">
      {/* ── Page Header Title Bar ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2">
          <Users size={22} className="text-slate-800 stroke-[1.75]" />
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Wholesaler B2B Orders</h1>
        </div>

        <button
          onClick={() => {
            setIsAddModalOpen(true);
            setSelectedWholesaler(null);
            setOrderItems([]);
          }}
          className="h-8 px-3 text-xs font-semibold rounded-lg bg-[#303030] hover:bg-[#111111] text-white shadow-2xs inline-flex items-center gap-1.5 cursor-pointer transition-colors"
        >
          <Plus size={14} />
          <span>Add Wholesaler Order</span>
        </button>
      </div>

      {/* ── Toolbar: Search & Status Filters ──────────────────────────────────── */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Order #, Wholesaler or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 h-8 bg-[#f7f7f8] focus:bg-white text-xs rounded-lg border border-slate-300 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-500 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <span className="text-xs text-slate-500 font-semibold">Status:</span>
          <div className="flex bg-[#f1f2f4] p-0.5 rounded-lg border border-slate-200">
            {(['All', 'Pending', 'Approved', 'Processing', 'Delivered'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setSelectedStatusFilter(st)}
                className={`h-7 px-3 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  selectedStatusFilter === st
                    ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── B2B Wholesaler Orders Table ───────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-slate-500" />
            Loading B2B Orders...
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">No wholesaler B2B orders found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[750px]">
              <thead>
                <tr className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider bg-[#f7f7f8] border-b border-slate-200">
                  <th className="py-3 px-4">Order ID</th>
                  <th className="py-3 px-4">Wholesaler Details</th>
                  <th className="py-3 px-4">Assigned Price List</th>
                  <th className="py-3 px-4">Items Count</th>
                  <th className="py-3 px-4">Total Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-mono font-bold text-slate-900">{order.orderId}</span>
                    </td>

                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-900">{order.wholesalerName}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{order.wholesalerMobile}</p>
                    </td>

                    <td className="py-3 px-4">
                      <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                        {order.priceListName || 'Standard Rates'}
                      </span>
                    </td>

                    <td className="py-3 px-4 font-semibold text-slate-700">
                      {order.items?.length || 0} Items
                    </td>

                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      ₹{order.totalAmount}
                    </td>

                    <td className="py-3 px-4">
                      <select
                        value={order.status || 'Pending'}
                        onChange={(e) => handleUpdateStatus(order.id, e.target.value as any)}
                        className={`text-[10px] font-bold px-2 py-1 rounded border focus:outline-none cursor-pointer ${
                          order.status === 'Delivered'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : order.status === 'Approved'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : order.status === 'Processing'
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        <option value="Pending">Pending</option>
                        <option value="Approved">Approved</option>
                        <option value="Processing">Processing</option>
                        <option value="Delivered">Delivered</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setViewingOrder(order)}
                        className="h-7 px-2.5 text-xs font-semibold rounded bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 shadow-2xs cursor-pointer inline-flex items-center gap-1"
                      >
                        <Eye size={13} /> View Order
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── MODAL: Create New Wholesaler B2B Order ────────────────────────────── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Users size={18} className="text-indigo-600" />
                  Create Wholesaler B2B Order
                </h3>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* 1. Wholesaler Selection Dropdown */}
              <div className="space-y-2 mb-4 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <label className="block text-xs font-bold text-slate-700">
                  Select Wholesaler <span className="text-rose-500">*</span>:
                </label>
                <select
                  value={selectedWholesaler?.id || ''}
                  onChange={(e) => handleSelectWholesaler(e.target.value)}
                  className="w-full h-9 px-3 bg-white text-xs rounded-lg border border-slate-300 text-slate-800 font-semibold focus:outline-none focus:border-indigo-600"
                >
                  <option value="">-- Choose Wholesaler --</option>
                  {wholesalers.map((ws) => (
                    <option key={ws.id} value={ws.id}>
                      {ws.name} ({ws.mobile}) {ws.priceListName ? `— Assigned: ${ws.priceListName}` : ''}
                    </option>
                  ))}
                </select>

                {selectedWholesaler && (
                  <div className="flex items-center justify-between text-xs pt-1 text-slate-600">
                    <span>Assigned Price List:</span>
                    <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                      {selectedWholesaler.priceListName || 'Standard Rates'}
                    </span>
                  </div>
                )}
              </div>

              {/* 2. Product Items Table with Assigned Rates */}
              {selectedWholesaler ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    Itemized Order Quantities &amp; Assigned Rates:
                  </label>

                  <div className="max-h-[300px] overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                    {orderItems.map((line) => (
                      <div key={line.itemId} className="p-3 flex items-center justify-between gap-3 text-xs">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-900 truncate">{line.name}</p>
                          <p className="text-[11px] text-slate-500 font-mono">
                            Assigned Rate: <span className="font-bold text-slate-800">₹{line.assignedPrice}</span> / {line.unit}
                            {line.assignedPrice !== line.standardPrice && (
                              <span className="text-[10px] text-indigo-600 ml-1 font-semibold">
                                (Custom override from standard ₹{line.standardPrice})
                              </span>
                            )}
                          </p>
                        </div>

                        {/* Quantity Input */}
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={line.quantity || ''}
                            onChange={(e) => handleQuantityChange(line.itemId, parseFloat(e.target.value) || 0)}
                            placeholder="Qty..."
                            className="w-20 h-8 px-2 bg-[#f7f7f8] focus:bg-white text-xs font-bold font-mono rounded-lg border border-slate-300 text-center"
                          />
                          <span className="w-16 text-right font-mono font-bold text-slate-900">
                            ₹{line.totalAmount}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-12 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
                  Please select a Wholesaler to load their assigned custom Price List rates.
                </div>
              )}
            </div>

            {/* Modal Footer with Order Totals & Submit */}
            <div className="border-t border-slate-200 pt-3 flex items-center justify-between gap-3">
              <div className="text-xs font-mono">
                <span className="text-slate-500">Subtotal: ₹{modalSubtotal} | GST: ₹{modalTax} | </span>
                <span className="text-sm font-bold text-slate-900">Total: ₹{modalTotal}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="h-8 px-3 text-xs font-semibold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleSaveOrder}
                  disabled={isSavingOrder || !selectedWholesaler}
                  className="h-8 px-4 text-xs font-semibold rounded-lg bg-[#303030] hover:bg-[#111111] disabled:bg-slate-300 text-white shadow-2xs cursor-pointer flex items-center gap-1.5"
                >
                  {isSavingOrder ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  <span>Save B2B Order</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: View Order Details ─────────────────────────────────────────── */}
      {viewingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">{viewingOrder.orderId}</h3>
                <p className="text-xs text-slate-500 font-mono">Wholesaler: {viewingOrder.wholesalerName}</p>
              </div>
              <button
                onClick={() => setViewingOrder(null)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Line Items */}
            <div className="divide-y divide-slate-100 text-xs max-h-60 overflow-y-auto">
              {viewingOrder.items?.map((item, idx) => (
                <div key={idx} className="py-2 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-900">{item.name}</p>
                    <p className="text-[11px] text-slate-500 font-mono">
                      {item.quantity} {item.unit} x ₹{item.assignedPrice || item.standardPrice}
                    </p>
                  </div>
                  <span className="font-mono font-bold text-slate-900">₹{item.totalAmount || item.quantity * (item.assignedPrice || 0)}</span>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="border-t border-slate-200 pt-3 text-xs space-y-1 font-mono">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>₹{viewingOrder.subtotal}</span>
              </div>
              <div className="flex justify-between">
                <span>GST (5%):</span>
                <span>₹{viewingOrder.tax}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-slate-900 border-t border-slate-100 pt-1">
                <span>Total Amount:</span>
                <span>₹{viewingOrder.totalAmount}</span>
              </div>
            </div>

            <button
              onClick={() => setViewingOrder(null)}
              className="w-full h-8 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
            >
              Close Details
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

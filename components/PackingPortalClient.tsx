'use client';

import { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import type { OrderRecord } from './OrdersClient';

export default function PackingPortalClient() {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

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

  const packingOrders = orders.filter((o) => {
    const s = o.orderStatus;
    return (
      s === 'Moved to Packing' ||
      s === 'Packing Started' ||
      s === 'Packing Completed' ||
      s === 'Manufacturing Completed'
    );
  });

  const filteredOrders = packingOrders.filter(
    (o) =>
      o.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.customerName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleUpdatePackingStatus = async (orderId: string, nextStatus: string) => {
    try {
      setUpdatingId(orderId);
      await updateDoc(doc(db, 'orders', orderId), {
        orderStatus: nextStatus,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Failed to update packing status:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  const queuedCount = packingOrders.filter((o) => o.orderStatus === 'Moved to Packing' || o.orderStatus === 'Manufacturing Completed').length;
  const activeCount = packingOrders.filter((o) => o.orderStatus === 'Packing Started').length;
  const completedCount = packingOrders.filter((o) => o.orderStatus === 'Packing Completed').length;

  return (
    <div className="w-full flex flex-col gap-6 font-sans pb-10">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-violet-600 text-white flex items-center justify-center shadow-xs">
              <Package size={22} />
            </div>
            Packing Portal
          </h1>
          <nav className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
            <Link href="/" className="hover:text-violet-600 transition-colors">Dashboard</Link>
            <ChevronRight size={12} />
            <span className="text-slate-800 font-medium">Packing Portal</span>
          </nav>
        </div>

        <span className="text-xs font-bold text-violet-700 bg-violet-50 px-3 py-1.5 rounded-xl border border-violet-200 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
          Unit Status: Active (Shift 1)
        </span>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
            <Clock size={22} />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-semibold">Awaiting Packing</p>
            <h3 className="text-xl font-extrabold text-slate-900">{queuedCount}</h3>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center flex-shrink-0">
            <Package size={22} />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-semibold">Currently Packing</p>
            <h3 className="text-xl font-extrabold text-slate-900">{activeCount}</h3>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 size={22} />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-semibold">Packed Today</p>
            <h3 className="text-xl font-extrabold text-slate-900">{completedCount}</h3>
          </div>
        </div>
      </div>

      {/* Main Queue Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <h2 className="text-sm font-extrabold text-slate-900">Packing Queue & Boxes</h2>
            <p className="text-xs text-slate-400 mt-0.5">Prepare boxes, attach labels, and complete packaging</p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search order code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-4 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-violet-500 bg-white"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-slate-400 flex flex-col items-center gap-2">
            <Loader2 size={24} className="animate-spin text-violet-600" />
            <p className="text-xs font-semibold">Loading packing queue…</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <Package size={32} className="mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-bold text-slate-600">No orders in packing queue</p>
            <p className="text-xs text-slate-400 mt-1">Orders moved to packing will appear here.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredOrders.map((order) => {
              const isUpdating = updatingId === order.id;
              const isStarted = order.orderStatus === 'Packing Started';
              const isCompleted = order.orderStatus === 'Packing Completed';

              return (
                <div key={order.id} className="p-5 hover:bg-slate-50/50 transition-colors space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-xs text-violet-700 bg-violet-50 px-2.5 py-0.5 rounded-lg border border-violet-100">
                        {order.code}
                      </span>
                      <h3 className="text-sm font-extrabold text-slate-900">{order.customerName}</h3>
                      <span className="text-xs text-slate-400">• Slot: {order.slot}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                          isCompleted
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : isStarted
                            ? 'bg-violet-50 text-violet-700 border-violet-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {order.orderStatus}
                      </span>

                      {!isCompleted && (
                        <button
                          disabled={isUpdating}
                          onClick={() =>
                            handleUpdatePackingStatus(
                              order.id,
                              isStarted ? 'Packing Completed' : 'Packing Started'
                            )
                          }
                          className="flex items-center gap-1.5 px-[8px] py-[4px] h-[30px] rounded-[6px] bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {isUpdating ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : isStarted ? (
                            <>
                              <Check size={13} /> Complete Packing
                            </>
                          ) : (
                            <>
                              <Play size={13} /> Start Packing
                            </>
                          )}
                        </button>
                      )}

                      {isCompleted && (
                        <button
                          disabled={isUpdating}
                          onClick={() => handleUpdatePackingStatus(order.id, 'Moved to Store')}
                          className="flex items-center gap-1.5 px-[8px] py-[4px] h-[30px] rounded-[6px] bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {isUpdating ? <Loader2 size={13} className="animate-spin" /> : <Store size={13} />}
                          Dispatch to Store
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Items List */}
                  <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">Packing Items & Box Notes</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {order.items?.map((item, idx) => (
                        <div key={idx} className="bg-white rounded-lg p-2 border border-slate-200 text-xs space-y-1">
                          <div className="flex justify-between items-center font-bold text-slate-800">
                            <span>{item.itemName}</span>
                            <span className="text-violet-600">{item.quantity} {item.unit}</span>
                          </div>
                          {item.packingDescription && (
                            <p className="text-[10px] text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded">
                              📦 {item.packingDescription}
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
        )}
      </div>

    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Factory,
  CheckCircle2,
  Clock,
  ArrowRight,
  Flame,
  Search,
  Filter,
  Play,
  Check,
  ChevronRight,
  Loader2,
  AlertCircle,
  Package,
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import type { OrderRecord } from './OrdersClient';

export default function ManufacturingPortalClient() {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Subscribe to real-time orders that belong to manufacturing stages
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

  // Filter orders relevant to manufacturing unit
  const mfgOrders = orders.filter((o) => {
    const s = o.orderStatus;
    return (
      s === 'Moved to Manufacturing' ||
      s === 'Manufacturing Started' ||
      s === 'Manufacturing Completed' ||
      s === 'Order Created' ||
      s === 'Confirmed' ||
      s === 'Processing'
    );
  });

  const filteredOrders = mfgOrders.filter(
    (o) =>
      o.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.items?.some((i) => i.itemName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleUpdateMfgStatus = async (orderId: string, nextStatus: string) => {
    try {
      setUpdatingId(orderId);
      await updateDoc(doc(db, 'orders', orderId), {
        orderStatus: nextStatus,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Failed to update status:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  const activeCount = mfgOrders.filter((o) => o.orderStatus === 'Manufacturing Started').length;
  const queuedCount = mfgOrders.filter((o) => o.orderStatus === 'Moved to Manufacturing' || o.orderStatus === 'Order Created').length;
  const completedCount = mfgOrders.filter((o) => o.orderStatus === 'Manufacturing Completed').length;

  return (
    <div className="w-full flex flex-col gap-6 font-sans pb-10">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-xs">
              <Factory size={22} />
            </div>
            Manufacturing Portal
          </h1>
          <nav className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
            <Link href="/" className="hover:text-teal-600 transition-colors">Dashboard</Link>
            <ChevronRight size={12} />
            <span className="text-slate-800 font-medium">Manufacturing Portal</span>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-teal-700 bg-teal-50 px-3 py-1.5 rounded-xl border border-teal-200 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
            Unit Status: Active (Shift 1)
          </span>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
            <Clock size={22} />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-semibold">Queued Batches</p>
            <h3 className="text-xl font-extrabold text-slate-900">{queuedCount}</h3>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center flex-shrink-0">
            <Flame size={22} />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-semibold">In Production</p>
            <h3 className="text-xl font-extrabold text-slate-900">{activeCount}</h3>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 size={22} />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-semibold">Completed Today</p>
            <h3 className="text-xl font-extrabold text-slate-900">{completedCount}</h3>
          </div>
        </div>
      </div>

      {/* Main Production Queue Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <h2 className="text-sm font-extrabold text-slate-900">Manufacturing Queue & Batches</h2>
            <p className="text-xs text-slate-400 mt-0.5">Track production progress and update item stages</p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search order or item..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-4 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500 bg-white"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-slate-400 flex flex-col items-center gap-2">
            <Loader2 size={24} className="animate-spin text-teal-600" />
            <p className="text-xs font-semibold">Loading manufacturing queue…</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <Factory size={32} className="mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-bold text-slate-600">No orders in manufacturing queue</p>
            <p className="text-xs text-slate-400 mt-1">Orders assigned to manufacturing will appear here.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredOrders.map((order) => {
              const isUpdating = updatingId === order.id;
              const isStarted = order.orderStatus === 'Manufacturing Started';
              const isCompleted = order.orderStatus === 'Manufacturing Completed';

              return (
                <div key={order.id} className="p-5 hover:bg-slate-50/50 transition-colors space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-xs text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-lg border border-teal-100">
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
                            ? 'bg-teal-50 text-teal-700 border-teal-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {order.orderStatus}
                      </span>

                      {!isCompleted && (
                        <button
                          disabled={isUpdating}
                          onClick={() =>
                            handleUpdateMfgStatus(
                              order.id,
                              isStarted ? 'Manufacturing Completed' : 'Manufacturing Started'
                            )
                          }
                          className="flex items-center gap-1.5 px-[8px] py-[4px] h-[30px] rounded-[6px] bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {isUpdating ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : isStarted ? (
                            <>
                              <Check size={13} /> Finish Production
                            </>
                          ) : (
                            <>
                              <Play size={13} /> Start Production
                            </>
                          )}
                        </button>
                      )}

                      {isCompleted && (
                        <button
                          disabled={isUpdating}
                          onClick={() => handleUpdateMfgStatus(order.id, 'Moved to Packing')}
                          className="flex items-center gap-1.5 px-[8px] py-[4px] h-[30px] rounded-[6px] bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {isUpdating ? <Loader2 size={13} className="animate-spin" /> : <Package size={13} />}
                          Move to Packing
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Items List for this order */}
                  <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">Items to Produce</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {order.items?.map((item, idx) => (
                        <div key={idx} className="bg-white rounded-lg p-2 border border-slate-200 text-xs space-y-1">
                          <div className="flex justify-between items-center font-bold text-slate-800">
                            <span>{item.itemName}</span>
                            <span className="text-teal-600">{item.quantity} {item.unit}</span>
                          </div>
                          {item.manufacturingDescription && (
                            <p className="text-[10px] text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded">
                              🏭 {item.manufacturingDescription}
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

'use client';

import { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Lock,
  CheckCircle2,
  Layers,
  ArrowRight
} from 'lucide-react';
import { toast } from '@/context/ToastContext';

export interface SlotLimitOverrideData {
  categoryId: string;
  categoryName: string;
  itemId: string;
  itemCode?: string;
  itemName: string;
  unit: string;
  unitPrice: number;
  imageUrl?: string;
  requestedQty: number;
  slot: string;
  date: string;
  maxLimit: number;
  bookedQty: number;
}

interface SlotLimitOverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: SlotLimitOverrideData | null;
  userIdentifier?: string;
  onAuthorized: (data: SlotLimitOverrideData) => void;
}

export default function SlotLimitOverrideModal({
  isOpen,
  onClose,
  data,
  userIdentifier = 'Order Booking Counter',
  onAuthorized,
}: SlotLimitOverrideModalProps) {
  const [otp, setOtp] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(300); // 5 mins in seconds

  // Auto-send OTP whenever modal opens with new data
  useEffect(() => {
    if (isOpen && data) {
      setOtp('');
      setToken(null);
      setErrorMsg(null);
      handleSendOtp();
    }
  }, [isOpen, data?.itemId, data?.requestedQty, data?.slot, data?.date]);

  // Expiry timer
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, token]);

  const formatCountdown = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins}:${String(remainder).padStart(2, '0')}`;
  };

  // 1. Trigger OTP Email
  const handleSendOtp = async () => {
    if (!data) return;
    try {
      setIsSendingOtp(true);
      setErrorMsg(null);

      const res = await fetch('/api/orders/slot-override/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryId: data.categoryId,
          categoryName: data.categoryName,
          itemId: data.itemId,
          itemName: data.itemName,
          requestedQty: data.requestedQty,
          unit: data.unit || 'KG',
          slot: data.slot,
          date: data.date,
          maxLimit: data.maxLimit,
          bookedQty: data.bookedQty,
          requestedBy: userIdentifier,
        }),
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.error || 'Failed to send OTP.');
      }

      setToken(resData.token);
      setCountdown(300);
      toast.success('OTP Sent', 'A 6-digit slot override code was sent to the administrator email.');
    } catch (err: any) {
      console.error('Error sending slot override OTP:', err);
      setErrorMsg(err.message || 'Failed to send OTP email.');
      toast.error('OTP Failed', err.message || 'Could not send verification code.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  // 2. Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !data) {
      setErrorMsg('No active verification session. Please resend code.');
      return;
    }
    if (otp.trim().length !== 6) {
      setErrorMsg('Please enter the 6-digit OTP code.');
      return;
    }

    try {
      setIsVerifyingOtp(true);
      setErrorMsg(null);

      const res = await fetch('/api/orders/slot-override/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          otp: otp.trim(),
        }),
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.error || 'Invalid OTP code.');
      }

      toast.success('Override Authorized', `Added ${data.requestedQty} ${data.unit} of ${data.itemName}.`);
      onAuthorized(data);
      onClose();
    } catch (err: any) {
      console.error('Error verifying slot override OTP:', err);
      setErrorMsg(err.message || 'Incorrect OTP code.');
      toast.error('Verification Failed', err.message || 'Invalid code.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  if (!isOpen || !data) return null;

  const totalProjected = Math.round((data.bookedQty + data.requestedQty) * 100) / 100;
  const excessQty = Math.max(0, Math.round((totalProjected - data.maxLimit) * 100) / 100);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200 flex-shrink-0">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Slot Limit Override Authorization
              </h3>
              <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                <Layers size={12} className="text-amber-600" />
                <span className="font-semibold text-amber-800">{data.categoryName}</span>
                <span>• Max: {data.maxLimit} {data.unit}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700 animate-in fade-in">
            <AlertTriangle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1 font-medium">{errorMsg}</div>
          </div>
        )}

        {/* Capacity Breakdown Box */}
        <div className="bg-amber-50/70 border border-amber-200/90 rounded-xl p-3.5 space-y-2 text-xs">
          <div className="flex items-center justify-between font-bold text-amber-950">
            <span>Item: {data.itemName}</span>
            <span className="text-amber-800 font-mono">+{data.requestedQty} {data.unit}</span>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-amber-200/60 text-[11px]">
            <div>
              <span className="text-slate-500 block">Slot Limit</span>
              <span className="font-bold text-slate-800">{data.maxLimit} {data.unit}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Booked</span>
              <span className="font-bold text-slate-800">{data.bookedQty} {data.unit}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Requested</span>
              <span className="font-bold text-amber-700">+{data.requestedQty} {data.unit}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Exceeds By</span>
              <span className="font-black text-rose-700 font-mono">+{excessQty > 0 ? excessQty : data.requestedQty} {data.unit}</span>
            </div>
          </div>
        </div>

        {/* Security Info & Form */}
        <form onSubmit={handleVerifyOtp} className="space-y-4">
          <div className="bg-teal-50/70 border border-teal-200 rounded-xl p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#02626D]">
              <ShieldCheck size={15} />
              <span>Manager Authorization OTP</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              A 6-digit authorization code has been emailed to the administrator (<strong className="text-slate-800">sureshdivya2015@zohomail.in</strong>). Please enter it below to authorize this excess quantity.
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Enter 6-Digit OTP Code *
            </label>
            <div className="relative">
              <input
                type="text"
                maxLength={6}
                required
                autoFocus
                placeholder="• • • • • •"
                value={otp}
                onChange={(e) => {
                  const clean = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setOtp(clean);
                }}
                className="w-full text-center text-2xl font-mono font-extrabold tracking-[0.4em] py-3 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-[#02626D] focus:bg-white text-slate-900 transition-all placeholder:text-slate-300"
              />
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
              <span className="font-mono">
                {countdown > 0 ? (
                  <span className="text-amber-700 font-semibold">⏳ Code expires in: {formatCountdown(countdown)}</span>
                ) : (
                  <span className="text-red-600 font-bold">⚠️ Code expired</span>
                )}
              </span>
              <button
                type="button"
                disabled={isSendingOtp}
                onClick={handleSendOtp}
                className="text-xs font-bold text-[#02626D] hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw size={12} className={isSendingOtp ? 'animate-spin' : ''} />
                <span>Resend Code</span>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isVerifyingOtp || otp.length !== 6}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-[#02626D] hover:bg-[#014d56] text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {isVerifyingOtp ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              <span>Verify OTP &amp; Add Quantity</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}

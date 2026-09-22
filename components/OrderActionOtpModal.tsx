'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldAlert,
  KeyRound,
  Mail,
  Clock,
  RotateCw,
  X,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  FileEdit,
  Trash2,
} from 'lucide-react';
import { toast } from '@/context/ToastContext';

export interface OrderAuthActionTarget {
  id: string;
  code: string;
  customerName?: string;
  totalAmount?: number;
  orderDate?: string;
}

interface OrderActionOtpModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: OrderAuthActionTarget | null;
  action: 'edit' | 'delete';
  requestedBy: string;
  onAuthorized: (verifiedToken: string) => void | Promise<void>;
}

export function OrderActionOtpModal({
  isOpen,
  onClose,
  order,
  action,
  requestedBy,
  onAuthorized,
}: OrderActionOtpModalProps) {
  const isDelete = action === 'delete';

  const [step, setStep] = useState<'prompt' | 'otp'>('prompt');
  const [otp, setOtp] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(300); // 5 minutes in seconds
  const otpInputRef = useRef<HTMLInputElement>(null);

  // Reset state when modal opens or closes
  useEffect(() => {
    if (isOpen) {
      setStep('prompt');
      setOtp('');
      setToken(null);
      setErrorMsg(null);
      setCountdown(300);
    }
  }, [isOpen, order?.id, action]);

  // Focus OTP input when moving to OTP step
  useEffect(() => {
    if (step === 'otp') {
      const timer = setTimeout(() => {
        otpInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [step]);

  // Countdown timer when on OTP step
  useEffect(() => {
    if (!isOpen || step !== 'otp' || !token) return;

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
  }, [isOpen, step, token]);

  const formatCountdown = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins}:${String(remainder).padStart(2, '0')}`;
  };

  // 1. Send OTP
  const handleSendOtp = async (): Promise<boolean> => {
    if (!order) return false;
    try {
      setIsSendingOtp(true);
      setErrorMsg(null);

      const res = await fetch('/api/orders/auth-action/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          orderCode: order.code,
          action,
          customerName: order.customerName,
          totalAmount: order.totalAmount,
          requestedBy,
          orderDate: order.orderDate,
        }),
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.error || 'Failed to send OTP.');
      }

      setToken(resData.token);
      setStep('otp');
      setCountdown(300);
      toast.success(
        'OTP Sent to Administrator',
        `A 6-digit authorization code was sent to the administrator email to authorize ${isDelete ? 'deletion' : 'editing'}.`
      );
      return true;
    } catch (err: any) {
      console.error('Error sending order action auth OTP:', err);
      setErrorMsg(err.message || 'Failed to send OTP email.');
      toast.error('OTP Failed', err.message || 'Could not send verification code.');
      return false;
    } finally {
      setIsSendingOtp(false);
    }
  };

  // 2. Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !order) {
      setErrorMsg('No active verification session. Please resend code.');
      return;
    }

    const cleanOtp = otp.trim();
    if (cleanOtp.length !== 6) {
      setErrorMsg('Please enter the complete 6-digit verification code.');
      return;
    }

    try {
      setIsVerifyingOtp(true);
      setErrorMsg(null);

      const res = await fetch('/api/orders/auth-action/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          otp: cleanOtp,
        }),
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.error || 'Incorrect or expired OTP.');
      }

      toast.success('Authorization Granted', `Order ${isDelete ? 'deletion' : 'edit'} approved by administrator.`);
      onClose();
      await onAuthorized(resData.verifiedToken);
    } catch (err: any) {
      console.error('Error verifying order action OTP:', err);
      setErrorMsg(err.message || 'Verification failed. Please check the code.');
      toast.error('Verification Failed', err.message || 'Incorrect OTP code.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  if (!isOpen || !order) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden relative">
        {/* Header Ribbon */}
        <div
          className={`px-6 py-5 flex items-start justify-between text-white ${
            isDelete
              ? 'bg-gradient-to-r from-rose-600 to-red-700'
              : 'bg-gradient-to-r from-[#02626D] to-[#044c54]'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20">
              {isDelete ? <Trash2 className="w-5 h-5" /> : <FileEdit className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold tracking-widest bg-white/20 px-2 py-0.5 rounded-full">
                  Admin Guard
                </span>
                <span className="text-xs text-white/80 font-medium">OTP Required</span>
              </div>
              <h3 className="text-base font-bold text-white mt-0.5">
                {isDelete ? 'Authorize Order Deletion' : 'Authorize Order Edit'}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/70 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 space-y-4">
          {/* Target Order Summary Card */}
          <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80 text-xs space-y-1.5">
            <div className="flex items-center justify-between font-medium">
              <span className="text-slate-500">Order Reference:</span>
              <span className="font-bold text-slate-900">#{order.code}</span>
            </div>
            {order.customerName && (
              <div className="flex items-center justify-between font-medium">
                <span className="text-slate-500">Customer:</span>
                <span className="font-semibold text-slate-800">{order.customerName}</span>
              </div>
            )}
            {order.totalAmount !== undefined && (
              <div className="flex items-center justify-between font-medium">
                <span className="text-slate-500">Total Amount:</span>
                <span className="font-extrabold text-[#02626D]">₹{Number(order.totalAmount).toFixed(2)}</span>
              </div>
            )}
            <div className="flex items-center justify-between font-medium pt-1 border-t border-slate-200/60">
              <span className="text-slate-500">Requested By:</span>
              <span className="text-slate-700">{requestedBy}</span>
            </div>
          </div>

          {/* Security Notice */}
          <div
            className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
              isDelete
                ? 'bg-rose-50/70 border-rose-200 text-rose-800'
                : 'bg-amber-50/70 border-amber-200 text-amber-800'
            }`}
          >
            <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Staff Access Restriction</p>
              <p className="mt-0.5 text-[11px] leading-relaxed opacity-90">
                You are logged in with staff permissions. An administrator OTP is required to{' '}
                {isDelete ? 'permanently delete this order' : 'modify this order details'}.
              </p>
            </div>
          </div>

          {/* Step 1: Prompt to Send OTP */}
          {step === 'prompt' && (
            <div className="space-y-4 pt-2">
              <p className="text-xs text-slate-600 text-center leading-relaxed">
                Click below to send a 6-digit authorization code to the administrator&apos;s registered email.
              </p>

              {errorMsg && (
                <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={isSendingOtp}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold text-white shadow-sm transition-all cursor-pointer disabled:opacity-50 ${
                    isDelete
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-[#02626D] hover:bg-[#034f58]'
                  }`}
                >
                  {isSendingOtp ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Sending Code...</span>
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4" />
                      <span>Send OTP to Admin</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Enter & Verify OTP */}
          {step === 'otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4 pt-1">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <label htmlFor="otp-input" className="font-bold text-slate-700 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-[#02626D]" />
                    Enter 6-Digit OTP
                  </label>
                  <span
                    className={`flex items-center gap-1 text-[11px] font-mono font-bold ${
                      countdown <= 30 ? 'text-rose-600 animate-pulse' : 'text-slate-500'
                    }`}
                  >
                    <Clock className="w-3 h-3" />
                    {formatCountdown(countdown)}
                  </span>
                </div>

                <input
                  id="otp-input"
                  ref={otpInputRef}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="• • • • • •"
                  className="w-full text-center tracking-[12px] font-mono font-extrabold text-2xl h-12 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#02626D] focus:border-transparent transition-all"
                  autoComplete="one-time-code"
                />
                <p className="text-[11px] text-slate-500 text-center">
                  Code sent to Administrator email. Ask Admin for the code.
                </p>
              </div>

              {errorMsg && (
                <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={isSendingOtp || countdown > 240}
                  className="text-xs font-semibold text-[#02626D] hover:underline flex items-center gap-1.5 disabled:opacity-40 disabled:no-underline cursor-pointer"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${isSendingOtp ? 'animate-spin' : ''}`} />
                  <span>{isSendingOtp ? 'Resending...' : 'Resend Code'}</span>
                </button>
                <span className="text-[10px] text-slate-400">Valid for 5 mins</span>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isVerifyingOtp || otp.length !== 6}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold text-white shadow-sm transition-all cursor-pointer disabled:opacity-50 ${
                    isDelete
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-[#02626D] hover:bg-[#034f58]'
                  }`}
                >
                  {isVerifyingOtp ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Verify &amp; {isDelete ? 'Delete' : 'Edit'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

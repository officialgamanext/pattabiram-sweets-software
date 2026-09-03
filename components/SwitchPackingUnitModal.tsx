'use client';

import { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  ArrowRightLeft,
  Loader2,
  Building2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Lock,
  ArrowRight
} from 'lucide-react';
import { toast } from '@/context/ToastContext';
import type { DynamicUnit } from './PackingPortalClient';

interface SwitchPackingUnitModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  orderCode: string;
  targetType: 'order' | 'item';
  itemName?: string;
  currentUnitName: string;
  pckUnits: DynamicUnit[];
  userEmail?: string;
  onSuccess?: () => void;
}

export default function SwitchPackingUnitModal({
  isOpen,
  onClose,
  orderId,
  orderCode,
  targetType,
  itemName,
  currentUnitName,
  pckUnits,
  userEmail,
  onSuccess,
}: SwitchPackingUnitModalProps) {
  const [step, setStep] = useState<'otp' | 'select_unit'>('otp');
  const [otp, setOtp] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedDestinationUnit, setSelectedDestinationUnit] = useState<string>('');
  const [transferReason, setTransferReason] = useState('');
  const [countdown, setCountdown] = useState<number>(300); // 5 minutes in seconds

  // Auto-send OTP when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('otp');
      setOtp('');
      setToken(null);
      setErrorMsg(null);
      setSelectedDestinationUnit('');
      setTransferReason('');
      handleSendOtp();
    }
  }, [isOpen, orderId, targetType, itemName]);

  // Countdown timer for OTP expiry
  useEffect(() => {
    if (!isOpen || step !== 'otp') return;
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

  // 1. Send OTP Request
  const handleSendOtp = async () => {
    try {
      setIsSendingOtp(true);
      setErrorMsg(null);

      const res = await fetch('/api/packing/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          orderCode,
          targetType,
          itemName: itemName || null,
          currentUnitName,
          requestedBy: userEmail || 'Packing Manager',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to send OTP email.');
      }

      setToken(data.token);
      setCountdown(300);
      toast.success('OTP Sent', 'A 6-digit authorization code was sent to the administrator email.');
    } catch (err: any) {
      console.error('Error sending OTP:', err);
      setErrorMsg(err.message || 'Failed to send OTP.');
      toast.error('OTP Failed', err.message || 'Could not send verification code.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  // 2. Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setErrorMsg('No active verification session. Please click resend.');
      return;
    }
    if (otp.trim().length !== 6) {
      setErrorMsg('Please enter a valid 6-digit OTP code.');
      return;
    }

    try {
      setIsVerifyingOtp(true);
      setErrorMsg(null);

      const res = await fetch('/api/packing/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          otp: otp.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Verification failed. Please check your OTP.');
      }

      toast.success('Authorized', 'OTP verified successfully. Please select the new packing unit.');
      setStep('select_unit');
    } catch (err: any) {
      console.error('Error verifying OTP:', err);
      setErrorMsg(err.message || 'Incorrect OTP code.');
      toast.error('Verification Failed', err.message || 'Invalid code.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // 3. Confirm Switch Packing Unit
  const handleConfirmSwitch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedDestinationUnit) {
      toast.warning('Unit Required', 'Please select a destination packing unit.');
      return;
    }

    try {
      setIsSwitching(true);
      setErrorMsg(null);

      const res = await fetch('/api/packing/switch-unit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          orderId,
          destinationUnitName: selectedDestinationUnit,
          targetType,
          itemName: itemName || null,
          reason: transferReason || 'Unit transfer via OTP authorization',
          requestedBy: userEmail || 'Packing Manager',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to switch packing unit.');
      }

      toast.success(
        'Unit Switched',
        `Successfully moved ${targetType === 'item' ? itemName : `Order #${orderCode}`} to ${selectedDestinationUnit}.`
      );
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error switching unit:', err);
      setErrorMsg(err.message || 'Failed to complete unit switch.');
      toast.error('Switch Failed', err.message || 'Could not move unit.');
    } finally {
      setIsSwitching(false);
    }
  };

  if (!isOpen) return null;

  // Destination units list (all active units)
  const availableUnits = pckUnits.filter((u) => u.status !== 'Inactive');

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#02626D] flex items-center justify-center border border-teal-100">
              <ArrowRightLeft size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Switch Packing Unit
              </h3>
              <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                <span>{targetType === 'item' ? `Item: ${itemName}` : `Order #${orderCode}`}</span>
                <span className="text-slate-300">•</span>
                <span className="font-semibold text-slate-700">From: {currentUnitName || 'Current Unit'}</span>
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

        {/* Error Message Alert */}
        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700 animate-in fade-in">
            <AlertCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1 font-medium">{errorMsg}</div>
          </div>
        )}

        {/* STEP 1: OTP AUTHORIZATION */}
        {step === 'otp' && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="bg-teal-50/60 border border-teal-200/80 rounded-xl p-3.5 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold text-[#02626D]">
                <ShieldCheck size={16} />
                <span>Security Authorization Required</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                To move this {targetType === 'item' ? 'item' : 'order'} to another packing unit, a 6-digit confirmation code has been sent to the administrator email (<strong className="text-slate-800">sureshdivya2015@zohomail.in</strong>).
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
                <span>Verify OTP &amp; Proceed</span>
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: SELECT DESTINATION PACKING UNIT */}
        {step === 'select_unit' && (
          <form onSubmit={handleConfirmSwitch} className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2 text-xs font-bold text-emerald-800">
              <CheckCircle2 size={16} className="text-emerald-600" />
              <span>Authorization Verified! Select destination packing unit below:</span>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Select Destination Packing Unit *
              </label>
              
              <div className="grid grid-cols-1 gap-2 max-h-56 overflow-y-auto pr-1">
                {availableUnits.length === 0 ? (
                  <p className="text-xs text-slate-400 py-3 text-center">No other packing units available.</p>
                ) : (
                  availableUnits.map((u) => {
                    const isCurrent = u.name.toLowerCase() === (currentUnitName || '').toLowerCase();
                    const isSelected = selectedDestinationUnit.toLowerCase() === u.name.toLowerCase();

                    return (
                      <div
                        key={u.id}
                        onClick={() => {
                          if (!isCurrent) setSelectedDestinationUnit(u.name);
                        }}
                        className={`p-3 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                          isCurrent
                            ? 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
                            : isSelected
                            ? 'bg-teal-50/80 border-[#02626D] shadow-xs'
                            : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                            isSelected ? 'bg-[#02626D] text-white' : 'bg-slate-100 text-slate-600'
                          }`}>
                            <Building2 size={16} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-900">{u.name}</span>
                              <span className="text-[10px] font-mono text-slate-400 font-semibold">{u.code}</span>
                              {isCurrent && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-200 text-slate-600">
                                  Current Unit
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {u.isCustomisationUnit && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 border border-purple-200">
                                  Customisation
                                </span>
                              )}
                              {u.isTransportUnit && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-teal-50 text-teal-700 border border-teal-200">
                                  Transport Orders
                                </span>
                              )}
                              {!u.isCustomisationUnit && !u.isTransportUnit && (
                                <span className="text-[9px] font-medium px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                                  Standard
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center">
                          <input
                            type="radio"
                            name="destinationUnit"
                            disabled={isCurrent}
                            checked={isSelected}
                            onChange={() => setSelectedDestinationUnit(u.name)}
                            className="h-4 w-4 text-[#02626D] focus:ring-[#02626D] border-slate-300"
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Optional Reason Note */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Transfer Reason / Note <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Workload balancing, specialized gift packaging..."
                value={transferReason}
                onChange={(e) => setTransferReason(e.target.value)}
                className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#02626D]"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStep('otp')}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={isSwitching || !selectedDestinationUnit}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-[#02626D] hover:bg-[#014d56] text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {isSwitching ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                <span>Confirm &amp; Move to {selectedDestinationUnit || 'Selected Unit'}</span>
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}

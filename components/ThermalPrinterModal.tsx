'use client';

import React, { useState } from 'react';
import { usePrinter } from '@/context/PrinterContext';
import {
  Printer,
  Usb,
  Bluetooth,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Sliders,
  FileText,
  X,
  Zap,
  Info,
  PowerOff,
  Check,
  ChevronRight
} from 'lucide-react';

interface ThermalPrinterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ThermalPrinterModal({ isOpen, onClose }: ThermalPrinterModalProps) {
  const {
    isConnected,
    printerType,
    printerName,
    paperWidth,
    isPrinting,
    statusMessage,
    lastError,
    connectUsbPrinter,
    connectBluetoothPrinter,
    disconnectPrinter,
    printTestSlip,
    printWindow,
    setPaperWidth,
    clearError,
  } = usePrinter();

  const [testPrintSuccess, setTestPrintSuccess] = useState<boolean>(false);
  const [connectingType, setConnectingType] = useState<'USB' | 'Bluetooth' | null>(null);

  if (!isOpen) return null;

  const handleConnectUsb = async () => {
    setConnectingType('USB');
    try {
      await connectUsbPrinter();
    } finally {
      setConnectingType(null);
    }
  };

  const handleConnectBluetooth = async () => {
    setConnectingType('Bluetooth');
    try {
      await connectBluetoothPrinter();
    } finally {
      setConnectingType(null);
    }
  };

  const handleRunTestPrint = async () => {
    setTestPrintSuccess(false);
    const ok = await printTestSlip();
    if (ok) {
      setTestPrintSuccess(true);
      setTimeout(() => setTestPrintSuccess(false), 4000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200/90 z-10 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150 text-slate-800">
        {/* Modal Header */}
        <div className="bg-[#02626D] text-white px-5 py-4 flex items-center justify-between border-b border-[#014d56]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#024f58] border border-[#014047] flex items-center justify-center text-emerald-300">
              <Printer size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">Thermal Printer Center</h2>
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-[#024f58] text-teal-100 border border-[#014047]">
                  ESC/POS Ready
                </span>
              </div>
              <p className="text-xs text-teal-100/80 mt-0.5">
                Connect via Web USB or Bluetooth for instant receipt printing
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-teal-200 hover:text-white rounded-lg hover:bg-[#024f58] transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5">
          {/* Active Connection Banner */}
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between transition-colors ${
              isConnected
                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-3 h-3 rounded-full ${
                  isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                }`}
              />
              <div>
                <div className="flex items-center gap-2 font-bold text-xs">
                  <span>{isConnected ? 'Printer Online & Connected' : 'No Printer Connected'}</span>
                  {isConnected && (
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.2 rounded-full font-semibold">
                      {printerType}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 truncate max-w-xs">
                  {isConnected ? printerName : 'Choose USB or Bluetooth below to connect hardware'}
                </p>
              </div>
            </div>

            {isConnected && (
              <button
                onClick={disconnectPrinter}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 shadow-2xs inline-flex items-center gap-1 cursor-pointer transition-colors"
                title="Disconnect active printer"
              >
                <PowerOff size={12} />
                <span>Disconnect</span>
              </button>
            )}
          </div>

          {/* Connection Options Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* 1. Web USB Option */}
            <div
              className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                printerType === 'USB' && isConnected
                  ? 'bg-emerald-50/50 border-emerald-300 ring-2 ring-emerald-400/20'
                  : 'bg-white hover:bg-slate-50/60 border-slate-200/90 shadow-2xs'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
                    <Usb size={18} />
                  </div>
                  {printerType === 'USB' && isConnected && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                      <Check size={11} /> Connected
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900">Web USB / Serial Printer</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                    Direct USB cable connection to POS-58, POS-80, TVS, Epson &amp; Xprinter devices.
                  </p>
                </div>
              </div>

              <div className="pt-3 mt-2 border-t border-slate-100">
                <button
                  onClick={handleConnectUsb}
                  disabled={connectingType === 'USB'}
                  className={`w-full h-8 text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-2xs ${
                    printerType === 'USB' && isConnected
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-[#02626D] hover:bg-[#014d56] text-white'
                  }`}
                >
                  {connectingType === 'USB' ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>Connecting USB...</span>
                    </>
                  ) : printerType === 'USB' && isConnected ? (
                    <>
                      <RefreshCw size={13} />
                      <span>Reconnect USB</span>
                    </>
                  ) : (
                    <>
                      <Usb size={13} />
                      <span>Connect Web USB</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* 2. Web Bluetooth Option */}
            <div
              className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                printerType === 'Bluetooth' && isConnected
                  ? 'bg-indigo-50/50 border-indigo-300 ring-2 ring-indigo-400/20'
                  : 'bg-white hover:bg-slate-50/60 border-slate-200/90 shadow-2xs'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-100">
                    <Bluetooth size={18} />
                  </div>
                  {printerType === 'Bluetooth' && isConnected && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-100/80 px-2 py-0.5 rounded-full">
                      <Check size={11} /> Connected
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900">Bluetooth Thermal Printer</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                    Wireless pairing for handheld mobile receipt printers and counter BLE devices.
                  </p>
                </div>
              </div>

              <div className="pt-3 mt-2 border-t border-slate-100">
                <button
                  onClick={handleConnectBluetooth}
                  disabled={connectingType === 'Bluetooth'}
                  className={`w-full h-8 text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-2xs ${
                    printerType === 'Bluetooth' && isConnected
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  }`}
                >
                  {connectingType === 'Bluetooth' ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>Scanning BLE...</span>
                    </>
                  ) : printerType === 'Bluetooth' && isConnected ? (
                    <>
                      <RefreshCw size={13} />
                      <span>Pair Another BLE</span>
                    </>
                  ) : (
                    <>
                      <Bluetooth size={13} />
                      <span>Pair Bluetooth Printer</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Thermal Printer Settings: Paper Width */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                <Sliders size={15} className="text-slate-600" />
                <span>Thermal Paper Configuration</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono font-medium">Standard ESC/POS</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaperWidth('80mm')}
                className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                  paperWidth === '80mm'
                    ? 'bg-white border-slate-900 text-slate-900 shadow-2xs ring-1 ring-slate-900'
                    : 'bg-slate-100/80 border-slate-200 text-slate-600 hover:bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">80mm (3-inch)</span>
                  {paperWidth === '80mm' && <Check size={14} className="text-slate-900" />}
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5">Standard Counter POS / 48 columns</p>
              </button>

              <button
                type="button"
                onClick={() => setPaperWidth('58mm')}
                className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                  paperWidth === '58mm'
                    ? 'bg-white border-slate-900 text-slate-900 shadow-2xs ring-1 ring-slate-900'
                    : 'bg-slate-100/80 border-slate-200 text-slate-600 hover:bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">58mm (2-inch)</span>
                  {paperWidth === '58mm' && <Check size={14} className="text-slate-900" />}
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5">Compact Handheld / 32 columns</p>
              </button>
            </div>
          </div>

          {/* Hardware Diagnostic Actions */}
          <div className="space-y-2">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Diagnostic &amp; Print Tools
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleRunTestPrint}
                disabled={isPrinting}
                className="flex-1 h-9 px-3 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs inline-flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
              >
                <Zap size={15} />
                <span>{isPrinting ? 'Sending Print Job...' : '⚡ Send Test Print Receipt'}</span>
              </button>

              <button
                onClick={printWindow}
                className="h-9 px-3 text-xs font-semibold rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-2xs inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Open standard system print dialog"
              >
                <FileText size={15} className="text-slate-500" />
                <span>Browser Print</span>
              </button>
            </div>

            {testPrintSuccess && (
              <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in duration-150">
                <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                <span>Test receipt dispatched to thermal printer successfully!</span>
              </div>
            )}

            {lastError && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start justify-between gap-2 animate-in fade-in duration-150">
                <div className="flex items-start gap-2">
                  <AlertCircle size={15} className="text-rose-600 shrink-0 mt-0.5" />
                  <span className="leading-snug">{lastError}</span>
                </div>
                <button
                  onClick={clearError}
                  className="text-rose-600 hover:text-rose-800 text-[10px] font-bold underline cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}
          </div>

          {/* Browser Compatibility Footer Notice */}
          <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl flex items-start gap-2.5 text-[11px] text-amber-900 leading-relaxed">
            <Info size={16} className="text-amber-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Browser Requirement:</span> Web USB, Web Serial, and Web Bluetooth require <span className="font-semibold underline">Google Chrome</span> or <span className="font-semibold underline">Microsoft Edge</span> on Windows, Mac, Android, or Linux. If hardware APIs are not allowed, click &quot;Browser Print&quot; to print via system drivers.
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-500">
            <span className="text-[11px]">Status:</span>
            <span className="font-semibold text-slate-700">{statusMessage}</span>
          </div>
          <button
            onClick={onClose}
            className="h-8 px-4 text-xs font-semibold rounded-lg bg-[#02626D] hover:bg-[#014d56] text-white shadow-2xs cursor-pointer transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

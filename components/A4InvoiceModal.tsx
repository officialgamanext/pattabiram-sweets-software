'use client';

import React, { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Printer,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import WhatsAppIcon from './WhatsAppIcon';
import { useBusinessSettings } from '@/lib/businessSettings';
import A4InvoiceDocument from './A4InvoiceDocument';
import { sendWhatsAppInvoiceFlow, SendWhatsAppInvoiceResult } from '@/lib/whatsappInvoice';

interface A4InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: any | null;
}

export default function A4InvoiceModal({ isOpen, onClose, order }: A4InvoiceModalProps) {
  const { settings: businessSettings } = useBusinessSettings();
  const invoiceRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);
  const [waResult, setWaResult] = useState<SendWhatsAppInvoiceResult | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setWaResult(null);
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
      document.body.classList.add('a4-modal-open');
      document.body.style.overflow = 'hidden';

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', handleKeyDown);

      return () => {
        document.body.classList.remove('a4-modal-open');
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen || !order || !mounted) return null;

  const invoiceNo = order.orderId || order.code || order.id || 'INV-001';
  const customerMobile = order.wholesalerMobile || order.customerMobile || order.customerPhone || '';

  const handlePrint = () => {
    document.body.classList.add('a4-modal-open');
    window.print();
  };

  const handleSendWhatsApp = async () => {
    if (!invoiceRef.current) return;
    setIsSendingWhatsApp(true);
    setWaResult(null);

    try {
      const res = await sendWhatsAppInvoiceFlow(order, invoiceRef.current);
      setWaResult(res);
    } catch (err: any) {
      setWaResult({
        success: false,
        error: err?.message || 'Failed to send WhatsApp message',
      });
    } finally {
      setIsSendingWhatsApp(false);
    }
  };

  return createPortal(
    <div
      id="a4-modal-portal"
      ref={scrollContainerRef}
      className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex flex-col items-center p-3 sm:p-6 overflow-y-auto print:p-0 print:m-0 print:bg-white print:static print:inset-auto print:overflow-visible"
    >
      {/* Top Action Bar */}
      <div className="w-full max-w-[800px] flex flex-wrap items-center justify-between gap-3 mb-3 py-1 print:hidden shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-white bg-slate-800/90 px-3 py-1.5 rounded-lg border border-slate-700/60 shadow-xs">
            A4 Tax Invoice Preview
          </span>
          <span className="text-[11px] text-slate-300 font-mono hidden sm:inline">
            {invoiceNo}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Send WhatsApp Button */}
          <button
            type="button"
            onClick={handleSendWhatsApp}
            disabled={isSendingWhatsApp}
            className="px-3.5 py-2 bg-[#25D366] hover:bg-[#20ba59] active:scale-95 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-2 cursor-pointer transition-all disabled:opacity-60"
            title={customerMobile ? `Send WhatsApp to ${customerMobile}` : 'Customer phone required'}
          >
            {isSendingWhatsApp ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <WhatsAppIcon size={16} />
            )}
            <span>{isSendingWhatsApp ? 'Sending...' : 'Send WhatsApp'}</span>
          </button>

          {/* Print A4 Button */}
          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2 bg-[#02626D] hover:bg-[#014d56] text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-2 cursor-pointer transition-all active:scale-95"
          >
            <Printer size={15} />
            <span>Print A4 Invoice</span>
          </button>

          {/* Close */}
          <button
            type="button"
            onClick={onClose}
            className="p-2 bg-white/90 hover:bg-white text-slate-700 rounded-xl cursor-pointer shadow-md transition-colors"
            title="Close Preview (Esc)"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* WhatsApp Status Alert (if triggered) */}
      {waResult && (
        <div className="w-full max-w-[800px] mb-3 print:hidden">
          <div
            className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-3 ${
              waResult.success
                ? 'bg-emerald-900/90 border-emerald-700 text-emerald-100'
                : 'bg-amber-900/90 border-amber-700 text-amber-100'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              {waResult.success ? (
                <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle size={16} className="text-amber-400 shrink-0" />
              )}
              <span className="truncate">
                {waResult.success
                  ? `WhatsApp Invoice Sent to ${customerMobile}!`
                  : waResult.error || 'WhatsApp Cloud API notice.'}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {waResult.invoiceUrl && (
                <a
                  href={waResult.invoiceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-300 hover:text-cyan-200 underline"
                >
                  <span>ImageKit Invoice</span>
                  <ExternalLink size={11} />
                </a>
              )}
              {waResult.directWhatsAppUrl && (
                <a
                  href={waResult.directWhatsAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-bold text-[11px]"
                >
                  <WhatsAppIcon size={12} />
                  <span>WhatsApp Web</span>
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Render A4 Invoice Document */}
      <A4InvoiceDocument
        ref={invoiceRef}
        order={order}
        businessSettings={businessSettings}
      />
    </div>,
    document.body
  );
}

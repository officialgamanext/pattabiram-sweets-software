'use client';

import React, { forwardRef } from 'react';
import { Truck } from 'lucide-react';
import { formatStoreAddress, formatStorePhone } from '@/lib/businessSettings';

export interface A4InvoiceDocumentProps {
  order: any;
  businessSettings: any;
  className?: string;
}

function numberToIndianWords(num: number): string {
  if (isNaN(num) || num <= 0) return 'Zero Rupees Only';
  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const inWords = (n: number): string => {
    let str = '';
    if (n > 99) {
      str += a[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n > 19) {
      str += b[Math.floor(n / 10)] + ' ' + a[n % 10];
    } else if (n > 0) {
      str += a[n];
    }
    return str.trim();
  };

  const integerPart = Math.floor(num);
  const decimalPart = Math.round((num - integerPart) * 100);

  const crore = Math.floor(integerPart / 10000000);
  const lakh = Math.floor((integerPart % 10000000) / 100000);
  const thousand = Math.floor((integerPart % 100000) / 1000);
  const remainder = integerPart % 1000;

  let result = '';
  if (crore > 0) result += inWords(crore) + ' Crore ';
  if (lakh > 0) result += inWords(lakh) + ' Lakh ';
  if (thousand > 0) result += inWords(thousand) + ' Thousand ';
  if (remainder > 0) result += inWords(remainder) + ' ';

  result = result.trim() + ' Rupees';
  if (decimalPart > 0) {
    result += ' and ' + inWords(decimalPart) + ' Paise';
  }
  return result + ' Only';
}

function formatDate(val: any): string {
  if (!val) return '—';
  if (typeof val === 'string' && val.trim()) return val;
  if (val?.toDate) {
    try {
      return val.toDate().toLocaleDateString('en-IN');
    } catch {
      // fallback
    }
  }
  return String(val);
}

const A4InvoiceDocument = forwardRef<HTMLDivElement, A4InvoiceDocumentProps>(function A4InvoiceDocument(
  { order, businessSettings = {}, className = '' },
  ref
) {
  if (!order) return null;

  const invoiceNo = order.orderId || order.code || order.id || 'INV-001';
  const orderDate = formatDate(order.orderDate || order.createdAt);
  const deliveryDate = formatDate(order.expectedDeliveryDate || order.deliveryDate || orderDate);
  const isWholesale = Boolean(order.orderType === 'Wholesaler B2B' || order.wholesalerId || order.wholesalerName);

  const customerName = order.wholesalerName || order.customerName || 'Valued Customer';
  const companyName = order.companyName || '';
  const customerMobile = order.wholesalerMobile || order.customerMobile || order.customerPhone || '—';
  const customerAddress = order.deliveryAddress || order.customerAddress || order.address || '';
  const customerGstin = order.wholesalerGstin || order.gstin || order.gstNumber || '';

  const isTransport = Boolean(order.isTransportRequired);
  const transportCharges = Number(order.transportCharges) || 0;
  const packingCharges = Number(order.packingCharges) || 0;

  // Customisation extras
  const boxCharges = Number(order.boxChargesTotal) || 0;
  const stickerCharges = Number(order.stickerChargesTotal) || 0;
  const shrinkCharges = Number(order.shrinkChargesTotal) || 0;
  const packetCharges = Number(order.packetChargesTotal) || 0;
  const discountAmount = Number(order.discountAmount) || 0;

  const grandTotal = Number(order.totalAmount || 0);
  const receivedAmount = Number(order.receivedAmount || 0);
  const balanceDue = Math.max(0, grandTotal - receivedAmount);
  const paymentStatus = order.paymentStatus || (receivedAmount >= grandTotal - 0.01 ? 'Paid' : receivedAmount > 0 ? 'Partial' : 'Pending');
  const paymentMode = order.paymentMode || 'Credit';

  const items = (order.items || []).map((it: any) => {
    const qty = parseFloat(String(it.quantity ?? it.qty ?? it.count ?? 1)) || 1;
    let price = parseFloat(
      String(
        it.unitPrice ??
        it.assignedPrice ??
        it.standardPrice ??
        it.price ??
        it.rate ??
        it.unit_price ??
        it.sellingPrice ??
        0
      )
    ) || 0;
    let total = parseFloat(
      String(
        it.lineTotal ??
        it.totalAmount ??
        it.total ??
        it.amount ??
        (qty * price)
      )
    ) || 0;

    if (total === 0 && price > 0) {
      total = qty * price;
    } else if (price === 0 && total > 0 && qty > 0) {
      price = total / qty;
    } else if (price === 0 && total === 0 && (order.items || []).length === 1) {
      const fallbackTotal = Number(order.taxableAmount ?? order.subtotal ?? order.subTotal ?? order.totalAmount ?? 0);
      if (fallbackTotal > 0) {
        total = fallbackTotal;
        price = total / qty;
      }
    }

    return {
      name: it.itemName || it.name || it.productName || 'Item',
      code: it.itemCode || it.code || it.sku || '',
      category: it.category || '',
      qty,
      unit: it.unit || it.uom || 'Kg',
      price,
      total,
      mfgNote: it.needsManufacturing ? 'Mfg' : '',
    };
  });

  const computedItemsSubtotal = items.reduce((sum: number, it: any) => sum + (it.total || 0), 0);
  const subtotal = Number(order.taxableAmount ?? order.subtotal ?? order.subTotal ?? (computedItemsSubtotal > 0 ? computedItemsSubtotal : grandTotal));

  const cgstAmount = Number(order.cgstAmount ?? (order.taxAmount ? Number(order.taxAmount) / 2 : 0)) || 0;
  const sgstAmount = Number(order.sgstAmount ?? (order.taxAmount ? Number(order.taxAmount) / 2 : 0)) || 0;
  const cgstPercent = order.cgstPercent ?? 2.5;
  const sgstPercent = order.sgstPercent ?? 2.5;

  return (
    <div
      ref={ref}
      id="a4-invoice-printable"
      className={`w-full max-w-[800px] bg-white rounded-xl shadow-2xl border border-slate-200 p-8 sm:p-10 mb-8 print:mb-0 print:p-0 print:border-none print:shadow-none print:rounded-none print:w-full print:max-w-none text-slate-800 font-sans text-xs relative ${className}`}
      style={{ boxSizing: 'border-box' }}
    >
      {/* Top Header: Business Details & Tax Invoice Badge */}
      <div className="border-b-2 border-slate-900 pb-5 no-break" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 max-w-[60%]">
            <div className="flex items-center gap-2.5">
              {businessSettings.logoUrl ? (
                <img
                  src={businessSettings.logoUrl}
                  alt={businessSettings.businessName || 'Logo'}
                  className="w-11 h-11 object-contain rounded-lg border border-slate-200 p-0.5 shrink-0 bg-white"
                  crossOrigin="anonymous"
                />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-[#02626D] text-white flex items-center justify-center font-black text-sm shrink-0">
                  PS
                </div>
              )}
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 uppercase">
                {businessSettings.businessName || 'PATTABIRAM SWEETS'}
              </h1>
            </div>
            {businessSettings.tagline && (
              <p className="text-xs font-semibold text-[#02626D] tracking-wide">
                {businessSettings.tagline}
              </p>
            )}
            <p className="text-[11px] text-slate-600 leading-tight">
              {formatStoreAddress(businessSettings)}
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600 pt-1">
              <span>Phone: <strong className="text-slate-800">{formatStorePhone(businessSettings)}</strong></span>
              {businessSettings.email && (
                <span>Email: <strong className="text-slate-800">{businessSettings.email}</strong></span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono text-slate-800 pt-0.5">
              {businessSettings.gstNumber && (
                <span>GSTIN: <strong>{businessSettings.gstNumber}</strong></span>
              )}
              {businessSettings.fssaiNumber && (
                <span>FSSAI: <strong>{businessSettings.fssaiNumber}</strong></span>
              )}
            </div>
          </div>

          <div className="text-right space-y-1.5 shrink-0">
            <div className="inline-block px-3 py-1 bg-slate-900 text-white font-extrabold text-xs tracking-wider uppercase rounded">
              TAX INVOICE
            </div>
            {isWholesale && (
              <div className="text-[10px] font-bold text-[#02626D] uppercase">
                Wholesale B2B
              </div>
            )}
            <div className="text-[11px] space-y-0.5 pt-1">
              <p>
                Invoice No: <strong className="font-mono text-slate-900">{invoiceNo}</strong>
              </p>
              <p>
                Date: <strong className="text-slate-800">{orderDate}</strong>
              </p>
              {deliveryDate && deliveryDate !== orderDate && (
                <p>
                  Delivery Date: <strong className="text-slate-800">{deliveryDate}</strong>
                </p>
              )}
              {order.slot && (
                <p>
                  Time Slot: <strong className="text-slate-800">{order.slot}</strong>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Customer / Buyer Information Block */}
      <div className="grid grid-cols-2 gap-4 py-4 border-b border-slate-200 no-break" style={{ pageBreakInside: 'avoid' }}>
        <div className="space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Billed To / Buyer:
          </span>
          <p className="text-sm font-bold text-slate-900">{customerName}</p>
          {companyName && companyName !== customerName && (
            <p className="text-xs font-semibold text-slate-700">{companyName}</p>
          )}
          <p className="text-xs text-slate-600">Mobile: {customerMobile}</p>
          {customerGstin && (
            <p className="text-xs font-mono text-slate-800">
              GSTIN: <strong>{customerGstin}</strong>
            </p>
          )}
          {customerAddress && !isTransport && (
            <p className="text-xs text-slate-600 leading-tight">Address: {customerAddress}</p>
          )}
        </div>

        <div className="space-y-1 border-l border-slate-100 pl-4">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Shipping / Delivery Details:
          </span>
          {isTransport ? (
            <div className="space-y-0.5">
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                <Truck size={12} />
                <span>Transport Delivery Required</span>
              </div>
              {customerAddress ? (
                <p className="text-xs text-slate-700 leading-tight pt-1">
                  <strong>Delivery Address:</strong> {customerAddress}
                </p>
              ) : (
                <p className="text-xs text-slate-500 italic">Address as per buyer instructions</p>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-600 leading-tight">
              {customerAddress || 'Counter Pickup / Direct Handover'}
            </p>
          )}
          <div className="pt-1.5 text-[11px] text-slate-600">
            <span>Payment Mode: <strong className="text-slate-800 uppercase">{paymentMode}</strong></span>
            <span className="mx-2">•</span>
            <span>Status: <strong className={paymentStatus === 'Paid' ? 'text-emerald-700' : 'text-amber-700'}>{paymentStatus}</strong></span>
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="py-4 border-b border-slate-200">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b-2 border-slate-900 text-[10px] font-bold uppercase tracking-wider text-slate-800">
              <th className="py-2 pr-2 text-center w-8">#</th>
              <th className="py-2 px-2">Item Description</th>
              <th className="py-2 px-2 text-right w-16">Qty</th>
              <th className="py-2 px-2 text-center w-14">Unit</th>
              <th className="py-2 px-2 text-right w-20">Rate (₹)</th>
              <th className="py-2 pl-2 text-right w-24">Amount (₹)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-[11px]">
            {items.map((it: any, idx: number) => (
              <tr key={idx} className="hover:bg-slate-50/50">
                <td className="py-2 pr-2 text-center text-slate-400 font-mono text-[10px]">{idx + 1}</td>
                <td className="py-2 px-2">
                  <span className="font-semibold text-slate-900">{it.name}</span>
                  {it.code && <span className="text-[10px] text-slate-400 font-mono ml-1.5">[{it.code}]</span>}
                </td>
                <td className="py-2 px-2 text-right font-mono font-medium">{it.qty}</td>
                <td className="py-2 px-2 text-center text-slate-600 uppercase text-[10px]">{it.unit}</td>
                <td className="py-2 px-2 text-right font-mono text-slate-700">
                  {it.price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="py-2 pl-2 text-right font-mono font-bold text-slate-900">
                  {it.total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Calculations & Summary Grid */}
      <div className="grid grid-cols-2 gap-6 pt-4 no-break" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
        <div className="space-y-3">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              Amount In Words:
            </span>
            <p className="text-xs font-semibold text-slate-800 leading-snug">
              {numberToIndianWords(grandTotal)}
            </p>
          </div>
          {order.notes && (
            <div className="text-[11px] text-slate-600 bg-amber-50/50 border border-amber-200/50 rounded-lg p-2.5">
              <span className="font-bold text-amber-900 block text-[10px] uppercase">Notes:</span>
              <p>{order.notes}</p>
            </div>
          )}
        </div>

        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal:</span>
            <span className="font-mono font-semibold">
              ₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>

          {discountAmount > 0 && (
            <div className="flex justify-between text-emerald-700 font-semibold">
              <span>Discount:</span>
              <span className="font-mono">
                -₹{discountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}

          {boxCharges > 0 && (
            <div className="flex justify-between text-slate-600 text-[11px]">
              <span>Box / Sweet Box Charges:</span>
              <span className="font-mono">+₹{boxCharges.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          )}

          {packingCharges > 0 && (
            <div className="flex justify-between text-slate-600 text-[11px]">
              <span>Packing Charges:</span>
              <span className="font-mono">+₹{packingCharges.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          )}

          {stickerCharges > 0 && (
            <div className="flex justify-between text-slate-600 text-[11px]">
              <span>Custom Sticker Charges:</span>
              <span className="font-mono">+₹{stickerCharges.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          )}

          {shrinkCharges > 0 && (
            <div className="flex justify-between text-slate-600 text-[11px]">
              <span>Shrink Wrap Charges:</span>
              <span className="font-mono">+₹{shrinkCharges.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          )}

          {packetCharges > 0 && (
            <div className="flex justify-between text-slate-600 text-[11px]">
              <span>Packet / Pouch Charges:</span>
              <span className="font-mono">+₹{packetCharges.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          )}

          {transportCharges > 0 && (
            <div className="flex justify-between text-slate-600 text-[11px]">
              <span>Transport / Delivery:</span>
              <span className="font-mono">+₹{transportCharges.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          )}

          {cgstAmount > 0 ? (
            <div className="flex justify-between text-slate-600 text-[11px] pt-1 border-t border-slate-100">
              <span>CGST ({cgstPercent}%):</span>
              <span className="font-mono font-semibold">
                +₹{cgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          ) : null}

          {sgstAmount > 0 ? (
            <div className="flex justify-between text-slate-600 text-[11px]">
              <span>SGST ({sgstPercent}%):</span>
              <span className="font-mono font-semibold">
                +₹{sgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          ) : null}

          {/* Grand Total */}
          <div className="flex justify-between items-center text-sm font-black border-t-2 border-slate-900 pt-2 text-slate-900">
            <span>GRAND TOTAL:</span>
            <span className="font-mono text-base text-[#02626D]">
              ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>

          {/* Payments & Balance */}
          <div className="flex justify-between text-xs font-semibold text-emerald-800 pt-1">
            <span>Total Received / Advance:</span>
            <span className="font-mono">
              ₹{receivedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="flex justify-between text-xs font-black text-rose-700">
            <span>Balance Due:</span>
            <span className="font-mono">
              ₹{balanceDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* Footer / Terms & Conditions & Signatory */}
      <div
        className={`mt-10 pt-6 border-t border-slate-200 ${
          businessSettings.signatureUrl ? 'grid grid-cols-2 gap-8 items-end' : 'block'
        } no-break`}
        style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}
      >
        <div className="space-y-1 text-[10px] text-slate-500 leading-normal">
          <p className="font-bold text-slate-700 uppercase">Terms &amp; Conditions:</p>
          <p>1. Goods once sold will not be returned or exchanged.</p>
          <p>2. Keep sweets in cool and dry place / refrigeration as applicable.</p>
          <p>3. All disputes are subject to local jurisdiction.</p>
          <p className="italic text-slate-400 pt-1">
            {businessSettings.footerNote || 'Thank you for choosing Pattabiram Sweets! Visit again!'}
          </p>
        </div>

        {businessSettings.signatureUrl ? (
          <div className="text-right space-y-2">
            <p className="text-xs font-bold text-slate-800">
              For {businessSettings.businessName || 'PATTABIRAM SWEETS'}
            </p>
            <div className="flex flex-col items-end">
              <div className="h-14 flex items-end justify-end pb-1">
                <img
                  src={businessSettings.signatureUrl}
                  alt="Authorized Signature"
                  className="max-h-12 max-w-[160px] object-contain"
                  crossOrigin="anonymous"
                />
              </div>
              <span className="text-[11px] font-semibold text-slate-500 border-t border-slate-400 pt-1 px-4 inline-block">
                Authorized Signatory
              </span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
});

export default A4InvoiceDocument;

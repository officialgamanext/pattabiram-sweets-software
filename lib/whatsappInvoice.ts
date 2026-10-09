import { toJpeg } from 'html-to-image';
import { uploadToImageKit } from './imageCompressor';

export interface SendWhatsAppInvoiceResult {
  success: boolean;
  invoiceUrl?: string;
  messageId?: string;
  directWhatsAppUrl?: string;
  error?: string;
  details?: any;
}

/**
 * Normalizes phone number to international digits only (e.g., 919398638314)
 */
export function normalizePhoneNumber(phone: string): string {
  let cleaned = (phone || '').replace(/[^\d]/g, '');
  if (cleaned.length === 10) {
    cleaned = '91' + cleaned;
  }
  return cleaned;
}

/**
 * Generates direct WhatsApp Web/App click-to-chat URL as fallback or instant share
 */
export function generateDirectWhatsAppLink(order: any, invoiceUrl: string): string {
  const phone = normalizePhoneNumber(order.customerMobile || order.customerPhone || order.wholesalerMobile || '');
  const name = order.customerName || order.wholesalerName || 'Valued Customer';
  const invoiceNo = order.code || order.orderId || order.id || 'INV';
  const grandTotal = Number(order.totalAmount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  const date = order.orderDate || new Date().toLocaleDateString('en-IN');

  const text =
`🧾 *Your Invoice Is Ready!*

Hello ${name} 👋

Thank you for your purchase! Your invoice has been generated successfully.

📋 Invoice: #${invoiceNo}
💰 Amount: ₹${grandTotal}
📅 Date: ${date}

Your invoice is ready to view:
${invoiceUrl}

Thank you for choosing us! 🙏`;

  return `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`;
}

/**
 * Captures an A4 invoice element, renders it to a high-resolution JPEG,
 * and uploads it directly to ImageKit under the /invoices folder.
 */
export async function captureAndUploadA4Invoice(order: any, element: HTMLElement): Promise<string> {
  // Wait for all images inside the element to fully load
  const images = Array.from(element.querySelectorAll('img'));
  await Promise.all(
    images.map((img) => {
      if (img.complete && img.naturalHeight !== 0) return Promise.resolve();
      return new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
      });
    })
  );

  // Render element to high-res JPEG using html-to-image with fonts skipped to avoid cross-origin cssRules SecurityError
  const dataUrl = await toJpeg(element, {
    quality: 0.95,
    pixelRatio: 2,
    backgroundColor: '#ffffff',
    cacheBust: true,
    skipFonts: true,
    fontEmbedCSS: '',
  });

  const rawInvoiceNo = order.orderId || order.code || order.id || `INV_${Date.now()}`;
  const safeInvoiceNo = String(rawInvoiceNo).replace(/[^a-zA-Z0-9_-]/g, '');
  const fileName = `PattabhiRamaSweets-${safeInvoiceNo}.jpg`;

  // Upload to ImageKit in /invoices folder
  const cdnUrl = await uploadToImageKit(dataUrl, fileName, 'invoices');
  return cdnUrl;
}

/**
 * Executes the full flow:
 * 1. Captures A4 invoice HTML element as image
 * 2. Uploads image to ImageKit CDN (/invoices)
 * 3. Calls /api/whatsapp/send-invoice to trigger Meta WhatsApp Cloud API template message
 * 4. Also returns direct WhatsApp link as fallback
 */
export async function sendWhatsAppInvoiceFlow(
  order: any,
  element: HTMLElement
): Promise<SendWhatsAppInvoiceResult> {
  const customerMobile = order.customerMobile || order.customerPhone || order.wholesalerMobile || '';
  if (!customerMobile) {
    throw new Error('Customer mobile number is missing on this order.');
  }

  // 1 & 2: Capture and upload to ImageKit
  const invoiceUrl = await captureAndUploadA4Invoice(order, element);

  const customerName = order.customerName || order.wholesalerName || 'Valued Customer';
  const invoiceNumber = order.code || order.orderId || order.id || 'INV';
  const totalAmount = Number(order.totalAmount || 0);
  const invoiceDate = order.orderDate || new Date().toLocaleDateString('en-IN');

  const directWhatsAppUrl = generateDirectWhatsAppLink(order, invoiceUrl);

  // 3: Call Meta WhatsApp API route
  try {
    const res = await fetch('/api/whatsapp/send-invoice', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customerMobile,
        customerName,
        invoiceNumber,
        totalAmount,
        invoiceDate,
        invoiceUrl,
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      let friendlyError = data.error || 'Failed to send WhatsApp template via Meta Cloud API';
      if (typeof friendlyError === 'string' && friendlyError.includes('132001')) {
        friendlyError = 'Meta Error (#132001): Template name does not exist, language mismatch, or not yet approved in Meta. You can still send directly via the WhatsApp Web button below!';
      }

      return {
        success: false,
        invoiceUrl,
        directWhatsAppUrl,
        error: friendlyError,
        details: data,
      };
    }

    return {
      success: true,
      invoiceUrl,
      messageId: data.messageId,
      directWhatsAppUrl,
      details: data,
    };
  } catch (err: any) {
    return {
      success: false,
      invoiceUrl,
      directWhatsAppUrl,
      error: err?.message || 'Network error while sending WhatsApp message',
    };
  }
}

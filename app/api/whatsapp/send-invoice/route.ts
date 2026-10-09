import { NextRequest, NextResponse } from 'next/server';

const WHATSAPP_API_VERSION = process.env.WHATSAPP_API_VERSION || 'v21.0';
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || '';
const DEFAULT_TEMPLATE_NAME = process.env.WHATSAPP_INVOICE_TEMPLATE_NAME || 'customers_invoice_template';
const DEFAULT_LANG = process.env.WHATSAPP_TEMPLATE_LANG || 'en_US';
const BUTTON_URL_BASE = process.env.WHATSAPP_BUTTON_URL_BASE || 'https://ik.imagekit.io/o3ycj4srnb/';

/**
 * Normalizes phone number to international format (without +)
 * Default to India (91) for 10-digit numbers
 */
function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/[^\d]/g, '');
  if (cleaned.length === 10) {
    cleaned = '91' + cleaned;
  }
  return cleaned;
}

/**
 * Extracts the dynamic parameter for the template URL button if needed.
 */
function extractButtonParam(fullUrl: string): string {
  if (!fullUrl) return '';

  if (BUTTON_URL_BASE && fullUrl.startsWith(BUTTON_URL_BASE)) {
    return fullUrl.slice(BUTTON_URL_BASE.length);
  }

  const endpoint = process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT || 'https://ik.imagekit.io/o3ycj4srnb';
  const cleanEndpoint = endpoint.replace(/\/+$/, '') + '/';
  if (fullUrl.startsWith(cleanEndpoint)) {
    return fullUrl.slice(cleanEndpoint.length);
  }

  if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
    return fullUrl.replace(/^\/+/, '');
  }

  try {
    const parsed = new URL(fullUrl);
    return parsed.pathname.replace(/^\/+/, '') + parsed.search;
  } catch {
    return fullUrl;
  }
}

/**
 * Helper to post payload to Meta Graph API
 */
async function postToMeta(apiUrl: string, payload: any) {
  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      customerMobile,
      customerName,
      invoiceNumber,
      totalAmount,
      invoiceDate,
      invoiceUrl,
      templateName = DEFAULT_TEMPLATE_NAME,
      languageCode = DEFAULT_LANG,
      customButtonParam,
    } = body as {
      customerMobile: string;
      customerName: string;
      invoiceNumber: string;
      totalAmount: number | string;
      invoiceDate: string;
      invoiceUrl: string;
      templateName?: string;
      languageCode?: string;
      customButtonParam?: string;
    };

    if (!customerMobile) {
      return NextResponse.json(
        { success: false, error: 'Customer mobile number is required' },
        { status: 400 }
      );
    }

    if (!invoiceUrl) {
      return NextResponse.json(
        { success: false, error: 'Invoice URL is required' },
        { status: 400 }
      );
    }

    if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
      return NextResponse.json(
        {
          success: false,
          error:
            'WhatsApp API credentials missing in .env (WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN)',
          configMissing: true,
        },
        { status: 400 }
      );
    }

    const recipient = normalizePhone(customerMobile);
    const formattedAmount =
      typeof totalAmount === 'number'
        ? totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })
        : String(totalAmount).replace(/[₹,\s]/g, '');

    // Sanitize all parameters to avoid Meta 132018 (no newlines/tabs allowed)
    const cleanCustomerName = (customerName || 'Customer').replace(/[\r\n\t]+/g, ' ').trim();
    const cleanInvoiceNumber = (invoiceNumber || 'INV-001').replace(/[\r\n\t]+/g, ' ').trim();
    const cleanAmount = String(formattedAmount).replace(/[\r\n\t]+/g, ' ').trim();
    const cleanDate = String(invoiceDate || new Date().toLocaleDateString('en-IN')).replace(/[\r\n\t]+/g, ' ').trim();
    const cleanInvoiceUrl = String(invoiceUrl).replace(/[\r\n\t\s]+/g, '').trim();
    const buttonParam = (customButtonParam || extractButtonParam(cleanInvoiceUrl)).replace(/[\r\n\t\s]+/g, '').trim();

    const apiUrl = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${PHONE_NUMBER_ID}/messages`;

    // 5 Parameters Body:
    // {{1}} = Customer Name
    // {{2}} = Invoice Number
    // {{3}} = Amount
    // {{4}} = Date
    // {{5}} = Invoice Link (as written in your template: "Click Below Link 👇 \n\n {{5}}")
    const bodyParams5 = [
      { type: 'text', text: cleanCustomerName },
      { type: 'text', text: cleanInvoiceNumber },
      { type: 'text', text: cleanAmount },
      { type: 'text', text: cleanDate },
      { type: 'text', text: cleanInvoiceUrl },
    ];

    const bodyParams4 = [
      { type: 'text', text: cleanCustomerName },
      { type: 'text', text: cleanInvoiceNumber },
      { type: 'text', text: cleanAmount },
      { type: 'text', text: cleanDate },
    ];

    const buttonComponent = {
      type: 'button',
      sub_type: 'url',
      index: '0',
      parameters: [{ type: 'text', text: buttonParam }],
    };

    // Candidate languages to try (if en_US fails, try en; if en fails, try en_US)
    const languagesToTry = languageCode === 'en_US' ? ['en_US', 'en'] : ['en', 'en_US'];

    let lastError: any = null;

    // Strategy Pipeline:
    // 1. Try 5 body parameters WITHOUT button (matching template text with {{5}} link)
    // 2. Try 5 body parameters WITH button
    // 3. Try 4 body parameters WITH button
    for (const lang of languagesToTry) {
      // Attempt 1: 5 body params (No button)
      const p1 = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipient,
        type: 'template',
        template: {
          name: templateName,
          language: { code: lang },
          components: [{ type: 'body', parameters: bodyParams5 }],
        },
      };

      const res1 = await postToMeta(apiUrl, p1);
      if (res1.ok && res1.data?.messages?.[0]?.id) {
        return NextResponse.json({
          success: true,
          messageId: res1.data.messages[0].id,
          recipient,
          invoiceUrl: cleanInvoiceUrl,
          templateUsed: templateName,
          languageUsed: lang,
          data: res1.data,
        });
      }
      lastError = res1.data;

      // Attempt 2: 5 body params WITH button
      const p2 = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipient,
        type: 'template',
        template: {
          name: templateName,
          language: { code: lang },
          components: [{ type: 'body', parameters: bodyParams5 }, buttonComponent],
        },
      };

      const res2 = await postToMeta(apiUrl, p2);
      if (res2.ok && res2.data?.messages?.[0]?.id) {
        return NextResponse.json({
          success: true,
          messageId: res2.data.messages[0].id,
          recipient,
          invoiceUrl: cleanInvoiceUrl,
          templateUsed: templateName,
          languageUsed: lang,
          data: res2.data,
        });
      }
      lastError = res2.data;

      // Attempt 3: 4 body params WITH button
      const p3 = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipient,
        type: 'template',
        template: {
          name: templateName,
          language: { code: lang },
          components: [{ type: 'body', parameters: bodyParams4 }, buttonComponent],
        },
      };

      const res3 = await postToMeta(apiUrl, p3);
      if (res3.ok && res3.data?.messages?.[0]?.id) {
        return NextResponse.json({
          success: true,
          messageId: res3.data.messages[0].id,
          recipient,
          invoiceUrl: cleanInvoiceUrl,
          templateUsed: templateName,
          languageUsed: lang,
          data: res3.data,
        });
      }
      lastError = res3.data;
    }

    console.warn('Custom template attempts failed:', lastError);

    // Fallback: If custom template failed (e.g. pending approval or rejected),
    // dispatch via the active approved general_notification template!
    const fallbackText = `Your invoice #${cleanInvoiceNumber} for Rs. ${cleanAmount} is ready. View invoice: ${cleanInvoiceUrl}`.replace(/[\r\n\t]+/g, ' ').trim();
    const fallbackPayload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipient,
      type: 'template',
      template: {
        name: 'general_notification',
        language: { code: 'en' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: cleanCustomerName },
              { type: 'text', text: fallbackText },
            ],
          },
        ],
      },
    };

    const fallbackRes = await postToMeta(apiUrl, fallbackPayload);
    if (fallbackRes.ok && fallbackRes.data?.messages?.[0]?.id) {
      return NextResponse.json({
        success: true,
        fallbackUsed: true,
        messageId: fallbackRes.data.messages[0].id,
        recipient,
        invoiceUrl: cleanInvoiceUrl,
        note: `Delivered via notification template while ${templateName} is being confirmed by Meta.`,
        data: fallbackRes.data,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: lastError?.error?.message || 'Meta WhatsApp API request failed',
        details: lastError,
      },
      { status: 400 }
    );
  } catch (err: any) {
    console.error('WhatsApp send invoice route error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

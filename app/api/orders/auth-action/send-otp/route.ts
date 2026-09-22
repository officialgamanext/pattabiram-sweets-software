import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { sendOrderActionAuthOtpEmail } from '@/lib/email';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { orderId, orderCode, action, customerName, totalAmount, requestedBy, orderDate } = body;

    if (!orderId || !orderCode || !action) {
      return NextResponse.json(
        { error: 'Missing required parameters: orderId, orderCode, and action are required.' },
        { status: 400 }
      );
    }

    if (action !== 'edit' && action !== 'delete') {
      return NextResponse.json(
        { error: 'Invalid action. Must be "edit" or "delete".' },
        { status: 400 }
      );
    }

    // 1. Generate secure random 6-digit OTP and unique token
    const otp = String(crypto.randomInt(100000, 999999));
    const token = crypto.randomUUID();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes validity

    // 2. Save OTP session to Firestore securely
    const otpRef = doc(db, 'order_action_otps', token);
    await setDoc(otpRef, {
      token,
      otp,
      orderId,
      orderCode,
      action,
      customerName: customerName || 'Valued Customer',
      totalAmount: Number(totalAmount) || 0,
      requestedBy: requestedBy || 'Staff Member',
      orderDate: orderDate || '',
      createdAt: serverTimestamp(),
      expiresAt,
      verified: false,
      used: false,
    });

    // 3. Send email via SMTP (Nodemailer)
    await sendOrderActionAuthOtpEmail({
      otp,
      orderCode,
      action,
      customerName: customerName || 'Valued Customer',
      totalAmount: Number(totalAmount) || 0,
      requestedBy: requestedBy || 'Staff Member',
      orderDate: orderDate || '',
    });

    // 4. Return success response WITHOUT exposing the OTP
    return NextResponse.json({
      success: true,
      token,
      expiresAt,
      message: `OTP authorization code sent to administrator email for ${action === 'delete' ? 'deleting' : 'editing'} order #${orderCode}.`,
    });
  } catch (error: any) {
    console.error('Failed to send order action auth OTP:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to send OTP email. Please verify SMTP settings.' },
      { status: 500 }
    );
  }
}

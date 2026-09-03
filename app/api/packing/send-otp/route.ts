import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { sendPackingUnitTransferOtpEmail } from '@/lib/email';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { orderId, orderCode, targetType, itemName, currentUnitName, requestedBy } = body;

    if (!orderId || !orderCode || !targetType) {
      return NextResponse.json(
        { error: 'Missing required parameters (orderId, orderCode, targetType)' },
        { status: 400 }
      );
    }

    // 1. Generate secure random 6-digit OTP and unique token
    const otp = String(crypto.randomInt(100000, 999999));
    const token = crypto.randomUUID();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes validity

    // 2. Save OTP session to Firestore securely
    const otpRef = doc(db, 'packing_transfer_otps', token);
    await setDoc(otpRef, {
      token,
      otp,
      orderId,
      orderCode,
      targetType,
      itemName: itemName || null,
      currentUnitName: currentUnitName || null,
      requestedBy: requestedBy || 'Packing Portal',
      createdAt: serverTimestamp(),
      expiresAt,
      verified: false,
      used: false,
    });

    // 3. Send email via SMTP (Nodemailer)
    await sendPackingUnitTransferOtpEmail({
      otp,
      orderCode,
      targetType,
      itemName,
      currentUnitName,
      requestedBy,
    });

    // 4. Return success response WITHOUT exposing the OTP
    return NextResponse.json({
      success: true,
      token,
      expiresAt,
      message: 'OTP has been securely sent to administrator email.',
    });
  } catch (error: any) {
    console.error('Failed to send packing unit transfer OTP:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to send OTP email. Please verify SMTP settings.' },
      { status: 500 }
    );
  }
}

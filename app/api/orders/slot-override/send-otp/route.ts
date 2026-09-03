import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { sendSlotLimitOverrideOtpEmail } from '@/lib/email';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      categoryId,
      categoryName,
      itemId,
      itemName,
      requestedQty,
      unit,
      slot,
      date,
      maxLimit,
      bookedQty,
      requestedBy,
    } = body;

    if (!categoryName || !itemName || !slot || requestedQty === undefined) {
      return NextResponse.json(
        { error: 'Missing required parameters (categoryName, itemName, slot, requestedQty)' },
        { status: 400 }
      );
    }

    // 1. Generate secure random 6-digit OTP and unique token
    const otp = String(crypto.randomInt(100000, 999999));
    const token = crypto.randomUUID();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes validity

    // 2. Save OTP session to Firestore securely
    const otpRef = doc(db, 'slot_override_otps', token);
    await setDoc(otpRef, {
      token,
      otp,
      categoryId: categoryId || null,
      categoryName,
      itemId: itemId || null,
      itemName,
      requestedQty: Number(requestedQty),
      unit: unit || 'KG',
      slot,
      date: date || '',
      maxLimit: Number(maxLimit) || 0,
      bookedQty: Number(bookedQty) || 0,
      requestedBy: requestedBy || 'Order Booking Counter',
      createdAt: serverTimestamp(),
      expiresAt,
      verified: false,
      used: false,
    });

    // 3. Send email via SMTP (Nodemailer)
    await sendSlotLimitOverrideOtpEmail({
      otp,
      categoryName,
      itemName,
      requestedQty: Number(requestedQty),
      unit: unit || 'KG',
      slot,
      date: date || '',
      maxLimit: Number(maxLimit) || 0,
      bookedQty: Number(bookedQty) || 0,
      requestedBy: requestedBy || 'Order Booking Counter',
    });

    // 4. Return success response WITHOUT exposing the OTP
    return NextResponse.json({
      success: true,
      token,
      expiresAt,
      message: 'OTP has been securely sent to administrator email.',
    });
  } catch (error: any) {
    console.error('Failed to send slot limit override OTP:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to send OTP email. Please verify SMTP settings.' },
      { status: 500 }
    );
  }
}

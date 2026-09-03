import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { token, otp } = body;

    if (!token || !otp) {
      return NextResponse.json(
        { error: 'Token and OTP code are required.' },
        { status: 400 }
      );
    }

    const otpRef = doc(db, 'slot_override_otps', token);
    const otpSnap = await getDoc(otpRef);

    if (!otpSnap.exists()) {
      return NextResponse.json(
        { error: 'Invalid or expired authorization session.' },
        { status: 400 }
      );
    }

    const otpData = otpSnap.data();

    // Check expiration
    if (Date.now() > Number(otpData.expiresAt)) {
      return NextResponse.json(
        { error: 'This OTP has expired. Please request a new verification code.' },
        { status: 400 }
      );
    }

    // Check if already used
    if (otpData.used) {
      return NextResponse.json(
        { error: 'This authorization code has already been used.' },
        { status: 400 }
      );
    }

    // Validate OTP string match
    if (String(otpData.otp).trim() !== String(otp).trim()) {
      return NextResponse.json(
        { error: 'Incorrect OTP code. Please enter the 6-digit code received in email.' },
        { status: 400 }
      );
    }

    // Mark as verified
    await updateDoc(otpRef, {
      verified: true,
      verifiedAt: serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      verifiedToken: token,
      categoryId: otpData.categoryId,
      itemId: otpData.itemId,
      requestedQty: otpData.requestedQty,
      message: 'Slot limit override authorized successfully.',
    });
  } catch (error: any) {
    console.error('Failed to verify slot limit override OTP:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to verify OTP' },
      { status: 500 }
    );
  }
}

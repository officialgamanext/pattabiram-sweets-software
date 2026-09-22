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

    const otpRef = doc(db, 'order_action_otps', token);
    const otpSnap = await getDoc(otpRef);

    if (!otpSnap.exists()) {
      return NextResponse.json(
        { error: 'Invalid or expired authorization session. Please request a new OTP.' },
        { status: 400 }
      );
    }

    const otpData = otpSnap.data();

    // Check expiration
    if (Date.now() > Number(otpData.expiresAt)) {
      return NextResponse.json(
        { error: 'This authorization OTP has expired. Please request a new code.' },
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
        { error: 'Incorrect OTP code. Please enter the 6-digit code received in the administrator email.' },
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
      orderId: otpData.orderId,
      orderCode: otpData.orderCode,
      action: otpData.action,
      message: `Order ${otpData.action === 'delete' ? 'deletion' : 'edit'} authorized successfully.`,
    });
  } catch (error: any) {
    console.error('Failed to verify order action auth OTP:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to verify OTP' },
      { status: 500 }
    );
  }
}

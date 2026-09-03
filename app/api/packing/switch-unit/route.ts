import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, serverTimestamp, addDoc, collection } from 'firebase/firestore';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { token, orderId, destinationUnitName, targetType, itemName, reason, requestedBy } = body;

    if (!token || !orderId || !destinationUnitName) {
      return NextResponse.json(
        { error: 'Token, orderId, and destinationUnitName are required.' },
        { status: 400 }
      );
    }

    // 1. Verify token status in Firestore
    const otpRef = doc(db, 'packing_transfer_otps', token);
    const otpSnap = await getDoc(otpRef);

    if (!otpSnap.exists()) {
      return NextResponse.json(
        { error: 'Invalid transfer authorization token.' },
        { status: 400 }
      );
    }

    const otpData = otpSnap.data();

    if (!otpData.verified) {
      return NextResponse.json(
        { error: 'OTP has not been verified yet.' },
        { status: 403 }
      );
    }

    if (otpData.used) {
      return NextResponse.json(
        { error: 'This authorization token has already been used.' },
        { status: 400 }
      );
    }

    // 2. Fetch the target order
    const orderRef = doc(db, 'orders', orderId);
    const orderSnap = await getDoc(orderRef);

    if (!orderSnap.exists()) {
      return NextResponse.json(
        { error: 'Order not found.' },
        { status: 404 }
      );
    }

    const orderData = orderSnap.data();
    const currentItems = Array.isArray(orderData.items) ? orderData.items : [];

    let updatedItems: any[] = [];
    let previousUnit = '';

    if (targetType === 'item' && itemName) {
      // Update single item
      updatedItems = currentItems.map((it: any) => {
        const itName = (it.itemName || it.name || '').trim().toLowerCase();
        const targetName = itemName.trim().toLowerCase();
        if (itName === targetName) {
          previousUnit = it.packingUnitOverride || it.packingUnitName || 'Default Packing Unit';
          return {
            ...it,
            packingUnitName: destinationUnitName,
            packingUnitOverride: destinationUnitName,
          };
        }
        return it;
      });
    } else {
      // Update entire order
      previousUnit = orderData.packingUnitOverride || (currentItems[0] as any)?.packingUnitName || 'Default Packing Unit';
      updatedItems = currentItems.map((it: any) => ({
        ...it,
        packingUnitName: destinationUnitName,
        packingUnitOverride: destinationUnitName,
      }));
    }

    // 3. Update order in Firestore
    await updateDoc(orderRef, {
      items: updatedItems,
      ...(targetType !== 'item' ? { packingUnitOverride: destinationUnitName } : {}),
      updatedAt: serverTimestamp(),
    });

    // 4. Mark token as used
    await updateDoc(otpRef, {
      used: true,
      usedAt: serverTimestamp(),
      destinationUnitName,
    });

    // 5. Add Audit Log
    try {
      await addDoc(collection(db, 'audit_logs'), {
        action: 'PACKING_UNIT_SWITCHED',
        entityType: 'ORDER',
        entityId: orderId,
        orderCode: orderData.code || '',
        scope: targetType === 'item' ? `Item: ${itemName}` : 'Full Order',
        fromUnit: previousUnit,
        toUnit: destinationUnitName,
        reason: reason || 'Manual unit transfer authorized via OTP',
        performedBy: requestedBy || 'Packing Manager',
        authorizedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });
    } catch (auditErr) {
      console.warn('Failed to write audit log:', auditErr);
    }

    return NextResponse.json({
      success: true,
      message: `Successfully transferred ${targetType === 'item' ? itemName : 'order'} to ${destinationUnitName}.`,
    });
  } catch (error: any) {
    console.error('Failed to switch packing unit:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to switch packing unit' },
      { status: 500 }
    );
  }
}

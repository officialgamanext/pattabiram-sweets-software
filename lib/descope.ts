const descopeProjectId = process.env.NEXT_PUBLIC_DESCOPE_PROJECT_ID || 'P3HcZxRjNhSHQFLHR5Dnb2N4WvsH';

/**
 * Sends a Mobile OTP SMS code via Descope Auth API
 */
export async function sendDescopeOtp(phone: string): Promise<{ success: boolean; error?: string }> {
  let formattedPhone = phone.trim();
  if (!formattedPhone.startsWith('+')) {
    formattedPhone = `+91${formattedPhone}`;
  }

  try {
    const response = await fetch(`https://api.descope.com/v1/auth/otp/signup-in/sms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${descopeProjectId}`,
      },
      body: JSON.stringify({
        loginId: formattedPhone,
        user: { phone: formattedPhone },
      }),
    });

    if (response.ok || response.status === 200 || response.status === 201) {
      return { success: true };
    }

    const data = await response.json().catch(() => ({}));
    if (data.errorMessage || data.message || data.errorDescription) {
      return {
        success: false,
        error: data.errorMessage || data.errorDescription || data.message,
      };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Descope OTP Send error:', err);
    return { success: false, error: err.message || 'Failed to send Descope OTP.' };
  }
}

/**
 * Verifies a 6-digit Mobile OTP SMS code via Descope Auth API
 */
export async function verifyDescopeOtp(phone: string, code: string): Promise<{ success: boolean; error?: string }> {
  let formattedPhone = phone.trim();
  if (!formattedPhone.startsWith('+')) {
    formattedPhone = `+91${formattedPhone}`;
  }

  try {
    const response = await fetch(`https://api.descope.com/v1/auth/otp/verify/sms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${descopeProjectId}`,
      },
      body: JSON.stringify({
        loginId: formattedPhone,
        code: code,
      }),
    });

    if (response.ok || response.status === 200) {
      return { success: true };
    }

    const data = await response.json().catch(() => ({}));
    if (data.errorMessage || data.message || data.errorDescription) {
      return {
        success: false,
        error: data.errorMessage || data.errorDescription || data.message,
      };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Descope OTP Verify error:', err);
    return { success: false, error: err.message || 'Failed to verify Descope OTP.' };
  }
}

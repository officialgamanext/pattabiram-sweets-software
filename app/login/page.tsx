'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  signInWithEmailAndPassword,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { sendDescopeOtp, verifyDescopeOtp } from '@/lib/descope';
import { ShieldCheck, Mail, Lock, Phone, KeyRound, ArrowRight, Loader2, AlertCircle, RefreshCw, LockKeyhole } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { setEmployeeProfileByMobile } = useAuth();
  const [activeTab, setActiveTab] = useState<'superadmin' | 'phone'>('superadmin');

  // SuperAdmin state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState('');

  // Phone OTP state
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [otpStep, setOtpStep] = useState<'phone' | 'otp'>('phone');
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);

  // Recaptcha verifier reference
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => {
    return () => {
      if (recaptchaVerifierRef.current) {
        try {
          recaptchaVerifierRef.current.clear();
        } catch {
          // ignore clear error
        }
      }
    };
  }, []);

  const handleSuperAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError('');
    if (!email || !password) {
      setEmailError('Please fill in both email and password.');
      return;
    }

    setEmailLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.replace('/');
    } catch (err: unknown) {
      console.error('Login error:', err);
      const firebaseError = err as { code?: string; message?: string };
      if (
        firebaseError.code === 'auth/invalid-credential' ||
        firebaseError.code === 'auth/user-not-found' ||
        firebaseError.code === 'auth/wrong-password'
      ) {
        setEmailError('Invalid email or password. Please verify your credentials.');
      } else if (firebaseError.code === 'auth/too-many-requests') {
        setEmailError('Access temporarily blocked due to many failed attempts. Try again later.');
      } else {
        setEmailError(firebaseError.message || 'Failed to sign in. Please check your credentials.');
      }
    } finally {
      setEmailLoading(false);
    }
  };

  const setupRecaptcha = () => {
    if (recaptchaVerifierRef.current) {
      return recaptchaVerifierRef.current;
    }
    const verifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
      size: 'invisible',
      callback: () => {
        // reCAPTCHA solved
      },
    });
    recaptchaVerifierRef.current = verifier;
    return verifier;
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError('');

    let formattedPhone = phoneNumber.trim();
    if (!formattedPhone) {
      setPhoneError('Please enter a valid phone number.');
      return;
    }

    if (!formattedPhone.startsWith('+')) {
      formattedPhone = `+91${formattedPhone}`;
    }

    setPhoneLoading(true);
    try {
      // Pure Descope Mobile OTP SMS Trigger
      const descopeRes = await sendDescopeOtp(formattedPhone);
      if (descopeRes.success) {
        setOtpStep('otp');
      } else {
        setPhoneError(descopeRes.error || 'Failed to send Mobile OTP via Descope service.');
      }
    } catch (err: unknown) {
      console.error('Descope OTP Send error:', err);
      const errorMsg = (err as { message?: string }).message || 'Failed to send Descope OTP.';
      setPhoneError(errorMsg);
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError('');
    if (!otp || otp.length < 6) {
      setPhoneError('Please enter the full 6-digit OTP code.');
      return;
    }

    setPhoneLoading(true);
    try {
      let formattedPhone = phoneNumber.trim();
      if (!formattedPhone.startsWith('+')) formattedPhone = `+91${formattedPhone}`;

      // Pure Descope OTP Verification
      const descopeVerify = await verifyDescopeOtp(formattedPhone, otp);
      if (!descopeVerify.success) {
        setPhoneError(descopeVerify.error || 'Invalid OTP code entered.');
        return;
      }

      // Verify that the mobile number matches an active record in the Employee database
      const empResult = await setEmployeeProfileByMobile(formattedPhone);
      if (empResult.success) {
        router.replace('/');
      } else {
        setPhoneError(empResult.error || 'Access Denied: Mobile number is not registered in Employee database.');
      }
    } catch (err: unknown) {
      console.error('Descope OTP Verification error:', err);
      const errorMsg = (err as { message?: string }).message || 'Failed to verify Descope OTP code.';
      setPhoneError(errorMsg);
    } finally {
      setPhoneLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f6f7] flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden font-sans text-slate-800">
      {/* Background design accents */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-[#1a1a1a]" />

      {/* Main card matching Shopify Polaris light theme */}
      <div className="w-full max-w-md bg-white border border-slate-200/90 rounded-2xl shadow-xl overflow-hidden relative z-10">
        
        {/* Header Branding */}
        <div className="p-6 sm:p-8 pb-5 text-center border-b border-slate-100 bg-white">
          <div className="inline-flex items-center gap-2 bg-[#1a1a1a] text-white px-3 py-1.5 rounded-lg mb-4 shadow-2xs">
            <span className="font-extrabold text-xs tracking-wider uppercase">Pattabiram</span>
            <span className="text-[10px] text-slate-400 font-medium bg-[#2a2a2c] px-2 py-0.5 rounded-full">
              Spring &apos;26
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Log in</h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">Continue to Pattabiram Sweets Admin</p>
        </div>

        {/* Tab Switcher */}
        <div className="px-6 pt-4 bg-white">
          <div className="flex bg-[#f1f2f4] p-1 rounded-xl gap-1 border border-slate-200/60">
            <button
              type="button"
              onClick={() => {
                setActiveTab('superadmin');
                setEmailError('');
              }}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'superadmin'
                  ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck size={14} />
              <span>SuperAdmin</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('phone');
                setPhoneError('');
              }}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'phone'
                  ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Phone size={14} />
              <span>Phone OTP</span>
            </button>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-6 sm:p-8">
          {/* TAB 1: SuperAdmin (Email & Password) */}
          {activeTab === 'superadmin' && (
            <form onSubmit={handleSuperAdminLogin} className="space-y-4">
              {emailError && (
                <div className="p-3 rounded-lg bg-[#fbeae5] border border-[#f8c9c0] text-[#8e1f0b] text-xs flex items-start gap-2 font-medium">
                  <AlertCircle size={15} className="mt-0.5 flex-shrink-0 text-[#8e1f0b]" />
                  <span>{emailError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">SuperAdmin Email</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Mail size={15} />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@pattabiramsweets.com"
                    className="w-full pl-9 pr-3 h-9 bg-[#f7f7f8] focus:bg-white border border-slate-300 rounded-lg text-slate-800 text-xs placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-400 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock size={15} />
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-9 pr-3 h-9 bg-[#f7f7f8] focus:bg-white border border-slate-300 rounded-lg text-slate-800 text-xs placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-400 transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={emailLoading}
                className="w-full mt-2 h-9 bg-[#303030] hover:bg-[#111111] disabled:bg-slate-400 text-white font-semibold text-xs rounded-lg shadow-2xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {emailLoading ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <span>Log in</span>
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </form>
          )}

          {/* TAB 2: Phone OTP Authentication */}
          {activeTab === 'phone' && (
            <div>
              {otpStep === 'phone' ? (
                <form onSubmit={handleSendOtp} className="space-y-4">
                  {phoneError && (
                    <div className="p-3 rounded-lg bg-[#fbeae5] border border-[#f8c9c0] text-[#8e1f0b] text-xs flex items-start gap-2 font-medium">
                      <AlertCircle size={15} className="mt-0.5 flex-shrink-0 text-[#8e1f0b]" />
                      <span>{phoneError}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Registered Phone Number</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Phone size={15} />
                      </div>
                      <input
                        type="tel"
                        required
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="9876543210 or +91 9876543210"
                        className="w-full pl-9 pr-3 h-9 bg-[#f7f7f8] focus:bg-white border border-slate-300 rounded-lg text-slate-800 text-xs placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-400 transition-all"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">An SMS OTP verification code will be sent to your mobile number.</p>
                  </div>

                  <button
                    type="submit"
                    disabled={phoneLoading}
                    className="w-full mt-2 h-9 bg-[#303030] hover:bg-[#111111] disabled:bg-slate-400 text-white font-semibold text-xs rounded-lg shadow-2xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {phoneLoading ? (
                      <>
                        <Loader2 size={15} className="animate-spin" />
                        <span>Sending OTP...</span>
                      </>
                    ) : (
                      <>
                        <span>Get OTP Code</span>
                        <ArrowRight size={14} />
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  {phoneError && (
                    <div className="p-3 rounded-lg bg-[#fbeae5] border border-[#f8c9c0] text-[#8e1f0b] text-xs flex items-start gap-2 font-medium">
                      <AlertCircle size={15} className="mt-0.5 flex-shrink-0 text-[#8e1f0b]" />
                      <span>{phoneError}</span>
                    </div>
                  )}

                  <div className="text-center bg-[#f1f2f4] border border-slate-200 p-2.5 rounded-lg mb-2">
                    <p className="text-xs text-slate-700">OTP code sent to <span className="font-bold text-slate-900">{phoneNumber}</span></p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Enter 6-Digit OTP</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <KeyRound size={15} />
                      </div>
                      <input
                        type="text"
                        maxLength={6}
                        required
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                        placeholder="123456"
                        className="w-full pl-9 pr-3 h-9 bg-[#f7f7f8] focus:bg-white border border-slate-300 rounded-lg text-slate-900 text-sm tracking-widest font-mono placeholder-slate-300 focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-400 transition-all text-center"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={phoneLoading}
                    className="w-full h-9 bg-[#303030] hover:bg-[#111111] disabled:bg-slate-400 text-white font-semibold text-xs rounded-lg shadow-2xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {phoneLoading ? (
                      <>
                        <Loader2 size={15} className="animate-spin" />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <>
                        <span>Verify &amp; Sign In</span>
                        <ArrowRight size={14} />
                      </>
                    )}
                  </button>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setOtpStep('phone');
                        setOtp('');
                        setPhoneError('');
                      }}
                      className="text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                    >
                      Change Number
                    </button>

                    <button
                      type="button"
                      onClick={(e) => handleSendOtp(e)}
                      className="text-slate-800 hover:text-black font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw size={12} />
                      Resend OTP
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Hidden reCAPTCHA container */}
        <div id="recaptcha-container" />

        {/* Footer info notice matching layout style */}
        <div className="p-3.5 text-center border-t border-slate-100 bg-[#f7f7f8] text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
          <LockKeyhole size={13} className="text-slate-400" />
          <span>Secured with Firebase Email &amp; Descope Mobile OTP Authentication</span>
        </div>
      </div>
    </div>
  );
}

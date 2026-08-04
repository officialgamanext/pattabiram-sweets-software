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
import { ShieldCheck, Mail, Lock, Phone, KeyRound, ArrowRight, Loader2, AlertCircle, RefreshCw, LockKeyhole } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
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
      const verifier = setupRecaptcha();
      const confirmation = await signInWithPhoneNumber(auth, formattedPhone, verifier);
      setConfirmationResult(confirmation);
      setOtpStep('otp');
    } catch (err: unknown) {
      console.error('OTP Send error:', err);
      const firebaseError = err as { code?: string; message?: string };
      if (firebaseError.code === 'auth/invalid-phone-number') {
        setPhoneError('Invalid phone number format. Include country code e.g. +91 9876543210');
      } else if (firebaseError.code === 'auth/quota-exceeded') {
        setPhoneError('SMS quota exceeded. Please try again later.');
      } else if (firebaseError.code === 'auth/operation-not-allowed') {
        setPhoneError('SMS sending to this region is disabled in Firebase Console. Enable Phone Sign-in and add your region (e.g. India +91) under Authentication > Settings > SMS Region Policy.');
      } else {
        setPhoneError(firebaseError.message || 'Failed to send OTP code.');
      }
      if (recaptchaVerifierRef.current) {
        try {
          recaptchaVerifierRef.current.clear();
          recaptchaVerifierRef.current = null;
        } catch {
          // ignore
        }
      }
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
    if (!confirmationResult) {
      setPhoneError('Session expired. Please request a new OTP code.');
      setOtpStep('phone');
      return;
    }

    setPhoneLoading(true);
    try {
      await confirmationResult.confirm(otp);
      router.replace('/');
    } catch (err: unknown) {
      console.error('OTP Verification error:', err);
      const firebaseError = err as { code?: string; message?: string };
      if (firebaseError.code === 'auth/invalid-verification-code') {
        setPhoneError('Incorrect OTP code. Please verify and try again.');
      } else {
        setPhoneError(firebaseError.message || 'Failed to verify OTP code.');
      }
    } finally {
      setPhoneLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100/90 flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden font-sans">
      {/* Background design elements matching dashboard */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main card matching application light theme */}
      <div className="w-full max-w-md bg-white border border-slate-200/90 rounded-3xl shadow-xl overflow-hidden relative z-10">
        
        {/* Header Branding */}
        <div className="p-8 pb-6 text-center border-b border-slate-100 bg-gradient-to-b from-slate-50/80 to-white">
          <div className="inline-flex items-center justify-center bg-white border border-slate-200/80 rounded-2xl p-3.5 mb-4 shadow-sm">
            <Image
              src="/logo.png"
              alt="Pattabiram Sweets"
              width={160}
              height={44}
              className="h-10 w-auto object-contain"
              priority
            />
          </div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">Portal Access Sign In</h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">Management & Operations Software</p>
        </div>

        {/* Tab Switcher */}
        <div className="p-3 bg-slate-50 border-b border-slate-100">
          <div className="flex bg-slate-200/60 p-1 rounded-2xl gap-1">
            <button
              type="button"
              onClick={() => {
                setActiveTab('superadmin');
                setEmailError('');
              }}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === 'superadmin'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck size={16} />
              <span>SuperAdmin</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('phone');
                setPhoneError('');
              }}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === 'phone'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Phone size={16} />
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
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5 font-medium">
                  <AlertCircle size={16} className="mt-0.5 flex-shrink-0 text-red-500" />
                  <span>{emailError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">SuperAdmin Email</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail size={18} />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@pattabiramsweets.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:bg-white focus:ring-2 focus:ring-indigo-600/10 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock size={18} />
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:bg-white focus:ring-2 focus:ring-indigo-600/10 transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={emailLoading}
                className="w-full mt-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold text-sm rounded-xl shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {emailLoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to Dashboard</span>
                    <ArrowRight size={18} />
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
                    <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5 font-medium">
                      <AlertCircle size={16} className="mt-0.5 flex-shrink-0 text-red-500" />
                      <span>{phoneError}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Registered Phone Number</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Phone size={18} />
                      </div>
                      <input
                        type="tel"
                        required
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="9876543210 or +91 9876543210"
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:bg-white focus:ring-2 focus:ring-indigo-600/10 transition-all"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">An SMS OTP verification code will be sent to your mobile number.</p>
                  </div>

                  <button
                    type="submit"
                    disabled={phoneLoading}
                    className="w-full mt-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold text-sm rounded-xl shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {phoneLoading ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        <span>Sending OTP...</span>
                      </>
                    ) : (
                      <>
                        <span>Get OTP Code</span>
                        <ArrowRight size={18} />
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  {phoneError && (
                    <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5 font-medium">
                      <AlertCircle size={16} className="mt-0.5 flex-shrink-0 text-red-500" />
                      <span>{phoneError}</span>
                    </div>
                  )}

                  <div className="text-center bg-indigo-50 border border-indigo-100 p-3 rounded-xl mb-3">
                    <p className="text-xs text-indigo-900">OTP code sent to <span className="font-bold text-indigo-700">{phoneNumber}</span></p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Enter 6-Digit OTP</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <KeyRound size={18} />
                      </div>
                      <input
                        type="text"
                        maxLength={6}
                        required
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                        placeholder="123456"
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-base tracking-widest font-mono placeholder-slate-300 focus:outline-none focus:border-indigo-600 focus:bg-white focus:ring-2 focus:ring-indigo-600/10 transition-all text-center"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={phoneLoading}
                    className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold text-sm rounded-xl shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {phoneLoading ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <>
                        <span>Verify &amp; Sign In</span>
                        <ArrowRight size={18} />
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
                      className="text-indigo-600 hover:text-indigo-800 font-semibold transition-colors flex items-center gap-1 cursor-pointer"
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
        <div className="p-4 text-center border-t border-slate-100 bg-slate-50/60 text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
          <LockKeyhole size={13} className="text-slate-400" />
          <span>Secured with Firebase Authentication</span>
        </div>
      </div>
    </div>
  );
}

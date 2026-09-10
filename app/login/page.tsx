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
import {
  findEmployeeByMobile,
  saveEmployeeMpin,
  EmployeeLookupResult,
} from '@/lib/employeeAuth';
import {
  ShieldCheck,
  Mail,
  Lock,
  Phone,
  KeyRound,
  ArrowRight,
  ArrowLeft,
  Loader2,
  AlertCircle,
  RefreshCw,
  LockKeyhole,
  Download,
  Smartphone,
  Share,
  CheckCircle2,
  Eye,
  EyeOff,
  Key,
  Sparkles,
  UserCheck,
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { setEmployeeProfileByMobile } = useAuth();
  const [activeTab, setActiveTab] = useState<'superadmin' | 'phone'>('superadmin');

  // SuperAdmin state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState('');

  // Employee Mobile & MPIN state
  const [phoneNumber, setPhoneNumber] = useState('');
  const [mobileStep, setMobileStep] = useState<'phone' | 'mpin' | 'otp' | 'set_mpin'>('phone');
  const [matchedEmployee, setMatchedEmployee] = useState<EmployeeLookupResult['employee'] | null>(null);
  const [enteredMpin, setEnteredMpin] = useState('');
  const [showMpin, setShowMpin] = useState(false);
  const [newMpin, setNewMpin] = useState('');
  const [confirmMpin, setConfirmMpin] = useState('');
  const [showNewMpin, setShowNewMpin] = useState(false);
  const [otp, setOtp] = useState('');
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [phoneSuccess, setPhoneSuccess] = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);

  // Resend OTP countdown effect
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendCountdown > 0) {
      timer = setInterval(() => {
        setResendCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendCountdown]);

  // Recaptcha verifier reference
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

  // PWA Install state
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isAppInstalled, setIsAppInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);

  useEffect(() => {
    // Check if running in standalone mode (already installed as PWA)
    if (
      typeof window !== 'undefined' &&
      (window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true)
    ) {
      setIsAppInstalled(true);
    }

    // Check if iOS
    if (typeof window !== 'undefined') {
      const userAgent = window.navigator.userAgent.toLowerCase();
      setIsIOS(/iphone|ipad|ipod/.test(userAgent));
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsAppInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsAppInstalled(true);
      }
      setDeferredPrompt(null);
    } else if (isIOS) {
      setShowIOSPrompt(true);
    } else {
      // Fallback message if browser already shows install icon in address bar
      alert('To install the app, click the Install / (+) button in your browser address bar or menu.');
    }
  };

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

  const resetMobileState = () => {
    setMobileStep('phone');
    setPhoneNumber('');
    setMatchedEmployee(null);
    setEnteredMpin('');
    setShowMpin(false);
    setNewMpin('');
    setConfirmMpin('');
    setShowNewMpin(false);
    setOtp('');
    setPhoneError('');
    setPhoneSuccess('');
    setResendCountdown(0);
  };

  const handleBackToPhone = () => {
    setMobileStep('phone');
    setEnteredMpin('');
    setOtp('');
    setPhoneError('');
    setPhoneSuccess('');
  };

  // 1. Enter phone -> check if employee exists & if MPIN is set
  const handleCheckMobile = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError('');
    setPhoneSuccess('');

    const clean = phoneNumber.trim().replace(/\D/g, '');
    if (!clean || clean.length < 10) {
      setPhoneError('Please enter a valid 10-digit mobile number.');
      return;
    }

    setPhoneLoading(true);
    try {
      const lookup = await findEmployeeByMobile(clean);
      if (!lookup.found || !lookup.employee) {
        setPhoneError(lookup.error || 'Mobile number is not registered in the Employee database.');
        return;
      }

      setMatchedEmployee(lookup.employee);

      // Check if employee already has an MPIN configured
      if (lookup.employee.hasMpin) {
        // Employee has MPIN -> Prompt directly for MPIN without sending OTP!
        setEnteredMpin('');
        setMobileStep('mpin');
      } else {
        // No MPIN -> Send SMS OTP first to verify identity before setting MPIN
        let formattedPhone = clean;
        if (!formattedPhone.startsWith('+')) {
          formattedPhone = `+91${formattedPhone}`;
        }
        const descopeRes = await sendDescopeOtp(formattedPhone);
        if (descopeRes.success) {
          setOtp('');
          setResendCountdown(30);
          setMobileStep('otp');
        } else {
          setPhoneError(descopeRes.error || 'Failed to send SMS OTP via Descope.');
        }
      }
    } catch (err: any) {
      console.error('Error during employee mobile check:', err);
      setPhoneError(err.message || 'Failed to check mobile number.');
    } finally {
      setPhoneLoading(false);
    }
  };

  // 2. Verify MPIN directly (no OTP needed)
  const handleVerifyMpin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError('');
    setPhoneSuccess('');

    if (!enteredMpin || enteredMpin.length !== 4) {
      setPhoneError('Please enter your 4-digit MPIN.');
      return;
    }

    if (!matchedEmployee) {
      setPhoneError('Session expired. Please enter your mobile number again.');
      setMobileStep('phone');
      return;
    }

    // Validate entered MPIN against stored MPIN
    if (enteredMpin.trim() !== matchedEmployee.mpin?.trim()) {
      setPhoneError('Incorrect MPIN. Please try again or click "Forgot MPIN?".');
      setEnteredMpin('');
      return;
    }

    setPhoneLoading(true);
    try {
      let formattedPhone = (matchedEmployee.mobile || phoneNumber).trim().replace(/\D/g, '');
      if (!formattedPhone.startsWith('+')) {
        formattedPhone = `+91${formattedPhone}`;
      }

      const empResult = await setEmployeeProfileByMobile(formattedPhone);
      if (empResult.success) {
        router.replace('/');
      } else {
        setPhoneError(empResult.error || 'Access Denied: Unable to establish employee session.');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setPhoneError(err.message || 'Login failed.');
    } finally {
      setPhoneLoading(false);
    }
  };

  // 3. User forgot MPIN -> trigger OTP to reset
  const handleForgotMpin = async () => {
    setPhoneError('');
    setPhoneSuccess('');
    setPhoneLoading(true);

    try {
      let formattedPhone = (matchedEmployee?.mobile || phoneNumber).trim().replace(/\D/g, '');
      if (!formattedPhone.startsWith('+')) {
        formattedPhone = `+91${formattedPhone}`;
      }

      const descopeRes = await sendDescopeOtp(formattedPhone);
      if (descopeRes.success) {
        setOtp('');
        setResendCountdown(30);
        setMobileStep('otp');
      } else {
        setPhoneError(descopeRes.error || 'Failed to send OTP for MPIN reset.');
      }
    } catch (err: any) {
      console.error('Error sending reset OTP:', err);
      setPhoneError(err.message || 'Failed to send reset OTP.');
    } finally {
      setPhoneLoading(false);
    }
  };

  // 4. Resend OTP code
  const handleResendOtp = async () => {
    if (resendCountdown > 0) return;
    setPhoneError('');
    setPhoneLoading(true);

    try {
      let formattedPhone = (matchedEmployee?.mobile || phoneNumber).trim().replace(/\D/g, '');
      if (!formattedPhone.startsWith('+')) {
        formattedPhone = `+91${formattedPhone}`;
      }

      const descopeRes = await sendDescopeOtp(formattedPhone);
      if (descopeRes.success) {
        setResendCountdown(30);
        setPhoneSuccess('OTP resent successfully.');
      } else {
        setPhoneError(descopeRes.error || 'Failed to resend OTP.');
      }
    } catch (err: any) {
      console.error('Resend OTP error:', err);
      setPhoneError(err.message || 'Failed to resend OTP.');
    } finally {
      setPhoneLoading(false);
    }
  };

  // 5. Verify OTP (for first time MPIN setup or reset)
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError('');
    setPhoneSuccess('');

    if (!otp || otp.length < 6) {
      setPhoneError('Please enter the full 6-digit OTP code.');
      return;
    }

    setPhoneLoading(true);
    try {
      let formattedPhone = (matchedEmployee?.mobile || phoneNumber).trim().replace(/\D/g, '');
      if (!formattedPhone.startsWith('+')) {
        formattedPhone = `+91${formattedPhone}`;
      }

      const descopeVerify = await verifyDescopeOtp(formattedPhone, otp);
      if (!descopeVerify.success) {
        setPhoneError(descopeVerify.error || 'Invalid OTP code entered.');
        return;
      }

      // OTP verified successfully -> move to set MPIN step
      setNewMpin('');
      setConfirmMpin('');
      setMobileStep('set_mpin');
    } catch (err: any) {
      console.error('Descope OTP Verification error:', err);
      setPhoneError(err.message || 'Failed to verify Descope OTP code.');
    } finally {
      setPhoneLoading(false);
    }
  };

  // 6. Set MPIN in Firestore and log the employee in
  const handleSetMpinAndLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError('');
    setPhoneSuccess('');

    const cleanNew = newMpin.trim();
    const cleanConfirm = confirmMpin.trim();

    if (!/^\d{4}$/.test(cleanNew)) {
      setPhoneError('MPIN must be exactly 4 numeric digits.');
      return;
    }

    if (cleanNew !== cleanConfirm) {
      setPhoneError('MPINs do not match. Please ensure both fields are identical.');
      return;
    }

    if (!matchedEmployee?.id) {
      setPhoneError('Session error. Please restart login.');
      setMobileStep('phone');
      return;
    }

    setPhoneLoading(true);
    try {
      // Save new MPIN to Firestore
      const saveRes = await saveEmployeeMpin(matchedEmployee.id, cleanNew);
      if (!saveRes.success) {
        setPhoneError(saveRes.error || 'Failed to save MPIN.');
        return;
      }

      // Login employee into context
      let formattedPhone = (matchedEmployee.mobile || phoneNumber).trim().replace(/\D/g, '');
      if (!formattedPhone.startsWith('+')) {
        formattedPhone = `+91${formattedPhone}`;
      }

      const empResult = await setEmployeeProfileByMobile(formattedPhone);
      if (empResult.success) {
        router.replace('/');
      } else {
        setPhoneError(empResult.error || 'MPIN set successfully! Please log in with your new MPIN.');
        setMobileStep('mpin');
        setEnteredMpin('');
      }
    } catch (err: any) {
      console.error('Error saving MPIN and logging in:', err);
      setPhoneError(err.message || 'Failed to save MPIN.');
    } finally {
      setPhoneLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f6f7] flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden font-sans text-slate-800">
      {/* Background design accents */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-[#02626D]" />

      {/* Main card matching Shopify Polaris light theme */}
      <div className="w-full max-w-md bg-white border border-slate-200/90 rounded-2xl shadow-xl overflow-hidden relative z-10">
        
        {/* Header Branding */}
        <div className="p-6 sm:p-8 pb-4 text-center border-b border-slate-100 bg-white">
          <div className="inline-flex items-center gap-2 bg-[#02626D] text-white px-3 py-1.5 rounded-lg mb-3 shadow-2xs">
            <span className="font-extrabold text-xs tracking-wider uppercase">Pattabiram</span>
            <span className="text-[10px] text-teal-100 font-medium bg-[#024f58] px-2 py-0.5 rounded-full border border-[#014047]">
              Spring &apos;26
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Log in</h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">Continue to Pattabiram Sweets Admin</p>

          {/* PWA Install Button (Only visible on login screen before login, hidden if already installed) */}
          {!isAppInstalled && (
            <div className="mt-4 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={handleInstallClick}
                className="w-full py-2 px-3 bg-teal-50/80 hover:bg-teal-100/80 text-[#02626D] border border-teal-200/90 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center justify-between gap-2 group cursor-pointer"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-[#02626D] text-white flex items-center justify-center flex-shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                    <Download size={14} />
                  </div>
                  <div className="text-left min-w-0">
                    <span className="block text-xs font-bold text-slate-900 truncate">Install Pattabiram App</span>
                    <span className="block text-[10px] text-slate-500 font-normal">Add to Home Screen & Desktop</span>
                  </div>
                </div>

                <span className="px-2 py-1 rounded-lg bg-[#02626D] text-white text-[10.5px] font-semibold flex items-center gap-1 shadow-2xs group-hover:bg-[#014d56] transition-colors flex-shrink-0">
                  <Smartphone size={12} />
                  <span>Install</span>
                </span>
              </button>
            </div>
          )}
        </div>

        {/* iOS PWA Install Instruction Modal */}
        {showIOSPrompt && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-3.5 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-slate-200">
                    <Image src="/app-icon.png" alt="App Icon" fill className="object-contain p-0.5" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">Install on iPhone / iPad</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowIOSPrompt(false)}
                  className="p-1 text-slate-400 hover:text-slate-700 text-xs font-bold rounded-lg"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-2.5 text-xs text-slate-600">
                <p className="font-medium text-slate-800">Follow these 2 quick steps to install:</p>
                <div className="flex items-start gap-2.5 p-2 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="w-5 h-5 rounded-full bg-[#02626D] text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">1</span>
                  <p>Tap the <strong>Share button ( <Share size={12} className="inline mx-0.5" /> )</strong> in Safari’s navigation bar at the bottom.</p>
                </div>
                <div className="flex items-start gap-2.5 p-2 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="w-5 h-5 rounded-full bg-[#02626D] text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">2</span>
                  <p>Scroll down and select <strong>&quot;Add to Home Screen&quot;</strong>, then tap <strong>Add</strong>.</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowIOSPrompt(false)}
                className="w-full h-8.5 rounded-xl bg-[#02626D] text-white text-xs font-semibold hover:bg-[#014d56] transition-colors shadow-2xs cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        )}

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
                setPhoneSuccess('');
              }}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'phone'
                  ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Smartphone size={14} />
              <span>Employee Login</span>
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
                className="w-full mt-2 h-9 bg-[#02626D] hover:bg-[#014d56] disabled:bg-slate-400 text-white font-semibold text-xs rounded-lg shadow-2xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
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

          {/* TAB 2: Employee Phone & MPIN Authentication */}
          {activeTab === 'phone' && (
            <div>
              {/* Common Alerts */}
              {phoneError && (
                <div className="mb-4 p-3 rounded-xl bg-[#fbeae5] border border-[#f8c9c0] text-[#8e1f0b] text-xs flex items-start gap-2 font-medium animate-in fade-in">
                  <AlertCircle size={15} className="mt-0.5 flex-shrink-0 text-[#8e1f0b]" />
                  <span>{phoneError}</span>
                </div>
              )}
              {phoneSuccess && (
                <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2 font-medium animate-in fade-in">
                  <CheckCircle2 size={15} className="mt-0.5 flex-shrink-0 text-emerald-600" />
                  <span>{phoneSuccess}</span>
                </div>
              )}

              {/* STEP 1: Enter Phone Number */}
              {mobileStep === 'phone' && (
                <form onSubmit={handleCheckMobile} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Employee Mobile Number
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Phone size={15} />
                      </div>
                      <input
                        type="tel"
                        required
                        autoFocus
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="9876543210 or +91 9876543210"
                        className="w-full pl-9 pr-3 h-9.5 bg-[#f7f7f8] focus:bg-white border border-slate-300 rounded-lg text-slate-800 text-xs placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-400 transition-all font-medium"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                      Enter your 10-digit registered number. If MPIN is set, you will be prompted for it directly without OTP.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={phoneLoading}
                    className="w-full mt-2 h-9.5 bg-[#02626D] hover:bg-[#014d56] disabled:bg-slate-400 text-white font-semibold text-xs rounded-lg shadow-2xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {phoneLoading ? (
                      <>
                        <Loader2 size={15} className="animate-spin" />
                        <span>Verifying Mobile...</span>
                      </>
                    ) : (
                      <>
                        <span>Continue</span>
                        <ArrowRight size={14} />
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* STEP 2: Enter Existing MPIN (Quick Login without OTP) */}
              {mobileStep === 'mpin' && (
                <form onSubmit={handleVerifyMpin} className="space-y-4">
                  {/* User Badge Banner */}
                  <div className="p-3 bg-teal-50/70 border border-teal-200/80 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-[#02626D] text-white flex items-center justify-center text-xs font-bold shadow-2xs">
                        {matchedEmployee?.name ? matchedEmployee.name.charAt(0).toUpperCase() : 'E'}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900 leading-tight">
                          {matchedEmployee?.name}
                        </p>
                        <p className="text-[10.5px] text-slate-500">
                          +91 {phoneNumber.replace(/\D/g, '').slice(-10)}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleBackToPhone}
                      className="text-[11px] font-semibold text-[#02626D] hover:underline cursor-pointer"
                    >
                      Change
                    </button>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-700">
                        Enter 4-Digit MPIN
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowMpin(!showMpin)}
                        className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
                      >
                        {showMpin ? <EyeOff size={12} /> : <Eye size={12} />}
                        <span>{showMpin ? 'Hide' : 'Show'}</span>
                      </button>
                    </div>

                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <KeyRound size={15} />
                      </div>
                      <input
                        type={showMpin ? 'text' : 'password'}
                        inputMode="numeric"
                        maxLength={4}
                        pattern="[0-9]*"
                        required
                        autoFocus
                        value={enteredMpin}
                        onChange={(e) => setEnteredMpin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder="••••"
                        className="w-full pl-9 pr-3 h-11 bg-[#f7f7f8] focus:bg-white border border-slate-300 rounded-lg text-slate-900 text-lg tracking-[0.5em] font-mono placeholder-slate-300 focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-400 transition-all text-center"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={phoneLoading || enteredMpin.length !== 4}
                    className="w-full h-9.5 bg-[#02626D] hover:bg-[#014d56] disabled:bg-slate-300 text-white font-semibold text-xs rounded-lg shadow-2xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {phoneLoading ? (
                      <>
                        <Loader2 size={15} className="animate-spin" />
                        <span>Signing In...</span>
                      </>
                    ) : (
                      <>
                        <span>Sign In with MPIN</span>
                        <ArrowRight size={14} />
                      </>
                    )}
                  </button>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={handleBackToPhone}
                      className="text-slate-500 hover:text-slate-800 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <ArrowLeft size={12} />
                      Change Number
                    </button>

                    <button
                      type="button"
                      onClick={handleForgotMpin}
                      disabled={phoneLoading}
                      className="text-[#02626D] hover:text-[#014d56] font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Key size={12} />
                      Forgot MPIN? Reset via OTP
                    </button>
                  </div>
                </form>
              )}

              {/* STEP 3: OTP Verification (First-time setup or Forgot MPIN) */}
              {mobileStep === 'otp' && (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div className="text-center bg-[#f1f2f4] border border-slate-200 p-3 rounded-xl">
                    <p className="text-xs text-slate-700">
                      SMS OTP sent to <span className="font-bold text-slate-900">+91 {phoneNumber.replace(/\D/g, '').slice(-10)}</span>
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Verify OTP to set your secure MPIN
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 text-center">
                      Enter 6-Digit OTP Code
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <KeyRound size={15} />
                      </div>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        pattern="[0-9]*"
                        required
                        autoFocus
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="123456"
                        className="w-full pl-9 pr-3 h-11 bg-[#f7f7f8] focus:bg-white border border-slate-300 rounded-lg text-slate-900 text-base tracking-[0.4em] font-mono placeholder-slate-300 focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-400 transition-all text-center"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={phoneLoading || otp.length < 6}
                    className="w-full h-9.5 bg-[#02626D] hover:bg-[#014d56] disabled:bg-slate-300 text-white font-semibold text-xs rounded-lg shadow-2xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {phoneLoading ? (
                      <>
                        <Loader2 size={15} className="animate-spin" />
                        <span>Verifying OTP...</span>
                      </>
                    ) : (
                      <>
                        <span>Verify &amp; Continue</span>
                        <ArrowRight size={14} />
                      </>
                    )}
                  </button>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={handleBackToPhone}
                      className="text-slate-500 hover:text-slate-800 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <ArrowLeft size={12} />
                      Change Number
                    </button>

                    {resendCountdown > 0 ? (
                      <span className="text-[11.5px] text-slate-400 font-medium">
                        Resend code in {resendCountdown}s
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleResendOtp}
                        className="text-[#02626D] hover:text-[#014d56] font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw size={12} />
                        Resend OTP
                      </button>
                    )}
                  </div>
                </form>
              )}

              {/* STEP 4: Set 4-Digit MPIN (After OTP is verified) */}
              {mobileStep === 'set_mpin' && (
                <form onSubmit={handleSetMpinAndLogin} className="space-y-4">
                  <div className="p-3 bg-emerald-50 border border-emerald-200/80 rounded-xl">
                    <div className="flex items-center gap-2 text-emerald-800 text-xs font-bold mb-0.5">
                      <Sparkles size={14} className="text-emerald-600" />
                      <span>Set Your 4-Digit MPIN</span>
                    </div>
                    <p className="text-[11px] text-emerald-700 leading-relaxed">
                      Create an MPIN for <strong>{matchedEmployee?.name}</strong>. Next time you log in, just enter this MPIN without SMS OTP!
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-700">
                        New 4-Digit MPIN
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowNewMpin(!showNewMpin)}
                        className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
                      >
                        {showNewMpin ? <EyeOff size={12} /> : <Eye size={12} />}
                        <span>{showNewMpin ? 'Hide' : 'Show'}</span>
                      </button>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Lock size={15} />
                      </div>
                      <input
                        type={showNewMpin ? 'text' : 'password'}
                        inputMode="numeric"
                        maxLength={4}
                        pattern="[0-9]*"
                        required
                        autoFocus
                        value={newMpin}
                        onChange={(e) => setNewMpin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder="••••"
                        className="w-full pl-9 pr-3 h-10 bg-[#f7f7f8] focus:bg-white border border-slate-300 rounded-lg text-slate-900 text-base tracking-[0.5em] font-mono placeholder-slate-300 focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-400 transition-all text-center"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Confirm 4-Digit MPIN
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Lock size={15} />
                      </div>
                      <input
                        type={showNewMpin ? 'text' : 'password'}
                        inputMode="numeric"
                        maxLength={4}
                        pattern="[0-9]*"
                        required
                        value={confirmMpin}
                        onChange={(e) => setConfirmMpin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder="••••"
                        className="w-full pl-9 pr-3 h-10 bg-[#f7f7f8] focus:bg-white border border-slate-300 rounded-lg text-slate-900 text-base tracking-[0.5em] font-mono placeholder-slate-300 focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-400 transition-all text-center"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={phoneLoading || newMpin.length !== 4 || confirmMpin.length !== 4}
                    className="w-full h-9.5 bg-[#02626D] hover:bg-[#014d56] disabled:bg-slate-300 text-white font-semibold text-xs rounded-lg shadow-2xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {phoneLoading ? (
                      <>
                        <Loader2 size={15} className="animate-spin" />
                        <span>Saving MPIN...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={14} />
                        <span>Save MPIN &amp; Sign In</span>
                      </>
                    )}
                  </button>

                  <div className="text-center pt-1">
                    <button
                      type="button"
                      onClick={handleBackToPhone}
                      className="text-xs text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                    >
                      Cancel
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

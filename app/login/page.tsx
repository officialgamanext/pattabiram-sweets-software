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
  ShieldCheck,
  Mail,
  Lock,
  Phone,
  KeyRound,
  ArrowRight,
  Loader2,
  AlertCircle,
  RefreshCw,
  LockKeyhole,
  Download,
  Smartphone,
  Share,
  CheckCircle2,
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

  // Phone OTP state
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [otpStep, setOtpStep] = useState<'phone' | 'otp'>('phone');
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);

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
                    className="w-full mt-2 h-9 bg-[#02626D] hover:bg-[#014d56] disabled:bg-slate-400 text-white font-semibold text-xs rounded-lg shadow-2xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
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
                    className="w-full h-9 bg-[#02626D] hover:bg-[#014d56] disabled:bg-slate-400 text-white font-semibold text-xs rounded-lg shadow-2xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
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

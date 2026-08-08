'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Header from '@/components/Header';
import { Loader2, ShieldAlert } from 'lucide-react';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isLoginPage = pathname === '/login';

  useEffect(() => {
    if (!loading && !user && !isLoginPage) {
      router.replace('/login');
    }
    if (!loading && user && isLoginPage) {
      router.replace('/');
    }
  }, [user, loading, isLoginPage, router]);

  // While checking auth status, show full screen loader
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 animate-pulse shadow-sm">
            <Loader2 size={28} className="animate-spin" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800 tracking-tight">Pattabiram Sweets</h3>
            <p className="text-xs text-slate-500 mt-1">Verifying secure access credentials...</p>
          </div>
        </div>
      </div>
    );
  }

  // If on login page, render children directly without Header
  if (isLoginPage) {
    return <>{children}</>;
  }

  // If not authenticated and not on login page, prevent flash of protected content
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 text-slate-800">
        <div className="flex flex-col items-center text-center max-w-sm">
          <ShieldAlert size={48} className="text-amber-500 mb-4" />
          <h2 className="text-xl font-bold">Access Restricted</h2>
          <p className="text-sm text-slate-500 mt-2">Redirecting to secure login authentication...</p>
        </div>
      </div>
    );
  }

  // Authenticated user on protected page: render Header and main workspace container
  return (
    <div className="min-h-screen bg-[#f6f6f7] font-sans antialiased text-[#1a1a1a]">
      <Header />
      <main className="shopify-main-layout">
        <div className="max-w-[1400px] mx-auto space-y-6">
          {children}
        </div>
      </main>
    </div>
  );
}

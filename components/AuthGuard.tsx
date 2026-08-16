'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import Header from '@/components/Header';
import { Loader2, ShieldAlert, Lock, ArrowLeft, ShieldX } from 'lucide-react';

const ROUTE_MENU_KEY_MAP: Record<string, string> = {
  '/': 'dashboard',
  '/pos': 'pos',
  '/orders': 'orders',
  '/walk-in-sales': 'walk_in_sales',
  '/items': 'items',
  '/store': 'store',
  '/inventory': 'inventory',
  '/price-list': 'price_list',
  '/manufacturing': 'manufacturing',
  '/packing': 'packing',
  '/wholesalers': 'wholesalers',
  '/wholesaler-orders': 'wholesaler_orders',
  '/customers': 'customers',
  '/employees': 'employee_portal',
  '/payroll': 'payroll',
  '/manufacturing-portal': 'manufacturing_portal',
  '/packing-portal': 'packing_portal',
  '/employee-portal': 'employee_portal',
  '/support': 'support',
  '/settings': 'settings',
};

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, employeeProfile, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isLoginPage = pathname === '/login';

  const isAuthenticated = Boolean(user || employeeProfile);

  useEffect(() => {
    if (!loading && !isAuthenticated && !isLoginPage) {
      router.replace('/login');
    }
    if (!loading && isAuthenticated && isLoginPage) {
      router.replace('/');
    }
  }, [isAuthenticated, loading, isLoginPage, router]);

  // While checking auth status, show full screen loader
  if (loading) {
    return (
      <div className="min-h-screen bg-[#f6f6f7] flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-900 animate-pulse shadow-sm">
            <Loader2 size={28} className="animate-spin" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 tracking-tight">Pattabiram Sweets</h3>
            <p className="text-xs text-slate-500 mt-1">Verifying secure employee access credentials...</p>
          </div>
        </div>
      </div>
    );
  }

  // If on login page, render children directly without Header
  if (isLoginPage) {
    return <>{children}</>;
  }

  // If not authenticated and not on login page
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#f6f6f7] flex flex-col items-center justify-center p-4 text-slate-800">
        <div className="flex flex-col items-center text-center max-w-sm bg-white p-6 rounded-2xl border border-slate-200 shadow-xl">
          <ShieldAlert size={48} className="text-amber-500 mb-3" />
          <h2 className="text-xl font-bold text-slate-900">Access Restricted</h2>
          <p className="text-xs text-slate-500 mt-2">Redirecting to secure employee login authentication...</p>
        </div>
      </div>
    );
  }

  // ── URL ROUTE PERMISSION SECURITY GUARD ─────────────────────────────────────
  // Check if current employee has view permission for this route
  const currentMenuKey = ROUTE_MENU_KEY_MAP[pathname];
  const isSuperAdmin = employeeProfile?.isSuperAdmin || (user?.email && !employeeProfile);
  const hasViewPermission =
    isSuperAdmin ||
    !currentMenuKey ||
    Boolean(employeeProfile?.permissions?.[currentMenuKey]?.view);

  if (!hasViewPermission) {
    return (
      <div className="min-h-screen bg-[#f6f6f7] font-sans antialiased text-[#1a1a1a]">
        <Header />
        <main className="shopify-main-layout">
          <div className="max-w-xl mx-auto mt-12 bg-white rounded-2xl border border-rose-200/90 shadow-2xl p-8 text-center space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto shadow-2xs">
              <ShieldX size={36} />
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-extrabold tracking-widest text-rose-700 uppercase bg-rose-100 px-2.5 py-1 rounded-full border border-rose-200">
                403 Forbidden — Security Guard Alert
              </span>
              <h1 className="text-2xl font-extrabold text-slate-900 pt-2 tracking-tight">Access Denied by Administrator</h1>
              <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed pt-1">
                You do not have access permission to view the <span className="font-bold text-slate-900 font-mono">[{pathname}]</span> module. Access is restricted for your employee account.
              </p>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-left text-xs space-y-1 font-mono">
              <div className="flex justify-between text-slate-500">
                <span>Employee Name:</span>
                <span className="font-bold text-slate-800">{employeeProfile?.name || 'Staff User'}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Attempted URL Path:</span>
                <span className="font-bold text-rose-600">{pathname}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Security Enforcement:</span>
                <span className="font-bold text-slate-800">Strict URL Route Guard</span>
              </div>
            </div>

            <div className="pt-2">
              <Link
                href="/employee-portal"
                className="h-9 px-5 text-xs font-semibold rounded-lg bg-[#02626D] hover:bg-[#014d56] text-white shadow-2xs inline-flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <ArrowLeft size={14} />
                <span>Return to My Employee Portal</span>
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Authenticated user with valid permission: render Header and main workspace container
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

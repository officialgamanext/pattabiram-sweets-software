'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import {
  Menu,
  X,
  Bell,
  Search,
  ChevronDown,
  Eye,
  Home,
  ShoppingBag,
  Store,
  Factory,
  Package,
  Users,
  ClipboardList,
  Tag,
  Boxes,
  UserCheck,
  CreditCard,
  Settings,
  Headphones,
  LogOut,
  User as UserIcon,
  Receipt,
  Printer,
} from 'lucide-react';

export default function Header() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setIsMobileDrawerOpen(false);
  }, [pathname]);

  const userDisplayName = user?.email ? user.email.split('@')[0] : 'Admin User';

  // Grouped Navigation matching Shopify Sidebar Architecture
  const mainNavItems = [
    { label: 'Home', href: '/', icon: <Home size={17} /> },
    { label: 'Billing & POS', href: '/pos', icon: <Receipt size={17} /> },
    { label: 'Orders', href: '/orders', icon: <ShoppingBag size={17} />},
    { label: 'Walk-In Sales', href: '/walk-in-sales', icon: <Printer size={17} /> },
    { label: 'Products', href: '/items', icon: <Tag size={17} /> },
    { label: 'Stores', href: '/store', icon: <Store size={17} /> },
    { label: 'Inventory', href: '/inventory', icon: <Boxes size={17} /> },
    { label: 'Price List', href: '/price-list', icon: <ClipboardList size={17} /> },
  ];

  const managementNavItems = [
    { label: 'Manufacturing', href: '/manufacturing', icon: <Factory size={17} /> },
    { label: 'Packing Unit', href: '/packing', icon: <Package size={17} /> },
    { label: 'Wholesalers', href: '/wholesalers', icon: <Users size={17} /> },
    { label: 'Wholesaler Orders', href: '/wholesaler-orders', icon: <Users size={17} /> },
    { label: 'Customers', href: '/customers', icon: <UserCheck size={17} /> },
    { label: 'Employees', href: '/employees', icon: <UserCheck size={17} /> },
    { label: 'Payroll', href: '/payroll', icon: <CreditCard size={17} /> },
  ];

  const portalNavItems = [
    { label: 'Mfg Portal', href: '/manufacturing-portal', icon: <Factory size={17} /> },
    { label: 'Packing Portal', href: '/packing-portal', icon: <Package size={17} /> },
    { label: 'Employee Portal', href: '/employee-portal', icon: <UserCheck size={17} /> },
    { label: 'Support', href: '/support', icon: <Headphones size={17} /> },
  ];

  const renderNavLink = (item: { label: string; href: string; icon: React.ReactNode; count?: number }) => {
    const isActive = pathname === item.href;
    return (
      <Link
        key={item.href}
        href={item.href}
        className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
          isActive
            ? 'bg-white text-slate-900 font-semibold shadow-2xs border border-slate-200/80'
            : 'text-[#4a4a4a] hover:bg-[#e1e1e2]/70 hover:text-slate-900'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <span className={isActive ? 'text-slate-900' : 'text-slate-500'}>{item.icon}</span>
          <span className="truncate">{item.label}</span>
        </div>
        {item.count !== undefined && (
          <span
            className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
              isActive ? 'bg-slate-100 text-slate-700' : 'bg-slate-200/80 text-slate-600'
            }`}
          >
            {item.count}
          </span>
        )}
      </Link>
    );
  };

  return (
    <>
      {/* ── TOP DARK HEADER BAR (Shopify Spring '26 Header) ───────────────────── */}
      <header className="fixed top-0 left-0 right-0 h-14 bg-[#1a1a1a] text-slate-200 z-50 flex items-center justify-between px-3 sm:px-4 border-b border-[#2c2c2e]">
        {/* Left: Brand / Logo + Edition Tag */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsMobileDrawerOpen(!isMobileDrawerOpen)}
            className="lg:hidden text-slate-300 hover:text-white p-1.5 rounded-md hover:bg-[#2c2c2e] transition-colors cursor-pointer"
            aria-label="Toggle menu"
          >
            <Menu size={20} />
          </button>

          <Link href="/" className="flex items-center gap-2">
            <div className="bg-white px-2 py-0.5 rounded flex items-center justify-center">
              <span className="text-black font-extrabold text-xs tracking-wider uppercase">Pattabiram</span>
            </div>
            <span className="text-[11px] font-medium text-slate-400 bg-[#2c2c2e] px-2 py-0.5 rounded-full hidden sm:inline-block">
              Spring &apos;26
            </span>
          </Link>
        </div>

        {/* Center: Search Bar with Shortcut Badge */}
        <div className="flex-1 max-w-md mx-4 hidden md:flex items-center">
          <div className="relative w-full flex items-center">
            <Search size={14} className="absolute left-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search"
              className="w-full bg-[#2a2a2c] hover:bg-[#323235] focus:bg-[#323235] text-slate-100 placeholder-slate-400 text-xs rounded-lg pl-9 pr-16 py-1.5 border border-[#3a3a3c] focus:outline-none focus:border-slate-400 transition-all"
            />
            <div className="absolute right-2 flex items-center gap-1">
              <kbd className="bg-[#3a3a3c] text-[10px] text-slate-300 font-semibold px-1.5 py-0.5 rounded border border-[#4a4a4c]">
                CTRL
              </kbd>
              <kbd className="bg-[#3a3a3c] text-[10px] text-slate-300 font-semibold px-1.5 py-0.5 rounded border border-[#4a4a4c]">
                K
              </kbd>
            </div>
          </div>
        </div>

        {/* Right: Actions (View As, Notifications, User Pill) */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button className="hidden sm:flex items-center gap-1.5 bg-[#2a2a2c] hover:bg-[#323235] text-slate-200 text-xs px-2.5 py-1 rounded-lg border border-[#3a3a3c] font-medium transition-colors cursor-pointer">
            <Eye size={14} className="text-slate-400" />
            <span>View as</span>
          </button>

          <button className="relative p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-[#2c2c2e] transition-colors cursor-pointer">
            <Bell size={18} />
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-500"></span>
          </button>

          {/* User Store Pill Dropdown */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 bg-[#2a2a2c] hover:bg-[#323235] text-white px-2.5 py-1 rounded-lg border border-[#3a3a3c] text-xs font-semibold cursor-pointer transition-colors"
            >
              <div className="w-5 h-5 rounded-full bg-purple-600 text-white text-[10px] font-bold flex items-center justify-center uppercase">
                {userDisplayName.charAt(0)}
              </div>
              <span className="truncate max-w-[120px]">{userDisplayName}</span>
              <ChevronDown size={12} className="text-slate-400" />
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-[#2a2a2c] rounded-xl shadow-2xl border border-[#3a3a3c] py-2 z-50 text-slate-200 text-xs animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-3 py-2 border-b border-[#3a3a3c]">
                  <p className="font-bold text-white truncate">{userDisplayName}</p>
                  <p className="text-[11px] text-slate-400 truncate">{user?.email || 'admin@pattabiram.com'}</p>
                </div>
                <div className="p-1">
                  <Link
                    href="/settings"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-[#3a3a3c] rounded-lg transition-colors"
                  >
                    <Settings size={14} />
                    <span>Store Settings</span>
                  </Link>
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-red-400 hover:bg-[#3a3a3c] rounded-lg transition-colors text-left cursor-pointer"
                  >
                    <LogOut size={14} />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── DESKTOP LEFT SIDEBAR NAVIGATION ──────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col fixed top-14 left-0 bottom-0 w-60 bg-[#ebebeb] border-r border-[#dcdcdc] z-40 overflow-y-auto p-3 text-slate-800">
        <div className="space-y-4">
          {/* Main Navigation */}
          <div className="space-y-0.5">
            {mainNavItems.map(renderNavLink)}
          </div>

          {/* Category Section: Management */}
          <div>
            <p className="px-3 mb-1 text-[11px] font-bold text-[#6d6d6d] uppercase tracking-wider">
              Management
            </p>
            <div className="space-y-0.5">
              {managementNavItems.map(renderNavLink)}
            </div>
          </div>

          {/* Category Section: Operations & Portals */}
          <div>
            <p className="px-3 mb-1 text-[11px] font-bold text-[#6d6d6d] uppercase tracking-wider">
              Portals & Services
            </p>
            <div className="space-y-0.5">
              {portalNavItems.map(renderNavLink)}
            </div>
          </div>
        </div>

        {/* Pinned Bottom Section */}
        <div className="mt-auto pt-4 border-t border-[#dcdcdc] space-y-0.5">
          {renderNavLink({ label: 'Settings', href: '/settings', icon: <Settings size={17} /> })}
        </div>
      </aside>

      {/* ── MOBILE DRAWER NAVIGATION ────────────────────────────────────────── */}
      {isMobileDrawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileDrawerOpen(false)}
          />
          <div className="relative w-64 bg-[#ebebeb] h-full shadow-2xl flex flex-col z-10 p-3 pt-4 overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#dcdcdc] mb-3">
              <span className="font-bold text-slate-900 text-sm">Pattabiram Sweets</span>
              <button
                onClick={() => setIsMobileDrawerOpen(false)}
                className="p-1 text-slate-500 hover:text-slate-800 rounded-md"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4">
              <div className="space-y-0.5">{mainNavItems.map(renderNavLink)}</div>
              <div>
                <p className="px-3 mb-1 text-[11px] font-bold text-[#6d6d6d] uppercase tracking-wider">Management</p>
                <div className="space-y-0.5">{managementNavItems.map(renderNavLink)}</div>
              </div>
              <div>
                <p className="px-3 mb-1 text-[11px] font-bold text-[#6d6d6d] uppercase tracking-wider">Portals</p>
                <div className="space-y-0.5">{portalNavItems.map(renderNavLink)}</div>
              </div>
              <div className="pt-2 border-t border-[#dcdcdc]">
                {renderNavLink({ label: 'Settings', href: '/settings', icon: <Settings size={17} /> })}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

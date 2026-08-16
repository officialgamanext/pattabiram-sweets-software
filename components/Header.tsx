'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import { usePrinter } from '@/context/PrinterContext';
import ThermalPrinterModal from '@/components/ThermalPrinterModal';
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
  Usb,
  Bluetooth,
  Zap,
  PowerOff,
  Sliders,
} from 'lucide-react';

export default function Header() {
  const pathname = usePathname();
  const { user, employeeProfile, logout } = useAuth();
  const {
    isConnected: isPrinterConnected,
    printerType,
    printerName,
    connectUsbPrinter,
    connectBluetoothPrinter,
    disconnectPrinter,
    printTestSlip,
    printWindow,
    isPrinting,
  } = usePrinter();

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [printerMenuOpen, setPrinterMenuOpen] = useState(false);
  const [isPrinterModalOpen, setIsPrinterModalOpen] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  const userMenuRef = useRef<HTMLDivElement>(null);
  const printerMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
      if (printerMenuRef.current && !printerMenuRef.current.contains(event.target as Node)) {
        setPrinterMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setIsMobileDrawerOpen(false);
  }, [pathname]);

  const userDisplayName = employeeProfile?.name || (user?.email ? user.email.split('@')[0] : 'Admin User');

  // Permission Check Helper
  const isNavAllowed = (href: string) => {
    if (!employeeProfile) return true;
    if (employeeProfile.isSuperAdmin) return true;
    const menuKeyMap: Record<string, string> = {
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
    const key = menuKeyMap[href];
    if (!key) return true;
    return Boolean(employeeProfile.permissions?.[key]?.view);
  };

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
  ].filter((item) => isNavAllowed(item.href));

  const managementNavItems = [
    { label: 'Manufacturing', href: '/manufacturing', icon: <Factory size={17} /> },
    { label: 'Packing Unit', href: '/packing', icon: <Package size={17} /> },
    { label: 'Wholesalers', href: '/wholesalers', icon: <Users size={17} /> },
    { label: 'Wholesaler Orders', href: '/wholesaler-orders', icon: <Users size={17} /> },
    { label: 'Customers', href: '/customers', icon: <UserCheck size={17} /> },
    { label: 'Employees', href: '/employees', icon: <UserCheck size={17} /> },
    { label: 'Payroll', href: '/payroll', icon: <CreditCard size={17} /> },
  ].filter((item) => isNavAllowed(item.href));

  const portalNavItems = [
    { label: 'Mfg Portal', href: '/manufacturing-portal', icon: <Factory size={17} /> },
    { label: 'Packing Portal', href: '/packing-portal', icon: <Package size={17} /> },
    { label: 'Employee Portal', href: '/employee-portal', icon: <UserCheck size={17} /> },
    { label: 'Support', href: '/support', icon: <Headphones size={17} /> },
  ].filter((item) => isNavAllowed(item.href));

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
      {/* ── TOP HEADER BAR (Branded #02626D Teal Header) ───────────────────── */}
      <header className="fixed top-0 left-0 right-0 h-14 bg-[#02626D] text-white z-50 flex items-center justify-between px-3 sm:px-4 border-b border-[#014d56] shadow-sm">
        {/* Left: Brand / Logo + Edition Tag */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsMobileDrawerOpen(!isMobileDrawerOpen)}
            className="lg:hidden text-teal-100 hover:text-white p-1.5 rounded-md hover:bg-[#024f58] transition-colors cursor-pointer"
            aria-label="Toggle menu"
          >
            <Menu size={20} />
          </button>

          <Link href="/" className="flex items-center gap-2">
            <div className="bg-white px-2 py-0.5 rounded flex items-center justify-center shadow-2xs">
              <span className="text-[#02626D] font-extrabold text-xs tracking-wider uppercase">Pattabiram</span>
            </div>
            <span className="text-[11px] font-medium text-teal-100 bg-[#024f58] px-2 py-0.5 rounded-full hidden sm:inline-block border border-[#01464e]">
              Spring &apos;26
            </span>
          </Link>
        </div>

        {/* Center: Search Bar with Shortcut Badge */}
        <div className="flex-1 max-w-md mx-4 hidden md:flex items-center">
          <div className="relative w-full flex items-center">
            <Search size={14} className="absolute left-3 text-teal-200" />
            <input
              type="text"
              placeholder="Search"
              className="w-full bg-[#024f58] hover:bg-[#035b65] focus:bg-[#035b65] text-white placeholder-teal-200/80 text-xs rounded-lg pl-9 pr-16 py-1.5 border border-[#01464e] focus:outline-none focus:border-teal-300 transition-all"
            />
            <div className="absolute right-2 flex items-center gap-1">
              <kbd className="bg-[#014047] text-[10px] text-teal-100 font-semibold px-1.5 py-0.5 rounded border border-[#01353b]">
                CTRL
              </kbd>
              <kbd className="bg-[#014047] text-[10px] text-teal-100 font-semibold px-1.5 py-0.5 rounded border border-[#01353b]">
                K
              </kbd>
            </div>
          </div>
        </div>

        {/* Right: Actions (Thermal Printer, View As, Notifications, User Pill) */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Thermal Printer Header Connector Dropdown */}
          <div className="relative" ref={printerMenuRef}>
            <button
              onClick={() => setPrinterMenuOpen(!printerMenuOpen)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${
                isPrinterConnected
                  ? 'bg-[#013f46] hover:bg-[#01353b] text-emerald-300 border-emerald-400/50 shadow-xs'
                  : 'bg-[#024f58] hover:bg-[#035b65] text-white border-[#01464e]'
              }`}
              title={isPrinterConnected ? `Connected: ${printerName} (${printerType})` : 'Connect Thermal Printer'}
            >
              {isPrinterConnected ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  {printerType === 'USB' ? (
                    <Usb size={13} className="text-emerald-400" />
                  ) : (
                    <Bluetooth size={13} className="text-teal-200" />
                  )}
                  <span className="hidden sm:inline-block truncate max-w-[100px] text-[11px]">
                    {printerType === 'USB' ? 'USB' : 'BT'}: {printerName ? printerName.split(' ')[0] : 'Online'}
                  </span>
                  <span className="sm:hidden text-[11px]">Printer</span>
                </>
              ) : (
                <>
                  <Printer size={14} className="text-teal-200" />
                  <span className="hidden md:inline-block text-[11px] text-teal-100">Connect Printer</span>
                  <span className="md:hidden text-[11px]">Printer</span>
                </>
              )}
              <ChevronDown size={11} className="text-teal-200" />
            </button>

            {/* Quick Thermal Printer Dropdown */}
            {printerMenuOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-[#02444c] rounded-xl shadow-2xl border border-[#01353b] py-2 z-50 text-slate-100 text-xs animate-in fade-in slide-in-from-top-2 duration-150">
                {/* Header Status in Dropdown */}
                <div className="px-3.5 py-2.5 border-b border-[#01353b] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2.5 h-2.5 rounded-full ${
                        isPrinterConnected ? 'bg-emerald-400 animate-pulse' : 'bg-teal-300/60'
                      }`}
                    />
                    <div>
                      <p className="font-bold text-white text-xs">
                        {isPrinterConnected ? 'Thermal Printer Ready' : 'Thermal Printer'}
                      </p>
                      <p className="text-[10px] text-teal-200 truncate max-w-[180px]">
                        {isPrinterConnected ? `${printerType} • ${printerName}` : 'No hardware device connected'}
                      </p>
                    </div>
                  </div>
                  {isPrinterConnected && (
                    <button
                      onClick={() => {
                        disconnectPrinter();
                        setPrinterMenuOpen(false);
                      }}
                      className="text-rose-300 hover:text-rose-200 p-1 hover:bg-[#01353b] rounded text-[10px] flex items-center gap-1 cursor-pointer"
                      title="Disconnect printer"
                    >
                      <PowerOff size={11} />
                    </button>
                  )}
                </div>

                {/* Connection Triggers */}
                <div className="p-1.5 space-y-1">
                  <button
                    onClick={async () => {
                      await connectUsbPrinter();
                      setPrinterMenuOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-[#035661] rounded-lg transition-colors text-left cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-md bg-emerald-400/20 text-emerald-300 flex items-center justify-center">
                        <Usb size={13} />
                      </div>
                      <div>
                        <p className="font-semibold text-white text-xs">Connect Web USB</p>
                        <p className="text-[10px] text-teal-200">USB cable / Serial thermal printer</p>
                      </div>
                    </div>
                    {printerType === 'USB' && isPrinterConnected && (
                      <span className="text-[9px] font-bold text-emerald-300 bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-600/50">
                        ACTIVE
                      </span>
                    )}
                  </button>

                  <button
                    onClick={async () => {
                      await connectBluetoothPrinter();
                      setPrinterMenuOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-[#035661] rounded-lg transition-colors text-left cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-md bg-teal-400/20 text-teal-200 flex items-center justify-center">
                        <Bluetooth size={13} />
                      </div>
                      <div>
                        <p className="font-semibold text-white text-xs">Pair Bluetooth</p>
                        <p className="text-[10px] text-teal-200">Wireless BLE thermal printer</p>
                      </div>
                    </div>
                    {printerType === 'Bluetooth' && isPrinterConnected && (
                      <span className="text-[9px] font-bold text-teal-300 bg-teal-950 px-1.5 py-0.5 rounded border border-teal-600/50">
                        ACTIVE
                      </span>
                    )}
                  </button>
                </div>

                {/* Fast Action Tools */}
                <div className="px-1.5 pt-1 border-t border-[#01353b] space-y-1">
                  <button
                    onClick={async () => {
                      setPrinterMenuOpen(false);
                      await printTestSlip();
                    }}
                    disabled={isPrinting}
                    className="w-full flex items-center gap-2.5 px-3 py-1.5 text-emerald-300 hover:bg-[#035661] rounded-lg transition-colors text-left cursor-pointer font-medium disabled:opacity-50"
                  >
                    <Zap size={13} />
                    <span>⚡ Send Test Print Receipt</span>
                  </button>

                  <button
                    onClick={() => {
                      setPrinterMenuOpen(false);
                      printWindow();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-1.5 text-teal-100 hover:bg-[#035661] rounded-lg transition-colors text-left cursor-pointer font-medium"
                  >
                    <Printer size={13} />
                    <span>Standard Browser Print</span>
                  </button>

                  <button
                    onClick={() => {
                      setPrinterMenuOpen(false);
                      setIsPrinterModalOpen(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-1.5 text-teal-100 hover:bg-[#035661] rounded-lg transition-colors text-left cursor-pointer font-medium"
                  >
                    <Sliders size={13} />
                    <span>Printer Center &amp; Settings</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <button className="hidden sm:flex items-center gap-1.5 bg-[#024f58] hover:bg-[#035b65] text-teal-100 text-xs px-2.5 py-1 rounded-lg border border-[#01464e] font-medium transition-colors cursor-pointer">
            <Eye size={14} className="text-teal-200" />
            <span>View as</span>
          </button>

          <button className="relative p-1.5 text-teal-100 hover:text-white rounded-lg hover:bg-[#024f58] transition-colors cursor-pointer">
            <Bell size={18} />
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-400"></span>
          </button>

          {/* User Store Pill Dropdown */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 bg-[#024f58] hover:bg-[#035b65] text-white px-2.5 py-1 rounded-lg border border-[#01464e] text-xs font-semibold cursor-pointer transition-colors"
            >
              <div className="w-5 h-5 rounded-full bg-white text-[#02626D] text-[10px] font-bold flex items-center justify-center uppercase shadow-2xs">
                {userDisplayName.charAt(0)}
              </div>
              <span className="truncate max-w-[120px]">{userDisplayName}</span>
              <ChevronDown size={12} className="text-teal-200" />
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-[#02444c] rounded-xl shadow-2xl border border-[#01353b] py-2 z-50 text-slate-100 text-xs animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-3 py-2 border-b border-[#01353b]">
                  <p className="font-bold text-white truncate">{userDisplayName}</p>
                  <p className="text-[11px] text-teal-200 truncate">{user?.email || 'admin@pattabiram.com'}</p>
                </div>
                <div className="p-1">
                  <Link
                    href="/settings"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-[#035661] rounded-lg transition-colors"
                  >
                    <Settings size={14} />
                    <span>Store Settings</span>
                  </Link>
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-rose-300 hover:bg-[#035661] rounded-lg transition-colors text-left cursor-pointer"
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

      {/* Global Thermal Printer Modal */}
      <ThermalPrinterModal
        isOpen={isPrinterModalOpen}
        onClose={() => setIsPrinterModalOpen(false)}
      />

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

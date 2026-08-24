'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef, useMemo } from 'react';
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
  Receipt,
  Printer,
  Usb,
  Bluetooth,
  Zap,
  PowerOff,
  Sliders,
  LayoutGrid,
  ChevronRight,
  Sparkles,
  WalletCards,
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
    isPrinting,
  } = usePrinter();

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [printerMenuOpen, setPrinterMenuOpen] = useState(false);
  const [isPrinterModalOpen, setIsPrinterModalOpen] = useState(false);
  const [isAppMenuOpen, setIsAppMenuOpen] = useState(false);
  const [appMenuSearch, setAppMenuSearch] = useState('');

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
    setIsAppMenuOpen(false);
  }, [pathname]);

  const userDisplayName = employeeProfile?.name || (user?.email ? user.email.split('@')[0] : 'Admin User');
  const userRole = employeeProfile?.isSuperAdmin ? 'SuperAdmin' : employeeProfile?.department || (user?.email ? 'SuperAdmin' : 'Staff');

  // Permission Check Helper
  const isNavAllowed = (href: string) => {
    if (!employeeProfile) return true;
    if (employeeProfile.isSuperAdmin) return true;

    // If employee is assigned a Manufacturing unit, always allow Mfg Portal & Manufacturing
    if (
      (href === '/manufacturing-portal' || href === '/manufacturing') &&
      employeeProfile.assignedMfgUnits &&
      employeeProfile.assignedMfgUnits.length > 0
    ) {
      return true;
    }
    // If employee is assigned a Packing unit, always allow Packing Portal & Packing
    if (
      (href === '/packing-portal' || href === '/packing') &&
      employeeProfile.assignedPckUnits &&
      employeeProfile.assignedPckUnits.length > 0
    ) {
      return true;
    }
    // Always allow Employee Portal for logged in employee
    if (href === '/employee-portal') {
      return true;
    }

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
      '/employees': 'employees',
      '/payroll': 'payroll',
      '/credit': 'credit',
      '/utilities': 'utilities',
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

  // Grouped Navigation for Desktop Sidebar
  const mainNavItems = [
    { label: 'Home', href: '/', icon: <Home size={17} /> },
    { label: 'Billing & POS', href: '/pos', icon: <Receipt size={17} /> },
    { label: 'Orders', href: '/orders', icon: <ShoppingBag size={17} /> },
    { label: 'Credit & Due', href: '/credit', icon: <WalletCards size={17} /> },
    { label: 'Walk-In Sales', href: '/walk-in-sales', icon: <Printer size={17} /> },
    { label: 'Products', href: '/items', icon: <Tag size={17} /> },
    { label: 'Stores', href: '/store', icon: <Store size={17} /> },
    { label: 'Inventory', href: '/inventory', icon: <Boxes size={17} /> },
    { label: 'Price List', href: '/price-list', icon: <ClipboardList size={17} /> },
  ].filter((item) => isNavAllowed(item.href));

  const managementNavItems = [
    { label: 'Manufacturing', href: '/manufacturing', icon: <Factory size={17} /> },
    { label: 'Packing Unit', href: '/packing', icon: <Package size={17} /> },
    { label: 'Utilities', href: '/utilities', icon: <Sliders size={17} /> },
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

  // Rich Card-Based App Menu Catalog
  const allCardApps = useMemo(() => [
    // 1. Sales & Retail
    {
      label: 'Billing & POS',
      description: 'Quick barcode cashier & thermal receipt checkout',
      href: '/pos',
      icon: <Receipt size={22} />,
      category: 'Sales & Billing',
      badgeColor: 'bg-amber-500/15 text-amber-600 border-amber-200',
      tag: 'Fast Checkout',
    },
    {
      label: 'Order Management',
      description: 'Custom box orders, advance payments & slot capacity',
      href: '/orders',
      icon: <ShoppingBag size={22} />,
      category: 'Sales & Billing',
      badgeColor: 'bg-[#02626D]/15 text-[#02626D] border-teal-200',
      tag: 'Core App',
    },
    {
      label: 'Walk-In Sales',
      description: 'Direct counter transactions & quick receipts',
      href: '/walk-in-sales',
      icon: <Printer size={22} />,
      category: 'Sales & Billing',
      badgeColor: 'bg-cyan-500/15 text-cyan-700 border-cyan-200',
    },
    {
      label: 'Wholesaler Orders',
      description: 'Bulk B2B customer distribution & delivery slips',
      href: '/wholesaler-orders',
      icon: <Users size={22} />,
      category: 'Sales & Billing',
      badgeColor: 'bg-blue-500/15 text-blue-600 border-blue-200',
    },
    {
      label: 'Credit & Due Orders',
      description: 'Track outstanding balances, partial payments & customer dues',
      href: '/credit',
      icon: <WalletCards size={22} />,
      category: 'Sales & Billing',
      badgeColor: 'bg-rose-500/15 text-rose-700 border-rose-200',
      tag: 'Balances',
    },

    // 2. Catalog & Stock
    {
      label: 'Products & Varieties',
      description: 'Item prices, slot weights & favourite sweets',
      href: '/items',
      icon: <Tag size={22} />,
      category: 'Catalog & Stock',
      badgeColor: 'bg-indigo-500/15 text-indigo-600 border-indigo-200',
      tag: 'Catalog',
    },
    {
      label: 'Price List',
      description: 'Dynamic wholesale & retail price master card',
      href: '/price-list',
      icon: <ClipboardList size={22} />,
      category: 'Catalog & Stock',
      badgeColor: 'bg-sky-500/15 text-sky-600 border-sky-200',
    },
    {
      label: 'Store Inventory',
      description: 'Branch store inventory & ready-to-sell batches',
      href: '/store',
      icon: <Store size={22} />,
      category: 'Catalog & Stock',
      badgeColor: 'bg-violet-500/15 text-violet-600 border-violet-200',
    },
    {
      label: 'Raw Materials & Packing',
      description: 'Ingredients, ghee, sugar & packaging stock',
      href: '/inventory',
      icon: <Boxes size={22} />,
      category: 'Catalog & Stock',
      badgeColor: 'bg-fuchsia-500/15 text-fuchsia-600 border-fuchsia-200',
    },

    // 3. Operations & Production
    {
      label: 'Manufacturing Portal',
      description: 'Chef kitchen batch queue & production recipes',
      href: '/manufacturing-portal',
      icon: <Factory size={22} />,
      category: 'Operations & Production',
      badgeColor: 'bg-emerald-500/15 text-emerald-700 border-emerald-200',
      tag: 'Kitchen',
    },
    {
      label: 'Packing Portal',
      description: 'Box packing weights, barcode stickers & QC verification',
      href: '/packing-portal',
      icon: <Package size={22} />,
      category: 'Operations & Production',
      badgeColor: 'bg-orange-500/15 text-orange-600 border-orange-200',
      tag: 'Packing',
    },
    {
      label: 'Production Planning',
      description: 'Daily slot batching, allocations & work orders',
      href: '/manufacturing',
      icon: <Factory size={22} />,
      category: 'Operations & Production',
      badgeColor: 'bg-teal-500/15 text-teal-700 border-teal-200',
    },
    {
      label: 'Packing Management',
      description: 'Dispatch schedule & box customisation queue',
      href: '/packing',
      icon: <Package size={22} />,
      category: 'Operations & Production',
      badgeColor: 'bg-amber-500/15 text-amber-700 border-amber-200',
    },

    // 4. Staff & Ledger
    {
      label: 'Employee Portal',
      description: 'Self service tasks, shift schedule & attendance clock',
      href: '/employee-portal',
      icon: <UserCheck size={22} />,
      category: 'Staff & People',
      badgeColor: 'bg-green-500/15 text-green-700 border-green-200',
      tag: 'Staff',
    },
    {
      label: 'Staff Directory',
      description: 'Staff roles, biometric PIN & access permissions',
      href: '/employees',
      icon: <Users size={22} />,
      category: 'Staff & People',
      badgeColor: 'bg-rose-500/15 text-rose-600 border-rose-200',
    },
    {
      label: 'Payroll & Salaries',
      description: 'Monthly wages, advance khata, deductions & slips',
      href: '/payroll',
      icon: <CreditCard size={22} />,
      category: 'Staff & People',
      badgeColor: 'bg-pink-500/15 text-pink-600 border-pink-200',
    },
    {
      label: 'Customer Directory',
      description: 'Customer profiles, order history & store ledger',
      href: '/customers',
      icon: <UserCheck size={22} />,
      category: 'Staff & People',
      badgeColor: 'bg-purple-500/15 text-purple-600 border-purple-200',
    },
    {
      label: 'Wholesaler Directory',
      description: 'B2B client ledgers, credit terms & tax details',
      href: '/wholesalers',
      icon: <Users size={22} />,
      category: 'Staff & People',
      badgeColor: 'bg-blue-500/15 text-blue-600 border-blue-200',
    },

    // 5. System Tools
    {
      label: 'Utilities & Diagnostics',
      description: 'Database maintenance, batch sync & automated tools',
      href: '/utilities',
      icon: <Sliders size={22} />,
      category: 'System & Tools',
      badgeColor: 'bg-slate-500/15 text-slate-700 border-slate-200',
    },
    {
      label: 'System Support',
      description: 'Helpdesk guidelines, audit logs & remote assistance',
      href: '/support',
      icon: <Headphones size={22} />,
      category: 'System & Tools',
      badgeColor: 'bg-slate-500/15 text-slate-700 border-slate-200',
    },
    {
      label: 'Store Settings',
      description: 'Store timings, delivery slots & brand configurations',
      href: '/settings',
      icon: <Settings size={22} />,
      category: 'System & Tools',
      badgeColor: 'bg-slate-500/15 text-slate-700 border-slate-200',
    },
  ].filter((item) => isNavAllowed(item.href)), [employeeProfile]);

  const filteredCardApps = useMemo(() => {
    if (!appMenuSearch.trim()) return allCardApps;
    const q = appMenuSearch.toLowerCase();
    return allCardApps.filter(
      (app) =>
        app.label.toLowerCase().includes(q) ||
        app.description.toLowerCase().includes(q) ||
        app.category.toLowerCase().includes(q)
    );
  }, [allCardApps, appMenuSearch]);

  // Group filtered apps by category
  const categorizedApps = useMemo(() => {
    const groups: { [key: string]: typeof allCardApps } = {};
    filteredCardApps.forEach((app) => {
      if (!groups[app.category]) groups[app.category] = [];
      groups[app.category].push(app);
    });
    return groups;
  }, [filteredCardApps]);

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

  // Determine dynamic portal tab destination for bottom bar
  const portalTabHref = useMemo(() => {
    if (isNavAllowed('/manufacturing-portal')) return '/manufacturing-portal';
    if (isNavAllowed('/packing-portal')) return '/packing-portal';
    if (isNavAllowed('/employee-portal')) return '/employee-portal';
    return '/manufacturing';
  }, [employeeProfile]);

  return (
    <>
      {/* ── TOP HEADER BAR (App-Like Top Navigation Bar) ──────────────────────── */}
      <header className="fixed top-0 left-0 right-0 h-14 bg-[#02626D] text-white z-50 flex items-center justify-between px-3 sm:px-4 border-b border-[#014d56] shadow-sm">
        {/* Left: App Launcher Trigger + Logo + Badge */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsAppMenuOpen(true)}
            className="text-teal-100 hover:text-white p-1.5 rounded-xl hover:bg-[#024f58] transition-colors cursor-pointer flex items-center gap-1.5 bg-[#014d56]/60 border border-[#024047]"
            title="Open App Launcher"
            aria-label="Open App Launcher"
          >
            <LayoutGrid size={18} />
            <span className="hidden sm:inline-block text-xs font-semibold pr-1">Apps</span>
          </button>

          <Link href="/" className="flex items-center gap-2">
            <div className="relative w-7 h-7 rounded-lg overflow-hidden bg-white shadow-2xs border border-teal-200/30 flex-shrink-0">
              <Image src="/app-icon.png" alt="Pattabiram Sweets" fill className="object-contain p-0.5" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-white font-extrabold text-sm tracking-tight">Pattabiram</span>
              <span className="text-[10px] text-teal-100 font-medium bg-[#024f58] px-2 py-0.5 rounded-full hidden sm:inline-block border border-[#01464e]">
                Spring &apos;26
              </span>
            </div>
          </Link>
        </div>

        {/* Center: Search Bar with Shortcut Badge (Desktop) */}
        <div className="flex-1 max-w-md mx-4 hidden md:flex items-center">
          <div className="relative w-full flex items-center">
            <Search size={14} className="absolute left-3 text-teal-200" />
            <input
              type="text"
              placeholder="Search products, orders, customers..."
              onClick={() => setIsAppMenuOpen(true)}
              readOnly
              className="w-full bg-[#024f58] hover:bg-[#035b65] focus:bg-[#035b65] text-white placeholder-teal-200/80 text-xs rounded-lg pl-9 pr-16 py-1.5 border border-[#01464e] focus:outline-none transition-all cursor-pointer"
            />
            <div className="absolute right-2 flex items-center gap-1 pointer-events-none">
              <kbd className="bg-[#014047] text-[10px] text-teal-100 font-semibold px-1.5 py-0.5 rounded border border-[#01353b]">
                MENU
              </kbd>
            </div>
          </div>
        </div>

        {/* Right: Actions (Thermal Printer, Notifications, User Pill) */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Thermal Printer Header Connector Dropdown */}
          <div className="relative" ref={printerMenuRef}>
            <button
              onClick={() => setPrinterMenuOpen(!printerMenuOpen)}
              className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${
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
                </>
              ) : (
                <>
                  <Printer size={14} className="text-teal-200" />
                  <span className="hidden md:inline-block text-[11px] text-teal-100">Printer</span>
                </>
              )}
              <ChevronDown size={11} className="text-teal-200" />
            </button>

            {/* Quick Thermal Printer Dropdown */}
            {printerMenuOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-[#02444c] rounded-xl shadow-2xl border border-[#01353b] py-2 z-50 text-slate-100 text-xs animate-in fade-in slide-in-from-top-2 duration-150">
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
                </div>
              </div>
            )}
          </div>

          {/* User Store Pill Dropdown */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-1.5 bg-[#024f58] hover:bg-[#035b65] text-white px-2 py-1 rounded-lg border border-[#01464e] text-xs font-semibold cursor-pointer transition-colors"
            >
              <div className="w-5 h-5 rounded-full bg-white text-[#02626D] text-[10px] font-bold flex items-center justify-center uppercase shadow-2xs">
                {userDisplayName.charAt(0)}
              </div>
              <span className="truncate max-w-[80px] sm:max-w-[120px]">{userDisplayName}</span>
              <ChevronDown size={12} className="text-teal-200" />
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-[#02444c] rounded-xl shadow-2xl border border-[#01353b] py-2 z-50 text-slate-100 text-xs animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-3 py-2 border-b border-[#01353b]">
                  <p className="font-bold text-white truncate">{userDisplayName}</p>
                  <p className="text-[10px] text-teal-200 font-mono mt-0.5">{userRole}</p>
                  <p className="text-[11px] text-teal-200/80 truncate mt-0.5">{user?.email || 'pattabiramsweets.com'}</p>
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
          {mainNavItems.length > 0 && (
            <div className="space-y-0.5">{mainNavItems.map(renderNavLink)}</div>
          )}

          {managementNavItems.length > 0 && (
            <div>
              <p className="px-3 mb-1 text-[11px] font-bold text-[#6d6d6d] uppercase tracking-wider">
                Management
              </p>
              <div className="space-y-0.5">{managementNavItems.map(renderNavLink)}</div>
            </div>
          )}

          {portalNavItems.length > 0 && (
            <div>
              <p className="px-3 mb-1 text-[11px] font-bold text-[#6d6d6d] uppercase tracking-wider">
                Portals &amp; Services
              </p>
              <div className="space-y-0.5">{portalNavItems.map(renderNavLink)}</div>
            </div>
          )}
        </div>

        <div className="mt-auto pt-4 border-t border-[#dcdcdc] space-y-0.5">
          {renderNavLink({ label: 'Settings', href: '/settings', icon: <Settings size={17} /> })}
        </div>
      </aside>

      {/* ── MOBILE & TABLET APP-NATIVE BOTTOM NAVIGATION BAR (lg:hidden) ──────── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-slate-200/90 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] px-2 py-1 flex items-center justify-around select-none">
        {/* 1. Home */}
        <Link
          href="/"
          className={`flex-1 py-1.5 px-1 flex flex-col items-center justify-center gap-0.5 transition-all rounded-xl cursor-pointer ${
            pathname === '/' ? 'text-[#02626D] font-bold' : 'text-slate-500 hover:text-slate-800 font-medium'
          }`}
        >
          <div className={`p-1 rounded-xl transition-all ${pathname === '/' ? 'bg-[#02626D]/10' : ''}`}>
            <Home size={20} className={pathname === '/' ? 'text-[#02626D]' : 'text-slate-500'} />
          </div>
          <span className="text-[10px] tracking-tight">Home</span>
        </Link>

        {/* 2. Orders */}
        <Link
          href="/orders"
          className={`flex-1 py-1.5 px-1 flex flex-col items-center justify-center gap-0.5 transition-all rounded-xl cursor-pointer ${
            pathname === '/orders' ? 'text-[#02626D] font-bold' : 'text-slate-500 hover:text-slate-800 font-medium'
          }`}
        >
          <div className={`p-1 rounded-xl transition-all ${pathname === '/orders' ? 'bg-[#02626D]/10' : ''}`}>
            <ShoppingBag size={20} className={pathname === '/orders' ? 'text-[#02626D]' : 'text-slate-500'} />
          </div>
          <span className="text-[10px] tracking-tight">Orders</span>
        </Link>

        {/* 3. POS Billing (Elevated Primary Center Button) */}
        <Link
          href="/pos"
          className="flex-1 py-1 px-1 flex flex-col items-center justify-center gap-0.5 group cursor-pointer -mt-3"
        >
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-md transition-all group-active:scale-95 ${
              pathname === '/pos'
                ? 'bg-[#02626D] text-white ring-4 ring-[#02626D]/20 shadow-[#02626D]/30'
                : 'bg-[#02626D] hover:bg-[#014d56] text-white'
            }`}
          >
            <Receipt size={22} />
          </div>
          <span className={`text-[10px] font-bold tracking-tight ${pathname === '/pos' ? 'text-[#02626D]' : 'text-slate-700'}`}>
            POS Billing
          </span>
        </Link>

        {/* 4. Production / Portals */}
        <Link
          href={portalTabHref}
          className={`flex-1 py-1.5 px-1 flex flex-col items-center justify-center gap-0.5 transition-all rounded-xl cursor-pointer ${
            pathname.includes('portal') || pathname.includes('manufacturing') || pathname.includes('packing')
              ? 'text-[#02626D] font-bold'
              : 'text-slate-500 hover:text-slate-800 font-medium'
          }`}
        >
          <div
            className={`p-1 rounded-xl transition-all ${
              pathname.includes('portal') || pathname.includes('manufacturing') || pathname.includes('packing')
                ? 'bg-[#02626D]/10'
                : ''
            }`}
          >
            <Factory
              size={20}
              className={
                pathname.includes('portal') || pathname.includes('manufacturing') || pathname.includes('packing')
                  ? 'text-[#02626D]'
                  : 'text-slate-500'
              }
            />
          </div>
          <span className="text-[10px] tracking-tight">Portal</span>
        </Link>

        {/* 5. Card Menu Launcher */}
        <button
          type="button"
          onClick={() => setIsAppMenuOpen(true)}
          className={`flex-1 py-1.5 px-1 flex flex-col items-center justify-center gap-0.5 transition-all rounded-xl cursor-pointer ${
            isAppMenuOpen ? 'text-[#02626D] font-bold' : 'text-slate-500 hover:text-slate-800 font-medium'
          }`}
        >
          <div className={`p-1 rounded-xl transition-all ${isAppMenuOpen ? 'bg-[#02626D]/10' : ''}`}>
            <LayoutGrid size={20} className={isAppMenuOpen ? 'text-[#02626D]' : 'text-slate-500'} />
          </div>
          <span className="text-[10px] tracking-tight">Menu</span>
        </button>
      </nav>

      {/* ── CARD-BASED APP LAUNCHER MODAL / BOTTOM SHEET (App Kind of Feel) ───── */}
      {isAppMenuOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
            onClick={() => setIsAppMenuOpen(false)}
          />

          {/* Card-Based App Launcher Modal Dialog */}
          <div className="relative w-full max-w-3xl bg-[#f6f6f7] rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200/90 z-10 max-h-[88vh] sm:max-h-[85vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-6 duration-200">
            {/* Sheet Top Handle (Mobile) */}
            <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mt-2.5 sm:hidden" />

            {/* Launcher Header */}
            <div className="p-4 sm:p-5 bg-white border-b border-slate-200 space-y-3 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#02626D] text-white flex items-center justify-center shadow-2xs">
                    <LayoutGrid size={18} />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                      <span>App Launcher</span>
                      <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-[#02626D] border border-teal-200">
                        {allCardApps.length} Apps
                      </span>
                    </h2>
                    <p className="text-xs text-slate-500">Fast card-based access to all Pattabiram modules</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsAppMenuOpen(false)}
                  className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                  title="Close launcher"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Instant App Filter / Search Bar */}
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  autoFocus
                  value={appMenuSearch}
                  onChange={(e) => setAppMenuSearch(e.target.value)}
                  placeholder="Search app or module name (e.g. POS, Orders, Kitchen, Packing, Staff)..."
                  className="w-full pl-9 pr-8 h-9 bg-[#f7f7f8] focus:bg-white border border-slate-300 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#02626D] transition-all"
                />
                {appMenuSearch && (
                  <button
                    type="button"
                    onClick={() => setAppMenuSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* Launcher Cards Body (Scrollable Grid) */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 no-scrollbar">
              {Object.keys(categorizedApps).length === 0 ? (
                <div className="py-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200 p-6">
                  <Search size={32} className="mx-auto text-slate-300 mb-2" />
                  <p className="font-bold text-sm text-slate-700">No matching apps found</p>
                  <p className="text-xs text-slate-400 mt-1">Try a different search keyword</p>
                </div>
              ) : (
                Object.entries(categorizedApps).map(([category, items]) => (
                  <div key={category} className="space-y-2.5">
                    {/* Category Title */}
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                        {category}
                      </span>
                      <span className="h-px flex-1 bg-slate-200" />
                    </div>

                    {/* Cards Grid (1 col on small phones, 2 cols on tablets/desktop) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {items.map((app) => {
                        const isActive = pathname === app.href;
                        return (
                          <Link
                            key={app.href}
                            href={app.href}
                            onClick={() => setIsAppMenuOpen(false)}
                            className={`group relative p-3 rounded-2xl border transition-all duration-150 flex items-start gap-3 select-none ${
                              isActive
                                ? 'bg-[#02626D]/5 border-[#02626D] shadow-xs ring-2 ring-[#02626D]/15'
                                : 'bg-white hover:bg-slate-50/80 border-slate-200/90 hover:border-slate-300 hover:shadow-md'
                            }`}
                          >
                            {/* App Icon Tile */}
                            <div
                              className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 border shadow-2xs group-hover:scale-105 transition-transform ${app.badgeColor}`}
                            >
                              {app.icon}
                            </div>

                            {/* Info */}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-1">
                                <h3
                                  className={`text-xs sm:text-[13px] font-bold leading-tight truncate ${
                                    isActive ? 'text-[#02626D]' : 'text-slate-900 group-hover:text-[#02626D]'
                                  }`}
                                >
                                  {app.label}
                                </h3>
                                {app.tag && (
                                  <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200/80 flex-shrink-0">
                                    {app.tag}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 leading-snug">
                                {app.description}
                              </p>
                            </div>

                            {/* Arrow Indicator */}
                            <div className="self-center flex-shrink-0 text-slate-300 group-hover:text-[#02626D] group-hover:translate-x-0.5 transition-all">
                              <ChevronRight size={16} />
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Quick Action Footer in Card Launcher */}
            <div className="p-3 sm:p-4 bg-white border-t border-slate-200 flex items-center justify-between gap-2 flex-shrink-0 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-teal-50 border border-teal-200/80 text-[#02626D] font-bold text-xs flex items-center justify-center">
                  {userDisplayName.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 truncate text-xs">{userDisplayName}</p>
                  <p className="text-[10px] text-slate-400">{userRole}</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <Link
                  href="/settings"
                  onClick={() => setIsAppMenuOpen(false)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold flex items-center gap-1 transition-colors"
                >
                  <Settings size={13} />
                  <span>Settings</span>
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setIsAppMenuOpen(false);
                    logout();
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <LogOut size={13} />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

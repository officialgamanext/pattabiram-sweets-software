'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRef, useState, useEffect } from 'react';
import Image from 'next/image';
import {
  Menu,
  LayoutGrid,
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
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
} from 'lucide-react';

const navItems = [
  { label: 'Dashboard', href: '/', icon: <Home size={20} /> },
  { label: 'Orders', href: '/orders', icon: <ShoppingBag size={20} /> },
  { label: 'Store', href: '/store', icon: <Store size={20} /> },
  { label: 'Manufacturing Unit', href: '/manufacturing', icon: <Factory size={20} /> },
  { label: 'Packing Unit', href: '/packing', icon: <Package size={20} /> },
  { label: "Wholesaler's", href: '/wholesalers', icon: <Users size={20} /> },
  { label: 'Price List', href: '/price-list', icon: <ClipboardList size={20} /> },
  { label: 'Items', href: '/items', icon: <Tag size={20} /> },
  { label: 'Inventory', href: '/inventory', icon: <Boxes size={20} /> },
  { label: 'Employees', href: '/employees', icon: <UserCheck size={20} /> },
  { label: 'Payroll', href: '/payroll', icon: <CreditCard size={20} /> },
  { label: 'Settings', href: '/settings', icon: <Settings size={20} /> },
  { label: 'Support', href: '/support', icon: <Headphones size={20} /> },
];

export default function Header() {
  const pathname = usePathname();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 5);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 5);
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    el?.addEventListener('scroll', checkScroll);
    window.addEventListener('resize', checkScroll);
    return () => {
      el?.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, []);

  const scroll = (dir: 'left' | 'right') => {
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -260 : 260, behavior: 'smooth' });
  };

  return (
    <div className="bg-white border-b border-slate-200">
      {/* ── Top Bar ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 sm:px-6 h-16 border-b border-slate-100">
        {/* Left: Hamburger + Logo */}
        <div className="flex items-center gap-3 sm:gap-4">
          <button className="text-slate-500 hover:text-slate-800 transition-colors p-1 cursor-pointer">
            <Menu size={20} />
          </button>

          <Link href="/" className="flex items-center">
            <Image
              src="/logo.png"
              alt="ManageX"
              width={140}
              height={40}
              className="h-9 w-auto object-contain"
              priority
            />
          </Link>
        </div>

        {/* Right: Notifications + Profile */}
        <div className="flex items-center gap-3 sm:gap-5">
          <button className="relative p-2 rounded-full text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer">
            <Bell size={20} />
            <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white">
              5
            </span>
          </button>

          <div className="flex items-center gap-2 sm:gap-3 cursor-pointer group">
            <div className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-full overflow-hidden border border-slate-200 shadow-xs">
              <Image
                src="/images/user_avatar.png"
                alt="Arun Kumar"
                width={36}
                height={36}
                className="object-cover w-full h-full"
              />
            </div>
            <div className="hidden sm:block leading-tight">
              <p className="text-xs sm:text-sm font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors">Arun Kumar</p>
              <p className="text-[10px] sm:text-xs text-slate-400">Admin</p>
            </div>
            <ChevronDown size={14} className="text-slate-400 group-hover:text-slate-600 transition-colors" />
          </div>
        </div>
      </div>

      {/* ── Secondary Nav Tabs Bar ───────────────────────────────── */}
      <div className="flex items-center justify-between px-2 sm:px-4 h-16 sm:h-[68px] bg-white">
        {/* Left Arrow Button */}
        <button
          onClick={() => scroll('left')}
          disabled={!canScrollLeft}
          className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all flex-shrink-0 mr-1 sm:mr-2 ${canScrollLeft
              ? 'border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer shadow-xs'
              : 'border-slate-100 text-slate-300 bg-slate-50/50 cursor-not-allowed opacity-40'
            }`}
        >
          <ChevronLeft size={16} />
        </button>

        {/* Center Evenly Spaced Nav Tabs */}
        <div
          ref={scrollRef}
          className="flex-1 flex items-center justify-between gap-1 sm:gap-3 overflow-x-auto no-scrollbar py-1 scroll-smooth"
        >
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center min-w-[76px] sm:min-w-[84px] px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl transition-all duration-150 flex-shrink-0 relative group ${isActive
                    ? 'bg-indigo-50 text-indigo-600 font-semibold shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                  }`}
              >
                <div className={`mb-1 transition-colors ${isActive ? 'text-indigo-600' : 'text-slate-500 group-hover:text-slate-700'}`}>
                  {item.icon}
                </div>
                <span className="text-[10px] sm:text-[11px] whitespace-nowrap leading-none tracking-tight">
                  {item.label}
                </span>
                {isActive && (
                  <span className="absolute bottom-1 w-4 h-[2px] rounded-full bg-indigo-600" />
                )}
              </Link>
            );
          })}
        </div>

        {/* Right Arrow Button */}
        <button
          onClick={() => scroll('right')}
          disabled={!canScrollRight}
          className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all flex-shrink-0 ml-1 sm:ml-2 ${canScrollRight
              ? 'border-indigo-100 bg-indigo-50/50 text-indigo-600 hover:bg-indigo-100 cursor-pointer shadow-xs'
              : 'border-slate-100 text-slate-300 bg-slate-50/50 cursor-not-allowed opacity-40'
            }`}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

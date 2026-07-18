'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface CustomSelectOption {
  value: string;
  label: string;
  badge?: string;
}

interface CustomSelectProps {
  options: CustomSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
  icon?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export default function CustomSelect({
  options,
  value,
  onChange,
  placeholder = 'Select option',
  className = '',
  buttonClassName = '',
  icon,
  size = 'md',
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const sizeClasses = {
    sm: 'px-2.5 py-1 text-xs rounded-lg',
    md: 'px-3.5 py-2 text-xs sm:text-sm rounded-xl',
    lg: 'px-4 py-2.5 text-sm rounded-xl',
  };

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between gap-2.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 font-medium transition-all shadow-2xs cursor-pointer ${
          sizeClasses[size]
        } ${isOpen ? 'border-indigo-500 ring-2 ring-indigo-500/10' : ''} ${buttonClassName}`}
      >
        <div className="flex items-center gap-2 min-w-0 truncate">
          {icon && <span className="text-slate-400 flex-shrink-0">{icon}</span>}
          <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        </div>
        <ChevronDown
          size={size === 'sm' ? 12 : 14}
          className={`text-slate-400 flex-shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-indigo-600' : ''
          }`}
        />
      </button>

      {/* Floating Options Panel */}
      {isOpen && (
        <div className="absolute right-0 sm:left-0 top-full mt-1.5 min-w-full w-max max-h-60 overflow-y-auto bg-white border border-slate-200/90 rounded-xl shadow-xl z-50 py-1.5 no-scrollbar animate-in fade-in zoom-in-95 duration-100">
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3.5 py-2 text-xs sm:text-sm font-medium flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors ${
                  isSelected ? 'bg-indigo-50/70 text-indigo-600 font-semibold' : 'text-slate-700'
                }`}
              >
                <span className="truncate">{option.label}</span>
                {isSelected ? (
                  <Check size={14} className="text-indigo-600 flex-shrink-0" />
                ) : (
                  option.badge && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                      {option.badge}
                    </span>
                  )
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

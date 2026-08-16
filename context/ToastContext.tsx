'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
}

interface ToastContextType {
  toasts: ToastItem[];
  addToast: (toast: Omit<ToastItem, 'id'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// Event emitter helper so `toast.success(...)` can be called from anywhere (even outside React components)
type ToastListener = (toast: Omit<ToastItem, 'id'>) => void;
let globalToastListener: ToastListener | null = null;

export const toast = {
  success: (title: string, description?: string, duration = 3500) => {
    if (globalToastListener) {
      globalToastListener({ type: 'success', title, description, duration });
    } else {
      console.log(`[Toast Success]: ${title}`);
    }
  },
  error: (title: string, description?: string, duration = 4000) => {
    if (globalToastListener) {
      globalToastListener({ type: 'error', title, description, duration });
    } else {
      console.error(`[Toast Error]: ${title}`);
    }
  },
  warning: (title: string, description?: string, duration = 3500) => {
    if (globalToastListener) {
      globalToastListener({ type: 'warning', title, description, duration });
    } else {
      console.warn(`[Toast Warning]: ${title}`);
    }
  },
  info: (title: string, description?: string, duration = 3000) => {
    if (globalToastListener) {
      globalToastListener({ type: 'info', title, description, duration });
    } else {
      console.info(`[Toast Info]: ${title}`);
    }
  },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((toastData: Omit<ToastItem, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newToast: ToastItem = { ...toastData, id };

    setToasts((prev) => [newToast, ...prev.slice(0, 4)]); // max 5 toasts

    const duration = toastData.duration || 3500;
    setTimeout(() => {
      removeToast(id);
    }, duration);
  }, [removeToast]);

  useEffect(() => {
    globalToastListener = addToast;
    return () => {
      globalToastListener = null;
    };
  }, [addToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}

      {/* Floating Toasts Container */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-3 sm:px-0">
        {toasts.map((item) => {
          let bgStyle = 'bg-white border-slate-200 text-slate-900 shadow-xl';
          let icon = <Info className="text-sky-600 flex-shrink-0" size={19} />;

          if (item.type === 'success') {
            bgStyle = 'bg-emerald-950/95 text-white border-emerald-800/80 shadow-2xl shadow-emerald-950/30';
            icon = <CheckCircle2 className="text-emerald-400 flex-shrink-0" size={19} />;
          } else if (item.type === 'error') {
            bgStyle = 'bg-rose-950/95 text-white border-rose-800/80 shadow-2xl shadow-rose-950/30';
            icon = <AlertCircle className="text-rose-400 flex-shrink-0" size={19} />;
          } else if (item.type === 'warning') {
            bgStyle = 'bg-amber-950/95 text-white border-amber-800/80 shadow-2xl shadow-amber-950/30';
            icon = <AlertTriangle className="text-amber-400 flex-shrink-0" size={19} />;
          } else if (item.type === 'info') {
            bgStyle = 'bg-slate-900/95 text-white border-slate-700 shadow-2xl';
            icon = <Info className="text-sky-400 flex-shrink-0" size={19} />;
          }

          return (
            <div
              key={item.id}
              className={`pointer-events-auto rounded-2xl p-3.5 border backdrop-blur-md flex items-start gap-3 transition-all duration-200 animate-in slide-in-from-top-3 fade-in ${bgStyle}`}
              role="alert"
            >
              <div className="mt-0.5">{icon}</div>

              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-bold leading-tight">{item.title}</p>
                {item.description && (
                  <p className="text-[11px] opacity-80 mt-1 leading-snug break-words font-medium">
                    {item.description}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => removeToast(item.id)}
                className="opacity-70 hover:opacity-100 p-1 rounded-lg transition-opacity cursor-pointer flex-shrink-0 -mr-1 -mt-1"
                aria-label="Close"
              >
                <X size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    return {
      toast,
      toasts: [],
      addToast: toast.info,
      removeToast: () => {},
    };
  }
  return { ...context, toast };
}

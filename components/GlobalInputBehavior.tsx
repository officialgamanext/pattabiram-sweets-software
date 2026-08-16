'use client';

import { useEffect } from 'react';

/**
 * GlobalInputBehavior
 * 1. Disables mouse-wheel scrolling from changing number input values across the entire application.
 * 2. Auto-selects number input content when focused if it contains '0' so users don't have to backspace before typing.
 */
export default function GlobalInputBehavior() {
  useEffect(() => {
    // 1. Prevent mouse wheel / trackpad scroll on number inputs
    const handleWheel = () => {
      const activeEl = document.activeElement as HTMLInputElement | null;
      if (activeEl && activeEl.tagName === 'INPUT' && activeEl.type === 'number') {
        activeEl.blur();
      }
    };

    // 2. Select-all on focus if initial value is "0"
    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLInputElement | null;
      if (target && target.tagName === 'INPUT' && target.type === 'number') {
        if (target.value === '0' || target.value === '0.00' || target.value === '0.0') {
          setTimeout(() => {
            target.select();
          }, 10);
        }
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: true });
    document.addEventListener('focusin', handleFocus);

    return () => {
      window.removeEventListener('wheel', handleWheel);
      document.removeEventListener('focusin', handleFocus);
    };
  }, []);

  return null;
}

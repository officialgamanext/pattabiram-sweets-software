'use client';

import React, { useEffect } from 'react';

export default function PWAProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    // In development mode, unregister any active service worker to prevent 404 chunk mismatch errors
    if (process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.unregister().catch(() => {});
        }
      });
      return;
    }

    let refreshing = false;

    // Reload page automatically when the new service worker takes control (after deploy)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });

    // Register Service Worker in production
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        // Check for updates on register
        registration.update().catch(() => {});

        // Check for updates periodically (every 5 minutes)
        const intervalId = setInterval(() => {
          registration.update().catch(() => {});
        }, 5 * 60 * 1000);

        // Check for updates on tab focus & online
        const handleFocus = () => {
          registration.update().catch(() => {});
        };
        window.addEventListener('focus', handleFocus);
        window.addEventListener('online', handleFocus);

        // Handle update found
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New update available, notify worker to activate immediately
                newWorker.postMessage({ type: 'SKIP_WAITING' });
              }
            });
          }
        });

        return () => {
          clearInterval(intervalId);
          window.removeEventListener('focus', handleFocus);
          window.removeEventListener('online', handleFocus);
        };
      })
      .catch((err) => {
        console.error('ServiceWorker registration failed:', err);
      });
  }, []);

  return <>{children}</>;
}

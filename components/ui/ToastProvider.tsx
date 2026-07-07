'use client';

import { createContext, useCallback, useContext, useState } from 'react';

type ToastType = 'success' | 'error';

type Toast = {
  id: number;
  message: string;
  type: ToastType;
};

type ToastContextValue = {
  showToast: (message: string, type?: ToastType) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_DURATION_MS = 3000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback(
    (message: string, type: ToastType = 'success') => {
      const id = Date.now() + Math.random();

      setToasts((prev) => [...prev, { id, message, type }]);

      setTimeout(() => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
      }, TOAST_DURATION_MS);
    },
    [],
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      <div className="safe-bottom fixed inset-x-3 bottom-3 z-[100] grid justify-items-stretch gap-2 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:justify-items-end">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            style={{ animation: 'toast-in 200ms cubic-bezier(0.16, 1, 0.3, 1)' }}
            className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium text-white shadow-xl backdrop-blur-sm sm:max-w-sm ${
              toast.type === 'error'
                ? 'border-red-400/20 bg-red-600/95 shadow-red-950/40'
                : 'border-green-400/20 bg-green-600/95 shadow-green-950/40'
            }`}
          >
            <span className="text-base leading-none">
              {toast.type === 'error' ? '⚠️' : '✓'}
            </span>
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);

  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }

  return ctx;
}

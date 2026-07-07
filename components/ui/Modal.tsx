'use client';

import { useEffect } from 'react';

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
};

export default function Modal({ open, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
      style={{ animation: 'fade-in 150ms ease-out' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="safe-bottom flex max-h-[88dvh] w-full flex-col rounded-t-2xl border border-white/10 bg-zinc-900 p-5 shadow-2xl shadow-black/50 sm:max-h-[85vh] sm:max-w-lg sm:rounded-2xl sm:p-6"
        style={{ animation: 'sheet-up 220ms cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        <div className="mb-1 flex shrink-0 items-center justify-center sm:hidden">
          <span className="h-1.5 w-10 rounded-full bg-zinc-700" />
        </div>

        <div className="mb-4 flex shrink-0 items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-white">{title}</h2>

          <button
            onClick={onClose}
            aria-label="Fechar"
            className="btn-icon h-9 w-9 bg-zinc-800"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

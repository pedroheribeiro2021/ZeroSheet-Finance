'use client';

export default function Modal({ open, onClose, title, children }: any) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-zinc-900 p-6 rounded w-full max-w-2xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-white font-bold text-lg">{title}</h2>

          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="max-h-[400px] overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
'use client';

import { Menu } from 'lucide-react';

type TopbarProps = {
  pageTitle: string;
  userEmail: string;
  userName?: string;
  onMenuClick: () => void;
};

export default function Topbar({
  pageTitle,
  userEmail,
  userName,
  onMenuClick,
}: TopbarProps) {
  const displayLabel = userName || userEmail;
  const initial = displayLabel ? displayLabel.charAt(0).toUpperCase() : '?';

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-white/[0.06] bg-black/80 px-4 py-3.5 backdrop-blur-md sm:px-6 sm:py-4">
      <div className="flex min-w-0 items-center gap-3">
        <button
          onClick={onMenuClick}
          className="btn-icon h-10 w-10 shrink-0 md:hidden"
          aria-label="Abrir menu"
        >
          <Menu size={19} />
        </button>

        <div className="min-w-0">
          <p className="hidden text-xs font-medium text-zinc-500 sm:block">
            ZeroSheet Finance
          </p>
          <h1 className="truncate text-lg font-bold text-white sm:text-xl">
            {pageTitle}
          </h1>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2.5">
        <div className="hidden text-right sm:block">
          <p className="text-[11px] text-zinc-500">Logado como</p>
          <p className="max-w-[200px] truncate text-sm font-medium text-white">
            {displayLabel || 'Carregando...'}
          </p>
        </div>

        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-zinc-700 to-zinc-800 text-sm font-bold text-white ring-1 ring-white/10"
          title={userEmail}
        >
          {initial}
        </div>
      </div>
    </header>
  );
}

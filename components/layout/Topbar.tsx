'use client';

type TopbarProps = {
  pageTitle: string;
  userEmail: string;
  onMenuClick: () => void;
};

export default function Topbar({
  pageTitle,
  userEmail,
  onMenuClick,
}: TopbarProps) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-zinc-800 bg-black/90 px-4 py-4 backdrop-blur md:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded bg-zinc-900 px-3 py-2 text-white transition hover:bg-zinc-800 md:hidden"
          aria-label="Abrir menu"
        >
          Menu
        </button>

        <div>
          <p className="text-sm text-zinc-400">ZeroSheet Finance</p>
          <h1 className="text-xl font-bold text-white">{pageTitle}</h1>
        </div>
      </div>

      <div className="text-right">
        <p className="text-xs text-zinc-500">Usuario logado</p>
        <p className="max-w-[180px] truncate text-sm text-white md:max-w-xs">
          {userEmail || 'Carregando...'}
        </p>
      </div>
    </header>
  );
}

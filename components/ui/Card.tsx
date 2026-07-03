'use client';

export default function Card({ title, value, subtitle, onClick, className }: any) {
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      className={`bg-zinc-900 p-4 rounded transition ${
        onClick ? 'cursor-pointer hover:bg-zinc-800' : ''
      } ${className ?? ''}`}
    >
      <p className="text-zinc-400">{title}</p>
      <p className="text-white text-xl font-bold">{value}</p>
      {subtitle && <p className="text-zinc-500 text-xs mt-1">{subtitle}</p>}
    </div>
  );
}

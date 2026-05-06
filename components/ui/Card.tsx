'use client';

export default function Card({ title, value, onClick, className }: any) {
  return (
    <div
      onClick={onClick}
      className={`bg-zinc-900 p-4 rounded cursor-pointer hover:bg-zinc-800 transition ${className}`}
    >
      <p className="text-zinc-400">{title}</p>
      <p className="text-white text-xl font-bold">{value}</p>
    </div>
  );
}
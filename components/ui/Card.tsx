'use client';

type CardProps = {
  title: string;
  value: string;
  subtitle?: string;
  onClick?: () => void;
  className?: string;
};

export default function Card({ title, value, subtitle, onClick, className }: CardProps) {
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') onClick();
            }
          : undefined
      }
      className={`surface group p-4 transition sm:p-5 ${
        onClick
          ? 'cursor-pointer active:scale-[0.98] hover:-translate-y-0.5 hover:border-white/10 hover:bg-zinc-900'
          : ''
      } ${className ?? ''}`}
    >
      <p className="text-xs font-medium tracking-wide text-zinc-400 uppercase">{title}</p>
      <p className="mt-1.5 text-xl font-bold text-white sm:text-2xl">{value}</p>
      {subtitle && <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">{subtitle}</p>}
    </div>
  );
}

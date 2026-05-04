type Props = {
  title: string;
  value: string;
  className?: string;
};

export default function Card({ title, value, className }: Props) {
  return (
    <div
      className={`bg-zinc-900 p-4 rounded border border-zinc-800 ${className ?? ''}`}
    >
      <p className="text-sm text-zinc-400">{title}</p>
      <p className="text-xl font-bold text-white">{value}</p>
    </div>
  );
}

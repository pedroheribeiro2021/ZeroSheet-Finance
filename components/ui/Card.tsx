type Props = {
  title: string;
  value: string | number;
};

export default function Card({ title, value }: Props) {
  return (
    <div className="bg-zinc-900 p-4 rounded-2xl shadow-md w-full">
      <p className="text-sm text-zinc-400">{title}</p>
      <h2 className="text-2xl font-bold text-white mt-2">{value}</h2>
    </div>
  );
}

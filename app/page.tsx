import Dashboard from '@/components/dashboard/Dashboard';

export default function Home() {
  return (
    <main className="min-h-screen bg-black">
      <h1 className="text-white text-2xl p-6 font-bold">ZeroSheet Finance</h1>

      <Dashboard />
    </main>
  );
}

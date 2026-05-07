'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });
  }, []);

  return (
    <div className="p-10 text-white bg-black min-h-screen">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      <pre className="mt-4">{JSON.stringify(user, null, 2)}</pre>
    </div>
  );
}

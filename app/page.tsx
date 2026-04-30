'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function Home() {
  useEffect(() => {
    const test = async () => {
      const { data, error } = await supabase.from('months').select('*');

      console.log('DATA:', data);
      console.log('ERROR:', error);
    };

    test();
  }, []);

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center">
      <h1>Supabase conectado</h1>
    </main>
  );
}

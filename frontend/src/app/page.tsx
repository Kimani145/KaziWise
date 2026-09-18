'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../features/auth/hooks';
import { isLearner } from '../lib/permissions';

export default function RootPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      router.replace('/login');
    } else if (isLearner(user)) {
      router.replace('/home');
    } else {
      router.replace('/dashboard');
    }
  }, [user, isLoading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-600 animate-pulse flex items-center justify-center text-white font-bold text-lg">
          K
        </div>
        <p className="text-xs font-semibold text-slate-500">Loading KaziWise...</p>
      </div>
    </div>
  );
}

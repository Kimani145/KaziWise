'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../features/auth/hooks';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { MobileNav } from './MobileNav';
import { Action, can, isLearner } from '../../lib/permissions';
import { LoadingSkeleton } from '../feedback/LoadingSkeleton';
import { ShieldAlert } from 'lucide-react';
import Link from 'next/link';

interface AppShellProps {
  children: React.ReactNode;
  requiredAction?: Action;
  learnerOnly?: boolean;
  staffOnly?: boolean;
}

export function AppShell({
  children,
  requiredAction,
  learnerOnly = false,
  staffOnly = false,
}: AppShellProps) {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      router.replace('/login');
      return;
    }

    if (learnerOnly && !isLearner(user)) {
      router.replace('/dashboard');
    }

    if (staffOnly && isLearner(user)) {
      router.replace('/home');
    }
  }, [user, isLoading, router, learnerOnly, staffOnly]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <LoadingSkeleton rows={4} />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Capability check
  if (requiredAction && !can(user, requiredAction)) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 md:pl-64 p-6 sm:p-10">
            <div className="max-w-md mx-auto mt-12 p-8 bg-white rounded-2xl border border-red-200 text-center shadow-sm space-y-4">
              <div className="w-14 h-14 mx-auto rounded-full bg-red-100 text-red-600 flex items-center justify-center">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Access Denied (403)</h2>
                <p className="text-xs text-slate-500 mt-1">
                  You do not possess the required capability (<code>{requiredAction}</code>) to view or operate this area.
                </p>
              </div>
              <div className="pt-2">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors min-h-[44px]"
                >
                  Return to Dashboard
                </Link>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <Header />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 md:pl-64 pb-24 md:pb-12 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}

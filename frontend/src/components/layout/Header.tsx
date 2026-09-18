'use client';

import React from 'react';
import { useAuth } from '../../features/auth/hooks';
import { LogOut } from 'lucide-react';

export function Header() {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <header className="h-16 bg-white border-b border-slate-200/80 px-6 flex items-center justify-between z-20">
      <div className="flex items-center gap-3 md:hidden">
        <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white font-bold flex items-center justify-center text-sm">
          K
        </div>
        <span className="font-bold text-slate-900 text-base">KaziWise</span>
      </div>

      <div className="hidden md:block">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          {user.role.replace('_', ' ')} WORKSPACE
        </span>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-xs font-bold text-slate-900">{user.name}</p>
          <p className="text-[10px] text-slate-500">{user.email}</p>
        </div>

        <button
          type="button"
          onClick={() => logout()}
          title="Sign Out"
          className="p-2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-slate-100 transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}

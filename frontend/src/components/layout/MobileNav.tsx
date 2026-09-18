'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../features/auth/hooks';
import { can, isLearner } from '../../lib/permissions';
import { Home, BookOpen, Award, LayoutDashboard, BarChart3, Users } from 'lucide-react';

export function MobileNav() {
  const pathname = usePathname();
  const { user } = useAuth();

  if (!user) return null;

  const learner = isLearner(user);

  const items = learner
    ? [
        { label: 'Home', href: '/home', icon: <Home className="w-5 h-5" /> },
        { label: 'Learning', href: '/learning', icon: <BookOpen className="w-5 h-5" /> },
        { label: 'Certificates', href: '/certificates', icon: <Award className="w-5 h-5" /> },
      ]
    : [
        { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
        ...(can(user, 'manageEmployees')
          ? [{ label: 'Employees', href: '/employees', icon: <Users className="w-5 h-5" /> }]
          : []),
        { label: 'Reports', href: '/reports', icon: <BarChart3 className="w-5 h-5" /> },
      ];

  return (
    <nav
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-40 px-2 py-1 shadow-lg"
    >
      <div className="flex items-center justify-around">
        {items.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center min-h-[48px] min-w-[48px] px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                isActive ? 'text-emerald-700 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {item.icon}
              <span className="text-[10px] mt-0.5">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

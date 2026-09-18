'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../features/auth/hooks';
import { can, isLearner, Action } from '../../lib/permissions';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Send,
  BarChart3,
  Award,
  LogOut,
  ShieldCheck,
  UserCheck,
  GraduationCap,
  Home,
} from 'lucide-react';

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  if (!user) return null;

  // Build navigation strictly from capability checks
  const navItems: Array<{
    label: string;
    href: string;
    icon: React.ReactNode;
    action?: Action;
  }> = [];

  // Learner navigation
  if (isLearner(user)) {
    navItems.push(
      { label: 'Home', href: '/home', icon: <Home className="w-5 h-5" /> },
      { label: 'My Learning', href: '/learning', icon: <BookOpen className="w-5 h-5" /> },
      { label: 'My Certificates', href: '/certificates', icon: <Award className="w-5 h-5" /> }
    );
  } else {
    // Admin / Manager navigation
    const isAdmin = can(user, 'manageEmployees') || can(user, 'authorCourses');
    navItems.push({
      label: isAdmin ? 'Dashboard' : 'Team Dashboard',
      href: '/dashboard',
      icon: <LayoutDashboard className="w-5 h-5" />,
    });

    if (can(user, 'manageEmployees')) {
      navItems.push({
        label: 'Employees',
        href: '/employees',
        icon: <Users className="w-5 h-5" />,
        action: 'manageEmployees',
      });
    }

    if (can(user, 'authorCourses')) {
      navItems.push({
        label: 'Course Library',
        href: '/courses',
        icon: <BookOpen className="w-5 h-5" />,
        action: 'authorCourses',
      });
    }

    if (can(user, 'manageCampaigns')) {
      navItems.push({
        label: 'Campaigns',
        href: '/campaigns',
        icon: <Send className="w-5 h-5" />,
        action: 'manageCampaigns',
      });
    }

    if (can(user, 'viewOrgReports') || can(user, 'viewTeamReports')) {
      navItems.push({
        label: can(user, 'viewOrgReports') ? 'Compliance Reports' : 'Team Reports',
        href: '/reports',
        icon: <BarChart3 className="w-5 h-5" />,
      });
    }

    if (can(user, 'viewOrgReports')) {
      navItems.push({
        label: 'Certificates Registry',
        href: '/certificates',
        icon: <Award className="w-5 h-5" />,
      });
    }
  }

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col h-screen fixed left-0 top-0 border-r border-slate-800 z-30 hidden md:flex">
      {/* Brand Header */}
      <div className="p-6 border-b border-slate-800/80 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-black text-lg shadow-sm">
          K
        </div>
        <div>
          <span className="font-bold text-white text-base tracking-tight block">
            KaziWise
          </span>
          <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider block">
            Compliance LMS
          </span>
        </div>
      </div>

      {/* Navigation links */}
      <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors min-h-[44px] ${
                isActive
                  ? 'bg-emerald-700/80 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <span className={isActive ? 'text-white' : 'text-slate-400'}>
                {item.icon}
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User profile & Logout */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/40 space-y-3">
        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 rounded-full bg-slate-800 text-emerald-400 font-bold text-xs flex items-center justify-center border border-slate-700">
            {user.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate">{user.name}</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider truncate font-medium">
              {user.role.replace('_', ' ')}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => logout()}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-400 hover:text-red-400 hover:bg-red-950/20 rounded-lg transition-colors min-h-[44px]"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}

'use client';

import React from 'react';
import { AppShell } from '../../components/layout/AppShell';
import { useAuth } from '../../features/auth/hooks';
import { Button } from '../../components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { User, Mail, Building, Shield, LogOut } from 'lucide-react';

export default function ProfilePage() {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            User Profile
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Account credentials, organizational details, and session state.
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-600 text-white font-extrabold text-xl flex items-center justify-center shadow-sm">
                {user.name.charAt(0)}
              </div>
              <div>
                <CardTitle className="text-lg font-bold text-slate-900">
                  {user.name}
                </CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">{user.email}</p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 pt-2">
            <div className="divide-y divide-slate-100 text-xs">
              <div className="py-3 flex items-center justify-between">
                <span className="text-slate-500 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-slate-400" />
                  Assigned RBAC Role
                </span>
                <Badge variant="primary">
                  {user.role.replace('_', ' ')}
                </Badge>
              </div>

              <div className="py-3 flex items-center justify-between">
                <span className="text-slate-500 flex items-center gap-2">
                  <Building className="w-4 h-4 text-slate-400" />
                  Department ID
                </span>
                <span className="font-mono text-slate-700 font-semibold">
                  {user.departmentId || 'Unassigned'}
                </span>
              </div>

              <div className="py-3 flex items-center justify-between">
                <span className="text-slate-500 flex items-center gap-2">
                  <User className="w-4 h-4 text-slate-400" />
                  User ID
                </span>
                <span className="font-mono text-slate-500 text-[11px]">
                  {user.id}
                </span>
              </div>

              <div className="py-3 flex items-center justify-between">
                <span className="text-slate-500 flex items-center gap-2">
                  <Building className="w-4 h-4 text-slate-400" />
                  Organisation Tenant ID
                </span>
                <span className="font-mono text-slate-500 text-[11px]">
                  {user.organisationId}
                </span>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <Button
                variant="outline"
                size="md"
                onClick={() => logout()}
                className="w-full min-h-[44px] text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out of Workspace
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

'use client';

import React from 'react';
import { AppShell } from '../../components/layout/AppShell';
import { ReportsTable } from '../../features/reports/ReportsTable';
import { useAuth } from '../../features/auth/hooks';
import { can } from '../../lib/permissions';

export default function ReportsPage() {
  const { user } = useAuth();
  const isOrgAdmin = can(user, 'viewOrgReports');

  return (
    <AppShell staffOnly={true}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {isOrgAdmin ? 'Organisation Compliance Reports' : 'Team Compliance Reports'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {isOrgAdmin
              ? 'Comprehensive compliance metrics, audit logs, and status breakdowns across all departments.'
              : 'Direct-reports compliance tracking, course completion status, and automated reminder triggers.'}
          </p>
        </div>

        <ReportsTable />
      </div>
    </AppShell>
  );
}

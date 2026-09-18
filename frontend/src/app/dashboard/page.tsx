'use client';

import React from 'react';
import { AppShell } from '../../components/layout/AppShell';
import { useAuth } from '../../features/auth/hooks';
import { can } from '../../lib/permissions';
import { useAssignmentsReport, useSendReminder } from '../../features/reports/hooks';
import { useEmployees } from '../../features/employees/hooks';
import { useCourses } from '../../features/courses/hooks';
import { useCampaigns } from '../../features/campaigns/hooks';
import { LoadingSkeleton } from '../../components/feedback/LoadingSkeleton';
import { ErrorState } from '../../components/feedback/ErrorState';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { formatDate } from '../../lib/utils';
import Link from 'next/link';
import {
  Users,
  BookOpen,
  Send,
  CheckCircle2,
  AlertTriangle,
  BarChart3,
  TrendingUp,
  Bell,
  ArrowRight,
} from 'lucide-react';

function AdminDashboardView() {
  const reportsQuery = useAssignmentsReport();
  const employeesQuery = useEmployees();
  const coursesQuery = useCourses();
  const campaignsQuery = useCampaigns();
  const sendReminderMutation = useSendReminder();

  const isLoading =
    reportsQuery.isLoading ||
    employeesQuery.isLoading ||
    coursesQuery.isLoading ||
    campaignsQuery.isLoading;

  const isError =
    reportsQuery.isError ||
    employeesQuery.isError ||
    coursesQuery.isError ||
    campaignsQuery.isError;

  if (isLoading) {
    return <LoadingSkeleton rows={5} />;
  }

  if (isError) {
    return (
      <ErrorState
        title="Failed to load dashboard metrics"
        message="Could not retrieve real-time organisation statistics. Please try again."
        onRetry={() => {
          reportsQuery.refetch();
          employeesQuery.refetch();
          coursesQuery.refetch();
          campaignsQuery.refetch();
        }}
      />
    );
  }

  const summary = reportsQuery.data?.summary;
  const employees = employeesQuery.data || [];
  const courses = coursesQuery.data || [];
  const campaigns = campaignsQuery.data || [];
  const rows = reportsQuery.data?.rows || [];

  const activeCoursesCount = courses.filter((c) => c.status === 'PUBLISHED').length;
  const activeCampaignsCount = campaigns.filter((c) => c.status === 'ACTIVE').length;
  const overdueRows = rows.filter((r) => r.isOverdue);

  const totalAssigned = summary?.totalAssignments ?? 0;
  const passedCount = summary?.passedCount ?? 0;
  const passRate = totalAssigned > 0 ? Math.round((passedCount / totalAssigned) * 100) : 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Executive Compliance Dashboard
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Real-time compliance telemetry across all departments and campaigns.
        </p>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Total Employees
              </p>
              <p className="text-3xl font-extrabold text-slate-900 mt-1">
                {employees.length}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-blue-50 text-blue-700">
              <Users className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Published Courses
              </p>
              <p className="text-3xl font-extrabold text-slate-900 mt-1">
                {activeCoursesCount}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700">
              <BookOpen className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Active Campaigns
              </p>
              <p className="text-3xl font-extrabold text-slate-900 mt-1">
                {activeCampaignsCount}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-purple-50 text-purple-700">
              <Send className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Completion Rate
              </p>
              <p className="text-3xl font-extrabold text-slate-900 mt-1">
                {summary?.completionRate ?? 0}%
              </p>
            </div>
            <div className="p-3 rounded-xl bg-teal-50 text-teal-700">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Overall Pass Rate
              </p>
              <p className="text-3xl font-extrabold text-slate-900 mt-1">
                {passRate}%
              </p>
            </div>
            <div className="p-3 rounded-xl bg-indigo-50 text-indigo-700">
              <TrendingUp className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className={summary && summary.overdueCount > 0 ? 'border-amber-300 bg-amber-50/20' : ''}>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Overdue Training Items
              </p>
              <p className={`text-3xl font-extrabold mt-1 ${summary && summary.overdueCount > 0 ? 'text-amber-800' : 'text-slate-900'}`}>
                {summary?.overdueCount ?? 0}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-amber-100 text-amber-900">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Overdue Attention List */}
      {overdueRows.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-700" />
              Overdue Compliance Items ({overdueRows.length})
            </h2>
            <Link
              href="/reports"
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
            >
              View Full Report
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="divide-y divide-slate-100">
              {overdueRows.slice(0, 5).map((row) => (
                <div
                  key={row.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <p className="font-bold text-slate-900">{row.learnerName}</p>
                    <p className="text-slate-500">
                      {row.courseTitle} • {row.departmentName}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-amber-800 font-semibold bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                      Due {formatDate(row.deadline)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => sendReminderMutation.mutate(row.id)}
                      disabled={sendReminderMutation.isPending}
                      className="min-h-[44px]"
                    >
                      <Bell className="w-3.5 h-3.5 mr-1" />
                      Remind
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ManagerDashboardView() {
  const reportsQuery = useAssignmentsReport();
  const sendReminderMutation = useSendReminder();

  if (reportsQuery.isLoading) {
    return <LoadingSkeleton rows={4} />;
  }

  if (reportsQuery.isError) {
    return (
      <ErrorState
        title="Failed to load team metrics"
        message="Could not load your team compliance data. Please try again."
        onRetry={() => reportsQuery.refetch()}
      />
    );
  }

  const summary = reportsQuery.data?.summary;
  const rows = reportsQuery.data?.rows || [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Manager Team Dashboard
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Direct reports training status, overdue compliance alerts, and reminders.
        </p>
      </div>

      {/* Team Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Team Assigned
            </p>
            <p className="text-3xl font-extrabold text-slate-900 mt-1">
              {summary?.totalAssignments ?? 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Passed & Certified
            </p>
            <p className="text-3xl font-extrabold text-emerald-700 mt-1">
              {summary?.passedCount ?? 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              In Progress
            </p>
            <p className="text-3xl font-extrabold text-blue-600 mt-1">
              {summary?.inProgressCount ?? 0}
            </p>
          </CardContent>
        </Card>

        <Card className={summary && summary.overdueCount > 0 ? 'border-amber-300 bg-amber-50/20' : ''}>
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Overdue Items
            </p>
            <p className={`text-3xl font-extrabold mt-1 ${summary && summary.overdueCount > 0 ? 'text-amber-800' : 'text-slate-900'}`}>
              {summary?.overdueCount ?? 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Direct Reports Training Roster */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">
            Direct Reports Training Status
          </h2>
          <Link
            href="/reports"
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
          >
            Detailed Team Reports
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {rows.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
            <p className="text-xs text-slate-500">No active assignments found for your direct reports.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="divide-y divide-slate-100">
              {rows.map((row) => (
                <div
                  key={row.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <p className="font-bold text-slate-900">{row.learnerName}</p>
                    <p className="text-slate-500">
                      {row.courseTitle} • {row.campaignName}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={
                        row.status === 'PASSED'
                          ? 'success'
                          : row.status === 'FAILED'
                          ? 'danger'
                          : row.isOverdue
                          ? 'warning'
                          : 'neutral'
                      }
                    >
                      {row.isOverdue && row.status !== 'PASSED' ? 'OVERDUE' : row.status}
                    </Badge>
                    {row.status !== 'PASSED' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => sendReminderMutation.mutate(row.id)}
                        disabled={sendReminderMutation.isPending}
                        className="min-h-[44px]"
                      >
                        <Bell className="w-3.5 h-3.5 mr-1" />
                        Remind
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const isAdmin = can(user, 'manageEmployees') || can(user, 'authorCourses');

  return (
    <AppShell staffOnly={true}>
      {isAdmin ? <AdminDashboardView /> : <ManagerDashboardView />}
    </AppShell>
  );
}

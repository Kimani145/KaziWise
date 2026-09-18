'use client';

import React from 'react';
import { AppShell } from '../../components/layout/AppShell';
import { useAuth } from '../../features/auth/hooks';
import { useMyAssignments } from '../../features/assignments/hooks';
import { LoadingSkeleton } from '../../components/feedback/LoadingSkeleton';
import { ErrorState } from '../../components/feedback/ErrorState';
import { EmptyState } from '../../components/feedback/EmptyState';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent } from '../../components/ui/card';
import { formatDate } from '../../lib/utils';
import Link from 'next/link';
import {
  BookOpen,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Award,
} from 'lucide-react';

export default function LearnerHomePage() {
  const { user } = useAuth();
  const assignmentsQuery = useMyAssignments();

  const assignments = assignmentsQuery.data || [];

  const activeAssignments = assignments.filter(
    (a) => a.status !== 'PASSED'
  );
  const completedAssignments = assignments.filter(
    (a) => a.status === 'PASSED'
  );
  const overdueCount = assignments.filter((a) => a.isOverdue && a.status !== 'PASSED').length;

  return (
    <AppShell learnerOnly={true}>
      <div className="space-y-8">
        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-emerald-800 to-teal-900 text-white rounded-3xl p-6 sm:p-8 shadow-sm relative overflow-hidden">
          <div className="relative z-10 space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-700/60 text-emerald-200 text-xs font-semibold backdrop-blur-sm">
              <Sparkles className="w-3.5 h-3.5" />
              Compliance Portal
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Welcome back, {user?.name}
            </h1>
            <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed">
              Stay compliant by finishing assigned courses before their statutory deadlines.
            </p>
          </div>
        </div>

        {/* Quick Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Active Training
                </p>
                <p className="text-3xl font-extrabold text-slate-900 mt-1">
                  {activeAssignments.length}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-blue-50 text-blue-700">
                <BookOpen className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Completed & Certified
                </p>
                <p className="text-3xl font-extrabold text-emerald-700 mt-1">
                  {completedAssignments.length}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700">
                <Award className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card className={overdueCount > 0 ? 'border-amber-300 bg-amber-50/20' : ''}>
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Overdue Actions
                </p>
                <p className={`text-3xl font-extrabold mt-1 ${overdueCount > 0 ? 'text-amber-800' : 'text-slate-900'}`}>
                  {overdueCount}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-amber-100 text-amber-900">
                <AlertTriangle className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actionable Training Items */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">
              Assigned Training Courses ({activeAssignments.length})
            </h2>
            <Link
              href="/learning"
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
            >
              View All
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {assignmentsQuery.isLoading ? (
            <LoadingSkeleton rows={4} />
          ) : assignmentsQuery.isError ? (
            <ErrorState
              title="Failed to load assignments"
              message="Could not load your assigned courses. Please try again."
              onRetry={() => assignmentsQuery.refetch()}
            />
          ) : activeAssignments.length === 0 ? (
            <EmptyState
              title="All caught up!"
              description="You currently have no outstanding training courses. Check back later or view your earned certificates."
              icon={<CheckCircle2 className="w-8 h-8 text-emerald-600" />}
              action={{
                label: 'View My Certificates',
                onClick: () => {
                  window.location.href = '/certificates';
                },
              }}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {activeAssignments.map((assignment) => {
                const isOverdue = assignment.isOverdue && assignment.status !== 'PASSED';
                const progress = assignment.progress ?? 0;

                return (
                  <div
                    key={assignment.id}
                    className={`bg-white rounded-2xl border p-5 sm:p-6 shadow-sm flex flex-col justify-between space-y-4 transition-all hover:border-emerald-400 ${
                      isOverdue ? 'border-amber-300 ring-1 ring-amber-300/50' : 'border-slate-200/90'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                          {assignment.campaignName}
                        </span>
                        {isOverdue ? (
                          <Badge variant="warning">OVERDUE</Badge>
                        ) : (
                          <Badge
                            variant={
                              assignment.status === 'IN_PROGRESS' || assignment.status === 'STARTED'
                                ? 'primary'
                                : 'neutral'
                            }
                          >
                            {assignment.status.replace('_', ' ')}
                          </Badge>
                        )}
                      </div>

                      <h3 className="text-base font-bold text-slate-900 leading-snug">
                        {assignment.courseTitle}
                      </h3>

                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>Deadline: <strong>{formatDate(assignment.deadline)}</strong></span>
                      </div>

                      {/* Numeric Progress Bar */}
                      <div className="space-y-1 pt-1">
                        <div className="flex items-center justify-between text-xs text-slate-600">
                          <span className="font-semibold">Progress</span>
                          <span className="font-bold text-emerald-700">{progress}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-emerald-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100">
                      <Link
                        href={`/learner/course/${assignment.id}`}
                        className="w-full min-h-[44px] inline-flex items-center justify-center text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl shadow-sm transition-colors"
                      >
                        Continue Course
                        <ArrowRight className="w-4 h-4 ml-1.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

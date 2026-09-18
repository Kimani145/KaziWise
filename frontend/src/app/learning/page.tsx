'use client';

import React, { useState } from 'react';
import { AppShell } from '../../components/layout/AppShell';
import { useMyAssignments } from '../../features/assignments/hooks';
import { LoadingSkeleton } from '../../components/feedback/LoadingSkeleton';
import { ErrorState } from '../../components/feedback/ErrorState';
import { EmptyState } from '../../components/feedback/EmptyState';
import { Badge } from '../../components/ui/badge';
import { formatDate } from '../../lib/utils';
import Link from 'next/link';
import {
  BookOpen,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Filter,
} from 'lucide-react';

export default function LearningPage() {
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const assignmentsQuery = useMyAssignments();

  const assignments = assignmentsQuery.data || [];

  const filtered = assignments.filter((a) => {
    if (filter === 'active') return a.status !== 'PASSED';
    if (filter === 'completed') return a.status === 'PASSED';
    return true;
  });

  return (
    <AppShell learnerOnly={true}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              My Learning Curriculum
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              All statutory training campaigns and compliance courses assigned to you.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="inline-flex rounded-xl bg-slate-200/70 p-1 text-xs font-semibold text-slate-600">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition-all min-h-[44px] sm:min-h-0 ${
                filter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'
              }`}
            >
              All ({assignments.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('active')}
              className={`px-3 py-1.5 rounded-lg transition-all min-h-[44px] sm:min-h-0 ${
                filter === 'active' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'
              }`}
            >
              Active ({assignments.filter((a) => a.status !== 'PASSED').length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('completed')}
              className={`px-3 py-1.5 rounded-lg transition-all min-h-[44px] sm:min-h-0 ${
                filter === 'completed' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'
              }`}
            >
              Passed ({assignments.filter((a) => a.status === 'PASSED').length})
            </button>
          </div>
        </div>

        {/* Assignments List */}
        {assignmentsQuery.isLoading ? (
          <LoadingSkeleton rows={5} />
        ) : assignmentsQuery.isError ? (
          <ErrorState
            title="Failed to load assigned training"
            message="Could not retrieve your learning curriculum."
            onRetry={() => assignmentsQuery.refetch()}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No courses found"
            description={
              filter === 'all'
                ? 'No compliance training has been assigned to your profile yet.'
                : `You have no ${filter} training items.`
            }
            icon={<BookOpen className="w-8 h-8 text-slate-400" />}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((assignment) => {
              const isOverdue = assignment.isOverdue && assignment.status !== 'PASSED';
              const progress = assignment.progress ?? 0;
              const isPassed = assignment.status === 'PASSED';

              return (
                <div
                  key={assignment.id}
                  className={`bg-white rounded-2xl border p-6 shadow-sm flex flex-col justify-between space-y-4 transition-all hover:border-slate-300 ${
                    isOverdue ? 'border-amber-300' : 'border-slate-200/90'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 line-clamp-1">
                        {assignment.campaignName}
                      </span>
                      {isPassed ? (
                        <Badge variant="success">PASSED</Badge>
                      ) : isOverdue ? (
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
                      className={`w-full min-h-[44px] inline-flex items-center justify-center text-xs font-bold rounded-xl transition-colors shadow-sm ${
                        isPassed
                          ? 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                          : 'bg-emerald-700 hover:bg-emerald-800 text-white'
                      }`}
                    >
                      {isPassed ? 'Review Course Material' : 'Continue Course'}
                      <ArrowRight className="w-4 h-4 ml-1.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}

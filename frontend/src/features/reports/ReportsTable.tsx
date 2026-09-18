'use client';

import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { StatusBadge, Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Select } from '../../components/ui/select';
import { useAssignmentsReport, useSendReminder } from './hooks';
import { exportAssignmentsReport } from './api';
import { useCampaigns } from '../campaigns/hooks';
import { useDepartments } from '../employees/hooks';
import { ReportFilterParams } from './types';
import { ReportSummaryCards } from './ReportSummaryCards';
import { EmptyState } from '../../components/feedback/EmptyState';
import { ErrorState } from '../../components/feedback/ErrorState';
import { LoadingSkeleton } from '../../components/feedback/LoadingSkeleton';
import { useCan } from '../../lib/permissions';
import { useAuth } from '../auth/hooks';
import { formatDate } from '../../lib/utils';
import {
  FileSpreadsheet,
  FileText,
  Bell,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

interface ReportsTableProps {
  initialFilters?: ReportFilterParams;
}

export function ReportsTable({ initialFilters = {} }: ReportsTableProps) {
  const { user } = useAuth();
  const canSendReminders = useCan(user, 'sendReminders');

  const [filters, setFilters] = useState<ReportFilterParams>(initialFilters);
  const [isExporting, setIsExporting] = useState<'xlsx' | 'pdf' | 'csv' | null>(null);
  const [reminderNotice, setReminderNotice] = useState<string | null>(null);

  const { data: reportData, isLoading, error, refetch } = useAssignmentsReport(filters);
  const { data: campaigns = [] } = useCampaigns();
  const { data: departments = [] } = useDepartments();
  const reminderMutation = useSendReminder();

  const handleExport = async (format: 'xlsx' | 'pdf' | 'csv') => {
    setIsExporting(format);
    try {
      const blob = await exportAssignmentsReport(filters, format);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kaziwise-report-${Date.now()}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Export failed: ${err.message || 'Error generating export'}`);
    } finally {
      setIsExporting(null);
    }
  };

  const handleSendReminder = async (assignmentId: string, learnerName: string) => {
    try {
      await reminderMutation.mutateAsync(assignmentId);
      setReminderNotice(`Reminder sent successfully to ${learnerName}.`);
      setTimeout(() => setReminderNotice(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to dispatch reminder');
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards directly from API response */}
      {reportData && <ReportSummaryCards summary={reportData.summary} />}

      {/* Filter and Export Action Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Select
            value={filters.campaignId || ''}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, campaignId: e.target.value || undefined }))
            }
          >
            <option value="">All Campaigns</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>

          <Select
            value={filters.departmentId || ''}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, departmentId: e.target.value || undefined }))
            }
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>

          <Select
            value={filters.status || ''}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, status: e.target.value || undefined }))
            }
          >
            <option value="">All Statuses</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="STARTED">Started</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed (Pending Quiz)</option>
            <option value="PASSED">Passed</option>
            <option value="FAILED">Failed</option>
          </Select>

          <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
            <input
              type="checkbox"
              id="overdue-filter"
              checked={Boolean(filters.isOverdue)}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, isOverdue: e.target.checked || undefined }))
              }
              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
            />
            <label
              htmlFor="overdue-filter"
              className="text-xs font-semibold text-slate-700 cursor-pointer select-none"
            >
              Show Overdue Only
            </label>
          </div>
        </div>

        {/* Exports Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="text-xs text-slate-500 font-medium">
            {reportData ? `Showing ${reportData.rows.length} assignment records` : 'Loading records...'}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('xlsx')}
              isLoading={isExporting === 'xlsx'}
            >
              <FileSpreadsheet className="w-4 h-4 mr-1.5 text-emerald-700" />
              Export Excel
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('pdf')}
              isLoading={isExporting === 'pdf'}
            >
              <FileText className="w-4 h-4 mr-1.5 text-red-700" />
              Export PDF
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('csv')}
              isLoading={isExporting === 'csv'}
            >
              Export CSV
            </Button>
          </div>
        </div>
      </div>

      {reminderNotice && (
        <div
          role="status"
          className="p-3 bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-900 rounded-lg flex items-center gap-2 animate-in fade-in"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{reminderNotice}</span>
        </div>
      )}

      {/* Loading state */}
      {isLoading && <LoadingSkeleton rows={6} />}

      {/* Error state */}
      {error && (
        <ErrorState
          title="Failed to load training reports"
          message={(error as any)?.message || 'An error occurred while fetching report data.'}
          onRetry={() => refetch()}
        />
      )}

      {/* Empty state */}
      {!isLoading && !error && reportData && reportData.rows.length === 0 && (
        <EmptyState
          title="No assignments match your filter criteria"
          description="Try adjusting your campaign, department, or status filters to view records."
          action={{
            label: 'Reset Filters',
            onClick: () => setFilters({}),
          }}
        />
      )}

      {/* Data Table */}
      {!isLoading && !error && reportData && reportData.rows.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Learner & Emp #</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Campaign & Course</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Score / Pass Mark</TableHead>
              <TableHead>Deadline</TableHead>
              <TableHead>Certificate</TableHead>
              {canSendReminders && <TableHead className="text-right">Action</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {reportData.rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <div className="font-semibold text-slate-900">{row.learnerName}</div>
                  <div className="text-xs text-slate-400 font-mono">
                    {row.employeeNumber} • {row.learnerEmail}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-xs font-medium text-slate-700">{row.departmentName}</div>
                  {row.managerName && (
                    <div className="text-[11px] text-slate-400">Mgr: {row.managerName}</div>
                  )}
                </TableCell>
                <TableCell>
                  <div className="font-medium text-slate-800">{row.campaignName}</div>
                  <div className="text-xs text-slate-500">{row.courseTitle}</div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <StatusBadge status={row.status} />
                    {row.isOverdue && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                        <AlertTriangle className="w-3 h-3" />
                        Late
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-xs font-bold text-slate-800">
                    {row.score !== null ? `${row.score}%` : '—'}
                  </div>
                  <div className="text-[11px] text-slate-400">Pass: {row.passMark}%</div>
                </TableCell>
                <TableCell>
                  <span className="text-xs text-slate-600">{formatDate(row.deadline)}</span>
                </TableCell>
                <TableCell>
                  {row.certificateNumber ? (
                    <div>
                      <span className="font-mono text-xs font-bold text-emerald-800">
                        {row.certificateNumber}
                      </span>
                      {row.completedLate && (
                        <span className="block text-[10px] text-amber-700 font-medium">
                          Completed Late
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </TableCell>
                {canSendReminders && (
                  <TableCell className="text-right">
                    {row.status !== 'PASSED' ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSendReminder(row.id, row.learnerName)}
                        title="Send Training Reminder"
                      >
                        <Bell className="w-4 h-4 mr-1 text-slate-500" />
                        Remind
                      </Button>
                    ) : (
                      <span className="text-xs text-emerald-600 font-medium">Compliant</span>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

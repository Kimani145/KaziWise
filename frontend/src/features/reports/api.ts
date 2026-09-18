import { apiFetch } from '../../lib/api-client';
import { AssignmentsReportData, ReportFilterParams } from './types';

export async function getAssignmentsReport(filters: ReportFilterParams = {}): Promise<AssignmentsReportData> {
  const query = new URLSearchParams();
  if (filters.campaignId) query.set('campaignId', filters.campaignId);
  if (filters.departmentId) query.set('departmentId', filters.departmentId);
  if (filters.status) query.set('status', filters.status);
  if (filters.startDate) query.set('startDate', filters.startDate);
  if (filters.endDate) query.set('endDate', filters.endDate);
  if (filters.isOverdue !== undefined) query.set('isOverdue', String(filters.isOverdue));

  const qStr = query.toString();
  return apiFetch<AssignmentsReportData>(`/reports/assignments${qStr ? `?${qStr}` : ''}`);
}

export async function exportAssignmentsReport(
  filters: ReportFilterParams = {},
  format: 'xlsx' | 'csv' | 'pdf'
): Promise<Blob> {
  return apiFetch<Blob>('/reports/assignments/export', {
    method: 'POST',
    body: JSON.stringify({ ...filters, format }),
  });
}

export async function sendAssignmentReminder(assignmentId: string): Promise<{ success: boolean; lastReminderAt: string }> {
  return apiFetch(`/assignments/${assignmentId}/remind`, {
    method: 'POST',
  });
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../lib/query-keys';
import {
  exportAssignmentsReport,
  getAssignmentsReport,
  sendAssignmentReminder,
} from './api';
import { ReportFilterParams } from './types';

export function useAssignmentsReport(filters: ReportFilterParams = {}) {
  return useQuery({
    queryKey: queryKeys.reports.assignments(filters),
    queryFn: () => getAssignmentsReport(filters),
  });
}

export function useSendReminder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (assignmentId: string) => sendAssignmentReminder(assignmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.all });
    },
  });
}

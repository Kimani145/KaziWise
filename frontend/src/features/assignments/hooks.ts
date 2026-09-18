import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../lib/query-keys';
import {
  completeLesson,
  getAssessment,
  getAssignmentDetail,
  getBlockSignedUrl,
  getMyAssignments,
  submitAssessmentAttempt,
} from './api';

export function useMyAssignments() {
  return useQuery({
    queryKey: queryKeys.assignments.myList,
    queryFn: () => getMyAssignments(),
  });
}

export function useAssignmentDetail(assignmentId: string) {
  return useQuery({
    queryKey: queryKeys.assignments.detail(assignmentId),
    queryFn: () => getAssignmentDetail(assignmentId),
    enabled: Boolean(assignmentId),
  });
}

export function useAssessment(assignmentId: string) {
  return useQuery({
    queryKey: queryKeys.assignments.assessment(assignmentId),
    queryFn: () => getAssessment(assignmentId),
    enabled: Boolean(assignmentId),
  });
}

export function useCompleteLesson(assignmentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (lessonId: string) => completeLesson(assignmentId, lessonId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.assignments.detail(assignmentId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.assignments.myList,
      });
    },
  });
}

export function useSubmitAttempt(assignmentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (answers: Record<string, string>) =>
      submitAssessmentAttempt(assignmentId, answers),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.assignments.detail(assignmentId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.assignments.myList,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.certificates.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.reports.all,
      });
    },
  });
}

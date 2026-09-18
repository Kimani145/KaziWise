import { apiFetch } from '../../lib/api-client';
import {
  AssessmentData,
  AssignmentDetail,
  AttemptSubmissionResult,
  LearnerAssignmentSummary,
} from './types';

export async function getMyAssignments(): Promise<LearnerAssignmentSummary[]> {
  return apiFetch<LearnerAssignmentSummary[]>('/me/assignments');
}

export async function getAssignmentDetail(assignmentId: string): Promise<AssignmentDetail> {
  return apiFetch<AssignmentDetail>(`/me/assignments/${assignmentId}`);
}

export async function completeLesson(
  assignmentId: string,
  lessonId: string
): Promise<{ assignmentId: string; lessonId: string; currentStatus: string }> {
  return apiFetch(`/me/assignments/${assignmentId}/lessons/${lessonId}/complete`, {
    method: 'POST',
  });
}

export async function getAssessment(assignmentId: string): Promise<AssessmentData> {
  return apiFetch<AssessmentData>(`/me/assignments/${assignmentId}/assessment`);
}

export async function submitAssessmentAttempt(
  assignmentId: string,
  answers: Record<string, string>
): Promise<AttemptSubmissionResult> {
  return apiFetch<AttemptSubmissionResult>(`/me/assignments/${assignmentId}/attempts`, {
    method: 'POST',
    body: JSON.stringify({ answers }),
  });
}

export async function getBlockSignedUrl(
  assignmentId: string,
  lessonId: string,
  blockId: string
): Promise<{ url: string; expiresAt: string }> {
  return apiFetch(`/me/assignments/${assignmentId}/lessons/${lessonId}/blocks/${blockId}/url`);
}

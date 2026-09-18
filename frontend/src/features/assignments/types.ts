import { Module } from '../courses/types';

export type AssignmentStatus =
  | 'ASSIGNED'
  | 'STARTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'PASSED'
  | 'FAILED';

export interface LearnerAssignmentSummary {
  id: string;
  campaignId: string;
  campaignName: string;
  courseId: string;
  courseTitle: string;
  courseDescription: string;
  courseVersion: number;
  status: AssignmentStatus;
  deadline: string;
  score: number | null;
  isOverdue: boolean;
  assignedAt: string;
  completedLateAt: string | null;
  certificateId: string | null;
  certificateNumber: string | null;
  progress?: number;
  campaign?: {
    id: string;
    name: string;
    course?: {
      id: string;
      title: string;
      description?: string;
    };
  };
}

export interface AssignmentDetail {
  id: string;
  campaignId: string;
  campaignName: string;
  courseId: string;
  courseTitle: string;
  courseDescription: string;
  courseVersion: number;
  passMark: number;
  certificateEnabled: boolean;
  status: AssignmentStatus;
  deadline: string;
  score: number | null;
  isOverdue: boolean;
  completedLessonIds: string[];
  modules: Module[];
  latestAttempt?: {
    id: string;
    attemptNumber: number;
    score: number;
    result: 'PASSED' | 'FAILED';
    submittedAt: string;
  } | null;
  certificate?: {
    id: string;
    certificateNumber: string;
    verificationCode: string;
    completionDate: string;
    completedLate: boolean;
  } | null;
}

export interface AssessmentQuestionOption {
  id: string;
  text: string;
}

export interface AssessmentQuestion {
  id: string;
  text: string;
  order: number;
  options: AssessmentQuestionOption[];
}

export interface AssessmentData {
  assignmentId: string;
  courseTitle: string;
  passMark: number;
  questions: AssessmentQuestion[];
}

export interface AttemptSubmissionResult {
  attemptId: string;
  attemptNumber: number;
  score: number;
  passMark: number;
  passed: boolean;
  assignmentStatus: AssignmentStatus;
  certificate?: {
    id: string;
    certificateNumber: string;
    verificationCode: string;
    completionDate: string;
    completedLate: boolean;
  } | null;
}

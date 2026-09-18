'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { AppShell } from '../../../../../components/layout/AppShell';
import { useAssessment } from '../../../../../features/assignments/hooks';
import { AssessmentView } from '../../../../../features/assignments/AssessmentView';
import { LoadingSkeleton } from '../../../../../components/feedback/LoadingSkeleton';
import { ErrorState } from '../../../../../components/feedback/ErrorState';

export default function LearnerAssessmentPage() {
  const params = useParams();
  const assignmentId = params.assignmentId as string;

  const assessmentQuery = useAssessment(assignmentId);

  return (
    <AppShell learnerOnly={true}>
      {assessmentQuery.isLoading ? (
        <LoadingSkeleton rows={6} />
      ) : assessmentQuery.isError || !assessmentQuery.data ? (
        <ErrorState
          title="Failed to load assessment"
          message="Could not load the assessment for this training course."
          onRetry={() => assessmentQuery.refetch()}
        />
      ) : (
        <AssessmentView
          assessment={assessmentQuery.data}
          assignmentId={assignmentId}
        />
      )}
    </AppShell>
  );
}

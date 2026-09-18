'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { AppShell } from '../../../../../components/layout/AppShell';
import { useAssignmentDetail } from '../../../../../features/assignments/hooks';
import { ResultView } from '../../../../../features/assignments/ResultView';
import { LoadingSkeleton } from '../../../../../components/feedback/LoadingSkeleton';
import { ErrorState } from '../../../../../components/feedback/ErrorState';

export default function LearnerResultPage() {
  const params = useParams();
  const assignmentId = params.assignmentId as string;

  const assignmentQuery = useAssignmentDetail(assignmentId);

  return (
    <AppShell learnerOnly={true}>
      {assignmentQuery.isLoading ? (
        <LoadingSkeleton rows={6} />
      ) : assignmentQuery.isError || !assignmentQuery.data ? (
        <ErrorState
          title="Failed to load assessment result"
          message="Could not load your assessment results."
          onRetry={() => assignmentQuery.refetch()}
        />
      ) : (
        <ResultView assignment={assignmentQuery.data} />
      )}
    </AppShell>
  );
}

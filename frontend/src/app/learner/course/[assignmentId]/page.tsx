'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { AppShell } from '../../../../components/layout/AppShell';
import { useAssignmentDetail } from '../../../../features/assignments/hooks';
import { CoursePlayer } from '../../../../features/assignments/CoursePlayer';
import { LoadingSkeleton } from '../../../../components/feedback/LoadingSkeleton';
import { ErrorState } from '../../../../components/feedback/ErrorState';

export default function LearnerCoursePlayerPage() {
  const params = useParams();
  const assignmentId = params.assignmentId as string;

  const assignmentQuery = useAssignmentDetail(assignmentId);

  return (
    <AppShell learnerOnly={true}>
      {assignmentQuery.isLoading ? (
        <LoadingSkeleton rows={8} />
      ) : assignmentQuery.isError || !assignmentQuery.data ? (
        <ErrorState
          title="Failed to load course"
          message="Could not load course curriculum for this assignment."
          onRetry={() => assignmentQuery.refetch()}
        />
      ) : (
        <CoursePlayer assignment={assignmentQuery.data} />
      )}
    </AppShell>
  );
}

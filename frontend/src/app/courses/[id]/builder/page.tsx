'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { AppShell } from '../../../../components/layout/AppShell';
import { useCourse } from '../../../../features/courses/hooks';
import { CourseBuilder } from '../../../../features/course-builder/CourseBuilder';
import { LoadingSkeleton } from '../../../../components/feedback/LoadingSkeleton';
import { ErrorState } from '../../../../components/feedback/ErrorState';

export default function CourseBuilderPage() {
  const params = useParams();
  const courseId = params.id as string;

  const courseQuery = useCourse(courseId);

  return (
    <AppShell requiredAction="authorCourses">
      {courseQuery.isLoading ? (
        <LoadingSkeleton rows={8} />
      ) : courseQuery.isError || !courseQuery.data ? (
        <ErrorState
          title="Failed to load course builder"
          message="The requested course could not be retrieved from the server."
          onRetry={() => courseQuery.refetch()}
        />
      ) : (
        <CourseBuilder course={courseQuery.data} />
      )}
    </AppShell>
  );
}

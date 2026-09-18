'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function CourseRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const assignmentId = params.assignmentId as string;

  useEffect(() => {
    if (assignmentId) {
      router.replace(`/learner/course/${assignmentId}`);
    }
  }, [assignmentId, router]);

  return null;
}

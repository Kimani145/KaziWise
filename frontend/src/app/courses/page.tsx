'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '../../components/layout/AppShell';
import {
  useCourses,
  useCreateCourse,
  usePublishCourse,
  useDeleteCourse,
} from '../../features/courses/hooks';
import { useAuth } from '../../features/auth/hooks';
import { can } from '../../lib/permissions';
import { LoadingSkeleton } from '../../components/feedback/LoadingSkeleton';
import { ErrorState } from '../../components/feedback/ErrorState';
import { EmptyState } from '../../components/feedback/EmptyState';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { FormField } from '../../components/forms/FormField';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import Link from 'next/link';
import {
  BookOpen,
  Plus,
  Edit,
  CheckCircle,
  Trash2,
  ExternalLink,
  Layers,
  HelpCircle,
} from 'lucide-react';

export default function CoursesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const canPublish = can(user, 'publishCourses');

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [createError, setCreateError] = useState('');

  const coursesQuery = useCourses();
  const createMutation = useCreateCourse();
  const publishMutation = usePublishCourse();
  const deleteMutation = useDeleteCourse();

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');

    if (!newTitle.trim()) {
      setCreateError('Course title is required.');
      return;
    }

    try {
      const created = await createMutation.mutateAsync({
        title: newTitle.trim(),
        description: newDesc.trim() || undefined,
      });
      setIsCreateModalOpen(false);
      setNewTitle('');
      setNewDesc('');
      router.push(`/courses/${created.id}/builder`);
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create course');
    }
  };

  const courses = coursesQuery.data || [];

  return (
    <AppShell requiredAction="authorCourses">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Course Library & Curriculum
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Create, edit, and publish compliance training courses and assessments.
            </p>
          </div>

          <Button
            variant="primary"
            size="md"
            onClick={() => setIsCreateModalOpen(true)}
            className="min-h-[44px]"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Course
          </Button>
        </div>

        {/* Courses List */}
        {coursesQuery.isLoading ? (
          <LoadingSkeleton rows={5} />
        ) : coursesQuery.isError ? (
          <ErrorState
            title="Failed to load courses"
            message="Could not load the course catalog from the server."
            onRetry={() => coursesQuery.refetch()}
          />
        ) : courses.length === 0 ? (
          <EmptyState
            title="No courses created yet"
            description="Create your first training course to start authoring modules and assessment questions."
            icon={<BookOpen className="w-8 h-8 text-slate-400" />}
            action={{
              label: 'Create First Course',
              onClick: () => setIsCreateModalOpen(true),
            }}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => {
              const moduleCount = course.modules?.length ?? 0;
              const lessonCount =
                course.modules?.reduce(
                  (sum, m) => sum + (m.lessons?.length ?? 0),
                  0
                ) ?? 0;
              const questionCount = course.questions?.length ?? 0;
              const isPublished = course.status === 'PUBLISHED';

              return (
                <div
                  key={course.id}
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-sm flex flex-col justify-between overflow-hidden hover:border-slate-300 transition-colors"
                >
                  <div className="p-6 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant={isPublished ? 'success' : 'neutral'}>
                        {isPublished ? 'PUBLISHED' : 'DRAFT'}
                      </Badge>
                      {course.estimatedDuration && (
                        <span className="text-[11px] font-medium text-slate-500">
                          {course.estimatedDuration}
                        </span>
                      )}
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-slate-900 leading-snug">
                        {course.title}
                      </h3>
                      <p className="text-xs text-slate-500 line-clamp-2 mt-1">
                        {course.description || 'No description provided.'}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center gap-4 text-xs text-slate-600 font-medium">
                      <span className="flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-slate-400" />
                        {moduleCount} modules ({lessonCount} lessons)
                      </span>
                      <span className="flex items-center gap-1.5">
                        <HelpCircle className="w-4 h-4 text-slate-400" />
                        {questionCount} questions
                      </span>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                    <Link
                      href={`/courses/${course.id}/builder`}
                      className="min-h-[44px] flex-1 inline-flex items-center justify-center px-3 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg shadow-sm transition-colors"
                    >
                      <Edit className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                      Open Builder
                    </Link>

                    {!isPublished && canPublish && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => publishMutation.mutate(course.id)}
                        isLoading={publishMutation.isPending}
                        className="min-h-[44px]"
                      >
                        <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                        Publish
                      </Button>
                    )}

                    {!isPublished && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (confirm(`Delete course "${course.title}"?`)) {
                            deleteMutation.mutate(course.id);
                          }
                        }}
                        disabled={deleteMutation.isPending}
                        className="min-h-[44px] text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Create Course Modal */}
        <Dialog
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title="Create New Course"
          description="Enter an initial title and description. You will add modules, content, and questions in the course builder."
        >
          <form onSubmit={handleCreateCourse} className="space-y-4">
            {createError && (
              <div
                role="alert"
                className="p-3 bg-red-50 border border-red-200 text-xs text-red-700 rounded-lg font-medium"
              >
                {createError}
              </div>
            )}

            <FormField label="Course Title" required htmlFor="course-title">
              <Input
                id="course-title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Anti-Money Laundering & Sanctions 2026"
                required
                className="min-h-[44px]"
              />
            </FormField>

            <FormField label="Description" htmlFor="course-description">
              <textarea
                id="course-description"
                rows={3}
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Brief course objectives and overview..."
                className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </FormField>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateModalOpen(false)}
                className="min-h-[44px]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={createMutation.isPending}
                className="min-h-[44px]"
              >
                Create & Open Builder
              </Button>
            </div>
          </form>
        </Dialog>
      </div>
    </AppShell>
  );
}

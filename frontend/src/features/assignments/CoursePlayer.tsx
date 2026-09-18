'use client';

import React, { useState, useEffect } from 'react';
import { AssignmentDetail, LearnerAssignmentSummary } from './types';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { useCompleteLesson } from './hooks';
import { getBlockSignedUrl } from './api';
import { formatDate } from '../../lib/utils';
import {
  BookOpen,
  CheckCircle,
  Clock,
  AlertTriangle,
  Play,
  FileText,
  Video,
  Image as ImageIcon,
  FileDown,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Lock,
} from 'lucide-react';
import Link from 'next/link';

interface CoursePlayerProps {
  assignment: AssignmentDetail;
}

export function CoursePlayer({ assignment }: CoursePlayerProps) {
  const completeMutation = useCompleteLesson(assignment.id);

  // Flatten lessons to navigate sequentially
  const allLessons = assignment.modules.flatMap((m) =>
    (m.lessons || []).map((l) => ({
      ...l,
      moduleTitle: m.title,
      moduleId: m.id,
    }))
  );

  const completedSet = new Set(assignment.completedLessonIds);

  // Find first incomplete lesson, or default to first lesson
  const initialLessonIndex = Math.max(
    0,
    allLessons.findIndex((l) => !completedSet.has(l.id))
  );

  const [activeLessonIndex, setActiveLessonIndex] = useState(initialLessonIndex);
  const activeLesson = allLessons[activeLessonIndex] || allLessons[0];

  // Media URL resolver for VIDEO, IMAGE, PDF blocks
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!activeLesson?.blocks) return;

    for (const block of activeLesson.blocks) {
      if (block.type !== 'TEXT' && !mediaUrls[block.id]) {
        getBlockSignedUrl(assignment.id, activeLesson.id, block.id)
          .then((res) => {
            setMediaUrls((prev) => ({ ...prev, [block.id]: res.url }));
          })
          .catch(() => {});
      }
    }
  }, [activeLesson, assignment.id]);

  // Numeric progress calculation per FRD
  const requiredLessons = allLessons.filter((l) => l.required);
  const requiredCompleted = requiredLessons.filter((l) => completedSet.has(l.id)).length;
  const progressPercent =
    requiredLessons.length > 0
      ? Math.round((requiredCompleted / requiredLessons.length) * 100)
      : 100;

  const isCurrentCompleted = activeLesson ? completedSet.has(activeLesson.id) : false;
  const isAssessmentUnlocked =
    requiredLessons.length === 0 || requiredCompleted >= requiredLessons.length;

  const handleCompleteCurrent = async () => {
    if (!activeLesson) return;
    await completeMutation.mutateAsync(activeLesson.id);
  };

  if (!activeLesson) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
        <p className="text-slate-600">No lessons available in this course.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Course Context & Progress Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
                {assignment.campaignName}
              </span>
              {assignment.isOverdue && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  OVERDUE
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold text-slate-900">{assignment.courseTitle}</h1>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5 font-medium">
              <Clock className="w-4 h-4 text-slate-400" />
              Due: {formatDate(assignment.deadline)}
            </span>
          </div>
        </div>

        {/* Numeric Progress display per FRD requirement */}
        <div className="space-y-1.5 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700">
              Training Progress: {progressPercent}%
            </span>
            <span className="text-slate-500">
              {requiredCompleted} of {requiredLessons.length} required lessons complete
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-emerald-600 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
              role="progressbar"
              aria-valuenow={progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>
      </div>

      {/* Main Player Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Lesson Content Viewer */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  {activeLesson.moduleTitle}
                </p>
                <h2 className="text-lg font-bold text-slate-900 mt-0.5">
                  {activeLesson.title}
                </h2>
              </div>
              <div>
                {isCurrentCompleted ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                    <CheckCircle className="w-4 h-4" />
                    Completed
                  </span>
                ) : (
                  <span className="text-xs font-medium text-slate-500">
                    {activeLesson.required ? 'Required' : 'Optional'}
                  </span>
                )}
              </div>
            </div>

            {/* Blocks renderer */}
            <div className="space-y-6">
              {(!activeLesson.blocks || activeLesson.blocks.length === 0) ? (
                <div className="p-8 text-center text-slate-400 italic">
                  No content blocks uploaded for this lesson.
                </div>
              ) : (
                activeLesson.blocks.map((b) => (
                  <div key={b.id} className="space-y-2">
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      {b.type === 'TEXT' && <FileText className="w-4 h-4 text-emerald-700" />}
                      {b.type === 'VIDEO' && <Video className="w-4 h-4 text-purple-600" />}
                      {b.type === 'IMAGE' && <ImageIcon className="w-4 h-4 text-blue-600" />}
                      {b.type === 'PDF' && <FileDown className="w-4 h-4 text-amber-600" />}
                      {b.title}
                    </h4>

                    {b.type === 'TEXT' && (
                      <div className="prose prose-sm max-w-none text-slate-700 bg-slate-50/50 p-4 rounded-xl border border-slate-200 whitespace-pre-wrap leading-relaxed">
                        {b.body}
                      </div>
                    )}

                    {b.type === 'VIDEO' && (
                      <div className="rounded-xl overflow-hidden bg-black aspect-video flex items-center justify-center">
                        {mediaUrls[b.id] ? (
                          <video
                            controls
                            src={mediaUrls[b.id]}
                            className="w-full h-full"
                          />
                        ) : (
                          <div className="text-white text-xs flex items-center gap-2">
                            <Play className="w-6 h-6 animate-pulse" />
                            Loading signed video stream...
                          </div>
                        )}
                      </div>
                    )}

                    {b.type === 'IMAGE' && (
                      <div className="rounded-xl overflow-hidden border border-slate-200">
                        {mediaUrls[b.id] ? (
                          <img
                            src={mediaUrls[b.id]}
                            alt={b.title}
                            className="w-full object-cover max-h-96"
                          />
                        ) : (
                          <div className="p-8 text-center text-xs text-slate-400">
                            Loading image...
                          </div>
                        )}
                      </div>
                    )}

                    {b.type === 'PDF' && (
                      <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileDown className="w-5 h-5 text-amber-700" />
                          <div>
                            <p className="text-xs font-bold text-slate-900">{b.title}</p>
                            <p className="text-[11px] text-slate-500">Secure PDF Attachment</p>
                          </div>
                        </div>
                        {mediaUrls[b.id] && (
                          <a
                            href={mediaUrls[b.id]}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center px-3 py-2 min-h-[44px] text-xs font-semibold text-white bg-amber-700 hover:bg-amber-800 rounded-lg transition-colors"
                          >
                            Open PDF
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Bottom Actions: Mark Complete & Pagination */}
            <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="md"
                  disabled={activeLessonIndex === 0}
                  onClick={() => setActiveLessonIndex((prev) => Math.max(0, prev - 1))}
                  className="flex-1 sm:flex-none"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="md"
                  disabled={activeLessonIndex === allLessons.length - 1}
                  onClick={() =>
                    setActiveLessonIndex((prev) => Math.min(allLessons.length - 1, prev + 1))
                  }
                  className="flex-1 sm:flex-none"
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>

              {!isCurrentCompleted && (
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleCompleteCurrent}
                  isLoading={completeMutation.isPending}
                  className="w-full sm:w-auto"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Complete & Mark Finished
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar: Table of Contents & Assessment Unlock */}
        <div className="space-y-6">
          {/* Assessment Unlock Callout */}
          <div
            className={`p-5 rounded-2xl border transition-all ${
              isAssessmentUnlocked
                ? 'bg-emerald-50 border-emerald-300 shadow-sm'
                : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`p-2.5 rounded-xl ${
                  isAssessmentUnlocked
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-200 text-slate-500'
                }`}
              >
                {isAssessmentUnlocked ? (
                  <HelpCircle className="w-6 h-6" />
                ) : (
                  <Lock className="w-6 h-6" />
                )}
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900">
                  {isAssessmentUnlocked
                    ? 'Assessment Unlocked!'
                    : 'Assessment Locked'}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {isAssessmentUnlocked
                    ? `You have completed all required lessons. Pass mark is ${assignment.passMark}%.`
                    : `Complete all ${requiredLessons.length} required lessons to unlock your compliance test.`}
                </p>
              </div>
            </div>

            {isAssessmentUnlocked && (
              <div className="mt-4 pt-3 border-t border-emerald-200">
                <Link
                  href={`/learner/course/${assignment.id}/assessment`}
                  className="w-full min-h-[44px] inline-flex items-center justify-center font-bold text-sm text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl shadow-sm transition-colors"
                >
                  Take Assessment Now
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </div>
            )}
          </div>

          {/* Table of Contents */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Course Curriculum
              </h3>
            </div>
            <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
              {allLessons.map((l, idx) => {
                const isSelected = idx === activeLessonIndex;
                const isDone = completedSet.has(l.id);

                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setActiveLessonIndex(idx)}
                    className={`w-full text-left p-3.5 text-xs transition-colors flex items-center justify-between min-h-[44px] ${
                      isSelected
                        ? 'bg-emerald-50/80 font-bold text-emerald-950 border-l-4 border-emerald-700'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 pr-2">
                      {isDone ? (
                        <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <div
                          className={`w-4 h-4 rounded-full border shrink-0 ${
                            isSelected ? 'border-emerald-600' : 'border-slate-300'
                          }`}
                        />
                      )}
                      <span className="line-clamp-2">{l.title}</span>
                    </div>
                    {l.required && !isDone && (
                      <span className="text-[10px] font-semibold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                        Req
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

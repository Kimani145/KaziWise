'use client';

import React, { useState } from 'react';
import { Course, Module, Lesson, ContentBlock, Question, Option, ContentType } from '../courses/types';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge, StatusBadge } from '../../components/ui/badge';
import { Dialog } from '../../components/ui/dialog';
import { FormField } from '../../components/forms/FormField';
import { Select } from '../../components/ui/select';
import { useCan, Action } from '../../lib/permissions';
import { useAuth } from '../auth/hooks';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api-client';
import { queryKeys } from '../../lib/query-keys';
import {
  BookOpen,
  Plus,
  Trash2,
  Edit2,
  CheckCircle,
  FileText,
  Video,
  Image as ImageIcon,
  FileDown,
  HelpCircle,
  Save,
  ArrowRight,
  Eye,
} from 'lucide-react';

interface CourseBuilderProps {
  course: Course;
}

export function CourseBuilder({ course: initialCourse }: CourseBuilderProps) {
  const { user } = useAuth();
  const canPublish = useCan(user, 'publishCourses');
  const queryClient = useQueryClient();

  // Local state for edits
  const [title, setTitle] = useState(initialCourse.title);
  const [description, setDescription] = useState(initialCourse.description);
  const [estimatedDuration, setEstimatedDuration] = useState(initialCourse.estimatedDuration || '');
  const [certificateEnabled, setCertificateEnabled] = useState(initialCourse.certificateEnabled);
  const [modules, setModules] = useState<Module[]>(initialCourse.modules || []);
  const [questions, setQuestions] = useState<Question[]>(initialCourse.questions || []);

  const [activeTab, setActiveTab] = useState<'curriculum' | 'assessment' | 'settings'>('curriculum');
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal states
  const [moduleModalOpen, setModuleModalOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<{ id?: string; title: string; order: number } | null>(null);

  const [lessonModalOpen, setLessonModalOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<{
    moduleId: string;
    id?: string;
    title: string;
    order: number;
    required: boolean;
  } | null>(null);

  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<{
    moduleId: string;
    lessonId: string;
    id?: string;
    title: string;
    type: ContentType;
    body: string;
    order: number;
  } | null>(null);

  const [questionModalOpen, setQuestionModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<{
    id?: string;
    text: string;
    order: number;
    options: Array<{ id?: string; text: string; isCorrect: boolean }>;
  } | null>(null);

  // Save Mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title,
        description,
        estimatedDuration,
        certificateEnabled,
        modules: modules.map((m, mIdx) => ({
          title: m.title,
          order: mIdx + 1,
          lessons: (m.lessons || []).map((l, lIdx) => ({
            title: l.title,
            order: lIdx + 1,
            required: l.required,
            blocks: (l.blocks || []).map((b, bIdx) => ({
              title: b.title,
              type: b.type,
              body: b.body,
              order: bIdx + 1,
            })),
          })),
        })),
        questions: questions.map((q, qIdx) => ({
          text: q.text,
          order: qIdx + 1,
          options: (q.options || []).map((o) => ({
            text: o.text,
            isCorrect: o.isCorrect,
          })),
        })),
      };

      return apiFetch<Course>(`/courses/${initialCourse.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.courses.all });
      setFeedbackMsg({ type: 'success', text: 'Course draft saved successfully.' });
      setModules(updated.modules || []);
      setQuestions(updated.questions || []);
    },
    onError: (err: any) => {
      setFeedbackMsg({ type: 'error', text: err.message || 'Failed to save changes' });
    },
  });

  // Publish Mutation
  const publishMutation = useMutation({
    mutationFn: async () => {
      return apiFetch<Course>(`/courses/${initialCourse.id}/publish`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.courses.all });
      setFeedbackMsg({ type: 'success', text: 'Course has been published successfully!' });
    },
    onError: (err: any) => {
      setFeedbackMsg({ type: 'error', text: err.message || 'Failed to publish course' });
    },
  });

  // Module handlers
  const handleSaveModule = () => {
    if (!editingModule || !editingModule.title.trim()) return;
    if (editingModule.id) {
      setModules(
        modules.map((m) =>
          m.id === editingModule.id ? { ...m, title: editingModule.title } : m
        )
      );
    } else {
      const newMod: Module = {
        id: `temp_${Date.now()}`,
        courseId: initialCourse.id,
        title: editingModule.title,
        order: modules.length + 1,
        lessons: [],
      };
      setModules([...modules, newMod]);
    }
    setModuleModalOpen(false);
    setEditingModule(null);
  };

  const handleDeleteModule = (modId: string) => {
    setModules(modules.filter((m) => m.id !== modId));
  };

  // Lesson handlers
  const handleSaveLesson = () => {
    if (!editingLesson || !editingLesson.title.trim()) return;
    const { moduleId, id, title, required } = editingLesson;

    setModules(
      modules.map((m) => {
        if (m.id !== moduleId) return m;
        const currentLessons = m.lessons || [];
        if (id) {
          return {
            ...m,
            lessons: currentLessons.map((l) =>
              l.id === id ? { ...l, title, required } : l
            ),
          };
        } else {
          const newLesson: Lesson = {
            id: `temp_lesson_${Date.now()}`,
            moduleId,
            title,
            order: currentLessons.length + 1,
            required,
            blocks: [],
          };
          return {
            ...m,
            lessons: [...currentLessons, newLesson],
          };
        }
      })
    );
    setLessonModalOpen(false);
    setEditingLesson(null);
  };

  const handleDeleteLesson = (moduleId: string, lessonId: string) => {
    setModules(
      modules.map((m) => {
        if (m.id !== moduleId) return m;
        return {
          ...m,
          lessons: (m.lessons || []).filter((l) => l.id !== lessonId),
        };
      })
    );
  };

  // Block handlers
  const handleSaveBlock = () => {
    if (!editingBlock || !editingBlock.title.trim()) return;
    const { moduleId, lessonId, id, title, type, body } = editingBlock;

    setModules(
      modules.map((m) => {
        if (m.id !== moduleId) return m;
        return {
          ...m,
          lessons: (m.lessons || []).map((l) => {
            if (l.id !== lessonId) return l;
            const currentBlocks = l.blocks || [];
            if (id) {
              return {
                ...l,
                blocks: currentBlocks.map((b) =>
                  b.id === id ? { ...b, title, type, body } : b
                ),
              };
            } else {
              const newBlock: ContentBlock = {
                id: `temp_block_${Date.now()}`,
                lessonId,
                title,
                type,
                body,
                order: currentBlocks.length + 1,
              };
              return {
                ...l,
                blocks: [...currentBlocks, newBlock],
              };
            }
          }),
        };
      })
    );
    setBlockModalOpen(false);
    setEditingBlock(null);
  };

  const handleDeleteBlock = (moduleId: string, lessonId: string, blockId: string) => {
    setModules(
      modules.map((m) => {
        if (m.id !== moduleId) return m;
        return {
          ...m,
          lessons: (m.lessons || []).map((l) => {
            if (l.id !== lessonId) return l;
            return {
              ...l,
              blocks: (l.blocks || []).filter((b) => b.id !== blockId),
            };
          }),
        };
      })
    );
  };

  // Question handlers
  const handleSaveQuestion = () => {
    if (!editingQuestion || !editingQuestion.text.trim()) return;
    if (editingQuestion.options.length < 2) {
      alert('Questions must have at least 2 options.');
      return;
    }
    if (!editingQuestion.options.some((o) => o.isCorrect)) {
      alert('Please designate at least one correct option.');
      return;
    }

    if (editingQuestion.id) {
      setQuestions(
        questions.map((q) =>
          q.id === editingQuestion.id
            ? {
                ...q,
                text: editingQuestion.text,
                options: editingQuestion.options.map((o, idx) => ({
                  id: o.id || `opt_${idx}`,
                  questionId: q.id,
                  text: o.text,
                  isCorrect: o.isCorrect,
                })),
              }
            : q
        )
      );
    } else {
      const qId = `temp_q_${Date.now()}`;
      const newQuestion: Question = {
        id: qId,
        courseId: initialCourse.id,
        text: editingQuestion.text,
        order: questions.length + 1,
        options: editingQuestion.options.map((o, idx) => ({
          id: `opt_${idx}_${Date.now()}`,
          questionId: qId,
          text: o.text,
          isCorrect: o.isCorrect,
        })),
      };
      setQuestions([...questions, newQuestion]);
    }
    setQuestionModalOpen(false);
    setEditingQuestion(null);
  };

  const handleDeleteQuestion = (qId: string) => {
    setQuestions(questions.filter((q) => q.id !== qId));
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-900">{title}</h1>
            <StatusBadge status={initialCourse.status} />
            <Badge variant="default">v{initialCourse.courseVersion}</Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {modules.length} Modules • {modules.flatMap((m) => m.lessons || []).length} Lessons •{' '}
            {questions.length} Assessment Questions
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => saveMutation.mutate()}
            isLoading={saveMutation.isPending}
          >
            <Save className="w-4 h-4 mr-2" />
            Save Draft
          </Button>

          {canPublish && initialCourse.status !== 'PUBLISHED' && (
            <Button
              variant="primary"
              onClick={() => publishMutation.mutate()}
              isLoading={publishMutation.isPending}
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Publish Course
            </Button>
          )}
        </div>
      </div>

      {feedbackMsg && (
        <div
          role="alert"
          className={`p-4 rounded-xl text-sm font-medium border flex items-center justify-between ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-red-50 text-red-900 border-red-200'
          }`}
        >
          <span>{feedbackMsg.text}</span>
          <button
            type="button"
            onClick={() => setFeedbackMsg(null)}
            className="text-xs underline hover:opacity-80"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('curriculum')}
          className={`px-6 py-3 font-semibold text-sm border-b-2 transition-colors min-h-[44px] flex items-center gap-2 ${
            activeTab === 'curriculum'
              ? 'border-emerald-700 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Curriculum Modules & Lessons
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('assessment')}
          className={`px-6 py-3 font-semibold text-sm border-b-2 transition-colors min-h-[44px] flex items-center gap-2 ${
            activeTab === 'assessment'
              ? 'border-emerald-700 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <HelpCircle className="w-4 h-4" />
          Assessment & Quiz Pool ({questions.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={`px-6 py-3 font-semibold text-sm border-b-2 transition-colors min-h-[44px] flex items-center gap-2 ${
            activeTab === 'settings'
              ? 'border-emerald-700 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Course Metadata & Settings
        </button>
      </div>

      {/* Tab: Curriculum */}
      {activeTab === 'curriculum' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Modules & Content Structure</h2>
              <p className="text-xs text-slate-500">
                Organize your course into ordered modules, lessons, and multi-format content blocks.
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setEditingModule({ title: '', order: modules.length + 1 });
                setModuleModalOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Add Module
            </Button>
          </div>

          {modules.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-xl border border-dashed border-slate-300">
              <BookOpen className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-700">No modules added yet.</p>
              <p className="text-xs text-slate-400 mb-4">
                Click "Add Module" to begin structuring the learning material.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditingModule({ title: '', order: 1 });
                  setModuleModalOpen(true);
                }}
              >
                Create First Module
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {modules.map((m, mIdx) => (
                <Card key={m.id} className="border-slate-200">
                  <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center justify-center">
                        {mIdx + 1}
                      </span>
                      <h3 className="text-sm font-bold text-slate-900">{m.title}</h3>
                      <span className="text-xs text-slate-400">
                        ({m.lessons?.length || 0} lessons)
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingLesson({
                            moduleId: m.id,
                            title: '',
                            order: (m.lessons?.length || 0) + 1,
                            required: true,
                          });
                          setLessonModalOpen(true);
                        }}
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        Add Lesson
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingModule({ id: m.id, title: m.title, order: m.order });
                          setModuleModalOpen(true);
                        }}
                      >
                        <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteModule(m.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </Button>
                    </div>
                  </div>

                  {/* Lessons list */}
                  <CardContent className="p-4 space-y-3">
                    {(!m.lessons || m.lessons.length === 0) ? (
                      <p className="text-xs text-slate-400 italic py-2">
                        No lessons in this module. Click "Add Lesson" above.
                      </p>
                    ) : (
                      m.lessons.map((l, lIdx) => (
                        <div
                          key={l.id}
                          className="border border-slate-200/80 rounded-lg p-3 bg-white space-y-2.5"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-slate-500">
                                {mIdx + 1}.{lIdx + 1}
                              </span>
                              <span className="text-sm font-semibold text-slate-800">
                                {l.title}
                              </span>
                              {l.required ? (
                                <Badge variant="warning">Required</Badge>
                              ) : (
                                <Badge variant="default">Optional</Badge>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditingBlock({
                                    moduleId: m.id,
                                    lessonId: l.id,
                                    title: '',
                                    type: 'TEXT',
                                    body: '',
                                    order: (l.blocks?.length || 0) + 1,
                                  });
                                  setBlockModalOpen(true);
                                }}
                              >
                                <Plus className="w-3 h-3 mr-1" />
                                Add Content
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditingLesson({
                                    moduleId: m.id,
                                    id: l.id,
                                    title: l.title,
                                    order: l.order,
                                    required: l.required,
                                  });
                                  setLessonModalOpen(true);
                                }}
                              >
                                <Edit2 className="w-3 h-3 text-slate-500" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteLesson(m.id, l.id)}
                              >
                                <Trash2 className="w-3 h-3 text-red-500" />
                              </Button>
                            </div>
                          </div>

                          {/* Content Blocks */}
                          {(!l.blocks || l.blocks.length === 0) ? (
                            <p className="text-[11px] text-slate-400 italic pl-5">
                              No content blocks. Add text, video, image, or PDF documents.
                            </p>
                          ) : (
                            <div className="pl-4 space-y-1.5 border-l-2 border-slate-100">
                              {l.blocks.map((b) => (
                                <div
                                  key={b.id}
                                  className="flex items-center justify-between p-2 rounded-md bg-slate-50 text-xs border border-slate-200/60"
                                >
                                  <div className="flex items-center gap-2">
                                    {b.type === 'TEXT' && <FileText className="w-3.5 h-3.5 text-blue-600" />}
                                    {b.type === 'VIDEO' && <Video className="w-3.5 h-3.5 text-purple-600" />}
                                    {b.type === 'IMAGE' && <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />}
                                    {b.type === 'PDF' && <FileDown className="w-3.5 h-3.5 text-amber-600" />}
                                    <span className="font-medium text-slate-700">{b.title}</span>
                                    <span className="text-[10px] text-slate-400 font-mono">({b.type})</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setEditingBlock({
                                          moduleId: m.id,
                                          lessonId: l.id,
                                          id: b.id,
                                          title: b.title,
                                          type: b.type,
                                          body: b.body,
                                          order: b.order,
                                        });
                                        setBlockModalOpen(true);
                                      }}
                                    >
                                      <Edit2 className="w-3 h-3 text-slate-400" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteBlock(m.id, l.id, b.id)}
                                    >
                                      <Trash2 className="w-3 h-3 text-red-400" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Assessment Questions */}
      {activeTab === 'assessment' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Course Assessment Quiz Pool</h2>
              <p className="text-xs text-slate-500">
                Create multiple-choice questions for the compliance assessment test.
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setEditingQuestion({
                  text: '',
                  order: questions.length + 1,
                  options: [
                    { text: '', isCorrect: true },
                    { text: '', isCorrect: false },
                  ],
                });
                setQuestionModalOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Add Question
            </Button>
          </div>

          {questions.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-xl border border-dashed border-slate-300">
              <HelpCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-700">No questions added yet.</p>
              <p className="text-xs text-slate-400 mb-4">
                Learners unlock this assessment once all required lessons are completed.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditingQuestion({
                    text: '',
                    order: 1,
                    options: [
                      { text: '', isCorrect: true },
                      { text: '', isCorrect: false },
                    ],
                  });
                  setQuestionModalOpen(true);
                }}
              >
                Add First Question
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {questions.map((q, idx) => (
                <Card key={q.id || idx}>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="text-sm font-bold text-slate-900">{q.text}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingQuestion({
                            id: q.id,
                            text: q.text,
                            order: q.order,
                            options: q.options.map((o) => ({
                              id: o.id,
                              text: o.text,
                              isCorrect: o.isCorrect,
                            })),
                          });
                          setQuestionModalOpen(true);
                        }}
                      >
                        <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteQuestion(q.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {q.options.map((opt, oIdx) => (
                      <div
                        key={opt.id || oIdx}
                        className={`p-3 rounded-lg text-xs flex items-center justify-between border ${
                          opt.isCorrect
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-900 font-semibold'
                            : 'bg-white border-slate-200 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-bold">
                            {String.fromCharCode(65 + oIdx)}
                          </span>
                          <span>{opt.text}</span>
                        </div>
                        {opt.isCorrect && (
                          <span className="text-[11px] text-emerald-700 font-bold uppercase tracking-wider flex items-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5" />
                            Correct Answer
                          </span>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Settings */}
      {activeTab === 'settings' && (
        <Card>
          <CardHeader>
            <CardTitle>Course Information & Issuance Defaults</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 max-w-xl">
            <FormField label="Course Title" htmlFor="course-title" required>
              <Input
                id="course-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </FormField>

            <FormField label="Course Description" htmlFor="course-desc" required>
              <textarea
                id="course-desc"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                required
              />
            </FormField>

            <FormField label="Estimated Duration" htmlFor="course-duration">
              <Input
                id="course-duration"
                value={estimatedDuration}
                onChange={(e) => setEstimatedDuration(e.target.value)}
                placeholder="e.g. 45 minutes"
              />
            </FormField>

            <div className="pt-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={certificateEnabled}
                  onChange={(e) => setCertificateEnabled(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <div>
                  <p className="text-sm font-semibold text-slate-900">Certificate Enabled by Default</p>
                  <p className="text-xs text-slate-500">
                    Pre-fills certificate issuance option when launching new campaigns for this course.
                  </p>
                </div>
              </label>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Module Modal */}
      <Dialog
        isOpen={moduleModalOpen}
        onClose={() => setModuleModalOpen(false)}
        title={editingModule?.id ? 'Edit Module' : 'Add New Module'}
      >
        <div className="space-y-4">
          <FormField label="Module Title" htmlFor="mod-title" required>
            <Input
              id="mod-title"
              value={editingModule?.title || ''}
              onChange={(e) =>
                setEditingModule((prev) => (prev ? { ...prev, title: e.target.value } : null))
              }
              placeholder="e.g. Chapter 1: Introduction to Data Privacy"
              required
            />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setModuleModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSaveModule}>
              Save Module
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Lesson Modal */}
      <Dialog
        isOpen={lessonModalOpen}
        onClose={() => setLessonModalOpen(false)}
        title={editingLesson?.id ? 'Edit Lesson' : 'Add Lesson'}
      >
        <div className="space-y-4">
          <FormField label="Lesson Title" htmlFor="les-title" required>
            <Input
              id="les-title"
              value={editingLesson?.title || ''}
              onChange={(e) =>
                setEditingLesson((prev) => (prev ? { ...prev, title: e.target.value } : null))
              }
              placeholder="e.g. 1.1 Understanding Sensitive Data"
              required
            />
          </FormField>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={editingLesson?.required ?? true}
              onChange={(e) =>
                setEditingLesson((prev) => (prev ? { ...prev, required: e.target.checked } : null))
              }
              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-sm font-medium text-slate-800">
              Required for Assessment Unlock
            </span>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setLessonModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSaveLesson}>
              Save Lesson
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Content Block Modal */}
      <Dialog
        isOpen={blockModalOpen}
        onClose={() => setBlockModalOpen(false)}
        title={editingBlock?.id ? 'Edit Content Block' : 'Add Content Block'}
        maxWidth="lg"
      >
        <div className="space-y-4">
          <FormField label="Block Title" htmlFor="block-title" required>
            <Input
              id="block-title"
              value={editingBlock?.title || ''}
              onChange={(e) =>
                setEditingBlock((prev) => (prev ? { ...prev, title: e.target.value } : null))
              }
              placeholder="e.g. Video Lecture / Policy Text"
              required
            />
          </FormField>

          <FormField label="Content Type" htmlFor="block-type" required>
            <Select
              id="block-type"
              value={editingBlock?.type || 'TEXT'}
              onChange={(e) =>
                setEditingBlock((prev) =>
                  prev ? { ...prev, type: e.target.value as ContentType } : null
                )
              }
            >
              <option value="TEXT">Text / Markdown</option>
              <option value="VIDEO">Video File</option>
              <option value="IMAGE">Image File</option>
              <option value="PDF">PDF Document</option>
            </Select>
          </FormField>

          <FormField
            label={
              editingBlock?.type === 'TEXT'
                ? 'Text Content'
                : 'Storage Object Key or URL reference'
            }
            htmlFor="block-body"
            required
          >
            <textarea
              id="block-body"
              rows={5}
              value={editingBlock?.body || ''}
              onChange={(e) =>
                setEditingBlock((prev) => (prev ? { ...prev, body: e.target.value } : null))
              }
              placeholder={
                editingBlock?.type === 'TEXT'
                  ? 'Enter lesson text or instructions...'
                  : 'Enter storage object key (e.g. orgId/blockId/file.ext)'
              }
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              required
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setBlockModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSaveBlock}>
              Save Block
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Question Modal */}
      <Dialog
        isOpen={questionModalOpen}
        onClose={() => setQuestionModalOpen(false)}
        title={editingQuestion?.id ? 'Edit Question' : 'Add Multiple Choice Question'}
        maxWidth="lg"
      >
        <div className="space-y-4">
          <FormField label="Question Prompt" htmlFor="q-text" required>
            <Input
              id="q-text"
              value={editingQuestion?.text || ''}
              onChange={(e) =>
                setEditingQuestion((prev) => (prev ? { ...prev, text: e.target.value } : null))
              }
              placeholder="e.g. What constitutes personally identifiable information (PII)?"
              required
            />
          </FormField>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                Answer Options (Mark at least one as correct)
              </label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditingQuestion((prev) => {
                    if (!prev) return null;
                    return {
                      ...prev,
                      options: [...prev.options, { text: '', isCorrect: false }],
                    };
                  });
                }}
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add Option
              </Button>
            </div>

            {editingQuestion?.options.map((opt, oIdx) => (
              <div key={oIdx} className="flex items-center gap-3">
                <input
                  type="radio"
                  name="correct-option"
                  checked={opt.isCorrect}
                  onChange={() => {
                    setEditingQuestion((prev) => {
                      if (!prev) return null;
                      return {
                        ...prev,
                        options: prev.options.map((o, i) => ({
                          ...o,
                          isCorrect: i === oIdx,
                        })),
                      };
                    });
                  }}
                  className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                  aria-label={`Mark option ${String.fromCharCode(65 + oIdx)} as correct`}
                />
                <Input
                  value={opt.text}
                  onChange={(e) => {
                    const newText = e.target.value;
                    setEditingQuestion((prev) => {
                      if (!prev) return null;
                      return {
                        ...prev,
                        options: prev.options.map((o, i) =>
                          i === oIdx ? { ...o, text: newText } : o
                        ),
                      };
                    });
                  }}
                  placeholder={`Option ${String.fromCharCode(65 + oIdx)}`}
                  required
                />
                {editingQuestion.options.length > 2 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingQuestion((prev) => {
                        if (!prev) return null;
                        return {
                          ...prev,
                          options: prev.options.filter((_, i) => i !== oIdx),
                        };
                      });
                    }}
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setQuestionModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSaveQuestion}>
              Save Question
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

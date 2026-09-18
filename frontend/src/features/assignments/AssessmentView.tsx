'use client';

import React, { useState } from 'react';
import { AssessmentData } from './types';
import { Button } from '../../components/ui/button';
import { useSubmitAttempt } from './hooks';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle, HelpCircle } from 'lucide-react';

interface AssessmentViewProps {
  assessment: AssessmentData;
  assignmentId: string;
}

export function AssessmentView({ assessment, assignmentId }: AssessmentViewProps) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState('');
  const submitMutation = useSubmitAttempt(assignmentId);

  const handleSelectOption = (questionId: string, optionId: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
    setErrorMessage('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    // Ensure all questions are answered
    const unanswered = assessment.questions.filter((q) => !answers[q.id]);
    if (unanswered.length > 0) {
      setErrorMessage(
        `Please answer all questions before submitting. (${unanswered.length} remaining)`
      );
      return;
    }

    try {
      const result = await submitMutation.mutateAsync(answers);
      // Navigate to dedicated result view carrying assignmentId
      router.push(`/learner/course/${assignmentId}/result`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit assessment');
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-800">
          <HelpCircle className="w-4 h-4" />
          Final Knowledge Assessment
        </div>
        <h1 className="text-xl font-bold text-slate-900">{assessment.courseTitle}</h1>
        <p className="text-xs text-slate-500">
          Answer all {assessment.questions.length} questions. You need {assessment.passMark}% or higher to pass and achieve compliance certification.
        </p>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Questions Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {assessment.questions.map((q, qIdx) => (
          <div
            key={q.id}
            className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm space-y-4"
          >
            <div className="flex items-start gap-3">
              <span className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center shrink-0">
                {qIdx + 1}
              </span>
              <h3 className="text-sm font-bold text-slate-900 leading-snug pt-1">
                {q.text}
              </h3>
            </div>

            <div className="space-y-2 pl-10">
              {q.options.map((opt, oIdx) => {
                const isSelected = answers[q.id] === opt.id;
                return (
                  <label
                    key={opt.id}
                    className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all min-h-[44px] ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50/70 font-semibold text-emerald-950 ring-1 ring-emerald-600'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`question_${q.id}`}
                      value={opt.id}
                      checked={isSelected}
                      onChange={() => handleSelectOption(q.id, opt.id)}
                      className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-xs">
                      <strong className="mr-1.5 font-bold">
                        {String.fromCharCode(65 + oIdx)}.
                      </strong>
                      {opt.text}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}

        <div className="flex justify-end p-4 bg-white rounded-2xl border border-slate-200/90 shadow-sm">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={submitMutation.isPending}
            className="w-full sm:w-auto"
          >
            Submit Assessment for Grading
          </Button>
        </div>
      </form>
    </div>
  );
}

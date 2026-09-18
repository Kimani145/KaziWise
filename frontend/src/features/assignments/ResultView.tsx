'use client';

import React from 'react';
import { AssignmentDetail } from './types';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import Link from 'next/link';
import {
  CheckCircle2,
  XCircle,
  Award,
  RotateCcw,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

interface ResultViewProps {
  assignment: AssignmentDetail;
}

export function ResultView({ assignment }: ResultViewProps) {
  const latestAttempt = assignment.latestAttempt;
  const isPassed = assignment.status === 'PASSED';
  const isFailed = assignment.status === 'FAILED';

  const score = latestAttempt ? latestAttempt.score : (assignment.score ?? 0);
  const passMark = assignment.passMark;

  return (
    <div className="max-w-2xl mx-auto space-y-6 pt-4">
      <Card className="overflow-hidden border-slate-200">
        <div
          className={`p-8 text-center space-y-4 ${
            isPassed ? 'bg-emerald-50/70 border-b border-emerald-100' : 'bg-red-50/70 border-b border-red-100'
          }`}
        >
          <div
            className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center shadow-sm ${
              isPassed ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
            }`}
          >
            {isPassed ? <CheckCircle2 className="w-8 h-8" /> : <XCircle className="w-8 h-8" />}
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-slate-900">
              {isPassed ? 'Assessment Passed!' : 'Assessment Not Passed'}
            </h1>
            <p className="text-xs text-slate-600">
              {isPassed
                ? 'Congratulations! You have satisfied all compliance learning requirements.'
                : 'You did not achieve the required pass mark on this attempt.'}
            </p>
          </div>

          {/* Scores Callout */}
          <div className="inline-flex items-center gap-6 p-4 rounded-xl bg-white border border-slate-200 shadow-sm mx-auto">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Your Score
              </p>
              <p
                className={`text-3xl font-extrabold ${
                  isPassed ? 'text-emerald-700' : 'text-red-600'
                }`}
              >
                {score}%
              </p>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Pass Mark
              </p>
              <p className="text-3xl font-extrabold text-slate-700">{passMark}%</p>
            </div>
          </div>
        </div>

        <CardContent className="p-6 space-y-6">
          {/* Certificate Notice if PASSED */}
          {isPassed && assignment.certificate && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-emerald-100 text-emerald-800">
                  <Award className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Official Certificate Issued
                  </h3>
                  <p className="text-xs text-slate-500">
                    Certificate No: <span className="font-mono font-bold text-slate-800">{assignment.certificate.certificateNumber}</span>
                  </p>
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                <Link
                  href={`/certificates`}
                  className="flex-1 min-h-[44px] inline-flex items-center justify-center text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors"
                >
                  View My Certificates
                </Link>
                <Link
                  href={`/verify/${assignment.certificate.verificationCode}`}
                  target="_blank"
                  className="min-h-[44px] inline-flex items-center justify-center px-4 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors"
                >
                  <ShieldCheck className="w-4 h-4 mr-1.5 text-emerald-600" />
                  Public Verification Page
                </Link>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <Link
              href="/learning"
              className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Return to My Learning
            </Link>

            {/* CRITICAL CHECKLIST REQUIREMENT: Retake control is conditionally rendered on status === 'FAILED' ONLY — absent, not just disabled, when PASSED */}
            {isFailed && (
              <Link
                href={`/learner/course/${assignment.id}/assessment`}
                className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center px-6 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm transition-colors"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Retake Assessment
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

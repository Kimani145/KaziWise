'use client';

import React from 'react';
import { AppShell } from '../../components/layout/AppShell';
import { useAuth } from '../../features/auth/hooks';
import { isLearner, can } from '../../lib/permissions';
import { useMyCertificates } from '../../features/certificates/hooks';
import { useAssignmentsReport } from '../../features/reports/hooks';
import { LoadingSkeleton } from '../../components/feedback/LoadingSkeleton';
import { ErrorState } from '../../components/feedback/ErrorState';
import { EmptyState } from '../../components/feedback/EmptyState';
import { Badge } from '../../components/ui/badge';
import { formatDate } from '../../lib/utils';
import Link from 'next/link';
import {
  Award,
  ShieldCheck,
  ExternalLink,
  Calendar,
  CheckCircle2,
} from 'lucide-react';

function LearnerCertificatesView() {
  const certsQuery = useMyCertificates();
  const certs = certsQuery.data || [];

  if (certsQuery.isLoading) {
    return <LoadingSkeleton rows={4} />;
  }

  if (certsQuery.isError) {
    return (
      <ErrorState
        title="Failed to load certificates"
        message="Could not retrieve your compliance certificates. Please try again."
        onRetry={() => certsQuery.refetch()}
      />
    );
  }

  if (certs.length === 0) {
    return (
      <EmptyState
        title="No certificates earned yet"
        description="Complete all required lessons and pass the final course assessment to receive an official compliance certificate."
        icon={<Award className="w-8 h-8 text-slate-400" />}
        action={{
          label: 'Go to My Learning',
          onClick: () => {
            window.location.href = '/learning';
          },
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {certs.map((cert) => (
          <div
            key={cert.id}
            className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-4 hover:border-emerald-300 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700">
                <Award className="w-6 h-6" />
              </div>
              <Badge variant="success">OFFICIALLY ISSUED</Badge>
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900">
                {cert.assignment?.campaign?.course?.title || cert.courseTitle || 'Compliance Course'}
              </h3>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                No: {cert.certificateNumber}
              </p>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
              <span>Achieved Score: <strong className="text-emerald-700 font-bold">{cert.score}%</strong></span>
              <span>Issued: {formatDate(cert.completionDate)}</span>
            </div>

            <div className="pt-2">
              <Link
                href={`/verify/${cert.verificationCode}`}
                target="_blank"
                className="w-full min-h-[44px] inline-flex items-center justify-center text-xs font-semibold text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors"
              >
                <ShieldCheck className="w-4 h-4 mr-1.5 text-emerald-600" />
                Public Verification Record
                <ExternalLink className="w-3.5 h-3.5 ml-1.5 text-slate-400" />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminCertificatesRegistryView() {
  const reportsQuery = useAssignmentsReport();

  if (reportsQuery.isLoading) {
    return <LoadingSkeleton rows={6} />;
  }

  if (reportsQuery.isError) {
    return (
      <ErrorState
        title="Failed to load certificates registry"
        message="Could not retrieve the organization's certificate records."
        onRetry={() => reportsQuery.refetch()}
      />
    );
  }

  const rows = reportsQuery.data?.rows || [];
  const certifiedRows = rows.filter((r) => Boolean(r.certificateNumber));

  if (certifiedRows.length === 0) {
    return (
      <EmptyState
        title="No certificates issued yet"
        description="Certificates will appear here once learners complete campaigns and achieve passing assessment marks."
        icon={<Award className="w-8 h-8 text-slate-400" />}
      />
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
            <tr>
              <th className="p-4">Learner</th>
              <th className="p-4">Course</th>
              <th className="p-4">Certificate Number</th>
              <th className="p-4">Score</th>
              <th className="p-4">Completion Date</th>
              <th className="p-4 text-right">Verification</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {certifiedRows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                <td className="p-4">
                  <p className="font-bold text-slate-900">{row.learnerName}</p>
                  <p className="text-slate-500 text-[11px]">{row.departmentName}</p>
                </td>
                <td className="p-4 font-medium text-slate-800">
                  {row.courseTitle}
                </td>
                <td className="p-4 font-mono font-bold text-slate-700">
                  {row.certificateNumber}
                </td>
                <td className="p-4 font-bold text-emerald-700">
                  {row.score}%
                </td>
                <td className="p-4 text-slate-600">
                  {formatDate(row.completionDate)}
                </td>
                <td className="p-4 text-right">
                  {row.certificateNumber && (
                    <Link
                      href={`/verify/${row.certificateNumber}`}
                      target="_blank"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 p-2 min-h-[44px]"
                    >
                      Verify
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function CertificatesPage() {
  const { user } = useAuth();
  const learner = isLearner(user);

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {learner ? 'My Compliance Certificates' : 'Organisation Certificates Registry'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {learner
              ? 'Official verifiable compliance credentials earned from successfully completed courses.'
              : 'Permanent audit ledger of all issued compliance credentials across your workforce.'}
          </p>
        </div>

        {learner ? <LearnerCertificatesView /> : <AdminCertificatesRegistryView />}
      </div>
    </AppShell>
  );
}

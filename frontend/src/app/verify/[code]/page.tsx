'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { useVerifyCertificate } from '../../../features/certificates/hooks';
import { LoadingSkeleton } from '../../../components/feedback/LoadingSkeleton';
import { formatDate } from '../../../lib/utils';
import Link from 'next/link';
import {
  ShieldCheck,
  ShieldAlert,
  Award,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';

export default function VerifyCertificatePage() {
  const params = useParams();
  const code = params.code as string;

  const verifyQuery = useVerifyCertificate(code);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-lg">
        <div className="flex justify-center">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center text-white font-extrabold text-2xl shadow-md">
            K
          </div>
        </div>
        <h2 className="mt-4 text-center text-2xl font-bold tracking-tight text-slate-900">
          KaziWise Certificate Verification
        </h2>
        <p className="mt-1 text-center text-xs font-semibold text-emerald-700 tracking-wider uppercase">
          Official Compliance Registry Audit
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg">
        <div className="bg-white py-8 px-6 shadow-sm rounded-3xl border border-slate-200 sm:px-10 space-y-6">
          {verifyQuery.isLoading ? (
            <div className="space-y-4 py-4">
              <LoadingSkeleton rows={4} />
            </div>
          ) : verifyQuery.isError || !verifyQuery.data || !verifyQuery.data.valid ? (
            <div className="text-center space-y-4 py-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-red-100 text-red-600 flex items-center justify-center">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Invalid or Unrecognized Certificate
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  The verification code <span className="font-mono font-bold text-slate-800">{code}</span> does not match any valid certificate in the KaziWise registry.
                </p>
              </div>
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
                This credential cannot be verified. It may have been revoked or entered incorrectly.
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Authenticity Badge */}
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-600 text-white shadow-sm">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-emerald-950">
                    Official & Valid Compliance Credential
                  </h3>
                  <p className="text-[11px] text-emerald-700">
                    Cryptographically authenticated in the organization compliance ledger.
                  </p>
                </div>
              </div>

              {/* Certificate Details */}
              <div className="space-y-3 divide-y divide-slate-100 text-xs">
                <div className="pt-2 flex justify-between">
                  <span className="text-slate-500">Certificate Number:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {verifyQuery.data.certificateNumber}
                  </span>
                </div>

                <div className="pt-3 flex justify-between">
                  <span className="text-slate-500">Learner Name:</span>
                  <span className="font-bold text-slate-900">
                    {verifyQuery.data.learnerName}
                  </span>
                </div>

                <div className="pt-3 flex justify-between">
                  <span className="text-slate-500">Compliance Course:</span>
                  <span className="font-bold text-slate-900 text-right max-w-xs">
                    {verifyQuery.data.courseTitle}
                  </span>
                </div>

                <div className="pt-3 flex justify-between">
                  <span className="text-slate-500">Completion Date:</span>
                  <span className="font-medium text-slate-800">
                    {formatDate(verifyQuery.data.completionDate)}
                  </span>
                </div>

                <div className="pt-3 flex justify-between items-center">
                  <span className="text-slate-500">Statutory Status:</span>
                  {verifyQuery.data.completedLate ? (
                    <span className="inline-flex items-center gap-1 text-amber-800 bg-amber-50 px-2 py-0.5 rounded font-semibold border border-amber-200 text-[10px]">
                      <AlertTriangle className="w-3 h-3" />
                      Completed Late
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-semibold border border-emerald-200 text-[10px]">
                      <CheckCircle2 className="w-3 h-3" />
                      Completed On Time
                    </span>
                  )}
                </div>
              </div>

              <div className="pt-2 text-center border-t border-slate-100">
                <Link
                  href="/login"
                  className="inline-flex items-center text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                >
                  Access KaziWise Platform
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
